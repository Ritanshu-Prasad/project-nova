import time
import traceback

import records

NAME = "errors"
MAX_PER_DAY = 200
FRAMES = 5
MESSAGE_CHARS = 300


def build_record(error: BaseException, request_id: str, method: str, path: str) -> dict:
    """An unhandled error: what it was, where it happened (the innermost few frames) and which request it broke."""
    frames = traceback.extract_tb(error.__traceback__)[-FRAMES:]
    return {
        "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "request_id": request_id,
        "method": method,
        "path": path,
        "type": type(error).__name__,
        "message": str(error)[:MESSAGE_CHARS],
        "where": [f"{frame.filename.rsplit('/', 1)[-1]}:{frame.lineno} in {frame.name}" for frame in frames],
    }


async def save(error: BaseException, request_id: str, method: str, path: str) -> None:
    await records.push(NAME, build_record(error, request_id, method, path), MAX_PER_DAY)


async def recent(limit: int) -> list[dict]:
    return (await records.newest(NAME, MAX_PER_DAY))[:limit]
