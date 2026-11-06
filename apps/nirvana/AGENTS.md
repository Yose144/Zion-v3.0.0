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

## Flotila z marketplace — `/fleet` (2026-11-05, NASAZENO)

Volný let se 7 loděmi z marketplace (`public/models/fleet/*.glb`, 4,7 MB, panelový lak
ve `COLOR_0`) + doky Nabukano (3 kotviště) a Issobella. Simulace `core/fleet/flight.ts`,
doky `core/fleet/docks.ts` (funkce času, zakotvená loď kopíruje pohyb doku), scéna
`FleetScene.tsx`, stránka `app/fleet/page.tsx`, dotyk přes `TouchButton`, `?fleetDebug=1`.

**Nasazeno:** 2026-11-05 (deploy `20261105T113053Z`, mobilní audit `20261105T123201Z`).
**Deploy artefakt se staví v čistém worktree na HEAD** — v pracovním stromu bývá rozdělaná
práce jiné session (např. proto 31), kterou do produkce nechceme.

**Pasti:** GLB **musí** ležet pod `/models` (jen ten prefix je v middleware veřejný, jinak
loader dostane 307/HTML); `render.mjs` přepočítává mapy portrétů/sheetů z disků a zahodí
záznamy se starými slugy; proto pre-flight čte `PROTO_VERSION` z **pracovního stromu**, ne
z artefaktu — při deployi z worktree porovnej verzi artefaktu a bypass zdůvodni.

**Otevřené:** Star Wars IP + cizí kit (před-launch blocker), multiplayer flotily, VR, skutečný mobil.

---

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

## PRVNÍ SVĚT — výška, atmosféra, animace (F17, 2026-11-03)

- **Výška jen mimo hřiště.** Sim je 2D (`y = 0`), takže kopce a hory stojí
  za hranou mapy; cokoli vyššího uvnitř by jednotky „utopilo" nebo vyneslo
  nad terén. Kdyby někdy měl terén výšku i uvnitř, musí to řešit sim
  (výška v pohybu), ne scéna.
- **Atmosféra je pár velkých průhledných plánů, ne stovky částic.** Mlha
  v džungli = 4 plány s `opacity 0.07`, pomalý posun a rotace; světlušky
  a jiskry jsou dva `Points`, listí jeden `InstancedMesh`.
- **Animace z `clock.elapsedTime`, matice jen u instancí, které se hýbou**
  (listí 46 kusů). Statické instance se nastavují jednou v `useLayoutEffect`.
- **Listí se „vrací nahoru" modulo** (`(y − t·speed) % span`), takže se
  nikdy nehromadí dole a nepotřebuje respawn logiku.
- **Lucerna musí být `transparent`**, jinak `opacity` nic nedělá (basic
  materiál je jinak neprůhledný a flicker je neviditelný).

## PRVNÍ SVĚT — portréty hrdinů (F18, 2026-11-03)

- **Negeneruj druhou sadu.** Web už má 200 portrétů ze **stejného** avatar
  modelu (`apps/website-v2.9/public/oasis-assets/game-portraits`).
  `node scripts/ops/gen-moba-portraits.mjs` je zkopíruje do
  `apps/nirvana/public/portraits/<id>.webp` (1,8 MB) a zapíše seznam id do
  `portraits.generated.ts`. Po změně avatar modelu se musí přerenderovat
  webové karty a pak spustit tenhle skript.
- **`portraitUrl()` vrací `null` pro chybějící id** (katalog má mezery:
  200 souborů na id 0–202). UI pak kreslí iniciálu — nikdy se nenačítá 404
  obrázek, který by bliknul jako rozbitý.
- Portréty jsou v HUD (vedle jména), na pick screenu (karta hrdiny)
  a ve scoreboardu (mini varianta).
- **Portrét musí být `object-position: center 22%`** — model je vycentrovaný
  na tělo, takže na kruzích 2,2rem uřízne hlavu kdekoli jinde.

## PRVNÍ SVĚT — mobilní vrstva (F19, 2026-11-03, protokol 17)

- **Battle spell = Flicker** (klávesa `V`, na dotyku ⚡): blink do 6 m, 60 s
  cooldown. Efekt i cooldown drží **sim** (`useBattleSpell`), klient posílá
  jen bod — stejný princip jako ward/sentry.
- **Auto-aim je klientská věc, ale pravidlo drží sim.** `snapAim(heroes, team,
  x, z, 8)` vrátí nejbližšího **živého nepřítele** k bodu; používá se jen když
  je hráč na dotyku (`autoAim={coarse}`). Na myši se nemíchá do míření.
  V online se bere ze **snapshotu** (jen viditelní nepřátelé — jinak by to byl
  cheat přes mlhu).
- **Rychlý nákup** je jedna karta „Doporučeno" v obchodě: první item, který
  hrdina ještě nemá, podle archetypu (agresivní/podpůrný/kontrolní). Pořadí
  je `RECOMMENDED` v `earth/page.tsx`, ne v obchodě — je to UX, ne pravidlo.
- **Boti Flicker používají** na útěk (nízké HP + nepřítel do 6 m), aby hráč
  neměl nefér výhodu.
- **PROTO_VERSION 17** (`battlespell`, `battleSpellIn`) → deploy **net první**.
- **Testy:** `test/moba-sim.mjs` (183 kontrol: skok 6 m, cooldown, snapAim
  s mrtvým/nepřítelem/mimo dosah).

### Past: audit many vs fontána

- **Mobile audit četl manu 700 ms po seslání** — jenže hrdina stojí ve fontáně,
  která od F9 doplňuje 12 % many za sekundu, takže rozdíl zmizel a audit
  hlásil „kouzlo nesnížilo manu" i když kouzlo prošlo (cooldown Q byl
  nastavený). Čte se **160 ms** po kliku.
- Obecné pravidlo: **funkční test nesmí měřit veličinu, kterou hra sama
  regeneruje.** Když to jinak nejde, měř **okamžitě** nebo použij stav, který
  se neobnovuje (cooldown, počet projektilů).

## PRVNÍ SVĚT — recall (F20, 2026-11-03, protokol 18)

- **Recall drží sim, ne klient.** `startRecall` nastaví `recallAt`, sim po
  `RECALL_CHANNEL_MS` (4 s) teleportuje hrdinu do spawnu. Kdyby o dokončení
  rozhodoval klient, šel by recallovat i při útěku.
- **Ruší ho pohyb, kouzlo, útok i jakýkoli zásah** (`damageHero`). Zásah řeší
  jedna řádka v `damageHero` — každá nová cesta poškození ho tím pádem ruší
  automaticky.
- **Během channelu se nedá nic dělat** (`continue` ve smyčce hrdinů), takže
  hráč nemůže útočit a „recallovat" zároveň.
- **Boti recall nepoužívají** — jejich pohyb by ho hned zrušil.
- **Test pozor na tábory:** první běh testu „rušilo monstrum", protože hrdina
  stál v džungli. Správné chování, špatné místo v testu.
- **PROTO_VERSION 18** (`recall`, `recallIn`) → deploy **net první**.

## PRVNÍ SVĚT — battle spelly, quick chat, MVP (F21, 2026-11-03, protokol 19)

- **Battle spell je volba, ne konstanta.** `BATTLE_SPELLS` v sim: Flicker
  (blink 6 m, 60 s), Heal (+260 HP, 45 s), Purify (smaže hoření i zpomalení,
  +30 % rychlosti, 50 s). Efekt i cooldown drží sim; hráč volí jen id.
- **Multiplayer:** volba jde v `join` (`battleSpell`), server ji předá do
  `MobaSeat` a ta do `makeHero`. Boti mají výchozí `flicker`.
- **Quick chat** jsou čtyři předvolané zprávy v HUD (jen online). Jdou přes
  **existující chat**, takže platí serverová sanitizace i rate limit
  (2 zprávy / 2 s) — žádná druhá cesta pro text.
- **MVP** se počítá z snapshotu: `dmg + kill×250 + heal×0,6 + zlato×0,5`.
  Je to UX skóre, ne pravidlo — patří do `earth/page.tsx`, ne do sim.
- **`battleSpell` musí dojít do stats** (`MobaStats.battleSpell`), jinak HUD
  kreslí špatnou ikonu (⚡/✚/✦).

## PRVNÍ SVĚT — emotes a adaptivní build (F22, 2026-11-03, protokol 20)

- **Emote jde přes server.** Klient pošle `{t:'emote', id}`, server ověří, že
  je v MOBA místnosti, a **přepošle event celé místnosti** (`kind: 'emote'`,
  `playerId`). Klient si najde hrdinu podle `playerId` ve snapshotu a vykreslí
  bublinu přes `MobaFxOverlay` (stejný 2D canvas jako čísla poškození).
  Kdyby si emote kreslil jen odesílatel, multiplayer by ho neviděl.
- **Bublina žije 2,2 s** (`EMOTE_TTL`), čísla 0,9 s — text se má přečíst.
- **Adaptivní build je čistá funkce** (`core/moba/build.ts`):
  `standingFrom({ally, enemy})` → ahead/even/behind a `recommendNextItem`.
  Při ztrátě 3+ zabití kup přežití, při náskoku 3+ damage. Testuje se
  samostatně, takže se nemůže rozejít s UI.
- **POZOR na test minionů:** vlny jsou od F19 rychlejší (18 s, 4 minioni),
  takže u uzlu L5 nemusí být zrovna žádný nepřátelský minion. Test k
  nejbližšímu **dojde**, místo aby čekal na náhodu (jinak flakuje).

## PRVNÍ SVĚT — radiální emote menu (F23, 2026-11-03)

- **Výběr je klik na sektor, ne držení a tažení.** Na malém displeji by
  drag-selection míchal s joystickem; klik je jednoznačný. Klávesy 1–4
  vybírají naslepo (pro klávesnici), Esc nebo klik mimo zavře.
