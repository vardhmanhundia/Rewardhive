"""Unit tests for the which-card ranking (pure, no DB/LLM).

These pin the behaviour the rewards feature rests on: a specific merchant deal
(United flights, IHG) outranks a generic category rule, a plain category question
picks the best category rate, two named cards compare correctly, and an unmapped
purchase falls back to an everyday rule.
"""

from src.services.optimizer_service import card_to_optcard, rank_cards_for_purchase


def _united():
    return card_to_optcard(
        "united-explorer",
        "United℠ Explorer Card",
        "United",
        150,
        [
            {"category": "Eligible United flights (6x base + 3x card)", "rate": "9x"},
            {"category": "Hotel stays booked with the hotel", "rate": "2x"},
            {"category": "Dining (incl. eligible delivery)", "rate": "2x"},
            {"category": "All other purchases", "rate": "1x"},
        ],
    )


def _flat():
    return card_to_optcard(
        "unlimited-cash-rewards",
        "Unlimited Cash Rewards",
        "Bank of America",
        0,
        [{"category": "All purchases", "rate": "1.5%"}],
    )


def _amex_gold():
    return card_to_optcard(
        "amex-gold",
        "American Express® Gold Card",
        "American Express",
        325,
        [
            {"category": "Restaurants worldwide (up to $50k/yr, then 1x)", "rate": "4x"},
            {"category": "U.S. supermarkets (up to $25k/yr, then 1x)", "rate": "4x"},
            {"category": "All other purchases", "rate": "1x"},
        ],
    )


def _bcp():
    return card_to_optcard(
        "amex-blue-cash-preferred",
        "Blue Cash Preferred® Card",
        "American Express",
        95,
        [
            {"category": "U.S. supermarkets (up to $6,000/yr, then 1%)", "rate": "6%"},
            {"category": "All other purchases", "rate": "1%"},
        ],
    )


def test_specific_deal_outranks_generic_card():
    """A United flight should pick the United card's 9x flights line, not flat cash."""
    picks = rank_cards_for_purchase("travel", ["united", "flight", "airline"], [_flat(), _united()])
    assert picks[0].card_id == "united-explorer"
    assert picks[0].specific is True
    assert picks[0].rate == "9x"
    # 9x * 1.2c/pt = 10.8% effective, well above the 1.5% flat card.
    assert picks[0].effective_pct > picks[1].effective_pct


def test_plain_category_compares_both_cards():
    """A grocery question with no specific merchant ranks each card's grocery rate."""
    picks = rank_cards_for_purchase("groceries", ["grocer", "supermarket"], [_bcp(), _amex_gold()])
    assert {p.card_id for p in picks} == {"amex-blue-cash-preferred", "amex-gold"}
    # BCP earns 6% cash; Amex Gold earns 4x * 1.5c/pt = 6% — both land at 6%.
    assert all(p.effective_pct == 6.0 for p in picks)


def test_est_value_uses_monthly_amount():
    picks = rank_cards_for_purchase(
        "groceries", ["grocer", "supermarket"], [_bcp()], monthly_amount=500
    )
    # 6% of $6,000/yr = $360 (cap is $6,000/yr, so the whole year is at 6%).
    assert picks[0].est_annual_value == 360.0


def test_unmapped_purchase_falls_back_to_everyday():
    """A purchase that maps to no category still gets the flat everyday card."""
    picks = rank_cards_for_purchase(None, ["stamps", "post office"], [_flat()])
    assert len(picks) == 1
    assert picks[0].card_id == "unlimited-cash-rewards"
    assert picks[0].specific is False


def _reserve():
    return card_to_optcard(
        "chase-sapphire-reserve",
        "Chase Sapphire Reserve®",
        "Chase",
        795,
        [
            {"category": "Chase Travel (incl. The Edit)", "rate": "8x"},
            {"category": "Flights booked direct", "rate": "4x"},
            {"category": "Hotels booked direct", "rate": "4x"},
            {"category": "Dining worldwide", "rate": "3x"},
            {"category": "All other purchases", "rate": "1x"},
        ],
    )


def _preferred():
    return card_to_optcard(
        "chase-sapphire-preferred",
        "Chase Sapphire Preferred®",
        "Chase",
        95,
        [
            {"category": "Chase Travel", "rate": "5x"},
            {"category": "Dining", "rate": "3x"},
            {"category": "All other travel", "rate": "2x"},
            {"category": "All other purchases", "rate": "1x"},
        ],
    )


def test_channel_restricted_rates_not_credited_to_airbnb():
    """An Airbnb booked directly is not a Chase-Travel booking nor a hotel booked
    direct, so those rates must not apply — only a general travel rate should."""
    picks = rank_cards_for_purchase(
        "travel", ["airbnb", "vacation rental"], [_reserve(), _preferred()]
    )
    # No portal / booked-direct line should be credited.
    labels = [p.reward_label for p in picks]
    assert not any("Chase Travel" in label or "booked direct" in label for label in labels)
    # The Preferred's general "2x All other travel" (3%) beats the Reserve's
    # fallback 1x everyday — and it is not a "special deal".
    assert picks[0].card_id == "chase-sapphire-preferred"
    assert picks[0].reward_label == "All other travel"
    assert picks[0].specific is False


def test_portal_hint_unlocks_portal_rate():
    """When the user says they book through the Chase travel portal, the 8x line
    applies and wins."""
    picks = rank_cards_for_purchase(
        "travel", ["airbnb", "chase travel"], [_reserve(), _preferred()]
    )
    assert picks[0].card_id == "chase-sapphire-reserve"
    assert "Chase Travel" in picks[0].reward_label
    assert picks[0].specific is True


def test_card_without_applicable_rule_is_dropped():
    """A card with no matching, category, or everyday rule is not ranked."""
    dining_only = card_to_optcard(
        "dining-only", "Dining Only", "X", 0, [{"category": "Dining", "rate": "4x"}]
    )
    picks = rank_cards_for_purchase("groceries", ["grocer"], [dining_only])
    assert picks == []
