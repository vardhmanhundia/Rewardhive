"""Shared state for the composed card-agent graph.

The parent graph (:mod:`src.agents.graph`) wires the user-profiling and
recommendation subgraphs together, and both operate on this one schema — there
is no per-subgraph state or transform function. Each subgraph is compiled over
``AgentState`` and reads/writes the keys it owns; LangGraph threads the rest
through untouched.
"""

from __future__ import annotations

from typing import Any, TypedDict

from src.db.models import CardProduct


class AgentState(TypedDict, total=False):
    """State threaded through the whole card-agent graph."""

    # --- inputs ---
    query: str  # the user's latest message
    history: list[dict[str, str]]  # prior turns [{"role", "content"}]

    # --- profiling subgraph outputs ---
    new_memories: list[str]  # structured profile fields updated this turn
    # Unconfirmed single-value differences detected but *not* resolved here.
    # Surfaced as a marker so the user can reconcile them on the profile page.
    conflicts: list[dict[str, Any]]

    # --- recommendation subgraph ---
    preferences: str  # rendered profile, blended into retrieval + generation
    cards: list[CardProduct]  # retrieved candidates
    answer: str  # grounded recommendation
    suggestions: list[str]  # three follow-up questions
