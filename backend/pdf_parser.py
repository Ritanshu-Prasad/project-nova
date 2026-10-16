import io
from dataclasses import dataclass

from fastapi import HTTPException, UploadFile
from pypdf import PdfReader
from pypdf.errors import PyPdfError

MAX_FILES = 5
MAX_TOTAL_BYTES = 50 * 1024 * 1024


@dataclass
class Page:
    doc: str
    number: int
    text: str


async def extract_pages(files: list[UploadFile]) -> list[Page]:
    if not 1 <= len(files) <= MAX_FILES:
        raise HTTPException(422, f"Upload between 1 and {MAX_FILES} PDF files")

    pages: list[Page] = []
    total = 0
    for file in files:
        data = await file.read(MAX_TOTAL_BYTES - total + 1)
        total += len(data)
        if total > MAX_TOTAL_BYTES:
            raise HTTPException(413, "The PDFs are larger than 50 MB in total")
        pages += _read_pdf(file.filename or "document.pdf", data)

    if not any(page.text for page in pages):
        raise HTTPException(422, "No readable text found in the PDFs")
    return pages


def build_context(pages: list[Page], limit: int = 60_000) -> str:
    parts, size = [], 0
    for page in pages:
        part = f"[{page.doc} p.{page.number}]\n{page.text}"
        if size + len(part) > limit:
            break
        parts.append(part)
        size += len(part)
    return "\n\n".join(parts)


def _read_pdf(name: str, data: bytes) -> list[Page]:
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise HTTPException(422, f"{name} is password protected")
        return [Page(name, number, _clean(page.extract_text() or "")) for number, page in enumerate(reader.pages, start=1)]
    except (PyPdfError, ValueError, KeyError):
        raise HTTPException(422, f"{name} could not be read as a PDF")


def _clean(text: str) -> str:
    lines = (" ".join(line.split()) for line in text.splitlines())
    return "\n".join(line for line in lines if line)
