"""Tests for the POST /profile/cards/add endpoint."""

from __future__ import annotations

import asyncio
from uuid import uuid4

import pytest

from src.db.models import User, UserProfile


@pytest.fixture
def seeded_user(test_db):
    """Create a user + empty profile in the test DB and return the user id."""
    user_id = uuid4()

    async def _seed():
        async with test_db() as session:
            user = User(
                id=user_id,
                email="addcard@test.com",
                first_name="Add",
                last_name="Card",
                hashed_password="x",
            )
            session.add(user)
            profile = UserProfile(user_id=user_id, cards=[])
            session.add(profile)
            await session.commit()

    asyncio.run(_seed())
    return user_id


def _auth_headers(user_id):
    """Build a fake JWT payload for the test user."""
    import jwt
    from src.config import settings

    token = jwt.encode({"user_id": str(user_id)}, settings.JWT_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def test_add_card_endpoint(client, seeded_user):
    headers = _auth_headers(seeded_user)
    resp = client.post(
        "/profile/cards/add",
        json={"card_id": "test-card-1", "category": "travel"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert any(c.get("card_id") == "test-card-1" for c in data["cards"])


def test_add_card_idempotent(client, seeded_user):
    headers = _auth_headers(seeded_user)
    body = {"card_id": "test-card-2", "category": "dining"}
    client.post("/profile/cards/add", json=body, headers=headers)
    client.post("/profile/cards/add", json=body, headers=headers)
    resp = client.get("/profile/details", headers=headers)
    cards = resp.json()["cards"]
    matches = [c for c in cards if c.get("card_id") == "test-card-2"]
    assert len(matches) == 1


def test_add_card_requires_identifier(client, seeded_user):
    headers = _auth_headers(seeded_user)
    resp = client.post(
        "/profile/cards/add",
        json={"category": "everyday"},
        headers=headers,
    )
    assert resp.status_code == 422


def test_add_custom_card(client, seeded_user):
    headers = _auth_headers(seeded_user)
    resp = client.post(
        "/profile/cards/add",
        json={"name": "My Store Card", "category": "online", "custom": True},
        headers=headers,
    )
    assert resp.status_code == 200
    assert any(c.get("name") == "My Store Card" for c in resp.json()["cards"])
