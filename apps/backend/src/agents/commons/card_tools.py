"""Shared card tool used by the new-card and evaluate flows.

Two halves, matching the frontend-driven human-in-the-loop model:

- **Emit** the structured follow-up prompts the UI renders as buttons/confirms.
  When a flow surfaces cards worth acting on it offers to *evaluate* a chosen
  card (new-card flow) or to *add* a card to the wallet (both flows). The actual
  "did you finally buy?" confirm and the write happen frontend-side, which then
  calls the add-card endpoint — the graph never blocks waiting on the user.
- **Resolve** a free-text card name (what the router extracted) to a catalog id,
  so the evaluate flow can price a specific candidate.

The commit half (persisting the card) lives in
:meth:`src.services.user_service.UserService.add_card_to_profile`.
"""

from __future__ import annotations

from typing import Any, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from src.services.card_service import CardService

# A stream-writer callable (LangGraph's get_stream_writer() return value).
Writer = Callable[[dict[str, Any]], None]


def offer_evaluate(writer: Writer, card_ids: list[str]) -> dict[str, Any] | None:
    """Prompt the user to run the Card Evaluator on one of the recommended cards.

    Returns the prompt dict (for the node to also record in state), or None when
    there is nothing to offer.
    """
    ids = [cid for cid in card_ids if cid]
    if not ids:
        return None
    prompt = {"action": "offer_evaluate", "card_ids": ids}
    writer({"kind": "prompt", **prompt})
    return prompt


def offer_add(writer: Writer, card_ids: list[str]) -> dict[str, Any] | None:
    """Prompt the user to add a card to their wallet (UI confirms, then persists)."""
    ids = [cid for cid in card_ids if cid]
    if not ids:
        return None
    prompt = {"action": "offer_add", "card_ids": ids}
    writer({"kind": "prompt", **prompt})
    return prompt


async def resolve_card_id(session: AsyncSession, hint: str | None) -> str | None:
    """Best-effort map a free-text card name to a catalog card id.

    Prefers an exact (case-insensitive) name match, then a substring match in
    either direction. Returns None when nothing matches or no hint was given.
    """
    if not hint or not hint.strip():
        return None
    needle = hint.strip().lower()
    catalog = await CardService.get_all_cards(session)

    for card in catalog:
        if card.name.lower() == needle:
            return card.id
    for card in catalog:
        name = card.name.lower()
        if needle in name or name in needle:
            return card.id
    return None
