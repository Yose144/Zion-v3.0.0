# ENGINE-WEB — výběr scénového enginu pro Království (v3.3)

> Rozhodovací dokument. Stav rešerše: **říjen 2026** (ověřené online zdroje).
> Vztah: `NIRVANA-V3.3-UNIFICATION.md` §1b definuje prostorový model
> (orbit → Nová Země → prstenec L6 → brána → OASIS). Tohle je výběr motoru,
> který ho pojede. `ENGINE-SRDCE.md` = strojovna u těžaře (zion-compute) —
> jiný problém, tohle ho neřeší.

**Status:** rozhodnuto k implementaci v K1 · 👤 sign-off pro případný pivot na PlayCanvas

---

## 1. Co jsme měřili / ověřili (data, ne marketing)

### WebGPU — už je všude, ale XR nečeká
- Shipped: Chrome/Edge 113+, **Firefox 141** (Win) / 145+ (macOS), **Safari 26** (macOS, iOS, **visionOS**). Globálně ~88 %.
- web.dev 25. 11. 2025: „WebGPU is now supported in major browsers" — oficiálně baseline trajektorie.
- **Ale:** WebGPU-XR (`XRGPUBinding`) je **experimentální všude**. Chrome ho neexpozuje → *XR session dnes běží přes WebGL2 backend.* Babylon i PlayCanvas dokumentace to říkají explicitně.

### Benchmark 6 enginů (driftengine.dev, 11. 10. 2026, RX 9070 XT + Adreno 740)
Draw-call-bound scéna, max objektů @60 fps:

| Engine | WebGPU | WebGL2 | Pozn. |
|---|---|---|---|
| three.js r186 | **2 688** | **9 472** | WebGPU backend ~3,5× pomalejší než vlastní WebGL2 |
| Babylon 9.30 | 1 792 | 2 688 | totéž |
| PlayCanvas 2.23 | ~mezi | ~mezi | stabilní oba backendy |
| DriftEngine (proprietary) | 7 168 | 7 424 | jediný s paritou |
| Godot 4.7.2 | — | jen WebGL2 | WebGPU export neexistuje |
| Bevy 0.20 | funguje | funguje | viz níže |

**Závěr z měření:** WebGPU ≠ rychlejší rendering. Vyhrává na compute shaderu a budoucích featurách; pro draw-cally drží WebGL2 ještě roky. → **Dual-backend architektura je povinnost, ne luxus.**

### WebXR — kde opravdu běží (ověřeno 8. 10. 2026)
| Cíl | VR | Pozn. |
|---|---|---|
| **Meta Quest Browser** (2/3/3S/Pro) | ✅ | nejúplnější: hands 25 joints, AR passthrough |
| **visionOS Safari** (Vision Pro) | ✅ default-on | look+pinch |
| Chrome na Android XR (Galaxy XR) | ✅ | hand-first |
| PICO Browser, Wolvic | ✅ | |
| PCVR přes Chrome/Edge + OpenXR | ✅ | |
| iPhone/iPad Safari | ❌ | nic |
| Firefox | ❌ | WebXR odstraněn, nevrátil se |

**Dostupné publikum VR = Quest + Vision Pro + PICO + Android XR + PCVR.** Desktop/mobil = 2D režim téhož grafu.

---

## 2. Kandidáti — hodnocení proti našemu modelu

Potřeby: React/Next shell, DOM panely = pracovní plocha, scéna = navigace (orbit→planet→descend), XR jako první povrch, WebGPU+WebGL2, živá data pulzující ve scéně.

