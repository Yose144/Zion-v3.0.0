# Avatar roster na web2.9 — veřejné texty česky a anglicky

**Datum:** 2026-11-04 · **Kde:** `apps/website-v2.9` (`/l4-oasis/avatars`) ·
**Stav:** nasazeno, 200/200 záznamů má cs+en text.

## 1. Zadání

„Komplexně opravit avatary na web2.9 — upravit texty. Najdeš je v
`docs/docs2.9/ZION_OASIS`. Potřebujeme souvislé, přímo pro veřejnost, v cs/en."

## 2. Co bylo špatně (měřeno, ne odhad)

| Problém | Počet |
|---|---|
| chybí `location`, `questLine` i `teaching` | **110 / 200** |
| žádné questy | **150 / 200** |
| `role` polepené markdownem (`· **Quest:** … · **CL:** 4–8 · **NFT:** …`) | **118 / 200** |
| `ability` s vmeteným `CL:`/`NFT:` | **200 / 200** |
| prázdné `clName` | **148 / 200** |
| essence ve formě datového výpisu („Jméno: … Titul: … Role: …") | **31 / 200** |
| texty mimo `essence` jen anglicky | **200 / 200** |

Stránka navíc zobrazovala jen angličtinu i v českém režimu (jen `essence`
byla dvojjazyčná), takže polovina modalu byla prázdná a druhá polovina
anglicky.

## 3. Řešení

**Jedno místo pravdy pro veřejné texty:** `apps/website-v2.9/scripts/oasis-avatar-copy/`
— jeden JSON per kruh (`hindu.json`, `pacific.json`, …), klíč = `id` avatara,
každé pole `{ "cs": "...", "en": "..." }`. Overlay **přebíjí** legacy data
z `V31/L4/oasis/data/avatars.json`; co v overlayi chybí, spadne na očištěný
legacy text (jen EN), takže se do stránky nikdy nedostane markdown ani
prázdný blok.

**Generátor** `scripts/gen-oasis-avatars.mjs`:
- načte overlaye (abecedně, per-id merge),
- `cleanLegacy()` odstraní `**`, meta ocásky (`· Quest: …`) a uříznutá slova,
- **žebřík CL 1–9** doplní chybějící `clName` (čtyři jména jsou z kánonu,
  první tři doplněny: Tělo a dech / Emoce / Mysl),
- emituje `LocalizedText { cs, en }` pro `subtitle`, `clName`, `role`,
  `location`, `questLine`, `teaching`, `ability`, `quote`,
- questy prožene `mdInline()` a zahodí prázdné (UI je pak skryje),
- essence bere z overlaye, jinak z `scripts/oasis-essence-i18n.json`.

**Stránka** `src/app/l4-oasis/avatars/page.tsx`: helper `tx(pole, cs)`
(`cs → en → ''`) na kartě, v modalu i ve fulltextu. Prázdné hodnoty se
nezobrazují (role/location/key/questLine se filtrují, ability/teaching
mají podmínku).

**Opravené texty stránky:** tagline už neslibuje „quest linii u každé
postavy" (150 jich nemá) a popis nemluví o „patnácti" kruzích, ale
o „šestnácti dalších" (kruhů je 23 včetně sedmi základních).

## 4. Co je hotové

| | |
|---|---|
| Kruhů pokryto | **23 / 23** |
| Avatarů s cs+en | **200 / 200** |
| Autorských polí (cs+en páry) | **1 400** (7 polí × 200) |
| Přepsaných essencí z datového výpisu | **31** |
| `tsc --noEmit` | **0 chyb** |
| Nasazeno | `20261104T093736Z` (app., build `zb1O43jNAA0lT3S2brH1A`) |

Ověřeno živě: `/l4-oasis/avatars` 200, český tagline i autorské texty
(„Ta, která tvoří tím, že spálí") v SSR, anglická větev v client chunku
(`page-975ae798a908ff67.js` — „She who creates by burning"). Ostatní
povrchy (`/`, `/pool`, `/dao`, `/explorer`, `/api/health`) 200.


Rozsah textů: `subtitle`, `role`, `location`, `questLine`, `teaching`,
`ability`, `quote` — vše autorsky, s jednotným hlasem (věcný, klidný,
bez marketingu a bez internalit typu „DAO timelock" / „M1 milestone").

## 5. Meze (poctivě)

- **Questy zůstaly anglicky** (👤 rozhodl „ponechat existující, prázdné
  skrýt"). Mají je 50 avatarů; v českém režimu se zobrazí v původním
  znění. Překlad ~250 titulů a popisů je samostatná dávka.
- **Jména jsou v původním znění** (Krishna-Maitreya, Ọṣun, Þórr…) — to je
  záměr kánonu, needituje se.
- Klíče (`key`) zůstávají jen tam, kde existují (10/200); je to lore
  předmět, ne text pro veřejnost.
- Texty jsou autorské ve smyslu „veřejná prezentace postavy", ne nový
  náboženský nebo historický výklad; u prvních národů, Aotearoa a Afriky
  drží popisnou rovinu a nezavádí obřadní tvrzení.

## 6. Jak přidat nebo změnit text

```bash
# 1) uprav/přidej pole v apps/website-v2.9/scripts/oasis-avatar-copy/<kruh>.json
# 2) přegeneruj
cd apps/website-v2.9 && node scripts/gen-oasis-avatars.mjs
# 3) zkontroluj
npx tsc --noEmit
```

Generátor je idempotentní; `src/lib/oasis/avatars.ts` se **needitue ručně**
(hlavička to říká).

## 7. Incident při buildu (mimo zadání)

Během práce jsem kvůli `@types/react` spustil `npm install`, který
v kombinaci s **paralelní session** (ta mezitím pouštěla vlastní `npm ci`)
nechal `node_modules` v rozbitém stavu — chyběl `next/package.json`,
`typescript/package.json` a nakonec i `react`. Projevy: build padal na
`MODULE_NOT_FOUND: next/package.json`, pak `tsc` na chybějící `@types/node`.

Řešení, které fungovalo: doinstalovat chybějící balíčky **přímo z registry
podle `package-lock.json`** (skript v `/tmp/fix_nm.py`, 227 tarballů),
protože `npm ci` se v tom souběhu nedokončil. Po cizím `npm ci` už byl
strom celý a build prošel.

Pravidlo: když v tomhle repu běží víc session, **nespouštět `npm install`
současně**; build z hotového `.next/standalone` přes
`deploy-web2.9.sh --artifact-dir` obejde build úplně.
