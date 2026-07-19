# ALPH Mining Fix Report — 2026-07-19

## Summary

Transitioned GPU external mining from Kaspa (KAS) to Alephium (ALPH) on the
SMOS Vega 64 rig, retaining VerusCoin (VRSC) for CPU mining. Multiple bugs
were identified and fixed in the `zion-miner` + `zion-pool` stack to enable
ALPH blake3 share submission to Herominers.

## Background

KAS is now ASIC-dominated; GPU mining is no longer profitable. ALPH uses
blake3 (GPU-friendly) and was selected as the replacement. ALPH wallet:
`17GSUoYgQo8Q4szfAMCqxjMqSadGpZmrFyca8ZoS5vM4r`. Pool: Herominers
(`de.alephium.herominers.com:1199`).

## Issues Identified & Fixed

### 1. ALPH Share Target Override (`auxpow_client.rs`)

**Problem:** Herominers does not send `mining.set_difficulty` for ALPH. The
pool used the block target (2^226) as the share target, making it
practically impossible for GPU miners to find shares.

**Fix:** Added `ZION_AUXPOW_{TICKER}_SHARE_TARGET_HEX` environment variable
override in `share_target()`. When set, the pool uses the operator-specified
target instead of computing from difficulty. This allows lowering the share
difficulty for coins that don't support `mining.set_difficulty`.

```rust
if let Ok(target_hex) = std::env::var(
    format!("ZION_AUXPOW_{}_SHARE_TARGET_HEX", self.profile.coin.ticker())
) {
    if let Some(t) = crate::external_hashers::parse_target_hex(&target_hex) {
        return t;
    }
}
```

**Config:** `ZION_AUXPOW_ALPH_SHARE_TARGET_HEX` set in
`/etc/zion/edge-environment.sh` on Edge server.

### 2. Blake3 Algorithm Selection for ALPH (`gpu_backend.rs`)

**Problem:** `CpuExternalMiner` (M1 fallback) checked
`self.algorithm == "blake3_alph"` to select the ALPH double-blake3 hash.
However, the pool sends algorithm `"blake3"` (not `"blake3_alph"`) for ALPH,
so the miner used the standard blake3 hash (DCR variant) instead of the ALPH
double-blake3. This produced incorrect hashes — no shares would ever match.

**Fix:** Added `coin` field to `CpuExternalMiner` and check
`self.coin.eq_ignore_ascii_case("ALPH")` in addition to the algorithm name:

```rust
let is_alph = self.algorithm == "blake3_alph"
    || self.coin.eq_ignore_ascii_case("ALPH");
```

Updated both `mine_batch()` and `mine_batch_raw()` in the CPU fallback path.
The OpenCL kernel path was already correct (`kernel_info` maps both
`"blake3"` and `"blake3_alph"` to `blake3_alph_mine`).

### 3. External GPU Thread Channel Drain (`main.rs`)

**Problem:** The external GPU thread used a single `try_recv()` per loop
iteration. The pool sends `wire_job` every ~1s, and each contains the
external stream. While the GPU batch runs (~0.1–0.5s), multiple jobs
accumulate in the unbounded mpsc channel. The thread processed them FIFO,
always mining on stale jobs — observed 15+ jobs behind on ALPH (Herominers
sends new jobs every ~5s).

**Fix:** Drain the channel at the top of each loop iteration, keeping only
the latest job:

```rust
let mut latest_job: Option<ExternalStreamJob> = None;
let mut channel_disconnected = false;
loop {
    match rx.try_recv() {
        Ok(job) => { latest_job = Some(job); }
        Err(TryRecvError::Empty) => break,
        Err(TryRecvError::Disconnected) => {
            channel_disconnected = true;
            break;
        }
    }
}
```

### 4. Pool Job Queue Size (`server.rs`)

**Problem:** The `MultiAuxPowBridge` job queue held at most 2 jobs per coin.
ALPH Herominers sends new jobs every ~5s. With the miner potentially 1–2
batches behind, shares for the 3rd-most-recent job were rejected as stale
even though they were valid work.

**Fix:** Increased queue capacity from 2 to 5:

```rust
// Keep at most 5 jobs per algorithm to tolerate frequent
// job updates (e.g. ALPH Herominers sends new jobs every ~5s).
while q.len() >= 5 {
    q.pop_back();
}
```

### 5. `difficulty_to_target_with_max` Edge Case (`auxpow_client.rs`)

**Problem:** The function returns `max_target` when `difficulty <= 1.0`.
The initial approach used `ZION_AUXPOW_ALPH_SHARE_DIFF=0.001` to lower the
difficulty, but 0.001 <= 1.0 triggered the early return, yielding
`max_target` (2^226) — the hardest possible target. The override had no
effect.

**Fix:** Replaced the difficulty override with a direct target hex override
(`ZION_AUXPOW_{TICKER}_SHARE_TARGET_HEX`), bypassing the
`difficulty_to_target_with_max` function entirely.

## Files Changed

| File | Change |
|------|--------|
| `AuXpow/src/auxpow_client.rs` | `share_target()` env var override |
| `AuXpow/src/multiplexer.rs` | `pack_job` uses `share_target()` |
| `V3/L1/miner/src/gpu_backend.rs` | `CpuExternalMiner` coin field + ALPH hash selection |
| `V3/L1/miner/src/main.rs` | External GPU thread channel drain |
| `V3/L1/pool/src/bin/server.rs` | Job queue size 2→5, stale job check |

## Deployment

- **Edge server (`62.171.141.136`):** Pool rebuilt and restarted with
  `ZION_AUXPOW_ALPH_SHARE_TARGET_HEX` env var. Pool logs confirm override
  is active: `auxpow: ALPH share_target override hex=ffff...0000`.
- **SMOS rig:** New miner binary `v3.0.33-alph-fix` built and published to
  `https://zionterranova.com/zion-miner/zion-miner-v3.0.33-alph-fix.zip`.
  Pending: SMOS rig reload to pick up new binary (requires SMOS web UI
  update or API reload).

## Current State (2026-07-19 23:30 UTC+2)

- ALPH blake3 mining: **38 MH/s** on Vega 64 OpenCL
- Shares found: Yes (with easy target `ffff...0000`)
- Shares accepted by Herominers: **Pending** — shares are stale because
  SMOS rig still runs old binary (without channel drain fix). New binary
  published but not yet loaded on SMOS.
- VRSC verushash: 1.1 MH/s CPU, shares accepted
- RTM ghostrider: CPU shares accepted
- XMR randomx: CPU shares accepted

## Next Steps

1. **Deploy new binary to SMOS** — update miner URL in SMOS web UI to
   `https://zionterranova.com/zion-miner/zion-miner-v3.0.33-alph-fix.zip`
   and reload rig.
2. **Tune ALPH share target** — current `ffff...0000` (2^256-2^16) is
   intentionally too easy for testing. Once shares are accepted, set a
   reasonable target for ~1 share/10s at 38 MH/s:
   `0000004000000000000000000000000000000000000000000000000000000000`
   (2^234).
3. **Verify Herominers acceptance** — confirm ALPH shares are accepted
   (not stale) after channel drain fix is deployed.
4. **Update AGENTS.md** with ALPH/QUAI wallet info.
5. **Consider QUAI mining** — QUAI was added to the pool config but not
   yet tested.
