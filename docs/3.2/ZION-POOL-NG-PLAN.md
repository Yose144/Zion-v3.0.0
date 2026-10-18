# ZION POOL NG — plán profesionálního multi-coin poolu

Status: **F1–F3 implementováno a otestováno** (viz §11) · Datum: 2026-10-18 · Autor: Devin

Vize (operátor): celý ekosystém působí roztříštěně → postavit jeden
profesionální pool nativně pro **QTC, PRL, ZION + multialgo**. Většina
coinů už je integrovaná, chybí sjednocení a produktový povrch.

## Rozhodnutí operátora (2026-10-18)

| Otázka | Rozhodnutí |
|---|---|
| Audience | **Veřejný pool od dne 1** — multi-tenant, per-user accounting, hardening |
| Payouty | **Nativní coin** — ZION on-chain auto; QTU batch z quantus wallet; PRL batch z oyster |
| Multialgo | **Upstream bridging jako teď** — bez vlastních nodů pro VRSC/ZANO/EQ192/… |
| Codebase | **Refactor `zion-pool`** (Devin doporučení) — žádný nový binary; 229 testů a prokázané wire pathy zůstávají |

---

## 1. Inventura — co už existuje v `V31/L1/pool/`

Pool není greenfield. Už dnes je to multi-coin engine, jen bez
abstrakce a produktového zabalení:

| Leg | Soubor | Stav |
|---|---|---|
| ZION native (template+submit, coinbase=pool) | `stratum.rs`, `pool.rs`, `validator.rs` | ✅ produkce, on-chain PPLNS payouty |
| QTC native (vlastní quantus-node, QUIC `quantus-miner/2`) | `qtc_native.rs` | ✅ `qtun:` joby, auto-fallback na upstream po 90 s |
| QTC upstream (k1pool/lproute bridge) | `auxpow_runtime.rs` | ✅ produkce |
| PRL native (vlastní pearld přes gateway `getMiningInfo`/`submitPlainProof`) | `pearl_gateway.rs` | ✅ wire path prokázán regtest blockem |
| PRL upstream (LuckyPool) | `pearl_upstream.rs` | ✅ `prlu:` joby, stale-forward gate |
| Multialgo bridges (33 coinů v `ExternalCoin`) | `auxpow_bridge.rs`, `share_forwarder.rs` | ✅ produkce |
| Stratum dialekty (V3 native / v1 / pearl / QTU-cryptonote) | `stratum*.rs` | ✅ multiplex na jednom portu, sniffing prvního řádku |
| Accounting | `v3_pplns.rs`, `pplns.rs`, `store.rs`, `payout.rs`, `deferred_payout.rs` | ✅ ZION kompletní |
| Infra | `vardiff`, `rate_limit`, `telemetry`, `api.rs` (REST: blocks/payouts/miners/pplns/auxpow/profit…), `notifications`, `tls` | ✅ |

**Skutečná díra je v 5 bodech:** per-coin abstrakce, QTU+PRL payout
enginy, public-pool hardening, sjednocené UX, HA.

## 2. Problém "inverted mining" u QTU a PRL

ZION má klasický model: pool staví coinbase → reward padá přímo do pool
wallet → payout engine rozděluje.

**QTU i PRL mají inverted mining — node je block author** (včetně
reward destination). Pool je work-distribution proxy:

- QTC: `MiningResult.miner_id` existuje ve wire protokolu, ale reward
  attributace je node-straně → bloky padají do **quantus-node wallet**.
- PRL: `submitPlainProof` → reward na `PEARLD_MINING_ADDRESS` → bloky
  padají do **oyster wallet**.

Důsledek: QTU/PRL payouty nemůžou být coinbase-per-share. Model je
**share accounting → periodická dávka z node wallet**:

1. Pool měří shary per-coin PPLNS oknem (stejně jako ZION).
2. Node wallet sbírá block rewardy (pool je sleduje jako oracle —
   scan incoming tx / balance delta).
3. `PayoutEngine` per coin vytváří batch transakce: QTU přes
   `quantus-cli`/`QuantusClient` (subxt wrapper už máme —
   viz QUANTUS-INTEGRATION-PLAN §1), PRL přes `oystercli`.
4. Deferred queue (`deferred_payout.rs`) se reuse pro retry dokud
   balance nekryje dávku — stejný pattern jako ZION.

