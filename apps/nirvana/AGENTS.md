<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Poznatky z ladění scény (2026-10-30)

- **Async texture `map` gotcha:** materiál zkompilovaný s `map={undefined}` už se po přiřazení textury nepřepne na `USE_MAP` — mesh rendruje jen `color`. Fix použitý napříč scénou: `key={tex ? 'tex' : 'flat'}` na materiálu (remount → recompile). Platí pro `SkySphere`, `Sun`, `Planet`, `Moon`, Saturnov prstenec.
- **Sky sphere:** `SpaceBackdrop.tsx` používá reálné ESO all-sky panorama `public/textures/milkyway-eso-4k.jpg` (Serge Brunier 360°, CC BY 4.0, zdroj `cdn.eso.org/images/large/eso0932a.jpg`), `side={THREE.BackSide}`, poloměr 1750, rotace skupiny `[GT_X, 0, GT_Z]` klopí galaktický pás.
- **GPU backend:** `?gpu=webgpu` je opt-in jen pro session (neukládá se); `localStorage['nirvana.gpu']='webgpu'` se ignoruje — WebGPU cesta rendruje černou scénu s klasickými materiály. Default = WebGL2.
- **Vizuální verifikace:** headless Chromium přes Python Playwright (`executable_path` z `~/.cache/ms-playwright/chromium-*` — pip playwright očekává jinou verzi než nainstalovanou), `wait_until='networkidle'` + ~9 s na načtení textur; `page.mouse.wheel`/`drag` ovládá OrbitControls.
- **HMR přes preview proxy:** `next.config.ts` potřebuje `allowedDevOrigins: ['127.0.0.1']` (jinak ws://…/_next/hmr refused).
- **Deploy LIVE (2026-10-30):** `https://nirvana.zionterranova.com` — EDGE (`zion-new` 62.171.141.136, DNS už ukazoval tam). `zion-nirvana.service` na `127.0.0.1:3010` (User=zion, `OASIS_API_URL=http://127.0.0.1:8094` — OASIS backend je na stejném stroji). Nginx vhost `infra/nginx/edge-current/nirvana.zionterranova.com.conf`, cert přes `certbot --nginx`. Deploy: `bash apps/nirvana/deploy/deploy-nirvana.sh` — standalone build si v monorepu zanoří app do `.next/standalone/nirvana/` (public+static se musí stageovat vedle server.js, ne do standalone rootu!).
- **Perf pass 2026-10-30:** (a) `DirectRenderer` musí mít `useFrame(cb, 1)` — priority ≤0 = r3f rendruje sám → **dvojí render/frame**. (b) Opakující se meshe → `instancedMesh` (`args={[undefined, undefined, n]}`, matice v `useLayoutEffect`, `frustumCulled={false}` — bounding sphere geometrie nekryje rozptýl instancí). Klik přes `e.instanceId`, barvy přes `setColorAt` + `instanceColor.needsUpdate`. Aplikováno na surface markery (103→2), orbit picked, ring stanice, BrightStars (36→3), chevrony/glyphs/lotus/pařáty, station domes/spokes/waters. (c) `dpr={[1, 1.75]}` na Canvas. (d) CPU vertex animace → precomputed polární souřadnice (Horizon).
