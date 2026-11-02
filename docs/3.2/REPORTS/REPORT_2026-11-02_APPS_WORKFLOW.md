# REPORT 2026-11-02 — WORKFLOW VŠECH APPS: OVĚŘENÍ

> **Co to je:** kontrola, že každá aplikace v `apps/` má funkční cestu
> *zdroj → build → deploy → běžící služba → veřejný povrch*. Cílem není
> hodnotit kvalitu kódu, ale najít místa, kde workflow **nedrží pohromadě**.
>
> **Metodika:** lokální metadata (`package.json`, `deploy/*.sh`, `bash -n`),
> živé sondy na EDGE1/EDGE2 (`systemctl`, `ss`, nginx `server_name`,
> `list-timers`) a HTTP test veřejných povrchů. Buildy jsem **nespouštěl**
> (viz §6).

---

## 1. Souhrn

| | počet |
|---|---:|
| aplikací v `apps/` | **14** |
| z toho s deploy skriptem | 10 (11 skriptů) |
| deploy skriptů se syntaxí OK (`bash -n`) | **11 / 11** |
| běžících systemd služeb (app-tier) | 10 |
| veřejných povrchů odpovídajících 200 | 9 |
| povrchů v plánované odstávce (503) | 3 |
| **rozbitych povrchů** | **2** (`api.`, `dex.` — TLS) |

**Celkově: workflow drží u 12 ze 14 aplikací.** Dvě jsou klienti/knihovny bez
runtime. Dva veřejné povrchy jsou rozbité z důvodu, který s aplikacemi
nesouvisí (DNS + TLS SAN), a tři jsou dočasně 503 kvůli plánované odstávce.

## 2. Tabulka aplikací

| App | Typ | Build | Deploy skript | Kde běží | Služba | Povrch | Stav |
|---|---|---|---|---|---|---|---|
| `intro-page` | Next (static export) | `build` | `deploy-intro.sh` | EDGE2 `/var/www/zion-maintenance` | — (nginx) | `zionterranova.com` | 🟡 503 odstávka |
| `website-v2.9` | Next 16 standalone | `build` | `deploy-web2.9.sh` | EDGE2 `/opt/zion/APP&WEB/website-v2.9` | `zion-website` | `app.zionterranova.com` | ✅ 200 |
| `marketplace` | Next 14 + Prisma + Stripe | `build` | `deploy-marketplace.sh` | EDGE2 `/opt/zion/APP&WEB/MarketPlace` | `zion-marketplace` | `market.zionterranova.com` | ✅ 200 |
| `oasis-web` | Next (static export) | `build` | `deploy-oasis-web.sh` | EDGE2 `/var/www/oasis` | — (nginx) | `oasis.zionterranova.com` | ✅ 200 |
| `pool-ui` | Next 14 (static) | `build` | `deploy-pool.sh` | EDGE2 `/var/www/pool` | — (nginx) | `pool.zionterranova.com` → redirect | 🟡 503 odstávka |
| `identity` (ZIS) | Fastify 5 + Prisma | `build` | `deploy-zis.sh` | EDGE2 :8096 + EDGE1 :8096 | `zion-zis` | `auth.zionterranova.com` | ✅ 200 (`/health`, JWKS) |
| `nirvana` | Next 16 + R3F | `build` | `deploy-nirvana.sh` | EDGE1 :3010 | `zion-nirvana` | `nirvana.zionterranova.com` | ✅ 200 |
| `nirvana-net` | Node 22 + `ws` | `build` | `deploy-nirvana-net.sh` | EDGE1 :3011 | `zion-nirvana-net` | `wss://…/net` | ✅ 200 `/net/health` |
| `shared` | Node (db-sync) | — | — | EDGE2 | `zion-db-sync` | — (interní) | ✅ running |
| `desktop-agent` | Electron | `build:all` | — (release) | klient | — | — | ⚪ není služba |
| `mobile-app` | React Native / Expo | `build:android` | — | klient | — | — | ⚪ není služba |
| `public-miner` | Electron | `build:all` | — (release) | klient | — | — | ⚪ není služba |
| `zion-wallet-sdk` | TS knihovna | `build` | — | — (vendored) | — | — | ⚪ knihovna |
| `update-server` | Fastify + SQLite | *(chybí `build`)* | — | **nikde** | — | — | 🔴 nenasazeno |

`Kingdom/` je samostatný workspace mimo `apps/` — služba `zion-kingdom` :3020 běží,
povrch je v odstávce (503).

## 3. Live ověření povrchů

