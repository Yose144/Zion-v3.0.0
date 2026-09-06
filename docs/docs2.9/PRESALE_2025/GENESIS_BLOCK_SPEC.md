# 🔧 ZION GENESIS BLOCK - TECHNICAL SPECIFICATION

**Document:** Genesis Block Implementation for 500M Presale Allocation  
**Version:** 1.0  
**Date:** 2. prosince 2025  
**Target Mainnet Launch:** Q2 2026

---

## 📋 OVERVIEW

Tento dokument definuje technickou implementaci presale alokace 500M ZION tokenů v genesis bloku ZION blockchainu.

### Genesis Block Purpose

1. **Initialize blockchain** s prvním blokem (height 0)
2. **Distribute premine** (15.78B ZION original + 500M presale)
3. **Set network parameters** (difficulty, timestamp, etc.)
4. **Create presale escrow** pro QR wallet redemption system

---

## 🎯 SUPPLY BREAKDOWN

### Original Premine Plan (v2.8.5)

```
TOTAL SUPPLY: 144,000,000,000 ZION

Original Premine: 15,780,000,000 ZION (10.96%)
├─ Mining Operators:  8,250,000,000 ZION (52.3%)
├─ DAO Winners:       1,750,000,000 ZION (11.1%)
├─ ZION OASIS Fund:   1,440,000,000 ZION (9.1%)
└─ Infrastructure:    4,340,000,000 ZION (27.5%)

Mining Supply: 128,220,000,000 ZION (89.04%)
```

### Updated Genesis Block (with Presale)

```
TOTAL SUPPLY: 144,000,000,000 ZION (unchanged)

UPDATED PREMINE: 16,780,000,000 ZION (11.65%)
├─ Original Premine:  15,780,000,000 ZION (96.93% of premine)
│   ├─ Mining Operators:  8,250,000,000 ZION
│   ├─ DAO Winners:       1,750,000,000 ZION
│   ├─ ZION OASIS Fund:   1,440,000,000 ZION
│   └─ Infrastructure:    4,340,000,000 ZION
│
└─ PRESALE ALLOCATION:    500,000,000 ZION (3.07% of premine)
    └─ Escrow Contract:   500,000,000 ZION (locked until redemption)

MINING SUPPLY: 127,220,000,000 ZION (88.35%)
```

**Key Changes:**
- ✅ Total supply unchanged: 144B ZION
- ✅ Premine increased: 15.78B → 16.28B (+500M)
- ✅ Mining supply decreased: 128.22B → 127.72B (-500M)
- ✅ Percentage shift: 10.96% → 11.31% premine (+0.35%)

---

## 🏗️ GENESIS BLOCK STRUCTURE

### Block Header

```json
{
  "version": 1,
  "block_height": 0,
  "previous_block_hash": "0000000000000000000000000000000000000000000000000000000000000000",
  "merkle_root": "<calculated_from_transactions>",
  "timestamp": 1717200000,  // 2026-06-01 00:00:00 UTC (estimate)
  "bits": 486604799,  // Initial difficulty target (low for first blocks)
  "nonce": 2083236893,  // Will be determined during mining
  "algorithm": "COSMIC_HARMONY",  // Primary genesis algo
  
  "chain_id": "ZION-MAINNET-v1",
  "network_magic": "0xD9B4BEF9",  // Unique identifier for ZION network
  
  "genesis_message": "The Times 01/Jun/2026 - ZION: Consciousness-Based Blockchain Launches"
}
```

### Genesis Transactions (Coinbase)

**Transaction 0: Original Premine (15.78B ZION)**

