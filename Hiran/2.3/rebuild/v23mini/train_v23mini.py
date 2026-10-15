#!/usr/bin/env python3
"""Hiran v2.3-mini — QLoRA SFT on Qwen3-8B.

Sized for the local node target: merged result must fit Vega 8G at Q5_K_M
(~5.7G), so we train the 8B class model, not 32B. Dataset is chat-format
``{"messages": [...]}`` JSONL — trl SFTTrainer applies the Qwen3 chat
template automatically.

Run on a vast.ai A100/4090/3090 instance (24G VRAM is plenty for QLoRA 8B
@ seq 4096):

    pip install -r requirements-v23mini.txt
    python3 train_v23mini.py --data merged_seed.filtered.jsonl \
        --output_dir checkpoints/v23mini
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Hiran v2.3-mini QLoRA trainer")
    p.add_argument("--base_model", default="Qwen/Qwen3-8B")
    p.add_argument("--data", required=True, help="JSONL with {messages:[...]}")
    p.add_argument("--output_dir", default="checkpoints/v23mini")
    p.add_argument("--lora_r", type=int, default=32)
    p.add_argument("--lora_alpha", type=int, default=64)
    p.add_argument("--seq_len", type=int, default=4096)
    p.add_argument("--epochs", type=float, default=2.0)
    p.add_argument("--lr", type=float, default=1e-4)
    p.add_argument("--batch_size", type=int, default=4)
    p.add_argument("--grad_accum", type=int, default=8)
    p.add_argument("--save_steps", type=int, default=250)
    p.add_argument("--max_rows", type=int, default=None)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--drop_echo", action="store_true",
                   help="drop rows where the assistant answer is a verbatim "
                        "substring of the user message (doc-dump synthetic)")
    p.add_argument("--eval_split", type=float, default=0.02)
    return p.parse_args()


def load_rows(path: str, drop_echo: bool, max_rows: int | None, seed: int):
    rows = []
    dropped = 0
    for line in Path(path).open():
        line = line.strip()
        if not line:
            continue
        try:
            r = json.loads(line)
        except json.JSONDecodeError:
            continue
        msgs = r.get("messages")
        if not msgs or len(msgs) < 2:
            continue
        if drop_echo and len(msgs) == 2:
            q, a = msgs[0].get("content", ""), msgs[-1].get("content", "")
            # assistant answer that is just the source doc echoed back
            if len(a) > 400 and a[:400] in q:
                dropped += 1
                continue
        rows.append({"messages": msgs})
    random.Random(seed).shuffle(rows)
    if max_rows:
        rows = rows[:max_rows]
    print(f"[data] {len(rows)} rows kept, {dropped} echo rows dropped")
    return rows


def main() -> int:
    args = parse_args()
    rows = load_rows(args.data, args.drop_echo, args.max_rows, args.seed)
    if not rows:
        print("[data] no usable rows", file=sys.stderr)
        return 1

    import torch
    from datasets import Dataset
    from peft import LoraConfig
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from trl import SFTConfig, SFTTrainer

    n_eval = max(1, int(len(rows) * args.eval_split))
    ds = Dataset.from_list(rows)
    ds = ds.train_test_split(test_size=n_eval, seed=args.seed)

    bnb = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )
    attn = "eager"
    if torch.cuda.is_available():
        try:
            import flash_attn  # noqa: F401
            attn = "flash_attention_2"
        except ImportError:
            attn = "sdpa"
    model = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        quantization_config=bnb,
        device_map="auto",
        torch_dtype=torch.bfloat16,
        attn_implementation=attn,
    )
    model.config.use_cache = False
    tokenizer = AutoTokenizer.from_pretrained(args.base_model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    lora = LoraConfig(
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        use_rslora=True,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
    )

    import inspect
    cfg_kwargs = dict(
        output_dir=args.output_dir,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        lr_scheduler_type="cosine",
        warmup_ratio=0.05,
        logging_steps=10,
        save_steps=args.save_steps,
        save_strategy="steps",
        bf16=True,
        gradient_checkpointing=True,
        report_to=["tensorboard"],
        seed=args.seed,
    )
    sig = inspect.signature(SFTConfig.__init__).parameters
    has_varkw = any(p.kind == inspect.Parameter.VAR_KEYWORD
                    for p in sig.values())
    # trl/transformers rename churn: warmup_ratio→warmup_steps,
    # eval_strategy→evaluation_strategy, max_length vs max_seq_length
    if "warmup_ratio" not in sig and not has_varkw:
        cfg_kwargs["warmup_steps"] = 20
        del cfg_kwargs["warmup_ratio"]
    eval_key = ("eval_strategy" if ("eval_strategy" in sig or has_varkw)
                else "evaluation_strategy")
    cfg_kwargs[eval_key] = "steps"
    cfg_kwargs["eval_steps"] = args.save_steps
    if "max_length" in sig or has_varkw:
        cfg_kwargs["max_length"] = args.seq_len
    elif "max_seq_length" in sig:
        cfg_kwargs["max_seq_length"] = args.seq_len
    if not has_varkw:
        cfg_kwargs = {k: v for k, v in cfg_kwargs.items() if k in sig}
    cfg = SFTConfig(**cfg_kwargs)

    t_sig = inspect.signature(SFTTrainer.__init__).parameters
    tok_key = "processing_class" if "processing_class" in t_sig else "tokenizer"
    trainer = SFTTrainer(
        model=model,
        args=cfg,
        train_dataset=ds["train"],
        eval_dataset=ds["test"],
        peft_config=lora,
        **{tok_key: tokenizer},
    )
    trainer.train()
    trainer.save_model(f"{args.output_dir}/final")
    tokenizer.save_pretrained(f"{args.output_dir}/final")
    print(f"[done] adapter saved to {args.output_dir}/final")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
