# ZION WARP — Contract Addresses & Configuration

> **⚠️ DEPRECATED (2026-09-02):** This file is superseded by [`L2contracts.md`](../../L2contracts.md) in repo root.
> Kept for historical reference only. Do NOT update this file — update `L2contracts.md` instead.

> **Status:** 🟢 EVM + LND + ZionDex deployed · 🟡 Non-EVM contracts ready, pending deploy
> **Last updated:** 2026-07-13
> **Purpose:** Jednotné místo pro všechny kontrakt adresy, relay klíče, RPC endpointy a env vars pro WARP bridge
>
> **Jak používat:**
> 1. Po deploy kontraktu na chain doplň adresu do tabulky níže
> 2. Nastav odpovídající env var na Edge serveru (`/root/.env.warp` nebo systemd unit)
> 3. Restartuj `zion-warp.service`: `systemctl restart zion-v31-multichain`
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
| **HTLC mainnet address** | `WARP_BITCOIN_HTLC_ADDRESS` | `bc1q...` (bech32) | 🔴 Placeholder `bc1qzionhtlcxxx...` |
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
systemctl restart zion-v31-multichain
```

---

## 4. Non-EVM Chains — 🟡 2/9 DEPLOYED (Solana ✅, Stellar ✅)

Kontrakty jsou v `V31/L2/multichain/contracts/non-evm/`. Po deploy doplň adresy níže.

### Solana (SPL Token) — ✅ DEPLOYED

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **ZION mint address** | `WARP_SOLANA_ZION_MINT` | `HgfQZpH2JAqPdR3PcP4dEE8WRhznXh1QhJBiiwcHfT8H` | ✅ Live |
| **SPL Token program** | — | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` | ✅ Standard SPL |
| **Mint authority** | — | `CwUgTMF4kSydPUJYeQ6itRuq3iaXeJ9XTefBrBQbLWTe` (Exodus) | ✅ (TODO: transfer to WARP multisig) |
| **Bridge program ID** |  `WARP_SOLANA_BRIDGE_PROGRAM` (reserved) | `<base58 program id>` | 🔴 Pending (custom Anchor program) |
| **Solana RPC** | `WARP_SOLANA_RPC` | `https://api.mainnet-beta.solana.com` | ✅ Default |
| **Relay key** | `WARP_SOLANA_RELAY_KEY` | base58 Ed25519 keypair | 🔴 Not set |

**Deploy TX:** `425qNNcDyWAGCMmEc7D5mJri2wxVxkJmmBGzqfVM7JRNC8PrZa81ASCe3NpqrRhmfzBVyHUYxZKANfvUE3xnTZKp`
**Deploy date:** 2026-07-13
**Supply:** 1,000,000,000 ZION (1B minted to deployer token account)
**Token account:** `43RFgYnvmUPbaaQJtyoRpVs3tN9sgp4PxHGe3WkR4Rfb`
**Decimals:** 6

**Kontrakt:** `V31/L2/multichain/contracts/non-evm/solana/zion_spl_token.rs` (Anchor program — pending deploy)
**Current:** Standard SPL Token (funguje pro transfers, ale nemá bridge mint/burn events)
**TODO:** Deploy custom Anchor program pro WARP bridge integration (mint/burn events + validator quorum)

---

### Tron (TRC-20)

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **ZION contract address** | `WARP_TRON_CONTRACT` | `<hex address T...>` | 🔴 Placeholder |
| **Tron RPC** | `WARP_TRON_API` | `https://api.trongrid.io` | ✅ Default |
| **Relay-key** | `WARP_TRON_RELAY_KEY` | hex private key | 🔴 Not set |

**Kontrakt:** `V31/L2/multichain/contracts/non-evm/tron/ZionToken.sol`
**Deploy:** `tronbox migrate --network mainnet`
**Decimals:** 6

---

### Stellar (Native Asset) — ✅ DEPLOYED

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **ZION asset issuer** | `WARP_STELLAR_ZION_ISSUER` | `GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT` | ✅ Live |
| **ZION asset code** | `WARP_STELLAR_ASSET_CODE` | `ZION` | ✅ Default |
| **Bridge account** |  `WARP_STELLAR_ZION_ISSUER` (same as issuer) | `GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT` | ✅ Live |
| **Stellar RPC** | `WARP_STELLAR_HORIZON` | `https://horizon.stellar.org` | ✅ Default |
| **Relay-key** | `WARP_STELLAR_RELAY_KEY` | base64 Ed25519 seed | 🔴 Not set |
| **Multi-sig** | — | 5/5 WARP validators | 🔴 Pending (currently single-sig) |

**Deploy TX:** `5c1d2ba0834f815dae0e769df89e4fdc0392da2145e1df8848603db42386ec95`
**Deploy date:** 2026-07-13
**Ledger:** 63451614
**Flags:** auth_required, auth_revocable, auth_immutable
**Home domain:** zionterranova.com
**Asset:** `ZION:GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT`
**Decimals:** 6 (1 ZION = 1,000,000 stroops)

