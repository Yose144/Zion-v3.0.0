# Kingdom — jeden klient ekosystému ZION

> **Stav:** **F0 + F1 hotové** (2026-11-01) — kostra buildí, Brána má obsah z IntroPage a živá čísla, tři portály (Řetěz, Kovárna, Tržiště) čtou živá data. F2 (první svět OASIS) následuje.
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

Port `3020` je záměrně mimo `website` (3000), `market` (3100) a `nirvana` (3010).

## Co je hotové (F0)

- jeden workspace root, **jeden lockfile** (dnes jich má ekosystém 13)
- `@zion/contract` — Portal Contract v1; `@zion/api` — jediná datová cesta; `@zion/i18n` — jediná i18n; `@zion/ui` — jediný token set
- `@zion/world` s vynucenou hranicí (žádný React/Three/DOM) — AAA seam
- registry portálů generovaný z manifestů (`npm run codegen`)
- `scripts/check-boundaries.mjs` — vynucuje 6 pravidel, 0 závislostí, běží v ms
- **Brána** (`/`) a **Místnost** (`/room`), deep-link `/portal/<id>`
- tři živé portály: **Řetěz** (výška 104k, difficulty, peers), **Kovárna** (12 mincí, stav nohou), **Tržiště** (výloha s ověřenými náhledy)
- cs/en celé na serveru — do prohlížeče jde jediná klientská komponenta (přepínač jazyka)

## Co je hotové (F1 — Brána)

Obsah harvest z `apps/IntroPage` (`maintenance.html` + `intro-tabs.js`), přepsaný do **typovaných dat** (`core/gate/content.ts`), ne do JSX:

- hero: `ZION / TERRA NOVA ∞ OASIS / Multichain Dharma ekosystém` + vstup, OASIS preview, eXplorer
- **živý pás** — výška, difficulty, hashrate, block time a připojené mince z hlavního uzlu, ověřené při každém renderu
- **Co je ZION** — tři odstavce včetně fee splitu 89/5/5/1
- **Tři cesty na palubu** — Pozorovatel / Hráč / Stavitel
- **Vrstvy ekosystému** — L1–L6 jako rozcestník do portálů a služeb
- kotvy `#why` `#paths` `#layers`, cs/en, patička

Staré `apps/IntroPage` zůstává jako donor; apex DNS se nepřepíná, dokud Brána nepokryje jeho povrch (F6).

## Hierarchie pravdy

1. živý kód v `Kingdom/` a živé sondy služeb
2. `docs/3.2/StatusV3.md`
3. `NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md` (provoz, RC, G8)
4. tento strom (`ARCHITECTURE.md`, `PLAN.md`)
5. staré appky v `apps/` — **dárci orgánů**, ne pravda

Když se dokument a kód rozcházejí, platí kód. Když se rozcházejí dva dokumenty, platí ten výš v seznamu.
