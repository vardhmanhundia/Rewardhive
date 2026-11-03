"""Evaluate subgraph: the Card Evaluator reached from chat.

The standalone wallet-advisor (:mod:`src.agents.advisor`) answers "should I get
this card?" from a spend form + owned cards collected on the optimizer page. This
subgraph reaches the *same* advisor from a chat message, sourcing what the form
would have provided from the user's stored profile:

- the **candidate** card is resolved from the name the router extracted;
- the **owned** cards come from the saved profile;
- the monthly **spend baseline** is estimated from the profile + prior chat
  (:func:`derive_spend_baseline_for_user`) and surfaced as editable values.

It forwards the advisor's events to the parent graph's stream writer, and when the
verdict is "worth it" it offers to add the card to the wallet (the shared add-card
tool). The advisor engine/logic is reused as-is, so the ``/advisor`` endpoint is
untouched.
"""

from __future__ import annotations

from typing import Any

from langchain_core.runnables import RunnableConfig
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from src.agents.advisor import stream_advisor
from src.agents.commons.card_tools import offer_add, resolve_card_id
from src.agents.commons.spend import derive_spend_baseline_for_user
from src.agents.state import AgentState
from src.agents.user_profiling.graph import persist_turn
from src.agents.user_profiling.helpers import config_values
from src.services.conversation_service import ConversationService
from src.services.user_service import UserService


async def _owned_from_profile(session: Any, user_id: Any) -> list[dict[str, Any]]:
    """Catalog cards the user holds, as advisor ``owned`` inputs.

    Custom (non-catalog) cards have no id to price, so they're skipped — the same
    rule the advisor endpoint uses.
    """
    profile = await UserService.get_profile_details(session, user_id)
    return [
        {"card_id": str(c["card_id"]), "category": c.get("category")}
        for c in profile.cards
        if c.get("card_id")
    ]


async def evaluate_node(state: AgentState, config: RunnableConfig) -> AgentState:
    """Run the advisor on a chat-sourced wallet context and offer to add the card."""
    writer = get_stream_writer()
    session, user_id = config_values(config)
    query = state.get("query", "")
    history = state.get("history") or []

    candidate_id = await resolve_card_id(session, state.get("candidate_card_hint"))
    spend = await derive_spend_baseline_for_user(session, user_id, history)
    owned = await _owned_from_profile(session, user_id)

    parts: list[str] = []
    worth_card_id: str | None = None
    async for event in stream_advisor(session, user_id, query, spend, owned, candidate_id):
        kind = event.get("kind")
        if kind == "done":
            continue  # this node owns the terminal events
        writer(event)
        if kind == "token":
            parts.append(event.get("text", ""))
        elif kind == "result":
            result = event.get("result") or {}
            if result.get("worth_it"):
                worth_card_id = result.get("candidate_id") or candidate_id

    prompts: list[dict[str, Any]] = []
    if worth_card_id:
        prompt = offer_add(writer, [worth_card_id])
        if prompt:
            prompts.append(prompt)
    answer = "".join(parts)
    conversation_id = config.get("configurable", {}).get("conversation_id")
    if conversation_id is not None:
        await persist_turn(
            str(conversation_id), query, answer,
            intent="evaluate", spend_baseline=spend,
        )
        await ConversationService.touch(session, conversation_id, first_question=query)

    writer({"kind": "done"})

    return {"answer": answer, "spend_baseline": spend, "prompts": prompts}


def build_evaluate_subgraph() -> Any:
    """Compile the evaluate subgraph (single node) over the shared state."""
    builder = StateGraph(AgentState)
    builder.add_node("evaluate", evaluate_node)
    builder.add_edge(START, "evaluate")
    builder.add_edge("evaluate", END)
    return builder.compile()
