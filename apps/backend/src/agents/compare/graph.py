"""Compare subgraph: side-by-side comparison of two or more named cards.

Reached when the router classifies the intent as ``compare`` — the user named
multiple cards they want compared (e.g. "compare the Sapphire Preferred vs
the Venture X").

Pipeline:
1. Resolve each card hint to a catalog card using embedding-based semantic
   search (falls back to exact name match). This handles imprecise names like
   "Amex Gold" matching "American Express Gold Card".
2. Derive a spend baseline from the user's profile.
3. Run the optimizer for each card individually (as if it were the *only* card
   in the wallet) so the per-category earnings are comparable.
4. Format a structured side-by-side summary.
5. Stream an LLM explanation grounded in the numbers.
"""

from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from src.agents.commons.card_tools import offer_evaluate, resolve_card_id
from src.agents.commons.llm import get_chat_model
from src.agents.commons.spend import derive_spend_baseline_for_user
from src.agents.compare.prompts import COMPARE_SYSTEM_PROMPT
from src.agents.state import AgentState
from src.agents.user_profiling.graph import persist_turn
from src.agents.user_profiling.helpers import config_values
from src.config import settings
from src.db.models import CardProduct
from src.services.optimizer_service import (
    OptCard,
    WalletResult,
    card_to_optcard,
    optimize_wallet,
)
from src.services.card_service import CardService
from src.services.conversation_service import ConversationService
from src.services.retrieval_service import RetrievalService

explain_llm = get_chat_model(settings.RECOMMENDATION_MODEL, max_tokens=2048)


def _chunk_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(p.get("text", "") for p in content if isinstance(p, dict))
    return ""


def _format_card_result(card: OptCard, result: WalletResult) -> str:
    lines = [
        f"**{card.name}** ({card.issuer}, ${card.annual_fee:,.0f}/yr fee):",
        f"  Net annual value: ${result.net_annual_value:,.0f} "
        f"(rewards ${result.total_rewards:,.0f}, fee ${result.total_fees:,.0f}); "
        f"effective return {result.effective_return_pct}%.",
        "  Per category:",
    ]
    for b in result.breakdown:
        lines.append(
            f"  - {b.label}: ${b.spend:,.0f}/yr -> {b.rate}, "
            f"earns ${b.earned:,.0f}/yr ({b.effective_pct}%)"
        )
    return "\n".join(lines)


async def compare_node(state: AgentState, config: RunnableConfig) -> AgentState:
    writer = get_stream_writer()
    session, user_id = config_values(config)
    query = state.get("query", "")
    history = state.get("history") or []
    hints = state.get("compare_card_hints") or []

    if len(hints) < 2:
        writer({"kind": "token", "text": "I need at least two card names to compare. Could you name the cards you'd like me to compare?"})
        writer({"kind": "done"})
        return {"answer": "I need at least two card names to compare. Could you name the cards you'd like me to compare?"}

    writer({"kind": "stage", "stage": "retrieving"})

    resolved: list[tuple[str, CardProduct, OptCard]] = []
    not_found: list[str] = []
    seen_ids: set[str] = set()

    for hint in hints:
        card: CardProduct | None = None

        # 1) Embedding-based semantic search (handles fuzzy / informal names).
        matches = await RetrievalService.retrieve_cards(session, hint, k=1)
        if matches:
            card = matches[0]

        # 2) Fallback to exact / substring name match.
        if card is None:
            card_id = await resolve_card_id(session, hint)
            if card_id:
                card = await CardService.get_card(session, card_id)

        if card is None or card.id in seen_ids:
            if card is None:
                not_found.append(hint)
            continue

        seen_ids.add(card.id)
        opt = card_to_optcard(card.id, card.name, card.issuer, card.annual_fee, card.rewards)
        resolved.append((hint, card, opt))

    if len(resolved) < 2:
        msg = f"I could only find {len(resolved)} of the cards you named."
        if not_found:
            msg += f" Couldn't find: {', '.join(not_found)}."
        msg += " Please check the card names and try again."
        writer({"kind": "token", "text": msg})
        writer({"kind": "done"})
        return {"answer": msg}

    writer({"kind": "stage", "stage": "retrieved", "count": len(resolved)})

    spend = await derive_spend_baseline_for_user(session, user_id, history)

    writer({"kind": "stage", "stage": "generating"})

    results: list[tuple[OptCard, WalletResult]] = []
    for _, _, opt in resolved:
        result = optimize_wallet(spend, [opt])
        results.append((opt, result))

    # Sort by net annual value (best first) for the picks ranking.
    results.sort(key=lambda r: r[1].net_annual_value, reverse=True)

    # Build picks in the same shape as CardRewardPick so the frontend renders
    # the ranked-row UI (with "Best" badge and effective percentage).
    total_spend = sum(spend.values())
    best_categories = []
    for b in results[0][1].breakdown:
        if b.earned > 0:
            best_categories.append(f"{b.rate} {b.label}")
    picks: list[dict[str, Any]] = []
    for opt, result in results:
        top_categories = [
            f"{b.rate} {b.label}" for b in result.breakdown if b.earned > 0
        ]
        reward_label = ", ".join(top_categories[:3]) if top_categories else "All purchases"
        best_rate = max(
            (b.rate for b in result.breakdown if b.earned > 0),
            default="—",
        )
        picks.append({
            "card_id": opt.id,
            "card_name": opt.name,
            "issuer": opt.issuer,
            "reward_label": reward_label,
            "rate": best_rate,
            "effective_pct": result.effective_return_pct,
            "est_annual_value": result.net_annual_value,
            "specific": False,
        })

    writer({"kind": "result", "picks": picks})

    # Format context for the LLM explanation.
    context_parts = [
        f"User's estimated annual spend: {', '.join(f'{k}: ${v:,.0f}' for k, v in spend.items())}",
        "",
    ]
    for opt, result in results:
        context_parts.append(_format_card_result(opt, result))
        context_parts.append("")

    context = "\n".join(context_parts)
    prompt = f"Question: {query}\n\nOptimizer results for each card:\n{context}"

    parts: list[str] = []
    async for chunk in explain_llm.astream(
        [SystemMessage(content=COMPARE_SYSTEM_PROMPT), HumanMessage(content=prompt)]
    ):
        text = _chunk_text(chunk.content)
        if text:
            writer({"kind": "token", "text": text})
            parts.append(text)

    prompts: list[dict[str, Any]] = []
    card_ids = [opt.id for _, _, opt in resolved]
    prompt_evt = offer_evaluate(writer, card_ids)
    if prompt_evt:
        prompts.append(prompt_evt)

    answer = "".join(parts)
    conversation_id = config.get("configurable", {}).get("conversation_id")
    if conversation_id is not None:
        await persist_turn(
            str(conversation_id), query, answer,
            picks=picks, intent="compare", spend_baseline=spend,
        )
        await ConversationService.touch(session, conversation_id, first_question=query)

    writer({"kind": "done"})
    return {
        "answer": answer,
        "spend_baseline": spend,
        "prompts": prompts,
    }


def build_compare_subgraph() -> Any:
    builder = StateGraph(AgentState)
    builder.add_node("compare", compare_node)
    builder.add_edge(START, "compare")
    builder.add_edge("compare", END)
    return builder.compile()
