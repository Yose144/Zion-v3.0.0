#!/usr/bin/env python3
"""
Hiran v2.2 inference server — OpenAI-compatible API on port 8002.

Backendy:
  1. ollama:<model>   — proxy na lokální Ollama server (doporučeno pro AMD GPU)
  2. *.gguf           — přímé načtení přes llama-cpp-python
  3. adresář          — HuggingFace transformers (vyžaduje ~15 GB VRAM)

Použití:
    # Ollama proxy (AMD GPU, Windows):
    python serve.py --model_path ollama:hiran-v2.2 --port 8002

    # llama.cpp přímý GGUF:
    python serve.py --model_path ../models/gguf/hiran-v2.2-q4_k_m.gguf --port 8002

    # HuggingFace:
    python serve.py --model_path ../models/hiran-v2.2-merged --port 8002
"""

import argparse
import hashlib
import json
import os
import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict, Any, Optional
from flask import Flask, request, jsonify

app = Flask(__name__)

# Global model state
model_state: Dict[str, Any] = {}
model = None
tokenizer = None

# Runtime stats
_stats: Dict[str, Any] = {
    "started_at": 0.0,
    "request_count": 0,
    "error_count": 0,
    "total_latency_ms": 0.0,
}


def load_model(model_path: str, ollama_base: str = "http://localhost:11434"):
    """Load model based on format / path prefix."""

    # ── llama-server proxy backend (llama.cpp native server) ─────────────────
    # model_path = "llamaserver:<base_url>" e.g. "llamaserver:http://127.0.0.1:8002"
    # Used when llama-server.exe is already running (started by ps1 script).
    if model_path.startswith("llamaserver:"):
        base_url = model_path[len("llamaserver:"):]
        try:
            req = urllib.request.urlopen(f"{base_url}/health", timeout=5)
            req.close()
        except Exception as e:
            raise RuntimeError(
                f"llama-server nedosažitelný na {base_url}: {e}\n"
                "Spusť scripts\\start-hiran-inference.ps1"
            )
        print(f"✅ llama-server backend: {base_url}")
        return {"backend": "llamaserver", "base_url": base_url, "model_name": "hiran-v2.2"}

    # ── LM Studio OpenAI-compatible backend ───────────────────────────────────
    if model_path.startswith("lmstudio:") or model_path.startswith("lm-studio:"):
        # LM Studio exposes OpenAI-compatible API on port 1234
        model_name = model_path.split(":", 1)[1]
        lmstudio_base = os.environ.get("LMSTUDIO_BASE_URL", "http://localhost:1234")
        try:
            req = urllib.request.urlopen(f"{lmstudio_base}/v1/models", timeout=5)
            raw = json.loads(req.read())
            req.close()
            available = [m["id"] for m in raw.get("data", [])]
            if not available:
                raise RuntimeError("LM Studio server běží, ale žádný model není načten. Načti model v LM Studio GUI.")
            # Use first available model if "hiran" not found
            selected = next((m for m in available if "hiran" in m.lower()), available[0])
            print(f"✅ LM Studio backend: {lmstudio_base}, model: {selected}")
            return {"backend": "lmstudio", "model_name": selected, "lmstudio_base": lmstudio_base}
        except urllib.error.URLError as e:
            raise RuntimeError(
                f"LM Studio server nedosažitelný na {lmstudio_base}: {e}\n"
                "Otevři LM Studio → Developer → Start Server (port 1234)"
            )

    # ── Ollama proxy backend ───────────────────────────────────────────────────
    if model_path.startswith("ollama:"):
        model_name = model_path[len("ollama:"):]
        # Verify Ollama is reachable
        try:
            req = urllib.request.urlopen(f"{ollama_base}/api/tags", timeout=5)
            req.close()
        except Exception as e:
            raise RuntimeError(
                f"Ollama server nedosažitelný na {ollama_base}: {e}\n"
                "Spusť 'ollama serve' nebo použij start_hiran_ollama.bat"
            )
        print(f"✅ Ollama backend: {ollama_base}, model: {model_name}")
        return {"backend": "ollama", "model_name": model_name, "ollama_base": ollama_base}

    path = Path(model_path)

    if path.suffix == ".gguf":
        # ── llama-cpp-python backend ───────────────────────────────────────────
        try:
            from llama_cpp import Llama
            model = Llama(model_path=str(path), n_ctx=4096, n_gpu_layers=-1, verbose=False)
            return {"backend": "llama_cpp", "model": model}
        except ImportError:
            raise RuntimeError(
                "llama-cpp-python není nainstalovaný.\n"
                "Nainstaluj: pip install llama-cpp-python\n"
                "Pro AMD GPU (Vulkan): pip install llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/vulkan"
            )
    else:
        # ── HuggingFace transformers backend ──────────────────────────────────
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer
            import torch

            tokenizer = AutoTokenizer.from_pretrained(str(path))
            model = AutoModelForCausalLM.from_pretrained(
                str(path),
                torch_dtype=torch.float16,
                device_map="auto"
            )
            model.eval()
            return {"backend": "transformers", "model": model, "tokenizer": tokenizer}
        except ImportError:
            raise RuntimeError("transformers není nainstalovaný: pip install transformers torch")


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    backend = model_state.get("backend", "none")
    loaded = bool(model_state)
    extra = {}
    if backend == "ollama":
        extra["ollama_model"] = model_state.get("model_name")
        extra["ollama_base"] = model_state.get("ollama_base")
    return jsonify({
        "status": "ok",
        "model_loaded": loaded,
        "backend": backend,
        "model": "hiran-v2.2",
        **extra,
    })


