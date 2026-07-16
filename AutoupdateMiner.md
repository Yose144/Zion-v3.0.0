# ZION Autonomous Miner — Auto-Update Plan

**Date:** 2026-07-16
**Goal:** Make ZION miner fully autonomous — zero manual configuration needed.

---

## Vision

```
┌─────────────────────────────────────────────────────────┐
│                   ZION AUTONOMOUS MINER                   │
│                                                           │
│  1. START → Auto-detect hardware (GPU, CPU, RAM)         │
│  2. AUTO-TUNE → Optimal work sizes, threads, batches     │
│  3. BENCHMARK → Test all algorithms on this HW            │
│  4. PROFIT ROUTE → Auto-select Stream 2 + Stream 3 coins │
│  5. MINE → Triple stream: ZION (always) + best ext coins │
│  6. MONITOR → Re-evaluate profitability every 5 min      │
│  7. ADAPT → Switch coins if better profit found          │
│                                                           │
│  Stream 1: ZION Deeksha (GPU) — ALWAYS NATIVE, never switches │
│  Stream 2: Best profitable GPU coin (auto-selected)      │
│  Stream 3: Best profitable CPU coin (auto-selected)      │
└─────────────────────────────────────────────────────────┘
```

---

## Current State (what already works)

### ✅ Hardware Auto-Detection
- **GPU**: OpenCL/CUDA/Metal device name, CUs, VRAM (`gpu_backend.rs:998-1011`)
- **CPU**: Vendor, model, physical/logical cores via `/proc/cpuinfo` (`gpu_backend.rs:752-823`)
- **RAM**: Total + available memory (`gpu_backend.rs:1312-1315`)
- **CPU arch**: AmdZen, IntelCore, AppleSilicon, Other (`gpu_backend.rs:825-870`)

### ✅ Auto-Tuning
- **GPU work size**: `nearest_pow2(CUs × 512)`, clamped [1024, 65536] (`gpu_backend.rs:1013-1022`)
- **Secondary GPU work size**: VRAM-based formula (`gpu_backend.rs:1024-1041`)
- **CPU threads**: Per-arch formula (Zen: logical, Intel: logical, Apple: physical-1) (`gpu_backend.rs:936-966`)
- **Nonce batch**: 5M/2M/1M based on thread count (`gpu_backend.rs:936-966`)
- **GPU memory budget**: Available-RAM-based with per-model caps (`gpu_backend.rs:1311-1434`)
- **Env override**: `ZION_AUTOTUNE=0` disables, individual vars override

### ✅ Stream Architecture
- **Stream 1**: ZION Deeksha GPU — always on, never switches (`main.rs:1323-1400`)
- **Stream 2**: Pearl PoUW / GPU external — lazy-created (`main.rs:1991-2026`)
- **Stream 3**: CPU external (VerusHash/RandomX) — persistent thread (`main.rs:2028-2050`)
- **Pool config**: Pool can enable/disable streams via HTTP API (`main.rs:1720-1877`)

### ✅ Profit Weight Computation
- **StreamWeights**: Normalized 0.0-1.0 per revenue source (`stream_profit.rs:158-428`)
- **Profit API**: whattomine, coingecko, fallback (`stream_profit.rs:532-620`)
- **Hysteresis**: 15% threshold to prevent flapping (`stream_profit.rs:205-306`)
- **Min weight**: 2% to prevent starvation

### ✅ External Coin Registry
- **24 coins**: DCR, ALPH, KAS, ERG, RVN, ETC, EVR, MEWC, FLUX, CLORE, XMR, VRSC, PRL, EPIC, QUAI, BEAM, KLS, ZCL, QTC, VTC, IRON, NEXA, RTM, DNX (`profit_router.rs:45-98`)
- **Per-coin metadata**: Algorithm, pool endpoint, stratum protocol, revenue source

---

## What's Missing (implementation plan)

### ❌ 1. Miner-Side Profit Switching (CRITICAL)

**Problem**: Miner is passive — mines whatever pool sends. No auto-selection of Stream 2/3 coins.

