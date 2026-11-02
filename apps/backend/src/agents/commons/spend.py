"""Derive a monthly/annual spend baseline for the evaluate (advisor) flow.

When the Card Evaluator is reached from chat there is no spend form to read, so
we estimate a reasonable *annual* spend per optimizer category from what we know
about the user (their stored profile) plus light signals from the conversation.
The estimate is deliberately coarse — the frontend shows it as editable values
(the same affordance as the evaluate-a-card page), so the user corrects it.

The categories match the optimizer engine / :class:`AdvisorPlan`:
``dining, travel, groceries, gas, online, everyday`` — annual dollars.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.user_profiling.helpers import load_profile

# Default annual spend per category (rough US averages), before profile scaling.
_DEFAULTS: dict[str, float] = {
    "dining": 3600.0,
    "travel": 3000.0,
    "groceries": 6000.0,
    "gas": 2400.0,
    "online": 3000.0,
    "everyday": 6000.0,
}

# Categories that grow with household size (shared, per-person spend).
_HOUSEHOLD_SCALED = ("groceries", "everyday", "dining")

# Conversation keywords that nudge a category up when the user keeps raising it.
_HISTORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "dining": ("dining", "restaurant", "eat out", "takeout"),
    "travel": ("travel", "flight", "hotel", "airbnb", "trip"),
    "groceries": ("grocery", "groceries", "supermarket"),
    "gas": ("gas", "fuel", "commute"),
    "online": ("online", "amazon", "shopping"),
}


def _household_factor(family_size: int | None, household: str | None) -> float:
    """A gentle multiplier for household-scaled categories (never below 1.0)."""
    if family_size and family_size > 1:
        return 1.0 + 0.25 * (family_size - 1)
    if household and household.lower() in {"owning", "mortgaging"}:
        return 1.15
    return 1.0


def derive_spend_baseline(
    profile_cards: list[dict],
    family_size: int | None,
    household: str | None,
    travel_preference: str | None,
    history: list[dict[str, str]] | None,
) -> dict[str, float]:
    """Estimate an annual spend baseline from profile signals + chat history.

    Pure so it is trivially testable; :func:`derive_spend_baseline_for_user`
    loads the inputs from the DB and calls this.
    """
    baseline = dict(_DEFAULTS)

    factor = _household_factor(family_size, household)
    for cat in _HOUSEHOLD_SCALED:
        baseline[cat] = round(baseline[cat] * factor, 2)

    # Leisure travelers spend materially more on travel.
    if travel_preference and travel_preference.lower() == "leisure":
        baseline["travel"] = round(baseline["travel"] * 1.6, 2)

    # Bump categories the user already tags cards for — those are where they spend.
    for card in profile_cards or []:
        cat = (card.get("category") or "").lower()
        if cat in baseline:
            baseline[cat] = round(baseline[cat] * 1.2, 2)

    # Light signal from the conversation: a category raised repeatedly gets a nudge.
    text = " ".join((t.get("content") or "") for t in (history or [])).lower()
    for cat, words in _HISTORY_KEYWORDS.items():
        hits = sum(text.count(w) for w in words)
        if hits >= 2:
            baseline[cat] = round(baseline[cat] * 1.2, 2)

    return baseline


async def derive_spend_baseline_for_user(
    session: AsyncSession,
    user_id: UUID,
    history: list[dict[str, str]] | None = None,
) -> dict[str, float]:
    """Load the user's profile and estimate their annual spend baseline."""
    profile = await load_profile(session, user_id)
    cards = [c.model_dump() for c in profile.cards]
    return derive_spend_baseline(
        cards,
        profile.family_size,
        profile.household,
        profile.travel_preference,
        history,
    )
