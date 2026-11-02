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
from src.db.models import User
from src.models import (
    CardProductSchema,
    ChatHistoryMessage,
    ChatHistoryResponse,
    ConversationListResponse,
    ConversationMember,
    ConversationMembersResponse,
    ConversationShareInfo,
    ConversationSummary,
    FollowUpPrompt,
    MemberActionRequest,
    NotificationListResponse,
    NotificationSchema,
    ProfileSummaryResponse,
    ProfileConflictInfo,
    RecommendationRequest,
    RecommendationResponse,
    ShareConversationRequest,
    ShareConversationResponse,
    UserMemorySchema,
)
from src.services.conversation_service import ConversationService
from src.services.memory_service import MemoryService


async def _resolve_conversation_id(
    session: AsyncSession, user_id: UUID, conversation_id: UUID | None
) -> UUID:
    """Return the conversation to persist this turn under.

    Uses the requested conversation when it exists (any authenticated user may
    continue a shared conversation — the UUID acts as the access token);
    otherwise starts a fresh one owned by the requesting user.
    """
    if conversation_id is not None:
        existing = await ConversationService.get_by_id(session, conversation_id)
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
    answer, cards, new_memories, suggestions, conflicts, intent, prompts = await run_recommendation(
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
        intent=intent,
        prompts=[FollowUpPrompt.model_validate(p) for p in prompts],
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
                elif kind == "route":
                    yield _sse("route", {"intent": event.get("intent")})
                elif kind == "prompt":
                    yield _sse("prompt", {
                        "action": event.get("action"),
                        "card_ids": event.get("card_ids", []),
                    })
                elif kind == "plan":
                    yield _sse("plan", {
                        k: v for k, v in event.items() if k != "kind"
                    })
                elif kind == "result":
                    yield _sse("result", {
                        k: v for k, v in event.items() if k != "kind"
                    })
                elif kind == "need_cards":
                    yield _sse("need_cards", {
                        k: v for k, v in event.items() if k != "kind"
                    })
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
    """List the user's own + shared conversations, most recent first."""
    user_id = get_current_user_id(payload)
    own = await ConversationService.list_for_user(session, user_id)
    shared = await ConversationService.list_shared_with_user(session, user_id)
    shared_by_me = await ConversationService.list_ids_shared_by_user(session, user_id)
    summaries: list[ConversationSummary] = []
    for c in own:
        s = ConversationSummary.model_validate(c, from_attributes=True)
        s.shared_by_me = c.id in shared_by_me
        summaries.append(s)
    for c in shared:
        owner = await session.get(User, c.user_id)
        s = ConversationSummary.model_validate(c, from_attributes=True)
        s.is_shared = True
        s.owner_email = owner.email if owner else None
        summaries.append(s)

    summaries.sort(key=lambda s: s.updated_at, reverse=True)
    return ConversationListResponse(conversations=summaries)


@router.get("/conversations/{conversation_id}/history", response_model=ChatHistoryResponse)
async def conversation_history(
    conversation_id: UUID,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> ChatHistoryResponse:
    """Return one conversation's persisted transcript (shared via link)."""
    conversation = await ConversationService.get_by_id(session, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = await load_history(str(conversation_id))
    return ChatHistoryResponse(
        messages=[
            ChatHistoryMessage(role=m["role"], content=m["content"], cards=m.get("cards", []))
            for m in messages
        ]
    )


@router.post(
    "/conversations/{conversation_id}/share",
    response_model=ShareConversationResponse,
)
async def share_conversation(
    conversation_id: UUID,
    request: ShareConversationRequest,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> ShareConversationResponse:
    """Share a conversation with other users by email."""
    user_id = get_current_user_id(payload)
    conversation = await ConversationService.get_by_id(session, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    shared_with, invited_new, not_found = await ConversationService.share_with_emails(
        session, conversation_id, user_id, request.emails
    )
    await session.commit()
    return ShareConversationResponse(
        shared_with=shared_with, invited_new=invited_new, not_found=not_found
    )


@router.get(
    "/conversations/{conversation_id}/share-info",
    response_model=ConversationShareInfo,
)
async def conversation_share_info(
    conversation_id: UUID,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> ConversationShareInfo:
    """Get sharing info for a conversation — drives banner and join flow."""
    user_id = get_current_user_id(payload)
    conversation = await ConversationService.get_by_id(session, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    owner = await session.get(User, conversation.user_id)
    owner_name = f"{owner.first_name} {owner.last_name}" if owner else "Unknown"
    is_mine = conversation.user_id == user_id
    invite_status = await ConversationService.get_share_status(
        session, conversation_id, user_id
    )
    already_added = is_mine or invite_status == "accepted"
    return ConversationShareInfo(
        conversation_id=conversation.id,
        title=conversation.title,
        owner_name=owner_name,
        is_mine=is_mine,
        already_added=already_added,
        invite_status=invite_status,
    )


@router.post("/conversations/{conversation_id}/add-to-mine")
async def add_conversation_to_mine(
    conversation_id: UUID,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Self-join via a share link — accepted immediately, owner notified."""
    user_id = get_current_user_id(payload)
    ok = await ConversationService.add_via_link(session, conversation_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await session.commit()
    return {"ok": True}


@router.post("/conversations/{conversation_id}/accept-invite")
async def accept_invite(
    conversation_id: UUID,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Accept a pending conversation invite."""
    user_id = get_current_user_id(payload)
    ok = await ConversationService.accept_invite(session, conversation_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="No pending invite found")
    await session.commit()
    return {"ok": True}


@router.post("/conversations/{conversation_id}/decline-invite")
async def decline_invite(
    conversation_id: UUID,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Decline a pending conversation invite."""
    user_id = get_current_user_id(payload)
    ok = await ConversationService.decline_invite(session, conversation_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="No pending invite found")
    await session.commit()
    return {"ok": True}


@router.get(
    "/conversations/{conversation_id}/members",
    response_model=ConversationMembersResponse,
)
async def list_members(
    conversation_id: UUID,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> ConversationMembersResponse:
    """List all members of a conversation."""
    members = await ConversationService.list_members(session, conversation_id)
    return ConversationMembersResponse(
        members=[ConversationMember(**m) for m in members]
    )


@router.post("/conversations/{conversation_id}/members/remove")
async def remove_member(
    conversation_id: UUID,
    request: MemberActionRequest,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Remove a member from a conversation (owner only)."""
    user_id = get_current_user_id(payload)
    ok = await ConversationService.remove_member(
        session, conversation_id, user_id, request.target_user_id
    )
    if not ok:
        raise HTTPException(status_code=403, detail="Not allowed or member not found")
    await session.commit()
    return {"ok": True}


@router.post("/conversations/{conversation_id}/members/promote")
async def promote_member(
    conversation_id: UUID,
    request: MemberActionRequest,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Promote a member to owner (owner only)."""
    user_id = get_current_user_id(payload)
    ok = await ConversationService.promote_to_owner(
        session, conversation_id, user_id, request.target_user_id
    )
    if not ok:
        raise HTTPException(status_code=403, detail="Not allowed or member not found")
    await session.commit()
    return {"ok": True}


# ── Notifications ──────────────────────────────────────────────────────


@router.get("/notifications", response_model=NotificationListResponse)
async def list_notifications(
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> NotificationListResponse:
    """List the user's notifications (most recent first)."""
    user_id = get_current_user_id(payload)
    notifications = await ConversationService.list_notifications(session, user_id)
    count = await ConversationService.unread_count(session, user_id)
    return NotificationListResponse(
        notifications=[
            NotificationSchema.model_validate(n, from_attributes=True) for n in notifications
        ],
        unread_count=count,
    )


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    user_id = get_current_user_id(payload)
    await ConversationService.mark_read(session, notification_id, user_id)
    await session.commit()
    return {"ok": True}


@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    user_id = get_current_user_id(payload)
    await ConversationService.mark_all_read(session, user_id)
    await session.commit()
    return {"ok": True}
