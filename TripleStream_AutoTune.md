# ZION Miner v3.0.6 — Triple Stream + Auto-Tune Report

**Datum:** 2026-07-16
**Verze:** 3.0.6 Triple Stream
**Status:** M1 8GB stabilní (auto-tune), Ryzen/Linux OpenCL pending ladění

---

## 1. Triple Stream Architecture

Miner těží **3 paralelní streamy** současně (Claymore-style dual+):

| Stream | Backend | Coin (příklad) | Algoritmus | Status na M1 8GB |
|--------|---------|----------------|------------|------------------|
| **Stream 1** | GPU Metal | ZION | deeksha_lite_v1 | ✅ Aktivní (auto-tune scratchpad) |
| **Stream 2** | GPU Metal (external) | EPIC / KAS / ALPH | progpow / kheavyhash / blake3 | ⚠️ Per-algorithm guard (DAG skip) |
| **Stream 3** | CPU (external) | VRSC / XMR | verushash / randomx | ✅ Aktivní (4 thready) |

### Stream 2 — Algorithm-Aware Guard

Pool pošle algoritmus → miner checkne `backend_supports_algorithm()`:

```rust
// gpu_backend.rs
pub fn is_dag_based_algorithm(algorithm: &str) -> bool {
    matches!(algorithm, "progpow" | "progpow_epic" | "ethash" | "etchash"
        | "kawpow" | "kawpow_rvn" | "kawpow_clore" | "kawpow_evr"
        | "kawpow_mewc" | "kawpow_quai" | "evrprogpow" | "evrprogpow_evr"
        | "meowpow" | "meowpow_mewc")
}

pub fn is_memory_hard_algorithm(algorithm: &str) -> bool {
    matches!(algorithm, "zelhash" | "zelhash_flux" | "beamhash" | "beamhash_beam")
}
```

| Kategorie | Algoritmy | Extra GPU memory | Metal 8GB? | OpenCL 6GB? |
|-----------|-----------|------------------|------------|-------------|
| **DAG-based** | ProgPow, Ethash, KawPow, EvrProgPow, MeowPow | 1GB + 8MB/epoch | ❌ skip | ✅ if VRAM fits |
| **Memory-hard** | ZelHash (FLUX), BeamHash (BEAM) | 1–1.3 GB | ❌ skip | ✅ if VRAM fits |
| **Medium** | Autolykos (ERG) | 64–512 MB | ✅ if fits budget | ✅ |
| **Lightweight** | Blake3 (ALPH/DCR), kHeavyHash (KAS) | <1 MB | ✅ always | ✅ always |

### VRAM-aware guard pro OpenCL/CUDA (dedicated GPU)

```rust
// gpu_backend.rs — algorithm_fits_gpu_budget()
// OpenCL / CUDA: dedicated VRAM — check if algorithm fits
let gpu_vram = detect_gpu_vram_bytes();
if gpu_vram > 0 {
    let extra = algorithm_extra_gpu_memory_bytes(algorithm, height);
    let per_stream_budget = (gpu_vram * 45) / 100;  // 45% per stream, 10% driver
    if extra > per_stream_budget { return false; }
}
```

**6 GB VRAM karta:**
- per_stream_budget = 6144 × 0.45 = **2765 MB**
- ProgPow epoch 0 DAG = 1024 MB → ✅ fits
- ProgPow epoch 100 DAG = 1824 MB → ✅ fits
- Ethash epoch 200 DAG = 2624 MB → ✅ fits (barely)
- **2 streamy ProgPow = 2× 1024 MB = 2048 MB → ✅ fits v 6GB VRAM!**

**4 GB VRAM karta:**
- per_stream_budget = 4096 × 0.45 = **1843 MB**
- ProgPow epoch 0 = 1024 MB → ✅ fits (single stream)
- 2× ProgPow = 2048 MB → ❌ nepasuje (budget 1843 MB)
- Blake3 = 0 MB extra → ✅ 2 streamy OK

---

## 2. Auto-Tune GPU Memory Budget

### Problém (před auto-tune)

