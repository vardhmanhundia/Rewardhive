"""LangGraph state for the user-profiling graph."""

from typing import TypedDict


class ProfilingState(TypedDict, total=False):
    message: str  # latest user message (input)
    history: list[dict[str, str]]  # prior turns [{"role", "content"}] (input)
    new_memories: list[str]  # memories stored this turn (output)
    reply: str  # personalized answer (output)
    suggestions: list[str]  # three follow-up questions (output)
