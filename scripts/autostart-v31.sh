#!/usr/bin/env bash
# ZION V31 — Autostart ALL local services (L2/L3/L4-L6 + AI)
# Called by systemd user service on login/boot (zion-stack.service)
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
DATA_DIR="$REPO_ROOT/V31/data"
mkdir -p "$LOG_DIR" "$DATA_DIR"

cd "$REPO_ROOT"

# Helper: start a binary detached via setsid if not already running.
# Usage: run_detached <label> <binary-name> <log-name> [NAME=VALUE ...] [-- [binary-arg ...]]
run_detached() {
    local name="$1" bin="$2" log="$3"
    shift 3

    if pgrep -f "V31/target/release/$bin" >/dev/null; then
        echo "[SKIP] $name already running"
        return
    fi

    # Collect NAME=VALUE environment assignments before the optional `--` separator.
    local env_args=(RUST_LOG=info)
    while [[ $# -gt 0 && "$1" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; do
        env_args+=("$1")
        shift
    done

    if [[ $# -gt 0 && "$1" == "--" ]]; then
        shift
    fi

    # setsid runs `env` in a new session; env sets the env vars and executes the binary.
    # (This system's `env` does NOT support `--`; the command word is the binary path.)
    setsid -f env "${env_args[@]}" "$REPO_ROOT/V31/target/release/$bin" "$@" >> "$LOG_DIR/$log" 2>&1
    echo "[OK] $name started"
}

# L2 — DAO
run_detached \
    "zion-dao" \
    "zion-dao" \
    "dao-v31.log" \
    DAO_API_PORT=8456 \
    DAO_L1_RPC=127.0.0.1:9445 \
    DAO_DB_PATH="$DATA_DIR/dao-v31.db"

# L2 — Multichain / WARP
# Note: local port 8453 is used by the zion-ssh-tunnel service to reach Edge.
# We bind the local warpd on 8457 (DEX API on 8458) to avoid the conflict.
run_detached \
    "warpd" \
    "warpd" \
    "warp-v31.log" \
    -- \
    --config "$REPO_ROOT/V31/data/warp.toml" \
    --listen 127.0.0.1:8457 \
    --db "$DATA_DIR/warp.db"

# L3 — AI Native API
run_detached \
    "zion-ai-native-api" \
    "zion-ai-native-api" \
    "ai-native-v31.log" \
    HIRANYAGARBHA_BIND=0.0.0.0:8001 \
    ZION_NODE_RPC_ADDR=127.0.0.1:9445 \
    ZION_POOL_API_URL=http://127.0.0.1:8080 \
    ZION_WORKSPACE_ROOT="$REPO_ROOT" \
    --

# L4 — OASIS
run_detached \
    "zion-oasis" \
    "zion-oasis" \
    "oasis-v31.log" \
    OASIS_PORT=8094 \
    OASIS_BIND=127.0.0.1 \
    OASIS_DB="$DATA_DIR/oasis-v31.db" \
    OASIS_METRICS_PORT=9102 \
    OASIS_L1_RPC_URL=http://127.0.0.1:9445 \
    --

# L5 — Free World
run_detached \
    "zion-free-world" \
    "zion-free-world" \
    "free-world-v31.log" \
    FREE_WORLD_BIND=127.0.0.1 \
    FREE_WORLD_PORT=8095 \
    FREE_WORLD_DB="$DATA_DIR/free_world-v31.db" \
    FREE_WORLD_L1_RPC=http://127.0.0.1:9445/jsonrpc \
    ZION_DAO_API_ADDR=http://127.0.0.1:8456 \
    --

# L6 — Issobella
run_detached \
    "zion-issobella" \
    "zion-issobella" \
    "issobella-v31.log" \
    ISSOBELLA_BIND=127.0.0.1 \
    ISSOBELLA_PORT=8097 \
    ISSOBELLA_DB="$DATA_DIR/issobella-v31.db" \
    ISSOBELLA_L1_RPC=http://127.0.0.1:9445/jsonrpc \
    ZION_DAO_API_ADDR=http://127.0.0.1:8456 \
    --

echo "[$(date '+%Y-%m-%d %H:%M:%S')] V31 autostart complete"