@app.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    """OpenAI-compatible chat completions endpoint."""
    if not model_state:
        return jsonify({"error": "Model not loaded"}), 500

    data = request.json or {}
    messages = data.get("messages", [])
    max_tokens = data.get("max_tokens", 512)
    temperature = data.get("temperature", 0.7)
    top_p = data.get("top_p", 0.9)

    start_time = time.time()
    backend = model_state.get("backend", "")

    try:
        # ── llama-server proxy (OpenAI-compatible, llama.cpp native) ─────────
        if backend == "llamaserver":
            base_url = model_state["base_url"]
            payload = json.dumps({
                "model": "hiran-v2.2",
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "top_p": top_p,
                "stream": False,
            }).encode()
            req = urllib.request.Request(
                f"{base_url}/v1/chat/completions",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read())
            response_text = result["choices"][0]["message"]["content"]

        # ── LM Studio proxy (OpenAI-compatible, port 1234) ────────────────────
        elif backend == "lmstudio":
            lmstudio_base = model_state["lmstudio_base"]
            model_name = model_state["model_name"]
            payload = json.dumps({
                "model": model_name,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "top_p": top_p,
                "stream": False,
            }).encode()
            req = urllib.request.Request(
                f"{lmstudio_base}/v1/chat/completions",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read())
            response_text = result["choices"][0]["message"]["content"]

        # ── Ollama proxy ──────────────────────────────────────────────────────
        elif backend == "ollama":
            ollama_base = model_state["ollama_base"]
            model_name = model_state["model_name"]
            payload = json.dumps({
                "model": model_name,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "top_p": top_p,
                    "num_predict": max_tokens,
                },
            }).encode()
            req = urllib.request.Request(
                f"{ollama_base}/api/chat",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read())
            response_text = result.get("message", {}).get("content", "")

        # ── llama.cpp přímý ──────────────────────────────────────────────────
        elif backend == "llama_cpp":
            parts = []
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "system":
                    parts.append("[INST] <<SYS>>\n" + content + "\n<</SYS>>\n\n")
                elif role == "user":
                    parts.append(content + " [/INST] ")
                elif role == "assistant":
                    parts.append(content + " [INST] ")
            prompt = "".join(parts)
            output = model_state["model"](
                prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                stop=["[INST]", "[/INST]"],
            )
            response_text = output["choices"][0]["text"].strip()

        # ── HuggingFace transformers ──────────────────────────────────────────
        elif backend == "transformers":
            import torch
            user_content = next(
                (m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), ""
            )
            prompt = "### Instruction:\n" + user_content + "\n\n### Response:\n"
            inputs = model_state["tokenizer"](prompt, return_tensors="pt")
            with torch.no_grad():
                outputs = model_state["model"].generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    do_sample=True,
                )
            raw = model_state["tokenizer"].decode(outputs[0], skip_special_tokens=True)
            response_text = raw.split("### Response:\n")[-1].strip()

        else:
            return jsonify({"error": f"Neznámý backend: {backend}"}), 500

        latency = time.time() - start_time
        return jsonify({
            "id": "chatcmpl-" + str(int(time.time() * 1000)),
            "object": "chat.completion",
            "created": int(time.time()),
            "model": "hiran-v2.2",
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": response_text},
                "finish_reason": "stop",
            }],
            "usage": {
                "prompt_tokens": sum(len(m.get("content", "").split()) for m in messages),
                "completion_tokens": len(response_text.split()),
                "total_tokens": sum(len(m.get("content", "").split()) for m in messages) + len(response_text.split()),
            },
            "latency_ms": round(latency * 1000, 2),
        })

    except Exception as e:
        _stats["error_count"] += 1
        return jsonify({"error": str(e)}), 500

    finally:
        _stats["request_count"] += 1
        _stats["total_latency_ms"] += round((time.time() - start_time) * 1000, 2)


