# ZION Edge Server Environment Configuration
# Updated: 2026-06-02 - Edge-as-Primary topology, burn model (89/5/5/0)
#
# This is the PRIMARY node + pool. Runs 24/7 on Hetzner VPS.
# Local PC (Core) connects to this as seed peer and runs backup node + miners.

# Node Configuration
ZION_NODE_ID=zion-edge-primary
ZION_P2P_BIND=0.0.0.0:8333
ZION_RPC_BIND=127.0.0.1:8443
ZION_SEED_PEERS=none
ZION_NODE_STATE_PATH=/root/zion-2.9.6-main/data/edge-state.db

# Canonical Fee Split Addresses (89/5/5/0 burn model — no pool fee wallet)
ZION_MINER_ADDRESS=zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3
ZION_HUMANITARIAN_WALLET=zion1m4v5z8z850u480c5c208z274e334369275n5y20
ZION_ISSOBELLA_WALLET=zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702

# Pool Configuration (PRIMARY — accepts all miners)
ZION_POOL_BIND=0.0.0.0:8444
ZION_NODE_RPC_ADDR=127.0.0.1:8443
ZION_POOL_LOOP_COUNT=1000000
ZION_MAX_SESSIONS_PER_IP=10
ZION_NONCE_COUNT=4096
ZION_VARDIFF_START_DIFF=1
ZION_VARDIFF_MAX_DIFF=10000
ZION_PPLNS_WINDOW_SIZE=500000

# Pool wallet (Edge primary — handles all payouts)
ZION_POOL_WALLET=zion1a6z5a4m830w6s6k7r508n300n6z30022q6qt0n7
ZION_POOL_PAYOUT_SK_HEX=edee1b2904f16b31b7553ea87e783946585c2cbe335a6e200eac60d12410049f