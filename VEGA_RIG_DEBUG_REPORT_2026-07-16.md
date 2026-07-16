# Vega Rig (SMOS) — EPIC GPU Mining Debug Report

**Date:** 2026-07-16
**Author:** Devin (AI assistant)
**Status:** In progress — SIGILL crash during light cache generation (BMI2 instructions)

---

## 1. Goal

Get EPIC Cash ProgPow GPU mining working on the SMOS Vega rig via
`zion-miner` v3.0.6, alongside ZION (Deeksha) GPU and VRSC (VerusHash)
CPU streams — triple-stream mining.

---

## 2. Hardware & Environment

### Vega Rig (SMOS) — 192.168.1.113

| Component | Value |
|-----------|-------|
| CPU | Intel Pentium G4560 @ 3.50GHz (Kaby Lake, 2C/4T) |
| CPU ISA | SSE4.2, AES-NI — **NO AVX, AVX2, BMI1, BMI2, FMA** |
| GPU | AMD Radeon RX Vega 56/64 (gfx900, 8 GB HBM2) |
| iGPU | Intel HD Graphics 610 (unused) |
| OS | Ubuntu 22.04.5 LTS (SMOS custom kernel 6.9.12-sm6) |
| Disk | 6.9 GB total, ~976 MB free |
| SSH | `miner@192.168.1.113` password `omnity.company@gmail.com` |
| Miner user | `miner` |
| Miner wrapper | `/root/xminer.sh` (SMOS custom) |
| Miner package | `/root/miner/custom_zion-miner-v3.1.9-triple-fixed16/` |
| Local binary | `/tmp/zion-miner-real` (downloaded from edge server) |
| Log file | `/var/tmp/screen.miner.log` |
| DAG cache dir | `/home/miner/.zion/dag-cache/` |

### Edge Server — 62.171.141.136

| Component | Value |
|-----------|-------|
| OS | Ubuntu 24.04.4 LTS |
| CPU | 4 cores x86-64 |
| SSH alias | `zion-new` (key-based auth) |
| Build dir | `/home/zionserver/zion-build/` |
| Build container | `rust:1.97-bullseye` (Debian Bullseye, GCC 10) |
| Binary serve | `/var/www/zion-miner/zion-miner` (HTTP) |
| DAG file | `/var/www/zion-miner/progpow_epoch120.bin` (1.94 GB) |
| Build cmd | See section 6 |

### CPU Flags (Pentium G4560)

```
fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36
clflush dts acpi mmx fxsr sse sse2 ss ht tm pbe syscall nx pdpe1gb rdtscp
lm constant_tsc art arch_perfmon pebs bts rep_good nopl xtopology nonstop_tsc
cpuid aperfmperf pni pclmulqdq dtes64 monitor ds_cpl vmx est tm2 ssse3 sdbg
cx16 xtpr pdcm pcid sse4_1 sse4_2 x2apic movbe popcnt tsc_deadline_timer aes
xsave rdrand lahf_lm abm 3dnowprefetch cpuid_fault epb ssbd ibrs ibpb stibp
tpr_shadow flexpriority ept vpid ept_ad fsgsbase tsc_adjust smep erms invpcid
mpx rdseed smap clflushopt intel_pt xsaveopt xsavec xgetbv1 xsaves dtherm arat
pln pts hwp hwp_notify hwp_act_window hwp_epp vnmi md_clear flush_l1d
arch_capabilities
```

**Missing:** `avx`, `avx2`, `bmi1`, `bmi2`, `fma`, `f16c`, `rdrand` (has rdrand)

---

## 3. Problem Summary

The miner crashes with `Illegal instruction (core dumped)` (SIGILL) on the
Vega rig during DAG-related operations. The root cause is that the Rust
compiler (and possibly some crates) emit BMI2 instructions (`shlx`, `shrx`)
and AVX instructions that the Pentium G4560 does not support.

### Crash Sequence

1. Pool sends QUAI KawPow job (epoch 594) or EPIC ProgPow job (epoch 120)
2. Miner enters `dag_manager` → `ensure_kawpow_dag` / `ensure_progpow_dag`
3. Miner calls `generate_kawpow_light_cache` or `generate_ethash_light_cache`
4. **SIGILL** — Illegal instruction crash

### Root Causes Identified

