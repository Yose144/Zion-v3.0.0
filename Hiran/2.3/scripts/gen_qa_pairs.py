#!/usr/bin/env python3
"""Synthetic QA-pair generator for the Hiran dataset rebuild.

Chunks the surviving doc corpus (V31 + docs + archive/V3 + Edge l3-rag-docs)
and asks a local llama-server (Qwen3-4B-Q4_K_M) to produce one grounded
Q&A pair per chunk. Output is appended to generated_qa.jsonl in messages
format — resumable across runs (chunk sha1 is remembered).

Usage:
  python3 gen_qa_pairs.py [--limit N] [--url http://127.0.0.1:8002]
"""

import argparse
import hashlib
import json
import random
import re
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]

CORPUS_ROOTS = [
    REPO / "V31",
    REPO / "docs" / "3.0.1Genesis",
    REPO / "docs" / "3.0.4",
    REPO / "docs" / "3.0.5",
    REPO / "docs" / "3.0.6",
    REPO / "docs" / "TerraNova",
    REPO / "docs" / "ops",
    REPO / "archive" / "V3" / "docs",
    Path("/mnt/data/zion-backups/edge/opt_zion/data/l3-rag-docs"),
]

OUT = Path(__file__).resolve().parents[1] / "rebuild" / "generated_qa.jsonl"
STATE = Path(__file__).resolve().parents[1] / "rebuild" / "generated_qa.done"

SYS = ("/no_think You write training data for Hiran, the ZION TerraNova AI "
       "assistant. Given a documentation excerpt, produce ONE high-quality "
       "Q&A pair a knowledgeable user might ask. The answer must be grounded "
       "ONLY in the excerpt — never invent facts, numbers, commands or paths. "
       "Output ONLY valid JSON: {\"q\": \"question\", \"a\": \"answer\"}.")


def chunks_of(text: str, lo: int = 600, hi: int = 1800) -> list[str]:
    """Split markdown into paragraph-aligned chunks sized lo..hi chars."""
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    out, cur = [], ""
    for p in paras:
        if len(p) > hi:  # oversized paragraph → hard wrap on sentences
            p = re.sub(r"(?<=[.!?])\s+", "\n\n", p)
            for sub in p.split("\n\n"):
                if len(cur) + len(sub) + 2 <= hi:
                    cur = f"{cur}\n\n{sub}" if cur else sub
                else:
                    if len(cur) >= lo:
                        out.append(cur)
                    cur = sub
            continue
        if len(cur) + len(p) + 2 <= hi:
            cur = f"{cur}\n\n{p}" if cur else p
        else:
            if len(cur) >= lo:
                out.append(cur)
            cur = p
    if len(cur) >= lo:
        out.append(cur)
    return out


def done_keys() -> set[str]:
    return set(STATE.read_text().split()) if STATE.exists() else set()


def gen(client_url: str, chunk: str, src: str) -> dict | None:
    user = (f"Source document: {src}\n\nEXCERPT:\n{chunk}\n\n"
            "Produce the JSON Q&A pair.")
    body = json.dumps({
        "messages": [{"role": "system", "content": SYS},
                     {"role": "user", "content": user}],
        "temperature": 0.7, "max_tokens": 600,
        "chat_template_kwargs": {"enable_thinking": False},
    }).encode()
    req = urllib.request.Request(
        f"{client_url}/v1/chat/completions", data=body,
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        content = json.load(r)["choices"][0]["message"]["content"]
    m = re.search(r"\{[^{}]*\"q\"[^{}]*\}", content, re.S)
    if not m:
        return None
    pair = json.loads(m.group(0))
    q, a = str(pair.get("q", "")).strip(), str(pair.get("a", "")).strip()
    if len(q) < 15 or len(a) < 40:
        return None
    return {"messages": [{"role": "user", "content": q},
                         {"role": "assistant", "content": a}],
            "source": f"gen:{src}"}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="max pairs this run (0=all)")
    ap.add_argument("--url", default="http://127.0.0.1:8002")
    ap.add_argument("--shuffle", action="store_true", default=True)
    args = ap.parse_args()

    # Collect (chunk_key, chunk_text, source) tuples
    tasks: list[tuple[str, str, str]] = []
    for root in CORPUS_ROOTS:
        if not root.exists():
            print(f"skip missing {root}")
            continue
        for f in sorted(root.rglob("*.md")):
            try:
                text = f.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            src = str(f.relative_to(REPO)) if f.is_relative_to(REPO) else str(f)
            for i, ch in enumerate(chunks_of(text)):
                key = hashlib.sha1(f"{src}#{i}:{ch[:80]}".encode()).hexdigest()
                tasks.append((key, ch, src))
    done = done_keys()
    random.seed(42)
    random.shuffle(tasks)
    tasks = [t for t in tasks if t[0] not in done]
    if args.limit:
        tasks = tasks[: args.limit]
    print(f"tasks: {len(tasks)} chunks to generate (done so far: {len(done)})")

    made = errs = 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("a", encoding="utf-8") as out, STATE.open("a") as st:
        for n, (key, ch, src) in enumerate(tasks, 1):
            try:
                pair = gen(args.url, ch, src)
            except Exception as e:  # noqa: BLE001 — log and continue
                errs += 1
                print(f"[{n}/{len(tasks)}] ERR {e}", flush=True)
                continue
            st.write(key + "\n")
            st.flush()
            if pair:
                out.write(json.dumps(pair, ensure_ascii=False) + "\n")
                out.flush()
                made += 1
            if n % 10 == 0:
                print(f"[{n}/{len(tasks)}] made={made} errs={errs}", flush=True)
    print(f"DONE made={made} errs={errs} -> {OUT}")


if __name__ == "__main__":
    main()
