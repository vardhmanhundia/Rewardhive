"""Card-recommendation flow: profile + query -> RAG retrieval -> Muse generation.

Reads the user's long-term profile memories, blends them with the incoming
query, retrieves the most relevant cards from the catalog via the embedding
seam (:class:`RetrievalService`), and has Muse generate a recommendation
grounded strictly in those cards.

Mirrors the user-profiling module's shape: a non-streaming entrypoint
(:func:`run_recommendation`) and a streaming one (:func:`stream_recommendation`)
that yields event dicts the transport serializes as SSE. Read-only: it never
writes to the database.
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.commons.llm import get_chat_model
from src.agents.commons.tracing import traceable
from src.agents.recommendation.prompts import RECOMMENDATION_SYSTEM_PROMPT
from src.agents.user_profiling.helpers import format_memories
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


def _messages(query: str, preferences: str, cards: list[CardProduct]) -> list[Any]:
    system = RECOMMENDATION_SYSTEM_PROMPT.format(
        preferences=preferences,
        cards=_format_cards(cards),
    )
    return [SystemMessage(content=system), HumanMessage(content=query)]


def _serialize(cards: list[CardProduct]) -> list[dict[str, Any]]:
    return [CardProductSchema.model_validate(c).model_dump() for c in cards]


async def _retrieve(
    session: AsyncSession, user_id: UUID, query: str
) -> tuple[str, list[CardProduct]]:
    """Load profile, retrieve cards. Returns (preferences, cards)."""
    preferences = await format_memories(session, user_id)
    cards = await RetrievalService.retrieve_cards(
        session, _retrieval_query(query, preferences)
    )
    return preferences, cards


def _chunk_text(content: Any) -> str:
    """Coerce a streamed chunk's content into text (str or list-of-blocks)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(p.get("text", "") for p in content if isinstance(p, dict))
    return ""


@traceable(run_type="chain", name="recommendation")
async def run_recommendation(
    session: AsyncSession, user_id: UUID, query: str
) -> tuple[str, list[CardProduct]]:
    """Non-streaming recommendation: returns (answer, cards)."""
    preferences, cards = await _retrieve(session, user_id, query)
    result = await reply_llm.ainvoke(_messages(query, preferences, cards))
    return _chunk_text(result.content), cards


@traceable(run_type="chain", name="recommendation_stream")
async def stream_recommendation(
    session: AsyncSession, user_id: UUID, query: str
) -> AsyncIterator[dict[str, Any]]:
    """Stream a recommendation as event dicts the transport renders as SSE.

    Yields, in order:
    - {"kind": "stage", "stage": "retrieving"}
    - {"kind": "stage", "stage": "retrieved", "count": n}
    - {"kind": "cards", "cards": [CardProduct, ...]}
    - {"kind": "stage", "stage": "generating"}
    - {"kind": "token", "text": "..."}  (repeated)
    - {"kind": "done"}
    On failure, a single {"kind": "error", "detail": "..."}.
    """
    try:
        yield {"kind": "stage", "stage": "retrieving"}
        preferences, cards = await _retrieve(session, user_id, query)

        yield {"kind": "stage", "stage": "retrieved", "count": len(cards)}
        yield {"kind": "cards", "cards": _serialize(cards)}

        yield {"kind": "stage", "stage": "generating"}
        async for chunk in reply_llm.astream(_messages(query, preferences, cards)):
            text = _chunk_text(chunk.content)
            if text:
                yield {"kind": "token", "text": text}

        yield {"kind": "done"}
    except Exception as exc:  # noqa: BLE001 — surface any failure to the client
        yield {"kind": "error", "detail": str(exc)}
