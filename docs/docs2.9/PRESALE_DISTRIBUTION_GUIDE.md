# 🎯 ZION Presale Token Distribution - Complete System

## 📋 Přehled

Automatický systém pro distribuci **500M ZION tokenů** z premine na presale adresy zákazníků po MainNet launch (31.12.2027).

### Klíčové vlastnosti:
- ✅ **Automatická distribuce** z presale premine adresy
- ✅ **Validace všech zion1 adres** před odesláním
- ✅ **Batch processing** (50 TX/batch, rate limiting)
- ✅ **Multi-signature** z presale premine
- ✅ **Kompletní audit trail** + email notifikace
- ✅ **Dry-run mode** pro testování

---

## 🏗️ Architektura

### 1. **Presale Database** (`data/presale.db`)
```sql
-- Ukládá všechny presale objednávky
presale_orders (
    order_id,
    customer_email,
    total_tokens,
    payment_status,
    distribution_status,
    ...
)

-- Ukládá vygenerované zion1 peněženky
presale_wallets (
    wallet_id,
    order_id,
    public_address,  -- zion1...
    private_key_encrypted,
    qr_code_path,
    ...
)

-- Sleduje distribuci
presale_distributions (
    order_id,
    transaction_hash,
    block_height,
    status,
    ...
)
```

### 2. **Blockchain** (`zion_mainnet_blockchain.db`)
```python
# Genesis block obsahuje 500M ZION presale allocation
PRESALE_PREMINE_ADDRESS = "zion1..." # Z premine.py

# Po MainNet launch:
blockchain.create_transaction(
    from_address=PRESALE_PREMINE_ADDRESS,
    to_address=customer_zion1_address,
    amount=total_tokens,
    purpose="Presale distribution"
)
```

### 3. **Distribution Manager** (`src/wallet/presale_distribution_manager.py`)
```python
# Hlavní orchestrator
manager = PresaleDistributionManager(
    presale_db_path="data/presale.db",
    blockchain_db_path="zion_mainnet_blockchain.db",
    dry_run=False  # True pro test
)

await manager.execute_distribution()
```

---

## 🚀 Použití

### Test (Dry Run):
```bash
# Zkouška bez skutečných transakcí
python3 src/wallet/presale_distribution_manager.py --dry-run

# Nebo přes shell script
./scripts/presale_distribution_launch.sh
```

### Produkční distribuce:
```bash
# ŽIVÝ režim - skutečné transakce!
python3 src/wallet/presale_distribution_manager.py

# Nebo přes shell script s potvrzením
./scripts/presale_distribution_launch.sh --live
```

### Cron job (automatické spuštění):
```bash
# Spustit 1.1.2028 00:00 UTC (po MainNet launch 31.12.2027)
crontab -e

# Přidat:
0 0 1 1 2028 /path/to/scripts/presale_distribution_launch.sh --live
```

---

## 📊 Proces distribuce

### Fáze 1: **Načtení objednávek**
```python
# Načte všechny zaplacené objednávky s peněženkami
SELECT o.*, w.public_address
FROM presale_orders o
JOIN presale_wallets w ON o.order_id = w.order_id
WHERE o.payment_status = 'paid'
AND w.public_address IS NOT NULL
```

### Fáze 2: **Validace**
```python
# Ověří každou objednávku:
- ✅ Validní zion1 adresa (44 znaků, bech32)
- ✅ Token amount > 0
- ✅ Token amount >= 10,000 (minimum)
- ✅ Celkem nepřekročí 500M allocation

# Výsledek:
valid_orders = [...]     # Připraveno k distribuci
invalid_orders = [...]   # Chyby k řešení
```

### Fáze 3: **Batch processing**
```python
# Rozdělí na batch po 50 transakcích
for batch in chunks(valid_orders, 50):
    for order in batch:
        # Vytvoří blockchain transakci
        tx = blockchain.create_transaction(
            from_address=PRESALE_PREMINE_ADDRESS,
            to_address=order.wallet_address,
            amount=order.total_tokens,
            purpose=f"Presale distribution - {order.order_id}"
        )
        
        # Aktualizuje DB
        update_distribution_status(
            order.order_id,
            status='processing',
            tx_hash=tx.id
        )
    
    # Rate limiting
    await asyncio.sleep(2.0)
```

### Fáze 4: **Čekání na konfirmace**
```python
# Čeká na 6 konfirmací pro každou transakci
for tx in transactions:
    while tx.confirmations < 6:
        await asyncio.sleep(10)
        tx.confirmations = blockchain.get_tx_confirmations(tx.hash)
    
    # Označit jako dokončeno
    update_distribution_status(
        tx.order_id,
        status='completed',
        tx_hash=tx.hash
    )
```

