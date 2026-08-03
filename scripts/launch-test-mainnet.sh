#!/usr/bin/env bash
# ZION V3 — Local Test Mainnet Launch Script
# Runs full stack: node + pool + miner + Prometheus + Grafana
# For Windows 11 + WSL2 native build
#
# Usage:
#   cd /mnt/c/Users/yosef/Desktop/Zion/2.9.6-main
#   bash scripts/launch-test-mainnet.sh
#
# Stop:
#   bash scripts/stop-test-mainnet.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
V3_DIR="$REPO_ROOT/V3"
ENV_FILE="$REPO_ROOT/.env.test-mainnet"
LOG_DIR="$REPO_ROOT/logs"
PID_DIR="$REPO_ROOT/run"

# ---------------------------------------------------------------------------
# 0. Directories
# ---------------------------------------------------------------------------
mkdir -p "$LOG_DIR" "$PID_DIR"

# ---------------------------------------------------------------------------
# 1. Generate fresh keys if they don't exist
# ---------------------------------------------------------------------------
if [[ ! -f "$ENV_FILE" ]]; then
  echo "[launch] Generating fresh test mainnet keys ..."
  cd "$REPO_ROOT"
  source "$HOME/.cargo/env" 2>/dev/null || true
  if ! command -v cargo &>/dev/null; then
    echo "[ERROR] Rust/Cargo not found. Install first:"
    echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
  fi
  cargo run --manifest-path "$V3_DIR/Cargo.toml" -p zion-core --release --bin gen-keys > "$ENV_FILE" 2>/dev/null
  # Append common vars
  cat >> "$ENV_FILE" << 'ENV_APPEND'

# ==================== POOL ====================
ZION_POOL_BIND=0.0.0.0:8444
ZION_NODE_RPC_ADDR=127.0.0.1:8443
ZION_POOL_LOOP_COUNT=1000000
ZION_MAX_SESSIONS_PER_IP=10

# ==================== MINER ====================
ZION_POOL_ADDR=127.0.0.1:8444
ZION_LOOP_COUNT=1000000
ZION_MINER_THREADS=2
ZION_WORKER_NAME=worker1
ZION_MINER_ID=test-miner-01

# ==================== GRAFANA ====================
GF_SECURITY_ADMIN_PASSWORD=${GF_SECURITY_ADMIN_PASSWORD:-ChangeMe_Grafana_Admin_Password}
ENV_APPEND
  echo "[launch] Keys written to $ENV_FILE"
else
  echo "[launch] Using existing keys: $ENV_FILE"
fi

# ---------------------------------------------------------------------------
# 2. Source env
# ---------------------------------------------------------------------------
set -a
source "$ENV_FILE"
set +a

# ---------------------------------------------------------------------------
# 3. Check binaries exist, build if missing
# ---------------------------------------------------------------------------
cd "$V3_DIR"
source "$HOME/.cargo/env" 2>/dev/null || true

for binary in node server zion-miner; do
  if [[ ! -f "$V3_DIR/target/release/$binary" ]]; then
    echo "[launch] Building $binary ..."
    case "$binary" in
      node)    cargo build --release -p zion-core --bin node ;;
      server)  cargo build --release -p zion-pool --bin server ;;
      zion-miner) cargo build --release -p zion-miner ;;
    esac
  fi
done

# ---------------------------------------------------------------------------
# 4. Ensure data dir exists
# ---------------------------------------------------------------------------
mkdir -p "$V3_DIR/data"

# ---------------------------------------------------------------------------
# 5. Start Node
# ---------------------------------------------------------------------------
echo "[launch] Starting zion-node ..."
ZION_NODE_STATE_PATH="$V3_DIR/data/zion-node-state.db" \
nohup "$V3_DIR/target/release/node" > "$LOG_DIR/node.log" 2>&1 &
echo $! > "$PID_DIR/node.pid"
NODE_PID=$!

# ---------------------------------------------------------------------------
# 6. Wait for node RPC
# ---------------------------------------------------------------------------
echo "[launch] Waiting for node RPC (port 8443) ..."
for i in {1..30}; do
  if curl -sf http://127.0.0.1:8443/health &>/dev/null; then
    echo "[launch] Node ready!"
    break
  fi
  sleep 1
  if [[ $i -eq 30 ]]; then
    echo "[WARN] Node health check timed out. Check $LOG_DIR/node.log"
  fi
done

# ---------------------------------------------------------------------------
# 7. Start Pool
# ---------------------------------------------------------------------------
echo "[launch] Starting zion-pool ..."
nohup "$V3_DIR/target/release/server" > "$LOG_DIR/pool.log" 2>&1 &
echo $! > "$PID_DIR/pool.pid"
POOL_PID=$!

# ---------------------------------------------------------------------------
# 8. Wait for pool stratum
# ---------------------------------------------------------------------------
echo "[launch] Waiting for pool stratum (port 8444) ..."
for i in {1..20}; do
  if curl -sf http://127.0.0.1:8444/health &>/dev/null; then
    echo "[launch] Pool ready!"
    break
  fi
  sleep 1
  if [[ $i -eq 20 ]]; then
    echo "[WARN] Pool health check timed out. Check $LOG_DIR/pool.log"
  fi
done

# ---------------------------------------------------------------------------
# 9. Start Miner
# ---------------------------------------------------------------------------
echo "[launch] Starting zion-miner (CPU) ..."
nohup "$V3_DIR/target/release/zion-miner" > "$LOG_DIR/miner.log" 2>&1 &
echo $! > "$PID_DIR/miner.pid"
MINER_PID=$!

# ---------------------------------------------------------------------------
# 10. Start Monitoring (Prometheus + Grafana via Docker)
# ---------------------------------------------------------------------------
if command -v docker &>/dev/null && docker ps &>/dev/null; then
  echo "[launch] Starting Prometheus + Grafana ..."
  cd "$V3_DIR/docker"
  docker compose -f docker-compose.yml --profile monitoring up -d 2>/dev/null || \
    docker compose -f docker-compose.yml up -d prometheus grafana 2>/dev/null || {
      echo "[WARN] Could not start monitoring via docker-compose."
      echo "       Start manually: docker run -d -p 9090:9090 prom/prometheus"
      echo "                       docker run -d -p 3000:3000 grafana/grafana"
    }
else
  echo "[WARN] Docker not available. Monitoring (Prometheus/Grafana) not started."
fi

# ---------------------------------------------------------------------------
# 11. Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================================"
echo "  ZION V3 Test Mainnet — Running"
echo "============================================================"
echo "  Node     PID $NODE_PID    RPC:     http://127.0.0.1:8443"
echo "  Pool     PID $POOL_PID    Stratum: 127.0.0.1:8444"
echo "  Miner    PID $MINER_PID   CPU-only (WSL2)"
echo "  Logs:    $LOG_DIR"
echo "  Env:     $ENV_FILE"
echo "------------------------------------------------------------"
echo "  Grafana:  http://localhost:3000  (admin / \$GF_SECURITY_ADMIN_PASSWORD)"
echo "  Prometheus: http://localhost:9090"
echo "------------------------------------------------------------"
echo "  Stop:    bash scripts/stop-test-mainnet.sh"
echo "============================================================"
echo ""
echo "[launch] Done. Use 'tail -f $LOG_DIR/*.log' to watch logs."
