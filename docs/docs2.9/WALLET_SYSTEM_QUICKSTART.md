# 🚀 ZION Wallet System - Quick Start Guide

**Vytvořeno:** 4. prosince 2025  
**Verze:** 2.9.0 "Quantum Leap"  
**Status:** 🚀 PRODUCTION READY

---

## 📋 Obsah

1. [Co je nového](#co-je-nového)
2. [Instalace a setup](#instalace-a-setup)
3. [Testování (DRY RUN)](#testování-dry-run)
4. [Mainnet Launch](#mainnet-launch)
5. [Troubleshooting](#troubleshooting)
6. [API Reference](#api-reference)

---

## 🎯 Co je nového

### Unified Wallet Registry System

Nový centrální systém propojující **TŘI** dříve oddělené wallet systémy:

| Systém | Před | Po |
|--------|------|-----|
| **PHP** (eShop) | Samostatné QR kódy v `V2/wallets/` | ✅ Synchronizováno přes registry |
| **Python** (Presale) | Oddělená `presale_db.py` databáze | ✅ Synchronizováno přes registry |
| **Blockchain** | Bez integrace | ✅ Reálné blockchain adresy |

### Hlavní features

✅ **Unified Wallet IDs** - Jedinečné ID napříč všemi systémy  
✅ **Cross-system Sync** - Automatická synchronizace PHP ↔ Python ↔ Blockchain  
✅ **Pre-mainnet QR** - QR kódy jako "IOUs" před mainnet launch  
✅ **Post-mainnet Blockchain** - Převod na skutečné blockchain adresy  
✅ **Automatic Payout** - Automatické vyplácení při mainnet launch  
✅ **Audit Trail** - Kompletní historie všech operací  

---

## 🔧 Instalace a setup

### 1. Prerekvizity

```bash
# Python 3.10+
python3 --version

# Existující ZION dependencies (již máte)
# - src/database/optimized_db.py
# - src/core/presale_wallet.py
# - wallet/__init__.py
```

### 2. Inicializace Registry

```bash
# Přejít do wallet modulu
cd src/wallet

# Inicializovat databázi
python3 wallet_registry.py
```

**Output:**
```
============================================================
ZION WALLET REGISTRY - INITIALIZATION TEST
============================================================

✅ Registry initialized at: data/test_wallet_registry.db
✅ PHP wallet dir: public_html/V2/wallets
✅ PHP ledger file: public_html/V2/wallets/ledger.json

✅ Tables created: 5
   - wallet_registry
   - wallet_redemptions
   - wallet_transactions
   - wallet_sync_log
   - sqlite_sequence

✅ Views created: 3
   - v_active_wallets_by_type
   - v_pending_redemptions
   - v_wallet_balance_summary

============================================================
✅ ALL TESTS PASSED
============================================================
```

### 3. Synchronizace existujících wallets

```bash
# Spustit Python shell
python3
```

```python
from wallet_registry import ZionWalletRegistry

# Vytvořit registry
registry = ZionWalletRegistry(db_path="data/wallet_registry.db")

# Synchronizovat z PHP (eShop bonusy)
php_synced = registry.sync_from_php_ledger()
print(f"✅ Synced {php_synced} PHP wallets")

# Synchronizovat z presale DB
presale_synced = registry.sync_from_presale_db("data/presale.db")
print(f"✅ Synced {presale_synced} presale wallets")

# Zobrazit statistiky
stats = registry.get_wallet_balance_summary()
for row in stats:
    print(f"  {row['wallet_type']}: {row['wallet_count']} wallets, {row['allocated_tokens']:,} ZION")
```

---

## 🧪 Testování (DRY RUN)

**DŮLEŽITÉ:** Vždy NEJDŘÍV testovat s `--dry-run`!

### Test 1: Presale Payout

```bash
cd src/wallet
python3 presale_payout_automation.py --dry-run
```

**Co to dělá:**
- ✅ Načte všechny presale wallets (500M Dharma Credits celkem)
- ✅ Validuje data
- ✅ Simuluje batch processing
- ✅ Simuluje blockchain transakce
- ✅ Generuje report
- ❌ **NEPROVEDE** skutečné transakce

**Očekávaný output:**
```
================================================================================
PHASE 1: INITIALIZATION
================================================================================
✅ Found 42 presale wallets
✅ Total tokens to distribute: 8,400,000 ZION

================================================================================
PHASE 2: VALIDATION
================================================================================
✅ All 42 wallets validated successfully

... (další fáze) ...

================================================================================
✅ PRESALE PAYOUT COMPLETED SUCCESSFULLY!
================================================================================
Total wallets processed: 42
Total tokens distributed: 8,400,000 ZION
Success rate: 100.00%
Total duration: 12.45 seconds
================================================================================
```

### Test 2: Bonus Payout

```bash
python3 eshop_bonus_automation.py --dry-run
```

**Co to dělá:**
- ✅ Načte všechny eShop bonus wallets (9-390 ZION)
- ✅ Kategorizuje (Standard/Premium/VIP)
- ✅ Zkontroluje expirované (1 rok)
- ✅ Simuluje batch processing (200 tx/batch)
- ✅ Generuje report

### Test 3: Complete Mainnet Launch

```bash
python3 mainnet_launch_orchestrator.py --dry-run
```

**Co to dělá:**
- ✅ Pre-launch checks (databáze, blockchain RPC, adresáře)
- ✅ Synchronizace všech systémů
- ✅ Statistiky (přehled všech wallets)
- ✅ **Paralelní** spuštění presale + bonus payoutů
- ✅ Post-launch verification
- ✅ Kompletní report (JSON + TXT)

**Očekávaný output:**
```
================================================================================
█████████████████████████████████████████████████████████████████████████████
█                                                                           █
█           ZION MAINNET LAUNCH - COMPLETE PAYOUT ORCHESTRATOR             █
█                                                                           █
█████████████████████████████████████████████████████████████████████████████
================================================================================

Mode: 🧪 DRY RUN (Simulation)
...

✅ ✅ ✅  MAINNET LAUNCH PAYOUT COMPLETED SUCCESSFULLY!  ✅ ✅ ✅
📊 Total wallets: 1,234
💰 Total tokens: 125,000,000 ZION
✅ Success rate: 100.00%
⏱️  Duration: 5.23 minutes

🎉 WELCOME TO ZION MAINNET! 🎉
```

---

## 🚀 Mainnet Launch

### Kdy spustit?

Spustit **JEDNOU** při oficiálním mainnet launch, až:

1. ✅ Blockchain běží na mainnetu
2. ✅ Všechny dry-run testy prošly
3. ✅ Escrow contract deploynut
4. ✅ DAO treasury připravena
5. ✅ Email systém funkční
6. ✅ Tým připraven (support hotline)

### Postup

#### Krok 1: Finální synchronizace

```bash
cd src/wallet
python3
```

```python
from wallet_registry import ZionWalletRegistry

registry = ZionWalletRegistry(db_path="data/wallet_registry.db")

# Finální sync
php_synced = registry.sync_from_php_ledger()
presale_synced = registry.sync_from_presale_db("data/presale.db")

print(f"Total wallets: {php_synced + presale_synced}")

# Zobrazit statistiky
stats = registry.get_wallet_balance_summary()
for row in stats:
    print(f"{row['wallet_type']}: {row['wallet_count']} wallets, {row['allocated_tokens']:,} ZION")

# Ukončit (Ctrl+D)
```

#### Krok 2: Spustit LIVE payout

```bash
# POZOR: Toto provede SKUTEČNÉ blockchain transakce!
python3 mainnet_launch_orchestrator.py \
    --registry-db ../data/wallet_registry.db \
    --rpc-url http://localhost:8545
```

**Potvrzení:**
```
⚠️  WARNING: LIVE MODE - REAL BLOCKCHAIN TRANSACTIONS!
⚠️  This will:
⚠️    - Unlock escrow contracts
⚠️    - Transfer tokens from treasury
⚠️    - Convert ALL pre-mainnet wallets to blockchain addresses
⚠️    - Send email notifications to customers

Type 'LAUNCH MAINNET' to proceed: 
```

**Napsat:** `LAUNCH MAINNET` (přesně!)

#### Krok 3: Sledovat progress

Payout běží v 6 fázích:

```
🔍 PHASE 1: PRE-LAUNCH CHECKS
   ✅ Registry database accessible (1,234 wallets)
   ✅ Blockchain RPC: http://localhost:8545
   ✅ Directory exists: data
   ✅ All 4 pre-launch checks passed!

🔄 PHASE 2: REGISTRY SYNCHRONIZATION
   ✅ Synced 856 wallets from PHP
   ✅ Synced 378 wallets from presale DB

📊 PHASE 3: STATISTICS OVERVIEW
   ESHOP_BONUS: 856 wallets, 45,234 ZION
   PRESALE: 378 wallets, 87,500,000 ZION
   TOTAL: 1,234 wallets, 87,545,234 ZION

🚀 PHASE 4: PARALLEL PAYOUT EXECUTION
   [PRESALE] Processing 378 wallets in 8 batches...
   [BONUS]   Processing 856 wallets in 5 batches...
   ... (progress updates) ...

✅ PHASE 5: POST-LAUNCH VERIFICATION
   ✅ PRESALE: 378/378 (87,500,000 ZION)
   ✅ BONUS: 856/856 (45,234 ZION)

📄 PHASE 6: FINAL REPORT GENERATION
   ✅ Reports saved:
      - JSON: reports/mainnet_launch_complete_20251204_143522.json
      - TXT:  reports/mainnet_launch_complete_20251204_143522.txt
```

#### Krok 4: Ověření

```bash
# Zkontrolovat report
cat reports/mainnet_launch_complete_*.txt

# Zkontrolovat registry
python3
```

```python
from wallet_registry import ZionWalletRegistry
registry = ZionWalletRegistry(db_path="data/wallet_registry.db")

# Zkontrolovat status
with registry.get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT status, COUNT(*) FROM wallet_registry GROUP BY status")
    for row in cursor.fetchall():
        print(f"{row[0]}: {row[1]}")
```

**Očekávaný output:**
```
active: 1234
redeemed: 0
expired: 0
suspended: 0
```

---

## 🔥 Troubleshooting

### Problem 1: "Registry database not found"

**Řešení:**
```bash
cd src/wallet
python3 wallet_registry.py  # Inicializuje databázi
```

### Problem 2: "No presale wallets found"

**Řešení:**
```python
from wallet_registry import ZionWalletRegistry
registry = ZionWalletRegistry()
synced = registry.sync_from_presale_db("data/presale.db")
print(f"Synced: {synced}")
```

### Problem 3: "Blockchain connection failed"

**Řešení:**
```bash
# Zkontrolovat blockchain RPC
curl http://localhost:8545 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Nebo použít dry-run
python3 mainnet_launch_orchestrator.py --dry-run
```

### Problem 4: "Expired wallets"

**Info:** Bonusy expirují po 1 roce. To je normální.

```python
# Zobrazit expirované
from wallet_registry import ZionWalletRegistry
registry = ZionWalletRegistry()

with registry.get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("""
        SELECT wallet_id, tokens, customer_email, expires_at
        FROM wallet_registry
        WHERE status = 'expired'
    """)
    for row in cursor.fetchall():
        print(dict(row))
```

### Problem 5: "Transaction failed"

**Rollback:**

Orchestrator má automatický emergency rollback. Pokud selže:

```bash
# Zkontrolovat log
tail -f mainnet_launch_payout.log

# Ruční rollback (pokud potřeba)
python3
```

```python
from wallet_registry import ZionWalletRegistry
registry = ZionWalletRegistry()

# Reset všech wallets zpět na pending_redemption
with registry.get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE wallet_registry
        SET status = 'pending_redemption',
            blockchain_address = NULL,
            activated_at = NULL
        WHERE status = 'processing'
    """)
    conn.commit()
```

---

## 📚 API Reference

### ZionWalletRegistry

```python
from wallet_registry import ZionWalletRegistry, WalletType, NetworkType, WalletStatus

registry = ZionWalletRegistry(db_path="data/wallet_registry.db")
```

#### Methods

**Create Wallets:**
```python
# eShop bonus
wallet = registry.create_eshop_bonus_wallet(
    tokens=144,
    order_id="ORD-12345",
    customer_email="customer@example.com",
    customer_name="John Doe",
    label="eShop Bonus"
)

# Presale
wallet = registry.create_presale_wallet(
    tokens=100_000,
    order_id="PRESALE-001",
    customer_email="investor@example.com",
    customer_name="Jane Investor",
    presale_phase="Phase 1"
)

# Blockchain (po mainnet)
wallet = registry.create_blockchain_wallet(
    wallet_type=WalletType.DAO_REWARD,
    tokens=5000,
    customer_email="dao@example.com",
    label="DAO Governance Reward"
)
```

**Query Wallets:**
```python
# Get by ID
wallet = registry.get_wallet("zw_abc123...")

# Get by email
wallets = registry.get_wallets_by_email("customer@example.com")

# Get by order
wallets = registry.get_wallets_by_order("ORD-12345")

# Get pending redemptions
pending = registry.get_pending_redemptions()

# Get balance summary
summary = registry.get_wallet_balance_summary()
```

**Sync:**
```python
# Sync from PHP
php_count = registry.sync_from_php_ledger()

# Sync from presale DB
presale_count = registry.sync_from_presale_db("data/presale.db")
```

**Redemption:**
```python
# Redeem QR to blockchain
result = registry.redeem_qr_to_blockchain(
    qr_wallet_id="zw_abc123...",
    target_blockchain_address="ZION1234...",
    customer_password="secure_password"
)
```

### Automation Classes

```python
from presale_payout_automation import ZionPresalePayoutAutomation
from eshop_bonus_automation import ZionEshopBonusAutomation
from mainnet_launch_orchestrator import ZionMainnetLaunchOrchestrator

# Presale
presale = ZionPresalePayoutAutomation(dry_run=True)
results = await presale.execute_full_payout()

# Bonus
bonus = ZionEshopBonusAutomation(dry_run=True)
results = await bonus.execute_bonus_payout()

# Complete orchestrator
orchestrator = ZionMainnetLaunchOrchestrator(dry_run=True)
results = await orchestrator.execute_complete_payout()
```

---

## 📊 Database Schema

### wallet_registry

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-increment ID |
| wallet_id | TEXT UNIQUE | Jedinečné ID (zw_xxx nebo blockchain address) |
| blockchain_address | TEXT | Blockchain adresa (NULL pro pre-mainnet) |
| private_key_encrypted | TEXT | Encrypted private key |
| wallet_type | TEXT | Type: eshop_bonus, presale, dao_reward, etc. |
| network | TEXT | pre_mainnet, testnet, mainnet |
| tokens | INTEGER | Počet ZION tokenů |
| actual_balance | INTEGER | Reálný balance na blockchainu |
| source_order_id | TEXT | ID objednávky |
| customer_email | TEXT | Email zákazníka |
| status | TEXT | generated, active, redeemed, expired, etc. |
| created_at | TEXT | Timestamp vytvoření |
| expires_at | TEXT | Expirace (bonusy: 1 rok) |
| activated_at | TEXT | Kdy se stalo aktivní |
| redeemed_at | TEXT | Kdy se QR převedlo na blockchain |

### wallet_redemptions

Audit trail pro QR → blockchain převody.

### wallet_transactions

Historie všech transakcí.

### wallet_sync_log

Log synchronizací mezi systémy.

---

## 🎯 Best Practices

### ✅ DO

- ✅ Vždy testovat s `--dry-run` NEJDŘÍV
- ✅ Synchronizovat před každým payoutem
- ✅ Zkontrolovat statistiky před spuštěním
- ✅ Mít záložní RPC node
- ✅ Monitorovat logy během payoutu
- ✅ Uložit reports pro audit

### ❌ DON'T

- ❌ Spustit live payout bez dry-run testu
- ❌ Spustit payout 2x (duplicitní transakce!)
- ❌ Ignorovat validation errors
- ❌ Spustit bez blockchain RPC connection
- ❌ Zapomenout na backup databáze

---

## 📞 Support

**Pro otázky a problémy:**

- 📧 Email: yosef.hubalek@gmail.com
- 📁 Logs: `mainnet_launch_payout.log`, `presale_payout.log`, `eshop_bonus_payout.log`
- 📊 Reports: `reports/mainnet_launch_complete_*.json`

---

## 🎉 Závěr

Wallet systém je připraven na mainnet launch! Proces je:

1. ✅ Otestovat vše v dry-run módu
2. ✅ Finální synchronizace
3. ✅ Spustit orchestrator
4. ✅ Sledovat progress
5. ✅ Ověřit výsledky
6. ✅ 🚀 **ZION MAINNET IS LIVE!**

**Hodně štěstí s launche! 🚀**

---

*Dokumentace vytvořena: 4. prosince 2025*  
*ZION Blockchain v2.9.0 "Quantum Leap"*
