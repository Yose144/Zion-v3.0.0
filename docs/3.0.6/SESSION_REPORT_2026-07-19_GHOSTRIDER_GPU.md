# Session Report — 2026-07-19 GhostRider GPU + Security Hardening + Pool Setup

**Date:** 2026-07-19 (CEST)
**Session focus:** GhostRider OpenCL GPU debugging on AMD RX 5600 XT, security hardening completion, Pool Setup dashboard deploy, backup node fresh sync

---

## Summary

This session completed the GhostRider OpenCL GPU implementation on AMD gfx1010 (RX 5600 XT), achieving **15/15 SPH algorithm matches** against CPU reference. Additionally: closed SSH port 22, switched AppArmor to enforce mode, deployed Pool Setup page to Edge dashboard, fixed CUDA feature gate for non-CUDA builds, and added `native-hashers` to the `full` feature for EPIC/KawPow DAG generation.

---

## 1. GhostRider OpenCL GPU — 15/15 SPH Algorithms PASS

### Bugs fixed

| Bug | Root cause | Fix |
|---|---|---|
| HAMSI T512_L indexing | `T512_L[i] = T512[i]` assigned a 16-element row to a scalar | `T512_L[i] = T512[i >> 4][i & 15]` (flatten 64×16 → 1024) |
| AMD linker: `undefined hidden symbol: cn_hash_full` (47+ refs) | AMD OpenCL compiler (comgr/lld) does not emit standalone symbols for `inline` functions referenced across compilation units | Removed `inline` from 8 cross-file functions: `cn_hash_full`, `jh256_hash`, `cn_populate_aes_tables`, `blake256_hash`, `groestl256_hash`, `skein256_hash`, `cn_hash_fast`, `cn_dispatch` |
| AMD linker: `undefined hidden symbol: jh256_hash` (extra_hash_test) | Same as above | Same fix |
| SKEIN-512 mismatch (only algo failing after inline fix) | For `size==80`, after `UBI_BIG(224, 64)` only `m0`/`m1` were set to `hash->h8[8..9]`; `m2..m7` retained values from first block, corrupting second `UBI_BIG(352, 80)`. Skein requires zero padding for unused final-block bytes. | `m2 = m3 = m4 = m5 = m6 = m7 = 0` before second `UBI_BIG` |
| `SPH_T64`/`SPH_ROTL64` macro cleanup | `as_ulong(x)` is a bitcast, not mod-2^64 wrap; AMD compiler reinterpret quirks | `SPH_T64(x) = (sph_u64)(x)`; `SPH_ROTL64(x, n) = rotate((sph_u64)(x), (sph_u64)((n) & 63))` |

### Verification (AMD gfx1010 / RX 5600 XT)

```
=== RTM SPH GPU vs CPU Test ===
✓     BLAKE: MATCH
✓       BMW: MATCH
✓   GROESTL: MATCH
✓        JH: MATCH
✓    KECCAK: MATCH
✓     SKEIN: MATCH
✓     LUFFA: MATCH
✓  CUBEHASH: MATCH
✓   SHAVITE: MATCH
✓      SIMD: MATCH
✓      ECHO: MATCH
✓     HAMSI: MATCH
✓     FUGUE: MATCH
✓    SHABAL: MATCH
✓     WHIRL: MATCH
--- Summary ---
Pass: 15/15, Fail: 0/15
```

### Commits
- `da703b667` fix(ghostrider): remove inline from cross-file functions for AMD OpenCL linker
- `c7fcc2df7` fix(auxpow): correct Hamsi T512 local table indexing in GhostRider OpenCL (Mac)
- `ba3b7bd94` SKEIN padding fix + report (Mac, includes our SPH_T64 cleanup)

---

## 2. CUDA Feature Gate for non-CUDA builds

### Bug
Commit `f7a86032d` added `cudarc::driver::CudaDevice` references in `main.rs:3296` and `gpu_backend.rs:1645` without `#[cfg(feature = "gpu-cuda")]` gates. The `full` feature only includes `gpu-opencl` + `native-all`, NOT `gpu-cuda`, so `cargo build --features full` failed with `cannot find module or crate 'cudarc'`.

