# Project scene tuning — 31 October 2026

## Scope and provenance

This pass covers the twelve Free World project previews, each on the website and in Nirvana, plus the MATRIX lunar scene which keeps its own presentation route. Every project continues to use one scene implementation in `apps/shared/scenes`; application wrappers supply their canvas and navigation.

Runtime candidate: `cdd205e69`, on top of `420499738` (label declutter, Uluru songline geometry) and `16288c96b` (MATRIX realism pass and the prepared soundtrack player). It includes the earlier presentation work: `ad03ab13d` presentation policy, `1f4ae4e9f` landscape/material updates and audit tooling, the Bodhi Lanka bridge correction, `79a493d3e` sky clipping correction, `b4e69dd71` label texture lifecycle and `2c3566593` wrapped labels. Builds were produced in a detached release worktree so concurrent work in the main checkout could not change the tested artifact.

| Artifact | BUILD_ID |
| --- | --- |
| Nirvana (`apps/nirvana`) | `fdIXhfxc3nJtObSn0rI6D` |
| Website (`apps/website-v2.9`) | `pGzDi_WoFaS78162K68Ac` |

`apps/website-v2.9`, `apps/nirvana` and `apps/shared` are identical between `cdd205e69` and the current `main` tip, so the tested artifacts match the deployed sources. Standalone artifacts carry a private `.zion-build.json` recording the runtime commit, BUILD_ID and server checksum. The website prebuild only changes the generated date in `doc-manifest.json`.

## Changes reviewed against the local hero artwork

| Project | Changes in this pass |
| --- | --- |
| Genesis Garden | Consistent sky output colors, smaller sun, wider frame including the boatyard, responsive camera, bounded labels; water/path geometry cleanup. Existing tents and boat models retained. |
| Dharma Temple | Shared camera, label and motion checks applied to the existing coastal scene, sailboat and volcanic ridge. |
| Te Pīko Ora | Shared camera, label and motion checks applied to the tuned fare village, textured roofs, palm canopy and lagoon. |
| Golden Republic Bohemia | Rounded Říp profile, higher overview of the three halls, sky color correction and shadow/material separation; release temporary hall geometry. |
| Bodhi Lanka | Lower, layered lotus roof petals; calmer water and reflection; correct bridge arch elevation and release generated decks/rails. |
| Ekam | Lighter marble palette, subdued vertical light shaft and corrected sky colors. |
| LUMI Nová Amerika | Wider windows, quieter glass and illumination, removal of coincident volcano surfaces, continuous volcanic terrain; release dome geometry. |
| Uluru | Quieter songline glow, correct sky colors/star masks where present and rock geometry cleanup; retain the monolith silhouette and settlement. Songline routes are module constants and their tubes are released when replaced, which removes the only real geometry churn found in this pass. |
| Tres Marias | Shared framing, readable labels, reduced motion and cached shadows applied to the wooden fleet and common ocean. |
| Boa Esperança | Continuous animated ocean replacing overlapping planes and a hard straight seam; restrained sky rays, visible rock material and cliff geometry cleanup. |
| Kailash | Joined eroded rock/snow terrain replacing detached cone caps for the main peak and Himalayan range; cooler lake and atmospheric palette. |
| Amenti | Wider, higher frame for the full pyramid/cosmic grouping; restrained portal and beam exposure; stable arc geometry and cleanup. |

Common changes: project canvases cap DPR at 1.5; OrbitControls register as the default controls; automatic rotation and scene time respect reduced motion; responsive framing is shared. Shadow maps are reused between periodic refreshes. Labels are sprites inside the scene's React root that wrap long text, use an actual 10.5–14 px font and publish a screen-space rectangle with a distance/scale priority; the presentation layer keeps the highest-priority rectangles and hides labels that would overlap or be cut by the frame edge, so text stays readable on a 390 px viewport. The opt-in `?sceneAudit=1` diagnostics expose render counters, resource counts, motion state, camera data, a one-time non-finite vertex check and a geometry inventory. They add no UI controls and no backend API.

## MATRIX — lunar base and glass hall

MATRIX is the lunar sibling of the twelve continents. It was tuned in this pass against the same realism criteria.

| Area | Change |
| --- | --- |
| Ground | Displaced lunar surface (flat pad under the base, relief outside it) with a procedural regolith texture used as colour and bump map. |
| Craters | Graded bowls in three shades with a low rim, replacing flat discs and wire rings. |
| Props | Scattered rocks, boot prints from the modules to the landing pad, a rotating parabolic antenna, a service rover with solar panel, radiator fins and a utility cabinet. |
| Modules | Procedural hull texture with panel seams and rivets on every module and connecting tunnel; solar arrays use a cell texture. |
| Light | Sun lowered to about 7°, which produces the long shadows of the lunar south pole; earthshine fill from Earth's direction; ambient lowered so contrast comes from the sun. |
| Sky | 620 colour-varied stars, procedural Earth (ocean, land, cloud bands, polar caps) with an atmosphere rim, and a soft sun glow. |
| Camera | Target raised and FOV narrowed so the horizon band and Earth stay in frame; rotation slowed. |
| Hall | Reflective floor with panel seams, light strips and light pools, glass walls with mullions and rails, ceiling lights, a lit end wall, brighter ambience and figures with arms and legs. The route accepts `?mode=hall&beat=0|1|2` so a review can jump straight to a beat. |

### Scene soundtrack player

`apps/nirvana/src/core/shell/SceneSoundToggle.tsx` ships the player before the track. It probes `/audio/matrix.mp3` with a HEAD request:

