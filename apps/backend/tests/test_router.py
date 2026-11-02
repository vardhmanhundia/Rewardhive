"""Tests for the router classifier (intent routing + profile-info detection)."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch

from src.agents.router.graph import RouteDecision, classify


@pytest.fixture
def mock_llm():
    """Patch the router LLM to return deterministic RouteDecision results."""
    with patch("src.agents.router.graph.router_llm") as llm:
        yield llm


@pytest.mark.asyncio
async def test_new_card_intent(mock_llm):
    mock_llm.ainvoke = AsyncMock(
        return_value=RouteDecision(intent="new_card", has_profile_info=False)
    )
    result = await classify("what card should I get for travel?", None)
    assert result.intent == "new_card"
    assert result.has_profile_info is False


@pytest.mark.asyncio
async def test_evaluate_intent(mock_llm):
    mock_llm.ainvoke = AsyncMock(
        return_value=RouteDecision(
            intent="evaluate",
            candidate_card_hint="Sapphire Preferred",
            has_profile_info=False,
        )
    )
    result = await classify("is the Sapphire Preferred worth it?", None)
    assert result.intent == "evaluate"
    assert result.candidate_card_hint == "Sapphire Preferred"


@pytest.mark.asyncio
async def test_rewards_intent(mock_llm):
    mock_llm.ainvoke = AsyncMock(
        return_value=RouteDecision(intent="rewards", has_profile_info=False)
    )
    result = await classify("which card should I use for groceries?", None)
    assert result.intent == "rewards"


@pytest.mark.asyncio
async def test_profile_info_detected(mock_llm):
    mock_llm.ainvoke = AsyncMock(
        return_value=RouteDecision(intent="new_card", has_profile_info=True)
    )
    result = await classify(
        "I make 120k and travel a lot, what card should I get?", None
    )
    assert result.has_profile_info is True


@pytest.mark.asyncio
async def test_empty_query_returns_default(mock_llm):
    result = await classify("", None)
    assert result.intent == "new_card"
    assert result.has_profile_info is False
    mock_llm.ainvoke.assert_not_called()


@pytest.mark.asyncio
async def test_history_passed_through(mock_llm):
    mock_llm.ainvoke = AsyncMock(
        return_value=RouteDecision(intent="new_card")
    )
    history = [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]
    await classify("recommend a card", history)
    call_args = mock_llm.ainvoke.call_args[0][0]
    assert len(call_args) >= 3  # system + history + user message
