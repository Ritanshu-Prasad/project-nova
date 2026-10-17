"""Copies accounts from Upstash Redis (or the local file) into Postgres. Safe to run again: existing rows are overwritten with the same data.

  cd backend && python -m migrate_accounts       needs DATABASE_URL, and the Redis settings when the accounts are in Redis
"""

import asyncio
import os
from pathlib import Path

from accounts import FileStore, RedisStore
from store_sql import TABLES, SqlStore


def source_store():
    url = os.getenv("KV_REST_API_URL") or os.getenv("UPSTASH_REDIS_REST_URL")
    token = os.getenv("KV_REST_API_TOKEN") or os.getenv("UPSTASH_REDIS_REST_TOKEN")
    if url and token:
        return RedisStore(url, token)
    return FileStore(Path(__file__).parent / ".data" / "accounts.json")


async def migrate(source, target) -> dict[str, int]:
    """Copies every user and save from `source` to `target`; returns how many of each."""
    copied = {}
    for prefix, table in TABLES.items():
        keys = await source.keys(prefix)
        for key in keys:
            await target.set(key, await source.get(key))
        copied[table.name] = len(keys)
    return copied


if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent.parent / ".env")
    print(asyncio.run(migrate(source_store(), SqlStore(os.environ["DATABASE_URL"]))))
