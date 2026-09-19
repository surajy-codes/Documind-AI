import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.endpoints import router as api_router
from app.services.vector_store import vector_store_manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Check connections and report state
    logger.info("Initializing AI Document Assistant Backend...")
    stats = vector_store_manager.get_stats()
    logger.info(f"Vector Store Backend: {stats['database_type']}")
    logger.info(f"Gemini LLM Model: {settings.LLM_MODEL}")
    logger.info(f"Gemini Embeddings Model: {settings.EMBEDDING_MODEL}")
    yield
    logger.info("Shutting down AI Document Assistant Backend.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="GenAI-powered PDF document assistant using RAG, LangChain, LangGraph, and pgvector.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "message": "AI Document Assistant API is running.",
        "docs_url": "/docs",
        "health_url": "/api/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
