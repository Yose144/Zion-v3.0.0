# 🌐 ZION TestNet - Multi-Node Deployment Guide

**Date:** 10.01.2026  
**Network:** TestNet (Bridge to MainNet)  
**Architecture:** Distributed Multi-Region Blockchain

---

## 🗺️ Global Infrastructure

### Active Nodes (4 Locations)

```
┌────────────────────────────────────────────────────────────┐
│            ZION TESTNET - GLOBAL NETWORK                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  🇫🇮 HELSINKI (Primary Seed)                              │
│  IP: 77.42.31.72                                           │
│  Role: PRIMARY SEED NODE                                   │
│  P2P: 8334 (PUBLIC) ✅                                     │
│  Services: Blockchain + Pool + AI                         │
│  Status: ✅ ONLINE (Height: 5+)                           │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  🇩🇪 GERMANY (Secondary Peer)                             │
│  IP: 91.98.122.165                                         │
│  Role: PEER NODE                                           │
│  P2P: 8333 (CONFIGURING) ⏳                                │
│  Services: Blockchain + Pool + Monitoring                 │
│  Status: ⏳ SYNCING TO HELSINKI                           │
│  Current Height: 271 (independent, will reset)            │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  🇪🇺 NODE-3 (Location TBD)                                │
│  IP: 5.78.138.238                                          │
│  Role: PEER NODE (To be configured)                       │
│  P2P: 8334 (NOT YET DEPLOYED)                             │
│  Status: 🔧 PENDING DEPLOYMENT                            │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  🇺🇸 USA NODE (Location TBD)                              │
│  IP: [To be provided]                                      │
│  Role: PEER NODE (To be configured)                       │
│  P2P: 8334 (NOT YET DEPLOYED)                             │
│  Status: 🔧 PENDING DEPLOYMENT                            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 🚀 Deployment Process

### Phase 1: Primary Seed (✅ COMPLETE)

**Helsinki - PRIMARY SEED NODE**

```bash
# Already deployed with:
# - NODE_TYPE=seed
# - P2P_PORT=8334
# - P2P_ENABLE_SEED=true
# - NETWORK_TYPE=testnet

# Verification:
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 \
  'docker logs zion-blockchain-helsinki | grep "P2P"'
```

**Result:** ✅ Helsinki běží jako primary seed, P2P listening on 0.0.0.0:8334

---

### Phase 2: Germany Peer Sync (⏳ IN PROGRESS)

**Configuration Changes:**

```yaml
# docker-compose-v2.9-production.yml
blockchain:
  command:
    - python3
    - -u
    - /app/src/core/new_zion_blockchain.py
    - --rpc-port
    - "8545"
    - --p2p-port
    - "8333"
    - --db-file
    - /app/data/blockchain.db
    - --seed-nodes              # ← ADDED
    - "77.42.31.72:8334"        # ← ADDED
  environment:
    - NETWORK=testnet            # ← CHANGED from mainnet
```

**Deployment Steps:**

```bash
# 1. Backup current database (Germany has 271 independent blocks)
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 \
  'cd /root/zion-v2.9 && \
   docker exec zion-blockchain-v2.9 \
   cp /app/data/blockchain.db /app/data/blockchain.db.backup_271blocks'

# 2. Stop blockchain (will restart with new config)
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 \
  'cd /root/zion-v2.9 && docker compose stop blockchain'

# 3. Optional: Clear database to force clean sync
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 \
  'cd /root/zion-v2.9 && \
   docker exec zion-blockchain-v2.9 rm /app/data/blockchain.db'

# 4. Restart with peer configuration
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 \
  'cd /root/zion-v2.9 && docker compose up -d blockchain'

# 5. Monitor sync progress
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 \
  'docker logs -f zion-blockchain-v2.9 | grep -E "P2P|sync|block|height"'
```

**Expected Behavior:**
1. Germany node connects to Helsinki (77.42.31.72:8334)
2. Detects Helsinki has canonical chain (height: 5+)
3. Downloads all blocks from Helsinki
4. Continues to sync new blocks in real-time
5. Both nodes now share the same blockchain

---

### Phase 3: Additional Nodes (🔧 PENDING)

**Node 3 (5.78.138.238) - Deployment:**

```bash
# 1. SSH Access Setup
ssh-keyscan 5.78.138.238 >> ~/.ssh/known_hosts
ssh -i ~/.ssh/zion_hetzner_key root@5.78.138.238

