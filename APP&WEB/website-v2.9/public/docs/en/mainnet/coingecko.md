# CoinGecko listing — submission checklist

**Goal:** Successfully register ZION on CoinGecko (and CoinMarketCap)  
**Target:** gated Q3–Q4 2026 window (only if the launch package reaches GO)

---

## What CoinGecko requires

### 1. Basic information

| Field | Requirement | Status | URL / value |
|-------|-------------|--------|---------------|
| **Coin name** | Exact name | ✅ | ZION TerraNova |
| **Ticker** | 3–5 characters | ✅ | ZION |
| **Website** | HTTPS, working | ✅ | https://zionterranova.com |
| **Whitepaper** | Public URL, EN | 🔄 | /docs (WP v2.9.7 EN) |
| **GitHub** | Public repo, active | ✅ | https://github.com/Zion-TerraNova |
| **Block explorer** | Working, public | 📋 | https://zionterranova.com/explorer |
| **Algorithm** | Name | ✅ | Cosmic Harmony v4 (CHv4) |
| **Consensus** | PoW / PoS / … | ✅ | Proof of Work |
| **Total supply** | Number | ✅ | 144,000,000,000 |
| **Max supply** | Number or ∞ | ✅ | 144,000,000,000 |
| **Block time** | Seconds | ✅ | 60 s |

### 2. Visual assets

| Field | Spec | Status |
|-------|------|--------|
| **Logo PNG** | 200×200 px, transparent bg | 📋 |
| **Logo PNG small** | 64×64 px | 📋 |
| **Logo SVG** | Optional, desirable | 📋 |
| Banner | 1400×400 px (optional) | 📋 |

> Current logo: `LogoStargate.jpg` — convert to PNG with transparent background.

### 3. Social and community

| Platform | Requirement | Status | URL |
|----------|---------------|--------|-----|
| Twitter/X | Active account | 📋 | |
| Telegram | Community or ANN | 📋 | |
| Discord | Optional | 📋 | |
| Reddit | Optional | 📋 | |
| BitcoinTalk ANN | Recommended | 📋 | |

### 4. Circulating supply API

CoinGecko needs a live endpoint for circulating supply:

```
GET https://zionterranova.com/api/supply
→ { "circulating": 16780000000, "total": 144000000000, "max": 144000000000 }
```

**Implementation:**  
`/api/supply` (Next.js route) → `GET http://[node]:8443/supply` → JSON.

Status: 📋 to implement

### 5. Short description (EN, max 500 characters)

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

## CoinMarketCap — extra requirements

| Field | Detail |
|-------|--------|
| **CMC ID** | Assigned after approval |
| **Proof of reserves** | Optional for PoW |
| **Audit report** | Strongly recommended (URL) |
| **Exchanges** | At least one trading pair (DEX OK) |
| **Trading pair** | ZION/USDC or ZION/ETH |

---

## Submission URLs

- **CoinGecko:** https://www.coingecko.com/en/coins/new  
- **CoinMarketCap:** https://pro.coinmarketcap.com/request/cryptocurrency  

---

## Team prep TODO

- [ ] PNG logos 200×200 and 64×64 (transparent bg)  
- [ ] Launch Twitter/X (@ZIONTerraNova or similar)  
- [ ] Telegram group/channel  
- [ ] Implement `/api/supply`  
- [ ] Working block explorer `/explorer` (not a mockup)  
- [ ] Publish whitepaper v2.9.7 EN on site  
- [ ] BitcoinTalk ANN thread  
- [ ] At least one DEX pair at launch (Uniswap/Base)  

---

*See also: [Public Launch Path](README.md) · [Architecture](../architecture/README.md) · [Whitepaper](../whitepaper/ZION_Whitepaper_v2.9.7.md)*
