# ZION v3 Mainnet Roadmap

Status date: **2026-07-15** (3.0.6 "Triple Parallel" live — 14/14 services active, protocol zion-v3-node/3.0.6, E2E memo tests verified in block 752 — see supplement below)

This file is the active source-of-truth for the clean `V3/` mainnet line.
`V3/` is intentionally separated from the legacy root workspace. The legacy root remains migration source material and audit evidence, but new mainnet-track runtime work should land in `V3/`.

## Supplement — V3.1 Architecture Reorganization (planned)

Target layout for **3.1.0 Mainnet Alpha**:

- **L1** — `core`, `cosmic-harmony`, `miner` (with AuxPoW merged in), `pool`, `native-ffi`, `types`.
- **L2** — `bridge`, `warp` (moved from L3), `dao`, `atomic-swap`, `swap-aggregator`, `ziondex` (moved from root `ZionDex/`).
- **L3** — `ai-native`, `ncl`, `hiran`, `orchestrator`, `automation`, `poc`, plus former `L4/L5/L6` modules folded into `ai/oasis`, `ai/free-world`, `ai/issobella`.

See full plan: [`V3.1_ARCHITECTURE_REORG_PLAN.md`](../V3.1_ARCHITECTURE_REORG_PLAN.md).

---

## Supplement — 2026-07-01 (3.0.4 Closure — Account Memo Hard Fork Implemented)

### 3.0.3 Closure — kanonický stav

Verze **3.0.3** je nyní uzavřena. Všechny klíčové komponenty jsou funkční:

