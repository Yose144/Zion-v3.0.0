# ZION TerraNova — CoinGecko Listing Submission Packet

> Ready-to-submit data for listing **ZION** on CoinGecko. Information is sourced from the canonical v3.0.5 whitepaper, `StatusV3.md`, and live mainnet configuration.
>
> **Submit via:** https://www.coingecko.com/en/methodology (or the CoinGecko "Request a Coin" form).

---

## 1. Project Identity

| Field | Value |
|-------|-------|
| Project name | ZION TerraNova |
| Coin / token name | ZION |
| Symbol / ticker | **ZION** |
| Asset type | Native Layer-1 coin (own blockchain) |
| Wrapped representation | **wZION** — ERC-20 on Base, BSC, Polygon, Arbitrum, Optimism, Avalanche; SPL on Solana; native asset on Stellar |
| Category | Proof-of-Work Layer-1, Mineable, DeFi, Cross-chain, AI, Social Impact |
| Launch model | Fair launch — no ICO, no pre-sale, no private round |
| License | MIT (open source) |
| Consensus | Proof-of-Work (Nakamoto-style) |
| Mining algorithm | Ekam Deeksha / CosmicHarmony — memory-hard, ASIC-resistant (`deeksha_lite_v1`) |
| Mainnet genesis | **2026-07-06** (3.0.4 hard genesis reset); public launch scheduled **31 December 2026** |

### One-line description
> ZION is a Rust-built, ASIC-resistant Proof-of-Work Layer-1 with a 100-year emission schedule and 10 % of every block reward hardcoded to humanitarian and science funding.

### Short description (≈ 300 chars)
> ZION TerraNova is an open-source, ASIC-resistant Proof-of-Work blockchain written in Rust. It replaces Bitcoin-style halvings with a smooth −20 %/decade "Decade Decay" model plus perpetual tail emission, and automatically directs 10 % of every block reward to humanitarian and scientific funds — enforced in consensus code.

---

## 2. Token Metrics

| Metric | Value |
|--------|-------|
| Maximum supply | **144,000,000,000 ZION** (hard cap, immutable) |
| Mining emission | ~127,220,000,000 ZION (~88.35 %) |
| Genesis premine | 16,780,000,000 ZION (~11.65 %), transparent on-chain outputs |
| Atomic unit | 1 ZION = 1,000,000 flowers (6 decimals) |
| Initial block reward | 5,400.067 ZION |
| Block time | 60 seconds |
| Emission schedule | Decade Decay: −20 % every 10 years (5,256,000 blocks) |
| Tail emission | 724.784723 ZION/block, perpetual from ~2126 |
| Fee model | 100 % of transaction fees burned (deflationary) |
| Reward split | 89 % miners / 5 % humanitarian / 5 % science / 1 % pool fee (burned) |

### Circulating supply methodology
Circulating supply = total mined coinbase emission to date plus unlocked genesis premine outputs, minus burned fees. The DAO Treasury portion of the premine is time-locked on-chain until ~1 year after genesis and should be treated as locked/non-circulating until then. Supply is verifiable via the public RPC endpoint.

---

## 3. Technology

| Property | Value |
|----------|-------|
| Codebase | Rust + Tokio async runtime |
| Hashing | BLAKE3 (general) · Keccak-256 / SHA3-512 (PoW pipeline) |
| Signatures | Ed25519 |
| Address format | Bech32 (`zion1…`) |
| Transaction model | Hybrid UTXO + account model |
| Difficulty adjustment | LWMA (60-block window, ±25 % per block) |
| Storage | LMDB |
| Test coverage | ~1,500+ automated tests across core, bridge, pool, miner, WARP |
| External audit | Scheduled Q3 2026 / continuous internal audits |

---

## 4. Architecture (6 layers)

