# Nginx Rate Limiting Configuration Guide

## 📋 Overview

ZION v2.9 uses nginx rate limiting to protect API endpoints from abuse and brute-force attacks. Different endpoints have different limits based on their criticality.

---

## 🎯 Rate Limiting Tiers

### Tier 1: STRICT (Authentication Endpoints)
- **Limit:** 20 requests per minute per IP
- **Burst:** 5 additional requests allowed
- **Purpose:** Prevent brute-force login attacks
- **Endpoints:** `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/reset-password`
- **Response on Limit:** 429 Too Many Requests

### Tier 2: NORMAL (API Endpoints)
- **Limit:** 100 requests per minute per IP
- **Burst:** 20 additional requests allowed
- **Purpose:** General API protection
- **Endpoints:** `/api/v1/*` (general)
- **Response on Limit:** 429 Too Many Requests

### Tier 3: RELAXED (Health/Status Endpoints)
- **Limit:** 300 requests per minute per IP
- **Burst:** 50 additional requests allowed
- **Purpose:** Allow monitoring and health checks
- **Endpoints:** `/health`, `/api/v1/status`, `/dashboard`
- **Response on Limit:** 429 Too Many Requests

### Tier 4: POOL-SPECIFIC (Mining Pool)
- **Limit:** 200 requests per minute per IP
- **Burst:** 50 additional requests allowed
- **Purpose:** Support high-frequency pool statistics queries
- **Endpoints:** `/api/v1/pool/*`
- **Response on Limit:** 429 Too Many Requests

### Tier 5: METRICS (Monitoring)
- **Limit:** 60 requests per minute per IP
- **Burst:** 20 additional requests allowed
- **Purpose:** Allow Prometheus/monitoring systems
- **Endpoints:** `/metrics`
- **Response on Limit:** 429 Too Many Requests

---

## 📊 Limit Reference Table

| Endpoint | Type | Limit | Burst | Connections |
|----------|------|-------|-------|------------|
| `/health` | Status | 300 req/min | 50 | 20 max |
| `/metrics` | Monitoring | 60 req/min | 20 | 10 max |
| `/api/v1/auth/*` | Auth | 20 req/min | 5 | 5 max |
| `/api/v1/pool/*` | Pool | 200 req/min | 50 | 30 max |
| `/api/v1/dashboard/*` | Dashboard | 150 req/min | 30 | 20 max |
| `/api/v1/*` | General | 100 req/min | 20 | 20 max |

---

## 🔧 Configuration Files

### Rate Limiting Zones Definition
**File:** `/etc/nginx/conf.d/zion-rate-limits.conf`

This file defines the rate limiting zones and connection limits:

```nginx
# Request rate limiting zones
limit_req_zone $binary_remote_addr zone=zion_api:10m rate=100r/m;
limit_req_zone $binary_remote_addr zone=zion_auth:10m rate=20r/m;

# Connection limiting zones
limit_conn_zone $binary_remote_addr zone=zion_api_conn:10m;

# Return 429 when limit exceeded
limit_req_status 429;
```

**Key Parameters:**
- `$binary_remote_addr`: Track limits per client IP
- `zone=name:10m`: Memory zone (10MB can track ~1.6M IPs)
- `rate=XXr/m`: Requests per minute
- `limit_req_status 429`: Return 429 status code when limit exceeded

### Site Configuration
**File:** `/etc/nginx/sites-available/zionterranova.com`

Example location block with rate limiting:

```nginx
location ~ ^/api/v1/auth/ {
    limit_req zone=zion_auth burst=5 nodelay;
    limit_conn zion_auth_conn 5;
    
    proxy_pass http://api_backend;
    # ... other proxy settings
}
```

**Parameters:**
- `limit_req zone=name burst=X nodelay`: Apply rate limit with burst capability
  - `burst=5`: Allow 5 extra requests in queue
  - `nodelay`: Don't delay excess requests (immediately return 429)
- `limit_conn zone=name X`: Limit concurrent connections to X

---

## 📈 How Rate Limiting Works

### Request Rate Limiting

**Scenario:** 100 requests per minute with 20 burst

```
Second  Requests  Status          Notes
0-60    100       200 OK          Normal requests processed
61-65   5         200 OK          Burst requests allowed
66+     ANY       429 Too Many    Rate limit exceeded
```

**Calculation:**
- Base allowance: 100 requests per minute = 1.67 requests per second
- Burst allowance: 20 additional requests
- Window: Sliding 1-minute window per IP

### Connection Limiting

**Scenario:** Max 5 concurrent connections

```
Connection 1  → 200 OK
Connection 2  → 200 OK
Connection 3  → 200 OK
Connection 4  → 200 OK
Connection 5  → 200 OK
Connection 6  → 429 Too Many (exceeds limit)
```

---

## 🧪 Testing Rate Limits

### Quick Test

**Test single endpoint:**
```bash
# Send 5 rapid requests (should all succeed)
for i in {1..5}; do
  curl -I https://www.zionterranova.com/health
  echo ""
done
```

### Comprehensive Test

**Deploy and run test script:**
```bash
rsync -avz -e "ssh -i ~/.ssh/zion_server_key" \
  /Users/yeshuae/Desktop/ZION/Zion-2.9-main/scripts/test-rate-limits.sh \
  root@91.98.122.165:/root/zion-v2.9/scripts/

ssh -i ~/.ssh/zion_server_key root@91.98.122.165 \
  "chmod +x /root/zion-v2.9/scripts/test-rate-limits.sh && \
   /root/zion-v2.9/scripts/test-rate-limits.sh www.zionterranova.com 60"
```

