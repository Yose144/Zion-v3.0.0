#!/usr/bin/env bash
# pool-ha-watchdog.sh — alert-only watchdog for the EDGE pool (A4.2).
#
# Runs on EDGE2 every ~30 s. Probes the ACTIVE pool two ways:
#   1. API health through the tunnel  → http://127.0.0.1:8080/health
#   2. Stratum TCP to the public IP   → <EDGE_IP>:8444
# Both must fail N consecutive ticks before one Telegram alert is sent
# (state file dedupes — one alert per incident, one recovery notice).
#
# IMPORTANT: this script NEVER starts the standby. Promotion is a manual
# operator decision (DNS at WebGlobe is manual anyway) — auto-promotion
# would risk a split-brain when the failure is a tunnel/network blip.
set -euo pipefail

ENV_FILE="${ZION_POOL_HA_ENV:-/etc/zion/pool-standby.env}"
[ -r "$ENV_FILE" ] || { echo "pool-ha-watchdog: missing env file $ENV_FILE" >&2; exit 2; }
# shellcheck disable=SC1090
. "$ENV_FILE"

API_URL="${ZION_POOL_API_URL:-http://127.0.0.1:8080}"
EDGE_HOST="${ZION_POOL_EDGE_HOST:-62.171.141.136}"
EDGE_STRATUM_PORT="${ZION_POOL_EDGE_STRATUM_PORT:-8444}"
FAIL_LIMIT="${ZION_POOL_HA_FAIL_LIMIT:-3}"          # ~90 s at 30 s cadence
ALERT_COOLDOWN_S="${ZION_POOL_HA_ALERT_COOLDOWN_S:-1800}"
STATE_DIR="${ZION_POOL_HA_STATE_DIR:-/var/lib/zion-pool-ha}"
STATE="$STATE_DIR/watchdog.state"

mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR" 2>/dev/null || true

fails=0; last_alert=0; status=ok
[ -r "$STATE" ] && . "$STATE" || true

api_ok=1; stratum_ok=1
curl --fail --silent --connect-timeout 5 --max-time 10 \
    -o /dev/null "$API_URL/health" || api_ok=0
timeout 8 bash -c "exec 3<>/dev/tcp/$EDGE_HOST/$EDGE_STRATUM_PORT && exec 3>&-" 2>/dev/null \
    || stratum_ok=0

now="$(date +%s)"

save() { printf 'fails=%s\nlast_alert=%s\nstatus=%s\n' "$fails" "$last_alert" "$status" > "$STATE"; }

tg() { # tg <text>
    [ -n "${ZION_TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${ZION_TELEGRAM_CHAT_ID:-}" ] || return 0
    curl --silent --max-time 15 \
        "https://api.telegram.org/bot${ZION_TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d chat_id="$ZION_TELEGRAM_CHAT_ID" \
        --data-urlencode "text=$1" >/dev/null || true
}

if [ "$api_ok" = 1 ] || [ "$stratum_ok" = 1 ]; then
    if [ "$status" = down ]; then
        tg "ZION POOL HA: EDGE pool RECOVERED (api_ok=$api_ok stratum_ok=$stratum_ok). Standby was NOT promoted automatically — verify EDGE state before deciding."
        status=ok
    fi
    fails=0
    save
    echo "pool-ha-watchdog: ok (api=$api_ok stratum=$stratum_ok)"
    exit 0
fi

fails=$((fails + 1))
if [ "$fails" -lt "$FAIL_LIMIT" ]; then
    save
    echo "pool-ha-watchdog: probe failed ($fails/$FAIL_LIMIT)" >&2
    exit 0
fi

status=down
if [ $((now - last_alert)) -ge "$ALERT_COOLDOWN_S" ]; then
    tg "ZION POOL HA ALERT: EDGE pool DOWN — API via tunnel + stratum $EDGE_HOST:$EDGE_STRATUM_PORT both failing for $fails consecutive checks. Standby is NOT auto-started (anti split-brain). Failover procedure: docs/3.2/POOL-HA-STANDBY.md"
    last_alert=$now
fi
save
echo "pool-ha-watchdog: DOWN (fails=$fails, alert sent)" >&2
exit 1
