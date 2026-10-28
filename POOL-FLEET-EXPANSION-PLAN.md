# Pool + Fleet Expansion Plan — pro-pool parity & HiveOS-class rig management

> **Status:** draft ke schválení (2026-10-26)
> **Scope:** `V31/L1/pool` (stratum/PPLNS/auxpow), `apps/pool-ui` (veřejný pool web),
> `infra/tools/vast/vastctl.py` + nový fleet stack, `apps/IntroPage` (`/vast-rigs/` panel).
>
> **Cíl:** náš nativní pool na úroveň profesionálních poolů (Luckypool/Nanopool/HiveOn)
> a správa mining rigů na úroveň HiveOS / SimpleMining — jednotný agent + control plane
> + panel pro multi-mining fleet (vast.ai, SMOS, bare-metal).

---

## 0. Aktuální stav (co už existuje — nestavíme znovu)

**Pool (`V31/L1/pool`):**
- Stratum v1 (`:8444` plain, `:8445` TLS) + v3 protokol (Hello/session, plain+TLS)
- AuxPoW merged-mining legs: QTU, PRL, VRSC, ZANO, EVR, KRX (+ `profit_switcher.rs`
  s hysteresí — už existuje!)
- PPLNS okno + durable payout ledger (idempotence), payout confirmation sweep
- Telemetry: per-worker `hashrate_live`/`hashrate_1h` (ZION diff škála), Prometheus
  `/metrics`, per-coin routing metrics
- Veřejné API: `/public/v1/{blocks,coins,history,payouts,miner/{coin}/{wallet}}`
- Admin/API: `/api/v1/{stats,miners,blocks,payouts,pplns,hashrate-history,
  routing-metrics,revenue-*,profit-switch}`, `/admin/*` (ops, coin-revenue,
  external-payouts/ack)
- `notifications.rs` — Telegram bot, SMTP, block webhook, OASIS hook (best-effort)
- Wave-7 security: share dedup, session binding, XFF rate-limit, auth throttle,
  serde JSON (audit `POOL_AUDIT_2026-10-26`)

**Pool web (`apps/pool-ui`, pool.zionterranova.com):**
- Next.js export: `/miner/{coin}/{wallet}` dashboard, `/stats`, `/blocks`,
  `/payouts`, `/account` (ZIS), `/start`, `/faq`, i18n cs/en

**Fleet (`vastctl.py`, 2200+ řádků):**
- vast.ai: search/rent/destroy, SSH probe (GPU, minery, tmux, xmrig API, net check)
- launch/watchdog desired-state (sessions+proc expectations, backoff)
- autodeploy xmrig, SMOS API (list/pause/resume/reboot/console),
  ext pool stats (LuckyPool qtu/prl/nock, Nanopool xmr)
- status.json pipeline → `/vast-rigs/` dashboard (robustní od 26.10: section
  isolation, fresh/errors/daemon, 2-source sync)

---

## Track A — Pool → pro-pool parity

### A1 — Telemetrie & veřejné statistiky (foundation)
| # | Item | Poznámka |
|---|---|---|
| A1.1 | **Per-worker hashrate pro externí coiny** | Telemetrie estimuje jen ZION-diff škálu; PRL/QTU workery hlásí `hps=0` (workaround v `_attach_rig_hashrate`). Fix: estimator proti *upstream* difficulty dané legy — `telemetry.rs` per-stream. |
| A1.2 | Share-quality per worker | stale/invalid % per worker + per session (už částečně v streams v/i — přidat windowed rate + reason buckets) |
| A1.3 | **Persistovaná timeseries** | `/public/v1/history` existuje — rozšířit: pool hashrate 1m/1h/24h, per-wallet hashrate history (ring buffer + periodic flush vedle PPLNS state) |
| A1.4 | Luck / effort | per-block-round: `shares_accepted / shares_expected` → blocks page "luck %" + pool-effort KPI (pro-pool standard) |
| A1.5 | Estimated earnings | per wallet/day z PPLNS window váhy × posledních N bloků — `/public/v1/miner/...` += `est_daily` |

