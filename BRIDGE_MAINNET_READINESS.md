# ZION Bridge — Mainnet Readiness Report

> Generated: 2026-06-22
> Scope: Base Mainnet 5/5 multisig bridge deployment readiness

## Executive Summary

Mainnet contracts are **partially deployed but unsafe**. The current `ZIONBridge` at `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` has `threshold() == 1` (single-sig). A new 5/5 bridge must be deployed before the relay can be enabled.

**Good news:** 5 validator addresses are provisioned and funded with minimum ETH.

## On-chain verification

| Contract | Address | Status |
|----------|---------|--------|
| wZION | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ✅ Exists, totalSupply > 0 |
| ZIONBridge (current) | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ⚠️ **threshold() == 1 (single-sig)** |
| UniV3Pool | `0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB` | ✅ Listed on website |

## Validator addresses (Base Mainnet)

| # | Address | Balance |
|---|---------|---------|
| 1 | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` | 0.002102 ETH |
| 2 | `0x24d986841E56e5571489B25951eE8C1Ae761FA82` | 0.001000 ETH |
| 3 | `0x665c55eDCF25c2c5A1dfF1B20eE950cBDC58d3d0` | 0.001000 ETH |
| 4 | `0x8E644b3E9FaBf52eE321DC5B3D5AA06d6e3E66C6` | 0.001000 ETH |
| 5 | `0x7e0D2eD71d78B9CFB5034A83333e82e304bc4CB2` | 0.001000 ETH |

**Total funding:** ~0.0061 ETH. This is the minimum for initial deployment and a few operations. Recommended: top up to 0.01 ETH each for operational headroom.

## Blockers before mainnet enable

1. **Deploy new 5/5 ZIONBridge**
   ```bash
   forge create --rpc-url $BASE_RPC --private-key $PRIVATE_KEY \
     --root V3/L2/bridge/contracts \
     src/ZIONBridge.sol:ZIONBridge \
     --constructor-args 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6
   ```

2. **Deploy new 5/5 BridgeValidator**
   ```bash
   forge create --rpc-url $BASE_RPC --private-key $PRIVATE_KEY \
     --root V3/L2/bridge/contracts \
     src/BridgeValidator.sol:BridgeValidator \
     --constructor-args 5 5
   ```

3. **Add 4 remaining guardians to BridgeValidator**
   ```bash
   cast send $VALIDATOR_ADDRESS "addGuardian(address)" 0x24d986841E56e5571489B25951eE8C1Ae761FA82 \
     --private-key $PRIVATE_KEY --rpc-url $BASE_RPC
   # repeat for 0x665c..., 0x8E64..., 0x7e0D...
   ```

4. **Migrate wZION ownership/minter rights** to the new ZIONBridge.

5. **Update configs and website**
   - `V3/config/bridge-mainnet.toml`
   - `V3/L2/bridge/config/bridge-mainnet.toml`
   - `APP&WEB/website-v2.9/src/lib/bridge-api.ts`
   - `APP&WEB/website-v2.9/src/lib/defi-contracts.ts`

6. **Set `enabled = true`** for mainnet Base chain and start relay.

## Testnet status

- Base Sepolia 2/2 config is synchronized and tested.
- `zion-bridge` loads and starts with `V3/config/bridge-testnet.toml`.
- EVM watcher block-range bug fixed (chunked to 1500 blocks to respect Base RPC limits).
- Testnet ZIONBridge also has `threshold() == 1` on-chain, but config is 2/2 — testnet bridge should be redeployed with threshold 2 or config lowered to match reality.

## Files changed

- `V3/L2/bridge/src/evm_watcher.rs` — chunked scan, metrics update
- `V3/L2/bridge/src/main.rs` — metrics passed to EVM watcher
- `V3/config/bridge-mainnet.toml` — real addresses, 5/5 validators, 100 gwei, current start_block
- `V3/L2/bridge/config/bridge-mainnet.toml` — mirrored
- `V3/config/bridge-testnet.toml` — updated RPC, current start_block
- `V3/L2/bridge/config/bridge-testnet.toml` — mirrored
- `V3/L2/bridge/tests/mainnet_readiness.rs` — updated assertions
- `V3/docs/BRIDGE_MAINNET_DEPLOY.md`, `BRIDGE_MAINNET_LAUNCH_CHECKLIST.md`, `BRIDGE_MULTISIG.md`
- `L2audit.md` — mainnet security risk documented
- `ZION_3.0.2_PLAN.md` — mainnet tasks updated

## Next action

Run the 5/5 mainnet contract deployment with the funded deployer wallet.
