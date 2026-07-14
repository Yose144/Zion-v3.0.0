# Full Revenue AuxPow — Canonical Architecture

> **Status:** Canonical design — 3-stream parallel mining (CPU Verus + GPU ZION + GPU Pearl)
> **Date:** 2026-07-14
> **Supersedes:** `PARALLEL_MINING_ARCHITECTURE.md` (merged here), `DUAL_ALGO_MINING.md` (extended here)
> **Related:** `StatusV3.md`, `AGENTS.md`, `AuXpow/src/types.rs` (ExternalCoin enum)

## 1. Vision — 3-Stream Full Revenue Mining

**All 3 streams go through the ZION pool.** This is critical for revenue
tracking, fee collection, PPLNS distribution, and dashboard integration.
No miner ever connects directly to an external pool — the ZION pool is the
single hub that bridges to all external pools via `AuxPowBridge`.

```
┌──────────────────────────────────────────────────────────────────┐
│                        zion-miner process                         │
│                                                                  │
│  STREAM 1 (GPU)          STREAM 2 (GPU)         STREAM 3 (CPU)   │
│  ┌──────────────┐        ┌──────────────┐      ┌──────────────┐  │
│  │ ZION Deeksha │        │ Pearl PoUW   │      │ Verus / XMR  │  │
│  │ (primary)    │        │ (secondary)  │      │ (tertiary)   │  │
│  │              │        │              │      │              │  │
│  │ OpenCL ctx A │        │ OpenCL ctx B │      │ CPU threads  │  │
│  │ deeksha_lite │        │ pearl_pouw   │      │ verushash /  │  │
│  │ work_size    │        │ _native.cl   │      │ randomx      │  │
│  │ 262144       │        │ work_size    │      │              │  │
│  │              │        │ 262144       │      │              │  │
│  └──────┬───────┘        └──────┬───────┘      └──────┬───────┘  │
│         │                       │                     │          │
│         │  All shares via ZION pool (single TCP conn) │          │
│         └───────────────────────┼─────────────────────┘          │
│                                 ▼                                │
│                    62.171.141.136:8444                           │
│                      ZION stratum pool                           │
│                                                                  │
│  Pool I/O Thread (main)                                          │
│  ├── reads ZION Job (with embedded external_stream)             │
│  ├── if external_stream.coin == "PRL":                          │
│  │     → dispatch to Pearl GPU thread (Stream 2)                 │
│  ├── elif external_stream.algorithm is CPU-only:                │
│  │     → dispatch to tertiary CPU thread (Stream 3)              │
│  ├── else (GPU-capable external):                               │
│  │     → dispatch to secondary GPU thread                        │
│  ├── scans Deeksha on GPU primary (Stream 1)                    │
│  ├── submits ZION shares (Submit → Result)                      │
│  └── submits external shares (ExternalSubmit → ExternalResult)  │
│                                                                  │
│  Pearl GPU Thread (persistent, own OpenCL context)              │
│  ├── recv PearlJob from channel (from external_stream)          │
│  ├── mine PoUW on GPU secondary (pearl_pouw_native.cl)          │
│  └── send PearlProof to main thread → ExternalSubmit            │
│                                                                  │
│  Tertiary CPU Thread (persistent)                               │
│  ├── recv ExternalStreamJob from channel                        │
│  ├── scan on CPU (verushash / randomx)                          │
│  └── send ExternalShareResult to main thread → ExternalSubmit   │
└──────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                    ZION POOL (62.171.141.136:8444)               │
│                                                                  │
│  Per-miner session:                                              │
│  1. issue ZION Job (Deeksha) + embed external_stream             │
│  2. read Submit OR ExternalSubmit from miner                     │
│     - Submit → validate ZION share → PPLNS                      │
│     - ExternalSubmit → AuxPowBridge.forward()                   │
│  3. send Result or ExternalResult                                │
│                                                                  │
│  AuxPowBridge (background, connects to ALL external pools):      │
│  ├── VRSC pool (e.g. LuckPool) → verushash jobs                 │
│  ├── KAS pool (e.g. WoolyPool) → kheavyhash jobs                │
│  ├── DCR pool (e.g. Luxor) → blake3 jobs                        │
│  ├── PRL pool (AlphaPool) → pearl.challenge jobs  ← NEW         │
│  ├── RVN pool (e.g. Suprnova) → kawpow jobs                     │
│  ├── ERG pool (e.g. 2Miners) → autolykos jobs                   │
│  └── ... (auto profit-switching)                                 │
│                                                                  │
│  Revenue tracking:                                               │
│  - routing_snapshot: per-source share counts                    │
│  - src_zion, src_pearl, src_verushash, src_blake3, etc.         │
│  - Pool fee on ALL external revenue                             │
│  - PPLNS distribution includes external revenue                 │
│  - Dashboard reads from /stats endpoint                         │
└──────────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ VRSC pool│  │ AlphaPool│  │ DCR pool │  │ KAS pool │
   │ (LuckPool│  │ (PRL     │  │ (Luxor)  │  │(WoolyPool│
   │  etc.)   │  │  PPLNS)  │  │          │  │  etc.)   │
   └──────────┘  └──────────┘  └──────────┘  └──────────┘
         │              │              │              │
         └──────────────┴──────┬───────┴──────────────┘
                               ▼
                    ┌────────────────────┐
                    │     Dashboard      │
                    │ dashboard.zion-    │
                    │ terranova.com      │
                    │                    │
                    │ Revenue tab:       │
                    │  ZION: 45 MH/s    │
                    │  PRL:  943K tiles │
                    │  VRSC: 2.1 MH/s   │
                    │  Total: $X/day    │
                    │                    │
                    │ Pool fee: X% on   │
                    │ ALL external rev  │
                    └────────────────────┘
```

