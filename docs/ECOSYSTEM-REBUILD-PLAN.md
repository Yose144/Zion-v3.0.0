# ZION Ecosystem — Plán přestavby a sjednocení

> **Status:** návrh ke schválení (2026-10-22), podložený `docs/ECOSYSTEM-INVENTORY.md` (měřená fakta, ne odhady). Cíl: jeden kanonický celek — infrastruktura, repo, weby i deploye pod jedním organizačním principem. Zachováváme Rasta design, ZIS (již SSO pro všechny `*.zionterranova.com`), mockupy i kanon.

---

## 0. Shrnutí diagnózy (z inventáře)

**Křehké místo dneška:** veřejný request jede `DNS→edge nginx→SSH tunel→edge2:3000`. Tunel je jediná `ssh -N` session (18 forwardů); když spadne, celý web je down — flap pozorován 22.10. Deploy skript hlavního webu navíc **cílí na mrtvý box** (`zion-post-wipe` = old edge, kde `zion-website.service` je retired). Přitom `rpc.zionterranova.com` už jede **přímo** na edge2:9445 — precedens přímého obsluhování existuje. *(Oba body vyřešeny F1 + F5-retarget 2026-10-24.)*

**Roztrhanost:** 30+ top-level dirs v repu, 12 DNS subdomén, 3 pool povrchy, 3 OASIS povrchy, 2 dashboardy, PUBLIC/ klon vs public/ subtree, newearth.cz na stejném boxu, deploy skripty s různými targety.

---

## 1. Cílová architektura

### Box role (po přestavbě)

```
EDGE2 (207.180.217.100) — PUBLIC + APP + DATA hub
──────────────────────────────────────────────
nginx :80/:443 + certbot          ← jediný TLS endpoint
├─ app.zionterranova.com    → :3000 (web)
├─ zionterranova.com        → /var/www/intro (static)
├─ oasis.zionterranova.com  → /var/www/oasis + :8094/8095
├─ freeworld.zionterranova.com → :3000
├─ auth.zionterranova.com   → :8096 (ZIS — už tu běží!)
├─ pool.zionterranova.com   → /var/www/pool + pool-api
├─ market.zionterranova.com → :3100
├─ rpc.zionterranova.com    → :9445/:9944 (už jede přímo!)
├─ dashboard.zionterranova.com → :8779 (IP allowlist)
└─ grafana.zionterranova.com  → :3001 (pokud přesuneme)

:3000 web · :3100 market · :8096 ZIS · :9445 L1 · :5432 pg
:8094-8098 L5/L6 daemony · :8456 dao · :8453/4 warp
:8332-4 bitcoind · :9944/9615 quantus · :44107 pearld · :8477 gw
:8001 ai-native · :8002 hiran-inference

EDGE (62.171.141.136) — CHAIN/MINING tier (interní)
──────────────────────────────────────────────
zion-v31-pool :8080/:8444/:8445 (stratum — těžaři!)
zion-v31-node2/3 :8336/:8337 (followers)
prometheus+grafana :9090/:9093/:3001 · g8 · vastctl
zion-fallback-miner · bitcoin-regtest
/var/www/zion-miner (binárky) · /var/www/downloads
backup timers · rig-output :9999 · rig tunel :8322,:8003

JEDINÉ potřebné tunely po přestavbě:
  edge2→edge :8080 (pool API pro web) + edge:8003 (rig LLM)
  = 2 forwards místo dnešních 25
```

### Kanonický repo layout

