# Non-EVM ZION Token Contracts — Deploy Guide

> **Status:** 🟡 2/9 deployed (Solana ✅, Stellar ✅)
> **Last updated:** 2026-07-13
> **Parent doc:** [`docs/3.0.5/CONTRACT_ADDRESSES.md`](../../../../../docs/3.0.5/CONTRACT_ADDRESSES.md)

## Overview

ZION token contracts for 9 non-EVM chains. Each contract implements the chain-native token standard with WARP bridge integration (mint/burn controlled by WARP validators).

After deploying each contract, update:
1. The placeholder address in `V31/L2/multichain/src/warp/adapter/<chain>.rs`
2. The env vars in `/root/.env.warp` on the Edge server
3. The address table in [`docs/3.0.5/CONTRACT_ADDRESSES.md`](../../../../../docs/3.0.5/CONTRACT_ADDRESSES.md) §4
4. Restart WARP: `systemctl restart zion-v31-multichain`

## Deploy Order (recommended)

Start with chains that have the cheapest gas + most mature tooling:

| # | Chain | Token Standard | Gas Token | Est. Deploy Cost | CLI Tool | Status |
|---|-------|---------------|-----------|-----------------|----------|--------|
| 1 | Solana | SPL Token | SOL | ~0.002 SOL | `solana-cli` + `spl-token-cli` | ✅ Deployed |
| 2 | Stellar | Native Asset | XLM | ~0.00003 XLM | `stellar-sdk` (Python) | ✅ Deployed |
| 3 | NEAR | NEP-141 | NEAR | ~0.1 NEAR | `near-cli` | 🔴 Pending |
| 4 | Cosmos | CW20 | ATOM | ~5000 ATOM | `wasmd` | 🔴 Pending |
| 5 | Aptos | Move Coin | APT | ~0.5 APT | `aptos-cli` | 🔴 Pending |
| 6 | Sui | Move Coin | SUI | ~1 SUI | `sui-cli` | 🔴 Pending |
| 7 | Tron | TRC-20 | TRX | ~500-1000 TRX | `tronbox` | 🔴 Pending (needs TRX) |
| 8 | TON | TEP-74 Jetton | TON | ~0.5 TON | `toncli` | 🔴 Pending |
| 9 | Cardano | Native Token | ADA | ~2 ADA | `cardano-cli` | 🔴 Pending |

## Per-Chain Deploy Instructions

### 1. Solana (SPL Token) — ✅ DEPLOYED 2026-07-13

**Mint:** `HgfQZpH2JAqPdR3PcP4dEE8WRhznXh1QhJBiiwcHfT8H`
**Decimals:** 6
**Supply:** 1,000,000,000 ZION (1B)
**Mint authority:** Deployer keypair (TODO: transfer to WARP multisig)

**Contract:** `solana/zion_spl_token.rs` (Anchor program)
**CLI tools:** `solana-cli`, `spl-token-cli`

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
WARP_SOLANA_ZION_MINT=<base58 mint pubkey>
WARP_SOLANA_RELAY_KEY=<base58 Ed25519 keypair JSON>  # relay signer
WARP_SOLANA_RPC=https://api.mainnet-beta.solana.com
```

**Adapter file:** `V31/L2/multichain/src/warp/adapter/solana.rs` — update `zion_mint()` function

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
WARP_NEAR_BRIDGE_CONTRACT=zion.near
WARP_NEAR_RELAY_KEY=<hex Ed25519 seed>
WARP_NEAR_ACCOUNT=warp.near
WARP_NEAR_RPC=https://rpc.mainnet.near.org
```

**Adapter file:** `V31/L2/multichain/src/warp/adapter/near.rs` — update `WARP_NEAR_BRIDGE_CONTRACT` default

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
WARP_COSMOS_CONTRACT=<cosmos1... address>
WARP_COSMOS_RELAY_KEY=<hex Ed25519 seed>
WARP_COSMOS_REST=https://api.cosmos.network
```

**Adapter file:** `V31/L2/multichain/src/warp/adapter/cosmos.rs` — update `zion_contract()` function

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

**Adapter file:** `V31/L2/multichain/src/warp/adapter/aptos.rs` — update `WARP_APTOS_BRIDGE_ACCOUNT` default

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
WARP_SUI_BRIDGE_PACKAGE=<0x hex bridge package object ID>
WARP_SUI_RELAY_KEY=<hex Ed25519 seed>
WARP_SUI_RPC=https://fullnode.mainnet.sui.io:443
```

