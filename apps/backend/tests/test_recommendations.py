"""Tests for the /recommendations endpoints.

The recommendation agent is mocked, so these verify route wiring: auth is
required, the query is passed through, the answer + cards + memories +
suggestions come back, and the stream serializes agent events as the named SSE
frames the frontend expects (stage / cards / token / memories / suggestions / done).
"""
from fastapi.testclient import TestClient

from src.api import recommendations
from src.db.models import CardProduct


def _auth_header(client: TestClient, test_user_data: dict) -> dict:
    """Sign up a user and return an Authorization header for them."""
    response = client.post("/auth/signup", json=test_user_data)
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _demo_card() -> CardProduct:
    return CardProduct(
        id="demo-card",
        name="Demo Card",
        issuer="Demo Bank",
        annual_fee=0,
        rewards=[{"category": "Dining", "rate": "3x"}],
        benefits=["No annual fee"],
        summary="A demo card.",
    )


def test_recommend_requires_auth(client: TestClient):
    response = client.post("/recommendations", json={"query": "best dining card"})
    assert response.status_code == 401


def test_recommend_returns_full_payload(
    client: TestClient, test_user_data: dict, monkeypatch
):
    captured: dict = {}

    async def fake_run(session, user_id, query, history=None):
        captured["query"] = query
        captured["history"] = history
        return (
            "Demo Card is your best fit.",
            [_demo_card()],
            ["User eats out a lot."],
            ["What's your credit score?", "Do you travel?", "Annual fee ok?"],
        )

    monkeypatch.setattr(recommendations, "run_recommendation", fake_run)

    headers = _auth_header(client, test_user_data)
    response = client.post(
        "/recommendations",
        headers=headers,
        json={"query": "best dining card", "history": [{"role": "user", "content": "hi"}]},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "Demo Card is your best fit."
    assert data["cards"][0]["id"] == "demo-card"
    assert data["new_memories"] == ["User eats out a lot."]
    assert len(data["suggestions"]) == 3
    assert captured["query"] == "best dining card"
    assert captured["history"] == [{"role": "user", "content": "hi"}]


def test_recommend_rejects_empty_query(client: TestClient, test_user_data: dict):
    headers = _auth_header(client, test_user_data)
    response = client.post("/recommendations", headers=headers, json={"query": ""})
    assert response.status_code == 422


def test_stream_requires_auth(client: TestClient):
    response = client.post("/recommendations/stream", json={"query": "travel card"})
    assert response.status_code == 401


def test_stream_emits_named_sse_events(
    client: TestClient, test_user_data: dict, monkeypatch
):
    async def fake_stream(session, user_id, query, history=None):
        yield {"kind": "stage", "stage": "retrieving"}
        yield {"kind": "stage", "stage": "retrieved", "count": 1}
        yield {"kind": "cards", "cards": [{"id": "demo-card", "name": "Demo Card"}]}
        yield {"kind": "stage", "stage": "generating"}
        yield {"kind": "token", "text": "Demo "}
        yield {"kind": "token", "text": "Card."}
        yield {"kind": "memories", "items": ["User eats out a lot."]}
        yield {"kind": "suggestions", "items": ["q1", "q2", "q3"]}
        yield {"kind": "done"}

    monkeypatch.setattr(recommendations, "stream_recommendation", fake_stream)

    headers = _auth_header(client, test_user_data)
    response = client.post(
        "/recommendations/stream", headers=headers, json={"query": "travel card"}
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    events = [
        line.removeprefix("event: ").strip()
        for frame in response.text.split("\n\n")
        for line in frame.splitlines()
        if line.startswith("event: ")
    ]
    assert events == [
        "stage",
        "stage",
        "cards",
        "stage",
        "token",
        "token",
        "memories",
        "suggestions",
        "done",
    ]
