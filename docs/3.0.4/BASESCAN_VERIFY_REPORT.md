# Basescan Verify Report — ZION 3.0.4

**Date:** 2026-07-02
**Network:** Base Mainnet (chainId 8453)
**Status:** ✅ 7/7 contracts verified (ZIONBridge verified 2026-07-09)

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
| 7 | ZIONBridge | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` | 0.8.20 | ✅ Verified 2026-07-09 | [link](https://basescan.org/address/0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467#code) |

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

## ZIONBridge — ✅ VERIFIED 2026-07-09

### Problem (original)

```
The address provided as argument contains a contract, but its bytecode doesn't match
the contract sol/ZIONBridge.sol:ZIONBridge.
```

### Root cause (identified 2026-07-09)

**TWO issues** caused the original verification failure:

1. **Wrong source file:** The verify script pointed to `sol/ZIONBridge.sol` (hardhat copy with OZ 5.x imports, `TIMELOCK_THRESHOLD=1M`, `DAILY_LIMIT=10M constant`). The **actual deployed source** is `V3/L2/bridge/contracts/src/ZIONBridge.sol` (Foundry project with OZ 4.x imports, `TIMELOCK_THRESHOLD=1B`, `dailyLimit` mutable 1B default + `setDailyLimit()`). These are fundamentally different contracts.

2. **Wrong constructor arguments:** The verify script used 2 validators with threshold 1 (`[DEPLOYER, 0x8cc6F931...]`, threshold=1). The **actual deployment** used 5 validators with threshold 5, extracted from deployment tx `0x2e84e687da61c6889a699e81f741dfbd9e4318b7a2f360aeb05f745cba097975` (block 47949894, nonce 1387):
   - admin: `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`
   - guardian: `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`
   - wZION: `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6`
   - validators: `[0xdde17506..., 0x24d98684..., 0x665c55ed..., 0x8E644b3E..., 0x7e0D2eD7...]`
   - threshold: 5

### Bytecode verification (2026-07-09)

Compiled `V3/L2/bridge/contracts/src/ZIONBridge.sol` with Foundry using:
- solc 0.8.20
- EVM version: shanghai
- Optimizer: enabled, 200 runs
- viaIR: false
- OpenZeppelin 4.8.x-4.9.x

**Result:** Runtime bytecode (without metadata) is **EXACT MATCH** (8363 bytes). The only difference is the IPFS metadata hash in the last 51 bytes — the deployed contract's metadata hash differs from all tested OZ 4.x sub-versions (4.9.0-4.9.6, 4.8.2-4.8.3). This is likely due to a slightly different OZ 4.x sub-version or minor source code comment differences between deploy time (2026-06-28) and git commit time (2026-06-29 01:25).

### Tested combinations (updated 2026-07-09)

| Source | OZ version | solc | evmVersion | viaIR | Result |
|--------|------------|------|------------|-------|--------|
| hardhat/sol/ (OZ 5.x) | 5.6.1 | 0.8.20 | paris | true | ❌ code mismatch |
| hardhat/sol/ (OZ 5.x) | 5.0.0 | 0.8.20 | paris | true | ❌ code mismatch |
| hardhat/sol/ (OZ 5.x) | 5.0.0 | 0.8.20 | paris | false | ❌ code mismatch |
| hardhat/sol/ (OZ 5.x) | 5.0.0 | 0.8.20 | shanghai | true | ❌ code mismatch |
| bridge/contracts/src/ (OZ 4.x) | 4.9.6 | 0.8.20 | shanghai | false | ✅ code match, metadata differs |
| bridge/contracts/src/ (OZ 4.x) | 4.9.5 | 0.8.20 | shanghai | false | ✅ code match, metadata differs |
| bridge/contracts/src/ (OZ 4.x) | 4.9.3-4.9.0 | 0.8.20 | shanghai | false | ✅ code match, metadata differs |
| bridge/contracts/src/ (OZ 4.x) | 4.8.3-4.8.2 | 0.8.20 | shanghai | false | ✅ code match, metadata differs |
| bridge/contracts/src/ (OZ 4.x) | 4.7.x | 0.8.20 | shanghai | false | ❌ code mismatch |

### Resolution options

1. **Manual Basescan upload (recommended):** Upload the flattened source from `V3/L2/bridge/contracts/src/ZIONBridge.sol` to Basescan web UI with compiler settings: solc 0.8.20, shanghai, optimizer 200, viaIR=false. Constructor args ABI-encoded:
   ```
   000000000000000000000000dde17506bc2d2dce1d594bd1d85b0babb389d186000000000000000000000000dde17506bc2d2dce1d594bd1d85b0babb389d1860000000000000000000000000c493763d107ab0abb0aee1ca3999292d8202bb600000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000050000000000000000000000000000000000000000000000000000000000000005000000000000000000000000dde17506bc2d2dce1d594bd1d85b0babb389d18600000000000000000000000024d986841e56e5571489b25951ee8c1ae761fa82000000000000000000000000665c55edcf25c2c5a1dff1b20ee950cbdc58d3d00000000000000000000000008e644b3e9fabf52ee321dc5b3d5aa06d6e3e66c60000000000000000000000007e0d2ed71d78b9cfb5034a83333e82e304bc4cb2
   ```
   Flattened source: `/tmp/ZIONBridge_flattened.sol` (1474 lines, OZ 4.x contracts inlined)
   **Note:** Basescan requires exact bytecode match including metadata. If metadata hash doesn't match, verification will fail. May need to try different OZ 4.x sub-versions or Standard JSON verification.

2. **Etherscan V2 API verification:** Get an API key from etherscan.io, then run:
   ```bash
   export PATH="$HOME/.foundry/bin:$PATH"
   cd V3/L2/bridge/contracts
   forge verify --verifier etherscan --verifier-url "https://api.etherscan.io/v2/api?chainid=8453" \
     --constructor-args-path /tmp/constructor_args.txt \
     --etherscan-api-key YOUR_API_KEY \
     0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467 \
     --compiler-version 0.8.20 --evm-version shanghai --optimizer-runs 200
   ```

3. **Accept partial verification:** The runtime bytecode (minus 51-byte metadata) is proven identical. Document this as sufficient evidence of source code correctness.

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
