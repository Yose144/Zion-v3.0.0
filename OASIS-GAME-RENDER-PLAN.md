# OASIS GAME — render program

> **1. 11. 2026.** Stejný způsob práce jako u Nirvany: [`OASIS-RENDER-CANON.md`](OASIS-RENDER-CANON.md)
> je závazná pravidla, tenhle dokument je **program** — co konkrétně v OASIS herním klientovi
> doladit, v jakém pořadí a s jakou branou.
>
> Platí pro `apps/OasisWeb` (hra na `oasis.zionterranova.com`, statický export).

## 0. Výchozí stav (změřeno 1. 11. 2026)

| Vrstva | Stav |
| --- | --- |
| Stack | Next 16 (static export), React 19, **three 0.169**, r3f 9.4, drei 10.7, **@react-three/postprocessing 3.0.4** + postprocessing 6.39, Babylon 9 pro intro |
| Plátno | `dpr={[1, 1]}` — **strop 1**, `antialias: false`, `alpha: false` |
| Kompozice | `EffectComposer` (WebGL2): Bloom 0.62 / threshold 0.35, Vignette, HueSaturation, BrightnessContrast; WebGPU má vlastní TSL post |
| IBL | `<Environment preset="night" />` z drei — **stahuje HDRI z CDN**, jen desktop, `environmentIntensity 0.6` |
| Světlo | ambient 0.15 + **3 point lights**; ve scéně měřeno **21 světel** celkem |
| Měřeno (dev, 1440×900, M1/Metal) | **106 draw calls, 280 k trojúhelníků, 41 textur, 75 meshů, pixelRatio 1, 17–23 fps** |
| Scény | `Galaxy` + `GalaxyCore` + `TreeOfLife` (1 180 ř.) + `Planet` (618) + `WorldEnvironment` (568) + `MatrixCore` + `Nebula` + `DistantGalaxies` + lodě (`StarFighterModels` 510) |
| Pohyb | `CameraRig` s lety, `UniverseRotator`, `MobileTouchControls`, OrbitControls |
| Zvuk | `AudioEngine` (411 ř.), `music.ts` |
| Intro | `BabylonIntro` (389 ř.) → „Enter the OASIS" → stargate → galaxie |

**Hlavní nálezy**

1. **DPR je uzamčené na 1** — ostrý obraz je největší vizuální dluh; při 280 k trojúhelnících
   a 106 draw calls je prostor na 1,25–1,5 (tier A).
2. **21 světel** je nejdražší položka ve fragment shaderu; tři klíčová světla by stačila,
   zbytek má být emise v materiálech.
3. **HDRI z CDN** = síťová závislost a cizí vizuál. Kit umí vygenerovat IBL z vlastní oblohy.
4. **Bloom threshold 0.35** rozkvétá i tmavé plochy — galaxie pak šedne a ztrácí contrast.
5. **Žádné měření v produkci** — neexistuje obdoba `?sceneAudit=1`, takže se nedá říct,
   co regresuje.

## 1. Cíle (stejné jako u Nirvany)

- **Jeden kit, ne kopie.** `apps/shared/scenes/kit` (quality, textury, materiály, obloha/IBL,
  composer, terén, voda, částice) se používá i tady. `apps/OasisWeb` dostane stejný
  `@genesis/runtime` adaptér jako Nirvana a web.
- **Měřitelné brány**, ne dojmy: draw calls, trojúhelníky, textury, FPS, chyby.
- **Art direction:** galaxie má mít hloubku (mlhoviny, hvězdné vrstvy, parallaxa), planety
  materiál (ne jen textura), světy čitelné silhouette.

## 2. Rozpočty (návrh, platí po O1)

| Metrika | Tier A (desktop dGPU) | Tier B (M1/iGPU) | Tier C (mobil) |
| --- | --- | --- | --- |
| FPS (1440×900 / 390×844) | ≥ 55 | ≥ 45 | ≥ 30 |
| DPR cap | 1,5 | 1,25 | 1,0 |
| Draw calls / scéna | ≤ 220 | ≤ 220 | ≤ 140 |
| Trojúhelníky / scéna | ≤ 400 k | ≤ 350 k | ≤ 200 k |
| Světla ve scéně | ≤ 6 | ≤ 6 | ≤ 3 |
| Textury | ≤ 40 | ≤ 40 | ≤ 24 |
| Chyby shader/console | 0 | 0 | 0 |

