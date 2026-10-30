"""Unit tests for the deterministic wallet optimizer (pure, no DB/LLM).

These pin the behaviours the product's credibility rests on: strict category
matching, cap-aware earnings, points valued below cash, choice-card activation,
and the keep/reallocate/add verdict.
"""

from src.services.optimizer_service import (
    EarnRule,
    OptCard,
    card_to_optcard,
    category_matches,
    evaluate_card,
    optimize_wallet,
)


def _card(card_id, name, issuer, fee, rules, cpp=1.0):
    return OptCard(
        id=card_id,
        name=name,
        issuer=issuer,
        annual_fee=fee,
        cents_per_point=cpp,
        rules=tuple(rules),
    )


def pct(categories, value, cap=None, then=None, choice=False):
    return EarnRule(frozenset(categories), value, "percent", cap, then, choice)


def pts(categories, value, choice=False):
    return EarnRule(frozenset(categories), value, "points", None, None, choice)


# --- strict category matching -------------------------------------------------
def test_online_grocery_is_not_online():
    assert category_matches("Streaming & online grocery", "groceries") is True
    assert category_matches("Streaming & online grocery", "online") is False
    assert category_matches("U.S. online retail", "online") is True


def test_ev_token_does_not_match_everyday_words():
    assert category_matches("Everyday purchases, everywhere", "gas") is False
    assert category_matches("Gas, EV charging & vacation home brands", "gas") is True


# --- normalization / parsing --------------------------------------------------
def test_parses_rate_cap_and_currency():
    card = card_to_optcard(
        "amex-bcp",
        "Blue Cash Preferred® Card",
        "American Express",
        95,
        [{"category": "U.S. supermarkets (up to $6,000/yr, then 1%)", "rate": "6%"}],
    )
    assert card.cents_per_point == 1.5  # Membership Rewards estimate
    (rule,) = card.rules
    assert "groceries" in rule.categories
    assert rule.rate_value == 6 and rule.rate_unit == "percent"
    assert rule.cap_annual == 6000 and rule.then_rate_value == 1


def test_points_vs_percent_unit():
    chase = card_to_optcard("csp", "Chase Sapphire Preferred®", "Chase", 95, [
        {"category": "Dining", "rate": "3x"},
    ])
    (rule,) = chase.rules
    assert rule.rate_unit == "points" and rule.rate_value == 3
    assert chase.cents_per_point == 1.5


# --- optimization math --------------------------------------------------------
def test_assigns_each_category_to_best_card():
    a = _card("a", "A", "X", 0, [pct(["dining"], 3), pct(["everyday"], 1)])
    b = _card("b", "B", "X", 0, [pct(["groceries"], 4), pct(["everyday"], 1)])
    res = optimize_wallet({"dining": 1000, "groceries": 1000}, [a, b])
    by_cat = {x.category: x for x in res.breakdown}
    assert by_cat["dining"].card_id == "a" and by_cat["dining"].earned == 30
    assert by_cat["groceries"].card_id == "b" and by_cat["groceries"].earned == 40
    assert res.net_annual_value == 70


def test_points_valued_below_cash_for_a_cash_category():
    cash = _card("cash", "Cash 3% Gas", "BoA", 0, [pct(["gas"], 3)], cpp=1.0)
    hotel = _card("ihg", "IHG One Rewards", "Chase", 0, [pts(["gas"], 5)], cpp=0.5)  # 5x*0.5 = 2.5%
    res = optimize_wallet({"gas": 1000}, [cash, hotel])
    (row,) = res.breakdown
    assert row.card_id == "cash" and row.earned == 30  # 3% cash beats 5x hotel points


def test_cap_then_lower_rate():
    card = _card("g", "Grocer", "Amex", 0, [pct(["groceries"], 6, cap=6000, then=1)])
    res = optimize_wallet({"groceries": 10000}, [card])
    # 6% on first 6000 + 1% on remaining 4000 = 360 + 40
    assert res.breakdown[0].earned == 400


def test_choice_card_activates_single_best_category():
    choice = _card(
        "cc", "Choice", "BoA", 0, [pct(["dining", "gas"], 3, choice=True), pct(["everyday"], 1)]
    )
    res = optimize_wallet({"dining": 2000, "gas": 1000}, [choice])
    by_cat = {x.category: x for x in res.breakdown}
    # Higher-spend category wins the single choice slot; the other drops to 1%.
    assert by_cat["dining"].effective_pct == 3.0
    assert by_cat["gas"].effective_pct == 1.0


def test_fees_reduce_net_value():
    card = _card("f", "Fee Card", "X", 100, [pct(["everyday"], 2)])
    res = optimize_wallet({"everyday": 1000}, [card])
    assert res.total_rewards == 20 and res.total_fees == 100
    assert res.net_annual_value == -80


# --- the headline scenario comparison ----------------------------------------
def test_evaluate_card_recommends_adding_when_worth_it():
    owned = [_card("flat", "Flat 1.5", "X", 0, [pct(["everyday"], 1.5)])]
    candidate = _card("din", "Dining 4%", "X", 0, [pct(["dining"], 4)])
    spend = {"dining": 5000, "everyday": 2000}
    cmp = evaluate_card(spend, owned, {"everyday": "flat"}, candidate)
    assert cmp.worth_it is True
    assert cmp.gain_from_adding > 0
    assert "Worth it" in cmp.verdict


def test_evaluate_card_says_skip_when_fee_outweighs_gain():
    owned = [_card("din3", "Dining 3%", "X", 0, [pct(["dining"], 3), pct(["everyday"], 1.5)])]
    # Candidate earns only marginally more on dining but charges a steep fee.
    candidate = _card("din35", "Dining 3.5%", "X", 300, [pct(["dining"], 3.5)])
    spend = {"dining": 5000, "everyday": 2000}
    cmp = evaluate_card(spend, owned, {"dining": "din3", "everyday": "din3"}, candidate)
    assert cmp.worth_it is False
    assert "Skip" in cmp.verdict
