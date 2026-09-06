# ZION TerraNova — CoinGecko Listing Application

> Submission packet for listing **ZION** on CoinGecko. All values are verified against the
> open-source `V31/` codebase and the live Edge node (height 28,500+ as of 2026-09-03).
> Internal infrastructure details (server IPs, keys, operational endpoints) are omitted.
>
> **Last verified: 2026-09-03** — V31 Mainnet Alpha, protocol `3.1.0-alpha`.

---

## 1. Project Identity

| Field | Value | Source |
|-------|-------|--------|
| Project name | ZION TerraNova | — |
| Token name | ZION | — |
| Ticker / symbol | **ZION** | — |
| Token type | Layer-1 native coin (own blockchain) | — |
| Wrapped token | wZION (ERC-20 on Base, 18 decimals) | `DeployBase.s.sol`, `warp.toml` |
| Category | Proof-of-Work Layer-1, Mining, DeFi, Cross-chain, Social-Impact | — |
| Launch model | No ICO, no pre-sale, no private round (premine of 11.65%) | `emission.rs` |
| License | MIT | `LICENSE` |
| Consensus | Proof-of-Work — EkamDeeksha (memory-hard) | `algorithm/ekam_deeksha.rs` |
| Protocol version | `3.1.0-alpha` (workspace `3.1.0-beta`) | live `getStatus` RPC |
| Mainnet genesis | 2026-08-06 (V31 "One Love" genesis reset) | `genesis.rs` |
| Public launch target | 31 December 2026 | `README.md`, app meta tags |

### What is the project about? (326 chars, CoinGecko ≤ 400 limit)
> ZION TerraNova is an open-source, memory-hard Proof-of-Work blockchain written in Rust. It
> replaces Bitcoin-style halvings with a smooth −20 %/decade "Decade Decay" emission model plus
> perpetual tail emission, and directs 10 % of every block reward to humanitarian and science
> funds — enforced in consensus code, not policy.

### What makes your project unique? (366 chars, CoinGecko ≤ 400 limit)
> ZION TerraNova combines a Decade Decay emission schedule (−20 % per decade instead of halvings)
> with protocol-enforced philanthropy: 5 % of every block reward goes to a humanitarian fund and
> 5 % to a science fund, hardcoded in consensus and unchangeable by governance. The chain is
> written in Rust, uses a memory-hard PoW (EkamDeeksha), and had no ICO or pre-sale.

---

## 2. Token Metrics

All values verified from `V31/L1/core/src/emission.rs` and live API `app.zionterranova.com/api/blockchain/stats`.

| Metric | Value | Source |
|--------|-------|--------|
| Maximum supply | **144,000,000,000 ZION** (hard cap) | `TOTAL_SUPPLY` const |
| Genesis premine | 16,780,000,000 ZION (11.65 %), 14 outputs | `GENESIS_PREMINE` const, `genesis.rs` |
| Mining emission | 127,220,000,000 ZION (88.35 %) | `MINING_EMISSION` const |
| Atomic unit | 1 ZION = 1,000,000 flowers (6 decimals) | `FLOWERS_PER_ZION` const |
| Initial block reward | 5,400.067 ZION (Decade 1) | `BASE_REWARD` const |
| Block time target | 60 seconds | `BLOCK_TIME_SECONDS` const |
| Emission schedule | Decade Decay: −20 % every 5,256,000 blocks (~10 years) | `BLOCKS_PER_DECADE`, `DECAY_NUMERATOR/DENOMINATOR` |
| Tail emission | ~724.785 ZION/block, perpetual (from decade 11, ~year 100) | `TAIL_REWARD` const |
| Reward split | 89 % miner / 5 % humanitarian / 5 % science / 1 % burned or node reward | `fee_split()` fn |
| Coinbase maturity | 100 blocks | `COINBASE_MATURITY` const |
| Mined supply (live) | ~153,940,000 ZION (height 28,500+) | live API |
| Circulating supply (live) | ~16,933,940,000 ZION (premine + mined) | live API |

