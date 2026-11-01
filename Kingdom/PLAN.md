# Kingdom — plán výstavby

> **Verze dokumentu:** 1.0 · **Datum:** 2026-11-01 · **Stav:** F0 nezačata
> **Vztah k provozu:** tento plán je **stavební**. Provozní plán (`NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md`, vlny W0–W6, G8, RC) platí dál a má přednost vždy, když jde o peníze, klíče, konsensus nebo deploy okno.
> **Dvě věty, které platí po celou dobu:** (1) staré appky zhasínají až po paritě a 30 dnech redirectu; (2) `V31/L1/core` se nedotýkáme.

---

## 0. Jak číst

- **Fáze F0–F7** jdou v pořadí. Nepřeskakuje se.
- Každá fáze má **bránu** = důkaz, bez kterého se nezavírá.
- **Trvání** je odhad pro jednoho autonomního agenta, ne slib.
- **Vlastník:** 🤖 autonomní · 🔀 autonomní příprava + schválení · 👤 operátor (DNS, peníze, klíče).

---

## 1. Posloupnost

| # | Fáze | Co se udělá | Trvání | Brána (důkaz) | Kdo |
|---|---|---|---|---|---|
| **F0** | **Založení** | `Kingdom/` root: npm workspaces, 1 lockfile, `tsconfig.base.json`, `scripts/check-boundaries.mjs`, prázdné balíčky s API, `apps/kingdom` kostra (Místnost + placeholder Brány), `@zion/contract` + codegen | 1–2 d | ✅ **2026-11-01 hotovo:** build 489 ms, `check` 32 souborů / 0 porušení, **1 lockfile**, 0 importů přes `../../../`, 3 portály s živými daty | 🤖 |
| **F1** | **Brána** | Harvest `apps/IntroPage` → `core/gate`. Příjezd, rozcestí, „vejdi dovnitř" | 2–3 d | ✅ **2026-11-01 hotovo:** hero + živý pás (výška/difficulty/hashrate/block time/mince z hlavního uzlu) + „Co je ZION" + „Tři cesty" + vrstvy L1–L6; obsah jako typovaná data (`content.ts`), cs/en, kotvy `#why` `#paths` `#layers` | 🤖 |
| **F2** | **Místnost + první svět** | Orbit svět v `packages/world` + `packages/scenes`, lazy `SceneHost`, markery z `manifest.ring`; 13 světů ze `apps/shared/scenes`, cesta `/world/<id>` | 1–2 t | ✅ **2026-11-01 hotovo:** planeta s texturou, prstenec L6 se 6 stanicemi, Brána, 2400 hvězd, 3 markery portálů — ověřeno CDP (`canvas 1158×338`, WebGL živý). **F2b hotovo:** 13 světů (10 900 LOC vč. kit) v `packages/scenes/src/worlds/`, vlastní `OrbitRig` místo drei, katalog v `@zion/world`, `/world/<id>` lazy (294 KB gzip) — ověřeno CDP na Genesis Garden i Kailash | 🤖 |
| **F3** | **Čtecí portály** | chain+explorer, pool (kovárna), market (výloha), books, freeworld, issobella, hiran, účet, dao. Každý manifest + typed reads přes `@zion/api` | 2 t | ✅ **2026-11-01 hotovo — 9 portálů:** řetěz, kovárna, tržiště, přístav, snem (DAO), knihovna (14 knih z `canon/books`), věž (Hiran probe), issobella, účet. Každý má manifest; 0 přímých `fetch`; tři nesou `status: placeholder` s viditelným důvodem (F4 / nenasazené 6.B4) | 🤖 |
| **F4** | **Zápisy a handoff** | write intents: podpis challenge (účet), market checkout handoff na market service, pool miner control (read+ops), dao hlas (čtení + odkaz) | 2–3 t | 🚧 **2026-11-01 hotovo F4a–F4d:** Věž (Hiran chat přes serverový proxy), Tržiště (deep-link na kategorii e-shopu), **Kovárna** (13 těžařů, hashrate, accept rate + handoff na `/ops/` za basic auth) a **Snem** (7 strážců + handoff na hlasování, které podepisuje peněženka). Účet deklaruje jediný skutečný zápis: `sign-in` (`auth: 'sign'`). Zbývá: gate 1b u marketu (peníze) — Kingdom se jí nedotýká | 🤖→🔀 |
| **F5** | **Parita a zúžení** | doplnit, co v portálech chybí proti dnešním povrchům; `website-v2.9` se zúží o duplicitní povrchy (`/pool`, `/market`, `/l4-oasis`, `/explorer`) na odkazy | 1–2 t | 🚧 **2026-11-01: checklist hotový** ([`docs/3.2/KINGDOM-PARITY-F5.md`](../docs/3.2/KINGDOM-PARITY-F5.md)) — 5 portálů na 100 % (má / platný handoff), Řetěz a Kovárna ~80 %, Tržiště ~60 %, Issobella blokovaná 6.B4. **Doplněno:** Řetěz má poslední bloky + transakce s proklikem do eXploreru. **P1 zbývá:** hledání adresy v Řetězu, historie poolu v Kovárně; zúžení website až po 30 dnech redirectu (§3) | 🤖 |
| **F6** | **Jeden vstup** | apex → Kingdom (Brána); `pool.` `oasis.` `nirvana.` `freeworld.` `explorer.` → 301 do portálů; `market.` zůstává; `app.` zůstává jako knihovna | 1 t | nginx mapa + rollback skript per povrch; 30 dní redirectu bez incidentu před smazáním | 🔀→👤 |
| **F7** | **AAA svět** | engine swap za `packages/world` (UE5/Puerts; mezitím Babylon/PlayCanvas jako zkouška seamu), XR režim | HORIZONT | doména světa beze změny, mění se jen adaptér | 👤 |

