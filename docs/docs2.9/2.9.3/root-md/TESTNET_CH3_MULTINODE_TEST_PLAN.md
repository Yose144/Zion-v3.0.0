# 🧪 TestNet CH v3 Multi-Node Mining Test Plan
**Date:** 18. ledna 2026  
**Version:** v2.9.5  
**Goal:** Verify CH v3 merged mining across all nodes with native miners

---

## 📋 Pre-Test Checklist

### Servers Overview
| Server | IP | Role | Pool Port | P2P Port |
|--------|----|----- |-----------|----------|
| **Helsinki** | 77.42.31.72 | PRIMARY SEED + POOL | 3333 | 8334 |
| **Singapore** | 5.223.56.122 | PEER NODE 2 | 3333 | 8335 |
| **USA** | 5.78.138.238 | PEER NODE 1 | 3333 | 8335 |

### CH v3 Configuration
| External Pool | Wallet | Status |
|---------------|--------|--------|
| ETC (2miners) | `0x79021A00024Ed82b0C9f4631ad9D0fB6B6A484A8` | ✅ Configured |
| RVN (2miners) | `RBv3HUypznKQ8gHnATNiDu145hs7pZj6DZ` | ✅ Configured |

---

## 🔧 Phase 1: Stop All Miners

### 1.1 Helsinki
```bash
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72
pkill -f "zion.*miner" || true
pkill -f "python.*miner" || true
docker ps | grep miner
```

### 1.2 Singapore
```bash
ssh -i ~/.ssh/zion_hetzner_key root@5.223.56.122
pkill -f "zion.*miner" || true
pkill -f "python.*miner" || true
docker ps | grep miner
```

### 1.3 USA
```bash
ssh -i ~/.ssh/zion_hetzner_key root@5.78.138.238
pkill -f "zion.*miner" || true
pkill -f "python.*miner" || true
docker ps | grep miner
```

---

## 🔍 Phase 2: Check Full Stack

### 2.1 Helsinki Stack Check
```bash
# Docker containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Expected:
# - zion-blockchain-helsinki (healthy)
# - zion-pool-helsinki (running)
# - zion-peer1-helsinki (running)
# - zion-peer2-helsinki (running)
# - zion-redis-helsinki (healthy)
# - zion-postgres-helsinki (healthy)

# Pool stats
curl -s http://localhost:8080/stats | jq '.blockchain.height, .miners.active'

# Blockchain RPC
curl -s -X POST http://localhost:18082/json_rpc -d '{"method":"get_info"}' | jq '.result.height'
```

### 2.2 Singapore Stack Check
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
curl -s http://localhost:8080/stats | jq '.blockchain.height'
curl -s http://localhost:8444/health
```

### 2.3 USA Stack Check
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
curl -s http://localhost:8080/stats | jq '.blockchain.height'
curl -s http://localhost:8444/health
```

---

## 🔄 Phase 3: Clean Blockchain Restart

### 3.1 Stop All Blockchain Nodes
```bash
# Helsinki
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "docker stop zion-blockchain-helsinki zion-peer1-helsinki zion-peer2-helsinki"

# Singapore  
ssh -i ~/.ssh/zion_hetzner_key root@5.223.56.122 "docker stop zion-blockchain-singapore"

# USA
ssh -i ~/.ssh/zion_hetzner_key root@5.78.138.238 "docker stop zion-blockchain-usa"
```

### 3.2 Clear Mempool (Optional - Keep Blockchain Data)
```bash
# Helsinki - clear only mempool, keep blockchain
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "docker exec zion-blockchain-helsinki rm -f /app/data/mempool.db 2>/dev/null || true"
```

### 3.3 Start Blockchain Nodes (Order Matters!)
```bash
# 1. Helsinki FIRST (seed node)
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "docker start zion-blockchain-helsinki && sleep 5 && docker start zion-peer1-helsinki zion-peer2-helsinki"

# 2. Wait for Helsinki to be ready
sleep 10

# 3. Singapore
ssh -i ~/.ssh/zion_hetzner_key root@5.223.56.122 "docker start zion-blockchain-singapore"

# 4. USA
ssh -i ~/.ssh/zion_hetzner_key root@5.78.138.238 "docker start zion-blockchain-usa"
```

### 3.4 Verify Sync
```bash
for server in "77.42.31.72" "5.223.56.122" "5.78.138.238"; do
  echo "=== $server ==="
  ssh -i ~/.ssh/zion_hetzner_key root@$server "curl -s http://localhost:8080/stats 2>/dev/null | jq '.blockchain.height' || echo 'N/A'"
done
```

