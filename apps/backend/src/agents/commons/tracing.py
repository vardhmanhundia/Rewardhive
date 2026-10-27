"""LangSmith tracing for agent graphs.

LangChain and LangGraph auto-trace every LLM/graph run to LangSmith once the
right environment variables are set. :func:`configure_langsmith` bridges this
project's :mod:`src.config` settings into those env vars so a single
``LANGSMITH_TRACING=true`` (plus an API key) turns on logging — no per-call
wiring needed.

For logging your own functions, use the re-exported :func:`traceable`
decorator; the span only reaches LangSmith when tracing is enabled, and is a
no-op otherwise, so it is safe to leave in place.
"""

import os

from langsmith import traceable

from src.config import settings

__all__ = ["configure_langsmith", "traceable"]


def configure_langsmith() -> bool:
    """Apply LangSmith settings to the environment for the LangChain SDK.

    Idempotent; safe to call at startup. Returns True if tracing is enabled.
    """
    if not settings.LANGSMITH_TRACING:
        # Be explicit so a stray env var can't silently enable tracing.
        os.environ["LANGSMITH_TRACING"] = "false"
        return False

    os.environ["LANGSMITH_TRACING"] = "true"
    os.environ["LANGSMITH_PROJECT"] = settings.LANGSMITH_PROJECT
    if settings.LANGSMITH_API_KEY:
        os.environ["LANGSMITH_API_KEY"] = settings.LANGSMITH_API_KEY
    if settings.LANGSMITH_ENDPOINT:
        os.environ["LANGSMITH_ENDPOINT"] = settings.LANGSMITH_ENDPOINT
    return True
