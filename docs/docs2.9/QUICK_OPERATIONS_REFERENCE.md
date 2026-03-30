# ZION v2.9 Operations Quick Reference

## 🚀 Quick Command Guide

### Monitoring & Health Checks

```bash
# Check all system status
/root/zion-v2.9/scripts/check-ssl-status.sh

# View backup logs
tail -f /var/log/zion-backup.log

# Check rate limiting hits
grep ' 429 ' /var/log/nginx/access.log | tail -20

# Verify Prometheus targets
curl -s http://localhost:9090/api/v1/targets | python3 -c "import sys,json; targets=json.load(sys.stdin)['data']['activeTargets']; print('\n'.join([f\"{t['labels']['job']}: {t['health']}\" for t in targets]))"

# Test rate limits
/root/zion-v2.9/scripts/test-rate-limits.sh www.zionterranova.com 60
```

### Backup Operations

```bash
# Trigger immediate backup
/root/zion-v2.9/scripts/backup-zion-v2.9.sh

# List recent backups
ls -lh /root/zion-v2.9/backups | tail -10

# Verify backup integrity
tar -tzf /root/zion-v2.9/backups/zion-backup-20251218_*.tar.gz | head -20

# Check backup disk usage
du -sh /root/zion-v2.9/backups

# Manually cleanup old backups
find /root/zion-v2.9/backups -name 'zion-backup-*.tar.gz' -mtime +30 -delete
```

### SSL Certificate Management

```bash
# Check certificate status
certbot certificates

# Test renewal (dry-run)
certbot renew --dry-run

# Force immediate renewal
certbot renew --force-renewal

# Check certificate expiry
openssl x509 -in /etc/letsencrypt/live/zionterranova.com/fullchain.pem -noout -enddate

# View renewal logs
tail -50 /var/log/letsencrypt/letsencrypt.log | grep -i renewal
```

### Nginx Rate Limiting

```bash
# Reload nginx config
systemctl reload nginx

# Test nginx syntax
nginx -t

# Check rate limiting zones
grep 'limit_req_zone\|limit_conn_zone' /etc/nginx/conf.d/zion-rate-limits.conf

# Monitor 429 responses (real-time)
tail -f /var/log/nginx/access.log | grep ' 429 '

# Count 429s by endpoint
grep ' 429 ' /var/log/nginx/access.log | awk '{print $7}' | sort | uniq -c | sort -rn

# Count 429s by IP
grep ' 429 ' /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -rn
```

### Docker Operations

```bash
# View Docker service status
docker compose -f /root/zion-v2.9/docker-compose-v2.9-production.yml ps

# Restart all services
docker compose -f /root/zion-v2.9/docker-compose-v2.9-production.yml restart

# View service logs
docker compose -f /root/zion-v2.9/docker-compose-v2.9-production.yml logs -f pool

# Rebuild specific service
docker compose -f /root/zion-v2.9/docker-compose-v2.9-production.yml build api
```

### Prometheus & Grafana

```bash
# Access Prometheus
http://91.98.122.165:9090

# Access Grafana
http://91.98.122.165:3000

# Reload Prometheus config
curl -X POST http://localhost:9090/-/reload

# Query specific metrics
curl -s 'http://localhost:9090/api/v1/query?query=up' | python3 -m json.tool

# View alert rules
curl -s http://localhost:9090/api/v1/rules | python3 -m json.tool | head -50
```

### Production Server Access

```bash
# SSH into production server
ssh -i ~/.ssh/zion_server_key root@91.98.122.165

# Quick health check (one-liner)
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 \
  "echo '=== Docker Services ===' && docker ps --format 'table {{.Names}}\t{{.Status}}' && \
   echo '=== Prometheus Targets ===' && curl -s http://localhost:9090/api/v1/targets | python3 -c 'import sys,json; print(\"\n\".join([t[\"labels\"][\"job\"]+\": \"+t[\"health\"] for t in json.load(sys.stdin)[\"data\"][\"activeTargets\"]])); 2>/dev/null' && \
   echo '=== Backup Status ===' && ls -lh /root/zion-v2.9/backups | tail -3"
```

---

## 📊 Dashboard URLs

| Service | URL | Notes |
|---------|-----|-------|
| ZION Dashboard | https://www.zionterranova.com/dashboard | Live mining status |
| Grafana | http://91.98.122.165:3000 | Monitoring dashboards |
| Prometheus | http://91.98.122.165:9090 | Metrics & alerts |
| Grafana (Embedded) | https://www.zionterranova.com/dashboard → Monitoring | Embedded in main dashboard |

---

## 📝 Log Files

