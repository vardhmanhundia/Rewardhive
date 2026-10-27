"""User service for handling user CRUD operations"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User
from src.models import UserSchema
from src.utils.password import hash_password, verify_password


class UserService:
    """Service for user management operations"""

    @staticmethod
    async def create_user(
        session: AsyncSession,
        email: str,
        first_name: str,
        last_name: str,
        password: str,
    ) -> User:
        """Create a new user. Raises ValueError if the email already exists."""
        try:
            user = User(
                email=email,
                first_name=first_name,
                last_name=last_name,
                password_hash=hash_password(password),
                is_active=True,
            )
            session.add(user)
            await session.flush()
            return user
        except IntegrityError:
            await session.rollback()
            raise ValueError(f"User with email {email} already exists")

    @staticmethod
    async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
        """Get user by email."""
        result = await session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_by_id(session: AsyncSession, user_id: UUID) -> User | None:
        """Get user by ID."""
        result = await session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def verify_password(
        session: AsyncSession,
        email: str,
        password: str,
    ) -> User | None:
        """Verify user credentials, returning the user when valid."""
        user = await UserService.get_user_by_email(session, email)
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    @staticmethod
    async def update_user(
        session: AsyncSession,
        user_id: UUID,
        **kwargs,
    ) -> User | None:
        """Update user fields."""
        user = await UserService.get_user_by_id(session, user_id)
        if not user:
            return None

        if "password" in kwargs:
            kwargs["password_hash"] = hash_password(kwargs.pop("password"))

        for key, value in kwargs.items():
            if hasattr(user, key):
                setattr(user, key, value)

        await session.flush()
        return user

    @staticmethod
    async def delete_user(session: AsyncSession, user_id: UUID) -> bool:
        """Soft-delete a user by setting is_active=False."""
        user = await UserService.get_user_by_id(session, user_id)
        if not user:
            return False
        user.is_active = False
        await session.flush()
        return True

    @staticmethod
    def to_schema(user: User) -> UserSchema:
        """Convert User ORM object to Pydantic schema."""
        return UserSchema(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            created_at=user.created_at,
            updated_at=user.updated_at,
            is_active=user.is_active,
        )
