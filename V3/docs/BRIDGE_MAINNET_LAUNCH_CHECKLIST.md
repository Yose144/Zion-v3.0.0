# ZION Bridge — Base Mainnet Launch Checklist

> **Status:** Pre-launch (existing bridge is unsafe)  
> **Target:** Base Mainnet (chain ID 8453)  
> **Guardian model:** 5-of-5 multisig
> **Blocker:** Current `ZIONBridge` at `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` has `threshold() == 1` (single-sig). Must be redeployed as 5/5.

## Phase 0 — Pre-Deploy (Done)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | `BridgeValidator.sol` committed | ✅ | `V3/L2/bridge/contracts/BridgeValidator.sol` |
| 2 | `provision-bridge-validators.sh` ready | ✅ | `scripts/provision-bridge-validators.sh` |
| 3 | `deploy-bridge-base.sh` supports mainnet | ✅ | `scripts/deploy-bridge-base.sh base` |
| 4 | `verify-bridge-base.sh` ready | ✅ | `scripts/verify-bridge-base.sh base` |
| 5 | `bridge-mainnet.toml` config template | ✅ | `V3/config/bridge-mainnet.toml` |
| 6 | Website UI ready for mainnet | ✅ | `BRIDGE_CONTRACTS = BRIDGE_CONTRACTS_MAINNET` |
| 7 | Desktop agent UI ready | ✅ | "Base Mainnet" badge |
| 8 | Mobile app config ready | ✅ | `CONFIG.BRIDGE.MAINNET` |
| 9 | Prometheus alert rules | ✅ | `zion_bridge_alerts` in `alert_rules.yml` |
| 10 | SLO definitions | ✅ | `V3/docs/SLO.md` |

## Phase 1 — Guardian Provisioning (Before Deploy)

| # | Item | Owner | Status |
|---|------|-------|--------|
| 1 | Run `scripts/provision-bridge-validators.sh base` to generate 5 keys | Deployer | ☐ |
| 2 | Import key 1 to Ledger Nano S (deployer) | Deployer | ☐ |
| 3 | Import key 2 to Ledger Nano X (edge operator) | Edge operator | ☐ |
| 4 | Generate key 3 on air-gapped machine (cold guardian) | Backup guardian | ☐ |
| 5 | Distribute public addresses to `guardians-base-mainnet.json` | Deployer | ☐ |
| 6 | Fund deployer wallet with ≥0.05 ETH on Base | Deployer | ☐ |
| 7 | Fund 4 remaining guardians with ≥0.01 ETH each (relay gas) | Deployer | ☐ |

## Phase 2 — Contract Deploy (Launch Day)

| # | Item | Command / Script |
|---|------|-----------------|
| 1 | Set env vars | `export PRIVATE_KEY=0x...; export BASE_RPC=https://base-mainnet.publicnode.com` |
| 2 | Deploy wZION | `forge create --rpc-url $BASE_RPC --private-key $PRIVATE_KEY --root V3/L2/bridge/contracts src/wZION.sol:wZION` |
| 3 | Deploy ZIONBridge | `forge create --rpc-url $BASE_RPC --private-key $PRIVATE_KEY --root V3/L2/bridge/contracts src/ZIONBridge.sol:ZIONBridge --constructor-args <WZION_ADDR>` |
| 4 | Deploy BridgeValidator (5/5) | `forge create --rpc-url $BASE_RPC --private-key $PRIVATE_KEY --root V3/L2/bridge/contracts src/BridgeValidator.sol:BridgeValidator --constructor-args 5 5` |
| 5 | Add Guardian 2-5 | `cast send <VALIDATOR_ADDR> "addGuardian(address)" <ADDR> --private-key $PRIVATE_KEY --rpc-url $BASE_RPC` |
| 6 | Record addresses | Update ALL files in Step 3 |

## Phase 3 — Address Sync (Critical — Do Not Skip)

After deploy, update these files with **real mainnet addresses**:

| File | Fields to update |
|------|-----------------|
| `V3/config/bridge-mainnet.toml` | `wzion_address`, `bridge_contract_address`, `enabled = true` |
| `APP&WEB/website-v2.9/src/lib/bridge-api.ts` | `BRIDGE_CONTRACTS_MAINNET.wzion_address`, `bridge_address` |
| `APP&WEB/mobile-app/src/constants/config.js` | `MAINNET.WZION_ADDRESS`, `MAINNET.BRIDGE_ADDRESS` |
| `V3/L2/bridge/tests/mainnet_readiness.rs` | Test constants |
| `V3/L3/warp/src/adapter/evm.rs` | `base` entry in chain addresses |
| `V3/docs/BRIDGE_MAINNET_DEPLOY.md` | Deployment summary |
| `StatusV3.md` | New section with live addresses |

## Phase 4 — Verification & Config

| # | Item | Status |
|---|------|--------|
| 1 | Verify wZION on BaseScan | `scripts/verify-bridge-base.sh base` |
| 2 | Verify ZIONBridge on BaseScan | ☐ |
| 3 | Verify BridgeValidator on BaseScan | ☐ |
| 4 | Update `bridge-mainnet.toml` with real addresses | ✅ |
| 5 | Configure validator threshold = 5, total = 5 | ✅ |
| 6 | Fund all 5 validator addresses with ≥0.01 ETH (recommended 0.05 ETH) | ❌ |
| 7 | Deploy new 5/5 `ZIONBridge` and migrate wZION ownership | ❌ |
| 8 | Set `enabled = true` for `base` chain in TOML | ❌ |
| 9 | Start relay: `docker compose --profile mainnet up -d bridge` | ❌ |
| 10 | Check relay metrics: `curl localhost:9102/metrics` | ❌ |

## Phase 5 — UI Activation

| # | Item | Status |
|---|------|--------|
| 1 | Website: update `BRIDGE_CONTRACTS_MAINNET` with real addresses | ☐ |
| 2 | Website: rebuild & deploy (`npm run build` on Edge) | ☐ |
| 3 | Mobile app: update `MAINNET` config, build release | ☐ |
| 4 | Desktop agent: update contract addresses in renderer | ☐ |
| 5 | Dashboard: update `bridge.db` path for mainnet | ☐ |

## Phase 6 — Smoke Test

| # | Item | Expected Result |
|---|------|----------------|
| 1 | L1 → Base: send 100 ZION with memo | wZION minted to EVM address within 15 min |
| 2 | Base → L1: burn 50 wZION | ZION unlocked on L1 within 5 min |
| 3 | Relay metrics show 0 errors | `zion_bridge_errors_total == 0` |
| 4 | Prometheus alerts green | No `BridgeRelayDown` / `BridgeMintFailure` |
| 5 | Website burn widget works | MetaMask switch → burn → TX confirmed |

## Rollback Plan

If critical issue within 24h of launch:

1. **Immediate:** Guardian 1 calls `pause()` on ZIONBridge (if contract has pause)
2. **Stop relay:** `docker compose stop bridge`
3. **Disable UI:** Set `enabled = false` in `bridge-mainnet.toml`, rebuild website
4. **Investigate:** Use testnet to reproduce (`scripts/deploy-bridge-base.sh base-sepolia`)
5. **Fix & redeploy:** Deploy fixed contracts, migrate state if possible

## Post-Launch Monitoring

First 72 hours:
- Watch `zion_bridge_errors_total` every 15 min
- Check `BridgeMintFailure` / `BridgeUnlockFailure` alerts
- Verify daily limit not exceeded
- Guardian signing latency < 2 min per operation

## Contact Escalation

| Severity | Action |
|----------|--------|
| P0 (bridge stopped) | All 5 guardians + deployer on Discord ASAP |
| P1 (mint/unlock backlog > 5) | Page active guardian on-call |
| P2 (error rate elevated) | Check during next business hour |
