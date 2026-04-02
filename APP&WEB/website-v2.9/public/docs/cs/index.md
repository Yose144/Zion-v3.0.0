# ZION TerraNova — Veřejný hub dokumentace

> *„In code we trust. 144B ZION. Not one satoshi more."*
> **Provozní poznámka (2026-03-31):** Tento veřejný vstup do dokumentace sleduje kontrolovaný V3 test-mainnet rehearsal na veřejné linii 2.9.9 Pure Code nad kanonickým runtime 2.9.8 Deeksha.

---

## Přehled veřejné linie

ZION je decentralizovaný blockchain Layer 1 psaný v **Rustu**. Veřejná launch cesta je aktuálně vedena jako kontrolovaný V3 test-mainnet rehearsal s důrazem na ověřitelnost, auditovatelnost a postupné uzavírání launch gate podmínek.

Historické materiály řady 2.9.x zůstávají v archivu. Pro veřejné čtení jsou dnes kanonické hlavně tyto dokumenty:

- Live Index na `/docs#live-index`
- Whitepaper V3 Mainnet na `/docs#wp-v3-mainnet`
- Public Launch Path na `/docs#mainnet-plan`

---

## Release lineage (2.9.7 -> 2.9.9)

Pro hlavní zdrojovou větev je důležité číst vývoj roku 2026 jako navazující trojici release kroků:

| Verze | Role | Co přinesla |
|-------|------|-------------|
| **v2.9.7** | Pre-MainNet Gate | Stabilizaci, dokumentační gate a provozní uzávěry bez změny economics základu |
| **v2.9.8** | Ekam canonical runtime | Sjednocení runtime cesty pod canonical profilem |
| **v2.9.9** | Pure Code | Cleanup a migrační most do čistého V3 mainnet tracku |

Veřejné docs odkazy:

- `/docs#v297-gate`
- `/docs#v298-canonical`
- `/docs#v299-purecode`

---

## Kanonické parametry chainu

| Parametr | Mainnet | Testnet |
|----------|---------|---------|
| **Chain ID** | `zion-mainnet-1` | `zion-testnet-1` |
| **P2P bind** | runtime-configurable | runtime-configurable |
| **RPC bind** | runtime-configurable | runtime-configurable |
| **Algoritmus** | Ekam Deeksha v2 | Ekam Deeksha v2 |
| **Čas bloku** | 60 s | 60 s |
| **Odměna za blok** | 5 400,067 -> Decade Decay (-20 % / 10 let) | Decade Decay |
| **Tail emission** | 724.784723787776 ZION/blok (od ~2126) | 724.784723787776 ZION |
| **DAA** | LWMA (60 bloků, +-25 %) | LWMA (60 bloků) |
| **Celková emise** | 144 mld ZION | 144 mld ZION |
| **Mining horizont** | 100+ let + tail inf | 100+ let |
| **Poplatky** | Spalovány (burn) | Spalovány |
| **Architektura** | 6-Layer stack | 6-Layer stack |

---

## Distribuce block rewardu

| Příjemce | Podíl |
|----------|-------|
| ⛏️ Miners | 89% |
| 🕊️ Humanitarian Tithe | 5% |
| 🔭 L5/L6 Issobella Fund | 5% |
| 🏊 Pool Fee | 1% |

---

## 6vrstvý stack

| Vrstva | Název | Rok | Účel |
|--------|-------|-----|------|
| **L1** | ZION TerraNova ⛓️ | 2026 | PoW blockchain, Ekam Deeksha, UTXO, fee burn |
| **L2** | DeFi + DAO 💱 | 2026–27 | WARP bridge, wZION, governance, treasury |
| **L3** | NCL + WARP + AI-native 🧠 | 2027 | Compute orchestrace, cross-chain adaptéry, agent tooling |
| **L4** | ZION Oasis 🎮 | 2028+ cíl | XP, game economy, Golden Egg, NFT, non-consensus vrstva |
| **L5** | ZION Free World 🌍 | 2030 | Kvantová energie, humanitární mise |
| **L6** | ZION Issobella 🔭 | 2040+ | Orbitální observatoř a výzkumná stanice |

---

## Veřejné shrnutí genesis reserve

ZION používá **16.28B ZION genesis reserve** pro bootstrap ekosystému. Veřejné docs záměrně nevedou wallet-level operační detail v hlavním vstupním dokumentu.

**Primární strategická obálka:** **8.5B ZION** je vyhrazeno pro L4 OASIS a bootstrap herního vývoje.

| Bucket | ZION | Účel |
|--------|------|------|
| OASIS Golden Egg | 8.25B | L4 reward pool a game-economy reserve |
| Ecosystem bootstrap | 0.25B | Game-dev execution envelope |
| DAO Treasury total | 4.00B | Governance, granty, koordinace ekosystému |
| Core development + infrastructure | 2.59B | Runtime, operace, delivery |
| Humanitarian seed | 1.44B | Okamžité humanitární nasazení |

XP a consciousness mechaniky patří do **L4 OASIS** a **nemění** L1 consensus ani mining rewards.

---

## Aktivní veřejný host

| Role | IP | P2P | RPC |
|------|----|-----|-----|
| Zion2 public host | 91.98.122.165 | :8334 | :8444 |

Interní kontejnery `zion-seed-1` a `zion-seed-2` běží za tímto hostem a nejsou samostatné veřejné bootstrap entrypointy.

---

## Rychlé odkazy

- [Live Index →](#live-index)
- [Whitepaper V3 Mainnet →](#wp-v3-mainnet)
- [Public Launch Path →](#mainnet-plan)
- [Release Lineage v2.9.7 →](#v297-gate)
- [Release Lineage v2.9.8 →](#v298-canonical)
- [Release Lineage v2.9.9 →](#v299-purecode)
- [CoinGecko Checklist →](#coingecko-checklist)
- [GitHub — Zion-TerraNova](https://github.com/Zion-TerraNova)
- [Web — zionterranova.com](https://www.zionterranova.com)

---

## Mapa repozitářů

| Repo | Popis |
|------|-------|
| [2.9.6](https://github.com/Zion-TerraNova/2.9.6) | Hlavní workspace, veřejná linie, web, docs, deployment |
| [v3-Mainnet](https://github.com/Zion-TerraNova/v3-Mainnet) | Čistá mainnet-track code line |
| [2.9-QuantumLeap](https://github.com/Zion-TerraNova/2.9-QuantumLeap) | Historický archiv Python éry |
| [Zion-TestNet2.8.5](https://github.com/Zion-TerraNova/Zion-TestNet2.8.5) | Historický legacy testnet |

---

*ZION TerraNova public docs hub • veřejná release line 2.9.9 Pure Code • kanonický runtime 2.9.8 Deeksha/Ekam • aktualizováno 31. 3. 2026*