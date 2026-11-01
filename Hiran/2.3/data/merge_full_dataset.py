#!/usr/bin/env python3
"""
Merge full Hiran dataset — spojí všechny messages zdroje, globálně deduplikuje
a oddělí held-out eval (~5 %, nikdy do tréninku).

Výstupy:
  --train-out  tréninkový jsonl (messages)
  --eval-out   held-out eval jsonl (stejné messages — eval přes chat completion)

Zdroje (default ./curriculum-messages/*.jsonl + v2.1 + buddhism):
  v2.1 curriculum, curriculum-messages (core/advanced/cross/foundation/rag/
  ops/kb/v3_crates), replay (bactrian cs), buddhism.

Eval split: per-source, seed-fix → reprodukovatelné. Eval se NEMÍCHÁ do trainu —
měří generalizaci, ne memoraci (lekce: run 1 eval 0.284 na curriculum splitu
= memorace; viz REPORT_2026-11-01_HIRAN_VAST_TRAINING §7).
"""

import argparse
import glob
import json
import random
from pathlib import Path


def iter_pairs(path: str):
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            msgs = d.get("messages") or []
            u = next((m["content"] for m in msgs if m.get("role") == "user"), "")
            a = next((m["content"] for m in msgs if m.get("role") == "assistant"), "")
            if not u or not a:
                continue
            yield d, u, a


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", nargs="+", required=True, help="jsonl soubory nebo globs")
    ap.add_argument("--train-out", required=True)
    ap.add_argument("--eval-out", required=True)
    ap.add_argument("--eval-frac", type=float, default=0.05)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    files = []
    for s in args.src:
        files.extend(sorted(glob.glob(s)))
    if not files:
        raise SystemExit("žádné zdrojové soubory")

    rng = random.Random(args.seed)
    seen: set = set()
    train_n = eval_n = dup_n = 0
    per_src = {}

    train_f = open(args.train_out, "w", encoding="utf-8")
    eval_f = open(args.eval_out, "w", encoding="utf-8")

    for path in files:
        rows = list(iter_pairs(path))
        rng.shuffle(rows)
        n_eval = max(1, int(len(rows) * args.eval_frac))
        src_train = src_eval = 0
        for d, u, a in rows:
            key = u[:120] + "|" + a[:120]
            if key in seen:
                dup_n += 1
                continue
            seen.add(key)
            if src_eval < n_eval:
                eval_f.write(json.dumps(d, ensure_ascii=False) + "\n")
                eval_n += 1
                src_eval += 1
            else:
                train_f.write(json.dumps(d, ensure_ascii=False) + "\n")
                train_n += 1
                src_train += 1
        per_src[Path(path).name] = (src_train, src_eval)

    train_f.close()
    eval_f.close()

    print(f"OK train={train_n} eval={eval_n} dup={dup_n}")
    for name, (t, e) in per_src.items():
        print(f"  {name}: train={t} eval={e}")


if __name__ == "__main__":
    main()
