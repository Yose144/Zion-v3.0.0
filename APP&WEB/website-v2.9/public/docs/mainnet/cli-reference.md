# ZION CLI Reference (praktická)

Tento dokument je "tahák" s konkrétními příkazy.

Pokud jsi začátečník, používej nejdřív `Guide`, potom tento seznam.

## 1) Základní kontrola stacku

```bash
zion status
zion doctor
zion logs node
zion logs ai-native
```

## 2) Životní cyklus služeb (start/stop/restart)

Podporované cíle:

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

## 3) L1: Node

```bash
zion node status
zion node peers
zion node blocks
zion node block 6801
zion node mempool
zion node rpc getChainInfo
```

## 4) L1: Pool

```bash
zion pool stats
zion pool miners
zion pool config
```

## 5) L1: Miner

```bash
zion mine status
zion mine bench
zion mine bench --ekam --backend opencl --work-size 8192
zion mine start --backend opencl
zion mine stop
```

## 6) Wallet

```bash
zion wallet new --set-default
zion wallet address
zion wallet balance
zion wallet send zion1example 1.25
```

## 7) L2: Bridge + DAO

```bash
zion bridge status
zion bridge pending

zion dao status
zion dao treasury
zion dao proposals
```

## 8) L3: Agent + WARP + NCL

```bash
zion agent status
zion agent config
zion agent memory
zion agent ask "What is current L3 state?"

zion warp status
zion warp stats

zion ncl status
zion ncl workers
```

## 9) Deploy a operace

```bash
zion deploy status
zion deploy server
zion deploy website
zion deploy prune
```

## 10) Config

```bash
zion config path
zion config show
zion config validate
zion config set node.rpc_host seed.zionterranova.com
```

## 11) Když `zion` není v PATH

Použij stejný příkaz přes cargo:

```bash
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- status
```
