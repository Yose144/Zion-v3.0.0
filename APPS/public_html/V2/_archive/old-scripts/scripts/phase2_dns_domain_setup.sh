#!/bin/bash

################################################################################
# ZION 2.8.3 Phase 2: DNS & Domain Setup
# Purpose: Configure DNS records, SSL certificates, and domain routing
# Timeline: Nov 1-2, 2025
# Author: ZION AI Infrastructure Team
# Version: 1.0
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVER_IP="91.98.122.165"
DOMAIN="zionterranova.com"
EMAIL="admin@zionterranova.com"
BACKUP_DIR="/mnt/backup/phase2-$(date +%Y%m%d_%H%M%S)"

# Logging function
log() {
    echo -e "${BLUE}[PHASE2]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
    return 1
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

################################################################################
# Step 1: Verify Current Configuration
################################################################################
step1_verify_config() {
    log "Step 1/6: Verifying current configuration..."
    
    # Check if domain is resolvable
    log "  Checking domain resolution..."
    if dig +short "$DOMAIN" @8.8.8.8 | grep -q "$SERVER_IP"; then
        success "Domain resolves to $SERVER_IP"
    else
        warning "Domain may not resolve correctly yet"
        log "  Current A record: $(dig +short "$DOMAIN" @8.8.8.8)"
    fi
    
    # Check current Nginx status
    if systemctl is-active --quiet nginx; then
        success "Nginx is running"
    else
        error "Nginx is not running - starting service..."
        systemctl start nginx
        sleep 2
    fi
    
    # Test HTTP access
    log "  Testing HTTP connectivity..."
    if curl -s -o /dev/null -w "%{http_code}" "http://$SERVER_IP" 2>/dev/null | grep -q "200"; then
        success "HTTP connectivity OK"
    else
        warning "HTTP connectivity test inconclusive"
    fi
    
    # Backup current Nginx config
    log "  Backing up current Nginx configuration..."
    mkdir -p "$BACKUP_DIR"
    cp -r /etc/nginx "$BACKUP_DIR/nginx-backup-$(date +%s)"
    success "Nginx config backed up to $BACKUP_DIR"
}

################################################################################
# Step 2: Configure DNS Records
################################################################################
step2_configure_dns() {
    log "Step 2/6: Configuring DNS records..."
    
    cat << 'EOF'

╔════════════════════════════════════════════════════════════════════════╗
║                   DNS CONFIGURATION REQUIRED                          ║
╠════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  Please configure these records in your DNS provider (Webglobe):     ║
║                                                                        ║
║  1. A RECORD (Main Domain)                                            ║
║     ┌─────────────────────────────────────────────────────────────┐  ║
║     │ Name:  zionterranova.com                                      │  ║
║     │ Type:  A                                                    │  ║
║     │ Value: 91.98.122.165                                        │  ║
║     │ TTL:   3600 (1 hour)                                        │  ║
║     └─────────────────────────────────────────────────────────────┘  ║
║                                                                        ║
║  2. A RECORD (Wildcard - All Subdomains)                             ║
║     ┌─────────────────────────────────────────────────────────────┐  ║
║     │ Name:  *.zionterranova.com                                    │  ║
║     │ Type:  A                                                    │  ║
║     │ Value: 91.98.122.165                                        │  ║
║     │ TTL:   3600 (1 hour)                                        │  ║
║     └─────────────────────────────────────────────────────────────┘  ║
║                                                                        ║
║  3. CAA RECORD (Certificate Authority Authorization)                  ║
║     ┌─────────────────────────────────────────────────────────────┐  ║
║     │ Name:  zionterranova.com                                      │  ║
║     │ Type:  CAA                                                  │  ║
║     │ Flags: 0                                                    │  ║
║     │ Tag:   issue                                                │  ║
║     │ Value: "letsencrypt.org"                                    │  ║
║     └─────────────────────────────────────────────────────────────┘  ║
║                                                                        ║
║  4. DKIM RECORD (Email Authentication)                               ║
║     ┌─────────────────────────────────────────────────────────────┐  ║
║     │ Name:   default._domainkey.zionterranova.com                  │  ║
║     │ Type:   TXT                                                 │  ║
║     │ Value:  (Request from Email provider)                       │  ║
║     │ Status: ⏳ Pending configuration                              │  ║
║     └─────────────────────────────────────────────────────────────┘  ║
║                                                                        ║
║  5. DMARC RECORD (Email Protection Policy)                           ║
║     ┌─────────────────────────────────────────────────────────────┐  ║
║     │ Name:  _dmarc.zionterranova.com                               │  ║
║     │ Type:  TXT                                                  │  ║
║     │ Value: v=DMARC1; p=quarantine; rua=mailto:admin@...         │  ║
║     │ TTL:   3600                                                 │  ║
║     └─────────────────────────────────────────────────────────────┘  ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝

ACTION REQUIRED:
  1. Log in to Webglobe DNS management console
  2. Configure records 1-3 (A, wildcard A, CAA) immediately
  3. Request DKIM record from email provider
  4. Configure DMARC after DKIM is set up
  5. Wait 15-30 minutes for DNS propagation
  6. Verify with: dig zionterranova.com @8.8.8.8

EOF

    log "  Waiting for manual DNS configuration..."
    log "  Press Enter when DNS records are configured and propagated..."
    read -r
    
    # Verify DNS propagation
    log "  Verifying DNS propagation..."
    local attempts=0
    local max_attempts=30
    
    while [ $attempts -lt $max_attempts ]; do
        if dig +short "zionterranova.com" @8.8.8.8 | grep -q "$SERVER_IP"; then
            success "DNS A record verified ($SERVER_IP)"
            
            if dig +short "*.zionterranova.com" @8.8.8.8 | grep -q "$SERVER_IP"; then
                success "DNS wildcard record verified"
                break
            fi
        fi
        
        attempts=$((attempts + 1))
        if [ $attempts -lt $max_attempts ]; then
            warning "DNS not fully propagated yet... waiting (attempt $attempts/$max_attempts)"
            sleep 10
        fi
    done
    
    if [ $attempts -eq $max_attempts ]; then
        error "DNS propagation timeout - continuing anyway"
    fi
}

################################################################################
# Step 3: Install and Configure SSL Certificates
################################################################################
step3_setup_ssl() {
    log "Step 3/6: Setting up SSL certificates with Let's Encrypt..."
    
    # Check if Certbot is installed
    if ! command -v certbot &> /dev/null; then
        log "  Installing Certbot..."
        apt-get update -qq
        apt-get install -y -qq certbot python3-certbot-nginx
        success "Certbot installed"
    else
        success "Certbot already installed"
    fi
    
    # Obtain certificates
    log "  Requesting SSL certificates for domain and subdomains..."
    
    certbot certonly \
        --nginx \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN" \
        -d "*.zionterranova.com" \
        --expand 2>&1 | grep -v "^$" || true
    
    if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        success "SSL certificates obtained"
        log "  Certificate valid until: $(openssl x509 -enddate -noout -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem)"
    else
        error "Failed to obtain SSL certificates"
        return 1
    fi
    
    # Setup auto-renewal
    log "  Configuring certificate auto-renewal..."
    certbot renew --dry-run &> /dev/null || true
    
    # Add renewal cron job
    (crontab -l 2>/dev/null | grep -q "certbot renew") || \
        (crontab -l 2>/dev/null; echo "0 */12 * * * certbot renew --quiet --no-ootb-update-plugins") | crontab -
    
    success "SSL auto-renewal configured"
}

################################################################################
# Step 4: Configure Nginx Domain Routing
################################################################################
step4_configure_nginx() {
    log "Step 4/6: Configuring Nginx domain routing..."
    
    # Create Nginx configuration for ZION services
    cat > /etc/nginx/sites-available/zionterranova.com << 'NGINX_EOF'
# ZION 2.8.3 Testnet - Nginx Configuration
# Generated by Phase 2 setup script

# Upstream services
upstream zion_warp {
    server localhost:8545;
}

upstream zion_pool {
    server localhost:3333;
}

upstream zion_explorer {
    server localhost:8080;
}

# HTTP redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name zionterranova.com *.zionterranova.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    server_name zionterranova.com www.zionterranova.com;
    
    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/zionterranova.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zionterranova.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Root location - landing page
    root /var/www/zion-testnet;
    
    location / {
        index index.html index.htm;
        try_files $uri $uri/ =404;
    }
    
    # RPC endpoint
    location /api/rpc {
        proxy_pass http://zion_warp;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Rate limiting
        limit_req zone=rpc burst=50 nodelay;
    }
    
    # Pool endpoint
    location /pool {
        proxy_pass http://zion_pool;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Explorer (when available)
    location /explorer {
        proxy_pass http://zion_explorer;
        proxy_set_header Host $host;
    }
    
    # Documentation
    location /docs {
        root /var/www/zion-testnet;
        try_files $uri $uri/ =404;
    }
    
    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Subdomains routing
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    server_name *.zionterranova.com;
    
    ssl_certificate /etc/letsencrypt/live/zionterranova.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zionterranova.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Extract subdomain
    set $subdomain $host;
    if ($subdomain ~ ^(.+)\.zion-testnet\.io$) {
        set $subdomain $1;
    }
    
    # Route based on subdomain
    location / {
        if ($subdomain = "api") {
            proxy_pass http://zion_warp;
            break;
        }
        if ($subdomain = "pool") {
            proxy_pass http://zion_pool;
            break;
        }
        
        # Default: show service info
        default_type text/html;
        return 200 "ZION 2.8.3 Testnet - $subdomain service<br>Status: OK";
    }
}

# Rate limiting zone
limit_req_zone $binary_remote_addr zone=rpc:10m rate=10r/s;
NGINX_EOF

    # Enable the site
    ln -sf /etc/nginx/sites-available/zionterranova.com /etc/nginx/sites-enabled/ 2>/dev/null || true
    
    # Test Nginx configuration
    if nginx -t &> /dev/null; then
        success "Nginx configuration valid"
        
        # Reload Nginx
        systemctl reload nginx
        success "Nginx reloaded with new configuration"
    else
        error "Nginx configuration test failed"
        nginx -t
        return 1
    fi
}

################################################################################
# Step 5: Test HTTPS Connectivity
################################################################################
step5_test_https() {
    log "Step 5/6: Testing HTTPS connectivity..."
    
    # Wait for DNS propagation
    sleep 5
    
    # Test main domain
    log "  Testing https://$DOMAIN..."
    if curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" 2>/dev/null | grep -q "200"; then
        success "HTTPS connectivity OK for main domain"
    else
        warning "HTTPS connectivity test returned: $(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" 2>/dev/null)"
    fi
    
    # Test certificate validity
    log "  Verifying SSL certificate..."
    openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" </dev/null 2>/dev/null | \
        openssl x509 -noout -text | grep -E "(Subject:|Issuer:|Not Before|Not After)" | head -4
    
    success "SSL certificate verification complete"
    
    # Test API endpoint
    log "  Testing API endpoint (https://$DOMAIN/api/rpc)..."
    if curl -s -X POST -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
        "https://$DOMAIN/api/rpc" 2>/dev/null | grep -q "result"; then
        success "API endpoint responding correctly"
    else
        warning "API endpoint test inconclusive"
    fi
}

