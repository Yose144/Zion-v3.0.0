# OASIS Checklist — co je a co není (stav 2026-09-30)

> **Labels:** ✅ ŽIVÉ = nasazené na `oasis.zionterranova.com` a ověřené · 🚧 STAVBA = kód/plán existuje, důkaz chybí nebo je opt-in · 🔭 HORIZONT = cíl V3.3 bez nároku na dnešek
> **Důkazy:** `WebOasis.md` (GPU preview architektura) · `V31/STATUS.md` · `StatusV3.md` · E2E Playwright běhy (citováno níže)

---

## 1. Herní flow & UX

| Funkce | Stav | Poznámka / důkaz |
|---|---|---|
| Intro (warp) → stargate → arrival → rite → scene | ✅ | E2E ověřený desktop i mobil; `window.__oasisPhase` hook |
| Stargate threshold tlačítko | ✅ | Babylon GUI + DOM fallback + pointer-up fallback; na produkci ověřeno |
| Desktop rite (Warrior/Explorer/Sage/Trader) | ✅ | `__oasisPhase: rite → scene` |
| Mobile flow (arrival → rite → scene) | ✅ | mobil nově dostává Pilgrim Rite (archetype + loadout bonus); camera fix `[0,4,22]`, MobileTouchControls |
| Returning visitor (skip warp intro) | ✅ | `localStorage['oasis.visited']` → start na stargate; viditelné „Skip intro →" během intro fáze |
| Klávesové zkratky (M/Esc/H/F/1-3) | ✅ | ignorují input fokus |
| Search napříč ~408 světy | ✅ | name/location/tags, layer badge, discovery status |
| World panel (intel, lore, questy, CTA) | ✅ | sticky Enter/Return buttony |
| Hover labely nad galaxy node | ✅ | desktop; na mobilu jen vybraný |
| Discovery dimming + "New world discovered" toast | ✅ | toasty přesunuty nahoru doprostřed (nepřekrývají CTA) |
| In-world objectives (scan/harvest/relic nody) | ✅ | `WorldObjectives` — 5 (3 mobil) seeded nodů orbitujících svět; klik → XP/credits/lore toast; one-shot per `world:id` v `collectedNodes` (persist); velikost škáluje se světem |
| Flight mode (WASD, throttle 1/2/3, approach/land prompt) | 🚧 | UI živé; landing/quest logika nedotestována E2E |
| Quest progression vázaná na discovery | 🚧 | quest data z API žijí; herní smyčka neověřena |
| Zvuky / hudba v herní smyčce | 🚧 | AudioEngine/MusicPlayer existují; coverage neprověřená |

## 2. Světy & obsah (L1–L6)

| Obsah | Stav | Poznámka |
|---|---|---|
| Katalog 410 světů z OASIS API | ✅ | `GET /api/v1/oasis/worlds` — 410 po doplnění L5 |
| L5 Terra Nova uzly jako světy (8/8) | ✅ | všech 8 uzlů first-class světy v API katalogu: Genesis Garden, Dharma Temple, Te Pīko Ora, Golden Republic Bohemia, Bodhi Lanka, LUMI, **Uluru**, **María del Camino** (nově); klikatelné galaxy nody, full panel, live registry karta |
| L5 live Free World registry | ✅ | same-origin `/api/free-world/*` → `:8095` (nginx prefix map); `src/lib/l5.ts` — projects/grants/rounds/fund, flowers→ZION; panel: live status, budget, founding tranche (10M ZION × 6 komunit), L5 fund (17.44M ZION), QV pilot round |
| L5 Nova Zeme projekty (beacon markery + panel list) | ✅ | `novaZemeProjects.ts` — **11 bodů** (8 uzlů + Ekam[Built], Boa Esperança + Kailash[Vision]); Genesis Garden přesunuta do Sabacheira (Tomar), María del Camino = Tres Marias flotila; live merge z registry (nové id fallback na canon) |
| L6 Issobella orbitální stanice | ✅ | dedikované 3D env (rotating ring, sails, spires), DAO Parlament + Free World linky |
| On-chain persistence světů (L1 UTXO pozemky/artefakty) | 🔭 | canon V3.3 — kryptografické vázání pozemků není implementováno |
| Marketplace bridge (artefakt → 3D preview) | 🔭 | plán G3 v `WebOasis.md` |

