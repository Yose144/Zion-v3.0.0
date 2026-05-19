#!/usr/bin/env python3
"""
Hiran v2.3 Model Merge Script
Merges final DORA adapter into base model for inference.
"""

import torch
import argparse
from pathlib import Path
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

BASE_MODEL = "nvidia/OpenReasoning-Nemotron-32B"


def merge_adapter(adapter_path, output_path, push_to_hub=False):
    """Merge DORA adapter into base model."""
    print(f"Loading base model: {BASE_MODEL}")
    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
    )
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)

    print(f"Loading adapter: {adapter_path}")
    model = PeftModel.from_pretrained(model, adapter_path)

    print("Merging adapter into base model...")
    model = model.merge_and_unload()

    print(f"Saving merged model to: {output_path}")
    output_path = Path(output_path)
    output_path.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(output_path)
    tokenizer.save_pretrained(output_path)

    print("Merge complete!")
    print(f"  Model saved: {output_path}")
    print(f"  Size: ~{sum(f.stat().st_size for f in output_path.glob('*')) / 1e9:.1f} GB")

    if push_to_hub:
        print("Pushing to HuggingFace Hub...")
        model.push_to_hub("hiran-v2.3-merged")
        tokenizer.push_to_hub("hiran-v2.3-merged")


def quantize_to_gguf(merged_path, output_path):
    """Quantize merged model to GGUF for local inference."""
    print("GGUF quantization requires llama.cpp.")
    print("Install: git clone https://github.com/ggerganov/llama.cpp")
    print("Convert: python llama.cpp/convert.py {merged_path} --outfile {output_path}")
    print("Quantize: ./llama.cpp/quantize {output_path} {output_path.replace('.gguf', '-Q4_K_M.gguf')} Q4_K_M")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--adapter", required=True, help="Path to final adapter")
    parser.add_argument("--output", default="hiran-v2.3-merged", help="Output path")
    parser.add_argument("--push_hub", action="store_true", help="Push to HF Hub")
    parser.add_argument("--gguf", action="store_true", help="Also create GGUF")
    args = parser.parse_args()

    merge_adapter(args.adapter, args.output, args.push_hub)

    if args.gguf:
        quantize_to_gguf(args.output, "hiran-v2.3-Q4_K_M.gguf")


if __name__ == "__main__":
    main()