### three.js r18x + R3F ⭐ doporučeno
- **+** Ekosystém 12M stažení/týden = 39× Babylon, 215× PlayCanvas. Všechno ostatní v npm je built for three.
- **+** `@react-three/xr` 6.6 (říjen 2026) — XRStore: hands, gaze, controllers, emulate=metaQuest3, foveation, frameBufferScaling.
- **+** `@pmndrs/uikit` / `@react-three/uikit` — **DOM-like UI panely přímo ve 3D scéně i ve VR** (Yoga layout, Container/Text/Image/Video, inputy, scroll). To je přesně „okna v okně světa" z §1b — nebudeme psát mesh-text sami.
- **+** TSL = jeden shader jazyk → transpiluje WGSL i GLSL; WebGPURenderer s WebGL2 fallbackem = dual backend zdarma.
- **+** Meta IWSDK běží na three.js (případný Quest-first polish později bez změny enginu).
- **−** WebGPURenderer pořád „experimental" v docs, rychle se mění; WebGL2 prokazatelně rychlejší na draw-calls. *Mitigace: výchozí backend = WebGL2, WebGPU = opt-in upgrade path; jen TSL materiály (ShaderMaterial nefunguje).*

### Babylon.js 8/9 — nejsilnější alternativa
- **+** Plný engine: nativní WGSL core (8.0), nejlepší WebXR feature set (layers, depth sensing, hands), Havok physics, audio, GUI3D, Inspector.
- **−** 1,8 MB gzip; imperativní styl = React obal vlastní; WebGPU zatím pomalejší než jeho WebGL2; náklady integrace s Next.js panelem-ux vyšší.
- Hodí se, kdyby produkt = „hra". Náš produkt = „živé prostředí + DOM práce" — převaha three.

### PlayCanvas Engine 2.x — seriózní záloha
- **+** Engine-grade: first-class Gaussian splats (!), ammo.js fyzika, positional audio, hotové XR scripty (session/controllers/navigation/menu), 615 kB, glTF+Draco+Basis pipeline, MIT.
- **+** Docs úprimné: XR stránkám dej WebGL2 backend — přesně náš dual-backend model.
- **−** Menší ekosystém, non-React (embed přes canvas modul — OK), editor cloud-based (nepotřebujeme).
- **Plán B:** kdyby three.js WebGPU cesta narazila, PlayCanvas je drop-in kandidát — scene kód proto držet za `core/scene/` boundary.

### Zamítnuté
| Engine | Proč ne |
|---|---|
| **Orillusion** | WebGPU-pure, krásný RenderGraph + RTE pro planet-scale — ale 129 downloads/týden, „Beta, NOT for commercial" vlastním popisem. Příliš rizikové. |
| **Bevy 0.20** | Výborný engine, ale web target má desítky otevřených bugů (shader/texture errory na Dawn, `bevy_tasks` na webu nefunguje), WASM bundle těžký, XR na webu ~nic. Pro nativní zion-compute možná, pro shell ne. |
| **Godot 4.7 web** | WebGPU export neexistuje, jen WebGL2. |
| **Unity 6.6 Web** | WebGPU už out-of-experimental, ale build desítky MB WASM + JS bridge overhead; špatný fit pro React/DOM-panel architekturu. |
| **Unreal (SimplyStream)** | Komerní SDK 3. strany, vendor lock, předimenzované. |
| **DriftEngine** | Nejrychlejší v benchmarku, ale proprietární/licencovaný. |

---

## 3. Rozhodnutí

```text
Next.js 16 (shell, routing, BFF proxy, DOM UI)   ← stačí, NEMĚNIT
  └── core/scene/ = three.js r18x + R3F
        ├── renderer: WebGPURenderer (WebGPU → WebGL2 auto-fallback)
        │     ⚠️ XR session → WebGL2 backend (XRGPUBinding není venku)
        │     ⚠️ materiály jen TSL — ShaderMaterial/onBeforeCompile zakázáno
        ├── XR: @react-three/xr 6.6 (Quest primary, visionOS secondary)
        ├── in-world UI: @react-three/uikit (panely = stejné data jako DOM okna)
        └── assets: glTF + KTX2/Basis + Draco, LOD + instancing
```

**Proč ne přejít na jiný engine:** výměna rendereru by nic nezrychlila (Babylon/PlayCanvas WebGPU jsou v měření stejně nebo hůř) a ztratili bychom React integraci, uikit a ekosystém. Úzké hrdlo nebude engine, ale **scene architektura + asset pipeline**.

