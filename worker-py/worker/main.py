import asyncio
import logging
import multiprocessing
from contextlib import asynccontextmanager
from urllib.parse import urlparse

from arq import create_pool, func
from arq.connections import RedisSettings
from arq.worker import Worker
import uvicorn

from .api import app
from .config import settings
from .cache import clear_all_locks, close_redis
from .db import close_pool
from .task_handler import handle_index_repo
from . import otel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def parse_redis_url(url: str) -> RedisSettings:
    """Parse redis URL into arq RedisSettings."""
    parsed = urlparse(url)
    kwargs: dict = {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 6379,
        "database": int(parsed.path.lstrip("/") or "0"),
    }
    if parsed.password:
        kwargs["password"] = parsed.password
    return RedisSettings(**kwargs)


async def on_startup(ctx: dict) -> None:
    logger.info("arq worker starting up")
    otel.init()
    await clear_all_locks()


async def on_shutdown(ctx: dict) -> None:
    logger.info("arq worker shutting down")
    otel.shutdown()


@asynccontextmanager
async def lifespan(app_instance):
    """FastAPI lifespan: create arq pool for enqueueing."""
    redis_settings = parse_redis_url(settings.REDIS_URL)
    app_instance.state.arq_pool = await create_pool(redis_settings)
    logger.info(f"FastAPI ready on port {settings.WORKER_API_PORT}")
    yield
    await close_pool()
    await close_redis()


app.router.lifespan_context = lifespan


def _run_arq_worker():
    """Run arq worker in its own process with its own event loop."""
    worker = Worker(
        functions=[func(handle_index_repo, name="repo:index")],
        redis_settings=parse_redis_url(settings.REDIS_URL),
        max_jobs=settings.WORKER_CONCURRENCY,
        job_timeout=1800,
        max_tries=3,
        on_startup=on_startup,
        on_shutdown=on_shutdown,
    )
    worker.run()


def main():
    """Run FastAPI server and arq worker as separate processes."""
    worker_proc = multiprocessing.Process(target=_run_arq_worker, daemon=True)
    worker_proc.start()
    logger.info("arq worker process started (pid=%d)", worker_proc.pid)

    try:
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=settings.WORKER_API_PORT,
            log_level="info",
        )
    finally:
        worker_proc.terminate()
        worker_proc.join(timeout=5)


if __name__ == "__main__":
    main()
