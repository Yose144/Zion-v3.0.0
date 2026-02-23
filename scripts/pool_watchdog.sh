#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# ZION Pool Watchdog — automatický restart zion-pool při pádu
# 
# Použití:
#   bash /opt/zion/scripts/pool_watchdog.sh &
#   nebo přidat do crontab:
#   * * * * * /opt/zion/scripts/pool_watchdog.sh >> /var/log/zion_watchdog.log 2>&1
#
# Kontroluje:
#   1. Docker container zion-pool (running)
#   2. TCP port 3333 (stratum)
#   3. HTTP /stats endpoint port 8080
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

POOL_CONTAINER="zion-pool"
STRATUM_PORT=3333
HTTP_PORT=8080
COMPOSE_FILE="/root/docker-compose.mainnet.yml"
LOG_PREFIX="[WATCHDOG $(date '+%Y-%m-%d %H:%M:%S')]"
MAX_RESTART_TRIES=3
RESTART_COUNT_FILE="/tmp/zion_watchdog_restarts"

# ─── Helper functions ──────────────────────────────────────────
log() {
  echo "$LOG_PREFIX $*"
}

check_container_running() {
  docker inspect --format '{{.State.Status}}' "$POOL_CONTAINER" 2>/dev/null | grep -q "running"
}

check_stratum_port() {
  timeout 3 bash -c "echo >/dev/tcp/localhost/$STRATUM_PORT" 2>/dev/null
}

check_http_stats() {
  curl -sf --max-time 5 "http://localhost:$HTTP_PORT/stats" 2>/dev/null | grep -q '"ok":true'
}

get_restart_count() {
  if [ -f "$RESTART_COUNT_FILE" ]; then
    cat "$RESTART_COUNT_FILE"
  else
    echo 0
  fi
}

increment_restart_count() {
  local count
  count=$(get_restart_count)
  echo $((count + 1)) > "$RESTART_COUNT_FILE"
}

reset_restart_count() {
  echo 0 > "$RESTART_COUNT_FILE"
}

restart_pool() {
  local reason="$1"
  local count
  count=$(get_restart_count)

  log "ALERT: Pool down (reason: $reason). Restart attempt $((count+1))/$MAX_RESTART_TRIES"

  if [ "$count" -ge "$MAX_RESTART_TRIES" ]; then
    log "ERROR: Max restarts ($MAX_RESTART_TRIES) reached. Manual intervention required!"
    # Check if pool recovered since last failure
    if check_http_stats; then
      log "Pool recovered on its own. Resetting counter."
      reset_restart_count
    fi
    return 1
  fi

  increment_restart_count

  # Try compose restart first
  if [ -f "$COMPOSE_FILE" ]; then
    log "Restarting via docker compose..."
    docker compose -f "$COMPOSE_FILE" restart "$POOL_CONTAINER" 2>&1 || true
  else
    log "Restarting via docker restart..."
    docker restart "$POOL_CONTAINER" 2>&1 || true
  fi

  # Wait for startup
  sleep 15

  if check_http_stats; then
    log "Pool restarted successfully. HTTP stats OK."
    reset_restart_count
    return 0
  else
    log "Pool still unhealthy after restart."
    return 1
  fi
}

# ─── Main check ────────────────────────────────────────────────
main() {
  # 1. Container running?
  if ! check_container_running; then
    restart_pool "container_not_running"
    exit 0
  fi

  # 2. Stratum port open?
  if ! check_stratum_port; then
    log "WARNING: Stratum port $STRATUM_PORT not responding"
    restart_pool "stratum_port_down"
    exit 0
  fi

  # 3. HTTP stats healthy?
  if ! check_http_stats; then
    restart_pool "http_stats_down"
    exit 0
  fi

  # All OK
  reset_restart_count
  log "OK: pool healthy (stratum:$STRATUM_PORT, http:$HTTP_PORT)"
}

main
