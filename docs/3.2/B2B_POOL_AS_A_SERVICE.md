# ZION Pool-as-a-Service — one-pager (CS + EN)

> **B2B-4/B2B-5 z `Zionb2b.md`** · Draft 2026-10-28 · Pro outreach na PoW coin týmy a pool operátory.
> **Pravidlo:** reality > docs — všechna čísla níže jsou z produkce, ne z whitepaperu.

---

## ČESKY

### Co nabízíme

Provozujeme vlastní multichain PoW pool v produkci od poloviny 2025 —
97 000+ nalezených bloků, 210 000+ zaznamenaných výplat, auditovaný payout
ledger a monitoring s alertingem. Nabízíme dvě služby:

**1. Hosted stratum (white-label pool).** Postavíme a provozujeme pool pod
vaší značkou: TLS stratum, PPLNS reward scheme, per-coin stratum protokol,
výplatní engine s idempotentním ledgerem, vardiff, dedup shareů,
prometheus metriky, veřejné API pro váš web.

**2. Merge-mining leg (AuxPoW hosting).** Váš coin se připne jako aux leg
našeho poolu — naši mineři těží váš coin souběžně (pattern už provozovaný
pro QTU/PRL/ZANO/EVR/MEWC/KRX/VRSC). Vy získáte hashrate a distribuci,
my % fee z hostované kapacity.

### Proč my — provozní důkaz

| Oblast | Stav v produkci |
|---|---|
| Stratum | TLS + plain, 4 listenery, multi-protocol (v1/pearl/qtu/v3 native) |
| Reward scheme | PPLNS s persistence přes restarty (schema v9, drain-safe) |
| Výplaty | Payout ledger s fsync+durable rename, fail-closed corrupt recovery, dedup guards (`paid_block_heights`, `sent_payouts`) — at-most-once |
| Merge mining | AuxPoW bridge runtime: 8 coin legs (QTU, PRL, ZANO, VRSC, XMR, EVR, KRX, MEWC) |
| Spolehlivost | HA warm standby + 15min DR replikace, drain/restart bez ztráty PPLNS, SIGTERM grace exit |
| Observability | `/metrics` (Prometheus), `/stats`, `/miners`, per-coin gauges, alerting stack, write-path probe 60s |
| Track record | 97k+ bloků, 210k+ payoutů, 7 audit vln, veřejné incident reporty |

### Model

- **Setup fee** (jednorázově, dle integrační náročnosti coinu)
- **1,5–2 % fee** z block rewardů procházejících poolem
- **SLA:** uptime monitoring + alerting, incident reporty, drain-safe restarty
- Možnost white-label (vaše doména/UI) nebo referral do našeho poolu

### Kontakt

pool@zionterranova.com · zionterranova.com

---

## ENGLISH

### What we offer

We run our own multichain PoW pool in production — 97,000+ blocks found,
210,000+ recorded payouts, an audited payout ledger and a full
monitoring/alerting stack. Two services:

**1. Hosted stratum (white-label pool).** We build and operate a pool under
your brand: TLS stratum, PPLNS reward scheme, per-coin stratum protocol,
a payout engine with an idempotent ledger, vardiff, share dedup,
Prometheus metrics, and a public API for your site.

**2. Merge-mining leg (AuxPoW hosting).** Your coin plugs in as an aux leg
of our pool — our miners merge-mine it alongside (a pattern already in
production for QTU/PRL/ZANO/EVR/MEWC/KRX/VRSC). You get hashrate and
distribution; we take a % fee on hosted capacity.

### Why us — operational proof

| Area | Production status |
|---|---|
| Stratum | TLS + plain, 4 listeners, multi-protocol (v1/pearl/qtu/v3 native) |
| Reward scheme | PPLNS persisted across restarts (schema v9, drain-safe) |
| Payouts | Ledger with fsync + durable rename, fail-closed corrupt recovery, dedup guards — at-most-once |
| Merge mining | AuxPoW bridge runtime: 8 coin legs (QTU, PRL, ZANO, VRSC, XMR, EVR, KRX, MEWC) |
| Reliability | HA warm standby + 15-min DR replication, drain/restart with zero PPLNS loss, SIGTERM grace exit |
| Observability | `/metrics` (Prometheus), `/stats`, `/miners`, per-coin gauges, alerting, 60s write-path probe |
| Track record | 97k+ blocks, 210k+ payouts, 7 audit waves, public incident reports |

### Commercial model

- **Setup fee** (one-off, depends on coin integration effort)
- **1.5–2% fee** on block rewards flowing through the pool
- **SLA:** uptime monitoring + alerting, incident reports, drain-safe restarts
- White-label (your domain/UI) or referral into our pool

### Contact

pool@zionterranova.com · zionterranova.com

---

## Outreach — 10 cílových PoW coinů

Kritéria výběru: (a) aktivní komunita bez dominantního pool operátora,
(b) auxpow-kompatibilita nebo realistická stratum integrace, (c) GPU/CPU
těžitelné = náš miner základna může merge-minovat hned.

| # | Coin | Ticker | Proč lead | Cesta |
|---|------|--------|-----------|-------|
| 1 | Evrmore | EVR | Už provozovaný aux leg — upsell na dedikovaný hosted pool | Aux leg → hosted |
| 2 | Meowcoin | MEWC | Aux leg v produkci, malá komunita bez kvalitní pool infra | Aux leg → hosted |
| 3 | Kriptex | KRX | Aux leg v produkci | Aux leg → hosted |
| 4 | Verus | VRSC | Aux leg v produkci; PBaaS ekosystém s mnoha sub-chainy = multiplier | Aux leg → per-chain hosting |
| 5 | Zano | ZANO | Aux leg v produkci (HeroMiners upstream) — nabídnout výkonnejší alternativu | Aux leg → hosted |
| 6 | Zephyr | ZEPH | RandomX = náš miner umí (XMR leg); rychle rostoucí privacy coin, málo poolů | Nový stratum adapter |
| 7 | Ergo | ERG | Autolykos GPU coin, velká komunita, pool trh fragmentovaný | Nový stratum adapter |
| 8 | Alephium | ALPH | Roustoucí ekosystém, hosted pool demand, solidní tokenomika | Nový stratum adapter |
| 9 | Hathor | HTR | Nativně merge-mined s BTC — ideální auxpow kandidát, málo hostovaných poolů | AuxPoW merge-mining |
| 10 | DigiByte | DGB | Auxpow-capable (Dandelion/multi-algo), stará komunita, fragmentované pooly | AuxPoW merge-mining |

> **Postup:** každý kontakt = jeden mail — one-pager výše + konkrétní návrh
> (pro legs: "vaši mineři dostanou zaplaceno ve vašem tokenu, my držíme %").
> 1–2 klienti/kvartál je realistický cíl — niche trh.

> **Pre-outreach gate (29.10.):** ZION payout recovery live; QTC = zveřejněný
> honest hold (`QTC_PAYOUT_POLICY.md`). Outreach balíček:
> `B2B_POOL_OUTREACH.md`. Mineři = budoucí hashrate (§4 `Zionb2b.md`) —
> při leadu nezatajovat QTC hold.