- **Kolečko nic neposílá** — jen vrátí index; odeslání jde přes
  `useNet().sendEmote`, takže bublinu vidí celá místnost (server event
  přeposílá, F22).
- **Otevření:** tlačítko 😀 v HUD (kotví se na pozici kurzoru) nebo klávesa
  `X` (střed obrazovky). Jen v multiplayeru — sólo nemá komu posílat.
- **Kolečko je `position: fixed` se `z-index: 30`**, aby ho nepřekryl HUD
  (ten má 12–20).
- **Dvě chyby, které našel až screenshot** (kód je neukáže):
  (a) emote tlačítko je u spodního okraje, takže sektory 78 px od středu
  skončily mimo viewport → clamp středu;
  (b) i po clampu sedělo kolečko **na liště schopností a rychlém chatu** →
  spodek má rezervu `min(300 px, 34 % výšky)`, takže se zvedne nad HUD
  (v landscape se rezerva zmenší, aby nezůstalo nahoře).
- **`window.innerWidth/innerHeight` v renderu** musí mít fallback
  (`typeof window === 'undefined'`), i když je komponenta `'use client'` —
  Next ji stejně SSR-uje.

## Responsivita celého webu (2026-11-03)

- **„Nulový přesah" neznamená „v pořádku".** Devět povrchů × čtyři viewporty
  nemělo ani jeden horizontální přesah, a přesto se obsah překrýval: bublina
  chatu ležela na liště, nápověda na CTA, panel na posledních kapitolách.
  Kdo měří jen `scrollWidth − clientWidth`, uvidí zelenou na rozbité stránce.
- **Bublina chatu (`.chat-dock-btn`, fixed, z 60) je čtvrtý účastník layoutu.**
  Lišta her si na ≤760 px a na `max-height: 480px` nechává pravý inset
  4,9rem. Na šířku navíc musí být chat **jen ikona** — s popiskem „CHAT" je
  ~150 px široký a rezerva 4,9rem ho nepokryje.
- **Na šířku (390 px výšky) je lišta dole u okraje**, na výšku je zvednutá
  nad chat (`.game-hud.is-compact { bottom: 4.6rem }`). Kdo přidá novou
  lištu, musí počítat s oběma režimy.
- **Panely, které sahají k okraji, potřebují inset** (`/saturn` 4,4rem,
  pás bran `/hiran` `padding-right`, `/avatars` `padding-bottom` 5,4rem).
  Scrollovaný seznam bez fade vypadá jako oříznutý řádek — dej `mask-image`.
- **Media query nepřidává specificitu.** Blok `@media (max-width: 560px)`
  umístěný v souboru **před** základní `.moba-pick-grid` / `.moba-portrait.is-card`
  je přebitý. Všechny responzivní override patří **na konec** `globals.css`.
- **Při stěhování CSS bloku si zkontroluj závorky.** Ruční výřez nechal
  osiřelou `}` a chybějící uzavření media query → `next build` spadl na
  `Unexpected }` / `Unclosed block` a deploy se neprovedl (produkce zůstala
  na starém buildu — to je správné chování skriptu, ale snadno se přehlédne).
  Po každé ruční editaci CSS pusť `npx next build`, ne jen `tsc`.
- **3D popisky v malém záběru se překrývají.** `HiranScene` má `gateLabels`;
  na ≤760 px se jména bran nekreslí a nechávají se pásu dole (jinak se
  „Kailash" překrývá s „Království srdce").
- **Brána ZAP pasu** (`PassGate`) je vyšší než 390 px, takže na šířku musí
  scrollovat (`overflow-y: auto` + `align-items: flex-start` na malé výšce);
  jinak tlačítko „Vstoupit" zmizí za lištou.
- **Dotykové cíle:** minimum 40 px (`min-height: 2.5rem`) v
  `@media (hover: none) and (pointer: coarse)`. Lišta her, odkazy v chrome,
  přepínač režimu, pás bran, filtry avatara. Žetony mají 24 px (WCAG 2.5.8).
- **Test funkčnosti nesmí čekat „jedno čtení po X ms".** Mobile audit četl
  manu 160 ms po klepnutí na kouzlo; HUD posílá telemetrii 5×/s a fontána
  doplňuje 12 %/s, takže se snížení na pomalém snímku stihlo dorovnat a test
  hlásil falešnou chybu (482 → 482), přestože kouzlo prošlo (propad je vidět
  až ~200 ms po). Správně: 25 vzorků po 40 ms a hledat **propad** > 8 many
  (regenerace ~2 za vzorek, kouzlo stojí 26).
- **Nástroje:** `.artifacts/probe/responsive.mjs` (9 rout × 4 viewporty,
  počítá přesah a prvky mimo viewport, ignoruje vodorovné scrollovací pásy)
  a `.artifacts/probe/shots-responsive.mjs` (screenshoty výška/šířka).
  Report: `docs/3.2/REPORTS/REPORT_2026-11-03_NIRVANA_RESPONSIVITA.md`.

## Saturn — Tanky (2026-11-04)

- **Jedna pravidla, dva renderery.** `core/saturn/tanks.ts` drží střelu,
  gravitaci, vítr, krátery, poškození, tahy i botovo mířidlo. `TanksCanvas`
  (2D) a `TanksScene` (3D) jen čtou stav. Kdo přidá druhý integrátor, rozejde
  2D a 3D dostřely.
- **Jeden krok simulace.** Smyčka v `TanksGame` posouvá sim 60×/s pro oba
  rendery; 3D scéna se ve `useFrame` jen dorovnává podle `state.current`.
  Kdyby si 3D stepovala sama, běžely by dvě různé hry v jednom procesu.
- **Terén je heightmapa, krátery jdou přes `terrain.version`.** Sim sníží
  výšky, scéna podle verze přepíše vrcholy a přepočítá normály. Kdo by
  krátery počítal ve scéně, rozejde se s poškozením.
- **Deska terénu musí být větší než hřiště** (1,7× šířka, hloubka 1500) —
  jinak je vidět okraj a hřiště vypadá jako prkno ve vesmíru.
- **`PlaneGeometry` je centrovaná na počátek**, ale svět tanků je 0..1000 →
  `geo.translate(WORLD_W/2, 0, 0)`; výšky se pak berou z `position.getX(i)`,
  ne z indexu sloupce.
- **Stínová kamera směrového světla musí pojmout hřiště** (±700). S výchozími
  hodnotami se do scény propíše obdélník frusta a půlka mapy je tmavá.
- **Botovo mířidlo: hrubá mřížka + jemné doladění.** Samotná mřížka 4°/4 síly
  minula o desítky jednotek (a bot pak trefil jen náhodou). Doladění 0,5°/1
  sníží odchylku pod ~15 jednotek; výsledek se pak rozladí (`error`) — bez
  toho by bot trefoval 100 %.
- **Na telefonu HUD v obraze nefunguje.** Plátno 960 px široké na 390 px
  displeji znamená text 16 px → ~6 px. `TanksCanvas` má proto `compact`:
  v obraze zůstane jen nápis tahu, zbytek kreslí DOM `.tanks-hud`.
- **`.tanks-hud` patří nad dotykový pad** (`bottom: 10.2rem` na ≤760) a musí
  se zalamovat; v jednom řádku se na 390 px nevejde.
- **`pointer-events` v `.saturn-chrome`:** rodič má `none` (aby šla otáčet
  scéna), takže každý klikatelný blok (`.saturn-chrome-actions`) si musí
  vrátit `auto` — jinak klik sežere canvas nad ním.
- **Blast meshe musí být `visible={false}` od začátku**, ne až z `useFrame`;
  do prvního snímku by byly vidět jako prázdné prstence na zemi.
- **Testy:** `npx tsx apps/nirvana/test/saturn-tanks.mjs` (48 kontrol).
  Test hráčova mířidla musí použít `aimAt(state, 'player', 0)` — `botAim`
  mříří na hráče, takže pro střelbu na bota je potřeba opačná strana
  (a `180 − úhel` je špatně, protože úhel je 0–90 od vodorovné).

## Multiplayer napříč Nirvanou — jeden kontrakt (2026-11-04, proto 21)

- **`Match` je jediná cesta.** `apps/nirvana-net/src/match.ts` definuje
  `join/leave/step/state/snapshot/message/size`; `matches.ts` do něj obalí
  arénu, závod, duel a MOBU, tanky ho plní rovnou. **Nová hra = jeden `case`
  v registru.** Kdo přidá pátý `if (room.x)` do `index.ts`, vrací dluh zpět.
- **Snapshot se staví pro jednoho hráče.** `snapshot(id, now)` — mlha války
  znamená jiný obsah pro každý tým; `index.ts` posílá každému jeho vlastní.
- **Herní zprávy jdou do `match.message()`.** Když hra vrátí `false`,
  odpoví se `not_available`. Emote je **obecný** (funguje v každé místnosti).
- **Tanky online** (`GameId 'tanks'`): `aim`/`shoot` platí jen na tvém tahu;
  parser protokolu ořezává rozsahy (`0–90°`, `0–100`), server je validuje
  ještě jednou. Terén se posílá **jen při změně** (`terrainVersion`) — 161
  výšek 15×/s je zbytečný provoz. `autoBot` drží bot v prázdném sedle, ale
  jakmile sedí člověk, bot **nesmí** střílet za něj.
- **Klient přepisuje snapshoty do stejného `TanksState`**, takže 2D i 3D
  renderer kreslí beze změny. Stranu přiděluje server (`you: 0 | 1`) —
  HUD i mířidlo se musí porovnávat s **vlastní** stranou, jinak oba hráči
  vidí „TVŮJ TAH" (přesně to byla první chyba).
- **Neznámá hra v `join` nesmí tiše skončit v aréně.** Parser měl whitelist
  `race|fight|moba`, takže `tanks` propadlo do `arena` a test hledal místnost,
  která neexistovala. Nová hra = nový záznam v tom whitelistu.
