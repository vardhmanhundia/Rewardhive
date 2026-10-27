"""User profiling long-term memory service.

Async CRUD over the ``user_memories`` table. This is the storage layer the
user-profiling agent reads from and writes to; it replaces the LangGraph
``PostgresStore`` from the reference sample with our own async SQLAlchemy +
asyncpg access (Alembic owns the schema).
"""

from typing import cast
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import UserMemory


class MemoryService:
    """Service for a user's long-term memories (user profiling LTM)."""

    @staticmethod
    async def list_memories(session: AsyncSession, user_id: UUID) -> list[UserMemory]:
        """Return all memories for a user, oldest first."""
        result = await session.execute(
            select(UserMemory).where(UserMemory.user_id == user_id).order_by(UserMemory.created_at)
        )
        return list(result.scalars().all())

    @staticmethod
    async def add_memory(
        session: AsyncSession,
        user_id: UUID,
        content: str,
    ) -> UserMemory:
        """Persist one atomic memory for a user."""
        memory = UserMemory(user_id=user_id, content=content.strip())
        session.add(memory)
        await session.flush()
        return memory

    @staticmethod
    async def delete_memory(
        session: AsyncSession,
        user_id: UUID,
        memory_id: UUID,
    ) -> bool:
        """Delete one memory, scoped to its owner. Returns True if a row was removed."""
        result = cast(
            CursorResult,
            await session.execute(
                delete(UserMemory).where(
                    UserMemory.id == memory_id,
                    UserMemory.user_id == user_id,
                )
            ),
        )
        return result.rowcount > 0

    @staticmethod
    async def clear_memories(session: AsyncSession, user_id: UUID) -> int:
        """Delete all memories for a user. Returns the number removed."""
        result = cast(
            CursorResult,
            await session.execute(delete(UserMemory).where(UserMemory.user_id == user_id)),
        )
        return result.rowcount
