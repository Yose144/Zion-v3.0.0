# ZION v3.3 „NIRVANA" — KRÁLOVSTVÍ SRDCE
## Kanonický plán postupu

> **Verze dokumentu:** 1.14 · **Datum:** 2026-11-07 · **HEAD při původním sepsání:** `fdeda709a` (4.B1) — aktualizováno průběžně, viz §7
> **Role:** **jediný vstupní bod** pro plánování v3.3. Není to 14. plán, který si každý vykládá jinak — je to router: říká, co platí, v jakém pořadí, s jakým důkazem a kdo to vlastní. Ostatní dokumenty zůstávají v platnosti, tento je **cituje a opravuje, neduplikuje**.
> **Hierarchie pravdy:** živý kód/sonda → [`canon/books/MiseAmenti/07-Registr-Dukazu.md`](../../canon/books/MiseAmenti/07-Registr-Dukazu.md) → [`docs/3.2/StatusV3.md`](../3.2/StatusV3.md) → tento plán → [`NIRVANA-V3.3-MAP.md`](NIRVANA-V3.3-MAP.md) / [`NIRVANA-V3.3-CHECKLIST.md`](NIRVANA-V3.3-CHECKLIST.md) / [`NIRVANA-V3.3-UNIFICATION.md`](NIRVANA-V3.3-UNIFICATION.md) → [`docs/3.2/V33_NIRVANA_MASTER_PLAN.md`](../3.2/V33_NIRVANA_MASTER_PLAN.md) (vision).
> **Značky vlastníka:** 🤖 autonomní (kód/testy/dokumenty end-to-end) · 🔀 autonomní příprava + operátorské schválení · 👤 operátor (rozhodnutí, peníze, klíče, fyzický svět)

> **Aktuální korekce 2026-11-11 — přednost před staršími snapshoty níže:** G8 **run #7** = **99,9241 %**, evidence 100 %, 5× `chain_live` 60 s, `pending`, cíl **6. 12. 14:51:25Z**; chain **118 687**; pool **`ece8b6965`** a **payout monitoring M2 uzavřen** (probe + rules + rebuild; `payouts_api_ok`/`measurement_ok` = 1, alert firing→resolved). **QTC payout leg OFF od 4. 11.** (36 278 ledger záznamů dismissed), PRL dry-run, BTC swap OFF. Nirvana **proto 34** repo = live. **ZIS agent sub-accounts** implementováno (60/60 testů, `ZIS_AGENTS_ENABLED` default OFF — DB push + deploy = 👤). Charta R9 **factual** ✅ / legal + cultural 👤. EDGE2 `networkd-wait-online` vyřešen; nginx listen options repo-only. Fronta a důkazy: [`DOC_VS_CODE_ANALYSIS_2026-11-10.md`](DOC_VS_CODE_ANALYSIS_2026-11-10.md) §4, [`REPORT_2026-11-11_PAYOUT_MONITORING.md`](../3.2/REPORTS/REPORT_2026-11-11_PAYOUT_MONITORING.md).
>
> **Aktuální korekce 2026-11-07 — přednost před staršími snapshoty níže:** G8 **run #7** `g8-20261106T145125Z`, cíl **2026-12-06T14:51:25Z**, živě 531/531 good/covered, 100 %, 0 incidentů, **pending**. Run #6 byl 6. 11. zastaven a archivován jako `evidence_incomplete`, ne PASS; [důvod a nasazená oprava](../3.2/REPORTS/REPORT_2026-11-06_G8_POOLFIX_RUN7.md). Kalendář 28. 11. už není cílem G8; premine zůstává samostatnou výškovou podmínkou. Next major upgrade je hotový (šest app manifestů 16.4.3, živý web/market/Nirvana 16.4.3), repo/app/net Nirvany mají proto 32. QTC payout je v běžícím warpd **OFF**, PRL dry-run, BTC swap OFF. Před novými funkcemi řešit **PII při duplicitním orderId, monitoring EDGE1 (node-exporter down), payout freshness (`ts:null`), atomický sklad a release verifier/provenance**. Přesné důkazy, testovací podmínky a hranice 🤖/👤: [audit + autonomní fronta 7. 11.](../3.2/REPORTS/REPORT_2026-11-07_EDGE_AUDIT_AUTONOMOUS.md). Aktivní run ani produkce se tímto auditem neměnily; G9/sign-off dál blokují Stable.

---

## 0. Jak číst

1. **§1** je ověřený stav — měřeno 31. 10. 2026, ne citováno z dokumentů. Když se s ním něco rozchází, má přednost §1.
2. **§2** je registr rozporů — každý má vlastníka a musí zmizet. Dokud tam je, dokumentům se nedá věřit.
3. **§3** je šest vln W0–W6. Pořadí není kosmetika: W0 a W1 nikdy nečekají na 👤, W2/W4/W5 ano.
4. **§4** je kritická cesta. Tři nezávislé věci se sbíhají do 27.–28. 11. 2026.
5. **§5** jsou akceptační kritéria V33-1…9 — bez nich se vlna nezavírá.
6. **§6** je to, co plán **nedělá**. Čti to jako hranici, ne jako upozornění.

---

## 1. Ověřený stav — živé sondy 2026-10-31

> Metoda: `ssh zion-edge2` + `ssh -J zion-edge2 … root@62.171.141.136`, `systemctl show/list-units/list-timers`, `curl` na veřejné URL, `dig +short`, RPC `getChainInfo`, `du -sh`, `g8_run.json`. Časy v CET, pokud není uvedeno UTC.

### 1.1 Topologie

| Role | Host | Hardware | Stav |
|---|---|---|---|
| **EDGE2** — primary + web ingress + app stack | `207.180.217.100` (vmi3684458) | 6c EPYC / 11 GB / 193 GB | uptime od 28. 10. 18:04, load 1,65, RAM 5 676/11 960, swap 1 835/4 095, **disk 111 G (58 %)**, **0 failed units**, 23 běžících `zion-*` |
| **EDGE** — pool + followeři + ops | `62.171.141.136` (vmi3425821) | 4c / 8 GB / 145 GB | uptime 2d15h, load 5,38, RAM 5 038/7 941, swap 232/8 191, **disk 101 G (70 %)**, **0 failed units**, 13 běžících `zion-*` |

### 1.2 Chain a služby

