# ZION Presale - PHP + Python Integration Guide

> **Kompletní průvodce integrací presale backendu pro V2 EvoluZion web**

---

## 📋 Obsah

1. [Přehled systému](#přehled-systému)
2. [Architektura](#architektura)
3. [PHP API (existující)](#php-api-existující)
4. [Python FastAPI (nový)](#python-fastapi-nový)
5. [Frontend integrace](#frontend-integrace)
6. [Deployment](#deployment)
7. [Testing](#testing)
8. [Monitoring](#monitoring)

---

## Přehled systému

### Komponenty

| Vrstva | Technologie | Účel |
|--------|-------------|------|
| **Frontend** | HTML + JS (presale.html, presale.js) | Uživatelské rozhraní |
| **PHP API** | PHP 8.2 (wallet-lib, presale-order) | Wallet generování, ledger |
| **Python API** | FastAPI + SQLite (presale_endpoints.py) | Objednávky, statistiky |
| **Database** | SQLite + JSON files | Data persistence |
| **Payments** | Stripe API | Platební brána |
| **Blockchain** | ZION v3.1.0 | 16.78B premine, 500M presale |

### Data Flow

```
presale.html (user input)
    ↓
presale.js (validation)
    ↓
┌───────────────┐     ┌────────────────┐
│   PHP API     │ ←→  │  Python API    │
│ presale-order │     │ /presale/init  │
└───────┬───────┘     └────────┬───────┘
        │                      │
        ▼                      ▼
┌─────────────────────────────────┐
│     Stripe Checkout             │
└────────┬────────────────────────┘
         │ webhook
         ▼
┌─────────────────────────────────┐
│  stripe-webhook.php             │
│  • Update order status          │
│  • Generate wallet + QR         │
│  • Add to ledger (pending)      │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  MainNet Launch (Dec 31, 2026)  │
│  • Native wallet polls ledger   │
│  • Execute on-chain transfers   │
│  • Mark as sent (txHash)        │
└─────────────────────────────────┘
```

---

## PHP API (existující)

### Soubory

```
V2/api/
├── wallet-lib.php          # Core wallet funkcionalita
├── wallet-qr.php           # QR kód generátor API
├── wallet-ledger.php       # Ledger management API
├── presale-order.php       # Presale order handler
├── stripe-checkout.php     # Stripe session vytvoření
├── stripe-webhook.php      # Stripe webhook handler
├── create-order.php        # eShop orders (existující)
└── admin-orders.php        # Admin dashboard API
```

### Klíčové funkce

#### 1. Wallet Library (`wallet-lib.php`)

```php
function zion_generate_wallet(array $options): array
{
    // Generuje ZION wallet + QR kód
    // Ukládá do: V2/wallets/{walletId}.json
    // QR obrázek: V2/wallets/{walletId}.png
    
    return [
        'wallet' => [
            'id' => 'zw_...',
            'uri' => 'zion://wallet/...',
            'tokens' => 50000,
            'createdAt' => '...',
            'expiresAt' => '...'
        ],
        'qr' => [
            'serviceUrl' => 'https://quickchart.io/qr?...',
            'imageFile' => 'zw_...png',
            'dataUrl' => 'data:image/png;base64,...'
        ],
        'storage' => [
            'json' => 'zw_...json',
            'image' => 'zw_...png'
        ]
    ];
}
```

#### 2. Wallet Ledger (`wallet-ledger.php`)

```php
// GET: Načíst záznamy
GET /V2/api/wallet-ledger.php?status=pending&network=Mainnet

// POST: Aktualizovat status
POST /V2/api/wallet-ledger.php
{
    "id": "ledger_abc123",
    "status": "sent",
    "txHash": "0x...",
    "note": "Batch payout #1"
}
```

**Ledger struktura (`V2/wallets/ledger.json`):**

```json
[
  {
    "id": "ledger_001",
    "orderId": "PRESALE-123",
    "walletId": "zw_abc123",
    "walletUri": "zion://wallet/...",
    "qrImage": "zw_abc123.png",
    "tokens": 50000,
    "status": "pending",
    "network": "Mainnet",
    "source": "presale",
    "createdAt": "2025-12-02T12:00:00+00:00",
    "history": [...]
  }
]
```

#### 3. Presale Order (`presale-order.php`)

**Request:**

```bash
curl -X POST https://terranova.one/V2/api/presale-order.php \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com",
    "tokens": 50000,
    "priceEur": 400,
    "packageName": "Builder Pack",
    "paymentMethod": "stripe"
  }'
```

**Response:**

```json
{
  "success": true,
  "orderId": "PRESALE-1733145600-a1b2c3",
  "wallet": {
    "id": "zw_xyz789",
    "uri": "zion://wallet/zw_xyz789?tokens=50000&...",
    "tokens": 50000
  },
  "qr": {
    "serviceUrl": "https://quickchart.io/qr?...",
    "imageFile": "zw_xyz789.png"
  },
  "payment": {
    "variableSymbol": "1733145612",
    "bankDetails": {
      "recipient": "Omnity.One s.r.o.",
      "iban": "CZ63 2010 0000 0029 0180 9148"
    }
  }
}
```

---

## Python FastAPI (nový)

### API Endpoints

```
POST   /presale/status              # Aktuální statistiky
POST   /presale/purchase/init       # Vytvoření objednávky + Stripe session
POST   /presale/webhook/stripe      # Stripe webhook handler
GET    /presale/order/{order_id}    # Detail objednávky
GET    /presale/stats/admin         # Admin statistiky
```

### Databáze (SQLite)

**Schema (`data/presale.db`):**

```sql
-- Fáze presale
CREATE TABLE presale_phases (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    price_eur REAL NOT NULL,
    allocation INTEGER NOT NULL,
    sold INTEGER DEFAULT 0,
    bonus_percentage REAL NOT NULL
);

-- Objednávky
CREATE TABLE presale_orders (
    id INTEGER PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    amount_eur REAL NOT NULL,
    zion_tokens INTEGER NOT NULL,
    phase_id INTEGER,
    payment_method TEXT,
    stripe_session_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (phase_id) REFERENCES presale_phases(id)
);

-- Peněženky
CREATE TABLE presale_wallets (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL,
    wallet_address TEXT UNIQUE NOT NULL,
    encrypted_private_key TEXT,
    qr_code_path TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES presale_orders(id)
);

-- Distribuce (unlock schedule)
CREATE TABLE presale_distributions (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL,
    wallet_address TEXT NOT NULL,
    zion_amount INTEGER NOT NULL,
    unlock_date TEXT,
    unlock_percentage REAL NOT NULL,
    status TEXT DEFAULT 'locked',
    tx_hash TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES presale_orders(id)
);
```

### Python ↔ PHP Synchronizace

**Sync script:**

```bash
# Import PHP orders → Python DB
python scripts/sync_php_python_presale.py --mode=import

# Export Python DB → PHP JSON
python scripts/sync_php_python_presale.py --mode=export

# Bidirectional sync
python scripts/sync_php_python_presale.py --mode=sync

# Dry run (bez zápisů)
python scripts/sync_php_python_presale.py --mode=sync --dry-run
```

**Cron job (automatická synchronizace každou hodinu):**

```bash
0 * * * * cd /var/www/Zion-3.1 && python scripts/sync_php_python_presale.py --mode=sync >> /var/log/presale-sync.log 2>&1
```

---

## Frontend integrace

### presale.js - API Switcher

**Dual API support (PHP + Python):**

```javascript
const PRESALE_API = {
    php: {
        order: './api/presale-order.php',
        ledger: './api/wallet-ledger.php'
    },
    python: {
        status: '/presale/status',
        init: '/presale/purchase/init',
        order: (id) => `/presale/order/${id}`
    }
};

// Pro bankovní převod → PHP
async function createOrderBankTransfer(formData) {
    const response = await fetch(PRESALE_API.php.order, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: formData.email,
            tokens: formData.tokens,
            priceEur: formData.priceEur,
            packageName: formData.packageName,
            paymentMethod: 'transfer'
        })
    });
    
    return await response.json();
}

// Pro Stripe checkout → Python
async function createOrderStripe(formData) {
    const response = await fetch(PRESALE_API.python.init, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: formData.email,
            amount_eur: formData.priceEur,
            tokens: formData.tokens,
            phase_id: getCurrentPhaseId(),
            payment_method: 'stripe'
        })
    });
    
    const data = await response.json();
    
    if (data.checkout_url) {
        // Redirect to Stripe Checkout
        window.location.href = data.checkout_url;
    }
    
    return data;
}
```

### Real-time statistiky

```javascript
// Polling každých 30 sekund
setInterval(async () => {
    const stats = await fetch('/presale/status').then(r => r.json());
    
    // Update UI
    document.getElementById('tokens-sold').textContent = 
        formatNumber(stats.total_sold);
    
    document.getElementById('presale-progress').textContent = 
        `${stats.progress_percentage.toFixed(1)}%`;
    
    // Update progress bar
    document.querySelector('.progress-fill').style.width = 
        `${stats.progress_percentage}%`;
}, 30000);
```

### Order tracking

```javascript
// Po úspěšné platbě
async function showOrderDetails(orderId) {
    const order = await fetch(`/presale/order/${orderId}`)
        .then(r => r.json());
    
    // Display order info
    const html = `
        <h3>Objednávka ${order.order_id}</h3>
        <p>Email: ${order.email}</p>
        <p>ZION tokeny: ${formatNumber(order.zion_tokens)}</p>
        <p>Cena: €${order.amount_eur}</p>
        <p>Status: ${order.status}</p>
        
        ${order.wallet ? `
            <div class="wallet-info">
                <h4>ZION Wallet</h4>
                <p>Adresa: ${order.wallet.wallet_address}</p>
                <img src="/wallets/${order.wallet.qr_code_path}" 
                     alt="QR Code" />
            </div>
        ` : ''}
    `;
    
    document.getElementById('order-details').innerHTML = html;
}
```

---

## Deployment

### 1. Nginx Konfigurace

```nginx
server {
    listen 443 ssl http2;
    server_name terranova.one;
    
    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/terranova.one/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/terranova.one/privkey.pem;
    
    # PHP root
    root /var/www/public_html/V2;
    index presale.html index.html;
    
    # PHP API endpoints
    location ~ ^/V2/api/.*\.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
    
    # Python FastAPI (presale backend)
    location /presale/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files (wallets, QR codes)
    location /wallets/ {
        alias /var/www/public_html/V2/wallets/;
        expires 30d;
        access_log off;
    }
}
```

### 2. Python FastAPI Service

**systemd service (`/etc/systemd/system/zion-presale.service`):**

```ini
[Unit]
Description=ZION Presale FastAPI
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/Zion-3.1
Environment="PATH=/var/www/Zion-3.1/venv/bin"
ExecStart=/var/www/Zion-3.1/venv/bin/uvicorn api.presale_endpoints:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Start service:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable zion-presale
sudo systemctl start zion-presale
sudo systemctl status zion-presale
```

### 3. Environment Variables

**`.env` file:**

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_XXXXXXXXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXX
STRIPE_PUBLISHABLE_KEY=pk_live_XXXXXXXXXXXXXXXX

# Database
PRESALE_DB_PATH=data/presale.db
PRESALE_ENCRYPTION_KEY_PATH=data/presale_encryption_key.bin

# Network
ZION_NETWORK=Mainnet
MAINNET_LAUNCH_DATE=2026-12-31

# API
API_BASE_URL=https://terranova.one
PHP_API_URL=https://terranova.one/V2/api
```

---

## Testing

### 1. PHP API Test

```bash
# Test wallet generation
curl -X POST http://localhost/V2/api/wallet-qr.php \
  -H 'Content-Type: application/json' \
  -d '{
    "label": "Test Wallet",
    "amountTokens": 1000,
    "orderId": "TEST-001"
  }'

# Test presale order
curl -X POST http://localhost/V2/api/presale-order.php \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test@example.com",
    "tokens": 50000,
    "priceEur": 400,
    "packageName": "Test Package"
  }'
```

### 2. Python API Test

```bash
# Run test suite
python -m pytest tests/test_presale_flow.py -v

# Expected output:
# ✅ test_presale_config
# ✅ test_database_setup
# ✅ test_order_creation
# ✅ test_payment_confirmation
# ✅ test_wallet_generation
# ✅ test_unlock_schedule
# ✅ test_order_query
```

### 3. Sync Test

```bash
# Dry run sync
python scripts/sync_php_python_presale.py --mode=sync --dry-run

# Expected output:
# 🔄 Import PHP orders → Python DB
#   ✅ Imported: PRESALE-123 (50000 ZION)
# 🔄 Import PHP ledger → Python distributions
#   ✅ Created distributions for: PRESALE-123
# 🔄 Export Python DB → PHP JSON
#   ✅ Exported: PRESALE-456
# ✅ Synchronization complete!
```

### 4. Stripe Webhook Test

**Stripe CLI:**

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Listen to webhooks
stripe listen --forward-to localhost/V2/api/stripe-webhook.php

# Trigger test event
stripe trigger checkout.session.completed
```

---

## Monitoring

### Prometheus Metrics

**Add to `api/presale_endpoints.py`:**

```python
from prometheus_client import Counter, Histogram

# Metrics
presale_orders_total = Counter('presale_orders_total', 'Total presale orders')
presale_revenue_eur = Counter('presale_revenue_eur', 'Total revenue in EUR')
presale_tokens_sold = Counter('presale_tokens_sold', 'Total ZION tokens sold')
presale_api_duration = Histogram('presale_api_duration_seconds', 'API response time')

@app.post("/presale/purchase/init")
async def init_purchase(request: InitPurchaseRequest):
    with presale_api_duration.time():
        # ... existing code ...
        presale_orders_total.inc()
        presale_revenue_eur.inc(request.amount_eur)
        presale_tokens_sold.inc(tokens)
```

### Grafana Dashboard

**Queries:**

```promql
# Total revenue
sum(presale_revenue_eur)

# Orders per hour
rate(presale_orders_total[1h]) * 3600

# Average order value
sum(rate(presale_revenue_eur[5m])) / sum(rate(presale_orders_total[5m]))

# API latency (95th percentile)
histogram_quantile(0.95, presale_api_duration_seconds)
```

---

## Troubleshooting

### Issue: PHP ledger not found

```bash
# Create wallets directory
mkdir -p public_html/V2/wallets
chmod 755 public_html/V2/wallets

# Initialize empty ledger
echo '[]' > public_html/V2/wallets/ledger.json
chmod 644 public_html/V2/wallets/ledger.json
```

### Issue: Python API not accessible

```bash
# Check service status
sudo systemctl status zion-presale

# Check logs
sudo journalctl -u zion-presale -f

# Test direct access
curl http://127.0.0.1:8000/presale/status
```

### Issue: Stripe webhook signature verification failed

```php
// In stripe-webhook.php, add debug logging
error_log('Stripe signature: ' . $sigHeader);
error_log('Payload: ' . $payload);
error_log('Secret: ' . STRIPE_WEBHOOK_SECRET);
```

---

## Next Steps

1. **Week 1:** Deploy Python FastAPI + Nginx proxy
2. **Week 2:** Frontend API switcher implementation
3. **Week 3:** Admin dashboard upgrade
4. **Week 4:** Production testing + go-live

---

**Documentation Version:** 1.0  
**Last Updated:** 2025-12-02  
**Author:** ZION Development Team  
**Status:** ✅ Ready for Implementation
