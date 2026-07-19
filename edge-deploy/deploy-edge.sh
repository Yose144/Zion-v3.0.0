#!/usr/bin/env bash
# ZION Edge Server — Full Stack Deployment
# Pushes latest code to Edge (Hetzner) and restarts all services.
#
# Run from any machine with SSH access to Edge:
#   bash edge-deploy/deploy-edge.sh
#
# Prerequisites:
#   - Edge server reachable via SSH (62.171.141.136)
#   - SSH key at ../ssh-key-zion-edge
#   - /etc/zion/edge-environment.sh exists on the Edge with real secrets
#
# Deploys:
#   - 2 P2P nodes (primary + follower)
#   - Primary mining pool
#   - L2/L3 services (bridge, DAO, atomic-swap, WARP)
#   - Next.js website (PM2)
#   - Agent, dashboards, and DEX router

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EDGE_USER="root"
EDGE_HOST="62.171.141.136"
SSH_KEY="${REPO_ROOT}/ssh-key-zion-edge"
REMOTE_ROOT="/opt/zion"
REMOTE_WEB="${REMOTE_ROOT}/APP&WEB/website-v2.9"
BACKUP_PATH="${REMOTE_ROOT}/backups/deploy-backup-$(date +%Y%m%d-%H%M%S)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
info() { echo -e "${CYAN}[info]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err()  { echo -e "${RED}[err]${NC} $*"; exit 1; }

SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

# ── Step 0: Verify SSH and environment file ──
log "Verifying SSH access to Edge..."
if ! ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "echo 'SSH OK'" &>/dev/null; then
    err "Cannot SSH to Edge. Check key at ${SSH_KEY}"
fi

if ! ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "test -f /etc/zion/edge-environment.sh" &>/dev/null; then
    err "Missing /etc/zion/edge-environment.sh on Edge. Run edge-deploy/setup-edge.sh first."
fi

# ── Step 1: Backup current installation (excluding runtime state) ──
if ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "test -d '${REMOTE_ROOT}'" 2>/dev/null; then
    log "Backing up current installation to ${BACKUP_PATH}..."
    ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
        # Clean up old deploy backups (keep only the most recent 2)
        ls -dt '${REMOTE_ROOT}/backups/'deploy-backup-* 2>/dev/null | tail -n +3 | xargs rm -rf 2>/dev/null || true
        mkdir -p '${BACKUP_PATH}'
        # Only back up critical config + systemd files, not the entire repo
        # (full repo backups fill the disk — repo is in git anyway)
        if command -v rsync >/dev/null 2>&1; then
            rsync -a '${REMOTE_ROOT}/edge-deploy/' '${BACKUP_PATH}/edge-deploy/' 2>/dev/null || true
            rsync -a '${REMOTE_ROOT}/V3/L2/bridge/config/' '${BACKUP_PATH}/bridge-config/' 2>/dev/null || true
            rsync -a '${REMOTE_ROOT}/V3/L2/dao/config/' '${BACKUP_PATH}/dao-config/' 2>/dev/null || true
            rsync -a '${REMOTE_ROOT}/V3/L2/atomic-swap/config/' '${BACKUP_PATH}/swap-config/' 2>/dev/null || true
            rsync -a '${REMOTE_ROOT}/V3/L3/warp/config/' '${BACKUP_PATH}/warp-config/' 2>/dev/null || true
        fi
    " 2>/dev/null || warn "Backup step failed (continuing anyway)"
else
    log "No existing installation at ${REMOTE_ROOT}; skipping backup."
fi

# ── Step 2: Sync code to /opt/zion ──
log "Syncing repository to Edge (${REMOTE_ROOT})..."
RSYNC_EXCLUDES=(
    '--exclude=.git'
    '--exclude=/data'
    '--exclude=logs'
    '--exclude=target'
    '--exclude=node_modules'
    '--exclude=.next'
    '--exclude=out'
    '--exclude=/public'
    '--exclude=/HiranV2.1'
    '--exclude=/HiranV2.2'
    '--exclude=/HiranV2.4'
    '--exclude=/PoC-lab'
    '--exclude=/ZionStart'
    '--exclude=/archive'
    '--exclude=/update-server'
    '--exclude=/zion-miner-smos'
    '--exclude=/APP&WEB'
    '--exclude=/config'
    '--exclude=/V3/config'
)

if command -v rsync &>/dev/null; then
    rsync -avz "${RSYNC_EXCLUDES[@]}" \
        -e "ssh ${SSH_OPTS}" \
        "${REPO_ROOT}/" \
        "${EDGE_USER}@${EDGE_HOST}:${REMOTE_ROOT}/"
else
    # Fallback: tar over ssh (slower, excludes some build artifacts)
    # NOTE: V3/config contains stale templates; live L2 configs are in V3/L2/*/config.
    tar czf - \
        --exclude='.git' --exclude='data' --exclude='logs' --exclude='target' \
        --exclude='node_modules' --exclude='.next' --exclude='out' \
        --exclude='V3/config' \
        -C "${REPO_ROOT}" \
        V3/ ZION_OS/ ZionDex/ edge-deploy/ scripts/ 2>/dev/null | \
        ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "mkdir -p '${REMOTE_ROOT}' && cd '${REMOTE_ROOT}' && tar xzf -"
fi

# ── Step 2b: Ensure zion user, directories, and permissions ──
log "Running migration/user setup on Edge..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    if [[ -f '${REMOTE_ROOT}/edge-deploy/scripts/migrate-to-zion-user.sh' ]]; then
        bash '${REMOTE_ROOT}/edge-deploy/scripts/migrate-to-zion-user.sh'
    else
        id -u zion >/dev/null 2>&1 || useradd --system --home-dir /opt/zion --create-home zion
        mkdir -p /opt/zion/data /opt/zion/logs /opt/zion/backups /var/log/zion /etc/zion /etc/zion/keys
        chmod 750 /opt/zion
        chmod 700 /etc/zion/keys
        chown -R zion:zion /opt/zion /var/log/zion /etc/zion
        ln -sfn /opt/zion/data /data/zion || true
    fi
"

# ── Step 3: Sync website code ──
log "Syncing website code..."
# NOTE: The path contains '&' which breaks rsync on macOS (v2.x lacks --protect-args).
# Using tar over SSH avoids shell interpretation issues with special characters.
tar czf - \
    --exclude='node_modules' --exclude='.next' --exclude='out' \
    -C "${REPO_ROOT}/APP&WEB" website-v2.9/ 2>/dev/null | \
    ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} \
    "mkdir -p '${REMOTE_ROOT}/APP&WEB' && cd '${REMOTE_ROOT}/APP&WEB' && tar xzf -"

