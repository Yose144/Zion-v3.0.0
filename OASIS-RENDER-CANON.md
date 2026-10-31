# OASIS RENDER CANON

> **Závazný způsob, jakým se v tomto repu kreslí 3D.** Vzniklo z programu
> [`NIRVANA-RENDER-AAA.md`](NIRVANA-RENDER-AAA.md) (13 L5 scén, R0–R7) a je to základ,
> na kterém se staví celý OASIS. Když se nová scéna odchýlí od tohoto dokumentu, je to
> chyba, ne styl.
>
> Stav: 31. 10. 2026. Platí pro `apps/shared/scenes`, `apps/nirvana` a `apps/website-v2.9`.

## 0. Tři věty, které stačí

1. **Scéna je čistá procedura.** Geometrii, materiály, světlo i oblohu staví kód; žádné
   GLB, HDR ani texturové soubory, dokud to nebude vědomé rozhodnutí (viz §9).
2. **Jeden kit, ne kopie.** Všechno sdílené je v `apps/shared/scenes/kit/`. Scéna, která
   potřebuje nový efekt, ho přidá do kitu — ne do sebe.
3. **Brána je vyrenderovaný snímek s čísly**, ne `HTTP 200` a ne úspěšný build.

## 1. Vrstvy

```
apps/shared/scenes/
  kit/                 ← jediná implementace renderu (three + @genesis/runtime ONLY)
  <Scéna>.tsx          ← 12 pozemských misí + Matrix (+ MatrixHall)
  ScenePresentation.tsx← kamera, stíny, labely, audit, mount atmosféry/intra/postu
  SceneLabel.tsx
apps/nirvana/
  core/scene/ProjectPresentation.tsx   ← chrome, canvas, DPR, zvuk, loading veil
  core/scene/SceneRoot.tsx             ← universe (WebGPU/WebGL2)
  app/present/<slug>/page.tsx          ← 25 řádků dat, žádná logika
apps/website-v2.9/
  components/<X>Preview.tsx            ← stejná scéna v malém plátně
  components/usePreviewVisibility.ts   ← frameloop mimo viewport
```

**Tvrdé pravidlo:** `kit/` smí importovat jen `three` (přes `@genesis/runtime`) a
`@genesis/runtime`. Žádné `@react-three/*`, žádné `three/addons/*`. Scény se kompilují do
dvou aplikací s **různou verzí three** (Nirvana 0.186, web 0.169); cokoli z addonů se
v jednom z balíčků nerozřeší. Post-processing je proto vlastní, ne `EffectComposer`.

## 2. Život snímku

```
Canvas (dpr z tieru)
  └─ <Scéna>                       world: mesh, terén, voda, částice
       ├─ <ScenePresentation>      mount atmosféry, intra a postu; audit; stíny
       │    ├─ <SceneEnvironment>  sky dome + PMREM IBL + FogExp2
       │    ├─ <CinematicIntro>    dolly → předání OrbitControls
       │    └─ <ScenePost>         HDR composer
       └─ <XLighting>              KeyLight + SkyFill + ambient
```

Pořadí ve framu (r3f priority): `SceneSky` −1000 → intro −2 → audit −1 →
`ScenePost` +1 (přebírá render; r3f sám nekreslí).

**Composer:** scéna → MSAA half-float target → bright pass (1/2) → 2× blur (1/2) →
downsample (1/4) → 2× blur → composite (bloom + saturace + vinětace + grain + ACES + sRGB).

Z toho plyne zásada, která se už jednou porušila a stála nás vybledlý oceán:
**scénické shadery nesmí dělat vlastní tonemapping ani sRGB konverzi.**
Žádné `#include <tonemapping_fragment>` / `<colorspace_fragment>`. Do bufferu se píše
lineárně, grading vlastní composer.

## 3. Tiery a rozpočty

`kit/quality.ts` rozhodne jednou za session: `deviceMemory`, `hardwareConcurrency`,
`pointer: coarse`, `saveData`. Override pro revize: `?quality=low|mid|high`.

| | A (desktop dGPU) | B (M1/iGPU) | C (mobil) |
|---|---|---|---|
| DPR cap | 1,75 | 1,5 | 1,25 |
| Post-fx | bloom + vinětace | bloom + vinětace | vypnuto |
| Stíny | 2048, 2 Hz | 1024, 2 Hz | vypnuto |
| Textury | 512 | 384 | 256 |

