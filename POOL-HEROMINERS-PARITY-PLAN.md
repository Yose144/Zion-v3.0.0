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
- **Ops console `/ops/` on pool.zionterranova.com** (2026-10-29, auth_basic
  `.htpasswd-vast` + `X-Ops-Auth` plumbing): vast.ai rigs w/ expandable
  miner detail, agent rigs w/ desired-vs-applied + alert badges, sheet
  assign per-rig/group/bulk, exec queue, group set, rig remove, task/
  results viewer, catalog + bench view, events feed. Internal only.

**Frontend additions since first draft:**
- `/api-docs` — full `/public/v1` route reference + curl examples (WS2.9 ✅)
- Coin luck tile (luck_100/luck_500 aggregates on `/coin/[id]`)

## Gap analysis vs HeroMiners

| HeroMiners feature | Status | Gap |
|---|---|---|
| Coin dropdown nav | ✅ done | — |
| Dashboard widgets (pool/net hashrate, miners, luck) | ~80 % | effort/luck aggregates, nethash per coin |
| Miner dashboard (workers, payments, charts) | ~80 % | per-worker hps history depth, worker table polish |
| Ops/fleet console | ✅ /ops (internal) | agent enrollment, task results done |
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
    **Phase 1 landed (`cc589d926`):** submit path is now probe → validate →
    claim — PoW hash runs unlocked on a per-server `ShareValidator` copy,
    `pool.lock()` only covers dedup probe + atomic claim/credit; the block
    check reuses the submit hash (was a second identical hash under lock).
    PPLNS persist split the same way (`pplns_save_prepare`/`_finish`) —
    window clone + JSON + fsync no longer hold the mutex every 30 s.
    **Phase 2 candidates (documented, staged):** `PplnsEngine` behind its
    own `Mutex` (share credit + payout calc + save detach from `Pool`),
    `share_dedup` → dedicated lock, remaining ~19 request-path locks in
    api.rs → snapshot-served. Careful: `worker_payout_target` reads
    `worker_addresses`/`worker_ext_payouts` — those must move with the
    engine or become `RwLock`.
11. **Per-worker historical hps persistence** — needed for #3/#7 (store
    sampler already exists; add retention + read path). ✅ schema v6
    `miner_history` (miner/worker/ts/hps-json/acc/rej, 60 s cadence, 24 h
    retention) + `/public/v1/miner/{w}/history` + MinerClient/WorkerClient
    charts already live.
12. **Alert coverage parity** — miner alert prefs exist; add reject-rate
    spike alert + block-frequency anomaly into notifications.rs. ✅ done:
    60 s health loop (reject-rate delta ≥ threshold over ≥200 shares +
    last-block age ≥ 6 h, per-signal 30 min cooldown, env-tunable
    `ZION_POOL_ALERT_*`) → TG + block webhook via Notifier.

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

### WS5 — Ops console (internal `/ops/`, HiveOS-parity)
*Done 2026-10-29:* console shell, vast rigs + agent rigs tables, flight
sheet assign (rig/group/bulk), exec queue, group set, rig remove,
task/results viewer, alert badges, catalog+bench, events feed, X-Ops-Auth.
17. **Bench seeding form** — POST /agent/bench from UI → unlock profit dry.
18. **Catalog editor** — add/edit presets in-console (`/agent/catalog`).
19. **Pool-side worker hps join** — map `miner.pool` worker names to
    `/public/v1/miner/{w}` data → live rig hashrate column.
20. **AI-inference tab** — `/api/ai/status` + `/api/inference/*` surface
    (exists in mockup) as an ops section.
21. **Alert routing prefs UI** — TG/webhook status + test-fire button.

## Milestones

- ~~**M1 (this sprint):**~~ partially landed — WS2.9 api-docs ✅, coin luck
  tile ✅, /ops console shell ✅. Remaining: WS1.1 calculator, WS2.6 PPLNS.
- **M2:** WS1.3 miner-page depth + WS2.7 worker history, WS1.2 luck/effort
  strip, WS2.8 status page, WS5.17 bench form.
- **M3:** WS3.10 lock-sharding phase 1 ✅ (`cc589d926`), WS3.11 worker
  history ✅ (pre-existing v6), WS3.12 alert coverage ✅, WS5.18 catalog
  editor ✅ (`0650944f4`). Remaining: phase-2 sharding, WS4.13/14 fleet
  alerts+switch live, WS5.19/20/21.
- **M4:** WS1.5 solo docs, WS4.15/16 OC + adapters, OG/SEO polish, WS5.20/21.

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
- 2026-10-29 incident RESOLVED (mostly): repeated clean `systemctl stop`
  ~15min cadence traced to an EXTERNAL host — SSH key
  `zion-edge-post-wipe-2026-07-29` from `109.81.23.46` (operator PC, 674
  logins/day) + LAN v6. Stale watchdog/deploy loop on an ops machine;
  EDGE `zion-v31-watchdog.timer` (60s) self-heals each stop. OPEN: find
  and kill the source process on the operator workstation/LAN box.
- `/ops/` ingress: EDGE2 pool vhost `location /ops{,-api}/` → auth_basic
  `.htpasswd-vast` + `X-Ops-Auth: 1` header to vastctl serve :8088
  (Authorization stripped upstream — basic creds never reach serve).
