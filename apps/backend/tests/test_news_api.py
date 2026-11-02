"""Tests for the news API endpoints."""

import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.main import app
from src.db.models import Card, InstagramPost, CardNewsKeyword
from src.services.instagram_service import InstagramService


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def card_id():
    """Generate a test card ID."""
    return str(uuid.uuid4())


@pytest.fixture
async def test_card(session: AsyncSession, card_id):
    """Create a test card."""
    card = Card(
        id=uuid.UUID(card_id),
        user_id=uuid.uuid4(),
        title="Travel Rewards Card",
        content="A card focused on travel rewards",
        description="Perfect for frequent travelers",
        status="published",
        is_public=True,
    )
    session.add(card)
    await session.flush()
    return card


@pytest.mark.asyncio
async def test_create_instagram_post(client, session: AsyncSession, test_card):
    """Test creating an Instagram post via API."""
    payload = {
        "instagram_post_id": "test_post_123",
        "url": "https://instagram.com/p/test_post_123",
        "caption": "Amazing travel rewards!",
        "image_url": "https://example.com/image.jpg",
        "likes": 500,
        "engagement_score": 88.5,
        "hashtags": ["travel", "rewards", "creditcard"],
        "posted_at": datetime.utcnow().isoformat(),
    }

    response = client.post(
        f"/cards/{test_card.id}/instagram-posts",
        json=payload,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["instagram_post_id"] == "test_post_123"
    assert data["likes"] == 500
    assert data["engagement_score"] == 88.5
    assert len(data["hashtags"]) == 3


@pytest.mark.asyncio
async def test_get_instagram_posts(client, session: AsyncSession, test_card):
    """Test getting Instagram posts for a card."""
    # Store some posts
    for i in range(3):
        await InstagramService.store_instagram_post(
            session=session,
            card_id=test_card.id,
            instagram_post_id=f"post_{i}",
            url=f"https://instagram.com/p/post_{i}",
            caption=f"Post {i}",
            image_url=None,
            likes=100 + i * 50,
            engagement_score=75.0 + i,
            hashtags=["test"],
            posted_at=datetime.utcnow(),
        )
    await session.commit()

    response = client.get(f"/cards/{test_card.id}/instagram-posts")

    assert response.status_code == 200
    data = response.json()
    assert len(data["posts"]) == 3


@pytest.mark.asyncio
async def test_create_news_keyword(client, session: AsyncSession, test_card):
    """Test creating a news keyword via API."""
    payload = {
        "keyword": "travel rewards",
    }

    response = client.post(
        f"/cards/{test_card.id}/news-keywords",
        json=payload,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["keyword"] == "travel rewards"


@pytest.mark.asyncio
async def test_get_news_keywords(client, session: AsyncSession, test_card):
    """Test getting news keywords for a card."""
    # Store some keywords
    keywords = ["travel", "airlines", "hotels"]
    for kw in keywords:
        await InstagramService.store_keyword(
            session=session,
            card_id=test_card.id,
            keyword=kw,
        )
    await session.commit()

    response = client.get(f"/cards/{test_card.id}/news-keywords")

    assert response.status_code == 200
    data = response.json()
    assert len(data["keywords"]) == 3


@pytest.mark.asyncio
async def test_delete_news_keyword(client, session: AsyncSession, test_card):
    """Test deleting a news keyword via API."""
    # Create a keyword
    keyword = await InstagramService.store_keyword(
        session=session,
        card_id=test_card.id,
        keyword="test keyword",
    )
    await session.commit()

    # Delete it
    response = client.delete(
        f"/cards/{test_card.id}/news-keywords/{keyword.id}",
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "deleted"


@pytest.mark.asyncio
async def test_get_news_feed(client, session: AsyncSession, test_card):
    """Test getting the global news feed."""
    # Store some posts
    for i in range(2):
        await InstagramService.store_instagram_post(
            session=session,
            card_id=test_card.id,
            instagram_post_id=f"global_post_{i}",
            url=f"https://instagram.com/p/global_post_{i}",
            caption=f"Global post {i}",
            image_url=None,
            likes=200,
            engagement_score=85.0,
            hashtags=[],
            posted_at=datetime.utcnow(),
        )
    await session.commit()

    response = client.get("/news/feed")

    assert response.status_code == 200
    data = response.json()
    assert len(data["posts"]) >= 2


@pytest.mark.asyncio
async def test_get_card_news_feed(client, session: AsyncSession, test_card):
    """Test getting news feed for a specific card."""
    # Store posts for this card
    for i in range(3):
        await InstagramService.store_instagram_post(
            session=session,
            card_id=test_card.id,
            instagram_post_id=f"card_post_{i}",
            url=f"https://instagram.com/p/card_post_{i}",
            caption=f"Card post {i}",
            image_url=None,
            likes=150,
            engagement_score=80.0,
            hashtags=[],
            posted_at=datetime.utcnow(),
        )
    await session.commit()

    response = client.get(f"/news/cards/{test_card.id}/feed")

    assert response.status_code == 200
    data = response.json()
    assert len(data["posts"]) == 3
