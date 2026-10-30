# REPORT — L5 Free World 3D presentations complete (12/12)

**Datum:** 2026-10-30 · **Autor:** Devin · **Scope:** `apps/shared/scenes`, `apps/website-v2.9`, `apps/nirvana`
**HEAD:** `ad03ab13d` · **Produkce:** `app.zionterranova.com`, `nirvana.zionterranova.com`

## Shrnutí

Všech 12 misí L5 Free World má živý 3D model postavený podle hero/koncept předloh (`heros/`), nasazený **dvakrát z jednoho zdroje**: jako interaktivní preview na veřejné stránce projektu a jako plnoobrazovková prezentace v Nirvaně. Zemské markery v Nirvaně jsou přehledné a plně interaktivní (hover → pointer kurzor + zlaté halo + tooltip `Jméno ↗`, klik → prezentace v novém tabu).

## Stav per mise

| Mise | Web `/terranova/*` | Nirvana `/present/*` | `present` v registru |
|---|---|---|---|
| Genesis Garden | ✅ | ✅ | ✅ |
| Dharma Temple | ✅ | ✅ | ✅ |
| Te Pīko Ora | ✅ | ✅ | ✅ |
| Golden Republic Bohemia | ✅ | ✅ | ✅ |
| Bodhi Lanka | ✅ | ✅ | ✅ |
| Ekam · Oneness Temple | ✅ | ✅ | ✅ |
| LUMI / Nová Amerika | ✅ | ✅ | ✅ |
| María del Camino (Tres Marias) | ✅ | ✅ | ✅ |
| Uluru | ✅ | ✅ | ✅ |
| Boa Esperança | ✅ | ✅ | ✅ |
| Kailash | ✅ | ✅ | ✅ |
| Amenti · Giza | ✅ | ✅ | ✅ |

**Ověření produkce:** 12/12 `/present/*` → HTTP 200, `canvas=1 errors=none` na každé prezentaci; `canvas=2 errors=none` na každé web stránce (nav + 3D preview). Poslední sweep po `ad03ab13d`: vše zelené.

## Architektura

- **`apps/shared/scenes/<Project>.tsx`** — single source geometrie/labelů/kamery. Importy přes `@genesis/runtime` (per-app alias → vlastní React/R3F/THREE instance), `@jsxRuntime classic` pragma. Viz aktualizovaný `apps/shared/scenes/README.md`.
- **Web:** `components/<Project>Preview.tsx` (Canvas wrapper, `dpr=[1,1.5]`) + `PreviewLazy` (dynamic import) vsazené do stránky projektu.
- **Nirvana:** `core/scene/projects/<Project>.tsx` re-export + `app/present/<slug>/page.tsx` (`ProjectLanguageButton` CS/EN, externí link na misi, OrbitControls).
- **`freeworld-sites.ts`** — každá mise má `present` pole → Earth marker otevírá interní prezentaci místo externí stránky.
- **`ScenePresentation.tsx`** (od `ad03ab13d`) — sjednocená policy: portrait-aware framing, `prefers-reduced-motion` (animace zamrznou, autoRotate off), shadow map ~2 Hz, `?sceneAudit=1` → `window.__projectScene` (fps, draw calls, triangles).

## Earth markery (commit `2a3485f5b`)

- 12 misí: instancované světelné sloupky + pulzující povrchové kruhy + tip koule + jmenovky (`TextLabel`), barva podle statusu mise.
- Interakce: neviditelný instancovaný hit-mesh (⌀0.32) nese všechny raycast eventy; vizuální meshe `raycast={() => null}` — raycast jen jeden mesh.
- Hover: `cursor:pointer`, zvětšení tipu, zlaté dvojité halo, tooltip `Jméno ↗`. Klik: `window.open(url, '_blank', 'noopener')`.

## Incidenty a fixy během sprintu

1. **`React is not defined` na produkci (všechny shared prezentace).** Pod `classic` runtime emituje JSX `React.createElement` proti volnému identifikátoru; bundler tree-shaknul nepoužitý `import { React }` → crash jen v prod buildu (dev čistý). Fix: explicitní `React.use*` volání drží binding. Zdokumentováno v README jako povinná konvence.
2. **Nested standalone output.** Next 16.4.3 zanořuje `server.js` do `.next/standalone/website-v2.9/` kvůli workspace inference z `apps/` lockfilu — systemd čeká naplocho. Fixováno v deploy skriptu (detekce obou layoutů), ne configem.
3. **Deploy vs dev server kolize.** Běžící `next dev` mutuje `.next/` pod rsync → vanishing files / prázdný obsah. Pravidlo: zabít dev před deployem.
4. **`127.0.0.1` vs `localhost` u dev origins** — screenshot tooling musí na `localhost`, jinak se klient nehydratuje.

## Výkon a a11y

- DPR clamp `[1, 1.5]` na všech 24 canvasech; instancing opakovaných meshes (palmy, vlajky, markery); stíny 2 Hz místo per-frame.
- Reduced-motion: `motionTime`/`motionDelta` freeze, autoRotate vypnutý — gate ve `ScenePresentation`.
- Hit targety na Zemi ⌀0.32 (trefitelné i při rotaci planety).

## Zbývající možnosti (ne blokery)

- Polish jednotlivých scén dle dalších předloh; `?sceneAudit=1` umožňuje měřit draw calls/triangles per scéna pro perf budget (N4 acceptance: load <3 s).
- Mobile UX další iterace (drawery, touch) dle potřeby.
- Širší instancing ve `NewEarth`/`OrbitalWorlds`/`StarGate` (původní perf backlog — viz summary vlákna).

## Mapování na plán

- **N5 (L5):** prezentační vrstva kompletní; otevřené zůstávají pilot, proof-of-impact, E2E grant (👤/🔀).
- **N4 (OASIS):** sdílená 3D pipeline + sceneAudit nástroj = základ pro perf/a11y gate (`OasisChecklist.md` vzor).