```
/                                    repo root
├── apps/                            všechny deployable appky
│   ├── web/                         ← apps/website-v2.9
│   ├── intro/                       ← apps/IntroPage
│   ├── oasis/                       ← apps/OasisWeb
│   ├── marketplace/                 ← apps/MarketPlace
│   ├── pool-ui/                     ← apps/pool-ui
│   ├── identity/                    ← apps/identity (ZIS)
│   ├── desktop-agent/               ← apps/desktop-agent
│   ├── mobile-app/                  ← apps/mobile-app
│   ├── wallet-sdk/                  ← apps/zion-wallet-sdk
│   └── shared/                      ← apps/shared (+ nový ui kit)
├── chain/                           ← V31/ (L1–L6; interní jména v kódu zůstávají)
├── canon/                           ← canon/books/ (knihy)
├── docs/                            dev docs, plány, inventář
├── infra/                           kanonizovaná infrastruktura
│   ├── nginx/                       vhost per doména (jediný zdroj pravdy)
│   ├── systemd/                     unit templaty
│   ├── deploy/                      deploy-<app>.sh (jedno rozhraní)
│   ├── env/                         env templaty (secrets mimo repo)
│   ├── INVENTORY.md                 ← přesun sem z docs/
│   └── RUNBOOK.md                   deploy/restart/diagnostika/rollback
├── data/                            L2data–L6data, L5Projects (konsolidace)
├── releases/                        veřejné artefakty (miner balíčky)
└── archive/                         V3, WarpBeta, BACKUP, backups/*, logs/*,
                                     public_html→newearth repo?, PUBLIC/ klon,
                                     website-v2.9-backup tarball, dashboard/?,
                                     edge-deploy/, AuXpow/, venv-hiran/,
                                     src/lib.rs zbytek
```

### Veřejný povrch — sjednocená IA

```
zionterranova.com (static intro)  →  "Vstoupit" → app.
                                              ↘ docs. (bílé papíry?)

app.zionterranova.com — jediná Next app, 7 kanonických sekcí:
  Síť    /network   ← sloučit /explorer + /pool + /network + /monitoring + /miner-stats
  Těžba  /mining    ← /mining + /download + /node-setup + pool connect
  Trh    /market    ← /multichain + /dex + /ziondex + /swap + /defi + market app
  DAO    /dao       ← /dao + /dashboard(/dao/*) + treasury
  Příběh /maitreya  ← /maitreya + /nirvana + /surta-srdce + /kralovstvi-srdce + /terranova + /genesis + /philosophy + /whitepapers
  Svět   /world     ← /l5-free-world + /terranova uzly + freeworld portál
  Docs   /docs      ← stávající Doc Link Engine reader

Přesměrovat sirotky: /roadmap-295→/roadmap, /wiki→/docs, /onboard→/mining,
/dashboard/*→/network (kde public), /warp→/market atd.

oasis.zionterranova.com   OASIS portál (hra) — sdílené chrome + ZIS cookie
freeworld.zionterranova.com L5 portál — proxy do /world sekce
pool.zionterranova.com    → ✅ ROZHODNUTO 2026-10-24: NEredirect — oba povrchy (public portál + in-app /pool dashboard) zůstávají
market.zionterranova.com  → zůstane samostatná app? (otázka §4)
auth., rpc., grafana., dashboard. — servisní subdomény (nezasáhne IA)
```

---

## 2. Fáze (s detaily z inventáře)

### F0 — Inventarizace ✅ HOTOVO (tento dokument + INVENTORY.md)

### F1 — Web tier na edge2 ✅ HOTOVO (2026-10-22)

**Proč:** −1 hop na každý request, eliminace SSH-session SPOF ve veřejné cestě, TLS u aplikace.

**Provedeno:**
1. ✅ `infra/nginx/` — `edge-current/` baseline snapshot + `edge2/` 9 vhostů + `catchall.conf`; všechny proxy → lokální porty (žádný tunel v request cestě)
2. ✅ edge2: nginx 1.24 + certbot 2.9; ufw :80/:443 otevřeny; `/etc/letsencrypt` přeneseno (11 certů)
3. ✅ Statické weby na edge2: `/var/www/zion-maintenance` (441M apex intro), `/var/www/oasis`, `/var/www/pool`, `/var/www/freeworld`, `/var/www/zion-miner` (3.3G), `/var/www/downloads`
4. ✅ `/zion-miner/` + `/downloads/` = lokální aliasy; `/rig-output/` = přechodný proxy → Edge (rig logger tam žije)
5. ✅ Rate-limit zóny `conf.d/rate-limit.conf` načtené; http2 sjednoceno na všech :443 (žádné warnings)
6. ✅ **Certbot renew dry-run: všech 8 zionterranova certů SUCCESS** (apex webroot + nginx auth ověřeny); `dashboard`+`newearth` renewal na edge2 `.disabled` (jejich DNS = Edge, renewal patří tam)
7. ✅ **DNS switch proveden** — 9 explicitních flipů (apex/www/app/auth/freeworld/market/oasis/pool/rpc) → 207.180.217.100; wildcard zůstává na Edge (ops subs)
8. ✅ Live smoke: všech 9 domén 200; ZIS `/health`, app `/api/health` (node 91942+pool), oasis `/health`, freeworld API data, pool `/public/v1/blocks` live, rpc JSON-RPC; nginx error.log čistý

