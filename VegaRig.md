# Vega Rig (SMOS) — Complete Configuration & Architecture Guide

**Last updated:** 2026-07-17
**Status:** ✅ Deeksha GPU 25 KH/s + 98.8% accept — E2E working on i066d
**Goal:** Triple-stream mining (ZION GPU + EPIC GPU + VRSC CPU) on AMD RX Vega 64

---

## 1. Hardware

| Component | Value |
|-----------|-------|
| **GPU** | AMD Radeon RX Vega 64 (gfx900, 8 GB HBM2, 64 CUs, Samsung memory) |
| **GPU BIOS** | 113-D0500100-103 |
| **CPU** | Intel Pentium G4560 @ 3.50GHz (Kaby Lake, 2C/4T) |
| **CPU ISA** | SSE4.2, AES-NI — **NO AVX, AVX2, BMI1, BMI2, FMA** |
| **Motherboard** | ASRock H110 Pro BTC+, BIOS P1.60 |
| **RAM** | 8 GB |
| **Disk** | SanDisk Ultra 15 GB (~1 GB free) |
| **OS** | Ubuntu 22.04.5 LTS, SMOS kernel 5.15.80-sm#066d |
| **AMD Driver** | amd21.50.2r5.16.16 (ROCm 5.x) — **i066d image** |

### Network

| Property | Value |
|----------|-------|
| Public IP | 109.81.31.210 (dynamic, behind NAT) |
| LAN IP | 192.168.1.113 |
| SSH | Times out from internet (NAT) — use SMOS API |
| SMOS Rig ID | 518837 |
| SMOS Group | ZionLiteFire (ID 1773590) |

### SMOS API

```
Base URL:  https://api.simplemining.net
Auth:      X-AUTH-TOKEN: api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8
Rig ID:    518837
Group ID:  1773590
```

Key endpoints:
- `GET /rigs/518837` — rig details + console (base64 in `redisData.console`)
- `PATCH /rigs/execute-command` — `{"rigIds":[518837],"commandId":7,"commandOptions":"..."}`
- `PATCH /rigs/execute-reboot` — `{"rigIds":[518837]}`
- `PATCH /rigs/execute-reload` — `{"rigIds":[518837]}`
- `GET /rig-groups/user-list` — list groups
- `PUT /rig-groups/1773590` — update group config (NOT PATCH)

---

## 2. Overclock Settings (SMOS)

**Current (i066d, stable, 25 KH/s):**

| Parameter | Value | Notes |
|-----------|-------|-------|
| Core Clock | 1500 MHz | GPU boosts to 1630MHz (DPM auto-boost) |
| Memory Clock | 950 MHz | Max stable on i066d (>=1000 crashes MC to 800) |
| Power Limit | **100** | **100% TDP** — NOT 1-7 (DPM stage, crashes MC!) |
| Vddc | 950 mV | Stable at ~98W |
| Fan | 40% | GPU temp 50C |
| Temp Target | 65C | |

