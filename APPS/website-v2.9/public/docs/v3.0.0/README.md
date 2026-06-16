# ZION v3.0.0 — MainNet Ready

> **Status:** Mainnet readiness release
> **Date:** May 2026
> **Purpose:** Docker, systemd, fee split, genesis freeze, Edge topology preparation

---

## What is 3.0.0

v3.0.0 was the **MainNet Ready** milestone. All L1 consensus code was frozen, genesis parameters locked, and operational infrastructure prepared for the Genesis Launch.

### Key deliverables

- ✅ **Docker Compose profiles** — `dev`, `mainnet`, `monitoring`
- ✅ **systemd units** — hardened service definitions for Edge
- ✅ **Fee split 89/5/5/1** — constitutional on-chain enforcement
- ✅ **Genesis freeze** — immutable genesis block, 13 premine outputs
- ✅ **Edge topology** — Core + Edge two-tier architecture
- ✅ **Bridge mainnet** — wZION, ZIONBridge, ZIONAtomicSwap on Base
- ✅ **DAO governance** — proposal lifecycle, voting, treasury
- ✅ **Unified CLI** — `zion` operator CLI with L1/L2/L3 commands
- ✅ **Healthchecks** — all services with proper monitoring
- ✅ **Non-root containers** — security-hardened Docker setup

---

## Architecture

```
Core (authoritative):
  L1 node, consensus, canonical chain state

Edge (operational):
  L1 node (sync)
  Pool server
  Bridge relay
  DAO governance daemon
  WARP bridge
  Atomic swap coordinator
  Monitoring / metrics
```

**Edge server:** Public VPS (Hetzner Cloud)
**Local dev:** Private backup node (Windows 11)

---

## Documents

- [Upgrade v3.0.1 Plan](./UPGRADE_3.0.1_PLAN.md)
- [Edge Primary Topology](./EdgePrimary.md)
- [V3 Workspace README](https://github.com/Zion-TerraNova/2.9.6/tree/main/V3/README.md)

---

*ZION TerraNova v3.0.0 MainNet Ready • updated May 2026*
