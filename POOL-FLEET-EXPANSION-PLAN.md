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
| A3.3 | Payout scheme rozhodnutí: držet PPLNS; **vyhodnotit SOLO port** (lehká varianta — dedikovaný port, winner-take-all kredit) a PPS+ (těžké — vyžaduje pool treasury rezervu). Doporučení: SOLO ano (malý diff), PPS+ odložit |
| A3.4 | Fee transparence: fee split 89/5/5/1 viditelný na /stats + /faq (už v const promptu) |

### A4 — Provozní odolnost (pro-pool = 99.9 %)
| # | Item |
|---|---|
| A4.1 | **Dedup persistence** — audit residual: in-memory share dedup umírá s restartem → replay okno. Fix: bounded on-disk dedup (append log + periodic trim vedle PPLNS state) nebo aspoň per-job watermark persist |
| A4.2 | **HA stratum** — aktivní-pasivní standby na EDGE2 (nebo druhá instance na Edgi): sdílený PPLNS state via file replikace nebo primary/backup share-forwarding; failover přes DNS (`stratum.` low-TTL) nebo `mining.`→stratum SRV. Pozor: dvě aktivní instance = dedup/PPLNS split-brain → **active-passive jen** |
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
- **Payouts:** zůstává jen PPLNS (žádný SOLO/PPS+)
- **Scope:** implementovat všechny vlny W1–W7 postupně

## Status

| Item | Stav |
|---|---|
| A1.1 ext-coin hashrate | ✅ `dde4f5a34` + deployed — target-derived `hps_live`/`hps_1h` v `/miners` + `/public/v1/coins/{c}/stats` |
| A1.2 share-quality (partial) | ✅ `ad8ab5895` — per-stream `accept_rate`; reason buckets pending |
| A1.4 luck / effort | ✅ `ad8ab5895` — shared `BlockTracker` (byl fragmentovaný per-listener), `blocks{luck_100,luck_500,found,confirmed,orphaned,pending}` v `/stats` + zion coin-stats; luck=0 dokud pool nenajde blok (in-memory) |
| A1.5 est. earnings | ✅ `1e992a9cf` + deployed — `window_share`, `est_daily` (empirický 24h payout rate), `est_per_block` (zion subsidy) v `/public/v1/miner/...`; bonus: shared `current_height` across listeners (ext credit height-0 bug) |
| A1.3 history depth | ⬜ (základ `/public/v1/history` existuje) |
| Edge drift (bonus fix) | ✅ `1e992a9cf` deploy syncnul 6 divergentních souborů — Edge teď nese i `e9e0c5066` durable outbox, `4108a52d0` fail-closed payout proofs, `f0da65bb0` revenue journal (dřív na Edge chyběly) |
