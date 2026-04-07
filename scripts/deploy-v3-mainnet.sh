#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# ZION V3 MainNet — Server Provisioning & Deploy
# Provisions a fresh Ubuntu 24.04 server and deploys V3 chain stack.
# Usage:
#   bash scripts/deploy-v3-mainnet.sh <server-alias>     # deploy one
#   bash scripts/deploy-v3-mainnet.sh all                 # deploy all
#   bash scripts/deploy-v3-mainnet.sh verify              # check health
#   bash scripts/deploy-v3-mainnet.sh clean <alias>       # stop + remove
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SSH_KEY="$HOME/.ssh/zion_hetzner_key"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_DIR="/root/zion-2.9.6"
COMPOSE_FILE="docker/docker-compose.v3-mainnet.yml"
LOCAL_SRC="$(cd "$(dirname "$0")/.." && pwd)"

# ── Server inventory ──────────────────────────────────────────
# Update IPs when new servers are provisioned.
# ACTIVE_SERVER_ALIASES is the live mainnet fleet. Keep unreachable hosts out of
# the active seed rotation until they are restored, otherwise fresh nodes learn
# dead peers and burn sync cycles.
SERVER_ALIASES=(eu primary us sg)
ACTIVE_SERVER_ALIASES=(primary)

resolve_alias() {
    case "$1" in
        eu) echo "157.180.41.213" ;;
        primary) echo "91.98.122.165" ;;
        us) echo "5.78.194.94" ;;
        sg) echo "5.223.84.191" ;;
        *)
            err "Unknown server alias: $1"
            echo "Available: ${SERVER_ALIASES[*]}"
            exit 1
            ;;
    esac
}

resolve_name() {
    case "$1" in
        eu) echo "Zion-MainetV3 (Helsinki)" ;;
        primary) echo "Zion2 (Prague)" ;;
        us) echo "Zion-US (USA)" ;;
        sg) echo "Zion-SG (Singapore)" ;;
        *) echo "$1" ;;
    esac
}

resolve_node_id() {
    case "$1" in
        eu) echo "v3-mainnet-helsinki" ;;
        primary) echo "v3-mainnet-prague" ;;
        us) echo "v3-mainnet-usa" ;;
        sg) echo "v3-mainnet-singapore" ;;
        *) echo "v3-mainnet-$1" ;;
    esac
}

resolve_seed_node_id() {
    case "$1" in
        eu) echo "v3-seed-helsinki" ;;
        primary) echo "v3-seed-prague" ;;
        us) echo "v3-seed-usa" ;;
        sg) echo "v3-seed-singapore" ;;
        *) echo "v3-seed-$1" ;;
    esac
}

resolve_services() {
    case "$1" in
        primary|us) echo "core seed1 pool miner redis" ;;
        *) echo "core seed1" ;;
    esac
}

expected_container_floor() {
    case "$1" in
        primary|us) echo "5" ;;
        *) echo "2" ;;
    esac
}

# Seed peers — live mainnet nodes only.
# For audited fleet nodes, exclude the host's own public address to avoid
# pointless self-dial attempts and extra P2P noise. If the exclusion would
# leave the list empty (single-node/bootstrap edge case), fall back to the
# full active set so the node still gets a non-empty seed list.
build_seed_peers_for_alias() {
    local current_alias="$1"
    local seeds=""
    local key

    for key in "${ACTIVE_SERVER_ALIASES[@]}"; do
        if [ "$key" = "$current_alias" ]; then
            continue
        fi
        if [ -n "$seeds" ]; then seeds="${seeds},"; fi
        seeds="${seeds}$(resolve_alias "$key"):8333"
    done

    if [ -n "$seeds" ]; then
        echo "$seeds"
        return
    fi

    for key in "${ACTIVE_SERVER_ALIASES[@]}"; do
        if [ -n "$seeds" ]; then seeds="${seeds},"; fi
        seeds="${seeds}$(resolve_alias "$key"):8333"
    done
    echo "$seeds"
}

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[ZION]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }

ssh_cmd() {
    ssh -i "$SSH_KEY" -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new "${DEPLOY_USER}@$1" "$2"
}

# ── Phase 1: Provision server ────────────────────────────────
provision_server() {
    local ip="$1"
    local name="$2"

    log "━━━ Provisioning $name ($ip) ━━━"

    # System updates
    log "[$name] Updating system packages..."
    ssh_cmd "$ip" "apt-get update -qq && apt-get upgrade -y -qq"

    # Install Docker
    log "[$name] Installing Docker..."
    ssh_cmd "$ip" "
        if ! command -v docker &>/dev/null; then
            curl -fsSL https://get.docker.com | sh
            systemctl enable docker
            systemctl start docker
        else
            echo 'Docker already installed'
        fi
        docker --version
        docker compose version
    "

    # Firewall
    log "[$name] Configuring firewall..."
    ssh_cmd "$ip" "
        apt-get install -y -qq ufw
        sed -i 's/^DEFAULT_FORWARD_POLICY=.*/DEFAULT_FORWARD_POLICY=\"ACCEPT\"/' /etc/default/ufw
        ufw default deny incoming
        ufw default allow outgoing
        ufw allow 22/tcp    comment 'SSH'
        ufw allow 8333/tcp  comment 'P2P mainnet'
        ufw allow 8443/tcp  comment 'RPC mainnet'
        ufw allow 9115/tcp  comment 'Metrics'
        ufw allow 3333/tcp  comment 'Stratum'
        ufw allow 8080/tcp  comment 'Pool API'
        ufw --force enable
        ufw status numbered
    "

    # Create data directories
    ssh_cmd "$ip" "mkdir -p /data/zion /data/zion-pool /data/redis"

    # Hugepages for miner (optional, best-effort)
    ssh_cmd "$ip" "
        if [ -d /dev/hugepages ]; then
            echo 128 > /proc/sys/vm/nr_hugepages 2>/dev/null || true
            grep -q hugepages /etc/sysctl.conf || echo 'vm.nr_hugepages=128' >> /etc/sysctl.conf
        fi
    "

    log "[$name] ✅ Provisioning complete"
}

