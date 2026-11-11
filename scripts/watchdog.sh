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
  edge2)
    # EDGE2 hosts the primary V31 node only — the pool stays on edge so the
    # stratum sees real miner IPs. Without this, the watchdog would keep
    # resurrecting the stale zion-v31-pool unit (fails on :8080, held by the
    # edge tunnel forward).
    POOL_SERVICE=""
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
    echo "Usage: $0 [edge|edge2|backup|new-server|v31]" >&2
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

# Per-node tip freshness from the G8 probe metric (added 2026-11-11).
# A missing metric means an older probe -> no-op, never a false alarm.
# Log-only by default: a restart costs a 60 s G8 sample, so opt in explicitly
# with ZION_WATCHDOG_STALE_RESTART=1 (RCA 2026-11-11: RPC reachable but tip
# 1-4 h old and the old watchdog did not notice).
TIP_AGE_HELPER="${ZION_TIP_AGE_HELPER:-/opt/zion/scripts/ops/node-tip-age.sh}"
check_primary_tip_fresh() {
  [[ -x "$TIP_AGE_HELPER" ]] || return 0
  local age
  if age=$("$TIP_AGE_HELPER" --service node_primary \
      --max-age "${ZION_WATCHDOG_TIP_MAX_AGE:-900}" 2>/dev/null); then
    return 0
  fi
  log "WARN: node_primary tip stale (age=${age:-unknown}s) — RPC answers but the node is not syncing"
  if [[ "${ZION_WATCHDOG_STALE_RESTART:-0}" == "1" ]]; then
    restart_service "$NODE_SERVICE" "primary tip stale (age=${age:-unknown}s)"
  fi
  return 0
}

check_pool_tcp() {
  [[ -n "$POOL_SERVICE" ]] || return 0
  timeout 3 bash -c "exec 3<>/dev/tcp/${POOL_HOST}/${POOL_PORT}" >/dev/null 2>&1
}

# Pool HTTP API liveness — the stratum TCP listener can stay reachable
# while the API (and share accounting) is wedged on a stale lock. Two
# consecutive unresponsive probes -> restart; the counter file survives
# across timer runs.
POOL_API_URL="${ZION_POOL_API_URL:-http://127.0.0.1:8080/stats}"
POOL_API_STATE="${ZION_POOL_API_STATE:-/var/tmp/zion-pool-api-fails}"

