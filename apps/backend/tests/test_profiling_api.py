"""Tests for the /profiling/chat endpoint.

The profiling agent is mocked, so these verify the route wiring: auth is
required, the request body is passed through, and the reply/suggestions/
new_memories are returned.
"""

import json

from fastapi.testclient import TestClient

from src.agents.user_profiling import ProfilingResult
from src.api import profiling


def _auth_header(client: TestClient, test_user_data: dict) -> dict:
    """Sign up a user and return an Authorization header for them."""
    response = client.post("/auth/signup", json=test_user_data)
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_chat_requires_auth(client: TestClient):
    """A chat request without a token is rejected."""
    response = client.post("/profiling/chat", json={"message": "hi"})
    assert response.status_code == 401


def test_chat_returns_reply(client: TestClient, test_user_data: dict, monkeypatch):
    """A valid turn returns the agent's reply, suggestions, and new memories."""
    captured: dict = {}

    async def fake_turn(session, user_id, message, history=None):
        captured["message"] = message
        captured["history"] = history
        return ProfilingResult(
            reply="Hello, Test!",
            suggestions=["q1", "q2", "q3"],
            new_memories=["User's name is Test."],
        )

    monkeypatch.setattr(profiling, "run_profiling_turn", fake_turn)

    headers = _auth_header(client, test_user_data)
    response = client.post(
        "/profiling/chat",
        headers=headers,
        json={
            "message": "Hi, I'm Test",
            "history": [{"role": "user", "content": "earlier"}],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["reply"] == "Hello, Test!"
    assert data["suggestions"] == ["q1", "q2", "q3"]
    assert data["new_memories"] == ["User's name is Test."]
    assert captured["message"] == "Hi, I'm Test"
    assert captured["history"] == [{"role": "user", "content": "earlier"}]


def test_chat_rejects_empty_message(client: TestClient, test_user_data: dict):
    """An empty message fails request validation."""
    headers = _auth_header(client, test_user_data)
    response = client.post("/profiling/chat", headers=headers, json={"message": ""})
    assert response.status_code == 422


def test_chat_stream_requires_auth(client: TestClient):
    """A stream request without a token is rejected."""
    response = client.post("/profiling/chat/stream", json={"message": "hi"})
    assert response.status_code == 401


def test_chat_stream_emits_sse_events(client: TestClient, test_user_data: dict, monkeypatch):
    """The stream endpoint serializes agent events as SSE data frames, in order."""

    async def fake_stream(session, user_id, message, history=None):
        yield {"type": "token", "text": "Hel"}
        yield {"type": "token", "text": "lo"}
        yield {"type": "memories", "items": ["User's name is Test."]}
        yield {"type": "suggestions", "items": ["q1", "q2", "q3"]}
        yield {"type": "done"}

    monkeypatch.setattr(profiling, "stream_profiling_turn", fake_stream)

    headers = _auth_header(client, test_user_data)
    response = client.post(
        "/profiling/chat/stream",
        headers=headers,
        json={"message": "Hi, I'm Test"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["cache-control"] == "no-cache, no-transform"

    frames = [line for line in response.text.split("\n\n") if line.startswith("data: ")]
    events = [json.loads(frame.removeprefix("data: ")) for frame in frames]

    assert [e["type"] for e in events] == [
        "token",
        "token",
        "memories",
        "suggestions",
        "done",
    ]
    assert "".join(e["text"] for e in events if e["type"] == "token") == "Hello"
    assert events[3]["items"] == ["q1", "q2", "q3"]
