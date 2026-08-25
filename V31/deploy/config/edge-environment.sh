# ZION Edge Server — Common Environment
# Updated: 2026-08-24 - Edge CPU miner re-activation (ZION-only, CPU backend)
#                        Wallet / worker / threads / Nice / CPUQuota templated.
# Updated: 2026-08-23 - V31 L5/L6 fund trackers
#                        Direct node RPC is 127.0.0.1:9445 (V31 native)
#                        DAO API is 127.0.0.1:8456
#                        Added Free World / Issobella tracker env vars
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
ZION_MINER_ADDRESS=zion1074344t7k686j6n8a0l6t0f4c8d828y083xh4m2

# Edge CPU miner payout address (must be a valid 44-char zion1 address)
ZION_PAYOUT_ADDRESS=zion1074344t7k686j6n8a0l6t0f4c8d828y083xh4m2

# ── Edge CPU-only ZION miner settings ─────────────────────────────────────────
# Used by zion-v31-miner.service. GPU backend is forced to CPU because the Edge
# server has no OpenCL/CUDA devices. AuxPoW streams are disabled; only the ZION
# (Stream 1) PoW is mined locally against zion-v31-pool (127.0.0.1:8444).
ZION_MINER_WALLET=zion1s6m204400290l660k622r3r0c6u040g5j6cu2x5
ZION_MINER_WORKER=proEricku!
ZION_MINER_THREADS=4
ZION_GPU_BACKEND=cpu
ZION_HUMANITARIAN_WALLET=zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8
ZION_ISSOBELLA_WALLET=zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0
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
# GPU optimization: nonce_count tuned for RX 5700 XT @ ~19.25 KH/s (ekam_deeksha).
# Benchmark 2026-06-07: ekam_deeksha=19.25 KH/s.
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
ZION_POOL_AUXPOW_WALLET_ZANO=ZxCFngZg2XUHmxm7zTL9jwEaDKNPCBDoCZv44myC6PesBXEXrbq8NRaDpkmL7utcYhiLXB2KiJyVmA5atrQbd7Ai2SX3nptts
ZION_POOL_AUXPOW_SPLIT_ZION=4
ZION_POOL_AUXPOW_SPLIT_EXTERNAL=1
# ZION_POOL_AUXPOW_WALLET is the fallback wallet for external AuxPoW pools.
# It must match the payout currency of the pool you actually connect to.
# The default below is a BTC address (suitable for NiceHash-style BTC-payout
# pools). If you mine a coin that pays out in that coin (e.g. ZANO → ZANO
# address), set ZION_POOL_AUXPOW_WALLET_ZANO securely on the server, NOT here.
ZION_POOL_AUXPOW_WALLET=bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh
# Base worker name used for all AuxPoW upstream connections.
# The pool appends .<coin> to this (e.g. zion-pool.vrsc, zion-pool.zano).
# auxpow_runtime.rs reads ZION_POOL_AUXPOW_WORKER (not _WORKER_NAME).
ZION_POOL_AUXPOW_WORKER="zion-pool"
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
# Address: zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6 (pool_payout canonical wallet)
ZION_POOL_WALLET=zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6
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
# Per-coin wallet override used by auxpow_runtime.rs (format: ZION_POOL_AUXPOW_WALLET_<COIN>)
ZION_POOL_AUXPOW_WALLET_VRSC="RLFQYsdd8wGGUgMgk17WrqdGNtkAVSCfDQ"
# Backward-compatible alias for scripts that still reference CPU_WALLET
ZION_POOL_AUXPOW_CPU_WALLET="RLFQYsdd8wGGUgMgk17WrqdGNtkAVSCfDQ"
ZION_POOL_AUXPOW_CPU_WORKER_NAME="zion_triple"
ZION_POOL_AUXPOW_CPU_REGION="eu"

# ── WARP bridge (non-EVM) configuration ───────────────────────────────────────
# Set these in the Edge service EnvironmentFile override when real contracts are
# deployed. The shared file below is an INVENTORY only — real relay keys and
# contract addresses must NEVER be committed to git.
#
# L1 destination used by inbound proofs
WARP_L1_RPC_URL=http://127.0.0.1:9445
WARP_L1_VAULT_ADDRESS=zion1warp_vault_address

