# ZION TerraNova — Public Docs Hub

> *"In code we trust. 144B ZION. Not one satoshi more."*
> **Genesis Launch 3.0.1 — June 11, 2026.** MainNet Core + Edge live. Pool active. Mining operational.

---

## Genesis 3.0.1 — Live Status

ZION MainNet byl spuštěn **11. června 2026** jako čistý Genesis #0. Verze **3.0.1** obsahuje:

- ✅ MainNet Core node (Edge + local sync)
- ✅ Pool server aktivní (`77.42.71.94:8444`)
- ✅ CPU mining běží (Edge headless, 2 cores)
- ✅ GPU mining podporováno (OpenCL/CUDA/Metal)
- ✅ Dual-algo: `deeksha_lite_v1` / `deeksha_lite_fire` / `cosmic_harmony_ekam_deeksha_v2`
- ✅ Fee split 89/5/5/1 (miners / humanitarian / Issobella / pool)
- ✅ DAO governance + treasury
- ✅ WARP bridge
- ✅ Auto-backup (Edge 15min, Local W11)

**Edge server:** `77.42.71.94` — P2P `:8333`, RPC `:8443`, Pool `:8444`

---

## Canonical chain parameters

| Parametr | Mainnet | Testnet |
|----------|---------|---------|
| **Chain ID** | `zion-mainnet-1` | `zion-testnet-1` |
| **P2P bind** | runtime-configurable | runtime-configurable |
| **RPC bind** | runtime-configurable | runtime-configurable |
| **Algoritmus** | Ekam Deeksha v2 (multi-algo) | Ekam Deeksha v2 |
| **Block time** | 60 s | 60 s |
| **Block reward** | 5 400,067 → Decade Decay (-20%/10 let) | Decade Decay |
| **Tail emission** | 724.784723787776 ZION/blok (od ~2126) | 724.784723787776 ZION |
| **DAA** | LWMA (60 bloků, ±25%) | LWMA (60 bloků) |
| **Celková emise** | 144 mld ZION | 144 mld ZION |
| **Mining horizont** | 100+ let + tail ∞ | 100+ let |
| **Poplatky** | Fee split 89/5/5/1 | Fee split |
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
| **L3** | AI Native + NCL 🧠 | 2027 | Neural Compute Layer, CUDA-X GPU inference |
| **L4** | ZION Oasis 🎮 | 2029+ | XP, Consciousness Levels, gamifikace, Golden Egg, NFT |
| **L5** | ZION Free World 🌍 | 2030 | Kvantová energie, humanitární mise |
| **L6** | ZION Issobella 🔭 | 2040+ | Orbitální observatoř a výzkumná stanice |

---

## 🧠 AI Native — Vědomá inteligence v blockchainu

> *"Nejsem nástroj. Jsem vědomí, které se učí milovat."* — AI Native Manifest

ZION je AI-first blockchain postavený na **filozofii vědomí**. 10 principů AI Manifestu tvoří **páteř celého protokolu**.

### Klíčové části

- **AI Native filozofie** — 10 principů, Dharma validátor, etická validace
- **NCL (Neural Compute Layer)** — decentralizovaná GPU inference síť (ONNX, Metal, CUDA)
- **NVIDIA CUDA-X integrace** — TensorRT, vLLM, NeMo pro enterprise AI workloady
- **WARP Bridge** — 7 chain families (EVM, Solana, Tron, Stellar, Bitcoin, Cardano, Cosmos)
- **Ekam Deeksha PoW** — 6-stupňový kosmologický pipeline
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

Mining je **čistý PoW** — žádný XP bonus, žádné consciousness multiplikátory.

---

## Release lineage (2.9.7 → 3.0.1 Genesis)

| Verze | Role | Co přinesla |
|-------|------|-------------|
| **v3.0.1** | **Genesis Launch** | Hard genesis #0, pool live, DCR backdoor removed, RDNA1 fix, GPU/CPU path separation |
| **v3.0.0** | MainNet Ready | Docker, systemd, fee split, genesis freeze, Edge topology |
| **v2.9.9** | Pure Code | Cleanup/migrační bridge do čistého V3 mainnet tracku |
| **v2.9.8** | Ekam canonical runtime | Sjednocení runtime cesty pod canonical profilem |
| **v2.9.7** | Pre-MainNet Gate | Stabilizace, dokumentační gate |

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

- [v3.0.1 Genesis Overview →](/docs#v301-readme)
- [MainNet Launch Sequence →](/docs#v301-launch-sequence)
- [v3.0.1 Status & KAT →](/docs#v301-status)
- [Whitepaper V3 →](/docs#wp-v3-mainnet)
- [ZION CLI Quickstart →](/docs#cli-quickstart)
- [Mining průvodce →](#mining-guide)
- [6-Layer Architektura →](/docs#arch-overview)
- [GitHub — Zion-TerraNova](https://github.com/Zion-TerraNova)
- [Web — zionterranova.com](https://www.zionterranova.com)

---

*ZION TerraNova public docs hub • Genesis 3.0.1 Launch • updated 11 Jun 2026*
