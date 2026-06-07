# ZION Edge Server — Common Environment
# Updated: 2026-06-07 - Vardiff tuning + pool binary compat notes added
#
# This file contains SHARED environment variables for ALL Edge services.
# Service-specific overrides (node ID, bind ports, state paths) are set
# in each systemd service via Environment= directives.
#
# Edge runs:
#   - Node 1 (Primary / Genesis) — P2P 8333, RPC 8443 (localhost)
#   - Node 2 (Follower / P2P peer) — P2P 8334, RPC 8446 (localhost)
#   - Pool (Primary) — connects to Node 1 RPC, Stratum 8444 public
#   - Bridge, DAO, Atomic-Swap, WARP — all connect to Node 1 RPC
#
# Local PC (Core) runs:
#   - Backup Node — syncs from Edge Node 1 via Tailscale
#   - Miners — connect to Edge Pool via Tailscale
#   - AI services (Hiran + Hiranyagarbha) — local GPU required

# ── Canonical Fee Split Addresses (89/5/5/0 burn model — no pool fee wallet) ──
# NOTE: On Edge-Primary topology, ZION_MINER_ADDRESS MUST equal the pool
# wallet so the node credits block rewards directly to the pool payout wallet.
# Local miners should set their own ZION_MINER_ADDRESS in launch scripts.
ZION_MINER_ADDRESS=zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604
ZION_HUMANITARIAN_WALLET=zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4
ZION_ISSOBELLA_WALLET=zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702
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
ZION_JOB_TTL_MS=60000
ZION_VARDIFF_START_DIFF=1
ZION_VARDIFF_MIN_DIFF=1
ZION_VARDIFF_MAX_DIFF=10000
ZION_VARDIFF_TARGET_SECS=15
ZION_VARDIFF_RETARGET_SHARES=6
ZION_PPLNS_WINDOW_SIZE=500000
ZION_ROUTING_METRICS_BIND=0.0.0.0:8455

# Pool wallet (Edge primary — handles all payouts)
ZION_POOL_WALLET=zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604
ZION_POOL_PAYOUT_SK_HEX=edee1b2904f16b31b7553ea87e783946585c2cbe335a6e200eac60d12410049f

# Atomic Swap escrow key (testnet placeholder — rotate for mainnet)
ZION_SWAP_ESCROW_KEY=0000000000000000000000000000000000000000000000000000000000000001
