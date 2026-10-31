# REPORT — Kingdom F0–F2a: první svět OASIS

> **Datum:** 2026-11-01 · **Autor:** agent (autonomní) · **Stav:** F0 ✅ · F1 ✅ · F2a ✅ (orbit) · F2b ✅ (13 světů)
> **Rozhodnutí 👤, která to spustila:** (1) strom `Kingdom/` v rootu, stavěný od nuly; (2) `website-v2.9` zůstává knihovnou/docs; (3) Dashboard zůstává samostatný; (4) Nirvana = první svět OASIS, OASIS jednou jako AAA hra; (5) market, pool UI i Dashboard funkčně zůstávají.
> **Nic z toho není nasazené.** Kingdom běží jen lokálně (`127.0.0.1:3020`). DNS, EDGE2 a `systemd` jsou 👤.

---

## 1. Co je hotové

### F0 — Repo substrate (1 lockfile, 8 balíčků)

| Co | Stav |
|---|---|
| `Kingdom/` npm workspace root | 1 lockfile (ekosystém jich má 13) |
| `@zion/contract` — Portal Contract v1 | typy + `definePortal` + `readSpec` |
| `@zion/api` — jediná datová cesta | server-side `fetch`, cache per manifest, `tryRead` |
| `@zion/i18n` — jediná i18n | cs/en celé na serveru, žádný slovník v klientu |
| `@zion/ui` — jediný token set | `tokens.css` (CSS custom properties) |
| `@zion/world` — doména světa | **bez React/Three/DOM**, vynuceno lintem |
| `@zion/scenes` — web adaptér | three.js + R3F, smí importovat three |
| registry portálů | generovaný z manifestů (`scripts/codegen.mjs`) |
| hranice | `scripts/check-boundaries.mjs` — 6 pravidel, 0 závislostí |

### F1 — Brána

Obsah `apps/IntroPage` (`maintenance.html` + `intro-tabs.js` i18n) přepsán do **typovaných dat** `core/gate/content.ts` — ne do JSX:

- hero (`ZION` / `TERRA NOVA ∞ OASIS` / Multichain Dharma ekosystém) + vstup, OASIS preview, eXplorer
- **živý pás** — výška, difficulty, hashrate, block time, připojené mince (ověřeno live: 104 088 bloků / 5 494 / 92 H/s / 56 s / 12/12)
- **Co je ZION** — tři odstavce vč. fee splitu 89/5/5/1
- **Tři cesty na palubu** — Pozorovatel / Hráč / Stavitel
- **Vrstvy ekosystému** — L1–L6 jako rozcestník
- kotvy `#why` `#paths` `#layers`, patička

### F2a — První svět OASIS (orbit)

Scéna ve Místnosti, **generovaná Portal Contractem**: portál s `ring` souřadnicemi se objeví ve světě bez zásahu do rendereru.

```
packages/world/src/           packages/scenes/src/
  types.ts    Vec3, Planeta,    OrbitScene.tsx   Canvas, kamera, světla
              Prstenec, Marker  NewEarth.tsx     planeta + atmosféra
  geometry.ts stanice na        IssobellaRing.tsx prstenec L6 + 6 stanic
              prstenci         Starfield.tsx     2400 hvězd, 1 buffer
  rng.ts      mulberry32,       Gate.tsx         Brána (vstup) + puls
              starField         Markers.tsx      markery portálů + hover
  orbit.ts    Nová Země,
              Issobella, Brána
```

- **Nová Země** = planeta s texturou (82 KB webp), **Issobella** = prstenec se 6 stanicemi, **Brána** = místo příjezdu mimo planetu, **markery** = portály.
- Klik na marker → `/portal/<id>`; klik na Bránu → `/`.
- Graf se načítá **lazy a mimo SSR** (`next/dynamic`, `ssr:false`) — Místnost a okna jsou interaktivní dřív, než se stáhne three.js.

### F2b — 13 světů OASIS

