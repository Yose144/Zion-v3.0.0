#!/usr/bin/env python3
"""Build a small random holdout JSONL from a curriculum file (for offline eval)."""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path
from typing import Any, Dict, List


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--train_out", type=Path, required=True)
    p.add_argument("--eval_out", type=Path, required=True)
    p.add_argument("--eval_ratio", type=float, default=0.05)
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args()

    random.seed(args.seed)
    rows: List[Dict[str, Any]] = []
    with args.input.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    random.shuffle(rows)
    n_eval = max(1, int(len(rows) * args.eval_ratio))
    eval_rows = rows[:n_eval]
    train_rows = rows[n_eval:]

    args.train_out.parent.mkdir(parents=True, exist_ok=True)
    args.eval_out.parent.mkdir(parents=True, exist_ok=True)
    with args.train_out.open("w", encoding="utf-8") as ft:
        for r in train_rows:
            ft.write(json.dumps(r, ensure_ascii=False) + "\n")
    with args.eval_out.open("w", encoding="utf-8") as fe:
        for r in eval_rows:
            fe.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"total={len(rows)} train={len(train_rows)} eval={len(eval_rows)}")


if __name__ == "__main__":
    main()
