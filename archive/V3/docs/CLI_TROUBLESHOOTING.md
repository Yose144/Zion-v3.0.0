# ZION CLI Troubleshooting

## Purpose

This document is the first-response playbook for operator issues around `zion`.

It is intentionally practical and biased toward the current real stack: small production host, orchestrator-first AI runtime, and compose-backed service lifecycle.

## 1. `zion status` looks unhealthy

First run:

```bash
zion status
zion node status
zion agent status
```

Interpretation:

- if both node and agent fail, suspect host, network, or deploy-level issues,
- if node works and agent fails, the issue is probably isolated to the L3 runtime,
- if top-level status is noisy, use the layer-specific command next instead of guessing.

## 2. `zion agent` answers in fallback mode

This is not automatically a broken runtime.

It usually means:

- the AI Native HTTP service is alive,
- status, memory, RAG, and control-plane functions still work,
- the configured LLM backend is unavailable or unreachable.

Recommended checks:

```bash
zion agent status
zion agent config
zion logs ai-native
```

What to verify:

- backend mode,
- configured base URL or remote model endpoint,
- whether the service is explicitly reporting degraded mode instead of silently failing.

## 3. `start`, `stop`, or `restart` does not affect the service you expected

The lifecycle layer maps to compose service names, not container guesses.

Current important mappings:

- `node` or `core` -> `core`
- `agent` or `ai-native` -> `ai-native`
- `monitoring` -> monitoring bundle

Recommended checks:

```bash
zion restart ai-native
zion logs ai-native
zion deploy status
```

If the wrong service name is used, the CLI may still pass it through, but the underlying compose action may not do what you intended.

Current expected behavior is stricter: unsupported lifecycle targets should fail locally with a clear supported-target list before any SSH call is attempted.

## 4. `zion logs <service>` is empty or unhelpful

Check whether the target service is really the affected layer.

Good narrowing sequence:

```bash
zion status
zion logs node
zion logs ai-native
zion logs bridge
```

Do not jump straight into random services when the layer is already identifiable from `zion status`.

## 5. The website is up but docs are missing or stale

The public docs site reads markdown files from the website public docs tree.

That means repo docs alone are not enough.

When public docs are stale, verify both:

1. the markdown exists under `APP&WEB/website-v2.9/public/docs/`,
2. the docs page navigation references it.

Typical local validation:

```bash
cd APP&WEB/website-v2.9
npm run build
```

## 6. Config changes do not seem to apply

First verify which config file is active.

```bash
zion config path
zion config show
```

Then re-apply the intended value:

```bash
zion config set server.host 100.76.16.108
```

If the file is incomplete or stale, re-run:

```bash
zion config init
```

## 7. Node calls fail even though the host is reachable

Do not assume the issue is generic network failure.

First separate host reachability from RPC contract mismatch:

```bash
zion node status
zion node rpc getChainInfo
```

If the raw RPC call works but a higher-level command does not, the problem is probably command wiring or payload mapping, not infrastructure.

## 8. Bridge or DAO flows look inconsistent

Use the narrowest read path before doing anything mutating.

```bash
zion bridge status
zion bridge pending
zion dao treasury
zion dao params
```

If the read path already looks wrong, do not proceed to transfer or vote actions until the state is understood.

## 9. TUI commands fail or are not suitable in the current environment

`zion monitor` and `zion explorer` are TUI-oriented.

The new `zion` interactive launcher is also terminal-oriented.

If the shell environment is non-interactive, fall back to non-TUI commands first:

```bash
zion status
zion node blocks
zion pool stats
```

If you are in a real terminal and want the guided launcher explicitly, use:

```bash
zion menu
```

## 10. Fast incident triage checklist

Use this exact order when speed matters:

1. `zion status`
2. `zion node status`
3. `zion pool stats`
4. `zion agent status`
5. `zion logs <affected-service>`
6. the narrow layer command

That keeps triage factual and prevents random service restarts from becoming the first move.

## 11. `zion update` vs `zion deploy update` feels confusing

These two commands do different jobs.

Use:

```bash
zion update --check
zion version
```

when you mean the local CLI binary on your current machine.

Use:

```bash
zion deploy status
zion deploy update
```

when you mean remote containers on the configured host.

If you run the wrong one, you may update your local operator binary without touching the server runtime, or refresh the server runtime without changing your local CLI install.