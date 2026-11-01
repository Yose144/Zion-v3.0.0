#!/usr/bin/env python3
"""
Replay builder — obecné české instruction páry (anti-forgetting mix) z
Bactrian-X cs (Alpaca+Dolly strojově přeloženo do češtiny) → messages.

Proč replay: validace run 1 ukázala catastrophic forgetting (nesmyslný recept,
rozbitá odmítnutí) — ~20 % obecných párů v tréninku drží generalitu + safety.

Filtry (strojový překlad má artefakty):
- output ≥60 znaků (krátké one-shot odpovědi typu "7jKmT4xNf8" ven)
- output ≤1500 znaků
- anglická slova v českém outputu ≤10 % tokenů (zbytky překladu)
- instruction ≥15 znaků
- dedup přes (instruction, output)

Použití:
  curl -L -o cs.json.gz https://huggingface.co/datasets/MBZUAI/Bactrian-X/resolve/main/data/cs.json.gz
  python3 build_replay.py cs.json.gz replay.jsonl --n 1500 [--seed 42]
"""

import argparse
import gzip
import json
import random
import re

SYSTEM_PROMPT = (
    "Jsi Hiranyagarbha — ZION blockchain expert, AI Native agent a operátorský orchestrátor. "
    "Kanonický kód je ve **V3/** (Rust: zion-core, zion-pool, zion-miner, L2/L3 služby, V3/L3/ai-native). "
    "Znáš Ekam Deeksha PoW, konsensus, pool protokol, příkazy **zion** CLI (doctor, status, logs, deploy) a dokumentaci v **V3/docs**. "
    "Legacy stromy mimo V3/ ber jako referenci. Odpovídáš přesně, technicky, v češtině (identifikátory v angličtině)."
)

EN_WORD = re.compile(r"\b(the|and|for|with|that|this|from|your|you|are|was|were|have|will|would|about|which|when|what|where|surrounded|ctrl)\b", re.I)


def en_ratio(text: str) -> float:
    toks = re.findall(r"\S+", text)
    if not toks:
        return 1.0
    return sum(1 for t in toks if EN_WORD.search(t)) / len(toks)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input", help="cs.json.gz z Bactrian-X")
    ap.add_argument("output")
    ap.add_argument("--n", type=int, default=1500)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    raw = json.load(gzip.open(args.input, "rt", encoding="utf-8"))
    print(f"vstup: {len(raw)} záznamů")

    seen = set()
    pool = []
    dropped = {"short": 0, "long": 0, "en": 0, "dup": 0, "inst": 0}
    for e in raw:
        inst = (e.get("instruction") or "").strip()
        out = (e.get("output") or "").strip()
        inp = (e.get("input") or "").strip()
        if len(inst) < 15:
            dropped["inst"] += 1
            continue
        if len(out) < 60:
            dropped["short"] += 1
            continue
        if len(out) > 1500:
            dropped["long"] += 1
            continue
        if en_ratio(out) > 0.10:
            dropped["en"] += 1
            continue
        key = (inst[:120], out[:120])
        if key in seen:
            dropped["dup"] += 1
            continue
        seen.add(key)
        user = inst + ("\n\n" + inp if inp else "")
        pool.append({
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user},
                {"role": "assistant", "content": out}],
            "metadata": {"source": f"bactrian-x/{e.get('id','?')}", "builder": "replay"}})

    print(f"po filtrech: {len(pool)} (dropped {dropped})")
    random.seed(args.seed)
    random.shuffle(pool)
    sel = pool[: args.n]
    with open(args.output, "w", encoding="utf-8") as f:
        for p in sel:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    print(f"OK -> {args.output}: {len(sel)} replay párů")


if __name__ == "__main__":
    main()
