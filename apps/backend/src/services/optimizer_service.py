"""Deterministic wallet-rewards optimizer — the engine behind CardPilot.

This is the "do real work" core: given approximate annual spend per category and a
set of cards, it decides which card to use for each category, applies earn-rate
caps, converts points to cash with a per-program valuation, and returns the net
annual value after fees. It also compares the three scenarios the product is
built around (keep / reallocate / add a card).

Design goals, in order: **correct, transparent, self-contained.**
  * Pure Python (stdlib only) — no FastAPI, DB, or LLM imports — so it is unit
    testable in isolation and callable as an agent tool.
  * Every number is explainable: per-category winner, rate, and dollars earned
    are all returned, never hidden inside the LLM.

Known, deliberate simplifications (documented so the math stays honest):
  * Caps are modelled per earn-rule. "Combined" caps shared across several
    categories (e.g. 6%+2% on the first $2,500/quarter) and quarterly windows are
    treated as a single annual per-category cap, or ignored when only stated in
    benefit prose. Choice-category caps are not modelled.
  * Card selection per category is greedy on the elevated rate; it does not
    re-plan around a capped card being worse than an uncapped one past the cap.
These are the places to make exact later; they are flagged, not silent.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# Spending categories (kept in sync with the frontend explorer). Matching is
# strict: keywords hit on word boundaries, and `exclude` phrases are stripped
# first so a compound like "online grocery" counts as groceries, not online.
# ---------------------------------------------------------------------------
CATEGORIES: dict[str, dict[str, list[str]]] = {
    "dining": {"keywords": ["dining", "restaurant"], "exclude": []},
    "travel": {"keywords": ["travel", "flight", "hotel", "airline"], "exclude": []},
    "groceries": {"keywords": ["grocer", "supermarket", "wholesale"], "exclude": []},
    "gas": {"keywords": ["gas", "ev", "fuel"], "exclude": []},
    "online": {"keywords": ["online"], "exclude": ["online grocery", "online groceries"]},
    "everyday": {
        "keywords": [
            "all purchases",
            "all other purchases",
            "every business purchase",
            "everyday",
            "everywhere",
        ],
        "exclude": [],
    },
}

CATEGORY_LABELS: dict[str, str] = {
    "dining": "Dining",
    "travel": "Travel",
    "groceries": "Groceries",
    "gas": "Gas & EV",
    "online": "Online",
    "everyday": "Everyday",
}

ALL_CATEGORIES: list[str] = list(CATEGORIES.keys())


def category_matches(text: str, category: str) -> bool:
    """Does a reward's category string genuinely refer to `category`?"""
    spec = CATEGORIES[category]
    hay = text.lower()
    for phrase in spec["exclude"]:
        hay = hay.replace(phrase, " ")
    for kw in spec["keywords"]:
        esc = re.escape(kw)
        # Short/ambiguous tokens (e.g. "ev") need a trailing boundary too.
        pattern = r"\b" + esc + (r"\b" if len(kw) <= 2 else "")
        if re.search(pattern, hay):
            return True
    return False


def cents_per_point(name: str, issuer: str) -> float:
    """Estimated cash value of one point/mile, so "x" and "%" rates compare.

    Co-brand hotel/airline points are worth far less than flexible bank points —
    which is exactly why a 5x hotel card should not beat 3% cash on groceries.
    """
    n = name.lower()
    if "ihg" in n:
        return 0.5  # hotel points
    if "united" in n:
        return 1.2  # airline miles
    if issuer == "Chase":
        return 1.5  # Ultimate Rewards
    if issuer == "American Express":
        return 1.5  # Membership Rewards
    if issuer == "Capital One":
        return 1.3  # miles
    return 1.0  # Bank of America points / default


# ---------------------------------------------------------------------------
# Structured card model
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class EarnRule:
    """One way a card earns, normalized from its free-text reward line."""

    categories: frozenset[str]  # spending categories this rule earns on
    rate_value: float  # numeric rate (3 for "3%", 1.5 for "1.5x")
    rate_unit: str  # "percent" | "points"
    cap_annual: float | None = None  # elevated rate applies up to this annual spend
    then_rate_value: float | None = None  # rate beyond the cap (same unit)
    choice: bool = False  # a "pick one category" reward (activates a single category)


