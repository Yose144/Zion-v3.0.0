#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# ZION 2.9.6 TestNet Deploy — Primary Host
# Deploys the canonical single-host testnet stack to Zion2.
# Updated: 12.3.2026
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SSH_KEY="$HOME/.ssh/zion_hetzner_key"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_DIR="/root/zion-2.9.6"
COMPOSE_FILE="docker/docker-compose.testnet.yml"
LOCAL_SRC="$(cd "$(dirname "$0")/.." && pwd)"

# Seed peers (single host + DNS/internal seed containers)
SEED_PEERS="91.98.122.165:8334,seed1.zionterranova.com:8334,seed2.zionterranova.com:8334,seed3.zionterranova.com:8334"

# Server list
PRIMARY="91.98.122.165"

ALL_SERVERS=("$PRIMARY")
SERVER_NAMES=("Zion2")

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[ZION]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; }

ssh_cmd() {
    # P1-29: accept-new prevents MITM
    # P1-30: configurable user (default root, switch to 'zion' for production)
    ssh -i "$SSH_KEY" -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new "${DEPLOY_USER}@$1" "$2"
}

deploy_server() {
    local ip="$1"
    local name="$2"
    
    log "━━━ Deploying to $name ($ip) ━━━"
    
    # 1. Rsync source code (faster than git clone, works with private repos)
    log "[$name] Syncing source code..."
    ssh_cmd "$ip" "mkdir -p $DEPLOY_DIR"
    # --chmod ensures files are readable even if local perms are restrictive (macOS 700)
    rsync -az --chmod=Du=rwx,Fu=rw --exclude 'target/' --exclude '.git/' --exclude 'node_modules/' --exclude 'Zion-2.9.5-main.zip' \
        -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
        "$LOCAL_SRC/" "${DEPLOY_USER}@$ip:$DEPLOY_DIR/"
    
    # 2. Install Docker if missing
    ssh_cmd "$ip" "command -v docker >/dev/null || (curl -fsSL https://get.docker.com | sh)"

    # 3. Build Docker images
    log "[$name] Building Docker images (this takes a few minutes)..."
    ssh_cmd "$ip" "
        cd $DEPLOY_DIR
        docker compose -f $COMPOSE_FILE build --no-cache 2>&1 | tail -10
    "
    
    # 4. Start canonical single-host stack
    log "[$name] Starting canonical testnet stack..."
    ssh_cmd "$ip" "
        cd $DEPLOY_DIR
        SEED_PEERS='$SEED_PEERS' docker compose -f $COMPOSE_FILE up -d core pool miner redis 2>&1
    "
    
    # 4. Wait for health
    log "[$name] Waiting for services to start..."
    sleep 10
    
    ssh_cmd "$ip" "
        docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    "
    
    log "[$name] ✅ Deployed!"
}

verify_server() {
    local ip="$1"
    local name="$2"
    
    log "[$name] Checking health..."
    
    # Check containers
    local containers
    containers=$(ssh_cmd "$ip" "docker ps --format '{{.Names}}:{{.Status}}' | grep -c 'Up'" 2>/dev/null || echo "0")
    
    if [ "$containers" -ge 4 ]; then
        log "[$name] ✅ $containers containers running"
    else
        err "[$name] ❌ Only $containers containers up!"
    fi
    
    # Check P2P port
    if ssh_cmd "$ip" "docker exec zion-core sh -c 'echo ok' 2>/dev/null" >/dev/null 2>&1; then
        log "[$name] ✅ zion-core responding"
    else
        warn "[$name] ⚠️  zion-core not responding yet"
    fi
}

# ─── Main ────────────────────────────────────

case "${1:-all}" in
    primary)  deploy_server "$PRIMARY" "Zion2" ;;
    all)
        log "🚀 ZION 2.9.6 TestNet Primary Host Deploy"
        log "Server: Zion2 ($PRIMARY)"
        echo ""
        
        for i in "${!ALL_SERVERS[@]}"; do
            deploy_server "${ALL_SERVERS[$i]}" "${SERVER_NAMES[$i]}"
            echo ""
        done
        
        log "━━━ Verification ━━━"
        for i in "${!ALL_SERVERS[@]}"; do
            verify_server "${ALL_SERVERS[$i]}" "${SERVER_NAMES[$i]}"
        done
        
        echo ""
        log "🎉 Deploy dokončen!"
        log "SEED_PEERS: $SEED_PEERS"
        ;;
    verify)
        for i in "${!ALL_SERVERS[@]}"; do
            verify_server "${ALL_SERVERS[$i]}" "${SERVER_NAMES[$i]}"
        done
        ;;
    clean)
        log "━━━ Stopping TestNet Stack ━━━"
        for i in "${!ALL_SERVERS[@]}"; do
            log "[${SERVER_NAMES[$i]}] Stopping..."
            ssh_cmd "${ALL_SERVERS[$i]}" "cd $DEPLOY_DIR && docker compose -f $COMPOSE_FILE down 2>/dev/null; echo done" || true
        done
        ;;
    *)
        echo "Usage: $0 {all|primary|verify|clean}"
        exit 1
        ;;
esac
