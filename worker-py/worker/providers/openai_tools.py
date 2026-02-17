"""Sandboxed file tools for the OpenAI Agent SDK provider."""

from __future__ import annotations

import fnmatch
import os
import re
from pathlib import Path

from agents import function_tool, RunContextWrapper


def create_file_tools(cwd: str) -> list:
    """Create file tools scoped to the given working directory."""
    base = Path(cwd).resolve()

    def _safe_path(p: str) -> Path:
        """Resolve a path and ensure it's within the sandbox."""
        resolved = (base / p).resolve()
        if not str(resolved).startswith(str(base)):
            raise ValueError(f"Path traversal blocked: {p}")
        return resolved

    @function_tool
    async def read_file(ctx: RunContextWrapper, path: str) -> str:
        """Read the contents of a file. Path is relative to the repository root."""
        target = _safe_path(path)
        if not target.is_file():
            return f"Error: file not found: {path}"
        try:
            content = target.read_text(errors="replace")
        except Exception as e:
            return f"Error reading {path}: {e}"
        if len(content) > 500_000:
            content = content[:500_000] + "\n... (truncated at 500K chars)"
        return content

    @function_tool
    async def glob_files(ctx: RunContextWrapper, pattern: str) -> str:
        """Find files matching a glob pattern (e.g. '**/*.py'). Returns newline-separated paths relative to repo root."""
        matches: list[str] = []
        for path in sorted(base.rglob("*")):
            if path.is_file():
                rel = str(path.relative_to(base))
                if fnmatch.fnmatch(rel, pattern):
                    matches.append(rel)
                    if len(matches) >= 500:
                        break
        if not matches:
            return f"No files matched pattern: {pattern}"
        result = "\n".join(matches)
        if len(matches) == 500:
            result += "\n... (capped at 500 results)"
        return result

    @function_tool
    async def grep_files(
        ctx: RunContextWrapper,
        pattern: str,
        glob_filter: str = "**/*",
    ) -> str:
        """Search file contents for a regex pattern. Returns matching lines with file:line format.

        Args:
            pattern: Regex pattern to search for.
            glob_filter: Glob pattern to filter which files to search (default: all files).
        """
        try:
            regex = re.compile(pattern)
        except re.error as e:
            return f"Invalid regex: {e}"

        matches: list[str] = []
        files_searched = 0

        for path in sorted(base.rglob("*")):
            if not path.is_file():
                continue
            rel = str(path.relative_to(base))
            if not fnmatch.fnmatch(rel, glob_filter):
                continue
            files_searched += 1
            if files_searched > 1000:
                break
            try:
                lines = path.read_text(errors="replace").splitlines()
            except Exception:
                continue
            for i, line in enumerate(lines, 1):
                if regex.search(line):
                    matches.append(f"{rel}:{i}: {line.rstrip()}")
                    if len(matches) >= 200:
                        break
            if len(matches) >= 200:
                break

        if not matches:
            return f"No matches for pattern: {pattern}"
        result = "\n".join(matches)
        if len(matches) == 200:
            result += "\n... (capped at 200 matches)"
        return result

    return [read_file, glob_files, grep_files]