# Ensure all files in /opt/zion are owned by zion after sync
log "Fixing ownership of /opt/zion..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "chown -R zion:zion '${REMOTE_ROOT}'"

# ── Step 4: Upload environment config template (reference only) ──
# The live /etc/zion/edge-environment.sh is the single source of truth and
# must NEVER be overwritten by a template. The template below is for reference.
log "Uploading environment config template (reference only)..."
scp ${SSH_OPTS} "${REPO_ROOT}/edge-deploy/config/edge-environment.sh" \
    "${EDGE_USER}@${EDGE_HOST}:${REMOTE_ROOT}/edge-deploy/config/edge-environment.sh" 2>/dev/null || true

# Verify live env file has real secrets (not placeholders)
LIVE_ENV_CHECK=$(ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    grep -c 'SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT' /etc/zion/edge-environment.sh 2>/dev/null || true
" 2>/dev/null | tr -d '[:space:]')
if [[ "${LIVE_ENV_CHECK}" != "0" && -n "${LIVE_ENV_CHECK}" ]]; then
    err "LIVE env /etc/zion/edge-environment.sh contains ${LIVE_ENV_CHECK} placeholder(s)!
        Pool payouts, atomic swap, dashboard auth, and/or DAO auth are BROKEN.
        Restore real secrets from backup before continuing:
        ssh ${EDGE_USER}@${EDGE_HOST} 'ls -la /etc/zion/edge-environment.sh.bak-*'
        Aborting deploy to prevent data loss."
fi
log "Live env file verified: no placeholders detected."

# ── Step 5: Rebuild binaries on Edge ──
log "Rebuilding V3 binaries on Edge..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    . /root/.cargo/env || . /opt/zion/.cargo/env
    cd '${REMOTE_ROOT}/V3'
    # Free-world / issobella / ai-native / native-ffi are not part of the Edge build set
    if [ ! -d L5/free-world ]; then
        sed -i '/\"L5\/free-world\",/d;/\"L6\/issobella\",/d;/\"L4\/oasis\",/d' Cargo.toml 2>/dev/null || true
        sed -i '/\"L1\/native-ffi\",/d' Cargo.toml 2>/dev/null || true
        sed -i '/\"L3\/ai-native\",/d' Cargo.toml 2>/dev/null || true
    fi
    cargo build --release --bin node --bin server --bin zion-bridge --bin zion-dao --bin zion-atomic-swap --bin zion-warp-server --bin zion-miner --bin zion-oasis 2>&1
    # Build agent
    cd '${REMOTE_ROOT}/ZION_OS/agent'
    cargo build --release 2>&1
    # Build dashboard
    cd '${REMOTE_ROOT}/ZION_OS/dashboard/infra'
    cargo build --release 2>&1
    # Build DEX router
    cd '${REMOTE_ROOT}/ZionDex/router'
    cargo build --release 2>&1
"

# ── Step 5b: Stop standalone services and copy binaries to /usr/local/bin ──
# Stop first so cp -f does not hit "Text file busy" on a running executable.
log "Stopping standalone services before binary update..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    systemctl stop zion-edge-agent zion-edge-dashboard zion-edge-dex 2>/dev/null || true
"

log "Installing standalone binaries to /usr/local/bin..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    cp -f '${REMOTE_ROOT}/ZION_OS/agent/target/release/zion-agent' /usr/local/bin/zion-agent
    cp -f '${REMOTE_ROOT}/ZION_OS/dashboard/infra/target/release/zionos-dashboard' /usr/local/bin/zionos-dashboard
    cp -f '${REMOTE_ROOT}/ZionDex/router/target/release/ziondex-router' /usr/local/bin/ziondex-router
    chmod 755 /usr/local/bin/zion-agent /usr/local/bin/zionos-dashboard /usr/local/bin/ziondex-router
"

# ── Step 6: Rebuild website on Edge ──
log "Rebuilding website on Edge..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    set -euo pipefail
    cd '${REMOTE_WEB}'
    rm -f package-lock.json
    npm install 2>&1 | tail -n 5
    npm run build 2>&1 | tail -n 20
"

# ── Step 7: Install systemd services and timers ──
log "Installing systemd services..."
SERVICES=(
    zion-edge-node1
    zion-edge-node2
    zion-edge-pool
    zion-edge-bridge
    zion-edge-dao
    zion-edge-atomic-swap
    zion-edge-warp
    zion-edge-oasis
    zion-edge-watchdog
    zion-edge-backup
    zion-edge-maintenance
    zion-edge-miner
    zion-edge-agent
    zion-edge-dashboard
    zion-edge-dex
    zion-edge-python-dashboard
)

for svc in "${SERVICES[@]}"; do
    if [[ "$svc" == "zion-edge-agent" ]]; then
        ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} \
            "cp -f '${REMOTE_ROOT}/ZION_OS/agent/systemd/${svc}.service' /etc/systemd/system/"
    else
        ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} \
            "cp -f '${REMOTE_ROOT}/edge-deploy/systemd/${svc}.service' /etc/systemd/system/"
    fi
    # Copy timer if it exists
    if [[ -f "${REPO_ROOT}/edge-deploy/systemd/${svc}.timer" ]]; then
        scp ${SSH_OPTS} "${REPO_ROOT}/edge-deploy/systemd/${svc}.timer" \
            "${EDGE_USER}@${EDGE_HOST}:/etc/systemd/system/" 2>/dev/null || true
    fi
