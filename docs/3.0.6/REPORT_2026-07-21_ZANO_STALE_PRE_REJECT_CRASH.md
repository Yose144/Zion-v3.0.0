# Crash Report — ZANO (ProgPoWZ) Share Rejection Incident

**Date:** 2026-07-21
**Severity:** High (ZANO stream 0% acceptance, 407 consecutive rejects)
**Affected service:** `zion-edge-pool.service` (Edge, `62.171.141.136`, PID 2410662 after redeploy)
**Affected code:** `AuXpow/src/auxpow_client.rs` — `parse_eth_getwork_params()` + `submit_share()` stale pre-rejection
**Status:** **RESOLVED** — 3/3 ZANO shares accepted post-fix, 0 pool-side rejects

---

## 1. Symptom

Miner TUI reported ZANO stream at **0 accepted / 407 rejected (0% efficiency)** while VRSC and ZION streams operated normally (VRSC ~100%, ZION ~99.6%). Every ZANO share submitted to the pool was rejected with:

```
auxpow: ZANO stale job=0xf12797801114f4.. nonce=3452826371 — pre-rejected (age > 30s)
auxpow_bridge: share_forwarded job_id=0xf12797801114f4c6... result=Rejected("stale job — pre-rejected (ZANO job expired)") elapsed_ms=0
external_share_result miner=local-miner coin=ZANO accepted=false status=rejected: stale job — pre-rejected (ZANO job expired)
```

The rejection happened **locally in the pool's AuXpow bridge**, before the share was ever forwarded to HeroMiners. HeroMiners never saw the share — the `elapsed_ms=0` and `result=Rejected("stale job — pre-rejected ...")` confirm this was a local pre-rejection, not an upstream rejection.

## 2. Timeline

| Time (CEST) | Event |
|---|---|
| prev session | Pool-side stale-job check patched in `V3/L1/pool/src/bin/server.rs` to accept any `external_job_id` in the bridge queue (not just the latest). Deployed to Edge. **Did not fix ZANO rejects.** |
| earlier this session | Root cause #2 discovered: HeroMiners ZANO returns `eth_getWork` with `[header_hash, seed_hash, ...]` (swapped vs standard Ethereum `[seed_hash, header_hash, ...]`). Fixed with ZANO-specific `(seed_idx, header_idx) = (1, 0)` swap in both `request_eth_getwork()` and the push notification handler. Added job age tracking + 30s stale pre-rejection (`ZION_ZANO_STALE_SECS`). Rebuilt + redeployed. **VRSC fixed (100% accepted), ZANO still 0%.** |
| 19:42:35 | Pool logs show ZANO job `0xf12797801114f4c6...` first queued. `job_received_at` timestamp inserted. |
| 19:42:36–19:47:13 | HeroMiners re-broadcasts the same `header_hash` every ~3s for 4 min 38 s. GPU is scanning nonces against ZANO's hard target `0x000000044b82fa09b5...` (≈2^30 difficulty) at ~7 MH/s. |
| 19:47:13 | GPU finds a share (nonce=3452826371). Pool receives `external_share_received coin=ZANO job_id=0xf12797801114f4c6...`. |
| 19:47:16 | AuXpow bridge pre-rejects the share: `is_job_stale(job_id, 30)` returned `true` because `job_received_at[0xf12797801114f4c6...]` was 278 s old (>30 s threshold). Share discarded locally. |
| 20:13 | Rebuild with stale-timestamp-refresh fix finished on Edge (23 m 05 s). |
| 20:19:56 | New pool binary deployed (PID 2410662). |
| 20:32 | **First ZANO share accepted** by HeroMiners: `share_forwarded result=Accepted elapsed_ms=28`. |
| 20:39 | **3rd ZANO share accepted.** 0 pool-side rejects since redeploy. |

## 3. Root Cause

In `parse_eth_getwork_params()` (`AuXpow/src/auxpow_client.rs`), the `job_received_at` timestamp for a ZANO `header_hash` was inserted **only on first sighting**:

```rust
// BUG: timestamp frozen at first sighting
let mut jra = self.job_received_at.lock().await;
if !jra.contains_key(header_hex) {
    jra.insert(header_hex.to_string(), std::time::Instant::now());
    // ...
}
```

The accompanying comment was wrong:

> *"Only insert on first sighting of a new header_hash — don't update on re-sends (pool keeps sending the same header_hash every 2-5s but internally expires the job after ~30-60s)."*

This assumed the first-sighting time was the right anchor for staleness. It is not. EthStratum pools (HeroMiners ZANO) re-broadcast the same `header_hash` every 2-5 s **for as long as the upstream job is valid**, and stop only when the job actually expires. Therefore the **most recent receive time** — not the first — is the correct anchor.

Using the first sighting caused `is_job_stale(job_id, 30)` to return `true` for any share that took longer than `ZION_ZANO_STALE_SECS=30` s to find. At ~7 MH/s against ZANO's target `0x000000044b...` (≈2^30 difficulty), a share takes **2-5 minutes** to find — always exceeding the 30 s threshold. Every ZANO share was pre-rejected locally before reaching HeroMiners.

