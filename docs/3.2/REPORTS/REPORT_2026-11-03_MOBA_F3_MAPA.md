# Report — MOBA: mapa (F3, 2026-11-03)

> **Zadání:** „F3" — třetí fáze plánu `docs/3.3/MOBA-PRVNI-SVET-PLAN.md`.
> **Kde:** `apps/nirvana` (`core/moba/`) + `apps/nirvana-net`
> **Deployed:** net `20261103T021158Z` (proto 10) · app `20261103T021329Z`

---

## 1. Výchozí stav

Mapa byly tři rovné linky s **dvěma věžemi** a Nexem na každé straně. Mapa
byla plně průhledná (mlha F1 sice existovala, ale bez krytí), prolomená linka
neznamenala nic (Nexa se dala otevřít už po dvou věžích) a minioni jen
pochodovali — na věže neútočili.

## 2. Co F3 přidala

### Bushe — past na vidění

8 keřů (`BUSHES`): 4 na linkách, 2 ve středu, 2 v jungle. Pravidlo:

> Jednotka v bushi je vidět, jen když se zdroj vidění dostane blíž než
> **3,4 m** (`BUSH_REVEAL`). Mimo bush platí normální radius (hrdina 14 m).

Filtruje se **až snapshot** (`mobaSnapshot`), sim vidí všechno — stejné
pravidlo jako u mlhy. Díky tomu jde gankovat a bush má smysl bránit.

### Řeka

Vizuální pás ve středu (`RIVER`, šířka 9 m) ve scéně i na minimapě.
**Nezpomaluje** — trestal by půlku mapy a nikdo by přes ni nešel.

### Třetí věž + inhibitory (26 struktur)

Dřív: 12 věží + 2 Nexy. Teď **18 věží + 6 inhibitorů + 2 Nexy**.
Každá linka má řetěz:

```
vnější (12) → vnitřní (24) → základnová (33) → inhibitor (37) → Nexa (42)
```

- **Krytí:** každá struktura je nedobytná, dokud stojí ta před ní
  (`isStructureProtected`, jeden zdroj pravdy pro sim, scénu i minimapu).
- **Nexa** je odemčená, jakmile padne **inhibitor** na kterékoli lince.
- **Základnová věž** je tvrdší (2200 HP, 78 dmg), **inhibitor nestřílí**
  (1800 HP) — jeho hodnota je v tom, co pustí.

### Super minioni

Když padne inhibitor, dostane **protistrana** do té linky navíc super miniona
každou vlnu: **680 HP, 42 dmg, 2× zlato i XP**. Inhibitor po **5 minutách**
vyroste zpět (a super minioni přestanou).

Minion teď nese vlastní staty (`damage/range/attackMs/speed/super`), takže
super minion je **jeden typ**, ne druhá smyčka.

### Vykreslení

- **Scéna:** keře jako průhledné zelené koule (ať je vidět, kdo v nich stojí),
  modrý pás řeky, inhibitor jako kamenný sloup se zlatým prstencem, větší
  super minioni.
- **Minimapa:** keře (zelené tečky), řeka, inhibitor jako **kosočtverec**
  (od věže na první pohled), super minioni větší.

## 3. Ověření

| Test | Výsledek |
|---|---|
| `npx tsx apps/nirvana/test/moba-sim.mjs` | **105/105** (13 nových: bush z dálky/zblízka/mimo, celý řetěz krytí, super minion po pádu inhibitoru, respawn) |
| `apps/nirvana-net/test/moba.mjs` (lokální server) | **22/22**, včetně 26 struktur |
| `npx tsc --noEmit` | čistý |
| `e2e/first-world.mjs` proti produkci | **13/13** (nově „26 struktur") |
| živě | `/net/health` → **proto 10**, app `20261103T021329Z`, smoke 200 |

## 4. Co se cestou pokazilo

**Root `node_modules` se rozbil** (chyběl `.bin/tsc` a @types) — `npx tsc`
začal vracet „This is not the tsc command" a `next/server` nešel najít.
Příčina: souběh s `npm ci` paralelní session. Řešení `npm ci` v rootu;
po něm typecheck znovu prošel. Poznámka je v `apps/nirvana/AGENTS.md` —
„čistý build" bez skutečného typechecku není ověřený build.

## 5. Meze (poctivě)

- **Obchod je pořád dostupný kdekoli** — vázání na základnu (nebo doručení)
  zůstává otevřené; je to spíš ekonomika než mapa.
- **Terén nemá kolizi ani pathfinding.** Minioni jdou po ose linky a útočí na
  strukturu, když je v dosahu; neobcházejí věže ani se nevyhýbají keřům.
- **Bush je kruh, ne polygon** — krytí je binární (jsi/nejsi v něm), žádné
  částečné zakrytí.
- **Řeka je jen vizuál** (žádné zpomalení, žádné runy — ty patří do F4).
- **Žádné wardy** — vidění drží jen jednotky, věže, uzly a item Orlí oko.
- **Inhibitory se nedají “denyovat”** a nemají animaci pádu/rustu.

## 6. Co dál

- **F4 — objektivy**: runy (bounty/haste/double damage) každé 2 minuty a
  **boss s Aegis** (jednorázové vzkříšení), zesilující se v čase.
- **F5** — wardy, buyback, respawn scaling.
- **F6** — scoreboard (GPM/XPM), pozápasový souhrn, obtížnosti botů.

---

**Souvisí:** [`MOBA-PRVNI-SVET-PLAN.md`](../3.3/MOBA-PRVNI-SVET-PLAN.md) ·
`apps/nirvana/AGENTS.md` § PRVNÍ SVĚT — mapa · commit `fbacde700` (F3)
