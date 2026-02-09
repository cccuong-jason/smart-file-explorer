import os
import PyPDF2
from typing import List, Dict
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
import logging

class SearchEngine:
    def __init__(self):
        self.embedder = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        self.text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
        self.vectorstore = None
        self.logger = logging.getLogger("deepsearch")

    def _emit_or_call(self, cb, *args):
        try:
            if cb is None:
                return
            if hasattr(cb, "emit"):
                cb.emit(*args)
            else:
                cb(*args)
        except Exception:
            self.logger.exception("Callback error")

    def extract_text_from_pdf(self, pdf_path: str) -> str:
        try:
            text = ""
            with open(pdf_path, "rb") as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page_num in range(len(pdf_reader.pages)):
                    page = pdf_reader.pages[page_num]
                    page_text = page.extract_text() or ""
                    text += page_text
            self.logger.info("Extracted PDF text length: %d from %s", len(text), pdf_path)
            return text
        except Exception:
            self.logger.exception("PDF extract error for %s", pdf_path)
            return ""

    def extract_text_from_txt(self, txt_path: str) -> str:
        try:
            with open(txt_path, "r", encoding="utf-8", errors="ignore") as file:
                text = file.read()
                self.logger.info("Extracted TXT text length: %d from %s", len(text), txt_path)
                return text
        except Exception:
            self.logger.exception("TXT extract error for %s", txt_path)
            return ""

    def index_folder(self, folder_path: str, progress_callback=None, file_callback=None):
        texts: List[str] = []
        metadatas: List[Dict] = []

        supported_files: List[str] = []
        for root, _, files in os.walk(folder_path):
            for file in files:
                if file.lower().endswith((".pdf", ".txt")):
                    supported_files.append(os.path.join(root, file))

        total_files = len(supported_files)
        self.logger.info("Indexing folder: %s, files: %d", folder_path, total_files)
        if total_files == 0:
            self.vectorstore = None
            self.logger.warning("No supported files in folder: %s", folder_path)
            return

        for i, file_path in enumerate(supported_files):
            self._emit_or_call(file_callback, file_path)
            self._emit_or_call(progress_callback, int((i / total_files) * 100))
            self.logger.info("Processing file: %s", file_path)

            if file_path.lower().endswith(".pdf"):
                raw_text = self.extract_text_from_pdf(file_path)
            else:
                raw_text = self.extract_text_from_txt(file_path)

            if not raw_text.strip():
                self.logger.warning("Empty text: %s", file_path)
                continue

            chunks = self.text_splitter.split_text(raw_text)
            self.logger.info("Chunks: %d for %s", len(chunks), file_path)
            for chunk in chunks:
                if len(chunk.strip()) < 50:
                    continue
                texts.append(chunk)
                metadatas.append({
                    "file_path": file_path,
                    "file_name": os.path.basename(file_path),
                    "file_type": "pdf" if file_path.lower().endswith(".pdf") else "txt"
                })

        if texts:
            self.vectorstore = FAISS.from_texts(texts, self.embedder, metadatas=metadatas)
            self.logger.info("VectorStore built with texts: %d", len(texts))
        else:
            self.vectorstore = None
            self.logger.warning("No texts to index, vectorstore is None")
        # ensure progress 100%
        self._emit_or_call(progress_callback, 100)

    def search(self, query: str, top_k: int = 10) -> List[Dict]:
        if not self.vectorstore:
            self.logger.warning("Search called with empty vectorstore")
            return []

        self.logger.info("Search query: %s, top_k: %d", query, top_k)
        docs_and_scores = self.vectorstore.similarity_search_with_score(query, k=top_k)
        results: List[Dict] = []
        for doc, score in docs_and_scores:
            meta = doc.metadata or {}
            results.append({
                "file_path": meta.get("file_path", ""),
                "file_name": meta.get("file_name", ""),
                "file_type": meta.get("file_type", ""),
                "content": doc.page_content,
                "similarity": float(max(0.0, 1.0 - score))
            })
            self.logger.debug("Result %s score %.4f", meta.get("file_name", ""), float(score))
        self.logger.info("Search returned results: %d", len(results))
        return results