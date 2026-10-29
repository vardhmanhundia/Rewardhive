"""Recommendation subgraph: profile-aware RAG over the card catalog.

Four steps over the shared :class:`~src.agents.state.AgentState`:

    retrieve -> recommend -> select -> suggest

- ``retrieve`` reads the (already updated) profile and pulls the most relevant
  cards from the catalog via the embedding seam (:class:`RetrievalService`),
  using the query blended with the profile. These are candidates for grounding.
- ``recommend`` has Muse generate a recommendation grounded strictly in those
  cards and personalized by the profile, streaming it token-by-token.
- ``select`` narrows the candidates to the cards the answer actually recommends,
  emits those (and only those) to the UI, and persists the turn with them.
- ``suggest`` proposes three follow-up questions.

This is wired after the profiling subgraph by the parent graph in
:mod:`src.agents.graph`; it assumes the profile has already been extracted and
stored. Nodes emit progress/token events through LangGraph's stream writer.
"""

from __future__ import annotations

from typing import Any, cast

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from src.agents.commons.llm import get_chat_model
from src.agents.recommendation.models import RecommendedSelection
from src.agents.recommendation.prompts import (
    RECOMMENDATION_SYSTEM_PROMPT,
    SELECTION_SYSTEM_PROMPT,
)
from src.agents.state import AgentState
from src.agents.user_profiling.graph import persist_turn
from src.agents.user_profiling.helpers import config_values, format_profile, history_messages
from src.agents.user_profiling.models import SuggestionList
from src.agents.user_profiling.prompts import SUGGESTIONS_SYSTEM_PROMPT
from src.agents.user_profiling.tools import suggestions_llm
from src.config import settings
from src.db.models import CardProduct
from src.models import CardProductSchema
from src.services.retrieval_service import RetrievalService

# Plain (non-structured) Muse client for token-by-token streaming of the answer.
reply_llm = get_chat_model(settings.RECOMMENDATION_MODEL, max_tokens=4096)

# Structured client that narrows the retrieved candidates down to the cards the
# finished answer actually recommends. Runs after the answer has streamed, so it
# never competes with token streaming; low reasoning effort keeps it cheap.
selection_llm = get_chat_model(
    settings.PROFILING_EXTRACTOR_MODEL,
    max_tokens=1024,
    structured=RecommendedSelection,
    reasoning_effort="low",
)


def _format_card(card: CardProduct) -> str:
    """Render one card's exact facts as a compact block for the prompt."""
    lines = [f"{card.name} ({card.issuer})"]
    if card.card_type:
        lines.append(f"  type: {card.card_type}")
    lines.append(f"  annual fee: ${card.annual_fee}")
    if card.apr:
        lines.append(f"  APR: {card.apr}")
    if card.foreign_transaction_fee is not None:
        lines.append(f"  foreign transaction fee: {card.foreign_transaction_fee}%")
    if card.credit_score_required:
        lines.append(f"  credit needed: {card.credit_score_required}")
    if card.intro_offer:
        lines.append(f"  intro offer: {card.intro_offer}")
    if card.rewards:
        rewards = "; ".join(f"{r['rate']} {r['category']}" for r in card.rewards)
        lines.append(f"  rewards: {rewards}")
    if card.benefits:
        lines.append(f"  benefits: {'; '.join(card.benefits)}")
    return "\n".join(lines)


def _format_cards(cards: list[CardProduct]) -> str:
    if not cards:
        return "(no matching cards found)"
    return "\n\n".join(_format_card(c) for c in cards)


def _retrieval_query(query: str, preferences: str) -> str:
    """Combine the request with the user's profile so retrieval reflects both."""
    if preferences and preferences != "(empty)":
        return f"{query}\n\nUser profile:\n{preferences}"
    return query


def _messages(
    query: str, preferences: str, cards: list[CardProduct], history: list[dict[str, str]]
) -> list[Any]:
    system = RECOMMENDATION_SYSTEM_PROMPT.format(
        preferences=preferences,
        cards=_format_cards(cards),
    )
    messages: list[Any] = [SystemMessage(content=system)]
    messages.extend(history_messages({"history": history}))
    messages.append(HumanMessage(content=query))
    return messages


def _serialize(cards: list[CardProduct]) -> list[dict[str, Any]]:
    return [CardProductSchema.model_validate(c).model_dump() for c in cards]


