# DocuMind AI: GenAI-Powered Document Assistant

> A production-ready, interview-defensible Document Assistant built with **Retrieval-Augmented Generation (RAG)**, a **LangGraph StateGraph Router**, **PyMuPDF**, **Google Gemini**, and **PostgreSQL + pgvector**.

---

## 1. System Architecture

```text
               +-------------------------------------------+
               |        React 18 + Vite + Tailwind UI      |
               |  (Upload Dropzone, Chat Stream, Citations)|
               +---------------------+---------------------+
                                     | HTTP REST
                                     v
                       +---------------------------+
                       |      FastAPI Backend      |
                       +-------------+-------------+
                                     |
       +-----------------------------+-----------------------------+
       | [Ingestion Pipeline]                                      | [LangGraph Workflow]
       v                                                           v
+--------------+                                            +--------------+
|   PyMuPDF    | Page-by-page text & metadata extraction    |    Router    | LLM classifies: Document query
+-------+------+                                            +---+------+---+ vs Conversational query
        v                                                       |      |
+--------------+                                           RAG  |      | DIRECT
|  Recursive   | 800-char chunks, 150-char overlap              v      v
| TextSplitter | (Semantic paragraph/sentence boundaries) +----+  +----+
+-------+------+                                          |Ret-|  |Dir-|
        v                                                 |rie-|  |ect |
+--------------+                                          |ver |  |LLM |
|    Gemini    | gemini-embedding-001                     +----+  +----+
|  Embeddings  |                                            |      |
+-------+------+                                            +---+--+
        v                                                       |
+--------------+ <==============================================+
|  PostgreSQL  | Cosine Similarity Search (Top-k)           | Gemini 2.5 Flash Grounded Synthesis
|  + pgvector  |                                            v
+--------------+                             Answer + Sources (Doc, Page, Snippet)
```

---

## 2. Key Features

- **Document Ingestion:** Drag-and-drop PDF upload with instant page-by-page extraction using PyMuPDF.
- **Smart Chunking:** LangChain `RecursiveCharacterTextSplitter` respects paragraph, sentence, and word boundaries.
- **Vector Search:** PostgreSQL with `pgvector` extension for industrial-grade cosine similarity search.
- **Resilient Fallback:** Automatically runs with an in-memory vector store during local dev if PostgreSQL is offline, and connects to `pgvector` as soon as Docker is started.
- **LangGraph Agentic Routing:** 
  - **`DIRECT`**: Conversational greetings and general queries are answered directly by Gemini without querying the database.
  - **`RAG`**: Domain/document queries trigger semantic vector retrieval and strictly grounded answer synthesis with page citations.
- **Exact Source Citations:** Every answer references `[Source: document.pdf, Page X]` with expandable chunk excerpts and relevance scores.
- **Modern UI:** Responsive dark-mode interface built with Tailwind CSS v4, Google Fonts Outfit & Inter, and Lucide icons.
- **Dockerized:** Multi-container deployment with Docker Compose (`pgvector/pgvector:pg16`, Python 3.13 backend, and Nginx frontend).

---

## 3. Tech Stack & Justifications

| Component | Technology | Why This Tech? (Interview Justification) |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS | Fast HMR, clean component tree, zero heavy UI libraries, crisp dark-mode styling. |
| **Backend** | Python 3.13, FastAPI, Uvicorn | Async performance, automatic OpenAPI `/docs`, typed Pydantic request/response schemas. |
| **PDF Extraction** | PyMuPDF (`fitz`) | 10-20x faster than pure-Python parsers (PyPDF), accurate page coordinates and page indexing. |
| **Vector Database** | PostgreSQL + pgvector | Eliminates external SaaS database lock-in; stores embeddings and relational metadata in an ACID-compliant engine. |
| **Orchestration** | LangGraph (`StateGraph`) | Typed, deterministic state machine; cleanly decouples the routing decision from retrieval and synthesis. |
| **LLM & Embeddings**| Google Gemini 2.5 Flash & gemini-embedding-001 | Low latency, generous context window, high instruction-following precision. |

