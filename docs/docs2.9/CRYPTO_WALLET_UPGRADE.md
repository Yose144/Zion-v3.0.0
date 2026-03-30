# ZION Crypto Wallet Generation Upgrade

**Version:** 2.9.0  
**Priority:** Critical  
**Status:** Pending Implementation  
**Date:** 3. prosince 2025

---

## 🎯 Objective

Replace mock wallet generation (hash('ripemd160')) in `api/presale/wallet-qr.php` with real ECDSA secp256k1 + Base58Check encoding compatible with ZION blockchain.

**Current Issue:**
- PHP presale uses `hash('ripemd160', hash('sha256', $privateKey))` for mock addresses
- Not compatible with real ZION blockchain wallet format
- Private keys not generated using proper ECDSA secp256k1 curve

**Goal:**
- Generate real ZION addresses compatible with blockchain
- Use proper elliptic curve cryptography (secp256k1)
- Integrate with existing Python wallet generator OR implement in PHP

---

## 🔍 Current Implementation Analysis

### PHP Mock Wallet Generation

**File:** `api/presale/wallet-qr.php` (lines ~50-80)

```php
// CURRENT (MOCK) - NOT PRODUCTION READY
function generatePresaleWallet($orderId, $tokens) {
    // Generate private key (32 bytes random)
    $privateKey = generateSecureToken(64); // hex string
    
    // MOCK address generation (NOT REAL ZION)
    $publicKey = hash('sha256', $privateKey);
    $publicAddress = 'ZION_' . strtoupper(hash('ripemd160', hash('sha256', $publicKey, true)));
    
    // Encrypt private key
    $encryptedKey = encryptData($privateKey);
    
    return [
        'wallet_id' => generateWalletId(),
        'public_address' => $publicAddress, // MOCK!
        'private_key_encrypted' => $encryptedKey
    ];
}
```

**Problems:**
1. No elliptic curve cryptography (no public key derivation)
2. Address format doesn't match ZION blockchain
3. Private key not 256-bit EC private key
4. No checksum in address

---

## ✅ Python Implementation (Already Exists)

### Python Wallet Generator

**File:** `src/core/presale_wallet.py` (lines ~180-250)

```python
import hashlib
import base58
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

def generate_zion_wallet():
    """Generate real ZION wallet with secp256k1"""
    
    # Generate private key (secp256k1 curve)
    private_key = ec.generate_private_key(ec.SECP256K1())
    
    # Derive public key
    public_key = private_key.public_key()
    
    # Serialize public key (uncompressed format)
    public_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint
    )
    
    # ZION address derivation:
    # 1. SHA256(public_key)
    # 2. RIPEMD160(hash)
    # 3. Add version byte (0x5A for ZION)
    # 4. Add checksum (first 4 bytes of double SHA256)
    # 5. Base58 encode
    
    sha256_hash = hashlib.sha256(public_bytes).digest()
    ripemd160_hash = hashlib.new('ripemd160', sha256_hash).digest()
    
    # Add ZION version byte (0x5A = 'Z')
    versioned = b'\x5A' + ripemd160_hash
    
    # Calculate checksum
    checksum = hashlib.sha256(hashlib.sha256(versioned).digest()).digest()[:4]
    
    # Combine and Base58 encode
    address_bytes = versioned + checksum
    public_address = base58.b58encode(address_bytes).decode('ascii')
    
    # Serialize private key
    private_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    return {
        'private_key': private_bytes.hex(),
        'public_address': public_address,  # Starts with 'Z'
        'public_key': public_bytes.hex()
    }
```

**Features:**
- ✅ Real secp256k1 elliptic curve
- ✅ Proper public key derivation
- ✅ ZION-specific address format (starts with 'Z')
- ✅ Checksum validation (Base58Check)
- ✅ Compatible with ZION blockchain

---

## 🔧 Implementation Options

### Option 1: Call Python from PHP (Recommended)

**Pros:**
- Reuse existing tested Python code
- No duplicate implementation
- Consistent with blockchain core

**Cons:**
- Requires Python on web server
- Inter-process communication overhead (~200ms)

**Implementation:**

**File:** `api/presale/wallet-qr.php`

