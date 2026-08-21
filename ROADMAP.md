# ZION Roadmap

> **Current version:** 3.1.0-beta (V31 Mainnet Alpha), protocol `zion-v3-node/3.1.0-alpha`
> **Next target:** 3.2.0 "One Love" (Mainnet Stable)
> **Public launch target:** 31 December 2026
> **Last updated:** 2026-08-17
>
> **Canonical forward plan:** [`docs/3.2/ROADMAP.md`](./docs/3.2/ROADMAP.md)  
> **Marketing / launch plan:** [`OneLoveV3.2.md`](./OneLoveV3.2.md)  
> **Technical execution plan:** [`V31/PLAN_TO_3.2.md`](./V31/PLAN_TO_3.2.md)  
> **Live status:** [`StatusV3.md`](./StatusV3.md) · [`V31/STATUS.md`](./V31/STATUS.md)

---

## Where we are now

V31 Mainnet Alpha is **live on Edge** and producing blocks. The workspace builds, all workspace tests pass, and the core production services are active:

- Chain height: **7000+** (2026-08-17)
- All V31 services active: node, pool, multichain, DAO, OASIS, web, marketplace, dashboard
- Trinity mining validated on Edge pool (ZION + ZANO + VRSC)
- LWMA difficulty clamp fixed and deployed
- CPU-only `zion-miner` enumeration fixed and deployed
- Native SQLite TX/address index active

Historical 3.1 reports are archived in [`docs/3.1/REPORTS/`](./docs/3.1/REPORTS/).

---

## Where we are going

3.2.0 "One Love" is the Mainnet Stable release. The critical path is:

1. **Real-world E2E** — GPU rigs, AuxPoW pools, bridge Base mainnet round-trip, public subtree sync.
2. **Stability & security** — internal/external audit, 24h fuzzing, chaos tests, 1000+ miner simulation, DR drill.
3. **30-day continuous run** — no critical incidents, ≥99.9% uptime.
4. **Release readiness** — feature freeze, multi-platform GitHub release, SMOS package, public docs, community channels.

See the detailed gating plan, status per phase, and open gaps in [`docs/3.2/ROADMAP.md`](./docs/3.2/ROADMAP.md).

---

## Historical version roadmaps

| Version | Canonical doc |
|---------|---------------|
| 3.1 (V31 Mainnet Alpha) | [`docs/3.1/PLAN_TO_3.1_RECONCILED.md`](./docs/3.1/PLAN_TO_3.1_RECONCILED.md) |
| 3.0.9 | [`docs/3.0.9/SECURITY_AUDIT_REPORT.md`](./docs/3.0.9/SECURITY_AUDIT_REPORT.md) |
| 3.0.8 | [`docs/3.0.8/MAINNET_ALPHA_L2_UNIFICATION.md`](./docs/3.0.8/MAINNET_ALPHA_L2_UNIFICATION.md) |
| 3.0.7 | [`docs/3.0.7/TRINITY_ALL_GREEN_PLAN.md`](./docs/3.0.7/TRINITY_ALL_GREEN_PLAN.md) |
| 3.0.6 | [`docs/3.0.6/AuxPowTriplePlan.md`](./docs/3.0.6/AuxPowTriplePlan.md) |
| 3.0.5 | [`docs/3.0.5/ZION_3.0.5_ALL_GREEN_RUNBOOK.md`](./docs/3.0.5/ZION_3.0.5_ALL_GREEN_RUNBOOK.md) |
| 3.0.4 | [`docs/3.0.4/3.0.4.md`](./docs/3.0.4/3.0.4.md) |
| 3.0.3 | [`docs/3.0.3/README.md`](./docs/3.0.3/README.md) |

---

*Generated from [`docs/3.2/ROADMAP.md`](./docs/3.2/ROADMAP.md) · V31 is the active mainnet track in [`V31/`](./V31/).*
