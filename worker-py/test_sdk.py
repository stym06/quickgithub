"""Quick test to see what the Claude Agent SDK actually returns."""
import asyncio
import logging
import os
from claude_agent_sdk import query, ClaudeAgentOptions
from claude_agent_sdk.types import AssistantMessage, ResultMessage, TextBlock

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


async def main():
    prompt = "List the files in the current directory using the Glob tool, then say 'DONE' followed by the count."

    # Build env without CLAUDECODE to avoid "nested session" error
    env = {k: v for k, v in os.environ.items()}
    env.pop("CLAUDECODE", None)

    options = ClaudeAgentOptions(
        allowed_tools=["Glob"],
        permission_mode="bypassPermissions",
        max_turns=5,
        cwd="/Users/stym06/code/quickgithub",
        env=env,
    )

    msg_count = 0
    async for message in query(prompt=prompt, options=options):
        msg_count += 1
        msg_type = type(message).__name__

        if isinstance(message, AssistantMessage):
            block_types = []
            for block in message.content:
                bt = type(block).__name__
                block_types.append(bt)
                if isinstance(block, TextBlock):
                    logger.info(f"  TextBlock: {block.text[:500]!r}")
            logger.info(f"#{msg_count} AssistantMessage blocks={block_types}")

        elif isinstance(message, ResultMessage):
            logger.info(f"#{msg_count} ResultMessage:")
            logger.info(f"  is_error={message.is_error}")
            logger.info(f"  num_turns={message.num_turns}")
            logger.info(f"  duration_ms={message.duration_ms}")
            res_preview = repr(message.result[:500]) if message.result else "None"
            logger.info(f"  result={res_preview}")
            logger.info(f"  structured_output={message.structured_output!r}")
            logger.info(f"  subtype={message.subtype}")
        else:
            logger.info(f"#{msg_count} {msg_type}")

    logger.info(f"Total messages: {msg_count}")


if __name__ == "__main__":
    asyncio.run(main())
