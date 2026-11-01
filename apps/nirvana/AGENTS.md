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

## Hiran na Slunci (2026-10-31)

- **Kamera a fokus:** `Universe` má `focus: 'earth' | 'sun'`. Fokus nesmí jen tak
  přepsat `controls.target` — odlet je interpolace (`fromCam`/`fromTarget` se zamrazí
  při změně, `progress` 0→1, ease-out) a po přeletu se target drží na Slunci.
  V režimu `earth` se target **každý frame** vrací na Zemi (původní chování).
- **Pečeť, ne vnitřek:** fotosféra je neprůhledná → Śrí jantra je plocha před diskem
  (`~1,04 R`), `lookAt(camera)` + pomalá rotace kolem vlastní osy. Kdyby zůstala
  ve středu, není vidět vůbec.
- **Lotos na kouli:** divák stojí v rovině ekliptiky, takže prstenec lístků v rovině
  je z boku vidět jako hroty. Tři věnce na kouli (12/10/8) s `setFromUnitVectors(up, dir)`
  čtou z každého úhlu.
- **Vnější koróna:** dvě aditivní koule (1,4×/1,85×) měly zblízka tvrdý okraj → jedna
  billboardovaná plocha se `pow(1-r, 3.2)` přechodem. Žádný tonemapping ve shaderu.
- **Stav je vidět bez panelu:** `uActivity` (idle 0.28 / thinking 1 / offline 0.09)
  řídí opacity pečeti, lotosu i prstenců; akcent se lerpuje zlato → ametyst.
- **Review hook:** `?hiran=idle|thinking|offline|error` zamrazí stav a vypne probe.
  **Pozor:** hash-sync efekt v `Shell` přepisuje URL na samotný hash, takže override
  se musí číst **při prvním renderu** (lazy `useState`), ne v efektu — jinak ho
  okno nestihne a probe ho přepíše.
- **Proxy:** offline odpověď modelu = `200 {offline:true}`. 503 by si prohlížeč zapsal
  jako chybu do konzole a rozbilo by to `--strict-budget` audit.
- **Měření:** fokus na Slunce 46–59 fps, 46–47 draw calls (M1, ANGLE Metal).


## Chrám Hirana — `/hiran` (2026-10-31)

- **Scéna je sdílená** (`apps/shared/scenes/Hiran.tsx`, 14. scéna rodiny), takže platí
  canon: jen `@genesis/runtime` + `three`, žádné `drei`, žádný `three/addons`. Web
  i Nirvana ji kompilují s jinou verzí three (0.169 vs 0.186).
- **Interakce:** scéna dostává callbacky (`onOrbClick`, `onSelectGate`) a data bran;
  sama nikam nenaviguje. `present/hiran/page.tsx` je napojuje na `router.push`.
  Webový náhled callbacky neposílá → brány jsou dekorace.
- **Overlay:** `ProjectPresentation` má nový prop `overlay` (DOM nad plátnem). Chat
  žije tam, scéna zůstává bez DOM závislostí.
- **Textury jsou na stropě (32).** Každý `SceneLabel` = vlastní CanvasTexture.
  Nový popisek nebo nový `marble*N` variant (jiný `repeat` = jiná textura) rozbije
  `budgetOk`. Ubírat, ne přidávat — nebo zvednout strop vědomě v `ScenePresentation`.
- **Śrí jantra** je v `apps/shared/scenes/kit/yantra.ts` (jeden zdroj pro chrám
  i pro orb ve vesmíru). Přesná konstrukce je otevřený úkol, ne hotová věc.
- **`/audio/hiran.mp3` neexistuje** → 404 v konzoli při mountu; zvuk jde ze
  syntetizované ambience. Není to regrese.

## Realtime služba `/net` — multiplayer a chat (2026-11-01, M0)

