# ZION V3 Mainnet Launch Sequence

> **Updated:** 2026-06-11
> **Status:** Genesis #0 launched successfully

---

## Pre-Launch Checklist

### Configuration
- ✅ **Fee split addresses configured** (89/5/5/1 model)
  - Miner: 89%
  - Humanitarian: 5%
  - Issobella: 5%
  - Pool Fee: 1%

- ✅ **Genesis premine configured** (13 outputs, 16.28B ZION)
  - 5× OASIS + Golden Egg (8.25B ZION)
  - 3× DAO Treasury (4.0B ZION, locked 1 year)
  - 3× Infrastructure (2.59B ZION)
  - 1× Humanitarian (1.44B ZION)
  - 1× Bridge Seed Fund (0.5B ZION)

- ✅ **Genesis hash verified** across all nodes
- ✅ **All launch scripts updated** with new addresses

### Infrastructure
- ✅ **Edge server** (Public VPS) — Primary / Genesis node, pool, all L2/L3 services
- ✅ **Core backup** (Private node) — Backup sync, miners, dashboard
- ✅ **P2P sync Core-Edge** operational
- ✅ **Encrypted VPN mesh** stable
- ✅ **Firewall** configured on Edge

---

## Launch Sequence

### Phase 1: Final Verification (Pre-Launch)

1. Stop all services
2. Clean data directories (for clean genesis start)
3. Verify configurations
4. Confirm fee split addresses
5. Verify genesis hash consistency

### Phase 2: Genesis Launch

1. Start Edge primary node (genesis #0)
2. Verify block acceptance
3. Start Edge pool server
4. Start Core backup node (sync from Edge)
5. Verify P2P sync

### Phase 3: Post-Launch Verification

1. Confirm genesis block accepted on all nodes
2. Verify pool accepting connections
3. Test miner connectivity
4. Confirm dashboard metrics
5. Verify backup system operational

---

## Operational Notes

- **Genesis reset procedure:** Requires coordinated stop of all nodes, data wipe, and sequential restart from genesis
- **Cross-sync prevention:** Temporary peer removal during isolated restart
- **Windows nodes:** Require `Stop-Process -Force` before DB deletion (auto-restart behavior)

---

*ZION V3 Mainnet Launch Sequence • Public Overview • updated 2026-06-11*
