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

## 8c) Dodatek — MOBA: mistrovství hrdiny a bounty (protokol 28)

MOBA měla do téhle chvíle jen jeden „druhý život": denní výzvu. Po pár
zápasech všechno splynulo — kdo hrál za Krišnu a kdo za Šivu, nikde
nezůstalo. A ekonomika znala jen plochou odměnu 180 za zabití, takže
nakrmený hrdina byl sice silný, ale nikdo neměl důvod ho zastavovat.

**Mistrovství hrdiny** (`core/moba/mastery.ts`)

- každá z 200 postav má vlastní XP, počet zápasů a titul (devět úrovní:
  Učeň → Poutník → Znalec → Mistr → Vědmysl → Strážce kruhu → Světlonoš →
  První jméno → Kruh sám),
- XP jen z odehraného zápasu (výhra, zabití, poškození, MVP); sólo proti
  botům za polovinu, aby se nedalo farmit,
- **nikdy neposiluje hru** — je to titul, ne +dmg. Jinak by z výběru
  postavy bylo pay-to-grind,
- „hrdina dne" je deterministický z data a dává +50 % XP (tempo, ne sílu),
- pick screen ukazuje odznak („5 · Vědmysl") u každé postavy a hvězdu
  u hrdiny dne; výsledková karta přidá „+X XP" a nový titul.

**Bounty za sérii**

- odměna za zabití roste se sérií oběti: `180 + 60 × série`, strop 4
  (`bountyFor`), takže nakrmený hrdina je cenný cíl a soupeř má cestu zpět,
- zabití hrdiny se sérií ≥3 se hlásí jako **SHUTDOWN**,
- série se resetuje smrtí a je ve snapshotu → HUD ukáže „🔥N".

**Bonus: opravený flaky test.** `arena.mjs` padal 2× ze 3 běhů na
„B je mrtvý / čeká na respawn" — četl poslední snapshot, ale respawn
(2,4 s) ho mezitím stihl vzkřísit. Teď hledá kterýkoli snapshot, kde je
hráč mrtvý. 4/4 běhy zelené. Obecné pravidlo: test přechodového stavu
nesmí číst „aktuální" hodnotu, ale historii zpráv.

**Ověřeno:** `test/moba-mastery.mjs` 33/33, `moba-sim.mjs` PASS, balance
12 zápasů (299 s, 5,9 zabití, 1 timeout — stejné jako před změnou),
`tsc` 0 chyb, build OK, headless audit 10/10 + screenshot pick screenu,
net 11/11 sad. Balanc se nezměnil, protože bounty mění jen odměnu,
ne poškození.

---

## 8d) Dodatek — aspekty kouzel a týmový objektiv (protokol 29)

**Aspekty kouzel** (`spells.ts`). Před zápasem si hráč vybírá jednu ze dvou
variant své školy — není to buff, je to **obchod**:

| | ostrá (`a`) | ochranná (`b`) |
|---|---|---|
| poškození | +14 % | −12 % |
| štít a léčení | −20 % | +35 % |
| rádius | −6 % | +10 % |
| cooldown | −4 % | +4 % |

Jména jsou per škola (oheň: Žár / Popel, bouře: Blesk / Příliv, vesmír:
Hvězdný jas / Tichý obzor…), takže volba zní jako ta postava, ne jako
tabulka. Volba jde do `join.aspect`, server ji předá do sedačky a ta do
`makeHero`; klient počítá kouzla pro HUD **stejnou funkcí**, takže se
čísla v HUD a v sim nemůžou rozejít.

**Týmový objektiv.** Zabití Prastarého stvoření v řece dávalo jen sólo buff
zabijáka, takže tým neměl důvod řeku řešit. Teď `grantTeamAura()` pošle
auru (síla +12 %, vidění +8 %, rychlost +6 %, 90 s) **všem živým
spojencům**, sólo buff zůstává, a banner hlásí „ZION získal převahu".
Buffy jsou v HUD jako žetony s odpočtem — bez toho by aura byla neviditelná.

**Co odhalo měření.** První verze aury (+20 %, 120 s) vypadala, že
prodlužuje zápasy (357 s, 7/20 timeoutů). A/B běh bez aury ale dal 302 s
a 6/20 — rozdíl byl šum, ne příčina. Skutečný nález byl jinde: když
polovina **botů** brala ochranný aspekt, zápasy se protáhly, protože dva
defenzivní týmy se neudolají. Boti proto hrají ostrou variantu.

**Naměřeno po změnách (20 zápasů):** 293 s průměr, 4/20 timeout, 6,8
zabití, 11,7 padlých věží — hra je rychlejší než před aurou a nepřestala
končit Nexou.

---

## 8e) Nový svět — Křídla na Uranu

👤: „vzpomněl jsem si na krásnou hru s příběhem … SKY!"

**Co to je.** Nový hratelný svět, ne další arkáda: v ledové obloze Uranu
zůstalo sedm světel a na konci je svatyně. Žádní nepřátelé, žádný časový
limit — pláštěnka, proudy vzduchu a kus příběhu po každém světle.
Inspirace *Sky: Children of the Light* je přiznaná, obsah je vlastní.

**Jak se to hraje.** Šipky/WASD = směr, mezerník nebo ↑ = pláštěnka
(zvedá, ale dochází; klouzání ji dobíjí), proudy vzduchu nesou a dobíjejí.
Svatyně se otevře, až když máš všech sedm světel. Na mobilu čtyři směrová
tlačítka (hra není o přesnosti).

**Co je hotové:** `/kridla` (úvod s pravidly, HUD se světly/energií/časem,
text příběhu po každém světle, závěrečný panel), scéna s plovoucími
ostrovy, jiskrami proudů a svatyní, zápis do společné progrese jako nová
hra `wings` (13. položka žebříčků, denní výzva s cílem 900).
Vstup: panel Uranu má druhé CTA „Vzlétnout", stránka Uranu odkaz a HUD
má Křídla jako samostatnou položku.

**Fyzika je čistá** (`core/sky/flight.ts`) — 26 kontrol v Node bez WebGL:
pláštěnka zvedá a spotřebovává energii, bez energie tlačítko nepomůže,
proud nese i dobíjí, hráč nezmizí za hranicí, světlo nejde sebrat dvakrát,
svatyně bez světel neotevře a se všemi ano, skóre nikdy není záporné,
stejný vstup = stejný stav.

**Co odhalily až screenshoty** (kód to neukáže): mraky byly šedé bubliny
(koule s tvrdým okrajem) a proudy vzduchu šedé sloupce. Správně je měkká
billboardová textura (jediná ve scéně) a stoupající jiskry. Světla měla
tmavý obrys, protože obal z průhledné koule se v aditivním režimu kreslí
jako disk — teď je to sprite se září a malým jasným jádrem.

**Naměřeno:** `test/sky-flight.mjs` 39/39 (obě cesty, rozptyl, meze mapy,
dohratelnost větrné cesty, texty darování), headless audit 24/24
(přepnutí cesty, energie ubývá, 7/7 světel otevře svatyni, volba se
světlem, bonus +150, zápis až po volbě), routy 16/16 (+ `/kridla`),
progrese 13/13 (13 her), `tsc` 0 chyb, build OK, screenshoty obou cest
i panelu s volbou v `.artifacts/render/sky-2026-11-04/`.

**Dodatek (2026-11-05): druhá cesta a darování světla.** Křídla mají dvě
cesty (`calm` / `wind`) — stejný příběh, jiný rozptyl: větrná vede výš
a dál, proudy jsou užší a mezi nimi delší prázdno. Data jsou v `SKY_PATHS`,
simulace zná cestu (`FlightState.path`), takže se nemůže rozejít pozice
světla se svatyní. Na konci je **volba**: „Nechat si světlo", nebo
„Darovat světlo +150" — darování dá bonus a jiný text. Zápis do progrese
přijde až po volbě, takže se nezapíše cesta bez rozhodnutí.

**Opravená chyba (odhalil test):** sebrané světlo se hlásilo jen tehdy,
když ho telemetrie (6×/s) stihla — simulace ho mazala každý krok, takže
text příběhu se ukázal ve 2 ze 3 běhů. Teď ho vyzvedne až ten, kdo ho
zobrazí.

## 8f) Svět dostal jméno — Lumi, děvčátko s lucernou (2026-11-05)

👤: „tu hru nazveme Lumi - děvčátko s lucernou … na lucerničku už máme
3D model v heros".

**Přejmenování:** route `/lumi`, hra v žebříčcích `lumi` (13. položka),
odkazy v panelu Uranu, na stránce Uranu i v liště her. Stará `/kridla`
**jen přesměruje** (`router.replace`) — odkaz v historii nemá skončit na 404.

**Hrdinka:** holčička z primitiv (šaty, hlava, vlasy, paže, lucerna v pravé
ruce). Silueta se čte z dálky a jde snadno vyměnit za skutečný model.

**Lucerna je skutečný model** z `heros/…/Lampion_Kralovstvi_srdce_v6.glb`
(`public/models/lampion.glb`, 4,3 MB, ~250 000 trojúhelníků). Normalizuje
se podle bounding boxu, dostane teplé emissive a v ruce se houpe. `Suspense`
má primitivní náhradu, takže hra nikdy nečeká na soubor.

**Optimalizace modelu (2026-11-05).** Zdroj má 242 648 trojúhelníků
a 4,3 MB — víc než celá MOBA scéna. Nový skript
`scripts/ops/lumi-lantern-lod.py` ho zjednoduší **vertex clusteringem**
(kvantizace na mřížku; quadrická dekurace na tenkých vyříznutých panelech
skončila na 65 % a vracela nekonzistentní indexy) a spojí osm dílů do
jednoho meshe.

| | před | po |
|---|---|---|
| trojúhelníky modelu | 242 648 | **13 325** (−94,5 %) |
| velikost souboru | 4,36 MB | **0,21 MB** (−95 %) |
| trojúhelníky scény | 259 216 | **19 323** |
| draw calls | 128 | **35** |
| fps (M1, 1440×900) | 60 | 60 |

Na mobilu (`coarse`) se model vůbec nestahuje a svítí primitivní lucerna.
Zdroj zůstává v `heros/`; do repa jde jen zjednodušená herní kopie.

**Opravená chyba (odhalil audit):** `/models/*` nebyl v `PUBLIC_PREFIXES`,
takže middleware vracel **307**; `GLTFLoader` dostal HTML a hra tiše jela
na náhradě. Teď je asset veřejný a audit to ověřuje přes resource timing.

**Kamera:** první verze držela celou mapu a Lumi byla 20px tečka — teď ji
kamera sleduje zblízka a mírně napřed ve směru letu. Text příběhu se
přesunul pod hlavičku, aby neležel na postavě.

### Zvuk a deník (2026-11-05)

**Zvuk** jde přes sdílený engine, žádné soubory: zapálení lucerny, sebrané
světlo (výška tónu roste s pořadím — cesta je slyšet jako stupnice), nádech
při vstupu do proudu, otevření svatyně, darování a **spojitý vítr**
(`startWindLoop` — růžový šum s pomalým LFO, intenzita podle rychlosti letu).
Hrany se hrají při změně stavu, ne každý snímek.

**Deník světel** (`core/lumi/journal.ts`, `nirvana.lumi.v1`) je trvalá
stopa příběhu: text se ve hře ukáže na osm sekund, v deníku zůstává.
V úvodu je tlačítko „Deník X/7" a panel se sedmi texty (nalezené plné,
nenalezené jako obrys), plus počet cest a kolikrát jsi světlo daroval.

