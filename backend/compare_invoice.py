"""Compares what NOVA estimated a day cost with what the Nebius invoice says, and says what to change if they differ.

    cd backend && python -m compare_invoice 2026-10-21 0.42       # the day (UTC) and the invoice amount in US dollars
Reads the usage records from the store named in .env (Upstash Redis); the estimate uses NOVA_PRICE_INPUT_PER_M and NOVA_PRICE_OUTPUT_PER_M.
"""
import asyncio
import sys
from pathlib import Path

import llm
import pricing
import usage


def verdict(estimated: float, invoiced: float) -> str:
    if not estimated:
        return "NOVA recorded no cost for that day, so there is nothing to compare."
    ratio = invoiced / estimated
    price = pricing.current_price()
    line = f"estimated ${estimated:.4f}, invoiced ${invoiced:.4f}: the invoice is {ratio:.2f} times the estimate."
    if 0.9 <= ratio <= 1.1:
        return line + " The price settings are close enough."
    return line + f" To match, set NOVA_PRICE_INPUT_PER_M={price.input_per_million * ratio:.4f} and NOVA_PRICE_OUTPUT_PER_M={price.output_per_million * ratio:.4f}."


async def compare(day: str, invoiced: float) -> str:
    report = await usage.report_for_day(day, list(dict.fromkeys([llm.generate_model(), llm.tutor_model()])))
    totals = report["totals"]
    return f"{day}: {totals['calls']} calls, {totals['prompt_tokens'] + totals['completion_tokens']} tokens; " + verdict(totals["cost_usd"], invoiced)


if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent.parent / ".env")
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    print(asyncio.run(compare(sys.argv[1], float(sys.argv[2]))))
