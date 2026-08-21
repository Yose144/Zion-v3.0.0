# ZION TerraNova — Veřejná dokumentace

> *"In code we trust. 144B ZION. Not one satoshi more."*
> **Aktuální veřejná linka: v3.2.0 One Love / Mainnet Stable.**
> Genesis #0: 1. ledna 2026 (timestamp bloku); One Love hard reset 6. srpna 2026.
> Oficiální veřejný launch: 31. prosince 2026.

---

## Živý stav — v3.2.0 One Love

ZION Mainnet běží jako **Mainnet Stable**. Aktuální runtime je **v3.2.0 Ekam Deeksha v3.2** s přesností na 6 desetinných míst a novým genesis hashem po hard resetu v srpnu 2026.

- ✅ Mainnet Core nód — 3-node P2P mesh (Edge 1 + Edge 2 + Local Backup)
- ✅ Pool server aktivní — `stratum+tcp://pool.zionterranova.com:8444`
- ✅ CPU a GPU mining v provozu (OpenCL/CUDA/Metal)
- ✅ Ekam Deeksha dual-algo: `deeksha_lite_v1` / `deeksha_lite_fire`
- ✅ Fee split 89/5/5/1 (mineři / humanitární desátek / Issobella / pool)
- ✅ DAO governance + treasury
- ✅ WARP bridge + atomic swap
- ✅ 11/11 služeb L1–L6 aktivních, watchdog aktivní
- ✅ E2E memo pole potvrzeno v bloku 752

> ⚠️ **Mainnet Beta znamená reálný konsensus, reálné těžení a reálné parametry, ale síť se stále zpevňuje a audituje. Těžte, bridgujte a participujte na vlastní riziko.**

---

## Kanonické parametry řetězce

| Parametr | Mainnet |
|----------|---------|
| **Chain ID** | `zion-mainnet-1` |
| **Genesis hash** | `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb` |
| **Verze protokolu** | `zion-v3-node/3.1.0-alpha` |
| **Algoritmus** | Ekam Deeksha v3.2 (512 KiB, 2 passy, 128 čtení, Keccak-256) |
| **Block time** | 60 s |
| **Block reward** | 5 400,067 ZION → Decade Decay (-20 %/10 let) |
| **Tail emission** | 724,784723787776 ZION/block (od ~2126) |
| **Celková emise** | 144 000 000 000 ZION |
| **Desetinná místa** | 6 (1 ZION = 1 000 000 flowers) |
| **DAA** | LWMA (60 bloků, ±25 %) |
| **Poplatky** | Split 89/5/5/1 |
| **Architektura** | 6-vrstvý stack |

---

## Distribuce block reward

| Příjemce | Podíl |
|----------|-------|
| ⛏️ Mineři | 89 % |
| 🕊️ Humanitární desátek | 5 % |
| 🔭 L5/L6 Issobella fond | 5 % |
| 🏊 Pool fee | 1 % |

---

## 6-vrstvý stack

| Vrstva | Název | Účel |
|--------|-------|------|
| **L1** | ZION TerraNova ⛓️ | PoW blockchain — Ekam Deeksha, UTXO/account model, fee split |
| **L2** | DeFi + DAO 💱 | WARP bridge, wZION, governance, treasury, atomic swap |
| **L3** | AI Native + NCL 🧠 | Neural Compute Layer, CUDA-X GPU inference |
| **L4** | ZION Oasis 🎮 | Consciousness Levels, gamifikace, Golden Egg |
| **L5** | ZION Free World 🌍 | Humanitární mise, komunitní vrstva |
| **L6** | ZION Issobella 🔭 | Orbitální observatoř a výzkumná stanice (horizont) |

---

## Release lineage

| Verze | Role | Co přinesla |
|-------|------|-------------|
| **v3.2.0** | **One Love / Mainnet Stable** | Hard reset v srpnu 2026 — kompletní rotace klíčů, kanonický Ekam Deeksha v3.2, V31 native genesis, 5/5 core služeb aktivních |
| **v3.1.0** | Mainnet Alpha | V31 cut-over, veřejný RPC/pool/DAO/OASIS/web/marketplace live |
| **v3.0.5** | **All Green / Mainnet Beta** | Nový genesis hash po hard resetu, 3-node mesh, 11/11 služeb aktivních, E2E memo testy, opravy zabezpečení F1/F5/F4.7 nasazeny |
| **v3.0.4** | Hard Genesis Reset | Nový server zprovozněn, regenerace klíčů, full stack rebuild |
| **v3.0.3** | Decimal Fork | `1e12` → `1e6` flower scale |
| **v3.0.1** | Genesis Launch (historický) | První veřejný mainnet blok #0 — viz [historický přehled](/docs#v301-readme) |
| **v3.0.0** | MainNet Ready | Docker, systemd, fee split, genesis freeze, Edge topologie |
| **v2.9.9** | Pure Code | Cleanup / migrační bridge do čistého V3 mainnet tracku |
| **v2.9.8** | Ekam kanonický runtime | Sjednocení runtime pod kanonickým profilem |
| **v2.9.7** | Pre-MainNet Gate | Stabilizace a dokumentační předstartovní brána |

---

## Rychlé odkazy

- [Stav mainnetu a přechod →](/docs#mainnet)
- [Veřejný release — jak použít →](/docs#mainnet-public-release)
- [Whitepaper V3 →](/docs#wp-v3-mainnet)
- [ZION CLI rychlý start →](/docs#cli-quickstart)
- [6-vrstvá architektura →](/docs#arch-overview)
- [Stav sítě →](https://zionterranova.com/network)
- [Explorer →](https://zionterranova.com/explorer)
- [Pool →](https://zionterranova.com/pool)
- [GitHub — v3-Mainnet](https://github.com/Zion-TerraNova/v3-Mainnet)
- [Web — zionterranova.com](https://zionterranova.com)

---

*ZION TerraNova veřejná dokumentace • v3.2.0 One Love / Mainnet Stable • aktualizováno 11. 8. 2026*
