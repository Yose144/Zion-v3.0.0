# PRVNÍ SVĚT — online 2v2 (MOBA)

**Datum:** 2026-11-02 · **Route:** `/earth` · **Stav:** hratelné 2v2 proti sobě i proti botům, lokálně ověřeno

## Zadání

👤: „jasně, rozjedeme to" — navázání na sólo MOBA z předchozí dávky: **multiplayer**.

## Co je nové

### 1. Simulace umí víc hrdinů (jeden modul pro sólo i server)

`core/moba/sim.ts`:

- `createMobaMatch(seats)` — zápas z rozpisu sedaček (`{id, heroId, team, human}`),
  libovolný počet hrdinů na stranu (dnes 2v2, jde i 1v1);
- `stepMoba(state, dt, inputs)` — vstupy **po hrdinech** (`Record<id, input>`);
  hrdina bez vstupu je bot (AI zůstává uvnitř simu);
- `createMoba(player, enemy)` zůstává jako tenký obal pro sólo — klient i testy
  se nemusely přepisovat.

Tím platí pravidlo M2a: **server i klient počítají stejnou simulaci**, jen server
rozhoduje.

### 2. Protokol v5 (`PROTO_VERSION 4 → 5`)

- `GameId` += `'moba'`;
- `join` nese `heroId` (výběr postavy před připojením);
- `input` nese `attack`, `castSlot` (`Q/W/E/R`), `castX`, `castZ`;
- `snapshot` nese `game: 'moba'` + `moba: MobaSnapshot` (hrdinové, minioni,
  věže, Nexy, projektily, efekty, uzly, banner, čas).

### 3. Serverová místnost (`apps/nirvana-net/src/moba.ts`)