## 2. Why Pearl Goes Through the ZION Pool

| Reason | Direct to AlphaPool | Through ZION Pool |
|--------|-------------------|-------------------|
| **Revenue tracking** | Pool can't see PRL shares | Pool tracks all PRL shares in routing_snapshot ✅ |
| **Pool fee** | No fee collected | Pool takes fee on PRL revenue ✅ |
| **PPLNS distribution** | PRL shares don't count | PRL shares count toward PPLNS window ✅ |
| **Dashboard** | PRL revenue invisible | Dashboard shows PRL in revenue tab ✅ |
| **Single connection** | Miner needs 2 TCP sockets | Miner uses 1 socket to ZION pool ✅ |
| **Auto profit-switching** | Miner must decide | Pool auto-switches PRL↔VRSC↔KAS based on profit ✅ |
| **Wallet management** | Miner needs PRL wallet | Pool manages PRL wallet, miner just mines ✅ |
| **Reconnect resilience** | AlphaPool disconnect = stream dead | Pool reconnects to AlphaPool, miner unaffected ✅ |

**Key insight:** The ZION pool's `AuxPowBridge` already connects to external
pools for VRSC/KAS/DCR/RVN/ERG. Pearl is just another external coin — the
bridge connects to AlphaPool using `PearlStratum` protocol, receives
`pearl.challenge` jobs, and embeds them in ZION Job messages as
`external_stream` with `coin=PRL, algorithm=pearlhash`.

## 3. Three Independent Revenue Streams

### Stream 1: ZION Deeksha (GPU Primary)

| Property | Value |
|----------|-------|
| **Algorithm** | `deeksha_lite_v1` |
| **Hardware** | GPU (OpenCL context A) |
| **Work size** | 262144 (256K) |
| **Connection** | ZION stratum pool `62.171.141.136:8444` |
| **Protocol** | `zion-v3-stratum/0.2` (Hello → Welcome → Job → Submit → Result) |
| **Revenue** | ZION block rewards (PPLNS) |
| **Thread** | Main thread (pool I/O + GPU scan) |
| **Config** | `ZION_PRIMARY_*` env vars (or legacy `ZION_*`) |

### Stream 2: Pearl PoUW (GPU Secondary) — VIA POOL

| Property | Value |
|----------|-------|
| **Algorithm** | `pearlhash` (Pearl PoUW — noisy GEMM + jackpot hash) |
| **Hardware** | GPU (OpenCL context B) — **kernel in development** (`pearl_pouw_native.cl`, 997 lines) |
| **Work size** | 262144 (256K) — Pearl uses tile-based parallelism |
| **Connection** | **Via ZION pool** — Pearl job arrives as `external_stream` in ZION Job message |
| **Protocol** | ZION stratum extension: `Job.external_stream{coin=PRL}` → `ExternalSubmit{plain_proof_b64}` → `ExternalResult` |
| **Revenue** | PRL tokens — **pool collects fee, distributes via PPLNS** |
| **Thread** | Persistent Pearl GPU thread (receives jobs via channel, sends proofs via channel) |
| **Pool-side** | `AuxPowBridge` connects to AlphaPool (`us2.alphapool.tech:5566`) using `PearlStratum` protocol, receives `pearl.challenge`, forwards `submitPlainProof` |
| **GPU kernel** | `AuXpow/csrc/opencl/pearl_pouw_native.cl` — fully GPU-native pipeline. CPU fallback via `pearl_real_pouw.rs`. |
| **Status** | CPU pipeline working ✅, GPU kernel in development 🔧, pool integration TODO |

**How Pearl flows through the pool:**

