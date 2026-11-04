"""Transactional email for conversation share invites.

No managed email provider is wired in yet, so this service speaks plain SMTP
through the stdlib (``smtplib`` + ``email.message``) — no extra dependency. The
blocking send runs in a worker thread via :func:`asyncio.to_thread` so it never
stalls the async event loop.

In fake mode — the default (``EMAIL_FAKE_MODE``), so local dev and tests need no
SMTP server — a message is logged instead of sent. Set ``EMAIL_FAKE_MODE=false``
and the ``SMTP_*`` settings to deliver for real.

The sharing flow sends two different emails depending on the recipient:

- :meth:`send_share_notification` — the invitee already has an account, so they
  get a heads-up with a link straight to the conversation.
- :meth:`send_signup_invite` — the invitee is not a user yet, so they get the
  invite plus a prompt to sign up before they can open it.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from uuid import UUID

from src.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Compose and deliver the conversation-sharing emails."""

    @staticmethod
    def _conversation_url(conversation_id: UUID) -> str:
        """Deep link to open a conversation in the recommend chat."""
        return f"{settings.FRONTEND_URL}/recommend?c={conversation_id}"

    @staticmethod
    def _signup_url() -> str:
        """Link to the sign-up page."""
        return f"{settings.FRONTEND_URL}/signup"

    @staticmethod
    def _deliver(message: EmailMessage) -> None:
        """Blocking SMTP send. Run via :func:`asyncio.to_thread`, never directly."""
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USERNAME:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)

    @staticmethod
    async def _send(to: str, subject: str, text_body: str, html_body: str) -> bool:
        """Send one email. Returns True on success (or when logged in fake mode).

        Delivery is best effort: an SMTP failure is logged and returns False so
        the caller can report it, never raised into the sharing transaction.
        """
        message = EmailMessage()
        message["From"] = settings.EMAIL_FROM
        message["To"] = to
        message["Subject"] = subject
        message.set_content(text_body)
        message.add_alternative(html_body, subtype="html")

        if settings.EMAIL_FAKE_MODE:
            logger.info("[email:fake] to=%s subject=%s\n%s", to, subject, text_body)
            return True

        try:
            await asyncio.to_thread(EmailService._deliver, message)
            return True
        except Exception:  # pragma: no cover - network/SMTP failure path
            logger.exception("Failed to send email to %s", to)
            return False

    @staticmethod
    async def send_share_notification(
        *,
        to: str,
        inviter_name: str,
        conversation_title: str,
        conversation_id: UUID,
    ) -> bool:
        """Tell an existing user a conversation was shared with them."""
        url = EmailService._conversation_url(conversation_id)
        subject = f"{inviter_name} shared a conversation with you"
        text_body = (
            f'{inviter_name} shared the conversation "{conversation_title}" with you '
            f"on RewardHive.\n\nOpen it here: {url}\n"
        )
        html_body = (
            f'<p>{inviter_name} shared the conversation '
            f'<strong>"{conversation_title}"</strong> with you on RewardHive.</p>'
            f'<p><a href="{url}">Open the conversation</a></p>'
        )
        return await EmailService._send(to, subject, text_body, html_body)

    @staticmethod
    async def send_signup_invite(
        *,
        to: str,
        inviter_name: str,
        conversation_title: str,
        conversation_id: UUID,
    ) -> bool:
        """Invite a non-user: share the conversation plus prompt them to sign up."""
        conversation_url = EmailService._conversation_url(conversation_id)
        signup_url = EmailService._signup_url()
        subject = f"{inviter_name} invited you to RewardHive"
        text_body = (
            f'{inviter_name} wants to share the conversation "{conversation_title}" '
            f"with you on RewardHive.\n\n"
            f"RewardHive helps you pick the right credit card for how you spend. "
            f"Create a free account to view the conversation and start your own:\n"
            f"{signup_url}\n\n"
            f"Once you've signed up, open the conversation here: {conversation_url}\n"
        )
        html_body = (
            f'<p>{inviter_name} wants to share the conversation '
            f'<strong>"{conversation_title}"</strong> with you on RewardHive.</p>'
            f"<p>RewardHive helps you pick the right credit card for how you spend. "
            f"Create a free account to view the conversation and start your own.</p>"
            f'<p><a href="{signup_url}">Sign up for RewardHive</a></p>'
            f'<p>Already signed up? <a href="{conversation_url}">Open the conversation</a></p>'
        )
        return await EmailService._send(to, subject, text_body, html_body)
