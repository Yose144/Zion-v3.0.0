# 🔐 SECURITY HARDENING - v2.9.0

**Version:** 2.9.0 Security Framework  
**Timeline:** December 1-15, 2025 (Phase 2)  
**Priority:** CRITICAL  
**Target:** ZERO High/Critical Vulnerabilities

---

## 📊 Executive Summary

Kompletní bezpečnostní audit a hardening pro produkční mainnet ZION v2.9.0.

### Cíle

- ✅ Replace ecdsa → cryptography (moderní knihovna)
- ✅ Hardware wallet support (Ledger, Trezor)
- ✅ Multi-signature wallets (2-of-3, 3-of-5)
- ✅ External security audit (0 critical findings)
- ✅ Bug bounty program (100,000 ZION rewards)
- ✅ Penetration testing

---

## 🔑 Cryptography Migration

### Current Issue: ecdsa Library Vulnerability

**Problem:**
```python
# Current implementation (VULNERABLE)
from ecdsa import SigningKey, SECP256k1
import hashlib

# Timing attack vulnerability in ecdsa 0.19.0
# Minerva attack: Side-channel leak during signature generation
```

**CVE:** CVE-2024-XXXX (Minerva timing attack)  
**CVSS Score:** 7.5 (HIGH)  
**Impact:** Private key recovery via timing analysis

### Solution: Migrate to `cryptography` Library

**New Implementation:**
```python
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.backends import default_backend
import secrets

class ZIONWallet:
    """Secure wallet implementation using cryptography library"""
    
    def __init__(self):
        self.backend = default_backend()
        
    def generate_keypair(self):
        """Generate new ECDSA keypair (secp256k1)"""
        # Use cryptography's constant-time implementation
        private_key = ec.generate_private_key(
            ec.SECP256K1(), 
            self.backend
        )
        public_key = private_key.public_key()
        
        return private_key, public_key
    
    def sign_transaction(self, private_key, message: bytes) -> bytes:
        """Sign transaction with constant-time signature"""
        signature = private_key.sign(
            message,
            ec.ECDSA(hashes.SHA256())
        )
        return signature
    
    def verify_signature(self, public_key, message: bytes, signature: bytes) -> bool:
        """Verify signature"""
        try:
            public_key.verify(
                signature,
                message,
                ec.ECDSA(hashes.SHA256())
            )
            return True
        except Exception:
            return False
    
    def serialize_private_key(self, private_key, password: bytes = None) -> bytes:
        """Export private key (optionally encrypted)"""
        if password:
            encryption = serialization.BestAvailableEncryption(password)
        else:
            encryption = serialization.NoEncryption()
        
        return private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=encryption
        )
    
    def deserialize_private_key(self, pem_data: bytes, password: bytes = None):
        """Import private key"""
        return serialization.load_pem_private_key(
            pem_data,
            password=password,
            backend=self.backend
        )
    
    def get_address(self, public_key) -> str:
        """Derive ZION address from public key"""
        # Public key → compressed format
        public_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.X962,
            format=serialization.PublicFormat.CompressedPoint
        )
        
        # SHA-256 → RIPEMD-160
        sha256_hash = hashlib.sha256(public_bytes).digest()
        ripemd160 = hashlib.new('ripemd160', sha256_hash).digest()
        
        # Add version byte (0x5A for ZION)
        versioned = b'\x5a' + ripemd160
        
        # Double SHA-256 checksum
        checksum = hashlib.sha256(hashlib.sha256(versioned).digest()).digest()[:4]
        
        # Base58 encoding
        address_bytes = versioned + checksum
        return self._base58_encode(address_bytes)
    
    def _base58_encode(self, data: bytes) -> str:
        """Base58 encoding for addresses"""
        alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
        num = int.from_bytes(data, 'big')
        encoded = ''
        
        while num > 0:
            num, remainder = divmod(num, 58)
            encoded = alphabet[remainder] + encoded
        
        # Add leading zeros
        for byte in data:
            if byte == 0:
                encoded = '1' + encoded
            else:
                break
        
        return 'Z' + encoded  # ZION prefix
```

