"""Tests for the /optimizer endpoints (route wiring over the real engine)."""

import asyncio

from fastapi.testclient import TestClient

from src.db.models import CardProduct


def _auth_header(client: TestClient, test_user_data: dict) -> dict:
    token = client.post("/auth/signup", json=test_user_data).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _seed(TestSessionLocal) -> None:
    async def _add() -> None:
        async with TestSessionLocal() as session:
            session.add_all(
                [
                    CardProduct(
                        id="flat",
                        name="Flat 1.5",
                        issuer="X",
                        annual_fee=0,
                        rewards=[{"category": "All purchases", "rate": "1.5%"}],
                        benefits=[],
                    ),
                    CardProduct(
                        id="dining4",
                        name="Dining 4%",
                        issuer="X",
                        annual_fee=0,
                        rewards=[{"category": "Dining", "rate": "4%"}],
                        benefits=[],
                    ),
                ]
            )
            await session.commit()

    asyncio.run(_add())


def test_evaluate_requires_auth(client: TestClient):
    res = client.post(
        "/optimizer/evaluate-card",
        json={"spend": {}, "owned": [], "candidate_id": "x"},
    )
    assert res.status_code == 401


def test_evaluate_card_flow(test_db, client: TestClient, test_user_data: dict):
    _seed(test_db)
    headers = _auth_header(client, test_user_data)
    body = {
        "spend": {"dining": 5000, "everyday": 2000},
        "owned": [{"card_id": "flat", "category": "everyday"}],
        "candidate_id": "dining4",
    }
    res = client.post("/optimizer/evaluate-card", headers=headers, json=body)
    assert res.status_code == 200
    data = res.json()
    assert data["candidate_id"] == "dining4"
    assert data["worth_it"] is True
    assert data["add"]["net_annual_value"] > data["reallocate"]["net_annual_value"]
    assert any(b["category"] == "dining" for b in data["add"]["breakdown"])


def test_wallet_optimize_flow(test_db, client: TestClient, test_user_data: dict):
    _seed(test_db)
    headers = _auth_header(client, test_user_data)
    res = client.post(
        "/optimizer/wallet",
        headers=headers,
        json={"spend": {"dining": 1000}, "card_ids": ["dining4"]},
    )
    assert res.status_code == 200
    assert res.json()["breakdown"][0]["earned"] == 40  # 4% of $1,000


def test_evaluate_candidate_not_found(test_db, client: TestClient, test_user_data: dict):
    _seed(test_db)
    headers = _auth_header(client, test_user_data)
    res = client.post(
        "/optimizer/evaluate-card",
        headers=headers,
        json={"spend": {"dining": 1000}, "owned": [], "candidate_id": "nope"},
    )
    assert res.status_code == 404
