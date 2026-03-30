# ZION Presale Deployment Guide

> **Kompletní návod pro nasazení presale systému v2.9.0**  
> Datum: Prosinec 2025  
> Verze: 2.9.0 Production Ready

---

## 📋 Obsah

1. [Přehled systému](#přehled-systému)
2. [Požadavky](#požadavky)
3. [Předinstalační kroky](#předinstalační-kroky)
4. [Instalace Python backendu](#instalace-python-backendu)
5. [Konfigurace Nginx](#konfigurace-nginx)
6. [Konfigurace PHP](#konfigurace-php)
7. [Konfigurace Stripe](#konfigurace-stripe)
8. [Nastavení synchronizace](#nastavení-synchronizace)
9. [Testování](#testování)
10. [Monitoring a údržba](#monitoring-a-údržba)
11. [Troubleshooting](#troubleshooting)
12. [Rollback](#rollback)

---

## Přehled systému

### Architektura

```
┌─────────────────────────────────────────────────────────────────┐
│                         ZION Presale v2.9                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
            ┌───────▼──────┐        ┌──────▼──────┐
            │  presale.html │        │ dashboard-  │
            │  (Frontend)   │        │ presale.html│
            └───────┬──────┘        └──────┬──────┘
                    │                      │
        ┌───────────┴──────────────────────┴───────────┐
        │         API Switcher (presale.js)            │
        │  - Stripe → Python FastAPI                   │
        │  - Bank Transfer → PHP V2                    │
        │  - Live Stats Polling (30s)                  │
        └───────────┬──────────────────────┬───────────┘
                    │                      │
        ┌───────────▼──────────┐  ┌────────▼──────────┐
        │   Python FastAPI     │  │    PHP V2 API     │
        │   (127.0.0.1:8000)   │  │  (wallet-lib.php) │
        │                      │  │  (ledger.php)     │
        │  8 Endpoints:        │  │  (stripe-*.php)   │
        │  - /presale/status   │  │                   │
        │  - /purchase/init    │  │  Stripe metadata: │
        │  - /webhook/stripe   │  │  presale=true     │
        │  - /order/{id}       │  │        │          │
        │  - /stats/admin      │  │        ▼          │
        │  - /by-email/{email} │  │  ┌──────────────┐ │
        │  - /session/{sid}    │  │  │ Webhook      │ │
        │  - /qr/{order_id}    │  │  │ Forwarding   │ │
        └──────────┬───────────┘  └────┬─────────────┘
                   │                   │
                   │    ┌──────────────┘
                   │    │
        ┌──────────▼────▼──────────┐
        │   Bidirectional Sync     │
        │  (hourly cron job)       │
        │                          │
        │  - Import PHP → Python   │
        │  - Export Python → PHP   │
        │  - Conflict resolution   │
        └──────────┬────┬──────────┘
                   │    │
         ┌─────────▼─┐  └─────────▼────────┐
         │ SQLite DB │    │ PHP JSON Files │
         │ presale.db│    │ presale-orders/│
         │ 7 tables  │    │ ledger.json    │
         └───────────┘    └────────────────┘
```

### Komponenty

- **Frontend**: presale.html, presale.js (API switcher + polling)
- **Python Backend**: FastAPI uvicorn (8 endpoints)
- **PHP Backend**: V2 API (wallet, ledger, Stripe)
- **Database**: SQLite (presale.db), PHP JSON
- **Sync**: Bidirectional cron job (hourly)
- **Web Server**: Nginx (reverse proxy)
- **Payment**: Stripe Checkout + Webhooks

---

## Požadavky

### Hardware

- **CPU**: 2+ jádra (4+ doporučeno)
- **RAM**: 4GB+ (8GB doporučeno)
- **Disk**: 20GB+ volného místa (SSD doporučeno)

### Software

- **OS**: Ubuntu 20.04+ / Debian 11+
- **Python**: 3.9+
- **PHP**: 8.1+ (s PHP-FPM)
- **Nginx**: 1.18+
- **SQLite**: 3.35+
- **Systemd**: pro service management

### Domény a SSL

- **Doména**: terranova.one (nebo vlastní)
- **SSL**: Let's Encrypt certifikát
- **DNS**: A záznam směřující na server IP

---

## Předinstalační kroky

### 1. Aktualizace systému

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Instalace závislostí

```bash
# Python 3.9+
sudo apt install python3 python3-pip python3-venv -y

# PHP 8.1+
sudo apt install php8.1 php8.1-fpm php8.1-cli php8.1-curl php8.1-json php8.1-mbstring -y

# Nginx
sudo apt install nginx -y

# SQLite
sudo apt install sqlite3 libsqlite3-dev -y

# Git
sudo apt install git -y

# Další utility
sudo apt install curl wget nano htop -y
```

### 3. Ověření verzí

```bash
python3 --version  # >= 3.9
php --version      # >= 8.1
nginx -v           # >= 1.18
sqlite3 --version  # >= 3.35
```

### 4. Naklonování repozitáře

```bash
cd /var/www/
sudo git clone https://github.com/Yose144/Zion-2.9.git
sudo chown -R www-data:www-data Zion-2.9
cd Zion-2.9
```

---

## Instalace Python backendu

### 1. Vytvoření virtuálního prostředí

```bash
cd /var/www/Zion-2.9
python3 -m venv venv
source venv/bin/activate
```

### 2. Instalace Python balíčků

```bash
pip install --upgrade pip
pip install -r requirements.txt

# Ověření kritických balíčků
pip list | grep -E "fastapi|uvicorn|stripe|pydantic"
```

### 3. Inicializace databáze

```bash
# Vytvořit data adresář
mkdir -p data/presale_qr_codes
chmod 755 data
chmod 755 data/presale_qr_codes

# Pokud máte init script (nebo manuálně vytvořit schéma)
# python scripts/setup_presale_db.py

# Nebo SQLite CLI
sqlite3 data/presale.db < sql/presale_schema.sql  # Pokud existuje

# Ověření tabulek
sqlite3 data/presale.db ".tables"
# Očekáváno: presale_phases, presale_orders, presale_wallets, 
#            presale_payments, presale_distributions, 
#            presale_analytics, presale_metadata
```

### 4. Konfigurace Python .env

```bash
cp .env.example .env
nano .env
```

**Obsah `.env`:**

```env
# Database
DATABASE_URL=sqlite:///./data/presale.db

# Stripe
STRIPE_SECRET_KEY=sk_live_XXXXXXXXXXXXXXXXXXXXXXXX
STRIPE_PUBLISHABLE_KEY=pk_live_XXXXXXXXXXXXXXXXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXXXXXXXX

# API
API_HOST=127.0.0.1
API_PORT=8000
API_WORKERS=4

# Presale Config
PRESALE_TOTAL_ALLOCATION=500000000
PRESALE_PHASE_1_PRICE=0.008
PRESALE_PHASE_2_PRICE=0.010
PRESALE_PHASE_3_PRICE=0.012
PRESALE_MAINNET_LAUNCH=2026-12-31T23:59:59

# Security
SECRET_KEY=your-secret-key-min-32-characters-long-random-string
CORS_ORIGINS=https://terranova.one,https://www.terranova.one

# PHP Integration
PHP_WALLET_API_URL=https://terranova.one/V2/api/wallet-qr.php
PHP_LEDGER_PATH=/var/www/Zion-2.9/public_html/V2/wallets/ledger.json
```

### 5. Testování Python backendu

```bash
# Aktivovat venv
source /var/www/Zion-2.9/venv/bin/activate

# Spustit FastAPI development server
uvicorn api.presale_endpoints:app --host 127.0.0.1 --port 8000 --reload

# V druhém terminálu otestovat
curl http://127.0.0.1:8000/presale/status

# Očekávaný výstup (JSON):
# {"success":true,"current_phase":1,"tokens_sold":0,...}
```

### 6. Instalace systemd service

```bash
# Zkopírovat service file
sudo cp deployment/zion-presale.service /etc/systemd/system/

# Editovat cesty (pokud nutné)
sudo nano /etc/systemd/system/zion-presale.service

# Reload systemd
sudo systemctl daemon-reload

# Povolit autostart
sudo systemctl enable zion-presale

# Spustit service
sudo systemctl start zion-presale

# Ověření stavu
sudo systemctl status zion-presale

# Sledovat logy
sudo journalctl -u zion-presale -f
```

**Příklad výstupu `systemctl status`:**

```
● zion-presale.service - ZION Presale FastAPI Backend
     Loaded: loaded (/etc/systemd/system/zion-presale.service; enabled)
     Active: active (running) since Mon 2025-12-02 14:30:00 UTC; 5min ago
   Main PID: 12345 (uvicorn)
      Tasks: 5 (limit: 4915)
     Memory: 120.5M
        CPU: 2.3s
     CGroup: /system.slice/zion-presale.service
             └─12345 /var/www/Zion-2.9/venv/bin/python...
```

---

## Konfigurace Nginx

### 1. Instalace SSL certifikátu (Let's Encrypt)

```bash
# Instalace Certbot
sudo apt install certbot python3-certbot-nginx -y

# Získání certifikátu
sudo certbot --nginx -d terranova.one -d www.terranova.one

# Ověření auto-renewal
sudo certbot renew --dry-run
```

### 2. Konfigurace rate limiting

```bash
sudo nano /etc/nginx/nginx.conf
```

**Přidat do `http {}` bloku:**

```nginx
http {
    # ... existující konfigurace ...
    
    # Rate limiting pro presale API
    limit_req_zone $binary_remote_addr zone=presale_api:10m rate=10r/s;
    
    # Connection limiting
    limit_conn_zone $binary_remote_addr zone=presale_conn:10m;
    
    # ... zbytek konfigurace ...
}
```

### 3. Instalace presale konfigurace

```bash
# Zkopírovat config
sudo cp deployment/nginx-presale.conf /etc/nginx/sites-available/presale.conf

# Vytvořit symlink
sudo ln -s /etc/nginx/sites-available/presale.conf /etc/nginx/sites-enabled/

# Testovat konfiguraci
sudo nginx -t

# Očekávaný výstup:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Reload Nginx
sudo systemctl reload nginx
```

### 4. Ověření reverse proxy

```bash
# Test status endpointu
curl https://terranova.one/presale/status

# Test PHP API
curl https://terranova.one/V2/api/presale-order.php

# Sledovat Nginx logy
sudo tail -f /var/log/nginx/presale-access.log
sudo tail -f /var/log/nginx/presale-error.log
```

---

## Konfigurace PHP

### 1. Nastavení config.php

```bash
cd /var/www/Zion-2.9/public_html/V2/api
sudo nano config.php
```

**Kritické konstanty:**

```php
<?php
// Database (pokud používáte MySQL pro PHP část)
define('DB_HOST', 'localhost');
define('DB_USER', 'zion_user');
define('DB_PASS', 'strong_password_here');
define('DB_NAME', 'zion_db');

// Stripe (LIVE KEYS!)
define('STRIPE_SECRET_KEY', 'sk_live_XXXXXXXXXXXXXXXXXXXXXXXX');
define('STRIPE_PUBLISHABLE_KEY', 'pk_live_XXXXXXXXXXXXXXXXXXXXXXXX');
define('STRIPE_WEBHOOK_SECRET', 'whsec_XXXXXXXXXXXXXXXXXXXXXXXX');

// Site URL
define('SITE_URL', 'https://terranova.one');

// Python Presale Webhook (DŮLEŽITÉ!)
define('PYTHON_PRESALE_WEBHOOK_URL', 'http://127.0.0.1:8000/presale/webhook/stripe');

// Security
define('JWT_SECRET', 'your-jwt-secret-min-32-chars');
define('ENCRYPTION_KEY', 'your-encryption-key-32-chars'); // AES-256

// Paths
define('WALLET_DIR', __DIR__ . '/../wallets');
define('ORDER_DIR', __DIR__ . '/../presale-orders');
define('QR_DIR', __DIR__ . '/../../../data/presale_qr_codes');
```

### 2. Nastavení oprávnění

```bash
# PHP V2 adresáře
sudo chown -R www-data:www-data /var/www/Zion-2.9/public_html/V2
sudo chmod -R 755 /var/www/Zion-2.9/public_html/V2
sudo chmod 644 /var/www/Zion-2.9/public_html/V2/api/*.php

# Writable adresáře
sudo chmod 775 /var/www/Zion-2.9/public_html/V2/wallets
sudo chmod 775 /var/www/Zion-2.9/public_html/V2/presale-orders

# Data adresář
sudo chown -R www-data:www-data /var/www/Zion-2.9/data
sudo chmod 775 /var/www/Zion-2.9/data
sudo chmod 775 /var/www/Zion-2.9/data/presale_qr_codes
```

### 3. Inicializace PHP JSON souborů

```bash
# Vytvořit ledger.json (pokud neexistuje)
cat > /var/www/Zion-2.9/public_html/V2/wallets/ledger.json << 'EOF'
{
  "testnet": [],
  "mainnet": []
}
EOF

sudo chown www-data:www-data /var/www/Zion-2.9/public_html/V2/wallets/ledger.json
sudo chmod 664 /var/www/Zion-2.9/public_html/V2/wallets/ledger.json
```

### 4. Test PHP wallet API

```bash
# Test wallet generování
curl -X POST https://terranova.one/V2/api/wallet-qr.php \
  -H "Content-Type: application/json" \
  -d '{"network":"testnet"}'

# Očekávaný výstup (JSON):
# {"success":true,"address":"ZION...","qr_url":"..."}
```

---

## Konfigurace Stripe

### 1. Přepnutí do Live Mode

1. Přihlásit se na [Stripe Dashboard](https://dashboard.stripe.com)
2. Přepnout z **Test mode** na **Live mode** (přepínač vpravo nahoře)
3. Získat live klíče: **Developers → API keys**

### 2. Konfigurace Webhook

1. **Developers → Webhooks → Add endpoint**
2. **Endpoint URL**: `https://terranova.one/V2/api/stripe-webhook.php`
3. **Events to send**:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. **Kliknout "Add endpoint"**
5. **Zkopírovat "Signing secret"** (začíná `whsec_`)

### 3. Aktualizace config.php s live keys

```bash
sudo nano /var/www/Zion-2.9/public_html/V2/api/config.php
```

```php
// Aktualizovat tyto hodnoty
define('STRIPE_SECRET_KEY', 'sk_live_51XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
define('STRIPE_PUBLISHABLE_KEY', 'pk_live_51XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
define('STRIPE_WEBHOOK_SECRET', 'whsec_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
```

### 4. Test webhook delivery

```bash
# Instalace Stripe CLI (pro lokální testování)
# https://stripe.com/docs/stripe-cli

# Forward webhooks
stripe listen --forward-to https://terranova.one/V2/api/stripe-webhook.php

# V druhém terminálu trigger test event
stripe trigger checkout.session.completed

# Sledovat PHP logy
sudo tail -f /var/log/nginx/presale-error.log | grep "Stripe"
```

---

## Nastavení synchronizace

### 1. Instalace cron scriptu

```bash
# Zkopírovat script
sudo cp deployment/presale-sync.cron /usr/local/bin/presale-sync.sh

# Nastavit oprávnění
sudo chmod +x /usr/local/bin/presale-sync.sh

# Editovat cesty (pokud nutné)
sudo nano /usr/local/bin/presale-sync.sh

# Ověřit cesty:
# - WORKSPACE_DIR="/var/www/Zion-2.9"
# - VENV_BIN="${WORKSPACE_DIR}/venv/bin/python"
# - SYNC_SCRIPT="${WORKSPACE_DIR}/scripts/sync_php_python_presale.py"
```

### 2. Manuální test synchronizace

```bash
# Dry-run test (žádné změny)
cd /var/www/Zion-2.9
source venv/bin/activate
python scripts/sync_php_python_presale.py --mode=sync --dry-run

# Očekávaný výstup:
# === ZION Presale Synchronization (DRY RUN) ===
# ...
# === Summary ===
# Total orders imported: 0
# Total orders exported: 0
# Errors: 0
```

```bash
# Produkční run (s změnami)
sudo /usr/local/bin/presale-sync.sh

# Zkontrolovat výstup v logu
cat /var/log/presale-sync-detail.log
```

### 3. Přidání do crontab

```bash
# Editovat crontab (jako root nebo s sudo)
sudo crontab -e

# Přidat řádek (každá celá hodina)
0 * * * * /usr/local/bin/presale-sync.sh >> /var/log/presale-sync.log 2>&1

# Nebo každých 30 minut (intenzivnější sync)
*/30 * * * * /usr/local/bin/presale-sync.sh >> /var/log/presale-sync.log 2>&1

# Uložit a zavřít editor (Ctrl+X, Y, Enter)
```

### 4. Ověření cron jobu

```bash
# Zobrazit aktivní crontab
sudo crontab -l

# Sledovat log (po proběhnutí cron jobu)
tail -f /var/log/presale-sync.log

# Zkontrolovat, že cron běží
sudo systemctl status cron
```

---

## Testování

### Kompletní Testing Guide

Detailní testovací scénáře najdete v [deployment/TESTING_GUIDE.md](../deployment/TESTING_GUIDE.md).

### Quick Smoke Test

```bash
# 1. Status endpoint
curl https://terranova.one/presale/status

# 2. Stripe test purchase (test mode)
curl -X POST https://terranova.one/presale/purchase/init \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "amount_eur": 100,
    "payment_method": "stripe"
  }'

# 3. Email lookup
curl https://terranova.one/presale/orders/by-email/test@example.com

# 4. Frontend polling
# Otevřít https://terranova.one/V2/presale.html v prohlížeči
# DevTools Console → sledovat fetch požadavky každých 30s

# 5. Admin dashboard
# Otevřít https://terranova.one/V2/dashboard-presale.html
# Ověřit hybrid data merge (Python + PHP)
```

### Health Check Checklist

- [ ] Python FastAPI běží: `systemctl status zion-presale`
- [ ] Nginx proxy funguje: `curl https://terranova.one/presale/status`
- [ ] PHP API dostupné: `curl https://terranova.one/V2/api/presale-order.php`
- [ ] SSL certifikát platný: `curl -I https://terranova.one | grep "200 OK"`
- [ ] Stripe webhook nakonfigurován: Check Stripe Dashboard
- [ ] Cron job běží: `sudo crontab -l`
- [ ] Sync log aktuální: `ls -lh /var/log/presale-sync.log`
- [ ] Database writable: `sqlite3 data/presale.db ".databases"`
- [ ] QR adresář writable: `ls -ld data/presale_qr_codes`

---

## Monitoring a údržba

### 1. Log Files

```bash
# Python FastAPI logs
sudo journalctl -u zion-presale -f --since "1 hour ago"

# Nginx access logs
sudo tail -f /var/log/nginx/presale-access.log

# Nginx error logs
sudo tail -f /var/log/nginx/presale-error.log

# Sync cron logs
sudo tail -f /var/log/presale-sync.log
sudo tail -f /var/log/presale-sync-detail.log

# PHP errors
sudo tail -f /var/log/nginx/presale-error.log | grep "PHP"
```

### 2. Database Maintenance

```bash
# Velikost databáze
du -h /var/www/Zion-2.9/data/presale.db

# Vacuum (optimalizace)
sqlite3 /var/www/Zion-2.9/data/presale.db "VACUUM;"

# Integrity check
sqlite3 /var/www/Zion-2.9/data/presale.db "PRAGMA integrity_check;"

# Statistiky
sqlite3 /var/www/Zion-2.9/data/presale.db << 'EOF'
SELECT 'Total Orders:', COUNT(*) FROM presale_orders;
SELECT 'Paid Orders:', COUNT(*) FROM presale_orders WHERE payment_status='paid';
SELECT 'Total Tokens Sold:', SUM(zion_tokens) FROM presale_orders WHERE payment_status='paid';
SELECT 'Total Revenue EUR:', SUM(amount_eur) FROM presale_orders WHERE payment_status='paid';
EOF
```

### 3. Backup Strategy

```bash
# Denní backup (přidat do crontab)
#!/bin/bash
BACKUP_DIR="/var/backups/zion-presale"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup SQLite
sqlite3 /var/www/Zion-2.9/data/presale.db ".backup '$BACKUP_DIR/presale_$DATE.db'"

# Backup PHP JSON
tar -czf "$BACKUP_DIR/php_data_$DATE.tar.gz" \
    /var/www/Zion-2.9/public_html/V2/presale-orders \
    /var/www/Zion-2.9/public_html/V2/wallets

# Backup QR codes
tar -czf "$BACKUP_DIR/qr_codes_$DATE.tar.gz" \
    /var/www/Zion-2.9/data/presale_qr_codes

# Cleanup old backups (starší než 30 dní)
find "$BACKUP_DIR" -name "*.db" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

```bash
# Přidat do crontab (každý den ve 2:00)
sudo crontab -e

0 2 * * * /usr/local/bin/presale-backup.sh >> /var/log/presale-backup.log 2>&1
```

### 4. Performance Monitoring

```bash
# Sledovat CPU/RAM využití
htop

# Nginx spojení
sudo netstat -tuln | grep :80
sudo netstat -tuln | grep :443

# FastAPI workers
ps aux | grep uvicorn

# Database spojení
lsof /var/www/Zion-2.9/data/presale.db
```

### 5. Alert Configuration (Volitelné)

**Prometheus + Grafana setup** (pokud máte):

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'zion-presale'
    static_configs:
      - targets: ['127.0.0.1:8000']
    metrics_path: '/metrics'  # Pokud je implementováno v FastAPI
```

**Simple health check script**:

```bash
#!/bin/bash
# /usr/local/bin/presale-healthcheck.sh

STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://terranova.one/presale/status)

if [ "$STATUS" != "200" ]; then
    echo "ALERT: Presale API down! Status: $STATUS"
    # Slack/Discord webhook
    curl -X POST "https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
         -H 'Content-Type: application/json' \
         -d "{\"text\":\"⚠️ ZION Presale API DOWN! Status: $STATUS\"}"
fi
```

```bash
# Crontab - každých 5 minut
*/5 * * * * /usr/local/bin/presale-healthcheck.sh
```

---

## Troubleshooting

### Problém: FastAPI neběží

**Příznaky:**
- `systemctl status zion-presale` ukazuje `failed` nebo `inactive`
- `curl http://127.0.0.1:8000/presale/status` vrací Connection refused

**Řešení:**

```bash
# 1. Zkontrolovat logy
sudo journalctl -u zion-presale -n 50

# 2. Zkontrolovat Python syntax
cd /var/www/Zion-2.9
source venv/bin/activate
python -m py_compile api/presale_endpoints.py

# 3. Manuálně spustit FastAPI pro debug
uvicorn api.presale_endpoints:app --host 127.0.0.1 --port 8000 --reload

# 4. Zkontrolovat .env soubor
cat .env | grep -E "STRIPE|DATABASE"

# 5. Restartovat service
sudo systemctl restart zion-presale
sudo systemctl status zion-presale
```

---

### Problém: Nginx 502 Bad Gateway

**Příznaky:**
- `curl https://terranova.one/presale/status` vrací 502
- Nginx error log: "connect() failed (111: Connection refused)"

**Řešení:**

```bash
# 1. Ověřit, že FastAPI běží
sudo systemctl status zion-presale
curl http://127.0.0.1:8000/presale/status

# 2. Zkontrolovat Nginx upstream config
sudo nginx -t
sudo grep -A 5 "upstream presale_backend" /etc/nginx/sites-enabled/presale.conf

# 3. Zkontrolovat firewall
sudo ufw status
sudo ufw allow 8000/tcp  # Pokud je nutné

# 4. SELinux context (pokud je povoleno)
sudo setsebool -P httpd_can_network_connect 1

# 5. Reload Nginx
sudo systemctl reload nginx
```

---

### Problém: Stripe webhook nedoručen

**Příznaky:**
- Stripe Dashboard ukazuje webhook failures
- Objednávky zůstávají ve stavu `pending` i po platbě

**Řešení:**

```bash
# 1. Zkontrolovat webhook URL v Stripe Dashboard
# Mělo by být: https://terranova.one/V2/api/stripe-webhook.php

# 2. Test manuálního webhook volání
curl -X POST https://terranova.one/V2/api/stripe-webhook.php \
  -H "Content-Type: application/json" \
  -d '{"type":"checkout.session.completed"}'

# 3. Zkontrolovat Stripe signature verification
sudo tail -f /var/log/nginx/presale-error.log | grep "Stripe"

# 4. Ověřit STRIPE_WEBHOOK_SECRET v config.php
sudo grep "STRIPE_WEBHOOK_SECRET" /var/www/Zion-2.9/public_html/V2/api/config.php

# 5. Zkontrolovat webhook forwarding do Python
sudo grep "PYTHON_PRESALE_WEBHOOK_URL" /var/www/Zion-2.9/public_html/V2/api/config.php

# 6. Test forwarding
php -r "echo file_get_contents('http://127.0.0.1:8000/presale/status');"
```

---

### Problém: QR kód 404

**Příznaky:**
- `GET /presale/qr/{order_id}` vrací 404
- QR obrázek se nezobrazuje v success email

**Řešení:**

```bash
# 1. Zkontrolovat existenci souboru
ls -lh /var/www/Zion-2.9/data/presale_qr_codes/

# 2. Zkontrolovat DB záznam
sqlite3 /var/www/Zion-2.9/data/presale.db << 'EOF'
SELECT order_id, qr_code_path 
FROM presale_wallets 
ORDER BY created_at DESC 
LIMIT 5;
EOF

# 3. Zkontrolovat oprávnění
sudo chmod 755 /var/www/Zion-2.9/data/presale_qr_codes
sudo chmod 644 /var/www/Zion-2.9/data/presale_qr_codes/*.png

# 4. Re-generovat QR pro konkrétní order
cd /var/www/Zion-2.9
source venv/bin/activate
python -c "
from src.core.php_wallet_integration import PHPWalletClient
client = PHPWalletClient()
# ... implementace re-generace
"

# 5. Zkontrolovat Nginx static serve
sudo grep -A 10 "location /data/presale_qr_codes" /etc/nginx/sites-enabled/presale.conf
```

---

### Problém: Sync job fails

**Příznaky:**
- `/var/log/presale-sync.log` ukazuje exit code 1
- Data se nesynchronizují mezi PHP a Python

**Řešení:**

```bash
# 1. Manuální spuštění s debug
cd /var/www/Zion-2.9
source venv/bin/activate
python scripts/sync_php_python_presale.py --mode=sync

# 2. Zkontrolovat oprávnění
ls -ld public_html/V2/presale-orders/
ls -ld public_html/V2/wallets/
ls -ld data/

# 3. Zkontrolovat cesty v cron scriptu
sudo cat /usr/local/bin/presale-sync.sh | grep -E "WORKSPACE|VENV|SYNC_SCRIPT"

# 4. Ověřit, že venv má všechny balíčky
/var/www/Zion-2.9/venv/bin/pip list | grep -E "sqlite|json"

# 5. Zkontrolovat detailní log
tail -100 /var/log/presale-sync-detail.log
```

---

### Problém: Live stats polling nefunguje

**Příznaky:**
- Progress bar se neaktualizuje
- Console error v DevTools

**Řešení:**

```bash
# 1. Otevřít presale.html v prohlížeči
# 2. Otevřít DevTools (F12) → Console tab

# 3. Zkontrolovat chyby
console.error  # Mělo by být prázdné nebo jen warnings

# 4. Manuální test fetch
fetch('/presale/status').then(r => r.json()).then(console.log)

# 5. Zkontrolovat CORS headers
curl -I https://terranova.one/presale/status | grep -i "access-control"

# 6. Zkontrolovat presale.js načtení
console.log(typeof updatePresaleStats)  // Mělo by být "function"

# 7. Zkontrolovat polling interval
# V Console by měl být každých 30s request na /presale/status

# 8. Zkontrolovat Nginx proxy
sudo tail -f /var/log/nginx/presale-access.log | grep "GET /presale/status"
```

---

## Rollback

### Quick Rollback (v případě kritické chyby)

```bash
# 1. Zastavit Python backend
sudo systemctl stop zion-presale

# 2. Přesměrovat všechny requesty na PHP
sudo nano /etc/nginx/sites-enabled/presale.conf

# Zakomentovat Python proxy, odkázat na PHP backup endpoint:
# location /presale/ {
#     rewrite ^/presale/(.*)$ /V2/api/presale-legacy.php?endpoint=$1 last;
# }

# 3. Reload Nginx
sudo nginx -t && sudo systemctl reload nginx

# 4. Ověřit funkčnost
curl https://terranova.one/presale/status
```

### Database Rollback

```bash
# 1. Zastavit všechny služby
sudo systemctl stop zion-presale
sudo systemctl stop nginx

# 2. Obnovit backup
BACKUP_DATE="20251202_140000"  # Změňte na váš backup timestamp
sudo cp /var/backups/zion-presale/presale_$BACKUP_DATE.db \
       /var/www/Zion-2.9/data/presale.db

# 3. Obnovit PHP data
sudo tar -xzf /var/backups/zion-presale/php_data_$BACKUP_DATE.tar.gz -C /

# 4. Restartovat služby
sudo systemctl start nginx
sudo systemctl start zion-presale

# 5. Ověření
sudo systemctl status zion-presale
curl https://terranova.one/presale/status
```

### Git Rollback (code)

```bash
cd /var/www/Zion-2.9

# 1. Zjistit commit history
git log --oneline -10

# 2. Rollback na předchozí commit
git reset --hard <commit-hash>

# 3. Restartovat služby
sudo systemctl restart zion-presale
sudo systemctl reload nginx
```

---

## Kontakty a Podpora

- **Dokumentace**: `/var/www/Zion-2.9/docs/`
- **GitHub Issues**: https://github.com/Yose144/Zion-2.9/issues
- **Email**: support@terranova.one

---

## Checklist před spuštěním v produkci

- [ ] SSL certifikát platný a auto-renewal nakonfigurován
- [ ] Stripe LIVE keys nastaveny (ne test keys!)
- [ ] Stripe webhook endpoint ověřen (zelené ✓ v Dashboard)
- [ ] Python .env soubor obsahuje produkční hodnoty
- [ ] PHP config.php obsahuje produkční hodnoty
- [ ] Database backups nakonfigurovány (denní cron)
- [ ] Monitoring alerts nastaveny (health check)
- [ ] Nginx rate limiting aktivní
- [ ] Systemd service enabled a running
- [ ] Cron sync job běží (zkontrolovat logs)
- [ ] Všechny testy z TESTING_GUIDE.md prošly ✅
- [ ] Rollback plán připraven a otestován
- [ ] Team proškolen na podporu a troubleshooting

---

**🎉 Gratulujeme! ZION Presale v2.9.0 je připraven pro produkci.**

Pro detailní technické informace viz:
- [PRESALE_BACKEND_REPORT.md](../PRESALE_BACKEND_REPORT.md)
- [PRESALE_INTEGRATION_GUIDE.md](../public_html/V2/api/PRESALE_INTEGRATION_GUIDE.md)
- [TESTING_GUIDE.md](../deployment/TESTING_GUIDE.md)
