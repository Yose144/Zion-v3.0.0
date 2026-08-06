#!/usr/bin/env bash
# ZION V31 Edge Server — Full Stack Deployment
# Pushes latest V31 code to Edge (Contabo VPS) and restarts all services.
#
# Adapted from edge-deploy/deploy-edge.sh for V31:
#   - All /opt/zion/V3/ paths → /opt/zion/V31/
#   - Binary names: node → zion-node, server → zion-pool
#   - Service names: zion-v31-* for L1/L2, zion-edge-* for ops/dashboard
#
# Run from any machine with SSH access to Edge:
#   bash V31/deploy/deploy-edge.sh
#
# Prerequisites:
#   - Edge server reachable via SSH (62.171.141.136)
#   - SSH key at ~/.ssh/zion-edge-post-wipe-2026-07-29 (override with $ZION_EDGE_SSH_KEY)
#   - /etc/zion/edge-environment.sh exists on the Edge with real secrets
#
# Deploys:
#   - 2 P2P nodes (primary + follower) — zion-node binary
#   - Primary mining pool — zion-pool binary
#   - L2/L3 services (bridge, DAO, WARP) — unified multichain crate
#   - Next.js website (Docker)
#   - Agent, dashboards, and DEX router

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EDGE_USER="${ZION_EDGE_USER:-root}"
# zion-v6 is an ssh config alias for the Edge IPv6 address (port 2222).
EDGE_HOST="${ZION_EDGE_HOST:-zion-v6}"
SSH_KEY="${ZION_EDGE_SSH_KEY:-$HOME/.ssh/zion-edge-post-wipe-2026-07-29}"
REMOTE_ROOT="/opt/zion"
REMOTE_WEB="/opt/zion/website-v2.9"
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

SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o ServerAliveInterval=60 -o ServerAliveCountMax=10 -o TCPKeepAlive=yes"

# ── Step 0: Verify SSH and environment file ──
log "Verifying SSH access to Edge..."
if ! ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "echo 'SSH OK'" &>/dev/null; then
    err "Cannot SSH to Edge. Check key at ${SSH_KEY}"
fi

if ! ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "test -f /etc/zion/edge-environment.sh" &>/dev/null; then
    err "Missing /etc/zion/edge-environment.sh on Edge. Run V31/deploy/setup-edge.sh first."
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
            rsync -a '${REMOTE_ROOT}/V31/deploy/' '${BACKUP_PATH}/V31-deploy/' 2>/dev/null || true
            rsync -a '${REMOTE_ROOT}/V31/L1/core/config/' '${BACKUP_PATH}/core-config/' 2>/dev/null || true
            rsync -a '${REMOTE_ROOT}/V31/L1/miner/config/' '${BACKUP_PATH}/miner-config/' 2>/dev/null || true
            rsync -a '${REMOTE_ROOT}/V31/L1/pool/config/' '${BACKUP_PATH}/pool-config/' 2>/dev/null || true
            test -f /etc/zion/warp.toml && cp -a /etc/zion/warp.toml '${BACKUP_PATH}/warp.toml' 2>/dev/null || true
            rsync -a '${REMOTE_ROOT}/V31/L2/multichain/warp.example.toml' '${BACKUP_PATH}/warp.example.toml' 2>/dev/null || true
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
)

if command -v rsync &>/dev/null; then
    rsync -avz "${RSYNC_EXCLUDES[@]}" \
        -e "ssh ${SSH_OPTS}" \
        "${REPO_ROOT}/" \
        "${EDGE_USER}@${EDGE_HOST}:${REMOTE_ROOT}/"
else
    # Fallback: tar over ssh (slower, excludes some build artifacts)
    tar czf - \
        --exclude='.git' --exclude='data' --exclude='logs' --exclude='target' \
        --exclude='node_modules' --exclude='.next' --exclude='out' \
        -C "${REPO_ROOT}" \
        V31/ ZION_OS/ edge-deploy/ scripts/ 2>/dev/null | \
        ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "mkdir -p '${REMOTE_ROOT}' && cd '${REMOTE_ROOT}' && tar xzf -"
fi

