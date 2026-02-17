"""Base types and protocol for agent providers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class AgentRunOptions:
    system_prompt: str
    tools: list[str] = field(default_factory=list)  # e.g. ["Read", "Glob", "Grep"]
    max_turns: int = 30
    cwd: str = "."
    max_buffer_size: int = 10 * 1024 * 1024


@dataclass
class AgentRunResult:
    text: str
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    duration_ms: int = 0
    model: str = ""


class AgentProvider(Protocol):
    async def run(self, prompt: str, options: AgentRunOptions) -> AgentRunResult: ...
