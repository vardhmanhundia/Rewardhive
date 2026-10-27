"""Tests for the user-profiling agent orchestration.

The LLM calls and the memory store are mocked, so these run without a
MODEL_API_KEY or a database — they verify the graph wiring: only
genuinely-new memories are persisted, and the reply/suggestions are returned.
"""

import uuid

import pytest

from src.agents import user_profiling
from src.agents.user_profiling import ChatReply, MemoryDecision, MemoryItem
from src.agents.user_profiling import graph as profiling_graph
from src.services.memory_service import MemoryService


class _FakeRunnable:
    """Stand-in for a structured-output runnable with an async ainvoke."""

    def __init__(self, result):
        self.result = result
        self.calls = []

    async def ainvoke(self, messages):
        self.calls.append(messages)
        return self.result


@pytest.fixture
def stored(monkeypatch):
    """Patch MemoryService so memories live in an in-test list."""
    memories: list[str] = []

    async def fake_list(session, user_id):
        return [type("M", (), {"content": c}) for c in memories]

    async def fake_add(session, user_id, content):
        memories.append(content.strip())
        return type("M", (), {"content": content.strip()})

    monkeypatch.setattr(MemoryService, "list_memories", fake_list)
    monkeypatch.setattr(MemoryService, "add_memory", fake_add)
    return memories


@pytest.mark.asyncio
async def test_stores_only_new_memories_and_returns_reply(monkeypatch, stored):
    monkeypatch.setattr(
        profiling_graph,
        "extractor_llm",
        _FakeRunnable(
            MemoryDecision(
                should_write=True,
                memories=[
                    MemoryItem(text="User's name is Nitish.", is_new=True),
                    MemoryItem(text="Already known fact.", is_new=False),
                    MemoryItem(text="   ", is_new=True),  # blank, skipped
                ],
            )
        ),
    )
    monkeypatch.setattr(
        profiling_graph,
        "chat_llm",
        _FakeRunnable(ChatReply(reply="Sure, Nitish!", suggestions=["q1", "q2", "q3", "q4"])),
    )

    result = await user_profiling.run_profiling_turn(
        session=object(),
        user_id=uuid.uuid4(),
        message="Hi, my name is Nitish",
    )

    assert result.reply == "Sure, Nitish!"
    assert result.suggestions == ["q1", "q2", "q3"]  # trimmed to three
    assert result.new_memories == ["User's name is Nitish."]
    assert stored == ["User's name is Nitish."]


@pytest.mark.asyncio
async def test_writes_nothing_when_should_write_false(monkeypatch, stored):
    monkeypatch.setattr(
        profiling_graph,
        "extractor_llm",
        _FakeRunnable(MemoryDecision(should_write=False, memories=[])),
    )
    monkeypatch.setattr(
        profiling_graph,
        "chat_llm",
        _FakeRunnable(ChatReply(reply="Hello!", suggestions=["a", "b", "c"])),
    )

    result = await user_profiling.run_profiling_turn(
        session=object(),
        user_id=uuid.uuid4(),
        message="Explain GenAI simply",
    )

    assert result.new_memories == []
    assert stored == []
    assert result.reply == "Hello!"


@pytest.mark.asyncio
async def test_missing_configurable_raises():
    with pytest.raises(ValueError):
        await user_profiling.remember_node({"message": "x"}, {"configurable": {}})