---

## ⛏️ Phase 4: Start CH v3 Native Miners

### 4.1 Build Native Miner (if needed)
```bash
# On each server
cd /root/zion-rust && cargo build -p zion-universal-miner --release
```

### 4.2 Start Miners

#### Helsinki Miner (4 threads - 8GB RAM server)
```bash
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 '
cd /root/zion-rust
nohup ./target/release/zion-universal-miner \
  --pool stratum+tcp://localhost:3333 \
  --wallet zion1n3x003d7n3u6t5g6w75200r3j58748q878n406g \
  --worker helsinki-ch3 \
  --algorithm cosmic_harmony \
  --threads 4 \
  > /var/log/zion-miner.log 2>&1 &
echo "Miner started on Helsinki"
'
```

#### Singapore Miner (2 threads - 2GB RAM server)
```bash
ssh -i ~/.ssh/zion_hetzner_key root@5.223.56.122 '
cd /root/zion-rust
nohup ./target/release/zion-universal-miner \
  --pool stratum+tcp://77.42.31.72:3333 \
  --wallet zion1n3x003d7n3u6t5g6w75200r3j58748q878n406g \
  --worker singapore-ch3 \
  --algorithm cosmic_harmony \
  --threads 2 \
  > /var/log/zion-miner.log 2>&1 &
echo "Miner started on Singapore"
'
```

#### USA Miner (3 threads - 4GB RAM server)
```bash
ssh -i ~/.ssh/zion_hetzner_key root@5.78.138.238 '
cd /root/zion-rust
nohup ./target/release/zion-universal-miner \
  --pool stratum+tcp://77.42.31.72:3333 \
  --wallet zion1n3x003d7n3u6t5g6w75200r3j58748q878n406g \
  --worker usa-ch3 \
  --algorithm cosmic_harmony \
  --threads 3 \
  > /var/log/zion-miner.log 2>&1 &
echo "Miner started on USA"
'
```

---

## 📊 Phase 5: Monitoring

### 5.1 Pool Dashboard
```bash
# Active miners
curl -s http://77.42.31.72:8080/stats | jq '.miners'

# Shares
curl -s http://77.42.31.72:8080/stats | jq '.shares'

# Blocks
curl -s http://77.42.31.72:8080/stats | jq '.blocks'
```

### 5.2 Miner Logs
```bash
# Helsinki
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "tail -f /var/log/zion-miner.log"

# Singapore
ssh -i ~/.ssh/zion_hetzner_key root@5.223.56.122 "tail -f /var/log/zion-miner.log"

# USA
ssh -i ~/.ssh/zion_hetzner_key root@5.78.138.238 "tail -f /var/log/zion-miner.log"
```

### 5.3 CH v3 Merged Mining Check
```bash
# Pool logs for CH3 hash export
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "docker logs zion-pool-helsinki 2>&1 | grep -i 'ch3\|etc\|rvn\|merged' | tail -20"

# External pool dashboards:
# ETC: https://etc.2miners.com/account/0x79021A00024Ed82b0C9f4631ad9D0fB6B6A484A8
# RVN: https://rvn.2miners.com/account/RBv3HUypznKQ8gHnATNiDu145hs7pZj6DZ
```

---

## ✅ Success Criteria

| Metric | Target |
|--------|--------|
| Active miners | 3 (Helsinki, Singapore, USA) |
| Pool hashrate | > 0 H/s |
| Valid shares | Increasing |
| Blockchain sync | All nodes same height |
| CH3 hash export | Logs show ETC/RVN submissions |

---

## 🚨 Rollback Plan

If issues occur:
```bash
# Stop all miners
for server in "77.42.31.72" "5.223.56.122" "5.78.138.238"; do
  ssh -i ~/.ssh/zion_hetzner_key root@$server "pkill -f zion-universal-miner || true"
done

# Restart pool
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "docker restart zion-pool-helsinki"
```

---

## 📝 Notes

- **Primary pool:** Helsinki (77.42.31.72:3333)
- **All miners connect to Helsinki** (centralized pool for CH3 merged mining)
- **Blockchain:** All nodes sync to Helsinki seed
- **NCL:** Enabled with 30% NPU allocation
- **Merged mining:** ETC + RVN configured

---

**Status:** 📋 READY TO EXECUTE  
**Executor:** AI Agent  
**Estimated Time:** ~15 minutes

---

*Peace & One Love ☮️❤️*
