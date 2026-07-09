# 🔄 Migrating from v2.9.5 to v2.9.6

> *Guide to the pre-mainnet fork.*

---

## 1. Summary of changes

| Area | v2.9.5 | v2.9.6 |
|------|--------|--------|
| PoW algorithm | CH v1/v2/v3 (3 variants) | **CHv3 only** (single path) |
| Nonce | u32 (v1) + u64 (v2/v3) | **u64** (unified) |
| Pool `Algorithm` enum | 3 variants | **1 variant** (`CosmicHarmony` = CHv3) |
| Miner `NativeAlgorithm` | CosmicHarmony + CosmicHarmonyV2 | **CosmicHarmony** (= CHv3) |
| Memory-hard scratchpad | optional | **fork-gated** (h ≥ 50,000) |
| Dual mining | time-switching | **parallel** (PerMiner groups) |

---

## 2. Node operator

### 2.1 Update binaries

```bash
cd /opt/zion
git pull origin main
cargo build --release --workspace
./target/release/zion-node --version
# zion-core v2.9.6
```

### 2.2 Configuration

No changes to `config/*.toml`. Fork heights are hardcoded:

```rust
pub const CH_V3_FORK_HEIGHT: u64 = 0;
pub const CHV3_MEMORY_HARD_FORK_HEIGHT: u64 = 50_000;
```

### 2.3 Database

No DB migration — block format unchanged. CHv3 hash is backward compatible (fork height 0 = always active).

---

## 3. Pool operator

### 3.1 Share validator

Legacy `Algorithm` enum collapsed to a single `CosmicHarmony` (= CHv3).  
Strings `cosmic_harmony`, `cosmic_harmony_v1`, `cosmic_harmony_v2`, `cosmic_harmony_v3`, `chv3`, `ch3` map to `CosmicHarmony`.

### 3.2 PerMiner groups

```bash
export ZION_SCHEDULER_PERMINER_MIN_MINERS=2
./zion-miner --pool stratum+tcp://seed.zionterranova.com:3333 \
             --user wallet.worker:p=zion,g=zion \
             --group zion
```

### 3.3 VRSC revenue mining

Pool can route VRSC shares (LuckPool proxy, env such as `ZION_ZC_PASS`, `ZION_VRSC_POOL`).

---

## 4. Miner

```bash
./zion-miner --algo cosmic_harmony
# or --algo chv3; cosmic_harmony_v2 accepted but maps to CHv3
```

New flag: `--group <zion|revenue>` for parallel dual mining.

---

## 5. Docker

Rebuild images from updated compose; optional env: `ZION_SCHEDULER_PERMINER_MIN_MINERS`, `ZION_CHV3_MEMORY_HARD_*`.

---

## 6. Breaking changes

| Change | Mitigation |
|--------|------------|
| `cosmic_harmony_v2` removed from enum | Use `cosmic_harmony` |
| `cosmic_hash()` removed | Use `hash(blob, nonce, height)` |
| `CosmicHarmonyV2` in pool | Map everything to `CosmicHarmony` |

Backward compatible: block format, 165 B template blob, Stratum strings mapping to CHv3.

---

## 7. Rollback

```bash
git checkout v2.9.5
cargo build --release --workspace
```

Legacy sources under `archive/legacy-algorithms/`.
