# Pool HA — EDGE2 warm standby (A4.2)

**Model: manually-operated warm standby, alert-only watchdog.**
There is intentionally **no automatic failover**. WebGlobe DNS changes
(`stratum.`/`pool.` → EDGE IP) are manual anyway, and an automatic promoter
could turn a tunnel/network blip into a split-brain (two pools crediting
the same miners against different PPLNS state — unrecoverable divergence).

| Role | Host | State |
|---|---|---|
| **ACTIVE** | EDGE `62.171.141.136` | live pool — stratum :8444/:8445/:8446, API :8080 |
| **STANDBY** | EDGE2 `207.180.217.100` | warm — receives state continuously, binary + unit installed, **never running** until an operator promotes it |

## What is replicated

| State | Export endpoint (EDGE, API-key auth) | Sync cadence | Standby file |
|---|---|---|---|
| PPLNS engine snapshot | `GET /api/v1/state/pplns` | every 60 s | `/opt/zion/data/v31-standby/pool-pplns.json` |
| Payout idempotency ledger | `GET /api/v1/state/payouts` | every 60 s | `/opt/zion/data/v31-standby/pool-pplns.json.payouts.json` |
| Share/blocks/miner-history SQLite | `GET /api/v1/state/db` (`VACUUM INTO`) | hourly | `/opt/zion/data/v31-standby/pool-store.db` |

All pulls go through `zion-edge-tunnel` (`127.0.0.1:8080` on EDGE2 →
`127.0.0.1:8080` on EDGE). The API key lives only in
`/etc/zion/pool-standby.env` (root 600) — never in argv or the journal.

**Divergence window:** after promotion, shares accepted in the last ~60 s
are not in the standby PPLNS snapshot — miners lose at most one minute of
window credit. The payout ledger and dedup DB are replicated so
**no double-payout and no dedup-reset** can occur. That is the
correctness-critical part; the share window is loss-tolerant by design.

## Components (installed by `infra/tools/pool-ha/install-edge2.sh`)

| Unit | Type | Purpose |
|---|---|---|
| `zion-pool-standby-sync.timer` | 60 s | JSON state pull (pplns + payouts) |
| `zion-pool-standby-dbsync.timer` | 1 h | DB snapshot pull (~130 MB, `VACUUM INTO`) |
| `zion-pool-ha-watchdog.timer` | 30 s | probes API-via-tunnel + public stratum; after 3 consecutive fails → **one** Telegram alert. **Never starts anything.** |
| `zion-pool-standby.service` | manual | warm-standby pool; `ConditionPathExists=…/ACTIVATED` refuses to start without the operator flag |

`pool-standby-sync.sh` validates before install (JSON parse, SQLite magic
+ `PRAGMA quick_check`), keeps last-good files on failure, and drops
`.sync-state/*.stamp` markers (ts/sha256/bytes) — check these before
promoting.

## Failover (EDGE → EDGE2) — operator procedure

1. **Confirm the outage is real** — watchdog alert + manual check:
   `ssh zion-edge2 'curl -s -m 10 http://127.0.0.1:8080/health'`
   and `nc -zv 62.171.141.136 8444`. If only the tunnel died, fix the
   tunnel — do NOT promote.
2. **Isolate EDGE** — if reachable: `systemctl stop zion-v31-pool`.
   If unreachable entirely, accept the risk: miners cannot connect to it
   anyway; on recovery it MUST NOT come back until failback is decided.
3. **Check standby freshness** —
   `cat /opt/zion/data/v31-standby/.sync-state/*.stamp` (expect pplns/payouts
   ≤ ~2 min old, db ≤ ~1 h). Optionally `pool-standby-sync.sh json && … db`
   for a final pull if EDGE API still answers.
4. **Verify env** — `/etc/zion/pool-standby.env` mirrors the EDGE pool env
   (miner address, auxpow routes, ZIS, pearl, telegram). The unit already
   pins `ZION_POOL_API_BIND=127.0.0.1:8090` and `ZION_L1_RPC_URL` → EDGE2
   primary node `:9445`.
5. **Promote** —
   `touch /opt/zion/data/v31-standby/ACTIVATED && systemctl start zion-pool-standby`
   Verify: `journalctl -u zion-pool-standby -f` (dedup restore, stratum
   binds :8444/:8445/:8446, API :8090).
6. **Repoint ingress** —
   a. `pool.zionterranova.com` nginx vhost (EDGE2) → upstream
      `127.0.0.1:8090` instead of the tunnel `:8080`. `nginx -t && reload`.
   b. **WebGlobe DNS**: `stratum.zionterranova.com` (and `pool.` A record)
      → `207.180.217.100`. Miners reconnect as records propagate.
7. **Freeze the EDGE return path** — leave `zion-v31-pool` stopped on EDGE
   (or masked) until failback is planned.

## Failback (EDGE2 → EDGE)

Same shape, reversed: stop standby (`systemctl stop zion-pool-standby`,
`rm …/ACTIVATED`), copy the *live* standby state files **back** to EDGE
(`/opt/zion/data/v31/pool-pplns.json`, `….payouts.json`, `pool-store.db`
— scp via the tunnel host or `ssh -J`), start `zion-v31-pool`, verify,
flip nginx upstream + DNS back. Expect stratum sessions to drop again at
the DNS cutover — miners reconnect.

## Design notes / non-goals

- **Why not share-forward replication?** `ShareRelayConfig` forwards
  shares fire-and-forget — a standby can't reconstruct the exact PPLNS
  window (ordering/eviction) from it. State-file replication is exact.
- **Why `VACUUM INTO`?** Copies `pool-store.db` byte-consistently under
  WAL while writers keep running; no lock held during the ~130 MB export.
- **DB hourly, JSON minutely** — the DB is audit/history/dedup state
  (hourly staleness acceptable); PPLNS + payout ledger change every
  block/payout cycle (minutely required).
- **No auto-promote** — see header. The watchdog *only* alerts.
- **Standby never writes upstream** — while EDGE is authoritative, the
  standby holds state read-only on disk; it only becomes a writer the
  moment an operator starts it with the ACTIVATED flag.