done

# ── Install systemd drop-ins (memory limits, OOM, maintenance overrides) ──
log "Installing systemd drop-ins..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    mkdir -p /etc/systemd/system/zion-edge-node1.service.d
    mkdir -p /etc/systemd/system/zion-edge-node2.service.d
    mkdir -p /etc/systemd/system/zion-edge-python-dashboard.service.d
    mkdir -p /etc/systemd/system/docker.service.d
    cp -f '${REMOTE_ROOT}/edge-deploy/systemd/zion-edge-node1-ram-limits.conf'       /etc/systemd/system/zion-edge-node1.service.d/ram-limits.conf
    cp -f '${REMOTE_ROOT}/edge-deploy/systemd/zion-edge-node2-ram-limits.conf'       /etc/systemd/system/zion-edge-node2.service.d/ram-limits.conf
    cp -f '${REMOTE_ROOT}/edge-deploy/systemd/zion-edge-dashboard-maintenance.conf'  /etc/systemd/system/zion-edge-python-dashboard.service.d/maintenance.conf
    cp -f '${REMOTE_ROOT}/edge-deploy/systemd/docker-ram-limits.conf'                /etc/systemd/system/docker.service.d/ram-limits.conf
"

# Cleanup old/duplicate service name
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} \
    "systemctl disable zion-edge-node 2>/dev/null || true; systemctl reset-failed zion-edge-node 2>/dev/null || true"

ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl daemon-reload"

