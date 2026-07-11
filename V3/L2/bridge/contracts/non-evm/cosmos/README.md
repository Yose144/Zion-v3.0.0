# ZION CW20 Token — Cosmos (CosmWasm)

## Overview

ZION on Cosmos is implemented as a **CW20 fungible token** with **6 decimals** (matching L1 atomic units). The contract runs on any CosmWasm-enabled chain (Cosmos Hub, Osmosis, Juno, etc.). Bridge mint/burn authority is controlled by the WARP validator set with 5/5 quorum.

## Files

| File | Description |
|------|-------------|
| `zion_cw20.rs` | CosmWasm CW20 token contract with bridge mint/burn logic (Rust) |

## Token Parameters

- **Name:** ZION
- **Symbol:** ZION
- **Decimals:** 6
- **Max Supply:** 144,000,000,000 ZION (144B)
- **Bridge Authority:** WARP validator set (5/5 quorum)

## Deployment Steps

### Prerequisites
- Rust 1.75+ with `wasm32-unknown-unknown` target
- `cosmwasm-opt` or `cargo run --release` with WASM target
- `wasmd` or target chain CLI (e.g., `osmosisd`, `junod`)

### 1. Build the WASM contract
```bash
# Add the WASM target
rustup target add wasm32-unknown-unknown

# Build optimized WASM
cargo build --release --target wasm32-unknown-unknown
# Or use cosmwasm-opt for smaller binaries:
docker run --rm -v $(pwd):/code cosmwasm/workspace-optimizer:0.15.0
```

### 2. Deploy to Cosmos Hub (cosmoshub-4)
```bash
# Store the code on-chain
wasmd tx wasm store zion_cw20.wasm \
  --from deployer \
  --gas auto \
  --chain-id cosmoshub-4 \
  --node https://rpc.cosmos.directory:443

# Note the code ID from the transaction response

# Instantiate the contract
wasmd tx wasm instantiate <code_id> \
  '{
    "name": "ZION",
    "symbol": "ZION",
    "decimals": 6,
    "admin": "<multisig_address>",
    "validators": ["<val1>", "<val2>", "<val3>", "<val4>", "<val5>"],
    "initial_supply": null
  }' \
  --from deployer \
  --label "ZION CW20 Token" \
  --no-admin \
  --chain-id cosmoshub-4 \
  --node https://rpc.cosmos.directory:443

# Note the contract address from the response
```

### 3. Verify deployment
```bash
# Query token info
wasmd query wasm contract-state smart <contract_address> \
  '{"token_info": {}}'

# Should return: name="ZION", symbol="ZION", decimals=6, total_supply=0
```

### 4. Update the WARP adapter
After deployment, update `V3/L3/warp/src/adapter/cosmos.rs`:
- Replace the placeholder contract address in `zion_contract()` with the real bech32 contract address

## Bridge Flow

### L1 → Cosmos (Mint)
1. User locks ZION on L1 bridge address
2. WARP relay confirms ≥60 block finality
3. Relay calls `bridge_mint` on the CW20 contract (as a validator)
4. ZION CW20 tokens minted to recipient's Cosmos address

### Cosmos → L1 (Burn)
1. User calls `bridge_burn` on the CW20 contract
2. ZION CW20 tokens burned from caller's balance
3. WARP relay observes the transaction event
4. Relay releases native ZION on L1 to the bech32 address

## CW20 Standard

The contract implements the [CW20 specification](https://github.com/CosmWasm/cw-plus/tree/main/packages/cw20):
- `Transfer` — transfer tokens
- `Approve` / `TransferFrom` — allowance-based transfers
- `Burn` — burn own tokens
- `Balance` query — check balance
- `TokenInfo` query — get metadata

## Security

- **Validator quorum:** Only registered WARP validators can call `bridge_mint`
- **Pause:** Any validator can pause the bridge in emergencies
- **Replay protection:** L1 tx hashes and burn IDs tracked on-chain
- **Min amount:** 100 ZION minimum to prevent dust attacks
- **Max supply:** 144B ZION hard cap enforced on-chain
- **Admin:** Multisig address that can update the validator set
