# Fee Split Burn Fix — Kompletní dokumentace

**Datum:** 2026-06-02
**Autor:** Devin (AI agent) + operátor review
**Komponenty:** `zion-core` (node), `zion-pool` (server), dashboard, launch scripts
**Související commity:** `73bb91a0`, `2070de90`

---

## 1) Problém — Root Cause Analysis

### 1.1 Double fee split (critical)

**Core node** i **pool** nezávisle prováděly 89/5/5/1 fee split:

1. **Node** `build_template` vytvářela 4 coinbase výstupy (89% miner, 5% hum, 5% iss, 1% pool fee).
2. **Pool** `compute_payouts` opětovně strhávala 5/5/1 z miner share a akumulovala tyto fee interně.
3. **Pool** `execute_fee_payout` pak platila tyto interní fee znovu z vlastní wallet (druhá platba).

**Výsledek:** Humanitarian, Issobella a Pool Fee dostávaly ~2× víc než měly. Minerům zbývalo jen ~79 % místo 89 %.

### 1.2 Payout deferral na fresh chainu (blocker)

Pool wallet dostává přesně 89 % z každého bloku. Při account-model payoutu každá transakce potřebuje `MIN_TX_FEE = 1000 flowers`. Původní kód počítal:
```
total_needed = sum(payouts) + num_recipients * MIN_TX_FEE
```
Toto přesahovalo zůstatek walletu, což na fresh chainu (bez akumulovaného bufferu) způsobovalo nekonečný deferral — payouty se nikdy nevykonaly.

---

## 2) Řešení — Co bylo změněno

### 2.1 Commit `73bb91a0` — Stop double-charging protocol fees

**Core side (`V3/L1/core/src/lib.rs`)**
- `build_template` vytváří pouze **3 coinbase výstupy** (miner/humanitarian/issobella). 1 % pool fee se vůbec nemintuje.
- Validace importu bloku: `coinbase_count == 3`, `expected_block_miner_reward` používá `minted_subsidy()`.
- `emission.rs`: nové helpery `minted_subsidy()` a `burned_subsidy()`.

**Pool side (`V3/L1/pool/src/pplns.rs`)**
- Nová funkce `compute_miner_payouts(miner_reward_flowers)` — rozděluje **před-split** miner reward (89 %) mezi workery bez dalšího strhávání fee.
- `distribute_to_miners()` extrahována jako shared distribuční logika.

**Pool server (`V3/L1/pool/src/bin/server.rs`)**
- Block-found handler volá `compute_miner_payouts(miner_share)` místo `compute_payouts(miner_share)`.
- Odstraněn celý `execute_fee_payout` blok (druhá platba fees) — fees se už neplatí dvakrát.

**Dashboard (`dashboard/app.py`, `dashboard.html`, `dashboard.js`)**
- Přidáno `burned_total` do `build_payout_status()`.
- Fee split label normalizován na `"89/5/5 (+1% burned)"`.
- V HTML nahrazena "Pool Fee" karta "Burned (1%)" kartou.

**Launch scripts (`scripts/launch-stack.sh`)**
- Odstraněno `ZION_POOL_FEE_WALLET` z node i pool env.
- CPU miner (`zion1q044...`) a GPU miner (`zion100y...`) s explicitními payout adresami.

### 2.2 Commit `2070de90` — Deduct tx fee from miner payouts

**Pool server (`V3/L1/pool/src/bin/server.rs`)**
- V account-model path: `net_amount = payout.amount - MIN_TX_FEE`.
- `total_needed = sum(payouts)` (bez přídavku tx fees).
- Payouty tak probíhají okamžitě, aniž by pool wallet potřebovala externí buffer.

---

## 3) Emise pro mainnet launch

| Parametr | Hodnota |
|---|---|
| Total supply | 144,000,000,000 ZION |
| Genesis premine | 16,780,000,000 ZION |
| Mining emission (100%) | 127,220,000,000 ZION |
| **Mining emission (99% minted)** | **126,442,800,000 ZION** |
| **Total burned** | **1,277,200,000 ZION** |
| **Max circulating supply** | **142,722,800,000 ZION** |
| Effective supply reduction | 0.8869 % z total supply |
| Per-block base burn | ~54.00 ZION |
| Per-block tail burn | ~7.25 ZION |

Burn je **permanentní** — 1 % z každého block subsidy se nikdy nemintuje a je trvale odstraněno z oběhu.

---

## 4) Ověření — Live test výsledky

### 4.1 Coinbase struktura (height 126)

```json
{
  "transactions": [
    {"from":"coinbase","to":"zion182e2v4x4r3u2j5r5t305k0d5y643q6l3n6je5f8","amount_zion":"4806059630000000"},
    {"from":"coinbase","to":"zion1m4v5z8z850u480c5c208z274e334369275n5y20","amount_zion":"270003350000000"},
    {"from":"coinbase","to":"zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702","amount_zion":"270003350000000"}
  ],
  "pool_fee_address": ""
}
```

