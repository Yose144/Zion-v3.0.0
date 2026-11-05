# NIRVANA — LUMI, děvčátko s lucernou

> **Plán světa a jeho dluhů.** Stav: **2026-11-05**. Route: `/lumi` (`/kridla` přesměrovává).
> Tento dokument je určený pro novou session jako **jediný vstupní bod**: co Lumi je, jak je
> postavená, co je hotové a ověřené, co je dluh a jak se to měří.
>
> Sesterské dokumenty: [`apps/nirvana/AGENTS.md`](apps/nirvana/AGENTS.md) (pravidla a pasti),
> [`docs/3.2/REPORTS/REPORT_2026-11-04_NIRVANA_SOUND_VR_PROGRESS.md`](docs/3.2/REPORTS/REPORT_2026-11-04_NIRVANA_SOUND_VR_PROGRESS.md)
> (report, §8e–8f), [`NIRVANA-SHELL.md`](docs/3.2/NIRVANA-SHELL.md) (okna a portály).

---

## 0. TL;DR

| | |
|---|---|
| **Co to je** | Klidový letový svět na Uranu. Děvčátko s lucernou sbírá sedm světel a nese je do svatyně. |
| **Není to** | Arkáda. Žádné nepřátele, časomíra ani skóre, které by šlo prohrát. |
| **Kde** | `/lumi` v `apps/nirvana`; v HUD liště jako `🏮 X/7`; z panelu planety Uran jako **„Letět s Lumi"**. |
| **Multiplayer** | Společné létání pro **4** (`GameId 'lumi'`, `PROTO_VERSION = 30`) — **relay**, ne autoritativní simulace. |
| **Hotovo** | 3 cesty, 7 světel + úlomky příběhu, darování, deník, zvuk, LOD lucerny, kompas, HUD, co-op, **duchové** (L-2), **foto mód** (L-5), **reduced motion** (L-9), **stopa** (L-3), **denní obloha** (L-7), **kapitoly** (L-8), **VR vrstva** (L-4, bez headsetu). |
| **Dluh** | Živý net je na protokolu **26**, repo na **30** → co-op se do nasazení nepřipojí (viz §9). |
| **Ověřeno** | **53** + **43** + **15** + **18** + **54** kontrol (tab. §8), `tsc` a `next build` čisté. |

---

## 1. Designový záměr (a proč to tak je)

Lumi je odpověď na otázku „jak vypadá hra, kterou nemusíš vyhrát". Inspirace je *Sky: Children
of the Light*: pomalý let, světlo jako měna a darování jako pointa.

Tři rozhodnutí, která drží svět pohromadě:

1. **Rychlost není cíl.** Skóre je `světla × 100` + zbytek času, ale čas se dohráním
   *nezkracuje na nulu* — kdo se loudá, dostane méně, ale pořád dostane. (Měření: ideální let
   ~35 s, kochání ~120 s; rozdíl ve skóre je ~170 bodů, ne propast.)
2. **Lucerna je palivo i metafora.** Energie ubývá jen když stoupáš; klesání a proudy ji vrací.
   Hráč se učí „neplýtvat světlem", což je zároveň téma příběhu.
3. **Dar není trest.** Darovat světlo = +150 bodů a jiný text. Nechat si = taky legitimní.
   Hra nehodnotí; jen ukáže, co jsi udělal.

---

## 2. Kde Lumi v ekosystému bydlí

| Povrch | Soubor | Chování |
|---|---|---|
| Route | `src/app/lumi/page.tsx` | intro → let → panel s darem |
| Redirect | `src/app/kridla/page.tsx` | stará routa `Křídla` → `/lumi` |
| HUD lišta | `src/core/games/GameHud.tsx`, `src/core/games/links.ts` | položka `🏮` + žeton `🏮 X/7` (počet světel z deníku) |
| Panel planety | `src/core/shell/Shell.tsx` (`uranus`) | druhé CTA **„Letět s Lumi"**, text mluví o Lumi |
| Stránka Uranu | `src/core/outer/OuterWorldPage.tsx` | odkaz na `/lumi` |
| Skóre/tabule | `src/core/progress/run.ts` | `recordRun('lumi', …)` — 13. hra v progresi |
| Chat / místnosti | `apps/nirvana-net` | `GameId 'lumi'`, místnost pro 4 |

**Proč zrovna Uran:** Uran je v kanonu „ledový archiv, planeta nakloněná na bok" — prázdná
obloha bez horizontu, což je přesně prostor pro let bez mapy. Pluto a Neptun zůstaly pro
procházkové světy.

---

## 3. Architektura — vrstvy a jedno místo pravdy

```
world.ts      data (cesty, světla, proudy, ostrovy, texty)   ← jediný zdroj pravdy
   ↓
flight.ts     čistá simulace (stepFlight, nextTarget, skóre) ← testuje se bez prohlížeče
   ↓
LumiScene.tsx render (r3f) + vstup + zvuk + telemetrie       ← jen kreslí a čte stav
   ↓
page.tsx      fáze, HUD, deník, dar, co-op UI
   ↓
nirvana-net   relay místnosti (sdílená světla, ostatní letci)
```

