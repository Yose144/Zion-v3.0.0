# Shared project scenes

Single source of geometry, labels, lighting and camera settings for the twelve L5 Free World project scenes, plus the lunar Matrix base. Earth scenes render twice: as the website preview on `app.zionterranova.com/terranova/<slug>` and as the Nirvana presentation on `nirvana.zionterranova.com/present/<slug>`. Matrix is Moon-only for now (`/present/matrix`) — it is not a thirteenth Earth pin. Change a scene here rather than copying it into either application.

## Scenes

| File | Mission | Nirvana route |
|---|---|---|
| `GenesisGarden.tsx` | Genesis Garden · Portugal | `/present/genesis-garden` |
| `DharmaTemple.tsx` | Dharma Temple · La Palma | `/present/dharma-temple` |
| `TePikoOra.tsx` | Te Pīko Ora · Raiatea | `/present/te-piko-ora` |
| `GoldenRepublicBohemia.tsx` | Golden Republic Bohemia · Říp | `/present/golden-republic-bohemia` |
| `BodhiLanka.tsx` | Bodhi Lanka · Sri Lanka | `/present/bodhi-lanka` |
| `Ekam.tsx` | Ekam · Oneness Temple | `/present/ekam` |
| `LumiStation.tsx` | LUMI / Nová Amerika · Costa Rica | `/present/nova-amerika` |
| `MariaDelCamino.tsx` | Tres Marias · Galicia | `/present/maria-del-camino` |
| `Uluru.tsx` | Uluru · Australia | `/present/uluru` |
| `BoaEsperanca.tsx` | Boa Esperança · Cape of Good Hope | `/present/boa-esperanca` |
| `Kailash.tsx` | Kailash · Tibet | `/present/kailash` |
| `Amenti.tsx` | Amenti · Giza | `/present/amenti` |
| `Matrix.tsx` | Matrix · Shackleton, Moon | `/present/matrix` |

## Shared infrastructure

- `ScenePresentation.tsx` — camera, motion and shadow policy mounted by every scene. Owns portrait-aware framing (no per-scene `*Framing` components), gates animation on `prefers-reduced-motion` (`motionTime`/`motionDelta` freeze at 0 and `OrbitControls.autoRotate` is disabled), refreshes the shadow map at ~2 Hz instead of every frame, and exposes a render audit: open any scene with `?sceneAudit=1` and read `window.__projectScene` for fps, draw calls, triangles, geometry/texture counts.
- `SceneLabel.tsx` — canvas-texture sprite labels; `scale` prop adjusts for scene size.
- `CoastalLandscape.tsx` — La Palma coast + `AtlanticOcean` water (reused by Dharma Temple and the Tres Marias fleet).
- `LagoonLandscape.tsx` — Raiatea beach and mountain backdrop on the shared ocean renderer.

## Conventions

- Each application maps `@genesis/runtime` to its own small runtime adapter so hooks, JSX and Three.js bind to the consuming app's React Three Fiber context and dependency instances. The `@jsxRuntime classic` pragma avoids resolving a second JSX runtime from this shared directory.
- **Always reference `React.use*` explicitly** (`React.useRef`, `React.useState`, …). Under `classic` runtime, JSX emits `React.createElement` against a free `React` identifier; a bundler may tree-shake an unused `import { React }` binding and the scene crashes in production builds with `React is not defined` while dev mode stays fine. An explicit `React.` member access keeps the binding alive.
- Every scene exports its camera/controls constants (`*_CAMERA`, `*_CONTROLS`) consumed by both wrappers, plus `<Scene>Scene({ lang })` where `lang: 'cs' | 'en'`.
- The application wrappers own the canvas (`dpr=[1, 1.5]`), navigation, language toggle and browser fallback; Nirvana presentations add `ProjectLanguageButton` and links back to the mission page.
- Animate only through `motionTime(clock)` / `motionDelta(delta)` so reduced-motion users get a static scene.

## Adding a new project scene

1. `apps/shared/scenes/<Project>.tsx` — scene per the conventions above.
2. `apps/website-v2.9/src/components/<Project>Preview.tsx` + `<Project>PreviewLazy.tsx` — canvas wrapper + dynamic import; mount the section on the project page.
3. `apps/nirvana/src/core/scene/projects/<Project>.tsx` — thin re-export.
4. `apps/nirvana/src/app/present/<slug>/page.tsx` — full-screen presentation (`ProjectLanguageButton`, external mission link, `OrbitControls target` from the exported controls constants).
5. `apps/nirvana/src/lib/freeworld-sites.ts` — set `present: '/present/<slug>'` on the mission so its Earth marker opens the presentation.
6. `npx tsc --noEmit` in both apps, screenshot the presentation, commit, deploy `deploy-web2.9.sh` + `deploy-nirvana.sh`.
