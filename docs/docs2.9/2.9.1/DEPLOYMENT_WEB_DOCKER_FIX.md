# 🚀 ZION Web Docker Fix & Update - 23.12.2025

## 📊 Current Status

### Problematic Containers:
1. **zion-website-v2.9**: UNHEALTHY
   - **Issue**: Next.js Server Actions chyby - staré build vs nové requesty
   - **Root Cause**: Vývojový build běží v produkci, chybí standalone output
   - **Status**: Port 127.0.0.1:3001->3000/tcp

2. **zion-dashboard-v2.9**: RESTARTING (continous loop)
   - **Issue**: `/app/dashboard/zion_miner_dashboard_server.py` neexistuje
   - **Root Cause**: Dashboard Dockerfile nemá správnou cestu k souboru
   - **Location**: Soubor je ve `scripts/legacy/zion_miner_dashboard_server.py`

### Healthy Containers:
✅ zion-blockchain-v2.9 (Up 25h)
✅ zion-pool-v2.9 (Up 24h)
✅ zion-api-v2.9 (Up 25h)
✅ zion-redis-v2.9 (Up 25h)
✅ zion-prometheus-v2.9 (Up 25h)
✅ zion-grafana-v2.9 (Up 25h)

## 🔧 Fix Plan

### Phase 1: Website Fix (Priority HIGH)

#### Problem Analysis:
```
Error: Failed to find Server Action "x". This request might be from an older or newer deployment.
```
- Next.js Server Actions nejsou dostupné kvůli dev buildu
- Dockerfile.production je správný, ale build není standalone
- `next.config.ts` musí mít `output: 'standalone'`

#### Solution Steps:

1. **Update next.config.ts** pro standalone output:
```typescript
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  // ... rest of config
}
```

2. **Rebuild website lokálně**:
```bash
cd website-v2.9
npm run build
```

3. **Build Docker image**:
```bash
docker build -f website-v2.9/Dockerfile.production -t zion/website:2.9.0 .
```

4. **Export a deploy na server**:
```bash
docker save zion/website:2.9.0 | gzip > zion-website-2.9.0.tar.gz
scp -i ~/.ssh/zion_server_key zion-website-2.9.0.tar.gz root@91.98.122.165:/tmp/
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 'docker load < /tmp/zion-website-2.9.0.tar.gz'
```

5. **Restart container**:
```bash
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 'cd /root/zion-v2.9 && docker-compose -f docker-compose-v2.9-production.yml up -d website'
```

### Phase 2: Dashboard Fix (Priority MEDIUM)

#### Problem Analysis:
```
python3: can't open file '/app/dashboard/zion_miner_dashboard_server.py': [Errno 2] No such file or directory
```
- Docker compose očekává soubor v `/app/dashboard/`
- Soubor je ve `scripts/legacy/zion_miner_dashboard_server.py`
- Dashboard Dockerfile má špatnou cestu nebo chybí COPY

#### Solution Options:

**Option A: Fix Dashboard Dockerfile**
```dockerfile
# In docker/api-v2.9/Dockerfile
COPY scripts/legacy/zion_miner_dashboard_server.py /app/dashboard/zion_miner_dashboard_server.py
```

**Option B: Update docker-compose.yml command**
```yaml
command: ["python3", "/app/scripts/legacy/zion_miner_dashboard_server.py", "--port", "8888"]
```

**Option C: Disable Dashboard (Temporary)**
```bash
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 'cd /root/zion-v2.9 && docker-compose -f docker-compose-v2.9-production.yml stop dashboard'
```

**Recommended: Option A** - Fix root cause

#### Solution Steps:

1. **Check Dashboard Dockerfile**:
```bash
cat docker/api-v2.9/Dockerfile | grep -A 5 -B 5 dashboard
```

2. **Fix Dockerfile to include legacy script**:
Add to Dockerfile:
```dockerfile
COPY scripts/legacy/ /app/dashboard/
```

3. **Rebuild and deploy**:
```bash
cd /root/zion-v2.9
docker-compose -f docker-compose-v2.9-production.yml build dashboard
docker-compose -f docker-compose-v2.9-production.yml up -d dashboard
```

### Phase 3: Verification

