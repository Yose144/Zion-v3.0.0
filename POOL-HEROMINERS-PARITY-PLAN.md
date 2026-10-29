# POOL-HEROMINERS-PARITY-PLAN.md

> **Goal:** bring `pool.zionterranova.com` to feature parity (and beyond) with
> HeroMiners-class pools — same information depth, miner-facing tooling and
> operational polish — on top of the existing ZION V31 pool + fleet stack.
>
> Reference surface: `https://zano.herominers.com` (canonical HeroMiners
> layout: nav dropdowns, dashboard widgets, miner pages, per-coin sites,
> notifications, calculator, luck/effort metrics).
>
> Lifecycle: V31 Mainnet Beta — no consensus/genesis/emission changes here.
> This plan extends `POOL-FLEET-EXPANSION-PLAN.md` (W1–W5 done; B5 MVP done
> 2026-10-29) — entries below assume that plan's completion state.

## Current state (2026-10-29)

**Backend (live on EDGE1):**
- Stratum v1+v3, AuxPoW legs, PPLNS + durable ledger, SOLO port 8446,
  TLS 8445, VarDiff (1000–100k, 15s target)
- Public API `/public/v1/*`: coins, coin stats, blocks, miner profile,
  miners leaderboard, history, account (ZIS) threshold + alert prefs
- Private API `/api/v1/*`: pplns, hashrate-history, revenue-stats,
  profit-switch, auxpow, routing-metrics, HA state export
- notifications.rs: Telegram + SMTP + block webhook (pool-side events)
- Drain fix `8a32fae94` — dedicated-thread shutdown, verified 2.9s live
- Snapshot-thread serves /stats,/metrics,/public/v1/coins lock-free

**Frontend (live on EDGE2 `/var/www/pool`):**
- Pages: `/` `/start` `/blocks` `/payouts` `/stats` `/coin/[id]`
  `/miner/[wallet]` `/account` `/faq` + legal pages; CS/EN i18n
- HeroMiners-style nav (coin + ecosystem dropdowns), market-unified
  engine (CSS hamburger, shared `rasta-nav.css`, `rasta-lang-switch`)
- Live stat chips, hashrate chart, per-coin tables, multi-chain hero

**Fleet CP (vastctl serve on zionserver):**
- Flight sheets, per-rig secrets, offline alerts, watchdog
- B5 alerts: miner_down / gpu_temp / hashrate_drop (same-sheet baseline)
- Profit-switch MVP: bench table + autopilot sheets, dry/apply modes

## Gap analysis vs HeroMiners

| HeroMiners feature | Status | Gap |
|---|---|---|
| Coin dropdown nav | ✅ done | — |
| Dashboard widgets (pool/net hashrate, miners, luck) | ~80 % | effort/luck aggregates, nethash per coin |
| Miner dashboard (workers, payments, charts) | ~80 % | per-worker hps history depth, worker table polish |
| Worker offline alerts | ✅ account/alert | surface it better in UI |
| Profit calculator widget | ❌ | public est-earnings endpoint + UI widget |
| Blocks page w/ luck+maturity | ✅ done | pool avg-effort widget |
| Payments page | ✅ done | — |
| PPLNS scheme docs/transparency | ~50 % | public window stats + explainer section |
| Miner config per coin (multi-software) | ~60 % | per-coin config cards (SRB/XMRig/zion-miner) |
| SOLO mining docs/port | backend ✅ | UI/docs section |
| Telegram/Discord block alerts | ✅ webhook infra | per-wallet TG deep-link subscribe UX |
| Languages | CS/EN | — |
| Public API | ✅ rich | public API docs page (exceeds HeroMiners) |
| Per-coin subdomain-style pages | `/coin/[id]` ✅ | OG/SEO per coin |
| Uptime/status transparency | Grafana internal | public status page (99.9 % goal metric) |

## Work streams

### WS1 — Miner-facing depth (frontend)
1. **Profit calculator widget** — input hashrate → est. coin/day + USD/day
   per selected coin. Backend: `GET /public/v1/estimate?coin=X&hps=N`
   backed by `CoinProfile::estimate_profit` (already used by profit-switch).
   Placement: homepage card + per-coin page.
2. **Luck & effort widgets** — current effort (shares since last block /
   expected), 20-block avg luck strip on home + /stats.