**Proč toto pořadí:** F0–F2 dá člověku denní cestu v jednom klientovi (to je celý smysl). F3–F5 do něj vstřebá zbytek bez ztráty funkcí. F6 je jediný krok, který je nevratný navenek — proto až po paritě. F7 nikdy neblokuje nic před sebou.

---

## 2. Definice „sjednoceno" — KPI

Měřeno před F0 a po F6. Čísla jsou z inventury 2026-11-01.

| Metrika | Dnes | Po F6 | Jak se měří |
|---|---|---|---|
| Veřejné hostname | 14 | **4** (apex, app, market, dashboard) | `dig` + nginx `server_name` |
| Lockfileů (6 webů + `shared` + SDK) | 8 | **1** | `find apps/*/package-lock.json` — ostatní stromy (mobil, Electron, identita, služby, vendored contracts, `Kingdom/`) zůstávají samostatné, rozhodnutí 👤 2026-11-01 |
| i18n implementací | 5 | **1** | `grep -rl translations.ts` |
| Token systémů | 7 | **1** | `grep -rl "globals.css"` s barvami |
| Generací Next | 2 | **1** | `grep '"next"' */package.json` |
| Duplicitních povrchů | 4 | **0** | paritní checklist |
| Deploy skriptů | 9 | **3** | `find -name "deploy-*.sh"` |
| Importů přes `../../../` mezi appkami | ~30 | **0** | `grep -rn "\.\./\.\./\.\./"` |
| Commitnutých `.tgz` | 1 | **0** | `find -name "*.tgz"` |
| Rozcházejících se kopií `zis-client` | 2 | **0** | `grep -rl zis-client` |
| Aktivních CI workflows | 3/10 | **plné** | `.github/workflows/*.yml` |
| Čas do „vidím řetěz a přihlásím se" | 3 weby | **1 okno** | E2E test |

---

## 3. Exit kritérium pro zhasnutí staré appky

Appka se vypne, jen když **všechny** platí:

1. Všechny její **veřejné** stránky mají náhradu v portálu — paritní checklist 100 %, ne „skoro".
2. Session funguje (přihlášení, odhlášení, expirace) v náhradě.
3. `301` redirect běží **30 dní** bez incidentu a bez nárůstu chyb v logu.
4. Existuje **rollback skript** pro ten jeden povrch (ne pro celý systém).
5. Provozní plán (`KRALOVSTVI-SRDCE-PLAN`) nemá otevřenou položku, která by na appce závisela.

Do té doby appka běží. Nic se nemaže dopředu — ani když je to „kouzelný skeleton".

---

## 4. Co zůstává, i když se všechno ostatní vstřebá

