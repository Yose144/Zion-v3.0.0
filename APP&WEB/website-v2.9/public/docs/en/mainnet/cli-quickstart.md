# ZION CLI Quickstart (10 minutes for newcomers)

This is the fastest path to start using ZION CLI safely.

## Goal

Within 10 minutes you will:

1. verify CLI works,
2. check stack health,
3. know where to look for errors,
4. know what to do next.

---

## Step 1: Open terminal

- macOS: Terminal
- Windows: PowerShell
- Linux: shell

Go to repository root (`2.9.6`).

---

## Step 2: Verify Rust exists

```bash
cargo --version
```

If you see a version, continue.

---

## Step 3: Run CLI without installing to PATH

```bash
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- --help
```

This is the safest public/beginner entrypoint.

---

## Step 4: First health checks

```bash
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- status
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- doctor
```

What this means:

- `status` = service health snapshot,
- `doctor` = preflight checks (config/endpoints/readiness).

---

## Step 5: If `zion` is already available

You can use:

```bash
zion
```

or:

```bash
zion menu
```

Menu mode is beginner-friendly: arrows + Enter + return after each command.

---

## Step 6: Minimum orientation command set

```bash
zion status
zion node status
zion pool stats
zion agent status
zion logs node
```

This is your first troubleshooting baseline.

---

## Step 7: If explorer shows no blockchain data

First check:

```bash
zion node status
zion logs node
```

If node is down/restarting, web explorer usually has no data source.

---

## Read next

1. ZION CLI Guide
2. ZION CLI Reference
3. ZION CLI Troubleshooting
4. ZION CLI Deploy Playbook
5. ZION CLI Glossary
