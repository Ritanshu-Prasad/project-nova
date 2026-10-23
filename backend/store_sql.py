import json
import logging
from contextlib import asynccontextmanager
from typing import NamedTuple

try:
    import psycopg
except ImportError:
    class _PsycopgStub:
        class AsyncConnection:
            @classmethod
            async def connect(cls, *args, **kwargs):
                raise RuntimeError("psycopg is not installed. Install psycopg[binary] to use SqlStore.")

        class Error(Exception):
            pass

        class DatabaseError(Error):
            pass

        class OperationalError(DatabaseError):
            pass

        class IntegrityError(DatabaseError):
            pass

        class ProgrammingError(DatabaseError):
            pass

    psycopg = _PsycopgStub()

from fastapi import HTTPException

logger = logging.getLogger("nova.store_sql")


class Table(NamedTuple):
    name: str
    columns: dict[str, str]  # column -> field of the JSON it is copied from, so the table can be queried


TABLES = {
    "nova:user:": Table("users", {"email": "email", "name": "name", "created_at": "createdAt", "last_login_at": "lastLoginAt"}),
    "nova:save:": Table("saves", {"saved_at": "savedAt"}),
}

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (sub text PRIMARY KEY, email text, name text, created_at bigint, last_login_at bigint, data text NOT NULL);
CREATE INDEX IF NOT EXISTS users_email ON users (email);
CREATE TABLE IF NOT EXISTS saves (sub text PRIMARY KEY, saved_at bigint, data text NOT NULL);
"""


class SqlStore:
    """Accounts in Postgres (Neon): a users table and a saves table to query, with the whole JSON kept in `data`."""

    def __init__(self, url: str):
        self.url = url
        self.ready = False

    async def get(self, key: str) -> str | None:
        table, sub = _locate(key)
        async with self._connection() as conn:
            row = await (await conn.execute(f"SELECT data FROM {table.name} WHERE sub = %s", (sub,))).fetchone()
        return row[0] if row else None

    async def set(self, key: str, value: str) -> None:
        table, sub = _locate(key)
        fields = json.loads(value)
        names = ["sub", *table.columns, "data"]
        values = [sub, *(fields.get(field) for field in table.columns.values()), value]
        updates = ", ".join(f"{name} = EXCLUDED.{name}" for name in names[1:])
        sql = f"INSERT INTO {table.name} ({', '.join(names)}) VALUES ({', '.join(['%s'] * len(names))}) ON CONFLICT (sub) DO UPDATE SET {updates}"
        async with self._connection() as conn:
            await conn.execute(sql, values)

    @asynccontextmanager
    async def _connection(self):
        """One short connection per call, which suits serverless functions; the tables are created on first use."""
        try:
            async with await psycopg.AsyncConnection.connect(self.url, autocommit=True) as conn:
                if not self.ready:
                    await conn.execute(SCHEMA)
                    self.ready = True
                yield conn
        except psycopg.Error as error:
            logger.warning("Account database unavailable: %s", error)
            raise HTTPException(502, "Account storage is unavailable")


def _locate(key: str) -> tuple[Table, str]:
    for prefix, table in TABLES.items():
        if key.startswith(prefix):
            return table, key[len(prefix):]
    raise ValueError(f"No table for key {key}")
