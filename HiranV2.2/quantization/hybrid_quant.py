#!/usr/bin/env python3
"""
Hybrid quantization pipeline for Hiran v2.2 (Phase 3).

Converts trained LoRA adapters to GGUF format with multiple quantization levels.
Uses llama.cpp for quantization and supports various quantization types.

Usage:
    python3 quantization/hybrid_quant.py \
        --base_model unsloth/Meta-Llama-3.1-8B-Instruct \
        --adapter_path ../checkpoints/foundation/final \
        --output_dir ../models/quantized
"""

import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import List, Dict


class QuantizationPipeline:
    """Hybrid quantization pipeline for Hiran v2.2."""

    QUANTIZATIONS = [
        {"name": "F16", "method": "f16", "description": "Full precision (16GB)"},
        {"name": "Q8_0", "method": "q8_0", "description": "8-bit quantization (8.5GB)"},
        {"name": "Q5_K_M", "method": "q5_k_m", "description": "Balanced 5-bit (5.4GB)"},
        {"name": "Q4_K_M", "method": "q4_k_m", "description": "Fast 4-bit (4.5GB)"},
    ]

    def __init__(
        self,
        base_model: str,
        adapter_path: str,
        output_dir: str,
        llama_cpp_path: str = None
    ):
        self.base_model = base_model
        self.adapter_path = Path(adapter_path)
        self.output_dir = Path(output_dir)
        self.llama_cpp_path = llama_cpp_path or self._find_llama_cpp()

        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _find_llama_cpp(self) -> str:
        """Find llama.cpp executable or download it."""
        # Check if llama.cpp is installed
        for name in ["llama-cli", "llama-quantize", "llama-cli"]:
            if shutil.which(name):
                return name

        # Try common installation paths
        for path in [
            "/usr/local/bin/llama-cli",
            "/opt/llama.cpp/llama-cli",
            "~/llama.cpp/llama-cli",
        ]:
            expanded = Path(path).expanduser()
            if expanded.exists():
                return str(expanded)

        return None

    def merge_adapter(self) -> Path:
        """Merge LoRA adapter with base model."""
        print(f"Merging adapter from {self.adapter_path} with {self.base_model}")

        merged_dir = self.output_dir / "merged"
        merged_dir.mkdir(exist_ok=True)

        cmd = [
            "python3", "-c",
            f"""
import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

base = AutoModelForCausalLM.from_pretrained(
    "{self.base_model}",
    torch_dtype=torch.float16,
    device_map="auto"
)
model = PeftModel.from_pretrained(base, "{self.adapter_path}")
merged = model.merge_and_unload()
merged.save_pretrained("{merged_dir}")

tokenizer = AutoTokenizer.from_pretrained("{self.base_model}")
tokenizer.save_pretrained("{merged_dir}")
print("Merged model saved to {merged_dir}")
"""
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Merge failed: {result.stderr}")

        print(f"✅ Merged model saved to {merged_dir}")
        return merged_dir

    def convert_to_gguf(self, merged_path: Path) -> Path:
        """Convert merged model to GGUF format."""
        print(f"Converting {merged_path} to GGUF")

        gguf_dir = self.output_dir / "gguf"
        gguf_dir.mkdir(exist_ok=True)

        gguf_path = gguf_dir / "hiran-v2.2-f16.gguf"

        # Use llama.cpp convert script
        convert_script = self._find_convert_script()
        if not convert_script:
            raise RuntimeError("llama.cpp convert script not found")

        cmd = [
            "python3",
            convert_script,
            str(merged_path),
            "--outfile", str(gguf_path),
            "--outtype", "f16"
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"GGUF conversion failed: {result.stderr}")

        print(f"✅ GGUF model saved to {gguf_path}")
        return gguf_path

    def _find_convert_script(self) -> str:
        """Find llama.cpp convert script."""
        for path in [
            "convert_hf_to_gguf.py",
            "convert.py",
            "/opt/llama.cpp/convert_hf_to_gguf.py",
            "~/llama.cpp/convert_hf_to_gguf.py",
        ]:
            expanded = Path(path).expanduser()
            if expanded.exists():
                return str(expanded)
        return None

    def quantize_gguf(self, f16_gguf: Path) -> Dict[str, Path]:
        """Quantize GGUF model to multiple formats."""
        quantized_paths = {}

        for quant in self.QUANTIZATIONS:
            if quant["method"] == "f16":
                continue  # F16 is already the base

            print(f"Quantizing to {quant['name']} ({quant['method']})")

            output_path = self.output_dir / "gguf" / f"hiran-v2.2-{quant['method']}.gguf"

            cmd = [
                self.llama_cpp_path,
                str(f16_gguf),
                str(output_path),
                quant["method"]
            ]

            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"⚠️  Quantization to {quant['name']} failed: {result.stderr}")
                continue

            quantized_paths[quant["name"]] = output_path
            print(f"✅ {quant['name']} saved to {output_path}")

        return quantized_paths

    def generate_metadata(self, quantized_paths: Dict[str, Path]) -> Path:
        """Generate metadata JSON for quantized models."""
        metadata = {
            "base_model": self.base_model,
            "adapter_path": str(self.adapter_path),
            "quantization_date": str(Path.ctime(Path.cwd())),
            "models": []
        }

        for name, path in quantized_paths.items():
            size_mb = path.stat().st_size / (1024 * 1024)
            metadata["models"].append({
                "name": f"hiran-v2.2-{name.lower()}",
                "quantization": name,
                "path": str(path),
                "size_mb": round(size_mb, 2),
                "description": next(q["description"] for q in self.QUANTIZATIONS if q["name"] == name)
            })

        # Add F16 info
        f16_path = self.output_dir / "gguf" / "hiran-v2.2-f16.gguf"
        if f16_path.exists():
            size_mb = f16_path.stat().st_size / (1024 * 1024)
            metadata["models"].append({
                "name": "hiran-v2.2-f16",
                "quantization": "F16",
                "path": str(f16_path),
                "size_mb": round(size_mb, 2),
                "description": "Full precision (16GB)"
            })

        metadata_path = self.output_dir / "quantization_metadata.json"
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)

        print(f"✅ Metadata saved to {metadata_path}")
        return metadata_path

    def run(self) -> Dict[str, Path]:
        """Run full quantization pipeline."""
        print("=" * 60)
        print("Hiran v2.2 Quantization Pipeline")
        print("=" * 60)

        # Step 1: Merge adapter
        merged_path = self.merge_adapter()

        # Step 2: Convert to GGUF
        f16_gguf = self.convert_to_gguf(merged_path)

        # Step 3: Quantize to multiple formats
        quantized_paths = self.quantize_gguf(f16_gguf)

        # Step 4: Generate metadata
        self.generate_metadata(quantized_paths)

        print("\n" + "=" * 60)
        print("✅ Quantization pipeline completed!")
        print("=" * 60)

        return quantized_paths


def main():
    parser = argparse.ArgumentParser(description="Hiran v2.2 hybrid quantization")
    parser.add_argument("--base_model", type=str, required=True)
    parser.add_argument("--adapter_path", type=str, required=True)
    parser.add_argument("--output_dir", type=str, default="HiranV2.2/models/quantized")
    parser.add_argument("--llama_cpp_path", type=str, default=None)
    parser.add_argument("--skip_merge", action="store_true", help="Skip adapter merging")
    parser.add_argument("--skip_convert", action="store_true", help="Skip GGUF conversion")

    args = parser.parse_args()

    pipeline = QuantizationPipeline(
        base_model=args.base_model,
        adapter_path=args.adapter_path,
        output_dir=args.output_dir,
        llama_cpp_path=args.llama_cpp_path
    )

    pipeline.run()


if __name__ == "__main__":
    main()
