"""Rewards agent: "which of my cards should I use for this purchase?"

A small, reliable pipeline — the same shape as the wallet-advisor:

1. **plan** — an LLM resolves the free-text purchase into a structured query:
   a coarse category, specific merchant keywords (so a United/IHG/Airbnb deal is
   recognized, not flattened), and any catalog cards the user named.
2. **rank** — the deterministic engine (:func:`rank_cards_for_purchase`) ranks the
   candidate cards by what each earns on this purchase.
3. **explain** — an LLM streams a short recommendation grounded strictly in the
   engine's ranking; it never invents a card or a rate.

The engine does the math; the model interprets the purchase and narrates.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import asdict
from typing import Any
from uuid import UUID

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.commons.llm import get_chat_model
from src.agents.commons.tracing import traceable
from src.agents.rewards.prompts import EXPLAIN_SYSTEM_PROMPT, PLAN_SYSTEM_PROMPT
from src.config import settings
from src.services.card_service import CardService
from src.services.optimizer_service import (
    OptCard,
    CardRewardPick,
    card_to_optcard,
    merchant_hint,
    rank_cards_for_purchase,
)
from src.services.vision_service import parse_receipt, ReceiptParseResult


class RewardQuery(BaseModel):
    """The purchase resolved from the user's question (see the plan prompt)."""

    category: str | None = None
    merchant: str | None = None
    keywords: list[str] = Field(default_factory=list)
    named_card_ids: list[str] = Field(default_factory=list)
    note: str = ""


# Narrow extraction task -> low reasoning effort; narration -> plain streaming.
plan_llm = get_chat_model(
    settings.RECOMMENDATION_MODEL, max_tokens=2048, structured=RewardQuery, reasoning_effort="low"
)
explain_llm = get_chat_model(settings.RECOMMENDATION_MODEL, max_tokens=2048)


