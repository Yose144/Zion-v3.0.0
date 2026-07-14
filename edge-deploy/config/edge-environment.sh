# ZION Edge Server — Common Environment
# Updated: 2026-07-08 - Post 3.0.4 Hard Genesis Reset (new server 62.171.141.136)
#                        Updated all addresses to hard-reset canonical addresses
#                        Fixed env var name: ZION_POOL_SK → ZION_POOL_PAYOUT_SK_HEX
#
# This file contains SHARED environment variables for ALL Edge services.
# Service-specific overrides (node ID, bind ports, state paths) are set
# in each systemd service via Environment= directives.
#
# Server runs:
#   - Node (Primary / Genesis) — P2P 8333, RPC 8443 (localhost)
#   - Pool (Primary) — connects to Node RPC, Stratum 8444 public
#   - Bridge, DAO, Atomic-Swap, WARP — all connect to Node RPC

# ── Canonical Fee Split Addresses (89/5/5/1 burn model — no pool fee wallet) ──
# NOTE: ZION_MINER_ADDRESS = default_miner canonical wallet (89% coinbase).
# Local miners should set their own ZION_MINER_ADDRESS in launch scripts.
ZION_MINER_ADDRESS=zion1d6m0h2r8m7k8k2d8n072y7j3j4m0254323vq0e3
ZION_HUMANITARIAN_WALLET=zion1e0u5q5s660k4m4a634p2c2v358r8g59564054z7
ZION_ISSOBELLA_WALLET=zion1f7y7l5k678y0v408e8s654d2282346k375526t2
# Network configuration
ZION_NETWORK=Mainnet
ZION_SEED_PEERS=127.0.0.1:8334

# Burn model: 1% pool fee is burned (never minted). Set to 0 so the pool
# does not double-deduct — the protocol burn happens in core coinbase.
ZION_POOL_FEE_PCT=0

# ── Pool Configuration (PRIMARY — accepts all miners) ──
ZION_POOL_BIND=0.0.0.0:8444
ZION_NODE_RPC_ADDR=127.0.0.1:8443
ZION_POOL_LOOP_COUNT=1000000
ZION_MAX_SESSIONS_PER_IP=10
# GPU optimization: nonce_count tuned for RX 5700 XT @ ~19.25 KH/s (deeksha_lite_v1).
# Benchmark 2026-06-07: deeksha_lite_v1=19.25 KH/s, cosmic_harmony=3.29 KH/s, fire=10.15 KH/s.
# 524288 nonces = ~27s work @ 19.25 KH/s = 45% GPU util with 60s TTL.
# 1048576 nonces = ~54s work @ 19.25 KH/s = 91% GPU util with 60s TTL.
ZION_NONCE_COUNT=1048576
ZION_NONCE_COUNT_GPU=262144
ZION_NONCE_STRIDE=1048576
ZION_JOB_TTL_MS=60000
ZION_VARDIFF_START_DIFF=1
ZION_VARDIFF_MIN_DIFF=1
ZION_VARDIFF_MAX_DIFF=10000
ZION_VARDIFF_TARGET_SECS=15
ZION_VARDIFF_RETARGET_SHARES=6
ZION_PPLNS_WINDOW_SIZE=500000
ZION_PPLNS_STATE_PATH=/data/zion/pplns-state.json
ZION_ROUTING_METRICS_BIND=0.0.0.0:8455

# Pool wallet (Edge primary — handles all payouts)
# Address: zion1e4489793c5x2r0a0a4d8z7r4u5d6k0s4k3ht5m2 (pool_payout canonical wallet)
ZION_POOL_WALLET=zion1e4489793c5x2r0a0a4d8z7r4u5d6k0s4k3ht5m2
ZION_POOL_PAYOUT_SK_HEX=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# Atomic Swap escrow key (air-gapped — set via secure environment)
ZION_SWAP_ESCROW_KEY=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# F4.7 max TX amount cap (active from height 1 on fresh chain)
ZION_MAX_TX_AMOUNT_HEIGHT=1

# F5 balance check (active from genesis on fresh chain — height 0)
ZION_BALANCE_CHECK_HEIGHT=0
ZION_MIGRATION_HEIGHT=1

# Account-model memo v1 hard fork activation height
# Fresh chain (post 3.0.4 hard reset) — active from genesis (default 0).
# No override needed. Set to non-zero only for coordinated fork on existing chain.
ZION_ACCOUNT_TX_MEMO_V1_HEIGHT=0

# Block retention window (Session 9 memory patch)
ZION_BLOCK_RETENTION=10000
ZION_POOL_AUXPOW_ENABLED="0"
ZION_POOL_AUXPOW_COIN=""
ZION_POOL_AUXPOW_POOL_PREFERENCE="default"
ZION_POOL_AUXPOW_REGION="eu"
ZION_POOL_AUXPOW_SPLIT_ZION="50"
ZION_POOL_AUXPOW_SPLIT_EXTERNAL="50"
ZION_POOL_AUXPOW_WALLET=""
ZION_POOL_AUXPOW_WORKER_NAME="zion_auxpow"
ZION_POOL_AUXPOW_WALLET_DCR=""
ZION_POOL_AUXPOW_WALLET_ALPH=""
ZION_POOL_AUXPOW_WALLET_KAS=""
ZION_POOL_AUXPOW_WALLET_ERG=""
ZION_POOL_AUXPOW_WALLET_RVN=""
ZION_POOL_AUXPOW_WALLET_ETC=""
ZION_POOL_AUXPOW_WALLET_EVR=""
ZION_POOL_AUXPOW_WALLET_MEWC=""
ZION_POOL_AUXPOW_WALLET_FLUX=""
ZION_POOL_AUXPOW_WALLET_CLORE=""
ZION_POOL_AUXPOW_WALLET_XMR=""
ZION_POOL_AUXPOW_WALLET_VRSC=""
ZION_POOL_AUXPOW_WALLET_PRL=""
