"""FastAPI application"""

# pyright: reportMissingImports=false
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send
from src.config import settings
from src.agents.commons import close_checkpointer, configure_langsmith, init_checkpointer
from src.agents.user_profiling import set_checkpointer
from src.api.auth import router as auth_router
from src.api.profile import router as profile_router

# from src.api.profiling import router as profiling_router
from src.api.advisor import router as advisor_router
from src.api.cards import router as cards_router
from src.api.optimizer import router as optimizer_router
from src.api.recommendations import router as recommendations_router
from src.api.rewards import router as rewards_router

# Enable LangSmith tracing (no-op unless LANGSMITH_TRACING=true) before any
# graph runs, so all LLM/graph calls are logged.
configure_langsmith()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Open the chat-persistence checkpointer on startup, close it on shutdown.

    If the checkpointer can't be opened, persistence is disabled and the app
    still runs (set_checkpointer(None) keeps chats non-persistent).
    """
    checkpointer = await init_checkpointer()
    set_checkpointer(checkpointer)
    yield
    await close_checkpointer()


app = FastAPI(
    title="Card Agent API",
    version="0.1.0",
    lifespan=lifespan,
)

logger = logging.getLogger("card_agent")


class CatchUnhandledExceptions:
    """Return a JSON 500 for unhandled exceptions so CORS headers still apply.

    Starlette's built-in 500 handler runs outside all user middleware, so its
    response never passes back through CORSMiddleware and carries no CORS headers
    — the browser then reports a backend 500 as an opaque "Failed to fetch"
    instead of the real status. This is added *before* CORSMiddleware so that CORS
    wraps it and tags the synthesized response.

    Implemented as pure ASGI (not BaseHTTPMiddleware) because several endpoints
    return a streaming SSE response; BaseHTTPMiddleware buffers the body and would
    break that. Here ``send`` is passed through untouched, so streaming is
    unaffected. A 500 is only synthesized when the response hasn't started yet; if
    an exception surfaces mid-stream there is nothing left to replace, so it is
    re-raised.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        response_started = False

        async def send_wrapper(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            logger.exception("Unhandled error on %s %s", scope.get("method"), scope.get("path"))
            if response_started:
                raise
            response = JSONResponse(status_code=500, content={"detail": "Internal server error"})
            await response(scope, receive, send)


# Registered before CORSMiddleware so CORS stays the outermost user middleware.
app.add_middleware(CatchUnhandledExceptions)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(profile_router)
# app.include_router(profiling_router)
app.include_router(cards_router)
app.include_router(optimizer_router)
app.include_router(recommendations_router)
app.include_router(advisor_router)
app.include_router(rewards_router)


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "version": "0.1.0",
    }