- **`test/moba.mjs` měřil náhodu.** „Projektil je ve snapshotu" padá, když
  střela na blízký cíl zmizí mezi dvěma snapshoty (a projektil mohl být
  i botův). Ověřeno na starém kódu: 1× OK, 1× FAIL. Nahrazeno deterministickou
  kontrolou „mimo dostřel server manu nestrhne".
- **`@types/ws` musí být v rootu.** Deploy skript kontroluje
  `apps/nirvana-net/node_modules/ws`; když `npm ci` v rootu srovná balíčky,
  `@types/ws` zmizí a `tsc` spadne na implicitní `any`. Řešení:
  `npm i -D @types/ws` v rootu + `npm install` v `apps/nirvana-net`
  (potřebuje vlastní `node_modules/ws`).
- **Deploy pořadí:** `deploy-nirvana-net.sh` **první**, pak appka. Starý
  klient na novém serveru dostane `proto_mismatch`; obráceně by join do
  `tanks` propadl.
- Report: `docs/3.2/REPORTS/REPORT_2026-11-04_MULTIPLAYER_VRSTVA.md`.

## Lobby a živý seznam místností (2026-11-04, proto 22)

- **`rooms` je push, ne poll.** Server posílá `{t:'rooms'}` každému po
  `hello` při změně (nová místnost, hráč, stav, odchod), throttlovaně na
  4×/s se sléváním. Kdo přidá novou změnu stavu místnosti, musí zavolat
  `pushRooms()` — jinak lobby zamrzne na starém seznamu.
- **`pushRooms()` NEPATŘÍ do `createRoom`.** Místnost vzniká uvnitř `join`,
  takže by lobby na čtvrt sekundy ukázala místnost s 0 hráči.
- **`state()` v `Match` je pro lobby, ne pro hru.** Tanky hlásí `waiting`,
  dokud je volné sedlo (i když hraje bot), a `running` až se dvěma lidmi;
  „hraje se" u místnosti s jedním člověkem je lež, které si hráč všimne.
- **Lobby nekreslí nic z lokálního stavu** — jen `useNet().rooms`. Když
  server mlčí, stránka to řekne a hry jdou hrát sólo (stejné pravidlo jako
  u ZION zůstatku v HUD).
- **Odkaz je v `GamesDock`** (🌐 Online) — lobby je rozcestník, ne hra,
  takže nepatří do `GAME_LINKS`.

## Pozvánky a chat v multiplayeru (2026-11-04, proto 23)

- **Pozvánka je URL, ne stav.** `/multiplayer?room=<id>`; game se pozná
  z prefixu (`tanks-2` → `tanks`). Odkaz projde chatem i po reloadu.
- **Join z odkazu musí počkat na `hello`.** `status === 'open'` je jen
  otevřený socket; join poslaný dřív skončí `bad_frame` a pozvaný zůstane
  v parku. Podmínka je `status === 'open' && you` (identita = handshake hotový).
- **Neznámá místnost = `room_missing`, ne nová místnost.** Dřív `join`
  s `wanted` ID, které mezitím zmizelo, tiše založil novou a dva lidi
  skončili každý jinde. Plná místnost vrací `room_full`.
- **Kopírování do schránky nesmí mít `window.prompt` jako fallback** —
  blokuje stránku (a v headless testu zamrzne). Fallback je viditelné pole
  s odkazem.
- **Chat je jedna komponenta (`ChatPanel`)** pro plovoucí dok i lobby.
  Kdyby měl dok vlastní kopii, rozejde se v tom, kdo smí psát.
- **Host smí psát** (1 zpráva / 4 s, 120 znaků), ZIS 2 / 2 s, 240 znaků.
  Rozhoduje server v `postChat`; UI jen vysvětlí limit. Bez toho byl chat
  v multiplayeru pro nepřihlášené mrtvý.
- **Kanál se mění podle místnosti** (`park` vs `arena:<room>`), takže
  zpráva z lobby, když jsi v místnosti, jde do místnosti. Hlavička chatu
  proto kanál ukazuje — jinak je to matoucí.
- **Na `/multiplayer` je plovoucí dok skrytý** (`usePathname`), lobby má
  vlastní chat; dvě počítadla nepřečtených mátla.

## Reconnect, pozvánky z her, hala (2026-11-04, proto 24)

- **Reconnect = stejné `conn.id`.** Server drží spadlé připojení v `resumes`
  a při `hello` s tokenem **převezme staré id** — všechny hry klíčují hráče
  podle `conn.id`, takže se tím vrátí do stejné pozice (a v tancích do
  stejného tahu). Nové id by znamenalo nové sedlo a v tancích cizí tah.
- **`send()` musí zahodit zprávu pro mrtvý socket.** Během grace sedí hráč
  v `room.players`, ale socket je zavřený; bez guardu by snapshot shodil
  celou smyčku.
- **Grace sweep běží po 1 s, ne v heartbeatu (20 s).** Jinak by se
  `NIRVANA_NET_RESUME_MS=1200` v testu protáhl na 20 s a úklid „nefungoval".
- **`NIRVANA_NET_RESUME_MS=0` reconnect vypíná** — testy úklidu to používají,
  protože jinak sedlo po odpojení drží 45 s a místnosti nemizí.
- **Pozvánka má jednu komponentu** (`InviteButton`): hlavička chatu, chrome
  tanků, lobby banner. URL se skládá na jednom místě; fallback bez schránky
  je pole s odkazem, nikdy `window.prompt` (blokuje stránku).
