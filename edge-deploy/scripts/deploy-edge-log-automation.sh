#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZION Edge Server — Deploy Log Automation
# File: edge-deploy/scripts/deploy-edge-log-automation.sh
#
# Run this script ON the Edge server to install:
#   1. logrotate config (/etc/logrotate.d/zion-edge)
#   2. journald limits (/etc/systemd/journald.conf.d/zion-edge.conf)
#   3. rsyslog RPC spam filter (/etc/rsyslog.d/10-zion-edge.conf)
#   4. cleanup script + systemd timer
#
# This script is SAFE:
#   - Backs up existing configs before overwriting
#   - Never deletes log data without rotation
#   - Restarts services gracefully
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

REPO_ROOT="/root/zion-2.9.6-main"
DEPLOY_DIR="${REPO_ROOT}/edge-deploy"
TIMESTAMP=$(date -u '+%Y%m%d%H%M%S')
BACKUP_DIR="/root/zion-backups/config-backup-${TIMESTAMP}"

echo "=== ZION Edge Log Automation Deploy ==="
echo "Backup dir: ${BACKUP_DIR}"
mkdir -p "$BACKUP_DIR"

# ── 1. Backup existing configs ────────────────────────────────────────────────
for f in /etc/logrotate.d/zion-edge /etc/systemd/journald.conf.d/zion-edge.conf /etc/rsyslog.d/10-zion-edge.conf /usr/local/bin/edge-log-cleanup.sh /etc/systemd/system/edge-log-cleanup.service /etc/systemd/system/edge-log-cleanup.timer; do
    if [ -f "$f" ]; then
        cp "$f" "${BACKUP_DIR}/$(basename $f).bak"
        echo "  Backed up: $f"
    fi
done

# ── 2. Install logrotate config ───────────────────────────────────────────────
echo "Installing logrotate config..."
cp "${DEPLOY_DIR}/config/logrotate-zion-edge" /etc/logrotate.d/zion-edge
chmod 644 /etc/logrotate.d/zion-edge

# ── 3. Install journald limits ────────────────────────────────────────────────
echo "Installing journald limits..."
mkdir -p /etc/systemd/journald.conf.d
cp "${DEPLOY_DIR}/config/journald-zion-edge.conf" /etc/systemd/journald.conf.d/zion-edge.conf
chmod 644 /etc/systemd/journald.conf.d/zion-edge.conf

# ── 4. Install rsyslog RPC spam filter ────────────────────────────────────────
echo "Installing rsyslog RPC spam filter..."
cp "${DEPLOY_DIR}/config/rsyslog-zion-edge.conf" /etc/rsyslog.d/10-zion-edge.conf
chmod 644 /etc/rsyslog.d/10-zion-edge.conf

# ── 5. Install cleanup script ─────────────────────────────────────────────────
echo "Installing cleanup script..."
cp "${DEPLOY_DIR}/scripts/edge-log-cleanup.sh" /usr/local/bin/edge-log-cleanup.sh
chmod +x /usr/local/bin/edge-log-cleanup.sh

# ── 6. Install systemd timer ──────────────────────────────────────────────────
echo "Installing systemd timer..."
cp "${DEPLOY_DIR}/config/edge-log-cleanup.service" /etc/systemd/system/edge-log-cleanup.service
cp "${DEPLOY_DIR}/config/edge-log-cleanup.timer" /etc/systemd/system/edge-log-cleanup.timer
chmod 644 /etc/systemd/system/edge-log-cleanup.service /etc/systemd/system/edge-log-cleanup.timer

# ── 7. Reload systemd and restart services ────────────────────────────────────
echo "Reloading systemd..."
systemctl daemon-reload

echo "Enabling timer..."
systemctl enable edge-log-cleanup.timer
systemctl start edge-log-cleanup.timer

echo "Restarting journald..."
systemctl restart systemd-journald

echo "Restarting rsyslog..."
systemctl restart rsyslog

# ── 8. Run initial cleanup ────────────────────────────────────────────────────
echo "Running initial cleanup..."
/usr/local/bin/edge-log-cleanup.sh || true

# ── 9. Verify ─────────────────────────────────────────────────────────────────
echo ""
echo "=== Verification ==="
echo "Timer status:"
systemctl status edge-log-cleanup.timer --no-pager 2>/dev/null | head -5
echo ""
echo "Disk usage:"
df -h /
echo ""
echo "Journal size:"
journalctl --disk-usage 2>/dev/null
echo ""
echo "Syslog size:"
du -sh /var/log/syslog 2>/dev/null
echo ""
echo "=== Deploy complete ==="
echo "Timer runs every 6 hours. Logrotate runs daily."
echo "Backup of old configs: ${BACKUP_DIR}"
