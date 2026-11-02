# Oasis Render

> **1. 11. 2026.** Podrobný plán renderu pro herní klient OASIS (`apps/OasisWeb`).
> Pravidla jsou v [`OASIS-RENDER-CANON.md`](OASIS-RENDER-CANON.md), tohle je konkrétní
> práce: co je hotové, co je rozbité, v jakém pořadí to opravit a jak to měřit.
>
> **Pokračuje se na GPU stroji.** Sekce §7 je handoff — co spustit, co změřit, co commitovat.

## 1. Rozsah

| Co | Kde | Poznámka |
| --- | --- | --- |
| Herní klient | `apps/OasisWeb` | Next 16, **statický export** (`output: 'export'`, `dist/`), nasazuje se do `/var/www/oasis/` |
| 3D plátno | `src/components/OasisScene.tsx` | R3F + `@react-three/postprocessing`, volitelná WebGPU cesta |
| Galaxie | `Galaxy.tsx`, `GalaxyCore.tsx`, `GalaxyMap.tsx`, `TreeOfLife.tsx`, `Nebula.tsx`, `DistantGalaxies.tsx`, `Hyperlanes.tsx` | 410 světů, 6 vrstev |
| Svět | `Planet.tsx`, `WorldEnvironment.tsx`, `Zone.tsx`, `MatrixCore.tsx` | detail po výběru světa |
| Lodě | `app/(game)/ships/Scene.tsx`, `StarFighterModels.tsx`, `PilgrimShip.tsx` | samostatný povrch |
| Intro | `BabylonIntro.tsx`, `OasisClient.tsx`, `WarpIntro` | Babylon 9 + fáze `intro → stargate → arrival → rite → scene` |
| Kit | `apps/shared/scenes/kit/*` | stejný zdroj jako Nirvana |

Mimo rozsah: herní logika (`store/gameStore.ts`), API (`lib/api.ts`), ekonomika, ZAP pas,
obsah 410 světů (`domain/config/worlds.ts`).

## 2. Jak to dnes běží

```
OasisClient (fáze)
  └─ OasisScene
       ├─ Canvas (dpr z quality(), antialias:false, alpha:false)
       │    ├─ světla: ambient + 3 point (scéna) + zbytek v komponentách → 11 ve framu
       │    ├─ SceneEnvironment (kit IBL, dome=false) — dřív drei Environment z CDN
       │    ├─ Galaxy / TreeOfLife / Nebula / GalaxyMap / Hyperlanes / Planety
       │    └─ EffectComposer (WebGL2): Bloom 0.38/thr 0.72, Vignette, HueSaturation, BrightnessContrast
       └─ HUD (DOM): onboarding, ship status, navigace, panely
```

Měření: `?sceneAudit=1` → `window.__oasisAudit`; `?skipIntro=1` → rovnou `scene` (bez Babylona).

## 3. Naměřený stav (M1, ANGLE Metal, 1440×900, dev server)

| Povrch | DPR | Draw calls | Trojúhelníky | Textury | Světla | FPS |
| --- | --- | --- | --- | --- | --- | --- |
| Galaxie (`/`) | 1 | 129 | 275 207 | 49 | 11 | 23,8 (rAF 29) |
| Galaxie (`/`) | **1,75** (dsf 2) | 128 | 275 205 | 49 | 11 | 22,1 (rAF 27) |
| Lodě (`/ships`) | — | — | — | — | — | **neměřeno** (vlastní `Scene`, bez audit háčku) |

Z toho plyne: **DPR 1,75 stojí ~7 % fps** — vyplatí se zapnout (dnes je strop 1).
Draw calls a trojúhelníky jsou v normě; **fps drží dole světla, post a dev režim**.

## 4. Co je hotové (commity `8bd78559d` + tento)

- **O0 — měření.** `?sceneAudit=1` publikuje fps / draw calls / trojúhelníky / textury /
  světla / tier / dpr. `?skipIntro=1` preskočí Babylon i rite. V auditu se vypíná
  `renderer.info.autoReset`, jinak composer hlásí jen svůj poslední full-screen pass.
  Nový skript [`scripts/ops/audit-oasis.mjs`](../../scripts/ops/audit-oasis.mjs) — Playwright
  z repa, volby `--url --route --output --dsf --gpu`, zapisuje `results.json` + `shot.png`.
- **O1 — kit v OasisWeb.** `src/lib/genesis-runtime.ts` + `tsconfig` path, DPR z `quality()`.
- **O2 — světlo a IBL.** drei `Environment preset="night"` (stahoval HDRI z CDN) nahrazen
  `SceneEnvironment` z kitu s `dome={false}`; **světla 21 → 11** (každá planeta měla vlastní
  point + ambient, nahrazeno emisí a klíčovým světlem scény); bloom 0,62/0,35 → 0,38/0,72.
