# ZION v3.3 „NIRVANA" — KRÁLOVSTVÍ SRDCE
## Kanonický plán postupu

> **Verze dokumentu:** 1.1 · **Datum:** 2026-10-31 · **HEAD při sepsání:** `fdeda709a` (4.B1)
> **Role:** **jediný vstupní bod** pro plánování v3.3. Není to 14. plán, který si každý vykládá jinak — je to router: říká, co platí, v jakém pořadí, s jakým důkazem a kdo to vlastní. Ostatní dokumenty zůstávají v platnosti, tento je **cituje a opravuje, neduplikuje**.
> **Hierarchie pravdy:** živý kód/sonda → [`canon/books/MiseAmenti/07-Registr-Dukazu.md`](canon/books/MiseAmenti/07-Registr-Dukazu.md) → [`docs/3.2/StatusV3.md`](docs/3.2/StatusV3.md) → tento plán → [`NIRVANA-V3.3-MAP.md`](NIRVANA-V3.3-MAP.md) / [`NIRVANA-V3.3-CHECKLIST.md`](NIRVANA-V3.3-CHECKLIST.md) / [`NIRVANA-V3.3-UNIFICATION.md`](NIRVANA-V3.3-UNIFICATION.md) → [`docs/3.2/V33_NIRVANA_MASTER_PLAN.md`](docs/3.2/V33_NIRVANA_MASTER_PLAN.md) (vision).
> **Značky vlastníka:** 🤖 autonomní (kód/testy/dokumenty end-to-end) · 🔀 autonomní příprava + operátorské schválení · 👤 operátor (rozhodnutí, peníze, klíče, fyzický svět)

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
| `updates.` | EDGE | **404** | skutečně mrtvé — `update-server/` jen v `archive/`, nic neběží, mobile = preview. DNS smazat |
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
| 1 | `NIRVANA-V3.3-CHECKLIST.md`, `MAP §6` | G8 run **#5**, 99,733 %, konec 24. 11. | run **#6** `g8-20261029T234617Z`, 99,7976 %, konec 28. 11. 23:46Z, 1 incident 240 s | přepsat všechny 4 výskyty | 🤖 | ✅ |
| 2 | `AGENTS.md`, `StatusV3.md` | mlčí o minerálních zátěži na EDGE | 8 mining threadů na 4 jádrech, ~230 % CPU | zdokumentovat **proč** je to záměr (pool liveness / block production) | 🤖 | ✅ |
| 3 | `systemd` EDGE2 | node = primary, ale `disabled` | implicitní `WantedBy=zion-v31-multichain` + `zion-v31-pool` (pool na EDGE2 disabled) → křehké po rebootu | `systemctl enable` + explicitní `WantedBy=multi-user.target` | 🔀 | ⬜ |
| 4 | `CHECKLIST` N0, `MAP §7` | HA stratum „nerozhodnuto" (2.S5) | EDGE2 **má** `zion-pool-standby` + 3 timery (30 s / 60 s / 60 min), inactive, nedokumentované | zdokumentovat a **oficiálně aktivovat** (rozhodnutí 👤 31. 10.) | 🤖→🔀 | ✅/🔄 |
| 5 | `AGENTS.md` topologie | web-tier cutover hotový | `explorer.` a `nirvana.` zůstávají na EDGE; `api./updates./dex.` = TLS SAN mismatch (DNS na EDGE, služby na EDGE2) | **revidované rozhodnutí 👤 31. 10.**: `api.` → **publikovat** (služba běží, vhost v repu); `dex.` → **doplnit `/prices/:token/history`** + publikovat; `updates.` → **smazat DNS** | 🔀 | 🔄 |
| 6 | `MAP §8`, `CHECKLIST` stav v kostce | `3.2.0-beta.1`, „Mainnet Alpha" | `V31/Cargo.toml` = `3.2.0`, node hlásí `3.2.0`, RELEASE_NOTES = „Mainnet Beta" | sjednotit na **3.2.0 = Mainnet Beta** | 🤖 | ✅ |
| 7 | root `ROADMAP.md` | „Chain height 23 640+ (2026-08-31)" | 103 595 | nahradit odkazem na `StatusV3.md`, žádné číslo v ROADMAP | 🤖 | ✅ |
| 8 | provozní realita | `/opt/zion/backups` nedokumentováno | 42 G ze 101 G | retenční politika + úklid `beta-build-20261026`, `canonical-main` | 🤖 návrh → 👤 apply | ✅/🔄 |
| 9 | repo hygiena | `apps/` obsahuje artefakty | `website-v2.9-backup-*.tar.gz` 30 MB, `public_html`, untracked `desktop-agent/resources/node` | přesun do `archive/`, `.gitignore` | 🤖 | ✅ |
| 10 | `apps/*/package.json` | jedna generace Next | 14 (IntroPage, MarketPlace, pool-ui) vs. 16 (nirvana, OasisWeb, website-v2.9) | K3 ve W4 | 🤖 | ⬜ |
| 11 | `docs/3.2/ROADMAP.md` | G8 „run #2 not started" | runy #2–#5 uzavřené, #6 běží | opravit | 🤖 | ⬜ |
| 12 | `REPO-MAP.md`, `AGENTS.md` | `public/` = git subtree | tracked `public/` přesunut do `archive/PUBLIC/` | přepsat G4/E7 workflow | 🤖 | ⬜ |
| 13 | `apps/website-v2.9/src/components/dex/*` | DEX UI je živé | `RecentSwaps.tsx` volá `${ROUTER_URL}/swaps?limit=10`, `TransactionStatus.tsx` `/swaps/:id` — **v `warpd` tyto routy neexistují** (legacy ZionDex Router surface). `ZionDexDashboard` (jejich jediný konzument) se v `app/` **nikde nerenderuje** → mrtvý kód. Živý povrch je jen `PriceChart` (`/market` ř. 1637). | W4 K3: buď routy doplnit, nebo komponenty smazat při unifikaci DEX UI | 🤖 | ⬜ |

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
| T0.8 | EDGE2 nginx + DNS | `api.` → vhost `:8007` + cert + DNS na EDGE2 (**publikovat**, služba běží); `dex.` → vhost `:8454` + cert + DNS na EDGE2 **po** doplnění `/prices/:token/history`; `updates.` → smazat A záznam. **Stav 31. 10.: oba vhosty staged na EDGE2 (port 80, `nginx -t` OK), `/prices/:token/history` implementováno a nasazeno ve `warpd`. Zbývá pouze 👤 DNS flip + `certbot --nginx`.** |
| T0.9 | `/opt/zion/backups` | návrh retenční politiky (14 denních + 8 týdenních + 6 měsíčních?) ke schválení |

