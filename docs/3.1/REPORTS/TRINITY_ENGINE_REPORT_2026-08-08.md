# TRINITY ENGINE PARALLEL MINING REPORT
**Date:** 2026-08-09 03:50 CET (updated)
**Engine:** V3 Trinity (ZION + ZANO + VRSC)

---

## Architecture

```
┌─────────────────┐     V3 Protocol      ┌──────────────────┐
│   Mac M1        │◄────────────────────►│  Edge Pool       │
│  Stream 1: ZION │   Job { ext: ZANO }  │  auxpow_runtime  │
│  Stream 2: ZANO │   Job { ext_cpu:VRSC}│    ZANO → HeroMiners
│  Stream 3: VRSC │   ExternalSubmit     │    VRSC → LuckPool
└─────────────────┘                      └──────────────────┘
┌─────────────────┐
│   Vega Rig      │◄────────────────────►│
│  Stream 1: ZION │   V3 Protocol        │
│  Stream 2: ZANO │                      │
│  Stream 3: VRSC │                      │
└─────────────────┘
┌─────────────────┐
│ zionserver-gpu  │◄────────────────────►│
│  Stream 1: ZION │   V3 Protocol        │
│  (remote GPU)   │                      │
└─────────────────┘
```

## Bugs Found & Fixed

### Bug 1: Pool share forwarding not logged
**File:** `V31/L1/pool/src/stratum.rs`, `V31/L1/pool/src/auxpow_runtime.rs`

Pool accepted `v3_external_submit` messages from miners but did not log the result
of forwarding shares to upstream pools (HeroMiners/LuckPool). Added `tracing::info!`
calls to both `stratum.rs` (after `bridge.forward_by_ticker()`) and `auxpow_runtime.rs`
(after `forward_share_to_upstream()`).

### Bug 2: ZANO header_bytes empty → silent rejection
**File:** `V31/L1/pool/src/auxpow_runtime.rs`

`ShareForwardRequest.header_bytes` was always `Vec::new()` (set in `stratum.rs:1503`).
`forward_share_to_upstream()` unconditionally built `header_hash = "0x" + hex::encode(&[])`
= `"0x"`. HeroMiners EthStratum expects the block header hash in `eth_submitWork` params;
an empty `0x` causes silent rejection.

**Fix:** Pass `None` when `header_bytes` is empty, so `submit_share()` falls back to
using `job_id` as the header hash (which is the correct block header hash for EthStratum).

```rust
// BEFORE:
let header_hash = format!("0x{}", hex::encode(&req.header_bytes));
// ...
Some(&header_hash)

// AFTER:
let header_hash_opt = if req.header_bytes.is_empty() {
    None
} else {
    Some(format!("0x{}", hex::encode(&req.header_bytes)))
};
// ...
header_hash_opt.as_deref()
```

**Commit:** `4b37b4c11` — `fix(pool): add share forwarding logs + fix empty header_bytes for ZANO`

## Verified Results (pre-restart window: 20:50–21:33)

### Stream 1 — ZION (GPU EkamDeeksha v3.2)
| Miner | GPU | Shares | Status |
|-------|-----|--------|--------|
| mac-m1-metal | Apple M1 Metal | 44 total | ✅ Accepted |
| vega-smos | Vega 64 OpenCL | 1407 total | ✅ Accepted |
| zionserver-gpu | Remote GPU | 41846 total | ✅ Accepted (primary block finder) |
| v31-miner | Edge CPU | 3083 total | ✅ Accepted |

### Stream 2 — ZANO (GPU ProgPoWZ)
| Component | Status |
|-----------|--------|
| Pool → HeroMiners (`de.zano.herominers.com:1110`) | ✅ Connected |
| Pool receives ZANO jobs | ✅ height 3807382+ |
| Mac M1 ZANO mining | ❌ Metal ProgPoWZ stub (not ported for V31) |
| Vega rig ZANO mining | ⚠️ OpenCL ProgPoWZ running, no solutions (high difficulty) |
| Pool forwarding | ✅ Fix applied (header_bytes → None fallback) |

### Stream 3 — VRSC (CPU VerusHash)
| Component | Status |
|-----------|--------|
| Pool → LuckPool (`eu.luckpool.net:3956`) | ✅ Connected |
| Vega rig VRSC submits | ✅ 3 external submits verified (20:55) |
| Mac M1 VRSC mining | ⚠️ CPU mining active, no solution yet |
| Edge CPU VRSC mining | ⚠️ CPU mining active, no solution yet |

### VRSC External Submit Evidence
```
v3_external_submit miner=zion1s6m204... coin=VRSC job=4f07f72 nonce=3
v3_external_submit miner=zion1s6m204... coin=VRSC job=4f07f74 nonce=0
v3_external_submit miner=zion1s6m204... coin=VRSC job=4f07f74 nonce=0
```

