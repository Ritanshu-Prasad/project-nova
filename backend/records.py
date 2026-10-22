import json
import logging
import time

import shared

logger = logging.getLogger("nova.records")

KEEP_SECONDS = 7 * 24 * 3600


def _key(name: str, stamp: float) -> str:
    return f"nova:{name}:" + time.strftime("%Y-%m-%d", time.gmtime(stamp))


async def push(name: str, record: dict, cap: int) -> None:
    """Keeps the newest `cap` records of the day under `name` for a week; a store that cannot be reached never hurts the request."""
    try:
        await shared.state.push_capped(_key(name, time.time()), json.dumps(record), cap, KEEP_SECONDS)
    except shared.StateError as error:
        logger.warning("%s record not saved: %s", name, error)


async def newest(name: str, cap: int) -> list[dict]:
    """The records of today and yesterday, newest first."""
    found: list[dict] = []
    for stamp in (time.time(), time.time() - 86400):
        try:
            found += map(json.loads, await shared.state.recent(_key(name, stamp), cap))
        except shared.StateError as error:
            logger.warning("%s records not read: %s", name, error)
    return sorted(found, key=lambda record: record["time"], reverse=True)