---

### W1 — RC kvalita 3.2 · 🤖 · do 28. 11. · **primární priorita**

Cíl: až G8 doběhne, být připraven na RC sign-off. Nezávislé na unifikaci.

| Úkol | Obsah | Důkaz |
|---|---|---|
| W1.1 | refresh `deploy-provenance` baseline (8.B3) na aktuální běžící binárky | `docs/3.2/DEPLOY-PROVENANCE-*.jsonl` |
| W1.2 | alert na stale block production (k `ZionPoolPayoutStale`, `ZionPoolStatsApiUnresponsive`) | rule v `/etc/prometheus/rules/` + firing test |
| W1.3 | **DR drill runbook** — bringup standby repliky; ⚠️ stop primary first (double-pay hazard) | `docs/3.2/ops/DR-BRINGUP-RUNBOOK.md`; spouští 👤 |
| W1.4 | release artifacts 9.B4: přebuild linux + windows z RC commitu, zbývá OpenCL varianta | tar.gz + `SHA256SUMS` + `BUILD-INFO.txt` |
| W1.5 | audit package refresh (pin na RC commit) | `docs/3.2/AUDIT_PACKAGE.md` |
| W1.6 | cert `auth.` renewal **před 25. 11.**, reálná (ne staging) | `openssl x509 -enddate`, certbot log |
| W1.7 | premine 144k checklist pro 👤 (27.–28. 11., 3-of-3 admin unlock + DAO) | checklist v `docs/3.2/ops/` |

**Gate W1:** G8 run #6 `gate_status=pass` 28. 11. → V33-1 splněno; žádná otevřená 🤖 položka v RC checklistu.

---

### W2 — Pool HA / DR · 🤖 příprava → 🔀 aktivace · **rozhodnuto: dokumentovat + aktivovat**

Zadání 👤 (31. 10.): stack existuje, tak ať je podporovaný a zdokumentovaný — ne rozebraný.

| Úkol | Obsah | Riziko |
|---|---|---|
| W2.1 | audit `pool-ha-watchdog.sh` — podmínky promote, chování při split-brainu, umí vrátit primary? | — |
| W2.2 | ⚠️ **fencing analýza** — 30 s interval + promote při zpomalení (ne smrti) = **dvojí výplata**. Podmínka aktivace: promote jen po prokázaném failu + explicitní stop primary, nebo fencing token | **nejvyšší riziko plánu** |
| W2.3 | dokumentace: `AGENTS.md`, `StatusV3.md`, `infra/RUNBOOK.md`, nový `docs/3.2/ops/POOL-HA-RUNBOOK.md` | — |
| W2.4 | RTO/RPO tabulka — RPO ≤15 min (DR replikace potvrzena), RTO dle zvoleného režimu | — |
| W2.5 | doplnit `pool_standby` do G8 `evidence_policy.required_services` — **mimo aktivní run** (změna schématu) | — |
| W2.6 | staged activation: `log-only` (watchdog jen loguje) → 👤 flip na `armed` | — |