# ── Step 2b: Ensure zion user, directories, and permissions ──
log "Running user setup on Edge..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    id -u zion >/dev/null 2>&1 || useradd --system --home-dir /opt/zion --create-home zion
    mkdir -p /opt/zion/data /opt/zion/logs /opt/zion/backups /var/log/zion /etc/zion /etc/zion/keys
    chmod 750 /opt/zion
    chmod 700 /etc/zion/keys
    chown -R zion:zion /opt/zion /var/log/zion /etc/zion
    ln -sfn /opt/zion/data /data/zion || true
"

# ── Step 3: Ensure /opt/zion ownership ──
# Website code is deployed separately via Docker in Step 9.
log "Fixing ownership of /opt/zion..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "chown -R zion:zion '${REMOTE_ROOT}'"

# ── Step 4: Upload environment config template (reference only) ──
# The live /etc/zion/edge-environment.sh is the single source of truth and
# must NEVER be overwritten by a template. The template below is for reference.
log "Uploading environment config template (reference only)..."
scp ${SSH_OPTS} "${REPO_ROOT}/V31/deploy/config/edge-environment.sh" \
    "${EDGE_USER}@${EDGE_HOST}:${REMOTE_ROOT}/V31/deploy/config/edge-environment.sh" 2>/dev/null || true

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

# ── Step 4b: Install WARP config if missing (never overwrite live config) ──
log "Checking WARP configuration..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    if [[ ! -f /etc/zion/warp.toml ]]; then
        cp -f '${REMOTE_ROOT}/V31/L2/multichain/warp.example.toml' /etc/zion/warp.toml
        chown zion:zion /etc/zion/warp.toml
        chmod 640 /etc/zion/warp.toml
        echo 'Installed /etc/zion/warp.toml from example — review and set real contract addresses before mainnet use.'
    fi
"

# Verify live warp.toml has real contract addresses (not placeholders)
LIVE_WARP_CHECK=$(ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    grep -cE 'placeholder|<SET_VIA_DEPLOYMENT>|zion1warp_vault_address' /etc/zion/warp.toml 2>/dev/null || true
" 2>/dev/null | tr -d '[:space:]')
if [[ "${LIVE_WARP_CHECK}" != "0" && -n "${LIVE_WARP_CHECK}" ]]; then
    warn "/etc/zion/warp.toml contains ${LIVE_WARP_CHECK} placeholder(s) — non-EVM relay will be disabled until real contract addresses are set."
fi

# ── Step 5: Rebuild binaries on Edge ──
log "Rebuilding V31 binaries on Edge..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    . /root/.cargo/env || . /opt/zion/.cargo/env
    cd '${REMOTE_ROOT}/V31'
    cargo build --release --bin zion-node --bin zion-pool --bin zion-miner --bin zion-universal-miner --bin zion-dao --bin zion-oasis --bin warpd 2>&1
"

# ── Step 5b: Stop standalone services and copy binaries to /usr/local/bin ──
# Stop first so cp -f does not hit "Text file busy" on a running executable.
log "Stopping standalone services before binary update..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    systemctl stop zion-edge-agent zion-edge-python-dashboard 2>/dev/null || true
"

log "Installing standalone binaries to /usr/local/bin..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    if [[ -f '${REMOTE_ROOT}/ZION_OS/agent/target/release/zion-agent' ]]; then
        cp -f '${REMOTE_ROOT}/ZION_OS/agent/target/release/zion-agent' /usr/local/bin/zion-agent
        chmod 755 /usr/local/bin/zion-agent
    fi
    if [[ -f '${REMOTE_ROOT}/ZION_OS/dashboard/infra/target/release/zionos-dashboard' ]]; then
        cp -f '${REMOTE_ROOT}/ZION_OS/dashboard/infra/target/release/zionos-dashboard' /usr/local/bin/zionos-dashboard
        chmod 755 /usr/local/bin/zionos-dashboard
    fi
"

# ── Step 6: Deploy website via Docker ──
log "Deploying website (Docker)..."
WEB_DEPLOY_SCRIPT="${REMOTE_ROOT}/APP&WEB/website-v2.9/scripts/deploy.sh"
if ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "test -x '${WEB_DEPLOY_SCRIPT}'" 2>/dev/null; then
    REMOTE_HOST="$EDGE_HOST" REMOTE_USER="$EDGE_USER" SSH_KEY="$SSH_KEY" \
        bash "$WEB_DEPLOY_SCRIPT" --remote-src "$REMOTE_WEB" --remote-compose "$REMOTE_WEB"
else
    warn "Website deploy script not found on Edge at ${WEB_DEPLOY_SCRIPT} — skipping web deploy (APP&WEB excluded from rsync)"
fi

# ── Step 7: Install systemd services and timers ──
log "Installing systemd services..."
SERVICES=(
    zion-v31-node
    zion-v31-pool
    zion-v31-multichain
    zion-v31-dao
    zion-v31-oasis
    zion-v31-miner
    zion-v31-watchdog
    zion-edge-backup
    zion-edge-maintenance
)

for svc in "${SERVICES[@]}"; do
    if [[ "$svc" == "zion-edge-agent" ]]; then
        ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} \
            "cp -f '${REMOTE_ROOT}/ZION_OS/agent/systemd/${svc}.service' /etc/systemd/system/"
    else
        ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} \
            "cp -f '${REMOTE_ROOT}/V31/deploy/systemd/${svc}.service' /etc/systemd/system/"
    fi
    # Copy timer if it exists
    if [[ -f "${REPO_ROOT}/V31/deploy/systemd/${svc}.timer" ]]; then
        scp ${SSH_OPTS} "${REPO_ROOT}/V31/deploy/systemd/${svc}.timer" \
            "${EDGE_USER}@${EDGE_HOST}:/etc/systemd/system/" 2>/dev/null || true
    fi