# ── Phase 2: Deploy V3 stack ─────────────────────────────────
deploy_server() {
    local ip="$1"
    local name="$2"
    local alias="$3"
    local node_id
    local seed_node_id
    local seed_peers
    local services

    node_id=$(resolve_node_id "$alias")
    seed_node_id=$(resolve_seed_node_id "$alias")
    seed_peers=$(build_seed_peers_for_alias "$alias")
    services=$(resolve_services "$alias")

    log "━━━ Deploying V3 to $name ($ip) ━━━"
    info "[$name] Seed peers: $seed_peers"

    # Rsync source code
    log "[$name] Syncing source code..."
    ssh_cmd "$ip" "mkdir -p $DEPLOY_DIR"
    rsync -az --chmod=Du=rwx,Fu=rw \
        --exclude 'target/' --exclude '.git/' --exclude 'node_modules/' \
        --exclude 'Zion-2.9.5-main.zip' --exclude 'Zion-2.9.5-main/' \
        -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
        "$LOCAL_SRC/" "${DEPLOY_USER}@$ip:$DEPLOY_DIR/"

    # Create .env if missing
    ssh_cmd "$ip" "
        if [ ! -f $DEPLOY_DIR/.env ]; then
            echo 'REDIS_PASSWORD=$(openssl rand -hex 16)' > $DEPLOY_DIR/.env
            echo 'MINER_WALLET=zion1q893q6c5j7y0e3r062g4m7c240t5g294k7z6729' >> $DEPLOY_DIR/.env
            echo 'MINER_WORKER=$(hostname)-miner' >> $DEPLOY_DIR/.env
            echo 'NODE_ID=$node_id' >> $DEPLOY_DIR/.env
            echo 'SEED_NODE_ID=$seed_node_id' >> $DEPLOY_DIR/.env
            echo 'SEED_PEERS=$seed_peers' >> $DEPLOY_DIR/.env
            echo '.env created with generated REDIS_PASSWORD'
        else
            # Update node identity and seed peers in existing .env
            sed -i '/^NODE_ID=/d' $DEPLOY_DIR/.env
            sed -i '/^SEED_NODE_ID=/d' $DEPLOY_DIR/.env
            sed -i '/^SEED_PEERS=/d' $DEPLOY_DIR/.env
            echo 'NODE_ID=$node_id' >> $DEPLOY_DIR/.env
            echo 'SEED_NODE_ID=$seed_node_id' >> $DEPLOY_DIR/.env
            echo 'SEED_PEERS=$seed_peers' >> $DEPLOY_DIR/.env
            grep -q '^MINER_WALLET=' $DEPLOY_DIR/.env || echo 'MINER_WALLET=zion1q893q6c5j7y0e3r062g4m7c240t5g294k7z6729' >> $DEPLOY_DIR/.env
            grep -q '^MINER_WORKER=' $DEPLOY_DIR/.env || echo 'MINER_WORKER=$(hostname)-miner' >> $DEPLOY_DIR/.env
            echo '.env updated (NODE_ID, SEED_NODE_ID, SEED_PEERS refreshed)'
        fi
    "

    # Build Docker images
    log "[$name] Building Docker images (this takes several minutes on first run)..."
    ssh_cmd "$ip" "
        cd $DEPLOY_DIR
        docker compose -f $COMPOSE_FILE build $services 2>&1 | tail -15
    "

    if [ "$alias" != "primary" ] && [ "$alias" != "us" ]; then
        log "[$name] Stopping non-canonical mining services on follower node..."
        ssh_cmd "$ip" "
            docker rm -f zion-miner zion-pool zion-redis 2>/dev/null || true
        "
    fi

    # Start stack
    log "[$name] Starting V3 services: $services"
    ssh_cmd "$ip" "
        cd $DEPLOY_DIR
        docker compose -f $COMPOSE_FILE --env-file .env up -d $services 2>&1
    "

    # Wait and check
    log "[$name] Waiting for services to start (30s)..."
    sleep 30

    ssh_cmd "$ip" "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

    log "[$name] ✅ Deployed!"
}

# ── Verify ────────────────────────────────────────────────────
verify_server() {
    local ip="$1"
    local name="$2"
    local alias="$3"
    local floor

    floor=$(expected_container_floor "$alias")

    info "━━━ Verifying $name ($ip) ━━━"

    # Container count
    local up
    up=$(ssh_cmd "$ip" "docker ps --format '{{.Names}}' | wc -l" 2>/dev/null || echo "0")
    if [ "$up" -ge "$floor" ]; then
        log "[$name] ✅ $up containers running"
    else
        err "[$name] ❌ Only $up containers up!"
    fi

    # Chain height via JSON-RPC
    local chain_info
    chain_info=$(ssh_cmd "$ip" "echo '{\"jsonrpc\":\"2.0\",\"method\":\"getChainInfo\",\"id\":1}' | nc -w3 127.0.0.1 8443 2>/dev/null" || echo "no response")
    info "[$name] ChainInfo: $chain_info"

    # Health endpoint
    local health
    health=$(ssh_cmd "$ip" "curl -sf http://127.0.0.1:9115/health 2>/dev/null" || echo "no response")
    info "[$name] Health: $health"

    # Peer count
    local peer_info
    peer_info=$(ssh_cmd "$ip" "echo '{\"jsonrpc\":\"2.0\",\"method\":\"getPeerInfo\",\"id\":1}' | nc -w3 127.0.0.1 8443 2>/dev/null" || echo "no response")
    info "[$name] Peers: $peer_info"
}

