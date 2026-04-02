# Roadmap Lite — launch readiness

**Current public state:** controlled V3 test-mainnet rehearsal  
**Public launch status:** NO-GO until closure evidence is complete  
**Current public line:** v2.9.9 Pure Code over the canonical v2.9.8 runtime

---

## What this roadmap is for

This lite roadmap is the public-facing short version of the launch path. It is not a promise that mainnet already has a fixed live date. It describes the order of work that must be finished before any public launch decision can be made.

---

## Current phase

ZION is operating as a **controlled rehearsal runtime** with:

- one public primary host for web, explorer, RPC, and pool ingress,
- internal validation lanes for quorum and synchronization,
- public docs, monitoring, and API surface,
- archived 2.9.7 -> 2.9.8 -> 2.9.9 release lineage as an audit trail.

That means a publicly reachable rehearsal runtime, not a declared live public mainnet.

---

## Launch sequence

### Phase 1 — rehearsal stability

- keep the controlled runtime healthy,
- keep node, pool, explorer, and telemetry aligned,
- collect runtime evidence and operational samples.

### Phase 2 — closure evidence

- close the external audit,
- prove explorer and API behavior publicly,
- finish wallet distribution readiness,
- finish recovery and operational evidence.

### Phase 3 — launch-readiness package

- freeze the public launch configuration,
- publish the closure report,
- confirm governance and listing-readiness material,
- decide whether launch can move from NO-GO to GO.

### Phase 4 — public mainnet decision

- if closure criteria are satisfied, open genesis and launch operations,
- if they are not, continue rehearsal and do not declare launch.

---

## What remains open

| Area | Status | Public note |
|------|--------|-------------|
| External audit | OPEN | No public close-out yet |
| Explorer closure evidence | OPEN | Public proof still needs to stay current |
| Wallet readiness | OPEN | Final distribution flow is not closed |
| Final consensus / launch config | IN PROGRESS | The public launch version is not frozen |
| Independent miner / node evidence | OPEN | Broader external validation is still needed |
| Listing package | IN PROGRESS | CoinGecko / CMC material is still being cleaned up |

While these items remain open, public launch remains **NO-GO**.

---

## How to read the public site

- `/network` shows the active rehearsal topology.
- `/docs` is the public docs hub.
- `/download` carries current binaries for the public line.
- `/api-reference` exposes the current RPC / REST surface.
- `/roadmap` shows the broader delivery track and gate logic.

---

## Time framing

End-2026 remains a **target window** for decision-making and possible launch readiness, not proof that launch is already fixed or guaranteed.

---

## See also

- [Docs Hub](/docs)
- [Public Launch Path](/docs#mainnet-plan)
- [Network Status](/network)
- [Roadmap](/roadmap)
