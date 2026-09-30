# WebOasis — GPUweb (WebGPU) Preview Architektura

> **Vrstva:** L4 OASIS · **Track:** V3.3 „Nirvana" **N4** (L4 OASIS UE 5.7 & Web Preview)
> **Status tohoto dokumentu:** návrh architektury + první implementační kroky.
> **Zdroje pravdy:** [`V33_NIRVANA_MASTER_PLAN.md`](./V33_NIRVANA_MASTER_PLAN.md) §5 a §9, [`docs/WP-Mainet/MiseAmenti/03-Zivy-Zaklad-3.3.md`](./docs/WP-Mainet/MiseAmenti/03-Zivy-Zaklad-3.3.md) §6 L4, [`docs/WP-Mainet/MiseAmenti/04-Exekucni-Charta-3.3.md`](./docs/WP-Mainet/MiseAmenti/04-Exekucni-Charta-3.3.md) M4 + gate R6.
> **Label discipline (canon):** ŽIVÉ = nasazené/ověřené; STAVBA = kód existuje, produkce/důkaz částečný; HORIZONT = legitimní směr bez nároku na dnešek.

---

## 1. Kontext a cíl

V3.3 §5.2 definuje pro L4 tři dodávky:

1. **Okamžitý Web Preview bez instalace** na `oasis.zionterranova.com` — lehký WebGPU/WebAssembly renderovací klient pro mobil, tablet i desktop, bez stahování dat.
2. **Ultra-low latency Pixel Streaming** — plná UE 5.7 grafika streamovaná z GPU Edge uzlů přes WebRTC (HORIZONT — samostatný POC, ne součást tohoto dokumentu).
3. **Seamless Web-to-World bridge** — artefakt z Marketplace se otevře v 3D preview s nákupem přes ZIS.

Tento dokument specifikuje **první GPUweb preview**: architekturu, jak se stávající WebGL OASIS web stane duální WebGPU/WebGL2 aplikací, jaké jsou akceptační kritéria a jak se to skládá s už živými částmi (ZIS, katalog světů, backend API).

**Definition of Done (z V3.3 §9, bod 5):** „Web Preview v prohlížeči načte scénu Nové Země a avatara do 3 sekund; Pixel Streaming UE 5.7 funguje z GPU serveru." — první část je cílem tohoto tracku; pixel streaming zůstává HORIZONT do vlastního POC.

**M4 exit gate (charta):** přístupnost review, security review, měřitelný výkon na referenčních zařízeních, srozumitelná privacy politika. Žádné pay-to-win, žádná gamifikace duchovní autority.

---

## 2. Co je ŽIVÉ dnes (baseline 2026-09-30)

| Část | Stav | Poznámka |
|---|---|---|
| OASIS web | ŽIVÉ | `oasis.zionterranova.com` — Next.js 16 static export v `/var/www/oasis/`, R3F/Three.js WebGL galaxy (407+ světů v katalogu z API), Babylon.js stargate intro, mobilní/desktop flow ověřené E2E |
| OASIS backend | ŽIVÉ | `zion-v31-oasis` Rust/Axum na Edge `:8094`, nginx proxuje `/api/`, `/health`; světy/questy/player endpointy |
| ZIS auth v OASIS | ŽIVÉ | mnemonic → Ed25519 challenge → `zion_session` cookie přes same-origin proxy `/api/auth/*` |
| **Passkey login v OASIS** | STAVBA (tento commit) | WebAuthn endpointy nasazené na ZIS Edge (`/api/auth/webauthn/*`), origin `oasis.zionterranova.com` allowlistnut; ověřeno `POST /api/auth/webauthn/login/options` → 200. OASIS klient: `zis.ts` funkce + `AuthContext.loginWithPasskey`/`registerPasskey` + UI v Identity tab. Browser E2E s reálným autentikátorem pending |
| Adaptivní kvalita | ŽIVÉ | `PerformanceMonitor` → one-way degrade (bloom/particles/MatrixCore off); `DirectRenderer` fallback pro manual-render mód |
| WebGPU renderer | HORIZONT → STAVBA (tento plán) | `three@0.169` obsahuje `three/webgpu` + TSL; `@babylonjs/core@9.19` obsahuje `WebGPUEngine` — obě cesty možné bez nových enginů |
| UE 5.7 / Nanite / Lumen / MetaHuman / Pixel Streaming | HORIZONT | samostatný R&D POC podle M4.3; není součástí web klienta |

