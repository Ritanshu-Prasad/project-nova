import io
import re
from collections import Counter
from dataclasses import dataclass, field

from fastapi import HTTPException, UploadFile
from pypdf import PdfReader
from pypdf.errors import PyPdfError

MAX_FILES = 5
MAX_TOTAL_BYTES = 50 * 1024 * 1024
PAGES_PER_BLOCK = 8
RUNNING_TEXT_MIN_PAGES = 4
RUNNING_TEXT_SHARE = 0.4
HEADING_LINES = 3

PAGE_NUMBER = re.compile(r"^(page\s*)?\d{1,4}(\s*(of|/)\s*\d{1,4})?$", re.IGNORECASE)
CHAPTER_HEADING = re.compile(r"^(chapter|section|part|unit|lesson)\s+(\d+|[ivxlc]+)\b", re.IGNORECASE)


@dataclass
class Page:
    doc: str
    number: int
    text: str


@dataclass
class Document:
    name: str
    pages: list[Page]
    bookmarks: list[tuple[str, int]] = field(default_factory=list)


@dataclass
class Section:
    doc: str
    title: str
    pages: list[Page]

    @property
    def text(self) -> str:
        return "\n".join(page.text for page in self.pages)


# --- Reading ---

async def read_documents(files: list[UploadFile]) -> list[Document]:
    if not 1 <= len(files) <= MAX_FILES:
        raise HTTPException(422, f"Upload between 1 and {MAX_FILES} PDF files")

    documents: list[Document] = []
    total = 0
    for file in files:
        data = await file.read(MAX_TOTAL_BYTES - total + 1)
        total += len(data)
        if total > MAX_TOTAL_BYTES:
            raise HTTPException(413, "The PDFs are larger than 50 MB in total")
        documents.append(_read_pdf(file.filename or "document.pdf", data))

    if not any(page.text for document in documents for page in document.pages):
        raise HTTPException(422, "No readable text found in the PDFs")
    return documents


def _read_pdf(name: str, data: bytes) -> Document:
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise HTTPException(422, f"{name} is password protected")
        pages = [Page(name, number, _clean(page.extract_text() or "")) for number, page in enumerate(reader.pages, start=1)]
        return Document(name, strip_running_text(pages), _read_bookmarks(reader))
    except (PyPdfError, ValueError, KeyError):
        raise HTTPException(422, f"{name} could not be read as a PDF")


def _clean(text: str) -> str:
    lines = (" ".join(line.split()) for line in text.splitlines())
    return "\n".join(line for line in lines if line)


# --- Cleaning ---

def strip_running_text(pages: list[Page]) -> list[Page]:
    """Removes page numbers and any short line repeated on many pages, such as running headers and footers."""
    repeated = _repeated_lines(pages)
    return [Page(page.doc, page.number, _without(page.text, repeated)) for page in pages]


def _repeated_lines(pages: list[Page]) -> set[str]:
    if len(pages) < RUNNING_TEXT_MIN_PAGES:
        return set()
    counts = Counter(key for page in pages for key in {_line_key(line) for line in page.text.splitlines()})
    threshold = max(3, len(pages) * RUNNING_TEXT_SHARE)
    return {key for key, count in counts.items() if count >= threshold}


def _without(text: str, repeated: set[str]) -> str:
    kept = [line for line in text.splitlines() if not PAGE_NUMBER.match(line) and _line_key(line) not in repeated]
    return "\n".join(kept)


def _line_key(line: str) -> str:
    return re.sub(r"\d+", "#", line.strip().lower())


# --- Sections ---

def split_sections(document: Document) -> list[Section]:
    """Chapters from the PDF bookmarks, else from chapter headings, else even blocks of pages."""
    starts = document.bookmarks or _find_headings(document.pages)
    if len(starts) < 2:
        starts = _page_blocks(document.pages)
    if starts[0][1] > 1:
        starts = [("Introduction", 1)] + starts
    return _sections_from(document, starts)


def _sections_from(document: Document, starts: list[tuple[str, int]]) -> list[Section]:
    ends = [number - 1 for _, number in starts[1:]] + [len(document.pages)]
    sections = []
    for (title, first), last in zip(starts, ends):
        pages = [page for page in document.pages if first <= page.number <= last]
        if any(page.text for page in pages):
            sections.append(Section(document.name, title, pages))
    return sections


def _read_bookmarks(reader: PdfReader) -> list[tuple[str, int]]:
    try:
        entries = [(str(item.title).strip(), reader.get_destination_page_number(item) + 1) for item in reader.outline if not isinstance(item, list)]
    except (PyPdfError, ValueError, KeyError, AttributeError):
        return []
    return _in_page_order(entries)


def _find_headings(pages: list[Page]) -> list[tuple[str, int]]:
    headings = []
    for page in pages:
        for line in page.text.splitlines()[:HEADING_LINES]:
            if CHAPTER_HEADING.match(line):
                headings.append((line[:80], page.number))
                break
    return _in_page_order(headings)


def _page_blocks(pages: list[Page]) -> list[tuple[str, int]]:
    return [(f"Pages {page.number} to {min(page.number + PAGES_PER_BLOCK - 1, len(pages))}", page.number) for page in pages[::PAGES_PER_BLOCK]]


def _in_page_order(entries: list[tuple[str, int]]) -> list[tuple[str, int]]:
    unique = {}
    for title, number in sorted(entries, key=lambda entry: entry[1]):
        unique.setdefault(number, title)
    return [(title, number) for number, title in unique.items()]