```json
{
  "txid": "genesis_tx_0_premine_original",
  "version": 1,
  "locktime": 0,
  "vin": [
    {
      "coinbase": "Genesis Block - ZION Mainnet Launch - Omnity.One s.r.o.",
      "sequence": 4294967295
    }
  ],
  "vout": [
    {
      "value": 8250000000000000,  // 8.25B ZION × 1e6 (atomic units)
      "n": 0,
      "scriptPubKey": {
        "type": "pubkeyhash",
        "address": "ZMiningOperators1...",
        "asm": "OP_DUP OP_HASH160 <pubkeyhash> OP_EQUALVERIFY OP_CHECKSIG"
      },
      "label": "MINING_OPERATORS"
    },
    {
      "value": 1750000000000000,  // 1.75B ZION × 1e6
      "n": 1,
      "scriptPubKey": {
        "type": "pubkeyhash",
        "address": "ZDAOWinners1...",
        "asm": "OP_DUP OP_HASH160 <pubkeyhash> OP_EQUALVERIFY OP_CHECKSIG"
      },
      "label": "DAO_WINNERS"
    },
    {
      "value": 1440000000000000,  // 1.44B ZION × 1e6
      "n": 2,
      "scriptPubKey": {
        "type": "pubkeyhash",
        "address": "ZOASISFund1...",
        "asm": "OP_DUP OP_HASH160 <pubkeyhash> OP_EQUALVERIFY OP_CHECKSIG"
      },
      "label": "ZION_OASIS_FUND"
    },
    {
      "value": 4340000000000000,  // 4.34B ZION × 1e6
      "n": 3,
      "scriptPubKey": {
        "type": "pubkeyhash",
        "address": "ZInfrastructure1...",
        "asm": "OP_DUP OP_HASH160 <pubkeyhash> OP_EQUALVERIFY OP_CHECKSIG"
      },
      "label": "INFRASTRUCTURE"
    }
  ]
}
```

**Transaction 1: Presale Allocation (500M ZION)**

```json
{
  "txid": "genesis_tx_1_presale_escrow",
  "version": 1,
  "locktime": 0,
  "vin": [
    {
      "coinbase": "Presale Escrow - 500M ZION - Omnity.One s.r.o. (IČO: 19828748)",
      "sequence": 4294967295
    }
  ],
  "vout": [
    {
      "value": 500000000000000,  // 500M ZION × 1e6 (atomic units)
      "n": 0,
      "scriptPubKey": {
        "type": "multisig",
        "reqSigs": 3,
        "addresses": [
          "ZPresaleEscrow1...",  // Key 1: CEO
          "ZPresaleEscrow2...",  // Key 2: CTO
          "ZPresaleEscrow3...",  // Key 3: CFO
          "ZPresaleEscrow4...",  // Key 4: External Custodian
          "ZPresaleEscrow5..."   // Key 5: Smart Contract Controller
        ],
        "asm": "3 <pubkey1> <pubkey2> <pubkey3> <pubkey4> <pubkey5> 5 OP_CHECKMULTISIG"
      },
      "label": "PRESALE_ESCROW_MULTISIG",
      "metadata": {
        "contract_version": "1.0",
        "escrow_type": "QR_WALLET_REDEMPTION",
        "total_allocation": 500000000,
        "presale_phases": 3,
        "avg_purchase_price_eur": 0.010,
        "total_raised_eur": 5000000,
        "legal_entity": "Omnity.One s.r.o.",
        "ico": "19828748",
        "jurisdiction": "Czech Republic (EU)",
        "compliance": ["MiCA", "AML", "GDPR"],
        "redemption_start": 1717200000,  // Mainnet launch timestamp
        "redemption_deadline": 1748736000  // +1 year (June 2027)
      }
    }
  ]
}
```

**Merkle Tree:**
```
merkle_root = SHA256(SHA256(tx0) + SHA256(tx1))
          = <64_character_hex_hash>
```

---

## 🔐 PRESALE ESCROW - SMART CONTRACT

### Multi-Sig Configuration

**Type:** 3-of-5 Multi-Signature Wallet  
**Purpose:** Secure storage of 500M presale tokens before redemption

**Signatories:**

