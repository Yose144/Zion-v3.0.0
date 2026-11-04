# NIRVANA — zvuk, VR, progrese, vnější světy a hlediště

**Datum:** 2026-11-04
**Rozsah:** `apps/nirvana`, `apps/nirvana-net`
**Stav:** hotovo a ověřeno lokálně (build, testy, headless audity, živý test se dvěma prohlížeči). **Nenasazeno** — deploy čeká na 👤.

---

## 0) Proč tohle zadání

👤: „koukni se prosím na nirvanu a budeme ji dál rozšiřovat a opravovat."

Audit na začátku (měřeno, ne odhad):

| Co | Stav |
|---|---|
| `nirvana.zionterranova.com` | 200, `proto 26`, net `proto 26` |
| `apps/nirvana` `tsc --noEmit` | 0 chyb |
| `apps/nirvana-net` build | OK |
| Net testy (10 sad) | 10/10 PASS |
| TODO/FIXME v `src` | 0 |

Kód byl tedy zdravý — „opravovat" znamenalo dohánět tenké vrstvy. Nalezené mezery:

1. zvuk měly jen 2 hry ze 7 (a každá s vlastním `AudioContext`),
2. VR měly jen 2 scény ze 7,
3. progrese byla izolovaná (skóre posílaly 3 hry, tabuli znala jen pouť,
   zápis dohrané hry byl zkopírovaný na čtyřech místech),
4. tři planety (Uran, Neptun, Pluto) byly koule bez vchodu,
5. neexistoval divácký režim,
6. HUD chyběl na pěti površích (`/earth`, `/mercury`, `/saturn`,
   `/multiplayer`, `/hiran`).

👤 vybral všech šest směrů; tahle dávka je všech šest.

---

## 1) Zvuk — jeden engine pro celou Nirvanu

**Nový modul:** `src/core/audio/engine.ts`

- jediný `AudioContext`, jediný master gain, **jeden strop hlasů** (24),
- strop je **časový** (`voiceEnds` podle `ctx.currentTime`), ne závislý na
  `onended` — ten v některých prohlížečích u zastaveného nodu nepřijde a
  čítač by se zasekl na maximu (zvuk by navždy ztichl),
- **throttling podle jména** (`MIN_GAP`): zásah chodí 15×/s, tři boti
  střílí naráz,
- **ztlumení** je jedna volba pro celou appku (`localStorage nirvana.sound.v1`),
  tlačítko `SoundToggle` v HUD,
- **spojitý motor** (`startEngineLoop`) pro Venuši — výška a jas podle
  rychlosti, `stop()` v cleanupu.

`core/arena/audio.ts` a `core/moba/audio.ts` zůstaly jako tenké průhledné
obaly (API se neměnilo, desítky volání zůstaly).

### Kde zvuk nově je

| Hra | Zvuky |
|---|---|
| Merkur (sólo + online) | pěst, kop, blok, gong kola, konec zápasu — z **poklesu HP** |
| Venuše (sólo + online) | motor podle rychlosti, náraz do zdi, kolo, cílovka, odpočet |
| Saturn tanky (2D/3D, online) | výstřel, dopad, změna tahu, výhra/prohra |
| Pouť | podle skříně (Pong pálka, Breakout cihla, Had polknutí, Tetris řádek, Asteroidy výstřel), střelnice, žetony |

**Pravidlo:** zvuk se odvozuje z událostí, které už nastaly (pokles HP,
změna `shotsFired`, `onScore`), nikdy z klávesy — v multiplayeru střílí
server, takže „zahraj při klávese" by v MP mlčelo.

### Ověření

- `npx tsx test/audio.mjs` — 11/11 (falešný `AudioContext` počítá nody:
  před gestem žádný kontext, ztlumeno = ticho, 60 volání za 60 ms = ≤ 3 zvuky,
  strop hlasů, 38 jmenovaných zvuků hraje, volba přežije reload).
- Headless audit (produkční build): HUD se zvukem na 9 površích, po startu
  souboje existuje právě 1 kontext, souboj vydá zvuk, ztlumení ho opravdu
  vypne (nové nody nevznikají), motor závodu vytvoří oscilátory.

---

## 2) VR — do všech her

**Nový modul:** `src/core/xr/` (`index.ts`, `inputs.tsx`, `VrButton.tsx`)