- **Next ve standalone režimu neumí WebSocket** (dokumentace: „cannot be used
  together" s vlastním serverem). Proto je realtime **samostatný proces**
  `zion-nirvana-net` (`apps/nirvana-net`, Node 22, `ws`) na `127.0.0.1:3011`,
  nginx ho vystavuje na `wss://nirvana.zionterranova.com/net`.
- **Protokol je jeden soubor** `src/core/net/protocol.ts` — importuje ho klient
  i služba. Když se formát změní, zvedni `PROTO_VERSION`; server starší verzi
  odmítne (`proto_mismatch`), aby klient nepadal na neznámých polích.
- **Identita nikdy od klienta.** V M0 je každé spojení `guest` (`host-xxx`).
  Jméno a avatar se v M1 dotáhnou z cookie `zion_session` → ZIS na serveru.
- **Služba nic nepíše na disk** — jen drží místnosti v paměti. Historie chatu
  (M1) je ring buffer; restart = prázdno. Je to záměr, ne nedodělek.
- **Build kvůli sdílenému protokolu** skládá strom o úroveň výš:
  `dist/nirvana-net/src/index.js` + `dist/nirvana/src/core/net/protocol.js`.
  Unit spouští ten první; `rootDir: ".."` v `tsconfig.json` je důvod.
- **Deploy:** `bash apps/nirvana-net/deploy/deploy-nirvana-net.sh` (poprvé
  `--install-unit`). Skript dělá stage → `mv` swap → restart → `/net/health`
  a při selhání health sám vrátí zálohu.
- **nginx:** `map $http_upgrade $connection_upgrade` je **v souboru vhostu**
  (sites-enabled se includuje do `http`, takže je to legální) + `location /net`
  s `proxy_read_timeout 3600s` a `limit_conn nirvana_net 8`. Zálohy confů patří
  do `/etc/nginx/backups/`, **nikdy** do `sites-enabled`.
- **Node na produkci:** `zion-nirvana.service` běžel na `/usr/bin/node` **18.19.1**
  (Next 16 chce ≥ 20.9). 2026-11-01 přepnuto na `/usr/local/bin/node` (22.23.2);
  záloha unitu `/root/zion-nirvana.service.bak-node18-20261101`. Když se servis
  „chová divně", první kontrola je `readlink -f /proc/$(systemctl show
  zion-nirvana -p MainPID --value)/exe`.
- **Ověření:** `cd apps/nirvana-net && npm run smoke` (20 kontrol: handshake,
  místnosti, presence, rate limit, Origin, úklid). Živě: `curl /net/health`,
  `/net/metrics`, WS upgrade z Node klienta s `Origin` hlavičkou.
- **Past při deployi:** rsync `node_modules/ws` selže, když cíl nemá
  `node_modules/` — skript proto dělá `mkdir -p <stage>/node_modules`.
- **Past se SSH:** EDGE banuje rychlé sériové SSH (fail2ban). Deploy skript drží
  jedno `ControlMaster` spojení; ruční zásahy dělej přes `zion-v6` (IPv6).

## Jupiter Station — `/park` (2026-11-01)

- **Jeden canvas, dva pohledy.** Hra se kreslí do `<canvas>` v `park-dock` a ten
  samý element je `CanvasTexture` na obrazovce skříně. Nemnožit na „DOM hru"
  a „3D hru" — VR hráč vidí právě ten canvas.
- **Stavy:** `active` (která hra), `finished` (dohráno), `riding` (jízda).
  Po dohrání handle **nechat běžet** (kreslí si vlastní „KONEC HRY"), jinak
  attract screen hru přepíše.
- **Žetony** jsou `localStorage` (`nirvana.park.v1`), žádná hodnota, žádný cashout.
  Nepřidávat směnu za ZION bez samostatného rozhodnutí operátora.
- **Tabule** `/api/park/scores` je v paměti procesu; pro perzistenci nastavit
  `NIRVANA_PARK_SCORES_PATH` (soubor zapisovatelný uživatelem služby).
- **Vesmír:** `planetPosition()` v `positions.ts` je jediný vzorec dráhy —
  scéna i fokus na Jupiter ho musí používat, jinak se kamera dívá vedle planety.
- **Tetris** je jediná hra s více vstupy (posun/rotace/hod) — v VR potřebuje ovladač s tlačítky; ostatní jdou paprskem.
- **Střelnice** (`ShootingGallery.tsx`) je 3D hra, ne canvas: terče jsou meshe
  a klik je raycast. Při startu se **schová panel a vypne OrbitControls** — jinak
  DOM panel kryje polovinu terčů a kliky chytá on, ne plátno (reálná chyba
  z prvního pokusu: 0 zásahů).
- **VR:** XR session se otevírá, ale na headsetu to není otestované. Interakce
  jsou raycast (klik na skříň/kolo), takže by měly projít; nehlásit víc, než víme.

## Mars Arena — `/mars` (2026-11-01)

- **Mapa je data, ne model.** `core/arena/map.ts` = 22 AABB krabic; fyzika i
  hitscan z nich počítají intervaly. Nová zeď = jeden řádek v poli.
- **Pohyb se řeší po osách** (`physics.ts`): posun → překryv → vytlačení na líc.
  Když se hráč zasekne, hledej chybu tam, ne v mřížce.
- **Pointer lock**: klik do plátna zamkne myš, `Esc` uvolní; po smrti hráče se
  kamera vrací na spawn — nesahej na `camera.rotation` mimo smyčku.
- **Debug háček** `?arenaDebug=1` vystaví `window.__arenaDebug` (`state`, `aimAt`,
  `fire`). Používá se pro headless test zásahů; v produkci je jen v URL.
- **Navigace:** `core/arena/nav.ts` = mřížka 40×40 z krabic + BFS. Boti
  přepočítávají cestu ~2×/s a jdou po waypointech; LOS rozhoduje, kdy strafovat.
- **VR:** `<XR store>` + tlačítko VR; pravý ovladač míří, spoušť střílí. Pohyb
  ve VR není — hráč stojí. Nehlásit jako hotové.
- **Co tu není:** zvuk, viewmodel, multiplayer, VR pohyb.

## Venuše — `/venus` (2026-11-01)

- **Trať je funkce, ne model:** `r(θ) = 86 + sin(3θ)·22`, šířka 11 m, 320 vzorků.
  `core/race/track.ts` z toho dělá pás, tečny, normály i checkpointy.
- **Okraj tratě je zeď, ne pružina.** Při klampování zachovej podélný postup
  (`along`), jinak auto zamrzne na místě — stalo se to při prvním pokusu.
- **Skóre = laps/seconds**, takže vyšší je lepší; nepřevracej tabuli.
  Pořadí v závodě (1.–3. = žetony navíc) je věc HUD, ne skóre na tabuli.
- **Zvuk:** `core/arena/audio.ts` (syntéza). Nové zvuky přidávej tam, ne jako soubory.

### Soupeři (2026-11-01)

- **Jedna fyzika pro všechny.** `core/race/physics.ts` → `stepCraft()`; hráč
  posílá klávesy, bot `{throttle, steer}`. Nikdy nedělej botům druhý integrátor:
  rozdíl by dělala pravidla, ne um. `spawnCraft()` a konstanty jsou tam taky.
- **Bot míří na směr tratě, ne na bod.** Tětiva k bodu ~1 s dopředu nutí
  zatáčet víc než trať, řízení saturuje a bot skončí ve zdi (reálně: 196 s na
  3 kola a ani jedno nedojel). Správně: `headingError = směr tratě(index+look) −
  heading` + korekce `lateral`. Křivost se počítá jako Δyaw / Δs, ne Δyaw.
- **Rozdíl mezi boty = jen `skill`** (kH/kL, stopa, `vCap`). Žádný
  rubber-banding — kazí srovnatelnost časů s lidskými.
- **Pořadí se počítá z ujeté vzdálenosti** (`LapState.travelled` = sčítaný
  přírůstek indexu). Nezaváděj „checkpointy + zlomek cesty k dalšímu“ — mezi
  branami je zlomek nulový a všichni za vedoucím hlásí stejnou ztrátu.
  `travelled` je záporný pro rošt za startovní čárou (viz `startTravelled`).
- **Čas se měří simulovanými hodinami** (`clock += dt`), ne `performance.now()`.
  Fyzika má `dt = min(0,05, delta)`; na 15 fps by skutečné hodiny nafoukly kolo
  o čtvrtinu a tabule by nebyla srovnatelná.
- **`advanceLap()` je jediné počítání kol** pro hráče i boty. Nová pravidla
  (tresty, cut detection) patří sem, ne do `useFrame`.
- **Deska pořadí** (`.race-board`) je vpravo nahoře a nesmí překrývat HUD;
  na mobilu se HUD zalamuje (`.race-hud span { white-space: nowrap }`).
- **Znaménko řízení:** `A` (kladný steer) **zmenšuje** kladný `lateral`.
  Při testech klávesnicí to ověř v simulaci, ne okem.
- **Kolize auto–auto nejsou.** Závodníci se projíždějí; je to záměr, ne bug.

## Zvuk a VR v aréně (2026-11-01)

- **AudioContext jen po gestu** (`unlockAudio()` v kliku / startu zápasu), jinak
  prohlížeč přehrávání zablokuje. V repu nejsou žádné zvukové soubory.
- **VR pohyb** jde přes `XROrigin`: origin nese tělo, kamera (hlava) je vůči němu
  lokální. „Vpřed" se bere z kamery, ne z myši; kolize zůstávají stejné.

## Archa — `/present/kralovstvi-srdce` (2026-11-01)

- **Třináctý uzel L5 nemá pin na pevnině.** V obou `freeworld-sites` je proto
  `body: 'ocean'` a `EARTH_MISSIONS` filtruje `(m.body ?? 'earth') === 'earth'`.
  Když se filtr rozbije, archa se objeví jako marker uprostřed Atlantiku.
- **Nový slot `sea`:** `SceneSlot` je exhaustivní `Record` ve **dvou** souborech
  (`core/shell/Shell.tsx` a `core/scene/universe/HoloConsole.tsx`) — nový slot
  bez obou barev neprojde `tsc`.
- **Plující archa ve vesmíru** (`core/scene/universe/SailingArk.tsx`) obíhá Novou
  Zemi a klik otevírá portál `archa`; je uvnitř skupiny zemské soustavy, takže
  obíhá Slunce spolu s planetou. Hit area je neviditelná koule — samotná loď je
  na klik moc malá.
- **Scéna je sdílená** (`apps/shared/scenes/KralovstviSrdce.tsx`, 15. scéna
  rodiny): jen `three` + `@genesis/runtime`. Rotace plachty se **nesmí** dělat
  kolem osy lodi — geometrie musí být lokální k vlastnímu `z` a pozici nese až
  `group`; jinak se plachta odsune od stěžně (přesně tahle chyba se stala).
- **Bílá plachta proti světlé obloze mizí.** Barva `#fff6e4` je na obloze
  nečitelná; používat teplý cream (`#f0e3c6`) a trim ~0,8 rad, ať není nikdy
  přesně edge-on ke kameře.
