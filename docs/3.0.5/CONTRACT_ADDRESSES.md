# ZION WARP — Contract Addresses & Configuration

> **Status:** 🟢 EVM + LND + ZionDex deployed · 🟡 Non-EVM contracts ready, pending deploy
> **Last updated:** 2026-07-13
> **Purpose:** Jednotné místo pro všechny kontrakt adresy, relay klíče, RPC endpointy a env vars pro WARP bridge
>
> **Jak používat:**
> 1. Po deploy kontraktu na chain doplň adresu do tabulky níže
> 2. Nastav odpovídající env var na Edge serveru (`/root/.env.warp` nebo systemd unit)
> 3. Restartuj `zion-warp.service`: `systemctl restart zion-warp`
> 4. Ověř: `curl http://127.0.0.1:8453/health`

---

## 1. EVM Chains (wZION ERC-20) — ✅ DEPLOYED

Všechny EVM chainy používají **deterministic deploy** se stejnou adresou.

| Chain | Chain ID | wZION Address | ZIONBridge Address | Status |
|-------|----------|---------------|-------------------|--------|
| Base | 8453 | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ✅ Live |
| BSC | 56 | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ✅ Live |
| Polygon | 137 | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ✅ Live |
| Arbitrum | 42161 | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ✅ Live |
| Optimism | 10 | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ✅ Live |
| Avalanche | 43114 | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ✅ Live |

**EVM env vars (již nastaveno na Edge):**
```bash
# V /root/.env.warp nebo systemd unit
WARP_BASE_RPC=https://mainnet.base.com
WARP_BSC_RPC=https://bsc-dataseed.binance.org
WARP_POLYGON_RPC=https://polygon-rpc.com
WARP_ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
WARP_OPTIMISM_RPC=https://mainnet.optimism.io
WARP_AVALANCHE_RPC=https://api.avax.network/ext/bc/C/rpc
```

---

## 2. Bitcoin (BTC WARP) — 🔴 HTLC PLACEHOLDER

Bitcoin používá **HTLC watch address** + **OP_RETURN prefix** pro WARP inbound.
ZION se nepřevádí na BTC — BTC je **watch-only** chain (sleduje BTC deposits do HTLC address a mintne ZION na L1).

### Co je potřeba nastavit

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **HTLC mainnet address** | `WARP_BTC_HTLC_ADDRESS` | `bc1q...` (bech32) | 🔴 Placeholder `bc1qzionhtlcxxx...` |
| **HTLC testnet address** | — | `tb1q...` | 🔴 Placeholder |
| **BTC API** | `WARP_BITCOIN_API` | `https://mempool.space/api` | ✅ Default |
| **BTC network** | `BITCOIN_NETWORK` | `mainnet` | ✅ Default |
| **BTC relay key** | `WARP_BTC_RELAY_KEY` | WIF private key | 🔴 Not set |

### HTLC Address — jak vygenerovat

HTLC address je **P2WSH** (bech32 segwit) address kontrolovaný 5/5 WARP validatory:

```bash
# 1. Vygeneruj HTLC redeem script (5-of-5 multisig + timelock)
# Format: <pubkey1> <pubkey2> <pubkey3> <pubkey4> <pubkey5> OP_5 OP_CHECKMULTISIG

# 2. Vytvoř P2WSH address z redeem scriptu
bitcoin-cli -mainnet createmultisig 5 '["pubkey1","pubkey2","pubkey3","pubkey4","pubkey5"]' bech32
```

### OP_RETURN format pro BTC deposits

```
OP_RETURN: WARP_INBOUND:bitcoin:<zion1_recipient_address>
```

User pošle BTC na HTLC address s OP_RETURN obsahujícím ZION L1 recipient.
WARP validators sledují BTC blockchain, po 6 confirmations mintne ZION na L1.