- kapacita **4** (2v2), tým se přiřazuje podle obsazenosti;
- když se do 6 s nesejde plná místnost, **volná sedla doplní boti** — hra nečeká
  (stejný princip jako „Stín" v Merkuru);
- odpočet 4 s → zápas; po konci pauza 12 s a nový zápas;
- kouzlo je **jednorázové** — server po ticku `cast` vyčistí, jinak by se
  sesílalo každý snímek;
- snapshot 15 Hz, tick 30 Hz, simulace se krokuje pevným `dt`.

### 4. Klient

- `MobaStage.tsx` — vykreslení **jen ze snapshotu** (hero pool 4, věže, uzly,
  minioni, projektily, efekty, kamera na tvého hrdinu). Používá ho sólo i online;
- `MobaGame.tsx` — sólo ovladač (sim v refu, vstup, HUD telemetrie);
- `MobaOnline.tsx` — připojení (`joinGame('moba', heroId)`), odběr snapshotů,
  vstup 20 Hz, HUD ze serverových dat;
- `/earth` má přepínač **Sólo vs bot / Online 2v2** a stav připojení
  („Připojuji se", „Čekám na hráče", odpočet, offline).

## Ověření

| Co | Výsledek |
|---|---|
| `tsc` (nirvana, moje soubory) | čisté |
| `next build` (nirvana) | OK, `/earth` 200 |
| `npm run build` (nirvana-net) | OK |
| **Server test** `node test/moba.mjs` | **14/14** (místnost, boti, start, pohyb, uzel L5, kouzlo, úklid) |
| Regrese sítě | `smoke` OK, `arena` OK, `race` OK, `fight` PASSED (vše na proto 5) |
| **E2E sólo** `first-world.mjs` | **11/11** |
| **E2E online 2v2** `moba-online.mjs` | **11/11** — dva prohlížeče, 4 hrdinové, pohyb se propsal druhému, kouzlo spotřebovalo manu a nasadilo cooldown, 0 chyb |

Screenshoty: `.artifacts/render/first-world-20261102/online-a.png`, `online-b.png`.

## Deploy (pořadí!)

**Nejdřív `deploy-nirvana-net.sh`, potom `deploy-nirvana.sh`** — protokol je 5.
Starý klient na novém serveru dostane `proto_mismatch` (po reloadu OK); nový
klient na starém serveru by místnost `moba` neznal.

Appku je potřeba buildit **bez** `NEXT_PUBLIC_NIRVANA_NET_URL` (lokální E2E ji
používá pro `ws://127.0.0.1:3011`); deploy skript to dělá sám.

## Meze (nehlasit jako hotové)

- **2v2 jen lidsky**, žádné 3v3/5v5, žádné hrdinové ban/pick fáze.
- Bez obchodu, itemů, úrovní kouzel, mlhy války a minimapy.
- Bez zvuku, bez dotykového ovládání na mobilu, bez VR.
- Boti jsou jednoduchá AI (nejbližší cíl, kouzla podle HP/vzdálenosti).
- Klient nepredikuje pohyb — u MOBA je priorita shoda se serverem, ne plynulost;
  při vysokém pingu to bude znát (další krok: predikce vlastního hrdiny).

## Reprodukce

```bash
# server
cd apps/nirvana-net && npm run build
NIRVANA_NET_PORT=3011 NIRVANA_NET_ALLOWED_ORIGINS="http://127.0.0.1:3010" node dist/nirvana-net/src/index.js
# appka (pro lokální online)
cd apps/nirvana && NEXT_PUBLIC_NIRVANA_NET_URL=ws://127.0.0.1:3011/net npm run build && npx next start -p 3010
# testy
node apps/nirvana-net/test/moba.mjs
node apps/nirvana/e2e/first-world.mjs
node apps/nirvana/e2e/moba-online.mjs
```

---

## Dodatek: predikce pohybu + minimapa (stejný den)

### Predikce vlastního hrdiny

Server posílá snapshoty 15 Hz, takže vlastní postava cukala. `MobaOnline`
teď drží **predikovanou polohu** a počítá ji stejnou rychlostí jako sim
(`PREDICT_SPEED = 6.2`, stejná konstanta jako v `sim.ts`):

- každý frame posune predikci podle vstupu,
- odchylka > **1,6 m** = teleport na server (stejná hranice jako v aréně),
- jinak plynulé dorovnání 18 %/frame,
- **predikuje se jen pohyb** — poškození, smrt i kouzla rozhoduje server.

`MobaStage` dostal `selfPose` a kreslí vlastního hrdinu (i kameru) z predikce.
Když hrdina zemře, predikce se vypne a scéna se řídí serverem.

### Minimapa

`MobaMinimap` kreslí z jednoho snapshotu (žádný vlastní stav): tři linky, věže
a Nexy (barvy stran, mrtvé věže ztlumené), **uzly L5** s barvou vlastníka,
minioni jako tečky a hrdinové s bílým kroužkem u toho tvého. Aktualizace 5×/s
spolu s HUD — na mapu to stačí a herní smyčku to nezatěžuje.

### Chyba, kterou odhalil E2E

Kouzlo se občas **tiše ztratilo**: `sendMobaInput` má throttle 20 Hz a volající
zahazoval zařazené kouzlo bez ohledu na to, jestli se zpráva opravdu odeslala.
Nově hook vrací `boolean` a kouzlo se maže jen po skutečném odeslání (navíc
expiruje po 400 ms, aby neviselo, když hráč odjede kurzorem mimo plochu).

### Ověření dodatku

| Co | Výsledek |
|---|---|
| E2E online 2v2 | **13/13** — navíc „minimapa kreslí" (painted pixely) a „predikce aktivní a u serveru" |
| E2E sólo | 11/11 (minimapa je i v sólo HUD) |
| `tsc` + `next build` | čisté |

---

## Dodatek 2: zvuk, obchod a 3v3 (autonomní dávka)

### Zvuk (syntéza, žádné soubory)

`core/moba/audio.ts` — WebAudio z oscilátorů a šumu, stejné pravidlo jako
u arény: v repu není jediný zvukový soubor. AudioContext se otevírá až po gestu.

Zvuky: zásah, kouzlo (podle barvy postavy), smrt, převzetí uzlu L5, nová vlna,
nákup, konec zápasu (vítězný a prohraný akord).

`useMobaAudio.ts` je **jeden háček pro sólo i online**: sim eventy neposílá
(snapshot je jediný zdroj pravdy), takže zvuk se odvozuje z rozdílu dvou
snapshotů — spadlo mi HP → zásah, změnil se vlastník uzlu → převzetí…
Když zvuk selže, hra běží dál.

### Obchod a ekonomika

- zlato: start **320**, minion **+24**, hrdina **+180**, převzetí uzlu **+70**
- tři itemy za **400**: **Čepel** (+25 % poškození), **Aegis** (+250 max HP,
  −10 % příchozího poškození), **Sandály** (+15 % rychlosti)
- nákup jde přes sim (`buyItem`), takže **sólo i server rozhodují stejně**;
  online posílá novou zprávu `{t:'buy', item}` (protokol **6**)
- HUD: zlato + tři tlačítka (koupeno / cena / zamčeno, když není zlato)

### 3v3

- místnost má kapacitu **6**, každá strana **3 hrdiny**; volná sedla dál plní boti
- **zákaz duplicit:** když je vybraný hrdina obsazený, server dá první volného
  z botího poolu a poznamená to (`lastError`)
- sim je na počet hrdinů nezávislý (`createMobaMatch`), takže 2v2/3v3 jsou jen
  data — fyzika i kouzla zůstávají stejné

### Ověření dodatku

| Co | Výsledek |
|---|---|
| Sim test (`tsx`) | **31/31** — přibylo zlato, koupě, efekty itemů, 3v3 |
| Server test `test/moba.mjs` | **17/17** — kapacita 6, tři na stranu, nákup bez zlata nic nekoupí |
| Regrese sítě | smoke / arena / race OK, fight PASSED (proto 6) |
| E2E sólo | 11/11 |
| **E2E online 3v3** | **17/17** — 6 hrdinů, tři na stranu, obchod v HUD, minimapa, predikce |
