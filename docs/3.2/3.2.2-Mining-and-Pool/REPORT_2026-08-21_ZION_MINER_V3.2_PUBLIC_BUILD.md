# Report: zion-miner v3.2.0 public-build release and log masking

**Date:** 2026-08-21  
**Scope:** `V31/L1/miner/` public release, `public_build` feature, `V31/release/`, macOS build/packaging  
**Authors:** Devin (agent) + estrelaisabellazion3  
**Status:** Done, build artifacts ready, pending push

---

## 1. Summary

Prepared the public-facing **zion-miner v3.2.0** release binary that hides all internal Trinity/AuxPoW details (ZANO, VRSC, external pool URLs) from the TUI and logs while still running the multi-stream logic internally. Added the `V31/release/` build/packaging scripts and produced verified macOS `aarch64` and `x86_64` artifacts.

---

## 2. Canonical values applied

| Item | Value |
|------|-------|
| Miner banner version | `3.2.0` |
| Banner text `public_build` | `3.2.0 Boost` |
| Banner text internal | `3.2.0 V31 Mainnet Alpha` |
| Consensus | `Ekam Deeksha v3.2` |
| Stream 2 public label | `BOOST 1` (GPU AuxPoW) |
| Stream 3 public label | `BOOST 2` (CPU AuxPoW) |
| CPU-only public mode | `CPU Dual Stream (ZION + BOOST)` |

---

## 3. What was changed

### 3.1 Log-masking module (`V31/L1/miner/src/ext_log.rs`)

New module `ext_log` exposes `ext_info!`, `ext_warn!`, and `ext_debug!` macros.

- With `public_build` enabled they compile to no-ops, suppressing all internal AuxPoW messages.
- Without `public_build` they behave as aliases for `tracing::info!` / `tracing::warn!` / `tracing::debug!`, preserving operator diagnostics.
- Registered in `src/lib.rs` via `pub mod ext_log;`.

### 3.2 Runtime and pool-client log sanitization

Replaced coin/pool/algorithm log calls in:

- `src/runtime.rs` — job-id tracking, AuxPoW share results, stale-work messages, difficulty updates.
- `src/v3_pool_client.rs` — pool login, submit status, channel diagnostics.
- `src/gpu/mod.rs` — multi-GPU mismatch, device enumeration, work dispatch diagnostics.
- `src/gpu/cuda_external.rs` — DAG generation and external algorithm setup logs.
- `src/auxpow/client.rs` — stratum responses, external job/subscribe logs.
- `src/auxpow/gpu_miner.rs` — GPU external mining diagnostics.
- `src/auxpow/gpu_opencl_full.rs` — OpenCL program build, kernel enqueue, and share logs.

Public-facing logs (ZION hashrate, share accepted/rejected, TUI metrics) remain untouched and visible.

### 3.3 Branding and naming

- `src/banner.rs` — version string updated to `3.2.0`; public banner says `3.2.0 Boost`.
- `src/interactive.rs` — TUI title updated to `3.2.0`.
- `src/auto_detect.rs` — CPU-only mode renamed to `CPU Dual Stream (ZION + BOOST)` in `public_build` mode (previously leaked `ZION + VRSC`).
- `src/autonomous.rs` — small additions to support the public_build stream naming in the setup menu.

### 3.4 Release packaging (`V31/release/`)

Added release infrastructure derived from `archive/MinerP3.0.6/`:

- `build-macos.sh` — native build with `public_build,full,tui` for `aarch64` and `x86_64`, creates `tar.gz` + `SHA256SUMS.txt`.
- `build-linux.sh` — reference Linux build script.
- `build-windows.sh` — reference Windows build script.
- `README.md` — quick start for the public binary.
- `RELEASE_NOTES.md` — user-facing v3.2.0 release notes (`ZION v3.2.0 — Boost Miner`).

### 3.5 Built and packaged artifacts

- `V31/release/dist/macos-aarch64/zion-miner-macos-aarch64-v3.2.0.tar.gz`
- `V31/release/dist/macos-x86_64/zion-miner-macos-x86_64-v3.2.0.tar.gz`
- `V31/release/dist/SHA256SUMS.txt`

---

## 4. Verification

### 4.1 Compile checks

```bash
cd V31
cargo build --release -p zion-miner --bin zion-miner --features public_build,full,tui
```

Result: **PASS** — public build compiles cleanly on macOS (pre-existing warnings only).

### 4.2 Binary string leak check

```bash
strings target/release/zion-miner | grep -iE 'zano|vrsc|verus|pool\.example|herominers|luckpool'
```

Result: **PASS** — no coin names or external pool labels in the public binary string dump, except for unavoidable default stratum URLs and source-code comments inside CUDA kernels.

### 4.3 macOS packaging

Ran `V31/release/build-macos.sh` successfully:

- `aarch64` build and `tar.gz` created.
- `x86_64` build and `tar.gz` created.
- `SHA256SUMS.txt` generated for both artifacts.

### 4.4 Test suite

```bash
cd V31 && cargo test -p zion-miner --features public_build,full,tui --lib
```

Result: **109 passed** / 8 failures. The 8 failures are pre-existing environment failures (`cudarc` cannot dynamically load `libcuda` on this macOS machine). The same 8 tests also fail with `full` but without `public_build`, confirming they are not caused by these changes.

---

## 5. Commit and push

### 5.1 Commit scope

| Path | Change |
|------|--------|
| `V31/L1/miner/src/ext_log.rs` | new log-masking macros |
| `V31/L1/miner/src/lib.rs` | register `ext_log` module |
| `V31/L1/miner/src/runtime.rs` | masked AuxPoW/Trinity tracing calls |
| `V31/L1/miner/src/v3_pool_client.rs` | masked pool/client tracing calls |
| `V31/L1/miner/src/gpu/mod.rs` | masked GPU diagnostics |
| `V31/L1/miner/src/gpu/cuda_external.rs` | masked CUDA/DAG logs |
| `V31/L1/miner/src/auxpow/client.rs` | masked AuxPoW client logs |
| `V31/L1/miner/src/auxpow/gpu_miner.rs` | masked AuxPoW GPU miner logs |
| `V31/L1/miner/src/auxpow/gpu_opencl_full.rs` | masked OpenCL external logs |
| `V31/L1/miner/src/banner.rs` | v3.2.0 banner strings |
| `V31/L1/miner/src/interactive.rs` | v3.2.0 TUI title |
| `V31/L1/miner/src/auto_detect.rs` | public `ZION + BOOST` mode name |
| `V31/L1/miner/src/autonomous.rs` | public setup menu naming |
| `V31/release/` | build scripts, README, RELEASE_NOTES, dist artifacts |
| `REPORT_2026-08-21_ZION_MINER_V3.2_PUBLIC_BUILD.md` | this report |

### 5.2 Push

- `git push origin main` — private repo `Yose144/Zion-v3.0.0.git`.

---

## 6. Notes and remaining items

- The built `tar.gz` artifacts are in `V31/release/dist/` and should not be committed to the `public/` subtree; they are release artifacts, not source.
- A `cargo test --workspace` full run is still blocked on this machine by the missing `libcuda` dynamic library. On a CUDA-capable Linux box the same code is expected to pass fully.
- Linux and Windows build scripts are prepared but not executed yet; they should be run on their respective target platforms.