3. **Miner page upgrades** — per-worker hashrate history chart (24h/7d),
   worker cards with last-share age, reject rate, payout ETA per worker.
4. **Per-coin config cards** — `/coin/[id]` gets copy-ready configs:
   `srbminer`, `xmrig`, `zion-miner` + pool URL/TLS/SOLO rows + wallet
   placeholder (extends /start wizard patterns).
5. **SOLO mining section** — docs + stratum line for port 8446.

### WS2 — Transparency & trust (backend + frontend)
6. **Public PPLNS stats** — `GET /public/v1/pplns` (window size, shares in
   window, miner count, top-share %) + explainer block on /payouts.
7. **Public worker history endpoint** — `GET /public/v1/miner/{id}/history`
   (bucketed hps series; extend existing miner profile storage).
8. **Public status page** — uptime %, stratum reachability, last-block age,
   payout freshness (feed from Prometheus-style metrics already exported).
9. **API docs page** — `/api-docs` listing `/public/v1/*` routes, params,
   example curls (static, generated from a single route table).

### WS3 — Operations hardening (backend)
10. **`pool.lock()` starvation root-cause** — stratum submit path holds the
    global pool mutex synchronously on tokio workers (convoy → wedge +
    delayed drains). Options: shard state per coin/stream, or move submit
    accounting off the hot mutex; keep snapshot-API immune (already done).
11. **Per-worker historical hps persistence** — needed for #3/#7 (store
    sampler already exists; add retention + read path).
12. **Alert coverage parity** — miner alert prefs exist; add reject-rate
    spike alert + block-frequency anomaly into notifications.rs.

### WS4 — Fleet / HiveOS-class (vastctl)
13. **Profit-switch apply rollout** — bench table seeding (ops), dry→apply
    promotion per rig group; pool `/api/v1/profit-switch` as live revenue
    feed once `VASTCTL_POOL_API_KEY` is provisioned.
14. **TG/webhook fanout** — set `VASTCTL_TG_BOT_TOKEN`/`CHAT_ID` or
    `VASTCTL_ALERT_WEBHOOK` in vastctl-serve drop-in.
15. **W6 OC control** — per-GPU clocks/fan/power via agent task op
    (nvidia-smi allowlist extension, sheet `oc` block already reserved).
16. **NiceHash/SMOS adapters** — v1 stratum compat exists; document
    extranonce/diff quirks + SMOS agent packaging.

## Milestones

- **M1 (this sprint):** WS1.1 calculator (backend est endpoint + widget),
  WS1.4 per-coin config cards, WS2.9 API docs page, WS2.6 public PPLNS.
- **M2:** WS1.3 miner-page depth + WS2.7 worker history, WS1.2 luck/effort
  strip, WS2.8 status page.
- **M3:** WS3.10 lock-sharding (biggest resilience item), WS3.12 alert
  coverage, WS4.13/14 fleet alerts+switch live.
- **M4:** WS1.5 solo docs, WS4.15/16 OC + adapters, OG/SEO polish.

## Acceptance criteria

- Every HeroMiners-visible widget has a ZION equivalent or better.
- `/public/v1` additions are lock-free (snapshot/RwLock path — no new
  `pool.lock()` consumers on the request path).
- UI builds clean (`npm run build`), deploys via `deploy-pool.sh`, smoke
  checks: `/`, new pages, new API routes → 200.
- Rust changes: `cargo test`/`check` green; EDGE deploy via clean worktree
  pattern (`/opt/zion-rel/build`), drain-verified restart.
- No unrelated dirty-worktree files in commits (selective staging).

## Ops notes

- EDGE1 pool API `127.0.0.1:8080`; stratum 8444/8445/8446; service
  `zion-v31-pool.service` (drain-verified 2026-10-29).
- EDGE2 ingress `/var/www/pool` via `apps/pool-ui/deploy/deploy-pool.sh`.
- Fleet CP on zionserver: `vastctl-serve` (alerts) + `vastctl-daemon`
  (`VASTCTL_FLEET_CHECKS=0`).
- 2026-10-29 incident: pool stopped cleanly 13:30 and left inactive ~15min
  (no auto-restart) — `Restart=always` gap or intentional ops stop;
  watchdog coverage for "service inactive" worth adding (WS3).