Bridged coiny: upstream pool platí **na naši per-coin wallet** →
stejný batch-payout model v nativním coinu (VRSC rewardy → VRSC
payouty). Žádná auto-konverze.

## 3. Cílová architektura

```
miners ── per-dialect porty ──────────────────────────────
  :3333  ZION (V3 native + stratum-v1 sniff, legacy :8444 alias)
  :3334  QTC  (CryptoNote/SRBMiner dialect — stratum_qtu.rs)
  :3335  PRL  (pearl stratum — stratum_pearl.rs)
  :3336  MULTI (yiimp-style v1, bridged coiny, coin=z param)
  :3xxx  TLS varianty přes ExtraPortConfig
                      │
                      ▼
  Session layer (sdílený): authorize → identity (coin,wallet,worker)
    vardiff · rate_limit · ban table · telemetry  — existuje
                      │
                      ▼
  CoinRouter ──► CoinLeg trait (NOVÉ — jediná strukturální změna):
    fn stream()      → watch<JobPackage>
    fn verify()      → ShareVerdict   (lokální verifier — existuje per coin)
    fn forward()     → block-candidate submit (node / upstream / gateway)
    fn payout_kind() → OnChain | NodeWalletBatch | BridgedBatch
                      │
       ZionLeg │ QtcNativeLeg+QtcUpstreamLeg │ PearlGwLeg+PearlUpstreamLeg │ BridgedLeg×N
                      │
                      ▼
  Unified ShareStore (SQLite) — per-coin PPLNS okna
                      │
                      ▼
  PayoutEngine per coin:
    ZION → on-chain auto (existuje: payout.rs + deferred + sweep)
    QTU  → batch quantus-cli z node wallet     [NOVÉ]
    PRL  → batch oystercli z oyster wallet     [NOVÉ]
    bridged → batch z per-coin upstream wallet [NOVÉ, genericky]
                      │
                      ▼
  api.rs → public read-only REST (existuje) → website pool UI
```

**Klíčový princip:** share pipeline je jediná — `JobPackage → verify →
PPLNS credit → store`. Legs se liší jen ve zdroji jobů a cíli forwardu.
To je přesně ta modularita, která dnes chybí.

## 4. Identita minerů — ZIS jako jednotný účet ekosystému

Pool se **neodpojuje od ekosystému — ZIS je jeho účetní vrstva**.
Základ už existuje (`zis.rs`, Phase C multi-algo roadmapu): V3 Hello
`auth_token` → `POST /api/keys/verify` → session bound k `zis_user`,
auto-resolve `linkedAddresses` (zion-l1 + quantus už jsou mapované),
ban list, mody `off|optional|required`.

Problém: `auth_token` existuje jen ve V3 protokolu. QTU cryptonote
`login`, stratum-v1 `authorize` ani pearl `mining.authorize` ho nemají.
**Řešení — password-field konvence:**

```
login.pass / authorize.password:
  "x"            → anonymous (coin, wallet, worker) — default public
  "zis_<token>"  → ZIS-bound session (všech dialektů, stejný verify path)
```

Pool tak má **jednu identitu napříč všemi dialekty i coiny**: ZIS-bound
miner vidí všechny své shary/payouty pod jedním účtem bez ohledu na
stratum variantu. Anonymous mode zůstává plně podporovaný (web3 zvyk).

ZIS rozšíření potřebné pro pool-NG:
- `linkedAddresses` přidat **pearl** chain (dnes zion-l1 + quantus) —
  ZIS-bound miner na PRL portu dostane auto-resolved prl1… payout.
- ZIS `required` mód pro "profi" úroveň (per-user accounting, ban
  enforcement, rate-limity per user ne jen per IP); `optional` pro
  anonymous crowd.

## 4b. Integrační body se zbytkem ekosystému

