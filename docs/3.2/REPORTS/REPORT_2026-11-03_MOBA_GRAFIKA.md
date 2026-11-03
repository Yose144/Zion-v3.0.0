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

## 5c. F13 — animace a vizuální mlha

- **Animace:** minioni poskakují, monstra se otáčejí, krystaly věží/Nex rotují
  a dýchají, runy se vznášejí, wardy pulzují. Všechno z `clock.elapsedTime`
  ve `useFrame` — žádný React state.
- **Vizuální mlha (`MobaFog`):** tmavý plán 240×200 m s průhledovými dírami
  podle zdrojů vidění ze **snapshotu**. Maska je CanvasTexture 256×192,
  překreslovaná 6–7×/s; díry jsou elipsy (plán není čtvercový).
- **Past:** `tmp` (Object3D instancí) je sdílený — smyčky, které nechtějí
  rotaci, ji musí vynulovat, jinak se minioni nakloní podle stínů.

**Naměřeno po mlze (M1 Metal, 1600×900):** 60 fps, **69 draw calls**,
22,9 tis. trojúhelníků, 5 textur, 0 chyb v konzoli.

## 5d. F14 — plovoucí čísla poškození

- **`MobaFxOverlay`**: 2D canvas nad scénou, světové souřadnice se projektují
  kamerou z r3f (`cameraRef` z `MobaStage`). DOM element pro každé číslo by
  zabil výkon.
- **Čísla vznikají rozdílem HP mezi snapshoty** — sim damage eventy neposílá,
  takže tohle funguje v sólu i online bez změny protokolu. Cena: číslo je
  součet za jeden snapshot (15 Hz), ne jednotlivá rána.
- Červená = dostané, zlatá = udělené; strop 40 čísel, rozptyl podle id;
  kdo zmizí v mlze, tomu se stav HP zahodí (jinak naskočí číslo za celou
  dobu v mlze).
- **Nalezená chyba:** `MobaOnline` (wrapper) zahazoval `sellRequest`,
  `buybackRequest`, `talentRequest` → v multiplayeru nešel prodat item,
  buyback ani vybrat talent. Teď se přeposílají.

**Naměřeno:** 60 fps, 65 draw calls, 38,7 tis. trojúhelníků (hrdinové
v záběru), 0 chyb v konzoli.

## 5e. F15 — ikony kouzel

Vektorový glyf **podle slotu** (Q projektil, W štít, E plošný zásah,
R ultimátka) — `Record<SpellSlot, string[]>`, takže nový slot bez ikony
neprojde typovou kontrolou. Barvu bere z kouzla (`stroke`), takže sedí
k postavě i k rámečku slotu.

První pokus měl ikony podle **školy** — jenže všechna čtyři kouzla jednoho
hrdiny mají stejnou školu, takže HUD ukazoval čtyři stejné ikony. Screenshot
to odhalil hned; role slotu je pro hráče důležitější než škola.

Ikony jsou v HUD (`.moba-slot`), na pick screenu (`.moba-spell`) a na
dotykových tlačítkách. `school` se proto musel dostat až do `MobaStats`
(`SpellMeta` i fallback v `earth/page.tsx`).

## 5f. F16 — 3D svět podle Riftu

Podle Riot dev blogu *Defining the Rift's Visual Style* (clarity first,
vizuální hierarchie, „inviting, magic-infused forest"):

- **zdi v džungli** — kamenné hřebeny mezi linkami s průchody (nikdy do linek)
- **doupata kempů** — barevný kruh podle typu + dva balvany
- **jáma bosse** — půlkruh balvanů (dark purple emissive)
- **lucerny podél linek** — teplé světlo, vede hráče po cestě
- **základny** — vyvýšená plošina s fontánou a týmovým prstencem
- **obzor** — prstenec 22 hor za lesem, **jiskry** nad mapou (Points)
- **rákosí** podél břehů řeky

Vše instanced (6 meshů + Points). **Naměřeno:** 60 fps, **73 draw calls**,
44,4 tis. trojúhelníků, 0 chyb. První verze měla zdi z boxů — vypadaly jako
přepravky; po opravě na dodecahedry s mechovým emissivem čtou jako hřeben.

## 5g. F17 — výška, atmosféra zón, animace

- **Kopce** za hranou hřiště (26 instancí) — jediná výška; uvnitř mapy
  zůstává rovina, protože sim je 2D a jednotky stojí na `y = 0`.
- **Mlha** ve čtyřech džunglích (4 velké průhledné pásy, pomalý posun a rotace).
- **Světlušky** (70 bodů) a **padající listí** (46 instancí, pád + houpání).
- **Lucerny** poletují (opacity 0,75 ± 0,2); materiál musel být `transparent`.
- Všechno počítané z `clock.elapsedTime` — žádný React state, žádné re-rendery.

## 5h. F18 — portréty hrdinů

Web už má 200 portrétů vyrenderovaných ze **stejného** avatar modelu, takže
se negeneruje druhá sada: `scripts/ops/gen-moba-portraits.mjs` je zkopíruje
do `apps/nirvana/public/portraits/<id>.webp` (1,8 MB) a zapíše seznam id do
`portraits.generated.ts`. `portraitUrl()` vrací `null` pro chybějící id
(katalog má mezery — 200 souborů na id 0–202), takže UI kreslí iniciálu
místo 404 obrázku.

Portréty jsou v HUD, na pick screenu a ve scoreboardu. **Naměřeno:** 60 fps,
80 draw calls (portréty jsou DOM, ne geometrie).

## 6. Co dál (grafika)

1. **Kontaktní stíny** pod hrdiny a miniony (levné, hodně pomůže čitelnosti).
2. **Animace jednotek** — minioni poskakují, věže pulsují, krystaly rotují.
3. **Vizuální mlha** — tmavý overlay s děrovanou maskou podle `visionSources`.
4. **Zvukový ambient** (vítr, řeka) — `core/moba/audio.ts` je připravený.

---

**Souvisí:** [`MOBA-PRVNI-SVET-PLAN.md`](../3.3/MOBA-PRVNI-SVET-PLAN.md) § 2g ·
`apps/nirvana/AGENTS.md` § PRVNÍ SVĚT — terén a grafika · commity `f9863fb65`,
`d15056ccd`