### EdDSA Support (Post-Quantum Readiness)

```python
from cryptography.hazmat.primitives.asymmetric import ed25519

class ZIONWalletEdDSA:
    """EdDSA wallet (Ed25519) for post-quantum readiness"""
    
    def generate_keypair(self):
        """Generate Ed25519 keypair"""
        private_key = ed25519.Ed25519PrivateKey.generate()
        public_key = private_key.public_key()
        return private_key, public_key
    
    def sign_transaction(self, private_key, message: bytes) -> bytes:
        """Ed25519 signature (faster than ECDSA)"""
        return private_key.sign(message)
    
    def verify_signature(self, public_key, message: bytes, signature: bytes) -> bool:
        """Verify Ed25519 signature"""
        try:
            public_key.verify(signature, message)
            return True
        except Exception:
            return False
```

### Migration Tasks

- [ ] Replace all `ecdsa` imports with `cryptography`
- [ ] Update `src/core/crypto_utils.py`
- [ ] Update `src/wallet/zion_wallet.py`
- [ ] Update `src/blockchain/transaction.py`
- [ ] Add EdDSA support (optional wallets)
- [ ] Backward compatibility layer (verify old signatures)
- [ ] Performance benchmarks (expect 10-50% faster)
- [ ] Update all unit tests
- [ ] Security audit of crypto module

**Deliverables:**
- ✅ Modern cryptography library (no timing attacks)
- ✅ 10-50% performance improvement
- ✅ EdDSA support for future wallets
- ✅ 100% backward compatible
- ✅ Security audit report

---

## 💳 Hardware Wallet Support

### Ledger Nano S/X Integration

**Architecture:**
```
┌─────────────────┐       USB/BT        ┌──────────────────┐
│  Ledger Nano X  │ ◄─────────────────► │  ZION Desktop    │
│  - Stores keys  │                      │  Wallet (GUI)    │
│  - Signs txs    │                      │  - Builds txs    │
│  - PIN protected│                      │  - Broadcasts    │
└─────────────────┘                      └──────────────────┘
```

**Ledger App Development (C):**

```c
// ZION Ledger App (Nano S/X)
#include "os.h"
#include "cx.h"
#include "ledger_assert.h"

// BIP-32 derivation path: m/44'/9999'/0'/0/0
// 9999 = ZION coin type (registered with SLIP-44)
#define BIP32_PATH {44 | 0x80000000, 9999 | 0x80000000, 0 | 0x80000000, 0, 0}

// Global keypair storage
cx_ecfp_private_key_t private_key;
cx_ecfp_public_key_t public_key;

// Generate ZION address from public key
void derive_zion_address(uint8_t *public_key_bytes, char *address_out) {
    uint8_t sha256_hash[32];
    uint8_t ripemd160_hash[20];
    
    // SHA-256
    cx_hash_sha256(public_key_bytes, 65, sha256_hash, 32);
    
    // RIPEMD-160
    cx_ripemd160_init(&ripemd160_ctx);
    cx_hash(&ripemd160_ctx, CX_LAST, sha256_hash, 32, ripemd160_hash, 20);
    
    // Version byte + hash
    uint8_t versioned[21];
    versioned[0] = 0x5A; // ZION version byte
    os_memmove(versioned + 1, ripemd160_hash, 20);
    
    // Checksum (double SHA-256)
    uint8_t checksum[32];
    cx_hash_sha256(versioned, 21, checksum, 32);
    cx_hash_sha256(checksum, 32, checksum, 32);
    
    // Base58 encode
    uint8_t address_bytes[25];
    os_memmove(address_bytes, versioned, 21);
    os_memmove(address_bytes + 21, checksum, 4);
    
    base58_encode(address_bytes, 25, address_out);
}

// Sign ZION transaction
void sign_transaction(uint8_t *tx_hash, uint8_t *signature_out) {
    uint8_t der_signature[100];
    unsigned int sig_len = sizeof(der_signature);
    
    // Sign with ECDSA (secp256k1)
    cx_ecdsa_sign(&private_key, CX_RND_RFC6979 | CX_LAST, CX_SHA256,
                  tx_hash, 32, der_signature, &sig_len, NULL);
    
    // Convert DER → compact format
    der_to_compact(der_signature, sig_len, signature_out);
}

// Main app entry point
void app_main(void) {
    volatile unsigned int rx = 0;
    volatile unsigned int tx = 0;
    
    // Infinite loop for APDU commands
    for (;;) {
        // Receive APDU command
        rx = io_exchange(CHANNEL_APDU, rx);
        
        switch (G_io_apdu_buffer[0]) {
            case INS_GET_PUBLIC_KEY:
                handle_get_public_key();
                break;
            case INS_SIGN_TRANSACTION:
                handle_sign_transaction();
                break;
            case INS_GET_ADDRESS:
                handle_get_address();
                break;
            default:
                THROW(0x6D00); // INS not supported
        }
    }
}
```

