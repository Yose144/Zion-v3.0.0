# ZION Whitepaper v3.0 — Dokumenty

Tato složka obsahuje whitepapers pro **ZION TerraNova v3.0 (MainNet Genesis)**.

## Dokumenty

| Soubor | Cílová skupina | Popis |
|--------|----------------|-------|
| [`WHITEPAPER_v3.0_TECHNICAL.md`](WHITEPAPER_v3.0_TECHNICAL.md) | Vývojáři, CoinGecko, krypto-savvy | Kompletní technický whitepaper — architektura L1–L4, tokenomics, konsensus, bezpečnost |
| [`WHITEPAPER_v3.0_LAYMAN.md`](WHITEPAPER_v3.0_LAYMAN.md) | Veřejnost, netechnická audience | Přístupný průvodce bez žargonu — analogie, Q&A |
| [`WHITEPAPER_v3.0.md`](WHITEPAPER_v3.0.md) | — | ⚠️ ARCHIV — superseded quick draft |
| [`ZION_PROJECT_OVERVIEW_v2.9.5.md`](ZION_PROJECT_OVERVIEW_v2.9.5.md) | — | Historický přehled projektu v2.9.5 |

## Jak používat

### Pro CoinGecko / DEX listing

Použijte `WHITEPAPER_v3.0_TECHNICAL.md` — obsahuje:
- Přesné tokenomics (supply, reward, emisi)
- Architekturu (L1–L4)
- Kryptografická primitiva
- Roadmap

### Pro komunitu / social media / prezentace

Použijte `WHITEPAPER_v3.0_LAYMAN.md` — obsahuje:
- Jednoduchou angažovanost (proč ZION, jak těžit)
- Vysvětlení Consciousness Mining bez technického žargonu
- FAQ

## Klíčová fakta (pro rychlé reference)

```
Base supply:     144 000 000 000 ZION (+ tail emission od 2126)
Block reward:    5 400,067 ZION (Decade Decay −20 % / 10 let)
Tail reward:     724,785 ZION/blok (od 2126 navěky)
Block time:      60 sekund
Mining horizon:  100+ let + perpetual tail emission
Premine:         16 780 000 000 ZION (11,65 %)
Unit (spec):     1 ZION = 1 000 000 000 000 flower (12 des. míst)
Unit (runtime):  1 ZION = 1 000 000 atomic units (aktuální API/L1)
Consensus:       CosmicHarmony v3 (PoW, ASIC-resistant)
Fair Launch:     ✅ Žádný presale, žádné ICO, žádné VC
Distribution:    89 % miners / 5 % humanitarian / 5 % L5-L6 / 1 % pool
```

## Stav dokumentů

- `WHITEPAPER_v3.0_TECHNICAL.md` a `WHITEPAPER_v3.0_LAYMAN.md` jsou po finálním konsistenčním auditu (03/2026).
- Tokenomics a reward schedule jsou sladěny se zdrojovým kódem:
	- `L1/pool/src/blockchain/reward_calculator.rs`
	- `L1/core/src/blockchain/premine.rs`
- Jednotka `flower` vychází ze specifikace: `docs/2.9.7/Flowers.md` (12 desetinných míst)
- Aktuální implementace L1/API stále používá 1 000 000 atomic units/ZION (viz `L1/core/src/blockchain/reward.rs`, `docs/2.9.7/API_ENDPOINTS.md`)

## MainNet readiness sync (2026-03-03)

Pro pre-mainnet rozhodnutí používejte jako autoritativní zdroj:

- `docs/2.9.7/MAINNET_READINESS_UNIFIED.md`

WP3 dokumenty popisují architekturu a směr v3.0; launch gate (co je ještě povinné uzavřít) je řízena 2.9.7 readiness dokumentací.
