# Report — Merkur · Souboj (M3) — 2026-11-01

## Zadání

👤: „další hra na Merkuru — jednoduchý vs jako Mortal Kombat, multiplayer bitka".

## Hotovo (jeden commit, `feat(nirvana): MERKUR SOUBOJ`)

**Hra:** klec na Merkuru, dva bojovníci z boku, pěst/kop/blok/skok,
best of 3, 60 s na kolo. Režim **cvičení proti botovi** i **online duel**
(server-authoritative). Skóre z online duelu jde do tabule `fight`, žetony
a denní výzva (`fight: 170`) fungují jako u arény/závodu.

### Architektura (držetelná, ne nová)

| Vrstva | Soubor | Co hlídá |
|---|---|---|
| sdílená simulace | `apps/nirvana/src/core/fight/duel.ts` | `stepDuel`/`stepFighter`, konstanty zbraní, fáze kol, `resetDuel`, `botInput` — **jeden zdroj pro klienta i server** (pravidlo M2a) |
| protokol | `core/net/protocol.ts` | `PROTO_VERSION 2→3`, `GameId += 'fight'`, `FightPlayerState`, eventy `round_start/round_end/duel_ko/duel_end`, input `block` |
| server | `apps/nirvana-net/src/fight.ts` + `index.ts` | místnost `fight` (cap `FIGHT_ROOM_SIZE=2`), tick 30 Hz, snapshot 15 Hz; **volné sedlo drží bot** (`Stín`), takže duel nikdy nečeká pasivně |
| klient MP | `core/fight/MercuryDuel.tsx` | predikce vlastního pohybu přes týž `stepFighter` (zásahy NE—ty velí server), snap > 0,8 m, interpolace soupeře, `hud.current` je jedni nosič dat pro onStats i debug háček |
| klient sólo | `core/fight/MercurySolo.tsx` | týž `stepDuel` + `botInput`; restart 5 s po matchEnd; objekty bojovníků nemění identitu (`resetDuel` in-place — refy animací nepřežijí výměnu) |
| scéna | `DuelStage.tsx` (povinně jeden pro oba režimy), `Fighter3D.tsx` (primitiva, animace čte `Fighter` z refu), `useFightKeys.ts` (jeden vstupní tok; dotyková tlačítka jen dispatchují KeyboardEvent) |
| navigace | `links.ts` (5. karta), planeta Merkur = vstup (`game:'mercury'` + panel přes novou mapu `PLANET_PANELS` v Shell) |
| pages | `app/mercury/page.tsx` (HUD: HP bary, pips, timer, odpočet, K.O., výsledek; žetony; tabule) |

### Opravy mimo Merkur (chyceny při cestě)

- **`PlanetDef.game:'park'` × panel `planet==='jupiter'`** — tlačítko „otevřít
  okno pouti" bylo mrtvé (state nabývá `'park'`, ne `'jupiter'`). Nalezeno a
  fixnuto přepravou panelu do `PLANET_PANELS` (klíč = hodnota `def.game`).
- Mars aréna: `matchState` potřeboval zúžení po rozšíření `snapshot.state`.

## Ověřeno

- `apps/nirvana-net`: **fight 24/24** (`npm run fight`: K.O. 2:0, blok maže
  poškození, round timeout, netlak těla, hrana klece, bot obsadí sedlo,
  restart zápasu; síť: capacity 2, fight-2 pro třetího, input hýbe, pěst
  ubírá HP, odpojení→meta-bot, úklid) + **regrese smoke / arena / race** (po
  bumpu proto 3 v testech).
- `tsc --noEmit` src čistý, `next build --webpack` OK, `/mercury` 200.
- **E2E dva headless Chromiumy** (`apps/nirvana/e2e/mercury-duel.mjs`,
  `?duelDebug=1`): 8/8 — oba vidí živého soupeře, pohyb se projeví v
  serverovém snapshotu, **zásah vidí obě strany** (authorita serveru),
  0 JS chyb, odpojení soupeře doplní bota. Screenshot:
  `.artifacts/render/mercury-20261101/duel-live.png` (cleared HUD i scéna).

## Meze (nehlasit jako hotové)

- Bez zvuku, bez VR, bez diváků; duchové odpojených ne — sedlo přebírá bot.
- Zásahy se na klientu **nepredikují** (jen pohyb) — zpětná vazba rány
  přichází se snapshotem (≈ ping + 66 ms). Rollback by byl další krok.
- Kolize hlavy/nohou chybí; úder za běhu není (v útoku se stojí — záměr).
- 8 hráčů/místnost neplatí pro duel: ten je dvoudenní kapací (`FIGHT_ROOM_SIZE`).
- Historie zápasů se neukládá (tabule pouti je max 10 na hru).

## Deploy (pořadí je důležité)

`PROTO_VERSION=3`: **nejdřív** `deploy-nirvana-net.sh`, **ihned vzápětí**
`deploy-nirvana.sh`. Starý klient na novém serveru dostane `proto_mismatch`
(odpojí se a po reloadu je OK); nový klient na starém serveru by se trefil
do `arena` fallbacku — proto nesázet appku před službou.

## Pasti (pro příště)

- `poll()` v E2E, který vrací poslední stav i po timeoutu = **falešná zelená**
  (reálně se stalo: služba mezitím zemřela a 6 checků "prošlo"). Vracet
  `null` mimo predikátu.
- R3F komponenta uvnitř `<Canvas>` mountuje effect až po GL init — na
  swiftshaderu minuty; timeouty lokálních E2E musí počítat s ~60–120 s.
- `hud.current` (ne jen `onStats`) musí nést čerstvá data, jinak debug háček
  lže a testy honí stíny.
- Držený `punch` = stojí na místě (úder blokuje pohyb) — testy musí
  nechat útočníka **nejdřív doběhnout** (`move` bez útoku), jinak se
  "zásahy" nikdy nesesbíhají.
