"""Structured LLM output schemas and the public result for the profiling graph."""

from pydantic import BaseModel, Field


class MemoryItem(BaseModel):
    text: str = Field(description="Atomic user memory, a short sentence.")
    is_new: bool = Field(description="True if new information, false if a duplicate.")


class MemoryDecision(BaseModel):
    should_write: bool = Field(description="Whether anything should be stored.")
    memories: list[MemoryItem] = Field(default_factory=list)


class ChatReply(BaseModel):
    reply: str = Field(description="The personalized answer to the user.")
    suggestions: list[str] = Field(
        description="Exactly three relevant follow-up questions for the user.",
    )


class SuggestionList(BaseModel):
    """Follow-up suggestions generated after a streamed reply."""

    suggestions: list[str] = Field(
        description="Exactly three relevant follow-up questions for the user.",
    )


class ProfilingResult(BaseModel):
    """What one profiling turn returns to the caller."""

    reply: str
    suggestions: list[str]
    new_memories: list[str]
