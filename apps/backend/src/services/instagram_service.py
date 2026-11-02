"""Instagram service for fetching, storing, and managing Instagram posts related to cards."""

from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardNewsKeyword, InstagramPost


class InstagramService:
    """Service for managing Instagram posts and news keywords for cards."""

    @staticmethod
    async def store_instagram_post(
        session: AsyncSession,
        card_id: UUID,
        instagram_post_id: str,
        url: str,
        caption: str | None,
        image_url: str | None,
        likes: int,
        engagement_score: float,
        hashtags: list[str],
        posted_at: datetime | None,
    ) -> InstagramPost:
        """Store an Instagram post in the database."""
        post = InstagramPost(
            card_id=card_id,
            instagram_post_id=instagram_post_id,
            url=url,
            caption=caption,
            image_url=image_url,
            likes=likes,
            engagement_score=engagement_score,
            hashtags=hashtags,
            posted_at=posted_at,
        )
        session.add(post)
        await session.flush()
        return post

    @staticmethod
    async def get_instagram_posts_for_card(
        session: AsyncSession, card_id: UUID, limit: int = 20
    ) -> list[InstagramPost]:
        """Get Instagram posts for a specific card, ordered by engagement score."""
        result = await session.execute(
            select(InstagramPost)
            .where(InstagramPost.card_id == card_id)
            .order_by(InstagramPost.engagement_score.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_all_instagram_posts(
        session: AsyncSession, limit: int = 100
    ) -> list[InstagramPost]:
        """Get all Instagram posts, ordered by engagement score."""
        result = await session.execute(
            select(InstagramPost)
            .order_by(InstagramPost.engagement_score.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    @staticmethod
    async def delete_old_instagram_posts(
        session: AsyncSession, days_old: int = 30
    ) -> int:
        """Delete Instagram posts older than specified days. Returns count of deleted posts."""
        cutoff_date = datetime.utcnow() - timedelta(days=days_old)
        stmt = delete(InstagramPost).where(InstagramPost.created_at < cutoff_date)
        result = await session.execute(stmt)
        return result.rowcount  # type: ignore

    @staticmethod
    async def store_keyword(
        session: AsyncSession, card_id: UUID, keyword: str
    ) -> CardNewsKeyword:
        """Store a news search keyword for a card."""
        kw = CardNewsKeyword(card_id=card_id, keyword=keyword)
        session.add(kw)
        await session.flush()
        return kw

    @staticmethod
    async def get_keywords_for_card(
        session: AsyncSession, card_id: UUID
    ) -> list[CardNewsKeyword]:
        """Get all keywords for a card."""
        result = await session.execute(
            select(CardNewsKeyword).where(CardNewsKeyword.card_id == card_id)
        )
        return list(result.scalars().all())

    @staticmethod
    async def update_keyword_search_time(
        session: AsyncSession, keyword_id: UUID
    ) -> CardNewsKeyword | None:
        """Update the last_searched timestamp for a keyword."""
        keyword = await session.get(CardNewsKeyword, keyword_id)
        if keyword:
            keyword.last_searched = datetime.utcnow()
            await session.flush()
        return keyword

    @staticmethod
    async def delete_keyword(session: AsyncSession, keyword_id: UUID) -> bool:
        """Delete a keyword. Returns True if deleted, False if not found."""
        keyword = await session.get(CardNewsKeyword, keyword_id)
        if keyword:
            await session.delete(keyword)
            await session.flush()
            return True
        return False
