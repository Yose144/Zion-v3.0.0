#!/usr/bin/env python3
"""
Simple GGUF quantization script for Hiran v2.2.

Converts HuggingFace model to GGUF and quantizes to multiple formats.
Requires llama.cpp to be installed.

Usage:
    python3 quantization/quantize_gguf.py \
        --model_path ../checkpoints/foundation/final \
        --output_dir ../models/gguf
"""

import argparse
import json
import os
import subprocess
from pathlib import Path
from typing import List, Dict


QUANTIZATION_METHODS = [
    ("f16", "Full precision (16GB)"),
    ("q8_0", "8-bit quantization (8.5GB)"),
    ("q5_k_m", "Balanced 5-bit (5.4GB) - Default"),
    ("q4_k_m", "Fast 4-bit (4.5GB)"),
    ("q4_0", "Legacy 4-bit (4.2GB)"),
]


def find_llama_tools() -> Dict[str, str]:
    """Find llama.cpp tools."""
    tools = {}

    # Check for convert script
    for name in ["convert_hf_to_gguf.py", "convert.py"]:
        if Path(name).exists():
            tools["convert"] = name
            break

    # Check common paths
    if "convert" not in tools:
        for path in [
            "/opt/llama.cpp/convert_hf_to_gguf.py",
            "~/llama.cpp/convert_hf_to_gguf.py",
            "llama.cpp/convert_hf_to_gguf.py",
        ]:
            expanded = Path(path).expanduser()
            if expanded.exists():
                tools["convert"] = str(expanded)
                break

    # Check for quantize binary
    for name in ["llama-quantize", "llama-cli"]:
        if shutil.which(name):
            tools["quantize"] = name
            break

    return tools


def convert_to_gguf(model_path: str, output_path: str) -> str:
    """Convert HuggingFace model to GGUF format."""
    print(f"Converting {model_path} to GGUF...")

    tools = find_llama_tools()
    if "convert" not in tools:
        raise RuntimeError("llama.cpp convert script not found")

    cmd = [
        "python3",
        tools["convert"],
        model_path,
        "--outfile", output_path,
        "--outtype", "f16"
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Conversion failed: {result.stderr}")

    print(f"✅ Converted to {output_path}")
    return output_path


def quantize_model(
    input_gguf: str,
    output_gguf: str,
    method: str
) -> str:
    """Quantize GGUF model."""
    print(f"Quantizing to {method}...")

    tools = find_llama_tools()
    if "quantize" not in tools:
        raise RuntimeError("llama.cpp quantize tool not found")

    cmd = [
        tools["quantize"],
        input_gguf,
        output_gguf,
        method
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Quantization failed: {result.stderr}")

    print(f"✅ Quantized to {output_gguf}")
    return output_gguf


def main():
    import shutil

    parser = argparse.ArgumentParser(description="Quantize Hiran v2.2 model to GGUF")
    parser.add_argument("--model_path", type=str, required=True)
    parser.add_argument("--output_dir", type=str, default="HiranV2.2/models/gguf")
    parser.add_argument("--methods", nargs="+",
                       default=["f16", "q8_0", "q5_k_m", "q4_k_m"],
                       help="Quantization methods")
    parser.add_argument("--base_name", type=str, default="hiran-v2.2")

    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Convert to F16 GGUF
    f16_path = output_dir / f"{args.base_name}-f16.gguf"
    convert_to_gguf(args.model_path, str(f16_path))

    # Quantize to other formats
    quantized_files = {"f16": str(f16_path)}

    for method in args.methods:
        if method == "f16":
            continue

        output_path = output_dir / f"{args.base_name}-{method}.gguf"
        try:
            quantize_model(str(f16_path), str(output_path), method)
            quantized_files[method] = str(output_path)
        except RuntimeError as e:
            print(f"⚠️  Failed to quantize to {method}: {e}")

    # Generate metadata
    metadata = {
        "base_model": args.model_path,
        "base_name": args.base_name,
        "quantization_date": str(Path.cwd()),
        "files": {}
    }

    for method, path in quantized_files.items():
        size_mb = Path(path).stat().st_size / (1024 * 1024)
        desc = next(d for m, d in QUANTIZATION_METHODS if m == method)
        metadata["files"][method] = {
            "path": path,
            "size_mb": round(size_mb, 2),
            "description": desc
        }

    metadata_path = output_dir / "quantization_metadata.json"
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\n✅ Quantization completed!")
    print(f"📊 Metadata: {metadata_path}")
    print(f"\nGenerated files:")
    for method, info in metadata["files"].items():
        print(f"  {method}: {info['size_mb']} MB - {info['description']}")


if __name__ == "__main__":
    main()
