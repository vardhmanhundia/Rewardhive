"""
Example integration script for the Instagram news feature.

This demonstrates the full flow of:
1. Creating a card
2. Generating keywords for it
3. Fetching Instagram posts
4. Storing and retrieving posts and keywords

Run with: python -m examples.news_integration_example
"""

import asyncio
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from src.db.models import Base, Card, InstagramPost, CardNewsKeyword
from src.services.instagram_service import InstagramService
from src.agents.news_fetcher.graph import run_news_fetcher


async def main():
    """Run the integration example."""
    # Setup: Use SQLite for this example
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Step 1: Create a sample card
        print("Step 1: Creating a sample card...")
        card_id = uuid.uuid4()
        card = Card(
            id=card_id,
            user_id=uuid.uuid4(),
            title="American Express Platinum Card",
            content="Premium travel rewards card with elite perks",
            description="Perfect for frequent business travelers and luxury enthusiasts",
            status="published",
            is_public=True,
        )
        session.add(card)
        await session.commit()
        print(f"  Created card: {card.title} (ID: {card.id})")

        # Step 2: Run the news fetcher workflow
        print("\nStep 2: Running news fetcher workflow...")
        result = await run_news_fetcher(
            session=session,
            card_id=card_id,
            card_title=card.title,
            card_description=card.description,
        )
        print(f"  Generated {len(result['keywords'])} keywords: {result['keywords']}")
        print(f"  Fetched and stored {result['posts_count']} Instagram posts")

        # Step 3: Retrieve and display keywords
        print("\nStep 3: Retrieved keywords:")
        keywords = await InstagramService.get_keywords_for_card(session, card_id)
        for kw in keywords:
            print(f"  - {kw.keyword} (created: {kw.created_at})")

        # Step 4: Retrieve and display Instagram posts
        print("\nStep 4: Retrieved Instagram posts:")
        posts = await InstagramService.get_instagram_posts_for_card(session, card_id)
        for post in posts[:3]:  # Show first 3 posts
            print(f"  - {post.instagram_post_id}")
            print(f"    Caption: {post.caption[:50] if post.caption else 'N/A'}...")
            print(f"    Likes: {post.likes}, Engagement: {post.engagement_score}")
            print(f"    Hashtags: {', '.join(post.hashtags) if post.hashtags else 'None'}")

        # Step 5: Demonstrate service operations
        print("\nStep 5: Testing service operations...")

        # Get all posts
        all_posts = await InstagramService.get_all_instagram_posts(session, limit=5)
        print(f"  Total posts in system: {len(all_posts)}")

        # Update keyword search time
        if keywords:
            kw_id = keywords[0].id
            updated = await InstagramService.update_keyword_search_time(session, kw_id)
            print(f"  Updated keyword search time: {updated.last_searched}")

        # Step 6: Show statistics
        print("\nStep 6: Integration Summary:")
        print(f"  Card: {card.title}")
        print(f"  Keywords generated: {len(keywords)}")
        print(f"  Posts fetched: {len(posts)}")
        if posts:
            avg_engagement = sum(p.engagement_score for p in posts) / len(posts)
            avg_likes = sum(p.likes for p in posts) / len(posts)
            print(f"  Average engagement score: {avg_engagement:.1f}")
            print(f"  Average likes: {avg_likes:.0f}")

        print("\n✅ Integration test completed successfully!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
