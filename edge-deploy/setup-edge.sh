#!/usr/bin/env bash
# ZION Edge Server — Multi-Node Setup (run directly on Edge server as root)
# Sets up systemd services so Edge runs autonomously 24/7 with:
#   - 2 P2P nodes (primary + follower)
#   - Primary mining pool
#   - All L2/L3 non-AI services (bridge, DAO, atomic-swap, WARP)
#
# Local PC runs:
#   - Backup node (syncs from Edge)
#   - Miners (connect to Edge pool)
#   - AI services (Hiran + Hiranyagarbha) — requires local GPU

set -euo pipefail

REPO_ROOT="/root/zion-2.9.6-main"
SERVICE_DIR="/etc/systemd/system"
ENV_FILE="${REPO_ROOT}/edge-deploy/config/edge-environment.sh"

SERVICES=(
  zion-edge-node1
  zion-edge-node2
  zion-edge-pool
  zion-edge-bridge
  zion-edge-dao
  zion-edge-atomic-swap
  zion-edge-warp
  zion-edge-watchdog
  zion-edge-backup
)

echo "=== ZION Edge Multi-Node Setup ==="
echo "Date: $(date)"
echo ""

# ── Verify prerequisites ──
if [[ $EUID -ne 0 ]]; then
    echo "[ERROR] Must run as root (sudo)."
    exit 1
fi

if [[ ! -d "$REPO_ROOT" ]]; then
    echo "[ERROR] Repo root not found: $REPO_ROOT"
    echo "        Clone or rsync the repo first."
    exit 1
fi

# ── Build binaries if missing ──
BINS=(node server zion-bridge zion-dao zion-atomic-swap zion-warp-server)
for bin in "${BINS[@]}"; do
    if [[ ! -f "$REPO_ROOT/V3/target/release/$bin" ]]; then
        echo "[WARN] Binary '$bin' not found. Building now..."
        cd "$REPO_ROOT/V3" && cargo build --release --bin "$bin"
    fi
done

# ── Ensure environment file exists ──
if [[ ! -f "$ENV_FILE" ]]; then
    echo "[INFO] Creating environment file: $ENV_FILE"
    mkdir -p "$(dirname "$ENV_FILE")"
    cat > "$ENV_FILE" << 'ENVEOF'
# ZION Edge Server — Common Environment
# Updated: 2026-06-02 - Multi-node Edge topology (2 nodes + pool + all non-AI services)

# ── Canonical Fee Split Addresses (89/5/5/1 burn model — no pool fee wallet) ──
# NOTE: On Edge-Primary topology, ZION_MINER_ADDRESS MUST equal the pool
# wallet so the node credits block rewards directly to the pool payout wallet.
ZION_MINER_ADDRESS=zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604
ZION_HUMANITARIAN_WALLET=zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4
ZION_ISSOBELLA_WALLET=zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702
# Burn model: 1% pool fee is burned (never minted). Set to 0 so the pool
# does not double-deduct — the protocol burn happens in core coinbase.
ZION_POOL_FEE_PCT=0

# ── Pool Configuration (PRIMARY — accepts all miners) ──
ZION_POOL_BIND=0.0.0.0:8444
ZION_NODE_RPC_ADDR=127.0.0.1:8443
ZION_POOL_LOOP_COUNT=1000000
ZION_MAX_SESSIONS_PER_IP=10
ZION_NONCE_COUNT=4096
ZION_VARDIFF_START_DIFF=1
ZION_VARDIFF_MAX_DIFF=10000
ZION_PPLNS_WINDOW_SIZE=500000
ZION_ROUTING_METRICS_BIND=0.0.0.0:8455

# Pool wallet (Edge primary — handles all payouts)
ZION_POOL_WALLET=zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604
ZION_POOL_PAYOUT_SK_HEX=[REDACTED — pool SK removed for security]
ENVEOF
    echo "[WARN] Review $ENV_FILE — especially ZION_POOL_PAYOUT_SK_HEX!"
fi

# ── Create data directories ──
mkdir -p "$REPO_ROOT/data"

# ── Install systemd services + timers ──
echo "[INFO] Installing systemd services..."
for svc in "${SERVICES[@]}"; do
    src="$REPO_ROOT/edge-deploy/systemd/${svc}.service"
    if [[ -f "$src" ]]; then
        cp "$src" "$SERVICE_DIR/"
        echo "  + ${svc}.service"
    else
        echo "  - ${svc}.service (missing, skipped)"
    fi
    # Also copy timer if it exists (for backup, watchdog, etc.)
    timer_src="$REPO_ROOT/edge-deploy/systemd/${svc}.timer"
    if [[ -f "$timer_src" ]]; then
        cp "$timer_src" "$SERVICE_DIR/"
        echo "  + ${svc}.timer"
    fi
done

# ── Reload systemd ──
echo "[INFO] Reloading systemd daemon..."
systemctl daemon-reload

# ── Enable auto-start on boot ──
echo "[INFO] Enabling auto-start on boot..."
for svc in "${SERVICES[@]}"; do
    systemctl enable "${svc}.service" 2>/dev/null || echo "  ! ${svc}.service (not found)"
    # Enable timer if it exists
    if [[ -f "$SERVICE_DIR/${svc}.timer" ]]; then
        systemctl enable "${svc}.timer" 2>/dev/null || echo "  ! ${svc}.timer (not found)"
    fi
done

# ── (Optional) Logrotate for journal ──
if [[ ! -f "/etc/logrotate.d/zion-edge" ]]; then
    echo "[INFO] Installing logrotate config..."
    cat > /etc/logrotate.d/zion-edge << 'EOF'
/var/log/journal/zion-edge*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
EOF
fi

# ── Status ──
echo ""
echo "=== Setup Complete ==="
echo "Services installed:"
for svc in "${SERVICES[@]}"; do
    echo "  ${svc}.service"
done
echo ""
echo "To START now:"
echo "  systemctl start zion-edge-node1 zion-edge-node2 zion-edge-pool"
echo "  systemctl start zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp"
echo ""
echo "To CHECK status:"
echo "  systemctl status zion-edge-node1 zion-edge-node2 zion-edge-pool"
echo "  journalctl -u zion-edge-node1 -f"
echo ""
echo "To STOP:"
echo "  systemctl stop zion-edge-pool zion-edge-node2 zion-edge-node1"
echo ""
echo "Logs: /var/log/journal/ (journalctl)"
echo "Data: ${REPO_ROOT}/data/"
echo ""
