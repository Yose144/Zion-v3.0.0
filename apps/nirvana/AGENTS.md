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
- **K1.2 (root workspace) rozbil deploy:** `node_modules` ve standalone stromu
  leží o úroveň výš (`.next/standalone/node_modules`) a appka je zanořená
  v `.next/standalone/apps/<app>`. `deploy-nirvana.sh` proto artefakt před
  nasazením **zplošťuje** do `.next/standalone-flat` (app dir + node_modules
  vedle sebe), aby unit zůstal `WorkingDirectory=…/nirvana` + `node server.js`.
  Když se změní layout standalone výstupu, tohle je první místo, kde to spadne
  („incomplete standalone artifact").

### Chat (M1, 2026-11-01)

- **Identitu dodává server.** Klient posílá jen `hello` a text; jméno, avatar
  i právo psát plyne z cookie `zion_session` → ZIS `/api/auth/me` (cache 60 s).
  Nikdy neposílej jméno z prohlížeče — jinak si kdokoli napíše „admin".
- **Kanály:** `park` (mimo místnost) a `arena:<room>`. Historie 200 zpráv
  v RAM, po restartu služby prázdná (záměr, žádná DB).
- **Psát smí jen `zis`.** Host dostane `read_only`; UI to vysvětlí, ale
  rozhoduje server.
- **Rate limit je serverový** (2 zprávy / 2 s) — UI ho jen zobrazí.
- **Čištění textu:** pryč s HTML tagy (`<[^>]*>`), řídicími znaky a `<`/`>`,
  strop 240 znaků. Vnitřní text tagu zůstává jako text („alert(1)"), to je OK.
- **Klávesy v inputu nesmí utéct do hry:** `onKeyDown/onKeyUp` volá
  `stopPropagation`, jinak `W` rozjede vozítko na Venuši (otestováno).
- **`T` otevře chat, `Esc` zavře**; otevření uvolní pointer lock (aréna).
- **Jeden `NetProvider` v `app/layout.tsx`** = jedno WS na kartu. `ChatDock`
  je tamtéž, takže chat je na každé stránce včetně her.
- **Lokální test:** `NEXT_PUBLIC_NIRVANA_NET_URL=ws://127.0.0.1:3011/net`
  při buildu (jinak klient míří na `ws://<host>/net`, což dev server neumí).
  Pozor: propíše se do bundlu — před deployem build bez té proměnné (dělá to
  deploy skript sám).
- **Turbopack si při změně téhle proměnné nevšimne nové hodnoty** — opakovaný
  build se starým `.next` nechá ve státu `ws://localhost:3010/net` a E2E pak
  padá na `WebSocket handshake timedout`, i když proměnná v příkaze je. Před
  lokálním multiplayer E2E udělej `rm -rf .next` a teprve pak build s env.

### Multiplayer arény (M2a, 2026-11-01)

- **Server je autorita.** `apps/nirvana-net/src/arena.ts` počítá pohyb (`stepBody`
  z `core/arena/physics.ts`), zásahy (`pickTarget` z `core/arena/weapons.ts`),
  smrt, respawn, pickupy i skóre. Klient posílá **jen vstup** 20 Hz a kreslí
  snapshoty 15 Hz.
- **Jedna fyzika a jedna čísla.** `physics.ts`, `map.ts` i `weapons.ts` sdílí
  klient a server (žádná druhá implementace). Když se změní poškození zbraně,
  mění se na jednom místě — jinak by hráč viděl jiné zásahy, než server počítá.
- **Predikce vlastního pohybu** běží stejnou `stepBody`; když se rozejde se
  serverem o > 1,6 m, srovná se (teleport), jinak se plynule dorovnává 18 %/frame.
  Ostatní hráči se interpolují mezi dvěma posledními snapshoty.
- **Snapshoty tečou přes `subscribe()`**, ne přes React state — 15×/s by jinak
  překreslovalo celý 3D strom. Chat a presence naopak state jsou (nízká frekvence).
- **Presence, ne join/leave.** Hráč je členem parku a pak arény; `join`/`leave`
  chodily za každý kanál zvlášť a klient napočítal člena dvakrát. Server teď
  posílá **každému jeho vlastní seznam** (`event.kind === 'presence'`).
- **Jméno hráče je ve snapshotu** (`ArenaPlayerState.name`). Mapovat
  `presence` (identity id) na snapshot (connection id) nejde — tabule ukazovala
  `c_9448…` místo jména.
- **Zpětná vazba „trefil jsem"**: zásah se pozná podle HP ve snapshotu, ne
  z klientské střely. Tracery/audio v MP zatím nejsou (sólo je má).
- **Co v MP není:** boti (prázdnou arénu nikdo nedoplňuje), zvuk, VR, tracery.
  Není to nedodělek, je to další krok — nemá se to hlásit jako hotové.

### Issobella — scéna a šatník (F3, 2026-11-01)

- **Scéna je sdílená** (`apps/shared/scenes/Issobella.tsx`), takže platí canon:
  jen `three` + `@genesis/runtime`, žádné `drei`, `React.use*` explicitně,
  animace přes `motionTime`/`motionDelta`.
- **`SceneLabel` má jen `{position, text, scale}`** — žádnou barvu. Kdo přidá
  čtvrtý prop, dostane type error (dobře).
- **`KeyLight` bere `sun` (směr), ne `position`**; `SkyFill` bere `sky`/`ground`.
- **`ScenePresentation` patří do scény** (ne do stránky) a chce `camera` + `target`.
- **Planeta musí být nad obzorem.** Když je „pod podlahou", podlaha ji zakryje
  a stanice vypadá jako prázdný sál — osa Y je tu past.
- **Šatník je 12 výklenků** (koule v barvě paprsku + label). Klik volá
  `onSelectAvatar(id)`, uložení do ZIS dělá až stránka (`avatar3d.avatarId`) —
  scéna nesmí volat API.
- **Celý roster je na `/avatars`**; sem se vejde 12, zbytek odkazem.

### Herní HUD (F2, 2026-11-01)

- **`GameHud` je v `app/layout.tsx`** a sám se skryje mimo herní povrchy
  (`usePathname()` + seznam `SURFACES`). Varianty: `is-dock` (vesmír, dole
  uprostřed) a `is-compact` (hry, vlevo dole — aby nekolidoval s jejich HUD).
- **ZION zůstatek NIKDY přes `getBalance`** — je to account-model a u UTXO
  vrací 0. Route `/api/wallet/balance` volá `getUtxos` s `limit: 0`
  (`total_amount`), primárně `127.0.0.1:9445`, fallback `rpc.zionterranova.com`.
  Když RPC mlčí, vrací **200 `{ok:false}`** — HUD ukáže `—`, hra nesmí vypadat
  rozbitá.
- **`BigInt`** kvůli částkám nad 2^53 (144 mld ZION × 1e6 flowers). V `tsconfig`
  je target ES2017 → **bigint literal `1n` neprojde**, používat `BigInt(1)`.
- Žetony čte `loadProfile()` až po mountu (SSR by měl jiné číslo) a obnovuje je
  při `window.focus`.
- Na mobilu se tabům skrývá text (`game-hud-tab-text`) a lišta scrolluje.

### Planety jako vstupy do her (F1, 2026-11-01)

- **Mars, Venuše, Jupiter a Merkur jsou vstupy** (`PlanetDef.game`), ostatní planety jsou
  mrtvé — jen tlumené jméno, žádný hover ani kursor. To je záměr: hranice
  „na co jde kliknout" musí být vidět bez najetí.
- **Hit-sféra je neviditelná koule** `max(size*2.6, 2.6)` s `opacity: 0` —
  `visible={false}` **nefunguje**, raycast takový mesh ignoruje.
- **Chip na planetě musí mít `pointerEvents: 'auto'`**, jinak je vidět a nejde
  kliknout (stalo se). U mrtvých planet zůstává `none`.
- **Halo = billboard** (`ringGeometry` + `quaternion.copy(camera.quaternion)`).
  Torus v nakloněné rovině vypadá jako Saturnův prstenec — plete to.
- **Klik = přiletět + panel**, ne rovnou skok do hry. `focus` v `Universe` má
  `'mars' | 'venus'`; cíl se počítá **každý frame** stejnou `planetPosition`,
  jinak planeta při přeletu uletí.
- **`SceneRoot` má DVA stromy** (XR a non-XR) — nový prop je potřeba přidat do
  obou, jinak se v běžném prohlížeči nic neděje (přesně to se stalo).

### Navigace ke hrám a sluneční soustava (2026-11-01)

- **Hry jsou routy, ne portály.** `/park`, `/mars`, `/venus`, `/mercury`, `/avatars` se
  otevírají `<Link>`em (nová stránka), kdežto portály v konzoli otevírají okno
  ve scéně. Seznam her drží **`core/games/links.ts`** — konzole, pouť i
  `GamesDock` ho sdílí; nová hra se přidává tam, ne na čtyři místa.
- **`GamesDock`** je plovoucí lišta dole ve vesmíru (`/`), vždy viditelná.
  Kdyby hry zmizely z UI, je to regrese — dřív nešly najít vůbec.
- **Konzole (hamburger) má sekce** Hry / Světy / Systém / Připravujeme se
  štítky (`hrát →`, `otevřít`, `ve výstavbu`). Stub portály jsou ztlumené.
- **OrbitControls míří na Zemi**, ne na Slunce: kamera i `controls.target` se
  posouvají o deltu oběhu Země. Když se to rozbije, Země proplouvá záběrem.
- **Dráhy jsou komprimované** `r = 30·AU^0.55` (`orbitRadius()` v `SolarSystem.tsx`).
  Lineární AU dalo Neptun 903 jednotek daleko — mimo jakýkoli rozumný záběr.
  Země vychází na 30 = `EARTH_ORBIT_R`, takže fokus a zemská soustava sedí.
- **Hiran na Slunci má `detail` prop:** plný ornament (jantra + lotos) jen při
  fokusu na Slunce, z dálky se ztlumí a lotos se schová — jinak přes Slunce leží
  mřížka a Slunce vypadá jako drátěná koule.
- **Jména planet jsou DOM popisky** (`<Html>`), ne 3D spritely — sprite je při
  oddálení nečitelný.
- **Rotační osa** je tenká **krabička** `LINK_WIDTH` o délce 1,75× průměr
  planety uvnitř nakloněné skupiny, takže ukazuje skutečný sklon (Venuše 3,09
  rad, Uran 1,71). Dřív to byla vlasová WebGL linka, která s dálkou mizela.

### Linky a brána ve vesmíru (2026-11-02)

- **Jedna linka = jeden jazyk: `core/scene/universe/links.ts`.** Trvalé vodicí
  linky berou barvu/šířku/průhlednost jen odtamtud — dráhy planet (`OrbitLine`),
  vodící prstenec orbitálních světů, osy planet, rámečky dlaždic konzole i
  trasa flotily. Dřív to byly čtyři idiomy v čtyřech barvách (`#8892b0` op 0,2 ·
  vlas v barvě planety op 0,45 · fialová trubička op 0,14 · per-slot rámečky ·
  kyanovalá trubice op 0,42) — čitelnost záležela na tom, kam se koukáte.
- **`orbitWidth(r)`** dělá vzdálenější dráhu úměrně širší, takže od Slunce
  mají všechny stejnou uhlovou tloušťťku (při r=30 = `LINK_WIDTH`, tedy přesně
  to, co scéna používala dřív — mění se barva a průhlednost, ne geometrie).
- **Mimo jazyk zůstává záměrně:** ornamenty (Śrí jantra a prstence Slunce,
  prstenec Issobelly, Nová Země, stanice), interaktivní zvýraznění (hover
  prstenec planety nese její tint, aby seděl k chipu) a particle pás světů.
- **Brána je dítě Jupiteru.** `StarGate` se vykresluje v `SolarSystem.tsx` uvnitř
  carrieru planety s `GATE_JUPITER_OFFSET` (`positions.ts`), ne v zemské soustavě
  (`GATE_POS` je pryč) — obíhá s Jupiterem, takže je od něj pořád stejně daleko
  a je ve záběru, když se na Jupiter doletí.
- **Offset 12,9 jednotek není náhoda:** musí být větší než hit-sféra planety
  (`max(size·2.6, 2.6)` = 9,36) + poloměr brány (3), jinak by klik na bránu
  nejdřív trefil planetu a otevřel panel pouti místo vstupu do OASIS.
  Stejná past platí pro jakýkoli objekt připnutý k interaktivní planetě.

### Avatary (A1–A4, 2026-11-01)

- **Katalog je generovaný, ne ruční:** `core/avatars/catalog.ts` vzniká z
  `V31/L4/oasis/data/avatars.json` skriptem
  `node scripts/ops/gen-avatar-catalog.mjs` (200 záznamů, jen id/jméno/podtitul/
  paprsek/vzácnost/CL). Needitovat ručně — po změně rosteru spustit generátor.
- **Vzhled se počítá z id.** `core/avatars/kit.ts` (`avatarLook`) je čistá
  deterministická funkce: id → semínko → tělo, výška, ornamenty, aura; paprsek
  a vzácnost berou z katalogu. Proto jde cizí hráč vykreslit jen z `avatarId`,
  bez stahování rosteru.
- **Model je z primitiv** (`AvatarModel.tsx`, ~18 meshů) — v repu nejsou žádné
  glb/gltf, takže „namodelovat 200 postav" nejde. Kit je navržený tak, aby šel
  později vyměnit za skutečné modely bez změny zbytku.

### Avatary — bohatší model a portréty (2026-11-01)

- **Geometrie se staví v `body.ts`, ne v JSX.** `buildAvatarMesh(look)` složí
  ~45 dílů do **tří bufferů** (tělo / kov / světlo) s barvou ve vrcholech;
  postava je tak 1–3 draw calls místo ~18. Ve hře se potká až 8 avatarů, takže
  na tom záleží. `AvatarModel.tsx` je jen tenký renderer (props se nemění).
- **Pozor na úhly u `SphereGeometry` / `CylinderGeometry`:** `phiStart` u koule
  jde od −X přes **+Z (předek)**, `thetaStart` u válce začíná na **+Z**. První
  pokusy o kápi a závoj proto kreslily přes obličej — zadní oblouk je u koule
  kolem `1,5π`, u válce `0,36π…1,64π`.
- **Vzhled je deterministický a datový:** `kit.ts` bere z podtitulu archetyp
  (warrior/sage/royal/artist/healer/mystic/wanderer) a z něj oděv, vlasy,
  pokrývku hlavy, plášť i postoj. `ray`/`rarity`/`cl` z katalogu dávají paletu,
  korunu a auru. Neměnit na náhodu — cizí hráč se kreslí jen z `avatarId`.
- **Portréty na webu vznikají z tohoto modelu:** `scripts/ops/oasis-avatar-render/`
  (headless Chromium + ANGLE/Metal) vyrenderuje 200 karet do
  `apps/website-v2.9/public/oasis-assets/game-portraits/`. Když se model změní,
  karty se musí přerenderovat (`node scripts/ops/oasis-avatar-render/render.mjs --force`),
  jinak web ukazuje starou podobu než hra.
- **Kamera portrétu se počítá z bounding boxu** postavy — hůl/kopí přes 2 m jinak
  uřízne hlavu. Pevná kamera to nezvládne.

### Kánon v modelu a character sheets (2026-11-01)

- **`canon.ts` je generovaný** (`node scripts/ops/oasis-canon/build-canon.mjs`)
  ze `V31/L4/oasis/data/avatars.json`, esencí web2.9, `SACRED_TRINITY/` a
  `AVATAR_ROSTER.md`. Drží atributy (flétna, trojzubec, čakra, vajra, kříž, srpek,
  anch…), paletu, pleť a pokrývku hlavy. Needitovat ručně.
- **Kánon má v `kit.ts` přednost před deterministickou náhodou** — atributy se
  doplní jen do počtu podle vzácnosti (max 3 + halo). Když v kánonu atribut chybí,
  rozhodne id. Díky tomu je Krišna modrý s flétnou a Šiva s trojzubcem, ale
  neznámý avatar se pořád vykreslí.
- **Fyzické znaky (sloní hlava, vanara, ptačí muž) se nekreslí** — model z primitiv
  to neumí, takže žijí jen v promptu (`ANATOMY` v generátoru). Nepřidávat je do
  geometrie bez pořádného modelu.
- **Turnaround sheet** (`render.mjs --sheets`) = 1600×900, čtyři pohledy na společné
  zemi, popisky a paleta. Je to **podklad pro modeláře a pro generování portrétů**,
  ne finální asset. Když se změní model, sheets se musí přerenderovat spolu s kartami.
- **Pozor na vlasy:** `SphereGeometry` s `thetaLength` ≥ 0,44π sahá na obočí a
  vypadá jako maska přes oči — používat ≤ 0,36π.

- **Ukládá se do ZIS** `avatar3d.avatarId` (+ `callsign`, `bodyType`,
  `neonColor`). ZIS schéma (`apps/identity/src/routes/auth.ts`,
  `UpdateProfileSchema`) muselo `avatarId` povolit — do té doby ho zod tiše
  zahazoval. Bez deploye ZIS se avatar neuloží (a nikdo to nepozná, protože
  PATCH vrátí 200).
- **Jméno:** `callsign` z `avatar3d` má přednost před `displayName` (tak to
  dělá i web). Chat i tabule proto ukazují callsign.
- **Stránka `/avatars`** je veřejná: host si prohlíží, uložit může jen
  přihlášený. Náhled je jeden `<Canvas>` (ne 200) — 200 modelů v gridu by
  zabilo i slušný stroj.
- **Past s layoutem:** `.avatars` musí mít pevnou výšku (`100dvh`), jinak
  seznam 200 položek roztáhne scénu na tisíce pixelů a kamera kouká dovnitř
  modelu. A kamera musí `lookAt` na hrudník — výchozí cíl (0,0,0) uřízne hlavu.

### Multiplayer závodu (M2b, 2026-11-01)

- **Stejná trať, stejná fyzika.** `apps/nirvana-net/src/race.ts` pouští
  `core/race/track.ts` + `core/race/physics.ts` (`stepCraft`) a kola počítá
  `advanceLap` z `rivals.ts` — tedy přesně to, co klient.
- **Vizuál tratě je jeden.** `core/race/TrackStage.tsx` (pás, okraje, brány,
  startovní čára) používají sólo i multiplayer — neopravovat dvakrát.
- **Odpočet je serverový** (3 s, při novém hráči se restartuje). Klient ho jen
  kreslí; když doběhne, server pošle `race_start`.
- **Vstup:** u závodu posílá klient `mz` = plyn a `mx` = zatáčení (stejná
  konvence jako sólo klávesy), **ne** dopředu/doprava jako v aréně. `useNet`
  proto nabízí `joinGame('race')`; `joinArena()` je jen obal (dřív posílal
  `game: 'arena'` i pro Venuši a závod se nikdy nepřipojil).
- **Predikce:** vlastní vozidlo se hýbe stejnou `stepCraft`, srovnává se při
  odchylce > 3 m; ostatní se interpolují mezi snapshoty.
- **Závod končí**, když dojedou všichni (nebo po 8 min). `race_end` nese
  pořadí; po 8 s se rozjede nový.
- **Co tu není:** duchové odpojených (jezdci se jen odeberou), boti, zvuk.

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

### Jupiter Station — rozšíření (2026-11-01)

- **Pátá skříň = Asteroidy** (`core/park/games/asteroids.ts`). Stejný kontrakt
  jako ostatní canvas hry: `frame` ve smyčce nic nealokuje (skály, střely i
  hvězdy jsou předalokovaná pole), vstup je abstraktní `pointer`/`key`.
  Ukazatel je volant i plyn (ve VR paprsek), takže hra jde hrát i bez kláves.
- **Skříně jsou pravidelný oblouk** (`CABINETS` v `ParkScene.tsx`, −11,2 … 11,2).
  Nová hra se přidává do tohoto pole + `PARK_GAMES`, ne na čtyři místa.
- **Tabule zná všechny hry, co se dají zahrát.** `TITLES` v `page.tsx`,
  `emptyScores()` v `scores.ts`, `GAMES` + `emptyBoard()` v API routě a
  `GAMES`/`TARGETS` v `challenge.ts` musí sedět — jinak skóre zmizí
  (Merkur `fight` na tabuli chyběl, protože se přidal jen na server).
- **Ruské kolo má konec.** Při jídě se kolo točí rychleji (0,26 rad/s = otočka
  ~24 s) a kamera jede stejnou rychlostí jako gondola; po 25 s se jízda
  dokončí sama. První dokončená jízda dne vrátí vstupné (`claimRideBonus`) —
  bilance je nula, takže z toho nejde tisknout žetony. Sesednutí předčasně je
  jen konec, bez bonusu.
- **Klávesy canvas her se pouští při ztrátě fokusu** (blur / visibilitychange),
  stejně jako u Merkuru — jinak Had jede dál po přepnutí tabu.
- **Skříň ukazuje rekord, výzva ukazuje postup** (`profile.best`), takže hráč
  vidí, jak daleko je od cíle.
- **E2E: `apps/nirvana/e2e/park-fair.mjs`.** Logika Asteroid běží v Node nad
  falešným canvasem (Proxy, který zaznamenává `fillRect`/`translate` — stav hry
  je vidět jen z kresby); prohlížečová část ověřuje pět skříní, spuštění/ukončení
  hry, žetony (dohraná hra dává, předčasný odchod ne), tabuli Merkura přes API
  a ukončení jízdy. Spustit s appkou na `:3010`.

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

## Merkur — souboj `/mercury` (M3, 2026-11-01)

- **Simulace je jeden modul** `core/fight/duel.ts` (`stepDuel`, `stepFighter`,
  `botInput`, `resetDuel`, `createDuel`) — používá ho klient i služba
  (`apps/nirvana-net/src/fight.ts` ho importuje relativně, jako `arena`/`race`).
  Změníš-li damage/reach, mění se všude z jednoho místa.
- **Úder blokuje pohyb** (v `attack` se nestojí nic kromě setrvačnosti).
  Držený `punch` = bojovník mlátí na místě. E2E/simulace musí nechat
  útočníka nejdřív DOBĚHNOUT do dosahu (`move` bez útoku), jinak se zásah
  nikdy nesejde — přesně takhle padal první `fight.mjs`.
- **Klient predikuje jen pohyb.** Zásahy, HP, KO a kola rozhoduje server
  (`resolveAttack` běží jen na serveru); `stepFighter` je exportovaný
  přesně proto, aby klient mohl dělat POLUTINOU simulace bez damage.
- **`resetDuel` nemění objekty** — animace drží `useRef` na `duel.a`/`duel.b`.
  Kdo při restartu udělá `createDuel` znovu, rozstřelí refy a bojovníci
  zůstanou viset ve mrtvém stavu (osahano při sólu).
- **`hud.current` je nosič dat** i pro `?duelDebug=1` háček — `onStats`
  objekt se musí zapsat zpátky do `hud.current`, jinak debug vidí stará
  data a testy honí stíny (reálně: `foeHp` se neaktualizovalo a zásah
  se jevil jako nedosahovaný).
- **R3F effect uvnitř `<Canvas>` startuje až po GL init.** Na headless
  swiftshaderu to jsou desítky vteřin — join do `fight` se v E2E může
  objevit až po ~60–120 s. Timeouty tomu přizpůsob, ne 15 s.
- **`poll()` ve testech: mimo predikátu vracet `null`.** Vracet
  „poslední stav" při timeoutu = falešná zelená (stalo se: služba byla
  mrtvá a 6 assertů prošlo).
- **Deploy po bumpu protokolu: `deploy-nirvana-net.sh` FIRST, pak appku.**
  Starý klient na novém serveru dostane `proto_mismatch` (po reloadu OK);
  obráceně by `join fight` propadl `arena` fallbacku starého parseru.
- **Klice planet → panel:** `def.game` pro Jupiter je `'park'` (ne
  `'jupiter'`). Panel v Shell se počítá z `PLANET_PANELS[planet]` —
  klíče jsou hodnoty `def.game`. Podmínka na `'jupiter'` je mrtvá kód.

### Merkur — hratelnost polish (2026-11-01)

- Sólo má tři bot profily `gentle | standard | champion`; změna obtížnosti
  patří do `botInput()` ve sdíleném `duel.ts`. Síťové boty dál používají
  `standard` default, takže protokol i serverová simulace zůstávají stejné.
- Pohybové animace i zásahový záblesk čtou `Fighter` v `Fighter3D`; nepřidávat
  herní stav do React state ani druhou fyziku. HP je jediný signál zásahu, který
  klient potřebuje pro vizuální odezvu.
- Klávesy se čistí při ztrátě focusu / skrytí tabu; mobilní ovladače musí pustit
  vstup i na `pointercancel` a `lostpointercapture`.
- Menu se vrací přes tlačítko **Menu**. Sóla se při novém startu mountuje čistě,
  aby po předčasném odchodu nepokračoval zamrzlý duel. Multiplayer hlásí
  připojování/hledání místo falešného `0s` HUDu.
- Bez změny wire formátu: `PROTO_VERSION` zůstává 3; `fight` E2E a serverové
  testy stačí pro změny lokálního balancu/UI. Při budoucí změně vstupu nebo
  snapshotu pokračuj bumpem protokolu a deploy pořadím server → aplikace.

## Mars — Q3 model (2026-11-02)

- **Fyzika je přepočtená ze zdroje Q3** (`bg_pmove.c`), ne od oka: 1 jednotka
  = 0,03125 m (320 u/s → 10 m/s, 800 u/s² → 25 m/s², 270 u/s → 8,44 m/s).
  Když někdo „zrychlí hru", musí měnit `Q3` v `physics.ts` a ne jednotlivé
  konstanty — jinak se rozejde friccion a accel.
- **Tření je NA ZEMI každý snímek**, ne jen bez klávesy. Bez toho hráč
  klouže jako na ledě a Q3 pocit zmizí. Ve vzduchu tření není (to je to,
  co dělá strafe jump).
- **Skok vyžaduje puštění tlačítka** (`Body.jumpHeld`). Dřív šel držením
  hopat donekonečna. Kdo to vrátí, zničí Q3 movement.
- **`stepBody` nemá tvrdý strop rychlosti.** Rychlost se ustálí sama
  (friction vs accel) a strafe jump umí překročit `Q3.maxSpeed`. Přidat
  `if (speed > max) clamp` = zakázat strafe jump.
- **`lineOfSight` normalizuje směr.** `rayBox` vrací `t` v jednotkách
  směrového vektoru; poslat mu nenormalizovaný vektor a porovnávat s
  vzdáleností v metrech = stěny **za** cílem blokují viditelnost (chyba
  opravená 2026-11-02, dřív boti odmítali střílet přes volný prostor).
- **Botí mozek míří z `PLAYER.eye`** (1,6 m), ne z `y+1.2`. Výška oka musí
  sedět se serverem, jinak rány systematicky míjí o 0,4 m. `eyeHeight` /
  `targetHeight` jsou v `DEFAULT_BOT_OPTIONS` a jsou to hodnoty ze
  `weapons.ts`, ne konstanty „někde v bot.ts".
- **Chyba míření 0,035 rad, ne víc.** 0,06 rad na 10 m = 0,62 m = přesně
  poloměr zásahové koule → bot míjel v půlkách a vypadal hloupě.
- **Boti v MP mají bias na lidi** (`+1000` ke vzdálenosti botů). Bez něj
  se tři boti vyraždí mezi sebou (reálně se to stalo: `bot-1 → bot-3`) a
  hráč se jen díval. Se člověkem v místnosti jdou všichni po něm.
- **Frag limit platí jen pro lidi** (`!player.isBot`). Bot s 10 fragy
  nesmí ukončit zápas člověku.
- **Munici drží server** (`ammo`/`mgAmmo` ve snapshotu). Klient si ji
  nesmí vymýšlet — rozjel by se se serverem (stejná past jako „trefil
  jsem ho a nic").
- **Sólová i multiplayerová aréna používají stejný `core/arena/bot.ts`**
  (sjednoceno 2026-11-02). Dřív mělo sólo vlastní AI s pravděpodobnostním
  zásahem — dva různé typy nepřítele. Kdo přidá druhý mozek, rozbije tím
  pravidlo „co platí v MP, platí i v sólu".
- **Deploy po bumpu protokolu:** NEJDŘÍV `deploy-nirvana-net.sh`, pak
  `deploy-nirvana.sh`. Obráceně nový klient propadne `arena` fallbacku.
- **Testy botů musí být deterministické.** `arena-bots.mjs` bojí v čisté
  simulační části s jedním botem v místnosti; síť testuje jen transport.
  Síťový test, kde tři boti bojují s člověkem, flakuje — boti si stínají
  cíl a člověk umírá dřív, než vystřelí.

## PRVNÍ SVĚT — MOBA `/earth` (2026-11-02)

- **Kouzla jsou z kánonu, ne z hlavy.** `core/moba/spells.ts` čte `ability`
  z `V31/L4/oasis/data/avatars.json` a podle 11 škol (`ward`, `fire`, `arrow`,
  `blade`, `cosmic`, `mind`, `nature`, `storm`, `song`, `shadow`, `beast`)
  složí Q/W/E/R. Stejné id = stejná sada; cizí hrdina jde vykreslit z `avatarId`.
- **Sim je jeden modul** (`core/moba/sim.ts`) — pohyb, kouzla, minioni, věže,
  Nexy, uzly, XP, respawn, konec. Klient posílá jen vstup (WASD + slot + bod
  seslání), poškození počítá sim. Když se číslo kouzla mění, mění se tady.
- **Uzly L5 jsou mechanika:** `NODE_SITES` (Kailash, Uluru, Ekam) — 2,6 s stání
  = převzetí, +5 % poškození za uzel. Klíče sedí na `FREE_WORLD_MISSIONS`.
  Nepřidávat uzly jen jako dekoraci — hráč je musí vidět v HUD.
- **Kamera:** sleduje hrdinu přímo (`camera.position.set(x, 20, z + 17)`),
  clamp je ±38/±26, jinak se u základny záběr rozjede a hrdina není uprostřed.
- **HUD:** telemetrie chodí 5×/s přes `onStats` (ne React state ve `useFrame`).
  Simulace běží v refu; `?mobaDebug=1` vystaví `window.__mobaDebug()`
  (`cast`, `teleport`, `damageNexus`, snapshot) pro headless testy — bez něj
  by E2E muselo hrát myší.
- **Konec zápasu se detekuje centrálně** (na konci `stepMoba` kontrola Nexů),
  ne jen v cestě „hrdina mlátí věž" — jinak debug/minion Nexu položí a hra běží dál.
- **Online 2v2 (protokol 5):** server `apps/nirvana-net/src/moba.ts` drží
  simulaci, klient posílá jen vstup (`attack`, `castSlot`, `castX/Z`) a kreslí
  snapshoty. Volná sedla doplní boti po 6 s, odpočet 4 s, pauza 12 s po konci.
  **Kouzlo je jednorázové** — server po ticku `cast` vyčistí, jinak by se
  sesílalo každý snímek (přesně tahle chyba se stala).
- **Vykreslení je oddělené od ovládání:** `MobaStage` čte jen snapshot, takže
  ho používá sólo (`MobaGame`, lokální sim) i online (`MobaOnline`, data ze
  serveru). Nepřidávat druhou kopii fyziky pro síť.
- **Deploy pořadí:** nejdřív `deploy-nirvana-net.sh`, pak appku (proto 5).
- **⚠️ Poznámka k historii:** tahle dávka (2v2 online, `moba.ts`, protokol 5,
  `MobaOnline`, E2E `moba-online.mjs`) přistála v commitu `ee1f097c6` — paralelní
  session dělala `git add` přes celý strom a strhla staged soubory. Obsah je
  v pořádku a otestovaný, jen zpráva commitu mluví o mobilním ovládání.
  Report: `docs/3.2/REPORTS/REPORT_2026-11-02_FIRST_WORLD_ONLINE.md`.
- **Predikce vlastního pohybu (online):** `MobaOnline` drží `selfPose`, posouvá
  ho rychlostí `PREDICT_SPEED = 6.2` (musí sedět se `sim.ts`), při odchylce
  > 1,6 m se teleportuje na server, jinak dorovnává 18 %/frame. Predikuje se
  **jen pohyb** — zásahy a smrt rozhoduje server. `MobaStage` bere `selfPose`
  a kreslí z něj vlastního hrdinu i kameru.
- **Minimapa** (`MobaMinimap`) kreslí z jednoho snapshotu 5×/s: linky, věže,
  Nexy, uzly L5 s barvou vlastníka, minioni a hrdinové (tvůj s bílým kroužkem).
  Chce `MobaStats.youId`; nepřidávat jí vlastní stav.
- **Past s throttlem:** `sendMobaInput` má 20 Hz limit a **vrací boolean**.
  Zařazené kouzlo se smí smazat jen po skutečném odeslání, jinak se tiše
  ztratí (přesně to odhalil E2E online test).
- **Zvuk je syntéza** (`core/moba/audio.ts`) a odvozuje se z **rozdílu
  snapshotů** (`useMobaAudio`): sim eventy neposílá. AudioContext jen po gestu.
- **Obchod:** zlato (minion 24, hrdina 180, uzel 70), tři itemy za 400 — Čepel
  (+25 % dmg), Aegis (+250 HP, −10 % incoming), Sandály (+15 % speed). Nákup
  jde přes sim (`buyItem`), online zprávou `{t:'buy'}` (proto 6). Rychlost
  hrdiny se bere z `heroSpeed()` — klientská predikce musí číst stejnou hodnotu,
  jinak se postava rozjíždí.
- **3v3:** místnost cap 6, tři na stranu, boti doplní zbytek; **duplicitní
  hrdina** se nahradí volným z poolu (`lastError` to řekne). Sim je na počet
  hrdinů nezávislý — 2v2/3v3 jsou jen data.
- **Co tu není:** mlha války, dotyk na mobilu, VR. Nehlásit jako hotové.
- **Testy:** `npx tsx apps/nirvana/test/moba-sim.mjs` (21 kontrol, pravidla)
  a `node apps/nirvana/e2e/first-world.mjs` (11 kontrol, hra v prohlížeči;
  Chromium z puppeteer cache, playwright verzi nemá).

### Doplňující vlna (2026-11-02)

- **Sólo i MP boti jsou jeden modul** (`core/arena/bot.ts`). Sólový dostřel
  je teď **reálný hitscan** přes `pickTarget`, ne 42% pravděpodobnost —
  jinak by sólo a MP boti byli dva různí typy nepřátel.
- **Úroveň mění jen parametry mozku** (`BOT_SKILLS`: přesnost, kadence,
  rychlost), **nikdy damage**. Kdo do `BOT_SKILLS` přidá `damage`, rozbije
  tím „trefil jsem ho a nic" — damage drží výhradně `WEAPONS`.
- **Pickupy mají tři druhy** (`health`/`armor`/`ammo`) — barva je v obou
  klientech i na serveru na třech místech; přidání čtvrtého druhu znamená
  `map.ts` + oba renderery + serverový handler v `arena.ts`.
- **Zvuk v MP hraje klient**, server ho neposílá. Výstřel = lokální (s
  cooldownem dle `WEAPONS`), zásah = **pokles HP ve snapshotu**, kill/
  respawn/pickup = eventy. Server je autorita zásahů, ne zvuku.
- **`useRef(WEAPONS.mg.ammo)` inferuje literální typ `50`** — zápis
  `ref.current = číslo` pak spadne na typu. Píši `useRef<number>(...)`.

## Mobilní ovládání a responsivita (2026-11-02)

- **Dvě cesty vstupu, ne jedna.** Hry, které čtou klávesnici (Venuše, pouť),
  dostanou `TouchButton` z `core/games/TouchPad.tsx` — pošle syntetický
  `keydown`/`keyup`, takže hra nemá druhý vstup. FPS (Mars) potřebuje
  `core/arena/ArenaTouch.tsx`, protože pohled je **spojitý pohyb**, ne stisk.
  Nutit FPS do syntetických kláves = nehratelná hra.
- **`requestPointerLock` na mobilu neexistuje.** Aréna bez `ArenaTouch`
  znamenala, že se hráč nerozhlédne vůbec — ne že se rozhlíží špatně.
- **Dotykový stav jde refem, ne React state.** `ArenaTouchState` se čte
  v `useFrame`; přes state by se 60×/s překresloval celý 3D strom.
  `readTouch()` ho aplikuje do **stejných refů** jako klávesnice, takže
  `MarsArena`/`MarsMultiplayer` nemají dvě větve vstupu.
- **`stopPropagation` v `TouchButton` je povinné.** Bez něj stisk rozjede
  hru i při psaní do inputu (přesně tahle chyba se stala u chatu na Venuši).
- **`pointerRef` v pouti se nikde nenastavoval** — arkády (Pong, Breakout,
  Asteroidy) nereagovaly na myš ani dotyk, jen na klávesy. Od 2026-11-02 ho
  plní `onCanvasPointer` na plátně (`pointermove` + `pointerdown`), rozsah
  **0..1** (hry to tak čekají: pong `pointer * GAME_W`, asteroidy
  `(pointerX - 0.5) * 3`). Kdo přidá novou hru, musí pointer číst stejně.
- **Herní HUD patří na mobilu NAHORU.** `.arena-hud` i `.race-hud` seděly
  `bottom: 1,1rem` — přesně v místě joysticku a PALBY. Přesun je v
  `@media (hover: none) and (pointer: coarse)`, spolu s `.arena-tip`
  a tabulemi (`.arena-board`/`.race-board` na `top: 4,6rem`).
- **`.game-hud` se zalamuje, ne ořezává.** `overflow-x: auto` na ≤900 px
  schovalo žetony a ZION za okraj — nebyly vidět vůbec.
- **Během hry schovej navigaci a chat** (`body[data-playing='1']`, nastavuje
  a v cleanupu uklízí každá herní stránka). Bez toho zbývá na hru ~640 px
  z 844 a joystick leží na liště. **Nová hra to musí nastavovat taky.**
- **3D popisky (`drei <Html>`) potřebují `zIndexRange`.** Bez něj lezou nad
  chrome (`z-index: 12`→`20` v pouti) a „RUSKÉ KOLO" se překrývalo
  s titulem. Na ≤760 px se popisky schovávají úplně — panel je vypisuje.
- **Audit musí do hry opravdu vstoupit.** `e2e/mobile-audit.mjs` klikne na
  start a počítá konkrétní selektor (`.arena-touch`/`.touch-pad`/
  `.duel-touch`/`.park-touch`). První verze počítala „tlačítka ve spodní
  půlce" a prošla s jediným tlačítkem chatu — falešná zelená.
- **Deploy z git worktree: `node_modules` nesmí být symlink.** Next si
  symlinku všimne i ve standalone stromu (`.next/standalone/node_modules`
  → symlink), takže `next` v artefaktu chybí a server padne na
  `Cannot find module 'next'` (a deploy se rollbackne). Používej
  `cp -al` (hardlink klon), ne `ln -s`. A `cp -a` přes symlink píše
  **do cíle symlinku** — takhle jsem si zanesl `next` do hlavního stromu.
- **Po každém commitu zkontroluj `PROTO_VERSION` proti živému netu.**
  Paralelní session dělá `git add` přes celý strom a strhne cizí staged
  soubory; tak se proto 5 dostal do commitu, který měl být jen o mobilu,
  a produkce 35 minut vracela `proto_mismatch`. Kontrola:
  `grep PROTO_VERSION src/core/net/protocol.ts` vs
  `curl -s https://nirvana.zionterranova.com/net/health`.
- **Meze:** netestováno na skutečném telefonu (jen headless Chromium
  s `isMobile`/`hasTouch`), landscape jen media query, žádný gyroskop
  ani haptika.
- **Deploy ověřuje protokol sám.** `deploy-nirvana.sh` volá
  `scripts/ops/nirvana-proto-check.sh` a zastaví se, když je klient novější
  než net. Obejít jen vědomě: `ZION_SKIP_PROTO_CHECK=1`.
- **Citlivost pohledu** je násobek 0,4–2,5× v `core/arena/settings.ts`
  (localStorage, mezipaměť kvůli `pointermove` 60×/s). Ovladač je v panelu
  arény a jen na `coarse`.
- **Úklid disku umí zabít build i audit.** 2026-11-02 zmizel `node_modules`,
  `.next` i puppeteer cache. Po úklidu: `npm ci --ignore-scripts`
  (bez `--ignore-scripts` padá `db:generate -w zion-marketplace`) a audit
  si sám najde systémový Chrome, když cache chybí.

### MOBA `/earth` na dotyku (2026-11-02)

- **Kouzla nejsou Q/W/E/R.** `W` je pohyb vpřed (WASD), takže slot `W`
  je klávesa **`F`** (`core/moba/keys.ts`). Sloty zůstávají `Q/W/E/R` —
  je to identita kouzla v sim, snapshotu i protokolu; přejmenovat slot
  znamená sáhnout na síť. UI zobrazuje `SPELL_LABEL`, nikdy `slot`.
- **Dotyk posílá hře tytéž události, ne nový vstup.** `MobaTouch.tsx`
  dispatchuje `keydown`/`keyup` (joystick, kouzla) a `pointerdown` (útok).
  Herní smyčka zůstala nedotčená — kdyby se do ní přidala druhá větev
  vstupu, rozejde se to se sítí.
- **Útok se drží 140 ms.** Hra čte `attack` jednou za snímek; krátký ťuk
  nastaví `true` i `false` mezi dvěma snímky a hrdina nezaútočí.
- **Zamíření se jen odposlouchává** (`pointerdown` na `window`, capture).
  Vrstva nad plátnem s `pointer-events: auto` by sežrala ťuk a hra by
  vůbec neútočila.
- **`downPointer` musí nastavit i `pointer`** (volá `move(event)`). Dotyk
  neposílá `pointermove`, takže bez toho se kouzlo seslalo na poslední
  staré místo — a to samé platilo pro klik myší bez pohybu.
- **Test musí být funkční, ne vizuální.** Audit u `/earth` ověřuje, že
  joystick pošle `KeyW` a že kouzlo **sníží manu** (482 → 455). Počítání
  tlačítek by prošlo i s tlačítky, která nic nedělají.

## Link engine — jednotný engine pro linky a kameru (2026-11-02)

- **Jeden registr, jedna framing funkce, jedna cesta přeletu.** `LinkEngine`
  (`core/scene/universe/LinkEngine.ts`) drží všechny „linkovatelné“ body scény
  (planety, brána, stanice, archa, flotila, Měsíc, Slunce, Země). Každý má
  `anchor(ctx)` ve světových souřadnicích a `frameFor()` z něj spočítá kameru.
  Kdo přidá nový bod, přidá **jeden záznam** — ne druhou kopii výpočtu
  vzdálenosti (`size*3.4+1.6`) do dalšího souboru.
- **Pohyblivý cíl se počítá každý frame.** Během přeletu se destinace
  přepočítává z živého `anchor()`, takže planeta neuletí. Po příletu engine
  posouvá kameru i `controls.target` o **deltu** anchoru — tím zůstane cíl
  v záběru a uživatel může dál rotovat/zoomovat. Dřívější „lerp zpět na
  pevný offset“ bojoval s myší.
- **Kamera se neposílá z komponent.** `flyTo(id)` jen označí cíl; skutečný
  přelet spustí `update(ctx, delta)` ve `useFrame` s živým kontextem. Zmizely
  hacky `camera: null as any` (Shell) a `window.__nirvanaCamera` (SolarSystem).
  `Shell` má jedinou mapu `PORTAL_FOCUS` portál → cíl.
- **Jeden typ fokusu.** `UniverseFocus` (`earth | sun | jupiter | mars | venus |
  mercury | fleet | moon | archa | issobella | gate`) používají `Shell`,
  `SceneRoot` i `Universe`. Přidání cíle = jeden člen unie + jeden registr.
- **Planety jsou v `planetCatalog.ts`, ne v rendereru.** `SolarSystem.tsx`
  je jen vykresluje a re-exportuje kvůli zpětné kompatibilitě. Kdyby katalog
  zůstal v rendereru, `LinkEngine` by ho importoval a vznikl kruhový import.
- **Archa má jednu formuli.** `arkPosition(t)` v `positions.ts` počítá světovou
  polohu přes `THREE.Euler(ARK_TILT)` — přesně tu rotaci, kterou má `orbit`
  group v `SailingArk.tsx`. Dřív fokus aproximoval `earthPos + (12,0.8,6)`
  a kamera míjela loď.
- **Linky kreslí `LinkLayer`.** Data (co je s čím spojené) drží
  `DEFAULT_LINK_EDGES`, styl `links.ts`, renderer `LinkLayer.tsx` (předalokované
  buffery, žádná alokace ve frame). Spoj, který se dotýká označeného bodu,
  svítí. Trvalé linky (dráhy, osy) zůstávají v `SolarSystem`/`links.ts` — jsou
  to jiné prvky než spoje mezi body.
- **Označený bod je vidět a jde se vrátit.** `LinkNavHud` čte engine přes
  `subscribe` (ne polling) a nabízí `← Země`; `Escape` dělá totéž. Na Zemi se
  HUD schová.
- **Test bez prohlížeče:** `npx tsx apps/nirvana/test/links.mjs` — 26 kontrol
  (anchory konečné, přelet na Mars skončí u Marsu, návrat na Zemi, sledování
  pohyblivého cíle, `frameFor` respektuje velikost, `arkPosition` = Euler).
- **Ověřeno headless (Chromium):** `/` má 175 draw calls / 90 444 tris /
  40 textur / 0 invalid vertices; klik na Merkur přiletí (kamera se posune
  >5 j.), panel se otevře, HUD + `← Země` jsou vidět; klik na Jupiter přiletí
  k Jupiteru (dist od Slunce ~69,5 — dřív kamera letěla k Slunci), `← Země`
  vrátí a HUD zmizí. Jediná konzolová chyba je pre-existing `401` z
  `/api/auth/me`.

## Jednotný design pohybu a linek (2026-11-02)

- **Jedna čísla pro všechny přechody:** `core/design/motion.ts` drží
  `MOTION` (fast/base/slow/veil/fly + `followRate`) a `dampFactor` /
  `easeOutCubic`. CSS protějšek jsou `--zion-motion-*` a `--zion-ease*`
  v `globals.css`; hodnoty musí zůstat v syncu.
- **Kamera v každé scéně dohání stejně.** `camera.position.lerp(..., dampFactor(delta))`
  nahradilo `dt*4.5` (Venuše), `0.15` (pouť), `delta*9` (gondola) i
  `1-exp(-6*…)` (Merkur). Frame-rate independent: při 15 fps nezpomalí.
  Kdo přidá třetí herní kameru, použije `dampFactor`, ne vlastní konstantu.
- **Jedna čísla pro všechny linky:** `core/design/links.ts` (`LINK_COLOR`,
  `LINK_WIDTH`, `LINK_OPACITY`, `LINK_ACTIVE_OPACITY`, `LINK_KINDS`,
  `orbitWidth`). `scene/universe/links.ts` je jen re-export kvůli starým
  importům — nový kód importuje z `@/core/design/links`.
- **`LINK_KINDS`** rozlišuje dráhu / osu / trasu / stopu / prstenec / spoj
  (šířka + klidová a aktivní průhlednost). `LinkLayer` bere styl odsud,
  ne z vlastních konstant.
- **Meze jazyka:** ornamenty (jantra, prstence Slunce, Issobella ring, stanice,
  brána) a interaktivní tint planety zůstávají mimo — jsou to předměty, ne
  linky. Herní geometrie (okraj tratě, klec) je gameplay, ne linka.
- **CSS tokeny** používají `.portal-veil`, `.planet-chip`, `.link-nav-*`.
  Kdo píše nový přechod, použije `var(--zion-motion-*) var(--zion-ease*)`,
  ne novou milisekundu.
- **Test:** `npx tsx apps/nirvana/test/links.mjs` (37 kontrol) ověřuje i
  `dampFactor` (60 fps ~0,14), konvergenci `damp`, `easeOutCubic` a `motionCss`.

## Navigační engine — odkazy na planety, světy a L5 (2026-11-02)

- **„Link“ = odkaz/navigační cíl, ne vizuální čára.** Jeden registr
  (`LinkEngine`) drží **všechno, na co jde kliknout a přiletět**: planety,
  světy L4/L6, L5 misie na glóbu, stanici, Měsíc, flotilu, archu, bránu, Slunce.
  Vizuální linky jsou jiná věc (`core/design/links.ts`).
- **`focus` je `string`, ne unie.** Cílem může být `earth`, `mars`,
  `mission:<key>`, `world:<id>`. Kdo přidá nový typ cíle, nemusí rozšiřovat
  typovou unii ve třech souborech — zaregistruje id v engine.
- **Světy jsou data, ne komponenty.** `registerWorldTargets(engine, worlds)`
  (volá `Universe` po načtení katalogu) vytvoří `world:<id>` pro prstencové
  (L6) i oběžné (L4) světy a smaže ty, které z katalogu zmizely.
- **L5 misie jsou statické cíle.** `mission:<key>` pro `EARTH_MISSIONS`
  s `anchor()` na rotujícím glóbu Nové Země.
- **Rotace musí být funkce času, ne akumulátor.** Glóbus (`0,02·t`), pás světů
  (`0,05·t`) a prstenec Issobelly (`0,03·t`) nastavují `rotation.y = f(t)`
  (`GLOBE_SPIN_SPEED` / `ORBIT_BELT_SPEED` / `RING_SPIN_SPEED`). Kdyby scéna
  dál dělala `+= delta·speed`, fokus by na svět/misii míjel (stejná past jako
  u archy a flotily).
- **Jedno chování kliknutí:** klik na planetu, svět i L5 misii = přiletět +
  otevřít panel ve stejném designu (`.planet-panel`). L5 už neotevírá nový
  tab (`window.open`) — otevírá panel s CTA na interní prezentaci, teprve
  ta vede na web.
- **Světy se přiblíží.** Dřív klik na svět otevřel jen portál a kamera
  zůstala na Zemi; teď `selectWorld` nastaví `focus='world:<id>'`.
- **HUD sousedé** (`LinkNavHud`) umí skočit na propojený bod a `← Země`;
  `onFocus` je `string`, takže projde i `world:`/`mission:`.
- **Test:** `npx tsx apps/nirvana/test/links.mjs` (60 kontrol) ověřuje
  registr misií a světů, `flyTo('mission:uluru')`, `flyTo('world:…')`,
  mazání stale světů, plus motion tokeny.
- **Debug hook:** `window.__nirvanaLink` (vedle `__nirvanaCamera`) — používá
  se v headless testech k `flyTo` bez klikání do 3D.

## PRVNÍ SVĚT — školy kouzel a ochrana struktur (2026-11-02)

- **Školy kouzel se liší mechanikou, ne jen číslem.** `SCHOOL_TRAITS`
  v `core/moba/spells.ts` je jediná tabulka: ward kryje štítem spojence, oheň
  pálí 3 s (DoT), šíp prolétne skrz, čepel a stín dorážejí zraněné, kosmické
  vrací manu, mysl strhne štít, příroda a píseň léčí postupně, bouře řetězí,
  bestie skáče do šířky. Kdo přidá další chování, přidá **řádek sem** a
  zpracování do `applyOnHit` v `sim.ts` — ne druhou větev v každém kouzle.
- **Hoření a regenerace jsou buffy** (`BuffType` `'burn'` / `'regen'`), ne
  nový stav hrdiny. Sim je počítá každý snímek; `source` nese id sesilatele,
  aby se zabití připsalo správnému hrdinovi. Když se buffy začnou zobrazovat
  v HUD, `BuffType` je zároveň seznam, který je potřeba vykreslit.
- **Ochrana struktur je jedna funkce** (`isStructureProtected` v `core/moba/map.ts`)
  a používají ji **sim, 3D scéna i minimapa**. Pravidlo: vnější věž kryje
  vnitřní, Nexa je nedobytná, dokud nepadne **celá jedna lajna** (vnější +
  vnitřní věž). Kdyby pravidlo existovalo dvakrát, hráč by mlátil do věže,
  která je podle klienta zničitelná a podle serveru ne.
- **Nedobytné struktury svítí šedě** (`#64748b`), a to v `MobaStage`
  (krystal + emissive) i na minimapě. Bez toho hráč nepozná, proč se nic neděje.
- **`damageNexus` v debug háčku obchází pravidla** (sahá přímo na HP), takže
  se hodí na test konce zápasu, ale **nedokazuje** ochranu. Ochranu hlídá
  `test/moba-sim.mjs`.

### Testy, které byly rozbité (a jak)

- **`test/moba-sim.mjs` padal ještě před touhle změnou:** hrdina v testu věže
  umřel a testy 7–8 s ním pak hýbaly jako s živým. Řešení: `revive(hero)`
  před každým krokem, který počítá s živým hrdinou.
- **`nirvana-net/test/moba.mjs` byl napsaný na 3v3**, ale server je od
  commitu `f9d971f94` **5v5** (`MOBA_ROOM_SIZE = 10`). Test teď čte
  `room.maxPlayers` a ověřuje „sudá a ≥ 2" + vyrovnané strany — přežije
  další změnu velikosti týmu.
- **E2E `e2e/first-world.mjs` měl tři chyby, které nesouvisely s pravidly:**
  (a) kouzlo se sesílalo na soupeře 60 m daleko (Q má dostřel 12), (b)
  `damageNexus(3400)` nechá Nexe 600 HP z 4000, (c) pevné `sleep` místo
  čekání na podmínku — simulace běží po krocích, takže na swiftshaderu se
  posune pomaleji než skutečné hodiny a test byl zelený jen na Macu.
  Řešení: teleport i seslání v **jednom** `evaluate` (bot se mezi dotazy
  pohne) a polling z Node (`waitFor`), ne `page.waitForFunction`.

### Prohlížeč v E2E

- **`e2e/_browser.mjs`** řeší Playwright/Puppeteer i cestu k Chromiu na
  jednom místě (dřív měl každý skript hardcoded `/Users/yeshuae/…`).
  Pořadí: `PLAYWRIGHT_MODULE` → `playwright` v projektu → puppeteer cache →
  systémový Chrome/Chromium (`CHROME_PATH` má přednost).
- **Puppeteer fallback** srovnává dva rozdíly: `browser.newPage({viewport})`
  a `waitUntil: 'networkidle'` → `'networkidle0'`. Víc E2E nepotřebuje.
- **Nikdy nepiš `page.waitForFunction(fn, args, opts)`** — Playwright a
  Puppeteer mají jiné pořadí argumentů. Polluj z Node.

## Jednotný hover kruh pro odkazy (2026-11-02, druhá vlna)

- **Jediný signál „tady se dá kliknout“ je kruh** (`NavHalo`). Najedeš na
  Slunce, planetu, svět L4/L6, L5 misii, Měsíc, flotilu, archu, bránu nebo
  stanici → objeví se stejný dvojitý prstenec v barvě cíle. Žádný název pod
  ním; jméno ukáže až panel po kliknutí. Dřív měl každý objekt jiný label
  (HTML chip u planet, 3D `TextLabel` u světů/misí/flotily/archy/Slunce).
- **`NavHalo`** (`core/scene/universe/NavHalo.tsx`) je billboard (otočený ke
  kameře), aditivní blend, `active` řídí rodič, barvu dodá akcent cíle.
  Používá ho: `SolarSystem` (planety, Jupiter Station), `HiranSun`,
  `OrbitalWorlds` (hovered instance), `IssobellaRing` + `IssobellaStation`,
  `NewEarth` (Měsíc + L5 misie), `SkyFleet`, `SailingArk`, `StarGate`.
- **Interaktivní objekty nemají jméno.** Planety s `game` přišly o HTML chip
  (`.planet-chip`); neinteraktivní planety (Saturn…) si nechaly tlumené jméno —
  nejsou to odkazy. Světy/misie/měsíc/flotila/archa/brána/Slunce přišly o 3D
  `TextLabel`. Kdo přidá nový odkaz, přidá `NavHalo`, ne jméno.
- **Vizuální spojnice jsou pryč.** `LinkLayer` (spoje mezi body) a `LinkTrail`
  (stopa kamery) byly smazány — user je nechtěl („linka“ ≠ odkaz).
  `DEFAULT_LINK_EDGES` v engine zůstává jen jako data pro HUD „skoč na…“.
- **Přínos:** textury ve scéně spadly z 40 na 21 (každý `TextLabel` je vlastní
  `CanvasTexture`), draw calls 175 → 153. Ověřeno headless.
- **Klik na planetu funguje dál** přes neviditelnou hit-sféru
  (`opacity: 0`, ne `visible={false}`) — ověřeno headless klikem na
  projekci Merkuru: `focus=mercury`, panel se otevřel.

## Saturn — Kroniky / Archiv kruhů (`/saturn`, 2026-11-02)

- **Prstence = hřbety knih.** 15 kapitol = `FREE_WORLD_MISSIONS` (L5 uzly).
  Hover = `NavHalo` (stejný jako ve vesmíru), klik = kapitola v panelu.
  Žádná jména ve 3D.
- **Barva hřbetu = stav** uzlu (`built` bílá, `preparation` cyan, `vision`
  fialová) — `MISSION_STATUS_COLOR`.
- **Vstup:** planeta Saturn má `game: 'saturn'` → ve vesmíru je odkaz
  (kruh, klik, panel `SATURN`) → `/saturn`. Přidán i do `GAME_LINKS`.
- **Routa je veřejná** (jako `/park`), mimo ZAP pass.
- **Textury** jsou `public/textures/2k_saturn.jpg` a
  `2k_saturn_ring_alpha.png`; prstenec má přemapované UV (radiální osa).
- **Rotace hřbetů** je `0,03·t` (deterministická), ne akumulátor.
- **Meze:** VR a mobil netestované; L4/L6 světy (411) v archivu nejsou —
  patří do `WorldPortal`; žádná animace otevírání knihy.

## PRVNÍ SVĚT — mlha války (2026-11-02, protokol 7)

- **Vidění drží jednotky, ne mapa.** `VISION` v `core/moba/map.ts`:
  hrdina 14 m, minion 8 m, věž 12 m, vlastněný uzel L5 10 m. Kdo chce jiná
  čísla, mění je tam — `visionSources()` v `sim.ts` je čte odtamtud.
- **Filtruje se až snapshot, ne sim.** Sim počítá celou mapu (monstra, boti
  i zásahy), `mobaSnapshot(state, viewerTeam)` zahodí to, co tým nevidí.
  Kdyby se filtrovala sim, AI by hrála naslepo a hra by se rozpadla.
- **Co se posílá vždy:** vlastní tým (i mrtvý — respawn timer), struktury
  a uzly L5. Bez struktur by mapa přestala být mapou.
- **Co se filtruje:** nepřátelští hrdinové (jen živí a vidění — mrtvý v mlze
  nemá prozradit, kde se objeví), minioni, monstra a projektily (projektil
  letící mlhou prozradí střelce).
- **`mobaSnapshot()` bez `viewerTeam` = divák/debug** a posílá všechno.
  Debug háček v sólu to používá schválně, aby testy viděly soupeře.
- **Server skládá snapshot jednou na tým**, ne na hráče. 5v5 × 15 Hz by
  jinak stavělo 10 snapshotů za tick.
- **Sólo má mlhu taky** (`MobaGame` posílá `you.team`) — jinak by sólo
  a multiplayer byla dvě různé hry.
- **PROTO_VERSION 7.** Formát zpráv se neměnil, ale **semantika ano**:
  starý klient by viděl celou mapu (cheat). Deploy **net první**.

### Pasti, na které jsem u toho narazil

- **Testy měly `proto: 6` jako literál na sedmi místech.** Bump shodil
  smoke/arena/fight. Teď importují `PROTO_VERSION` z protokolu
  (`../dist/nirvana/src/core/net/protocol.js`) — další bump je nerozbije.
- **`__mobaDebug` v `MobaOnline` se plnil v `useFrame`.** Když prohlížeč
  uspí kartu na pozadí, smyčka přestane běžet a háček navěky vrací starý
  snapshot (`time: 0`, prázdná pole) — v E2E to vypadá jako rozbitá hra,
  přitom server posílá správná data. Háček musí číst **refy**.
- **Dva prohlížeče v E2E: klávesy jdou jen do stránky vpředu.** Hra správně
  pouští vstup při `blur`, takže `page.keyboard.down()` na pozadí nic
  neudělá. Před vstupem volej `page.bringToFront()`.

## PRVNÍ SVĚT — ekonomika a postup (F1, 2026-11-03, protokol 8)

- **Bez ekonomiky není MOBA.** Do 3. 11. dávalo zlato jen zabití a XP jen
  zabiják; hráč, který prohrál linku, neměl cestu zpět. Konstanty jsou
  v `core/moba/sim.ts` (`PASSIVE_GOLD_PER_SEC`, `XP_SHARE_RADIUS`,
  `DENY_HP_RATIO`, `ASSIST_GOLD_RATIO`, `GOLD_LOSS_RATIO`, `GOLD_CAP`).
  Kdo je mění, mění je **tam** — HUD i testy je čtou odtamtud.
- **XP se sdílí, zlato ne.** XP dostávají hrdinové druhé strany v okruhu
  14 m (zabiják plnou, spojenci polovinu), zlato jen poslední rána.
  Deny (vlastní minion pod 50 % HP) dá nepříteli jen 50 % XP a žádné zlato.
- **Deny nemá vlastní tlačítko.** Je to poslední volba v automatickém útoku
  (nepřítel → monstrum → vlastní minion pod 50 %). Kdyby měl klávesu,
  rozejde se to s dotykovým ovládáním.
- **Stupeň kouzel se neposílá.** `spellRank(level, slot)` je čistá funkce
  v `spells.ts` (Q/W/E 1/4/7/10, R 6/11/15) a klient si ji počítá ze
  snapshotu. Kdyby se posílala, můžou se rozejít — a to je přesně chyba
  „vidím jiné číslo, než počítá server".
- **R je do 6. úrovně zamčená** (`castSpell` vrátí, než sáhne na manu).
  HUD to musí ukázat (`is-locked`), jinak hráč mačká mrtvou klávesu.
- **Struktury ničí jediná funkce** `damageTower()`. Používá ji hrdina
  i minion; odměnu (120 tým + 60 dorazivšímu, 120 XP) řeší tam. Když se
  přidá další útočník, volá tuhle funkci — ne `tower.hp -= …`.
- **Minioni útočí na věže**, když v dosahu není jednotka. Bez toho linka
  nikdy netlačí a hra se rozhoduje jen souboji hrdinů.
- **Boti musí utrácet.** `botBuild(hero)` v `sim.ts` vybírá podle školy Q
  (agresivní → čepel první, podpůrné → aegis). Bez nákupu by pasivní zlato
  zvýhodnilo jen člověka.
- **Snapshot nese `xp` a `xpNeed`** → `PROTO_VERSION 8`, deploy **net první**.
- **Testy:** `npx tsx test/moba-sim.mjs` (77 kontrol, z toho 12 na ekonomiku,
  deny, stupně kouzel a nákup bota).

## PRVNÍ SVĚT — itemy a obchod (F2, 2026-11-03, protokol 9)

- **Bonusy itemů se sčítají, ne větví.** `ITEMS` v `sim.ts` má u každého itemu
  `bonus` (damage/armor/hp/mana/speed/regen/vision) a `itemTotals(items)` je
  jediné místo, odkud čte poškození, obrana, rychlost, vidění i regenerace.
  Nový item = jeden záznam v `ITEMS`, ne nová větev v sim.
- **Maxima se dopočítávají** (`recomputeHeroStats`): `maxHp = baseMaxHp +
  (level−1)·55 + itemy`. Kdyby se přičítala inkrementálně jako dřív, prodej
  itemu by nechal hrdinovi navíc HP a hráč by z toho mohl těžit.
- **Recepty:** `components` + `cost` = cena hotového itemu. Při nákupu se
  vlastněné komponenty **spotřebují** a platí se `cost − cena komponent`;
  slot se tím uvolní, takže složení jde i s plným inventářem (6 slotů).
- **Prodej** je 60 % ceny (`SELL_RATIO`) a jde kliknutím na slot v inventáři —
  samostatné tlačítko by na mobilu nemělo místo.
- **Orlí oko je protihra mlhy:** `visionSources()` přičítá `itemTotals().vision`
  k radiusu hrdiny. Item, který mění vidění, musí jít tudy — ne druhou cestou.
- **Obchod v multiplayeru byl mrtvý.** Protokol zprávu `buy` od protokolu 6
  parsoval, ale `index.ts` ji nikdy nezpracoval; test to maskoval, protože
  kontroloval jen „bez zlata nekoupí" (což platilo i bez handleru). Od F2 je
  tam `case 'buy'` i `case 'sell'` a test kupuje Tesák (300 < start 320).
- **Test „bez zlata nekoupí" nesmí porovnávat zlato přesně** — od F1 roste
  pasivně (2/s). Porovnává se jen, že se neutratilo.
- **PROTO_VERSION 9** (nová id itemů v inventáři) → deploy **net první**.
- **Net itemy:** `parseClient` validuje id proti `ITEMS`, ne proti ručnímu
  seznamu — když se přidá item, nemusí se sahat do protokolu.
- **Testy:** `test/moba-sim.mjs` (92 kontrol: recepty, sloty, prodej, efekty)
  a `apps/nirvana-net/test/moba.mjs` (22, včetně buy/sell proti serveru).

## PRVNÍ SVĚT — mapa: bushe, inhibitory, super minioni (F3, 2026-11-03, protokol 10)

- **Bush je past na vidění, ne dekorace.** `BUSHES` v `map.ts` (8 keřů) +
  `bushAt()`; v `mobaSnapshot` platí: jednotka v bushi je vidět, jen když je
  zdroj vidění blíž než `BUSH_REVEAL` (3,4 m). Sim vidí všechno — filtruje se
  až snapshot, stejně jako u mlhy. Kdo přidá keř, přidá ho do `BUSHES`
  a objeví se i na minimapě (kreslí se z téhož pole).
- **Řeka je jen vizuál** (pás `RIVER` ve středu). Nezpomaluje — trestal by
  půlku mapy a nikdo by přes ni nešel.
- **Řetěz krytí má čtyři články:** vnější → vnitřní → základnová → inhibitor.
  Nexa je odemčená, jakmile padne **inhibitor** na kterékoli lince
  (`isStructureProtected`). Když se řetěz rozbije, hráč mlátí do věže, která
  se podle klienta dá zničit, a nic se neděje — jeden zdroj pravdy, tři
  konzumenti (sim, scéna, minimapa).
- **Inhibitor nestřílí** (`damage 0`, `range 0`) — jeho hodnota je v tom, že
  po pádu pouští do linky **super miniona** a po `INHIBITOR_RESPAWN_MS`
  (5 min) vyroste zpátky. Respawn řeší smyčka věží (`tower.respawnAt`).
- **Minion má vlastní staty** (`damage/range/attackMs/speed/super`), ne
  globální konstanty. Super minion (680 HP, 42 dmg, 2× zlato a XP) se pozná
  v sim, ve scéně (větší) i na minimapě (větší čtvereček). Nový typ miniona
  = nová položka ve `spawnMinion`, ne druhá smyčka.
- **Počty struktur:** 26 (18 věží + 6 inhibitorů + 2 Nexy). Testy i E2E
  kontrolují tenhle počet — když se mapa rozšíří, musí se změnit na jednom
  místě (test i `STRUCTURES`).
- **PROTO_VERSION 10** (`kind: 'inhibitor'`, `super` u minionů) → deploy
  **net první**.
- **Testy:** `test/moba-sim.mjs` (105 kontrol: bush z dálky/zblízka, řetěz
  krytí, super minion po pádu inhibitoru, respawn).

### Past, která se málem stala

- **Root `node_modules` se rozbil** (chyběl `.bin/tsc` a @types) — `npx tsc`
  začal vracet „This is not the tsc command" a `next/server` nešel najít.
  Pozná se to podle `ls node_modules/.bin`; řeší `npm ci` v rootu. Před
  deployem zkontroluj, že typecheck opravdu proběhl — jinak se „čistý"
  build vydává za ověřený.

## PRVNÍ SVĚT — objektivy: runy, boss, Aegis (F4, 2026-11-03, protokol 11)

- **Runy jsou rozhodovací bod, ne dekorace.** Dvě místa (`RUNE_SPOTS`), každé
  2 minuty (`RUNE_INTERVAL_MS`), druh se posouvá s cyklem (`makeRunes`) —
  deterministicky, aby obě strany hrály stejnou hru. Sebere je první hrdina
  do 2,4 m: bounty +120 zlata, haste +35 % speed, power +30 % dmg na 10 s.
- **Runy existují už na startu** (`createMobaMatch` je naplní `makeRunes(0,0)`),
  ne až prvním tickem — jinak by je hráč na začátku neviděl a testy by
  procházely nad prázdnem.
- **Boss sílí s časem** (`makeBoss(minutes)`): +14 % HP a +8 % dmg za minutu,
  respawn 8 min. Škáluje se **při respawnu**, ne každý frame — jinak by
  hodnoty skákaly i během souboje.
- **Aegis je v `damageHero`, ne v drop logice.** Když hrdina umře a má
  `aegis`, vzkřísí se na 60 % HP, `deaths` se nezvýší a zlato se nestrhne.
  Kdo přidá druhou smrt (např. `damageMonster`), musí tudy taky projít.
- **Kouzla mají stupně i v maně a cooldownu** (`spellMana`, `spellCooldown`).
  HUD i sim volají **stejné funkce** — kdyby si klient počítal vlastní čísla,
  ukazoval by jinou cenu, než jakou server strhne.
- **Debug háček nese `runes` a `boss`** — E2E tak ověří objektivy bez klikání.
- **Test útoku musí poslat `attack: true`.** `advance()` s `NO_INPUT` hrdinu
  jen postaví; bez útoku boss nespadne (přesně to první test odhalil).
- **PROTO_VERSION 11** (`runes`, `boss`, `aegis` u hrdiny) → deploy **net první**.
- **Testy:** `test/moba-sim.mjs` (119 kontrol: runy na startu, sebrání, boss
  scaling/zabití, Aegis vzkříšení bez smrti, stupňování many i cooldownu).

## PRVNÍ SVĚT — vidění a smrt (F5, 2026-11-03, protokol 12)

- **Ward je spotřební item, ne build.** `ward` v `ITEMS` má `consumable: true`,
  kupuje se do `hero.wards` (max 3) a **nezabírá slot** — jinak by si hráč
  vyhodil build kvůli vidění. Cena 150, životnost 90 s, vidění 10 m.
- **Ward se pokládá klávesou `G`** (na dotyku tlačítko 🛡 v `MobaTouch`), bod
  bere z kurzoru stejně jako kouzlo. Sim kontroluje dosah 12 m a zásobu;
  klient nikdy nerozhoduje, jestli ward vznikl.
- **Vidění wardu jde přes `visionSources`** — díky tomu platí i proti mlze
  a bushům (bush filtr se ptá na vzdálenost zdroje). Kdo přidá další zdroj
  vidění, patří tam, ne do snapshotu.
- **Wardy vidí jen vlastní tým** (`snapshot.wards` se filtruje `viewerTeam`).
  Nepřítel o nich nesmí vědět — jinak by je chodil ničit.
- **Buyback** (`buyback(hero, now)`): cena `200 + 50×level`, návrat na 60 % HP
  do spawnu, cooldown 180 s. Cena roste s levelem, aby se nevyplatil pořád;
  cooldown brání dvojímu vzkříšení v jednom souboji.
- **Respawn je konstanta, ne magické číslo:** `RESPAWN_BASE_MS + level ×
  RESPAWN_PER_LEVEL_MS` (5 s + 1,5 s/level). Když se mění, mění se tam.
- **Buyback tlačítko je jen v overlayeru smrti** a jen když je dostupné
  (`buybackCost > 0` ze snapshotu) — jinak by hráč mačkal mrtvé tlačítko.
- **PROTO_VERSION 12** (zprávy `ward`/`buyback`, `wards` ve snapshotu,
  `buybackCost` u hrdiny) → deploy **net první**.
- **Testy:** `test/moba-sim.mjs` (133 kontrol: nákup/limit wardu, položení
  mimo dosah, vidění skrz bush, expirace po 90 s, buyback cena/HP/cooldown,
  respawn scaling).

## PRVNÍ SVĚT — meta: scoreboard a obtížnost (F6, 2026-11-03, protokol 13)

- **Scoreboard žije ze snapshotu.** Sim počítá `damageDone`/`healingDone`
  (léčení i z regenerace), snapshot je posílá jako `damage`/`healing`.
  Kdyby si klient počítal vlastní čísla, nikdy by neseděla se serverem.
- **GPM/XPM se dopočítávají z snapshotu:** zlato / minuty a `totalXpAt(level, xp)`
  / minuty. Proto existuje `totalXpAt` — bez něj by XPM nešlo spočítat.
- **Obtížnost botů mění jen rozhodování** (`BOT_SKILLS`: přesnost míření,
  kadence kouzel, ochota ustoupit). Nikdy poškození — jinak by „hard" byla
  jiná hra, ne lepší soupeř. V online drží server `normal`, sólo si vybírá
  na pick screenu.
- **Míření botů je deterministické** (sin-hash z času a pozice), takže stejná
  hra dá stejný výsledek — testy na tom staví.
- **`botCasts` je diagnostický čítač** (neposílá se) — test obtížnosti
  porovnává, kolik kouzel bot za stejný čas sešle.
- **Pozor na wrapper komponenty:** `MobaGame` je jen obal nad `SoloController`
  a **musí přeposílat všechny request refy**. Zahazoval `sellRequest` a
  `buybackRequest`, takže prodej itemů a buyback v sólu od F2/F5 tiše
  nefungovaly (page je předávala dál, ale komponenta je nepřevzala).
  Když se přidá nový ref, zkontroluj obě úrovně.
- **Tab přepíná scoreboard** a je to `event.preventDefault()` — jinak by
  prohlížeč odvedl fokus z plátna.
- **PROTO_VERSION 13** (`damage`/`healing` ve snapshotu) → deploy **net první**.
- **Testy:** `test/moba-sim.mjs` (140 kontrol: obtížnost, poškození/léčení
  ve snapshotu, totalXpAt) a E2E scoreboard (dvě tabulky).

## PRVNÍ SVĚT — aktivní itemy (F7, 2026-11-03, protokol 14)

- **Aktivní item je schopnost, ne pasivní bonus.** `MobaItem.active`
  (`kind`, `cooldownMs`, `power`) + `useItem()` v sim. Efekt (blink, štít,
  léčení, rychlost) drží **server**; klient posílá jen id a bod.
- **Klávesy 1–6 = sloty inventáře.** Klik na slot v HUD posílá **stejnou
  syntetickou klávesu**, takže dotyk nepotřebuje druhý vstup (stejný trik
  jako ward a kouzla). Prodej aktivního itemu je malé × v rohu slotu —
  kdyby celý slot prodával, hráč by item omylem vyhodil.
- **Cooldowny itemů jsou ve snapshotu** (`itemCooldowns`, zbytek v ms).
  Sim drží absolutní sim čas, snapshot posílá zbytek — klient nikdy nepočítá
  vlastní časovač.
- **🔴 `heroSpeed()` používal `Date.now()`, ale buffy jsou v sim hodinách.**
  Rychlostní buffy z run, Přívalu i džungle proto **nikdy nefungovaly** —
  `buff.until` (sim čas ~10⁶) byl vždy menší než reálné hodiny (~10¹²).
  Teď má `heroSpeed(hero, now)` a sim předává `state.now`; kdo funkci volá
  mimo sim (testy), musí předat sim čas, jinak měří něco jiného.
- **Predikce v online bere rychlost z `itemTotals`** (boty, runy, Příval),
  ne z konstanty 6,2 — jinak se postava se serverem rozejde a dorovnává.
  Další tabulka čísel v klientovi by byla druhá pravda.
- **PROTO_VERSION 14** (`use`, `itemCooldowns`) → deploy **net první**.
- **Testy:** `test/moba-sim.mjs` (150 kontrol: blink s limitem 7 m, cooldown
  blokuje druhé použití, štít/léčení/rychlost, cizí i pasivní item nejde použít).

## PRVNÍ SVĚT — talent strom (F8, 2026-11-03, protokol 15)

- **Talenty jsou data, ne kód.** `TALENTS` v `sim.ts` má tři archetypy
  (aggressive/support/control) × dva stupně (10 a 15) × dvě volby. Archetyp
  plyne ze **školy Q** (`talentRole`), takže každá postava má jinou nabídku
  bez ruční tabulky pro 200 avatarů.
- **Efekt se sčítá na jednom místě** (`talentTotals`) a aplikuje se v šesti
  výpočtech: `damageOut`, `heroSpeed`, `recomputeHeroStats` (HP/mana),
  `visionSources`, regenerace v kroku a síla kouzel v `castSpell`. Nový druh
  bonusu = přidat do `TalentEffect` a na **všech** těch místech, jinak se
  talent „neprojeví".
- **`pendingTalent` je odvozený stav**, ne uložený: tier, na který hrdina má
  level a ještě ho nevybral. Díky tomu se nedá „zapomenout" vybrat a snapshot
  ho posílá jen jako `talentPending`.
- **`pickTalent` validuje tier i index** a volá `recomputeHeroStats` — bez
  toho by +HP talent nezměnil maxima.
- **Boti si volí sami** (deterministicky podle `state.seq`), jinak by po
  levelu 10 zůstali bez bonusů a hráč by měl nefér výhodu.
- **HUD panel je jen dokud je co vybrat** (`talentPending != null`) a volba
  jde přes ref (`talentRequest`) — sólo ji aplikuje v sim, online pošle
  zprávu `talent`. Klient nikdy neposílá efekt, jen index.
- **PROTO_VERSION 15** → deploy **net první**.
- **Testy:** `test/moba-sim.mjs` (162 kontrol: čekání na 10/15, neplatný
  index, dvojitá volba, součet efektů, role ze školy, bot si vybere sám).

## PRVNÍ SVĚT — boti a aktivní itemy (F9, 2026-11-03)

- **Botí build obsahuje aktiva podle archetypu** (`botBuild`): agresivní
  čepel → boty → skok → aegis; podpůrný aegis → bariéra → boty → čepel;
  kontrolní boty → bariéra → čepel. Bez toho měl po F7 hráč výhodu timingu.
- **Používání je reaktivní, ne náhodné:** léčení pod 55 % HP, bariéra pod
  70 %, skok na dotahovačku (8–14 m) nebo na útěk, Příval při pronásledování.
  Všechno jde přes `useItem`, takže **cooldowny hlídá sim** — bot si nesmí
  vést vlastní časovač (druhá pravda = rozjeté chování).
- **`activeItemOf(hero, kind)`** hledá item podle druhu schopnosti (`shield`,
  `heal`, `haste`, `blink`), ne podle id — když se přidá druhý štít, bot ho
  najde taky.
- **Bot se rozhoduje deterministicky** (žádné `Math.random`), takže simulace
  i testy jsou reprodukovatelné.
- **Testy:** `test/moba-sim.mjs` (166 kontrol: bot koupí aktivum, vyléčí se
  v ohrožení, skočí na cíl).

## PRVNÍ SVĚT — neviditelnost a sentry (F10, 2026-11-03, protokol 16)

- **Neviditelnost je filtr vidění, ne nová vrstva stavu.** Jedna funkce
  `isHidden(state, hero, viewerTeam)` rozhoduje za všechny: snapshot, cílení
  (`nearestEnemyHero`), věže, minioni i boss. Kdo přidá další jednotku, která
  může být skrytá, musí tudy taky projít — jinak půjde vidět v jednom místě
  a mizet v druhém.
- **Vlastní tým vidí vždy** (`hero.team === viewerTeam` → false). Neviditelnost
  je jen proti soupeři; bez toho by si hráč neviděl vlastní postavu.
- **Sentry je jediná protihra** — odhaluje v okruhu 8 m, nic víc. Není to
  zdroj vidění (to je ward); kdyby se obojí slilo, ztratí ward smysl.
- **Závoj je aktivní item** (kind `invisible`, 6 s, cooldown 30 s), takže jde
  přes stejnou cestu jako ostatní aktiva (`useItem`, klávesy 1–6).
- **Sentry je spotřební item** (max 2, klávesa `H`, na dotyku 🕯) — stejná
  logika jako ward, jen jiná zásoba (`hero.sentries`).
- **`isHidden` se ptá na sentry protistrany**, takže boss (neutrální) vidí
  jen to, co odhalila sentry kterékoli strany.
- **HUD musí ukázat vlastní neviditelnost** (`invisible` ve snapshotu) —
  jinak hráč nepozná, že je skrytý, a bude se divit, proč ho nikdo nevidí.
- **PROTO_VERSION 16** (`sentries`, `invisible`, zpráva `sentry`) → deploy
  **net první**.
- **Testy:** `test/moba-sim.mjs` (177 kontrol: Závoj skryje, vlastní tým vidí,
  sentry odhalí, nepřítel nevidí, expirace 60 s, skrytý nejde zasáhnout).

## PRVNÍ SVĚT — balance sehrávkou (2026-11-03)

- **Sehrávka jde udělat programově.** `test/moba-balance.mjs N` odehraje N
  zápasů bot vs bot (30 Hz, bez prohlížeče) a vypíše čas, věže, inhibitory,
  zabití, zlato, itemy, levely, runy a talenty. Jeden zápas ~1,5 s, takže
  24–32 zápasů je vzorek za půl minuty. Spouštěj po **každé** změně čísel.
- **První běh odhalil, že hra bez hráče nefunguje** — a to je přesně to, co
  by oko v prohlížeči nepoznalo (hráč boty „tahal" s sebou):
  1. boti **neopouštěli základnu** (chyběla linková chůze),
  2. `hero.botCast` zůstal po neúspěšném seslání → bot **zamrzl**,
  3. **chyběla fontána** → zraněný hrdina se nikdy nevyléčil,
  4. rozřazení do linek bylo asymetrické → modrá 6/6,
  5. timeout rozhodoval `blue >= red` → **12/12 timeoutů pro modrou**.
- **Nákup a talenty patří na začátek `stepBot`**, ne na konec: bez cíle
  v dosahu se funkce vrací dřív a bot by nekoupil ani si nevybral.
- **Botí rozhodování má záběr 12 m.** Dřív viděl nepřítele po celé mapě a jen
  ho honil — 100 s a level 1, protože nikdy nebyl u umírajících minionů.
- **Cíle (runy, boss) musí být explicitní větev v AI.** Dokud tam nebyly,
  boti je nikdy nevzali (0 run / 0 boss), i když je mapa měla.
- **Čísla po sehrávce (24 zápasů):** 342 s průměr, 58 % končí Nexou,
  10/14 výher, 11 věží, 1,8 inhibitoru, 7,5 zabití, level 8,8, 3,7 itemu.
  Ber to jako **hratelné, ne vyladěné** — další iterace chce 100+ zápasů
  a lidské sehrávky.

## PRVNÍ SVĚT — terén a grafika (F11, 2026-11-03)

- **Terén je dekorace, ne pravidla.** `MobaTerrain.tsx` kreslí trávu, cesty,
  řeku, lesy, skály a sutiny; kolize ani vidění z něj nepochází (to drží
  `map.ts`/`sim.ts`). Kdo přidá překážku, musí si ujasnit, jestli má být
  vidět, nebo i blokovat — druhé znamená sáhnout do mapy.
- **Statické objekty = instancing.** 120 stromů jsou dva instanced meshe
  (kmeny + koruny), 34 skál jeden. Matice se nastaví **jednou**
  v `useLayoutEffect`, ne ve frame.
- **Deterministické rozestupy** (vlastní LCG v `MobaTerrain`) — scéna musí
  být při každém načtení stejná; `Math.random()` by dělal jiný svět pokaždé.
- **Vysoké objekty u základny koukají do kamery.** První verze měla čtyři
  3–4 m sloupy kolem spawnu a hráč neviděl ani svou postavu. Zešikma shora
  (kamera y=20, z+17) zakrývá výhled cokoli vyššího než ~1 m v blízkosti
  hrdiny — proto jsou sutiny nízké a dál od středu.
- **Svislé plochy (praporky) z výšky vypadají jako plovoucí desky.** Týmová
  barva věže patří do **prstence u paty**, ne na korouhev.
- **Screenshot je součást ověření.** `e2e/first-world.mjs` ukládá
  `start.png`/`fight.png`/`victory.png`; bez pohledu na ně se „grafika
  hotová" nedá tvrdit. (Tři chyby výše našel až screenshot.)
- **Nexa zmenšena (1,6 → 1,35)** a věže sníženy — z výšky jinak dominují
  záběru víc než hrdina.

## PRVNÍ SVĚT — GPU render a ladění grafiky (F12, 2026-11-03)

- **Screenshoty jen na skutečné GPU.** `e2e/_browser.mjs` bere `ZION_GPU=metal`
  (ANGLE/Metal + nový headless, `--enable-gpu`), výchozí zůstává swiftshader
  pro CI. Swiftshader dá ~3 fps a velké screenshoty padají na timeout.
- **`e2e/moba-shots.mjs`** udělá pět pohledů (základna, uzel, řeka, linka,
  varianta bez HUD) a změří fps + `renderer.info` (draw calls, triangles,
  geometries, textures). Čísla vytáhne z debug háčku (`__mobaDebug().renderer`)
  — bez toho se výkon „měří" odhadem.
- **Naměřeno (1600×900, M1 Metal):** **60 fps** (16,7 ms), **67 draw calls**,
  22,8 tis. trojúhelníků, **4 textury** (tráva, cesta, obloha, + interní).
  Scéna je daleko pod rozpočtem univerza (175+ calls).
- **Obloha je inverzní koule s gradientem** (`skyTexture`) a `fog={false}` —
  s fogem by ji mlha sežrala a horizont by zmizel.
- **Kontaktní stíny místo shadow map:** instanced kruhy pod miniony
  (`MAX_SHADOWS`) + kruh v grupě hrdiny. Stíny jsou nejlevnější způsob, jak
  jednotky „přilepit" k zemi; skutečné `castShadow` by stály framebuffer.
- **Co odhalil až render** (kód to neukáže): boss byl obrovský balon, bushe
  vypadaly jako zelené balvany, řeka byla přesaturovaná a prstenec uzlu
  působil jako prázdný kruh. Všechno je opravené, ale **platí pravidlo:
  bez pohledu na snímek se „grafika hotová" netvrdí.**
- **Velký šedý mnohoúhelník u řeky je Prastaré stvoření** (jungle tábor
  `river-dragon`), ne chyba — z výšky vypadá jako placatý kámen.

## PRVNÍ SVĚT — animace a vizuální mlha (F13, 2026-11-03)

- **Animace jsou zdarma, když jdou z `clock.elapsedTime`.** Minioni poskakují,
  krystaly věží/Nex rotují, runy se vznášejí, wardy pulzují — žádný state,
  žádné re-rendery, jen math ve `useFrame`. Nepřidávej kvůli tomu React state.
- **`tmp` (Object3D pro instance) je jeden sdílený objekt.** Smyčka, která
  nechce rotaci, ji musí explicitně vynulovat — jinak se minioni nakloní
  podle stínů (stíny nastavují `-π/2`). Stalo se to při prvním pokusu.
- **Vizuální mlha je maska, ne druhá simulace.** `MobaFog` kreslí tmavý plán
  s průhledovými dírami podle **snapshotu** (vlastní hrdinové, minioni, věže,
  uzly, wardy). Online klient nemá sim stav, takže zdroje musí jít ze
  snapshotu — jinak by mlha v multiplayeru neseděla.
- **Maska se překresluje 6–7×/s** do CanvasTexture 256×192, ne každý frame.
  Větší rozlišení je zbytečné (je to měkký přechod) a dražší.
- **Mlha musí pokrývat i okolí hřiště** (240×200 m), jinak vypadá jako tmavý
  obdélník doprostřed obrazovky — přesně to ukázal první screenshot.
- **Díry vidění jsou elipsy**, protože plán není čtvercový; kruh by se
  v textuře roztáhl podle strany.
- **Naměřeno po mlze (M1 Metal, 1600×900):** 60 fps, **69 draw calls**,
  22,9 tis. trojúhelníků, 5 textur (tráva, cesta, obloha, mlha, interní).

## PRVNÍ SVĚT — poškození jako čísla (F14, 2026-11-03)

- **Sim neposílá damage eventy, takže čísla vznikají rozdílem HP mezi
  snapshoty.** Díky tomu to funguje v sólu i online **bez změny protokolu**;
  cena je, že číslo je součet za jeden snapshot (15 Hz), ne jednotlivé rány.
- **Kreslí se do 2D canvasu nad scénou** (`MobaFxOverlay`), ne do DOM ani do
  3D spritů: DOM element pro každé číslo by při 15 snímcích/s zabil výkon.
  Světové souřadnice projektuje **kamera z r3f**, kterou `MobaStage` předává
  přes `cameraRef` — bez toho by overlay nevěděl, kam číslo patří.
- **Kdo zmizí v mlze, tomu se stav HP zahodí.** Jinak by po odhalení naskočilo
  jedno obrovské číslo za celou dobu v mlze.
- **Strop 40 čísel a rozptyl podle id** — AoE by jinak vyrobilo stovky
  překrývajících se textů.
- **Červená = dostané, zlatá = udělené** (podle týmu hrdiny ve snapshotu).
- **🔴 Wrapper komponenty znovu:** `MobaOnline` zahazoval `sellRequest`,
  `buybackRequest` a `talentRequest`, takže v multiplayeru nešel prodat item
  (F2), buyback (F5) ani vybrat talent (F8). Stejná chyba jako u `MobaGame`
  ve F6. **Pravidlo: každý nový `*Request` ref musí projít VŠEMI vrstvami
  (page → wrapper → controller) — jinak tiše zmizí.**

## PRVNÍ SVĚT — ikony kouzel (F15, 2026-11-03)

- **Ikony jsou vektorové glyfy, ne emoji.** `spellIcons.tsx` drží
  `Record<SpellSlot, string[]>` (SVG paths) a barvu bere z `currentColor`
  přes `stroke` — emoji se na každém systému vykreslí jinak a nejde obarvit
  barvou postavy.
- **Ikona je podle SLOTU, ne školy.** Všechna čtyři kouzla jednoho hrdiny mají
  stejnou školu, takže podle školy by HUD ukazoval čtyři stejné ikony (přesně
  to se stalo v prvním pokusu). Slot nese roli: Q projektil, W obrana,
  E plošný zásah, R ultimátka.
- **Nový slot bez ikony neprojde `tsc`** — `Record<SpellSlot, …>`; jinak by
  v HUD zůstala prázdná díra.
- **`school` musí dojít až do HUD.** `SpellMeta` i `MobaStats.spells` ho nesou
  (dřív stačil jen slot + barva). Když se přidá další pole pro HUD, projdi
  `statsFromSnapshot`, fallback v `earth/page.tsx` a `MobaTouch` — tři místa.
- Ikona je i v dotykových tlačítkách (`.moba-touch-btn.is-spell` je teď
  sloupec ikona + klávesa).

## PRVNÍ SVĚT — 3D svět podle Riftu (F16, 2026-11-03)

- **Vizuální hierarchie (Riot dev blog „Defining the Rift's Visual Style"):**
  země → zdi (rámují prostor) → landmarky (základny, jámy) → dekorace
  (lucerny, kameny) → atmosféra (jiskry). Kdo přidává další vrstvu, musí
  vědět, do které patří — jinak vznikne vizuální šum a hůř se čte, kudy se dá
  jít („clarity first").
- **Zdi nikdy nezasahují do linek.** Hřebeny sedí mezi linkami (`|z| ≈ 9,5`
  a `26,5`) s průchody u řeky a u základny. Když se posunou, začnou blokovat
  výhled na jednotky (kamera je šikmo shora, vysoké objekty vrhají „stín"
  do záběru — přesně to už jednou zakrylo hrdinu).
- **Zdi jsou dodecahedry, ne boxy.** Box vypadal jako přepravka; kamenný
  hřeben potřebuje nepravidelnou rotaci, různou výšku a mechové emissivum.
- **Doupata mají barevný kruh podle typu** (malý = cyan, střední = modrá,
  prastarý = fialová) — hráč musí z mapy poznat, co tam čeká.
- **Statické objekty = instanced** (6 meshů + 1 Points). Rozpočet: scéna
  zůstává ~73 draw calls; vesmír má 175+.
- **Jiskry jsou `Points` s rotující skupinou**, ne 90 meshů.
