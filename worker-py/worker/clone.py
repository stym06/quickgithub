import asyncio
import shutil
from pathlib import Path

from .config import settings


async def clone_repo(owner: str, repo: str) -> Path:
    """Clone a repo with --depth 1 and return the path."""
    dest = Path(settings.CLONE_BASE_DIR) / f"{owner}__{repo}"
    if dest.exists():
        shutil.rmtree(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)

    url = f"https://github.com/{owner}/{repo}.git"
    proc = await asyncio.create_subprocess_exec(
        "git", "clone", "--depth", "1", url, str(dest),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"git clone failed: {stderr.decode()}")
    return dest


def cleanup_repo(repo_dir: Path) -> None:
    """Remove cloned repo directory."""
    if repo_dir.exists():
        shutil.rmtree(repo_dir, ignore_errors=True)
