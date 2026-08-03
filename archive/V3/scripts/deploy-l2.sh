#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# deploy-l2.sh — Deploy ZION V3 L2 services to a server
#
# Prerequisites:
#   - Docker + Docker Compose installed on the target server
#   - L1 node already running (via docker-compose.v3-mainnet.yml)
#   - Validator private key file at /etc/zion/bridge-validator.key (chmod 600)
#   - Git repo cloned at the same path on the server
#
# Usage:
#   ssh root@<EDGE_IP> 'cd /path/to/2.9.6 && bash V3/scripts/deploy-l2.sh'
#
# Environment overrides:
#   BRIDGE_PROFILE=mainnet  (default: testnet)
#   SKIP_BUILD=1            (skip Docker image rebuild)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V3_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$V3_DIR/docker"

PROFILE="${BRIDGE_PROFILE:-testnet}"

echo "═══════════════════════════════════════════════════════════════════"
echo "  ZION V3 L2 Deployment — profile: $PROFILE"
echo "═══════════════════════════════════════════════════════════════════"

# ── 1. Pre-flight checks ────────────────────────────────────────────────────

echo ""
echo "▸ Pre-flight checks..."

# Docker
if ! command -v docker &>/dev/null; then
    echo "  ✗ Docker not found. Install Docker first."
    exit 1
fi
echo "  ✓ Docker $(docker --version | head -1)"

# Docker Compose
if ! docker compose version &>/dev/null; then
    echo "  ✗ Docker Compose not found (need v2+)."
    exit 1
fi
echo "  ✓ Docker Compose $(docker compose version --short)"

# Check L1 node is running
if docker ps --format '{{.Names}}' | grep -q 'zion-v3-node'; then
    echo "  ✓ L1 node container running"
else
    echo "  ⚠ L1 node not running — L2 services will start but may fail to connect"
    echo "    Start L1 first: docker compose -f $DOCKER_DIR/docker-compose.v3-mainnet.yml up -d"
fi

# Check config files exist
BRIDGE_CONFIG="$V3_DIR/L2/bridge/config/bridge-${PROFILE}.toml"
SWAP_CONFIG="$V3_DIR/L2/atomic-swap/config/swap-${PROFILE}.toml"
DAO_CONFIG="$V3_DIR/L2/dao/config/dao-${PROFILE}.toml"

for cfg in "$BRIDGE_CONFIG" "$SWAP_CONFIG" "$DAO_CONFIG"; do
    if [[ -f "$cfg" ]]; then
        echo "  ✓ $(basename "$cfg")"
    else
        echo "  ✗ Missing: $cfg"
        exit 1
    fi
done

# ── 2. Build Docker images ──────────────────────────────────────────────────

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
    echo ""
    echo "▸ Building L2 Docker images (this may take a while)..."
    cd "$V3_DIR"
    docker build -f docker/Dockerfile.bridge -t zion-v3-bridge:latest . 
    echo "  ✓ zion-v3-bridge built"
    docker build -f docker/Dockerfile.swap -t zion-v3-swap:latest .
    echo "  ✓ zion-v3-swap built"
    docker build -f docker/Dockerfile.dao -t zion-v3-dao:latest .
    echo "  ✓ zion-v3-dao built"
else
    echo ""
    echo "▸ Skipping build (SKIP_BUILD=1)"
fi

# ── 3. Set environment for the chosen profile ───────────────────────────────

export BRIDGE_CONFIG="/etc/zion/bridge-${PROFILE}.toml"
export SWAP_CONFIG="/etc/zion/swap-${PROFILE}.toml"
export DAO_CONFIG="/etc/zion/dao-${PROFILE}.toml"

# ── 4. Deploy with Docker Compose ───────────────────────────────────────────

echo ""
echo "▸ Starting L2 services..."
cd "$DOCKER_DIR"
docker compose -f docker-compose.v3-l2.yml up -d bridge swap dao

echo ""
echo "▸ Waiting 5 seconds for startup..."
sleep 5

# ── 5. Health check ─────────────────────────────────────────────────────────

echo ""
echo "▸ Health check..."

check_container() {
    local name="$1"
    if docker ps --format '{{.Names}}' | grep -q "$name"; then
        local status
        status=$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null || echo "unknown")
        if [[ "$status" == "running" ]]; then
            echo "  ✓ $name — running"
        else
            echo "  ✗ $name — status: $status"
            echo "    Logs: docker logs $name --tail 20"
        fi
    else
        echo "  ✗ $name — not found"
    fi
}

check_container "zion-v3-bridge"
check_container "zion-v3-swap"
check_container "zion-v3-dao"

# ── 6. Summary ──────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  Deployment complete!"
echo ""
echo "  Services:"
echo "    Bridge metrics : http://localhost:9100/metrics"
echo "    Swap API       : http://localhost:8888"
echo "    DAO API        : http://localhost:8080"
echo ""
echo "  Logs:"
echo "    docker compose -f $DOCKER_DIR/docker-compose.v3-l2.yml logs -f bridge"
echo "    docker compose -f $DOCKER_DIR/docker-compose.v3-l2.yml logs -f swap"
echo "    docker compose -f $DOCKER_DIR/docker-compose.v3-l2.yml logs -f dao"
echo ""
echo "  Stop:"
echo "    docker compose -f $DOCKER_DIR/docker-compose.v3-l2.yml down"
echo "═══════════════════════════════════════════════════════════════════"
