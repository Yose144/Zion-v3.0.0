# NIRVANA RENDER — R0 + R1: GPU harness, Render Kit, první art dávka

**31. 10. 2026.** První etapa programu [`NIRVANA-RENDER-AAA.md`](../../3.3/NIRVANA-RENDER-AAA.md).
Nenahrazuje funkční akceptaci z [`REPORT_2026-10-31_PROJECT_SCENE_TUNING.md`](REPORT_2026-10-31_PROJECT_SCENE_TUNING.md) —
ta zůstává platná (24/24 PASS). Tohle je vrstva navrch: výtvarná kvalita a měřený výkon.

## Co je hotové

### R0 — GPU měření na tomto Macu

- `scripts/ops/audit-project-scenes.py` rozšířen:
  - `--gpu metal` → headless Chrome s `--use-angle=metal`. Ověřeno: `ANGLE (Apple, ANGLE Metal Renderer: Apple M1)`.
    Default na macOS je `metal`, takže audity už neběží přes SwiftShader.
  - `--chromium` umí lokální `/Applications/Google Chrome.app` — audity si nestahují playwright browsery.
  - `--shots-only` — hero snímky 1920×1080, 1440×900 a 390×844 se zapnutým `prefers-reduced-motion`
    (stabilní frame bez auto-rotace) + metriky do `results.json`; přidává `&labels=0`, takže art shoty nejsou zacpané popisky.
  - scéna `matrix` je součástí výčtu (Nirvana only).
- Python playwright v `.venv-audit/` (gitignore). Spuštění:
  ```bash
  .venv-audit/bin/python scripts/ops/audit-project-scenes.py \
    --app nirvana --shots-only --nirvana-url http://127.0.0.1:3040 \
    --output .artifacts/render-r1/batch1 --release r1
  ```

### R1 — Render Kit (`apps/shared/scenes/kit/`)

Jeden zdroj pro 13 scén. Importuje **jen `three` a `@genesis/runtime`** — žádné `drei`, žádné
`three/addons`. To je záměr: scény se kompilují do dvou aplikací s vlastní instancí three
(Nirvana 0.186, web 0.169), takže cokoli z addonů by se v jednom z balíčků nerozřešilo.

| Modul | Co dodává |
| --- | --- |
| `quality.ts` | tiery A/B/C z `deviceMemory`, `hardwareConcurrency`, pointeru a `saveData`; DPR, post-fx, stíny, velikost textur. Override `?quality=low\|mid\|high`. |
| `textures.ts` | deterministický value noise + fbm; albedo + normal mapa z jednoho výškového pole. Sady: marble, marbleDark, stone, basalt, sand, grass, regolith, wood, plaster, snow, foliage, ripple. Cache + `dispose`. |
| `materials.ts` | PBR presety (marble white/matte/dark, gold, bronze, glass, stone, basalt, sand, grass, snow, timber, plaster, leaf, water, lamp, terrain). Sdílené instance = méně programů. |
| `environment.tsx` | shader obloha (gradient + slunce + mraky + hvězdy), PMREM IBL z téže oblohy (bez HDR souboru), `FogExp2`, `KeyLight` se stínovou kamerou, `SkyFill`. |
| `post.tsx` | vlastní HDR composer: scéna → MSAA half-float target → bright → 2 úrovně blur → composite (bloom, saturace, vinětace, grain, ACES, sRGB). Žádná závislost na `EffectComposer`. |
| `camera.tsx` | cinematic intro (dolly + rise + yaw → předání OrbitControls), `reducedMotion()`, `?beat`/`?intro=0` obchází pohyb. |
| `terrain.tsx` | `SceneTerrain` (displaced ground s vertex colors), `SceneTrees` (4 draw calls na celý les), `SceneWater` (vlastní scrollující normal mapy). |

`ScenePresentation` je přepsaný: mountuje atmosféru, intro a post, počítá `budgetOk`
a publikuje do `window.__projectScene` navíc `tier`, `dpr` a skutečné scene-only
draw calls (composer jinak čísla maskoval full-screen quady).

### Aplikační vrstva

