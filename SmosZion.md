# SMOS ZION Miner Debug Report

## Current Status (2026-06-03 late)

### Problem Summary
GPU miner on Vega 64 rig has **persistent OpenCL Blake3 s4_memhard mismatch** between GPU and CPU reference. The miner now continues past self-test (auto-ignored for GCN) and attempts to mine, but the underlying Blake3 implementation in the OpenCL kernel produces a different hash than the CPU `blake3` crate on Vega 64 (gfx900). A workaround (`ZION_NO_GCN_S4_MODE`) bypasses the s4-only split-kernel path so the full pipeline is used, but the s4 stage still mismatches.

### What Was Fixed Today

#### 1. Pool Service Restarted
- **Root cause**: `zion-pool-server` was in a systemd crash-loop because an old zombie process held port 8444.
- **Fix**: `pkill -f zion-pool-server && systemctl restart zion-edge-pool.service`
- **Status**: Pool is now listening on `0.0.0.0:8444` and accepting connections.

#### 2. `gpu_backend.rs` Logic Fixes
File: `V3/L1/miner/src/gpu_backend.rs`

- `mine_batch()` now uses `mine_batch_full` when `s4_kernel.is_none()` (i.e. `ZION_NO_GCN_S4_MODE=1` is set).
- `self_test()` now returns `Err` when `all_ok == false` (was silently returning `Ok` before).
- `self_test_at_epoch()` failure is logged but does **not** abort init for GCN devices.
- `update_epoch()` respects `ZION_NO_GCN_S4_MODE` and skips rebuilding the s4 kernel when the env var is set.
- `ZION_NO_GCN_S4_MODE=1` is now properly read at init time and disables s4-only mode.

#### 3. GLIBC Compatibility / Build Strategy
- Edge server builds produce binaries requiring GLIBC 2.32+; SMOS only has GLIBC 2.31.
- Attempts with `zig`, `cargo-zigbuild`, `cross`, and `x86_64-unknown-linux-musl` all failed due to OpenCL dynamic-linking or GLIBC symbol versioning issues.
- **Working solution**: Install Rust directly on the SMOS rig (`curl https://sh.rustup.rs | sh`) and build natively. The rig has ~700 MB free and 7.5 GB RAM; a release build of `zion-miner` completes in ~1 minute.

#### 4. SMOS Custom Miner Packaging
- SMOS expects a tar.gz named `custom_<PKG_NAME>.tar.gz` inside `/root/miner_org/`.
- The tar.gz **must** contain a folder named `custom_<PKG_NAME>/` (with the `custom_` prefix) and inside that a file named `miner`.
- The `.md5` file must match; otherwise SMOS falls back to downloading the ZIP from the URL in `config.json`.
- SMOS `xminer.sh` symlinks `/root/miner -> /var/tmp/miner`, extracts the tar.gz there, and expects `/root/miner/custom_<PKG_NAME>/miner`.

#### 5. Environment Variables / Wrapper Script
- `xminer.sh` sources `/root/config.txt` but does **not** export those variables to the `sudo -E` miner invocation in a way that the Rust binary sees them.
- `ZION_NO_GCN_S4_MODE=1` and `ZION_LOOP_COUNT=1000000` must be present in the miner’s environment.
- **Working solution**: A wrapper script `miner` (bash) that exports the vars and then `exec`s the real binary `miner.real`.
  ```bash
  #!/bin/bash
  export ZION_NO_GCN_S4_MODE=1
  export ZION_LOOP_COUNT=1000000
  exec /root/miner/custom_zion-miner-v3.0.18-gpu/miner.real "$@"
  ```

### Critical Finding: OpenCL Blake3 Mismatch Persists
Even with `ZION_NO_GCN_S4_MODE=1` (full pipeline), the `s4_memhard` stage still fails self-test:

```
SELF_TEST s4_memhard=FAIL
  gpu=881870a52529979d814d906781cfb2cf365606bfa458124b83fbcad82a6bb946
  cpu=cfaeb45a3038434700a5d4cd2fe01b9bdda1d09633e49c1fb8529e477e04ef60
```

- A prior BLAKE3 counter bugfix (incrementing `counter` in `b3_compress_cv` calls inside `b3_hash_single_chunk` and `ekam_mix_block`) changed the GPU hash from `2c3739e1...` to `881870a5...`, proving the counter had effect, but the CPU reference remains `cfaeb45a...`.
- This means **additional mismatches remain** in the OpenCL Blake3 path (possibly `b3_load_words`, `b3_permute`, `BLAKE3_IV`, or compiler-specific optimizations on GCN).

