# CoinGecko Listing — Submission Checklist

**Goal:** Successful registration of ZION on CoinGecko (+ CoinMarketCap)  
**Status:** Mainnet Alpha live since 2026-08-06 (protocol `3.1.0-alpha`) — listing preparation in progress  
**Full submission packet:** [`docs/listings/COINGECKO.md`](https://github.com/Zion-TerraNova/v3-Mainnet) (repo, verified against source code)

---

## What CoinGecko requires

### 1. Basic information

| Item | Requirement | Status | URL / Value |
|------|-------------|--------|-------------|
| **Coin name** | Exact name | ✅ | ZION TerraNova |
| **Ticker** | 3–5 characters | ✅ | ZION |
| **Website** | HTTPS, working | ✅ | https://zionterranova.com |
| **Whitepaper** | Public URL, EN | ✅ | /docs (ZION Whitepaper EN) |
| **GitHub** | Public repo, active | ✅ | https://github.com/Zion-TerraNova/v3-Mainnet |
| **Block explorer** | Working, public | ✅ | https://app.zionterranova.com/explorer |
| **Algorithm** | Name | ✅ | EkamDeeksha (memory-hard PoW) |
| **Consensus** | PoW / PoS / ... | ✅ | Proof of Work |
| **Total supply** | Number | ✅ | 144,000,000,000 |
| **Max supply** | Number or ∞ | ✅ | 144,000,000,000 |
| **Block time** | Seconds | ✅ | 60 s (target) |
| **Genesis date** | Date | ✅ | 2026-08-06 |

### 2. Visual assets

| Item | Specification | Status | URL |
|------|---------------|--------|-----|
| **Logo PNG** | 200×200 px, transparent bg | ✅ | https://app.zionterranova.com/brand/zion/icon-on-dark-200.png |
| **Logo PNG small** | 64×64 px | ✅ | https://app.zionterranova.com/brand/zion/icon-on-dark-64.png |
| **Logo PNG large** | 512×512 px | ✅ | https://app.zionterranova.com/brand/zion/favicon.png |
| **Logo SVG** | Optional, desirable | ✅ | https://app.zionterranova.com/brand/zion/icon-on-dark.svg |
| Banner image | 1400×400 px (optional) | ✅ | https://app.zionterranova.com/zion-social-banner.png |

### 3. Social media and community

| Platform | Requirement | Status | URL |
|----------|-------------|--------|-----|
| Twitter/X | Active account | 📋 | |
| Telegram | Community or ANN | 📋 | |
| Discord | Optional | 📋 | |
| Reddit | Optional | 📋 | |
| BitcoinTalk ANN | Recommended | 📋 | |

### 4. Circulating Supply API — ✅ LIVE

CoinGecko needs a live API endpoint for circulating supply:

```
GET https://app.zionterranova.com/api/blockchain/stats
→ { "circulating_supply": 16961690654, "total_supply": 144000000000, "max_supply": 144000000000, ... }
```

Additional listing feeds (CoinGecko / CMC shaped JSON):

```
GET https://app.zionterranova.com/api/listing/coingecko
GET https://app.zionterranova.com/api/listing/coinmarketcap
```

### 5. Description (EN, max 500 characters)

```
ZION TerraNova is an open-source, memory-hard Proof-of-Work blockchain
written in Rust. It replaces Bitcoin-style halvings with a smooth
-20%/decade "Decade Decay" emission model plus perpetual tail emission,
and directs 10% of every block reward to humanitarian and science
funds — enforced in consensus code, not policy.
```

*(~360 characters — OK)*

### 6. Long description (EN, max 2000 characters)

```
ZION TerraNova is a from-scratch Proof-of-Work Layer-1 blockchain written
in Rust. Mainnet Alpha launched on 2026-08-06 with the EkamDeeksha
memory-hard PoW algorithm (512 KiB scratchpad, 128 random reads, AES
rounds), designed to keep consumer CPU/GPU mining competitive.

Key features:
- Decade Decay emission: -20% every 10 years (5,256,000 blocks), no halvings
- Perpetual tail emission: ~724.785 ZION/block from ~year 100
- Total supply: 144 billion ZION (88.35% mined, 11.65% genesis premine)
- Protocol-enforced philanthropy: 5% of every block reward to a
  humanitarian fund and 5% to a science fund, hardcoded in consensus
- Merged mining (AuxPoW) with ZANO and VRSC on the public pool
- Six-layer architecture: L1 chain, L2 DeFi/bridge/DAO, L3 cross-chain
  DEX, L4 OASIS world, L5 humanitarian, L6 science
- wZION ERC-20 bridge to Base (contract 0x0c49...2bb6)
- Ed25519 signatures, Bech32 addresses, LWMA difficulty adjustment
- Public explorer, RPC, and supply API live
```

---

## CoinMarketCap — Specific extra requirements

| Item | Detail |
|------|--------|
| **CMC ID** | Assigned automatically after approval |
| **Proof of Reserves** | Optional for PoW coins |
| **Audit report** | Strongly recommended (audit URL) |
| **Exchanges** | At least 1 trading pair (DEX is enough) |
| **Trading pair** | ZION/USDT or ZION/ETH |

---

## Submission URL

- **CoinGecko:** https://www.coingecko.com/en/coins/new
- **CoinMarketCap:** https://pro.coinmarketcap.com/request/cryptocurrency

---

## Remaining TODO (for the team)

- [ ] Launch Twitter/X account (@ZionTerraNova or similar)
- [ ] Create Telegram group/channel
- [ ] BitcoinTalk ANN thread
- [ ] At least 1 real trading pair live (DEX on Base — currently test tokens only)
- [ ] Contact email for the submission form

---

*See also: [Public Launch Path](README.md) · [Architecture](../architecture/README.md) · [Whitepaper](../whitepaper/ZION_V3_Whitepaper.md)*
