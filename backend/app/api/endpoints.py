import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    DocumentListResponse,
    DocumentInfo,
    UploadResponse,
    HealthResponse,
    SourceItem
)
from app.services.pdf_service import pdf_service
from app.services.vector_store import vector_store_manager
from app.services.agent import rag_agent
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Returns system status, active database backend, and document stats."""
    stats = vector_store_manager.get_stats()
    return HealthResponse(
        status="healthy",
        database_type=stats["database_type"],
        gemini_configured=bool(settings.GEMINI_API_KEY),
        total_documents=stats["total_documents"],
        total_chunks=stats["total_chunks"]
    )

@router.post("/upload", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...)):
    """
    Receives a PDF file, parses text with PyMuPDF, chunks text,
    generates embeddings with Gemini, and stores vectors in pgvector.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported."
        )

    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded file is empty."
            )

        chunks, total_pages = pdf_service.process_pdf_bytes(content, file.filename)
        
        if not chunks:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Could not extract text from this PDF. It might be scanned or image-only."
            )

        added_count = vector_store_manager.add_documents(chunks, file.filename, total_pages)

        return UploadResponse(
            filename=file.filename,
            total_pages=total_pages,
            total_chunks=added_count,
            message=f"Successfully indexed '{file.filename}' ({total_pages} pages, {added_count} chunks)."
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error processing PDF upload")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process PDF: {str(exc)}"
        )

@router.get("/documents", response_model=DocumentListResponse)
async def list_documents():
    """Returns a list of all currently indexed documents."""
    docs = vector_store_manager.list_documents()
    formatted = [
        DocumentInfo(
            filename=d["filename"],
            total_pages=d["total_pages"],
            total_chunks=d["total_chunks"]
        )
        for d in docs
    ]
    return DocumentListResponse(documents=formatted, total_documents=len(formatted))

@router.delete("/documents/{filename}")
async def delete_document(filename: str):
    """Deletes a document and its embeddings from the vector store."""
    success = vector_store_manager.delete_document(filename)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{filename}' not found."
        )
    return {"message": f"Document '{filename}' successfully removed from vector index."}

@router.post("/chat", response_model=ChatResponse)
async def chat_with_documents(request: ChatRequest):
    """
    Executes the LangGraph workflow:
    1. Router decides: RAG vs DIRECT
    2. If RAG: Retrieve context from pgvector -> Synthesize answer with citations
    3. If DIRECT: Answer conversational question directly via Gemini
    """
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GEMINI_API_KEY is not configured on the server."
        )

    try:
        result = rag_agent.run(request.message)
        sources = [
            SourceItem(
                document=s["document"],
                page=s["page"],
                chunk_index=s["chunk_index"],
                snippet=s["snippet"],
                score=s.get("score")
            )
            for s in result.get("sources", [])
        ]
        return ChatResponse(
            answer=result["answer"],
            route=result["route"],
            sources=sources
        )
    except Exception as exc:
        logger.exception("Error executing chat agent")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent workflow error: {str(exc)}"
        )