check_pool_api() {
  [[ -n "$POOL_SERVICE" ]] || return 0
  local fails=0
  [[ -f "$POOL_API_STATE" ]] && fails=$(cat "$POOL_API_STATE" 2>/dev/null || echo 0)
  # -f: a fast 503 from the API permit shed (API_MAX_IN_FLIGHT) means the
  # handler pool is parked on stuck locks — that is a wedge, not health.
  if curl -sf -o /dev/null --max-time 8 "$POOL_API_URL" 2>/dev/null; then
    [[ "$fails" -gt 0 ]] && echo 0 > "$POOL_API_STATE"
    return 0
  fi
  fails=$((fails + 1))
  echo "$fails" > "$POOL_API_STATE"
  log "WARN: pool API ${POOL_API_URL} unresponsive — fail ${fails}/2"
  if [[ "$fails" -ge 2 ]]; then
    restart_service "$POOL_SERVICE" "pool API unresponsive ${fails}x (wedged lock)"
    echo 0 > "$POOL_API_STATE"
  fi
  return 0
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

  check_primary_tip_fresh

  if [[ -n "$POOL_SERVICE" ]] && ! check_pool_tcp; then
    restart_service "$POOL_SERVICE" "pool TCP ${POOL_HOST}:${POOL_PORT} not reachable"
  fi

  check_pool_api
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
      # A node that is actively catching up gains height between two checks.
      # Restarting it throws away in-memory progress, and bulk P2P sync runs at
      # roughly 0.5 blocks/s — closing a ~1.5k gap needs ~45 uninterrupted
      # minutes. A blind restart therefore turns a slow catch-up into a
      # permanent restart loop (measured 2026-11-04: local stuck at ~107.8k
      # while the tip was ~109.4k, killed every 5 min for 6+ restarts).
      # Only restart when the height did NOT move since the previous check.
      local state_dir state_file prev_height=""
      state_dir="${XDG_STATE_HOME:-${HOME}/.local/state}/zion"
      state_file="${state_dir}/backup-node-height"
      if [[ -r "$state_file" ]]; then
        prev_height=$(tr -cd '0-9' <"$state_file" 2>/dev/null || true)
      fi
      mkdir -p "$state_dir" 2>/dev/null || true
      printf '%s\n' "$local_height" >"$state_file" 2>/dev/null || true

      if [[ -n "$prev_height" && "$local_height" -gt "$prev_height" ]]; then
        log "INFO: catching up +$((local_height - prev_height)) blocks since last check (edge=${edge_height} local=${local_height} gap=${gap}) — not restarting"
      elif [[ -z "$prev_height" ]]; then
        log "INFO: sync gap ${gap} (edge=${edge_height} local=${local_height}) — baseline recorded, progress is measured on the next run"
      else
        restart_service "$BACKUP_NODE_SERVICE" "sync gap ${gap} > 20 with no progress (edge=${edge_height} local=${local_height})"
        printf '%s\n' "$local_height" >"$state_file" 2>/dev/null || true
      fi
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

  # Full-state rebuild (UTXO re-validation on start) can take 30+ min on a
  # 50k+ block chain — a fixed grace window cannot cover it. If the RPC is
  # unreachable but the node process is alive and burning CPU, it is still
  # initializing; log and skip the restart.
  if [[ -z "$(v31_tcp_rpc "getNodeInfo" "protocol_version")" ]]; then
    local ncpu
    ncpu=$(ps -o %cpu= -C zion-node 2>/dev/null | awk '{s+=$1} END {printf "%d", s}')
    if [[ "${ncpu:-0}" -gt 20 ]]; then
      log "INFO: ${NODE_SERVICE} RPC not reachable but process busy (cpu=${ncpu}%) — still initializing; skipping restart"
      return
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

  # getTemplate probe: the template path can wedge (deadlock in node) while
  # the rest of the RPC stays alive — getNodeInfo/getChainInfo keep answering.
  # The bound is 30s (was 15s): under the Edge host's CPU saturation
  # (4 cores, 3 L1 nodes ~80-99% each + bitcoind IBD) a healthy getTemplate
  # legitimately takes 15-25s and the old bound produced false "wedged"
  # restarts — each restart rolls the tip back and orphans in-flight work.
  # A single failure is NOT enough to restart: the node recovers from short
  # template stalls on its own (utxo_set lock contention during block
  # import) and a restart costs ~10s of full RPC outage plus UTXO rebuild,
  # which is worse than the stall. Restart only after 3 consecutive
  # failures (watchdog runs ~60s apart → restart on a sustained >2-3min
  # wedge that does not self-recover). Both knobs are env-overridable.
  local tpl_bound="${ZION_WATCHDOG_TEMPLATE_TIMEOUT_S:-30}"
  local tpl_max_fails="${ZION_WATCHDOG_TEMPLATE_MAX_FAILS:-3}"
  local tpl_code
  tpl_code=$(curl -s -o /dev/null -w '%{http_code}' -m "$tpl_bound" -X POST \
    "http://127.0.0.1:${V31_RPC_PORT}" -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getTemplate","params":{"miner_address":"zion1test"}}' \
    2>/dev/null || echo "000")
  # NOTE: the unit runs with PrivateTmp=yes, so /tmp is a per-invocation
  # namespace and state written there never survives between watchdog runs.
  # The strike counter must live outside /tmp — /run is tmpfs-backed (cleared
  # at boot, which is fine) but shared across service invocations.
  local tpl_state="/run/zion-watchdog/template-fails"
  mkdir -p /run/zion-watchdog 2>/dev/null || true
  local tpl_fails=0
  [[ -f "$tpl_state" ]] && tpl_fails=$(cat "$tpl_state" 2>/dev/null || echo 0)
  if [[ "$tpl_code" != "200" ]]; then
    tpl_fails=$((tpl_fails + 1))
    echo "$tpl_fails" > "$tpl_state"
    if [[ "$tpl_fails" -ge "$tpl_max_fails" ]]; then
      echo 0 > "$tpl_state"
      restart_service "$NODE_SERVICE" "V31 getTemplate wedged ${tpl_fails}x consecutively (http=${tpl_code})"
      return
    fi
    log "WARN: getTemplate probe failed (http=${tpl_code}) — fail ${tpl_fails}/${tpl_max_fails}, waiting for self-recovery"
  else
    [[ "$tpl_fails" -gt 0 ]] && echo 0 > "$tpl_state"
  fi

  if [[ -n "$POOL_SERVICE" ]] && ! check_pool_tcp; then
    restart_service "$POOL_SERVICE" "pool TCP ${POOL_HOST}:${POOL_PORT} not reachable"
  fi

  check_pool_api

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