Fixed percentages nejdou:
- 8GB M1 s 1.1GB free RAM → 20% budget (1.6GB) = OOM freeze
- 16GB M1 s 8GB free RAM → 20% budget (3.2GB) = zbytečně málo
- 6GB VRAM GPU s 2GB volných → potřeba jiný vzorec

### Řešení: `auto_tune_gpu_budget(cpu_threads)`

```rust
// gpu_backend.rs
pub fn auto_tune_gpu_budget(cpu_threads: usize) -> u64 {
    let total_ram = detect_system_memory_bytes();
    let available = detect_available_memory_bytes();

    // Tier 1: Hard cap (max % of TOTAL RAM)
    let max_pct = match total_ram {
        ≤8GB  => 25%,  // 2 GB max on 8GB
        ≤16GB => 40%,  // 6.4 GB max on 16GB
        >16GB => 50%,  // no limit
    };
    let total_cap = total_ram * max_pct;

    // Tier 2: Available-based (50% of what's actually free)
    let avail_based = available * 50%;

    // Tier 3: Floor (8% of total — macOS can swap/compress)
    let floor = total_ram * 8%;

    // CPU adjustment: -50 MB per CPU thread
    let cpu_adj = cpu_threads * 50 MB;

    // Final: max(floor, avail_based), capped by total_cap, reduced by CPU
    let budget = max(floor, avail_based).min(total_cap) - cpu_adj;
    budget.max(32 MB)  // minimum viable
}
```

### Available Memory Detection

| Platform | Metoda | Co měří |
|----------|--------|---------|
| **macOS** | `vm_stat` | free + inactive + purgeable + speculative pages × page_size (16384 na Apple Silicon) |
| **Linux** | `/proc/meminfo` | `MemAvailable` (zahrnuje cache/buffers) |
| **Windows** | `wmic OS get FreePhysicalMemory` | Free physical memory |

### Výsledky na M1 8GB (reálně naměřeno 2026-07-16)

| CPU threads | Available RAM | Budget | Scratchpad (per stream) | Stav |
|-------------|---------------|--------|-------------------------|------|
| 0 (GPU only)| ~1535 MB | **600 MB** | **300 MB** | ✅ max budget pro 8GB |
| 2           | ~1580 MB | **450 MB** | **225 MB** | ✅ dobrý kompromis |
| 4           | ~1710 MB | **300 MB** | **150 MB** | ✅ stabilní, nižší hashrate |
| 6           | ~1600 MB | **150 MB** | **75 MB**  | ⚠️ minimum |
| 8           | ~1500 MB | **0 MB**   | —          | ❌ kill switch (cpu_adj > budget) |

**Vzorec:** `budget = min(max(available × ratio, floor), max_budget) - (threads × 75 MB)`

Kde `ratio` je adaptivní:
- available < 500 MB → 30%
- available < 1000 MB → 40%
- available < 2000 MB → 50%
- available ≥ 2000 MB → 60%

### Reset na reconnect

```rust
// gpu_backend.rs
pub fn reset_gpu_memory_budget() {
    GPU_MEM_CLAIMED_BYTES.store(0, SeqCst);
    GPU_MEM_BUDGET_BYTES.store(0, SeqCst);
}
```

Volá se na začátku každé session (před `init_gpu_memory_budget_with_threads`).

### Claim systém

```rust
fn claim_gpu_memory_budget(device_recommended: u64) -> u64 {
    let budget = GPU_MEM_BUDGET_BYTES.load();
    let claimed = GPU_MEM_CLAIMED_BYTES.load();
    let remaining = budget - claimed;
    let max_per_instance = budget / 2;  // each stream gets 50%
    let allocation = remaining.min(max_per_instance);

    if allocation < 32 MB {
        return 32 MB;  // minimum viable, NOT device_recommended!
        // (device_recommended může být 4GB+ na M1 → OOM freeze)
    }

    GPU_MEM_CLAIMED_BYTES.fetch_add(allocation);
    allocation
}
```

---

## 3. M1–M5 Apple Silicon Architecture

### Co funguje