| Layer | Description | Status |
|-------|-------------|--------|
| L1 | Core PoW chain (node, pool, miner) | Active Mainnet Beta |
| L2 | wZION bridge, DeFi, DAO, atomic swaps | Active |
| L3 | WARP cross-chain, NCL AI compute, AI-native API | Active |
| L4 | OASIS UE5 game world + XP economy | In preparation |
| L5 | Free World humanitarian/science foundation | Planned |
| L6 | Issobella orbital research | Long-term vision |

---

## 5. Chain & Contract Details

| Item | Value |
|------|-------|
| L1 genesis hash | `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` |
| Protocol version | `zion-v3-node/3.0.5` |
| Public RPC | `https://api.zionterranova.com` (nginx TCP proxy) |
| Public pool | `https://pool.zionterranova.com` (`62.171.141.136:8444`) |
| P2P seed | `pool.zionterranova.com:8333` |
| wZION (Base / BSC / Polygon / Arbitrum / Optimism / Avalanche) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| ZIONBridge (Base) | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` |
| ZIONBridge (other EVM chains) | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` |
| Solana SPL mint | `HgfQZpH2JAqPdR3PcP4dEE8WRhznXh1QhJBiiwcHfT8H` |
| Stellar asset | `ZION:GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT` |

> **Note for reviewers:** ZION is a native Layer-1 coin with its own blockchain and explorer. The ERC-20 **wZION** is a wrapped/bridged representation for DeFi liquidity. Please list **ZION** as the native Layer-1 coin; wZION may be added as a separate wrapped asset if required.

---

## 6. Official Links

| Type | URL |
|------|-----|
| Website | https://zionterranova.com |
| Block explorer | https://zionterranova.com/explorer |
| Dashboard | https://dashboard.zionterranova.com |
| Whitepaper (EN) | https://raw.githubusercontent.com/Zion-TerraNova/v3-Mainnet/main/V3/docs/ZION_Mainnet_Whitepaper_v3.0.5_Canonical.md |
| Whitepaper (CZ) | https://raw.githubusercontent.com/Zion-TerraNova/v3-Mainnet/main/docs/WP-Mainet/ZION_Mainnet_Whitepaper_v3.0.5_CZ.md |
| Source code | https://github.com/Zion-TerraNova/v3-Mainnet |
| GitHub org | https://github.com/Zion-TerraNova |
| Discord | https://discord.gg/zion-terranova |
| Telegram | https://t.me/zionterranova |
| Support email | support@zion-blockchain.org |
| Logo (PNG) | https://zionterranova.com/zion_logo.png |

---

## 7. Market & Liquidity (for CoinGecko review)

| Field | Value |
|-------|-------|
| DEX | Uniswap V4 on Base |
| wZION/USDT + wZION/WETH pool | `0xcCEaD51568E8d701f7db7e6699F3986031F07C7B` |
| Wrapped token | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` (Base, 18 decimals) |
| Mineable | Yes — public Stratum pool at `pool.zionterranova.com:8444` |
| CEX listings | TBD — first listings expected on ZionDex / Uniswap V4 (Base) |

---

## 8. Differentiators (why list ZION)

1. **Decade Decay emission** — a smoother alternative to halvings, designed for 100+ years of stable mining economics, with a perpetual tail.
2. **Protocol-enforced philanthropy** — 10 % of every block reward to humanitarian and science funds, hardcoded in consensus and unchangeable by governance.
3. **ASIC resistance** — multi-stage memory-hard PoW that keeps consumer CPUs/GPUs competitive.
4. **Fair Launch** — no ICO, no pre-sale, no insider allocation; transparent on-chain premine.
5. **Full six-layer stack** — L1 chain, L2 DeFi bridge, L3 cross-chain + AI compute, and a long-horizon L4–L6 roadmap, all open-source under MIT.

---

## 9. Compliance Note

ZION is open-source, experimental technology released under the MIT license. It is not a security, not an investment product, and not a licensed financial instrument. Token value is not guaranteed. This document is informational and does not constitute financial advice.
