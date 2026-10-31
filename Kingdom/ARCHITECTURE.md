# Kingdom — architektura

> **Verze dokumentu:** 1.0 · **Datum:** 2026-11-01 · **Stav:** návrh (F0 nezačata)
> **Rozsah:** co Kingdom je, jak je poskládaný, čím je vynucený a co do něj nikdy nesmí.

---

## 1. Jedna věta

**Kingdom je jediný klient ekosystému ZION.** Brána → Místnost → Světy a Portály. Služby zůstávají tam, kde jsou; Kingdom je jen čte.

---

## 2. Tři vrstvy

```
┌──────────────────────────────────────────────────────────────┐
│ BRÁNA (gate)                                                 │
│   vstup: příjezd, rozcestí, „vejdi dovnitř"                  │
│   ← dnešní IntroPage (apps/IntroPage)                        │
└──────────────────────────────────────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ MÍSTNOST (shell)                                             │
│   okna · lišta · deep-link /portal/<id> · session · i18n      │
│   registry portálů · host světa · BFF                        │
└──────────────────────────────────────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ SVĚTY (3D místa)          PORTÁLY (okna do dat)              │
│   nirvana = OASIS #1        chain · pool · market · wallet   │
│   prstence L6, povrch L5    books · freeworld · issobella    │
│   Brána jako místo          hiran · dao                      │
└──────────────────────────────────────────────────────────────┘
                            ▼
              Služby (beze změny) — viz §8
```

**Pravidlo vrstvy:** svět je místo, portál je okno. Tabulky, formuláře, checkout ani přihlášení nepatří do 3D scény — patří do okna. Ve VR se okna stanou in-world panely; logika se nemění.

---

## 3. Strom

```
Kingdom/
├── package.json                 # JEDEN workspace root (npm workspaces)
├── package-lock.json            # JEDEN lockfile
├── tsconfig.base.json
├── ARCHITECTURE.md · PLAN.md · README.md · AGENTS.md
│
├── apps/
│   └── kingdom/                 # JEDINÝ klient (Next 16 + React 19, standalone)
│       └── src/
│           ├── core/
│           │   ├── shell/       # window manager, lišta, deep-link, layout
│           │   ├── gate/        # Brána = vstup (F1)
│           │   ├── session/     # zion_session, ZIS challenge
│           │   ├── registry/    # GENEROVANÝ z manifestů (codegen)
│           │   ├── api/         # BFF: mapování reads[] na veřejná API
│           │   ├── i18n/        # konzument @zion/i18n (jediný provider)
│           │   └── scene/       # host světa (dnes R3F, zítra jiný adaptér)
│           └── portals/
│               ├── worlds/nirvana/   # OASIS svět #1
│               ├── chain/            # řetěz + explorer
│               ├── pool/             # kovárna
│               ├── market/           # tržiště (výloha + handoff na pokladnu)
│               ├── wallet/           # účet / peněženka
│               ├── books/            # knihovna (canon)
│               ├── freeworld/        # L5
│               ├── issobella/        # L6
│               ├── hiran/            # L3 AI
│               └── dao/              # L2 governance (čtení)
│
├── packages/
│   ├── ui/          # @zion/ui — tokeny, tailwind preset, primitiva, chrome
│   ├── i18n/        # @zion/i18n — JEDINÁ implementace (cs/en, typované klíče)
│   ├── session/     # @zion/session — ZIS klient, challenge, cookie handling
│   ├── api/         # @zion/api — typovaný klient, jediná datová cesta
│   ├── contract/    # @zion/contract — PortalManifest typy + codegen + lint
│   ├── wallet/      # @zion/wallet — harvest apps/zion-wallet-sdk
│   ├── world/       # @zion/world — DOMÉNA světa (bez React/Three)
│   └── scenes/      # @zion/scenes — web adaptér (R3F), harvest apps/shared/scenes
│
└── infra/
    ├── nginx/       # vhosty Kingdomu
    ├── systemd/     # zion-kingdom.service
    └── deploy/      # JEDEN deploy skript (dnes jich je 9)
```

**Proč `packages/world` odděleně od `packages/scenes`:** viz §7 (AAA seam). Doména světa nesmí nikdy importovat React ani Three.