@dataclass(frozen=True)
class OptCard:
    """A card as the optimizer sees it: fee, point value, and earn rules."""

    id: str
    name: str
    issuer: str
    annual_fee: float
    cents_per_point: float
    rules: tuple[EarnRule, ...]


_NUM = re.compile(r"([\d.]+)")
_CAP = re.compile(r"\$([\d,]+)")
_THEN = re.compile(r"then\s+([\d.]+)\s*(%|x)", re.IGNORECASE)


def _parse_rate(rate: str) -> tuple[float, str]:
    m = _NUM.search(rate)
    value = float(m.group(1)) if m else 0.0
    unit = "percent" if "%" in rate else "points"
    return value, unit


def _parse_cap(text: str) -> tuple[float | None, float | None]:
    """Pull an annual spend cap and the post-cap rate out of a reward's text."""
    low = text.lower()
    cap: float | None = None
    m = _CAP.search(text)
    if m and ("up to" in low or "first" in low):
        cap = float(m.group(1).replace(",", ""))
    then: float | None = None
    mt = _THEN.search(text)
    if mt:
        then = float(mt.group(1))
    return cap, then


def card_to_optcard(
    card_id: str,
    name: str,
    issuer: str,
    annual_fee: float,
    rewards: list[dict[str, str]],
) -> OptCard:
    """Normalize a catalog card (free-text rewards) into the optimizer's model.

    `rewards` is a list of {"category": str, "rate": str}. This is the bridge
    from today's prose catalog to structured earn rules; when the catalog grows
    first-class structured fields, this parsing step goes away.
    """
    cpp = cents_per_point(name, issuer)
    rules: list[EarnRule] = []
    for r in rewards:
        text = r.get("category", "")
        rate = r.get("rate", "")
        cats = frozenset(c for c in CATEGORIES if category_matches(text, c))
        if not cats:
            continue  # a reward we can't map to a known category — skip, don't guess
        value, unit = _parse_rate(rate)
        cap, then = _parse_cap(text)
        is_choice = "choice category" in text.lower()
        rules.append(
            EarnRule(
                categories=cats,
                rate_value=value,
                rate_unit=unit,
                cap_annual=cap,
                then_rate_value=then,
                choice=is_choice,
            )
        )
    return OptCard(
        id=card_id,
        name=name,
        issuer=issuer,
        annual_fee=float(annual_fee),
        cents_per_point=cpp,
        rules=tuple(rules),
    )


# ---------------------------------------------------------------------------
# Rate helpers (everything resolves to a cash fraction, e.g. 0.045 = 4.5%)
# ---------------------------------------------------------------------------
def _rate_fraction(value: float | None, unit: str, cpp: float) -> float:
    if value is None:
        return 0.0
    return value / 100.0 if unit == "percent" else value * cpp / 100.0


def _rule_applies(rule: EarnRule, category: str) -> bool:
    """A rule earns on a category directly, or as an 'everyday' catch-all fallback."""
    return category in rule.categories or "everyday" in rule.categories


def _elevated_fraction(rule: EarnRule, cpp: float) -> float:
    return _rate_fraction(rule.rate_value, rule.rate_unit, cpp)


def _earn(rule: EarnRule, cpp: float, amount: float) -> float:
    """Dollars earned applying `rule` to `amount` of annual spend, honoring the cap."""
    rate = _elevated_fraction(rule, cpp)
    if rule.cap_annual is None or amount <= rule.cap_annual:
        return amount * rate
    beyond = _rate_fraction(rule.then_rate_value, rule.rate_unit, cpp)
    return rule.cap_annual * rate + (amount - rule.cap_annual) * beyond


# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------
@dataclass
class CategoryBreakdown:
    category: str
    label: str
    spend: float
    card_id: str | None
    card_name: str | None
    rate: str  # human-readable, e.g. "3x" / "6%"
    earned: float
    effective_pct: float  # realized cash-back % on this category after caps


