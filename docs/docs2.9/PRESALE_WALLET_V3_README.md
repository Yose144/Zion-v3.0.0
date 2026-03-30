# ZION Presale Wallet System V3 🔐

## Přehled

**Verze 3.0** presale wallet systému generuje **skutečné blockchain peněženky** s:

✅ **12-slovní BIP39 mnemonic phrases** (seed pro obnovu)  
✅ **Ed25519 keypairs** (ZION native cryptography)  
✅ **Bech32 adresy** (zion1... formát)  
✅ **Šifrovaná databáze** (AES-256-GCM)  
✅ **QR kódy s recovery daty**  
✅ **MainNet airdrop ready** (automatická distribuce po launch)

---

## Architektura

```
┌─────────────────────────────────────────────────────────┐
│              PHP Presale Frontend (V2)                  │
│  (public_html/V2/presale.html + presale-order.php)     │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP POST
                     ▼
┌─────────────────────────────────────────────────────────┐
│         Python Wallet API V3 (FastAPI)                  │
│            api/wallet_api_v3.py                          │
│         Port: 5556   Auth: API Secret                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│      Wallet Generator + Crypto (presale_wallet_v3.py)   │
│  • BIP39 Mnemonic (12 words)                            │
│  • Ed25519 Keypair                                       │
│  • Bech32 Address (zion1...)                            │
│  • QR Code Generation                                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│     Encrypted SQLite Database                           │
│   data/presale_wallets_v3/presale_wallets.db            │
│  • Mnemonic (AES-256-GCM encrypted)                     │
│  • Private Key (encrypted)                               │
│  • Public Key, Address (plain)                          │
│  • Customer info + token allocation                      │
└─────────────────────────────────────────────────────────┘
```

---

## Komponenty

### 1. **Python Core** (`src/core/presale_wallet_v3.py`)

Hlavní wallet engine:

```python
from src.core.presale_wallet_v3 import PresaleWalletManager

manager = PresaleWalletManager()

wallet = manager.create_presale_wallet(
    order_id="PRESALE-1234",
    customer_email="user@example.com",
    customer_name="John Doe",
    tokens=100000,
    network="testnet"
)

print(f"Address: {wallet.address}")
print(f"Mnemonic: {wallet.mnemonic}")  # 12 words!
```

**Features:**
- `ZionWalletGenerator`: BIP39 + Ed25519 key derivation
- `WalletCrypto`: AES-256-GCM encryption/decryption
- `WalletQRGenerator`: QR codes s recovery informacemi
- `PresaleWalletDB`: SQLite databáze s šifrovaným úložištěm

### 2. **FastAPI Server** (`api/wallet_api_v3.py`)

REST API pro PHP backend:

**Spuštění:**
```bash
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main
python3 api/wallet_api_v3.py
```

**Endpoints:**

#### `POST /api/wallet/generate`
Generuje novou peněženku.

**Request:**
```json
{
  "orderId": "PRESALE-1234",
  "email": "user@example.com",
  "name": "John Doe",
  "tokens": 100000,
  "network": "testnet",
  "apiSecret": "zion_presale_secret_2025"
}
```

**Response:**
```json
{
  "success": true,
  "walletId": "zw_a1b2c3d4e5f6",
  "address": "zion1a2b3c4d5e6f7g8h9j0k1m2n3p4q5r6s7t8u9v0w1x2y3z4",
  "mnemonic": "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12",
  "publicKey": "0xabcdef...",
  "tokens": 100000,
  "qrImage": "zw_a1b2c3d4e5f6_recovery.png",
  "network": "testnet",
  "createdAt": "2025-12-18T21:00:00Z",
  "expiresAt": "2026-12-18T21:00:00Z"
}
```

#### `GET /api/wallet/export/{order_id}`
Export dat pro email zákazníkovi.

**Headers:**
```
X-API-Secret: zion_presale_secret_2025
```

**Response:**
```json
{
  "success": true,
  "address": "zion1...",
  "mnemonic": "word1 word2 ... word12",
  "tokens": 100000,
  "qrImage": "zw_xxx.png",
  "qrUrl": "/V2/wallets/zw_xxx.png"
}
```

