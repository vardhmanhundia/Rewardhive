"""Wallet-advisor endpoint — streams the agent's what-if reasoning as SSE.

The advisor interprets a natural-language question, runs the deterministic
optimizer over the (optionally adjusted) spend, and streams a grounded
explanation. Named events: ``plan`` ({note, spend}), ``result`` ({mode, result}),
``token`` ({text}), ``done`` — or a single ``error``.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.advisor import stream_advisor
from src.db.database import get_db
from src.middleware.auth import get_current_user_id, verify_user_auth
from src.models import AdvisorRequest

router = APIRouter(prefix="/advisor", tags=["advisor"])

_STREAM_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def _sse(event: str, data: object) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/stream")
async def advisor_stream(
    request: AdvisorRequest,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream the advisor's plan, the optimizer result, and a grounded explanation."""
    user_id = get_current_user_id(payload)
    owned = [item.model_dump() for item in request.owned]

    async def event_source() -> AsyncIterator[str]:
        async for event in stream_advisor(
            session,
            user_id,
            request.question,
            request.spend,
            owned,
            request.candidate_id,
        ):
            kind = event["kind"]
            if kind == "plan":
                yield _sse("plan", {"note": event["note"], "spend": event["spend"]})
            elif kind == "result":
                yield _sse("result", {"mode": event["mode"], "result": event["result"]})
            elif kind == "token":
                yield _sse("token", {"text": event["text"]})
            elif kind == "done":
                yield _sse("done", {})
            elif kind == "error":
                yield _sse("error", {"detail": event["detail"]})

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers=_STREAM_HEADERS,
    )