## 3. Renderer (GPUweb preview — `WebOasis.md`)

| Část | Stav | Poznámka |
|---|---|---|
| WebGL2 path (default) | ✅ | R3F + EffectComposer (bloom/vignette/sat/contrast), pixel-parity zachována |
| `?gpu=webgpu` WebGPU preview | ✅ opt-in verified | `WebGPURenderer` (three 0.169) + `WebGPUEngine` (Babylon) s WebGL2 fallback; **produkce ověřena** — plná galaxie 402 světů, ~1 900 draw calls, 0 material chyb (hotfix `e69402151`: string-key node library registrace proti Turbopack minifikaci + `antialias:false` kvůli swapchain resolve validaci); `auto` → webgl2 do device-matrix potvrzení |
| TSL postfx (bloom + vignette) | ✅ preview | `gpu/WebGpuPostFX.tsx` |
| TSL porty shader komponent | ✅ | `TslStars` ✅, `TslAtmosphere` ✅, `TslVortex` ✅, `TslStreaks` ✅ (GalaxyCore — instanced quady, WebGPU nemá point size; fix `timerLocal()` callable) |
| FPS parita | 🚧 | headless Chrome ~25 fps oba backendy (limit prostředí); device matrix chybí |
| WebGPU vizuální parita (kosmetika) | 🚧 | hvězdy fixní 1 px body (žádný point size v WebGPU), listy/bloom vybělenější než WebGL2; wireframe aura podobně; ne blocker |
| Pixel Streaming z GPU Edge | 🔭 | UE 5.7 POC — samostatný track M4.3 |
| UE 5.7 / Nanite / Lumen / MetaHuman | 🔭 | není v repu — viz `WebOasis.md` §9 rizika |

## 4. ZIS identity & auth

| Funkce | Stav | Poznámka |
|---|---|---|
| Mnemonic login (Ed25519 challenge → `zion_session` cookie) | ✅ | same-origin proxy `/api/auth/*` → ZIS Edge |
| Passkey login + registrace + správa | ✅ | WebAuthn ceremony ověřená na produkci (`login/options` → 200); UI v Identity tab; rpId `zionterranova.com` sdílí klíč napříč weby |
| Logout + session expiry handling | ✅ | `AuthContext.logout`, 401 → signed-out stav |
| ZIS avatar v identitě | ✅ | `ZisAvatar` + `zisAvatarUrl` (`/api/auth/avatar/:seed.svg`) |
| Soulbound avatar ↔ L1 vazba | 🚧 | `oasisPlayer` pole v ZIS user existuje; on-chain vazba neověřená |
| Discovery/progress sync do profilu | ✅ | `POST /player/:addr/worlds/:id/discover` (rate-limit + `require_auth` jako scan/approach); klient pushuje first-discovery jen když ZIS-authenticated; `syncPlayer(trusted)` hydratuje `scanned:`/`approached:`/`discovered:` stats zpět — anonymní `pilgrim-0001` se nehydratuje (sdílený záznam by leakoval cizí progress) |

## 5. Performance & stabilita

