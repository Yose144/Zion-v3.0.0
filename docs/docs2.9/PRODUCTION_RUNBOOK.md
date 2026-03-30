# 🚨 ZION v2.9 Production Runbook

> ⚠️ **LEGACY RUNBOOK (není kanonický pro v2.9.5 native)**
>
> Tento runbook používá starší porty/endpoints (např. RPC 8545, pool stats 8080) a popisuje předchozí deployment model.
> Pro v2.9.5 native Rust stack použij:
> - Port matrix: [docs/2.9.4/meta/PORT_MATRIX_TESTNET_v2.9.5.md](2.9.4/meta/PORT_MATRIX_TESTNET_v2.9.5.md)
> - Real status: [2.9.5/docs/REAL_STATUS_v2.9.5.md](../2.9.5/docs/REAL_STATUS_v2.9.5.md)
> - Native compose: [2.9.5/docker-compose.native-2.9.5.yml](../2.9.5/docker-compose.native-2.9.5.yml)
> - MainNet readiness: [docs/2.9.4/roadmaps/MAINNET_READINESS_v2.9.5.md](2.9.4/roadmaps/MAINNET_READINESS_v2.9.5.md)

**Verze**: 2.9 TestNet  
**Poslední aktualizace**: 1. ledna 2026  
**Server**: 91.98.122.165

---

## 📋 Rychlý přehled

| Služba | Port | Healthcheck | Log |
|--------|------|-------------|-----|
| Blockchain RPC | 8545 | `curl localhost:8545/health` | `docker logs blockchain` |
| Mining Pool | 3333 | `telnet localhost 3333` | `docker logs pool` |
| Pool Stats API | 8080 | `curl localhost:8080/api/stats` | `docker logs pool` |
| FastAPI Gateway | 8001 | `curl localhost:8001/health` | `docker logs api` |
| Redis | 6379 | `redis-cli ping` | `docker logs redis` |
| Prometheus | 9090 | `curl localhost:9090/-/healthy` | `docker logs prometheus` |
| Grafana | 3000 | `curl localhost:3000/api/health` | `docker logs grafana` |

---

## 🔥 Kritické incidenty

### 1. Blockchain nereaguje

**Příznaky**: 
- `BlockchainDown` alert
- RPC nereaguje na `curl localhost:8545/health`
- Pool nemůže získat block template

**Diagnostika**:
```bash
# Kontrola stavu kontejneru
docker ps -a | grep blockchain
docker logs blockchain --tail 100

# Kontrola paměti a CPU
docker stats blockchain --no-stream

# Kontrola disku
df -h /var/lib/docker
```

**Řešení**:
```bash
# 1. Restart kontejneru
docker restart blockchain

# 2. Pokud nepomůže, smaž a znovu spusť
docker stop blockchain
docker rm blockchain
docker-compose up -d blockchain

# 3. Pokud stále nefunguje, zkontroluj data
docker logs blockchain 2>&1 | grep -i "error\|corrupt"
# Případně resetuj blockchain data (POZOR: smaže chain!)
# rm -rf /root/zion-v2.9/data/blockchain/*
```

---

### 2. Mining pool nefunguje

**Příznaky**:
- `PoolDown` alert
- Miners se nemohou připojit na port 3333
- Žádné nové shares v logu

**Diagnostika**:
```bash
# Test Stratum připojení
echo '{"id":1,"method":"login","params":{"login":"test"}}' | nc localhost 3333

# Kontrola logu
docker logs pool --tail 200 | grep -i "error\|exception"

# Kontrola Redis (share tracking)
docker exec redis redis-cli INFO clients
```

**Řešení**:
```bash
# 1. Restart poolu
docker restart pool

# 2. Kontrola blockchain připojení
docker exec pool curl -s http://blockchain:8545/health

# 3. Vyčisti Redis cache (pokud corrupted)
docker exec redis redis-cli FLUSHDB
docker restart pool
```

---

### 3. Disk plný (>90%)

**Příznaky**:
- `DiskSpaceCritical` alert
- Služby padají s "No space left on device"

**Diagnostika**:
```bash
df -h
du -sh /var/lib/docker/*
docker system df
```

**Řešení**:
```bash
# 1. Docker prune (bezpečné)
docker system prune -af

# 2. Vyčisti staré logy
truncate -s 0 /var/log/*.log
journalctl --vacuum-size=100M

# 3. Rotuj pool logy
find /root/zion-v2.9/logs -name "*.log" -mtime +7 -delete

# 4. APT cache
apt-get clean
```

---

### 4. Žádné nové bloky (Block production stopped)

**Příznaky**:
- `BlockProductionStopped` alert
- Block height se nezvyšuje >15 min

