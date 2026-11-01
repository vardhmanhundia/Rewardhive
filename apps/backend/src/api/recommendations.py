"""Card-recommendation endpoints (profile-aware RAG + Muse generation).

Both endpoints require auth so the recommendation can read the user's stored
profile memories. The streaming endpoint emits named Server-Sent Events that the
frontend consumes: ``stage`` (progress), ``cards`` (the retrieved catalog rows),
``token`` (answer chunks), and ``done``.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.graph import run_recommendation, stream_recommendation
from src.agents.user_profiling.graph import load_history
from src.db.database import get_db
from src.middleware.auth import get_current_user_id, verify_user_auth
from src.models import (
    CardProductSchema,
    ChatHistoryMessage,
    ChatHistoryResponse,
    ConversationListResponse,
    ConversationSummary,
    ProfileSummaryResponse,
    ProfileConflictInfo,
    RecommendationRequest,
    RecommendationResponse,
    UserMemorySchema,
)
from src.services.conversation_service import ConversationService
from src.services.memory_service import MemoryService


async def _resolve_conversation_id(
    session: AsyncSession, user_id: UUID, conversation_id: UUID | None
) -> UUID:
    """Return the conversation to persist this turn under.

    Uses the requested conversation when it exists and belongs to the user;
    otherwise starts a fresh one. A newly created conversation is committed so
    its id is stable before the turn streams.
    """
    if conversation_id is not None:
        existing = await ConversationService.get(session, conversation_id, user_id)
        if existing is not None:
            return existing.id
    conversation = await ConversationService.create(session, user_id)
    new_id = conversation.id  # capture before commit (attributes expire on commit)
    await session.commit()
    return new_id

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
    conversation_id = await _resolve_conversation_id(session, user_id, request.conversation_id)
    answer, cards, new_memories, suggestions, conflicts = await run_recommendation(
        session, user_id, request.query, history=history, conversation_id=conversation_id
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
    messages = await load_history(str(user_id))
    return ChatHistoryResponse(
        messages=[
            ChatHistoryMessage(role=m["role"], content=m["content"], cards=m.get("cards", []))
            for m in messages
        ]
    )


@router.get("/profile", response_model=ProfileSummaryResponse)
async def profile_summary(
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> ProfileSummaryResponse:
    """Return the long-term profile the assistant has learned about the user.

    Read-only view over ``user_memories`` for the home/summary page. Empty if the
    user hasn't chatted yet.
    """
    user_id = get_current_user_id(payload)
    memories = await MemoryService.list_memories(session, user_id)
    return ProfileSummaryResponse(memories=[UserMemorySchema.model_validate(m) for m in memories])


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
    conversation_id = await _resolve_conversation_id(session, user_id, request.conversation_id)

    async def event_source() -> AsyncIterator[str]:
        # Tell the client which conversation this turn belongs to, so a fresh
        # session can adopt the new id (and update its URL) for follow-ups.
        yield _sse("conversation", {"id": str(conversation_id)})
        try:
            async for event in stream_recommendation(
                session, user_id, request.query, history=history, conversation_id=conversation_id
            ):
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
        finally:
            # Persist the conversation bump (title/updated_at) and any profile
            # writes made while streaming; roll back if the commit fails.
            try:
                await session.commit()
            except Exception:  # noqa: BLE001 — a failed commit must not crash the stream
                await session.rollback()

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers=_STREAM_HEADERS,
    )


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> ConversationListResponse:
    """List the user's recommend-chat conversations, most recent first."""
    user_id = get_current_user_id(payload)
    conversations = await ConversationService.list_for_user(session, user_id)
    return ConversationListResponse(
        conversations=[
            ConversationSummary.model_validate(c, from_attributes=True) for c in conversations
        ]
    )


@router.get("/conversations/{conversation_id}/history", response_model=ChatHistoryResponse)
async def conversation_history(
    conversation_id: UUID,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> ChatHistoryResponse:
    """Return one conversation's persisted transcript (404 if not the user's)."""
    user_id = get_current_user_id(payload)
    conversation = await ConversationService.get(session, conversation_id, user_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = await load_history(str(conversation_id))
    return ChatHistoryResponse(
        messages=[
            ChatHistoryMessage(role=m["role"], content=m["content"], cards=m.get("cards", []))
            for m in messages
        ]
    )