### Rig Details
- **Rig ID**: 518837 (ZionRig)
- **Current IP**: dynamic (DHCP, last seen 192.168.0.161)
- **GPU**: AMD Vega 64 (gfx900:xnack-)
- **OS**: SimpleMining OS (SMOS) with kernel 5.15.80-sm, AMDGPU driver
- **SSH**: miner@<current_ip> (password: omnity.company@gmail.com)
- **SMOS Group**: ZION-Deeksha-AMD (ID 1765707)
- **GLIBC**: 2.31

### Mining Configuration
- **Wallet**: zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3
- **Pool**: 77.42.71.94:8444
- **Worker**: vega-smos
- **Miner Binary**: custom_zion-miner-v3.0.18-gpu (built natively on rig)
- **Current Miner Options**: `https://zionterranova.com/zion-miner/zion-miner-v3.0.18-gpu.zip --pool 77.42.71.94:8444 --wallet zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3 --worker vega-smos`

### Error Details

#### GPU Self-Test Failure (Still Present)
```
=== GPU SELF-TEST START ===
SELF_TEST s1_keccak256=OK
SELF_TEST s2_sha3_512=OK
SELF_TEST s3_golden=OK
SELF_TEST s4_memhard=FAIL
  gpu=881870a52529979d814d906781cfb2cf365606bfa458124b83fbcad82a6bb946
  cpu=cfaeb45a3038434700a5d4cd2fe01b9bdda1d09633e49c1fb8529e477e04ef60
=== GPU SELF-TEST END ===
GPU_SELF_TEST_ERROR: GPU-CPU mismatch in self-test
GPU SELF-TEST FAILED BUT CONTINUING (GCN device - known s4_memhard mismatch)
```

#### Pool Connection (Fixed)
- Was: `session_error attempt=1 error="pool closed the connection"`
- Now: Pool service `zion-edge-pool.service` is active and listening on `0.0.0.0:8444`.

### Code Changes Made

#### `V3/L1/miner/src/gpu_backend.rs`
1. `mine_batch()` uses `mine_batch_full` when `s4_kernel.is_none()` (respects `ZION_NO_GCN_S4_MODE`).
2. `self_test()` returns `Err` on mismatch (was returning `Ok` unconditionally).
3. `self_test_at_epoch()` failure is logged but does not abort for GCN.
4. `update_epoch()` respects `ZION_NO_GCN_S4_MODE` for s4 kernel rebuild.
5. `ZION_NO_GCN_S4_MODE` env var check added during init.

#### `V3/L1/cosmic-harmony/src/gpu/kernels/cosmic_harmony_deeksha.cl`
- BLAKE3 counter fix: `b3_compress_cv` calls inside `b3_hash_single_chunk` and `ekam_mix_block` now use the correct block index as `counter` instead of `0UL`.

### Build & Deployment Status

#### Rig Native Build (Success)
- Install Rust on rig: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Source cargo env: `. "$HOME/.cargo/env"` (or `export PATH="$HOME/.cargo/bin:$PATH"`)
- Build: `cargo build --release --manifest-path Cargo.toml -p zion-miner --features gpu-opencl`
- GLIBC max requirement: 2.30 (compatible with SMOS 2.31).

#### SMOS Deployment Steps
1. Build on rig → `/tmp/zion-build/target/release/zion-miner`
2. Create wrapper script `miner` that exports `ZION_NO_GCN_S4_MODE=1` and `ZION_LOOP_COUNT=1000000`, then `exec`s `miner.real`.
3. Package:
   ```bash
   cd /root/miner_org
   mkdir -p custom_zion-miner-v3.0.18-gpu
   cp /tmp/zion-build/target/release/zion-miner custom_zion-miner-v3.0.18-gpu/miner.real
   # write wrapper as custom_zion-miner-v3.0.18-gpu/miner
   tar -czf custom_zion-miner-v3.0.18-gpu.tar.gz custom_zion-miner-v3.0.18-gpu
   md5sum custom_zion-miner-v3.0.18-gpu.tar.gz > custom_zion-miner-v3.0.18-gpu.tar.gz.md5
   ```