**Solution**: Add `AutonomousProfitRouter` module to miner:

```rust
// New module: V3/L1/miner/src/autonomous.rs

pub struct AutonomousProfitRouter {
    /// Hardware profile (from auto-tune)
    hw: AutoTuneResult,
    /// Current Stream 2 coin (GPU external)
    stream2_coin: ExternalCoin,
    /// Current Stream 3 coin (CPU external)
    stream3_coin: ExternalCoin,
    /// Profit snapshots per coin
    profit_snapshots: HashMap<ExternalCoin, ProfitSnapshot>,
    /// Last evaluation time
    last_eval: Instant,
    /// Evaluation interval (default 300s = 5 min)
    eval_interval_secs: u64,
    /// Hysteresis: only switch if new coin is X% more profitable
    hysteresis_pct: f64,
}

impl AutonomousProfitRouter {
    /// Called at startup after auto-tune
    pub fn new(hw: AutoTuneResult) -> Self { ... }

    /// Fetch profit data for all coins compatible with this hardware
    pub fn fetch_profits(&mut self) -> Result<()> { ... }

    /// Select best GPU coin for Stream 2 based on:
    /// - Profitability (revenue - electricity cost)
    /// - VRAM compatibility (DAG size vs GPU VRAM)
    /// - Algorithm compatibility (kernel exists for this GPU)
    pub fn select_stream2(&mut self) -> ExternalCoin { ... }

    /// Select best CPU coin for Stream 3 based on:
    /// - Profitability
    /// - CPU feature support (AES-NI for RandomX, AVX2 for VerusHash)
    /// - Thread count efficiency
    pub fn select_stream3(&mut self) -> ExternalCoin { ... }

    /// Main loop: evaluate every 5 min, switch if better coin found
    pub fn run(&mut self, stream2_tx: &Sender<StreamCommand>, stream3_tx: &Sender<StreamCommand>) { ... }
}
```

**Key decisions:**

#### Stream 2 (GPU external) auto-selection:
1. Filter coins by VRAM compatibility:
   - 6 GB GPU: Only non-DAG coins (DCR blake3, KAS kheavyhash, ERG autolykos)
   - 8+ GB GPU: Include DAG coins (RVN kawpow, ETC ethash, FLUX, etc.)
2. Filter by algorithm kernel availability (OpenCL/CUDA/Metal)
3. Fetch profitability from API (whattomine/coingecko)
4. Subtract electricity cost (GPU TDP × electricity price)
5. Select highest net profit coin
6. Hysteresis: only switch if new coin is 15%+ better

#### Stream 3 (CPU external) auto-selection:
1. Filter coins by CPU algorithm support:
   - VerusHash: Always supported (CPU-only, no special features)
   - RandomX: Requires AES-NI (detected at startup)
2. Benchmark both on this CPU (3-second micro-benchmark)
3. Fetch profitability
4. Select highest net profit
5. Hysteresis: 15% threshold

### ❌ 2. VRAM Compatibility Filter

**Problem**: No automatic check whether a coin's DAG fits in GPU VRAM.

**Solution**: Add DAG size registry to `profit_router.rs`:

```rust
impl ExternalCoin {
    /// Returns DAG size in bytes, or None if coin doesn't use DAG
    pub fn dag_size(&self) -> Option<u64> {
        match self {
            ExternalCoin::DCR => None,           // Blake3 — no DAG
            ExternalCoin::KAS => None,           // kHeavyHash — no DAG
            ExternalCoin::ERG => None,           // Autolykos — no DAG
            ExternalCoin::RVN => Some(4_294_967_296),  // KawPow ~4 GB
            ExternalCoin::ETC => Some(2_684_354_560),  // Ethash ~2.5 GB
            ExternalCoin::FLUX => Some(6_000_000_000), // ~6 GB
            // ... etc
            _ => None,
        }
    }

    /// Check if this coin can mine on a GPU with given VRAM
    pub fn fits_vram(&self, vram_bytes: u64) -> bool {
        match self.dag_size() {
            None => true,  // No DAG = always fits
            Some(dag) => dag + 512_000_000 < vram_bytes,  // DAG + 512MB overhead
        }
    }
}
```