| Brána | Limit |
|---|---|
| Draw calls / scéna | **≤ 600** (cíl ≤ 250) |
| Trojúhelníky / scéna | ≤ 450 k |
| Textury / scéna | ≤ 32 objektů (klony sdílí pixely) |
| FPS (1440×900, Metal, reduced motion) | ≥ 30 |
| Chyby shader/console | 0 |
| `invalidVertices` | 0 |
| Scéna-graf po 3× přepnutí jazyka | bez růstu |

Měřeno `scripts/ops/audit-project-scenes.py --strict-budget --scorecard <path>`.

## 4. Recepty

### 4.1 Nová scéna (kopíruj pořadí)

```tsx
/** @jsxRuntime classic */
'use client';

import { React, useFrame, THREE } from '@genesis/runtime';
import { ScenePresentation } from './ScenePresentation';
import { SceneLabel } from './SceneLabel';
import {
  KeyLight, SkyFill, SceneTerrain, SceneTrees, SceneWater, SceneMotes,
  marbleWhite, stoneWarm, timber, water as waterMat,
} from './kit';

export function MojeScena({ lang }: { lang: 'cs' | 'en' }) {
  return (
    <>
      <ScenePresentation
        camera={MOJE_CAMERA}
        target={MOJE_CONTROLS.target}
        atmosphere={{
          sun: [-0.6, 0.28, -0.75],
          zenith: '#2c4670', horizon: '#f2c58a', ground: '#3a3428',
          sunColor: '#ffd2a1', sunSharpness: 280, clouds: 0.3, stars: 0,
          fog: '#d8ac82', fogDensity: 0.0016, envIntensity: 0.95,
        }}
        post={{ bloom: 0.34, threshold: 0.88, exposure: 1.02, vignette: 0.5 }}
        intro={{ duration: 3.6 }}
      />
      <KeyLight sun={[-0.6, 0.28, -0.75]} intensity={3} extent={80} distance={130} />
      <SkyFill sky="#bcd2e8" ground="#6b5a44" intensity={0.5} />
      <ambientLight intensity={0.14} color="#ffe4b8" />

      <SceneTerrain kind="grass" size={700} repeat={220} level={-0.06}
        height={(x, z, n) => Math.max(0, Math.min(1, (Math.hypot(x, z) - 60) / 90)) * (n.fbm(x * 0.012, z * 0.012, 4) - 0.42) * 24}
        color={(x, y, z, n) => [0.16 + n.fbm(x * 0.02, z * 0.02, 3) * 0.1, 0.26, 0.12]} />

      <mesh material={marbleWhite(2)} position={[0, 2, 0]} castShadow>
        <cylinderGeometry args={[4, 4.4, 4, 16]} />
      </mesh>

      <SceneMotes count={180} area={[70, 70]} height={20} color="#ffe8c0" opacity={0.4} />
      <SceneLabel position={[0, 8, 0]} text={lang === 'cs' ? 'Název' : 'Name'} />
    </>
  );
}

export const MOJE_CAMERA = { position: [0, 14, 54] as [number, number, number], fov: 40, far: 1200 };
export const MOJE_CONTROLS = { autoRotate: true, autoRotateSpeed: 0.16, minDistance: 18, maxDistance: 140, maxPolarAngle: Math.PI / 2 - 0.06, target: [0, 6, 0] as [number, number, number], enablePan: false };
```

Pak: `apps/nirvana/src/core/scene/projects/<X>.tsx` (re-export), `app/present/<slug>/page.tsx`
(25 řádků přes `ProjectPresentation`), `apps/website-v2.9/src/components/<X>Preview.tsx`
(+`Lazy`), `lib/freeworld-sites.ts` → `present: '/present/<slug>'`.

### 4.2 Materiály

`marbleWhite(repeat)` · `marbleMatte` · `marbleDarkStone` · `stoneWarm(repeat, tint)` ·
`stoneCool` · `basaltRock` · `gold(roughness)` · `bronze` · `glass` · `glassClear` ·
`timber(repeat, tone)` · `plasterWall(repeat, tint)` · `sandGround` · `grassGround(repeat, tint)` ·
`snowGround` · `regolithGround` · `groundMaterial(kind, repeat)` · `water(repeat, tint)` ·
`leafCanopy(tone)` · `lamp(color, intensity)` · `unlit(color)`.

- Materiály jsou **kešované instance**. Neměň na nich vlastnosti za běhu; variabilitu dělej
  `repeat`/`tint` parametrem (klíč cache) nebo per-instance barvou.
- Odlesky jdou výhradně ze `scene.environment` (PMREM z oblohy). Nikdy nenastavuj `envMap`.

### 4.3 Terén, les, palmy, voda, částice

