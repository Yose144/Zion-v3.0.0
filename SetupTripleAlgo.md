# Triple-Algorithm GPU Mining Setup Guide

## Apple Silicon (Metal) — v3.0.6

**GPU:** Apple M1 (8-core GPU, unified memory, Metal 2)
**Software:** zion-miner v3.0.6 with `gpu-metal` feature
**Algorithms:** Deeksha (ZION) + Blake3/kHeavyHash/Autolykos/ZelHash (external GPU) + VerusHash (VRSC, CPU)
**DAG-based algorithms (ProgPow/KawPow/Ethash): SKIPPED** — unified memory OOM risk → system freeze

### ⚠️ Critical Safety Guard

Metal on Apple Silicon uses **unified memory** (shared with CPU). Allocating a
2GB+ DAG buffer for ProgPow/KawPow/Ethash causes **system freezes** (same class
of bug as RX 5700 XT crash in commit `bf49b9013`).

The miner now has `backend_supports_algorithm()` guard (commit `4209d1dc2`):
- Metal → skips `progpow`, `ethash`, `etchash`, `kawpow`, `evrprogpow`, `meowpow`
- OpenCL/CUDA → all algorithms allowed (dedicated VRAM)

### Build Command

```bash
cargo build --release --features gpu-metal -p zion-miner
```

### Auto-Detect & Launch

```bash
# Auto-detect hardware and configure triple stream
./target/release/zion mine auto --dry-run    # preview
./target/release/zion mine auto              # launch

# Or manual:
ZION_BACKEND=metal \
ZION_GPU_WORK_SIZE=65536 \
ZION_SECONDARY_GPU_WORK_SIZE=65536 \
ZION_THREADS=4 \
ZION_AUTO_MODE=1 \
ZION_STREAM1_ENABLED=1 \
ZION_STREAM2_ENABLED=1 \
ZION_STREAM3_ENABLED=1 \
./target/release/zion-miner --gpu metal --no-tui \
  --pool pool.zionterranova.com:8444 \
  --wallet zion1... \
  --worker m1-rig
```

### Benchmark Results (Apple M1, 5s/algo)

#### Throughput by work_size (KH/s)

| work_size | deeksha_chv3 | deeksha_lite_v1 | ekam_v2 | deeksha_fire | blake3 | kheavyhash | autolykos | zelhash |
|-----------|-------------|-----------------|---------|-------------|--------|------------|-----------|---------|
| 1024      | 2.54        | 2.34            | 2.37    | **3.05**    | 2.39   | 2.37       | 2.36      | 2.55    |
| 4096      | 2.99        | 3.03            | 2.51    | **5.34**    | 3.17   | 2.70       | 2.64      | 2.51    |
| 16384     | 2.73        | 3.08            | 3.01    | **6.22**    | 3.01   | 2.95       | 3.08      | 3.05    |
| 32768     | 2.89        | 3.02            | 2.83    | **6.11**    | 3.06   | 2.96       | 3.05      | 2.97    |
| 65536     | 2.97        | 3.05            | 4.63    | 6.40        | **7.21** | 2.97     | 3.06      | 2.96    |
| 131072    | 3.04        | 2.93            | 3.03    | **6.32**    | 2.92   | 3.03       | 3.05      | 3.09    |
| 262144    | 3.05        | 2.91            | 3.16    | **6.26**    | 3.00   | 2.87       | 2.97      | 2.90    |

#### Best algorithm per work_size

| work_size | Best algorithm   | KH/s  |
|-----------|-----------------|-------|
| 1024      | deeksha_lite_fire | 3.05  |
| 4096      | deeksha_lite_fire | 5.34  |
| 16384     | deeksha_lite_fire | 6.22  |
| 32768     | deeksha_lite_fire | 6.11  |
| **65536** | **blake3**        | **7.21** |
| 131072    | deeksha_lite_fire | 6.32  |
| 262144    | deeksha_lite_fire | 6.26  |

### Key Findings

1. **`deeksha_lite_fire` is the best ZION algorithm** — consistently ~6 KH/s at
   work_size ≥ 4096. ~2x faster than `deeksha_lite_v1` (3 KH/s).

2. **`blake3` spikes at work_size=65536** — 7.21 KH/s (best overall). This is
   the optimal work_size for Blake3 (DCR/ALPH external mining).

3. **Most algorithms plateau at ~3 KH/s** — deeksha_chv3, deeksha_lite_v1,
   kheavyhash, autolykos, zelhash all hover around 2.9-3.1 KH/s regardless of
   work_size. The M1 GPU is compute-bound, not memory-bound for these.

