"""Provider factory — returns a cached AgentProvider based on SDK name."""

from __future__ import annotations

from .base import AgentProvider, AgentRunOptions, AgentRunResult

__all__ = ["get_provider", "AgentProvider", "AgentRunOptions", "AgentRunResult"]

_providers: dict[str, AgentProvider] = {}


def get_provider(sdk: str = "claude") -> AgentProvider:
    """Return a cached provider instance for the given SDK."""
    if sdk not in _providers:
        if sdk == "openai":
            from .openai_provider import OpenAIProvider
            _providers[sdk] = OpenAIProvider()
        else:
            from .claude_provider import ClaudeProvider
            _providers[sdk] = ClaudeProvider()
    return _providers[sdk]
