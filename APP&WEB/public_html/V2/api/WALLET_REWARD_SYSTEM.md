# ZION Wallet Reward System

> Kompletní dokumentace backend systému pro správu tokenových bonusů, QR peněženek a ledgeru dlužných tokenů.

---

## Obsah

1. [Přehled systému](#přehled-systému)
2. [Architektura](#architektura)
3. [Datové struktury](#datové-struktury)
4. [API Reference](#api-reference)
5. [Workflow objednávky](#workflow-objednávky)
6. [Ledger – správa dlužných tokenů](#ledger--správa-dlužných-tokenů)
7. [Integrace s nativní peněženkou](#integrace-s-nativní-peněženkou)
8. [Konfigurace a nasazení](#konfigurace-a-nasazení)
9. [Příklady použití](#příklady-použití)
10. [Rozšíření a migrace](#rozšíření-a-migrace)

---

## Přehled systému

ZION Wallet Reward System poskytuje:

- **Automatický výpočet tokenových bonusů** při nákupu (1 ZION za každých 100 Kč nebo explicitně definovaná hodnota `tokens` u produktu).
- **Generování unikátních peněženek** s QR kódy pro snadné načtení v mobilní/desktopové aplikaci.
- **Ledger dlužných tokenů** – databáze všech nevyplacených bonusů, kterou lze po testnet fázi hromadně zpracovat.
- **REST API** pro listing, filtrování a aktualizaci stavu payoutů.

### Klíčové vlastnosti

| Funkce | Popis |
|--------|-------|
| QR generátor | Volá externí službu (QuickChart) a ukládá PNG + JSON metadata |
| Ledger | Flat-file JSON databáze s auditní historií změn |
| Status workflow | `pending` → `queued` → `sent` / `failed` |
| Síťová podpora | `testnet` (výchozí) nebo `mainnet` |
| E-mail integrace | QR odkazy jsou automaticky vkládány do potvrzovacích e-mailů |

---

## Architektura

```
┌─────────────────────────────────────────────────────────────────┐
│                         ZION eShop                              │
│  (checkout.js → create-order.php)                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ POST order
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     create-order.php                            │
│  1. Validace & uložení objednávky                               │
│  2. Výpočet tokenového bonusu (calculateTokenSummary)           │
│  3. Generování peněženky (zion_generate_wallet)                 │
│  4. Zápis do ledgeru (zion_wallet_append_ledger_entry)          │
│  5. Odeslání e-mailů s QR                                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ orders/*.json │   │ wallets/*.json│   │ wallets/      │
│ (objednávky)  │   │ wallets/*.png │   │ ledger.json   │
└───────────────┘   └───────────────┘   └───────────────┘
                                                │
                                                ▼
                            ┌─────────────────────────────────────┐
                            │        wallet-ledger.php            │
                            │  GET  → listing / filtrování        │
                            │  POST → update status/txHash        │
                            └─────────────────────────────────────┘
                                                │
                                                ▼
                            ┌─────────────────────────────────────┐
                            │       Nativní ZION Wallet           │
                            │  (desktop/mobile)                   │
                            │  • Poll pending entries             │
                            │  • Execute on-chain transfer        │
                            │  • Mark as sent + txHash            │
                            └─────────────────────────────────────┘
```

---

## Datové struktury

### Wallet JSON (`wallets/{walletId}.json`)

```json
{
  "id": "zw_a1b2c3d4e5f6",
  "label": "ZION order ZTNABC123",
  "tokens": 42,
  "orderId": "ZTNABC123",
  "createdAt": "2025-01-05T10:20:30+00:00",
  "expiresAt": "2025-02-04T10:20:30+00:00",
  "uri": "zion://wallet/zw_a1b2c3d4e5f6?tokens=42&label=ZION+order+ZTNABC123&orderId=ZTNABC123",
  "qrServiceUrl": "https://quickchart.io/qr?size=320&margin=1&text=zion%3A%2F%2Fwallet%2F...",
  "qrImage": "zw_a1b2c3d4e5f6.png"
}
```

### Ledger Entry (`wallets/ledger.json` – pole záznamů)

```json
{
  "id": "ledger_8f3e2a1b",
  "orderId": "ZTNABC123",
  "walletId": "zw_a1b2c3d4e5f6",
  "walletUri": "zion://wallet/zw_a1b2c3d4e5f6?tokens=42&...",
  "qrImage": "zw_a1b2c3d4e5f6.png",
  "tokens": 42,
  "status": "pending",
  "network": "testnet",
  "source": "order",
  "createdAt": "2025-01-05T10:20:30+00:00",
  "updatedAt": "2025-01-05T10:20:30+00:00",
  "note": null,
  "txHash": null,
  "details": {
    "totalTokens": 42,
    "items": [
      { "id": "seed-001", "name": "PARAMAJOTI", "quantity": 2, "perUnit": 4, "total": 8 },
      { "id": "star-003", "name": "X-Wing", "quantity": 1, "perUnit": 15, "total": 15 },
      { "id": "digi-002", "name": "OnePage web", "quantity": 1, "perUnit": 49, "total": 49 }
    ]
  },
  "history": [
    { "status": "pending", "timestamp": "2025-01-05T10:20:30+00:00", "note": "Created from order #ZTNABC123" }
  ]
}
```

### Token Summary (vráceno v API odpovědi)

```json
{
  "totalTokens": 42,
  "items": [
    { "id": "seed-001", "name": "PARAMAJOTI", "quantity": 2, "perUnit": 4, "total": 8 }
  ]
}
```

### Statusy ledgeru

| Status | Význam |
|--------|--------|
| `pending` | Čeká na zpracování (výchozí po vytvoření) |
| `queued` | Zařazeno do fronty pro odeslání |
| `sent` | Tokeny úspěšně odeslány (obsahuje `txHash`) |
| `failed` | Odeslání selhalo – vyžaduje manuální řešení |

---

## API Reference

### `POST /V2/api/wallet-qr.php`

Generuje novou peněženku s QR kódem.

#### Request

```json
{
  "label": "Camp 2025 drop",
  "amountTokens": 25,
  "orderId": "ORD-2025-0001",
  "expiresInHours": 168
}
```

| Pole | Typ | Povinné | Popis |
|------|-----|---------|-------|
| `label` | string | ✓ | Popisek peněženky (min 3 znaky) |
| `amountTokens` / `tokens` | int | ✓ | Počet tokenů |
| `orderId` | string | – | Vazba na objednávku |
| `expiresInHours` | int | – | Platnost (výchozí 720 h = 30 dní) |

#### Response

```json
{
  "success": true,
  "wallet": {
    "id": "zw_ab12cd34ef56",
    "label": "Camp 2025 drop",
    "tokens": 25,
    "orderId": "ORD-2025-0001",
    "createdAt": "2025-01-05T10:20:30+00:00",
    "expiresAt": "2025-01-12T10:20:30+00:00",
    "uri": "zion://wallet/zw_ab12cd34ef56?tokens=25&label=Camp+2025+drop&orderId=ORD-2025-0001"
  },
  "qr": {
    "serviceUrl": "https://quickchart.io/qr?...",
    "imageFile": "zw_ab12cd34ef56.png",
    "dataUrl": "data:image/png;base64,..."
  },
  "storage": {
    "json": "zw_ab12cd34ef56.json",
    "image": "zw_ab12cd34ef56.png"
  }
}
```

---

### `POST /V2/api/create-order.php`

Vytvoří objednávku, vygeneruje wallet + QR, zapíše ledger entry a odešle e-maily.

#### Request

```json
{
  "orderId": "ZTNABC123",
  "items": [
    { "id": "seed-001", "name": "PARAMAJOTI", "price": 390, "quantity": 2, "tokens": 4 }
  ],
  "customer": {
    "name": "Jan Novák",
    "email": "jan@example.com",
    "phone": "+420123456789",
    "address": null
  },
  "shipping": { "method": "zasilkovna", "price": 69, "pickupPoint": null },
  "payment": "transfer",
  "total": 849,
  "note": "",
  "createdAt": "2025-01-05T10:20:30+00:00",
  "network": "testnet"
}
```

#### Response

```json
{
  "success": true,
  "orderId": "ZTNABC123",
  "message": "Objednávka byla úspěšně vytvořena",
  "emailSent": { "admin": true, "customer": true },
  "zion": {
    "tokens": { "totalTokens": 8, "items": [...] },
    "wallet": { "id": "zw_...", "uri": "zion://wallet/...", ... },
    "qr": { "serviceUrl": "...", "imageFile": "...", "dataUrl": "..." },
    "storage": { "json": "...", "image": "..." },
    "network": "testnet",
    "ledger": { "id": "ledger_...", "status": "pending", ... }
  }
}
```

---

### `GET /V2/api/wallet-ledger.php`

Vrací seznam ledger záznamů.

#### Query parametry

| Parametr | Popis |
|----------|-------|
| `id` | Vrátí jeden konkrétní záznam |
| `status` | Filtr podle statusu (lze více oddělených čárkou: `pending,queued`) |
| `network` | Filtr podle sítě (`testnet` / `mainnet`) |

#### Příklad

```
GET /V2/api/wallet-ledger.php?status=pending&network=testnet
```

#### Response

```json
{
  "success": true,
  "count": 3,
  "entries": [...],
  "stats": {
    "totalTokens": 142,
    "byStatus": { "pending": 100, "queued": 42 }
  },
  "statusOptions": ["pending", "queued", "sent", "failed"]
}
```

---

### `POST /V2/api/wallet-ledger.php`

Aktualizuje ledger záznam (status, txHash, network, note).

#### Request

```json
{
  "id": "ledger_8f3e2a1b",
  "status": "sent",
  "txHash": "0xabc123def456...",
  "network": "mainnet",
  "note": "Batch payout #2025-03"
}
```

#### Response

```json
{
  "success": true,
  "entry": {
    "id": "ledger_8f3e2a1b",
    "status": "sent",
    "txHash": "0xabc123def456...",
    "updatedAt": "2025-03-10T08:15:00+00:00",
    "history": [...]
  }
}
```

---

## Workflow objednávky

```
┌──────────────┐
│  Zákazník    │
│  checkout    │
└──────┬───────┘
       │ POST order
       ▼
┌──────────────────────────────────────┐
│         create-order.php             │
│  1. Validace vstupů                  │
│  2. Uložení orders/{orderId}.json    │
│  3. calculateTokenSummary()          │
│  4. zion_generate_wallet()           │
│     → wallets/{walletId}.json        │
│     → wallets/{walletId}.png         │
│  5. zion_wallet_append_ledger_entry()│
│     → wallets/ledger.json            │
│  6. Sestavení & odeslání e-mailů     │
│  7. JSON response                    │
└──────────────────────────────────────┘
```

### Výpočet tokenů

```php
function calculateTokenSummary(array $items): array
{
    foreach ($items as $item) {
        $unitTokens = $item['tokens'] ?? max(1, round($item['price'] / 100));
        $lineTokens = $unitTokens * $item['quantity'];
        // ...
    }
}
```

Pokud produkt má explicitně definované pole `tokens`, použije se. Jinak se počítá jako `ceil(price / 100)`.

---

## Ledger – správa dlužných tokenů

Ledger je JSON pole uložené v `V2/wallets/ledger.json`. Každý záznam sleduje:

- **Identifikaci** (`id`, `orderId`, `walletId`)
- **Hodnotu** (`tokens`, `details`)
- **Stav** (`status`, `network`)
- **Metadata** (`createdAt`, `updatedAt`, `note`, `txHash`)
- **Auditní historii** (`history[]`)

### Příklad ledger.json

```json
[
  {
    "id": "ledger_001",
    "orderId": "ZTN123",
    "walletId": "zw_aaa111",
    "tokens": 25,
    "status": "pending",
    "network": "testnet",
    "history": [
      { "status": "pending", "timestamp": "2025-01-01T00:00:00+00:00", "note": "Created" }
    ]
  },
  {
    "id": "ledger_002",
    "orderId": "ZTN456",
    "walletId": "zw_bbb222",
    "tokens": 100,
    "status": "sent",
    "txHash": "0xdef...",
    "network": "mainnet",
    "history": [
      { "status": "pending", "timestamp": "2025-01-02T00:00:00+00:00", "note": "Created" },
      { "status": "sent", "timestamp": "2025-03-01T12:00:00+00:00", "note": "Batch #3" }
    ]
  }
]
```

---

## Integrace s nativní peněženkou

### Doporučený flow

```
┌─────────────────────────────────────────────────────────┐
│                    Testnet fáze                         │
│  • Všechny objednávky generují ledger s network=testnet │
│  • QR kódy lze skenovat, ale tokeny nejsou reálné       │
│  • Ověřování UX bez finančního rizika                   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Přechod na mainnet                    │
│  1. Změnit výchozí network v create-order.php           │
│     nebo posílat network=mainnet z frontendu            │
│  2. Nativní wallet načte pending záznamy:               │
│     GET wallet-ledger.php?status=pending                │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Hromadný payout (batch)                    │
│  Pro každý ledger entry:                                │
│  1. Dekódovat walletUri → cílová adresa + tokeny        │
│  2. Provést on-chain transfer                           │
│  3. POST wallet-ledger.php                              │
│     { "id": "...", "status": "sent", "txHash": "0x..." }│
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Archivace                             │
│  • Záznamy se statusem "sent" zůstávají v ledgeru       │
│  • Lze je exportovat do databáze nebo smazat            │
│  • Historie poskytuje auditní stopu                     │
└─────────────────────────────────────────────────────────┘
```

### Pseudokód pro nativní wallet

```typescript
// 1. Načti pending záznamy
const response = await fetch('/V2/api/wallet-ledger.php?status=pending&network=mainnet');
const { entries } = await response.json();

// 2. Zpracuj každý záznam
for (const entry of entries) {
  try {
    // Parsuj wallet URI
    const { walletId, tokens } = parseWalletUri(entry.walletUri);
    
    // Proveď on-chain transfer
    const txHash = await blockchain.transfer({
      to: walletId, // nebo jiná cílová adresa
      amount: tokens
    });
    
    // 3. Označ jako odesláno
    await fetch('/V2/api/wallet-ledger.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: entry.id,
        status: 'sent',
        txHash,
        note: `Automated payout ${new Date().toISOString()}`
      })
    });
  } catch (error) {
    // Označ jako failed
    await fetch('/V2/api/wallet-ledger.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: entry.id,
        status: 'failed',
        note: error.message
      })
    });
  }
}
```

---

## Konfigurace a nasazení

### Požadavky

- PHP 8.0+
- `allow_url_fopen = On` (pro QuickChart QR službu)
- Zapisovatelné složky: `V2/orders/`, `V2/wallets/`

### Konstanty (`wallet-lib.php`)

```php
define('ZION_WALLET_STORAGE_DIR', __DIR__ . '/../wallets');
define('ZION_WALLET_LEDGER_FILE', ZION_WALLET_STORAGE_DIR . '/ledger.json');
```

### Přepnutí na mainnet

V `create-order.php` změňte výchozí síť:

```php
$network = $order['network'] ?? 'mainnet'; // bylo 'testnet'
```

Nebo posílejte `network` z frontendu v checkout payloadu.

### QR služba

Výchozí: `https://quickchart.io/qr`

Pro vlastní službu upravte v `wallet-lib.php`:

```php
$qrService = $options['qrService'] ?? 'https://your-qr-service.com/generate';
```

### Zabezpečení

- Přidejte autorizaci na `wallet-ledger.php` POST endpoint (API klíč, JWT, HTTP Basic Auth).
- Zakažte přímý přístup k `wallets/ledger.json` přes `.htaccess`:

```apache
<Files "ledger.json">
    Require all denied
</Files>
```

---

## Příklady použití

### Vytvoření standalone peněženky (bez objednávky)

```bash
curl -X POST https://newearth.cz/V2/api/wallet-qr.php \
  -H 'Content-Type: application/json' \
  -d '{
    "label": "Promo bonus Q1 2025",
    "amountTokens": 50,
    "expiresInHours": 720
  }'
```

### Načtení všech pending záznamů pro testnet

```bash
curl 'https://newearth.cz/V2/api/wallet-ledger.php?status=pending&network=testnet'
```

### Označení záznamu jako odeslaný

```bash
curl -X POST https://newearth.cz/V2/api/wallet-ledger.php \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "ledger_8f3e2a1b",
    "status": "sent",
    "txHash": "0xabc123...",
    "network": "mainnet",
    "note": "Manual payout"
  }'
```

### Zobrazení konkrétního ledger záznamu

```bash
curl 'https://newearth.cz/V2/api/wallet-ledger.php?id=ledger_8f3e2a1b'
```

---

## Rozšíření a migrace

### Migrace na databázi

Ledger je navržen jako flat-file pro jednoduchost. Pro větší provoz:

1. Vytvořte tabulku `zion_ledger` s odpovídajícími sloupci.
2. Nahraďte `zion_wallet_load_ledger()` a `zion_wallet_save_ledger()` SQL dotazy.
3. Historie může být uložena jako JSON sloupec nebo normalizovaná tabulka.

### Webhook notifikace

Po změně statusu na `sent` lze odeslat webhook:

```php
function notifyWebhook(array $entry): void {
    $webhookUrl = 'https://your-service.com/zion-payout-hook';
    $ch = curl_init($webhookUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($entry));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_exec($ch);
    curl_close($ch);
}
```

### Dávkové zpracování (cron)

```bash
# Každou hodinu zkontroluj a zpracuj pending záznamy
0 * * * * /usr/bin/php /var/www/V2/scripts/process-ledger.php >> /var/log/zion-ledger.log 2>&1
```

---

## Struktura souborů

```
V2/
├── api/
│   ├── create-order.php      # Vytvoření objednávky + wallet + ledger
│   ├── wallet-qr.php         # Standalone generátor QR peněženek
│   ├── wallet-ledger.php     # API pro správu ledgeru
│   ├── wallet-lib.php        # Sdílené helpery a konstanty
│   ├── README.md             # Stručná API dokumentace
│   └── WALLET_REWARD_SYSTEM.md  # Tento dokument
├── orders/
│   └── {orderId}.json        # Uložené objednávky
├── wallets/
│   ├── ledger.json           # Centrální databáze dlužných tokenů
│   ├── {walletId}.json       # Metadata jednotlivých peněženek
│   └── {walletId}.png        # QR kód obrázky
└── products.js               # Katalog produktů s tokens hodnotami
```

---

## Changelog

| Verze | Datum | Změny |
|-------|-------|-------|
| 1.0.0 | 2025-12-01 | Počáteční implementace: wallet generátor, ledger, API |

---

## Kontakt & podpora

- **E-mail:** admin@newearth.cz
- **GitHub:** https://github.com/Yose144/Zion-2.9
- **Web:** https://newearth.cz

---

*Tento dokument je součástí ZION Terra Nova projektu a je určen pro integraci s nativní ZION peněženkou.*
