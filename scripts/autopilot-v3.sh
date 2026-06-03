#!/usr/bin/env bash
# ==============================================================================
# ZION V3 Autopilot — Edge-Primary Topology
# Phases: preflight -> build -> edge-deploy -> local-start -> verify
# ==============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
V3_DIR="$ROOT_DIR/V3"
LOG_DIR="$ROOT_DIR/logs"
EDGE_HOST="100.76.16.108"
EDGE_SSH_KEY="${ROOT_DIR}/ssh-key-zion-edge"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log() { echo -e "${GREEN}[AUTOPILOT]${NC} $1"; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
phase() { echo -e "\n${BOLD}════════ $1 ════════${NC}"; }

usage() {
  cat <<EOF
Usage: bash scripts/autopilot-v3.sh [options]

Options:
  --skip-build        Skip Rust workspace build
  --skip-edge-deploy  Skip Edge server deploy + restart
  --skip-local-start  Skip local backup node + miner start
  --verify-only       Run only verification phase
  -h, --help          Show this help
EOF
}

SKIP_BUILD=0
SKIP_EDGE=0
SKIP_LOCAL=0
VERIFY_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=1; shift ;;
    --skip-edge-deploy) SKIP_EDGE=1; shift ;;
    --skip-local-start) SKIP_LOCAL=1; shift ;;
    --verify-only) VERIFY_ONLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) err "Unknown argument: $1" ;;
  esac
done

# ── Helpers ─────────────────────────────────────────────────────────────────

ssh_run() {
  local cmd="$1"
  ssh -i "$EDGE_SSH_KEY" -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new "root@${EDGE_HOST}" "$cmd"
}

check_port() {
  local host="$1" port="$2"
  if command -v nc >/dev/null 2>&1; then
    nc -z -w 3 "$host" "$port" >/dev/null 2>&1
  else
    python3 -c "import socket; s=socket.socket(); s.settimeout(3); s.connect(('${host}',${port})); s.close()" 2>/dev/null
  fi
}

rpc_get() {
  local host="$1" port="$2" method="$3"
  python3 -c "
import urllib.request, json
try:
    req = urllib.request.Request('http://${host}:${port}/jsonrpc', data=json.dumps({'jsonrpc':'2.0','id':1,'method':'${method}','params':{}}).encode(), headers={'Content-Type':'application/json'})
    resp = urllib.request.urlopen(req, timeout=5)
    print(resp.read().decode())
except Exception as e:
    print(json.dumps({'_rpc_error': str(e)}))
" 2>/dev/null
}

# ── Phase 1: Preflight ──────────────────────────────────────────────────────

phase_preflight() {
  phase "1/5 PREFLIGHT"
  cd "$ROOT_DIR"

  # Check Edge SSH key
  [[ -f "$EDGE_SSH_KEY" ]] || err "Missing Edge SSH key: $EDGE_SSH_KEY"

  # Check Edge reachable
  if ! check_port "$EDGE_HOST" 22; then
    warn "Edge SSH (port 22) unreachable — deploy phase will be skipped"
    SKIP_EDGE=1
  fi

  # Check Rust toolchain
  if ! command -v cargo >/dev/null 2>&1; then
    err "Rust/Cargo not found. Install via rustup.rs"
  fi

  # Check Tailscale VPN
  if command -v tailscale >/dev/null 2>&1; then
    if tailscale ping -c 1 -timeout 3s "$EDGE_HOST" >/dev/null 2>&1; then
      log "Tailscale VPN: OK (${EDGE_HOST})"
    else
      warn "Tailscale VPN to Edge down — using public IP fallback"
    fi
  else
    warn "Tailscale CLI not found — VPN status unknown"
  fi

  # Check canonical env vars set
  local canon_miner="zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3"
  local canon_humanitarian="zion1m4v5z8z850u480c5c208z274e334369275n5y20"
  local canon_issobella="zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702"

  if [[ "${ZION_MINER_ADDRESS:-}" != "$canon_miner" ]]; then
    warn "ZION_MINER_ADDRESS not set to canonical (${canon_miner})"
  fi
  if [[ "${ZION_HUMANITARIAN_WALLET:-}" != "$canon_humanitarian" ]]; then
    warn "ZION_HUMANITARIAN_WALLET not set to canonical"
  fi
  if [[ "${ZION_ISSOBELLA_WALLET:-}" != "$canon_issobella" ]]; then
    warn "ZION_ISSOBELLA_WALLET not set to canonical"
  fi

  log "Preflight OK"
}

