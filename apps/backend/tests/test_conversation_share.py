"""Tests for conversation sharing — the share-button invite flow.

Existing users get an in-app share plus an email notification; addresses with
no account get a sign-up invitation email instead. These exercise the service
directly against the test database and capture which email each recipient got.
"""

import uuid

import pytest

from src.db.models import Conversation, ConversationShare, Notification, User
from src.services import conversation_service as conv_module
from src.services.conversation_service import ConversationService


@pytest.fixture
def capture_emails(monkeypatch):
    """Record which email each recipient got instead of sending."""
    sent: dict[str, list[dict]] = {"share": [], "signup": []}

    async def fake_share(*, to, inviter_name, conversation_title, conversation_id):
        sent["share"].append({"to": to, "inviter_name": inviter_name})
        return True

    async def fake_signup(*, to, inviter_name, conversation_title, conversation_id):
        sent["signup"].append({"to": to, "inviter_name": inviter_name})
        return True

    monkeypatch.setattr(conv_module.EmailService, "send_share_notification", fake_share)
    monkeypatch.setattr(conv_module.EmailService, "send_signup_invite", fake_signup)
    return sent


async def _make_user(session, email: str) -> User:
    user = User(email=email, first_name="A", last_name="B")
    session.add(user)
    await session.flush()
    return user


@pytest.mark.asyncio
async def test_existing_user_shared_and_emailed(test_db, capture_emails):
    async with test_db() as session:
        owner = await _make_user(session, "owner@example.com")
        member = await _make_user(session, "member@example.com")
        conv = Conversation(user_id=owner.id, title="Best travel card")
        session.add(conv)
        await session.flush()

        shared, invited, not_found = await ConversationService.share_with_emails(
            session, conv.id, owner.id, ["member@example.com"]
        )
        await session.commit()

        assert shared == ["member@example.com"]
        assert invited == []
        assert not_found == []
        # A pending share and an in-app notification were created…
        share = (await session.execute(
            ConversationShare.__table__.select().where(
                ConversationShare.shared_with_user_id == member.id
            )
        )).first()
        assert share is not None
        notif = (await session.execute(
            Notification.__table__.select().where(Notification.user_id == member.id)
        )).first()
        assert notif is not None
        # …and the existing-user email went out (not the sign-up invite).
        assert capture_emails["share"] == [
            {"to": "member@example.com", "inviter_name": "A B"}
        ]
        assert capture_emails["signup"] == []


@pytest.mark.asyncio
async def test_unknown_email_gets_signup_invite(test_db, capture_emails):
    async with test_db() as session:
        owner = await _make_user(session, "owner2@example.com")
        conv = Conversation(user_id=owner.id, title="Cash back card")
        session.add(conv)
        await session.flush()

        shared, invited, not_found = await ConversationService.share_with_emails(
            session, conv.id, owner.id, ["newperson@example.com"]
        )
        await session.commit()

        assert shared == []
        assert invited == ["newperson@example.com"]
        assert not_found == []
        # No share row for a non-user; they got the sign-up invite email.
        assert capture_emails["signup"] == [
            {"to": "newperson@example.com", "inviter_name": "A B"}
        ]
        assert capture_emails["share"] == []


@pytest.mark.asyncio
async def test_mixed_recipients_are_split(test_db, capture_emails):
    async with test_db() as session:
        owner = await _make_user(session, "owner3@example.com")
        await _make_user(session, "friend@example.com")
        conv = Conversation(user_id=owner.id, title="Dining rewards")
        session.add(conv)
        await session.flush()

        shared, invited, not_found = await ConversationService.share_with_emails(
            session, conv.id, owner.id, ["friend@example.com", "stranger@example.com"]
        )
        await session.commit()

        assert shared == ["friend@example.com"]
        assert invited == ["stranger@example.com"]
        assert not_found == []


@pytest.mark.asyncio
async def test_list_ids_shared_by_user_tracks_shared_conversations(test_db, capture_emails):
    async with test_db() as session:
        owner = await _make_user(session, "owner5@example.com")
        await _make_user(session, "buddy@example.com")
        shared_conv = Conversation(user_id=owner.id, title="Shared one")
        private_conv = Conversation(user_id=owner.id, title="Private one")
        session.add_all([shared_conv, private_conv])
        await session.flush()

        await ConversationService.share_with_emails(
            session, shared_conv.id, owner.id, ["buddy@example.com"]
        )
        await session.commit()

        ids = await ConversationService.list_ids_shared_by_user(session, owner.id)
        assert shared_conv.id in ids
        assert private_conv.id not in ids


@pytest.mark.asyncio
async def test_failed_invite_email_reported_as_not_found(test_db, monkeypatch):
    async def failing_signup(**kwargs):
        return False

    monkeypatch.setattr(
        conv_module.EmailService, "send_signup_invite", failing_signup
    )
    async with test_db() as session:
        owner = await _make_user(session, "owner4@example.com")
        conv = Conversation(user_id=owner.id, title="Build credit")
        session.add(conv)
        await session.flush()

        shared, invited, not_found = await ConversationService.share_with_emails(
            session, conv.id, owner.id, ["nope@example.com"]
        )
        await session.commit()

        assert shared == []
        assert invited == []
        assert not_found == ["nope@example.com"]
