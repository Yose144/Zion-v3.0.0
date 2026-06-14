#!/usr/bin/env python3
"""
Hiran v2.3 — Merge LoRA adapter into base model and export to GGUF.

Usage (on Vast AI server):
    cd /workspace/hiran-v2.3
    python scripts/merge_and_export.py \
        --checkpoint checkpoints/stage1_factual/checkpoint-6500 \
        --output /workspace/hiran-v2.3-merged \
        --gguf-output /workspace/hiran-v2.3-6500-q5.gguf \
        --quantization q5_k_m

Requirements:
    pip install transformers peft torch accelerate
    # llama.cpp for GGUF conversion
"""

import argparse
import os
import sys
import json
import shutil
from pathlib import Path

def run_cmd(cmd):
    print(f"$ {cmd}")
    rc = os.system(cmd)
    if rc != 0:
        print(f"FAILED with code {rc}")
        sys.exit(rc)

def main():
    parser = argparse.ArgumentParser(description="Merge Hiran LoRA and export to GGUF")
    parser.add_argument("--checkpoint", required=True, help="Path to checkpoint dir with adapter")
    parser.add_argument("--base-model", default="Qwen/Qwen3-32B", help="Base model name or path")
    parser.add_argument("--output", default="/workspace/hiran-v2.3-merged", help="Merged HF model output dir")
    parser.add_argument("--gguf-output", default="/workspace/hiran-v2.3-6500-q5.gguf", help="GGUF output path")
    parser.add_argument("--quantization", default="q5_k_m", choices=["q4_k_m", "q5_k_m", "q8_0", "f16"], help="GGUF quantization type")
    parser.add_argument("--skip-merge", action="store_true", help="Skip merge, only convert existing merged model")
    parser.add_argument("--skip-gguf", action="store_true", help="Skip GGUF conversion")
    args = parser.parse_args()

    checkpoint_dir = Path(args.checkpoint)
    merged_dir = Path(args.output)
    gguf_path = Path(args.gguf_output)

    # Step 1: Merge LoRA into base model
    if not args.skip_merge:
        print("=" * 60)
        print("STEP 1: Merge LoRA adapter into base model")
        print("=" * 60)

        adapter_model = checkpoint_dir / "adapter_model.safetensors"
        adapter_config = checkpoint_dir / "adapter_config.json"

        if not adapter_model.exists():
            print(f"ERROR: Adapter not found: {adapter_model}")
            sys.exit(1)
        if not adapter_config.exists():
            print(f"ERROR: Adapter config not found: {adapter_config}")
            sys.exit(1)

        # Create merge script dynamically
        merge_script = f"""
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import os

print("Loading base model: {args.base_model}")
# Load in BF16, device_map auto for multi-GPU
model = AutoModelForCausalLM.from_pretrained(
    "{args.base_model}",
    torch_dtype=torch.bfloat16,
    device_map="auto",
    trust_remote_code=True,
)
tokenizer = AutoTokenizer.from_pretrained("{args.base_model}", trust_remote_code=True)

print("Loading LoRA adapter from: {checkpoint_dir}")
model = PeftModel.from_pretrained(model, "{checkpoint_dir}")

print("Merging adapter...")
model = model.merge_and_unload()

print(f"Saving merged model to: {merged_dir}")
merged_dir = "{merged_dir}"
os.makedirs(merged_dir, exist_ok=True)
model.save_pretrained(merged_dir)
tokenizer.save_pretrained(merged_dir)

print("Merge complete!")
"""
        script_path = "/tmp/merge_hiran.py"
        with open(script_path, "w") as f:
            f.write(merge_script)

        run_cmd(f"python {script_path}")

        # Also copy chat template if present
        chat_template_src = checkpoint_dir / "chat_template.jinja"
        if chat_template_src.exists():
            shutil.copy(chat_template_src, merged_dir / "chat_template.jinja")
            print(f"Copied chat_template.jinja")

        print(f"Merged model saved to: {merged_dir}")
        print(f"Size: {shutil.disk_usage(merged_dir).used / 1e9:.1f} GB")

    # Step 2: Convert to GGUF
    if not args.skip_gguf:
        print()
        print("=" * 60)
        print("STEP 2: Convert merged model to GGUF")
        print(f"  Quantization: {args.quantization}")
        print(f"  Output: {gguf_path}")
        print("=" * 60)

        if not merged_dir.exists():
            print(f"ERROR: Merged model not found: {merged_dir}")
            sys.exit(1)

        # Check llama.cpp convert script
        convert_script = None
        for path in [
            "/workspace/llama.cpp/convert_hf_to_gguf.py",
            "/workspace/llama.cpp/convert.py",
            "/usr/local/bin/convert_hf_to_gguf.py",
        ]:
            if os.path.exists(path):
                convert_script = path
                break

        if convert_script is None:
            print("llama.cpp convert script not found. Installing...")
            run_cmd("cd /workspace && git clone --depth 1 https://github.com/ggerganov/llama.cpp.git 2>/dev/null || true")
            convert_script = "/workspace/llama.cpp/convert_hf_to_gguf.py"

        # Check requirements
        run_cmd("pip install sentencepiece protobuf --quiet 2>/dev/null || true")

        # Determine outtype
        outtype_map = {
            "q4_k_m": "q4_k_m",
            "q5_k_m": "q5_k_m",
            "q8_0": "q8_0",
            "f16": "f16",
        }
        outtype = outtype_map[args.quantization]

        cmd = (
            f"python {convert_script} "
            f"--outfile {gguf_path} "
            f"--outtype {outtype} "
            f"{merged_dir}"
        )
        run_cmd(cmd)

        print()
        print(f"GGUF model saved to: {gguf_path}")
        size_gb = os.path.getsize(gguf_path) / 1e9
        print(f"Size: {size_gb:.1f} GB")

    print()
    print("=" * 60)
    print("ALL DONE!")
    print("=" * 60)
    print(f"Merged HF model: {merged_dir}")
    print(f"GGUF model:      {gguf_path}")
    print()
    print("To download to local machine:")
    print(f"  scp -P 31384 root@ssh1.vast.ai:{gguf_path} ~/HiranModels/")

if __name__ == "__main__":
    main()
