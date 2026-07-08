#!/usr/bin/env bash
# ============================================================================
#  ZION Autonomous Watchdog
#  - Checks all systemd user services
#  - Auto-restarts failed services
#  - Checks P2P sync gap, restarts backup node if too far behind
#  - Checks SSH tunnel ports
#  - Logs to logs/watchdog.log
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="${REPO_ROOT}/logs/watchdog.log"
mkdir -p "${REPO_ROOT}/logs"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"
}

restart_service() {
  local svc="$1"
  local reason="$2"
  log "RESTART: ${svc} — ${reason}"
  systemctl --user restart "$svc" 2>> "$LOG" || log "FAILED to restart ${svc}"
  sleep 3
  local status
  status=$(systemctl --user is-active "$svc" 2>/dev/null || echo "failed")
  log "RESTART RESULT: ${svc} → ${status}"
}

# ── Check systemd services ──────────────────────────────────────────────────
for svc in zion-ssh-tunnel zion-backup-node zion-dashboard; do
  status=$(systemctl --user is-active "$svc" 2>/dev/null || echo "failed")
  if [[ "$status" != "active" ]]; then
    restart_service "$svc" "service not active (was: $status)"
  fi
done

# ── Check SSH tunnel ports ──────────────────────────────────────────────────
for port in 8443 8444 9333 9101; do
  if ! ss -tlnp 2>/dev/null | grep -q "127.0.0.1:${port}"; then
    log "WARN: SSH tunnel port ${port} not listening"
    restart_service "zion-ssh-tunnel" "port ${port} not forwarding"
    break  # restart once, recheck next cycle
  fi
done

# ── Check P2P sync gap ──────────────────────────────────────────────────────
EDGE_HEIGHT=$(curl -s --max-time 5 -X POST http://127.0.0.1:8443/rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('chain_height',0))" 2>/dev/null || echo 0)

LOCAL_HEIGHT=$(curl -s --max-time 5 -X POST http://127.0.0.1:8446/rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('chain_height',0))" 2>/dev/null || echo 0)

if [[ "$EDGE_HEIGHT" -gt 0 && "$LOCAL_HEIGHT" -gt 0 ]]; then
  GAP=$(( EDGE_HEIGHT - LOCAL_HEIGHT ))
  if [[ $GAP -lt 0 ]]; then
    GAP=$(( -GAP ))
  fi
  if [[ $GAP -gt 20 ]]; then
    log "SYNC GAP: edge=${EDGE_HEIGHT} local=${LOCAL_HEIGHT} gap=${GAP} — restarting backup node"
    restart_service "zion-backup-node" "sync gap ${GAP} > 20"
  elif [[ $GAP -gt 5 ]]; then
    log "INFO: sync gap ${GAP} (edge=${EDGE_HEIGHT} local=${LOCAL_HEIGHT}) — monitoring"
  fi
fi

# ── Check P2P peers ─────────────────────────────────────────────────────────
PEERS=$(curl -s --max-time 5 -X POST http://127.0.0.1:8446/rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getNodeInfo","params":[],"id":1}' 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('known_peers',0))" 2>/dev/null || echo 0)

if [[ "$PEERS" -eq 0 ]] && [[ "$LOCAL_HEIGHT" -gt 0 ]]; then
  log "WARN: backup node has 0 peers — restarting"
  restart_service "zion-backup-node" "0 P2P peers"
fi

# ── Summary ─────────────────────────────────────────────────────────────────
log "OK: edge=${EDGE_HEIGHT} local=${LOCAL_HEIGHT} peers=${PEERS}"
