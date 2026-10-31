# Kingdom — jeden klient ekosystému ZION

> **Stav:** F0 nezačata — existují jen tyto dokumenty. Žádný kód, žádný build, žádný deploy.
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

Zatím neexistuje. Po F0:

```bash
cd Kingdom
npm ci
npm run dev      # apps/kingdom na http://127.0.0.1:3020
npm run build
```

## Hierarchie pravdy

1. živý kód v `Kingdom/` a živé sondy služeb
2. `docs/3.2/StatusV3.md`
3. `NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md` (provoz, RC, G8)
4. tento strom (`ARCHITECTURE.md`, `PLAN.md`)
5. staré appky v `apps/` — **dárci orgánů**, ne pravda

Když se dokument a kód rozcházejí, platí kód. Když se rozcházejí dva dokumenty, platí ten výš v seznamu.
