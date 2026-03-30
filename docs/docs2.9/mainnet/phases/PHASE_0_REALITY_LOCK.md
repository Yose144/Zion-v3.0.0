# 🔧 FÁZE 0: Reality Lock — Technická Specifikace

**Priorita:** P0 (Blocker pro vše ostatní)  
**Trvání:** 1 týden  
**Owner:** DevOps Lead

---

## 🎯 Cíl

Eliminovat "configuration drift" — stav kdy různé dokumenty, skripty a configs ukazují různé porty, paths a nastavení. Po této fázi bude existovat JEDEN zdroj pravdy.

---

## 📋 Task Breakdown

### Task 0.1: Port Matrix Audit

**Čas:** 2h

1. Projít všechny soubory a vytáhnout port references:
```bash
grep -r "8545\|8444\|8334\|3333\|8080\|6379" . --include="*.yml" --include="*.yaml" --include="*.json" --include="*.toml" --include="*.rs" --include="*.py" > port_audit.txt
```

2. Vytvořit tabulku:
| Soubor | Port | Kontext | Správně? |
|--------|------|---------|----------|

3. Identifikovat konflikty

**Output:** `docs/mainnet/PORT_AUDIT.md`

### Task 0.2: Port Matrix Definice

**Čas:** 1h

Vytvořit kanonický dokument:

```yaml
# docs/mainnet/PORT_MATRIX.yaml
version: "1.0"
date: "2026-02-03"

services:
  zion-core:
    ports:
      rpc: 8444      # JSON-RPC pro wallet/explorer
      p2p: 8334      # Peer-to-peer networking
    internal_ports:
      metrics: 9100  # Prometheus metrics
    
  zion-pool:
    ports:
      stratum: 3333  # Mining connections
      api: 8080      # Pool stats API
    internal_ports:
      metrics: 9101
    
  redis:
    ports:
      default: 6379
    
  prometheus:
    ports:
      default: 9090
    
  grafana:
    ports:
      default: 3000

networks:
  mainnet:
    chain_id: "zion-mainnet-1"
    seed_dns: "seed.zionterranova.com"
    
  testnet:
    chain_id: "zion-testnet-1"
    seed_dns: "seed-testnet.zionterranova.com"
```

### Task 0.3: Config Synchronizace

**Čas:** 4h

Aktualizovat tyto soubory aby používaly PORT_MATRIX hodnoty:

1. **Docker Compose Files:**
   - [ ] `docker-compose.native-2.9.5.yml`
   - [ ] `docker-compose.ncl.yaml`
   - [ ] `docker-compose.mainnet.yml` (nový)

2. **Rust Config:**
   - [ ] `2.9.5/zion-native/core/config.toml` (pokud existuje)
   - [ ] Hardcoded defaults v `main.rs`

3. **Test Configs:**
   - [ ] `2.9.5/tests/e2e/*.sh`

4. **Deploy Scripts:**
   - [ ] `deploy_helsinky_v3.sh`
   - [ ] `deploy_production_api.sh`

**Validation Script:**
```bash
#!/bin/bash
# scripts/validate_port_matrix.sh
set -e

EXPECTED_CORE_RPC=8444
EXPECTED_CORE_P2P=8334
EXPECTED_POOL_STRATUM=3333
EXPECTED_POOL_API=8080

# Check docker-compose
echo "Checking docker-compose files..."
for f in docker-compose*.yml; do
  if grep -q "8545" "$f"; then
    echo "ERROR: Legacy port 8545 found in $f"
    exit 1
  fi
done

echo "✅ Port matrix validation passed"
```

### Task 0.4: Docker Compose Cleanup

**Čas:** 3h

Vytvořit čistý `docker-compose.mainnet.yml`:

```yaml
# docker-compose.mainnet.yml
version: "3.9"

services:
  zion-core:
    image: zion/core:v2.9.5
    container_name: zion-core
    restart: unless-stopped
    ports:
      - "8444:8444"  # RPC
      - "8334:8334"  # P2P
    volumes:
      - ./data/core:/data
      - ./config/core.toml:/etc/zion/core.toml:ro
    environment:
      - RUST_LOG=info
      - CHAIN_ID=zion-mainnet-1
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8444/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - zion-net

  zion-pool:
    image: zion/pool:v2.9.5
    container_name: zion-pool
    restart: unless-stopped
    ports:
      - "3333:3333"  # Stratum
      - "8080:8080"  # API
    volumes:
      - ./data/pool:/data
      - ./config/pool.toml:/etc/zion/pool.toml:ro
    environment:
      - RUST_LOG=info
      - CORE_RPC_URL=http://zion-core:8444
      - REDIS_URL=redis://redis:6379
    depends_on:
      zion-core:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - zion-net

  redis:
    image: redis:7-alpine
    container_name: zion-redis
    restart: unless-stopped
    volumes:
      - ./data/redis:/data
    command: redis-server --appendonly yes
    networks:
      - zion-net

networks:
  zion-net:
    driver: bridge
```

### Task 0.5: E2E Smoke Test

**Čas:** 2h

Vytvořit jednoduchý smoke test:

```bash
#!/bin/bash
# tests/smoke_test_mainnet.sh
set -e

echo "=== ZION MainNet Smoke Test ==="

# 1. Start stack
echo "[1/5] Starting stack..."
docker compose -f docker-compose.mainnet.yml up -d

# 2. Wait for health
echo "[2/5] Waiting for services..."
sleep 30

# 3. Check core RPC
echo "[3/5] Testing Core RPC..."
curl -s http://localhost:8444/api/v1/status | jq .

# 4. Check pool API
echo "[4/5] Testing Pool API..."
curl -s http://localhost:8080/api/pool/stats | jq .

# 5. Test mining connection
echo "[5/5] Testing Stratum..."
echo '{"id":1,"method":"mining.subscribe","params":[]}' | nc -w 3 localhost 3333

echo "=== Smoke Test PASSED ==="
```

### Task 0.6: Documentation Update

**Čas:** 2h

Aktualizovat README soubory:

1. **2.9.5/README.md** — Quickstart s docker-compose.mainnet.yml
2. **docs/mainnet/QUICKSTART.md** — 5-minutový setup guide
3. Deprecate systemd instructions

---

## 🧪 Testing Checklist

- [ ] `docker compose -f docker-compose.mainnet.yml up -d` prochází
- [ ] Core RPC odpovídá na `localhost:8444`
- [ ] Pool API odpovídá na `localhost:8080`
- [ ] Miner se připojí na `localhost:3333`
- [ ] `scripts/validate_port_matrix.sh` prochází
- [ ] Žádné hardcoded legacy porty (8545, 18081)

---

## 📦 Deliverables

| Soubor | Popis |
|--------|-------|
| `docs/mainnet/PORT_MATRIX.yaml` | Kanonický port dokument |
| `docs/mainnet/PORT_AUDIT.md` | Výsledky auditu |
| `docker-compose.mainnet.yml` | Produkční compose |
| `scripts/validate_port_matrix.sh` | Validační skript |
| `tests/smoke_test_mainnet.sh` | Smoke test |
| `docs/mainnet/QUICKSTART.md` | Setup guide |

---

## ⏱️ Time Estimate

| Task | Čas |
|------|-----|
| Port Audit | 2h |
| Port Matrix | 1h |
| Config Sync | 4h |
| Docker Cleanup | 3h |
| Smoke Test | 2h |
| Docs Update | 2h |
| **Total** | **14h** |

---

## ✅ Exit Criteria

1. Žádné konfliktní port definice v codebase
2. `docker compose up` funguje na čistém stroji
3. Smoke test prochází
4. Dokumentace aktuální

---

## 🔗 Dependencies

- Žádné (Fáze 0 je samostatná)

---

## 🚧 Blockers

- Žádné známé

---

*Dokument aktualizován: 2026-02-03*
