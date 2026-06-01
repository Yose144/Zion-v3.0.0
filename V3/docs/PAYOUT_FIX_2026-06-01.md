# Payout Architecture Fix — Kompletní dokumentace

**Datum:** 2026-06-01  
**Autor:** Devin (AI agent) + operátor review  
**Komponenty:** `zion-core` (node), `zion-pool` (server), `zion-miner`  
**Související commity:** `22fd61ec`, `79f0773a`, `2d3fe597`

---

## 1) Problém — Root Cause Analysis

Pool payout kód byl **striktně UTXO-only**, ale node generuje coinbase rewards jako **account-model transactions** (`Transaction { from: "coinbase", ... }`). Tento mismatch způsobil, že **žádné on-chain payouty nefungovaly** od nasazení account-model coinbase.

### 1.1 Seznam chyb

| # | Chyba | Důsledek |
|---|---|---|
| 1 | Pool `execute_pool_payout` volá jen `getUtxos` | Při prázdném UTXO setu fail s "no spendable UTXOs" |
| 2 | Miner posílá `miner_id` jako payout address | `w11-gpu-miner-01` není validní `zion1...` adresa |
| 3 | `Transaction::validate()` blokuje `zion1...` adresy | Account-model fallback také failuje |
| 4 | Account-model fallback měl `fee_zion: 0` | Node rejectuje "transaction fee must be greater than zero" |
| 5 | Miner a fee payouts používaly stejný `as_secs()` nonce | Duplicitní nonce → "already pending" |

### 1.2 Live důkaz před fixem

```
payout_submit_failed height=75 miners=2
  error=account payout failed for miner w11-gpu-miner-01 (zion1k3k545c4t242j3j0u3w2t4v6h8h8e0n3933r6m4):
  submitAccountTransaction error: transaction endpoints must use account-style wallet ids;
  zion1 UTXO addresses are not accepted by the active runtime
```

---

## 2) Řešení — Co bylo změněno

### 2.1 Commit `22fd61ec` — Account-model fallback pro pool payouts

**Soubor:** `V3/L1/pool/src/bin/server.rs`

Přidal jsem account-model fallback do `execute_pool_payout`. Když `getUtxos` vrátí prázdný seznam:

1. Volá `getBalance` na pool wallet
2. Kontroluje dostatek account balance
3. Posílá jednotlivé account transactions přes `submitAccountTransaction`

Nové funkce:
- `generate_account_tx_id()` — deterministický 64-hex tx_id
- `fetch_pool_account_balance()` — RPC getBalance
- `submit_account_transaction()` — RPC submitAccountTransaction

### 2.2 Commit `79f0773a` — Miner payout address + fee payout fallback

**Soubory:**
- `V3/L1/pool/src/lib.rs` — `PoolMessage::Hello` nové pole `payout_address`
- `V3/L1/miner/src/main.rs` — nový config `payout_address`
- `V3/L1/pool/src/bin/server.rs` — fee payout account-model fallback

Změny:
- Miner posílá `--wallet` / `ZION_PAYOUT_ADDRESS` jako payout address
- Fallback na `miner_id` když není explicitně nastaveno (backward compat)
- Pool registruje `payout_address` v PPLNS místo `miner_id`
- `execute_fee_payout` používá stejný account-model fallback

### 2.3 Commit `2d3fe597` — Node validace + fee/nonce fix

**Soubor:** `V3/L1/core/src/lib.rs`

- Odstraněn `looks_like_utxo_address()` check z `Transaction::validate()`
- Account transactions na `zion1...` adresy jsou nyní povoleny

**Soubor:** `V3/L1/pool/src/bin/server.rs`

- `fee_zion` změněno z `0` na `zion_core::fee::MIN_TX_FEE` (1000 flowers)
- `total_needed` balance check zahrnuje per-transaction fees
- `base_nonce` změněno z `as_secs()` na `as_millis()` — předchází kolizím

---

## 3) Ověření — Live test výsledky

### 3.1 Payout address balance před a po

| Čas | Payout Address Balance | Stav |
|---|---|---|
| Před fixem | `0` | Žádné payouty |
| Po fixu (height 84) | `4277393070701000` flowers (~4.28 ZION) | Payout OK |
| Po fixu (height 86) | Více | Payout + fee OK |

### 3.2 Log výpisy z poolu (po fixu)