| Funkce | Stav | Poznámka |
|---|---|---|
| Adaptive quality (PerformanceMonitor → one-way degrade) | ✅ | fps < ~40 % refresh → lehčí pipeline na zbytek session |
| `lowPower` detekce (cores/RAM/saveData/mobil) | ✅ | méně hvězd/částic, žádný bloom/MatrixCore |
| Galaxy node instancing | ✅ | Všech ~410 world bases → 2 instanced draw cally (sphere + ring, per-instance barva/discovered dimming); star systemy renderují jen extras přes `instancedBase`/`instancedRays`/`instancedGate`, selected = full node; hover = raycast-free overlay; **~1900 → ~100 draw calls desktop / ~81 mobil**, ověřeno na produkci (`452642167`) |
| Star extras instancing | ✅ | `InstancedBillboards` (billboard+UV rotace+pulse+per-instance color/scale/phase/opacity, 1 call) pro ~57 ray spritů + 10 distant galaxies (webgl2; webgpu padá na sprity); `InstancedGates` = 1 instanced torus pro všechny star gates (oba backendy), per-node gate+vortex jen na hover/selected |
| Nova Zeme beacon instancing | ✅ | 12 pioneer markerů (dot + halo) → 2 instanced draw cally, per-instance barva; DOM labely zachovány |
| Kodama instancing | ✅ | ~12 figurek × 5 meshů → 2 instanced draws (tělo + vertex-colored merged hlava s obličejem); rattle/sway v per-instance maticích |
| `DirectRenderer` (manual-render freeze fix) | ✅ | ověřeno `calls: 1→16` po vstupu do světa |
| R3F error boundaries | ✅ | per-component `R3FErrorBoundary` |
| WebGPU bundle laziness | ✅ | `three/tsl` chunk ~724K se stáhne jen při `?gpu=webgpu` |
| Server-side FPS telemetrie | 🔭 | opt-in agregát podle privacy modelu — neimplementováno |
| Load ≤ 3 s do interaktivní scény (V3.3 DoD) | 🚧 | neměřeno na referenčních zařízeních — device matrix task |

## 6. Infra & API

| Část | Stav | Poznámka |
|---|---|---|
| Static export → `/var/www/oasis` → nginx | ✅ | `rsync --delete` + `chown zion:zion`, curl 200 |
| Same-origin `/api/*` → `zion-v31-oasis` :8094 | ✅ | worlds/quests/player endpoints živé; `worlds.json` je `include_str!` → změny katalogu = rebuild binárky na Edge (`cargo build -p zion-oasis`, ~5 min) |
| Same-origin `/api/free-world/*` → `zion-v31-free-world` :8095 | ✅ | `/api/free-world/<p>` → `/api/v1/<p>` prefix rewrite v `nginx-oasis.conf` |
| `/api/auth/*` → ZIS Edge proxy | ✅ | passkey + session endpointy |
| API contract stabilizace (versioning, rate limits, ownership model) | 🚧 | M4.2 před G3 — viz `WebOasis.md` |
| Accessibility review + privacy policy (M4 exit gate) | 🚧 | gate před veřejným announcementem |

## 7. Dokumentace & repo

| Artefakt | Stav |
|---|---|
| `WebOasis.md` (GPU preview architektura) | ✅ aktuální po G2 hotfixi (vč. produkčního incident reportu) |
| `OasisChecklist.md` (tento soubor) | ✅ |
| E2E harness (Playwright + `channel:'chrome'`) | ✅ lokální skripty `/tmp` — zvážit přesun do `scripts/e2e` |

---

## Nejbližší otevřené úkoly (priorita)

1. **G2 resty:** `Environment` HDRI ověřit na WebGPU; mobile WebGPU device matrix → rozhodnout `auto` promoci; kosmetická parita (stars/leaves).
2. **Load-time budget:** měření navigace→scéna na referenčních zařízeních (DoD ≤ 3 s).
3. **Quest/landing smyčka E2E:** approach→land→quest completion flow test.
4. **API contract (M4.2):** versioning + rate limits + asset ownership model před G3.
5. **M4 exit gate:** accessibility review, security review, privacy policy, device-matrix perf report.
6. **G3:** Draco/KTX2 asset pipeline, Marketplace bridge viewer, WASM world-gen (dle profilingu).
7. **Objectives depth:** in-world nody jsou jednorázové collectibles — rozšířit na quest-vázané objekty, respawn/loot tabulky, L5-specifický obsah (registry úkoly).

*Aktualizovat při každém gate přechodu. Rozpor s live stavem řeší ověřený kód a `StatusV3.md`.*