### A2 — Miner UX parity
| # | Item |
|---|---|
| A2.1 | Worker-level view (ne jen wallet): `/miner/{coin}/{wallet}/{worker}` — hashrate graf, last-seen, share quality |
| A2.2 | **Offline worker alerts** — `notifications.rs` už má Telegram/SMTP skeleton → per-worker subscription přes ZIS account (worker dead >N min → alert) |
| A2.3 | Payout threshold per wallet (opt-in config přes ZIS-authed POST `/account`) — pro pooly to mají, my máme fixní min batch |
| A2.4 | Static diff + suggested-diff v `/start` config generatoru (d=… v password/worker sufixu — zdokumentovat existující vardiff) |
| A2.5 | `/start` wizard: coin → miner (zion-miner/SRB/xmrig) → OS → generovaný cmdline + config file ke stažení |
| A2.6 | Blocks page: luck %, orphan status, maturity countdown (data v `block_tracker.rs` existují — doplnit UI) |

### A3 — Payouts & důvěra
| # | Item |
|---|---|
| A3.1 | Payout lifecycle UI: queued → sent → confirmed (+tx link) — ledger + sweep data už jsou |
| A3.2 | Pending estimate: accrued PPLNS hodnota per wallet ("máš ~X ZION nevyplacených, payout za ~Y") |
| A3.3 | ✅ Payout scheme: PPLNS zůstává + **SOLO port live :8446** (`ZION_POOL_SOLO_PORT` opt-in, winner-take-all 89% slice); PPS+ odložit (treasury) — detail v Status |
| A3.4 | ✅ Fee transparence — `fees` block v `/public/v1/coins` + stats-page split bar + FAQ (fee + SOLO :8446) — detail v Status |

### A4 — Provozní odolnost (pro-pool = 99.9 %)
| # | Item |
|---|---|
| A4.1 | **Dedup persistence** — audit residual: in-memory share dedup umírá s restartem → replay okno. Fix: bounded on-disk dedup (append log + periodic trim vedle PPLNS state) nebo aspoň per-job watermark persist |
| A4.2 | ✅ **HA stratum — warm standby EDGE2 live** (2026-10-27): auth `/api/v1/state/{pplns,payouts,db}` export (db přes `VACUUM INTO`); EDGE2 sync timery (JSON 60 s / DB 1 h přes edge-tunnel), watchdog 30 s → Telegram **alert-only**; standby unit gated `ConditionPathExists=…/ACTIVATED` (žádný auto-promote — anti split-brain); failover/failback = manuální postup → `docs/3.2/POOL-HA-STANDBY.md` |
| A4.3 | Graceful restart: drain mode (stop accepting new sessions, flush PPLNS persist, exit) — deploy bez ztráty okna |
| A4.4 | Job-freshness alerting: per-coin `job_age_ms` > threshold → Notifier (Telegram) — data existují v `/stats` |
| A4.5 | Prometheus alert rules: pool down, accept-rate drop, upstream leg dead, payout backlog — `rules/zion-pool.rules.yml` |
| A4.6 | DoS layers doc: session/IP limity existují — doplnit TCP backlog + conntrack tuning do runbooku |

### A5 — Ekosystém / integrace
| # | Item |
|---|---|
| A5.1 | **HiveOS flight sheet** — `.json` template pro SRBMiner/zion-miner → naši pool URL; SMOS "custom miner" package návod. Tím se staneme viditelní v HiveOS/SMOS katalozích |
| A5.2 | Veřejné API docs (`/api-docs` na pool-ui): endpointy, rate limity, příklady |
| A5.3 | Miner-side config: `ZION_STREAM`/duty flags dokumentované + stable miner releases (`/zion-miner/` downloads — existuje) |
| A5.4 | Nicehash compatibility note (password field, diff floor) — dokumentace, případně `extranonce` tweak |

---

## Track B — Fleet OS (HiveOS/SMOS class)

**Architektura:** přejít z SSH-push (vastctl probe) na **agent-pull** —
rig volá control plane ven (funguje i za NAT, bez SSH), CP drží desired-state.