### Bitcoin adapter source
- **Adapter:** `V3/L3/warp/src/adapter/bitcoin.rs`
- **Signer:** `V3/L3/warp/src/btc_signer.rs`
- **HTLC address funkce:** `htlc_address()` v `bitcoin.rs:17`
- **Placeholder:** `bc1qzionhtlcxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (mainnet)

---

## 3. Lightning Network (BTC L2) — ✅ DEPLOYED (testnet)

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **LND REST URL** | `WARP_LN_NODE_URL` | `https://127.0.0.1:8080` | ✅ Live (Docker) |
| **LND gRPC URL** | `ZION_LN_GRPC_URL` | `127.0.0.1:10009` | ✅ Live (Docker) |
| **LND macaroon** | `WARP_LN_MACAROON` / `ZION_LN_MACAROON` | hex-encoded admin macaroon | ✅ Extracted |
| **LND TLS cert** | `WARP_LN_TLS_CERT` / `ZION_LN_TLS_CERT` | `/root/.lnd/tls.cert` | ✅ Extracted |
| **LND pubkey** | `ZION_LN_PUBKEY` | `<node pubkey>` | ✅ Set |
| **LND network** | `ZION_LN_NETWORK` | `testnet` | ✅ (mainnet pending) |
| **Deposit address** | `ZION_LN_DEPOSIT_ADDRESS` | `<on-chain addr>` | ✅ Set |
| **systemd service** | `zion-lnd.service` | — | ✅ Active |
| **Docker stack** | bitcoind + LND + Redis | — | ✅ Running (testnet, syncing) |

### LND Setup (Docker)
- **Docker compose:** `V3/L3/warp/docker/lightning/docker-compose.yml`
- **LND config:** `V3/L3/warp/docker/lightning/lnd.conf`
- **bitcoind config:** `V3/L3/warp/docker/lightning/bitcoin.conf`
- **Scripts:** `V3/L3/warp/scripts/lightning/` (open_channel, list_channels, get_macaroon, create_invoice, pay_invoice)
- **systemd:** `edge-deploy/systemd/zion-edge-lnd.service`

### Deploy steps
```bash
# 1. Na Edge:
cd /root/V3/L3/warp/docker/lightning
docker compose up -d

# 2. Počkej na sync (testnet ~30 min)
docker compose logs -f lnd

# 3. Vytvoř wallet
docker exec -it lnd lncli create

# 4. Otevři kanál
/root/V3/L3/warp/scripts/lightning/open_channel.sh

# 5. Extrahuj macaroon
MACAROON=$(/root/V3/L3/warp/scripts/lightning/get_macaroon.sh)

# 6. Nastav env vars
echo "WARP_LN_NODE_URL=https://127.0.0.1:8080" >> /root/.env.warp
echo "WARP_LN_MACAROON=$MACAROON" >> /root/.env.warp
echo "WARP_LN_TLS_CERT=/root/.lnd/tls.cert" >> /root/.env.warp

# 7. Restart WARP
systemctl restart zion-warp
```

---

## 4. Non-EVM Chains — 🔴 CONTRACTS CREATED, NOT DEPLOYED

Kontrakty jsou v `V3/L2/bridge/contracts/non-evm/`. Po deploy doplň adresy níže.

### Solana (SPL Token)

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **ZION mint address** | `WARP_SOL_ZION_MINT` | `<base58 mint pubkey>` | 🔴 Placeholder |
| **Bridge program ID** | `WARP_SOL_BRIDGE_PROGRAM` | `<base58 program id>` | 🔴 Placeholder |
| **Solana RPC** | `WARP_SOL_RPC` | `https://api.mainnet-beta.solana.com` | ✅ Default |
| **Relay key** | `WARP_SOL_RELAY_KEY` | base58 Ed25519 keypair | 🔴 Not set |

**Kontrakt:** `V3/L2/bridge/contracts/non-evm/solana/zion_spl_token.rs`
**Deploy:** `anchor deploy --provider.cluster mainnet`
**Decimals:** 6

---

