# ZION Ecosystem — Plán přestavby a sjednocení

> **Status:** návrh ke schválení (2026-10-22), podložený `docs/ECOSYSTEM-INVENTORY.md` (měřená fakta, ne odhady). Cíl: jeden kanonický celek — infrastruktura, repo, weby i deploye pod jedním organizačním principem. Zachováváme Rasta design, ZIS (již SSO pro všechny `*.zionterranova.com`), mockupy i kanon.

---

## 0. Shrnutí diagnózy (z inventáře)

**Křehké místo dneška:** veřejný request jede `DNS→edge nginx→SSH tunel→edge2:3000`. Tunel je jediná `ssh -N` session (18 forwardů); když spadne, celý web je down — flap pozorován 22.10. Deploy skript hlavního webu navíc **cílí na mrtvý box** (`zion-post-wipe` = old edge, kde `zion-website.service` je retired). Přitom `rpc.zionterranova.com` už jede **přímo** na edge2:9445 — precedens přímého obsluhování existuje.

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
│   ├── web/                         ← APP&WEB/website-v2.9
│   ├── intro/                       ← APP&WEB/IntroPage
│   ├── oasis/                       ← APP&WEB/OasisWeb
│   ├── marketplace/                 ← APP&WEB/MarketPlace
│   ├── pool-ui/                     ← APP&WEB/pool-ui
│   ├── identity/                    ← APP&WEB/identity (ZIS)
│   ├── desktop-agent/               ← APP&WEB/desktop-agent
│   ├── mobile-app/                  ← APP&WEB/mobile-app
│   ├── wallet-sdk/                  ← APP&WEB/zion-wallet-sdk
│   └── shared/                      ← APP&WEB/shared (+ nový ui kit)
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
pool.zionterranova.com    → redirect na app./network#pool? (rozhodnout)
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

1. **archive/ konsolidace:** `V3/`, `WarpBeta/`, `BACKUP/`, `backups/` (16G! rozhodnout: ven z repa), `logs/`, `PUBLIC/` (klon → samostatný checkout mimo repo), `venv-hiran/`, `website-v2.9-backup-*.tar.gz`, `AuXpow/` (posoudit), `src/lib.rs` (1 soubor — smazat/zařadit), `dashboard/` (pokud nahrazeno ZION_OS/dashboard), `config/` (1 soubor)
2. **APP&WEB → apps/:** postupně per app; u `website-v2.9` opravit cesty v deploy skriptech + AGENTS.md + `next.config.ts` assetPrefix pokud existuje
3. **V31 → chain/:** jen adresář (crate názvy zůstávají `v31-*` — rozhodnout §4.4)
4. **docs/WP-Mainet → canon/books/:** přesun knih; ~100+ odkazů k přepsání (README, AGENTS, docs/3.2, .gitignore, pdf skripty) — dedikovaný commit
5. **infra/:** sesbírat `edge-deploy/`, deploy skripty z `apps/*/deploy/`, systemd unity ze `ZION_OS/infra/systemd/`, nginx z repa `V31/deploy/nginx/`
6. **canon/l*/:** `L2data`–`L6data` + `L5Projects` jsou kanon/dokumenty + source artwork, NE runtime data → `canon/l2..l6` (**provedeno v batch 1**); `data/` u kořene = untracked runtime DBs, zůstává; `canon/brand/` → `canon/brand/` (26 odkazů — dedikovaný commit)

**F2 batch 1 ✅ (2026-10-22):** `L2data`→`canon/l2`, `L3data`→`canon/l3`, `L4data`→`canon/l4`, `L5Projects`→`canon/l5`, `config/`→`archive/config/`; fixnuto: `freeworld/tools/images.py`, `freeworld/AGENTS.md`, `BohemiaDao.md` linky.
**Batch 1b ✅:** `WarpBeta`→`archive/WarpBeta` (7 souborů opraveno), `config/`→`archive/config/`.
**Zbývá:** `L6data`→canon/l6 (71 odkazů), `LOGO`→canon/brand (26), `WP-Mainet`→canon/books (100+), pak velké: `APP&WEB`→apps, `V31`→chain, `edge-deploy`+`scripts`+`ZION_OS`→infra.
7. Aktualizovat `.github/`, `AGENTS.md`, všechny `deploy-*.sh` cesty