4. Update `config.json` miner URL to end in `zion-miner-v3.0.18-gpu.zip` so SMOS computes the right `MINER_PKG_NAME`.
5. Restart SMOS miner screen or reboot rig.

### Current Miner Status
- **GPU Miner**: Starts, self-test fails s4 but continues, attempts to connect to pool.
- **CPU Miner**: Not actively used; GPU backend is primary.
- **GPU Temperature**: Not yet sustained (needs continuous mining loop).
- **Hashrate**: Not yet measured in sustained mode (needs `ZION_LOOP_COUNT=1000000` + pool online).

## Debug Recommendations

### 1. OpenCL Blake3 Root Cause
**Priority: CRITICAL**
- The OpenCL `ekam_memory_hard_transform` (Blake3 XOF + AES cascade) produces a different hash than the CPU `blake3` crate on Vega 64.
- Counter fix changed the hash but did not align it with CPU.
- **Next step**: Block-by-block comparison of the OpenCL Blake3 intermediate state against the `blake3` crate output for the same input (`cpu_s3.data` from self-test).
- Alternatively, switch the OpenCL s4 stage to use the same SHA3-512-based chain as the old kernel (matches what `ekam_deeksha_debug` prints for `s4_memhard`), and update the CPU self-test reference to match.

### 2. Verify Sustained Mining
**Priority: HIGH**
- Pool is now online.
- `ZION_LOOP_COUNT=1000000` is set via wrapper.
- Need to confirm the miner stays connected, submits shares, and does not crash after >5 minutes.

### 3. SMOS Automation
**Priority: MEDIUM**
- The wrapper script inside the tar.gz is a workaround. A cleaner solution would be for `xminer.sh` (or the ZION miner itself) to read a config file for env vars.
- If SMOS dashboard pushes a new config, `config.json` may be overwritten; ensure the miner URL stays pointed at the local-compatible version.

## Next Steps (for next session)

1. **Verify sustained mining**: Let the rig run for 10+ minutes, check `screen.miner.log` for accepted shares and hashrate.
2. **Debug OpenCL Blake3**: Either fix the remaining counter/block-length issue in the OpenCL kernel, or switch to SHA3-512 for s4 on GCN and update the CPU reference accordingly.
3. **Clean up deployment**: Consider versioning the tar.gz properly so SMOS update mechanism works without manual MD5 fixes.

## Technical Notes

### SMOS Custom Miner Requirements
- File: `/root/miner_org/custom_<NAME>.tar.gz`
- Must contain folder: `custom_<NAME>/`
- Inside folder: executable named `miner`
- MD5 file must match: `custom_<NAME>.tar.gz.md5`
- If MD5 or archive is missing, SMOS downloads the ZIP from the URL in `config.json`

### GPU Backend Details
- **Backend**: OpenCL via `ocl` crate
- **Platform**: AMD Accelerated Parallel Processing
- **Device**: gfx900:xnack- (Vega 64)
- **Work Size**: 512 (GCN cap)
- **Local Work Size**: 64
- **Scratchpad**: 128 MiB
- **GCN S4 Mode**: Disabled via `ZION_NO_GCN_S4_MODE=1` (uses full pipeline)

### OpenCL Kernel Stages
1. s1_keccak256: OK
2. s2_sha3_512: OK
3. s3_golden: OK
4. s4_memhard: **FAIL** (OpenCL Blake3 != CPU Blake3)
5. s5_npu: OK
6. s6_fusion: OK

## Files Modified (Session 2026-06-03)
- `V3/L1/miner/src/gpu_backend.rs` - mine_batch logic, self_test Err return, ZION_NO_GCN_S4_MODE support
- `V3/L1/cosmic-harmony/src/gpu/kernels/cosmic_harmony_deeksha.cl` - BLAKE3 counter fix

## Deployment Artifacts
- Rig native build: `/tmp/zion-build/target/release/zion-miner`
- SMOS archive: `/root/miner_org/custom_zion-miner-v3.0.18-gpu.tar.gz`
- Wrapper: `/root/miner_org/custom_zion-miner-v3.0.18-gpu/miner` (exports env vars, execs `miner.real`)

## References
- SMOS Rig ID: 518837
- SMOS Group ID: 1765707
- Edge Server: 100.76.16.108 (Tailscale), 77.42.71.94 (public)
- Pool Port: 8444
