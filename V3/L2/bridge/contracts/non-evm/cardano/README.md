# ZION Cardano Native Token

## Overview

ZION on Cardano is a **native token** (no smart contract needed for transfers). Cardano supports native tokens at the ledger level — any token can be sent/received without a smart contract. This folder contains the **minting policy** (Plutus script) that controls who can mint ZION, and the **bridge multisig validator** that enforces 5/5 validator quorum.

## Files

| File | Description |
|------|-------------|
| `mint_zion_token.hs` | Plutus minting policy + bridge multisig validator (Haskell) |

## Token Parameters

- **Asset Name:** ZION (hex: `5a494f4e`)
- **Decimals:** 6 (1 ZION = 1,000,000 base units, matching L1 atomic units)
- **Max Supply:** 144,000,000,000 ZION (144B)
- **Mint Authority:** WARP bridge multisig (5/5 validator quorum)
- **Policy ID:** Computed as hash of the minting policy script (after compilation)

## Asset Identifier Format

Cardano native tokens are identified by a combination of:
- **Policy ID** (currency symbol): hash of the minting policy script (28 bytes hex)
- **Asset Name**: "ZION" (hex: `5a494f4e`)

The WARP adapter (`V3/L3/warp/src/adapter/cardano.rs`) uses the combined hex string:
```
<policy_id_hex><asset_name_hex>
```
Example (placeholder): `5a71011c726573745a494f4e`

After deployment, replace the placeholder in `zion_asset()` with the real policy_id + asset_name.

## Deployment Steps

### Prerequisites
- GHC 9.x with Plutus dependencies
- `cardano-cli` v8+
- `cardano-node` synced to mainnet
- Blockfrost API key (for the WARP adapter)

### 1. Compile the minting policy
```bash
# In a Plutus project environment (e.g., plutus-pioneer-program or cardano-devcontainer)
cabal build zion-mint-policy

# Export the Plutus script
cardano-cli transaction policyid \
  --script-file zion_mint_policy.plutus

# Note the output policy ID
```

### 2. Compile the bridge multisig validator
```bash
# Export the bridge validator script
# Provide the 5 validator public key hashes as parameters
cardano-cli transaction policyid \
  --script-file zion_bridge_validator.plutus

# Note the validator script hash
```

### 3. Deploy to mainnet
```bash
# Submit the minting policy and validator scripts on-chain
cardano-cli transaction build \
  --tx-in <bridge_funding_utxo> \
  --tx-out $(cat bridge.addr)+2000000 \
  --tx-out-script-file zion_bridge_validator.plutus \
  --change-address <change.addr> \
  --out-file tx.raw

cardano-cli transaction sign \
  --tx-body-file tx.raw \
  --signing-key-file bridge.skey \
  --mainnet \
  --out-file tx.signed

cardano-cli transaction submit \
  --tx-file tx.signed \
  --mainnet
```

### 4. First mint (initialize ZION supply)
```bash
# The first mint requires 5/5 validator signatures
# Build a transaction that mints ZION to the bridge UTxO
cardano-cli transaction build \
  --tx-in <bridge_utxo> \
  --tx-in-collateral <collateral_utxo> \
  --tx-out "$(cat recipient.addr) + 1000000 5a71011c726573745a494f4e.5a494f4e" \
  --mint "1000000 5a71011c726573745a494f4e.5a494f4e" \
  --mint-script-file zion_mint_policy.plutus \
  --change-address <change.addr> \
  --out-file mint_tx.raw

# All 5 validators must sign
cardano-cli transaction sign \
  --tx-body-file mint_tx.raw \
  --signing-key-file validator1.skey \
  --signing-key-file validator2.skey \
  --signing-key-file validator3.skey \
  --signing-key-file validator4.skey \
  --signing-key-file validator5.skey \
  --mainnet \
  --out-file mint_tx.signed

cardano-cli transaction submit \
  --tx-file mint_tx.signed \
  --mainnet
```

### 5. Update the WARP adapter
After deployment, update `V3/L3/warp/src/adapter/cardano.rs`:
- Replace the placeholder asset hex in `zion_asset()` with the real `policy_id + asset_name`
- Set `BLOCKFROST_API_KEY` env var

## Bridge Flow

### L1 → Cardano (Mint)
1. User locks ZION on L1 bridge address
2. WARP relay confirms ≥60 block finality
3. Relay builds a mint transaction (all 5 validators sign)
4. ZION native tokens minted to recipient's Cardano address

### Cardano → L1 (Burn)
1. User sends ZION tokens to the bridge multisig address
2. WARP relay observes the transaction via Blockfrost API
3. Relay burns the tokens (negative mint in a new transaction)
4. Releases native ZION on L1 to the bech32 address

## Security

- **Minting policy:** Only allows minting ZION asset name, enforces max supply
- **Bridge multisig:** 5/5 validator quorum required for all mints
- **Burn:** Negative mint (burn) always allowed (no minimum for burns)
- **Policy ID immutability:** Once the policy is compiled, the policy ID is fixed
- **Time-locked policy (optional):** Can add a time-lock to prevent minting after a deadline