### Fáze 5: **Email notifikace**
```python
# Odešle email každému zákazníkovi
for order in completed_orders:
    send_email(
        to=order.customer_email,
        template='presale-confirmation-rasta.html',
        data={
            'ORDER_ID': order.order_id,
            'ZION_AMOUNT': order.total_tokens,
            'ZION_ADDRESS': order.wallet_address,
            'TX_HASH': order.tx_hash
        }
    )
```

---

## 🔐 Bezpečnost

### Multi-signature:
```python
# Presale premine adresa vyžaduje multi-sig
# (Definováno v premine.py)

PRESALE_PREMINE = {
    'zion1presale...': {
        'amount': 500_000_000,
        'type': 'presale',
        'multisig': True,
        'required_signatures': 3,
        'signers': [
            'zion1admin1...',
            'zion1admin2...',
            'zion1admin3...',
            'zion1admin4...',
            'zion1admin5...'
        ]
    }
}
```

### Rate limiting:
```python
# Max 100 TX per block
MAX_TX_PER_BLOCK = 100

# Batch processing: 50 TX + 2s delay
TX_BATCH_SIZE = 50
TX_BATCH_DELAY_SECONDS = 2.0
```

### Audit trail:
```python
# Každá distribuce logována do:
- presale_distributions table (DB)
- presale_distribution.log (file)
- distribution_results.json (summary)
```

---

## 📈 Monitoring

### Real-time log:
```bash
# Sledovat průběh
tail -f data/presale_distribution.log
```

### Výsledky:
```bash
# Po dokončení
cat data/distribution_results.json

{
  "success": true,
  "total_orders": 1234,
  "valid_orders": 1230,
  "invalid_orders": 4,
  "successful_distributions": 1225,
  "failed_distributions": 5,
  "total_tokens_distributed": 485000000,
  "duration_seconds": 1847.23
}
```

### Database check:
```sql
-- Zkontrolovat status
SELECT 
    distribution_status,
    COUNT(*) as count,
    SUM(total_tokens) as total_tokens
FROM presale_orders
GROUP BY distribution_status;

-- Výsledek:
-- pending    | 0    | 0
-- processing | 0    | 0
-- completed  | 1230 | 485000000
-- failed     | 5    | 250000
```

---

## ⚠️ Troubleshooting

### Problém: "Invalid wallet address"
```python
# Řešení: Zkontrolovat formát v presale_wallets
SELECT order_id, public_address 
FROM presale_wallets 
WHERE public_address NOT LIKE 'zion1%' 
OR LENGTH(public_address) != 44;

# Opravit manuálně nebo regenerovat
```

### Problém: "Presale allocation exceeded"
```python
# Řešení: Zkontrolovat celkový součet
SELECT SUM(total_tokens) FROM presale_orders WHERE payment_status = 'paid';

# Nesmí přesáhnout 500M
```

### Problém: "Transaction failed"
```python
# Řešení: Zkontrolovat blockchain log
tail -f zion_mainnet.log

# Opakovat failed transakce
python3 -c "
from src.wallet.presale_distribution_manager import PresaleDistributionManager
manager = PresaleDistributionManager()
await manager.retry_failed_distributions()
"
```

---

## 📝 Checklist před MainNet launch

- [ ] Presale DB existuje a je naplněná (`data/presale.db`)
- [ ] Všechny paid objednávky mají zion1 peněženky
- [ ] QR kódy vygenerovány a uloženy
- [ ] Email template připravena (`presale-confirmation-rasta.html`)
- [ ] SMTP nastaveno (`shop@newearth.cz`)
- [ ] Blockchain MainNet běží (`zion_mainnet_blockchain.db`)
- [ ] Presale premine adresa má 500M ZION v genesis
- [ ] Dry-run test úspěšný
- [ ] Cron job nastaven (1.1.2028 00:00 UTC)
- [ ] Monitoring připraven
- [ ] Admin notifikace fungují

---

## 📞 Kontakt

V případě problémů:
- **Email:** admin@newearth.cz
- **Log:** `data/presale_distribution.log`
- **Results:** `data/distribution_results.json`

---

**✅ Systém připraven k automatické distribuci po MainNet launch!**

**Datum vytvoření:** 9. prosince 2025  
**Verze:** 2.9.0  
**Status:** PRODUCTION READY