| Model | RAM | GPU | ZION (Stream 1) | VRSC (Stream 3) | Stream 2 |
|-------|-----|-----|-----------------|-----------------|----------|
| M1 | 8GB | 7-8 CU | ✅ auto-tune ~300 MB | ✅ 4 thready | ⚠️ non-DAG only |
| M1 | 16GB | 8 CU | ✅ ~1.5 GB | ✅ 4 thready | ✅ non-DAG |
| M2 | 8GB | 10 CU | ✅ auto-tune ~300 MB | ✅ 4 thready | ⚠️ non-DAG only |
| M2 | 16GB | 10 CU | ✅ ~1.5 GB | ✅ 4 thready | ✅ non-DAG |
| M3 | 8GB | 10 CU | ✅ auto-tune | ✅ | ⚠️ non-DAG only |
| M3 | 16GB | 10 CU | ✅ | ✅ | ✅ non-DAG |
| M4 | 16GB | 10 CU | ✅ | ✅ | ✅ non-DAG |
| M4 | 32GB | 10 CU | ✅ ~3 GB | ✅ 8 threadů | ✅ non-DAG |
| M4 Pro | 24GB | 16 CU | ✅ ~4 GB | ✅ 8 threadů | ✅ non-DAG |
| M4 Max | 36GB | 32 CU | ✅ ~6 GB | ✅ 10 threadů | ✅ non-DAG |
| M5 | TBD | TBD | ✅ | ✅ | TBD |

### Co NEfunguje na Metal (unified memory)

- ❌ **ProgPow / Ethash / KawPow** — DAG 1GB+ na unified memory = freeze risk
- ❌ **ZelHash / BeamHash** — Equihash memory-hard, 1.3GB+ = freeze risk
- ❌ **2× GPU stream s velkým scratchpadem** — budget se rozdělí, ale OS potřebuje 4-5GB

### Metal-specific limity

1. **Unified memory**: GPU a CPU sdílí RAM, žádný dedicated VRAM
2. **macOS window server**: ~2GB rezervováno (nelze uvolnit)
3. **Memory compressor**: macOS komprimuje pages, ale GPU scratchpad nelze komprimovat
4. **OOM = kernel freeze**: Na rozdíl od Linuxu (OOM killer), macOS zamrzne

### Tuning pro M1 8GB

```bash
# Bezpečný start
./zion-miner --pool 62.171.141.136:8444 --wallet <wallet> --threads 4 --no-tui

# S menším počtem threadů (více RAM pro GPU)
./zion-miner --pool ... --threads 2 --no-tui

# Force Stream 2 (pokud pool posílá non-DAG algo)
ZION_FORCE_STREAM2=1 ./zion-miner --pool ... --threads 4 --no-tui

# Metrics každých 15s
ZION_METRICS_REPORT_SECS=15 ./zion-miner --pool ... --no-tui
```

---

## 4. Ryzen / Linux OpenCL Tuning Guide

### Build pro Linux x86_64 s OpenCL

```bash
# Install OpenCL
sudo apt install ocl-icd-opencl-dev

# Build
cd V3
cargo build --release -p zion-miner --features native-verushash,native-randomx,gpu-opencl,native-hashers

# Binary
./target/release/zion-miner --pool 62.171.141.136:8444 --wallet <wallet> --threads <N> --no-tui
```

### Dedicated GPU VRAM detection

Na Linux s OpenCL, `query_gpu_details()` čte `CL_DEVICE_GLOBAL_MEM_SIZE`:
- 6GB GPU (RX 5600 XT, RTX 2060) → `global_mem_bytes = 6442450944`
- 8GB GPU (RX 5700, RTX 2070) → `global_mem_bytes = 8589934592`

Auto-tune na dedicated GPU:
- `detect_available_memory_bytes()` → system RAM (ne GPU VRAM)
- `detect_gpu_vram_bytes()` → GPU VRAM
- GPU scratchpad budget = system RAM based (ne VRAM based)
- Algorithm check = VRAM based (`algorithm_fits_gpu_budget`)

### Dual-stream na 6GB GPU

```
6GB VRAM, per_stream_budget = 2765 MB

Stream 1: ZION deeksha       ~200 MB scratchpad  → ✅
Stream 2: ProgPow EPIC       1024 MB DAG          → ✅ (fits in 2765 MB)
Stream 3: VRSC verushash     CPU only             → ✅

Total GPU VRAM used: ~1224 MB → hodně headroomu
```

