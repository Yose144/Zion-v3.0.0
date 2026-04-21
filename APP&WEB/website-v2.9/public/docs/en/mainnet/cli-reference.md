# ZION CLI Reference

## Purpose

This is the command-oriented companion to the main CLI guide.

Use it when you need concrete operator examples for the current `zion` surface.

## Core runtime control

```bash
zion status
zion logs node
zion logs ai-native
zion dashboard
```

## Lifecycle targets

Current top-level lifecycle targets:

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
zion stop monitoring
```

If you pass an unsupported target, the CLI should fail locally with the supported target list before it reaches remote compose operations.

## L1 examples

```bash
zion node status
zion node peers
zion node block 6801
zion node rpc getChainInfo

zion pool stats
zion pool miners

zion mine status
zion mine bench
zion mine bench --ekam --backend opencl --work-size 8192

zion wallet balance
zion wallet send zion1example 1.25
```

`zion mine start` now forwards explicit backends like `opencl`, `metal`, and `cuda` to the miner correctly, and `zion mine bench --ekam` now hits the real Ekam benchmark mode.

## L2 examples

```bash
zion bridge status
zion bridge pending
zion bridge transfer base zion1example 10

zion dao status
zion dao treasury
zion dao vote 7 yes
```

## L3 examples

```bash
zion agent status
zion agent config
zion agent memory
zion agent rag query "bridge"
zion agent ask "What is the current L3 state?"

zion warp status
zion warp stats

zion ncl status
zion ncl workers
zion ncl submit ./job.json
```

## Operations examples

```bash
zion deploy status
zion deploy server
zion deploy website
zion deploy prune

zion config show
zion config path
zion config validate
zion config set node.rpc_host 91.98.122.165

zion monitor
zion explorer
zion completions zsh
```

## Recommended operator order

When something is wrong, the shortest factual sequence is usually:

1. `zion status`
2. `zion node status`
3. `zion agent status`
4. `zion logs <affected-service>`
5. the narrow command group for the failing layer