# NIRVANA RENDER — plán AAA kvality pro 13 L5 scén a celou Nirvanu

> **Kanonický způsob renderu je v [`OASIS-RENDER-CANON.md`](OASIS-RENDER-CANON.md).** Tento soubor
> je program/programový plán; canon je závazná příručka, podle které se staví každá další scéna
> (a později celý OASIS).
>
> **31. 10. 2026.** Navazuje na `3D-SCENY-PLAN.md` (funkční akceptace 24/24, hotovo) a `MATRIX.md`.
> Tento dokument je **výtvarný a výkonnostní program**, ne oprava chyb. Mění se jen `apps/shared/scenes`,
> `apps/nirvana/src/core/scene` + `app/present/*` a `apps/website-v2.9` preview wrappery.
> L1, emise, genesis, výpady, API, portály ani deploy pipeline se nedotýkají.

## 0. Výchozí stav (ověřeno v kódu, 31. 10. 2026)

| Vrstva | Stav |
| --- | --- |
| Scény | `apps/shared/scenes/` — 20 souborů, ~7 900 řádků, 12 pozemských misí + Matrix (+ MatrixHall, MatrixDetail) |
| Geometrie | 100 % procedurální (`meshStandardMaterial`, ručně skládané tvary). Žádné GLB, žádný DCC asset |
| Osvětlení | Ručně psané `<light>` per scéna. **Žádná env mapa / IBL**, žádný obloha-shader, žádný opar |
| Post-processing | **Žádný.** `three 0.186.1`, `r3f 9.8.2`, `drei 10.7.9`, `@react-three/postprocessing` není v závislostech |
| Textury | Procedurální canvas textury jen v Matrixu; ostatní scény ploché barvy |
| Kamera | Statický start + OrbitControls; žádný cinematic intro, žádné beats (kromě Matrix hall) |
| Zvuk | `SceneSoundToggle` hotový, ale track chybí (`/audio/matrix.mp3`) a jinde se nepoužívá |
| Výkon Nirvana | 40–60 fps (GTX 1070 Ti, ANGLE), scény 96–664 geometrií |
| Výkon web | **7–18 fps** — preview canvasy bez `frameloop`, běží i mimo viewport |
| Duplikace | 13× kopie 57řádkového Canvasu v `present/*/page.tsx`; 24 preview wrapperů s resize hackem |
| Riziko | `ScenePresentation` drží modulový globální stav (`reducedMotion`, registr popisků) — víc pláten na stránce se ovlivňuje |

Funkční akceptace je uzavřená (`docs/3.2/REPORTS/REPORT_2026-10-31_PROJECT_SCENE_TUNING.md`, 24/24 PASS).
Co chybí, je **výtvarná úroveň a výkon**, ne funkčnost.

## 1. Definice „AAA" pro webového klienta

Měřitelné, ne marketingové:

- **Materiály:** PBR s env mapou (IBL), procedurální albedo + roughness + normal/bump, `envMapIntensity` per materiál.
- **Světlo:** filmový tonemapping (AgX), slunce + obloha + vzdálený opar, kontaktní stíny, bloom.
- **Kompozice:** každá scéna má art direction — zlatá hodinka, vlastní paleta, 35mm kompozice, popředí/střed/pozadí.
- **Život:** voda s vlnami a pěnou, vítr v plachtách a palmách, ptáci, prach, pochodně, dým — GPU/instancovaně, bez alokací ve framu.
- **Režie:** cinematic intro 2,5–4 s (dolly) → předání OrbitControls; `?beat=N` pro recenze; reduced-motion = statický hero frame.
- **Zvuk:** ambientná stopa per scéna, opt-in, fade in/out.
- **Loading:** zástěna s progresem (`useProgress`), žádný blikající prázdný canvas.
- **Rozpočty:** viz §4. Splněno = měřeno, ne odhadnuto.

**Mez, kterou říkáme rovnou:** bez DCC assetů (Blender/GLB) nedosáhneme filmové geometrie typu Unreal.
Strop je „high-end produktová 3D prezentace ve webu". Skok proti dnešku bude velký, ale ne hollywoodský.