- `apps/nirvana/src/core/scene/ProjectPresentation.tsx` — jeden wrapper pro všech 12 pozemských
  prezentací: chrome, canvas s DPR z tieru, OrbitControls, soundtrack, loading veil.
  13 duplicitních `page.tsx` (57 řádků každý) nahrazeno ~25 řádky s daty.
- `globals.css` — loading veil, kompaktní soundtrack button na malých obrazovkách, hlavička na 5 sloupců.

### Art dávka 1 (5 scén)

| Scéna | Co se změnilo |
| --- | --- |
| **Ekam** | Mramor s žilkami (albedo + normal), zlacení s IBL odleskem, kamenná základna, displacement louky s vertex colors, instancované stromy (3 vrstvy korun) a lampy, voda s vlnami a tmavým dnem, obloha s mraky, cinematic intro, post. |
| **Amenti** | Pouštní duny (displaced sand), měkký zelený pás údolí místo tvrdého kruhu, moře jako animovaná voda se šelfem, oáza s vodní plochou, soumraková obloha s hvězdami, teplý KeyLight, post. |
| **Uluru** | Červený písek s dunami a světlejším pásem osady, hvězdy jen náznakem, teplé zapadající slunce, post. |
| **Kailash** | Zasněžený terén s rockovým dnem údolí, jezero jako animovaná voda, chladná obloha, mírnější opar, post. |
| **Bodhi Lanka** | Jezero jako animovaná vodní plocha s kruhovým tvarem, travnatý areál s výškovým reliéfem, teplá soumraková obloha, post, snížené počty palem/lilií. |

## Naměřené hodnoty (dev server, ANGLE Metal, Apple M1)

| Scéna | Draw calls před | Draw calls po | Trojúhelníky po | FPS (dev) |
| --- | --- | --- | --- | --- |
| Ekam | 321 | **204** | 108 k | 51 |
| Amenti | 232 | 231 | 77 k | 29 |
| Uluru | — | 249 | 83 k | 52 |
| Kailash | — | **137** | 103 k | 31 |
| Bodhi Lanka | — | **707** | 90 k | 52 |

FPS je z dev serveru (HMR, source maps) — orientační.

Produkční build (`npm run build` + standalone server, tentýž Metal renderer) prošel bez
shader ani konzolových chyb: Ekam 34, Amenti 53, Bodhi Lanka 55, Kailash 56, Uluru 54 fps
při statickém (reduced-motion) snímku. První produkční běh odhalil chybu, kterou dev režim
nezachytil: `half` je v GLSL rezervované slovo — vodní shader se nepřeložil a harness to
zapsal jako `fail`. To je přesně důvod, proč brána nesmí být „HTTP 200". Opraveno
(`halfDir`) a znovu ověřeno.

## Co je otevřené

- **Bodhi Lanka 707 draw calls** — palmy, keře a lilie nejsou instancované. Potřebuje vlastní optimalizační průchod.
- **Voda je pořád plochá** — chybí Fresnel a hloubkový gradient; R3 (jeden ocean shader) to řeší pro všech 9 scén s vodou.
- **Kailash je stále bledý** — sníh a opar splývají; chce další kolo (tmavší masiv, sníh jen na hřebenech).
- **8 scén neprošlo art passem** — Dharma Temple, Te Pīko Ora, Golden Republic Bohemia, LUMI, Tres Marias, Boa Esperança, Genesis Garden, Matrix hall.
- **Web previews** běží zatím bez `frameloop` optimalizace (R5).
- **Universe** (`/`) je mimo tuto dávku (R6).
- **Zvuk** — player je připravený pro všech 12 scén, tracky chybí (`apps/nirvana/public/audio/<slug>.mp3`).

## Poznámky k implementaci

- `React.` member access musí zůstat explicitní ve všech souborech se `@jsxRuntime classic`;
  jinak Turbopack `React` tree-shakeuje a produkce spadne na `React is not defined` (ověřeno v této etapě).
- `scene.environment` z PMREM je jediný zdroj odlesků; materiály nikdy nedostávají vlastní `envMap`.
- Texturové klony (`tiled()`) sdílí pixelová data, ale každý je samostatný objekt — proto je rozpočet
  na textury 32, ne 16.
