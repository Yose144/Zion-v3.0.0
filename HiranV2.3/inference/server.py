#!/usr/bin/env python3
"""
Hiran v2.3 Inference Server
============================
FastAPI-based OpenAI-compatible API with tool orchestration and RAG.

Endpoints:
  POST /v1/chat/completions   — Chat with tools, RAG, streaming
  GET  /health                — Health check
  GET  /v1/models             — List available models

Usage:
    python inference/server.py --model_path HiranV2.3/models/hiran-v2.3-q5_k_m.gguf

With vLLM (recommended for production):
    python -m vllm.entrypoints.openai.api_server \
        --model HiranV2.3/models/hiran-v2.3-f16 \
        --served-model-name hiran-v2.3 \
        --port 8000

Requirements:
    fastapi uvicorn transformers torch
    Optional: llama-cpp-python, vllm
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

try:
    from fastapi import FastAPI, Request, HTTPException
    from fastapi.responses import StreamingResponse, JSONResponse
    import uvicorn
except ImportError:
    print("ERROR: fastapi/uvicorn not installed. Run: pip install fastapi uvicorn")
    sys.exit(1)

app = FastAPI(title="Hiran v2.3 Inference API", version="2.3.0")

# Global model state
_model_backend = None
_tokenizer = None
_rag_pipeline = None
_tool_registry = None

# ---------------------------------------------------------------------------
# Model backends
# ---------------------------------------------------------------------------

class LlamaCppBackend:
    def __init__(self, model_path: str, n_ctx: int = 8192, n_gpu_layers: int = -1):
        from llama_cpp import Llama
        self.model = Llama(
            model_path=model_path,
            n_ctx=n_ctx,
            n_gpu_layers=n_gpu_layers,
            verbose=False,
        )
        self.n_ctx = n_ctx

    def generate(self, prompt: str, max_tokens: int = 512, temperature: float = 0.7, stream: bool = False):
        return self.model(
            prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=stream,
            stop=["<|eot_id|>", "<|endoftext|>"],
        )


class TransformersBackend:
    def __init__(self, model_path: str):
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
        self.tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        self.model = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=torch.bfloat16,
            device_map="auto",
            trust_remote_code=True,
        )
        self.model.eval()

    def generate(self, prompt: str, max_tokens: int = 512, temperature: float = 0.7, stream: bool = False):
        import torch
        inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=4096)
        inputs = {k: v.to(self.model.device) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature if temperature > 0 else None,
                do_sample=temperature > 0,
                top_p=0.9,
                pad_token_id=self.tokenizer.pad_token_id,
                eos_token_id=self.tokenizer.eos_token_id,
            )
        generated = outputs[0][inputs["input_ids"].shape[1]:]
        text = self.tokenizer.decode(generated, skip_special_tokens=True)
        return [{"choices": [{"text": text}]}]


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model_backend, _rag_pipeline, _tool_registry
    # Initialize on startup
    model_path = os.environ.get("HIRAN_MODEL_PATH", "HiranV2.3/models/hiran-v2.3-q5_k_m.gguf")
    backend_type = os.environ.get("HIRAN_BACKEND", "auto")

    if not Path(model_path).exists():
        print(f"WARNING: Model not found at {model_path}")
        print("  Hiran v2.3 model has not been trained yet.")
        print("  Train first: python scripts/train_v2.3_fullft.py --stage all")
        print("  Then quantize: python scripts/quantize.py --checkpoint checkpoints/stage1_factual/final")
        print("  Or set HIRAN_MODEL_PATH to an existing model.")
        _model_backend = None
    elif model_path.endswith(".gguf") or backend_type == "llama.cpp":
        try:
            from llama_cpp import Llama
            _model_backend = LlamaCppBackend(model_path)
            print(f"Loaded llama.cpp backend: {model_path}")
        except ImportError:
            print("llama-cpp-python not installed, falling back to transformers")
            _model_backend = TransformersBackend(model_path.replace(".gguf", ""))
    else:
        _model_backend = TransformersBackend(model_path)

    # Initialize RAG
    try:
        from HiranV2.3.rag import RAGPipeline
        _rag_pipeline = RAGPipeline(use_chromadb=False)
        # Auto-ingest docs if available
        docs_dirs = ["V3/docs", "docs/v2.9.6"]
        for d in docs_dirs:
            if Path(d).exists():
                _rag_pipeline.ingest_directory(d)
        print(f"RAG ready with {len(_rag_pipeline._documents)} chunks")
    except Exception as e:
        print(f"RAG init warning: {e}")
        _rag_pipeline = None

    # Initialize tools
    try:
        from HiranV2.3.tools import ToolRegistry
        from HiranV2.3.tools.web_browsing import WebBrowsingTool
        from HiranV2.3.tools.code_execution import CodeExecutionTool
        from HiranV2.3.tools.file_operations import FileOperationsTool
        from HiranV2.3.tools.blueprint_generator import BlueprintGeneratorTool
        from HiranV2.3.tools.api_integration import ApiIntegrationTool

        _tool_registry = ToolRegistry()
        _tool_registry.register(WebBrowsingTool())
        _tool_registry.register(CodeExecutionTool())
        _tool_registry.register(FileOperationsTool())
        _tool_registry.register(BlueprintGeneratorTool())
        _tool_registry.register(ApiIntegrationTool())
        print(f"Tools registered: {[t['name'] for t in _tool_registry.list_tools()]}")
    except Exception as e:
        print(f"Tools init warning: {e}")
        _tool_registry = None

    yield
    # Cleanup
    if _rag_pipeline and hasattr(_rag_pipeline, "save_index"):
        _rag_pipeline.save_index("HiranV2.3/rag/index.json")

app.router.lifespan_context = lifespan

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "model_loaded": _model_backend is not None,
        "rag_ready": _rag_pipeline is not None,
        "tools_count": len(_tool_registry.list_tools()) if _tool_registry else 0,
    }


@app.get("/v1/models")
async def list_models() -> dict[str, Any]:
    return {
        "object": "list",
        "data": [
            {"id": "hiran-v2.3", "object": "model", "owned_by": "zion-ai"},
        ],
    }


def build_prompt(messages: list[dict[str, str]], system: str | None = None, rag_context: str = "") -> str:
    """Build Llama 3.1 chat prompt from OpenAI-format messages."""
    parts = []
    if system:
        parts.append(f"<|begin_of_text|>任职system\n\n{system}<|eot_id|>")
    if rag_context:
        parts.append(f"<|begin_of_text|>任职system\n\nUse the following context to answer:\n{rag_context}<|eot_id|>")
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        parts.append(f"<|begin_of_text|>任职{role}\n\n{content}<|eot_id|>")
    parts.append("<|begin_of_text|>任职assistant\n\n")
    return "".join(parts)


@app.post("/v1/chat/completions")
async def chat_completions(request: Request) -> JSONResponse | StreamingResponse:
    body = await request.json()
    messages = body.get("messages", [])
    model_id = body.get("model", "hiran-v2.3")
    temperature = body.get("temperature", 0.7)
    max_tokens = body.get("max_tokens", 512)
    stream = body.get("stream", False)
    use_rag = body.get("use_rag", True)
    use_tools = body.get("use_tools", True)

    if not _model_backend:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # RAG context injection
    rag_context = ""
    if use_rag and _rag_pipeline and messages:
        last_user_msg = next(
            (m["content"] for m in reversed(messages) if m.get("role") == "user"),
            "",
        )
        if last_user_msg:
            rag_result = _rag_pipeline.query(last_user_msg, top_k=5)
            rag_context = rag_result.to_prompt_context(max_tokens=2000)

    # Tool calls detection (simple heuristic: check if message asks for a tool)
    tool_calls = []
    if use_tools and _tool_registry and messages:
        last_msg = messages[-1].get("content", "")
        # Very simple tool detection — in production use function calling
        for tool_info in _tool_registry.list_tools():
            if tool_info["name"].replace("_", " ") in last_msg.lower():
                result = _tool_registry.execute(tool_info["name"])
                tool_calls.append({"tool": tool_info["name"], "result": result})

    system_msg = None
    for msg in messages:
        if msg.get("role") == "system":
            system_msg = msg.get("content")
            break

    prompt = build_prompt(messages, system=system_msg, rag_context=rag_context)

    if tool_calls:
        # Append tool results to prompt
        tool_text = "\n\n".join([f"Tool '{t['tool']}' result:\n{json.dumps(t['result'], indent=2)}" for t in tool_calls])
        prompt += f"\n[Available tool results]\n{tool_text}\n"

    if stream:
        async def stream_generator() -> AsyncGenerator[str, None]:
            yield "data: " + json.dumps({"object": "chat.completion.chunk", "choices": [{"delta": {"role": "assistant"}}]}) + "\n\n"
            result = _model_backend.generate(prompt, max_tokens=max_tokens, temperature=temperature, stream=False)
            if isinstance(result, list) and result:
                text = result[0].get("choices", [{}])[0].get("text", "")
            else:
                text = str(result)
            yield "data: " + json.dumps({"object": "chat.completion.chunk", "choices": [{"delta": {"content": text}}]}) + "\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(stream_generator(), media_type="text/event-stream")

    result = _model_backend.generate(prompt, max_tokens=max_tokens, temperature=temperature, stream=False)
    if isinstance(result, list) and result:
        text = result[0].get("choices", [{}])[0].get("text", "")
    else:
        text = str(result)

    return JSONResponse({
        "object": "chat.completion",
        "model": model_id,
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": text},
            "finish_reason": "stop",
        }],
        "usage": {
            "prompt_tokens": len(prompt.split()),
            "completion_tokens": len(text.split()),
            "total_tokens": len(prompt.split()) + len(text.split()),
        },
    })


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Hiran v2.3 Inference Server")
    parser.add_argument("--model_path", default="HiranV2.3/models/hiran-v2.3-q5_k_m.gguf")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--backend", choices=["auto", "llama.cpp", "transformers"], default="auto")
    parser.add_argument("--n_gpu_layers", type=int, default=-1)
    args = parser.parse_args()

    os.environ["HIRAN_MODEL_PATH"] = args.model_path
    os.environ["HIRAN_BACKEND"] = args.backend

    print(f"Starting Hiran v2.3 server on {args.host}:{args.port}")
    print(f"Model: {args.model_path}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
    return 0


if __name__ == "__main__":
    sys.exit(main())