| Metrika | Hodnota |
|---|---|
| Height | **103 595** (`accepted_blocks` 103 596) |
| `node_version` | **3.2.0** |
| `protocol_version` | `3.1.0-alpha` — **wire ID, záměrně nemění**, není to stupeň zralosti |
| Konsensus | `ekam_deeksha` |
| Difficulty | 23 197 |
| Mempool | 1 |

**Běžící unity EDGE2 (23):** `zion-v31-node` (primary, RPC 9445), `zion-v31-multichain`, `zion-v31-dao`, `zion-v31-oasis`, `zion-v31-free-world`, `zion-v31-issobella`, `zion-v31-ncl`, `zion-v31-ai-native`, `zion-zis`, `zion-website`, `zion-marketplace`, `zion-quantus-node`, `zion-pearld` + `zion-pearl-oyster` + `zion-pearl-gateway`, `zion-bitcoind`, `zion-btcunlock-coord`, `zion-l1-watcher`, `zion-db-sync`, `zion-g8-probe`, `zion-hiran-gateway` + `zion-hiran-inference`, `zion-edge-tunnel`.

**Běžící unity EDGE (13):** `zion-v31-pool` (8444/8445/8446 + API 8080), `zion-v31-node2` (9446), `zion-v31-node3` (9447), `zion-v31-miner`, `zion-fallback-miner`, `zion-edge-python-dashboard` (8766), `zion-g8-probe`, `zion-g8-alert-sink`, `zion-pool-wedgewatch`, `zion-rig-output`, `zion-nirvana` (:3010), `zion-chain-tunnel`, `zion-bitcoind-regtest`.

**Timery:** EDGE2 — `zion-pool-ha-watchdog` (30 s), `zion-l2-indexer` (30 s), `zion-pool-standby-sync` (60 s), `zion-vastrigs-sync` (60 s), `zion-writepath-probe` (60 s), `zion-edge-watchdog` (120 s), `zion-pool-standby-dbsync` (60 min). EDGE — `zion-v31-watchdog` (60 s), `zion-g8-evidence` (5 min), `zion-pool-state-replicate` (15 min), `zion-edge-backup` (4 h), `zion-edge-maintenance` (denně).

### 1.3 G8

| Položka | Hodnota |
|---|---|
| Run | **#6** `g8-20261029T234617Z` |
| Start / cíl | 2026-10-29T23:46:17Z → **2026-11-28T23:46:17Z** |
| Uptime | **99,7976 %** |
| Evidence coverage | 100 % (step 60 s) |
| Incidents | **1** — 30. 10. 21:00:17–21:04:17Z, 240 s, služby `pool_http` + `pool_stratum` |
| Kritické (≥900 s) | **0** |
| Service uptime | `chain_live` 100 · `pool_http` 99,7976 · `pool_stratum` 99,9494 · `multichain` 100 · `dao` 100 · `zis` 100 |
| Gate status | `pending` |

### 1.4 DNS a veřejné povrchy

| Hostname | Cíl | HTTP | Poznámka |
|---|---|---|---|
| `zionterranova.com`, `www.` | EDGE2 | 200 | static export `/var/www/zion-maintenance` |
| `app.` | EDGE2 | 200 | `zion-website` :3000, `/api/health` OK |
| `market.` | EDGE2 | 200 | `zion-marketplace` :3100 |
| `pool.` | EDGE2 | 200 | ingress → tunel → EDGE :8080 |
| `oasis.` | EDGE2 | 200 | `/var/www/oasis` |
| `auth.` | EDGE2 | 200 | `zion-zis` :8096, JWKS OK |
| `freeworld.` | EDGE2 | 200 | `zion-v31-free-world` :8095 |
| `rpc.` | EDGE2 | 200 | |
| `explorer.` | **EDGE** | 301 | web-tier cutover není úplný |
| `nirvana.` | **EDGE** | 200 | `zion-nirvana` :3010, `User=zion` |
| `dashboard.` | EDGE | 401 | basic auth — **živé, ne mrtvé** |
| `api.` | EDGE | **404** | ⚠️ **služba žije na EDGE2** — `zion-hiran-gateway` :8007, `/health` 200, neauth chat = `401 Missing API key`. Vhost `infra/nginx/edge2/api.zionterranova.com.conf` je hotový v repu (SSE unbuffered). **31. 10.: vhost staged na EDGE2 (port 80), `nginx -t` OK** — zbývá jen DNS → EDGE2 + cert |
| `updates.` | EDGE | **404** | **Revidováno 1. 11.:** update/license server přesunut `archive/update-server` → `apps/update-server` a bude **publikován** (VIP auto-update + licence). DNS `updates.` → 62.171.141.136 (EDGE), kde nic neběží → přesunout na EDGE2 + cert. `updates.` se **nemaže** — je součástí VIP autoupdate plánu ([`DESKTOP-AGENT-COMPLETE-PLAN.md`](DESKTOP-AGENT-COMPLETE-PLAN.md) §7). |
| `dex.` | EDGE | **404** | ⚠️ **backend žije na EDGE2** — warpd `:8453`/`:8454`. **31. 10.: `/prices/:token/history` implementováno a nasazeno** (`V31/L2/multichain/src/pricing.rs`, `warpd` restart 10:37, live: `tf=90d` → 4 body `source:"orders"`, `tf=24h` → `prices:[]` + `last_known`), vhost staged na EDGE2 (úzký povrch: `/prices/`, `/v1/swap/pools`, `/health`; zbytek 404). Zbývá DNS → EDGE2 + cert |

**Veřejné API sanity:** `app./api/ai-chat` 200 · `oasis./api/v1/oasis/quests` 200 · NCL `:8098/health` OK (`total_workers=0`) · ai-native `/v2/info` = `hiran-maestro 2.4`, `mutations_enabled=false`, `approval_token_configured=false`.

### 1.5 Zdroje a rizika