---

## 3. Architektura GPUweb preview

### 3.1 Princip: jedna scéna, dva render backendy

OASIS scéna je postavená v React Three Fiber — deklarativní scene graph (`OasisScene`, `GalaxyMap`, `World`, `WorldEnvironment`, …). Cílem **není** přepsání scény, ale přidání **renderer abstraction**:

```
┌─────────────────────────────────────────────────────────┐
│                    OasisClient (React)                   │
│   phase flow: intro → stargate → arrival → rite → scene  │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
     ┌─────────▼─────────┐   ┌────────▼────────────┐
     │  BabylonIntro      │   │   OasisScene (R3F)   │
     │  Engine backend:   │   │   Renderer backend:  │
     │  WebGPUEngine  →   │   │   WebGPURenderer →   │
     │  fallback Engine   │   │   fallback WebGL2    │
     │  (WebGL2)          │   │                      │
     └───────────────────┘   └──────────────────────┘
```

Detekce a fallback řetězec (vždy v tomto pořadí, nikdy bez fallbacku):

```
navigator.gpu?.requestAdapter() → adapter OK?
   ├─ ano → WebGPU backend (high perf tier)
   └─ ne  → WebGL2 backend (současný render, včetně reduceEffects/lowPower logiky)
```

Selhání inicializace WebGPU (driver crash, `requestAdapter` null, shader compile error) **vždy** degraduje na WebGL2 — canvas nesmí zůstatť černý. Pravidlo: před mountem WebGPU rendereru se provede sanity init v try/catch; při jakékoli chybě se loguje a nastaví `backend='webgl2'`.

### 3.2 R3F integrace — kde se backend vybírá

R3F `<Canvas>` akceptuje `gl` factory prop — vrátí custom renderer:

```tsx
// src/lib/gpuBackend.ts
export type GpuBackend = 'webgpu' | 'webgl2';

export async function detectGpuBackend(): Promise<GpuBackend> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) return 'webgl2';
  try {
    const adapter = await (navigator as Navigator & { gpu?: GPU }).gpu!.requestAdapter();
    return adapter ? 'webgpu' : 'webgl2';
  } catch {
    return 'webgl2';
  }
}
```

V `OasisScene` (desktop path):

```tsx
const [backend, setBackend] = useState<GpuBackend | null>(null);
useEffect(() => { detectGpuBackend().then(setBackend); }, []);
if (!backend) return null; // nebo skeleton — detection je ~ms

<Canvas
  gl={async (props) => {
    if (backend === 'webgpu') {
      const { WebGPURenderer } = await import('three/webgpu');
      const r = new WebGPURenderer({ canvas: props.canvas, antialias: true });
      await r.init();
      return r;
    }
    return new THREE.WebGLRenderer({ ... }); // současný path
  }}
>
```

Poznámky:
- `three/webgpu` je **dynamic import** — WebGPU bundel se stáhne jen na podporovaných zařízeních (kritické pro <3s budget a pro nepodporované prohlížeče).
- `WebGPURenderer.init()` je async — R3F `gl` prop akceptuje async factory.
- Canvas s jedním rendererem: WebGPU a WebGL2 nesmí sdílet jeden `<canvas>` kontext — proto backend detekce **před** mountem Canvas.

### 3.3 Postprocessing — největší technická změna

`@react-three/postprocessing` (EffectComposer/Bloom/Vignette) je **WebGL-only** — na `WebGPURenderer` nefunguje. Postprocessing stack se proto rozdělí:

| Efekt | WebGL2 path (dnešní) | WebGPU path |
|---|---|---|
| Bloom | `postprocessing` EffectComposer | TSL node bloom (`three/tsl` `bloom()` pass) nebo vypnutý v G1 |
| Vignette | Vignette pass | TSL color adjust / vypnutý |
| HueSaturation/BrightnessContrast | composer | TSL `colorAdjustment` nodes |

**Pragmatická volba pro G1 (první preview):** WebGPU backend startuje s `reduceEffects`-ekvivalentním pipe — bez composer efektů, pouze materiály + fog + světla. Bloom se přidá v G2 přes TSL, jakmile je render stabilní. Tím se vyhneme duálnímu portu celého postprocessing stacku v prvním kroku.

`DirectRenderer` (přidaný v předchozím kole) zůstává: u WebGPU backendu je `useFrame` manual-render stále potřeba — `WebGPURenderer` se volá přes `renderer.renderAsync(scene, camera)` nebo synchronní `render` v node-mode; konkrétní API se ověří v implementačním kroku G1.

### 3.4 BabylonIntro (stargate) — paralelní upgrade

Babylon scéna stargate je izolovaná (`BabylonIntro.tsx`, jediný canvas, žádný R3F). Babylon 9.19 má `WebGPUEngine`:

```ts
// dnešní: new Engine(canvas, true, opts)
// webgpu:  const engine = new WebGPUEngine(canvas, opts); await engine.initAsync();
```

Stejný fallback kontrakt: `WebGPUEngine` init v try/catch → při chybě `new Engine()` (WebGL2). GUI overlay (AdvancedDynamicTexture + DOM fallback tlačítko) zůstává identické — žádná změna flow.

### 3.5 Materiály a assety

- **Materiály:** Three.js `MeshStandardMaterial` funguje na `WebGPURenderer` přes TSL konverzi out-of-box (three mapuje klasické materiály na node graph). Netřeba přepisovat materiály v G1; TSL-native materiály (custom glow, atmosphere scattering) přijdou v G3.
- **Assety:** dnešní scéna je procedurální (žádné GLTF downloady). Pro avatar/marketplace preview se připraví pipeline: **Draco** geometry compression + **KTX2/Basis** textury + `<Suspense>` streaming. Statický export → assety v `/public/models/`, CDN-fronted přes nginx `brotili`+`gzip_static`.
- **Budget:** první paint scény ≤ 3 s na referenčním zařízení (M4 DoD). Měří se `performance.now()` od navigace po `onCreated` + první stabilní frame.

### 3.6 WASM složka (volitelná, později)

Plán V3.3 zmiňuje WebAssembly. Reálné použití v G3+: procedurální world-gen (terrain seeds, star catalogs) a fyzika částic v `wasm` modulu místo JS — ale **není** blocker pro preview; JS generování je dnes <50 ms.

---

## 4. ZIS & login — stav a doplnění (M1.5 → naplňuje R4/N1 DoD)

Implementováno v tomto commitu (`OasisWeb`):

- `src/lib/zis.ts` — passkey klient: `getPasskeyLoginOptions`, `verifyPasskeyLogin`, `getPasskeyRegistrationOptions`, `verifyPasskeyRegistration`, `listPasskeys`, `deletePasskey` (same-origin proxy `/api/auth/webauthn/*` → ZIS Edge).
- `src/contexts/AuthContext.tsx` — `loginWithPasskey()` (ceremony → `startAuthentication` → verify → `/me`) a `registerPasskey(label)` (`startRegistration` → verify). Passkey je sdílený přes `rpId: zionterranova.com` → stejný klíč funguje na app/market/dashboard/freeworld/oasis.
- `src/components/GamePanel.tsx` (IdentityTab) — „Sign in with Passkey" primární CTA když `browserSupportsWebAuthn()`; po přihlášení správa passkeys (list/add/remove). Mnemonic + generate flow zůstává jako fallback.
- Dependency: `@simplewebauthn/browser@13.3.0` (stejná verze jako website-v2.9).

