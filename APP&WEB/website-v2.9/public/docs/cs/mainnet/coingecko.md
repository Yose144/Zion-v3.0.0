# CoinGecko listing — submission checklist

**Cíl:** Úspěšná registrace ZION na CoinGecko (+ CoinMarketCap)  
**Stav:** Mainnet Alpha běží od 2026-08-06 (protokol `3.1.0-alpha`) — příprava listing probíhá  
**Kompletní submission packet:** [`docs/listings/COINGECKO.md`](https://github.com/Zion-TerraNova/v3-Mainnet) (v repozitáři, ověřeno proti zdrojovému kódu)

---

## Co CoinGecko vyžaduje

### 1. Základní informace

| Položka | Požadavek | Stav | URL / Hodnota |
|---------|-----------|------|---------------|
| **Název coinu** | Přesný název | ✅ | ZION TerraNova |
| **Ticker** | 3–5 znaků | ✅ | ZION |
| **Website** | HTTPS, funkční | ✅ | https://zionterranova.com |
| **Whitepaper** | Veřejná URL, EN | ✅ | /docs (ZION Whitepaper EN) |
| **GitHub** | Public repo, aktivní | ✅ | https://github.com/Zion-TerraNova/v3-Mainnet |
| **Block explorer** | Funkční, veřejný | ✅ | https://app.zionterranova.com/explorer |
| **Algoritmus** | Název | ✅ | EkamDeeksha (memory-hard PoW) |
| **Konsenzus** | PoW / PoS / ... | ✅ | Proof of Work |
| **Total supply** | Číslo | ✅ | 144 000 000 000 |
| **Max supply** | Číslo nebo ∞ | ✅ | 144 000 000 000 |
| **Block time** | Sekundy | ✅ | 60 s (cíl) |
| **Genesis datum** | Datum | ✅ | 2026-08-06 |

### 2. Vizuální podklady

| Položka | Specifikace | Stav | URL |
|---------|-------------|------|-----|
| **Logo PNG** | 200×200 px, průhledné pozadí | ✅ | https://app.zionterranova.com/brand/zion/icon-on-dark-200.png |
| **Logo PNG malé** | 64×64 px | ✅ | https://app.zionterranova.com/brand/zion/icon-on-dark-64.png |
| **Logo PNG velké** | 512×512 px | ✅ | https://app.zionterranova.com/brand/zion/favicon.png |
| **Logo SVG** | Volitelné, žádoucí | ✅ | https://app.zionterranova.com/brand/zion/icon-on-dark.svg |
| Banner | 1400×400 px (volitelné) | ✅ | https://app.zionterranova.com/zion-social-banner.png |

### 3. Sociální sítě a komunita

| Platforma | Požadavek | Stav | URL |
|-----------|-----------|------|-----|
| Twitter/X | Aktivní účet | 📋 | |
| Telegram | Komunita nebo ANN | 📋 | |
| Discord | Volitelné | 📋 | |
| Reddit | Volitelné | 📋 | |
| BitcoinTalk ANN | Doporučené | 📋 | |

### 4. Circulating Supply API — ✅ LIVE

CoinGecko potřebuje živý API endpoint pro circulating supply:

```
GET https://app.zionterranova.com/api/blockchain/stats
→ { "circulating_supply": 16961690654, "total_supply": 144000000000, "max_supply": 144000000000, ... }
```

Další listing feedy (JSON ve formátu CoinGecko / CMC):

```
GET https://app.zionterranova.com/api/listing/coingecko
GET https://app.zionterranova.com/api/listing/coinmarketcap
```

### 5. Popis (EN, max 500 znaků)

```
ZION TerraNova is an open-source, memory-hard Proof-of-Work blockchain
written in Rust. It replaces Bitcoin-style halvings with a smooth
-20%/decade "Decade Decay" emission model plus perpetual tail emission,
and directs 10% of every block reward to humanitarian and science
funds — enforced in consensus code, not policy.
```

*(~360 znaků — OK)*

### 6. Dlouhý popis (EN, max 2000 znaků)

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

## CoinMarketCap — specifické požadavky navíc

| Položka | Detail |
|---------|--------|
| **CMC ID** | Přiřazeno automaticky po schválení |
| **Proof of Reserves** | Volitelné pro PoW coiny |
| **Audit report** | Silně doporučené (audit URL) |
| **Exchanges** | Minimálně 1 obchodní pár (DEX stačí) |
| **Trading pair** | ZION/USDT nebo ZION/ETH |

---

## Submission URL

- **CoinGecko:** https://www.coingecko.com/en/coins/new
- **CoinMarketCap:** https://pro.coinmarketcap.com/request/cryptocurrency

---

## Zbývající TODO (pro tým)

- [ ] Založit Twitter/X účet (@ZionTerraNova nebo podobný)
- [ ] Vytvořit Telegram skupinu/kanál
- [ ] BitcoinTalk ANN vlákno
- [ ] Minimálně 1 reálný obchodní pár live (DEX na Base — zatím jen test tokeny)
- [ ] Kontaktní e-mail pro submission formulář

---

*Viz také: [Public Launch Path](README.md) · [Architecture](../architecture/README.md) · [Whitepaper](../whitepaper/ZION_V3_Whitepaper.md)*
