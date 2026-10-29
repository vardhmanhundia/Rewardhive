"""Card-recommendation endpoints (profile-aware RAG + Muse generation).

Both endpoints require auth so the recommendation can read the user's stored
profile memories. The streaming endpoint emits named Server-Sent Events that the
frontend consumes: ``stage`` (progress), ``cards`` (the retrieved catalog rows),
``token`` (answer chunks), and ``done``.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.graph import run_recommendation, stream_recommendation
from src.agents.user_profiling.graph import load_history
from src.db.database import get_db
from src.middleware.auth import get_current_user_id, verify_user_auth
from src.models import (
    CardProductSchema,
    ChatHistoryResponse,
    ProfileConflictInfo,
    ProfilingTurnMessage,
    RecommendationRequest,
    RecommendationResponse,
)

router = APIRouter(prefix="/recommendations", tags=["recommendations"])

# Keep SSE chunks flowing immediately instead of being buffered by a proxy.
_STREAM_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


@router.post("", response_model=RecommendationResponse)
async def recommend(
    request: RecommendationRequest,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> RecommendationResponse:
    """Remember, retrieve, and recommend — plus the cards, memories, and suggestions."""
    user_id = get_current_user_id(payload)
    history = [turn.model_dump() for turn in request.history]
    answer, cards, new_memories, suggestions, conflicts = await run_recommendation(
        session, user_id, request.query, history=history
    )
    # The agent flushes new memories; commit so they persist across turns.
    await session.commit()
    return RecommendationResponse(
        answer=answer,
        cards=[CardProductSchema.model_validate(c) for c in cards],
        new_memories=new_memories,
        suggestions=suggestions,
        conflicts=[ProfileConflictInfo.model_validate(c) for c in conflicts],
    )


@router.get("/history", response_model=ChatHistoryResponse)
async def history(
    payload: dict = Depends(verify_user_auth),
) -> ChatHistoryResponse:
    """Return the authenticated user's persisted recommend conversation.

    Empty if persistence is disabled or the user has no stored chat yet.
    """
    user_id = get_current_user_id(payload)
    messages = await load_history(user_id)
    return ChatHistoryResponse(
        messages=[ProfilingTurnMessage(role=m["role"], content=m["content"]) for m in messages]
    )


def _sse(event: str, data: object) -> str:
    """Format one named Server-Sent Event frame."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/stream")
async def recommend_stream(
    request: RecommendationRequest,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream a profile-aware recommendation as Server-Sent Events.

    Emits ``stage`` ({stage, count?}), ``cards`` (CardProduct[]), ``token``
    ({text}) repeatedly, then ``memories`` ({items}), ``suggestions`` ({items}),
    and ``done`` — or a single ``error``.
    """
    user_id = get_current_user_id(payload)
    history = [turn.model_dump() for turn in request.history]

    async def event_source() -> AsyncIterator[str]:
        async for event in stream_recommendation(session, user_id, request.query, history=history):
            kind = event["kind"]
            if kind == "stage":
                yield _sse("stage", {"stage": event["stage"], "count": event.get("count")})
            elif kind == "cards":
                yield _sse("cards", event["cards"])
            elif kind == "token":
                yield _sse("token", {"text": event["text"]})
            elif kind in ("memories", "suggestions", "conflicts"):
                yield _sse(kind, {"items": event["items"]})
            elif kind == "done":
                yield _sse("done", {})
            elif kind == "error":
                yield _sse("error", {"detail": event["detail"]})

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers=_STREAM_HEADERS,
    )
