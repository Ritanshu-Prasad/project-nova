from pdf_parser import Page
from retrieval import Bm25Index, Chunk, chunk_pages


def pages_of(*texts: str) -> list:
    return [Page("a.pdf", number, text) for number, text in enumerate(texts, start=1)]


# --- chunk_pages ---

def test_a_short_page_is_one_chunk_with_its_place():
    assert chunk_pages(pages_of("short page")) == [Chunk("a.pdf", 1, "short page")]


def test_empty_pages_make_no_chunks():
    assert chunk_pages(pages_of("", "text")) == [Chunk("a.pdf", 2, "text")]


def test_a_long_page_is_cut_into_overlapping_chunks():
    text = "".join(chr(97 + number % 26) * 10 for number in range(30))
    chunks = chunk_pages(pages_of(text), size=100, overlap=20)
    assert all(len(chunk.text) <= 100 for chunk in chunks) and len(chunks) == 4
    assert chunks[0].text[-20:] == chunks[1].text[:20]
    assert chunks[0].text + chunks[1].text[20:] + chunks[2].text[20:] + chunks[3].text[20:] == text


def test_chunks_keep_the_document_and_page_they_came_from():
    chunks = chunk_pages([Page("a.pdf", 3, "x" * 50), Page("b.pdf", 7, "y" * 50)], size=30, overlap=5)
    assert {(chunk.doc, chunk.page) for chunk in chunks} == {("a.pdf", 3), ("b.pdf", 7)}


def test_a_page_exactly_the_chunk_size_is_one_chunk():
    assert len(chunk_pages(pages_of("x" * 100), size=100, overlap=10)) == 1


# --- Bm25Index ---

LIBRARY = [
    Chunk("bio.pdf", 1, "Chlorophyll absorbs red and blue light in the thylakoid membrane of the chloroplast."),
    Chunk("bio.pdf", 2, "The Calvin cycle fixes carbon dioxide in the stroma using rubisco."),
    Chunk("bio.pdf", 3, "Glycolysis splits glucose into pyruvate in the cytoplasm of the cell."),
    Chunk("bio.pdf", 4, "Mitochondria produce ATP through the electron transport chain."),
]


def test_the_best_matching_chunk_comes_first():
    assert Bm25Index(LIBRARY).search("where does rubisco fix carbon dioxide", 3)[0].page == 2


def test_a_rare_word_counts_for_more_than_a_common_one():
    assert Bm25Index(LIBRARY).search("the glycolysis", 3)[0].page == 3


def test_chunks_sharing_no_word_with_the_query_are_not_returned():
    assert [chunk.page for chunk in Bm25Index(LIBRARY).search("rubisco", 4)] == [2]


def test_the_number_of_results_is_limited():
    assert len(Bm25Index(LIBRARY).search("the cell chain cycle light glucose", 2)) == 2


def test_an_empty_query_or_an_empty_library_finds_nothing():
    assert Bm25Index(LIBRARY).search("", 3) == [] and Bm25Index(LIBRARY).search("??", 3) == []
    assert Bm25Index([]).search("anything", 3) == []


def test_plurals_find_their_singular():
    assert Bm25Index(LIBRARY).search("rubiscos", 1)[0].page == 2


def test_capitals_and_punctuation_do_not_matter():
    assert Bm25Index(LIBRARY).search("CALVIN-CYCLE!!", 1)[0].page == 2


def test_equal_scores_keep_document_order():
    twins = [Chunk("a.pdf", 1, "alpha beta"), Chunk("a.pdf", 2, "alpha beta")]
    assert [chunk.page for chunk in Bm25Index(twins).search("alpha", 2)] == [1, 2]


def test_words_that_only_mean_the_same_are_not_matched():
    assert Bm25Index(LIBRARY).search("photosynthesis", 3) == []
