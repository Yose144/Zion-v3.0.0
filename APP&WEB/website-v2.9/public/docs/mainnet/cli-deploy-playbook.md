# ZION CLI Deploy Playbook (bezpečný postup)

Tento playbook je psaný pro člověka, který nechce "střelit naslepo".

## Bezpečné pravidlo

Nejdřív zjisti stav, potom udělej nejmenší možný zásah, pak ověř výsledek.

---

## 1) Před deployem

```bash
zion deploy status
zion status
zion doctor
```

Pokud něco padá už teď, nejdřív oprav runtime, teprve pak deploy.

---

## 2) Nejčastější deploy scénáře

### A) Website-only deploy

```bash
zion deploy status
zion deploy website
zion logs website
```

Po deployi ověř endpointy:

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

### C) Cílený restart jedné služby

```bash
zion restart node
zion logs node
zion node status
```

---

## 3) Post-deploy kontrola (must-have)

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

## 4) Kdy použít prune

`prune` používej, když řešíš plný disk nebo build cache odpad.

Nikdy ho nepouštěj jako první krok incidentu.

```bash
zion deploy prune
```

---

## 5) Nouzový mini-rollback mindset

Když se po deployi rozbije jedna vrstva:

1. zastav eskalaci,
2. vrať službu do posledního zdravého stavu,
3. teprve potom řeš detailní root-cause.

Prakticky:

```bash
zion logs website
zion logs node
zion status
```

Rollback postup se může lišit podle služby, ale diagnostický vstup je vždy stejný.
