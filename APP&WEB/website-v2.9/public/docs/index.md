# ZION TerraNova — Dokumentace v2.9.6

> *„On the Star — where technology meets spirit, from blockchain to the stars."*
> **Operational note (2026-03-23):** Public docs entrypoint now tracks the live 2.9.9 Pure Code release line on top of the 2.9.8 Deeksha canonical runtime, on one public host: Zion2 (91.98.122.165), with internal seed containers behind the same stack.

---

## Přehled projektu

ZION je decentralizovaný Layer 1 blockchain postavený od nuly v **Rustu**. Využívá Proof-of-Work konsenzus s kanonickou veřejnou cestou **Cosmic Harmony Deeksha** vystavenou jako `cosmic_harmony`, s CPU i GPU implementacemi.

**v2.9.6** je hard fork rozšiřující v2.9.5 o **6-vrstvou architekturu „On the Star"**, emisní plán **Decade Decay** na **100+ let** a dedikované financování planetárních projektů včetně vesmírné stanice **ZION Issobella**.

---

## Parametry řetězce

| Parametr | Mainnet | Testnet |
|----------|---------|---------|
| **Chain ID** | `zion-mainnet-1` | `zion-testnet-1` |
| **P2P port** | 8333 | 8334 |
| **RPC port** | 8443 | 8444 |
| **Algoritmus** | Cosmic Harmony Deeksha (`cosmic_harmony`) | Cosmic Harmony Deeksha (`cosmic_harmony`) |
| **Block time** | 60 s | 60 s |
| **Block reward** | 5 400,067 → Decade Decay (-20%/10 let) | Decade Decay |
| **Tail emission** | 724,785 ZION/blok (od 2126) | 724,785 ZION |
| **DAA** | LWMA (60 bloků, ±25%) | LWMA (60 bloků) |
| **Celková emise** | 144 mld ZION | 144 mld ZION |
| **Mining horizont** | 100+ let + tail ∞ | 100+ let |
| **Poplatky** | Spalovány (burn) | Spalovány |
| **Architektura** | 6-Layer „On the Star" | 6-Layer |

---

## Block Reward distribuce

| Příjemce | Podíl |
|----------|-------|
| ⛏️ Miners | 89% |
| 🕊️ Humanitarian Tithe | 5% |
| 🔭 L5/L6 Issobella Fund | 5% |
| 🏊 Pool Fee | 1% |

---

## 6-Layer „On the Star" architektura

| Vrstva | Název | Rok | Účel |
|--------|-------|-----|------|
| **L1** | ZION TerraNova ⛏️ | 2026 | PoW blockchain — CHv3, UTXO, fee burn |
| **L2** | NCL 🧠 | 2027 | Neural Conscious Layer — AI protokol |
| **L3** | ZION DAO 🏛️ | 2028 | Decentralizovaná governance, Treasury |
| **L4** | ZION Oasis 🎮 | 2029+ | Ekonomický ekosystém — Golden Egg, NFT |
| **L5** | ZION Free World 🌍 | 2030 | Kvantová energie, humanitární mise |
| **L6** | ZION Issobella 🔭 | 2040+ | Orbitální observatoř a výzkumná stanice |

---

## Aktivní veřejný host

| Role | IP | P2P | RPC |
|------|----|-----|-----|
| Zion2 public host | 91.98.122.165 | :8334 | :8444 |

Interní kontejnery `zion-seed-1` a `zion-seed-2` běží za tímto hostem a nejsou samostatné veřejné bootstrap entrypointy.

---

## Premine distribuce (16,28 mld ZION — 11,31%)

| Fond | Množství | Podíl |
|------|----------|-------|
| ZION Oasis + Golden Egg | 8,25 mld | 50,7 % |
| DAO Treasury | 4,00 mld | 24,6 % |
| Infrastruktura | 2,59 mld | 15,9 % |
| Humanitární fond | 1,44 mld | 8,8 % |

Vše on-chain ověřitelné, plně odemčeno od geneze. Governance spravuje DAO.

---

## Rychlé odkazy

- [Quick Start →](#getting-started)
- [Mining průvodce →](#mining-guide)
- [API Reference →](#api)
- [v2.9.6 Changelog →](#v296-changelog)
- [Tokenomics →](#v296-tokenomics)
- [6-Layer Architektura →](#v296-layer-architecture)
- [Whitepaper →](#whitepaper-full)
- [GitHub — Zion-TerraNova](https://github.com/Zion-TerraNova)
- [Web — zionterranova.com](https://www.zionterranova.com)

---

## Repozitáře

| Repo | Popis |
|------|-------|
| [2.9.6](https://github.com/Zion-TerraNova/2.9.6) | Hlavní repo — workspace baseline 2.9.6, live public release line 2.9.9, Deeksha/Ekam runtime a Docker |
| [v3-Mainnet](https://github.com/Zion-TerraNova/v3-Mainnet) | Příprava Mainnet launche |
| [2.9-QuantumLeap](https://github.com/Zion-TerraNova/2.9-QuantumLeap) | Python miner a nástroje |
| [Zion-TestNet2.8.5](https://github.com/Zion-TerraNova/Zion-TestNet2.8.5) | Historický testnet |

---

*ZION TerraNova workspace 2.9.6 • public release line 2.9.9 Pure Code • canonical runtime 2.9.8 Deeksha • Dokumentace aktualizována březen 2026*
