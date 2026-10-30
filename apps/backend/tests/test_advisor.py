"""Tests for the wallet-advisor agent and its SSE endpoint.

The engine is real (verified in test_optimizer); here the two LLM calls — the
plan and the explanation — are swapped for fakes so the pipeline is deterministic.
"""

import asyncio

from fastapi.testclient import TestClient

from src.agents.advisor import graph as advisor_graph
from src.db.models import CardProduct


class _Chunk:
    def __init__(self, content: str) -> None:
        self.content = content


class _FakePlan:
    """Stands in for the structured plan model."""

    def __init__(self, plan: advisor_graph.AdvisorPlan) -> None:
        self._plan = plan

    async def ainvoke(self, _messages):
        return self._plan


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


def _patch_llms(monkeypatch, plan: advisor_graph.AdvisorPlan, explanation: str) -> None:
    monkeypatch.setattr(advisor_graph, "plan_llm", _FakePlan(plan))
    monkeypatch.setattr(advisor_graph, "explain_llm", _FakeExplain(explanation))


def _event_names(text: str) -> list[str]:
    return [
        line.removeprefix("event: ").strip()
        for frame in text.split("\n\n")
        for line in frame.splitlines()
        if line.startswith("event: ")
    ]


def test_adjust_applies_multipliers():
    plan = advisor_graph.AdvisorPlan(travel=1.5, dining=0.5)
    out = advisor_graph._adjust({"travel": 100, "dining": 100, "gas": 100}, plan)
    assert out == {"travel": 150.0, "dining": 50.0, "gas": 100.0}


def test_advisor_requires_auth(client: TestClient):
    res = client.post("/advisor/stream", json={"question": "", "spend": {}, "owned": []})
    assert res.status_code == 401


def test_advisor_evaluate_streams_plan_result_and_explanation(
    test_db, client: TestClient, test_user_data: dict, monkeypatch
):
    _seed(test_db)
    _patch_llms(monkeypatch, advisor_graph.AdvisorPlan(), "Adding it is worth it.")
    headers = _auth_header(client, test_user_data)
    body = {
        "question": "should I get it?",
        "spend": {"dining": 5000, "everyday": 2000},
        "owned": [{"card_id": "flat", "category": "everyday"}],
        "candidate_id": "dining4",
    }
    res = client.post("/advisor/stream", headers=headers, json=body)
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")

    names = _event_names(res.text)
    assert names[0] == "plan"
    assert "result" in names
    assert "token" in names
    assert names[-1] == "done"
    assert '"mode": "evaluate"' in res.text
    assert '"worth_it"' in res.text


def test_advisor_optimize_applies_spend_multiplier(
    test_db, client: TestClient, test_user_data: dict, monkeypatch
):
    _seed(test_db)
    # "Travel more" -> the plan bumps travel; no candidate -> optimize mode.
    _patch_llms(
        monkeypatch,
        advisor_graph.AdvisorPlan(travel=2.0, note="Assuming you travel twice as much."),
        "Here is your optimized wallet.",
    )
    headers = _auth_header(client, test_user_data)
    body = {
        "question": "what if I travel twice as much?",
        "spend": {"dining": 1000, "travel": 1000},
        "owned": [{"card_id": "dining4", "category": "dining"}],
    }
    res = client.post("/advisor/stream", headers=headers, json=body)
    assert res.status_code == 200
    assert '"mode": "optimize"' in res.text
    # The plan event echoes the adjusted spend (travel doubled to 2000).
    assert '"travel": 2000' in res.text


def test_advisor_candidate_not_found(
    test_db, client: TestClient, test_user_data: dict, monkeypatch
):
    _seed(test_db)
    _patch_llms(monkeypatch, advisor_graph.AdvisorPlan(), "unused")
    headers = _auth_header(client, test_user_data)
    body = {"question": "worth it?", "spend": {"dining": 1000}, "owned": [], "candidate_id": "nope"}
    res = client.post("/advisor/stream", headers=headers, json=body)
    assert res.status_code == 200
    assert "event: error" in res.text