| Část | Co pool používá / dodává | Stav |
|---|---|---|
| **zion-miner** | Nativní klient V3 protokolu — `ZION_ZIS_TOKEN` env, streams 1–4, `submit_pearl_share`, `stream4` auxpow | ✅ obousměrně zapojený; nové porty přidat do `setup_menu`/`autonomous` defaultů |
| **Desktop agent** | `PRIMARY_POOL_PORT 8444`, failover watchdog, bundle miner, `pearl-wallet.js` | ✅ onboarding funnel — default pool = náš; updatet config na nové porty + ZIS token flow |
| **Website /pool** | Taby ZION + QTC (`/api/qtc`) + PRL (`/api/prl`) už agregují node RPC + pool legs | ✅ existuje — F5 sjednotí do jednoho multi-coin view + miner lookup `(coin, wallet)` |
| **Web `/api/blocks`** | Merged feed ZION blocks + QTC wormhole rewards | ✅ rozšířit o PRL jakmile padne první mainnet blok |
| **Multichain L2 / ZIS wallet** | Pool payouty → user wallets; ZIS→L2→Uniswap path (ZIS_WALLET_PLAN) | payout sink = linked addresses |
| **OASIS** | `notifications.rs` OASIS webhook — block-found events | ✅ existuje; rozšířit o QTU/PRL block events |
| **Hiran (L3 ai-native)** | `tool_registry` může číst `/api/v1/*` → AI chat odpovídá "kolik jsem vytěžil" | fáze 2, nízká priorita |
| **SMOS rigs** | Wrapper env (`RIG_*`) distribuuje pool endpoint; teamredminer/SRBMiner zipy dostanou connect strings | nové porty → update wrapper docs + zip configs |
| **DAO** | `zis.rs` v DAO crate — sdílený identity model | beze změny |

**Miner-side dopad:** zion-miner je "first-class citizen" — pool jeho
protokol ovládá end-to-end, takže nové featury (ZIS binding, per-coin
worker stats, job QoS) jdou vyvinout bez wire-compat boje. Cizí minery
(SRBMiner, teamredminer) jedou přes svoje dialekty na dedikovaných
portech.

## 5. Public hardening (nové / rozšířené)

- Connection caps per IP + global cap; `rate_limit.rs` rozšířit o
  reconnect ban ladder (existuje `reconnect_rate_limit` config).
- Wallet format validation při `authorize`/`login` per coin → odmítnout
  garbage identity hned (šetří DB i logy).
- Share-flood: max submits/s per session, invalid-share ratio → ban.
- Frame size limits — už existují per dialect (stratum_pearl MAX_*
  konstanty); sjednotit do shared `limits.rs`.
- TLS porty jako primární public entrypointy (plaintext jen localhost/
  legacy).
- Observability: Prometheus metriky per coin (jobs served, shares
  acc/rej, hashrate estimate, payout queue depth), alert na
  forward-failure a stale legs.

## 5a. Public read API tier — `/public/v1/*` (NOVÉ, nutné pro UI)

Dnes je **celé `/api/*` default-deny pod `x-api-key`** (POL-004) — veřejné
pool UI by nemělo z čeho číst. Otevřené jsou jen `/health`, `/metrics`,
`/stats`, `/miners`.

Model public poolů: staty jsou **public-by-wallet** (kdokoliv se podívá
na stats jakékoliv adresy — k1pool/herominers standard).

- Nový route prefix `/public/v1/*` v `api.rs` — **bez klíče**, rate-limited:
  - `GET /public/v1/coins` — registry (coin, algo, port, dialect, fee,
    min payout, payout mode, leg status native/upstream)
  - `GET /public/v1/coins/{coin}/stats` — hashrate, miners online, diff,
    luck (`block_tracker` má pool luck ready)
  - `GET /public/v1/coins/{coin}/blocks` — found blocks feed
  - `GET /public/v1/miner/{coin}/{wallet}` — workers, hashrate, shares
    acc/rej, immature, paid
  - `GET /public/v1/miner/{coin}/{wallet}/payouts` — payout history
  - `GET /public/v1/payouts?coin=` — global feed (adresy zkrácené? —
    public pooly ukazují plné; decision)
- Nikdy neexponovat: interní leg addr/porty, upstream worker names,
  wallet key existenci, admin cokoliv.
- `api.rs` je hand-rolled HTTP — držet stejný auditovatelný styl, žádný
  nový framework.

## 5b. Revenue lanes — produktové rozhodnutí (dřív skryté, teď public)

`revenue_scheduler` + `revenue_proxy` + `ncl_gateway` tvoří V3-ported
systém **revenue lanes**: část sharů se routuje mimo ZION
(`AUXPOW_SPLIT_ZION=4 : SPLIT_EXTERNAL=1` = 20 % sharů jde external)
a NCL lane dokonce prodává Hiran inference.

U privátního provozu OK — u **public poolu to musí být miner-visible**:
- Anonymous minery: `external` lane jen jako **opt-in multialgo stream**
  (dedicated port/coin selector), nikdy skrytý share-split — to by byl
  reputační deal-breaker ("pool mi tajně vzal 20 % hashrate").