| # | Cause | Status |
|---|-------|--------|
| 1 | `set_stream_weights()` blocking main thread on OpenCL `queue.finish()` | **Fixed** (reordered + gated to Metal only) |
| 2 | `set_stream_weights()` SIGILL on non-AVX CPU | **Fixed** (disabled for OpenCL) |
| 3 | C FFI DAG generation SIGILL (OpenMP/libgomp AVX) | **Fixed** (disabled OpenMP, added `-march=x86-64`) |
| 4 | C FFI light cache generation SIGILL | **Partially fixed** (pure-Rust replacement added, but still crashes) |
| 5 | **BMI2 instructions (`shlx`/`shrx`) in Rust binary** | **NOT FIXED** — 44 BMI2 instructions found in binary |

---

## 4. Work Done (Chronological)

### Phase 1: Reorder external stream send (commit `a398cd68f`)

- Moved `ext_gpu_tx.send()` before `set_stream_weights()` and `gpu_scan_job()`
  in the main mining loop to prevent OpenCL queue blocking from delaying
  external GPU job dispatch.
- Gated `set_stream_weights()` to Metal backend only (was causing both
  blocking and SIGILL on OpenCL/non-AVX CPUs).
- **Files:** `V3/L1/miner/src/main.rs`
- **Result:** External job dispatch no longer blocked, but SIGILL persisted.

### Phase 2: Disable OpenMP + force `-march=x86-64` (commit `a398cd68f`)

- Removed `-fopenmp` flag and `libgomp` linking on Linux in `AuXpow/build.rs`
  (libgomp contains AVX instructions).
- Added `-march=x86-64` to C compilation flags for baseline x86-64 ISA.
- **Files:** `AuXpow/build.rs`
- **Result:** C DAG generation no longer uses OpenMP, but SIGILL persisted
  in C FFI `ethash_generate_dag` / `kawpow_generate_dag`.

### Phase 3: Pre-generate ProgPow DAG on edge server

- Built `gen_dag` example binary on edge server.
- Generated `progpow_epoch120.bin` (1.94 GB) on edge server (takes ~5 min
  with OpenMP on 4-core server).
- Copied to rig via HTTP: `curl -o ~/.zion/dag-cache/progpow_epoch120.bin
  http://62.171.141.136/zion-miner/progpow_epoch120.bin`
