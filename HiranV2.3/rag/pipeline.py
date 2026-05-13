"""
Hiran v2.3 RAG Pipeline
========================
Hybrid retrieval with semantic search + BM25 reranking.

Architecture:
1. Document ingestion (chunking, embedding)
2. Vector store (ChromaDB or in-memory fallback)
3. Query → embedding → top-k retrieval
4. Cross-encoder reranking
5. Context injection into prompt

Usage:
    from HiranV2.3.rag import RAGPipeline
    rag = RAGPipeline()
    rag.ingest_directory("V3/docs")
    result = rag.query("How does ZION consensus work?", top_k=5)
    print(result.context)
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class Document:
    id: str
    text: str
    source: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class RetrievalResult:
    query: str
    chunks: list[tuple[Document, float]]  # (doc, score)
    context: str = ""
    sources: list[str] = field(default_factory=list)

    def to_prompt_context(self, max_tokens: int = 4000) -> str:
        """Format retrieved chunks as prompt context."""
        parts = []
        current_len = 0
        for doc, score in self.chunks:
            chunk_text = f"[Source: {doc.source} | Score: {score:.3f}]\n{doc.text}\n---\n"
            # Rough token estimate
            est_tokens = len(chunk_text) // 4
            if current_len + est_tokens > max_tokens:
                break
            parts.append(chunk_text)
            current_len += est_tokens
        return "\n".join(parts)


class RAGPipeline:
    def __init__(
        self,
        embedding_model: str = "text-embedding-3-large",
        chunk_size: int = 512,
        chunk_overlap: int = 128,
        top_k: int = 10,
        rerank_top_k: int = 5,
        use_chromadb: bool = False,
    ) -> None:
        self.embedding_model_name = embedding_model
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.top_k = top_k
        self.rerank_top_k = rerank_top_k
        self.use_chromadb = use_chromadb

        self._documents: dict[str, Document] = {}
        self._embeddings: dict[str, list[float]] = {}
        self._embedding_fn = None
        self._reranker = None
        self._chromadb_client = None
        self._chromadb_collection = None

        self._init_embedding()
        self._init_reranker()
        if use_chromadb:
            self._init_chromadb()

    # -------------------------------------------------------------------
    # Initialization
    # -------------------------------------------------------------------

    def _init_embedding(self) -> None:
        try:
            import openai
            self._embedding_fn = lambda texts: [
                d.embedding for d in openai.embeddings.create(
                    input=texts, model=self.embedding_model_name
                ).data
            ]
        except ImportError:
            # Fallback: use sentence-transformers
            try:
                from sentence_transformers import SentenceTransformer
                model = SentenceTransformer("BAAI/bge-large-en-v1.5")
                self._embedding_fn = lambda texts: model.encode(texts, normalize_embeddings=True).tolist()
            except ImportError:
                print("WARNING: No embedding backend available. Install openai or sentence-transformers.")
                self._embedding_fn = None

    def _init_reranker(self) -> None:
        try:
            from sentence_transformers import CrossEncoder
            self._reranker = CrossEncoder("BAAI/bge-reranker-v2-m3")
        except ImportError:
            print("WARNING: Cross-encoder reranker not available.")
            self._reranker = None

    def _init_chromadb(self) -> None:
        try:
            import chromadb
            self._chromadb_client = chromadb.PersistentClient(path="HiranV2.3/rag/chroma_db")
            self._chromadb_collection = self._chromadb_client.get_or_create_collection("hiran_v2_3")
        except ImportError:
            print("WARNING: ChromaDB not installed. Using in-memory fallback.")
            self.use_chromadb = False

    # -------------------------------------------------------------------
    # Chunking
    # -------------------------------------------------------------------

    def _chunk_text(self, text: str, source: str) -> list[Document]:
        """Semantic chunking with overlap."""
        # Clean markdown
        text = re.sub(r"```.*?```", "", text, flags=re.DOTALL)
        text = re.sub(r"#+\s+", "\n", text)

        # Split into sentences
        sentences = re.split(r"(?<=[.!?])\s+", text)
        chunks = []
        current_chunk = []
        current_len = 0

        for sent in sentences:
            sent_len = len(sent.split())
            if current_len + sent_len > self.chunk_size and current_chunk:
                chunk_text = " ".join(current_chunk)
                chunk_id = hashlib.sha256(f"{source}:{chunk_text}".encode()).hexdigest()[:16]
                chunks.append(Document(id=chunk_id, text=chunk_text, source=source))
                # Overlap
                overlap_words = current_chunk[-self.chunk_overlap:]
                current_chunk = overlap_words + [sent]
                current_len = sum(len(w.split()) for w in current_chunk)
            else:
                current_chunk.append(sent)
                current_len += sent_len

        if current_chunk:
            chunk_text = " ".join(current_chunk)
            chunk_id = hashlib.sha256(f"{source}:{chunk_text}".encode()).hexdigest()[:16]
            chunks.append(Document(id=chunk_id, text=chunk_text, source=source))

        return chunks

    # -------------------------------------------------------------------
    # Ingestion
    # -------------------------------------------------------------------

    def ingest_text(self, text: str, source: str) -> None:
        chunks = self._chunk_text(text, source)
        self._add_chunks(chunks)

    def ingest_directory(self, directory: Path | str, glob: str = "**/*.md") -> None:
        dir_path = Path(directory)
        for file_path in dir_path.rglob(glob):
            try:
                text = file_path.read_text(encoding="utf-8", errors="ignore")
                self.ingest_text(text, str(file_path.relative_to(dir_path)))
            except Exception as e:
                print(f"RAG ingest error for {file_path}: {e}")

    def _add_chunks(self, chunks: list[Document]) -> None:
        if not chunks:
            return
        texts = [c.text for c in chunks]
        if self._embedding_fn is None:
            print("WARNING: No embedding function, storing without vectors")
            for c in chunks:
                self._documents[c.id] = c
            return

        embeddings = self._embedding_fn(texts)
        for chunk, emb in zip(chunks, embeddings):
            self._documents[chunk.id] = chunk
            self._embeddings[chunk.id] = emb
            if self.use_chromadb and self._chromadb_collection:
                self._chromadb_collection.add(
                    ids=[chunk.id],
                    documents=[chunk.text],
                    metadatas=[chunk.metadata],
                    embeddings=[emb],
                )

    # -------------------------------------------------------------------
    # Retrieval
    # -------------------------------------------------------------------

    def _cosine_similarity(self, a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def query(self, query: str, top_k: int | None = None) -> RetrievalResult:
        k = top_k or self.top_k
        if not self._documents:
            return RetrievalResult(query=query, chunks=[])

        if self._embedding_fn is None:
            # Fallback: keyword search
            return self._keyword_search(query, k)

        # Semantic search
        query_emb = self._embedding_fn([query])[0]
        scored = []
        for doc_id, emb in self._embeddings.items():
            score = self._cosine_similarity(query_emb, emb)
            scored.append((self._documents[doc_id], score))

        scored.sort(key=lambda x: x[1], reverse=True)
        candidates = scored[:k]

        # Rerank with cross-encoder
        if self._reranker and len(candidates) > 1:
            pairs = [(query, doc.text) for doc, _ in candidates]
            rerank_scores = self._reranker.predict(pairs)
            reranked = sorted(
                zip(candidates, rerank_scores),
                key=lambda x: x[1],
                reverse=True,
            )
            candidates = [(doc, float(score)) for (doc, _), score in reranked[: self.rerank_top_k]]

        context = RetrievalResult(query=query, chunks=candidates).to_prompt_context()
        sources = list({doc.source for doc, _ in candidates})

        return RetrievalResult(
            query=query,
            chunks=candidates,
            context=context,
            sources=sources,
        )

    def _keyword_search(self, query: str, k: int) -> RetrievalResult:
        query_words = set(query.lower().split())
        scored = []
        for doc in self._documents.values():
            doc_words = set(doc.text.lower().split())
            overlap = len(query_words & doc_words)
            scored.append((doc, overlap))
        scored.sort(key=lambda x: x[1], reverse=True)
        candidates = scored[:k]
        context = RetrievalResult(query=query, chunks=candidates).to_prompt_context()
        return RetrievalResult(
            query=query,
            chunks=candidates,
            context=context,
            sources=list({d.source for d, _ in candidates}),
        )

    def save_index(self, path: Path | str) -> None:
        data = {
            "documents": {k: {"text": v.text, "source": v.source, "metadata": v.metadata} for k, v in self._documents.items()},
            "embeddings": self._embeddings,
            "config": {
                "embedding_model": self.embedding_model_name,
                "chunk_size": self.chunk_size,
                "chunk_overlap": self.chunk_overlap,
            },
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)

    def load_index(self, path: Path | str) -> None:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self._documents = {
            k: Document(id=k, **v) for k, v in data["documents"].items()
        }
        self._embeddings = {k: list(map(float, v)) for k, v in data["embeddings"].items()}
        config = data.get("config", {})
        self.embedding_model_name = config.get("embedding_model", self.embedding_model_name)
        self.chunk_size = config.get("chunk_size", self.chunk_size)
        self.chunk_overlap = config.get("chunk_overlap", self.chunk_overlap)
