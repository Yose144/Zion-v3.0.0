# ZION Stellar Asset

## Overview

ZION on Stellar is implemented as a **native Stellar asset** (not a smart contract). Stellar assets are defined by an asset code + an issuer account. The WARP bridge issuer account controls ZION issuance with 5/5 validator multi-sig quorum.

## Files

| File | Description |
|------|-------------|
| `zion_asset.toml` | Stellar TOML asset definition (asset code, issuer, flags, validators) |
| `setup_zion_asset.py` | Python script to set up the bridge account, multi-sig, and asset |

## Token Parameters

- **Asset Code:** ZION (4-character code)
- **Issuer:** WARP bridge multisig account (G... address)
- **Decimals:** 6 (1 ZION = 1,000,000 stroops, matching L1 atomic units)
- **Max Supply:** 144,000,000,000 ZION (144B)
- **Quorum:** 5/5 WARP validators (all must sign issuance transactions)

## How Stellar Assets Work

Unlike EVM chains, Stellar doesn't use smart contracts for fungible tokens. Instead:
1. An **issuer account** creates an asset by sending payments of that asset
2. Recipients must create a **trustline** to the asset before receiving it
3. The issuer can set **flags** (auth_required, revocable, clawback)
4. **Multi-sig** on the issuer account controls who can issue tokens

## Deployment Steps

### Prerequisites
```bash
pip install stellar-sdk
```

### 1. Generate the bridge issuer keypair
```bash
python -c "from stellar_sdk import Keypair; kp = Keypair.random(); print(f'Public: {kp.public_key}\nSecret: {kp.secret}')"
# SAVE THE SECRET KEY SECURELY
```

### 2. Set environment variables
```bash
export STELLAR_BRIDGE_SECRET="S..."          # bridge issuer secret key
export STELLAR_VALIDATOR_1="G..."            # validator 1 public key
export STELLAR_VALIDATOR_2="G..."            # validator 2 public key
export STELLAR_VALIDATOR_3="G..."            # validator 3 public key
export STELLAR_VALIDATOR_4="G..."            # validator 4 public key
export STELLAR_VALIDATOR_5="G..."            # validator 5 public key
export STELLAR_NETWORK="testnet"             # or "mainnet"
```

### 3. Run the setup script
```bash
# Testnet (auto-funds via Friendbot)
python setup_zion_asset.py --network testnet

# Mainnet (requires funded bridge account)
python setup_zion_asset.py --network mainnet
```

### 4. Serve the TOML file
The `zion_asset.toml` file must be served at:
```
https://zionterranova.com/.well-known/stellar.toml
```
This enables automatic asset discovery by Stellar wallets and exchanges.

### 5. Update the WARP adapter
After deployment, update `V3/L3/warp/src/adapter/stellar.rs`:
- Replace the placeholder contract ID in `zion_contract()` with the real issuer public key

## Bridge Flow

### L1 → Stellar (Mint)
1. User locks ZION on L1 bridge address
2. WARP relay confirms ≥60 block finality
3. Bridge issuer account sends a `Payment` operation of ZION to recipient
4. All 5 validators co-sign the transaction (5/5 multi-sig)
5. Memo contains the L1 tx hash for replay protection

### Stellar → L1 (Burn)
1. User sends ZION back to the bridge issuer account (or bridge uses clawback)
2. Memo contains the L1 recipient bech32 address
3. WARP relay observes the payment to the bridge account
4. Relay releases native ZION on L1

## Security

- **Multi-sig:** 5/5 validator quorum on the issuer account
- **Auth required:** Users must be approved to hold ZION (compliance)
- **Clawback:** Bridge can clawback ZION for burn operations
- **Revocable:** Bridge can revoke trustlines if needed
- **Master weight 0:** The issuer's master key is disabled — only multi-sig works
- **Replay protection:** L1 tx hashes tracked in WARP relay DB + Stellar sequence numbers
