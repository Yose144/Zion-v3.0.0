# ZION TerraNova v2.9.5 — GPU Auto-Detect & CPU-Only Mode

**Date:** 2026-02-09  
**Sprint:** CH3 Revenue Architecture — GPU Auto-Detection  
**Commits:** `a33e650`, `7da6b21`, `20da6f2`  
**Status:** ✅ DEPLOYED & VERIFIED on all 3 servers

---

## 📋 Summary

Implemented automatic GPU detection across the entire CH3 stack (pool + miner). When no GPU is detected, the system automatically enters **CPU-Only Mode** where:

- xmrig subprocess is **not spawned** (eliminates "binary not found" errors)
- WhatToMine API polling is **skipped** (no GPU algo profitability needed)
- Revenue stream is **locked to XMR/RandomX** (CPU-minable)
- 25% of mining time is dedicated to MoneroOcean XMR revenue via native RandomX

Previously, xmrig was required for external mining, causing error spam on GPU-less servers. Now the system gracefully degrades to CPU-only operation.

---

## 🏗️ Architecture Changes

### Before (v2.9.5 pre-GPU-detect)
```
Pool → ProfitSwitcher → WhatToMine API → best GPU algo → xmrig
                                                          ↑ ERROR: binary not found
```

### After (v2.9.5 with GPU auto-detect)
```
Pool → detect_gpu_available()
       ├── GPU found → ProfitSwitcher → WhatToMine → best algo → xmrig
       └── No GPU → CPU-Only Mode → lock XMR → native RandomX (no xmrig)
```

---

## 📁 Changed Files (12 files, +392 / -69 lines)

### Pool-side (commit `a33e650`)

| File | Changes |
|------|---------|
| `pool/src/profit_switcher.rs` | +107 — `detect_gpu_available()`, `cpu_only_mode: AtomicBool`, skip WhatToMine in CPU mode, lock XMR |
| `pool/src/main.rs` | +23 — Skip xmrig subprocess when `profit_switcher.is_cpu_only()` |
| `pool/src/pool_external_miner.rs` | +15 — Updated docs, CPU-only mode notes |
| `pool/src/stream_scheduler.rs` | +11 — Updated docs, Revenue stream in CPU-only context |
| `CH3_REVENUE_ARCHITECTURE.md` | +76 — Section 8: GPU auto-detection docs, FAQ, env vars |

### Miner-side (commit `7da6b21`)

| File | Changes |
|------|---------|
| `miner/src/miner/mod.rs` | +89 — `detect_gpu_available()` (Metal/CUDA/OpenCL/nvidia-smi/rocm-smi), `cpu_only_mode` field |
| `miner/src/miner/cpu.rs` | +23 — Replace GPU-only algos with RandomX in mining loop |
| `miner/src/miner/stream_aware.rs` | +41 — `cpu_only_mode` in StreamState, `is_gpu_only_algo()`, `new_cpu_only()` |
| `miner/src/main.rs` | +17 — Banner update, auto-detect GPU logging |

### Bug Fix (commit `20da6f2`)

| File | Changes |
|------|---------|
| `pool/src/stratum/server_v2.rs` | +52 — Fixed `mining.notify` format: include algo string at params[4] |
| `pool/src/revenue_proxy.rs` | +1 — Resolve "auto" algorithm → "randomx" for XMR |
| `miner/src/stratum/mod.rs` | +6 — Parse algo from mining.notify params[4] |

---

## 🔍 GPU Detection Logic

### Pool (`pool/src/profit_switcher.rs`)
```rust
fn detect_gpu_available() -> bool {
    // 1. Environment override: ZION_HAS_GPU=1
    // 2. nvidia-smi (NVIDIA GPUs)
    // 3. rocm-smi (AMD GPUs)
    // If none found → cpu_only_mode = true
}
```

### Miner (`miner/src/miner/mod.rs`)
```rust
fn detect_gpu_available() -> bool {
    // 1. Environment override: ZION_HAS_GPU=1
    // 2. Metal framework probe (macOS)
    // 3. CUDA library probe (Linux/Windows)
    // 4. OpenCL library probe (cross-platform)
    // 5. nvidia-smi fallback
    // 6. rocm-smi fallback
    // If none found → cpu_only_mode = true
}
```

### Environment Variable Override
```bash
# Force GPU mode even without detected GPU
ZION_HAS_GPU=1

# Force CPU-only mode even with GPU
ZION_HAS_GPU=0
```

---

