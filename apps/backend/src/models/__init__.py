"""Pydantic schemas for request/response validation"""

from pydantic import BaseModel, EmailStr, Field, model_validator
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

# Enum-style option sets. Kept here so the API documents the allowed values in
# OpenAPI; "other" lets the UI offer a free-text fallback where listed.
RelationshipStatus = Literal[
    "single", "relationship", "living_together", "engaged",
    "married", "married_with_kids", "divorced", "widowed", "other",
]
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


class FacebookTokenRequest(BaseModel):
    access_token: str = Field(..., min_length=1)


class FacebookLoginRequest(BaseModel):
    access_token: str = Field(..., min_length=1)
    email: Optional[EmailStr] = None
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)


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
    structured data (cards, picks, intent) so a reloaded conversation shows
    the same visuals it did live; user turns have none."""

    role: str = Field(..., pattern="^(user|assistant)$")
    content: str
    cards: list[CardProductSchema] = Field(default_factory=list)
    picks: list[dict] = Field(default_factory=list)
    intent: str | None = None
    spend_baseline: dict[str, float] | None = None


class ChatHistoryResponse(BaseModel):
    messages: list[ChatHistoryMessage]


class ConversationSummary(BaseModel):
    """One recommend-chat conversation for the 'pick up where you left off' tabs."""

    id: UUID
    title: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    is_shared: bool = False
    shared_by_me: bool = False
    owner_email: Optional[str] = None


class ConversationListResponse(BaseModel):
    conversations: list[ConversationSummary]


class ShareConversationRequest(BaseModel):
    """Share a conversation with one or more users by email."""

    emails: list[str] = Field(..., min_length=1)


class ShareConversationResponse(BaseModel):
    """Outcome of a share, split by what happened to each address.

    - ``shared_with``: existing users given access (in-app + email notification).
    - ``invited_new``: non-registered addresses emailed a sign-up invitation.
    - ``not_found``: non-registered addresses whose invite email failed to send.
    """

    shared_with: list[str]
    invited_new: list[str] = []
    not_found: list[str]


class ConversationShareInfo(BaseModel):
    """Info about a shared conversation — drives the banner and join flow."""

    conversation_id: UUID
    title: Optional[str] = None
    owner_name: str
    is_mine: bool
    already_added: bool
    invite_status: Optional[str] = None


class ConversationMember(BaseModel):
    user_id: str
    email: str
    name: str
    role: str
    status: str


class ConversationMembersResponse(BaseModel):
    members: list[ConversationMember]


class MemberActionRequest(BaseModel):
    target_user_id: UUID


class NotificationSchema(BaseModel):
    id: UUID
    type: str
    title: str
    body: Optional[str] = None
    conversation_id: Optional[UUID] = None
    actor_user_id: Optional[UUID] = None
    is_read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    notifications: list[NotificationSchema]
    unread_count: int


class ProfileSummaryResponse(BaseModel):
    """What the assistant has learned about a user — the long-term profile
    memories surfaced on the home/summary page."""

    memories: list[UserMemorySchema]


class RecommendationRequest(BaseModel):
    """A recommendation ask. The query is blended with the user's stored
    profile preferences on the server; history gives prior turns for context."""

    query: str = Field(..., min_length=1)
    history: list[ProfilingTurnMessage] = Field(default_factory=list)
    # The conversation (session) this turn belongs to. Omitted for a fresh
    # session — the server creates a conversation and returns its id.
    conversation_id: Optional[UUID] = None


class ProfileConflictInfo(BaseModel):
    """A single-value profile field whose newly-mentioned value differs from the
    stored one and the user has not confirmed. Surfaced as a marker so the user
    can reconcile it directly on the profile page rather than mid-chat."""

    field: str
    label: str
    stored: str
    mentioned: str


class FollowUpPrompt(BaseModel):
    """A frontend-driven follow-up the chat offers after an agent turn.

    ``action`` is "offer_evaluate" (run the Card Evaluator on a chosen card) or
    "offer_add" (add a card to the wallet; the UI confirms "did you buy it?"
    before calling the add-card endpoint). ``card_ids`` are the cards the offer
    applies to."""

    action: str
    card_ids: list[str] = Field(default_factory=list)


class RecommendationResponse(BaseModel):
    """Non-streaming recommendation: Muse's prose, the cards it drew on, any
    memories captured this turn, three follow-up suggestions, a marker for any
    unconfirmed profile conflicts to reconcile on the profile page, which agent
    the router picked, and any follow-up prompts."""

    answer: str
    cards: list[CardProductSchema]
    new_memories: list[str]
    suggestions: list[str]
    conflicts: list[ProfileConflictInfo] = Field(default_factory=list)
    intent: str = "new_card"
    prompts: list[FollowUpPrompt] = Field(default_factory=list)


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
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    relationship_status: Optional[RelationshipStatus] = None
    family_size: Optional[int] = None
    city: Optional[str] = None
    location_state: Optional[str] = None
    location_country: Optional[str] = None
    household: Optional[Household] = None
    car: Optional[CarStatus] = None
    travel_preference: Optional[TravelPreference] = None
    us_status: Optional[USStatus] = None
    us_status_detail: Optional[str] = None
    # Ordered airline preference, most preferred first.
    airline_ranking: list[str] = Field(default_factory=list)
    # Ordered hotel preference, most preferred first.
    hotel_ranking: list[str] = Field(default_factory=list)
    # Ordered shopping preferences, most preferred first.
    online_shopping_ranking: list[str] = Field(default_factory=list)
    offline_shopping_ranking: list[str] = Field(default_factory=list)
    cards: list[SavedCard] = Field(default_factory=list)
    banks: list[SavedBank] = Field(default_factory=list)
    goals: list[SavedGoal] = Field(default_factory=list)
    loans: list[SavedLoan] = Field(default_factory=list)

    class Config:
        from_attributes = True


class AddCardRequest(BaseModel):
    """Add a single card to the user's wallet from chat.

    Identify the card by catalog ``card_id`` or by free-text ``name`` with
    ``custom=True``. ``category`` is the spend bucket it's used for (defaults to
    everyday). Confirmed by the UI ("did you finally buy it?") before this call.
    """

    card_id: Optional[str] = None
    name: Optional[str] = None
    category: str = "everyday"
    custom: bool = False

    @model_validator(mode="after")
    def _require_identifier(self) -> "AddCardRequest":
        if not self.card_id and not self.name:
            raise ValueError("either card_id or name is required")
        return self


class UserProfileUpdate(BaseModel):
    """Partial-update payload. Only provided fields are written."""

    occupation: Optional[str] = Field(None, max_length=200)
    company: Optional[str] = Field(None, max_length=200)
    date_of_birth: Optional[str] = Field(None, max_length=10)
    gender: Optional[str] = Field(None, max_length=50)
    relationship_status: Optional[RelationshipStatus] = None
    family_size: Optional[int] = Field(None, ge=0, le=50)
    city: Optional[str] = Field(None, max_length=200)
    location_state: Optional[str] = Field(None, max_length=100)
    location_country: Optional[str] = Field(None, max_length=100)
    household: Optional[Household] = None
    car: Optional[CarStatus] = None
    travel_preference: Optional[TravelPreference] = None
    us_status: Optional[USStatus] = None
    us_status_detail: Optional[str] = Field(None, max_length=100)
    airline_ranking: Optional[list[str]] = None
    hotel_ranking: Optional[list[str]] = None
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


# --- Which card should I use? ------------------------------------------------
# The rewards advisor: "which of my cards earns most on this purchase?"


class BestCardRequest(BaseModel):
    """A which-card question. `card_ids` scopes the candidates (e.g. the two cards
    the user named to compare); when empty, the server uses the user's saved cards.
    `monthly_amount` is optional and only adds a $/yr estimate to the answer."""

    question: str = Field(..., min_length=1)
    card_ids: list[str] = Field(default_factory=list)
    monthly_amount: Optional[float] = Field(None, ge=0)


class CardRewardPickSchema(BaseModel):
    """One card's best earn on the purchase (mirrors the engine's CardRewardPick)."""

    card_id: str
    card_name: str
    issuer: str
    reward_label: str
    rate: str
    effective_pct: float
    est_annual_value: Optional[float] = None
    specific: bool


class RewardResultSchema(BaseModel):
    """The resolved purchase plus the ranked cards, best first."""

    category: Optional[str] = None
    merchant: Optional[str] = None
    note: str = ""
    picks: list[CardRewardPickSchema] = Field(default_factory=list)


# --- Instagram Posts & News ---------------------------------------------------


class InstagramPostSchema(BaseModel):
    """An Instagram post related to a card."""

    id: UUID
    card_id: UUID
    instagram_post_id: str
    url: str
    caption: Optional[str] = None
    image_url: Optional[str] = None
    likes: int
    engagement_score: float
    hashtags: list[str] = Field(default_factory=list)
    posted_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class InstagramPostCreateRequest(BaseModel):
    """Request to create/store an Instagram post."""

    instagram_post_id: str
    url: str
    caption: Optional[str] = None
    image_url: Optional[str] = None
    likes: int = 0
    engagement_score: float = 0.0
    hashtags: list[str] = Field(default_factory=list)
    posted_at: Optional[datetime] = None


class CardNewsKeywordSchema(BaseModel):
    """A news keyword for a card."""

    id: UUID
    card_id: UUID
    keyword: str
    last_searched: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CardNewsKeywordCreateRequest(BaseModel):
    """Request to create/store a news keyword."""

    keyword: str = Field(..., min_length=1, max_length=255)


class InstagramPostListResponse(BaseModel):
    """List of Instagram posts."""

    posts: list[InstagramPostSchema]


class CardNewsKeywordListResponse(BaseModel):
    """List of news keywords for a card."""

    keywords: list[CardNewsKeywordSchema]