### Fee model
The 1 % pool-fee portion of each block subsidy is **not minted** (burned) before the node-reward
soft-fork activation. After activation, it is minted to a canonical node reward pool address and
distributed to full nodes. Transaction fees are collected by the miner as part of the coinbase
reward. (`emission.rs` lines 65–71, `chain_state.rs` lines 1049–1065.)

### Circulating supply methodology
Circulating supply = mined coinbase emission to date + unlocked premine outputs − burned fees.
All 14 genesis premine outputs are **admin-locked** (require 3-of-3 admin multisig + DAO vote to
transfer). Additionally, 3 DAO treasury outputs (totaling 4.0B ZION: 2.5B + 1.0B + 0.5B) are
**time-locked** until block 144,000 (~100 days at 60 s block time). These locked premine outputs
should be treated as **non-circulating** until unlocked. (`v3_compat.rs` lines 397–628,
`DAO_TREASURY_LOCK_HEIGHT = 144_000`.)

Supply is verifiable via the public API:
`https://app.zionterranova.com/api/blockchain/stats`

### Premine distribution (14 outputs, verified from `genesis.rs`)

| # | Amount (B ZION) | Label (from richlist API) | Lock |
|---|-----------------|---------------------------|------|
| 1–5 | 1.65 each | ZION OASIS + Winners Golden Egg/XP (Slots 1–5) | admin-locked |
| 6 | 2.50 | DAO Treasury — Community Governance | time-locked (blk 144k) + admin-locked |
| 7 | 1.00 | DAO Treasury — Grants & Bounties | time-locked (blk 144k) + admin-locked |
| 8 | 0.50 | DAO fund | time-locked (blk 144k) + admin-locked |
| 9 | 1.00 | Network Infrastructure — P2P Seed Nodes | admin-locked |
| 10 | 1.00 | Core Development Fund | admin-locked |
| 11 | 0.59 | (ecosystem) | admin-locked |
| 12 | 1.44 | Children Future Fund — Humanitarian DAO | admin-locked |
| 13 | 0.40 | (ecosystem) | admin-locked |
| 14 | 0.10 | (ecosystem) | admin-locked |
| **Total** | **16.78** | | |

---

## 3. Technology

All values verified from source code.

| Property | Value | Source |
|----------|-------|--------|
| Codebase language | Rust + Tokio async runtime | `Cargo.toml` |
| Mining algorithm | EkamDeeksha (memory-hard) | `algorithm/ekam_deeksha.rs` |
| Scratchpad size | 512 KiB (16,384 blocks × 32 B) | `SCRATCHPAD_SIZE` const |
| Random reads | 128 | `RANDOM_READS` const |
| AES rounds | 2 (AES-128 CTR mix) | `AES_ROUNDS` const |
| Hashing | Keccak-256 (header) · SHA3-512 (scratchpad fill) · BLAKE3 (general) | `deeksha.rs`, `lib.rs` |
| Signatures | Ed25519 | `utxo.rs` |
| Address format | Bech32 (`zion1…`) | `Address` type |
| Transaction model | Hybrid UTXO + account model | `getStatus` RPC (`transaction_model: "hybrid"`) |
| Difficulty adjustment | LWMA, 60-block window, ±50 % per-block clamp, solve-time clamp 6–360 s | `difficulty.rs` |
| Storage | SQLite (rusqlite) | `storage.rs` |
| Test coverage | ~1,900 automated tests (V31 workspace, excluding target/archive) | `grep -r "#\[test\]"` |
| External audit | Not yet scheduled | — |

---

## 4. Architecture (6 layers)

| Layer | Description | Status |
|-------|-------------|--------|
| L1 | Core PoW chain (node, pool, miner) | Active — Mainnet Alpha, height 28,500+ |
| L2 | wZION bridge (Base), DAO governance, HTLC, atomic swaps | Active |
| L3 | WARP cross-chain router, ZionDex (DEX), AI compute | Active |
| L4 | OASIS UE5 game world + XP economy | In preparation |
| L5 | Free World humanitarian fund (on-chain coinbase tracking) | Active |
| L6 | Issobella science/space fund (on-chain coinbase tracking) | Active |