**Zbývá (F1 residual, není blocker):**
- chain-tunel legs na edge: :3000/:3100/:8096 už edge nepotřebuje pro web — redukovat až po stabilizaci
- `zion-maintenance` 441M audit (proč tak velké?)
- Edge nginx vhosty = fallback, vypnout až ve F6

**Rollback:** DNS 9 záznamů zpět na `62.171.141.136`; edge vhosty živé. **Rollback window ≈ do 25.11.2026** (expirace auth certu na Edge — edge už flipnuté domény nepřeobnoví, http-01 jde na edge2).

### F2 — Repo reorganizace

Per-adresář `git mv` (zachová historii), od nejjednoduššího:

1. **archive/ konsolidace:** `V3/`, `WarpBeta/`, `BACKUP/`, `backups/` (16G! rozhodnout: ven z repa), `logs/`, ~~`PUBLIC/`~~ (**hotovo 2026-10-24: →`archive/PUBLIC/`**), `venv-hiran/`, `website-v2.9-backup-*.tar.gz`, `AuXpow/` (posoudit), `src/lib.rs` (1 soubor — smazat/zařadit), `dashboard/` (pokud nahrazeno ZION_OS/dashboard), `config/` (1 soubor)
2. **apps → apps/:** postupně per app; u `website-v2.9` opravit cesty v deploy skriptech + AGENTS.md + `next.config.ts` assetPrefix pokud existuje
3. **V31 → chain/:** jen adresář (crate názvy zůstávají `v31-*` — rozhodnout §4.4)
4. **docs/WP-Mainet → canon/books/:** přesun knih; ~100+ odkazů k přepsání (README, AGENTS, docs/3.2, .gitignore, pdf skripty) — dedikovaný commit
5. **infra/:** sesbírat `edge-deploy/`, deploy skripty z `apps/*/deploy/`, systemd unity ze `ZION_OS/infra/systemd/`, nginx z repa `V31/deploy/nginx/`
6. **canon/l*/:** `L2data`–`L6data` + `L5Projects` jsou kanon/dokumenty + source artwork, NE runtime data → `canon/l2..l6` (**provedeno v batch 1**); `data/` u kořene = untracked runtime DBs, zůstává; `LOGO/` → `canon/brand/` (**provedeno batch 2**)

**F2 batch 1 ✅ (2026-10-22):** `L2data`→`canon/l2`, `L3data`→`canon/l3`, `L4data`→`canon/l4`, `L5Projects`→`canon/l5`, `config/`→`archive/config/`; fixnuto: `freeworld/tools/images.py`, `freeworld/AGENTS.md`, `BohemiaDao.md` linky.
**Batch 1b ✅:** `WarpBeta`→`archive/WarpBeta` (7 souborů opraveno).
**Batch 2 ✅:** `L6data`→`canon/l6`, `LOGO`→`canon/brand` (~30 souborů, root→root sed).
**Batch 3 ✅:** `docs/WP-Mainet`→`canon/books` — 96 souborů externě + interní `../../` úniky → `../../../docs/` + `../WP-Mainet` externí rel. linky + `.gitignore`.
**Batch 4 ✅:** loose soubory — `xmrig-vast-cpu.json`→`infra/vast/`, `warp.toml`→`infra/config/`, teamredminer zips (LFS)→`infra/mining/`, `.git_commit_msg.txt`→`archive/misc/`, 2 reporty+JSON→`docs/3.2/REPORTS/`.
**Batch 5 ✅:** `edge-deploy`→`infra/edge-deploy` (48 souborů, 2 ref fixy).
**Batch 6 ✅ (2026-10-22, `eaa919b11`):** `APP&WEB`→`apps/` — ~5000 souborů, 2075 sed-rewrites; chráněny remote `/opt/zion/APP&WEB/*` a `REMOTE_ROOT}/APP&WEB/*` (systemd WorkingDirectory, rsync targety, .env cesty = produkce nedotčena). Verifikováno: `.gitignore`, workflows (`apps/desktop-agent`), AGENTS.md public/private sekce; všech 21 residual `APP&WEB` = remote/historické. **Incident během batchu:** `git` objektová korupce (3 corrupt packy, disk write-path corruption na boxu — `/tmp`=tmpfs čisté vs `/` poškozené). Repair: mirror clone origin+public → alternates → dead refs prunuty (3 auto-stash commity, `local-changes`, `public-split-now`, 10× dependabot, 3× agent checkpoints — všechny tipy unreachable z remote, ztracené objekty zalogovány `/tmp/dead_refs_report.txt`), index rebuild přes tmpfs, packy na disk verified-copy (sha1 match). fsck clean, `main` pushed. **HW varování: zápisy na `/` se intermitentně poškozují — provider ticket/memtest doporučen.**