**Kontrakt:** `V31/L2/multichain/contracts/non-evm/stellar/zion_asset.toml` + `setup_zion_asset.py`
**TODO:** Add 5 WARP validators as multi-sig signers (5/5 quorum), set relay key

---

### Cardano (Native Token)

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **ZION asset** |  `WARP_CARDANO_ZION_ASSET` (`<policy_id_hex>` + asset name `5a494f4e`) | `<policy_id_hex>5a494f4e` | 🔴 Placeholder |
| **Blockfrost URL** | `WARP_BLOCKFROST_URL` | `https://cardano-mainnet.blockfrost.io/api/v0` | ✅ Default |
| **Payment-key** | `WARP_CARDANO_PAYMENT_KEY` | `<hex skey>` | 🔴 Not set |
| **Policy-key** | `WARP_CARDANO_POLICY_KEY` | `<hex skey>` | 🔴 Not set |

**Kontrakt:** `V31/L2/multichain/contracts/non-evm/cardano/mint_zion_token.hs`
**Deploy:** `cardano-cli transaction mint ...` (viz README v cardano/ adresáři)
**Decimals:** 6

---

### Cosmos (CosmWasm CW20)

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **CW20 contract address** | `WARP_COSMOS_CONTRACT` | `<cosmos1... addr>` | 🔴 Placeholder |
| **REST URL** | `WARP_COSMOS_REST` | `https://lcd.cosmos.cosmoshub-4` | ✅ Default |
| **Relay-key** | `WARP_COSMOS_RELAY_KEY` | base64 Ed25519 key | 🔴 Not set |

**Kontrakt:** `V31/L2/multichain/contracts/non-evm/cosmos/zion_cw20.rs`
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

**Kontrakt:** `V31/L2/multichain/contracts/non-evm/aptos/sources/zion_coin.move`
**Deploy:** `aptos move publish --named-addresses zion_coin=<bridge_account> --profile mainnet`
**Decimals:** 6

---

### Sui (Move Coin)

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **Package ID** | `WARP_SUI_PACKAGE` | `<0x hex package object ID>` | 🔴 Placeholder `0x2` |
| **Sui RPC** | `WARP_SUI_RPC` | `https://fullnode.mainnet.sui.io` | ✅ Default |
| **Relay-key** | `WARP_SUI_RELAY_KEY` | hex Ed25519 seed | 🔴 Not set |

**Kontrakt:** `V31/L2/multichain/contracts/non-evm/sui/sources/zion_coin.move`
**Deploy:** `sui client publish --gas-budget 100000000`
**Decimals:** 6

---

### NEAR (NEP-141)

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **ZION contract** | `WARP_NEAR_BRIDGE_CONTRACT` | `<account.near>` | 🔴 Placeholder `zion.near` |
| **NEAR RPC** | `WARP_NEAR_RPC` | `https://rpc.mainnet.near.org` | ✅ Default |
| **Relay-key (account)** | `WARP_NEAR_RELAY_KEY` | base64 Ed25519 key | 🔴 Not set |
| **Signer account** | `WARP_NEAR_ACCOUNT` | `<relay.near>` | 🔴 Not set |

**Kontrakt:** `V31/L2/multichain/contracts/non-evm/near/zion_token.rs`
**Deploy:** `near deploy --accountId zion.near --wasmFile zion_token.wasm`
**Decimals:** 6

---

### TON (TEP-74 Jetton)

| Položka | Env Var | Hodnota | Status |
|---------|---------|---------|--------|
| **Jetton master (bridge account)** |  `WARP_TON_BRIDGE_ACCOUNT` | `<EQ... address>` | 🔴 Placeholder |
| **TON API** | `WARP_TON_API` | `https://toncenter.com/api/v2JSONRPC` | ✅ Default |
| **Relay-key** | `WARP_TON_RELAY_KEY` | hex Ed25519 key | 🔴 Not set |

