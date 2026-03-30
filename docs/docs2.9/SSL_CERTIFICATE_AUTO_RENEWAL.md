# SSL/TLS Certificate Auto-Renewal Configuration

## 📋 Overview

ZION v2.9 uses Let's Encrypt SSL certificates with automatic renewal via certbot and systemd timers.

**Status:** ✅ Active | **Certificate:** zionterranova.com | **Renewal:** Twice daily | **Expiry:** 40 days

---

## 🔐 Current Certificate Status

```
Certificate Name: zionterranova.com
Domains: zionterranova.com, www.zionterranova.com
Type: ECDSA
Expiry Date: 2026-01-28 05:05:02 UTC
Days Remaining: 40
Auto-Renewal: Enabled (systemd timer)
```

**Check Current Status:**
```bash
ssh root@91.98.122.165 "/root/zion-v2.9/scripts/check-ssl-status.sh"
```

---

## ⚙️ Auto-Renewal Configuration

### Systemd Timer Setup

**Renewal Schedule:** Twice daily (12:00 AM and 12:00 PM UTC)

**Verify Timer is Active:**
```bash
ssh root@91.98.122.165 "systemctl status certbot.timer"
```

**View Timer Schedule:**
```bash
ssh root@91.98.122.165 "systemctl list-timers | grep certbot"
```

**Sample Output:**
```
NEXT                           LEFT LAST                              PASSED UNIT                     
Fri 2025-12-19 00:31:12 UTC   58min Thu 2025-12-18 12:36:31 UTC      10h ago certbot.timer
```

### Certbot Configuration

**Main Configuration File:**
```
/etc/letsencrypt/renewal/zionterranova.com.conf
```

**Renewal Service:**
```bash
# Service that runs on timer trigger
/etc/systemd/system/certbot.service

# Timer that triggers the service
/etc/systemd/system/certbot.timer
```

---

## 🔄 Manual Renewal Process

### Test Renewal (Dry Run)
```bash
ssh root@91.98.122.165 "certbot renew --dry-run"
```

**Expected Output:**
```
Simulating renewal of an existing certificate for zionterranova.com and www.zionterranova.com

Congratulations, all simulated renewals succeeded
```

### Force Immediate Renewal
```bash
ssh root@91.98.122.165 "certbot renew --force-renewal"
```

### Check Specific Certificate
```bash
ssh root@91.98.122.165 "certbot certificates"
```

---

## 📊 Certificate Details

**Extract Common Name:**
```bash
ssh root@91.98.122.165 "openssl x509 -in /etc/letsencrypt/live/zionterranova.com/fullchain.pem -noout -subject"
```

**Check Expiry Date:**
```bash
ssh root@91.98.122.165 "openssl x509 -in /etc/letsencrypt/live/zionterranova.com/fullchain.pem -noout -enddate"
```

**View All Certificate Details:**
```bash
ssh root@91.98.122.165 "openssl x509 -in /etc/letsencrypt/live/zionterranova.com/fullchain.pem -noout -text"
```

**Certificate Chain:**
```bash
ssh root@91.98.122.165 "cat /etc/letsencrypt/live/zionterranova.com/fullchain.pem | openssl x509 -noout -text"
```

---

## 🔌 Nginx Integration

**Certificate Location in Nginx:**
```nginx
# /etc/nginx/sites-available/zionterranova.com
ssl_certificate /etc/letsencrypt/live/zionterranova.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/zionterranova.com/privkey.pem;
```

**Nginx Restart After Renewal:**

The certbot `post_hook` automatically reloads nginx after successful renewal:

```bash
# Configured in /etc/letsencrypt/renewal/zionterranova.com.conf
post_hook = systemctl reload nginx
```

**Verify Nginx is Using New Certificate:**
```bash
ssh root@91.98.122.165 "echo QUIT | openssl s_client -connect www.zionterranova.com:443 2>/dev/null | openssl x509 -noout -dates"
```

---

## 📝 Renewal Logs

**Main Renewal Log:**
```
/var/log/letsencrypt/letsencrypt.log
```

**View Recent Renewal Activity:**
```bash
ssh root@91.98.122.165 "tail -30 /var/log/letsencrypt/letsencrypt.log"
```

**Search for Renewal Events:**
```bash
ssh root@91.98.122.165 "grep -i 'renewal\|SUCCESS\|ERROR' /var/log/letsencrypt/letsencrypt.log | tail -20"
```

**Systemd Journal Logs:**
```bash
ssh root@91.98.122.165 "journalctl -u certbot.service -n 50"
```

---

## 🔔 Monitoring & Alerts

### Automatic Status Check (Cron Job)

Add to cron for daily certificate status check:

```bash
0 0 * * * /root/zion-v2.9/scripts/check-ssl-status.sh >> /var/log/zion-ssl-check.log 2>&1
```

**Configure:**
```bash
ssh root@91.98.122.165 "(crontab -l 2>/dev/null || true; echo '0 0 * * * /root/zion-v2.9/scripts/check-ssl-status.sh >> /var/log/zion-ssl-check.log 2>&1') | crontab -"
```

### Prometheus Alert Rule

