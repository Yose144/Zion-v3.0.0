#!/usr/bin/env python3
"""Merge rebuilt dataset fragments into unified messages-format JSONL.

Inputs (run from Hiran/2.3/rebuild/):
  - HiranV2.2/data/curriculum/*.jsonl   (instruction/input/output, 1516)
  - collected_seed.jsonl              (messages, 47 — v21 collect_dataset)
  - ../data/zion_train_buddhism_guided.jsonl (messages, 19 — surviving shard)

Output: merged_seed.jsonl (messages format, deduped by instruction hash)
"""
import hashlib
import json
import sys
from pathlib import Path

OUT = Path("merged_seed.jsonl")
seen: set[str] = set()
kept = 0


def norm_key(text: str) -> str:
    return hashlib.sha1(text.strip().lower().encode()).hexdigest()


def emit(messages: list, source: str) -> None:
    global kept
    if not messages or not messages[-1].get("content", "").strip():
        return
    first_user = next((m["content"] for m in messages if m.get("role") == "user"), "")
    key = norm_key(first_user or messages[-1]["content"])
    if key in seen:
        return
    seen.add(key)
    OUT_HANDLE.write(json.dumps({"messages": messages, "source": source}, ensure_ascii=False) + "\n")
    kept += 1


with OUT.open("w", encoding="utf-8") as OUT_HANDLE:  # noqa: N806
    # 1) Curriculum instruction/input/output -> messages
    for f in sorted(Path("HiranV2.2/data/curriculum").glob("*.jsonl")):
        domain = f.stem
        for line in f.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            d = json.loads(line)
            if "messages" in d:
                emit(d["messages"], f"{domain}:{d.get('source','curriculum')}")
            elif d.get("instruction"):
                msgs = [{"role": "user", "content": d["instruction"]},
                        {"role": "assistant", "content": d.get("output", "")}]
                emit(msgs, f"{domain}:{d.get('source','curriculum')}")

    # 2) Messages-format fragments
    for f, tag in [("collected_seed.jsonl", "v21_seed"),
                   ("../data/zion_train_buddhism_guided.jsonl", "buddhism_shard")]:
        p = Path(f)
        if not p.exists():
            print(f"WARN missing {f}", file=sys.stderr)
            continue
        for line in p.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            d = json.loads(line)
            if "messages" in d:
                emit(d["messages"], tag)

print(f"merged_seed.jsonl: {kept} unique pairs")
