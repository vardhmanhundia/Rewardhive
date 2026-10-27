"""User-profiling chat endpoint.

Exposes the :mod:`src.agents.user_profiling` LangGraph workflow over HTTP. The
frontend owns conversation state and sends the latest message plus prior turns;
each request runs one profiling turn (extract new long-term memories, then
answer the user) scoped to the authenticated user.
"""

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.user_profiling import run_profiling_turn, stream_profiling_turn
from src.db.database import get_db
from src.middleware.auth import get_current_user_id, verify_user_auth
from src.models import ProfilingTurnRequest, ProfilingTurnResponse

router = APIRouter(prefix="/profiling", tags=["profiling"])

# Headers that keep SSE chunks flowing immediately instead of being buffered by
# the dev proxy or a production reverse proxy (e.g. nginx).
_STREAM_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


@router.post("/chat", response_model=ProfilingTurnResponse)
async def chat(
    request: ProfilingTurnRequest,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> ProfilingTurnResponse:
    """Run one user-profiling chat turn for the authenticated user.

    Requires:
        Authorization header with Bearer token.

    Returns:
        The personalized reply, three follow-up suggestions, and any memories
        stored this turn.
    """
    user_id = get_current_user_id(payload)

    result = await run_profiling_turn(
        session,
        user_id,
        message=request.message,
        history=[turn.model_dump() for turn in request.history],
    )

    # The agent flushes new memories; commit so they persist across turns.
    await session.commit()

    return ProfilingTurnResponse(
        reply=result.reply,
        suggestions=result.suggestions,
        new_memories=result.new_memories,
    )


@router.post("/chat/stream")
async def chat_stream(
    request: ProfilingTurnRequest,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream one user-profiling chat turn as Server-Sent Events.

    Requires:
        Authorization header with Bearer token.

    Streams newline-delimited SSE ``data:`` frames, each a JSON object with a
    ``type`` field: ``token`` (reply chunks, repeated), then ``memories``,
    ``suggestions``, and ``done`` — or a single ``error`` on failure.
    """
    user_id = get_current_user_id(payload)
    history = [turn.model_dump() for turn in request.history]

    async def event_source() -> AsyncIterator[str]:
        async for event in stream_profiling_turn(
            session, user_id, message=request.message, history=history
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers=_STREAM_HEADERS,
    )
