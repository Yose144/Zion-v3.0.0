# ZION Pool-as-a-Service — Hosted Stratum Infrastructure for PoW Chains

> One-pager for B2B outreach. EN below, CS version follows.
> Status: production-proven on ZION mainnet (97 000+ blocks, live since 2026).

---

## English

### What you get

A fully-operated, production-hardened stratum pool for your PoW coin — so your
community mines on day one and you never touch pool ops.

- **TLS stratum, dual protocol** — modern `v3` binary protocol *and* legacy
  `v1` JSON-lines for third-party miners (SRBMiner, lolMiner, rig OS images).
- **PPLNS or SOLO payout modes** — persistent PPLNS window with luck tracking;
  optional solo listener (winner-take-all) on a dedicated port.
- **VarDiff engine** — per-session difficulty retarget (~20-share window),
  port-stratified difficulty tiers for CPU→ASIC ranges.
- **Multi-coin AuxPoW** — attach your coin as a merge-mined leg; miners earn
  your token *and* the primary coin without splitting hashrate. Proven live on
  three aux legs (Pearl, Quantus, ZANO).
- **Durable payout ledger** — write-ahead persistence (tmp + fsync + rename +
  dir fsync), fail-closed corruption recovery, idempotent payout tracking.
  No double-pays on power loss.
- **Full observability** — Prometheus `/metrics` (hashrate, accept/reject
  reasons, unverified-share bucket, payout backlog gauges), Grafana-ready
  alerts, public JSON API (`/stats`, `/miners`, `/blocks`, `/payouts`,
  `/history`).
- **Hardened share pipeline** — per-share dedup (async writer thread),
  upstream share forwarding/relay for merged-mining partners, rate-limited
  API, drain-restart with zero share loss.
- **Block intelligence** — confirmed/orphan tracking, luck %, shares-since-
  block, per-miner 24h history endpoint.

### Why us

- **Real production, not a repo.** ~97 000 confirmed blocks on ZION mainnet;
  survived share-reject RCA, wedge debugging, schema migrations v1→v9 without
  data loss. The runbook (`POOL-DEPLOY-RUNBOOK.md`) is part of the deliverable.
- **Merge-mining is our differentiator.** Most hosted pools do one coin. Ours
  already serves miners 3–4 reward legs simultaneously — your project gets
  hashrate it couldn't attract alone.
- **Failover by design.** Pool talks to redundant node RPC endpoints;
  stratum sessions auto-reconnect; the miner supports pool failover.

### Engagement models

| Model | What happens | Indicative pricing |
|---|---|---|
| **Hosted pool** | We run the whole pool on our infra (TLS endpoint `stratum+tls://…`), you get an admin dashboard + payout config | setup fee + 1.5–2 % pool fee of blocks |
| **Merge-mined leg** | Your coin becomes an aux leg on the existing ZION pool — instant hashrate | 1–2 % of aux-coin rewards |
| **Licensed self-host** | Docker image + runbook + 30-day support; you operate | license + support retainer |
| **Custom chain** | New algo/coin integration (stratum adapter + node RPC bridge) | scoped project |

### What we need from you

- Node RPC endpoint (HTTP JSON-RPC or equivalent) + block template format
- Coin parameters: address format, block reward, target spacing
- (Merge-mining) auxPoW commitment format or willingness to adopt one

### Proof it works

- ZION mainnet pool: live `zionpool.zionterranova.com`, 4+ concurrent
  stratum sessions, aux legs PRL+QTU paying out.
- Miner fleet already compatible — ZION miner (CPU+GPU), SRBMiner via v1
  stratum, vast.ai rig images.

### Contact

`pool@zionterranova.com` · `https://app.zionterranova.com` ·
`https://market.zionterranova.com`

---

## Česky

### Co dostanete

Plně provozovaný, produkčně odladěný stratum pool pro váš PoW coin — komunita
těží od prvního dne a vy se o provoz nestaráte.

- **TLS stratum, duální protokol** — moderní `v3` binární protokol *i* legacy
  `v1` JSON-lines pro minery třetích stran (SRBMiner, lolMiner, rig OS).
- **PPLNS nebo SOLO režim** — persistentní PPLNS okno se sledováním lucku;
  volitelný solo listener na dedikovaném portu.
- **VarDiff engine** — per-session retarget obtížnosti, porty s odstupňovanou
  obtížností pro CPU→ASIC rozsah.