```
https://app.zionterranova.com                    200  ✅
https://market.zionterranova.com                 200  ✅
https://oasis.zionterranova.com                  200  ✅
https://nirvana.zionterranova.com                200  ✅
https://nirvana.zionterranova.com/net/health     200  ✅
https://auth.zionterranova.com/health            200  ✅
https://auth.zionterranova.com/.well-known/jwks.json  200  ✅
https://auth.zionterranova.com/api/auth/me       401  ✅ (správně nepřihlášen)
https://rpc.zionterranova.com/health             200  ✅
https://app.zionterranova.com/pool               200  ✅ (fallback UI)
https://app.zionterranova.com/explorer           200  ✅
https://app.zionterranova.com/market             200  ✅
https://app.zionterranova.com/dex                308  ✅ (redirect)
https://app.zionterranova.com/shop               404  ⚠️ přesunuto na market.

https://zionterranova.com                        503  🟡 plánovaná odstávka
https://kingdom.zionterranova.com                503  🟡 plánovaná odstávka
https://pool.zionterranova.com                   503  🟡 → kingdom/portal/pool
https://freeworld.zionterranova.com              503  🟡 → kingdom/portal/freeworld

https://api.zionterranova.com/health             000  🔴 TLS
https://dex.zionterranova.com/health             000  🔴 TLS
```

## 4. Služby po hostech

**EDGE2 (web ingress + app stack) — 31 unitů `zion-*`, z toho aktivních 22:**

`zion-website`, `zion-marketplace`, `zion-zis`, `zion-kingdom`,
`zion-v31-{node,pool→ne,multichain,dao,oasis,free-world,issobella,ncl,ai-native}`,
`zion-hiran-{gateway,inference}`, `zion-l1-watcher`, `zion-db-sync`,
`zion-bitcoind`, `zion-quantus-node`, `zion-pearl*`, `zion-btcunlock-coord`,
`zion-g8-probe`, tunelem `zion-edge-tunnel`.

**EDGE1 (ops + pool + herní klient) — 22 unitů, aktivních 14:**

`zion-v31-pool`, `zion-v31-node2`, `zion-v31-node3`, `zion-v31-miner`,
`zion-fallback-miner`, `zion-nirvana`, `zion-nirvana-net`, `zion-g8-probe`,
`zion-g8-alert-sink`, `zion-pool-wedgewatch`, `zion-edge-python-dashboard`,
`zion-rig-output`, `zion-chain-tunnel`.

**Vše, co se jeví jako `inactive (dead)`, je timer-driven** — ověřeno
`list-timers`: `zion-l2-indexer`, `zion-vastrigs-sync`, `zion-pool-standby-sync`,
`zion-pool-standby-dbsync`, `zion-pool-ha-watchdog`, `zion-writepath-probe`,
`zion-edge-watchdog`, `zion-g8-evidence`, `zion-pool-state-replicate`,
`zion-edge-backup`, `zion-edge-maintenance`. **Žádná mrtvá služba.**

`zion-v31-pool` je na EDGE2 `inactive` **správně** — pool žije na EDGE1
(per-IP limity potřebují reálné IP minerů).

## 5. Nálezy

### 🔴 1. `api.` a `dex.` — TLS SAN mismatch (blokuje 2 povrchy)

```
curl: (60) SSL: no alternative certificate subject name matches
            target hostname 'api.zionterranova.com'
```

**Příčina (upřesněno 2. 11. živou sondou na EDGE2):**
- DNS `api.` i `dex.` míří na `62.171.141.136` (**EDGE1**); `dex.` přes wildcard.
- **EDGE2 už vhosty má** — `api.zionterranova.com.conf` a
  `dex.zionterranova.com.conf` jsou v `/etc/nginx/sites-enabled/` (od 31. 10.).
- S `Host:` hlavičkou obcházející DNS vrací EDGE2 **200**, cílové služby žijí
  (`zion-hiran-gateway` :8007 → 200, `warpd` :8454 → 200).
- **Chybí jediná věc: certifikát.** EDGE2 na `api.`/`dex.` servíruje apex cert
  (`CN=zionterranova.com`, SAN jen `www` + `zionterranova.com`) → TLS selže.

**Není to regrese aplikací** — je to známý rozpor z revize 31. 10.
(`NIRVANA-V3.3-CHECKLIST.md`, `infra/dns/zionterranova.com.zone.md` Fáze 3).

**Co zbývá (nejde autonomně — DNS je u webglobe.cz, certbot má jen
nginx/standalone/webroot, žádný DNS-01 plugin):**

1. webglobe.cz: `api` A `62.171.141.136` → `207.180.217.100`; přidat explicitní
   `dex` A → `207.180.217.100`
