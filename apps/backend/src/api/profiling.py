"""User-profiling chat endpoint (SSE streaming)."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.user_profiling import stream_profiling_turn
from src.db.database import get_db
from src.middleware.auth import get_current_user_id, verify_user_auth

router = APIRouter(prefix="/profiling", tags=["profiling"])

_STREAM_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


class ProfilingChatRequest(BaseModel):
    message: str
    history: list[dict[str, str]] | None = None


@router.post("/chat")
async def profiling_chat(
    request: ProfilingChatRequest,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
):
    user_id = get_current_user_id(payload)

    async def event_stream():
        async for event in stream_profiling_turn(
            session, user_id, request.message, request.history
        ):
            etype = event.get("type", "")
            if etype == "token":
                yield f"event: token\ndata: {json.dumps({'text': event['text']})}\n\n"
            elif etype == "profile":
                yield f"event: profile\ndata: {json.dumps(event['data'])}\n\n"
            elif etype == "suggestions":
                yield f"event: suggestions\ndata: {json.dumps({'items': event['items']})}\n\n"
            elif etype == "done":
                yield f"event: done\ndata: {json.dumps({})}\n\n"
            elif etype == "error":
                yield f"event: error\ndata: {json.dumps({'detail': event['detail']})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers=_STREAM_HEADERS,
    )
