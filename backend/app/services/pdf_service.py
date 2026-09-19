import pymupdf
from typing import List, Tuple
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.config import settings

class PDFService:
    def __init__(self):
        # Recursive splitter prioritizes natural boundaries: paragraphs -> sentences -> words
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            separators=["\n\n", "\n", ". ", " ", ""],
            length_function=len,
        )

    def process_pdf_bytes(self, file_bytes: bytes, filename: str) -> Tuple[List[Document], int]:
        """
        Extracts text from PDF bytes page-by-page using PyMuPDF and splits into chunks
        retaining source filename, page number, and chunk index.
        
        Returns:
            Tuple[List[Document], int]: List of chunked Documents and total page count.
        """
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
        total_pages = len(doc)
        all_chunks: List[Document] = []
        chunk_counter = 0

        for page_idx, page in enumerate(doc):
            page_num = page_idx + 1
            page_text = page.get_text("text").strip()
            
            if not page_text:
                continue

            # Split individual page content to maintain exact page number mapping
            page_chunks = self.text_splitter.split_text(page_text)
            
            for chunk_text in page_chunks:
                if not chunk_text.strip():
                    continue
                
                doc_chunk = Document(
                    page_content=chunk_text,
                    metadata={
                        "source": filename,
                        "page": page_num,
                        "chunk_index": chunk_counter,
                        "total_pages": total_pages,
                    }
                )
                all_chunks.append(doc_chunk)
                chunk_counter += 1

        doc.close()
        return all_chunks, total_pages

pdf_service = PDFService()
