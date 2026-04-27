# ZION CLI FAQ (simple answers)

## Is ZION CLI only a wrapper around node?

No.

`zion` is a unified operator gateway across L1, L2, L3, and Ops.

## Do I need a GPU to use CLI?

No.

Core operations (`status`, `doctor`, `node`, `pool`, `deploy`) work without GPU.

## What does fallback mode mean in `zion agent`?

Service is alive, but model backend is unavailable.

This is expected and transparent behavior.

## What is the current layer mapping?

- L1 = blockchain, pool, miner
- L2 = bridge, DAO, DeFi
- L3 = AI Native, WARP, NCL
- L4 = OASIS
- L5 = Free World
- L6 = Issobella

## What's the first command a beginner should run?

```bash
zion doctor
```

If `zion` is not in PATH:

```bash
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- doctor
```

## Why do lifecycle commands use service targets, not container names?

Because CLI works against compose service names (source of truth), not accidental container naming.

## How can I tell if missing explorer data is a node issue?

Run:

```bash
zion node status
zion logs node
```

If node is down or restarting, website explorer usually has no blockchain data source.

## Can I use CLI without the interactive menu?

Yes.

Menu is optional convenience. Typed commands are fully supported:

```bash
zion status
zion node status
zion pool stats
```

## What is the difference between `zion update` and `zion deploy update`?

- `zion update` = updates local CLI binary.
- `zion deploy update` = updates remote runtime/services.

## What is the safest beginner routine before major actions?

1. `zion config validate`
2. `zion doctor`
3. `zion status`