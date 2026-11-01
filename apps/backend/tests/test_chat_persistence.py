"""Tests for chat persistence (src.agents.user_profiling.graph).

The Postgres pool can't run here, so these use an in-memory checkpointer to
verify the persistence logic: turns are appended per user (thread_id = user_id),
read back in order, and isolated between users. Also checks the no-checkpointer
fallback is a silent no-op.
"""

import uuid

import pytest
from langgraph.checkpoint.memory import InMemorySaver

from src.agents.commons import checkpointer as checkpointer_module
from src.agents.commons.checkpointer import close_checkpointer, init_checkpointer
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
    user_id = str(uuid.uuid4())

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
    alice, bob = str(uuid.uuid4()), str(uuid.uuid4())

    await persist_turn(alice, "I'm Alice", "Hi Alice")

    assert len(await load_history(alice)) == 2
    assert await load_history(bob) == []


@pytest.mark.asyncio
async def test_init_checkpointer_uses_sqlite_and_survives_reconnect(tmp_path, monkeypatch):
    """A sqlite DATABASE_URL builds a real on-disk saver whose turns outlive it.

    Regression guard: the checkpointer must pick a SQLite saver for sqlite URLs
    instead of the Postgres-only saver (which silently disabled persistence in
    local dev). Reopening the same file replays the stored conversation — the
    behaviour the recommend page relies on across refresh/relogin.
    """
    db_path = tmp_path / "chat.db"
    monkeypatch.setattr(
        checkpointer_module.settings, "DATABASE_URL", f"sqlite:///{db_path}", raising=False
    )
    user_id = str(uuid.uuid4())

    checkpointer = await init_checkpointer()
    assert checkpointer is not None  # sqlite saver built, not disabled
    set_checkpointer(checkpointer)
    try:
        await persist_turn(user_id, "I travel a lot", "Try a travel card.")
        assert len(await load_history(user_id)) == 2
    finally:
        set_checkpointer(None)
        await close_checkpointer()

    # Reopen the same file: a fresh saver sees the previously stored turn.
    reopened = await init_checkpointer()
    set_checkpointer(reopened)
    try:
        assert await load_history(user_id) == [
            {"role": "user", "content": "I travel a lot"},
            {"role": "assistant", "content": "Try a travel card."},
        ]
    finally:
        set_checkpointer(None)
        await close_checkpointer()


@pytest.mark.asyncio
async def test_persistence_is_a_noop_when_disabled():
    """With no checkpointer set, persist/load are silent no-ops (no raise)."""
    set_checkpointer(None)
    assert profiling_graph._persist_graph is None

    user_id = str(uuid.uuid4())
    await persist_turn(user_id, "hi", "hello")  # must not raise
    assert await load_history(user_id) == []