`apps/shared/scenes` (10 900 LOC včetně `kit`) převzato do `packages/scenes/src/worlds/`:

- **`@genesis/runtime` zrušen.** Byl to alias, který si každá aplikace musela definovat v `tsconfig.json`; scény teď importují skutečný `runtime.ts` (jediná instance React/R3F/three v bundlu).
- **`OrbitRig` místo `drei` `OrbitControls`** — stejné rozhraní, jaké scény čtou (`target`, `enabled`, `autoRotate`, `autoRotateSpeed`, `min/maxDistance`, `maxPolarAngle`), plus tažení a kolečko. Bez drei.
- **Katalog je oddělený od rendereru:** `WORLD_CATALOG` (texty) v `@zion/world`, `WORLDS` (komponenty, kamery, controls) v `@zion/scenes`. Serverová stránka `/world/<id>` tak three nenačte do SSR.
- **`/world/<id>` je místo, ne portál.** Portály jsou okna (`/portal/<id>`), světy jsou plátno. Místnost má sekci „Světy OASIS" s 13 dlaždicemi.
- Ověřeno CDP na **Genesis Garden** (tři pyramidy, jezero, tee-pee, české labely) a **Kailash** (hora, klášter, modlitební praporky, sněžení).

### F3a — portál `freeworld` (Přístav)

Čtvrtý portál a první, který není „řetěz/pool/tržiště": **L5 fond, granty a projekty** z `zion-v31-free-world` přes `app.` proxy.

- 3 deklarovaná čtení (`fund/balance`, `grants`, `projects`), cache 60/120 s
- **ZIONy z flowers** (1 ZION = 1e6) se počítají v portálu, ne ve službě — jedna konverze na jednom místě
- live: **28 096 820 ZION** nashromážděno (blok 104 145), 0 vyplaceno, 6 grantů po 10M ZION, 12 projektů
- portál má `ring` → objevil se i ve scéně Místnosti jako čtvrtý marker (důkaz, že svět je řízený kontraktem)

---

## 2. Měření

| Metrika | Hodnota | Jak |
|---|---|---|
| `npm install` (celý strom, 58 balíčků) | 22–28 s | lokálně |
| Produkční build (Turbopack) | **377–1 533 ms** | `next build` |
| TypeScript | 0 chyb | `tsc --noEmit` |
| Hranice | **45 souborů / 0 porušení** | `check-boundaries.mjs` |
| JS celkem (všechny chunky) | 416 KB gzip | `gzip -c` |
| největší chunk — orbit (`three`) | 237 KB gzip, **lazy jen na `/room`** | chunk split |
| chunk světů (`three` + 13 světů + kit) | **294 KB gzip**, lazy jen na `/world/<id>` | chunk split |
| zdrojový kód světů | 10 900 LOC (převzato, ne přepsáno) | `wc -l` |
| První paint Brány | bez WebGL v bundlu | `/` nemá `<canvas>` |
| Lockfileů v Kingdomu | 1 | `find` |

---

## 3. Jak bylo ověřeno (a proč ne obyčejným screenshotem)

Headless screenshot WebGL canvasu v Chromiu **nevrací obsah plátna** — obrázek vyjde prázdný, i když scéna běží. Proto:

- ověření přes **CDP** (`Page.captureScreenshot` + `Runtime.evaluate`):
  `PROBE {"canvas":true,"w":1158,"h":338,"hasGL":true,"renderer":"ANGLE … SwiftShader","contextLost":false}`
- snímek potvrdil planetu s texturou, prstenec se stanicemi, Bránu, hvězdné pole i tři markery portálů.

Bez tohoto kroku by zelený build znamenal jen „kód se zkompiloval", ne „svět existuje".

---

## 4. Nálezy a pasti (zapsané do `Kingdom/AGENTS.md`)

