# ZION TerraNova — CoinMarketCap Listing Submission Packet

> Ready-to-submit data for listing **ZION** on CoinMarketCap. Information is sourced from the canonical v3.0.5 whitepaper, `StatusV3.md`, and live mainnet configuration.
>
> **Submit via:** https://support.coinmarketcap.com/hc/en-us/requests/new (select "Add an Asset / Update an Asset").

---

## 1. Basic Information

| Field | Value |
|-------|-------|
| Cryptocurrency name | ZION TerraNova |
| Symbol / ticker | **ZION** |
| Asset type | Coin (own Layer-1 blockchain) |
| Wrapped representation | **wZION** — ERC-20 on Base, BSC, Polygon, Arbitrum, Optimism, Avalanche; SPL on Solana; native asset on Stellar |
| Consensus mechanism | Proof-of-Work (Nakamoto-style) |
| Mining algorithm | Ekam Deeksha / CosmicHarmony — memory-hard, ASIC-resistant (`deeksha_lite_v1`) |
| Source code | Open source, MIT license |
| Mainnet genesis | **2026-07-06** (3.0.4 hard genesis reset); public launch scheduled **31 December 2026** |
| Country of origin | Decentralized open-source community |

### Project description (long form)
ZION TerraNova is an open-source, ASIC-resistant Proof-of-Work Layer-1 blockchain written from scratch in Rust. It was designed to solve four structural problems in cryptocurrency: ASIC centralization, insider pre-allocation, the absence of protocol-level social impact, and supply-shock volatility.

ZION's emission model — **Decade Decay** — replaces Bitcoin-style four-year halvings with a smooth −20 % reduction every ten years, anchored by a perpetual tail emission that secures the network indefinitely. **10 % of every block reward is automatically and immutably allocated to humanitarian (5 %) and scientific/space (5 %) funds**, enforced directly in the consensus code.

The protocol spans six layers: an L1 PoW chain; an L2 DeFi bridge (wZION on multiple EVM chains) with staking, farming, atomic swaps, and DAO governance; an L3 intelligence layer (WARP cross-chain swaps, NCL distributed AI compute, and AI-native agents); and a long-horizon L4–L6 vision covering a UE5 game world, a humanitarian foundation, and an orbital research program. Launched fairly with no ICO, pre-sale, or insider allocation, ZION's entire stack is open-source under the MIT license.

---

## 2. Supply Information

| Field | Value |
|-------|-------|
| Maximum supply | **144,000,000,000 ZION** (hard cap, immutable) |
| Total supply | Mined emission + unlocked premine − burned fees (live, on-chain) |
| Circulating supply | Total supply − time-locked DAO Treasury portion |
| Mining emission | ~127,220,000,000 ZION (~88.35 %) over 100+ years |
| Genesis premine | 16,780,000,000 ZION (~11.65 %), transparent on-chain outputs |
| Decimals | 6 (native ZION); 18 (wZION ERC-20); 6 (Solana/Stellar) |
| Inflation / emission | Decade Decay: −20 % per decade + perpetual tail ~724.78 ZION/block |
| Fee policy | 100 % of transaction fees burned (deflationary) |

### Supply verification
ZION supply is verifiable on-chain through the public RPC endpoint. Reviewers can query total and circulating supply directly from a node. The DAO Treasury portion of the premine is time-locked in consensus and excluded from circulating supply until unlock.

---

## 3. Technology Snapshot

| Property | Value |
|----------|-------|
| Block time | 60 seconds |
| Initial block reward | 5,400.067 ZION |
| Difficulty adjustment | LWMA (60-block window, ±25 % per block) |
| Mining algorithm | Ekam Deeksha — `deeksha_lite_v1` (canonical) |
| Hashing | BLAKE3 · Keccak-256 · SHA3-512 |
| Signatures | Ed25519 |
| Address format | Bech32 (`zion1…`) |
| Transaction model | Hybrid UTXO + account model |
| Storage engine | LMDB |
| Codebase | Rust + Tokio · ~1,500+ automated tests · external audit Q3 2026 |