```php
function generatePresaleWallet($orderId, $tokens) {
    // Call Python wallet generator
    $pythonScript = __DIR__ . '/../../src/core/presale_wallet.py';
    $command = "python3 $pythonScript generate-wallet";
    
    $output = shell_exec($command . ' 2>&1');
    $wallet = json_decode($output, true);
    
    if (!$wallet || !isset($wallet['public_address'])) {
        error_log('Python wallet generation failed: ' . $output);
        throw new Exception('Wallet generation failed');
    }
    
    // Encrypt private key (already hex from Python)
    $encryptedKey = encryptData($wallet['private_key']);
    
    return [
        'wallet_id' => generateWalletId(),
        'public_address' => $wallet['public_address'], // Real ZION address
        'private_key_encrypted' => $encryptedKey,
        'public_key' => $wallet['public_key']
    ];
}
```

**Python CLI wrapper:**

**File:** `src/core/presale_wallet.py` (add to end)

```python
if __name__ == '__main__':
    import sys
    import json
    
    if len(sys.argv) > 1 and sys.argv[1] == 'generate-wallet':
        wallet = generate_zion_wallet()
        print(json.dumps(wallet))
    else:
        print(json.dumps({'error': 'Invalid command'}))
```

**Test:**
```bash
python3 src/core/presale_wallet.py generate-wallet
# Output: {"private_key": "...", "public_address": "Z1abc...", "public_key": "..."}
```

---

### Option 2: PHP Native with phpseclib

**Pros:**
- No Python dependency
- Faster execution (~50ms)
- Pure PHP solution

**Cons:**
- Need to install phpseclib library
- Duplicate wallet generation logic
- Must maintain consistency with Python version

**Installation:**

```bash
cd api/presale
composer require phpseclib/phpseclib:^3.0
```

**Implementation:**

**File:** `api/presale/wallet-generator.php` (new)

```php
<?php
require_once __DIR__ . '/../../vendor/autoload.php';

use phpseclib3\Crypt\EC;
use phpseclib3\Crypt\Hash;

class ZionWalletGenerator {
    
    /**
     * Generate ZION wallet with secp256k1
     */
    public static function generate() {
        // Generate secp256k1 private key
        $private = EC::createKey('secp256k1');
        $public = $private->getPublicKey();
        
        // Get public key bytes (uncompressed)
        $publicBytes = $public->toString('raw');
        
        // ZION address derivation
        $sha256 = hash('sha256', $publicBytes, true);
        $ripemd160 = hash('ripemd160', $sha256, true);
        
        // Add ZION version byte (0x5A)
        $versioned = chr(0x5A) . $ripemd160;
        
        // Calculate checksum
        $checksum = substr(hash('sha256', hash('sha256', $versioned, true), true), 0, 4);
        
        // Combine and Base58 encode
        $addressBytes = $versioned . $checksum;
        $publicAddress = self::base58Encode($addressBytes);
        
        return [
            'private_key' => bin2hex($private->toString('PKCS8')),
            'public_address' => $publicAddress,
            'public_key' => bin2hex($publicBytes)
        ];
    }
    
    /**
     * Base58 encode (Bitcoin-style)
     */
    private static function base58Encode($data) {
        $alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        $base = strlen($alphabet);
        
        // Convert to big integer
        $num = gmp_init(bin2hex($data), 16);
        $encoded = '';
        
        while (gmp_cmp($num, 0) > 0) {
            list($num, $remainder) = gmp_div_qr($num, $base);
            $encoded = $alphabet[gmp_intval($remainder)] . $encoded;
        }
        
        // Add leading zeros
        for ($i = 0; $i < strlen($data) && $data[$i] === "\x00"; $i++) {
            $encoded = $alphabet[0] . $encoded;
        }
        
        return $encoded;
    }
}
?>
```

**Usage:**

**File:** `api/presale/wallet-qr.php`

```php
require_once __DIR__ . '/wallet-generator.php';

function generatePresaleWallet($orderId, $tokens) {
    // Generate real ZION wallet
    $wallet = ZionWalletGenerator::generate();
    
    // Encrypt private key
    $encryptedKey = encryptData($wallet['private_key']);
    
    return [
        'wallet_id' => generateWalletId(),
        'public_address' => $wallet['public_address'], // Real ZION address
        'private_key_encrypted' => $encryptedKey,
        'public_key' => $wallet['public_key']
    ];
}
```

---

### Option 3: Hybrid (Python for Generation, PHP for Storage)

**Best of both worlds:**
- Python generates wallets (batch or on-demand)
- PHP retrieves from pre-generated pool
- Async generation via cron job

**Implementation:**

**Step 1: Pre-generate Wallets (Cron)**

**File:** `scripts/generate_wallet_pool.py` (new)

