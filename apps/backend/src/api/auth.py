"""Authentication endpoints"""

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.database import get_db
from src.models import (
    UserSignupRequest,
    UserLoginRequest,
    UserLoginResponse,
    UserProfileResponse,
    FacebookLoginRequest,
)
from src.services.user_service import UserService
from src.services.social_auth_service import SocialAuthService
from src.utils.jwt_handler import create_access_token
from src.utils.redis_session import session_manager
from src.middleware.auth import verify_user_auth, get_current_user_id

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=UserLoginResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    request: UserSignupRequest,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """
    Register a new user.

    Args:
        request: User signup data
        session: Database session

    Returns:
        Access token and user profile
    """
    # Check if user already exists
    existing_user = await UserService.get_user_by_email(session, request.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )

    # Create new user
    try:
        user = await UserService.create_user(
            session,
            email=request.email,
            first_name=request.first_name,
            last_name=request.last_name,
            password=request.password,
        )
        await session.commit()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    # Generate token and store in Redis
    token = create_access_token(user.id, user.email)
    session_manager.store_token(token, user.id, user.email)

    user_schema = UserService.to_schema(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_schema,
    }


@router.post("/login", response_model=UserLoginResponse)
async def login(
    request: UserLoginRequest,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """
    Login with email and password.

    Args:
        request: Login credentials
        session: Database session

    Returns:
        Access token and user profile
    """
    # Verify credentials
    user = await UserService.verify_password(session, request.email, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    # Generate token and store in Redis
    token = create_access_token(user.id, user.email)
    session_manager.store_token(token, user.id, user.email)

    user_schema = UserService.to_schema(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_schema,
    }


@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """
    Get current user profile.

    Requires:
        Authorization header with Bearer token

    Returns:
        User profile information
    """
    user_id = get_current_user_id(payload)
    user = await UserService.get_user_by_id(session, user_id)

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "created_at": user.created_at,
        "is_active": user.is_active,
    }


@router.post("/logout")
def logout(
    payload: dict = Depends(verify_user_auth),
) -> dict:
    """
    Logout current user by revoking token.

    Requires:
        Authorization header with Bearer token

    Returns:
        Confirmation message
    """
    user_id = get_current_user_id(payload)

    # Revoke all user tokens for logout
    session_manager.revoke_all_user_tokens(user_id)

    return {
        "message": "Successfully logged out",
        "status": "ok",
    }


@router.post("/facebook/login", response_model=UserLoginResponse, status_code=status.HTTP_201_CREATED)
async def facebook_login(
    request: FacebookLoginRequest,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """
    Login or signup with Facebook.

    Args:
        request: Facebook access token and user info
        session: Database session

    Returns:
        Access token and user profile
    """
    # Verify Facebook token
    facebook_data = await SocialAuthService.verify_facebook_token(request.access_token)
    if not facebook_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Facebook token",
        )

    facebook_id = facebook_data.get("facebook_id")

    # Try to find existing user by Facebook ID
    user = await UserService.get_user_by_facebook_id(session, facebook_id)

    if not user:
        # Check if user exists by email (if provided)
        if request.email:
            user = await UserService.get_user_by_email(session, request.email)
            if user:
                # Link Facebook ID to existing user
                user.facebook_id = facebook_id
                user.oauth_provider = "facebook"
                await session.flush()
            else:
                # Create new user
                try:
                    user = await UserService.create_user(
                        session,
                        email=request.email,
                        first_name=request.first_name,
                        last_name=request.last_name,
                        facebook_id=facebook_id,
                        oauth_provider="facebook",
                    )
                    await session.commit()
                except ValueError as e:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=str(e),
                    )
        else:
            # Create new user without email
            try:
                user = await UserService.create_user(
                    session,
                    email=f"facebook_{facebook_id}@example.com",
                    first_name=request.first_name,
                    last_name=request.last_name,
                    facebook_id=facebook_id,
                    oauth_provider="facebook",
                )
                await session.commit()
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=str(e),
                )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    # Generate token and store in Redis
    token = create_access_token(user.id, user.email)
    session_manager.store_token(token, user.id, user.email)

    user_schema = UserService.to_schema(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_schema,
    }
