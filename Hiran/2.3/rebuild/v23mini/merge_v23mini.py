#!/usr/bin/env python3
"""Layer-by-layer LoRA merge for Hiran v2.3-mini (low-RAM safe).

Reproduces the v2.3 merge know-how (docs/3.0.6/HIRAN_OVERVIEW.md §3.3):
PeftModel.merge_and_unload() needs ~2x model RAM; we instead stream
safetensors shards and apply  W += scale * (B @ A)  per tensor.

    python3 merge_v23mini.py \
        --base Qwen/Qwen3-8B \
        --adapter checkpoints/v23mini/final \
        --out merged/v23mini-hf

Then GGUF:  python3 llama.cpp/convert_hf_to_gguf.py merged/v23mini-hf \
            --outfile hiran-v2.3mini-f16.gguf
            llama-quantize hiran-v2.3mini-f16.gguf hiran-v2.3mini-Q5_K_M.gguf Q5_K_M
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="Qwen/Qwen3-8B")
    ap.add_argument("--adapter", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    import torch
    from huggingface_hub import snapshot_download
    from safetensors import safe_open
    from safetensors.torch import save_file

    adapter_dir = Path(args.adapter)
    cfg = json.loads((adapter_dir / "adapter_config.json").read_text())
    scale = cfg["lora_alpha"] / cfg["r"]
    if cfg.get("use_rslora"):
        # rslora uses alpha/sqrt(r) as the effective scale
        scale = cfg["lora_alpha"] / (cfg["r"] ** 0.5)
    print(f"[merge] scale={scale} (r={cfg['r']}, alpha={cfg['lora_alpha']}, "
          f"rslora={cfg.get('use_rslora')})")

    # load adapter A/B tensors
    ad = {}
    with safe_open(str(adapter_dir / "adapter_model.safetensors"), framework="pt") as f:
        for k in f.keys():
            ad[k] = f.get_tensor(k)
    print(f"[merge] {len(ad)} adapter tensors")

    base_dir = Path(snapshot_download(args.base, allow_patterns=[
        "*.safetensors", "*.json", "tokenizer*", "merges.txt", "vocab*"]))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    applied = 0
    for shard in sorted(base_dir.glob("*.safetensors")):
        tensors = {}
        with safe_open(str(shard), framework="pt") as f:
            names = list(f.keys())
            for name in names:
                tensors[name] = f.get_tensor(name)
        for name in list(tensors.keys()):
            prefix = f"base_model.model.{name}"
            a_key, b_key = f"{prefix}.lora_A.weight", f"{prefix}.lora_B.weight"
            if a_key in ad and b_key in ad:
                delta = (ad[b_key] @ ad[a_key]).to(tensors[name].dtype) * scale
                tensors[name] = tensors[name] + delta
                applied += 1
        save_file(tensors, str(out / shard.name),
                  metadata={"format": "pt"})
        print(f"[merge] {shard.name} done ({applied} lora tensors applied)")

    for aux in base_dir.iterdir():
        if aux.suffix in (".json", ".txt") or aux.name.startswith("tokenizer"):
            if aux.name != "model.safetensors.index.json" or True:
                shutil.copy2(aux, out / aux.name)
    print(f"[done] merged model → {out} ({applied} LoRA tensors applied)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
