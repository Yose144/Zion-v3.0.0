# ZION CLI Deploy Playbook

## Bezpečné výchozí pořadí

Pro akce měnící runtime postupuj takto:

1. zkontroluj aktuální stav,
2. udělej nejmenší potřebný krok deploye,
3. ověř zasaženou vrstvu.

Základní sekvence:

```bash
zion deploy status
zion deploy update
zion status
zion agent status
```

## Běžný postup deploye

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

## Ověření po nasazení

```bash
zion status
zion node status
zion pool stats
zion agent status
```

Když se měnil lokální zdrojový kód webu, spusť i:

```bash
cd APP&WEB/website-v2.9
npm run build
```

## Operační poznámka

AI Native je teď potřeba chápat hlavně jako service control plane. Degradovaný model backend automaticky neznamená, že deploy selhal.