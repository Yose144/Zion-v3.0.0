#!/usr/bin/env bash
# ZION V3 — Start Hiran v2.2 Inference Server (port 8002)
# OpenAI-compatible API: /v1/chat/completions, /health, /status, /metrics, /v1/embeddings
#
# Backend priority:
#   1. llama-server + GGUF (llama.cpp-bin/llama-server) — fastest, no Python
#   2. LM Studio server (port 1234)
#   3. Ollama server (port 11434)
#   4. serve.py + GGUF (llama-cpp-python) — Python fallback
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
LLAMA_SERVER="$REPO_ROOT/llama.cpp-bin/llama-server"
GGUF_Q4="$REPO_ROOT/HiranV2.2/models/hiran-v2.2-merged/hiran-v2.2.q4_k_m.gguf"
GGUF_F16="$REPO_ROOT/HiranV2.2/models/hiran-v2.2-merged/hiran-v2.2.f16.gguf"
SERVE_PY="$REPO_ROOT/HiranV2.2/inference/serve.py"
PORT=8002
HOST="127.0.0.1"
mkdir -p "$LOG_DIR"

# -- Already running? ----------------------------------------------------------
if curl -fsS --max-time 2 "http://${HOST}:${PORT}/health" >/dev/null 2>&1; then
    echo "[OK] Hiran Inference already running on port $PORT"
    exit 0
fi

# -- Pick GGUF file ------------------------------------------------------------
GGUF_FILE=""
if [[ -f "$GGUF_Q4" ]]; then
    GGUF_FILE="$GGUF_Q4"; echo "[OK] GGUF: Q4_K_M ($GGUF_Q4)"
elif [[ -f "$GGUF_F16" ]]; then
    GGUF_FILE="$GGUF_F16"; echo "[OK] GGUF: F16 ($GGUF_F16)"
fi

# -- Backend 1: llama-server (preferred) ---------------------------------------
if [[ -n "$GGUF_FILE" && -x "$LLAMA_SERVER" ]]; then
    echo "[OK] Backend: llama-server (llama.cpp native)"
    echo "     Model:   $GGUF_FILE"
    GPU_LAYERS="${HIRAN_GPU_LAYERS:-33}"
    ARGS=(--model "$GGUF_FILE" --host "$HOST" --port "$PORT"
          --ctx-size 4096 --threads 8 --n-predict -1 --parallel 2)
    if [[ "$GPU_LAYERS" -gt 0 ]]; then
        ARGS+=(--n-gpu-layers "$GPU_LAYERS")
        echo "     GPU layers: $GPU_LAYERS"
    fi
    nohup "$LLAMA_SERVER" "${ARGS[@]}" \
        > "$LOG_DIR/hiran-inference.log" 2> "$LOG_DIR/hiran-inference.err" &
    PID=$!
    echo "[OK] llama-server PID=$PID -> http://${HOST}:${PORT}"
    echo "     Waiting for readiness..."
    for _ in $(seq 1 30); do
        sleep 1
        if curl -fsS --max-time 2 "http://${HOST}:${PORT}/health" >/dev/null 2>&1; then
            echo "[OK] Hiran Inference READY on http://${HOST}:${PORT}"; exit 0
        fi
    done
    echo "[WARN] llama-server did not respond within 30s — check $LOG_DIR/hiran-inference.log"
    exit 0
fi

# -- Backend 2: LM Studio ------------------------------------------------------
MODEL_PATH=""; BACKEND_NAME=""
if curl -fsS --max-time 2 "http://localhost:1234/v1/models" >/dev/null 2>&1; then
    MODEL_PATH="lmstudio:hiran-v2.2"; BACKEND_NAME="LM Studio (port 1234)"
fi

# -- Backend 3: Ollama ---------------------------------------------------------
if [[ -z "$MODEL_PATH" ]] && curl -fsS --max-time 2 "http://localhost:11434/api/tags" >/dev/null 2>&1; then
    MODEL_PATH="ollama:hiran-v2.2"; BACKEND_NAME="Ollama (port 11434)"
fi

# -- Backend 4: serve.py + GGUF ------------------------------------------------
if [[ -z "$MODEL_PATH" && -n "$GGUF_FILE" ]]; then
    MODEL_PATH="$GGUF_FILE"; BACKEND_NAME="serve.py + GGUF llama-cpp-python"
fi

if [[ -z "$MODEL_PATH" ]]; then
    echo ""
    echo "[ERROR] No inference backend available!"
    echo "  Options:"
    echo "    A) Provide GGUF for llama-server: $GGUF_Q4"
    echo "    B) Start LM Studio server on port 1234"
    echo "    C) Run Ollama: ollama serve + ollama pull hiran-v2.2"
    echo "    D) Build GGUF: uv run HiranV2.2/quantization/convert_to_gguf.py"
    exit 1
fi

echo "[OK] Backend: $BACKEND_NAME"
echo "[OK] Model:   $MODEL_PATH"

PY_ARGS=("$SERVE_PY" --model_path "$MODEL_PATH" --host "$HOST" --port "$PORT")
if command -v uv >/dev/null 2>&1; then
    nohup uv run python "${PY_ARGS[@]}" \
        > "$LOG_DIR/hiran-inference.log" 2> "$LOG_DIR/hiran-inference.err" &
else
    nohup python3 "${PY_ARGS[@]}" \
        > "$LOG_DIR/hiran-inference.log" 2> "$LOG_DIR/hiran-inference.err" &
fi
echo "[OK] Hiran Inference PID=$! -> http://${HOST}:${PORT}"
echo "     Backend: $BACKEND_NAME | Log: $LOG_DIR/hiran-inference.log"