| Zjištění | Číslo |
|---|---|
| `/opt/zion/backups` na EDGE | **42 G** z 101 G použitého (dominantní konzument) |
| `/opt/zion/hiran-models` | 5,5 G |
| `/opt/zion/V31` | 5,4 G |
| `/opt/zion/canonical-main` | 2,6 G |
| `/opt/zion/beta-build-20261026` | 1,4 G — kandidát na úklid |
| EDGE mining zátěž | `zion-fallback-miner` 147 % CPU + `zion-v31-miner` 83 % CPU = 8 threadů na 4 jádrech, oba `Nice=19` |
| `zion-v31-node` na EDGE2 | `UnitFileState=disabled` — startuje jen přes `WantedBy=zion-v31-multichain.service` |
| `zion-pool-standby` na EDGE2 | `inactive`, `/opt/zion/bin/zion-pool-standby` |
| `AppPay` update server | kód jen v `archive/update-server`, nic neběží → `updates.` DNS smazat |
| `api.` / `dex.` na EDGE | DNS vede na EDGE (`62.171.141.136`), ale obě služby běží na **EDGE2** → TLS SAN mismatch, `curl` = `000`; uživatel vidí rozbité UI. **Porty 8453/8454 nejsou z internetu dostupné** (UFW: 8453 jen z EDGE, 8454 žádné pravidlo) → nginx vhost je jediná veřejná cesta, proto je `dex.` vhost úmyslně úzký |

---

## 2. Registr rozporů — truth-sync

> Každý řádek musí skončit buď **opravou dokumentu**, nebo **opravou reality**. Dokud řádek existuje, považuj dokument za nedůvěryhodný v daném bodě.
> Tabulka nahrazuje `NIRVANA-V3.3-MAP.md §8` (stav 26. 10.), která je od tohoto data **neplatná**.

| # | Dokument | Tvrdí | Realita 31. 10. | Řešení | Kdo | Stav |
|---|---|---|---|---|---|---|
| 1 | G8 plánové snapshoty | run #5/#6, konec 24./28. 11. | **7. 11. ověřeno:** run #7 `g8-20261106T145125Z`, cíl **6. 12. 14:51:25Z**, pending; #6 archivován evidence_incomplete | Aktuální StatusV3, ROADMAP a tento router srovnány; starší snapshoty nejsou dnešní gate evidence | 🤖 | ✅ aktuální vstupy |
| 2 | `AGENTS.md`, `StatusV3.md` | mlčí o minerálních zátěži na EDGE | 8 mining threadů na 4 jádrech, ~230 % CPU | zdokumentovat **proč** je to záměr (pool liveness / block production) | 🤖 | ✅ |
| 3 | `systemd` EDGE2 | node = primary, ale `disabled` | implicitní `WantedBy=zion-v31-multichain` + `zion-v31-pool` (pool na EDGE2 disabled) → křehké po rebootu | `systemctl enable` + explicitní `WantedBy=multi-user.target` | 🔀 | ✅ |
| 4 | `CHECKLIST` N0, `MAP §7` | HA stratum „nerozhodnuto" (2.S5) | EDGE2 **má** `zion-pool-standby` + 3 timery (30 s / 60 s / 60 min), inactive (static), nedokumentované; watchdog = **alert-only** (anti split-brain, nikdy auto-promote); fencing (W2.2/G11) **otevřené**; paritní gate PASS 0 fail/5 warn (B4/B5 procesní kroky promotu). **Armed mód neexistuje v kódu** — pouze manuální promote. | zdokumentovat (hotovo: DR-BRINGUP-RUNBOOK.md) + fencing analýza (otevřené) + 👤 flip na armed (neexistuje — promote je manuální) | 🤖→🔀 | ✅/🔄 |
| 5 | `AGENTS.md` topologie | web-tier cutover hotový | `explorer.` a `nirvana.` zůstávají na EDGE; `api./dex.` = DNS míří na EDGE (62.171.141.136), ale služby běží na EDGE2 (207.180.217.100) → 404 z internetu. Vhosty na EDGE2 **enabled** (api. + dex. conf, `nginx -t` OK), endpoint `/prices/:token/history` nasazen ve warpd. Certbot certifikáty pro api./dex. **neexistují** (ověřeno 1. 11.). `updates.` nemá explicitní A záznam (wildcard → EDGE) — není co mazat. | **revidované rozhodnutí 👤 31. 10.**: `api.` → **publikovat** (služba běží, vhost v repu); `dex.` → **doplnit `/prices/:token/history`** (✅ hotovo) + publikovat; `updates.` → **žádný A záznam** (wildcard). **Zbývá 👤:** DNS flip `api`+`dex` A → EDGE2 (207.180.217.100) + `certbot --nginx`. | 🔀 | 🔄 |
| 6 | `MAP §8`, `CHECKLIST` stav v kostce | `3.2.0-beta.1`, „Mainnet Alpha" | `V31/Cargo.toml` = `3.2.0`, node hlásí `3.2.0`, RELEASE_NOTES = „Mainnet Beta" | sjednotit na **3.2.0 = Mainnet Beta** | 🤖 | ✅ |
| 7 | root `ROADMAP.md` | „Chain height 23 640+ (2026-08-31)" | 103 595 | nahradit odkazem na `StatusV3.md`, žádné číslo v ROADMAP | 🤖 | ✅ |
| 8 | provozní realita | `/opt/zion/backups` nedokumentováno | retenční politika **hotová**: `RETENTION_DAILY=42`, `RETENTION_WEEKLY=4`, orphan sweep `-mmin +1440`; backups 7,8 G, disk EDGE 44 % (ověřeno 1. 11.). `beta-build-20261026` (1,4 G) + `canonical-main` (2,6 G) kandidáti na úklid — **neověřeno** zda smazáno. | retenční politika ✅ aplikována; úklid kandidátů (beta-build, canonical-main) = 👤 schválení | 🤖 návrh → 👤 apply | ✅/🔄 |
| 9 | repo hygiena | `apps/` obsahuje artefakty | `website-v2.9-backup-*.tar.gz` 30 MB, `public_html`, untracked `desktop-agent/resources/node` | přesun do `archive/`, `.gitignore` | 🤖 | ✅ |
| 10 | `apps/*/package.json` | Next 14 vs 16 / React 18 vs 19 | **7. 11. ověřeno:** IntroPage, MarketPlace, pool-ui, OasisWeb, website-v2.9, nirvana mají Next `^16.4.3` + React `19.2.0`; živý web/market standalone a Nirvana Next 16.4.3 | Major upgrade již nezadávat; staré top-level node_modules nejsou standalone runtime. Nový vulnerability audit tím nenahrazen | 🤖 | ✅ major upgrade |
| 11 | `docs/3.2/ROADMAP.md` | G8 „run #2 not started" | runy #2–#5 uzavřené, #6 běží | opravit | 🤖 | ✅ |
| 12 | `REPO-MAP.md`, `AGENTS.md` | `public/` = git subtree | tracked `public/` přesunut do `archive/PUBLIC/` | přepsat G4/E7 workflow | 🤖 | ✅ |
| 13 | `apps/website-v2.9/src/components/dex/*` | DEX UI je živé | `RecentSwaps.tsx` volá `${ROUTER_URL}/swaps?limit=10`, `TransactionStatus.tsx` `/swaps/:id` — **v `warpd` tyto routy neexistují** (legacy ZionDex Router surface). `ZionDexDashboard` (jejich jediný konzument) se v `app/` **nikde nerenderuje** → mrtvý kód. Živý povrch je jen `PriceChart` (`/market` ř. 1637). | W4 K3: buď routy doplnit, nebo komponenty smazat při unifikaci DEX UI | 🤖 | ✅ smazáno 1. 11. — trio `ZionDexDashboard`/`RecentSwaps`/`TransactionStatus` odstraněno (žádný import mimo sebe); `/swaps` routy v `warpd` se nedoplňují — legacy Router surface, reálné swapy pojedou přes V3 on-chain (`tx_hash`) po K2 |