### Fix
- `main.rs:3296-3299`: gated `shared_cuda_dev` parameter with `#[cfg(feature = "gpu-cuda")]` / `#[cfg(not(feature = "gpu-cuda"))]` (latter uses `Option<()>`)
- `gpu_backend.rs:1641-1663`: added `#[cfg(not(feature = "gpu-cuda"))]` fallback `create_gpu_backend_with_cuda_device` that accepts `Option<()>` and ignores it

### Commit
- `bedb9e8f7` fix(gpu): CUDA feature gate for non-CUDA builds + OpenCL scratchpad interleaved layout

---

## 3. native-hashers in `full` feature (EPIC/KawPow DAG)

### Bug
EPIC (progpow) and KawPow algorithms require per-epoch DAG generation via the `native-hashers` feature (C FFI). The `full` feature did not include it, so the miner logged:
```
ext_gpu_epoch_failed: DAG-based algorithm 'progpow' requires the 'native-hashers' feature
```

### Fix
Added `"native-hashers"` to the `full` feature array in `V3/L1/miner/Cargo.toml`.

### Verification
- EPIC progpow kernel now runs: `auxpow_gpu_kernel_enqueue algo=progpow gws=3137536 dag_elements=set`
- EPIC pool login successful (height 3627565, epoch 120, share_diff 2500000000)
- VRSC CPU stream shares accepted simultaneously

### Commit
- `92a4a9145` feat(miner): include native-hashers in 'full' feature for EPIC/KawPow DAG

---

## 4. Security Hardening — completion

### SSH port 22 closed (Edge)
- Removed `/etc/systemd/system/ssh.socket.d/port22.conf` (added `ListenStream=0.0.0.0:22` backdoor)
- `systemctl daemon-reload && systemctl restart ssh.socket`
- Removed UFW rules #12 (22/tcp IPv4) and #21 (22/tcp v6)
- Verified: `ssh -p 22 zion-new` → Connection refused; `ssh -p 2222 zion-new` → OK
- Only port 2222 remains open for SSH

### AppArmor enforce mode (Edge)
- `zion-node-opt` profile (for `/opt/zion/V3/target/release/node`) switched from complain → enforce
- Pre-switch audit: **0 AppArmor DENY events in 24h**
- Post-switch verification (10s + 30s): **0 DENY events**
- Node1 (PID 210127) + Node2 (PID 210160) running stable under enforce, tip 11006→11325+
- Command: `sudo aa-enforce /etc/apparmor.d/opt.zion.V3.target.release.node`

### F1 "attacker" IP investigation
- Edge log showed 1150 P2P connect/disconnect per hour from `109.81.31.210`
- Investigation: `109.81.31.210` is our LAN NAT (local PC external IPv4)
- NOT an attacker — it is the backup node + miner + SSH traffic from our network
- No UFW block applied (would block our own traffic)

---

## 5. Pool Setup page — Edge dashboard deploy

### Commit
- `a55cfa2b2` feat(dashboard+explorer): Pool Setup page + Explorer v4 engine plan

### Files (1071 lines added)
- `ZION_OS/dashboard/dashboard.html`: new "Setup" tab with 3 stream cards (ZION GPU / GPU External / CPU External), algorithm/backend/worksize selectors, enable toggles, Save + Restart Pool buttons, supported AuxPoW coin grid (23 coins)
- `ZION_OS/dashboard/dashboard.js`: poolSetupLoad/Save/Restart handlers, coin grid renderer, stream status polling, cache-bust v115
- `ZION_OS/dashboard/app.py`: GET/POST `/api/pool/setup` endpoints (get_pool_setup_config, update_pool_setup_config), config persisted to edge-environment.sh

### Deploy
- `scp` 3 files to `zion-new:/opt/zion/ZION_OS/dashboard/`
- `systemctl restart zion-edge-python-dashboard.service`
- Verified: `curl -u Yose:*** http://127.0.0.1:8766/api/pool/setup` returns 3-stream config JSON
- Dashboard HTML serves Setup tab + Pool Setup pane

