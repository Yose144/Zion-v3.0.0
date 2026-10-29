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

---

## Executed: Option A — promote node2 tip (2026-10-29 ~12:11–13:08 UTC)

### Before

| Node | Height | Tip |
|---|---:|---|
| Primary EDGE2 `:9445` | 100428 | `78928d2ba9585753…` (stalled ~03:56 CET) |
| Node2 EDGE `:9446` | ~100992+ | live fork (pool tip-affinity) |
| Node3 EDGE `:9447` | ~100446 | mid / lagging |

### Snapshot (final, used for restore)

After an earlier snap at h=100992 was overtaken (watchdog revived pool mid-heal), mining was **masked**, then:

- Path: EDGE `/root/node2-snap-20261029-124552.db` (also copied to EDGE2 `/root/`)
- sha256: `13b47a577677fc36a43e9f4db2bebec2f589ca85fed5b048d8274e4384f2bfdb`
- Height / tip: **101009** / `2a1a1eaf13f1b7cef0325260215600465196d66b021720a89155fa20ab2a1028`

Forkbaks retained (keep ≥30 min post-heal):

- EDGE2: `/root/node.db.forkbak-final-20261029-125706` (+ earlier `…-122251`, `…-resnap-…`)
- EDGE: `/root/node3.db.forkbak-final-20261029-125706` (+ earlier)

### Restore

1. Stopped pool + miners; masked units (watchdog was restarting pool).
2. EDGE2 primary: stop → forkbak `node.db` → install snap → `DELETE` `native_utxo_cache` + `native_utxo_cache_state` → start → tip match.
3. EDGE node3: same snap + cache clear → tip match.
4. Unmasked/restored systemd units from `/opt/zion/V31/deploy/systemd/` + fallback bak; started pool/miners/watchdog.

### After (13:08 UTC)

| Node | Height | Tip |
|---|---:|---|
| Primary `:9445` | **101016** | `09a91bbb1dc989a93893bc71ec2335049eddd875d441c3174d89c6dce1467c11` |
| Node2 `:9446` | **101016** | same |
| Node3 `:9447` | **101016** | same |

- P2P `rejected` count on primary (10 min window): **0**
- Tips advancing together with ≤1 block follower lag; node2 performed a shallow reorg onto primary when a brief multi-endpoint race appeared.

### Pool fix applied during reunite

Deploy unit `ExecStart` embedded multi-RPC  
`9445,9446,9447` which **overrides** `ZION_L1_RPC_URL` env → tip-affinity mined competing tips on node2 vs primary right after DB heal.

**Mitigation (live):** drop-in  
`/etc/systemd/system/zion-v31-pool.service.d/zz-l1-primary-only.conf` now clears `ExecStart` and pins  
`--l1-rpc-url http://127.0.0.1:9445` (EDGE → EDGE2 primary via chain-tunnel).  
Env file `/etc/zion/zion-pool-l1-primary.env` = same URL.

### Follow-up (not this window)

1. **RCA:** why primary stopped accepting blocks at ~03:56 CET (h=100428) — journal/disk/P2P/ban/UTXO.
2. Keep forkbaks until tips stable ≥30 min, then optional cleanup.
3. Consider making deploy `zion-v31-pool.service` primary-only by default so env/drop-in cannot be overridden by multi-URL `ExecStart`.
4. EDGE IPv4 `:22`/`:2222` intermittently `Connection refused` (fail2ban); ops used `zion-v6` (IPv6 `:2222`) during heal.

## Related

Pool QTU telemetry work paused: `REPORT_2026-10-29_POOL_QTU_DUPLICATE_TELEMETRY.md`.