---

## 3. Šest vln

### W0 — Truth-sync + hygiena · 🤖 · 1–2 dny · **bez dopadu na money-path**

Cíl: aby dokumenty nelhaly a repo bylo čisté. Gate: `git diff --check` čistý a **nulový rozpor** mezi dokumenty a sondou z 31. 10.

| Úkol | Soubor | Změna |
|---|---|---|
| T0.1 | `NIRVANA-V3.3-CHECKLIST.md` | řádek 30 (stav v kostce), řádek 49–55 (N0 G8 checklist), řádek 186 (V33-1) → run #6 |
| T0.2 | `NIRVANA-V3.3-MAP.md` | §6 kotvy (3 řádky), §8 → nahradit odkazem na tento plán §2 |
| T0.3 | `ROADMAP.md` | snapshot 2026-08-31 → 2026-10-31, výška → odkaz na `StatusV3.md`, „Mainnet Alpha" → Beta |
| T0.4 | `AGENTS.md` | nový záznam 2026-10-31: HA standby stack, EDGE mining liveness, DNS úklid, tento plán |
| T0.5 | `docs/3.2/StatusV3.md` | G8 run #6, HA standby stack do topologie |
| T0.6 | `infra/RUNBOOK.md` | sekce Pool HA + aktuální DNS mapa |
| T0.7 | `archive/` + `.gitignore` | přesun `apps/website-v2.9-backup-*.tar.gz`, `apps/public_html`; ignore `apps/desktop-agent/resources/{node,zion,zion-derive-addr}` |
| T0.8 | EDGE2 nginx + DNS | `api.` → vhost `:8007` + cert + DNS na EDGE2 (**publikovat**, služba běží); `dex.` → vhost `:8454` + cert + DNS na EDGE2 **po** doplnění `/prices/:token/history`; `updates.` → **žádný A záznam v zóně není** (wildcard), takže „smazat" = nechat být. **Stav 31. 10.: oba vhosty staged na EDGE2 (port 80, `nginx -t` OK), `/prices/:token/history` implementováno a nasazeno ve `warpd`. Zbývá pouze 👤 DNS flip (`api` A → EDGE2, nový `dex` A → EDGE2) + `certbot --nginx`. Přesný diff zóny: [`infra/dns/zionterranova.com.zone.md`](../../infra/dns/zionterranova.com.zone.md) §Fáze 3.** |
| T0.9 | `/opt/zion/backups` | návrh retenční politiky (14 denních + 8 týdenních + 6 měsíčních?) ke schválení |

---

### W1 — RC kvalita 3.2 · 🤖 · G8 #7 nejdříve 6. 12. · **primární priorita**

Cíl: až G8 doběhne, být připraven na RC sign-off. Nezávislé na unifikaci.

| Úkol | Obsah | Důkaz |
|---|---|---|
| W1.1 | refresh `deploy-provenance` baseline (8.B3) na aktuální běžící binárky | ✅ `docs/3.2/DEPLOY-PROVENANCE-2026-11-01.jsonl` (edge `c14f1e4d9`, edge2) |
| W1.2 | alert na stale block production (k `ZionPoolPayoutStale`, `ZionPoolStatsApiUnresponsive`) | ✅ rule v `/etc/prometheus/rules/zion_writepath.rules.yml` (ověřeno 1. 11.); firing test ✅ (8.B9, 31. 10.) |
| W1.3 | **DR drill runbook** — bringup standby repliky; ⚠️ stop primary first (double-pay hazard) | ✅ `docs/3.2/ops/DR-BRINGUP-RUNBOOK.md` (fencing W2.2/G11 **otevřené** — armed mód neexistuje v kódu) |
| W1.4 | release artifacts 9.B4: přebuild linux + windows z RC commitu, zbývá OpenCL varianta | 🔄 linux only (default + gpu-opencl) v `dist/v3.2.0-rc-w1.4/`; **BUILD-INFO.txt přidán** (commit `aa6599cce`, 1. 11.); SHA256SUMS aktualizován. **Windows cross-compile:** `cargo check` PASS (1. 11.), `cargo build --release` selhal na `-lOpenCL` (mingw OpenCL ICD loader nedostupný — známý caveat z AGENTS.md); CPU-only varianta (bez gpu-opencl) spuštěna v background. **Macos:** target `aarch64-apple-darwin` nainstalován, build nezkoušen. Zbývá: windows (OpenCL SDK), macos, EDGE rebuild z RC commitu (glibc), embedded `ZION_GIT_SHA` v binárce |
| W1.5 | audit package refresh (pin na RC commit) | ✅ pin aktualizován na `aa6599cce` (1. 11.), Generated datum 2026-11-01 |
| W1.6 | cert `auth.` — **aktualizace 31. 10.: už proběhlo.** Cert má `notAfter` **24. 1. 2027** (EDGE2) / 25. 1. 2027 (EDGE), SAN `auth.zionterranova.com`, `certbot.timer` běží 2×/den na obou boxech. Kotva „25. 11. expirace" v `AGENTS.md` je **stale** — renewal proběhl ~26. 10. Zbývá jen kontrola jednou za 2 týdny (`openssl x509 -enddate`) | `openssl x509 -enddate`, certbot log |
| W1.7 | premine 144k checklist pro 👤 (27.–28. 11., 3-of-3 admin unlock + DAO) | checklist v `docs/3.2/ops/` |