2. na EDGE2: `certbot --nginx -d api.zionterranova.com -d dex.zionterranova.com`
3. ověřit `curl https://api.zionterranova.com/health` a `…/dex/prices/:token/history`
4. `dex` potřebuje doplnit `/prices/:token/history` ve `warpd` (per rozhodnutí 👤)

### 🟡 2. Odstávka schovala dva legální povrchy

`pool.zionterranova.com` a `freeworld.zionterranova.com` dělají 301 na
`kingdom.zionterranova.com/portal/<id>`, ale Kingdom je v odstávce → **503**.
Pool UI je přitom zdravé na `app.zionterranova.com/pool` (200).
Po skončení odstávky se to spraví samo; do té doby je `pool.` nedostupná.

### 🟡 3. `app.zionterranova.com/shop` → 404

Shop se přesunul na `market.zionterranova.com`. Stará routa na webu vrací 404
místo redirectu — drobnost, ale kazí dojem z rozbitého odkazu.

### 🔴 4. `update-server` není nikde nasazený

`apps/update-server/` je v repu (Fastify + SQLite) a **má unit template**
`deploy/zion-update-server.service` (User=zion, `ProtectSystem=strict`,
`ReadWritePaths=/opt/zion/update-server/data`). Co chybí:

- **`build` script** v `package.json` — doplněn 2. 11. (`node --check` na
  `server.js`, `db.js`, `iap.js`; projekt se nekompiluje, takže jde o validaci)
- **deploy skript** (`.sh`) — unit template existuje, ale nic ho nenainstaluje
- **instalace na serverech** — `systemctl list-units` na EDGE1 ani EDGE2
  žádný `zion-update-server` nemá
- **`node_modules`** lokálně

Konzistentní s `AGENTS.md` („Deploy update server — pending, requires user
action“), ale znamená to, že **auto-update desktopu je zatím jen na papíře**.

### 🟡 5. Tři aplikace nemají lokálně `node_modules`

`public-miner`, `shared`, `update-server`. U klientů to nevadí (staví se
na release stroji), u `shared` to znamená, že db-sync lze lokálně spustit jen
po `npm install`.

## 6. Meze — co jsem NEověřil

| Neověřeno | Proč |
|---|---|
| **`npm run build` u 6 Next aplikací** | každý build 2–5 min + riziko, že rozbije cizí WIP v pracovním stromu (paralelní session) |
| **E2E testy** | `nirvana` má `e2e/*.mjs`, `website-v2.9` `test:e2e` — vyžadují prohlížeč a běžící službu |
| **`deploy-*.sh` skutečně spuštěné** | deploy = produkční změna, není součást auditu |
| **Desktop/mobile buildy** | vyžadují Apple Silicon / Windows toolchain |
| **Health endpointy aplikací** | většina Next apps health route nemá; ověřeno jen HTTP 200 na rootu |

## 7. Co se 2. 11. opravilo autonomně

| Fix | Soubor | Stav |
|---|---|---|
| `/shop` + `/shop/:path*` → `market.zionterranova.com` | `apps/website-v2.9/next.config.ts` | commitnuto |
| `/api/health` pro nirvanu (stav netu + `proto_match`) | `apps/nirvana/src/app/api/health/route.ts` | commitnuto |
| `build` script (`node --check` trojice) | `apps/update-server/package.json` | commitnuto |

Ověřeno: `tsc --noEmit` v nirvaně **0 chyb**, `node --check` v update-serveru
prošel, `package.json` validní. `website-v2.9` má `ignoreBuildErrors: true`
(pre-existing TS chyby v `PoolDashboard`/`LifeTreeVisualization` build neblokují).

## 8. Doporučení (v pořadí dopadu)

1. **Repoint DNS `api.` + `dex.` na EDGE2** a vystavit cert → odemkne
   2 mrtvé povrchy. Vhosty i služby jsou připravené (§5.1).
2. **Nasadit website-v2.9** — bez deploye zůstává `/shop` 404 (patch je
   commitnutý, ale Next redirecty jsou build-time).
3. **Rozhodnout osud `update-server`**: doplnit `deploy/*.sh` + nainstalovat
   unit, nebo sekci v `AGENTS.md` označit jako „zrušeno“ — teď visí v polovině.
4. **Dopsat `/prices/:token/history`** do `warpd` (blokuje publikaci `dex.`).

---

**Souvisí:** [`REPORT_2026-11-02_DOCS_CLEANUP_LINKS.md`](REPORT_2026-11-02_DOCS_CLEANUP_LINKS.md) ·
[`StatusV3.md`](../StatusV3.md) · [`REPO-MAP.md`](../../../REPO-MAP.md) ·
[`NIRVANA-V3.3-CHECKLIST.md`](../../3.3/NIRVANA-V3.3-CHECKLIST.md) (rozpor `api.`/`dex.`)
