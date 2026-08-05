# Session Report — 2026-06-02

**Focus:** Fee split burn fix + difficulty-weighted PPLNS + payout deferral fix  
**Author:** Devin (AI agent) + operator review  
**Commits:** `73bb91a0`, `2070de90`, `a8b4652e`, `f0afcdac`, `a012db70`

---

## 1) Burn Model — Stop Double Fee Split

### Problem
Core node and pool independently performed the 89/5/5/1 fee split:
1. Node `build_template` created **4 coinbase outputs** (89% miner, 5% hum, 5% iss, 1% pool fee).
2. Pool `compute_payouts` **re-deducted** 5/5/1 from miner share and accumulated those fees internally.
3. Pool `execute_fee_payout` **paid those accumulated fees a second time** from pool wallet.

**Result:** Humanitarian, Issobella, and Pool Fee received ~2× their intended share. Miners got only ~79% instead of 89%.

### Fix

**Core (`V3/L1/core/src/lib.rs`):**
- `build_template` now creates **3 coinbase outputs** (miner/humanitarian/issobella). The 1% pool fee slot is **never minted** (burned).
- Block import validation accepts `coinbase_count == 3` and `expected_block_miner_reward` based on `minted_subsidy()`.

**Pool (`V3/L1/pool/src/pplns.rs`):**
- New `compute_miner_payouts(miner_reward_flowers)` distributes the **pre-split** miner reward (89%) to workers **without** deducting fees again.
- `distribute_to_miners()` extracted as shared distribution logic.

**Pool server (`V3/L1/pool/src/bin/server.rs`):**
- Block-found handler calls `compute_miner_payouts(miner_share)` instead of `compute_payouts()`.
- Removed entire `execute_fee_payout` block (second fee payment).

**Dashboard (`dashboard/app.py`, `dashboard.html`, `dashboard.js`):**
- Added `burned_total` to `build_payout_status()`.
- Fee split label normalized to `"89/5/5 (+1% burned)"`.
- Replaced "Pool Fee" card with "Burned (1%)" card.

**Launch scripts (`scripts/launch-stack.sh`):**
- Removed `ZION_POOL_FEE_WALLET` from node and pool env.
- Added CPU miner (`zion1q044...`) and GPU miner (`zion100y...`) with explicit payout addresses.

### Emission Impact

| Metric | Value |
|---|---|
| Total supply | 144,000,000,000 ZION |
| Genesis premine | 16,280,000,000 ZION |
| Mining emission (100%) | 127,720,000,000 ZION |
| **Mining emission (99% minted)** | **126,442,800,000 ZION** |
| **Total burned** | **1,277,200,000 ZION** |
| **Max circulating supply** | **142,722,800,000 ZION** |
| Effective supply reduction | 0.8869% |

### Live Verification

**Coinbase at height 126:**
```json
{
  "transactions": [
    {"from":"coinbase","to":"miner","amount_zion":"4806059630000000"},
    {"from":"coinbase","to":"humanitarian","amount_zion":"270003350000000"},
    {"from":"coinbase","to":"issobella","amount_zion":"270003350000000"}
  ],
  "pool_fee_address": ""
}
```
- 3 outputs ✅, pool fee empty (burn) ✅

---

## 2) Payout Deferral Fix on Fresh Chain

### Problem
Pool wallet receives exactly 89% of each block subsidy. Account-model payout transactions require `MIN_TX_FEE = 1000 flowers` per recipient. Old code computed:
```
total_needed = sum(payouts) + num_recipients * MIN_TX_FEE
```
This exceeded wallet balance, causing **infinite deferral** on a fresh chain (no accumulated buffer).

### Fix (`V3/L1/pool/src/bin/server.rs`)
- `net_amount = payout.amount - MIN_TX_FEE` deducted from each miner payout.
- `total_needed = sum(payouts) = wallet balance`.
- Payouts succeed immediately without external buffer.

### Live Verification
```
payout_account_model height=126 recipients=2 wallet=... tx_id=...
payout_submitted height=126 miners=2 deferred=0
```
- No deferral ✅, 2 recipients (CPU + GPU) ✅