Současný stav: 106 / 280 k / 21 světel / 41 textur / 17–23 fps — draw calls a trojúhelníky
jsou v normě, **světla, DPR a post jsou to, co drží fps dole**.

## 3. Vlny

| Vlna | Obsah | Brána |
| --- | --- | --- |
| **O0** Měření | `?sceneAudit=1` háček (FPS, draw calls, trojúhelníky, textury, světla, tier), `scripts/ops/audit-oasis.py` (landing, galaxie, svět, lodě, mobil), scorecard do `.artifacts/oasis/` | baseline všech 5 povrchů |
| **O1** Kit do OasisWeb | `@genesis/runtime` adaptér, `quality.ts` (DPR/post/světla), `ScenePost` composer, sdílené textury/materiály | **stejná scéna při ≤ 6 světlech a DPR 1,25+ vypadá líp a je rychlejší** |
| **O2** Světlo a IBL | CDN HDRI ven, IBL z kit oblohy (galaktická varianta), 3 klíčová světla + emise, bloom retune (threshold 0.8) | bez síťové závislosti, contrast v pořádku |
| **O3** Galaxie | hvězdné vrstvy (instancované, parallax), mlhoviny jako aditivní sprity s šumem, jádro galaxie, distance fade; `TreeOfLife` a `Planet` materiály | tier A ≥ 55 fps, žádná „šedá mlha" |
| **O4** Světy a lodě | `WorldEnvironment` (terén/voda/obloha z kitu), `Planet` (PBR, atmosféra, mraky), `StarFighterModels` (kov, sklo, emise) | každý povrch v rozpočtu, vizuálně konzistentní s Nirvanou |
| **O5** Intro a přechody | Babylon intro × R3F: jednotný look stargate (stejná geometrie/obraz jako Brána v Nirvaně), plynulé předání, loading s progresem | intro → galaxie bez bílého bliknutí |
| **O6** Mobil a přístupnost | tier C (DPR 1, světla ≤ 3, post off), dotykové ovládání, reduced-motion | ≥ 30 fps na 390×844, žádné chyby |
| **O7** Akceptace a deploy | scorecard, vizuální baseline, `deploy-oasis-web.sh`, report | 5/5 povrchů PASS, rollback |

## 4. Co se nedělá

- Nemění se herní logika (`gameStore`, API, ekonomika, ZAP pas).
- Nepřepisuje se Babylon intro na R3F — jen se sjednotí vzhled.
- Nenasazuje se nic, co nemá změřený stav před a po.

## 5. Rizika

| Riziko | Mitigace |
| --- | --- |
| three 0.169 v OasisWeb vs 0.186 v Nirvaně | kit už dnes nesmí importovat `three/addons`; `scene.environmentIntensity` a `AgX` v 0.169 existují, composer je vlastní |
| Static export = žádný server pro audit | měření jde přes Playwright proti `next dev`/`serve dist` |
| WebGPU cesta má vlastní post | audit měří obě; tier C WebGPU vypíná |
| 21 světel v komponentách, které jsem nepsal | nejdřív změřit, které scény je používají, pak konsolidovat po jedné |
| Souběžná práce jiné session v `apps/OasisWeb` | commity jen po malých krocích, vždy `tsc` + audit |

## 6. Změnový log

| Datum | Změna |
| --- | --- |
| 2026-11-01 | Vznik dokumentu; **O0 hotové** — `?sceneAudit=1` publikuje `window.__oasisAudit` (fps, calls, tris, textury, světla, tier, dpr) a `?skipIntro=1` preskočí Babylon i rite, takže jde měřit galaxii deterministicky. Baseline: **127 calls / 275 k tris / 50 textur / 11 světel / ~22 fps (dev)**. |
| 2026-11-01 | **O1/O2 první řez** — `@genesis/runtime` adaptér a import kitu v OasisWeb; DPR z `quality()` (tier A 1,75, mobil ≤1,25); `SceneEnvironment` (vlastní IBL, `dome=false`) místo drei `Environment preset="night"` = **žádné stahování HDRI z CDN**; **světla 21 → 11** (per-planet point + ambient světla nahrazena emisí a scénickým klíčem); bloom retune (0,62/0,35 → 0,38/0,72); koruna stromu: paleta bez neonu, opacita 0,92 → 0,34, jeden list na větev. |
