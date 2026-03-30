# ✅ ZION 2.8.3 Phase 2 - Execution Checklist

**Timeline:** November 1-2, 2025  
**Duration:** ~8 hours  
**Team:** DevOps + Infrastructure  
**Status:** AWAITING PHASE 1 COMPLETION  

---

## 📋 Pre-Execution Checklist (Oct 31 - Nov 1)

### **Preparation Day: October 31**

- [ ] Verify Phase 1 completion with `verify_phase1_complete.sh`
- [ ] Review Phase 2 documentation (PHASE_2_PREPARATION_GUIDE.md)
- [ ] Confirm Webglobe DNS admin access works
- [ ] Test SSH connectivity to server (91.98.122.165)
- [ ] Verify Nginx is running: `systemctl status nginx`
- [ ] Backup current Nginx configuration locally
- [ ] Ensure Let's Encrypt prerequisites are met:
  - [ ] Ports 80 and 443 are open
  - [ ] Certbot can reach Let's Encrypt servers
- [ ] Document start time and contact info for support

**Checklist Owner:** DevOps Lead  
**Target Completion:** Oct 31, 18:00 UTC

---

## 🚀 Day 1: Friday, November 1, 2025

### **Step 1: Initial Verification (09:00-09:15)**

```bash
# Check server status
ssh zion@91.98.122.165 "systemctl status nginx | head -10"

# Verify ports are open
ssh zion@91.98.122.165 "sudo netstat -tlnp | grep -E ':(80|443|8545|3333)'"
```

- [ ] Server is reachable via SSH
- [ ] Nginx is running
- [ ] Ports 80, 443, 8545, 3333 are listening
- [ ] System time is synchronized

**Owner:** DevOps  
**Target:** 09:15 UTC

---

### **Step 2: DNS Configuration (09:15-10:15)**

#### **Webglobe Console Actions:**

1. **Login to Webglobe**
   - [ ] Open https://admin.webglobe.cz
   - [ ] Authenticate with credentials
   - [ ] Navigate to DNS for `zion-testnet.io`

2. **Add A Record - Main Domain**
   - [ ] Name: `zion-testnet.io`
   - [ ] Type: `A`
   - [ ] Value: `91.98.122.165`
   - [ ] TTL: `3600`
   - [ ] Priority: `10`
   - [ ] Save and verify ✓

3. **Add A Record - Wildcard**
   - [ ] Name: `*.zion-testnet.io`
   - [ ] Type: `A`
   - [ ] Value: `91.98.122.165`
   - [ ] TTL: `3600`
   - [ ] Save and verify ✓

4. **Add CAA Record**
   - [ ] Name: `zion-testnet.io`
   - [ ] Type: `CAA`
   - [ ] Flags: `0`
   - [ ] Tag: `issue`
   - [ ] Value: `"letsencrypt.org"`
   - [ ] Save and verify ✓

5. **Request DKIM (from email provider)**
   - [ ] Contact email provider
   - [ ] Request DKIM public key
   - [ ] Save for later configuration
   - [ ] Status: PENDING (configure in Phase 4)

6. **Add DMARC Record**
   - [ ] Name: `_dmarc.zion-testnet.io`
   - [ ] Type: `TXT`
   - [ ] Value: `v=DMARC1; p=quarantine; rua=mailto:admin@zion-testnet.io; pct=100`
   - [ ] Save and verify ✓

#### **Local Verification:**
```bash
# After 5-10 minutes, verify DNS propagation
dig zion-testnet.io @8.8.8.8
dig *.zion-testnet.io @8.8.8.8
dig zion-testnet.io CAA @8.8.8.8

# Check Google DNS propagation
dig zion-testnet.io @1.1.1.1
```

- [ ] All DNS records visible in Webglobe console
- [ ] DNS propagation started (8.8.8.8 or 1.1.1.1 responding)
- [ ] A record resolves to 91.98.122.165
- [ ] Wildcard record resolves correctly
- [ ] CAA record present and correct

**Owner:** Domain Admin  
**Target:** 10:15 UTC  
**Contact:** [Webglobe Support if needed]

---

### **Step 3: SSL Certificate Generation (10:15-12:15)**