### Společné létání a Lumi v HUD (2026-11-05, protokol 30)

👤: „hlavně Lumi přidej do HUD a na planetu link a pak lítání".

**HUD:** Lumi je v liště her (🏮) a přibyl **ukazatel postupu** `🏮 4/7`
(klikací žeton s počtem světel z deníku). **Planeta:** panel Uranu má
druhé CTA „Letět s Lumi", text mluví o Lumi.

**Společné létání** je **relay**, ne autoritativní simulace: Lumi nemá
zásahy ani skóre, takže klient počítá let sám (stejný `stepFlight`) a
server ho předává ostatním. Server drží jen **sdílená světla místnosti**
a kdo doletěl — nový hráč dostane už sebraná světla. Místnost pro 4.

V klientu: `joinLumi(path)`, `sendFly()` (20 Hz, ale zpráva se sebraným
světlem jde vždy), adoptování serverových světel a kreslení ostatních
letců bez modelu lucerny (čtyři kopie 13k modelu by scénu zabily).

**Past:** whitelist her v `join` neznal `lumi`, takže join tiše propadl
do `arena` — stejná chyba jako u tanků. **Druhá past:** prohlížeč uspí
`requestAnimationFrame` na kartě v pozadí, takže E2E musí před akcí
`bringToFront()`.

