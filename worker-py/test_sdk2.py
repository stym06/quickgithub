"""Test: what happens when the agent runs out of turns?"""
import asyncio
import logging
import os
from claude_agent_sdk import query, ClaudeAgentOptions
from claude_agent_sdk.types import AssistantMessage, ResultMessage, TextBlock

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


async def main():
    # Give it a task that requires many tool calls but only 2 turns
    prompt = """Read every single file in this repository one by one. After reading all files,
output a JSON object: {"fileCount": <number>}"""

    env = {k: v for k, v in os.environ.items()}
    env.pop("CLAUDECODE", None)

    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Glob"],
        permission_mode="bypassPermissions",
        max_turns=2,  # Very low — will run out of turns
        cwd="/Users/stym06/code/quickgithub",
        env=env,
    )

    msg_count = 0
    assistant_text_count = 0
    async for message in query(prompt=prompt, options=options):
        msg_count += 1
        msg_type = type(message).__name__

        if isinstance(message, AssistantMessage):
            has_text = False
            for block in message.content:
                if isinstance(block, TextBlock):
                    has_text = True
                    logger.info(f"  TextBlock: {block.text[:300]!r}")
            block_types = [type(b).__name__ for b in message.content]
            if has_text:
                assistant_text_count += 1
            logger.info(f"#{msg_count} AssistantMessage blocks={block_types}")

        elif isinstance(message, ResultMessage):
            res_preview = repr(message.result[:500]) if message.result else "None"
            logger.info(f"#{msg_count} ResultMessage:")
            logger.info(f"  is_error={message.is_error}")
            logger.info(f"  num_turns={message.num_turns}")
            logger.info(f"  duration_ms={message.duration_ms}")
            logger.info(f"  result={res_preview}")
            logger.info(f"  structured_output={message.structured_output!r}")
            logger.info(f"  subtype={message.subtype}")
        else:
            logger.info(f"#{msg_count} {msg_type}")

    logger.info(f"Total: {msg_count} msgs, {assistant_text_count} with text")


if __name__ == "__main__":
    asyncio.run(main())
