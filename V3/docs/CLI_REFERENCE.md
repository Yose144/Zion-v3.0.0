# ZION CLI Reference

## Scope

This document is the command-oriented companion to `V3/docs/CLI_GUIDE.md`.

Use it when you need practical examples for the existing CLI surface rather than the high-level positioning.

## Top-Level Runtime Control

### Global health and visibility

```bash
zion status
zion logs node
zion logs ai-native
zion dashboard
```

What these do:

- `zion status` runs the broad stack health view,
- `zion logs <service>` tails deploy-managed service logs,
- `zion dashboard` opens the web dashboard at the configured node host on port `3000`.

### Service lifecycle

Supported top-level lifecycle targets:

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

Typical usage:

```bash
zion start ai-native
zion restart bridge
zion stop monitoring
```

`monitoring` expands into the monitoring service bundle instead of a single process.

## L1 Commands

### `zion node`

Use for JSON-RPC-backed node inspection.

```bash
zion node status
zion node peers
zion node blocks
zion node block 6801
zion node tx 7d8c0e
zion node mempool
zion node sync
zion node rpc getChainInfo
```

Operational notes:

- `status` and `sync` are the first checks during runtime triage,
- `block` and `tx` are the fastest narrow inspection tools for chain incidents,
- `rpc` is the escape hatch when the wrapped subcommands are not enough.

### `zion pool`

Use for pool-side operational inspection.

```bash
zion pool stats
zion pool miners
zion pool config
zion pool earnings
```

Operational notes:

- `stats` is the first pool heartbeat check,
- `miners` helps spot worker churn or duplicate-share patterns,
- `earnings` is the operator-facing reward sanity check.

### `zion mine`

Use for miner runtime control and quick performance checks.

```bash
zion mine start
zion mine status
zion mine bench
zion mine dcr
zion mine stop
```

Operational notes:

- use `bench` before assuming a host is suitable for mining,
- use `status` before and after config changes,
- `dcr` belongs to miner diagnostics, not deployment.

### `zion wallet`

Use for local wallet and payment operations.

```bash
zion wallet new
zion wallet address
zion wallet balance
zion wallet send zion1example 1.25
zion wallet tithe 0.05
```

Operational notes:

- check `balance` before any payout or tithe action,
- prefer explicit verification around address handling,
- treat send flows as operator actions that deserve manual confirmation.

## L2 Commands

### `zion bridge`

Use for bridge queue and transfer inspection.

```bash
zion bridge status
zion bridge pending
zion bridge history
zion bridge get bridge-op-42
zion bridge chains
zion bridge transfer base zion1example 10
```

Operational notes:

- `status` and `pending` are the first incident checks,
- `history` is useful when reconciling bridge progression,
- `transfer` should be treated as an operator action with explicit review.

### `zion dao`

Use for governance, treasury, and proposal visibility.

```bash
zion dao status
zion dao proposals
zion dao proposal 7
zion dao treasury
zion dao params
zion dao vote 7 yes
```

Operational notes:

- `treasury` and `params` are the fastest governance-state checks,
- `proposal` narrows into one object when `proposals` is too broad,
- `vote` should be treated as a deliberate operator action.

## L3 Commands

### `zion agent`

Use as the operator gateway to Hiranyagarbha.

```bash
zion agent status
zion agent config
zion agent memory
zion agent rag query "bridge"
zion agent ask "What is the current L3 state?"
zion agent tasks
zion agent warp
zion agent ncl
zion agent oasis
zion agent logs
```

Operational notes:

- `status` is the first health and mode check,
- `config` confirms backend and endpoint wiring,
- `memory` and `rag` are runtime introspection tools,
- `ask` and `chat` remain valid even in fallback mode when the service is healthy.

### `zion warp`

Use for relay visibility.

```bash
zion warp status
zion warp chains
zion warp chain base
zion warp pending
zion warp get warp-op-18
zion warp stats
zion warp validators
```

### `zion ncl`

Use for neural compute lane visibility.

```bash
zion ncl status
zion ncl jobs
zion ncl job ncl-job-22
zion ncl workers
zion ncl leaderboard
zion ncl schedule
zion ncl price
zion ncl submit ./job.json
```

Operational notes:

- `workers`, `leaderboard`, and `price` are the quick operator views,
- `submit` belongs to controlled task submission, not casual probing.

## Operations Commands

### `zion deploy`

Use for server-side deployment flows.

```bash
zion deploy status
zion deploy server
zion deploy website
zion deploy update
zion deploy prune
zion deploy ssh
```

Operational notes:

- `status` is the safe first step,
- `server` and `update` are the normal runtime-changing actions,
- `prune` is cleanup and should be used intentionally,
- `ssh` is for controlled direct access, not bypassing repeatable deploy flows by default.

### `zion config`

Use for effective config inspection and updates.

```bash
zion config show
zion config path
zion config set server.host 91.98.122.165
zion config set node.rpc_port 8443
zion config init
```

Operational notes:

- `show` is the first config sanity check,
- `path` matters when the operator is unsure which file is active,
- `init` re-runs onboarding when the file is incomplete or stale.

### TUI and shell helpers

```bash
zion monitor
zion explorer
zion completions zsh
zion completions bash
```

Operational notes:

- `monitor` is the live multi-layer operator view,
- `explorer` is the terminal-first chain exploration surface,
- `completions` should be generated per shell and installed through the user's shell profile.

## Suggested Operator Habits

When something looks wrong, the shortest reliable path is usually:

1. `zion status`
2. `zion node status`
3. `zion agent status`
4. `zion logs <affected-service>`
5. the narrow command group for the failing layer

That sequence usually tells you whether the problem is global, layer-specific, or only one service.