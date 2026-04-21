# ZION CLI Guide

## What `zion` is

`zion` is the unified operator CLI for the ZION stack.

It spans:

- L1 node, pool, miner, wallet,
- L2 bridge and DAO,
- L3 AI Native, WARP, and NCL,
- deploy, monitor, and explorer workflows.

## Current position

For the current production phase, the CLI and AI Native should be understood primarily as an orchestration layer.

That means:

- service control, health, and status first,
- model backend integrations second,
- not the other way around.

## Core commands

```bash
zion status
zion node status
zion pool stats
zion wallet balance
zion agent status
zion bridge status
zion dao treasury
zion warp stats
zion ncl workers
```

## Lifecycle targets

Current top-level service targets for `start`, `stop`, and `restart`:

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

Examples:

```bash
zion start ai-native
zion restart bridge
zion logs website
```

## L3 agent

`zion agent` is the entry point for the Hiranyagarbha runtime.

Typical usage:

```bash
zion agent status
zion agent ask "What is the current L3 state?"
zion agent logs
```

## Important limitation

The current production host is not sized for heavyweight local AI inference.

So the canonical interpretation today is:

- AI Native = orchestrator and control plane,
- LLM backend = optional integration,
- fallback mode is acceptable if it is explicit and truthful.