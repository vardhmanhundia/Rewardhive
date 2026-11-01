"""Tests for the rewards ("which card should I use?") agent and its SSE endpoint.

The engine is real (verified in test_rewards_engine); here the two LLM calls — the
plan and the explanation — are swapped for fakes so the pipeline is deterministic.
"""

import asyncio

from fastapi.testclient import TestClient

from src.agents.rewards import graph as rewards_graph
from src.db.models import CardProduct


class _Chunk:
    def __init__(self, content: str) -> None:
        self.content = content


class _FakePlan:
    """Stands in for the structured plan model."""

    def __init__(self, query: rewards_graph.RewardQuery) -> None:
        self._query = query

    async def ainvoke(self, _messages):
        return self._query


class _FakeExplain:
    """Stands in for the streaming explanation model."""

    def __init__(self, text: str) -> None:
        self._text = text

    async def astream(self, _messages):
        for i, word in enumerate(self._text.split(" ")):
            yield _Chunk(word if i == 0 else f" {word}")


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
                        issuer="Bank of America",
                        annual_fee=0,
                        rewards=[{"category": "All purchases", "rate": "1.5%"}],
                        benefits=[],
                    ),
                    CardProduct(
                        id="united",
                        name="United Explorer",
                        issuer="United",
                        annual_fee=150,
                        rewards=[
                            {"category": "Eligible United flights", "rate": "9x"},
                            {"category": "All other purchases", "rate": "1x"},
                        ],
                        benefits=[],
                    ),
                ]
            )
            await session.commit()

    asyncio.run(_add())


def _patch_llms(monkeypatch, query: rewards_graph.RewardQuery, explanation: str) -> None:
    monkeypatch.setattr(rewards_graph, "plan_llm", _FakePlan(query))
    monkeypatch.setattr(rewards_graph, "explain_llm", _FakeExplain(explanation))


def _event_names(text: str) -> list[str]:
    return [
        line.removeprefix("event: ").strip()
        for frame in text.split("\n\n")
        for line in frame.splitlines()
        if line.startswith("event: ")
    ]


def test_rewards_requires_auth(client: TestClient):
    res = client.post("/rewards/best-card", json={"question": "which card for a flight?"})
    assert res.status_code == 401


def test_rewards_ranks_named_cards_and_streams(
    test_db, client: TestClient, test_user_data: dict, monkeypatch
):
    _seed(test_db)
    _patch_llms(
        monkeypatch,
        rewards_graph.RewardQuery(
            category="travel",
            merchant="United flight",
            keywords=["united", "flight", "airline"],
            note="Treating this as a United flight.",
        ),
        "Use your United Explorer — it earns 9x on United flights.",
    )
    headers = _auth_header(client, test_user_data)
    body = {"question": "which card for a United flight?", "card_ids": ["flat", "united"]}
    res = client.post("/rewards/best-card", headers=headers, json=body)
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")

    names = _event_names(res.text)
    assert names[0] == "plan"
    assert "result" in names
    assert "token" in names
    assert names[-1] == "done"
    # The United card's specific flights deal wins.
    assert '"card_id": "united"' in res.text
    assert '"specific": true' in res.text


def test_rewards_defaults_to_saved_cards(
    test_db, client: TestClient, test_user_data: dict, monkeypatch
):
    _seed(test_db)
    _patch_llms(
        monkeypatch,
        rewards_graph.RewardQuery(category="travel", keywords=["united", "flight"]),
        "United Explorer is your best bet.",
    )
    headers = _auth_header(client, test_user_data)
    # Save one card to the profile, then ask with no card_ids in the body.
    client.put(
        "/profile/details",
        headers=headers,
        json={"cards": [{"card_id": "united", "category": "travel"}]},
    )
    res = client.post(
        "/rewards/best-card", headers=headers, json={"question": "which card for a flight?"}
    )
    assert res.status_code == 200
    assert '"card_id": "united"' in res.text


def test_rewards_suggests_from_catalog_when_user_has_none(
    test_db, client: TestClient, test_user_data: dict, monkeypatch
):
    """With no saved cards, the ranking falls back to the whole catalog, flagged
    as suggestions (owned=false) rather than bailing out."""
    _seed(test_db)
    _patch_llms(
        monkeypatch,
        rewards_graph.RewardQuery(category="travel", keywords=["united", "flight"]),
        "The United Explorer would earn the most here.",
    )
    headers = _auth_header(client, test_user_data)
    res = client.post(
        "/rewards/best-card", headers=headers, json={"question": "which card for a flight?"}
    )
    assert res.status_code == 200
    assert "event: need_cards" not in res.text
    assert '"owned": false' in res.text
    # The seeded catalog cards are ranked as suggestions.
    assert '"card_id": "united"' in res.text
