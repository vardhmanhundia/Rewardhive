"""Shared LLM access for agent graphs.

Two jobs:

1. **One place to build the chat model.** The project talks to Meta Muse through
   the OpenAI-compatible Meta Model API, so a provider swap is a change to this
   file alone. Callers use :func:`get_chat_model` and never import a provider
   SDK directly.

2. **A fake / replay mode** so callers can produce deterministic responses in
   tests or offline, without calling the API. Enable it globally with
   ``LLM_FAKE_MODE=true`` (see :mod:`src.config`), or scope canned responses to
   a block with :func:`fake_responses`. Because the fakes read the queue at call
   time, they work even for models built once at import.

The returned object exposes the subset the agents use — ``ainvoke`` (optionally
returning a structured Pydantic object) and ``astream`` — so a fake is a
drop-in for a real client.
"""

from collections.abc import AsyncIterator, Sequence
from contextlib import contextmanager
from typing import Any

from langchain_core.messages import AIMessage, AIMessageChunk
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, SecretStr

from src.config import settings

# ----------------------------------------------------------------------------
# Fake / replay state (shared, read at call time)
# ----------------------------------------------------------------------------
_queue: list[str] = []  # canned responses to replay, FIFO
_FAKE_DEFAULT = "[fake-llm] no response queued; use fake_responses([...])"


def _fake_enabled() -> bool:
    return settings.LLM_FAKE_MODE or bool(_queue)


@contextmanager
def fake_responses(responses: Sequence[str]) -> Any:
    """Replay ``responses`` for every LLM call made within this block.

    Each string is consumed in order. For a structured model the string must be
    JSON matching that model's schema; for a plain model it is the reply text
    (streamed word by word).
    """
    _queue.extend(responses)
    try:
        yield
    finally:
        _queue.clear()


class _FakeChat:
    """Drop-in stand-in for a chat model that replays queued responses."""

    def __init__(self, structured: type[BaseModel] | None) -> None:
        self._structured = structured

    async def ainvoke(self, _input: Any, *args: Any, **kwargs: Any) -> Any:
        if self._structured is not None:
            if not _queue:
                raise RuntimeError(
                    "fake LLM: no canned response queued for a structured call; "
                    "wrap it in fake_responses(['<json>'])"
                )
            return self._structured.model_validate_json(_queue.pop(0))
        raw = _queue.pop(0) if _queue else _FAKE_DEFAULT
        return AIMessage(content=raw)

    async def astream(
        self, _input: Any, *args: Any, **kwargs: Any
    ) -> AsyncIterator[AIMessageChunk]:
        raw = _queue.pop(0) if _queue else _FAKE_DEFAULT
        for i, word in enumerate(raw.split(" ")):
            yield AIMessageChunk(content=word if i == 0 else f" {word}")


# ----------------------------------------------------------------------------
# Public factory
# ----------------------------------------------------------------------------
def get_chat_model(
    model: str,
    max_tokens: int,
    *,
    structured: type[BaseModel] | None = None,
    reasoning_effort: str | None = None,
) -> Any:
    """Build the project's chat model, or a fake when replay mode is on.

    Args:
        model: Model id (e.g. ``muse-spark-1.1``).
        max_tokens: Max output tokens. Muse Spark is a reasoning model and
            *always reasons*, so this budget must cover the reasoning tokens
            plus the visible answer — set it generously or structured calls can
            exhaust it mid-reasoning and fail to parse.
        structured: If given, responses are coerced into this Pydantic model
            (via the Model API's structured output / this class's JSON parsing).
        reasoning_effort: Optional reasoning level ("low"/"medium"/"high").
            Lower it for narrow tasks to spend fewer reasoning tokens. Never
            pass "none" — Muse Spark rejects it with HTTP 400.

    Returns:
        An object with ``ainvoke`` and ``astream``; when ``structured`` is set,
        ``ainvoke`` returns an instance of that model.
    """
    if _fake_enabled():
        return _FakeChat(structured)

    # Meta Model API is OpenAI-compatible: point ChatOpenAI at its base URL.
    # An empty api_key keeps import-time construction working; real calls fail
    # until MODEL_API_KEY is set. reasoning_effort=None is a no-op (not sent).
    llm = ChatOpenAI(  # type: ignore[call-arg]
        model=model,
        base_url=settings.MUSE_BASE_URL or None,
        api_key=SecretStr(settings.MODEL_API_KEY),
        max_completion_tokens=max_tokens,
        reasoning_effort=reasoning_effort,
    )
    if structured is not None:
        return llm.with_structured_output(structured, method="json_schema")
    return llm
