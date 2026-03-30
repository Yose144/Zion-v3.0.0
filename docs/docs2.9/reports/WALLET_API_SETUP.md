# ZION Wallet Generation API - Setup Guide

## 🎯 Přehled

PHP backend volá Python API pro generování skutečných ZION walletů s QR kódy.

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   PHP Web   │ ──────> │ Python API   │ ──────> │ ZION Wallet │
│ (presale)   │  HTTP   │ (Flask)      │  Crypto │ + QR Code   │
└─────────────┘         └──────────────┘         └─────────────┘
```

## 📋 Požadavky

```bash
# Python 3.8+
python3 --version

# Potřebné balíčky
pip install flask flask-cors qrcode Pillow cryptography
```

## 🚀 Spuštění

### 1. Nainstalovat závislosti

```bash
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main

# Aktivovat virtual environment
source .venv/bin/activate

# Instalovat balíčky
pip install flask flask-cors qrcode Pillow cryptography
```

### 2. Spustit API server

```bash
# Základní spuštění
python3 api/wallet_api.py

# S vlastním portem
WALLET_API_PORT=5555 python3 api/wallet_api.py

# S debugem
DEBUG=true python3 api/wallet_api.py
```

### 3. Ověřit funkčnost

```bash
# Health check
curl http://localhost:5555/health

# Test generování walletu
curl -X POST http://localhost:5555/api/wallet/generate \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "tokens": 1000,
    "orderId": "TEST123",
    "apiSecret": "zion_presale_secret_2025"
  }'
```

## 🌐 Integrace s PHP

### PHP kód (už implementováno)

```php
// V2/api/wallet-generator.php
require_once __DIR__ . '/wallet-generator.php';

$wallet = generateZionWalletSafe(
    'customer@example.com',  // Email
    1000,                    // Tokens
    'ORDER123'               // Order ID
);

// $wallet obsahuje:
// - address: ZION_abc123...
// - privateKey: hex string
// - walletId: zw_ORDER123_abc12345
// - qrCodeUrl: http://localhost:5555/api/wallet/qr/ORDER123.png
// - isFake: false (true pokud Python API nedostupné)
```

### Automatický fallback

- **Python API běží** → generuje skutečné wallety + QR kódy
- **Python API neběží** → používá fake wallety pro testing

## 📁 Soubory

```
Zion-2.9-main/
├── api/
│   └── wallet_api.py              # Flask API server
├── public_html/V2/api/
│   ├── wallet-generator.php       # PHP wrapper
│   └── test-presale-debug.php     # Debug test tool
├── src/core/
│   └── presale_wallet.py          # Wallet generation logic
└── data/
    └── presale_qr_codes/          # Vygenerované QR kódy
```

## 🔧 Konfigurace

### Environment proměnné

```bash
# API port (default: 5555)
export WALLET_API_PORT=5555

# API secret pro autorizaci
export ZION_WALLET_API_SECRET="zion_presale_secret_2025"

# Debug mode
export DEBUG=true
```

### PHP konstanty (wallet-generator.php)

```php
define('WALLET_API_URL', 'http://localhost:5555/api/wallet/generate');
define('WALLET_API_SECRET', 'zion_presale_secret_2025');
define('WALLET_API_TIMEOUT', 30);
```

## 🧪 Testování

### 1. Spustit Python API

```bash
python3 api/wallet_api.py
```

### 2. Otevřít debug tool

```
https://newearth.cz/V2/debug-presale.html
```

### 3. Vyplnit formulář a odeslat

- Email: test@example.com
- Částka: 1000 CZK
- Test Mode: Full test

### 4. Zkontrolovat výsledek

- ✅ Order ID vytvořen
- ✅ ZION adresa začíná `ZION_`
- ✅ QR kód vygenerován
- ✅ Emaily odeslány
- ✅ `isFakeWallet: false` (pokud Python běží)

## 🐛 Troubleshooting

### Python API nereaguje

```bash
# Zkontrolovat, jestli běží
curl http://localhost:5555/health

# Zkontrolovat logy
# Mělo by zobrazit: "Running on http://0.0.0.0:5555"
```

### PHP dostává fake wallety

- Python API neběží nebo není dostupný
- Zkontrolovat URL v `wallet-generator.php`
- Zkontrolovat firewall/network

### QR kódy se negenerují

```bash
# Instalovat Pillow
pip install Pillow qrcode

# Zkontrolovat permissions
chmod 755 data/presale_qr_codes/
```

## 🔒 Bezpečnost

### Production nastavení

1. **Změnit API secret**
   ```php
   define('WALLET_API_SECRET', 'super_secret_production_key');
   ```

2. **Používat HTTPS**
   ```php
   define('WALLET_API_URL', 'https://api.zionterranova.com/wallet/generate');
   ```

3. **Firewall pravidla**
   ```bash
   # Povolit pouze z webserveru
   ufw allow from 91.98.122.165 to any port 5555
   ```

4. **Rate limiting**
   - Implementovat v Python API (Flask-Limiter)

## 📊 Monitoring

### Logy

```bash
# Python API logy
tail -f /var/log/zion_wallet_api.log

# PHP error log
tail -f /var/log/apache2/error.log
```

### Metriky

```bash
# Počet vygenerovaných walletů
ls -1 data/presale_qr_codes/*.png | wc -l

# Velikost QR kódů
du -sh data/presale_qr_codes/
```

## 🚀 Production Deployment

### Systemd service

```bash
# /etc/systemd/system/zion-wallet-api.service
[Unit]
Description=ZION Wallet Generation API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/zion
ExecStart=/usr/bin/python3 /var/www/zion/api/wallet_api.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable zion-wallet-api
sudo systemctl start zion-wallet-api
sudo systemctl status zion-wallet-api
```

## 📝 Poznámky

- Wallety jsou generovány on-demand při každé objednávce
- QR kódy jsou ukládány do `data/presale_qr_codes/`
- Private keys jsou posílány v plaintextu do PHP pro uložení
- PHP zodpovídá za šifrování a persistenci
- Python API je stateless - neukládá data

## 🎉 Ready to Go!

```bash
# 1. Nainstalovat
pip install -r requirements.txt

# 2. Spustit
python3 api/wallet_api.py

# 3. Testovat
open https://newearth.cz/V2/debug-presale.html

# 4. Profit! 🚀
```

---

**Author:** ZION Team  
**Created:** 9. prosince 2025  
**Version:** 2.9.0
