# Non-EVM ZION Token Contracts — Deploy Guide

> **Status:** 🔴 Contracts created, NOT deployed
> **Last updated:** 2026-07-13
> **Parent doc:** [`docs/3.0.5/CONTRACT_ADDRESSES.md`](../../../docs/3.0.5/CONTRACT_ADDRESSES.md)

## Overview

ZION token contracts for 9 non-EVM chains. Each contract implements the chain-native token standard with WARP bridge integration (mint/burn controlled by WARP validators).

After deploying each contract, update:
1. The placeholder address in `V3/L3/warp/src/adapter/<chain>.rs`
2. The env vars in `/root/.env.warp` on the Edge server
3. The address table in [`docs/3.0.5/CONTRACT_ADDRESSES.md`](../../../docs/3.0.5/CONTRACT_ADDRESSES.md) §4
4. Restart WARP: `systemctl restart zion-warp`

## Deploy Order (recommended)

Start with chains that have the cheapest gas + most mature tooling:

| # | Chain | Token Standard | Gas Token | Est. Deploy Cost | CLI Tool |
|---|-------|---------------|-----------|-----------------|----------|
| 1 | Solana | SPL Token | SOL | ~0.1 SOL | `solana-cli` + `anchor` |
| 2 | NEAR | NEP-141 | NEAR | ~0.1 NEAR | `near-cli` |
| 3 | Cosmos | CW20 | ATOM | ~5000 ATOM | `wasmd` |
| 4 | Aptos | Move Coin | APT | ~0.5 APT | `aptos-cli` |
| 5 | Sui | Move Coin | SUI | ~1 SUI | `sui-cli` |
| 6 | Tron | TRC-20 | TRX | ~100 TRX | `tronbox` |
| 7 | Stellar | Native Asset | XLM | ~10 XLM | `stellar-sdk` (Python) |
| 8 | TON | TEP-74 Jetton | TON | ~0.5 TON | `toncli` |
| 9 | Cardano | Native Token | ADA | ~2 ADA | `cardano-cli` |

## Per-Chain Deploy Instructions

### 1. Solana (SPL Token)

**Contract:** `solana/zion_spl_token.rs` (Anchor program)
**Decimals:** 6
**CLI tools:** `solana-cli`, `anchor`

```bash
# Install tools
sh -c "$(curl -sSfL https://release.solana.com/v1.18.0/install)"
npm install -g @coral-xyz/anchor-cli

# Fund deployer keypair
solana airdrop 2 <deployer-keypair>  # devnet only; mainnet needs SOL transfer

# Build + deploy
cd solana/
anchor build
anchor deploy --provider.cluster mainnet --provider.wallet <deployer-keypair>

# Initialize mint (creates ZION SPL token PDA)
anchor run initialize

# Output: ZION mint address (base58), Bridge program ID (base58)
```

**Env vars to set:**
```bash
WARP_SOL_ZION_MINT=<base58 mint pubkey>
WARP_SOL_BRIDGE_PROGRAM=<base58 program id>
WARP_SOL_RELAY_KEY=<base58 Ed25519 keypair>  # relay signer
WARP_SOL_RPC=https://api.mainnet-beta.solana.com
```

**Adapter file:** `V3/L3/warp/src/adapter/solana.rs` — update `zion_mint()` function

---

### 2. NEAR (NEP-141)

**Contract:** `near/zion_token.rs` (Rust → WASM)
**Decimals:** 6
**CLI tools:** `near-cli`, `cargo-near`

```bash
# Install tools
npm install -g near-cli
cargo install cargo-near

# Build WASM
cd near/
cargo near build

# Deploy to NEAR account (must create account first: zion.near)
near deploy --accountId zion.near --wasmFile target/near/zion_token.wasm

# Initialize contract
near call zion.near new '{"admin":"warp.near","decimals":6}' --accountId warp.near

# Output: contract account ID (e.g., zion.near)
```

**Env vars to set:**
```bash
WARP_NEAR_ZION_CONTRACT=zion.near
WARP_NEAR_RELAY_KEY=<base64 Ed25519 seed>
WARP_NEAR_SIGNER_ACCOUNT=warp.near
WARP_NEAR_RPC=https://rpc.mainnet.near.org
```

**Adapter file:** `V3/L3/warp/src/adapter/near.rs` — update `WARP_NEAR_BRIDGE_CONTRACT` default

---

### 3. Cosmos (CosmWasm CW20)

**Contract:** `cosmos/zion_cw20.rs` (Rust → WASM)
**Decimals:** 6
**CLI tools:** `wasmd`, `cargo`

