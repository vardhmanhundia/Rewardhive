"""LangGraph state for the user-profiling graph."""

from typing import Annotated, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class ProfilingState(TypedDict, total=False):
    message: str  # latest user message (input)
    history: list[dict[str, str]]  # prior turns [{"role", "content"}] (input)
    # Persisted conversation, accumulated across turns by the checkpointer
    # (keyed by thread_id = user_id). Written via the persistence helpers, not
    # by the generation nodes.
    messages: Annotated[list[AnyMessage], add_messages]
    new_memories: list[str]  # memories stored this turn (output)
    reply: str  # personalized answer (output)
    suggestions: list[str]  # three follow-up questions (output)