| Co | Proč |
|---|---|
| `market.` jako **služba** (Prisma, Stripe, Coinbase, L1 watcher, faktury, admin) | peníze a objednávky mají vlastní bezpečnostní model; Kingdom se jich nedotýká |
| `dashboard.` za basic auth | operátorský povrch, ne denní cesta člověka |
| `auth.` (ZIS), `rpc.` | služby, ne povrchy |
| `website-v2.9` na `app.` jako **knihovna/docs** | 149k LOC dokumentace, whitepaperů a referencí do klienta nepatří |
| `zion-miner`, `pool` stratum, node RPC | binárky a protokoly, ne UI |

---

## 5. Rizika

| # | Riziko | Dopad | Mitigace |
|---|---|---|---|
| R1 | Kingdom vznikne jako **14. appka** vedle ostatních | celý záměr selže | F6 zhasíná staré povrchy; KPI tabulka je součást brány |
| R2 | Portály si přinesou vlastní i18n/tokeny | drift zpět | lint gate od F0, codegen v CI |
| R3 | `packages/world` nasákne React/Three | AAA seam zmizí | lint `no-restricted-imports` v `domain/**` od prvního commitu |
| R4 | RC/G8 okno (do 28. 11.) a deploy freeze | Kingdom se zasekne | F0–F3 se nedotýkají produkčních povrchů; deploy až F6 |
| R5 | Market parita nestačí (checkout, faktury, doprava) | uživatel ztratí schopnost koupit | market zůstává appkou; Kingdom jen výloha + handoff |
| R6 | 149k LOC website se „převáží" do klienta | projekt utone | explicitní hranice: website = knihovna, jen duplicitní povrchy se zúží |
| R7 | Scéna v prohlížeči nenese denní práci (výkon) | Místnost je nepoužitelná | okna jsou DOM, scéna je plátno; F2 brána to měří |
| R8 | Vznikne 4. plánovací dokument | fragmentace plánů | jen `README`, `ARCHITECTURE`, `PLAN`; změny se dělají v nich |

---

## 6. Co tento plán nedělá

- Nemění L1 konsensus, emise, genesis, crypto.
- Nepřepíná money-path (Stripe, Coinbase, L1 payout, treasury).
- Nemaže staré appky před paritou a 30 dny redirectu.
- Nepřesouvá market service ani Dashboard do Kingdomu.
- Nepřejmenovává Mainnet Beta na Stable.
- Nepředbíhá RC sign-off v tom, co se nasazuje na produkční povrchy (deploy až F6).
- Nezakládá nový plánovací dokument.

---

## 7. Změnový log

