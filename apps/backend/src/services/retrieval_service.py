"""Vector retrieval over the card catalog (the query side of the RAG seam).

Embeds a query with the SAME :class:`EmbeddingService` used to seed
``card_chunks`` (so vectors are comparable), runs an approximate-nearest-neighbor
cosine search against the pgvector HNSW index, then de-dupes the matching chunks
to the top distinct cards and returns their full :class:`CardProduct` rows.

This is what the recommendation agent calls before handing cards to Muse.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.db.models import CardChunk, CardProduct
from src.services.embedding_service import embedding_service


class RetrievalService:
    """Semantic search over card_chunks → distinct CardProduct rows."""

    @staticmethod
    async def retrieve_cards(
        session: AsyncSession,
        query_text: str,
        *,
        k: int | None = None,
        fetch_k: int | None = None,
    ) -> list[CardProduct]:
        """Return the top-``k`` distinct cards most relevant to ``query_text``.

        Scans the ``fetch_k`` nearest chunks by cosine distance, keeps the first
        time each card appears (its best-matching chunk), and loads those cards
        preserving relevance order. Returns [] for an empty query or empty index.
        """
        query_text = query_text.strip()
        if not query_text:
            return []

        k = k or settings.RECOMMENDATION_TOP_K
        fetch_k = fetch_k or settings.RECOMMENDATION_FETCH_K

        (query_vector,) = await embedding_service.embed([query_text])

        # Cosine distance uses the HNSW index (vector_cosine_ops). Smaller = closer.
        distance = CardChunk.embedding.cosine_distance(query_vector)
        result = await session.execute(select(CardChunk.card_id).order_by(distance).limit(fetch_k))

        # De-dupe to distinct cards, preserving the nearest-first order.
        ordered_ids: list[str] = []
        for (card_id,) in result.all():
            if card_id not in ordered_ids:
                ordered_ids.append(card_id)
            if len(ordered_ids) >= k:
                break

        if not ordered_ids:
            return []

        products = await session.execute(select(CardProduct).where(CardProduct.id.in_(ordered_ids)))
        by_id = {p.id: p for p in products.scalars().all()}
        return [by_id[cid] for cid in ordered_ids if cid in by_id]