# ── Phase 2: Build ──────────────────────────────────────────────────────────

phase_build() {
  phase "2/5 BUILD"
  cd "$ROOT_DIR"

  if [[ "$SKIP_BUILD" -eq 1 ]]; then
    warn "Build skipped (--skip-build)"
    return
  fi

  # Build V3 workspace
  cargo build --release --manifest-path "$V3_DIR/Cargo.toml" --workspace

  # Verify binaries exist
  for bin in node server zion-miner zion-warp-server zion-dao zion-atomic-swap; do
    local path="$V3_DIR/target/release/${bin}"
    [[ -x "$path" ]] || err "Binary not found after build: $path"
  done

  log "Build OK"
}

# ── Phase 3: Edge Deploy ────────────────────────────────────────────────────

phase_edge_deploy() {
  phase "3/5 EDGE DEPLOY"
  if [[ "$SKIP_EDGE" -eq 1 ]]; then
    warn "Edge deploy skipped (--skip-edge-deploy or SSH unreachable)"
    return
  fi

  cd "$ROOT_DIR"

  # Sync binaries to Edge
  log "Syncing binaries to Edge..."
  for bin in node server zion-warp-server zion-dao zion-atomic-swap; do
    local src="$V3_DIR/target/release/${bin}"
    if [[ -x "$src" ]]; then
      scp -i "$EDGE_SSH_KEY" -o StrictHostKeyChecking=accept-new "$src" "root@${EDGE_HOST}:/root/zion-2.9.6-main/V3/target/release/${bin}"
    fi
  done

  # Restart Edge services (ignore inactive optional services)
  log "Restarting Edge services..."
  ssh_run "systemctl daemon-reload && systemctl restart zion-edge-node1 zion-edge-pool || true"
  ssh_run "systemctl restart zion-edge-node2 zion-edge-dao zion-edge-atomic-swap zion-edge-warp zion-edge-bridge 2>/dev/null || true"

  sleep 5

  # Verify Edge services
  local ok=0
  check_port "$EDGE_HOST" 8333 && ok=1
  check_port "$EDGE_HOST" 8443 && ok=1
  check_port "$EDGE_HOST" 8444 && ok=1

  if [[ "$ok" -eq 0 ]]; then
    err "Edge services failed to start (no open ports)"
  fi

  # Verify chain height
  local edge_height
  edge_height=$(rpc_get "$EDGE_HOST" 8443 "getChainInfo" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('chain_height','0'))" 2>/dev/null || echo "0")
  if [[ "$edge_height" -gt 0 ]]; then
    log "Edge node alive at height ${edge_height}"
  else
    warn "Edge node RPC returned height 0 — may still be syncing"
  fi

  log "Edge deploy OK"
}

# ── Phase 4: Local Start ──────────────────────────────────────────────────

phase_local_start() {
  phase "4/5 LOCAL START"
  if [[ "$SKIP_LOCAL" -eq 1 ]]; then
    warn "Local start skipped (--skip-local-start)"
    return
  fi

  cd "$ROOT_DIR"

  # Start Python dashboard
  if ! check_port 127.0.0.1 8766; then
    log "Starting Python dashboard..."
    python dashboard/app.py &
    sleep 2
  else
    info "Python dashboard already running on 8766"
  fi

  # Start local backup node + miners
  if [[ -x "scripts/launch-local-backup.sh" ]]; then
    bash scripts/launch-local-backup.sh
  else
    warn "launch-local-backup.sh not found — manual start required"
  fi

  log "Local start OK"
}

# ── Phase 5: Verify ───────────────────────────────────────────────────────