| Role | Responsibility | Key Type |
|------|---------------|----------|
| **CEO** | Strategic approval | Hardware wallet (Ledger) |
| **CTO** | Technical verification | Hardware wallet (Trezor) |
| **CFO** | Financial authorization | Hardware wallet (Ledger) |
| **External Custodian** | Independent oversight | Professional custody (e.g., BitGo) |
| **Smart Contract** | Automated redemption logic | On-chain contract address |

**Signing Requirements:**
- Normal redemption (QR claim): 1 signature (Smart Contract auto-signs)
- Emergency withdrawal: 3 signatures (any 3 of 5)
- Parameter change: 4 signatures (super-majority)
- Contract upgrade: 5 signatures (unanimous)

### QR Redemption Logic (Pseudocode)

```python
class PresaleEscrow:
    def __init__(self):
        self.total_allocation = 500_000_000 * 1e6  # 500M ZION in atomic units
        self.redeemed = 0
        self.qr_database = {}  # qr_hash → (amount, status, user_email)
        self.multisig_address = "ZPresaleEscrow1..."
        self.redemption_deadline = 1748736000  # June 2027
    
    def register_qr_code(self, qr_id: str, amount: int, user_email: str):
        """
        Called during presale when user purchases tokens.
        Stores QR code allocation off-chain (database) and on-chain (merkle proof).
        """
        qr_hash = sha256(qr_id + user_email + str(amount))
        
        self.qr_database[qr_hash] = {
            "amount": amount,
            "status": "PENDING",
            "user_email": user_email,
            "created_at": current_timestamp(),
            "redeemed_at": None,
            "destination_address": None
        }
        
        # Emit event for on-chain record
        emit QRRegistered(qr_hash, amount, user_email_hash)
    
    def redeem_qr_code(self, qr_id: str, signature: bytes, destination_address: str):
        """
        User scans QR code in wallet, provides destination address.
        Contract verifies signature, transfers tokens.
        """
        # 1. Verify QR code exists and not already redeemed
        qr_hash = sha256(qr_id + ...)
        if qr_hash not in self.qr_database:
            raise Exception("Invalid QR code")
        
        qr_data = self.qr_database[qr_hash]
        if qr_data["status"] == "REDEEMED":
            raise Exception("QR code already redeemed")
        
        # 2. Verify signature (prevents unauthorized claims)
        if not verify_signature(qr_hash, signature, OMNITY_PUBLIC_KEY):
            raise Exception("Invalid signature")
        
        # 3. Verify deadline
        if current_timestamp() > self.redemption_deadline:
            raise Exception("Redemption period expired")
        
        # 4. Verify destination address format
        if not is_valid_zion_address(destination_address):
            raise Exception("Invalid destination address")
        
        # 5. Transfer tokens from escrow to user
        amount = qr_data["amount"]
        transfer_zion(
            from_address=self.multisig_address,
            to_address=destination_address,
            amount=amount
        )
        
        # 6. Update database
        qr_data["status"] = "REDEEMED"
        qr_data["redeemed_at"] = current_timestamp()
        qr_data["destination_address"] = destination_address
        self.redeemed += amount
        
        # 7. Emit event
        emit QRRedeemed(qr_hash, destination_address, amount)
        
        return {
            "success": True,
            "txid": last_transaction_id(),
            "amount": amount / 1e6,  # Convert to human-readable
            "message": f"Successfully claimed {amount/1e6} ZION"
        }
    
    def get_unredeemed_balance(self) -> int:
        """Returns amount of tokens still in escrow (not yet claimed)."""
        return self.total_allocation - self.redeemed
    
    def emergency_withdraw(self, destination: str, signers: list):
        """
        Emergency function: return unredeemed tokens to company wallet after deadline.
        Requires 3-of-5 multisig approval.
        """
        if current_timestamp() < self.redemption_deadline:
            raise Exception("Can only withdraw after redemption deadline")
        
        if len(signers) < 3:
            raise Exception("Requires 3 signatures")
        
        unredeemed = self.get_unredeemed_balance()
        transfer_zion(
            from_address=self.multisig_address,
            to_address=destination,
            amount=unredeemed
        )
        
        emit EmergencyWithdraw(destination, unredeemed)
```

