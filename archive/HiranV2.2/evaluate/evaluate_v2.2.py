#!/usr/bin/env python3
"""
Evaluation helpers for Hiran v2.2 (Phase 2 — perplexity + lexical overlap).

Example::

    python3 HiranV2.2/evaluate/evaluate_v2.2.py \\
        --adapter_path HiranV2.2/checkpoints/foundation/final \\
        --base_model unsloth/Meta-Llama-3.1-8B-Instruct \\
        --data_path HiranV2.2/data/curriculum/foundation.jsonl \\
        --sample_size 32 \\
        --output HiranV2.2/eval_reports/smoke.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS = _ROOT / "scripts"
_EVAL = Path(__file__).resolve().parent
for p in (_SCRIPTS, _EVAL):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Hiran v2.2 evaluation")
    p.add_argument("--adapter_path", type=str, required=True)
    p.add_argument("--base_model", type=str, default="unsloth/Meta-Llama-3.1-8B-Instruct")
    p.add_argument("--data_path", type=str, required=True)
    p.add_argument("--sample_size", type=int, default=50)
    p.add_argument("--output", type=str, default=str(_ROOT / "eval_reports" / "eval.json"))
    p.add_argument("--max_new_tokens", type=int, default=128)
    p.add_argument("--dry_run", action="store_true", help="Only load metrics on tiny stub")
    return p.parse_args()


def _load_rows(path: Path, limit: int) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
            if len(rows) >= limit:
                break
    return rows


def _perplexity_sample(model, tokenizer, texts: List[str], max_length: int = 512) -> float:
    import math
    import torch

    total_nll = 0.0
    total_tokens = 0
    model.eval()
    with torch.no_grad():
        for text in texts:
            enc = tokenizer(
                text,
                return_tensors="pt",
                truncation=True,
                max_length=max_length,
            ).to(next(model.parameters()).device)
            if enc["input_ids"].size(1) < 2:
                continue
            out = model(**enc, labels=enc["input_ids"])
            n = enc["input_ids"].numel()
            total_nll += float(out.loss) * n
            total_tokens += n
    if total_tokens == 0:
        return float("nan")
    return math.exp(total_nll / total_tokens)


def main() -> None:
    args = _parse_args()
    if args.dry_run:
        from metrics import rouge_l_f1, word_overlap_score

        g = "a b c d"
        r = "b c d e"
        print(json.dumps({"overlap": word_overlap_score(g, r), "rougeL": rouge_l_f1(g, r)}, indent=2))
        return

    data_path = Path(args.data_path)
    rows = _load_rows(data_path, args.sample_size)
    if not rows:
        raise SystemExit(f"No rows in {data_path}")

    import torch
    from data_loader import format_instruction_row, format_prompt_only
    from metrics import aggregate_mean, rouge_l_f1, word_overlap_score
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

    bnb = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
    )
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    base = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        quantization_config=bnb,
        device_map="auto",
        trust_remote_code=True,
    )
    model = PeftModel.from_pretrained(base, args.adapter_path)
    model.eval()

    texts = [format_instruction_row(r) for r in rows]
    ppl = _perplexity_sample(model, tokenizer, texts[: min(8, len(texts))])

    overlaps: List[float] = []
    rouges: List[float] = []
    device = next(model.parameters()).device
    for row in rows[: min(16, len(rows))]:
        prompt = format_prompt_only(row)
        ref = (row.get("output") or "").strip()
        inputs = tokenizer(prompt, return_tensors="pt").to(device)
        with torch.no_grad():
            out = model.generate(
                **inputs,
                max_new_tokens=args.max_new_tokens,
                do_sample=False,
                pad_token_id=tokenizer.pad_token_id,
            )
        gen = tokenizer.decode(out[0], skip_special_tokens=True)
        if "### Response:\n" in gen:
            gen = gen.split("### Response:\n", 1)[-1].strip()
        overlaps.append(word_overlap_score(gen, ref))
        rouges.append(rouge_l_f1(gen, ref))

    report = {
        "adapter_path": args.adapter_path,
        "base_model": args.base_model,
        "data_path": str(data_path),
        "sample_size": len(rows),
        "perplexity_subsample": ppl,
        "word_overlap": aggregate_mean(overlaps),
        "rouge_l_f1": aggregate_mean(rouges),
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
