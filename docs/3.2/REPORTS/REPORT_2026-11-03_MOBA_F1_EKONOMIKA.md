# Report — MOBA: ekonomika a postup (F1, 2026-11-03)

> **Zadání:** „rozšíření hry, aby byla úplná — koukni i po online zdrojích;
> zatím jsme úplně na začátku."
> **Kde:** `apps/nirvana` (`core/moba/`) + `apps/nirvana-net`
> **Plán celku:** [`docs/3.3/MOBA-PRVNI-SVET-PLAN.md`](../3.3/MOBA-PRVNI-SVET-PLAN.md)
> **Deployed:** net `20261103T005220Z` (proto 8) · app `20261103T005505Z`

---

## 1. Co hra uměla a co jí chybělo

Podle [Dota 2 Mechanics](https://liquipedia.net/dota2/Mechanics),
[Gold](https://liquipedia.net/dota2/Gold) a
[LoL Summoner's Rift](https://wiki.leagueoflegends.com/en-us/Summoner%27s_Rift)
má úplná MOBA ~20 systémů. Hra měla linky, vlny, věže, Nexy, uzly L5, kouzla,
mlhu a tři itemy — ale **ekonomiku ne**: zlato jen za zabití, XP jen pro
zabijáka, žádný pasivní příjem, žádná ztráta při smrti, žádné asistence.

To je zásadní, protože bez ekonomiky:
- prohrávající linka nemá cestu zpět (nemá z čeho koupit item),
- podpora nemá co dělat (XP dostane jen ten, kdo dá poslední ránu),
- smrt nic nestojí, takže se umíráním jen zrychluje hra.

## 2. Co F1 přidala

| Systém | Před | Po |
|---|---|---|
| Zlato | jen zabití (minion 24, hrdina 180, tábor 45–175) | **+ pasivní 2/s**, strop 3000 → **9999** |
| XP | jen zabiják, level 1–15 | **radius 14 m**: zabiják 100 %, spojenci 50 % |
| Deny | neexistoval | vlastní minion **pod 50 % HP** jde dorazit; nepřítel dostane jen 50 % XP a žádné zlato |
| Asistence | neexistovala | spojenci v okruhu 14 m: **40 % odměny + 70 XP** |
| Smrt | jen respawn | **−10 % zlata** (strop 200) — umírání stojí |
| Věže | jen HP | **120 zlata celému týmu + 60 dorazivšímu, 120 XP**; minioni na ně **útočí** |
| Kouzla | pevná síla | **stupně z levelu** (Q/W/E 1/4/7/10, R 6/11/15), **+22 % za stupeň**, R do 6. úrovně zamčená |
| Boti | nekupovali | kupují podle školy Q (agresivní → čepel, podpůrné → aegis) |
| HUD | HP, mana, zlato | **XP bar**, stupeň kouzel (T1–T4), zamčená ultimátka |

### Dvě rozhodnutí, která stojí za zmínku

1. **Stupeň kouzel se neposílá v protokolu.** `spellRank(level, slot)` je
   čistá funkce v `spells.ts`; klient si ji počítá ze snapshotu stejně jako
   server. Kdyby se posílala, můžou se rozejít — a to je přesně chyba
   „vidím jiné číslo, než počítá server".
2. **Deny nemá vlastní tlačítko.** Je to poslední volba automatického útoku
   (nepřítel → monstrum → vlastní minion pod 50 %). Kdyby měl klávesu,
   rozejde se to s dotykovým ovládáním, které posílá tytéž eventy.

## 3. Ověření

| Test | Výsledek |
|---|---|
| `npx tsx apps/nirvana/test/moba-sim.mjs` | **77/77** (12 nových: pasivní zlato, strop, stupně, zamčená R, snapshot XP, nákup bota) |
| `npx tsc --noEmit` | čistý |
| `BASE=https://… node apps/nirvana/e2e/first-world.mjs` | **11/11** proti produkci |
| živě `/net/health` | `proto 8`, build `20261103T005220Z` |
| deploy smoke | `/` 200, textury 200, `:3010` 200 |

**Deploy pořadí:** nejdřív `deploy-nirvana-net.sh` (proto 8), pak
`deploy-nirvana.sh` (app) — nový klient by na starém serveru neměl `xp`
v snapshotu a HUD by ukazoval 0/1.

## 4. Co zůstává (další fáze)

Plán má šest fází; F1 je hotová, následuje:

- **F2 itemy**: 6 slotů, ~14 itemů s komponentami a recepty, prodej, obchod
  jen v základně (protokol: `sell` + nová id).
- **F3 mapa**: bushe (blokují vidění), řeka, T1/T2/T3 + **inhibitory**
  (super minioni, respawn 5 min).
- **F4 objektivy**: runy (bounty/haste/double damage), boss s Aegis.
- **F5 vidění a smrt**: wardy, buyback, respawn scaling.
- **F6 meta**: scoreboard (GPM/XPM), pozápasový souhrn, obtížnosti botů.

## 5. Meze (poctivě)

- **Bilanci jsem neladil na lidech** — čísla jsou odvozená ze standardu a
  zmenšená na 8minutový zápas; první sehrávky je budou posouvat.
- **Boti neumí deny** (jen hráč) — jejich výběr cíle je nepřítel → monstrum.
- **Minioni nechodí okolo věží** (žádná navigace) — útočí, až když je věž
  v dosahu na jejich ose linky.
- **Vizuální mlha (tmavé území) pořád není** — jednotky se neposílají,
  ale hráč nevidí „černo" (viz report mlhy).
- **Žádný zvuk pro level-up/nákup** — `mobaAudio.buy()` existuje, level
  nemá zvuk.

---

**Souvisí:** `apps/nirvana/AGENTS.md` § PRVNÍ SVĚT — ekonomika a postup ·
`UCETNICTVI`-style plán [`MOBA-PRVNI-SVET-PLAN.md`](../3.3/MOBA-PRVNI-SVET-PLAN.md) ·
commity `f044f6f08` (F1) + `11e95ffc4` (boti)
