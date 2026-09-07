# 🏦 ZION WALLET SYSTEM - MASTER PLAN

**Datum:** 4. prosince 2025  
**Status:** Planning & Integration  
**Cíl:** Unified wallet systém pro PRESALE + eShop bonusy + Mainnet

---

## 🎯 PROBLÉM

Máme **3 separátní systémy** které musí fungovat dohromady:

1. **eShop bonusy** (public_html/V2) - malé částky (9-390 ZION)
2. **Presale** (API + Python) - velké částky (10k-500M ZION)  
3. **Mainnet blockchain** (core) - reálné tokeny na blockchainu

**Aktuální stav:**
- ✅ PHP `wallet-lib.php` funguje pro eShop
- ✅ Python `presale_wallet.py` funguje pro presale
- ❌ **NEJSOU PROPOJENÉ S BLOCKCHAINEREM!**
- ❌ QR kódy jsou jen **"sliby"** - ne reálné tokeny
- ❌ Není jasné KDE a JAK se tokeny převedou na blockchain

---

## 🏗️ SOUČASNÁ ARCHITEKTURA

```
┌──────────────────────────────────────────────────────────────┐
│                    ZION WALLET ECOSYSTEM                      │
└──────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌─────────────────┐
│   eShop V2      │         │  Presale API    │
│  (PHP wallet)   │         │ (Python crypto) │
├─────────────────┤         ├─────────────────┤
│ wallet-lib.php  │         │presale_wallet.py│
│ - QR generování │         │ - secp256k1     │
│ - ledger.json   │         │ - AES encryption│
│ - 9-390 ZION    │         │ - 10k-500M ZION │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │    ┌───────────────────┐  │
         └────│  wallet-ledger.php│──┘
              │  (centrální DB)   │
              └─────────┬─────────┘
                        │
                        ▼
              ┌───────────────────┐
              │   QR CODES        │
              │ "IOU Tokeny"      │
              │ (není blockchain) │
              └───────────────────┘

┌──────────────────────────────────────────┐
│  MAINNET BLOCKCHAIN (odděleně!)          │
│  - Genesis block (16.78B premine)        │
│  - 500M presale escrow contract          │
│  - Mining (127.22B supply)               │
│  - POTŘEBUJE REDEMPTION BRIDGE!          │
└──────────────────────────────────────────┘
```

---

## 🎯 CÍL: UNIFIED SYSTÉM

```
┌──────────────────────────────────────────────────────────────┐
│              UNIFIED ZION WALLET SYSTEM v2.0                  │
└──────────────────────────────────────────────────────────────┘

                    ┌─────────────────────┐
                    │  FRONTEND SOURCES   │
                    ├─────────────────────┤
                    │ • eShop objednávky  │
                    │ • Presale nákupy    │
                    │ • DAO odměny        │
                    │ • Mining rewards    │
                    └──────────┬──────────┘
                               │
                               ▼
                  ┌────────────────────────┐
                  │ WALLET GENERATION API  │
                  │  (PHP + Python hybrid) │
                  ├────────────────────────┤
                  │ • Unified entry point  │
                  │ • Token classification │
                  │ • QR + blockchain addr │
                  └──────────┬─────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
     │PRE-MAINNET  │ │   TESTNET   │ │  MAINNET    │
     │   WALLETS   │ │   WALLETS   │ │  WALLETS    │
     ├─────────────┤ ├─────────────┤ ├─────────────┤
     │• QR codes   │ │• Real addrs │ │• Real tokens│
     │• IOU system │ │• Faucet test│ │• Blockchain │
     │• Expiry 1yr │ │• Dev testing│ │• Immutable  │
     └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
            │               │               │
            └───────────────┼───────────────┘
                            ▼
                   ┌────────────────┐
                   │ REDEMPTION API │
                   │ (Mainnet launch)│
                   ├────────────────┤
                   │• QR → Address  │
                   │• Escrow unlock │
                   │• Token transfer│
                   └────────────────┘
```

---

## 📋 IMPLEMENTATION CHECKLIST

### PHASE 1: UNIFIKACE SYSTÉMŮ (Prosinec 2025)

#### 1.1 Centrální Wallet Registry

**File:** `api/wallet-registry.php` (NOVÝ)