@app.route("/v1/models", methods=["GET"])
def list_models():
    """List available models."""
    return jsonify({
        "object": "list",
        "data": [{
            "id": "hiran-v2.2",
            "object": "model",
            "created": int(time.time()),
            "owned_by": "zion"
        }]
    })


@app.route("/status", methods=["GET"])
def status():
    """Detailed inference service status (used by hiran_inference.rs client)."""
    backend = model_state.get("backend", "none")
    uptime = time.time() - _stats["started_at"] if _stats["started_at"] else 0.0
    req_count = _stats["request_count"]
    avg_latency = (
        _stats["total_latency_ms"] / req_count if req_count > 0 else 0.0
    )

    # Try to get GPU info (optional — only if pynvml or subprocess available)
    gpu_info: Dict[str, Any] = {}
    try:
        import subprocess
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=utilization.gpu,memory.used,memory.total",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=2
        )
        if result.returncode == 0:
            parts = result.stdout.strip().split(", ")
            if len(parts) >= 3:
                gpu_info = {
                    "utilization_pct": int(parts[0]),
                    "memory_used_mb": int(parts[1]),
                    "memory_total_mb": int(parts[2]),
                }
    except Exception:
        pass

    extra: Dict[str, Any] = {}
    if backend == "ollama":
        extra["ollama_model"] = model_state.get("model_name")
        extra["ollama_base"] = model_state.get("ollama_base")
    elif backend == "lmstudio":
        extra["lmstudio_model"] = model_state.get("model_name")
        extra["lmstudio_base"] = model_state.get("lmstudio_base")

    return jsonify({
        "status": "ok" if model_state else "no_model",
        "model": "hiran-v2.2",
        "backend": backend,
        "model_loaded": bool(model_state),
        "uptime_secs": round(uptime, 1),
        "requests_total": req_count,
        "errors_total": _stats["error_count"],
        "avg_latency_ms": round(avg_latency, 2),
        "gpu": gpu_info,
        **extra,
    })


@app.route("/v1/embeddings", methods=["POST"])
def embeddings():
    """Text embeddings endpoint — used by hiran_inference.rs RAG pipeline.

    Returns deterministic mock embeddings (dim=512) when no embedding model
    is loaded.  For production, set HIRAN_EMBEDDING_MODEL env var to a
    sentence-transformers model name and install the package.
    """
    data = request.json or {}
    input_texts = data.get("input", [])
    if isinstance(input_texts, str):
        input_texts = [input_texts]

    model_name = data.get("model", "hiran-v2.2-embed")
    dim = 512

    # Try real sentence-transformers if available
    embedding_model_name = os.environ.get("HIRAN_EMBEDDING_MODEL", "")
    if embedding_model_name:
        try:
            from sentence_transformers import SentenceTransformer
            _embed_model = SentenceTransformer(embedding_model_name)
            vecs = _embed_model.encode(input_texts).tolist()
            embeddings_data = [
                {"object": "embedding", "index": i, "embedding": v}
                for i, v in enumerate(vecs)
            ]
            return jsonify({
                "object": "list",
                "data": embeddings_data,
                "model": embedding_model_name,
                "usage": {
                    "prompt_tokens": sum(len(t.split()) for t in input_texts),
                    "total_tokens": sum(len(t.split()) for t in input_texts),
                },
            })
        except Exception:
            pass

    # Deterministic mock embeddings — hash-based, consistent across calls
    embeddings_data = []
    for i, text in enumerate(input_texts):
        h = hashlib.sha256(text.encode()).digest()
        # Expand to dim floats in [-1, 1] by cycling through hash bytes
        vec = []
        for j in range(dim):
            byte_val = h[j % len(h)]
            vec.append((byte_val / 127.5) - 1.0)
        # L2-normalise
        norm = sum(x * x for x in vec) ** 0.5 or 1.0
        vec = [round(x / norm, 6) for x in vec]
        embeddings_data.append({"object": "embedding", "index": i, "embedding": vec})

    return jsonify({
        "object": "list",
        "data": embeddings_data,
        "model": model_name,
        "usage": {
            "prompt_tokens": sum(len(t.split()) for t in input_texts),
            "total_tokens": sum(len(t.split()) for t in input_texts),
        },
    })


