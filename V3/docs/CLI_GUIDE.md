# ZION CLI Guide

## Purpose

`zion` is the unified operator gateway for the current ZION stack.

It is not just a thin wrapper around one binary. It is the intended control surface across:

- L1 node, pool, miner, and wallet,
- L2 bridge and DAO,
- L3 AI Native, WARP, and NCL,
- deployment, monitoring, and explorer workflows.

## Current Design Position

For the present production era, treat the CLI as an orchestrator-first interface.

That means:

- the CLI should expose services, health, status, and deploy flows cleanly,
- AI Native is presently an orchestration layer before it is a heavy local inference runtime,
- remote model backends are optional integrations rather than hard assumptions,
- degraded mode is acceptable when the agent backend is unavailable, but service visibility must remain strong.

## Build And Run

From the V3 workspace root:

```bash
cargo run -p zion-cli -- --help
```

Or build the binary once:

```bash
cargo build -p zion-cli
./target/debug/zion --help
```

## Top-Level Commands

```text
onboard      First-time setup wizard
start        Start service(s): all | node | pool | miner | agent | ai-native | bridge | dao | website | redis | monitoring
stop         Stop service(s): all | node | pool | miner | agent | ai-native | bridge | dao | website | redis | monitoring
restart      Restart service(s): all | node | pool | miner | agent | ai-native | bridge | dao | website | redis | monitoring
status       Health check — all layers
logs         Tail logs for a service
dashboard    Open web dashboard in browser
node         L1 core node commands
pool         L1 pool commands
mine         L1 miner commands
wallet       Wallet operations
agent        L3 Hiranyagarbha AI Native agent gateway
deploy       Server deployment
config       Config management
bridge       L2 bridge gateway
dao          L2 DAO governance
explorer     Block explorer TUI
monitor      Live stack monitor TUI (all layers)
warp         L3 Warp cross-chain relay
ncl          L3 NCL Neural Compute Layer
completions  Print shell completion script
```

## Command Groups

### L1

`zion node`

- `status`
- `peers`
- `blocks`
- `block`
- `tx`
- `mempool`
- `sync`
- `rpc`

`zion pool`

- `stats`
- `miners`
- `config`
- `earnings`

`zion mine`

- `start`
- `stop`
- `bench`
- `status`
- `dcr`

`zion wallet`

- `new`
- `address`
- `balance`
- `send`
- `tithe`

### L2

`zion bridge`

- `status`
- `pending`
- `history`
- `get`
- `chains`
- `transfer`

`zion dao`

- `status`
- `proposals`
- `proposal`
- `vote`
- `treasury`
- `params`

### L3

`zion agent`

- `start`
- `stop`
- `restart`
- `status`
- `chat`
- `ask`
- `logs`
- `config`
- `memory`
- `rag`
- `tasks`
- `warp`
- `ncl`
- `oasis`

`zion warp`

- `status`
- `chains`
- `chain`
- `pending`
- `get`
- `stats`
- `validators`

`zion ncl`

- `status`
- `submit`
- `job`
- `jobs`
- `workers`
- `leaderboard`
- `schedule`
- `price`

### Operations

`zion deploy`

- `server`
- `website`
- `update`
- `prune`
- `ssh`
- `status`

`zion monitor` provides the live TUI stack view.

`zion explorer` provides the TUI explorer view.

## Typical Flows

### Full-stack status check

```bash
zion status
zion node status
zion pool stats
zion agent status
```

### Service lifecycle

```bash
zion start ai-native
zion restart bridge
zion logs website
```

### Node and wallet operations

```bash
zion node peers
zion node block 6801
zion wallet balance
```

### L2 and L3 checks

```bash
zion bridge status
zion dao treasury
zion warp stats
zion ncl workers
```

### Agent usage

```bash
zion agent status
zion agent ask "What is the current L3 state?"
zion agent rag query "bridge" 
```

## Service Semantics

The top-level lifecycle commands map to compose service names, not human-friendly container guesses.

Supported lifecycle targets currently include:

- `core` or `node`
- `pool`
- `miner`
- `agent` or `ai-native`
- `bridge`
- `dao`
- `website`
- `redis`
- `monitoring`

`monitoring` expands to the monitoring service bundle rather than a single process.

## Configuration

The CLI uses a config file, by default:

```text
~/.zion/zion.toml
```

Useful commands:

```bash
zion config show
zion config path
zion config set server.host 91.98.122.165
zion onboard
```

## Operator Notes

### AI Native posture

Right now, `zion agent` should be understood as an operator-facing orchestration gateway.

It can front a remote LLM backend when available, but the CLI should remain useful even when the agent is running in degraded or fallback mode.

### Documentation contract

Whenever a new CLI command or service target is added, update the following in the same change:

- `V3/docs/CLI_GUIDE.md`
- `V3/docs/CLI_FAQ.md`
- public docs mirror under `APP&WEB/website-v2.9/public/docs/`

That keeps the operator surface auditable and prevents the CLI from outgrowing its docs again.