- Operator lane (revenue_scheduler) může zůstat pro interní rigy.
- NCL/AI lane = budoucí "earn-by-inference" feature — opt-in per miner,
  separátní od PoW shares.

Toto je největší *policy* změna proti dnešku — doporučuju default:
všechny public shares jdou do coinu, který miner zvolil; profit-switch
jen jako explicitní opt-in skupina.

## 6. pool.zionterranova.com — nový standalone UI

Operátor: **úplně nové UI na dedikované doméně**, v enginu podobném
intro webu. Rozhodnutí vychází z IntroPage/freeworld vzoru:

**Stack (kopie IntroPage modelu):**
- Nový projekt **`APP&WEB/pool-ui/`** — Next.js **static export**
  (`next build` → `dist/`), React + Tailwind + framer-motion +
  ZION theme (gold→purple→cyan, `zion-rainbow-card` atd. —
  viz `docs/3.0.3/ZIONTHEME.md`).
- **Proč static, ne website-v2.9:** app.zionterranova.com je Next 16
  dynamická app (SSR proxy routes). Pool site je public produkt —
  static = žádný běžící Node proces, žádný SSR attack surface, deploy
  = rsync (stejné jako freeworld/intro). Live data se tahají
  client-side z `/public/v1/*` (§5a) přes nginx proxy.
- Deploy: `deploy/deploy-pool.sh` → rsync `dist/` → `/var/www/pool/`.
- Nginx: `V31/deploy/nginx/pool.zionterranova.com.conf` — klon
  freeworld patternu (security headers, `limit_req zone=zion_api`,
  `/api/` → `127.0.0.1:8080` **jen na `/public/v1/` allow-list**,
  static assets cache). DNS A → 62.171.141.136, `certbot --nginx -d`.
- **Pozor:** `dashboard.zionterranova.com` = operator-only (IP allowlist
  + basic auth) — nesplést; pool site je jeho veřejný protějšek.

**Stránky (public-content rules — žádné interní názvy/verze/cesty):**

| Route | Obsah | Zdroj dat |
|---|---|---|
| `/` | Hero + coin karty (ZION/QTC/PRL/MULTI): live hashrate, miners online, network diff, blocks 24h, luck, fee %, min payout; status pill per leg (native/upstream) | `/public/v1/coins`, `/stats` |
| `/start` | "How to mine" per coin: port table, miner config snippets — **zion-miner** (první), SRBMiner (`--algorithm quantus`/`pearlhash` — SM75+/RDNA+ pozn.), teamredminer SMOS; TLS vs plain; stratum URLs | static content |
| `/miner/[coin]/[wallet]` | Miner dashboard: hashrate graf (`hashrate-history` hook), workers tabulka, shares acc/rej, immature vs paid, payout history | `/public/v1/miner/…` |
| `/blocks` | Unified found-blocks feed (všechny coiny, per-coin filtr) | `/public/v1/coins/{coin}/blocks` |
| `/payouts` | Transparent payout feed + payout policy (schedule, min, fee split 5% humanitarian + 5% issobella — je to feature, ne tajemství) | `/public/v1/payouts` |
| `/stats` | Pool telemetry: per-coin grafy, leg health, uptime | `/public/v1/coins/{coin}/stats` |
| `/faq` | Anonymous vs ZIS účet, vardiff, TLS, payout timing | static |

- i18n **CS+EN** (parita s webem), dark ZION theme.
- Miner lookup vstupní pole na homepage — primary CTA.
- Žádný login/public-auth ve fázi 1 — ZIS-bound data vidí miner po
  přihlášení ve website-v2.9 (future unified account), pool site je
  read-only public.

## 6b. Co se nesmí zapomenout (checklist z review)

- [ ] **Payouts schema per coin** — `payouts` tabulka je ZION-shaped
      (`amount_flowers`, `tx_id`, `height`, `block_hash`); QTU má
      **12 decimals**, PRL jiný tx model → `coin` sloupec + jednotky
      per coin (schema v2 migration v `store.rs`).
- [ ] **`shares.source` → `coin`** — hook existuje, sjednotit s
      CoinLeg registry.
- [ ] **Per-coin upstream wallets** — pattern `ZION_POOL_AUXPOW_WALLET_<COIN>`
      (VRSC/ZANO/QTU-k1pool-KR už nastavené); payout engine čte ze stejné
      registry.