def _chunk_text(content: Any) -> str:
    """Coerce a streamed chunk's content into text (str or list-of-blocks)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(p.get("text", "") for p in content if isinstance(p, dict))
    return ""


def _candidates_for_selection(cards: list[CardProduct]) -> str:
    """List candidates as ``id — name (issuer)`` so the selector can return ids."""
    return "\n".join(f"{c.id} — {c.name} ({c.issuer})" for c in cards)


async def _select_recommended(
    cards: list[CardProduct], answer: str
) -> list[CardProduct]:
    """Narrow the candidates to the cards the answer actually recommends.

    Returns them ordered best-first. Falls back to the top candidate if the
    selector returns nothing usable but the answer did make a pick, so the UI is
    never left empty when a recommendation was given.
    """
    if not cards or not answer.strip():
        return []
    by_id = {c.id: c for c in cards}
    result = cast(
        RecommendedSelection,
        await selection_llm.ainvoke(
            [
                SystemMessage(content=SELECTION_SYSTEM_PROMPT),
                HumanMessage(
                    content=(
                        f"Candidate cards:\n{_candidates_for_selection(cards)}\n\n"
                        f"Recommendation:\n{answer}"
                    )
                ),
            ]
        ),
    )
    # Preserve the selector's order, keep only valid ids, drop duplicates.
    seen: set[str] = set()
    picked: list[CardProduct] = []
    for cid in result.card_ids:
        if cid in by_id and cid not in seen:
            seen.add(cid)
            picked.append(by_id[cid])
    return picked


async def _suggest(query: str, reply: str) -> list[str]:
    """Propose three follow-up questions from the completed turn."""
    result = cast(
        SuggestionList,
        await suggestions_llm.ainvoke(
            [
                SystemMessage(content=SUGGESTIONS_SYSTEM_PROMPT),
                HumanMessage(content=f"User asked:\n{query}\n\nAssistant recommended:\n{reply}"),
            ]
        ),
    )
    return result.suggestions[:3]


# ----------------------------------------------------------------------------
# Nodes
# ----------------------------------------------------------------------------
async def retrieve_node(state: AgentState, config: RunnableConfig) -> AgentState:
    """Read the updated profile and retrieve cards blended with it."""
    writer = get_stream_writer()
    session, user_id = config_values(config)
    preferences = await format_profile(session, user_id=user_id)
    cards = await RetrievalService.retrieve_cards(
        session, _retrieval_query(state.get("query", ""), preferences)
    )
    # Candidates are kept for grounding; the cards shown to the user are the
    # subset the answer actually recommends, emitted later by ``select_node``.
    writer({"kind": "stage", "stage": "retrieved", "count": len(cards)})
    return {"preferences": preferences, "cards": cards}


async def recommend_node(state: AgentState, config: RunnableConfig) -> AgentState:
    """Stream a recommendation grounded strictly in the retrieved cards."""
    writer = get_stream_writer()
    _session, user_id = config_values(config)
    writer({"kind": "stage", "stage": "generating"})
    messages = _messages(
        state.get("query", ""),
        state.get("preferences", ""),
        state.get("cards", []),
        state.get("history") or [],
    )
    parts: list[str] = []
    async for chunk in reply_llm.astream(messages):
        text = _chunk_text(chunk.content)
        if text:
            parts.append(text)
            writer({"kind": "token", "text": text})
    answer = "".join(parts)
    return {"answer": answer}


async def select_node(state: AgentState, config: RunnableConfig) -> AgentState:
    """Keep only the cards the answer recommends, emit them, and persist the turn."""
    writer = get_stream_writer()
    _session, user_id = config_values(config)
    recommended = await _select_recommended(
        state.get("cards", []), state.get("answer", "")
    )
    serialized = _serialize(recommended)
    writer({"kind": "cards", "cards": serialized})
    # Persist query, answer, and the recommended cards so history reloads intact.
    await persist_turn(
        user_id, state.get("query", ""), state.get("answer", ""), cards=serialized
    )
    return {"cards": recommended}


async def suggest_node(state: AgentState, config: RunnableConfig) -> AgentState:
    """Propose three follow-ups and emit the terminal metadata events."""
    writer = get_stream_writer()
    suggestions = await _suggest(state.get("query", ""), state.get("answer", ""))
    writer({"kind": "memories", "items": state.get("new_memories", [])})
    writer({"kind": "suggestions", "items": suggestions})
    writer({"kind": "done"})
    return {"suggestions": suggestions}


# ----------------------------------------------------------------------------
# Subgraph assembly
# ----------------------------------------------------------------------------
def build_recommendation_subgraph() -> Any:
    """Compile the recommendation subgraph over the shared state."""
    builder = StateGraph(AgentState)
    builder.add_node("retrieve", retrieve_node)
    builder.add_node("recommend", recommend_node)
    builder.add_node("select", select_node)
    builder.add_node("suggest", suggest_node)
    builder.add_edge(START, "retrieve")
    builder.add_edge("retrieve", "recommend")
    builder.add_edge("recommend", "select")
    builder.add_edge("select", "suggest")
    builder.add_edge("suggest", END)
    return builder.compile()
