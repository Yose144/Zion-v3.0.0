# 🌐 ZION Domain Setup Guide - www.zionterranova.com

**Datum:** 29. října 2025  
**Doména:** www.zionterranova.com  
**Server:** 91.98.122.165  
**Autor:** ZION DevOps Team

---

## 📋 Přehled

Tento návod provede kompletním setupem domény **www.zionterranova.com** s jedinou doménou a path-based routingem pro všechny služby.

---

## 🎯 Cíl

Vytvořit jednoduchou, škálovatelnou architekturu:

```
www.zionterranova.com           → Hlavní website
www.zionterranova.com/mining    → Mining pool
www.zionterranova.com/explorer  → Blockchain explorer
www.zionterranova.com/api       → REST API
www.zionterranova.com/docs      → Dokumentace
www.zionterranova.com/testnet/* → Testnet services
```

---

## 📦 Požadavky

### Software
- Ubuntu 22.04+ / Debian 11+ (nebo ekvivalent)
- Nginx 1.18+
- Certbot (pro SSL)
- Python 3.9+
- Git

### Přístupy
- Root přístup k serveru 91.98.122.165
- Přístup k DNS managementu domény zionterranova.com
- GitHub přístup k repozitáři

---

## 🔧 KROK 1: DNS Konfigurace

### 1.1 Nastavení DNS záznamů

Přihlaste se do svého DNS providera (GoDaddy, Cloudflare, Namecheap, atd.) a nastavte:

#### A Records:
```
Type    Name    Value           TTL
A       @       91.98.122.165   3600
A       www     91.98.122.165   3600
```

#### MX Records (Email):
```
Type    Name    Priority    Value
MX      @       10          mail.zionterranova.com
```

### 1.2 Ověření DNS propagace

Počkejte 10-60 minut a ověřte:

```bash
# Test A record
dig www.zionterranova.com +short
# Mělo by vrátit: 91.98.122.165

# Test propagace
nslookup www.zionterranova.com
```

---

## 🖥️ KROK 2: Příprava serveru

### 2.1 Připojení na server

```bash
ssh root@91.98.122.165
# Nebo s uživatelským účtem:
ssh your_username@91.98.122.165
```

### 2.2 Aktualizace systému

```bash
sudo apt update
sudo apt upgrade -y
```

### 2.3 Instalace základního software

```bash
# Nginx
sudo apt install nginx -y

# Certbot (SSL)
sudo apt install certbot python3-certbot-nginx -y

# Python a dependencies
sudo apt install python3 python3-pip python3-venv git -y

# Utility
sudo apt install curl wget htop nano -y
```

### 2.4 Kontrola Nginx

```bash
# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Status check
sudo systemctl status nginx

# Test v prohlížeči
curl http://91.98.122.165
# Mělo by vrátit default Nginx stránku
```

---

## 📂 KROK 3: Struktura adresářů

### 3.1 Vytvoření adresářů

```bash
# Hlavní web directory
sudo mkdir -p /var/www/zionterranova.com/html
sudo mkdir -p /var/www/zionterranova.com/logs

# Subdirectories pro různé služby
sudo mkdir -p /var/www/zionterranova.com/html/mining
sudo mkdir -p /var/www/zionterranova.com/html/explorer
sudo mkdir -p /var/www/zionterranova.com/html/api
sudo mkdir -p /var/www/zionterranova.com/html/docs
sudo mkdir -p /var/www/zionterranova.com/html/testnet

# ZION backend
sudo mkdir -p /opt/zion
```

### 3.2 Nastavení oprávnění

```bash
# Vytvoř ZION uživatele (pokud neexistuje)
sudo useradd -r -s /bin/bash -d /opt/zion zion

# Nastav ownership
sudo chown -R zion:zion /var/www/zionterranova.com
sudo chown -R zion:zion /opt/zion

# Nginx potřebuje read přístup
sudo chmod -R 755 /var/www/zionterranova.com/html
```

---

## 🌐 KROK 4: Deployment ZION aplikace

### 4.1 Clone repozitáře

```bash
# Switch na zion uživatele
sudo su - zion

# Clone hlavního repozitáře
cd /opt/zion
git clone https://github.com/estrelaisabellazion3/Zion-2.8.git
cd Zion-2.8

# Setup Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Instalace dependencies
pip install -r requirements.txt
```

### 4.2 Kopírování website souborů

```bash
# Kopíruj website soubory do web root
cp -r /opt/zion/Zion-2.8/website/* /var/www/zionterranova.com/html/

# Vytvoř symlinky pro dokumentaci
ln -s /opt/zion/Zion-2.8/docs /var/www/zionterranova.com/html/docs
```