### On-Chain QR Verification (Merkle Proof)

**Problem:** Storing 2,500+ QR codes on-chain is expensive.  
**Solution:** Store only Merkle root, verify individual QR codes with Merkle proofs.

```python
class MerkleQRRegistry:
    def __init__(self):
        self.merkle_root = None  # Updated monthly with new QR codes
    
    def update_merkle_root(self, qr_codes: list):
        """
        Called by Omnity.One after each presale phase.
        Computes Merkle tree of all QR codes, stores root on-chain.
        """
        leaves = [sha256(qr) for qr in qr_codes]
        self.merkle_root = build_merkle_tree(leaves)
        
        emit MerkleRootUpdated(self.merkle_root, len(qr_codes))
    
    def verify_qr_code(self, qr_hash: str, merkle_proof: list) -> bool:
        """
        User provides QR hash + Merkle proof (siblings up the tree).
        Contract verifies QR hash is in Merkle tree.
        """
        return verify_merkle_proof(qr_hash, merkle_proof, self.merkle_root)
```

**Example Merkle Tree:**
```
                merkle_root
               /            \
           H(AB)            H(CD)
          /    \           /    \
       H(A)   H(B)      H(C)   H(D)
        |      |         |      |
      QR1    QR2       QR3    QR4

Proof for QR1:
- QR1 hash
- H(B) (sibling)
- H(CD) (uncle)
→ Reconstruct H(AB) → H(ABCD) → Compare to merkle_root ✅
```

---

## 💾 DATABASE SCHEMA (Off-Chain)

### Presale Orders Table

```sql
CREATE TABLE presale_orders (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID UNIQUE NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    
    -- KYC data
    kyc_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
    kyc_provider VARCHAR(50),  -- 'sumsub', 'onfido', etc.
    kyc_reference VARCHAR(255),  -- External KYC ID
    kyc_verified_at TIMESTAMP,
    
    -- Purchase details
    zion_amount BIGINT NOT NULL,  -- In atomic units (1e6)
    eur_paid DECIMAL(12,2) NOT NULL,
    payment_method ENUM('card', 'bank_transfer', 'crypto'),
    payment_reference VARCHAR(255),
    payment_status ENUM('pending', 'completed', 'failed', 'refunded'),
    
    -- Presale phase
    presale_phase INT NOT NULL,  -- 1, 2, or 3
    purchase_price_eur DECIMAL(10,6) NOT NULL,  -- e.g., 0.008000
    bonus_percentage INT DEFAULT 0,  -- e.g., 50 (for +50% bonus)
    
    -- QR code
    qr_code_id UUID UNIQUE,
    qr_code_hash VARCHAR(64),  -- SHA256 hash for on-chain verification
    qr_code_generated_at TIMESTAMP,
    qr_code_sent_at TIMESTAMP,
    
    -- Redemption
    redeemed_status ENUM('pending', 'redeemed', 'expired') DEFAULT 'pending',
    redeemed_at TIMESTAMP,
    redemption_txid VARCHAR(64),
    destination_address VARCHAR(64),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    referral_code VARCHAR(50),
    
    -- Compliance
    aml_flagged BOOLEAN DEFAULT FALSE,
    aml_notes TEXT,
    
    CONSTRAINT positive_amount CHECK (zion_amount > 0),
    CONSTRAINT positive_payment CHECK (eur_paid > 0)
);

CREATE INDEX idx_user_email ON presale_orders(user_email);
CREATE INDEX idx_order_id ON presale_orders(order_id);
CREATE INDEX idx_qr_code_id ON presale_orders(qr_code_id);
CREATE INDEX idx_qr_code_hash ON presale_orders(qr_code_hash);
CREATE INDEX idx_kyc_status ON presale_orders(kyc_status);
CREATE INDEX idx_redemption_status ON presale_orders(redeemed_status);
```

### QR Codes Table (Separate for Security)

