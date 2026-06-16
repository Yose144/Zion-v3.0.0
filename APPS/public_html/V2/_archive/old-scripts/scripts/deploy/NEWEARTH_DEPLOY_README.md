# NEW EARTH Deployment Guide

## 🚀 Full Site Deployment (Stargate + V2)

### Overview
This guide covers deploying the complete NEW EARTH website including:
- **Main Index** - Stargate entrance portal (`/public_html/index.html`)
- **V2 Application** - Full ZION platform (`/public_html/V2/`)
- **Assets** - Images, CSS, JS, fonts
- **API** - Backend PHP services

### Server Details
- **Domain**: newearth.cz
- **Server**: dw214.webglobe.com
- **SSH Port**: 20002
- **SSH User**: ssh-685961
- **Remote Path**: `/home/html/newearth.cz/public_html`

### Site Structure

```
newearth.cz/
├── index.html              # Stargate entrance (main landing)
├── assets/                 # CSS, JS, fonts
│   ├── css/
│   ├── js/
│   └── webfonts/
├── images/                 # Site images
├── shop/                   # Legacy shop (if used)
└── V2/                     # Main ZION application
    ├── main.html          # V2 home page
    ├── presale.html       # Token presale
    ├── shop.html          # E-shop
    ├── dashboard.html     # User dashboard
    ├── api/               # Backend API
    │   ├── config.php
    │   ├── presale-order.php
    │   ├── stripe-checkout.php
    │   └── wallet-qr.php
    ├── wallets/           # User wallets (secure)
    ├── orders/            # Order data (secure)
    └── invoices/          # Generated invoices
```

## 📋 Prerequisites

### 1. SSH Key Setup (One-time)
```bash
# Generate SSH key if not exists
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa

# Copy key to server
ssh-copy-id -p 20002 ssh-685961@dw214.webglobe.com
```

### 2. Test Connection
```bash
ssh -p 20002 ssh-685961@dw214.webglobe.com "pwd"
# Should show: /home/html/newearth.cz
```

## 🚢 Deployment Process

### Full Deployment (Recommended)
Deploys entire `public_html` directory:

```bash
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main
./scripts/deploy/deploy_newearth_full.sh
```

**What it does:**
1. ✅ Validates local files (index.html, V2/main.html)
2. ✅ Tests SSH connection
3. ✅ Creates timestamped backup on server
4. ✅ Deploys all files using rsync (efficient, only changed files)
5. ✅ Sets correct permissions (755 dirs, 644 files, 700 sensitive)
6. ✅ Verifies deployment

**Excluded files:**
- `.DS_Store` (macOS metadata)
- `*.md` (documentation)
- `ftp.md` (credentials)
- `.env*` (environment files)
- `ai.key`, `git.key` (API keys)
- `.git*`, `node_modules`, `__pycache__`

### Manual Deployment (Alternative)
Using `rsync` directly:

```bash
rsync -avz --progress \
    -e "ssh -p 20002" \
    --exclude='.DS_Store' \
    --exclude='*.md' \
    --exclude='ftp.md' \
    --exclude='.git*' \
    --exclude='.env*' \
    --exclude='ai.key' \
    --exclude='git.key' \
    /Users/yeshuae/Desktop/ZION/Zion-2.9-main/public_html/ \
    ssh-685961@dw214.webglobe.com:/home/html/newearth.cz/public_html/
```

### V2 Only Deployment
To deploy only V2 application without touching main index:

```bash
rsync -avz --progress \
    -e "ssh -p 20002" \
    --exclude='.DS_Store' \
    --exclude='*.md' \
    /Users/yeshuae/Desktop/ZION/Zion-2.9-main/public_html/V2/ \
    ssh-685961@dw214.webglobe.com:/home/html/newearth.cz/public_html/V2/
```

## 🔒 Security Checklist

### Before Deployment
- [ ] Remove sensitive files (`ftp.md`, `.env` with real credentials)
- [ ] Check API keys are not hardcoded
- [ ] Verify `.gitignore` excludes sensitive data
- [ ] Update `api/config.php` with production DB credentials
- [ ] Set strong admin password

### After Deployment
- [ ] Verify file permissions (use `ls -la` on server)
- [ ] Test database connection: `php api/config.php`
- [ ] Check API endpoints are not publicly accessible
- [ ] Verify wallets/orders/invoices directories are protected
- [ ] Test HTTPS is working: https://newearth.cz
- [ ] Check Stripe webhook endpoint: `api/stripe-webhook.php`

### Required Permissions
```bash
# Directories: 755 (rwxr-xr-x)
chmod 755 public_html/V2/

# HTML/CSS/JS: 644 (rw-r--r--)
chmod 644 public_html/V2/*.html

# PHP scripts: 755 (rwxr-xr-x)
chmod 755 public_html/V2/api/*.php

# Sensitive directories: 700 (rwx------)
chmod 700 public_html/V2/wallets
chmod 700 public_html/V2/orders
chmod 700 public_html/V2/invoices
```