1. **`next start` nefunguje s `output: standalone`** — v monorepu je `server.js` v `.next/standalone/apps/kingdom/`. Řešení: `apps/kingdom/scripts/start-standalone.mjs`, který stageuje `.next/static` a `public/` **vedle** `server.js`.
2. **`npm run build` za běhu serveru smaže stageovanou statiku** → textura začala vracet `500`, `Suspense` v R3F se nikdy neresolvoval a **scéna byla prázdná bez jediné chyby v logu**. Po každém buildu restartovat server (nebo znovu spustit `npm start`).
3. **R3F `useLoader` nemá `onLoad`** — třetí argument je `extensions`. `texture.colorSpace` se nastavuje po načtení.
4. **Kamera v R3F nemá `lookAt`** — bez `CameraRig` (nebo `makeDefault` + ovládání) míří podle rotace, ne na počátek. Planeta pak vypadne ze záběru.
5. **`manifest.ring` měl nirvana měřítko** (`x: 12.4`) — markery byly mimo záběr. Souřadnice srovnány na orbitu r ≈ 2,5.
6. **`document.body.style.cursor` v hoveru** je jediná DOM interakce scény — patří sem, ne do domény.
7. **Katalog světa oddělený od komponenty** — jinak si serverová stránka přitáhne three do SSR.
8. **`OrbitRig` musí stav číst z kamery každý frame**, ne z vlastní proměnné — jinak se po cinematickém intru scéna snapne zpět tam, odkud rig začal.

---

## 5. Co zůstává (F2b → F6)

| # | Úkol | Poznámka |
|---|---|---|
| ~~F2b~~ | ~~13 světů z `apps/shared/scenes`~~ | ✅ hotovo 2026-11-01 |
| **F2c** | sestup: z orbitu na povrch světa bez reloadu | dnes dvě samostatné scény (`/room` a `/world/<id>`) |
| **F3** | portály: účet, knihovna, freeworld, issobella, hiran, dao | každý manifest + typed reads |
| **F4** | write intents (podpis, checkout handoff) | market service a klíče zůstávají mimo Kingdom |
| **F5** | parita a zúžení `website-v2.9` o duplicitní povrchy | `/pool`, `/market`, `/l4-oasis`, `/explorer` |
| **F6** | apex → Brána, `pool./oasis./nirvana./freeworld./explorer.` → 301 | 🔀 + 👤 DNS |
| **F7** | engine swap za `packages/world` (UE5/Puerts) | AAA seam, mimo tento cyklus |

---

## 6. 👤 blokátory (nic z toho agent neudělá)

1. **Deploy Kingdomu na EDGE2** — `systemd` unit + nginx vhost + `certbot` (rozhodnutí 🤖: EDGE2, ne EDGE).
2. **DNS flip** apex → Kingdom = až F6, po paritě a 30 dnech redirectu.
3. **Rozhodnutí o portu** v produkci (dnes 3020 vedle website 3000 / market 3100 / nirvana 3010).
4. **Market data dluh:** 5 z 8 produktových obrázků vrací `404` (`/shop/img/digital/*.jpg`) — Kingdom je odfiltruje, ale obrázky chybí na marketu samotném.

---

## 7. Soubory a commity

| Commit | Obsah |
|---|---|
| `01888b9e5` | F0 — workspace, contract, api, i18n, ui, world, codegen, hranice, Brána+Místnost, 3 portály |
| `d7544eb53` | F1 — obsah IntroPage jako data, živý pás, sekce, kotvy |
| viz `git log` | F2a — doména světa (`rng`, `geometry`, `orbit`), `@zion/scenes` (orbit/planeta/prstenec/brána/markery), lazy `SceneHost`, scale fix manifestů |

Dokumenty: [`Kingdom/README.md`](../../../Kingdom/README.md) · [`Kingdom/ARCHITECTURE.md`](../../../Kingdom/ARCHITECTURE.md) · [`Kingdom/PLAN.md`](../../../Kingdom/PLAN.md) · [`Kingdom/AGENTS.md`](../../../Kingdom/AGENTS.md)
