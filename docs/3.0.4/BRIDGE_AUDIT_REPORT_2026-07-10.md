# Bridge Validator Address Audit & On-Chain Sync Report

**Date:** 2026-07-10  
**Author:** Devin (assisted)  
**Status:** Config fixed, awaiting owner key deployment

---

## Executive Summary

A comprehensive audit of bridge validator addresses across the repository, Edge server, and on-chain state (Basescan) revealed **three independent sets of validator addresses** — only one of which matches the actual on-chain bridge contract. All configs and docs have been synced to the on-chain truth. The Edge server bridge service was also fixed (stuck L1 block scan), but the final blocker is a wrong validator private key that the owner must replace.

---

## 1. Three Sets of Validator Addresses

### Set A — On-chain (Basescan verified) ✅ CORRECT

Source: `L2wallet.md` + Basescan TXs on bridge `0x72c8f0Dc...`

```
0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186  (deployer/guardian, 0.0185 ETH)
0x24d986841E56e5571489B25951eE8C1Ae761FA82  (0.000256 ETH)
0x665c55eDCF25c2c5A1dfF1B20eE950cBDC58d3d0  (0.000259 ETH)
0x8E644b3E9FaBf52eE321DC5B3D5AA06d6e3E66C6  (0.000260 ETH)
0x7e0D2eD71d78B9CFB5034A83333e82e304bc4CB2  (0.000795 ETH)
```

**Evidence:** Bridge `0x72c8f0Dc...` has 3,649 TXs on Basescan. Latest `SubmitLockProof` calls (2026-07-02) from all 5 addresses. Contract verified, ABI confirms 5/5 threshold.

### Set B — Hard-reset (never deployed) ❌ WRONG

Source: `bridge-mainnet.toml` (before fix), `GENESIS_HARD_RESET_CANONICAL.md`, `genesis.md`

```
0x9b5b9a6c4ce4bcd4479d8ea6d12cd7bfeb61085f
0x8a804afd4c200e95f415df6907da111a0258a578
0x694f3b43f4bf77dfbef53224791272d102449218
0x64c85af40143484c12316723192a0d71c10e82b8
0xe093ff26da65079df435a89834497abc380b59ae
```

**Status:** 0 TXs on Basescan. These keys were generated during the 2026-07-06 hard reset but the EVM contracts were **never redeployed**. They exist only in config files.

### Set C — DefiL2 report (never deployed) ❌ WRONG

Source: `DefiL2.md` (before fix), `ROADMAP.md` task 2.3 (before fix)

```
0xA737B512B5EEc5B9E3E3f2476Eb1cFDF6750BA12
0x7E263879c30f8C218A06be16ec66F7e9e1bFE879
0xD4E4c264417b6959503EdBBC3347052C4ca3857d
0x609E05c1E935d5617703912C5d5dd39d3C0C0417
0x603b43E51892dD25b845aB7E9317EA303f506096
```

**Status:** 0 TXs on Basescan. These addresses appeared in the DefiL2 status report and ROADMAP but were never on-chain.

### Set C-1 — Edge server private key (critical bug) ❌ WRONG

The Edge server's `ZION_VALIDATOR_PRIVATE_KEY` env var contains:
```
1ef885081addfac4c60eee6d833dcf032b45d24339bc141eca9356ceeb9ddf9b
```
This derives to **`0xA737B512B5EEc5B9E3E3f2476Eb1cFDF6750BA12`** — a Set C address.

- 0 ETH on Base
- Not registered as validator in bridge contract
- Bridge uses this key for `submitLockProof` → always fails

---

## 2. Basescan On-Chain Verification (2026-07-10)

| Contract | Address | Verified | TXs | Creator | Age |
|----------|---------|----------|-----|---------|-----|
| wZION | `0x0c493763...2bb6` | ✅ | 30 | `0xdde17506...` | 99d |
| ZIONBridge (5/5) | `0x72c8f0Dc...6467` | ✅ | 3,649 | `0xdde17506...` | 11d |
| ZIONBridge (old) | `0xa5a09b2C...1721` | ✅ | 3 | `0xdde17506...` | 99d |
| ZIONBridge (stale) | `0x89504D6e...eF88` | ❌ | 6,206 | `0xdde17506...` | 17d |
| ZIONAtomicSwap | `0x3DE9Ad42...63Eb` | ✅ | 0 | `0xdde17506...` | 99d |
| ZIONGovernance | `0xB77eB4ab...23E8` | ✅ | 1 | `0xdde17506...` | 10d |
| ZIONTreasury | `0x455f465a...aEeD` | ✅ | 0 | `0xdde17506...` | 10d |
| ZIONStaking | `0xbd5cEe78...e78B` | ✅ | 2 | `0xdde17506...` | 10d |
| ZIONFarm | `0x167B2753...8B08` | ✅ | 3 | `0xdde17506...` | 10d |
| BridgeValidator | `0x9C138dC6...5627` | ❌ | 4 | `0xdde17506...` | 17d |

**Main wallet `0xdde17506...`:** 0.0185 ETH, 99.12M wZION, Uni V4 + PancakeSwap NFT positions, active (ModifyLiquidity 3h ago). Funded by Binance 73 (99d ago). EIP-7702 delegated to MetaMask.

---

## 3. Files Fixed (17 files, 4 commits)

### Commit `d48f3fea8` — sync bridge configs to on-chain (10 files)