## 🧪 Testing After Deployment

### 1. Main Site
```bash
curl -I https://newearth.cz
# Should return: HTTP/2 200
```

### 2. V2 Application
```bash
curl -I https://newearth.cz/V2/
# Should return: HTTP/2 200
```

### 3. API Health Check
```bash
ssh -p 20002 ssh-685961@dw214.webglobe.com \
    "cd /home/html/newearth.cz/public_html/V2/api && php config.php"
```

### 4. Browser Tests
- ✅ Main page: https://newearth.cz (Stargate)
- ✅ V2 home: https://newearth.cz/V2/main.html
- ✅ Presale: https://newearth.cz/V2/presale.html
- ✅ Shop: https://newearth.cz/V2/shop.html
- ✅ Dashboard: https://newearth.cz/V2/dashboard.html

## 🔄 Rollback Process

### Automatic Rollback (Using Backup)
```bash
# SSH to server
ssh -p 20002 ssh-685961@dw214.webglobe.com

# List backups
ls -lh /home/html/newearth.cz/backup/

# Restore from backup
cd /home/html/newearth.cz
rm -rf public_html
tar -xzf backup/public_html_backup_YYYYMMDD_HHMMSS.tar.gz

# Verify
ls -la public_html/
```

### Manual Rollback (Git)
```bash
# Locally checkout previous version
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main
git log --oneline -5  # Find previous commit
git checkout <commit-hash> -- public_html/

# Deploy again
./scripts/deploy/deploy_newearth_full.sh
```

## 📊 Monitoring

### Check Logs
```bash
ssh -p 20002 ssh-685961@dw214.webglobe.com

# Apache error log
tail -f /home/html/newearth.cz/logs/error.log

# Apache access log
tail -f /home/html/newearth.cz/logs/access.log

# PHP errors (if configured)
tail -f /home/html/newearth.cz/logs/php_errors.log
```

### Disk Usage
```bash
ssh -p 20002 ssh-685961@dw214.webglobe.com "du -sh public_html/*"
```

## 🛠️ Troubleshooting

### Issue: 500 Internal Server Error
**Cause**: Wrong file permissions or PHP syntax error

**Fix:**
```bash
# Check Apache logs
ssh -p 20002 ssh-685961@dw214.webglobe.com "tail -50 logs/error.log"

# Fix permissions
ssh -p 20002 ssh-685961@dw214.webglobe.com << 'EOF'
  find public_html -type d -exec chmod 755 {} \;
  find public_html -type f -exec chmod 644 {} \;
  find public_html -name "*.php" -exec chmod 755 {} \;
EOF
```

### Issue: Database Connection Failed
**Cause**: Wrong credentials in `api/config.php`

**Fix:**
```bash
# Edit config on server
ssh -p 20002 ssh-685961@dw214.webglobe.com
nano public_html/V2/api/config.php

# Test connection
php public_html/V2/api/config.php
```

### Issue: rsync Permission Denied
**Cause**: SSH key not set up

**Fix:**
```bash
ssh-copy-id -p 20002 ssh-685961@dw214.webglobe.com
```

### Issue: Files Not Updating
**Cause**: Browser cache or CDN cache

**Fix:**
```bash
# Clear browser cache (Cmd+Shift+R on macOS)
# Or add cache busting to URLs:
# <link rel="stylesheet" href="style.css?v=20251203">
```

## 📝 Post-Deployment Tasks

### Immediate (Day 1)
- [ ] Verify all pages load correctly
- [ ] Test presale purchase flow
- [ ] Test shop checkout
- [ ] Verify wallet generation
- [ ] Check email notifications work
- [ ] Test Stripe payment (test mode)

### Short-term (Week 1)
- [ ] Monitor error logs daily
- [ ] Check database growth
- [ ] Verify backup schedule
- [ ] Test API rate limiting
- [ ] Security scan (OWASP ZAP)

### Long-term (Ongoing)
- [ ] Weekly backup verification
- [ ] Monthly security updates
- [ ] Performance monitoring
- [ ] User feedback review

## 🔗 Related Documents
- `SERVER_SETTINGS_WEBGLOBE.md` - Server configuration details
- `EMAIL_SETTINGS_WEBGLOBE.md` - Email/SMTP setup
- `PRESALE_INTEGRATION_GUIDE.md` - API integration
- `ROADMAP_V2.md` - Development roadmap

## 📞 Support
- **Server Provider**: Webglobe (dw214.webglobe.com)
- **SSH Access**: Port 20002
- **Control Panel**: https://admin.webglobe.cz
- **DNS Management**: Webglobe DNS console

---
**Last Updated**: 3. prosince 2025
**Version**: 2.9
**Deployment Script**: `deploy_newearth_full.sh`
