"""Tests for chat persistence (src.agents.user_profiling.graph).

The Postgres pool can't run here, so these use an in-memory checkpointer to
verify the persistence logic: turns are appended per user (thread_id = user_id),
read back in order, and isolated between users. Also checks the no-checkpointer
fallback is a silent no-op.
"""

import uuid

import pytest
from langgraph.checkpoint.memory import InMemorySaver

from src.agents.user_profiling import graph as profiling_graph
from src.agents.user_profiling.graph import load_history, persist_turn, set_checkpointer


@pytest.fixture
def in_memory_persistence():
    """Enable persistence with an in-memory checkpointer, then reset."""
    set_checkpointer(InMemorySaver())
    yield
    set_checkpointer(None)


@pytest.mark.asyncio
async def test_turns_persist_and_read_back_in_order(in_memory_persistence):
    user_id = uuid.uuid4()

    assert await load_history(user_id) == []

    await persist_turn(user_id, "Hi, I'm Nitish", "Hello Nitish!")
    await persist_turn(user_id, "What's my name?", "Your name is Nitish.")

    history = await load_history(user_id)
    assert history == [
        {"role": "user", "content": "Hi, I'm Nitish"},
        {"role": "assistant", "content": "Hello Nitish!"},
        {"role": "user", "content": "What's my name?"},
        {"role": "assistant", "content": "Your name is Nitish."},
    ]


@pytest.mark.asyncio
async def test_history_is_isolated_per_user(in_memory_persistence):
    alice, bob = uuid.uuid4(), uuid.uuid4()

    await persist_turn(alice, "I'm Alice", "Hi Alice")

    assert len(await load_history(alice)) == 2
    assert await load_history(bob) == []


@pytest.mark.asyncio
async def test_persistence_is_a_noop_when_disabled():
    """With no checkpointer set, persist/load are silent no-ops (no raise)."""
    set_checkpointer(None)
    assert profiling_graph._persist_graph is None

    user_id = uuid.uuid4()
    await persist_turn(user_id, "hi", "hello")  # must not raise
    assert await load_history(user_id) == []
