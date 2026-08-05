# ZION Edge Server — Common Environment
# Updated: 2026-07-15 - 3.0.6 "Triple Parallel" — 3-stream parallel mining
#                        RPC addr corrected: direct node RPC is 127.0.0.1:9443
#                        AuxPow enabled for 3-stream parallel mining
#                        EPIC wallet added for ProgPow support
# Updated: 2026-07-08 - Post 3.0.4 Hard Genesis Reset (new server 62.171.141.136)
#                        Updated all addresses to hard-reset canonical addresses
#                        Fixed env var name: ZION_POOL_SK → ZION_POOL_PAYOUT_SK_HEX
#
# This file contains SHARED environment variables for ALL Edge services.
# Service-specific overrides (node ID, bind ports, state paths) are set
# in each systemd service via Environment= directives.
#
# Server runs:
#   - Node (Primary / Genesis) — P2P 8335, RPC 9445 (localhost, direct)
#   - Pool (Primary) — connects to Node RPC 9445, Stratum 8444 public, HTTP API/metrics 8080
#   - Bridge, DAO, Atomic-Swap, WARP — all connect to Node RPC 9445
#   - nginx TCP stream proxy public 8443 → 9445 for public RPC (rpc.zionterranova.com:8443)

# ── Canonical Fee Split Addresses (89/5/5/1 burn model — no pool fee wallet) ──
# NOTE: ZION_MINER_ADDRESS = default_miner canonical wallet (89% coinbase).
# Local miners should set their own ZION_MINER_ADDRESS in launch scripts.
ZION_MINER_ADDRESS=zion1d6m0h2r8m7k8k2d8n072y7j3j4m0254323vq0e3

# Edge CPU miner payout address (must be a valid 44-char zion1 address)
ZION_PAYOUT_ADDRESS=zion1d6m0h2r8m7k8k2d8n072y7j3j4m0254323vq0e3
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
ZION_NODE_RPC_ADDR=127.0.0.1:9445
ZION_L1_RPC_URL=http://127.0.0.1:9445
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
ZION_POOL_API_BIND=0.0.0.0:8080
# Legacy V3 routing metrics port (unused by V31; kept for reference)
# ZION_ROUTING_METRICS_BIND=127.0.0.1:8455

# ── AuxPow / Stream Profit Configuration ────────────────────────────────────
# Required after chain-stall fix (2026-07-13). Without these the pool may
# issue only external jobs or omit ZION from the work assignment.
ZION_BACKEND_AUTO_INCLUDE_ZION=1
ZION_POOL_AUXPOW_ENABLED=1
ZION_POOL_AUXPOW_COIN=ZANO
ZION_POOL_AUXPOW_WALLET_ZANO=ZxCj5kQhNdW7xtt4hDTotBPGUsWYKRdtdPTFXjzFpPpf6q42rCVXcYnTtHRYGj3pzz2LUqCnvVoRzFn9zfZdCSzC1CkBiHYrg
ZION_POOL_AUXPOW_SPLIT_ZION=4
ZION_POOL_AUXPOW_SPLIT_EXTERNAL=1
# ZION_POOL_AUXPOW_WALLET is the fallback wallet for external AuxPoW pools.
# It must match the payout currency of the pool you actually connect to.
# The default below is a BTC address (suitable for NiceHash-style BTC-payout
# pools). If you mine a coin that pays out in that coin (e.g. ZANO → ZANO
# address), set ZION_POOL_AUXPOW_WALLET_ZANO securely on the server, NOT here.
ZION_POOL_AUXPOW_WALLET=bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh
ZION_POOL_AUXPOW_WORKER_NAME=zion-pool
ZION_POOL_AUXPOW_POOL_PREFERENCE=default
ZION_POOL_AUXPOW_REGION=eu
ZION_POOL_AUXPOW_PROFIT_CHECK_INTERVAL=60
ZION_POOL_AUXPOW_HYSTERESIS_PCT=15.0

# Stream profit weights used by the Deeksha Chv3 pipeline.
ZION_STREAM_PROFIT_SWITCH=true
ZION_STREAM_PROFIT_API_PROVIDER=whattomine
ZION_STREAM_PROFIT_INTERVAL=120
ZION_STREAM_HYSTERESIS_PCT=15.0
ZION_STREAM_PROFIT_SOURCES=zion,keccak_bonus,sha3_bonus,ncl_ai,deeksha_lite,thermal_bonus

# Pool wallet (Edge primary — handles all payouts)
# Address: zion1e4489793c5x2r0a0a4d8z7r4u5d6k0s4k3ht5m2 (pool_payout canonical wallet)
ZION_POOL_WALLET=zion1e4489793c5x2r0a0a4d8z7r4u5d6k0s4k3ht5m2
ZION_POOL_PAYOUT_SK_HEX=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# Atomic Swap escrow key (air-gapped — set via secure environment)
ZION_SWAP_ESCROW_KEY=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# Atomic Swap API bearer token (mainnet requires this — C1)
ZION_SWAP_BEARER_TOKEN=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# DAO API key for write endpoints (mainnet requires this — C1)
ZION_DAO_API_KEY=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# ZIONOS Rust dashboard control token (POST / PUT / DELETE /mutating endpoints)
ZIONOS_CONTROL_TOKEN=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# Python dashboard Basic Auth users (format: user:sha256hex,user2:sha256hex)
# Generate hash: python3 -c "import hashlib; print(hashlib.sha256(b'password').hexdigest())"
DASHBOARD_USERS=admin:<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# Bridge validator key file (path to the Ed25519/EVM validator private key file)
ZION_BRIDGE_VALIDATOR_KEY_FILE=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

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
# Edge primary keeps full chain history after 2026-07-20 hard genesis reset.
ZION_BLOCK_RETENTION=0

# Per-coin AuxPow wallet overrides are intentionally NOT stored in this file.
# Set them securely on the server (e.g. in the systemd EnvironmentFile override)
# and never commit pool passwords or private payout addresses to git.

# ── GPU AuxPow Bridge (ZANO / ProgPoWZ) ──
# Zano uses ProgPoWZ (ProgPow 0.9.2 with permuted math ops) on HeroMiners.
# ZANO pays in ZANO, not BTC. Wallet set above and on Edge server.
# ZION_POOL_AUXPOW_WALLET_ZANO is set at line 65 (local) + /etc/zion/edge-environment.sh (Edge).
#
# ── CPU AuxPow Bridge (VRSC / VerusHash — Claymore triple parallel) ──
# Second AuxPow bridge for CPU-only coins. Connects to LuckPool (VRSC)
# and embeds jobs as `external_stream_cpu` in Job messages.
# Miner runs ZION (GPU) + EPIC/ZANO (GPU) + VRSC (CPU) simultaneously.
ZION_POOL_AUXPOW_CPU_COIN="VRSC"
ZION_POOL_AUXPOW_CPU_WALLET="RLFQYsdd8wGGUgMgk17WrqdGNtkAVSCfDQ"
ZION_POOL_AUXPOW_CPU_WORKER_NAME="zion_triple"
ZION_POOL_AUXPOW_CPU_REGION="eu"
