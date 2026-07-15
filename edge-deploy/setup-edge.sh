#!/usr/bin/env bash
# ZION Edge Server — Multi-Node Setup (run directly on Edge server as root)
# Sets up systemd services so Edge runs autonomously 24/7 with:
#   - 2 P2P nodes (primary + follower)
#   - Primary mining pool
#   - All L2/L3 non-AI services (bridge, DAO, atomic-swap, WARP)
#
# This script creates the dedicated zion user, prepares /opt/zion and
# /etc/zion/edge-environment.sh, and installs + enables systemd services.

set -euo pipefail

REPO_ROOT="/opt/zion"
SERVICE_DIR="/etc/systemd/system"
TEMPLATE_ENV="${REPO_ROOT}/edge-deploy/config/edge-environment.sh"
LIVE_ENV="/etc/zion/edge-environment.sh"

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
  zion-edge-miner
  zion-edge-agent
  zion-edge-dashboard
  zion-edge-dex
  zion-edge-python-dashboard
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
    echo "        Clone or rsync the repo to /opt/zion first."
    exit 1
fi

# ── Create zion user, data dirs, and /data/zion symlink ──
ZION_USER="zion"
ZION_GROUP="zion"
if ! id -u "${ZION_USER}" >/dev/null 2>&1; then
    echo "[INFO] Creating system user ${ZION_USER}..."
    useradd --system --home-dir /opt/zion --create-home "${ZION_USER}"
fi
if getent group docker >/dev/null 2>&1; then
    usermod -aG docker "${ZION_USER}"
fi

mkdir -p /opt/zion/data /opt/zion/logs /opt/zion/backups /var/log/zion /etc/zion /etc/zion/keys
chmod 750 /opt/zion
chmod 700 /etc/zion/keys
chown -R "${ZION_USER}:${ZION_GROUP}" /opt/zion
chown -R "${ZION_USER}:${ZION_GROUP}" /var/log/zion
chown -R "${ZION_USER}:${ZION_GROUP}" /etc/zion

# Re-create the symlink /data/zion -> /opt/zion/data for compatibility
if [[ -L /data/zion ]]; then
    rm /data/zion
fi
ln -sfn /opt/zion/data /data/zion || echo "[WARN] Could not create /data/zion symlink"

# ── Ensure live environment file exists (never overwrite) ──
if [[ ! -f "$LIVE_ENV" ]]; then
    echo "[INFO] Creating ${LIVE_ENV} from template..."
    if [[ -f "$TEMPLATE_ENV" ]]; then
        cp "$TEMPLATE_ENV" "$LIVE_ENV"
        chmod 640 "$LIVE_ENV"
        chown "${ZION_USER}:${ZION_GROUP}" "$LIVE_ENV"
    else
        echo "[ERROR] Template env not found: $TEMPLATE_ENV"
        exit 1
    fi
    echo "[WARN] Review ${LIVE_ENV} and replace all <SET_VIA_...> placeholders before starting services!"
else
    echo "[INFO] ${LIVE_ENV} already exists; not overwriting."
fi

# ── Build binaries if missing ──
BINS=(node server zion-bridge zion-dao zion-atomic-swap zion-warp-server zion-miner)
for bin in "${BINS[@]}"; do
    if [[ ! -f "$REPO_ROOT/V3/target/release/$bin" ]]; then
        echo "[WARN] Binary '$bin' not found. Building now..."
        cd "$REPO_ROOT/V3" && cargo build --release --bin "$bin"
    fi
done

# Build standalone binaries if missing
if [[ ! -f "$REPO_ROOT/ZION_OS/agent/target/release/zion-agent" ]]; then
    echo "[WARN] zion-agent not found. Building now..."
    cd "$REPO_ROOT/ZION_OS/agent" && cargo build --release
fi
if [[ ! -f "$REPO_ROOT/ZION_OS/dashboard/infra/target/release/zionos-dashboard" ]]; then
    echo "[WARN] zionos-dashboard not found. Building now..."
    cd "$REPO_ROOT/ZION_OS/dashboard/infra" && cargo build --release
fi
if [[ ! -f "$REPO_ROOT/ZionDex/router/target/release/ziondex-router" ]]; then
    echo "[WARN] ziondex-router not found. Building now..."
    cd "$REPO_ROOT/ZionDex/router" && cargo build --release
fi

# ── Install standalone binaries to /usr/local/bin ──
cp -f "$REPO_ROOT/ZION_OS/agent/target/release/zion-agent" /usr/local/bin/zion-agent
cp -f "$REPO_ROOT/ZION_OS/dashboard/infra/target/release/zionos-dashboard" /usr/local/bin/zionos-dashboard
cp -f "$REPO_ROOT/ZionDex/router/target/release/ziondex-router" /usr/local/bin/ziondex-router
chmod 755 /usr/local/bin/zion-agent /usr/local/bin/zionos-dashboard /usr/local/bin/ziondex-router

# ── Install systemd services + timers ──
echo "[INFO] Installing systemd services..."
for svc in "${SERVICES[@]}"; do
    if [[ "$svc" == "zion-edge-agent" ]]; then
        src="$REPO_ROOT/ZION_OS/agent/systemd/${svc}.service"
    else
        src="$REPO_ROOT/edge-deploy/systemd/${svc}.service"
    fi
    if [[ -f "$src" ]]; then
        cp "$src" "$SERVICE_DIR/"
        echo "  + ${svc}.service"
    else
        echo "  - ${svc}.service (missing, skipped)"
    fi
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
echo "IMPORTANT:"
echo "  1. Replace all <SET_VIA_...> placeholders in ${LIVE_ENV}."
echo "  2. Start services:"
echo "       systemctl start zion-edge-node1 zion-edge-node2 zion-edge-pool"
echo "       systemctl start zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp"
echo "       systemctl start zion-edge-miner zion-edge-agent zion-edge-dashboard zion-edge-dex zion-edge-python-dashboard"
echo "       systemctl start zion-edge-watchdog.timer zion-edge-backup.timer"
echo ""
echo "  3. Check status:"
echo "       systemctl status zion-edge-node1 zion-edge-node2 zion-edge-pool"
echo "       journalctl -u zion-edge-node1 -f"
echo ""
echo "Logs: /var/log/journal/ (journalctl)"
echo "Data: /opt/zion/data/"
