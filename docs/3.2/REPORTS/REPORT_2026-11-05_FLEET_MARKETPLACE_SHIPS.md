# Flotila z marketu — 3D lodě z Marketplace jako volný let v Nirvaně

**Datum:** 2026-11-05
**Rozsah:** `apps/MarketPlace/public/shop/models/*.stl` → `apps/nirvana/public/models/fleet/*.glb` → route `/fleet`
**Stav:** **NASAZENO 2026-11-05 11:30 UTC** (`deploy-nirvana.sh --artifact-dir` build `20261105T113053Z`) — předtím funkční lokálně (build čistý, 35 testů simulace, 16 kontrol v prohlížeči)

---

## 1. Zadání a rozhodnutí

👤: „koukni se na 3D modely lodí v marketu, přeneseme je teď do Nirvany, myslím 3D modely Star Wars,
komplexně k nim pak vyrenderujeme grafiku a předáme je pro volný pohyb po Nirvaně, dokovat budou
na Nabukanu a Issobelle."

Čtyři rozhodnutí, která určila podobu:

| Otázka | Volba |
|---|---|
| Vzhled lodí | **Malované sci-fi (metal + panely)** — ne dřevo |
| Rozsah | **Sólo free flight + 2 doky** (multiplayer až další vlna) |
| Kolik lodí | **Všech 7** (Millennium Falcon vynechán — nemá lokální model) |
| Právní otázka (Star Wars IP + cizí kit) | Odloženo na před-launch, zapsáno jako otevřený bod |

---

## 2. Co v marketu reálně je (měřeno, ne odhad)

`apps/MarketPlace/public/shop/models/` — 7 souborů, 5,1 MB. Osmý produkt (Millennium Falcon)
odkazuje na Thingiverse, lokální model nemá.

| model | trojúhelníky | destičky | bbox (j.) | nejdelší osa | tloušťka destičky (medián) |
|---|---|---|---|---|---|
| awing | 10 508 | 1 273 | 7,6 × 13,7 × 4,0 | Y | 0,04 |
| bwing | 20 264 | 4 429 | 9,2 × 19,1 × 14,2 | Y | ≈0 |
| ikaruga | 21 136 | 2 755 | 13,8 × 17,7 × 5,7 | Y | 0,04 |
| snowspeeder | 11 016 | 1 627 | 12,2 × 9,5 × 3,7 | X | 0,06 |
| tiefighter | 9 228 | 1 637 | 8,6 × 6,0 × 8,0 | X | 0,06 |
| tieinterceptor | 11 220 | 1 175 | 8,6 × 10,5 × 7,5 | Y | 0,07 |
| xwing | 23 340 | 2 463 | **372,7 × 335,7 × 134,6** | X | 0,98 |

**Klíčové zjištění:** nejsou to herní modely, ale **laser-cut skládačky z překližky**.
Každá loď je 1 175–4 429 samostatných destiček o tloušťce 0,4–1 mm, plochy jsou
**otevřené** (`volume ≈ 0`, watertight jen 4–7 % dílů), **žádné UV, žádný materiál,
žádné oddělené části** (kabina, motory, přistávací nohy). Marketplace je kreslí holým
`MeshStandardMaterial` na mřížce.

Tři věci, které konverze musela řešit:

1. **4 429 destiček = 4 429 meshů** (draw callů) při naivní konverzi.
2. **Měřítko se rozchází** — x-wing je v milimetrech (373 j.), zbytek v centimetrech (~14 j.).
3. **Osy nejsou sjednocené** — 3 lodě mají nejdelší osu X, 4 Y, a „nejdelší osa" není
   vždy nos (TIE má nejdelší rozpětí panelů, ne trup).

---

## 3. Pipeline: STL → herní GLB

`scripts/ops/starfighter-glb.py` → `apps/nirvana/public/models/fleet/<id>.glb`
(+ manifest `scripts/ops/starfighter-glb.json` s tris/rozměry/počtem destiček)

Co skript dělá:

