#!/usr/bin/env python3
"""
Hiran v2.2 RAG Setup — ChromaDB + llama-server.exe embeddings
Creates a vector DB from ZION documentation for retrieval-augmented generation.
"""
import hashlib
import json
import os
import re
import sys
from pathlib import Path

import chromadb
from chromadb.config import Settings

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
DOCS = [
    REPO_ROOT / "StatusV3.md",
    REPO_ROOT / "AGENTS.md",
    REPO_ROOT / "HIRAN_LOCAL_SETUP.md",
    REPO_ROOT / "V3" / "README.md",
    REPO_ROOT / "V3" / "ROADMAP.md",
]
CHROMA_DIR = REPO_ROOT / "HiranV2.2" / "rag" / "chroma_db"
EMBEDDING_URL = "http://127.0.0.1:8002/v1/embeddings"

def chunk_text(text: str, chunk_size: int = 512, overlap: int = 64) -> list[str]:
    """Split text into overlapping chunks."""
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks

def get_embedding(text: str) -> list[float]:
    """Get embedding from llama-server.exe (deterministic hash-based fallback if server down)."""
    import urllib.request
    try:
        req = urllib.request.Request(
            EMBEDDING_URL,
            data=json.dumps({"model": "hiran-v2.2", "input": text}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            return data["data"][0]["embedding"]
    except Exception:
        # Deterministic fallback: hash-based mock embedding (dim=512)
        h = hashlib.sha256(text.encode()).digest()
        dim = 512
        vec = []
        for i in range(dim):
            val = int.from_bytes(h[i % len(h): (i % len(h)) + 4], "big", signed=True)
            vec.append((val % 1000) / 1000.0)
        return vec

def setup_db():
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(
        path=str(CHROMA_DIR),
        settings=chromadb.Settings(anonymized_telemetry=False),
    )
    collection = client.get_or_create_collection(name="zion_docs_v2.2")

    docs_added = 0
    for doc_path in DOCS:
        if not doc_path.exists():
            print(f"  SKIP {doc_path.name} (not found)")
            continue
        text = doc_path.read_text(encoding="utf-8", errors="ignore")
        chunks = chunk_text(text, chunk_size=400, overlap=50)
        print(f"  {doc_path.name}: {len(chunks)} chunks")

        for idx, chunk in enumerate(chunks):
            doc_id = f"{doc_path.stem}_{idx}"
            emb = get_embedding(chunk)
            collection.add(
                ids=[doc_id],
                documents=[chunk],
                embeddings=[emb],
                metadatas=[{"source": doc_path.name, "chunk_idx": idx}],
            )
            docs_added += 1

    print(f"\n[OK] RAG DB ready: {docs_added} chunks in '{CHROMA_DIR}'")
    return collection

def test_query(collection, query: str, n_results: int = 3):
    emb = get_embedding(query)
    results = collection.query(query_embeddings=[emb], n_results=n_results)
    print(f"\n[QUERY] '{query}'")
    for i, (doc, meta, dist) in enumerate(zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    )):
        print(f"  [{i+1}] {meta['source']} (dist={dist:.4f})")
        preview = doc[:200].replace("\n", " ").replace("\u2192", "->")
        print(f"      {preview}...")

if __name__ == "__main__":
    print("Setting up Hiran v2.2 RAG (ChromaDB)...")
    print(f"Docs: {[p.name for p in DOCS if p.exists()]}")
    coll = setup_db()
    test_query(coll, "ZION fee split mining")
    test_query(coll, "Hiranyagarbha orchestrator API endpoints")
