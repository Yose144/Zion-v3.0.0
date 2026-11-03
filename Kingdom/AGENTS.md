# AGENTS.md — pravidla pro práci v `Kingdom/`

> Krátký dokument. Architektura je v [`ARCHITECTURE.md`](ARCHITECTURE.md), posloupnost v [`PLAN.md`](PLAN.md). Tohle je jen to, co se nesmí porušit.

## Tvrdá pravidla

1. **Žádná databáze.** Žádné Prisma, žádné schema, žádné migrace. Data jdou přes `@zion/api` z existujících služeb.
2. **Žádné peníze ani klíče.** Stripe, Coinbase, L1 payout, treasury, admin klíče služeb — nikdy v tomto stromě, nikdy v prohlížeči.
3. **`V31/L1/core` se nedotýkáme.** Konsensus, emise, genesis, fee, crypto, `cosmic-harmony/**` jsou mimo dosah bez výslovného písemného schválení 👤.
4. **Jedna i18n.** Jen `@zion/i18n`. Žádný lokální `translations.ts`, žádný vlastní provider.
5. **Jeden token set.** Jen `@zion/ui`. Žádné lokální barevné `globals.css`.
6. **Jedna datová cesta.** Portál čte jen přes `reads[]` v manifestu → `core/api` → `@zion/api`. Přímý `fetch` na backend je chyba buildu.
7. **Jedna session.** `zion_session` drží hostitel okna. Portál si nikdy nedrží vlastní login.
8. **Doména světa je čistá.** `packages/world/src/domain/**` nesmí importovat `react`, `three`, `next`, `@react-three/*` a nesmí používat `window`, `document`, `fetch`, `Math.random`, `Date.now`, `performance.now`.
9. **Portál = nový adresář s manifestem.** Ne nová aplikace. Registry ho zvedne codegenem.
10. **Nemaž staré appky.** `apps/**` jsou dárci orgánů a živé služby. Zhasínají podle §3 v `PLAN.md`, ne podle dojmu.

## Kde co je

| Chci… | Jdu do |
|---|---|
| přidat povrch | `apps/kingdom/src/portals/<id>/manifest.ts` |
| přidat svět | `packages/scenes/` (adaptér) + `packages/world/src/domain/` (data) |
| přidat endpoint | `manifest.reads[]` + mapování v `apps/kingdom/src/core/api/` |
| změnit vzhled | `packages/ui/` |
| přeložit text | `packages/i18n/` |
| změnit kontrakt | `packages/contract/` (a pak `npm run codegen`) |

## Verifikace před commitem

```bash
npm run typecheck     # tsc --noEmit napříč workspace
npm run lint          # včetně zákazů výše
npm run codegen       # registry z manifestů
git diff --exit-code  # codegen nesmí nechat necommitnutý rozdíl
npm run build
```

Pro dokumentační změny stačí `git diff --check`.

## Pasti, které už známe

- **Chybí `Kingdom/node_modules` → `tsc: not found`.** `npm run codegen` a `npm run check` jsou čisté node skripty a projdou i bez závislostí, takže to vypadá jako rozbitý typecheck. Řešení: `npm ci` v `Kingdom/` (vlastní lockfile; do `apps/**` nesahá).
- **`npm run build` volá codegen.** Když v `canon/books/` leží rozepsaná kniha jiné session, dostane se i do buildu. Pro deploy bez cizího obsahu: `git checkout apps/kingdom/src/core/books/catalog.json` **a** `npm run build -w @zion/kingdom` (ne root `build`).

- **Next standalone v monorepu** zanoří app do `.next/standalone/<app>/` — `public/` a `static/` se musí stageovat vedle `server.js`, ne do rootu standalone. (Zděděno z `apps/nirvana/AGENTS.md`.)
- **Async texture v R3F:** materiál zkompilovaný s `map={undefined}` se po přiřazení textury nepřepne na `USE_MAP` → použít `key={tex ? 'tex' : 'flat'}`.
- **`DirectRenderer`:** `useFrame(cb, 1)`, jinak r3f rendruje dvakrát za frame.
- **WebGPU** je opt-in jen pro session; default WebGL2 (WebGPU cesta s klasickými materiály rendruje černo).
- **Deploy:** nikdy `rsync .next/standalone/` přímo do app rootu — smaže `src/` a přepíše produkční `.env` (incident 2026-10-30).
- **`next start` nefunguje s `output: standalone`** (v monorepu ani omylem). Použij `npm start` → `apps/kingdom/scripts/start-standalone.mjs`, který stageuje `.next/static` a `public/` vedle `server.js` v `.next/standalone/apps/kingdom/`.
- **Portál nesmí volat `fetch`.** `check-boundaries.mjs` to chytí. Data deklaruj v `manifest.reads[]` a přečti přes `api.read()`.
- **Nová stránka = nový portál.** Když přidáš adresář do `src/portals/`, spusť `npm run codegen`, jinak se v Místnosti neobjeví.

## Pasti z F2 (2026-11-01)

- **`useLoader` nemá `onLoad`** — třetí argument je `extensions`. `texture.colorSpace` nastav po načtení (`useMemo`).
- **Kamera v R3F nemá `lookAt`** — bez `CameraRig` (nebo `makeDefault` + ovládání) míří podle rotace, ne na počátek a planeta vypadne ze záběru.
- **Scéna je lazy** (`next/dynamic`, `ssr:false`) — three.js se nesmí objevit v bundlu Brány. Ověřuj: `/` nesmí mít `<canvas>` v HTML.
- **`manifest.ring` je měřítko světa, ne nirvany.** Drž orbitu r ≈ 2,5; `x: 12` je mimo záběr kamery.
- **Headless screenshot WebGL nefunguje** (prázdné plátno i když scéna běží). Ověřuj přes CDP: `Page.captureScreenshot` + `Runtime.evaluate` na `.k-scene canvas` (`hasGL`, `contextLost`, `width`/`height`).

