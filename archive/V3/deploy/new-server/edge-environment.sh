#!/bin/bash
# ZION V3 Mainnet Environment — New Server 62.171.141.136
# Post hard-reset 3.0.4 (genesis hash 4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e)
#
# 🔐 SECURITY: This file contains SECRETS. chmod 600. Never commit SK values.
# 🔐 Owner must fill in <REPLACE_*> placeholders with air-gapped-generated keys.
#
# Canonical addresses (public, from genesis.rs / docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md):

# === L1 NODE ===
ZION_NODE_ID="zion-new-mainnet-primary"
ZION_NODE_STATE_PATH="/data/zion/state"
ZION_P2P_BIND="0.0.0.0:8333"
ZION_RPC_BIND="127.0.0.1:8443"
ZION_WEBSOCKET_BIND="127.0.0.1:8445"
ZION_METRICS_BIND="127.0.0.1:9100"

# Greenfield genesis — no seed peers (this is the first node of the new chain)
ZION_SEED_PEERS=""

# Miner + subsidy split (89/5/5/1 burn model)
ZION_MINER_ADDRESS="zion1d6m0h2r8m7k8k2d8n072y7j3j4m0254323vq0e3"
ZION_HUMANITARIAN_WALLET="zion1e0u5q5s660k4m4a634p2c2v358r8g59564054z7"
ZION_ISSOBELLA_WALLET="zion1f7y7l5k678y0v408e8s654d2282346k375526t2"
# Pool fee 1% is BURNED (no wallet) — leave empty

# F4.7 max TX amount cap (code-ready, default off — activate after sync stabilizes)
# export ZION_MAX_TX_AMOUNT_HEIGHT=1440

# F5 balance check (active from genesis on fresh chain — height 0)
ZION_BALANCE_CHECK_HEIGHT=0

# === POOL ===
ZION_POOL_BIND="0.0.0.0:8444"
ZION_POOL_NODE_RPC="http://127.0.0.1:8443"
ZION_POOL_WALLET="zion1e4489793c5x2r0a0a4d8z7r4u5d6k0s4k3ht5m2"
ZION_POOL_SK="<REPLACE_WITH_AIR_GAPPED_POOL_PAYOUT_SK>"
ZION_VARDIFF_MAX_DIFF="10000"
ZION_PPLNS_WINDOW_SIZE="500000"
# No ZION_POOL_FEE_WALLET — 1% burned

# === BRIDGE (L2) ===
ZION_BRIDGE_CONFIG="/root/zion/2.9.6/V3/config/bridge-mainnet.toml"
ZION_BRIDGE_BIND="127.0.0.1:9101"
ZION_BRIDGE_DB="/data/zion/bridge-mainnet.db"
# EVM validator private keys (5/5 threshold) — air-gapped
ZION_BRIDGE_VALIDATOR_SK_1="<REPLACE_EVM_VALIDATOR_SK_1>"
ZION_BRIDGE_VALIDATOR_SK_2="<REPLACE_EVM_VALIDATOR_SK_2>"
ZION_BRIDGE_VALIDATOR_SK_3="<REPLACE_EVM_VALIDATOR_SK_3>"
ZION_BRIDGE_VALIDATOR_SK_4="<REPLACE_EVM_VALIDATOR_SK_4>"
ZION_BRIDGE_VALIDATOR_SK_5="<REPLACE_EVM_VALIDATOR_SK_5>"

# === DAO (L2) ===
ZION_DAO_CONFIG="/root/zion/2.9.6/V3/L2/dao/config/dao-mainnet.toml"
ZION_DAO_BIND="127.0.0.1:8450"
ZION_DAO_DB="/data/zion/dao-mainnet.db"
# Guardian signing keys (7) — air-gapped
ZION_DAO_GUARDIAN_SK_1="<REPLACE_GUARDIAN_SK_1>"
ZION_DAO_GUARDIAN_SK_2="<REPLACE_GUARDIAN_SK_2>"
ZION_DAO_GUARDIAN_SK_3="<REPLACE_GUARDIAN_SK_3>"
ZION_DAO_GUARDIAN_SK_4="<REPLACE_GUARDIAN_SK_4>"
ZION_DAO_GUARDIAN_SK_5="<REPLACE_GUARDIAN_SK_5>"
ZION_DAO_GUARDIAN_SK_6="<REPLACE_GUARDIAN_SK_6>"
ZION_DAO_GUARDIAN_SK_7="<REPLACE_GUARDIAN_SK_7>"

# === ATOMIC SWAP (L2) ===
ZION_SWAP_ESCROW_KEY="<REPLACE_ESCROW_SK>"
ZION_SWAP_DB="/data/zion/atomic-swap.db"

# === WARP (L3) ===
ZION_WARP_CONFIG="/root/zion/2.9.6/V3/L3/warp/config/warp-mainnet.toml"
ZARP_BIND="127.0.0.1:9102"
ZION_WARP_DB="/data/zion/warp.db"

# === LOGGING ===
RUST_LOG="info"
ZION_LOG_BLOCK_SUBMITTER=1