- **Result:** ProgPow DAG loads from disk cache, but KawPow DAG still
  crashes (epoch changes frequently, can't pre-generate).

### Phase 4: GPU DAG generation (commit `aa8ceb396` by other dev)

- Another developer committed "DAG generation exclusively on GPU, never on CPU".
- The full DAG is now computed on the GPU via OpenCL kernel
  (`ethash_calculate_dag_item_mod`).
- The CPU only generates the small **light cache** (~16-100 MB).
- **Result:** Full DAG no longer crashes, but light cache generation still
  uses C FFI and crashes with SIGILL.

### Phase 5: Pure-Rust light cache generation (uncommitted, local)

- Added `generate_kawpow_light_cache_rust()` and
  `generate_ethash_light_cache_rust()` in `AuXpow/src/native_ffi.rs`.
- Uses `sha3` crate (pure Rust Keccak-256/512) instead of C FFI.
- Added `rust_owned` flag to `EthashLightCache` / `KawpowLightCache` structs
  for correct memory deallocation (Rust `Box` vs C `free`).
- Updated `gpu_miner.rs` to call pure-Rust functions instead of C FFI.
- **Files:** `AuXpow/src/native_ffi.rs`, `AuXpow/src/gpu_miner.rs`
- **Result:** **STILL CRASHES** — SIGILL persists even with pure-Rust
  light cache. The `sha3` crate itself is clean (no AVX/BMI2), but the
  Rust compiler still emits BMI2 instructions elsewhere in the binary.

### Phase 6: BMI2 instruction analysis (current)

- Disassembled the binary: found **44 BMI2 instructions** (`shlx`, `shrx`)
  and **6113 AVX instructions** in the final binary.
- The AVX instructions are likely in OpenCL-related codepaths that are
  not executed on the rig (they're in functions that aren't called during
  light cache generation).
- The **BMI2 instructions** (`shlx`/`shrx`) are the likely SIGILL cause —
  the Pentium G4560 does not support BMI2.
- Attempted rebuild with `RUSTFLAGS='-C target-cpu=x86-64 -C target-feature=-avx,-avx2,-fma,-bmi,-bmi2,-sse4.2,-aes'` — **build was interrupted**.

---

## 5. Current State

### Uncommitted Local Changes

```
AuXpow/src/gpu_miner.rs  |  24 +++----
AuXpow/src/native_ffi.rs | 160 ++++++++++++++++++++++++++++++++++++++++++++++-
```

These contain the pure-Rust light cache generation functions. They compile
but still crash at runtime due to BMI2 instructions from the Rust compiler.

### What Works

- ProgPow DAG loads from disk cache (`progpow_epoch120.bin` exists on rig)
- External stream job dispatch is no longer blocked
- `set_stream_weights()` no longer crashes (disabled for OpenCL)
- Build compiles successfully with `target-cpu=x86-64`

### What Doesn't Work

- **Light cache generation crashes with SIGILL** — BMI2 `shlx`/`shrx`
  instructions in the binary are executed on a CPU that doesn't support BMI2.
- KawPow DAG generation fails (no disk cache, light cache crashes)
- ProgPow DAG generation fails (disk cache exists but light cache is still
  needed for GPU generation path)

---

## 6. Build & Deploy Commands

### Build (on edge server)

```bash
# Clean build with no AVX/BMI (IN PROGRESS — not yet verified)
ssh zion-new "rm -rf /home/zionserver/zion-build/target-bullseye && \
  docker run --rm -v /home/zionserver/zion-build:/work -w /work \
  -e CARGO_TARGET_DIR=/work/target-bullseye \
  -e 'RUSTFLAGS=-C target-cpu=x86-64 -C target-feature=-avx,-avx2,-fma,-bmi,-bmi2' \
  rust:1.97-bullseye bash -c '
    apt-get update -qq 2>/dev/null && \
    apt-get install -y -qq libopencl-clang-dev ocl-icd-opencl-dev 2>/dev/null && \
    cargo build --release -p zion-miner --features gpu-opencl,native-hashers 2>&1
  '"
```

### Deploy (on edge server)

```bash
ssh zion-new "strip /home/zionserver/zion-build/target-bullseye/release/zion-miner && \
  cp /home/zionserver/zion-build/target-bullseye/release/zion-miner /var/www/zion-miner/zion-miner && \
  chmod +x /var/www/zion-miner/zion-miner"
```

### Download on rig

```bash
sshpass -p 'omnity.company@gmail.com' ssh miner@192.168.1.113 \
  'kill -9 $(ps aux | grep zion-miner-real | grep -v grep | awk "{print \$2}") 2>/dev/null; \
   kill -9 $(ps aux | grep custom_zion | grep -v grep | awk "{print \$2}") 2>/dev/null; \
   rm -f /tmp/zion-miner-real; \
   curl -s -o /tmp/zion-miner-real http://62.171.141.136/zion-miner/zion-miner && \
   chmod +x /tmp/zion-miner-real'
```

### Check logs on rig

```bash
sshpass -p 'omnity.company@gmail.com' ssh miner@192.168.1.113 \
  "tail -60 /var/tmp/screen.miner.log | grep -E 'pure-Rust|light cache|dag_manager|ext_gpu|crash|Illegal|dag_ready|uploading|share|accepted|hashrate'"
```

### Pre-generate DAG on edge server

```bash
ssh zion-new "docker run --rm -v /home/zionserver/zion-build:/work -w /work \
  -e CARGO_TARGET_DIR=/work/target-bullseye rust:1.97-bullseye \
  /work/target-bullseye/release/examples/gen_dag 120 /work/progpow_epoch120.bin"
```

---

## 7. Next Steps (for continuing the debug)

### Step 1: Complete the BMI2-free build

The last build was interrupted. Re-run with explicit BMI2 disable:

```bash
ssh zion-new "rm -rf /home/zionserver/zion-build/target-bullseye && \
  docker run --rm -v /home/zionserver/zion-build:/work -w /work \
  -e CARGO_TARGET_DIR=/work/target-bullseye \
  -e 'RUSTFLAGS=-C target-cpu=x86-64 -C target-feature=-avx,-avx2,-fma,-bmi,-bmi2' \
  rust:1.97-bullseye bash -c '
    apt-get update -qq && apt-get install -y -qq libopencl-clang-dev ocl-icd-opencl-dev && \
    cargo build --release -p zion-miner --features gpu-opencl,native-hashers 2>&1
  '"
```

### Step 2: Verify no BMI2 in binary

```bash
ssh zion-new "objdump -d /var/www/zion-miner/zion-miner | \
  grep -wcE 'pext|pdep|mulx|shlx|shrx|sarx|rorx|bzhi|blsi|blsmsk|blsr|bextr'"
# Should return 0
```

### Step 3: Deploy and test on rig

```bash
# Deploy
ssh zion-new "strip ... && cp ... /var/www/zion-miner/zion-miner"

# Download on rig
sshpass -p 'omnity.company@gmail.com' ssh miner@192.168.1.113 \
  'kill -9 $(ps aux | grep zion-miner-real | grep -v grep | awk "{print \$2}");
   rm -f /tmp/zion-miner-real;
   curl -s -o /tmp/zion-miner-real http://62.171.141.136/zion-miner/zion-miner && chmod +x /tmp/zion-miner-real'

# Wait 60s and check logs
sleep 60 && sshpass -p 'omnity.company@gmail.com' ssh miner@192.168.1.113 \
  "tail -60 /var/tmp/screen.miner.log | grep -E 'pure-Rust|light cache|dag|crash|Illegal|share|accepted|hashrate'"
```

### Step 4: If SIGILL persists

If BMI2 disable doesn't fix it, the SIGILL may come from:
- `cpufeatures` crate runtime detection (unlikely — it checks CPUID)
- Rust stdlib (unlikely with `target-cpu=x86-64`)
- A specific crate with `#[target_feature(enable = "bmi2")]` attributes

Debug with GDB on the rig:
```bash
sshpass -p 'omnity.company@gmail.com' ssh miner@192.168.1.113 \
  'sudo apt-get install -y gdb 2>/dev/null; \
   gdb -batch -ex run -ex "info registers rip" -ex "x/i \$rip" --args /tmp/zion-miner-real --pool 62.171.141.136:8444 --wallet zion1s6m204400290l660k622r3r0c6u040g5j6cu2x5 --worker vega-smos --no-tui --threads 8 2>&1 | tail -20'
```

### Step 5: Verify triple-stream mining

Once SIGILL is fixed, verify all 3 streams:
- **ZION GPU** (Deeksha) — check `zion_gpu_share_accepted` in logs
- **EPIC GPU** (ProgPow) — check `ext_gpu_tx_send coin=EPIC` + `share_accepted`
- **VRSC CPU** (VerusHash) — check `ext_cpu_tx_send coin=VRSC` + `share_accepted`

---

## 8. Key Files

| File | Purpose |
|------|---------|
| `AuXpow/build.rs` | C compilation flags (OpenMP, `-march=x86-64`) |
| `AuXpow/src/native_ffi.rs` | FFI wrappers + pure-Rust light cache (uncommitted) |
| `AuXpow/src/gpu_miner.rs` | DagManager, GPU DAG generation (uncommitted changes) |
| `AuXpow/csrc/etchash_native.c` | C Ethash/ProgPow DAG + light cache generation |
| `AuXpow/csrc/kawpow_native.c` | C KawPow DAG + light cache generation |
| `V3/L1/miner/src/main.rs` | Main mining loop, ext_stream dispatch order |
| `AuXpow/examples/gen_dag.rs` | Standalone DAG generator (for pre-generation) |
| `docs/3.0.6/VEGA_RIG_SIGILL_FIX_REPORT.md` | Earlier report (Phase 1-3) |

---

## 9. Git History (relevant commits)

```
a398cd68f fix(miner): reorder ext_stream send + disable OpenMP for non-AVX CPUs  [Devin]
1e751ac56 perf(progpow): 6.6x hashrate improvement via ds_bpermute + GROUP_SIZE=256
aa8ceb396 feat(miner): DAG generation exclusively on GPU, never on CPU
7ad18ae1c fix(miner): VRSC/VerusHash shares not accepted — read_next_result rejected ExternalResult
5f31ce2fd perf(verushash): 2.3x VRSC speedup via fixupkey + pre-computed curBuf
```

---

## 10. Rig Connection Details

```
IP:       192.168.1.113 (LAN only, accessible from edge server network)
User:     miner
Password: omnity.company@gmail.com
SSH:      sshpass -p 'omnity.company@gmail.com' ssh -o StrictHostKeyChecking=no \
          -o PreferredAuthentications=password,keyboard-interactive \
          -o PubkeyAuthentication=no miner@192.168.1.113
```

**Note:** The rig is on a local network. The edge server (62.171.141.136)
can reach it. If debugging from a different machine, SSH tunnel through
the edge server:
```bash
ssh -L 1113:192.168.1.113:22 zion-new
# Then: sshpass -p 'omnity.company@gmail.com' ssh miner@localhost -p 1113
```