1. **Slije destičky do jednoho meshe** → 1 draw call na loď (11 k–24 k tris).
2. **Srovná orientaci** — nos = +Z, nahoru = +Y. Tabulka `SHIPS` v konvertoru je **ruční
   a ověřená pohledem na render**; heuristika z tvaru na skládačce nefunguje (B-Wing má
   nejdelší osu křídlo, TIE zase panely).
3. **Normalizuje měřítko** — délka trupu = 1,0; měřítko do scény řeší až `ships.ts`.
4. **Namaluje panely do vrcholových barev.** Tohle je jádro vizuálu: skládačka je *už*
   rozdělená na destičky, takže každá může dostat vlastní odstín laku a plátování vznikne
   samo — **bez jediné textury** (Nirvana má 21/32 textur, tohle přidává 0).
5. **Srovná normály od středu trupu ven** (`orient_outward`).
6. **Zapíše GLB vlastním writerem** (`write_glb`).

### Tři chyby, které stály za to

**(a) `trimesh.export` zapsal jen `POSITION`.** První GLB mělo jediný accessor — žádné
`NORMAL`, žádné `COLOR_0`. Ve hře to znamená: žádné odlesky (chybí normály → difúzní
světlo = 0) a černý lak (chybí barvy). Diagnóza byla z JSON chunku GLB, ne z kódu.
Řešení: vlastní writer (~80 řádků) s `POSITION` + `NORMAL` + `COLOR_0` + indexy.

**(b) sRGB vs lineární prostor.** Paleta je napsaná jako sRGB (jak ji vidí oko), ale
`COLOR_0` v glTF je **lineární**. Bez převodu (`srgb_to_linear`) je lak o dva stupně
světlejší a scéna přesvětlená — na druhém renderu byla loď skoro bílá.

**(c) Obrácené normály u poloviny destiček.** Skládačka je soubor otevřených ploch, takže
část destiček má normálu dovnitř. Projevilo se to jako černé fleky: příď tmavá, záď bílá,
přitom obě osvětlené stejně. `orient_outward` srovná winding podle `normal · (centroid − střed) < 0`.
Není to fyzikálně správné (vnitřní strana pláště by měla mířit dovnitř), ale je to
**vizuálně správné**: loď je zvenku a každá destička má mít světlo na straně, na kterou se díváme.

### Materiál

`MeshStandardMaterial` + `vertexColors` + `metalness 0.3` + `roughness 0.42` +
**`side: DoubleSide`**. `DoubleSide` není kosmetika: destičky jsou otevřené, takže mezerami
mezi nimi je vidět rub — a ten se musí vykreslit jako tmavá spára, jinak je loď děravá.

**Kov potřebuje prostředí.** `metalness > 0` odráží jen `scene.environment`; bez něj je loď
černá i při silných světlech (přesně to bylo na prvním živém snímku). Řešení:
`RoomEnvironment` + `PMREMGenerator` (je součástí `three`, nic se nestahuje), intenzita 0,55.

---

## 4. Render pipeline (turnaround sheety)

`scripts/ops/fleet-render/` (vzor `oasis-avatar-render`): esbuild bundle → lokální HTTP server →
headless Chromium (ANGLE/Metal) → 2×2 pohledy (příď / tři čtvrtě / bok / záď) do jednoho PNG.

Výstup: `.artifacts/render/fleet/<id>.png` (7 sheetů) + `launch.png`, `docked.png`, `flight.png`,
`hangar.png` z auditu.

**Proč to existuje:** orientace a lak se v datech zkontrolovat nedají. B-Wing měl špatné
znaménko nosu (`flip: True` → letěl by pozadu) a poznalo se to až na boku sheetu — kokpit
byl vpravo místo vlevo. Stejně tak první pokus o kameru (opsaná koule) nechal loď v třetině
buňky; nahrazeno skutečným průmětem osmi rohů bboxu.

---

## 5. Hra: `/fleet`

### `core/fleet/flight.ts` — čistá simulace (bez three.js)

