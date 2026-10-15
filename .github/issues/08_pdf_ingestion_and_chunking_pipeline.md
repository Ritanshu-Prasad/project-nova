# Issue 8: PDF Ingestion, Chunking & Document Context Extraction Pipeline

**Labels:** `backend`, `pdf`, `ai`, `priority-high`  
**Target Files:** `backend/pdf_parser.py` [NEW], `backend/generator.py`, `backend/requirements.txt`

---

## 🎯 Goal
Build a robust PDF ingestion, text extraction, outline discovery, and token-budget chunking pipeline for the "Document Mode" of the Course Forge (`POST /api/courses/generate`).

---

## 📋 Problem Statement
When a user uploads PDF documents to create a course:
1. Files can vary from a short 5-page research paper to a 100-page textbook or slide deck.
2. Directly dumping raw extracted text into an LLM prompt will exceed context window limits or cause high latency and degraded reasoning.
3. Raw PDF extractions often contain header/footer noise, page numbers, duplicate whitespace, and mangled table layouts.
4. The frontend allows the user to specify:
   * `structure`: `"chapters"` (break down by document chapters) vs `"topics"` (extract thematic concepts).
   * `focus`: optional string focus (e.g., *"Focus on Chapter 4: Attention Mechanisms and Transformers"*).

Without an intelligent PDF processing pipeline, the Nemotron model will receive malformed or truncated context, leading to poor course structures or failed generation.

---

## 🛠️ Required Technical Implementation

### 1. Extraction Engine (`backend/pdf_parser.py`)
* Add `pypdf>=5.0.0` or `pdfplumber` to `backend/requirements.txt`.
* Read uploaded binary files (`files: List[UploadFile]`):
  * Extract text page by page while tracking the source document filename and page numbers.
  * Clean boilerplate: strip repetitive running headers, page numbers, watermarks, and excessive blank lines.

### 2. Document Outline & Chapter Discovery
* Extract embedded PDF bookmarks/outlines if present (`reader.outline`).
* If bookmarks are absent, use heading heuristics (regex for `Chapter \d+`, `Section \d+`, bold text, or distinct font sizes) to segment the text into logical chapters/sections.
* Honor the frontend `structure` parameter:
  * If `structure == "chapters"`, map the course modules 1:1 to the detected document chapters.
  * If `structure == "topics"`, group cohesive sections thematically across the document.

### 3. Context Window Management & Smart Focus Filtering
* Maintain a maximum context token budget (e.g. 16,000 tokens / ~60,000 characters).
* **Focus Prioritization:** If user provided a `focus` string (e.g. *"thermodynamics"* or *"chapter 3"*):
  * Score and prioritize pages/sections containing the focus keywords.
  * Retain detailed text for high-priority pages; generate compact summaries for background pages.
* If no focus is provided and the document is very large (>50 pages), perform a two-tier extraction:
  * Tier 1: Extract table of contents + chapter introductions + summaries to draft the module outline.
  * Tier 2: Extract key excerpts from each chapter to write the topic lesson blocks and question pools.

### 4. Source Citation Metadata
* When generating `LessonBlock` objects of type `source`, pass through exact citations:
  ```json
  {
    "type": "source",
    "doc": "Transformers_Attention_Is_All_You_Need.pdf",
    "page": 4
  }
  ```
* This allows the frontend study screen to display verified page references in the right-hand panel!

---

## ✅ Acceptance Criteria
- [ ] Successfully processes single and multi-file PDF uploads (up to 5 files, 50 MB total).
- [ ] Large documents (>50 pages) do not crash or exceed the LLM context window.
- [ ] The `focus` parameter successfully biases the generated curriculum toward user-specified topics.
- [ ] Source citations (`doc` and `page`) are populated in the generated course blocks.
- [ ] Corrupt or password-protected PDFs return an informative HTTP 422 error rather than a 500 crash.
