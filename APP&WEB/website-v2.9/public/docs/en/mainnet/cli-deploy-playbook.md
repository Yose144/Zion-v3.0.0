# ZION CLI Deploy Playbook (safe workflow)

This playbook is designed for operators who want reliable, low-risk deploy steps.

## Safety rule

Inspect current state first, apply the smallest possible change, then validate.

---

## 1) Before deploy

```bash
zion deploy status
zion status
zion doctor
```

If runtime is already failing, stabilize runtime first, then deploy.

---

## 2) Common deploy scenarios

### A) Website-only deploy

```bash
zion deploy status
zion deploy website
zion logs website
```

Post-deploy endpoint checks:

```bash
curl -sS https://zionterranova.com/api/health
curl -sS "https://zionterranova.com/api/blockchain/blocks?limit=3"
```

### B) Server runtime update

```bash
zion deploy status
zion deploy server
zion status
```

### C) Targeted restart for one service

```bash
zion restart node
zion logs node
zion node status
```

---

## 3) Mandatory post-deploy validation

```bash
zion status
zion node status
zion pool stats
zion agent status
```

Website data sanity:

```bash
curl -sS https://zionterranova.com/api/health
curl -sS "https://zionterranova.com/api/blockchain/blocks?limit=3"
```

---

## 4) When to run prune

Use prune for disk pressure or stale build cache cleanup.

Do not use prune as your first incident action.

```bash
zion deploy prune
```

---

## 5) Emergency rollback mindset

If one layer breaks after deploy:

1. stop escalation,
2. return service to last healthy state,
3. analyze root cause afterward.

Practical starting checks:

```bash
zion logs website
zion logs node
zion status
```

Rollback mechanics vary by service, but diagnosis entrypoint is always the same.