| Komponenta | Cena | Kdy |
|---|---|---|
| `SceneTerrain` | 1 draw call | vždy, když je zem vidět do dálky |
| `SceneTrees` | 4 draw calls (kmen + 3 vrstvy korun) | listnaté lesy |
| `ScenePalms` | 1 draw call (kmen + 9 listů + ořech v jedné geometrii) | palmy |
| `SceneWater` | 1 draw call | bazény, jezera, malé plochy |
| `OceanSurface` (`AtlanticOcean`) | 1 draw call | moře; `lagoon` pro tyrkys |
| `SceneMotes` | 1 draw call | pyl / prach / sníh; pohyb ve vertex shaderu |
| `SceneInstances` | 1 draw call | opakované propriety: kamenný kruh, lampy, klády, balvany |

`SceneInstances` ber vždy, když `map()` vrací víc než ~4 stejné meshe (kámen, kláda, lampa,
balvan). Geometrii a materiál drž na úrovni modulu, ne v renderu.

**Instancuj, dokud to jde.** 60 stromů jako 60 skupin = ~180 draw calls; přes
`SceneTrees` = 4. Tři palmy na scéně klidně nech vlastní (hero detail), zbytek instancuj.

### 4.4 Voda

**Jedna voda, dva režimy.** `OceanSurface` je jediná implementace: `mode="sea"` počítá tři
procedurální vlnové vlaky (moře do dálky, žádný tiling), `mode="pool"` vzorkuje tilingovou
ripple normal mapu (bazény, jezera). `SceneWater` je jen tenká vrstva nad `pool` režimem,
`AtlanticOcean` nad `sea` režimem. Fresnel je v bazénu ztlumený (`uFresnelScale 0.42`),
aby hladina nezešedla od oblohy.
Vždy předávej `sun` shodné s `<KeyLight sun>` a `sky` shodnou s horizontem oblohy —
jinak voda nesedí s nebem.

### 4.5 Zvuk

`SceneSoundToggle` zkusí `/audio/<slug>.mp3`; když soubor není, syntetizuje ambienci
(`ambience.ts`, profily `surf|wind|forest|desert|space|temple`). Autoplay je zakázaný —
startuje se klikem. Nová scéna: `sound="<slug>"` + `ambience="<profil>"` v `ProjectPresentation`.

## 5. Anti-patterns (bolí to)

| Nikdy | Proč |
|---|---|
| `import { OrbitControls } from '@react-three/drei'` v `kit/` nebo ve scéně | dvojí R3F/React instance, jiná verze three v druhém balíčku |
| `three/addons/*` v `shared/scenes` | nerozřeší se ve webu (three 0.169) |
| `#include <tonemapping_fragment>` ve scénickém shaderu | dvojí konverze → vybledlý obraz |
| `React.useRef` nahrazené bare `useRef` se `@jsxRuntime classic` | Turbopack strom setřese `React` → `React is not defined` v produkci |
| Nová textura per frame / materiál per mesh | programy a GPU paměť rostou, fps padá |
| Per-frame alokace (`new Vector3` ve `useFrame`) | GC pauzy; používej refs |
| Emisivní materiál bez `toneMapped` kontroly u UI prvků | bloom přepálí ovládací prvky |
| Měření „build prošel" | build nepozná rozbitý shader (viz `half` v GLSL) |

## 6. Měření a nasazení

```bash
# GPU audit na tomto Macu (ANGLE Metal, lokální Chrome, žádné stahování browserů)
.venv-audit/bin/python scripts/ops/audit-project-scenes.py \
  --app nirvana --shots-only --gpu metal \
  --nirvana-url http://127.0.0.1:3040 \
  --output .artifacts/render/<kolo> --release <kolo> \
  --strict-budget --scorecard .artifacts/render/<kolo>/SCORECARD.md

# vizuální regrese proti baseline (hero snímek, 16×16 perceptual hash)
... --visual-baseline .artifacts/render/<baseline> --visual-gate 6

# živý web (preview canvasy se odscrollují samy)
.venv-audit/bin/python scripts/ops/audit-project-scenes.py --app web --shots-only \
  --gpu metal --web-url https://app.zionterranova.com --output .artifacts/live --release live
```

Režimy: `--shots-only` (hero 1920, desktop 1440, mobil 390 — se `?labels=0`),
`--startup-only` (jen mount + assety), `--resume` (pokračuj po pádu), plná matice
(bez příznaku) pro interakce, jazyk, reduced-motion a detekci úniků.

### Rozpočet v CI (strojově nezávislý)

