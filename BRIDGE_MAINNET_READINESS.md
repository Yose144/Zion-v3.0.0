# ZION Bridge — Mainnet Deployment Report

> Generated: 2026-06-22, updated 2026-06-23 (100M ZION UTXO locks potvrzeny, validator key bloker)
> Scope: Base Mainnet 5/5 multisig bridge deployment

## Executive Summary

✅ **Mainnet 5/5 bridge is deployed and live.**

- New `ZIONBridge` deployed at `0x89504D6eD6993d726438E1A9C18aaC79e8d0eF88` with `threshold = 5` and 5 validators.
- New `BridgeValidator` deployed at `0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627` with `threshold = 5` and 5 guardians.
- wZION `BRIDGE_ROLE` migrated from the old single-sig bridge (`0xa5a09b2...`) to the new 5/5 bridge.
- Old bridge no longer has `BRIDGE_ROLE` and cannot mint/burn.
- Mainnet bridge config updated to `enabled = true` and new addresses.
- Website updated to point to new mainnet contracts.

## On-chain verification

| Contract | Address | Status |
|----------|---------|--------|
| wZION | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ✅ Exists, totalSupply > 0 |
| ZIONBridge (new, 5/5) | `0x89504D6eD6993d726438E1A9C18aaC79e8d0eF88` | ✅ threshold = 5, validatorCount = 5 |
| BridgeValidator (new, 5/5) | `0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627` | ✅ threshold = 5, guardianCount = 5 |
| ZIONBridge (old, single-sig) | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ❌ BRIDGE_ROLE revoked |
| UniV3Pool | `0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB` | ✅ Listed on website |
| L1 bridge vault | `zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0` | ✅ ~100M ZION UTXO locks (6 TX s memo, bloky 11611–11612) + ~316 ZION uvízlý (account-model) |

## Deployment transactions

| Step | Tx Hash |
|------|---------|
| Deploy BridgeValidator (5/5) | `0xaf4df777b36598d5ce7d2c7640a019140f1dae3dbe9c622db333891a6b7168db` |
| Deploy ZIONBridge (5/5) | `0x885d8e582b2534eb744cec3b42e49a6ad4c05784d21aa4f1c529c8ea13fd886f` |
| Grant BRIDGE_ROLE to new bridge | `0x37629a36939449dc75e4f9c2a532cd44aced9df5c6049920c86720b7a1e3a122` |
| Revoke BRIDGE_ROLE from old bridge | `0x9375eda2c17565e6e89aabff38f04ca8910a76276cdd55f2294de414479afc9f` |
| Add guardian 2 | `0x96ea2b37a821f705eaef7ee6d0982c10b6b9c1418ef81cf1f5096a2072af2474` |
| Add guardian 3 | `0xc303d4e09853131236cb6392a2b5094e3f4e2a403d7514d576ca3446e2ff1756` |
| Add guardian 4 | `0xe149193a9b37881c52c8af596521e1c91e088fbfa5d341a52a8c27b8f26512be` |
| Add guardian 5 | `0x70b2f439f40933c4f8b94cd8d67bad79bdea9f8d39032a773f118b29bd71303f` |

## Validator addresses (Base Mainnet)

