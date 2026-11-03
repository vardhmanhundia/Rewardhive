"""Router node: classify the user's message and pick the agent branch.

The parent graph (:mod:`src.agents.graph`) runs this first. It decides which of
the specialist agents handles the turn — ``new_card`` (recommendation),
``evaluate`` (card advisor), ``compare`` (side-by-side comparison), or
``rewards`` (which-card-to-use) — and whether the
message also carried user-led profile info, in which case the profiling subgraph
runs *in parallel* with the chosen agent.

Routing is a narrow extraction task, so it uses the cheap structured extractor
model at low reasoning effort (the same client shape as the selection step in
:mod:`src.agents.recommendation.graph`).
"""

from __future__ import annotations

from typing import Any, Literal, cast

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.config import get_stream_writer
from pydantic import BaseModel

from src.agents.commons.llm import get_chat_model
from src.agents.router.prompts import ROUTER_SYSTEM_PROMPT
from src.agents.state import AgentState
from src.agents.user_profiling.helpers import history_messages
from src.config import settings

Intent = Literal["chat", "new_card", "evaluate", "rewards", "compare"]


class RouteDecision(BaseModel):
    """How the router classifies one user message."""

    intent: Intent = "new_card"
    # The card the user named to evaluate (evaluate only), else None.
    candidate_card_hint: str | None = None
    # Two or more card names the user wants compared (compare only), else None.
    compare_card_hints: list[str] | None = None
    # Whether the message volunteers lasting profile facts worth extracting.
    has_profile_info: bool = False


# Narrow classification -> low reasoning effort keeps it cheap and fast.
router_llm = get_chat_model(
    settings.PROFILING_EXTRACTOR_MODEL,
    max_tokens=4096,
    structured=RouteDecision,
    reasoning_effort="low",
)


async def classify(query: str, history: list[dict[str, str]] | None) -> RouteDecision:
    """Classify the latest message into an intent + flags (history for context)."""
    if not query.strip():
        return RouteDecision()
    messages: list[Any] = [SystemMessage(content=ROUTER_SYSTEM_PROMPT)]
    messages.extend(history_messages({"history": history or []}))
    messages.append(HumanMessage(content=query))
    return cast(RouteDecision, await router_llm.ainvoke(messages))


async def router_node(state: AgentState, config: RunnableConfig) -> AgentState:
    """Classify the turn and record the branch + parallel-profiling decision."""
    writer = get_stream_writer()
    decision = await classify(state.get("query", ""), state.get("history"))
    writer({"kind": "route", "intent": decision.intent})
    return {
        "intent": decision.intent,
        "candidate_card_hint": decision.candidate_card_hint,
        "compare_card_hints": decision.compare_card_hints,
        "run_profiling": decision.has_profile_info,
    }
