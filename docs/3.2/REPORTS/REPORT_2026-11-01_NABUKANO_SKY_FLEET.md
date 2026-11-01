# REPORT — NABUKANO · Nebeská flotila (L6)

> **Datum:** 2026-11-01 · **Vrstva:** L6 (pohyblivý uzel nebe) · **Status:** kánon + web + scéna; **Nirvana nenasazená**
> **Commity:** `2e4d15be3`, `eb48e1605`, `bf6173d4d`, `76a168b6f`, `674d0c0bb`, `c618c6f97`, `e6095cec4` (+ kánon `627713dfd` — viz §6)
> **Deploye webu:** `nabukano-20261101T114003Z`, `nabukano-node-20261101T120752Z`, `nabukano-l6-20261101T122616Z`, `nabukano-nav-20261101T124635Z`, `nabukano-hero-20261101T133017Z`
> **Plán:** [`docs/3.2/NABUKANO-PLAN.md`](../NABUKANO-PLAN.md)

---

## 1. Co vzniklo

Nebeská flotila je **nový uzel L6 na svislé ose mezi pozemním uzlem LUMI (Kostarika) a stanicí Issobella**. Není to čtrnáctý pozemský bod — nemá pin na mapě, protože nevisí na místě. Nese čtyři trupy: mateřskou loď **Nabukano** s dokovacím rámem a tři nebeské Marie.

### 1.1 Kánon — kniha (7 kapitol)

`canon/books/Nabukano/` (nový svazek, DRAFT pro 3.3, registry `nabukano` navrženy a **neregistrovány**):

| # | Kapitola | Co říká |
|---|---|---|
| 00 | `00-README.md` | rejstřík, kompas, co kniha netvrdí |
| 01 | Jméno z Babylonu | Nebúkadnesar II., sen o stromu, pokora; proč loď nese královské jméno; posádková zkratka **Nabukano** |
| 02 | Loď, která pluje nahoru | „moře se přesunulo nahoru"; první úsek = **Žebřík** z LUMI; Gn 28 (oba směry) vs Gn 11 (věž) |
| 03 | Tři nebeské Marie | blízké / mezi / daleké nebe + **sekce z konceptové desky** (8 sekcí, volací znaky) |
| 04 | Dok a lucerna | rám, který se hýbe; posádka; lucerna pro **příjezd** |
| 05 | Uzel, který není bod | proč L6 a proč to není 14. pin |
| 06 | Připojení k Issobelle | nepřistává se, připojuje; 200 m / ~2 ot./min / 0,38 g; kdo dnes vozí nahoru |
| 07 | Kdo se vrací dolů | tabule návratů na obou koncích; „nahoru letenka, dolů ten, kdo čeká" |

