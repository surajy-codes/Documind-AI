# DocuMind AI: Project Explainer & Interview Guide

> **Purpose of this document:** A concise, easy-to-read guide explaining exactly how DocuMind AI works under the hood, why each technology was chosen, and how to confidently explain it in an interview.

---

## 1. The 30-Second Elevator Pitch

> *"DocuMind AI is a full-stack GenAI document assistant that lets users upload multi-page PDFs and ask natural language questions. Instead of using a simple, blind retrieval chain that fetches chunks for every single query, I implemented an agentic router using LangGraph. It classifies whether a question is conversational or requires document knowledge, retrieves relevant chunks from PostgreSQL using pgvector, and generates grounded answers citing the exact document and page number."*

---

## 2. Complete Step-by-Step Data Flow

The project consists of two core pipelines: **Ingestion** and **Querying**.

### Pipeline A: Document Ingestion (When a PDF is uploaded)

1. **Upload:** The user uploads a PDF via the React interface (`POST /api/upload`).
2. **Text Extraction (`PyMuPDF`):** 
   - PyMuPDF opens the PDF in memory.
   - It iterates through each page (`page_num = page.number + 1`) and extracts the text while keeping track of page numbers.
3. **Chunking (`RecursiveCharacterTextSplitter`):**
   - Each page's text is split into chunks of **800 characters** with a **150-character overlap**.
   - It prioritizes splitting at paragraph breaks (`\n\n`), then line breaks (`\n`), then sentence endings (`. `).
   - Each chunk is tagged with metadata: `{"source": filename, "page": page_number, "chunk_index": i}`.
4. **Embedding Generation (`Google Gemini`):**
   - Chunks are passed to Gemini's embedding model (`gemini-embedding-001`), converting text into dense 3072-dimensional vector representations.
5. **Storage (`PostgreSQL + pgvector`):**
   - Chunks, vectors, and page metadata are saved into the `document_embeddings` table in PostgreSQL.
   - *(Dev Resilience:* If PostgreSQL is not running locally, the backend automatically stores them in an in-memory vector store so development is never blocked).*

---

### Pipeline B: Query & LangGraph Routing (When a user asks a question)

```text
User Question
      ↓
   [Router]  ─── (Gemini classifies intent: RAG vs DIRECT)
   /      \
 (RAG)  (DIRECT)
  ↓        ↓
[Retrieve] │  ─── (pgvector Cosine Similarity: Top-4 Chunks)
  ↓        │
[Answer] ←─┘  ─── (Gemini synthesizes answer with inline citations)
  ↓
Final Response: Answer + Sources ([Document, Page, Snippet])
```

1. **Step 1: Router Node (`router_node`)**
   - The question is passed to Gemini with an intent classification prompt:
     *"Does this question require retrieving information from uploaded documents, or is it a general greeting/question?"*
   - Returns either `"RAG"` or `"DIRECT"`.
2. **Step 2A: If Routed to `DIRECT`**
   - Bypasses the vector database completely.
   - Gemini responds to greetings, pleasantries, or general queries directly.
   - **Why this matters:** Saves database read operations, cuts latency by 50%+, and prevents hallucinating random document excerpts when someone just says *"Hi"*.
3. **Step 2B: If Routed to `RAG`**
   - **Retrieval Node (`retrieve_node`):** Converts the query into an embedding and queries pgvector using Cosine Similarity to fetch the top-4 most relevant chunks.
   - **Answer Node (`rag_answer_node`):** Formats the retrieved chunks with document names and page numbers into a strict context prompt.
   - Gemini synthesizes the answer with strict instructions: *"Answer strictly using this context. If the answer is not in the text, say you cannot find it. Cite the document and page number inline."*
4. **Step 3: Response Serialization**
   - Returns a structured JSON response to React: `{ answer: string, route: "RAG" | "DIRECT", sources: [{ document, page, chunk_index, snippet, score }] }`.

---

## 3. Technology Stack & "Why Did You Use It?"

Interviewers always ask **"Why did you choose X over Y?"**. Here are your exact answers:

| Technology | Role | Why This Tech? (Interview Answer) |
| :--- | :--- | :--- |
| **PyMuPDF (`pymupdf`)** | PDF Text Extraction | **10x to 20x faster** than pure-Python libraries like PyPDF or PDFMiner because it wraps the C-based MuPDF engine. Crucially, it provides clean page-by-page extraction, which is essential for accurate page-number citations. |
| **LangGraph (`StateGraph`)** | Agent Workflow & Routing | Standard LangChain chains are sequential and linear. LangGraph allows building a **state machine** with conditional branching (`router -> RAG vs DIRECT`). It is predictable, typed, and allows inspecting the state at each step. |
| **PostgreSQL + `pgvector`** | Vector Database | Avoids external vendor lock-in to proprietary SaaS vector databases (like Pinecone). In enterprise production, storing relational application data and vector embeddings in a single ACID-compliant database simplifies backups, security, and infrastructure. |
| **Google Gemini API** | LLM & Embeddings | Fast inference latency, generous rate limits, strong instruction following for strict grounding, and high-quality dense vector representations (`gemini-embedding-001`). |
| **FastAPI** | Backend Web API | Asynchronous (ASGI), high performance, built-in validation via Pydantic schemas, and automatic Swagger documentation at `/docs`. |
| **React + Vite + Tailwind** | Frontend UI | Instant build times (HMR), clean component architecture, and responsive dark-mode styling with zero bulky UI component dependencies. |
| **Docker Compose** | Containerization | Packages the database (`pgvector/pgvector:pg16`), backend, and frontend into a single reproducible environment running with one command (`docker compose up`). |

---

## 4. Key Engineering Decisions You Can Defend

### 1. What is your chunking strategy?
- **Chunk size:** 800 characters.
- **Overlap:** 150 characters.
- **Method:** `RecursiveCharacterTextSplitter`.
- **Reasoning:** 800 characters is approximately 120–150 words (1–2 paragraphs)—long enough to capture a complete semantic concept without diluting the embedding with unrelated information. The 150-character overlap prevents sentences or key terms from being cut in half at chunk boundaries. Furthermore, chunks are partitioned **per-page**, guaranteeing that citations never attribute a sentence to the wrong page.

### 2. How do you prevent hallucinations?
- **Strict Grounding Prompt:** The system prompt explicitly commands the model: *"Answer strictly using ONLY the provided context. If the answer cannot be found in the context, state that clearly. Do NOT extrapolate or assume."*
- **Intent Router:** Separates chit-chat from technical questions so the model isn't forced to answer conversational queries using unrelated document text.
- **Verifiable Citations:** Every source card in the UI shows the exact text chunk, file name, and page number, enabling human verification.

### 3. Why not use a complex multi-agent framework (AutoGPT, CrewAI)?
- **Defensible answer:** *"For document question answering, multi-agent frameworks introduce significant non-determinism, redundant API costs, and high latency with little benefit. A clean, single-agent state machine with an intent router is faster, cheaper, and 100% predictable in production."*

---

## 5. Quick Architecture Cheat-Sheet

```text
Files to Know:
- backend/app/services/pdf_service.py   --> Extracts pages (PyMuPDF) + Chunks (RecursiveSplitter)
- backend/app/services/vector_store.py  --> pgvector storage + cosine search + local fallback
- backend/app/services/agent.py         --> LangGraph StateGraph (Router -> Retrieve -> Answer)
- backend/app/api/endpoints.py          --> FastAPI endpoints (/upload, /documents, /chat)
- frontend/src/App.jsx                  --> React state, API calls, and layout
- docker-compose.yml                    --> pgvector:pg16, FastAPI backend, React frontend
```