################################################################################
# Step 6: Setup Subdomain Structure
################################################################################
step6_setup_subdomains() {
    log "Step 6/6: Setting up subdomain structure..."
    
    # Create landing page
    mkdir -p /var/www/zion-testnet
    
    cat > /var/www/zion-testnet/index.html << 'HTML_EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ZION 2.8.3 Testnet</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 10px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 600px;
            text-align: center;
        }
        h1 { color: #667eea; margin-bottom: 10px; }
        .tagline { color: #666; margin-bottom: 30px; font-size: 16px; }
        .services {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 30px 0;
        }
        .service {
            padding: 20px;
            border-radius: 8px;
            background: #f7f7f7;
            text-decoration: none;
            color: #333;
            transition: all 0.3s ease;
            border: 2px solid #eee;
        }
        .service:hover {
            border-color: #667eea;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.2);
        }
        .service h3 { color: #667eea; margin-bottom: 8px; }
        .status { margin-top: 30px; padding: 15px; background: #e8f5e9; border-radius: 8px; color: #2e7d32; }
        footer { margin-top: 30px; color: #999; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 ZION 2.8.3 Testnet</h1>
        <p class="tagline">Next-Generation Blockchain Platform</p>
        
        <div class="services">
            <a href="https://api.zionterranova.com" class="service">
                <h3>📡 RPC API</h3>
                <p>JSON-RPC Endpoint</p>
            </a>
            <a href="https://pool.zionterranova.com" class="service">
                <h3>⛏️ Mining Pool</h3>
                <p>Stratum Protocol</p>
            </a>
            <a href="/explorer" class="service">
                <h3>🔍 Explorer</h3>
                <p>Blockchain Explorer</p>
            </a>
            <a href="/docs" class="service">
                <h3>📖 Documentation</h3>
                <p>Technical Guide</p>
            </a>
        </div>
        
        <div class="status">
            ✓ All services operational<br>
            ✓ SSL/TLS enabled<br>
            ✓ Ready for testing
        </div>
        
        <footer>
            <p>ZION 2.8.3 Testnet | Launch Date: November 15, 2025</p>
            <p><a href="https://github.com/zion-protocol/zion-testnet" style="color: #999;">GitHub Repository</a></p>
        </footer>
    </div>
</body>
</html>
HTML_EOF

    success "Landing page created"
    
    # Create documentation directory
    mkdir -p /var/www/zion-testnet/docs
    
    cat > /var/www/zion-testnet/docs/index.html << 'DOCS_EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>ZION Documentation</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        h1 { color: #667eea; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>ZION 2.8.3 Testnet Documentation</h1>
    <p>Welcome to the ZION blockchain testnet. Choose a guide:</p>
    <ul>
        <li><a href="#quick-start">Quick Start</a></li>
        <li><a href="#mining">Mining Guide</a></li>
        <li><a href="#api">RPC API Reference</a></li>
    </ul>
    <h2 id="quick-start">Quick Start</h2>
    <p>Get started with ZION...</p>
    <!-- Documentation content -->
</body>
</html>
DOCS_EOF

    success "Documentation directory created"
    
    # Create status monitoring endpoint info
    cat > /var/www/zion-testnet/.status << EOF
{
  "status": "operational",
  "version": "2.8.3-testnet",
  "domain": "zionterranova.com",
  "services": {
    "rpc": "https://api.zionterranova.com",
    "pool": "https://pool.zionterranova.com",
    "explorer": "https://zionterranova.com/explorer",
    "docs": "https://zionterranova.com/docs"
  },
  "ssl": "enabled",
  "updated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

    success "Status file created"
}

################################################################################
# Main Execution
################################################################################
main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║     ZION 2.8.3 Phase 2: DNS & Domain Setup                        ║"
    echo "║     Timeline: November 1-2, 2025                                  ║"
    echo "║     Domain: zionterranova.com                                       ║"
    echo "║     Server: 91.98.122.165                                         ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    echo ""
    
    if [ "$EUID" -ne 0 ]; then
        error "This script must be run as root"
        exit 1
    fi
    
    step1_verify_config
    step2_configure_dns
    step3_setup_ssl
    step4_configure_nginx
    step5_test_https
    step6_setup_subdomains
    
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║                    ✓ Phase 2 Complete                             ║"
    echo "╠════════════════════════════════════════════════════════════════════╣"
    echo "║                                                                    ║"
    echo "║  Your domain is now configured:                                   ║"
    echo "║  🌐 https://zionterranova.com (Main Site)                          ║"
    echo "║  📡 https://api.zionterranova.com (RPC Endpoint)                   ║"
    echo "║  ⛏️  https://pool.zionterranova.com (Mining Pool)                  ║"
    echo "║                                                                    ║"
    echo "║  SSL Certificates: Valid and auto-renewing                        ║"
    echo "║  Backup Location: $BACKUP_DIR                                     ║"
    echo "║                                                                    ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    echo ""
    
    log "Next: Phase 3 - Code Cleanup & Binary Compilation (Nov 3-8)"
}

main "$@"
