# ZION CLI Deploy Playbook (safe procedure)

This playbook is written for anyone who doesn't want to "shoot blind".

## Safe rule

First check the state, then make the smallest possible change, then verify the result.

---

## 1) Before deploy

```bash
zion deploy status
zion status
zion doctor
```

If something is already failing, fix the runtime first, then deploy.

---

## 2) Most common deploy scenarios

### A) Website-only deploy

```bash
zion deploy status
zion deploy website
zion logs website
```

After deploy, verify the endpoints:

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

### C) Targeted restart of a single service

```bash
zion restart node
zion logs node
zion node status
```

---

## 3) Post-deploy check (must-have)

```bash
zion status
zion node status
zion pool stats
zion agent status
```

Web data sanity:

```bash
curl -sS https://zionterranova.com/api/health
curl -sS "https://zionterranova.com/api/blockchain/blocks?limit=3"
```

---

## 4) When to use prune

Use `prune` when you are solving a full disk or stale build cache problem.

Never run it as the first step of an incident.

```bash
zion deploy prune
```

---

## 5) Emergency mini-rollback mindset

When one layer breaks after a deploy:

1. stop escalation,
2. return the service to the last healthy state,
3. only then solve the detailed root cause.

In practice:

```bash
zion logs website
zion logs node
zion status
```

Rollback steps vary by service, but the diagnostic input is always the same.
