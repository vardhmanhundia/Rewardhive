"""FastAPI application"""

# pyright: reportMissingImports=false
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.config import settings
from src.agents.commons import close_checkpointer, configure_langsmith, init_checkpointer
from src.agents.user_profiling import set_checkpointer
from src.api.auth import router as auth_router
from src.api.profiling import router as profiling_router
from src.api.cards import router as cards_router
from src.api.recommendations import router as recommendations_router

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
app.include_router(profiling_router)
app.include_router(cards_router)
app.include_router(recommendations_router)


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "version": "0.1.0",
    }