---

## 4. Portal Contract v1

Jediný univerzální díl. Každý portál deklaruje `manifest.ts`:

```ts
import type { PortalManifest } from '@zion/contract';

export const manifest: PortalManifest = {
  id: 'pool',
  title: { cs: 'Kovárna', en: 'Forge' },
  icon: 'anvil',
  ring: { x: 12.4, z: -3.1, hue: 34 },   // pozice ve scéně (nepovinné)
  auth: 'none',                          // 'none' | 'session' | 'sign'
  windows: [
    { id: 'overview', title: { cs: 'Přehled', en: 'Overview' }, size: 'md' },
    { id: 'miners',   title: { cs: 'Těžaři',  en: 'Miners'   }, size: 'lg' },
  ],
  reads: [
    { id: 'coins',  method: 'GET', path: '/public/v1/coins',  cache: 30 },
    { id: 'stats',  method: 'GET', path: '/public/v1/pools',  cache: 15 },
  ],
  writes: [],                            // v1 default: prázdné
};
```

### Pravidla kontraktu

1. **Portál vlastní své UI.** Nativní React v `apps/kingdom/src/portals/<id>/`, ne iframe. Sdílí `@zion/ui`, `@zion/i18n`, session.
2. **`reads` jsou jediná cesta k datům.** BFF (`core/api`) je namapuje na veřejná API služeb. Portál, který volá backend napřímo, neprojde lintem.
3. **`writes` jsou opt-in** a v první vlně prázdné. Zapínají se per portál, až když existuje bezpečnostní model (podpis challenge, handoff na pokladnu).
4. **Nový portál = nový adresář s manifestem.** Registry ho zvedne automaticky přes codegen. Přidání povrchu je přidání modulu, ne nová aplikace.
5. **Manifest je typovaný.** `@zion/contract` je jediný zdroj pravdy pro `PortalManifest`, `WindowSpec`, `EndpointSpec`, `WriteIntent`.

### Vynucení (to, co dnes chybí)

Vynucuje `scripts/check-boundaries.mjs` — běží v ms, bez závislostí, součást `npm run verify`.

| Pravidlo | Jak je vynuceno |
|---|---|
| Portál nevolá backend napřímo | zákaz `fetch(` / `XMLHttpRequest` / `axios` v `apps/kingdom/src/portals/**` |
| Portál nemá vlastní i18n | zákaz `translations.ts` a adresářů `i18n`/`locale` v portálech |
| Doména světa je čistá | zákaz `react`, `three`, `@react-three`, `next`, `window`, `document`, `Math.random`, `Date.now`, `performance.now` v `packages/world/**` |
| Žádné importy ven z appky | zákaz `../../../../` v `apps/kingdom/**` |
| Manifest + Portal patří k sobě | každý adresář s `manifest.ts` musí mít `Portal.tsx` |
| Žádný commitnutý `.tgz` | zákaz `*.tgz` v celém stromě |
| Registry odpovídá manifestům | `npm run codegen` je součástí `npm run build` (a `verify`) |

---

## 5. Datová cesta

```
portál  →  manifest.reads[]  →  core/api (BFF)  →  @zion/api  →  služba (HTTPS)
                                        │
                                        └─ session cookie se předává, cache TTL per endpoint
```

- **BFF je read-mostly.** Cachuje, normalizuje, maskuje privátní pole (hostnames, interní IP, cizí credentials).
- **Žádné tajemství nejde do prohlížeče.** Admin klíče služeb zůstávají na serveru BFF; portál nikdy nedostane `ISSOBELLA_API_KEY` ani payout klíč.
- **Jeden klient pro všechny povrchy.** Desktop-agent i mobil (až přijdou) čtou stejné `@zion/api`, ne vlastní fetch vrstvy. Dnes má `zis-client` dvě rozcházející se kopie (27,9 KB vs 4,7 KB) — to je přesně ten dluh, který tímhle mizí.

---

## 6. Session