---

## 3) Difficulty-Weighted PPLNS Window

### Problem
PPLNS window was measured in **raw share count**. GPU share (diff=4096) occupied **1 slot** just like CPU share (diff=1024). GPU window rotated ~4× faster, diluting GPU payout.

**Live evidence (before fix):**
```
GPU hashrate ~9952 H/s, payout ratio per H/s = 1.36×10^12 flowers
CPU hashrate ~1224 H/s, payout ratio per H/s = 4.72×10^12 flowers
CPU got ~4× more per unit hashrate.
```

### Fix (`V3/L1/pool/src/pplns.rs`)
- Window measured in **work units** (sum of share difficulties), not raw count.
- Diff-4096 share consumes 4096 window units. Diff-1024 share consumes 1024 units.
- Default `window_size` increased from 1,000 to **50,000** work units.
- New field `window_total_difficulty: u128` tracks window weight for eviction.
- Updated `server.rs` default env from 1,000 to 50,000.
- Updated test `default_config_uses_core_constants`.

### Live Verification (after fix)
```
GPU payout ratio = 1,357,585,443,715 flowers/H/s
CPU payout ratio = 1,346,723,798,394 flowers/H/s
Deviation = 0.8%
```
- Payout per unit hashrate is now equal across all miners ✅

### Unit Test (`ten_miners_payout_ratio_is_fair`)
Simulates 10 miners with hashrates 100..1000 (difficulty proportional to hashrate). Each submits 100 shares. Verifies:
1. All 10 miners receive payout.
2. Total payout equals block reward exactly (no dust lost).
3. Payout ratio per unit work is identical across all miners (<0.1% deviation).

**Result:** 65 pool tests passed, 0 failed.

---

## 4) Deployment Checklist

### Build
```bash
cargo build --release --manifest-path V3/Cargo.toml \
  -p zion-core -p zion-pool -p zion-miner
```

### Node
```bash
export ZION_MINER_ADDRESS='zion182e2v4x4r3u2j5r5t305k0d5y643q6l3n6je5f8'
export ZION_HUMANITARIAN_WALLET='zion1m4v5z8z850u480c5c208z274e334369275n5y20'
export ZION_ISSOBELLA_WALLET='zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702'
# POOL_FEE_WALLET NOT EXPORTED — 1% is burned
```

### Pool
```bash
export ZION_POOL_WALLET='zion182e2v4x4r3u2j5r5t305k0d5y643q6l3n6je5f8'
export ZION_POOL_PAYOUT_SK_HEX='<secret>'
export ZION_HUMANITARIAN_WALLET='...'
export ZION_ISSOBELLA_WALLET='...'
export ZION_PPLNS_WINDOW_SIZE=50000  # adjustable per pool size
```

### Miner
```bash
export ZION_POOL_ADDR='127.0.0.1:8444'
export ZION_MINER_ID='cpu-miner-01'
export ZION_PAYOUT_ADDRESS='zion1q044z2h8q0s742y87428d3q0r638s357h8385w4'
export ZION_WORKER_NAME='cpu-worker1'
```

---

## 5) Files Changed

| File | Change |
|---|---|
| `V3/L1/core/src/lib.rs` | 3-output coinbase (burn 1%), validation |
| `V3/L1/core/src/emission.rs` | `minted_subsidy()`, `burned_subsidy()` helpers |
| `V3/L1/core/src/bin/node.rs` | `pool_fee=burned(1%)` startup log |
| `V3/L1/pool/src/pplns.rs` | Diff-weighted window, `compute_miner_payouts()`, tests |
| `V3/L1/pool/src/bin/server.rs` | `compute_miner_payouts()` call, tx fee deduction, window size default |
| `dashboard/app.py` | `burned_total`, fee split label |
| `dashboard/dashboard.html` | Burned card, fee split breakdown |
| `dashboard/dashboard.js` | Burned total population |
| `scripts/launch-stack.sh` | CPU+GPU miner config, no pool_fee env |
| `V3/docs/FEE_SPLIT_BURN_REPORT_2026-06-02.md` | Burn fix documentation |
