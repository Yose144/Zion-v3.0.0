#!/usr/bin/env bash
# ZION Edge Server — One-Time Setup (run directly on Edge server as root)
# Sets up systemd services so Edge runs autonomously 24/7.

set -euo pipefail

REPO_ROOT="/root/zion-2.9.6-main"
SERVICE_DIR="/etc/systemd/system"
ENV_FILE="${REPO_ROOT}/edge-environment.sh"

echo "=== ZION Edge Primary Setup ==="
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

if [[ ! -f "$REPO_ROOT/V3/target/release/node" ]]; then
    echo "[WARN] Node binary not found. Building now..."
    cd "$REPO_ROOT/V3" && cargo build --release --bin node
fi

if [[ ! -f "$REPO_ROOT/V3/target/release/server" ]]; then
    echo "[WARN] Pool binary not found. Building now..."
    cd "$REPO_ROOT/V3" && cargo build --release --bin server
fi

# ── Create environment file from template ──
if [[ ! -f "$ENV_FILE" ]]; then
    echo "[INFO] Creating environment file: $ENV_FILE"
    cp "$REPO_ROOT/edge-deploy/config/edge-environment.sh" "$ENV_FILE"
    echo "[WARN] Review $ENV_FILE — especially ZION_POOL_PAYOUT_SK_HEX!"
fi

# ── Install systemd services ──
echo "[INFO] Installing systemd services..."
cp "$REPO_ROOT/edge-deploy/systemd/zion-edge-node.service" "$SERVICE_DIR/"
cp "$REPO_ROOT/edge-deploy/systemd/zion-edge-pool.service" "$SERVICE_DIR/"

# ── Reload systemd ──
echo "[INFO] Reloading systemd daemon..."
systemctl daemon-reload

# ── Enable auto-start on boot ──
echo "[INFO] Enabling auto-start on boot..."
systemctl enable zion-edge-node.service
systemctl enable zion-edge-pool.service

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
echo "  zion-edge-node.service  — primary chain node"
echo "  zion-edge-pool.service  — primary mining pool"
echo ""
echo "To START now:"
echo "  systemctl start zion-edge-node zion-edge-pool"
echo ""
echo "To CHECK status:"
echo "  systemctl status zion-edge-node zion-edge-pool"
echo "  journalctl -u zion-edge-node -f"
echo "  journalctl -u zion-edge-pool -f"
echo ""
echo "To STOP:"
echo "  systemctl stop zion-edge-pool zion-edge-node"
echo ""
echo "Logs: /var/log/journal/ (journalctl)"
echo "Data: ${REPO_ROOT}/data/"
echo ""