```
AlphaPool                    ZION Pool                    Miner
    │                            │                          │
    │  pearl.challenge           │                          │
    │  {seed, difficulty}        │                          │
    │───────────────────────────►│                          │
    │                            │  Job{external_stream{    │
    │                            │    coin=PRL,             │
    │                            │    algorithm=pearlhash,  │
    │                            │    header_hex=seed,      │
    │                            │    target_hex=target}}   │
    │                            │─────────────────────────►│
    │                            │                          │
    │                            │          mine PoUW on GPU│
    │                            │          (pearl_pouw_    │
    │                            │           native.cl)     │
    │                            │                          │
    │                            │  ExternalSubmit{         │
    │                            │    coin=PRL,             │
    │                            │    nonce=tile_idx,       │
    │                            │    hash_hex=jackpot_hash,│
    │                            │    plain_proof_b64=...}  │
    │                            │◄─────────────────────────│
    │                            │                          │
    │  submitPlainProof          │                          │
    │  {plain_proof, mining_job} │                          │
    │◄───────────────────────────│                          │
    │                            │                          │
    │  result (accept/reject)    │                          │
    │───────────────────────────►│                          │
    │                            │  ExternalResult{         │
    │                            │    coin=PRL,             │
    │                            │    accepted=true/false}  │
    │                            │─────────────────────────►│
    │                            │                          │
    │                            │  routing_snapshot:       │
    │                            │  src_pearl += 1          │
    │                            │  revenue_usd += PRL_rev  │
```

### Stream 3: AuxPow External (CPU Tertiary)

| Property | Value |
|----------|-------|
| **Algorithm** | Dynamic — set by `external_stream` in ZION Job message |
| **Typical coins** | VRSC (VerusHash), XMR (RandomX) — **CPU-only algorithms** |
| **Also possible** | DCR (Blake3), KAS (kHeavyHash) — GPU-capable, but GPU busy with ZION + Pearl |
| **Hardware** | CPU threads (VerusHash/RandomX are GPU-resistant by design) |
| **Connection** | Via ZION pool — `external_stream` in Job, shares via `ExternalSubmit` |
| **Revenue** | External coin rewards — **pool collects fee, distributes via PPLNS** |
| **Thread** | Persistent CPU thread (receives jobs via channel) |
| **Config** | Pool-side: `ZION_POOL_AUXPOW_ENABLED=1`, `ZION_AUXPOW_FORCE_COIN=VRSC` |

## 4. Pool Protocol Extension — PearlSubmit

Pearl PoUW proofs are **~178KB base64** — too large for the existing
`ExternalSubmit` message which carries only a 32-byte `hash_hex`.

**New message type** (or extend ExternalSubmit):

```rust
/// Miner → pool: Pearl PoUW proof submission.
/// Like ExternalSubmit but carries the full PlainProof blob.
PearlSubmit {
    miner_id: String,
    worker_name: String,
    coin: String,                    // "PRL"
    algorithm: String,               // "pearlhash"
    external_job_id: String,         // from external_stream
    /// Jackpot hash (32 bytes, big-endian hex) — for quick validation
    hash_hex: String,
    /// Full PlainProof (bincode → base64, ~178KB)
    plain_proof_b64: String,
    /// Mining job metadata (incomplete_header_bytes, target, cert_version)
    mining_job_b64: String,
}

/// Pool → miner: Pearl proof result.
/// Reuses ExternalResult (same structure).
// ExternalResult { accepted, status, coin } — no new message needed
```

**Pool-side forwarding:**

```rust
// In pool session loop, when PearlSubmit is received:
match msg {
    PoolMessage::PearlSubmit { plain_proof_b64, mining_job_b64, .. } => {
        // Forward to AlphaPool via AuxPowBridge
        let outcome = auxpow_bridge.forward_pearl(plain_proof_b64, mining_job_b64);
        let result = match outcome {
            Some(accepted) => ExternalResult { accepted, status: "...", coin: "PRL" },
            None => ExternalResult { accepted: false, status: "bridge_unavailable", coin: "PRL" },
        };
        write_wire_message(&mut writer, &result)?;
    }
    // ... existing Submit, ExternalSubmit, NoSolution handling
}
```

**AuxPowBridge extension:**

```rust
impl AuxPowBridge {
    /// Forward a Pearl PlainProof to AlphaPool.
    /// Uses the PearlStratum protocol client to call submitPlainProof.
    fn forward_pearl(&self, plain_proof_b64: &str, mining_job_b64: &str)
        -> Option<bool>  // Some(accepted), None = bridge unavailable
    {
        let (tx, rx) = mpsc::channel();
        let req = PearlForwardRequest {
            plain_proof_b64: plain_proof_b64.to_string(),
            mining_job_b64: mining_job_b64.to_string(),
            response_tx: tx,
        };
        let _ = self.pearl_forward_tx.send(req);
        rx.recv_timeout(Duration::from_secs(30)).ok()
    }
}
```

## 5. Default Configuration

The **default** mining mode is 3-stream parallel — all through the ZION pool:

```bash
# ── Stream 1: ZION Deeksha (GPU) ──
ZION_PRIMARY_ALGORITHM=deeksha_lite_v1
ZION_PRIMARY_GPU_BACKEND=opencl
ZION_PRIMARY_GPU_WORK_SIZE=262144

# ── Stream 2: Pearl PoUW (GPU) ──
# No miner-side config needed — pool sends PRL jobs via external_stream
# Pool-side: AuxPowBridge connects to AlphaPool automatically
# Miner mines on GPU secondary (pearl_pouw_native.cl) when PRL job arrives
ZION_PEARL_GPU_BACKEND=opencl
ZION_PEARL_GPU_WORK_SIZE=262144

# ── Stream 3: AuxPow External (CPU) ──
# No miner-side config needed — pool sends VRSC/XMR jobs via external_stream
# CPU threads used automatically for verushash/randomx

# ── Common ──
ZION_PROFILE=pool
ZION_POOL_ADDR=62.171.141.136:8444
ZION_PAYOUT_ADDRESS=zion1...
ZION_WORKER_NAME=vega-smos
ZION_THREADS=4                    # CPU threads for stream 3
```

### Pool-side configuration

```bash
# Enable AuxPow bridge (connects to external pools including AlphaPool)
ZION_POOL_AUXPOW_ENABLED=1

# Pearl / AlphaPool connection
ZION_AUXPOW_PEARL_HOST=us2.alphapool.tech
ZION_AUXPOW_PEARL_PORT=5566
ZION_AUXPOW_PEARL_WALLET=prl1pk5t3amreqnqlp0q0l5zcauy2nyszlalux3rlcw93spwtr9mrlywsdesmmp

# External coin priority (profit-switching order)
# Pool auto-selects best coin: PRL, VRSC, KAS, DCR, RVN, ERG...
ZION_AUXPOW_FORCE_COIN=           # empty = auto profit-switch
ZION_AUXPOW_PROFIT_CHECK_INTERVAL_SECS=300
```

### What changed from `DUAL_ALGO_MINING.md`

| Before (DUAL_ALGO_MINING.md) | After (this doc) |
|------------------------------|-------------------|
| `--pearl HOST:PORT:WALLET` on miner | No `--pearl` flag needed — pool sends PRL jobs |
| Miner connects directly to AlphaPool | Pool connects to AlphaPool via AuxPowBridge |
| Miner needs PRL wallet | Pool manages PRL wallet |
| PRL revenue invisible to pool | Pool tracks PRL revenue in routing_snapshot |
| PRL shares don't count for PPLNS | PRL shares count toward PPLNS |
| Two TCP connections from miner | One TCP connection to ZION pool |
| AlphaPool disconnect kills stream | Pool reconnects, miner unaffected |

**`--pearl` flag remains as fallback** for solo Pearl mining (bypass pool),
but the default is pool-routed.

## 6. Thread Architecture (Detailed)

```
┌─────────────────────────────────────────────────────────────┐
│ Main Thread (pool I/O + Deeksha GPU scan)                   │
│                                                             │
│  loop {                                                     │
│    1. read Job from ZION pool                               │
│    2. if Job.external_stream present:                       │
│         if coin == "PRL":                                   │
│           → send PearlJob to Pearl GPU thread channel       │
│         elif algorithm is CPU-only (verushash/randomx):     │
│           → send ExternalStreamJob to CPU thread channel    │
│         else (GPU-capable external):                        │
│           → send ExternalStreamJob to secondary GPU channel │
│    3. scan Deeksha on GPU primary (OpenCL ctx A)            │
│    4. if ZION share found:                                  │
│         → submit Submit to pool → read Result               │
│    5. if no solution:                                       │
│         → send NoSolution to pool                           │
│    6. check all share channels (try_recv, non-blocking):    │
│         - Pearl proof channel → submit PearlSubmit          │
│         - CPU external share channel → submit ExternalSubmit│
│         - GPU external share channel → submit ExternalSubmit│
│  }                                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Pearl GPU Thread (persistent — own OpenCL context B)        │
│                                                             │
│  loop {                                                     │
│    1. recv PearlJob from channel (blocking)                 │
│    2. parse seed + difficulty from external_stream          │
│    3. mine PoUW on GPU secondary:                           │
│       - if GPU kernel available: pearl_pouw_native.cl       │
│       - else: CPU fallback (pearl_real_pouw.rs)             │
│    4. if jackpot hash meets target:                         │
│       build PlainProof (Merkle proofs for sampled rows)     │
│       serialize → bincode → base64 (~178KB)                 │
│       → send PearlProof to main thread channel              │
│    5. loop (try next nonce/tile)                            │
│  }                                                          │
│                                                             │
│  No direct TCP connection — all I/O via main thread.        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Tertiary CPU Thread (persistent — Verus/XMR/etc)            │
│                                                             │
│  loop {                                                     │
│    1. recv ExternalStreamJob from channel (blocking)        │
│    2. parse header + target                                 │
│    3. scan on CPU (verushash / randomx)                     │
│    4. if share found:                                       │
│         → send ExternalShareResult to main thread channel   │
│    5. advance nonce                                         │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

## 7. GPU Backend Manager — Tri-Context

```rust
pub struct TriGpuManager {
    /// Stream 1: ZION Deeksha — created at startup, never switched.
    primary: Option<Box<dyn GpuMiner>>,
    primary_algo: String,