### ❌ 3. CPU Algorithm Compatibility Filter

**Problem**: No automatic check whether CPU supports coin's algorithm.

**Solution**: Use existing `CpuFeatures` module:

```rust
impl ExternalCoin {
    /// Check if CPU features support this coin's algorithm
    pub fn cpu_compatible(&self, features: &CpuFeatures) -> bool {
        match self.algorithm() {
            "verushash" => true,  // Always supported
            "randomx" => features.aes,  // Needs AES-NI
            _ => false,  // GPU-only algorithms
        }
    }
}
```

### ❌ 4. Electricity Cost Calculation

**Problem**: Profit comparison doesn't account for electricity cost.

**Solution**: Add electricity cost estimation:

```rust
pub struct ElectricityCost {
    gpu_tdp_watts: f64,      // GPU power draw (from hardware detection)
    cpu_tdp_watts: f64,      // CPU TDP (from CPU model)
    electricity_price: f64,  // USD per kWh (from env or default)
}

impl ElectricityCost {
    pub fn gpu_cost_per_day(&self) -> f64 {
        self.gpu_tdp_watts * 24.0 / 1000.0 * self.electricity_price
    }
    pub fn cpu_cost_per_day(&self, threads: usize, total_threads: usize) -> f64 {
        self.cpu_tdp_watts * (threads as f64 / total_threads as f64) * 24.0 / 1000.0 * self.electricity_price
    }
}
```

**Env vars:**
- `ZION_ELECTRICITY_PRICE=0.12` (USD/kWh, default: 0.12)
- `ZION_GPU_TDP_WATTS=225` (RX 5700 XT TDP, auto-detected from GPU model)
- `ZION_CPU_TDP_WATTS=65` (Ryzen 5 3600 TDP, auto-detected from CPU model)

### ❌ 5. Runtime Stream Switching

**Problem**: Streams are configured at startup only. No runtime coin switching.

**Solution**: Add stream command channel:

```rust
enum StreamCommand {
    /// Switch to a new coin
    SwitchCoin { coin: ExternalCoin, algorithm: String },
    /// Disable this stream
    Disable,
    /// Re-enable with current coin
    Enable,
    /// Update work size (for dynamic tuning)
    UpdateWorkSize(usize),
}
```

The persistent Stream 2 and Stream 3 threads listen on these channels and switch coins without restarting the miner.

### ❌ 6. Automatic Pool Failover

**Problem**: Single pool address. If pool goes down, miner stops.

**Solution**: Support multiple pool addresses:

```bash
# Comma-separated list, tried in order
ZION_POOL_ADDR=62.171.141.136:8444,backup.zionterranova.com:8444
```

Failover logic:
- Try primary pool
- If connection fails 3 times → switch to next pool
- Exponential backoff between retries (5s, 10s, 20s, 40s)
- Log all failover events
- Periodically retry primary (every 5 min)

---

## Implementation Phases

### Phase A: AutonomousProfitRouter (core)
- New module `V3/L1/miner/src/autonomous.rs`
- VRAM compatibility filter in `profit_router.rs`
- CPU compatibility filter using `CpuFeatures`
- Electricity cost calculation
- Profit fetching (reuse `stream_profit.rs` API)
- Coin selection logic with hysteresis

### Phase B: Runtime Stream Switching
- `StreamCommand` enum + channels
- Stream 2 thread: listen for coin switch commands
- Stream 3 thread: listen for coin switch commands
- Graceful coin switch (finish current job, start new coin)

### Phase C: Start.sh Autonomy
- Remove all manual stream config from Start.sh
- Miner auto-selects everything at startup
- Only required inputs: `--pool`, `--wallet`
- Everything else auto-detected and auto-tuned

### Phase D: Pool Failover
- Multi-pool support
- Automatic failover with backoff
- Health checking

### Phase E: Continuous Monitoring
- Re-evaluate profitability every 5 min
- Re-benchmark if hashrate drops unexpectedly
- Log all decisions to `/tmp/zion-autonomous.log`
- HTTP status endpoint (optional)

