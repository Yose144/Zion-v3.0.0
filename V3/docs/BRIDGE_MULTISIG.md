# ZION Bridge — 5/5 Guardian Multisig Specification

## Overview

The ZIONBridge contract uses a **5-of-5 Guardian multisig** for critical operations:
- Minting wZION after L1 lock confirmation
- Unlocking ZION after EVM burn confirmation
- Treasury / emergency pause

> For testnet a 2-of-2 configuration is used. Mainnet is configured for 5-of-5 maximum security.
> **Mainnet status:** New 5/5 `ZIONBridge` deployed at `0x89504D6eD6993d726438E1A9C18aaC79e8d0eF88` and `BridgeValidator` at `0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627`. wZION `BRIDGE_ROLE` migrated. Mainnet is activated in config.

## Guardian Wallet Requirements

Each Guardian MUST:
1. **Own a self-custody EVM wallet** (hardware wallet recommended: Ledger / Trezor)
2. **Hold the private key offline** — never in a hot server, cloud, or repo
3. **Be geographically distributed** — minimum 3 time zones
4. **Run an independent relay node** for double-signing detection

## Guardian Set (v3.0.2)

| # | Role | Address | Location | Hardware |
|---|------|---------|----------|----------|
| 1 | Core Deployer | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` | Local | Ledger Nano S |
| 2 | Operator #2 | `0x24d986841E56e5571489B25951eE8C1Ae761FA82` | TBD | TBD |
| 3 | Operator #3 | `0x665c55eDCF25c2c5A1dfF1B20eE950cBDC58d3d0` | TBD | TBD |
| 4 | Operator #4 | `0x8E644b3E9FaBf52eE321DC5B3D5AA06d6e3E66C6` | TBD | TBD |
| 5 | Operator #5 | `0x7e0D2eD71d78B9CFB5034A83333e82e304bc4CB2` | TBD | TBD |

> **Status:** Testnet guardians 1–2 are active. Mainnet 5/5 `ZIONBridge` and `BridgeValidator` are deployed; all 5 addresses are funded with minimum ETH (~0.0061 ETH total). Mainnet is activated in config. Recommended to top up each address to ≥0.01 ETH.

## Multisig Contract: `BridgeValidator.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract BridgeValidator {
    uint256 public threshold;   // 3
    uint256 public guardianCount; // 5
    mapping(address => bool) public isGuardian;

    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);
    event ThresholdChanged(uint256 newThreshold);

    modifier onlyGuardian() {
        require(isGuardian[msg.sender], "Not a guardian");
        _;
    }

    constructor(uint256 _threshold, uint256 _guardianCount) {
        threshold = _threshold;
        guardianCount = _guardianCount;
        // Initial guardian is deployer; remaining 4 added via `addGuardian`
        isGuardian[msg.sender] = true;
        emit GuardianAdded(msg.sender);
    }

    function addGuardian(address _guardian) external onlyGuardian {
        require(!isGuardian[_guardian], "Already guardian");
        require(guardianCount < 5, "Max guardians reached");
        isGuardian[_guardian] = true;
        guardianCount++;
        emit GuardianAdded(_guardian);
    }

    function removeGuardian(address _guardian) external onlyGuardian {
        require(isGuardian[_guardian], "Not a guardian");
        require(guardianCount > threshold, "Cannot go below threshold");
        isGuardian[_guardian] = false;
        guardianCount--;
        emit GuardianRemoved(_guardian);
    }
}
```

## Deployment Checklist

- [ ] Generate 5 new EVM addresses on hardware wallets
- [ ] Store public addresses in `V3/config/guardians.json` (NEVER commit private keys)
- [ ] Deploy `BridgeValidator` with constructor args `(5, 5)`
- [ ] Call `addGuardian(addr)` 4x from deployer wallet
- [ ] Verify contract on BaseScan
- [ ] Update `V3/config/bridge-mainnet.toml` with validator address
- [ ] Update relay config: `threshold = 5`, `total_validators = 5`, `validator_addresses = ["0x...", ...]`
- [ ] Test 5/5 signing flow on Base Sepolia before mainnet

## Emergency Procedures

**Lost Guardian Key:**
1. Remaining 4 guardians sign `removeGuardian(lost)`
2. Add replacement via `addGuardian(new)`
3. Threshold maintained throughout

**Compromised Guardian:**
1. Immediately remove via `removeGuardian(compromised)` — requires 3-of-4
2. Add replacement
3. Rotate any affected relay signing keys

## Related Files

- `scripts/deploy-bridge-base.sh` — deployment script
- `scripts/verify-bridge-base.sh` — BaseScan verification
- `V3/config/bridge-testnet.toml` — testnet config template
- `V3/config/bridge-mainnet.toml` — mainnet config template (create when ready)
