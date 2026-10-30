# ZION V3.3 „NIRVANA" — Unifikační plán (Velké sjednocení)

> **Datum:** 2026-10-30 · **Autor:** Devin · **HEAD:** `7fa9a7062` (po clean-table vlně)
> **Status v řadě pravdy:** execution — pod kódem/sondami a Registrem důkazů, vedle [`NIRVANA-V3.3-PLAN.md`](NIRVANA-V3.3-PLAN.md) (fáze N0–N7 a DoD V33-1…9 platí beze změny).
> **Co řeší:** roztříštěnost ekosystému (12 appek, 8+ hostname, 4 i18n, 2 generace Next) a strojovnu (`zion-compute`). Tahle vlna nedefinuje produkt — definuje **architekturu sjednocení** a pořadí kroků.

---

## 0. Proč teď a proč takto

Ekosystém je funkční, ale strukturálně rozpadavý:

- **12 appek** (`apps/*`), každá vlastní Next/Electron/RN stack, 2 generace Next (14 vs 16), 4 vlastní i18n implementace, 3 CSS token systémy, duplicitní UI (web `/pool` vs `apps/pool-ui`, web `/market` vs `apps/MarketPlace`)
- **8+ hostname** = 8 vstupních bodů, každý vlastní layout, navigace, auth UX (session cookie už je sjednocená — zbytek ne)
- `apps/nirvana` (v1, commit `7fa9a7062`) je **portal-reader** — čte API cizích appek do jednoho plátna. Dobrý důkaz konceptu, ale je to 13. appka, ne sjednocení.
- Strojovna (`zion-compute`) je specifikovaná ([`docs/3.3/ENGINE-SRDCE.md`](docs/3.3/ENGINE-SRDCE.md)) jako orchestrátor GPU času — řeší těžaře, ne klienty.

**Cíl:** jeden klient, který unese denní cestu člověka — a architektura, která umožní, aby se do něj staré appky **vstřebaly** (ne obešly iframy a ne přepsaly naráz).

---

## 1. Architektura: Modular Monolith Shell („Království")

Sjednocení = **jedna aplikace s moduly**, ne 12 appek ani 12 iframů.

```text
┌─────────────────────────────────────────────────────────────────┐
│  apps/nirvana — „Království" (modular monolith client)            │
│                                                                  │
│  ┌─ core/ ──────────────────────────────────────────────────┐   │
│  │  shell/      window manager + portal registry + canvas    │   │
│  │  session/    ZIS (zion_session) — JEDINÝ auth provider    │   │
│  │  portal-sdk/ kontrakt: manifest, typed data, events       │   │
│  │  ui/         design tokens + komponenty + i18n (cs/en)    │   │
│  │  api/        BFF proxy layer (read-only, guardované)      │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ portals/ ── nativní moduly (postupná migrace) ───────────┐   │
│  │  chain/      ← apps/website-v2.9 explorer + /api/blockchain│  │
│  │  pool/       ← apps/pool-ui + /public/v1                  │   │
│  │  market/     ← apps/MarketPlace výloha (pokladna zůstane) │   │
│  │  wallet/     ← ZIS wallet UI (nové — chybí jako samostatné)│  │
│  │  freeworld/  ← IntroPage freeworld/ + /api/free-world     │   │
│  │  issobella/  ← /l6-issobella čtení                        │   │
│  │  books/      ← canon/books index                          │   │
│  │  hiran/      ← /api/ai-chat + Maestro čtení               │   │
│  │  intro/      ← apps/IntroPage apex obsah                  │   │
│  │  world/      ← OasisWeb canvas (scéna, ne jen katalog)    │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │  Portal Contract v1 — typed, read-first, session-aware
         ▼
   Backends zůstávají: pool API :8080 · market API · oasis :8094 ·
   auth.ZIS · warpd · dao · free-world · node RPC — žádná změna
```

### Portal Contract v1 — univerzální díl

Každý modul (v3.3 i budoucí) deklaruje `manifest.ts`:

```ts
export interface PortalManifest {
  id: string;                    // 'chain', 'pool', 'market', ...
  title: { cs: string; en: string };
  icon: string;                  // registry ikon
  ring?: { x: number; z: number; hue: number };  // pozice v canvas světě
  windows: WindowSpec[];         // co umí otevřít
  auth: 'none' | 'session' | 'sign';  // úroveň ZIS
  reads: EndpointSpec[];         // typed GET endpoints (shell cachuje)
  writes?: WriteIntent[];        // deklarované mutace (default: žádné)
}
```

