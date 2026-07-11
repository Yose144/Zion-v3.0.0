# ZION SPL Token — Solana

## Overview

ZION on Solana is implemented as an SPL token with **6 decimals** (matching L1 atomic units: 1 ZION = 1,000,000 atomic). The mint/burn authority is the WARP bridge multisig PDA, controlled by the 5-validator set with 5/5 quorum.

## Files

| File | Description |
|------|-------------|
| `zion_spl_token.rs` | Anchor program implementing the ZION SPL token + bridge mint/burn logic |

## Token Parameters

- **Name:** ZION
- **Symbol:** ZION
- **Decimals:** 6
- **Max Supply:** 144,000,000,000 ZION (144B)
- **Mint Authority:** WARP bridge authority PDA (`zion_bridge_auth` seeds)
- **Freeze Authority:** None (no freezing)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  BridgeConfig PDA (seeds: [b"zion_bridge_config"])  │
│  - zion_mint: Pubkey                                │
│  - validators: [Pubkey; 5]                          │
│  - total_bridge_minted: u64                         │
│  - total_bridge_burned: u64                         │
│  - paused: bool                                     │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  ZION Mint PDA (seeds: [b"zion_mint"])              │
│  - decimals: 6                                      │
│  - mint_authority: bridge_auth PDA                  │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Bridge Authority PDA (seeds: [b"zion_bridge_auth"])│
│  - Signs token::mint_to CPIs                        │
└─────────────────────────────────────────────────────┘
```

## Deployment Steps

### Prerequisites
- Solana CLI v1.18+
- Anchor v0.30+
- A funded deployer keypair

### 1. Build the program
```bash
anchor build
# Note the program ID from the output
```

### 2. Deploy to mainnet-beta
```bash
solana config set --url mainnet-beta
anchor deploy --provider.cluster mainnet-beta
```

### 3. Initialize the bridge
```bash
# Call the `initialize` instruction with the 5 WARP validator public keys
anchor run initialize -- \
  --validators <validator1_pubkey> <validator2_pubkey> ... <validator5_pubkey>
```

### 4. Verify deployment
```bash
# Check the mint was created
spl-token display <zion_mint_address>
# Should show: decimals: 6, mint authority: <bridge_auth_pda>
```

### 5. Update the WARP adapter
After deployment, update `V3/L3/warp/src/adapter/solana.rs`:
- Replace the placeholder mint address in `zion_mint()` with the real mint address
- Set `WARP_SOLANA_RPC` env var if using a custom RPC

## Bridge Flow

### L1 → Solana (Mint)
1. User locks ZION on L1 bridge address
2. WARP relay confirms ≥60 block finality
3. Relay calls `bridge_mint(amount, l1_tx_hash)` on Solana
4. ZION SPL tokens minted to recipient's associated token account

### Solana → L1 (Burn)
1. User calls `bridge_burn(amount, l1_recipient, burn_id)` on Solana
2. ZION SPL tokens burned from user's token account
3. `BridgeBurnEvent` emitted (parsed by WARP relay via program logs)
4. Relay releases native ZION on L1 to the bech32 address

## Security

- **Mint authority:** Bridge authority PDA (no single key can mint)
- **Validator quorum:** 5/5 required (all validators must sign relay messages)
- **Pause:** Any validator can pause the bridge in emergencies
- **Replay protection:** `l1_tx_hash` and `burn_id` tracked on-chain
- **Min amount:** 100 ZION minimum to prevent dust attacks
- **Max supply:** 144B ZION hard cap enforced on-chain
