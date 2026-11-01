# NABUKANO — Nebeská flotila (L6) · plán

> **Verze:** 1.0 · **Datum:** 2026-11-01 · **Vrstva:** L6 (pohyblivý uzel nebe)
> **Role:** jediný plánovací vstup pro Nebeskou flotilu. Není to druhý projektový strom — cituje knihu ([`canon/books/Nabukano/`](../../canon/books/Nabukano/00-README.md)), report ([`REPORTS/REPORT_2026-11-01_NABUKANO_SKY_FLEET.md`](./REPORTS/REPORT_2026-11-01_NABUKANO_SKY_FLEET.md)) a stávající plány v3.3, neduplikuje je.
> **Značky vlastníka:** 🤖 autonomní (kód, testy, docs) · 🔀 autonomní příprava + operátorské schválení · 👤 operátor (rozhodnutí, peníze, klíče)

---

## 0. Jak číst

1. **§1** je ověřený stav — co reálně existuje v repu a na produkci k 1. 11. 2026.
2. **§2** je rozhodovací fronta 👤. Dokud není rozhodnuto, fáze, které na tom závisí, stojí.
3. **§3** jsou fáze N0–N6 s branami. Pořadí není kosmetika: N1 je nasazení hotového, N2 je model, N3 obloha.
4. **§4** rozpočty a testy — bez nich se fáze nezavírá.
5. **§5** je to, co plán **nedělá**.

---

## 1. Ověřený stav (2026-11-01)

### 1.1 Co existuje

| Prvek | Stav | Kde |
|---|---|---|
| Kniha **Nabukano** (8 souborů, 7 kapitol) | **DRAFT / MÝTUS** | `canon/books/Nabukano/` |
| Čtečka na webu | **ŽIVÉ** | `/zion-archive/nabukano/cist` (za ZAP pasem) |
| Stránka uzlu | **ŽIVÉ** | `/terranova/nabukano` |
| Uzel v L6 | **ŽIVÉ** | sekce „Uzly L6" na `/l6-issobella`, navigace → Vrstvy → L6, footer |
| Hero + konceptová deska | **ŽIVÉ** | `public/images/nabukano/{hero,concept-board}*.webp` |
| Data uzlu | **ŽIVÉ** | `freeworld-sites.ts` → `body: 'orbit'` (+ mirror v Nirvaně) |
| Scéna flotily v Nirvaně | **COMMITNUTÁ, NENASZENÁ** | `universe/SkyFleet.tsx`, portál `fleet`, fokus `'fleet'` |
| Trasy LUMI / prstenec | **COMMITNUTÉ, NENASZENÉ** | `FleetRoute` v `SkyFleet.tsx` |
| Registr `nabukano` | **NÁVRH** (`vision`, 0 ZION, neregistrováno) | 👤 |
| Kánonizace knihy (třída E) | **NEPROBĚHLA** | 👤 |

### 1.2 Co neexistuje

Žádný trup, dok, výtah, modul, posádka, raketa, termín, fond ani podíl. **3D model neodpovídá konceptové desce** — rotující prstenec, dokovací uzel a osm sekcí v geometrii nejsou. Měsíc (Matrix) není ve scéně jako objekt, takže trasa k němu neexistuje.

---

## 2. Rozhodovací fronta 👤

| # | Otázka | Varianty | Dopad |
|---|---|---|---|
| **D1** | **Jména trupů** | (a) mariánská jména + volací znaky *(současný stav)* · (b) volací znaky LUMI / ISSOBELLA / TŘETÍ MARIE jako hlavní jména v knize | ovlivní kap. 3, web, scénu i všechny budoucí texty |
| **D2** | **Registr `nabukano`** | (a) zapsat jako `vision`, alokace 0 · (b) nezapisovat, dokud není studie | registr = veřejný seznam; zápis je 👤 |
| **D3** | **Nebeská archa** | (a) žádná — Nebuchadnezzar je mateřská loď, archa zůstává na vodě · (b) flotila dostane vlastní „archu nebe" | kánon, jinak by vznikla druhá archa |
| **D4** | **Deploy Nirvany** | (a) nasadit teď · (b) počkat na dokončení cizí migrace | CTA „Otevřít ve vesmíru" funguje až po (a) |