---

## 4. Quickstart Guide

### Option A: Run with Docker Compose (Recommended)

1. Clone or navigate to the repository:
   ```bash
   cd e:/AI
   ```

2. Create your `.env` file (or copy from `.env.example`):
   ```bash
   GEMINI_API_KEY=your_actual_gemini_api_key
   ```

3. Launch all services:
   ```bash
   docker compose up --build
   ```

4. Open your browser:
   - **Frontend UI:** `http://localhost:3000`
   - **Backend API Docs:** `http://localhost:8000/docs`
   - **Database:** `localhost:5432` (`rag_db`)

---

### Option B: Run Locally (Development Mode)

#### 1. Backend Setup:
```bash
# From e:/AI
cd backend

# Create & activate virtual environment
py -3.13 -m venv .venv
.\.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Note: If PostgreSQL is not running locally, the backend automatically activates the local in-memory development vector store so you can develop immediately without blocking.*

#### 2. Frontend Setup:
```bash
# In a new terminal
cd e:/AI/frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
Open `http://localhost:5173`.

---

## 5. API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck, vector store status, and document statistics. |
| `POST` | `/api/upload` | Upload a PDF (`multipart/form-data`), extract pages, chunk, embed, and index. |
| `GET` | `/api/documents` | List all active indexed documents with page and chunk counts. |
| `DELETE` | `/api/documents/{filename}` | Remove a document and its embeddings from the vector store. |
| `POST` | `/api/chat` | Send a query to the LangGraph agent (`{ message: string }`), returning answer, route, and sources. |

---

## 6. Interview Defense Guide (FAQ)

### Q1: Why use PyMuPDF instead of PyPDF or PDFMiner?
> **Answer:** PyMuPDF wraps MuPDF, an ultra-fast C library. In high-throughput ingestion pipelines, PyMuPDF is 10 to 20 times faster than pure-Python implementations like PyPDF. Crucially, PyMuPDF provides reliable page iteration, allowing us to tag every text chunk with its exact 1-indexed page number for grounded citations.

### Q2: Why PostgreSQL + pgvector instead of Pinecone or Weaviate?
> **Answer:** In enterprise production systems, maintaining a standalone SaaS vector database introduces data synchronization overhead, additional vendor lock-in, and network latency. With `pgvector`, vector embeddings reside directly alongside relational tables, allowing atomic transactions, standard SQL backups, and unified infrastructure with zero extra cost.

### Q3: Why LangGraph instead of a simple LangChain chain?
> **Answer:** Traditional LangChain chains are linear DAGs that run sequentially. In real-world GenAI applications, queries often don't need expensive vector retrieval (e.g., greetings, pleasantries, clarification questions). LangGraph provides a typed `StateGraph` with conditional edge branching (`router -> DIRECT | RAG`), saving DB roundtrips, reducing latency, and preventing hallucinated answers from unrelated document chunks.

### Q4: What is your chunking strategy and why?
> **Answer:** We use LangChain's `RecursiveCharacterTextSplitter` with a `chunk_size` of 800 characters and `chunk_overlap` of 150 characters. 
> - **Why recursive?** It attempts to split on paragraph breaks (`\n\n`), then line breaks (`\n`), then sentence endings (`. `) before falling back to words, ensuring coherent semantic thoughts remain intact.
> - **Why 150 overlap?** Prevents boundary clipping where key context might be split across two separate chunks.
> - **Why page-level chunking?** Chunks never span across page boundaries, guaranteeing that source citations (`Page X`) are 100% accurate.

### Q5: How do you prevent hallucinations in RAG?
> **Answer:**
> 1. **Intent Filtering:** The router prevents non-document queries from pulling unrelated document noise.
> 2. **Strict System Prompt:** Explicitly instructs the LLM: *"If the provided context does not contain enough information, state: 'I cannot find that information in the uploaded document(s).' Do NOT invent or extrapolate facts."*
> 3. **Source Grounding:** Forces inline bracket citations `[Source: document.pdf, Page X]` linked to the retrieved chunks.
