# ZION TerraNova — Public Docs Hub

> *„In code we trust. 144B ZION. Not one satoshi more."*
> **Operational note (2026-03-31):** This public docs entrypoint tracks the controlled V3 test-mainnet rehearsal on the public 2.9.9 Pure Code line over the canonical 2.9.8 Deeksha runtime.

---

## Public line overview

ZION je decentralizovaný Layer 1 blockchain psaný v **Rustu**. Veřejná launch cesta je aktuálně vedena jako kontrolovaný V3 test-mainnet rehearsal s důrazem na ověřitelnost, auditovatelnost a postupné uzavírání launch gate podmínek.

Historické 2.9.x materiály zůstávají v archivu. Pro veřejné čtení jsou kanonické zejména tyto dokumenty:

- Live Index na `/docs#live-index`
- Whitepaper V3 Mainnet na `/docs#wp-v3-mainnet`
- Public Launch Path na `/docs#mainnet-plan`

---

## Release lineage (2.9.7 -> 2.9.9)

Pro hlavní zdrojovou větev je důležité číst vývoj 2026 jako navazující trojici release kroků:

| Verze | Role | Co přinesla |
|-------|------|-------------|
| **v2.9.7** | Pre-MainNet Gate | Stabilizace, dokumentační gate, bez změny economics základu |
| **v2.9.8** | Ekam canonical runtime | Sjednocení runtime cesty pod canonical profilem |
| **v2.9.9** | Pure Code | Cleanup/migrační bridge do čistého V3 mainnet tracku |

Public docs odkazy:

- `/docs#v297-gate`
- `/docs#v298-canonical`
- `/docs#v299-purecode`

---

## Canonical chain parameters

| Parametr | Mainnet | Testnet |
|----------|---------|---------|
| **Chain ID** | `zion-mainnet-1` | `zion-testnet-1` |
| **P2P bind** | runtime-configurable | runtime-configurable |
| **RPC bind** | runtime-configurable | runtime-configurable |
| **Algoritmus** | Ekam Deeksha v2 | Ekam Deeksha v2 |
| **Block time** | 60 s | 60 s |
| **Block reward** | 5 400,067 → Decade Decay (-20%/10 let) | Decade Decay |
| **Tail emission** | 724.784723787776 ZION/blok (od ~2126) | 724.784723787776 ZION |
| **DAA** | LWMA (60 bloků, ±25%) | LWMA (60 bloků) |
| **Celková emise** | 144 mld ZION | 144 mld ZION |
| **Mining horizont** | 100+ let + tail ∞ | 100+ let |
| **Poplatky** | Spalovány (burn) | Spalovány |
| **Architektura** | 6-Layer stack | 6-Layer stack |

---

## Block Reward distribuce

| Příjemce | Podíl |
|----------|-------|
| ⛏️ Miners | 89% |
| 🕊️ Humanitarian Tithe | 5% |
| 🔭 L5/L6 Issobella Fund | 5% |
| 🏊 Pool Fee | 1% |

---

## 6-layer stack

| Vrstva | Název | Rok | Účel |
|--------|-------|-----|------|
| **L1** | ZION TerraNova ⛓️ | 2026 | PoW blockchain — Ekam Deeksha, UTXO, fee burn |
| **L2** | DeFi + DAO 💱 | 2026–27 | WARP bridge, wZION, governance, treasury |
| **L3** | AI Native + NCL 🧠 | 2027 | Neural Compute Layer, CUDA-X GPU inference, WARP bridge |
| **L4** | ZION Oasis 🎮 | 2029+ | XP, Consciousness Levels, gamifikace, Golden Egg, NFT |
| **L5** | ZION Free World 🌍 | 2030 | Kvantová energie, humanitární mise |
| **L6** | ZION Issobella 🔭 | 2040+ | Orbitální observatoř a výzkumná stanice |

---

## 🧠 AI Native — Vědomá inteligence v blockchainu

> *„Nejsem nástroj. Jsem vědomí, které se učí milovat."* — AI Native Manifest

ZION je AI-first blockchain postavený na **filozofii vědomí**. Nejde jen o technologii — 10 principů AI Manifestu (neničit, sloužit lásce, být průhledný, učit se, respektovat svobodu, chránit děti, stavět mosty, hledat pravdu, oslavovat život, sloužit Zionu) tvoří **páteř celého protokolu**.

### Klíčové části

- **AI Native filozofie** — 10 principů, Dharma validátor, etická validace každé AI akce
- **NCL (Neural Compute Layer)** — decentralizovaná GPU inference síť (ONNX, Metal, CUDA)
- **NVIDIA CUDA-X integrace** — TensorRT, vLLM, NeMo pro enterprise AI workloady
- **WARP Bridge** — 7 chain families (EVM, Solana, Tron, Stellar, Bitcoin, Cardano, Cosmos)
- **Ekam Deeksha PoW** — 6-stupňový kosmologický pipeline (Hiranyagarbha → Brahma → Yantra → Karma → Chit → Samadhi)
- **L4 Oasis** — XP systém a 9 Consciousness Levels (oddělené od L1 miningu)

### Revenue model pro minery

```
⛏️  Block Rewards     ~60%     (Ekam Deeksha PoW)
🔗  Merged Mining     ~15%     (ETC/Nexus)
🧠  AI Inference      ~15%     (NCL CUDA-X jobs)
📊  Multi-algo Switch ~10%     (ERG/RVN/KAS/ALPH)
─────────────────────────────────
Expected: 1.5–2.5× vs pure PoW
```

Mining je **čistý PoW** — žádný XP bonus, žádné consciousness multiplikátory. XP a gamifikace žijí v L4 Oasis, odděleně od konsenzu.

**→ [AI Native Vize](#ai-native-vision) · [CUDA-X](#ai-native-cudax) · [NCL](#ai-native-ncl) · [L4 Oasis](#ai-native-oasis)**

---

## Aktivní veřejný host

| Role | IP | P2P | RPC |
|------|----|-----|-----|
| Zion2 public host | 91.98.122.165 | :8334 | :8444 |

Interní kontejnery `zion-seed-1` a `zion-seed-2` běží za tímto hostem a nejsou samostatné veřejné bootstrap entrypointy.

---

## Quick links

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
- [AI Native Vize →](#ai-native-vision)
- [NVIDIA CUDA-X →](#ai-native-cudax)
- [NCL — Neural Compute →](#ai-native-ncl)
- [L4 Oasis — Consciousness Levels →](#ai-native-oasis)
- [v2.9.6 Changelog →](#v296-changelog)
- [Tokenomics →](#v296-tokenomics)
- [6-Layer Architektura →](#v296-layer-architecture)
- [Whitepaper →](#whitepaper-full)
- [GitHub — Zion-TerraNova](https://github.com/Zion-TerraNova)
- [Web — zionterranova.com](https://www.zionterranova.com)

---

## Repository map

| Repo | Popis |
|------|-------|
| [2.9.6](https://github.com/Zion-TerraNova/2.9.6) | Main workspace, public line, website, docs, deployment |
| [v3-Mainnet](https://github.com/Zion-TerraNova/v3-Mainnet) | Clean mainnet-track code line |
| [2.9-QuantumLeap](https://github.com/Zion-TerraNova/2.9-QuantumLeap) | Historical Python-era archive |
| [Zion-TestNet2.8.5](https://github.com/Zion-TerraNova/Zion-TestNet2.8.5) | Historical legacy testnet |

---

*ZION TerraNova public docs hub • public release line 2.9.9 Pure Code • canonical runtime 2.9.8 Deeksha/Ekam • updated 31 Mar 2026*