```bash
# SSH to server
ssh zion@91.98.122.165

# Check firewall allows port 80 (needed for ACME challenge)
sudo ufw allow 80/tcp

# Make script executable
chmod +x ~/scripts/phase2_dns_domain_setup.sh

# Run Phase 2 script (with sudo for system operations)
sudo ~/scripts/phase2_dns_domain_setup.sh
```

**Script Execution Progress:**

- [ ] Step 1/6: Configuration verified
  - HTTP connectivity OK
  - Nginx running
  - Backup created

- [ ] Step 2/6: DNS records configured
  - Manual dialog (press Enter after DNS configured)
  - DNS propagation checked
  - A record verified
  - Wildcard verified

- [ ] Step 3/6: SSL certificates obtained
  - Certbot installed
  - Certificate request sent to Let's Encrypt
  - Certificate obtained for `zion-testnet.io` and `*.zion-testnet.io`
  - Auto-renewal configured
  - Certificate expiry date shown

- [ ] Step 4/6: Nginx configured
  - Nginx config updated
  - Configuration test passed
  - Nginx reloaded
  - HTTPS enabled on port 443

- [ ] Step 5/6: HTTPS tested
  - HTTPS connectivity verified
  - SSL certificate validated
  - API endpoint responding

- [ ] Step 6/6: Landing pages deployed
  - Landing page created at `/var/www/zion-testnet/index.html`
  - Documentation directory created
  - Status file created

**Owner:** DevOps  
**Target:** 12:15 UTC

---

### **Step 4: Manual DNS Propagation Wait (12:15-13:15)**

```bash
# Check DNS propagation progress
watch -n 10 'dig zion-testnet.io @8.8.8.8 +short'

# Use multiple DNS servers to check
dig zion-testnet.io @8.8.8.8
dig zion-testnet.io @1.1.1.1
dig zion-testnet.io @208.67.222.222

# Check from your local machine
nslookup zion-testnet.io

# Optional: Use online DNS checker
# https://dnschecker.org (search: zion-testnet.io)
```

**DNS Propagation Checklist:**
- [ ] 8.8.8.8 (Google) responds with 91.98.122.165
- [ ] 1.1.1.1 (Cloudflare) responds with 91.98.122.165
- [ ] 208.67.222.222 (OpenDNS) responds with 91.98.122.165
- [ ] Local resolver responds with 91.98.122.165
- [ ] Wildcard resolves (e.g., `api.zion-testnet.io`)

**Owner:** DevOps  
**Target:** 13:15 UTC  
**Note:** If DNS not propagated, wait up to 30 minutes total

---

### **Daily Summary: End of Day 1 (17:00)**

```bash
# Final verification before close-of-day
# Run these tests and log results

# 1. DNS check
dig zion-testnet.io @8.8.8.8

# 2. Certificate check
echo | openssl s_client -connect 91.98.122.165:443 -servername zion-testnet.io | openssl x509 -noout -dates

# 3. HTTPS test
curl -I https://zion-testnet.io

# 4. Firewall status
ssh zion@91.98.122.165 "sudo ufw status"
```

- [ ] DNS fully propagated globally
- [ ] SSL certificate valid and installed
- [ ] HTTPS working (at least from command line)
- [ ] Day 1 tasks completed
- [ ] Ready for Day 2

**Owner:** DevOps Lead  
**Target:** 17:00 UTC

---

## 🚀 Day 2: Saturday, November 2, 2025

### **Step 5: HTTPS Connectivity Testing (10:00-11:00)**

```bash
# Full HTTPS testing suite
# Run from different machines to ensure global access

# Test 1: Main domain
curl -I https://zion-testnet.io
curl -L https://zion-testnet.io -o /dev/null -w "HTTP Status: %{http_code}\n"

# Test 2: With certificate verification
curl --cacert /etc/ssl/certs/ca-certificates.crt https://zion-testnet.io

# Test 3: Check security headers
curl -I https://zion-testnet.io | grep -E "Strict-Transport|X-Content-Type|X-Frame"

# Test 4: SSL certificate details
echo | openssl s_client -connect zion-testnet.io:443 -servername zion-testnet.io | \
  openssl x509 -noout -text | grep -E "Subject|Issuer|Valid"

# Test 5: Certificate chain
openssl s_client -connect zion-testnet.io:443 -showcerts </dev/null
```

**HTTPS Testing Checklist:**