### Tron (TRC-20)

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **ZION contract address** | `WARP_TRON_ZION_CONTRACT` | `<hex address T...>` | 🔴 Placeholder |
| **Tron RPC** | `WARP_TRON_RPC` | `https://api.trongrid.io` | ✅ Default |
| **Relay-key** | `WARP_TRON_RELAY_KEY` | hex private key | 🔴 Not set |

**Kontrakt:** `V3/L2/bridge/contracts/non-evm/tron/ZionToken.sol`
**Deploy:** `tronbox migrate --network mainnet`
**Decimals:** 6

---

### Stellar (Native Asset)

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **ZION asset issuer** | `WARP_STELLAR_ZION_ISSUER` | `<G... public key>` | 🔴 Placeholder |
| **ZION asset code** | `WARP_STELLAR_ZION_CODE` | `ZION` | ✅ Default |
| **Bridge account** | `WARP_STELLAR_BRIDGE_ACCOUNT` | `<G... public key>` | 🔴 Placeholder |
| **Stellar RPC** | `WARP_STELLAR_RPC` | `https://horizon.stellar.org` | ✅ Default |
| **Relay-key** | `WARP_STELLAR_RELAY_KEY` | base64 Ed25519 seed | 🔴 Not set |

**Kontrakt:** `V3/L2/bridge/contracts/non-evm/stellar/zion_asset.toml` + `setup_zion_asset.py`
**Deploy:** `python3 setup_zion_asset.py --network mainnet --issuer-seed <S...>`
**Decimals:** 6 (Stellar používá integer amounts, 1 ZION = 1000000 units)

---

### Cardano (Native Token)

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **Policy ID** | `WARP_CARDANO_POLICY_ID` | `<hex policy hash>` | 🔴 Placeholder |
| **Asset name** | `WARP_CARDANO_ASSET_NAME` | `ZION` | ✅ Default |
| **Policy script** | `WARP_CARDANO_POLICY_SCRIPT` | `<JSON policy>` | 🔴 Placeholder |
| **Blockfrost URL** | `WARP_BLOCKFROST_URL` | `https://cardano-mainnet.blockfrost.io/api/v0` | ✅ Default |
| **Blockfrost project ID** | `BLOCKFROST_PROJECT_ID` | `<project key>` | 🔴 Not set |
| **Payment-key** | `WARP_CARDANO_PAYMENT_KEY` | `<hex skey>` | 🔴 Not set |
| **Policy-key** | `WARP_CARDANO_POLICY_KEY` | `<hex skey>` | 🔴 Not set |

**Kontrakt:** `V3/L2/bridge/contracts/non-evm/cardano/mint_zion_token.hs`
**Deploy:** `cardano-cli transaction mint ...` (viz README v cardano/ adresáři)
**Decimals:** 6

---

### Cosmos (CosmWasm CW20)

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **CW20 contract address** | `WARP_COSMOS_ZION_CONTRACT` | `<cosmos1... addr>` | 🔴 Placeholder |
| **Chain ID** | `COSMOS_NETWORK` | `cosmoshub-4` | ✅ Default |
| **REST URL** | `WARP_COSMOS_REST` | `https://lcd.cosmos.cosmoshub-4` | ✅ Default |
| **Relay-key** | `WARP_COSMOS_RELAY_KEY` | base64 Ed25519 key | 🔴 Not set |

**Kontrakt:** `V3/L2/bridge/contracts/non-evm/cosmos/zion_cw20.rs`
**Deploy:** `wasmd store-code zion_cw20.wasm --from relay --chain-id cosmoshub-4`
**Decimals:** 6

---

### Aptos (Move Coin)

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **Bridge account** | `WARP_APTOS_BRIDGE_ACCOUNT` | `<0x hex address>` | 🔴 Placeholder `0x42` |
| **Event handle** | `WARP_APTOS_EVENT_HANDLE` | `0x...::zion_coin::BridgeBurnEvent` | 🔴 Placeholder |
| **Event field** | `WARP_APTOS_EVENT_FIELD` | `burn_events` | ✅ Default |
| **Aptos RPC** | `WARP_APTOS_RPC` | `https://fullnode.mainnet.aptoslabs.com/v1` | ✅ Default |
| **Relay-key** | `WARP_APTOS_RELAY_KEY` | hex Ed25519 seed | 🔴 Not set |

