# ZION CLI FAQ

## What is `zion` supposed to be?

`zion` is the unified operator CLI for the ZION stack.

It is intended to become the canonical entry point for:

- runtime control,
- deployment,
- health and service visibility,
- node, pool, miner, wallet, bridge, DAO, and AI-native operations.

## Is AI Native supposed to be a heavyweight local AI server?

Not by default.

At the current stage, AI Native should be treated as an orchestrator-first L3 runtime:

- status and control plane first,
- pluggable model backend second,
- heavy local inference only where hardware actually supports it.

## Does `zion agent` require a GPU?

No.

The production-safe assumption is that the agent must still provide useful health, memory, RAG, and orchestration behavior without a local GPU.

## Why can the agent answer in fallback mode?

Because the runtime is intentionally designed to degrade gracefully.

If a remote or local LLM backend is unavailable, the operator still needs:

- a healthy service,
- status visibility,
- logs,
- memory and RAG access,
- an explicit indication that the backend is degraded.

Silent failure is worse than truthful fallback.

## Which services can the top-level lifecycle commands manage?

Current supported targets:

- `all`
- `node` or `core`
- `pool`
- `miner`
- `agent` or `ai-native`
- `bridge`
- `dao`
- `website`
- `redis`
- `monitoring`

## Why do `start`, `stop`, and `restart` use service names instead of container names?

Because the deploy layer works against compose service definitions.

That keeps the CLI aligned with the actual deployment source-of-truth and avoids brittle coupling to container naming accidents.

## Where do L2 and L3 belong in the public architecture?

Current canonical mapping:

- L1 = blockchain, pool, miner,
- L2 = bridge, DAO, DeFi,
- L3 = AI Native, WARP, NCL,
- L4 = OASIS,
- L5 = Free World,
- L6 = Issobella.

The CLI, website, and operator docs should all use the same mapping.

## What is the current role of `zion agent` relative to WARP and NCL?

`zion agent` is the L3 operator gateway.

It exposes the AI-native runtime surface while also reflecting integration state for:

- WARP,
- NCL,
- future OASIS-facing bridges.

## What still makes the CLI non-robust today?

Main gaps still remaining:

1. some commands are status-first or dry-run oriented,
2. docs coverage is behind the implemented command surface,
3. examples and troubleshooting need to be broader,
4. service matrix and failure modes need stronger documentation,
5. public docs need the curated operator subset mirrored continuously.

## What should be prioritized next?

1. fill missing examples for every command group,
2. document real deploy and rollback flows,
3. harden config validation and error messages,
4. add public-safe docs to the website,
5. only then deepen automation and agent workflows.