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
    
    
        