### Dual-stream na 8GB GPU

```
8GB VRAM, per_stream_budget = 3686 MB

Stream 1: ZION deeksha       ~400 MB scratchpad  → ✅
Stream 2: ProgPow EPIC       1024 MB DAG          → ✅
Stream 3: VRSC verushash     CPU only             → ✅

Total GPU VRAM used: ~1424 MB → hodně headroomu
```

### Dual-stream na 4GB GPU

```
4GB VRAM, per_stream_budget = 1843 MB

Stream 1: ZION deeksha       ~200 MB scratchpad  → ✅
Stream 2: ProgPow EPIC       1024 MB DAG          → ✅ (single stream OK)
Stream 2: 2× ProgPow         2048 MB              → ❌ (budget 1843 MB)
Stream 2: Blake3 ALPH        0 MB                 → ✅ (lightweight)

→ Na 4GB GPU: 1× DAG algo + 1× lightweight algo
```

### AMD GPU OpenCL setup

```bash
# Install AMDGPU PRO driver + OpenCL
sudo apt install amdgpu-pro opencl-amdgpu-pro-icd

# Verify
clinfo | grep "Global memory size"
# Should show: 8589934592 (8GB)

# Run
./zion-miner --pool 62.171.141.136:8444 --wallet <w> --threads 4 --no-tui
```

### NVIDIA GPU OpenCL setup

```bash
# Install NVIDIA driver + CUDA toolkit
sudo apt install nvidia-driver-535 nvidia-cuda-toolkit

# Verify
clinfo | grep "Global memory size"

# Run (OpenCL backend)
./zion-miner --pool 62.171.141.136:8444 --wallet <w> --threads 4 --no-tui

# Or force CUDA backend
ZION_BACKEND=cuda ./zion-miner --pool ... --no-tui
```

### CPU tuning na Ryzen

> **Note (2026-07-16):** CPU auto-tune now handles this automatically — see §4b.
> The manual settings below are still valid as overrides.

```bash
# Ryzen 5 3600 (6C/12T): auto-tune picks 12 threads, 5M nonces (13 MH/s peak)
./zion-miner --pool ... --no-tui  # no --threads needed!

# Ryzen 9 5900X (12C/24T): auto-tune picks 18 threads, 5M nonces
./zion-miner --pool ... --no-tui

# Ryzen 9 7950X (16C/32T): auto-tune picks 22 threads, 5M nonces
./zion-miner --pool ... --no-tui
```

### RandomX (XMR) na Ryzen

RandomX potřebuje 2MB L3 cache per thread:
- Ryzen 5 3600: 32MB L3 → 16 threadů max (ale 6 fyzických)
- Ryzen 9 5900X: 64MB L3 → 32 threadů max (12 fyzických)
- Ryzen 9 7950X: 64MB L3 → 32 threadů max (16 fyzických)

```bash
# RandomX s huge pages
sudo sysctl -w vm.nr_hugepages=1280  # 2.5 GB pro 16 threadů
./zion-miner --pool ... --threads 16 --no-tui
```

---

## 4b. CPU Auto-Tune (per-architecture, all CPU types)

**Added 2026-07-16:** Comprehensive CPU detection + auto-tuning for VerusHash v2.2.
The miner now detects CPU vendor, model, physical vs logical cores, and classifies
the CPU into an architecture profile. Threads and nonce batch size are auto-tuned
per profile — no manual `--threads` or `ZION_EXT_CPU_NONCE_COUNT` needed.

### CPU Detection

| Detection | Linux | macOS | Windows |
|-----------|-------|-------|---------|
| Vendor + model | `/proc/cpuinfo` | `sysctl machdep.cpu.brand_string` | `wmic cpu get name` |
| Physical cores | `/proc/cpuinfo` core_id + physical_id | `sysctl hw.physicalcpu` | `wmic cpu get NumberOfCores` |
| Logical cores | `num_cpus::get()` | `num_cpus::get()` | `num_cpus::get()` |