- **3 výstupy** (miner/humanitarian/issobella) ✅
- **Pool fee address prázdná** (burn) ✅
- `active_template_transactions: 3` ✅

### 4.2 PPLNS payout (height 126)

```
BLOCK_FOUND miner=cpu-worker1 height=126
payout_account_model height=126 recipients=2 wallet=zion182e2v4x4r3u2j5r5t305k0d5y643q6l3n6je5f8 tx_id=07ccb331...
payout_submitted height=126 miners=2 deferred=0 tx_id=07ccb331...
```

- **Žádný deferral** ✅
- **2 recipients** (CPU + GPU miner) ✅
- **Tx fee stržen z minerů** (net_amount = amount - 1000) ✅

### 4.3 Miner on-chain balances

| Miner | Payout Address | Balance (flowers) |
|---|---|---|
| CPU miner | `zion1q044z2h8q0s742y87428d3q0r638s357h8385w4` | 3,193,940,511,921,974 |
| GPU miner | `zion100y03888k3k467t228j0t8r675l8r2t2h00y7a2` | 11,224,238,378,074,026 |

### 4.4 Dashboard

- `fee_split: "89/5/5 (+1% burned)"` ✅
- `pool_fee_wallet: null` ✅
- `burned_total` počítaný z emise ✅

---

## 5) Postup nasazení (deployment checklist)

### 5.1 Build

```bash
cargo build --release --manifest-path V3/Cargo.toml \
  -p zion-core -p zion-pool -p zion-miner
```

Pro GPU mining s OpenCL:
```bash
cargo build --release --manifest-path V3/Cargo.toml \
  -p zion-core -p zion-pool --features gpu-opencl -p zion-miner
```

### 5.2 Node konfigurace

```bash
export ZION_MINER_ADDRESS='zion182e2v4x4r3u2j5r5t305k0d5y643q6l3n6je5f8'
export ZION_HUMANITARIAN_WALLET='zion1m4v5z8z850u480c5c208z274e334369275n5y20'
export ZION_ISSOBELLA_WALLET='zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702'
# POOL_FEE_WALLET se NEEXPORTUJE — 1% je burned
```

### 5.3 Pool konfigurace

```bash
export ZION_POOL_WALLET='zion182e2v4x4r3u2j5r5t305k0d5y643q6l3n6je5f8'
export ZION_POOL_PAYOUT_SK_HEX='<secret>'
export ZION_HUMANITARIAN_WALLET='zion1m4v5z8z850u480c5c208z274e334369275n5y20'
export ZION_ISSOBELLA_WALLET='zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702'
# POOL_FEE_WALLET se NEEXPORTUJE
```

### 5.4 Miner konfigurace

```bash
export ZION_POOL_ADDR='127.0.0.1:8444'
export ZION_MINER_ID='cpu-miner-01'
export ZION_PAYOUT_ADDRESS='zion1q044z2h8q0s742y87428d3q0r638s357h8385w4'
export ZION_WORKER_NAME='cpu-worker1'
```

GPU miner:
```bash
export ZION_POOL_ADDR='127.0.0.1:8444'
export ZION_MINER_ID='gpu-miner-01'
export ZION_PAYOUT_ADDRESS='zion100y03888k3k467t228j0t8r675l8r2t2h00y7a2'
export ZION_WORKER_NAME='gpu-worker1'
export ZION_BACKEND='opencl'
```

---

## 6) Známé omezení a budoucí vylepšení

### 6.1 Aktuální omezení

- Dashboard `burned_total` je odvozen z `blocks_found × 1% subsidy`, ne přímo z chain state.
- Account-model payout posílá jednotlivé transactions místo batch — pro <100 recipients to není problém.
- `looks_like_utxo_address()` zůstává v kódu jako dead code (warning).

### 6.2 Budoucí vylepšení

- Batch account transaction submit (multi-output account tx).
- On-chain proof burn (např. `OP_RETURN` nebo explicitní burn address) místo "never minted".
- Automatická detekce node transaction model (account vs UTXO vs hybrid).
- PPLNS window size konfigurovatelná přes env.

---

## 7) Reference

| Soubor | Účel |
|---|---|
| `V3/L1/core/src/lib.rs` | Node runtime, coinbase generace (3 výstupy), validace |
| `V3/L1/core/src/emission.rs` | `fee_split()`, `minted_subsidy()`, `burned_subsidy()` |
| `V3/L1/core/src/fee.rs` | `MIN_TX_FEE` konstanta (1000 flowers) |
| `V3/L1/pool/src/pplns.rs` | PPLNS engine, `compute_miner_payouts()` |
| `V3/L1/pool/src/bin/server.rs` | Pool server, payout execution, fee dedukce |
| `dashboard/app.py` | Dashboard API, `burned_total`, fee split label |
| `dashboard/dashboard.html` | Burned card, fee split breakdown table |
| `scripts/launch-stack.sh` | Stack launch, CPU+GPU miner config |
