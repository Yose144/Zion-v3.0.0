#!/usr/bin/env bash
# ============================================================================
# ZION Unified Watchdog
#
# Single script for all deployment modes:
#   edge       — Edge primary node/pool (system services, default)
#   backup     — local backup node + SSH tunnels (user services, P2P sync check)
#   new-server — bare-bones new-server node/pool (system services)
#
# Usage:
#   scripts/watchdog.sh [edge|backup|new-server]
#
# Environment variables:
#   ZION_WATCHDOG_MODE          fallback mode if no argument is given
#   ZION_WATCHDOG_LOG           optional log file (defaults to journal/stdout)
#   ZION_WATCHDOG_LOG_TO_LOGGER if set, also emit to logger(1)
#
# Operational defaults are overridable per-mode below.
# ============================================================================

set -euo pipefail

MODE="${1:-${ZION_WATCHDOG_MODE:-edge}}"
LOG_FILE="${ZION_WATCHDOG_LOG:-}"
USE_USER_SYSTEMD=0

NODE_RPC="http://127.0.0.1:9443/health"
NODE_JSONRPC="http://127.0.0.1:9443/jsonrpc"
POOL_HOST="127.0.0.1"
POOL_PORT="8444"
NODE_SERVICE="zion-edge-node1"
POOL_SERVICE="zion-edge-pool"
SSH_TUNNEL_SERVICE="zion-ssh-tunnel"
BACKUP_NODE_SERVICE="zion-backup-node"
DASHBOARD_SERVICE="zion-edge-python-dashboard"
SSH_TUNNEL_PORTS=(9443 8453 9101)

# Mode-specific defaults.
case "$MODE" in
  edge)
    : # keep defaults above
    ;;
  backup)
    USE_USER_SYSTEMD=1
    # Local backup node RPC; edge RPC used as sync reference.
    NODE_RPC="http://127.0.0.1:8448/health"
    NODE_JSONRPC="http://127.0.0.1:8448/jsonrpc"
    EDGE_JSONRPC="http://127.0.0.1:9443/jsonrpc"
    POOL_PORT="8445"
    NODE_SERVICE="zion-backup-node"
    POOL_SERVICE=""
    ;;
  new-server)
    NODE_SERVICE="zion-edge-node1"
    POOL_SERVICE="zion-edge-pool"
    ;;
  *)
    echo "Unknown watchdog mode: $MODE" >&2
    echo "Usage: $0 [edge|backup|new-server]" >&2
    exit 1
    ;;
esac

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg"
  if [[ -n "$LOG_FILE" ]]; then
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "$msg" >> "$LOG_FILE"
  fi
  if [[ -n "${ZION_WATCHDOG_LOG_TO_LOGGER:-}" ]]; then
    logger -t "zion-watchdog[$MODE]" "$*"
  fi
}

_systemctl() {
  if [[ "$USE_USER_SYSTEMD" -eq 1 ]]; then
    systemctl --user "$@"
  else
    systemctl "$@"
  fi
}

restart_service() {
  local svc="$1"
  local reason="$2"
  log "RESTART: ${svc} — ${reason}"
  if _systemctl restart "$svc" 2>/dev/null; then
    sleep 3
    local status
    status=$(_systemctl is-active "$svc" 2>/dev/null || echo "failed")
    log "RESTART RESULT: ${svc} → ${status}"
  else
    log "FAILED to restart ${svc}"
  fi
}

check_node_http() {
  curl -sf --max-time 5 "$NODE_RPC" >/dev/null 2>&1
}

check_pool_tcp() {
  [[ -n "$POOL_SERVICE" ]] || return 0
  timeout 3 bash -c "exec 3<>/dev/tcp/${POOL_HOST}/${POOL_PORT}" >/dev/null 2>&1
}

rpc_get() {
  local url="$1"
  local method="$2"
  local path="$3"
  curl -s --max-time 5 -X POST "$url" \
    -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"${method}\",\"params\":[],\"id\":1}" 2>/dev/null \
    | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('result',{}).get('${path}',0))" 2>/dev/null || echo 0
}

# ── Mode-specific checks ───────────────────────────────────────────────────

check_services() {
  if [[ "$MODE" == "backup" ]]; then
    for svc in "$SSH_TUNNEL_SERVICE" "$BACKUP_NODE_SERVICE" "$DASHBOARD_SERVICE"; do
      local status
      status=$(_systemctl is-active "$svc" 2>/dev/null || echo "failed")
      if [[ "$status" != "active" ]]; then
        restart_service "$svc" "service not active (was: $status)"
      fi
    done

    for port in "${SSH_TUNNEL_PORTS[@]}"; do
      if ! ss -tlnp 2>/dev/null | grep -q "127.0.0.1:${port}"; then
        log "WARN: SSH tunnel port ${port} not listening"
        restart_service "$SSH_TUNNEL_SERVICE" "port ${port} not forwarding"
        break
      fi
    done
  else
    # edge / new-server: check node and pool services
    for svc in "$NODE_SERVICE" "$POOL_SERVICE"; do
      [[ -n "$svc" ]] || continue
      local status
      status=$(_systemctl is-active "$svc" 2>/dev/null || echo "failed")
      if [[ "$status" != "active" ]]; then
        restart_service "$svc" "service not active (was: $status)"
      fi
    done
  fi
}

check_health() {
  if ! check_node_http; then
    restart_service "$NODE_SERVICE" "health endpoint ${NODE_RPC} not reachable"
    return
  fi

  if [[ -n "$POOL_SERVICE" ]] && ! check_pool_tcp; then
    restart_service "$POOL_SERVICE" "pool TCP ${POOL_HOST}:${POOL_PORT} not reachable"
  fi
}

check_sync() {
  [[ "$MODE" == "backup" ]] || return 0

  local edge_height local_height gap peers
  edge_height=$(rpc_get "$EDGE_JSONRPC" "getChainInfo" "chain_height")
  local_height=$(rpc_get "$NODE_JSONRPC" "getChainInfo" "chain_height")
  peers=$(rpc_get "$NODE_JSONRPC" "getNodeInfo" "known_peers")

  if [[ "$edge_height" -gt 0 && "$local_height" -gt 0 ]]; then
    gap=$(( edge_height - local_height ))
    if [[ $gap -lt 0 ]]; then
      gap=$(( -gap ))
    fi
    if [[ $gap -gt 20 ]]; then
      restart_service "$BACKUP_NODE_SERVICE" "sync gap ${gap} > 20 (edge=${edge_height} local=${local_height})"
    elif [[ $gap -gt 5 ]]; then
      log "INFO: sync gap ${gap} (edge=${edge_height} local=${local_height}) — monitoring"
    fi
  fi

  if [[ "$peers" -eq 0 && "$local_height" -gt 0 ]]; then
    restart_service "$BACKUP_NODE_SERVICE" "0 P2P peers"
  fi

  log "OK: edge=${edge_height} local=${local_height} peers=${peers}"
}

main() {
  log "=== ZION watchdog started (mode=${MODE}) ==="

  if [[ "$MODE" == "backup" ]]; then
    check_services
    check_health
    check_sync
  else
    # edge / new-server: health checks are the source of truth; service-only
    # checks are a secondary fallback for when systemd reports a service down.
    check_services
    check_health
    log "OK: node=${NODE_SERVICE} pool=${POOL_SERVICE}"
  fi
}

main "$@"
