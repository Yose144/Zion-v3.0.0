#!/usr/bin/env python3
"""
Hiran v2.3 RAG Retriever
Retrieves relevant context from the vector database for a given query.
"""

from pathlib import Path
from typing import List, Dict, Optional

try:
    import chromadb
    from chromadb.utils import embedding_functions
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False

DB_DIR = Path(__file__).parent.parent / "knowledge" / "vector_db"

# Default retrieval settings
DEFAULT_TOP_K = 5
DEFAULT_SIMILARITY_THRESHOLD = 0.3


class KnowledgeRetriever:
    """Retrieves knowledge from the vector database."""

    def __init__(self, db_path: str = None, embedding_model: str = "all-MiniLM-L6-v2"):
        if not CHROMADB_AVAILABLE:
            raise ImportError("chromadb not installed. Run: pip install chromadb sentence-transformers")

        self.db_path = db_path or str(DB_DIR)
        self.client = chromadb.PersistentClient(path=self.db_path)
        self.embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=embedding_model
        )
        self.collections = self.client.list_collections()
        print(f"RAG Retriever initialized with {len(self.collections)} collections")

    def retrieve(
        self,
        query: str,
        top_k: int = DEFAULT_TOP_K,
        filter_domain: Optional[str] = None,
        filter_category: Optional[str] = None,
    ) -> List[Dict]:
        """
        Retrieve relevant chunks for a query.

        Args:
            query: The user's question
            top_k: Number of chunks to retrieve per collection
            filter_domain: Only search collections from this domain
            filter_category: Only search collections from this category

        Returns:
            List of chunk dictionaries with score, content, and metadata
        """
        results = []

        for collection in self.collections:
            # Check metadata filters
            coll_info = collection.metadata or {}
            if filter_domain and coll_info.get("domain") != filter_domain:
                continue
            if filter_category and coll_info.get("category") != filter_category:
                continue

            # Query collection
            try:
                query_results = collection.query(
                    query_texts=[query],
                    n_results=min(top_k, max(1, collection.count() // 2 + 1)),
                    include=["documents", "metadatas", "distances"],
                )

                # Process results
                for i in range(len(query_results["ids"][0])):
                    doc = query_results["documents"][0][i]
                    meta = query_results["metadatas"][0][i]
                    distance = query_results["distances"][0][i]

                    # Convert distance to similarity score (Chroma uses cosine distance)
                    # distance is 1 - cosine_similarity for cosine distance metric
                    similarity = 1 - distance

                    results.append({
                        "content": doc,
                        "title": meta.get("title", "Unknown"),
                        "source_file": meta.get("source_file", ""),
                        "chunk_index": meta.get("chunk_index", 0),
                        "collection": collection.name,
                        "domain": coll_info.get("domain", "unknown"),
                        "category": coll_info.get("category", "unknown"),
                        "similarity": round(similarity, 4),
                    })
            except Exception as e:
                print(f"  Warning: query failed for {collection.name}: {e}")
                continue

        # Sort by similarity (highest first)
        results.sort(key=lambda x: x["similarity"], reverse=True)

        # Deduplicate by content similarity
        filtered = []
        seen = set()
        for r in results:
            content_hash = hash(r["content"][:200])
            if content_hash not in seen:
                seen.add(content_hash)
                filtered.append(r)

        return filtered[:top_k]

    def retrieve_for_zion(self, query: str, top_k: int = 3) -> List[Dict]:
        """Retrieve only from Zion domain knowledge (if indexed separately)."""
        return self.retrieve(query, top_k=top_k, filter_domain="Zion")

    def retrieve_general(self, query: str, top_k: int = 5) -> List[Dict]:
        """Retrieve from all non-Zion knowledge."""
        return self.retrieve(query, top_k=top_k)

    def format_context(self, results: List[Dict]) -> str:
        """Format retrieval results into a context string for the model."""
        if not results:
            return ""

        context_parts = ["## Retrieved Knowledge\n"]
        for i, r in enumerate(results):
            context_parts.append(
                f"[{i+1}] **{r['title']}** ({r['domain']} - {r['category']})\n"
                f"{r['content']}\n"
            )

        return "\n".join(context_parts)


def main():
    """Test retriever with sample queries."""
    print("=" * 60)
    print("RAG Retriever Test")
    print("=" * 60)

    retriever = KnowledgeRetriever()

    test_queries = [
        "What is the Book of Amduat?",
        "Tell me about ancient Egyptian beliefs",
        "What are the 7 Zion humanitarian categories?",  # This should ideally be handled by FT model
        "How does quantum mechanics work?",
        "What are the Romance languages?",
        "Tell me about Hawaiian culture",
    ]

    for query in test_queries:
        print(f"\nQuery: {query}")
        results = retriever.retrieve(query, top_k=3)
        if results:
            for r in results:
                print(f"  [{r['similarity']:.3f}] {r['title']} ({r['domain']})")
        else:
            print("  No results found")


if __name__ == "__main__":
    main()