- Jediný auth provider = **ZIS** (`auth.zionterranova.com`), cookie `zion_session`.
- Session drží **hostitel okna**; portály ji jen čtou přes kontext. Žádný portál si nedrží vlastní login.
- Přihlášení: adresa `zion1` → výzva → podpis Ed25519 v prohlížeči → fráze se nikam neukládá.
- Úrovně: `auth: 'none'` (čtení) · `'session'` (osobní data, účet) · `'sign'` (zápis, hlasování, miner control).

---

## 7. Svět a AAA seam

Nirvana je první svět OASIS. OASIS má jednou jet jako AAA hra. Proto je svět od prvního commitu rozdělený na dvě poloviny:

```
packages/world/                    packages/scenes/
  src/domain/                        (web adaptér, dnes)
    models/    planety, prsteny,       three.js r18x + @react-three/fiber 9
               stanice, pozice         @react-three/drei, @react-three/xr
    systems/   pohyb kamery,         ← 13 světů z apps/shared/scenes
               rotace, čas
    ports/     Renderer, Clock,
               Input, Network
  BEZ Reactu, Three, DOM, fetch,
  Math.random, Date.now

                            ▲
                            │  stejná doména, jiný adaptér
                            │
                  packages/world-ue5/   (HORIZONT)
                    Puerts / C++ / Blueprints
```

**Co to znamená prakticky:**

- Scéna se dnes renderuje **v prohlížeči** (WebGL2 default, WebGPU opt-in). Pixel-stream z edge GPU je mimo rozsah.
- Engine swap za `packages/world` **nezmění Místnost** — shell, portály, session i i18n zůstanou.
- Vynuceno lintem od F0, ne odhodláním v dokumentu. Dnes to pravidlo existuje v `AGENTS.md` a nikdo ho nevymáhá — `OasisWeb` ho porušuje.

---

## 8. Služby — nemění se

| Služba | Port | Host | Co z ní Kingdom čte |
|---|---|---|---|
| `zion-v31-node` (primary) | RPC 9445 | EDGE2 | `getChainInfo`, supply, UTXO |
| `zion-v31-pool` | API 8080, stratum 8444/45/46 | EDGE | `/stats`, `/public/v1/*` |
| `zion-marketplace` | 3100 | EDGE2 | `/api/shop/products`, `/api/items` |
| `zion-zis` | 8096 | EDGE2 | `/api/auth/*`, JWKS, session |
| `zion-v31-oasis` | 8094 | EDGE2 | `/api/v1/oasis/*` |
| `zion-v31-free-world` | 8095 | EDGE2 | fond, granty |
| `zion-v31-issobella` | 8097 | EDGE2 | papers, proof |
| `zion-v31-ncl` | 8098 | EDGE2 | care jobs, workers |
| `zion-v31-ai-native` / `zion-hiran-gateway` | 8001 / 8007 | EDGE2 | `/v2/*`, chat |
| `zion-v31-multichain` (warpd) | 8453 / 8454 | EDGE2 | prices, swaps, bridge |
| `zion-v31-dao` | 8456 | EDGE2 | proposals, guardians |
| `zion-edge-python-dashboard` | 8766 | EDGE | **zůstává samostatný** — Kingdom na něj jen odkazuje |

**Market service zůstává appkou.** Má Prisma, Stripe, Coinbase, L1 watcher, faktury, admin objednávek. Kingdom z něj bere **výlohu**; pokladna, platba a doprava zůstávají tam, kam patří. Do okna Kingdomu nepatří tajemství pokladny.

**Dashboard zůstává samostatný.** Za basic auth na vlastním hostname — je to operátorský povrch, ne denní cesta člověka. Kingdom na něj má odkaz, ne kopii.

---

## 9. Co Kingdom NENÍ

- **Není backend.** Nemá DB, nemá schema, nemá Prisma, nemá cron.
- **Není pokladna.** Nemá Stripe/Coinbase klíče, payout klíč, treasury přístup.
- **Není náhrada market service, poolu ani Dashboardu.** Ty zůstávají.
- **Není nová generace chainu.** L1 konsensus, emise, genesis, crypto — mimo dosah.
- **Není iframe nad starými appkami.** Portály jsou nativní moduly s vlastním UI.
- **Neslibuje smazání starých appek.** Ty zhasínají po paritě a 30 dnech redirectu, jednu po druhé.

---

## 10. Donoři — odkud se co bere