### 4.3 Konfigurace environment

```bash
# Vytvoř production .env soubor
cd /opt/zion/Zion-2.8
cp .env.example .env.production

# Edituj .env.production
nano .env.production
```

**Přidej/změň tyto hodnoty:**
```bash
NODE_ENV=production
DOMAIN=www.zionterranova.com
API_PORT=8001
POOL_PORT=8181
CORS_ORIGINS=https://www.zionterranova.com
```

---

## ⚙️ KROK 5: Nginx konfigurace

### 5.1 Vytvoř Nginx config

```bash
sudo nano /etc/nginx/sites-available/zionterranova.com
```

**Vložte tuto konfiguraci:**

```nginx
# ZION Terra Nova - Main Configuration
# Domain: www.zionterranova.com
# Updated: 2025-11-09

# Rate limiting zones (per client IP)
limit_req_zone $binary_remote_addr zone=zion_api_rate:10m rate=100r/m;
limit_conn_zone $binary_remote_addr zone=zion_api_conn:10m;

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name zionterranova.com www.zionterranova.com;

    # ACME challenge for SSL
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://www.zionterranova.com$request_uri;
    }
}

# Redirect apex to www
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name zionterranova.com;

    # SSL configuration (will be added by Certbot)
    ssl_certificate /etc/letsencrypt/live/www.zionterranova.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.zionterranova.com/privkey.pem;

    return 301 https://www.zionterranova.com$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.zionterranova.com;

    # SSL configuration (will be added by Certbot)
    ssl_certificate /etc/letsencrypt/live/www.zionterranova.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.zionterranova.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # HSTS (optional but recommended)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self'; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https://zionterranova.com https://zionterranova.com/api https://zionterranova.com/pool; frame-ancestors 'none'; upgrade-insecure-requests" always;
    add_header Permissions-Policy "accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=(), fullscreen=(self), clipboard-read=(self), clipboard-write=(self)" always;

    # Root directory
    root /var/www/zionterranova.com/html;
    index index.html index.htm;

    # Logs
    access_log /var/www/zionterranova.com/logs/access.log;
    error_log /var/www/zionterranova.com/logs/error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # Main website
    location / {
        try_files $uri $uri/ /index.html;
    }

    # REST API
    location /api/ {
        limit_req zone=zion_api_rate burst=30 nodelay;
        limit_conn zion_api_conn 20;
        
        proxy_pass http://127.0.0.1:8001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # CORS headers
        add_header Access-Control-Allow-Origin "https://www.zionterranova.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        
        # Handle OPTIONS
        if ($request_method = OPTIONS) {
            return 204;
        }
    }

    # Mining Pool API
    location /mining/ {
        limit_req zone=zion_api_rate burst=15 nodelay;

        proxy_pass http://127.0.0.1:8181/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # WebSocket support for mining
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Blockchain Explorer
    location /explorer/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Documentation (static files)
    location /docs/ {
        alias /opt/zion/Zion-2.8/docs/;
        autoindex on;
        autoindex_exact_size off;
        autoindex_localtime on;
    }

    # Testnet section
    location /testnet/ {
        alias /var/www/zionterranova.com/html/testnet/;
        try_files $uri $uri/ /testnet/index.html;
    }

    # Static assets caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Deny access to sensitive files
    location ~ /\. {
        deny all;
    }

    location ~ /\.env {
        deny all;
    }

    location ~ /\.git {
        deny all;
    }
}
```

### 5.2 Aktivace konfigurace

```bash
# Vytvoř symlink
sudo ln -s /etc/nginx/sites-available/zionterranova.com /etc/nginx/sites-enabled/

# Odstraň default config (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test konfigurace
sudo nginx -t

# Pokud OK, reload Nginx
sudo systemctl reload nginx
```

---

## 🔒 KROK 6: SSL Certifikát (Let's Encrypt)

### 6.1 Získání certifikátu

```bash
# Zastavit Nginx dočasně
sudo systemctl stop nginx

# Získat certifikát
sudo certbot certonly --standalone -d zionterranova.com -d www.zionterranova.com

# Nebo s Nginx pluginem (pokud Nginx běží):
sudo certbot --nginx -d zionterranova.com -d www.zionterranova.com
```

**Postupujte podle instrukcí:**
- Zadejte email
- Souhlaste s TOS
- Vyberte redirect HTTP → HTTPS

### 6.2 Auto-renewal setup

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot vytvoří cron job automaticky, ale můžete ověřit:
sudo systemctl status certbot.timer

