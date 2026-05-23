# ⛓️ L1 — Blockchain Core

> **🔒 LOCKED pro MainNet — žádné změny bez hard-fork governance vote**

L1 je základ celého ZION ekosystému. Kompiluje a běží zcela nezávisle na L2-L4.

## Crates

| Crate | Package | LOC | Testů | Popis |
|-------|---------|-----|-------|-------|
| `core/` | `zion-core` | 16,202 | 419 | Blockchain engine — UTXO, consensus, P2P, RPC, mempool |
| `pool/` | `zion-pool` | 14,441 | 31 | Mining pool — Stratum v2, PPLNS, multi-algo revenue |
| `cosmic-harmony/` | `zion-cosmic-harmony-v3` | 12,421 | 46 | PoW algoritmus — ASIC-resistant, memory-hard |
| `miner/` | `zion-miner` | 10,233 | 20 | Universal miner — CPU/GPU, Metal, OpenCL |
| `native-libs/` | `verushash-native` | — | — | FFI wrapper pro VerusHash |

## Dependency graf

```
core ←── pool
  ↑       ↑
  └── miner
  
cosmic-harmony ←── core, pool, miner
```

## Build

```bash
cargo check -p zion-core
cargo check -p zion-pool
cargo check -p zion-miner
cargo check -p zion-cosmic-harmony-v3
cargo test -p zion-core
```

## Klíčové parametry

- Block time: 60s
- Block reward: 5,400.067 ZION (konstantní, žádný halving)
- DAA: LWMA (60 bloků, ±25%)
- Max reorg: 10 bloků
- Coinbase maturity: 100 bloků
- Fee policy: burn (100% zničeno)