### B1 — `zion-rig-agent` (klient na rigu)
- **v1: single-file Python** (rychlá iterace, reuse probe logiky z vastctl.py); v2 případně Rust binary v `V31/` workspace
- **Enroll:** one-time token → `rig_id` + per-rig secret (heartbeat HMAC)
- **Heartbeat (15–30 s):** GPU util/temp/power/fan/clock, miner procesy + hashrate/algo/acc-rej, sessions, uptime, net egress check, OC state
- **Desired-state apply:** flight sheet {miner, verze, coin, pool URL, wallet, args, OC profil} → stáhne miner package (prebuilt tarball z našeho release endpointu / upstream mirror), render configu, launch pod `tmux` nebo vlastní supervisor loop (vast.ai nemá systemd!)
- **Lokální watchdog:** proc dead → restart (backoff); hashrate floor breach → restart miner; GPU error → reboot request
- **Self-update:** CP pošle novou verzi → atomická výměna + rollback na failure
- **Command exec:** fronta příkazů z CP (restart miner / reboot / run script whitelist / fetch logs) — scoped, auditované, žádný arbitrary shell default

### B2 — Control plane `zion-fleet` (služba na Edgi)
- Nový service `127.0.0.1:8099` (+ tunel na EDGE2 stejně jako vast-ops dnes), **SQLite v1** → Postgres později
- Tabulky: `rigs` (id, secret, group, labels, last_seen), `desired` (flight-sheet per rig/group, verze), `metrics` (timeseries heartbeats), `commands` (queue+audit), `alerts`, `events`
- API: `POST /enroll`, `POST /heartbeat`, `GET /config`, `GET /commands`, `POST /report`, ops `GET/POST /api/rigs|groups|sheets|alerts|metrics`
- **Auto-discovery:** vast.ai `show instances` sync → neregistrované instance = bootstrap přes stávající SSH cestu (vastctl zůstává bootstrapper)
- **SMOS zůstává** read+action přes jejich API (agent nenasazujeme — jejich OS drží svého klienta); PC/`desktop-agent` zvážit jako druhý agent adapter později

### B3 — Flight sheets & miner catalog
- Sheet = `{miner, version, coin, pool, wallet, extra_args, oc_profile, duty}`
- Skupiny rigů (farmy): `vast-gpu`, `smos`, `pc`, `edge` — sheet na group nebo per-rig override
- Miner catalog: zion-miner (naše release), SRBMiner-MULTI, xmrig, (+lolMiner/T-Rex až bude potřeba) — verze + sha256 + URL registry

### B4 — OC & hardware control (v2)
- `oc_profile`: core/mem offset, power limit, fan curve per GPU model
- nvidia-smi `-lgc/-lmc/-pl`, rocm-smi pro AMD; safe-range clamps; watchdog revert při crash
- vast.ai: pozor — někteří hostitelé OC zakazují/limitují → profil `none|safe` default

### B5 — Alerting & auto-profit-switch
- Rules: rig offline >5 min, hashrate drop >20 % za 15 min, GPU temp >limit, share reject spike, payout missing
- Notify: reuse `notifications.rs` pattern → Telegram + SMTP + webhook (CP modul)
- **Auto-profit-switch per rig** (killer feature, co HiveOS nemá zdarma):
  benchmark cache per (gpu_model × algo), live revenue feed z pool `/api/v1/profit-switch`
  + vast.ai cena/h → CP vybere nejvýnosnější coin/algo a pushne sheet.
  `profit_switcher.rs` logika se přesune/zrcadlí na rig-level

### B6 — Panel (rozšíření `/vast-rigs/`)
- Rig detail: live grafy GPU/mineru, log tail, command history
- Bulk ops: assign sheet to group, restart miner across fleet, update agent
- Alerts stránka + ack; earnings per rig (pool data × sheet coin)
- Auth: htpasswd v1 (jako /vast-ops), ZIS v2

### B7 — Provisioning & migrace
- vast.ai: rent → SSH bootstrap nainstaluje agenta + enroll token (vastctl = bootstrapper, ne monitor) → pak agent řídí
- SMOS: beze změny (API), PC: `desktop-agent` adapter později
- Migrace: tmux-launched rigy → agent převezme (detekce existujících procesů, adopt místo kill)

---

## Fázování (doporučené pořadí)