```sql
CREATE TABLE qr_codes (
    id BIGSERIAL PRIMARY KEY,
    qr_code_id UUID UNIQUE NOT NULL,
    order_id UUID NOT NULL REFERENCES presale_orders(order_id),
    
    -- QR data (encrypted)
    qr_image_url VARCHAR(512),  -- S3/CDN link to QR image
    qr_raw_data TEXT,  -- Encrypted JSON payload
    qr_signature VARCHAR(256),  -- HMAC signature
    
    -- Redemption code (one-time use)
    redemption_code VARCHAR(64) UNIQUE,  -- Random 32-byte hex
    redemption_code_used BOOLEAN DEFAULT FALSE,
    
    -- Expiry
    expires_at TIMESTAMP NOT NULL,  -- 1 year after mainnet launch
    
    -- Security
    access_count INT DEFAULT 0,  -- How many times QR was viewed
    last_accessed_at TIMESTAMP,
    last_accessed_ip INET,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT expires_after_creation CHECK (expires_at > created_at)
);

CREATE INDEX idx_qr_code_id ON qr_codes(qr_code_id);
CREATE INDEX idx_redemption_code ON qr_codes(redemption_code);
CREATE INDEX idx_order_id ON qr_codes(order_id);
```

### Redemption Logs Table

```sql
CREATE TABLE redemption_logs (
    id BIGSERIAL PRIMARY KEY,
    qr_code_id UUID NOT NULL REFERENCES qr_codes(qr_code_id),
    order_id UUID NOT NULL REFERENCES presale_orders(order_id),
    
    -- Redemption attempt
    attempted_at TIMESTAMP DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    error_message TEXT,
    
    -- Blockchain data
    destination_address VARCHAR(64),
    txid VARCHAR(64),
    block_height INT,
    confirmations INT DEFAULT 0,
    
    -- User info (at time of redemption)
    ip_address INET,
    user_agent TEXT,
    wallet_version VARCHAR(50),
    
    CONSTRAINT positive_confirmations CHECK (confirmations >= 0)
);

CREATE INDEX idx_qr_code_id ON redemption_logs(qr_code_id);
CREATE INDEX idx_destination_address ON redemption_logs(destination_address);
CREATE INDEX idx_txid ON redemption_logs(txid);
```

---

## 🔍 GENESIS BLOCK VALIDATION

### Pre-Launch Checklist

**1. Supply Validation:**
```python
def validate_genesis_supply():
    total_supply = 144_000_000_000
    
    premine_original = 15_780_000_000
    premine_presale = 500_000_000
    premine_total = premine_original + premine_presale
    
    mining_supply = total_supply - premine_total
    
    assert premine_total == 16_780_000_000, "Premine mismatch"
    assert mining_supply == 127_220_000_000, "Mining supply mismatch"
    assert premine_total + mining_supply == total_supply, "Total supply mismatch"
    
    print("✅ Genesis supply validated")
```

**2. Transaction Validation:**
```python
def validate_genesis_transactions():
    tx0_outputs = [
        ("MINING_OPERATORS", 8_250_000_000),
        ("DAO_WINNERS", 1_750_000_000),
        ("ZION_OASIS_FUND", 1_440_000_000),
        ("INFRASTRUCTURE", 4_340_000_000)
    ]
    
    tx1_outputs = [
        ("PRESALE_ESCROW", 500_000_000)
    ]
    
    tx0_total = sum(amount for _, amount in tx0_outputs)
    tx1_total = sum(amount for _, amount in tx1_outputs)
    
    assert tx0_total == 15_780_000_000, "TX0 total mismatch"
    assert tx1_total == 500_000_000, "TX1 total mismatch"
    
    print("✅ Genesis transactions validated")
```