- **Koruna Stromu života.** Neonová paleta (0,92 aditivně) → zelená–zlato–zem, 0,34,
  jeden list na větev.

## 5. Dluh, který zbývá (a proč to vypadá, jak to vypadá)

1. **Mřížka wireframe obrysů v koruně.** V galaxii je `LineSegments` s **25 300 vrcholy**
   (leaf outlines ze `TreeOfLife`) a další obrysy, které se čtou jako rozsypané kostky.
   Listy jsou zklidněné, ale je potřeba rozhodnout: jemné výplně (trojúhelníky) místo
   obrysů, nebo obrysy jen u nejbližších uzlů. **Toto je největší vizuální dluh.**
2. **Koruna nemá objem.** Strom je tmavá konstrukce + obrysy; chybí mu měkká hmota
   (translucentní vrstvy, šum) a světelné rozptylování.
3. **Planety jsou ploché.** `Planet.tsx` má `meshPhysicalMaterial` s `emissiveIntensity 0.35`
   a procedurální texturou; chybí PBR (roughness mapa), atmosféra jako Fresnel (jako
   `Atmosphere` v Nirvaně) a mraky.
4. **`WorldEnvironment` není z kitu.** Vlastní terén/voda/obloha — kandidát na
   `SceneTerrain`/`SceneWater`/`SceneEnvironment`, aby světy vypadaly jako L5 scény.
5. **Lodě a MatrixCore** mají vlastní materiály; sjednotit kov/sklo/emisi.
6. **Intro.** Babylon stargate a Brána v Nirvaně jsou dva různé obrazy; sjednotit
   (stejné textury `stargate/1.png` + `2.png`, stejný rytmus).
7. **HUD a bloom.** Panelů je hodně a překrývají scénu; bloom práh je lepší, ale HUD prvky
   s `toneMapped` je potřeba zkontrolovat.
8. **Mobil.** Tier C není změřený; `isMobile` větve vypínají IBL i část scény.
9. **Žádná brána v CI.** Chybí `--strict-budget` obdoba jako u scén a commitnutý rozpočet.
10. **Deploy smyčka.** `deploy-oasis-web.sh` existuje, ale není v programu.

## 6. Vlny

| Vlna | Obsah | Soubory | Brána |
| --- | --- | --- | --- |
| **O3** Koruna a galaxie | nahradit leaf outlines výplněmi nebo je vázat na vzdálenost; přidat objem koruny (2–3 translucentní vrstvy s šumem); hvězdné vrstvy s parallaxou; mlhoviny jako aditivní sprity | `TreeOfLife.tsx`, `Nebula.tsx`, `Galaxy.tsx`, `GalaxyCore.tsx`, `DistantGalaxies.tsx` | galaxie ≥ 55 fps @ DPR 1,75, žádná „kostková" koruna |
| **O4** Planety a světy | PBR + Fresnel atmosféra + mraky pro `Planet`; `WorldEnvironment` na `SceneTerrain`/`SceneWater`/`SceneEnvironment` z kitu | `Planet.tsx`, `WorldEnvironment.tsx`, `Zone.tsx` | svět v rozpočtu, vizuálně stejná rodina jako L5 scény |
| **O5** Lodě a Matrix | kov/sklo/emise z kitu, konzistentní osvětlení, LOD pro flotilu | `StarFighterModels.tsx`, `PilgrimShip.tsx`, `ships/Scene.tsx`, `MatrixCore.tsx` | `/ships` změřené a v rozpočtu |
| **O6** Intro a přechody | stejný obraz brány jako v Nirvaně, plynulé předání Babylon → R3F, loading s progresem | `BabylonIntro.tsx`, `OasisClient.tsx` | bez bílého bliknutí, intro < 6 s |
| **O7** Mobil | tier C (DPR 1, světla ≤ 3, post off), dotykové ovládání, reduced-motion | `OasisScene.tsx`, `MobileTouchControls.tsx` | ≥ 30 fps na 390×844 |
| **O8** Brána a deploy | `--strict-budget` v auditu, commitnutý `docs/3.2/oasis-render-budget.json`, deploy + rollback | `scripts/ops/audit-oasis.mjs`, `apps/OasisWeb/deploy/` | 5 povrchů PASS, report |

## 7. Handoff na GPU stroj

### 7.1 Co je potřeba

- Node 20+, Chrome (Playwright používá `channel: 'chrome'`), `npm ci` v `apps/OasisWeb`
  a `apps/website-v2.9` (odtud se bere Playwright).
- macOS: `--gpu metal` (default). Linux + NVIDIA: `--gpu vulkan`. Linux + AMD: `--gpu gl-egl`.
- Pokud Playwright není v `apps/website-v2.9/node_modules`, nastav `ZION_PLAYWRIGHT`
  na cestu k modulu.

### 7.2 Spuštění a měření