- [ ] **QTU k1pool = KR wallet** — upstream pays to KR_* účet; bridged
      payout engine z něj dál vyplácí (ne node wallet!).
- [ ] **Pearl stratum HW floor** — SRBMiner pearlhash SM75+/RDNA+ only;
      Pascal nefunkční → musí být v `/start` copy.
- [ ] **QTU 12-decimal formatting** všude v UI+API (ne flowers).
- [ ] **Env registry** — kompletní seznam `ZION_POOL_*` varů z
      edge-environment.sh zdokumentovat (appendix), public deploy musí
      mít secrets mimo repo (payout SK!).
- [ ] **Block tracker per coin** — orphan monitoring dnes jen ZION;
      QTU/PRL blok-verify přes jejich RPC.
- [ ] **`/api/blocks` merged feed** na webu += PRL po prvním bloku.
- [ ] **Fee transparency** — 5% humanitarian + 5% issobella + pool bps
      zobrazovat v UI (FeeConfig už to nese).
- [ ] **profit.rs PRL gate** — disabled do mainnet Accepted.
- [ ] **Telegram/notifications per coin** — block-found eventy
      rozšířit (OASIS webhook existuje).

## 8. Fázový plán

| Fáze | Obsah | Gate |
|---|---|---|
| **F1** CoinAdapter refactor | Vytknout legs za `CoinLeg` trait; `qtun:`/`prlu:`/upstream prefixy zůstávají. Žádná změna chování. | `cargo test -p zion-pool` zelený, stejný deploy |
| **F2** Unified accounting + ZIS napříč dialektami | ShareStore schema v2 (`coin` sloupec, payouts per-coin units); per-coin PPLNS okna; `zis_<token>` v password poli všech dialektů; ZIS `linkedAddresses` += pearl | ZIS-bound session na QTU i PRL portu; shares per coin |
| **F3** QTU+PRL payouty | `QtcPayout` (quantus-cli batch z node wallet), `PrlPayout` (oystercli), bridged batch z upstream wallets; reuse deferred queue; balance oracle; ZIS linked fallback | testnet/regtest payout dávka E2E per coin |
| **F4** Public surface + `/public/v1` | Dedikované porty, TLS, wallet-formát validace, ban ladder, limits; **public API tier**; revenue-lane policy (opt-in only); miner+agent+SMOS defaulty | externí miner connect; `/public/v1/coins` servíruje |
| **F5** pool.zionterranova.com | `APP&WEB/pool-ui/` static export + nginx vhost + DNS + certbot + deploy script; stránky dle §6 | web live, miner lookup přes coiny, zero interních detailů |
| **F6** HA | Standby pool + node failover (`share_relay` Edge→Core primitiv existuje — unified PPLNS základ); docs runbook | později |

F1–F2 jsou pure refactor — lze dělat bez dotknutí produkce (binárka se
builduje stejně). F3 je jediná fáze s konsensus/dotací peněz → testovat
na regtest QTU/PRL izolovaně (stejný model jako pearl regtest E2E).

## 9. Rizika a otevřené otázky

- **`profit.rs` PRL routing zůstává DISABLED** (policy gate — čeká se na
  mainnet `Accepted`). Pool PRL leg běží opt-in; auto-switch do PRL
  nezapínat dokud gate nepadne.
- **QTU reward oracle** — node-authored bloky: ověřit, jestli node
  loguje `miner_id`/reward attributaci použitelnou pro audit; jinak
  oracle = balance delta + block rewards z chain exploreru.
- **Pearl gateway verify ~3 min** — forward→node submit je async; pool
  musí ukazovat "forwarded, pending node verdict" stav per job.
- **Pearl block luck** — bez mainnet bloku je PRL payout engine
  neotestovaný na reálných reward stech; dry-run mód (counting without
  sending) doporučen.
- **SPOF** — Edge je jediný host; F6 řeší.
- **Upstream pool TOS** — bridged legs: některé pooly zakazují
  re-serving jobů (pool-in-pool). Zkontrolovat podmínky pro public
  provoz (k1pool, herominers, zpool); fallback = vlastní nody jen pro
  coiny kde je to problém.

## 10. Naming / surface (návrh)

- Produktový název: **ZION Pool** (pool.zionterranova.com), coiny jako
  tabs — marketing řeč "one pool, four+ coins, native payouts".
- Port map zdokumentovat na webu + v `--help`.
- Interní `/api/v1/*` zůstává key-gated; public surface =
  `/public/v1/coins` registry + per-coin/miner endpointy (§5a).

