"""Conversation metadata for the recommend chat.

Each recommend-chat session is a row in ``conversations`` (user association +
title + timestamps); the transcript itself lives in the LangGraph checkpointer,
keyed by the conversation id. This service creates conversations, lists them for
the "pick up where you left off" tabs, and bumps one when a new turn lands.

The caller owns the transaction — these methods flush/update but never commit.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Conversation

# Longest first-question snippet kept as a conversation title.
_TITLE_MAX = 80


def _clip(text: str | None) -> str | None:
    """Trim and cap a title candidate; empty becomes None."""
    if not text:
        return None
    trimmed = text.strip()
    return trimmed[:_TITLE_MAX] if trimmed else None


class ConversationService:
    """CRUD-ish access to a user's recommend-chat conversations."""

    @staticmethod
    async def create(
        session: AsyncSession, user_id: UUID, title: str | None = None
    ) -> Conversation:
        """Create a new conversation for the user and flush to assign its id."""
        conversation = Conversation(user_id=user_id, title=_clip(title))
        session.add(conversation)
        await session.flush()  # populate id without ending the transaction
        return conversation

    @staticmethod
    async def list_for_user(session: AsyncSession, user_id: UUID) -> list[Conversation]:
        """Return the user's conversations, most recently updated first."""
        result = await session.execute(
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(Conversation.updated_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def get(
        session: AsyncSession, conversation_id: UUID, user_id: UUID
    ) -> Conversation | None:
        """Return the conversation if it exists and belongs to the user, else None."""
        result = await session.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def touch(
        session: AsyncSession, conversation_id: UUID, first_question: str | None = None
    ) -> None:
        """Bump ``updated_at`` for a conversation and set its title if still unset.

        Called once per persisted turn. The title is set from the first question
        only (``first_question`` on later turns is ignored because the title is
        already present). No-op if the conversation row is gone.
        """
        conversation = await session.get(Conversation, conversation_id)
        if conversation is None:
            return
        if not conversation.title and first_question:
            conversation.title = _clip(first_question)
        # onupdate fires only when a column changes, so set updated_at explicitly
        # to keep ordering correct even when the title didn't change.
        conversation.updated_at = datetime.utcnow()
