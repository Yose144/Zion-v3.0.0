# 🔧 ZION Premine System - Critical Fix Required

**Datum**: 14. ledna 2026  
**Priorita**: 🔴 KRITICKÁ  
**Status**: Blokuje presale/bonus distribuci

---

## 📋 Problém

### Současný stav
Premine systém v `src/core/premine.py` používá **placeholder stringy** místo skutečných blockchain adres:

```python
# ❌ ŠPATNĚ - placeholder stringy bez private keys
'ZION_PRESALE_MULTISIG_WALLET_2025_2026_LAUNCH': {...}
'ZION_MAITREYA_BUDDHA_DAO_ADMIN_D7A371ABD1FF1C5D42AB02': {...}
'ZION_SACRED_B0FA7E2A234D8C2F08545F02295C98': {...}
```

### Důsledky
1. **Nelze posílat transakce** z těchto adres (nemají private key)
2. **Presale distribuce nefunkční** - tokeny jsou "zamčené" na neexistujících adresách
3. **Bonus tokeny nelze vyplatit** - stejný problém
4. **Mining pool payouts** - consciousness bonus jde na nefunkční adresy

---

## 🎯 Navrhované řešení

### Fáze 1: Generování skutečných walletů (OKAMŽITĚ)

Pro každou premine adresu vygenerovat **skutečný zion1... wallet** s mnemonicem:

```
Premine účel                  | Nová zion1... adresa        | Private Key Storage
------------------------------|-----------------------------|-----------------------
PRESALE_MULTISIG              | zion1presale...             | HSM / Vault
MAITREYA_BUDDHA_DAO_ADMIN     | zion1maitreya...            | Cold wallet
DEVELOPMENT_TEAM_FUND         | zion1devteam...             | Multisig (3/5)
CHILDREN_FUTURE_FUND          | zion1children...            | Multisig (3/5)
OASIS_GAME_DEVELOPMENT        | zion1oasis...               | Multisig (3/5)
NETWORK_INFRASTRUCTURE        | zion1infra...               | Cold wallet
GENESIS_CREATOR_RENT          | zion1creator...             | Cold wallet
5x MINING_OPERATORS           | zion1mining1-5...           | Pool servers
3x DAO_WINNERS                | zion1dao1-3...              | Locked until 2035
```

### Fáze 2: Migrace struktury premine.py

```python
# ✅ SPRÁVNĚ - skutečné adresy s metadata
ZION_PREMINE_WALLETS = {
    'presale': {
        'address': 'zion1presale8a7f3c2d9e1b4k5m6n7p8q9r0s...',
        'mnemonic_hash': 'sha256:abc123...',  # Pro verifikaci (ne samotný mnemonic!)
        'amount': 500_000_000,
        'type': 'presale',
        'multisig': True,
        'signers': 3,
        'threshold': 2,
        # ... zbytek metadata
    },
    # ... ostatní
}
```

### Fáze 3: Genesis Block Reset (TestNet)

1. **Zastavit všechny nody**
2. **Smazat blockchain data** (SQLite/JSON)
3. **Aktualizovat premine.py** s novými adresami
4. **Restart blockchain** - nový genesis s reálnými adresami
5. **Sync všech poolů**

---

## 🔐 Bezpečnostní opatření

### Private Keys Management

```
┌─────────────────────────────────────────────────────────────┐
│  NIKDY NEUKLÁDAT PRIVATE KEYS V KÓDU NEBO REPU!            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Produkční řešení:                                         │
│  ├── HashiCorp Vault (development)                         │
│  ├── AWS KMS / Azure Key Vault (cloud)                     │
│  ├── Hardware Security Module - HSM (presale escrow)       │
│  └── Air-gapped cold wallet (admin accounts)               │
│                                                             │
│  TestNet (dočasně):                                        │
│  ├── Encrypted JSON soubor mimo repo                       │
│  └── Environment variables na serverech                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Multisig pro kritické fondy

| Fond | Signers | Threshold | Poznámka |
|------|---------|-----------|----------|
| Presale Escrow | 5 | 3 | Stripe payments → distribution |
| Development Fund | 5 | 3 | Quarterly releases |
| Children's Fund | 5 | 3 | DAO vote required |
| OASIS Game Fund | 5 | 3 | Milestone-based |

---

## 📝 Implementační kroky

### Krok 1: Generátor walletů (Python script)

```python
# scripts/generate_premine_wallets.py
from src.core.presale_wallet_v3 import ZionWalletGenerator

PREMINE_PURPOSES = [
    ('presale', 500_000_000),
    ('maitreya_admin', 1_000_000_000),
    ('development', 1_000_000_000),
    ('infrastructure', 1_000_000_000),
    ('children_fund', 1_000_000_000),
    ('creator_rent', 342_857_143),
    ('oasis_game', 1_440_000_000),
    ('dao_winner_1', 1_000_000_000),
    ('dao_winner_2', 500_000_000),
    ('dao_winner_3', 250_000_000),
    ('mining_sacred', 1_650_000_000),
    ('mining_quantum', 1_650_000_000),
    ('mining_cosmic', 1_650_000_000),
    ('mining_enlightened', 1_650_000_000),
    ('mining_transcendent', 1_650_000_000),
]

