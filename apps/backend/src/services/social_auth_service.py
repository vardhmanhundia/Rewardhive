"""Social authentication service for OAuth providers (Facebook, Google, etc.)"""

import httpx
import os
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.db.models import User
from src.utils.password import hash_password


class SocialAuthService:
    """Service for handling OAuth authentication"""

    FACEBOOK_GRAPH_API_URL = "https://graph.facebook.com/v18.0"

    @staticmethod
    async def verify_facebook_token(access_token: str) -> dict | None:
        """
        Verify Facebook access token and get user info.

        Args:
            access_token: Facebook access token from client

        Returns:
            Dict with user info (id, email, first_name, last_name) or None if invalid
        """
        try:
            app_id = os.getenv("FACEBOOK_APP_ID")
            app_secret = os.getenv("FACEBOOK_APP_SECRET")

            if not app_id or not app_secret:
                return None

            async with httpx.AsyncClient() as client:
                # Verify token
                verify_response = await client.get(
                    f"{SocialAuthService.FACEBOOK_GRAPH_API_URL}/debug_token",
                    params={
                        "input_token": access_token,
                        "access_token": f"{app_id}|{app_secret}",
                    },
                )

                if verify_response.status_code != 200:
                    return None

                verify_data = verify_response.json()
                if not verify_data.get("data", {}).get("is_valid"):
                    return None

                facebook_user_id = verify_data.get("data", {}).get("user_id")
                if not facebook_user_id:
                    return None

                # Get user info
                user_response = await client.get(
                    f"{SocialAuthService.FACEBOOK_GRAPH_API_URL}/me",
                    params={
                        "fields": "id,email,first_name,last_name,picture",
                        "access_token": access_token,
                    },
                )

                if user_response.status_code != 200:
                    return None

                user_data = user_response.json()

                return {
                    "facebook_id": user_data.get("id"),
                    "email": user_data.get("email"),
                    "first_name": user_data.get("first_name", ""),
                    "last_name": user_data.get("last_name", ""),
                    "picture": user_data.get("picture", {}).get("data", {}).get("url"),
                }

        except Exception as e:
            print(f"Error verifying Facebook token: {e}")
            return None

    @staticmethod
    async def get_or_create_user_from_facebook(
        session: AsyncSession,
        facebook_data: dict,
    ) -> User | None:
        """
        Get existing user by Facebook ID or create new user from Facebook data.

        Args:
            session: Database session
            facebook_data: Dict from verify_facebook_token with user info

        Returns:
            User object or None if creation fails
        """
        if not facebook_data or not facebook_data.get("facebook_id"):
            return None

        facebook_id = facebook_data.get("facebook_id")
        email = facebook_data.get("email")
        first_name = facebook_data.get("first_name", "User")
        last_name = facebook_data.get("last_name", "")

        # Try to find existing user by facebook_id
        result = await session.execute(select(User).where(User.facebook_id == facebook_id))
        existing_user = result.scalar_one_or_none()

        if existing_user:
            return existing_user

        # If user has email, check if email already exists
        if email:
            result = await session.execute(select(User).where(User.email == email))
            email_user = result.scalar_one_or_none()
            if email_user:
                # User exists with same email, link Facebook ID
                email_user.facebook_id = facebook_id
                email_user.oauth_provider = "facebook"
                await session.flush()
                return email_user

        # Create new user
        try:
            # Generate a random password for social auth users (they won't use it)
            random_password = os.urandom(32).hex()
            password_hash = hash_password(random_password)

            new_user = User(
                email=email or f"facebook_{facebook_id}@example.com",
                first_name=first_name,
                last_name=last_name,
                password_hash=password_hash,
                facebook_id=facebook_id,
                oauth_provider="facebook",
                is_active=True,
            )
            session.add(new_user)
            await session.flush()
            return new_user

        except Exception as e:
            print(f"Error creating user from Facebook: {e}")
            await session.rollback()
            return None

    @staticmethod
    async def get_user_by_facebook_id(session: AsyncSession, facebook_id: str) -> User | None:
        """Get user by Facebook ID."""
        result = await session.execute(select(User).where(User.facebook_id == facebook_id))
        return result.scalar_one_or_none()
