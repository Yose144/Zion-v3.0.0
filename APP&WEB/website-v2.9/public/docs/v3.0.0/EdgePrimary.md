# Edge Primary Topology — Public Overview

> **Date:** 2026-06-02
> **Topology:** Two-tier architecture (Core + Edge)
> **Status:** Active / Mainnet

---

## Architecture Overview

ZION V3 uses a **Core + Edge** two-tier architecture:

```
+-------------------------------------------------------------+
|  EDGE SERVER (Public VPS)                                   |
|                                                             |
|  L1 (Core):                                                |
|    - Node 1 (Primary / Genesis)                             |
|    - Node 2 (Follower / Peer)                             |
|    - Pool (Primary mining pool)                            |
|                                                             |
|  L2 (Infrastructure):                                       |
|    - Bridge (Cross-chain relay)                            |
|    - DAO (Governance daemon)                               |
|    - Atomic Swap (HTLC coordinator)                        |
|                                                             |
|  L3 (Advanced):                                             |
|    - WARP (Universal cross-chain bridge)                   |
|                                                             |
+-------------------------------------------------------------+
                              |
                    Encrypted VPN mesh
                              |
+-------------------------------------------------------------+
|  LOCAL BACKUP (Private)                                    |
|                                                             |
|  L1 (Backup):                                              |
|    - Backup Node (sync only)                               |
|    - Miners (CPU + GPU)                                    |
|                                                             |
|  AI Services:                                               |
|    - Hiranyagarbha API                                     |
|    - Hiran Inference                                       |
|                                                             |
|  Dashboard:                                                 |
|    - Operator metrics + monitoring UI                        |
|                                                             |
+-------------------------------------------------------------+
```

---

## Edge Server

| Property | Value |
|----------|-------|
| Provider | cloud VPS |
| OS | Ubuntu 22.04 LTS |
| Role | 24/7 operational node for all L1/L2/L3 non-AI services |

### Services

All services run as hardened systemd units with auto-restart:

| Service | Description |
|---------|-------------|
| Node 1 | Primary / Genesis node |
| Node 2 | Follower P2P peer |
| Pool | Primary mining pool |
| Bridge | L2 cross-chain relay |
| DAO | L2 governance daemon |
| Atomic Swap | L2 HTLC swap coordinator |
| WARP | L3 cross-chain relay |
| Watchdog | Healthcheck timer |

---

## Local Backup

| Property | Value |
|----------|-------|
| Role | Backup node, miners, AI services |
| OS | Windows 11 + WSL |

### Services

| Service | Description |
|---------|-------------|
| Backup Node | Chain sync only (no mining) |
| Miners | CPU + GPU mining |
| Dashboard | Operator metrics + backup UI |
| AI | Hiranyagarbha + Hiran inference |

---

*ZION V3 Edge-Primary Topology • Public Overview • updated 2026-06-02*