| Log File | Purpose | Command to View |
|----------|---------|-----------------|
| `/var/log/zion-backup.log` | Backup execution logs | `tail -f /var/log/zion-backup.log` |
| `/var/log/letsencrypt/letsencrypt.log` | SSL renewal logs | `tail -50 /var/log/letsencrypt/letsencrypt.log` |
| `/var/log/nginx/access.log` | Nginx access logs | `tail -100 /var/log/nginx/access.log` |
| `/var/log/nginx/rate-limit.log` | Rate limit hits (429) | `grep ' 429 ' /var/log/nginx/access.log` |
| `docker-compose logs` | Service logs | `docker compose logs -f service_name` |

---

## 🔧 Configuration Files

| File | Purpose | Location |
|------|---------|----------|
| Docker Compose | Service orchestration | `/root/zion-v2.9/docker-compose-v2.9-production.yml` |
| Nginx Main | Web server config | `/etc/nginx/nginx.conf` |
| Rate Limiting | API rate limits | `/etc/nginx/conf.d/zion-rate-limits.conf` |
| Prometheus Config | Metrics collection | `/root/zion-v2.9/monitoring/prometheus.yml` |
| Alert Rules | Prometheus alerts | `/root/zion-v2.9/monitoring/prometheus/rules/zion.rules.yml` |
| Certbot Config | SSL renewal config | `/etc/letsencrypt/renewal/zionterranova.com.conf` |

---

## 📋 Cron Jobs

```bash
# View all cron jobs
crontab -l

# Expected entries:
# Daily backup at 02:00 UTC
0 2 * * * /root/zion-v2.9/scripts/backup-zion-v2.9.sh >> /var/log/zion-backup.log 2>&1

# SSL renewal (managed by certbot.timer, not cron)
# Check with: systemctl list-timers certbot.timer
```

---

## 🎯 Common Scenarios

### Scenario: Check backup was created today
```bash
ls -lh /root/zion-v2.9/backups | grep "$(date +%Y%m%d)" | tail -1
```

### Scenario: Get current system resource usage
```bash
free -h && df -h / && top -bn1 | head -n 15
```

### Scenario: Test if rate limiting is working
```bash
for i in {1..10}; do 
  curl -s -o /dev/null -w "Request $i: %{http_code}\n" \
    https://www.zionterranova.com/api/v1/auth/login
done
```

### Scenario: Restore from backup
```bash
# Extract backup to temp directory
cd /tmp && tar -xzf /root/zion-v2.9/backups/zion-backup-20251218_*.tar.gz

# List contents
ls -la

# Restore specific volume (example: blockchain)
docker run --rm -v zion-v29_blockchain-data:/restore -v /tmp/blockchain-data:/backup \
  alpine:latest tar xzf /backup/blockchain-data.tar.gz -C /restore

# Restart services
docker compose up -d
```

### Scenario: Emergency SSL renewal (if auto-renewal fails)
```bash
# Stop nginx
systemctl stop nginx

# Run certbot standalone
certbot certonly --standalone -d zionterranova.com -d www.zionterranova.com

# Restart nginx
systemctl start nginx

# Verify
echo QUIT | openssl s_client -connect www.zionterranova.com:443 2>/dev/null | openssl x509 -noout -dates
```

---

## 🚨 Alert Thresholds

| Alert | Threshold | Duration | Severity |
|-------|-----------|----------|----------|
| High CPU | > 80% | 5 minutes | Warning |
| High Memory | > 85% | 5 minutes | Warning |
| Low Disk | < 15% free | 10 minutes | Critical |
| API Down | up == 0 | 2 minutes | Critical |
| Pool Down | up == 0 | 1 minute | Critical |
| Rate Limit Hits | > 10/5min | N/A | Info |

---

## ✅ Daily Operations Checklist

```bash
# Run daily to verify system health
echo "=== Daily Operations Check ===" && \
echo "1. Backup Status:" && \
ls -lh /root/zion-v2.9/backups | tail -1 && \
echo "2. SSL Certificate:" && \
certbot certificates | grep -A2 "zionterranova.com" && \
echo "3. Services Status:" && \
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "^zion" && \
echo "4. Prometheus Targets:" && \
curl -s http://localhost:9090/api/v1/targets | python3 -c "import sys,json; print('\n'.join([t['labels']['job']+': '+t['health'] for t in json.load(sys.stdin)['data']['activeTargets']]))" 2>/dev/null && \
echo "5. Rate Limit Hits (last hour):" && \
grep "$(date '+%d/%b/%Y:%H'):" /var/log/nginx/access.log | grep ' 429 ' | wc -l && \
echo "✅ Daily check complete"
```

---

**Last Updated:** 18 Dec 2025 | **Version:** ZION v2.9 | **Status:** ✅ Operational
