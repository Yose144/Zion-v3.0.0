# ZION Coin — Aptos (Move)

## Overview

ZION on Aptos is implemented as a **Move Coin type** with **6 decimals** (matching L1 atomic units). The module uses the Aptos Framework's `coin` module to provide standard coin functionality, with bridge-specific mint/burn functions controlled by the WARP validator set (5/5 quorum).

## Files

| File | Description |
|------|-------------|
| `sources/zion_coin.move` | Move module implementing `Coin<ZION>` with bridge mint/burn |

## Token Parameters

- **Name:** ZION
- **Symbol:** ZION
- **Decimals:** 6
- **Max Supply:** 144,000,000,000 ZION (144B)
- **Bridge Authority:** WARP validator set (5/5 quorum)
- **Coin Type:** `Coin<ZION>` (standard Aptos coin framework)

## Deployment Steps

### Prerequisites
- Aptos CLI v3+
- An Aptos account with APT for gas

### 1. Compile the module
```bash
aptos move compile \
  --named-addresses zion=<bridge_admin_address> \
  --package-dir .
```

### 2. Publish to Aptos mainnet
```bash
aptos move publish \
  --named-addresses zion=<bridge_admin_address> \
  --profile mainnet \
  --gas-unit-price 100 \
  --max-gas 1000000
```

### 3. Initialize the bridge
```bash
aptos move run \
  --function-id <bridge_admin_address>::zion_coin::initialize \
  --args 'address:<val1>' 'address:<val2>' 'address:<val3>' 'address:<val4>' 'address:<val5>' \
  --profile mainnet
```

### 4. Register coin for recipients
Recipients must register to receive ZION coins:
```bash
aptos move run \
  --function-id 0x1::coin::register \
  --type-args <bridge_admin_address>::zion_coin::ZION \
  --profile user
```

### 5. Update the WARP adapter
After deployment, update `V31/L2/multichain/src/warp/adapter/aptos.rs`:
- Replace `DEFAULT_BRIDGE_ACCOUNT` with the real bridge admin address
- Set `WARP_APTOS_EVENT_HANDLE` to `mint_events` / `burn_events`
- Set `WARP_APTOS_BRIDGE_ACCOUNT` env var

## Bridge Flow

### L1 → Aptos (Mint)
1. User locks ZION on L1 bridge address
2. WARP relay confirms ≥60 block finality
3. Relay calls `bridge_mint(recipient, amount, l1_tx_hash)` on Aptos
4. `Coin<ZION>` minted and deposited to recipient
5. `BridgeMintEvent` emitted (WARP relay monitors via events API)

### Aptos → L1 (Burn)
1. User calls `bridge_burn(bridge_admin, amount, l1_recipient, burn_id)`
2. `Coin<ZION>` withdrawn from user and burned
3. `BridgeBurnEvent` emitted
4. WARP relay observes event and releases ZION on L1

## Move Coin Framework

The module uses Aptos's standard coin framework (`0x1::coin`):
- `Coin<ZION>` type for all transfers
- `coin::register<ZION>()` — users must register before receiving
- `coin::transfer<ZION>()` — standard transfer
- `coin::balance<ZION>(addr)` — check balance
- `coin::supply<ZION>()` — total supply

## Security

- **Mint capability:** Stored in `BridgeConfig` under the bridge admin account
- **Burn capability:** Same — only the bridge can burn (via `bridge_burn` entry)
- **Validator quorum:** Only registered validators can call `bridge_mint` and `pause`
- **Pause:** Any validator can pause mint/burn in emergencies
- **Max supply:** 144B ZION hard cap enforced in `bridge_mint`
- **Min amount:** 100 ZION minimum to prevent dust attacks
- **L1 address validation:** `zion1` prefix check on burn