generator = ZionWalletGenerator()
wallets = {}

for purpose, amount in PREMINE_PURPOSES:
    wallet = generator.generate()
    wallets[purpose] = {
        'address': wallet['address'],
        'mnemonic': wallet['mnemonic'],  # ENCRYPT IMMEDIATELY!
        'public_key': wallet['public_key'],
        'amount': amount
    }
    print(f"✅ {purpose}: {wallet['address']}")

# Save encrypted to secure location (NOT in repo!)
```

### Krok 2: Aktualizace premine.py

```python
# src/core/premine.py - nová verze
ZION_PREMINE_ADDRESSES = {
    # Skutečné adresy (private keys v secure storage)
    'zion1presale8a7f3c2d9e1b4k5m6n7p8q9r0s...': {
        'purpose': 'Presale Escrow',
        'amount': 500_000_000,
        'type': 'presale',
        'alias': 'PRESALE_ESCROW',  # Pro zpětnou kompatibilitu
    },
    # ... atd
}

# Alias mapping pro zpětnou kompatibilitu
PREMINE_ALIASES = {
    'ZION_PRESALE_MULTISIG_WALLET_2025_2026_LAUNCH': 'zion1presale...',
    'ZION_MAITREYA_BUDDHA_DAO_ADMIN_D7A371ABD1FF1C5D42AB02': 'zion1maitreya...',
    # ...
}

def resolve_address(addr_or_alias: str) -> str:
    """Resolve alias to real address"""
    return PREMINE_ALIASES.get(addr_or_alias, addr_or_alias)
```

### Krok 3: Blockchain migrace

```bash
# Na všech serverech:
docker-compose down

# Smazat data
rm -rf data/blockchain.db data/blocks/

# Aktualizovat kód
git pull origin main

# Restart s novým genesis
docker-compose up -d
```

### Krok 4: Distribution API update

```php
// token-distribution.php
define('ZION_DISTRIBUTION_FROM_ADDRESS', 'zion1presale...');  // Skutečná adresa
define('ZION_RPC_TOKEN', getenv('ZION_RPC_TOKEN'));
```

---

## 🗓️ Timeline

| Fáze | Úkol | Deadline | Status |
|------|------|----------|--------|
| 1 | Vygenerovat 15 premine walletů | 15.1.2026 | ⏳ |
| 2 | Secure storage setup (Vault/encrypted) | 15.1.2026 | ⏳ |
| 3 | Aktualizovat premine.py | 16.1.2026 | ⏳ |
| 4 | TestNet reset (všechny 3 servery) | 16.1.2026 | ⏳ |
| 5 | Testovat presale distribuci | 17.1.2026 | ⏳ |
| 6 | Testovat bonus distribuci | 17.1.2026 | ⏳ |
| 7 | Mobile app import test | 18.1.2026 | ⏳ |

---

## ⚠️ Rizika a mitigace

| Riziko | Závažnost | Mitigace |
|--------|-----------|----------|
| Ztráta private keys | 🔴 Kritická | Encrypted backups na 3 lokacích + paper wallet |
| Únik mnemonic | 🔴 Kritická | HSM, nikdy v plaintextu, audit logging |
| Genesis fork | 🟡 Střední | Koordinovaný restart všech nodů |
| Zpětná kompatibilita | 🟡 Střední | Alias mapping pro staré reference |

---

## 📊 Verifikace po implementaci

```bash
# 1. Ověřit genesis zůstatky
curl -X POST http://localhost:8545 -d '{
  "method": "getbalance",
  "params": {"address": "zion1presale..."}
}'
# Očekáváno: 500,000,000 ZION

# 2. Test transakce z presale escrow
curl -X POST http://localhost:8545 -d '{
  "method": "sendtransaction", 
  "params": {
    "from": "zion1presale...",
    "to": "zion1customer...",
    "amount": 1000
  }
}'
# Očekáváno: tx_id + pending status

# 3. Ověřit po vytěžení bloku
# Customer balance: 1000 ZION
# Presale balance: 499,999,000 ZION
```

---

## 🎯 Závěr

Aktuální premine systém je **fundamentálně vadný** protože používá placeholder stringy místo skutečných blockchain adres. Oprava vyžaduje:

1. ✅ Vygenerovat 15 skutečných zion1... walletů
2. ✅ Bezpečně uložit private keys (HSM/Vault)
3. ✅ Aktualizovat premine.py
4. ✅ Reset TestNet blockchain
5. ✅ Testovat end-to-end distribuci

**Bez této opravy nelze distribuovat presale tokeny ani eShop bonusy!**

---

*Dokument vytvořen: 14.1.2026*  
*Autor: AI Agent*  
*Verze: 1.0*
