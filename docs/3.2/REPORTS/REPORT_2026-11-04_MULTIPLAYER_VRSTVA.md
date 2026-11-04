# NIRVANA — jednotná multiplayer vrstva + tanky online

**Datum:** 2026-11-04 · **Kde:** `apps/nirvana-net` (server) + `apps/nirvana`
(klient) · **Stav:** nasazeno (`proto 21`).

## 1. Zadání

„Multiplayer logiku napříč celou Nirvanou" — ne pátou kopii, ale **jednu
vrstvu**, přes kterou projde každá hra, a do ní dotáhnout chybějící hry
(tanky na Saturnu).

## 2. Co bylo špatně

Každý režim měl vlastní obsluhu roztroušenou na čtyřech místech:

| Místo | Co tam bylo |
|---|---|
| `interface Room` | čtyři volitelné simulace `arena \| race \| fight \| moba` |
| `createRoom` | ternární přiřazení každé simulace |
| `joinRoom` / `leaveRoom` | čtyři `if (room.x) addX(...)` |
| herní smyčka | čtyři `if` bloky s vlastním krokem, stavem i snapshotem |
| `handleMessage` | deset `case` bloků, každý s kontrolou `room.moba` |

Přidat hru znamenalo sáhnout na **pět** míst a pokaždé znovu vymyslet
snapshot. Tanky by byly pátá kopie téhož.

## 3. Řešení: `Match` kontrakt

`apps/nirvana-net/src/match.ts`:

```ts
interface Match {
  game: GameId;
  join(id, seat): void;      // sedadlo + jméno ze ZIS
  leave(id): void;
  step(dt, ctx): void;       // simulace + eventy přes ctx.emit
  state(): RoomState;
  snapshot(id, now): ServerMessage | null;  // **pro jednoho hráče**
  message(id, msg): boolean; // herní zprávy; false = neznámá
  size(): number;
}
```

`matches.ts` je registr: aréna, závod, duel a MOBA se do kontraktu **obalí**
(jejich pravidla zůstala nedotčená), tanky ho plní rovnou. `index.ts` má
od té doby jednu smyčku:

```ts
room.match.step(dt, { now, emit, system });
room.state = room.match.state();
for (const conn of room.players.values()) {
  const message = room.match.snapshot(conn.id, now);  // mlha války per hráč
  if (message) send(conn, message);
}
```

a jediné místo pro herní zprávy:

```ts
default: {
  if (!conn.room) return sendError(conn, 'not_in_room');
  if (conn.room.match.message(conn.id, message)) return;
  sendError(conn, 'not_available');
}
```

**Důsledky:** nová hra = jeden `case` v registru (index se nemění) a
**emote je obecný** — funguje v každé místnosti, ne jen v MOBA.

## 4. Tanky online (Saturn)

- `GameId 'tanks'`, zprávy `aim` (absolutní úhel/síla) a `shoot`.
- Server drží **stejnou simulaci jako klient** (`core/saturn/tanks.ts`),
  takže dostřel, vítr, krátery ani poškození nemůžou být na dvou místech.
- **Tahová hra:** `aim`/`shoot` platí jen pro hráče na tahu; `aim` od soupeře
  se zahodí, rozsahy (`0–90°`, `5–100`) ořeže už parser protokolu.
- **Terén se posílá jen při změně** (`terrainVersion`): 161 výšek 15×/s by
  byl zbytečný provoz. Klient si drží poslední známý terén.
- **Prázdné sedlo hraje bot** (`autoBot`), takže se dá hrát i sám; jakmile
  se připojí druhý člověk, bot přestane (jinak by střílel za něj).
- Strany přiděluje server (`you: 0 | 1`); klient míří **svým** tankem a HUD
  porovnává tah s vlastní stranou (`SOUPEŘ MÍŘÍ` vs `BOT MÍŘÍ`).
- Klient přepisuje snapshoty do stejného `TanksState`, takže **2D i 3D
  renderer kreslí dál** a o síti nevědí.

## 4b. Lobby (`/multiplayer`, proto 22)

Server posílá **živý seznam místností** (`t: 'rooms'`) každému, kdo prošel
`hello`, a to při změně: nová místnost, hráč navíc, změna stavu, odchod.
Throttluje na **4×/s** a slévá změny — při otevírání místností by jinak
šel seznam 30×/s.

Klient drží `useNet().rooms` a stránka `/multiplayer` z něj kreslí karty
všech pěti her: otevřené místnosti (počet hráčů, stav), „Rychlá hra",
„Připojit" do konkrétní místnosti a banner „jsi v místnosti X" s odkazem
do hry a tlačítkem Odejít. Odkaz je i v herním docku (🌐 Online).

Dvě věci, které to odhalilo:

- **Prázdná místnost nemá v seznamu bliknout.** `pushRooms()` se proto
  nevolá v `createRoom` — místnost vzniká uvnitř `join`, takže by lobby
  na 250 ms ukázala místnost s 0 hráči.
- **„hraje se" u místnosti s jedním člověkem je lež.** Tanky teď hlásí
  `waiting`, dokud je volné sedlo (i když mezitím hraje bot), a `running`
  až když sedí dva lidi.

## 4c. Pozvánky a chat (proto 23)

**Pozvánky**
- Odkaz `/multiplayer?room=<id>` se po připojení sám přihlásí do místnosti
  (game z prefixu id). V banneru je **Pozvat odkazem** (schránka) i **Kód**,
  u každé otevřené místnosti 🔗 pro zkopírování pozvánky.
- `join` s neexistující místností vrací `room_missing` — dřív se tiše
  založila nová a pozvaný skončil v jiné hře. Plná místnost → `room_full`.
- **Join z odkazu čeká na `hello`.** `status === 'open'` znamená otevřený
  socket, ne dokončený handshake; join poslaný dřív skončil na `bad_frame`
  a pozvaný zůstal v parku (přesně to odhalil první běh testu).
- **Kopírování nesmí otevřít `window.prompt`** — blokuje stránku. Když
  prohlížeč schránku nedá, ukáže se pole s odkazem.

**Chat**
- `ChatPanel` je jedno tělo chatu pro plovoucí dok i lobby (dřív byl jen
  v doku, takže se v lobby nedalo domluvit).
- **Host smí psát** (1 zpráva / 4 s, 120 znaků); ZIS má dál 2 / 2 s a 240.
  Bez toho byl chat pro nepřihlášené jen čtecí tabule.
- Systémová zpráva „X se přidal / odešel" jde do kanálu místnosti.
- Hlavička chatu v lobby ukazuje **kanál** (id místnosti vs `park`) — jinak
  není poznat, proč zprávu nevidí ten, kdo zůstal v parku.
- Plovoucí dok je na `/multiplayer` schovaný — lobby má vlastní chat a dvě
  počítadla nepřečtených by mátla.

## 5. Ověření

| Test | Výsledek |
|---|---|
| `test/smoke.mjs` | **SMOKE OK** |
| `test/arena.mjs` | **ARENA OK** |
| `test/race.mjs` | **RACE OK** |
| `test/fight.mjs` | **PASSED** |
| `test/moba.mjs` | **VŠE OK** (3× po sobě) |
| `test/arena-bots.mjs` | **ARENA-BOTS OK** |
| `test/tanks.mjs` (nový) | **TANKS OK** — join 2, strany, terén jen při změně, aim gating, ořez rozsahu, výstřel → tah soupeře, bot nestřílí za člověka, úklid |
| `test/saturn-tanks.mjs` | **48/48** |
| live `/net/health` | `proto 21` |
| live 2 prohlížeče | A „TVŮJ TAH", B „SOUPEŘ MÍŘÍ"; po Aho výstřelu **tah předán B**; 0 chyb |
| mobile audit | **PASSED** (Saturn tanky 5 dotykových prvků) |
| `test/rooms.mjs` (nový) | **ROOMS OK** — seznam se rozšíří při vytvoření, příchodu, změně stavu i odchodu; úklid prázdné místnosti |
| live lobby (2 prohlížeče) | 5 karet, „Rychlá hra" → `tanks-1`, druhý vidí 1/2 „čeká na hráče" a připojí se, po odchodu banner zmizí, 0 chyb |
| `/multiplayer` responzivita | 390×844 / 844×390 / 768×1024 / 1440×900 → **0 px** přesahu |
| live pozvánka | A založí `tanks-2`, B otevře `?room=tanks-2` → **stejná místnost**, 0 chyb |
| live chat | B vidí systémové „X se přidal" i Aho zprávu; druhá zpráva hned → „příliš rychle" |

## 6. Opravený flaky test

`moba.mjs` kontroloval „projektil je ve snapshotu" — střela na **blízký**
cíl zmizí mezi dvěma snapshoty (15 Hz) a projektil mohl patřit i botovi
ve stejném týmu. Ověřeno na **starém** kódu: 1× OK, 1× FAIL. Nahrazeno
deterministickou kontrolou „kouzlo mimo dostřel server manu nestrhne".

## 7. Meze

- Tanky jsou **1v1**; týmové bitvy by chtěly víc sedadel a jiný snapshot.
- Tanky nemají reconnect (odpojením se sedlo uvolní a nastoupí bot).
- `Match` nemá společný `restart` — každá hra si nový zápas řídí sama
  (aréna 5 s, duel 6 s, MOBA 12 s, tanky 7 s). Sjednocení je další krok.
- Park a Kroniky (kromě tanků) multiplayer nemají — jsou to sólo záležitosti.
- Turnajová pravidla (kdo je host, výběr mapy, skóre série) neexistují.