**Batch 7 ✅ (2026-10-22, `040d73c41`+fixy):** `tools/`→`infra/tools` (vast.ai ops) — refs fixnuty (.gitignore, AGENTS, docs); **+runtime fix:** vastctl user systemd units přepsány na nové cesty + restartovány (daemon píše status.json do `infra/tools/vast/`, push na edge webroot funguje); watchdog wrapper v `infra/edge-deploy/` = probe `../scripts` (server) ∨ `../../scripts` (repo) — funguje na obou místech; stale SRBMiner orphan z `APP&WEB/` cesty zabit (nový běží z `apps/` pod agentem).

**ODLOŽENO na F5 → vyhodnoceno a UZAVŘENO 2026-10-25 (server-runtime třída — lokální přesun mění remote layout přes whole-root rsync deploy, nebo `/opt/zion/*` je voláno přímo systemd/cronem):**
- `V31`→`chain/` — **NEDĚLAT (rozhodnutí uživatele 2026-10-22)** — rozsekává cargo/systemd/workflow/.github závislosti
- `scripts/`→`infra/scripts/` (359 souborů) — **ROZHODNUTO ZŮSTÁT:** ~40 skriptů resolvuje root přes `$(dirname $0)/..` = `/opt/zion` správně na serverech, `infra/` lokálně špatně; servery volají `/opt/zion/scripts/` přímo → move = churn bez zisku, root cesta je kanonická
- `ZION_OS/`→`infra/` — **ROZHODNUTO ZŮSTÁT:** `deploy-edge.sh` rsyncuje `${REPO_ROOT}/` celý → remote dostane `infra/ZION_OS/` místo `/opt/zion/ZION_OS/` → rozbije remote binary paths (`zion-agent`, `zionos-dashboard`)
- `V3/`→archive — ✅ **HOTOVO (2026-10-25, `d6bb9d654`):** stale kopie smazána, 3 unikátní miner utility (`opencl_diag`, `opencl_smoke`, `sha3_debug`) → `archive/V3/L1/miner/src/`; `.gitmodules` už ukazoval do archive/V3
- `BTCunlock/` — **ROZHODNUTO ZŮSTÁT:** repo refs (`apps/desktop-agent/renderer.js`, `dashboard.html` join-cmd `BTCunlock/btcunlock-worker.py`) + server `/opt/zion/btcunlock` vlastní kopie → move = ref churn za nulový zisk
- `Hiran/` (5.8G) — **ROZHODNUTO ZŮSTÁT:** live refs `V31/L3/ai-native/src/*.rs`, `V31/cli`, dashboard — případný move vyžaduje cargo+service koordinaci, mimo scope sjednocení
- untracked root dirs (`backups/`16G, `PUBLIC/`klon, `venv-hiran/`, `logs/`, `BACKUP/`, `AuXpow/`, `dashboard/`, `data/` runtime) — **ROZHODNUTO 2026-10-22: všechno zůstává v repu**, zdokumentováno v [`REPO-MAP.md`](../REPO-MAP.md) §3 (runtime/artefakt mapa + kdo je používá)
7. Aktualizovat `.github/`, `AGENTS.md`, všechny `deploy-*.sh` cesty

