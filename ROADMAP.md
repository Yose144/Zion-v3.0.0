# ZION Roadmap

> **Účel tohoto dokumentu:** Vysokoúrovňová časová osa a navigační rozcestník. Detailní pravomoci, důkazy a statusové štítky jsou v [`MiseAmenti/`](docs/WP-Mainet/MiseAmenti/README.md).
>
> **Aktuální stabilní baseline:** 3.2.0 "One Love" (pro ověření live statusu viz `StatusV3.md` / operace).
>
> **Cílová vize:** 3.3.0 "Nirvana" je vývojový a architektonický horizont, nikoli dosažený release, pokud pro něj není evidence v `MiseAmenti/07-Registr-Dukazu.md`.

> **Aktuální live baseline:** 3.2.0 "One Love" (V31 Mainnet Alpha, protokol `zion-v3-node/3.1.0-alpha`) — ověřitelné na Edge a v `StatusV3.md`.
>
> **Vývojový horizont:** 3.3.0 "Nirvana" (Global Assimilation / Attention) — cíl, nikoli dosažený release; status a evidence v [`MiseAmenti/07-Registr-Dukazu.md`](docs/WP-Mainet/MiseAmenti/07-Registr-Dukazu.md).
>
> **Aspirativní veřejný horizont:** 31. 12. 2026 — není závazný datum launchi.
>
> **Naposledy upraveno:** 2026-08-31
>
> **Kanonický integrační corpus:** [`MiseAmenti/`](docs/WP-Mainet/MiseAmenti/README.md)
>
> **Technický execution companion 3.3:** [`V33_NIRVANA_MASTER_PLAN.md`](./V33_NIRVANA_MASTER_PLAN.md)
>
> **Canonical 3.2 forward plan:** [`docs/3.2/ROADMAP.md`](./docs/3.2/ROADMAP.md)
>
> **Detailní plán 3.2.1–3.2.9:** [`docs/3.2/3.2.1-3.2.9_PLAN.md`](./docs/3.2/3.2.1-3.2.9_PLAN.md)
>
> **Marketing / launch plan:** [`OneLoveV3.2.md`](./docs/3.2/OneLoveV3.2.md)
>
> **Technical execution plan:** [`V31/PLAN_TO_3.2.md`](./V31/PLAN_TO_3.2.md)
>
> **ZionDex + ZIS Multichain Wallet plan:** [`ZionDexZis.md`](./docs/3.2/ZionDexZis.md)
>
> **Live status:** [`StatusV3.md`](./StatusV3.md) · [`V31/STATUS.md`](./V31/STATUS.md)

---

## Where we are now

V31 Mainnet Alpha / 3.2 One Love is **live on Edge** and producing blocks. The workspace builds, all workspace tests pass, and the core production services are active:

- Chain height: **23 640+** (2026-08-31)
- All V31 services active: node, pool, multichain, DAO, OASIS, web, marketplace, dashboard, ZIS
- Trinity mining validated on Edge pool (ZION + ZANO + VRSC)
- LWMA difficulty clamp fixed and deployed
- CPU-only `zion-miner` enumeration fixed and deployed
- Native SQLite TX/address index active
- ZIS Identity Service running on `auth.zionterranova.com`
- L5 Free World & L6 Issobella fund trackers running on Edge

Historical 3.1 reports are archived in [`docs/3.1/REPORTS/`](./docs/3.1/REPORTS/).

---

## Where we are going

### 3.2.0 "One Love" (Mainnet Stable)
1. **Real-world E2E** — GPU rigs, AuxPoW pools, bridge Base mainnet round-trip, public subtree sync, DEX quote → on-chain settlement.
2. **Stability & security** — internal/external audit, 24h fuzzing, chaos tests, 1000+ miner simulation, DR drill.
3. **30-day continuous run** — no critical incidents, ≥99.9% uptime.
4. **Release readiness** — feature freeze, multi-platform GitHub release, SMOS package, public docs, community channels.

### 3.3.0 "Nirvana" (Global Assimilation & Attention — Final Synthesis)
1. **L2 Multichain & ZIS Passkeys** — wZION/ETH & ZION/BTC AMM settlement, universal WebAuthn/Passkey SSO across all apps, agent sub-accounts.
2. **L3 Hiranyagarbha 2.4 & 2.5** — Maestro multi-agent DAG orchestration, NCL distributed compute broker, Amitabha natural intent interface, self-sovereign autonomous AI agents with Dharma constraint engine.
3. **L4 OASIS Metaverse** — Unreal Engine 5.7 photorealistic engine (Nanite/Lumen/MetaHumans), low-latency WebGPU / Pixel Streaming preview.
4. **L5 Free World** — Dedicated web portal, live 5% L1 coinbase treasury tracker, global water & permaculture projects.
5. **L6 Issobella** — Quantum warp engine theoretical research (Alcubierre-Ekam metric), DeSci repository, NCL-powered physics simulations.

See the complete technical blueprint in [`V33_NIRVANA_MASTER_PLAN.md`](./V33_NIRVANA_MASTER_PLAN.md), and its deep mythological/philosophical companion — the six worlds, the bardo of transition, Shambhala, the Halls of Amenti, and the 100-year plan for Generation Z — in [`docs/WP-Mainet/NirvanaCloud/`](./docs/WP-Mainet/NirvanaCloud/00-README.md).

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
