import logging
import os
from dataclasses import dataclass

from models import DEEPSEEK_MODEL, LIGHTNING_MODEL, NANO_MODEL

logger = logging.getLogger("nova.pricing")

# Public listings in the Nebius Token Factory model catalog (tokenfactory.nebius.com/model-catalog.md); an estimate to
# compare with the Nebius console, not an invoice. Cached input (DeepSeek: $0.01 per million) is not counted separately.
DEFAULT_INPUT_PER_MILLION = 0.06
DEFAULT_OUTPUT_PER_MILLION = 0.24


@dataclass(frozen=True)
class Price:
    input_per_million: float
    output_per_million: float


MODEL_PRICES = {
    NANO_MODEL: Price(0.06, 0.24),
    LIGHTNING_MODEL: Price(0.06, 0.24),
    DEEPSEEK_MODEL: Price(0.14, 0.28),
}


def current_price() -> Price:
    """The price set in the environment, or the Nano/Lightning price (a model that is not listed is priced like that too)."""
    return Price(_setting("NOVA_PRICE_INPUT_PER_M", DEFAULT_INPUT_PER_MILLION), _setting("NOVA_PRICE_OUTPUT_PER_M", DEFAULT_OUTPUT_PER_MILLION))


def price_for(model: str | None) -> Price:
    """What a model costs: NOVA_PRICE_INPUT_PER_M / NOVA_PRICE_OUTPUT_PER_M when set (they apply to every model), else its listed price."""
    if os.getenv("NOVA_PRICE_INPUT_PER_M") or os.getenv("NOVA_PRICE_OUTPUT_PER_M") or model not in MODEL_PRICES:
        return current_price()
    return MODEL_PRICES[model]


def cost_usd(prompt_tokens: int, completion_tokens: int, price: Price | None = None, model: str | None = None) -> float:
    price = price or price_for(model)
    return (prompt_tokens * price.input_per_million + completion_tokens * price.output_per_million) / 1_000_000


def _setting(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        logger.warning("%s is not a number, using %s", name, default)
        return default
