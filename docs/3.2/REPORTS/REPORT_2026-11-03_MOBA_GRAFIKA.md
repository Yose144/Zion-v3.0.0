# Report — MOBA: terén a modely (F11, 2026-11-03)

> **Zadání:** „rozšiřujeme dál, ladíme grafiku, 3D objekty atd., ať to trochu
> vypadá k světu."
> **Kde:** `apps/nirvana/src/core/moba/MobaTerrain.tsx` (nový) + `MobaStage.tsx`
> **Deployed:** app (bez změny protokolu i sim)
> **Screenshoty:** `.artifacts/render/moba-f11*`

---

## 1. Výchozí stav

Mapa byla **rovina s neonovými proužky**: tři zelené pásy, modrý obdélník řeky,
koule místo minionů a kónické věže. Všechno čitelné, ale ne „svět".

## 2. Co F11 přidala

### Terén (`MobaTerrain.tsx`)

- **Tráva** — procedurální textura (256 px, CanvasTexture) s jemnými skvrnami,
  repeat 16×13; žádný velký soubor v repu.
- **Cesty** — tři udusané pásy s kamínky (vlastní textura, repeat 14×1,2)
  a tenkou středovou linkou.
- **Řeka** — voda s metalickým leskem, která „dýchá" (opacity 0,5 ± 0,08),
  a dva kamenné břehy.
- **Základny** — kamenné plošiny (tmavý kámen + týmový prstenec) a **nízké
  sutiny** kolem (0,3 m, dál od středu).
- **Les** — 120 stromů = **2 instanced meshe** (kmeny + koruny), prstenec
  50–66 jednotek za hranou hřiště.
- **Skály** — 34 kusů uvnitř mapy, ale mimo linky, řeku a tábory (jeden
  instanced mesh).
- **Deterministické rozestupy** (vlastní LCG) — scéna je při každém načtení
  stejná, žádný `Math.random()`.

### Modely

| Prvek | Před | Po |
|---|---|---|
| Věž | kónus + krystal | kamenný podstavec, kónické tělo, krystal, týmový prstenec u paty |
| Inhibitor | válec + torus | čtyřboký obelisk + zlatý runový prstenec |
| Nexa | kónus | osmiúhelníková základna + velký krystal (scale 1,35) |
| Boss | krystal | + kamenný kruh šesti balvanů kolem lairů |
| Minioni | koule | broušené kameny (octahedron, flat shading) |
| Monstra | koule | icosahedron (organičtější) |
| Světlo | 2× ambient | hemisphere + teplejší hlavní slunce + doplňkové teal světlo |

## 3. Co odhalil screenshot (a co by kód neukázal)

První render (`moba-f11/start.png`) byl špatný ve třech věcech:

1. **Čtyři vysoké sloupy u základny koukaly do kamery** a zakrývaly hrdinu
   i spodek obrazovky → nahrazeny nízkými sutinami.
2. **Svislé korouhve věží** vypadaly z výšky jako plovoucí obdélníky
   → týmová barva je teď prstenec u paty.
3. **Základnový disk byl skoro černý** (vypadal jako díra) → světlejší kámen.

Po opravě (`moba-f11b/start.png`) je vidět hrdina, cesty, kameny i les.

## 4. Ověření

| Test | Výsledek |
|---|---|
| `npx tsc --noEmit` | čistý |
| `e2e/first-world.mjs` proti produkci (2×) | **16/16**, 0 chyb v konzoli |
| screenshoty | `start.png`, `fight.png`, `victory.png` (před/po) |

## 5. Meze (poctivě)

- **Bez stínů** — `shadows={false}`; stíny by stály výkon a dnešní scéna je
  čitelná i bez nich. Příští krok: kontaktní stíny pod jednotkami.
- **Fog of war není vizuální** — jednotky v mlze se prostě neposílají, hráč
  nevidí „černo".
- **Terén je plochý** — žádné kopce uvnitř hry (sim je 2D); výšky jsou jen
  v lese za hranou.
- **Textury jsou procedurální** (tráva, cesta) — ostré detaily (kámen, mech)
  by chtěly skutečné assety.
- **Stromy jsou dva meshe na celý les** — zblízka jsou to kužely, ne koruny.

## 5b. F12 — GPU render, obloha a stíny

- **`ZION_GPU=metal`** v `e2e/_browser.mjs` (ANGLE/Metal, nový headless) —
  screenshoty a fps na skutečné GPU, CI zůstává na swiftshaderu.
- **`e2e/moba-shots.mjs`** — pět pohledů + fps + draw calls z `gl.info`
  (debug háček vrací `renderer`).
- **Obloha:** inverzní koule s gradientem (teplý obzor), `fog={false}`.
- **Kontaktní stíny:** instanced kruhy pod miniony + kruh pod hrdinou
  (jednotky neplavou nad terénem) — místo shadow map.
- **Ladění po renderu:** boss 1,9 → 1,35, bushe jako tři laloky, řeka
  tmavší (0,45), prstenec uzlu 3,2 → 2,6.

**Naměřeno (M1 Metal, 1600×900):** 60 fps (16,7 ms), **67 draw calls**,
22,8 tis. trojúhelníků, 4 textury, 0 chyb v konzoli.

## 6. Co dál (grafika)

1. **Kontaktní stíny** pod hrdiny a miniony (levné, hodně pomůže čitelnosti).
2. **Animace jednotek** — minioni poskakují, věže pulsují, krystaly rotují.
3. **Vizuální mlha** — tmavý overlay s děrovanou maskou podle `visionSources`.
4. **Zvukový ambient** (vítr, řeka) — `core/moba/audio.ts` je připravený.

---

**Souvisí:** [`MOBA-PRVNI-SVET-PLAN.md`](../3.3/MOBA-PRVNI-SVET-PLAN.md) § 2g ·
`apps/nirvana/AGENTS.md` § PRVNÍ SVĚT — terén a grafika · commity `f9863fb65`,
`d15056ccd`