---

## 4. Reward Distribution (per block)

| Recipient | Share |
|-----------|-------|
| Miners (PPLNS) | 89 % |
| Humanitarian Fund | 5 % |
| Science / Issobella Fund | 5 % |
| Pool fee (protocol-burned) | 1 % |

This 89/5/5/1 split is hardcoded in consensus and cannot be altered by governance.

---

## 5. Contract Addresses & Explorers

| Item | Value |
|------|-------|
| L1 genesis hash | `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` |
| Protocol version | `zion-v3-node/3.0.5` |
| Native ZION explorer | https://zionterranova.com/explorer |
| Public RPC | https://api.zionterranova.com |
| wZION (Base / BSC / Polygon / Arbitrum / Optimism / Avalanche) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| ZIONBridge (Base) | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` |
| ZIONBridge (other EVM chains) | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` |
| Solana SPL mint | `HgfQZpH2JAqPdR3PcP4dEE8WRhznXh1QhJBiiwcHfT8H` |
| Stellar asset | `ZION:GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT` |

> ZION is a native Layer-1 coin; wZION is its wrapped/bridged representation on EVM chains for DeFi liquidity. Please list **ZION** as the coin; wZION may be added as a separate wrapped token if required.

---

## 6. Official Links

| Type | URL |
|------|-----|
| Website | https://zionterranova.com |
| Block explorer | https://zionterranova.com/explorer |
| Whitepaper (EN) | https://raw.githubusercontent.com/Zion-TerraNova/v3-Mainnet/main/V3/docs/ZION_Mainnet_Whitepaper_v3.0.5_Canonical.md |
| Whitepaper (CZ) | https://raw.githubusercontent.com/Zion-TerraNova/v3-Mainnet/main/docs/WP-Mainet/ZION_Mainnet_Whitepaper_v3.0.5_CZ.md |
| Source code / GitHub | https://github.com/Zion-TerraNova/v3-Mainnet |
| Announcement / blog | https://zionterranova.com/blog (TBD) |
| Discord | https://discord.gg/zion-terranova |
| Telegram | https://t.me/zionterranova |
| Support email | support@zion-blockchain.org |
| Logo (PNG) | https://zionterranova.com/zion_logo.png |

---

## 7. Market & Liquidity (for CMC review)

| Field | Value |
|-------|-------|
| Listed DEX | Uniswap V4 on Base |
| wZION/USDT + wZION/WETH pool | `0xcCEaD51568E8d701f7db7e6699F3986031F07C7B` |
| Wrapped token contract | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` (Base, 18 decimals) |
| Mineable | Yes — public Stratum pool at `pool.zionterranova.com:8444` |
| CEX listings | TBD — initial liquidity via ZionDex / Uniswap V4 (Base) |
| Market maker | TBD |

> **Important:** CMC typically requires active trading volume and at least 3 liquid markets. ZionDex is live in beta; ensure the wZION pools have meaningful volume and liquidity before submitting, or the request may be deferred.

---

## 8. Why ZION Qualifies

1. **Working, open-source Layer-1** with ~1,500+ automated tests, not a whitepaper-only project.
2. **Novel, transparent tokenomics** — Decade Decay + perpetual tail + 100 % fee burn.
3. **Protocol-enforced social impact** — 10 % of every block reward to humanitarian and science funds, verifiable on-chain.
4. **Fair Launch** — no ICO, no pre-sale, no insider allocation; transparent premine.
5. **Real DeFi presence** — wZION bridged to Base with live Uniswap V4 liquidity, staking, farming, and DAO governance.

---

## 9. Compliance Note

ZION is open-source, experimental technology under the MIT license. It is not a security, not an investment product, and not a licensed financial instrument. Token value is not guaranteed and may decline to zero. This document is informational only and does not constitute financial advice.
