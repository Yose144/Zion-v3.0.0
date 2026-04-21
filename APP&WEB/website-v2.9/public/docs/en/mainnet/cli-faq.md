# ZION CLI FAQ

## Is `zion` just a wrapper around the node?

No. The target is a single operator gateway for L1, L2, L3, and deployment workflows.

## Does `zion agent` require a local GPU?

No. The agent must remain useful without a local GPU and without a large model running on the same host.

## Why is AI Native described as an orchestrator?

Because that matches both the current infrastructure and the intended architecture:

- we need service control first,
- health and cross-stack visibility first,
- not a pretend heavyweight inference runtime on hardware that does not support it.

## What is the canonical layer mapping now?

- L1 = blockchain, pool, miner
- L2 = bridge, DAO, DeFi
- L3 = AI Native, WARP, NCL
- L4 = OASIS
- L5 = Free World
- L6 = Issobella

## What does fallback mean for `zion agent`?

It means the L3 runtime is alive and explicitly reports that the model backend is not currently available. That is better than silent failure.

## What should come next?

1. expand the reference across all command groups,
2. add troubleshooting and deploy flows,
3. keep website docs synchronized with the CLI surface.