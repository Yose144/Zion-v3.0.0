# Pool ZANO stale-share incident report

**Date:** 2026-07-23
**Affected rig:** `vega-smos` (ZionRig, AMD Vega 64 8GB, SMOS)
**Affected pool/service:** `zion-edge-pool.service` on Edge (`62.171.141.136`)
**Upstream:** HeroMiners ZANO (`de.zano.herominers.com:1110`)
**Status:** Intermittent recovery — some ZANO shares accepted, stale pre-rejects still occurring

---

## 1. Symptom

After unbanning the rig from `fail2ban` jail `zion-p2p` and rebooting it, the rig reconnected to the Edge pool and started mining on all three streams (ZION GPU, ZANO GPU, VRSC CPU). ZION and VRSC produced accepted shares, but almost every ZANO share was rejected locally by the pool with:

```
external_share_result miner=local-miner coin=ZANO accepted=false status=rejected: stale job — pre-rejected (ZANO job expired)
auxpow: ZANO stale job=0xace36a85b0716a.. nonce=782201223 — pre-rejected (age > 30s)
auxpow_bridge: share_forwarded job_id=0xace36a85... nonce=782201223 result=Rejected("stale job — pre-rejected (ZANO job expired)") elapsed_ms=3
```

Two ZANO shares were accepted after reconnect (`15:32:52` and `15:33:17` UTC), followed by more stale rejects. VRSC accepted shares continued normally.

---

## 2. Root cause

The ZANO stale pre-rejection logic in `AuXpow/src/auxpow_client.rs` uses a per-job timestamp `job_received_at` (refreshed in `parse_eth_getwork_params`) and rejects shares older than `ZION_ZANO_STALE_SECS` (default 30 s).

The timestamp is updated **only when the pool receives an `eth_getWork` response/notification from HeroMiners**. During normal operation HeroMiners re-broadcasts the same header every few seconds, keeping `job_received_at` fresh. After the rig reconnect, HeroMiners sent a ZANO job and then **went silent for ~5 minutes** (no `eth_getWork` notifications). The pool kept sending the same old `external_stream` ZANO job to the miner inside `wire_job`, and when the miner found shares for that job they were pre-rejected because `job_received_at` was >30 s old.

Later, HeroMiners resumed and started sending rapid job changes (new ZANO header every ~5–10 s). The pool's `wire_job`/`parallel_stream_embedded` updated to the new jobs, which is why a few shares were accepted, but any share that arrived after the 30 s freshness window for its specific `header_hash` was still pre-rejected.

Key observation: the pool's freshness heuristic is anchored to **last upstream notification time**, not to **when the pool last distributed the job to miners**. As long as the pool keeps sending a job in `wire_job`, the job is still the one the miner is working on and should be considered valid.

### Affected code

- `AuXpow/src/auxpow_client.rs`
  - `job_received_at` HashMap (line 325)
  - `parse_eth_getwork_params()` inserts/updates the timestamp (lines 5105–5124)
  - `is_job_stale()` (lines 3355–3367)
  - `submit_share()` pre-rejects EthStratum/ZANO shares (lines 3680–3696)
- `V3/L1/pool/src/bin/server.rs`
  - `parallel_stream_embedded` log (line 4283)
  - `external_share_received` / `external_share_result` log (lines 4534, 4669)

---

## 3. Log evidence

### HeroMiners went silent for ~5 minutes

```text
Jul 23 17:26:16 ... auxpow: ZANO poll msg method= id=None result=array[4] ... height=0x39bd6b
...
Jul 23 17:31:16 ... auxpow: ZANO poll msg method= id=None result=array[4] ... height=0x39bd6c
```

Between `17:26:16` and `17:31:16` there were no ZANO `eth_getWork` push notifications, while the pool kept sending the same `0xace36a85...` ZANO job to `vega-smos`.

### Shares rejected during the silent period

