# ZION CLI Deploy Playbook

## Safe default order

For runtime-changing actions, prefer this order:

1. inspect current state,
2. make the smallest deploy action,
3. validate the affected layer.

Baseline sequence:

```bash
zion deploy status
zion deploy update
zion status
zion agent status
```

## Common deploy flows

### Full server update

```bash
zion deploy status
zion deploy server
zion status
```

### Website-only rollout

```bash
zion deploy status
zion deploy website
zion logs website
```

### Targeted L3 restart

```bash
zion restart ai-native
zion agent status
zion logs ai-native
```

## Validation after deploy

```bash
zion status
zion node status
zion pool stats
zion agent status
```

If website source changed locally, also run:

```bash
cd APP&WEB/website-v2.9
npm run build
```

## Operational note

AI Native should currently be interpreted as a service control plane. A degraded model backend does not automatically mean the deployment failed.