**Ověřené:** `POST https://oasis.zionterranova.com/api/auth/webauthn/login/options` → `200 {ceremonyId, options{rpId:"zionterranova.com",…}}`. Ceremony TTL 5 min, rate-limit 10/min.

**Důsledek pro GPUweb:** avatar v preview se váže na ZIS identitu (primaryAddress → OASIS player přes `oasisPlayer` ve `ZisUser`). Žádné nové auth schéma pro GPU pipeline — session cookie jede same-origin.

---

## 5. Bezpečnost & privacy model (M4, R6)

| Oblast | Pravidlo |
|---|---|
| Renderer | WebGPU je sandboxed Web API; žádné `dangerous` flags, žádné `chrome://` požadavky. Adapter se žádá bez `powerPreference` force — OS rozhoduje |
| Telemetry | FPS/perf metriky pouze lokální (PerformanceMonitor už existuje); žádný beaconing 3. stranám. Pokud bude server-side telemetry, jen anonymní agregát za opt-in |
| Identity | `zion_session` httpOnly cookie; žádný localStorage token; WebAuthn = phishing-resistant (origin-bound) |
| Quest/rewards | žádný quest neodměňuje neověřený nebo škodlivý výkon (charta M4 pravidlo závislostí) |
| Monetizace | žádné pay-to-win, žádné „posvátné skiny" jako paid items; marketplace preview je read-only viewer + odkaz na market |
| Kulturní citlivost | indigenní/L5 obsah (Uluru, LUMI) nese „vision/preparation" status — žádné falešné „active site" claims |

---

## 6. Výkonnostní budget & měření

| Metrika | Cíl (preview MVP) | Jak se měří |
|---|---|---|
| Čas do interaktivní galaxie | ≤ 3 s (referenční desktop, fast 4G) | `performance.now()` → první stabilní frame po `scene` phase |
| Frame rate desktop | 60 fps @1440p, GPU tier mid | `PerformanceMonitor` running avg |
| Frame rate mobil | ≥ 30 fps, bez thermal throttling po 5 min | mobile smoke test |
| Bundle delta | ≤ +150 kB gzip navíc (WebGPU chunks lazy) | `next build` report |
| Fallback | 100 % zařízení bez WebGPU dostane WebGL2 bez chyby | E2E `navigator.gpu` mock-off test |

**Device tiers** (navazuje na existující `lowPower` detekci):
- T0: `webgpu` backend, full effects (G2 bloom)
- T1: `webgpu`, reduced effects / `webgl2` full
- T2: `webgl2` + `reduceEffects` (mobil, slabé CPU) — dnešní stav
- T3 (HORIZONT): pixel streaming pro zařízení, kde ani T2 nedrží 30 fps

---

## 7. Rollout plan — fáze G0…G3

### G0 — Příprava (hotovo v tomto commitu / běží)
- [x] Passkey login + Identity UI
- [x] `PerformanceMonitor` + `DirectRenderer` (manual-render-safe pipeline)
- [x] Debug hooks `__oasisPhase/__oasisCamera/__oasisScene/__oasisGl`
- [ ] `detectGpuBackend()` + `window.__oasisBackend` debug flag

### G1 — Duální backend, scéna bez efektů (první WebGPU render)
- `OasisScene`: `gl` factory → `WebGPURenderer` (dynamic import) nebo WebGL2
- WebGPU path startuje bez EffectComposer (materiály/fog/světla only)
- `BabylonIntro`: `WebGPUEngine` s WebGL2 fallback
- Feature flag: `?gpu=webgpu|webgl2|auto` query override pro testy + `localStorage` persist
- **Akceptace:** na WebGPU zařízení scéna renderuje galaxii identicky vizuálně, camera flow intro→scene projde E2E; `?gpu=webgl2` = dnešní pixel-parity

