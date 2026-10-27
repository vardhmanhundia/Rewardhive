"""Redis session management for JWT tokens"""
import json
from datetime import datetime, timedelta
from typing import Any, Optional
from uuid import UUID
import redis

from src.config import settings

REDIS_URL = settings.REDIS_URL
TOKEN_EXPIRY_DAYS = 30


class RedisSessionManager:
    """Manages JWT token storage and validation in Redis"""

    def __init__(self, redis_url: str = REDIS_URL):
        self.redis_client: Optional[redis.Redis] = None
        self.in_memory_store: dict[str, Any] = {}
        try:
            # Parse redis URL and create connection
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            # Test connection
            self.redis_client.ping()
        except Exception as e:
            # Fall back to in-memory dict if Redis unavailable
            print(f"Redis connection failed: {e}. Using in-memory storage.")
            self.redis_client = None

    def store_token(
        self, token: str, user_id: UUID, email: str
    ) -> bool:
        """
        Store JWT token in Redis with 30-day expiration.

        Args:
            token: JWT token
            user_id: UUID of user
            email: Email of user

        Returns:
            True if stored successfully
        """
        try:
            key = f"session:{user_id}:{token[:20]}"
            value = json.dumps({
                "token": token,
                "user_id": str(user_id),
                "email": email,
                "created_at": datetime.utcnow().isoformat(),
            })
            expiry = timedelta(days=TOKEN_EXPIRY_DAYS)

            if self.redis_client:
                self.redis_client.setex(
                    key,
                    int(expiry.total_seconds()),
                    value,
                )
            else:
                self.in_memory_store[key] = {
                    "value": value,
                    "expiry": datetime.utcnow() + expiry,
                }
            return True
        except Exception as e:
            print(f"Failed to store token: {e}")
            return False

    def get_token(self, token: str, user_id: UUID) -> Optional[dict]:
        """
        Retrieve token data from Redis.

        Args:
            token: JWT token
            user_id: UUID of user

        Returns:
            Token data dict or None if not found/expired
        """
        try:
            key = f"session:{user_id}:{token[:20]}"

            if self.redis_client:
                data = self.redis_client.get(key)
            else:
                if key in self.in_memory_store:
                    if self.in_memory_store[key]["expiry"] > datetime.utcnow():
                        data = self.in_memory_store[key]["value"]
                    else:
                        del self.in_memory_store[key]
                        data = None
                else:
                    data = None

            if data:
                return json.loads(data)
            return None
        except Exception as e:
            print(f"Failed to get token: {e}")
            return None

    def revoke_token(self, token: str, user_id: UUID) -> bool:
        """
        Revoke a token by deleting it from Redis.

        Args:
            token: JWT token
            user_id: UUID of user

        Returns:
            True if revoked successfully
        """
        try:
            key = f"session:{user_id}:{token[:20]}"

            if self.redis_client:
                self.redis_client.delete(key)
            else:
                if key in self.in_memory_store:
                    del self.in_memory_store[key]

            return True
        except Exception as e:
            print(f"Failed to revoke token: {e}")
            return False

    def revoke_all_user_tokens(self, user_id: UUID) -> bool:
        """
        Revoke all tokens for a user (e.g., on password change).

        Args:
            user_id: UUID of user

        Returns:
            True if all tokens revoked successfully
        """
        try:
            pattern = f"session:{user_id}:*"

            if self.redis_client:
                keys = self.redis_client.keys(pattern)
                if keys:
                    self.redis_client.delete(*keys)
            else:
                keys_to_delete = [k for k in self.in_memory_store if k.startswith(f"session:{user_id}:")]
                for key in keys_to_delete:
                    del self.in_memory_store[key]

            return True
        except Exception as e:
            print(f"Failed to revoke all tokens: {e}")
            return False


# Global session manager instance
session_manager = RedisSessionManager()