- jeden store (`useXr`) + jedno tlačítko + jedno čtení ovladačů,
- ovladače posílají **syntetické klávesy** (`createVrKeys`) a pointer
  události — hry nemají druhou vstupní větev,
- `<XR store>` je uvnitř `<Canvas>`, store patří stránce (tlačítko je v DOM).

| Hra | Ovládání ve VR |
|---|---|
| Merkur | levý stick pohyb, spoušť pěst, gripy kop a blok, A skok |
| Venuše | `XROrigin` jede s vozítkem (pohled z kokpitu), stick plyn/brzda |
| Saturn | VR vynutí 3D scénu, stick míří, spoušť pálí |
| MOBA | stick = WASD, paprsek ovladače → zem → projekce do pixelu → `pointermove` (kouzlo letí tam, kam se díváš), spoušť = útok |

Cinematic kamery se ve VR vypínají (`DuelCamera xr`, `VenusRace/Multiplayer
if (!xr)`, `MobaStage xr`, `TanksScene` bez `CameraRig`) — jinak by „letěla
hlava".

**Mez:** na headsetu netestováno. Headless ověřuje jen, že se scéna
s namontovaným `<XR>` rozjede, tlačítko VR je vidět a konzole je bez chyb
(14/14 proti produkčnímu buildu).

---

## 3) Progrese a žebříčky

**Nový modul:** `src/core/progress/run.ts` → `recordRun()`

Jediná cesta, jak zapsat dohranou hru:

- žetony (1 za hru, +2 za osobní rekord, + bonus za pódium/výhru),
- denní výzva (jednou denně, jen když sedí hra a cíl),
- **level** z počtu dohraných her (0 → 1, 2 → 2, 8 → 3, 18 → 4 …),
  ne z žetonů — ty se utrácejí za kolo a hráč by „degradoval",
- odeslání skóre na tabuli (vrací `posted`, aby šlo počkat na refresh).

Nahradilo čtyři kopie (`/park`, `/mars`, `/venus`, `/mercury`); nově zapisují
i **MOBA** (`/earth`) a **Saturn tanky**.

**Žebříčky** (`src/core/progress/boards.ts`, `GameBoard`, `LeaderboardsPanel`):

- jedno okno v HUD (🏆) se všemi **11 hrami** (přibyla `moba` a `tanks`),
- kompaktní tabule v menu Marsu, Merkuru, Venuše, Prvního světa i Saturnu —
  dřív tabuli znala jen pouť,
- jedna cache (`useScores`), invalidovaná po odeslání skóre.