**Pravidlo:** simulace nikdy neimportuje React, scéna nikdy nepočítá fyziku znovu. Když se
něco rozbije („sebral jsem světlo a nic"), hledá se v `flight.ts`, ne ve scéně.

### Mapa souborů

Kompletní seznam toho, čeho se Lumi dotýká. Sloupec „když chybí" říká, co se rozbije —
to je důvod, proč tu tabulka je: při refaktoru se snadno smaže soubor, o kterém si nikdo
nemyslí, že k něčemu patří.

**Klient — jádro světa (`apps/nirvana/src/core/lumi/`)**

| Soubor | Řádků | Role | Když chybí / přejmenuje se |
|---|---|---|---|
| `world.ts` | 456 | Jediný zdroj pravdy: `LUMI_LIGHTS` (7), `WIND_LIGHTS`, `LIGHT_LIGHTS`, `LUMI_CURRENTS`, `LUMI_ISLANDS`, `LUMI_SHRINE`, `LUMI_PATHS` (calm/wind/light), `LUMI_GIFT` + `LUMI_GIFT_BONUS = 150`, texty | světla a cesty zmizí ze scény i z UI; nová cesta = nový záznam tady, ne v `page.tsx` |
| `flight.ts` | 211 | Čistá simulace: `createFlight`, `stepFlight`, `nextTarget`, `lumiScore`, `missingLights` | nelze testovat bez prohlížeče; fyzika se rozejde mezi sólo a co-opem |
| `LumiScene.tsx` | 986 | r3f scéna: protagonista, GLB lucerna + LOD, `CameraRig`, `RemoteFlyers`, dotyk, zvuk, `onStats`/`onFly`, debug háčky | hra nemá obraz; E2E přijde o `__lumiDebug`/`__lumiTeleport` |
| `journal.ts` | 100 | `localStorage` `nirvana.lumi.v1`: světla (množina), cesty, dary; `isPathUnlocked`, `missingInJournal` | HUD `🏮 X/7` padá na 0 a cesta `light` se odemkne vždy |
| `trail.ts` | 66 | Čistá logika stopy (L-3): `pushTrail`/`pruneTrail`/`trailFade`, konstanty `TRAIL_LEN/STEP/TTL` | stopa se vzorkuje každým snímkem → jiná na 60 fps než na 20 fps; testy v Node by nešly |

**Klient — povrchy a UI**

| Soubor | Řádků | Role | Když chybí |
|---|---|---|---|
| `src/app/lumi/page.tsx` | 617 | Fáze `intro → flying → done`, HUD, kompas, dar, co-op panel | route 404 (i s přesměrováním z `/kridla`) |
| `src/app/kridla/page.tsx` | ~30 | `router.replace('/lumi')` staré adresy | staré odkazy v chatu/historii skončí na 404 |
| `src/core/games/links.ts` | 117 | dlaždice hry v `GamesDock` | Lumi zmizí z nabídky her, i když funguje |
| `src/core/games/GameHud.tsx` | 182 | žeton `🏮 X/7` (čte `loadJournal`) | hráč nevidí postup mezi návštěvami |
| `src/core/progress/boards.ts` + `run.ts` | 119 + 179 | 13. hra v žebříčku (`lumi: { cs: 'Lumi', glyph: '🏮' }`) | skóre se nemá kam uložit, tabule nemá řádek |
| `src/core/shell/Shell.tsx` | 572 | panel Uranu: druhý CTA **„Letět s Lumi"** + text planety | Lumi jde otevřít jen z adresy |
| `src/core/outer/OuterWorldPage.tsx` | 75 | odkaz na `/lumi` ze stránky Uranu | — |
| `src/core/audio/engine.ts` | 613 | 5 eventů (`lanternIgnite`, `lightPickup`, `gust`, `shrineOpen`, `gift`), `startWindLoop`, mute | hra je tichá; **nesahat** na `unlock()` (autoplay) |
| `src/core/shell/SoundToggle.tsx` | — | `🔊/🔇` v chrome, stav v `localStorage` | zvuk nejde vypnout jinde než v systému |
| `src/middleware.ts` | 69 | `PUBLIC_PREFIXES` (`/models`, `/textures`, `/portraits`, `/audio`, `/api/health`) | GLB se načte jako 307 → tichý primitiv (past P-4) |

**Síť — relay**

| Soubor | Řádků | Role | Když chybí |
|---|---|---|---|
| `src/core/net/protocol.ts` | 693 | `PROTO_VERSION = 30`, `GameId 'lumi'`, `fly`, `snapshot.lumi`, whitelist v `join` | co-op se připojí do `arena` (past P-1) |
| `apps/nirvana-net/src/lumi.ts` | 178 | Místnost: sdílená světla, letci, `IDLE_MS = 12 s`, cesta z prvního `join` | místnost se neregistruje, `join lumi` skončí chybou |
| `apps/nirvana-net/src/matches.ts` | 299 | `createLumiMatch` v dispatcheru | hra nemá `Match` objekt |
| `apps/nirvana-net/src/index.ts` | 1034 | `gameTypeSize('lumi') → LUMI_ROOM_SIZE` (4), `lumiPath` v `join` | místnost spadne na výchozí velikost |

**Assety a nástroje**

| Soubor | Role |
|---|---|
| `apps/nirvana/public/models/lampion.glb` | Decimovaná lucerna: **13 325 trojúhelníků, 0,21 MB** (originál 242 648 / 4,36 MB). Bez něj se kreslí primitiv (a mobil to dělá záměrně). |
| `scripts/ops/lumi-lantern-lod.py` | Pipeline, která LOD vyrábí — kdyby se ztratila, další úprava modelu by ho vrátila na 4,4 MB. |
| `apps/nirvana/src/core/xr/` (`VrButton`, `inputs`) | VR vrstva, kterou L-4 použije; dnes ji Lumi nevyužívá. |

**Testy** — soubory a počty kontrol jsou v §8, ať seznam není dvakrát.

### 3.1 `src/core/lumi/world.ts` (456 řádků) — data

- `LUMI_LIGHTS` (7), `WIND_LIGHTS`, `LIGHT_LIGHTS` — pozice, prstenec, tón.
- `LUMI_CURRENTS` — proudy vzduchu (střed, poloměr, `lift`).
- `LUMI_ISLANDS` — plošiny; `z` je hloubka, aby obloha měla vrstvy.
- `LUMI_SHRINE` / svatyně per cesta.
- `LUMI_PATHS` — tři cesty: `calm`, `wind`, `light` (jméno, poznámka, intro).
- `LUMI_GIFT` + `LUMI_GIFT_BONUS = 150`.
- **Denní obloha (L-7):** `lightsFor(pathId, date)` a `pathData(id, date)` posunou
  sedm světel podle **data v UTC** (seed = `YYYY-MM-DD`), deterministicky: stejný den =
  stejná obloha pro všechny, takže se dva lidé v co-opu potkají u stejných světel.
  Nemění se id ani texty, jen poloha (±9 jednotek); světlo nikdy nesedne do svatyně
  (`r + 6`). `pathData` je **jediná cesta k datům** — simulace, scéna i HUD ho volají
  bez data a dostanou dnešek.

**Mapa je 118 × 118** jednotek. To je záměr: sedm světel se do ní vejde tak, že mezi nimi
jsou prázdná místa, ale ne tak daleko, aby let byl nudný.

### 3.2 `src/core/lumi/flight.ts` (211 řádků) — simulace

| Konstanta | Hodnota | Význam |
|---|---|---|
| `GRAVITY` | 16 | padání bez lucerny |
| `LIFT` | 34 | tah lucerny nahoru |
| `MAX_RISE` / `MAX_FALL` | 26 / 22 | strop svislé rychlosti |
| `ACCEL` / `MAX_SPEED` | 26 / 24 | vodorovný pohyb |
| `DRAG` | 1.6 | dojezd (klouzání) |
| `LIFT_DRAIN` | 22 /s | spotřeba při stoupání |
| `GLIDE_REGEN` | 4 /s | pomalé dobíjení v klidu |
| `CURRENT_REFILL` | 26 | co dá proud |
| `LIGHT_REFILL` | 18 | co dá sebrané světlo |
| `LIGHT_RADIUS` / `SHRINE_RADIUS` | 3.4 / 6 | dosah sběru / doletu |

Funkce:

- `createFlight(path)` — startovní stav (10, 12), plná energie, prázdná světla.
- `stepFlight(state, input, dt)` — **jediná** fyzika; `dt` shora omezený na 0,05 s, aby se
  fyzika nerozjela na 15 fps.
- `nextTarget(state)` — nejbližší nesebrané světlo; po sedmi svatyně; `null` po doletu.
  Používá ji **kompas** v HUD, takže UI a simulace nemůžou mít jiný názor.
- `lumiScore(state)` — `lights.length * 100` + časový bonus (max 600) po doletu.
- `missingLights(state)` — pro text „zbývá N světel".

### 3.3 `src/core/lumi/LumiScene.tsx` (986 řádků) — scéna

- **Protagonista** z primitiv (`Lumi`), lucerna je decimovaný GLB
  (`public/models/lampion.glb`, 13 325 trojúhelníků, 0,21 MB; originál 242 648 / 4,36 MB).
  LOD vyrábí `scripts/ops/lumi-lantern-lod.py`.
- **Mobil (`detail = false`)** lucernu vůbec nenačítá — kreslí primitiv, aby se neplatil
  download ani 13k trojúhelníků.
- **Kamera** (`CameraRig`) sleduje hráčku zblízka, mírně napřed ve směru letu; jinak by
  holčička byla 20 px vysoká a splynula s ostrovy.
- **Ostatní letci** (`RemoteFlyers`) se kreslí **bez modelu lucerny** — jen svítící tělo +
  koule světla. Čtyři kopie 13k modelu by scénu zabily a z dálky stejně nejsou vidět.
  **Duch** (odpojený hráč, L-2) se rozpouští 3 s: průhlednost jde z klientského razítka
  `ghostSince` podle přechodu `ghost` ze serveru, takže mizení je plynulé, ne skokové.
- **Debug háčky** (jen `?lumiDebug=1`): `__lumiDebug()`, `__lumiTeleport(x, y)`,
  `__lumiLights`, `__lumiShrine`. Bez nich by E2E muselo hrát hru „doopravdy", což je pomalé
  a nespolehlivé.
- **Stopa za lucernou (L-3):** 24 instancí, vzorky po `0,55` jednotky a životnost `1,3 s`;
  logika je v `trail.ts` (testuje se v Node), scéna jen plní matice a barvy. Na mobilu
  (`detail = false`) se **nekreslí vůbec**. Jas jde přes `setColorAt` (aditivní blending:
  černá = neviditelná), ne přes `opacity` materiálu — ta je pro všechny instance společná.
- **Telemetrie** `onStats` ~6×/s (`LumiStats`), sdílený let posílá `onFly` 20×/s.

### 3.4 `src/app/lumi/page.tsx` (617 řádků) — UI

Fáze `intro → flying → done`:

- **Intro:** název cesty, tři karty cest (třetí zamčená), přepínač **Sólo / S kamarádem**.
- **Let:** HUD (7 teček, energie, čas, **kompas**, 📷), nápověda, text úlomku, cíl, spoluletci.
- **Foto mód (L-5):** `main.sky.is-photo` schová **veškerý** chrome (HUD, hlavičku, nápovědu,
  cíl, úlomek, spoluletce i dotykový pad) a nechá jen křížek `✕ zpět`; `Esc` ho zavře.
  Skrývá se přes `opacity`, ne `display` — prvek v layoutu nesmí posunout scénu.
- **Done:** panel se světly a časem + **volba** (nechat / darovat) → `recordJourney` → skóre.

**Kompas** (`stats.target` z `nextTarget`): šipka + vzdálenost; po sedmi světlech zlatá a míří
na svatyni. Otáčí se **SVG atributem** `rotate(a 12 12)`, ne CSS transformem — viz past P-6.

### 3.5 `src/core/lumi/journal.ts` (100 řádků) — deník

`localStorage` klíč **`nirvana.lumi.v1`**:

```json
{ "found": [1,2,3], "runs": 2, "gifts": { "keep": 0, "give": 1 }, "paths": ["calm"] }
```

- `recordJourney(lights, gift, path)` — idempotentně sjednotí světla, přičte cestu a dar.
- `isPathUnlocked(path, journal)` — **zámek cesty je v datech, ne v UI**: `light` se odemkne,
  až když má deník `calm` i `wind`.
- `missingInJournal(journal)` — pro HUD `X/7`.

### 3.6 Společné létání (relay)

Viz §5 a `apps/nirvana-net/src/lumi.ts` (147 řádků).

---

## 4. Herní smyčka

1. Hráč letí (`WASD`/šipky, lucerna `Space`/`↑`; na mobilu joystick + `VZHŮRU`).
2. Proud vzduchu dobije energii; světlo ji dobije a přičte se do `lights`.
3. Po sedmi světlech se svatyně otevře (`finished` po doletu do jejího poloměru).
4. Panel: nechat / darovat → `recordJourney` + `recordRun` (skóre na tabuli).
5. HUD `🏮 X/7` a deník drží postup mezi návštěvami.

**Co hru ukončí:** dolet do svatyně. **Co ji neukončí:** pád (jen ztratíš výšku), tma
(energie dojde, ale klouzáš a dobíjíš), odchod ze stránky (rozdělaný let se neukládá —
záměr, jinak by šlo „vrátit se do rozjetého").

---

## 5. Společné létání — rozhodnutí, které je potřeba respektovat

**Lumi je relay hra, ne autoritativní simulace.** Toto je záměrné a je potřeba ho bránit:

- Hra nemá zásahy, skóre ani soupeře → **není co podvádět**. Serverová fyzika by platila
  latenci a složitost za ochranu, kterou hra nepotřebuje.
- Klient počítá svůj let **stejným `stepFlight`** jako sólo. Server jen předává ostatním.
- Server drží to, co má smysl sdílet:
  - **sebraná světla místnosti** — co sebere jeden, mizí i tobě; kdo se přidá později, dostane
    je ve snapshotu (jinak by hledal světla, která na obrazovce nejsou),
  - kdo je v místnosti a kdo už doletěl,
  - **cestu** — bere se z prvního `join` a nemění se pod rukama.

Protokol (`PROTO_VERSION = 30`):

```ts
// klient → server (20 Hz; zpráva se sebraným světlem jde vždy, bez ohledu na throttle)
{ t: 'fly', x, y, vx, vy, energy, collect?: 1..7, finished?: boolean }

// server → klient (15 Hz, jen pole navíc k běžnému snapshotu)
snapshot.lumi = {
  path: 'calm' | 'wind' | 'light',
  lights: number[],           // sdílená pravda místnosti
  open: boolean,              // všech sedm
  flyers: { id, name, avatarId, x, y, vx, vy, energy, finished }[]  // bez sebe
}
```

- Místnost: `LUMI_ROOM_SIZE = 4`. Víc by z oblohy udělalo trh.
- Klient posílá jen pole `remotes` (ref, ne React state — 15×/s by překreslovalo 3D strom).
- `sendFly` **nesmí zahodit sebrané světlo**: běžný stav se throttluje na 20 Hz, ale zpráva
  s `collect` jde vždy.

**Co je v `apps/nirvana-net/src/lumi.ts` opravdu implementované** (ověřeno 2026-11-05, ne odhad):

| Detail | Chování dnes | Proč |
|---|---|---|
| `join` a cesta | `path` se bere **jen od prvního** letce (`flyers.size === 0`), pozdější se přidají k jeho cestě | aby se cesta neměnila pod rukama |
| `leave` | hráč se **neodebere hned**: označí se `ghostUntil = now + 3 s` a ostatní ho vidí jako ducha na poslední pozici (**L-2**, hotovo) | postava nemizí v půlce oblohy; reconnect se stejným id ho oživí (`message()` zruší `ghostUntil`) |
| `step()` a úklid | duch se smaže po 3 s; živý po `IDLE_MS = 12 s` bez zprávy | zamrzlá karta nesmí blokovat místnost navěky |
| `state()` a `size()` | počítají **jen živé** (`liveCount()`), ne duchy | jinak by místnost 3 s „hrála" s nikým a duch by držel sedlo |
| `seq` | `lights.size` (ne pořadové číslo snímku) | klient z něj pozná, kolik světel je sebraných |
| `players` | **vždy prázdné pole** | arénová pole by mátla klienty; Lumi posílá jen `lumi` |
| `collect` | `Math.round`, jen `1..7`, množina (ne pole) | dvojí sběr stejného světla nic nezkazí |

---

## 6. Zvuk

`src/core/audio/engine.ts` — vše syntéza z oscilátorů a šumu (v repu není zvukový soubor):

- `startWindLoop()` — vítr, intenzita podle rychlosti (`stats.speed / 26`).
- `play('lightPickup')` — výška tónu roste s počtem světel (cesta je slyšet jako stupnice).
- `play('lanternIgnite')`, `play('gust')` (vstup do proudu), `play('shrineOpen')`,
  `play('gift')`.
- `unlock()` — AudioContext se otevírá až po gestu (jinak prohlížeč kontext zahodí).
- Mute toggle je v chrome (`core/shell/SoundToggle.tsx`, `🔊/🔇`), stav v `localStorage`;
  engine drží `isMuted/subscribeMuted/toggleMuted`, takže zvuk nejde obejít vlastním tlačítkem.

---

## 7. Mobil a výkon

- `coarse` (dotyk) → `detail = false`: bez GLB lucerny, méně částic.
- Dotyk: `TouchButton` posílá **syntetické `keydown`/`keyup`** (`ArrowUp/Left/Down/Right`),
  takže herní smyčka má jednu větev vstupu, ne dvě.
- `.lumi-touch` je mimo `.lumi-hud`, aby si nezakrývaly prsty; `padding-bottom` na stránce
  počítá s lištou.
- **Foto mód na mobilu:** `Esc` neexistuje, proto je `✕ zpět` samostatné tlačítko mimo
  skrývanou vrstvu (a má 40 px cíl). Skrytý je i dotykový pad — na snímku nemá co dělat.
- **Přístupnost (L-9):** `prefers-reduced-motion` vypne pohyb pozadí (mraky, jiskry proudů)
  a blikání lucerny; **letět se musí dát dál**. Čte se jednou při mountu.
- **Měřeno (2026-11-05, headless swiftshader):** 390×844 → **31 draw calls, 59 fps**,
  19 795 tris, 2 textury; 1440×900 → 36 calls. Na mobilu se nekreslí stopa ani model lucerny.
- **`canvasDpr()`** (`core/design/dpr.ts`) stropuje pixel ratio na dotyku/úzkém okně na
  **1,25** — u 11 pláten (Lumi, MOBA, pouť, Mars, Venuše, Merkur, Saturn, vnější planety,
  avatary) to je nejlevnější výkonnostní zisk, protože jde o vyplňování pixelů, ne o kód.

**Napříč Nirvanou (stejná dávka, 2026-11-05):** audit 10 povrchů × 4 viewporty
(`.artifacts/probe/responsive.mjs`) našel jediný skutečný přesah — lištu her na 390 px
(`.game-hud-stats` o 31 px mimo obraz); opraveno vlastním řádkem v `@media (max-width:
760px)`. Dotykové cíle se zvedly u holo tlačítek a posuvníku citlivosti. Draw calls
měřené po površích (`draw-calls.mjs`, 390×844): `/lumi` 31, `/mars` 30, `/mercury` 27,
`/saturn` 20, `/park` 46, `/hiran` 139, `/` 141. Poslední dvě jsou sdílené scény
s tiery kvality — další Optimalizace by znamenala instancovat brány/lotosy, což je
samostatná dávka, ne „mobilní úklid"; `mobile-audit` je PASSED.

---

## 8. Testy — co měří a jak je spustit

| Test | Kde | Kontrol | Co ověřuje |
|---|---|---|---|
| Let | `apps/nirvana/test/lumi-flight.mjs` | **53** | lucerna zvedá a dochází, proudy nesou a dobíjí, cesta jde dohrát, skóre nezáporné, **kompas** míří na nejbližší světlo / svatyni / `null` |
| Deník + kapitoly | `apps/nirvana/test/lumi-journal.mjs` | **43** | ukládání, idempotence světel, odemykání `light`, darování, **kapitola ke každé cestě, jiný úvod pro vracejícího se hráče** |
| Stopa | `apps/nirvana/test/lumi-trail.mjs` | **15** | vzorky vznikají pohybem (ne každým snímkem), strop ohonu, doznívání po `TRAIL_TTL`, jas 1→0, **nezávislost na fps** |
| Společný let (server) | `apps/nirvana-net/test/lumi.mjs` | **18** | dva se vidí, světla sdílená, nový hráč je dostane, cesta z prvního joinu, svatyně až po sedmi, odchod jednoho nezhroutí druhého, **duch zůstane 3 s na poslední pozici a pak zmizí** |
| Audit v prohlížeči | `.artifacts/probe/lumi-audit.mjs` | **54** | scéna se vykreslí, let reaguje na vstup, 7 světel → svatyně → panel → dar → skóre na tabuli, deník, **kompas**, model lucerny se opravdu načetl, **foto mód skryje chrome a `Esc` ho vrátí**, konzole bez chyb |
| Živý co-op | `.artifacts/probe/lumi-coop-live.mjs` | 5 | dva prohlížeče: oba vidí „letí 1", světlo sebrané jedním má i druhý |

```bash
cd apps/nirvana       && npx tsx test/lumi-flight.mjs && npx tsx test/lumi-journal.mjs && npx tsx test/lumi-trail.mjs
cd apps/nirvana-net   && npm run build && node test/lumi.mjs
# audit + co-op potřebují běžící appku (3014) a net (3012), viz §9
NIRVANA_BASE=http://127.0.0.1:3014 node .artifacts/probe/lumi-audit.mjs
```

**Pozor na izolaci:** audit i co-op potřebují **běžící appku**, a ta se v tomhle monorepu
staví do `.next/standalone/…`. Když v mezičase proběhne jiný `next build` (paralelní
session), artefakt se pod rukama vymaže a audit hlásí `canvas=0` nebo 404 na chunky.
Ověřený postup je **kopie do `/tmp`** — viz past P-11.

Regresní minimum před commitem: `npx tsc --noEmit`, `npx next build`, `lumi-audit`,
`apps/nirvana-net/test/{smoke,lumi}.mjs`.

---

## 9. Nasazení

> **Blokující fakt:** živý net je na protokolu **26**, repo na **30**.
> Deploy **net první, pak appka**. Opačné pořadí = `proto_mismatch` a mrtvý chat i multiplayer.

**Měřeno 2026-11-05** (`curl https://nirvana.zionterranova.com/net/health`):

```json
{"ok":true,"service":"zion-nirvana-net","proto":26,
 "build":"20261104T050941Z","uptimeSec":107406,"connections":0,"rooms":0}
```

Tedy: net běží z buildu 4. 11. 05:09 UTC (~29,8 h) a **nemá otevřenou ani jednu místnost** —
deploy v tuhle chvíli nikoho nepřeruší. Rozdíl 26 → 30 není kosmetický: mezi tím přibyly
světy Uran/Neptun/Pluto, hlediště (diváci), MOBA mistrovství a aspekty kouzel — a Lumi.
Starý server nový `join` odmítne `proto_mismatch`.

```bash
# 1) net
bash apps/nirvana-net/deploy/deploy-nirvana-net.sh
curl -s https://nirvana.zionterranova.com/net/health   # → "proto":30

# 2) appka
bash apps/nirvana/deploy/deploy-nirvana.sh
```

**Lokální ověření (to, co fungovalo při vývoji):**

```bash
cd apps/nirvana && npm run build
rm -rf .next/standalone/apps/nirvana/{.next/static,public}
cp -a .next/static .next/standalone/apps/nirvana/.next/static
cp -a public       .next/standalone/apps/nirvana/public
PORT=3014 ARCHIVE_VERIFY_URL=http://127.0.0.1:9099/verify \
  node .next/standalone/apps/nirvana/server.js &

# net
NIRVANA_NET_PORT=3012 NIRVANA_NET_REQUIRE_PASS=0 NIRVANA_NET_RESUME_MS=0 \
  NIRVANA_NET_ALLOWED_ORIGINS=http://127.0.0.1:3014 \
  node apps/nirvana-net/dist/nirvana-net/src/index.js &

# oracle ZAP pasu (jinak middleware vrátí 307)
node .artifacts/probe/pass-oracle.mjs &
```

**Pozor:** `next start` s `output: 'standalone'` neočekávaně končí — spouští se
`node .next/standalone/apps/nirvana/server.js`. A `.next/standalone` **neobsahuje**
`public/` ani `.next/static`; bez ručního zkopírování se GLB lucerny nenačte a hra
tiše použije primitiv (proto je v auditu kontrola „model se opravdu načetl").

**Po nasazení — co musí projít, jinak rollback:**

1. `curl -s https://nirvana.zionterranova.com/net/health` → `"proto":30` (nové `build`).
2. `apps/nirvana-net/test/{smoke,lumi}.mjs` na novém `dist` — **pozor:** tyhle testy si
   startují **vlastní** instanci na náhodném portu (`LUMI_PORT`/`SMOKE_PORT`), takže
   „proti živému serveru" neběží; ověřují, že nový build je vnitřně zdravý.
3. Živý co-op: `/lumi` → **S kamarádem** ve dvou oknech, oba vidí „letí 1", sebrané světlo
   zmizí i druhému. (`lumi-coop-live.mjs` to dělá hlavičkou, ale míří na `127.0.0.1:3014`.)
4. Regrese chatu: `/park` + dvě karty → zpráva dorazí. Chat je nejrychlejší důkaz, že
   protokol sedí na obou stranách.
5. `curl -s https://nirvana.zionterranova.com/models/lampion.glb -o /dev/null -w '%{http_code}'`
   → `200` (ne `307`); jinak middleware gatuje assety (past P-4).

---

## 10. Backlog pro novou session

Seřazeno podle poměru přínos / riziko. Každá položka má **akceptační kritérium**, aby se
„hotovo" dalo změřit, ne odhadnout.

| ID | Co | Akceptace | Riziko | Stav |
|---|---|---|---|---|
| **L-1** | Nasadit proto 30 (net → app) | `/net/health` hlásí 30; `smoke`+`lumi` projdou na novém buildu; živý co-op ve dvou oknech se vidí | nízké, ale **musí být první** | ⏳ čeká na 👤 |
| **L-2** | Duchové: doletět místnost i po odpojení (poslední známá pozice 3 s) | odpojený hráč mizí z oblohy až po 3 s, ne okamžitě | nízké | ✅ 2026-11-05 |
| **L-3** | Světelná stopa za lucernou (trail), jen `detail` | na M1 ≥ 50 fps, na mobilu vypnuto | nízké | ✅ 2026-11-05 |
| **L-4** | VR let (`core/xr` už existuje pro Merkur/Venuši/Saturn) | v headsetu jde letět pohledem, lucerna na spoušti; bez headsetu se jen nesmí rozbít 2D | střední | ⚠️ částečně 2026-11-05 |
| **L-5** | Foto mód (skrýt HUD, volná kamera) | tlačítko skryje veškerý chrome, `Esc` vrátí | nízké | ✅ 2026-11-05 |
| **L-6** | Druhá ruka: lucerna jde „předat" spoluletci (co-op emote) | druhý hráč dostane světlo do HUD, server to vidí ve `flyers` | střední (protokol) | ⬜ |
| **L-7** | Denní světlo: jedenkrát denně jiná pozice sedmi světel (seed z datumu) | stejný den = stejná obloha pro všechny, zítra jiná; test determinismu | nízké | ✅ 2026-11-05 |
| **L-8** | Kapitoly příběhu mezi cestami (text po každé cestě) | po `calm` a `wind` se odemkne jiný úvodní text, ne jen cesta | nízké | ✅ 2026-11-05 |
| **L-9** | Přístupnost: `prefers-reduced-motion` vypne vítr a částice | s preferencí se nehýbe pozadí, hra zůstane hratelná | nízké | ✅ 2026-11-05 |
| **L-10** | Lokalizace do třetího jazyka (EN je hotové; CS je výchozí) | všechny texty z `world.ts` mají klíč, žádný hardcoded string v `page.tsx` | nízké | ⬜ |
| **L-11** | Odměna za darování v kooperaci (společná svatyně = +body všem) | dva hráči doletí → oba dostanou bonus, ne jen ten, kdo doletěl první | střední | ⬜ |
| **L-12** | Výkon: instancované částice na mobilu | 390×844 ≥ 30 fps (měřeno `.artifacts/probe/lumi-perf.mjs` — rAF 2 s + `__lumiDebug()`), draw calls < 60 | střední | ✅ 2026-11-05 |

**Implementační poznámky k backlogu** (kde přesně sáhnout — ověřeno v kódu, ne odhad):

- **L-2 (duchové) — ✅ hotovo.** `leave()` v `apps/nirvana-net/src/lumi.ts` neodstraňuje,
  ale nastaví `ghostUntil = now + GHOST_MS (3 000)`; `step()` duchy uklidí, `message()`
  je oživí (reconnect se stejným id); snapshot posílá `ghost: true`; `state()`/`size()`
  počítají `liveCount()`, takže **duch nedrží sedlo ani stav místnosti**. Klient
  (`RemoteFlyers`) si drží razítko `ghostSince` a 3 s stahuje opacity materiálů i sílu
  světla; `setPeers` počítá jen živé. **Protokol se nemění** — pole je volitelné.
- **L-5 (foto mód) — ✅ hotovo.** `main.sky.is-photo` + CSS schová chrome přes `opacity`
  (ne `display`, aby se neposunula scéna); `Esc` i `✕ zpět` (kvůli mobilu, 40 px cíl)
  vrací HUD. **Volná kamera není** — kamera zůstává tam, kde ji má `CameraRig`, takže
  snímek je z místa, kde hráč opravdu stojí.
- **L-9 (přístupnost) — ✅ hotovo (pohyb pozadí).** `prefersReducedMotion()` v `LumiScene`
  vypne posun mraků, stoupání jisker proudů a blikání lucerny. **Vítr (zvuk) zůstává** —
  je to zvuk, ne pohyb; kdo ho chce vypnout, má `SoundToggle`. Čte se jednou při mountu.
- **L-3 (trail) — ✅ hotovo.** Logika je v `core/lumi/trail.ts` (`pushTrail`/`pruneTrail`/
  `trailFade`), scéna jen plní 24 instancí. Vzorkuje se **pohybem**, takže stopa není
  delší na 60 fps než na 20; dozníváním se zkrátí i při stání. Na mobilu (`detail=false`)
  se nekreslí. Jas jde přes `setColorAt`, ne `opacity` materiálu (ta je pro instanci
  společná).
- **L-8 (kapitoly) — ✅ hotovo.** `LUMI_CHAPTERS` v `world.ts` (jeden dozvuk na cestu:
  titulek + text cs/en), `chapterAfter(pathId)` pro panel po doletu a `introFor(pathId, paths)`
  pro **jiný úvod vracejícímu se hráči** — splňuje akceptaci „odemkne se jiný úvodní text,
  ne jen cesta". Nic se neukládá: kapitola plyne z `journal.paths`, takže není potřeba
  měnit schéma `nirvana.lumi.v1` (starý deník funguje dál).
- **L-4 (VR) — ⚠️ částečně.** `LumiCanvas` bere `xrStore` a obalí scénu `<XR>` (stejný
  vzor jako Saturn/MOBA); v XR se **nepoužívá `CameraRig`** (kamera patří headsetu), místo
  toho `XROrigin` letí kousek za Lumi, aby ji člověk viděl a neseděl v její hlavě. Vstup jde
  přes `VrInputs` → **syntetické klávesy** (`ArrowUp/Left/Down/Right`, spoušť = `Space`),
  takže fyzika i server vidí totéž co z klávesnice. **Chybí:** „letět pohledem" (dnes
  joystick, ne směr hlavy) a jakékoli ověření na headsetu — audit hlídá jen to, že klik na
  `VR` bez WebXR scénu nerozbije.
- **L-7 (denní světlo) — ✅ hotovo.** `lightsFor(pathId, date)` seeduje z data v UTC,
  `pathData(id, date)` je jediná cesta k datům. Posun ±9 jednotek, světlo nesmí do
  svatyně (`r + 6`), id ani texty se nemění. **Test:** `lumi-flight.mjs` (stejný den =
  stejná obloha, zítra jiná, meze mapy, žádné světlo ve svatyni). Pozor: testy musí
  číst `pathData(...).lights`, ne `LUMI_LIGHTS`, jinak běží proti jiné obloze, než
  jakou hra kreslí.
- **L-6 (předání lucerny):** mění `fly` zprávu → **další bump protokolu** (31 už zabrala
  flotila, takže 32) a znovu platí „net první, pak appka". Server musí ověřit, že dárce
  to světlo opravdu má (jinak jde darovat cizí).
- **L-12 (výkon) — ✅ hotovo, měřeno.** `?fps=1` v appce **neexistuje**; měří se
  `lumi-mobile-perf.mjs` (dvě velikosti, rAF 2 s + `__lumiDebug().renderer`).
  Naměřeno 390×844: **31 draw calls, 59 fps**, 19 795 tris, 2 textury; desktop 1440×900:
  36 calls. Akceptace (< 60 calls, ≥ 30 fps) je splněná. Stopa se na mobilu nekreslí
  (`detail=false`) a pixel ratio je stropované přes `canvasDpr()` (viz §7).

**Co záměrně nedělat:** nepřidávat nepřátele ani časový limit. Lumi je místo, kde se nemá
co pokazit; jakákoli „výzva" by rozbila její smysl.

---

## 11. Registr pastí (co už jednou kouslo)

| # | Past | Jak se projeví | Řešení |
|---|---|---|---|
| **P-1** | Whitelist her v `join` | `joinLumi` tiše skončí v `arena` (místnost `arena-1`) | nová hra = nový záznam ve whitelistu v `protocol.ts` (stalo se u tanků i u Lumi) |
| **P-2** | Uspaná karta v prohlížeči | rAF stojí, teleport proběhne, ale sim ho nezaznamená | E2E musí před akcí `page.bringToFront()` |
| **P-3** | `public/` chybí ve `standalone` | lucerna se tiše nahradí primitivem | kopírovat `public` a `.next/static` do `.next/standalone/apps/nirvana` |
| **P-4** | Middleware gatuje všechno | `/models/lampion.glb` vrátí 307 → fallback | `/models`, `/textures`, `/portraits`, `/audio` musí zůstat v `PUBLIC_PREFIXES` |
| **P-5** | `recordJourney` bez idempotence | dvě světla se počítají dvakrát | světla jsou množina (`Set`), ne pole s duplicitami |
| **P-6** | **Rotace v headless rendereru** | CSS `transform: rotate()` na HTML prvku se v auditním prohlížeči kreslí jinam (SwiftShader) a šipka kompasu „míří špatně" | kompas otáčí **SVG atributem** `transform="rotate(a 12 12)"`; měřeno na zvětšené šipce (54° vs cíl 41°) |
| **P-7** | WebGL start ve swiftshaderu | první telemetrie přijde později než po 1,2 s → HUD ještě nemá kompas | testy **čekají na selektor** (poll), ne na pevný `wait` |
| **P-8** | `join` parser a `path` | cesta místnosti se ztratí, všichni letí `calm` | `path` se posílá v `join` a server ho bere jen od prvního |
| **P-9** | Paralelní session dělá `git add` přes celý strom | tvoje staged soubory skončí v cizím commitu | po commitu ověřit `git log --oneline -1 -- <soubor>` |
| **P-10** | `cp -a src dst`, když `dst` existuje | obsah se zanoří (`static/static/…`) a server vrací **404 na chunky**, i když soubory na disku jsou | před kopírováním `dst` smazat (`rm -rf … && cp -R src dst`), ne kopírovat do existujícího |
| **P-11** | Paralelní `next build` maže `.next/standalone` | audit hlásí `canvas=0` / `404` na chunky / chybějící `public` (v tomhle monorepu staví appku i druhá session) | ověřuj z **izolované kopie**: `cp -R .next/standalone /tmp/run`, do ní `static`+`public`, spouštěj odtud |
| **P-12** | Test na `opacity === '0'` | přechod 0,25 s vrátí `1.04542e-08`, takže test selže na funkční věci | měř `parseFloat(...) < 0.05`; totéž platí pro každou animovanou hodnotu v auditu |

---

## 12. Otevřené otázky pro 👤

1. **Deploy:** mám nasadit proto 30 (net → app), nebo se čeká na jinou dávku?
2. **Odměna za darování:** +150 bodů je hodnota z hlavy. Má být darování *výhodnější*
   (tj. hra tlačí k velkorysosti), nebo neutrální?
3. **Třetí cesta `light`:** odemyká se po `calm` + `wind`. Je to dost přísné? (Ze sedmi světel
   na cestě je nejtěžší a nejdelší.)
4. **Co-op velikost:** 4 je kompromis. Chceš 2 (intimnější) nebo 6 (živější obloha)?
5. **Lokalizace:** zůstává CS + EN, nebo přidat třetí jazyk ( která kultura v kanonu chybí)?

---

## 13. Změnový log

| Datum | Co |
|---|---|
| 2026-11-04 | Svět vzniká jako `/kridla` (Křídla), tři cesty, deník, zvuk, LOD lucerny |
| 2026-11-05 | Přejmenováno na **Lumi**; HUD `🏮 X/7`, panel Uranu „Letět s Lumi"; společné létání (proto 30) |
| 2026-11-05 | Kompas k nejbližšímu světlu / svatyni (`nextTarget`), jména spolulentců, testy 45/30/15/46 |
| 2026-11-05 | Plán doplněn: **mapa souborů** (§3), měřený stav živého netu (`proto 26`, build `20261104T050941Z`) a implementační poznámky k L-2…L-12 s pastmi, které v kódu reálně jsou |
| 2026-11-05 | **L-2 duchové** (server: `ghostUntil` 3 s, `liveCount()`; klient: rozpouštění), **L-5 foto mód** (`is-photo`, `Esc`/`✕ zpět`), **L-9 reduced motion** (mraky, jiskry, blikání lucerny). Testy: net **18/18**, audit **50/50**, `tsc` + `next build` čisté. Nenasazeno (proto 30 stále čeká) |
| 2026-11-05 | **L-3 stopa** přepsána do `trail.ts` (vzorky pohybem, doznívání, `setColorAt`, na mobilu vypnuto) — **15/15**; **L-7 denní obloha** (`lightsFor`/`pathData` seed z UTC data) — `lumi-flight` **53/53**; testy musí číst `pathData().lights`, ne `LUMI_LIGHTS` |
| 2026-11-05 | **L-8 kapitoly** (dozvuk po každé cestě + jiný úvod pro vracejícího se hráče, bez změny schématu deníku) — `lumi-journal` **43/43**; **L-4 VR vrstva** (`<XR>`, `XROrigin`, syntetické klávesy, `VrButton`) — 2D ověřeno auditem (**54/54**), headset netestován a „letět pohledem" chybí |
