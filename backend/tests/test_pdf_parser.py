import asyncio
import io
import time

import pytest
from fastapi import HTTPException, UploadFile

import pdf_parser
from pdf_parser import Document, Page, read_documents, split_sections, strip_running_text


def upload(name: str, data: bytes) -> UploadFile:
    return UploadFile(file=io.BytesIO(data), filename=name)


def read(*files: UploadFile) -> list[Document]:
    return asyncio.run(read_documents(list(files)))


def status_of(*files: UploadFile) -> int:
    with pytest.raises(HTTPException) as error:
        read(*files)
    return error.value.status_code


def pages_of(*texts: str, doc: str = "a.pdf") -> list[Page]:
    return [Page(doc, number, text) for number, text in enumerate(texts, start=1)]


# --- read_documents ---

def test_reads_text_with_document_and_page_number(pdf):
    document = read(upload("bio.pdf", pdf("Plants use light")))[0]
    assert document.name == "bio.pdf"
    assert [(p.doc, p.number, p.text) for p in document.pages] == [("bio.pdf", 1, "Plants use light")]


def test_reads_several_files_in_order(pdf):
    documents = read(upload("a.pdf", pdf("First")), upload("b.pdf", pdf("Second")))
    assert [d.name for d in documents] == ["a.pdf", "b.pdf"]


def test_reads_every_page_of_a_long_pdf(pdf):
    document = read(upload("long.pdf", pdf(["one", "two", "three"])))[0]
    assert [p.text for p in document.pages] == ["one", "two", "three"]


def test_reads_bookmarks(pdf):
    data = pdf(["Alpha", "Beta", "Gamma"], bookmarks=[("Intro", 1), ("Methods", 3)])
    assert read(upload("b.pdf", data))[0].bookmarks == [("Intro", 1), ("Methods", 3)]


def test_a_pdf_without_bookmarks_has_none(pdf):
    assert read(upload("plain.pdf", pdf("text")))[0].bookmarks == []


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


def test_clean_drops_blank_lines_and_collapses_spaces():
    assert pdf_parser._clean("one   two\n\n   \nthree\t four") == "one two\nthree four"


# --- strip_running_text ---

def test_running_headers_and_footers_are_removed():
    bodies = ["Atoms", "Bonds", "Charge", "Energy", "Fields", "Gases"]
    pages = pages_of(*[f"ACME Handbook\n{body}\nConfidential" for body in bodies])
    assert [p.text for p in strip_running_text(pages)] == bodies


def test_headers_with_changing_page_numbers_are_removed():
    bodies = ["Atoms", "Bonds", "Charge", "Energy", "Fields", "Gases"]
    pages = pages_of(*[f"Handbook - page {n}\n{body}" for n, body in enumerate(bodies, start=1)])
    assert [p.text for p in strip_running_text(pages)] == bodies


def test_bare_page_numbers_are_removed():
    pages = pages_of("Real text\n12", "More text\nPage 13 of 40", "Other text\n14", "Last text\n15")
    assert [p.text for p in strip_running_text(pages)] == ["Real text", "More text", "Other text", "Last text"]


def test_lines_that_appear_on_few_pages_are_kept():
    pages = pages_of("Shared line\nA", "Shared line\nB", "C", "D", "E", "F")
    assert strip_running_text(pages)[0].text == "Shared line\nA"


def test_short_documents_keep_every_line():
    pages = pages_of("Same\nA", "Same\nB")
    assert [p.text for p in strip_running_text(pages)] == ["Same\nA", "Same\nB"]


# --- split_sections ---

def test_sections_follow_the_bookmarks():
    document = Document("a.pdf", pages_of("one", "two", "three", "four"), bookmarks=[("Intro", 1), ("Methods", 3)])
    sections = split_sections(document)
    assert [(s.title, [p.number for p in s.pages]) for s in sections] == [("Intro", [1, 2]), ("Methods", [3, 4])]