**3. Multi-Sig Validation:**
```python
def validate_multisig_setup():
    required_sigs = 3
    total_keys = 5
    
    escrow_address = generate_multisig_address(
        public_keys=[ceo_pubkey, cto_pubkey, cfo_pubkey, custodian_pubkey, contract_pubkey],
        required_sigs=required_sigs
    )
    
    # Test signing
    test_tx = create_test_transaction()
    signed_tx = sign_multisig_transaction(test_tx, [ceo_key, cto_key, cfo_key])
    
    assert verify_multisig_transaction(signed_tx, escrow_address), "Multisig verification failed"
    
    print("✅ Multi-sig setup validated")
```

**4. Merkle Root Validation:**
```python
def validate_merkle_root():
    tx0 = serialize_transaction(genesis_tx_0)
    tx1 = serialize_transaction(genesis_tx_1)
    
    tx0_hash = sha256(sha256(tx0))
    tx1_hash = sha256(sha256(tx1))
    
    merkle_root = sha256(sha256(tx0_hash + tx1_hash))
    
    assert merkle_root == genesis_block.merkle_root, "Merkle root mismatch"
    
    print("✅ Merkle root validated")
```

---

## 🚀 DEPLOYMENT PROCEDURE

### Step 1: Pre-Genesis Preparation (Week -4 to -1)

**Development:**
- [ ] Finalize genesis block code (src/core/genesis.py)
- [ ] Implement presale escrow contract (src/contracts/presale_escrow.sol)
- [ ] Test on testnet (ZION Testnet v3)
- [ ] Security audit (CertiK, OpenZeppelin)

**Infrastructure:**
- [ ] Generate multisig addresses (3-of-5 setup)
- [ ] Distribute hardware wallets to signatories
- [ ] Set up escrow monitoring dashboard
- [ ] Deploy database schema (PostgreSQL)

**Data Migration:**
- [ ] Export presale orders from database
- [ ] Generate all QR codes (with signatures)
- [ ] Compute Merkle root of QR codes
- [ ] Verify all QR codes against Merkle root

### Step 2: Genesis Block Mining (Day 0, Hour 0)

**Time:** 2026-06-01 00:00:00 UTC

**Process:**
1. **Initialize blockchain:**
   ```bash
   ./ziond --genesis
   ```
2. **Create genesis block:**
   ```python
   genesis_block = create_genesis_block(
       timestamp=1717200000,
       premine_outputs=premine_outputs,
       presale_escrow=presale_escrow_output
   )
   ```
3. **Mine genesis block:**
   ```python
   nonce = 0
   while True:
       genesis_block.nonce = nonce
       block_hash = sha256(genesis_block.header)
       if block_hash < target_difficulty:
           break
       nonce += 1
   ```
4. **Broadcast genesis block:**
   ```python
   broadcast_block(genesis_block)
   ```

### Step 3: Post-Genesis Validation (Day 0, Hour 1-24)

**Immediate Checks:**
- [ ] Genesis block accepted by all nodes
- [ ] Premine outputs spendable (test transactions)
- [ ] Presale escrow locked (requires multisig)
- [ ] Block explorer shows correct balances

**24-Hour Monitoring:**
- [ ] No chain reorganizations
- [ ] Mining starts on block 1 (60s after genesis)
- [ ] Network hashrate stable
- [ ] Peer-to-peer connections healthy

### Step 4: Presale Redemption Activation (Day 1)

**Enable QR Redemption:**
```python
# Activate redemption smart contract
presale_escrow.set_redemption_active(True)

# Announce to community
send_announcement(
    title="Presale Token Redemption Now Live!",
    message="All presale participants can now redeem their QR codes in the ZION wallet."
)
```

**First Redemptions:**
- [ ] Test with internal team wallets (5-10 test redemptions)
- [ ] Monitor for errors or edge cases
- [ ] Verify tokens arrive at destination addresses
- [ ] Check block confirmations (6 confirmations = final)

---

## 📊 MONITORING & ANALYTICS

### Real-Time Dashboards

