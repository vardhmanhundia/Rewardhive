"""Structured LLM output schemas and the public result for the profiling graph.

Long-term memory for the profiling agent is the structured user profile
(``user_profiles``), not free-text notes: the extractor pulls the fields defined
in :class:`src.models.UserProfileDetails` out of a message, and only those are
stored and fed back into the LLM prompts.
"""

from typing import Optional

from pydantic import BaseModel, Field

from src.models import (
    CarStatus,
    Household,
    RelationshipStatus,
    SavedBank,
    SavedCard,
    SavedGoal,
    SavedLoan,
    TravelPreference,
    USStatus,
)


class ProfileExtraction(BaseModel):
    """Profile fields found in the user's latest message.

    Every field defaults to "not mentioned": leave a scalar ``null`` and a list
    empty unless the user actually stated it this turn. Never guess, and only
    use the allowed values for the enum fields.
    """

    occupation: Optional[str] = None
    company: Optional[str] = None
    relationship_status: Optional[RelationshipStatus] = None
    family_size: Optional[int] = None
    location_state: Optional[str] = None
    location_country: Optional[str] = None
    household: Optional[Household] = None
    car: Optional[CarStatus] = None
    travel_preference: Optional[TravelPreference] = None
    us_status: Optional[USStatus] = None
    us_status_detail: Optional[str] = None
    airline_ranking: list[str] = Field(default_factory=list)
    online_shopping_ranking: list[str] = Field(default_factory=list)
    offline_shopping_ranking: list[str] = Field(default_factory=list)
    cards: list[SavedCard] = Field(default_factory=list)
    banks: list[SavedBank] = Field(default_factory=list)
    goals: list[SavedGoal] = Field(default_factory=list)
    loans: list[SavedLoan] = Field(default_factory=list)
    confirmed_fields: list[str] = Field(
        default_factory=list,
        description=(
            "Names of single-value fields the user explicitly confirmed or "
            "corrected this turn — e.g. when answering a question about which of "
            "two values is final, or saying 'change my occupation to X'. These "
            "overwrite the stored value even when it differs. Other single-value "
            "fields that merely differ are left out so the assistant can ask."
        ),
    )


class ProfileConflict(BaseModel):
    """A single-value field whose newly-mentioned value differs from the stored
    one and that the user has *not* confirmed — the assistant should ask which
    is final rather than overwrite."""

    field: str
    label: str
    stored: str
    mentioned: str


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