@dataclass
class WalletResult:
    net_annual_value: float  # rewards minus fees
    total_rewards: float
    total_fees: float
    effective_return_pct: float  # rewards / total spend
    breakdown: list[CategoryBreakdown] = field(default_factory=list)


def _rate_label(rule: EarnRule) -> str:
    num = f"{rule.rate_value:g}"
    return f"{num}%" if rule.rate_unit == "percent" else f"{num}x"


def optimize_wallet(spend: dict[str, float], cards: list[OptCard]) -> WalletResult:
    """Best net annual value for `spend` given `cards`, assigning each category to
    its best card and activating each choice-category card on its best option."""
    spend = {c: float(a) for c, a in spend.items() if a and a > 0}

    # 1. Best non-choice rule per category (selection ignores caps; earnings don't).
    chosen: dict[str, tuple[OptCard, EarnRule, float]] = {}
    for cat in spend:
        best: tuple[OptCard, EarnRule, float] | None = None
        for card in cards:
            for rule in card.rules:
                if rule.choice or not _rule_applies(rule, cat):
                    continue
                eff = _elevated_fraction(rule, card.cents_per_point)
                if best is None or eff > best[2]:
                    best = (card, rule, eff)
        if best is not None:
            chosen[cat] = best

    # 2. Activate each choice card on the single category where it adds the most.
    for card in cards:
        for rule in card.rules:
            if not rule.choice:
                continue
            eff = _elevated_fraction(rule, card.cents_per_point)
            best_opt: tuple[str, float] | None = None
            for cat in spend:
                if cat not in rule.categories:
                    continue
                current = chosen[cat][2] if cat in chosen else 0.0
                gain = spend[cat] * (eff - current)
                if eff > current and (best_opt is None or gain > best_opt[1]):
                    best_opt = (cat, gain)
            if best_opt is not None:
                chosen[best_opt[0]] = (card, rule, eff)

    # 3. Tally earnings with caps.
    breakdown: list[CategoryBreakdown] = []
    total_rewards = 0.0
    for cat, amount in spend.items():
        sel = chosen.get(cat)
        if sel is None:
            breakdown.append(
                CategoryBreakdown(cat, CATEGORY_LABELS[cat], amount, None, None, "—", 0.0, 0.0)
            )
            continue
        card, rule, _ = sel
        earned = _earn(rule, card.cents_per_point, amount)
        total_rewards += earned
        breakdown.append(
            CategoryBreakdown(
                category=cat,
                label=CATEGORY_LABELS[cat],
                spend=amount,
                card_id=card.id,
                card_name=card.name,
                rate=_rate_label(rule),
                earned=round(earned, 2),
                effective_pct=round(earned / amount * 100, 2) if amount else 0.0,
            )
        )

    total_fees = sum(c.annual_fee for c in cards)
    total_spend = sum(spend.values())
    return WalletResult(
        net_annual_value=round(total_rewards - total_fees, 2),
        total_rewards=round(total_rewards, 2),
        total_fees=round(total_fees, 2),
        effective_return_pct=round(total_rewards / total_spend * 100, 2) if total_spend else 0.0,
        breakdown=breakdown,
    )


