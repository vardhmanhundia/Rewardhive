"""Tests for the /profile/details endpoints."""

from fastapi.testclient import TestClient


def _auth_header(client: TestClient, test_user_data: dict) -> dict:
    """Sign up a user and return an Authorization header for them."""
    response = client.post("/auth/signup", json=test_user_data)
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_details_requires_auth(client: TestClient):
    """Fetching profile details without a token is rejected."""
    assert client.get("/profile/details").status_code == 401
    assert client.put("/profile/details", json={}).status_code == 401


def test_get_returns_empty_defaults(client: TestClient, test_user_data: dict):
    """A brand-new user gets an empty, default profile."""
    headers = _auth_header(client, test_user_data)
    response = client.get("/profile/details", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["occupation"] is None
    assert data["online_shopping_ranking"] == []
    assert data["offline_shopping_ranking"] == []
    assert data["cards"] == []
    assert data["banks"] == []
    assert data["goals"] == []
    assert data["loans"] == []


def test_put_persists_scalar_and_list_fields(client: TestClient, test_user_data: dict):
    """A full update persists both scalar/enum fields and the JSON lists."""
    headers = _auth_header(client, test_user_data)
    payload = {
        "occupation": "Engineer",
        "company": "Acme Corp",
        "relationship_status": "family",
        "family_size": 4,
        "location_state": "California",
        "location_country": "United States",
        "household": "mortgaging",
        "car": "financed",
        "travel_preference": "leisure",
        "us_status": "green_card",
        "us_status_detail": "EB-2",
        "airline_ranking": ["Delta", "United"],
        "online_shopping_ranking": ["Amazon", "Costco"],
        "offline_shopping_ranking": ["Costco", "Target"],
        "cards": [
            {"card_id": "customized-cash-rewards", "name": None, "category": "groceries", "custom": False},
            {"card_id": None, "name": "Local Credit Union Visa", "category": "everyday", "custom": True},
        ],
        "banks": [{"name": "Bank of America"}],
        "goals": [{"text": "Maximize travel points"}],
        "loans": [{"loan_type": "mortgage"}],
    }

    response = client.put("/profile/details", headers=headers, json=payload)
    assert response.status_code == 200

    # Re-fetch to prove it was written to the DB, not just echoed back.
    data = client.get("/profile/details", headers=headers).json()
    assert data["occupation"] == "Engineer"
    assert data["company"] == "Acme Corp"
    assert data["family_size"] == 4
    assert data["us_status"] == "green_card"
    assert data["us_status_detail"] == "EB-2"
    assert data["airline_ranking"] == ["Delta", "United"]
    assert data["online_shopping_ranking"] == ["Amazon", "Costco"]
    assert data["offline_shopping_ranking"] == ["Costco", "Target"]
    assert data["cards"][1]["custom"] is True
    assert data["cards"][1]["name"] == "Local Credit Union Visa"
    assert data["loans"] == [{"loan_type": "mortgage"}]


def test_partial_put_leaves_other_fields_intact(client: TestClient, test_user_data: dict):
    """A partial update only touches the fields provided."""
    headers = _auth_header(client, test_user_data)
    client.put(
        "/profile/details",
        headers=headers,
        json={"occupation": "Engineer", "location_state": "Texas"},
    )

    # Second update changes only occupation.
    client.put("/profile/details", headers=headers, json={"occupation": "Architect"})

    data = client.get("/profile/details", headers=headers).json()
    assert data["occupation"] == "Architect"
    assert data["location_state"] == "Texas"


def test_put_rejects_invalid_enum(client: TestClient, test_user_data: dict):
    """An out-of-range enum value is rejected by validation."""
    headers = _auth_header(client, test_user_data)
    response = client.put(
        "/profile/details",
        headers=headers,
        json={"us_status": "martian"},
    )
    assert response.status_code == 422
