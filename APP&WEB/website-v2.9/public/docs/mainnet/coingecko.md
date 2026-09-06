# CoinGecko Listing — Submission Checklist

**Goal:** Successful registration of ZION on CoinGecko (+ CoinMarketCap)  
**Target:** gated Q3–Q4 2026 window (only if the launch package reaches GO)

---

## What CoinGecko requires

### 1. Basic information

| Item | Requirement | Status | URL / Value |
|------|-------------|--------|-------------|
| **Coin name** | Exact name | ✅ | ZION TerraNova |
| **Ticker** | 3–5 characters | ✅ | ZION |
| **Website** | HTTPS, working | ✅ | https://zionterranova.com |
| **Whitepaper** | Public URL, EN | 🔄 | /docs (WP v2.9.7 EN) |
| **GitHub** | Public repo, active | ✅ | https://github.com/Zion-TerraNova |
| **Block explorer** | Working, public | 📋 | https://zionterranova.com/explorer |
| **Algorithm** | Name | ✅ | Cosmic Harmony v4 (CHv4) |
| **Consensus** | PoW / PoS / ... | ✅ | Proof of Work |
| **Total supply** | Number | ✅ | 144 000 000 000 |
| **Max supply** | Number or ∞ | ✅ | 144 000 000 000 |
| **Block time** | Seconds | ✅ | 60 s |

### 2. Visual assets

| Item | Specification | Status |
|------|---------------|--------|
| **Logo PNG** | 200×200 px, transparent bg | 📋 |
| **Logo PNG small** | 64×64 px | 📋 |
| **Logo SVG** | Optional, desirable | 📋 |
| Banner image | 1400×400 px (optional) | 📋 |

> Current logo: `LogoStargate.jpg` — needs to be converted to PNG with transparent background.

### 3. Social media and community

| Platform | Requirement | Status | URL |
|----------|-------------|--------|-----|
| Twitter/X | Active account | 📋 | |
| Telegram | Community or ANN | 📋 | |
| Discord | Optional | 📋 | |
| Reddit | Optional | 📋 | |
| BitcoinTalk ANN | Recommended | 📋 | |

### 4. Circulating Supply API

CoinGecko needs a live API endpoint for circulating supply:

```
GET https://zionterranova.com/api/supply
→ { "circulating": 16780000000, "total": 144000000000, "max": 144000000000 }
```

**Implementation:**  
Endpoint `/api/supply` (Next.js route) → calls `GET http://[node]:8443/supply` → returns JSON.

Status: 📋 needs to be implemented

### 5. Description (EN, max 500 characters)

```
ZION TerraNova is a Proof-of-Work blockchain built entirely in native Rust. 
Using the Cosmic Harmony (CHv4) ASIC-resistant algorithm, it enables fair 
GPU/CPU mining with no halving. Designed for decentralization, humanitarian 
impact, and multi-chain interoperability via WARP bridges and L2 DeFi layer.
```

*(476 characters — OK)*

### 6. Long description (EN, max 2000 characters)

```
ZION TerraNova is a from-scratch Proof-of-Work blockchain written in 52,590+ 
lines of native Rust. Launched in September 2025 with a 45-year fair emission 
schedule, ZION uses the proprietary Cosmic Harmony (CHv4) algorithm — a 
memory-hard, ASIC-resistant 4-phase PoW with a 4MB scratchpad and neural 
bloom phase to ensure continued CPU/GPU mining accessibility.

Key features:
- No halving — constant 5,400 ZION/block + Decade Decay model
- Decade Decay: -20% every 10 years, tail emission 725 ZION/block (permanent)
- Total supply: 144 billion ZION (88.35% fair-mined, 11.65% premine for dev/humanitarian)
- Native 6-layer architecture: L1 TerraNova → L2 NCL → L3 DAO → L4 Oasis → L5 Free World → L6 Issobella
- wZION ERC-20 bridge to Ethereum Base and other EVM chains
- Ed25519 signatures, LMDB storage, LWMA difficulty adjustment
- Public TestNet live (primary host Zion2 + internal seeds)
- 780+ automated tests, security audit: 0 critical findings

Public launch remains NO-GO until closure evidence is complete; CoinGecko prep should stay aligned with the gated launch path rather than a fixed date.
```

---

## CoinMarketCap — Specific extra requirements

| Item | Detail |
|------|--------|
| **CMC ID** | Assigned automatically after approval |
| **Proof of Reserves** | Optional for PoW coins |
| **Audit report** | Strongly recommended (audit URL) |
| **Exchanges** | At least 1 trading pair (DEX is enough) |
| **Trading pair** | ZION/USDC or ZION/ETH |

---

## Submission URL

- **CoinGecko:** https://www.coingecko.com/en/coins/new
- **CoinMarketCap:** https://pro.coinmarketcap.com/request/cryptocurrency

---

## Preparation TODO (for the team)

- [ ] Create PNG logo 200×200, 64×64 (transparent bg)
- [ ] Launch Twitter/X account (@ZIONTerraNova or similar)
- [ ] Create Telegram group/channel
- [ ] Implement `/api/supply` endpoint
- [ ] Working block explorer `/explorer` (not a mockup)
- [ ] Publish whitepaper v2.9.7 EN on the website
- [ ] BitcoinTalk ANN thread (a throwaway email is enough — the thread is a key signal)
- [ ] At least 1 DEX trading pair at launch (Uniswap/Base)

---

*See also: [Public Launch Path](README.md) · [Architecture](../architecture/README.md) · [Whitepaper](../whitepaper/ZION_Whitepaper_v2.9.7.md)*
