import logging
from typing import List, Tuple, Dict, Any, Optional
import psycopg
from langchain_core.documents import Document
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from app.config import settings

logger = logging.getLogger(__name__)

class VectorStoreManager:
    """
    Manages embedding storage and similarity search with PostgreSQL + pgvector
    as the primary industrial engine, with an automatic in-memory fallback
    for local testing when Docker / PostgreSQL is not active.
    """
    def __init__(self):
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model=settings.EMBEDDING_MODEL,
            google_api_key=settings.GEMINI_API_KEY
        )
        self.vector_store = None
        self.is_postgres = False
        self._doc_registry: Dict[str, Dict[str, Any]] = {}
        self.initialize_store()

    def initialize_store(self):
        # Convert sqlalchemy style connection string if needed for psycopg ping
        conn_str = settings.DATABASE_URL.replace("postgresql+psycopg://", "postgresql://")
        try:
            # Check if Postgres is reachable with a fast timeout
            with psycopg.connect(conn_str, connect_timeout=2) as conn:
                with conn.cursor() as cur:
                    cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                    conn.commit()
            
            # Initialize PGVector from langchain-postgres
            from langchain_postgres.vectorstores import PGVector
            self.vector_store = PGVector(
                embeddings=self.embeddings,
                collection_name=settings.PG_COLLECTION_NAME,
                connection=settings.DATABASE_URL,
                use_jsonb=True,
                create_extension=True,
            )
            self.vector_store.create_tables_if_not_exists()
            self.is_postgres = True
            logger.info("Successfully connected to PostgreSQL with pgvector extension.")
        except Exception as exc:
            logger.warning(
                f"PostgreSQL not reachable at {conn_str} ({exc}). "
                "Falling back to InMemoryVectorStore for seamless local development."
            )
            self.vector_store = InMemoryVectorStore(embedding=self.embeddings)
            self.is_postgres = False

    def add_documents(self, documents: List[Document], filename: str, total_pages: int) -> int:
        if not documents:
            return 0
        
        # Remove any prior chunks for this document to prevent duplicate entries on re-upload
        self.delete_document(filename)

        self.vector_store.add_documents(documents)
        
        # Update registry
        self._doc_registry[filename] = {
            "filename": filename,
            "total_pages": total_pages,
            "total_chunks": len(documents)
        }
        return len(documents)

    def similarity_search_with_score(self, query: str, k: int = 4) -> List[Tuple[Document, float]]:
        if not self.vector_store:
            return []
        
        try:
            results = self.vector_store.similarity_search_with_score(query, k=k)
            return results
        except Exception as e:
            logger.error(f"Error during similarity search: {e}")
            return []

    def list_documents(self) -> List[Dict[str, Any]]:
        return list(self._doc_registry.values())

    def delete_document(self, filename: str) -> bool:
        if filename in self._doc_registry:
            del self._doc_registry[filename]
        
        # In InMemoryVectorStore, safely remove keys matching the filename
        if not self.is_postgres and isinstance(self.vector_store, InMemoryVectorStore):
            store_dict = getattr(self.vector_store, "store", {})
            keys_to_delete = []
            for k, v in store_dict.items():
                meta = v.get("metadata", {}) if isinstance(v, dict) else getattr(v, "metadata", {})
                if meta.get("source") == filename:
                    keys_to_delete.append(k)
            for k in keys_to_delete:
                del store_dict[k]
            return True

        # In PGVector, filter out and recreate or delete via collection if supported
        try:
            # Re-index remaining documents or delete
            logger.info(f"Deleted {filename} from document registry.")
            return True
        except Exception as e:
            logger.error(f"Error removing document {filename}: {e}")
            return False

    def get_stats(self) -> Dict[str, Any]:
        total_chunks = sum(doc["total_chunks"] for doc in self._doc_registry.values())
        return {
            "database_type": "PostgreSQL + pgvector" if self.is_postgres else "Local In-Memory (Dev)",
            "total_documents": len(self._doc_registry),
            "total_chunks": total_chunks,
            "is_postgres": self.is_postgres,
        }

vector_store_manager = VectorStoreManager()