Add to `monitoring/prometheus/rules/zion.rules.yml`:

```yaml
- alert: ZIONSSLCertificateExpiring
  expr: (ssl_cert_expiry_timestamp - time()) / 86400 < 14
  for: 1h
  labels:
    severity: warning
  annotations:
    summary: "SSL certificate for zionterranova.com expiring soon"
    description: "Certificate expires in {{ $value | humanizeDuration }}. Renewal should be automatic."
```

### Manual Certificate Expiry Check

```bash
# Check if certificate expires within 14 days
ssh root@91.98.122.165 "bash -c '
CERT_FILE=\"/etc/letsencrypt/live/zionterranova.com/fullchain.pem\"
EXPIRY_EPOCH=\$(date -d \"\$(openssl x509 -in \$CERT_FILE -noout -enddate | cut -d= -f2)\" +%s)
NOW_EPOCH=\$(date +%s)
DAYS_LEFT=\$(( (\$EXPIRY_EPOCH - \$NOW_EPOCH) / 86400 ))
if [ \$DAYS_LEFT -lt 14 ]; then
  echo \"ALERT: Certificate expires in \$DAYS_LEFT days\"
  exit 1
else
  echo \"OK: Certificate valid for \$DAYS_LEFT days\"
  exit 0
fi
'"
```

---

## 🚨 Troubleshooting

### Renewal Failed
```bash
# Check renewal logs
ssh root@91.98.122.165 "tail -50 /var/log/letsencrypt/letsencrypt.log | grep -i error"

# Test renewal manually
ssh root@91.98.122.165 "certbot renew --verbose"
```

### DNS Validation Issues
```bash
# Verify domain DNS resolution
ssh root@91.98.122.165 "nslookup zionterranova.com"

# Test ACME challenge path
ssh root@91.98.122.165 "curl -I http://zionterranova.com/.well-known/acme-challenge/test"
```

### Nginx Not Reloading After Renewal

Check systemd service dependencies:
```bash
ssh root@91.98.122.165 "systemctl cat certbot.service | grep -A5 '\\[Service\\]'"
```

If nginx doesn't reload automatically, manually:
```bash
ssh root@91.98.122.165 "systemctl reload nginx"
```

### Timer Not Triggering

Verify timer is enabled:
```bash
ssh root@91.98.122.165 "systemctl enable --now certbot.timer"
```

Check timer runtime:
```bash
ssh root@91.98.122.165 "systemctl status certbot.timer"
```

---

## 🔐 Security Best Practices

### Certificate Rotation Schedule

- **Auto-renewal:** Every 60 days (Let's Encrypt cert valid for 90 days)
- **Manual backup:** Keep copies of private keys in secure location
- **Monitoring:** Alert if certificate < 14 days to expiry

### Key Management

**Private Key Location:**
```
/etc/letsencrypt/live/zionterranova.com/privkey.pem
```

**Permissions:** `chmod 600` (only root readable)

**Backup Private Key:**
```bash
ssh root@91.98.122.165 "tar -cz /etc/letsencrypt/live/zionterranova.com/ | gzip > /root/zion-v2.9/backups/ssl-backup-$(date +%Y%m%d).tar.gz"
```

### Certificate Pinning

For additional security, consider certificate pinning in browser (HPKP), but be cautious with Let's Encrypt auto-renewal:

```nginx
add_header Public-Key-Pins "pin-sha256=\"...\"; max-age=31536000" always;
```

---

## 📋 Renewal Checklist

Before certificate expiry:

- [ ] Verify renewal timer is active: `systemctl status certbot.timer`
- [ ] Test dry-run renewal: `certbot renew --dry-run`
- [ ] Check renewal logs for errors
- [ ] Ensure nginx can be reloaded: `systemctl reload nginx`
- [ ] Confirm DNS resolution works: `nslookup zionterranova.com`
- [ ] Verify ACME challenge path is accessible
- [ ] Have manual renewal procedure ready if needed

---

## 📞 Emergency Renewal (If Automated Fails)

```bash
# SSH to server
ssh root@91.98.122.165

# Stop nginx
systemctl stop nginx

# Run certbot standalone
certbot certonly --standalone -d zionterranova.com -d www.zionterranova.com

# Restart nginx
systemctl start nginx

# Verify new certificate
systemctl reload nginx
echo QUIT | openssl s_client -connect www.zionterranova.com:443 2>/dev/null | openssl x509 -noout -dates
```

---

## ✅ Verification Checklist

- [ ] Certificate installed at `/etc/letsencrypt/live/zionterranova.com/`
- [ ] Certbot service exists: `systemctl status certbot.timer`
- [ ] Timer is enabled: `systemctl list-timers certbot.timer`
- [ ] Nginx configured with correct cert paths
- [ ] Dry-run renewal succeeds: `certbot renew --dry-run`
- [ ] Status check script deployed: `/root/zion-v2.9/scripts/check-ssl-status.sh`
- [ ] Monitoring alerts configured (optional)

---

**Last Updated:** 18 Dec 2025 | **Status:** ✅ Operational | **Expiry:** 40 days remaining
