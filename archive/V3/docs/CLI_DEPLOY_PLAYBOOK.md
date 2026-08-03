# ZION CLI Deploy Playbook

## Purpose

This document describes the operator flow for deploy, update, restart, validation, and rollback-oriented decisions around `zion`.

It is based on the current compose-backed V3 mainnet stack and the orchestrator-first L3 runtime posture.

Important scope note:

- `zion update` is the local CLI self-update path,
- `zion deploy update` is the remote container refresh path covered by this playbook.

## Safe Default Sequence

For any runtime-changing operation, use this baseline order:

1. inspect current state,
2. make the smallest required deploy action,
3. validate the affected layer,
4. only then widen scope.

The shortest version is:

```bash
zion deploy status
zion deploy update
zion status
zion agent status
```

## Common Deploy Flows

### 1. Full server-side update

```bash
zion deploy status
zion deploy server
zion status
```

Use when the runtime stack itself changed.

### 2. Website-only rollout

```bash
zion deploy status
zion deploy website
zion logs website
```

Use when only the public website or docs payload changed.

### 3. Targeted service restart

```bash
zion restart ai-native
zion agent status
zion logs ai-native
```

Use when code or configuration changed for one service but a full redeploy is unnecessary.

### 4. Cleanup after image churn

```bash
zion deploy prune
```

Use intentionally after repeated deploy cycles, not as a reflex before every rollout.

## Validation After Each Deploy

### Core stack checks

```bash
zion status
zion node status
zion pool stats
```

### L3 checks

```bash
zion agent status
zion agent config
zion agent ask "What is the current L3 state?"
```

### Website checks

```bash
zion logs website
```

If local web source changed, also validate with:

```bash
cd APP&WEB/website-v2.9
npm run build
```

## Deploy Semantics That Matter

### Compose service names are canonical

The CLI deploy surface acts on compose service names.

That means operator language should match the deploy source of truth:

- `core`
- `pool`
- `miner`
- `ai-native`
- `bridge`
- `dao`
- `website`
- `redis`
- monitoring bundle

### AI Native should be treated as a service control plane

Do not treat a degraded agent reply as proof that deployment failed.

Deployment can be successful while the model backend remains unavailable.

The right validation question is:

- is the service alive,
- are health and status endpoints responding,
- is degraded mode explicit and truthful?

## Rollback-Oriented Thinking

There is no magical rollback command documented here yet.

For now, rollback discipline means:

1. avoid changing more than one deploy slice at once,
2. validate immediately after the smallest change,
3. use service restarts before broad restacks when appropriate,
4. keep compose source-of-truth and deploy scripts aligned.

In practice, that means a bad website change and a bad AI runtime change should not be rolled out together.

## Edge Host Reality

The current production host is resource-constrained.

Operational consequences:

- prefer targeted restarts over unnecessary full restacks,
- do not assume local heavyweight AI inference,
- validate memory-sensitive changes carefully,
- keep AI Native honest about fallback mode.

## Recommended Change Discipline

When you add or alter deploy-managed CLI surface, update these in the same change:

1. CLI help and command wiring,
2. V3 operator docs,
3. public website docs where safe,
4. compose or deploy source-of-truth if lifecycle semantics changed.

That keeps runtime operations auditable instead of folklore-driven.