Arkádový let: nos = +Z, `yaw`/`pitch`, rychlost jde za plynem s omezením `accel`,
zatáčení úměrné rychlosti (`0,45 + 0,55 · speed/max`) — stojící loď se nemá čím opřít.
Boost je palivo (`BOOST_BURN`), brzda je **2,2× silnější než plyn** (`BRAKE_FACTOR`) —
je to nástroj, kterým se doletí na dok; kdyby brzdila stejně, hráč by vždy přeletěl.
Hranice `WORLD_RADIUS = 34`, planeta `PLANET_RADIUS = 4,4` (nedá se do ní vletět).

### `core/fleet/docks.ts` — doky jako funkce času

* **Nabukano**: 3 kotviště na dokovacím rámu pod trupem (`vessels.tsx`: rám `[0.02, −0.15, 0]`,
  kotviště `x = −0,30 / 0,02 / 0,34`), × `NABUKANO_SCALE = 4`, otočeno `fleetHeading(t)`,
  poloha z `fleetPosition(t)`. Loď visí 0,28 j. pod deskou.
* **Issobella**: stanice na prstenci, `[RING_R, −0,95, 0]` transformované **stejnou** rotací
  jako `IssobellaRing` (`Euler(0.32, ringSpinAngle(t), −0.14)`).

Oba doky se **hýbou**, protože se hýbe flotila i prstenec. Simulace to řeší tak, že zakotvená
loď uživatelem neřízeně **kopíruje pozici doku** — kdyby si držela vlastní souřadnice, ujela by
z něj během pár sekund.

**Dokovací paprsek:** v okruhu `DOCK_RADIUS = 1,5` a při rychlosti < `DOCK_MAX_SPEED = 5`
dok loď přitáhne (1,8/s) a zbrzdí. Bez toho nešlo přistát vůbec — volnoběh táhne dopředu
0,35 × maximum, takže loď z okruhu vždy odjela dřív než za `DOCK_HOLD = 1,5 s`. Odhalil to
test, ne hra.

### `core/fleet/FleetScene.tsx`

Model z marketu (`useGLTF`, materiál výše) + trysky (aditivní jádro + kužel, prodlužuje se
plynem), Nová Země s atmosférou, prstenec Issobelly se stanicí, Nabukano ze sdíleného kitu,
značky doků (pulzující prstence: cyan = Nabukano, zlato = Issobella), hvězdy (`Points`).

Kamera: dohánění přes `dampFactor` (`design/motion.ts`), vzdálenost 1,75 j. + 0,13 × rychlost.
**Při zakotvení se kamera přesune zespodu** — za lodí by stála uvnitř dokovacího rámu a hráč
by místo svého stroje viděl tmavou desku.

### `app/fleet/page.tsx`

Hangár (7 karet s tahu/obratností) → let → panel po přistání (jméno doku + odpojení) →
zpět do hangáru. Klávesy: `W` plyn, `S` brzda, `A/D` zatáčení, `↑↓` klopení, `Q/E` náklon,
`Shift` boost. Dotyk: joysticková trojice + PLYN/BRZDA/BOOST přes `TouchButton`
(syntetické klávesy, žádná druhá cesta vstupu). `body[data-playing]` během letu schová
navigaci i chat. Debug háček `?fleetDebug=1` (`state`, `docks`, `teleport`, `dock`, `yaw`, `speed`).

Loď je v `GAME_LINKS` (id `fleet`), takže se objeví v liště her i v konzoli.

---

## 6. Ověření

**Simulace** — `npx tsx apps/nirvana/test/fleet-flight.mjs` → **35/35**
(plyn/brzda/boost, zatáčení podle rychlosti, meze klopení, hranice prostoru, planeta,
čtyři doky, pohyb doků v čase, nedokončené držení, zakotvení, kopírování pohybu doku,
odpojení, odmítnutí přistání v plné rychlosti, kotvení na Issobelle, telemetrie, rozdíly lodí).