```php
<?php
/**
 * ZION Wallet Registry - Centrální správa všech peněženek
 * Podporuje: eShop, Presale, DAO, Mining
 */

class ZionWalletRegistry {
    private PDO $db;
    
    // Typy peněženek
    const TYPE_ESHOP_BONUS = 'eshop_bonus';      // 9-390 ZION
    const TYPE_PRESALE = 'presale';              // 10k-500M ZION
    const TYPE_DAO_REWARD = 'dao_reward';        // DAO výhry
    const TYPE_MINING_PAYOUT = 'mining_payout';  // Mining odměny
    
    // Síťové prostředí
    const NETWORK_PRE_MAINNET = 'pre_mainnet';   // QR IOU (před launch)
    const NETWORK_TESTNET = 'testnet';           // Testovací síť
    const NETWORK_MAINNET = 'mainnet';           // Produkce
    
    public function generateWallet(array $options): array {
        $type = $options['type'] ?? self::TYPE_ESHOP_BONUS;
        $network = $options['network'] ?? self::NETWORK_PRE_MAINNET;
        $tokens = (int)($options['tokens'] ?? 0);
        
        // Rozhodnutí: QR kód vs blockchain address
        if ($network === self::NETWORK_PRE_MAINNET) {
            return $this->generatePreMainnetWallet($type, $tokens, $options);
        } else {
            return $this->generateBlockchainWallet($type, $tokens, $options);
        }
    }
    
    private function generatePreMainnetWallet($type, $tokens, $options): array {
        // Stávající PHP wallet-lib.php logika
        // Generuje QR kód, ukládá do ledger.json
        // Wallet ID: zw_xxxxx (pre-mainnet identifier)
        
        $wallet = zion_generate_wallet([
            'label' => $options['label'],
            'tokens' => $tokens,
            'orderId' => $options['orderId'] ?? null
        ]);
        
        // Uložit metadata
        $this->saveWalletMetadata([
            'wallet_id' => $wallet['wallet']['id'],
            'type' => $type,
            'network' => self::NETWORK_PRE_MAINNET,
            'tokens' => $tokens,
            'source_order_id' => $options['orderId'],
            'customer_email' => $options['email'] ?? null,
            'status' => 'pending_redemption',
            'expires_at' => $wallet['wallet']['expiresAt'],
            'created_at' => date(DATE_ATOM)
        ]);
        
        return $wallet;
    }
    
    private function generateBlockchainWallet($type, $tokens, $options): array {
        // Volá Python presale_wallet.py pro kryptografický wallet
        // Generuje REÁLNOU blockchain adresu (secp256k1)
        
        $pythonClient = new PHPPythonBridge();
        $wallet = $pythonClient->generateWallet([
            'type' => $type,
            'tokens' => $tokens,
            'order_id' => $options['orderId']
        ]);
        
        // Uložit do registry
        $this->saveWalletMetadata([
            'wallet_id' => $wallet['wallet_id'],
            'blockchain_address' => $wallet['public_address'],
            'private_key_encrypted' => $wallet['private_key_encrypted'],
            'type' => $type,
            'network' => $this->getCurrentNetwork(),
            'tokens' => $tokens,
            'status' => 'active',
            'created_at' => date(DATE_ATOM)
        ]);
        
        return $wallet;
    }
    
    public function redeemQRWallet(string $qrCode): array {
        // Po mainnet launch: převede QR kód na blockchain adresu
        // Volá smart contract pro unlock escrow tokenů
        
        $wallet = $this->findWalletByQR($qrCode);
        
        if (!$wallet || $wallet['status'] !== 'pending_redemption') {
            throw new Exception('Invalid or already redeemed QR code');
        }
        
        // Generate blockchain address
        $blockchainWallet = $this->generateBlockchainWallet(
            $wallet['type'],
            $wallet['tokens'],
            ['orderId' => $wallet['source_order_id']]
        );
        
        // Update status
        $this->db->exec("
            UPDATE wallet_registry 
            SET status = 'redeemed',
                blockchain_address = '{$blockchainWallet['public_address']}',
                redeemed_at = NOW()
            WHERE wallet_id = '{$wallet['wallet_id']}'
        ");
        
        // Trigger blockchain transfer (via smart contract)
        $this->triggerEscrowUnlock(
            $wallet['tokens'],
            $blockchainWallet['public_address']
        );
        
        return $blockchainWallet;
    }
}
```

#### 1.2 Database Schema

**File:** `database/wallet_registry_schema.sql` (NOVÝ)