**Pravidla kontraktu:**
- Modul **vlastní své UI** (nativní React v shellech, ne iframe) — sdílí `core/ui` tokeny, i18n, session.
- `reads` = jediný povolený způsob, jak modul sahá na data. BFF vrstva (`core/api`) mapuje je na veřejná API — **žádný modul nevolá backend napřímo**.
- `writes` jsou opt-in a v3.3 zůstávají jen tam, kde bezpečnostní model existuje (auth challenge sign, market checkout přes existující Stripe cestu na market.).
- Nový modul = nový `portals/<id>/` adresář s manifestem — registry ho zvedne automaticky. **To je univerzalita:** přidání povrchu = přidání modulu, ne nové appky.

### Co se mění oproti nirvana v1

| nirvana v1 (teď) | Království (cíl) |
|---|---|
| 7 portal-proxy panelů čtoucích API | nativní moduly s vlastními UI, sdílenými komponenty |
| jeden page.tsx | modulární registry — každý povrch samostatný adresář |
| shell = čtenář | shell = window manager (více oken, deep-linky, stav) |
| duplikuje i18n/ui tokeny znovu | `core/ui` = jediný zdroj pro celý klient |
| canvas = vizuální dekorace | canvas = navigační povrch (ringy = portály) |

### Co to NENÍ

- Neslévá backends (pool API, market API, ZIS zůstávají samostatné služby — `apps/*` se stává tenkým UI přes jejich API)
- Neslévá repa ani workspace `V31/` (produkční kontrakt — viz REPO-MAP §2)
- Nemění DNS, konsensus, emise, payout cesty
- Ne nahrazuje `zion-compute` — to je strojovna u těžaře, Království je místnost u člověka

---

## 2. Migrace: ze 12 appek do modulů (bez big-bangu)

Postup per povrch — **absorpce kódu, ne proxy**:

| Vlna | Modul | Zdroj | Co se přesune | Legacy zůstane |
|---|---|---|---|---|
| **K1** | chain, pool, market-ro, books | website-v2.9, pool-ui, MarketPlace | read UI + typed reads | vše — shell je jen nový čtenář |
| **K2** | wallet (auth→account), freeworld, issobella, hiran, intro | identity, IntroPage, /ai | session UX + portal UIs | checkout/admin zůstane na market., ops na pool. |
| **K3** | market (checkout přes session), pool (miner control), world (OasisWeb scéna) | MarketPlace, pool-ui, OasisWeb | write intents kde model existuje | staré appky = fallback |
| **K4** | zbytek | — | — | DNS/povrchy zhasínají jednotlivě |

**Pravidlo migrace:** modul absorbuje *UI kód* původní appky (adoptuje komponenty do `core/ui` konvencí), ne její backend ani deploy. Stará appka žije, dokud modul nepokryje její povrch — pak se její doména přesměruje.

**Exit kritéria pro „starou appku zhasnout":** všechny její veřejné stránky mají náhradu v modulu, session funguje, přesměrování 30 dní bez incidentu.

---

## 3. Strojovna: `zion-compute` (Hash / Care / Scene)

Z `docs/3.3/ENGINE-SRDCE.md` — specifikace platí, rozšiřuji ji o implementační tvar:

```text
stroj těžaře (ne server, ne node):
┌─ zion-compute (jeden proces) ──────────────────────────────┐
│  orchestrator/  GPU kalendář: SlotLease, TTL, preempce      │
│    SlotPolicy: Hash > Care > Scene  (Hash má vždy přednost) │
│  lanes/                                                    │
│    hash/    spawn/stop `zion-miner` — stratum/kernely bez    │
│             změny; orchestrátor jen pouští a zastavuje      │
│    care/    NCL job runner — `NclJob` typy, odměna jen       │
│             regtest (mainnet reward = nikdy v 3.3)           │
│    scene/   placeholder — pixel-stream = HORIZONT, mimo DoD  │
│  contracts/ JobDescriptor · SlotLease · LaneReport           │
│  api/       unix socket JSON-RPC — desktop-agent + nirvana   │
│             čtou stav slotů (lane=hash|care, gpu_util, job)  │
└─────────────────────────────────────────────────────────────┘
```

**Vazba na Království:** shell má portal `compute/` (čtení slotů přes desktop-agent bridge) — člověk vidí, co jeho stroj dělá (těží/pečuje). Scene lane je ten samý OASIS world canvas, ale render zůstává v prohlížeči.

**Hranice (z spec, držet):** žádná změna `V31/L1/core`; Care nesahá na payout/UTXO; selhání Care neshodí stratum; orchestrátor nečte `pool.lock()` ani pool DB; mainnet reward nikdy.