**Prohlížeč** — `node .artifacts/probe/fleet-audit.mjs` → **16/16**
(hangár 7 karet, start scény, **model se opravdu stáhl z `/models/fleet/`**, plyn rozjede loď,
loď se posune, zatáčení, kotvení na Nabukanu včetně panelu, odpojení + impuls,
kotvení na Issobelle, tři údaje HUD, cíl v HUD, 0 chyb v konzoli mimo pre-existing 401).
Test **nespustí** hru bez modelu: `performance.getEntriesByType('resource')` musí obsahovat
`/models/fleet/` — jinak by prošel i rozbitý loader.

**Build:** `npx tsc --noEmit` čistý, `npx next build` OK (`/fleet` v routách).

**Naměřeno:** 113 263 trojúhelníků za všech 7 lodí (max 24 332), GLB 0,44–1,04 MB
(celkem 4,9 MB), 0 textur navíc, 1 draw call na trup + 2 na trysku.

### Pasti, které se potvrdily

* **GLB musí ležet pod `/models`** — jen ten prefix je v `middleware.ts` veřejný. Kdyby
  zůstalo `/fleet/*.glb`, middleware by vrátil 307 na ZAP bránu a `GLTFLoader` by dostal HTML.
  (Stejná past je zapsaná u Lumi lucerny.)
* **`trimesh` v 5.2 nezapíše normály ani barvy** — export vypadá úspěšně, ale model je černý.
* **Otevřené destičky**: `volume ≈ 0`, takže všechny kontroly „je to watertight" padají;
  konverze se na watertight nesmí spoléhat.
* **3DRender bez `scene.environment`** = kov je černý; světla to nespasí.

---

## 6b. Mobil a výkon (druhá vlna, 2026-11-05)

**Mobil** — `apps/nirvana/e2e/fleet-mobile.mjs` → **16/16**. Emuluje `isMobile` + `hasTouch`
(bez nich se v Chromiu nevyhodnotí `(pointer: coarse)` a hra dotykové ovládání vůbec nevykreslí —
proto je `PHONE`/`PHONE_LANDSCAPE` v `e2e/_browser.mjs` a `pickTouch` v puppeteer větvi).

Test měří **důsledek, ne počet tlačítek**: po stisku PLYN musí loď zrychlit
(`0,9 → 3,5`), po stisku ← se musí změnit kurz. Dále: 7 dotykových tlačítek ≥ 44 px,
HUD nepřekrývá pad, panel doku se vejde do obrazu, tlačítka doku ≥ 38 px,
na šířku (844 × 390) nic nepřetéká a ovládání zůstane celé v obraze.

**Dvě chyby, které to odhalilo (obojí reálné, ne kosmetika):**

1. **Tlačítko „Vzlétnout" bylo na telefonu pod okrajem.** Sedm karet je vyšších než
   displej, takže se na CTA muselo scrollovat — a nikdo to neuhodne. Lišta je teď
   `position: sticky` dole. **Past:** `.fleet` měl `overflow: hidden`, takže sticky
   se lepilo ke dnu *celé stránky*, ne k oknu, a tlačítko zůstalo mimo obraz.
   `overflow: hidden` proto patří jen `.fleet.is-flying`.
2. **Bublina chatu (`fixed`, z 60) seděla přes odkaz „Online místnosti".** Na ≤760 px
   má lišta pravý inset `4,4rem` a odkaz jde pod tlačítko.

**Výkon** (1440 × 900, M1 Metal, `?fleetDebug=1` → `renderer()`):

| metrika | hodnota | strop |
|---|---|---|
| draw calls | **21** | < 200 (univerzum 175) |
| trojúhelníky | **25 960** | < 120 000 (univerzum 90 k) |
| textury | **4** | 32 (univerzum 21) |
| fps | **60** | ≥ 30 |

Pro srovnání: lucerna v Lumi má 13 k tris sama o sobě; celá flotila i s carrierem
a stanicí je pod polovinou scény univerza.

**Past s E2E:** `npx next start` se zabíjí špatně (`child.kill()` ukončí jen wrapper,
`next-server` zůstane na portu) — druhý běh auditu pak mluvil se starou instancí bez
oracle stubu a test prošel na ZAP bráně. Proto `e2e/_app.mjs`: spouští binárku přímo,
`detached: true` a zabíjí celou procesní skupinu; když appka už běží, **řekne nahlas**,
že brána nevrací `access:true`.

