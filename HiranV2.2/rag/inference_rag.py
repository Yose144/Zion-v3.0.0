#!/usr/bin/env python3
"""
Hiran v2.2 RAG Inference — retrieval + chat completion pipeline.
Retrieves relevant context from ChromaDB, injects it into the system prompt,
and queries the llama-server.exe inference API on port 8002.
"""
import json
import sys
import urllib.request
from pathlib import Path

import chromadb

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CHROMA_DIR = REPO_ROOT / "HiranV2.2" / "rag" / "chroma_db"
INFERENCE_URL = "http://127.0.0.1:8002/v1/chat/completions"
EMBEDDING_URL = "http://127.0.0.1:8002/v1/embeddings"

def get_embedding(text: str) -> list[float]:
    import hashlib
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
        h = hashlib.sha256(text.encode()).digest()
        return [(int.from_bytes(h[i % len(h): (i % len(h)) + 4], "big", signed=True) % 1000) / 1000.0
                for i in range(512)]

def retrieve_context(query: str, n_results: int = 3) -> str:
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    coll = client.get_collection("zion_docs_v2.2")
    emb = get_embedding(query)
    results = coll.query(query_embeddings=[emb], n_results=n_results)
    contexts = []
    for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
        contexts.append(f"[{meta['source']}] {doc}")
    return "\n\n".join(contexts)

def chat_with_rag(query: str, temperature: float = 0.7, max_tokens: int = 300) -> dict:
    context = retrieve_context(query)
    system_prompt = (
        "You are Hiran v2.2, the AI assistant of the ZION TerraNova project. "
        "Use the following retrieved context to answer accurately. "
        "If the context does not contain the answer, say so honestly.\n\n"
        f"--- Retrieved Context ---\n{context}\n--- End Context ---"
    )
    payload = json.dumps({
        "model": "hiran-v2.2",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }).encode()
    req = urllib.request.Request(
        INFERENCE_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read())

if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "Jake je rozdeleni poplatku v ZION tezbe?"
    print(f"[RAG] Query: {query}")
    try:
        result = chat_with_rag(query)
        reply = result["choices"][0]["message"]["content"]
        print(f"\n[Reply] {reply}")
        print(f"\n[Stats] prompt_tokens={result['usage']['prompt_tokens']}, "
              f"completion_tokens={result['usage']['completion_tokens']}, "
              f"total={result['usage']['total_tokens']}")
    except Exception as e:
        print(f"[Error] {e}")