---

## 3. Fáze

### N0 — Kánon, web, scéna ✅ (hotovo 1. 11.)

Kniha, čtečka, stránka uzlu, uzel v L6, navigace, hero, deska, scéna flotily a trasy v kódu.
**Brána:** splněna — live 200, `tsc` čistý, build OK, 0 chyb v konzoli (viz report).

---

### N1 — Nasazení Nirvany 🔀 · ~15 min · **nejmenší krok k viditelnému výsledku**

| Úkol | Co |
|---|---|
| N1.1 | `ZION_DEPLOY_RELEASE=nabukano-n1-… bash apps/nirvana/deploy/deploy-nirvana.sh` (strom čistý, žádná cizí session v `apps/nirvana`) |
| N1.2 | Live ověření: `/` 200, `#portal=fleet` otevře okno **Flotila**, tlačítka tras vykreslí oblouk, 0 chyb v konzoli |
| N1.3 | Rollback držen: `/opt/zion/APP&WEB/nirvana/.before-<release>` |

**Brána:** flotila je vidět na `nirvana.zionterranova.com`, okno i trasy fungují, konzole čistá.

---

### N2 — 3D model podle konceptové desky 🤖 · 1–2 dny

Cíl: scéna má číst jako **studie 01**, ne jako symbol.

