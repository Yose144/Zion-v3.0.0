# ZION Coin — Sui (Move)

## Overview

ZION on Sui is implemented as a **Sui Move Coin type** with **6 decimals** (matching L1 atomic units). The module uses Sui's `coin` framework module with `Coin<ZION>` and `TreasuryCap<ZION>`. Bridge mint/burn authority is controlled by the WARP validator set (5/5 quorum).

## Files

| File | Description |
|------|-------------|
| `sources/zion_coin.move` | Sui Move module implementing `Coin<ZION>` with bridge mint/burn |

## Token Parameters

- **Name:** ZION
- **Symbol:** ZION
- **Decimals:** 6
- **Max Supply:** 144,000,000,000 ZION (144B)
- **Bridge Authority:** WARP validator set (5/5 quorum)
- **Coin Type:** `Coin<ZION>` (standard Sui coin framework)

## Sui Move vs Aptos Move

Key differences in the Sui implementation:
- **Object-centric:** `Coin<ZION>` is an object that gets transferred between accounts
- **TreasuryCap:** The mint capability is an object (`TreasuryCap<ZION>`) that must be passed to mint/burn functions
- **Shared objects:** `BridgeConfig` is a shared object (anyone can read, validators can write)
- **No global storage:** State lives in objects, not at module addresses
- **`init` function:** Called automatically at package publish time

## Deployment Steps

### Prerequisites
- Sui CLI (`sui`) v1.18+
- A Sui wallet with SUI for gas

### 1. Build the package
```bash
sui move build
```

### 2. Publish to Sui mainnet
```bash
sui client publish --gas-budget 100000000
# Note the package ID and TreasuryCap object ID from the output
```

### 3. Initialize the bridge
```bash
sui client call \
  --package <package_id> \
  --module zion_coin \
  --function initialize_bridge \
  --args '["<val1>","<val2>","<val3>","<val4>","<val5>"]' <treasury_cap_object_id> \
  --gas-budget 10000000
```

### 4. Update the WARP adapter
After deployment, update `V31/L2/multichain/src/warp/adapter/sui.rs`:
- Replace the package ID `0x2` placeholder with the real package object ID
- Set `WARP_SUI_RPC` env var if using a custom RPC

## Bridge Flow

### L1 → Sui (Mint)
1. User locks ZION on L1 bridge address
2. WARP relay confirms ≥60 block finality
3. Relay calls `bridge_mint(config, treasury_cap, recipient, amount, l1_tx_hash)`
4. `Coin<ZION>` object minted and transferred to recipient
5. `BridgeMintEvent` emitted (WARP relay monitors via `sui_queryEvents`)

### Sui → L1 (Burn)
1. User calls `bridge_burn(config, treasury_cap, coins, l1_recipient, burn_id)`
2. `Coin<ZION>` object burned via `coin::burn`
3. `BridgeBurnEvent` emitted
4. WARP relay observes event and releases ZION on L1

## Object Model

```
┌─────────────────────────────────────────────────┐
│  TreasuryCap<ZION> (owned by bridge admin)      │
│  - Required for mint/burn operations             │
│  - Transferred to bridge admin at publish time   │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│  BridgeConfig (shared object)                    │
│  - validators: vector<address>                   │
│  - total_bridge_minted: u64                      │
│  - total_bridge_burned: u64                      │
│  - paused: bool                                  │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│  Coin<ZION> objects (owned by users)             │
│  - Each user holds their own Coin<ZION> object   │
│  - Transferred via transfer::public_transfer     │
└─────────────────────────────────────────────────┘
```

## Security

- **TreasuryCap:** Only the bridge admin holds the mint/burn capability
- **Validator quorum:** Only registered WARP validators can call `bridge_mint` and `pause`
- **Shared BridgeConfig:** Anyone can read, only validators can modify
- **Pause:** Any validator can pause mint/burn in emergencies
- **Max supply:** 144B ZION hard cap enforced in `bridge_mint`
- **Min amount:** 100 ZION minimum to prevent dust attacks
- **L1 address validation:** `zion1` prefix check on burn
