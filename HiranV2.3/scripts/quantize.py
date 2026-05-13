#!/usr/bin/env python3
"""
Hiran v2.3 Quantization Pipeline
=================================
Converts trained checkpoints to production-ready formats:
- GGUF (Q4_K_M, Q5_K_M, Q8_0) via llama.cpp
- ONNX via optimum
- INT8 / INT4 via bitsandbytes

Usage:
    python scripts/quantize.py \
        --checkpoint checkpoints/final \
        --output_dir HiranV2.3/models \
        --formats gguf,onnx

    # GGUF only (fastest)
    python scripts/quantize.py --checkpoint checkpoints/final --formats gguf

Requires:
    - llama.cpp repo with convert script (set LLAMA_CPP_DIR)
    - optimum[onnxruntime] for ONNX export
    - bitsandbytes for INT8
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

LLAMA_CPP_DIR = Path(os.environ.get("LLAMA_CPP_DIR", "llama.cpp"))

QUANT_LEVELS = {
    "q4_k_m": {"method": "q4_k_m", "target_size_mb": 4500, "vram_gb": 6},
    "q5_k_m": {"method": "q5_k_m", "target_size_mb": 5400, "vram_gb": 8},
    "q8_0": {"method": "q8_0", "target_size_mb": 8500, "vram_gb": 12},
    "f16": {"method": "f16", "target_size_mb": 16000, "vram_gb": 20},
}

# ---------------------------------------------------------------------------
# GGUF
# ---------------------------------------------------------------------------

def convert_to_gguf(
    checkpoint_dir: Path,
    output_dir: Path,
    base_model_name: str,
) -> list[Path]:
    """Merge adapter + base, export to FP16, then quantize."""
    output_dir.mkdir(parents=True, exist_ok=True)
    results: list[Path] = []

    f16_path = output_dir / f"{base_model_name}-f16.gguf"

    # Step 1: Merge adapter into base and export to FP16 GGUF
    convert_hf = LLAMA_CPP_DIR / "convert-hf-to-gguf.py"
    if not convert_hf.exists():
        print(f"WARNING: {convert_hf} not found. Skipping GGUF.")
        return results

    print(f"[GGUF] Exporting FP16 to {f16_path}...")
    subprocess.run(
        [sys.executable, str(convert_hf), str(checkpoint_dir), "--outfile", str(f16_path)],
        check=True,
    )
    results.append(f16_path)

    # Step 2: Quantize
    quantize_bin = LLAMA_CPP_DIR / "build" / "bin" / "quantize"
    if not quantize_bin.exists():
        quantize_bin = LLAMA_CPP_DIR / "quantize"

    if quantize_bin.exists():
        for level_name, cfg in QUANT_LEVELS.items():
            if level_name == "f16":
                continue
            out_path = output_dir / f"{base_model_name}-{level_name}.gguf"
            print(f"[GGUF] Quantizing {level_name} -> {out_path}...")
            subprocess.run(
                [str(quantize_bin), str(f16_path), str(out_path), cfg["method"]],
                check=True,
            )
            results.append(out_path)
    else:
        print(f"WARNING: quantize binary not found at {quantize_bin}")

    return results


# ---------------------------------------------------------------------------
# ONNX
# ---------------------------------------------------------------------------

def convert_to_onnx(
    checkpoint_dir: Path,
    output_dir: Path,
    base_model_name: str,
) -> Path | None:
    try:
        from optimum.exporters.onnx import main_export
    except ImportError:
        print("[ONNX] optimum not installed. Run: pip install optimum[onnxruntime]")
        return None

    onnx_dir = output_dir / f"{base_model_name}-onnx"
    print(f"[ONNX] Exporting to {onnx_dir}...")

    main_export(
        model_name_or_path=str(checkpoint_dir),
        output=str(onnx_dir),
        task="text-generation",
        fp16=True,
    )
    return onnx_dir


# ---------------------------------------------------------------------------
# INT8 / INT4 (bitsandbytes)
# ---------------------------------------------------------------------------

def convert_to_bnb(
    checkpoint_dir: Path,
    output_dir: Path,
    base_model_name: str,
    quant_type: str = "int8",
) -> Path | None:
    try:
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    except ImportError:
        print(f"[BNB] transformers/bitsandbytes not installed.")
        return None

    out_dir = output_dir / f"{base_model_name}-{quant_type}"
    out_dir.mkdir(parents=True, exist_ok=True)

    bnb_config = BitsAndBytesConfig(
        load_in_8bit=(quant_type == "int8"),
        load_in_4bit=(quant_type == "int4"),
        bnb_4bit_compute_dtype="bfloat16" if quant_type == "int4" else None,
    )

    print(f"[BNB] Loading model with {quant_type} quantization...")
    model = AutoModelForCausalLM.from_pretrained(
        str(checkpoint_dir),
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype="auto",
    )
    tokenizer = AutoTokenizer.from_pretrained(str(checkpoint_dir))

    print(f"[BNB] Saving to {out_dir}...")
    model.save_pretrained(str(out_dir))
    tokenizer.save_pretrained(str(out_dir))
    return out_dir


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Hiran v2.3 Quantization")
    parser.add_argument("--checkpoint", required=True, help="Path to merged checkpoint or adapter")
    parser.add_argument("--output_dir", default="HiranV2.3/models")
    parser.add_argument("--formats", default="gguf", help="Comma-separated: gguf,onnx,int8,int4")
    parser.add_argument("--base_model_name", default="hiran-v2.3")
    parser.add_argument("--keep_f16", action="store_true", help="Keep intermediate F16 GGUF")
    args = parser.parse_args()

    checkpoint = Path(args.checkpoint)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    formats = [f.strip().lower() for f in args.formats.split(",")]

    manifest = {"checkpoint": str(checkpoint), "formats": {}}

    if "gguf" in formats:
        paths = convert_to_gguf(checkpoint, output_dir, args.base_model_name)
        manifest["formats"]["gguf"] = [str(p) for p in paths]

    if "onnx" in formats:
        path = convert_to_onnx(checkpoint, output_dir, args.base_model_name)
        if path:
            manifest["formats"]["onnx"] = str(path)

    if "int8" in formats:
        path = convert_to_bnb(checkpoint, output_dir, args.base_model_name, "int8")
        if path:
            manifest["formats"]["int8"] = str(path)

    if "int4" in formats:
        path = convert_to_bnb(checkpoint, output_dir, args.base_model_name, "int4")
        if path:
            manifest["formats"]["int4"] = str(path)

    manifest_path = output_dir / "quantization_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nManifest saved to {manifest_path}")
    print(json.dumps(manifest, indent=2))

    # Clean up intermediate F16 if requested
    if not args.keep_f16 and "gguf" in formats:
        f16_path = output_dir / f"{args.base_model_name}-f16.gguf"
        if f16_path.exists():
            f16_path.unlink()
            print(f"Removed intermediate {f16_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
