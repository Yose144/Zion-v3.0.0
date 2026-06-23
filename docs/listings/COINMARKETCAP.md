# ZION TerraNova — CoinMarketCap Listing Application

> Submission packet for listing **ZION** on CoinMarketCap (CMC). All values are sanitized for
> public disclosure and grounded in the open-source `V3/` codebase. Internal infrastructure
> details (server IPs, keys, operational endpoints) are intentionally omitted.

---

## 1. Basic Information

| Field | Value |
|-------|-------|
| Cryptocurrency name | ZION TerraNova |
| Symbol / ticker | **ZION** |
| Asset type | Coin (own Layer-1 blockchain) |
| Wrapped representation | wZION (ERC-20, Base) |
| Consensus mechanism | Proof-of-Work (Nakamoto) |
| Hashing / mining algorithm | Ekam Deeksha (ASIC-resistant, memory-hard) |
| Source code | Open source (MIT) |
| Date launched / genesis | Mainnet Genesis: 31 December 2026 |
| Country of origin | Decentralized / open-source community |

### Project description (long form)
ZION TerraNova is an open-source, ASIC-resistant Proof-of-Work Layer-1 blockchain written from
scratch in Rust. It was designed to solve four structural problems in cryptocurrency: ASIC
centralization, insider pre-allocation, the absence of protocol-level social impact, and
supply-shock volatility.

ZION's emission model — **Decade Decay** — replaces Bitcoin-style four-year halvings with a smooth
−20 % reduction every ten years, anchored by a perpetual tail emission that secures the network
indefinitely. **10 % of every block reward is automatically and immutably allocated to
humanitarian (5 %) and scientific/space (5 %) funds**, enforced directly in the consensus code.

The protocol spans six layers: an L1 PoW chain; an L2 DeFi bridge (wZION on Base) with staking,
farming, atomic swaps, and DAO governance; an L3 intelligence layer (WARP cross-chain swaps, NCL
distributed AI compute, and AI-native agents); and a long-horizon L4–L6 vision covering a UE5 game
world, a humanitarian foundation, and an orbital research program. Launched fairly with no ICO,
pre-sale, or insider allocation, ZION's entire stack is open-source under the MIT license.

---

## 2. Supply Information

| Field | Value |
|-------|-------|
| Maximum supply | **144,000,000,000 ZION** (hard cap, immutable) |
| Total supply | Mined emission + unlocked premine − burned fees (live, on-chain) |
| Circulating supply | Total supply − time-locked DAO Treasury (4B until block 525,600) |
| Mining emission | 127,220,000,000 ZION (88.35 %) over 100+ years |
| Genesis premine | 16,780,000,000 ZION (11.65 %), 14 transparent outputs |
| Decimals | 12 (native ZION); 18 (wZION ERC-20) |
| Inflation/emission | Decade Decay: −20 % per decade + perpetual tail 724.78 ZION/block |
| Fee policy | 100 % of transaction fees burned (deflationary) |

### Supply verification
ZION supply is verifiable on-chain through the node's JSON-RPC supply endpoint. CMC reviewers can
query total and circulating supply directly from a node. The 4B DAO Treasury premine is
time-locked in consensus (block 525,600, ~1 year post-genesis) and excluded from circulating
supply until unlock.

---

## 3. Technology Snapshot

| Property | Value |
|----------|-------|
| Block time | 60 seconds |
| Initial block reward | 5,400.067 ZION |
| Difficulty adjustment | LWMA (60-block window, ±25 % per block) |
| Mining algorithm | Ekam Deeksha — `deeksha_lite_v1` (canonical), `deeksha_lite_fire` (thermal GPU) |
| Hashing | BLAKE3 · Keccak-256 · SHA3-512 |
| Signatures | Ed25519 |
| Address format | Bech32 (`zion1…`) |
| Transaction model | UTXO + account model |
| Storage engine | LMDB |
| Codebase | Rust + Tokio · ~1,470 automated tests · external audit Q3 2026 |

---

## 4. Reward Distribution (per block)

| Recipient | Share |
|-----------|-------|
| Miners (PPLNS) | 89 % |
| Humanitarian Fund | 5 % |
| Science / Space (Issobella) Fund | 5 % |
| Pool operator | 1 % |

This 89/5/5/1 split is hardcoded in consensus and cannot be altered by governance.

---

## 5. Contract Addresses & Explorers

| Item | Value |
|------|-------|
| L1 genesis hash | `7543004c76b11416ef32e2f1f5a4c72f0178f841d4559bf476e29e15a9602728` |
| wZION (Base mainnet) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| Native ZION explorer | _provide public explorer URL_ |
| wZION on Base | verifiable on BaseScan |

> ZION is a native Layer-1 coin; wZION is its bridged ERC-20 representation on Base for DeFi
> liquidity. Please list ZION as a coin; wZION may be added as a separate bridged token.

---

## 6. Official Links (complete before submission)

| Type | URL |
|------|-----|
| Website | https://zionterranova.com |
| Whitepaper | `WHITEPAPER.md` (repository root) |
| Block explorer | _provide_ |
| Source code / GitHub | _provide public repo URL_ |
| Announcement / blog | _provide_ |
| Twitter / X | _provide_ |
| Telegram | _provide_ |
| Discord | _provide_ |
| Reddit | _provide_ |
| Message board / docs | `README.md`, `ZION_3.0.2_CANONICAL.md` |

---

## 7. Market & Liquidity (complete before submission)

| Field | Value |
|-------|-------|
| Listed exchanges | _provide CEX/DEX listings_ |
| Primary trading pair | wZION / (USDC or WETH) on Uniswap V3 (Base) |
| DEX liquidity pool | UniV3 wZION pool on Base |
| Mineable | Yes — public Stratum mining pool |
| Market maker | _provide if applicable_ |

---

## 8. Why ZION Qualifies

1. **Working, open-source Layer-1** with ~1,470 automated tests, not a whitepaper-only project.
2. **Novel, transparent tokenomics** — Decade Decay + perpetual tail + 100 % fee burn.
3. **Protocol-enforced social impact** — 10 % of every block reward to humanitarian and science
   funds, verifiable on-chain.
4. **Fair Launch** — no ICO, no pre-sale, no insider allocation; transparent premine.
5. **Real DeFi presence** — wZION bridged to Base with live Uniswap V3 liquidity, staking,
   farming, and DAO governance.

---

## 9. Compliance Note

ZION is open-source, experimental technology under the MIT license. It is not a security, not an
investment product, and not a licensed financial instrument. Token value is not guaranteed and may
decline to zero. This document is informational only and does not constitute financial advice.