### G2 — TSL efekty a stabilizace
- Bloom + atmosphere přes `three/tsl` nodes na WebGPU path
- Perf parity test: WebGPU ≥ WebGL2 na referenčních GPU (M-series, RTX, iGPU)
- Mobile WebGPU (Chrome Android / Safari 26) — rozhodnout zapnutí podle telemetry

### G3 — Asset & bridge track
- Draco/KTX2 pipeline + avatar/artifact preview viewer (Marketplace bridge)
- WASM world-gen modul (pokud profiling ukáže potřebu)
- Dokumentace API contract (`/api` versioning) před dalším rozšiřováním

### HORIZONT (mimo tento plán)
- UE 5.7 POC + WebRTC Pixel Streaming (M4.3) — vlastní feasibility dokument, GPU Edge node provisioning
- MetaHuman avatary, Nanite/Lumen — nikdy neslíbit před POC důkazem

---

## 8. Testování & verifikace

- **E2E (Playwright, `channel: 'chrome'`):** intro → stargate → rite → scene; menu/search/panel; world enter/return; `__oasisBackend` assert per flag.
- **Fallback test:** spustit s `Object.defineProperty(navigator,'gpu',{value:undefined})` → musí projet celý flow na WebGL2.
- **Device matrix:** macOS (Chrome/Safari 26), Windows (Chrome), Android (Chrome), iOS (Safari 26+). Výsledek = tabulka backend/fps/load-time do `docs/` reportu.
- **Build gate:** `npm run build` čistý; WebGPU chunk nesmí být v main bundlu (kontrola přes bundle report).

---

## 9. Rizika a otevřené otázky

| Riziko | Mitigace |
|---|---|
| `WebGPURenderer` API drift mezi three minor verzemi | pin `three@0.169` až do G2; upgrade samostatně s render-diff testem |
| `@react-three/postprocessing` nefunguje na WebGPU | G1 bez efektů; G2 TSL náhrada; nikdy nemíchat oba composery na jednom canvasu |
| Safari WebGPU preview chování | za feature-flagem do device-matrix výsledků; mobil default zůstává WebGL2 |
| Drei helpers (`Stars`, `Environment`, `OrbitControls`) interně WebGL-závislé | per-component try/`R3FErrorBoundary` (už existuje); při incompatibilitě nahradit TSL ekvivalentem nebo vypnout na webgpu path |
| WebGPU shader compile stutter při prvním framu | `renderer.init()` + warmup render offscreen před zobrazením; loading skeleton během init |

**Otevřené otázky:** (a) držet Babylon stargate dlouhodobě, nebo přepsat na R3F/WebGPU scénu (jednotný stack)? (b) pixel-streaming provisioning — Edge nemá GPU; potřeba dedikovaného GPU uzlu nebo cloud GPU? (c) multiplayer presence v preview — scope až po G3.

---

## 10. Mapa souborů

| Soubor | Role |
|---|---|
| `APP&WEB/OasisWeb/src/components/OasisScene.tsx` | R3F scéna — sem přijde `gl` factory + backend výběr |
| `APP&WEB/OasisWeb/src/lib/gpuBackend.ts` | **(nový, G1)** detekce + flag resolve |
| `APP&WEB/OasisWeb/src/components/BabylonIntro.tsx` | stargate — `WebGPUEngine` fallback chain |
| `APP&WEB/OasisWeb/src/lib/zis.ts` | ZIS klient vč. WebAuthn (hotovo) |
| `APP&WEB/OasisWeb/src/contexts/AuthContext.tsx` | `loginWithPasskey`/`registerPasskey` (hotovo) |
| `APP&WEB/OasisWeb/deploy/nginx-oasis.conf` | `/api/auth/*` proxy → ZIS (živé) |
| `V31/L4/oasis` | Rust backend — stabilizovat `/api` contract před G3 |

---

*Vytvořeno 2026-09-30 pro track V3.3 N4. Aktualizovat při každém G-gate přechodu; při rozporu s live stavem platí `StatusV3.md` a ověřený kód.*
