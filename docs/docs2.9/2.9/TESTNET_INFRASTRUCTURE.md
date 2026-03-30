# 🌐 ZION TestNet Infrastructure v2.9

**Status:** ✅ Active  
**Launch Date:** 10.01.2026  
**Network Type:** TestNet (Bridge to MainNet 31.12.2026)

---

## 🏗️ Network Architecture

### Primary Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                    ZION TESTNET                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🇫🇮 HELSINKI (Primary Seed Node)                          │
│  IP: 77.42.31.72                                            │
│  Role: PRIMARY SEED NODE + Pool + AI                       │
│  Hardware: Superior (Hetzner Finland)                       │
│  ├─ Blockchain Node (SEED)                                 │
│  │  └─ P2P Port: 8334 (PUBLIC)                             │
│  ├─ Mining Pool (Active)                                   │
│  │  └─ Stratum: 3333                                       │
│  │  └─ API: 8080                                           │
│  ├─ RPC Services                                           │
│  │  └─ ETH-style: 8444                                     │
│  │  └─ XMR-style: 18082                                    │
│  └─ AI Native Server                                       │
│     └─ Port: 8002                                          │
│                                                             │
│  Status: ✅ ONLINE (All Services Running)                  │
│  Current Height: 5+ blocks                                 │
│  TestNet: ✅ ENABLED                                       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🇩🇪 GERMANY (Secondary Node - Future Peer)               │
│  IP: 91.98.122.165                                          │
│  Role: Independent TestNet (Will sync to Helsinki later)   │
│  Hardware: Standard (Hetzner Germany)                       │
│  ├─ Blockchain Node #1 (MainNet config)                    │
│  │  └─ P2P Port: 8333 (BLOCKED - needs firewall config)   │
│  ├─ Blockchain Node #2 & #3 (Internal)                     │
│  └─ Mining Pool (Active, independent chain)                │
│                                                             │
│  Status: ✅ ONLINE (Independent - 271 blocks)              │
│  Note: Will be reconfigured as PEER to Helsinki            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Current Status (10.01.2026)

### Helsinki (Primary)
- **Blockchain Height:** 5 blocks (growing)
- **P2P Status:** Listening on 0.0.0.0:8334 ✅
- **Pool Status:** Active, accepting connections ✅
- **Test Results:** 10 miners successfully connected ✅
- **AI Server:** Healthy ✅

### Germany (Secondary)
- **Blockchain Height:** 271 blocks
- **Status:** Independent TestNet (not yet synced)
- **Future Action:** Configure as peer to Helsinki

---

## 🔧 Connection Details

### Mining (Stratum)
```bash
# Helsinki Pool
Server: 77.42.31.72:3333
Algorithm: cosmic_harmony, randomx, yescrypt, autolykos_v2
```

### RPC Endpoints

**Helsinki:**
```bash
# Ethereum-style RPC
http://77.42.31.72:8444

# Monero-style RPC
http://77.42.31.72:18082

# AI Native API
http://77.42.31.72:8002
```

**Germany:**
```bash
# ETH-style RPC
http://91.98.122.165:8545

# XMR-style RPC  
http://91.98.122.165:18081
```

---

## 🌐 P2P Network Configuration

### Helsinki (Primary Seed)
```yaml
NODE_TYPE: seed
P2P_PORT: 8334
P2P_ENABLE_SEED: true
NETWORK_TYPE: testnet
```

### Future: Germany as Peer
```yaml
NODE_TYPE: peer
P2P_PORT: 8333
SEED_NODES: 77.42.31.72:8334
NETWORK_TYPE: testnet
```

---

## 🚀 Deployment Process

### Phase 1: Helsinki Primary (✅ COMPLETE)
1. ✅ Deployed full stack (Blockchain + Pool + AI)
2. ✅ Configured as PRIMARY SEED node
3. ✅ Opened firewall ports (8334, 8444, 18082, 3333, 8002)
4. ✅ Verified mining pool functionality (10 miner test passed)
5. ✅ Independent blockchain growing

