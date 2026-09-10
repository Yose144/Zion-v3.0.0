# CoinGecko Re-listing Roadmap 2026–2027

> Original rejection (CoinGecko support, 2026-09-10):  
> *"The project does not currently meet our evaluation metrics."*  
> Evaluation areas explicitly named: **Trading Liquidity**, **Project Maturity**, **Team Presence**.
>
> This document is a tactical, measurable roadmap to satisfy those three areas before resubmitting to CoinGecko.

---

## Executive Summary

CoinGecko does not publish exact thresholds, but their rejection note points to **three pillars**. The roadmap below treats each pillar as a standalone work-stream with concrete KPIs, owners, deliverables and a 90-day schedule. The target is to resubmit in **early January 2027** with evidence that all three pillars have been meaningfully addressed.

| Pillar | Current State | Target State | Risk |
|--------|--------------|--------------|------|
| **Trading Liquidity** | wZION/USDT pool reserve ~$0.003, 0 24h volume | $10k+ TVL, $1k+ 24h volume, 14-day streak | High — requires real capital & organic traders |
| **Project Maturity** | Mainnet alpha, no audit, 1 public pool | Audited, 90+ days mainnet, multi-DEX, 20+ nodes | Medium — time + budget for audit |
| **Team Presence** | X 404, Telegram/Discord unknown activity | Real X with 100+ followers, 500+ active Telegram/Discord, Bitcointalk ANN, Medium | Low — mostly execution |

---

## Pillar 1 — Trading Liquidity

### Why it matters
A tracked DEX pair with genuine depth and organic volume is the strongest signal CoinGecko uses. A $0.003 pool with zero swaps reads as a dead project.

### Current snapshot
- Pair: wZION/USDT on Base Uniswap V3, 0.3% fee
- Pool: `0x186b46c2f04153999d44D25179cD623fD62Bfda2`
- Price: ~$0.0001504
- Reserve: ~$0.003
- 24h volume: $0
- 24h transactions: 0

### KPIs (must hit before reapply)

| KPI | Minimum | Comfortable |
|-----|---------|-------------|
| Pool TVL (reserve_in_usd) | **$10,000** | $25,000+ |
| Sustained 24h volume | **$1,000+ for 14 days** | $3,000+ for 30 days |
| Unique daily traders | **5+** | 15+ |
| GeckoTerminal visible 24h vol | **> $0 for 14 days** | > $0 for 30 days |
| wZION holders on Base | **100+ unique wallets** | 300+ |
| Aggregator coverage | **CoinGecko + CoinMarketCap aware of pair** | CoinGecko also on CMC/Coinpaprika |

### Detailed action plan

#### 1.1 Seed the pool with real liquidity
- **Owner:** Treasury / Ops
- **Budget:** $5,000–$10,000 USDT + equivalent wZION
- **How:**
  1. Bridge ZION → wZION on Base via the canonical bridge.
  2. Approve `0x186b46c2f04153999d44D25179cD623fD62Bfda2`.
  3. Deposit a **full-range position** or a wide ±50% range at the current price.
  4. Avoid dust positions; the pool must show >$5,000 `reserve_in_usd` on GeckoTerminal.

#### 1.2 Generate organic daily volume
- **Owner:** Ops + Community lead
- **How:**
  1. Enable miners to bridge mined ZION → wZION and sell small amounts for USDT to cover costs.
  2. Run a **non-wash market maker** (MM bot) that rebalances within the range and posts tight spreads.
  3. Weekly "buyback" swaps from the team treasury (small, real, logged).
  4. Encourage community swaps: small ZION-USDT conversions for merchandise / donations / marketplace.

#### 1.3 Avoid disqualifying behaviour
- Do **not** wash-trade between team wallets.
- Do **not** create fake volume spikes.
- CoinGecko correlates volume with holder growth and transaction patterns.

#### 1.4 Add a second DEX venue
- **Owner:** Dev
- **Options (Base ecosystem):**
  - Aerodrome slipstream pool wZION/USDC
  - PancakeSwap V3 on Base wZION/USDT
  - Uniswap v4 if live
- **Why:** More venues = more aggregate liquidity and less single-point-of-failure.

#### 1.5 CEX or aggregator consideration
- **Owner:** BD / Yosef
- If a small CEX (MEXC, BitMart, LBank, etc.) lists ZION, it significantly helps both CG and CMC.
- Start outreach after pool has $10k+ TVL and real volume.

#### 1.6 GeckoTerminal visibility
- Monitor `https://www.geckoterminal.com/base/pools/0x186b46c2f04153999d44D25179cD623fD62Bfda2` daily.
- Ensure 24h volume and transactions stay > 0.
- Use GeckoTerminal as the **proof link** in the CoinGecko reapplication.

#### 1.7 Technical check
- Confirm the bridge mints 1:1 wZION and that the bridge contract is verified on BaseScan.
- Update `APP&WEB/website-v2.9/src/lib/defi-contracts.ts` and `src/lib/market.ts` when new pools are added.

---

## Pillar 2 — Project Maturity

### Why it matters
CoinGecko reviewers look for projects that have survived beyond a testnet, have public code, a working explorer, independent infrastructure and credible security review.