def _chunk_text(content: Any) -> str:
    """Coerce a streamed chunk's content into text (str or list-of-blocks)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(p.get("text", "") for p in content if isinstance(p, dict))
    return ""


async def _plan(
    session: AsyncSession,
    question: str,
    image_b64: str | None = None,
    image_mime: str | None = None,
) -> RewardQuery:
    """Resolve the purchase, letting the LLM also map any card names to catalog ids."""
    catalog = await CardService.get_all_cards(session)
    listing = "\n".join(f"{c.id} — {c.name} — {c.issuer}" for c in catalog)
    system = PLAN_SYSTEM_PROMPT.format(catalog=listing)
    if image_b64:
        mime = image_mime or "image/png"
        content: list[str | dict[Any, Any]] = [
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
            {"type": "text", "text": question},
        ]
        return await plan_llm.ainvoke([SystemMessage(content=system), HumanMessage(content=content)])
    return await plan_llm.ainvoke([SystemMessage(content=system), HumanMessage(content=question)])


def _backfill(query: RewardQuery, question: str) -> RewardQuery:
    """Strengthen the plan with a deterministic merchant lookup, so a mislabeled
    purchase (no category, or missing specific keywords) is still classified."""
    cat, kws = merchant_hint(f"{question} {query.merchant or ''}")
    if query.category is None and cat is not None:
        query.category = cat
    # Union the specific keywords (dedup, preserve order); never the bare category.
    query.keywords = list(dict.fromkeys([*query.keywords, *kws]))
    return query


async def _optcard(session: AsyncSession, card_id: str) -> OptCard | None:
    card = await CardService.get_card(session, card_id)
    if card is None:
        return None
    return card_to_optcard(card.id, card.name, card.issuer, card.annual_fee, card.rewards)


def _format_picks(picks: list[CardRewardPick]) -> str:
    lines = []
    for i, p in enumerate(picks, 1):
        tag = " [merchant-specific deal]" if p.specific else ""
        value = f", ~${p.est_annual_value:,.0f}/yr" if p.est_annual_value is not None else ""
        lines.append(
            f'{i}. {p.card_name} ({p.issuer}) — {p.rate} on "{p.reward_label}", '
            f"≈ {p.effective_pct}% back{value}{tag}"
        )
    return "\n".join(lines)


def _format_receipt_for_prompt(receipt: ReceiptParseResult) -> str:
    """Render parsed receipt line items as readable text for the LLM."""
    if not receipt.items:
        return ""
    lines = [f"Parsed statement ({len(receipt.items)} transactions, total ${receipt.total_amount:.2f}):"]
    for item in receipt.items:
        date_str = f" on {item.date}" if item.date else ""
        lines.append(f"  - {item.merchant}: ${item.amount:.2f} ({item.category}){date_str}")
    return "\n".join(lines)


@traceable(run_type="chain", name="rewards")
async def stream_rewards(
    session: AsyncSession,
    user_id: UUID,
    question: str,
    card_ids: list[str],
    monthly_amount: float | None = None,
    image_b64: str | None = None,
    image_mime: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Stream the which-card turn as event dicts the transport renders as SSE.

    Yields: ``plan`` ({note, category, merchant, owned}), ``result`` ({picks,
    owned}), ``token`` ({text}) repeatedly, ``done`` — ``need_cards`` only when the
    catalog itself is empty, or a single ``error``. ``owned`` is False when the
    user holds no cards and the ranking is over the whole catalog as suggestions.

    When an image is attached, the receipt/statement is first parsed into
    structured line items, then each spending category is ranked separately
    so the LLM explains per-category best cards instead of guessing.
    """
    try:
        # ── Pre-parse image into structured data ────────────────────────
        receipt: ReceiptParseResult | None = None
        if image_b64:
            yield {"kind": "stage", "stage": "parsing image"}
            receipt = await parse_receipt(image_b64, mime_type=image_mime or "image/png")
            yield {"kind": "stage", "stage": "parsed", "count": len(receipt.items)}

        # ── Resolve the purchase intent ─────────────────────────────────
        enriched_question = question
        if receipt and receipt.items:
            enriched_question = f"{question}\n\n{_format_receipt_for_prompt(receipt)}"

        query = _backfill(await _plan(session, enriched_question), enriched_question)

        candidate_ids = query.named_card_ids or card_ids
        cards = [oc for cid in candidate_ids if (oc := await _optcard(session, cid))]

        owned = bool(cards)
        if not cards:
            catalog = await CardService.get_all_cards(session)
            cards = [
                card_to_optcard(c.id, c.name, c.issuer, c.annual_fee, c.rewards) for c in catalog
            ]
        if not cards:
            yield {"kind": "need_cards"}
            return

        yield {
            "kind": "plan",
            "note": query.note,
            "category": query.category,
            "merchant": query.merchant,
            "owned": owned,
        }

        # ── Rank cards per category when we have a multi-category statement ──
        if receipt and receipt.items and len({it.category for it in receipt.items}) > 1:
            categories: dict[str, dict[str, Any]] = {}
            for item in receipt.items:
                cat = item.category
                if cat not in categories:
                    categories[cat] = {"total": 0.0, "merchants": []}
                categories[cat]["total"] += item.amount
                categories[cat]["merchants"].append(item.merchant)

            all_sections: list[str] = []
            grouped_picks: list[dict[str, Any]] = []
            for cat, info in sorted(categories.items(), key=lambda x: -x[1]["total"]):
                cat_picks = rank_cards_for_purchase(cat, [], cards, info["total"] / 12)
                if not owned:
                    cat_picks = cat_picks[:3]
                for p in cat_picks:
                    d = asdict(p)
                    d["category_group"] = cat
                    d["category_total"] = info["total"]
                    grouped_picks.append(d)
                merchants_str = ", ".join(set(info["merchants"]))
                all_sections.append(
                    f"**{cat.title()}** (${info['total']:.2f} — {merchants_str}):\n"
                    f"{_format_picks(cat_picks)}"
                )

            yield {"kind": "result", "picks": grouped_picks, "owned": owned}

            wallet = (
                "Cards ranked by what they earn, broken down by spending category:"
                if owned
                else "The user holds no cards yet. Catalog suggestions per category:"
            )
            prompt = (
                f"Question: {question}\n"
                f"Statement summary: {len(receipt.items)} transactions totaling "
                f"${receipt.total_amount:.2f}\n\n"
                f"{wallet}\n\n" + "\n\n".join(all_sections)
            )
        else:
            picks = rank_cards_for_purchase(query.category, query.keywords, cards, monthly_amount)
            if not owned:
                picks = picks[:5]
            yield {"kind": "result", "picks": [asdict(p) for p in picks], "owned": owned}

            wallet = (
                "Cards ranked by what they earn on this purchase:"
                if owned
                else (
                    "The user holds no cards yet. These are the catalog cards that would "
                    "earn the most on this purchase (suggestions, not cards they own):"
                )
            )
            prompt = (
                f"Purchase: {question}\n"
                f"Resolved category: {query.category or 'none'}; "
                f"merchant/sub-type: {query.merchant or 'none'}\n\n"
                f"{wallet}\n{_format_picks(picks)}"
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
