# ZION TRC-20 Token — Tron

## Overview

ZION on Tron is implemented as a TRC-20 token with **6 decimals** (matching L1 atomic units). The bridge mint/burn authority is controlled by the WARP bridge relay contract, which requires 5/5 validator quorum.

## Files

| File | Description |
|------|-------------|
| `ZionToken.sol` | TRC-20 token contract with bridge mint/burn logic (Solidity for TVM) |

## Token Parameters

- **Name:** ZION
- **Symbol:** ZION
- **Decimals:** 6
- **Max Supply:** 144,000,000,000 ZION (144B)
- **Bridge Authority:** WARP bridge relay contract (BRIDGE_ROLE)

## Deployment Steps

### Prerequisites
- TronIDE or TronBox v3+
- TronLink wallet
- TRX for deployment gas (~500-1000 TRX)

### 1. Compile
```bash
# Using TronBox
tronbox compile

# Or use TronIDE (https://www.tronide.io/)
# Compiler: Solidity 0.8.20+, EVM version: default
```

### 2. Deploy to Tron mainnet
```bash
# Using TronBox
tronbox migrate --network mainnet

# Constructor args:
#   admin:    <multisig address>  (manages roles)
#   bridge:   <bridge relay contract address>
#   guardian: <emergency pause address>
```

### 3. Verify on Tronscan
```bash
# After deployment, verify the contract source on Tronscan
# https://tronscan.org/#/contract/<contract_address>/verify
```

### 4. Update the WARP adapter
After deployment, update `V3/L3/warp/src/adapter/tron.rs`:
- Replace the placeholder contract address in `zion_contract()` with the real T-address
- Set `WARP_TRON_API` env var if using a custom API endpoint

## Bridge Flow

### L1 → Tron (Mint)
1. User locks ZION on L1 bridge address
2. WARP relay confirms ≥60 block finality
3. Relay calls `bridgeMint(recipient, amount, l1TxHash)` on Tron
4. ZION TRC-20 tokens minted to recipient

### Tron → L1 (Burn)
1. User calls `bridgeBurn(amount, l1Recipient, burnId)` on Tron
2. ZION TRC-20 tokens burned from caller
3. `BridgeBurn` event emitted (WARP relay monitors)
4. Relay releases native ZION on L1 to the bech32 address

## TRC-20 vs ERC-20

TRC-20 is functionally identical to ERC-20 but runs on the Tron Virtual Machine (TVM). Key differences:
- Addresses use base58 format starting with `T` (e.g. `TXYZ...`)
- Gas paid in TRX (1 TRX = 1,000,000 sun)
- No OpenZeppelin dependency — access control is implemented inline
- `block.timestamp` available (same as EVM)

## Security

- **BRIDGE_ROLE:** Only the bridge relay contract can mint
- **GUARDIAN_ROLE:** Can pause/unpause in emergencies
- **DEFAULT_ADMIN_ROLE:** Multisig that manages role assignments
- **Replay protection:** L1 lock TX hashes and burn IDs tracked
- **Min amount:** 100 ZION minimum to prevent dust attacks
- **Max supply:** 144B ZION hard cap enforced on-chain
