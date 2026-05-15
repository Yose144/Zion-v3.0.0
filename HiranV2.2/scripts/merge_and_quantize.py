#!/usr/bin/env python3
"""
Merge a Hiran v2.2 LoRA adapter into its base model and save the full merged weights.

Usage::

    python3 HiranV2.2/scripts/merge_and_quantize.py \
        --base_model unsloth/Meta-Llama-3.1-8B-Instruct \
        --adapter HiranV2.2/checkpoints/rag_synthesis/final \
        --output_dir HiranV2.2/checkpoints/hiran-v2.2-merged
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Merge LoRA adapter into base model")
    p.add_argument(
        "--base_model",
        type=str,
        default="unsloth/Meta-Llama-3.1-8B-Instruct",
        help="HF model id for the base model",
    )
    p.add_argument(
        "--adapter",
        type=str,
        required=True,
        help="Path to the LoRA adapter directory (e.g., checkpoints/rag_synthesis/final)",
    )
    p.add_argument(
        "--output_dir",
        type=str,
        required=True,
        help="Directory to save the merged model",
    )
    p.add_argument(
        "--load_in_4bit",
        action="store_true",
        help="Load base model in 4-bit before merge (saves VRAM; merge happens in memory)",
    )
    return p.parse_args()


def main() -> None:
    args = _parse_args()
    adapter_path = Path(args.adapter)
    output_dir = Path(args.output_dir)

    if not adapter_path.is_dir():
        raise SystemExit(f"Adapter path not found: {adapter_path}")

    output_dir.mkdir(parents=True, exist_ok=True)

    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

    print(f"Loading base model: {args.base_model}")
    if args.load_in_4bit:
        bnb = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
        )
        base = AutoModelForCausalLM.from_pretrained(
            args.base_model,
            quantization_config=bnb,
            device_map="auto",
            trust_remote_code=True,
        )
    else:
        base = AutoModelForCausalLM.from_pretrained(
            args.base_model,
            torch_dtype=torch.float16,
            device_map="auto",
            trust_remote_code=True,
        )

    print(f"Loading adapter: {adapter_path}")
    model = PeftModel.from_pretrained(base, str(adapter_path))

    print("Merging adapter into base model...")
    merged = model.merge_and_unload()

    tokenizer = AutoTokenizer.from_pretrained(args.base_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    print(f"Saving merged model to: {output_dir}")
    merged.save_pretrained(str(output_dir), safe_serialization=True)
    tokenizer.save_pretrained(str(output_dir))

    print(f"Done. Merged model saved to: {output_dir}")


if __name__ == "__main__":
    main()
