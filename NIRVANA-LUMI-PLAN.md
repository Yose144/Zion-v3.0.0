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
| **Hotovo** | 3 cesty, 7 světel + úlomky příběhu, darování, deník, zvuk, LOD lucerny, kompas, HUD, co-op. |
| **Dluh** | Živý net je na protokolu **26**, repo na **30** → co-op se do nasazení nepřipojí (viz §9). |
| **Ověřeno** | 45 + 30 + 15 + 46 kontrol (tab. §8), `tsc` a `next build` čisté. |

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

### 3.1 `src/core/lumi/world.ts` (299 řádků) — data

- `LUMI_LIGHTS` (7), `WIND_LIGHTS`, `LIGHT_LIGHTS` — pozice, prstenec, tón.
- `LUMI_CURRENTS` — proudy vzduchu (střed, poloměr, `lift`).
- `LUMI_ISLANDS` — plošiny; `z` je hloubka, aby obloha měla vrstvy.
- `LUMI_SHRINE` / svatyně per cesta.
- `LUMI_PATHS` — tři cesty: `calm`, `wind`, `light` (jméno, poznámka, intro).
- `LUMI_GIFT` + `LUMI_GIFT_BONUS = 150`.

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

### 3.3 `src/core/lumi/LumiScene.tsx` (799 řádků) — scéna

- **Protagonista** z primitiv (`Lumi`), lucerna je decimovaný GLB
  (`public/models/lampion.glb`, 13 325 trojúhelníků, 0,21 MB; originál 242 648 / 4,36 MB).
  LOD vyrábí `scripts/ops/lumi-lantern-lod.py`.
- **Mobil (`detail = false`)** lucernu vůbec nenačítá — kreslí primitiv, aby se neplatil
  download ani 13k trojúhelníků.
- **Kamera** (`CameraRig`) sleduje hráčku zblízka, mírně napřed ve směru letu; jinak by
  holčička byla 20 px vysoká a splynula s ostrovy.
- **Ostatní letci** (`RemoteFlyers`) se kreslí **bez modelu lucerny** — jen svítící tělo +
  koule světla. Čtyři kopie 13k modelu by scénu zabily a z dálky stejně nejsou vidět.
- **Debug háčky** (jen `?lumiDebug=1`): `__lumiDebug()`, `__lumiTeleport(x, y)`,
  `__lumiLights`, `__lumiShrine`. Bez nich by E2E muselo hrát hru „doopravdy", což je pomalé
  a nespolehlivé.
- **Telemetrie** `onStats` ~6×/s (`LumiStats`), sdílený let posílá `onFly` 20×/s.

### 3.4 `src/app/lumi/page.tsx` (553 řádků) — UI

Fáze `intro → flying → done`:

- **Intro:** název cesty, tři karty cest (třetí zamčená), přepínač **Sólo / S kamarádem**.
- **Let:** HUD (7 teček, energie, čas, **kompas**), nápověda, text úlomku, cíl, spoluletci.
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
- Měřeno na 1440×900 (M1, ANGLE): ~44 draw calls, ~20,5 tis. trojúhelníků, 2 textury.

---

## 8. Testy — co měří a jak je spustit

| Test | Kde | Kontrol | Co ověřuje |
|---|---|---|---|
| Let | `apps/nirvana/test/lumi-flight.mjs` | **45** | lucerna zvedá a dochází, proudy nesou a dobíjí, cesta jde dohrát, skóre nezáporné, **kompas** míří na nejbližší světlo / svatyni / `null` |
| Deník | `apps/nirvana/test/lumi-journal.mjs` | **30** | ukládání, idempotence světel, odemykání `light` až po `calm`+`wind`, darování |
| Společný let (server) | `apps/nirvana-net/test/lumi.mjs` | **15** | dva se vidí, světla sdílená, nový hráč je dostane, cesta z prvního joinu, svatyně až po sedmi, odchod jednoho nezhroutí druhého |
| Audit v prohlížeči | `.artifacts/probe/lumi-audit.mjs` | **46** | scéna se vykreslí, let reaguje na vstup, 7 světel → svatyně → panel → dar → skóre na tabuli, deník, **kompas**, model lucerny se opravdu načetl, konzole bez chyb |
| Živý co-op | `.artifacts/probe/lumi-coop-live.mjs` | 5 | dva prohlížeče: oba vidí „letí 1", světlo sebrané jedním má i druhý |

```bash
cd apps/nirvana       && npx tsx test/lumi-flight.mjs && npx tsx test/lumi-journal.mjs
cd apps/nirvana-net   && npm run build && node test/lumi.mjs
# audit + co-op potřebují běžící appku (3014) a net (3012), viz §9
NIRVANA_BASE=http://127.0.0.1:3014 node .artifacts/probe/lumi-audit.mjs
```

Regresní minimum před commitem: `npx tsc --noEmit`, `npx next build`, `lumi-audit`,
`apps/nirvana-net/test/{smoke,lumi}.mjs`.

---

## 9. Nasazení

> **Blokující fakt:** živý net je na protokolu **26**, repo na **30**.
> Deploy **net první, pak appka**. Opačné pořadí = `proto_mismatch` a mrtvý chat i multiplayer.

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

---

## 10. Backlog pro novou session

Seřazeno podle poměru přínos / riziko. Každá položka má **akceptační kritérium**, aby se
„hotovo" dalo změřit, ne odhadnout.

| ID | Co | Akceptace | Riziko |
|---|---|---|---|
| **L-1** | Nasadit proto 30 (net → app) | `/net/health` hlásí 30, co-op se připojí, `lumi.mjs` projde proti živému netu | nízké, ale **musí být první** |
| **L-2** | Duchové: doletět místnost i po odpojení (poslední známá pozice 3 s) | odpojený hráč mizí z oblohy až po 3 s, ne okamžitě | nízké |
| **L-3** | Světelná stopa za lucernou (trail), jen `detail` | na M1 ≥ 50 fps, na mobilu vypnuto | nízké |
| **L-4** | VR let (`core/xr` už existuje pro Merkur/Venuši/Saturn) | v headsetu jde letět pohledem, lucerna na spoušti; bez headsetu se jen nesmí rozbít 2D | střední |
| **L-5** | Foto mód (skrýt HUD, volná kamera) | tlačítko skryje veškerý chrome, `Esc` vrátí | nízké |
| **L-6** | Druhá ruka: lucerna jde „předat" spoluletci (co-op emote) | druhý hráč dostane světlo do HUD, server to vidí ve `flyers` | střední (protokol) |
| **L-7** | Denní světlo: jedenkrát denně jiná pozice sedmi světel (seed z datumu) | stejný den = stejná obloha pro všechny, zítra jiná; test determinismu | nízké |
| **L-8** | Kapitoly příběhu mezi cestami (text po každé cestě) | po `calm` a `wind` se odemkne jiný úvodní text, ne jen cesta | nízké |
| **L-9** | Přístupnost: `prefers-reduced-motion` vypne vítr a částice | s preferencí se nehýbe pozadí, hra zůstane hratelná | nízké |
| **L-10** | Lokalizace do třetího jazyka (EN je hotové; CS je výchozí) | všechny texty z `world.ts` mají klíč, žádný hardcoded string v `page.tsx` | nízké |
| **L-11** | Odměna za darování v kooperaci (společná svatyně = +body všem) | dva hráči doletí → oba dostanou bonus, ne jen ten, kdo doletěl první | střední |
| **L-12** | Výkon: instancované částice na mobilu | 390×844 ≥ 30 fps (měřeno `?fps=1`), draw calls < 60 | střední |

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
