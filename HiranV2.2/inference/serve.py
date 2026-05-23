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
import json
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


def load_model(model_path: str, ollama_base: str = "http://localhost:11434"):
    """Load model based on format / path prefix."""

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
        # ── Ollama proxy ──────────────────────────────────────────────────────
        if backend == "ollama":
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
        return jsonify({"error": str(e)}), 500


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
    print(f"✅ Model načten (backend: {model_state['backend']})")
    print()
    print(f"API:    http://{args.host}:{args.port}/v1/chat/completions")
    print(f"Health: http://{args.host}:{args.port}/health")
    print()

    app.run(host=args.host, port=args.port, threaded=True)


if __name__ == "__main__":
    main()