@app.route("/metrics", methods=["GET"])
def metrics():
    """Prometheus-compatible plain-text metrics endpoint."""
    uptime = time.time() - _stats["started_at"] if _stats["started_at"] else 0.0
    req_count = _stats["request_count"]
    err_count = _stats["error_count"]
    avg_lat = (
        _stats["total_latency_ms"] / req_count if req_count > 0 else 0.0
    )
    backend = model_state.get("backend", "none")
    loaded = 1 if model_state else 0

    lines = [
        "# HELP hiran_up Whether the Hiran inference server is up (1=up)",
        "# TYPE hiran_up gauge",
        f"hiran_up {loaded}",
        "",
        "# HELP hiran_uptime_seconds Server uptime in seconds",
        "# TYPE hiran_uptime_seconds counter",
        f"hiran_uptime_seconds {uptime:.1f}",
        "",
        "# HELP hiran_requests_total Total inference requests received",
        "# TYPE hiran_requests_total counter",
        f'hiran_requests_total{{backend="{backend}"}} {req_count}',
        "",
        "# HELP hiran_errors_total Total inference errors",
        "# TYPE hiran_errors_total counter",
        f'hiran_errors_total{{backend="{backend}"}} {err_count}',
        "",
        "# HELP hiran_avg_latency_ms Average inference latency in ms",
        "# TYPE hiran_avg_latency_ms gauge",
        f'hiran_avg_latency_ms{{backend="{backend}"}} {avg_lat:.2f}',
        "",
    ]
    return "\n".join(lines), 200, {"Content-Type": "text/plain; charset=utf-8"}


def main():
    global model_state

    parser = argparse.ArgumentParser(description="Hiran v2.2 inference server")
    parser.add_argument("--model_path", type=str, required=True,
                        help="Cesta k modelu: 'ollama:<name>', '*.gguf', nebo adresář HF modelu")
    parser.add_argument("--host", type=str, default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8002)
    parser.add_argument("--ollama_base", type=str, default="http://localhost:11434",
                        help="Ollama server URL (výchozí: http://localhost:11434)")

    args = parser.parse_args()

    print("=" * 60)
    print("  Hiran v2.2 Inference Server")
    print("=" * 60)
    print(f"  Model:  {args.model_path}")
    print(f"  Bind:   {args.host}:{args.port}")
    if args.model_path.startswith("ollama:"):
        print(f"  Ollama: {args.ollama_base}")
    print()

    print("Načítám model...")
    model_state = load_model(args.model_path, ollama_base=args.ollama_base)
    _stats["started_at"] = time.time()
    print(f"✅ Model načten (backend: {model_state['backend']})")
    print()
    print(f"API:     http://{args.host}:{args.port}/v1/chat/completions")
    print(f"Health:  http://{args.host}:{args.port}/health")
    print(f"Status:  http://{args.host}:{args.port}/status")
    print(f"Embed:   http://{args.host}:{args.port}/v1/embeddings")
    print(f"Metrics: http://{args.host}:{args.port}/metrics")
    print()

    app.run(host=args.host, port=args.port, threaded=True)


if __name__ == "__main__":
    main()
