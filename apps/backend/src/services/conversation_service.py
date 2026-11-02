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

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Conversation, ConversationShare, Notification, User
from src.services.email_service import EmailService

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
    async def get_by_id(
        session: AsyncSession, conversation_id: UUID
    ) -> Conversation | None:
        """Return the conversation by id regardless of owner (for shared access)."""
        result = await session.execute(
            select(Conversation).where(Conversation.id == conversation_id)
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

    # ── Sharing ──────────────────────────────────────────────────────

    @staticmethod
    async def share_with_emails(
        session: AsyncSession,
        conversation_id: UUID,
        shared_by_user_id: UUID,
        emails: list[str],
    ) -> tuple[list[str], list[str], list[str]]:
        """Share a conversation with people by email, tailored to the recipient.

        - Existing users get a pending share, an in-app notification, and an
          email notification linking straight to the conversation.
        - Addresses with no account get an invitation email that also prompts
          them to sign up; the share-link flow lets them join once registered.

        Returns ``(shared_with, invited_new, not_found)``:
        - ``shared_with`` — existing users the conversation was shared with.
        - ``invited_new`` — non-registered addresses the sign-up invite reached.
        - ``not_found`` — non-registered addresses whose invite email failed to
          send (always empty in email fake mode).
        """
        inviter = await session.get(User, shared_by_user_id)
        inviter_name = f"{inviter.first_name} {inviter.last_name}" if inviter else "Someone"
        conversation = await session.get(Conversation, conversation_id)
        conv_title = conversation.title or "Untitled conversation" if conversation else "a conversation"

        shared_with: list[str] = []
        invited_new: list[str] = []
        not_found: list[str] = []
        for raw_email in emails:
            email = raw_email.strip().lower()
            if not email:
                continue
            result = await session.execute(
                select(User).where(User.email == email)
            )
            user = result.scalar_one_or_none()
            if user is None:
                # Not a member yet: invite them and nudge them to sign up.
                sent = await EmailService.send_signup_invite(
                    to=email,
                    inviter_name=inviter_name,
                    conversation_title=conv_title,
                    conversation_id=conversation_id,
                )
                (invited_new if sent else not_found).append(email)
                continue
            if user.id == shared_by_user_id:
                continue
            # Check for existing share
            existing = await session.execute(
                select(ConversationShare).where(
                    and_(
                        ConversationShare.conversation_id == conversation_id,
                        ConversationShare.shared_with_user_id == user.id,
                    )
                )
            )
            if existing.scalar_one_or_none() is not None:
                # Already shared — don't duplicate the share, notification or email.
                shared_with.append(email)
                continue
            share = ConversationShare(
                conversation_id=conversation_id,
                shared_by_user_id=shared_by_user_id,
                shared_with_user_id=user.id,
                status="pending",
                role="member",
            )
            session.add(share)
            # Notify the invitee in-app…
            notification = Notification(
                user_id=user.id,
                type="invite",
                title=f"{inviter_name} invited you to a conversation",
                body=f'"{conv_title}"',
                conversation_id=conversation_id,
                actor_user_id=shared_by_user_id,
            )
            session.add(notification)
            # …and by email. Best effort: the in-app share stands regardless.
            await EmailService.send_share_notification(
                to=email,
                inviter_name=inviter_name,
                conversation_title=conv_title,
                conversation_id=conversation_id,
            )
            shared_with.append(email)
        await session.flush()
        return shared_with, invited_new, not_found

    @staticmethod
    async def accept_invite(
        session: AsyncSession, conversation_id: UUID, user_id: UUID
    ) -> bool:
        """Accept a pending invite. Notifies the conversation owner."""
        result = await session.execute(
            select(ConversationShare).where(
                and_(
                    ConversationShare.conversation_id == conversation_id,
                    ConversationShare.shared_with_user_id == user_id,
                    ConversationShare.status == "pending",
                )
            )
        )
        share = result.scalar_one_or_none()
        if share is None:
            return False
        share.status = "accepted"

        # Notify conversation owner + other accepted owners
        acceptor = await session.get(User, user_id)
        acceptor_name = f"{acceptor.first_name} {acceptor.last_name}" if acceptor else "Someone"
        conversation = await session.get(Conversation, conversation_id)
        if conversation is None:
            return False
        conv_title = conversation.title or "Untitled conversation"
        owner_ids = await ConversationService._get_owner_ids(session, conversation)
        for oid in owner_ids:
            if oid == user_id:
                continue
            notif = Notification(
                user_id=oid,
                type="joined",
                title=f"{acceptor_name} joined your conversation",
                body=f'"{conv_title}"',
                conversation_id=conversation_id,
                actor_user_id=user_id,
            )
            session.add(notif)
        await session.flush()
        return True

    @staticmethod
    async def decline_invite(
        session: AsyncSession, conversation_id: UUID, user_id: UUID
    ) -> bool:
        """Decline a pending invite — removes the share row."""
        result = await session.execute(
            select(ConversationShare).where(
                and_(
                    ConversationShare.conversation_id == conversation_id,
                    ConversationShare.shared_with_user_id == user_id,
                    ConversationShare.status == "pending",
                )
            )
        )
        share = result.scalar_one_or_none()
        if share is None:
            return False
        await session.delete(share)
        await session.flush()
        return True

    @staticmethod
    async def add_via_link(
        session: AsyncSession, conversation_id: UUID, user_id: UUID
    ) -> bool:
        """Self-join via a share link. Creates an accepted share + notifies owner."""
        conversation = await session.get(Conversation, conversation_id)
        if conversation is None:
            return False
        if conversation.user_id == user_id:
            return True
        existing = await session.execute(
            select(ConversationShare).where(
                and_(
                    ConversationShare.conversation_id == conversation_id,
                    ConversationShare.shared_with_user_id == user_id,
                )
            )
        )
        if existing.scalar_one_or_none() is not None:
            return True
        share = ConversationShare(
            conversation_id=conversation_id,
            shared_by_user_id=conversation.user_id,
            shared_with_user_id=user_id,
            status="accepted",
            role="member",
        )
        session.add(share)

        # Notify owners
        joiner = await session.get(User, user_id)
        joiner_name = f"{joiner.first_name} {joiner.last_name}" if joiner else "Someone"
        conv_title = conversation.title or "Untitled conversation"
        owner_ids = await ConversationService._get_owner_ids(session, conversation)
        for oid in owner_ids:
            if oid == user_id:
                continue
            notif = Notification(
                user_id=oid,
                type="joined",
                title=f"{joiner_name} joined via link",
                body=f'"{conv_title}"',
                conversation_id=conversation_id,
                actor_user_id=user_id,
            )
            session.add(notif)
        await session.flush()
        return True

    @staticmethod
    async def list_shared_with_user(
        session: AsyncSession, user_id: UUID
    ) -> list[Conversation]:
        """Return conversations shared with (and accepted by) this user."""
        result = await session.execute(
            select(Conversation)
            .join(
                ConversationShare,
                ConversationShare.conversation_id == Conversation.id,
            )
            .where(
                and_(
                    ConversationShare.shared_with_user_id == user_id,
                    ConversationShare.status == "accepted",
                )
            )
            .order_by(Conversation.updated_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def list_ids_shared_by_user(
        session: AsyncSession, user_id: UUID
    ) -> set[UUID]:
        """Return ids of the user's own conversations that they've shared out.

        A conversation counts as shared once it has any share row (invited,
        pending or accepted) — it drives the "Shared plans" panel so the owner
        sees chats they're collaborating on, not just ones shared with them.
        """
        result = await session.execute(
            select(ConversationShare.conversation_id)
            .join(
                Conversation,
                Conversation.id == ConversationShare.conversation_id,
            )
            .where(Conversation.user_id == user_id)
        )
        return {row[0] for row in result.all()}

    @staticmethod
    async def is_shared_with(
        session: AsyncSession, conversation_id: UUID, user_id: UUID
    ) -> bool:
        result = await session.execute(
            select(ConversationShare).where(
                and_(
                    ConversationShare.conversation_id == conversation_id,
                    ConversationShare.shared_with_user_id == user_id,
                )
            )
        )
        return result.scalar_one_or_none() is not None

    @staticmethod
    async def get_share_status(
        session: AsyncSession, conversation_id: UUID, user_id: UUID
    ) -> str | None:
        """Return the share status for a user, or None if no share exists."""
        result = await session.execute(
            select(ConversationShare.status).where(
                and_(
                    ConversationShare.conversation_id == conversation_id,
                    ConversationShare.shared_with_user_id == user_id,
                )
            )
        )
        row = result.first()
        return row[0] if row else None

    # ── Member management ─────────────────────────────────────────

    @staticmethod
    async def list_members(
        session: AsyncSession, conversation_id: UUID
    ) -> list[dict]:
        """Return all members of a conversation (owner + accepted shares)."""
        conversation = await session.get(Conversation, conversation_id)
        if conversation is None:
            return []
        owner = await session.get(User, conversation.user_id)
        members: list[dict] = []
        if owner:
            members.append({
                "user_id": str(owner.id),
                "email": owner.email,
                "name": f"{owner.first_name} {owner.last_name}",
                "role": "owner",
                "status": "accepted",
            })
        result = await session.execute(
            select(ConversationShare, User).join(
                User, User.id == ConversationShare.shared_with_user_id
            ).where(ConversationShare.conversation_id == conversation_id)
        )
        for share, user in result.all():
            members.append({
                "user_id": str(user.id),
                "email": user.email,
                "name": f"{user.first_name} {user.last_name}",
                "role": share.role,
                "status": share.status,
            })
        return members

    @staticmethod
    async def remove_member(
        session: AsyncSession,
        conversation_id: UUID,
        requester_id: UUID,
        target_user_id: UUID,
    ) -> bool:
        """Remove a member. Requester must be an owner."""
        if not await ConversationService._is_owner(session, conversation_id, requester_id):
            return False
        result = await session.execute(
            select(ConversationShare).where(
                and_(
                    ConversationShare.conversation_id == conversation_id,
                    ConversationShare.shared_with_user_id == target_user_id,
                )
            )
        )
        share = result.scalar_one_or_none()
        if share is None:
            return False
        await session.delete(share)
        await session.flush()
        return True

    @staticmethod
    async def promote_to_owner(
        session: AsyncSession,
        conversation_id: UUID,
        requester_id: UUID,
        target_user_id: UUID,
    ) -> bool:
        """Promote a member to owner. Requester must be an owner."""
        if not await ConversationService._is_owner(session, conversation_id, requester_id):
            return False
        result = await session.execute(
            select(ConversationShare).where(
                and_(
                    ConversationShare.conversation_id == conversation_id,
                    ConversationShare.shared_with_user_id == target_user_id,
                    ConversationShare.status == "accepted",
                )
            )
        )
        share = result.scalar_one_or_none()
        if share is None:
            return False
        share.role = "owner"
        await session.flush()
        return True

    # ── Notifications ─────────────────────────────────────────────

    @staticmethod
    async def list_notifications(
        session: AsyncSession, user_id: UUID
    ) -> list[Notification]:
        result = await session.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(50)
        )
        return list(result.scalars().all())

    @staticmethod
    async def unread_count(session: AsyncSession, user_id: UUID) -> int:
        from sqlalchemy import func

        result = await session.execute(
            select(func.count()).where(
                and_(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
            )
        )
        return result.scalar() or 0

    @staticmethod
    async def mark_read(
        session: AsyncSession, notification_id: UUID, user_id: UUID
    ) -> bool:
        result = await session.execute(
            select(Notification).where(
                and_(Notification.id == notification_id, Notification.user_id == user_id)
            )
        )
        notif = result.scalar_one_or_none()
        if notif is None:
            return False
        notif.is_read = True
        await session.flush()
        return True

    @staticmethod
    async def mark_all_read(session: AsyncSession, user_id: UUID) -> None:
        from sqlalchemy import update

        await session.execute(
            update(Notification)
            .where(and_(Notification.user_id == user_id, Notification.is_read == False))  # noqa: E712
            .values(is_read=True)
        )
        await session.flush()

    # ── Helpers ────────────────────────────────────────────────────

    @staticmethod
    async def _is_owner(
        session: AsyncSession, conversation_id: UUID, user_id: UUID
    ) -> bool:
        """True if user is the conversation creator or a promoted owner."""
        conversation = await session.get(Conversation, conversation_id)
        if conversation is None:
            return False
        if conversation.user_id == user_id:
            return True
        result = await session.execute(
            select(ConversationShare).where(
                and_(
                    ConversationShare.conversation_id == conversation_id,
                    ConversationShare.shared_with_user_id == user_id,
                    ConversationShare.role == "owner",
                    ConversationShare.status == "accepted",
                )
            )
        )
        return result.scalar_one_or_none() is not None

    @staticmethod
    async def _get_owner_ids(
        session: AsyncSession, conversation: Conversation
    ) -> list[UUID]:
        """Return user ids of all owners (creator + promoted)."""
        ids = [conversation.user_id]
        result = await session.execute(
            select(ConversationShare.shared_with_user_id).where(
                and_(
                    ConversationShare.conversation_id == conversation.id,
                    ConversationShare.role == "owner",
                    ConversationShare.status == "accepted",
                )
            )
        )
        ids.extend(row[0] for row in result.all())
        return ids