---

## 6c. Společný let — multiplayer (protokol 31)

**Architektura: relay, ne autoritativní simulace.** Volný let nemá zásahy, skóre ani soupeře,
takže není co podvádět: klient počítá svůj pohyb sám (stejná `stepShip`) a server ho jen
předává ostatním. Serverová fyzika by znamenala platit latenci a složitost za ochranu, kterou
hra nepotřebuje — stejná úvaha jako u Lumi.

**Co server drží doopravdy** (`apps/nirvana-net/src/fleet.ts`, kontrakt `Match`):

* kdo je v místnosti a **kterou lodí letí** (id ověřené proti `SHIPS`, ne proti tomu, co
  pošle klient; neznámé id spadne na `xwing`),
* **ověřené hodnoty** — konečná čísla, souřadnice v hranicích prostoru (±34), `yaw`
  zabalený do (−π, π], pitch ±1,2, roll ±1, rychlost ±40, `dockId` **jen ze seznamu
  skutečných doků** (neexistující dok se zahodí i s příznakem `docked`),
* **duchy** odpojených (3 s), aby loď nezmizela uprostřed oblohy; sedlo se uvolní hned.

**Protokol (30 → 31):**

| prvek | změna |
|---|---|
| `GameId` | `+ 'fleet'` |
| `join` | `+ shipId?: string` |
| `ClientMessage` | `+ { t: 'flight', x, y, z, yaw, pitch, roll, speed, docked?, dockId? }` |
| `SnapshotMessage` | `+ fleet?: { pilots: [...] }` (vlastní stav se nevrací) |
| konstanta | `FLEET_ROOM_SIZE = 6` |

**Klient:** `useNet` dostal `joinFleet(shipId)` a `sendFlight(...)` (throttle 20 Hz;
**změna doku jde mimo throttle**, jinak by ostatní viděli loď na doku, který už opustila).
`FleetScene` kreslí cizí piloty **stejným modelem i materiálem** jako vlastní loď (jinak by
dva lidé viděli jinou hru), pozice čte z refu ve `useFrame` — snapshoty 15×/s by jinak
překreslovaly celý strom. Sloty jsou klíčované **id pilota**, ne indexem: když někdo odejde
a jiný se přidá, nesmí se mu „převléknout" loď. Duch mizí plynule (opacity + zmenšení).

**Lobby:** flotila má dlaždici v `/multiplayer` (`seats: 6`) a `watch.ts` zná
`fleet-N`, takže jde místnost i sledovat.

### Ověření

| test | výsledek |
|---|---|
| `apps/nirvana-net/test/fleet.mjs` | **24/24** (dva piloti, poloha/natočení, ořezy, neexistující dok, neznámá loď, duch 3 s, kapacita 6 + přebytek do druhé místnosti) |
| `apps/nirvana/e2e/fleet-online.mjs` | **12/12** (appka ↔ net: join z tlačítka, cizí loď ve scéně, pohyb, **přistání protistrany vidět**, zpětný směr) |

Online test používá jako protistranu **Node WS klienta**, ne druhé okno prohlížeče: headless
WebGL se táhne a druhý kontext by měřil latenci, ne hru.

### Pasti (reálné, stály čas)

1. **Origin allowlist.** Služba bez `NIRVANA_NET_ALLOWED_ORIGINS` zavře spojení z `:3010`
   (403) a hra zůstane „offline", aniž by cokoli řekla — v testu to vypadalo jako rozbitý join.
2. **Server nesmí tahat `three`.** `docks.ts` počítá polohy přes `three`, a deploy
   `nirvana-net` kopíruje jen `ws` — `require('three')` by službu shodil při startu. Proto má
   server vlastní seznam `DOCK_IDS` (**kopie**, ne import) a když se doky v klientovi změní,
   musí se změnit i tam.
3. **`noUncheckedIndexedAccess`** v `nirvana-net` je přísnější než v appce — `SHIPS[1]`
   je `ShipSpec | undefined`, takže fallback loď potřebuje `!`.
