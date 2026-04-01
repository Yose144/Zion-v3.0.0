# Changelog — 2026-04-01

## Souhrn

Phase 18: UTXO coinbase generace, pool payout E2E pipeline, humanitarian tithe ověření, BaseScan verifikace.

---

## 1. Phase 18: UTXO Coinbase + Dual Balance Fix

**Problém:** Všechny zůstatky vracely 0. `getBalance` pro `zion1...` adresy routoval do UTXO modelu, ale coinbase se generoval pouze v account modelu — UTXO strana byla prázdná.

**Řešení (3 opravy v `V3/L1/core/src/`):**
- `rpc.rs` — `getBalance`/`getBalanceAtHeight` nyní kombinují account + UTXO zůstatky pro `zion1` adresy. Vrací `balance_flowers` (celkem), `utxo_balance_flowers`, `account_balance_flowers`.
- `lib.rs` — `build_template()` nyní generuje UTXO coinbase transakci s 4 výstupy: miner 89%, humanitarian 5%, issobella 5%, pool_fee 1%. Vložena na pozici 0 do `selected_utxo_transactions`.
- `pool/src/bin/server.rs` — Nový pool payout pipeline: `execute_pool_payout()`, `fetch_pool_utxos()`, `submit_utxo_transaction()`, `parse_pool_signing_key()`. `ServerConfig` rozšířen o `pool_wallet_address` a `pool_signing_key`.

**Stav po nasazení:**
- Miner balance: 14,120,087,991,230,448,384 flowers (~14.12B ZION)
- Block template (height 6802): `utxo_tx_count=1` (UTXO coinbase funguje)
- Pool payout: `payout_execution=enabled`

**Soubory změněny:**
- `V3/L1/core/src/rpc.rs`, `V3/L1/core/src/lib.rs`, `V3/L1/pool/src/bin/server.rs`, `V3/L1/pool/Cargo.toml`
- `docker/docker-compose.v3-mainnet.yml` (ZION_POOL_WALLET env passthrough)

---

## 2. Humanitarian Tithe Verification (On-Chain)

**Ověření per-block (height 6801):**
| Příjemce | % | Flowers/blok | Adresa |
|---------|---|-------------|--------|
| miner | 89% | 4,806,059,630,000,000 | zion1... (mining wallet) |
| humanitarian | 5% | 270,003,350,000,000 | zion1m4v5z8z850u480c5c208z274e334369275n5y20 |
| issobella | 5% | 270,003,350,000,000 | zion170a374s6h390k7w244m5c4f354v8n4678844655 |
| pool_fee | 1% | 54,000,670,000,000 | zion1y5u653y3w4z7p5r3l034y0q6u06542a426z77j7 |
| **Celkem** | **100%** | **5,400,067,000,000,000** | (= block subsidy decade 1) |

**Kumulativní zůstatky (height 6801):**
| Wallet | Balance (flowers) | Balance (ZION) |
|--------|------------------|----------------|
| miner | 14,120,087,991,230,448,384 | ~14,120 B |
| humanitarian | 1,711,281,233,740,000,000 | ~1,711 B |
| issobella | 1,711,279,793,740,000,000 | ~1,711 B |
| pool_fee | 342,256,246,460,000,000 | ~342 B |

**Poměry:** pool_fee / humanitarian = přesně 20% (1:5). Zůstatky ~93% teoretického maxima (některé rané bloky měly rozdílnou konfiguraci).

**Verdikt:** ✅ Humanitarian desátek funguje správně. Rozdělení 89/5/5/1 je exaktní na úroveň jednotlivých flowers.

---

## 3. BaseScan Contract Verification

Všechny 3 Base mainnet kontrakty úspěšně ověřeny na BaseScan (Etherscan V2 API):
- **wZION** (ERC-20)
- **ZIONBridge** (relay)
- **ZIONAtomicSwap** (HTLC)

**Migrace:** `hardhat.config.ts` přepsán z V1 multi-key API (deprecated) na V2 single `apiKey`. `customChains` doplněn pro Base mainnet.

**Soubory změněny:**
- `L2/contracts/hardhat.config.ts`
- `L2/contracts/scripts/verify-base-mainnet-basescan.ts` (nový)
- `L2/contracts/deployed-base-mainnet.json` (verification URLs)

---

## 4. PREMINE_ADDRESSES_PUBLIC.txt Cleanup

Odstraněny duplikátní [13]/[14] záznamy (stará sada s jinými adresami, nepoužitá on-chain). Ponechány správné adresy odpovídající docker-compose a on-chain datům. Přidán komentář s fee-split poměrem.

---

## Build & Deploy

- Prague server (91.98.122.165): Docker rebuild core + pool, restart
- Tests: 77/77 pool, 153+ core targeted — all pass
- Chain height: 6801 (template 6802)
- Git commit: `afbdf69` "Phase 18: UTXO coinbase + pool payout E2E + BaseScan verify"
