# 💱 L2 — DeFi & Governance

> Závisí na L1. Nezávislé na L3/L4.

L2 vrstva poskytuje DeFi infrastrukturu — wrappovaný ZION na EVM chainech, bridge relay a DAO governance.

## Crates & Projekty

| Složka | Package | LOC | Testů | Popis |
|--------|---------|-----|-------|-------|
| `bridge/` | `zion-bridge` | 2,663 | 71 | Rust relay — L1 watcher, EVM event listener, validator consensus |
| `contracts/` | — (Hardhat) | 686 + 1,249 | 95 | wZION.sol ERC-20 + ZIONBridge.sol (Solidity) |
| `dao/` | `zion-dao` | 1,549 | 18 | DAO governance — treasury, voting, humanitarian fund |

## Dependency graf

```
bridge ←── (standalone, reads L1 via RPC)
dao    ←── (standalone, reads L1 via RPC)
contracts/ ←── (Hardhat/Solidity, separate toolchain)

L3/warp depends on L2/bridge
```

## Build

```bash
# Rust
cargo check -p zion-bridge
cargo check -p zion-dao
cargo test -p zion-bridge

# Solidity (Hardhat)
cd contracts && npm install && npx hardhat test
```