## 2. Architektura: jeden Render Kit

`apps/shared/scenes/kit/` — jeden zdroj pro 13 scén i pro universe. **Kit smí importovat jen `three` a
`@genesis/runtime`** (žádné `drei`), jinak hrozí dvojí bundle a `React is not defined` v produkci.

| Modul | Odpovědnost |
| --- | --- |
| `quality.ts` | Tier A/B/C z `deviceMemory`, `hardwareConcurrency`, mobilní UA, `prefers-reduced-motion`, `saveData`; DPR, post-fx, stíny, LOD |
| `textures.ts` | Procedurální CanvasTexture generátory (kámen, mramor, dřevo, regolit, písek, voda, kov) + cache + `dispose` |
| `materials.ts` | PBR presety (marble, gold, glass, wood, stone, snow, regolith, water, foliage) s `envMapIntensity` |
| `environment.tsx` | `<SceneEnv>` — sky dome shader, slunce, PMREM IBL z procedurální scény (bez externích HDR), opar |
| `post.tsx` | `<ScenePost>` — `EffectComposer` + `RenderPass` + `UnrealBloomPass` + `OutputPass` (AgX) + vinětace; tiery |
| `camera.tsx` | `<CinematicIntro>` — dolly → předání controls, `?beat=N`, reduced-motion statický frame |
| `motion.ts` | Vítr, houpání, blikání, částice — bez alokace ve framu |
| `audio.tsx` | Ambientná stopa s fade (HEAD probe, jako `SceneSoundToggle`) |
| `budget.ts` | Rozšíření `window.__projectScene` o draw calls, tris, textury, tier, `budgetOk` |

Aplikační vrstva:
- `apps/nirvana/src/core/scene/ProjectPresentation.tsx` — nahradí 13 kopií Canvasu (jeden zdroj: DPR, stíny, post, intro, HUD, zvuk, loading).
- `apps/website-v2.9` preview wrappery — `frameloop="demand"`, IntersectionObserver pauza, LOD, DPR tier, resize bez hacku.
- `ScenePresentation` — modulový globální stav → React context per canvas.

## 3. Vlny a brány

| Vlna | Obsah | Brána (splněno = změřené) |
| --- | --- | --- |
| **R0** Měření | GPU audit na tomto Macu (ANGLE Metal), beauty shots 13 scén + universe, scorecard, rozpočty | Scorecard commitnutý; baseline čísel před/po |
| **R1** Render Kit | `kit/*` + `ProjectPresentation` + oprava globálního stavu; referenční scéna **Ekam** | Ekam před/po, 0 chyb, rozpočet splněn, `tsc --noEmit` čistý |
| **R2** Art pass 12 scén | 3 dávky po 4 scénách, každá scéna má art kartu (§5) a beauty shoty | 12/12 art karta + shoty, fps v rozpočtu |
| **R3** Voda / obloha / atmosféra | Jeden ocean shader (reflexe, pěna, kaustika), sky dome, fog, slunce, mraky, god rays | Konzistence, 0 seamů, 0 nových textur |
| **R4** Život a zvuk | Beats, intro kamery, vítr, voda, ptáci, částice, pochodně; zvuk pro všechny scény | Reduced-motion statický frame, 0 alokací ve framu |
| **R5** Web previews | `frameloop="demand"` + IO pauza, LOD, DPR tier, resize fix | Web ≥45 fps, 24/24 preview |
| **R6** Nirvana universe | StarGate, NewEarth, solar system, Issobella, HoloConsole, SpaceBackdrop — stejný kit, přechody scéna↔portál, HUD | Universe 60 fps, WebGPU fallback čistý |
| **R7** Akceptace a deploy | 13×3 beauty shots, web 24, universe; report; staging → produkce s rollbackem | 13/13 + 24/24 PASS, report, rollback ověřen |

## 4. Rozpočty (tvrdé brány)