## 🐛 Bug Found & Fixed

### Problem: Revenue XMR jobs not reaching miner

**Root cause:** `mining.notify` format mismatch between pool and miner.

- Pool sent: `[job_id, blob, target, height(number), seed_hash, clean_jobs]`
- Miner expected: `[job_id, blob, target, height, ALGORITHM(string), seed_hash, clean_jobs]`

Without the algorithm field, miner couldn't determine algo → always fell back to `cosmic_harmony_v3`.

Additionally, MoneroOcean XMR config had `"algorithm": "auto"` which the miner couldn't parse.

**Fix (commit `20da6f2`):**
1. Pool now includes algorithm string at `params[4]` in `mining.notify`
2. Revenue proxy resolves coin→algo mapping: `"XMR" → "randomx"`, `"ETC" → "ethash"`, etc.

---

## 🖥️ Server Deployment

### Servers
| Server | IP | Location | Status |
|--------|-----|----------|--------|
| Helsinki 🇫🇮 | 77.42.31.72 | Finland | ✅ Running |
| USA 🇺🇸 | 5.78.145.234 | Ashburn, VA | ✅ Running |
| Singapore 🇸🇬 | 5.223.56.124 | Singapore | ✅ Running |

### Deployment Steps
1. Docker image cleanup on all 3 servers (freed **47 GB** total)
2. Parallel `rsync` + `docker compose build` on all servers
3. `docker compose up -d` restart
4. Verification of XMR Revenue switching

### Disk Space Freed
| Server | Freed |
|--------|-------|
| Helsinki | ~15 GB |
| USA | ~16 GB |
| Singapore | ~16 GB |
| **Total** | **~47 GB** |

---

## ✅ Verification Results

### Helsinki 🇫🇮
```
Pool:  [XMR] 📦 Job forwarded: algo=randomx (total=6)
Miner: RandomX first hash: OK in 1.05s
```

### USA 🇺🇸
```
Pool:  [XMR] 📦 Job forwarded: algo=randomx (total=9)
Miner: RandomX first hash: OK in 0.87s
```

### Singapore 🇸🇬 (complete flow)
```
Pool:  TimeSplit: → Revenue:XMR (Z:50% R:0% N:50%)
Pool:  Broadcasted GPU:XMR job (ext-xmr-86a1) to 1 miners [algo=randomx]
Miner: Stream switch: cosmic_harmony_v3 → randomx
Miner: RandomX initialized with key (len=25)
Miner: RandomX first hash: OK in 1.05s
```

### End-to-End Revenue Flow ✅
```
RevenueProxy
  → connects to gulf.moneroocean.stream:10001
  → receives XMR jobs from MoneroOcean
  → StreamScheduler allocates 25% time to Revenue
  → Pool broadcasts mining.notify with algo=randomx
  → Miner detects stream switch (cosmic_harmony_v3 → randomx)
  → Miner initializes native RandomX (~1s)
  → Miner hashes RandomX and submits shares
```

---

## 💰 Revenue Configuration

| Parameter | Value |
|-----------|-------|
| Revenue time allocation | 25% |
| Mining algorithm | RandomX (native, no xmrig) |
| MoneroOcean pool | gulf.moneroocean.stream:10001 |
| XMR wallet | `42m86RBWf4P...skcKsK` |
| Expected hashrate (ARM) | ~1 H/s per core |

---

## 📊 Test Results

| Test Suite | Result |
|------------|--------|
| Pool unit tests | 28/28 ✅ |
| Miner unit tests | 24/24 ✅ |
| Integration (3 servers) | All passing ✅ |

---

## 🔮 Next Steps

- [ ] Monitor MoneroOcean dashboard for XMR earnings accumulation
- [ ] Track share acceptance rate on MoneroOcean
- [ ] Optimize RandomX hashrate on ARM servers
- [ ] Add RandomX share submission metrics to pool stats API
- [ ] Clean up cosmetic `ncl.get_task` ERROR messages (NCL not configured)
- [ ] Consider RandomX thread count tuning per server CPU cores

---

## 📝 Git History

```
20da6f2 fix: mining.notify format mismatch - Revenue XMR jobs now reach miner
7da6b21 feat(miner): GPU auto-detect + CPU-only mode for Revenue stream
a33e650 feat(ch3): GPU auto-detect + CPU-only mode for Revenue stream
```

---

*Report generated: 2026-02-09*  
*ZION TerraNova v2.9.5 — "Where technology meets spirit" 🌟*
