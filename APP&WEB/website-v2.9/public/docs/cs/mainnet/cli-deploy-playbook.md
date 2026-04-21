# ZION CLI Deploy Playbook

## Bezpečné výchozí pořadí

Pro runtime-changing akce preferuj:

1. zkontrolovat aktuální stav,
2. udělat nejmenší potřebný deploy krok,
3. ověřit zasaženou vrstvu.

Základní sekvence:

```bash
zion deploy status
zion deploy update
zion status
zion agent status
```

## Běžné deploy flow

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

## Ověření po deployi

```bash
zion status
zion node status
zion pool stats
zion agent status
```

Když se lokálně měnil website source, spusť i:

```bash
cd APP&WEB/website-v2.9
npm run build
```

## Operační poznámka

AI Native je teď potřeba chápat hlavně jako service control plane. Degradovaný model backend automaticky neznamená, že deploy selhal.