```python
from src.core.presale_wallet import generate_zion_wallet
import sqlite3
import time

def generate_wallet_pool(count=100):
    """Generate pool of wallets for presale"""
    
    conn = sqlite3.connect('data/wallet_pool.db')
    cursor = conn.cursor()
    
    # Create table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS wallet_pool (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            public_address TEXT UNIQUE NOT NULL,
            private_key TEXT NOT NULL,
            public_key TEXT NOT NULL,
            status TEXT DEFAULT 'available',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Generate wallets
    for _ in range(count):
        wallet = generate_zion_wallet()
        
        cursor.execute('''
            INSERT INTO wallet_pool (public_address, private_key, public_key)
            VALUES (?, ?, ?)
        ''', (wallet['public_address'], wallet['private_key'], wallet['public_key']))
        
        time.sleep(0.1)  # Rate limit
    
    conn.commit()
    conn.close()
    
    print(f"✅ Generated {count} wallets")

if __name__ == '__main__':
    generate_wallet_pool(100)
```

**Cron job:**
```bash
# Run daily at 3 AM
0 3 * * * cd /path/to/zion && python3 scripts/generate_wallet_pool.py
```

**Step 2: PHP Retrieval**

**File:** `api/presale/wallet-qr.php`

```php
function generatePresaleWallet($orderId, $tokens) {
    // Get wallet from pool
    $poolDb = new PDO('sqlite:' . __DIR__ . '/../../data/wallet_pool.db');
    
    // Begin transaction
    $poolDb->beginTransaction();
    
    try {
        // Get available wallet
        $stmt = $poolDb->prepare("
            SELECT * FROM wallet_pool 
            WHERE status = 'available' 
            LIMIT 1 
            FOR UPDATE
        ");
        $stmt->execute();
        $wallet = $stmt->fetch();
        
        if (!$wallet) {
            throw new Exception('No wallets available in pool');
        }
        
        // Mark as used
        $stmt = $poolDb->prepare("
            UPDATE wallet_pool 
            SET status = 'used' 
            WHERE id = :id
        ");
        $stmt->execute([':id' => $wallet['id']]);
        
        $poolDb->commit();
        
        // Encrypt private key
        $encryptedKey = encryptData($wallet['private_key']);
        
        return [
            'wallet_id' => generateWalletId(),
            'public_address' => $wallet['public_address'],
            'private_key_encrypted' => $encryptedKey,
            'public_key' => $wallet['public_key']
        ];
        
    } catch (Exception $e) {
        $poolDb->rollBack();
        throw $e;
    }
}
```

**Monitoring:**
```php
// Check pool size
function getWalletPoolStatus() {
    $poolDb = new PDO('sqlite:wallet_pool.db');
    $result = $poolDb->query("
        SELECT status, COUNT(*) as count 
        FROM wallet_pool 
        GROUP BY status
    ")->fetchAll();
    
    return $result;
    // [{'status': 'available', 'count': 85}, {'status': 'used', 'count': 15}]
}
```

---

## 📋 Implementation Checklist

### Option 1: Python Integration (Fastest to Deploy)

- [ ] Add CLI wrapper to `presale_wallet.py`
- [ ] Test Python execution from PHP
- [ ] Update `wallet-qr.php` to call Python
- [ ] Handle errors (Python not available, etc.)
- [ ] Performance test (target: <500ms per wallet)
- [ ] Deploy Python files to server
- [ ] Verify Python dependencies installed
- [ ] Test on production server

**Estimated Time:** 2-3 hours  
**Risk:** Low (Python already tested)

---

### Option 2: PHP Native (Most Portable)

- [ ] Install phpseclib via Composer
- [ ] Create `wallet-generator.php` class
- [ ] Implement secp256k1 key generation
- [ ] Implement Base58Check encoding
- [ ] Test address format matches Python
- [ ] Cross-verify 100 addresses (Python vs PHP)
- [ ] Update `wallet-qr.php` to use new generator
- [ ] Performance benchmark

**Estimated Time:** 4-6 hours  
**Risk:** Medium (need to verify compatibility)

---

### Option 3: Hybrid Pool (Most Scalable)

- [ ] Create `generate_wallet_pool.py` script
- [ ] Create `wallet_pool.db` schema
- [ ] Generate initial 1000 wallets
- [ ] Set up cron job (daily refill)
- [ ] Update `wallet-qr.php` to use pool
- [ ] Add monitoring for pool size
- [ ] Add alerts when pool <50 wallets
- [ ] Test pool depletion scenario

**Estimated Time:** 6-8 hours  
**Risk:** Low (best long-term solution)