**Kontrakt:** `V31/L2/multichain/contracts/non-evm/ton/zion_jetton.fc`
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
4. **BTC WARP HTLC** — vygeneruj 5-of-5 multisig P2WSH address, nastav `WARP_BITCOIN_HTLC_ADDRESS` + `WARP_BTC_RELAY_KEY`
5. **ZionDex Phase 3+4 contracts na Base** — `forge script DeployBase.s.sol --rpc-url base --broadcast` (needs ETH on deployer `0xA737B512...`)
6. **Solver daemon na Edge** — `cargo build --release` v `ZionDex/solver/`, provision solver key, systemd service na port 8455
7. ~~**Solana** — `anchor deploy`, nastav `WARP_SOLANA_ZION_MINT` +  `WARP_SOLANA_BRIDGE_PROGRAM` (reserved) + `WARP_SOLANA_RELAY_KEY`~~ ✅ Done (standard SPL Token, mint `HgfQZpH2JAqPdR3PcP4dEE8WRhznXh1QhJBiiwcHfT8H`). TODO: deploy custom Anchor program pro bridge events + transfer mint authority to WARP multisig
8. **Tron** — `tronbox migrate --network mainnet`, nastav `WARP_TRON_CONTRACT` + `WARP_TRON_RELAY_KEY`
9. ~~**Stellar** — `python3 setup_zion_asset.py --network mainnet`, nastav `WARP_STELLAR_ZION_ISSUER` (issuer + bridge account) + `WARP_STELLAR_RELAY_KEY`~~ ✅ Done (ZION native asset, issuer `GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT`). TODO: add 5/5 multi-sig + relay key
10. **Cardano** — `cardano-cli transaction mint ...`, nastav `WARP_CARDANO_ZION_ASSET` + `WARP_CARDANO_PAYMENT_KEY` + `WARP_CARDANO_POLICY_KEY` + `WARP_BLOCKFROST_URL`
11. **Cosmos** — `wasmd store-code zion_cw20.wasm --from relay --chain-id cosmoshub-4`, nastav `WARP_COSMOS_CONTRACT` + `WARP_COSMOS_RELAY_KEY`
12. **Aptos** — `aptos move publish --named-addresses zion_coin=<bridge_account> --profile mainnet`, nastav `WARP_APTOS_BRIDGE_ACCOUNT` + `WARP_APTOS_RELAY_KEY`
13. **Sui** — `sui client publish --gas-budget 100000000`, nastav `WARP_SUI_PACKAGE` + `WARP_SUI_BRIDGE_PACKAGE` + `WARP_SUI_RELAY_KEY`
14. **NEAR** — `near deploy --accountId zion.near --wasmFile zion_token.wasm`, nastav `WARP_NEAR_BRIDGE_CONTRACT` + `WARP_NEAR_RELAY_KEY` + `WARP_NEAR_ACCOUNT`

### Po každém deploy
```bash
# 1. Nastav env vars v /root/.env.warp
# 2. Restart WARP
systemctl restart zion-v31-multichain
# 3. Ověř
curl http://127.0.0.1:8453/health
# 4. Ověř specifický chain adapter
curl http://127.0.0.1:8453/health/<chain>
```

## 9. Testnet Smoke-Test Log (2026-08-06)

Local `warpd` was started with a minimal `warp.test.toml` (`solana`, `stellar`, `bitcoin` enabled, `quorum = 1`).
All three adapters registered and polled their respective devnet/testnet endpoints without errors.

### Stellar testnet — ✅ execute_mint OK

| Položka | Hodnota |
|---------|---------|
| Issuer / bridge / relay (G...) | `GC4SGOGJWQGBSPJOM5M3RXVWLKWWAZIF4NNPVA4TTBWN36ZW6J7AMEDS` |
| Distribution test account | `GCSGJDBBDQVLNCEJGAUJ2SBZNCDL4G7HBVD6N2MT754LPZZIIF5TS3KV` |
| Asset code | `ZION` |
| Test mint amount | `0.001 ZION` (1,000 stroops) |
| Live mint TX (latest) | `2cbe550fe7730d2c06abf5ab58c290f95962e39a39c471c7c56881c51c68d34e` |
| Horizon | `https://horizon-testnet.stellar.org` |
| Setup script | `V31/L2/multichain/contracts/non-evm/stellar/setup_zion_asset.py` |

The Stellar adapter `execute_mint` test (`test_stellar_execute_mint_live_testnet`) passed and the distribution account received the test ZION payment. Private relay key is stored in the Edge environment file only.

### Solana devnet — 🟡 polling OK, mint not tested

| Položka | Hodnota |
|---------|---------|
| Relay public key | `4J2FRDrHFihJ3QdjF3eLAQ7tZDagyAsgVcKFDh7xdmr3` |
| Placeholder mint | `3XtfWPaLQTLrjTT6hhzo6WVZP73KmW2JpQnU8iaVwLEU` |
| RPC | `https://api.devnet.solana.com` |
| Status | Relay balance 0 lamports; `requestAirdrop` rate-limited (`429` faucet dry). `watch_events` polls with 0 BridgeBurn proofs. Live `mint_to` requires devnet SOL + real SPL mint deploy. |

### Bitcoin testnet — 🟡 polling OK, spend not tested

| Položka | Hodnota |
|---------|---------|
| Relay / HTLC watch address | `tb1qjkq5gmqp4rm2yj4zefjvw63p3mxle86leflq4z` |
| API | `https://mempool.space/testnet/api` |
| Status | Address has 0 UTXOs. `watch_events` polls with 0 HTLC deposits. Live `execute_mint` requires testnet BTC to fund the relay wallet and a real P2WSH HTLC script. |

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
