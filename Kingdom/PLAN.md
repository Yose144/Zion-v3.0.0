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
| **F1** | **Brána** | Harvest `apps/IntroPage` → `core/gate`. Příjezd, rozcestí, „vejdi dovnitř" | 2–3 d | obsah apexu 1:1 v Kingdomu; klik z Brány otevře Místnost; i18n cs/en z `@zion/i18n` | 🤖 |
| **F2** | **Místnost + první svět** | Harvest `apps/nirvana` (shell, session, scéna) + `apps/shared/scenes` (13 světů). `portals/worlds/nirvana` = orbit → planeta → prstence L6 → stanice → sestup | 1–2 t | denní cesta Brána → svět → okno funguje; session drží napříč 3 portály; `packages/world` bez React/Three importu | 🤖 |
| **F3** | **Čtecí portály** | chain+explorer, pool (kovárna), market (výloha), books, freeworld, issobella, hiran, účet, dao. Každý manifest + typed reads přes `@zion/api` | 2 t | 9 portálů v registry; každý má manifest; 0 přímých `fetch`; BFF maskuje privátní pole | 🤖 |
| **F4** | **Zápisy a handoff** | write intents: podpis challenge (účet), market checkout handoff na market service, pool miner control (read+ops), dao hlas (čtení + odkaz) | 2–3 t | write gate per portál; žádný money-path v Kingdomu; Stripe/Coinbase/L1 payout netknuté | 🤖→🔀 |
| **F5** | **Parita a zúžení** | doplnit, co v portálech chybí proti dnešním povrchům; `website-v2.9` se zúží o duplicitní povrchy (`/pool`, `/market`, `/l4-oasis`, `/explorer`) na odkazy | 1–2 t | paritní checklist per povrch = 100 %; žádná funkce nezmizela | 🤖 |
| **F6** | **Jeden vstup** | apex → Kingdom (Brána); `pool.` `oasis.` `nirvana.` `freeworld.` `explorer.` → 301 do portálů; `market.` zůstává; `app.` zůstává jako knihovna | 1 t | nginx mapa + rollback skript per povrch; 30 dní redirectu bez incidentu před smazáním | 🔀→👤 |
| **F7** | **AAA svět** | engine swap za `packages/world` (UE5/Puerts; mezitím Babylon/PlayCanvas jako zkouška seamu), XR režim | HORIZONT | doména světa beze změny, mění se jen adaptér | 👤 |

**Proč toto pořadí:** F0–F2 dá člověku denní cestu v jednom klientovi (to je celý smysl). F3–F5 do něj vstřebá zbytek bez ztráty funkcí. F6 je jediný krok, který je nevratný navenek — proto až po paritě. F7 nikdy neblokuje nic před sebou.

---

## 2. Definice „sjednoceno" — KPI

Měřeno před F0 a po F6. Čísla jsou z inventury 2026-11-01.

| Metrika | Dnes | Po F6 | Jak se měří |
|---|---|---|---|
| Veřejné hostname | 14 | **4** (apex, app, market, dashboard) | `dig` + nginx `server_name` |
| Lockfileů | 13 | **1** (+1 pro market service) | `find -name package-lock.json` |
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