### F3 — Kanonizace webu

- **IA:** mapovat ~60 sekcí → 7 kanonických; redirect tabulka pro sirotky (Next `next.config.ts` redirects — mechanismus už existuje pro `/dex`→`/multichain#dex`)
  - ✅ **F3a (2026-10-22, `3ed130c0f`):** [`docs/F3-IA-MAP.md`](F3-IA-MAP.md) — kompletní mapa 130 rout→7 sekcí + 2-fázová redirect tabulka; fáze-1 redirecty nasazeny (`/roadmap-295→/roadmap`, `/wiki→/docs`, `/onboard→/mining`, `/kompas→/terranova`, `/cesta→/maitreya#cesta`), interní linky + sitemap zkanonizovány, dead in-page redirecty smazány
  - ✅ **F3d huby (2026-10-22, `2ff61b679` + e2e `4a9d8c773`):** `/market` vznikl přejmenováním `/multichain` hubu (impl `defi/page.tsx`→`market/page.tsx`, metadata→"Trh", redirecty `/multichain|/defi|/dex*|/ziondex|/swap|/bridge|/warp`→`/market[#*]`); `/world` hub nově vytvořen (L3/L4/L5/L6 + TerraNova + Ekam + AI Native) + nav položka + sitemap; build+typecheck OK
  - ✅ **F3 residual ROZHODNUTO (2026-10-24):** žádné další redirecty — zbývající stránky = obsahové sub-stránky (precedent /l*); nav: `/network` += children (`/monitoring`, `/g8`, `/miner-stats`), layers_group += `/ai-native`; všechny "K posouzení" otázky v mapě uzavřené
- **Design tokens → `apps/shared/ui`:** ~~gold `#ffd700`…~~ *(plánovaná paleta se v appkách nevyskytuje — kanon = rasta)* `.zion-*` classy + brand sloty
  - ✅ **F3b (2026-10-22, `b31349ba6`):** `apps/shared/ui/` vytvořeno — `tokens.css` (canonical superset z website-v2.9: zion-gold/purple/cyan/blue sloty = rasta, `cyber`+`matrix-light` themy, radius/surface/shadow) + `tailwind.preset.cjs` (TW3) + `tokens.ts`; **pool-ui = první consumer** (preset+import, drift `#078930`→`#066928` konvergován, build OK)
  - ✅ **F3b2 (2026-10-22):** napojeni zbývající consumeri — **IntroPage** (preset+import, 48 str. build OK), **MarketPlace** (preset+import, drift `#078930`/`#0f172a`→kanon v config+globals, 28 str. build OK), **OasisWeb** (import+`#078930`→`#066928`, 13 str. build OK; pre-existing missing `@simplewebauthn/browser` doinstalován)
  - website-v2.9 = referenční zdroj (hodnoty identické, `@layer` riziko → zůstává autoritativní kopie); MarketPlace `rainbow-card` geometrie diverguje → řeší chrome extrakce (F3c)
- **Chrome:** sdílené Navigation/Footer/FloatingUtilities komponenty (dnes zkopírované per app?)
  - ✅ **F3c rasta-nav (2026-10-22, `9cf440f0d`):** `apps/shared/ui/rasta-nav.css` = kanonický superset — MP/IP nav-core (ty dvě kopie byly identické) + pool-ui extras (`mobile-close`, `mobile-backdrop`); breakpoint sjednocen na **868px** (pool-ui 1100px→868px); `cart/lang/wallet/orbs/hero` zůstávají lokální per-app; IntroPage (PageLayout+VzestupNav), pool-ui, MarketPlace importují shared soubor; buildy OK
  - ✅ **Rozhodnuto (2026-10-24):** website-v2.9 `Navigation.tsx` = **separátní chrome, NE migrovat** — rasta-nav je CSS framework pro statické navi (IP/pool-ui/MP), Navigation.tsx je 587L React komponenta (dropdown children, useLang, route-aware); jiné vrstvy, migrace = rewrite za marginální gain. Sdílený Footer + i18n unifikace = nice-to-have, ne blocker. `src/lib.rs`+root Cargo.toml = záměrný meta-package stub → zařadit. `AuXpow`/`BACKUP`/`dashboard`/`venv-hiran`/backup tars = neexistují (vyřešeno dřív).
