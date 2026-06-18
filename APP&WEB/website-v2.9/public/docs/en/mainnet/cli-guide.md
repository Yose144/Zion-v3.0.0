# ZION CLI Guide (for complete beginners)

## What ZION CLI is

`zion` is the main command-line gateway for the ZION stack.

With one tool, you can operate:

- L1: node, pool, miner, wallet,
- L2: bridge and DAO,
- L3: AI Native, WARP, NCL,
- Ops: status checks, logs, deploy, monitoring.

If you're brand new, think of it as a "terminal control panel".

---

## What you need before first run

Minimum requirements:

1. Open Terminal (macOS/Linux) or PowerShell (Windows).
2. Have the repository (`2.9.6`) available locally.
3. Have Rust installed (`cargo`) or use a machine where CLI build is already available.

Quick check:

```bash
cargo --version
```

If you see a version, you can continue.

---

## Easiest first run (without installing binary to PATH)

From repository root:

```bash
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- --help
```

First practical commands:

```bash
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- status
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- doctor
```

This is the safest beginner path: no PATH setup needed.

---

## Running with the interactive menu

After building the CLI you can use menu mode:

```bash
zion
```

Or explicitly:

```bash
zion menu
```

Controls:

- arrows = move,
- Enter = confirm,
- menu returns you back after each action.

---

## Absolute first workflow (copy/paste)

If you don't know where to start, use this order:

```bash
zion config validate
zion doctor
zion status
zion node status
zion pool stats
zion agent status
```

What each one does:

- `config validate` checks config format,
- `doctor` runs preflight checks,
- `status` shows global service health,
- `node/pool/agent status` narrows to one layer.

---

## If `zion` command is not found

Use cargo fallback:

```bash
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- status
```

Same for other commands:

```bash
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- node status
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- pool stats
```

---

## Most useful commands for regular users

### Health and status

```bash
zion status
zion doctor
zion logs node
```

### Node / chain

```bash
zion node status
zion node peers
zion node block 6801
```

### Pool / mining

```bash
zion pool stats
zion mine status
zion mine bench
```

### Agent (L3)

```bash
zion agent status
zion agent config
zion agent ask "What is current L3 state?"
```

---

## Important 2026 reality

AI Native currently acts primarily as orchestrator/control-plane.

That means:

- service can be healthy even with fallback model mode,
- fallback is better than silent failure,
- always verify services first (`status`, `doctor`, `logs`) before model tuning.

---

## Safe incident sequence

Use this exact order:

1. `zion status`
2. `zion node status`
3. `zion pool stats`
4. `zion agent status`
5. `zion logs <service>`

Do not start by randomly restarting everything.

---

## Read next

- `ZION CLI FAQ`
- `ZION CLI Reference`
- `ZION CLI Troubleshooting`
- `ZION CLI Deploy Playbook`