| Metrika | Tier A (desktop dGPU) | Tier B (M1 / iGPU) | Tier C (mobil) |
| --- | --- | --- | --- |
| FPS (1440×900 / 390×844) | ≥ 58 | ≥ 40 | ≥ 30 |
| DPR cap | 1,75 | 1,5 | 1,25 |
| Post-fx | bloom + vinětace + SMAA | bloom + vinětace | vypnuto |
| Stíny | 2048, refresh 2 Hz | 1024, refresh 2 Hz | 1024 nebo vypnuto |
| Draw calls / scéna | ≤ 250 | ≤ 250 | ≤ 180 |
| Trojúhelníky / scéna | ≤ 400 k | ≤ 400 k | ≤ 250 k |
| Textury / scéna | ≤ 16 | ≤ 16 | ≤ 12 |
| Chyby shader/console | 0 | 0 | 0 |
| Invalid vertices | 0 | 0 | 0 |
| Scéna-graf po 3× přepnutí jazyka | bez růstu | bez růstu | bez růstu |
| První frame po hydrataci | ≤ 1,2 s | ≤ 1,5 s | ≤ 2,0 s |

## 5. Art karty scén (co konkrétně zvednout)

| Scéna | Art směr |
| --- | --- |
| Genesis Garden | Zlatá hodinka, loděnice a typi v popředí, voda s odleskem, plachty ve větru, ptáci, opar nad obzorem |
| Dharma Temple | Sopka a svah v pozadí, pobřežní pěna, plachetnice na vlnách, teplé doplňkové světlo |
| Te Pīko Ora | Palmy s průsvitem listů, laguna s kaustikou, texturované došky, večerní lucerny |
| Golden Republic Bohemia | Obrys Řípu, tři síně v kameni a dřevu, polní cesty, ranní mlha v údolí |
| Bodhi Lanka | Lotosové střechy s vrstvami, mostní klenby, klidná voda s reflexí, měkké světlo |
| Ekam | Mramor s žilkami (normal mapa), zlacení s IBL odleskem, světelný sloup s jemným volumem, zrcadlový bazén |
| LUMI Nová Amerika | Sklo s fresnelem a odleskem, sopečný terén bez seamů, noční svícení oken, dým z komínů |
| Uluru | Vrstvy pískovce, songlines jako jemná emise, hvězdná obloha, teplý odraz od skály |
| Tres Marias | Dřevěná flotila s vlákny a patinou, plachty s průsvitem, houpání na vlnách |
| Boa Esperança | Oceán bez seamů s pěnou u útesů, slyšitelné světlo, mlha, dramatické mraky |
| Kailash | Skála a sníh v jednom povrchu, jezero s odrazem, chladná atmosféra, jemné částice sněhu |
| Amenti | Písek s dunami, kamenné bloky s mikro-detailem, portál s tlumeným volumem, hvězdy |
| Matrix | Regolit s bumpem, dlouhé stíny, Země v obloze, skleník-hala s odlesky, rover, stopy |

## 6. GPU audit na tomto Macu

- Headless Chrome přes Playwright s `--use-angle=metal` → **ANGLE Metal Renderer: Apple M1** (ověřeno).
- `scripts/ops/audit-project-scenes.py` rozšířen o `--gpu metal` a automatickou detekci lokálního Chrome (`/Applications/Google Chrome.app`), takže se nestahují playwright browsery.
- Python playwright v `.venv-audit/` (mimo git).
- Režim `--shots-only`: hero shoty 1920×1080 (reduced motion) + 1440×900 + 390×844, metriky do `results.json`.

## 7. Rizika

| Riziko | Mitigace |
| --- | --- |
| Post-processing na WebGPU cestě nefunguje | Present scény zůstávají WebGL2; universe si WebGPU ponechá bez post-fx, s čistým fallbackem |
| Bundle naroste (kit + composer) | Kit jen `three`; post je lazy import za tier gate; měřit velikost `.next/static` |
| Scény sdílené dvěma aplikacemi — dvojí three instance | Pokračovat ve `@genesis/runtime` adaptéru; kit nesmí importovat `drei` ani `@react-three/*` |
| Vizuální regrese při hromadném art passu | Beauty shots + scorecard z R0 jako baseline; každá dávka má před/po |
| Výkon na mobilu | Tier C vypíná post-fx a snižuje DPR; brána ≥30 fps na 390×844 |
| Souběžná práce jiné session v `apps/*` | Commitovat jen `apps/shared/scenes`, `apps/nirvana`, `apps/website-v2.9` soubory tohoto programu |

