import json

import redis.asyncio as aioredis

from .config import settings

_pool: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _pool
    if _pool is None:
        _pool = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _pool


async def update_status(owner: str, repo: str, status: str, progress: int, message: str) -> None:
    r = await get_redis()
    await r.set(
        f"indexing:{owner}/{repo}:status",
        json.dumps({"status": status, "progress": progress, "message": message}),
        ex=3600,
    )


async def save_docs_cache(owner: str, repo: str, docs: dict) -> None:
    """Save docs to Redis with the correct key pattern (docs:{owner}/{repo}:latest)."""
    r = await get_redis()
    await r.set(f"docs:{owner}/{repo}:latest", json.dumps(docs))


async def acquire_lock(owner: str, repo: str) -> bool:
    r = await get_redis()
    result = await r.set(f"lock:indexing:{owner}/{repo}", "1", ex=2100, nx=True)  # 35min TTL
    return result is not None


async def release_lock(owner: str, repo: str) -> None:
    r = await get_redis()
    await r.delete(f"lock:indexing:{owner}/{repo}")


async def clear_all_locks() -> None:
    """Clear all indexing locks on startup."""
    r = await get_redis()
    keys = []
    async for key in r.scan_iter("lock:indexing:*"):
        keys.append(key)
    if keys:
        await r.delete(*keys)


async def close_redis() -> None:
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