---

## Autonomous Startup Sequence

```
1. Miner starts
2. Auto-detect hardware:
   - GPU: gfx1010, 18 CUs, 6128 MB VRAM
   - CPU: AMD Ryzen 5 3600, 6C/12T, AVX2/AES-NI
   - RAM: 30947 MB, 1250 huge pages
3. Auto-tune:
   - GPU work_size = 8192 (nearest_pow2(18×512))
   - CPU threads = 12 (AmdZen: all logical)
   - Nonce count = 5M (≥8 threads)
4. Benchmark algorithms (3s each):
   - deeksha_lite_v1: 30 KH/s ← winner
   - deeksha_lite_fire: 30 KH/s
5. Fetch profit data for all compatible coins:
   - GPU coins (≤6GB VRAM): DCR, KAS, ERG
   - CPU coins (AES-NI): VRSC, XMR
6. Calculate net profit (revenue - electricity):
   - Stream 2 (GPU): DCR $0.80/day, KAS $1.20/day, ERG $0.60/day → KAS
   - Stream 3 (CPU): VRSC $0.40/day, XMR $0.55/day → XMR
7. Start mining:
   - Stream 1: ZION Deeksha (GPU, always native) — 30 KH/s
   - Stream 2: KAS kHeavyHash (GPU secondary) — auto-selected
   - Stream 3: XMR RandomX (CPU, 6T) — auto-selected
8. Monitor & adapt (every 5 min):
   - Re-fetch profit data
   - If KAS drops 15% below DCR → switch to DCR
   - If XMR drops 15% below VRSC → switch to VRSC
   - Log: "autonomous_switch stream2=DCR reason=profit_15pct_higher"
```

---

## Env Vars for Autonomous Mode

```bash
# Master switch
ZION_AUTONOMOUS=1          # Enable full autonomy (default: 0, backward compat)

# Profit routing
ZION_PROFIT_INTERVAL=300   # Re-evaluate every 5 min (default: 300)
ZION_PROFIT_HYSTERESIS=15  # Switch threshold 15% (default: 15)
ZION_PROFIT_API=whattomine # API provider (default: whattomine)

# Electricity cost (for net profit calculation)
ZION_ELECTRICITY_PRICE=0.12  # USD/kWh (default: 0.12)
ZION_GPU_TDP=225             # GPU power draw watts (auto-detected)
ZION_CPU_TDP=65              # CPU TDP watts (auto-detected)

# Pool failover (comma-separated)
ZION_POOL_ADDR=62.171.141.136:8444,backup.example.com:8444

# Stream overrides (optional — autonomy auto-selects if not set)
# ZION_STREAM2_COIN=KAS     # Force Stream 2 coin (skip auto-select)
# ZION_STREAM3_COIN=XMR     # Force Stream 3 coin (skip auto-select)
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `V3/L1/miner/src/autonomous.rs` | **CREATE** | AutonomousProfitRouter module |
| `V3/L1/miner/src/main.rs` | MODIFY | Integrate autonomous router into startup |
| `V3/L1/cosmic-harmony/src/profit_router.rs` | MODIFY | Add `dag_size()`, `fits_vram()`, `cpu_compatible()` |
| `V3/L1/miner/src/gpu_backend.rs` | MODIFY | Add GPU/CPU TDP to AutoTuneResult |
| `Desktop/Start.sh` | MODIFY | Simplify to just `--pool` + `--wallet` |

---

## Expected Outcome

**Before (current):**
```bash
# Manual config required
ZION_STREAM2_ENABLED=0  # Manually disabled (KawPow too large)
ZION_STREAM3_ENABLED=1  # Manually enabled
ZION_MINER_ALGORITHM=deeksha_lite_v1  # Manually set
# User must know which coins work on their hardware
```

**After (autonomous):**
```bash
# Just works
./zion-miner --pool 62.171.141.136:8444 --wallet zion1...
# Miner auto-detects HW, auto-tunes, auto-selects coins, auto-adapts
```