**1. Presale Escrow Dashboard:**
```
┌─────────────────────────────────────────────┐
│ PRESALE ESCROW STATUS                       │
├─────────────────────────────────────────────┤
│ Total Allocation:     500,000,000 ZION     │
│ Redeemed:             125,000,000 ZION     │
│ Pending:              375,000,000 ZION     │
│ Redemption Rate:      25.0%                │
│                                             │
│ Total QR Codes:       2,500                │
│ Redeemed Codes:       625                  │
│ Expired Codes:        0                    │
│                                             │
│ Escrow Balance:       375,000,000 ZION     │
│ Last Redemption:      2 minutes ago        │
└─────────────────────────────────────────────┘
```

**2. Redemption Activity (Live Feed):**
```
[12:34:56] QR_ABC123 redeemed → ZDestinationAddr... | 50,000 ZION | Txid: abc...
[12:33:21] QR_XYZ789 redeemed → ZAnotherAddr... | 18,750 ZION | Txid: xyz...
[12:31:45] QR_DEF456 redeemed → ZUserWallet... | 81,250 ZION | Txid: def...
```

**3. Blockchain Metrics:**
```
Block Height:          12,345
Difficulty:            1,234,567
Hashrate:              123 GH/s
Presale Escrow TX:     625 (lifetime)
Total Premine Spent:   2.5% (of 16.78B)
Mining Rewards Issued: 67,890,000 ZION (blocks 1-12,345)
```

### Alerts & Notifications

**Critical Alerts (Immediate Response):**
- 🚨 Unauthorized multisig transaction attempt
- 🚨 Smart contract vulnerability detected
- 🚨 Presale escrow balance mismatch
- 🚨 QR signature verification failures (>5% rate)

**Warning Alerts (Monitor):**
- ⚠️ Redemption rate <10% after 30 days
- ⚠️ Unredeemed balance >80% after 6 months
- ⚠️ Unusual redemption patterns (clustering, automation)

**Info Alerts (Logging):**
- ℹ️ Milestone reached (100k, 250k, 500k ZION redeemed)
- ℹ️ Large redemption (>1M ZION in single transaction)
- ℹ️ Redemption deadline approaching (90 days before expiry)

---

## 🔧 MAINTENANCE & UPGRADES

### Smart Contract Upgrades

**Upgrade Mechanism:**
- Proxy pattern (separate logic from storage)
- Multisig approval required (4-of-5 signatures)
- 7-day timelock (announcement period before activation)

**Upgrade Scenarios:**
1. **Bug fix:** Critical vulnerability → Emergency upgrade (3-of-5, no timelock)
2. **Feature addition:** New redemption methods → Standard upgrade (4-of-5, 7-day timelock)
3. **Parameter change:** Extend deadline → Minor upgrade (3-of-5, 3-day timelock)

### Post-Redemption Cleanup (After Deadline)

**1 Year After Mainnet (June 2027):**

```python
def cleanup_unredeemed_tokens():
    """
    After 1-year redemption period, return unredeemed tokens to Omnity.One treasury.
    """
    unredeemed = presale_escrow.get_unredeemed_balance()
    
    if unredeemed > 0:
        # Requires 3-of-5 multisig approval
        tx = create_withdrawal_transaction(
            from_address=presale_escrow_address,
            to_address=omnity_treasury_address,
            amount=unredeemed
        )
        
        # Sign with 3 keys
        signed_tx = multisig_sign(tx, [ceo_key, cto_key, cfo_key])
        
        # Broadcast
        broadcast_transaction(signed_tx)
        
        # Announce to community
        send_announcement(
            title="Presale Redemption Period Ended",
            message=f"{unredeemed} unredeemed ZION returned to treasury. "
                    f"These will be used for liquidity provision and ecosystem development."
        )
```

**Treasury Allocation (Unredeemed Tokens):**
- 50%: DEX liquidity (Uniswap, PancakeSwap)
- 30%: Ecosystem grants (developers, projects)
- 20%: Reserve (future strategic use)

---

## 📝 DOCUMENTATION & TRANSPARENCY

### Public Documentation

