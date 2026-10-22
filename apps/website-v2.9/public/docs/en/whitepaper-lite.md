# Whitepaper Lite — ZION TerraNova v2.9.9 public line

A fast summary of the current publicly communicated ZION line without conflating the rehearsal runtime with a launched mainnet.

---

## What ZION is today

ZION is a native Rust Proof-of-Work protocol with a publicly reachable **V3 test-mainnet rehearsal** runtime. The current public surface is carried by the **v2.9.9 Pure Code** release line on top of the canonical **v2.9.8** runtime base.

That means:

- the public website, explorer, RPC, and mining ingress are online,
- the network operates as a controlled rehearsal runtime,
- the public mainnet launch has not passed all closure gate conditions yet.

---

## Public parameters

| Parameter | Value |
|-----------|-------|
| Total supply | 144,000,000,000 ZION |
| Mining supply | 127,220,000,000 ZION |
| Premine | 16,780,000,000 ZION |
| Block time target | 60 seconds |
| Fee policy | Burn |
| Current public runtime | CHv3-line rehearsal |
| Final public launch consensus | still open |

---

## Architecture in one minute

- **Core**: Rust runtime, LMDB storage, Ed25519 wallet flow
- **P2P**: libp2p network with one public primary host and internal validator lanes
- **RPC / REST**: public endpoints for explorers, tooling, and monitoring
- **Mining**: public stratum pool for CPU / Cosmic Harmony clients
- **Docs / Ops**: live index, API reference, network status, and monitoring surface

---

## Public truth

The current website and docs should be read as follows:

- **yes**: controlled public rehearsal runtime,
- **yes**: active public endpoints and binaries,
- **no**: launched public mainnet,
- **no**: closed launch-gate process.

Public launch remains **NO-GO** until audit, explorer evidence, wallet readiness, and the final launch configuration are closed.

---

## Launch path

1. Stable rehearsal runtime.
2. Closure evidence and audit material.
3. Final launch-readiness package.
4. Only then public mainnet genesis.

The end-2026 window remains a direction, not proof that the live public launch already happened.

---

## Links

- [Docs Hub](/docs)
- [Network Status](/network)
- [GitHub](https://github.com/Zion-TerraNova)
- [Website](https://www.zionterranova.com)