4. **Zabíjení dětí.** Když test spadl na timeout, `next-server` i net služba zůstaly na portu;
   druhý běh se pak připojil ke staré instanci **bez oracle stubu** a měřil ZAP bránu.
   `_app.mjs` teď binárku spouští přímo (`detached`), zabíjí celou skupinu a navíc **ověří
   `access:true`** — jinak hlasitě spadne.
5. **Souběžný build ve stejném `.next`** (paralelní session) dokáže do bundlu vnést cizí
   `NEXT_PUBLIC_NIRVANA_NET_URL`; lokální `.next` proto není důkaz o buildu. Deploy skript
   buildí sám.

### Nasazeno (2026-11-05, 14:00 UTC)

| krok | release | ověření |
|---|---|---|
| `deploy-nirvana-net.sh` | `20261105T140031Z` | `/net/health` → `proto 31` |
| `deploy-nirvana.sh --artifact-dir` | `20261105T140642Z` | `/api/health` → `proto_match: true`, smoke 7/7 |

App artefakt se **nestavěl z pracovního stromu** (paralelní session tam má rozdělanou Lumi
práci a `.next` může být kontaminovaný cizím buildem), ale z **čistého worktree na commitu
`8eb02aaef`**: `git worktree add`, `cp -al node_modules` (hardlink klon — symlink rozbije
standalone strom), `next build`, zploštění artefaktu a `--artifact-dir`, takže deploy skript
už jen rsyncoval hotový strom. Před nasazením se v bundlu kontrolovalo, že neobsahuje cizí
`ws://127.0.0.1:<port>` (nález z dřívějška: souběžný build umí do `.next` vnést cizí
`NEXT_PUBLIC_*`).

**Živě ověřeno:** app i net `active`, oba `proto 31`, `/fleet` → 307 (ZAP brána), všech 7 GLB
200, v nasazeném klientu je `t:"flight"`, `fleet-` i `proto:31`. Dva WS klienti proti
produkci dostanou `welcome proto 31` a `join` je odmítnut `pass_required` — brána platí i na
WS vrstvě. **Plný dvouklientový test místnosti na produkci neproběhl**: vyžaduje platný ZAP
pass a použít zákaznický kód z `archive-market-codes.json` by nebylo v pořádku. Stejný kód
je ověřený lokálně (12/12).

Rollback: předchozí strom zůstává v `/opt/zion/APP&WEB/nirvana.before-20261105T140642Z`
a `/opt/zion/APP&WEB/nirvana-net.before-20261105T140031Z`.

### Pořadí nasazení (důležité)

`PROTO_VERSION` je **31**, živá net služba je na **30**. Platí pravidlo: **nejdřív
`deploy-nirvana-net.sh`, pak appku.** `deploy-nirvana.sh` to kontroluje sám
(`scripts/ops/nirvana-proto-check.sh`) a při novějším klientovi se zastaví — obejít jen
vědomě přes `ZION_SKIP_PROTO_CHECK=1`.

---

## 7. Meze (co se nemá hlásit jako hotové)

* **Multiplayer je hotový lokálně, ale nenasazený** — živá net služba je na protokolu 30,
  klient na 31. Bez deploye net-first by se hráči připojili a dostali `proto_mismatch`.