| Wave | Obsah | Závislosti |
|---|---|---|
| **W1 — Pool data depth** | A1.1 ext-coin hashrate, A1.2 share quality, A1.4 luck, A1.5 est earnings, A3.2 pending estimate | — (malé, vysoký dopad na "pro" vjem) |
| **W2 — Pool ops hardening** | A4.1 dedup persist, A4.3 drain restart, A4.4/A4.5 alerting, A3.1 payout lifecycle UI | W1 |
| **W3 — Fleet agent MVP** | B1 agent (enroll+heartbeat+desired-state+watchdog), B2 CP core (rigs/desired/commands, SQLite), B6 basic panel wiring | — (paralelně s W1/W2 možné) |
| **W4 — Flight sheets** | B3 sheets+groups+catalog, B6 bulk ops, B7 vast bootstrap přes agenta | W3 |
| **W5 — Miner UX polish** | A2.1–A2.6 (worker view, alerts, thresholds, /start wizard, luck UI), A5.1 flight sheet exports | W1 |
| **W6 — HA & scale** | A4.2 standby stratum, A4.6, B4 OC, B5 alerting+profit-switch, A5.2 API docs | W3, W4 |
| **W7 — Ecosystem** | A5.3/A5.4, B7 SMOS/PC adapters, public launch materials | W5, W6 |

## Rizika & poznámky

- **Dedup persist (A4.1)** je audit residual — prioritizovat v rámci W2 i kdyby se W3 měnilo.
- **Active-passive stratum**: nikdy 2 aktivní instance proti jednomu PPLNS backendu (replay + double-credit). Failover jen DNS/standby.
- **Agent exec surface**: whitelist příkazů + HMAC + audit — CP kompromitace nesmí znamenat fleet RCE.
- **vast.ai ToS/OC**: OC profily konzervativní; ephemeral rigy = agent nesmí držet state (vše v CP).
- **ZIS vs htpasswd**: ops plocha zůstává htpasswd dokud ZIS nebude mít ops role.
- **PPS+**: nechat mimo scope dokud nebude treasury politika — PPLNS + SOLO pokrývá 95 % poptávky.

## Rozhodnutí (2026-10-26, operátor)

- **Agent:** Python single-file v1 (reuse vastctl probe logiky; Rust binary až dozraje)
- **Control plane:** rozšíření `vastctl serve` o fleet API — žádný nový stack
- **Payouts:** PPLNS zůstává default schéma; **A3.3 SOLO port implementován jako opt-in** (`ZION_POOL_SOLO_PORT`, live :8446) — předchozí "žádný SOLO" rozhodnutí přehlasováno explicitním úkolem A3.3; PPS+ nadále odloženo (treasury politika)
- **Scope:** implementovat všechny vlny W1–W7 postupně

## Status

