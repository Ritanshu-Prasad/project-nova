import asyncio
import json

import pytest
from fastapi import HTTPException

import accounts
import migrate_accounts
import store_sql
from store_sql import SqlStore

USER = json.dumps({"sub": "google:1", "email": "a@example.com", "name": "Ann", "createdAt": 10, "lastLoginAt": 20})
SAVE = json.dumps({"savedAt": 99, "save": {"xp": 5}})


class FakeConnection:
    """Keeps rows per table like the real database would, and records the statements."""

    tables: dict = {}
    statements: list = []

    async def execute(self, sql, params=None):
        self.statements.append(sql)
        if sql.startswith("INSERT"):
            table = sql.split()[2]
            self.tables.setdefault(table, {})[params[0]] = params
        if sql.startswith("SELECT"):
            table = sql.split()[3]
            row = self.tables.get(table, {}).get(params[0])
            return _Result([(row[-1],)] if row else [])
        return _Result([])

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return False


class _Result:
    def __init__(self, rows):
        self.rows = rows

    async def fetchone(self):
        return self.rows[0] if self.rows else None


@pytest.fixture
def database(monkeypatch):
    FakeConnection.tables, FakeConnection.statements = {}, []

    async def connect(url, autocommit):
        return FakeConnection()

    monkeypatch.setattr(store_sql.psycopg.AsyncConnection, "connect", connect)
    return FakeConnection


def run(coroutine):
    return asyncio.run(coroutine)


def test_a_user_is_saved_with_queryable_columns(database):
    run(SqlStore("postgres://x").set("nova:user:google:1", USER))
    assert database.tables["users"]["google:1"] == ["google:1", "a@example.com", "Ann", 10, 20, USER]


def test_a_save_is_saved_with_its_time(database):
    run(SqlStore("postgres://x").set("nova:save:google:1", SAVE))
    assert database.tables["saves"]["google:1"] == ["google:1", 99, SAVE]


def test_reading_returns_the_exact_json_that_was_saved(database):
    store = SqlStore("postgres://x")
    run(store.set("nova:user:google:1", USER))
    assert run(store.get("nova:user:google:1")) == USER


def test_a_missing_account_reads_as_none(database):
    assert run(SqlStore("postgres://x").get("nova:user:nobody")) is None


def test_the_tables_are_created_once(database):
    store = SqlStore("postgres://x")
    run(store.get("nova:user:a")), run(store.get("nova:user:b"))
    assert sum("CREATE TABLE" in sql for sql in database.statements) == 1


def test_a_key_that_belongs_to_no_table_is_refused(database):
    with pytest.raises(ValueError):
        run(SqlStore("postgres://x").get("nova:other:1"))


def test_a_database_failure_is_a_502(monkeypatch):
    async def connect(url, autocommit):
        raise store_sql.psycopg.OperationalError("down")

    monkeypatch.setattr(store_sql.psycopg.AsyncConnection, "connect", connect)
    with pytest.raises(HTTPException) as error:
        run(SqlStore("postgres://x").get("nova:user:a"))
    assert error.value.status_code == 502


def test_database_url_selects_the_sql_store(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgres://x")
    assert isinstance(accounts._make_store(), SqlStore)


# --- Moving existing accounts ---

def test_migration_copies_users_and_saves(tmp_path, database):
    source = accounts.FileStore(tmp_path / "accounts.json")
    run(source.set("nova:user:google:1", USER)), run(source.set("nova:save:google:1", SAVE))
    target = SqlStore("postgres://x")
    assert run(migrate_accounts.migrate(source, target)) == {"users": 1, "saves": 1}
    assert run(target.get("nova:save:google:1")) == SAVE


def test_migrating_twice_changes_nothing(tmp_path, database):
    source = accounts.FileStore(tmp_path / "accounts.json")
    run(source.set("nova:user:google:1", USER))
    target = SqlStore("postgres://x")
    run(migrate_accounts.migrate(source, target)), run(migrate_accounts.migrate(source, target))
    assert len(database.tables["users"]) == 1
