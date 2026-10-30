"""Wallet-advisor agent: interpret a what-if question, run the optimizer, explain.

This is the "beyond RAG" flow. It is a small, reliable pipeline rather than a
free-form tool-calling loop:

1. **plan** — an LLM turns the user's natural-language question into structured
   per-category spend multipliers (e.g. "what if I travel more?" -> travel ×1.6).
2. **compute** — the deterministic optimizer engine (the agent's tool) runs on the
   adjusted spend: ``evaluate_card`` when a candidate is named, else
   ``optimize_wallet``.
3. **explain** — an LLM streams a plain-language recommendation that is grounded
   strictly in the engine's numbers; it never invents a figure.

The engine does the math; the model does the interpreting and the narration.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import asdict
from typing import Any
from uuid import UUID

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.advisor.prompts import EXPLAIN_SYSTEM_PROMPT, PLAN_SYSTEM_PROMPT
from src.agents.commons.llm import get_chat_model
from src.agents.commons.tracing import traceable
from src.config import settings
from src.services.card_service import CardService
from src.services.optimizer_service import (
    OptCard,
    ScenarioComparison,
    WalletResult,
    card_to_optcard,
    evaluate_card,
    optimize_wallet,
)


class AdvisorPlan(BaseModel):
    """Per-category spend multipliers parsed from the user's question (1.0 = unchanged)."""

    dining: float = 1.0
    travel: float = 1.0
    groceries: float = 1.0
    gas: float = 1.0
    online: float = 1.0
    everyday: float = 1.0
    note: str = ""


# Narrow task -> low reasoning effort; narration -> a plain streaming model.
plan_llm = get_chat_model(
    settings.RECOMMENDATION_MODEL, max_tokens=2048, structured=AdvisorPlan, reasoning_effort="low"
)
explain_llm = get_chat_model(settings.RECOMMENDATION_MODEL, max_tokens=2048)


def _chunk_text(content: Any) -> str:
    """Coerce a streamed chunk's content into text (str or list-of-blocks)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(p.get("text", "") for p in content if isinstance(p, dict))
    return ""


async def _plan(question: str) -> AdvisorPlan:
    """Interpret a what-if question into spend multipliers (identity if empty)."""
    if not question.strip():
        return AdvisorPlan()
    return await plan_llm.ainvoke(
        [SystemMessage(content=PLAN_SYSTEM_PROMPT), HumanMessage(content=question)]
    )


def _adjust(spend: dict[str, float], plan: AdvisorPlan) -> dict[str, float]:
    multipliers = plan.model_dump(exclude={"note"})
    return {cat: float(amount) * float(multipliers.get(cat, 1.0)) for cat, amount in spend.items()}


async def _optcard(session: AsyncSession, card_id: str) -> OptCard | None:
    card = await CardService.get_card(session, card_id)
    if card is None:
        return None
    return card_to_optcard(card.id, card.name, card.issuer, card.annual_fee, card.rewards)


def _format_wallet(result: WalletResult) -> str:
    lines = [
        f"Net annual value: ${result.net_annual_value:,.0f} "
        f"(rewards ${result.total_rewards:,.0f}, fees ${result.total_fees:,.0f}); "
        f"effective return {result.effective_return_pct}%.",
        "Per category:",
    ]
    for b in result.breakdown:
        lines.append(
            f"- {b.label}: ${b.spend:,.0f} -> {b.card_name or 'no card'} "
            f"({b.rate}), earns ${b.earned:,.0f}/yr"
        )
    return "\n".join(lines)


def _format_comparison(c: ScenarioComparison) -> str:
    return "\n".join(
        [
            f"Keep (current habits): net ${c.keep.net_annual_value:,.0f}/yr",
            f"Reallocate (current cards, optimal): net ${c.reallocate.net_annual_value:,.0f}/yr "
            f"(+${c.gain_from_reallocating:,.0f} vs keep, no new account)",
            f"Add {c.candidate_name} (${c.candidate_fee:,.0f} fee): "
            f"net ${c.add.net_annual_value:,.0f}/yr "
            f"(+${c.gain_from_adding:,.0f} vs reallocating)",
            f"Verdict: {c.verdict}",
            "",
            "Best scenario, per category:",
            _format_wallet(c.add if c.worth_it else c.reallocate),
        ]
    )


@traceable(run_type="chain", name="advisor")
async def stream_advisor(
    session: AsyncSession,
    user_id: UUID,
    question: str,
    spend: dict[str, float],
    owned: list[dict[str, Any]],
    candidate_id: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Stream the advisor turn as event dicts the transport renders as SSE.

    Yields: ``plan`` ({note, spend}), ``result`` ({mode, result}), ``token``
    ({text}) repeatedly, ``done`` — or a single ``error``.
    """
    try:
        plan = await _plan(question)
        adjusted = _adjust(spend, plan)
        yield {"kind": "plan", "note": plan.note, "spend": adjusted}

        owned_cards: list[OptCard] = []
        usage: dict[str, str] = {}
        for item in owned:
            oc = await _optcard(session, item["card_id"])
            if oc is None:
                continue
            owned_cards.append(oc)
            if item.get("category"):
                usage[item["category"]] = item["card_id"]

        if candidate_id:
            candidate = await _optcard(session, candidate_id)
            if candidate is None:
                yield {"kind": "error", "detail": "Candidate card not found"}
                return
            comparison = evaluate_card(adjusted, owned_cards, usage, candidate)
            yield {"kind": "result", "mode": "evaluate", "result": asdict(comparison)}
            context = _format_comparison(comparison)
        else:
            wallet = optimize_wallet(adjusted, owned_cards)
            yield {"kind": "result", "mode": "optimize", "result": asdict(wallet)}
            context = _format_wallet(wallet)

        prompt = (
            f"Question: {question or '(general check)'}\n"
            f"Spending assumption applied: {plan.note or 'none'}\n\n"
            f"Optimizer results:\n{context}"
        )
        async for chunk in explain_llm.astream(
            [SystemMessage(content=EXPLAIN_SYSTEM_PROMPT), HumanMessage(content=prompt)]
        ):
            text = _chunk_text(chunk.content)
            if text:
                yield {"kind": "token", "text": text}
        yield {"kind": "done"}
    except Exception as exc:  # noqa: BLE001 — surface any failure to the client
        yield {"kind": "error", "detail": str(exc)}