Obrazová baseline je závislá na GPU, takže do CI nepatří. Do repa patří **rozpočet** —
draw calls, trojúhelníky a textury na scénu (`docs/3.2/render-budget.json`). Je to jediné
číslo, které musí platit na každém stroji.

```bash
# vygenerovat / obnovit rozpočet (jen po vědomé změně scény)
... --write-budget docs/3.2/render-budget.json

# CI gate: selže, když scéna naroste o víc než 15 % draw calls nebo trojúhelníků
... --budget-file docs/3.2/render-budget.json --budget-tolerance 15 --strict-budget
```

Vizuální regrese zůstává lokální (`--visual-baseline` + `--visual-gate`), protože
perceptual hash se mezi GPU liší; používej ji před nasazením na stejném stroji, kde
vznikla baseline.

### Nasazení

| Povrch | Skript | Host | Služba |
|---|---|---|---|
| Nirvana | `apps/nirvana/deploy/deploy-nirvana.sh --artifact-dir <standalone/nirvana>` | EDGE (`zion-new`) | `zion-nirvana.service` :3010 |
| Web | `apps/website-v2.9/deploy/deploy-web2.9.sh --artifact-dir <standalone/website-v2.9>` | EDGE2 (`zion-edge2`) | `zion-website.service` :3000 |

**Pozor na gate.** Prezentace `/present/*` jsou od 31. 10. za ZAP pasem. Lokální audit
produkčního buildu proto potřebuje dvě věci: server spuštěný s `ZION_RENDER_AUDIT=1`
a stejnou proměnnou u skriptu — ten pak posílá hlavičku `x-render-audit: 1`, kterou
`present/layout.tsx` pustí dál. V produkci proměnná není, takže se nic neobchází.

**Pozor na `sharp`.** Web používá `next/image`; build na macOS obsahuje jen
`@img/sharp-darwin-arm64`. Před nasazením je potřeba dotočit z EDGE2
`sharp-linux-x64` + `sharp-libvips-linux-x64` do `node_modules/@img/`, jinak obrázky
v produkci vrátí 500. Čistší je buildit web přímo na Linuxu.

Rollback: oba skripty drží předchozí build (`*.before-<release>`), `deploy-next-artifact.sh`
se sám vrátí, když start nebo health check selže.

## 7. Checklist před commitem

- [ ] `npx tsc --noEmit` v Nirvaně **i** ve webu
- [ ] `npm run build` v Nirvaně (a ve webu, když se sahlo na shared)
- [ ] `--shots-only --strict-budget` na produkčním buildu, 0 chyb
- [ ] hero snímek prohlédnutý očima (ne jen `pass`)
- [ ] draw calls a fps v reportu
- [ ] pokud se změnil vzhled: nová baseline pro vizuální bránu
- [ ] `NIRVANA-RENDER-AAA.md` + report aktualizované

## 8. Co je hotové a co ne

Hotovo: 13 scén (12 misí + Matrix/Hala), jednotný kit, composer, tiery, terén/les/palmy/
voda/částice, **jedna voda ve dvou režimech**, obloha s IBL, intro kamery, zvuk s ambiencí,
web previews s pauzou mimo viewport, universe s composerem a Hiranem ve Slunci, GPU audit
s rozpočtem pro CI a vizuální regresí.

Otevřeno: přechody scéna↔portál v universe, HUD, LOD pro velké scény, vizuální baseline
v CI (rozpočet už ano, hash zůstává lokální).

## 9. Až přijde OASIS ve velkém

Tenhle kit je schválně **bez assetů**, aby šel rozšířit, ne zahodit. Až bude potřeba víc:

1. **GLB pipeline:** `public/models/<id>.glb` + `KHR_texture_basisu`; loader v kitu,
   instancované prototypy, LOD0/1/2. Scéna pak míchá proceduru (terén, obloha, voda)
   s modely (budovy, postavy).
2. **Streaming:** dlaždice terénu a modelů podle vzdálenosti; `SceneTerrain` už dnes
   dostává `size`/`height`, takže dlaždice jsou jen jiné argumenty.
3. **WebGPU/TSL:** kit je dnes WebGL2-first (composer je WebGL only). Až bude TSL cesta
   stabilní, composer se nahradí node-based postem — rozhraní `<ScenePost>` zůstane.
4. **VR:** `SceneRoot` už má `@react-three/xr`; scény musí zůstat bez DOM závislostí
   v geometrii (drží se).
5. **Asset budget:** jakmile přibudou binárky, platí stejné brány + limit velikosti
   prvního loadu (do 3 MB na scénu, lazy).

Nic z toho nemění §1–§5. To je smysl tohoto dokumentu.
