# REPORT 2026-11-01 — VENUŠE MULTIPLAYER (M2b)

> **Stav:** hotové a **nasazené** (net `20261101T131808Z`, web téhož dne).
> **Live:** `https://nirvana.zionterranova.com/venus` → tlačítko **Multiplayer**.
> **Kde:** `apps/nirvana-net/src/race.ts`, `apps/nirvana/src/core/race/{TrackStage.tsx,VenusMultiplayer.tsx}`,
> `apps/nirvana/src/app/venus/page.tsx`.
> **Navazuje na:** `REPORT_2026-11-01_MARS_MULTIPLAYER.md` (M2a), plán M2b.

## 1. Co to je

Venuše měla sólo závod proti třem botům. Teď má **online závod**: server simuluje
hovercrafty stejnou fyzikou i stejnou tratí, klient posílá jen plyn a zatáčení.
Odpočet, kola, pořadí i cílovka jsou serverové.

| Vrstva | Kdo počítá |
|---|---|
| jízda, okraj tratě, checkpointy, kola | server (`stepCraft`, `advanceLap`) |
| odpočet 3 s, start, cílovka, pořadí, nový závod po 8 s | server |
| kameru, predikci vlastního vozidla, interpolaci ostatních | klient |

## 2. Zajímavosti z implementace

- **Trať je jeden vizuál.** `TrackStage.tsx` (pás, okraje, brány, startovní
  čára) vytáhla geometrii z `VenusRace.tsx`, takže sólo i multiplayer kreslí
  totéž a opravuje se to na jednom místě.
- **Kola počítá `advanceLap` z `rivals.ts`** — stejná funkce jako u sólo botů.
  Tím je zaručené, že „kolo" znamená v obou režimech totéž.
- **Odpočet se restartuje, když někdo přistoupí** během odpočtu — pozdní
  příchod tak neukradne start.
- **Pozor na konvenci vstupu:** u závodu je `mz` plyn a `mx` zatáčení, kdežto
  u arény je to dopředu/doprava. Klient proto volá `joinGame('race')` a vstup
  mapuje jinak; dřívější `joinArena()` posílal `game: 'arena'` i pro Venuši
  a závod se vůbec nepřipojil (chvíli to vypadalo jako „server neposílá
  snapshoty").

## 3. Ověření

**`npm run race` — simulace (bez sítě, 7/7):** dva jezdci řízení stejnou AI
jako sólo boti; server odsimuluje tři kola — oba dojedou, pořadí 1 a 2, časy
mezi 60 a 200 s, `race_end` seřazený, každý 3 kola.

**`npm run race` — síť (11/11):** místnost `race-1`, `youPid`, snapshot se
dvěma jezdci a jmény, odpočet, `race_start`, **plyn hýbe vozítkem** (> 2 m,
rychlost roste), po odpojení zůstane 1 jezdec, místnost se uklidí.

**E2E v prohlížeči (11/11):** dva kontexty — odpočet na obrazovce, oba vidí
2 jezdce, závod běží, server hýbe vozítkem, tabule 2 řádky, HUD v km/h,
0 chyb v konzoli, po zavření druhého zůstane 1.

**Live:** `/venus?raceDebug=1`, dva prohlížeče — odpočet, start, pohyb,
tabule, 0 chyb. Sólo závod s boty funguje beze změny (sdílí jen `TrackStage`).

## 4. Meze (poctivě)

- **Bez duchů** — odpojený jezdec se z tratě odebere, nedojede jako ghost.
- **Bez botů** — prázdný závod je prázdný; doplnění boty je samostatný krok
  (`rivals.ts` je čistý, takže to jde).
- **Bez zvuku motoru** (sólo ho taky nemá — chybí v celém projektu).
- **8 jezdců na místnost**, stejný strop jako aréna.
- **Bez turnajového netcode** — predikce + srovnání při > 3 m.

## 5. Co dál

- **A1 — katalog avatarů** (200 z OASIS rosteru, procedurální 3D kit), nebo
- **boti do multiplayeru** (arény i závodu), nebo
- **M3 — avatary ve hře** (cizí hráč má svůj avatar z ZIS `avatar3d`).
