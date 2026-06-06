#!/usr/bin/env bash
# ==============================================================================
# ZION V3 Autopilot — Edge-Only Topology
# Phase: preflight -> edge-deploy -> verify
#
# Run from any machine with SSH access to Edge:
#   bash scripts/autopilot-v3.sh
# ==============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
V3_DIR="$ROOT_DIR/V3"
EDGE_USER="root"
EDGE_HOST="77.42.71.94"
EDGE_SSH_KEY="${ROOT_DIR}/ssh-key-zion-edge"
REMOTE_ROOT="/root/zion-2.9.6-main"
REMOTE_WEB="/root/APP\&WEB/website-v2.9"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'
log()  { echo -e "${GREEN}[AUTOPILOT]${NC} $*"; }
info() { echo -e "${CYAN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
phase() { echo -e "\n${BOLD}════════ $1 ════════${NC}"; }

usage() {
  cat <<EOF
Usage: bash scripts/autopilot-v3.sh [options]

Options:
  --skip-sync         Skip code sync to Edge
  --skip-build        Skip Rust + web build on Edge
  --skip-deploy       Skip service restart on Edge
  --verify-only       Run only verification phase
  -h, --help          Show this help
EOF
}

SKIP_SYNC=0
SKIP_BUILD=0
SKIP_DEPLOY=0
VERIFY_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-sync)   SKIP_SYNC=1; shift ;;
    --skip-build)  SKIP_BUILD=1; shift ;;
    --skip-deploy) SKIP_DEPLOY=1; shift ;;
    --verify-only) VERIFY_ONLY=1; shift ;;
    -h|--help)     usage; exit 0 ;;
    *) err "Unknown argument: $1" ;;
  esac
done

# ── Helpers ──────────────────────────────────────────────────────────────────

ssh_run() {
  ssh -i "$EDGE_SSH_KEY" -o BatchMode=yes -o ConnectTimeout=10 \
    -o StrictHostKeyChecking=accept-new "${EDGE_USER}@${EDGE_HOST}" "$1"
}

check_port() {
  local host="$1" port="$2"
  if command -v nc >/dev/null 2>&1; then
    nc -z -w 3 "$host" "$port" >/dev/null 2>&1
  else
    python3 -c "import socket; s=socket.socket(); s.settimeout(3); s.connect(('${host}',${port})); s.close()" 2>/dev/null
  fi
}

# ── Phase 1: Preflight ────────────────────────────────────────────────────

phase_preflight() {
  phase "1/4 PREFLIGHT"
  cd "$ROOT_DIR"

  [[ -f "$EDGE_SSH_KEY" ]] || err "Missing Edge SSH key: $EDGE_SSH_KEY"

  if ! check_port "$EDGE_HOST" 22; then
    err "Edge SSH (port 22) unreachable"
  fi

  # Verify Rust on Edge
  if ! ssh_run "test -f /root/.cargo/bin/cargo"; then
    warn "Rust not found on Edge — will be installed during deploy"
  fi

  log "Preflight OK"
}

# ── Phase 2: Sync ──────────────────────────────────────────────────────────

phase_sync() {
  phase "2/4 SYNC"
  if [[ "$SKIP_SYNC" -eq 1 ]]; then
    warn "Sync skipped (--skip-sync)"
    return
  fi

  cd "$ROOT_DIR"

  log "Syncing V3 code..."
  if command -v rsync &>/dev/null; then
    rsync -avz --exclude='target' --exclude='.git' --exclude='data' --exclude='logs' \
      -e "ssh -i ${EDGE_SSH_KEY} -o StrictHostKeyChecking=accept-new" \
      "${V3_DIR}/" "${EDGE_USER}@${EDGE_HOST}:${REMOTE_ROOT}/V3/"
  else
    tar czf - -C "$ROOT_DIR" V3/ 2>/dev/null | \
      ssh_run "cd ${REMOTE_ROOT} && tar xzf -"
  fi

  log "Syncing website code..."
  tar czf - --exclude='node_modules' --exclude='.next' --exclude='out' \
    -C "${ROOT_DIR}/APP\&WEB" website-v2.9/ 2>/dev/null | \
    ssh_run "mkdir -p /root/APP\&WEB && cd /root/APP\&WEB && tar xzf -"

  log "Sync OK"
}

# ── Phase 3: Build on Edge ────────────────────────────────────────────────