**Desktop Wallet (Electron.js):**

```javascript
// ZION Desktop Wallet with Ledger support
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import Zion from '@zion/ledger-hw-app-zion';

class ZIONLedgerWallet {
  async connect() {
    this.transport = await TransportWebUSB.create();
    this.zion = new Zion(this.transport);
    return true;
  }
  
  async getAddress(accountIndex = 0) {
    const path = `44'/9999'/${accountIndex}'/0/0`;
    const result = await this.zion.getAddress(path);
    return result.address;
  }
  
  async signTransaction(tx, accountIndex = 0) {
    const path = `44'/9999'/${accountIndex}'/0/0`;
    const txBytes = tx.serialize();
    const result = await this.zion.signTransaction(path, txBytes);
    return result.signature;
  }
  
  async disconnect() {
    await this.transport.close();
  }
}

// Usage
const wallet = new ZIONLedgerWallet();
await wallet.connect();
const address = await wallet.getAddress();
console.log('Ledger address:', address);

const tx = new ZIONTransaction({...});
const signature = await wallet.signTransaction(tx);
tx.addSignature(signature);
```

### Trezor Model T Integration

**Trezor Firmware (Python/C):**

```python
# ZION support in Trezor firmware
# File: core/src/apps/zion/sign_tx.py

from trezor import wire
from trezor.crypto import bip32, hashlib
from trezor.crypto.curve import secp256k1
from trezor.messages import ZionSignedTx

async def sign_tx(ctx, msg):
    # Derive private key from seed
    node = bip32.from_seed(ctx.seed, 'secp256k1')
    
    # BIP-32 path: m/44'/9999'/0'/0/0
    node.derive_path([44 | 0x80000000, 9999 | 0x80000000, 0 | 0x80000000, 0, 0])
    
    # Sign transaction hash
    tx_hash = msg.tx_hash
    signature = secp256k1.sign(node.private_key(), tx_hash)
    
    # Return signed transaction
    return ZionSignedTx(signature=signature)
```

### Implementation Tasks

- [ ] Ledger app development (C, BOLOS SDK)
- [ ] Ledger app testing (Nano S, Nano X, Nano S Plus)
- [ ] Trezor firmware integration
- [ ] BIP-32/BIP-39/BIP-44 implementation
- [ ] Desktop wallet GUI (Electron.js)
- [ ] Mobile wallet (React Native)
- [ ] Hardware wallet documentation
- [ ] User setup guide & videos

**Deliverables:**
- ✅ Ledger ZION app (Chrome Web Store)
- ✅ Trezor support via web interface
- ✅ Desktop wallet (Windows, macOS, Linux)
- ✅ Mobile wallet (iOS, Android)
- ✅ User documentation & tutorials

---

## 🔐 Multi-Signature Wallets

### Architecture

**2-of-3 Multi-Sig Example:**
```
Transaction requires 2 signatures from:
- Owner 1 (Alice)
- Owner 2 (Bob)
- Owner 3 (Charlie)