---

## 11. Implementační stav (2026-10-19)

**Mock UI** `APP&WEB/pool-ui/` — Next.js 14 static export, 12 stránek
(home/start/miner dashboard/blocks/payouts/stats/faq, CS+EN), mock data
layer se shapem `/public/v1/*` (swap = `USE_MOCK` konstanta).

**F1 ✅ CoinLeg refactor** — `coin_leg.rs`: `route_job_id()` pro všechny
job-id namespace (`qtun:`/`prlu:`/`zion_*`/`j*`/`v3_*`/`aux_*`), leg
registry (5 fixních + 33 bridged), `LegStatus` snapshot,
`StratumServer::leg_statuses()`. Behavior-preserving, 287 testů.

**F2 ✅ Unified accounting + ZIS** — store schema v2 (`coin` sloupce,
PK `(coin,height)`, migrace); coin-tagged PPLNS okno + per-coin
statistiky; `zis_<token>` přes password pole QTU/PRL/V1 (shared
`zis_password_auth`, V1 staged-consume); ZIS `linkedAddresses += pearl`
(identity `verifyPearlAttestation` + bech32m validace). 306 testů.

**F3 ✅ Native-coin payouty** (QTU/PRL):

- `v3_pplns.rs`: `native_payout_coins` config, per-coin `unpaid_native`
  buckets (žádné míchání jednotek s flowers), `min_payout_native`
  thresholds, unified exkluze native coinů, `expected_chain` vynucení
  (QTU→quantus, PRL→pearl), snapshot persist, rollback.
- `pool.rs`: `on_coin_revenue(coin, amount, ref_height, event_id)` —
  dedup, coin-sliced distribuce, `native_units`+`coin`+`revenue_event`
  metadata, queue.
- `store.rs` v3: `coin_revenue` audit+dedup tabulka (restart-safe).
- `api.rs`: `POST /admin/coin-revenue` (admin key, dedup response s
  již kreditovanou částkou), drain entries nesou `unit`/`coin`/`event`.
- `qtc_payout.rs`: `unit:"native"` path bez FX, ledger klíč
  `quantus:rev:{event}:{miner}`; legacy FX cesta beze změny.
- `prl_payout.rs` (nové): oyster `sendtoaddress` sweeper, **dry-run
  default** (`PRL_PAYOUT_DRY_RUN=0` teprve po regtest ověření),
  prl1… validace, fail-closed ledger.
- `revenue_oracle.rs` (nové): balance-delta watcher treasury účtů
  (`ORACLE_QTU_ADDRESS`, `ORACLE_PRL_RPC_URL`), deterministické event
  id `{coin}:bal:{from}:{to}`, convergent duplicate handling,
  `coin_oracle_state` persist.

Testy: `zion-pool` 314/314, `zion-multichain` 731/731.

**F4 ✅ část A — `/public/v1` tier + public hardening základ:**

- `api.rs` — unauthenticated public read tier (bez klíče; `/api`+`/admin`
  auth nezměněn):
  - `GET /public/v1/coins` — coin registry (coin, payout_mode, min_payout,
    fee_bps) + live leg health (`Pool::leg_statuses`, přesunuto z
    `StratumServer` — sdílený zdroj pro stratum i API). Public-safe:
    žádné job ids, upstream endpointy, interní porty/worker names.
  - `GET /public/v1/coins/{coin}/stats` — per-coin stream telemetry
    (miners online <600 s, acc/rej), PPLNS coin window stats; hashrate
    jen pro zion (external shary nemají srovnatelnou obtížnost → null).
  - `GET /public/v1/coins/{coin}/blocks` — `query_blocks_for_coin`.
  - `GET /public/v1/miner/{coin}/{wallet}` — workers, shares, unpaid
    (flowers nebo native units dle coin), last_seen.
  - `GET /public/v1/miner/{coin}/{wallet}/payouts` — historie per coin.
  - `GET /public/v1/payouts?coin=` — globální feed, `coin` filtr.
- Per-IP rate limit pro `/public/v1` — 120 req/60 s, bounded tabulka
  (4096 IP, fail-closed při přeplnění, oportunistický GC), 429 response.
- `Pool::wallet_is_valid` (zion1/qz/prl1 + chain: prefixy) — vynuceno
  při V1 `mining.authorize`, QTU `login`, PRL `authorize`. Garbage
  identity dřív tiše těžily na pool wallet; teď `invalid wallet`
  reject. ZIS sessions s non-address miner id procházejí (payout přes
  linked adresu).
