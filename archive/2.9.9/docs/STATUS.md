# ZION V3 — Status Report 2026-04-07

## Stack Status

| Component | Status | Location |
|-----------|--------|----------|
| Core node (v3) | ✅ Running | Prague 91.98.122.165 |
| Pool (PPLNS) | ✅ Running | Prague 91.98.122.165 |
| Miner (CPU) | ✅ Mining | Prague 91.98.122.165 |
| Seed node | ✅ Running | Prague 91.98.122.165 |
| Prometheus + Grafana | ✅ Running | Prague 91.98.122.165 |
| Desktop Agent (Electron) | ✅ Packaged | APP&WEB/desktop-agent |
| Website | ✅ Live | APP&WEB/website-v2.9 |

## Chain State

- **Genesis reset**: Clean block #0, fresh chain data
- **Premine**: 16,780,000,000 ZION across 12 outputs — verified correct
- **Fee split**: 89% miner / 5% humanitarian / 5% issobella / 1% pool — verified
- **Fee policy**: 100% burn (miners do NOT receive tx fees)
- **Algorithm**: Ekam Deeksha v2 (6-stage pipeline, 256 KiB scratchpad)
- **Server**: Prague-only (USA + Singapore removed)

## Recent Fixes (this session)

### 1. Pool payout budget-cap fallback
- **Problem**: Pool payout attempted full amount every block, failed with `insufficient funds`
- **Fix**: Budget-capped proportional scaling when wallet balance < payout total
- **Commit**: 779ed80f

### 2. Stack trimmed to Prague-only
- USA (5.78.194.94) and Singapore (5.223.84.191) removed from 13+ files
- All peer/seed references now point to Prague 91.98.122.165

### 3. Critical premine u128 bug
- **Problem**: `Transaction.amount_zion` was `u64` — overflows for premine amounts (1.65B ZION × 10¹² flowers > u64::MAX)
- **Fix**: Widened to `u128` with custom `serde_u128` module; genesis uses `amount_flowers` field
- **Impact**: All 450 tests pass; genesis reset deployed with correct premine balances

### 4. RPC balance truncation
- **Problem**: Balance reporting used `as u64` truncating u128 values
- **Fix**: Changed to `.to_string()` for lossless u128 display

### 5. WP3 compliance audit + doc fixes
- **Audit result**: 24/24 key L1 parameters match code
- **5 documentation discrepancies fixed**:
  - EN WP: "UTXO" → "Hybrid Account + UTXO"
  - CZ WP: removed stale "1,000,000 atomic units" note (correct: 10¹² flowers/ZION)
  - CZ WP: Argon2id/ChaCha20 → actual crypto primitives (Keccak-256, SHA3-512, Golden Matrix, Scratchpad)
  - CZ WP: ban "3,600s" → escalating model (300s → 1,800s → 7,200s)
  - CZ WP: stale code paths → V3 paths (`V3/L1/core/src/emission.rs`, `genesis.rs`)
  - Code: tx.rs comment about u64 capacity corrected

## Constitution Parameters — Verified vs WP3

| Parameter | WP3 Spec | Code Value | Match |
|-----------|----------|------------|-------|
| Total supply | 144B ZION | `TOTAL_SUPPLY = 144B × 10¹²` | ✅ |
| Block time | 60s | `BLOCK_TIME_SECONDS = 60` | ✅ |
| Block reward (D1) | 5,400.067 ZION | `BASE_REWARD = 5_400_067_000_000_000` | ✅ |
| Decade Decay | -20% / 5,256,000 blocks | `4/5 ratio, BLOCKS_PER_DECADE = 5_256_000` | ✅ |
| Tail emission | 724.784723787776 ZION | `TAIL_REWARD = 724_784_723_787_776` | ✅ |
| Fee split | 89/5/5/1 | `MINER_PCT=89, HUMANITARIAN=5, ISSOBELLA=5, POOL=1` | ✅ |
| Fee burn | 100% burn | `fee.rs: All fees burned` | ✅ |
| Premine | 16.78B (11.65%) | `GENESIS_PREMINE = 16_780_000_000 × 10¹²` | ✅ |
| DAO lock | 525,600 blocks | `DAO_TREASURY_LOCK_HEIGHT = 525_600` | ✅ |
| Coinbase maturity | 100 blocks | `COINBASE_MATURITY = 100` | ✅ |
| DAA | LWMA 60-block ±25% | `LWMA_WINDOW=60, clamp 3/4–5/4` | ✅ |
| Max reorg | 10 blocks | `MAX_REORG_DEPTH = 10` | ✅ |
| Soft finality | 60 confirmations | `SOFT_FINALITY_DEPTH = 60` | ✅ |
| Signing | Ed25519 | `ed25519_dalek` | ✅ |
| Hashing | BLAKE3 | `blake3::hash` | ✅ |
| PoW algorithm | Ekam Deeksha v2 | `cosmic_harmony_ekam_deeksha_v2()` | ✅ |
| Scratchpad | 256 KiB | `EKAM_V2_SCRATCHPAD_SIZE = 262144` | ✅ |
| Storage | LMDB | `heed` (LMDB wrapper), 8 databases | ✅ |
| Flowers/ZION | 10¹² | `FLOWERS_PER_ZION = 1_000_000_000_000` | ✅ |
| Max peers | 128 | `MAX_PEERS = 128` | ✅ |
| Address format | Bech32 `zion1...` | Genesis addresses = `zion1...` | ✅ |

## Files Modified

```
docs/WP3.0/ZION_V3_Whitepaper.md        — UTXO → Hybrid Account + UTXO
docs/WP3.0/WHITEPAPER_v3.0_TECHNICAL.md — 7 corrections (crypto, atomic units, ban, code paths, tx model)
V3/L1/core/src/tx.rs                    — comment fix (u64 capacity explanation)
```

## Next Steps

- [ ] Push all changes to GitHub
- [ ] GPU miner alpha (CUDA/OpenCL) — Q2 2026
- [ ] Security audit — Q2 2026
- [ ] Mobile wallet — Q3 2026
- [ ] MainNet Genesis (Block #0) — Q4 2026
