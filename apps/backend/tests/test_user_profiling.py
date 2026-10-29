"""Tests for the user-profiling agent orchestration.

The agent's long-term memory is the structured user profile: the extractor
pulls profile fields out of a message and they are merged into what is stored.
The LLM calls and the profile store are mocked, so these run without a
MODEL_API_KEY or a database — they verify the graph wiring and the merge policy:
empty fields are filled, list fields union, and a conflicting single value is
flagged (not overwritten) unless the user confirmed it.
"""

import uuid

import pytest

from src.agents import user_profiling
from src.agents.user_profiling import ChatReply, ProfileExtraction
from src.agents.user_profiling import graph as profiling_graph
from src.agents.user_profiling.helpers import merge_extraction
from src.models import SavedBank, UserProfileDetails


class _FakeRunnable:
    """Stand-in for a structured-output runnable with an async ainvoke."""

    def __init__(self, result):
        self.result = result
        self.calls = []

    async def ainvoke(self, messages):
        self.calls.append(messages)
        return self.result


@pytest.fixture
def profile_store(monkeypatch):
    """Patch the profile load/apply helpers to use an in-test profile.

    Returns a dict with ``current`` (the stored profile the extractor sees) and
    ``changes`` (what the graph tried to persist this turn).
    """
    state: dict = {"current": UserProfileDetails(), "changes": None}

    async def fake_load(session, user_id):
        return state["current"]

    async def fake_apply(session, user_id, changes):
        state["changes"] = changes

    async def fake_format(session, user_id):
        return "(profile)"

    monkeypatch.setattr(profiling_graph, "load_profile", fake_load)
    monkeypatch.setattr(profiling_graph, "apply_profile_changes", fake_apply)
    monkeypatch.setattr(profiling_graph, "format_profile", fake_format)
    return state


def _patch_chat(monkeypatch, reply="OK", suggestions=("q1", "q2", "q3", "q4")):
    fake = _FakeRunnable(ChatReply(reply=reply, suggestions=list(suggestions)))
    monkeypatch.setattr(profiling_graph, "chat_llm", fake)
    return fake


@pytest.mark.asyncio
async def test_fills_empty_fields_and_returns_reply(monkeypatch, profile_store):
    """An empty profile is filled from the extraction; reply is returned."""
    monkeypatch.setattr(
        profiling_graph,
        "extractor_llm",
        _FakeRunnable(ProfileExtraction(occupation="Engineer", banks=[SavedBank(name="Chase")])),
    )
    _patch_chat(monkeypatch, reply="Hi!")

    result = await user_profiling.run_profiling_turn(
        session=object(), user_id=uuid.uuid4(), message="I'm an engineer, I bank with Chase"
    )

    assert result.reply == "Hi!"
    assert result.suggestions == ["q1", "q2", "q3"]  # trimmed to three
    assert profile_store["changes"]["occupation"] == "Engineer"
    assert profile_store["changes"]["banks"] == [SavedBank(name="Chase")]
    assert "occupation → Engineer" in result.new_memories


@pytest.mark.asyncio
async def test_conflicting_single_value_is_flagged_not_written(monkeypatch, profile_store):
    """A conflicting scalar is not overwritten; the chat prompt is told to ask."""
    profile_store["current"] = UserProfileDetails(occupation="Engineer")
    monkeypatch.setattr(
        profiling_graph,
        "extractor_llm",
        _FakeRunnable(ProfileExtraction(occupation="Architect")),
    )
    chat = _patch_chat(monkeypatch)

    result = await user_profiling.run_profiling_turn(
        session=object(), user_id=uuid.uuid4(), message="I work as an architect"
    )

    # Nothing persisted, no update reported.
    assert profile_store["changes"] == {}
    assert result.new_memories == []
    # The conflict reached the chat node's system prompt.
    system_prompt = chat.calls[0][0].content
    assert "Engineer" in system_prompt and "Architect" in system_prompt


@pytest.mark.asyncio
async def test_confirmed_single_value_overwrites(monkeypatch, profile_store):
    """A confirmed field overwrites the stored value even though it differs."""
    profile_store["current"] = UserProfileDetails(occupation="Engineer")
    monkeypatch.setattr(
        profiling_graph,
        "extractor_llm",
        _FakeRunnable(ProfileExtraction(occupation="Architect", confirmed_fields=["occupation"])),
    )
    _patch_chat(monkeypatch)

    result = await user_profiling.run_profiling_turn(
        session=object(), user_id=uuid.uuid4(), message="Architect"
    )

    assert profile_store["changes"]["occupation"] == "Architect"
    assert "occupation: Engineer → Architect" in result.new_memories


@pytest.mark.asyncio
async def test_missing_configurable_raises():
    with pytest.raises(ValueError):
        await user_profiling.remember_node({"message": "x"}, {"configurable": {}})


# --- Pure merge policy (no mocking) ----------------------------------------


def test_merge_fills_empty_scalar():
    changes, updates, conflicts = merge_extraction(
        UserProfileDetails(), ProfileExtraction(company="Acme")
    )
    assert changes == {"company": "Acme"}
    assert conflicts == []


def test_merge_scalar_conflict_is_reported_not_changed():
    changes, updates, conflicts = merge_extraction(
        UserProfileDetails(car="owned"), ProfileExtraction(car="financed")
    )
    assert changes == {}
    assert [c.field for c in conflicts] == ["car"]
    assert conflicts[0].stored == "owned" and conflicts[0].mentioned == "financed"


def test_merge_list_union_dedupes_and_preserves_order():
    current = UserProfileDetails(
        online_shopping_ranking=["Amazon", "Costco"],
        banks=[SavedBank(name="Chase")],
    )
    extraction = ProfileExtraction(
        online_shopping_ranking=["costco", "Target"],  # dup (case-insensitive) + new
        banks=[SavedBank(name="Amex"), SavedBank(name="chase")],  # new + dup
    )
    changes, updates, conflicts = merge_extraction(current, extraction)
    assert changes["online_shopping_ranking"] == ["Amazon", "Costco", "Target"]
    assert changes["banks"] == [SavedBank(name="Chase"), SavedBank(name="Amex")]
    assert conflicts == []
