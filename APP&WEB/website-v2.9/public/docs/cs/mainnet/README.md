# ZION MainNet — Genesis 3.0.1 Stav

> **Genesis #0 spuštěn:** 11. června 2026
> **Aktuální verze:** 3.0.1
> **Stav:** MainNet Core + Edge live, pool aktivní, mining provozní

---

## Live infrastruktura

| Služba | Host | Port | Stav |
|---------|------|------|--------|
| **Edge Node 1** | 77.42.71.94 | 8333 (P2P) / 8443 (RPC) | ✅ Aktivní |
| **Edge Node 2** | 77.42.71.94 | 8334 (P2P) | ✅ Aktivní |
| **Pool Server** | 77.42.71.94 | 8444 | ✅ Aktivní |
| **Web / Dashboard** | 77.42.71.94 | 3000 | ✅ Aktivní |
| **Local W11 Node** | 100.86.102.5 | 8333 (P2P sync only) | ✅ Syncuje |

---

## Genesis 3.0.1 — Co bylo spuštěno

- ✅ **Hard genesis #0** — čistý reset, všechny nody syncovány od bloku 0
- ✅ **Edge dual-node setup** — node1 + node2 s prevencí cross-sync během resetu
- ✅ **Pool server** — algorithm-aware validace shares, dual-algo podpora
- ✅ **CPU mining** — Edge headless miner, 2 jádra, `deeksha_lite_v1`
- ✅ **GPU mining podpora** — OpenCL/CUDA/Metal backendy
- ✅ **Fee split 89/5/5/1** — miners / humanitarian / Issobella / pool
- ✅ **DAO governance** — treasury, návrhy, hlasování
- ✅ **WARP bridge** — cross-chain atomic swaps
- ✅ **Auto-backup** — Edge každých 15 min, Local W11 automaticky
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

**Pool:** `77.42.71.94:8444`

---

## Distribuce block reward

| Příjemce | Podíl | Adresa |
|-----------|-------|---------|
| ⛏️ Mineři | 89% | Vaše `zion1...` adresa |
| 🕊️ Humanitární desátek | 5% | `zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4` |
| 🔭 L5/L6 Issobella fond | 5% | `zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702` |
| 🏊 Pool fee | 1% | `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604` |

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
