# ZION Presale Production Deployment Checklist

**Version:** 2.9.0  
**Date:** 3. prosince 2025  
**Target:** Webglobe hosting (ftp.newearth.cz)

---

## 🎯 Pre-Deployment Checklist

### 1. Production Keys & Credentials

#### Stripe (Live Mode)
- [ ] Get live secret key from Stripe Dashboard
  - Replace `sk_test_*` → `sk_live_*` in `.env`
- [ ] Get live publishable key
  - Replace `pk_test_*` → `pk_live_*` in `presale.js`
- [ ] Register webhook endpoint
  - URL: `https://api.terranova.one/presale/webhook/stripe`
  - Events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
  - Copy webhook secret → `STRIPE_WEBHOOK_SECRET` in `.env`

#### Email (Webglobe SMTP)
- [ ] Get password for `admin@newearth.cz` mailbox
- [ ] Update `SMTP_PASS` in `api/presale/.env`
- [ ] Test email sending with `api/presale/tools/send-test-email.php?send=1`

#### SFTP/FTP Access
- [ ] Get FTP username from Webglobe
- [ ] Get FTP password
- [ ] Update `scripts/deploy/.env.deploy`:
  ```bash
  SFTP_HOST=ftp.newearth.cz
  SFTP_PORT=222
  SFTP_USER=your_ftp_username
  # Password will be prompted during deploy
  ```

#### Database
- [ ] Choose: SQLite (simple) or PostgreSQL (scalable)
- [ ] If PostgreSQL: Get DB credentials from Webglobe
- [ ] Create database: `zion_presale`
- [ ] Update `PRESALE_DB_PATH` or connection string

#### Security Keys
- [ ] Generate encryption key (if not exists):
  ```bash
  python -c "import os; open('data/presale_encryption_key.bin', 'wb').write(os.urandom(32))"
  ```
- [ ] **CRITICAL:** Backup encryption key to secure location
- [ ] Generate admin API key:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```

---

## 📦 Deployment Steps

### Step 1: Prepare Local Files

```bash
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main

# Copy deploy config
cp scripts/deploy/.env.deploy.example scripts/deploy/.env.deploy
nano scripts/deploy/.env.deploy
# Fill: SFTP_USER, REMOTE_V2_PATH=public_html/V2

# Update production .env (don't commit!)
cp api/presale/.env.example api/presale/.env.production
nano api/presale/.env.production
# Fill: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SMTP_PASS, DB credentials
```

### Step 2: Deploy V2 Frontend

```bash
# Run deployment script
bash scripts/deploy/deploy_v2.sh
# Enter FTP password when prompted
```

**What gets uploaded:**
- `public_html/V2/dashboard.html` (CZ)
- `public_html/V2/dashboard-en.html` (EN)
- `public_html/V2/presale.html` + `presale-en.html`
- `public_html/V2/presale.js` (with Stripe publishable key)
- `public_html/V2/dashboard-presale.js`
- `public_html/V2/rasta.css`, `style.css`
- All other V2 assets

**Backup created:** `V2-backup-YYYYmmdd-HHMMSS` on server

### Step 3: Deploy Python Backend (Manual)

```bash
# SSH into server
ssh -p 222 your_ftp_user@ftp.newearth.cz

# Create API directory (outside public_html for security)
mkdir -p ~/api/presale
cd ~/api/presale