```sql
CREATE TABLE wallet_registry (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Identifikace
    wallet_id VARCHAR(64) UNIQUE NOT NULL,
    blockchain_address VARCHAR(128) UNIQUE,  -- NULL pro pre-mainnet
    private_key_encrypted TEXT,              -- NULL pro pre-mainnet
    
    -- Klasifikace
    type ENUM('eshop_bonus', 'presale', 'dao_reward', 'mining_payout') NOT NULL,
    network ENUM('pre_mainnet', 'testnet', 'mainnet') NOT NULL,
    
    -- Tokeny
    tokens BIGINT NOT NULL,
    
    -- Původ
    source_order_id VARCHAR(64),
    customer_email VARCHAR(255),
    
    -- QR kód (pre-mainnet only)
    qr_code_data TEXT,
    qr_image_path VARCHAR(255),
    qr_service_url TEXT,
    
    -- Status tracking
    status ENUM('pending_redemption', 'active', 'redeemed', 'expired') NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    redeemed_at TIMESTAMP NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Metadata
    metadata JSON,
    
    INDEX idx_type (type),
    INDEX idx_network (network),
    INDEX idx_status (status),
    INDEX idx_email (customer_email),
    INDEX idx_order (source_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Redemption log (pro audit trail)
CREATE TABLE wallet_redemptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    wallet_id VARCHAR(64) NOT NULL,
    old_address VARCHAR(128),  -- QR code identifier
    new_address VARCHAR(128) NOT NULL,  -- Blockchain address
    tokens BIGINT NOT NULL,
    tx_hash VARCHAR(128),  -- Blockchain transaction hash
    block_height INT,
    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    redeemed_by VARCHAR(255),  -- Customer email
    
    FOREIGN KEY (wallet_id) REFERENCES wallet_registry(wallet_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### PHASE 2: PRESALE INTEGRACE (Leden 2026)

#### 2.1 Presale Wallet Generation

**Update:** `public_html/V2/api/presale-order.php`

```php
// PŘED: Používalo jen wallet-lib.php
$walletResult = zion_generate_wallet([...]);

// PO: Používá centrální registry
$registry = new ZionWalletRegistry($pdo);

$walletResult = $registry->generateWallet([
    'type' => ZionWalletRegistry::TYPE_PRESALE,
    'network' => ZionWalletRegistry::NETWORK_PRE_MAINNET,
    'tokens' => $presaleTokens,
    'orderId' => $orderId,
    'email' => $customerEmail,
    'label' => "ZION Presale: {$packageName}"
]);
```

#### 2.2 eShop Bonus Integration

**Update:** `public_html/V2/api/create-order.php`

```php
// PŘED: wallet-lib.php přímo
$zionWalletPayload = zion_generate_wallet([...]);

// PO: Přes registry
$registry = new ZionWalletRegistry($pdo);

$zionWalletPayload = $registry->generateWallet([
    'type' => ZionWalletRegistry::TYPE_ESHOP_BONUS,
    'network' => ZionWalletRegistry::NETWORK_PRE_MAINNET,
    'tokens' => $tokenSummary['totalTokens'],
    'orderId' => $order['orderId'],
    'email' => $order['customer']['email'],
    'label' => "ZION order {$order['orderId']}"
]);
```

### PHASE 3: MAINNET PŘÍPRAVA (Únor-Květen 2026)

#### 3.1 Network Configuration

**File:** `config/network.php` (NOVÝ)

```php
<?php
return [
    'current_network' => getenv('ZION_NETWORK') ?: 'pre_mainnet',
    
    'networks' => [
        'pre_mainnet' => [
            'enabled' => true,
            'uses_qr_codes' => true,
            'requires_blockchain' => false,
            'wallet_expiry_days' => 365,
            'description' => 'Pre-launch QR code wallets (IOUs)'
        ],
        
        'testnet' => [
            'enabled' => true,
            'uses_qr_codes' => false,
            'requires_blockchain' => true,
            'rpc_url' => 'http://testnet-node.zion.one:8332',
            'faucet_url' => 'https://faucet.zion.one',
            'description' => 'Testing network with real blockchain'
        ],
        
        'mainnet' => [
            'enabled' => false,  // Will be TRUE after launch
            'uses_qr_codes' => false,
            'requires_blockchain' => true,
            'rpc_url' => 'http://mainnet-node.zion.one:8332',
            'escrow_contract_address' => '0x...', // Smart contract
            'description' => 'Production blockchain'
        ]
    ],
    
    'mainnet_launch_date' => '2026-06-01',  // Genesis block timestamp
    'redemption_enabled' => false  // Enable after mainnet launch
];
```

#### 3.2 Redemption API

**File:** `api/wallet-redemption.php` (NOVÝ)

```php
<?php
/**
 * ZION Wallet Redemption API
 * Converts pre-mainnet QR codes to blockchain addresses after launch
 */

