#!/bin/bash
# launch-edge-node.sh — ZION Edge Relay Node
# ===========================================
# Spustiť na verejnom VPS (Edge Node). Tento uzol:
#   - Binduje P2P na 0.0.0.0:8333 (verejne dostupné)
#   - Syncuje sa s Core Node cez Tailscale VPN
#   - Nemá pool, nemá miner — čistý relay
#
# Použitie:
#   chmod +x scripts/launch-edge-node.sh
#   CORE_TS_IP=100.x.y.z ./scripts/launch-edge-node.sh

set -euo pipefail

# --- Konfigurácia ---
CORE_TS_IP="${CORE_TS_IP:-}"          # Tailscale IP Core Node (100.x.y.z)
NODE_ID="${NODE_ID:-zion-edge-relay}"
P2P_BIND="${P2P_BIND:-0.0.0.0:8333}"
RPC_BIND="${RPC_BIND:-127.0.0.1:8443}"
DATA_DIR="${DATA_DIR:-./V3/data-edge}"
STATE_FILE="${STATE_FILE:-$DATA_DIR/edge-state.db}"
LOG_DIR="${LOG_DIR:-./logs}"
ZION_DIR="${ZION_DIR:-./V3}"

# --- Validácia ---
if [ -z "$CORE_TS_IP" ]; then
    echo "CHYBA: Nastav CORE_TS_IP — Tailscale IP Core Node."
    echo "Príklad: CORE_TS_IP=100.64.1.2 $0"
    exit 1
fi

if ! command -v tailscale &>/dev/null; then
    echo "VAROVANIE: Tailscale nie je nainštalovaný. Edge Node sa nebude vedieť spojiť s Core."
    echo "Nainštaluj: curl -fsSL https://tailscale.com/install.sh | sh"
fi

echo "=== ZION Edge Relay Node ==="
echo "Node ID : $NODE_ID"
echo "P2P bind: $P2P_BIND"
echo "RPC bind: $RPC_BIND"
echo "Seed    : $CORE_TS_IP:8333 (Core via Tailscale)"
echo "Data dir: $DATA_DIR"
echo ""

# --- Príprava adresárov ---
mkdir -p "$DATA_DIR" "$LOG_DIR"

# --- Environment ---
export ZION_NODE_ID="$NODE_ID"
export ZION_P2P_BIND="$P2P_BIND"
export ZION_RPC_BIND="$RPC_BIND"
export ZION_SEED_PEERS="$CORE_TS_IP:8333"
export ZION_NODE_STATE_PATH="$STATE_FILE"
export ZION_DATA_DIR="$DATA_DIR"
export RUST_LOG="${RUST_LOG:-info}"

# --- Build (ak treba) ---
if [ ! -f "$ZION_DIR/target/release/node" ]; then
    echo "Building node binary..."
    cd "$ZION_DIR"
    cargo build --release --bin node
    cd -
fi

# --- Spustenie ---
LOG_FILE="$LOG_DIR/edge-node-$(date +%Y%m%d-%H%M%S).log"
echo "Log file: $LOG_FILE"

nohup "$ZION_DIR/target/release/node" \
    --seed-peers "$CORE_TS_IP:8333" \
    > "$LOG_FILE" 2>&1 &

PID=$!
echo $PID > "$LOG_DIR/edge-node.pid"
echo "Edge Node spustený (PID $PID). Log: $LOG_FILE"
echo ""
echo "Kontrola:"
echo "  tail -f $LOG_FILE"
echo "  tailscale ping $CORE_TS_IP"
echo "  ss -tlnp | grep 8333   # overenie verejného bindu"
