import math
import re
from collections import Counter
from dataclasses import dataclass

from pdf_parser import Page

CHUNK_CHARS = 900
OVERLAP_CHARS = 150
K1 = 1.5
B = 0.75
WORD = re.compile(r"[a-z0-9]{3,}")


@dataclass(frozen=True)
class Chunk:
    doc: str
    page: int
    text: str


# --- Chunking ---

def chunk_pages(pages: list[Page], size: int = CHUNK_CHARS, overlap: int = OVERLAP_CHARS) -> list[Chunk]:
    """Overlapping pieces of each page, so an answer that straddles a cut is still found whole in one piece."""
    chunks = []
    for page in pages:
        start = 0
        while page.text and start < len(page.text):
            chunks.append(Chunk(page.doc, page.number, page.text[start : start + size]))
            if start + size >= len(page.text):
                break
            start += size - overlap
    return chunks


# --- Ranking (BM25: words that are rare in the documents count for more) ---

class Bm25Index:
    def __init__(self, chunks: list[Chunk]):
        self.chunks = chunks
        self.counts = [Counter(_words(chunk.text)) for chunk in chunks]
        self.lengths = [sum(count.values()) for count in self.counts]
        self.average = sum(self.lengths) / len(chunks) if chunks else 0.0
        self.document_frequency = Counter(word for count in self.counts for word in count)

    def search(self, query: str, limit: int) -> list[Chunk]:
        """The chunks that best match the query, best first; chunks sharing no word with it are never returned."""
        wanted = set(_words(query))
        scored = [(self._score(position, wanted), position) for position in range(len(self.chunks))]
        best = sorted((item for item in scored if item[0] > 0), key=lambda item: (-item[0], item[1]))[:limit]
        return [self.chunks[position] for _, position in best]

    def _score(self, position: int, wanted: set[str]) -> float:
        count, length = self.counts[position], self.lengths[position]
        score = 0.0
        for word in wanted & count.keys():
            idf = math.log(1 + (len(self.chunks) - self.document_frequency[word] + 0.5) / (self.document_frequency[word] + 0.5))
            frequency = count[word]
            score += idf * frequency * (K1 + 1) / (frequency + K1 * (1 - B + B * length / self.average))
        return score


def _words(text: str) -> list[str]:
    """Lower-case words of three or more letters, with a plural 's' removed so "plants" finds "plant"."""
    return [word[:-1] if len(word) > 4 and word.endswith("s") else word for word in WORD.findall(text.lower())]