```
Height 84:
  payout_account_model height=84 recipients=7 wallet=... tx_id=3332d372...
  payout_submitted height=84 miners=7 deferred=0 tx_id=3332d372...
  fee_payout_failed height=84 ... error=transaction nonce ... already pending

Height 86:
  payout_account_model height=86 recipients=7 wallet=... tx_id=5772e006...
  payout_submitted height=86 miners=7 deferred=0 tx_id=5772e006...
  fee_payout_account_model height=86 recipients=3 wallet=... tx_id=5d1a78af...
  fee_payout_submitted height=86 recipients=3 tx_id=5d1a78af...

Height 87:
  payout_account_model height=87 recipients=7 wallet=... tx_id=ae96e674...
  payout_submitted height=87 miners=7 deferred=0 tx_id=ae96e674...
  fee_payout_account_model height=87 recipients=3 wallet=... tx_id=013cc214...
  fee_payout_submitted height=87 recipients=3 tx_id=013cc214...
```

### 3.3 Fee split struktura

| Příjemce | Procento | Wallet |
|---|---|---|
| Miner (PPLNS) | 89% | `zion182e2v4x4r3u2j5r5t305k0d5y643q6l3n6je5f8` (pool wallet) |
| Humanitarian | 5% | `zion1m4v5z8z850u480c5c208z274e334369275n5y20` |
| Issobella | 5% | `zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702` |
| Pool fee | 1% | `zion1p2a7a5q0t2z5z545y6m6j5e864n002v4z6w95w5` |

Všechny 4 cílové adresy dostávají svůj podíl přes account-model transactions.

---

## 4) Postup nasazení (deployment checklist)

### 4.1 Build

```bash
cargo build --release --manifest-path V3/Cargo.toml -p zion-core -p zion-pool -p zion-miner
```

### 4.2 Node konfigurace

```bash
export ZION_MINER_ADDRESS='zion182e2v4x4r3u2j5r5t305k0d5y643q6l3n6je5f8'
export ZION_HUMANITARIAN_WALLET='zion1m4v5z8z850u480c5c208z274e334369275n5y20'
export ZION_ISSOBELLA_WALLET='zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702'
export ZION_POOL_FEE_WALLET='zion1p2a7a5q0t2z5z545y6m6j5e864n002v4z6w95w5'
```

### 4.3 Pool konfigurace

```bash
export ZION_POOL_WALLET='zion182e2v4x4r3u2j5r5t305k0d5y643q6l3n6je5f8'
export ZION_POOL_PAYOUT_SK_HEX='<secret>'
export ZION_HUMANITARIAN_WALLET='zion1m4v5z8z850u480c5c208z274e334369275n5y20'
export ZION_ISSOBELLA_WALLET='zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702'
export ZION_POOL_FEE_WALLET='zion1p2a7a5q0t2z5z545y6m6j5e864n002v4z6w95w5'
```

### 4.4 Miner konfigurace

```bash
export ZION_POOL_ADDR='127.0.0.1:8444'
export ZION_MINER_ID='w11-gpu-miner-01'
export ZION_PAYOUT_ADDRESS='zion1k3k545c4t242j3j0u3w2t4v6h8h8e0n3933r6m4'
export ZION_WORKER_NAME='worker1'
```

**Důležité:** `ZION_PAYOUT_ADDRESS` musí být validní `zion1...` adresa. Pokud není nastavena, fallbackuje na `ZION_MINER_ID`.

---

## 5) Známé omezení a budoucí vylepšení

### 5.1 Aktuální omezení

- `looks_like_utxo_address()` funkce zůstává v kódu (dead code warning), ale není volána
- Account-model payout posílá jednotlivé transactions místo batch — není to efektivnostní problém pro <100 recipients

### 5.2 Budoucí vylepšení

- Batch account transaction submit (node by musel podporovat multi-output account tx)
- UTXO-based payout path pro pooly, které preferují UTXO model
- Automatická detekce node transaction model (account vs UTXO vs hybrid)

---

## 6) Reference

| Soubor | Účel |
|---|---|
| `V3/L1/core/src/lib.rs` | Node runtime, `Transaction::validate()`, coinbase generace |
| `V3/L1/core/src/rpc.rs` | RPC router, `submitAccountTransaction` handler |
| `V3/L1/pool/src/bin/server.rs` | Pool server, payout execution, fee payout |
| `V3/L1/pool/src/lib.rs` | `PoolMessage::Hello` wire protocol |
| `V3/L1/miner/src/main.rs` | Miner config, payout address, `--wallet` CLI arg |
| `V3/L1/core/src/fee.rs` | `MIN_TX_FEE` konstanta (1000 flowers) |
| `V3/L1/core/src/emission.rs` | `fee_split()` — 89/5/5/1 rozdělení |
| `V3/L1/pool/src/pplns.rs` | PPLNS engine, `FeeConfig`, `compute_payouts()` |
