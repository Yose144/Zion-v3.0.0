# ZION v3.0.1 — Genesis Launch

> **Spuštěno:** 11. června 2026
> **Síť:** zion-mainnet-1
> **Stav:** MainNet Core live, pool aktivní, mining provozní
>
> **⚠️ Historický dokument.** Tahle stránka popisuje původní **v3.0.1 Genesis Launch** z 11. června 2026.
> Aktuální veřejná linka je **v3.0.5 All Green / Mainnet Beta** běžící na novém genesis hash po hard resetu v červenci 2026.
> Aktuální stav, časovou osu a shrnutí bezpečnostních incidentů najdete v [mainnet/README.md](../mainnet/README.md).

---

## Co je 3.0.1

v3.0.1 je **Genesis Launch** ZION TerraNova MainNet. Reprezentuje první veřejný mainnet blok (genesis #0) s plnou operační infrastrukturou.

### Klíčové úspěchy

- ✅ **Hard genesis #0** — čistý reset, všechny nody bootstrapped od bloku 0
- ✅ **Edge dual-node** — primary + follower s izolací cross-sync během resetu
- ✅ **Pool server live** — algorithm-aware validace shares, dual-algo podpora
- ✅ **CPU mining** — headless miner běžící `deeksha_lite_v1`
- ✅ **GPU mining** — OpenCL/CUDA/Metal backendy s správnou RDNA1 detekcí
- ✅ **Fee split 89/5/5/1** — konstituční on-chain distribuce
- ✅ **DAO governance** — treasury, návrhy, hlasování aktivní
- ✅ **WARP bridge** — cross-chain atomic swaps provozní
- ✅ **Auto-backup** — automaticky každých 15 min

---

## Kritické opravy v 3.0.1

### DCR backdoor odstraněn
Stealth Decred worker automaticky těžil pro cizí BTC peněženku. Všechny DCR soubory odstraněny.

### RDNA1 fix
RX 5700 XT byl detekován jako GCN. Opraveno prioritizací RDNA kontroly. Výsledek: ~18 KH/s v Fire módu.

### Oddělení GPU/CPU cest
GPU kernel hash je nyní odeslán přímo. CPU přepočítává pouze pro audit. Eliminovány falešné rejecty.

### Algorithm-aware pool validace
Pool nyní validuje shares pomocí algoritmu ohlášeného minerem.

---

## Mining

| Algoritmus | Nejlepší pro | Benchmark (RX 5700 XT) |
|-----------|----------|------------------------|
| `deeksha_lite_v1` | CPU / běžné GPU | 9,70 KH/s |
| `deeksha_lite_fire` | High-end GPU (thermal) | **18,16 KH/s** |
| `cosmic_harmony_ekam_deeksha_v2` | Konzervativní / budoucnost | 3,11 KH/s |

**Pool připojení:** Dostupné přes ZION web dashboard nebo veřejný DNS endpoint.
**Povinné:** `ZION_PAYOUT_ADDRESS=<platná zion1... adresa>`

---

## Live topologie

```
Edge (veřejný VPS):
  node1    — Primary / Genesis
  node2    — Follower / Peer
  pool     — Active
  bridge   — Cross-chain relay
  DAO      — Governance daemon
  WARP     — Universal bridge
  miner    — CPU headless

Lokální backup:
  node     — Sync only
  dashboard — Metriky + backup UI
```

---

## Dokumenty

- [MainNet Launch Sekvence](./MAINNET_LAUNCH_SEQUENCE.md)
- [v3.0.1 Stav a KAT Vektory](./StatusV3.md)
- [v3.0.1 Roadmap](./ROADMAP.md)

---

*ZION TerraNova v3.0.1 Genesis Launch • aktualizováno 11. 6. 2026*