# Nebo manuální cron (pokud timer nefunguje):
sudo crontab -e
# Přidejte:
0 0,12 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

### 6.3 Restart Nginx se SSL

```bash
sudo systemctl start nginx
sudo systemctl status nginx
```

---

## 🚀 KROK 7: ZION Backend Services

### 7.1 Systemd service pro ZION API

```bash
sudo nano /etc/systemd/system/zion-api.service
```

**Obsah:**
```ini
[Unit]
Description=ZION Blockchain RPC API
After=network.target

[Service]
Type=simple
User=zion
Group=zion
WorkingDirectory=/opt/zion/Zion-2.8
Environment="PATH=/opt/zion/Zion-2.8/.venv/bin"
ExecStart=/opt/zion/Zion-2.8/.venv/bin/python src/core/zion_rpc_server.py
Restart=always
RestartSec=10

# Logs
StandardOutput=append:/var/log/zion/api/api.log
StandardError=append:/var/log/zion/api/error.log

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### 7.2 Systemd service pro Mining Pool

```bash
sudo nano /etc/systemd/system/zion-pool.service
```

**Obsah:**
```ini
[Unit]
Description=ZION Mining Pool (Stratum Server)
After=network.target

[Service]
Type=simple
User=zion
Group=zion
WorkingDirectory=/opt/zion/Zion-2.8
Environment="PATH=/opt/zion/Zion-2.8/.venv/bin"
ExecStart=/opt/zion/Zion-2.8/.venv/bin/python src/core/zion_universal_pool_v2.py
Restart=always
RestartSec=10

StandardOutput=append:/var/log/zion/pool/pool.log
StandardError=append:/var/log/zion/pool/error.log

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### 7.3 Systemd service pro Explorer

```bash
sudo nano /etc/systemd/system/zion-explorer.service
```

**Obsah:**
```ini
[Unit]
Description=ZION Blockchain Explorer Frontend
After=network.target

[Service]
Type=simple
User=zion
Group=zion
WorkingDirectory=/opt/zion/Zion-2.8/frontend
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10

Environment="PORT=3001"
Environment="NODE_ENV=production"

StandardOutput=append:/var/log/zion/explorer/explorer.log
StandardError=append:/var/log/zion/explorer/error.log

[Install]
WantedBy=multi-user.target
```

### 7.4 Vytvoření log directory

```bash
sudo mkdir -p /var/log/zion/api /var/log/zion/pool /var/log/zion/explorer
sudo chown -R zion:zion /var/log/zion
```

### 7.5 Start služeb

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable services (start on boot)
sudo systemctl enable zion-api
sudo systemctl enable zion-pool
sudo systemctl enable zion-explorer

# Start services
sudo systemctl start zion-api
sudo systemctl start zion-pool
sudo systemctl start zion-explorer

# Check status
sudo systemctl status zion-api
sudo systemctl status zion-pool
sudo systemctl status zion-explorer
```

### 7.6 Logrotate konfigurace

```bash
sudo cp /opt/zion/Zion-2.8/monitoring/logrotate.conf /etc/logrotate.d/zion
sudo logrotate -d /etc/logrotate.d/zion
```

> Po nasazení zkontroluj, že se logy rotují denně a maximální velikost souborů je 100 MB.

---

## 🔥 KROK 8: Firewall konfigurace

### 8.1 UFW setup

```bash
# Instalace (pokud není)
sudo apt install ufw -y

# Výchozí pravidla
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Povolení služeb
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw deny 8545/tcp  # RPC dostupné jen přes Nginx reverse proxy
sudo ufw allow 8181/tcp  # Mining pool API proxovaný přes Nginx
sudo ufw allow 8333/tcp  # P2P

# Enable firewall
sudo ufw enable

# Status
sudo ufw status verbose
```

---

## ✅ KROK 9: Ověření funkčnosti

### 9.1 Test v prohlížeči

Otevřete:
- https://www.zionterranova.com (hlavní web)
- https://www.zionterranova.com/mining (pool stats)
- https://www.zionterranova.com/explorer (blockchain)
- https://www.zionterranova.com/api (API endpoint)
- https://www.zionterranova.com/docs (dokumentace)

### 9.2 Test z terminálu

```bash
# Test hlavní stránky
curl -I https://www.zionterranova.com

# Test API
curl https://www.zionterranova.com/api/getblockcount

# Test SSL
openssl s_client -connect www.zionterranova.com:443 -servername www.zionterranova.com
```

### 9.3 Test rychlosti

```bash
# PageSpeed Insights
# Jděte na: https://pagespeed.web.dev/
# Zadejte: https://www.zionterranova.com

