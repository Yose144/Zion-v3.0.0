# Report — Saturn: Kroniky / Archiv kruhů (2026-11-02)

> **Zadání:** „na Saturnu ještě nic není — máš nápad?" → zvoleno
> **Archiv kruhů / Kroniky**.
> **Aplikace:** `apps/nirvana` · **Větev:** main

---

## 1. Koncept

Saturn je jediné těleso s **prstenci** — a prstence jsou **hřbety knih**.
Každý segment = jeden svět (`FREE_WORLD_MISSIONS`, 15 uzlů). Hover = kruh
(stejný `NavHalo` jako ve vesmíru), klik = kapitola s popisem a CTA.
Žádná jména ve 3D — jméno ukáže panel (stejné pravidlo jako v Nirvaně).

Barva hřbetu = stav uzlu:
- **bílá** — `built` (stojí, např. Ekam)
- **cyan** — `preparation` (v přípravě)
- **fialová** — `vision` (vize)

---

## 2. Implementace

| Soubor | Co dělá |
|---|---|
| `src/core/saturn/SaturnArchive.tsx` | 3D scéna: Saturn (koule + prstenec s texturou), 15 hřbetů na prstenci, `NavHalo` na hover/selected, `OrbitControls` |
| `src/app/saturn/page.tsx` | routa `/saturn`: plátno + chrome + panel se seznamem kapitol, detail s CTA |
| `src/app/globals.css` | `.saturn-*` (chrome, panel, seznam, legenda, detail; mobilní bottom-sheet) |
| `planetCatalog.ts` | Saturn dostal `game: 'saturn'` + CTA `kroniky →` |
| `Shell.tsx` | `PLANET_PANELS.saturn` (title/note/href `/saturn`), typy `planet`/`selectPlanet` |
| `SolarSystem`, `SceneRoot`, `Universe` | typy `onSelectPlanet` rozšířeny o `'saturn'` |
| `core/games/links.ts` | Saturn v `GAME_LINKS` (dostane se do `GamesDock` i konzole) |

**Tok:** ve vesmíru najedeš na Saturn → kruh → klik → panel `SATURN` s CTA
„Otevřít kroniky" → `/saturn` s archivem.

---

## 3. Stránka `/saturn`

- Levá strana: **seznam 15 kapitol** (klávesnicí ovladatelný `<button>`),
  barevná tečka = stav, aktivní kapitola zvýrazněná.
- Pravá strana: **detail kapitoly** (`kapitola`, stav, CTA).
- Dole: **legenda** stavů.
- CTA vede na interní `/present/<svět>` (pokud existuje), jinak na
  `app.zionterranova.com/terranova/<path>` v novém tabu.
- 3D scéna: Saturn + prstenec, hřbety pomalu rotují s planetou (0,03 rad/s),
  kamera `[0, 9.5, 17]`, `OrbitControls` s autoRotate.
- Routa je **veřejná** (jako `/park`), není za ZAP pasem.

---

## 4. Ověření

- `npx tsc --noEmit` → **0 chyb**
- `npm run build` → **OK** (`/saturn` v routách)
- `npx tsx apps/nirvana/test/links.mjs` → **PASS 62/62**
  (nově: `saturn` je v registru odkazů)
- Headless Chromium `/saturn`:
  - `canvas = 1`, `kapitol = 15`, titulek `KRONIKY`
  - klik na 4. kapitolu → detail panel + CTA
  - 0 reálných konzolových chyb

---

## 5. Meze

- **VR netestováno** — scéna je R3F, ale headset nemáme.
- **Mobil** jen media query (bottom-sheet), netestováno na telefonu.
- **Kapitoly = L5 uzly** (`FREE_WORLD_MISSIONS`). L4/L6 světy (411 z API) do
  archivu nejsou — bylo by jich moc; patří do `WorldPortal`.
- **Žádná animace „otevření knihy“** — klik jen vybere kapitolu.
- **Saturn ve vesmíru** je teď interaktivní (má `game`), takže přišel o
  tlumené jméno — v souladu s jednotným pravidlem „žádná jména pod odkazy“.

---

*Vytvořeno 2026-11-02.*
