#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# ZION 2.9.5 TestNet Deploy — Phase 1
# Deploys clean MainNet-ready core to all 3 servers
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SSH_KEY="$HOME/.ssh/zion_hetzner_key"
# P1-30: Use dedicated deploy user instead of root when available
# To switch: create 'zion' user on servers with sudo access, then set DEPLOY_USER=zion
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_DIR="/root/zion-2.9.5"
COMPOSE_FILE="docker/docker-compose.testnet.yml"
LOCAL_SRC="$(cd "$(dirname "$0")/.." && pwd)"

# Server list
HELSINKI="77.42.31.72"
USA="5.78.145.234"
SINGAPORE="5.223.56.124"

ALL_SERVERS=("$HELSINKI" "$USA" "$SINGAPORE")
SERVER_NAMES=("Helsinki-SEED" "USA-PEER1" "Singapore-PEER2")

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
    ssh_cmd "$ip" "rm -rf $DEPLOY_DIR && mkdir -p $DEPLOY_DIR"
    rsync -az --exclude 'target/' --exclude '.git/' \
        -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
        "$LOCAL_SRC/" "${DEPLOY_USER}@$ip:$DEPLOY_DIR/"
    
    # 2. Build Docker images
    log "[$name] Building Docker images (this takes a few minutes)..."
    ssh_cmd "$ip" "
        cd $DEPLOY_DIR
        docker compose -f $COMPOSE_FILE build --no-cache 2>&1 | tail -5
    "
    
    # 3. Start services
    log "[$name] Starting services..."
    ssh_cmd "$ip" "
        cd $DEPLOY_DIR
        docker compose -f $COMPOSE_FILE up -d 2>&1
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
    
    if [ "$containers" -ge 3 ]; then
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
    helsinki)
        deploy_server "$HELSINKI" "Helsinki-SEED"
        ;;
    usa)
        deploy_server "$USA" "USA-PEER1"
        ;;
    singapore)
        deploy_server "$SINGAPORE" "Singapore-PEER2"
        ;;
    all)
        log "🚀 ZION 2.9.5 TestNet Full Deploy"
        log "Servers: Helsinki (SEED), USA (PEER1), Singapore (PEER2)"
        echo ""
        
        # Deploy sequentially (Helsinki first as SEED)
        deploy_server "$HELSINKI" "Helsinki-SEED"
        echo ""
        deploy_server "$USA" "USA-PEER1"
        echo ""
        deploy_server "$SINGAPORE" "Singapore-PEER2"
        echo ""
        
        log "━━━ Verification ━━━"
        for i in "${!ALL_SERVERS[@]}"; do
            verify_server "${ALL_SERVERS[$i]}" "${SERVER_NAMES[$i]}"
        done
        
        echo ""
        log "🎉 TestNet Deploy Complete!"
        log "P2P: $HELSINKI:8334, $USA:8334, $SINGAPORE:8334"
        log "RPC: $HELSINKI:8444, $USA:8444, $SINGAPORE:8444"
        log "Pool: $HELSINKI:3333, $USA:3333, $SINGAPORE:3333"
        ;;
    verify)
        log "━━━ Verification Only ━━━"
        for i in "${!ALL_SERVERS[@]}"; do
            verify_server "${ALL_SERVERS[$i]}" "${SERVER_NAMES[$i]}"
        done
        ;;
    clean)
        log "━━━ Stopping All Servers ━━━"
        for i in "${!ALL_SERVERS[@]}"; do
            log "[${SERVER_NAMES[$i]}] Stopping..."
            ssh_cmd "${ALL_SERVERS[$i]}" "cd $DEPLOY_DIR && docker compose -f $COMPOSE_FILE down 2>/dev/null; echo done" || true
        done
        ;;
    *)
        echo "Usage: $0 {all|helsinki|usa|singapore|verify|clean}"
        exit 1
        ;;
esac