```bash
cd apps/OasisWeb && PORT=3070 HOSTNAME=127.0.0.1 npm run dev   # nebo: npx serve dist -l 3070

# baseline galaxie
node scripts/ops/audit-oasis.mjs --url http://127.0.0.1:3070 --output .artifacts/oasis/galaxy
# Retina (ověří, že DPR 1,75 se opravdu použije)
node scripts/ops/audit-oasis.mjs --url http://127.0.0.1:3070 --dsf 2 --output .artifacts/oasis/retina
# jiný povrch
node scripts/ops/audit-oasis.mjs --url http://127.0.0.1:3070 --route /ships --output .artifacts/oasis/ships
```

`results.json` má tvar:

```json
{ "route": "/", "dsf": 1, "gpu": "metal", "status": "pass",
  "audit": { "fps": 23.8, "calls": 129, "triangles": 275207, "textures": 49,
             "lights": 11, "dpr": 1, "tier": "A" },
  "fps_measured": 29, "errors": [] }
```

### 7.3 První úkoly na GPU stroji (v tomto pořadí)

1. **Změř baseline** na cílovém GPU (galaxie, Retina, `/ships` až po O5). Zapiš do §3.
2. **O3 — koruna.** Najdi zdroj zbývajících obrysů:
   ```js
   // v prohlížeči na ?sceneAudit=1&skipIntro=1
   __oasisScene.traverse(o => {
     const n = o.geometry?.attributes?.position?.count || 0;
     if (n > 2000) console.log(o.type, n, o.parent?.type, o.material?.type);
   });
   ```
   Pak rozhodni: výplně místo obrysů (trojúhelníky, `side: DoubleSide`, `transparent`),
   nebo obrysy jen v okruhu N jednotek od kamery.
3. **O3 — objem koruny.** 2–3 translucentní vrstvy (icosahedron s `MeshStandardMaterial`,
   `opacity 0.06–0.12`, `depthWrite:false`) + šumová textura z kitu (`foliage`).
4. **O4 — planety.** Vzor je `Atmosphere` v `apps/nirvana/src/core/scene/universe/NewEarth.tsx`.
5. Po každé změně: `npx tsc --noEmit` v `apps/OasisWeb`, audit, screenshot do
   `.artifacts/oasis/<krok>/`, a commit s číslem před/po.

### 7.4 Brány, které je potřeba dodržet

| Metrika | Tier A | Tier B | Tier C |
| --- | --- | --- | --- |
| FPS (1440×900 / 390×844) | ≥ 55 | ≥ 45 | ≥ 30 |
| DPR cap | 1,75 | 1,25 | 1,0 |
| Draw calls | ≤ 220 | ≤ 220 | ≤ 140 |
| Trojúhelníky | ≤ 400 k | ≤ 350 k | ≤ 200 k |
| Světla | ≤ 6 | ≤ 6 | ≤ 3 |
| Textury | ≤ 40 | ≤ 40 | ≤ 24 |
| Chyby shader/console | 0 | 0 | 0 |

Dnešní stav je 11 světel a 49 textur — obojí nad plánem; galaxie má 129 calls / 275 k tris,
takže tam je rezerva.

## 8. Rizika

| Riziko | Mitigace |
| --- | --- |
| three 0.169 v OasisWeb vs 0.186 v Nirvaně | kit nesmí importovat `three/addons`; composer je vlastní |
| WebGPU cesta má vlastní post a vlastní chyby | audit měří WebGL2; WebGPU je opt-in a v tier C vypnuté |
| Statický export = žádný server pro audit | měří se proti `next dev` nebo `serve dist` |
| Souběžná práce jiné session v `apps/OasisWeb` | malé commity, vždy `tsc` + audit; cizí WIP necommitovat |
| `@react-three/postprocessing` v 0.169 | ověřeno, že běží; při upgradu three zkontrolovat verzi balíčku |

## 9. Odkazy

- [`OASIS-RENDER-CANON.md`](OASIS-RENDER-CANON.md) — pravidla (vrstvy, anti-patterns, rozpočty, deploy).
- [`scripts/ops/audit-oasis.mjs`](../../scripts/ops/audit-oasis.mjs) — měření.
- `apps/nirvana` — referenční implementace (`ProjectPresentation`, `ScenePresentation`, kit).
- [`NIRVANA-RENDER-AAA.md`](NIRVANA-RENDER-AAA.md) — jak vypadal stejný program u scén.

## 10. Změnový log

| Datum | Změna |
| --- | --- |
| 2026-11-01 | Dokument vzniká jako jediný plán OASIS renderu (absorbuje `OASIS-GAME-RENDER-PLAN.md`). O0 hotové, O1/O2 první řez: audit háček + `audit-oasis.mjs`, kit quality/IBL, světla 21 → 11, bloom retune, koruna zklidněná. Baseline: 129 calls / 275 k tris / 49 textur / 11 světel / 23,8 fps @ DPR 1; 22,1 fps @ DPR 1,75. |
