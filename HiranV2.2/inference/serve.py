#!/usr/bin/env python3
"""
Simple inference server for Hiran v2.2.

Serves model via HTTP API with OpenAI-compatible endpoints.
Supports both GGUF (llama.cpp) and HuggingFace formats.

Usage:
    python3 inference/serve.py \
        --model_path ../models/gguf/hiran-v2.2-q5_k_m.gguf \
        --port 8002
"""

import argparse
import json
import time
from pathlib import Path
from typing import Dict, Any, Optional
from flask import Flask, request, jsonify

app = Flask(__name__)

# Global model state
model = None
tokenizer = None


def load_model(model_path: str):
    """Load model based on format."""
    path = Path(model_path)

    if path.suffix == ".gguf":
        # Load GGUF model with llama.cpp
        try:
            from llama_cpp import Llama
            model = Llama(model_path=str(path), n_ctx=4096)
            return {"backend": "llama_cpp", "model": model}
        except ImportError:
            raise RuntimeError("llama-cpp-python not installed")
    else:
        # Load HuggingFace model
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
            raise RuntimeError("transformers not installed")


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "model_loaded": model is not None})


@app.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    """OpenAI-compatible chat completions endpoint."""
    if model is None:
        return jsonify({"error": "Model not loaded"}), 500

    data = request.json
    messages = data.get("messages", [])
    max_tokens = data.get("max_tokens", 256)
    temperature = data.get("temperature", 0.7)
    top_p = data.get("top_p", 0.9)

    # Extract user message
    user_message = ""
    for msg in messages:
        if msg.get("role") == "user":
            user_message = msg.get("content", "")
            break

    if not user_message:
        return jsonify({"error": "No user message"}), 400

    # Format prompt
    prompt = f"### Instruction:\n{user_message}\n\n### Response:\n"

    start_time = time.time()

    try:
        if model_state["backend"] == "llama_cpp":
            output = model_state["model"](
                prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                stop=["### Instruction", "### Response"]
            )
            response_text = output["choices"][0]["text"]
        else:
            inputs = model_state["tokenizer"](prompt, return_tensors="pt")
            with torch.no_grad():
                outputs = model_state["model"].generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    do_sample=True
                )
            response_text = model_state["tokenizer"].decode(outputs[0], skip_special_tokens=True)
            response_text = response_text.split("### Response:\n")[-1]

        latency = time.time() - start_time

        return jsonify({
            "id": "chatcmpl-" + str(int(time.time() * 1000)),
            "object": "chat.completion",
            "created": int(time.time()),
            "model": "hiran-v2.2",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response_text
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": len(prompt.split()),
                "completion_tokens": len(response_text.split()),
                "total_tokens": len(prompt.split()) + len(response_text.split())
            },
            "latency_ms": round(latency * 1000, 2)
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
    parser.add_argument("--model_path", type=str, required=True)
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8002)

    args = parser.parse_args()

    print(f"Loading model from {args.model_path}...")
    model_state = load_model(args.model_path)
    print(f"✅ Model loaded (backend: {model_state['backend']})")

    print(f"Starting server on {args.host}:{args.port}...")
    app.run(host=args.host, port=args.port)


if __name__ == "__main__":
    main()
