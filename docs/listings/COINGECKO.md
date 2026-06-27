# ZION TerraNova — CoinGecko Listing Application

> Submission packet for listing **ZION** on CoinGecko. All values are sanitized for public
> disclosure and grounded in the open-source `V3/` codebase. Internal infrastructure details
> (server IPs, keys, operational endpoints) are intentionally omitted.

---

## 1. Project Identity

| Field | Value |
|-------|-------|
| Project name | ZION TerraNova |
| Token name | ZION |
| Ticker / symbol | **ZION** |
| Token type | Layer-1 native coin (own blockchain) |
| Wrapped token | wZION (ERC-20 on Base) |
| Category | Proof-of-Work Layer-1, Mining, DeFi, AI, Social-Impact |
| Launch model | Fair Launch (no ICO, no pre-sale, no private round) |
| License | MIT (open source) |
| Consensus | Proof-of-Work (Nakamoto) |
| Mainnet genesis | 31 December 2026 |

### One-line description
> ZION is a Rust-built, ASIC-resistant Proof-of-Work Layer-1 with a 100-year "Decade Decay"
> emission schedule and 10 % of every block reward hardcoded to humanitarian and science funding.

### Short description (≈ 300 chars)
> ZION TerraNova is an open-source, ASIC-resistant Proof-of-Work blockchain written in Rust. It
> replaces Bitcoin-style halvings with a smooth −20 %/decade "Decade Decay" model plus a perpetual
> tail emission, and automatically directs 10 % of every block reward to humanitarian and
> scientific funds — enforced in consensus code, not policy.

---

## 2. Token Metrics

| Metric | Value |
|--------|-------|
| Maximum supply | **144,000,000,000 ZION** (hard cap, immutable) |
| Mining emission | 127,220,000,000 ZION (88.35 %) |
| Genesis premine | 16,780,000,000 ZION (11.65 %), 14 transparent outputs |
| Atomic unit | 1 ZION = 1,000,000 flowers (6 decimals) *(updated to 6-decimal in 3.0.3 fork)* |
| Initial block reward | 5,400.067 ZION |
| Block time | 60 seconds |
| Emission schedule | Decade Decay: −20 % every 10 years (5,256,000 blocks) |
| Tail emission | 724.784723787776 ZION/block, perpetual (from ~2126) |
| Fee model | 100 % burned (deflationary) |
| Reward split | 89 % miners / 5 % humanitarian / 5 % science / 1 % pool |

### Circulating supply methodology
Circulating supply = total mined coinbase emission to date **plus** unlocked genesis premine
outputs, **minus** burned fees. The 4B DAO Treasury premine is time-locked on-chain until ~1 year
after genesis (block 525,600) and should be treated as **locked / non-circulating** until then.
Supply is independently verifiable via the node's JSON-RPC supply endpoint.

---

## 3. Technology

| Property | Value |
|----------|-------|
| Codebase language | Rust + Tokio async runtime |
| Mining algorithm | Ekam Deeksha (memory-hard, ASIC-resistant) — `deeksha_lite_v1` / `deeksha_lite_fire` |
| Hashing | BLAKE3 (general) · Keccak-256 / SHA3-512 (PoW pipeline) |
| Signatures | Ed25519 |
| Address format | Bech32 (`zion1…`) |
| Transaction model | UTXO + account model |
| Difficulty adjustment | LWMA (60-block window, ±25 % per block) |
| Storage | LMDB |
| Test coverage | ~1,470 automated tests |
| External audit | Scheduled Q3 2026 |

---

## 4. Architecture (6 layers)

| Layer | Description | Status |
|-------|-------------|--------|
| L1 | Core PoW chain (node, pool, miner) | Active |
| L2 | wZION bridge, DeFi, DAO, atomic swaps | Active |
| L3 | WARP cross-chain, NCL AI compute, AI-native | Active |
| L4 | OASIS UE5 game world + XP economy | In preparation |
| L5 | Free World humanitarian/science foundation | Planned (2030) |
| L6 | Issobella orbital research | Planned (2040+) |

---

## 5. Contract / Explorer Details

| Item | Value |
|------|-------|
| L1 genesis hash | `7543004c76b11416ef32e2f1f5a4c72f0178f841d4559bf476e29e15a9602728` |
| wZION (Base mainnet) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| wZION decimals | 18 (ERC-20 standard) |
| Native ZION decimals | 12 (flowers) |

> **Note for reviewers:** ZION is a native Layer-1 coin with its own blockchain and explorer; the
> ERC-20 **wZION** is a bridged representation on Base for DeFi liquidity. Please list ZION as a
> Layer-1 coin and (optionally) wZION as a separate bridged asset.

---

## 6. Links (to be completed by the team before submission)

| Type | URL |
|------|-----|
| Website | https://zionterranova.com |
| Whitepaper | `WHITEPAPER.md` (repository root) |
| Source code | Open-source ZION TerraNova repository (`V3/` mainnet line) |
| Block explorer | _provide public explorer URL_ |
| Documentation | `README.md`, `ZION_3.0.2_CANONICAL.md`, `ROADMAP.md` |
| Twitter / X | _provide_ |
| Telegram | _provide_ |
| Discord | _provide_ |
| GitHub | _provide public repo URL_ |

---

## 7. Differentiators (why list ZION)

1. **Decade Decay emission** — a smoother alternative to halvings, designed for 100+ years of
   stable mining economics, with a perpetual tail.
2. **Protocol-enforced philanthropy** — 10 % of every block reward to humanitarian and science
   funds, hardcoded in consensus and unchangeable by governance.
3. **ASIC resistance** — a multi-stage memory-hard PoW that keeps consumer CPUs/GPUs competitive.
4. **Fair Launch** — no ICO, no pre-sale, no insider allocation; transparent on-chain premine.
5. **Full six-layer stack** — L1 chain, L2 DeFi bridge, L3 cross-chain + AI compute, and a
   long-horizon L4–L6 roadmap, all open-source under MIT.

---

## 8. Compliance Note

ZION is open-source, experimental technology released under the MIT license. It is not a security,
not an investment product, and not a licensed financial instrument. Token value is not guaranteed.
This document is informational and not financial advice.
