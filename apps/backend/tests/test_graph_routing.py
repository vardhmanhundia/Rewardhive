"""Tests for the parent graph routing: router → correct subgraph, parallel profiling."""

from __future__ import annotations

from src.agents.graph import _fanout


def test_fanout_new_card():
    state = {"intent": "new_card", "run_profiling": False}
    assert _fanout(state) == ["new_card"]


def test_fanout_evaluate():
    state = {"intent": "evaluate", "run_profiling": False}
    assert _fanout(state) == ["evaluate"]


def test_fanout_rewards():
    state = {"intent": "rewards", "run_profiling": False}
    assert _fanout(state) == ["rewards"]


def test_fanout_with_profiling():
    state = {"intent": "new_card", "run_profiling": True}
    targets = _fanout(state)
    assert "new_card" in targets
    assert "profiling" in targets
    assert len(targets) == 2


def test_fanout_unknown_intent_defaults_to_new_card():
    state = {"intent": "unknown_thing", "run_profiling": False}
    assert _fanout(state) == ["new_card"]


def test_fanout_missing_intent_defaults():
    state = {}
    assert _fanout(state) == ["new_card"]