### Architecture Profiles

| Profile | CPUs | Threads formula | nonce_count |
|---------|------|-----------------|-------------|
| **AmdZen** | Ryzen, EPYC, Threadripper | `logical.min(physical + 6)` — SMT helps, cap to avoid L3 thrash | 5M if ≥8T, 2M if ≥4T, 1M else |
| **IntelCore** | Core i3-i9, Xeon, Pentium | `logical.min(physical + 4)` — HT helps, slightly more conservative | 5M if ≥8T, 2M if ≥4T, 1M else |
| **AppleSilicon** | M1–M5 | `physical - 1` if GPU active (unified memory) | 5M if ≥6T, 2M if ≥3T, 1M else |
| **Other** | ARM server, unknown | `physical` only (no SMT assumption) | 5M if ≥8T, 2M if ≥4T, 1M else |

### Benchmark Results (Ryzen 5 3600, 6C/12T)

| Config | Threads | nonce_count | VRSC MH/s | Notes |
|--------|---------|-------------|-----------|-------|
| Physical only | 6 | 5M | ~4.1 | SMT disabled — low |
| SMT, suboptimal | 10 | 1M | 11.9 | Good but not peak |
| **Auto-tuned** | **12** | **5M** | **13.0** | **Peak — auto-tune picks this** |
| Oversubscribed | 14+ | 5M | degrades | L3 cache contention (8.8KB key/thread) |

### Key Insights

1. **VerusHash benefits enormously from SMT** — 12 threads (6C/12T) is 3.2× faster than 6 threads (physical only)
2. **Oversubscription degrades** — each VerusHash thread needs ~8.8KB CLHash key (thread-local), so `physical + 6` is the cap
3. **nonce_count = 5M is optimal** for ≥8 threads — balances batch C++ scan efficiency vs job freshness
4. **Apple Silicon** needs fewer threads when GPU is active (unified memory bandwidth contention)

### Usage

```bash
# Fully automatic — no manual tuning needed
./zion-miner --pool 62.171.141.136:8444 --wallet zion1... --no-tui

# Check what auto-tune would pick
./zion-miner --auto-tune

# Override threads (still uses auto-tuned nonce_count)
ZION_THREADS=8 ./zion-miner --pool ... --no-tui

# Override nonce_count (still uses auto-tuned threads)
ZION_EXT_CPU_NONCE_COUNT=2000000 ./zion-miner --pool ... --no-tui

# Disable auto-tune entirely
ZION_AUTOTUNE=0 ./zion-miner --pool ... --threads 6 --no-tui
```

### Example `--auto-tune` output (Ryzen 5 3600)

```
[auto-tune] CPU: AuthenticAMD "AMD Ryzen 5 3600 6-Core Processor" | physical=6 logical=12 arch=AmdZen | threads=12 nonce_count=5000000
=== ZION Hardware Autotune ===

Detected Hardware:
  GPU:  gfx1010:xnack- (18 CUs, 6128 MB VRAM)
  CPU:  AMD Ryzen 5 3600 6-Core Processor (6 physical / 12 logical cores)
  RAM:  30947 MB

Recommended Settings:
  ZION_GPU_WORK_SIZE=8192
  ZION_SECONDARY_GPU_WORK_SIZE=4194304
  ZION_THREADS=12
  ZION_EXT_CPU_NONCE_COUNT=5000000
```

---

## 5. Claymore-Style Triple Stream Display

### no-TUI mode (stdout)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ZION v3.0.6 Triple Stream                              uptime 03:53 │
├─────────────────────────────────────────────────────────────────────────┤
│  ZION       ZION / deeksha_lite_v1     3.82 MH/s  ███████  1/0        │
│  GPU PROFIT EPIC / progpow              0.00 H/s   ░░░░░░░  0/0        │
│  CPU PROFIT VRSC / verushash            2.00 MH/s  ████░░░  0/0        │
├─────────────────────────────────────────────────────────────────────────┤
│  TOTAL      5.82 MH/s    1 accepted / 0 rejected  (100.0%)             │
│  pool 62.171.141.136:8444   height 8079   latency 86/86 ms             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Per-stream share logging

