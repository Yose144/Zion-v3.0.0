# ZION CLI Reference

## Účel

Tohle je příkazově orientovaný doplněk k hlavnímu CLI guide.

Použij ho, když potřebuješ konkrétní operátorské příklady pro aktuální surface `zion`.

## Základní runtime control

```bash
zion status
zion logs node
zion logs ai-native
zion dashboard
```

## Lifecycle targety

Aktuální top-level cíle:

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
zion stop monitoring
```

## L1 příklady

```bash
zion node status
zion node peers
zion node block 6801
zion node rpc getChainInfo

zion pool stats
zion pool miners

zion mine status
zion mine bench

zion wallet balance
zion wallet send zion1example 1.25
```

## L2 příklady

```bash
zion bridge status
zion bridge pending
zion bridge transfer base zion1example 10

zion dao status
zion dao treasury
zion dao vote 7 yes
```

## L3 příklady

```bash
zion agent status
zion agent config
zion agent memory
zion agent rag query "bridge"
zion agent ask "Jaký je aktuální stav L3?"

zion warp status
zion warp stats

zion ncl status
zion ncl workers
zion ncl submit ./job.json
```

## Operations příklady

```bash
zion deploy status
zion deploy server
zion deploy website
zion deploy prune

zion config show
zion config path
zion config set server.host 91.98.122.165

zion monitor
zion explorer
zion completions zsh
```

## Doporučené pořadí operátora

Když je něco špatně, nejkratší věcná sekvence bývá:

1. `zion status`
2. `zion node status`
3. `zion agent status`
4. `zion logs <affected-service>`
5. úzká command group pro postiženou vrstvu