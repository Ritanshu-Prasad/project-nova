import pytest

import pricing
from pricing import Price, cost_usd, current_price


def test_the_default_price_is_the_nano_listing():
    assert current_price() == Price(0.06, 0.24)


def test_the_price_follows_the_environment(monkeypatch):
    monkeypatch.setenv("NOVA_PRICE_INPUT_PER_M", "0.10")
    monkeypatch.setenv("NOVA_PRICE_OUTPUT_PER_M", "0.50")
    assert current_price() == Price(0.10, 0.50)


def test_a_setting_that_is_not_a_number_falls_back_and_says_so(monkeypatch, caplog):
    monkeypatch.setenv("NOVA_PRICE_INPUT_PER_M", "cheap")
    assert current_price().input_per_million == pricing.DEFAULT_INPUT_PER_MILLION
    assert "NOVA_PRICE_INPUT_PER_M is not a number" in caplog.text


def test_cost_is_per_million_tokens_with_separate_input_and_output_rates():
    assert cost_usd(1_000_000, 0) == pytest.approx(0.06)
    assert cost_usd(0, 1_000_000) == pytest.approx(0.24)
    assert cost_usd(500_000, 250_000) == pytest.approx(0.03 + 0.06)


def test_no_tokens_cost_nothing():
    assert cost_usd(0, 0) == 0.0


def test_a_price_can_be_given_directly():
    assert cost_usd(2_000_000, 1_000_000, Price(1.0, 3.0)) == pytest.approx(5.0)


def test_a_typical_nano_course_costs_a_fraction_of_a_cent():
    assert cost_usd(4000, 1000) < 0.001