```text
Jul 23 17:26:44 ... external_share_received miner=local-miner coin=ZANO job_id=0xace36a85... nonce=782201223
Jul 23 17:26:46 ... external_share_result ... coin=ZANO accepted=false status=rejected: stale job — pre-rejected (ZANO job expired)
```

### After resume, jobs change rapidly

```text
Jul 23 17:35:47 ... parallel_stream_embedded miner=vega-smos coin=ZANO ... ext_job_id=0xd0ad2a22... height=3784062
Jul 23 17:35:54 ... parallel_stream_embedded miner=vega-smos coin=ZANO ... ext_job_id=0x9d838a38... height=3784063
Jul 23 17:35:59 ... parallel_stream_embedded miner=vega-smos coin=ZANO ... ext_job_id=0xe6573edf... height=3784064
```

### Two accepted ZANO shares after reconnect

```text
Jul 23 17:32:52 ... external_share_result miner=local-miner coin=ZANO accepted=true status=accepted
Jul 23 17:33:17 ... external_share_result miner=local-miner coin=ZANO accepted=true status=accepted
```

---

## 4. Operational changes already made

- Added `109.81.87.122` to `ignoreip` in `/etc/fail2ban/jail.d/zion-p2p.conf` and reloaded fail2ban.
- Rebooted the SMOS rig.
- Added `export ZION_MINER_ID=vega-smos` to `MinerP3.0.6/Smos/vega-smos.env` and `wrapper_complete.sh` so share logs match the worker name (`vega-smos`) instead of the default `local-miner`. Committed as `673563634`.

---

## 5. Proposed fixes

### 5.1 Preferred fix: refresh `job_received_at` on `wire_job` distribution

The most robust fix is to refresh the freshness timestamp every time the pool sends a `wire_job` containing the external ZANO job. This anchors staleness to the pool's own distribution of the job, not to HeroMiners' notification cadence.

Implementation sketch:

- Add a method to `AuxPowClient`:

```rust
pub async fn touch_job_timestamp(&self, job_id: &str) {
    let mut jra = self.job_received_at.lock().await;
    jra.insert(job_id.to_string(), std::time::Instant::now());
}
```

- Expose it through `MultiAuxPowBridge` (or keep a reference to the active client) and call it in `V3/L1/pool/src/bin/server.rs` whenever `parallel_stream_embedded` is emitted with that external job.

This keeps `job_received_at` current as long as the pool actively distributes the job, and lets it expire naturally when a new job replaces it.

### 5.2 Quick operational workaround

Set `ZION_ZANO_STALE_SECS=120` (or higher) in the pool environment (`/etc/zion/edge-environment.sh`) and restart `zion-edge-pool.service`. This gives the pool a larger tolerance window for silent upstream periods, but may forward more shares that HeroMiners rejects as expired.

### 5.3 Alternative workaround

Set `ZION_ZANO_STALE_SECS=0` to disable local pre-rejection entirely. HeroMiners then decides validity. This eliminates false pre-rejects but may increase upstream reject volume.

---

## 6. Recommendation

1. Implement and deploy **fix 5.1** (refresh timestamp on `wire_job` distribution) because it correctly ties staleness to the job the miner is actually working on.
2. Until the code fix is deployed, monitor the rig. The upstream has resumed sending jobs; ZANO accepted shares are appearing, but the stale-reject rate will remain elevated whenever HeroMiners pauses notifications.
3. After the next SMOS deploy, `external_share_*` logs should show `miner=vega-smos` instead of `miner=local-miner`.

---

## 7. Related prior work

- `REPORT_2026-07-21_ZANO_STALE_PRE_REJECT_CRASH.md` — earlier fix that refreshes `job_received_at` on every `eth_getWork` re-send, but still depends on upstream notifications.
- `MinerP3.0.6/Smos/vega-smos.env` and `wrapper_complete.sh` — SMOS rig configuration.
