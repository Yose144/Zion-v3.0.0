# Edge Primary Topologie — Veřejný přehled

> **Datum:** 2. 6. 2026
> **Topologie:** Dvouvrstvá architektura (Core + Edge)
> **Stav:** Aktivní / Mainnet

---

## Přehled architektury

ZION V3 používá **Core + Edge** dvouvrstvou architekturu:

```
+-------------------------------------------------------------+
|  EDGE SERVER (Veřejný VPS)                                  |
|                                                             |
|  L1 (Core):                                                |
|    - Node 1 (Primary / Genesis)                             |
|    - Node 2 (Follower / Peer)                             |
|    - Pool (Primary mining pool)                            |
|                                                             |
|  L2 (Infrastruktura):                                       |
|    - Bridge (Cross-chain relay)                            |
|    - DAO (Governance daemon)                               |
|    - Atomic Swap (HTLC koordinátor)                        |
|                                                             |
|  L3 (Pokročilé):                                             |
|    - WARP (Universal cross-chain bridge)                   |
|                                                             |
+-------------------------------------------------------------+
                              |
                    Šifrovaná VPN mesh
                              |
+-------------------------------------------------------------+
|  LOCAL BACKUP (Soukromý)                                    |
|                                                             |
|  L1 (Backup):                                              |
|    - Backup Node (sync only)                               |
|    - Miners (CPU + GPU)                                    |
|                                                             |
|  AI Služby:                                                 |
|    - Hiranyagarbha API                                     |
|    - Hiran Inference                                       |
|                                                             |
|  Dashboard:                                                 |
|    - Operator metriky + monitoring UI                        |
|                                                             |
+-------------------------------------------------------------+
```

---

## Edge Server

| Vlastnost | Hodnota |
|-----------|-------|
| Provider | Hetzner Cloud |
| OS | Ubuntu 22.04 LTS |
| Role | 24/7 operační node pro všechny L1/L2/L3 non-AI služby |

### Služby

Všechny služby běží jako hardened systemd jednotky s auto-restartem:

| Služba | Popis |
|---------|-------|
| Node 1 | Primary / Genesis node |
| Node 2 | Follower P2P peer |
| Pool | Primary mining pool |
| Bridge | L2 cross-chain relay |
| DAO | L2 governance daemon |
| Atomic Swap | L2 HTLC swap koordinátor |
| WARP | L3 cross-chain relay |
| Watchdog | Healthcheck timer |

---

## Local Backup

| Vlastnost | Hodnota |
|-----------|-------|
| Role | Backup node, minery, AI služby |
| OS | Windows 11 + WSL |

### Služby

| Služba | Popis |
|---------|-------|
| Backup Node | Chain sync only (žádné mining) |
| Minery | CPU + GPU mining |
| Dashboard | Operator metriky + backup UI |
| AI | Hiranyagarbha + Hiran inference |

---

*ZION V3 Edge-Primary Topologie • Veřejný přehled • aktualizováno 2. 6. 2026*
