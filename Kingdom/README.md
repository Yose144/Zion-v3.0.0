# Kingdom — jeden klient ekosystému ZION

> **Stav:** **F0 + F1 + F2a hotové** (2026-11-01) — kostra buildí, Brána má obsah z IntroPage a živá čísla, Místnost má **první svět OASIS** (planeta, prstenec Issobelly, Brána, markery portálů) a tři portály (Řetěz, Kovárna, Tržiště) čtou živá data. 13 světů OASIS je hotových.
> **Datum založení:** 2026-11-01
> **Nahrazuje:** `NIRVANA-V3.3-UNIFICATION.md` §1–3 jako *architekturu* (nový strom jde od nuly); plánovací router `NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md` zůstává v platnosti pro provoz a RC.

## Co to je

Ekosystém ZION je dnes 12 aplikací, 13 lockfileů, 5 implementací i18n, 2 generace Next a 14 hostname.
Kingdom je **jeden klient**, do kterého se to postupně vstřebá — ne další appka vedle nich.

```
Brána (vstup)  →  Místnost (shell)  →  Světy a Portály (obsah)
```

- **Brána** je to, co dnes dělá IntroPage: příjezd, rozcestí, „vejdi dovnitř".
- **Místnost** je shell: okna, lišta, session, jedna i18n, jeden token set.
- **Světy** jsou 3D místa (Nirvana = první svět OASIS).
- **Portály** jsou okna do dat: řetěz, kovárna (pool), tržiště (market), knihovna, účet, přístav, Issobella, Hiran.

Kingdom **není náhrada služeb**. Pool API, market API, ZIS, warpd, DAO, free-world, Issobella, NCL, Hiran a node RPC zůstávají tam, kde jsou. Kingdom je jen čte.

## Co Kingdom nikdy nemá

- **žádnou databázi** — žádné Prisma, žádný schema, žádný migrační dluh
- **žádné peníze ani klíče** — Stripe, Coinbase, L1 payout, treasury zůstávají ve svých službách
- **žádnou změnu L1** — konsensus, emise, genesis, crypto jsou mimo dosah

Tím je sjednocení bezpečné: jeden klient, jedna session, jedno UI — a money-path se ani jednou nedotkne.

## Dokumenty

| Dokument | Co v něm je |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | architektura, strom, Portal Contract v1, datová cesta, session, AAA seam, mapa služeb, donoři |
| [`PLAN.md`](PLAN.md) | posloupnost F0–F7, brány, KPI, exit kritéria, rizika |
| [`AGENTS.md`](AGENTS.md) | pravidla pro agenty pracující v tomto stromě |

Nic jiného tu není a nic jiného se sem přidávat nebude. Problém, který Kingdom řeší, je mimo jiné **příliš mnoho plánů** — proto jsou tu tři.

## Rychlý start

```bash
cd Kingdom
npm install
npm run dev          # http://127.0.0.1:3020
```

Produkční build a standalone server (statika se stageuje vedle `server.js`):

```bash
npm run verify       # codegen + hranice + typecheck + build
npm start            # http://127.0.0.1:3020
```

## Session a ZIS

`@zion/session` je **jediný klient** ZION Identity Service pro celý ekosystém. Nahrazuje šest kopií, které vznikaly v appkách (website 619 řádků, market 344, pool-ui 182, nirvana 73…).

- odvození peněženky z fráze **v prohlížeči** (`deriveWalletFromMnemonic`), fráze se nikdy neukládá ani neposílá
- dvoukrokové přihlášení: `challenge` → podpis Ed25519 → `verify` → cookie `zion_session`
- cookie v produkci na `.zionterranova.com` (jedno přihlášení pro celý ekosystém), lokálně host-only
- server volá ZIS přes **loopback** (`ZIS_URL=http://127.0.0.1:8096`) — žádné CORS, žádné TLS samo k sobě
- portály síť nevolají (hlídá `check-boundaries`); přihlášení žije v `core/session/`, protože session patří **hostiteli okna**

## Nasazení

Běží na **EDGE2** jako `zion-kingdom.service` (127.0.0.1:3020), vhost `kingdom.zionterranova.com` staged na portu 80.

```bash
bash infra/deploy/deploy-kingdom.sh                # build + stage + rsync + restart
SKIP_BUILD=1 bash infra/deploy/deploy-kingdom.sh   # použít existující build
```

Každý deploy = nový `build-<UTC>` adresář + atomický přepis symlinku `current`; rollback je přepis symlinku. **Nikdy** nekopíruj `.next/standalone/` do živého adresáře appky (incident 2026-10-30 v MarketPlace).

Zbývá 👤: DNS `A kingdom` → `207.180.217.100` + `certbot --nginx`.

Port `3020` je záměrně mimo `website` (3000), `market` (3100) a `nirvana` (3010).

## Co je hotové (F0)