    /// Stream 2: Pearl PoUW — created lazily when first PRL job arrives.
    /// Uses pearl_pouw_native.cl kernel (or CPU fallback).
    pearl: Option<Box<dyn GpuMiner>>,
    pearl_algo: String,

    /// Stream 3: AuxPow external GPU (if algorithm is GPU-capable).
    /// Only used when external_stream algorithm is NOT cpu-only
    /// AND NOT pearlhash (pearl has its own slot).
    /// For verushash/randomx, this is None and CPU is used instead.
    secondary: Option<Box<dyn GpuMiner>>,
    secondary_algo: String,

    kind: GpuBackendKind,
    primary_work_size: usize,
    pearl_work_size: usize,
    secondary_work_size: usize,
}
```

**GPU scheduling:** AMD Vega 64 (gfx900) has 64 CUs, 8GB VRAM.
- Deeksha kernel: ~4GB VRAM (scratchpad), ~5ms per batch
- Pearl kernel: ~2GB VRAM (matrices), ~50ms per attempt
- Both run concurrently via OpenCL hardware scheduler

## 8. Per-Stream Metrics

```rust
struct HashrateTracker {
    // Stream 1: ZION Deeksha
    zion_accepted: AtomicU64,
    zion_rejected: AtomicU64,
    zion_hashes: AtomicU64,

    // Stream 2: Pearl PoUW
    pearl_accepted: AtomicU64,
    pearl_rejected: AtomicU64,
    pearl_attempts: AtomicU64,     // PoUW attempts (not hashes)

    // Stream 3: AuxPow external
    ext_accepted: AtomicU64,
    ext_rejected: AtomicU64,
    ext_hashes: AtomicU64,
    ext_coin: Mutex<String>,       // "VRSC", "XMR", "DCR", etc.
    ext_algorithm: Mutex<String>,

    // Legacy aggregate (backward compat)
    accepted_shares: AtomicU64,    // = zion + pearl + ext
    rejected_shares: AtomicU64,
}
```

### Dashboard output

```
┌──────────────────────────────────────────────────┐
│  ZION Miner — vega-smos                          │
│                                                  │
│  Stream 1: ZION Deeksha (GPU)                    │
│    Hashrate: 45.2 MH/s   Shares: 823A/2R        │
│                                                  │
│  Stream 2: Pearl PoUW (GPU)                      │
│    Hashrate: 943K tiles/s  Proofs: 12A/1R       │
│    Revenue: ~$0.30/day                           │
│                                                  │
│  Stream 3: Verus (CPU)                           │
│    Hashrate: 2.1 MH/s    Shares: 45A/0R         │
│    Revenue: ~$0.15/day                           │
│                                                  │
│  Total Revenue: ~$0.45/day (all via pool)       │
│  Pool fee: 2% on external revenue               │
│  ZION blocks: 3 found                            │
│  PPLNS: all shares count (ZION + PRL + VRSC)    │
└──────────────────────────────────────────────────┘
```

## 9. Pool-Side Architecture

### AuxPowBridge — Multi-Pool Hub

```
┌─────────────────────────────────────────────────────────────┐
│ AuxPowBridge (runs in ZION pool server)                     │
│                                                             │
│  External pool connections:                                 │
│  ├── AlphaPool (PRL) — PearlStratum protocol                │
│  │   • receives pearl.challenge {seed, difficulty}          │
│  │   • forwards submitPlainProof {plain_proof, mining_job}  │
│  │   • PRL wallet: prl1pk5t3amreqnqlp0q0l5zcauy2nyszlalux3  │
│  │                                                          │
│  ├── VRSC pool — zcashstratum protocol                      │
│  ├── KAS pool — stratum protocol                            │
│  ├── DCR pool — stratum protocol                            │
│  ├── RVN pool — ethstratum protocol                         │
│  ├── ERG pool — stratum protocol                            │
│  └── ... (auto profit-switching every 5 min)                │
│                                                             │
│  Job queue:                                                 │
│  pop_job() → returns ExternalJob for current best coin      │
│  • If PRL is most profitable → returns PRL job              │
│  • If VRSC is most profitable → returns VRSC job            │
│  • Pool embeds it in ZION Job as external_stream            │
│                                                             │
│  Share forwarding:                                          │
│  forward(ShareForwardRequest) → external pool               │
│  forward_pearl(plain_proof_b64, mining_job_b64) → AlphaPool │
│                                                             │
│  Revenue tracking:                                          │
│  • Every accepted share increments routing_snapshot          │
│  • src_pearl, src_verushash, src_blake3, etc.               │
│  • Revenue USD calculated per coin                          │
│  • Pool fee deducted from external revenue                  │
│  • Net revenue distributed via PPLNS                        │
└─────────────────────────────────────────────────────────────┘
```

### Profit Switching with Pearl

Pearl (PRL) is now part of the auto profit-switching rotation:

```rust
// In AuxPowBridge profit check (every 5 min):
let estimates = fetch_live_profit_estimates();
// Estimates now include PRL:
//   PRL: revenue_per_day_usd=0.30, power_cost=0.05
//   VRSC: revenue_per_day_usd=0.15, power_cost=0.03
//   KAS: revenue_per_day_usd=0.85, power_cost=0.10
//   DCR: revenue_per_day_usd=0.45, power_cost=0.08