| Item | Stav |
|---|---|
| A1.1 ext-coin hashrate | ✅ `dde4f5a34` + deployed — target-derived `hps_live`/`hps_1h` v `/miners` + `/public/v1/coins/{c}/stats` |
| A1.2 share-quality | ✅ `ad8ab5895` + `0796497e2` — per-stream `accept_rate` + `reject_reasons` buckety (duplicate/low_difficulty/stale/unauthorized/malformed/other) na všech submit cestách (v1, v3-plain, v3-TLS, QTU, PRL, v3-ext); fix: TLS + QTU upstream-error cesty teď vůbec počítají invalid_shares |
| A1.4 luck / effort | ✅ `ad8ab5895` — shared `BlockTracker` (byl fragmentovaný per-listener), `blocks{luck_100,luck_500,found,confirmed,orphaned,pending}` v `/stats` + zion coin-stats; luck=0 dokud pool nenajde blok (in-memory) |
| A1.5 est. earnings | ✅ `1e992a9cf` + deployed — `window_share`, `est_daily` (empirický 24h payout rate), `est_per_block` (zion subsidy) v `/public/v1/miner/...`; bonus: shared `current_height` across listeners (ext credit height-0 bug) |
| A1.3 history depth | ✅ `fcbf2aec0` + deployed — schema v6: `history.hashrate_by_coin` (per-coin pool hps série) + `miner_history` tabulka (per-worker `{coin: hps}` timeseries, 60s cadence, 24h retence); nová route `/public/v1/miner/{coin}/{wallet}/history` agreguje všechny workery/login vazby walletu; `/public/v1/history` samples nesou `hashrate_by_coin` (zion = `hashrate` field) |
| Edge drift (bonus fix) | ✅ `1e992a9cf` deploy syncnul 6 divergentních souborů — Edge teď nese i `e9e0c5066` durable outbox, `4108a52d0` fail-closed payout proofs, `f0da65bb0` revenue journal (dřív na Edge chyběly) |
| A4.1 dedup persistence | ✅ `02e483e48` + deployed — schema v7 `share_dedup (bucket, tag, ts)`; marky se zrcadlí při každém novém claimu, bucket rows mažou při FIFO evict, per-write age prune (4h retence); `attach_dedup_store` restore před startem listenerů (live-ověřeno `restored=39` po kontrolovaném restartu); write/restore failure = fail-open na live session (in-memory mark je autoritativní) — replay okno na `ext:` job idách zavřené |
| A4.3 graceful drain | ✅ `721733999` + `99ac09943` + deployed — SIGTERM/SIGINT → watch broadcast zavře všechny accept loopy (primary/extra/TLS přes `run_with_shutdown`) + template feed → `ZION_POOL_DRAIN_GRACE_MS` (default 1500ms) grace na in-flight submity → finální `p.save()` → drain task volá `process::exit(0)` (runtime teardown by čekal na blocking API listener → 30s SIGKILL). Live-ověřeno: signal→flush→exit za ~2.2s, `Deactivated successfully`; fix `99ac09943` řeší select-race (listener arm vystřelil před grace) + teardown-drop drain tasku |
| A4.4 job-freshness alert | ✅ `c9e72b926` + deployed — monitor task (30s) iteruje `pool.leg_statuses()`: enabled leg s `job_age_ms > ZION_POOL_JOB_STALE_MS` (default 120s) → `notify_job_stale` (Telegram) 1×/leg/`ZION_POOL_JOB_STALE_COOLDOWN_S` (600s); leg recovery re-armuje. Live-ověřeno env testem `STALE_MS=1` → 14 warnů přes všechny legs; doplňuje A4.5 prometheus rules (pool-interní push kanál vs scrape alerts) |
| A4.6 DoS-layers doc | ✅ `docs/3.2/POOL-DOS-LAYERS.md` — 6 vrstev (L0 edge → L5 state caps): session admission pořadí (ban→rate→per-IP→global), HTTP public/auth rate limity + XFF-trust, share/dedup bounded caps, kernel tabulka (somaxconn/syn_backlog 8192, syncookies, conntrack 262144 — změřeno live), incident checklist + rezidua (per-listener ip_sessions, TLS handshake cost, chybějící nftables rate-limit) |
| A3.1 payout lifecycle UI | ✅ `d5f3fb718` + deployed — `status` field (`queued`/`sent`/`confirmed`) na `/public/v1/payouts`, `/public/v1/miner/{coin}/{wallet}/payouts` i interním `/api/v1/payouts`; queued řádky se mergují z `pool.pending_payouts` (krátký lock, jen vec clone — žádné I/O pod `pool.lock()`); `payout_lifecycle()` labeluje DB řádky. UI: status badge sloupec na /payouts + miner dashboard (CS/EN), ZION tx → `app.zionterranova.com/explorer/search?q=<txid>` (externí coiny = plain text, foreign chain), nullable `ts` pro queued. Live-ověřeno: `sent` status letí na reálných payout řádcích; test `public_payouts_report_queued_sent_confirmed_lifecycle` pokrývá všechny 3 stavy v jednom feedu |
| A3.2 pending estimate | ✅ `c731bf0ea` (backend, sloučeno paralelní session) + `4571645be` (UI) + deployed — `/public/v1/miner/{coin}/{wallet}` nově nese `min_payout` (per-coin threshold, stejné jednotky jako `unpaid`) a `payout_eta_s` (sekundy do thresholdu při `est_daily` tempu; `0` = eligible pro další dávku; `null` = nelze odhadnout). Miner dashboard: `Čeká na výplatu` ukazuje `unpaid / min_payout`, nový řádek `Výplata za` (CS/EN, `~fmtDuration` nebo `další dávka`). Live-ověřeno: zion miner `unpaid 58.46 / min 10 ZION → eta 0`; neznámá wallet `eta null`. Test `public_miner_payload_reports_min_payout_and_eta` kryje fee-split (400k→356k) + ETA formuli 556_416 s |
| A3.3 SOLO port | ✅ `684c17d91` + deployed — **rozhodnutí: PPLNS zůstává default, SOLO jako opt-in dedikovaný port** (`ZION_POOL_SOLO_PORT=0.0.0.0:8446` live na Edgi). `StratumServer.with_solo_mode` (listener-level flag, NE miner-supplied) → `ShareSubmission.solo` na všech 3 zion submit cestách; `record_share` early-return **před** PPLNS registrací (zero-weight registrace by jinak emitovala 0-amount payout entries); `on_block_found(.., Some(miner))` → jediný `PayoutEntry` = plná 89% miner slice přes `worker_payout_target` (chain-aware: zion/quantus/pearl). `paid_block_heights` idempotence + ledger persist beze změny. Live-ověřeno: `solo_port: listening on 0.0.0.0:8446`, TCP probe dostal plný v3 job feed (QTU/VRSC/ZANO streams) — server clone drží notifier/auxpow/routing parity. Testy: `solo_block_pays_winner_take_all` (fee_split amount, PPLNS balance 0), `solo_block_is_idempotent`, `solo_shares_never_weight_pplns_window`. Externí streamy na solo portu stále kreditují normálně (PPLNS credit za upstream work) — SOLO se týká jen ZION bloku. PPS+ nadále odloženo (treasury) |
| A3.4 fee transparence | ✅ `a85972bfa` + deployed — `/public/v1/coins` top-level `fees` {miner_pct:89, humanitarian:5, issobella:5, pool_fee:1} (protokol split byl dřív jen na interním `/stats`; `fee_bps` per-coin = pool-fee shorthand zůstává). UI: proporční split bar + legenda na /stats pod KPI stripem (`PoolOverview.fees`, nullable pro staré backendy); FAQ přidány fee-split + SOLO :8446 otázky (CS/EN). Live-ověřeno: `fees` letí na veřejném endpointu, zion `fee_bps:100` beze změny, exe sha = build sha, 8446 re-bound po restartu |
| A4.5 prometheus rules | ✅ live na EDGE prometheus (paralelní session) — 7 pravidel `rules/zion-pool.rules.yml` nad job `zion_v31_pool` (:8080/metrics), 0 firing po nasazení |
| A4.2 HA warm standby | ✅ `81dd99b41` (backend) + `4b4538699` (tooling) + deployed — **manuálně ovládaný warm standby na EDGE2** (žádný auto-failover: WebGlobe DNS je manuální, auto-promote = split-brain riziko). EDGE: `/api/v1/state/{pplns,payouts,db}` za API klíčem, octet-stream; db export přes `ShareStore::vacuum_into` (`VACUUM INTO` — WAL-konzistentní snapshot, writerům neblokuje). EDGE2: `pool-standby-sync.sh` timery — JSON state 60 s + DB snapshot 1 h přes `zion-edge-tunnel` (`127.0.0.1:8080`), validate-before-install (JSON parse / SQLite magic + `quick_check`), atomic rename, `.sync-state` stampy (ts/sha256/bytes), last-good na chybu; `pool-ha-watchdog.sh` 30 s — API-via-tunnel + public stratum probe, 3 consecutive fail → 1× dedupovaný Telegram alert (+recovery), **nikdy nestartuje standby**; `zion-pool-standby.service` gated `ConditionPathExists=…/ACTIVATED` (journal potvrdil skip), API bind :8090 (bez kolize s tunel 8080), L1 RPC → EDGE2 node :9445. Live-ověřeno: endpointy 200 (pplns 13.1MB / payouts 117KB / db 121MB SQLite-header), unauth 401, standby DB otevírá se všími tabulkami vč. `share_dedup`, sync stamps čerstvé, watchdog `ok`, EDGE pool zdravý po restartu (dedup restored=1444, drain exit 0). Runbook: `docs/3.2/POOL-HA-STANDBY.md` (failover/failback postup, divergence okno ~60 s PPLNS window) |
| B1 fleet agent MVP | ✅ deployed — `agent.py` (2.B11 skeleton + W3 hardening): `--enroll` → one-time enroll token přes `POST /api/agent/enroll` → rig_id + per-rig secret v `~/.local/share/vast-agent.json` (chmod 600); heartbeat 30 s (uptime/load/GPU util+temp+power+fan/miner procs) auth `Bearer rig_id:secret`; task exec s **allowlist** (prefix match na cmd + metachar ban — `uptime`, `nvidia-smi`, `systemctl …`, `journalctl`, `tmux ls/capture-pane/kill-session`, `pkill -f miner`, `bash /root/`; interpreter-ish prefixes vynechány záměrně) → rc=126 deny mimo allowlist (**CP kompromitace ≠ fleet RCE**); seen-file dedup proti redelivery; `VAST_AGENT_EXEC_ALLOW{,_EXTRA}` rig-side rozšíření. E2E ověřeno na live serve: enroll→heartbeat→`uptime` rc0 + `uptime; rm -rf /` rc126 + audit events |
| B2 control plane core | ✅ deployed — rozšíření `vastctl serve` (žádný nový stack, dle rozhodnutí): `POST /api/agent/enroll` (master `VASTCTL_ENROLL_TOKEN` → per-rig secret, na CP jen sha256 — plaintext se vrací jednou), heartbeat/result auth `rig_id:secret` (rig nemůže reportovat za jiný rig — bearer binds rig_id; legacy shared token drží kompatibilitu), task queue `pending→delivered→done/failed` s TTL prune, `events` audit (enroll/enqueue/result, cap 200), `agent_fleet` += `enrolled` flag + last-20 events. Public path `zionterranova.com/api/agent/*` → EDGE2 nginx → reverse tunnel → serve :8088 (žádný htpasswd — bearer by app). `bootstrap-agent.sh` = scp+enroll+tmux install přes existující vastctl SSH cestu (vast.ai nemá systemd). 19/19 unittestů. **Security fix (W3):** `/api/agent/enqueue` + `/api/agent/sheet*` + `/api/agent/group` = ops-token-only — `Origin`/`Host` NENÍ auth boundary (attacker-set přes public nginx → spoofed same-origin curl = 403); per-rig secrets nesmí queue-ovat tasky ani měnit sheety |
| B3 flight sheets v1 | ✅ deployed — deklarativní desired-state: `desired.rigs`/`desired.groups` pod agent state; `POST /api/agent/sheet` (ops token), `/api/agent/sheet/clear`, `/api/agent/group` (rig→group). Sheet keys `{miner,coin,pool,wallet,args,duty,oc,group}` — unknown keys + missing `miner` = 400; deterministický 12-char sha256 hash. Resolution **rig override > group sheet > none**, scope metadata `_scope`/`_group`. Heartbeat response nese `desired` + hash → agent apply: `apply_desired()` píše `/root/vast-desired.json` a spustí argv (no-shell) `/root/zion-sheet-apply.sh` — CP vlastní *co*, rig-local hook vlastní *jak* (hook: srbminer-dual/zion-miner/xmrig/stop → tmux launches reusing launch_* patterns; sheet hash change = trigger, `{"miner":"none"}` při odstranění). `agent_fleet` += group/desired/applied_sheet/sheets. **Catalog (W4):** `desired.catalog` named presets — `POST /api/agent/catalog` (validace name `[a-z0-9_-]{1,64}` + sheet schema), `/catalog/clear`; `sheet` endpoint přijímá `{"catalog":"name"}` místo inline sheetu. E2E live: group→rig override→fallback→clear ✅; 27/27 unittestů |
| B6 fleet panel wiring | ✅ deployed — `Dashboard.tsx` fleet card: `AgentRig` += enrolled/uptime_s/load1/gpus/miners/group/desired/applied_sheet/offline_alert; tabulka GPU inventory + miner processes + **Sheet sloupec** (miner + scope badge + applied-hash match ✓/⧗/pending) + last heartbeat + pending/results; enrolled badge (green) vs shared-auth badge (amber) + offline alert badge; live/stale `age_s < 300` beze změny. **Bulk ops (W4):** `POST /api/agent/bulk` (ops token) — target `{rigs|group|all}` × action `{task|sheet|catalog|clear_sheet|set_group}` → per-rig results + `bulk` audit event; `POST /api/agent/rig/remove` decommissions rig (drop rig+secret+sheet override). IntroPage build clean (48 str), nasazeno na EDGE2 `/var/www/zion-maintenance` — `zionterranova.com/vast-rigs/` 200 live |
| B2 fleet offline alerts | ✅ deployed — `agent_fleet` detekce `age_s > VASTCTL_AGENT_OFFLINE_AFTER` (600 s default): `alert_offline` event jednou (dedup přes `rig.alerted_offline` flag), heartbeat → `alert_recovered` event + flag clear; `offline_alert` flag na fleet rig entries. Daemon snapshot volá `agent_fleet` každých 60 s → alerts plynou z existujícího ticku bez nového timera |
| B1 agent self-update | ✅ deployed — builtin task op `self-update` {url, sha256}: **host allowlist** (`VAST_AGENT_UPDATE_HOSTS`, default `zionterranova.com`+`raw.githubusercontent.com` — CP token sám ≠ code-signing capability, payload musí být z naší infrastruktury/repo mirror) + 64-hex sha256 pin + `ast.parse` sanity + atomic replace (`.bak-update` rollback soubor) + `os.execv` re-exec (PID/tmux session zůstává). Funěl přes existující enqueue/bulk (bulk = fleet-wide rollout). 29/29 unittestů |
| A5.1 flight-sheet exports | ✅ repo — `infra/flight-sheets/`: HiveOS custom-miner templates (`zion-miner.hiveos.json` v3 trinity 50/50, `srbminer-dual.hiveos.json` quantus+pearlhash), SMOS custom-miner def (`zion-miner.smos.json` s env+hashrate regex), `catalog-seed.json` (5 presetů: `zion-dual-5050`/`zion-solo`→:8446/`srb-dual-5050`/`xmr-cpu`/`stop-all`) + `seed-catalog.sh` apply script + README s import postupy. Live: catalog seednutý 5/5 presetů do :8088 CP |
| A5.2 public API docs | ✅ repo — `docs/3.2/POOL-PUBLIC-API.md`: kompletní reference `/public/v1/*` (field shapes z `api.rs` payload builderů, flowers-vs-string konvence, `payout_eta_s`/`window_share`/`est_*` sémantika, payout lifecycle, rate-limit/503 model, interní `/api/v1/*` + HA `/api/v1/state/*` souhrn). Verifikováno proti live: `/public/v1/history` sample keys = doc; **opraveno na základě probe:** public vhost proxuje jen `/public/v1/*` — `/stats`/`/miners`/`/health`/`/metrics` = API bind (na doméně `/stats` je pool-ui stránka) |
| A2.4 vardiff transparency | ✅ `7440d81bc`+`667bfd345` + deployed — **rozhodnutí: žádná static diff** (`mining.suggest_difficulty` = hint, vardiff drží kontrolu; `d=` password param neexistuje). Místo toho inzerovaná policy: `VarDiffConfig::from_env()` = single source pro stratum i API → `/public/v1/coins` nový `vardiff` block `{start,min,max,target_secs,retarget_shares}` (max `null` = bez stropu); `/start` page difficulty card renderuje live hodnoty přes `fetchVardiff()` + vysvětluje auto-tuning (pomalé rigy níž, rychlé výš → méně stale) |
| A2.6 blocks luck/maturity UI | ✅ `7440d81bc`+`667bfd345` + deployed — public blocks feed `+shares_since_prev` + per-block `luck_pct` (expected/actual, stejná formule jako `pool_luck_100`; `null` pro pre-v8 řádky) + top-level `tip` (chain height pro client-side počítání). `/blocks` page: luck % sloupec (green ≥110 / gold ≤90, tooltip = shares since prev), maturity sloupec countdown do `COINBASE_MATURITY=100` confs (`n/100` gold → `✓ n` mature; orphaned/unknown tip `—`), safe fallback pro neznámý status |
| A2.1 worker-level view | ✅ `077312e40` + deployed — `/public/v1/miner/{coin}/{wallet}/history?worker=<name>` filtruje miner_history řádky per-worker (equality filter, žádná SQL interpolace); nová route `/miner/{coin}/{wallet}/{worker}` (MinerShell seg[3], stávající nginx `/miner/*` map) → `WorkerClient.tsx`: KPI karty (hashrate/accept%/acc/rej), online pill (600s okno), server-side 24h hashrate graf z filtrované historie, share-quality strip z per-minutových delt kumulativních counterů (green/gold/red). Workers tabulka na wallet dashboardu linkuje jména na per-worker stránky |
