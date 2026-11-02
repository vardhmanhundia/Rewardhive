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

    # --- router outputs ---
    # Which agent branch the router picked: "new_card" | "evaluate" | "rewards".
    intent: str
    # A card name/phrase to evaluate, when the message named one (evaluate only).
    candidate_card_hint: str | None
    # Whether the message carried user-led profile info worth extracting; when
    # true the profiling subgraph runs *in parallel* with the chosen agent.
    run_profiling: bool

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

    # --- evaluate subgraph ---
    # The monthly spend baseline the evaluator reasoned over, derived from the
    # profile + prior chat. Returned so the UI can show it as editable values.
    spend_baseline: dict[str, float]

    # --- frontend-driven follow-up prompts ---
    # Structured prompts the UI turns into buttons/confirms for the next turn,
    # e.g. {"action": "offer_evaluate" | "offer_add", "card_ids": [...]}. A
    # branch-owned key (disjoint from what profiling writes) so the parallel
    # branches never collide on a merge.
    prompts: list[dict[str, Any]]