### Phase 2: Network Merge (⏳ PENDING)
1. ⏳ Open P2P port 8333 in Germany firewall
2. ⏳ Reconfigure Germany node as PEER
3. ⏳ Set SEED_NODES=77.42.31.72:8334
4. ⏳ Wait for blockchain sync (Germany → Helsinki)
5. ⏳ Verify consensus across both nodes

---

## 📈 Performance Metrics

### Helsinki Infrastructure
- **CPU:** Superior hardware
- **RAM:** Optimized for blockchain operations
- **Storage:** Fast SSD for blockchain DB
- **Network:** Low-latency Hetzner Finland datacenter

### Mining Test Results (10.01.2026)
```
Test: 10 concurrent miners × 45 seconds
Results:
  - All 10 miners connected ✅
  - Total shares accepted: 65
  - Share distribution: 6-8 per miner
  - Database integrity: ✅
  - No connection drops
```

---

## 🔐 Security Configuration

### Firewall Rules (Helsinki)

**INCOMING (Allowed):**
- `8334/tcp` - P2P (TestNet)
- `8444/tcp` - RPC (ETH-style)
- `18082/tcp` - RPC (XMR-style)
- `3333/tcp` - Mining Pool (Stratum)
- `8002/tcp` - AI Native API
- `22/tcp` - SSH (admin only)

**OUTGOING:** All allowed

### Firewall Rules (Germany) - TO BE UPDATED
**Current:**
- `8333/tcp` - ❌ BLOCKED (needs opening for P2P)

**Needed:**
- `8333/tcp` - ✅ OPEN (for Helsinki peer connection)

---

## 🛠️ Maintenance Commands

### Check Blockchain Height
```bash
# Helsinki
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 \
  'docker exec zion-blockchain-helsinki python -c "
import sqlite3
conn = sqlite3.connect(\"/data/blockchain/node_main.db\")
c = conn.cursor()
c.execute(\"SELECT MAX(height) FROM blocks\")
print(\"Height:\", c.fetchone()[0])
"'

# Germany
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 \
  'docker exec zion-blockchain-v2.9 python -c "
import sqlite3
conn = sqlite3.connect(\"/app/data/blockchain.db\")
c = conn.cursor()
c.execute(\"SELECT MAX(height) FROM blocks\")
print(\"Height:\", c.fetchone()[0])
"'
```

### Check Pool Stats
```bash
# Helsinki Pool
curl http://77.42.31.72:8080/api/pool/stats

# Check miners
ssh root@77.42.31.72 \
  'docker exec zion-pool-helsinki python -c "
import sqlite3
conn = sqlite3.connect(\"/app/data/pool.db\")
c = conn.cursor()
c.execute(\"SELECT COUNT(*) FROM miners\")
print(\"Active miners:\", c.fetchone()[0])
"'
```

### View P2P Connections
```bash
ssh root@77.42.31.72 \
  'docker logs --tail=100 zion-blockchain-helsinki | grep -i "p2p\|peer\|connect"'
```

---

## 🎯 Next Steps

### Immediate (Week 1)
- [ ] Deploy Web Explorer to visualize Helsinki blockchain
- [ ] Configure monitoring dashboard (Grafana)
- [ ] Set up automated backup for blockchain DB

### Short-term (Week 2-3)
- [ ] Open P2P port 8333 in Germany
- [ ] Sync Germany node to Helsinki
- [ ] Verify cross-node consensus
- [ ] Load testing (100+ miners)

### Long-term (Before MainNet)
- [ ] Add 3rd geographic node (Asia/US)
- [ ] Implement automatic failover
- [ ] Security audit
- [ ] Performance optimization

---

## 📝 Notes

**Why Helsinki as Primary?**
- Superior hardware specifications
- Better network connectivity
- Modern infrastructure setup
- Prepared for MainNet scaling

**Current Limitation:**
- Germany node runs independent chain (271 blocks)
- Helsinki node runs new chain (5+ blocks)
- **Merge pending** - requires P2P firewall config

**TestNet Philosophy:**
- Fast block production (easy PoW)
- No consciousness multipliers
- Focus on infrastructure testing
- Preparing for MainNet launch 31.12.2026

---

**Last Updated:** 10.01.2026 07:00 UTC  
**Maintained by:** ZION Core Team  
**TestNet Launch:** 31.12.2025  
**MainNet Launch:** 31.12.2026
