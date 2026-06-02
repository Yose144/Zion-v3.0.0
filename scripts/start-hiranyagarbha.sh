#!/usr/bin/env bash
# ZION V3 — Start Hiranyagarbha AI Native API (port 8001)
# Orchestrator HTTP API + RAG + ConsciousnessEngine + Hiran inference client
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

export HIRANYAGARBHA_BIND="${HIRANYAGARBHA_BIND:-0.0.0.0:8001}"
export HIRANYAGARBHA_BACKEND="${HIRANYAGARBHA_BACKEND:-auto}"
export HIRANYAGARBHA_MAX_AGENTS="${HIRANYAGARBHA_MAX_AGENTS:-250}"
export ZION_NODE_RPC_ADDR="${ZION_NODE_RPC_ADDR:-127.0.0.1:8443}"
export ZION_POOL_API_URL="${ZION_POOL_API_URL:-http://127.0.0.1:8080}"
export LLM_BASE_URL="${LLM_BASE_URL:-http://127.0.0.1:8002/v1}"
export LLM_MODEL="${LLM_MODEL:-hiran-v2.2}"
export ZION_WORKSPACE_ROOT="${ZION_WORKSPACE_ROOT:-$REPO_ROOT}"
export ZION_RAG_CHUNK_DOCS="${ZION_RAG_CHUNK_DOCS:-1}"

# Use spare RAM for more Tokio workers and larger RAG cache
export TOKIO_WORKER_THREADS="${TOKIO_WORKER_THREADS:-8}"
export HIRANYAGARBHA_RAG_CACHE_MB="${HIRANYAGARBHA_RAG_CACHE_MB:-2048}"

EXE="$(find_exe zion-ai-native-api)" || {
    zlog "[ERROR] zion-ai-native-api not built."
    zlog "        Run: cargo build --release --manifest-path V3/Cargo.toml -p zion-ai-native"
    exit 1
}
start_bg "hiranyagarbha" "$EXE" >/dev/null
zlog "Hiranyagarbha -> http://localhost:8001"