**Adapter file:** `V31/L2/multichain/src/warp/adapter/sui.rs` — update `WARP_SUI_PACKAGE` default

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
WARP_TRON_CONTRACT=<T... base58 address>
WARP_TRON_RELAY_KEY=<hex private key>
WARP_TRON_API=https://api.trongrid.io
```

**Adapter file:** `V31/L2/multichain/src/warp/adapter/tron.rs` — update `zion_contract()` function

---

### 7. Stellar (Native Asset) — ✅ DEPLOYED 2026-07-13

**Asset:** `ZION:GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT`
**Issuer:** `GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT`
**TX:** `5c1d2ba0834f815dae0e769df89e4fdc0392da2145e1df8848603db42386ec95`
**Ledger:** 63451614
**Flags:** auth_required, auth_revocable, auth_immutable
**Home domain:** zionterranova.com
**Cost:** ~0.00003 XLM (TX fee only)

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
WARP_STELLAR_ASSET_CODE=ZION
WARP_STELLAR_RELAY_KEY=<S... secret key>
WARP_STELLAR_HORIZON=https://horizon.stellar.org
WARP_STELLAR_SOROBAN=https://soroban-testnet.stellar.io  # or mainnet RPC when live
```

**Adapter file:** `V31/L2/multichain/src/warp/adapter/stellar.rs` — update `zion_contract()` function

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
WARP_TON_BRIDGE_ACCOUNT=<EQ... jetton master address>
WARP_TON_RELAY_KEY=<hex Ed25519 seed>
WARP_TON_API=https://toncenter.com/api/v2/jsonRPC
WARP_TON_API_KEY=<optional API key>
```

**Adapter file:** `V31/L2/multichain/src/warp/adapter/ton.rs` — update `WARP_TON_BRIDGE_ACCOUNT` default

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
WARP_CARDANO_ZION_ASSET=<hex policy_id + 5a494f4e>
WARP_CARDANO_PAYMENT_KEY=<hex skey>
WARP_CARDANO_POLICY_KEY=<hex skey>
WARP_BLOCKFROST_URL=https://cardano-mainnet.blockfrost.io/api/v0
```

**Adapter file:** `V31/L2/multichain/src/warp/adapter/cardano.rs` — update `zion_asset()` function

---

## Post-Deploy Checklist

After each chain deploy:

1. [ ] Contract address recorded in `CONTRACT_ADDRESSES.md` §4
2. [ ] Placeholder updated in `V31/L2/multichain/src/warp/adapter/<chain>.rs`
3. [ ] Env vars set in `/root/.env.warp` on Edge server
4. [ ] WARP restarted: `systemctl restart zion-v31-multichain`
5. [ ] Health check: `curl http://127.0.0.1:8453/health`
6. [ ] Chain-specific health: `curl http://127.0.0.1:8453/health/<chain>`
7. [ ] Test mint: send small amount through WARP bridge, verify receipt on target chain
8. [ ] Test burn: burn small amount on target chain, verify ZION unlocked on L1
9. [ ] Commit + push updated adapter + docs

## Testnet Smoke-Test Notes (2026-08-06)

A local `warpd` instance was run with `solana`, `stellar`, and `bitcoin` enabled. The Stellar adapter successfully executed a live `execute_mint` on the SDF testnet.

### Stellar (testnet)
- Issuer / bridge / relay: `GC4SGOGJWQGBSPJOM5M3RXVWLKWWAZIF4NNPVA4TTBWN36ZW6J7AMEDS`
- Distribution account: `GCSGJDBBDQVLNCEJGAUJ2SBZNCDL4G7HBVD6N2MT754LPZZIIF5TS3KV`
- Asset: `ZION`
- Horizon: `https://horizon-testnet.stellar.org`
- Latest mint test TX: `2cbe550fe7730d2c06abf5ab58c290f95962e39a39c471c7c56881c51c68d34e`
- Result: `execute_mint` passed, distribution account received 0.001 ZION.
- The relay secret is set only in the Edge environment file (`/root/.env.warp`); never commit it.

### Solana (devnet)
- Relay public key: `4J2FRDrHFihJ3QdjF3eLAQ7tZDagyAsgVcKFDh7xdmr3`
- Placeholder mint: `3XtfWPaLQTLrjTT6hhzo6WVZP73KmW2JpQnU8iaVwLEU`
- RPC: `https://api.devnet.solana.com`
- Result: `watch_events` polls correctly (0 BridgeBurn proofs). Relay balance is 0 lamports; `requestAirdrop` returned `429` (faucet dry/rate-limited). A real SPL mint + devnet SOL are required for a live `mint_to` test.

### Bitcoin (testnet)
- Relay / HTLC watch address: `tb1qjkq5gmqp4rm2yj4zefjvw63p3mxle86leflq4z`
- API: `https://mempool.space/testnet/api`
- Result: `watch_events` polls correctly (0 HTLC deposits). Address has 0 UTXOs. Testnet BTC and a real P2WSH HTLC script are required for a live `execute_mint` test.

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