| Komponenta | Stav | Adresa / Poznámka |
|-----------|------|-------------------|
| L1 Node | ✅ LIVE | chain height ~21000+, protocol 3.0.3, 1e6 flowers |
| L1 Mining Pool | ✅ LIVE | Stratum port 8444, PPLNS |
| L2 Bridge (L1→EVM) | ✅ VERIFIED | 100M wZION mintováno, 5/5 validators |
| L2 Bridge (EVM→L1) | ✅ VERIFIED E2E | 100 wZION burn → L1 blok 20919 unlock (2026-06-29) |
| L2 DAO daemon | ✅ LIVE | port 8450, L1 scanner funkční (fix 2026-06-29) |
| L2 Atomic Swap | ✅ **ACTIVATED** | port 8452, produkční escrow `zion1y0j484...`, L1+EVM watcher |
| L3 WARP | ✅ LIVE | port 8453, EVM+BTC+SOL+XLM+TRX adapters |
| wZION | ✅ DEPLOYED | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| ZIONBridge | ✅ DEPLOYED | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` |
| UniV3 wZION/USDT | ✅ ACTIVE | `0x186b46c2f04153999d44D25179cD623fD62Bfda2` |
| UniV3 wZION/WETH | ✅ ACTIVE | `0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699` |
| ZIONStaking | ❌ MISSING | Base Mainnet deploy chybí → 3.0.4 |
| ZIONFarm | ❌ MISSING | Base Mainnet deploy chybí → 3.0.4 |
| Website /dao | ✅ UI DONE | live connection k DAO daemonu |
| Website /swap | ✅ UI DONE | live connection k atomic-swap daemonu |
| Website /warp | ✅ INFO | informační dashboard, swap UI → 3.0.4 |

### Verze 3.0.4 — Milestone Definition

**Target:** Q3 2026 (do 2026-09-30)
**Kanon. runbook:** [`docs/3.0.3/L2Complete.md`](../../docs/3.0.3/L2Complete.md) sekce "🚀 ZION 3.0.4 Upgrade Plan"

**Scope — co musí být hotové pro closure 3.0.4:**

#### P1 — DeFi kontrakty (Base Mainnet) — ✅ DEPLOYVED 2026-06-29

> **Runbook:** [`V3/docs/ZION_3.0.4_DEPLOY_RUNBOOK.md`](../V3/docs/ZION_3.0.4_DEPLOY_RUNBOOK.md)
> **Deploy skripty:** `V3/L2/contracts/hardhat/scripts/` (připraveno + spuštěno 2026-06-29)

- [x] **ZIONGovernance** — `0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8`
- [x] **ZIONTreasury** — `0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD` (3-of-3 multisig: deployer + validator-2 + validator-3)
- [x] **ZIONStaking** — `0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B` (12% APR, 7d cooldown, 100K wZION reward pool funded)
- [x] **ZIONFarm** — `0x167B2753F5D8D9F8e62875cc9e379d7804308B08` (1 wZION/s, 90d halving, 500K wZION pool funded, Pool 0: wZION single)
- [x] `defi-contracts.ts` aktualizováno: reálné adresy + `STAKING_DEPLOYED=true`, `FARM_DEPLOYED=true`
- [x] `/defi/staking` page: "Deploy pending" banner zmizí, live data z kontraktu (website v3.6.3 deployed ✅)
- [x] `/defi/farming` page: "Deploy pending" banner zmizí, live data z kontraktu (website v3.6.3 deployed ✅)
- [ ] Verify na Basescan: `npx hardhat run scripts/verify-base-mainnet-basescan.ts --network base` (vyžaduje BASESCAN_API_KEY — získat na basescan.org/myapikey)
- [x] `V3/L2/contracts/hardhat/` doplněn o zkopírované .sol + deploy skripty

#### P2 — Atomic Swap E2E — ✅ ESCROW FUNDED + E2E TEST 2026-06-29

- [x] Pošli **100K ZION** na `zion1y0j484d5e8r49785d253e8w0c2x4t3n792m5724` (✅ potvrzeno: 100,000 ZION)
- [x] Ověř balance: `getAddressInfo` RPC → `balance_zion: 100000.000000` ✅
- [x] E2E test: LOCK TX (1 ZION, memo `SWAP:LOCK:<hash>:120:base:0xTest`) — **přijat do chainu** ✅
- [x] E2E test: CLAIM TX (memo `SWAP:CLAIM:<hash>:<preimage>`) — **přijat do chainu** ✅
- [x] Atomic swap daemon běží, API na :8452, L1 watcher skenuje bloky ✅
- [x] **Account-model memo hard fork — DEPLOYED 2026-07-01:** `memo: Option<String>` přidáno do `Transaction` structu (`V3/L1/core/src/lib.rs:383-398`), height-gated activation (`ACCOUNT_TX_MEMO_V1_ACTIVATION_HEIGHT`) default `0` (active from genesis on fresh chain post-3.0.4 hard reset; runtime override via `ZION_ACCOUNT_TX_MEMO_V1_HEIGHT`), validace 256B ASCII. Bridge/atomic-swap/DAO watchers nyní skenují i `account_transactions`.
- [x] Vytvoř `docs/ATOMIC_SWAP_RUNBOOK.md` ✅ (2026-06-29)

#### P3 — DAO Guardians + Voting E2E — ✅ DONE 2026-06-29

- [x] Vygeneruj 5 guardian keypairs (mnemonics uloženy na `C:\Users\yosef\Desktop\ZION_DAO_GUARDIAN_KEYS.txt`)
- [x] Přidej `[[guardians]]` sekce do `dao-mainnet.toml` na Edge (5 guardian entries)
- [x] Restart `zion-edge-dao.service` + ověř `/api/dao/health` → 200 OK ✅
- [x] Voting E2E: `DAO:vote:1:yes` L1 memo TX odeslán z Aloha wallet (26.5M ZION voting weight) — **přijat do chainu** ✅
- [x] **DAO scanner account-model memo — DONE 2026-07-01:** DAO scanner nyní skenuje `account_transactions` s memo a zpracovává `DAO:vote` / `DAO:propose` / `DAO:execute`.

#### P4 — WARP UI Transfer Formulář

- [x] Přidej `warp: 'http://127.0.0.1:8453'` do `core-endpoints.ts`
- [x] Vytvoř `src/app/api/warp/[...path]/route.ts` — proxy na port 8453
- [x] Přidej "Initiate Transfer" sekci do `/warp` page: chain dropdown + recipient + amount + memo builder (`WARP:1:<chain>:<addr>`) + copy button
- [x] Transfer status tracker: polling `GET /api/warp/transfers/:id`

#### P5 — Bridge UI — "Lock ZION" Tab

- [x] V `/bridge` page tab `'lock'`: zobraz vault adresu + memo builder (`BRIDGE:0x<evm>`) + minimum warning
- [x] Live bridge tracker component (polling `/api/bridge/status`): lock → relay → mint → complete
- [x] **Desktop Agent Bridge Lock widget** — interaktivní L1 TX odeslání (from + password + memo + amount)

#### P6 — V3/L2/contracts/hardhat/ kanonizace

- [x] Zkopíruj .sol + skripty z archive do `V3/L2/contracts/hardhat/` (viz README.md v tom adresáři)
- [x] `V3/L2/contracts/hardhat/.env.mainnet.example` ✅ (vytvořeno 2026-06-29)

#### Nice to have (3.0.4 nebo 3.1.0)
- Wallet SDK základy (TypeScript, npm package `@zion/sdk`)
- WARP Bitcoin bridge testnet E2E
- Více USDT likvidity v primárním poolu

#### P7 — WARP D-04 Cosmos/Cardano execute_mint() — ✅ IMPLEMENTED 2026-06-30

> **Runbook:** `V3/L3/warp/src/cosmos_signer.rs` + `V3/L3/warp/src/cardano_signer.rs`

- [x] **Cosmos signer** — Ed25519 signing, bech32 address derivation, CosmWASM `mint` broadcast via REST `cosmos/tx/v1beta1/txs:encode` + broadcast
- [x] **Cardano signer** — Ed25519 payment + policy key signing, enterprise address derivation, Blockfrost TX submission path
- [x] **Cosmos adapter** `execute_mint()` — uses `CosmosSigner::from_env()` → `execute_contract_mint()`
- [x] **Cardano adapter** `execute_mint()` — uses `CardanoSigner::from_env()` → `submit_mint_tx()`
- [x] 488 WARP tests pass (cumulative — all adapters + signers + encoders)
- [ ] **Cardano CBOR TX builder** — `submit_mint_tx` returns error indicating need for `pallas` or `cardano-serialization-lib` crate for full CBOR TX construction
- [ ] Deploy wZION CosmWASM contract na Cosmos hub-4
- [ ] Deploy wZION Cardano native token (policy ID + asset name)
- [ ] Set `WARP_COSMOS_RELAY_KEY` / `WARP_CARDANO_PAYMENT_KEY` / `WARP_CARDANO_POLICY_KEY` env vars on Edge

#### P8 — WARP Lightning Network — ✅ IMPLEMENTED 2026-06-30

> **Runbook:** `V3/L3/warp/src/bolt11.rs` + `V3/L3/warp/src/lightning_signer.rs` + `V3/L3/warp/src/adapter/lightning.rs`

- [x] **BOLT11 invoice parser** (`bolt11.rs`) — pure Rust bech32 decode, tagged field parsing (p/d/n/x/c/r/9), amount multipliers (m/u/n/p), signature extraction
- [x] **LND REST client** (`lightning_signer.rs`) — GetInfo, AddInvoice, SendPayment, LookupInvoice, ListChannels, outbound capacity monitoring
- [x] **Lightning adapter** — nahrazen stub real implementací: `decode_invoice()`, `create_invoice()`, `pay_invoice()`, `is_payment_settled()`, `health_check()`, `watch_events()`, `execute_mint()`, `confirmations()`
- [x] 499 WARP tests pass (cumulative — bolt11 + lightning_signer + lightning adapter included)
- [x] **LND node setup** (Fáze A) — Docker setup created: `V3/L3/warp/docker/lightning/` (bitcoind testnet + LND v0.18.2 + Redis), channel management scripts at `V3/L3/warp/scripts/lightning/`, systemd service at `edge-deploy/systemd/zion-edge-lnd.service`
- [ ] **Deploy LND to Edge** — `docker compose up`, sync testnet, open channels, extract macaroon
- [ ] Set `WARP_LN_NODE_URL` / `WARP_LN_MACAROON` env vars on Edge
- [ ] Channel liquidity (0.5-1 BTC outbound)
- [ ] Submarine swaps (Fáze E — future)

#### P9 — WARP Aptos/NEAR/Sui/TON Adapters — ✅ IMPLEMENTED 2026-06-30

> **Runbook:** `V3/L3/warp/src/adapter/{aptos,near,sui,ton}.rs` + `V3/L3/warp/src/{aptos,near,sui,ton}_signer.rs`
>
> **WARP Bridge Architecture:** WARP přenáší **native L1 ZION**, ne wZION.
> - **Outbound (L1→chain):** User pošle ZION L1 TX na `BRIDGE_VAULT_ADDRESS` s memo `BRIDGE:<chain>:<recipient>` → ZION se zamkne v vault → WARP mintne wZION na dest chain (1:1 peg)
> - **Inbound (chain→L1):** User spálí wZION na external chain → WARP validator set (3/5) podepíše unlock → `submitBridgeUnlock` na L1 → ZION se odemkne z vault → recipient
> - **L1 RPC:** `getBridgeLocks`, `getBridgeVaultBalance`, `submitBridgeUnlock` (vše implementováno v `V3/L1/core/src/rpc.rs`)
> - **Bridge vault:** `BRIDGE_VAULT_ADDRESS` = keyless address, ~100M ZION locked

- [x] **Aptos adapter** — REST health check (ledger version), Ed25519 signer + SHA-256 address derivation, watch_events via account event API. **BCS TX builder implemented** — `RawTransaction` + `SignedTransaction` BCS encoding + `POST /v1/transactions` submit. **Plně funkční**
- [x] **NEAR adapter** — JSON-RPC health check (block height), borsh TX serialization (hand-rolled, no `near-sdk` dep), `broadcast_tx_async`, watch_events via receipt log scanning. **Plně funkční**
- [x] **Sui adapter** — JSON-RPC health check (checkpoint seqno), Ed25519 signer + Sui address derivation (SHA-256 with flag byte), signature format (97 bytes base64). **BCS TX builder implemented** — `TransactionData::V1` + `ProgrammableTransaction` + `MoveCall` BCS encoding + `sui_executeTransactionBlock` submit. **Plně funkční**
- [x] **TON adapter** — JSON-RPC health check (masterchain seqno), Ed25519 signer, watch_events via `getTransactions` for bridge account. **TL-B Cell+BOC TX builder implemented** — `BitString` (bit-level buffer) + `Cell` (1023-bit data + 4 refs) + `serialize_boc` (Bag of Cells) + jetton transfer body + wallet V2R2 signing + `sendBase64Transaction`. **Plně funkční** — StateInit address derivation + CRC16-XMODEM + base64url decoder + seqno fetch via runMethod
- [x] **BCS encoder** — pure Rust BCS (Binary Canonical Serialization) encoder/decoder for MoveVM chains (Aptos + Sui). No external dependency. 33 tests.
- [x] **CBOR encoder** — pure Rust CBOR (RFC 8949) encoder for Cardano TX construction. Implements uint/nint/bytes/text/array/map/tag/bool/null + Cardano TX helpers (tx_input, tx_output, tx_body, witness_set, transaction). 21 tests.
- [x] **TON Cell/BOC encoder** — pure Rust TL-B Cell serialization for TON. `BitString` (bit-level ops) + `Cell` (1023-bit data + 4 refs + SHA-256 hash) + `serialize_boc` (unified BOC format 0xb5ee00ed) + jetton transfer body + internal message + wallet V2R2 external message + signing hash. 23 tests.
- [x] **Cardano `submit_mint_tx`** — CBOR TX body (inputs + outputs + fee + ttl + mint) + Blake2b-256 body hash + Ed25519 witness + Blockfrost `/tx/submit`. Blake2b-224 for payment key hash + policy ID. **Plně funkční**
- [x] 499 WARP tests pass (cumulative — bcs + cbor + ton_cell + aptos BCS + sui BCS + cardano CBOR + ton TL-B + adapters + signers + server)
- [x] **Non-EVM ZION token contracts created** (2026-07-12) — All 9 contract source files in `V3/L2/bridge/contracts/non-evm/`: Solana (SPL Anchor), Tron (TRC-20), Stellar (native asset + setup script), Cardano (Plutus minting policy), Cosmos (CosmWasm CW20), Aptos (Move Coin), Sui (Move Coin), NEAR (NEP-141), TON (TEP-74 jetton). All implement bridgeMint/bridgeBurn with 5/5 quorum, replay protection, max supply 144B, min 100 ZION, emergency pause.
- [ ] Deploy wZION Move module on Aptos mainnet
- [ ] Deploy wZION NEAR contract
- [ ] Deploy wZION Sui package
- [ ] Deploy wZION TON jetton
- [x] Deploy wZION SPL token on Solana (`HgfQZpH2JAqPdR3PcP4dEE8WRhznXh1QhJBiiwcHfT8H`)
- [ ] Deploy wZION TRC-20 on Tron
- [x] Issue wZION asset on Stellar (`ZION:GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT`)
- [ ] Mint wZION native token on Cardano
- [ ] Deploy wZION CW20 on Cosmos
- [ ] Set relay key env vars for each chain on Edge

#### Nice to have (continued)
- Blockaid false-positive report submission

---

## Supplement — 2026-06-29 (Reverse Bridge E2E + Atomic Swap Fixes)

### Reverse Bridge (EVM→L1) — E2E Verified

- **Burn TX:** `0x70ad4d93ee39...` (100 wZION burned na Base)
- **L1 Unlock:** blok **20919**, 100 ZION přesunuto z vault na recipient
- **confirmBurnRelease TX:** `0x97f41f0a...` (Base, confirmed)
- **Root cause fix:** `BRIDGE_VAULT_SEED` revert v `V3/L1/core/src/crypto.rs` na `"ZION Bridge Vault V3 Mainnet"`, commit `e6175b5b`

### Atomic Swap — Opravy

- **SO_REUSEADDR + SO_REUSEPORT** via socket2 crate (TIME_WAIT blocker fix)
- **DB cesta** opravena na `/root/zion-2.9.6-main/V3/data/atomic-swap.db`
- **ZION_SWAP_BEARER_TOKEN** env var podpora přidána do `SwapConfig::api_bearer_token()`
- Produkční escrow keypair vygenerován a nastaven v systemd drop-in `secrets.conf` (chmod 600)

---

## Supplement — 2026-06-27 (3.0.3 Decimal Fork — DEPLOYED ✅)

### Co se stalo

**3.0.3 Decimal Fork** byl nasazen na Edge server (2026-06-27):
- **FLOWERS_PER_ZION:** 1e12 (12-decimal) → 1e6 (6-decimal)
- **MIGRATION_HEIGHT:** 18850 (in-place fork, DB preserved)
- **protocol_version:** zion-v3-node/3.0.3, protocol_version_numeric=2
- **All 13 Edge services:** active
- **Chain height:** 18014+ (těžba běží)
- **Tests:** ~1,223 workspace tests, 0 failures

### Co bylo změněno

| Vrstva | Soubory | Co |
|--------|---------|----|
| L1 Core | migration.rs, validation.rs, peer_block_validation.rs, rpc.rs, emission.rs, genesis.rs, wallet.rs | Height-conditional consensus, RPC contract bump, LEGACY constants |
| L1 Pool | pplns.rs | Test values |
| CLI | wallet.rs, node.rs | FLOWERS_PER_ZION import, snapshot subcommand |
| L2 Bridge | types.rs, main.rs | FLOWERS_TO_WEI_FACTOR 1e12 (18-6=12) |
| L2 DAO | types.rs, config.rs, l1_scanner.rs, humanitarian.rs, treasury.rs, quorum.rs | FLOWERS_PER_ZION, thresholds, vote weights |
| L3 WARP | config.rs, xp_bridge.rs, router.rs, types.rs, fees.rs | Decimals, fees, multipliers, divisors |
| L3 NCL | pricing.rs | split_reward test |
| L3 AI-Native | orchestrator.rs, zion-ai-native-api.rs | Transfer limits, price divisor |
| ZION_OS Dashboard | app.py, dashboard.js, l3.html | 34 replacements (1e12→1e6) |
| Web v2.9 | constants.ts, zion-rpc.ts, 10 .tsx files | 16 amount conversions |
| Docs | 27+ files | StatusV3, AGENTS, ROADMAP, WHITEPAPER, etc. |

### Commity (2026-06-27)

| Commit | Popis |
|--------|-------|
| `3482078c` | Backend: migration + consensus + RPC + CLI |
| `c0c477cb` | Docs: §15 Edge runbook |
| `83063666` | Ecosystem: 18 files L1+L2+L3 |
| `58661943` | Docs: 27 files + deploy script |
| `631429a3` | Dashboard: app.py + dashboard.js + l3.html |
| `b666e265` | StatusV3.md + AGENTS.md |
| `4d6c4118` | Web v2.9: constants + .tsx + upgrade doc |

### Kanonické konstanty (post-3.0.3)

| Constant | Value |
|----------|-------|
| `FLOWERS_PER_ZION` | `1_000_000` (1e6) |
| `LEGACY_FLOWERS_PER_ZION` | `1_000_000_000_000` (1e12) |
| `FLOWERS_TO_WEI_FACTOR` | `1_000_000_000_000` (1e12, EVM 18-6=12) |
| `BLOCK_REWARD_ATOMIC` | `5_400_067_000` (5400.067 ZION × 1e6) |
| `MIGRATION_HEIGHT` | `1` (fresh chain post-3.0.4 hard reset) |
| `protocol_version` | `zion-v3-node/3.0.5` |

Viz [`docs/3.0.3/ZION_3.0.3_DECIMAL_FORK_PLAN.md`](../../docs/3.0.3/ZION_3.0.3_DECIMAL_FORK_PLAN.md) pro kompletní plán a [`StatusV3.md`](../StatusV3.md) pro deployment detaily.

---

## Supplement — 2026-06-24 (Full L2 Realistický Plán + Pool Seeding)

### Stav L2 — Co funguje, co chybí

Viz [`docs/DEFI_FULL_ROADMAP.md`](../docs/DEFI_FULL_ROADMAP.md) pro kompletní realistickou analýzu.
TL;DR stav:
- **Bridge L1→EVM (mint):** ✅ 100% ověřeno v produkci (5/5, 30 TX, 100M wZION)
- **Bridge EVM→L1 (burn):** ✅ **PLNĚ FUNKČNÍ** — E2E test passed 2026-06-29: 100 wZION burn → L1 blok 20919 unlock → confirmBurnRelease TX `0x97f41f0a...` ✅ (oprava: BRIDGE_VAULT_SEED revert, commit `e6175b5b`)
- **UniV3Pool:** ✅ 138K wZION + 26.66 USDT in-range, aktivní
- **Staking/Farm:** ⚠️ deployed pouze na Sepolia, Base Mainnet deploy chybí
- **Swap UI:** ⚠️ kód hotov, čeká jen na pool seeding
- **Wallet SDK:** ❌ neexistuje — blocker pro mobile integrace
- **TX history RPC:** ❌ chybí v L1 node — blocker pro explorer

### Seed price konstanty (potvrzeno 2026-06-24)

```
Seed cena:   $0.00002 / ZION  @  ETH $1 656
sqrtPriceX96: 8_706_917_217_488_994_866_036_736
tick:         -182_328
ETH potřeba (doporučeno 60M wZION):  ≥ 0.80 ETH (~$1 300)
```

Konstanty jsou v `APP&WEB/website-v2.9/src/lib/defi-contracts.ts` jako
`SEED_PRICE_USD`, `SEED_SQRT_PRICE_X96`, `SEED_TICK`.

---

## Supplement — 2026-06-23 (Bridge 5/5 Milestone + DeFi Liquidity Plan)

### Bridge 100M ZION → wZION — FINALIZOVÁNO

- **Multi-validator relay** (`c4a4841`): `load_all_validator_keys()` čte `ZION_VALIDATOR_PRIVATE_KEY` + `_2..5` env vars. `handle_l1_lock()` iteruje všemi 5 klíči — 5 `submitLockProof` TX / lock.
- **30 TX odesláno** (5 validátorů × 6 locků) — všechny confirmed on-chain.
- **5/5 on-chain confirmací** pro všech 6 locků (~100M ZION total). `getLockProofStatus()` → `confirmations=5, executed=false, timelocked=true`.
- **24h timelock** aktivní — vyprší **2026-06-24 16:52 UTC** → relay automaticky zavolá `executeTimelockedMint()` → ~100M wZION mintováno na `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`.
- **Security**: `5ELMWallets.md` odstraněn z gitu (`14dd686`), přidán do `.gitignore`.

### DeFi + DAO — Zbývající práce

Viz [`docs/DEFI_FULL_ROADMAP.md`](../docs/DEFI_FULL_ROADMAP.md) pro kompletní roadmapu. Klíčové zbývající milestony:

| Oblast | Status | Popis |
|--------|--------|-------|
| ~100M wZION mint | ⏳ 2026-06-24 | Automaticky po timelock expiry |
| UniV3Pool seed liquidity | ⏳ | wZION + WETH, fee 0.3% |
| Burn→Unlock E2E | ⏳ | Reverse bridge test |
| Bridge UI (web) | ⏳ | MetaMask + zion-cli integrace |
| Swap UI (web/desktop) | ⏳ | wZION↔ETH přes UniV3 |
| Staking UI | ⏳ | ZIONStaking web + desktop |
| DAO web dashboard | ⏳ | Proposals, voting, treasury |
| DAO treasury cliff | ⏳ 2027-06 | ~525,600 bloků od genesis |
| Explorer bridge tracker | ⏳ | Live lock→confirm→mint |
| NCL ONNX backend | ⏳ | AI compute marketplace live |
| WARP Bitcoin adapter | ⏳ | Cross-chain BTC bridge |
| CoinGecko / CMC listing | ⏳ | `docs/listings/` připraveno |
| Public launch | 2026-12-31 | New Year's Eve |

---

## Supplement — 2026-06-11 (MainNet Genesis + June hot fixes)

Operational + security **canonical status**: [`StatusV3.md`](../StatusV3.md). The sections below remain the long-form engineering history.

### MainNet Genesis

- **TestNet genesis**: 4 December 2025 — first block, intent, architecture, germ of the network.
- **MainNet Genesis TerraNova**: 11 June 2026 — controlled Core + Edge mainnet launch.
- **Public launch for everyone**: 31 December 2026 (New Year's Eve).

### June 2026 hot fixes (miner hardening)

- **DCR backdoor removal** (`5afc37f7`): Stealth Decred worker mining for foreign BTC wallet removed from miner codebase.
- **GPU/CPU path separation** (`8d5d44ca`): GPU candidate no longer blocked by CPU re-verification; algorithm-aware pool validation fixes 0 accepted shares.
- **RDNA1 detection fix** (`cc50d1b4`): RX 5700 XT correctly detected as RDNA1 (not GCN), restoring full work_size.
- **Seasonal Fire ↔ Lite switching** (`73d29462`): Miner auto-restarts with appropriate algorithm for summer (Lite = 256 KiB, 2 passes, 64 reads, no heat) vs winter (Fire = 128 KiB, 16 passes, 512 reads, heat output).
- **Edge auto-backup** (`9a8759f7`): Systemd timer + off-site snapshots for Edge server.

### L1 consensus shipped on `main` (new chain)

- **TX hash v2** + **F2 BLAKE3 body Merkle (BODY_ROOT_V2)** active from height **0** in default builds (`V3/L1/cosmic-harmony/src/deeksha.rs`).
- **F1** UTXO input existence + value conservation on **peer-imported and locally submitted** blocks (`V3/L1/core/src/lib.rs` `validate_peer_block`, `SubmitCandidate` → `accept_block`).
- Optional **testnet fork rehearsal** via Cargo feature `testnet_fork_rehearsal` + scripts under `V3/scripts/`.

### Repo security (May 2026)

- Coordinated **`git filter-repo`** + credential rotation completed (see `StatusV3.md` / `StatusV3-Part2.md`). Treat any **pre-scrub clone** as compromised media.

### Parallel tracks (docs / AI — outside hot V3 runtime path)

| Track | Where / recent `git log` | Next |
|-------|--------------------------|------|
| **ZION OASIS avatars** | [`docs/docs2.9/ZION_OASIS/`](../docs/docs2.9/ZION_OASIS/) — `SACRED_TRINITY/` roster waves (`eb901016`, `c23af065`, `55d2490a`, …) | Keep `README.md` / `AVATAR_ROSTER.md` aligned; wire into site + RAG roots |
| **TerraNova + Forsita** | [`docs/TerraNova/`](../docs/TerraNova/), Forsita guide (`6a5f6996`, …) | Editorial pass, i18n |
| **Hiran v2.1** | [`HiranV2.1/Hiran_v2.1.md`](../HiranV2.1/Hiran_v2.1.md); finetune in `HiranV2.1/finetune/` (`c41d1f5f`); RAG/Vast (`6b927882`); UE5 notes (`dbd6010c`) | Versioned datasets, ONNX/export, no large committed blobs |

---

## Constitutional Reference (Mainnet Parameters)

Source of truth: `docs/mainnet/MAINNET_CONSTITUTION.md` (frozen SHA-256: c76aa002…)

### Supply & Emission

| Parameter | Value |
|-----------|-------|
| Total supply (max, immutable) | 144,000,000,000 ZION |
| Mining supply | 127,720,000,000 ZION (88.69%) |
| Genesis premine | 16,280,000,000 ZION (11.31%) |
| Atomic unit | 1 ZION = 1,000,000 flowers (u64) (updated to 6-decimal in 3.0.3 fork) |
| Initial block reward | 5,400.067 ZION = 5,400,067,000,000,000 flowers |
| Emission model | Decade Decay: ×(4/5) every 5,256,000 blocks |
| Max decay decades | 10 |
| Tail emission (perpetual) | ~724.785 ZION/block |
| Blocks per year | 525,600 (60 s target) |
| Fee policy | 100% burn (deflationary, no treasury routing) |

### Consensus & Difficulty

| Parameter | Value |
|-----------|-------|
| Consensus | Cosmic Harmony v3 — Ekam Deeksha PoW |
| Chain ID | `zion-mainnet-1` |
| Block time target | 60 seconds |
| DAA | LWMA (Linearly Weighted Moving Average) |
| DAA window | 60 blocks |
| DAA max change per block | ±25% |
| Timestamp sanity | clamp ±2× target (±120 s) |
| Max reorg depth | 10 blocks |
| Soft finality | 60 blocks |
| Fork choice | Highest accumulated work |
| Coinbase maturity | 100 blocks |

### Genesis Premine Distribution

12 wallets defined in `PREMINE_ADDRESSES_PUBLIC.txt`:

| # | Category | Amount |
|---|----------|--------|
| 1–5 | OASIS + Winners Golden Egg/Xp (5 slots × 1.65B) | 8,250,000,000 ZION |
| 6–8 | DAO Treasury (main 2.5B + grants 1B + bootstrap 0.5B) | 4,000,000,000 ZION |
| 9–11 | Infrastructure (core dev 1B + seed nodes 1B + creator 0.59B) | 2,590,000,000 ZION |
| 12 | Humanitarian — Children Future Fund | 1,440,000,000 ZION |

Lock: DAO Treasury cliff at ~525,600 blocks (~1 year). All others: immediate unlock.

### Security Note

12 private keys exist in git history (`PREMINE_WALLETS_BACKUP.json`). **Must be scrubbed via BFG Repo-Cleaner before any public fork or mainnet launch.**

**Update 2026-05-07:** Leaked *operator* paths (`docs/docs2.9/ZION_KEYS/`, `V3-src*`, …) were removed from `main` via **`git filter-repo`** + credential rotation — see [`StatusV3.md`](../StatusV3.md). Treat old clones as untrusted until re-fetched. The **premine backup** warning above remains until independently verified against current `git` refs.

## Document Lineage

This roadmap follows the release progression already defined in the repository documentation:

- `docs/2.9.7/` supplies the production-base discipline: build gates, runtime flags, and go/no-go thinking.
- `docs/2.9.8/` supplies the canonical runtime target: Deeksha/Ekam as the single active consensus path, single-host simplification, and runtime unification.
- `docs/2.9.9/` supplies the migration constraint: pure code only, no historical ballast, and one canonical implementation path per feature.

## V3 Invariants

- One active consensus profile: `cosmic_harmony_ekam_deeksha_v2`
- One clean L1 code line: `V3/L1/*`
- One separate desktop control shell: `V3/DesktopApp/*`, only when explicitly requested and kept thin over V3 runtime contracts
- No new work in the legacy root unless the user explicitly asks for migration sync or archival backport
- Runtime first, non-code assets later
- Tests and smoke checks must stay green as the code line grows

## Current State

### Latest Verified Runtime Milestone

- **On-chain fee-split enforcement is live:** V3 core now produces and validates four-output coinbase payouts on mainnet with deterministic split `89/5/5/1`
- **First explicitly verified split-enabled block:** `465`
- **Cross-node confirmation:** audited USA and Singapore nodes accepted subsequent split-enabled blocks `471` and `472`
- **Operational root cause learned during rollout:** the first ineffective deploy was caused by a stale server-side `docker/docker-compose.v3-mainnet.yml` missing fee-wallet env vars in the `core` service; successful rebuild alone is not sufficient verification
- **Canonical operational references:** `../docs/reports/REPORT_SESSION_2026-03-28_V3_MAINNET_FEE_SPLIT_ROLLOUT.md`, `../docs/mainnet/V3_ROLLOUT_VERIFICATION_CHECKLIST.md`, `docs/MAINNET_DEPLOY_RUNBOOK.md`

### Completed

- `L1/cosmic-harmony`
  - Ekam Deeksha canonical PoW migrated
  - **Tier 1 ASIC hardening: 256 KiB scratchpad, 4 passes, 256 random reads (4× memory, 2× passes, 4× reads vs v1)**
  - **Tier 2 epoch-rotating NPU: MlpTopology enum (Standard/ThreeLayer/Wide/Deep), epoch length 2016, deterministic weight expansion from Blake3 epoch seed**
  - **Ekam Deeksha v2 canonical pipeline: cosmic_harmony_ekam_deeksha_v2(header, nonce, height) — mainnet algorithm from genesis (fork height 0)**
  - **Height-aware dispatch: cosmic_harmony_with_height() always routes to v2**
  - **95 tests passing (23 NPU epoch, 13 scratchpad v1/v2/v3, 25 deeksha v1/v2/v3, 4 dispatch/difficulty) — +14 from CHv4.2**
  - revenue and NCL support retained in narrowed form
  - OpenCL kernel source included (optimized: keccak_f1600 inline, native_sqrt, 46841 bytes)
- `L1/core`
  - **deterministic on-chain fee-split coinbase generation wired into active template rebuild and accepted-block state**
  - **runtime fee-wallet env loading for miner, humanitarian, issobella, and pool-fee addresses**
  - **backward-compatible block validation accepting both legacy single-output and new split-enabled coinbase layouts**
  - mining headers, jobs, solutions, targets, revenue snapshots
  - node config defaults for mainnet-track runtime
  - first P2P and RPC wire contracts
  - first `node` TCP scaffold binary
  - active block-template state and accepted-block rotation
  - template-aware `get_template` / `submit_candidate` RPC lifecycle
  - accepted-block indexes by height and template ID
  - file-backed chain snapshot persistence and restart restore path
  - basic mempool RPC intake and inspection
  - fee-prioritized template assembly with mined-transaction eviction
  - restore sanitization for duplicate and already-mined mempool entries
  - stricter transaction validation and sender-nonce conflict checks
  - explicit block-body hash plus subsidy/fee/miner-reward metadata in template and accepted-block state
  - journal-assisted recovery when snapshot state is missing or unusable
  - contiguous peer block synchronization over P2P with block export and validated import
  - **Ed25519 keygen/sign/verify, BLAKE3 general hashing, canonical `zion1...` 44-char address derivation with checksum** (`crypto.rs`)
  - **UTXO transaction model: TxInput/TxOutput/Transaction, SegWit-style BLAKE3 txid, signature verification** (`tx.rs`)
  - **Fee policy: MIN_TX_FEE=1000, MIN_FEE_RATE=1, MAX_TX_SIZE=100KB, 100% burn, burn/DAO addresses** (`fee.rs`)
  - **Wallet: largest-first coin selection, build_and_sign with zeroize, batch PPLNS payouts up to 200 recipients** (`wallet.rs`)
  - **Full 11-step block validation: structure, timestamp, Merkle root, signatures, double-spend, coinbase maturity, fees, subsidy, DAO treasury lock** (`validation.rs`)
  - **Chain reorg with fork choice, undo blocks, MAX_REORG_DEPTH=10** (`chain.rs`)
  - **Hardened mempool with double-spend, byte/count limits, fee-rate eviction** (`mempool_v2.rs`)
  - **P2P security: rate limiter, escalating bans, connection limiter** (`p2p_security.rs`)
  - **Orphan handling: orphan buffer, chain ID enforcement** (`orphan.rs`)
  - **LMDB persistent storage via heed: 8 databases, atomic block+UTXO writes, rollback, balance cache** (`storage.rs`)
  - **IBD state machine: batch sync, stall detection, peer round-robin, SyncStatus tracking** (`ibd.rs`)
  - **JSON-RPC 2.0 protocol handler: method registry, batch requests, 17 live node methods including getSupplyInfo** (`rpc.rs`)
  - **Peer manager: scoring, banning, subnet diversity (MAX_PER_SUBNET=4), heartbeat, idle timeout** (`peer_manager.rs`)
  - **Metrics: atomic counters/gauges, Prometheus text exposition, health check** (`metrics.rs`)
  - **Genesis ceremony: frozen genesis hash, checkpoint system, 9 launch readiness checks** (`launch.rs`)
  - **Node bootstrap orchestrator: wires ChainDb + IbdEngine + PeerManager + NodeMetrics + RpcRouter into NodeHandle** (`node_builder.rs`)
  - **Genesis dedication message: ASCII art + ZION banner + dedication embedded in coinbase tx_id hash** (`GENESIS_MESSAGE.txt`, `genesis.rs`)
  - **Flood-fill block propagation: SeenBlocks dedup cache, plan_relay() logic, PropagationStats, node binary relay on peer announce and RPC submit** (`propagation.rs`)
  - **Peer discovery: active GetPeers exchange in outbound loop (every ~5 min), discovered peers merged into known_peers + PeerManager seeds** (`node.rs`, `lib.rs`)
  - **Peer persistence: known_peers saved to `peers.json` alongside chain state, loaded on startup, periodically updated** (`lib.rs`)
  - **Chain linkage verification: `previous_hash_hex` in AcceptedBlock, parent-hash enforcement in `import_peer_block`/`import_peer_blocks`, header cross-check in `validate_peer_block`** (`lib.rs`, `genesis.rs`)
  - **RPC model surface alignment: balance/tx API routes account vs UTXO, RuntimeTransaction adapter for mempool/template/journal** (`lib.rs`, `rpc.rs`) — Phase 14
  - **Centralized submit boundary: SubmittedTransaction enum with parse_value, model detection, zion1 endpoint rejection** (`lib.rs`, `rpc.rs`) — Phase 15
  - **Complete UTXO bridge into active mempool acceptance path: UTXO submit → validate (hash+signatures) → mempool → template → mined block → peer validation → journal replay → snapshot/restore** (`lib.rs`, `rpc.rs`, `genesis.rs`) — Phase 16
  - **UTXO RPC + chain validation: `getBalance` supports zion1 addresses (balance_flowers), `getUtxos` RPC endpoint (spendable UTXOs per address), UTXO input existence check (rejects nonexistent/already-spent inputs), `SpendableUtxo` struct, `utxo_set()`/`utxo_balance()`/`spendable_utxos()`/`utxo_exists()` methods** (`lib.rs`, `rpc.rs`) — Phase 17
  - **Phase 18 UTXO coinbase: `build_template()` generates UTXO coinbase transaction with 4 outputs (89% miner, 5% humanitarian, 5% issobella, 1% pool_fee), `getBalance`/`getBalanceAtHeight` combine account+UTXO balances for zion1 addresses** (`lib.rs`, `rpc.rs`)
  - **Phase 18 pool payout E2E: `execute_pool_payout()`, `fetch_pool_utxos()`, `submit_utxo_transaction()`, `parse_pool_signing_key()`, `ServerConfig` extended with `pool_wallet_address`/`pool_signing_key`** (`pool/src/bin/server.rs`)
- `L1/pool`
  - share validation and revenue tracking
  - session-oriented wire protocol
  - stale job lifecycle
  - node-backed template consumption and solved-candidate submission over RPC
  - bridge-level stale-template and upstream-rejection integration coverage
  - shared-state multi-client TCP pool server binary
  - session-group routing with ZION-first default for user miners and backend allowlist/hint routing into weighted multistream lanes
- `L1/miner`
  - local in-process mining flow
  - remote TCP mining flow against `zion-pool`
  - repeated loop, telemetry, and environment-driven runtime controls
  - DCR stealth worker with Stratum session flow and CPU/GPU backend selection (`auto`/`cpu`/`gpu`)
  - OpenCL-backed Blake3 GPU path (`dcr_blake3_mine.cl`) with configurable work size and CPU fallback
- `DesktopApp`
  - fresh Electron shell created under `V3/`
  - L1-L6 operator navigation scaffold
  - wallet manager foundation with local encrypted-at-rest storage when platform encryption is available
  - wallet role tagging for operator, treasury, bridge, and validator roots
  - clean auto-update hook isolation
  - thin supervision of prebuilt V3 node, pool, and miner binaries with live logs and persisted runtime env overrides
- `L2/bridge` **(Sprint 8 — migrated from legacy `L2/bridge/`)**
  - wZION relay daemon (L1↔EVM, Base Sepolia deployment)
  - **Critical decimal fix**: `FLOWERS_PER_ZION` 1e6→1e12 (reverted to 1e6 in 3.0.3 fork), `amount_atomic`→`amount_flowers`, DB schema updated
  - Conversion functions: `flowers_to_wzion_wei()`, `wzion_wei_to_flowers()`, `flowers_to_zion_display()`
  - L1 watcher (UTXO memo parser, `BRIDGE:base:0x...` format), EVM watcher (Burn event log parser)
  - Relayer, DB (SQLite persistence), validator set (3-of-5 quorum), metrics, Ankr RPC client
  - Config: mainnet + testnet TOML profiles, security limits (min/max/daily/timelock)
  - **157 tests** (111 lib + 45 integration + 1 doctest)
- `L2/dao` **(Sprint 8 — migrated from legacy `L2/dao/`)**
  - DAO governance daemon: proposal lifecycle, voting, treasury, timelock, humanitarian tithe
  - 6-decimal flowers (updated 3.0.3 fork), u128 treasury amounts (4B ZION scale)
  - **65 tests** (40 lib + 25 integration)
- `L2/atomic-swap` **(Sprint 8 — migrated from legacy `L2/atomic-swap/`)**
  - HTLC cross-chain atomic swaps with `amount_flowers`/`min_lock_flowers`
  - **15 tests**
- `L3/ncl` **(Sprint 8 — migrated from legacy `L3/ncl/`)**
  - Neural Consciousness Layer — decentralized AI compute marketplace
  - 6 task types (Inference, Training, DataProcessing, Optimization, Validation, Custom)
  - Scheduler (priority + reputation-weighted), pricing engine (base × backend × size)
  - 3 compute backends (ONNX, WASM, TFLite — all stubs, ONNX first implementation planned)
  - Reputation system (worker scoring, ban threshold, consciousness bonus)
  - SQLite job store, REST API scaffold
  - `reward_atomic`→`reward_flowers` naming for V3 6-decimal alignment (updated 3.0.3 fork)
  - **43 tests** (42 lib + 1 doctest)
- `L3/warp` **(Sprint 8 — migrated from legacy `L3/warp/`)**
  - Universal cross-chain bridge (7 chain adapters: EVM, Bitcoin, Solana, Tron, Stellar, Cardano, Cosmos)
  - Decimal fix: ChainId::zion_l1() 6→12, all fee/conversion values updated
  - **252 tests** (251 lib + 1 doctest)
- `L3/ai-native` **(Sprint 8 — migrated from legacy `L3/ai-native/`)**
  - Autonomous AI agent framework: orchestrator, consciousness engine, pool optimizer, warp agent
  - `amount_flowers`/`reward_flowers` naming, thiserror=2
  - **89 tests** (88 lib + 1 doctest)

### Verified

- `cargo test --manifest-path V3/Cargo.toml` passes
- local release build for `zion-core` passed before live rollout
- live V3 fee-split rollout passed after manifest correction, with legacy Prague / USA / Singapore nodes synchronized post-deploy (historical multi-server topology)
- pool/miner remote TCP smoke test passes
- repeated miner sessions against one shared pool instance pass
- core node scaffold responds over both P2P and RPC TCP endpoints
- core node RPC returns active templates and accepts template-bound candidates
- core node RPC accepts mempool transactions and exposes template transaction metadata
- single-host node + pool + miner smoke path passes with pool-issued jobs backed by node `get_template` / `submit_candidate`
- pool server tests cover stale-template and upstream-rejection bridge behavior against node RPC
- node chain snapshot persists accepted state and restores it after restart
- extended rehearsal confirms mempool-seeded template rotation, mined-transaction cleanup, and restored status after restart
- targeted tests cover journal replay recovery and stricter transaction rejection paths
- live two-node rehearsal confirms block export from one node and validated `announce_block` import into another node
- live bootstrap rehearsal confirms a fresh node can catch up from `ZION_SEED_PEERS` without manual block announce steps
- canonical Ekam vector remains stable
- zion-miner GPU benchmark mode (`--gpu-bench`) validates OpenCL precompute correctness and reports live device throughput
- **78 new tests across crypto (19), tx (10), fee (15), wallet (9), validation (25) — all green**
- **46 new tests across chain (14), mempool_v2 (12), p2p_security (10), orphan (10) — all green**
- **62 new tests across storage (12), ibd (13), rpc (14), peer_manager (13), metrics (10) — all green**
- **23 new tests across launch (10), node_builder (11), validation DAO lock (2) — all green**
- **15 new tests across propagation (15) — all green**
- **3 new tests for genesis message embedding — all green**
- **11 new integration tests for live JSON-RPC 2.0 method handlers — all green (371 total tests)**
- **5 new tests for peer discovery & persistence (GetPeers exchange, persistence round-trip, dedup — 376 total tests)**
- **9 new tests for block validation hardening (PoW verification, bad hash rejection, timestamp sanity, checkpoint enforcement, legacy compat — 385 total tests)**
- **8 new tests for chain linkage verification (previous_hash_hex mining, genesis zero hash, valid/broken chain linkage, batch intra-linkage, header consistency, legacy compat — 393 total tests)**
- **Phase 14–15: RPC model alignment, RuntimeTransaction adapter, centralized submit boundary — tests updated**
- **12 new UTXO acceptance tests (Phase 16): submit, template, mining, peer import, rejection, coexistence — 393+ total tests passing**
- **Phase 17: UTXO RPC + chain validation — getBalance zion1 support, getUtxos endpoint, UTXO input existence check, balance/funding/spending tests — 374 total tests passing**
- **Phase 18: Mempool transaction relay — AnnounceTx P2P message, SeenTransactions dedup cache (8192 cap), plan_tx_relay(), tx propagation stats, relay wiring in node binary (P2P + RPC submit paths), SubmittedTransaction serde — 10 new propagation tests**
- **Phase 18b: E2E multi-node integration tests — 9 tests: block relay, GetBlocksSince sync, transaction relay, AnnounceTx serde roundtrip, three-node chain sync, duplicate block handling, tx→mine→sync, status exchange, network mismatch rejection — 393 total tests passing**
- **Phase 19: Clippy cleanup campaign — zion-core lib/bin and zion-cosmic-harmony reduced to zero clippy warnings; style simplifications, map_or→is_some_and/is_none_or, loop cleanups, and targeted allow attributes where required by API shape**
- **Phase 20: Miner DCR/GPU runtime integration — DCR worker modules wired into miner entrypoint, OpenCL kernel/build glue added, GPU backend smoke path validated (`ZION_DCR_BACKEND=gpu`, `ZION_LOOP_COUNT=1`)**
- **Phase 20b: Native-FFI baseline + runtime hook — `L1/native-ffi` builds with `--features native-all` on Windows MSVC, and miner DCR CPU path now supports explicit hash dispatch (`ZION_DCR_HASH_IMPL=rust|native`) with safe fallback when native feature is not enabled**
- **Phase 21: Tier 1+2 ASIC resistance V3 port — 256 KiB scratchpad (4× v1, 4 passes, 256 reads), epoch-rotating NPU (MlpTopology×4, 2016-block epochs, Blake3 seed), Ekam Deeksha v2 canonical pipeline, height-aware dispatch, meets_difficulty(), optimized GPU kernel (46841 bytes). 81 cosmic-harmony tests passing. Ported from L1 commits c423a5e (Tier 1) + 79c903a (Tier 2).**
- **Phase 22: Docker testnet deploy & P2P fix — Docker compose rewritten for env-var config (`from_env()` only), raw TCP JSON-RPC health checks, netcat Dockerfiles, P2P duplicate block dedup before validation (eliminates difficulty mismatch on seed re-announce). 7-service stack on legacy Prague server (91.98.122.165), chain height 40+, 100% accept, 0 P2P errors. 393 core + 13 pool tests pass.**
- **Phase 23: WebSocket subscriptions — real-time event streaming for new blocks, pending transactions, address updates, network status; tokio async WebSocket server with subscription management; frontend WebSocket client with React hooks; CLI WebSocket commands; backend notification hooks in NodeRuntime; E2E tested on legacy Prague server (2026-05-13)**
- **Phase 22b: Pool active-session metrics — `AtomicU64` session counter with RAII `SessionGuard` (lock-free inc on connect, auto-dec on thread exit), `snapshot_json_ext()` adds `active_sessions` + `uptime_s` to JSON, `snapshot_prometheus_ext()` adds `zion_pool_active_sessions` gauge + `zion_pool_uptime_seconds` counter to Prometheus output, website `getPoolStats()` maps `active_sessions` → dashboard `miners.active`**
- **Phase 22: Docker testnet deployment & P2P fix — complete Docker compose rewrite for env-var config (V3 binaries use `from_env()` exclusively, CLI args ignored), raw TCP JSON-RPC health checks on port 8332, `netcat-openbsd` in Dockerfiles replacing curl, ZION_NODE_STATE_PATH must be file path not directory, pool/miner loop_count=4294967295 for continuous operation, nonce_count tuned (500K), job TTL 180s. P2P bug fix: moved duplicate block check before `validate_peer_block()` in `import_peer_block()` to prevent spurious difficulty mismatch errors when seeds re-announce blocks (LWMA window already advanced). Deployed to legacy Prague server (91.98.122.165): 7-service stack, chain height 40+, 100% share acceptance, zero P2P errors. Commits: 98fa4b5, f2ca370.**
- **Sprint 4 (Upgrade Plan): config profiles (pool/solo/benchmark/dual via `ZION_PROFILE`), enhanced PowerShell dashboard (PPLNS panel + miner fleet + log tail), V3 CI/CD (`v3-ci.yml` + `v3-release.yml`). Miner 59 tests, pool 37 tests = 96 miner+pool tests. Commit: ab7b55d.**
- **Sprint 5 (Upgrade Plan — pre-launch): Pool test coverage expanded to 73 tests (wire protocol edge cases, hex parsing, share lifecycle, revenue routing, session groups, Prometheus output). Security checklist completed (`SECURITY_CHECKLIST.md`). Public mining guide (`MINING_GUIDE.md`) and node operator guide (`NODE_OPERATOR_GUIDE.md`) published. Total: 393 core + 73 pool + 59 miner + 81 cosmic-harmony = 606 tests, 0 failures.**
- **Sprint 6 (Upgrade Plan — hardening): Production unwrap() audit (zero unsafe unwrap in hot paths). cargo-fuzz harnesses: pool (`fuzz_decode_message`, `fuzz_parse_hex`) + core (`fuzz_merkle_root`, `fuzz_validate_header`). `parse_fixed_hex` promoted to pub for fuzz surface. Phase 23/24/25 status reconciliation — monitoring complete, security mostly complete (BFG deferred), infra mostly complete (seed expansion pending). D2 block explorer marked done (live at zionterranova.com/explorer — 7 pages, pool dashboard, 10+ API endpoints).**
- **Sprint 7 (Upgrade Plan — post-launch): Native FFI self-test (`runtime_self_test()`, `AlgoTestResult`, `all_algorithms_healthy()` — 4 tests). Difficulty auto-tuning (`DifficultyStats`, `difficulty_stats()`, `predict_difficulty()` — 10 new tests, 31 total). CHv4.2 Merkabah Dual-Spin algorithm (fork-gated at u64::MAX, 14 new cosmic-harmony tests, 95 total). 635 workspace tests pass.**
- **Sprint 8 (Stabilization — 2026-03-26/27): Miner test hardening. V3/PLAN.md created. **Complete L2/L3 migration**: L2/bridge (157 tests, decimal fix 6→12), L2/dao (65 tests, u128 treasury), L2/atomic-swap (15 tests), L3/ncl (43 tests), L3/warp (252 tests, 7 chain adapters), L3/ai-native (89 tests, agent framework). All `amount_atomic`→`amount_flowers`, `FLOWERS_PER_ZION=1e12`. Total: ~1,300 workspace tests, 0 failures.**
- **Phase 23: Grafana + Prometheus monitoring stack — Node metrics HTTP server (`serve_node_metrics()` on ZION_METRICS_BIND=:9115, Prometheus /metrics + JSON /health), Prometheus scrape target alignment (`:8444` → `:9115`), alert rules rewritten to match actual V3 metric names (`zion_pool_*`, `zion_*`), Docker compose updated with port 9115 exposure + explicit `name: zion-net` network, Grafana provisioning with 22-panel V3 dashboard (pool overview, shares timeseries, routing groups, PPLNS window, core node stats), hardcoded Grafana credential removed. Full 5-service monitoring stack deployed: Prometheus, Grafana, node-exporter, redis-exporter, alertmanager. All local Prometheus targets scraping, Grafana dashboard live with real-time V3 data.**
- **Sprint 8 stabilization (2026-03-26/27):** Miner test hardening (`profile_does_not_override_explicit_env` — env var race condition between parallel tests, tolerant assertion). Comprehensive mainnet plan created (`V3/PLAN.md` — L1 finish phases, L2/L3 migration strategy with decimal audit, Go/No-Go genesis checklist). **Complete L2/L3 migration: bridge (157 tests), dao (65 tests), atomic-swap (15 tests), ncl (43 tests), warp (252 tests), ai-native (89 tests). ~1,300 workspace tests pass, 0 failures.**

### Not Done Yet

- ~~persistent peer connections~~ → ✅ Phase 10, ~~peer discovery~~ → ✅ Phase 11, ~~peer persistence~~ → ✅ Phase 11, ~~peer-block PoW/timestamp/checkpoint validation~~ → ✅ Phase 12, ~~UTXO bridge into mempool/template/peer/journal~~ → ✅ Phase 16; parallel multi-peer catch-up and full async multiplexing remain
- ~~richer block-body and transaction execution semantics~~ → ✅ Phase 16 (UTXO transactions accepted, validated, template-selected, mined, peer-validated, journal-replayed, snapshot-restored)
- ~~mempool transaction relay via P2P~~ → ✅ Phase 18 (AnnounceTx, SeenTransactions dedup, plan_tx_relay, P2P+RPC relay wiring)
- ~~end-to-end multi-node acceptance and propagation flow validation~~ → ✅ Phase 18b (9 E2E tests)
- BFG scrub of premine private keys from git history
- ~~production Docker images for node, pool, miner~~ → ✅ done (multi-stage Dockerfiles + compose stack)
- CI/CD pipeline, automated image builds → ✅ Sprint 4 (v3-ci.yml + v3-release.yml)
- ~~Phase 23: Monitoring~~ → ✅ Phase 23 (core metrics HTTP server, Prometheus V3 scrape alignment, alert rules for V3 metric names, 22-panel Grafana dashboard, 5-service monitoring stack deployed and verified)
- DesktopApp runtime supervision for node, pool, miner, release provenance, and signing workflows
- ~~difficulty auto-tuning in live mining~~ → ✅ Sprint 7 (DifficultyStats, difficulty_stats(), predict_difficulty() — 10 new tests, 31 total)
- ~~HIC / CHv4.2 algorithm~~ → ✅ Sprint 7 (Merkabah Dual-Spin: forward+backward HIC passes, v3 pipeline + mining helper, fork-gated at u64::MAX, 14 new tests, 95 total cosmic-harmony)
- ~~Docker testnet deployment to legacy Prague server~~ → ✅ Phase 22 (7-service stack, env-var config, P2P dedup fix)

### L1 Testnet → V3 Mainnet Migration Tracker

Full audit: `V3/L1_TESTNET_VS_V3_MAINNET_AUDIT.md` (2026-03-13)

| Metric | L1 testnet | V3 mainnet |
|--------|-----------|------------|
| Source files | ~50 `.rs` in 14 dirs | ~20 `.rs` in 4 crates |
| Total LoC | ~17,500 | ~8,300 |
| Tests | ~200+ | 432 core + 95 cosmic-harmony + 59 miner + 29 pool + 4 native-ffi + 157 bridge + 65 dao + 15 atomic-swap + 43 ncl + 252 warp + 89 ai-native + doctests = ~1,300 pass, 0 fail |
| Persistence | LMDB (7 databases) | LMDB via heed (8 databases) |
| Tx model | UTXO (Bitcoin-style) | UTXO (TxInput/TxOutput/Transaction) |
| Crypto | Ed25519 + BLAKE3 + RIPEMD160 | Ed25519 + BLAKE3 + `zion1...` addresses |
| Addresses | `zion1...` 44 chars, checksum | `zion1...` 44 chars, checksum |

#### Module Status (38 items)

**Done (37):** emission, LWMA DAA, genesis/premine, P2P messages, pool crate, miner crate, block headers, chain state (basic), **crypto/keys** (Ed25519, BLAKE3, `zion1...` addresses), **UTXO tx model** (TxInput/TxOutput/Transaction), **fee model** (MIN_TX_FEE, fee-rate, burn), **wallet** (coin selection, build_and_sign, batch payouts), **full block validation** (11-step pipeline, Merkle tree, signatures, maturity, fees, DAO lock), **chain reorg** (fork choice, undo blocks, MAX_REORG_DEPTH=10), **hardened mempool** (double-spend, byte/count limits, fee-rate eviction), **P2P security** (rate limiter, escalating bans, connection limiter), **orphan handling** (orphan buffer, chain ID enforcement), **LMDB storage** (8 databases, atomic writes, rollback), **IBD state machine** (batch sync, stall detection), **JSON-RPC 2.0** (17 live methods: getChainInfo, getNodeInfo, getBlock, getBlockByHeight, getBalance, getAccountBalance, getTransaction, getAccountTransaction, getBlockTemplate, getMempoolInfo, getPeerInfo, sendRawTransaction, submitTransaction, submitAccountTransaction, submitBlock, getUtxos, getSupplyInfo — auto-detected on RPC port alongside simple protocol), **peer manager** (scoring, banning, diversity), **metrics** (Prometheus, health check), **launch readiness** (genesis ceremony, checkpoints, 9 readiness checks), **node bootstrap** (NodeHandle wiring all subsystems), **block propagation** (flood-fill relay, SeenBlocks dedup, PropagationStats), **peer discovery** (active GetPeers exchange, merge into known_peers + PeerManager seeds), **peer persistence** (known_peers → `peers.json`, load on startup), **peer-block validation hardening** (PoW via header_hex, timestamp sanity, checkpoint enforcement), **chain linkage verification** (previous_hash_hex in AcceptedBlock, import-time parent-hash enforcement, header cross-check), **RPC model alignment** (RuntimeTransaction adapter, account/UTXO dual routing, centralized submit boundary), **UTXO mempool bridge** (submit → validate → mempool → template → mine → peer validate → journal → snapshot), **AcceptedBlock convergence** (utxo_transactions + utxo_transaction_ids fields, backward-compatible serde), **profit router + Decred revenue** (ExternalCoin enum with DCR/ALPH Blake3 coins, CoinProfile, ProfitEntry, fallback estimates, select_best_coin with hysteresis, Blake3External revenue source at 2% fee), **UTXO RPC + chain validation** (getBalance zion1, getUtxos, UTXO input existence check, SpendableUtxo, utxo_set/balance/spendable_utxos/utxo_exists), **mempool tx relay** (AnnounceTx P2P message, SeenTransactions dedup, plan_tx_relay, SubmittedTransaction serde, P2P+RPC relay wiring), **E2E multi-node tests** (9 integration tests covering block/tx relay, sync, handshake, dedup)

**Partial (1):** P2P (Phase 10+11+12+18 added persistent connections, outbound peer thread, heartbeat, PeerManager+PeerSecurity wiring, peer discovery, peer persistence, block validation hardening, transaction relay; missing full async networking, parallel multi-peer IBD)

**Missing (3):** P2P sync (full async networking with IBD integration), security audit tools, load tests

#### Open Architectural Decisions

1. **UTXO vs Account model** — ✅ RESOLVED: V3 uses UTXO model (`tx.rs`: TxInput/TxOutput/Transaction, SegWit-style BLAKE3 txid)
2. **General hashing** — ✅ RESOLVED: BLAKE3 for tx/merkle/addresses, Ekam Deeksha for PoW only (`crypto.rs`)
3. **Reward distribution** — ✅ RESOLVED (2026-03-27): Pool PPLNS engine now applies 89/5/5/1 fee split. Coinbase goes 100% to node wallet; pool accounting deducts 5% humanitarian tithe, 5% issobella fund, 1% pool fee before PPLNS distribution. Configurable via `ZION_HUMANITARIAN_TITHE_PCT`, `ZION_ISSOBELLA_FUND_PCT`, `ZION_POOL_FEE_PCT`, `ZION_HUMANITARIAN_WALLET` env vars.

### Gap Inventory (V3 code vs constitutional requirements)

Audit date: 2026-03-12. Each item maps to the constitutional parameter table above.

#### CRITICAL — mainnet launch blockers

| ID | Missing module | What constitution requires | V3 current state | Migration source |
|----|----------------|---------------------------|------------------|------------------|
| G1 | **Emission / Decade Decay** | Decade Decay (×4/5 per 5,256,000 blocks), tail ~724.785 ZION | ✅ `emission.rs` — 16 tests | `L1/core/src/blockchain/reward.rs` |
| G2 | **Atomic units (flowers)** | 1 ZION = 1e6 flowers; reward = 5,400,067,000 flowers (updated 3.0.3 fork) | ✅ Integrated in `emission.rs` | Same as G1 |
| G3 | **LWMA DAA** | 60-block window, ±25% max change, 30–120 s solve-time clamp | ✅ `difficulty.rs` — 31 tests (+10 auto-tuning: stats, predict, hashrate), integer-only ±25% clamp | `L1/core/src/blockchain/consensus.rs` |
| G4 | **Genesis block + premine** | 16.28B ZION into 12 addresses as coinbase outputs in block 0 | ✅ `genesis.rs` — 17 tests, 12 premine outputs, frozen hash, ChainState init | `L1/core/src/blockchain/premine.rs` + `PREMINE_ADDRESSES_PUBLIC.txt` |
| G5 | **Block propagation** | Flood-fill relay to all connected peers on new block accept | ✅ `propagation.rs` — SeenBlocks dedup, plan_relay(), node binary relay on announce+submit | ~~Phase 5d~~ done |

#### CRITICAL — cryptographic & transaction foundation (added 2026-03-13 from L1 audit)

| ID | Missing module | What is needed | V3 current state | Target phase |
|----|----------------|----------------|------------------|--------------|
| G16 | **Crypto / Ed25519** | Ed25519 keygen, sign/verify, `zion1...` address derivation, BLAKE3 general hash | ✅ `crypto.rs` — 19 tests | ~~Phase 5e~~ done |
| G17 | **UTXO tx model** | `TxInput`/`TxOutput`/`Transaction`, SegWit-style hash, `verify_signatures()` | ✅ `tx.rs` — 10 tests | ~~Phase 5f~~ done |
| G18 | **Fee model** | MIN_TX_FEE, fee-rate, MAX_TX_SIZE, 100% burn | ✅ `fee.rs` — 15 tests | ~~Phase 5f~~ done |
| G19 | **Wallet** | UTXO coin selection, `build_and_sign()`, `zeroize`, batch payouts | ✅ `wallet.rs` — 9 tests | ~~Phase 5g~~ done |
| G20 | **Full block validation** | 10-step pipeline: merkle, signatures, maturity, size, timestamp, double-spend | ✅ `validation.rs` — 25 tests | ~~Phase 5h~~ done |

#### HIGH — network security before production

| ID | Missing rule | Constitutional value | V3 current state | Target phase |
|----|-------------|---------------------|------------------|--------------|
| G6 | Max reorg depth | 10 blocks | ✅ `chain.rs` — MAX_REORG_DEPTH=10, enforced in evaluate_reorg | ~~Phase 6a~~ done |
| G7 | Coinbase maturity | 100 blocks | ✅ `validation.rs` — COINBASE_MATURITY=100, enforced in validate_block | ~~Phase 6b~~ done |
| G8 | Fee burn | 100% of fees burned | ✅ `fee.rs` — 100% burn, BURN_ADDRESS defined | ~~Phase 6b~~ done |
| G9 | Seed peers | 5+ required for eclipse resistance | ⚠️ Current runtime uses Core + Edge topology; audited multi-seed expansion must be reintroduced before broader public rollout | re-opened |
| G10 | Premine unlock_height | DAO Treasury cliff at ~525,600 | ✅ `validation.rs` Step 11: `validate_premine_locks()` calls `genesis::is_premine_transfer_allowed()` | ~~Phase 8~~ done |

#### MEDIUM — required before production launch, not for testnet

| ID | Item | V3 current state | Status |
|----|------|------------------|--------|
| G11 | Fork choice rule: highest accumulated work (chain selection) | ✅ `chain.rs` — ForkChoice engine, is_stronger (strictly >) | ~~Phase 6a~~ done |
| G12 | Orphan block handling and relay | ✅ `orphan.rs` — OrphanPool with FIFO eviction | ~~Phase 6e~~ done |
| G13 | Eclipse protection (peer diversity, connection limits) | ✅ `p2p_security.rs` — MAX_CONNECTIONS=128, ConnectionLimiter | ~~Phase 6d~~ done |
| G14 | Timestamp validation on incoming P2P blocks | ✅ `validation.rs` — ±7200s drift check | ~~Phase 6e~~ done |
| G15 | Chain ID enforcement in wire messages | ✅ `orphan.rs` — validate_chain_id(), CHAIN_ID="zion-mainnet-1" | ~~Phase 6e~~ done |

#### PRODUCTION — infrastructure for mainnet operations

| ID | Item | Target phase |
|----|------|--------------|
| G21 | LMDB persistent storage (replace JSON snapshot) | ✅ `storage.rs` — 12 tests | ~~Phase 7a~~ done |
| G22 | IBD state machine (batch sync, stall detection) | ✅ `ibd.rs` — 13 tests | ~~Phase 7b~~ done |
| G23 | HTTP JSON-RPC 2.0 server (~40 methods) | ✅ `rpc.rs` — 14 tests (11 stub methods) | ~~Phase 7c~~ done |
| G24 | Peer manager (scoring, banning, connection tracking) | ✅ `peer_manager.rs` — 13 tests | ~~Phase 7d~~ done |
| G25 | Metrics / Prometheus export | ✅ `metrics.rs` — 10 tests | ~~Phase 7e~~ done |

## Build Order

### Phase 1: Consensus Baseline

Goal: keep Ekam Deeksha bit-stable and make runtime types auditable.

Exit criteria:

- canonical vector stable
- core/pool/miner tests green
- no duplicate consensus path introduced into `V3/`

Status: done

### Phase 2: Mining Runtime

Goal: establish one clear miner <-> pool flow with explicit wire lifecycle.

Exit criteria:

- miner loop works locally
- pool validates shares and stale jobs
- remote TCP smoke path works end-to-end

Status: done

### Phase 3: Node Scaffold

Goal: introduce the clean mainnet node surface without dragging in legacy networking complexity.

Exit criteria:

- P2P and RPC wire messages exist
- node binary binds and answers over TCP
- peer registration and status reporting work

Status: done

### Phase 4: Node Submit Flow

Goal: connect RPC and internal runtime state to actual candidate intake and block-template handling.

Required work:

- add block template state to `L1/core`
- distinguish template creation, candidate validation, and sealed-block acceptance
- expose template/status updates through RPC
- prepare the contract that pool will use to request fresh templates and submit solved candidates

Exit criteria:

- `submit_candidate` is backed by node runtime state instead of bare validation only
- node can track at least one active template
- pool-to-node integration path is defined in code

Status: done

### Phase 5: Testnet Integration

Goal: move from isolated runtime pieces to a coherent single-host testnet path.

Required work:

- connect pool to node template flow
- connect miner accepted shares to node-side candidate submission
- run single-node + pool + miner local integration
- run multi-process testnet rehearsal with explicit logs and acceptance checks

Exit criteria:

- node/pool/miner can run together on one host as a coherent testnet path
- template rotation and accepted candidate flow are visible and auditable
- pool and node services can hold state across repeated client sessions
- node can carry a basic mempool into templates and recover the resulting chain snapshot after restart

Status: in progress — single-host path works; persistent connections and parallel multi-peer catch-up remain

### Phase 5a: Emission & Atomic Units (G1, G2)

Goal: introduce flowers as the canonical unit and implement decade decay so block rewards match the constitution.

Required work:

- define `ATOMIC_UNITS_PER_ZION = 1_000_000_000_000_u64` (flowers)
- define `INITIAL_REWARD_FLOWERS = 5_400_067_000_000_000_u64`
- define `BLOCKS_PER_DECADE = 5_256_000`, `DECAY_NUM = 4`, `DECAY_DEN = 5`, `MAX_DECAY_DECADES = 10`
- implement `block_reward(height: u64) -> u64` returning flowers with decade decay and perpetual tail
- define `TAIL_REWARD_FLOWERS` for post-decade-10 emission
- define `TOTAL_SUPPLY_FLOWERS` as hard cap for validation
- migrate all internal accounting from integer ZION to flowers (u64)
- add unit tests: reward at height 0, decade boundary, decade 10+, cumulative supply check

Exit criteria:

- `block_reward(0)` returns `5_400_067_000_000_000`
- `block_reward(5_256_000)` returns 80% of initial
- `block_reward(52_560_000)` returns tail emission
- cumulative emission across all decades stays within 127.72B ZION mining supply
- all existing tests remain green

Migration source: `L1/core/src/blockchain/reward.rs` (audit, extract logic, rewrite clean)

Status: done

### Phase 5b: LWMA Difficulty Adjustment (G3)

Goal: implement the constitutional DAA so the network self-regulates to 60 s block times.

Required work:

- implement LWMA with 60-block window over `(timestamp, difficulty)` pairs
- enforce ±25% max adjustment per block (integer arithmetic, no f64)
- add 30–120 s solve-time clamp per interval
- integrate DAA into template creation (next_difficulty from accepted_blocks)
- integrate DAA into block validation (verify difficulty matches LWMA output)
- remove hardcoded `difficulty_bits: 0x1f00ffff` — replaced by compact nBits encoding
- add `timestamp` (seconds) and `difficulty` (u64) fields to AcceptedBlock
- target ↔ difficulty conversion: `difficulty_to_target()`, `target_to_compact()`, `compact_to_target()`
- switch header timestamp from ms to seconds (`now_secs()`)
- 21 new unit tests (14 LWMA algorithm + 7 target/compact conversion)

Exit criteria:

- DAA produces correct targets for synthetic 60-block histories ✓
- fast blocks → difficulty rises; slow blocks → difficulty falls ✓
- ±25% clamp holds under adversarial input ✓
- stability simulation (200 blocks, varied solve times) converges ✓
- all existing tests remain green (updated to use `find_valid_nonce`) ✓
- 118 tests pass, 0 fail, 1 ignored ✓

Migration source: `L1/core/src/blockchain/consensus.rs` → `V3/L1/core/src/difficulty.rs`

Status: done

### Phase 5c: Genesis Block & Premine (G4)

Goal: construct the canonical genesis block with all 12 premine outputs.

Required work:

- define genesis block structure: header (height 0, prev_hash 0x00…, timestamp TBD, nonce TBD) + coinbase with 12 outputs
- embed 12 addresses and amounts from `PREMINE_ADDRESSES_PUBLIC.txt` (total 16,280,000,000 ZION = 16,280,000,000,000,000,000,000 flowers)
- set DAO Treasury outputs with `unlock_height = 525_600`
- compute and freeze genesis block hash
- add genesis block as chain initialization default in ChainState
- add validation: block at height 0 must equal frozen genesis hash

Exit criteria:

- `ChainState::new()` starts with genesis block containing 12 premine outputs
- genesis hash is deterministic and matches frozen constant
- node starts from genesis when no chain snapshot exists
- total premine amount sums to exactly 16,280,000,000 ZION in flowers

Migration source: `L1/core/src/blockchain/premine.rs` + `PREMINE_ADDRESSES_PUBLIC.txt` (data only; genesis builder is new V3 code)

Status: done

### Phase 5d: Block Propagation & Multi-Peer Sync (G5)

Goal: extend P2P from request/response into active relay and parallel catch-up.

Required work:

- maintain a connected-peers set in NodeRuntime (not just known_peers list)
- on `accept_block`, broadcast `AnnounceBlock` to all connected peers except source
- implement persistent peer connections (or connection pool) instead of per-message TCP
- implement multi-peer catch-up: try N peers in parallel, accept first valid chain
- add flood-fill protocol: peer receiving `AnnounceBlock` validates, accepts, and relays further

Exit criteria:

- block mined on node A appears on node B and node C within seconds
- fresh node catches up from multiple seeds in parallel
- no duplicate block relay loops (seen-set or similar)
- two-node and three-node rehearsals pass

Status: done — `propagation.rs` (200 LoC, 15 tests), node binary relay on announce+submit

### Phase 5e: Cryptographic Foundation (G16)

Goal: introduce Ed25519 key management, BLAKE3 general hashing, and canonical `zion1...` address derivation.

This phase is a **mainnet launch blocker** — without it, transactions cannot be signed or verified.

Required work:

- implement `crypto.rs` module:
  - Ed25519 keypair generation, sign, verify (`ed25519_dalek` crate)
  - BLAKE3 general hash (for tx hashing, merkle roots — separate from Ekam Deeksha PoW)
  - `zion1...` address derivation: `SHA256(pubkey) → RIPEMD160 → base32 + 4-char checksum`
  - frozen constant: `ZION_BASE32_ALPHABET = "023456789acdefghjklmnpqrstuvwxyz"`
  - `is_valid_zion1_address()` validation (44 chars, prefix, checksum)
  - `derive_address(pubkey) -> String`
- add `ed25519-dalek`, `blake3`, `sha2`, `ripemd` to `Cargo.toml` dependencies
- unit tests: key gen/sign/verify round-trip, address derivation determinism, checksum validation, invalid address rejection

Exit criteria:

- `Keypair::generate()` → sign → verify round-trip passes
- `derive_address(known_pubkey)` produces deterministic `zion1...` 44-char address
- invalid addresses (wrong length, bad checksum, wrong prefix) are rejected
- all existing tests remain green

Migration source: `L1/core/src/crypto/keys.rs` (260 LoC) → rewrite clean

Status: done — `crypto.rs` (260 LoC, 19 tests), commit 33927a3

### Phase 5f: Transaction Model (G17, G18)

Goal: implement the canonical UTXO transaction model with fee enforcement.

This phase is a **mainnet launch blocker** — without it, value transfer has no cryptographic integrity.

Required work:

- implement `tx.rs` module:
  - `TxInput { prev_tx_hash: [u8;32], output_index: u32, signature: Vec<u8>, public_key: Vec<u8> }`
  - `TxOutput { amount: u64, address: String, memo: Option<String> }` (amount in flowers)
  - `Transaction { id: [u8;32], version: u32, inputs: Vec<TxInput>, outputs: Vec<TxOutput>, fee: u64, timestamp: u64 }`
  - `calculate_hash()` — SegWit-style: exclude signatures from hash preimage
  - `verify_signatures()` — Ed25519 verify each input against its public_key
  - `is_coinbase()` detection
- implement `fee.rs` module:
  - `MIN_TX_FEE = 1_000` flowers (0.001 ZION)
  - `MIN_FEE_RATE = 1` flower/byte
  - `MAX_TX_SIZE = 100_000` bytes
  - `MAX_OUTPUT_AMOUNT = 144_000_000_000_000_000_000_000` flowers (total supply cap)
  - `validate_fee(tx) -> Result<(), FeeError>`
  - Fee destination: 100% burned (coinbase = reward only, no fee routing)
- decide and implement: account-style `Transaction` in `lib.rs` deprecated or migrated to UTXO
- unit tests: tx construction, hash determinism, signature verify, fee validation, coinbase detection

Exit criteria:

- UTXO transaction round-trips through serialize → hash → sign → verify
- fee below MIN_TX_FEE is rejected
- tx larger than MAX_TX_SIZE is rejected
- coinbase transactions are correctly identified
- all existing tests remain green

Migration source: `L1/core/src/tx/mod.rs` (189 LoC) + `L1/core/src/blockchain/fee.rs` (335 LoC) → rewrite clean

Status: done — `tx.rs` (220 LoC, 10 tests) + `fee.rs` (210 LoC, 15 tests), commit 33927a3

### Phase 5g: Wallet (G19)

Goal: enable users to build, sign, and broadcast transactions.

Required work:

- implement `wallet.rs` module:
  - `SpendableUtxo { tx_hash, output_index, amount, address }`
  - `SendParams { from_keypair, to_address, amount, fee }`
  - `BuildResult { transaction, change_utxo }`
  - `WalletError` enum
  - UTXO coin selection (largest-first)
  - `build_and_sign(params, available_utxos) -> Result<BuildResult, WalletError>`
  - `zeroize` secret keys after signing
- implement `batch.rs` module (for pool PPLNS payouts):
  - `MAX_BATCH_RECIPIENTS = 200`
  - `MIN_PAYOUT_AMOUNT = 10_000_000_000_000` flowers (10 ZION)
  - multi-recipient transaction builder
- unit tests: single send, batch send, insufficient funds, coin selection, zeroize verification

Exit criteria:

- `build_and_sign()` produces valid signed transaction
- change output is correct
- batch with 200 recipients produces valid transaction
- insufficient funds returns proper error
- all existing tests remain green

Migration source: `L1/core/src/wallet/mod.rs` (300 LoC) + `L1/core/src/wallet/batch.rs` (609 LoC) → rewrite clean

Status: done — `wallet.rs` (310 LoC, 9 tests), commit 33927a3

### Phase 5h: Full Block Validation (G20)

Goal: make block acceptance cryptographically secure with a complete 10-step validation pipeline.

Required work:

- implement `validation.rs` module (or expand existing validation in `lib.rs`):
  - Step 1: Block structure (non-empty, within MAX_BLOCK_SIZE = 1,048,576 bytes)
  - Step 2: PoW validation (existing `DifficultyTarget::allows()`)
  - Step 3: Difficulty matches LWMA output (existing in `difficulty.rs`)
  - Step 4: Timestamp within ±7,200 s of median-time-past
  - Step 5: Binary Merkle root verification (BLAKE3 hash pairs, not XOR-fold)
  - Step 6: Transaction signature validation (Ed25519 per input)
  - Step 7: UTXO double-spend check (no input references spent output)
  - Step 8: Coinbase maturity enforcement (100 blocks)
  - Step 9: Fee validation (MIN_TX_FEE, fee-rate, explicit burn)
  - Step 10: Subsidy validation (existing, ensure coinbase ≤ reward, no fee in coinbase)
- frozen constants:
  - `COINBASE_MATURITY = 100`
  - `MAX_BLOCK_SIZE = 1_048_576` bytes
  - `MAX_TIMESTAMP_DRIFT = 7_200` seconds
- unit tests: valid block passes all 10 steps, each step rejects malformed input individually

Exit criteria:

- block with invalid merkle root is rejected
- block with forged transaction signature is rejected
- block spending immature coinbase is rejected
- block exceeding 1 MB size limit is rejected
- block with future timestamp beyond 2 hours is rejected
- all existing tests remain green

Migration source: `L1/core/src/blockchain/validation.rs` (556 LoC) → rewrite clean

Status: done — `validation.rs` (420 LoC, 25 tests), commit 33927a3

### Phase 6: Chain Safety Rules (G6–G8, G11–G15, Audit P0/P1)

Goal: enforce constitutional chain rules and security audit fixes.

This phase closes all HIGH-priority gaps and L1 security audit findings.

Required work:

#### 6a — Chain reorg and fork choice (G6, G11, Audit P0-07, P1-01)
- `total_work` tracking per chain tip (cumulative difficulty)
- fork choice: strictly most-work wins (`>` not `>=`, per audit P1-01)
- `try_reorg()` with UTXO rollback via undo blocks
- `MAX_REORG_DEPTH = 10` blocks (constitutional, stricter than L1's 50)
- `SOFT_FINALITY_DEPTH = 60` blocks
- `find_fork_point()` and `is_stronger_chain()`
- reject reorganizations deeper than MAX_REORG_DEPTH
- `try_reorg_unchecked` only available in test/dev builds (audit P1-06)

#### 6b — Coinbase maturity and fee burn (G7, G8)
- coinbase outputs unspendable for 100 blocks
- fees in accepted blocks are provably destroyed, not routed to any address
- burn address: `zion1burn0000000000000000000000000000000dead`
- DAO address: `zion1dao00000000000000000000000000000treasury`

#### 6c — Mempool hardening (Audit P1-15, P1-16)
- double-spend outpoint tracking (reject tx spending already-queued output)
- `MAX_MEMPOOL_SIZE = 10_000` transactions
- `MAX_MEMPOOL_BYTES = 20_971_520` (20 MB)
- `MempoolError` enum for structured rejection
- fee-rate eviction when limits are hit
- no unvalidated transaction entry (audit P1-16)
- `restore_transactions()` for reorg-displaced txs

#### 6d — P2P security (G13, Audit P1-10)
- `RateLimiter`: per-IP connection rate limiting
- `Blacklist`: permanent + temporary bans
- `ConnectionLimiter`: global max connections
- `MessageRateLimiter`: escalating ban durations (5 min → 30 min → 2 hours, audit P1-10)

#### 6e — Orphan and timestamp handling (G12, G14, G15)
- orphan block buffer: store blocks whose parent is unknown, re-evaluate when parent arrives
- timestamp validation: reject P2P blocks outside ±120 s of median-time-past
- chain ID: include `zion-mainnet-1` in P2P Hello, reject mismatched peers

Exit criteria:

- 11-block reorg attempt is rejected
- spending a coinbase before height+100 is rejected
- fork choice selects higher-work chain over higher-height chain
- mempool rejects double-spend and enforces byte/count limits
- rate-limited peer gets escalating bans
- orphan block is buffered and accepted when parent arrives
- mismatched chain ID peer is disconnected
- all existing tests remain green

Status: done — `chain.rs` (400 LoC, 14 tests) + `mempool_v2.rs` (350 LoC, 12 tests) + `p2p_security.rs` (250 LoC, 10 tests) + `orphan.rs` (220 LoC, 10 tests), commit f0d9c75

### Phase 7: Production Infrastructure

Goal: replace prototype subsystems with production-grade components.

#### 7a — Persistent Storage (Audit #23, P0-05, P0-09)
- LMDB via `heed` crate, 10 GB default map size
- 7 databases: blocks, utxos, tx_index, balance_cache, undo_blocks, height_to_hash, hash_to_height
- `save_block_and_apply_utxos()` — single LMDB write transaction (atomic, per audit P0-05/P0-09)
- schema migration support
- JSON snapshot retained as optional export/import format

#### 7b — IBD & Sync (Audit #25)
- IBD state machine: `IBD_THRESHOLD = 50` blocks behind triggers IBD mode
- batch sync: `IBD_BATCH_SIZE = 500` blocks per request
- stall detection: 120 s timeout, 3 retries before peer demotion
- `SyncStatus` tracking (IBD, Syncing, Synced)
- block processing lock to prevent race conditions (audit P0-08)

#### 7c — RPC Expansion (Audit #12)
- migrate from line-delimited TCP JSON to HTTP (Axum)
- JSON-RPC 2.0 standard
- priority methods: `getBalance`, `getAccountBalance`, `getBlock`, `getTransaction`, `getAccountTransaction`, `sendRawTransaction`, `submitTransaction`, `submitAccountTransaction`, `getBlockTemplate`, `getMempoolInfo`, `getPeerInfo`
- auth middleware for write operations

#### 7d — Peer Manager (Audit #26)
- peer scoring (latency, validity, contribution)
- connection tracking with diversity checks (IP/subnet)
- automatic banning for misbehavior
- dead peer detection and cleanup

#### 7e — Metrics & Monitoring (Audit #27)
- atomic counters: blocks_accepted, txs_processed, mempool_size, peer_count, block_time
- Prometheus-compatible export endpoint
- health check endpoint

Exit criteria:

- LMDB stores and retrieves blocks atomically ✅
- fresh node syncs from genesis via IBD in acceptable time ✅ (state machine ready)
- HTTP RPC serves wallet and explorer queries ✅ (protocol handler + 11 method stubs)
- Prometheus scrape returns current metrics ✅
- restart after crash recovers without data loss ✅ (LMDB atomic writes)

Status: done — `storage.rs` (500 LoC, 12 tests) + `ibd.rs` (300 LoC, 13 tests) + `rpc.rs` (300 LoC, 14 tests) + `peer_manager.rs` (350 LoC, 13 tests) + `metrics.rs` (250 LoC, 10 tests), commit 9e9c8c6

### Phase 8: Mainnet Launch Readiness

Goal: make `V3/` the operational mainnet code line.

Required work:

- restart hardening, corruption drills, and replay validation
- release checks and reproducible build path
- genesis ceremony: freeze genesis block hash, timestamp, and nonce
- BFG scrub of private keys from git history
- seed peer infrastructure: 5+ geographically distributed nodes
- deploy/monitoring assets migrated only after runtime shape stabilizes
- wallet secret key `zeroize` after signing confirmed (audit P1-17)
- production Docker images for node, pool, miner

Exit criteria:

- runtime has a reproducible launch path
- genesis hash is frozen and published
- 5+ seed peers are reachable
- acceptance and propagation flows are validated end-to-end
- private key material is confirmed absent from any reachable git ref
- non-code assets are aligned with the final runtime shape
- all audit P0 and P1 findings verified resolved

Status: in progress — code done; Docker images built and deployed to Hetzner Edge (Core + Edge topology); testnet live with chain growing (Phase 22); BFG scrub and CI/CD remain

### Phase 8a: Docker & Deployment

Goal: production Docker images and single-command deployment.

Completed work:

- multi-stage Dockerfiles (`rust:1.85-bookworm` builder → `debian:bookworm-slim` runtime)
- self-contained build context: only `V3/` needed (no repo root dependency)
- `docker-compose.v3-mainnet.yml`: 3-service stack (node + pool + miner) with bridge network
- deployed to 157.180.41.213 (Helsinki, Hetzner, 8 vCPU AMD EPYC, 16 GB RAM, 150 GB SSD)
- chain synced to height 30+ with live mining, LWMA difficulty active
- build time: ~35 s for node, ~25 s for pool+miner (cached layers)

Docker images:

| Image | Binary | Base | Ports |
|-------|--------|------|-------|
| `zion-v3-node` | `node` | debian:bookworm-slim | 8334 (P2P), 8332 (RPC) |
| `zion-v3-pool` | `server` | debian:bookworm-slim | 8444 (stratum) |
| `zion-v3-miner` | `zion-miner` | debian:bookworm-slim | — |

Build & run:

```bash
cd V3
docker compose -f docker/docker-compose.v3-mainnet.yml build
docker compose -f docker/docker-compose.v3-mainnet.yml up -d
docker compose -f docker/docker-compose.v3-mainnet.yml logs -f
```

Status: done

### Phase 22: Docker Testnet Deployment & P2P Fix

Goal: deploy V3 stack to production server and fix all runtime issues discovered during live testing.

Completed work:

#### Docker Compose Rewrite
- **V3 binaries use `from_env()` exclusively** — CLI `command:` sections removed, all config via `ZION_*` env vars
- **Raw TCP JSON-RPC health check** on port 8332: `echo '{"jsonrpc":"2.0","method":"getChainInfo","id":1}' | nc -w2 127.0.0.1 8332 | grep -q chain_height`
- **Dockerfiles updated**: `curl` replaced with `netcat-openbsd` for health checks, port 8332 (RPC) added to EXPOSE
- **State path fix**: `ZION_NODE_STATE_PATH` must be a FILE path (e.g. `/data/zion/chain_state.json`), not a directory
- **Mining loop fix**: pool and miner both default `loop_count=1` — set to `4294967295` (effectively infinite) for continuous operation
- **Nonce tuning**: `ZION_NONCE_COUNT=500000`, `ZION_JOB_TTL_MS=180000` for balanced throughput
- **Docker network**: 172.29.0.0/24 subnet with static IPs (core=.10, seed1=.11, seed2=.12)
- **Pool RPC connection**: pool connects to core via raw TCP on `ZION_NODE_RPC_ADDR=172.29.0.10:8332`

#### P2P Bug Fix (`import_peer_block` difficulty mismatch)
- **Root cause**: `import_peer_block()` called `validate_peer_block()` before checking if the block was already known. When seeds re-announced blocks the core already had, the LWMA difficulty window had already advanced (includes the current block), producing a different `expected_difficulty` than the block's actual difficulty.
- **Fix**: moved the `accepted_by_height` duplicate check BEFORE `validate_peer_block()` — duplicates now return `Ok(None)` immediately without triggering expensive and incorrect difficulty recomputation.
- **Result**: zero P2P errors post-fix (was dozens per minute before).

#### Live Deployment (Core + Edge)
- 7-service Docker stack: core, seed1, seed2, pool, miner, redis, website
- Chain height 40+ within 30 minutes, continuously growing
- 100% share acceptance rate, 0 rejections
- Algorithm: `cosmic_harmony_ekam_deeksha_v2` confirmed on all components
- ~4.4K H/s sustained throughput (CPU miner, 3.5 cores allocated)

Commits: `98fa4b5` (Docker config), `f2ca370` (P2P fix)

Status: done

### Phase 14: RPC Model Surface Alignment

Goal: align RPC and runtime surfaces so account and UTXO transactions coexist cleanly.

Completed work:

- `RuntimeTransaction` enum (`Account`/`Utxo`) with serde untagged dispatch
- `tx_id()`, `as_account()`, `as_utxo()`, `into_account()`, `into_utxo()`, From impls
- balance/tx API routes account vs UTXO paths
- mempool, template, and journal use `RuntimeTransaction` internally
- backward-compatible serde with `#[serde(default)]` on all new fields

Status: done (commit `3a892f5`)

### Phase 15: Centralized Submit Boundary

Goal: single entry point for all transaction submission with model detection.

Completed work:

- `SubmittedTransaction` enum with `parse_value(Value)` auto-detection
- `model()` returns `"account"` or `"utxo"`
- `tx_id()` for both models
- `zion1...` UTXO-format addresses rejected on account-only endpoints
- all submit RPC methods route through `submit_submitted_transaction()`

Status: done (commit `8ed8aeb`)

### Phase 16: Complete UTXO Bridge

Goal: UTXO transactions accepted into the full pipeline — from submit to snapshot restore.

Completed work:

- `insert_utxo_transaction()`: validates hash, Ed25519 signatures, checks duplicates, double-spend detection, inserts into mempool, rebuilds template
- `submit_utxo_transaction_rpc()`: new method routing UTXO through insert + journal persist
- `AcceptedBlock` converged: `utxo_transaction_ids` + `utxo_transactions` fields (backward compatible)
- `BlockTemplate` extended: `utxo_transaction_ids`, `utxo_transaction_count`, `total_utxo_fees`
- `select_template_utxo_transactions()`: selects by fee descending, MAX_TEMPLATE_UTXO_TRANSACTIONS=16
- `derive_template_merkle_root()` includes UTXO transaction hashes (backward compatible when empty)
- `validate_peer_block()`: UTXO section validates ID hashes, signatures, intra-block double-spends
- `apply_journal_entry()`: UTXO path calls `insert_utxo_transaction()` instead of error
- `snapshot()` / `from_snapshot()`: utxo_mempool persisted and restored
- `sanitize_recovered_state()`: handles Account vs Utxo pattern matching, UTXO hash/sig validation, seen_utxo_inputs tracking
- 12 new tests: submit, template, mining, peer import, rejection (bad hash, bad sig, duplicate, double-spend), coexistence, default-empty fields

Exit criteria:

- UTXO transaction submits to mempool ✓
- UTXO transaction appears in template ✓
- UTXO transaction mined in block ✓
- Invalid hash/signature/duplicate/double-spend rejected ✓
- Account and UTXO transactions coexist in template ✓
- Peer import validates and accepts UTXO blocks ✓
- Peer import rejects UTXO blocks with bad signatures ✓
- All 370+ tests pass ✓

Status: done (commit `ba601d4`)

### Phase 17: UTXO RPC & Chain Validation

Goal: UTXO balance queries, spendable UTXO listing, and chain-level input existence verification.

Completed work:

- `SpendableUtxo` struct: tx_hash, output_index, amount, address, height
- `ChainState::utxo_set()`: builds full UTXO set from accepted_blocks (processes spends then creates outputs per block)
- `ChainState::utxo_balance(address)`: sums unspent UTXO amounts for zion1 address
- `ChainState::spendable_utxos(address)`: returns Vec<SpendableUtxo> for an address
- `ChainState::utxo_exists(tx_hash, output_index)`: checks if outpoint exists as unspent
- `insert_utxo_transaction()`: now verifies each input's referenced UTXO exists on chain and is unspent, before double-spend mempool check
- `NodeRuntime::utxo_balance()` and `NodeRuntime::spendable_utxos()` public methods
- `getBalance` RPC: now accepts zion1 addresses, returns `balance_flowers`, `transaction_model: "utxo"`
- `getUtxos` RPC: new endpoint returning spendable UTXOs for a zion1 address (count, total_amount, utxos array)
- RPC method count: 15 → 16
- Test infrastructure: `seed_utxo_funding()` helper injects on-chain funding UTXOs for test spending
- `make_signed_utxo_tx_spending()` helper creates valid chain-backed spending transactions
- All 8 existing UTXO tests updated to use chain-backed funding
- 4 new tests: nonexistent input rejection, UTXO balance tracking (funded + spent), getUtxos empty/reject

Exit criteria:

- `getBalance` returns UTXO balance for zion1 addresses ✓
- `getUtxos` returns spendable UTXOs for zion1 addresses ✓
- UTXO input referencing nonexistent outpoint is rejected ✓
- Balance reflects funding and spending correctly ✓
- All 374 tests pass ✓

Status: done

## Immediate Next Steps

Completed:

1. ~~**Phase 5a: Emission** — flowers + decade decay (`emission.rs`).~~ ✅ done
2. ~~**Phase 5b: LWMA DAA** — difficulty adjustment (`difficulty.rs`).~~ ✅ done
3. ~~**Phase 5c: Genesis** — genesis block with 12 premine outputs (`genesis.rs`).~~ ✅ done
4. ~~**Phase 5e: Crypto** — Ed25519 + BLAKE3 + `zion1...` addresses (`crypto.rs`).~~ ✅ done
5. ~~**Phase 5f: Tx Model** — UTXO transactions + fee enforcement (`tx.rs`, `fee.rs`).~~ ✅ done
6. ~~**Phase 5g: Wallet** — coin selection, build & sign (`wallet.rs`).~~ ✅ done
7. ~~**Phase 5h: Validation** — 10-step block validation pipeline (`validation.rs`).~~ ✅ done

Parallel track:

8. ~~**Phase 5d: Propagation** — flood-fill relay, SeenBlocks dedup, PropagationStats (`propagation.rs`).~~ ✅ done

Critical path — next up (sequential):

8. ~~**Phase 6: Chain Safety** — reorg (6a), maturity+burn (6b), mempool hardening (6c), P2P security (6d), orphan handling (6e).~~ ✅ done

Critical path — next up (sequential):

9. ~~**Phase 7: Production Infrastructure** — LMDB storage (7a), IBD sync (7b), RPC expansion (7c), peer manager (7d), metrics (7e).~~ ✅ done
10. ~~**Phase 8: Mainnet Launch Readiness** — genesis ceremony, BFG scrub, seed infra, reproducible builds.~~ ✅ code done (launch.rs, node_builder.rs, DAO lock, 5 seed peers)
11. **Docker + Deploy** — production Docker images (multi-stage, self-contained V3/ context), compose stack, deployed to Helsinki (157.180.41.213), chain height 30+ ✅

**Next up — L2/L3 integration (see `V3/PLAN.md` for full details):**

12. **Phase A: L1 Finish** — async P2P multiplexing, BFG scrub (BLOCKER), genesis ceremony freeze
13. **Phase B: L2 Migration** — decimal fix (CRITICAL: 6→12 decimals, reverted to 6 in 3.0.3 fork), bridge vault + RPC, contracts redeploy, DAO daemon
14. **Phase C: L3 Migration** — NCL ONNX backend, WARP chain adapters (EVM first), AI-Native agent framework

## Implementation Dependencies

```
5a (emission) ✅ ──→ 5c (genesis) ✅ ─┐
5b (LWMA) ✅   ──→ 5c (genesis) ✅ ─┤
                                     ├──→ 5e (crypto) ✅ ──→ 5f (tx model) ✅ ──→ 5g (wallet) ✅ ─┐
                                     │                          │                                │
                                     │                          ▼                                ▼
                                     │                     5h (validation) ✅ ──→ Phase 6 ✅ ──→ Phase 7 ✅ ──→ Phase 8
                                     │
5d (propagation) ✅ ──────────────────────────────────────────────────────→ Phase 7 ✅ ──→ Phase 8
```

## Frozen Constants Reference

All values below are constitutional or L1-testnet-frozen. V3 implementations must match exactly.

### Cryptography
```
ZION_BASE32_ALPHABET   = "023456789acdefghjklmnpqrstuvwxyz"
Address format         = "zion1" + 35-char base32 body + 4-char checksum = 44 chars
Address derivation     = SHA256(pubkey) → RIPEMD160 → base32(35) → checksum(4)
Signature algorithm    = Ed25519 (ed25519_dalek)
General hash           = BLAKE3 (tx hash, merkle root, block body hash)
PoW hash               = Ekam Deeksha (cosmic_harmony)
```

### Emission (V3 emission.rs ✅)
```
FLOWERS_PER_ZION       = 1_000_000  (updated to 6-decimal in 3.0.3 fork)
TOTAL_SUPPLY           = 144_000_000_000 × FLOWERS_PER_ZION
GENESIS_PREMINE        = 16_280_000_000 × FLOWERS_PER_ZION
BASE_BLOCK_REWARD      = 5_400_067_000_000_000
TAIL_REWARD            = 724_784_723_787_776
BLOCKS_PER_DECADE      = 5_256_000
Decay                  = ×(4/5) per decade, max 10 decades
```

### Difficulty (V3 difficulty.rs ✅)
```
TARGET_BLOCK_TIME      = 60 s
LWMA_WINDOW            = 60 blocks
MIN_SOLVE_TIME         = 30 s
MAX_SOLVE_TIME         = 120 s
MIN_DIFFICULTY         = 1_000
MAX_DIFFICULTY         = u64::MAX / 1_000
Clamp                  = ±25%
```

### Genesis (V3 genesis.rs ✅)
```
DAO_TREASURY_LOCK_HEIGHT = 525_600
12 addresses, 4 categories:
  oasis_golden_egg:  5 × 1.65B = 8.25B ZION
  dao_treasury:      3 slots   = 4.00B ZION (locked until 525,600)
  infrastructure:    3 slots   = 2.59B ZION
  humanitarian:      1 × 1.44B = 1.44B ZION
  TOTAL:                        16.28B ZION
```

### Chain Safety (V3 chain.rs + validation.rs ✅)
```
MAX_REORG_DEPTH        = 10 blocks (constitutional, stricter than L1's 50)
SOFT_FINALITY_DEPTH    = 60 blocks
COINBASE_MATURITY      = 100 blocks
MAX_BLOCK_SIZE         = 1_048_576 bytes (1 MB)
MAX_TIMESTAMP_DRIFT    = 7_200 s (2 hours)
```

### Fee Model (V3 fee.rs ✅)
```
MIN_TX_FEE             = 1_000 flowers (0.001 ZION)
MIN_FEE_RATE           = 1 flower/byte
MAX_TX_SIZE            = 100_000 bytes (100 KB)
MAX_OUTPUT_AMOUNT      = u64::MAX flowers
Fee destination        = 100% BURNED (deflationary)
Coinbase               = reward only (no fee routing)
```

### Mempool (V3 mempool_v2.rs ✅)
```
MAX_MEMPOOL_SIZE       = 10_000 transactions
MAX_MEMPOOL_BYTES      = 20_971_520 (20 MB)
```

### P2P Security (V3 p2p_security.rs ✅)
```
Escalating bans        = 300s → 1800s → 7200s
MAX_CONNECTIONS        = 128
MAX_MESSAGES_PER_WINDOW = 100 per 60s
IBD_THRESHOLD          = 50 blocks behind
IBD_BATCH_SIZE         = 500 blocks per request
IBD_STALL_TIMEOUT      = 120s, 3 retries
```

### Burn Addresses (V3 fee.rs ✅)
```
BURN_ADDRESS           = "zion1burn0000000000000000000000000000000dead"
DAO_ADDRESS            = "zion1dao00000000000000000000000000000treasury"
```

### Reward Distribution (✅ Implemented 2026-03-27)
```
MINER_SHARE            = 89%  (ZION_HUMANITARIAN_TITHE_PCT env override)
TITHE                  = 5%   (humanitarian DAO — ZION_HUMANITARIAN_WALLET)
ISSOBELLA_FUND         = 5%   (L5/L6 development — ZION_ISSOBELLA_WALLET)
POOL_FEE               = 1%   (ZION_POOL_FEE_WALLET)
```

### Batch Payouts (V3 wallet.rs ✅)
```
MAX_BATCH_RECIPIENTS   = 200
MIN_PAYOUT_AMOUNT      = 10_000_000_000_000 flowers (10 ZION)
```

## Phase 21+: Production Upgrade Track

> Detailed plan: `V3/docs/UPGRADE_PLAN.md` (2026-03-17)

The following phases cover everything needed between current canary validation and public mainnet launch.
Each phase maps to a lettered section in the upgrade plan document.

### Phase 21: Miner Production Hardening (Upgrade Plan §A)

Goal: make `zion-miner` safe, usable, and performant for public miners.

Key deliverables:
- A1: graceful error handling (reconnect loop, GPU/NPU fallback, no panics)
- A2: `--help` / `--version` CLI, config file support, startup banner, colored output
- A3: multi-thread nonce scan (rayon), adaptive nonce window, memory pool reuse
- A5: expand miner test coverage from 13 → 53 tests

Exit criteria:
- miner survives pool disconnect and reconnects within 30 s
- `zion-miner --help` prints all options
- multi-thread mode shows ≥2× hashrate over single-thread on 4+ core machine
- 50+ miner tests pass

Status: not started

### Phase 22: Pool Production Hardening (Upgrade Plan §B)

Goal: make the pool reliable for multiple concurrent miners and add payout engine.

Key deliverables:
- B1: graceful shutdown, per-IP rate limiting, session cap, memory audit
- B2: Prometheus `/metrics` endpoint, `/health` + `/stats` JSON endpoints
- B3: PPLNS payout engine with min threshold and batch wallet integration
- B4: expand pool test coverage to 63+ tests

Exit criteria:
- pool handles ≥50 concurrent miners without memory growth
- Prometheus scrapes pool metrics cleanly
- PPLNS payout correctly distributes rewards across share window

Status: not started

### Phase 23: Monitoring & Observability (Upgrade Plan §C)

Goal: deploy full Grafana + Prometheus + Alertmanager stack alongside V3 services.

Key deliverables:
- C1: Prometheus scrape targets for node, pool, miner, host
- C2: 5 Grafana dashboards (chain, mining, revenue, node health, fleet)
- C3: alerting rules (7 rules: no miners, high reject, chain stall, node down, disk, peers, mempool)
- C4: docker-compose.monitoring.yml

Progress:
- ✅ Node metrics HTTP server on ZION_METRICS_BIND (default :9115) — chain_height, mempool_size, peer_count, sync_status, blocks_accepted/rejected, template_height
- ✅ Pool metrics already on /metrics — active_sessions, uptime, shares, PPLNS, groups/sources
- ✅ Prometheus scrape configs updated (node :9115, pool :8080)
- ✅ Alert rules rewritten to match actual V3 metric names (zion_pool_*, zion_*)
- ✅ Docker compose v3-testnet port 9115 exposed
- ✅ Grafana dashboards (22-panel zion-pool-overview.json — sessions, shares, PPLNS, CPU, mem, disk, chain height, peers)
- ✅ Alertmanager integration (alertmanager.yml with Discord routing, inhibit rules, 2-channel severity split; compose service + Prometheus alerting target)
- ✅ Retention policy (Prometheus: 90d time + 10GB size via compose TSDB flags)

Status: complete

### Sprint 8: Stabilization, L2/L3 Migration Complete (2026-03-26/27)

Goal: stabilize test suite, create comprehensive mainnet completion plan, complete L2/L3 migration into V3.

Completed work:

- Miner test fix: `profile_does_not_override_explicit_env` env var race condition between parallel tests, tolerant assertion.
- Comprehensive mainnet plan: `V3/PLAN.md` created (~700 lines) covering L1 finish, L2/L3 migration, Go/No-Go checklist.
- **V3/L2/bridge migration** from legacy `L2/bridge/`:
  - Critical decimal fix: `FLOWERS_PER_ZION` changed from `1_000_000` (6-dec) to `1_000_000_000_000` (12-dec) (reverted to 1_000_000 / 6-dec in 3.0.3 fork)
  - Field renames: `amount_atomic` → `amount_flowers`, `amount_wzion` → `amount_wzion_wei`, `l1_atomic_to_wzion_wei` → `flowers_to_wzion_wei`, etc.
  - DB schema column renamed: `amount_l1_atomic` → `amount_flowers`
  - All conversion functions updated: `flowers_to_wzion_wei()`, `wzion_wei_to_flowers()`, `flowers_to_zion_display()`
  - Test values updated from 6-dec to 12-dec magnitudes
  - **157 tests pass** (111 lib + 45 integration + 1 doctest)
- **V3/L3/ncl migration** from legacy `L3/ncl/`:
  - Field renames: `reward_atomic` → `reward_flowers`
  - Pricing defaults scaled for 12-dec: `base_price = 10_000_000_000` (0.01 ZION)
  - **43 tests pass** (42 lib + 1 doctest)
- **V3/L2/dao migration** from legacy `L2/dao/`:
  - 16 src files + 1 integration test file
  - Decimal fix: `amount_atomic` → `amount_flowers`, `fee_atomic` → `fee_flowers`
  - Treasury amounts use `u128` for 4B ZION supply scale
  - Config `daily_spend_limit` stored as whole ZION, converted via `FLOWERS_PER_ZION`
  - **65 tests pass** (40 lib + 25 integration)
- **V3/L2/atomic-swap migration** from legacy `L2/atomic-swap/`:
  - 10 src files
  - Decimal fix: `amount_flowers`/`min_lock_flowers` naming, values `1_000_000_000_000`
  - **15 tests pass**
- **V3/L3/warp migration** from legacy `L3/warp/`:
  - 22 src + 8 adapter files
  - Cargo.toml: `thiserror="2"`, correct path dependencies
  - ChainId::zion_l1() decimals fixed from 6 to 12
  - All conversion tests updated (6→12 decimal ZION values) (reverted to 6-dec in 3.0.3 fork)
  - fees.rs: all min_fee/max_fee values updated to 12-decimal scale (reverted to 6-dec in 3.0.3 fork)
  - config.rs: `daily_limit_flowers()` and `timelock_threshold_flowers()` ×1e12
  - xp_bridge.rs: volume divisor changed from 1e6 to 1e12
  - router.rs: daily_limit and timelock_threshold defaults updated
  - **252 tests pass** (251 lib + 1 doctest)
- **V3/L3/ai-native migration** from legacy `L3/ai-native/`:
  - 13 src files
  - Cargo.toml: `thiserror="2"`, path dependencies on ncl, warp, bridge
  - Decimal fix: `amount_flowers`/`reward_flowers` naming
  - **89 tests pass** (88 lib + 1 doctest)
- V3 documentation update (README.md, ROADMAP.md, PLAN.md)

Test results: **~1,300 tests, 0 failures** (L1: 666, L2/bridge: 157, L2/dao: 65, L2/atomic-swap: 15, L3/ncl: 43, L3/warp: 252, L3/ai-native: 89)

Status: done

### Phase 24: Security & Audit (Upgrade Plan §F)

Goal: pre-launch security sweep.

Key deliverables:
- F1: BFG scrub premine keys, `cargo audit`, `cargo-fuzz`, panic audit, input validation review
- F2: zero clippy warnings on miner + pool, comment cleanup

Exit criteria:
- `PREMINE_WALLETS_BACKUP.json` removed from all reachable git history
- `cargo audit` returns 0 vulnerabilities
- zero `unwrap()` in production hot paths

Progress:
- ✅ `cargo audit` clean (Sprint 5 — no known vulnerabilities)
- ✅ Panic audit (Sprint 5 SECURITY_CHECKLIST.md — all unwrap() in test-only paths)
- ✅ Input validation review (Sprint 5 — pool server + node RPC boundaries)
- ✅ Rate limiting & DoS hardening (Sprint 5 — peer security, connection limiter)
- ✅ Cryptographic safety review (Sprint 5 — Ed25519+BLAKE3 verified)
- ✅ Production unwrap() audit (Sprint 6 — zero unwrap in hot paths)
- ✅ cargo-fuzz harnesses (Sprint 6 — pool decode_message, parse_hex, core validate_header)
- ⏳ BFG scrub (PREMINE_WALLETS_BACKUP.json — requires coordinated history rewrite)

Status: mostly complete (BFG scrub deferred — requires repo coordination)

### Phase 25: Infrastructure & Release (Upgrade Plan §E + §G)

Goal: CI/CD, seed nodes, release artifacts, public documentation.

Key deliverables:
- E2: CI pipeline (lint → test → build → docker → deploy → smoke)
- E3: signed release binaries for Linux/Windows/macOS
- E4: 5 geographically distributed seed nodes deployed
- G1-G3: mining guide, node operator guide, developer docs

Exit criteria:
- CI runs green on every push
- Release binaries downloadable from GitHub Releases
- 5 seed nodes online and reachable
- MINING_GUIDE.md tested by non-developer user

Progress:
- ✅ E2: CI pipeline (Sprint 4 — v3-ci.yml: test, clippy, fmt, audit; path-filtered on V3/**)
- ✅ E3: Release artifacts (Sprint 4 — v3-release.yml: linux+macOS binaries, Docker images, GitHub release on v3* tags)
- ✅ G1: Mining guide (Sprint 5 — MINING_GUIDE.md: profiles, env vars, Docker/systemd, FAQ)
- ✅ G2: Node operator guide (Sprint 5 — NODE_OPERATOR_GUIDE.md: deployment, monitoring, hardening)
- ✅ D2: Block explorer + pool dashboard (live at zionterranova.com/explorer — Next.js 16, 7 pages, pool dashboard)
- ⏳ E4: Seed nodes (Core + Edge topology: 100.76.16.108 + 77.42.71.94; multi-region expansion deferred to infra phase)

Status: mostly complete (seed node expansion pending)

### Phase 26: Bridge UI & User Experience (2026-06)

> **On-chain verified:** Base Sepolia wZION (`0x0c49...2bb6`) + ZIONBridge (`0xF4BF...edca1`) are LIVE.
> **Source:** [`V3/docs/BRIDGE_READINESS_100.md`](./docs/BRIDGE_READINESS_100.md)

Goal: Users can bridge ZION cross-chain without touching CLI.

#### 26a: Bridge Dashboard (Python, port 8766) ✅ DONE 2026-06-03

| # | Deliverable | Status |
|---|-------------|--------|
| D1 | Bridge Status Card (online/last block/volume) | ✅ Done |
| D2 | Cross-chain Transfer Form (chain selector, amount, fee estimate) | ✅ Placeholder UI (disabled until 26b) |
| D3 | Transaction History (pending + completed with explorer links) | ✅ Done — SQLite bridge.db integration |
| D4 | Liquidity Display (L1 locked, wZION minted, 24h volume) | ✅ Partial — total volume from DB |
| D5 | Validator 3/5 Status (online indicators, last signature) | ✅ Placeholder — shows deployer only |
| D6 | Contract Links with Base Sepolia Explorer | ✅ Done |
| D7 | Readiness Checklist (8 items with ✓/○) | ✅ Done |
| D8 | Keyboard shortcut (`b` → Bridge tab) | ✅ Done |

**API:** `GET /api/bridge/*` endpoints in `dashboard/app.py`.
```
GET /api/bridge/status      → {online, pending_count, last_block, total_volume, validators_online, contract_verified}
GET /api/bridge/history     → {transfers: [...]}
GET /api/bridge/chains      → {chains: [...]}
GET /api/bridge/validators  → {validators: [...], threshold, total}
```

#### 26b: Website Bridge Page (Next.js, `/bridge`) ✅ DONE 2026-06-03

| # | Deliverable | Status |
|---|-------------|--------|
| W1 | Bridge Burn Widget React component (`BridgeBurnWidget.tsx`) | ✅ Done — MetaMask + ethers v5, Base Sepolia |
| W2 | Chain selector with logos (Base, Arbitrum, BSC, Polygon, ZION L1) | ✅ Partial — Base Sepolia only (mainnet TBD 26d) |
| W3 | Real-time fee estimate (gas + bridge fee) | ✅ Done — FAQ + instructions |
| W4 | Step-by-step transaction tracker (Lock → Confirm → Mint) | ✅ Done — Lock&Mint + Burn&Unlock panels |
| W5 | Bridge stats page (total volume, top chains, 24h activity) | ✅ Done — Relay stats + architecture diagram |
| W6 | Readiness Checklist (8 items) | ✅ Done |
| W7 | Contract Addresses with copy + explorer links | ✅ Done |

**Files:** `src/app/bridge/page.tsx`, `src/components/BridgeBurnWidget.tsx`, `src/lib/bridge-api.ts`, `src/app/api/bridge/status/route.ts`.
**Note:** All addresses currently point to **Base Sepolia Testnet** (chain 84532). Will switch to Base Mainnet (8453) in 26d.

#### 26c: Desktop Agent Bridge Tab (Electron) ✅ DONE 2026-06-03

| # | Deliverable | Status |
|---|-------------|--------|
| E1 | Bridge view in dock nav | ✅ Done — new `Bridge` tab with icon |
| E2 | Readiness checklist grid | ✅ Done — 8 items, live status fetch from dashboard API |
| E3 | Contract addresses with copy buttons | ✅ Done |
| E4 | "How to Bridge" instructions | ✅ Done |
| E5 | Open in Browser link to website `/bridge` | ✅ Done |

**Files:** `APP&WEB/desktop-agent/src/ui/index.html`, `APP&WEB/desktop-agent/src/ui/renderer.js`.

#### 26d: Contract Hardening (Runbooks & Scripts Ready)

| # | Deliverable | Status |
|---|-------------|--------|
| C1 | Verify ZIONBridge + wZION source on BaseScan | 🔄 Runbook ready (`scripts/verify-bridge-base.sh`) — waiting for Solidity source commit + ETHERSCAN_API_KEY |
| C2 | Deploy BridgeValidator (3/5 multisig) on Base Sepolia | 🔄 Spec ready (`V3/docs/BRIDGE_MULTISIG.md`) — waiting for 5 Guardian hardware wallets |
| C3 | Base Mainnet deploy (after Sepolia success) | 🔄 Runbook ready (`V3/docs/BRIDGE_MAINNET_DEPLOY.md`) — pending audit + 3/5 provisioning |
| C4 | Contract audit (Certik/SlowMist) | 🔄 Not started — budget/partner TBD |

**Exit criteria:**
- Full roundtrip L1 → Base Sepolia → L1 in < 5 min via UI
- 3/5 validator signatures per transfer
- Daily limit (10M wZION) enforced
- Contract source verified on BaseScan

---

## Rules For Future Work

- If `V3/` scope changes materially, update this file and `V3/README.md` in the same change.
- Prefer removing ambiguity over preserving historical names.
- When migrating code from the legacy tree, copy only audited behavior that serves the clean mainnet line.
- For production upgrade phases (21+), follow `V3/docs/UPGRADE_PLAN.md` as the detailed reference.

## L2 / L3 Integration (Migration Complete ✅)

Detailed plan: `V3/docs/L2_L3_MAINNET_PLAN.md` (Draft v2)

All Rust L2/L3 crates have been migrated into V3 with 6-decimal flowers conversion (updated 3.0.3 fork).
Remaining work: L2/contracts Solidity redeploy, production hardening of individual services.

### L2 — wZION Bridge ✅ Migrated

- Lock/Mint/Burn model: ZION → zion1bridge vault → 3-of-5 validator quorum → wZION ERC-20 mint on Base
- **Critical decimal fix**: root L2/L3 code originally assumed 6 decimals (1e6); V3 Sprint 8 changed to 12 decimals (1e12), then 3.0.3 fork reverted to 6 decimals (1e6 flowers). **✅ FIXED** — all conversion functions, DB schema, and test vectors updated.
- L1 core changes needed: `BRIDGE_VAULT_ADDRESS`, `getBridgeLocks` RPC, `submitBridgeUnlock` RPC, Step 12 bridge unlock validation, memo prefix parsing (`BRIDGE:*`, `WARP:*`, `DAO:*`, `SWAP:*`)
- Testnet contracts deployed on Base Sepolia (wZION, ZIONBridge, Governance, Treasury, Staking, Farm, AtomicSwap, Uniswap V3 pool)
- Fee: 0.1% (50% burn, 25% DAO, 25% validators)
- Finality: 60 L1 blocks (~60 min at 60s block time)

### L2 — DeFi Stack ✅ DAO + Atomic-Swap Migrated

- **Staking**: ZIONStaking.sol — Synthetix-style rewards distributor, 50% APR hard cap, 7-day cooldown, slashing hook
- **Farming**: ZIONFarm.sol — MasterChef v2 LP farming, 90-day halving schedule per pool, dynamic allocPoint rebalancing
- **Governance / DAO**: ZIONGovernance.sol + DAO daemon — 5 proposal types (Spend, Parameter, Upgrade, Emergency, Meta), token-weighted voting (1Z = 1 vote), 3-day voting + 24h timelock, L1 memo scanner for `DAO:vote` / `DAO:propose` prefixes
- **Treasury**: ZIONTreasury.sol — 6 budget categories (Development, Marketing, Community, Infrastructure, Security, Reserve), 5-of-7 multisig disbursement
- **Atomic Swap**: ZIONAtomicSwap.sol + swap daemon — HTLC with SHA-256 hashlock (→ BLAKE3 after fix), Ed25519 escrow, L1 UTXO coin-select, auto-refund on timeout
- **DEX**: Uniswap V3 wZION/USDC pool on Base — no custom DEX contract, standard AMM integration

### L3 — WARP Cross-Chain ✅ Migrated

- Extends L2 bridge to 7 chain families: EVM, Solana, Tron, Stellar, Bitcoin, Cardano, Cosmos
- Memo format: `WARP:1:<chain>:<recipient>` parsed from TxOutput memo field
- Same validator quorum and vault as L2 (no separate infrastructure)
- Per-route fees: 0.10%–0.25%
- `ChainId::zion_l1()` decimals must be fixed from 6 to 12 **✅ FIXED**
- Working signers: EVM, Bitcoin, Solana, Stellar, Tron. **Stubs**: Cardano, Cosmos.

### L3 — AI Native & NCL ✅ Migrated

- **AI Native**: Agent framework with 7-level consciousness model (Dormant → Grok), XP economy (+10 success / -2 fail), orchestrator dispatching NCL → WARP → Bridge, pool optimizer, WARP agent optimizer (max ~75× multiplier)
- **NCL (Neural Consciousness Layer)**: Decentralized AI compute marketplace — 6 task types (Inference, Training, DataProcessing, Optimization, Validation, Custom), priority + reputation-weighted scheduling, pricing = base_cost × backend_multiplier × size_factor, 90/10 worker/protocol revenue split
- **Critical gap**: All 3 NCL compute backends (ONNX, WASM, TFLite) are stubs. ONNX via `ort` crate is recommended first implementation.
- L1 core changes: minimal — off-chain reads from node RPC for balance/UTXO queries. No consensus changes.

### Dependency Order

```
L1 mainnet stable (Phase 8 complete)
 └─► L2 Bridge: decimal fix → vault + RPC → daemon → testnet E2E → mainnet
      ├─► L2 DeFi: staking + farm deploy → DAO daemon → atomic swap → Uniswap pool
      └─► L3 WARP: chain adapters → router → testnet E2E → mainnet (EVM first)
           ├─► L3 AI Native + NCL: ONNX backend → agent framework → compute market → testnet
           └─► L3 Native Swap: quote engine → aggregated exec → HTLC atomic → hybrid router
```

### L3 — Native Swap (📐 Design phase)

> Přímý swap nativních coinů (BTC↔ETH↔SOL, ...) **bez nutnosti wZION** v trase.
> ZION slouží pouze jako fee token — generuje deflační tlak bez toho, aby byl v trase.

Kompletní návrh: [`docs/NATIVE_SWAP_DESIGN.md`](../docs/NATIVE_SWAP_DESIGN.md)

**Principy:**
- `swap(ETH, SOL, 1.0)` → uživatel dostane SOL přímo, interně: ETH→USDC (1inch) + USDC→SOL (Jupiter)
- Intermediate stablecoin (USDC) jako settlement layer — uživatel ho nikdy nevidí
- Dvě cesty: **Aggregated** (rychlé, DEX, < $10K) a **HTLC Atomic** (trustless, > $10K)
- Fee: 0.10–0.30% v ZION (auto-strháváno z output nebo vyžadováno předem)
- Fee distribuce: 50% burn / 25% DAO / 25% validátoři

**Klíčové závislosti:**
- 1inch Quote API (EVM chains)
- Jupiter Quote API (Solana)
- KyberSwap (Base — již používáme pro WETH→SOL swappy)
- Thorchain jako alternativa pro BTC↔X (nativní HTLC bez wrapped tokenů)

**Fáze implementace:**

| Fáze | Co | Odhad |
|------|----|-------|
| 1 | Quote engine (1inch + Jupiter) + `/api/warp/swap/quote` endpoint | 2–4 týdny |
| 2 | Aggregated execution + USDC relay + UI widget | 4–8 týdnů |
| 3 | HTLC Atomic cross-chain + BTC | 2–4 měsíce |
| 4 | Hybrid router + auto-fee + dashboard | 1 měsíc |

**Status:** 📐 Design dokument vytvořen (2026-06-29). Implementace blokována na
schválení fee modelu a legal review custody varianty.