- **ZIS:** canon — rozšířit session na všechny portály (cookie `.zionterranova.com` už je); pool-ui přidat ZIS (má už simplewebauthn dep)
  - ✅ **Ověřeno (2026-10-22):** ZIS už běží na všech portálech — pool-ui má vlastní `lib/zis.ts` + `auth.tsx` + `AuthButton` (same-origin `/api/auth/*` proxy → ZIS, sdílená `zion_session` cookie na `.zionterranova.com`), MarketPlace `zis-client.ts` + `api/auth/[...zis]`, OasisWeb `AuthContext` + webauthn, website-v2.9 plná integrace; IntroPage = statický intro (link na login)
- **Copy audit:** CS+EN parita, žádné interní názvy (V31, ZionStart, PoC-lab…), `npm run check:links --strict`
  - ✅ **Sweep interních názvů (2026-10-22):** čistý — žádné `V31|ZionStart|PoC-lab|HiranV2|edge-deploy|/opt/zion|server IP` v user-facing copy napříč 5 appkami (jen code komentáře + veřejné názvy `ZION v3.2.0`, `Hiranyagarbha`, `L3 Hiran` lore); CS/EN parita spot-check OK
  - ✅ **CS/EN parita (2026-10-22):** systematický scan — 0 souborů s nerovnováhou `cs:`/`en:` copy klíčů napříč 5 appkami
  - 🔧 **F3f triáž (2026-10-24):** 390→**383** dead links po opravě 7 cross-book odkazů (`../Maitreya/EPILOG.md`×4 → `books/maitreya/kapitoly/epilog.md`, `../nirvana/00-README*`×3 → `books/nirvana/kapitoly/`). **Zbývající 383 = ne mechanický úkol:** ~200 interních repo-referencí (3.2 plány, L1/L2 zdrojáky, `canon/` cesty, SECURITY_DISCLOSURE záměrně nepublikovaný) → muted non-link je **správné** chování; ~170 chybějící obsah (Ruze book, `PART_*`/`LEVEL_*` kapitoly, `whitepaper.pdf`, pilots/) = content gap, editoriální rozhodnutí per-item (publikovat vs. přepsat text); ~10 adresářových odkazů. Basename-match test: 0 unikátních cílů → žádný bezpečný bulk-rewrite. Copy pass = per-file review, ne sed job.
  - 📊 **Naměřeno (2026-10-22):** 780 souborů — převážně repo-interní cesty (`../../3.2/*`, `../L1/*`, `../Ruze/*`, `LEVEL_*`, `PART_*`) v publikovaném `public/docs/` korpusu; live web degraduje gracefuly (docLinks resolver → muted non-link, ne 404). Log: `docs/3.2/REPORTS/check-links-2026-10-22.txt`

### F4 — Konsolidace překryvů (naměřené duplicity)