#### `GET /api/stats`
Statistiky presale walletů.

### 3. **PHP Integration** (`public_html/V2/api/wallet-lib-v3.php`)

PHP wrapper pro Python API:

```php
require_once __DIR__ . '/wallet-lib-v3.php';

// Generuj wallet
$result = zion_generate_wallet_v3([
    'label' => 'Builder Pack',
    'tokens' => 62500,
    'orderId' => 'PRESALE-1234',
    'customerEmail' => 'user@example.com',
    'customerName' => 'John Doe'
]);

$wallet = $result['wallet'];
echo "Address: " . $wallet['address'] . "\n";
echo "Mnemonic: " . $wallet['mnemonic'] . "\n";
```

---

## Databáze

### SQLite Schema

**Tabulka: `presale_wallets`**

| Pole | Typ | Popis |
|------|-----|-------|
| `id` | INTEGER | Primary key |
| `wallet_id` | TEXT | Internal ID (zw_xxx) |
| `order_id` | TEXT | Presale order ID |
| `customer_email` | TEXT | Email zákazníka |
| `customer_name` | TEXT | Jméno |
| **`encrypted_mnemonic`** | BLOB | **Šifrovaná seed phrase** |
| **`mnemonic_nonce`** | BLOB | **Nonce pro dešifrování** |
| `encrypted_private_key` | BLOB | Šifrovaný privátní klíč |
| `private_key_nonce` | BLOB | Nonce |
| `public_key` | TEXT | Veřejný klíč (plain) |
| **`address`** | TEXT | **zion1... adresa** |
| `tokens` | INTEGER | Počet ZION tokenů |
| `network` | TEXT | testnet / mainnet |
| `status` | TEXT | pending / distributed |
| `created_at` | TEXT | ISO timestamp |
| `qr_image` | TEXT | Jméno QR souboru |

**Šifrování:**
- Master key: `data/presale_wallets_v3/master.key` (AES-256)
- Algoritmus: AES-GCM (authenticated encryption)
- ⚠️ **BACKUP MASTER KEY IMMEDIATELY!** Ztráta = ztráta všech walletů!

---

## Email Template

V emailech zákazníkům se nyní posílá:

```
🔐 Vaše ZION peněženka

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 ADRESA
zion1a2b3c4d5e6f7g8h9j0k1m2n3p4q5r6s7t8u9v0w1x2y3z4

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 SEED PHRASE (12 SLOV) - ULOŽTE BEZPEČNĚ!

word1  word2  word3  word4
word5  word6  word7  word8
word9  word10 word11 word12

⚠️ NIKDY NIKOMU NESDÍLEJTE!
⚠️ UCHOVÁTE OFFLINE (papír, trezor)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 TOKENY: 100,000 ZION

[QR KÓD PRO IMPORT]
```

**Placeholders v email template:**
- `{{ZION_ADDRESS}}` - Blockchain adresa
- `{{ZION_MNEMONIC}}` - 12-word seed phrase
- `{{ZION_AMOUNT}}` - Počet tokenů
- `{{QR_CODE_SECTION}}` - QR kód obrázek

---

## Instalace

### 1. Python Dependencies

```bash
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main

# Aktivuj virtualenv
source .venv/bin/activate

# Install dependencies
pip install mnemonic fastapi uvicorn cryptography qrcode[pil] pillow
```

### 2. Start Wallet API

```bash
# Lokálně (port 5556)
python3 api/wallet_api_v3.py

# Nebo na pozadí
nohup python3 api/wallet_api_v3.py > logs/wallet_api_v3.log 2>&1 &
```

**Ověření:**
```bash
curl http://localhost:5556/health
# {"status":"healthy","service":"ZION Presale Wallet API","version":"3.0.0"}
```

### 3. Update PHP Presale

Už hotovo! Soubory aktualizovány:
- ✅ `public_html/V2/api/wallet-lib-v3.php`
- ✅ `public_html/V2/api/presale-order.php` (používá V3)
- ✅ `public_html/V2/api/email-template-helper.php` (mnemonic placeholder)

### 4. Upload na produkční server