| File | Change |
|------|--------|
| `V3/L2/bridge/config/bridge-mainnet.toml` | `validator_addresses` → Set A, `default_evm_recipient` → `0xdde17506...` |
| `V3/config/bridge-mainnet.toml` | Same |
| `public/V3/L2/bridge/config/bridge-mainnet.toml` | Same |
| `V3/L2/contracts/hardhat/scripts/deploy-chain.ts` | `DEFAULT_VALIDATORS` → Set A |
| `public/V3/L2/contracts/hardhat/scripts/deploy-chain.ts` | Same |
| `V3/L2/bridge/tests/mainnet_readiness.rs` | Test assertions → Set A |
| `public/V3/L2/bridge/tests/mainnet_readiness.rs` | Same |
| `DefiL2.md` | Validator table → Set A, ZIONAtomicSwap address → `0x3DE9...` |
| `APP&WEB/website-v2.9/src/app/api/bridge/status/route.ts` | `bridge_contract` → `0x72c8f0Dc...`, `chains_active` 6→4 |
| `APP&WEB/website-v2.9/src/lib/defi-contracts.ts` | Added `ZIONAtomicSwap: '0x3DE9...'` to mainnet |

### Commit `06ae8b537` — sync remaining docs (3 files)

| File | Change |
|------|--------|
| `public/docs/genesis.md` | EVM bridge validators → Set A |
| `docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md` | Validator table → Set A |
| `ROADMAP.md` | Task 2.1 ✅ Done, task 2.3 updated |

### Commit `854c9381d` — DefiL2.md L1 lock recipient (1 file)

| File | Change |
|------|--------|
| `DefiL2.md` | L1 lock recipient `0x9b5b9a6c...` → `0xdde17506...` |

### Commit (this report) — audit report + DefiL2 root cause update (3 files)

| File | Change |
|------|--------|
| `docs/3.0.4/BRIDGE_AUDIT_REPORT_2026-07-10.md` | This report (new) |
| `DefiL2.md` | Root cause updated (wrong key, not ETH), DB state, validator funding |
| `ROADMAP.md` | Task 2.3 → ✅ Done (ETH not blocker, key is) |

---

## 4. Edge Server Fixes (2026-07-10)

### 4.1 Config sync

- `/etc/zion/config/bridge-mainnet.toml` — `validator_addresses` → Set A
- `/etc/zion/config/bridge-mainnet.toml` — `default_evm_recipient` → `0xdde17506...`
- `/etc/zion/config/bridge-mainnet.toml` — `start_block_height` → 456

### 4.2 Bridge DB fix

- `bridge_state.last_l1_height` → 456 (was 400, stuck on missing blocks)
- `l1_locks.a62d9350...` → status `pending`, retry_count 0 (was `Failed`, retry 12)

### 4.3 L1 block gap

After hard-reset, L1 chain has a gap:
- Block 0 (genesis): exists
- Blocks 1-456: **missing** (not produced or not accepted)
- Blocks 457-1448: exist

Bridge was scanning from 0, hit missing blocks at 401, and stuck. Fixed by setting `start_block_height=456` and `last_l1_height=456`.

### 4.4 Bridge restart result

After restart, bridge successfully:
1. Scanned blocks 457+ ✅
2. Found stuck L1 lock at block 891 ✅
3. Attempted `submitLockProof` → **FAILED**: "insufficient funds for gas * price + value: have 0 want 3380000000000"

**Root cause:** Bridge uses `ZION_VALIDATOR_PRIVATE_KEY` which derives to `0xA737B512...` (0 ETH, not an on-chain validator).

---

## 5. Remaining Action — Owner Must Deploy Validator Keys

### What's needed

Set 5 validator private keys in `/etc/zion/edge-environment.sh` on Edge server:

```bash
ssh zion-new
sudo nano /etc/zion/edge-environment.sh
```

Replace line 90 and add 4 new lines:

```env
ZION_VALIDATOR_PRIVATE_KEY=<key for 0xdde17506...>
ZION_VALIDATOR_PRIVATE_KEY_2=<key for 0x24d98684...>
ZION_VALIDATOR_PRIVATE_KEY_3=<key for 0x665c55eD...>
ZION_VALIDATOR_PRIVATE_KEY_4=<key for 0x8E644b3E...>
ZION_VALIDATOR_PRIVATE_KEY_5=<key for 0x7e0D2eD7...>
```

**Order is critical** — must match `validator_addresses` in config.

### After key deployment

```bash
sudo systemctl daemon-reload
sudo systemctl restart zion-bridge
sudo journalctl -u zion-bridge -f
```

### Expected result

Bridge will retry stuck lock `a62d9350...` (16,666,666.67 ZION → wZION mint on Base). With 5/5 correct keys + ETH, `submitLockProof` should succeed, minting 16.67M wZION to `0xdde17506...`.

---

## 6. Security Note

The security disclosure (`SECURITY_DISCLOSURE_2026-07.md`) states that `0xdde17506...` was compromised via TeamViewer. The owner confirms the wallet was not attacked. All 5 on-chain validator addresses are from the pre-reset deployment and remain valid on-chain. The hard-reset keys (Set B) were never deployed to any EVM contract.

**Risk:** If the attacker retained the `0xdde17506...` private key, they have admin/owner role on all 7 EVM contracts and can mint wZON, add/remove validators, pause contracts, etc. The owner should verify no unauthorized transactions have occurred.