### Merged mining (AuxPoW)
The pool supports merged mining with ZANO (ProgPoW) and VRSC (VerusHash). Verified from live pool
stats: `"auxpow":{"coins":["ZANO","VRSC"],"enabled":true}`.

---

## 5. Contract / Explorer Details

All values verified from source code and live chain.

| Item | Value | Source |
|------|-------|--------|
| L1 genesis hash (V31 native) | `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb` | live `getBlockByHeight(0)` |
| L1 genesis hash (V3 compat) | `4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71` | `genesis.rs` doc comment |
| wZION (Base mainnet, chain 8453) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | `DeployBase.s.sol`, `warp.toml` |
| wZION decimals | 18 (ERC-20 standard) | Solidity contract |
| Native ZION decimals | 6 (flowers) | `FLOWERS_PER_ZION` const |
| Block explorer | https://app.zionterranova.com/explorer | live (HTTP 200, title "Explorer · ZION v3.2.0") |
| Public RPC | `rpc.zionterranova.com:8443` (TCP proxy → localhost:9445) | live |
| Public mining pool | `62.171.141.136:8444` (Stratum) | live |
| Blockchain stats API | https://app.zionterranova.com/api/blockchain/stats | live (JSON) |

> **Note for reviewers:** ZION is a native Layer-1 coin with its own blockchain and explorer; the
> ERC-20 **wZION** is a bridged representation on Base for DeFi liquidity. Please list ZION as a
> Layer-1 coin and (optionally) wZION as a separate bridged asset.

---

## 6. Links

All URLs verified live on 2026-09-03.

| Type | URL | Status |
|------|-----|--------|
| Website (intro, CZ) | https://zionterranova.com | 200 OK — "ZION TerraNova ® OASIS" |
| Web app (EN/CZ) | https://app.zionterranova.com | 200 OK — "ZION Blockchain v3.2.0 One Love" |
| Marketplace | https://market.zionterranova.com | 200 OK — "ZION Market — OASIS Artifact Marketplace" |
| Block explorer | https://app.zionterranova.com/explorer | 200 OK |
| Auth (ZIS) | https://auth.zionterranova.com | live (`/health` returns OK) |
| Source code (public) | https://github.com/Zion-TerraNova/v3-Mainnet | 200 OK |
| Documentation | `README.md`, `V31/README.md`, `ROADMAP.md` | in repo |
| Twitter / X | _to be provided_ | — |
| Telegram | _to be provided_ | — |
| Discord | _to be provided_ | — |
| Email | _to be provided_ | — |

---

## 7. Differentiators

1. **Decade Decay emission** — block reward decreases by 20 % every 10 years (5,256,000 blocks)
   instead of Bitcoin-style halvings, with a perpetual tail emission of ~724.785 ZION/block after
   decade 10. (`emission.rs`)
2. **Protocol-enforced philanthropy** — 5 % of every block reward goes to a humanitarian fund and
   5 % to a science fund, hardcoded in the `fee_split()` consensus function. This cannot be
   changed by governance or admin action. (`emission.rs` lines 57–63)
3. **Memory-hard PoW** — EkamDeeksha uses a 512 KiB scratchpad with 128 random reads and 2 AES
   rounds, designed to keep consumer hardware competitive. (`algorithm/ekam_deeksha.rs`)
4. **Merged mining** — the pool supports AuxPoW merged mining with ZANO and VRSC, allowing miners
   to earn multiple coins simultaneously. (live pool stats)
5. **Full six-layer stack** — L1 chain, L2 DeFi/bridge/DAO, L3 cross-chain + DEX, L4 game world,
   L5 humanitarian, L6 science — all open-source under MIT.

---

## 8. Compliance Note

ZION is open-source, experimental technology released under the MIT license. It is not a security,
not an investment product, and not a licensed financial instrument. Token value is not guaranteed.
This document is informational and not financial advice.