```bash
# Install wasmd
git clone https://github.com/CosmWasm/wasmd.git
cd wasmd && git checkout v0.45.0 && make install

# Compile WASM
cd cosmos/
cargo build --release --target wasm32-unknown-unknown
# Optimize:
docker run --rm -v $(pwd):/code \
  cosmwasm/rust-optimizer:0.15.0 \
  cosmwasm/rust-optimizer:0.15.0

# Store code on chain
wasmd tx wasm store target/wasm32-unknown-unknown/release/zion_cw20.wasm \
  --from relay --chain-id cosmoshub-4 --gas auto --fees 50000uatom

# Get code ID from tx response, then instantiate
wasmd tx wasm instantiate <code_id> '{"name":"ZION","symbol":"ZION","decimals":6,"admin":"warp1...","bridge":"warp1..."}' \
  --from relay --chain-id cosmoshub-4 --label "ZION Token" --admin warp1...

# Output: contract address (cosmos1...)
```

**Env vars to set:**
```bash
WARP_COSMOS_ZION_CONTRACT=<cosmos1... address>
WARP_COSMOS_RELAY_KEY=<base64 Ed25519 key>
COSMOS_NETWORK=cosmoshub-4
WARP_COSMOS_REST=https://lcd.cosmos.cosmoshub-4
```

**Adapter file:** `V3/L3/warp/src/adapter/cosmos.rs` — update `zion_contract()` function

---

### 4. Aptos (Move Coin)

**Contract:** `aptos/sources/zion_coin.move`
**Decimals:** 6
**CLI tools:** `aptos-cli`

```bash
# Install
curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3

# Publish module
cd aptos/
aptos move publish \
  --named-addresses zion_coin=<bridge_account_0x...> \
  --profile mainnet \
  --gas-unit-price 100 \
  --max-gas 100000

# Output: package object ID, bridge account address
```

**Env vars to set:**
```bash
WARP_APTOS_BRIDGE_ACCOUNT=<0x hex address>
WARP_APTOS_EVENT_HANDLE=0x...::zion_coin::BridgeBurnEvent
WARP_APTOS_EVENT_FIELD=burn_events
WARP_APTOS_RELAY_KEY=<hex Ed25519 seed>
WARP_APTOS_RPC=https://fullnode.mainnet.aptoslabs.com/v1
```

**Adapter file:** `V3/L3/warp/src/adapter/aptos.rs` — update `WARP_APTOS_BRIDGE_ACCOUNT` default

---

### 5. Sui (Move Coin)

**Contract:** `sui/sources/zion_coin.move`
**Decimals:** 6
**CLI tools:** `sui-cli`

```bash
# Install sui CLI (build from source)
cargo install --git https://github.com/MystenLabs/sui.git --branch mainnet sui

# Publish package
cd sui/
sui client publish --gas-budget 100000000

# Output: package object ID (0x...)
```

**Env vars to set:**
```bash
WARP_SUI_PACKAGE=<0x hex package object ID>
WARP_SUI_RELAY_KEY=<hex Ed25519 seed>
WARP_SUI_RPC=https://fullnode.mainnet.sui.io
```

**Adapter file:** `V3/L3/warp/src/adapter/sui.rs` — update `WARP_SUI_PACKAGE` default

---

### 6. Tron (TRC-20)

**Contract:** `tron/ZionToken.sol` (Solidity)
**Decimals:** 6
**CLI tools:** `tronbox` (Node.js)

```bash
# Install
npm install -g tronbox

# Deploy
cd tron/
# Edit tronbox.js with mainnet private key + API key
tronbox migrate --network mainnet

# Output: contract address (T...)
```

**Env vars to set:**
```bash
WARP_TRON_ZION_CONTRACT=<T... base58 address>
WARP_TRON_RELAY_KEY=<hex private key>
WARP_TRON_RPC=https://api.trongrid.io
```

**Adapter file:** `V3/L3/warp/src/adapter/tron.rs` — update `zion_contract()` function

---

### 7. Stellar (Native Asset)

**Contract:** `stellar/zion_asset.toml` + `stellar/setup_zion_asset.py`
**Decimals:** 6 (Stellar integer amounts, 1 ZION = 1000000 units)
**CLI tools:** `stellar-sdk` (Python), `stellar-cli`

```bash
# Install
pip install stellar-sdk

# Create issuer account (5/5 multisig) + set up ZION asset
cd stellar/
python3 setup_zion_asset.py --network mainnet --issuer-seed <S...>

# Output: ZION asset issuer (G...), bridge account (G...)
```

**Env vars to set:**
```bash
WARP_STELLAR_ZION_ISSUER=<G... public key>
WARP_STELLAR_ZION_CODE=ZION
WARP_STELLAR_BRIDGE_ACCOUNT=<G... public key>
WARP_STELLAR_RELAY_KEY=<base64 Ed25519 seed>
WARP_STELLAR_RPC=https://horizon.stellar.org
```

**Adapter file:** `V3/L3/warp/src/adapter/stellar.rs` — update `zion_contract()` function

---

### 8. TON (TEP-74 Jetton)

**Contract:** `ton/zion_jetton.fc` (FunC)
**Decimals:** 9 (TON standard)
**CLI tools:** `toncli` or `blueprint`

