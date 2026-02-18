# Trivi API Integration - Setup Guide

## 📋 Přehled

Automatické propojení ZION e-shopu s účetním systémem Trivi pro přenos faktur a dokladů.

### ✨ Funkce
- ✅ Automatické odesílání faktur do Trivi po vytvoření objednávky
- ✅ **Oddělené číselné řady pro e-shop a presale** (ZION-ESHOP-2026/0001 vs ZION-PRESALE-2026/0001)
- ✅ **Správný variabilní symbol z timestampu** (ORD-1736122900-abc → VS: 1736122900)
- ✅ **Admin panel integrace** - tlačítko "Odeslat do Trivi" v detailu objednávky
- ✅ **Auto-check statusu** při otevření objednávky v admin panelu
- ✅ Podpora zálohových plateb (pro presale)
- ✅ Daňové doklady k přijatým zálohám (DDPZ)
- ✅ Retry logika s exponenciálním backoff (3 pokusy)
- ✅ Detailní logování všech API volání
- ✅ Databázové sledování synchronizace
- ✅ Manuální resynchronizace failed objednávek

---

## 🚀 Instalace

### 1. Získání přístupových údajů

Kontaktujte **Jaroslava Ryvolu** (účetní konzultant Trivi) a vyžádejte si:

- **APP ID** - ID aplikace pro API autentizaci
- **APP SECRET** - Tajný klíč pro API
- **finAccount kategorie** - Seznam účetních kategorií (povinné!)
- **Testovací prostředí** - Credentials pro testování

### 2. Konfigurace .env

Přidejte do `public_html/V2/api/.env`:

```bash
# Trivi Accounting System Integration
TRIVI_APP_ID=your_app_id_here
TRIVI_APP_SECRET=your_app_secret_here

# Test Mode (true = test, false = production)
TRIVI_TEST_MODE=true

# finAccount Categories (JSON format)
# Získat od Trivi konzultanta
TRIVI_FIN_ACCOUNTS={"eshop_sales":"FA123","shipping":"FA456","payment_fee":"FA789","zion_tokens":"FA012"}

# Bank Account (pro faktury)
BANK_ACCOUNT=2901809148/2010
```

### 3. Testování integrace

```bash
cd public_html/V2/api
php test-trivi-api.php
```

Výstup by měl ukázat:
```
✅ Configuration valid
✅ Authentication successful
✅ Order mapping successful
✅ Integration service initialized
```

---

## 📚 Použití

### Admin Panel - Manuální odeslání

**Nejjednodušší způsob použití:**

