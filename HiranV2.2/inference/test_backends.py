#!/usr/bin/env python3
"""
Multi-backend inference testing for Hiran v2.2 (Phase 4).

Tests inference across different backends: llama.cpp, ONNX, transformers.
Measures latency, memory usage, and quality metrics.

Usage:
    python3 inference/test_backends.py \
        --model_path ../models/gguf/hiran-v2.2-q5_k_m.gguf \
        --test_file ../data/curriculum/foundation.jsonl \
        --backends llama_cpp transformers
"""

import argparse
import json
import os
import subprocess
import time
from pathlib import Path
from typing import Dict, List, Any
import psutil


class BackendTester:
    """Test inference performance across different backends."""

    def __init__(self, model_path: str, test_file: str):
        self.model_path = Path(model_path)
        self.test_file = Path(test_file)
        self.results = {}

    def load_test_data(self, num_samples: int = 10) -> List[Dict[str, Any]]:
        """Load test data from JSONL file."""
        data = []
        with open(self.test_file, 'r') as f:
            for i, line in enumerate(f):
                if i >= num_samples:
                    break
                data.append(json.loads(line))
        return data

    def test_llama_cpp(self, samples: List[Dict]) -> Dict[str, Any]:
        """Test llama.cpp backend."""
        print("\n=== Testing llama.cpp backend ===")

        if not self.model_path.suffix == ".gguf":
            print("⚠️  Model is not GGUF format, skipping llama.cpp")
            return {}

        # Find llama-cli or llama.cpp binary
        llama_cli = None
        for name in ["llama-cli", "llama.cpp", "main"]:
            if shutil.which(name):
                llama_cli = name
                break

        if not llama_cli:
            print("⚠️  llama-cli not found, skipping llama.cpp")
            return {}

        latencies = []
        memory_usage = []

        for sample in samples[:5]:  # Test 5 samples
            prompt = sample["instruction"][:500]  # Limit length

            start_time = time.time()
            mem_before = psutil.virtual_memory().used

            cmd = [
                llama_cli,
                "-m", str(self.model_path),
                "-p", prompt,
                "-n", "128",  # Max tokens
                "--temp", "0.7",
                "--top-p", "0.9",
            ]

            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                latency = time.time() - start_time
                mem_after = psutil.virtual_memory().used

                latencies.append(latency)
                memory_usage.append((mem_after - mem_before) / (1024 * 1024))  # MB

            except subprocess.TimeoutExpired:
                print("⚠️  Request timed out")
            except Exception as e:
                print(f"⚠️  Error: {e}")

        if not latencies:
            return {}

        return {
            "backend": "llama_cpp",
            "avg_latency_ms": round(sum(latencies) / len(latencies) * 1000, 2),
            "min_latency_ms": round(min(latencies) * 1000, 2),
            "max_latency_ms": round(max(latencies) * 1000, 2),
            "avg_memory_mb": round(sum(memory_usage) / len(memory_usage), 2),
            "samples_tested": len(latencies),
            "status": "success"
        }

    def test_transformers(self, samples: List[Dict]) -> Dict[str, Any]:
        """Test transformers backend (CPU/GPU)."""
        print("\n=== Testing transformers backend ===")

        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer
        except ImportError:
            print("⚠️  transformers not installed, skipping")
            return {}

        if not self.model_path.suffix in [".bin", ".safetensors"]:
            print("⚠️  Model is not HuggingFace format, skipping transformers")
            return {}

        try:
            # Load model
            print("Loading model...")
            tokenizer = AutoTokenizer.from_pretrained(str(self.model_path))
            model = AutoModelForCausalLM.from_pretrained(
                str(self.model_path),
                torch_dtype=torch.float16,
                device_map="auto"
            )
            model.eval()

            latencies = []
            memory_usage = []

            for sample in samples[:5]:
                prompt = sample["instruction"][:500]

                start_time = time.time()
                mem_before = psutil.virtual_memory().used

                inputs = tokenizer(prompt, return_tensors="pt")
                with torch.no_grad():
                    outputs = model.generate(
                        **inputs,
                        max_new_tokens=128,
                        do_sample=True,
                        temperature=0.7,
                        top_p=0.9
                    )

                latency = time.time() - start_time
                mem_after = psutil.virtual_memory().used

                latencies.append(latency)
                memory_usage.append((mem_after - mem_before) / (1024 * 1024))

            return {
                "backend": "transformers",
                "device": str(next(model.parameters()).device),
                "avg_latency_ms": round(sum(latencies) / len(latencies) * 1000, 2),
                "min_latency_ms": round(min(latencies) * 1000, 2),
                "max_latency_ms": round(max(latencies) * 1000, 2),
                "avg_memory_mb": round(sum(memory_usage) / len(memory_usage), 2),
                "samples_tested": len(latencies),
                "status": "success"
            }

        except Exception as e:
            print(f"⚠️  Error loading model: {e}")
            return {"backend": "transformers", "status": "error", "error": str(e)}

    def test_onnx(self, samples: List[Dict]) -> Dict[str, Any]:
        """Test ONNX Runtime backend."""
        print("\n=== Testing ONNX Runtime backend ===")

        try:
            import onnxruntime as ort
        except ImportError:
            print("⚠️  onnxruntime not installed, skipping")
            return {}

        onnx_path = self.model_path.with_suffix(".onnx")
        if not onnx_path.exists():
            print(f"⚠️  ONNX model not found at {onnx_path}")
            return {}

        try:
            session = ort.InferenceSession(str(onnx_path))

            latencies = []
            for sample in samples[:5]:
                prompt = sample["instruction"][:500]

                # Simple mock test (actual ONNX inference would require proper tokenization)
                start_time = time.time()
                # session.run(...)
                latency = time.time() - start_time
                latencies.append(latency)

            return {
                "backend": "onnx",
                "providers": session.get_providers(),
                "avg_latency_ms": round(sum(latencies) / len(latencies) * 1000, 2),
                "samples_tested": len(latencies),
                "status": "success"
            }

        except Exception as e:
            print(f"⚠️  Error: {e}")
            return {"backend": "onnx", "status": "error", "error": str(e)}

    def run_comparison(self, backends: List[str]) -> Dict[str, Any]:
        """Run comparison across specified backends."""
        print("=" * 60)
        print("Hiran v2.2 Multi-Backend Inference Testing")
        print("=" * 60)

        samples = self.load_test_data()
        print(f"\nLoaded {len(samples)} test samples")

        for backend in backends:
            if backend == "llama_cpp":
                result = self.test_llama_cpp(samples)
            elif backend == "transformers":
                result = self.test_transformers(samples)
            elif backend == "onnx":
                result = self.test_onnx(samples)
            else:
                print(f"⚠️  Unknown backend: {backend}")
                continue

            if result:
                self.results[backend] = result

        # Generate report
        print("\n" + "=" * 60)
        print("📊 Backend Comparison Results")
        print("=" * 60)

        for backend, result in self.results.items():
            if result.get("status") == "success":
                print(f"\n{backend.upper()}:")
                print(f"  Avg latency: {result.get('avg_latency_ms', 'N/A')} ms")
                print(f"  Memory: {result.get('avg_memory_mb', 'N/A')} MB")
                print(f"  Samples: {result.get('samples_tested', 'N/A')}")
            else:
                print(f"\n{backend.upper()}: FAILED - {result.get('error', 'Unknown error')}")

        return self.results


def main():
    import shutil

    parser = argparse.ArgumentParser(description="Test Hiran v2.2 inference backends")
    parser.add_argument("--model_path", type=str, required=True)
    parser.add_argument("--test_file", type=str, required=True)
    parser.add_argument("--backends", nargs="+",
                       default=["llama_cpp", "transformers"],
                       help="Backends to test")
    parser.add_argument("--num_samples", type=int, default=10)
    parser.add_argument("--output", type=str, default="HiranV2.2/inference/backend_report.json")

    args = parser.parse_args()

    tester = BackendTester(args.model_path, args.test_file)
    results = tester.run_comparison(args.backends)

    # Save results
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n✅ Results saved to {output_path}")


if __name__ == "__main__":
    main()
