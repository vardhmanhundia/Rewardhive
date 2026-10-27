"""Turn a catalog card into embeddable text chunks.

Each chunk is prefixed with the card name so the embedding carries context and a
retrieved chunk is self-contained ("Chase Sapphire Preferred® — No foreign
transaction fees" rather than a bare "No foreign transaction fees"). One card
expands to an overview chunk, a facts chunk, one chunk per reward tier, and one
per benefit.
"""
from __future__ import annotations

from typing import Any


def card_to_chunks(card: dict[str, Any]) -> list[str]:
    name = card["name"]
    ctype = card.get("card_type") or "card"
    chunks: list[str] = []

    summary = (card.get("summary") or "").strip()
    chunks.append(f'{name} ({card["issuer"]} {ctype} card){" — " + summary if summary else ""}')

    facts: list[str] = []
    fee = card.get("annual_fee")
    if fee is not None:
        facts.append("no annual fee" if fee == 0 else f"${fee} annual fee")
    if card.get("apr"):
        facts.append(f'APR {card["apr"]}')
    if card.get("foreign_transaction_fee") == 0:
        facts.append("no foreign transaction fees")
    if card.get("credit_score_required"):
        facts.append(f'credit needed: {card["credit_score_required"]}')
    if card.get("intro_offer"):
        facts.append(f'intro offer: {card["intro_offer"]}')
    if facts:
        chunks.append(f'{name} — {"; ".join(facts)}')

    for reward in card.get("rewards", []):
        chunks.append(f'{name} — earns {reward["rate"]} on {reward["category"]}')

    for benefit in card.get("benefits", []):
        chunks.append(f"{name} — {benefit}")

    return chunks