- Testy: 320/320 (+6: coins shape+leak check, per-coin stats, miner
  wallet scope, rate limit, wallet_is_valid, authorize reject).

**F4 ✅ část B — hardening doplňky:**

- Global session cap `ZION_POOL_MAX_SESSIONS` (default 2048) — doplňuje
  per-IP cap `ZION_POOL_MAX_SESSIONS_PER_IP` (10), accept-loop drop.
- V1 invalid-share ban — `consecutive_invalid` na `StratumV1Ctx`,
  threshold = existující `ZION_POOL_MAX_NO_SOLUTION` (10); po překročení
  `no_solution_bans` IP ban (`ZION_POOL_NOSOLUTION_BAN_SECS`, 300 s) +
  session drop po odeslání error response. V3 mělo ekvivalent dřív.
- Per-coin Prometheus metriky — `zion_pool_coin_shares_{accepted,rejected}`,
  `zion_pool_coin_miners_online` (streams agregace), leg health gauges
  `zion_pool_leg_{enabled,connected,job_age_ms}` pro alert na stale/
  disconnected legs.
- Revenue-lane policy verifikována: lane = opt-in (`g=`/`group=` hint,
  backend env lists `ZION_POOL_BACKEND_*`, default `zion`); anonymous
  public miner nemůže tiše skončit v externí/NCL lanu.
- Share-flood `ZION_POOL_SHARE_RATE_PER_SEC` (V1), frame limits per
  dialect, reconnect `IpRateLimiter` — existovaly; ověřeno.
- Testy: 321/321 (+1: V1 ban threshold/reset).

**F5 ✅ část A — deploy assets připraveny:**

- `V31/deploy/nginx/pool.zionterranova.com.conf` — static `/var/www/pool`,
  `/public/v1/` proxy → `127.0.0.1:8080` (jediný proxied prefix;
  `/api/`+`/admin` explicitní 404), `limit_req`, security headers,
  Certbot-managed TLS bloky.
- `APP&WEB/pool-ui/deploy/deploy-pool.sh` — `npm run build` → rsync
  `dist/` → `/var/www/pool`; `--nginx` instaluje+reloadne vhost;
  `--build-only` pro lokální build.
- `GET /public/v1/blocks?coin=` — globální blocks feed (per-coin feed
  už existoval); miner payload rozšířen o `workers[]` rows.
- `pool-ui/src/lib/api.ts` — live adapter: `COIN_META` (name/algo/ports/
  accent zůstává UI-side), `qtc`↔`qtu` coin mapping, `/public/v1` →
  UI typy. `USE_MOCK=true` dokud se neověří live endpoint — flip = 1
  konstanta. `tsc --noEmit` clean, `next build` static export OK.

**F5 ✅ část B — LIVE NA EDGE (2026-10-18, `0b07ceeaa`):**

- Edge SSH: `zion-v6` alias (IPv6 `2a02:c207:2342:5821::1` :2222 — IPv4
  egress je CGNAT-blokovaná); deploy script default `POOL_DEPLOY_HOST=zion-v6`.
- Pool binary rebuild na edge z worktree `/root/build/pool-F5` (clean
  checkout, `CARGO_TARGET_DIR=/opt/zion/V31/target` sdílí dep cache →
  ~10 min), bak `zion-pool.bak-pre-public-api-20261017`;
  `systemctl restart zion-v31-pool` (~10 s miner reconnect).
- DNS `pool.zionterranova.com` → 62.171.141.136 (už existovalo);
  `certbot --nginx -d pool.zionterranova.com` vydal cert, rewrite do
  sites-enabled conf.
- UI: static `dist/` rsync → `/var/www/pool`; **`USE_MOCK=false`** —
  live adapter ověřen proti reálnému API.
- **Hotfixy při deployi:** (a) `/public/v1/blocks`+`/payouts` double-wrap
  (`{"blocks":{"ok":..,"blocks":[..]}}`) — public serializery teď vrací
  bare array; (b) public feeds leakovaly `worker_name` + `miner_id` s
  `.worker@group` suffixy → `serialize_public_*` strip na `miner`/jen
  adresu; (c) miner workers `name` = čistý worker (strip `wallet.`+`@g=`);
  (d) `/miner/<coin>/<wallet>` = client-side shell `miner/page.tsx`
  (parsuje pathname) + nginx `try_files …/miner/index.html` — static
  export nemůže pre-renderovat libovolné wallet paths.