**Gate W2:** HA runbook schválen 👤 + fencing podmínka doložena testem + alespoň 1 týden `log-only` bez falešného promote.

---

### W3 — Bezpečnost a peníze · 🤖 příprava + 👤 akce

| Úkol | Obsah | Kdo |
|---|---|---|
| W3.1 | **P0-3 credential isolation** — sdílený `edge-environment.sh` = každá V31 služba vidí cizí credentials. Rozdělit na per-service env subsety + rotace. **Nejvyšší bezpečnostní dluh.** | 🤖→👤 |
| W3.2 | secret scanner jako povinný gate (public export scan už má 0 FP) | 🤖 |
| W3.3 | SMTP / Resend — emaily nechodí (wallet-seed zachránitelný z DB) | 👤 |
| W3.4 | dofinancovat pool wallet — loyalty výplaty, balance 0 | 👤 |
| W3.5 | QTC deferred ~918 — treasury | 👤 |
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
| 2 | **QTC deferred ~918** | V33-9 | ⬜ |
| 3 | **Pool wallet funding** | loyalty výplaty | ⬜ |
| 4 | **SMTP / Resend** | emaily, seed recovery | ⬜ |
| 5 | **P0-3 rotace** | bezpečnostní dluh | ⬜ |
| 6 | Osud `api./updates./dex.` | V33-8 | ✅ rozhodnuto 31. 10. (revidováno po živých sondách — viz §2 #5) |
| 7 | HA vs. single pool (2.S5) | W2 | ✅ rozhodnuto 31. 10. |
| 8 | **Premine 144k** (27.–28. 11.) | 1.S3 | ⬜ |
| 9 | Veřejný launch date | G8 PASS + G9 | ⬜ |
| 10 | Retenční politika `/opt/zion/backups` (42 G) | disk EDGE 70 % | ⬜ |

---

## 4. Kritická cesta

```
31.10 ─► W0 truth-sync + DNS příprava (1–2 dny)                       🤖
             │
             ├─► W1 RC kvalita ────────────────────────────┐           🤖
             │    provenance · alerty · DR runbook ·       │
             │    artefakty · audit package · cert          │
             │                                              ▼
25.11 cert auth. ═══════════════════════► 28.11 G8 #6 KONEC ══► RC sign-off 👤
             │                                              │
27–28.11 premine 144k 👤 ══════════════════════════════════┤
             │                                              ▼
             ├─► W2 HA log-only ──► armed 👤 ──► W3 P0-3 👤
             │
             └─► W4 design (read-only) ─► po RC: K1 impl ─► W5 flip 👤
```

**Tři nezávislé kotvy se sbíhají do 27.–28. 11. 2026** a ani jedna není 🤖:

| Datum | Událost | Důsledek |
|---|---|---|
| 25. 11. | expirace certu `auth.` | renewal musí proběhnout **dřív** → W1.6 do 24. 11. |
| 28. 11. 23:46Z | konec G8 run #6 | V33-1; bez PASS není RC sign-off |
| ~27.–28. 11. | výška 144 000 — time-lock premine slotů 6–8 | utratitelnost dál jen 3-of-3 admin unlock + DAO (1.S3) |

**Proto W1 končí 24. 11., ne 28. 11.** Poslední čtyři dny okna jsou rezerva na 👤 sign-off a na to, co se posere.

---

## 5. Akceptační kritéria

| ID | Kritérium | Důkaz |
|---|---|---|
| **KS-1** | G8 run #6 ≥ 99,9 % do 28. 11. | `g8_run.json` → `gate_status=pass` |
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
| 2026-10-31 | v1.0 — vytvořeno po hloubkové revizi (plánové docs v3.3 + živé sondy EDGE i EDGE2). Zamčena 3 rozhodnutí 👤: RC kvalita first; HA dokumentovat + aktivovat. W0 truth-sync proveden. |
| 2026-10-31 | v1.1 — **revize rozhodnutí o mrtvých površích po živých sondách**: `api.` a `dex.` nejsou mrtvé — obě služby běží na EDGE2 (`zion-hiran-gateway` :8007, warpd :8454) a DNS míří chybně na EDGE. 👤 rozhodl: `api.` **publikovat**, `dex.` **doplnit `/prices/:token/history`** + publikovat, `updates.` DNS smazat. Opraveno §1.4, §1.5, §2 #5, §3 T0.8, §4 řádek 6. |
| 2026-10-31 | v1.2 — T0.8 implementace: `/prices/:token/history` napsán (`V31/L2/multichain/src/pricing.rs`, 14 testů, `db/service/server` rozšířeny), vhost `dex.` staged na EDGE2 (úzký povrch), `api.` vhost staged. Nový rozpor **#13** — `RecentSwaps`/`TransactionStatus` volají neexistující `/swaps` routy (mrtvý kód, konzument se nerenderuje). |