- [ ] curl returns HTTP 200 OK
- [ ] Certificate verification passes
- [ ] No certificate errors
- [ ] Certificate issuer is Let's Encrypt
- [ ] Security headers present:
  - [ ] `strict-transport-security`
  - [ ] `x-content-type-options: nosniff`
  - [ ] `x-frame-options: SAMEORIGIN`
- [ ] Certificate valid for `zion-testnet.io` and `*.zion-testnet.io`
- [ ] HTTPS works from public internet

**Owner:** QA / DevOps  
**Target:** 11:00 UTC

---

### **Step 6: API Endpoint Configuration (11:00-12:00)**

```bash
# Test RPC endpoint through HTTPS
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  https://zion-testnet.io/api/rpc

# Expected response: {"jsonrpc":"2.0","result":"0x...","id":1}

# Test through subdomain (if configured)
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  https://api.zion-testnet.io

# Test pool endpoint
curl -s https://pool.zion-testnet.io | head -20
```

**API Endpoint Checklist:**

- [ ] `/api/rpc` endpoint responds to RPC calls
- [ ] Returns valid JSON-RPC responses
- [ ] `eth_blockNumber` returns valid hex value
- [ ] `eth_chainId` returns correct chain ID
- [ ] Rate limiting allows normal usage
- [ ] CORS headers present (if needed)
- [ ] Subdomain routing works (`api.zion-testnet.io`)
- [ ] Pool endpoint accessible and responding

**Owner:** DevOps  
**Target:** 12:00 UTC

---

### **Step 7: Subdomain Setup & Verification (12:00-13:00)**

```bash
# Test all subdomains
dig api.zion-testnet.io +short
dig pool.zion-testnet.io +short
dig explorer.zion-testnet.io +short
dig docs.zion-testnet.io +short

# Test HTTPS for each
curl -I https://api.zion-testnet.io
curl -I https://pool.zion-testnet.io
curl -I https://docs.zion-testnet.io

# Check certificate validity for subdomains
echo | openssl s_client -connect api.zion-testnet.io:443 -servername api.zion-testnet.io | \
  openssl x509 -noout -text | grep -E "DNS:"
```

**Subdomain Checklist:**

- [ ] `api.zion-testnet.io` → 91.98.122.165 (DNS)
- [ ] `pool.zion-testnet.io` → 91.98.122.165 (DNS)
- [ ] `explorer.zion-testnet.io` → 91.98.122.165 (DNS)
- [ ] `docs.zion-testnet.io` → 91.98.122.165 (DNS)
- [ ] All resolve via HTTPS
- [ ] SSL certificates valid for all subdomains
- [ ] Nginx routing working for each subdomain
- [ ] No certificate warnings

**Owner:** QA  
**Target:** 13:00 UTC

---

### **Step 8: Documentation & Landing Pages (13:00-14:00)**

```bash
# Check landing page
curl https://zion-testnet.io

# Check documentation
curl https://zion-testnet.io/docs

# Check status file
curl https://zion-testnet.io/.status

# Verify HTML rendering
lynx -dump https://zion-testnet.io  # or open in browser

# Check CSS and assets load
curl -I https://zion-testnet.io/style.css (if exists)
```

**Landing Page Checklist:**

- [ ] Main landing page loads at `https://zion-testnet.io`
- [ ] Shows ZION 2.8.3 Testnet branding
- [ ] Contains links to API, Pool, Explorer, Docs
- [ ] Status shows "All services operational"
- [ ] SSL/TLS enabled badge visible
- [ ] Documentation accessible at `/docs`
- [ ] Documentation index loads correctly
- [ ] Status file returns valid JSON
- [ ] Mobile responsive design works

**Owner:** QA  
**Target:** 14:00 UTC

---

### **Final Verification: End of Day 2 (14:00-15:00)**

```bash
# Comprehensive final verification script
cat << 'EOF' > phase2_final_check.sh
#!/bin/bash

echo "=== ZION 2.8.3 Phase 2 Final Verification ==="

# DNS checks
echo "1. DNS Resolution:"
dig zion-testnet.io @8.8.8.8 +short
dig *.zion-testnet.io @8.8.8.8 +short

# HTTPS check
echo "2. HTTPS Connectivity:"
curl -I https://zion-testnet.io 2>/dev/null | head -1

# Certificate check
echo "3. SSL Certificate:"
echo | openssl s_client -connect zion-testnet.io:443 -servername zion-testnet.io 2>/dev/null | \
  openssl x509 -noout -dates

# RPC endpoint check
echo "4. RPC Endpoint:"
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  https://api.zion-testnet.io | head -c 100

# Subdomain check
echo "5. Subdomain Resolution:"
dig api.zion-testnet.io +short
dig pool.zion-testnet.io +short

echo "=== All checks complete ==="
EOF

chmod +x phase2_final_check.sh
./phase2_final_check.sh
```

