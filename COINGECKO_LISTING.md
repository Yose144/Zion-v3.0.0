# ZION TerraNova — CoinGecko Listing Submission

> **Status:** Mainnet Beta (2026-07-06 genesis reset) · **Public launch target:** 31 December 2026  
> **Submitted by:** ZION TerraNova Core Team · **Contact:** support@zion-blockchain.org

---

## 1. Project Identity

| Field | Value |
|-------|-------|
| **Coin name** | ZION TerraNova |
| **Ticker / Symbol** | **ZION** |
| **Asset type** | Native Layer-1 Coin (own blockchain) |
| **Wrapped representation** | wZION (ERC-20 on Base, BSC, Polygon, Arbitrum, Optimism, Avalanche) |
| **Category** | Mineable, Proof-of-Work, DeFi, Cross-chain, AI, Social Impact |
| **Consensus** | Proof-of-Work (Nakamoto) — Ekam Deeksha v2 / CosmicHarmony (memory-hard, ASIC-resistant) |
| **License** | MIT (open source) |
| **Launch model** | Fair Launch — no ICO, no pre-sale, no private round, no VC allocation |
| **Genesis date** | 2026-07-06 (3.0.4 Hard Genesis Reset) |
| **Public launch** | 2026-12-31 |

---

## 2. Token Metrics

| Metric | Value |
|--------|-------|
| **Max supply (hard cap)** | 144,000,000,000 ZION |
| **Mining emission** | 127,220,000,000 ZION (88.35%) |
| **Genesis premine** | 16,780,000,000 ZION (11.65%) — 14 transparent on-chain outputs |
| **Atomic unit** | 1 ZION = 1,000,000 flowers (6 decimals) — *post 3.0.3 decimal fork* |
| **Initial block reward** | 5,400.067 ZION |
| **Block time** | 60 seconds |
| **Emission schedule** | **Decade Decay**: −20% every 10 years (5,256,000 blocks) |
| **Tail emission** | 724.784723787776 ZION/block, perpetual from ~2126 |
| **Fee model** | 100% of transaction fees burned (deflationary) |
| **Reward split (per block)** | 89% miners / 5% Humanitarian Fund / 5% Issobella Science Fund / 1% pool fee (burned) |

### Circulating Supply Methodology
Circulating supply = mined coinbase emission to date + unlocked premine outputs − burned fees.  
The 4B DAO Treasury premine is time-locked until ~1 year post-genesis (block 525,600) and excluded from circulating supply until unlock.  
Supply is verifiable on-chain via RPC `getSupply` endpoint.

---

## 3. Technology

| Property | Detail |
|----------|--------|
| **Codebase** | Rust + Tokio async runtime |
| **Hashing** | BLAKE3 (general), Keccak-256 / SHA3-512 (PoW pipeline) |
| **Signatures** | Ed25519 |
| **Address format** | Bech32 (`zion1…`) |
| **Transaction model** | Hybrid UTXO + Account model |
| **Difficulty adjustment** | LWMA (60-block window, ±25% per block) |
| **Storage** | LMDB |
| **Test coverage** | ~1,500 automated tests across core, bridge, pool, miner, WARP |
| **External audit** | Scheduled Q3 2026 |

---

## 4. Architecture — 6 Layers

| Layer | Description | Status |
|-------|-------------|--------|
| **L1** | Core PoW chain (node, pool, miner) | Active Mainnet Beta |
| **L2** | wZION bridge, DeFi (staking, farming, atomic swaps), DAO governance | Active |
| **L3** | WARP cross-chain, NCL distributed AI compute, AI-native API | Active |
| **L4** | OASIS UE5 game world + XP economy | In preparation |
| **L5** | Free World humanitarian/science foundation | Planned (2030) |
| **L6** | Issobella orbital research | Long-term vision (2040+) |

---

## 5. Live Network Endpoints (2026-07-13)

| Service | URL |
|---------|-----|
| **Website** | https://zionterranova.com |
| **Block explorer** | https://zionterranova.com/explorer |
| **Dashboard** | https://dashboard.zionterranova.com |
| **Public RPC** | `rpc.zionterranova.com:8443` (nginx TCP proxy) |
| **Public mining pool** | `pool.zionterranova.com:8444` (Stratum) |
| **P2P seed** | `pool.zionterranova.com:8333` |
| **Edge server** | `62.171.141.136` (Ubuntu 24.04, 4× AMD EPYC, 7.8 GB RAM) |

