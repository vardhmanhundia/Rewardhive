"""News fetcher agent: Generate keywords and fetch Instagram posts for cards.

Workflow:
1. Generate search keywords from card title/description using LLM
2. Fetch Instagram posts for those keywords (simulated with LLM)
3. Store keywords and posts in the database
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.commons.llm import get_chat_model
from src.agents.commons.tracing import traceable
from src.agents.news_fetcher.prompts import (
    INSTAGRAM_FETCH_SYSTEM_PROMPT,
    KEYWORD_GENERATION_SYSTEM_PROMPT,
)
from src.config import settings
from src.services.instagram_service import InstagramService


class KeywordGenerationRequest(BaseModel):
    """Request to generate keywords for a card."""

    card_title: str
    card_description: str | None = None


class KeywordsResponse(BaseModel):
    """Generated keywords for a card."""

    keywords: list[str] = Field(default_factory=list)


class InstagramPostData(BaseModel):
    """Simulated Instagram post data."""

    instagram_post_id: str
    caption: str
    likes: int
    engagement_score: float
    hashtags: list[str] = Field(default_factory=list)


class InstagramPostsResponse(BaseModel):
    """Simulated Instagram posts response."""

    posts: list[InstagramPostData] = Field(default_factory=list)


@dataclass
class NewsFetcherState:
    """State for the news fetcher workflow."""

    card_id: UUID
    card_title: str
    card_description: str | None = None
    keywords: list[str] | None = None
    instagram_posts: list[InstagramPostData] | None = None
    error: str | None = None


# Build LLM models with structured output
keyword_llm = get_chat_model(
    settings.RECOMMENDATION_MODEL,
    max_tokens=2048,
    structured=KeywordsResponse,
    reasoning_effort="low",
)

posts_llm = get_chat_model(
    settings.RECOMMENDATION_MODEL,
    max_tokens=2048,
    structured=InstagramPostsResponse,
    reasoning_effort="low",
)


async def _generate_keywords(
    session: AsyncSession, card_title: str, card_description: str | None
) -> list[str]:
    """Generate search keywords from card title and description."""
    description_text = f"\n{card_description}" if card_description else ""
    prompt = f"Card: {card_title}{description_text}"

    response = await keyword_llm.ainvoke(
        [
            SystemMessage(content=KEYWORD_GENERATION_SYSTEM_PROMPT),
            HumanMessage(content=prompt),
        ]
    )
    return response.keywords if hasattr(response, "keywords") else []


async def _fetch_instagram_posts(
    session: AsyncSession, keywords: list[str]
) -> list[InstagramPostData]:
    """Simulate fetching Instagram posts for given keywords."""
    prompt = f"Search keywords: {', '.join(keywords)}"

    response = await posts_llm.ainvoke(
        [
            SystemMessage(content=INSTAGRAM_FETCH_SYSTEM_PROMPT),
            HumanMessage(content=prompt),
        ]
    )
    return response.posts if hasattr(response, "posts") else []


@traceable(run_type="chain", name="news_fetcher")
async def run_news_fetcher(
    session: AsyncSession,
    card_id: UUID,
    card_title: str,
    card_description: str | None = None,
) -> dict[str, Any]:
    """Execute the news fetcher workflow.

    Returns a dict with:
    - keywords: list of generated search keywords
    - posts_count: number of Instagram posts fetched and stored
    - error: error message if something went wrong
    """
    try:
        # Step 1: Generate keywords
        keywords = await _generate_keywords(session, card_title, card_description)

        if not keywords:
            return {
                "card_id": str(card_id),
                "keywords": [],
                "posts_count": 0,
                "error": "No keywords were generated",
            }

        # Step 2: Store keywords in database
        for keyword_text in keywords:
            await InstagramService.store_keyword(
                session=session, card_id=card_id, keyword=keyword_text
            )

        # Step 3: Fetch Instagram posts
        posts = await _fetch_instagram_posts(session, keywords)

        # Step 4: Store posts in database
        posts_count = 0
        for i, post_data in enumerate(posts):
            try:
                # Create a unique post ID combining keyword index and position
                unique_post_id = f"{card_id}_{i}_{post_data.instagram_post_id}"
                await InstagramService.store_instagram_post(
                    session=session,
                    card_id=card_id,
                    instagram_post_id=unique_post_id,
                    url=f"https://instagram.com/p/{unique_post_id}",
                    caption=post_data.caption,
                    image_url=None,
                    likes=post_data.likes,
                    engagement_score=post_data.engagement_score,
                    hashtags=post_data.hashtags,
                    posted_at=datetime.utcnow(),
                )
                posts_count += 1
            except Exception as e:  # noqa: BLE001
                # Log error but continue with other posts
                continue

        await session.commit()

        return {
            "card_id": str(card_id),
            "keywords": keywords,
            "posts_count": posts_count,
            "error": None,
        }

    except Exception as e:  # noqa: BLE001
        await session.rollback()
        return {
            "card_id": str(card_id),
            "keywords": [],
            "posts_count": 0,
            "error": str(e),
        }
