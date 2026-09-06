# MainNet Gate — checklist před spuštěním

> ZION v2.9.7 · Stav: **PRE-MAINNET (TestNet v provozu)**

---

## Stav gate

| Kritérium | Kód | Stav |
|-----------|-----|------|
| Bezpečnostní audit dokončen (0 kritických) | B-CRIT-01 | 🔴 OTEVŘENO |
| 3týdenní okno stability TestNetu | B-CRIT-02 | 🔴 OTEVŘENO |
| Hlasování komunity (kvórum) | B-CRIT-03 | 🔴 OTEVŘENO |

**Spuštění MainNetu je podmíněno tím, že VŠECHNA kritéria B-CRIT budou UZAVŘENÁ (zelená).**

Historické cílové okno v tomto snapshotu: **31. prosince 2026**

---

## Připravenost protokolu

### L1 Blockchain ✅

- [x] Cosmic Harmony v3 PoW — odolnost vůči ASIC, šetrnost k CPU
- [x] Model UTXO + podpisy Ed25519
- [x] Emise Decade Decay (5 400 → 725 ZION/blok přes 100+ let)
- [x] 16,28 mld. genesis premine — všechny kategorie definované a transparentní
- [x] LWMA DAA (60 bloků, ±25 %)
- [x] 100 % burn poplatků
- [x] Dual mining: ZION (CHv3) + VRSC (VerusHash)
- [x] Mining pool: Stratum v2 PPLNS, split 89 % / 5 % / 5 % / 1 %
- [x] P2P sync: IBD, 3 regiony seedů online
- [x] 52 590 řádků Rustu v 5 crates
- [x] 780+ testů, 0 selhání

### L2 Bridge 🔄

- [x] wZION ERC-20 nasazen na Base Sepolia (testnet)
- [x] Lock/Mint Guardian relay: 3-of-3 multi-sig
- [x] Finálnost 60 bloků
- [ ] Bezpečnostní audit bridge kontraktů
- [ ] Nasazení na Base Mainnet

### L3 ZION DAO / WARP ⏳

- [ ] Finalizace návrhu BTC HTLC
- [ ] Audit ETH Ethereum bridge
- [ ] Architektura modelu AI Native Zion
- [ ] Program Solana SPL (po BTC a ETH)

---

## Zdraví sítě (živě)

| Metrika | Hodnota |
|---------|---------|
| Seed uzly | 3/3 (Helsinki · USA · Asie) |
| Soudržnost syncu | 100 % |
| Dostupnost poolu | 99 %+ |
| Interval telemetrie | 30 sekund |
| Procházející testy | 780+ |

---

## Genesis premine — veřejný záznam

Všechny genesis alokace jsou veřejně zveřejněny. Neexistují soukromé ani skryté alokace.

| Kategorie | Částka ZION | % nabídky | Zámek |
|-----------|-------------|-----------|-------|
| ZION OASIS + Winners | 4 950 000 000 | 3,44 % | Okamžitě |
| DAO Treasury | 4 000 000 000 | 2,78 % | Okamžitě |
| Infrastruktura | 2 590 000 000 | 1,80 % | Okamžitě |
| Humanitární rezerva | 1 440 000 000 | 1,00 % | Okamžitě |
| **Celkem genesis** | **16 280 000 000** | **11,31 %** | — |

Zbývajících **88,69 %** (127,72 mld. ZION) se emituje těžbou PoW přes 100+ let.

Plný seznam premine adres:
- `/PREMINE_ADDRESSES_PUBLIC.txt` ve veřejném repozitáři
- On-chain v genesis bloku (ověřitelné kdokoli)

---

## Bezpečnostní politika

- Zranitelnosti hlaste přes GitHub Security Advisories (soukromé zveřejnění)
- Žádné admin backdoory, žádný escrow klíčů, žádné upgrade klíče
- Guardian multi-sig u bridge: komunitně řízené 3-of-3
- Všechny smart kontrakty budou auditovány před mainnet launch bridge

---

## Roadmap k MainNetu

| Milník | Cíl | Stav |
|--------|-----|------|
| v2.9.5 Native Awakening | 2025 | ✅ Hotovo |
| v2.9.6 On the Star | úno 2026 | ✅ Hotovo |
| v2.9.7 Pre-MainNet Gate | bře 2026 | ✅ Současné |
| Bezpečnostní audit | Q2 2026 | 📋 Plán |
| Bridge Mainnet | Q3 2026 | 📋 Plán |
| Okno stability TestNetu | Q3–Q4 2026 | 📋 Plán |
| **Spuštění MainNetu** | **31. 12. 2026** | Historické cílové okno |
