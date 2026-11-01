"""Rewards endpoint — streams "which card should I use for this purchase?".

The agent resolves the purchase, ranks the candidate cards with the deterministic
engine, and streams a grounded explanation. Candidates come from the request's
`card_ids` (e.g. two cards the user named to compare); when that is empty, the
user's saved cards are used. Named events: ``plan`` ({note, category, merchant}),
``result`` ({picks}), ``token`` ({text}), ``done`` — ``need_cards`` when the user
has no cards to rank, or a single ``error``.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.rewards import stream_rewards
from src.db.database import get_db
from src.middleware.auth import get_current_user_id, verify_user_auth
from src.models import BestCardRequest
from src.services.user_service import UserService

router = APIRouter(prefix="/rewards", tags=["rewards"])

_STREAM_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def _sse(event: str, data: object) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/best-card")
async def best_card_stream(
    request: BestCardRequest,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream the which-card answer: resolved purchase, ranked cards, explanation."""
    user_id = get_current_user_id(payload)

    # Default the candidate set to the user's saved catalog cards when the client
    # sends none. Custom (non-catalog) cards have no id to price, so they're skipped.
    card_ids = list(request.card_ids)
    if not card_ids:
        profile = await UserService.get_profile_details(session, user_id)
        card_ids = [c.get("card_id") for c in profile.cards if c.get("card_id")]

    async def event_source() -> AsyncIterator[str]:
        async for event in stream_rewards(
            session, user_id, request.question, card_ids, request.monthly_amount
        ):
            kind = event["kind"]
            if kind == "plan":
                yield _sse(
                    "plan",
                    {
                        "note": event["note"],
                        "category": event["category"],
                        "merchant": event["merchant"],
                        "owned": event["owned"],
                    },
                )
            elif kind == "result":
                yield _sse("result", {"picks": event["picks"], "owned": event["owned"]})
            elif kind == "token":
                yield _sse("token", {"text": event["text"]})
            elif kind == "need_cards":
                yield _sse("need_cards", {})
            elif kind == "done":
                yield _sse("done", {})
            elif kind == "error":
                yield _sse("error", {"detail": event["detail"]})

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers=_STREAM_HEADERS,
    )
