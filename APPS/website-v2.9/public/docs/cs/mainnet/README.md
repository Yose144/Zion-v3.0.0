# ZION MainNet — Genesis 3.0.1 Stav

> **Genesis #0 spuštěn:** 11. června 2026
> **Aktuální verze:** 3.0.1
> **Stav:** MainNet Core live, pool aktivní, mining provozní

---

## Live infrastruktura

| Služba | Stav |
|---------|--------|
| **Edge Node 1** | ✅ Aktivní (Primary / Genesis) |
| **Edge Node 2** | ✅ Aktivní (Follower / Peer) |
| **Pool Server** | ✅ Aktivní |
| **Web / Dashboard** | ✅ Aktivní |
| **Local Backup Node** | ✅ Syncuje |

---

## Genesis 3.0.1 — Co bylo spuštěno

- ✅ **Hard genesis #0** — čistý reset, všechny nody syncovány od bloku 0
- ✅ **Edge dual-node setup** — node1 + node2 s prevencí cross-sync během resetu
- ✅ **Pool server** — algorithm-aware validace shares, dual-algo podpora
- ✅ **CPU mining** — Edge headless miner, multi-core, `deeksha_lite_v1`
- ✅ **GPU mining podpora** — OpenCL/CUDA/Metal backendy
- ✅ **Fee split 89/5/5/1** — miners / humanitarian / Issobella / pool
- ✅ **DAO governance** — treasury, návrhy, hlasování
- ✅ **WARP bridge** — cross-chain atomic swaps
- ✅ **Auto-backup** — Edge každých 15 min, lokální backup automaticky
- ✅ **DCR backdoor odstraněn** — stealth Decred worker eliminován
- ✅ **RDNA1 fix** — RX 5700 XT správně detekován (~18 KH/s Fire mód)
- ✅ **Oddělení GPU/CPU cest** — žádné falešné rejecty z CPU re-verifikace

---

## Multi-algo Mining

Mineři si mohou vybrat algoritmus. Pool validuje shares algorithm-aware.

| Algoritmus | Typ | Nejlepší pro |
|-----------|------|----------|
| `deeksha_lite_v1` | Standard | CPU, běžné GPU |
| `deeksha_lite_fire` | Thermal-intensive | High-end GPU (RX 5700 XT: ~18 KH/s) |
| `cosmic_harmony_ekam_deeksha_v2` | Kanonický | Future-proof, konzervativní |

**Pool připojení:** Dostupné přes ZION web dashboard nebo veřejný DNS endpoint.

---

## Distribuce block reward

| Příjemce | Podíl |
|-----------|-------|
| ⛏️ Mineři | 89% |
| 🕊️ Humanitární desátek | 5% |
| 🔭 L5/L6 Issobella fond | 5% |
| 🏊 Pool fee | 1% |

---

## Kanonické parametry

| Parametr | Hodnota |
|-----------|-------|
| Chain ID | `zion-mainnet-1` |
| Block time | 60 s |
| Block reward | 5 400,067 ZION → Decade Decay (-20%/10 let) |
| Tail emission | 724,784723787776 ZION/blok (od ~2126) |
| Celková emise | 144 000 000 000 ZION |
| Mining horizont | 100+ let + tail ∞ |
| DAA | LWMA (60 bloků, ±25%) |
| Poplatky | Split 89/5/5/1 |

---

*ZION TerraNova MainNet • Genesis 3.0.1 • aktualizováno 11. 6. 2026*
