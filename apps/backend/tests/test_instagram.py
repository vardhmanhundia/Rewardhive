"""Tests for Instagram service and news API endpoints."""

import uuid
from datetime import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Card, InstagramPost, CardNewsKeyword
from src.services.instagram_service import InstagramService


@pytest.fixture
def card_id():
    """Generate a test card ID."""
    return uuid.uuid4()


@pytest.fixture
async def test_card(session: AsyncSession, card_id):
    """Create a test card."""
    card = Card(
        id=card_id,
        user_id=uuid.uuid4(),
        title="Test Card",
        content="A test card for Instagram posts",
        description="Test card description",
        status="published",
        is_public=True,
    )
    session.add(card)
    await session.flush()
    return card


@pytest.mark.asyncio
async def test_store_instagram_post(session: AsyncSession, test_card):
    """Test storing an Instagram post."""
    post = await InstagramService.store_instagram_post(
        session=session,
        card_id=test_card.id,
        instagram_post_id="test_post_123",
        url="https://instagram.com/p/test_post_123",
        caption="Test caption",
        image_url="https://example.com/image.jpg",
        likes=100,
        engagement_score=85.5,
        hashtags=["test", "credit-card"],
        posted_at=datetime.utcnow(),
    )

    assert post.id is not None
    assert post.card_id == test_card.id
    assert post.instagram_post_id == "test_post_123"
    assert post.likes == 100
    assert post.engagement_score == 85.5
    assert post.hashtags == ["test", "credit-card"]


@pytest.mark.asyncio
async def test_get_instagram_posts_for_card(session: AsyncSession, test_card):
    """Test retrieving Instagram posts for a card."""
    # Store multiple posts
    for i in range(3):
        await InstagramService.store_instagram_post(
            session=session,
            card_id=test_card.id,
            instagram_post_id=f"post_{i}",
            url=f"https://instagram.com/p/post_{i}",
            caption=f"Caption {i}",
            image_url=None,
            likes=100 + i * 50,
            engagement_score=80.0 + i,
            hashtags=["test"],
            posted_at=datetime.utcnow(),
        )

    await session.flush()

    # Retrieve posts
    posts = await InstagramService.get_instagram_posts_for_card(
        session=session, card_id=test_card.id
    )

    assert len(posts) == 3
    # Should be ordered by engagement score (descending)
    assert posts[0].engagement_score >= posts[1].engagement_score


@pytest.mark.asyncio
async def test_store_keyword(session: AsyncSession, test_card):
    """Test storing a news keyword."""
    keyword = await InstagramService.store_keyword(
        session=session,
        card_id=test_card.id,
        keyword="travel rewards",
    )

    assert keyword.id is not None
    assert keyword.card_id == test_card.id
    assert keyword.keyword == "travel rewards"
    assert keyword.last_searched is None


@pytest.mark.asyncio
async def test_get_keywords_for_card(session: AsyncSession, test_card):
    """Test retrieving keywords for a card."""
    # Store multiple keywords
    keywords_list = ["travel rewards", "airline miles", "hotel points"]
    for kw in keywords_list:
        await InstagramService.store_keyword(
            session=session,
            card_id=test_card.id,
            keyword=kw,
        )

    await session.flush()

    # Retrieve keywords
    keywords = await InstagramService.get_keywords_for_card(
        session=session, card_id=test_card.id
    )

    assert len(keywords) == 3
    assert all(kw.keyword in keywords_list for kw in keywords)


@pytest.mark.asyncio
async def test_update_keyword_search_time(session: AsyncSession, test_card):
    """Test updating keyword search time."""
    keyword = await InstagramService.store_keyword(
        session=session,
        card_id=test_card.id,
        keyword="test keyword",
    )

    await session.flush()

    # Update search time
    updated = await InstagramService.update_keyword_search_time(
        session=session,
        keyword_id=keyword.id,
    )

    assert updated is not None
    assert updated.last_searched is not None


@pytest.mark.asyncio
async def test_delete_keyword(session: AsyncSession, test_card):
    """Test deleting a keyword."""
    keyword = await InstagramService.store_keyword(
        session=session,
        card_id=test_card.id,
        keyword="test keyword",
    )

    await session.flush()

    # Delete keyword
    deleted = await InstagramService.delete_keyword(
        session=session,
        keyword_id=keyword.id,
    )

    assert deleted is True

    # Try to delete again - should return False
    deleted_again = await InstagramService.delete_keyword(
        session=session,
        keyword_id=keyword.id,
    )

    assert deleted_again is False


@pytest.mark.asyncio
async def test_delete_old_instagram_posts(session: AsyncSession, test_card):
    """Test deleting old Instagram posts."""
    from datetime import timedelta

    # Store a recent post
    await InstagramService.store_instagram_post(
        session=session,
        card_id=test_card.id,
        instagram_post_id="recent_post",
        url="https://instagram.com/p/recent",
        caption="Recent post",
        image_url=None,
        likes=100,
        engagement_score=85.0,
        hashtags=[],
        posted_at=datetime.utcnow(),
    )

    # Store an old post (manually modify created_at)
    old_post = InstagramPost(
        id=uuid.uuid4(),
        card_id=test_card.id,
        instagram_post_id="old_post",
        url="https://instagram.com/p/old",
        caption="Old post",
        image_url=None,
        likes=50,
        engagement_score=70.0,
        hashtags=[],
        posted_at=datetime.utcnow() - timedelta(days=40),
        created_at=datetime.utcnow() - timedelta(days=40),
    )
    session.add(old_post)

    await session.flush()

    # Delete posts older than 30 days
    deleted_count = await InstagramService.delete_old_instagram_posts(
        session=session, days_old=30
    )

    assert deleted_count == 1  # Only the old post should be deleted

    # Verify the recent post still exists
    posts = await InstagramService.get_all_instagram_posts(session=session)
    assert len(posts) == 1
    assert posts[0].instagram_post_id == "recent_post"
