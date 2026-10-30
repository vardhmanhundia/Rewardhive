"""Wallet-optimizer endpoints — the deterministic decision engine over the catalog.

These wrap :mod:`src.services.optimizer_service`. They are privacy-friendly by
design: the client sends approximate spend and the card ids it holds; nothing
about real accounts or balances is required. Card facts are read from the
catalog server-side.
"""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_db
from src.middleware.auth import verify_user_auth
from src.models import (
    EvaluateCardRequest,
    ScenarioComparisonSchema,
    WalletOptimizeRequest,
    WalletResultSchema,
)
from src.services.card_service import CardService
from src.services.optimizer_service import (
    OptCard,
    card_to_optcard,
    evaluate_card,
    optimize_wallet,
)

router = APIRouter(prefix="/optimizer", tags=["optimizer"])


async def _load_optcard(session: AsyncSession, card_id: str) -> OptCard | None:
    """Fetch a catalog card and normalize it into the optimizer's model."""
    card = await CardService.get_card(session, card_id)
    if card is None:
        return None
    return card_to_optcard(card.id, card.name, card.issuer, card.annual_fee, card.rewards)


@router.post("/wallet", response_model=WalletResultSchema)
async def optimize(
    request: WalletOptimizeRequest,
    _: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> WalletResultSchema:
    """Best net annual value for a spend profile across the given cards."""
    cards = [oc for cid in request.card_ids if (oc := await _load_optcard(session, cid))]
    result = optimize_wallet(request.spend, cards)
    return WalletResultSchema(**asdict(result))


@router.post("/evaluate-card", response_model=ScenarioComparisonSchema)
async def evaluate(
    request: EvaluateCardRequest,
    _: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> ScenarioComparisonSchema:
    """Keep vs. reallocate vs. add the candidate card — with a plain-English verdict."""
    owned: list[OptCard] = []
    usage: dict[str, str] = {}
    for item in request.owned:
        oc = await _load_optcard(session, item.card_id)
        if oc is None:
            continue
        owned.append(oc)
        if item.category:
            usage[item.category] = item.card_id

    candidate = await _load_optcard(session, request.candidate_id)
    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate card not found",
        )

    result = evaluate_card(request.spend, owned, usage, candidate)
    return ScenarioComparisonSchema(**asdict(result))