- **Ověření bez ZAP pasu:** `/present/*` je gate-nutý server-side. Lokálně se
  scéna pustí s `ZION_RENDER_AUDIT=1` a hlavičkou `x-render-audit: 1`
  (stejný hook jako `scripts/ops/audit-project-scenes.py`); produkce ten env
  nemá. `/present/kralovstvi-srdce` → **307** na živém webu je správně.
- **Dlaždice v konzoli** přibyla automaticky z manifestu (`id: 'archa'`), okno
  `ArchaPortal` má dvě cesty: `/present/kralovstvi-srdce` a misijní stránku.

## Nebeská flotila — Nabukano (2026-11-01)

- **Slot `fleet` je nový `SceneSlot`.** `SLOT_COLOR` je exhaustivní `Record`
  ve **dvou** souborech (`core/shell/Shell.tsx` a `scene/universe/HoloConsole.tsx`)
  — když se přidá jen jeden, `tsc` spadne (nebo hůř, dlaždice zůstane bez barvy).
- **Pozice i natočení jdou z `positions.ts`** (`fleetPosition()`, `fleetHeading()`).
  Fokus kamery počítá cíl **stejným vzorcem** jako scéna; kdyby se rozešly,
  kamera doletí tam, kde flotila není. Stejná past jako u `planetPosition()`
  (Jupiter Station).