4. **`cosmic_harmony_ekam_deeksha_v2` is unstable** — 2.37 KH/s at ws=1024,
   jumps to 4.63 KH/s at ws=65536, then drops back to 3.03 at ws=131072.
   Non-deterministic — likely Metal kernel scheduling overhead.

5. **DAG-based algorithms safely skipped** — `kawpow`, `ethash`, `progpow` are
   filtered out by `backend_supports_algorithm()` guard. No freeze risk.

6. **work_size=65536 (64K) is the sweet spot** — best blake3 throughput and
   near-best deeksha_lite_fire. Recommended default for M1.

### Optimal Configuration (Apple M1)

```bash
# ZION primary (Stream 1) — deeksha_lite_fire, 64K work size
export ZION_GPU_WORK_SIZE=65536
export ZION_MINER_ALGORITHM=deeksha_lite_fire

# External GPU (Stream 2) — same work size, non-DAG algos only
export ZION_SECONDARY_GPU_WORK_SIZE=65536

# CPU external (Stream 3) — half cores for VerusHash
export ZION_THREADS=4

# Backend
export ZION_BACKEND=metal

# Auto mode
export ZION_AUTO_MODE=1
export ZION_STREAM1_ENABLED=1
export ZION_STREAM2_ENABLED=1
export ZION_STREAM3_ENABLED=1

# Pool
export ZION_POOL_ADDR=pool.zionterranova.com:8444
```

### Supported Coins on Metal (Apple Silicon)

| Coin  | Algorithm    | Stream | Status |
|-------|-------------|--------|--------|
| ZION  | deeksha_lite_fire | 1 (GPU) | ✅ 6.4 KH/s |
| PRL   | pearlhash   | 1 (GPU) | ✅ (PoUW) |
| DCR   | blake3      | 2 (GPU) | ✅ 7.2 KH/s |
| ALPH  | blake3      | 2 (GPU) | ✅ 7.2 KH/s |
| KAS   | kheavyhash  | 2 (GPU) | ✅ 3.0 KH/s |
| ERG   | autolykos   | 2 (GPU) | ✅ 3.1 KH/s |
| FLUX  | zelhash     | 2 (GPU) | ✅ 3.0 KH/s |
| VRSC  | verushash   | 3 (CPU) | ✅ CPU-only |
| XMR   | randomx     | 3 (CPU) | ✅ CPU-only |
| EPIC  | progpow     | —       | ❌ Skipped (DAG) |
| RVN   | kawpow      | —       | ❌ Skipped (DAG) |
| ETC   | ethash      | —       | ❌ Skipped (DAG) |
| EVR   | evrprogpow  | —       | ❌ Skipped (DAG) |
| MEWC  | meowpow     | —       | ❌ Skipped (DAG) |
| CLORE | kawpow      | —       | ❌ Skipped (DAG) |
| QUAI  | kawpow      | —       | ❌ Skipped (DAG) |
| BEAM  | beamhash    | —       | ❌ Skipped (Equihash) |

### Live Test Results (2026-07-15)

```
SHARE_ACCEPTED  job=6622  height=6622  nonce=9840000000298  algo=deeksha_lite_v1  latency_ms=132
shares 1/0 (100.0%)  hashes 331968  pool latency 132ms  uptime 01:25
hashrate 3.90 KH/s (Metal, work_size=1024)
```

- ZION Deeksha share **ACCEPTED** on Metal GPU
- ProgPow (EPIC) **safely skipped** — no DAG allocation, no freeze
- VerusHash (VRSC) CPU mining active (target high, needs longer runtime)
- System stable throughout test

---

## AMD RX 5700 XT (OpenCL) — v3.0.6

**GPU:** AMD RX 5700 XT (gfx1010, 6 GB VRAM, 18 CUs)
**Software:** zion-miner v3.0.6 with `gpu-opencl,native-hashers` features
**Algorithms:** Deeksha (ZION) + ProgPow (EPIC) + VerusHash (VRSC)

### Optimal Configuration

```bash
# Deeksha (ZION) — minimal GPU work_size to free VRAM + GPU time for external
export ZION_GPU_WORK_SIZE=1024          # 256 MiB scratchpad (vs default 2048 MiB)

# External GPU (ProgPow/KawPow) — large work_size for max throughput
export ZION_SECONDARY_GPU_WORK_SIZE=4194304   # 4M (capped internally by VRAM)

# GPU backend
export ZION_BACKEND=opencl

# Pool
export ZION_POOL=62.171.141.136:8444
```

## Build Command

```bash
cargo build --release --features gpu-opencl,native-hashers -p zion-miner
```

> **Important:** Both `gpu-opencl` AND `native-hashers` features are required.
> Without `native-hashers`, DAG loading code is compiled out and ProgPow/KawPow
> cannot function. The `full` feature alias does NOT include `native-hashers`.

