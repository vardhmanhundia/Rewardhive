"""Composed card-agent graph: profiling + recommendation as subgraphs.

The parent wires two compiled subgraphs over a single shared state
(:class:`~src.agents.state.AgentState`) — no per-subgraph state or transform
functions:

    START -> profiling -> recommendation -> END

- ``profiling`` (``src.agents.user_profiling``) runs the structured remember
  step: it extracts profile fields from the user's message, merges the
  new/confirmed ones, and flags any unconfirmed conflicts as a marker.
- ``recommendation`` (``src.agents.recommendation``) retrieves catalog cards
  blended with the profile, generates a grounded recommendation, and proposes
  follow-ups.

The same compiled graph backs both entrypoints. :func:`run_recommendation`
drives it with ``ainvoke`` and returns the final state. :func:`stream_recommendation`
drives it with ``astream(stream_mode="custom", subgraphs=True)`` — custom events
written inside the subgraph nodes bubble up as ``(namespace, payload)`` pairs,
which this unwraps to the bare event dicts the transport serializes as SSE.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any, cast
from uuid import UUID

from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.commons.tracing import traceable
from src.agents.recommendation.graph import build_recommendation_subgraph
from src.agents.state import AgentState
from src.agents.user_profiling.graph import build_profiling_subgraph
from src.db.models import CardProduct


def _build_graph() -> Any:
    builder = StateGraph(AgentState)
    builder.add_node("profiling", build_profiling_subgraph())
    builder.add_node("recommendation", build_recommendation_subgraph())
    builder.add_edge(START, "profiling")
    builder.add_edge("profiling", "recommendation")
    builder.add_edge("recommendation", END)
    return builder.compile()


# Compiled once (stateless); the session + user id are injected per invocation.
compiled_graph = _build_graph()


# ----------------------------------------------------------------------------
# Entrypoints
# ----------------------------------------------------------------------------
@traceable(run_type="chain", name="recommendation")
async def run_recommendation(
    session: AsyncSession,
    user_id: UUID,
    query: str,
    history: list[dict[str, str]] | None = None,
) -> tuple[str, list[CardProduct], list[str], list[str], list[dict[str, Any]]]:
    """Non-streaming turn.

    Returns ``(answer, cards, new_memories, suggestions, conflicts)``. The
    profiling subgraph commits stored profile updates itself; the caller may
    commit again harmlessly. ``conflicts`` is a marker of unconfirmed
    single-value differences for the frontend to surface on the profile page.
    """
    state: AgentState = {"query": query, "history": history or []}
    config: RunnableConfig = {"configurable": {"session": session, "user_id": user_id}}
    final = cast(AgentState, await compiled_graph.ainvoke(state, config))
    return (
        final.get("answer", ""),
        final.get("cards", []),
        final.get("new_memories", []),
        final.get("suggestions", []),
        final.get("conflicts", []),
    )


@traceable(run_type="chain", name="recommendation_stream")
async def stream_recommendation(
    session: AsyncSession,
    user_id: UUID,
    query: str,
    history: list[dict[str, str]] | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Stream a turn as event dicts the transport renders as SSE.

    Yields, in order:
    - {"kind": "stage", "stage": "retrieving"}
    - {"kind": "conflicts", "items": [...]}  (only when conflicts were detected)
    - {"kind": "stage", "stage": "retrieved", "count": n}
    - {"kind": "cards", "cards": [CardProduct, ...]}
    - {"kind": "stage", "stage": "generating"}
    - {"kind": "token", "text": "..."}  (repeated)
    - {"kind": "memories", "items": [...]}  (profile fields updated this turn)
    - {"kind": "suggestions", "items": [q1, q2, q3]}
    - {"kind": "done"}
    On failure, a single {"kind": "error", "detail": "..."}.

    Events are produced inside the subgraph nodes via LangGraph's stream writer;
    ``subgraphs=True`` is required for those nested events to surface here.
    """
    state: AgentState = {"query": query, "history": history or []}
    config: RunnableConfig = {"configurable": {"session": session, "user_id": user_id}}
    try:
        async for _namespace, event in compiled_graph.astream(
            state, config, stream_mode="custom", subgraphs=True
        ):
            yield cast(dict[str, Any], event)
    except Exception as exc:  # noqa: BLE001 — surface any failure to the client
        yield {"kind": "error", "detail": str(exc)}
