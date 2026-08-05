#!/usr/bin/env bash
# ============================================================================
#  ZION OS — Stop All Services (Ubuntu / Linux)
#  Gracefully stops dashboard, node, miner, and any other zion binaries.
# ============================================================================

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PID_FILE="${REPO_ROOT}/logs/.stack-pids"

echo "==========================================================="
echo "  ZION OS — Stopping all services..."
echo "==========================================================="
echo ""

# ── 1. Stop by PID file (if available) ──────────────────────────────────────
if [[ -f "$PID_FILE" ]]; then
    source "$PID_FILE"
    for name in DASH_PID NODE_PID MINER_PID; do
        pid="${!name:-}"
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            echo "[STOP] $name ($pid)..."
            kill "$pid" 2>/dev/null || true
        fi
    done
    rm -f "$PID_FILE"
    sleep 2
fi

# ── 2. Stop any remaining zion binaries ─────────────────────────────────────
for pattern in "zion-miner" "target/release/node" "dashboard/app.py"; do
    pids=$(pgrep -f "$pattern" || true)
    if [[ -n "$pids" ]]; then
        echo "[STOP] $pattern ..."
        echo "$pids" | xargs kill 2>/dev/null || true
    fi
done

sleep 1

# ── 3. Force kill anything still alive ─────────────────────────────────────
for pattern in "zion-miner" "target/release/node"; do
    pids=$(pgrep -f "$pattern" || true)
    if [[ -n "$pids" ]]; then
        echo "[KILL] Force killing remaining $pattern ..."
        echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
done

echo ""
echo "[OK] All ZION services stopped."
echo ""