## Pasti z F2b (2026-11-01)

- **Katalog světa ≠ komponenta světa.** Texty drž v `@zion/world` (`WORLD_CATALOG`), komponenty v `@zion/scenes` (`WORLDS`). Když serverová stránka sáhne na `@zion/scenes`, přitáhne si three do SSR.
- **`@genesis/runtime` je mrtvý alias.** Scény v `worlds/` importují `../runtime`, kit `../../runtime`. Nikdy nevracej alias zpět — v bundlu by vznikla druhá instance Reactu/R3F.
- **Scény si nesou vlastní `ScenePresentation`** (kamera, atmosféra, post, intro). `WorldStage` staví jen `<Canvas>` + `OrbitRig` + `XLighting`.
- **`OrbitRig` musí číst stav z kamery každý frame**, ne z vlastní absolutní proměnné — jinak se po intru (které kameru přesune) scéna snapne zpět.
- **Procedurální textury** (`kit/textures.ts`) generují 30–60 ms na povrch. Nikdy negeneruj povrch ve framu.

## Pasti z portu stargate (2026-11-01)

- **`--gate-offset-y` a `top: calc(50% + var(...))`**: při extrakci cizího CSS **neprefixuj `:root`**. `.k-stargate :root` nematchuje nikdy → proměnná chybí → `calc()` je neplatné → `top: auto` → absolutně pozicovaný prvek se posune o polovinu své výšky nahoru. Projevilo se to jako „brána je uříznutá". Definuj proměnné radši přímo na scope elementu (`.k-stargate`), ne na `:root`.
- **Po každém portu cizího CSS změř `getBoundingClientRect()`**, ne jen „vypadá to dobře na screenshotu". Rozdíl 369 px jsem na obrázku přehlédl, změřit ho bylo otázkou jedné věty.

## Pasti ze scény Místnosti (2026-11-03)

- **R3F `onClick` volá jen objekty z `initialHits`** — pointerdown musí trefit tentýž objekt. Drag skončící na markeru klik neodpálí „zadarmo" — `event.delta` hlídá jen drag, který *začal* na objektu. `page.mouse.click` v E2E delta=0.
- **Hit-sféry jdou „skrz" neinteraktivní geometrii.** Planeta bez handlerů raycast neblokuje → marker za horizontem reaguje. Neprůhledné těleso dostane `onPointerOver` se `stopPropagation`, aby zastiňovalo markery za ním.
- **Embed pás ≠ fullscreen svět.** Ve stránce, která scrolluje, `wheel` na plátně nesmí zoomovat — `OrbitRig` má `enableZoom: false`, jinak se scroll zasekne na scéně.
- **E2E proti rotující scéně:** markery autoRotatem plynou → sweep pozici znovu najdi těsně před klikem, jinak míjíš. A `router.push` na datový portál trvá **sekundy** (upstream timeout) — URL pollluj ~5 s, ne fixní wait.
- **Favicon:** `public/favicon.png` stačí na `<link>`, ale prohlížeč si bez deklarace žádá `/favicon.ico` → 404 v konzoli. `src/app/icon.png` (file convention) ji umlčí.

## Pasti z desktop-agenta v Kingdomu (2026-11-03)

- **`dialog.showErrorBox` je synchronní blocking modál.** Zamrzne celý main proces — heartbeat, IPC, DevTools — dokud user neklikne OK. S `mainWindow === null` (kingdom mód) je navíc neparentovaný a lehce se ztratí za okny. Nikdy ho nevolat z IPC start path — vrať `{success:false,error}` + `logErr` do `miner-output`.
- **Preload neběží v subframech.** Agent iframe (`/agent/index.html`) nedostane `electronAPI` z preloadu — shim v `index.html` ho přebírá z `window.parent` (same-origin). A `sandbox: false` na okně je nutný, jinak wrapper preload nemůže `require('./preload.js')`.
- **Klient sdílí `zion-desktop-agent` userData** (`app.setPath` před prvním `getPath`) — peněženky/`miner_config.json`/logy přejdou bez migrace. Pozor: `pkill` hlavního procesu nechává sirotka `server.js` (ELECTRON_RUN_AS_NODE) držet port — kill pattern `Kingdom/node_modules/electron` i `bundle/server.js`, a `Singleton*` symlinky můžou po tuhém killu blokovat další start.
- **`pgrep -f zion-miner` na macOS + `/proc/pid/exe`:** reaper stray minerů je Linux-centrický — readlinkSync na /proc na macOS hodí (chyta catch), ale čísluj to, jinak se větví podle platformy.
- **Miner `/metrics` nemapuje Trinity:** `zion_miner_hash_rate`/`shares_accepted` na :9116 drží 0, i když `V3 Trinity` loguje `share accepted` — dashboard ukazuje 0.00/0 při reálné těžbě. Upstream miner bug, ne integrace.
- **`start-mining` volá `saveConfig(config)`** — IPC test přepíše reálný `miner_config.json`. V testech čti+obnov config, nebo počítej se změnou.
- **`startMining()` bez configu** vrací `Wallet missing` — UI config skládá samo; IPC voláno prázdné nikdy nemine.