# ── Clean ─────────────────────────────────────────────────────
clean_server() {
    local ip="$1"
    local name="$2"

    warn "━━━ Stopping $name ($ip) ━━━"
    ssh_cmd "$ip" "
        cd $DEPLOY_DIR 2>/dev/null &&
        docker compose -f $COMPOSE_FILE down 2>/dev/null || true
        docker ps
    "
    log "[$name] Stack stopped. Data volumes preserved."
}

# ── Main ──────────────────────────────────────────────────────
case "${1:-help}" in
    provision)
        alias="${2:?specify server alias (eu, primary, us, sg, or all)}"
        if [ "$alias" = "all" ]; then
            for key in "${ACTIVE_SERVER_ALIASES[@]}"; do
                provision_server "$(resolve_alias "$key")" "$(resolve_name "$key")"
                echo ""
            done
        else
            provision_server "$(resolve_alias "$alias")" "$(resolve_name "$alias")"
        fi
        ;;
    deploy)
        alias="${2:?specify server alias (eu, primary, us, sg, or all)}"
        if [ "$alias" = "all" ]; then
            for key in "${ACTIVE_SERVER_ALIASES[@]}"; do
                deploy_server "$(resolve_alias "$key")" "$(resolve_name "$key")" "$key"
                echo ""
            done
        else
            deploy_server "$(resolve_alias "$alias")" "$(resolve_name "$alias")" "$alias"
        fi
        ;;
    all)
        log "🚀 ZION V3 MainNet — Full Provision + Deploy"
        log "Servers: ${ACTIVE_SERVER_ALIASES[*]}"
        log "Seed peers: per-host list, self excluded when alternatives exist"
        echo ""
        for key in "${ACTIVE_SERVER_ALIASES[@]}"; do
            provision_server "$(resolve_alias "$key")" "$(resolve_name "$key")"
            deploy_server "$(resolve_alias "$key")" "$(resolve_name "$key")" "$key"
            echo ""
        done
        log "━━━ Verification ━━━"
        for key in "${ACTIVE_SERVER_ALIASES[@]}"; do
            verify_server "$(resolve_alias "$key")" "$(resolve_name "$key")" "$key"
        done
        echo ""
        log "🎉 V3 MainNet deploy dokončen!"
        ;;
    verify)
        for key in "${ACTIVE_SERVER_ALIASES[@]}"; do
            verify_server "$(resolve_alias "$key")" "$(resolve_name "$key")" "$key"
        done
        ;;
    clean)
        alias="${2:?specify server alias}"
        clean_server "$(resolve_alias "$alias")" "$(resolve_name "$alias")"
        ;;
    canary)
        log "🕯️  7-day canary monitoring — checking all nodes"
        for key in "${ACTIVE_SERVER_ALIASES[@]}"; do
            verify_server "$(resolve_alias "$key")" "$(resolve_name "$key")" "$key"
            echo ""
        done
        ;;
    help|*)
        echo "ZION V3 MainNet Deploy Script"
        echo ""
        echo "Usage: $0 <command> [server-alias]"
        echo ""
        echo "Commands:"
        echo "  provision <alias|all>  Provision fresh server (Docker, firewall, dirs)"
        echo "  deploy <alias|all>     Deploy V3 chain stack"
        echo "  all                    Provision + deploy all servers"
        echo "  verify                 Check health of all servers"
        echo "  canary                 Run canary health check"
        echo "  clean <alias>          Stop stack on server (preserves volumes)"
        echo ""
        echo "Server aliases: ${SERVER_ALIASES[*]}"
        echo ""
        echo "Examples:"
        echo "  $0 provision eu        # Provision Helsinki server"
        echo "  $0 deploy eu           # Deploy V3 to Helsinki"
        echo "  $0 all                 # Full provision + deploy everywhere"
        echo "  $0 verify              # Health check all nodes"
        ;;
esac
