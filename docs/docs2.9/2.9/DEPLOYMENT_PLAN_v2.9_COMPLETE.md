# 🚀 ZION v2.9 "Quantum Leap" - Complete Stack Deployment Plan

## 📋 Executive Summary

**Aktuální stav:**
- ✅ Lokální projekt: verze 2.9 s native miner, GPU mining, dashboard
- ⚠️ Website server: verze 2.8.9 z 14. listopadu (zastaralá)
- ❌ Backend: kompletně odstraněn (žádný Docker, API, pool)
- ✅ Web: funguje pouze jako statický Next.js export

**Cíl:**
Nasadit **kompletní stack 2.9** na čistý server s:
1. Modern Docker Compose stack (blockchain, pool, API, monitoring)
2. Aktualizovaný website v2.9 s funkčními odkazy na API
3. Agent control plane pro remote mining
4. Automatizované CI/CD deployment
5. Production-ready monitoring & security

---

## 🎯 Stack Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NGINX (ports 80/443)                     │
│  www.zionterranova.com                                      │
│  ├─ / → Static Next.js website (v2.9)                       │
│  ├─ /api/ → Proxy to FastAPI (port 8001)                    │
│  └─ /pool/ → Proxy to Pool stats (port 8080)                │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  FastAPI    │    │ Pool Server │    │ Blockchain  │
│  port 8001  │◄───┤  port 3333  │◄───┤  port 8545  │
│             │    │  port 8080  │    │ port 18081  │
│ /health     │    │ (Stratum)   │    │ (RPC)       │
│ /stats      │    │             │    │             │
│ /api/v1/*   │    │ Whitelist   │    │ Genesis     │
│ /agents/*   │    │ Mining      │    │ Blocks      │
└─────────────┘    └─────────────┘    └─────────────┘
        │                   │                   │
        └───────────────────┴───────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
        ┌─────────────┐        ┌─────────────┐
        │   Redis     │        │ Prometheus  │
        │  port 6379  │        │  port 9090  │
        │ (Cache)     │        │ (Metrics)   │
        └─────────────┘        └─────────────┘
                │                       │
                └───────────────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │   Grafana   │
                    │  port 3000  │
                    │ (Dashboard) │
                    └─────────────┘
```

---

## 📦 Components Breakdown

### 1. **Blockchain Core** (zion-blockchain-v2.9)
- Custom blockchain engine s Cosmic Harmony
- Ports: 8545 (ETH-style RPC), 18081 (Monero-style RPC)
- Genesis block with premine
- Consciousness mining rewards
- SQLite + WAL mode
- Volume: `blockchain-data` (~10GB expected)

### 2. **Mining Pool** (zion-pool-v2.9)
- Multi-algo support (Cosmic Harmony, RandomX, Yescrypt)
- Whitelist system
- Stratum protocol on port 3333
- Stats API on port 8080
- Redis integration for shares tracking
- Volume: `pool-data` (~1GB)

### 3. **FastAPI Gateway** (zion-api-v2.9)
- RESTful API for blockchain queries
- Agent control plane endpoints:
  - `POST /api/v1/agents/pairing`
  - `POST /api/v1/agents/register`
  - `POST /api/v1/agents/{id}/heartbeat`
  - `GET /api/v1/agents/{id}/stats`
  - `POST /api/v1/agents/{id}/command`
- Health checks: `/health`
- CORS configured for www.zionterranova.com
- Volume: `agent-data` for registry persistence

### 4. **Redis Cache**
- LRU caching for blockchain queries
- Pub/sub for real-time updates
- 256MB limit with eviction policy
- Data persistence with AOF

### 5. **Prometheus + Grafana**
- Metrics scraping from all services
- Custom dashboards:
  - Blockchain health (blocks/s, tx/s)
  - Pool stats (hashrate, miners, shares)
  - API performance (latency, error rate)
  - System resources (CPU, RAM, disk)

### 6. **Nginx Reverse Proxy**
- SSL/TLS with Let's Encrypt
- Rate limiting per IP
- Gzip compression
- Static file caching
- WebSocket support for future features

---

## 🔧 Implementation Steps

### Phase 1: Prepare Docker Stack (Local)
1. **Create production docker-compose-v2.9.yml**
   - Multi-stage builds for smaller images
   - Health checks on all services
   - Resource limits (CPU, RAM)
   - Secrets management for passwords

2. **Build Dockerfiles**
   - `docker/blockchain-v2.9/Dockerfile`
   - `docker/pool-v2.9/Dockerfile`
   - `docker/api-v2.9/Dockerfile`

3. **Configuration files**
   - `config/blockchain_production.json`
   - `config/pool_production.json`
   - `config/api_production.json`

4. **Test locally**
   ```bash
   docker-compose -f docker-compose-v2.9.yml up -d
   docker-compose logs -f
   ```

### Phase 2: Update Website
1. **Bump version to 2.9.0**
   - Update `package.json`
   - Update all hardcoded API URLs to use ENV variables
   - Remove port 8001 references (use /api/ instead)

2. **Add new pages**
   - `/mining/remote` - Remote miner agent pairing UI
   - `/dashboard/agents` - Agent management dashboard
   - `/download/miner` - Native miner releases

3. **Build static export**
   ```bash
   cd website-v2.9
   npm run build
   # Output to: out/
   ```

### Phase 3: Server Deployment
1. **Upload Docker stack**
   ```bash
   rsync -avz --delete \
     docker-compose-v2.9.yml \
     docker/ \
     config/ \
     scripts/ \
     root@91.98.122.165:/root/zion-v2.9/
   ```

2. **Pull/build images**
   ```bash
   ssh root@91.98.122.165
   cd /root/zion-v2.9
   docker-compose -f docker-compose-v2.9.yml build
   docker-compose -f docker-compose-v2.9.yml up -d
   ```

3. **Configure Nginx**
   - Update `/etc/nginx/sites-available/zionterranova.com`
   - Add `/api/` proxy to localhost:8001
   - Add `/pool/` proxy to localhost:8080
   - Reload: `systemctl reload nginx`

4. **Deploy website**
   ```bash
   rsync -avz --delete \
     website-v2.9/out/ \
     root@91.98.122.165:/var/www/zionterranova.com/
   ```

### Phase 4: Monitoring Setup
1. **Import Grafana dashboards**
   - Upload JSON configs
   - Configure Prometheus datasource
   - Set alerts (Discord/Telegram webhooks)

2. **Health checks**
   ```bash
   curl https://www.zionterranova.com/api/health
   curl https://www.zionterranova.com/pool/stats
   ```

### Phase 5: Agent System
1. **Create local agent client**
   - `zion_miner_agent_v2.9.py`
   - Pairing flow
   - Command polling
   - Auto-update mechanism

2. **Package releases**
   - Windows: .zip with .exe + DLLs
   - Linux: AppImage
   - Upload to `/download/miner-agent/`

---

## 🔐 Security Considerations

### Secrets Management
- Use Docker secrets for:
  - Database passwords
  - API tokens
  - SSL certificates
- Never commit secrets to git

### Network Security
- Firewall rules:
  ```bash
  ufw allow 22/tcp   # SSH
  ufw allow 80/tcp   # HTTP
  ufw allow 443/tcp  # HTTPS
  ufw allow 3333/tcp # Pool (mining)
  ufw deny 8001      # Block direct API access
  ufw deny 8545      # Block direct RPC access
  ufw deny 3000      # Block direct Grafana access
  ```

- Nginx rate limiting:
  ```nginx
  limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
  limit_req_zone $binary_remote_addr zone=pool:10m rate=100r/s;
  ```

### SSL/TLS
- Let's Encrypt with auto-renewal
- A+ rating on SSL Labs
- HSTS enabled
- Modern cipher suites only

---

## 📊 Monitoring & Alerts

### Key Metrics
1. **Blockchain**
   - Blocks per hour
   - Average block time
   - Chain height
   - Mempool size

2. **Pool**
   - Active miners
   - Total hashrate
   - Share acceptance rate
   - Payout queue length

3. **API**
   - Request rate (req/s)
   - Average latency (ms)
   - Error rate (%)
   - Cache hit ratio

4. **System**
   - CPU usage (%)
   - RAM usage (%)
   - Disk I/O (MB/s)
   - Network traffic (Mbps)

### Alerts
- **Critical:** API down, Blockchain stalled, Pool crashed
- **Warning:** High CPU (>80%), Low disk space (<20%), High error rate (>5%)
- **Info:** New release available, Scheduled maintenance

---

## 🚀 Deployment Timeline

### Week 1: Preparation (Dec 15-21)
- [ ] Create docker-compose-v2.9.yml
- [ ] Build & test Dockerfiles locally
- [ ] Update website to v2.9
- [ ] Write deployment scripts

### Week 2: Deployment (Dec 22-28)
- [ ] Upload stack to server
- [ ] Configure Nginx reverse proxy
- [ ] Deploy Docker containers
- [ ] Deploy updated website
- [ ] Import Grafana dashboards

### Week 3: Agent System (Dec 29 - Jan 4)
- [ ] Build local miner agent
- [ ] Package Windows/Linux releases
- [ ] Upload to download page
- [ ] Test pairing flow end-to-end

### Week 4: Monitoring (Jan 5-11)
- [ ] Configure Prometheus scraping
- [ ] Set up alert rules
- [ ] Test failover scenarios
- [ ] Document runbooks

---

## 📝 Rollback Plan

V případě problémů:
1. **Immediate:** Restore static website (už funguje)
2. **Partial:** Disable problematic service (Docker Compose down)
3. **Full:** Restore from backup snapshots

---

## ✅ Success Criteria

Deployment je úspěšný když:
- ✅ Website live na https://www.zionterranova.com
- ✅ API health check: `GET /api/health` → 200 OK
- ✅ Pool accepts connections on port 3333
- ✅ Blockchain syncing, producing blocks
- ✅ Grafana dashboards showing metrics
- ✅ Agent pairing flow works end-to-end
- ✅ Native miner downloadable a funkční
- ✅ No errors in logs for 24h
- ✅ All services auto-restart on failure

---

## 🎯 Next Steps (Priority Order)

1. **IMMEDIATE:** Vytvoř `docker-compose-v2.9-production.yml`
2. **HIGH:** Update website package.json a API URLs na v2.9
3. **HIGH:** Build Dockerfiles pro všechny služby
4. **MEDIUM:** Create deployment scripts
5. **MEDIUM:** Test celý stack lokálně
6. **LOW:** Agent client development
7. **LOW:** Grafana dashboards

---

## 📞 Support & Maintenance

- **Logs:** `docker-compose logs -f [service]`
- **Restart:** `docker-compose restart [service]`
- **Update:** `docker-compose pull && docker-compose up -d`
- **Backup:** Daily snapshots of all volumes
- **Health:** Automated checks every 5min

---

**Připraveno:** 15. prosince 2025  
**Verze:** 2.9.0 "Quantum Leap"  
**Status:** 🟡 Planning Phase