- file missing → the button stays in `zvuk se připravuje` / `sound pending` and does nothing;
- file present → the button loops it with a fade in and out, only after a user gesture (browser autoplay policy).

Drop the track at `apps/nirvana/public/audio/matrix.mp3` and rebuild; no code change is needed. The component takes a `src` prop, so the other scenes can reuse it.

## Validation procedure

- Baseline evidence: `.artifacts/3d-tuning/baseline-nirvana` and `baseline-web`.
- Final evidence: `.artifacts/3d-tuning/final` (24 rows, 96 screenshots) and `.artifacts/3d-tuning/production` (deployed hosts, 3 MATRIX screenshots).
- Browser matrix: 24 routes, Czech/English at 1440×900 and 390×844; camera drag/zoom; reduced motion; repeated language changes; reload/remount; resource counts; runtime and shader errors.
- Standalone TypeScript checks for both applications and production builds from the frozen runtime candidate.
- The matrix runs headless Chromium. `--gpu sw` uses SwiftShader (comparable with the recorded baseline), `--gpu nvidia` and `--gpu amd` use the local hardware through ANGLE, which is how the final numbers below were measured.

## Regressions caught before deployment

- **Stale Turbopack chunks.** A rebuild produced HTML that referenced chunks missing from `.next/static`, so every route answered `500` for its scripts and React never hydrated. Removing `.next` before each build fixed it; the harness now smoke-tests that a scene actually mounts before starting the matrix.
- **Geometry metric measured uploads, not leaks.** The baseline was captured before the first mobile render, which lazily uploads geometries that were previously culled. The baseline is now taken after both viewports and both languages have rendered, and the exact leak gate is the scene-graph size; GPU counters are only a proportional guard.
- **Uluru songline churn.** Inline coordinates fed a memoised `TubeGeometry`, so each language switch allocated four new tubes. Fixed with module constants plus disposal; the row now recreates nothing.
- **Four website previews never initialised.** On `golden-republic-bohemia`, `bodhi-lanka`, `nova-amerika` and `maria-del-camino` the canvas stayed at the 300×150 default and the scene never mounted, on desktop and mobile, with no console error. r3f measures the canvas when it mounts; on those routes the surrounding card still had no size at that moment and no later measurement arrived. The lazy wrappers now own the responsive height and re-trigger a resize until the canvas rect matches the wrapper (a never-measured canvas still reports 300×150, so the raw width is not a usable signal).
- **Ekam lathe churn was not a leak.** The website row re-creates nine lathe geometries on a language switch and releases them again; the scene graph stays at 264 objects. The tolerance change above keeps the guard meaningful without flagging it.

## Final acceptance — 24 rows, 96 screenshots

All rows: `status: pass`, no runtime or shader errors, `invalidVertices: 0`, scene graph unchanged. FPS is a requestAnimationFrame sample on the host GTX 1070 Ti through ANGLE; the website numbers are bounded by the page around the canvas, not by the scene.

| Project | Nirvana FPS | Website FPS | Geometries (before → after) | Textures |
| --- | --- | --- | --- | --- |
| Genesis Garden | 59.0 | 12.3 | 226 → 226 | 8 → 8 |
| Dharma Temple | 60.0 | 7.9 | 96 → 96 | 8 → 8 |
| Te Pīko Ora | 57.8 | 7.4 | 415 → 415 | 9 → 9 |
| Golden Republic Bohemia | 55.5 | 11.3 | 345 → 345 | 8 → 8 |
| Bodhi Lanka | 40.6 | 13.4 | 664 → 664 | 11 → 11 |
| Ekam | 57.7 | 11.7 | 224 → 224 | 8 → 8 |
| LUMI Nová Amerika | 53.1 | 10.7 | 463 → 463 | 10 → 10 |
| Uluru | 58.5 | 15.7 | 234 → 234 | 9 → 9 |
| Tres Marias | 60.1 | 16.9 | 142 → 142 | 6 → 6 |
| Boa Esperança | 56.1 | 18.0 | 164 → 164 | 8 → 8 |
| Kailash | 49.3 | 18.3 | 134 → 134 | 8 → 8 |
| Amenti | 40.3 | 12.8 | 228 → 228 | 11 → 11 |

MATRIX was verified separately (local and production): base scene, mobile base and glass hall at beat 2, all with `invalidVertices: 0` and no console errors.

Production startup-only audit on the deployed hosts: 24/24 routes pass, 33–34 static assets checked per website route, `/present/matrix` and `/present/matrix?mode=hall&beat=2` render.

## Deployment

- Website: EDGE2, `/opt/zion/APP&WEB/website-v2.9/.next/standalone`, service `zion-website.service`, previous app retained at `standalone.before-cdd205e69`.
- Nirvana: EDGE, `/opt/zion/APP&WEB/nirvana`, service `zion-nirvana.service`, previous app retained at `nirvana.before-cdd205e69`.
- Both deploy wrappers accept `--artifact-dir` for a tested standalone application containing `server.js`, `.next/BUILD_ID`, `.next/static` and traced dependencies. `scripts/ops/deploy-next-artifact.sh` transfers it into a sibling staging directory, preserves runtime environment files, switches directories and retains the previous application; startup and public health failures restore it automatically.
- Rollback: point the service back at the `*.before-cdd205e69` directory, or rerun the deploy with the previous artifact.

## Handoff status — 31 October 2026

Acceptance is complete and both applications are deployed. Label declutter, the Uluru geometry fix and the four dead website previews are fixed and verified in production. The MATRIX scene is tuned and its soundtrack player is ready; the track file is the only missing input. The release worktree and local preview servers are disposable after this pass.