**Ověřeno:** net `lumi.mjs` 15/15, živý test dvou prohlížečů 5/5 (oba
vidí „letí 1", světlo sebrané jedním má i druhý), net sady 11/11,
`lumi-audit` 36/36, routy 16/16, progrese 13/13.

### Kompas a jména spolulentců (2026-11-05)

Otevřená obloha 118 × 118 bez kompasu je slepá: sedm světel se rozprostírá tak, že hráč
nemá jak poznat, kterým směrem je nejbližší. HUD proto dostal **kompas** — šipku a
vzdálenost k cíli; po sedmi světlech zlatou a mířící na svatyni.

Cíl počítá `nextTarget()` v `flight.ts` (čistá funkce, testovaná bez prohlížeče), takže se
kompas nemůže rozejít se simulací. U co-opu přibyla i **jména spolulentců** („s tebou letí
2 — Lumi, Noctis").

**Past, která to odhalila:** `transform: rotate()` na HTML prvku se v headless prohlížeči
kreslí jinam než v reálném (SwiftShader) — matice byla správně, ale šipka mířila opačně.
Řešení: otáčet **SVG atributem** `transform="rotate(a 12 12)"`; ověřeno měřením pixelů na
zvětšené šipce (54° vs. cíl 41°). Druhá past: WebGL ve swiftshad eru startuje 1–3 s, takže
audit musí čekat na selektor, ne na pevný `wait`.

**Ověřeno:** `lumi-flight` 45/45 (7 nových kontrol kompasu), `lumi-journal` 30/30,
`apps/nirvana-net/test/lumi.mjs` 15/15, `lumi-audit` 46/46, `tsc` + build čisté.

### Třetí cesta (2026-11-05)

Po dohrání obou cest se odemkne **Cesta světla** — sedm světel ve spirále
vzhůru, čtyři úzké proudy vysoko, dlouhé prázdno mezi nimi, svatyně
v 92/92. Zámek je v datech (`isPathUnlocked`), ne v UI: deník si nese
dohrané cesty (`paths`) a stránka jen vykresluje dashed kartu s 🔒.

**Meze:** tři cesty (žádné další větve), úspory jen v prohlížeči, na
mobilu čtyři směry a lehká lucerna, ve VR netestováno. Deník se
nesynchronizuje mezi zařízeními (záměr — žádný účet).

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
- **Mistrovství** je v `localStorage` — bez účtu se mezi zařízeními
  nesesynchronizuje a nedá se s ním chlubit jinde než v prohlížeči.
- **Bounty** je v simulaci, ale HUD ukazuje jen vlastní sérii; tabule
  sérií soupeřů není.

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