---

## 🧪 Testing Strategy

### Unit Tests

**Test 1: Address Format**
```php
$wallet = generatePresaleWallet('TEST', 1000);
assert(substr($wallet['public_address'], 0, 1) === 'Z'); // Starts with Z
assert(strlen($wallet['public_address']) >= 26); // Valid Base58 length
```

**Test 2: Address Validation**
```python
# Python validator
def validate_zion_address(address):
    try:
        decoded = base58.b58decode(address)
        if decoded[0] != 0x5A:  # Version byte
            return False
        
        payload = decoded[:-4]
        checksum = decoded[-4:]
        
        calculated_checksum = hashlib.sha256(hashlib.sha256(payload).digest()).digest()[:4]
        return checksum == calculated_checksum
    except:
        return False
```

**Test 3: Cross-Verification**
```bash
# Generate 100 addresses from PHP
# Validate all 100 with Python validator
# Expected: 100% pass rate
```

### Integration Tests

**Test 4: Full Presale Flow**
1. Customer initiates purchase
2. PHP generates ZION wallet
3. Wallet stored in database
4. QR code generated
5. Private key encrypted
6. Order completed
7. **Verify:** Address is valid ZION format

**Test 5: MainNet Distribution Simulation**
1. Decrypt private key
2. Sign transaction with private key
3. Send tokens to public address
4. **Verify:** Transaction accepted by ZION blockchain

---

## 📊 Performance Comparison

| Method | Generation Time | Complexity | Reliability |
|--------|----------------|------------|-------------|
| Mock (current) | ~10ms | Very Low | ❌ Not production |
| Python call | ~200ms | Low | ✅ High |
| PHP native | ~50ms | Medium | ✅ High |
| Hybrid pool | ~5ms | High | ✅ Very High |

**Recommendation:** Start with **Option 1 (Python)** for fastest deployment, migrate to **Option 3 (Pool)** for production scale.

---

## 🚨 Security Considerations

### Private Key Storage

**Current (Good):**
- AES-256-GCM encryption ✅
- Master key in `presale_encryption_key.bin` ✅

**Additional Hardening:**
- [ ] Use Hardware Security Module (HSM) for master key
- [ ] Implement key rotation (every 6 months)
- [ ] Multi-signature requirement for distributions
- [ ] Cold storage backup of master key

### Address Verification

**Add checksum validation:**
```php
function validateZionAddress($address) {
    if (substr($address, 0, 1) !== 'Z') {
        return false;
    }
    
    // Call Python validator or implement in PHP
    $pythonScript = __DIR__ . '/../../src/core/presale_wallet.py';
    $command = "python3 $pythonScript validate-address " . escapeshellarg($address);
    $output = trim(shell_exec($command));
    
    return $output === 'valid';
}
```

---

## 📝 Deployment Plan

### Phase 1: Development (Week 1)
- [ ] Day 1-2: Implement Option 1 (Python integration)
- [ ] Day 3: Testing and validation
- [ ] Day 4-5: Option 3 (pool) if needed

### Phase 2: Staging (Week 2)
- [ ] Deploy to test environment
- [ ] Generate 100 test wallets
- [ ] Verify with ZION testnet
- [ ] Load testing (1000 wallets/hour)

### Phase 3: Production (Week 3)
- [ ] Backup current system
- [ ] Deploy new wallet generator
- [ ] Monitor first 50 orders
- [ ] Full rollout

---

## 🔄 Rollback Plan

**If issues occur:**

1. **Immediate:** Revert `wallet-qr.php` to mock version
2. **Mark affected orders:** Flag for manual wallet generation
3. **Manual process:** Generate real wallets offline, update DB
4. **Investigation:** Debug new implementation
5. **Fix and redeploy**

**Database migration:**
```sql
-- Identify mock addresses
SELECT * FROM presale_wallets 
WHERE public_address LIKE 'ZION_%' 
AND LENGTH(public_address) != 34;

-- Flag for regeneration
UPDATE presale_wallets 
SET status = 'needs_regeneration'
WHERE LENGTH(public_address) != 34;
```

---

## 📞 Support

**Technical Lead:** Backend Team  
**Priority:** Critical  
**Target Completion:** Before presale Phase 1 launch  
**Dependencies:** Python 3.12+, phpseclib (optional)

---

**Last Updated:** 3. prosince 2025  
**Status:** Awaiting Implementation Decision  
**Recommended Option:** Option 1 → Option 3 (Python first, then pool)
