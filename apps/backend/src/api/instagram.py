"""Instagram posts and news keyword endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_db
from src.models import (
    CardNewsKeywordCreateRequest,
    CardNewsKeywordListResponse,
    CardNewsKeywordSchema,
    InstagramPostCreateRequest,
    InstagramPostListResponse,
    InstagramPostSchema,
)
from src.services.instagram_service import InstagramService

router = APIRouter(prefix="/cards", tags=["instagram"])


@router.post("/{card_id}/instagram-posts", response_model=InstagramPostSchema)
async def create_instagram_post(
    card_id: UUID,
    request: InstagramPostCreateRequest,
    session: AsyncSession = Depends(get_db),
) -> InstagramPostSchema:
    """Create and store an Instagram post for a card."""
    post = await InstagramService.store_instagram_post(
        session=session,
        card_id=card_id,
        instagram_post_id=request.instagram_post_id,
        url=request.url,
        caption=request.caption,
        image_url=request.image_url,
        likes=request.likes,
        engagement_score=request.engagement_score,
        hashtags=request.hashtags,
        posted_at=request.posted_at,
    )
    await session.commit()
    return post


@router.get("/{card_id}/instagram-posts", response_model=InstagramPostListResponse)
async def get_instagram_posts(
    card_id: UUID,
    limit: int = 20,
    session: AsyncSession = Depends(get_db),
) -> InstagramPostListResponse:
    """Get Instagram posts for a card."""
    posts = await InstagramService.get_instagram_posts_for_card(
        session=session, card_id=card_id, limit=limit
    )
    return InstagramPostListResponse(posts=posts)


@router.post("/{card_id}/news-keywords", response_model=CardNewsKeywordSchema)
async def create_news_keyword(
    card_id: UUID,
    request: CardNewsKeywordCreateRequest,
    session: AsyncSession = Depends(get_db),
) -> CardNewsKeywordSchema:
    """Create and store a news keyword for a card."""
    keyword = await InstagramService.store_keyword(
        session=session, card_id=card_id, keyword=request.keyword
    )
    await session.commit()
    return keyword


@router.get("/{card_id}/news-keywords", response_model=CardNewsKeywordListResponse)
async def get_news_keywords(
    card_id: UUID,
    session: AsyncSession = Depends(get_db),
) -> CardNewsKeywordListResponse:
    """Get news keywords for a card."""
    keywords = await InstagramService.get_keywords_for_card(
        session=session, card_id=card_id
    )
    return CardNewsKeywordListResponse(keywords=keywords)


@router.delete("/{card_id}/news-keywords/{keyword_id}")
async def delete_news_keyword(
    card_id: UUID,
    keyword_id: UUID,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Delete a news keyword for a card."""
    deleted = await InstagramService.delete_keyword(session=session, keyword_id=keyword_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Keyword not found",
        )
    await session.commit()
    return {"status": "deleted"}
