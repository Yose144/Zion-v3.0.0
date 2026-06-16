# ZION CLI Troubleshooting (for beginners)

Use this when something "just doesn't work".

## 0) Universal first step

```bash
zion status
zion doctor
```

If `zion` is unavailable:

```bash
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- status
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- doctor
```

---

## 1) `zion status` shows errors

Continue in this order:

```bash
zion node status
zion pool stats
zion agent status
```

Then check logs for affected service:

```bash
zion logs node
zion logs pool
zion logs ai-native
```

---

## 2) Explorer has no blocks / web shows missing chain data

Most often this is a node RPC issue.

Check:

```bash
zion node status
zion logs node
```

If node is down/restarting, explorer has no blockchain source.

---

## 3) Agent is degraded or fallback

This does not always mean service crash.

Check:

```bash
zion agent status
zion agent config
zion logs ai-native
```

Interpretation:

- service up + backend unavailable = expected fallback,
- service down = restart/deploy intervention needed.

---

## 4) start/stop/restart does not affect expected service

Use service targets (`node`, `pool`, `agent`, `bridge`, ...), not raw container labels.

Example:

```bash
zion restart node
zion logs node
```

---

## 5) Config changes do not apply

```bash
zion config path
zion config show
zion config validate
```

Then set again:

```bash
zion config set node.rpc_host 91.98.122.165
```

---

## 6) Not sure what to do first

Use this anti-chaos order:

1. `zion status`
2. `zion node status`
3. `zion pool stats`
4. `zion agent status`
5. `zion logs <service>`

Do not begin with random full-stack restarts.