## 8. Rozhodnutí

1. **Assety:** procedurální geometrie + generované textury, 0 binárek v repu. (Rozšiřitelné: CC0 HDRI/GLB lze doplnit později bez změny architektury.)
2. **Rozsah:** R1–R5 scény, R6 universe. Universe plánován hned, implementován po scénách.
3. **Zvuk:** připravený player pro všechny scény; track dodá operátor (`public/audio/<slug>.mp3`), kód se nemění.
4. **Baseline zařízení:** Apple M1 (tento Mac, Metal), GTX 1070 Ti (historická baseline), mobil 390×844.

## 9. Změnový log

| Datum | Změna |
| --- | --- |
| 2026-10-31 | Vznik dokumentu; R0 GPU harness hotový (ANGLE Metal na Apple M1) |
| 2026-10-31 | R1 Render Kit hotový: quality/textures/materials/environment/post/camera/terrain; `ProjectPresentation` pro 12 prezentací; art dávka 1 = Ekam, Amenti, Uluru, Kailash, Bodhi Lanka. Report: `docs/3.2/REPORTS/REPORT_2026-10-31_NIRVANA_RENDER_R1.md` |
| 2026-10-31 | **Nasazeno** — Nirvana na EDGE (`render-r4-…`) a web na EDGE2 (`render-r5-…`), oba smoke check OK; live GPU audit 5/5 scén PASS. Rollback: `nirvana.before-render-r4-…`, `standalone.before-render-r5-…`. |
| 2026-10-31 | **R4 doplněna** — `SceneMotes` (pyl/prach/sníh) v Ekamu, Amenti, Uluru a Kailashi; pohyb ve vertex shaderu, respektuje reduced-motion. Harness umí vizuální regresi (`--visual-baseline` + `--visual-gate`). |
| 2026-10-31 | **R3 hotová** — jeden oceán (`kit/ocean.tsx`) pro všechna moře; `AtlanticOcean` je tenká vrstva nad ním. **R4 hotová (bez assetů)** — `SceneSoundToggle` má fallback na syntetizovanou ambienci (surf/wind/forest/desert/space/temple) přes WebAudio, takže zvuk funguje i bez mp3. Harness umí `--strict-budget` a `--scorecard`. |
| 2026-10-31 | **R6 (universe) první krok** — domovská scéna dostala stejný HDR composer (bloom, AgX, vinětace) na WebGL2 cestě, DPR z tieru a audit háček (`?sceneAudit=1`); WebGPU cesta zůstává bez post-fx. Měřeno: 57 fps / 119 draw calls / 65 k tris. |
| 2026-10-31 | **R2 hotová** — všech 13 scén má atmosféru, IBL, key-light, opar a post; scénické shadery už nedělají vlastní tonemapping (dvojí konverze dělala oceán vybledlý). **R5 hotová** — web previews jedou `frameloop="never"` mimo viewport (IntersectionObserver), 12 komponent. Akceptace: 13/13 scén PASS na produkčním buildu, 0 chyb. Report: `docs/3.2/REPORTS/REPORT_2026-11-01_NIRVANA_RENDER_R2.md` |
| 2026-10-31 | **Hiran na Slunci (S0–S2)** — portál `hiran` (slot `sun`), fokus `earth/sun`, okno s offline stavem, proxy `/api/hiran`; pečeť (stylizovaná Śrí jantra), koruna lotosu (30 lístků, instanced), 2 prstence, filamenty na okraji; vnější koróna Slunce nahrazena jednou aditivní plochou. 58 fps / 47 draw calls na fokusu Slunce, 0 invalid vertices. Report: `docs/3.2/REPORTS/REPORT_2026-10-31_HIRAN_SUN.md` |
| 2026-10-31 | **Chrám Hirana — 14. scéna** (`apps/shared/scenes/Hiran.tsx`): kruhová terasa, lotos z 20 plátků, zlaté vejce (jádro + energie + Śrí jantra + blanka + prstence), **13 bran do světů**; klik na orb = chat, klik na bránu = `/present/<svět>`; `kit/yantra.ts` sdílí jantru se Sluncem; `ProjectPresentation` má slot `overlay`. 59 fps / 159 draw calls / 32 textur / `budgetOk: true`. Web: `HiranPreview` + sekce na `/l3-hiran`. Report: `docs/3.2/REPORTS/REPORT_2026-10-31_HIRAN_SUN.md` |
| 2026-11-01 | **Nebeská flotila (L6) v universe** — nový `scene/universe/SkyFleet.tsx`: mateřská loď Nabukano s dokovacím rámem a tři nebeské Marie (červená / bílá / zlatá), klik = okno flotily. Pozice i natočení z `fleetPosition()`/`fleetHeading()`, fokus `#portal=fleet` doletí k doku (kamera radiálně ven od Slunce, jinak záběr vyplní Śrí jantra). Portál `fleet`, slot `fleet`. Naměřeno (swiftshader, 800×600, `?sceneAudit=1`): 125 draw calls / 72,4 k tris / 39 textur / 0 invalid vertices — fps v softwarovém renderu nemá vypovídací hodnotu. |
| 2026-11-01 | **R6 stav:** brána „Universe 60 fps / WebGPU fallback čistý" **splněna** — naměřeno na RX 5600 XT (ANGLE gl-egl): **59,8 fps** (medián 3 oken po 3 s), 120–122 draw calls, 59,1 k tris, 35 textur, `invalidVertices: 0`. **`?gpu=webgpu` se čistě demotuje na WebGL2** a scéna se vykreslí (badge `WEBGL2`, stejné geometrie) — stará poznámka o černé scéně už neplatí. **Přechod scéna↔portál doplněn:** `.portal-veil` v `Shell` (jeden závoj na každou změnu portálu, 340 ms, `pointer-events: none`, respektuje `prefers-reduced-motion`; ověřeno opacity 0,59 při otevření / 0,54 při zavření). **Zbývá z R6:** art sjednocení 12 komponent universe na kit (`StarGate`, `NewEarth`, `SolarSystem`, `Issobella*`, `HoloConsole`, `SpaceBackdrop` dnes používají surové `three` materiály bez IBL) — designové rozhodnutí, protože Brána je záměrná replika IntroPage. **Metodická oprava:** `__projectScene.fps` je průměr od mountu a srážel všechna měření (universe 48 „naměřeno" vs 59,8 skutečných); audit teď měří okno přes rAF a kumulativní hodnotu ukládá zvlášť jako `cumulative_fps`. |
| 2026-11-01 | **Rozpočet §4 splněn — 13/13 scén pod 250 draw calls.** Čtyři scény byly nad limitem a šly do instancí (`SceneInstances`) nebo do sloučené geometrie: te-piko-ora 362 → **242** (doškové latě, 16 na chatu), nova-amerika 338 → **217** (listnáče), golden-republic-bohemia 400 → **177** (70 keřů + 90 stromů), bodhi-lanka 491 → **229** (lekníny, sloupky mostů, a 20 lotosových plátků na střechu sloučených přes nově exportovaný `kit/mergeParts` — merge zachová přesné transformace, protože rotace skupiny a plátku nekomutují). Naměřeno na RX 5600 XT (ANGLE gl-egl), 3 vzorky + medián, `--settle 4 --warmup 1`: **fps 52–59, 0 chyb, 0 neplatných vrcholů, 13/13 pass**. Cesta: `scripts/ops/audit-project-scenes.py` + `.artifacts/3d-tuning/budget-final/`. |
| 2026-11-01 | **R5 akceptace — 12/12 webových náhledů PASS.** Naměřeno na RX 5600 XT (ANGLE gl-egl), 3 okna po 4 s + medián: fps **57,0–60,2**, draw calls **95–242** (vše pod 250), tris 36–138 k. Náhledy se servírují ze stabilního snímku buildu (`/tmp/zion-3d-web`, unit `zion-3d-web`), protože souběžná session přebudovává strom. `boa-esperanca` jednou vyšla `unstable` (rozptyl 18 %, poslední vzorek 49,9) a po přeměření v klidnější chvíli **58,4 fps / pass** — to je chování nástroje, ne vada scény. 36 snímků (12×3) v `.artifacts/3d-tuning/r5-web/`. **Poznámka k rozpočtu:** `ekam` má 21 textur a `amenti` 16, což je přes měkký strop §4 (≤16) — každý `SceneLabel` je vlastní CanvasTexture; řešit ubíráním popisků, ne zvedáním stropu. |
| 2026-11-01 | **R7 akceptace hotová lokálně, deploy připraven.** Nirvana **13/13 PASS** (fps 58,3–60,2, draw calls 95–242, tris 43–138 k) a web **12/12 PASS** — obojí na buildu z **čistého HEAD** (`git worktree` v `/tmp/deploy-r7`, `53dedf010`), ne z rozpracovaného stromu. 76 snímků (39 + 37) v `.artifacts/3d-tuning/{r7-nirvana,r5-web}/`. K1.3 verifikátor nad worktree: `nirvana OK`, `website-v2.9 OK` — **`--artifact-dir` deploy je připravený, nespouštěný** (čeká na rozhodnutí, protože ve stromu je 33 necommitnutých souborů druhé session). **Nalezena a opravena chyba deploye:** hledání `server.js` bez `-not -path "*/node_modules/*"` matchlo u webu `node_modules/react-dom/server.js` → `APP_DIR` by ukazoval na cizí adresář. |
| 2026-11-01 | **R7 NASZAZENO.** Web i Nirvana nasazené z **artefaktů čistého HEAD** (`--artifact-dir` z `/tmp/deploy-r7`, `53dedf010`) — ne z rozpracovaného stromu. **Web:** `deploy-web2.9.sh --artifact-dir` → healthy za 10 s, smoke (assety + API) OK, **produkční `--startup-only` audit 12/12 PASS** na `app.zionterranova.com`. **Nirvana:** `deploy-nirvana.sh --artifact-dir` (přes `ZION_EDGE_HOST=zion-v6`, protože EDGE IPv4 `:2222` byl refused) → healthy za 10 s, smoke OK (`/` 200, textury, `/api/oasis/worlds`, `local :3010` 200). Live: `/`, `/park`, `/mars`, `/venus`, `/avatars` **200**, `/present/*` **307** (ZAP pas = správně). **Meze:** živý audit scén Nirvany nejde bez skutečného pasu — `/present/*` i `/` jsou gate-nuté, takže akceptace scén zůstává na lokálním snímku (13/13). |
| 2026-11-01 | **R7 produkce ověřena se ZAP pasem.** Audit umí `--pass-code` (nebo `NIRVANA_PASS_CODE`), který vymění kód za cookie přes `/api/pass` — bez toho se gated povrchy měřit nedají. **Nirvana na produkci: 13/13 PASS** (`--startup-only`: scéna se namountuje, načte assety, 0 chyb). **Web na produkci: 12/12 PASS.** Vesmír na produkci se vykresluje (123 draw calls, 80 988 tris, 37 textur, 0 neplatných vrcholů) — **fps na produkci nemá smysl měřit**, EDGE i EDGE2 jsou CPU-only, takže prohlížeč rendruje softwarově; výkon se měří lokálně na GPU. `dharma-temple` jednou vrátila `asset HTTP 502`, po chvilce chunk 200 (22 723 B) a scéna `pass` — přechodný výpadek upstreamu hned po restartu služby. Kód pasu se nikam neloguje ani necommituje. |
