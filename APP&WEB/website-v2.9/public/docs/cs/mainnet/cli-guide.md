# ZION CLI Guide

## Co je `zion`

`zion` je sjednocené operatorské CLI pro celý stack ZION.

Pokrývá:

- L1 node, pool, miner, wallet,
- L2 bridge a DAO,
- L3 AI Native, WARP a NCL,
- deploy, monitor a explorer workflow.

## Aktuální pozice

Pro současný produkční stav je správné chápat CLI a AI Native hlavně jako orchestration vrstvu.

To znamená:

- nejdřív řízení služeb, health a status,
- pak integrace model backendů,
- ne obráceně.

## Základní příkazy

```bash
zion status
zion node status
zion pool stats
zion wallet balance
zion agent status
zion bridge status
zion dao treasury
zion warp stats
zion ncl workers
```

## Lifecycle služby

Podporované top-level cíle pro `start`, `stop`, `restart`:

- `all`
- `node` nebo `core`
- `pool`
- `miner`
- `agent` nebo `ai-native`
- `bridge`
- `dao`
- `website`
- `redis`
- `monitoring`

Příklady:

```bash
zion start ai-native
zion restart bridge
zion logs website
```

## L3 agent

`zion agent` je vstupní bod pro Hiranyagarbha runtime.

Typické použití:

```bash
zion agent status
zion agent ask "Jaký je stav L3?"
zion agent logs
```

## Důležité omezení

Současný produkční host není stavěný na těžkou lokální AI inferenci.

Proto je kanonická interpretace dnes:

- AI Native = orchestrator a control plane,
- LLM backend = volitelná integrace,
- fallback režim je přijatelný, pokud je transparentní.

## Související docs

- `ZION CLI Reference`
- `ZION CLI Troubleshooting`
- `ZION CLI Deploy Playbook`