```
+ [CPU PROFIT] coin=VRSC algo=verushash latency=52ms ACCEPTED
- [GPU PROFIT] coin=EPIC algo=progpow REJECTED reason=stale
+ [ZION] job=8037 height=8037 nonce=123456 latency=12ms
```

### Machine-parseable status line (pro SMOS/agents)

```
session_status iter=362/1000000 uptime_s=233.6 accepted=1 rejected=0
  accept_pct=100.00 hps_overall=1624938.60 hps_10s=3790602.11
  hps_60s=3372682.79 hps_15m=3115712.51 gpu_backend=metal
  gpu_hps=1624938.55 epoch=80 pool_height=8079
```

---

## 6. Soubory upravené v 3.0.6

| Soubor | Změna |
|--------|-------|
| `V3/L1/miner/src/gpu_backend.rs` | `auto_tune_gpu_budget()`, `detect_available_memory_bytes()`, `detect_gpu_vram_bytes()`, `is_memory_hard_algorithm()`, `algorithm_extra_gpu_memory_bytes()`, `algorithm_fits_gpu_budget()`, `reset_gpu_memory_budget()`, VRAM-aware OpenCL/CUDA guard |
| `V3/L1/miner/src/main.rs` | `reset_gpu_memory_budget()` na session start, per-stream stats do `maybe_print_status`, `set_gpu_ext_job`/`set_cpu_ext_job` v external threads, Claymore-style share logging |
| `V3/L1/miner/src/ui.rs` | `print_triple_stream_stats()`, `StreamStats` struct, `log_ext_accepted()`, `log_ext_rejected()`, banner "Triple Stream" |
| `V3/L1/miner/src/banner.rs` | Verze 3.0.6 Triple Stream |
| `V3/L1/miner/src/interactive.rs` | `set_gpu_ext_job()`, `set_cpu_ext_job()`, `build_stream_stats()`, per-stream coin/algorithm tracking |

---

## 7. Co ladit na Ryzenu

### Priority 1: OpenCL VRAM detection
```bash
# Ověř že detect_gpu_vram_bytes() vrací správnou hodnotu
grep "gpu_vram\|global_mem" /tmp/zion_ryzen.log

# Mělo by ukázat:
# gpu_auto_tune sys_ram_mib=16384 available_mib=8000 ...
# (na Linux s 16GB RAM a 6GB GPU)
```

### Priority 2: Dual-stream ProgPow na 6GB GPU
```bash
# Pool by měl poslat EPIC (progpow) na Stream 2
# Check:
grep "ext_gpu_job_received\|ext_gpu_skip\|backend_supports" /tmp/zion_ryzen.log

# Mělo by ukázat:
# ext_gpu_job_received coin=EPIC algo=progpow
# (žádné skip — na OpenCL s 6GB VRAM by ProgPow měl fungovat)
```

### Priority 3: Auto-tune na Linux
```bash
# Available memory na Linux se čte z /proc/meminfo MemAvailable
# Ověř:
cat /proc/meminfo | grep MemAvailable
# MemAvailable:  8000123 kB

# Miner log:
grep "gpu_auto_tune" /tmp/zion_ryzen.log
# gpu_auto_tune sys_ram_mib=16384 available_mib=7800 cpu_threads=6 ...
```

### Priority 4: CPU thread tuning
```bash
# Ryzen 5 3600 (6C/12T):
./zion-miner --pool ... --threads 6 --no-tui  # 6 pro VRSC, 6 pro OS/GPU

# Sleduj VRSC hashrate:
grep "CPU PROFIT" /tmp/zion_ryzen.log
```

---

## 8. Known Issues (M1 8GB)

1. **macOS freeze při extrémně nízké available RAM (<200 MB)**
   - **FIXED v3.0.6:** Auto-tune kill switch — pokud available < 200 MB, GPU se vypne a běží jen CPU
   - `gpu_auto_tune KILL_SWITCH available_mib=150 < 200 — disabling GPU (CPU only mode)`

2. **Reconnect resetuje auto-tune**
   - Při reconnectu se `reset_gpu_memory_budget()` zavolá → budget se přepočítá s novou available
   - Pokud available mezitím klesla, scratchpad bude menší (to je OK — adaptivní)