| Duplicita | Rozhodnutí |
|---|---|
| `/pool` + `apps/pool-ui` + `/var/www/pool` + `pool.zionterranova.com` | ✅ **ROZHODNUTO 2026-10-24: oba zůstávají** — pool. = veřejný portál, `/pool` v appce = in-app dashboard (7 tabů vč. QTC/PRL) |
| `OasisWeb` (3D) + `/var/www/oasis` + `/l4-oasis` v hlavním webu | ✅ **již tak je (2026-10-24 ověřeno):** `/l4-oasis` (803 ř.) = landing → `oasis.zionterranova.com` portál |
| `market.` app + `/multichain` + `/dex` + `/ziondex` + `/swap` + `/defi` | ✅ redirecty live (F3d) + **`/market` overview má canonical link card → market.zionterranova.com** (2026-10-24, deployed) |
| `dashboard.zionterranova.com` + `/dashboard/*` (10 str.) + `/monitoring` + `/g8` + `mission-control` | ✅ split je realita: ops subdoména = 401 allowlist; public `/dashboard`, `/monitoring`, `/g8` = obsahové stránky pod Síť (nav `/network` children 2026-10-24) |
| `explorer/` 24 str. | jádro `/network` — nechat, jen přeskupit nav — ✅ v nav pod Síť |
| `PUBLIC/` klon vs `public/` subtree | ✅ **rekonziliováno s F2 rozhodnutím (2026-10-22):** `PUBLIC/` je untracked klon (32M, nikdy se necommití), `public/` subtree = jediný tracked zdroj → push na `public` remote. F2: "všechno untracked zůstává" — zdokumentováno v REPO-MAP §3 |
| `newearth.cz` | ✅ **retired 2026-10-20** — vhost+cert off, odkazy → `/legacy/`; residual: `apps/public_html/` + edge `/var/www/newearth` (F6 cleanup) |
| `edge-deploy/` + `scripts/` + `ZION_OS/` deploy části | → `infra/` — ✅ `edge-deploy`→`infra/edge-deploy` (F2b5); `scripts/`+`ZION_OS/` deferred (mapping strategie, server-runtime refs) |

### F5 — Deploy kanonizace

- ✅ `deploy-web2.9.sh` — už kanonický vzor (edge2 + standalone/public fix + smoke). **Ověřeno 2026-10-24: cílí správně.**
- ✅ **Retarget po cutoveru (2026-10-24):** všechny deploy skripty mířily na Edge = nasazovaly na fallback, ne produkci. Opraveno: `deploy-intro.sh` + `deploy-freeworld.sh` (`zion-new`→`zion-edge2`), `deploy-oasis-web.sh` (`62.171.141.136:2222`→`zion-edge2:22`, + nginx conf zdroj `deploy/nginx-oasis.conf`→`infra/nginx/edge2/` — app-kopie by vhost regresovala na auth. hairpin), `deploy-pool.sh` (`zion-v6`→`zion-edge2` + NGINX_SRC→`infra/nginx/edge2/` + smoke `/`+`/public/v1/coins`), `deploy-zis.sh` (`ZIS_NGINX_HOST`→`zion-edge2`). Edge fallback webroot zůstává stale záměrně (do F6).
- ✅ `infra/RUNBOOK.md` + `infra/deploy/README.md` (2026-10-24): host/alias tabulka, restart per služba, rollback (`.next.bak-*`), "co dělat když" (404 obrázky = standalone/public; tunely = které služby; cert renewal edge2; disk full), deploy kontrakt + registry.
- ✅ SSH alias `zion-edge2` (207.180.217.100:22) — chyběl lokálně, kanonické skripty bez něj nefungovaly.
- ✅ `deploy-marketplace.sh` vytvořen (2026-10-24) — prisma generate před build (debian engine do standalone), rsync→edge2, `zion-marketplace` restart, smoke :3100+live
- CI: `npm run build` + `check:links` na push? → **ROZHODNUTO 2026-10-24: NE** (vynecháno)

### F6 — Edge → čistý chain tier

