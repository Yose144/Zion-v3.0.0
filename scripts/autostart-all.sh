#!/usr/bin/env bash
# ZION V3 — Autostart ALL services (core + L2/L3 + dashboard)
# Called by systemd user service on login/boot
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ZION autostart — launching full stack..." >> "$LOG_DIR/autostart.log"

# 0. Stop any existing ZION processes first to avoid duplicates
bash "$REPO_ROOT/scripts/stop-stack.sh" >> "$LOG_DIR/autostart.log" 2>&1 || true
sleep 1

# 1. SSH tunnel to Edge (must be up before L2/L3 services start)
#    Note: backup node is started by systemd zion-backup-node.service.
bash "$REPO_ROOT/scripts/start-ssh-tunnel.sh" >> "$LOG_DIR/autostart.log" 2>&1
sleep 3

# 2. L2 services (best-effort)
bash "$REPO_ROOT/scripts/start-bridge.sh" >> "$LOG_DIR/autostart.log" 2>&1 &
bash "$REPO_ROOT/scripts/start-dao.sh" >> "$LOG_DIR/autostart.log" 2>&1 &
bash "$REPO_ROOT/scripts/start-atomic-swap.sh" >> "$LOG_DIR/autostart.log" 2>&1 &
bash "$REPO_ROOT/scripts/start-warp.sh" >> "$LOG_DIR/autostart.log" 2>&1 &

# 3. L3 services (best-effort)
bash "$REPO_ROOT/scripts/start-oasis.sh" >> "$LOG_DIR/autostart.log" 2>&1 &
bash "$REPO_ROOT/scripts/start-space.sh" >> "$LOG_DIR/autostart.log" 2>&1 &
bash "$REPO_ROOT/scripts/start-humanitarian.sh" >> "$LOG_DIR/autostart.log" 2>&1 &
bash "$REPO_ROOT/scripts/start-hiranyagarbha.sh" >> "$LOG_DIR/autostart.log" 2>&1 &

# 4. Hiran inference (may take time, best-effort)
bash "$REPO_ROOT/scripts/start-hiran-inference.sh" >> "$LOG_DIR/autostart.log" 2>&1 &

# 5. Dashboard (handled by separate zion-dashboard service, but ensure it's up)
# systemctl --user start zion-dashboard 2>/dev/null || true

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Autostart complete — core running, L2/L3 launching in background." >> "$LOG_DIR/autostart.log"
