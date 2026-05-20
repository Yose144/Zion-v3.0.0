#!/usr/bin/env bash
# Live tail of all ZION logs with colour

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"

if ! command -v multitail >/dev/null 2>&1; then
    echo "Installing multitail..."
    if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get install -y multitail 2>/dev/null || true
    elif command -v brew >/dev/null 2>&1; then
        brew install multitail 2>/dev/null || true
    elif command -v yum >/dev/null 2>&1; then
        sudo yum install -y multitail 2>/dev/null || true
    fi
fi

if command -v multitail >/dev/null 2>&1; then
    multitail -ci green "$LOG_DIR/node1.log" -ci yellow "$LOG_DIR/node2.log" -ci cyan "$LOG_DIR/pool.log" -ci magenta "$LOG_DIR/miner.log"
else
    echo "[fallback] tail -f all logs (install multitail for split view):"
    tail -f "$LOG_DIR"/*.log
fi