- Po stabilizaci F1: edge nginx nechat jen servisní (případně vypnout web vhosty úplně)
- chain-tunel legs redukovat na nutné (co edge reálně konzumuje z edge2)
- ✅ **Úklid proveden (2026-10-24, archive-first):** EDGE — stale `/opt/zion/website-v2.9` (161M) tar+rm, worktrees `wt-f5`/`wt-main` (3.4G, clean) `worktree remove`, `pool-F5` prunable pruned, `zion-nginx.conf.bak-*` přesunut ze sites-enabled (nginx parsuje vše v dirs!), prázdné `app_state_*`/`config_*` husky rm, `oasis.bak-*`+`oasis.prev`+`newearth` (464M) tar+rm → `/opt/zion/archive/cleanup-20261024/` (381M). EDGE2 — `.next.bak-*` 11→2 (616M→~110M), `public_html` (428M, žádný vhost neservíruje) tar+rm, `oasis.bak-*`+`oasis.prev`+`newearth` tar+rm → `/opt/zion/archive/cleanup-20261024/` (601M). **Nález:** `zion-edge-backup.service` failoval 10:53 na `chmod 600 root /data/zion/g8_run.json` (service user=zion) → `chmod 644` fix, re-run prošel místo crashu. `backups/` 36G = legit rolling v31_data retention 14 — ponecháno. `canonical-main`+`warpd-zis` worktrees ponechány (aktivní registry). Smoke: všechny public povrchy 200, služby beze změny.
- ✅ **Repo rezidua (2026-10-24):** `APP&WEB/` (8.8G) + `docs/WP-Mainet/` (50M) smazány po verifikaci — unikáty zachovány: `desktop-agent/resources/` (79M miner binárky — electron-builder `"from": "resources/"`), `OasisWeb/.env{,.example,.development}`, `IntroPage/public/dashboard/` redirect, `api-contabo.md`→`docs/3.2/ops/`; zbytek = node_modules/.venv/buildinfo + PII test fixture. **`PUBLIC/`/`public/` (32M) → `archive/PUBLIC/`** — korekce: na case-insensitive FS byly `PUBLIC/` a tracked `public/` **jeden adresář** (ne klon) — stará V3 public distribuce (2989 souborů: genesis statements, CREATOR_PUBKEY.asc, JURISDICTION, FAQ + `V3/` snapshot). Secret scan čistý, přesun do `archive/` + commit. Žádné manifesty/skripty na `public/` root neodkazují. `L4data/img/OasisMaitreya.png` = nový user asset, ponechán untracked.
- ✅ **Catch-all utažen (2026-10-24):** `zion-edge-download.conf` — `_` default_server nahrazen `server_name 62.171.141.136` + nový `_`→`return 444` block (IPv4+IPv6); ověřeno: IP `/zion-miner/` 200, fake Host → 444, `app.` fallback 301 zachován; bak v `/etc/nginx/backups/`. **Tunel legs:** všech 18 (`zion-chain-tunnel` edge→edge2) má aktivní konzumenty → redukce nemožná bez výpadku, ponecháno; `zion-v31-multichain.service` stale CORS `newearth.cz` → **odstraněn + restart (2026-10-24)**, service active, `/api/multichain/chains` OK

---

## 3. Pravidla přestavby

- **Nic se nemaže** — `archive/` = přesun, ne delete; delete jen po schválení + review (`canonical-main` má uncommitted diffy!)
- **Každá fáze = vlastní commity** — repo vždy buildable
- **Public copy:** žádné interní názvy (V31, ZionStart, PoC-lab, HiranV2.x, edge-deploy), žádné IP/cesty/service názvy ve veřejných plochách
- **CS+EN parita** povinná
- **Rasta design + ZIS = canon** — tokeny se sjednotí do shared/ui, nemění se
- **Secrets:** nikdy v repu — env templaty jen se jmény klíčů

---

## 4. Otevřené otázky

1. **MarketPlace** — samostatná Next app + `market.` subdomain vs. tab v hlavním webu? Doporučuji: zatím nechat samostatnou (má vlastní DB, watcher, contracts), kanonicky linkovat z `/market`.
2. **Dashboard** — `dashboard.zionterranova.com` ops (IP allowlist + BasicAuth + tunel na zionserver :8088): nechat ops-only, nebo veřejný stav sloučit do `/network`? Doporučuji: ops zůstane, veřejné metriky → `/network`.
3. **Apex intro** — statický (doporučuji — odolný vůči app outage) na edge2.
4. **`chain/` rename** — jen adresář (doporučuji), nebo i `v31-*` crates? (crate rename = churn bez zisku)
5. **`mobile-app/`** — živá (posl. commit 10.10.), nebo archiv?
6. **`newearth.cz`** — zůstává na ekosystémovém boxu, nebo separovat? (doporučuji separovat — jiný scope)
7. **`pool.zionterranova.com`** — vlastní povrch vs redirect do `/network`?
8. **`backups/` 16G v repu** — kam přesunout (ven z repa)?
9. **`zion-edge-download.conf` `server_name _`** — má catch-all zůstat (rig-output/download endpoint)?
