"""Tests for the spend-baseline derivation helper."""

from src.agents.commons.spend import derive_spend_baseline


def test_default_baseline_has_all_categories():
    baseline = derive_spend_baseline([], None, None, None, None)
    expected_cats = {"dining", "travel", "groceries", "gas", "online", "everyday"}
    assert set(baseline.keys()) == expected_cats
    assert all(v > 0 for v in baseline.values())


def test_household_scaling():
    single = derive_spend_baseline([], None, None, None, None)
    family = derive_spend_baseline([], 4, None, None, None)
    for cat in ("groceries", "everyday", "dining"):
        assert family[cat] > single[cat]
    assert family["gas"] == single["gas"]


def test_household_string_scaling():
    single = derive_spend_baseline([], None, None, None, None)
    owning = derive_spend_baseline([], None, "owning", None, None)
    assert owning["groceries"] > single["groceries"]


def test_travel_preference_boost():
    base = derive_spend_baseline([], None, None, None, None)
    frequent = derive_spend_baseline([], None, None, "leisure", None)
    assert frequent["travel"] > base["travel"]
    assert frequent["gas"] == base["gas"]


def test_owned_card_category_boost():
    cards = [{"card_id": "abc", "category": "dining"}]
    base = derive_spend_baseline([], None, None, None, None)
    boosted = derive_spend_baseline(cards, None, None, None, None)
    assert boosted["dining"] > base["dining"]
    assert boosted["gas"] == base["gas"]


def test_history_keyword_nudge():
    history = [
        {"role": "user", "content": "I eat out at restaurants all the time, dining is my thing"},
    ]
    base = derive_spend_baseline([], None, None, None, None)
    nudged = derive_spend_baseline([], None, None, None, history)
    assert nudged["dining"] > base["dining"]


def test_no_history_no_crash():
    baseline = derive_spend_baseline([], None, None, None, [])
    assert all(v > 0 for v in baseline.values())