# SSL Labs
# Jděte na: https://www.ssllabs.com/ssltest/
# Zadejte: www.zionterranova.com
```

---

## 📊 KROK 10: Monitoring & Logs

### 10.1 Real-time logs

```bash
# Nginx access log
sudo tail -f /var/www/zionterranova.com/logs/access.log

# Nginx error log
sudo tail -f /var/www/zionterranova.com/logs/error.log

# ZION API log
sudo tail -f /var/log/zion/api/api.log

# Mining pool log
sudo tail -f /var/log/zion/pool/pool.log
```

### 10.2 Systemd journal

```bash
# API service logs
sudo journalctl -u zion-api -f

# Pool service logs
sudo journalctl -u zion-pool -f

# All ZION services
sudo journalctl -u zion-* -f
```

### 10.3 Nginx status

```bash
# Přidejte do Nginx config (v server bloku):
location /nginx_status {
    stub_status on;
    access_log off;
    allow 127.0.0.1;
    deny all;
}

# Pak můžete testovat:
curl http://localhost/nginx_status
```

---

## 🛠️ Troubleshooting

### Problém: 502 Bad Gateway

**Řešení:**
```bash
# Check backend services
sudo systemctl status zion-api
sudo systemctl status zion-pool

# Check if ports are listening
sudo netstat -tlnp | grep 8001
sudo netstat -tlnp | grep 8181

# Restart services
sudo systemctl restart zion-api
sudo systemctl restart nginx
```

### Problém: SSL certifikát nefunguje

**Řešení:**
```bash
# Renew certifikát
sudo certbot renew --force-renewal

# Check certifikát
sudo certbot certificates

# Test SSL config
sudo nginx -t
```

### Problém: Vysoká load

**Řešení:**
```bash
# Check system resources
htop

# Check Nginx connections
sudo netstat -an | grep :443 | wc -l

# Increase worker_processes v nginx.conf:
sudo nano /etc/nginx/nginx.conf
# worker_processes auto;
# worker_connections 4096;
```

---

## 📈 Performance Optimizations

### Nginx optimizace

Editujte `/etc/nginx/nginx.conf`:

```nginx
user www-data;
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    # FastCGI cache (pro dynamický obsah)
    fastcgi_cache_path /var/cache/nginx levels=1:2 keys_zone=ZION:100m inactive=60m;
    fastcgi_cache_key "$scheme$request_method$host$request_uri";
    
    # Connection timeouts
    keepalive_timeout 65;
    keepalive_requests 100;
    
    # Buffer sizes
    client_body_buffer_size 128k;
    client_max_body_size 10m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 16k;
}
```

---

## 🔄 Maintenance

### Denní úkoly
```bash
# Check disk space
df -h

# Check logs
sudo find /var/log/zion -name "*.log" -exec tail -n 50 {} +

# Check services
sudo systemctl status zion-*
```

### Týdenní úkoly
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Clean logs (starší než 7 dní)
sudo find /var/log/zion -name "*.log" -mtime +7 -delete

# Restart services (pokud potřeba)
sudo systemctl restart zion-api zion-pool
```

### Měsíční úkoly
```bash
# SSL renewal check
sudo certbot renew --dry-run

# Database backup
sudo -u zion /opt/zion/scripts/backup.sh

# Security updates
sudo apt list --upgradable | grep security
```

---

## 📞 Support

### Contacts
- **Technical Issues:** dev@zionterranova.com
- **Security Issues:** security@zionterranova.com
- **Discord:** https://discord.gg/zion

### Užitečné odkazy
- **Nginx Docs:** https://nginx.org/en/docs/
- **Let's Encrypt:** https://letsencrypt.org/docs/
- **UFW Guide:** https://help.ubuntu.com/community/UFW

---

## ✅ Checklist pro kompletní setup

- [ ] DNS A records nastaveny
- [ ] Server připraven (Ubuntu, updates)
- [ ] Nginx nainstalován
- [ ] Adresáře vytvořeny
- [ ] ZION repo naklonován
- [ ] Nginx config vytvořen a aktivován
- [ ] SSL certifikát získán
- [ ] Systemd services vytvořeny
- [ ] Services spuštěny a enabled
- [ ] Firewall nakonfigurován
- [ ] Website funkční v prohlížeči
- [ ] API endpoint funkční
- [ ] Mining pool dostupný
- [ ] Monitoring nastaven
- [ ] Backup strategie připravena

---

**🎉 Gratulujeme! Vaše doména www.zionterranova.com je plně funkční!**

**Poslední aktualizace:** 29. října 2025  
**Verze:** 1.0  
**ZION Terra Nova Deployment Guide**
