# MainNet Launch Plan — ZION TerraNova

**Cílový datum:** 31. 12. 2026  
**Aktuální stav:** Pre-MainNet Gate (v2.9.7)  
**Aktuální síť:** TestNet (Helsinki · USA · Asia)

---

## Fáze přípravy

```
[DONE]  Phase 0 — Foundation (Sep–Dec 2025)
         ✅ Genesis blok, CHv3 algoritmus, Python prototype
         ✅ 3-node TestNet, první GPU mining

[DONE]  Phase 1 — Native Core (Jan–Mar 2026)
         ✅ 100% Rust rewrite (52 590 LOC)
         ✅ 780+ testů, LMDB, Ed25519
         ✅ 3-node live TestNet (Helsinki, USA, Asia)
         ✅ wZION Bridge (Base Sepolia testnet)
         ✅ Unified website v2.9.7

[NOW]   Phase 2 — Gate Checks (Mar–Jun 2026)
         🔄 CHv4 algoritmus (vývoj)
         🔄 Stabilizace P2P vrstvy
         🔄 Docs - whitepaper, architecture, CoinGecko
         🔄 Bezpečnostní audit L1 kódu
         📋 Explorer - plně funkční (ne mockup)

[NEXT]  Phase 3 — MainNet Readiness (Jul–Oct 2026)
         📋 Hard fork na CHv4
         📋 L2 bridge mainnet deployment
         📋 DEX likvidita (seed round)
         📋 Wallet binaries (Win/Mac/Linux)
         📋 CoinGecko submission

[FINAL] Phase 4 — MainNet Launch (Nov–Dec 2026)
         📋 Genesis 2 (MainNet block 0)
         📋 Public launch event
         📋 L2 DEX live
         📋 Listing (CoinGecko, CMC)
```

---

## Blockerové požadavky (B-CRIT)

Tyto body musí být splněny **před** MainNet Launche:

| ID | Požadavek | Stav |
|----|-----------|------|
| B-CRIT-01 | 30 dní bez kritické chyby na TestNetu | 🔄 |
| B-CRIT-02 | Bezpečnostní audit L1 (externě) | 📋 |
| B-CRIT-03 | Plně funkční explorer (block/TX search) | 📋 |
| B-CRIT-04 | Wallet ke stažení (Win + Linux) | 📋 |
| B-CRIT-05 | Whitepaper v2.9.7 EN veřejně přístupný | 🔄 |
| B-CRIT-06 | 5+ nezávislých mining nodů mimo team | 📋 |
| B-CRIT-07 | L2 bridge audit + mainnet deployment | 📋 |
| B-CRIT-08 | DAO constitution ratifikace | 📋 |

---

## Síťové parametry pro MainNet

| Parametr | Hodnota |
|----------|---------|
| Total supply | 144 000 000 000 ZION |
| Premine | 16 280 000 000 ZION (11.3%) |
| Mining supply | 127 720 000 000 ZION (88.7%) |
| Block reward | 5 400.067 ZION |
| Block time | 60 s |
| Decay | Decade Decay: −20% každých 10 let (od bloku 5 256 000) |
| Tail emission | 725.000 ZION/blok (permanentní) |
| Fee policy | Burn (100% poplatků spalováno) |
| Algoritmus | CHv4 (při launchi) |
| Adresa | Z3 prefix |
| Port | 8333 (mainnet), 18333 (testnet) |

---

## Timeline 2026

```
Jan–Mar 2026   Rust rewrite, stabilizace, website redesign
Mar–Apr 2026   Docs hub, whitepaper EN, CoinGecko prep
Apr–Jun 2026   CHv4 vývoj + testnet hard fork
Jun–Aug 2026   Bezpečnostní audit, explorer, wallet binaries
Sep–Oct 2026   L2 bridge mainnet, DEX seed liquidity
Nov 2026       CoinGecko submission, marketing
Dec 2026       🚀 MainNet Genesis Block
```

---

## Premine Alokace

| Účel | Podíl | ZION |
|------|-------|------|
| Humanitární rezerva | 40% | 6 512 000 000 |
| Vývoj & infrastruktura | 30% | 4 884 000 000 |
| Ekosystém & partnerství | 20% | 3 256 000 000 |
| Founding team | 10% | 1 628 000 000 |

> Vesting: 4 roky lineárně pro founding team. Humanitární rezerva spravována DAO.

---

*Viz také: [Pre-MainNet Checklist](../v2.9.7/mainnet-gate.md) · [CoinGecko Checklist](coingecko.md) · [Architecture](../architecture/README.md)*
