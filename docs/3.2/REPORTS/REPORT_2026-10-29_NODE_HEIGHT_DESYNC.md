# Report — L1 height desync on dashboard (2026-10-29 ~13:05 CET)

**Dashboard symptom:** main node height ≠ node2/node3 — confirmed **real chain split**, not a UI bug.

## Live tips (RPC)

| Node | Host / port | Height | Tip (16 hex) | Notes |
|---|---|---:|---|---|
| Primary | EDGE2 `:9445` (also EDGE tunnel) | **100428** | `78928d2ba9585753…` | **Stuck since ~03:56 CET** — last `accepted block` in journal |
| Node2 | EDGE `:9446` | **~100990+** and climbing | diverges | Pool tip-affinity submits here |
| Node3 | EDGE `:9447` | **~100446** | diverges | Mid fork / lagging node2 |

Primary↔EDGE P2P: mutual `P2P peer … rejected` every ~30 s (ban/fork isolation).

## Mechanism

1. Primary stopped advancing at h=100428 (~9 h).
2. Pool template feed order includes `127.0.0.1:9446` first; tip-affinity selects endpoint whose tip matches `prev_hash` → **node2**.
3. Pool keeps `submitBlock` → node2 (`accepted:true`); node2 fork lengthens; primary cannot follow (gap ≫ shallow reorg cap).

`getBlockTemplate` on primary still answers (header `previous_hash` = stuck tip) — node is alive but not extending.

## Heal options (needs 👤 choice — destructive)

- **A — Promote node2 as canonical:** sqlite snapshot from node2 → restore EDGE2 primary (+ node3), clear P2P bans, realign pool templates. Keeps ~560 mined blocks on the live fork.
- **B — Force primary tip:** wipe/resync node2+node3 from EDGE2 tip 100428. **Abandons** the node2 extension (payout/UTXO impact audit first).
- **C — RCA primary stall first** (why no accept since 03:56) then choose A/B.

Do **not** leave pool mining on node2 while calling EDGE2 “source of truth” — dashboard will keep lying / split will worsen.

## Related

Pool QTU telemetry work paused: `REPORT_2026-10-29_POOL_QTU_DUPLICATE_TELEMETRY.md`.