**Gate W1:** G8 run #7 `gate_status=passed` nejdříve 6. 12. 14:51:25 UTC → V33-1; žádná otevřená 🤖 položka v RC checklistu. Aktuální `pending` není PASS; G9 a operátorský sign-off jsou další samostatné podmínky.

---

### W2 — Pool HA / DR · 🤖 příprava → 🔀 aktivace · **rozhodnuto: dokumentovat + aktivovat**

Zadání 👤 (31. 10.): stack existuje, tak ať je podporovaný a zdokumentovaný — ne rozebraný.

| Úkol | Obsah | Riziko |
|---|---|---|
| W2.1 | audit `pool-ha-watchdog.sh` — podmínky promote, chování při split-brainu, umí vrátit primary? | — |
| W2.2 | ⚠️ **fencing analýza** — 30 s interval + promote při zpomalení (ne smrti) = **dvojí výplata**. Podmínka aktivace: promote jen po prokázaném failu + explicitní stop primary, nebo fencing token. **Audit dokončen** (REPORT_2026-10-31_W2.1-W2.2_POOL_HA_FENCING.md): watchdog = alert-only, 5 guardrailů navrženo. **Implementace fencing HOTOVÁ 1. 11.** (G11) — `infra/tools/pool-ha/pool-promote-guard.sh` vynucuje G1–G6 (prokázaná smrt z unit+proces, auto-restart pryč, stratum zavřený, parita bez FAIL, single-flight token, cooldown), 22/22 testů, live `--check` na produkci = BLOKOVÁNO; read-only sonda primáru přes OMEZENÝ klíč (forced command, `from=`). **Armed mód (auto-promote) stále neexistuje** — promote je manuální, ale omylem ho udělat nelze | **nejvyšší riziko plánu** |
| W2.3 | dokumentace: `AGENTS.md`, `StatusV3.md`, `infra/RUNBOOK.md`, nový HA runbook — **stav 31. 10.: hotovo jako [`docs/3.2/ops/DR-BRINGUP-RUNBOOK.md`](../3.2/ops/DR-BRINGUP-RUNBOOK.md)** (název „POOL-HA-RUNBOOK.md" z návrhu se nepoužil; kanonický dokument je DR runbook, `infra/RUNBOOK.md` na něj odkazuje) | — |
| W2.4 | RTO/RPO tabulka — ~~RPO ≤15 min~~ **naměřeno 31. 10.: PPLNS + payout ledger ≤ 60 s, `pool-store.db` ≤ 60 min** (`dr-parity-check.sh --only data`). „≤15 min" v původním znění platilo jen pro ledger, ne pro `store.db` | RPO/RTO |
| W2.4b | **paritní gate + uzavření B1/B2/B3/G5** (31. 10., commit `0bb706737`) — standby měl coinbase na `zion1pool`, payout klíč ke staré peněžence a PPLNS okno 1000× menší; parita nyní pinovaná **flagy v unitě**. Gate `PASS (0 fail, 5 warn)`; WARN = jen kroky promotu (B4/B5) | `scripts/ops/dr-parity-check.sh` |
| W2.5 | doplnit `pool_standby` do G8 `evidence_policy.required_services` — **mimo aktivní run** (změna schématu) | — |
| W2.6 | staged activation: `log-only` (watchdog jen loguje) → 👤 flip na `armed` | **Poznámka 1. 11.:** armed mód v kódu watchdogu **neexistuje** — watchdog je permanentně alert-only (anti split-brain). Promote je vždy manuální (DR-BRINGUP-RUNBOOK.md §5). „Flip na armed" = případný budoucí vývoj (G11), ne aktuální stav. |

**Gate W2:** HA runbook schválen 👤 + fencing podmínka doložena testem + alespoň 1 týden `log-only` bez falešného promote.

---

### W3 — Bezpečnost a peníze · 🤖 příprava + 👤 akce

| Úkol | Obsah | Kdo |
|---|---|---|
| W3.1 | **P0-3 credential isolation** — sdílený `edge-environment.sh` = každá V31 služba vidí cizí credentials. Rozdělit na per-service env subsety + rotace. **Nejvyšší bezpečnostní dluh.** **Ověřeno 1. 11.:** většina V31 služeb stále používá sdílený `/etc/zion/edge-environment.sh` (19 KB, 0644); per-service env soubory existují jen pro pool L1 primary, btcunlock, standby. **Zůstává otevřené.** | 🤖→👤 |
| W3.2 | secret scanner jako povinný gate (public export scan už má 0 FP) | 🤖 |
| W3.3 | SMTP / Resend — emaily nechodí (wallet-seed zachránitelný z DB) | 👤 |
| W3.4 | dofinancovat pool wallet — loyalty výplaty, balance 0 | 👤 |
| W3.5 | QTC deferred — treasury. **Stav 31. 10. (živě z `zion-v31-multichain` journalu): `qtc_sweeper stalled orphaned queued payouts stalled=1751`, `treasury_free=0`** — roste (dříve ~918). Každý blok přidává další deferraly, dokud treasury nedofinancuješ. **Aktualizace 11. 11.:** payout leg je od **4. 11. zcela OFF** (`QTC_PAYOUT_ENABLED=0`, 36 278 `ext_payout_records` dismissed) — čísla 1751/918 jsou před vypnutím; re-enable = 👤 funding + explicitní flip. | 👤 |
| W3.6 | gas pro non-Base rotaci klíčů (Polygon 0,15 POL; BSC/Arb/OP/AVAX 0,003–0,05) | 👤 |
| W3.7 | `WARP_BTC_SWAP_ENABLED=0` držet do uzavření G9 | 👤 |

---

### W4 — Unifikace K0–K4 · 🤖 · v tomto okně **jen návrh (read-only)**

> Vynuceno rozhodnutím „RC first". Implementace začíná **po RC sign-off**. Do té doby jen dokumenty, žádné deploye na produkční povrchy.
> Kanonický popis: [`NIRVANA-V3.3-UNIFICATION.md`](NIRVANA-V3.3-UNIFICATION.md).

| Vlna | Obsah | Toto okno |
|---|---|---|
| **K0** | repo kontrakt, Portal Contract v1 draft | ✅ hotovo 30. 10. |
| **K1** | shell GA — `apps/nirvana` z „13. appky" na modular monolith: jedna i18n, jeden design token systém, scény z `apps/shared/scenes`, session přes `auth.` | 📝 design doc |
| **K2** | 8+ hostname → 3 vstupy (apex = úvod, app = práce, market/oasis = výloha), redirecty | 📝 mapa redirectů |
| **K3** | Next 14 → 16: IntroPage, MarketPlace, pool-ui. Vázáno na bezpečnostní gate 1b (MarketPlace `next` critical) | 📝 migrační plán |
| **K4** | `zion-compute` (strojovna / Engine srdce) | HORIZONT — mimo tento cyklus |

**Gate K1:** denní cesta (svět, řetěz, těžba, výloha, knihy, přístav, účet) funguje v jednom klientovi bez pádu na API starých appek.

---

### W5 — Shell / Portal nasazení · 🔀 · po K1 GA

- W5.1 rozhodnout, zda `zion-nirvana` zůstane na EDGE :3010 nebo jde na EDGE2 (dnes `WorkingDirectory=/opt/zion/APP&WEB/nirvana`, `User=zion`, `/usr/bin/node server.js`)
- W5.2 feature parity 7 denních čtení + mobile + a11y
- W5.3 DNS flip = 👤 (jeden hostname, jedno okno, rollback skript)

---

### W6 — 👤 rozhodovací fronta (podle dopadu)

| # | Rozhodnutí | Blokuje | Stav |
|---|---|---|---|
| 1 | **G9 externí audit** (firma, budget, NDA, kickoff) | Stable, BTC swap, CoinGecko | ⏸️ posunuto |
| 2 | **QTC payout re-enable** (leg OFF od 4. 11.; dřívější ~918 deferred) + treasury funding | V33-9 | ⬜ |
| 3 | **Pool wallet funding** | loyalty výplaty | ⬜ |
| 4 | **SMTP / Resend** | emaily, seed recovery | ⬜ |
| 5 | **P0-3 rotace** | bezpečnostní dluh | ⬜ |
| 6 | Osud `api./updates./dex.` | V33-8 | ✅ rozhodnuto 31. 10. (revidováno po živých sondách — viz §2 #5) |
| 7 | HA vs. single pool (2.S5) | W2 | ✅ rozhodnuto 31. 10. |
| 8 | **Premine 144k** (27.–28. 11.) | 1.S3 | ⬜ |
| 9 | Veřejný launch date | G8 PASS + G9 | ⬜ |
| 10 | Retenční politika `/opt/zion/backups` (42 G) | disk EDGE 70 % | ⬜ |

---

## 4. Kritická cesta — historický snapshot 31. 10.

> **Korekce 7. 11.:** termíny G8 a navázané RC rezervy v diagramu níže byly nahrazeny runem #7 do **6. 12. 14:51:25 UTC** (viz aktuální korekce nahoře a W1). Starý kalendář není příslib dokončení. Premine je nezávislý výškový gate; nové datum unlocku se z G8 neodvozuje.

```
31.10 ─► W0 truth-sync + DNS příprava (1–2 dny)                       🤖
             │
             ├─► W1 RC kvalita ────────────────────────────┐           🤖
             │    provenance · alerty · DR runbook ·       │
             │    artefakty · audit package                 │
             │                                              ▼
             │            28.11 G8 #6 KONEC ═══════════► RC sign-off 👤
             │                                              │
27–28.11 premine 144k 👤 ══════════════════════════════════┤
             │                                              ▼
             ├─► W2 HA log-only ──► armed 👤 ──► W3 P0-3 👤
             │
             └─► W4 design (read-only) ─► po RC: K1 impl ─► W5 flip 👤
```

**Dvě nezávislé kotvy se sbíhají do 27.–28. 11. 2026** a ani jedna není 🤖:

| Datum | Událost | Důsledek |
|---|---|---|
| 28. 11. 23:46Z | konec G8 run #6 | V33-1; bez PASS není RC sign-off |
| ~27.–28. 11. | výška 144 000 — time-lock premine slotů 6–8 | utratitelnost dál jen 3-of-3 admin unlock + DAO (1.S3) |

> **Korekce 31. 10. (W1.6):** třetí kotva „25. 11. expirace certu `auth.`" **neexistuje** — cert byl obnoven ~26. 10. a platí do 24. 1. 2027, `certbot.timer` jede 2×/den na obou boxech. Kotva byla převzata z poznámky v `AGENTS.md`, která popisovala stav *před* renewalem.

**Proto W1 končí 24. 11., ne 28. 11.** Poslední čtyři dny okna jsou rezerva na 👤 sign-off a na to, co se posere.

---

## 5. Akceptační kritéria

| ID | Kritérium | Důkaz |
|---|---|---|
| **KS-1** | G8 run #7 ≥ 99,9 %, bez kritického incidentu, celé okno do 6. 12. 14:51:25 UTC | `g8_run.json` → `gate_status=passed`; nyní pending |
| **KS-2** | Žádný rozpor dokumentů vs. sonda | §2 tabulka bez řádku `⬜` |
| **KS-3** | Prokazatelná provenance všech běžících binárek | `deploy-provenance.jsonl` refresh |
| **KS-4** | Release artefakty pro 3 platformy z RC commitu | `SHA256SUMS` + `BUILD-INFO.txt` |
| **KS-5** | DR drill runbook schválen 👤 | `docs/3.2/ops/DR-BRINGUP-RUNBOOK.md` |
| **KS-6** | P0-3 uzavřeno — žádná služba nevidí cizí credentials | audit env subsetů |
| **KS-7** | K1: denní cesta v jednom klientovi | E2E test / screenshot |
| **KS-8** | 0 mrtvých veřejných povrchů (buď 200, nebo DNS pryč) | HTTP sonda 31. 10. + po úklidu |
| **KS-9** | Pool HA: fencing doložen, `log-only` ≥ 1 týden bez falešného promote | HA runbook + logy |

> `KS-n` jsou **provozní brány tohoto plánu** (Království Srdce). **Nenahrazují** DoD `V33-1…11` z [`NIRVANA-V3.3-CHECKLIST.md`](NIRVANA-V3.3-CHECKLIST.md) — jsou to podmínky, aby se DoD dalo vůbec měřit. `KS-1` = `V33-1`, `KS-6` = `V33-8` (kvalita), `KS-9` = `V33-9`.

---

## 6. Co tento plán nedělá

- **Nemění L1 consensus** — `consensus.rs`, `genesis.rs`, `emission.rs`, `fee.rs`, `crypto.rs`, `cosmic-harmony/**` jsou mimo dosah. Bez výslovného písemného schválení 👤.
- **Nepřepíná money-paths** — žádný payout, swap, bridge unlock ani treasury pohyb.
- **Nevydává verze** — RC sign-off je 👤. Plán jen připraví artefakty a důkazy.
- **Nevybírá dodavatele** — G9 je čistě 👤.
- **Nepřejmenovává Mainnet Beta na Stable** — Stable je až `G8 PASS ∧ G9 uzavření`, G9 je posunuté.
- **Nespouští DR drill** — runbook ano, provedení 👤.
- **Neaktivuje HA** — `log-only` ano, `armed` 👤.
- **Neslibuje datum veřejného launchu** — je to 👤 rozhodnutí po G8 + G9.
- **Nezakládá 14. dokument** — tento soubor je router. Změny se dělají v citovaných dokumentech, tady jen v §2 a §7.

---

## 7. Změnový log

| Datum | Změna |
|---|---|
| 2026-11-11 | v1.15 — **truth-sync (autonomní session):** payout monitoring M2 uzavřen (probe+rules+pool `ece8b6965`), QTC payout leg OFF od 4. 11., ZIS agent sub-accounts implementováno (60/60, default OFF), R9 factual ✅, EDGE2 `networkd-wait-online` fix. Srovnány `PLAN.md`, `NIRVANA-V3.3-CHECKLIST.md`, `NIRVANA-V3.3-MAP.md` (§4–§6), `3.2.1-3.2.9_PLAN.md` (run #7, 5.B2/7.B4/8.B7/8.B9/9.B5, kotvy) a `DEFERRED_3.2.md` (G8 #7, cert, QTC OFF, Next 16.4.3). |
| 2026-11-07 | v1.14 — read-only EDGE audit: G8 #7 do 6. 12. (run #6 stopped/evidence_incomplete), Next major upgrade hotový, proto 32 v repo/app/net ve shodě. Doplněna přednost aktuálního snapshotu a fronta bezpečnost/observability/release: orderId PII, EDGE1 exporter down, payout queued ts:null, sklad, verifier/provenance. Žádné produkční akce, aktivní run nezměněn. Detailní důkazy a hranice v REPORT_2026-11-07_EDGE_AUDIT_AUTONOMOUS.md. |
| 2026-10-31 | v1.0 — vytvořeno po hloubkové revizi (plánové docs v3.3 + živé sondy EDGE i EDGE2). Zamčena 3 rozhodnutí 👤: RC kvalita first; HA dokumentovat + aktivovat. W0 truth-sync proveden. |
| 2026-10-31 | v1.1 — **revize rozhodnutí o mrtvých površích po živých sondách**: `api.` a `dex.` nejsou mrtvé — obě služby běží na EDGE2 (`zion-hiran-gateway` :8007, warpd :8454) a DNS míří chybně na EDGE. 👤 rozhodl: `api.` **publikovat**, `dex.` **doplnit `/prices/:token/history`** + publikovat, `updates.` DNS smazat. Opraveno §1.4, §1.5, §2 #5, §3 T0.8, §4 řádek 6. |
| 2026-10-31 | v1.2 — T0.8 implementace: `/prices/:token/history` napsán (`V31/L2/multichain/src/pricing.rs`, 14 testů, `db/service/server` rozšířeny), vhost `dex.` staged na EDGE2 (úzký povrch), `api.` vhost staged. Nový rozpor **#13** — `RecentSwaps`/`TransactionStatus` volají neexistující `/swaps` routy (mrtvý kód, konzument se nerenderuje). |
| 2026-10-31 | v1.3 — **korekce `updates.`**: raw zóna `infra/dns/zionterranova.com.zone` **nemá žádný explicitní `updates` A záznam** — doména se resolvuje přes wildcard `*` → EDGE, takže „smazat DNS" = není co mazat; uzavře se flipem wildcardu (fáze 2). Přidána §**Fáze 3** do [`infra/dns/zionterranova.com.zone.md`](../../infra/dns/zionterranova.com.zone.md) s přesným diffem pro 👤 (`api` A → EDGE2, nový `dex` A → EDGE2). QTC backlog `stalled=1751`, `treasury_free=0` (roste, dřív ~918). |
| 2026-10-31 | v1.4 — **W2.4 korekce + W2.4b uzavřeno živě.** Původní „RPO ≤15 min" bylo nepodložené: naměřeno **PPLNS + payout ledger ≤ 60 s**, `pool-store.db` ≤ 60 min (60min timer). DR runbook vznikl jako `DR-BRINGUP-RUNBOOK.md`, ne `POOL-HA-RUNBOOK.md`. Live uzavřeny **B1/B2/B3/G5**: standby unita pinuje paritu 8 explicitními flagy, payout klíč přenesen pipe (sha256 shodný s primárem), standby binárka byte-identická s primárem (`build fdeda709a`), a opraven **bug v gate** (četl jen první řádku multi-line `ExecStart` → maskoval divergenci `api-bind` a hlásil falešné nesetové `state path`/`store db`). Výsledek: **`PASS (0 fail, 5 warn)`**, zbylé WARN = B4/B5 procesní kroky promotu. Commit `0bb706737`. |
| 2026-11-01 | v1.6 — **W0 closeout (Fáze A):** rozpry #3/#11/#12/#13 uzavřeny (node enabled ověřeno přes SSH; ROADMAP.md G8 texty aktualizovány na run #6; AGENTS.md public/ sekce přepsána na curated export; rozpr #13 již smazán 1. 11.). W1.1 provenance baseline refresh → `docs/3.2/DEPLOY-PROVENANCE-2026-11-01.jsonl` (edge sha `c14f1e4d9`, edge2). W1.2 alert rules `ZionPoolPayoutStale`/`ZionPoolStatsApiUnresponsive` ověřeny v aktivním `/etc/prometheus/rules/zion_writepath.rules.yml`. KS-2 posunut (zbylé ⬜: #5 DNS publish, #10 Next unifikace). |
| 2026-11-01 | v1.7 — **Kanonizace (truth-sync audit):** ověřeno proti živým sondám/SSH: #4 HA = alert-only (anti split-brain, fencing G11 otevřené, armed mód neexistuje v kódu); #5 DNS = vhosty na EDGE2 enabled, cert neexistuje, DNS → EDGE; #8 backups = retenční politika hotová (42 daily + 4 weekly + orphan sweep), disk 44 %; #10 Next = 14 vs 16 potvrzeno; W1.1/W1.2 ✅; W1.3 ✅ (DR runbook, fencing otevřené); W1.4 🔄 (linux only, bez BUILD-INFO, bez windows/macos); W1.5 🔄 (pin zastaralý); W3.1 P0-3 = otevřený (sdílený env). QTC treasury deficit potvrzen (treasury_free=0, stalled roste). Pool wallet balance neověřeno. |
| 2026-11-01 | v1.8 — **Autonomní closeout (Fáze B část):** W1.5 ✅ (audit package pin → `aa6599cce`, Generated 2026-11-01). W1.4 🔄 (BUILD-INFO.txt přidán do `dist/v3.2.0-rc-w1.4/`, SHA256SUMS aktualizován; windows/macos/EDGE rebuild zůstává). W4 K3 migrační plán vytvořen: [`docs/3.2/NEXT14_TO_16_UNIFICATION_PLAN.md`](../3.2/NEXT14_TO_16_UNIFICATION_PLAN.md). KS-2 stále nesplněno (#5 DNS publish 👤, #10 Next unifikace W4). |
| 2026-11-01 | v1.9 — **Kanonizace W2/W3:** W2.2 fencing = audit dokončen (REPORT_2026-10-31_W2.1-W2.2_POOL_HA_FENCING.md, 5 guardrailů navrženo, implementace otevřená G11). W2.6 = armed mód neexistuje v kódu — promote je manuální. W3.1 P0-3 = příprava hotová (P0-3-SHARED-ENV-AUDIT.md + REPORT), rotace = 👤. W3.4 (pool wallet funding), W3.5 (QTC treasury), W3.3 (SMTP), W3.6 (gas) = 👤-gated, neověřeno. |
| 2026-11-01 | v1.10 — **W1.4 windows pokus:** `cargo check` PASS, `cargo build --release --features gpu-opencl` selhal na `-lOpenCL` (mingw ICD loader nedostupný). CPU-only varianta (bez gpu-opencl) spuštěna v background. Macos target nainstalován, build nezkoušen. Zbývá: windows OpenCL SDK, macos build, EDGE rebuild z RC commitu, embedded ZION_GIT_SHA. |
| 2026-11-01 | v1.11 — **Desktop agent trať (sub-plán):** [`DESKTOP-AGENT-COMPLETE-PLAN.md`](DESKTOP-AGENT-COMPLETE-PLAN.md) v1.1 — VIP + Public editions, one-click, build matrix, jednorázová licence, autoupdate, BOOST vždy on (QTC/PRL → grow/liquidity, uživatel jen ZION). **D0 hotovo:** VIP bez `public_build`, `apps/public-miner` přesunut z archivu, `--edition vip|public`. **Update server** přesunut `archive/update-server` → `apps/update-server`; `updates.` se **nemaže** — bude publikován pro VIP autoupdate. Macos aarch64 + Windows CPU-only miner buildy hotové. |
| 2026-11-01 | v1.12 — **Ekosystémové změny zapracovány do desktop plánu §13:** MarketPlace time-boxed token kampaně (`6ad1d4e0f`, 144k ZION do 24. 12. 2026), shop paid-path + bonus auto-payout + CLI 3.2.0 fix (`a7b083d92`), rasta e-maily (`3ec2900d9`), Hiran Sun portál nirvana (`906f3ee8f`, `/api/hiran` proxy, 46–59 fps), VR test (1M ZION, block 104061). Desktop artefakty: VIP mac DMG 187 MB, Public mac DMG 146 MB, Windows CPU-only binárky, revenue dashboard live (11 BOOST coinů, 12,3 PH/s). |
| 2026-11-01 | v1.5 — **Rozpor #13 vyřešen smazáním** (mrtvé DEX UI trio `ZionDexDashboard`/`RecentSwaps`/`TransactionStatus` — žádný konzument mimo sebe, `/swaps` routy v `warpd` neexistují a nedoplňují se; reálné swapy půjdou přes V3 `tx_hash` po K2). **6.B4 DeSci implementováno**: `zion-issobella` += `papers`+`anchor_batches` tabulky, `anchor.rs` (memo-direct `ISSPAPER:v1:` / merkle-batch `ISSANCHOR:v1:`, GRANDPA finality wait, reorg-safe confirm přes sentinel UTXO+block scan), 6 REST rout (papers CRUD/proof/publish + `/api/v1/anchor/run`, admin fail-closed na `ISSOBELLA_API_KEY`), 23 testů ✅. Website: proxy `/api/issobella/*` + stránka `/l6-issobella/papers`. Aktivace anchoru = 👤 (potřebuje `ISS_ANCHOR_KEY`/`ISS_ANCHOR_ADDRESS` custody + sentinel adresu — peníze/klíče). |
| 2026-11-01 | v1.13 — **Kanonizace code vs doc (uzavření hlavičky + plošný audit):** hlavička dokumentu byla stale (1.1 proti logu 1.12) → zarovnáno. Plošný audit plán/NIRVANA/docs↔kód: **rovnice drží** (proto v2, hry 4, KingdomPortals 8, avatars 200/id 0–202, `EARTH_ORBIT_R=30`, `30·AU^0.55`, pool v13, `/api/ops` incl. provision/job, anchor memos+routy, pass_store camelCase). **Opraveno:** AGENTS.md workspace `3.1.0-beta`→`3.2.0` (2 aktivní řádky) + AppPay „update-server není v repu“ (od v1.11 je); REPO-MAP apps 12→14 + nové řádky `Kingdom/`, `nirvana`, `nirvana-net`, `infra/maintenance/`, re-měření (16 382 tracked); StatusV3 doplněn blok 2026-11-01 (zion-nirvana-net, Kingdom, maintenance 503, ops F1–F2.3, 6.B4 pending klíče). **Zaznamenáno, neměněno (snapshot data):** bran 14→15 (dynamické), testy 34/21→36/22, `anchor.rs` ~560→758 LOC, world „#411“→string id `NIRVANA`, mrtvý SHA `374548faf`. Root reporty SHOP_E2E + LOCAL_BROKEN_UNITS přesunuty do `docs/3.2/REPORTS/`. |
