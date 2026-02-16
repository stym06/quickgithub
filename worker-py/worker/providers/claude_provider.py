"""Claude Agent SDK provider."""

from __future__ import annotations

import logging
import os

from claude_agent_sdk import query, ClaudeAgentOptions
from claude_agent_sdk.types import AssistantMessage, ResultMessage, TextBlock

from ..config import settings
from .base import AgentRunOptions, AgentRunResult

logger = logging.getLogger(__name__)


def _agent_env() -> dict[str, str]:
    """Environment variables to pass to the Claude CLI subprocess."""
    env: dict[str, str] = {k: v for k, v in os.environ.items()}
    env.pop("CLAUDECODE", None)
    if settings.ANTHROPIC_API_KEY:
        env["ANTHROPIC_API_KEY"] = settings.ANTHROPIC_API_KEY
    return env


class ClaudeProvider:
    async def run(self, prompt: str, options: AgentRunOptions) -> AgentRunResult:
        claude_opts = ClaudeAgentOptions(
            allowed_tools=options.tools,
            permission_mode="bypassPermissions",
            system_prompt=options.system_prompt,
            max_turns=options.max_turns,
            max_buffer_size=options.max_buffer_size,
            cwd=options.cwd,
        )
        claude_opts.env = {**_agent_env(), **claude_opts.env}

        result_text = ""
        last_assistant_text = ""
        msg_count = 0
        result_meta = AgentRunResult(text="")

        try:
            async for message in query(prompt=prompt, options=claude_opts):
                msg_count += 1
                if isinstance(message, AssistantMessage):
                    parts = []
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            parts.append(block.text)
                    if parts:
                        last_assistant_text = "\n".join(parts)
                elif isinstance(message, ResultMessage):
                    usage = message.usage or {}
                    result_meta.input_tokens = usage.get("input_tokens", 0)
                    result_meta.output_tokens = usage.get("output_tokens", 0)
                    result_meta.cost_usd = message.total_cost_usd or 0.0
                    result_meta.duration_ms = message.duration_ms or 0
                    result_meta.model = usage.get("model", "claude-agent-sdk")

                    logger.info(
                        f"ResultMessage: is_error={message.is_error}, num_turns={message.num_turns}, "
                        f"duration_ms={result_meta.duration_ms}, input_tokens={result_meta.input_tokens}, "
                        f"output_tokens={result_meta.output_tokens}, cost_usd={result_meta.cost_usd:.4f}, "
                        f"result_len={len(message.result or '')}"
                    )

                    if message.is_error:
                        raise RuntimeError(f"Agent SDK error: {message.result}")
                    result_text = message.result or ""
        except Exception as e:
            logger.error(f"Agent SDK query failed after {msg_count} messages: {e}")
            raise

        logger.info(f"Agent finished: {msg_count} messages total")

        if result_text.strip():
            result_meta.text = result_text
        elif last_assistant_text.strip():
            logger.info("Using last AssistantMessage text as fallback")
            result_meta.text = last_assistant_text
        else:
            raise RuntimeError("Agent returned no text output")

        return result_meta