- **Live ověřeno:** `GET /` 200, `/public/v1/coins` 200 (12 coinů,
  legs connected), `/coins/{zion}/stats` 200 (hashrate ~270-346 KH/s),
  `/blocks` 200 (čistý shape, skutečné bloky), `/payouts` 200,
  `/miner/zion/<wallet>` 200 (workers+unpaid+active), `/api/*` 404,
  `/admin` 404. HTTPS externě ověřeno.

**F5 ✅ část C — TLS stratum live (2026-10-18, `51f505359`):**

- `ZION_POOL_TLS_BIND=0.0.0.0:8445` + cert z
  `/etc/zion/stratum-tls/` (kopie LE `pool.zionterranova.com` certu,
  `zion:zion` — `/etc/letsencrypt` je root-only); certbot deploy hook
  `/etc/letsencrypt/renewal-hooks/deploy/zion-pool-stratum-tls.sh`
  re-copies + `try-restart` při renewal.
- UFW `8445/tcp ALLOW Anywhere`; envs v `edge-environment.sh`
  (`.bak-tls-stratum-20261018`).
- **rustls fix:** `ServerConfig::builder()` panicoval na ambiguitu
  CryptoProvider (víc providerů v dep grafu → crash-loop status=101) —
  `builder_with_provider(ring)` + explicitní protocol versions.
- **E2E ověřeno:** `openssl s_client` → `mining.subscribe` + V1
  `mining.authorize` → `result:true` přes
  `stratum+ssl://pool.zionterranova.com:8445` (a `stratum.zionterranova.com`).
- UI `COIN_META` — reálné porty 8444/8445 (všechny coiny multiplex
  na jednom listeneru, dialekt = auth vrstva).

**Zbývá:** F6 (HA). Před produkcí regtest payout dávky na QTU i PRL a
`PRL_PAYOUT_DRY_RUN=0` až po ověřené live dávce. Edge worktree
`/root/build/pool-F5` ponechán pro další pool buildy; `/opt/zion` tree
zůstává dirty (pre-existing).

### F6 — L1 RPC failover (implementováno, čeká na edge deploy)

- **`L1Endpoints`** (`rpc_client.rs`) — `ZION_L1_RPC_URL`/`--l1-rpc-url`
  přijímá comma-separated list:
  `http://127.0.0.1:9445,http://127.0.0.1:9446,http://127.0.0.1:9447`.
  Poslední funkční endpoint se zkouší první (last-good stickiness), každý
  pokus bounded na 4 s, cyklický fallback přes zbytek, chyba až když všechny
  padnou. Single-endpoint chování beze změny.
- **Migrované call sites:** `template_feed_loop` (kritická mining cesta —
  1 s poll + reuse-last-template jako druhá vrstva), `submitBlock` +
  `getChainInfo` v submit cestě, `deferred_payout.rs` (getUtxos /
  getTransaction / getChainInfo / getBlockByHeight / submitUtxoTransaction),
  `payout.rs` (fetch_utxos + submit_utxo_transaction). Žádný direct
  `parse_rpc_addr`+`jsonrpc_call` call site nezbyl.
- **Write-safety:** `submitBlock` je idempotentní (duplicitní submit = node
  vrátí error, který se zaloguje); `submitUtxoTransaction` — node mempool
  deduplikuje podle txid.
- **Edge topologie:** `zion-v31-node` (RPC 9445) + `zion-v31-node2` (9446) +
  `zion-v31-node3` (9447) — všechny servírují `getTemplate`.
- **Testy:** 11 nových v `rpc_client.rs` — parsing, invalid skip, last-good,
  failover na follower, stickiness po návratu primary, fail-back když
  follower umře, all-fail error. Celý suite 331+.
- **Zbývá:** edge env update (`ZION_L1_RPC_URL` → 3 endpointy) + rebuild +
  kontrolovaný live failover test (stop `zion-v31-node`, ověřit přepnutí na
  9446/9447, miners dostávají joby, restore); standby pool na jiném hostu
  zůstává open.

---

*Příbuzné docs: `PEARL-POUW-INTEGRATION.md` (PRL legs detail),
`QUANTUS-INTEGRATION-PLAN.md` (QTC stack + QuantusClient),
`MULTI-ALGO-ROADMAP.md`, `ZionSMR.md` (SRBMiner surface).*