* **Mobil ověřen emulací (`isMobile` + `hasTouch`), ne na skutečném zařízení.** Detail v §6b.
* **VR není.** Scéna nemá `<XR>`; kamera je cinematic (v headsetu by to „letělo hlavou").
* **LOD není.** 7 × ~16 k tris je v rozpočtu scény (univerzum má 90 k), ale při multiplayeru
  s deseti loděmi se to bude muset řešit zjednodušením.
* **Marketplace dál kreslí holé STL** (`StarfighterViewer`). Nahrazení novým GLB by bylo
  přirozené (stejný model jako ve hře), ale je to samostatná změna v `apps/MarketPlace`.
* **Právní:** tvary jsou Star Wars a modely pocházejí z cizího kitu
  (`handpanda/wooden-starfighter`, licence nedohledána). Pro ZAP-pasovanou Nirvanu to
  neřešíme, **před veřejným launchem je to blocker** — dohodnuto s 👤.
* **Trysky v modelu nejsou.** Světlo dodává scéna; kdo by chtěl emissivní trysku přímo
  v GLB, musí sáhnout do konvertoru (a rozbít tím „0 textur" výhodu jen částečně).

---

## 8. Jak to měnit

```bash
# 1) nový/upravený model v marketu
#    → apps/MarketPlace/public/shop/models/<id>.stl

# 2) konverze (tabulka orientace SHIPS je v konvertoru!)
python3 scripts/ops/starfighter-glb.py            # všech 7
python3 scripts/ops/starfighter-glb.py --only xwing

# 3) kontrola pohledem (turnaround sheet) — orientace a lak
node scripts/ops/fleet-render/render.mjs --only xwing

# 4) letové vlastnosti a měřítko
#    → apps/nirvana/src/core/fleet/ships.ts

# 5) testy
cd apps/nirvana && npx tsx test/fleet-flight.mjs
cd ../.. && node .artifacts/probe/fleet-audit.mjs   # potřebuje appku na :3010

# 6) build
cd apps/nirvana && npx tsc --noEmit && npx next build
```

Když se změní **měřítko modelu** v konvertoru, musí se změnit i `NABUKANO_SCALE` nebo
`BERTH_DROP` v `docks.ts` — jinak lodě kotví mimo rám.

---

## Nasazení (2026-11-05 11:30 UTC)

`/fleet` je live na `https://nirvana.zionterranova.com/fleet` (za ZAP pasem, proto HTTP 307 pro
nepřihlášené — stejně jako `/mars` a `/park`).

| kontrola | výsledek |
|---|---|
| route v `app-paths-manifest.json` | `/fleet/page` (47 rout celkem) |
| statický výstup | `.next/server/app/fleet.html` (9,9 kB) + `.rsc` |
| klientský chunk s `models/fleet` | `.next/static/chunks/026_fa_s2ot_s.js` |
| 7 GLB modelů | **200** (`/models/fleet/{xwing,bwing,awing,tiefighter,tieinterceptor,snowspeeder,ikaruga}.glb`, 4,7 MB) |
| net protokol | 30 = 30 (klient i server) |

**Jak se nasazovalo:** artefakt se postavil v **čistém git worktree na HEAD** (`cp -al`
node_modules, build, `--artifact-dir`), protože v pracovním stromu byla **rozpracovaná Lumi
práce jiné session** a stavět z pracovního stromu by ji odeslalo do produkce.

**Otevřené (nezměněno):** Star Wars IP + cizí kit = před-launch blocker; multiplayer, VR a
skutečný mobil neověřeny; Millennium Falcon nemá lokální model; marketplace dál kreslí holé STL.

### Druhý deploy — mobilní audit (2026-11-05 12:32 UTC)

Po commitu `e06b617dd` („flotila — mobilní audit (dotyk, layout) + měření výkonu") nasazen
build **`20261105T123201Z`**. Artefakt opět z **čistého worktree na HEAD** — v pracovním stromu
byla nová rozdělaná práce (proto 31, `/fleet/page.tsx`, `multiplayer/page.tsx`).

| kontrola | výsledek |
|---|---|
| `/fleet` v manifestu | 47 rout, `/fleet/page` |
| mobilní CSS (`fleet-touch`, `fleet-hud`, `fleet-hangar`, `fleet-dock`) | v `_next/static/chunks/0_-pz9ydbo_-j.css` |
| 7 GLB modelů | 7/7 → 200 |
| net protokol | 30 = 30 |

⚠️ **Pozor pro další deploy:** pracovní strom má rozpracovaný **proto 31**, živý net je **30**.
Deploy appky z pracovního stromu proto **pre-flight zablokuje** (správně) — nejdřív net 31, pak
appka. Artefakt z HEAD (proto 30) se nasadil s vědomým `ZION_SKIP_PROTO_CHECK=1`, protože
30 = 30 (kontrola čte pracovní strom, ne artefakt).
