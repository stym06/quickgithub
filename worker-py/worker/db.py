import json

import asyncpg

from .config import settings

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(settings.DATABASE_URL, min_size=2, max_size=10)
    return _pool


async def update_repo_status(
    repo_id: str,
    status: str,
    progress: int = 0,
    error_message: str | None = None,
) -> None:
    pool = await get_pool()
    await pool.execute(
        """
        UPDATE "Repo"
        SET status = $1, progress = $2, "errorMessage" = $3, "updatedAt" = now()
        WHERE id = $4
        """,
        status, progress, error_message, repo_id,
    )


async def save_documentation(repo_id: str, docs: dict) -> None:
    pool = await get_pool()
    await pool.execute(
        """
        INSERT INTO "Documentation" (id, "repoId", pages, "repoContext", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, now(), now())
        ON CONFLICT ("repoId") DO UPDATE SET
            pages = EXCLUDED.pages,
            "repoContext" = EXCLUDED."repoContext",
            overview = NULL,
            "gettingStarted" = NULL,
            "coreArchitecture" = NULL,
            "apiReference" = NULL,
            "usagePatterns" = NULL,
            "developmentGuide" = NULL,
            "updatedAt" = now()
        """,
        repo_id,
        json.dumps(docs["pages"]),
        docs["repoContext"],
    )


async def get_repo_claimer_email(repo_id: str) -> str | None:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT u.email FROM "User" u
        JOIN "Repo" r ON r."claimedById" = u.id
        WHERE r.id = $1
        """,
        repo_id,
    )
    return row["email"] if row else None


async def update_repo_indexed_with(repo_id: str, indexed_with: str) -> None:
    pool = await get_pool()
    await pool.execute(
        'UPDATE "Repo" SET "indexedWith" = $1, "updatedAt" = now() WHERE id = $2',
        indexed_with, repo_id,
    )


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
