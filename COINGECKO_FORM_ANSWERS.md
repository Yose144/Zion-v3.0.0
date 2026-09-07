# CoinGecko Submission — Form Answers

> Ready-to-paste answers for https://www.coingecko.com/en/coins/new
> All texts > 400 characters where the form requires it. Last updated: 2026-09-07.

## Quick fields

| Field | Value |
|-------|-------|
| Coin name | ZION TerraNova |
| Ticker | ZION |
| Website | https://zionterranova.com |
| Explorer | https://app.zionterranova.com/explorer |
| GitHub | https://github.com/Zion-TerraNova/v3-Mainnet |
| Supply API | https://app.zionterranova.com/api/blockchain/stats |
| Listing feed | https://app.zionterranova.com/api/listing/coingecko |
| Logo 200×200 | https://app.zionterranova.com/brand/zion/icon-on-dark-200.png |
| Logo 64×64 | https://app.zionterranova.com/brand/zion/icon-on-dark-64.png |
| Algorithm | EkamDeeksha (memory-hard PoW) |
| Consensus | Proof of Work |
| Max supply | 144,000,000,000 |
| Genesis date | 2026-08-06 |
| Exchange Trade URL | https://www.geckoterminal.com/base/pools/0x186b46c2f04153999d44D25179cD623fD62Bfda2 |
| Contract (wZION, Base) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |

## 1. What is the project about? (657 chars)

ZION TerraNova is an open-source, memory-hard Proof-of-Work Layer-1 blockchain written from scratch in Rust, live on mainnet since August 2026. Instead of Bitcoin-style halvings it uses a smooth Decade Decay emission schedule (-20% per decade) plus a perpetual tail emission, so mining never ends. Ten percent of every block reward is hardcoded to humanitarian and science funds - enforced by consensus code, not policy. The ecosystem spans six layers: L1 chain, L2 DeFi/bridge/DAO, L3 cross-chain DEX, L4 OASIS world, L5 humanitarian projects and L6 science. A bridged ERC-20 representation, wZION, trades on Uniswap V3 (Base) with live on-chain liquidity.

## 2. What makes your project unique? (659 chars)

ZION combines three things no other PoW chain offers together: (1) Decade Decay emission - a smooth -20% reward reduction per decade instead of abrupt halvings, plus a perpetual tail emission so miners are rewarded forever; (2) protocol-enforced philanthropy - 5% of every block reward goes to a humanitarian fund and 5% to a science fund, hardcoded in consensus and unchangeable by any governance vote or admin key; (3) the EkamDeeksha memory-hard algorithm (512 KiB scratchpad, AES rounds) that keeps consumer CPU/GPU mining competitive, with AuxPoW merged mining alongside ZANO and VRSC. The entire codebase is MIT-licensed Rust with no ICO and no presale.

## 3. History of your project? (683 chars)

Development began in 2025 as an open-source Proof-of-Work chain built entirely from scratch in Rust - no fork of Bitcoin or any existing codebase, no ICO, no presale, no VC allocation. Through 2025-2026 the project iterated through public testnets and several documented genesis resets while the protocol was hardened: LWMA difficulty retargeting, a 6-decimal atomic unit (flowers), Ed25519 signatures and Bech32 addresses. On 2026-08-06 the 'One Love' genesis launched the current mainnet-alpha chain (protocol 3.1.0) with 14 transparent premine outputs totaling 16.78B ZION. The wZION ERC-20 bridge to Base followed, with a live Uniswap V3 wZION/USDT pool tracked on GeckoTerminal.

## 4. What's next for your project? (563 chars)

The immediate roadmap leads to the public launch targeted for 31 December 2026: an external security audit, a larger seed and validator network, activation of the protocol-level node-reward system (1% of block subsidy routed to full nodes), and growth of the public mining pool. In parallel the project is building the L4 OASIS world, deploying the L5 humanitarian program funded by a dedicated 3.3B ZION on-chain allocation, deepening wZION liquidity on Base and other EVM chains, and pursuing tracker and exchange listings including CoinGecko and CoinMarketCap.

## 5. What can your coin/token be used for? (600 chars)

ZION is the native coin of its own Layer-1 chain. It pays transaction fees, rewards Proof-of-Work miners and - after the scheduled activation - full node operators from a dedicated 1% block subsidy. It is the governance asset of the DAO treasury (4.0B ZION in time-locked community, grants and ecosystem funds). The bridged wZION (ERC-20 on Base) enables DeFi trading and liquidity. Within the ecosystem ZION powers the OASIS world economy and the artifact marketplace, and on-chain it funds L5 humanitarian projects and the L6 science program - 10% of every block flows to these funds automatically.

---

## 7. Coin Holders & Distribution Schedule

| Field | Value |
|-------|-------|
| **Top Holder List Url** | https://app.zionterranova.com/explorer/richlist |
| **Distribution Schedule** | https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/LEGAL/PREMINE_DISCLOSURE.md |

