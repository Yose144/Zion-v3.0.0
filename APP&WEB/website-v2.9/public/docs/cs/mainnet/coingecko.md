# CoinGecko Listing — Submission Checklist

**Cíl:** Úspěšná registrace ZION na CoinGecko (+ CoinMarketCap)  
**Target:** gated Q3–Q4 2026 window (jen pokud launch package dojde na GO)

---

## Co CoinGecko vyžaduje

### 1. Základní informace

| Položka | Požadavek | Stav | URL / Hodnota |
|---------|-----------|------|---------------|
| **Název coinu** | Přesný název | ✅ | ZION TerraNova |
| **Ticker** | 3–5 znaků | ✅ | ZION |
| **Website** | HTTPS, funkční | ✅ | https://zionterranova.com |
| **Whitepaper** | Veřejná URL, EN | 🔄 | /docs (WP v2.9.7 EN) |
| **GitHub** | Public repo, aktivní | ✅ | https://github.com/Zion-TerraNova |
| **Block explorer** | Funkční, veřejný | 📋 | https://zionterranova.com/explorer |
| **Algoritmus** | Název | ✅ | Cosmic Harmony v4 (CHv4) |
| **Consensus** | PoW / PoS / ... | ✅ | Proof of Work |
| **Total supply** | Číslo | ✅ | 144 000 000 000 |
| **Max supply** | Číslo nebo ∞ | ✅ | 144 000 000 000 |
| **Block time** | Sekundy | ✅ | 60 s |

### 2. Vizuální assety

| Položka | Specifikace | Stav |
|---------|-------------|------|
| **Logo PNG** | 200×200 px, transparentní bg | 📋 |
| **Logo PNG small** | 64×64 px | 📋 |
| **Logo SVG** | Volitelné, žádoucí | 📋 |
| Banner image | 1400×400 px (volitelné) | 📋 |

> Aktuální logo: `LogoStargate.jpg` — nutno překonvertovat na PNG s transparentním pozadím.

### 3. Sociální sítě a komunita

| Platforma | Požadavek | Stav | URL |
|-----------|-----------|------|-----|
| Twitter/X | Aktivní účet | 📋 | |
| Telegram | Komunita nebo ANN | 📋 | |
| Discord | Volitelné | 📋 | |
| Reddit | Volitelné | 📋 | |
| BitcoinTalk ANN | Doporučeno | 📋 | |

### 4. Circulating Supply API

CoinGecko potřebuje live API endpoint pro circulating supply:

```
GET https://zionterranova.com/api/supply
→ { "circulating": 16280000000, "total": 144000000000, "max": 144000000000 }
```

**Implementace:**  
Endpoint `/api/supply` (Next.js route) → volá `GET http://[node]:8443/supply` → vrací JSON.

Status: 📋 nutno implementovat

### 5. Popis (EN, max 500 znaků)

```
ZION TerraNova is a Proof-of-Work blockchain built entirely in native Rust. 
Using the Cosmic Harmony (CHv4) ASIC-resistant algorithm, it enables fair 
GPU/CPU mining with no halving. Designed for decentralization, humanitarian 
impact, and multi-chain interoperability via WARP bridges and L2 DeFi layer.
```

*(476 znaků — OK)*

### 6. Delší popis (EN, max 2000 znaků)

```
ZION TerraNova is a from-scratch Proof-of-Work blockchain written in 52,590+ 
lines of native Rust. Launched in September 2025 with a 45-year fair emission 
schedule, ZION uses the proprietary Cosmic Harmony (CHv4) algorithm — a 
memory-hard, ASIC-resistant 4-phase PoW with a 4MB scratchpad and neural 
bloom phase to ensure continued CPU/GPU mining accessibility.

Key features:
- No halving — constant 5,400 ZION/block + Decade Decay model
- Decade Decay: -20% every 10 years, tail emission 725 ZION/block (permanent)
- Total supply: 144 billion ZION (88.7% fair-mined, 11.3% premine for dev/humanitarian)
- Native 6-layer architecture: L1 TerraNova → L2 NCL → L3 DAO → L4 Oasis → L5 Free World → L6 Issobella
- wZION ERC-20 bridge to Ethereum Base and other EVM chains
- Ed25519 signatures, LMDB storage, LWMA difficulty adjustment
- Public TestNet live (primary host Zion2 + internal seeds)
- 780+ automated tests, security audit: 0 critical findings

Public launch remains NO-GO until closure evidence is complete; CoinGecko prep should stay aligned with the gated launch path rather than a fixed date.
```

---

## CoinMarketCap – Specifické požadavky navíc

| Položka | Detail |
|---------|--------|
| **CMC ID** | Automaticky přiděleno po schválení |
| **Proof of Reserves** | Volitelné pro PoW coiny |
| **Audit report** | Silně doporučeno (URL k auditu) |
| **Exchanges** | Aspoň 1 trading pair (DEX stačí) |
| **Trading pair** | ZION/USDC nebo ZION/ETH |

---

## Submission URL

- **CoinGecko:** https://www.coingecko.com/en/coins/new
- **CoinMarketCap:** https://pro.coinmarketcap.com/request/cryptocurrency

---

## Přípravný TODO (pro team)

- [ ] Vytvořit PNG logo 200×200, 64×64 (transparentní bg)
- [ ] Spustit Twitter/X účet (@ZIONTerraNova nebo podobné)
- [ ] Vytvořit Telegram skupinu/kanál
- [ ] Implementovat `/api/supply` endpoint
- [ ] Funkční block explorer `/explorer` (ne mockup)
- [ ] Whitepaper v2.9.7 EN zveřejnit na webu
- [ ] BitcoinTalk ANN thread (neplatný email stačí — thread je klíčový signál)
- [ ] Aspoň 1 DEX trading pair při launchi (Uniswap/Base)

---

*Viz též: [Public Launch Path](README.md) · [Architecture](../architecture/README.md) · [Whitepaper](../whitepaper/ZION_Whitepaper_v2.9.7.md)*
