"""Conversation context management with Redis-backed summarization and trimming.

Long conversations can exceed the LLM's context window or degrade quality.
This service keeps context tight by:

1. Caching per-conversation summaries in Redis.
2. Summarizing older turns into a compact paragraph when history grows past
   a configurable threshold.
3. Returning a trimmed history: a summary of old turns + the N most recent
   turns in full, so the LLM always gets relevant context without blowing up.

The summary is generated lazily (on the first request that crosses the
threshold) and cached in Redis with a TTL. Each new turn beyond the window
invalidates the cache so the next request re-summarizes.
"""

from __future__ import annotations

import logging

import redis.asyncio as aioredis

from src.agents.commons.llm import get_chat_model
from src.config import settings

logger = logging.getLogger(__name__)

SUMMARY_PROMPT = """\
Distill this conversation into a tight summary (under 150 words) that a credit-card \
advisor needs to continue helping this person. Capture:
- What the user wants (card type, spending goals, constraints like "no annual fee")
- Cards discussed and the verdict on each (recommended, rejected, undecided)
- Key personal facts mentioned (travel habits, dining spend, cards they hold)
- Any open questions or next steps

Write it as compact notes, not prose. Skip greetings, filler, and anything that \
wouldn't help the advisor pick up where they left off.

Conversation:
{conversation}"""

# Cheap structured call — low reasoning keeps it fast.
_summary_llm = get_chat_model(
    settings.PROFILING_EXTRACTOR_MODEL,
    max_tokens=512,
    reasoning_effort="low",
)


def _redis_client() -> aioredis.Redis | None:
    try:
        return aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    except Exception:
        logger.warning("Redis unavailable for context manager; summaries will not be cached")
        return None


def _summary_key(conversation_id: str) -> str:
    return f"ctx:summary:{conversation_id}"


def _summary_version_key(conversation_id: str) -> str:
    return f"ctx:summary_ver:{conversation_id}"


def _format_turns_for_summary(turns: list[dict[str, str]]) -> str:
    lines: list[str] = []
    for t in turns:
        role = t.get("role", "user").capitalize()
        content = t.get("content", "")
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


async def _generate_summary(turns: list[dict[str, str]]) -> str:
    """Call the LLM to produce a short summary of the given turns."""
    from langchain_core.messages import HumanMessage, SystemMessage

    conversation_text = _format_turns_for_summary(turns)
    result = await _summary_llm.ainvoke([
        SystemMessage(content="You summarize conversations concisely."),
        HumanMessage(content=SUMMARY_PROMPT.format(conversation=conversation_text)),
    ])
    text = result.content if hasattr(result, "content") else str(result)
    if isinstance(text, list):
        text = "".join(p.get("text", "") for p in text if isinstance(p, dict))
    return str(text).strip()


async def get_cached_summary(
    conversation_id: str,
) -> str | None:
    """Return the cached summary for a conversation, or None."""
    r = _redis_client()
    if r is None:
        return None
    try:
        summary = await r.get(_summary_key(conversation_id))
        return summary
    except Exception:
        return None
    finally:
        await r.aclose()


async def cache_summary(
    conversation_id: str,
    summary: str,
    turn_count: int,
    ttl: int = 3600,
) -> None:
    """Store a summary in Redis, tagged with the turn count it covers."""
    r = _redis_client()
    if r is None:
        return
    try:
        await r.setex(_summary_key(conversation_id), ttl, summary)
        await r.setex(_summary_version_key(conversation_id), ttl, str(turn_count))
    except Exception:
        logger.debug("Failed to cache summary for %s", conversation_id)
    finally:
        await r.aclose()


async def get_cached_version(conversation_id: str) -> int:
    """Return the turn count the cached summary covers, or 0."""
    r = _redis_client()
    if r is None:
        return 0
    try:
        v = await r.get(_summary_version_key(conversation_id))
        return int(v) if v else 0
    except Exception:
        return 0
    finally:
        await r.aclose()


async def invalidate_summary(conversation_id: str) -> None:
    """Remove the cached summary (e.g. after a new turn is appended)."""
    r = _redis_client()
    if r is None:
        return
    try:
        await r.delete(_summary_key(conversation_id), _summary_version_key(conversation_id))
    except Exception:
        pass
    finally:
        await r.aclose()


async def prepare_context(
    history: list[dict[str, str]],
    conversation_id: str | None = None,
    max_recent_turns: int | None = None,
    summarize_threshold: int | None = None,
) -> list[dict[str, str]]:
    """Return a trimmed history suitable for LLM consumption.

    If the conversation is short (≤ threshold), returns it unchanged.
    Otherwise, older turns are replaced with a cached or freshly generated
    summary, and only the most recent ``max_recent_turns`` pairs are kept in
    full.

    Args:
        history: Full conversation as [{role, content}, ...].
        conversation_id: Used as the Redis cache key. When None, summarization
            is still performed but not cached.
        max_recent_turns: How many recent message pairs to keep verbatim.
            Defaults to ``settings.CONTEXT_MAX_RECENT_TURNS``.
        summarize_threshold: Summarize when total messages exceed this count.
            Defaults to ``settings.CONTEXT_SUMMARIZE_THRESHOLD``.

    Returns:
        A trimmed history list: optionally a system-style summary message
        followed by the recent turns.
    """
    max_recent = max_recent_turns or getattr(settings, "CONTEXT_MAX_RECENT_TURNS", 6)
    threshold = summarize_threshold or getattr(settings, "CONTEXT_SUMMARIZE_THRESHOLD", 10)

    if len(history) <= threshold:
        return history

    # Split into old (to summarize) and recent (to keep verbatim).
    # Keep max_recent *pairs* (user+assistant), so max_recent*2 messages.
    keep_count = max_recent * 2
    old_turns = history[:-keep_count] if keep_count < len(history) else []
    recent_turns = history[-keep_count:] if keep_count < len(history) else history

    if not old_turns:
        return history

    # Try cached summary first.
    summary: str | None = None
    if conversation_id:
        cached_ver = await get_cached_version(conversation_id)
        if cached_ver >= len(old_turns):
            summary = await get_cached_summary(conversation_id)

    if not summary:
        try:
            summary = await _generate_summary(old_turns)
        except Exception:
            logger.warning("Summary generation failed; falling back to simple trimming")
            summary = None

        if summary and conversation_id:
            await cache_summary(conversation_id, summary, len(old_turns))

    trimmed: list[dict[str, str]] = []
    if summary:
        trimmed.append({
            "role": "system",
            "content": f"[Summary of earlier conversation]\n{summary}",
        })
    trimmed.extend(recent_turns)
    return trimmed
