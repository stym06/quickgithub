import json
import logging
import re
from pathlib import Path

from .providers import get_provider, AgentRunOptions
from .prompts import (
    JSON_SYSTEM_PROMPT,
    MARKDOWN_SYSTEM_PROMPT,
    STRUCTURE_ANALYSIS_PROMPT,
    PAGE_GENERATION_PROMPT_TEMPLATE,
    CONTEXT_GENERATION_PROMPT_TEMPLATE,
)
from . import otel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


async def _run_agent(prompt: str, options: AgentRunOptions, agent_sdk: str = "claude") -> str:
    """Run the configured agent provider and record OTEL metrics."""
    provider = get_provider(agent_sdk)
    result = await provider.run(prompt, options)

    otel.record_llm_metrics(
        model=result.model,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        duration_ms=result.duration_ms,
        cost_usd=result.cost_usd,
    )

    return result.text


def _extract_json(text: str) -> dict:
    """Extract a JSON object from agent output that may contain surrounding text."""
    text = text.strip()

    # 1) Try direct parse (ideal case: agent returned pure JSON)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 2) Try extracting from markdown code fence
    fence_match = re.search(r"```(?:json)?\s*\n(.*?)```", text, re.DOTALL)
    if fence_match:
        try:
            return json.loads(fence_match.group(1))
        except json.JSONDecodeError:
            pass

    # 3) Find the outermost { ... } in the text
    # Find first { and last }
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        candidate = text[first_brace : last_brace + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    raise RuntimeError(
        f"Could not extract JSON from agent output ({len(text)} chars). "
        f"Preview: {text[:300]!r}"
    )


# ── Agent Passes ─────────────────────────────────────────────────────────────

async def run_structure_analysis(repo_dir: Path, agent_sdk: str = "claude") -> list[dict]:
    """Step 1: Analyze repo and produce a wiki page plan. Returns list of page plans."""
    options = AgentRunOptions(
        system_prompt=JSON_SYSTEM_PROMPT,
        tools=["Read", "Glob", "Grep"],
        max_turns=50,
        cwd=str(repo_dir),
    )
    text = await _run_agent(STRUCTURE_ANALYSIS_PROMPT, options, agent_sdk=agent_sdk)
    result = _extract_json(text)
    pages = result.get("pages", [])
    # Sort by priority
    pages.sort(key=lambda p: p.get("priority", 999))
    return pages


async def run_page_generation(
    repo_dir: Path,
    page_plan: dict,
    all_page_plans: list[dict],
    agent_sdk: str = "claude",
) -> str:
    """Step 2: Generate content for a single wiki page. Returns raw markdown."""
    title = page_plan["title"]
    description = page_plan["description"]
    prompt_hint = page_plan["promptHint"]

    # Build sibling pages section so the agent knows what other pages cover
    sibling_lines = []
    for p in all_page_plans:
        if p["slug"] != page_plan["slug"]:
            sibling_lines.append(f"- {p['title']}: {p['description']}")
    sibling_section = ""
    if sibling_lines:
        sibling_section = f"""
Other pages being generated in parallel (avoid overlapping with their content):
{chr(10).join(sibling_lines)}

Do NOT repeat content that belongs in those other pages. Reference them instead (e.g. "see the Getting Started page").
"""

    prompt = PAGE_GENERATION_PROMPT_TEMPLATE.format(
        title=title,
        description=description,
        prompt_hint=prompt_hint,
        sibling_section=sibling_section,
    )

    options = AgentRunOptions(
        system_prompt=MARKDOWN_SYSTEM_PROMPT,
        tools=["Read", "Glob", "Grep"],
        max_turns=30,
        cwd=str(repo_dir),
    )
    text = await _run_agent(prompt, options, agent_sdk=agent_sdk)

    # Strip any accidental markdown code fences wrapping the entire output
    stripped = text.strip()
    if stripped.startswith("```markdown") and stripped.endswith("```"):
        stripped = stripped[len("```markdown"):].strip()
        if stripped.endswith("```"):
            stripped = stripped[:-3].strip()
    elif stripped.startswith("```md") and stripped.endswith("```"):
        stripped = stripped[len("```md"):].strip()
        if stripped.endswith("```"):
            stripped = stripped[:-3].strip()

    # Strip preamble before first heading
    heading_match = re.search(r"^#{1,6}\s", stripped, re.MULTILINE)
    if heading_match and heading_match.start() > 0:
        stripped = stripped[heading_match.start():]

    return stripped


async def run_context_generation(repo_dir: Path, all_pages_json: str, agent_sdk: str = "claude") -> str:
    """Generate Q&A context document for AI chat. Returns plain text."""
    prompt = CONTEXT_GENERATION_PROMPT_TEMPLATE.format(all_pages_json=all_pages_json)

    options = AgentRunOptions(
        system_prompt="",
        tools=[],
        max_turns=1,
        cwd=str(repo_dir),
    )
    return await _run_agent(prompt, options, agent_sdk=agent_sdk)
