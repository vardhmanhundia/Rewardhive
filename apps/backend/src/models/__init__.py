"""Pydantic schemas for request/response validation"""
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from uuid import UUID


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
    
    
        