> **CRITICAL:** PL values 1-7 = DPM power stage (crashes MC to 800 MHz on i066d).
> PL=100 = 100% TDP percentage (correct for Vega 64).
> Full reboot required after each OC change (reload alone doesn't reset DPM table).

### OC Profile History

| Phase | Core | Memory | Vddc | PowerLimit | KH/s | Notes |
|-------|------|--------|------|------------|------|-------|
| UltraSafe | 1050 | 800 | 900 | 1 | - | Baseline stable |
| Balanced | 1100 | 900 | 920 | 1 | - | |
| Optimized | 1150 | 945 | 940 | 2 | - | |
| TuneUp (old, i088) | 1250 | 950 | 900 | 3 | 0 | GPU hung (driver bug) |
| i066d v1 | 1400 | 950 | 950 | 100 | 20.4 | First working |
| i066d v2 | 1500 | 950 | 950 | 100 | 20.0 | Stable, 100% accept |
| **i066d v3 (current)** | **1500** | **950** | **950** | **100** | **25.0** | rotate()+vload4+ws=16384, no atomics ext |

---

## 3. Vega 64 Architecture (gfx900 / GCN5)

### GCN vs RDNA — Critical Differences

| Aspect | GCN (Vega gfx900) | RDNA (gfx1010+) |
|--------|-------------------|-----------------|
| **Wave size** | 64 (wave64) | 32 (wave32) |
| **Optimal local_ws** | **64** | 128 |
| **Work size cap** | 16384 | Unlimited (VRAM-bound) |
| **Build flags** | `-cl-std=CL1.2 -cl-mad-enable` (conservative) | Same (fast-relaxed-math breaks fusion) |
| **GCN workarounds** | Required (`-DZION_GCN_WORKAROUNDS`) | Not needed |
| **bpermute** | `__builtin_amdgcn_ds_bpermute` available but **DISABLED on SMOS** (causes GPU hangs) | Works |
| **Barrier behavior** | Strict — all threads must reach barrier | More forgiving |
| **64-bit arithmetic** | Requires workarounds | Native |
| **Pointer casts** | Problematic (compiler bugs) | Safe |

### GPU Compute Units

- **Vega 64:** 64 CUs (vs RX 5700 XT's 18 CUs)
- **Work size formula:** `nearest_pow2(CUs × 512)`
  - Vega 64: `nearest_pow2(64 × 512 = 32768) = 32768` → capped at 16384 by GCN
  - RX 5700 XT: `nearest_pow2(18 × 512 = 9216) = 8192`
- **GCN hard cap in code:** 16384 (see `gpu_backend.rs` line 1976)
- **Current setting:** `ZION_GPU_WORK_SIZE=16384` — fills 4 wave64 per CU, optimal for Vega 64 on i066d (24-25 KH/s)

### GCN Workarounds (in kernel code)

The `-DZION_GCN_WORKAROUNDS` flag is auto-set when device name contains `vega`, `gfx6`-`gfx9`, `polaris`, `fiji`, `tonga`, `ellesmere` (see `gpu_backend.rs` lines 2057-2068).

Workarounds in `cosmic_harmony_deeksha.cl`:
- Byte-level operations instead of ulong-width
- `uint` counter instead of `ulong` in Blake3
- `__attribute__((noinline))` on critical functions
- `int` instead of `long` in LayerNorm/isqrt_floor

---

## 4. Mining Streams

### Current Configuration

| Stream | Coin | Algorithm | Status | Notes |
|--------|------|-----------|--------|-------|
| **Stream 1** | ZION | `deeksha_lite_v1` (GPU OpenCL) | **ACTIVE** | Primary revenue |
| **Stream 2** | EPIC | `progpow` (GPU OpenCL) | **DISABLED** | `ZION_STREAM2_ENABLED=0` — GPU hang |
| **Stream 3** | VRSC | `verushash` (CPU) | **ACTIVE** | AuxPoW via LuckPool |

### Why Stream 2 is Disabled

The ProgPow kernel hangs on Vega/SMOS:
1. Kernel compiles successfully
2. DAG loads from cache
3. `q.finish()` blocks forever — GPU stops responding (error d8)
4. `always_inline` fix on `progPowLoop` did NOT resolve it
5. `USE_AMD_BPERMUTE` disabled (share+barrier fallback)
6. `GROUP_SIZE=128` (256 deadlocks on SMOS)

**Root cause (unsolved):** Barrier/synchronization pattern in ProgPow kernel incompatible with SMOS OpenCL compiler (code object manager) for gfx900. Needs deeper investigation.

### Environment Variables (SMOS wrapper 42 — current, 25 KH/s)

```bash
# Stream control
export ZION_STREAM2_ENABLED=0          # Disable EPIC ProgPow (GPU hang)
export ZION_STREAM3_ENABLED=0          # Disable CPU external stream

# Deeksha GPU config (25 KH/s on Vega 64 i066d)
export ZION_GPU_EARLY_BREAK=0           # Full batch, no early break
export ZION_GPU_WORK_SIZE=16384         # 4 waves per CU (64 CUs × 64 wave × 4)
export ZION_NONCE_COUNT=65536           # 4× work_size
export ZION_NONCE_COUNT_MIN=65536       # Fixed — no auto-tune shrinking
export ZION_NONCE_COUNT_MAX=65536
export ZION_GPU_MAX_BATCH=65536         # 4 chunks of 16384 (double-buffered)
export ZION_GPU_NO_STREAM_BYPRODUCT=1   # Disable byproduct work (zeros weights)
export ZION_NONCE_AUTOTUNE=false        # Disable auto-tune (keeps fixed batch)

# General SMOS settings
export ZION_GPU_BACKEND=opencl
export ZION_PROFILE=pool
export ZION_LOOP_COUNT=1000000
export ZION_METRICS_REPORT_SECS=30
export ZION_OCL_BUILD_OPTS="-cl-std=CL1.2 -cl-mad-enable"
export ZION_IGNORE_GPU_SELF_TEST_FAIL=1
export ZION_VERBOSE=1
export ZION_INTERACTIVE=0
export ZION_MINER_ALGORITHM=deeksha_lite_v1
```

> **CRITICAL — cl_khr_int64_base_atomics:** This OpenCL extension MUST remain
> DISABLED in the kernel. Enabling it causes the SMOS AMD OpenCL compiler to
> generate broken/slow code on gfx900 (i066d), dropping hashrate from 25 KH/s
> to ~1 KH/s. The extension is not used by the kernel (no atomics calls).
>
> **CRITICAL — rotate() vs bit-shift:** The kernel uses `rotate(long,long)` for
> ROL64, which maps to the GCN `v_alignbyte` instruction. The bit-shift version
> (`(x << n) | (x >> (64-n))`) is ~50% slower on gfx900. The bit-shift was
> introduced for i088 compatibility but is unnecessary on i066d.
>
> **CRITICAL — vload4/vstore4:** Vectorized loads/stores from `__private*` work
> fine on i066d (ROCm 5.x). They were disabled for i088 (ROCm 6.x) compatibility
> but are safe and faster on i066d.

---

## 5. Deeksha Kernel Settings (Stream 1)

### Kernel Parameters

| Parameter | Value | Source |
|-----------|-------|--------|
| Scratchpad size | 256 KiB (262,144 bytes) | `deeksha_lite.cl` |
| Block count | 8,192 | |
| Block size | 32 bytes | |
| Passes | 2 (forward + backward) | |
| Random reads | 64 | |
| Thermal iters | 16,384 (optimized from 65,536) | `deeksha_lite_fire.cl` |
| VRAM % | 65% default (configurable via `ZION_OCL_VRAM_PCT`) | `gpu_backend.rs` |

### 30khs Patch Optimizations (3 commits, RX 5700 XT)

1. **SHA3-512 specialization for 65-byte input** (`e54950dfb`)
   - `sha3_512_65()` eliminates 65 conditional branches
   - Gain: 11.24 → 19.42 KH/s (+73%)

2. **Sequential passes register caching + inline keccak** (`7ba4d5ea8`)
   - Cache prev/next block in register (`ulong4`)
   - `keccak_f1600` marked `__attribute__((always_inline))`
   - Gain: 19.42 → 20-22 KH/s (+82-96%)

3. **Double-buffered async readback** (`a6d8ad35d`)
   - Two output buffers (A/B) + dedicated read queue
   - GPU computes chunk N+1 while CPU processes chunk N
   - Gain: 20-22 → 28-30 KH/s (+50%)

### Vega 64 (gfx900, i066d) — 25 KH/s Root Cause & Fix (commit `a8e9d0594`)

The Vega rig was stuck at **12-13 KH/s** for weeks. The 20 KH/s target (achieved
by an old binary) was finally traced to **three compiler-sensitive issues**:

| Issue | Symptom | Fix | Impact |
|-------|---------|-----|--------|
| `cl_khr_int64_base_atomics` enabled | AMD compiler generates broken/slow code on gfx900/i066d → ~1 KH/s | Disable the extension (kernel uses no atomics — it was a leftover) | +14 KH/s |
| ROL64 via bit-shift `(x<<n)\|(x>>64-n)` | 2 instructions instead of 1; slower than `v_alignbyte` | Revert to `rotate((long)x,(long)n)` (maps to GCN `v_alignbyte`) | +3-5 KH/s |
| `local_ws=256` (wave32 assumption) | Suboptimal wavefront packing on GCN wave64 | `local_ws=64` (one wave64 per WG) | +2-3 KH/s |

**Result:** 12-13 KH/s → **25.78 KH/s peak / 24.33 KH/s stable, 98.8% accept rate**

> The bit-shift ROL64 and `local_ws=256` were introduced in commit `86f46c05b`
> for i088 (ROCm 6.x) compatibility, where `rotate()` produced 126 H/s. On i066d
> (ROCm 5.x), `rotate()` works correctly and is faster. The two SMOS images
> require **different kernel configs** — see "i066d vs i088" below.

### Work Size Benchmarks

**RX 5700 XT (18 CUs, RDNA1):**

| Work Size | KH/s | Notes |
|-----------|------|-------|
| 4096 | 5.28 | Too few wavefronts |
| **8192** | **28-30** | **Optimal** for 5700 XT |
| 16384 | 8.81 | VRAM pressure, worse occupancy |

**Vega 64 (64 CUs, gfx900, i066d):**

| Work Size | KH/s | Notes |
|-----------|------|-------|
| 8192 | ~20 | Old binary target (commit `32fc80db0`) |
| **16384** | **24-25** | **Optimal** for Vega 64 (4 waves × 64 CUs) |

> Vega 64 has 64 CUs (not 56 — the 56-CU figure was wrong; Vega 64 has 64 CUs
> with 4 disabled shader engines unlocked in BIOS 113-D0500100-103). The GCN
> workgroup cap is 16384 threads, which exactly fills 4 wave64 per CU.

---

## 6. ProgPow Kernel Settings (Stream 2 — DISABLED)

### Kernel Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| GROUP_SIZE | 128 | 256 deadlocks on SMOS |
| PROGPOW_LANES | 16 | |
| PROGPOW_DAG_ELEMENTS | `(dag_size_entries / 2)` | Verified correct |
| hash32_t | 8 entries (32/sizeof(uint32_t)) | Reverted from 16 (register pressure) |
| USE_AMD_BPERMUTE | **DISABLED** (`#if 0`) | Causes GPU hangs on SMOS |
| progPowLoop | `static inline __attribute__((always_inline))` | Barrier deadlock fix attempt |

### DAG Cache

| Property | Value |
|----------|-------|
| File | `progpow_epoch120.bin` |
| Size | 2,080,374,792 bytes (~2 GB) |
| Location (rig) | `/home/miner/.zion/dag-cache/` |
| Location (edge) | `/var/www/zion-miner/dag-cache/` |
| Format | `[8 bytes: dag_size_entries LE u64][DAG data LE bytes]` |
| Validation | `total_bytes - 8 == dag_entries × 128` |

### GPU Hang Debugging History

| Attempt | Result |
|---------|--------|
| `USE_AMD_BPERMUTE` enabled | GPU hang — disabled |
| `GROUP_SIZE=256` | Deadlock — reduced to 128 |
| `always_inline` on `progPowLoop` | Still hangs |
| `hash32_t` = 16 entries | Reverted to 8 (register pressure) |
| Pre-generated DAG from cache | Loads OK, but kernel still hangs |
| **Decision** | **Disable Stream 2 entirely** |

---

## 7. Build & Deploy

### Build (on edge server via Docker)

```bash
# Docker container: rust:1.97-bullseye (Debian Bullseye, GCC 10, GLIBC 2.30)
# SMOS compatible: GLIBC max 2.31

ssh zion-new
cd /home/zionserver/zion-build

# IMPORTANT: Clean C lib build artifacts before rebuilding (native-ffi + auxpow)
# Otherwise stale .o files from a previous CPU target may be linked in.
rm -rf target-bullseye/release/build/zion-native-ffi-* \
       target-bullseye/release/build/zion-auxpow-*

docker run --rm \
  -v /home/zionserver/zion-build:/work -w /work \
  -e CARGO_TARGET_DIR=/work/target-bullseye \
  -e ZION_CPU_TARGET=x86-64 \
  -e 'RUSTFLAGS=-C target-cpu=x86-64' \
  rust:1.97-bullseye bash -c '
    apt-get update -qq && \
    apt-get install -y -qq ocl-icd-opencl-dev && \
    cargo build --release --bin zion-miner --features full,native-hashers
  '
```

**Critical:** `target-cpu=x86-64` is required — the Pentium G4560 has NO AVX/BMI2.
The `RUSTFLAGS=-C target-cpu=x86-64` prevents BMI2 `shlx`/`shrx` instructions.

### Deploy to edge server

```bash
ssh zion-new "strip /home/zionserver/zion-build/target-bullseye/release/zion-miner && \
  cp /home/zionserver/zion-build/target-bullseye/release/zion-miner /var/www/zion-miner/zion-miner && \
  chmod +x /var/www/zion-miner/zion-miner"
```

### Package SMOS ZIP

```bash
bash scripts/edge-package-smos.sh v3.1.9-triple-fixed17
# Produces: /var/www/zion-miner/zion-miner-v3.1.9-triple-fixed17.zip
```

### Update SMOS Group

```bash
curl -s -X PUT "https://api.simplemining.net/rig-groups/1773590" \
  -H "X-AUTH-TOKEN: api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8" \
  -H "Content-Type: application/json" \
  -d '{"minerOptions": "https://zionterranova.com/zion-miner/zion-miner-v3.1.9-triple-fixed17.zip"}'

# Reload rig
curl -s -X PATCH "https://api.simplemining.net/rigs/execute-reload" \
  -H "X-AUTH-TOKEN: api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8" \
  -H "Content-Type: application/json" \
  -d '{"rigIds":[518837]}'
```

### Binary Specs

| Property | Value |
|----------|-------|
| Size | 3.6 MB (stripped) |
| GLIBC max | 2.30 (SMOS compatible) |
| DAG symbols | 40 (native-hashers compiled) |
| Features | `full,native-hashers` |

---

## 8. Edge Server

| Property | Value |
|----------|-------|
| IP | 62.171.141.136 |
| SSH alias | `zion-new` |
| Build dir | `/home/zionserver/zion-build/` |
| Binary serve | `/var/www/zion-miner/zion-miner` (HTTP via nginx) |
| DAG serve | `/var/www/zion-miner/dag-cache/progpow_epoch120.bin` |
| Pool | `62.171.141.136:8444` |
| RPC | `rpc.zionterranova.com:8443` → `127.0.0.1:9443` |

### SSH Tunnel (for local access)

```bash
# Tunnel PID 588064 forwards ports:
# 8443/8445/8448/8450/8455/9100/9101/8453 → edge server
# 8446/8447/8444 → reverse from edge
ssh zion-new
```

---

## 9. Key Files

| File | Purpose |
|------|---------|
| `AuXpow/build.rs` | C compilation flags (OpenMP disabled, `-march=x86-64`) |
| `AuXpow/src/gpu_miner.rs` | DagManager, GPU DAG generation, kernel enqueue logging |
| `AuXpow/src/progpow_codegen.rs` | ProgPow kernel codegen (`progPowLoop` always_inline) |
| `AuXpow/csrc/opencl/progpow_kernel.cl` | ProgPow OpenCL kernel (bpermute disabled, GROUP_SIZE=128) |
| `AuXpow/src/native_ffi.rs` | FFI wrappers + pure-Rust light cache |
| `AuXpow/examples/gen_dag.rs` | Standalone DAG pre-generation helper |
| `V3/L1/miner/src/gpu_backend.rs` | GPU backend — work size caps, local_ws, build opts, GCN detection |
| `V3/L1/miner/src/main.rs` | Main mining loop, ext_stream dispatch, Stream 2 logging |
| `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite.cl` | Deeksha Lite kernel (SHA3-512, 256 KiB scratchpad) |
| `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite_fire.cl` | Deeksha Lite Fire kernel (thermal loop) |
| `scripts/edge-package-smos.sh` | SMOS wrapper script generator |
| `scripts/edge-docker-build-smos.sh` | Docker build script for SMOS |
| `scripts/vega_autopilot.py` | Vega OC autopilot script |
| `30khsDeeksha.md` | 30 KH/s Deeksha optimization documentation |
| `VEGA_RIG_DEBUG_REPORT_2026-07-16.md` | SIGILL crash analysis (historical) |
| `TRIPLE_STREAM_E2E_REPORT_2026-07-16.md` | Triple-stream E2E verification |
| `docs/3.0.6/VEGA_RIG_SIGILL_FIX_REPORT.md` | Earlier SIGILL fix report |

---

## 10. Key Commits (latest first)

```
a8e9d0594 perf(gpu): restore 25 KH/s deeksha on Vega 64 — rotate() + vload4 + no atomics ext
c6b3bdd33 feat(stratum): 5-param submit format for 7 new coins
fec2ecb53 fix(gpu): nonce_count default 1024→4×work_size (10 KH/s regression fix)
26e4d8aad fix(gpu): always_inline progPowLoop — barrier deadlock fix
f6f4aa7d0 feat(zcl): Equihash 192,7 stratum submit format + 8GB GPU VRAM fix
a9acf064f fix(gpu): disable AMD bpermute + reduce GROUP_SIZE to 128 for SMOS
1e751ac56 perf(progpow): 6.6x hashrate improvement via ds_bpermute + GROUP_SIZE=256
a398cd68f fix(miner): reorder ext_stream send + disable OpenMP for non-AVX CPUs
```

---

## 11. Debugging Guide

### Check rig status via SMOS API

```bash
curl -s "https://api.simplemining.net/rigs/518837" \
  -H "X-AUTH-TOKEN: api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8" | jq
```

### Decode console output

```bash
# Console is base64 encoded in redisData.console
curl -s "https://api.simplemining.net/rigs/518837" \
  -H "X-AUTH-TOKEN: api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8" | \
  jq -r '.redisData.console' | base64 -d
```

### Reboot rig

```bash
curl -s -X PATCH "https://api.simplemining.net/rigs/execute-reboot" \
  -H "X-AUTH-TOKEN: api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8" \
  -H "Content-Type: application/json" \
  -d '{"rigIds":[518837]}'
```

### Common GPU errors

| Error | Cause | Fix |
|-------|-------|-----|
| `d8` | GPU stopped responding | Hard reboot via SMOS API |
| `CL_INVALID_ARG_SIZE` | SMOS cache + GLIBC mismatch | Rebuild in `rust:1.97-bullseye` |
| SIGILL | BMI2/AVX on G4560 | `RUSTFLAGS=-C target-cpu=x86-64` |
| Kernel hang | ProgPow barrier deadlock | Disable Stream 2 |
| Hashrate drop to ~1 KH/s | `cl_khr_int64_base_atomics` enabled on gfx900/i066d | Disable the extension (not needed — kernel uses no atomics) |
| Hashrate 12-13 KH/s instead of 25 | Bit-shift ROL64 instead of `rotate()` | Use `rotate((long)x,(long)n)` — maps to `v_alignbyte` |

### Constraints

- **SSH times out** — rig is behind NAT, use SMOS API only
- **Cloudflare WAF** blocks complex bash commands via SMOS API
- **SMOS console buffer** is ~3 KB — startup logs evict quickly
- **Disk space** ~1 GB free — keep miner binary small (3.6 MB)
- **Network throttle** ~130 MB cumulative transfer from edge server

---

## 12. Future Work

### i066d vs i088 Kernel Config Divergence

The kernel now requires **different configs** depending on the SMOS image:

| Setting | i066d (ROCm 5.x) | i088 (ROCm 6.x) |
|---------|------------------|-----------------|
| `cl_khr_int64_base_atomics` | **DISABLED** (causes 1 KH/s) | Untested |
| ROL64 | `rotate(long,long)` — 25 KH/s | bit-shift — `rotate()` gives 126 H/s |
| `vload4/vstore4` from `__private*` | **ENABLED** — works | Disabled (compiler bug) |
| `local_ws` | 64 (wave64) | 256 (was set for i088) |

**Action item:** If the rig is ever reflashed to i088, the kernel must be
reverted to the bit-shift ROL64 + disabled vload4 config (commit `86f46c05b`).
The current code (commit `a8e9d0594`) is **i066d-only**.

### ProgPow Kernel Hang (Stream 2)

The always_inline fix did not resolve the GPU hang. Next steps:
1. Investigate barrier/sync patterns specific to SMOS OpenCL compiler for gfx900
2. Test with reduced PROGPOW_LANES (8 instead of 16)
3. Test with single-hash-per-group (GROUP_SIZE = PROGPOW_LANES)
4. Consider wave64-specific barrier placement
5. Profile with `clGetEventProfilingInfo` to identify which loop iteration hangs

### Vega 64 Work Size Tuning — DONE

`ZION_GPU_WORK_SIZE=16384` confirmed optimal on Vega 64 (i066d): 24-25 KH/s.
The GCN hard cap of 16384 exactly fills 4 wave64 per CU across 64 CUs.
No further tuning needed for i066d.

### VRSC CPU Stream

- Shares are found and forwarded but upstream acceptance is intermittent (stale/low-diff)
- `ZION_AUXPOW_EASY_TARGET` is disabled — rig receives real upstream target
- Monitor `external_share_result coin=VRSC accepted=true`

---

## 13. Related Documentation

- [`VEGA_RIG_DEBUG_REPORT_2026-07-16.md`](./VEGA_RIG_DEBUG_REPORT_2026-07-16.md) — SIGILL crash analysis
- [`TRIPLE_STREAM_E2E_REPORT_2026-07-16.md`](./TRIPLE_STREAM_E2E_REPORT_2026-07-16.md) — Triple-stream E2E
- [`30khsDeeksha.md`](./30khsDeeksha.md) — Deeksha 30 KH/s optimization
- [`docs/3.0.6/VEGA_RIG_SIGILL_FIX_REPORT.md`](./docs/3.0.6/VEGA_RIG_SIGILL_FIX_REPORT.md) — SIGILL fixes
- [`docs/3.0.6/PROGPOW_KERNEL_OPTIMIZATION_REPORT.md`](./docs/3.0.6/PROGPOW_KERNEL_OPTIMIZATION_REPORT.md) — ProgPow optimization
- [`docs/3.0.1Genesis/SMOS_VEGA64_FIRE_TUNING_POSTMORTEM.md`](./docs/3.0.1Genesis/SMOS_VEGA64_FIRE_TUNING_POSTMORTEM.md) — Vega tuning history
- [`docs/3.0.1Genesis/VEGA64_S4_MEMHARD_DEBUG_GUIDE.md`](./docs/3.0.1Genesis/VEGA64_S4_MEMHARD_DEBUG_GUIDE.md) — GCN vs RDNA details
- [`V3/SMOS_DEPLOY.md`](./V3/SMOS_DEPLOY.md) — SMOS deployment guide