### Current snapshot
- Mainnet alpha launched 2026-08-06.
- ~33,700 blocks.
- One active public mining pool, one explorer.
- No published external security audit.
- GitHub public repo synced.

### KPIs

| KPI | Minimum | Comfortable |
|-----|---------|-------------|
| Mainnet age at reapply | **90+ days** | 120+ days |
| Security audit | **1 published report** | 2 independent reports |
| Public full nodes | **20+** | 50+ |
| Public mining pool hashrate | **> 1 MH/s stable** | > 5 MH/s |
| Distinct miners | **100+ wallet addresses** | 300+ |
| GitHub releases | **2 tagged releases** | 3+ |
| Node reward system | **Active on-chain** | Active + dashboard visible |
| L5 / OASIS progress | **Live pages + one funded project** | Multiple funded + demo |

### Detailed action plan

#### 2.1 External security audit
- **Owner:** Yosef / Treasury
- **Timeline:** Start in Week 1, finish by Week 45.
- **Vendors to consider:**
  - Tier 1: Trail of Bits, OpenZeppelin, Zellic, CertiK
  - Boutique: OtterSec, Securitize, Paladin, Macro
  - Community: Immunefi bug-bounty style
- **Scope:**
  - `V31/L1/core` (consensus, emission, transaction validation)
  - `V31/L2/multichain` + bridge contracts
  - `V31/L4/oasis` reward pool
- **Deliverable:** Public PDF in `docs/audits/`, linked from website.

#### 2.2 Grow independent node network
- **Owner:** Dev / Ops
- **How:**
  1. Launch public node setup guide at `/node-setup`.
  2. Enable `zion node start` one-liner with default public seeds.
  3. Activate protocol-level node reward system at block 144,000 (or earlier hard-fork).
  4. Run a node leaderboard at `/ncl` showing active peers and rewards.
  5. Encourage community to run nodes and submit IPs.

#### 2.3 Mining pool growth
- **Owner:** Mining Ops
- **How:**
  1. List pool on miningpoolstats.stream / miningpoolhub advertising boards.
  2. Publish Windows / Linux one-click miner.
  3. Run a public mining contest / airdrop for early miners.
  4. Add merged mining stats to website.

#### 2.4 GitHub + release discipline
- **Owner:** Dev
- **How:**
  1. Tag `v3.1.0` on mainnet genesis date.
  2. Tag `v3.1.1` with audit fixes.
  3. Keep `public` remote in sync with `origin` (sanitised) monthly.
  4. Add `CHANGELOG.md` and `SECURITY.md` to public repo.

#### 2.5 Mainnet feature completion
- **Owner:** Dev
- **Milestones:**
  1. Activate node rewards.
  2. Deploy L5 Free World multisig and first project spend.
  3. Ship OASIS login + wallet integration (even if L4 world is still demo).
  4. Stabilise block time closer to 60s target.

#### 2.6 Documentation and whitepaper
- **Owner:** Docs / Yosef
- **Deliverables:**
  - Final `ZION_V3_Whitepaper.md` in English.
  - Public `/whitepapers` page on website.
  - Update `README.md` public repo with key metrics and quickstart.

---

## Pillar 3 — Team Presence

### Why it matters
A project with no public social footprint is almost always rejected. CoinGecko verifies that official accounts exist, are active and have real followers.

### Current snapshot
- X (Twitter): `https://x.com/ZionTerraNova` → **404**
- Telegram: `https://t.me/zionterranova` → 200
- Discord: `https://discord.gg/wvxJ7DhZ8` → 301, validity unknown
- BitcoinTalk: none
- Medium / blog: none
- LinkedIn: none

### KPIs

| KPI | Minimum | Comfortable |
|-----|---------|-------------|
| X followers | **100+** | 1,000+ |
| X posts | **10+ over 30 days** | 30+ over 60 days |
| Telegram members | **500+** | 2,000+ |
| Discord members | **500+** | 2,000+ |
| BitcoinTalk ANN | **Thread created + maintained** | Thread with replies |
| Medium / blog posts | **3+ articles** | 6+ |
| Public verification post | **Done after each CG submit** | Done + pinned 48h |

### Detailed action plan

#### 3.1 X (Twitter)
- **Owner:** Yosef / Community
- **Actions:**
  1. Register `https://x.com/ZionTerraNova`.
  2. Fill profile: logo, banner, website, bio.
  3. Post schedule (3×/week): mainnet stats, mining guide, L5 update, market data.
  4. Engage with crypto Twitter: reply to PoW, DeFi, humanitarian coins threads.
  5. Follow and be followed by early community.

#### 3.2 Telegram
- **Owner:** Community / Ops
- **Actions:**
  1. Verify `https://t.me/zionterranova` is the main channel.
  2. Add admins, pinned post with all links.
  3. Daily automated stats bot: block height, hashrate, pool stats, price.
  4. Weekly AMA or voice chat.

