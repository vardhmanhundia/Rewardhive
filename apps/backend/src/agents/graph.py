"""Composed card-agent graph: a router that fans out to specialist subgraphs.

The parent wires several compiled subgraphs over a single shared state
(:class:`~src.agents.state.AgentState`) — no per-subgraph state or transform
functions:

    START -> router -> {new_card | evaluate | rewards} (+ profiling) -> END

- ``router`` (``src.agents.router``) classifies the message and picks exactly one
  specialist branch, and decides whether the message also carried user-led
  profile info.
- ``new_card`` (``src.agents.recommendation``) retrieves catalog cards blended
  with the profile and generates a grounded recommendation.
- ``evaluate`` (``src.agents.evaluate``) runs the Card Evaluator on a chat-sourced
  wallet context ("is this card worth it?").
- ``rewards`` (``src.agents.rewards``) ranks the user's cards for a purchase
  ("which card should I use?").
- ``profiling`` (``src.agents.user_profiling``) runs the structured remember
  step. It is fanned out *in parallel* with the chosen branch, and only when the
  router flagged user-led profile info. The branches write disjoint state keys,
  so they join at END without a reducer.

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
from src.agents.evaluate.graph import build_evaluate_subgraph
from src.agents.recommendation.graph import build_recommendation_subgraph
from src.agents.rewards.node import build_rewards_subgraph
from src.agents.router.graph import router_node
from src.agents.state import AgentState
from src.agents.user_profiling.graph import build_profiling_subgraph
from src.db.models import CardProduct

# The specialist branches the router can pick; intent strings match node names.
_AGENT_NODES = ("new_card", "evaluate", "rewards")


def _fanout(state: AgentState) -> list[str]:
    """Pick the agent branch, adding ``profiling`` to run in parallel when flagged.

    Returning a list makes LangGraph run every named node in the same superstep,
    so the chosen agent and profiling execute concurrently.
    """
    intent = state.get("intent") or "new_card"
    if intent not in _AGENT_NODES:
        intent = "new_card"
    targets = [intent]
    if state.get("run_profiling"):
        targets.append("profiling")
    return targets


def _build_graph() -> Any:
    builder = StateGraph(AgentState)
    builder.add_node("router", router_node)
    builder.add_node("new_card", build_recommendation_subgraph())
    builder.add_node("evaluate", build_evaluate_subgraph())
    builder.add_node("rewards", build_rewards_subgraph())
    builder.add_node("profiling", build_profiling_subgraph())
    builder.add_edge(START, "router")
    builder.add_conditional_edges("router", _fanout, [*_AGENT_NODES, "profiling"])
    for node in (*_AGENT_NODES, "profiling"):
        builder.add_edge(node, END)
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
    conversation_id: UUID | None = None,
) -> tuple[
    str,
    list[CardProduct],
    list[str],
    list[str],
    list[dict[str, Any]],
    str,
    list[dict[str, Any]],
]:
    """Non-streaming turn.

    Returns ``(answer, cards, new_memories, suggestions, conflicts, intent,
    prompts)``. The router picks ``intent`` (which specialist ran); ``prompts``
    are the frontend-driven follow-ups (offer-evaluate / offer-add). The profiling
    subgraph commits stored profile updates itself; the caller may commit again
    harmlessly. ``conflicts`` is a marker of unconfirmed single-value differences
    for the frontend to surface on the profile page. ``conversation_id`` keys
    where the turn is persisted (when given).
    """
    state: AgentState = {"query": query, "history": history or []}
    config: RunnableConfig = {
        "configurable": {
            "session": session,
            "user_id": user_id,
            "conversation_id": conversation_id,
        }
    }
    final = cast(AgentState, await compiled_graph.ainvoke(state, config))
    return (
        final.get("answer", ""),
        final.get("cards", []),
        final.get("new_memories", []),
        final.get("suggestions", []),
        final.get("conflicts", []),
        final.get("intent", "new_card"),
        final.get("prompts", []),
    )


@traceable(run_type="chain", name="recommendation_stream")
async def stream_recommendation(
    session: AsyncSession,
    user_id: UUID,
    query: str,
    history: list[dict[str, str]] | None = None,
    conversation_id: UUID | None = None,
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
    config: RunnableConfig = {
        "configurable": {
            "session": session,
            "user_id": user_id,
            "conversation_id": conversation_id,
        }
    }
    try:
        async for _namespace, event in compiled_graph.astream(
            state, config, stream_mode="custom", subgraphs=True
        ):
            yield cast(dict[str, Any], event)
    except Exception as exc:  # noqa: BLE001 — surface any failure to the client
        yield {"kind": "error", "detail": str(exc)}