- **Fokus má tři místa v `Shell.tsx`:** `openPortal()`, inicializace z hashe
  a `hashchange` listener. Přidání nové hodnoty `focus` znamená sáhnout na
  všechna tři + typy v `SceneRoot.tsx` a `Universe.tsx`.
- **Kamera u flotily musí stát dál od Slunce než flotila** (`addScaledVector`
  radiálně ven + `FLEET_CAM_LIFT`). Při offsetu namířeném dovnitř soustavy
  vyplní záběr Śrí jantra na Slunci a flotila je jen drobná silueta — přesně
  tohle se stalo při prvním měření.
- **Ověření lokálně bez ZAP pasu:** `/api/pass` je fail-closed a ověřuje kód
  proti `app.zionterranova.com/api/archive/verify`. Pro lokální audit stačí
  `ARCHIVE_VERIFY_URL=http://127.0.0.1:9099/verify` + lokální stub, který
  vrací `{"valid":true}`, a cookie `zion_nirvana_pass`.
- **Headless WebGL:** swiftshader v Chromium zvládne scénu vykreslit, ale fps
  je bezcenné (~3–4) a `page.screenshot` padá na timeout/closed target.
  Měřit draw calls a triangles ano; výkon a screenshot jen na GPU.
- **Naměřeno (swiftshader, 800×600, dpr 1, `?sceneAudit=1`):** 125 draw calls,
  72 386 tris, 39 textur, `invalidVertices: 0`, tier A. Flotila přidává
  ~30 draw calls, jen když je v záběru (frustum culling).
- **Trasa (leg) se zamrazuje `key`.** `FleetRoute` počítá oblouk v `useMemo`
  z `clock.elapsedTime` v okamžiku mountu; v `Universe` je proto
  `{fleetLeg && <FleetRoute key={fleetLeg} … />}`. Bez `key` by se start i cíl
  přepočítávaly každý frame (nová geometrie = smetí v paměti) a oblouk by
  odjížděl od LUMI, jak flotila obíhá.
- **Trasa je animace konceptu, ne let.** Okno to říká nahlas (`FleetPortal`);
  v kódu proto žádná fyzika, žádné ETA — jen křivka a světlo, které po ní
  dojde za 6 s a zůstane u doku.
