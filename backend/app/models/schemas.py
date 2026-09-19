from typing import List, Optional
from pydantic import BaseModel, Field

class SourceItem(BaseModel):
    document: str = Field(..., description="Name of the source PDF file")
    page: int = Field(..., description="Page number in the PDF (1-indexed)")
    chunk_index: int = Field(..., description="Index of chunk within page or document")
    snippet: str = Field(..., description="Text content excerpt of the retrieved chunk")
    score: Optional[float] = Field(None, description="Similarity score or relevance measure")

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User's natural language question")

class ChatResponse(BaseModel):
    answer: str = Field(..., description="Generated answer from the assistant")
    route: str = Field(..., description="Routing path chosen: 'RAG' or 'DIRECT'")
    sources: List[SourceItem] = Field(default_factory=list, description="List of source citations used")

class DocumentInfo(BaseModel):
    filename: str
    total_pages: int
    total_chunks: int

class DocumentListResponse(BaseModel):
    documents: List[DocumentInfo]
    total_documents: int

class UploadResponse(BaseModel):
    filename: str
    total_pages: int
    total_chunks: int
    message: str

class HealthResponse(BaseModel):
    status: str
    database_type: str
    gemini_configured: bool
    total_documents: int
    total_chunks: int