Každá kapitola má **Kotvu pravdy** (Bible / tradice / historie / korpus / PŘÍBĚH / VIZE / NETVRDÍME). Index: `canon/books/README.md` (sekce „Koncepty a horizont"). Křížový odkaz z `canon/books/Issobella/00-README.md`.

### 1.2 Web 2.9

| Povrch | Co tam je |
|---|---|
| `/terranova/nabukano` | hero (skutečný obraz), čtyři trupy s orbitami, **studie 02** (dok se třemi kotvišti, 8 sekcí, tři doprovodné lodě), beauty shot rámu s lucernou, dvě trasy, tabulka „co existuje / co ne", CTA |
| `/l6-issobella` | sekce **„Uzly L6 — Dva uzly nebe"**: Issobella (HORIZONT) + Nabukano (VIZE) |
| navigace → Vrstvy | `L6 Issobella` je rozbalovací, dítě **Nabukano · Nebeská flotila** |
| footer | stejný odkaz v sekci vrstev |
| `/zion-archive/nabukano/cist` | čtečka knihy (korpusový svazek přes `korpusBook`, kapitoly z `doc-manifest`) |
| `sitemap.xml` | `/terranova/nabukano` |
| `lib/freeworld-sites.ts` | `body: 'orbit'` (žádný pin; `EARTH_FREE_WORLD_SITES` filtruje) + mirror v Nirvaně |
| obrázky | `public/images/nabukano/{hero,hero-m,concept-board,concept-board-m}.webp` |

### 1.3 Nirvana (scéna) — **commitnuto, nenasazeno**

- `scene/universe/SkyFleet.tsx` — mateřská loď s dokovacím rámem, tři trupy (červená / bílá / zlatá), lucerna, instancované detaily.
- `positions.ts` — `fleetPosition()` / `fleetHeading()`: **jeden vzorec pro scénu i fokus** (past z Jupiter Station).
- Portál `fleet` + slot `fleet` (nový `SceneSlot`), okno `FleetPortal`.
- Fokus `'fleet'` ve třech mapováních `Shell` + typy `SceneRoot`/`Universe`.
- **Trasy:** `FleetRoute` kreslí oblouk z **LUMI (Kostarika)** nebo z **prstence** k doku; světlo dojde za 6 s. Křivka se zamrazí při výběru (`key`), takže se geometrie nepřepočítává každý frame.
- Okno nahlas říká: *animace konceptu, ne let*.

---

## 2. Ověření

| Co | Výsledek |
|---|---|
| `tsc --noEmit` (web) | moje soubory čisté; 84 chyb **mimo** ně (fall-out cizí React 19 / workspace migrace, `ignoreBuildErrors: true`) |
| `tsc --noEmit` (nirvana) | čisté |
| `next build` (web) | OK (353 stránek), `/terranova/nabukano`, `/zion-archive/nabukano/cist[/[slug]]` v routovací tabulce |
| `next build` (nirvana) | OK |
| Live web | `/terranova/nabukano` 200, hero 200, deska 200, `/l6-issobella` 200, `/l5-free-world` **0× „Nabukano"**, mobil 390×844 bez přesahu, 0 chyb v konzoli |
| Čtečka | `/zion-archive/nabukano/cist` 200; `/api/archive/docs/korpus/Nabukano/…` bez pasu **403** (správně, fail-closed) |
| Nirvana (headless, swiftshader) | scéna 121 → 117 draw calls, 59 288 → 72 370 tris, 34 → 39 textur, `invalidVertices: 0`; s trasou 111 calls / 59 960 tris / 40 textur |
| FPS | v softwarovém renderu ~3,9 — **nemá vypovídací hodnotu**, měřit jen na GPU |

---

## 3. Meze (poctivě)

- **Nic z toho neexistuje** jako hardware: žádný trup, dok, výtah, posádka, modul. Kniha i web to říkají u každého bloku.
- **3D model je stylizovaný**, ne podle desky: rotující prstenec, dokovací uzel ani osm sekcí v geometrii **nejsou**. To je práce N3 v plánu.
- **Trasa** je animace konceptu (oblouk + světlo), bez fyziky, bez ETA.
- **Nirvana není nasazená** → CTA „Otevřít ve vesmíru" zatím otevře scénu bez flotily.
- **Registr `nabukano`** v L5/L6 API není zapsaný (👤 rozhodnutí), alokace 0 ZION.
- **Kánonizace** knihy (třída E) neproběhla — text je DRAFT.
- **Volací znaky vs. jména:** deska vede trupy jako LUMI / ISSOBELLA / TŘETÍ MARIE, kniha jako tři mariánská jména. Zatím **dvě vrstvy** (jméno + volací znak); rozhodnutí je otevřené.

---

## 4. Co se cestou opravilo

1. **Uzel omylem v L5** — karta byla na `/l5-free-world` a v L5 Pioneer Projects. Vráceno (`674d0c0bb`), L5 zůstává 12 + archa; uzel žije v L6 (sekce, navigace, footer).
2. **Placeholder hero** — generovaný přes `sharp`/SVG (31 kB), aby stránka nevypadala rozbitá a aby chyběl 404; nahrazen skutečným obrazem (`e6095cec4`).
3. **K1.2 rozbil standalone layout** (`.next/standalone/apps/<app>` + `node_modules` o patro výš) — první deploy šel přes ručně zploštěný artefakt; `deploy-web2.9.sh` i `deploy-nirvana.sh` už zplošťují (cizí commit), takže další deploye jdou z hlavy skriptu.

---

## 5. Soubory

```
canon/books/Nabukano/*.md                                  nové (8 souborů)
canon/books/README.md, canon/books/Issobella/00-README.md   +odkazy
apps/website-v2.9/src/app/terranova/nabukano/page.tsx        nová stránka
apps/website-v2.9/src/app/l6-issobella/page.tsx              sekce Uzly L6
apps/website-v2.9/src/app/zion-archive/nabukano/**           reader
apps/website-v2.9/src/lib/books/registry.ts                  NABUKANO_BOOK
apps/website-v2.9/src/app/zion-archive/library.ts            karta knihy
apps/website-v2.9/src/lib/freeworld-sites.ts                 body: 'orbit'
apps/website-v2.9/src/components/{Navigation,Footer}.tsx     odkaz pod L6
apps/website-v2.9/src/lib/translations.ts                    nav.terra_nabukano
apps/website-v2.9/src/app/sitemap.ts                         route
apps/website-v2.9/archive-content/korpus/Nabukano/           mirror kapitol
apps/website-v2.9/public/images/nabukano/*.webp              hero + deska 02 + rám
apps/nirvana/src/core/scene/universe/{SkyFleet,positions,Universe}.tsx
apps/nirvana/src/core/{portals/manifest,shell/Shell,scene/SceneRoot}.tsx
apps/nirvana/src/portals/fleet/FleetPortal.tsx
apps/nirvana/src/lib/freeworld-sites.ts                      mirror
NIRVANA-SHELL.md, NIRVANA-RENDER-AAA.md, apps/nirvana/AGENTS.md
```

---

## 5b. Kanonická podoba — studie 02 (1. 11., později téhož dne)

Operátor dodal **kanonickou studii 02** (`heros/habuk/Nabukano_ Three-Berth Docking Study.png`) a beauty shot (`Nabukano’s Three-Ship Docking Cradle.png`). Oprava proti studii 01:

- **Dok není prstenec kolem trupu, ale rám pod ním se třemi kotvišti** — tři Marie přisedají zespodu.
- **Osm sekcí má nový obsah:** 01 můstek · 02 knihovna a jídelna · 03 zahrada · 04 ordinace · 05 izolační kajuta · 06 dokovací rám · 07 **lucerna** (skutečná lucerna na konci rámu) · 08 technické zázemí.
- **Volací znaky LUMI / ISSOBELLA / TŘETÍ MARIE ze studie 01 se ruší** — kanonická jsou mariánská jména; badge na webu nesou orbity (blízká orbita / Země ↔ Měsíc / daleký horizont).
- **3D `SkyFleet` překreslen:** hřeben + rotující obytný prstenec + rám se třemi kotvišti a lucernou na konci; tři rozdílné siluety (průzkumný / transport s gondolami / nákladní).
- Kniha kap. 3 přepsaná na studii 02 (tabulka sekcí, tři lodě, „čtyři trupy, jeden dok, jedna osa").

## 5c. N2 — detail modelu (hotovo)

- Okna **obytného prstence** (32/20 podle tieru) i **obytné přídě** (2 pásy × 10/6) instancovaná → jeden draw call na pás.
- **Příhradovina rámu** (14/8 diagonal) + 4 svislé vzpěry + tři kotviště, vše instancované.
- **Prosklená zahrada** (03) jako půlválcový pás, solární křídla a radiátory, dvě nádrže.
- **Lucerna** má klec: čtyři sloupky + wireframe + menší záře, ať nespolkne zadní lodě.
- **Kamera fokusu sleduje obíhající flotilu** — bez toho loď odplouvala ze záběru 0,34 jednotky/s (cíl se hýbal, kamera ne).
- **Měřeno** (`?sceneAudit=1`, swiftshader, 1000×700): **122 draw calls / 80 376 tris / 37 textur / 0 invalid vertices** (před N2: 117–121 / 59–72 k).
- Deploy nirvana `nabukano-n2-20261101T150748Z`; lokální screenshoty `fleet-n2c/d` (ring s okny, rám se třemi loděmi, lucerna, Mars na obzoru).

**Past pro měření:** `?sceneAudit=1` **nepřežije** hash-sync — `Shell` přepíše URL na `#portal=fleet` a query zmizí, takže audit v `UniverseAudit` skončí `null`. Měřit na holém `/?sceneAudit=1` (flotila je ve scéně i tam), nebo audit číst v prvním renderu.

## 5d. N3 — Měsíc a trasa k Matrixu (hotovo)

- `positions.ts` má **`moonPosition(t)`** (jeden vzorec pro scénu, fokus i trasu); Měsíc obíhá Zemi na **24 R**, tedy **dál než flotila (15,5 R)** — flotila je „mezi Zemí a Měsícem", jak říká kniha.
- `Moon` v `NewEarth` už neposílá `window.open` na prezentaci: **klik = portál `matrix`** (nový slot `moon`) + fokus `'moon'`. Okno `MatrixPortal` shrne Shackleton (89,9° S, led ve stínu, tři habitaty + skleník), přizná, že základna neexistuje, a nabídne `/present/matrix` a uzly L6.
- **Třetí leg trasy:** `FleetLeg = 'lumi' | 'issobella' | 'matrix'` — `matrix` je jediný leg vedoucí **z doku ven**: oblouk z flotily k Měsíci, světlo dojde za 6 s. Okno flotily má třetí tlačítko „K Měsíci (Matrix)".
- Popisek Měsíce zmenšen (0,85 → 0,42), aby zblízka nepřerůstal planetu.
- **Ověřeno lokálně:** deep-link `#portal=matrix` otevře okno a doletí k Měsíci (screenshot `moon-focus.png`), tlačítko „K Měsíci" vykreslí oblouk z doku (`moon-route.png`), 0 chyb.
- Deploy nirvana `nabukano-n3-20261101T153715Z` (první pokus spadl na `rsync code 24` — souběžná session smazala `.next/standalone-flat-*` uprostřed přenosu; druhý pokus prošel).

## 5e. N4 — prezentace a webový náhled (hotovo)

- **Jeden zdroj geometrie:** `apps/shared/scenes/kit/vessels.tsx` exportuje `NabukanoModel` (+ `SkyMaria`, `SISTERS`). Hlavní scéna vesmíru (`SkyFleet`) i prezentace i webový náhled kreslí tentýž model — dřív by vznikla třetí kopie trupu.
- **Sdílená scéna** `apps/shared/scenes/NebeskaFlotila.tsx`: Země jako obrovský oblouk (střed −112, r 104 — z orbity je vidět jen lem), prach z 220 částic, `ScenePresentation` s noční atmosférou a `post` bloom. Exportuje `NEBESKA_CAMERA`, `NEBESKA_CONTROLS`, `NebeskaFlotilaScene`, `NebeskaFlotilaLighting`.
- **Nirvana:** `/present/nebeska-flotila` přes `ProjectPresentation` (ambience `space`); okno flotily má nové CTA **„Prohlédnout flotilu"**. Mirror `freeworld-sites` dostal `present: '/present/nebeska-flotila'`.
- **Web 2.9:** `NebeskaFlotilaPreview` + `NebeskaFlotilaPreviewLazy` a nová sekce **„3D model"** na `/terranova/nabukano` (stejná scéna, OrbitControls, lazy canvas, WebGL fallback).
- **Naměřeno** (`?sceneAudit=1`): 55 draw calls / 21 884 tris / 12 textur / `budgetOk: true` / 0 invalid vertices.
- **Deploy:** web `nabukano-n4-20261101T160108Z`, nirvana `nabukano-n4-nir-20261101T160405Z`. Live: web 200 + sekce v HTML, nirvana `/present/nebeska-flotila` **307** bez ZAP pasu (správně).

## 6. Kolize s paralelními session (pro budoucí čtenáře)

- **Kánon byl swept do cizího commitu:** `git add canon/…` jsem měl staged, ale souběžná session pustila `git add -A` a svazek odjel v `627713dfd` s názvem „fix(3d audit)…". Obsah je v pořádku, jen pod zavádějícím popisem. Historie se nepřepisovala.
- **Během práce se HEAD posunul několikrát** (Hiran curriculum, `zion-nirvana-net` M0–M2b, K1.2 workspace, React 19). Deploy webu proto proběhl dřív, než byla migrace lockfilu usazená; po ní už build prochází.
- **Pravidlo pro příště:** před `git add` zkontrolovat `git status` a přidávat **konkrétní cesty**, nikdy `-A`; před deployem zkontrolovat, že cizí session nemá rozpracované změny v `apps/website-v2.9` / `apps/nirvana`.