### Stash `pre-pull-2026-07-18` resolved
- Popped stash (24 files: dashboard + explorer v4)
- Trivial conflict in `dashboard.html` (cache-bust v114 vs v115) — resolved to v115
- Stash dropped

---

## 6. Backup node fresh sync

- DB wiped (old chain state at height 9355 with gap 1-10003 unrecoverable due to Edge `block_retention=1000` pruning)
- Service restarted with `ZION_BLOCK_RETENTION=0` (commit `62d8619bf`) — backup node is now the canonical full-history archive
- Fresh sync from Edge: backup node now tracks tip live (11325 = Edge 11325)
- Note: blocks 1-10003 are permanently lost (pruned before any backup captured them); backup node retains blocks 10004+ going forward

---

## 7. Miner status (end of session)

- **PID:** 941789 (restart via watchdog after system reboot at 10:37 CEST)
- **Pool height:** 11526 (following tip live)
- **3 streams active:**
  - ZION (deeksha_lite_v1) ✅ — shares accepted
  - KAS GPU (kheavyhash) ✅ — `ext_gpu_tx_send` confirmed
  - VRSC CPU (verushash) ✅ — `VRSC_SHARE_FOUND` + pool `accepted=true`
- **Hashrate:** ~18 KH/s overall (OpenCL on AMD RX 5600 XT)
- **Build:** `cargo build --features full` (gpu-opencl + native-all + native-hashers), binary 7.8 MB

---

## 8. System events during session

- **System reboot at 10:37 CEST** (cause unknown — likely kernel update from `apt upgrade` the previous day)
- All services auto-restarted via systemd: backup node, miner (via watchdog), Edge services unaffected (remote)
- `/tmp` logs cleared (tmpfs) — miner log rotated to `/tmp/zion-miner.log`

---

## Pending items

1. **Deploy local repo to Edge** — Edge node/pool binaries are older than local; dashboard already deployed
2. **Bridge vault UTXO scaled amount fix** — local uncommitted changes in `V3/L1/core/{rpc,bridge,lib,peer_block_validation,node}.rs` (5 files, +134/-26 lines) — normalise anomalous legacy-scale post-migration UTXO for bridge vault address
3. **Public repo sync** — `git subtree push --prefix=public public main` (deferred until private repo stabilises)

---

## Files modified this session

- `AuXpow/csrc/opencl/ghostrider_sph.cl` — HAMSI T512_L flatten + SKEIN padding + SPH_T64/ROTL64 cleanup
- `AuXpow/csrc/opencl/ghostrider_sph/x16rs.cl` — HAMSI T512_L flatten (source mirror)
- `AuXpow/csrc/opencl/ghostrider_cn.cl` — removed `inline` from 8 cross-file functions
- `AuXpow/csrc/opencl/ghostrider_kernel.cl` — removed `inline` from 3 helper functions
- `V3/L1/miner/Cargo.toml` — added `native-hashers` to `full` feature
- `V3/L1/miner/src/main.rs` — CUDA feature gate (from earlier session, commit `bedb9e8f7`)
- `V3/L1/miner/src/gpu_backend.rs` — CUDA feature gate fallback (from earlier session, commit `bedb9e8f7`)
- `ZION_OS/dashboard/{app.py,dashboard.html,dashboard.js}` — Pool Setup page (commit `a55cfa2b2`)
- `docs/3.0.6/SESSION_REPORT_2026-07-19_GHOSTRIDER_GPU.md` — this report

## Edge server changes (not in git)

- `/etc/systemd/system/ssh.socket.d/port22.conf` — deleted
- UFW rules #12, #21 (22/tcp) — deleted
- `/etc/apparmor.d/opt.zion.V3.target.release.node` — switched to enforce
- `/opt/zion/ZION_OS/dashboard/{app.py,dashboard.html,dashboard.js}` — deployed
