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


# --- Each model has its own price ---

def test_models_are_priced_by_their_catalog_listing():
    assert pricing.price_for("nvidia/Nemotron-3_5-Lightning") == Price(0.06, 0.24)
    assert pricing.price_for("nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B") == Price(0.06, 0.24)
    assert pricing.price_for("deepseek-ai/DeepSeek-V4-Flash-0731") == Price(0.14, 0.28)
    assert cost_usd(1_000_000, 1_000_000, model="deepseek-ai/DeepSeek-V4-Flash-0731") == pytest.approx(0.42)


def test_an_unlisted_model_is_priced_like_the_default():
    assert pricing.price_for("some/other-model") == current_price() == pricing.price_for(None)


def test_a_price_set_in_the_environment_applies_to_every_model(monkeypatch):
    monkeypatch.setenv("NOVA_PRICE_INPUT_PER_M", "1")
    monkeypatch.setenv("NOVA_PRICE_OUTPUT_PER_M", "2")
    assert pricing.price_for("deepseek-ai/DeepSeek-V4-Flash-0731") == pricing.price_for("nvidia/Nemotron-3_5-Lightning") == Price(1, 2)


def test_a_request_is_priced_call_by_call_with_each_calls_model():
    import asyncio

    import usage

    spent = usage.begin()
    asyncio.run(usage.record_call("outline", "deepseek-ai/DeepSeek-V4-Flash-0731", {"prompt_tokens": 1_000_000, "completion_tokens": 0}, 1.0))
    asyncio.run(usage.record_call("lesson", "nvidia/Nemotron-3_5-Lightning", {"prompt_tokens": 1_000_000, "completion_tokens": 0}, 1.0))
    assert spent.cost_usd == pytest.approx(0.14 + 0.06)