**Kontrakt:** `V3/L2/bridge/contracts/non-evm/aptos/sources/zion_coin.move`
**Deploy:** `aptos move publish --named-addresses zion_coin=<bridge_account> --profile mainnet`
**Decimals:** 6

---

### Sui (Move Coin)

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **Package ID** | `WARP_SUI_PACKAGE` | `<0x hex package object ID>` | 🔴 Placeholder `0x2` |
| **Sui RPC** | `WARP_SUI_RPC` | `https://fullnode.mainnet.sui.io` | ✅ Default |
| **Relay-key** | `WARP_SUI_RELAY_KEY` | hex Ed25519 seed | 🔴 Not set |

**Kontrakt:** `V3/L2/bridge/contracts/non-evm/sui/sources/zion_coin.move`
**Deploy:** `sui client publish --gas-budget 100000000`
**Decimals:** 6

---

### NEAR (NEP-141)

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **ZION contract** | `WARP_NEAR_ZION_CONTRACT` | `<account.near>` | 🔴 Placeholder `zion.near` |
| **NEAR RPC** | `WARP_NEAR_RPC` | `https://rpc.mainnet.near.org` | ✅ Default |
| **Relay-key (account)** | `WARP_NEAR_RELAY_KEY` | base64 Ed25519 key | 🔴 Not set |
| **Signer account** | `WARP_NEAR_SIGNER_ACCOUNT` | `<relay.near>` | 🔴 Not set |

**Kontrakt:** `V3/L2/bridge/contracts/non-evm/near/zion_token.rs`
**Deploy:** `near deploy --accountId zion.near --wasmFile zion_token.wasm`
**Decimals:** 6

---

### TON (TEP-74 Jetton)

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **Jetton master** | `WARP_TON_JETTON_MASTER` | `<EQ... address>` | 🔴 Placeholder |
| **Bridge wallet** | `WARP_TON_BRIDGE_WALLET` | `<EQ... address>` | 🔴 Placeholder |
| **TON API** | `WARP_TON_API` | `https://toncenter.com/api/v2JSONRPC` | ✅ Default |
| **Relay-key** | `WARP_TON_RELAY_KEY` | hex Ed25519 key | 🔴 Not set |

**Kontrakt:** `V3/L2/bridge/contracts/non-evm/ton/zion_jetton.fc`
**Deploy:** `toncli deploy -n mainnet` nebo `blueprint run`
**Decimals:** 9 (TON standard)

---

## 5. ZION L1 Bridge Vault

| Položka | Hodnota | Status |
|---------|---------|--------|
| **BRIDGE_VAULT_ADDRESS** | keyless address, ~100M ZION locked | ✅ Active |
| **Bridge memo format (outbound)** | `BRIDGE:<chain>:<recipient>` | ✅ Active |
| **Bridge memo format (WARP)** | `WARP:1:<dest_chain>:<recipient>` | ✅ Active |
| **L1 RPC** | `getBridgeLocks`, `getBridgeVaultBalance`, `submitBridgeUnlock` | ✅ Active |
| **Validator quorum** | 3/5 (configurable to 5/5) | ✅ Active |
| **Timelock** | 24h | ✅ Active |

---

## 6. ZionDex Router (na Edge) — ✅ DEPLOYED

