import json
import logging
import re
import secrets
from collections import OrderedDict

import shared
from pdf_parser import Document, Page
from retrieval import Bm25Index, chunk_pages

logger = logging.getLogger("nova.documents")

TTL_SECONDS = 30 * 24 * 3600
PART_CHARS = 300_000
INDEXES_KEPT = 8
KEY = re.compile(r"^[0-9a-f]{32}$")

_indexes: OrderedDict = OrderedDict()


def is_valid_key(key: str) -> bool:
    return bool(KEY.match(key))


# --- Saving ---

async def save_pages(documents: list[Document]) -> str | None:
    """Keeps the text of the uploaded pages for the tutor under a secret key; None if it cannot be kept."""
    key = secrets.token_hex(16)
    parts = _split([[page.doc, page.number, page.text] for document in documents for page in document.pages])
    try:
        for number, part in enumerate(parts):
            await shared.state.put(_part_key(key, number), json.dumps(part), TTL_SECONDS)
        await shared.state.put(_meta_key(key), json.dumps({"parts": len(parts)}), TTL_SECONDS)
    except shared.StateError as error:
        logger.warning("Documents not kept for the tutor: %s", error)
        return None
    return key


def _split(pages: list[list]) -> list[list]:
    parts, current, size = [], [], 0
    for page in pages:
        if current and size + len(page[2]) > PART_CHARS:
            parts.append(current)
            current, size = [], 0
        current.append(page)
        size += len(page[2])
    return parts + [current] if current else parts


# --- Reading and forgetting ---

async def load_index(key: str) -> Bm25Index | None:
    """The search index over the pages kept under `key`, or None if they are gone or cannot be read."""
    if key in _indexes:
        _indexes.move_to_end(key)
        return _indexes[key]
    try:
        meta = await shared.state.get(_meta_key(key))
        if not meta:
            return None
        stored = [json.loads(await shared.state.get(_part_key(key, number)) or "[]") for number in range(json.loads(meta)["parts"])]
    except shared.StateError as error:
        logger.warning("Documents not read for the tutor: %s", error)
        return None
    pages = [Page(doc, number, text) for part in stored for doc, number, text in part]
    index = _indexes[key] = Bm25Index(chunk_pages(pages))
    if len(_indexes) > INDEXES_KEPT:
        _indexes.popitem(last=False)
    return index


async def delete_pages(key: str) -> None:
    _indexes.pop(key, None)
    try:
        meta = await shared.state.get(_meta_key(key))
        for number in range(json.loads(meta)["parts"] if meta else 0):
            await shared.state.delete(_part_key(key, number))
        await shared.state.delete(_meta_key(key))
    except shared.StateError as error:
        logger.warning("Documents not fully deleted: %s", error)


def _meta_key(key: str) -> str:
    return f"nova:docs:{key}"


def _part_key(key: str, number: int) -> str:
    return f"nova:docs:{key}:{number}"
