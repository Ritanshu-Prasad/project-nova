import asyncio
import io

import pytest
from fastapi import HTTPException, UploadFile

import pdf_parser
from pdf_parser import Page, build_context, extract_pages


def upload(name: str, data: bytes) -> UploadFile:
    return UploadFile(file=io.BytesIO(data), filename=name)


def extract(*files: UploadFile):
    return asyncio.run(extract_pages(list(files)))


def status_of(*files: UploadFile) -> int:
    with pytest.raises(HTTPException) as error:
        extract(*files)
    return error.value.status_code


# --- extract_pages ---

def test_reads_text_with_document_and_page_number(pdf):
    pages = extract(upload("bio.pdf", pdf("Plants use light")))
    assert [(p.doc, p.number, p.text) for p in pages] == [("bio.pdf", 1, "Plants use light")]


def test_reads_several_files_in_order(pdf):
    pages = extract(upload("a.pdf", pdf("First")), upload("b.pdf", pdf("Second")))
    assert [p.doc for p in pages] == ["a.pdf", "b.pdf"]


def test_corrupt_file_is_422():
    assert status_of(upload("bad.pdf", b"not a pdf")) == 422


def test_no_files_is_422():
    assert status_of() == 422


def test_more_than_five_files_is_422(pdf):
    assert status_of(*[upload(f"{i}.pdf", pdf("text")) for i in range(6)]) == 422


def test_pdf_without_text_is_422(pdf):
    assert status_of(upload("empty.pdf", pdf(""))) == 422


def test_files_over_the_size_limit_are_413(pdf, monkeypatch):
    monkeypatch.setattr(pdf_parser, "MAX_TOTAL_BYTES", 10)
    assert status_of(upload("big.pdf", pdf("some text"))) == 413


# --- build_context ---

def test_context_tags_each_page_with_document_and_page():
    context = build_context([Page("a.pdf", 1, "alpha"), Page("a.pdf", 2, "beta")])
    assert context == "[a.pdf p.1]\nalpha\n\n[a.pdf p.2]\nbeta"


def test_context_stops_at_the_limit():
    pages = [Page("a.pdf", n, "x" * 100) for n in range(1, 6)]
    context = build_context(pages, limit=250)
    assert context.count("[a.pdf") == 2


# --- _clean ---

def test_clean_drops_blank_lines_and_collapses_spaces():
    assert pdf_parser._clean("one   two\n\n   \nthree\t four") == "one two\nthree four"