# Option A: Git clone (if server has git)
git clone https://github.com/Yose144/Zion-2.9.git temp
cp -r temp/src/core/*.py .
cp -r temp/api/presale_endpoints.py .
rm -rf temp

# Option B: Manual upload via SFTP
# (from local machine)
scp -P 222 src/core/presale_*.py your_ftp_user@ftp.newearth.cz:~/api/presale/
scp -P 222 api/presale_endpoints.py your_ftp_user@ftp.newearth.cz:~/api/presale/
```

### Step 4: Upload Production .env

```bash
# From local machine
scp -P 222 api/presale/.env.production your_ftp_user@ftp.newearth.cz:~/api/presale/.env
scp -P 222 data/presale_encryption_key.bin your_ftp_user@ftp.newearth.cz:~/api/presale/
```

### Step 5: Install Python Dependencies

```bash
# On server (SSH)
cd ~/api/presale

# Install dependencies
pip3 install --user fastapi uvicorn stripe qrcode[pil] pillow python-dotenv pydantic

# Or use virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 6: Initialize Database

```bash
# On server
cd ~/api/presale
python3 << EOF
from presale_db import init_presale_db
db = init_presale_db("presale.db")
print("✅ Database initialized")
EOF
```

### Step 7: Deploy PHP API (Bridge)

```bash
# Upload PHP files
scp -P 222 -r api/presale/*.php your_ftp_user@ftp.newearth.cz:~/public_html/api/presale/
scp -P 222 api/presale/config.php your_ftp_user@ftp.newearth.cz:~/public_html/api/presale/
```

### Step 8: Start FastAPI Server

**Option A: Using systemd (if available)**

Create `/etc/systemd/system/zion-presale.service`:
```ini
[Unit]
Description=ZION Presale API
After=network.target

[Service]
Type=simple
User=your_ftp_user
WorkingDirectory=/home/your_ftp_user/api/presale
ExecStart=/usr/bin/python3 -m uvicorn presale_endpoints:app --host 127.0.0.1 --port 8001
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable zion-presale
sudo systemctl start zion-presale
```

**Option B: Using screen/tmux (simple hosting)**

```bash
screen -S presale
cd ~/api/presale
python3 -m uvicorn presale_endpoints:app --host 127.0.0.1 --port 8001 --reload
# Ctrl+A, D to detach
```

**Option C: PHP calls Python directly** (no separate server needed)

Update PHP to call Python scripts via `exec()` - already configured in `api/presale/*.php`

---

## ✅ Post-Deployment Verification

### 1. Test Frontend

```bash
# Open in browser
https://newearth.cz/V2/dashboard.html (CZ)
https://newearth.cz/V2/dashboard-en.html (EN)
https://newearth.cz/V2/presale.html

# Check console (F12) for errors
# Verify countdown timer runs
# Check stats load (if API connected)
```

### 2. Test API Endpoints

```bash
# Health check
curl https://newearth.cz/api/presale/tools/health.php

# Stripe keys check
curl https://newearth.cz/api/presale/tools/stripe-check.php

# Presale status (Python backend)
curl https://newearth.cz/api/presale/status

# Expected: JSON with phase info, tokens, unlock schedule
```

### 3. Test Email

```bash
# Dry run
curl "https://newearth.cz/api/presale/tools/send-test-email.php"

# Real send (only after SMTP_PASS is set)
curl "https://newearth.cz/api/presale/tools/send-test-email.php?send=1&to=admin@newearth.cz"

# Check email received
```

### 4. Test Stripe Integration

```bash
# Use Stripe test cards
# https://stripe.com/docs/testing#cards

# Test card: 4242 4242 4242 4242
# Expiry: Any future date
# CVC: Any 3 digits

# Steps:
1. Open https://newearth.cz/V2/presale.html
2. Click "Koupit ZION Tokeny"
3. Fill form, submit
4. Complete Stripe checkout
5. Check order status in database
6. Verify webhook received (check logs)
```

### 5. Check Stripe Webhook

```bash
# Stripe Dashboard → Webhooks → Events
# Look for successful deliveries

# If failed:
# - Check webhook URL
# - Verify STRIPE_WEBHOOK_SECRET
# - Check server logs
```

### 6. Database Check

```bash
# On server
sqlite3 ~/api/presale/presale.db

# Check tables
.tables

# Check recent orders
SELECT * FROM presale_orders ORDER BY created_at DESC LIMIT 5;

# Check analytics
SELECT * FROM presale_analytics;

# Exit
.quit
```

---

## 🔒 Security Hardening

### 1. File Permissions

```bash
# On server
chmod 600 ~/api/presale/.env
chmod 600 ~/api/presale/presale_encryption_key.bin
chmod 755 ~/api/presale/*.py
chmod 644 ~/public_html/api/presale/*.php
```

### 2. PHP Security

```bash
# Update api/presale/config.php
# Set production error handling
display_errors = Off (in php.ini)
error_reporting = E_ALL & ~E_DEPRECATED & ~E_STRICT
log_errors = On
error_log = /path/to/php-errors.log
```

### 3. Change Admin Password

```bash
# Update api/presale/admin/index.php
# Change default: admin / zion2025
# Use strong password generator
```

### 4. Rate Limiting

Already implemented in `api/presale/config.php`:
- 50 requests/hour per IP
- Enabled: `RATE_LIMIT_ENABLED = true`

### 5. HTTPS Enforcement

```apache
# .htaccess in public_html/
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

### 6. CORS Configuration

Update `api/presale/config.php`:
```php
define('CORS_ORIGINS', json_encode([
    'https://newearth.cz',
    'https://www.newearth.cz'
]));
```

---

## 🔄 Maintenance

### Daily Backups

```bash
# Cron job (on server)
crontab -e

# Add:
0 3 * * * /path/to/backup_presale.sh

# backup_presale.sh:
#!/bin/bash
DATE=$(date +%Y%m%d)
cp ~/api/presale/presale.db ~/backups/presale_$DATE.db
cp ~/api/presale/presale_encryption_key.bin ~/backups/encryption_key_$DATE.bin
tar -czf ~/backups/qr_codes_$DATE.tar.gz ~/api/presale/data/presale_qr_codes/
```

### Weekly Tasks

- [ ] Review presale analytics
- [ ] Check Stripe webhook logs
- [ ] Verify email deliverability
- [ ] Monitor disk space

### Before MainNet (Dec 31, 2026)

- [ ] Export all paid orders:
  ```sql
  SELECT * FROM presale_orders WHERE payment_status='paid';
  ```
- [ ] Verify total tokens sold matches blockchain allocation
- [ ] Prepare distribution script
- [ ] Test token unlock schedule
- [ ] Backup all databases and encryption keys

---

## 🚨 Rollback Procedure

### If deployment fails:

```bash
# SSH to server
ssh -p 222 your_ftp_user@ftp.newearth.cz

# Restore V2 backup
cd ~/public_html
rm -rf V2
mv V2-backup-YYYYmmdd-HHMMSS V2

# Stop FastAPI if running
pkill -f uvicorn
# or
systemctl stop zion-presale

# Restore database backup
cp ~/backups/presale_20231202.db ~/api/presale/presale.db
```

---

## 📞 Support Contacts

**Webglobe Support:**
- Web: https://admin.webglobe.cz
- Email: podpora@webglobe.cz
- Phone: +420 222 745 745

**Stripe Support:**
- Dashboard: https://dashboard.stripe.com
- Docs: https://stripe.com/docs
- Support: https://support.stripe.com

**Internal:**
- Dev team: dev@terranova.one
- Admin: admin@newearth.cz

---

## ✅ Final Checklist

Before going live:

- [ ] All production keys configured
- [ ] Database initialized with correct schema
- [ ] Stripe webhook registered and tested
- [ ] Email sending verified
- [ ] Frontend accessible (CZ + EN)
- [ ] API endpoints responding
- [ ] Test purchase completed successfully
- [ ] Backups configured
- [ ] Security hardening applied
- [ ] Monitoring alerts set up
- [ ] Team notified of launch
- [ ] Marketing materials ready
- [ ] Customer support prepared

---

**Status:** Ready for deployment  
**Estimated time:** 2-4 hours (depending on hosting environment)  
**Risk level:** Low (rollback available)

**Last updated:** 3. prosince 2025
