# ZION Bridge — 5/5 Guardian Multisig Specification

## Overview

The ZIONBridge contract uses a **5-of-5 Guardian multisig** for critical operations:
- Minting wZION after L1 lock confirmation
- Unlocking ZION after EVM burn confirmation
- Treasury / emergency pause

> For testnet a 2-of-2 configuration is used. Mainnet is configured for 5-of-5 maximum security.

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
| 2 | Edge Operator | `0x8cc6F931edDAf5F14D0071727Ed1640752B5c787` | Hetzner / Edge | Ledger Nano X |
| 3 | Community Rep | TBD | Community-elected | TBD |
| 4 | Backup Guardian | TBD | Cold storage | Air-gapped |
| 5 | Audit Partner | TBD | External security firm | TBD |

> **Status:** Testnet guardians 1–2 are active. Mainnet slots 3–5 are pending provisioning. Mainnet requires all 5 slots filled before activation.

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
