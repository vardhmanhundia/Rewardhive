"""Lightweight chat node for greetings and casual conversation.

When the router classifies a message as ``chat`` (not a card question), this node
returns a canned friendly reply instantly — no LLM call, no retrieval.
"""

from __future__ import annotations

from typing import cast

from langchain_core.runnables import RunnableConfig
from langgraph.config import get_stream_writer

from src.agents.state import AgentState
from src.agents.user_profiling.graph import persist_turn
from src.agents.user_profiling.helpers import config_values
from src.services.conversation_service import ConversationService

_GREETING = (
    "Hey there! 👋 I'm CardPilot, your credit-card assistant. "
    "I can help you find the right card, evaluate whether a card is worth it, "
    "or pick the best card in your wallet for a purchase. What can I help you with?"
)

_SUGGESTIONS = [
    "Recommend me a credit card",
    "Which card should I use for dining?",
    "Is the Amex Gold worth it?",
]


async def chat_node(state: AgentState, config: RunnableConfig) -> AgentState:
    """Return a canned greeting instantly."""
    writer = get_stream_writer()
    session, _user_id = config_values(config)
    query = state.get("query", "")

    writer({"kind": "stage", "stage": "generating"})
    writer({"kind": "token", "text": _GREETING})
    writer({"kind": "suggestions", "items": _SUGGESTIONS})

    conversation_id = config.get("configurable", {}).get("conversation_id")
    if conversation_id is not None:
        await persist_turn(str(conversation_id), query, _GREETING, intent="chat")
        await ConversationService.touch(session, conversation_id, first_question=query)

    return cast(AgentState, {
        "answer": _GREETING,
        "cards": [],
        "suggestions": list(_SUGGESTIONS),
    })
