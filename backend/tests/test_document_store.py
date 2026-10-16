import asyncio

import pytest

import document_store
import shared
from document_store import delete_pages, is_valid_key, load_index, save_pages
from pdf_parser import Document, Page


def run(coro):
    return asyncio.run(coro)


def docs(*texts: str, name: str = "bio.pdf") -> list:
    return [Document(name, [Page(name, number, text) for number, text in enumerate(texts, start=1)])]


# --- Saving and finding ---

def test_saved_pages_can_be_searched_again():
    key = run(save_pages(docs("The Calvin cycle uses rubisco.", "Glycolysis happens in the cytoplasm.")))
    index = run(load_index(key))
    assert index.search("rubisco", 1)[0].page == 1 and index.search("glycolysis", 1)[0].page == 2


def test_the_key_is_a_long_random_secret():
    first, second = run(save_pages(docs("text"))), run(save_pages(docs("text")))
    assert is_valid_key(first) and first != second and len(first) == 32


def test_pages_of_several_documents_are_kept_together():
    key = run(save_pages(docs("alpha text", name="a.pdf") + docs("beta text", name="b.pdf")))
    assert {chunk.doc for chunk in run(load_index(key)).chunks} == {"a.pdf", "b.pdf"}


def test_a_large_document_is_kept_in_several_parts(monkeypatch):
    monkeypatch.setattr(document_store, "PART_CHARS", 20)
    key = run(save_pages(docs(*["x" * 15] * 5)))
    parts = [name for name in shared.state.entries if name.startswith(f"nova:docs:{key}:")]
    assert len(parts) == 5 and len(run(load_index(key)).chunks) == 5


def test_everything_is_kept_with_an_expiry(monkeypatch):
    stored = []

    class Recording(shared.MemoryState):
        async def put(self, key, value, ttl_seconds):
            stored.append(ttl_seconds)
            await super().put(key, value, ttl_seconds)

    monkeypatch.setattr(shared, "state", Recording())
    run(save_pages(docs("text")))
    assert stored and set(stored) == {30 * 24 * 3600}


def test_nothing_is_found_under_an_unknown_key():
    assert run(load_index("0" * 32)) is None


def test_expired_pages_are_gone(monkeypatch):
    now = [100.0]
    monkeypatch.setattr(shared.time, "monotonic", lambda: now[0])
    key = run(save_pages(docs("text")))
    document_store._indexes.clear()
    now[0] += 31 * 24 * 3600
    assert run(load_index(key)) is None


def test_an_index_is_built_once_and_reused():
    key = run(save_pages(docs("some text")))
    assert run(load_index(key)) is run(load_index(key))


def test_only_a_few_indexes_are_kept_in_memory(monkeypatch):
    monkeypatch.setattr(document_store, "INDEXES_KEPT", 2)
    keys = [run(save_pages(docs(f"text {n}"))) for n in range(3)]
    for key in keys:
        run(load_index(key))
    assert list(document_store._indexes) == keys[1:]


# --- Forgetting ---

def test_deleted_pages_cannot_be_read_again():
    key = run(save_pages(docs("text")))
    run(load_index(key))
    run(delete_pages(key))
    assert run(load_index(key)) is None and not [name for name in shared.state.entries if key in name]


def test_deleting_an_unknown_key_is_harmless():
    run(delete_pages("f" * 32))


# --- When the store is down ---

class Down:
    async def put(self, key, value, ttl_seconds):
        raise shared.StateError("down")

    async def get(self, key):
        raise shared.StateError("down")

    async def delete(self, key):
        raise shared.StateError("down")


def test_pages_that_cannot_be_kept_give_no_key(monkeypatch):
    monkeypatch.setattr(shared, "state", Down())
    assert run(save_pages(docs("text"))) is None


def test_pages_that_cannot_be_read_give_no_index(monkeypatch):
    monkeypatch.setattr(shared, "state", Down())
    assert run(load_index("a" * 32)) is None


def test_a_failed_delete_does_not_raise(monkeypatch):
    monkeypatch.setattr(shared, "state", Down())
    run(delete_pages("a" * 32))


# --- Keys ---

@pytest.mark.parametrize("key", ["0" * 32, "abcdef0123456789" * 2])
def test_proper_keys_are_accepted(key):
    assert is_valid_key(key)


@pytest.mark.parametrize("key", ["", "short", "G" * 32, "0" * 31, "0" * 33, "../" + "0" * 29, "0" * 31 + "\n"])
def test_anything_else_is_not_a_key(key):
    assert not is_valid_key(key)