| Dnešní app | LOC | Generace | Hostname | Co z ní jde do Kingdomu |
|---|---|---|---|---|
| `apps/website-v2.9` | 149 467 | Next 16.4.3 / R19 | `app.` | chain+explorer, market výloha, books, freeworld, issobella, hiran, wallet, dao, gate obsah — **a zůstává jako knihovna/docs** |
| `apps/OasisWeb` | 28 761 | Next 16.2.9 / R19 | `oasis.` | `packages/world` (doména) + `packages/scenes` (adaptér) |
| `apps/MarketPlace` | 22 400 | Next 14.2.5 / R18 | `market.` | jen výloha → `portals/market`; **service zůstává** |
| `apps/desktop-agent` | 23 295 (JS) | Electron | — | později native host Kingdomu (mimo první cyklus) |
| `apps/mobile-app` | 16 922 (JS) | RN 18 | — | později responzivní Kingdom (mimo první cyklus) |
| `apps/shared` | 11 916 | — | — | `@zion/ui`, `@zion/scenes`, `@zion/session` (zis-client) |
| `apps/pool-ui` | 9 815 | Next 14.2.30 / R18 | `pool.` | `portals/pool` |
| `apps/identity` | 5 801 | Node | `auth.` | **service zůstává**; `@zion/session` z něj čte |
| `apps/IntroPage` | 5 690 | Next 14.2.30 / R18 | apex | `core/gate` (+ vnořená `freeworld/` → `portals/freeworld`) |
| `apps/nirvana` | 5 120 | Next 16.2.9 / R19 | `nirvana.` | `core/shell` + `portals/worlds/nirvana` |
| `apps/zion-wallet-sdk` | 4 217 | — | — | `@zion/wallet` |
| `ZION_OS/dashboard` | — | Python | `dashboard.` | **zůstává samostatný** |

**Stav fragmentace při založení Kingdomu (měřeno 2026-11-01):** 12 appek + 2 sdílené balíčky, 13 lockfileů (včetně stale `yarn.lock`), 5 implementací i18n, 7 token systémů, 2 generace Next, 14 hostname, 9 deploy skriptů, 1 commitnutý `.tgz` (`zion-wallet-sdk-2.0.0.tgz`), 2 rozcházející se kopie `zis-client`, 4 duplicitní povrchy (`/pool`, `/market`, `/oasis`, `/explorer`), 6 z 10 CI workflows zakázaných.

---

## 11. Rozhodnutí operátora (zamčeno 2026-11-01)

| # | Rozhodnutí | Důsledek |
|---|---|---|
| 1 | **Strom se jmenuje `Kingdom/` v rootu**, staví se od nuly | staré appky jsou dárci, ne základ |
| 2 | **`website-v2.9` zůstává jako knihovna/docs** na `app.` | 149k LOC se do klienta nepřeváží; Kingdom ho jen zúží o duplicitní povrchy |
| 3 | **Dashboard zůstává samostatný** hostname za basic auth | žádný `portals/ops`, jen odkaz z Místnosti |
| 4 | **Nirvana = první svět OASIS**, OASIS jednou jako AAA hra | svět je oddělený `packages/world` seam od F0 |
| 5 | **Market, pool UI i Dashboard musí zůstat** — funkčně nic nezmizí | market service a dashboard service se nedotýkají; mizí jen duplicitní povrchy |

---

## 12. Otevřená rozhodnutí

| # | Otázka | Blokuje | Návrh |
|---|---|---|---|
| 1 | `apps/kingdom` port v dev (3020?) | F0 | 3020, aby nekolidoval s website 3000 a market 3100 |
| 2 | Kde Kingdom poběží v produkci — EDGE nebo EDGE2 | F6 | EDGE2 (web-tier), `nirvana.` se z EDGE přesune |
| 3 | Zachovat `nirvana.zionterranova.com` jako alias, nebo rovnou nový hostname | F6 | nejdřív alias, flip až po paritě |
| 4 | Monorepo nástroj (npm workspaces vs pnpm+turbo) | F0 | npm workspaces — žádná nová závislost |
| 5 | Mobil: responzivní Kingdom, nebo samostatný RN klient | po F5 | responzivní Kingdom |
