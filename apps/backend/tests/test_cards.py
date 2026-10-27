"""Tests for the card catalog read endpoints."""
import asyncio

from src.db.models import CardProduct


def _seed_demo_card(TestSessionLocal) -> None:
    """Insert one catalog card using the test session, in its own event loop."""

    async def _add() -> None:
        async with TestSessionLocal() as session:
            session.add(
                CardProduct(
                    id="demo-card",
                    name="Demo Card",
                    issuer="Demo Bank",
                    annual_fee=0,
                    rewards=[{"category": "Dining", "rate": "3x"}],
                    benefits=["No annual fee", "No foreign transaction fees"],
                    summary="A demo card for tests.",
                )
            )
            await session.commit()

    asyncio.run(_add())


def test_list_and_get_card(test_db, client):
    """Seeded card shows up in the list and resolves by id with its reward shape."""
    _seed_demo_card(test_db)

    res = client.get("/cards")
    assert res.status_code == 200
    cards = res.json()["cards"]
    assert len(cards) == 1
    card = cards[0]
    assert card["id"] == "demo-card"
    assert card["annual_fee"] == 0
    assert card["rewards"] == [{"category": "Dining", "rate": "3x"}]
    assert "No annual fee" in card["benefits"]

    res = client.get("/cards/demo-card")
    assert res.status_code == 200
    assert res.json()["name"] == "Demo Card"


def test_get_card_not_found(client):
    res = client.get("/cards/does-not-exist")
    assert res.status_code == 404
    assert res.json()["detail"] == "Card not found"