let best = select_best_coin(&estimates, current, hysteresis_pct);
// If KAS is best → bridge connects to KAS pool
// If PRL is best → bridge connects to AlphaPool
// Miner automatically mines whatever coin the pool sends
```

**Important:** When PRL is the active external coin, the miner's GPU
secondary context runs the Pearl PoUW kernel. When KAS is active instead,
the GPU secondary runs kheavyhash. The pool decides, the miner adapts.

## 10. Supported Coin Matrix

| Stream | Coin | Algorithm | Hardware | Pool Connection | Revenue Tracking |
|--------|------|-----------|----------|-----------------|------------------|
| 1 | ZION | deeksha_lite_v1 | GPU | ZION stratum (direct) | src_zion ✅ |
| 2 | PRL | pearlhash (PoUW) | GPU | ZION pool → AlphaPool | src_pearl ✅ (NEW) |
| 3 | VRSC | verushash | CPU | ZION pool → VRSC pool | src_verushash ✅ |
| 3 | XMR | randomx | CPU | ZION pool → XMR pool | src_randomx ✅ |
| 3 | KAS | kheavyhash | GPU* | ZION pool → KAS pool | src_kheavyhash ✅ |
| 3 | DCR | blake3 | GPU* | ZION pool → DCR pool | src_blake3 ✅ |
| 3 | RVN | kawpow | GPU* | ZION pool → RVN pool | src_kawpow ✅ |
| 3 | ERG | autolykos | GPU* | ZION pool → ERG pool | src_autolykos ✅ |
| 3 | ETC | ethash | GPU* | ZION pool → ETC pool | src_ethash ✅ |
| 3 | FLUX | zelhash | GPU* | ZION pool → FLUX pool | src_zelhash ✅ |
| 3 | EPIC | progpow | GPU* | ZION pool → EPIC pool | src_progpow ✅ |

**GPU*** = Uses GPU secondary slot (when Pearl is NOT active).
When Pearl IS active (profit-switching selected PRL), GPU secondary is
occupied by Pearl, and GPU-capable external coins fall back to CPU or
are skipped (pool won't send KAS+PRL simultaneously — only one external
coin at a time per miner).

## 11. Implementation Plan

### Phase 1: Pool-Side Pearl Integration (3-4h)
- [ ] Add PRL to `AuxPowBridge` — connect to AlphaPool via `PearlStratum`
- [ ] Receive `pearl.challenge` → convert to `ExternalJob` → queue
- [ ] Add `PearlSubmit` message to `PoolMessage` enum
- [ ] Pool session loop: handle `PearlSubmit` → `forward_pearl()` → `ExternalResult`
- [ ] Add `forward_pearl()` to `AuxPowBridge` (calls `submitPlainProof` on AlphaPool)
- [ ] Add PRL to profit-switching rotation in `run_auxpow_bridge()`
- [ ] Add `src_pearl` to `routing_snapshot` revenue tracking
- [ ] Pool-side config: `ZION_AUXPOW_PEARL_*` env vars

### Phase 2: Miner-Side Pearl GPU Thread (2-3h)
- [ ] Remove `--pearl` direct connection path (keep as fallback)
- [ ] Add Pearl GPU thread that receives jobs from `external_stream` channel
- [ ] When `external_stream.coin == "PRL"`: dispatch to Pearl GPU thread
- [ ] Pearl GPU thread: parse seed/difficulty → mine PoUW → build PlainProof
- [ ] Send `PearlSubmit` to main thread → submit to pool
- [ ] Use `pearl_pouw_native.cl` kernel (or CPU fallback)

### Phase 3: Config + TriGpuManager (2-3h)
- [ ] Add `primary_*`, `pearl_*`, `secondary_*` fields to `MinerConfig`
- [ ] Implement `TriGpuManager` (replaces `GpuBackendManager`)
- [ ] `primary()` — Deeksha backend (never switches)
- [ ] `pearl()` — Pearl backend (lazy create when PRL job arrives)
- [ ] `ensure_secondary(algo)` — external GPU backend (for KAS/DCR/etc)
- [ ] Map legacy env vars to primary (backward compat)

### Phase 4: Clean Up Thread Architecture (2h)
- [ ] Remove dead `mine_external_stream_gpu()` function
- [ ] Make all external stream threads **persistent** (not per-iteration)
- [ ] Remove `gpu_switch_algorithm` spam from main loop
- [ ] Non-blocking share submission (write without blocking read)

### Phase 5: Per-Stream Metrics (1h)
- [ ] Split `HashrateTracker` into zion/pearl/ext counters
- [ ] Update telemetry/status output
- [ ] Update Prometheus metrics endpoint

### Phase 6: Dashboard Update (1h)
- [ ] Add PRL to revenue tab (already partially done — `ef0ba601b`)
- [ ] Show 3-stream hashrate display
- [ ] Per-stream share counts + revenue

### Phase 7: Build, Deploy, Verify (1h)
- [ ] Docker SMOS build
- [ ] Deploy pool + miner to rig 518837
- [ ] Verify: ZION Deeksha shares accepted
- [ ] Verify: PRL PoUW proofs accepted via pool → AlphaPool
- [ ] Verify: VRSC shares accepted via pool → external
- [ ] Verify: Dashboard shows all 3 revenue streams
- [ ] Verify: routing_snapshot shows src_pearl, src_zion, src_verushash

## 12. What Gets Removed / Cleaned Up

| Removed | Reason |
|---------|--------|
| `mine_external_stream_gpu()` (dead code) | Unused, replaced by persistent thread |
| `GpuBackendManager.ensure_algorithm()` | Replaced by `TriGpuManager` |
| `gpu_switch_algorithm` in main loop | Primary never switches |
| Hardcoded `batch_size = 4_186_112` | Use config work_size |
| `--pearl` direct connection (default) | Replaced by pool-routed PRL (flag kept as fallback) |
| `PARALLEL_MINING_ARCHITECTURE.md` | Merged into this doc |

## 13. Backward Compatibility

- `ZION_MINER_ALGORITHM` → maps to `ZION_PRIMARY_ALGORITHM`
- `ZION_GPU_WORK_SIZE` → maps to `ZION_PRIMARY_GPU_WORK_SIZE`
- `ZION_GPU_BACKEND` → maps to `ZION_PRIMARY_GPU_BACKEND`
- `--pearl` flag still works (direct AlphaPool, bypass pool) — fallback mode
- `ZION_PROFILE=pool` still works
- Pool protocol extended (new `PearlSubmit` message) — old miners ignore it
- Old miner binaries can still connect to updated pool (they just won't mine PRL)
- SMOS wrapper script: no changes needed (pool sends PRL automatically)

## 14. Relationship to Existing Docs

| Document | Status | Relationship |
|----------|--------|--------------|
| `DUAL_ALGO_MINING.md` | Extended | Pearl PoUW algorithm details remain canonical there. Direct `--pearl` mode documented as fallback. This doc is the canonical architecture. |
| `StatusV3.md` | Active | References this doc for mining architecture |
| `AGENTS.md` | Active | Should reference this doc |
| `AuXpow/src/types.rs` | Active (code) | `ExternalCoin::PRL` already exists ✅ |
| `AuXpow/src/auxpow_client.rs` | Active (code) | `PearlStratum` protocol already implemented ✅ |
| `AuXpow/csrc/opencl/pearl_pouw_native.cl` | In development | GPU kernel for Stream 2 |

## 15. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| 3 OpenCL contexts on one GPU | Driver crash / OOM | Vega 64 8GB: Deeksha ~4GB + Pearl ~2GB = 6GB. Monitor VRAM. Fallback: disable Pearl if VRAM < 2GB free. |
| Pearl GPU kernel not ready | Stream 2 runs on CPU (slow) | CPU fallback via `pearl_real_pouw.rs`. GPU kernel in active development. |
| PearlSubmit ~178KB message | Pool socket buffer pressure | Pool reads in loop, handles message immediately. TCP buffer handles 178KB fine. |
| AlphaPool disconnect | Stream 2 pauses | AuxPowBridge auto-reconnects. Profit-switcher may switch to VRSC/KAS instead. Miner unaffected. |
| Pool fee on Pearl revenue | Reduced miner payout | Fee is configurable (`ZION_POOL_FEE_PCT`). Default 2%. Miner sees net revenue on dashboard. |
| Profit switching PRL↔VRSC | GPU secondary switches algorithm | `TriGpuManager::pearl()` and `ensure_secondary()` handle lazy recreation. Only one external coin active at a time. |

## 16. Implementation Status (2026-07-14)

### 3-Stream Parallel Mining: LIVE

| Stream | Algorithm | GPU/CPU | Status | Verified |
|--------|-----------|---------|--------|----------|
| ZION (main) | Deeksha lite v1 | GPU (OpenCL) | ✅ Live | Shares accepted on Edge pool |
| VRSC (VerusHash) | verushash v2.2 | CPU (AES-NI) | ✅ Live | Shares accepted via pool → LuckPool |
| PRL (Pearl PoUW) | pearlhash | CPU fallback | ✅ Live | Proofs submitted via pool → AlphaPool |
| DCR (Blake3) | blake3 | GPU (OpenCL) | ✅ Live | Shares accepted via pool → Woolypooly |

### ProgPow/EPIC: COMPLETE (Pool-Side + Miner-Side)

**Miner-side (fully implemented, compiles clean):**
- ✅ CPU harness: `scan_progpow` + `scan_progpow_best` in `miner_harness.rs`
- ✅ GPU backend: `is_external_algorithm()` includes "progpow" in `gpu_backend.rs`
- ✅ GPU backend: `mine_batch()` handles progpow with DAG in `OpenClExternalMiner`
- ✅ GPU backend: `update_epoch()` calculates progpow epoch (height / 30000)
- ✅ GPU miner: `build_progpow_kernel()` + `set_progpow_dag()` in `gpu_miner.rs`
- ✅ GPU miner: mix_hash reading for progpow shares
- ✅ DagManager: `ensure_progpow_dag()` — dedicated ProgPow DAG path (separate GPU buffer + disk cache)
- ✅ OpenMP parallel DAG generation in `etchash_native.c` (12-core speedup, epoch 120 ~2 GB in ~4 min)
- ✅ Miner main.rs: persistent `progpow_gpu_thread` with DAG management
- ✅ Miner main.rs: progpow dispatch routing in external stream
- ✅ Miner main.rs: `ExternalShareResult` includes `mix_hash` field
- ✅ Miner main.rs: `submit_external_share` sends `mix_hash_hex` to pool
- ✅ Pool server: `ProgPowExternal` revenue source + `EPIC` → progpow mapping
- ✅ Pool server: share routing stats for EPIC (`src_progpow`)
- ✅ GPU kernel: `progpow_kernel.cl` exists and is compiled

**Pool-side COMPLETE — EpicStratum TLS protocol implemented (2026-07-14):**
- ✅ `de.epicmine.io:3334` JSON-RPC 2.0 over TLS — implemented in `AuxPowClient`
- ✅ TLS via `tokio-rustls` + `webpki-roots` (aws-lc-rs CryptoProvider)
- ✅ EPIC methods: `login`, `getjobtemplate` (fire-and-forget), `submit`, `keepalive`
- ✅ String ID handling (EPIC sends `"0"`, `"1"`, `"epicmine_stratum"`)
- ✅ Nested difficulty array parsing: `[["cuckoo",3],["randomx",N],["progpow",N]]`
- ✅ Seed hash as integer array → hex string conversion
- ✅ Algorithm forced to "progpow" (EPIC job covers all 3 algos)
- ✅ Username length handling (5-20 chars, wallet truncation)
- ✅ E2E verified on Edge: login → job received → queued → forwarded to miners

**Commits:** `54514c3fc` (EpicStratum TLS), `41c350b97` (protocol fixes)
**Full report:** [`docs/3.0.6/EPIC_STRATUM_TLS_REPORT.md`](./docs/3.0.6/EPIC_STRATUM_TLS_REPORT.md)

### Build & Deploy Status

- Pool server: Built on Edge (62.171.141.136), binary at `/usr/local/bin/zion-pool-server`
- Miner: Built locally with `--features gpu-opencl,native-hashers`, compiles clean (warnings only)
- Miner: ProgPow DAG loaded from disk cache, GPU mining active (15000+ batches, 0 errors)
- Miner: Deployed to Edge server (`/usr/local/bin/zion-miner`, libgomp linked)
- Docker SMOS package: `zion-miner-v3.0.35-pearl-pool-routed.zip` on Edge
- Git commit: `c935a7c0f` (routing stats fix) + pending ProgPow commit

### Key Files Modified for ProgPow

| File | Change |
|------|--------|
| `AuXpow/src/miner_harness.rs` | Added `scan_progpow` + `scan_progpow_best`, import `hash_progpow` |
| `AuXpow/src/gpu_miner.rs` | Added progpow to mix_hash reading section |
| `V3/L1/miner/src/gpu_backend.rs` | Added progpow to `is_external_algorithm`, `mine_batch`, `update_epoch`, epoch hint |
| `V3/L1/miner/src/main.rs` | Added `progpow_gpu_thread`, dispatch routing, `mix_hash` in `ExternalShareResult` |