def test_text_before_the_first_bookmark_becomes_an_introduction():
    document = Document("a.pdf", pages_of("cover", "one", "two", "three"), bookmarks=[("Chapter A", 2), ("Chapter B", 4)])
    assert [s.title for s in split_sections(document)] == ["Introduction", "Chapter A", "Chapter B"]


def test_sections_fall_back_to_chapter_headings():
    pages = pages_of("Chapter 1 Basics\ntext", "more text", "Chapter 2 Advanced\ntext", "more")
    sections = split_sections(Document("a.pdf", pages))
    assert [(s.title, [p.number for p in s.pages]) for s in sections] == [("Chapter 1 Basics", [1, 2]), ("Chapter 2 Advanced", [3, 4])]


def test_a_chapter_mentioned_inside_a_page_is_not_a_heading():
    pages = pages_of("Intro\nWe cover many things\nin detail\nChapter 2 discusses more", "text", "text")
    assert [s.title for s in split_sections(Document("a.pdf", pages))] == ["Pages 1 to 3"]


def test_without_bookmarks_or_headings_pages_are_split_into_blocks(monkeypatch):
    monkeypatch.setattr(pdf_parser, "PAGES_PER_BLOCK", 2)
    sections = split_sections(Document("a.pdf", pages_of("a", "b", "c", "d", "e")))
    assert [(s.title, [p.number for p in s.pages]) for s in sections] == [("Pages 1 to 2", [1, 2]), ("Pages 3 to 4", [3, 4]), ("Pages 5 to 5", [5])]


def test_sections_without_text_are_dropped():
    document = Document("a.pdf", pages_of("text", "", ""), bookmarks=[("Real", 1), ("Blank", 2)])
    assert [s.title for s in split_sections(document)] == ["Real"]


def test_section_text_joins_its_pages():
    section = split_sections(Document("a.pdf", pages_of("one", "two"), bookmarks=[("All", 1), ("End", 3)]))[0]
    assert section.text == "one\ntwo"


# --- Limits ---

def test_a_pdf_with_too_many_pages_is_413(pdf, monkeypatch):
    monkeypatch.setenv("PDF_MAX_TOTAL_PAGES", "2")
    assert status_of(upload("long.pdf", pdf(["a", "b", "c"]))) == 413


def test_pages_are_counted_across_all_files(pdf, monkeypatch):
    monkeypatch.setenv("PDF_MAX_TOTAL_PAGES", "3")
    assert status_of(upload("a.pdf", pdf(["a", "b"])), upload("b.pdf", pdf(["c", "d"]))) == 413


def test_the_page_limit_defaults_to_one_hundred(monkeypatch):
    monkeypatch.delenv("PDF_MAX_TOTAL_PAGES", raising=False)
    assert pdf_parser.max_pages() == 100


def test_a_very_long_page_is_cut(pdf, monkeypatch):
    monkeypatch.setattr(pdf_parser, "MAX_PAGE_CHARS", 10)
    assert read(upload("a.pdf", pdf("abcdefghijklmnopqrstuvwxyz")))[0].pages[0].text == "abcdefghij"


def test_a_pdf_that_takes_too_long_is_422(pdf, monkeypatch):
    monkeypatch.setattr(pdf_parser, "PARSE_SECONDS", 0.05)
    monkeypatch.setattr(pdf_parser, "_read_pdf", lambda name, data: time.sleep(0.3))
    assert status_of(upload("slow.pdf", pdf("text"))) == 422


def test_reading_a_pdf_does_not_block_other_work(pdf, monkeypatch):
    monkeypatch.setattr(pdf_parser, "_read_pdf", lambda name, data: time.sleep(0.2) or Document(name, [Page(name, 1, "text")]))
    ticks = []

    async def ticker():
        while True:
            ticks.append(1)
            await asyncio.sleep(0.01)

    async def run():
        task = asyncio.create_task(ticker())
        await read_documents([upload("slow.pdf", pdf("text"))])
        task.cancel()

    asyncio.run(run())
    assert len(ticks) >= 5
