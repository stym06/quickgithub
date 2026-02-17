"""OpenAI Agent SDK provider."""

from __future__ import annotations

import logging
import os
import time

from agents import Agent, Runner

from ..config import settings

# The OpenAI Agents SDK reads OPENAI_API_KEY from os.environ,
# but pydantic-settings only loads it into the settings object.
if settings.OPENAI_API_KEY and not os.environ.get("OPENAI_API_KEY"):
    os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
from .base import AgentRunOptions, AgentRunResult
from .openai_tools import create_file_tools

logger = logging.getLogger(__name__)

# Pricing per 1M tokens (input, output) — updated as needed
_PRICING: dict[str, tuple[float, float]] = {
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4.1": (2.00, 8.00),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1-nano": (0.10, 0.40),
    "o3-mini": (1.10, 4.40),
}


def _estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Estimate cost in USD from token counts."""
    for prefix, (inp_price, out_price) in _PRICING.items():
        if model.startswith(prefix):
            return (input_tokens * inp_price + output_tokens * out_price) / 1_000_000
    return 0.0


class OpenAIProvider:
    async def run(self, prompt: str, options: AgentRunOptions) -> AgentRunResult:
        tools = create_file_tools(options.cwd) if options.tools else []
        model = settings.OPENAI_MODEL

        agent = Agent(
            name="quickgithub-worker",
            instructions=options.system_prompt,
            model=model,
            tools=tools,
        )

        start = time.monotonic_ns()
        result = await Runner.run(agent, prompt, max_turns=options.max_turns)
        duration_ms = (time.monotonic_ns() - start) // 1_000_000

        # Aggregate token usage across all raw responses
        input_tokens = 0
        output_tokens = 0
        for response in result.raw_responses:
            usage = getattr(response, "usage", None)
            if usage:
                input_tokens += getattr(usage, "input_tokens", 0) or getattr(usage, "prompt_tokens", 0) or 0
                output_tokens += getattr(usage, "output_tokens", 0) or getattr(usage, "completion_tokens", 0) or 0

        cost_usd = _estimate_cost(model, input_tokens, output_tokens)

        logger.info(
            f"OpenAI agent finished: model={model}, duration_ms={duration_ms}, "
            f"input_tokens={input_tokens}, output_tokens={output_tokens}, "
            f"cost_usd={cost_usd:.4f}, output_len={len(result.final_output)}"
        )

        return AgentRunResult(
            text=result.final_output,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
            duration_ms=duration_ms,
            model=model,
        )