| Datum | Změna |
|---|---|
| 2026-11-01 | v1.0 — založeno. Rozhodnutí 👤: strom `Kingdom/` od nuly; `website-v2.9` zůstává knihovnou; Dashboard zůstává samostatný; Nirvana = první svět OASIS s AAA seamem; market/pool/dashboard funkčně zůstávají. |
| 2026-11-01 | v1.1 — **F0 hotová.** Workspace root (1 lockfile, 38 balíčků, install 28 s), 8 balíčků `@zion/*`, registry codegen z manifestů, `check-boundaries.mjs` (6 pravidel, 0 porušení), Brána + Místnost + deep-link, 3 živé portály (Řetěz / Kovárna / Tržiště) na produkčním buildu Next 16.4.3 (Turbopack, kompilace 489 ms). Klientský JS = jediný přepínač jazyka. Rozhodnutí 🤖: dev port **3020**, produkce **EDGE2**, npm workspaces bez dalšího toolingu, **žádný Tailwind ani three v F0** (menší install, rychlejší paint; scéna se přidá lazy ve F2). |
| 2026-11-01 | v1.13 — **F5 P2 hotové.** Kovárna umí **najít těžaře** (`?miner=` — stejný GET vzorec jako adresa v Řetězu, server čte `searchParams`, čtení přes `@zion/api`) a ukazuje **výplaty** (`/public/v1/payouts`, flowers/1e6, stav/blok/potvrzení). Karta těžaře: nevyplaceno, odhad/den, podíl v okně, accept rate, workeři. Parita: Řetěz i Kovárna ~95 % (chybí už jen luck a nalezené bloky). **Prevence kolize buildů:** stage adresář je unikátní per PID a deploy čte jeho cestu z stdoutu — dvě session si nemůžou mazat `.next/standalone-flat` (past, kterou dnes potkala nirvana). |
| 2026-11-01 | v1.12 — **F5 P1 hotové.** Řetěz umí **hledat adresu**: formulář `method="get"` → `?addr=`, stránka předává `searchParams` portálu (nově `PortalView` nese `search`), server čte přes `@zion/api` — žádný klientský stav ani fetch. Endpoint adresy je pomalý (~10 s), takže kontrakt dostal `EndpointSpec.timeoutMs` (default 6000 zůstává). Kovárna má **historii poolu**: `/public/v1/history?limit=60` (12 KB / 3 s místo 1 MB / 12 s) a sloupcový pruh bez knihovny. Live ověřeno: adresa → „Canonical Pool Payout Wallet", 183 800 299 ZION, 96 140 UTXO; 60 sloupců historie, 0 chyb. |
| 2026-11-01 | v1.11 — **F5 zahájena + hotfix deploye Kingdomu.** Root lockfile posunul i Kingdom standalone (`.next/standalone/Kingdom/apps/kingdom/`) → unit spadl na CHDIR. `stage.mjs` teď server.js hledá a staví **plochý** artefakt; `node_modules` se musí **slít po úrovních** (Next ho trasuje rozdělený — plný `next` byl v `standalone/Kingdom/node_modules`, root měl jen `dist`), jinak „Cannot find module next". Stejná logika v marketím flattenu. **F5:** paritní checklist sepsán (`docs/3.2/KINGDOM-PARITY-F5.md`), Řetěz doplněn o poslední bloky a transakce s proklikem do eXploreru (`?id=`, ne `?height=`). Nový verifikátor `scripts/ops/check-next-deploys.sh` (5 povrchů, nic nenasadí) — hned chytil dvě reálné chyby. |
| 2026-11-01 | v1.10 — **K1.2 + K1.4-lite mergnuto.** Root workspace: 6 webů + `shared` + `zion-wallet-sdk` = **1 lockfile** (2 031 balíčků), 6/6 buildů zelených, `pool-ui` nasazen z merged tree. **Nález, který by prošel potichu:** čerstvý install posunul 48 balíčků v `^` rozsazích — `stripe` 22.4→22.6 (money path, spadl build), `@noble/ed25519` 2.3→3.2 (major, podpisy) → 42 posunů zamraženo na původní verze. `three` sjednocen na **0.186.1** (dvě verze nejdou: `apps/shared/**` leží mimo oba app stromy). Poslední commitnutý `.tgz` pryč — web bere SDK z workspace. Turbopack na `website-v2.9` se zasekl na 30 min → `--webpack` zůstává, ale už ne kvůli tarballu. Pasti zapsané v runbooku: nemazat `apps/*/node_modules`, root `tailwindcss@3`, po změně configu smazat `.next`. |
| 2026-11-01 | v1.9 — **F4a–F4d: zápisy a handoff.** Kovárna čte `/public/v1/miners` (13 těžařů, hashrate z `display_hps`, accept rate ze streamů) a místo falešného tlačítka „restartuj pool“ vede na `/ops/` s vysvětlením, že je to operátorský povrch. Snem má handoff na hlasování s větou, že hlas podepisuje peněženka a Kingdom nedrží klíč. Účet deklaruje `writes: [sign-in]` (`auth: 'sign'`) — jediný zápis, který opravdu umí. Mrtvý klíč `signInNote` („přijde ve F4“) odstraněn. Ověřeno live: `/portal/pool` 12 mincí + 13 těžařů, `/portal/dao` 7 strážců, 0 chyb v konzoli. |
| 2026-11-01 | v1.8 — **K1.1 hotová pro 5 ze 6 webů.**`pool-ui`, `IntroPage`, `OasisWeb`, `nirvana` a `website-v2.9` na Next 16.4.3 + React 19.2.0; zbývá jen `MarketPlace` (gate 1b). **OasisWeb nebyl „zadarmo":** Next 16.4 zapíná `reactBrowserBailout` a bailout objekt pro `next/dynamic ssr:false` umí jen interní React canary → s npm Reactem spadne hydratace na React #438 a 8 z 11 rout zůstane prázdných. Fix = `experimental: { reactBrowserBailout: false }`. **Lekce, která platí pro všechny další migrace:** `curl` 200 neznamená funkční stránku — u statického exportu se HTML v prohlížeči zahodí; měř `pageerror` + `canvas`. |
| 2026-11-01 | v1.7 — **NASZENO na EDGE2** (pokyn 👤 nasad). `zion-kingdom.service` na `127.0.0.1:3020`, User=zion, Node 22, env origins na loopback (`:3000` web, `:3100` market, `:8080` pool, `:8094` oasis, `:8096` zis) — žádné TLS samo k sobě. Vhost `kingdom.zionterranova.com` staged na portu 80. Deploy = nový `build-<UTC>` + atomický symlink `current` (`infra/deploy/deploy-kingdom.sh`). Ověřeno live: všech 7 rout 200, Brána čte 104 200 / 18 206 / 303 H/s / 57,0 s / 12-12, fond 28 109 510 ZION, odezva 13-74 ms, paměť 62 MB. **Zbývá 👤:** DNS A + certbot. |
| 2026-11-01 | v1.6 — **F3 hotová (9 portálů).** Přibyly `dao` (7 strážců, 1,5 mld ZION v oběhu, 0 návrhů — reálná data), `books` (katalog 14 knih generovaný z `canon/books` codegenem, ne ručně), `hiran` (probe `/api/ai-chat` — available/backend/model, rozhovor = F4), `issobella` (health; papers blokuje nenasazené 6.B4 → proxy 404) a `account` (placeholder, `auth: session`). Placeholder portály nesou `status: 'placeholder'` a **vysvětlí důvod v UI** — žádné tlačítko, které nefunguje. `account` záměrně nemá `ring`: loď cestuje s tebou, není to místo. Scéna má 8 markerů. |
| 2026-11-01 | v1.5 — **F3 zahájena: portál `freeworld` (Přístav).** 3 deklarovaná čtení (`fund/balance`, `grants`, `projects`), cache 60/120 s; UI počítá ZIONy z flowers (1 ZION = 1e6) — služba ukládá flowers, dashboard dělí, tak se to nedělá dvakrát jinak. Live: **28 096 820 ZION** nashromážděno (blok 104 145), 0 vyplaceno, 6 grantů po 10M, 12 projektů. Portál má `ring` → objevil se i ve scéně Místnosti jako 4. marker. |
| 2026-11-01 | v1.4 — **F2b hotová (13 světů).** `apps/shared/scenes` (10 900 LOC vč. `kit`) převzato do `packages/scenes/src/worlds/`; `@genesis/runtime` (alias, který si každá appka definovala v tsconfigu) nahrazen skutečným modulem `runtime.ts` — jediná instance React/R3F/three. Vlastní **`OrbitRig`** místo `drei` `OrbitControls` (stejné rozhraní: `target`, `enabled`, `autoRotate`, `min/maxDistance`, `maxPolarAngle`; tažení + kolečko) → –100 KB. **Katalog světů je v `@zion/world`** (jen texty), komponentová vazba v `@zion/scenes` — serverové stránky three nenačtou. Nová cesta **`/world/<id>`** (místo, ne portál) + sekce „Světy OASIS“ v Místnosti. Ověřeno CDP: Genesis Garden i Kailash renderují. Lazy chunk 294 KB gzip. |
| 2026-11-01 | v1.3 — **F2a hotová (první svět OASIS).** `packages/world` = doména (`types`, `geometry`, `rng` s mulberry32, `orbit` — Nová Země / Issobella / Brána / `placeMarker` / `orbitCamera`). `packages/scenes` = web adaptér (three 0.186 + R3F 9.4, **bez drei a bez xr**): `OrbitScene`, `NewEarth`, `IssobellaRing`, `Gate`, `Markers`, `Starfield`. Scéna je **generovaná Portal Contractem** — markery z `manifest.ring`, klik → `/portal/<id>`. Lazy `next/dynamic` + `ssr:false` → three.js (237 KB gzip) se stahuje jen na `/room`; Brána zůstává bez WebGL. Nalezeno a opraveno: R3F kamera bez `lookAt`, `manifest.ring` v nirvana měřítku (x=12 → mimo záběr), `useLoader` bez `onLoad`, staged `public` smazaná buildem za běhu (textura 500 → prázdný `Suspense`). Report: `docs/3.2/REPORTS/REPORT_2026-11-01_KINGDOM_F0-F2_OASIS.md`. |
| 2026-11-01 | v1.2 — **F1 hotová (Brána).** Obsah `apps/IntroPage` (`maintenance.html` + `intro-tabs.js` i18n) přepsán do typovaných dat `core/gate/content.ts` (hero, intro, tři cesty, vrstvy L1–L6) + `Rich` pro `**bold**`/`*kurzíva*`. Hero + **živý pás** (výška / difficulty / hashrate / block time / připojené mince) čtený přes `api.tryRead` s cache 20/30 s. Kotvy `#why` `#paths` `#layers`. Mrtvé klíče (`gateLead`) a mrtvé CSS (`.k-gate-text`) odstraněny. `check` 35 souborů / 0 porušení, build 351 ms. Starý IntroPage zůstává donor; DNS flip až F6. |