---

## 6. Contract Addresses (EVM — all verified on Basescan)

| Contract | Base Mainnet (8453) | Other EVM Chains (same deterministic address) |
|----------|---------------------|-----------------------------------------------|
| **wZION** | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | BSC, Polygon, Arbitrum, Optimism, Avalanche |
| **ZIONBridge** | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` |
| **ZIONGovernance** | `0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8` | — |
| **ZIONTreasury** | `0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD` (3-of-3 multisig) | — |
| **ZIONStaking** | `0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B` (12% APR, 100K wZION) | — |
| **ZIONFarm** | `0x167B2753F5D8D9F8e62875cc9e379d7804308B08` (500K wZION) | — |
| **ZIONAtomicSwap** | `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` | — |

> **Note:** ZION is a native Layer-1 coin. wZION is its wrapped/bridged ERC-20 representation for DeFi liquidity. Please list ZION as a coin; wZION may be added as a separate wrapped asset if required.

---

## 7. Non-EVM Deployments

| Chain | Asset / Contract | Details |
|-------|-----------------|---------|
| **Solana** | SPL Token mint `HgfQZpH2JAqPdR3PcP4dEE8WRhznXh1QhJBiiwcHfT8H` | 1B supply, 6 decimals, deployed 2026-07-13 |
| **Stellar** | Native asset `ZION:GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT` | 6 decimals (stroops), Home domain `zionterranova.com`, deployed 2026-07-13 |

---

## 8. Liquidity & Markets

| Market | Pair | Contract / Pool | Status |
|--------|------|-----------------|--------|
| **Uniswap V4 (Base)** | wZION / USDT + wZION / WETH | `0xcCEaD51568E8d701f7db7e6699F3986031F07C7B` | Live, concentrated liquidity |
| **ZionDex (L3 WARP)** | Cross-chain AMM router | `https://zionterranova.com/dex-api` | Beta |
| **CEX listings** | — | — | Targeting post public launch (2026-12-31) |

---

## 9. Social & Community

| Platform | Link |
|----------|------|
| **GitHub (public)** | https://github.com/Zion-TerraNova/v3-Mainnet |
| **GitHub (private)** | https://github.com/Yose144/Zion-v3.0.0 |
| **Discord** | https://discord.gg/zion-terranova |
| **Telegram** | https://t.me/zionterranova |
| **Twitter / X** | https://x.com/ZionTerraNova |
| **Bitcointalk ANN** | [To be posted on Mainnet Beta day] |
| **Email** | support@zion-blockchain.org |

---

## 10. Differentiators (Why List ZION)

1. **Decade Decay emission** — smoother alternative to halvings, 100+ year mining economics with perpetual tail.
2. **Protocol-enforced philanthropy** — 10% of every block reward to humanitarian (5%) and science/space (5%) funds, hardcoded, unchangeable by governance.
3. **ASIC resistance** — Ekam Deeksha v2 / CosmicHarmony memory-hard PoW keeps consumer CPUs/GPUs competitive.
4. **Fair Launch** — no ICO, no pre-sale, no insider allocation; transparent 14-output premine on-chain.
5. **Full six-layer stack** — L1 chain, L2 DeFi/bridge/DAO, L3 cross-chain+AI, L4–L6 visionary roadmap, all open-source.

---

## 11. Compliance Note

ZION is open-source, experimental technology released under the MIT license. It is not a security, not an investment product, and not a licensed financial instrument. Token value is not guaranteed. This submission is informational and does not constitute financial advice.

---

## 12. Verification Assets (for CoinGecko team)

- **Genesis block:** `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`
- **RPC supply endpoint:** `curl -X POST https://rpc.zionterranova.com:8443/jsonrpc -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getSupply","params":{}}'`
- **Whitepaper (canonical v3.0.5 EN):** `V3/docs/ZION_Mainnet_Whitepaper_v3.0.5_Canonical.md`
- **Whitepaper (canonical v3.0.5 CZ):** `docs/WP-Mainet/ZION_Mainnet_Whitepaper_v3.0.5_CZ.md`
- **Status doc:** `StatusV3.md`
- **Roadmap:** `V3/ROADMAP.md`
- **Contract verification:** All 7 Base contracts verified on Basescan (see `docs/3.0.4/BASESCAN_VERIFY_REPORT.md`)

---

*Submitted with ⛏️ by the ZION TerraNova Core Team*  
*Last updated: 2026-07-13*