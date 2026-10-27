"""Authentication middleware for protected routes"""

from fastapi import HTTPException, status, Request
from uuid import UUID
from src.utils.jwt_handler import verify_token, extract_token_from_header
from src.utils.redis_session import session_manager


async def verify_user_auth(request: Request) -> dict:
    """
    Middleware to verify JWT token from Authorization header.

    Args:
        request: FastAPI request object

    Returns:
        Decoded token payload with user_id and email

    Raises:
        HTTPException: If token is missing, invalid, or expired
    """
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = extract_token_from_header(auth_header)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify token exists in Redis (not revoked)
    user_id = UUID(payload.get("sub"))
    session_data = session_manager.get_token(token, user_id)
    if not session_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked or is invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


def get_current_user_id(payload: dict) -> UUID:
    """Extract user ID from token payload."""
    try:
        return UUID(payload.get("sub"))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
