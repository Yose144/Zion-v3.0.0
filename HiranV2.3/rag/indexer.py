#!/usr/bin/env python3
"""
Hiran v2.3 RAG Indexer
Reads knowledge corpora, chunks documents, creates embeddings, and stores in vector DB.
"""

import os
import re
from pathlib import Path
from typing import List, Dict
import hashlib

try:
    import chromadb
    from chromadb.utils import embedding_functions
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False
    print("WARNING: chromadb not installed. Run: pip install chromadb sentence-transformers")

# Configuration
CORPUS_DIR = Path(__file__).parent.parent / "knowledge" / "corpora"
DB_DIR = Path(__file__).parent.parent / "knowledge" / "vector_db"
CHUNK_SIZE = 500  # characters per chunk
CHUNK_OVERLAP = 100


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        # Try to break at sentence boundary
        if end < len(text):
            # Look for period, question mark, or newline near the end
            for i in range(end, max(start + size - 100, start), -1):
                if i < len(text) and text[i] in '.?!\n':
                    end = i + 1
                    break
        chunk = text[start:end].strip()
        if chunk and len(chunk) > 50:  # Skip tiny chunks
            chunks.append(chunk)
        if end >= len(text):
            break
        start = end - overlap
        if start < 0:
            start = end
    return chunks


def parse_markdown_file(filepath: Path) -> Dict:
    """Extract metadata and content from a markdown file."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract title from first h1
    title_match = re.search(r'^# (.+)$', content, re.MULTILINE)
    title = title_match.group(1) if title_match else filepath.stem

    # Extract domain from metadata
    domain_match = re.search(r'\*\*Domain:\*\* (.+)', content)
    domain = domain_match.group(1).strip() if domain_match else "unknown"

    # Extract category
    category_match = re.search(r'\*\*Category:\*\* (.+)', content)
    category = category_match.group(1).strip() if category_match else "unknown"

    # Extract language
    lang_match = re.search(r'\*\*Language:\*\* (.+)', content)
    language = lang_match.group(1).strip() if lang_match else "English"

    # Remove metadata lines and source footer
    lines = content.split('\n')
    clean_lines = []
    in_source = False
    for line in lines:
        if line.startswith('---') and 'Source:' in line:
            in_source = True
        if in_source:
            continue
        if line.startswith('**Domain:**') or line.startswith('**Category:**') or line.startswith('**Date Indexed:**') or line.startswith('**Language:**'):
            continue
        if line.startswith('---') and not clean_lines:
            continue
        clean_lines.append(line)

    clean_content = '\n'.join(clean_lines).strip()
    # Remove title line if present
    clean_content = re.sub(r'^# .+\n+', '', clean_content, count=1)

    return {
        "title": title,
        "domain": domain,
        "category": category,
        "language": language,
        "content": clean_content,
        "source_file": str(filepath.relative_to(CORPUS_DIR.parent.parent)),
    }


def create_collection_name(domain: str, category: str) -> str:
    """Create a ChromaDB collection name."""
    name = f"{domain.lower().replace(' ', '_')}_{category.lower().replace(' ', '_')}"
    # ChromaDB names must be 3-63 chars, alphanumeric, underscores, hyphens
    name = re.sub(r'[^a-z0-9_-]', '_', name)
    if len(name) > 63:
        name = name[:63]
    if len(name) < 3:
        name = name + "_docs"
    return name


def build_index():
    """Build the vector index from all corpora."""
    if not CHROMADB_AVAILABLE:
        print("ERROR: chromadb not available. Install with: pip install chromadb sentence-transformers")
        return

    print("=" * 60)
    print("Hiran v2.3 RAG Indexer")
    print("=" * 60)

    # Initialize ChromaDB
    DB_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(DB_DIR))

    # Use all-MiniLM-L6-v2 as embedding model (fast, good quality, 384 dims)
    embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

    # Track stats
    total_docs = 0
    total_chunks = 0

    # Process all markdown files
    md_files = list(CORPUS_DIR.glob("*.md"))
    print(f"\nFound {len(md_files)} markdown files")

    for md_file in md_files:
        print(f"\nProcessing: {md_file.name}")
        doc = parse_markdown_file(md_file)

        chunks = chunk_text(doc["content"])
        print(f"  Title: {doc['title']}")
        print(f"  Domain: {doc['domain']} | Category: {doc['category']}")
        print(f"  Chunks: {len(chunks)}")

        if not chunks:
            continue

        # Get or create collection
        collection_name = create_collection_name(doc["domain"], doc["category"])
        try:
            collection = client.get_collection(name=collection_name)
            print(f"  Using existing collection: {collection_name}")
        except Exception:
            collection = client.create_collection(
                name=collection_name,
                embedding_function=embedding_fn,
                metadata={
                    "domain": doc["domain"],
                    "category": doc["category"],
                }
            )
            print(f"  Created collection: {collection_name}")

        # Add chunks to collection
        ids = []
        documents = []
        metadatas = []

        for i, chunk in enumerate(chunks):
            chunk_id = hashlib.md5(f"{doc['source_file']}:{i}".encode()).hexdigest()
            ids.append(chunk_id)
            documents.append(chunk)
            metadatas.append({
                "title": doc["title"],
                "chunk_index": i,
                "source_file": doc["source_file"],
                "language": doc["language"],
            })

        collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
        )

        total_docs += 1
        total_chunks += len(chunks)

    print(f"\n{'=' * 60}")
    print("INDEXING COMPLETE")
    print(f"{'=' * 60}")
    print(f"  Documents indexed: {total_docs}")
    print(f"  Total chunks: {total_chunks}")
    print(f"  Vector DB location: {DB_DIR}")
    print(f"\nCollections:")
    for coll in client.list_collections():
        count = coll.count()
        print(f"  - {coll.name}: {count} chunks")


def main():
    build_index()


if __name__ == "__main__":
    main()