```bash
# Upload Python modulu
scp -P 20002 \
  src/core/presale_wallet_v3.py \
  api/wallet_api_v3.py \
  ssh-685961@dw214.webglobe.com:~/zion/

# Upload PHP integration
scp -P 20002 \
  public_html/V2/api/wallet-lib-v3.php \
  public_html/V2/api/presale-order.php \
  public_html/V2/api/email-template-helper.php \
  ssh-685961@dw214.webglobe.com:~/public_html/V2/api/

# SSH a spusť API
ssh -p 20002 ssh-685961@dw214.webglobe.com
cd ~/zion
python3 wallet_api_v3.py &
```

---

## MainNet Airdrop

Po spuštění ZION MainNetu (31.12.2026):

### 1. Export všech pending walletů

```python
from src.core.presale_wallet_v3 import PresaleWalletDB

db = PresaleWalletDB()
pending = db.get_all_pending_wallets()

print(f"Pending wallets: {len(pending)}")
for w in pending:
    print(f"{w['address']}: {w['tokens']:,} ZION")
```

### 2. Automatická distribuce

```python
from src.wallet.presale_payout_automation import PresalePayoutOrchestrator

orchestrator = PresalePayoutOrchestrator(
    blockchain_rpc="http://localhost:18081",
    sender_wallet="ZION_PRESALE_TREASURY"
)

# Rozešle tokeny na všechny adresy
orchestrator.distribute_all_presale_tokens()
```

### 3. Mark as distributed

```python
for wallet in pending:
    db.mark_distributed(
        wallet_id=wallet['wallet_id'],
        tx_hash="0xabc..."
    )
```

---

## Bezpečnost

### ⚠️ KRITICKÉ SOUBORY (BACKUP!)

1. **Master encryption key:**
   ```
   data/presale_wallets_v3/master.key
   ```
   Ztráta = ztráta všech seed phrases!

2. **SQLite databáze:**
   ```
   data/presale_wallets_v3/presale_wallets.db
   ```
   Obsahuje všechny zákaznické wallety (šifrované).

3. **Backup strategie:**
   ```bash
   # Denní automatický backup
   tar -czf backup_$(date +%Y%m%d).tar.gz \
     data/presale_wallets_v3/ \
     public_html/V2/wallets/*.png
   
   # Upload do cloudu
   scp backup_*.tar.gz user@backup-server:/backups/zion/
   ```

### 🔒 Security Best Practices

- ✅ Master key má permissions `600` (read/write owner only)
- ✅ Databáze šifrována AES-256-GCM (authenticated encryption)
- ✅ API vyžaduje secret header (`X-API-Secret`)
- ✅ Mnemonic phrases NIKDY v plain text logs
- ✅ Email přes TLS/SSL (SMTP secure)
- ✅ QR kódy uloženy mimo veřejný web root (pokud možno)

---

## Testing

```bash
# Test wallet generation
python3 src/core/presale_wallet_v3.py

# Test API
python3 api/wallet_api_v3.py &
curl -X POST http://localhost:5556/api/wallet/generate \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "TEST-001",
    "email": "test@example.com",
    "name": "Test User",
    "tokens": 10000,
    "network": "testnet",
    "apiSecret": "zion_presale_secret_2025"
  }'

# Check database
sqlite3 data/presale_wallets_v3/presale_wallets.db \
  "SELECT wallet_id, address, tokens, status FROM presale_wallets;"
```

---

## Changelog

### v3.0.0 (18.12.2025)
- ✨ **BIP39 mnemonic phrases** (12 words)
- ✨ **Real Ed25519 keypairs**
- ✨ **Bech32 addresses** (zion1...)
- ✨ **Encrypted SQLite database**
- ✨ **QR codes with recovery data**
- ✨ **FastAPI integration**
- ✨ **MainNet airdrop ready**
- 🔧 Fixed presale email sending wrong wallet format
- 🔒 AES-256-GCM encryption for sensitive data

### v2.0 (Previous)
- ❌ Only URI schemes (zion://wallet/ID)
- ❌ No mnemonic phrases
- ❌ No real blockchain addresses

---

## Support

**Developer:** ZION Team  
**Contact:** admin@zionterranova.com  
**Website:** https://zionterranova.com

🌟 **"Where technology meets spirit"** 🌟