**Phase 2 Final Checklist:**

- [ ] All DNS records configured and propagating
- [ ] SSL certificates installed and valid
- [ ] Nginx configuration complete and reloaded
- [ ] HTTPS connectivity verified
- [ ] RPC endpoint responding to calls
- [ ] All subdomains resolving
- [ ] Landing pages deployed
- [ ] Documentation accessible
- [ ] Security headers present
- [ ] No errors in nginx/certbot logs

**Owner:** DevOps Lead  
**Target:** 15:00 UTC

---

## 📊 Phase 2 Status Summary

### **Success Indicators:**

✅ **Phase 2 Complete When:**

1. **DNS**
   - [ ] A record: `zion-testnet.io` → `91.98.122.165`
   - [ ] Wildcard: `*.zion-testnet.io` → `91.98.122.165`
   - [ ] CAA record: authorizes Let's Encrypt
   - [ ] DMARC record: configured for email protection

2. **SSL/TLS**
   - [ ] Certificate issued for wildcard
   - [ ] Valid for 1 year
   - [ ] Auto-renewal configured
   - [ ] No certificate errors

3. **Nginx**
   - [ ] Configuration complete
   - [ ] Service running
   - [ ] Ports 80, 443 listening
   - [ ] Path-based routing working

4. **Endpoints**
   - [ ] Main: `https://zion-testnet.io` → OK
   - [ ] API: `https://api.zion-testnet.io` → RPC responding
   - [ ] Pool: `https://pool.zion-testnet.io` → Accessible
   - [ ] Docs: `https://docs.zion-testnet.io` → Loading

5. **Documentation**
   - [ ] Landing page deployed
   - [ ] Documentation index created
   - [ ] Status file accessible
   - [ ] Security headers sent

---

## 🚨 Issue Resolution

### **If DNS doesn't propagate:**
- [ ] Verify records in Webglobe console
- [ ] Check TTL expiration (wait up to 1 hour)
- [ ] Clear local DNS cache: `sudo systemd-resolve --flush-caches`
- [ ] Try different DNS servers (8.8.8.8, 1.1.1.1, 208.67.222.222)

### **If SSL certificate fails:**
- [ ] Check ports 80/443 are open: `ufw status`
- [ ] Verify CAA record allows Let's Encrypt
- [ ] Check DNS is fully propagated before cert request
- [ ] Run: `sudo certbot renew --force-renewal -v`

### **If Nginx won't reload:**
- [ ] Test config: `sudo nginx -t`
- [ ] View error: `sudo nginx -T 2>&1 | grep error`
- [ ] Restore from backup: `sudo cp -r /mnt/backup/phase2-*/nginx-backup-*/* /etc/nginx/`
- [ ] Check logs: `sudo journalctl -u nginx -f`

---

## 📈 Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| DNS Resolution Time | < 1 minute | — |
| SSL Certificate Validity | 365 days | — |
| HTTPS Response Time | < 200ms | — |
| RPC Endpoint Uptime | 99.9% | — |
| Subdomain Coverage | 4 subdomains | — |
| Security Score | A+ | — |

---

## ✅ Sign-Off

**Phase 2 Owner:** DevOps Lead  
**Review Date:** November 2, 2025  
**Completion Status:** [PENDING EXECUTION]

**Next Phase:** Phase 3 - Code Cleanup & Binary Compilation (Nov 3-8)

---

**Generated:** October 29, 2025  
**Last Updated:** October 29, 2025  
**Document Version:** 1.0

---

### Execution Log

```
Date & Time: _______________
Executed By: _______________
DNS Config:   _____ Start    _____ End    Status: ____
Certs:        _____ Start    _____ End    Status: ____
Nginx:        _____ Start    _____ End    Status: ____
Testing:      _____ Start    _____ End    Status: ____
Final Verify: _____ Start    _____ End    Status: ____

Overall Status: ___________
Issues Encountered: ___________
Resolution Steps: ___________

Sign-Off: _____________ Date: _________
```