def _current_usage(
    spend: dict[str, float], cards: list[OptCard], usage: dict[str, str]
) -> WalletResult:
    """Scenario A: how the user earns *today*, given which card they use per category.

    `usage` maps a category to the card id they currently put it on. Categories
    with no stated card fall back to the best 'everyday' rule they own.
    """
    spend = {c: float(a) for c, a in spend.items() if a and a > 0}
    by_id = {c.id: c for c in cards}

    def best_everyday(cat: str) -> tuple[OptCard, EarnRule] | None:
        best: tuple[OptCard, EarnRule, float] | None = None
        for card in cards:
            for rule in card.rules:
                if rule.choice or "everyday" not in rule.categories:
                    continue
                eff = _elevated_fraction(rule, card.cents_per_point)
                if best is None or eff > best[2]:
                    best = (card, rule, eff)
        return (best[0], best[1]) if best else None

    def best_rule_on(card: OptCard, cat: str) -> EarnRule | None:
        applicable = [r for r in card.rules if not r.choice and _rule_applies(r, cat)]
        applicable += [r for r in card.rules if r.choice and cat in r.categories]
        if not applicable:
            return None
        return max(applicable, key=lambda r: _elevated_fraction(r, card.cents_per_point))

    breakdown: list[CategoryBreakdown] = []
    total_rewards = 0.0
    for cat, amount in spend.items():
        card: OptCard | None = None
        rule: EarnRule | None = None
        if cat in usage and usage[cat] in by_id:
            card = by_id[usage[cat]]
            rule = best_rule_on(card, cat)
        if rule is None:
            fallback = best_everyday(cat)
            if fallback:
                card, rule = fallback
        if card is None or rule is None:
            breakdown.append(
                CategoryBreakdown(cat, CATEGORY_LABELS[cat], amount, None, None, "—", 0.0, 0.0)
            )
            continue
        earned = _earn(rule, card.cents_per_point, amount)
        total_rewards += earned
        breakdown.append(
            CategoryBreakdown(
                category=cat,
                label=CATEGORY_LABELS[cat],
                spend=amount,
                card_id=card.id,
                card_name=card.name,
                rate=_rate_label(rule),
                earned=round(earned, 2),
                effective_pct=round(earned / amount * 100, 2) if amount else 0.0,
            )
        )
    total_fees = sum(c.annual_fee for c in cards)
    total_spend = sum(spend.values())
    return WalletResult(
        net_annual_value=round(total_rewards - total_fees, 2),
        total_rewards=round(total_rewards, 2),
        total_fees=round(total_fees, 2),
        effective_return_pct=round(total_rewards / total_spend * 100, 2) if total_spend else 0.0,
        breakdown=breakdown,
    )


@dataclass
class ScenarioComparison:
    """The "Should I get this card?" answer: three scenarios + a verdict."""

    keep: WalletResult  # A — current cards, current habits
    reallocate: WalletResult  # C — current cards, optimal assignment
    add: WalletResult  # B — current cards + the candidate, optimal
    candidate_id: str
    candidate_name: str
    candidate_fee: float
    gain_from_reallocating: float  # C.net - A.net
    gain_from_adding: float  # B.net - C.net (incremental, over using current cards well)
    worth_it: bool  # is opening the new card the best move?
    verdict: str  # one-line, plain-English recommendation


def evaluate_card(
    spend: dict[str, float],
    owned: list[OptCard],
    usage: dict[str, str],
    candidate: OptCard,
) -> ScenarioComparison:
    """Compare keeping, reallocating, and adding `candidate` — the headline flow."""
    keep = _current_usage(spend, owned, usage)
    reallocate = optimize_wallet(spend, owned)
    add = optimize_wallet(spend, [*owned, candidate])

    gain_realloc = round(reallocate.net_annual_value - keep.net_annual_value, 2)
    gain_add = round(add.net_annual_value - reallocate.net_annual_value, 2)
    worth_it = gain_add > 0

    if worth_it:
        verdict = (
            f"Worth it: {candidate.name} adds ${gain_add:,.0f}/yr after its "
            f"${candidate.annual_fee:,.0f} fee, beyond using your current cards optimally."
        )
    elif gain_realloc > 0:
        verdict = (
            f"Skip it. Reallocating your current cards gains ${gain_realloc:,.0f}/yr for $0 — "
            f"{candidate.name}'s rewards don't beat that after its ${candidate.annual_fee:,.0f} fee."
        )
    else:
        verdict = (
            f"Skip it. {candidate.name} doesn't beat your current wallet after its "
            f"${candidate.annual_fee:,.0f} fee."
        )

    return ScenarioComparison(
        keep=keep,
        reallocate=reallocate,
        add=add,
        candidate_id=candidate.id,
        candidate_name=candidate.name,
        candidate_fee=candidate.annual_fee,
        gain_from_reallocating=gain_realloc,
        gain_from_adding=gain_add,
        worth_it=worth_it,
        verdict=verdict,
    )
