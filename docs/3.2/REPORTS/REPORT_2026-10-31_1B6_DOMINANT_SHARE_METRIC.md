# 1.B6 — Hashrate decentralization: dominant-miner share metric + alert (IA-19)

**Date:** 2026-10-31 · **Scope:** `V31/L1/pool/src/{block_tracker,api,notifications,main}.rs` · **Status:** code + tests done, deploy pending next pool release

## Background

IA-19 / G8 run #2 root cause: a **single-miner dependency** — one worker
produced most of the chain's blocks and its loss stalled the chain. The
operational gap was that nothing *measured* or *alerted* on block-authorship
concentration; it was discovered only after the stall.

## Implementation

**Metric — `BlockTracker::dominant_miner_share(window)`** (`block_tracker.rs`):
over the last `window` found blocks, counts blocks per `miner_id` and returns
the largest share `{miner_id, blocks, total, share_pct}`. Tie-break prefers the
miner whose newest block is most recent — a *growing* concentration is the
operational concern. `BlockTrackerStats` exposes it as `dominant_share_100`
(last-100 window).

**Public API** (`api.rs` `block_tracker_json`):
`dominant_share_100: {miner: masked, blocks, total, share_pct}` — wallet masked
with the same `mask_wallet` helper used by the public leaderboard. Served on
every stats endpoint carrying `blocks` (`/public/v1/stats`, coin stats).

**Alert — health loop** (`main.rs`): the existing reject-spike/block-silence
loop gains a third check, same env-tunable + cooldown discipline:

| Env var | Default |
|---|---|
| `ZION_POOL_ALERT_DOMINANT_PCT` | `50.0` (% of last-100 blocks) |
| `ZION_POOL_ALERT_DOMINANT_MIN_BLOCKS` | `20` (min sample — no false alarm on a fresh boot/quiet period) |
| `ZION_POOL_ALERT_COOLDOWN_SECS` | `1800` (shared cooldown bucket `dominant_share`) |

Fires `Notifier::notify_dominant_share` (`notifications.rs`): `warn!` log +
Telegram `⚠️ Hashrate Concentration` + `dominant_share` webhook event. Full
miner id goes to the operator alert; only the masked id is public.

**Attribution note:** the metric counts *block authorship* by `miner_id` as
recorded by `record_block_accepted` — i.e. who submitted the winning share.
This is the correct IA-19 signal: chain liveness depends on who actually wins
blocks, not on nominal hashrate share.

## Tests (6 new, all green)

`dominant_share_none_when_empty` · `dominant_share_single_miner_is_100pct` ·
`dominant_share_picks_largest_miner` (70/30) ·
`dominant_share_window_excludes_older_blocks` ·
`dominant_share_tie_prefers_most_recent` · `dominant_share_in_stats`

- `cargo test -p zion-pool --lib block_tracker` → **14/14**
- `cargo test -p zion-pool --lib` → **435/436** — sole failure
  `pearl_stratum_end_to_end` = known pre-existing environment flake
  (`mining.notify Elapsed` timeout; fails on clean HEAD, verified earlier)

## Deployment note

Source-level; live with the next pool release. Thresholds are operator-tunable
via env without rebuild; alerting is a no-op when Telegram/webhook channels are
unconfigured (warn! still logged).