HUD nově ukazuje **level** a tlačítko žebříčků; dokud se profil nenačte,
ukazuje `—` (dřív na půl vteřiny lhal „level 1").

**Ověření:** `npx tsx test/progress.mjs` 23/23; headless audit 13/13
(level v HUD, okno s 11 kartami, tabule v menu 5 her); důkaz, že ukončený
zápas MOBY zapíše hru i skóre na tabuli (6/6).

---

## 4) Vnější planety — Uran, Neptun, Pluto

**Nové routy:** `/uranus`, `/neptune`, `/pluto` (`core/outer/`)

- otočná planeta ve scéně (sklon osy ze skutečných dat: Uran 97,8°, Pluto
  122,5°), hvězdné pozadí, prstence u Uranu,
- dosier se šesti reálnými čísly (NASA/JPL) + text světa v cs+en,
- řetěz „dál": Uran → Neptun → Pluto,
- **Pluto nemá texturu** — kreslí se proceduralně (deterministický canvas:
  krátery + světlá pláň ve tvaru srdce), takže v repu nepřibyl žádný asset,
- katalog planet má nový typ `PlanetId`/`PlanetGameId` na jednom místě
  (dřív byla unie opsaná ve čtyřech souborech),
- planety jsou registrované v `LinkEngine`, takže klik = přelet + panel s CTA.

**Ověření:** `npx tsx test/outer-worlds.mjs` 22/22 (data, katalog,
registrace do navigace, anchor bez NaN), `test/links.mjs` 65/65, headless
audit 19/19 proti produkčnímu buildu + screenshoty
(`.artifacts/render/outer-2026-11-04/`).

**Co našel až screenshot** (kód to neukáže): planeta byla moc blízko a
přetékala z okna, panel seděl na herním HUD a prstenec Uranu se z hrany
kreslil jako dvě čáry sbíhající se v „V".

---

## 5) Hlediště — diváci (protokol 27)

- divák se připojí do **existující** místnosti (`join` + `spectate: true`),
- server ho vede v `room.spectators`, ne v `room.players` → **nedostane
  sedlo**, nepočítá se do kapacity, jeho vstup se zahazuje,
- dostává stejné snapshoty jako hráči (pro MOBU nefiltrovaný divácký pohled),
- lobby ukazuje `spectators` zvlášť a má odkaz **„Dívat se"**,
- hlediště je URL: `?watch=arena-2` (`core/net/watch.ts`, validace proti
  `^(arena|race|fight|moba|tanks)-\d+$`), stav se čte až v efektu
  (jinak hydration mismatch),
- v aréně pruh **„👁 DÍVÁŠ SE"** s id místnosti a cestou do lobby.

**Pilot je aréna** — ostatní hry mají stejnou serverovou cestu, jen
potřebují `spectateRoom()` ve svém `join` efektu (zdokumentováno).

**Ověření:**

- `apps/nirvana-net/test/spectate.mjs` — 11/11 (divák dostane potvrzení
  s příznakem a historii, dostává snapshoty, **nepřidá entitu** do hry,
  lobby ho počítá zvlášť, jeho vstup hru nerozbije, odchod nemaže místnost,
  dívat se na neexistující místnost nejde),
- živý test se dvěma prohlížeči (hráč v aréně + divák ve stejné místnosti
  přes `?watch=`) — divák je připojený a vidí běžící zápas.

---

## 6) Opravy, které vypadly z auditu

| Co | Detail |
|---|---|
| HUD chyběl na 5 površích | `/earth`, `/mercury`, `/saturn`, `/multiplayer`, `/hiran` — bez lišty se z těch her nedalo přepnout jinam |
| Lišta s 11 hrami | pás se posouvá (`overflow-x: auto` + mask fade), nápověda k ovládání ustupuje pod 1560 px; zalomená lišta zakrývala spodek hry |
| Emoji přelézalo první písmeno | „První svět" → „rvní svět"; `width: 1.15em` + `overflow: hidden` na `span[aria-hidden]` |
| Level blikal jako 1 | dokud se profil nenačte, ukazuje se `—` |
| Panel vnější planety kryl HUD | `bottom: 3.8rem` |

**Pre-existing, neopraveno (mimo zadání):** konzole v **dev** režimu hlásí
`Attempted to synchronously unmount a root…`. Reprodukuje se i na
`/multiplayer` a `/avatars`, kde žádné XR není → je to Next dev overlay
(`<nextjs-portal>`), v produkčním buildu se neobjevuje. Screenshoty a
audity konzole je proto potřeba dělat proti `next start`.

---

## 7) Ověření (souhrn)

| Sada | Výsledek |
|---|---|
| `apps/nirvana` `tsc --noEmit` | 0 chyb |
| `apps/nirvana` `next build` | OK (bez zapečené lokální WS URL) |
| `apps/nirvana-net` build | OK |
| Net testy | **11/11** (smoke, arena, arena-bots, race, fight, tanks, moba, rooms, resume, humans, **spectate**) |
| `test/audio.mjs` | 11/11 |
| `test/progress.mjs` | 23/23 |
| `test/outer-worlds.mjs` | 22/22 |
| `test/links.mjs` | 65/65 |
| `test/saturn-tanks.mjs` | 48/48 |
| `test/moba-sim.mjs` | PASS |
| Headless: zvuk | 18/18 |
| Headless: VR smoke | 14/14 |
| Headless: progrese | 13/13 |
| Headless: MOBA zápis | 6/6 |
| Headless: vnější světy | 19/19 + 3 screenshoty |
| Headless: hlediště | 6/6 + živý test 6/6 |

---

## 8) Co je potřeba pro nasazení

1. **`PROTO_VERSION` 26 → 27.** Deploy pořadí: **`deploy-nirvana-net.sh`
   první**, pak appka. Opačně by klient na starém serveru dostal
   `proto_mismatch` (po reloadu OK) — a diváci by se nepřipojili vůbec.
2. Appku buildovat **bez** `NEXT_PUBLIC_NIRVANA_NET_URL` (jinak se do
   bundlu zapeče lokální adresa; tuhle past už AGENTS zná).
3. Vnější planety jsou za ZAP pasem stejně jako zbytek Nirvany — nic
   dalšího se nemění.
4. VR zůstává „netestováno na headsetu"; hlediště je zatím jen aréna.

---

## 8b) Dodatek — hlediště ve všech hrách a šestá skříň

Po prvním kole byly dvě věci nedotažené: hlediště umělo jen arénu a pouť
měla pět skříní.

**Hlediště pro všech pět her.** Server i protokol to uměly; chybělo napojení
v klientu. Každá stránka si `?watch=<room>` přečte v efektu, sama se přepne
do multiplayeru a hra v `join` efektu zavolá `spectateRoom()` místo
`joinGame()`. Pruh „DÍVÁŠ SE" je jedna komponenta (`SpectatorBar`).
Saturn navíc musí tanky otevřít sám — jsou celoobrazovková hra nad archivem.

Ověřeno živě pro **všech pět her** (hráč nastoupí, divák se připojí do
stejné místnosti, vidí herní HUD a pruh hlediště, není offline):
`.artifacts/probe/watch-all-live.mjs`.

**Nová hra: Věž (šestá skříň).** Kvádr se posouvá, hráč ho položí
(klepnutí / mezerník). Přesný zásah = +25 a kvádr zůstane široký, nepřesný
ho zúží podle překryvu, úplně mimo = konec. Na každý kvádr je čas, takže
se nedá čekat. Ovládá se myší i klávesnicí — proto má kontrakt her nový
**volitelný `tap()`** (dosud uměl jen plynulou polohu a klávesy).

Zapojeno do všech seznamů (typ, registr, šest skříní na oblouku, tabule,
API, denní výzva s cílem 250, žebříčky) — **12 her** v přehledu.

Ověřeno: `test/park-tower.mjs` 11/11, `.artifacts/probe/tower-audit.mjs`
7/7 (šest skříní, klepnutí položí kvádr, hra jde dohrát, profil zná
`tower`), plus regresní sady: routy 16/16, zvuk 18/18, progrese 13/13,
net 11/11.

---

## 9) Meze, které se nemají hlásit jako hotové

- **VR na skutečném headsetu** — ověřeno jen headless (scéna se rozjede,
  tlačítko je vidět). Ovladače, míření paprskem i komfort jsou nevyzkoušené.
- **Hlediště** je hotové pro všech pět her, ale divák v MOBě vidí
  nefiltrovaný pohled (záměr) — kdyby to mělo být jinak, je potřeba
  týmový filtr i pro diváky.
- **Zvuk** je syntéza, ne nahrávky: není hudba, není dabing, není
  prostorový zvuk (HRTF).
- **Progrese** je v `localStorage` — bez účtu, bez synchronizace mezi
  zařízeními a bez odměn s hodnotou (záměr: hra nehraje o peníze).
- **Vnější planety** jsou prezentace, ne hry — žádná mechanika.
- **Nové planety v soustavě** mají stylizované měřítko (jako celá soustava).

---

## 10) Změněné soubory (výběr)

```
apps/nirvana/src/core/audio/engine.ts                     (nový)
apps/nirvana/src/core/xr/{index.ts,inputs.tsx,VrButton.tsx} (nové)
apps/nirvana/src/core/progress/{run.ts,boards.ts}          (nové)
apps/nirvana/src/core/games/{GameBoard,LeaderboardsPanel}.tsx (nové)
apps/nirvana/src/core/outer/{worlds.ts,OuterWorldScene.tsx,OuterWorldPage.tsx} (nové)
apps/nirvana/src/app/{uranus,neptune,pluto}/page.tsx       (nové)
apps/nirvana/src/core/net/watch.ts                         (nový)
apps/nirvana/src/core/net/{protocol.ts,useNet.tsx}
apps/nirvana/src/core/{arena,moba,race,saturn,fight}/*
apps/nirvana/src/app/{mars,venus,mercury,earth,saturn,park,multiplayer}/page.tsx
apps/nirvana/src/core/games/{GameHud.tsx,links.ts}
apps/nirvana/src/core/shell/{Shell.tsx,SoundToggle.tsx}
apps/nirvana/src/core/scene/universe/{planetCatalog.ts,SolarSystem.tsx,Universe.tsx,proceduralTexture.ts}
apps/nirvana-net/src/index.ts
apps/nirvana/test/{audio,progress,outer-worlds}.mjs        (nové)
apps/nirvana-net/test/spectate.mjs                          (nový)
```

Commity: `7d9a64ca3` (zvuk), VR a vnější planety byly strženy do commitů
paralelní session, poslední dávka `686ea8125` (vnější světy + hlediště,
proto 27).
