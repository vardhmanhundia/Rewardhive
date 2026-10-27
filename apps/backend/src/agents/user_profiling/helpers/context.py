"""Helpers for reading per-invocation context out of the LangGraph config/state."""

from typing import Any
from uuid import UUID

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.user_profiling.models import ProfilingState


def config_values(config: RunnableConfig) -> tuple[AsyncSession, UUID]:
    """Pull the injected DB session and user id out of the runnable config."""
    configurable = config.get("configurable", {})
    session = configurable.get("session")
    user_id = configurable.get("user_id")
    if session is None or user_id is None:
        raise ValueError("run_profiling_turn must supply 'session' and 'user_id'")
    return session, user_id


def history_messages(state: ProfilingState) -> list[Any]:
    """Convert prior turns in the state into LangChain messages."""
    messages: list[Any] = []
    for turn in state.get("history") or []:
        role, content = turn.get("role"), turn.get("content", "")
        if role == "assistant":
            messages.append(AIMessage(content=content))
        else:
            messages.append(HumanMessage(content=content))
    return messages
