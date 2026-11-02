"""Extended user profile endpoints.

Separate from /auth/profile (which returns the core auth identity): these manage
the user-editable lifestyle/financial details stored in `user_profiles`.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_db
from src.middleware.auth import get_current_user_id, verify_user_auth
from src.models import AddCardRequest, SavedCard, UserProfileDetails, UserProfileUpdate
from src.services.user_service import UserService

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/details", response_model=UserProfileDetails)
async def get_profile_details(
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> UserProfileDetails:
    """Return the current user's extended profile (empty defaults on first use)."""
    user_id = get_current_user_id(payload)
    profile = await UserService.get_profile_details(session, user_id)
    await session.commit()
    return UserProfileDetails.model_validate(profile)


@router.put("/details", response_model=UserProfileDetails)
async def update_profile_details(
    data: UserProfileUpdate,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> UserProfileDetails:
    """Update the current user's extended profile. Only provided fields change."""
    user_id = get_current_user_id(payload)
    profile = await UserService.upsert_profile(session, user_id, data)
    await session.commit()
    return UserProfileDetails.model_validate(profile)


@router.post("/cards/add", response_model=UserProfileDetails)
async def add_card(
    request: AddCardRequest,
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> UserProfileDetails:
    """Add a single card to the user's wallet (the chat "did you buy it?" confirm).

    Idempotent: adding a card already saved is a no-op. Returns the full profile.
    """
    user_id = get_current_user_id(payload)
    card = SavedCard(
        card_id=request.card_id,
        name=request.name,
        category=request.category,
        custom=request.custom,
    )
    profile = await UserService.add_card_to_profile(session, user_id, card)
    await session.commit()
    return UserProfileDetails.model_validate(profile)
