"""Tests for the shared LLM wrapper (src.agents.commons.llm).

Covers the fake/replay mode: structured and plain calls can be driven with
canned responses, with no API key and no network.
"""

import pytest
from pydantic import BaseModel

from src.agents.commons import llm


class _Reply(BaseModel):
    reply: str
    suggestions: list[str]


@pytest.mark.asyncio
async def test_fake_structured_replay():
    """A structured model replays queued JSON as a validated Pydantic object."""
    with llm.fake_responses(['{"reply": "hi", "suggestions": ["a", "b", "c"]}']):
        model = llm.get_chat_model("muse-spark", max_tokens=64, structured=_Reply)
        result = await model.ainvoke("anything")

    assert isinstance(result, _Reply)
    assert result.reply == "hi"
    assert result.suggestions == ["a", "b", "c"]


@pytest.mark.asyncio
async def test_fake_plain_streaming_replay():
    """A plain model streams the queued text word by word."""
    with llm.fake_responses(["Hello there friend"]):
        model = llm.get_chat_model("muse-spark", max_tokens=64)
        chunks = [chunk.content async for chunk in model.astream("anything")]

    assert "".join(str(c) for c in chunks) == "Hello there friend"


@pytest.mark.asyncio
async def test_structured_fake_requires_a_queued_response(monkeypatch):
    """A structured call with nothing queued fails loudly instead of calling the API."""
    monkeypatch.setattr(llm.settings, "LLM_FAKE_MODE", True)
    model = llm.get_chat_model("muse-spark", max_tokens=64, structured=_Reply)
    with pytest.raises(RuntimeError):
        await model.ainvoke("anything")


def test_live_mode_builds_openai_compatible_client(monkeypatch):
    """Without fake mode, the factory returns a ChatOpenAI pointed at Muse."""
    from langchain_openai import ChatOpenAI

    monkeypatch.setattr(llm.settings, "LLM_FAKE_MODE", False)
    llm._queue.clear()
    model = llm.get_chat_model("muse-spark", max_tokens=64)
    assert isinstance(model, ChatOpenAI)
