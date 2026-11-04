"""Rewards subgraph: the "which card should I use?" agent reached from chat.

Wraps the standalone rewards agent (:func:`src.agents.rewards.stream_rewards`)
as a node on the shared :class:`AgentState`, sourcing the candidate cards from
the user's saved profile (the same fallback the ``/rewards`` endpoint uses). It
forwards the agent's events to the parent graph's stream writer and accumulates
the answer text so the non-streaming entrypoint has it too. The rewards engine
and logic are reused unchanged.
"""

from __future__ import annotations

from typing import Any

from langchain_core.runnables import RunnableConfig
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from src.agents.rewards.graph import stream_rewards
from src.agents.state import AgentState
from src.agents.user_profiling.graph import persist_turn
from src.agents.user_profiling.helpers import config_values
from src.services.conversation_service import ConversationService
from src.services.user_service import UserService


async def _card_ids_from_profile(session: Any, user_id: Any) -> list[str]:
    """Catalog card ids the user holds (custom cards have no id to price)."""
    profile = await UserService.get_profile_details(session, user_id)
    return [str(c["card_id"]) for c in profile.cards if c.get("card_id")]


async def rewards_node(state: AgentState, config: RunnableConfig) -> AgentState:
    """Rank the user's cards for the purchase in the message and explain."""
    writer = get_stream_writer()
    session, user_id = config_values(config)
    card_ids = await _card_ids_from_profile(session, user_id)

    parts: list[str] = []
    picks: list[dict] = []
    async for event in stream_rewards(
        session, user_id, state.get("query", ""), card_ids, None,
        image_b64=state.get("image_b64"), image_mime=state.get("image_mime"),
    ):
        writer(event)
        kind = event.get("kind")
        if kind == "token":
            parts.append(event.get("text", ""))
        elif kind == "result":
            picks = event.get("picks", [])

    answer = "".join(parts)
    query = state.get("query", "")
    conversation_id = config.get("configurable", {}).get("conversation_id")
    if conversation_id is not None:
        await persist_turn(
            str(conversation_id), query, answer,
            picks=picks, intent="rewards",
        )
        await ConversationService.touch(session, conversation_id, first_question=query)

    return {"answer": answer}


def build_rewards_subgraph() -> Any:
    """Compile the rewards subgraph (single node) over the shared state."""
    builder = StateGraph(AgentState)
    builder.add_node("rewards", rewards_node)
    builder.add_edge(START, "rewards")
    builder.add_edge("rewards", END)
    return builder.compile()
