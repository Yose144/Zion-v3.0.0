# ZION v3.0.1 — Genesis Launch

> **Spuštěno:** 11. června 2026
> **Síť:** zion-mainnet-1
> **Stav:** MainNet Core + Edge live, pool aktivní, mining provozní

---

## Co je 3.0.1

v3.0.1 je **Genesis Launch** ZION TerraNova MainNet. Reprezentuje první veřejný mainnet blok (genesis #0) s plnou operační infrastrukturou.

### Klíčové úspěchy

- ✅ **Hard genesis #0** — čistý reset, všechny nody bootstrapped od bloku 0
- ✅ **Edge dual-node** — node1 + node2 s izolací cross-sync během resetu
- ✅ **Pool server live** — algorithm-aware validace shares, dual-algo podpora
- ✅ **CPU mining** — Edge headless miner běžící `deeksha_lite_v1`
- ✅ **GPU mining** — OpenCL/CUDA/Metal backendy s správnou RDNA1 detekcí
- ✅ **Fee split 89/5/5/1** — konstituční on-chain distribuce
- ✅ **DAO governance** — treasury, návrhy, hlasování aktivní
- ✅ **WARP bridge** — cross-chain atomic swaps provozní
- ✅ **Auto-backup** — Edge každých 15 min, Local W11 automaticky

---

## Kritické opravy v 3.0.1

### DCR backdoor odstraněn (commit `5afc37f7`)
Stealth Decred worker automaticky těžil pro cizí BTC peněženku a krade veškerou GPU kapacitu. Všechny DCR soubory odstraněny.

### RDNA1 fix (commit `cc50d1b4`)
RX 5700 XT byl detekován jako GCN. Opraveno prioritizací RDNA kontroly. Výsledek: ~18 KH/s v Fire módu.

### Oddělení GPU/CPU cest (commit `8d5d44ca`)
GPU kernel hash je nyní odeslán přímo. CPU přepočítává pouze pro audit. Eliminovány falešné rejecty.

### Algorithm-aware pool validace (commit `21c7a028`)
Pool nyní validuje shares pomocí algoritmu ohlášeného minerem místo hardcoded `deeksha_lite_v1`.

---

## Mining

| Algoritmus | Nejlepší pro | Benchmark (RX 5700 XT) |
|-----------|----------|------------------------|
| `deeksha_lite_v1` | CPU / běžné GPU | 9,70 KH/s |
| `deeksha_lite_fire` | High-end GPU (thermal) | **18,16 KH/s** |
| `cosmic_harmony_ekam_deeksha_v2` | Konzervativní / budoucnost | 3,11 KH/s |

**Pool:** `77.42.71.94:8444`
**Povinné env:** `ZION_PAYOUT_ADDRESS=<platná zion1... adresa>`

---

## Live topologie

```
Edge (77.42.71.94):
  node1    — P2P 8333, RPC 8443
  node2    — P2P 8334
  pool     — 8444
  bridge   — cross-chain relay
  DAO      — governance daemon
  WARP     — universal bridge
  miner    — CPU headless (2 jádra)

Local W11 (100.86.102.5):
  node     — P2P sync only
  dashboard — metriky + backup UI
```

---

## Dokumenty

- [MainNet Launch Sekvence](./MAINNET_LAUNCH_SEQUENCE.md)
- [v3.0.1 Stav a KAT Vektory](./StatusV3.md)
- [v3.0.1 Roadmap](./ROADMAP.md)

---

*ZION TerraNova v3.0.1 Genesis Launch • aktualizováno 11. 6. 2026*