require_once __DIR__ . '/wallet-registry.php';
require_once __DIR__ . '/../config/network.php';

$config = require __DIR__ . '/../config/network.php';

if (!$config['redemption_enabled']) {
    http_response_code(503);
    die(json_encode([
        'error' => 'Redemption not yet available',
        'mainnet_launch_date' => $config['mainnet_launch_date']
    ]));
}

// Handle redemption request
$input = json_decode(file_get_contents('php://input'), true);
$qrCode = $input['qr_code'] ?? null;

if (!$qrCode) {
    http_response_code(400);
    die(json_encode(['error' => 'Missing QR code']));
}

try {
    $registry = new ZionWalletRegistry($pdo);
    $blockchainWallet = $registry->redeemQRWallet($qrCode);
    
    echo json_encode([
        'success' => true,
        'wallet' => $blockchainWallet,
        'message' => 'QR code successfully redeemed. Tokens transferred to your blockchain address.'
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'error' => $e->getMessage()
    ]);
}
```

### PHASE 4: MAINNET LAUNCH (Červen 2026)

#### 4.1 Genesis Block Deployment

**Python Script:** `scripts/deploy_genesis_block.py`

```python
#!/usr/bin/env python3
"""
Deploy ZION Genesis Block with presale allocation
"""

from src.blockchain.genesis import create_genesis_block
from src.core.wallet_registry import WalletRegistry

def deploy_genesis():
    print("=" * 60)
    print("ZION MAINNET GENESIS BLOCK DEPLOYMENT")
    print("=" * 60)
    
    # Load all presale wallets from registry
    registry = WalletRegistry()
    presale_wallets = registry.get_all_presale_wallets()
    
    print(f"\n✅ Found {len(presale_wallets)} presale wallets")
    total_tokens = sum(w['tokens'] for w in presale_wallets)
    print(f"✅ Total presale allocation: {total_tokens:,} ZION")
    
    # Create genesis block
    genesis = create_genesis_block(
        premine_original=15_780_000_000,
        premine_presale=total_tokens,
        presale_escrow_data=presale_wallets
    )
    
    print(f"\n✅ Genesis block created:")
    print(f"   Block hash: {genesis['hash']}")
    print(f"   Total premine: {genesis['total_premine']:,} ZION")
    print(f"   Mining supply: {genesis['mining_supply']:,} ZION")
    
    # Deploy to network
    deploy_to_network(genesis)
    
    print("\n" + "=" * 60)
    print("🚀 MAINNET IS LIVE!")
    print("=" * 60)

if __name__ == "__main__":
    deploy_genesis()
```

#### 4.2 Enable Redemptions

```bash
# After mainnet launch, enable redemptions
mysql -u root -p zion_db << EOF
UPDATE wallet_registry 
SET status = 'pending_redemption'
WHERE network = 'pre_mainnet' 
AND status = 'active'
AND expires_at > NOW();
EOF