## Launch Command

```bash
ZION_GPU_WORK_SIZE=1024 \
ZION_SECONDARY_GPU_WORK_SIZE=4194304 \
target/release/zion-miner \
  --pool 62.171.141.136:8444 \
  --wallet <your-zion-address> \
  --worker <worker-name> \
  --gpu opencl \
  --no-tui \
  --loops 1000000
```

## Performance Results (RX 5700 XT, 6 GB VRAM)

| Config | Deeksha WS | Scratchpad | Ext WS | ProgPow MH/s | Notes |
|--------|-----------|-----------|--------|-------------|-------|
| Default | 8192 | 2048 MiB | 262K | ~1.05 | Original baseline |
| 8k+1M | 8192 | 2048 MiB | 1M | ~1.1 | nonce_offset bug |
| 4k+1M | 4096 | 1024 MiB | 1M | ~2.1 | Less VRAM pressure |
| **1k+4M (optimal)** | **1024** | **256 MiB** | **4M** | **~7.1** | **Best config** |

### Key Findings

1. **Deeksha work_size is the main bottleneck for ProgPow hashrate.**
   - 3 deeksha GPU streams share the same GPU as the ProgPow stream.
   - Larger deeksha work_size = more GPU time consumed by deeksha = less for ProgPow.
   - Reducing from 8192 → 1024 gives ~6x ProgPow speedup.

2. **Deeksha hashrate trade-off is acceptable.**
   - At work_size=1024, deeksha still finds ~42-46 shares/min at diff=1.
   - ZION difficulty is low enough that even minimal GPU work is sufficient.

3. **AuxPow GpuMiner internal work_size cap.**
   - The AuXpow GpuMiner auto-detects max work_size based on VRAM (~3.1M for 6GB).
   - Setting `ZION_SECONDARY_GPU_WORK_SIZE` above this cap has no benefit.
   - The kernel processes `min(batch_size, internal_work_size)` nonces per batch.

4. **VRAM budget (6 GB):**
   - Deeksha scratchpad: 256 MiB (1024 × 256 KiB)
   - ProgPow DAG: ~2 GB (epoch 120)
   - Driver/desktop: ~1 GB
   - Work buffers: ~1 GB
   - Total: ~4.3 GB (safe margin)

## Bugs Fixed (commit e5a9a53bf)

### Bug 1: nonce_offset reset on every pool job re-send
The pool re-sends the same job every ~1 second. The `nonce_offset` was
reset to 0 on each re-send, causing the GPU to re-scan the same nonces
endlessly. Fix: only reset `nonce_offset` when `job_id` or `height`
actually changes.

### Bug 2: nonce_offset over-count
The V3 `work_size` (4M) exceeded the AuXpow GpuMiner's internal
`work_size` (~3.1M). The `nonce_offset` was advanced by the V3 work_size
instead of the actual nonces processed, skipping ~25% of nonce space.
Fix: use `br.nonces_tested` from the GPU backend result, which now
correctly reports `min(actual_batch, miner.internal_work_size())`.

## Troubleshooting

### "OpenCL support not compiled"
Rebuild with `--features gpu-opencl,native-hashers`. The binary may have
been overwritten by a build without these features.

### GPU crash / amdgpu context lost
- Reduce `ZION_SECONDARY_GPU_WORK_SIZE` to 1048576 (1M)
- Reduce `ZION_OCL_VRAM_PCT` to 40 (default 50)
- Check VRAM: `rocm-smi --showmeminfo vram`

### No ProgPow shares found
- EPIC share difficulty is very high (~2.5 billion)
- At 7 MH/s, expected time per share: ~357 seconds (~6 minutes)
- Run for at least 10 minutes to find a share

### Pool connection refused
- Check that zion-node is running: `ssh zion-new 'systemctl status zion-node'`
- Check that zion-pool is running: `ssh zion-new 'systemctl status zion-pool'`
- Node RPC must be on 127.0.0.1:9443 (nginx proxies 8443 → 9443)

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_GPU_WORK_SIZE` | 262144 | Deeksha GPU work_size (threads per batch) |
| `ZION_SECONDARY_GPU_WORK_SIZE` | 262144 | External GPU (ProgPow/KawPow) work_size |
| `ZION_AUXPOW_GPU_WORK_SIZE` | auto | AuXpow GpuMiner internal cap (auto-detected) |
| `ZION_AUXPOW_GPU_VRAM_PCT` | 50 | Percentage of VRAM for AuXpow buffers |
| `ZION_OCL_VRAM_PCT` | 50 | Percentage of VRAM for deeksha scratchpad |
| `ZION_BACKEND` | auto | GPU backend: auto, opencl, cuda, metal, cpu |
