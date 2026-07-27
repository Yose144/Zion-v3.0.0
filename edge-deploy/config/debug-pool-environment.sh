# ZION Debug Pool — Common Environment
# Created: 2026-07-27 for Trinity 3.0.7 All Green E2E testing
#
# This file is sourced by per-coin debug pool instances. It inherits shared
# mainnet settings from the primary edge environment and forces a clean,
# deterministic test mode for a SINGLE external coin at a time.
#
# Usage on Edge:
#   source /etc/zion/debug-pool-environment.sh
#   ZION_POOL_AUXPOW_COIN=<COIN> ZION_POOL_AUXPOW_WALLET=<addr> \
#     /opt/zion/V3/target/release/server
#
# The systemd template zion-edge-debug-pool@.service passes overrides via
# Environment= directives per instance.

# Inherit mainnet shared variables (paths, fee splits, RPC addresses, etc.)
source /etc/zion/edge-environment.sh

# ── Debug pool identity ──
ZION_POOL_BIND="0.0.0.0:8461"
ZION_ROUTING_METRICS_BIND="127.0.0.1:8471"
ZION_NODE_RPC_ADDR="127.0.0.1:9443"
ZION_NODE_ID="zion-debug-pool"

# PPLNS state must be separate from the main pool to avoid cross-contamination
ZION_PPLNS_STATE_PATH="/data/zion/pplns-state-debug.json"

# ── Deterministic test mode ──
# Disable profit switching; the operator selects the coin explicitly.
ZION_POOL_PROFIT_SWITCH=0
ZION_STREAM_PROFIT_SWITCH=0
ZION_STREAM_PROFIT_INTERVAL=3600

# Keep ZION Deeksha enabled so the pool also emits ZION jobs; miners can select
# their lane. Disable multi-coin routing so only the chosen coin + ZION run.
ZION_BACKEND_AUTO_INCLUDE_ZION=1
ZION_POOL_AUXPOW_ENABLED=1
ZION_POOL_AUXPOW_SPLIT_ZION=1
ZION_POOL_AUXPOW_SPLIT_EXTERNAL=1

# Minimal TTL for quick job rotation during testing
ZION_JOB_TTL_MS=30000
ZION_NONCE_COUNT=262144
ZION_NONCE_COUNT_GPU=65536

# ── Logging ──
RUST_LOG=info,zion_pool=debug,auxpow_client=debug

# ── Per-coin overrides (template) ──
# The following are set by the caller / systemd instance:
#   ZION_POOL_AUXPOW_COIN=<COIN>
#   ZION_POOL_AUXPOW_WALLET=<payout address>
#   ZION_POOL_AUXPOW_WORKER_NAME=zion-debug
# All other coin wallets are cleared below to prevent accidental multi-bridge.
ZION_POOL_AUXPOW_WALLET_ZANO=
ZION_POOL_AUXPOW_WALLET_DCR=
ZION_POOL_AUXPOW_WALLET_EPIC=
ZION_POOL_AUXPOW_WALLET_FLUX=
ZION_POOL_AUXPOW_WALLET_EVR=
ZION_POOL_AUXPOW_WALLET_MEWC=
ZION_POOL_AUXPOW_WALLET_CLORE=
ZION_POOL_AUXPOW_WALLET_ETC=
ZION_POOL_AUXPOW_WALLET_KLS=
ZION_POOL_AUXPOW_WALLET_IRON=
ZION_POOL_AUXPOW_WALLET_DNX=
ZION_POOL_AUXPOW_WALLET_VTC=
ZION_POOL_AUXPOW_WALLET_ZCL=
ZION_POOL_AUXPOW_WALLET_QTC=
ZION_POOL_AUXPOW_WALLET_NEXA=
ZION_POOL_AUXPOW_WALLET_RTM=
ZION_POOL_AUXPOW_WALLET_XMR=
ZION_POOL_AUXPOW_WALLET_KAS=
ZION_POOL_AUXPOW_WALLET_ALPH=

# Clear CPU bridge wallets too; they are set per-instance if needed.
ZION_POOL_AUXPOW_CPU_COIN=""
ZION_POOL_AUXPOW_CPU_WALLET=""
ZION_POOL_AUXPOW_CPU_WORKER_NAME=""