| Položka | Hodnota | Status |
|---------|---------|--------|
| **Router API (internal)** | `http://127.0.0.1:8454` | ✅ Live |
| **Router API (public)** | `https://zionterranova.com/dex-api` | ✅ Live (nginx proxy) |
| **WARP API URL** | `http://127.0.0.1:8453` | ✅ WARP běží |
| **L1 RPC URL** | `http://127.0.0.1:9443` | ✅ Node běží |
| **Endpoints** | `GET /quote`, `GET /quote/multi`, `POST /swap`, `GET /health`, `GET /pools`, `GET /prices/:token`, `GET /swaps`, `WS /stream` | ✅ Implementováno |
| **Phase 4 — Intent API** | `POST /intent`, `GET /intent/:id`, `POST /intent/:id/bid`, `GET /intent/:id/bids`, `POST /intent/:id/settle`, `POST /intent/:id/cancel`, `GET /intents` | ✅ Implementováno |
| **systemd service** | `zion-dex.service` | ✅ Active |
| **Config** | `/root/ziondex-router.toml` | ✅ |
| **Tests** | 37/37 Rust tests (20 unit + 8 integration + 9 intent) | ✅ |

### ZionDex Phase 3+4 Contracts (na Base) — 🔴 PENDING DEPLOY

| Kontrakt | Address | Status |
|----------|---------|--------|
| **ZionDexPoolManager** | `0x...` | 🔴 Pending (script ready) |
| **ZionDexHooks** | `0x...` | 🔴 Pending |
| **ZionDexRouter** | `0x...` | 🔴 Pending |
| **ZDXToken** | `0x...` | 🔴 Pending |
| **ZionDexStaking** | `0x...` | 🔴 Pending |
| **SolverRegistry** | `0x...` | 🔴 Pending (Phase 4) |
| **IntentSettlement** | `0x...` | 🔴 Pending (Phase 4) |

**Deploy script:** `ZionDex/contracts/script/DeployBase.s.sol`
**Test results:** 20/20 Foundry tests passing (7 PoolManager + 13 IntentSettlement)
**Deployer address:** `0xA737B512B5EEc5B9E3E3f2476Eb1cFDF6750BA12` (needs ETH on Base)

---

## 7. Edge Server Port Map (2026-07-13)

| Port | Service | Bind | Status |
|------|---------|------|--------|
| 80 | nginx (HTTP→HTTPS redirect) | 0.0.0.0 | ✅ |
| 443 | nginx (HTTPS, zionterranova.com + /dex-api proxy) | 0.0.0.0 | ✅ |
| 3000 | Next.js web (Docker) | 0.0.0.0 | ✅ |
| 8094 | zion-oasis | 127.0.0.1 | ✅ |
| 8095 | zion-free-world | 127.0.0.1 | ✅ |
| 8096 | zion-issobella | 127.0.0.1 | ✅ |
| 8333 | ZION P2P | 0.0.0.0 | ✅ |
| 8443 | nginx (public RPC proxy → 9443) | 0.0.0.0 | ✅ |
| 8444 | zion-pool | 0.0.0.0 | ✅ |
| 8445 | zion-node WS | 127.0.0.1 | ✅ |
| 8450 | zion-dao | 127.0.0.1 | ✅ |
| **8453** | **zion-warp** | **0.0.0.0** | ✅ |
| **8454** | **zion-dex (ZionDex Router)** | **0.0.0.0** | ✅ Live |
| **8455** | **ziondex-solver (Phase 4)** | **0.0.0.0** | 🔴 Free (pending keys) |
| 8766 | dashboard (python) | 127.0.0.1 | ✅ |
| 9443 | zion-node RPC | 127.0.0.1 | ✅ |
| **8080** | **LND REST** | **127.0.0.1** | ✅ Docker (zion-lnd) |
| **10009** | **LND gRPC** | **127.0.0.1** | ✅ Docker (zion-lnd) |
| **9735** | **LND Lightning P2P** | **0.0.0.0** | ✅ Docker (zion-lnd) |
| 18332 | bitcoind RPC (testnet) | 127.0.0.1 | ✅ Docker (zion-lnd) |
| 18333 | bitcoind P2P (testnet) | 0.0.0.0 | ✅ Docker (zion-lnd) |
| 28332 | bitcoind ZMQ rawtx | 127.0.0.1 | ✅ Docker (zion-lnd) |
| 28333 | bitcoind ZMQ rawblock | 127.0.0.1 | ✅ Docker (zion-lnd) |