### F3 — Kanonizace webu

- **IA:** mapovat ~60 sekcí → 7 kanonických; redirect tabulka pro sirotky (Next `next.config.ts` redirects — mechanismus už existuje pro `/dex`→`/multichain#dex`)
- **Design tokens → `apps/shared/ui`:** gold `#ffd700`, purple `#9333ea`, cyan `#06b6d4`, blue `#1e3a8a`, `.zion-rainbow-card`, `.zion-section`, `.zion-button-*`, `.zion-kicker`, `.zion-cta-banner`, `.zion-docs-prose` — tailwind preset + css variables exportované jako balíček; konzumují: web, intro, oasis, marketplace, pool-ui → **jednotný vizuální produkt**
- **Chrome:** sdílené Navigation/Footer/FloatingUtilities komponenty (dnes zkopírované per app?)
- **ZIS:** canon — rozšířit session na všechny portály (cookie `.zionterranova.com` už je); pool-ui přidat ZIS (má už simplewebauthn dep)
- **Copy audit:** CS+EN parita, žádné interní názvy (V31, ZionStart, PoC-lab…), `npm run check:links --strict`

### F4 — Konsolidace překryvů (naměřené duplicity)

| Duplicita | Rozhodnutí |
|---|---|
| `/pool` + `APP&WEB/pool-ui` + `/var/www/pool` + `pool.zionterranova.com` | 1 pool povrch — pool-ui jako tab v `/network`, nebo subdomain → redirect |
| `OasisWeb` (3D) + `/var/www/oasis` + `/l4-oasis` v hlavním webu | `/l4-oasis` = popis/landing → odkaz do portálu; portál = hra |
| `market.` app + `/multichain` + `/dex` + `/ziondex` + `/swap` + `/defi` | Jeden Trh v appu (taby), market app = admin/backend? (§4.1) |
| `dashboard.zionterranova.com` + `/dashboard/*` (10 str.) + `/monitoring` + `/g8` + `mission-control` | Rozdělit: veřejný stav → `/network`; ops → za ZIS na dashboard. |
| `explorer/` 24 str. | jádro `/network` — nechat, jen přeskupit nav |
| `PUBLIC/` klon vs `public/` subtree | jediný zdroj: `public/` subtree → push na `public` remote; `PUBLIC/` přesunout mimo repo |
| `newearth.cz` | jiný projekt — přesunout na jiný box/repo, nebo jasně oddělit vhost |
| `edge-deploy/` + `scripts/` + `ZION_OS/` deploy části | → `infra/` |

### F5 — Deploy kanonizace

- `infra/deploy/deploy-web.sh` — **fix target** (`ZION_EDGE_HOST` default → edge2!), build → rsync `.next`+`public`+**`.next/standalone/public`** (dnešní bug — standalone neservíruje `public/` samo) → restart → post-deploy smoke (`/`, 3 obrázky, 2 API, 1 docs md)
- Stejný vzor: `deploy-intro.sh`, `deploy-oasis.sh`, `deploy-marketplace.sh`, `deploy-pool-ui.sh`, `deploy-zis.sh` — jednotný interface, jednotný smoke check
- `infra/RUNBOOK.md`: restart per služba, rollback (`.next.bak-*` konvence), "co dělat když" (404 obrázky = standalone/public; tunel down = které služby; disk full)
- CI: `npm run build` + `check:links` na push? (rozhodnout)

### F6 — Edge → čistý chain tier

- Po stabilizaci F1: edge nginx nechat jen servisní (případně vypnout web vhosty úplně)
- chain-tunel legs redukovat na nutné (co edge reálně konzumuje z edge2)
- úklid: `/opt/zion/website-v2.9` stale (161M), `/opt/zion/APP&WEB/` neexistuje — ověřit, `wt-main`/`wt-f5` worktrees, `canonical-main` (2.6G divergentní — review před delete)
- `zion-edge-download.conf` `server_name _` catch-all → utáhnout (explicitní server_name)

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