- **Hala (park) je slyšet všude.** Zprávy z `park` kanálu se posílají i do
  místností (`park: true`, v chatu „hala ·"); zprávy z místnosti zůstávají
  v místnosti. Kdyby šlo všechno všude, taktika 5v5 by tekla do celé Nirvany.

## Režim místnosti: s boty / jen lidé (2026-11-05, proto 25)

- **`mode` je vlastnost místnosti, ne hráče.** `join` ho pošle jen při
  zakládání; u existující místnosti se ignoruje (jinak by si dva lidé
  měnili režim pod rukama).
- **`humans` = žádní boti.** Aréna (`botsEnabled`), duel (`stepFight`
  se s prázdným sedlem vůbec neposune) a tanky (`autoBot=false`). Kdo
  přidá hru, musí tohle respektovat — jinak „jen lidé" znamená „bot
  dorazí za 6 s".
- **MOBA režim ignoruje** a vždy doplní boty: má pevnou sestavu 5v5 a bez
  nich by jedna strana neměla hrdiny. Není to opomenutí, je to omezení.
- **Stav `waiting` je pro lobby.** Aréna v `humans` hlásí `waiting`, dokud
  nejsou dva lidé — i když simulace technicky běží.
- **Testy časování:** první snapshot nemusí být v inboxu hned po `room`
  (chodí 15×/s) a střela v tancích letí i 3 s. Čekej na **stav** (fáze
  `aim`), ne na `sleep`.

## ZAP pas odemyká celou Nirvanu (2026-11-05, proto 26)

- **Brána je v middleware, ne v jedné stránce.** `src/middleware.ts` posílá
  bez cookie `zion_nirvana_pass` všechno na `/?next=<cesta>`. Kdo bránu
  „opraví" jen v `app/page.tsx`, vrátí obejití hry z menu.
- **`/` musí být z matcheru vyjmutá** — jinak redirect skončí sám na sobě
  (nekonečná smyčka; odhaleno prvním `curl`).
- **`PassGate` je v `app/layout.tsx`** a **`GameHud` i `ChatDock` jsou až
  za ní.** HUD v layoutu mimo bránu = lišta s přepínáním her na zamčené
  stránce (přesně to uživatel nahlásil).
- **`?next=` se přijímá jen jako interní cesta** (`/`, ne `//evil.com`).
  Po odemčení se vrací **plnou navigací** (`window.location.assign`):
  `router.replace` z layoutu se ztratil (Shell na `/` má hash-sync a URL
  přepsal zpět) a děti se nesmí mountovat dřív, než navigace proběhne —
  jinak se na chvíli načte 3D vesmír a redirect se opozdí o sekundy.
  Reálně to znamenalo „kód zadal správně a stejně skončil ve vesmíru".
- **Middleware kontroluje jen přítomnost cookie.** Platnost ověřuje
  `/api/pass` (klientská brána), `/present/*` layout a net služba.
  Zfalšovaná cookie nedostane obsah ani hru, ale HTML dokument se vyrenderuje.
- **Net služba taky:** `join` bez cookie → `pass_required`
  (`NIRVANA_NET_REQUIRE_PASS=0` pro testy). Jinak by se dalo hrát vlastním
  WS klientem.
- **Audity a E2E potřebují pas:** `NIRVANA_AUDIT_HEADER=1` proti lokální
  instanci s `ZION_RENDER_AUDIT=1`, nebo `NIRVANA_PASS_COOKIE=ZAP-…`.
  `ZION_RENDER_AUDIT` v produkci **nesmí** být — jinak stačí hlavička.
- **Deploy smoke check** ověřuje `/api/pass` 200 a `/mars` 307 (nasazení
  brány), ne `/api/oasis/worlds` 200 (ta je teď za branou).
- **Ověřeno live:** všech 10 herních/prezentačních rout → 307, brána bez
  HUD a chatu, fake cookie zamčená, WS `join` → `pass_required`.

## Zvuk — jeden engine pro všechny hry (2026-11-04)

- **`core/audio/engine.ts` je jediný `AudioContext`.** Aréna i MOBA měly
  vlastní; ostatní hry neměly nic. Kdo přidá zvuk, přidá **jméno** do
  `SoundName` a jednořádkovou kompozici do `SOUNDS` — ne nový kontext.
  Dvě kontexty = dvě hlasitosti, dva stropy a ticho po jednom ztlumení.
- **Strop hlasů je časový, ne `onended`.** `voiceEnds` se čistí podle
  `ctx.currentTime`; některé prohlížeče `onended` u zastaveného nodu
  nespustí a čítač by se zasekl na maximu a zvuk by navždy ztichl.
- **Throttling podle jména** (`MIN_GAP`) — zásah přichází 15×/s, tři boti
  střílí naráz. Bez rozestupu se nody hromadí a zvuk chrastí.
- **Zvuk se odvozuje z událostí, které už nastaly.** V souboji z poklesu
  HP (`createDuelSound`), v tancích ze změny `shotsFired`/`lastHit.at`,
  v pouti z `onScore`. Nikdy z klávesy: v multiplayeru střílí server.
- **`unlock()` patří do gesta** (klik na start / první stisk). Volání
  v efektu po navigaci funguje jen díky „sticky activation" a v Safari ne.
- **Ztlumení je jedna volba pro celou appku** (`nirvana.sound.v1`),
  tlačítko je `SoundToggle` v HUD. Nové zvuky se nesmí ptát zvlášť.
- **Spojitý zvuk** (motor Venuše) drží nody mimo `tone()` a **musí** mít
  `stop()` v cleanupu — jinak hučí i po odchodu ze závodu.
- Test bez prohlížeče: `npx tsx test/audio.mjs` (falešný `AudioContext`
  počítá nody; ověřuje ticho při ztlumení, throttling i strop hlasů).

## VR — jedna vrstva pro všechny hry (2026-11-04)

- **`core/xr/` drží store, tlačítko a čtení ovladačů.** Dřív měly VR jen
  pouť a Mars, každá s vlastním `createXRStore` a vlastním `useXRInputSourceState`.
  Nová hra použije `useXr()` + `<VrButton>` + `<VrInputs>`.
- **Ovladače posílají syntetické klávesy** (`createVrKeys`), ne vlastní
  herní cestu. Hry už čtou klávesnici (a dotyk dělá totéž), takže VR
  nemůže mít jiná pravidla než server.
- **`<XR store>` musí být uvnitř `<Canvas>`**, ale store patří stránce
  (tlačítko VR je v DOM). Proto scény berou `xrStore` propem a mají dvě
  větve (s `<XR>` a bez) — `store={undefined}` nefunguje.
- **Cinematic kamery se ve VR vypínají.** Když scéna každý frame volá
  `camera.position.set(...)`, v headsetu to „letí hlavou". Vzory:
  `DuelCamera xr`, `VenusRace/Multiplayer if (!xr)`, `MobaStage xr`,
  `TanksScene` bez `CameraRig`.
- **Pohyb ve VR = `XROrigin`, který nese tělo** (Venuše: jede s vozítkem,
  MOBA: nadhled nad hrdinou). Nesahá se na kameru, ta patří headsetu.
- **MOBA míření v VR jde přes projekci**: paprsek ovladače protne zem →
  `Vector3.project(camera)` → pixel → syntetický `pointermove`. Hra pak
  počítá `raycaster.setFromCamera(pointer)` beze změny. Předávat světový
  bod by znamenalo druhý vstup do simulace.
- **VR není otestované na headsetu.** Headless ověřuje jen to, že se scéna
  s namontovaným `<XR>` rozjede a tlačítko je vidět (`.artifacts/probe/
  moba-vr-smoke.mjs`). Nehlásit víc.

## Progrese a žebříčky — jedno místo (2026-11-04)

- **`core/progress/run.ts` → `recordRun()`** je jediná cesta, jak zapsat
  dohranou hru: žetony, osobní rekord, denní výzva, level, odeslání skóre.
  Čtyři kopie v appkách (`/park`, `/mars`, `/venus`, `/mercury`) se rozešly
  hned napoprvé — nové pravidlo se doplňovalo čtyřikrát.
- **Level roste z počtu dohraných her, ne z žetonů.** Žetony se utrácejí
  za kolo; hráč by po jízdě „zdegradoval".
- **HUD ukazuje `—`, dokud se profil nenačte.** `level 1` na půl vteřiny
  je lež, které si každý všimne (a v testu vypadá jako chyba).
- **Seznam her musí sedět na čtyřech místech:** `ParkGameId`
  (`park/games/types.ts`), `emptyScores` (`park/scores.ts`), `GAMES`
  a `emptyBoard` v `/api/park/scores`, `GAMES`+`TARGETS` v `challenge.ts`
  a názvy v `progress/boards.ts`. Nová hra = pět řádků, ne jeden.
- **Tabule je jedna cache** (`useScores`), jinak každá stránka stahuje
  seznam znovu a čísla se rozcházejí podle toho, kdy se načetla.
- Test: `npx tsx test/progress.mjs` (level křivka, rekord, výzva jednou
  denně, nehodnocený běh, level up).

## Vnější planety — Uran, Neptun, Pluto (2026-11-04)

- **`core/outer/worlds.ts` je jeden zdroj** (čísla, text, řetěz „dál").
  Scéna i panel čtou odsud; kdyby si stránka psala vlastní čísla, rozejdou
  se s planetou v katalogu.
- **`PlanetId` vs `PlanetGameId`**: Jupiter nemá vlastní hru, otevírá pouť.
  Unie byla dřív opsaná ve čtyřech souborech (`SolarSystem`, `Universe`,
  `SceneRoot`, `Shell`) — teď je v `planetCatalog.ts`.
- **Pluto nemá texturu.** `proceduralTexture()` (sdílené s vesmírem) kreslí
  deterministický canvas: krátery + světlá pláň ve tvaru srdce. Přidávat
  binárku kvůli jedné planetě nemá smysl.
- **Prstenec Uranu potřebuje vlastní náklon** (`rotateX(-π/2 + 0.22)`).
  Přesně z hrany z něj zůstanou dvě čáry sbíhající se v „V" a vypadá to
  jako chyba renderu.
- **Panel musí sedět nad herním HUD** (`bottom: 3.8rem`), jinak ho lišta
  překryje a nejde na poslední řádek.

## Hlediště — diváci (2026-11-04, proto 27)

- **Divák nedostane sedlo.** Server ho vede v `room.spectators`, ne v
  `room.players`: nepočítá se do kapacity a `match.join` se pro něj
  nevolá. Kdyby šel do `players`, v aréně by se objevil jako mrtvola
  v rohu a v tancích by ukradl tah.
- **`leaveRoom` musí rozlišit diváka** — `match.leave(id)` u něj nemá co
  odebrat a rozbilo by stav hry.
- **Snapshoty chodí i divákům** (stejná smyčka). Pro MOBU to znamená
  nefiltrovaný pohled — divák není v týmu, takže mlha války nemá co skrýt.
  Je to záměr (divácký pohled), ne díra; hráči v místnosti tím nic nezískají.
- **Hlediště je URL**: `?watch=arena-2` (`core/net/watch.ts`), validuje se
  proti `^(arena|race|fight|moba|tanks)-\d+$`. Odkaz z lobby je „Dívat se".
- **Stav se čte až v efektu.** Inicializace z `window.location` by na
  serveru a klientu dala jiný strom (hydration mismatch).
- **Hlediště umí všech pět her** (`/mars?watch=`, `/venus?watch=`,
  `/mercury?watch=`, `/earth?watch=`, `/saturn?watch=`). Každá stránka
  si `watch` přečte **v efektu** a sama se přepne do multiplayeru; hra
  pak v `join` efektu volá `spectateRoom()`, ne `joinGame()`.
- **Saturn musí tanky otevřít sám** — jsou celoobrazovková hra nad
  archivem, takže bez toho by divák zůstal v kronikách.
- **Pruh „DÍVÁŠ SE" je jedna komponenta** (`core/net/SpectatorBar`),
  ne pět kopií. Nese id místnosti a cestu do lobby.
- Testy: `apps/nirvana-net/test/spectate.mjs` (server) a
  `.artifacts/probe/watch-all-live.mjs` (pět her, hráč + divák).

## Pasti, které se v této vlně potvrdily

- **Paralelní session dělá `git add` přes celý strom** a strhne staged
  soubory do svého commitu (stalo se 2×: zvuk+VR a vnější planety).
  Po každém commitu zkontroluj, že tvůj soubor je v `HEAD`:
  `git log --oneline -3 -- <cesta>`. Když není, obsah je na disku, ale
  commit chybí — stačí znovu `git add` + commit.
- **`<nextjs-portal>` v levém dolním rohu je dev overlay**, ne naše UI.
  Překrývá první tab HUD a v konzoli hlásí „synchronously unmount a root".
  V produkčním buildu tam není — screenshoty a audity konzole dělej proti
  `next start`, ne proti `next dev`.
- **Emoji v HUD může přelézt první písmeno** („První svět" → „rvní svět"),
  když glyf kreslí širší, než je jeho box. Řeší `width: 1.15em` +
  `overflow: hidden` na `span[aria-hidden]`.
- **Lišta s 11 hrami se nevejde na jeden řádek.** Pás se posouvá
  (`overflow-x: auto` + mask fade) a nápověda k ovládání ustupuje pod
  1560 px; zalomená lišta zakryje spodek hry.


## Šestá skříň — Věž (2026-11-04)

- **Nová hra = pět seznamů, ne jeden.** `CanvasGameId`, `PARK_GAMES`,
  `CABINETS` ve `ParkScene` (skříně na oblouku), `emptyScores` + `GAMES`
  v `/api/park/scores`, `GAMES`+`TARGETS` v `challenge.ts` a
  `GAME_TITLES`/`GAME_ORDER` v `progress/boards.ts`. Když jeden chybí,
  skóre se ztratí nebo se hra neobjeví v žebříčcích.
- **Kontrakt her má nově volitelný `tap()`.** Kreslicí smyčka pouti
  předávala jen `pointer` (poloha) a `key` — mechanika, která potřebuje
  **okamžik** (položit kvádr), by se s tím nedala udělat. `park/page.tsx`
  ho volá na `pointerdown`; hry, které ho nepotřebují, ho nemají.
- **Věž je o trpělivosti, ne o míření.** V pouti už jsou dvě mířicí hry
  (Asteroidy, střelnice) a dvě odrazové (Pong, Breakout). Přesný zásah
  (+25) nechá kvádr široký, nepřesný ho zúží podle překryvu, mimo =
  konec. Čas na kvádr brání čekání.
- **Skříně jsou pravidelný oblouk** (−12,5 … 12,5, krok 5) — šestá hra
  znamenala jen nový řádek, ne přeskládání scény.
- Test: `npx tsx test/park-tower.mjs` (falešný 2D kontext, 11 kontrol:
  přesné/nepřesné položení, konec mimo kvádr, auto-drop časem, mezerník,
  `stop()`). V prohlížeči `.artifacts/probe/tower-audit.mjs`.

## MOBA — mistrovství hrdiny a bounty (2026-11-04, protokol 28)

- **Mistrovství nikdy neposiluje hru.** `core/moba/mastery.ts` drží XP,
  počet zápasů a titul pro každé `heroId`; je to číslo a jméno, ne +dmg.
  Kdyby dávalo bonusy, z výběru postavy by bylo pay-to-grind a nový hráč
  by proti veteránovi neměl šanci.
- **XP jen z odehraného zápasu** (výhra, zabití, poškození, MVP) a sólo
  proti botům za polovinu — jinak se dá farmit do nekonečna.
- **Tituly jsou indexované od 0 = level 1** (`MASTERY_TITLES[level - 1]`).
  Kdo přidá desátý titul, musí zvednout i `MAX_LEVEL`, jinak zůstane
  nepoužitý (a test `moba-mastery.mjs` to odhalí).
- **„Hrdina dne" je deterministický z data** (`heroOfDay(pool, date)`) —
  stejný den = stejná postava pro všechny. Dává +50 % XP (tempo, ne sílu).
- **Bounty roste se sérií oběti** (`bountyFor(streak)` = 180 + 60×série,
  strop 4). Sim, banner i testy berou číslo z téhle funkce — nikdy
  nepočítej odměnu znovu na jiném místě.
- **`streak` je ve snapshotu** a resetuje se smrtí; HUD z něj dělá „🔥N"
  až od 2. Zabití hrdiny se sérií ≥3 se hlásí jako `SHUTDOWN`.
- **Testy:** `test/moba-mastery.mjs` (křivka, XP, persistence, poškozený
  profil, hrdina dne, bounty, streak ve snapshotu) a
  `.artifacts/probe/moba-mastery-audit.mjs` (odznak na pick screenu,
  zápis po zápase, hvězda hrdiny dne).

### Past: flaky test arény

- `arena.mjs` četl „B je mrtvý" z **posledního** snapshotu, ale zabití
  mohlo přijít o pár snímků dřív a respawn (2,4 s) ho stihl vzkřísit →
  padalo 2× ze 3 běhů. Správně se hledá **kterýkoli** snapshot, kde je
  hráč mrtvý (`a.inbox.filter(...).map(...).find(...)`).
- Obecné pravidlo: test, který ověřuje **přechodový stav** (mrtvý,
  zraněný, na cooldownu), nesmí číst „aktuální" hodnotu — musí hledat
  v historii zpráv.

## MOBA — aspekty kouzel a týmová aura (2026-11-04, protokol 29)

- **Aspekt je obchod, ne buff.** Každá škola má dvě varianty: ostrá
  (+14 % dmg, −20 % štítu a léčení) a ochranná (−12 % dmg, +35 % štítu
  a léčení). Kdyby jedna byla lepší, výběr by nebyl volba, ale kontrola
  znalosti. Test `moba-aspects.mjs` na tom trvá.
- **Násobek se aplikuje na celou sadu** v `spellsFor(id, color, aspect)`.
  Kdyby se počítal po kouzlech, HUD (který volá stejnou funkci) by
  ukazoval jiná čísla než sim.
- **Volba jde do `join.aspect`**, server ji předá do sedačky a ta do
  `makeHero`. Klient si pro HUD počítá kouzla stejnou funkcí se stejným
  aspektem — jinak by hráč viděl cizí čísla.
- **Boti hrají `a` (ostrou).** Měřeno: když polovina botů brala `b`,
  zápasy se protáhly na 357 s a 7/20 skončilo timeoutem — dva defensive
  týmy se neudolají. Hráč si `b` vybrat může.
- **`schoolOfAvatar(id)`** čte školu bez stavby kouzel — pick screen ji
  potřebuje dřív, než začne zápas.
- **Prastaré stvoření (řeka) je týmový objektiv.** `grantTeamAura()` dá
  auru všem živým spojencům (síla/vidění/rychlost 90 s), sólo buff
  zabijáka zůstává. Mrtvý spojenec ji nedostane, soupeř taky ne.
- **Čísla aury jsou malá** (+12 %/+8 %/+6 %) a nerf přišel po měření:
  první verze (+20 %, 120 s) vypadala, že prodlužuje zápasy. A/B běh
  bez aury dal 302 s / 6/20 timeout, s aurou 293 s / 4/20 — rozdíl je
  šum, ale slabší čísla jsou bezpečnější.
- **Buffy patří do HUD** (`moba-buffs`): bez viditelného odpočtu hráč
  nepozná, že tým něco získal, a objektiv nic nemění.
- Testy: `test/moba-aspects.mjs` (24), `test/moba-team-aura.mjs` (10),
  balance 20 zápasů po každé změně čísel.

## Křídla — hratelný svět na Uranu (2026-11-04)

- **Není to arkáda, je to cesta.** Inspirace *Sky: Children of the Light*:
  žádní nepřátelé, žádný časový limit, sedm světel a svatyně na konci.
  Kdo přidá skóre za rychlost jako trest, změní žánr.
- **Fyzika je čistá a testovatelná** (`core/sky/flight.ts`): pláštěnka
  zvedá a dochází, klouzání dobíjí, proudy nesou i bez pláštěnky, hranice
  tě vrátí (nikdy nezmizíš). Simulace nezná three.js — test ji pouští
  v Node.
- **Data světa jsou v `world.ts`**, ne ve scéně: světla, proudy, plošiny,
  svatyně i texty. Kdyby si scéna psala vlastní pozice, rozejde se
  s kolizemi a s testy.
- **Svatyně se otevře jen se všemi sedmi** — jinak by šlo „vyhrát" hned
  na startu (test to hlídá).
- **Skóre netrestá kochání**: světla jsou základ, čas je malý bonus
  a nikdy nejde do záporných čísel.
- **Hra je nová položka žebříčků** (`wings`), takže se zapisuje stejnou
  cestou jako ostatní (`recordRun`), včetně denní výzvy.
- **Vizuál se ladil podle screenshotů, ne podle kódu.** První verze měla
  mraky jako šedé bubliny (koule s tvrdým okrajem) a proudy jako šedé
  sloupce; správně je **měkká billboardová textura** (`softSpriteTexture`,
  jediná textura ve scéně) a stoupající jiskry.
- **Světlo nikdy není „koule s glow"**: obal z průhledné koule má tmavý
  obrys. Řešení je sprite s aditivním blendingem + malé jasné jádro.
- **Ladicí háček** `?skyDebug=1` vystaví `window.__skyDebug()` a
  `__skyTeleport(x, y)` — bez něj by E2E muselo doletět celou cestu.
- Testy: `test/sky-flight.mjs` (26 kontrol) a
  `.artifacts/probe/sky-audit.mjs` (19 kontrol, včetně zápisu profilu
  a tabule).

### Křídla — druhá cesta a darování (2026-11-05)

- **Cesty jsou data, ne kód** (`SKY_PATHS` v `world.ts`): `calm` a `wind`
  mají vlastní světla, proudy, plošiny i svatyni, ale **stejné texty**
  světel — příběh se nemění podle obtížnosti.
- **Simulace zná cestu** (`FlightState.path`) a `currentAt(x, y, path)`
  bere proudy z `pathData(path)`. Kdyby si scéna držela vlastní pole
  proudů, hráč by letěl podle jiných čísel, než počítá fyzika.
- **Zápis do progrese až po volbě.** Scéna jen oznámí dolet; stránka
  ukáže „nechat / darovat" a teprve volba zavolá `recordRun` (darování
  přidá `SKY_GIFT_BONUS`). Kdyby se zapisovalo při doletu, volba by
  neměla co ovlivnit.
- **Sebrané světlo se hlásí jednou.** `FlightState.lastLight` se nesmí
  mazat v kroku simulace — telemetrie jede 6×/s a světlo by minula
  (reálně: text příběhu se ukázal ve 2 ze 3 běhů). Vyzvedne ho až ten,
  kdo ho zobrazí (`SkyScene`).
- **Ladicí háček vydává i data cesty** (`__skyLights`, `__skyShrine`) —
  test tak nemusí znát souřadnice a přežije změnu rozptylu.
- Test: `test/sky-flight.mjs` 39 kontrol, `.artifacts/probe/sky-audit.mjs`
  24 kontrol.

## Lumi — děvčátko s lucernou (2026-11-05)

- **Jméno světa je Lumi**, ne Křídla. Route `/lumi`, hra v žebříčcích
  `lumi`, stará `/kridla` **jen přesměruje** (`router.replace`) — odkaz
  z historie nebo chatu nemá skončit na 404.
- **Lucerna je skutečný model** (`public/models/lampion.glb`, 4,3 MB,
  ~250 000 trojúhelníků, původem `heros/…/Lampion_Kralovstvi_srdce_v6.glb`).
  Normalizuje se podle bounding boxu na výšku 0,55 jednotky, dostane
  teplé emissive a v ruce se houpe. `Suspense` má primitivní náhradu,
  takže hra nikdy nečeká na soubor.
- **Model se MUSÍ zjednodušit, než jde do hry.** Zdroj má 242 648
  trojúhelníků (víc než celá MOBA) a 4,3 MB; po `scripts/ops/lumi-lantern-lod.py`
  je z něj 13 325 tris / 0,21 MB. Skript dělá **vertex clustering**
  (kvantizace na mřížku) — quadrická dekurace na tenkých vyříznutých
  panelech skončila na 65 % a vracela nekonzistentní indexy.
- **Naměřeno po optimalizaci:** 35 draw calls (bylo 128), 19 323 tris
  (bylo 259 216), 60 fps na M1 (1440×900). Na mobilu (`coarse`) se model
  vůbec nestahuje a svítí primitivní lucerna.
- **Past v generátoru LOD:** uvnitř `cluster_simplify` se nesmí použít
  jméno `faces` pro lokální počet — přepíše vnější pole, které čte
  closure, a shodí to `IndexError` s nesmyslným indexem.
- Zdroj modelu zůstává v `heros/`; do repa jde jen herní (zjednodušená)
  kopie. Kdo mění model, spustí skript znovu.
- **`/models` musí být v `PUBLIC_PREFIXES`** v `middleware.ts` — jinak
  middleware vrátí 307, `GLTFLoader` dostane HTML a hra tiše pojede na
  náhradě (přesně to se stalo a audit to odhalil).
- **Hrdinka je z primitiv** (šaty, hlava, vlasy, paže) a drží jedno
  měřítko — jde snadno vyměnit za skutečný model, až bude.
- **Kamera je blízko a mírně napřed** ve směru letu; při pohledu na celou
  mapu byla postava 20px tečka (první verze).
- **Text k příběhu nesmí ležet na postavě**: karta je pod hlavičkou
  (`top: 8.2rem`), ne ve středu — jinak zakryje Lumi i lucernu.
- Testy: `test/lumi-flight.mjs` (39 kontrol) a
  `.artifacts/probe/lumi-audit.mjs` (25 kontrol, včetně „model se
  opravdu stáhl" přes resource timing a měření tri/tris).

### Lumi — zvuk a deník (2026-11-05)

- **Zvuk jde přes sdílený engine** (`core/audio/engine.ts`), žádné
  soubory: `lanternIgnite`, `lightPickup`, `gust`, `shrineOpen`, `gift`
  a spojitý `startWindLoop()` (růžový šum s pomalým LFO).
- **Výška tónu světla roste s pořadím** (`playTone` s `784·2^(n/12)`) —
  jinak by sedm světel znělo jako jedno a cesta by neměla stupnici.
- **Hrany, ne snímky:** proud vzduchu a otevření svatyně se hrají při
  **změně stavu** (`audioEdges` ref), ne každý frame.
- **Vítr patří k letu, ne ke stránce:** startuje v efektu na
  `phase === 'flying'` a v cleanupu se zastaví — jinak hučí i po doletu.
  Intenzita jde z `stats.speed`, proto ho `LumiStats` nese.
- **Deník je trvalá stopa příběhu** (`core/lumi/journal.ts`,
  `nirvana.lumi.v1`): sebraná světla, počet cest a volby nechat/darovat.
  Text se ukazuje 8 s, deník ho drží navždy.
- **`LumiStats.lightIds`** (ne jen počet) — deník potřebuje id; počet by
  nestačil a do deníku by se zapisovalo „něco".
- **Testy:** `test/lumi-journal.mjs` (16 kontrol) a `lumi-audit`
  (31 kontrol: deník 7 textů, před cestou prázdný, po cestě 7/7 + runs +
  gift, během letu hra zní).

### Lumi — třetí cesta a zámek v datech (2026-11-05)

- **`LUMI_PATHS.light` („Cesta světla")** je třetí, nejtěžší varianta:
  světla ve spirále vzhůru, čtyři úzké proudy vysoko, dlouhé prázdno
  mezi nimi, svatyně v 92/92. Není to delší trasa, je to jiný tvar.
- **Zámek patří do dat, ne do UI.** `isPathUnlocked(pathId, journal)`
  v `journal.ts` je jediné pravidlo; stránka ho jen vykresluje (dashed
  karta s 🔒). Kdyby podmínka žila v JSX, šla by obejít a test by ji
  neviděl.
- **Deník si nese dohrané cesty** (`paths`), `recordJourney(lights,
  gift, path)` je zapisuje bez duplicit — z toho plyne odemčení.
- **Pořadí karet je progrese** (calm → wind → light), ne pořadí klíčů
  v objektu; jinak se `light` objeví uprostřed a mate.
- Test: `test/lumi-journal.mjs` (28 kontrol, včetně zámku a odemčení)
  a `lumi-audit` (36 kontrol: zamčená karta s 🔒, po seedu deníku
  odemčená a volatelná).

## Lumi — společné létání (2026-11-05, protokol 30)

- **Lumi je relay hra, ne autoritativní simulace.** Nemá zásahy, skóre ani
  soupeře, takže není co podvádět: klient počítá svůj let sám (stejný
  `stepFlight`) a server ho jen předává. Serverová fyzika by platila
  latenci a složitost za ochranu, kterou hra nepotřebuje.
- **Server drží jen sdílená světla a stav letců.** Sebrané světlo je
  společná pravda místnosti — kdo se přidá později, dostane je ve
  snapshotu (jinak by hledal světla, která na obrazovce nejsou).
- **Whitelist her v `join` je past:** `lumi` v něm chybělo, takže join
  tiše propadl do `arena` (místnost `arena-1`). Nová hra = nový záznam
  v tom whitelistu (stejná chyba jako u tanků).
- **`sendFly` nesmí zahodit sebrané světlo.** Běžný stav se throttluje na
  20 Hz, ale zpráva s `collect` jde vždy — jinak by se světlo ztratilo.
- **Ostatní letci se kreslí bez modelu lucerny** (jen svítící koule):
  model má 13k trojúhelníků a čtyři kopie by scénu zabily.
- **E2E se dvěma prohlížeči:** prohlížeč uspí `requestAnimationFrame` na
  kartě v pozadí, takže hra na ní stojí. Před akcí je nutné
  `page.bringToFront()` — jinak teleport proběhne, ale sim ho nezaznamená
  (přesně to mě mate při prvním běhu).
- Mistnost je pro 4 (`LUMI_ROOM_SIZE`); víc by z oblohy udělalo trh.

## Lumi — kompas a HUD (2026-11-05)

- **Kompas není UI věc, je to `nextTarget()` z `flight.ts`.** HUD jen zobrazuje, co
  simulace považuje za cíl (nejbližší nesebrané světlo → svatyně → `null`). Kdyby si HUD
  počítal cíl sám, dřív nebo později se rozejde s tím, co hra opravdu dělá.
- **Otáčení šipky atributem, ne CSS transformem.** `transform: rotate()` na HTML prvku
  se v auditním (headless, SwiftShader) prohlížeči kreslí jinam než v reálném — kompas
  pak „míří špatně", i když je matice správná. Šipka je proto SVG s
  `transform="rotate(a 12 12)"`; ten se kreslí správně v obou světech a jde změřit
  z pixelů (měřeno na zvětšené šipce: 54° vs. cíl 41°).
- **Testy nesmí čekat pevný čas.** WebGL ve swiftshad eru startuje 1–3 s, takže první
  telemetrie (a tím i kompas) přijde později než `wait(1200)`. Audit čeká na selektor
  (poll 40×200 ms), ne na čas — jinak padá na něčem, co funguje.
- **HUD lišta má Lumi jako odkaz i jako ukazatel.** `games/links.ts` = položka do lišty,
  `GameHud` = žeton `🏮 X/7` z deníku (klikacím na `/lumi`), aby byl postup vidět i mimo let.
- **Planeta:** panel Uranu má druhé CTA „Letět s Lumi" (`href2: '/lumi'`), text mluví
  o Lumi, ne o Křídlech; `/uranus` na Lumi odkazuje.

## Lumi — duchové, foto mód a klid (2026-11-05)

- **Duch je soft delete, ne nový stav hry.** `leave()` v `apps/nirvana-net/src/lumi.ts`
  neodstraní letce, ale nastaví `ghostUntil = now + 3 s`; `step()` ho pak uklidí,
  `message()` oživí (reconnect se stejným id). Snapshot posílá `ghost: true` —
  pole je **volitelné**, takže protokol zůstává 30.
- **Počty se musí ptát na živé, ne na záznamy.** `state()` i `size()` volají
  `liveCount()`; kdyby počítaly `flyers.size`, místnost by po odchodu posledního
  hráče 3 s „hrála" a duch by držel sedlo v místnosti pro 4.
- **Klient si drží vlastní razítko** (`ghostSince` v `RemoteFlyers`) a podle něj
  3 s stahuje `opacity` materiálů i sílu světla. Server neposílá čas — posílá jen
  přechod (`ghost` se objeví a po 3 s zmizí), takže se hodiny nekopírují přes síť.
  Materiály musí mít `transparent` **už při vytvoření**; nastavovat ho za běhu
  znamená rekompilaci shaderu.
- **`setPeers` počítá jen živé.** „Letí s tebou 1" u hráče, který už zavřel kartu,
  je lež — duch patří do scény, ne do HUD.
- **Foto mód skrývá přes `opacity`, ne `display`.** Kdyby chrome zmizel z layoutu,
  posunula by se scéna i kamera a snímek by nebyl z místa, kde hráč stál.
  `Esc` + samostatný `✕ zpět` (mimo skrývanou vrstvu) — na mobilu žádný `Esc` není.
- **Přístupnost patří do `useFrame`, ne do CSS.** `prefers-reduced-motion` v
  `globals.css` řeší přechody, ale mraky a jiskry se hýbou ve scéně; `LumiScene`
  proto čte `prefersReducedMotion()` a vypne posun/animaci. Letět se musí dát dál —
  „bez pohybu" nesmí znamenat „bez hry". Zvuk větru zůstává (vypíná ho `SoundToggle`).

### Pasti, které to odhalilo

- **`cp -a src dst` do existujícího `dst`** zanoří obsah (`static/static/…`) a server
  vrací 404 na chunky, i když jsou soubory na disku. Vždy `rm -rf dst && cp -R src dst`.
- **Paralelní `next build` maže `.next/standalone`.** Audit proti lokální appce pak
  hlásí `canvas=0`/404, protože artefakt mezitím zmizel. Ověřuj z izolované kopie
  (`cp -R .next/standalone /tmp/run`, do ní `static` + `public`).
- **Netestuj `opacity === '0'`.** Přechod 0,25 s vrátí `1.04542e-08`; test musí
  porovnávat číslo (`< 0.05`).

## Lumi — stopa a denní obloha (2026-11-05)

- **Stopa se nevzorkuje každým snímkem.** `core/lumi/trail.ts` drží `pushTrail`
  (vzorek po `TRAIL_STEP` = 0,55 j.), `pruneTrail` (`TRAIL_TTL` = 1,3 s) a
  `trailFade`. Kdyby se plnila každým framem, měl by hráč na 60 fps stopu 0,3 s
  a na 20 fps tři sekundy — jinou hru podle výkonu stroje. Test to hlídá
  (`test/lumi-trail.mjs`, 15 kontrol, včetně „stejná dráha na 60/20 fps“).
- **Jas jde přes `setColorAt`, ne `opacity`.** `opacity` je u `instancedMesh`
  společná pro všechny instance, takže by zhasla celá stopa naráz. Aditivní
  blending + barva k nule = plynulé doznívání; `instanceColor` musí existovat
  **před prvním framem** (`useLayoutEffect`), jinak se materiál rekompiluje.
- **Na mobilu se stopa nekreslí** (`detail = false`) — 24 instancí je na dotyku
  zbytečných a `detail` už řídí i model lucerny.
- **Denní obloha patří do `world.ts`, ne do stránky.** `lightsFor(pathId, date)`
  posune světla podle data v **UTC** (stejný den = stejná obloha pro všechny,
  jinak by si dva lidé v co-opu nenašli stejná světla). `pathData(id)` je jediná
  cesta k datům — simulace, scéna i HUD ho volají bez data.
- **Testy ať čtou `pathData().lights`, ne `LUMI_LIGHTS`.** Statická konstanta je
  základ, ne dnešní obloha; test, který teleportuje na `LUMI_LIGHTS`, sebrne jen
  část světel (přesně to se stalo po zavedení L-7 — 3 testy spadly).
- **Světlo nesmí spadnout do svatyně** (`r + 6`). Kdyby ano, hráč by ho „sebral“
  až u cíle a poslední úsek cesty by byl bez hledání.

## Lumi — kapitoly a VR (2026-11-05)

- **Kapitola nemá vlastní stav.** `LUMI_CHAPTERS` v `world.ts` je dozvuk jedné cesty
  (titulek + text cs/en) a odemyká se **odvozeně** z `journal.paths` — žádné nové pole
  v `nirvana.lumi.v1`, takže starý deník funguje beze změny.
- **`introFor(pathId, paths)`** vrací jiný úvod, když cestu už doletěla: obloha se
  posunula (L-7) a hra to přizná. Texty jsou v `world.ts`, ne v JSX — jinak by je
  testy neviděly a `page.tsx` by byl plný literálů.
- **VR: `<XR>` patří do plátna, store do stránky.** `LumiCanvas` bere `xrStore` a obalí
  jím scénu (stejný vzor jako Saturn/MOBA). V XR se **nesmí použít `CameraRig`** —
  kamera patří headsetu a každý frame by s ní cloumal.
- **`XROrigin` letí za Lumi**, ne v ní: origin na `(x−2,4; y+1,1; 4,4)`, mírně stočený,
  takže hráč vidí postavu i oblohu před sebou. Kdyby seděl na její pozici, koukal by
  zevnitř hlavy.
- **Vstup přes `VrInputs` → syntetické klávesy** (`ArrowUp/Left/Down/Right`, spoušť
  `Space`). Stejná pravidla jako dotyk: hra má jednu vstupní větev.
- **Co VR ještě neumí:** letět směrem pohledu (dnes joystick) a není ověřené na
  headsetu. Audit kontroluje jen to, že klik na `VR` bez WebXR scénu nerozbije.

## Mobil a výkon napříč Nirvanou (2026-11-05)

- **Měř dřív, než optimalizuješ.** Dva prose: `responsive.mjs` (10 rout × 4 viewporty,
  počítá přesah a prvky mimo viewport) a `draw-calls.mjs` (obalí WebGL draw funkce,
  takže draw calls sedí i na swiftshaderu; fps je jen orientační). Třetí je
  `lumi-mobile-perf.mjs` pro Lumi ve dvou velikostech.
- **`canvasDpr()` (`core/design/dpr.ts`) je jediný strop pixel ratia.** Drží se
  `[1, max]` na monitoru a `[1, 1.25]` na dotyku/úzkém okně. Kdo píše nové plátno,
  použije `dpr={canvasDpr(1.75)}`, ne vlastní číslo — jinak se seznam za chvíli
  rozjede a půlka her zůstane na 1,75.
- **Nesahat na `quality()`** ve `SceneRoot`/`ProjectPresentation`: tam se rozhoduje
  i o post-processingu a tierech A/B/C pro sdílené scény. `canvasDpr` je jen pro
  herní plátna, která tiery nemají.
- **Lišta her na mobilu potřebuje vlastní řádek.** `.game-hud-stats` má
  `flex: 0 0 auto` + `margin-left: auto`, takže si drží obsahovou šířku — na 390 px
  přetékala o 31 px doleva (žetony i tlačítko zvuku mimo obraz). Řeší
  `@media (max-width: 760px) { .game-hud-stats { flex: 1 1 100%; min-width: 0 } }`.
  **Past:** `left: 50%` + `translateX(-50%)` se nesmí míchat s `right` — jedno
  z nich musí na malých šířkách zmizet, jinak box „visí" mimo.
- **Dotykové cíle ≥ 40 px** (`WCAG 2.5.8`) platí i pro doplňky: holo tlačítka
  v konzoli (26×22) a posuvník citlivosti v Marsu (16 px) se zvětšují jen na
  `(hover: none) and (pointer: coarse)`, myš má pořád kompaktní vzhled.
- **Známý zbytek:** na tabletu 768 px je label skříně v pouti 4 px mimo viewport
  (pozice jde z 3D projekce `<Html>`, ne z CSS). Obsah není ztracený — nechte být,
  dokud se `<Html>` nepřepne na vlastní clamping.
- **Stav měření:** 390×844 bez přesahu na všech 10 površích, `mobile-audit` PASSED
  (všechny hry mají dotykové ovládání a kouzlo v MOBĚ opravdu ubere manu).

### Instancování bran v chrámu (`/hiran`, 2026-11-05)

- **Šest meshů na bránu byl nejdražší kus scény.** Patnáct bran × 6 = ~90 draw callů,
  a přitom se brány liší **jen barvou prstence**. Nově šest `SceneInstances`
  (pylon, podstavec, hlava, prstenec, clona, klenot) s barvou v `instanceColor`.
  Naměřeno: **139 → 39 draw callů** (71 %), obraz stejný (screenshot před/po).
- **Klikání po brnách zůstává.** Handler visí na obalujícím `<group>`, r3f k eventu
  přidá `instanceId`; z něj se dohledá `gates[index]` a zkontroluje `gate.present`.
  Ověřeno v prohlížeči: klik na bránu → `/present/nebeska-flotila`.
- **Scéna je sdílená s webem** (`apps/website-v2.9` → `HiranPreview`), takže se po
  každé změně musí projít `tsc` v **obou** appkách. API komponenty se neměnilo.
- **`InstanceItem` bere `position`/`rotation`/`scale`/`color`** — kdo přidá do brány
  další díl, přidá ho jako další instanci do `Gates`, ne jako nový `<mesh>` v `map()`.
- **`/` (141 calls) se neinstancuje.** Planety mají každá vlastní texturu a jiný
  materiál; další úspora by znamenala ubírat objekty (kvalitativní tiery to už dělají),
  ne slít meshe.

## Lumi — předání světla (L-6, proto 32)

- **Darování je vlastní zpráva, ne pole ve `fly`.** `fly` nese pozici; kdyby v něm
  šel i dar, klient by musel posílat i souřadnice a mohl je omylem vynulovat.
  Proto `{ t: 'handoff', light }` a server si pozici nechá z posledního `fly`.
- **Server si drží světla každého letce zvlášť** (`flyer.lights`), ne jen sdílenou
  množinu místnosti. Bez toho by šlo darovat cizí světlo — kontrola je
  `flyer.lights.has(light)`, ne „je v místnosti".
- **Cíl vybírá server** (nejbližší jiný letec; duch se nepočítá). Klient neposílá
  identitu, takže nemůže darovat „někomu, kdo tam není", a nemusí znát cizí id.
- **Event nese oba konce** (`{kind:'gift', light, from, fromName, to}`), takže dárce
  i obdarovaný vidí, co se stalo. Kdo si event vyloží jako „mě se to týká", rozhoduje
  podle `to === youPlayerId`.
- **Emit jde z `step`, ne z `message`.** `MatchCtx.emit` je k dispozici jen ve `step`,
  takže se dar zařadí do `flyer.handoff` a vyřídí v nejbližším ticku.
- **HUD:** tlačítko `🤲` se ukáže jen v co-opu, když máš světlo a někdo další letí;
  badge `🤲 N` drží počet darů, hláška visí 4 s. Na mobilu má tlačítko 40 px.
- **Deploy:** `PROTO_VERSION` 32 → **net první, pak appka** (starý net nový `handoff`
  odmítne jako `unknown_type`).

## Jazyky a i18n (L-10, 2026-11-05)

- **Tři jazyky, jeden typ.** `Lang = 'cs' | 'en' | 'es'` v `core/i18n`; `LANGS`
  určuje i pořadí přepínače (`nextLang`), takže se cyklus nedá rozjet na třech
  místech zvlášť (dřív to byly tři ternárky v Shell/HoloConsole/ProjectLanguageButton).
- **`es` je nepovinné u textů, povinné u klíčů chrome.** `tx(text, lang)` padá
  na `en`, takže částečný překlad nikdy nezobrazí `undefined` — proto jde
  překládat po částech. `COPY` (63 klíčů) má `es` kompletní, protože je to chrome.
- **Texty obrazovky patří do slovníku, ne do JSX.** Lumi má `core/lumi/copy.ts`
  (`LUMI_COPY` + `fill()` pro `{n}`/`{name}`); v `page.tsx` nesmí zůstat žádný
  `cs ? '…' : '…'`. Když se přidává jazyk, hledá se v jednom souboru.
- **Data světa zůstávají v `world.ts`** (`LumiText` = `{cs, en, es?}`) — čte je
  i simulace a testy, ne jen UI.
- **Volba jazyka:** `?lang=es` (override pro audity) → `localStorage['nirvana.lang.v1']`
  → `navigator.language` (`cs`/`sk` → cs, `es` → es, jinak en). `cs` je výchozí pro
  SSR a první render, skutečná volba se dohrává v efektu (jinak hydration mismatch).
- **Sdílené scény mají vlastní `Lang`** a nesmí importovat z appky (canon: jen
  `three` + `@genesis/runtime`). Pro výběr textu je `kit/localized.ts`
  (`pickLang`), který chybějící `es` shodí na `en`; přímé `text[lang]` v shared
  scéně neprojde `tsc`, jakmile `lang` umí i jazyky, které scéna nemá.
- **Hotové povrchy v ES:** chrome (`COPY`), Lumi (`core/lumi/copy.ts`), pouť
  (`app/park/copy.ts`), lobby (`app/multiplayer/copy.ts`), Mars (`app/mars/copy.ts`),
  Merkur (`app/mercury/copy.ts`), Venuše (`app/venus/copy.ts`) — včetně jmen
  soupeřů (`nameEs` v `core/race/rivals.ts`) a tabulek (`GameBoard`).
- **Co ještě není v ES:** `/earth` (79 inline), `/fleet` (20), `/avatars` (15) —
  dnes pro `es` zobrazí angličtinu (fallback z `tx()`), takže se to nemá hlásit
  jako „přeloženo".
- **Vícejazyčné ternárky se snadno přehlédnou.** `grep "cs ?"` najde jen
  jednořádkové; texty zlomené do dvou řádků pres `{cs` nový řádek prosviští.
  Po migraci projdi `grep -n "{cs"` a `grep -n "lang === 'cs'"` — v obou musí
  být 0 (kromě samotného `const cs = lang === 'cs'`). Přesně takhle zůstaly
  v Merkuru dvě věty anglicky a v pouti popisek ruského kola.
- **Kopírování textu do slovníku je mechanické, ale nesmí se dělat po jednom
  kusu.** Vždycky projdi celý soubor (`grep -c "cs ?"` musí skončit na 0), jinak
  zůstanou v JSX dvě tři věty, které nikdo nenajde — a přesně ty se pak ve
  španělštině ukážou česky.
- **Pozor na scene props:** `ParkScene` má vlastní `lang: 'cs' | 'en'`; když se
  rozšíří `Lang` v appce, musí se rozšířit i prop, jinak `tsc` spadne na
  předávání (`Type 'Lang' is not assignable to…`). Totéž u `titleOf(id, lang)`.

## Flotila z marketu — `/fleet` (2026-11-05)

- **Lodě jsou produkty z marketu, ne nové assety.** Zdroj jsou STL skládačky
  (`apps/MarketPlace/public/shop/models/*.stl`), konvertor
  `scripts/ops/starfighter-glb.py` z nich dělá herní GLB do
  `apps/nirvana/public/models/fleet/`. Kdo mění model, spustí konvertor **a**
  `scripts/ops/fleet-render/render.mjs` — orientace se v datech zkontrolovat nedá.
- **Tabulka `SHIPS` v konvertoru je ruční.** Heuristika „nejdelší osa = nos"
  na skládačce nefunguje (B-Wing má nejdelší osu křídlo, TIE panely). Špatné
  znaménko znamená, že loď letí pozadu.
- **Panelový lak je ve vrcholových barvách, ne v textuře.** Skládačka je *už*
  rozdělená na 1 200–4 400 destiček, takže plátování vznikne zdarma. Cena:
  konverze musí převést paletu ze sRGB do **lineárního** prostoru (glTF
  `COLOR_0`) a srovnat normály od středu trupu ven — otevřené plochy mají
  polovinu normál dovnitř a ve hře se to projeví jako černé fleky.
- **`trimesh.export` nezapíše `NORMAL` ani `COLOR_0`.** Model se načte, ale je
  černý a bez odlesků. Proto má konvertor vlastní `write_glb`. Když se GLB
  „tváří v pořádku" a přesto nesvítí, první kontrola je JSON chunk.
- **GLB musí ležet pod `/models`** — jen ten prefix je v `middleware.ts`
  veřejný. Pod `/fleet/` by request dostal 307 na ZAP bránu a `GLTFLoader`
  by načetl HTML (stejná past jako u Lumi lucerny).
- **Materiál potřebuje `scene.environment`.** `metalness > 0` odráží jen
  prostředí; bez `RoomEnvironment` je loď černá i při silných světlech.
- **Doky jsou funkce času** (`core/fleet/docks.ts`): Nabukano 3 kotviště ×
  `NABUKANO_SCALE=4` otočená `fleetHeading(t)`, Issobella z `Euler(0.32,
  ringSpinAngle(t), −0,14)` — **stejná** rotace jako `IssobellaRing`. Zakotvená
  loď kopíruje pozici doku; kdyby si držela vlastní souřadnice, ujede z něj.
- **Dokovací paprsek není kosmetika.** Volnoběh táhne dopředu 0,35 × maximum,
  takže bez přitažení a zbrzdění v okruhu `DOCK_RADIUS` se přistání nedá
  dokončit. Odhalil to `test/fleet-flight.mjs`, ne hra.
- **Brzda je 2,2× silnější než plyn** (`BRAKE_FACTOR`) — je to nástroj, kterým
  se doletí na dok. Kdyby brzdila stejně, hráč vždy přeletí.
- **Kamera při zakotvení jde zespodu** (`+2,6; −2,0; +2,6`). Za lodí by stála
  uvnitř dokovacího rámu a hráč by místo stroje viděl tmavou desku.
- **Startovní pozice je součást designu:** `(-6, 7, 24)` míří tak, aby v záběru
  byly **planeta i Nabukano**. Start u trupu vypadal jako temná stěna.
- **Test:** `npx tsx test/fleet-flight.mjs` (35 kontrol, čistá simulace) a
  `.artifacts/probe/fleet-audit.mjs` (16 kontrol v prohlížeči — mimo jiné že se
  model opravdu stáhl, ne jen že existuje canvas).
- **Co tu není:** multiplayer, VR, LOD, ověření na skutečném telefonu.

## Flotila — společný let (2026-11-05, protokol 31)

- **Relay, ne autoritativní simulace.** Volný let nemá zásahy ani skóre, takže
  klient počítá pohyb sám a server ho jen předává. Server ověřuje **rozsahy**
  (poloha ±34, yaw zabalený, pitch/roll/speed stropy) a `dockId` **proti seznamu
  doků** — neexistující dok se zahodí i s příznakem `docked`.
- **Změna doku jde mimo throttle.** `sendFlight` posílá 20 Hz, ale když se změní
  `docked`, zpráva projde vždy — jinak by ostatní viděli loď na doku, který už
  opustila.
- **Cizí piloti se kreslí stejným modelem** (`MarketShip`), ne zjednodušenou
  náhradou: dva lidé v místnosti mají vidět stejnou hru. Pozice jdou z refu ve
  `useFrame` (snapshoty 15×/s by překreslovaly celý strom), sloty jsou klíčované
  **id pilota** — ne indexem, jinak se po odchodu „převlékne" loď.
- **Server nesmí importovat `docks.ts`** — ten počítá přes `three`, a deploy
  `nirvana-net` kopíruje jen `ws`. `apps/nirvana-net/src/fleet.ts` má proto
  **vlastní kopii seznamu doků**; při změně doků je nutné sáhnout na obě místa.
- **`nirvana-net` má `noUncheckedIndexedAccess`** — `SHIPS[1]` je
  `ShipSpec | undefined`, fallback potřebuje `!`.
- **Origin allowlist:** bez `NIRVANA_NET_ALLOWED_ORIGINS` služba zavře spojení
  z `:3010` (403) a hra zůstane „offline" bez chybové zprávy. V E2E to nastavuj.
- **Pořadí deploye:** `deploy-nirvana-net.sh` **první**, pak appka. `deploy-nirvana.sh`
  to kontroluje sám (`nirvana-proto-check.sh`) a při novějším klientovi se zastaví.
  **Nasazeno 2026-11-05:** net `20261105T140031Z`, app `20261105T140642Z` (artefakt
  z čistého worktree na `8eb02aaef`, protože pracovní strom měl cizí rozpracovanou práci
  a `.next` mohl být kontaminovaný cizím buildem).
- **Testy:** `apps/nirvana-net/test/fleet.mjs` (24 kontrol, server) a
  `apps/nirvana/e2e/fleet-online.mjs` (12, appka ↔ net; protistrana je Node WS
  klient, ne druhé okno — headless WebGL by měřil latenci, ne hru). Online test
  potřebuje build s `NEXT_PUBLIC_NIRVANA_NET_URL`; pozor, souběžný build
  v paralelní session umí do `.next` vnést cizí hodnotu.
- **Co tu není:** hlas, kolize lodí mezi sebou, týmové mise, pořadí/„kdo dřív
  přistál\" (server jen relayuje). Místnost má 6 pilotů.
