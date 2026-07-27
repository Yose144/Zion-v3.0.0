#!/usr/bin/env bash
# Start a per-coin ZION debug pool for Trinity 3.0.7 E2E testing.
# Does NOT interfere with the main pool on port 8444.
#
# Usage:
#   sudo bash edge-deploy/scripts/start-debug-pool.sh <COIN> [WALLET] [WORKER]
#
# Examples:
#   sudo bash edge-deploy/scripts/start-debug-pool.sh ETC 0x...
#   sudo bash edge-deploy/scripts/start-debug-pool.sh XMR <xmr-address>
#   sudo bash edge-deploy/scripts/start-debug-pool.sh RTM RBksKgzcxTWaewQQ7niX1KT4r4L5Ch8iJB

set -euo pipefail

COIN="${1^^}"
WALLET="${2:-}"
WORKER="${3:-zion-debug-$COIN}"
SERVICE="zion-edge-debug-pool@${COIN}"
ENV_DROPIN="/etc/systemd/system/${SERVICE}.service.d"

if [[ -z "$COIN" ]]; then
    echo "Usage: $0 <COIN> [WALLET] [WORKER]" >&2
    echo "Supported coins: ETC, XMR, RTM, VRSC, DCR, ERG, KAS, ALPH, RVN, EPIC, ZANO, VTC, ZCL, QTC, NEXA, KLS, IRON, DNX, CLORE, EVR, MEWC, FLUX" >&2
    exit 1
fi

echo "[debug-pool] Starting debug pool for coin: $COIN (port 8461)"

# Ensure the base environment file exists on Edge
if [[ ! -f /etc/zion/debug-pool-environment.sh ]]; then
    echo "[debug-pool] Installing /etc/zion/debug-pool-environment.sh ..."
    cp "$(dirname "$0")/../config/debug-pool-environment.sh" /etc/zion/debug-pool-environment.sh
    chmod 640 /etc/zion/debug-pool-environment.sh
    chown zion:zion /etc/zion/debug-pool-environment.sh
fi

# Create a per-instance drop-in for wallet and worker overrides
mkdir -p "$ENV_DROPIN"
cat > "${ENV_DROPIN}/coin.conf" <<EOF
[Service]
Environment="ZION_POOL_AUXPOW_COIN=${COIN}"
Environment="ZION_POOL_AUXPOW_WALLET=${WALLET}"
Environment="ZION_POOL_AUXPOW_WORKER_NAME=${WORKER}"
Environment="ZION_POOL_AUXPOW_CPU_COIN=${COIN}"
Environment="ZION_POOL_AUXPOW_CPU_WALLET=${WALLET}"
Environment="ZION_POOL_AUXPOW_CPU_WORKER_NAME=${WORKER}-cpu"
EOF

systemctl daemon-reload
systemctl stop "$SERVICE" 2>/dev/null || true
systemctl start "$SERVICE"
sleep 2

if systemctl is-active --quiet "$SERVICE"; then
    echo "[debug-pool] $SERVICE is active."
    echo "[debug-pool] Logs: journalctl -u $SERVICE -f"
    echo "[debug-pool] Miners connect to: 62.171.141.136:8461"
else
    echo "[debug-pool] ERROR: $SERVICE failed to start." >&2
    journalctl -u "$SERVICE" -n 30 --no-pager >&2
    exit 1
fi
