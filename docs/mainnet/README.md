# ZION MainNet Documentation

This directory contains the active launch and operational documentation for ZION MainNet.

## 📄 Documents

| Document | Purpose |
|----------|---------|
| [MAINNET_CONSTITUTION.md](./MAINNET_CONSTITUTION.md) | Immutable protocol charter |
| [MAINNET_CHECKLIST.md](./MAINNET_CHECKLIST.md) | Launch readiness checklist |
| [ROADMAP.md](./ROADMAP.md) | Development roadmap |
| [EXCHANGE_READINESS.md](./EXCHANGE_READINESS.md) | Exchange listing guide |
| [../reports/REPORT_SESSION_2026-03-28_V3_MAINNET_FEE_SPLIT_ROLLOUT.md](../reports/REPORT_SESSION_2026-03-28_V3_MAINNET_FEE_SPLIT_ROLLOUT.md) | Verified V3 fee-split rollout report |
| [../reports/REPORT_SESSION_2026-03-28_V3_MAINNET_GO_NO_GO.md](../reports/REPORT_SESSION_2026-03-28_V3_MAINNET_GO_NO_GO.md) | Current launch readiness verdict and blockers |
| [V3_ROLLOUT_VERIFICATION_CHECKLIST.md](./V3_ROLLOUT_VERIFICATION_CHECKLIST.md) | Post-deploy verification checklist for V3 rollouts |

## Current Verified State

- V3 mainnet runtime now enforces block reward split directly on-chain
- Verified live split: miner `89%`, humanitarian `5%`, issobella `5%`, pool fee `1%`
- First explicitly verified split-enabled block: `465`
- Additional live confirmation captured on audited nodes at blocks `471` and `472`
- Active audited node set for this rollout: Prague, USA, Singapore

## Document Purposes

### MAINNET_CONSTITUTION.md
The **immutable protocol charter** that defines:
- Network identity
- Supply economics
- Consensus rules
- Governance principles

> Once MainNet launches, this document is **FROZEN**.

### MAINNET_CHECKLIST.md
Comprehensive **launch checklist** covering:
- Spec freeze items
- Core correctness tests
- Infrastructure requirements
- Legal compliance

### ROADMAP.md
Development **roadmap** from:
- Current state → MainNet
- MainNet → Exchanges
- Post-launch expansion

### EXCHANGE_READINESS.md
Guide for **exchange listings**:
- Required documentation
- Legal considerations
- Listing strategy
- Communication templates

## Status Overview

| Phase | Status | Description |
|-------|--------|-------------|
| Spec Freeze | 🟡 In Progress | Core runtime converging, canonical docs still need cleanup |
| Core Correctness | 🟡 In Progress | Fee split now verified on-chain, broader suites still incomplete |
| Infrastructure | 🟡 In Progress | 3-node V3 rollout verified, operational runbooks still need tightening |
| Legal Docs | ✅ Ready | `/legal/` folder |
| MainNet Launch | 🟡 In Progress | Runtime path is materially closer, not yet final-launch ready |

## Recent Operational Milestone

The V3 fee-split rollout completed on 28 March 2026 established that payout splitting is no longer just pool-side accounting. New blocks now carry four deterministic coinbase transactions and audited nodes remained in sync after rollout.

Primary reference:

- [../reports/REPORT_SESSION_2026-03-28_V3_MAINNET_FEE_SPLIT_ROLLOUT.md](../reports/REPORT_SESSION_2026-03-28_V3_MAINNET_FEE_SPLIT_ROLLOUT.md)
- [../reports/REPORT_SESSION_2026-03-28_V3_MAINNET_GO_NO_GO.md](../reports/REPORT_SESSION_2026-03-28_V3_MAINNET_GO_NO_GO.md)

## Related Documentation

- [Legal Documents](../../legal/) - Legal disclaimers
- [Technical Docs](../) - Technical specifications
- [Deployment](../../2.9.5/deployment/) - Deployment guides

---

Last Updated: 2026-03-28
