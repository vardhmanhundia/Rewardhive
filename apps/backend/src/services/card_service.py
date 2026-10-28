"""Card catalog service: read access to the products the assistant recommends from."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardProduct


class CardService:
    """Read access to the seeded card catalog (card_products)."""

    @staticmethod
    async def get_all_cards(session: AsyncSession) -> list[CardProduct]:
        """Return every catalog card, ordered by name."""
        result = await session.execute(select(CardProduct).order_by(CardProduct.name))
        return list(result.scalars().all())

    @staticmethod
    async def get_card(session: AsyncSession, card_id: str) -> CardProduct | None:
        """Return one catalog card by id, or None if it does not exist."""
        return await session.get(CardProduct, card_id)