The 30 s threshold itself is reasonable; the bug was that the timestamp was never refreshed despite the pool continuing to confirm the job's validity every 2-5 s.

## 4. Fix

`AuXpow/src/auxpow_client.rs` lines 4991-5010 — refresh the timestamp on **every** re-send of the same `header_hash`:

```rust
// Track job age for stale share detection (EthStratum / ZANO).
// UPDATE the timestamp on every re-send of the same header_hash.
// EthStratum pools (HeroMiners ZANO) re-broadcast the same header_hash
// every 2-5s for as long as the upstream job is valid, and stop only
// when the job actually expires.  Therefore the most recent receive
// time — not the first — is the correct anchor for staleness.  Using
// the first sighting would pre-reject shares for any job that takes
// longer than ZION_ZANO_STALE_SECS to find a share (which at ~7 MH/s
// and ZANO's hard target is minutes, not seconds).
{
    let mut jra = self.job_received_at.lock().await;
    jra.insert(header_hex.to_string(), std::time::Instant::now());
    // Evict entries older than 5 minutes to bound memory.
    if jra.len() > 64 {
        let cutoff = std::time::Instant::now()
            .checked_sub(std::time::Duration::from_secs(300))
            .unwrap_or_else(std::time::Instant::now);
        jra.retain(|_, ts| *ts > cutoff);
    }
}
```

**Behavior after fix:**
- While HeroMiners keeps sending the same `header_hash` (every 2-5 s), `job_received_at` stays <5 s old → `is_job_stale` returns `false` → shares are forwarded upstream.
- When the upstream job actually expires, HeroMiners stops sending that `header_hash` → timestamp ages past 30 s → shares correctly pre-rejected (saves a round-trip and avoids inflating the reject rate with upstream "Job expired" responses).

## 5. Verification

Post-redeploy pool logs (PID 2410662, started 20:19:56):

```
external_share_received miner=local-miner coin=ZANO job_id=0x700cc4679a61b0bb... nonce=3102891234
auxpow_bridge: share_forwarded job_id=0x700cc4679a61b0bb... nonce=3102891234 result=Accepted elapsed_ms=28
external_share_result miner=local-miner coin=ZANO accepted=true status=accepted
```

- **3 ZANO shares accepted** by HeroMiners in the first ~20 minutes post-redeploy
- **0 pool-side rejects** since restart
- VRSC remains 100% accepted
- The 4 miner-TUI rejects are frozen from the 52 s restart window (20:19:04 → 20:19:56) — no new rejects accumulating

## 6. Related Fixes (this session, same file)

1. **ZANO getWork element swap** — HeroMiners ZANO returns `[header_hash, seed_hash, ...]` (swapped vs standard Ethereum `[seed_hash, header_hash, ...]`). Added ZANO-specific `(seed_idx, header_idx) = (1, 0)` in both `request_eth_getwork()` (~line 4781) and the push notification handler (~line 2186). Without this fix, `job_id` was set to the `seed_hash` instead of the real `header_hash`, causing every `eth_submitWork` to reference the wrong job.

2. **Stale pre-rejection threshold** — `ZION_ZANO_STALE_SECS` env var (default 30 s, `0` to disable). Pre-rejects shares for jobs HeroMiners has stopped broadcasting, saving a round-trip.

3. **Response parsing for `{"status":"OK"}`** — HeroMiners returns `{"result": true, "status": "OK"}` on accepted shares; the parser now recognizes this as acceptance.

## 7. Files Modified

- `AuXpow/src/auxpow_client.rs` — ZANO getWork swap, stale timestamp refresh, response parsing, job age tracking
- `V3/L1/pool/src/bin/server.rs` — stale job check (from previous session, already deployed)

## 8. Deployment

- Edge binary: `/opt/zion/V3/target/release/server` (rebuilt 20:13, md5 `7792296d32afe4cd1db928a42c04618b`)
- Service: `zion-edge-pool.service` restarted 20:19:56, PID 2410662
- Build time: 23 m 05 s (`cargo build --release` in `/opt/zion/V3/`)
- Source synced: `scp -P 2222 AuXpow/src/auxpow_client.rs zion-new:/opt/zion/AuXpow/src/auxpow_client.rs`

## 9. Prevention

- The misleading comment ("don't update on re-sends") was the proximate cause of the bug surviving code review. Comments that assert external system behavior should be verified against actual wire traces, not assumed.
- The 30 s threshold is correct for the **refreshed** timestamp semantics. If a pool ever stops re-broadcasting valid jobs (unlikely for EthStratum), shares will be pre-rejected after 30 s — set `ZION_ZANO_STALE_SECS=0` to disable and forward everything.
- For any new EthStratum pool integration, verify the `getWork` element order against a wire trace before assuming the standard `[seed_hash, header_hash, ...]` layout. HeroMiners ZANO is a confirmed swap case.
