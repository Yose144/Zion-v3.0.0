# ZION TerraNova — 6vrstvá architektura

**Verze:** 2.9.7 · Pre-MainNet Gate  
**Status:** L1 Phase 1 complete · L2–L6 ve vývoji

---

## Přehled

ZION TerraNova je vertikálně integrovaný blockchain ekosystém postavený nativně v **Rustu** napříč šesti odlišnými, ale propojenými vrstvami. Každá vrstva má vlastní doménu odpovědnosti a komunikuje s okolními vrstvami přes definovaná rozhraní.

```text
┌─────────────────────────────────────────────────────────┐
│  L6  🔭 ZION Issobella                                 │
│      Orbitální observatoř · Výzkumná stanice · 2040+   │
├─────────────────────────────────────────────────────────┤
│  L5  🌍 ZION Free World                                │
│      Humanitární mise · Volná energie · Komunity · 2030│
├─────────────────────────────────────────────────────────┤
│  L4  🎮 ZION Oasis                                     │
│      Golden Egg · XP ekonomika · Herní vrstva · 2029   │
├─────────────────────────────────────────────────────────┤
│  L3  🏛️ ZION DAO                                       │
│      Governance · Treasury 4B ZION · proposals · 2028  │
├─────────────────────────────────────────────────────────┤
│  L2  🧠 NCL — Neural Conscious Layer                   │
│      AI-native protokol · wZION bridge · on-chain · 2027│
├─────────────────────────────────────────────────────────┤
│  L1  ⛏️ ZION TerraNova                                 │
│      Rust blockchain · CHv3/CHv4 · pool · P2P · LMDB   │
└─────────────────────────────────────────────────────────┘
```

---

## L1 — Core Protocol

**Jazyk:** Rust (100%)  
**LOC:** 52 590  
**Testy:** 780+  
**Status:** ✅ Phase 1 — TestNet Live

### Komponenty

| Komponenta | Stav | Popis |
|------------|------|-------|
| `core/` | ✅ Live | Block engine, mempool, UTXO, LMDB |
| `miner/` | ✅ Live | CHv3 native GPU/CPU miner |
| `pool/` | ✅ Live | Stratum v2 mining pool |
| `native-libs/` | ✅ Live | FFI bindings, CHv3 kernel |

### Parametry protokolu

| Parametr | Hodnota |
|----------|---------|
| Block time | 60 sekund |
| Block reward | 5 400.067 ZION |
| Algoritmus | Cosmic Harmony v3 (-> v4 ve vývoji) |
| Address prefix | Z3 |
| Signature scheme | Ed25519 |
| Storage | LMDB |
| Network | P2P over TCP/TLS |
| DAA | LWMA (Linearly Weighted Moving Avg) |

---

## L2 — NCL (Neural Conscious Layer)

**Status:** 🔄 Ve vývoji  
**Target:** 2027

### Neural Conscious Layer

- AI-native protokol přímo v blockchainu
- On-chain model registry — modely zaznamenané jako L1 transakce
- Proof-of-Inference: hash(model + input) -> deterministický výstup

### wZION Bridge (součást L2)

- Nativní ZION ↔ wZION (ERC-20) wrapping
- Aktuálně: **Base Sepolia** testnet
- Smart contract: `L2/contracts/wZION.sol`
- Bridge UI: stránka `/bridge`
- Cilkove launch okno pro bridge rollout: Base, Ethereum (Q3-Q4 2026, gated)

---

## L3 — ZION DAO (Governance)

**Status:** 📋 Design fáze  
**Target:** 2028

- On-chain governance smart kontrakty (`L2/dao/`)
- Treasury: 4 000 000 000 ZION (DAO fond z preminingu)
- Proposal lifecycle: Draft -> Vote -> Execute
- Quorum: 10 % staked ZION supply
- Komunitní granty, protokolové upgrady, treasury alokace

---

## L4 — ZION Oasis (Gaming & XP Economy)

**Status:** 📋 Design fáze  
**Target:** 2029

- **Golden Egg** — herní ekonomika postavená na ZION
- **XP systém** — zkušenostní body za mining, bridge a DAO aktivity
- **Winners** — soutěžní vrstva se ZION odměnami
- 8 250 000 000 ZION vyhrazeno z preminingu pro ZION OASIS + Winners

---

## L5 — ZION Free World (Humanitarian)

**Status:** 📋 Vize a plánování  
**Target:** 2030

- **Free Energy Research** — výzkum kvantové a volné energie, open-source hardware
- **Humanitarian Missions** — 5 % block reward automaticky do Humanitarian Fund
- **Free Communities** — off-grid komunity, ZION jako nativní platidlo
- **Education** — open-source vzdělávací platformy
- Fondová podpora: 1 440 000 000 ZION z preminingu + 5 % z každého bloku

---

## L6 — ZION Issobella (Orbital Observatory)

**Status:** 📋 Long-term Vision  
**Target:** 2040+

- **Earth Orbital Observatory** na nízké oběžné dráze (LEO)
- Vědecká výzkumná stanice řízená ZION DAO
- Open data — veškerá pozorování veřejná a on-chain
- **ZION Space Network** — satelitní mesh síť pro P2P redundanci
- **Název:** kombinace ISS (International Space Station) + vlastní jméno Issobella
- Fond: 1 % block reward (Issobella Fund) + sdílený fond s L5

---

## Přehled vrstev

| Vrstva | Název | Rok | Účel |
|--------|-------|-----|------|
| **L1** | ZION TerraNova ⛏️ | 2026 | PoW blockchain — CHv3/CHv4, UTXO, fee burn, LWMA |
| **L2** | NCL 🧠 | 2027 | Neural Conscious Layer — AI-native, wZION bridge |
| **L3** | ZION DAO 🏛️ | 2028 | Governance, Treasury 4B ZION, community grants |
| **L4** | ZION Oasis 🎮 | 2029 | Golden Egg, XP systém, Winners, herní vrstva |
| **L5** | ZION Free World 🌍 | 2030 | Kvantová energie, humanitární mise, free komunity |
| **L6** | ZION Issobella 🔭 | 2040+ | Orbitální observatoř a výzkumná stanice |

---

## Development priorities 2026

```text
Q1 2026 (nyni): L1 stabilizace · docs · launch gate
Q2 2026:        CHv4 upgrade · wZION bridge testnet -> gated rollout
Q3 2026:        L2 NCL prototype · wallet binaries · CoinGecko prep
Q4 2026:        Rozhodovaci okno verejneho launchu · L2/listing az po GO
```

---

*Viz take: [Consensus CHv3→CHv4](consensus.md) · [Verejna launch cesta](../mainnet/README.md)*