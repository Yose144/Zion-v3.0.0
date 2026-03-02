#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# ZION 2.9.6 — Deploy Pool + Core to Helsinki (TreeofLife)
#
# Rsyncs latest source and rebuilds/restarts pool + core.
# Use this after any Rust changes to L1/ (pool/core/cosmic-harmony).
#
# Usage:
#   bash scripts/deploy-pool-core.sh
#   bash scripts/deploy-pool-core.sh --no-rebuild   # restart only
#   bash scripts/deploy-pool-core.sh --core-only    # only core
#   bash scripts/deploy-pool-core.sh --pool-only    # only pool
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SSH_KEY="${SSH_KEY:-$HOME/.ssh/zion_hetzner_key}"
DEPLOY_USER="${DEPLOY_USER:-root}"
HELSINKI="77.42.31.72"
DEPLOY_DIR="/root/zion-2.9.6"
COMPOSE_FILE="docker/docker-compose.testnet.yml"
LOCAL_SRC="$(cd "$(dirname "$0")/.." && pwd)"

# Parse flags
DO_REBUILD=1
DO_CORE=1
DO_POOL=1
for arg in "$@"; do
    case "$arg" in
        --no-rebuild) DO_REBUILD=0 ;;
        --core-only)  DO_POOL=0 ;;
        --pool-only)  DO_CORE=0 ;;
    esac
done

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }

ssh_run() {
    ssh -i "$SSH_KEY" -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new \
        "${DEPLOY_USER}@${HELSINKI}" "$1"
}

# ── SSH key check ────────────────────────────────────────────────────────────
if [[ ! -f "$SSH_KEY" ]]; then
    err "SSH key not found: $SSH_KEY\nSet SSH_KEY env var to your key path."
fi

# ── Connectivity check ───────────────────────────────────────────────────────
log "Pinging Helsinki ($HELSINKI)..."
if ! ssh -i "$SSH_KEY" -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new \
        -o BatchMode=yes "${DEPLOY_USER}@${HELSINKI}" "echo OK" 2>/dev/null; then
    err "Cannot reach $HELSINKI — check SSH key and connectivity."
fi
log "Connection OK"

# ── Rsync source ─────────────────────────────────────────────────────────────
log "Syncing source to $HELSINKI:$DEPLOY_DIR ..."
rsync -az --delete \
    --exclude 'target/' \
    --exclude '.git/' \
    --exclude 'node_modules/' \
    --exclude 'Zion-2.9.5-main/' \
    --exclude 'Zion-2.9.5-main.zip' \
    --exclude '*.tmp' \
    --chmod=Du=rwx,Fu=rw \
    -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
    "$LOCAL_SRC/" "${DEPLOY_USER}@${HELSINKI}:${DEPLOY_DIR}/"
log "Sync complete"

# ── Decide which services to touch ───────────────────────────────────────────
SERVICES=""
[[ $DO_CORE -eq 1 ]] && SERVICES="$SERVICES core"
[[ $DO_POOL -eq 1 ]] && SERVICES="$SERVICES pool"
SERVICES="${SERVICES## }"   # trim leading space

info "Services to update: $SERVICES"

# ── Build ─────────────────────────────────────────────────────────────────────
if [[ $DO_REBUILD -eq 1 ]]; then
    log "Building Docker images (no-cache) for: $SERVICES"
    log "This may take 5–15 min for Rust compilation..."
    ssh_run "cd $DEPLOY_DIR && docker compose -f $COMPOSE_FILE build --no-cache $SERVICES"
    log "Build complete"
else
    warn "--no-rebuild: skipping docker build, restarting containers only."
fi

# ── Restart containers ────────────────────────────────────────────────────────
log "Restarting: $SERVICES"
ssh_run "cd $DEPLOY_DIR && docker compose -f $COMPOSE_FILE up -d $SERVICES"
log "Restart sent"

# ── Health check ──────────────────────────────────────────────────────────────
log "Waiting 10s then checking container status..."
sleep 10

ssh_run "cd $DEPLOY_DIR && docker compose -f $COMPOSE_FILE ps $SERVICES"

log "Checking recent logs..."
for svc in $SERVICES; do
    info "--- $svc (last 20 lines) ---"
    ssh_run "cd $DEPLOY_DIR && docker compose -f $COMPOSE_FILE logs --tail 20 $svc" || true
done

echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Deploy complete: $SERVICES @ $HELSINKI"
log "Pool stratum: $HELSINKI:3333"
log "Core RPC:     $HELSINKI:8332"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
