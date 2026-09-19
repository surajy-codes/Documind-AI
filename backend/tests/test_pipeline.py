import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pymupdf
from app.services.pdf_service import pdf_service
from app.services.vector_store import vector_store_manager
from app.services.agent import rag_agent

def create_sample_pdf_bytes() -> bytes:
    """Generates a small in-memory multi-page PDF for automated testing."""
    doc = pymupdf.open()
    
    # Page 1
    page1 = doc.new_page()
    page1.insert_text(
        pymupdf.Point(50, 72),
        "Project Orion Architecture Document\n\n"
        "Project Orion is an autonomous deep-space exploration probe designed in 2026.\n"
        "The project lead is Dr. Elena Rostova and the primary propulsion system uses Ion Thrusters."
    )
    
    # Page 2
    page2 = doc.new_page()
    page2.insert_text(
        pymupdf.Point(50, 72),
        "Project Orion Operational Safety Protocols\n\n"
        "The primary emergency protocol code is ORION-DELTA-99.\n"
        "In case of thermal overload, cooling pumps must activate within 30 seconds."
    )
    
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes

def run_tests():
    print("=== Step 1: Generating Sample PDF ===")
    sample_bytes = create_sample_pdf_bytes()
    filename = "test_orion_specs.pdf"
    print(f"Sample PDF created ({len(sample_bytes)} bytes)")

    print("\n=== Step 2: Testing PyMuPDF Extraction & Chunking ===")
    chunks, total_pages = pdf_service.process_pdf_bytes(sample_bytes, filename)
    assert total_pages == 2, f"Expected 2 pages, got {total_pages}"
    assert len(chunks) >= 2, f"Expected at least 2 chunks, got {len(chunks)}"
    print(f"Extracted {len(chunks)} chunks across {total_pages} pages.")
    for i, c in enumerate(chunks):
        print(f"  Chunk {i+1} [Page {c.metadata['page']}]: {c.page_content[:60]}...")

    print("\n=== Step 3: Indexing Chunks in Vector Store ===")
    count = vector_store_manager.add_documents(chunks, filename, total_pages)
    assert count == len(chunks), "Chunk count mismatch in vector store"
    stats = vector_store_manager.get_stats()
    print(f"Indexed {count} chunks. Current stats: {stats}")

    print("\n=== Step 4: Testing Semantic Similarity Search ===")
    results = vector_store_manager.similarity_search_with_score("Who is the project lead?", k=2)
    assert len(results) > 0, "No search results returned"
    top_doc, top_score = results[0]
    print(f"Top match (score {top_score:.4f}, page {top_doc.metadata.get('page')}): {top_doc.page_content[:80]}...")
    assert "Elena Rostova" in top_doc.page_content, "Expected Dr. Elena Rostova in top match"

    print("\n=== Step 5: Testing LangGraph Agent - DIRECT Route (Greeting) ===")
    direct_res = rag_agent.run("Hello, who are you?")
    print(f"Route: {direct_res['route']}")
    print(f"Answer: {direct_res['answer'][:100]}...")
    assert direct_res["route"] == "DIRECT", f"Expected DIRECT route, got {direct_res['route']}"
    assert len(direct_res["sources"]) == 0, "Direct route should have no document sources"

    print("\n=== Step 6: Testing LangGraph Agent - RAG Route (Document Question) ===")
    rag_res = rag_agent.run("What is the primary emergency protocol code and who leads the project?")
    print(f"Route: {rag_res['route']}")
    print(f"Answer: {rag_res['answer']}")
    print(f"Sources count: {len(rag_res['sources'])}")
    for s in rag_res["sources"]:
        print(f"  - [{s['document']} Page {s['page']}]: {s['snippet'][:50]}...")
    assert rag_res["route"] == "RAG", f"Expected RAG route, got {rag_res['route']}"
    assert len(rag_res["sources"]) > 0, "RAG route should provide sources"
    assert "ORION-DELTA-99" in rag_res["answer"] or "Elena" in rag_res["answer"], "Answer missing key ground facts"

    print("\n ALL AUTOMATED BACKEND TESTS PASSED SUCCESSFULLY! ")

if __name__ == "__main__":
    run_tests()