done

# ── Install systemd drop-ins (memory limits, OOM, maintenance overrides) ──
log "Installing systemd drop-ins..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    mkdir -p /etc/systemd/system/zion-v31-node.service.d
    mkdir -p /etc/systemd/system/zion-edge-python-dashboard.service.d
    mkdir -p /etc/systemd/system/docker.service.d
    cp -f '${REMOTE_ROOT}/V31/deploy/systemd/docker-ram-limits.conf'                /etc/systemd/system/docker.service.d/ram-limits.conf
"

# Cleanup old/duplicate service names
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} \
    "for old in zion-edge-node zion-edge-node1 zion-edge-node2 zion-edge-pool zion-edge-bridge zion-edge-dao zion-edge-warp zion-edge-miner zion-edge-dashboard zion-edge-dex; do systemctl disable \$old 2>/dev/null || true; systemctl reset-failed \$old 2>/dev/null || true; done"

ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl daemon-reload"

# ── Install/refresh logrotate, journald, rsyslog and cleanup automation ──
log "Installing log automation configs..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    mkdir -p /etc/systemd/journald.conf.d
    cp -f '${REMOTE_ROOT}/V31/deploy/systemd/journald-zion-limits.conf'   /etc/systemd/journald.conf.d/zion-limits.conf
    cp -f '${REMOTE_ROOT}/V31/deploy/systemd/logrotate-zion-pool.conf'    /etc/logrotate.d/zion-pool
    cp -f '${REMOTE_ROOT}/V31/deploy/systemd/sysctl-zion-ram.conf'        /etc/sysctl.d/99-zion-ram.conf
    systemctl restart systemd-journald
    systemctl daemon-reload
"

# ── Install fail2ban jail for P2P protection ──
log "Installing fail2ban P2P jail..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    cp -f '${REMOTE_ROOT}/V31/deploy/fail2ban/zion-p2p.conf'         /etc/fail2ban/jail.d/zion-p2p.conf
    cp -f '${REMOTE_ROOT}/V31/deploy/fail2ban/zion-p2p-filter.conf'  /etc/fail2ban/filter.d/zion-p2p.conf
    systemctl restart fail2ban 2>/dev/null || true
"

# ── Install nginx config ──
log "Installing nginx config..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    cp -f '${REMOTE_ROOT}/V31/deploy/nginx/zion-nginx.conf'  /etc/nginx/sites-available/zion-nginx.conf
    ln -sfn /etc/nginx/sites-available/zion-nginx.conf /etc/nginx/sites-enabled/zion-nginx.conf
    nginx -t 2>&1 && systemctl reload nginx 2>/dev/null || true
"

