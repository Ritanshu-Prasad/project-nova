import logging
import os
from dataclasses import dataclass

logger = logging.getLogger("nova.pricing")

# Public listings for Nemotron 3 Nano on Nebius; an estimate to compare with the Nebius console, not an invoice.
DEFAULT_INPUT_PER_MILLION = 0.06
DEFAULT_OUTPUT_PER_MILLION = 0.24


@dataclass(frozen=True)
class Price:
    input_per_million: float
    output_per_million: float


def current_price() -> Price:
    return Price(_setting("NOVA_PRICE_INPUT_PER_M", DEFAULT_INPUT_PER_MILLION), _setting("NOVA_PRICE_OUTPUT_PER_M", DEFAULT_OUTPUT_PER_MILLION))


def cost_usd(prompt_tokens: int, completion_tokens: int, price: Price | None = None) -> float:
    price = price or current_price()
    return (prompt_tokens * price.input_per_million + completion_tokens * price.output_per_million) / 1_000_000


def _setting(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        logger.warning("%s is not a number, using %s", name, default)
        return default