**Diagnostika**:
```bash
# Aktuální výška
curl -s localhost:8545 -d '{"method":"get_latest_block"}' | jq .height

# Kontrola pool mining
docker logs pool --tail 50 | grep -i "block\|found\|submit"

# Kontrola miner připojení
docker exec pool cat /tmp/pool_stats.json | jq .active_miners
```

**Řešení**:
```bash
# 1. Zkontroluj, že pool je připojen
docker exec pool curl -s http://blockchain:8545/health

# 2. Zkontroluj mining template
curl -s localhost:8545 -d '{"method":"get_block_template"}' | jq .

# 3. Zkontroluj difficulty (TestNet může být příliš vysoká)
# Pokud difficulty > 100000 a 0 miners, snižte v config:
# vim /root/zion-v2.9/config/testnet_config.json
# "initial_difficulty": 1000

# 4. Restart mining stack
docker restart pool blockchain
```

---

### 5. P2P síť izolovaná (No peers)

**Příznaky**:
- `NoPeersConnected` alert
- Block sync nefunguje

**Diagnostika**:
```bash
# Kontrola peer listu
curl -s localhost:8545 -d '{"method":"get_peers"}' | jq .

# Test outbound connectivity
docker exec blockchain nc -zv seednode.zionterranova.com 8333

# Firewall check
ufw status
iptables -L -n | grep 8333
```

**Řešení**:
```bash
# 1. Přidej seed nodes ručně
curl -s localhost:8545 -d '{"method":"add_peer","params":{"host":"seednode1.zionterranova.com","port":8333}}'

# 2. Zkontroluj firewall
ufw allow 8333/tcp

# 3. Restart P2P
docker restart blockchain
```

---

## 📊 Monitoring Commands

### Rychlá diagnostika
```bash
# Všechny služby najednou
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Celkové zdraví
curl -s localhost:8545/health && echo " ✅ Blockchain OK"
curl -s localhost:8080/api/stats | jq .pool_hashrate && echo " ✅ Pool OK"
curl -s localhost:8001/health && echo " ✅ API OK"
```

### Real-time monitoring
```bash
# Sleduj logy všech služeb
docker-compose logs -f --tail 50

# Sleduj pouze chyby
docker-compose logs -f 2>&1 | grep -i "error\|exception\|failed"

# Sleduj block production
watch -n 10 'curl -s localhost:8545 -d "{\"method\":\"get_latest_block\"}" | jq .height'
```

### Metriky
```bash
# Prometheus queries
curl 'localhost:9090/api/v1/query?query=zion_blocks_total'
curl 'localhost:9090/api/v1/query?query=pool_active_miners'
curl 'localhost:9090/api/v1/query?query=pool_hashrate_total'
```

---

## 🔄 Standardní operace

### Restart celého stacku
```bash
cd /root/zion-v2.9
docker-compose down
docker-compose up -d
docker-compose logs -f --tail 50
```

### Deploy nové verze
```bash
cd /root/zion-v2.9
git pull origin main
docker-compose build --no-cache
docker-compose down
docker-compose up -d
```

### Backup blockchain dat
```bash
# Stop blockchain (aby data byla konzistentní)
docker stop blockchain

# Backup
tar -czvf /backup/zion-blockchain-$(date +%Y%m%d).tar.gz /root/zion-v2.9/data/blockchain/

# Start
docker start blockchain
```

### Restore z backupu
```bash
docker stop blockchain
rm -rf /root/zion-v2.9/data/blockchain/*
tar -xzvf /backup/zion-blockchain-YYYYMMDD.tar.gz -C /
docker start blockchain
```

---

## 📞 Kontakty & Eskalace

| Úroveň | Kontakt | Kdy eskalovat |
|--------|---------|---------------|
| L1 | DevOps team | Běžné incidenty, restart služeb |
| L2 | Backend dev | Chyby v kódu, performance issues |
| L3 | Core team | Blockchain consensus, security |

**Komunikační kanály**:
- Discord: #zion-devops
- Email: devops@zionterranova.com

---

## 📝 Incident template

```markdown
## Incident Report

**Datum/Čas**: 
**Severity**: Critical / Warning / Info
**Služba**: 
**Alert**: 

### Popis
[Co se stalo]

### Dopad
[Kolik uživatelů/minerů ovlivněno]

### Timeline
- HH:MM - Alert fired
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Resolved

### Root cause
[Proč se to stalo]

### Resolution
[Jak bylo opraveno]

### Prevention
[Co uděláme, aby se to neopakovalo]
```

---

*Runbook verze 1.0 - ZION TerraNova v2.9 TestNet*