3. **VRSC CPU threadů vs GPU scratchpad**
   - 4 CPU thready × 75 MB = 300 MB rezervováno pro CPU
   - Na 8GB M1: budget = 600 - 300 = 300 MB → scratchpad 150 MB
   - **Trade-off:** méně threadů = větší GPU scratchpad = vyšší GPU hashrate
   - Doporučení pro 8GB: `--threads 2` (budget 450 MB, scratchpad 225 MB)

4. **Chip detection (M1/M2/M3/M4/M5)**
   - Detekce přes `sysctl -n machdep.cpu.brand_string` → "Apple M1", "Apple M2 Pro", atd.
   - Parsuje se generace (M1, M2, ...) a GPU core count přes `system_profiler`
   - Na non-Apple platformách vrací ("Unknown", 0) → fallback na RAM-based budget

5. **Per-model max budget tabulka**
   - 8GB (jakýkoliv M-chip): 600 MB max
   - 16GB M1: 1800 MB, M2: 2000 MB, M3: 2200 MB, M4: 2400 MB
   - 24GB M4 Pro: 4000 MB
   - 36GB M4 Max: 7000 MB
   - Linux (dedicated GPU): 30% of system RAM (VRAM je separate)

---

## 9. Build Commands

```bash
# macOS Apple Silicon (M1-M5)
cd V3
cargo build --release -p zion-miner --features native-verushash,native-randomx,gpu-metal

# Linux x86_64 s OpenCL (Ryzen + AMD/NVIDIA GPU)
cargo build --release -p zion-miner --features native-verushash,native-randomx,gpu-opencl,native-hashers

# Linux x86_64 s CUDA (Ryzen + NVIDIA GPU)
cargo build --release -p zion-miner --features native-verushash,native-randomx,gpu-cuda,native-hashers

# Linux x86_64 s OpenCL + CUDA
cargo build --release -p zion-miner --features native-verushash,native-randomx,gpu-opencl,gpu-cuda,native-hashers

# CPU only (no GPU)
cargo build --release -p zion-miner --features native-verushash,native-randomx
```

---

## 10. Env Variables

| Variable | Default | Popis |
|----------|---------|-------|
| `ZION_BACKEND` | `auto` | `auto` / `opencl` / `cuda` / `metal` / `cpu` |
| `ZION_AUTOTUNE` | `1` | `0` = disable hardware auto-tune (use manual env vars) |
| `ZION_THREADS` | auto-tuned | CPU thread count (auto: AmdZen=all logical, Intel=all logical, Apple=physical-1) |
| `ZION_EXT_CPU_NONCE_COUNT` | auto-tuned | VerusHash nonce batch size (auto: 5M if ≥8T, 2M if ≥4T, 1M else) |
| `ZION_GPU_WORK_SIZE` | auto-tuned | GPU work size for Stream 1 (auto: nearest_pow2(CUs*512)) |
| `ZION_SECONDARY_GPU_WORK_SIZE` | auto-tuned | GPU work size for Stream 2 (auto: VRAM*0.75/1024 * 1M) |
| `ZION_STREAM1_ENABLED` | `1` | Enable ZION primary stream |
| `ZION_STREAM2_ENABLED` | `1` | Enable GPU external coin stream |
| `ZION_STREAM3_ENABLED` | `1` | Enable CPU external coin stream (VerusHash/RandomX) |
| `ZION_METRICS_REPORT_SECS` | `30` | Interval stats outputu v sekundách |
| `ZION_FORCE_STREAM2` | unset | `1` = povolit Stream 2 i na low-memory |
| `ZION_INTERACTIVE` | `1` | `0` = no-TUI mode (stdout stats) |
| `ZION_RECONNECT` | `true` | `false` = no reconnect on disconnect |
| `ZION_MAX_RECONNECT` | `0` | Max reconnect pokusů (0 = infinite) |
| `ZION_VERBOSE` | `0` | `1` = verbose wire logging |

---

*Generated 2026-07-16 — ZION Miner v3.0.6 Triple Stream*