```bash
# Install
pip install toncli
# OR
npm install -g @ton/blueprint

# Build + deploy
cd ton/
toncli deploy -n mainnet
# OR
blueprint run

# Output: jetton master address (EQ...), bridge wallet address (EQ...)
```

**Env vars to set:**
```bash
WARP_TON_JETTON_MASTER=<EQ... address>
WARP_TON_BRIDGE_WALLET=<EQ... address>
WARP_TON_RELAY_KEY=<hex Ed25519 key>
WARP_TON_API=https://toncenter.com/api/v2JSONRPC
WARP_TON_API_KEY=<optional API key>
```

**Adapter file:** `V3/L3/warp/src/adapter/ton.rs` — update `WARP_TON_BRIDGE_ACCOUNT` default

---

### 9. Cardano (Native Token)

**Contract:** `cardano/mint_zion_token.hs` (Haskell/Plutus)
**Decimals:** 6
**CLI tools:** `cardano-cli`, Blockfrost API

```bash
# Install cardano-cli (build from source or download binary)
# See: https://github.com/input-output-hk/cardano-node/releases

# Generate policy keypair
cardano-cli address key-gen \
  --verification-key-file policy.vkey \
  --signing-key-file policy.skey

# Create policy script (with time expiry)
cardano-cli transaction policyid \
  --script-file policy.json

# Mint ZION tokens
cardano-cli transaction mint \
  --tx-in <tx-hash>#0 \
  --mint "100000000000 ZION" \
  --mint-script-file policy.json \
  --policy-id <policy_hash> \
  --out-file mint.txbody \
  --testnet-magic 1  # mainnet: omit this flag

# Submit
cardano-cli transaction sign \
  --signing-key-file policy.skey \
  --signing-key-file payment.skey \
  --tx-body-file mint.txbody \
  --out-file mint.signed

cardano-cli transaction submit \
  --tx-file mint.signed

# Output: policy ID (hex), asset name "ZION"
```

**Env vars to set:**
```bash
WARP_CARDANO_POLICY_ID=<hex policy hash>
WARP_CARDANO_ASSET_NAME=ZION
WARP_CARDANO_POLICY_SCRIPT=<JSON policy>
BLOCKFROST_PROJECT_ID=<project key>
WARP_CARDANO_PAYMENT_KEY=<hex skey>
WARP_CARDANO_POLICY_KEY=<hex skey>
WARP_BLOCKFROST_URL=https://cardano-mainnet.blockfrost.io/api/v0
```

**Adapter file:** `V3/L3/warp/src/adapter/cardano.rs` — update `zion_asset()` function

---

## Post-Deploy Checklist

After each chain deploy:

1. [ ] Contract address recorded in `CONTRACT_ADDRESSES.md` §4
2. [ ] Placeholder updated in `V3/L3/warp/src/adapter/<chain>.rs`
3. [ ] Env vars set in `/root/.env.warp` on Edge server
4. [ ] WARP restarted: `systemctl restart zion-warp`
5. [ ] Health check: `curl http://127.0.0.1:8453/health`
6. [ ] Chain-specific health: `curl http://127.0.0.1:8453/health/<chain>`
7. [ ] Test mint: send small amount through WARP bridge, verify receipt on target chain
8. [ ] Test burn: burn small amount on target chain, verify ZION unlocked on L1
9. [ ] Commit + push updated adapter + docs

## WARP Adapter Status Summary

| Chain | Adapter File | Contract Source | TODO Comments | Status |
|-------|-------------|----------------|---------------|--------|
| Solana | `solana.rs` | `solana/zion_spl_token.rs` | ✅ 2 TODOs | 🔴 Pending deploy |
| Tron | `tron.rs` | `tron/ZionToken.sol` | ✅ 2 TODOs | 🔴 Pending deploy |
| Stellar | `stellar.rs` | `stellar/zion_asset.toml` | ✅ 2 TODOs | 🔴 Pending deploy |
| Cardano | `cardano.rs` | `cardano/mint_zion_token.hs` | ✅ 2 TODOs | 🔴 Pending deploy |
| Cosmos | `cosmos.rs` | `cosmos/zion_cw20.rs` | ✅ 2 TODOs | 🔴 Pending deploy |
| Aptos | `aptos.rs` | `aptos/sources/zion_coin.move` | ✅ 1 TODO | 🔴 Pending deploy |
| Sui | `sui.rs` | `sui/sources/zion_coin.move` | ✅ 1 TODO | 🔴 Pending deploy |
| NEAR | `near.rs` | `near/zion_token.rs` | ✅ 1 TODO | 🔴 Pending deploy |
| TON | `ton.rs` | `ton/zion_jetton.fc` | ✅ Documented | 🔴 Pending deploy |

All adapters are implemented and tested with placeholder addresses. Each adapter has inline TODO comments pointing to the contract source file and deploy instructions.
