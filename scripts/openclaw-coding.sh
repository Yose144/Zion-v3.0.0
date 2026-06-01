#!/usr/bin/env bash
# OpenClaw Coding Agent wrapper for Zion V3
# Uses local Ollama + hiran-v2.2-fast model for AI-assisted coding.
#
# Usage:
#   ./scripts/openclaw-coding.sh "Write a Python function to..."
#   ./scripts/openclaw-coding.sh --file src/main.rs "Refactor this code..."
#   cat file.rs | ./scripts/openclaw-coding.sh "Review this code"
#
# Prerequisites:
#   - openclaw installed: npm install -g openclaw@latest
#   - openclaw gateway running (auto-started if not running)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OLLAMA_HOST="${OLLAMA_HOST:-127.0.0.1:11434}"

# Ensure gateway is running
if ! curl -fsS --max-time 2 "http://127.0.0.1:18789/health" >/dev/null 2>&1; then
    echo "[INFO] Starting OpenClaw gateway..."
    nohup openclaw gateway run > "$REPO_ROOT/logs/openclaw-gateway.log" 2>&1 &
    sleep 3
fi

# Default prompt from stdin or first argument
if [[ $# -eq 0 ]]; then
    if [[ -t 0 ]]; then
        echo "Usage: $0 <coding prompt>"
        echo "   or: echo 'prompt' | $0"
        echo "   or: cat file.rs | $0 'Review this code'"
        exit 1
    fi
    PROMPT="$(cat)"
else
    PROMPT="$*"
fi

# If stdin is not a terminal and not empty, prepend it as context
if [[ ! -t 0 ]]; then
    CONTEXT="$(cat)"
    if [[ -n "$CONTEXT" ]]; then
        PROMPT="${PROMPT}\n\n--- Context ---\n${CONTEXT}"
    fi
fi

echo "[OpenClaw] Prompting hiran-v2.2-fast with: ${PROMPT:0:80}..."
openclaw agent --agent main --thinking off --message "$PROMPT"