**Implementační vlny zion-compute:**
1. crate `zion-compute` ve workspace vedle `V31/L3/ncl` — typy + fronta, backendy stub
2. opt-in `ZION_NCL_*` smyčka v mineru — pull-job jen při volném GPU slotu
3. desktop-agent propojení (`gpuDevices` → SlotLease, stav do shell přes bridge)
4. sdílená kernel knihovna — až Hash i Care chtějí stejný CUDA modul

---

## 4. Vlny K0–K4 (execution)

| Vlna | Obsah | Brána |
|---|---|---|
| **K0 — čistý stůl** ✅ (dnes) | root cleanup (`7fa9a7062`), docs→docs/plans, G8 run #6 start (`g8-20261029T234617Z`, konec ~28. 11.), nirvana v1 committed | done |
| **K1 — Shell GA** | `apps/nirvana` → modular monolith: `core/` (shell/session/sdk/ui/api) + `portals/` registry; přesunout v1 portály do manifest tvaru; core/ui tokeny + cs/en i18n jako jediný zdroj; deep-link `/portal/<id>` | build green, 7 portálů v manifestu |
| **K2 — Depth** | wallet/account modul (session UX sjednocení); market výloha → košík→checkout handoff na market.; hiran modul; intro absorbce apexu | session e2e přes 3 moduly |
| **K3 — Writes + World** | write intents kde model existuje; OASIS world canvas jako plná scéna (OasisWeb kód → portal world); pool miner-control (read+ops view) | write gate per modul |
| **K4 — Sjednocení povrchů** | staré appky zhasínají povrch po povrchu (redirecty); DNS rozhodnutí 👤 (apex na Království?); desktop-agent jako native host shellu | exit kritéria per appka |

Paralelní stopy (nezávislé, platí dál): **N0** (G8 run #6 do ~28. 11., operátorská fronta), **zion-compute** vlny 1–4, **N3/N5/N6** dle checklistu.

---

## 5. Tvrdá pravidla (nedotýkat se)

1. **Konsensus/emise/genesis/crypto v `V31/L1/core` — bez změny.** Království ani zion-compute na L1 nesahají.
2. **Žádný modul nepíše do backendu** mimo `writes` manifest. BFF = read-mostly.
3. **Session = jediný auth.** Žádný modul si nedrží vlastní login. `zion_session` drží hostitel okna.
4. **G8 okno = deploy freeze na required služby** (`chain_live`, `pool_http`, `pool_stratum`, `multichain`, `dao`, `zis`) bez rollbacku do 15 min — 29. 10. run #5 zabil deploy den (94 incidentů / 736 min).
5. **Staré appky nezhasínáme naráz.** Povrch se zavře až když modul umí totéž + 30d redirect bez incidentu.
6. **Verze:** Království začíná `0.1.0` — není `3.3.0` dokud DoD V33 nesplní. Označení „v3.3 Nirvana" = podtitul, ne release.

---

## 6. Rozhodnutí operátora (👤) navazující na unifikaci

1. G8 run #6 — ✅ started (dnes); deploy freeze pravidlo držet
2. DNS budoucnost: apex → Království jako vstup? (až K4, bez závazku)
3. `apps/nirvana` vs. nový `apps/kingdom` — jméno modulárně: „nirvana" = release/era, „kingdom/kralovstvi" = produkt? (návrh: nechat `apps/nirvana`, veřejné jméno „Království")
4. Desktop: desktop-agent se stává hostitelem shellu (Electron wrap Království + zion-compute bridge) — rozhodnout v K3
5. Mobile: RN app 3.0.6 preview → buď shell-responsive web, nebo později

---

## 7. Srovnání se zbytkem pravdy

| Dokument | Vztah k tomuto plánu |
|---|---|
| `NIRVANA-V3.3-PLAN.md` (N0–N7, DoD) | platí — K-vlny jsou *jak* se N4/klientské povrchy sjednotí; nemění DoD |
| `NIRVANA-V3.3-MAP.md` | registry právdy — K-vlny doplnit do §1.1 sub-plánů |
| `NIRVANA-V3.3-CHECKLIST.md` | K-položky doplnit jako nová stopa vedle N/N3 |
| `NIRVANA-SHELL.md` | popis v1 — §4 „jak to má sedět" = K1–K4 realizace |
| `docs/3.3/ENGINE-SRDCE.md` | strojovna — §3 tohoto plánu ji doplňuje o implementaci |
| `canon/books/KralovstviSrdce/` | MÝTUS — veřejný podtitul lodi, ne specifikace |

---

*Království srdce není nová appka — je to místnost, do které se všechny staré místnosti postupně stěhují. A strojovna, která jí pod podlahou dává sílu.*