# EVM relay key (shared fallback for all EVM-family chains)
WARP_EVM_RELAY_KEY=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# Solana SPL token mint and relay key
WARP_SOLANA_ZION_MINT=<SET_VIA_DEPLOYMENT>
WARP_SOLANA_RELAY_KEY=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# Bitcoin HTLC / Lightning
WARP_BITCOIN_HTLC_ADDRESS=<SET_VIA_DEPLOYMENT>
WARP_BTC_RELAY_KEY=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>
WARP_LN_NODE_URL=<DEFAULT>
WARP_LN_MACAROON=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>
WARP_LN_TLS_CERT=<DEFAULT>

# Cardano native asset and signing keys
WARP_CARDANO_ZION_ASSET=<SET_VIA_DEPLOYMENT>
WARP_CARDANO_PAYMENT_KEY=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>
WARP_CARDANO_POLICY_KEY=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# Stellar asset issuer / relay
WARP_STELLAR_ZION_ISSUER=<SET_VIA_DEPLOYMENT>
WARP_STELLAR_RELAY_KEY=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# Cosmos CW20 contract / relay
WARP_COSMOS_CONTRACT=<SET_VIA_DEPLOYMENT>
WARP_COSMOS_RELAY_KEY=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# Tron TRC-20 contract / relay
WARP_TRON_CONTRACT=<SET_VIA_DEPLOYMENT>
WARP_TRON_RELAY_KEY=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# Sui package object IDs and relay key
WARP_SUI_PACKAGE=<SET_VIA_DEPLOYMENT>
WARP_SUI_BRIDGE_PACKAGE=<SET_VIA_DEPLOYMENT>
WARP_SUI_RELAY_KEY=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# Aptos bridge account / relay
WARP_APTOS_BRIDGE_ACCOUNT=<SET_VIA_DEPLOYMENT>
WARP_APTOS_RELAY_KEY=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# TON jetton master / relay
WARP_TON_BRIDGE_ACCOUNT=<SET_VIA_DEPLOYMENT>
WARP_TON_RELAY_KEY=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# NEAR NEP-141 contract / relay
WARP_NEAR_BRIDGE_CONTRACT=<SET_VIA_DEPLOYMENT>
WARP_NEAR_RELAY_KEY=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>
WARP_NEAR_ACCOUNT=<SET_VIA_DEPLOYMENT>

# Multi-node WARP validator set (comma-separated 64-char hex private keys)
WARP_VALIDATOR_KEYS=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# Multi-Chain / WARP / DEX HTTP API key (optional but recommended)
# If set, mutating endpoints require `Authorization: Bearer <ZION_MULTICHAIN_API_KEY>`.
# Public read-only endpoints (quote, chains, health) remain unauthenticated.
ZION_MULTICHAIN_API_KEY=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>

# Comma-separated list of allowed CORS origins for the multichain HTTP API.
# Defaults to canonical ZION public domains if unset.
ZION_MULTICHAIN_CORS_ORIGINS=https://zionterranova.com,https://app.zionterranova.com,https://oasis.zionterranova.com,https://market.zionterranova.com,https://dashboard.zionterranova.com

# ── V31 L5/L6 fund trackers ───────────────────────────────────────────────
# Free World (humanitarian) and Issobella (space) passive fund trackers.
# They scan the V31 coinbase for the canonical fund addresses and may submit
# grant/mission proposals to the V31 DAO.
FREE_WORLD_BIND=127.0.0.1
FREE_WORLD_PORT=8095
FREE_WORLD_DB=/data/zion/free_world.db
FREE_WORLD_L1_RPC=http://127.0.0.1:9445/jsonrpc
FREE_WORLD_HUMANITARIAN_ADDRESS=zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8

ISSOBELLA_BIND=127.0.0.1
ISSOBELLA_PORT=8097
ISSOBELLA_DB=/data/zion/issobella.db
ISSOBELLA_L1_RPC=http://127.0.0.1:9445/jsonrpc
ISSOBELLA_FUND_ADDRESS=zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0

# DAO proposal submission (used by L5/L6; optional on passive-only deployments)
ZION_DAO_API_ADDR=http://127.0.0.1:8456
ZION_DAO_API_KEY=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>
ZION_DAO_PROPOSER=<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>
ZION_DAO_PROPOSER_BALANCE=0
ZION_DAO_SNAPSHOT_BLOCK=0