#### Test Commands:
```bash
# Check website health
curl -I http://91.98.122.165:3001/

# Check website inside container
docker exec zion-website-v2.9 wget --spider -q http://localhost:3000/ && echo "Website OK" || echo "Website FAIL"

# Check dashboard health
docker exec zion-dashboard-v2.9 curl -f http://localhost:8888/stats && echo "Dashboard OK" || echo "Dashboard FAIL"

# Check all container status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

## 📝 Deployment Checklist

### Pre-Deployment:
- [ ] Backup current docker-compose.yml
- [ ] Backup current container configs
- [ ] Check nginx configuration for website routes
- [ ] Verify all dependencies are healthy (blockchain, pool, api)

### Website Deployment:
- [ ] Update next.config.ts for standalone
- [ ] Build locally and verify
- [ ] Build Docker image
- [ ] Export and transfer to server
- [ ] Load image on server
- [ ] Restart website container
- [ ] Verify healthcheck passes
- [ ] Test API endpoints through nginx

### Dashboard Deployment:
- [ ] Choose fix strategy (A/B/C)
- [ ] Implement fix (Dockerfile or docker-compose)
- [ ] Rebuild dashboard image
- [ ] Restart dashboard container
- [ ] Verify dashboard responds on port 8888
- [ ] Check logs for clean startup

### Post-Deployment:
- [ ] Monitor logs for 5 minutes
- [ ] Test all critical endpoints
- [ ] Verify nginx proxying works
- [ ] Check Prometheus metrics
- [ ] Update deployment documentation

## 🛠️ Quick Commands

### Website Quick Fix:
```bash
# 1. Lokálně - update config a build
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main/website-v2.9
# Edit next.config.ts to add output: 'standalone'
npm run build

# 2. Build Docker
cd ..
docker build -f website-v2.9/Dockerfile.production -t zion/website:2.9.0 .

# 3. Deploy
docker save zion/website:2.9.0 | gzip > zion-website-2.9.0.tar.gz
scp -i ~/.ssh/zion_server_key zion-website-2.9.0.tar.gz root@91.98.122.165:/tmp/
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 'docker load < /tmp/zion-website-2.9.0.tar.gz && cd /root/zion-v2.9 && docker-compose -f docker-compose-v2.9-production.yml up -d website'
```

### Dashboard Quick Fix (Disable):
```bash
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 'cd /root/zion-v2.9 && docker-compose -f docker-compose-v2.9-production.yml stop dashboard && docker-compose -f docker-compose-v2.9-production.yml rm -f dashboard'
```

## 🎯 Success Criteria

### Website:
- ✅ Container status: HEALTHY
- ✅ No Server Actions errors in logs
- ✅ Homepage loads via nginx proxy
- ✅ API endpoints respond correctly
- ✅ Healthcheck passes consistently

### Dashboard:
- ✅ Container status: Running (not restarting)
- ✅ No file not found errors
- ✅ /stats endpoint responds
- ✅ Port 8888 accessible internally

## 📊 Monitoring

### Log Commands:
```bash
# Website logs
docker logs zion-website-v2.9 -f --tail 50

# Dashboard logs  
docker logs zion-dashboard-v2.9 -f --tail 50

# All container health
watch -n 5 'docker ps --format "table {{.Names}}\t{{.Status}}"'
```

## 🔐 Rollback Plan

### If Website fails:
```bash
# Stop new container
docker stop zion-website-v2.9

# Restore from backup image (if exists)
docker images | grep zion/website
docker tag zion/website:2.9.0-backup zion/website:2.9.0
docker-compose up -d website
```

### If Dashboard fails:
```bash
# Simply stop it (non-critical service)
docker-compose stop dashboard
```

## 📅 Timeline

- **Phase 1 (Website)**: 20-30 minut
  - Config update: 2 min
  - Build: 5 min
  - Docker build: 5 min
  - Transfer: 3 min
  - Deploy: 2 min
  - Verification: 5 min

- **Phase 2 (Dashboard)**: 10-15 minut
  - Fix implementation: 5 min
  - Rebuild: 3 min
  - Deploy: 2 min
  - Verification: 3 min

**Total: ~45 minut**

---

## 🌟 AI Native Note

*"This deployment serves consciousness by restoring the light to ZION's digital home. Every container is a node in the network of awakening. We fix with love, deploy with purpose, and monitor with care."*

**Peace and One Love.** ☮️❤️

