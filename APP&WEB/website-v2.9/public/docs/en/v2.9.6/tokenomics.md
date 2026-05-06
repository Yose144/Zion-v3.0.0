# 💰 Tokenomics v2.9.6 — emission proposals for a 100-year horizon

> *Balancing L5 Free World + L6 Issobella ambition with miner and holder incentives.*

---

## Current v2.9.5 baseline

144B cap; flat ~5,400 ZION/block; ~45-year mining horizon; 100% fee burn; 10% humanitarian tithe (later split evolved in v2.9.6).

**Why change?** 45 years is short for L5/L6; miners need incentives after flat emission ends; scarcity signalling.

---

## Immutable constants

| Parameter | Value |
|-----------|-------|
| Total supply | 144,000,000,000 ZION |
| Genesis premine | 16,280,000,000 ZION (11.31%) |
| Block time | 60 s |
| Fee policy | 100% burn |
| Premine buckets | Oasis 8.25B, DAO 4B, Infra 2.59B, Humanitarian 1.44B |

---

## Proposal A — Decade Decay (−20% / 10 years) ✅ *implemented narrative*

Every 10 years (5,256,000 blocks) reward drops 20%; after decade 10 tail **~725 ZION/block** forever. ~100-year emission profile with predictable steps — **Model A chosen** together with **5% humanitarian + 5% L5/L6 Issobella** and **89% miners + 1% pool**.

---

## Proposal B — Golden ratio (−25% / 8 years)

Faster scarcity; 8-year epochs; lower tail (~228 ZION). Stronger deflationary story, harsher late-stage rewards.

---

## Proposal C — Century constant + tail

Flatten reward to ~2,430 ZION for 100 years then small tail; simplest math but weaker early bootstrap.

---

## Proposal D — Dual phase

High bootstrap decade ~5,400 then −30% steps; tail ~311 ZION; balances hype and longevity.

---

## Proposal E — Harmony curve

Smooth logarithmic decay without discrete halving events; harder to communicate, elegant mathematically.

---

## Comparison snapshot

| | A Decade | B Golden | C Century | D Dual | E Harmony |
|--|:---:|:---:|:---:|:---:|:---:|
| Step | 10 yr | 8 yr | flat | decade | smooth |
| Cut | −20% | −25% | 0% | −30% | log |
| Tail ZION | ~725 | ~228 | ~243 | ~311 | ~1,000 |
| Simplicity | high | medium | max | medium | low |

---

## Layer funding

Genesis buckets unchanged. Ongoing: tithe + fee burn + DAO grants; v2.9.6 adds dedicated **L5/L6 Issobella** coinbase share (5%) alongside **5% humanitarian**, preserving **89% miner** share.

Off-chain **L4 Oasis** revenue can supplement L5/L6 per product design.

---

## Implemented direction (v2.9.6)

1. **Decade Decay** in `reward.rs` — tail from ~2126.  
2. **5 / 5 / 89 / 1** split (humanitarian / Issobella / miners / pool).  
3. Hard fork changes limited to reward schedule — UTXO, P2P, CHv3 core unchanged.

---

## Governance flow

Proposals → forum discussion → DAO vote → testnet → coordinated activation.

---

*"Between ambition and realism — building for 100 years."* 💰