| Úkol | Co | Poznámka |
|---|---|---|
| N2.1 | Rotující prstenec (03) jako skutečný torus s okny a zelení, plynulá rotace | reuse `kit/` materiály; instancing oken |
| N2.2 | Dokovací uzel (04) + tři trupy **přisedající** k rámu (ne „viset poblíž") | pozice z `fleetPosition()` |
| N2.3 | Osm sekcí jako čitelné bloky: 01 můstek, 02 obytné moduly, 05 laboratoře, 06 nádrže, 07 radiátory, 08 pohon | mapování 1:1 na legendu na webu |
| N2.4 | Tři čluny podle desky: LUMI (průzkumný), ISSOBELLA (lunární transport), TŘETÍ MARIE (nákladní) | rozdílné DMG-free siluety, ne kopie |
| N2.5 | LOD: `low` varianta pro mobil (méně segmentů, bez detailů) | `quality().tier` |

**Brána:** `?sceneAudit=1` → **≤ +60 draw calls** proti stavu N1.3, **≤ 110 k tris**, **0 nových textur** (popisky jen nutné), ≥30 fps Tier B na GPU, 0 invalid vertices; srovnávací screenshot s deskou.

---

### N3 — Obloha: Měsíc a trasa k Matrixu 🤖 · 1 den

| Úkol | Co |
|---|---|
| N3.1 | `universe/Moon.tsx` — malý objekt na cislunární dráze, marker Shackleton (lat −89,9 / lon 0), label „Matrix" |
| N3.2 | `planets.ts`(nyní `positions.ts`) — `moonPosition()` jedním vzorcem pro scénu i fokus |
| N3.3 | `focus: 'moon'` + `FleetLeg = 'lumi' \| 'issobella' \| 'matrix'`; oblouk z doku k Měsíci |
| N3.4 | Okno flotily: třetí tlačítko trasy + honest label |

**Brána:** přelet na Měsíc tam/zpět bez smyčky, reduced-motion = statický stav, mobil OK.

---

### N4 — Prezentace `/present/nebeska-flotila` 🤖 · 1 den

| Úkol | Co |
|---|---|
| N4.1 | `apps/shared/scenes/kit/vessels.ts` — vytáhnout trupy z `MariaDelCamino.tsx` + `KralovstviSrdce.tsx` (jeden zdroj pro moře i nebe) |
| N4.2 | `apps/shared/scenes/NebeskaFlotila.tsx` — kompozice pro prezentaci (kamera, `CONTROLS`, `lang`) |
| N4.3 | Wrapper `apps/nirvana/src/app/present/nebeska-flotila/page.tsx` + thin re-export |
| N4.4 | Web: `NebeskaFlotilaPreview` + `Lazy`, sekce na `/terranova/nabukano` |

**Brána:** textury pod stropem 32 (každý `SceneLabel` = CanvasTexture), `budgetOk`, mobil, CS/EN, 0 chyb.

---

### N5 — Registr a kánonizace 🔀→👤 · hodiny

| Úkol | Kdo |
|---|---|
| N5.1 | `POST /api/v1/projects` → `nabukano`, status `vision`, alokace 0, odkaz na knihu | 🤖 příprava, 👤 odeslání |
| N5.2 | Kánonizace knihy třídou E podle `MiseAmenti/08` (review, ne přepis) | 👤 |
| N5.3 | Doplnit `StatusV3.md` / `AGENTS.md` řádkem o uzlu (bez čísel, která nejsou doložená) | 🤖 |

**Brána:** registr odpovídá na dotaz, dokumenty se nerozcházejí s knihou.

---

### N6 — Obsah a rozšíření 👤 · průběžně

- **Hero série:** další obrazy z `heros/Issobela/` (stanice, Kostarika, observatoř) → galerie na stránce.
- **Kapitola 8** knihy: kajuty, směny, jídlo, „rozpis těla" na doku — až bude D1 rozhodnuto.
- **VR:** flotila je klikatelná (raycast), okna v VR vidět nejsou (omezení shellu) — rozhodnout, zda to řešit.

---

## 4. Rozpočty a testy

| Metrika | Strop | Kde se měří |
|---|---|---|
| Draw calls (universe) | ≤ 180 (dnes 117–125) | `?sceneAudit=1` → `window.__projectScene` |
| Trojúhelníky | ≤ 110 k (dnes ~72 k) | tamtéž |
| Textury | 0 nových v N2 (popisky výjimkou) | tamtéž |
| FPS | ≥ 30 Tier B na GPU | jen na GPU — swiftshader nemá vypovídací hodnotu |
| `invalidVertices` | 0 | tamtéž |
| Web | `tsc --noEmit` + `next build --webpack` + live 200 | `deploy-web2.9.sh` smoke |
| Nirvana | `tsc --noEmit` + `next build` + okno/fokus/trasa | `deploy-nirvana.sh` + headless |

**Pravidla, která se nesmí porušit:**
- pozice flotily jen z `fleetPosition()` (scéna i fokus stejný vzorec),
- `SLOT_COLOR` na **dvou** místech (`Shell.tsx` + `HoloConsole.tsx`),
- nový `focus` znamená tři místa v `Shell.tsx` + typy v `SceneRoot`/`Universe`,
- shared scény jen `@genesis/runtime` + `three` (žádné `drei`),
- žádná animace bez `motionTime`/`motionDelta` (reduced motion).

---

## 5. Co tento plán nedělá

- **Nedělá z flotily pozemský uzel.** 12 pinů + archa + Měsíc zůstávají; flotila je osa, ne pin.
- **Neprodává nic.** Žádný token, podíl, výnos ani „vstupenka".
- **Neslibuje hardware.** Žádný trup, termín, cena nebo posádka; v UI slovo „koncept".
- **Nepřepisuje kánon** knih Issobella / Lumi / Království srdce — jen na ně navazuje.
- **Nezasahuje do cizích session.** Deploy jen při čistém stromu v dané appce.

---

## 6. Změnový log

| Datum | Změna |
|---|---|
| 2026-11-01 | v1.0 — vytvořeno po dodání kánonu, webu, scény, tras, hero a konceptové desky. Otevřené D1–D4. |
