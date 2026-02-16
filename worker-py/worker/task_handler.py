import asyncio
import json
import logging
import time
import traceback

from .clone import clone_repo, cleanup_repo
from .agent_passes import run_structure_analysis, run_page_generation, run_context_generation
from .cache import update_status, save_docs_cache, acquire_lock, release_lock
from .db import update_repo_status, save_documentation, get_repo_claimer_email, update_repo_indexed_with
from .email import send_completion_email
from . import otel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


async def handle_index_repo(
    ctx: dict,
    repo_id: str,
    owner: str,
    repo: str,
    full_name: str,
    agent_sdk: str = "claude",
) -> None:
    """Main task handler for repo:index jobs."""
    logger.info(f"[{full_name}] Job received: repo_id={repo_id}, agent_sdk={agent_sdk}")
    repo_dir = None
    start_ms = time.monotonic_ns() // 1_000_000
    try:
        # Acquire distributed lock
        if not await acquire_lock(owner, repo):
            logger.warning(f"[{full_name}] Lock already held, skipping")
            return

        # ── Clone (0-10%) ──
        logger.info(f"[{full_name}] Cloning repository...")
        await update_repo_status(repo_id, "FETCHING", progress=5)
        await update_status(owner, repo, "FETCHING", 5, "Cloning repository...")

        repo_dir = await clone_repo(owner, repo)
        logger.info(f"[{full_name}] Clone complete: {repo_dir}")
        await update_repo_status(repo_id, "ANALYZING", progress=10)
        await update_status(owner, repo, "ANALYZING", 10, "Analyzing repository structure...")

        # ── Step 1: Structure Analysis (10-20%) ──
        logger.info(f"[{full_name}] Step 1: Structure analysis...")
        page_plans = await run_structure_analysis(repo_dir, agent_sdk=agent_sdk)
        total_pages = len(page_plans)
        logger.info(f"[{full_name}] Structure analysis complete: {total_pages} pages planned")

        page_titles = [p["title"] for p in page_plans]
        await update_status(owner, repo, "ANALYZING", 20, f"Generating {total_pages} pages: {', '.join(page_titles)}")

        # ── Step 2: Page Generation (20-90%) — scatter-gather ──
        logger.info(f"[{full_name}] Generating {total_pages} pages in parallel...")
        await update_status(
            owner, repo, "ANALYZING", 25,
            f"Generating {total_pages} pages in parallel..."
        )
        await update_repo_status(repo_id, "ANALYZING", progress=25)

        async def _generate_one(plan: dict) -> dict:
            content = await run_page_generation(repo_dir, plan, page_plans, agent_sdk=agent_sdk)
            logger.info(f"[{full_name}] Page complete: {plan['title']} ({len(content)} chars)")
            return {"slug": plan["slug"], "title": plan["title"], "content": content}

        results = await asyncio.gather(*[_generate_one(p) for p in page_plans])

        # Sort by original priority order
        generated_pages = sorted(results, key=lambda r: next(
            p["priority"] for p in page_plans if p["slug"] == r["slug"]
        ))
        logger.info(f"[{full_name}] All {total_pages} pages generated")
        await update_status(owner, repo, "ANALYZING", 90, "All pages generated")
        await update_repo_status(repo_id, "ANALYZING", progress=90)

        # ── Step 3: Context Generation (90-96%) ──
        logger.info(f"[{full_name}] Generating Q&A context...")
        await update_status(owner, repo, "ANALYZING", 90, "Generating AI chat context...")
        await update_repo_status(repo_id, "ANALYZING", progress=90)

        all_pages_json = json.dumps(generated_pages, indent=2)
        repo_context = await run_context_generation(repo_dir, all_pages_json, agent_sdk=agent_sdk)
        logger.info(f"[{full_name}] Context generation complete")

        # ── Save (96-100%) ──
        await update_status(owner, repo, "ANALYZING", 96, "Saving documentation...")

        docs_dict = {
            "pages": generated_pages,
            "repoContext": repo_context,
        }

        await save_documentation(repo_id, docs_dict)
        await update_repo_status(repo_id, "COMPLETED", progress=100)
        await update_status(owner, repo, "COMPLETED", 100, "Documentation complete!")

        # Determine model label and persist indexedWith
        model_label = "claude-agent-sdk" if agent_sdk == "claude" else "gpt-4o-mini"
        await update_repo_indexed_with(repo_id, model_label)

        # Cache in Redis
        cache_data = {
            "id": repo_id,
            "owner": owner,
            "name": repo,
            "fullName": full_name,
            "status": "COMPLETED",
            "pages": generated_pages,
            "repoContext": repo_context,
            "indexedWith": model_label,
        }
        await save_docs_cache(owner, repo, cache_data)

        # Send notification email
        email = await get_repo_claimer_email(repo_id)
        if email:
            await send_completion_email(email, owner, repo, success=True)

        duration_ms = (time.monotonic_ns() // 1_000_000) - start_ms
        otel.record_indexing_success(full_name, duration_ms)
        logger.info(f"[{full_name}] Successfully indexed! ({total_pages} wiki pages, {duration_ms}ms)")

    except Exception as e:
        duration_ms = (time.monotonic_ns() // 1_000_000) - start_ms
        otel.record_indexing_failure(full_name, duration_ms)
        logger.error(f"[{full_name}] FAILED: {e}\n{traceback.format_exc()}")
        try:
            await update_repo_status(repo_id, "FAILED", error_message=str(e)[:500])
            await update_status(owner, repo, "FAILED", 0, f"Indexing failed: {str(e)[:200]}")
        except Exception:
            logger.error(f"[{full_name}] Failed to update error status")

        # Try to send failure email
        try:
            email = await get_repo_claimer_email(repo_id)
            if email:
                await send_completion_email(email, owner, repo, success=False)
        except Exception:
            pass

        raise  # Let arq handle retry

    finally:
        # Cleanup
        if repo_dir:
            cleanup_repo(repo_dir)
        await release_lock(owner, repo)
