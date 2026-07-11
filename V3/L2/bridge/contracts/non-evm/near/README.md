# ZION NEP-141 Token — NEAR Protocol

## Overview

ZION on NEAR is implemented as a **NEP-141 fungible token** with **6 decimals** (matching L1 atomic units). The contract is written in Rust and compiled to WebAssembly. Bridge mint/burn authority is controlled by the WARP validator set (5/5 quorum).

## Files

| File | Description |
|------|-------------|
| `zion_token.rs` | NEP-141 token contract with bridge mint/burn logic (Rust) |

## Token Parameters

- **Name:** ZION
- **Symbol:** ZION
- **Decimals:** 6
- **Max Supply:** 144,000,000,000 ZION (144B)
- **Bridge Authority:** WARP validator set (5/5 quorum)
- **Standard:** NEP-141 (NEAR fungible token standard)

## Deployment Steps

### Prerequisites
- Rust 1.75+ with `wasm32-unknown-unknown` target
- `near-cli` (or `near-cli-rs`)
- A NEAR account with NEAR for gas and storage

### 1. Build the WASM contract
```bash
# Add the WASM target
rustup target add wasm32-unknown-unknown

# Build
cargo build --target wasm32-unknown-unknown --release
# Or use near-sdk's build tool:
cargo near build
```

### 2. Create a NEAR account for the contract
```bash
near create-account zion.near --useFaucet  # testnet
# or
near account create-account sponsor-by-faucet-service zion.testnet autogenerate-new-keypair
```

### 3. Deploy to NEAR mainnet
```bash
near deploy --accountId zion.near \
  --wasmFile target/wasm32-unknown-unknown/release/zion_token.wasm

# Initialize the contract
near call zion.near new \
  '{
    "name": "ZION",
    "symbol": "ZION",
    "admin": "warp.near",
    "validators": ["val1.near", "val2.near", "val3.near", "val4.near", "val5.near"]
  }' \
  --accountId zion.near
```

### 4. Register accounts for storage
Users must register before receiving ZION:
```bash
near call zion.near storage_deposit \
  '{"account_id": "user.near"}' \
  --accountId user.near \
  --deposit 0.125
```

### 5. Verify deployment
```bash
# Check metadata
near view zion.near ft_metadata

# Check total supply
near view zion.near ft_total_supply

# Check bridge stats
near view zion.near bridge_stats
```

### 6. Update the WARP adapter
After deployment, update `V3/L3/warp/src/adapter/near.rs`:
- Set `WARP_NEAR_BRIDGE_CONTRACT` env var to the contract account ID (e.g., `zion.near`)
- Replace the default `warp.near` placeholder

## Bridge Flow

### L1 → NEAR (Mint)
1. User locks ZION on L1 bridge address
2. WARP relay confirms ≥60 block finality
3. Relay calls `bridge_mint(recipient, amount, l1_tx_hash)` on NEAR
4. ZION NEP-141 tokens minted to recipient's account
5. Program log: `BridgeMint amount=<u64> recipient=<account> l1_tx=<hash>`

### NEAR → L1 (Burn)
1. User calls `bridge_burn(amount, l1_recipient, burn_id)` on NEAR
2. ZION NEP-141 tokens burned from caller's balance
3. Program log: `BridgeBurn amount=<u64> dest=<zion_addr> sender=<account> burn_id=<id>`
4. WARP relay parses the log and releases ZION on L1

## NEP-141 Standard

The contract implements the [NEP-141 specification](https://nomicon.io/Standards/Tokens/FungibleToken/Core):
- `ft_transfer` — transfer tokens
- `ft_transfer_call` — transfer + cross-contract call
- `ft_balance_of` — check balance
- `ft_total_supply` — total supply
- `ft_metadata` — token metadata (name, symbol, decimals)
- `storage_deposit` — register account for storage

## Security

- **Validator quorum:** Only registered WARP validators can call `bridge_mint` and `pause`
- **Storage deposits:** Users must pay NEAR for storage (standard NEP-141 pattern)
- **Pause:** Any validator can pause mint/burn in emergencies
- **Replay protection:** L1 tx hashes and burn IDs tracked on-chain
- **Min amount:** 100 ZION minimum to prevent dust attacks
- **Max supply:** 144B ZION hard cap enforced on-chain
- **L1 address validation:** `zion1` prefix check on burn
