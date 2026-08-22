#!/usr/bin/env bash
# ============================================================================
# ZION Unified Watchdog
#
# Single script for all deployment modes:
#   edge       — Edge primary V31 node/pool (system services, default)
#   backup     — local backup node + SSH tunnels (user services, P2P sync check)
#   new-server — bare-bones new-server V31 node/pool (system services)
#   v31        — legacy alias for edge (V31 production TCP JSON-RPC)
#
# Usage:
#   scripts/watchdog.sh [edge|backup|new-server|v31]
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

V31_RPC_PORT="9445"
V31_P2P_PORT="8335"
NODE_RPC_PORT="${V31_RPC_PORT}"
NODE_RPC="tcp://127.0.0.1:${NODE_RPC_PORT}"
NODE_JSONRPC="tcp://127.0.0.1:${NODE_RPC_PORT}"
POOL_HOST="127.0.0.1"
POOL_PORT="8444"
NODE_SERVICE="zion-v31-node"
POOL_SERVICE="zion-v31-pool"
SSH_TUNNEL_SERVICE="zion-ssh-tunnel"
BACKUP_NODE_SERVICE="zion-backup-node"
DASHBOARD_SERVICE=""
SSH_TUNNEL_PORTS=(9445 9446 9447 8080)

# Mode-specific defaults.
case "$MODE" in
  edge)
    : # keep defaults above
    ;;
  backup)
    USE_USER_SYSTEMD=1
    # Local backup node RPC; edge RPC used as sync reference.
    NODE_RPC_PORT="8446"
    NODE_RPC="tcp://127.0.0.1:${NODE_RPC_PORT}"
    NODE_JSONRPC="tcp://127.0.0.1:${NODE_RPC_PORT}"
    EDGE_RPC_PORT="9445"
    POOL_PORT="8444"
    NODE_SERVICE="zion-backup-node"
    POOL_SERVICE=""
    ;;
  new-server)
    : # keep defaults above (V31 production services)
    ;;
  v31)
    # V31 production Edge node (legacy "v31" alias, now same as edge).
    : # keep defaults above
    ;;
  *)
    echo "Unknown watchdog mode: $MODE" >&2
    echo "Usage: $0 [edge|backup|new-server|v31]" >&2
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

# Talk to the V31 raw TCP JSON-RPC port and extract a single field from the
# first response line. Returns the empty string on any failure.
v31_tcp_rpc() {
  local method="$1"
  local path="$2"
  local port="${3:-${NODE_RPC_PORT:-${V31_RPC_PORT:-9445}}}"
  local resp
  resp=$(printf '{"jsonrpc":"2.0","id":1,"method":"%s","params":[]}\n' "$method" | timeout 5 bash -c "exec 3<>/dev/tcp/127.0.0.1/${port}; cat >&3; head -1 <&3" 2>/dev/null)
  if [[ -z "$resp" ]]; then echo ""; return; fi
  echo "$resp" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('result',{}).get('${path}',''))" 2>/dev/null || echo ""
}

# V31 nodes speak raw TCP JSON-RPC, not HTTP.
check_node_http() {
  local version
  version=$(v31_tcp_rpc "getNodeInfo" "protocol_version" "${NODE_RPC_PORT:-${V31_RPC_PORT:-9445}}")
  [[ -n "$version" ]]
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
      [[ -n "$svc" ]] || continue
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
    # edge / new-server / v31: check node and pool services
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
  # Startup grace: do not restart a recently started node while it is still
  # performing first-start backfills (tx_index, UTXO migrations).
  local active_ts start_epoch now_epoch age
  active_ts=$(_systemctl show --property=ActiveEnterTimestamp --value "$NODE_SERVICE" 2>/dev/null | tr -d '\n')
  if [[ -n "$active_ts" && "$active_ts" != "n/a" ]]; then
    start_epoch=$(date -d "$active_ts" +%s 2>/dev/null || echo 0)
    now_epoch=$(date +%s)
    if [[ "$start_epoch" -gt 0 && "$now_epoch" -ge "$start_epoch" ]]; then
      age=$(( now_epoch - start_epoch ))
      if [[ "$age" -lt 300 ]]; then
        log "INFO: ${NODE_SERVICE} started ${age}s ago, within 300s startup grace; skipping health checks"
        return
      fi
    fi
  fi

  if ! check_node_http; then
    restart_service "$NODE_SERVICE" "V31 RPC on ${NODE_RPC} not reachable"
    return
  fi

  if [[ -n "$POOL_SERVICE" ]] && ! check_pool_tcp; then
    restart_service "$POOL_SERVICE" "pool TCP ${POOL_HOST}:${POOL_PORT} not reachable"
  fi
}

