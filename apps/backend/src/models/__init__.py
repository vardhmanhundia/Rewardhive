"""Pydantic schemas for request/response validation"""

from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

# Enum-style option sets. Kept here so the API documents the allowed values in
# OpenAPI; "other" lets the UI offer a free-text fallback where listed.
RelationshipStatus = Literal["single", "partner", "family"]
Household = Literal["owning", "renting", "mortgaging"]
CarStatus = Literal["financed", "owned", "rental"]
TravelPreference = Literal["economy", "leisure", "savings"]
USStatus = Literal["citizen", "visa", "green_card", "visitor"]


class CardSchema(BaseModel):
    id: str
    title: str
    content: str
    created_at: str

    class Config:
        from_attributes = True


class UserCardSchema(BaseModel):
    id: str
    card: CardSchema


class CardRewardSchema(BaseModel):
    """One earn rate, e.g. {"category": "Dining", "rate": "3x"}."""

    category: str
    rate: str

    class Config:
        from_attributes = True


class CardProductSchema(BaseModel):
    """A catalog card as the frontend consumes it (mirrors web CardProduct)."""

    id: str
    name: str
    issuer: str
    network: str | None = None
    card_type: str | None = None
    annual_fee: int
    apr: str | None = None
    foreign_transaction_fee: float | None = None
    credit_score_required: str | None = None
    intro_offer: str | None = None
    rewards: list[CardRewardSchema] = []
    benefits: list[str] = []
    summary: str | None = None

    class Config:
        from_attributes = True


class CardListResponse(BaseModel):
    """Envelope for the catalog list endpoint."""

    cards: list[CardProductSchema]


class UserSchema(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    created_at: datetime
    updated_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class UserSignupRequest(BaseModel):
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=8, max_length=255)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserLoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserSchema


class UserProfileResponse(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class UserMemorySchema(BaseModel):
    id: UUID
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProfilingTurnMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ProfilingTurnRequest(BaseModel):
    message: str = Field(..., min_length=1)
    history: list[ProfilingTurnMessage] = Field(default_factory=list)


class ProfilingTurnResponse(BaseModel):
    reply: str
    suggestions: list[str]
    new_memories: list[str]


class ChatHistoryMessage(BaseModel):
    """One persisted turn returned by the history endpoint. Assistant turns carry
    the cards recommended then, so a reloaded conversation shows the same text +
    card layout it did live; user turns and plain chat replies have none."""

    role: str = Field(..., pattern="^(user|assistant)$")
    content: str
    cards: list[CardProductSchema] = Field(default_factory=list)


class ChatHistoryResponse(BaseModel):
    messages: list[ChatHistoryMessage]


class ProfileSummaryResponse(BaseModel):
    """What the assistant has learned about a user — the long-term profile
    memories surfaced on the home/summary page."""

    memories: list[UserMemorySchema]


class RecommendationRequest(BaseModel):
    """A recommendation ask. The query is blended with the user's stored
    profile preferences on the server; history gives prior turns for context."""

    query: str = Field(..., min_length=1)
    history: list[ProfilingTurnMessage] = Field(default_factory=list)


class ProfileConflictInfo(BaseModel):
    """A single-value profile field whose newly-mentioned value differs from the
    stored one and the user has not confirmed. Surfaced as a marker so the user
    can reconcile it directly on the profile page rather than mid-chat."""

    field: str
    label: str
    stored: str
    mentioned: str


class RecommendationResponse(BaseModel):
    """Non-streaming recommendation: Muse's prose, the cards it drew on, any
    memories captured this turn, three follow-up suggestions, and a marker for
    any unconfirmed profile conflicts to reconcile on the profile page."""

    answer: str
    cards: list[CardProductSchema]
    new_memories: list[str]
    suggestions: list[str]
    conflicts: list[ProfileConflictInfo] = Field(default_factory=list)


# --- Extended user profile ---------------------------------------------------


class SavedCard(BaseModel):
    """A card the user holds, tagged with a spend category.

    Either `card_id` (a catalog card) or a free-text `name` with `custom=True`
    (a card not in the catalog) identifies it.
    """

    card_id: Optional[str] = None
    name: Optional[str] = None
    category: str
    custom: bool = False


class SavedBank(BaseModel):
    name: str


class SavedGoal(BaseModel):
    text: str


class SavedLoan(BaseModel):
    loan_type: str


class UserProfileDetails(BaseModel):
    """Full read model for the extended profile."""

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
    # Ordered airline preference, most preferred first.
    airline_ranking: list[str] = Field(default_factory=list)
    # Ordered shopping preferences, most preferred first.
    online_shopping_ranking: list[str] = Field(default_factory=list)
    offline_shopping_ranking: list[str] = Field(default_factory=list)
    cards: list[SavedCard] = Field(default_factory=list)
    banks: list[SavedBank] = Field(default_factory=list)
    goals: list[SavedGoal] = Field(default_factory=list)
    loans: list[SavedLoan] = Field(default_factory=list)

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    """Partial-update payload. Only provided fields are written."""

    occupation: Optional[str] = Field(None, max_length=200)
    company: Optional[str] = Field(None, max_length=200)
    relationship_status: Optional[RelationshipStatus] = None
    family_size: Optional[int] = Field(None, ge=0, le=50)
    location_state: Optional[str] = Field(None, max_length=100)
    location_country: Optional[str] = Field(None, max_length=100)
    household: Optional[Household] = None
    car: Optional[CarStatus] = None
    travel_preference: Optional[TravelPreference] = None
    us_status: Optional[USStatus] = None
    us_status_detail: Optional[str] = Field(None, max_length=100)
    airline_ranking: Optional[list[str]] = None
    online_shopping_ranking: Optional[list[str]] = None
    offline_shopping_ranking: Optional[list[str]] = None
    cards: Optional[list[SavedCard]] = None
    banks: Optional[list[SavedBank]] = None
    goals: Optional[list[SavedGoal]] = None
    loans: Optional[list[SavedLoan]] = None


# --- Wallet optimizer --------------------------------------------------------
# API shapes for the deterministic optimizer engine (src/services/optimizer_service).
# Response models mirror the engine's dataclasses field-for-field so routes can
# build them with dataclasses.asdict().


class OwnedCardInput(BaseModel):
    """A card the user holds, with the category they currently use it for."""

    card_id: str
    category: Optional[str] = None


class WalletOptimizeRequest(BaseModel):
    """Optimize a wallet for a given annual spend (keys are category slugs)."""

    spend: dict[str, float] = Field(default_factory=dict)
    card_ids: list[str] = Field(default_factory=list)


class EvaluateCardRequest(BaseModel):
    """"Should I get this card?" — current wallet + usage vs. a candidate."""

    spend: dict[str, float] = Field(default_factory=dict)
    owned: list[OwnedCardInput] = Field(default_factory=list)
    candidate_id: str


class CategoryBreakdownSchema(BaseModel):
    category: str
    label: str
    spend: float
    card_id: Optional[str] = None
    card_name: Optional[str] = None
    rate: str
    earned: float
    effective_pct: float


class WalletResultSchema(BaseModel):
    net_annual_value: float
    total_rewards: float
    total_fees: float
    effective_return_pct: float
    breakdown: list[CategoryBreakdownSchema] = Field(default_factory=list)


class ScenarioComparisonSchema(BaseModel):
    """Three scenarios (keep / reallocate / add) plus the verdict."""

    keep: WalletResultSchema
    reallocate: WalletResultSchema
    add: WalletResultSchema
    candidate_id: str
    candidate_name: str
    candidate_fee: float
    gain_from_reallocating: float
    gain_from_adding: float
    worth_it: bool
    verdict: str


class AdvisorRequest(BaseModel):
    """A what-if question plus the wallet context the advisor agent reasons over."""

    question: str = ""
    spend: dict[str, float] = Field(default_factory=dict)
    owned: list[OwnedCardInput] = Field(default_factory=list)
    candidate_id: Optional[str] = None