| # | Address | Balance | Role |
|---|---------|---------|------|
| 1 | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` | 0.002102 ETH | Deployer + Guardian + Validator |
| 2 | `0x24d986841E56e5571489B25951eE8C1Ae761FA82` | 0.001000 ETH | Guardian + Validator |
| 3 | `0x665c55eDCF25c2c5A1dfF1B20eE950cBDC58d3d0` | 0.001000 ETH | Guardian + Validator |
| 4 | `0x8E644b3E9FaBf52eE321DC5B3D5AA06d6e3E66C6` | 0.001000 ETH | Guardian + Validator |
| 5 | `0x7e0D2eD71d78B9CFB5034A83333e82e304bc4CB2` | 0.001000 ETH | Guardian + Validator |

**Total funding:** ~0.0061 ETH. Minimum operational amounts are met. Recommended: top up to ≥0.01 ETH each for high-volume operations.

## Configuration updates

- `V3/config/bridge-mainnet.toml` → `enabled = true`, `bridge_contract_address = 0x89504D...`
- `V3/L2/bridge/config/bridge-mainnet.toml` → same
- `APP&WEB/website-v2.9/src/lib/bridge-api.ts` → `BRIDGE_CONTRACTS = BRIDGE_CONTRACTS_MAINNET`
- `APP&WEB/website-v2.9/src/lib/defi-contracts.ts` → `ZIONBridge = 0x89504D...`
- `V3/L2/bridge/tests/mainnet_readiness.rs` → updated for live 5/5 mainnet

## Testnet status

- Base Sepolia 2/2 config is synchronized and tested.
- `zion-bridge` loads and starts with `V3/config/bridge-testnet.toml`.
- EVM watcher block-range bug fixed (chunked to 1500 blocks to respect Base RPC limits).
- Testnet ZIONBridge also has `threshold() == 1` on-chain, but config is 2/2 — testnet bridge should be redeployed with threshold 2 or config lowered to match reality.

## 100M ZION — Stav (2026-06-23)

> **Žádných 100M ZION NEBYLO ztraceno.** Testovací transfery z předchozích sessions byly po **100 ZION**, ne 100M. Všech 100M ZION z genesis slotu 14 (`zion1r565...`) bylo intact a úspěšně odesláno jako 6 UTXO locků s memo na bridge vault.

| TxID | Částka | Blok | Memo |
|------|--------|------|------|
| `6bc2aa3e2879dfb3d98b35b1a09d7abee8fa9e5f3092a464c0679e84d6519ef4` | 16,666,666 ZION | 11611 | ✅ |
| `d9ddb3c7aaf2ad3a320c2878a1822298ec438240d9a9ffdbca95d256ec637cdb` | 16,666,666 ZION | 11611 | ✅ |
| `09fc9abb00c5b95e797709259731313afca5e0cc4a14f6687351e9295c1c6bc1` | 16,666,666 ZION | 11611 | ✅ |
| `2cd12d90b10b3ce7218a17dd804d36ad9c8d5870f42e27132c91c33e92f8458e` | 16,666,666 ZION | 11611 | ✅ |
| `4b43e7a3623ec3d4c007c134bd831a21d6628195643c1d6a33a889324fecfe59` | 16,666,666 ZION | 11612 | ✅ |
| `035c761db8a7e9d847ff56a8d8f8d7b37703631fac2b64453fb02fb20a1ef691` | 16,666,569 ZION | 11612 | ✅ |
| **Celkem** | **~100,000,000 ZION** | — | ✅ Relay detekoval |

Viz [`fixL1bridge100m.md`](./fixL1bridge100m.md) pro kompletní chronologii a root cause analýzu.

## Next action

1. ~~**L1 wallet memo fix:**~~ ✅ Done (commit `20379ec4`) — `SendParams.memo` + `build_and_sign()` + CLI `--memo` passthrough.
2. ~~**Re-send UTXO lock:**~~ ✅ Done (2026-06-23) — 6 UTXO lock TX odeslány z `zion1r565...` (Slot 14) na bridge vault s memo `BRIDGE:base:0xdde17506...`, bloky 11611–11612, celkem ~100M ZION. Relay detekoval všech 6 locků.
3. **⚠️ Validator privátní klíč (BLOKER #1):** Relay nemůže mintnout wZION — chybí `keys/validator.key` nebo env var `ZION_VALIDATOR_PRIVATE_KEY` pro `0xdde17506...`. Poskytnout klíč a restartovat relay → ~100M wZION mintnut na `0xdde17506...`.
4. **Top up validator ETH (BLOKER #2):** Poslat ~0.05 ETH na všech 5 validátor adres pro relay gas (aktuálně: ~0.002 ETH každý).
5. **E2E test (BLOKER #3):** Lock L1 ZION → mint wZION na Base → přidat likviditu / swap → burn wZION → unlock L1 ZION.
6. **DEX likvidita (BLOKER #4):** Přidat ~100M wZION + WETH na UniV3Pool (`0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB`).

```powershell
$env:ZION_BRIDGE_CONFIG = 'V3/config/bridge-mainnet.toml'
cargo run --manifest-path V3/Cargo.toml -p zion-bridge
```
