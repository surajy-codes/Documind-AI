import logging
from typing import TypedDict, List, Dict, Any, Tuple
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END

from app.config import settings
from app.services.vector_store import vector_store_manager

logger = logging.getLogger(__name__)

class AgentState(TypedDict):
    question: str
    route: str
    retrieved_docs: List[Tuple[Document, float]]
    sources: List[Dict[str, Any]]
    answer: str

class RAGAgent:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model=settings.LLM_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.2,
        )
        self.graph = self._build_graph()

    def _build_graph(self):
        builder = StateGraph(AgentState)

        # 1. Define nodes
        builder.add_node("router", self.router_node)
        builder.add_node("retrieve", self.retrieve_node)
        builder.add_node("rag_answer", self.rag_answer_node)
        builder.add_node("direct_answer", self.direct_answer_node)

        # 2. Define edges and conditional routing
        builder.add_edge(START, "router")
        builder.add_conditional_edges(
            "router",
            lambda state: state["route"],
            {
                "RAG": "retrieve",
                "DIRECT": "direct_answer"
            }
        )
        builder.add_edge("retrieve", "rag_answer")
        builder.add_edge("rag_answer", END)
        builder.add_edge("direct_answer", END)

        return builder.compile()

    def router_node(self, state: AgentState) -> Dict[str, Any]:
        """
        Classifies whether the question asks about uploaded document content (RAG)
        or is a general conversation/greeting (DIRECT).
        """
        question = state["question"]
        doc_stats = vector_store_manager.get_stats()
        
        # If no documents are indexed yet, default to direct answer
        if doc_stats["total_documents"] == 0:
            logger.info("No documents uploaded yet. Routing to DIRECT.")
            return {"route": "DIRECT"}

        router_prompt = ChatPromptTemplate.from_messages([
            ("system", (
                "You are an intent router for a Document Assistant. "
                "The user has uploaded PDF documents into the system.\n"
                "Decide if the user's input requires looking up information inside the uploaded documents, "
                "or if it is a general greeting, pleasantry, or meta question.\n\n"
                "Output ONLY 'RAG' or 'DIRECT'. Do not output any explanation."
            )),
            ("human", "User message: {question}\nRoute:")
        ])

        chain = router_prompt | self.llm
        response = chain.invoke({"question": question})
        decision = response.content.strip().upper()

        route = "RAG" if "RAG" in decision else "DIRECT"
        logger.info(f"Router classified question '{question}' as '{route}'.")
        return {"route": route}

    def retrieve_node(self, state: AgentState) -> Dict[str, Any]:
        """
        Retrieves top-k relevant chunks from pgvector/vector store.
        """
        question = state["question"]
        results = vector_store_manager.similarity_search_with_score(
            query=question,
            k=settings.TOP_K_RETRIEVAL
        )

        sources = []
        for doc, score in results:
            meta = doc.get("metadata", {}) if isinstance(doc, dict) else getattr(doc, "metadata", {})
            text = (doc.get("text") or doc.get("page_content", "")) if isinstance(doc, dict) else getattr(doc, "page_content", "")
            sources.append({
                "document": meta.get("source", "Unknown Document"),
                "page": meta.get("page", 1),
                "chunk_index": meta.get("chunk_index", 0),
                "snippet": text.strip(),
                "score": round(float(score), 4) if score is not None else None
            })

        logger.info(f"Retrieved {len(results)} chunks for question: {question}")
        return {"retrieved_docs": results, "sources": sources}

    def rag_answer_node(self, state: AgentState) -> Dict[str, Any]:
        """
        Generates grounded answer with explicit citations based on retrieved context.
        """
        question = state["question"]
        retrieved_docs = state.get("retrieved_docs", [])
        
        if not retrieved_docs:
            return {
                "answer": "I could not find any relevant information in the uploaded documents to answer your question.",
                "sources": []
            }

        # Build context formatted with document name and page
        context_parts = []
        for doc, _ in retrieved_docs:
            meta = doc.get("metadata", {}) if isinstance(doc, dict) else getattr(doc, "metadata", {})
            text = (doc.get("text") or doc.get("page_content", "")) if isinstance(doc, dict) else getattr(doc, "page_content", "")
            source_name = meta.get("source", "Document")
            page_num = meta.get("page", 1)
            context_parts.append(
                f"--- Source: {source_name} (Page {page_num}) ---\n{text}"
            )
        context_str = "\n\n".join(context_parts)

        rag_prompt = ChatPromptTemplate.from_messages([
            ("system", (
                "You are an expert GenAI Document Assistant. "
                "Your objective is to answer the user's question accurately and objectively using ONLY the context provided below.\n\n"
                "GUIDELINES:\n"
                "1. If the provided context does NOT contain enough information to answer the question, state: 'I cannot find that information in the uploaded document(s).' Do NOT invent or extrapolate facts.\n"
                "2. When stating facts, cite the source document and page number inline, for example [Source: filename.pdf, Page 2].\n"
                "3. Keep your tone professional, clear, and well-structured using markdown headings and bullet points where helpful."
            )),
            ("human", "Context:\n{context}\n\nQuestion: {question}\n\nAnswer:")
        ])

        chain = rag_prompt | self.llm
        response = chain.invoke({"context": context_str, "question": question})
        answer_text = response.content.strip()

        return {"answer": answer_text}

    def direct_answer_node(self, state: AgentState) -> Dict[str, Any]:
        """
        Answers conversational greetings and general questions directly.
        """
        question = state["question"]
        direct_prompt = ChatPromptTemplate.from_messages([
            ("system", (
                "You are an AI Document Assistant. "
                "You help users analyze and query uploaded PDF documents using Retrieval-Augmented Generation (RAG).\n"
                "Respond to the user's greeting or general inquiry politely and concisely. "
                "If appropriate, remind them that they can upload a PDF document anytime to ask specific questions about its contents."
            )),
            ("human", "{question}")
        ])

        chain = direct_prompt | self.llm
        response = chain.invoke({"question": question})
        return {"answer": response.content.strip(), "sources": []}

    def run(self, question: str) -> Dict[str, Any]:
        """
        Executes the LangGraph workflow end-to-end.
        """
        initial_state: AgentState = {
            "question": question,
            "route": "",
            "retrieved_docs": [],
            "sources": [],
            "answer": ""
        }
        final_state = self.graph.invoke(initial_state)
        return {
            "answer": final_state.get("answer", ""),
            "route": final_state.get("route", "DIRECT"),
            "sources": final_state.get("sources", [])
        }

rag_agent = RAGAgent()