---

## 8. K1 — sloučení do jednoho workspace (předpoklad pro S3)

> **Proč:** dnes má každá appka vlastní `node_modules` a lockfile. Sdílený balíček
> (`@zion/session`) přes `file:` závislost **nefunguje** — npm udělá symlink mimo
> Turbopack `root`, build spadne na `Can't resolve`. Ověřeno 2026-11-01 na nirvaně
> (revertováno, produkce nedotčena).

### Co K1 skutečně znamená

Jeden `package.json` v rootu, jeden lockfile, jeden dependency graph. Ne „přesunout
soubory" — **jedna verze Reactu, Nextu a sdílených balíčků pro všech 6 webů.**

### Proč to nejde teď

| Blokace | Detail |
|---|---|
| **Dvě generace Next** | 14.2.x (IntroPage, MarketPlace, pool-ui) vs 16.x (nirvana, OasisWeb, website-v2.9) |
| **React 18 vs 19** | npm workspace je nucen hoistovat jednu verzi; druhá se rozbije |
| **Next 14 má critical CVE** | MarketPlace — gate 1b, stejně se musí upgradovat |
| **Turbopack root** | každá appka má `root: apps/`; sdílené balíčky leží výš |
| **Standalone layout** | změna rootu mění `.next/standalone/<app>/` → `apps/<app>/` a rozbíjí deploy skripty |

