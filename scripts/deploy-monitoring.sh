#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  ZION TerraNova — Deploy Monitoring Stack                     ║
# ║  Prometheus + Grafana + Node Exporter + Redis Exporter        ║
# ╚══════════════════════════════════════════════════════════════╝
set -euo pipefail

# ── Configuration ──
SERVER_HELSINKI="77.42.31.72"
SERVER_GERMANY="46.225.126.243"
SSH_KEY="$HOME/.ssh/zion_hetzner_key"
REMOTE_DIR="/opt/zion"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ZION TerraNova — Monitoring Stack Deployment        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Choose target server ──
TARGET="${1:-helsinki}"
case "$TARGET" in
  helsinki)  SERVER="$SERVER_HELSINKI"; ;;
  germany)  SERVER="$SERVER_GERMANY"; ;;
  all)
    info "Deploying to ALL servers..."
    $0 helsinki
    $0 germany
    exit 0
    ;;
  *)
    err "Unknown target: $TARGET"
    echo "Usage: $0 [helsinki|germany|all]"
    exit 1
    ;;
esac

info "Target: $TARGET ($SERVER)"

# ── Step 1: Sync monitoring configs ──
info "Syncing monitoring configuration..."
rsync -avz --delete \
  -e "ssh $SSH_OPTS" \
  --exclude='*.md' \
  monitoring/ \
  root@${SERVER}:${REMOTE_DIR}/monitoring/

log "Monitoring configs synced"

# ── Step 2: Sync docker compose ──
info "Syncing docker-compose.monitoring.yml..."
rsync -avz \
  -e "ssh $SSH_OPTS" \
  docker/docker-compose.monitoring.yml \
  root@${SERVER}:${REMOTE_DIR}/docker/

log "Docker compose synced"

# ── Step 3: Ensure zion-net exists ──
info "Ensuring Docker network zion-net exists..."
ssh $SSH_OPTS root@${SERVER} "docker network create zion-net 2>/dev/null || true"
log "Network ready"

# ── Step 4: Pull images ──
info "Pulling monitoring images..."
ssh $SSH_OPTS root@${SERVER} "cd ${REMOTE_DIR} && docker compose -f docker/docker-compose.monitoring.yml pull"
log "Images pulled"

# ── Step 5: Start monitoring stack ──
info "Starting monitoring stack..."
ssh $SSH_OPTS root@${SERVER} "cd ${REMOTE_DIR} && docker compose -f docker/docker-compose.monitoring.yml up -d"
log "Monitoring stack started"

# ── Step 6: Verify ──
info "Waiting 10s for services to start..."
sleep 10

info "Checking service health..."
PROM_STATUS=$(ssh $SSH_OPTS root@${SERVER} "curl -s -o /dev/null -w '%{http_code}' http://localhost:9090/-/healthy" || echo "000")
GRAF_STATUS=$(ssh $SSH_OPTS root@${SERVER} "curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health" || echo "000")

if [ "$PROM_STATUS" = "200" ]; then
  log "Prometheus: ✅ UP (HTTP $PROM_STATUS)"
else
  warn "Prometheus: ⚠️  HTTP $PROM_STATUS (may still be starting)"
fi

if [ "$GRAF_STATUS" = "200" ]; then
  log "Grafana: ✅ UP (HTTP $GRAF_STATUS)"
else
  warn "Grafana: ⚠️  HTTP $GRAF_STATUS (may still be starting)"
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Monitoring Stack — $TARGET                          "
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Prometheus: http://$SERVER:9090                     "
echo "║  Grafana:    http://$SERVER:3001                     "
echo "║  Node Exp:   http://$SERVER:9100/metrics             "
echo "║  Redis Exp:  http://$SERVER:9121/metrics             "
echo "║                                                      "
echo "║  Grafana Login:                                      "
echo "║    User: admin                                       "
echo "║    Pass: ZionTerra2026!                              "
echo "║                                                      "
echo "║  After nginx config:                                 "
echo "║    https://zionterranova.com/grafana/                "
echo "╚══════════════════════════════════════════════════════╝"
echo ""
log "Deployment complete! 🚀"