### Burst Behavior Test

**Test that burst requests are allowed:**
```bash
# Slowly send 5 requests (should all succeed - under limit)
for i in {1..5}; do
  curl -s https://www.zionterranova.com/api/v1/status -o /dev/null -w "Request $i: %{http_code}\n"
  sleep 1
done

# Rapidly send 20 requests (should hit 429 after burst)
for i in {1..20}; do
  curl -s https://www.zionterranova.com/api/v1/status -o /dev/null -w "Request $i: %{http_code} "
  sleep 0.05
done
```

### Auth Endpoint Brute-Force Test

**Test strict auth limits:**
```bash
# Try 10 rapid login attempts (should get 429 after 5-6 requests)
for i in {1..10}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' \
    https://www.zionterranova.com/api/v1/auth/login)
  echo "Attempt $i: $HTTP_CODE"
  sleep 0.1
done
```

---

## 📝 Monitoring Rate Limits

### Nginx Access Logs

**View rate limit hits (429 responses):**
```bash
ssh root@91.98.122.165 "grep ' 429 ' /var/log/nginx/access.log | tail -20"
```

**Count 429 responses by endpoint:**
```bash
ssh root@91.98.122.165 "grep ' 429 ' /var/log/nginx/access.log | awk '{print $7}' | sort | uniq -c | sort -rn"
```

**Count 429 responses by IP:**
```bash
ssh root@91.98.122.165 "grep ' 429 ' /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -rn"
```

### Real-Time Monitoring

**Watch rate limit hits in real-time:**
```bash
ssh root@91.98.122.165 "tail -f /var/log/nginx/access.log | grep ' 429 '"
```

### Prometheus Metrics

**Monitor with Prometheus (if nginx-lua module available):**
```yaml
- alert: HighRateLimitHits
  expr: rate(nginx_http_requests_total{status="429"}[5m]) > 10
  for: 5m
  annotations:
    summary: "High rate limit hits (429) detected"
```

---

## 🔒 Security Best Practices

### 1. Whitelist Trusted IPs (Optional)

For internal monitoring systems that need higher limits:

```nginx
geo $limit_api {
    default 1;
    127.0.0.1 0;           # Local IP
    10.0.0.0/8 0;          # Internal network
    203.0.113.0/24 0;      # Trusted partner IP
}

# Then in server block:
limit_req zone=zion_api burst=20 nodelay $limit_api;
```

### 2. Gradual Backoff

Implement client-side exponential backoff:

```python
import time
import requests

def call_with_backoff(url, max_retries=5):
    for attempt in range(max_retries):
        response = requests.get(url)
        
        if response.status_code == 429:
            wait_time = (2 ** attempt) + random.uniform(0, 1)
            print(f"Rate limited. Waiting {wait_time}s...")
            time.sleep(wait_time)
            continue
        
        return response
```

### 3. Rate Limit Headers

Nginx returns these headers on responses:

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Content-Length: 70
Connection: close

{"error":"Too many requests. Please try again later.","retry_after":60}
```

### 4. Monitor for DDoS Patterns

```bash
# Check for IPs with excessive 429 hits (potential DDoS)
ssh root@91.98.122.165 "grep ' 429 ' /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head -10"
```

---

## 🛠️ Troubleshooting

### Legitimate Users Getting Rate Limited

**Issue:** Real users getting 429 responses

**Solutions:**
1. Increase burst value:
   ```nginx
   limit_req zone=zion_api burst=30 nodelay;  # Increase from 20
   ```

2. Increase rate limit:
   ```nginx
   limit_req_zone $binary_remote_addr zone=zion_api:10m rate=150r/m;  # Increase from 100
   ```

3. Whitelist IP if known:
   ```nginx
   location ~ ^/api/ {
       limit_req zone=zion_api burst=20 nodelay $limit_api;
   }
   ```

### Rate Limits Not Being Applied

**Verify configuration:**
```bash
ssh root@91.98.122.165 "nginx -t"  # Test config syntax
ssh root@91.98.122.165 "systemctl restart nginx"  # Restart nginx
```

**Check if zones are defined:**
```bash
ssh root@91.98.122.165 "grep -n 'limit_req_zone' /etc/nginx/conf.d/zion-rate-limits.conf"
```

### Memory Zone Full

**Error:** "limit_req_zone: limiting requests, storage runs out"

**Solution:** Increase zone size:
```nginx
# Change from 10m to 50m
limit_req_zone $binary_remote_addr zone=zion_api:50m rate=100r/m;
```

---

## 📋 Implementation Checklist

- [ ] Rate limiting config deployed: `/etc/nginx/conf.d/zion-rate-limits.conf`
- [ ] Site config includes rate limiting directives
- [ ] Nginx config syntax verified: `nginx -t`
- [ ] Nginx reloaded: `systemctl reload nginx`
- [ ] Test script deployed: `/root/zion-v2.9/scripts/test-rate-limits.sh`
- [ ] Rate limiting tested: All tiers working correctly
- [ ] Logs rotated: `/var/log/nginx/rate-limit.log` exists
- [ ] Monitoring alerts configured (optional)
- [ ] Documentation updated

---

## 📞 Support

For rate limiting issues:
1. Check nginx syntax: `nginx -t`
2. Check logs: `/var/log/nginx/access.log`
3. Verify zones: `grep 'limit_req_zone' /etc/nginx/conf.d/zion-rate-limits.conf`
4. Test endpoint directly: `curl -v https://www.zionterranova.com/health`

---

**Last Updated:** 18 Dec 2025 | **Status:** ✅ Configured | **Test:** ✅ Ready