phase_verify() {
  phase "5/5 VERIFY"

  local failures=0

  # Edge RPC
  if check_port "$EDGE_HOST" 8443; then
    log "Edge RPC (8443): OK"
  else
    err "Edge RPC (8443): FAIL"; failures=$((failures+1))
  fi

  # Edge Pool
  if check_port "$EDGE_HOST" 8444; then
    log "Edge Pool (8444): OK"
  else
    err "Edge Pool (8444): FAIL"; failures=$((failures+1))
  fi

  # Edge P2P
  if check_port "$EDGE_HOST" 8333; then
    log "Edge P2P (8333): OK"
  else
    warn "Edge P2P (8333): FAIL"
  fi

  # Local RPC
  if check_port 127.0.0.1 8443; then
    log "Local RPC (8443): OK"
  else
    warn "Local RPC (8443): FAIL"
  fi

  # Local P2P
  if check_port 127.0.0.1 8333; then
    log "Local P2P (8333): OK"
  else
    warn "Local P2P (8333): FAIL"
  fi

  # Dashboard
  if check_port 127.0.0.1 8766; then
    log "Dashboard (8766): OK"
  else
    warn "Dashboard (8766): FAIL"
  fi

  # Prometheus
  if check_port "$EDGE_HOST" 9090; then
    log "Prometheus (9090): OK"
  else
    warn "Prometheus (9090): FAIL"
  fi

  # Grafana
  if check_port "$EDGE_HOST" 3100; then
    log "Grafana (3100): OK"
  else
    warn "Grafana (3100): FAIL"
  fi

  # Check sync gap
  local edge_height local_height gap
  edge_height=$(rpc_get "$EDGE_HOST" 8443 "getChainInfo" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('chain_height','0'))" 2>/dev/null || echo "0")
  local_height=$(rpc_get 127.0.0.1 8443 "getChainInfo" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('chain_height','0'))" 2>/dev/null || echo "0")

  if [[ "$edge_height" -gt 0 && "$local_height" -gt 0 ]]; then
    gap=$((edge_height - local_height))
    gap=${gap#-}  # abs
    if [[ "$gap" -le 5 ]]; then
      log "Sync gap: ${gap} blocks (OK)"
    elif [[ "$gap" -le 20 ]]; then
      warn "Sync gap: ${gap} blocks (syncing)"
    else
      err "Sync gap: ${gap} blocks (LAG)"; failures=$((failures+1))
    fi
  fi

  # Pool miners
  local miner_count
  miner_count=$(python3 -c "
import urllib.request, json
try:
    r = urllib.request.urlopen('http://${EDGE_HOST}:8455/miners?limit=50', timeout=3)
    d = json.loads(r.read().decode())
    print(d.get('count', 0))
except:
    print(0)
" 2>/dev/null || echo "0")
  if [[ "$miner_count" -gt 0 ]]; then
    log "Pool miners: ${miner_count} active"
  else
    warn "Pool miners: 0 (no miners connected)"
  fi

  # Payout status
  local payout_enabled
  payout_enabled=$(python3 -c "
import urllib.request, json
try:
    r = urllib.request.urlopen('http://127.0.0.1:8766/api/payout', timeout=3)
    d = json.loads(r.read().decode())
    print('enabled' if d.get('payout_enabled') else 'disabled')
except:
    print('unknown')
" 2>/dev/null || echo "unknown")
  if [[ "$payout_enabled" == "enabled" ]]; then
    log "Payout system: ENABLED"
  elif [[ "$payout_enabled" == "disabled" ]]; then
    warn "Payout system: DISABLED"
  else
    warn "Payout system: UNKNOWN"
  fi

  if [[ "$failures" -eq 0 ]]; then
    log "VERIFY ALL PASS"
  else
    err "VERIFY FAILURES: ${failures}"
  fi
}

# ── Main ────────────────────────────────────────────────────────────────────

main() {
  if [[ "$VERIFY_ONLY" -eq 1 ]]; then
    phase_verify
    exit 0
  fi

  log "ZION V3 Autopilot start (Edge-Primary topology)"
  log "Root: ${ROOT_DIR}"
  log "Edge: ${EDGE_HOST}"

  phase_preflight
  phase_build
  phase_edge_deploy
  phase_local_start
  phase_verify

  log "AUTOPILOT COMPLETE"
}

main
