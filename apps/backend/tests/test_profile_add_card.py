"""Tests for the POST /profile/cards/add endpoint."""

from __future__ import annotations

from fastapi.testclient import TestClient


def _auth_header(client: TestClient, test_user_data: dict) -> dict:
    """Sign up a user and return an Authorization header for them.

    Signup issues a real, session-registered token (and creates the user's empty
    profile), which is what the auth middleware requires — a hand-crafted JWT is
    rejected because it isn't in the session store.
    """
    response = client.post("/auth/signup", json=test_user_data)
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_add_card_endpoint(client: TestClient, test_user_data: dict):
    headers = _auth_header(client, test_user_data)
    resp = client.post(
        "/profile/cards/add",
        json={"card_id": "test-card-1", "category": "travel"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert any(c.get("card_id") == "test-card-1" for c in data["cards"])


def test_add_card_idempotent(client: TestClient, test_user_data: dict):
    headers = _auth_header(client, test_user_data)
    body = {"card_id": "test-card-2", "category": "dining"}
    client.post("/profile/cards/add", json=body, headers=headers)
    client.post("/profile/cards/add", json=body, headers=headers)
    resp = client.get("/profile/details", headers=headers)
    cards = resp.json()["cards"]
    matches = [c for c in cards if c.get("card_id") == "test-card-2"]
    assert len(matches) == 1


def test_add_card_requires_identifier(client: TestClient, test_user_data: dict):
    headers = _auth_header(client, test_user_data)
    resp = client.post(
        "/profile/cards/add",
        json={"category": "everyday"},
        headers=headers,
    )
    assert resp.status_code == 422


def test_add_custom_card(client: TestClient, test_user_data: dict):
    headers = _auth_header(client, test_user_data)
    resp = client.post(
        "/profile/cards/add",
        json={"name": "My Store Card", "category": "online", "custom": True},
        headers=headers,
    )
    assert resp.status_code == 200
    assert any(c.get("name") == "My Store Card" for c in resp.json()["cards"])