# ── Install/refresh logrotate, journald, rsyslog and cleanup automation ──
log "Installing log automation configs..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    cp -f '${REMOTE_ROOT}/edge-deploy/config/logrotate-zion-edge'      /etc/logrotate.d/zion-edge
    mkdir -p /etc/systemd/journald.conf.d
    cp -f '${REMOTE_ROOT}/edge-deploy/config/journald-zion-edge.conf'   /etc/systemd/journald.conf.d/zion-edge.conf
    cp -f '${REMOTE_ROOT}/edge-deploy/config/rsyslog-zion-edge.conf'  /etc/rsyslog.d/10-zion-edge.conf
    cp -f '${REMOTE_ROOT}/edge-deploy/scripts/edge-log-cleanup.sh'    /usr/local/bin/edge-log-cleanup.sh
    chmod +x /usr/local/bin/edge-log-cleanup.sh
    cp -f '${REMOTE_ROOT}/edge-deploy/config/edge-log-cleanup.service' /etc/systemd/system/edge-log-cleanup.service
    cp -f '${REMOTE_ROOT}/edge-deploy/config/edge-log-cleanup.timer'  /etc/systemd/system/edge-log-cleanup.timer
    systemctl restart systemd-journald rsyslog
    systemctl daemon-reload
    systemctl enable --now edge-log-cleanup.timer
"

# Stop legacy zion-* services before starting the hardened zion-edge-* units
# to avoid port conflicts (e.g. zion-node :8443 vs nginx :8443).
log "Stopping legacy zion-* services..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    systemctl disable --now \
        zion-node zion-node2 zion-pool zion-bridge zion-dao \
        zion-atomic-swap zion-warp zion-dex zion-oasis \
        zion-dashboard zion-watchdog.timer \
        2>/dev/null || true
    systemctl reset-failed zion-node zion-node2 zion-pool zion-bridge zion-dao \
        zion-atomic-swap zion-warp zion-dex zion-oasis zion-dashboard \
        zion-watchdog.timer \
        2>/dev/null || true
"

for svc in "${SERVICES[@]}"; do
    ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl enable ${svc}.service 2>/dev/null || true"
    if [[ -f "${REPO_ROOT}/edge-deploy/systemd/${svc}.timer" ]]; then
        ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl enable ${svc}.timer 2>/dev/null || true"
    fi
done

# ── Step 8: Restart services in order ──
log "Restarting Edge services..."

ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-edge-node1"
sleep 3

ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-edge-node2"
sleep 3

ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-edge-pool"
sleep 3

ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp zion-edge-oasis || true"

ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-edge-miner || true"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-edge-agent || true"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-edge-dashboard zion-edge-dex zion-edge-python-dashboard || true"

# Restart timers (will not start oneshot services, just activate timers)
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-edge-watchdog.timer zion-edge-backup.timer zion-edge-maintenance.timer || true"

# ── Step 9: Restart website (PM2) ──
log "Restarting website (PM2)..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "pm2 restart zion-website 2>/dev/null || pm2 start '${REMOTE_WEB}/node_modules/next/dist/bin/next' --name zion-website -- start 2>/dev/null || true"

# ── Step 10: Wait and verify ──
log "Waiting for services to come up..."
sleep 10

echo ""
echo "=== Deployment Status ==="
for svc in zion-edge-node1 zion-edge-node2 zion-edge-pool zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp zion-edge-oasis zion-edge-miner zion-edge-agent zion-edge-dashboard zion-edge-dex zion-edge-python-dashboard; do
    STATUS=$(ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl is-active ${svc}" 2>/dev/null || true)
    if [[ "$STATUS" == "active" ]]; then
        echo -e "${GREEN}  ${svc} : ACTIVE${NC}"
    else
        echo -e "${RED}  ${svc} : ${STATUS}${NC}"
    fi
done

WEB_STATUS=$(ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "pm2 show zion-website 2>/dev/null | grep status" || true)
if echo "$WEB_STATUS" | grep -q "online"; then
    echo -e "${GREEN}  zion-website : ONLINE (PM2)${NC}"
else
    echo -e "${RED}  zion-website : OFFLINE${NC}"
fi

# Agent health check
AGENT_HEALTH=$(ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "curl -s http://127.0.0.1:8767/health" 2>/dev/null || true)
if [[ "$AGENT_HEALTH" == "OK" ]]; then
    echo -e "${GREEN}  zion-agent : HEALTHY (port 8767)${NC}"
else
    echo -e "${RED}  zion-agent : NO RESPONSE${NC}"
fi

echo ""
log "=== Deployment Complete ==="
echo "Backup: ${BACKUP_PATH}"
echo ""
echo "Quick checks:"
echo "  ssh ${EDGE_USER}@${EDGE_HOST} 'curl -s http://127.0.0.1:8443/health'"
echo "  ssh ${EDGE_USER}@${EDGE_HOST} 'curl -s http://127.0.0.1:8450/health'"
echo "  ssh ${EDGE_USER}@${EDGE_HOST} 'curl -s http://127.0.0.1:8453/health'"
echo ""
echo "Pool endpoint: ${EDGE_HOST}:8444"
echo "Website:       ${EDGE_HOST}:3000"
