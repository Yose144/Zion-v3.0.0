# CoinGecko Re-listing Plan

> Rejection reason (from CoinGecko support, 2026-09-10):  
> "The project does not currently meet our evaluation metrics."  
> Key evaluation areas: **Trading Liquidity**, **Project Maturity**, **Team Presence**.
>
> This plan defines concrete targets and a 90-day timeline to meet those criteria before resubmitting.

---

## 1. Trading Liquidity

### Current state (2026-09-10)

- wZION/USDT Uniswap V3 on Base: `0x186b46c2f04153999d44D25179cD623fD62Bfda2`
- GeckoTerminal reserve: ~$0.003 USD, 24h volume: $0, 24h transactions: 0
- Price: ~$0.0001504 / wZION
- This is effectively a dead order book — main reason for instant rejection.

### Target metrics before reapply

| Metric | Target | Why |
|--------|--------|-----|
| Pool TVL (reserve in USD) | **$10,000+** | Sufficient depth for a CG-tracked DEX pair |
| 24h trading volume | **$1,000+ sustained for 14+ days** | Proves real trading, not fake wash |
| Unique 24h traders | **5+ unique wallets** | Organic holders/miners using the pool |
| GeckoTerminal 24h vol | **visible > $0 for 7+ days** | CG pulls DEX data from here |
| wZION holders | **100+ on Base** | Distribution beyond team |

### Actions

1. **Inject real liquidity into the wZION/USDT pool**
   - Deposit at least $5,000–$10,000 USDT + matching wZION on Uniswap V3.
   - Use a wide, full-range position or conservative ±50% range around $0.00015.
2. **Generate organic volume**
   - Enable wZION bridge mint/burn so miners can sell mined ZION into wZION.
   - Run an internal/public market-making bot with tight spreads (do not wash-trade).
   - Encourage team/community to use the DEX for small real swaps.
3. **List on additional venues**
   - Second DEX on Base or Arbitrum (e.g., Aerodrome, PancakeSwap V3).
   - CEX listing is ideal but harder; DEX + aggregator visibility is enough for CG reapply.
4. **Track in GeckoTerminal and CoinMarketCap self-reporting**
   - Ensure the pool remains active daily.
   - Submit pair to CoinGecko / CMC through their respective forms once volume is consistent.

---

## 2. Project Maturity

### Current state

- Mainnet Alpha live since 2026-08-06.
- ~33,700 blocks, active pool, basic explorer + wallet.
- No published external security audit.
- Project looks early-stage to a reviewer.

### Target metrics

| Metric | Target |
|--------|--------|
| Chain age at reapply | **90+ days since genesis** (end of Q4 2026) |
| External security audit | **Published, link public** |
| Independent nodes | **20+ public full nodes** (not just Edge) |
| Public mining pool hashrate | **stable > 1 MH/s, 100+ miners** |
| GitHub releases | **2+ tagged releases** with clear changelogs |
| Documentation | **Complete English whitepaper v3** on website |
| Mainnet features | **Node reward system activated** and visible on-chain |

### Actions

1. **Security audit**
   - Hire a reputable firm (Trail of Bits, OpenZeppelin, Zellic, or smaller boutique).
   - Publish audit report in `/docs/audits/2026-...` and on website.
2. **Network growth**
   - Launch public node operator program.
   - Incentivize full nodes with the 1% node-reward system.
   - Publish node participation stats on dashboard.
3. **GitHub + release discipline**
   - Tag `v3.1.0` and `v3.1.1` releases.
   - Keep public commits frequent and meaningful.
4. **Mainnet feature completion**
   - Activate node rewards at block X.
   - Launch L5 project pages with real funding flows.
   - Ship OASIS playable demo or wallet integration.
5. **Documentation / whitepaper**
   - Finalise `ZION_V3_Whitepaper.md` and host it at `/docs/whitepaper/ZION_V3_Whitepaper.md`.

---

## 3. Team Presence

### Current state

- X/Twitter `@ZionTerraNova` does **not exist** (404) — instant red flag.
- Telegram `t.me/zionterranova` exists (200).
- Discord `discord.gg/wvxJ7DhZ8` redirects (301) — invite validity to verify.
- No BitcoinTalk ANN, no Medium, no LinkedIn.

### Target metrics

| Channel | Target before reapply |
|---------|----------------------|
| X / Twitter | **Account exists**, 100+ followers, 10+ posts over 30 days |
| Telegram | **500+ real members**, daily activity |
| Discord | **500+ real members**, active channels, team present |
| BitcoinTalk ANN | **Thread created and maintained** |
| Medium / Blog | **3+ articles** (technical, roadmap, updates) |
| Public verification post | **Done after each CG submission** with request ID + GeckoTerminal link |

### Actions

1. **Create real X account**
   - Register `https://x.com/ZionTerraNova`.
   - Post genesis recap, mainnet stats, mining guides, L5 updates weekly.
2. **Verify Discord invite**
   - Confirm `https://discord.gg/wvxJ7DhZ8` is permanent, not expiring.
   - Set up channels: #announcements, #mining, #support, #development.
3. **Grow Telegram and Discord with real users**
   - Invite miners, beta testers, community from existing networks.
   - Avoid bot inflation — CoinGecko reviewers spot fake members.
4. **BitcoinTalk ANN thread**
   - Create thread in Altcoin Announcements with project summary, links, pool info.
5. **Public verification post**
   - After re-submission, publish a post from the official X/Telegram with:
     - Request ID
     - GeckoTerminal link: `https://www.geckoterminal.com/base/pools/0x186b46c2f04153999d44D25179cD623fD62Bfda2`

---

## 4. Suggested Reapplication Timeline

| Phase | Dates | Focus |
|-------|-------|-------|
| **Days 1–30** | Sep–Oct 2026 | Create X account, activate real liquidity ($5k+), begin audit, grow Telegram/Discord to 100+ each |
| **Days 31–60** | Oct–Nov 2026 | Reach $10k+ pool TVL, $1k+ daily volume, 20+ public nodes, publish audit, 300+ social members each |
| **Days 61–90** | Nov–Dec 2026 | Sustained metrics for 14+ days, BitcoinTalk ANN, Medium articles, public launch postponed (TBD) target |
| **Reapply** | Early Jan 2027 | Submit fresh CoinGecko application with all above proven, include public verification post |

---

## 5. Minimum Viable Reapply Checklist

- [ ] Pool TVL ≥ $10,000 on Base
- [ ] 24h volume ≥ $1,000 for 14 consecutive days
- [ ] GeckoTerminal shows non-zero daily volume
- [ ] X account live with 100+ followers
- [ ] Telegram + Discord each 500+ active members
- [ ] BitcoinTalk ANN thread live
- [ ] External security audit published
- [ ] 20+ public full nodes
- [ ] Node reward system active on mainnet
- [ ] Public verification post created after submission
- [ ] Whitepaper v3 published on website
- [ ] No duplicate CG submissions before all above are met

---

## 6. What NOT to do

- Do not submit a duplicate or near-duplicate application before fixing the issues.
- Do not fake volume, followers, or members — CoinGecko reviewers detect this.
- Do not pay anyone claiming to guarantee a CoinGecko listing (scam).

---

*Last updated: 2026-09-10*  
*CoinGecko rejection response: project did not meet evaluation metrics (trading liquidity, project maturity, team presence).*
