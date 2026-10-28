"""Card catalog read endpoints (the products the assistant recommends from)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_db
from src.db.models import CardProduct
from src.models import CardListResponse, CardProductSchema
from src.services.card_service import CardService

router = APIRouter(prefix="/cards", tags=["cards"])


@router.get("", response_model=CardListResponse)
async def list_cards(session: AsyncSession = Depends(get_db)) -> dict:
    """Return the full card catalog."""
    cards = await CardService.get_all_cards(session)
    return {"cards": cards}


@router.get("/{card_id}", response_model=CardProductSchema)
async def get_card(card_id: str, session: AsyncSession = Depends(get_db)) -> CardProduct:
    """Return one card by id, or 404 if it is not in the catalog."""
    card = await CardService.get_card(session, card_id)
    if card is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found",
        )
    return card
