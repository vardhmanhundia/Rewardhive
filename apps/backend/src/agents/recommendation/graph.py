"""Card-recommendation flow: one conversational turn that remembers + recommends.

Per turn this does what the old profiling chat and the recommender did together:

1. Extract memory-worthy facts from the user's message and persist the new ones
   (long-term profile, in ``user_memories``).
2. Retrieve the most relevant cards from the catalog via the embedding seam
   (:class:`RetrievalService`), using the query blended with the updated profile.
3. Have Muse generate a recommendation grounded strictly in those cards and
   personalized by the profile.
4. Propose three follow-up questions.

Non-streaming entrypoint (:func:`run_recommendation`) and a streaming one
(:func:`stream_recommendation`) that yields event dicts the transport serializes
as SSE. The memory write is committed early so it survives a dropped connection.
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any, cast
from uuid import UUID

from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.commons.llm import get_chat_model
from src.agents.commons.tracing import traceable
from src.agents.recommendation.prompts import RECOMMENDATION_SYSTEM_PROMPT
from src.agents.user_profiling.graph import extract_and_store_memories, persist_turn
from src.agents.user_profiling.helpers import format_memories, history_messages
from src.agents.user_profiling.models import SuggestionList
from src.agents.user_profiling.prompts import SUGGESTIONS_SYSTEM_PROMPT
from src.agents.user_profiling.tools import suggestions_llm
from src.config import settings
from src.db.models import CardProduct
from src.models import CardProductSchema
from src.services.retrieval_service import RetrievalService

# Plain (non-structured) Muse client for token-by-token streaming of the answer.
reply_llm = get_chat_model(settings.RECOMMENDATION_MODEL, max_tokens=4096)


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


@traceable(run_type="chain", name="recommendation")
async def run_recommendation(
    session: AsyncSession,
    user_id: UUID,
    query: str,
    history: list[dict[str, str]] | None = None,
) -> tuple[str, list[CardProduct], list[str], list[str]]:
    """Non-streaming turn. Returns (answer, cards, new_memories, suggestions).

    The caller owns the transaction; commit after this so stored memories persist.
    """
    history = history or []
    new_memories = await extract_and_store_memories(session, user_id, query)
    preferences = await format_memories(session, user_id)
    cards = await RetrievalService.retrieve_cards(
        session, _retrieval_query(query, preferences)
    )
    result = await reply_llm.ainvoke(_messages(query, preferences, cards, history))
    answer = _chunk_text(result.content)
    await persist_turn(user_id, query, answer)
    suggestions = await _suggest(query, answer)
    return answer, cards, new_memories, suggestions


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
    - {"kind": "stage", "stage": "retrieved", "count": n}
    - {"kind": "cards", "cards": [CardProduct, ...]}
    - {"kind": "stage", "stage": "generating"}
    - {"kind": "token", "text": "..."}  (repeated)
    - {"kind": "memories", "items": [...]}  (facts stored this turn)
    - {"kind": "suggestions", "items": [q1, q2, q3]}
    - {"kind": "done"}
    On failure, a single {"kind": "error", "detail": "..."}.
    """
    history = history or []
    try:
        yield {"kind": "stage", "stage": "retrieving"}

        # 1. Extract + persist long-term memories, then commit so they survive a
        #    dropped connection during the reply stream.
        new_memories = await extract_and_store_memories(session, user_id, query)
        await session.commit()

        # 2. Retrieve cards using the query blended with the (updated) profile.
        preferences = await format_memories(session, user_id)
        cards = await RetrievalService.retrieve_cards(
            session, _retrieval_query(query, preferences)
        )
        yield {"kind": "stage", "stage": "retrieved", "count": len(cards)}
        yield {"kind": "cards", "cards": _serialize(cards)}

        # 3. Stream the grounded recommendation.
        yield {"kind": "stage", "stage": "generating"}
        reply_parts: list[str] = []
        async for chunk in reply_llm.astream(_messages(query, preferences, cards, history)):
            text = _chunk_text(chunk.content)
            if text:
                reply_parts.append(text)
                yield {"kind": "token", "text": text}
        reply = "".join(reply_parts)

        # 4. Persist the turn so the conversation survives reload / re-login.
        await persist_turn(user_id, query, reply)

        # 5. Terminal metadata events.
        yield {"kind": "memories", "items": new_memories}
        yield {"kind": "suggestions", "items": await _suggest(query, reply)}
        yield {"kind": "done"}
    except Exception as exc:  # noqa: BLE001 — surface any failure to the client
        yield {"kind": "error", "detail": str(exc)}
