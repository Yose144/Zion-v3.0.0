# Tokenomics — ZION v2.9.5

> Mathematical derivation of ZION's core economic parameters.

---

## Fixed Parameters (Immutable, genesis-encoded)

| Parameter | Value |
|-----------|-------|
| **Total Supply** | 144,000,000,000 ZION |
| **Block Time** | 60 seconds |
| **Blocks per Year** | 525,600 |
| **Mining Years** (v2.9.5) | 45 (2026–2071) |
| **Total Blocks** | 23,652,000 |

---

## Mathematical Proof: Block Reward

```
TOTAL_SUPPLY     = 144,000,000,000 ZION
GENESIS_PREMINE  =  16,280,000,000 ZION
MINING_EMISSION  = 127,720,000,000 ZION

MINING_YEARS     = 45
BLOCKS_PER_YEAR  = 525,600
TOTAL_BLOCKS     = 23,652,000

BASE_BLOCK_REWARD = 127,720,000,000 / 23,652,000
                  = 5,400.067 ZION / block

Verification:
  5,400.067 × 23,652,000 = 127,720,384,400 ZION
+ Genesis premine:          16,280,000,000 ZION
                           ──────────────────────
  Total:                   144,000,384,400 ZION

Rounding delta: 384,400 ZION = 0.00027% of supply ✅
```

The 5,400.067 figure is mathematically derived — not arbitrary.

> **v2.9.6 change:** Decade Decay was introduced, making the block reward decrease −20% every 10 years with a permanent tail emission of 725 ZION/block. This extends the mining horizon from 45 to 100+ years. The total hard cap of 144B ZION is unchanged.

---

## Genesis Premine (16.28B ZION — 11.31%)

All genesis allocations are on-chain verifiable from the genesis block.

| Category | ZION Amount | % of Supply | Purpose |
|----------|-------------|-------------|---------|
| ZION OASIS + Winners | 4,950,000,000 | 3.44% | OASIS rewards, Golden Egg/Xp events |
| DAO Treasury | 4,000,000,000 | 2.78% | Community governance + grants |
| Infrastructure | 2,590,000,000 | 1.80% | Servers, development, security audit |
| Humanitarian Reserve | 1,440,000,000 | 1.00% | L5 — clean water, education, healthcare |
| **Total Genesis** | **16,280,000,000** | **11.31%** | — |

**Note:** An initial 500M ZION presale allocation existed in the design spec. It was cancelled in January 2026 and the tokens were added to the DAO Treasury. No presale ever took place.

The remaining **88.69%** (127.72B ZION) is emitted exclusively through Proof-of-Work mining.

---

## Block Reward Distribution

Each block reward is split by the protocol:

| Recipient | Share | v2.9.5 Reward (5,400.067) |
|-----------|-------|--------------------------|
| Miner | 89% | ~4,806 ZION |
| Humanitarian Fund | 5% | ~270 ZION |
| Issobella Foundation | 5% | ~270 ZION |
| Mining Pool | 1% | ~54 ZION |

All transaction fees are burned (100%). No developer fee, no foundation pre-tax.

---

## Mining Emission Schedule (v2.9.5 — constant reward)

| Year | Blocks | Emission | Cumulative | % Remaining |
|------|--------|----------|-----------|-------------|
| 2026 | 525,600 | ~2.84B | 2.84B | 97% |
| 2030 | 525,600 | ~2.84B | 16.9B | 87% |
| 2040 | 525,600 | ~2.84B | 44.9B | 65% |
| 2050 | 525,600 | ~2.84B | 73.0B | 43% |
| 2060 | 525,600 | ~2.84B | 101B | 21% |
| 2071 | 525,600 | ~2.84B | 127.7B | 0% (exhausted) |

> v2.9.5 had a hard stop at 45 years. v2.9.6 replaced this with Decade Decay + perpetual tail emission, extending mining indefinitely.

---

## Fee Model

All transaction fees are **permanently burned**. There is no fee redistribution to miners or any protocol address. This creates ongoing deflationary pressure on the circulating supply throughout the network's lifetime.

---

## Emission Philosophy

ZION is explicitly designed for long-term, sustainable mining economics:

- No VC allocation
- No team vesting schedule  
- No foundation inflation
- No governance inflation (DAO uses premine treasury, not new issuance)
- Hard cap — immutable by protocol