check_sync() {
  [[ "$MODE" == "backup" ]] || return 0

  local edge_height local_height gap peers
  edge_height=$(v31_tcp_rpc "getChainInfo" "native_chain_height" "${EDGE_RPC_PORT:-9445}")
  local_height=$(v31_tcp_rpc "getChainInfo" "native_chain_height" "${NODE_RPC_PORT:-8446}")
  peers=$(v31_tcp_rpc "getPeerInfo" "count" "${NODE_RPC_PORT:-8446}")

  if [[ -n "$edge_height" && -n "$local_height" ]]; then
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

  if [[ -n "$peers" && "$peers" -eq 0 && -n "$local_height" && "$local_height" -gt 0 ]]; then
    log "WARN: 0 P2P peers (local=${local_height})"
  fi

  log "OK: edge=${edge_height} local=${local_height} peers=${peers}"
}

check_v31() {
  [[ "$MODE" == "v31" ]] || return 0

  local status
  status=$(_systemctl is-active "$NODE_SERVICE" 2>/dev/null || echo "failed")
  if [[ "$status" != "active" ]]; then
    restart_service "$NODE_SERVICE" "service not active (was: $status)"
    return
  fi

  # Startup grace: the node may spend >60s on first-start backfills (tx_index,
  # UTXO migrations) before the RPC port is bound. Do not restart while it is
  # still within the grace window.
  local active_ts start_epoch now_epoch age
  active_ts=$(_systemctl show --property=ActiveEnterTimestamp --value "$NODE_SERVICE" 2>/dev/null | tr -d '\n')
  if [[ -n "$active_ts" && "$active_ts" != "n/a" ]]; then
    start_epoch=$(date -d "$active_ts" +%s 2>/dev/null || echo 0)
    now_epoch=$(date +%s)
    if [[ "$start_epoch" -gt 0 && "$now_epoch" -ge "$start_epoch" ]]; then
      age=$(( now_epoch - start_epoch ))
      if [[ "$age" -lt 300 ]]; then
        log "INFO: ${NODE_SERVICE} started ${age}s ago, within 300s startup grace; skipping RPC checks"
        return
      fi
    fi
  fi

  # Use getNodeInfo to confirm the TCP RPC is alive; protocol_version is a string.
  local v31_version
  v31_version=$(v31_tcp_rpc "getNodeInfo" "protocol_version")
  if [[ -z "$v31_version" ]]; then
    restart_service "$NODE_SERVICE" "V31 RPC (TCP ${NODE_RPC_PORT:-${V31_RPC_PORT}}) unreachable"
    return
  fi

  # Native V31 chain height. Height 0 is valid on a fresh genesis.
  local v31_height
  v31_height=$(v31_tcp_rpc "getChainInfo" "native_chain_height")
  if [[ -z "$v31_height" ]]; then
    restart_service "$NODE_SERVICE" "V31 RPC did not return native_chain_height"
    return
  fi

  if [[ -n "$POOL_SERVICE" ]] && ! check_pool_tcp; then
    restart_service "$POOL_SERVICE" "pool TCP ${POOL_HOST}:${POOL_PORT} not reachable"
  fi

  log "OK: v31=${v31_height} version=${v31_version}"
}

main() {
  log "=== ZION watchdog started (mode=${MODE}) ==="

  if [[ "$MODE" == "backup" ]]; then
    check_services
    check_health
    check_sync
  elif [[ "$MODE" == "v31" ]]; then
    check_v31
  else
    # edge / new-server: health checks are the source of truth; service-only
    # checks are a secondary fallback for when systemd reports a service down.
    check_services
    check_health
    log "OK: node=${NODE_SERVICE} pool=${POOL_SERVICE}"
  fi
}

main "$@"
