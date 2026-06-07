# ZION V3 Genesis Regeneration Runbook
## Complete Mainnet Genesis Reset Procedure

**Purpose:** Regenerate all genesis components before mainnet launch  
**Author:** Yose (Creator)  
**Date:** 2026-06-03  
**Status:** DRAFT — Testing Phase Only

---

## Table of Contents

1. [Overview](#overview)
2. [Scope of Changes](#scope-of-changes)
3. [Prerequisites](#prerequisites)
4. [Security Requirements](#security-requirements)
5. [Step-by-Step Procedure](#step-by-step-procedure)
6. [Verification](#verification)
7. [Rollback Plan](#rollback-plan)
8. [Documentation Updates](#documentation-updates)

---

## Overview

This runbook describes the complete regeneration of ZION V3 genesis block and all related cryptographic components. This procedure should be executed **before mainnet launch** to ensure clean slate and maximum security.

### Why Regenerate Genesis?

- **Lost or compromised premine keys**
- **Strategic decision to use fresh cryptographic material**
- **Clean separation from testnet/experimental phases**
- **Maximize security before public launch**

### What Gets Regenerated?

| Component | Current State | New State |
|-----------|---------------|-----------|
| Genesis block hash | `60b5ff...98da` | **NEW** |
| Premine addresses | 14 outputs | **14 NEW outputs** |
| Premine private keys | Unknown/compromised | **NEW offline keys** |
| Pool payout wallet | Multisig (3/5) | **NEW multisig** |
| Bridge validator keys | 5 EVM addresses | **NEW EVM keys** |
| Canonical subsidy addresses | 4 deterministic labels | **NEW labels** |
| Bridge vault UTXO seed | 6 outputs | **NEW 6 outputs** |

---

## Scope of Changes

### 1. Cryptographic Components

- **Premine wallets:** 14 new Ed25519 keypairs
- **Pool payout:** New threshold signature scheme (3/5 or 2/3)
- **Bridge validators:** 5 new EVM wallets (Base chain)
- **Canonical subsidies:** New deterministic labels for miner/humanitarian/issobella/pool-fee
- **Bridge vault:** New UTXO coinbase with fresh outputs

### 2. Code Changes

- `V3/L1/core/src/genesis.rs` — new addresses, new amounts, new merkle root
- `V3/L1/core/src/crypto.rs` — new label derivation constants
- `V3/L1/core/src/fee.rs` — new bridge vault address
- `V3/L2/bridge/contracts/` — new validator addresses in contracts
- `V3/L1/pool/src/` — new payout wallet configuration

### 3. Documentation Updates

- `PREMINE_ADDRESSES_PUBLIC.txt` — new public addresses
- `V3/docs/mainnet/PREMINE_AND_CANONICAL_WALLETS_PUBLIC.txt` — new canonical addresses
- `AGENTS.md` — new genesis hash, new operational notes
- `README.md` — updated premine table
- All whitepapers and guides — updated genesis references

---

## Prerequisites

### Hardware Requirements

- **Offline machine:** Air-gapped computer for key generation (no network)
- **Secure storage:** Encrypted USB drive or hardware security module
- **Backup media:** Multiple encrypted backups (paper, metal, offline storage)

### Software Requirements

- **Rust toolchain:** `cargo` (for deterministic address generation)
- **Node.js:** For wallet SDK and bridge contract deployment
- **Foundry/Forge:** For EVM contract deployment
- **OpenSSL:** For encryption of backup files

### Access Requirements

- **SSH access to Edge server:** `root@100.76.16.108`
- **Local PC access:** For local node testing
- **GitHub access:** For pushing updated code
- **EVM RPC access:** Base chain testnet/mainnet for validator setup

---

## Security Requirements

### 1. Air-Gapped Key Generation

All private keys must be generated on an **offline machine** with no network access. Use:

- **Tails OS** or similar live OS
- **Hardware wallet** (Ledger/Trezor) for storage
- **Paper backup** with BIP-39 seed phrase
- **Metal plate** for long-term cold storage

### 2. Encryption Standards

- **AES-256-GCM** for encrypted backup files
- **Scrypt KDF** with high iteration count (≥ 100,000)
- **Strong passphrase:** 24+ characters, mixed case, numbers, symbols

### 3. Key Destruction

After backup, **securely erase** all temporary files:

```bash
shred -vfz -n 3 /path/to/private_keys/
dd if=/dev/urandom of=/path/to/private_keys bs=1M count=10
rm -f /path/to/private_keys
```

### 4. Access Control

- **Yose only:** Direct access to private keys
- **Multisig for pool:** Threshold signature (3/5) with trusted operators
- **Bridge validators:** 5 independent operators, threshold 3/5

---

## Step-by-Step Procedure

### Phase 1: Offline Key Generation

#### 1.1 Prepare Air-Gapped Environment

1. Boot Tails OS on offline machine
2. Install Rust: `curl --proto =https --tlsv1.2 -sSf https://sh.rustup.rs | sh`
3. Clone repo: `git clone https://github.com/Yose144/Zion-v3.0.0.git`
4. Checkout main branch: `cd Zion-v3.0.0 && git checkout main`

#### 1.2 Generate New Premine Wallets

Create script `V3/scripts/generate-premine-wallets.rs`:

```rust
use ed25519_dalek::{SigningKey, VerifyingKey};
use rand::rngs::OsRng;
use std::fs;
use std::io::Write;

fn main() {
    let mut rng = OsRng;
    let mut wallets = Vec::new();
    
    // Generate 14 premine wallets
    for i in 0..14 {
        let signing_key = SigningKey::generate(&mut rng);
        let verifying_key = signing_key.verifying_key();
        let address = zion_core::crypto::derive_address(verifying_key.as_bytes());
        let private_key_hex = hex::encode(signing_key.to_bytes());
        let public_key_hex = hex::encode(verifying_key.as_bytes());
        
        wallets.push((address, private_key_hex, public_key_hex));
    }
    
    // Write to encrypted file
    let mut file = fs::File::create("PREMINE_KEYS_ENCRYPTED.txt").unwrap();
    for (addr, sk, pk) in wallets {
        writeln!(file, "Address: {}", addr).unwrap();
        writeln!(file, "Private Key: {}", sk).unwrap();
        writeln!(file, "Public Key: {}", pk).unwrap();
        writeln!(file, "---").unwrap();
    }
}
```

Run: `cargo run --release --bin generate-premine-wallets`

#### 1.3 Generate New Pool Payout Wallet

Use existing `V3/L1/core/src/bin/gen-pool-payout-wallet.rs`:

```bash
cargo run --release --manifest-path V3/Cargo.toml -p zion-core --bin gen-pool-payout-wallet
```

This generates:
- Pool payout address
- Payout signing key
- `ZION_POOL_PAYOUT_SK_HEX` for config

#### 1.4 Generate New Canonical Subsidy Labels

Update labels in `V3/L1/core/src/genesis.rs`:

```rust
// OLD labels (to be replaced)
pub const MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_LABEL: &str =
    "ZION_V3_MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_RECIPIENT_v1";

// NEW labels (with v2 suffix)
pub const MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_LABEL: &str =
    "ZION_V3_MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_RECIPIENT_v2_2026-06-03-GENESIS-RESET";
```

Do this for all 4 canonical labels:
- Issobella subsidy
- Pool fee subsidy
- Default miner
- Pool payout signer

#### 1.5 Generate New Bridge Validator Keys

Use Foundry to generate 5 new EVM wallets:

```bash
cd V3/L2/bridge/contracts
forge wallet create --wallet validator-1
forge wallet create --wallet validator-2
forge wallet create --wallet validator-3
forge wallet create --wallet validator-4
forge wallet create --wallet validator-5
```

Store each private key in encrypted file.

---

### Phase 2: Update Genesis Block

#### 2.1 Update `V3/L1/core/src/genesis.rs`

Replace all 14 premine addresses with newly generated ones:

```rust
pub const PREMINE_OUTPUTS: &[PremineOutput] = &[
    // --- OASIS + Golden Egg (5 slots) ---
    PremineOutput {
        address: "NEW_ADDRESS_1",  // Replace with new address
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 1)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
    },
    // ... repeat for all 14 slots
];
```

**Important:** Keep the same amounts and categories — only change addresses.

#### 2.2 Update Bridge Vault Address

Generate new bridge vault address using `V3/L1/core/src/crypto.rs`:

```rust
pub fn bridge_vault_address() -> String {
    // Use new seed for bridge vault
    let seed = b"ZION_V3_BRIDGE_VAULT_SEED_v2_2026-06-03-GENESIS-RESET";
    let hash = blake3_hash(seed);
    derive_address(&hash)
}
```

Update `V3/L1/core/src/fee.rs`:

```rust
pub const BRIDGE_VAULT_ADDRESS: &str = "NEW_BRIDGE_VAULT_ADDRESS";
```

#### 2.3 Update Canonical Subsidy Addresses

After updating labels in Phase 1.4, regenerate addresses:

```bash
cargo run --release --manifest-path V3/Cargo.toml -p zion-core --bin canonical-mainnet-operator-env
```

Update constants in `V3/L1/core/src/genesis.rs`:

```rust
pub const MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET: &str = "NEW_ADDRESS";
pub const MAINNET_CANONICAL_POOL_FEE_SUBSIDY_WALLET: &str = "NEW_ADDRESS";
pub const MAINNET_CANONICAL_DEFAULT_MINER_WALLET: &str = "NEW_ADDRESS";
pub const MAINNET_CANONICAL_POOL_PAYOUT_WALLET: &str = "NEW_ADDRESS";
```

#### 2.4 Rebuild Genesis Block

The genesis block will automatically rebuild with new addresses and new merkle root:

```bash
cargo test --manifest-path V3/Cargo.toml -p zion-core genesis::tests::genesis_hash_is_deterministic
```

Record the new genesis hash:
```
NEW_GENESIS_HASH: <output from test>
```

---

### Phase 3: Update Pool Configuration

#### 3.1 Update Pool Payout Wallet

Update Edge server systemd service:

```bash
ssh -i ssh-key-zion-edge root@100.76.16.108
vi /etc/systemd/system/zion-pool.service
```

Add new environment variable:

```ini
Environment=ZION_POOL_PAYOUT_SK_HEX=NEW_POOL_PAYOUT_SK_HEX
```

#### 3.2 Update Bridge Validator Configuration

Update `V3/L2/bridge/contracts/BridgeValidator.sol`:

```solidity
contract BridgeValidator {
    address[] public validators = [
        NEW_VALIDATOR_1,
        NEW_VALIDATOR_2,
        NEW_VALIDATOR_3,
        NEW_VALIDATOR_4,
        NEW_VALIDATOR_5
    ];
    uint256 public threshold = 3; // 3-of-5
}
```

Deploy new contract to Base chain:

```bash
forge script script/DeployBridgeValidator.s.sol --rpc-url $BASE_RPC_URL --private-key $DEPLOYER_SK
```

---

### Phase 4: Update Documentation

#### 4.1 Update `PREMINE_ADDRESSES_PUBLIC.txt`

Replace all addresses with new ones:

```text
# ZION Mainnet Genesis Premine — Public Addresses
# Generated: 2026-06-03 (Genesis Regeneration)
# Total: 16,780,000,000 ZION (11.65% of max supply)

# 1–5: OASIS + Golden Egg/Xp (5 slots × 1.65B = 8.25B ZION)
1  NEW_ADDRESS_1    OASIS_Winner_1       1,650,000,000
2  NEW_ADDRESS_2    OASIS_Winner_2       1,650,000,000
...
```

#### 4.2 Update `V3/docs/mainnet/PREMINE_AND_CANONICAL_WALLETS_PUBLIC.txt`

Update canonical addresses:

```text
  • Bridge Seed Fund (premine slot 13)   = NEW_ADDRESS_13
  • Bridge Vault UTXO Seed (premine slot 14) = NEW_BRIDGE_VAULT_ADDRESS
```

#### 4.3 Update `AGENTS.md`

Update genesis hash:

```markdown
### Genesis Hash (canonical)

```
NEW_GENESIS_HASH
```
```

Add regeneration note:

```markdown
**2026-06-03 Genesis Regeneration:** Complete reset of all cryptographic material before mainnet launch.
- New 14 premine addresses
- New pool payout wallet
- New bridge validator keys
- New canonical subsidy labels
```

#### 4.4 Update All Whitepapers and Guides

Run global search and replace:

```bash
# Update genesis hash references
grep -r "60b5ff78ec7797c79b79069b3bea5553441d201d23329b389828b869723998da" --include="*.md" . | xargs sed -i 's/60b5ff...98da/NEW_GENESIS_HASH/g'

# Update old premine addresses
grep -r "zion1f6m2j0h0l773j4074324q5r528y475w4j7m9685" --include="*.md" . | xargs sed -i 's/zion1f6m2j...9685/NEW_ADDRESS_13/g'
```

---

### Phase 5: Hard Reset All Nodes

#### 5.1 Stop All Services

**Local PC:**
```powershell
ps aux | grep zion | grep -v grep | awk '{print $1}' | xargs kill
```

**Edge Server:**
```bash
ssh -i ssh-key-zion-edge root@100.76.16.108
systemctl stop zion-node.service zion-pool.service
```

#### 5.2 Delete All Data

**Local PC:**
```powershell
rm -f V3/data/zion-node-state.db V3/data/node.pid V3/data/peers.json
```

**Edge Server:**
```bash
rm -f /root/zion-2.9.6-main/data/zion-node-state.db /root/zion-2.9.6-main/data/node.pid /root/zion-2.9.6-main/data/peers.json
```

#### 5.3 Rebuild Binaries

**Local PC:**
```powershell
cargo build --release --manifest-path V3/Cargo.toml -p zion-core --bin node
```

**Edge Server:**
```bash
source /root/.cargo/env
cd /root/zion-2.9.6-main/V3
cargo build --release --manifest-path Cargo.toml -p zion-core --bin node
cargo build --release --manifest-path Cargo.toml -p zion-pool --bin server
cp target/release/node /usr/local/bin/zion-node
cp target/release/server /usr/local/bin/zion-pool-server
```

#### 5.4 Restart Services

**Local PC:**
```powershell
ZION_NODE_ID=local-node ZION_P2P_BIND=0.0.0.0:8333 ZION_RPC_BIND=0.0.0.0:8443 ZION_SEED_PEERS=77.42.71.94:8333 ZION_NODE_STATE_PATH=V3/data/zion-node-state.db ZION_MINER_ADDRESS=NEW_MINER_ADDRESS ZION_HUMANITARIAN_WALLET=NEW_HUMANITARIAN_ADDRESS ZION_ISSOBELLA_WALLET=NEW_ISSOBELLA_ADDRESS ./V3/target/release/node
```

**Edge Server:**
```bash
systemctl daemon-reload
systemctl start zion-node.service zion-pool.service
```

---

### Phase 6: Verification

#### 6.1 Verify Genesis Hash

**Local PC:**
```bash
curl -s -X POST http://127.0.0.1:8443/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":{}}' | python3 -m json.tool
```

Check `tip_hash` matches `NEW_GENESIS_HASH`.

**Edge Server:**
```bash
curl -s -X POST http://127.0.0.1:8443/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":{}}' | python3 -m json.tool
```

#### 6.2 Verify Premine Addresses

```bash
curl -s -X POST http://127.0.0.1:8443/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"getAddressInfo","params":{"address":"NEW_ADDRESS_1"}}' | python3 -m json.tool
```

Check balance matches expected premine amount.

#### 6.3 Verify Bridge Vault UTXOs

```bash
curl -s -X POST http://127.0.0.1:8443/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"getAddressInfo","params":{"address":"NEW_BRIDGE_VAULT_ADDRESS"}}' | python3 -m json.tool
```

Check:
- `utxo_count == 6`
- `balance_flowers == 100000000000000000000` (100M ZION)

#### 6.4 Verify Pool Payout

```bash
curl -s -X POST http://127.0.0.1:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"getPoolInfo","params":{}}' | python3 -m json.tool
```

Check payout address matches new pool wallet.

#### 6.5 Verify Bridge Validators

Check EVM contract on Base chain:

```bash
cast call $BRIDGE_CONTRACT_ADDRESS "validators()(address[])" --rpc-url $BASE_RPC_URL
```

Verify all 5 new validator addresses are present.

---

### Phase 7: Backup and Secure Storage

#### 7.1 Create Encrypted Backup

Create backup script:

```bash
#!/bin/bash
# backup-genesis-keys.sh

# Encrypt premine keys
openssl enc -aes-256-gcm -salt -in PREMINE_KEYS_ENCRYPTED.txt \
  -out PREMINE_KEYS_ENCRYPTED.aes256 \
  -kfile /path/to/passphrase.txt

# Encrypt pool payout key
openssl enc -aes-256-gcm -salt -in POOL_PAYOUT_KEY.txt \
  -out POOL_PAYOUT_KEY.aes256 \
  -kfile /path/to/passphrase.txt

# Encrypt validator keys
openssl enc -aes-256-gcm -salt -in VALIDATOR_KEYS.txt \
  -out VALIDATOR_KEYS.aes256 \
  -kfile /path/to/passphrase.txt
```

#### 7.2 Store on Multiple Media

- **Encrypted USB drive:** Store all `.aes256` files
- **Paper backup:** Print public addresses and seed phrases
- **Metal plate:** Engrave critical seed phrases
- **Hardware wallet:** Load pool payout key into Ledger/Trezor

#### 7.3 Secure Erase Temporary Files

```bash
shred -vfz -n 3 PREMINE_KEYS_ENCRYPTED.txt
shred -vfz -n 3 POOL_PAYOUT_KEY.txt
shred -vfz -n 3 VALIDATOR_KEYS.txt
rm -f PREMINE_KEYS_ENCRYPTED.txt POOL_PAYOUT_KEY.txt VALIDATOR_KEYS.txt
```

---

## Rollback Plan

If anything goes wrong during genesis regeneration:

### 1. Keep Old Genesis Backup

Before starting, backup current state:

```bash
cp V3/L1/core/src/genesis.rs V3/L1/core/src/genesis.rs.backup
cp PREMINE_ADDRESSES_PUBLIC.txt PREMINE_ADDRESSES_PUBLIC.txt.backup
git tag -a OLD_GENESIS_2026-06-03 -m "Old genesis before regeneration"
```

### 2. Restore Procedure

If new genesis fails:

```bash
git checkout OLD_GENESIS_2026-06-03
cp V3/L1/core/src/genesis.rs.backup V3/L1/core/src/genesis.rs
cp PREMINE_ADDRESSES_PUBLIC.txt.backup PREMINE_ADDRESSES_PUBLIC.txt
# Rebuild and restart nodes
```

### 3. Emergency Rollback

If nodes are already running with new genesis and need rollback:

1. Stop all nodes
2. Delete all data directories
3. Restore old genesis files
4. Rebuild binaries
5. Restart nodes

---

## Dashboard Integration (NEW)

The Genesis Regeneration Runbook is now integrated into the Flask dashboard for easier management and monitoring.

### Dashboard Features

**Location:** Dashboard tab "Launch Day" → "🔐 Genesis Regeneration Runbook"

**API Endpoint:** `/api/genesis-regeneration` with actions:
- `status` — Check current regeneration status
- `phase1` through `phase7` — Execute individual phases
- `rollback` — View rollback plan

**Genesis Backup/Restore Integration**

**Location:** Dashboard tab "Launch Day" → "💾 Genesis Backup/Restore"

**API Endpoint:** `/api/genesis-backup` with actions:
- `list` — List all available encrypted backups
- `create` — Create new encrypted backup with 3-copy redundancy
- `restore` — Restore files from encrypted backup
- `delete` — Delete backup (temporarily disabled due to technical issue)

**Features:**
- **Encryption:** 256-bit AES with HMAC verification
- **Multi-redundancy:** 3 copies per backup (original + 2 redundant copies)
- **Backup Location:** `backups/genesis-backup/` in repository root
- **Supported Files:**
  - Encrypted wallet keys (PREMINE_KEYS_ENCRYPTED_2026-06-03.txt, POOL_PAYOUT_KEY_ENCRYPTED_2026-06-03.txt, BRIDGE_VALIDATOR_KEYS_ENCRYPTED_2026-06-03.txt)
  - Genesis configuration (genesis.rs, fee.rs, crypto.rs)
  - Public addresses (PREMINE_ADDRESSES_PUBLIC.txt)
  - Documentation (AGENTS.md)

**Usage:**
1. Open dashboard at `http://127.0.0.1:8766`
2. Navigate to "Launch Day" tab
3. Use Genesis Regeneration Runbook panel for phase execution
4. Use Genesis Backup/Restore panel for backup management
5. Automatic 3-copy redundancy for data safety

### Dashboard Status Monitoring

The dashboard provides real-time monitoring of:
- Current genesis hash
- Backup status
- Phase completion status
- System health indicators

### Integration Benefits

- **Centralized Management:** All genesis operations in one interface
- **Real-time Feedback:** Immediate status updates during phase execution
- **Automated Backups:** Encrypted backups with multi-redundancy
- **Easy Recovery:** One-click restore from encrypted backups
- **Audit Trail:** Complete log of all operations

---

## Documentation Updates Checklist

- [ ] `PREMINE_ADDRESSES_PUBLIC.txt` — new addresses
- [ ] `V3/docs/mainnet/PREMINE_AND_CANONICAL_WALLETS_PUBLIC.txt` — new canonical addresses
- [ ] `AGENTS.md` — new genesis hash, regeneration notes, backup/restore integration
- [ ] `README.md` — updated premine table
- [ ] `V3/docs/ZION_V3_Whitepaper.md` — new genesis references
- [ ] `V3/docs/ZION_Mainnet_Whitepaper_v3.0_Canonical.md` — new genesis references
- [ ] `V3/docs/ERICKA_MAINNET_GUIDE.md` — new addresses
- [ ] `V3/docs/MAINNET_CONSTANTS.md` — new addresses
- [ ] `V3/docs/OPERATIONAL_SERVERS.md` — new addresses
- [ ] `V3/docs/audits/2026-04-V3_INTERNAL_AUDIT.md` — note about regeneration
- [ ] `StatusV3.md` — regeneration status
- [ ] `V3/L1/core/src/genesis.rs` — new addresses in code
- [ ] `V3/L1/core/src/fee.rs` — new bridge vault address
- [ ] `V3/L2/bridge/contracts/BridgeValidator.sol` — new validator addresses
- [ ] `dashboard/app.py` — Genesis Backup/Restore API integration
- [ ] `dashboard/dashboard.html` — Genesis Backup/Restore UI panel
- [ ] `dashboard/dashboard.js` — Genesis Backup/Restore JavaScript functions

---

## Final Checklist

Before declaring genesis regeneration complete:

- [ ] All 14 premine wallets generated offline
- [ ] All private keys encrypted and backed up
- [ ] Pool payout wallet generated and configured
- [ ] Bridge validator keys generated and deployed
- [ ] Canonical subsidy labels updated
- [ ] Genesis block rebuilt with new addresses
- [ ] New genesis hash recorded
- [ ] All documentation updated
- [ ] All nodes hard-reset with new genesis
- [ ] All nodes verified to have correct genesis hash
- [ ] Bridge vault verified to have 6 UTXO outputs
- [ ] Pool payout verified to use new wallet
- [ ] Bridge validators verified on EVM chain
- [ ] Old keys securely erased
- [ ] Backup stored on multiple media
- [ ] Rollback plan tested

---

## Post-Regeneration Testing

### 1. Block Production Test

Let network produce 10 blocks and verify:
- All nodes sync correctly
- Block rewards go to correct addresses
- Fee splits work correctly

### 2. Transaction Test

Send test transactions:
- Account-model transfer
- UTXO transfer
- Bridge lock transaction
- Bridge unlock transaction

### 3. Pool Test

Connect miner to pool and verify:
- Share validation works
- Payout goes to new pool wallet
- PPLNS window operates correctly

### 4. Bridge Test

Test bridge operations:
- Lock ZION → mint wZION
- Burn wZION → unlock ZION
- Validator signature verification

---

## Contact and Support

For issues during genesis regeneration:

- **Yose (Creator):** Direct contact
- **DAO Governance:** Submit proposal for emergency rollback
- **Security Team:** Report key compromise immediately

---

## Incident Log — Humanitarian Wallet Fix (2026-06-07)

### Root Cause

During genesis regeneration on **2026-06-03**, `MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET`
was mistakenly set to the same address as premine slot 12 (`zion165a527w5d0n085t775x3w8n8q20742a6w7xr0z3`).
This address had **no mnemonic seed backup** in any accessible location — only the secret key was
referenced in genesis.rs, but that address was absent from both `PREMINE_KEYS_ENCRYPTED_2026-06-03.txt`
and the flash disk wallet backup (`F:\ZION_V3_MAINNET_WALLETS.txt`).

### Discovery

Noticed on 2026-06-07 that flash disk contained a correct humanitarian subsidy wallet
(`zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4`) with mnemonic, but the genesis.rs constant
pointed to an unrecoverable address.

### Fix Applied (2026-06-07)

| Component | Old Value | New Value |
|-----------|-----------|-----------|
| `MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET` | `zion165a527w5d0n085t775x3w8n8q20742a6w7xr0z3` (no backup) | `zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4` (mnemonic on flash disk) |
| Premine slot 12 address | `zion165a527w5d0n085t775x3w8n8q20742a6w7xr0z3` (no backup) | `zion1c245e7f5d8h427r4p4s2s607d7v4c255z7x96t3` (SK backup in secrets/) |
| Genesis hash | `1da0251076471744b783105a6723fbd2e899282d6582d59f0de7905cd69f07c7` | `d28dc404abfd4e22b313d3a7e8b680453328a77ace68b47466a14d18aff6df5d` |

**Key architectural clarification discovered:**
- `MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET` = ongoing 5% block subsidy fee recipient (per-block)
- Premine slot 12 = one-time genesis 1.44B ZION allocation

These MUST be **different addresses** (enforced by `canonical_subsidy_wallets_are_distinct_and_not_duplicate_premine_slots` test).

### Steps Executed

1. Generated new Ed25519 keypair for premine slot 12 (SK stored in `secrets/PREMINE_KEYS_ENCRYPTED_2026-06-03.txt`)
2. Restored correct subsidy wallet from flash disk backup
3. Updated `V3/L1/core/src/genesis.rs` — both premine slot 12 and CANONICAL constant
4. Updated all 38 files referencing old humanitarian address (scripts, configs, docs)
5. Updated genesis hash in all documentation (38 → 0 occurrences of old address)
6. Updated flash disk backup (`F:\ZION_V3_MAINNET_WALLETS.json/txt/zip`)
7. Verified: 485 tests passed, 0 failed
8. New genesis hash: `d28dc404abfd4e22b313d3a7e8b680453328a77ace68b47466a14d18aff6df5d`

### Prevention

- Always verify that premine slot addresses and canonical subsidy wallets are **distinct** keypairs
- The test `canonical_subsidy_wallets_are_distinct_and_not_duplicate_premine_slots` enforces this at compile time
- Flash disk backup must be updated **immediately** after any genesis change

---

**END OF RUNBOOK**
