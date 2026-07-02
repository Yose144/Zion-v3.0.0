# Basescan Verify Report — ZION 3.0.4

**Date:** 2026-07-02
**Network:** Base Mainnet (chainId 8453)
**Status:** ✅ 6/7 contracts verified · ❌ 1 cannot verify (ZIONBridge)

---

## Summary

| # | Contract | Address | Compiler | Status | Basescan URL |
|---|----------|---------|----------|--------|--------------|
| 1 | wZION | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | 0.8.20 | ✅ Already verified | [link](https://basescan.org/address/0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6#code) |
| 2 | ZIONAtomicSwap | `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` | 0.8.20 | ✅ Already verified | [link](https://basescan.org/address/0x3DE9Ad42716854083ab837706E3961d10B0e63Eb#code) |
| 3 | ZIONGovernance | `0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8` | 0.8.26 | ✅ Verified 2026-07-02 | [link](https://basescan.org/address/0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8#code) |
| 4 | ZIONTreasury | `0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD` | 0.8.26 | ✅ Verified 2026-07-02 | [link](https://basescan.org/address/0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD#code) |
| 5 | ZIONStaking | `0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B` | 0.8.26 | ✅ Verified 2026-07-02 | [link](https://basescan.org/address/0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B#code) |
| 6 | ZIONFarm | `0x167B2753F5D8D9F8e62875cc9e379d7804308B08` | 0.8.26 | ✅ Verified 2026-07-02 | [link](https://basescan.org/address/0x167B2753F5D8D9F8e62875cc9e379d7804308B08#code) |
| 7 | ZIONBridge | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` | 0.8.20 | ❌ Cannot verify | — |

---

## Constructor arguments used

### ZIONGovernance (1 arg)
```
[0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6]  // _zionToken
```

### ZIONTreasury (3 args)
```
[
  0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6,  // _zionToken
  [                                            // _signers (3-of-3 multisig)
    0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186,
    0x24d986841E56e5571489B25951eE8C1Ae761FA82,
    0x665c55eDCF25c2c5A1dfF1B20eE950cBDC58d3d0
  ],
  3                                            // _required (threshold)
]
```

### ZIONStaking (4 args)
```
[
  0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6,  // _wzion
  0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186,  // _admin
  0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186,  // _guardian
  1200                                         // _aprBps (12%)
]
```

### ZIONFarm (5 args)
```
[
  0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6,  // _rewardToken
  0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186,  // _admin
  0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186,  // _guardian
  1000000000000000000,                         // _rewardPerSecond (1 wZION/s)
  7776000                                      // _halvingInterval (90 days)
]
```

---

## Issues fixed during verification

### 1. Constructor argument mismatch (verify script)

The `verify-base-mainnet-basescan.ts` script had wrong constructor argument counts:
- ZIONGovernance: passed 2 args, contract expects 1 (`address _zionToken`)
- ZIONTreasury: passed 2 args, contract expects 3 (`address, address[], uint256`)
- ZIONStaking: passed 3 args, contract expects 4 (`address, address, address, uint256`)

**Fix:** Updated `loadNewContracts()` to read from `deployed-defi.json` `config` block (treasurySigners, treasuryThreshold, guardian, stakingAprBps) and `deployed-farm-base.json` (rewardToken, deployer, rewardPerSecond, halvingInterval).

### 2. Etherscan V1 API deprecated

The hardhat config used per-network apiKey object with custom V1 API URLs. Etherscan V1 is deprecated — verification returns:
```
You are using a deprecated V1 endpoint, switch to Etherscan API V2
```

**Fix:** Migrated to Etherscan V2 API — single `apiKey` string, removed `customChains` array. The hardhat-verify plugin automatically routes to `https://api.etherscan.io/v2/api?chainid=<id>`.

### 3. Compiler version mismatch (old contracts)

wZION, ZIONBridge, ZIONAtomicSwap were deployed with solc 0.8.20 (paris). The hardhat config has both 0.8.20 and 0.8.26 compilers — Hardhat picks the highest matching version (`^0.8.20` → 0.8.26), causing:
```
The contract was compiled with solidity 0.8.20, but your configured compiler version is: 0.8.26
```

**Fix for new contracts:** Used a temporary config with only 0.8.26 to verify Governance/Treasury/Staking/Farm.

**Fix for old contracts:** Used a temporary config with only 0.8.20. wZION and ZIONAtomicSwap were already verified (no re-verification needed). ZIONBridge could not be verified (see below).

---

## ZIONBridge — cannot verify

### Problem

```
The address provided as argument contains a contract, but its bytecode doesn't match
the contract sol/ZIONBridge.sol:ZIONBridge.
```

### Root cause

The ZIONBridge source code in the repo (`commit 1ca213bd`) differs from the version that was deployed on-chain. The bytecode metadata hash does not match any combination of:
- OpenZeppelin v5.0.0 and v5.6.1
- solc 0.8.20 with paris and shanghai EVM versions
- viaIR true and false

### Tested combinations

| OZ version | solc | evmVersion | viaIR | Result |
|------------|------|------------|-------|--------|
| 5.6.1 | 0.8.20 | paris | true | ❌ bytecode mismatch |
| 5.0.0 | 0.8.20 | paris | true | ❌ bytecode mismatch |
| 5.0.0 | 0.8.20 | paris | false | ❌ Stack too deep (ZIONAtomicSwap) |
| 5.0.0 | 0.8.20 | shanghai | true | ❌ bytecode mismatch |

### Resolution options

1. **Source recovery:** Find the exact source code at the commit used for deployment and verify with that.
2. **Redeploy:** Deploy a new ZIONBridge contract with the current source code, migrate state, and verify the new contract.
3. **Manual verification:** Use the Basescan web UI to upload flattened source manually (may work if the diff is only in metadata).

---

## Commands used

```bash
# On Edge server (root@100.76.16.108)
cd /root/zion-2.9.6-main/V3/L2/contracts/hardhat

# Set API key
sed -i 's/^BASESCAN_API_KEY=.*/BASESCAN_API_KEY=<key>/' .env

# Phase 1: Verify new 3.0.4 contracts (solc 0.8.26, cancun)
cp hardhat.config.026.ts hardhat.config.ts
rm -rf cache artifacts
source .env
npx hardhat run scripts/verify-base-mainnet-basescan.ts --network base

# Phase 2: Verify old contracts (solc 0.8.20, paris) — wZION + AtomicSwap already verified
cp hardhat.config.020.ts hardhat.config.ts
rm -rf cache artifacts
source .env
npx hardhat verify --network base --contract sol/ZIONBridge.sol:ZIONBridge \
  0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467 \
  0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186 \
  0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186 \
  0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6 \
  [0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186,0x8cc6F931edDAf5F14D0071727Ed1640752B5c787] \
  1
```

---

## Files modified

| File | Change |
|------|--------|
| `V3/L2/contracts/hardhat/scripts/verify-base-mainnet-basescan.ts` | Fixed constructor arguments to match actual contract signatures |
| `V3/L2/contracts/hardhat/hardhat.config.ts` | Migrated etherscan config from V1 (per-network apiKey + customChains) to V2 (single apiKey string) |
| `3.0.4.md` | Added §1.5 Basescan verify results table |
| `ROADMAP.md` | Updated item 2.2 from 🔵 Pending to ✅ Done |
| `AGENTS.md` | Added Basescan verify completion to 3.0.4 DeFi deploy section |
| `StatusV3.md` | Updated Basescan verify items to ✅ Done |
| `V3/README.md` | Updated BaseScan verification line to include 3.0.4 contracts |
| `V3/docs/ZION_3.0.4_DEPLOY_RUNBOOK.md` | Updated checklist + remaining items |

---

## Related

- [`3.0.4.md`](./3.0.4.md) §1.5 — Basescan verify results
- [`V3/docs/ZION_3.0.4_DEPLOY_RUNBOOK.md`](./V3/docs/ZION_3.0.4_DEPLOY_RUNBOOK.md) — DeFi deploy runbook
- [`ROADMAP.md`](./ROADMAP.md) §2.2 — Basescan verification item
- Commit `bbef2c5e` — docs: Basescan verify results