### Chain Growth
| Window | Height | Blocks |
|--------|--------|--------|
| 20:46 | 715 | — |
| 20:54 | 724 | +9 |
| 21:00 | 730 | +6 |
| 21:09 | 734 | +4 |
| 21:18 | 743 | +9 |
| 21:33 | 759 | +16 |
| 22:10 | 759 | 0 (zionserver-gpu offline) |

## Current Issues (22:10 CET)

### zionserver-gpu offline
The primary block finder (41846 shares, ~1 block/min) disconnected when the pool
was restarted to deploy the header_bytes fix. It is a remote GPU miner not managed
by systemd. **Chain stagnates at 759 without it.** Needs manual restart.

### Vega rig offline
SMOS agent crashed after cyclic reboots (GLIBC mismatch → 52 reboot cycles).
The miner process self-recovered earlier (submitted VRSC shares at 20:55) but
disconnected after pool restart. Needs physical power cycle.

### Mac M1 ZANO
Metal ProgPoWZ is a stub in V31 (`mod.rs:8637`). Implementing it requires:
1. Per-epoch DAG generation (`native-hashers` feature)
2. Metal ProgPoWZ kernel (port from OpenCL `deeksha_chv3.cl`)
3. Metal external miner implementation

## Pool External Bridge Status

```
auxpow[VRSC]: connected to eu.luckpool.net:3956 (zcashstratum)
auxpow[ZANO]: connected to de.zano.herominers.com:1110 (ethstratum)
```

Both external pools are connected and providing jobs. The pool distributes
Trinity Job messages with `external_stream` (ZANO) and `external_stream_cpu` (VRSC)
fields to all connected miners.

## Configuration

### Mac M1
```env
ZION_V3_TRINITY=1
ZION_STREAM1_ENABLED=1   # ZION Metal GPU
ZION_STREAM2_ENABLED=1   # ZANO Metal GPU (stub — fails gracefully)
ZION_STREAM3_ENABLED=1   # VRSC CPU VerusHash
ZION_GPU_BACKEND=metal
ZION_GPU_WORK_SIZE=4096
ZION_MINER_THREADS=4
```

### Vega Rig (SMOS)
```env
ZION_V3_TRINITY=1
ZION_STREAM1_ENABLED=1   # ZION OpenCL GPU
ZION_STREAM2_ENABLED=1   # ZANO OpenCL GPU (ProgPoWZ)
ZION_STREAM3_ENABLED=1   # VRSC CPU VerusHash
ZION_GPU_BACKEND=opencl
ZION_GPU_WORK_SIZE=4096
ZION_MINER_THREADS=4
```

### Edge Pool
```env
ZION_POOL_AUXPOW_ENABLED=1
ZION_POOL_AUXPOW_COIN=ZANO
ZION_POOL_AUXPOW_WALLET_ZANO=ZxCj5kQhNdW7xtt4hDTotBPGUsWYKRdtdPTFXjzFpPpf6q42rCVXcYnTtHRYGj3pzz2LUqCnvVoRzFn9zfZdCSzC1CkBiHYrg
ZION_POOL_AUXPOW_CPU_COIN=VRSC
ZION_POOL_AUXPOW_CPU_WALLET=RLFQYsdd8wGGUgMgk17WrqdGNtkAVSCfDQ
ZION_POOL_AUXPOW_CPU_WORKER_NAME=zion_triple
ZION_POOL_AUXPOW_CPU_REGION=eu
```

## Files Changed

| File | Change | Commit |
|------|--------|--------|
| `V31/L1/pool/src/stratum.rs` | Add `v3_external_forward` log after bridge forward | `4b37b4c11` |
| `V31/L1/pool/src/auxpow_runtime.rs` | Add `share forwarded` log + fix empty header_bytes → None | `4b37b4c11` |
| `V31/L1/miner/src/config.rs` | Read `ZION_STREAM{1,2,3}_ENABLED` env vars | `abff6874b` |
| `V31/L1/miner/src/bin/zion-miner.rs` | `--no-*` flags augment env vars instead of overriding | `abff6874b` |
| `V31/L1/miner/src/runtime.rs` | V3 trinity checks `stream{2,3}_enabled` before spawning | `abff6874b` |
| `V31/L1/miner/src/gpu_guard.rs` | scratchpad 256→512 KiB, Vega work_size 4096 | earlier |
| `V31/L1/miner/src/gpu/kernels/metal/deeksha_lite.metal` | u64 SHA3-512 optimization (+45%) | earlier |

## Next Steps

1. **Restore remote GPU miner** — zionserver-gpu needs its remote GPU back for block finding
2. **Physical restart Vega rig** — restore OpenCL GPU + VRSC CPU streams
3. **Verify ZANO forwarding** — with fix applied, confirm HeroMiners accepts shares (needs GPU miner)
4. **Verify VRSC forwarding** — confirm LuckPool accepts shares from pool (needs Vega rig)
5. **Port Metal ProgPoWZ** — enable ZANO on Mac M1 (future work)

See [SHARE_VERIFY_TRINITY_2026-08-09.md](./SHARE_VERIFY_TRINITY_2026-08-09.md) for full share verification report.

---

Generated with [Devin](https://devin.ai)