- **Multi-coin AuxPoW** — váš coin jako merge-mined leg; mineři vydělávají
  váš token *i* primární coin bez dělení hashrate. Živě ověřeno na třech
  aux legech (Pearl, Quantus, ZANO).
- **Odolný payout ledger** — trvalá persistence (tmp + fsync + rename +
  fsync adresáře), fail-closed zotavení z korupce, idempotentní payouty.
  Žádný double-pay při výpadku.
- **Plná observabilita** — Prometheus `/metrics` (hashrate, důvody rejectů,
  backlog payoutů), Grafana alerty, veřejné JSON API (`/stats`, `/miners`,
  `/blocks`, `/payouts`, `/history`).
- **Vytvrzená share pipeline** — per-share dedup (async writer), forwarding/
  relay shares pro merge-mining partnery, rate-limited API, drain-restart
  bez ztráty shares.
- **Block intelligence** — confirmed/orphan tracking, luck %, shares od
  posledního bloku, per-miner 24h historie.

### Proč my

- **Skutečná produkce, ne repo.** ~97 000 potvrzených bloků na ZION mainnetu;
  pool přežil RCA share-rejectů, wedge debugging a migrace schémat v1→v9 bez
  ztráty dat. Runbook je součástí dodávky.
- **Merge-mining je náš diferenciátor.** Většina hosted poolů umí jeden coin.
  Náš obsluhuje mineři současně 3–4 odměnové legy — váš projekt získá hashrate,
  který by sám neprilákal.
- **Failover by design.** Pool mluví na redundantní node RPC; stratum session
  se samy reconnectují; miner umí pool failover.

### Modely spolupráce

| Model | Co se děje | Indikativní cena |
|---|---|---|
| **Hosted pool** | Provozujeme celý pool na naší infra, vy dostanete dashboard + payout config | setup fee + 1,5–2 % fee z bloků |
| **Merge-mined leg** | Váš coin jako aux leg na existujícím ZION poolu — okamžitý hashrate | 1–2 % z odměn aux-coinu |
| **Licencovaný self-host** | Docker image + runbook + 30denní support; provozujete vy | licence + support retainer |
| **Custom chain** | Integrace nového alga/coinu (stratum adaptér + node RPC bridge) | projekt na míru |

### Co potřebujeme od vás

- Node RPC endpoint + formát block templatu
- Coin parametry: formát adresy, block reward, target spacing
- (Merge-mining) auxPoW commitment formát, nebo ochota ho adoptovat

### Kontakt

`pool@zionterranova.com` · `https://app.zionterranova.com` ·
`https://market.zionterranova.com`

---

## Outreach — 10 cílových PoW coinů

Kandidáti vybraní podle: aktivní PoW komunita, malý/střední cap (potřebují
hosted pool, nemají kapacitu vlastní), měnitelnost na běžných tržištích.
Řazeno od nejrealističtějších.

| # | Coin | Algo | Proč cíl |
|---|------|------|----------|
| 1 | **Zephyr (ZEPH)** | RandomX | Privacy+cash, rostoucí komunita, málo kvalitních poolů |
| 2 | **Karlsen (KLS)** | KarlsenHash (Kaspa fork) | Malý chain, aktivní miners, několik málo poolů |
| 3 | **Pyrin (PYI)** | PyrinHash (GhostDAG) | Kaspa-fork, potřebuje pool infra |
| 4 | **Radiant (RXD)** | SHA512/256d | UTXO smart-contract chain, dedikovaná komunita |
| 5 | **Neoxa (NEOX)** | KawPow | Gaming-coin, přátelská komunita, snadný merge-mining candidate |
| 6 | **Verus (VRSC)** | VerusHash | PBaaS chain — už je v ZION aux stacku, nejjednodušší první klient |
| 7 | **Qubitcoin (QTC)** | qPoW | Už merge-mined přes ZION pool — existující integrace, upsell |
| 8 | **Alephium (ALPH)** | Blake3 | Mid-cap, menší pool konkurence než BTC/KAS |
| 9 | **Ergo (ERG)** | Autolykos2 | Zavedený chain, velké miner community (bigger deal, delší cycle) |
| 10 | **Flux (FLUX)** | ZelHash | PoW+compute network, enterprise-friendly pitch |

**Sales pitch shortcut:** Verus + Qubitcoin jsou warm leads (už v aux
stacku). Zephyr/Karlsen/Pyrin = cold outreach, největší příležitost.
Ergo/Flux/Alephium = vyšší liga, delší sales cycle, ale větší fee potenciál.
