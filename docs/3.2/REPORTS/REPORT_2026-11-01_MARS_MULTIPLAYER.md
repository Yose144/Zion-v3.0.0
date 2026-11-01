# REPORT 2026-11-01 — MARS ARENA MULTIPLAYER (M2a)

> **Stav:** hotové a **nasazené** (net `20261101T124440Z`, web stejný den).
> **Live:** `https://nirvana.zionterranova.com/mars` → tlačítko **Multiplayer**.
> **Kde:** `apps/nirvana-net/src/arena.ts`, `apps/nirvana/src/core/arena/{weapons.ts,MarsMultiplayer.tsx}`,
> `apps/nirvana/src/core/net/{protocol.ts,useNet.tsx}`, `apps/nirvana/src/app/mars/page.tsx`.
> **Navazuje na:** `REPORT_2026-11-01_NIRVANA_CHAT_M1.md`, plán M2a.

## 1. Co to je

Mars aréna byla sólo proti botům. Teď má **online deathmatch**: server simuluje,
klient posílá jen vstup. Mapa, fyzika a čísla zbraní jsou **stejné moduly**
jako v prohlížeči — žádná druhá implementace, která by se rozešla.

| Vrstva | Kdo počítá |
|---|---|
| pohyb, gravitace, kolize | server (`stepBody` z `physics.ts`) |
| zásah railu (hitscan), rakety, splash | server (`pickTarget`, `raySolids`, `raySphere`) |
| smrt, respawn, fragy, smrti, pickupy | server |
| kameru, predikci vlastního pohybu, interpolaci ostatních | klient |

**Síť:** vstup 20 Hz (`input`), snapshoty 15 Hz, tick simulace 30 Hz s pevným
krokem (nezávisí na tom, jak rychle běží event loop).

## 2. Jak se příchozí změny propsaly do zbytku

- **`core/arena/weapons.ts`** — nový modul: poškození, cooldowny, munice,
  absorpce armor, `aimVector()`, `pickTarget()`, `applyDamage()`. Klient i server
  berou čísla odsud; `MarsArena.tsx` má vlastní herní smyčku, ale čísla už
  neopisuje.
- **`core/arena/MarsMultiplayer.tsx`** — samostatná scéna pro MP (predikce,
  interpolace, tabule). Sólo režim zůstal beze změny, takže se nerozbil
  osvědčený bot fight.
- **`useNet`** dostal `subscribe()` (snapshoty 15×/s ne přes React state),
  `joinArena()`, `leaveRoom()`, `sendInput()` (s 20 Hz stropem) a `youPlayerId`.
- **`/mars`** má v panelu tlačítko **Multiplayer — proti lidem**; HUD v MP
  režimu ukazuje ping, tabuli hráčů a stav zápasu.

## 3. Chyby, které to odhalilo (a jak jsou opravené)

1. **Duplicitní presence.** `join`/`leave` eventy chodily za každý kanál zvlášť
   (park → aréna = dva `join`), takže klient napočítal člena dvakrát. Nahrazeno
   zprávou `presence` s **celým seznamem pro každého zvlášť**.
2. **Tabule ukazovala `c_9448…` místo jména.** `presence` nese id identity,
   snapshot id spojení. Snapshot teď nese i `name`.
3. **Míření v testu minulo** — mezi spawny je centrální plošina. Test proto
   nejdřív ověří volnou linii (`raySolids` ze sdílené fyziky) a teprve pak pálí.
4. **Kolize dvou deployů.** `deploy-nirvana.sh` zplošťoval artefakt do pevného
   `.next/standalone-flat`; souběžná session mazala stejný adresář („file has
   vanished", rsync 24). Adresář je teď unikátní (`-$$`) a uklidí se v `trap`.

## 4. Ověření

**`npm run arena` (server, bez prohlížeče):** dva klienti se připojí, dostanou
`youPlayerId`, snapshoty se 2 hráči, pickupy a časem; hráč se **pohne** (> 1 m);
A zamíří na B a dvě rány railu ho zabijí → `kill` event (killer/victim sedí),
A má frag, B death, B je mrtvý; po 2,4 s **respawn** s 100 hp; po odpojení
zůstane 1 hráč a prázdná místnost se uklidí. **21/21 OK.**

**`npm run smoke` (chat + presence):** 34/34 OK (přibyly kontroly presence).

**E2E v prohlížeči (dva kontexty):** oba vidí 2 hráče v tabuli, HUD má ping
a zdraví, **server hýbe hráčem** (> 1 m), po zavření druhého zůstane 1 hráč.

**Live:** `wss://…/net` + `/mars?arenaDebug=1` → dva klienti, tabule se jmény
(`host-558`, `host-590`), 0 chyb v konzoli. Chat z M1 funguje dál.

## 5. Meze (poctivě)

- **Bez botů v MP** — prázdnou arénu nikdo nedoplní. Bot do roomu je další krok
  (`nav.ts` je čistý, takže to jde).
- **Bez zvuku a tracerů v MP** — sólo režim je má, multiplayer zatím ne.
- **Bez VR v MP** — VR zůstává jen v sólo aréně (a stejně není na headsetu
  otestované).
- **Bez klientské kompenzace zpoždění** — predikce + srovnání při > 1,6 m;
  na 150 ms je to hratelné, ale není to netcode z turnajové hry.
- **8 hráčů / 1 místnost** — strop je v protokolu (`MAX_PLAYERS`), víc by
  chtělo jiný návrh.

## 6. Další krok

- **M2b — Venuše multiplayer** (server už umí simulovat `race/physics.ts`,
  chybí rooms a snapshoty pro závod), nebo
- **boti do arény** (doplnit prázdné místo, ať je MP hratelný i v jednom), nebo
- **A1 — katalog avatarů** (3D avatary, navazuje na chat a tabuli).