**Žádné konflikty.** Port 8455 (solver daemon) je volný — pending provision solver keys.

---

## 8. Deploy Checklist (pořadí)

### ✅ Hotovo
1. ~~**LND na Edge** — `docker compose up`, sync, open channels, macaroon~~ ✅ Done (zion-lnd systemd, testnet syncing)
2. ~~**ZionDex Router na Edge** — build, systemd, port 8454~~ ✅ Done (zion-dex.service active, nginx /dex-api proxy)
3. ~~**ZionDex Phase 4 — Intent crate + Solver daemon + Contracts~~ ✅ Done (88 tests passing, commit `f32c81501`)

### 🔴 Pending
4. **BTC WARP HTLC** — vygeneruj 5-of-5 multisig P2WSH address, nastav `WARP_BTC_HTLC_ADDRESS` + `WARP_BTC_RELAY_KEY`
5. **ZionDex Phase 3+4 contracts na Base** — `forge script DeployBase.s.sol --rpc-url base --broadcast` (needs ETH on deployer `0xA737B512...`)
6. **Solver daemon na Edge** — `cargo build --release` v `ZionDex/solver/`, provision solver key, systemd service na port 8455
7. **Solana** — `anchor deploy`, nastav `WARP_SOL_ZION_MINT` + `WARP_SOL_BRIDGE_PROGRAM` + `WARP_SOL_RELAY_KEY`
8. **Tron** — `tronbox migrate --network mainnet`, nastav `WARP_TRON_ZION_CONTRACT` + `WARP_TRON_RELAY_KEY`
9. **Stellar** — `python3 setup_zion_asset.py --network mainnet`, nastav `WARP_STELLAR_ZION_ISSUER` + `WARP_STELLAR_BRIDGE_ACCOUNT` + `WARP_STELLAR_RELAY_KEY`
10. **Cardano** — `cardano-cli transaction mint ...`, nastav `WARP_CARDANO_POLICY_ID` + `WARP_CARDANO_POLICY_SCRIPT` + `BLOCKFROST_PROJECT_ID` + payment/policy keys
11. **Cosmos** — `wasmd store-code zion_cw20.wasm --from relay --chain-id cosmoshub-4`, nastav `WARP_COSMOS_ZION_CONTRACT` + `WARP_COSMOS_RELAY_KEY`
12. **Aptos** — `aptos move publish --named-addresses zion_coin=<bridge_account> --profile mainnet`, nastav `WARP_APTOS_BRIDGE_ACCOUNT` + `WARP_APTOS_RELAY_KEY`
13. **Sui** — `sui client publish --gas-budget 100000000`, nastav `WARP_SUI_PACKAGE` + `WARP_SUI_RELAY_KEY`
14. **NEAR** — `near deploy --accountId zion.near --wasmFile zion_token.wasm`, nastav `WARP_NEAR_ZION_CONTRACT` + `WARP_NEAR_RELAY_KEY` + `WARP_NEAR_SIGNER_ACCOUNT`
15. **TON** — `toncli deploy -n mainnet`, nastav `WARP_TON_JETTON_MASTER` + `WARP_TON_BRIDGE_WALLET` + `WARP_TON_RELAY_KEY`

### Po každém deploy
```bash
# 1. Nastav env vars v /root/.env.warp
# 2. Restart WARP
systemctl restart zion-warp
# 3. Ověř
curl http://127.0.0.1:8453/health
# 4. Ověř specifický chain adapter
curl http://127.0.0.1:8453/health/<chain>
```

### CLI tools potřebné pro non-EVM deploy
```bash
# Solana
sh -c "$(curl -sSfL https://release.solana.com/v1.18.0/install)"
# Tron
npm install -g tronbox
# Stellar
pip install stellar-sdk
# Cardano
# (cardano-cli — build from source or download binary)
# Cosmos
# (wasmd — build from source)
# Aptos
curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3
# Sui
# (sui CLI — build from source or download)
# NEAR
npm install -g near-cli
# TON
# (toncli — pip install toncli)
```
