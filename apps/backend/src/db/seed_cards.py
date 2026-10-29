"""Seed the card catalog and its embeddings.

Reads the catalog JSON (exported from the frontend), upserts each card into
`card_products`, then regenerates its `card_chunks` with SONAR embeddings.
Idempotent: re-running updates products and rebuilds chunks from scratch.

Run from apps/backend with the DB and migrations up:

    python -m src.db.seed_cards
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from sqlalchemy import delete

from src.config import settings
from src.db.database import SessionLocal
from src.db.models import CardChunk, CardProduct
from src.services.card_chunking import card_to_chunks
from src.services.embedding_service import embedding_service


def _product_fields(card: dict[str, Any]) -> dict[str, Any]:
    return dict(
        id=card["id"],
        name=card["name"],
        issuer=card["issuer"],
        network=card.get("network"),
        card_type=card.get("card_type"),
        annual_fee=card["annual_fee"],
        apr=card.get("apr"),
        foreign_transaction_fee=card.get("foreign_transaction_fee"),
        credit_score_required=card.get("credit_score_required"),
        intro_offer=card.get("intro_offer"),
        rewards=card.get("rewards", []),
        benefits=card.get("benefits", []),
        summary=card.get("summary"),
    )


async def seed() -> None:
    cards: list[dict[str, Any]] = json.loads(Path(settings.SEED_PATH).read_text())
    async with SessionLocal() as session:
        for card in cards:
            fields = _product_fields(card)
            existing = await session.get(CardProduct, card["id"])
            if existing is not None:
                for key, value in fields.items():
                    setattr(existing, key, value)
            else:
                session.add(CardProduct(**fields))

            # Flush the product before inserting its chunks. The session uses
            # autoflush=False and there is no ORM relationship between the two
            # tables, so without this the unit of work can emit the child
            # card_chunks INSERTs before the parent card_products row exists,
            # violating card_chunks_card_id_fkey.
            await session.flush()

            # Rebuild this card's chunks so re-seeding is clean.
            await session.execute(delete(CardChunk).where(CardChunk.card_id == card["id"]))
            texts = card_to_chunks(card)
            vectors = await embedding_service.embed(texts)
            for text, vector in zip(texts, vectors):
                session.add(CardChunk(card_id=card["id"], chunk_text=text, embedding=vector))
            print(f"  {card['id']}: {len(texts)} chunks")

        await session.commit()
    print(f"Seeded {len(cards)} cards from {settings.SEED_PATH}.")


if __name__ == "__main__":
    asyncio.run(seed())