**1. Genesis Block Report (Published at Launch):**
```markdown
# ZION Mainnet Genesis Block Report

**Launch Date:** June 1, 2026, 00:00 UTC
**Block Hash:** 0x1234567890abcdef...
**Genesis Supply:** 16,780,000,000 ZION (11.65% premine)

## Presale Allocation
- Total: 500,000,000 ZION
- Escrow Address: ZPresaleEscrow1...
- Multisig: 3-of-5 (CEO, CTO, CFO, Custodian, Contract)
- Redemption Period: 1 year (June 2027)

## Verification
- Block Explorer: https://explorer.zionterranova.com/block/0
- Genesis Transaction: https://explorer.zionterranova.com/tx/genesis_tx_1_presale_escrow
- Multisig Contract: https://github.com/Yose144/Zion-2.9/blob/main/src/contracts/presale_escrow.sol
```

**2. Monthly Redemption Reports:**
```markdown
# Month 1 Redemption Report (June 2026)

- Redeemed: 75,000,000 ZION (15%)
- Unique Wallets: 312
- Average Redemption: 240,385 ZION
- Largest Redemption: 1,250,000 ZION (Whale Pack)
- Redemption Rate: 12.5% (625 of 2,500 QR codes)

[Charts: Daily redemption volume, cumulative progress]
```

**3. On-Chain Proof:**
- All presale transactions verifiable on blockchain
- QR Merkle root published (commit-reveal scheme)
- Multisig transaction history public
- Escrow balance checkable anytime

---

## 🎯 SUCCESS CRITERIA

### Technical Milestones

- [x] Genesis block mined successfully
- [ ] 99.9% uptime (first 30 days)
- [ ] Zero critical bugs (no loss of funds)
- [ ] 100% presale allocation in escrow (verified)
- [ ] <1% failed redemptions (due to user error only)

### Redemption Targets

**30 Days:** 25% redeemed (125M ZION)  
**90 Days:** 50% redeemed (250M ZION)  
**180 Days:** 75% redeemed (375M ZION)  
**365 Days:** 95% redeemed (475M ZION)

**If <80% redeemed after 6 months:**
- Email reminders to all unredeemed QR holders
- Community outreach (Discord, Twitter)
- Extended tutorial videos
- Consider deadline extension (requires community vote)

---

## 🔗 INTEGRATION WITH ECOSYSTEM

### Wallet Support

**Desktop Wallet (ZION Core):**
- QR code scanning (camera or file upload)
- Redemption wizard (step-by-step)
- Transaction history (redemptions)

**Mobile Wallet (ZION Mobile):**
- Native camera QR scanning
- Push notifications (redemption success)
- Touch ID / Face ID security

**Hardware Wallet:**
- Ledger: ZION app (redemption signing)
- Trezor: ZION firmware support

### Block Explorer

**Features:**
- Genesis block special page (detailed breakdown)
- Presale escrow address tracking (live balance)
- QR redemption transaction tagging
- Statistics dashboard (total redeemed, rate)

**URL Structure:**
```
https://explorer.zionterranova.com/
├─ /block/0                      (genesis block)
├─ /address/ZPresaleEscrow1...   (escrow balance)
├─ /tx/genesis_tx_1_presale...   (presale allocation TX)
└─ /stats/presale-redemption     (live stats)
```

---

## 📞 SUPPORT & CONTACT

**Technical Issues:**
- GitHub: https://github.com/Yose144/Zion-2.9/issues
- Email: support@zionterranova.com
- Discord: #presale-support channel

**Redemption Help:**
- Tutorial: https://docs.zionterranova.com/presale-redemption
- Video Guide: https://youtube.com/@zionterranova
- Live Chat: Discord support (9am-5pm CET)

**Security Reports:**
- Email: security@zionterranova.com
- Bug Bounty: https://bugcrowd.com/zion (up to €50k)

---

**Document Status:** FINAL DRAFT v1.0  
**Review Required:** CTO, Security Auditor  
**Implementation:** Q1-Q2 2026  
**Next Update:** After security audit feedback
