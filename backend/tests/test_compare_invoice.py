import asyncio

import compare_invoice
import llm
import usage


def run(coroutine):
    return asyncio.run(coroutine)


def test_a_close_invoice_leaves_the_prices_alone():
    assert "close enough" in compare_invoice.verdict(0.0100, 0.0104)


def test_a_higher_invoice_suggests_scaled_prices():
    text = compare_invoice.verdict(0.01, 0.02)
    assert "2.00 times" in text and "NOVA_PRICE_INPUT_PER_M=0.1200" in text and "NOVA_PRICE_OUTPUT_PER_M=0.4800" in text


def test_a_day_without_usage_has_nothing_to_compare():
    assert "nothing to compare" in compare_invoice.verdict(0, 0.5)


def test_the_day_is_read_from_the_ledger():
    run(usage.record_call("lesson", llm.generate_model(), {"prompt_tokens": 1_000_000, "completion_tokens": 0}, 1.0))
    today = usage._day()
    text = run(compare_invoice.compare(today, 0.06))
    assert "1 calls, 1000000 tokens" in text and "close enough" in text