**Kde three.js nestačí později:** pixel-perfect AAA vizuál → tehdy pixel-stream nebo PlayCanvas pivot; scene kód držet za `core/scene/` boundary = engine swap za ~1 sprint, ne rewrite.

---

## 4. Architektura scény (K1 implementační tvar)

```text
apps/nirvana/src/
└── core/scene/
    ├── SceneRoot.tsx        — Canvas + renderer policy (backend resolve + xr switch)
    ├── backends.ts          — resolveGpuBackend(): webgpu|webgl2 (XR → vždy webgl2)
    ├── universe/
    │   ├── OrbitView.tsx    — kamera loď, hvězdné pole
    │   ├── NewEarth.tsx     — planeta: glTF + atmosféra; povrch = L5 kontinenty
    │   ├── IssobellaRing.tsx— prstence L6: stanice = issolabella povrchy (dnešní torusy → stanice)
    │   ├── Gate.tsx         — Brána: portal objekt, approach→enter
    │   ├── Descend.tsx      — sestup: transition orbit→povrch→OASIS
    │   └── dataPulse/       — živá data→vizuál: hashrate→kovárna, tracker→prstenec, L5→světla
    ├── ui3d/                — @react-three/uikit wrap: PortalPanel (in-world okno)
    └── xr/                  — XRStore, hands/gaze/controller, fallback 2D
```

**Renderer politika (tvrdá pravidla):**
1. `resolveGpuBackend()` — 1 místo rozhodnutí. XR session požadavek → force `webgl2`.
2. Žádné `ShaderMaterial`/`onBeforeCompile`/`EffectComposer` — jen TSL node materiály + nový post-processing stack (jinak WebGPU cesta umře).
3. Jedna scéna = jeden renderer; WebGPU→WebGL swap = remount (stejně jako dnes `demoteToWebGL`).
4. Performnce cíl: orbit 60 fps na iGPU / 72+90 fps Quest režim — instancing + LOD + KTX2 od začátku, ne až na konec.

**Živá data ve scéně (`dataPulse/`):** ta samá BFF API jako portály (`/api/pool/*` → kovárna, `/api/chain/stats` → maják, issolabella tracker → prstenec, `/api/harbor`+L5 → povrchová světla). Scéna nemá vlastní zdroj dat — čte portal kontrakt.

---

## 5. Fáze / odklad

| Nyní (K1–K3) | Později (HORIZONT) |
|---|---|
| orbit→planet→gate→descend graf | multiplayer/presence (Colyseus/LiveKit — až social layer) |
| XR entry + uikit panely | Rapier physics ve workeru + SharedArrayBuffer (interakce s terénem) |
| WebGPU opt-in + WebGL2 default | WebGPU compute ve web workeru = **Care lane v prohlížeči** (zion-compute synergy! WGSL compute joby) |
| glTF/KTX2/Draco asset pipeline | Gaussian splat světy (Spark/PlayCanvas splats — nativní světy z fotek) |
| 2D fallback = stejný graf | pixel-stream z edge GPU (ENGINE-SRDCE HORIZONT) |

---

## 6. Zdroje (k ověření)

- web.dev „WebGPU is now supported in major browsers" (25. 11. 2025); caniuse webgpu
- gpuweb/gpuweb Implementation-Status wiki (Firefox 141/145/147 roadmapa)
- driftengine.dev „Six 3D engines measured" (11. 10. 2026) — benchmark tabulka
- threejs.org WebGPURenderer manual (experimental caveats), Migration Guide r180→181
- Babylon docs: WebGPU status + „WebGPU in WebXR" (XRGPUBinding experimental)
- PlayCanvas docs: XR web-components — „give any page that offers XR a WebGL 2 backend"
- npm: @react-three/xr 6.6.32, @pmndrs/uikit 1.0.77 (říjen 2026)
- threejsresources.com/webxr/browsers (5. 9. 2026), sparksbud WebXR browsers (8. 10. 2026)
- Unity Discussions: „WebGPU out of experimental in Unity 6.6"; Orillusion repo status #471