# Update config
sed -i "s/'redemption_enabled' => false/'redemption_enabled' => true/" config/network.php
```

---

## 📊 WALLET FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                     WALLET LIFECYCLE                             │
└─────────────────────────────────────────────────────────────────┘

PŘED MAINNET (Prosinec 2025 - Květen 2026):
================================================

   eShop Order              Presale Purchase
        │                           │
        ▼                           ▼
   ┌────────────────────────────────────┐
   │  generateWallet(type, tokens)      │
   │  network = PRE_MAINNET             │
   └────────────┬───────────────────────┘
                │
                ▼
         ┌─────────────┐
         │  QR CODE    │ ← Ukládá se jako PNG + JSON
         │  IOU Token  │   (není blockchain address)
         └──────┬──────┘
                │
                ▼
         [Zákazník dostane QR v emailu]
                │
                ▼
         [Čeká na mainnet launch...]


PO MAINNET LAUNCH (Červen 2026+):
================================================

   Zákazník má QR kód z pre-mainnet periody
                │
                ▼
         ┌─────────────────┐
         │ Redemption API  │ ← /api/wallet-redemption.php
         │ (POST qr_code)  │
         └────────┬────────┘
                  │
                  ▼
          ┌──────────────────┐
          │ Validate QR      │
          │ • Not expired?   │
          │ • Not redeemed?  │
          │ • Tokens > 0?    │
          └────────┬─────────┘
                   │
                   ▼
          ┌──────────────────────┐
          │ Generate REAL wallet │
          │ • secp256k1 keypair  │
          │ • Blockchain address │
          └────────┬─────────────┘
                   │
                   ▼
          ┌──────────────────────┐
          │ Smart Contract Call  │
          │ escrow.unlock(       │
          │   qr_hash,           │
          │   blockchain_addr,   │
          │   tokens             │
          │ )                    │
          └────────┬─────────────┘
                   │
                   ▼
          ┌──────────────────────┐
          │ Transfer from Escrow │
          │ 500M pool → Address  │
          └────────┬─────────────┘
                   │
                   ▼
          [✅ Zákazník má tokeny na blockchainu!]
          [💰 Může je posílat, stakovat, tradovat]
```

---

## 🔐 SECURITY CONSIDERATIONS

### Pre-Mainnet QR Codes

**Riziko:** QR kódy jsou "sliby" - ne reálné tokeny
**Mitigation:**
- Clear messaging: "Vaše tokeny budou k dispozici po mainnet launch"
- Expiry date: 1 rok od vytvoření
- Email reminders před expirací
- KYC/AML pro presale (nad €15k)

### Private Keys

**Pre-Mainnet:**
- Privátní klíče se NEGENERUJÍ (QR kódy nejsou blockchain adresy)

**Mainnet:**
- Privátní klíče šifrovány AES-256-GCM
- Master key uložen v HSM nebo AWS KMS
- Backup strategie (3 kopie, offline storage)

### Smart Contract Escrow

**Critical:**
- Multi-sig control (3-of-5)
- Time-locked unlock (ne před mainnet launch)
- Rate limiting (max X tokenů za den)
- Emergency pause function
- Audit od CertiK / OpenZeppelin

---

## 📈 METRICS & MONITORING

### Dashboard KPIs

```sql
-- Total wallets by type
SELECT type, COUNT(*), SUM(tokens) 
FROM wallet_registry 
GROUP BY type;

-- Redemption rate
SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN status='redeemed' THEN 1 ELSE 0 END) as redeemed,
    ROUND(SUM(CASE WHEN status='redeemed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as rate_pct
FROM wallet_registry
WHERE network = 'pre_mainnet';

-- Expiring soon (< 30 days)
SELECT COUNT(*), SUM(tokens)
FROM wallet_registry
WHERE status = 'pending_redemption'
AND expires_at < DATE_ADD(NOW(), INTERVAL 30 DAY);
```

---

## 🚀 DEPLOYMENT TIMELINE

### December 2025
- [x] wallet-lib.php working (DONE)
- [ ] Create ZionWalletRegistry class
- [ ] Setup wallet_registry database table
- [ ] Integrate eShop → registry
- [ ] Integrate Presale → registry

### January 2026
- [ ] Python presale_wallet.py → PHP bridge
- [ ] Testnet wallet generation
- [ ] Admin dashboard for wallet management

### February - May 2026
- [ ] Smart contract development (escrow)
- [ ] Security audits
- [ ] Redemption API development
- [ ] Testing on testnet

### June 2026 - MAINNET LAUNCH
- [ ] Deploy genesis block
- [ ] Enable redemption API
- [ ] Email campaign: "Redeem your tokens!"
- [ ] Monitor redemption rate

### Post-Launch
- [ ] Expiry reminders (automated emails)
- [ ] Customer support for redemption issues
- [ ] Exchange listings
- [ ] Staking/DeFi integrations

---

## 💡 NEXT IMMEDIATE ACTIONS

1. **Fix email template** (dořešit sprintf bug) ← AKTUÁLNÍ
2. **Create ZionWalletRegistry class** ← PRIORITA #1
3. **Setup wallet_registry database** ← PRIORITA #2
4. **Update create-order.php** (use registry)
5. **Update presale-order.php** (use registry)

---

**Document Status:** DRAFT - Requires team review  
**Owner:** Omnity.One s.r.o.  
**Next Review:** Po dokončení Phase 1 integrace