#### 3.3 Discord
- **Owner:** Community / Ops
- **Actions:**
  1. Verify invite `https://discord.gg/wvxJ7DhZ8` is **permanent**.
  2. Set up channels: #announcements, #general, #mining, #support, #dev, #l5-oasis, #price.
  3. Assign roles, add mods, create verification.
  4. Weekly announcements synced with Telegram/Twitter.

#### 3.4 BitcoinTalk ANN
- **Owner:** Yosef
- **Actions:**
  1. Create account with throwaway email.
  2. Post ANN in *Altcoin Announcements* with:
     - Project summary
     - Links: website, explorer, GitHub, pool, Telegram, Discord, X
     - CoinGecko / CMC pending
  3. Update thread weekly.

#### 3.5 Medium / blog
- **Owner:** Docs / Yosef
- **Topics:**
  - "ZION TerraNova: A PoW Layer-1 with Protocol-Enforced Philanthropy"
  - "EkamDeeksha: Memory-Hard Mining for Consumer Hardware"
  - "Decade Decay: A Smoother Emission Model Than Bitcoin"
- **Where:** Medium or `/news` section on website.

#### 3.6 Public verification post
- **Owner:** Community
- **When:** Immediately after each CoinGecko submission.
- **Content:**
  > "ZION TerraNova has applied for a CoinGecko listing. Request ID: [ID]. Track on-chain activity: https://www.geckoterminal.com/base/pools/0x186b46c2f04153999d44D25179cD623fD62Bfda2"
- **Where:** X and Telegram. Pin it for 48 hours.

---

## 90-Day Timeline

### Phase 1 — Foundation (Days 1–30)

| Week | Focus | Deliverables | Owner |
|------|-------|--------------|-------|
| 1 | Create real X, verify Discord, seed $5k pool | X account live, Discord permanent, $5k liquidity | Yosef / Ops |
| 2 | Security audit RFP, Telegram growth, mining contest | Audit vendor selected, 100 Telegram members, 20 miners | Yosef / Dev |
| 3 | Node program, second DEX outreach, Bitcointalk ANN | Node guide, Aerodrome/Pancake RFP, ANN live | Dev / Yosef |
| 4 | Whitepaper v3 draft, first Medium post, pool MM bot | Whitepaper draft, 1 blog, non-wash MM active | Docs / Ops |

### Phase 2 — Acceleration (Days 31–60)

| Week | Focus | Deliverables | Owner |
|------|-------|--------------|-------|
| 5–6 | Audit execution, $10k+ TVL, 100+ X followers | Draft audit findings, $10k pool, 100 X followers | Yosef / Dev |
| 7 | Public nodes, node reward activation, second pool | 20 public nodes, node rewards active, second DEX pool | Dev / Ops |
| 8 | Market making, community growth, CG tracking | $1k+ 24h volume, 300 Telegram / 300 Discord | Ops / Community |
| 9–10 | L5 first spend, OASIS demo, Medium #2 | L5 spend tx, OASIS login, 2nd blog | Dev / Yosef |

### Phase 3 — Stabilisation (Days 61–90)

| Week | Focus | Deliverables | Owner |
|------|-------|--------------|-------|
| 11–12 | Audit published, sustained volume, 500+ social each | Public audit, 14-day volume streak, 500 social | All |
| 13 | Public launch prep, BitcoinTalk maintenance, PR | Final launch landing, weekly ANN updates | Yosef |
| 14 | Gather metrics, public verification post, resubmit | Metrics dashboard, reapplication ready | All |

---

## Minimum Viable Reapply Checklist

### Trading Liquidity
- [ ] wZION/USDT pool TVL ≥ $10,000
- [ ] 24h volume ≥ $1,000 for 14 consecutive days
- [ ] GeckoTerminal shows non-zero 24h volume for 14 days
- [ ] ≥ 5 unique daily traders on average
- [ ] ≥ 100 wZION holders on Base

### Project Maturity
- [ ] Mainnet age ≥ 90 days
- [ ] External security audit published
- [ ] ≥ 20 public full nodes
- [ ] Public mining pool hashrate > 1 MH/s with ≥ 100 distinct miners
- [ ] Node reward system active
- [ ] Whitepaper v3 published

### Team Presence
- [ ] X account live with 100+ followers and 10+ posts
- [ ] Telegram ≥ 500 active members
- [ ] Discord ≥ 500 active members
- [ ] BitcoinTalk ANN live
- [ ] 3+ Medium / blog posts
- [ ] Public verification post created after submission

---

## Red Lines (Do Not)

- Do **not** submit duplicate applications before these criteria are met.
- Do **not** buy fake followers, volume or members.
- Do **not** pay anyone who claims guaranteed CoinGecko listing.
- Do **not** inflate supply or circulating numbers.

---

## Resources

- CoinGecko Methodology: https://www.coingecko.com/en/methodology
- CoinGecko Listing FAQ: https://www.coingecko.com/en/faq
- Why was I rejected?: https://support.coingecko.com/hc/en-us/articles/4498809321369-Why-is-my-token-not-listed-on-CoinGecko
- Current pool: https://www.geckoterminal.com/base/pools/0x186b46c2f04153999d44D25179cD623fD62Bfda2

---

*Created: 2026-09-10*  
*Target resubmission: early January 2027*