phase_build() {
  phase "3/4 BUILD ON EDGE"
  if [[ "$SKIP_BUILD" -eq 1 ]]; then
    warn "Build skipped (--skip-build)"
    return
  fi

  log "Building Rust binaries on Edge..."
  ssh_run "
    . /root/.cargo/env 2>/dev/null || true
    cd ${REMOTE_ROOT}/V3
    # Fix workspace if L5/L6 missing
    if [ ! -d L5/free-world ]; then
      sed -i '/\"L5\/free-world\",/d;/\"L6\/issobella\",/d;/\"L4\/oasis\",/d' Cargo.toml 2>/dev/null || true
      sed -i '/\"L1\/native-ffi\",/d' Cargo.toml 2>/dev/null || true
    fi
    cargo build --release --bin node --bin server --bin zion-dao --bin zion-warp-server 2>&1
  "

  log "Building agent on Edge..."
  ssh_run "
    . /root/.cargo/env 2>/dev/null || true
    cd ${REMOTE_ROOT}/ZION_OS/agent
    cargo build --release 2>&1
  "

  log "Building dashboard on Edge..."
  ssh_run "
    . /root/.cargo/env 2>/dev/null || true
    cd ${REMOTE_ROOT}/ZION_OS/dashboard/infra
    cargo build --release 2>&1
  "

  log "Building website on Edge..."
  ssh_run "
    cd ${REMOTE_WEB}
    rm -f package-lock.json
    npm install 2>&1 | tail -n 5
    npm run build 2>&1 | tail -n 15
  "

  log "Build OK"
}

# ── Phase 4: Deploy ────────────────────────────────────────────────────────

phase_deploy() {
  phase "4/4 DEPLOY"
  if [[ "$SKIP_DEPLOY" -eq 1 ]]; then
    warn "Deploy skipped (--skip-deploy)"
    return
  fi

  log "Restarting services..."
  ssh_run "systemctl daemon-reload"
  ssh_run "systemctl restart zion-edge-node1 zion-edge-node2"
  sleep 5
  ssh_run "systemctl restart zion-edge-pool"
  sleep 3
  ssh_run "systemctl restart zion-edge-dao zion-edge-warp || true"
  ssh_run "systemctl restart zion-edge-miner || true"
  ssh_run "systemctl restart zion-edge-agent || true"
  ssh_run "systemctl restart zion-edge-dashboard || true"
  ssh_run "pm2 restart zion-website 2>/dev/null || true"

  log "Waiting for services..."
  sleep 10
}

# ── Phase 5: Verify ────────────────────────────────────────────────────────

phase_verify() {
  phase "VERIFY"

  local ok=0 fail=0

  echo ""
  echo "=== Service Status ==="
  for svc in zion-edge-node1 zion-edge-node2 zion-edge-pool zion-edge-dao zion-edge-warp zion-edge-miner zion-edge-agent zion-edge-dashboard; do
    local status
    status=$(ssh_run "systemctl is-active ${svc} 2>/dev/null" || true)
    if [[ "$status" == "active" ]]; then
      echo -e "${GREEN}  ${svc}: ACTIVE${NC}"; ((ok++))
    else
      echo -e "${RED}  ${svc}: ${status}${NC}"; ((fail++))
    fi
  done

  echo ""
  echo "=== Port Checks ==="
  for port in 8443 8444 8450 8453 8767 8888 3000; do
    if check_port "$EDGE_HOST" "$port"; then
      echo -e "${GREEN}  port ${port}: OPEN${NC}"; ((ok++))
    else
      echo -e "${RED}  port ${port}: CLOSED${NC}"; ((fail++))
    fi
  done

  # Agent health check
  local agent_health
  agent_health=$(ssh_run "curl -s http://127.0.0.1:8767/health 2>/dev/null" || true)
  if [[ "$agent_health" == "OK" ]]; then
    echo -e "${GREEN}  zion-agent API: HEALTHY${NC}"; ((ok++))
  else
    echo -e "${RED}  zion-agent API: NO RESPONSE${NC}"; ((fail++))
  fi

  # Dashboard health check
  local dash_health
  dash_health=$(ssh_run "curl -s http://127.0.0.1:8888/api/infra 2>/dev/null" || true)
  if [[ -n "$dash_health" ]]; then
    echo -e "${GREEN}  zion-dashboard API: HEALTHY${NC}"; ((ok++))
  else
    echo -e "${RED}  zion-dashboard API: NO RESPONSE${NC}"; ((fail++))
  fi

  echo ""
  if [[ "$fail" -eq 0 ]]; then
    log "=== ALL SYSTEMS OPERATIONAL ==="
  else
    warn "=== ${fail} CHECKS FAILED ==="
    echo "Check logs: ssh ${EDGE_USER}@${EDGE_HOST} 'journalctl -u zion-edge-node1 -n 50'"
  fi
}

# ── Main ────────────────────────────────────────────────────────────────────

main() {
  if [[ "$VERIFY_ONLY" -eq 1 ]]; then
    phase_verify
    exit 0
  fi

  phase_preflight
  phase_sync
  phase_build
  phase_deploy
  phase_verify
}

main "$@"