(Další veřejný zdroj distribuce: https://app.zionterranova.com/genesis a https://app.zionterranova.com/explorer/supply)

## 8. Coin/Token Supply Information

| Field | Value |
|-------|-------|
| **Token Generation Date (TGE)** | **2026-08-06** (V31 "One Love" genesis) |
| **Max Supply Amount** | **144,000,000,000** |
| **Is Infinite Supply** | ❌ NE — hard cap 144B (tail emission se do capu vejde) |

## 9. Total Supply

| Field | Value |
|-------|-------|
| **Total Supply Amount** | **144,000,000,000** (fixed cap; dosud vytěženo ~181.8M + premine 16.78B) |
| **Total Supply API** | https://app.zionterranova.com/api/supply/total → `144000000000` |
| **Burned Wallet** | `zion1l0h428f536s6u3x7h5f0d5c2z644j7t8u8va3x0` (canonical pool-fee burn address) |

> Poznámka pro pole Burned Wallet: 1% podíl z každého bloku se do ledgeru vůbec nemintuje (burned at source) + transakční fees se pálí. Adresa výše je kanonická burn adresa protokolu.

## 10. Circulating Supply

| Field | Value |
|-------|-------|
| **Circulating Supply Amount** | **16,961,804,055** (live; roste o ~5,400 ZION/blok) |
| **Circulating Supply API** | https://app.zionterranova.com/api/supply/circulating → plain number |
| **Vested/Locked Wallets** | DAO Treasury — 3 adresy, time-locked do bloku 144,000 (~100 dnů): |

Vested/Locked wallets (přidat jednotlivě přes "Add Vested/Locked Wallet"):

| Address | Amount | Lock |
|---------|--------|------|
| `zion1f5h5k6t8q3t3d8c5y667z6p2x8t3y3p8c7633g5` | 2,500,000,000 | time-locked → block 144,000 |
| `zion1s27490u7n823g098w42077h8f2n824w0y75w0s3` | 1,000,000,000 | time-locked → block 144,000 |
| `zion1n0r7k274z3t030h4v4g3g5h704c737z658aa238` | 500,000,000 | time-locked → block 144,000 |

Volitelně další admin-locked premine adresy (všechny vyžadují 3-of-3 admin multisig + DAO vote):

| Address | Amount | Purpose |
|---------|--------|---------|
| `zion1s0t7f8q680t4h6v7g240p4k7g2s0a4z8g3cc5h5` | 1,650,000,000 | OASIS reward pool 1 |
| `zion1s7x735r6v86485k7t36008l682g777g3q8pu3q0` | 1,650,000,000 | OASIS reward pool 2 |
| `zion1e0f4h6w3w394d4p355z2r440k4s2f6v5h4rl8f4` | 1,650,000,000 | OASIS reward pool 3 |
| `zion1h7r3v595y3g0z3e3l8p005h4c6l7l6s4s2xh708` | 1,650,000,000 | L5 Free World reserve |
| `zion1x535z563d3p6r6u3v6x0g0y445f507w8h6g8388` | 1,650,000,000 | L5 Free World projects |
| `zion1k752909323x66062k5j7074096f003z095ax8m7` | 1,000,000,000 | Core dev fund |
| `zion1z3a4w726w5u4r4s4z644s8p897v4a2k045rt706` | 1,000,000,000 | Seed nodes fund |
| `zion122v8f8g55398f4g884k7j482h3z845j6c6ta4f8` | 590,000,000 | Genesis projects |
| `zion1h6644748u5x6p4p784n6g2l7j77625w6a0k80s8` | 1,440,000,000 | Children Future Fund |
| `zion1t6z3c0f0p3h0v233a3h432k5h764j0r3n5ml756` | 400,000,000 | Bridge seed fund |
| `zion1j3w3h7k8m635h734y786j5804305m822t5uk546` | 100,000,000 | Bridge vault UTXO |

## 11. Initial Token Allocation

Alokace genesis premine (% z max supply 144B; TGE % = podíl uvolněný při TGE):

| # | Allocation Name | % of max supply | TGE % | Cliff (měs.) | Vesting (měs.) | Release Schedule |
|---|-----------------|-----------------|-------|--------------|----------------|------------------|
| 1 | OASIS Reward Pool | 3.44% | 100% (on-chain locked) | 0 | 0 | Programmatic distribution over ~10 years via OASIS reward contract |
| 2 | L5 Free World Projects | 2.29% | 100% (on-chain locked) | 0 | 0 | DAO-governed release to humanitarian projects |
| 3 | DAO Treasury | 2.78% | 0% | ~3.3 (block 144,000) | 0 | Full unlock at cliff; then DAO-vote controlled |
| 4 | Infrastructure & Core Dev | 1.80% | 100% (admin-locked) | 0 | 0 | 3-of-3 multisig + DAO vote per spend |
| 5 | Children Future Fund | 1.00% | 100% (admin-locked) | 0 | 0 | DAO-governed humanitarian release |
| 6 | Bridge Liquidity Funds | 0.35% | 100% (admin-locked) | 0 | 0 | Used for EVM bridge liquidity |
| 7 | Public Mining Emission | 88.35% | 0% | 0 | ~1,200 | Continuous PoW emission, Decade Decay −20%/decade + perpetual tail |

## 12. Additional Supply Information

```
ZION is a PoW chain, not a minted token: 88.35% of max supply (127.22B) is
emitted only through mining over ~100+ years via Decade Decay (-20%/decade)
plus perpetual tail emission (~724.785 ZION/block). The genesis premine
(16.78B, 11.65%) consists of 14 transparent on-chain outputs - all publicly
listed in the distribution document. 3 DAO treasury outputs (4.0B) are
time-locked until block 144,000; all premine outputs additionally require
3-of-3 admin multisig plus DAO governance approval to move. Under a strict
methodology the currently unlocked circulating supply equals mined emission
(~181.8M ZION); our API reports premine+mined since all outputs are
transparently disclosed and on-chain verifiable. The 1% pool-fee share of
each block is never minted (burned at source) and all transaction fees are
burned, making supply mildly deflationary. wZION (ERC-20 on Base) is a 1:1
bridged representation, not additional issuance.
```

(≈1,190 znaků — zkrať dle limitu pole)
