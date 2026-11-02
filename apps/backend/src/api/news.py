"""News feed endpoints: Get Instagram posts and manage keywords."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.news_fetcher.graph import run_news_fetcher
from src.db.database import get_db
from src.db.models import Card
from src.models import InstagramPostListResponse
from src.services.instagram_service import InstagramService

router = APIRouter(prefix="/news", tags=["news"])


@router.get("/feed", response_model=InstagramPostListResponse)
async def get_news_feed(
    limit: int = 100,
    session: AsyncSession = Depends(get_db),
) -> InstagramPostListResponse:
    """Get the global Instagram news feed (all posts across all cards)."""
    posts = await InstagramService.get_all_instagram_posts(session=session, limit=limit)
    return InstagramPostListResponse(posts=posts)


@router.get("/cards/{card_id}/feed", response_model=InstagramPostListResponse)
async def get_card_news_feed(
    card_id: UUID,
    limit: int = 20,
    session: AsyncSession = Depends(get_db),
) -> InstagramPostListResponse:
    """Get Instagram posts for a specific card."""
    posts = await InstagramService.get_instagram_posts_for_card(
        session=session, card_id=card_id, limit=limit
    )
    return InstagramPostListResponse(posts=posts)


@router.post("/cards/{card_id}/refresh")
async def refresh_card_news(
    card_id: UUID,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Trigger a news fetch/refresh for a specific card.

    This will:
    1. Generate keywords from the card's title/description
    2. Fetch Instagram posts for those keywords
    3. Store the keywords and posts in the database
    """
    # Get the card first to ensure it exists
    card = await session.get(Card, card_id)
    if card is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found",
        )

    # Run the news fetcher workflow
    result = await run_news_fetcher(
        session=session,
        card_id=card_id,
        card_title=card.title,
        card_description=card.description,
    )

    if result.get("error"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch news: {result['error']}",
        )

    return {
        "card_id": str(card_id),
        "keywords_generated": len(result.get("keywords", [])),
        "posts_fetched": result.get("posts_count", 0),
        "keywords": result.get("keywords", []),
    }


@router.delete("/cards/{card_id}/old-posts")
async def cleanup_old_posts(
    card_id: UUID,
    days_old: int = 30,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Delete Instagram posts older than specified days (default: 30 days)."""
    # Note: This deletes from all cards, not just the specified one.
    # For card-specific deletion, you'd filter by card_id in the service.
    deleted_count = await InstagramService.delete_old_instagram_posts(
        session=session, days_old=days_old
    )
    await session.commit()
    return {
        "deleted_count": deleted_count,
        "days_old": days_old,
    }