Any 2 can sign to authorize transaction.
```

### Smart Contract Implementation

```solidity
// ZION Multi-Sig Wallet Contract
pragma solidity ^0.8.20;

contract ZIONMultiSigWallet {
    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 confirmations;
    }
    
    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public required; // Required signatures (M)
    
    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmations;
    
    event Deposit(address indexed sender, uint256 amount);
    event Submission(uint256 indexed txId);
    event Confirmation(address indexed sender, uint256 indexed txId);
    event Execution(uint256 indexed txId);
    event ExecutionFailure(uint256 indexed txId);
    
    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not owner");
        _;
    }
    
    modifier txExists(uint256 _txId) {
        require(_txId < transactions.length, "Transaction does not exist");
        _;
    }
    
    modifier notExecuted(uint256 _txId) {
        require(!transactions[_txId].executed, "Transaction already executed");
        _;
    }
    
    modifier notConfirmed(uint256 _txId) {
        require(!confirmations[_txId][msg.sender], "Transaction already confirmed");
        _;
    }
    
    constructor(address[] memory _owners, uint256 _required) {
        require(_owners.length > 0, "Owners required");
        require(_required > 0 && _required <= _owners.length, "Invalid required number");
        
        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid owner");
            require(!isOwner[owner], "Owner not unique");
            
            isOwner[owner] = true;
            owners.push(owner);
        }
        
        required = _required;
    }
    
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }
    
    function submitTransaction(address _to, uint256 _value, bytes memory _data)
        public
        onlyOwner
        returns (uint256 txId)
    {
        txId = transactions.length;
        transactions.push(Transaction({
            to: _to,
            value: _value,
            data: _data,
            executed: false,
            confirmations: 0
        }));
        
        emit Submission(txId);
        confirmTransaction(txId);
    }
    
    function confirmTransaction(uint256 _txId)
        public
        onlyOwner
        txExists(_txId)
        notExecuted(_txId)
        notConfirmed(_txId)
    {
        confirmations[_txId][msg.sender] = true;
        transactions[_txId].confirmations += 1;
        
        emit Confirmation(msg.sender, _txId);
        
        if (isConfirmed(_txId)) {
            executeTransaction(_txId);
        }
    }
    
    function executeTransaction(uint256 _txId)
        public
        onlyOwner
        txExists(_txId)
        notExecuted(_txId)
    {
        require(isConfirmed(_txId), "Not enough confirmations");
        
        Transaction storage txn = transactions[_txId];
        txn.executed = true;
        
        (bool success, ) = txn.to.call{value: txn.value}(txn.data);
        if (success) {
            emit Execution(_txId);
        } else {
            emit ExecutionFailure(_txId);
            txn.executed = false;
        }
    }
    
    function isConfirmed(uint256 _txId) public view returns (bool) {
        return transactions[_txId].confirmations >= required;
    }
    
    function getOwners() public view returns (address[] memory) {
        return owners;
    }
    
    function getTransactionCount() public view returns (uint256) {
        return transactions.length;
    }
}
```

### Time-Locked Transactions

```solidity
contract ZIONTimeLockWallet {
    uint256 public constant TIMELOCK_DURATION = 48 hours;
    
    struct TimeLockTx {
        address to;
        uint256 value;
        uint256 unlockTime;
        bool executed;
    }
    
    mapping(uint256 => TimeLockTx) public timelockTxs;
    uint256 public txCounter;
    
    function proposeTransaction(address _to, uint256 _value) public onlyOwner returns (uint256) {
        uint256 txId = txCounter++;
        timelockTxs[txId] = TimeLockTx({
            to: _to,
            value: _value,
            unlockTime: block.timestamp + TIMELOCK_DURATION,
            executed: false
        });
        return txId;
    }
    
    function executeTimeLockTx(uint256 _txId) public onlyOwner {
        TimeLockTx storage txn = timelockTxs[_txId];
        require(block.timestamp >= txn.unlockTime, "Still locked");
        require(!txn.executed, "Already executed");
        
        txn.executed = true;
        (bool success, ) = txn.to.call{value: txn.value}("");
        require(success, "Transfer failed");
    }
}
```

### Social Recovery

```solidity
contract ZIONSocialRecoveryWallet {
    address public owner;
    address[] public guardians;
    uint256 public requiredGuardians;
    
    struct RecoveryRequest {
        address newOwner;
        uint256 confirmations;
        mapping(address => bool) confirmed;
        bool executed;
    }
    
    RecoveryRequest public activeRecovery;
    
    function initiateRecovery(address _newOwner) public {
        require(isGuardian(msg.sender), "Not guardian");
        require(!activeRecovery.executed, "Recovery in progress");
        
        activeRecovery.newOwner = _newOwner;
        activeRecovery.confirmations = 0;
        activeRecovery.executed = false;
    }
    
    function confirmRecovery() public {
        require(isGuardian(msg.sender), "Not guardian");
        require(!activeRecovery.confirmed[msg.sender], "Already confirmed");
        
        activeRecovery.confirmed[msg.sender] = true;
        activeRecovery.confirmations++;
        
        if (activeRecovery.confirmations >= requiredGuardians) {
            owner = activeRecovery.newOwner;
            activeRecovery.executed = true;
        }
    }
    
    function isGuardian(address _addr) internal view returns (bool) {
        for (uint256 i = 0; i < guardians.length; i++) {
            if (guardians[i] == _addr) return true;
        }
        return false;
    }
}
```

### Implementation Tasks

- [ ] Multi-sig smart contracts deployment
- [ ] RPC methods: `createmultisig`, `signrawtransaction`
- [ ] Time-locked transaction support
- [ ] Social recovery implementation
- [ ] Web UI for multi-sig wallet management
- [ ] Testing (2-of-3, 3-of-5, custom M-of-N)
- [ ] Documentation & user guide

**Deliverables:**
- ✅ Multi-sig wallets operational
- ✅ Time-locked transactions
- ✅ Social recovery mechanism
- ✅ Web UI for wallet coordination
- ✅ User documentation

---

## 🛡️ Security Audit

### Scope

**Components to Audit:**
1. Cryptography implementation (crypto_utils.py)
2. Wallet generation & signing
3. Transaction validation
4. Smart contract security
5. WARP 2 bridge contracts
6. API authentication & authorization
7. P2P network security
8. Database security (SQL injection)

### Audit Firms

**Option 1: Trail of Bits**
- Cost: $50,000 - $75,000
- Duration: 2-3 weeks
- Deliverables: Comprehensive report, remediation guidance
- Website: https://www.trailofbits.com/

**Option 2: OpenZeppelin**
- Cost: $40,000 - $60,000
- Duration: 2 weeks
- Deliverables: Security report, best practices
- Website: https://www.openzeppelin.com/security-audits

**Option 3: Certik**
- Cost: $30,000 - $50,000
- Duration: 1-2 weeks
- Deliverables: Security score, report
- Website: https://www.certik.com/

### Audit Process

1. **Preparation (Week 1)**
   - Code freeze
   - Documentation preparation
   - Test coverage verification
   - Audit scope definition

2. **Audit Execution (Week 2-3)**
   - Code review
   - Automated testing
   - Manual penetration testing
   - Report drafting

3. **Remediation (Week 4)**
   - Fix critical issues
   - Fix high-priority issues
   - Re-audit critical fixes
   - Final report

**Deliverables:**
- ✅ Security audit report
- ✅ 0 critical vulnerabilities
- ✅ <5 high-priority issues
- ✅ Remediation verification

---

## 🐛 Bug Bounty Program

### Reward Structure

| Severity | Description | Reward (ZION) |
|----------|-------------|---------------|
| **Critical** | Private key theft, fund drain, RCE | 50,000 |
| **High** | Auth bypass, signature forgery, DoS | 20,000 |
| **Medium** | Info disclosure, rate limit bypass | 5,000 |
| **Low** | UI bugs, typos, non-security issues | 1,000 |

### Total Budget

**100,000 ZION** (from Infrastructure Fund)

### Scope

**In Scope:**
- Core blockchain code (consensus, validation)
- Wallet generation & signing
- Smart contracts (multi-sig, bridge)
- API endpoints (authentication, authorization)
- P2P network
- Website & web wallet

**Out of Scope:**
- Third-party services (hosting, DNS)
- Social engineering
- Physical attacks
- DDoS attacks (report to ops team)

### Disclosure Policy

**Responsible Disclosure:**
1. Report to `security@zionblockchain.org`
2. Do NOT publicly disclose until fix is deployed
3. Wait 90 days or until patch release (whichever is first)
4. We will credit you in Hall of Fame
5. Rewards paid within 30 days of fix deployment

**Public Disclosure:**
- After 90 days, you may publish details
- We will coordinate disclosure timing
- Joint disclosure encouraged

### Platform

**Option 1: HackerOne**
- Professional platform
- Escrow for rewards
- Triage support
- Cost: 10% platform fee

**Option 2: Custom Portal**
- Self-hosted
- No platform fees
- Full control
- Requires manual triage

**Recommended:** HackerOne (better researcher reach)

**Deliverables:**
- ✅ Bug bounty program launched
- ✅ 100+ researchers participating
- ✅ Hall of Fame for top contributors
- ✅ Quarterly security reports

---

## 🔍 Penetration Testing

### Testing Scope

**Network Layer:**
- Port scanning (nmap)
- DDoS resistance testing
- P2P network fuzzing

**Application Layer:**
- SQL injection testing
- XSS/CSRF testing
- Authentication bypass attempts
- API rate limiting verification

**Smart Contract Layer:**
- Reentrancy attacks
- Integer overflow/underflow
- Front-running simulation
- Gas limit issues

### Tools

**Automated:**
- Burp Suite Professional
- OWASP ZAP
- Nmap / Masscan
- Metasploit Framework
- Mythril (smart contract analysis)
- Slither (Solidity static analysis)

**Manual:**
- Custom exploit development
- Logic flaw analysis
- Business logic testing

### Timeline

- Week 1: Automated scanning
- Week 2: Manual testing
- Week 3: Exploit development
- Week 4: Report & remediation

**Deliverables:**
- ✅ Penetration test report
- ✅ All critical findings fixed
- ✅ Remediation verification
- ✅ Security posture improvement recommendations

---

## 📊 Security Metrics

### Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Critical Vulnerabilities | 0 | External audit findings |
| High Vulnerabilities | <5 | External audit findings |
| Test Coverage | 95%+ | pytest --cov |
| Dependency Vulnerabilities | 0 high | pip-audit, safety |
| Docker Image Vulnerabilities | 0 critical | trivy scan |
| Bug Bounty Submissions | 50+ | HackerOne dashboard |
| Security Incidents | 0 | Production monitoring |

### Continuous Monitoring

**Tools:**
- **Dependabot:** Auto-update vulnerable dependencies
- **Snyk:** Real-time vulnerability scanning
- **Trivy:** Docker image security scanning
- **SAST:** Static application security testing (Bandit for Python)
- **DAST:** Dynamic application security testing (OWASP ZAP)

**Process:**
- Daily dependency scans
- Weekly security reviews
- Monthly penetration tests
- Quarterly external audits

---

## 🔗 Resources

### Security Best Practices
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Smart Contract Security: https://consensys.github.io/smart-contract-best-practices/
- Cryptocurrency Security Standard (CCSS): https://cryptoconsortium.github.io/CCSS/

### Audit Firms
- Trail of Bits: https://www.trailofbits.com/
- OpenZeppelin: https://www.openzeppelin.com/security-audits
- Certik: https://www.certik.com/

### Bug Bounty
- HackerOne: https://www.hackerone.com/
- Bugcrowd: https://www.bugcrowd.com/
- Immunefi: https://immunefi.com/ (crypto-focused)

---

**Last Updated:** November 10, 2025  
**Version:** v2.9.0 Security Framework  
**Status:** ACTIVE DEVELOPMENT 🔐

---

*"Security is not a feature, it's a foundation."* 🛡️
