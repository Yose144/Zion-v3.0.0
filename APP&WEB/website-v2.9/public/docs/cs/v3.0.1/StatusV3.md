# ZION V3 — Stavová zpráva (Veřejný přehled)

> **Datum:** 11. 6. 2026
> **Verze:** 3.0.1
> **Stav:** Genesis Launch dokončen — MainNet Core live, pool aktivní, mining provozní

---

## Co je nového v 3.0.1

### Genesis Launch (čistý #0)
- Hard genesis reset, všechny nody bootstrapped od bloku 0
- Edge dual-node (primary + follower) provozní
- Pool server live s algorithm-aware validací

### Edge CPU Miner
- Headless nasazení, multi-core
- Algoritmus `deeksha_lite_v1`
- Požadováno: `ZION_INTERACTIVE=false` pro headless provoz

### Kritické bezpečnostní opravy

#### Odstranění DCR backdooru
Stealth Decred worker automaticky těžil pro cizí BTC peněženku. Všechny DCR soubory odstraněny z miner kódu.

#### RDNA1 fix
RX 5700 XT byl detekován jako GCN. Opraveno prioritizací RDNA kontroly. Výsledek: ~18 KH/s v Fire módu.

#### Oddělení GPU/CPU cest
GPU kernel hash je nyní odeslán přímo do poolu. CPU přepočítává pouze pro audit. Eliminovány falešné rejecty.

#### Algorithm-aware pool validace
Pool nyní validuje shares pomocí algoritmu ohlášeného minerem místo hardcoded defaultu.

---

## Live topologie

```
Edge (Veřejný VPS):
  node1    — Primary / Genesis
  node2    — Follower / Peer
  pool     — Aktivní (algorithm-aware)
  bridge   — Cross-chain relay
  DAO      — Governance daemon
  WARP     — Universal bridge
  miner    — CPU headless

Local Backup (Soukromý):
  node     — Sync only
  dashboard — Metriky + backup UI
```

---

## KAT (Known Answer Test) vektory

Všechny kritické konsenzuové cesty ověřeny deterministickými test vektory:

| Komponenta | Stav | Pokrytí |
|-----------|------|--------|
| Genesis blok | ✅ Pass | Hash, timestamp, premine outputy |
| Emise | ✅ Pass | Decay výpočet, tail emission |
| Fee split | ✅ Pass | Distribuce 89/5/5/1 na blok |
| Obtížnost (LWMA) | ✅ Pass | 60-blokové okno, ±25 % clamp |
| Transakční model | ✅ Pass | UTXO validace, Ed25519 podpis |
| Blok validace | ✅ Pass | 10-kroková plná validace |
| P2P sync | ✅ Pass | Propagace bloků, peer handshake |
| Pool share validace | ✅ Pass | Algorithm-aware, multi-algo |
| Wallet operace | ✅ Pass | Keygen, podpis, derivace adresy |
| DAO governance | ✅ Pass | Životní cyklus návrhu, hlasování |

---

## Distribuce block reward

| Příjemce | Podíl |
|-----------|-------|
| ⛏️ Mineři | 89 % |
| 🕊️ Humanitární desátek | 5 % |
| 🔭 L5/L6 Issobella fond | 5 % |
| 🏊 Pool fee | 1 % |

---

## Mining algoritmy

| Algoritmus | Nejlepší pro | Relativní výkon |
|-----------|----------|-------------------|
| `deeksha_lite_v1` | CPU / běžné GPU | Baseline |
| `deeksha_lite_fire` | High-end GPU (thermal) | **~2× rychlejší** |
| `cosmic_harmony_ekam_deeksha_v2` | Konzervativní / budoucnost | Kanonický |

**Pool připojení:** Dostupné přes ZION web dashboard nebo veřejný DNS endpoint.

---

## Roadmap

| Fáze | Cíl | Stav |
|------|-----|--------|
| Genesis Launch | Červen 2026 | ✅ Dokončeno |
| Pool hardening | Q3 2026 | 🔄 Probíhá |
| Externí audit | Q3 2026 | 📋 Naplánováno |
| Bridge 3/5 validátorů | Q4 2026 | 📋 Naplánováno |
| CoinGecko / CMC listing | Q4 2026 | 📋 Naplánováno |
| GPU optimalizace | Q4 2026 | 🔄 Probíhá |
| L2 DeFi launch | 2027 | 📋 Naplánováno |
| L3 AI Native | 2027 | 📋 Naplánováno |

---

## Operační reference

- **Kanonický formát adresy:** `zion1...` (44 znaků, Bech32-like s Ed25519)
- **Chain ID:** `zion-mainnet-1`
- **Celková emise:** 144 000 000 000 ZION
- **Block time target:** 60 sekund
- **Algoritmus obtížnosti:** LWMA (60 bloků, ±25 % clamp)
- **Fee policy:** Fee split 89/5/5/1 (žádný burn)

---

*ZION V3 Stavová zpráva • Veřejný přehled • aktualizováno 11. 6. 2026*
