# Changelog — ZION TerraNova

---

## [v2.9.7] — březen 2026 · Pre-MainNet Gate

**Beze změny konsenzu.** Parametry protokolu, emisní plán a kryptografická primitiva jsou totožná s v2.9.6.

### Co se změnilo

- **Stabilita TestNetu**: Tři seed uzly (Helsinki, USA, Asie) nepřetržitě. Bez forků, bez splitů konsenzu.
- **Test suite**: 780+ testů napříč Rust crates — 0 selhání. CI prochází.
- **Pool**: PPLNS distribuce odměn potvrzena ve škále. Telemetrie obnova každých 30 s.
- **Dokumentace**: Veřejné docs restrukturované a verzované. v2.9.7 CURRENT, v2.9.6 PREVIOUS, v2.9.5 ARCHIVE. Interní provozní data odstraněna z veřejných textů.
- **Web**: Veřejné stránky sjednocené v jednom layoutu. Explorer, Dashboard, Mining, Bridge, DAO, Warp, Docs, Download, Admin.
- **Dual mining**: ZION (Cosmic Harmony v3) + VRSC (VerusHash) potvrzeno paralelně.

### Stav bridge

- Kontrakt wZION ERC-20: nasazen a otestován na Base Sepolia (testnet)
- Lock/Mint Guardian relay: provozní, 3-of-3 multi-sig
- Finálnost 60 bloků funguje
- Mainnet nasazení: čeká na bezpečnostní audit

---

## [v2.9.6] — únor 2026 · „On the Star“

Hard fork zavádějící **6vrstvou architekturu „On the Star“**.

### Hlavní změny

- **Decade Decay emise**: odměna za blok klesá −20 % každých 10 let, tail 725 ZION/blok — horizont těžby z ~45 na 100+ let
- Definovaná **6vrstvá architektura**: L1 (ZION TerraNova) až L6 (orbitální stanice ZION Issobella)
- **Humanitární odvod**: 5 % každé odměny Humanitární fond, 5 % Nadace Issobella — v protokolu
- **52 590 řádků Rustu** v 5 crates: core, miner, pool, bridge, native-libs
- **780+ testů** napříč crates
- **wZION Bridge**: počáteční L2 architektura s Base EVM (Sepolia testnet)
- **Mining pool**: Stratum v2 PPLNS, split 89/5/5/1 %, LMDB perzistence
- Redesign webu s kosmickým pozadím observatoře

---

## [v2.9.5] — 2025 · „Native Awakening“

Plný changelog viz [docs/v2.9.5](../v2.9.5/).

Shrnutí: Cosmic Harmony v3 PoW, UTXO + Ed25519, LWMA DAA, LMDB, genesis premine plně zveřejněna, fair launch (bez presale).

---
