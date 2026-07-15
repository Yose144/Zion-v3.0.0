#!/usr/bin/env bash
# ZION Edge Watchdog - runs on Edge server (via cron or systemd timer)
# Checks node + pool health and restarts if needed.
#
# NOTE: Service names differ between deployments:
#   Old Edge (77.42.71.94): zion-edge-node1, zion-edge-pool
#   New Edge (62.171.141.136): zion-node, zion-pool
# Set NODE_SERVICE and POOL_SERVICE below to match your deployment.

set -uo pipefail

NODE_RPC="http://127.0.0.1:8443/health"
NODE_JSONRPC="http://127.0.0.1:8443/jsonrpc"
POOL_HOST="127.0.0.1"
POOL_PORT="8444"
NODE_SERVICE="zion-edge-node1"
POOL_SERVICE="zion-edge-pool"
ALERT_WEBHOOK=""  # optional: Discord/Slack webhook URL

LOG_FILE="/var/log/zion-edge-watchdog.log"

log_msg() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

NODE_OK=false
POOL_OK=false

# Check node via RPC
if curl -sf "$NODE_RPC" >/dev/null 2>&1; then
    NODE_OK=true
fi

# Check pool via TCP
if timeout 3 bash -c "exec 3<>/dev/tcp/${POOL_HOST}/${POOL_PORT}" 2>/dev/null; then
    POOL_OK=true
fi

if [[ "$NODE_OK" == "false" ]]; then
    log_msg "[ALERT] Node healthcheck failed. Restarting ${NODE_SERVICE}..."
    systemctl restart "$NODE_SERVICE"
    sleep 10
    if curl -sf "$NODE_RPC" >/dev/null 2>&1; then
        log_msg "[RECOVER] Node restarted successfully."
    else
        log_msg "[CRITICAL] Node restart FAILED. Manual intervention required."
        # Optional: send alert webhook here
    fi
fi

if [[ "$POOL_OK" == "false" ]]; then
    log_msg "[ALERT] Pool TCP check failed. Restarting ${POOL_SERVICE}..."
    systemctl restart "$POOL_SERVICE"
    sleep 5
    if timeout 3 bash -c "exec 3<>/dev/tcp/${POOL_HOST}/${POOL_PORT}" 2>/dev/null; then
        log_msg "[RECOVER] Pool restarted successfully."
    else
        log_msg "[CRITICAL] Pool restart FAILED. Manual intervention required."
    fi
fi

# Height advancing check (getChainInfo returns chain_height)
HEIGHT=$(curl -s --max-time 5 "$NODE_JSONRPC" -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' | jq -r '.result.chain_height // empty' 2>/dev/null)
if [[ -n "$HEIGHT" && "$HEIGHT" -lt 1 ]] 2>/dev/null; then
    log_msg "[WARN] Node height stuck at $HEIGHT"
fi

if [[ "$NODE_OK" == "true" && "$POOL_OK" == "true" ]]; then
    log_msg "[OK] Node + Pool healthy. Height=$HEIGHT"
fi