### Vlny

| # | Vlna | Obsah | Brána |
|---|---|---|---|
| **K1.1** | **Next 16 + React 19 ve všech 6 webech** | ✅ **pool-ui** (2026-11-01) → ✅ **IntroPage** (2026-11-01) → ✅ **OasisWeb** (2026-11-01, + `reactBrowserBailout: false` — React #438) → ✅ **nirvana** (16.4.3, manifest) → MarketPlace (security 1b) | pool-ui/IntroPage/OasisWeb: build + deploy + **runtime test v prohlížeči** OK, rollbacky drženy; MarketPlace: `curl` 200 nestačí, chce money-path test |
| **K1.2** | **Root workspace** | `/package.json` s `workspaces` = **6 webů + `shared` + `zion-wallet-sdk`** (mobil/Electron/identita zůstávají se svými lockfily — rozhodnutí 👤), jeden lockfile; `Kingdom/packages/*` → `/packages/*` zůstává jako K1.2b | ✅ **2026-11-01 MERGNUTO do `main`:** 1 lockfile (2 031 balíčků), `npm ci` OK, **6/6 buildů zelených**; `apps/package.json` stub zrušen. **Nález:** čerstvý install posunul 48 balíčků (stripe 22.4→22.6 shodil build marketu, noblé ed25519 2.3→3.2 major) → 42 posunů zamraženo na původní verze, `three` záměrně sjednocen na 0.186.1. Report: `docs/3.2/REPORTS/REPORT_2026-11-01_KINGDOM_K1.2_ROOT_WORKSPACE.md`. **Mergnuto** (`3e95af767`…), `npm ci` 51 s, 6/6 buildů zelených v hlavním stromě, pool-ui nasazen z merged tree (site 200/api 200). Pasti: nemazat `apps/*/node_modules` (nested balíčky) a root `tailwindcss@3` (3 appky v3 vs 3 v4). Runbook: `docs/3.2/ops/K1.2-MERGE-RUNBOOK.md` |
| **K1.3** | **Jeden Turbopack root** | `root: repo`, sjednotit standalone layout + **upravit všech 9 deploy skriptů** na nové cesty | každý deploy projde, rollback ověřen |
| **K1.4** | **S3 se odblokuje sám** | `@zion/session` jako workspace závislost, žádný tarball ani registry | nirvana 73 → ~25 řádků, market −344 |

### Co NEDĚLAT

- Nezačínat K1.2 před K1.1 — hoisting Reactu 18 a 19 rozbije buildy.
- Nedělat tarball jako zkratku — vrací do repa artefakt, který jsme právě zrušili.
- Neměnit Turbopack root jedné appky „jen tak" — mění layout standalone a tím deploy.