# 2. Copy Helsinki deployment
scp -i ~/.ssh/zion_hetzner_key -r \
  /path/to/helsinki-config/* \
  root@5.78.138.238:/root/zion-node3/

# 3. Configure as PEER
# docker-compose.yml:
environment:
  - SEED_NODES=77.42.31.72:8334,91.98.122.165:8333
  - P2P_PORT=8334
  - NODE_TYPE=peer
  - NETWORK_TYPE=testnet

# 4. Deploy
ssh root@5.78.138.238 \
  'cd /root/zion-node3 && docker compose up -d'
```

**USA Node - Deployment:**

```bash
# Same process as Node 3
# Will be configured with all 3 EU nodes as seed:
SEED_NODES=77.42.31.72:8334,91.98.122.165:8333,5.78.138.238:8334
```

---

## 🔧 Network Configuration Matrix

| Node | IP | P2P Port | Role | Seeds | Status |
|------|----|----|------|-------|--------|
| 🇫🇮 Helsinki | 77.42.31.72 | 8334 | PRIMARY SEED | None (seed) | ✅ ONLINE |
| 🇩🇪 Germany | 91.98.122.165 | 8333 | PEER | 77.42.31.72:8334 | ⏳ SYNCING |
| 🇪🇺 Node-3 | 5.78.138.238 | 8334 | PEER | Helsinki + Germany | 🔧 PENDING |
| 🇺🇸 USA | TBD | 8334 | PEER | All EU nodes | 🔧 PENDING |

---

## 📊 Sync Verification

### Check Blockchain Height Across All Nodes

```bash
#!/bin/bash
# check_network_height.sh

echo "🔍 ZION TestNet - Network Height Check"
echo "======================================="

# Helsinki
echo -n "🇫🇮 Helsinki: "
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 \
  'docker exec zion-blockchain-helsinki python -c "
import sqlite3
conn = sqlite3.connect(\"/data/blockchain/node_main.db\")
c = conn.cursor()
c.execute(\"SELECT MAX(height) FROM blocks\")
print(c.fetchone()[0])
"' 2>/dev/null

# Germany
echo -n "🇩🇪 Germany:  "
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 \
  'docker exec zion-blockchain-v2.9 python -c "
import sqlite3
conn = sqlite3.connect(\"/app/data/blockchain.db\")
c = conn.cursor()
c.execute(\"SELECT MAX(height) FROM blocks\")
print(c.fetchone()[0])
"' 2>/dev/null

# Add more nodes as deployed...
```

**Expected Result (After Sync):**
```
🔍 ZION TestNet - Network Height Check
=======================================
🇫🇮 Helsinki: 42
🇩🇪 Germany:  42  ← Same height = SYNCED ✅
```

---

## 🔐 Firewall Requirements

### Required Open Ports (PUBLIC)

| Node | Port | Protocol | Purpose | Status |
|------|------|----------|---------|--------|
| Helsinki | 8334 | TCP | P2P TestNet | ✅ OPEN |
| Helsinki | 3333 | TCP | Mining Pool | ✅ OPEN |
| Helsinki | 8444 | TCP | RPC (ETH) | ✅ OPEN |
| Helsinki | 18082 | TCP | RPC (XMR) | ✅ OPEN |
| Germany | 8333 | TCP | P2P MainNet | ⚠️ VERIFY |
| Germany | 3333 | TCP | Mining Pool | ✅ OPEN |
| Node-3 | 8334 | TCP | P2P TestNet | 🔧 NEEDED |
| USA | 8334 | TCP | P2P TestNet | 🔧 NEEDED |

### Firewall Configuration Commands

**Helsinki (Already configured via Hetzner Cloud):**
```
✅ All required ports open
```

**Germany (Hetzner Cloud - TO VERIFY):**
```bash
# Via Hetzner Cloud Panel:
# 1. Go to Firewall settings
# 2. Add rule: TCP port 8333 (INCOMING)
# 3. Source: 0.0.0.0/0 (or specific IPs for security)
```

**Node-3 & USA (Configure when deploying):**
```bash
# Same as above, port 8334
```

---

## 🚨 Troubleshooting

### Issue 1: Germany not connecting to Helsinki

**Symptoms:**
```
Timeout connecting to seed 77.42.31.72:8334
```

**Solutions:**
```bash
# 1. Verify Helsinki P2P is listening
ssh root@77.42.31.72 'netstat -tuln | grep 8334'

# 2. Test connection from Germany
ssh root@91.98.122.165 'nc -zv 77.42.31.72 8334'

# 3. Check Helsinki firewall
curl http://77.42.31.72:8334
# Should timeout (not HTTP) but connection should establish

# 4. Check Germany can reach Helsinki
ssh root@91.98.122.165 'ping -c 3 77.42.31.72'
```

### Issue 2: Blockchain heights don't sync

**Symptoms:**
```
Helsinki: Height 42
Germany:  Height 271 (different)
```

**Solution:**
```bash
# Germany needs to reset and re-download from Helsinki
ssh root@91.98.122.165 '
  cd /root/zion-v2.9 && \
  docker compose stop blockchain && \
  docker exec zion-blockchain-v2.9 rm /app/data/blockchain.db && \
  docker compose up -d blockchain
'

# Monitor sync:
ssh root@91.98.122.165 'docker logs -f zion-blockchain-v2.9'
```

### Issue 3: P2P connection established but no block sync

**Check:**
```bash
# 1. Verify NETWORK matches on both nodes
ssh root@77.42.31.72 'docker logs zion-blockchain-helsinki | grep NETWORK'
ssh root@91.98.122.165 'docker logs zion-blockchain-v2.9 | grep NETWORK'
# Both must show: NETWORK=testnet

# 2. Check P2P protocol version
# Both nodes must run same blockchain code version
```

---

## 📈 Performance Expectations

### Network Latency

| Route | Expected RTT | Status |
|-------|-------------|--------|
| Helsinki ↔ Germany | ~20-40ms | ✅ Good |
| Helsinki ↔ USA | ~100-150ms | ⚠️ Monitor |
| Germany ↔ USA | ~80-120ms | ⚠️ Monitor |

### Sync Time Estimates

| Blocks | Network Speed | Est. Time |
|--------|--------------|-----------|
| 1-100 | Normal | ~1-2 minutes |
| 100-1000 | Normal | ~5-10 minutes |
| 1000+ | Normal | ~30-60 minutes |

**Note:** TestNet has fast block production, sync should be quick.

---

## 🎯 Next Steps

### Week 1 (Current)
- [x] Helsinki deployed as PRIMARY SEED
- [x] Germany peer configuration prepared
- [ ] Restart Germany blockchain with peer config
- [ ] Verify Germany syncs to Helsinki
- [ ] Confirm both nodes share same chain

### Week 2
- [ ] Deploy Node-3 (5.78.138.238)
- [ ] Deploy USA node
- [ ] Verify 4-node consensus
- [ ] Load test with 100+ miners

### Week 3
- [ ] Web Explorer deployment (visualize network)
- [ ] Monitoring dashboard (Grafana)
- [ ] Automated health checks
- [ ] Backup strategy for all nodes

---

## 📝 Deployment Checklist

```
Phase 2 - Germany Peer Sync:
[ ] Backup Germany blockchain (271 blocks)
[ ] Update docker-compose.yml with seed-nodes
[ ] Change NETWORK to testnet
[ ] Restart Germany blockchain
[ ] Monitor P2P connection to Helsinki
[ ] Wait for blockchain sync (271 → Helsinki height)
[ ] Verify both nodes have same height
[ ] Test mining on both pools
[ ] Document any issues

Phase 3 - Node 3 & USA:
[ ] SSH access configured
[ ] Docker installed
[ ] Copy deployment files
[ ] Configure as peers
[ ] Deploy and start
[ ] Monitor sync
[ ] Test cross-node mining
[ ] Performance benchmarks
```

---

**Last Updated:** 10.01.2026 07:15 UTC  
**Maintained by:** ZION Core Team  
**Network Type:** TestNet  
**MainNet Launch:** 31.12.2026