# Stop legacy zion-* and zion-edge-* services before starting the hardened
# zion-v31-* units to avoid port conflicts.
log "Stopping legacy zion-* and zion-edge-* services..."
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "
    systemctl disable --now \
        zion-node zion-node2 zion-pool zion-bridge zion-dao \
        zion-warp zion-dex zion-oasis zion-dashboard zion-watchdog.timer \
        zion-edge-node1 zion-edge-node2 zion-edge-pool zion-edge-bridge \
        zion-edge-dao zion-edge-warp zion-edge-miner zion-edge-dashboard \
        zion-edge-dex \
        2>/dev/null || true
    systemctl reset-failed zion-node zion-node2 zion-pool zion-bridge zion-dao \
        zion-warp zion-dex zion-oasis zion-dashboard zion-watchdog.timer \
        zion-edge-node1 zion-edge-node2 zion-edge-pool zion-edge-bridge \
        zion-edge-dao zion-edge-warp zion-edge-miner zion-edge-dashboard \
        zion-edge-dex \
        2>/dev/null || true
"

for svc in "${SERVICES[@]}"; do
    ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl enable ${svc}.service 2>/dev/null || true"
    if [[ -f "${REPO_ROOT}/V31/deploy/systemd/${svc}.timer" ]]; then
        ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl enable ${svc}.timer 2>/dev/null || true"
    fi
done

# ── Step 8: Restart services in order ──
log "Restarting Edge services..."

ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-v31-node"
sleep 3

ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-v31-pool"
sleep 3

ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-v31-multichain zion-v31-dao zion-v31-oasis || true"
sleep 3

ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-v31-miner || true"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-edge-agent || true"
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-edge-python-dashboard || true"

# Restart timers (will not start oneshot services, just activate timers)
ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl restart zion-v31-watchdog.timer zion-edge-backup.timer zion-edge-maintenance.timer || true"

# ── Step 9: Website already deployed via Docker in Step 6 ──
log "Verifying website container..."
WEB_CONTAINER=$(ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "docker ps -q -f name=zion-web" 2>/dev/null || true)
if [[ -n "$WEB_CONTAINER" ]]; then
    info "zion-web container is running"
else
    warn "zion-web container not detected after deploy"
fi

# ── Step 10: Wait and verify ──
log "Waiting for services to come up..."
sleep 10

echo ""
echo "=== Deployment Status ==="
for svc in zion-v31-node zion-v31-pool zion-v31-multichain zion-v31-dao zion-v31-oasis zion-v31-miner zion-edge-backup zion-edge-maintenance; do
    STATUS=$(ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "systemctl is-active ${svc}" 2>/dev/null || true)
    if [[ "$STATUS" == "active" ]]; then
        echo -e "${GREEN}  ${svc} : ACTIVE${NC}"
    else
        echo -e "${RED}  ${svc} : ${STATUS}${NC}"
    fi
done

WEB_STATUS=$(ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "curl -fsS http://127.0.0.1:3000/ >/dev/null 2>&1 && echo healthy" 2>/dev/null || true)
if [[ "$WEB_STATUS" == "healthy" ]]; then
    echo -e "${GREEN}  zion-website : HEALTHY (Docker)${NC}"
else
    echo -e "${RED}  zion-website : OFFLINE${NC}"
fi

# Dashboard health check
DASHBOARD_HEALTH=$(ssh ${SSH_OPTS} ${EDGE_USER}@${EDGE_HOST} "curl -s http://127.0.0.1:8766/health" 2>/dev/null || true)
if [[ "$DASHBOARD_HEALTH" == *"ok"* || "$DASHBOARD_HEALTH" == *"healthy"* ]]; then
    echo -e "${GREEN}  dashboard : HEALTHY (port 8766)${NC}"
else
    echo -e "${RED}  dashboard : NO RESPONSE${NC}"
fi

echo ""
log "=== Deployment Complete ==="
echo "Backup: ${BACKUP_PATH}"
echo ""
echo "Quick checks:"
echo "  ssh ${EDGE_USER}@${EDGE_HOST} 'curl -s http://127.0.0.1:9445/health'"
echo "  ssh ${EDGE_USER}@${EDGE_HOST} 'curl -s http://127.0.0.1:8080/metrics'"
echo "  ssh ${EDGE_USER}@${EDGE_HOST} 'curl -s http://127.0.0.1:8453/health'"
echo "  ssh ${EDGE_USER}@${EDGE_HOST} 'curl -s http://127.0.0.1:8766/health'"
echo ""
echo "Pool endpoint: ${EDGE_HOST}:8444"
echo "Website:       ${EDGE_HOST}:3000"