1. Přihlásit se do **admin panelu** (https://newearth.cz/V2/admin.html)
2. Otevřít **detail objednávky**
3. Zobrazí se sekce **"Trivi Účetní Systém"** s auto-check statusu
4. Kliknout tlačítko **"Odeslat do Trivi"** (zelené)
5. Potvrdí se vytvoření faktury

**Status indikátory:**
- 🟢 **Zelená** - Synchronizováno (zobrazí Trivi ID + číslo dokladu)
- 🔴 **Červená** - Synchronizace selhala (zobrazí chybu + tlačítko "Zkusit znovu")
- ⚪ **Šedá** - Nebylo odesláno

### Automatická integrace v create-order.php

Po vytvoření objednávky se automaticky odešle do Trivi:

```php
// V create-order.php (AUTOMATICKY - už implementováno)
require_once __DIR__ . '/trivi-integration-service.php';

$triviService = new TriviIntegrationService();
$triviResult = $triviService->processOrder($order, $isAdvancePayment = false);

if ($triviResult['success']) {
    // Faktura úspěšně odeslána do Trivi
    $triviId = $triviResult['trivi_id'];
} else {
    // Chyba - loguje se automaticky, objednávka pokračuje
    error_log("Trivi sync failed: " . $triviResult['error']);
}
```

### Manuální resynchronizace přes API

Pro opětovné odeslání failed objednávek:

```php
$service = new TriviIntegrationService();

// Resync specific order
$result = $service->resyncFailedOrders('ORD-1736122900-abc123');

// Resync all failed orders
$result = $service->resyncFailedOrders();

print_r($result);
// ['total' => 3, 'success' => 2, 'failed' => 1, 'details' => [...]]
```

---

## 📊 Struktura dat

### Invoice (Faktura)

**E-shop invoice number:** `ZION-ESHOP-2026/0001`  
**Presale invoice number:** `ZION-PRESALE-2026/0001`  
**Variable symbol:** `1736122900` (10-digit timestamp z order ID)

```json
{
  "invoice_number": "ZION-ESHOP-2026/0001",
  "variable_symbol": "1736122900",
  "issue_date": "2026-01-06",
  "due_date": "2026-01-20",
  "date_of_taxable_supply": "2026-01-06",
  
  "customer": {
    "name": "Test Customer",
    "email": "test@example.com",
    "phone": "+420123456789",
    "address": {
      "street": "Test Street 123",
      "city": "Prague",
      "zip": "12000",
      "country": "CZ"
    }
  },
  
  "items": [
    {
      "name": "Test Product",
      "quantity": 2,
      "unit_price_with_vat": 100,
      "unit_price_without_vat": 82.64,
      "vat_rate": 0.21,
      "vat_amount": 34.72,
      "total_with_vat": 200,
      "fin_account": "FA123"
    }
  ],
  
  "totals": {
    "subtotal_without_vat": 222.31,
    "vat_amount": 46.69,
    "total_with_vat": 269
  },
  
  "payment": {
    "method": "bank_transfer",
    "bank_account": "2901809148/2010"
  },
  
  "currency": "CZK",
  "exchange_rate": 1.0
}
```

### Advance Payment (Záloha)

```json
{
  "advance_number": "ZA-2026/0001",
  "variable_symbol": "1736122900",
  "issue_date": "2026-01-06",
  "payment_date": "2026-01-06",
  
  "customer": { ... },
  
  "amount": 269,
  "currency": "CZK"
}
```

---

## 🔧 Technické detaily

### Soubory

```
public_html/V2/api/
├── trivi-config.php                 # Konfigurace (APP ID, SECRET, endpoints, číselné řady)
├── trivi-api-connector.php          # REST API klient (autentizace, HTTP requesty)
├── trivi-order-mapper.php           # Převod objednávek na Trivi formát
├── trivi-integration-service.php    # Hlavní orchestrátor (business logika)
├── trivi-admin-api.php              # Admin API endpoint (sync_order, check_status)
└── test-trivi-api.php               # Testovací script

public_html/V2/
├── admin.html                       # Admin panel s Trivi tlačítky
├── data/trivi_sync.db               # SQLite databáze (sync tracking)
└── logs/
    ├── trivi-api.log                # API requesty & responses
    └── trivi-integration.log        # High-level sync events
```

### Database Schema (trivi_sync.db)

```sql
CREATE TABLE trivi_sync (
    id INTEGER PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE,
    trivi_id TEXT,
    document_type TEXT,           -- 'invoice_eshop', 'invoice_presale', 'advance', 'tax_doc'
    document_number TEXT,          -- 'ZION-ESHOP-2026/0001' nebo 'ZION-PRESALE-2026/0001'
    sequence_number INTEGER,       -- 1, 2, 3... (continuous series - oddělené pro eshop/presale)
    status TEXT,                   -- 'success', 'failed', 'pending'
    error_message TEXT,
    request_data TEXT,             -- JSON
    response_data TEXT,            -- JSON
    created_at DATETIME,
    updated_at DATETIME
);
```

### Retry Logic

1. **First attempt:** Immediate
2. **Retry 1:** 1 second delay
3. **Retry 2:** 3 seconds delay
4. **Retry 3:** 10 seconds delay

Retryable errors:
- HTTP 5xx (server errors)
- HTTP 429 (rate limit)
- Network timeouts
- cURL errors

### Error Handling

- ❌ **Authentication failed** → Skip Trivi sync, log error, continue order
- ❌ **Configuration invalid** → Skip Trivi sync, log error, continue order
- ❌ **API error** → Retry 3x, log to DB, mark as 'failed'
- ❌ **Mapping error** → Log error, mark as 'failed'

**Důležité:** Chyba v Trivi integrace **NIKDY** nezbortí objednávku! Objednávka se vždy vytvoří, Trivi sync je sekundární.

---

## 📋 Požadavky Trivi

### ✅ MUST HAVE

1. **Souvislé číselné řady** - Faktury/zálohy/DDZ oddělené řady (ZION-2026/0001, ZION-2026/0002...)
2. **Unikátní variabilní symboly** - Každá objednávka = jeden VS (timestamp z order ID)
3. **Country (země odběratele)** - POVINNÉ pole! Default: 'CZ'
4. **Výpočet ceny "shora"** - S DPH → Bez DPH (implementováno)
5. **Kurzy ČNB T-1** - Pro cizí měny (TODO: implement ČNB API)
6. **Jedna platba = jeden doklad = jeden VS** - Žádné hromadné připisování

### ⚠️ Pravidla

- ❌ **Nepovolit hromadné připisování plateb** od zásilkových služeb
- ❌ **Nezapočtovávat** platby bez explicitního dokladu
- ✅ **DDPZ u nezaplacených záloh** - Pokud záloha není vyúčtována do konce měsíce → daňový doklad
- ✅ **Všechny doklady mají adresu** - Včetně hotovostních
- ✅ **finAccount kategorie** - Pro každou položku (prodej, doprava, poplatky...)

---

## 🐛 Debugging

### Zkontrolovat logy

```bash
# API requesty
tail -f public_html/V2/logs/trivi-api.log

# Integration events
tail -f public_html/V2/logs/trivi-integration.log
```

### Zkontrolovat DB sync status

```bash
sqlite3 public_html/V2/data/trivi_sync.db
> SELECT order_id, status, error_message FROM trivi_sync WHERE status = 'failed';
```

### Manuální resync

```php
// V admin panelu nebo CLI
$service = new TriviIntegrationService();
$result = $service->resyncFailedOrders();
echo json_encode($result, JSON_PRETTY_PRINT);
```

---

## 📞 Kontakty

- **Účetní konzultant:** Jaroslav Ryvola (Trivi)
- **Technická podpora:** Trivi Help Desk (max 2 hodiny zdarma)
- **Dokumentace:** https://developers.trivi.com/v2
- **Cena aktivace:** 2.980 Kč bez DPH (včetně testovacího prostředí)

---

## ✅ Checklist před spuštěním

- [ ] Získány APP ID a APP SECRET od Trivi
- [ ] Nakonfigurovány finAccount kategorie v .env
- [ ] Otestován `test-trivi-api.php` - všechny testy prošly
- [ ] Zkontrolována správnost customer adres (country field)
- [ ] Provedeno testovací odeslání na testovací firmu
- [ ] Ověřeno, že faktury v Trivi mají správné údaje
- [ ] Konzultován způsob propojení záloh s účetním (Jaroslav Ryvola)
- [ ] Odsouhlaseno datum zahájení ostrého účtování
- [ ] Nastavena monitorovací upozornění na failed syncs

---

**Autor:** ZION Team  
**Vytvořeno:** 6.1.2026  
**Verze:** 1.0  
**Status:** ✅ Ready for testing