- jeden workspace root, **jeden lockfile** (dnes jich má ekosystém 13)
- `@zion/contract` — Portal Contract v1; `@zion/api` — jediná datová cesta; `@zion/i18n` — jediná i18n; `@zion/ui` — jediný token set
- `@zion/world` s vynucenou hranicí (žádný React/Three/DOM) — AAA seam
- registry portálů generovaný z manifestů (`npm run codegen`)
- `scripts/check-boundaries.mjs` — vynucuje 6 pravidel, 0 závislostí, běží v ms
- **Brána** (`/`) a **Místnost** (`/room`), deep-link `/portal/<id>`
- **devět portálů**: Řetěz, Kovárna, Tržiště, Přístav (L5 fond 28 096 820 ZION), Snem (DAO — 7 strážců), Knihovna (14 knih z `canon/books`), Věž (Hiran), Issobella, Účet
- tři z nich jsou `placeholder` a **řeknou proč** (Hiran chat = F4, Issobella papers = nenasazené 6.B4, Účet = session ve F4)
- cs/en celé na serveru — do prohlížeče jde jediná klientská komponenta (přepínač jazyka)

## Co je hotové (F1 — Brána)

Obsah harvest z `apps/IntroPage` (`maintenance.html` + `intro-tabs.js`), přepsaný do **typovaných dat** (`core/gate/content.ts`), ne do JSX:

- hero: `ZION / TERRA NOVA ∞ OASIS / Multichain Dharma ekosystém` + vstup, OASIS preview, eXplorer
- **skutečná brána (stargate)** převzatá 1:1 z `apps/website-v2.9/src/components/StargateLogo.tsx` (live na `/doge-vs-zion`) — 28 rotujících vrstev (22 chevronů + 6 Śrí jantra), logo ve středu, 52 glyfů a 9+9 chevronů; čisté CSS, žádný canvas
- **rasta design** (One Love v3.2.0) — `--rasta-red/gold/green` z `intro-rasta.css` v `@zion/ui`; hero má zlatou auru, badge i CTA jsou zlaté, tři cesty nesou triádu červená/zlatá/zelená
- **živý pás** — výška, difficulty, hashrate, block time a připojené mince z hlavního uzlu, ověřené při každém renderu
- **Co je ZION** — tři odstavce včetně fee splitu 89/5/5/1
- **Tři cesty na palubu** — Pozorovatel / Hráč / Stavitel
- **Vrstvy ekosystému** — L1–L6 jako rozcestník do portálů a služeb
- kotvy `#why` `#paths` `#layers`, cs/en, patička

Staré `apps/IntroPage` zůstává jako donor; apex DNS se nepřepíná, dokud Brána nepokryje jeho povrch (F6).

## Co je hotové (F2a — první svět OASIS)

- `packages/world` — **doména bez Reactu a Three**: Nová Země, prstenec Issobelly (6 stanic), Brána, `placeMarker`, `orbitCamera`, seeded PRNG (`mulberry32`) a generátor hvězd
- `packages/scenes` — web adaptér: `OrbitScene`, `NewEarth` (textura 82 KB), `IssobellaRing`, `Gate`, `Markers`, `Starfield` (2400 hvězd, jeden buffer) — **bez drei a bez xr**
- scéna je **generovaná Portal Contractem**: portál s `ring` se objeví ve světě sám, klik na marker otevře `/portal/<id>`
- lazy `next/dynamic` + `ssr:false` → three.js (**237 KB gzip**) se stahuje jen na `/room`; Brána zůstává bez WebGL
- ověřeno přes CDP, ne screenshotem: headless Chromium WebGL canvas do obrázku nekomponuje

## Co je hotové (F2b — 13 světů)

- `packages/scenes/src/worlds/` — 13 světů převzatých z `apps/shared/scenes` (10 900 LOC vč. `kit`), `@genesis/runtime` nahrazen skutečným modulem (`runtime.ts`)
- **`OrbitRig`** místo `drei` `OrbitControls` — stejné rozhraní (`target`, `enabled`, `autoRotate`, `min/maxDistance`, `maxPolarAngle`), tažení + kolečko, o ~100 KB lehčí
- **katalog světů v `@zion/world`** (jen texty), komponentová vazba v `@zion/scenes` — serverové stránky si three netáhnou do SSR
- cesta **`/world/<id>`** = místo, ne portál; lazy chunk **294 KB gzip** (three + 13 světů + kit)
- Místnost má sekci „Světy OASIS“ s 13 dlaždicemi

Report: [`docs/3.2/REPORTS/REPORT_2026-11-01_KINGDOM_F0-F2_OASIS.md`](../docs/3.2/REPORTS/REPORT_2026-11-01_KINGDOM_F0-F2_OASIS.md)

## Hierarchie pravdy

1. živý kód v `Kingdom/` a živé sondy služeb
2. `docs/3.2/StatusV3.md`
3. `NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md` (provoz, RC, G8)
4. tento strom (`ARCHITECTURE.md`, `PLAN.md`)
5. staré appky v `apps/` — **dárci orgánů**, ne pravda

Když se dokument a kód rozcházejí, platí kód. Když se rozcházejí dva dokumenty, platí ten výš v seznamu.
