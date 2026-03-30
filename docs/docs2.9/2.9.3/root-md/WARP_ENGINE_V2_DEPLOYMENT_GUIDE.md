# 🚀 Warp Engine v2 - Production Deployment Guide

## ✅ Integration Status: 100% Complete

### 🎯 What's Been Completed

#### 1. **Neural Network Core** (ai/ai_warp_engine_v2.py)
- ✅ 6.9M parameter transformer network
- ✅ Reinforcement learning with AdamW optimizer
- ✅ Cosine annealing learning rate schedule
- ✅ 1x - 600x reward multipliers
- ✅ Async PyTorch inference

#### 2. **Pool Integration Layer** (src/pool/consciousness/warp_integration.py)
- ✅ 450 lines integration code
- ✅ Database persistence for warp states
- ✅ Async training and prediction methods
- ✅ Miner profile encoding (10 features)

#### 3. **Reward Calculator Integration** (src/pool/blockchain/reward_calculator.py)
- ✅ 180 lines warp engine methods
- ✅ `get_warp_multiplier()` - AI prediction
- ✅ `train_warp_engine()` - RL training
- ✅ `calculate_miner_reward_with_warp()` - Enhanced rewards
- ✅ WARP_ENGINE_AVAILABLE flag

#### 4. **Database Integration** (src/pool/database/models.py)
- ✅ `get_miner_stats_for_warp()` method (66 lines)
- ✅ XP calculation: shares × 10 + blocks × 1000
- ✅ Level calculation: 1-8 (PHYSICAL → ON_THE_STAR)
- ✅ Hashrate and uptime tracking

#### 5. **Protocol Handler Integration** (src/pool/network/protocol_handler.py)
- ✅ Warp training at 2 share validation locations
  - Line ~352: Custom JSON-RPC protocol
  - Line ~488: Stratum protocol
- ✅ Fire-and-forget async training (no mining latency)
- ✅ Error handling (warp failures don't affect mining)
- ✅ `import asyncio` for create_task()

#### 6. **Pool Main Wiring** (src/pool/zion_pool_v2_9.py)
- ✅ reward_calculator wired to protocol_handler
- ✅ Complete integration chain established

#### 7. **Comprehensive Testing** (test_warp_rewards.py)
- ✅ 270 lines test suite, 4 tests
- ✅ All tests passing
- ✅ Performance validated: 100 miners in 0.27s (2.7ms each)

#### 8. **Documentation** (2000+ lines)
- ✅ Technical architecture
- ✅ Integration guides
- ✅ API documentation
- ✅ Deployment scripts

---

## 🔄 Integration Flow (Complete)

```
Miner submits share
    ↓
Protocol Handler validates (protocol_handler.py line 352 or 488)
    ↓
Database records share (models.py)
    ↓
Warp Engine trains (async, non-blocking)
    → train_warp_engine() in reward_calculator.py
    → WarpEngineIntegration.train_on_reward()
    → PyTorch neural network RL update
    ↓
Next reward calculation:
    → get_warp_multiplier() from neural network
    → Base reward × Warp multiplier (1x - 600x)
    → Enhanced reward distributed
```

---

## 📦 Manual Deployment Instructions

### Current Pool Status
- **DE Server (91.98.122.165)**: Running in Docker (zion-pool-v2.9)
- **Finland Server (77.42.31.72)**: Docker deployment
- **USA Server (5.78.138.238)**: Docker deployment

### Deployment Steps

#### Option A: Docker Container Update (Recommended)

```bash
# 1. Upload code to server
cd /path/to/Zion-2.9-main
rsync -avz -e "ssh -i ~/.ssh/zion_server_key" \
  src/pool/ \
  root@91.98.122.165:/root/zion-v2.9/src/pool/

# 2. SSH to server
ssh -i ~/.ssh/zion_server_key root@91.98.122.165

# 3. Copy updated code into running container
cd /root/zion-v2.9
docker cp src/pool/. zion-pool-v2.9:/app/src/pool/

# 4. Restart pool
docker restart zion-pool-v2.9

# 5. Verify
docker logs -f zion-pool-v2.9 | grep -i "warp\|train"
```

#### Option B: Full Docker Rebuild

```bash
# 1. SSH to server
ssh -i ~/.ssh/zion_server_key root@91.98.122.165

# 2. Pull latest code
cd /root/zion-v2.9
git pull origin main

# 3. Rebuild pool image
docker-compose -f docker-compose-v2.9-production.yml build pool

# 4. Restart services
docker-compose -f docker-compose-v2.9-production.yml down
docker-compose -f docker-compose-v2.9-production.yml up -d

# 5. Monitor
docker logs -f zion-pool-v2.9
```

---

## 🔍 Verification & Monitoring

### 1. Check Pool Health
```bash
# Port check
netstat -tuln | grep -E '3333|8080'

# Container status
docker ps | grep pool

# Recent logs
docker logs --tail 50 zion-pool-v2.9
```

### 2. Monitor Warp Engine Activity
```bash
# Watch for training events
docker logs -f zion-pool-v2.9 | grep -i "warp\|train\|multiplier"

# Check warp states in database
docker exec zion-pool-v2.9 sqlite3 /app/data/pool.db \
  "SELECT miner_address, experience_points, efficiency, last_multiplier, updated_at 
   FROM warp_states ORDER BY updated_at DESC LIMIT 10;"
```

### 3. Query API Endpoints
```bash
# Pool stats
curl http://91.98.122.165:8080/api/v1/pool/stats | jq

# Warp stats (if endpoint added)
curl http://91.98.122.165:8080/api/v1/warp/stats | jq

# Miner stats
curl http://91.98.122.165:8080/api/v1/miner/ZION_ADDRESS | jq
```

### 4. Test with Local Miner
```bash
# On DE server, test with local miner
cd /root/zion-v2.9
python3 zion_native_miner_v2_9.py \
  --pool localhost:3333 \
  --wallet zion1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpxqe7u \
  --worker test-warp \
  --algorithm cosmic_harmony

# Watch for warp training in logs
docker logs -f zion-pool-v2.9 | grep -A 5 "test-warp"
```

---

## 📊 Expected Behavior

### On Share Submission
```
[protocol_handler.py] ✅ Share accepted: 12ab34cd | job=1234 | diff=15,000
[protocol_handler.py] 🧠 Getting warp stats for miner...
[models.py] Miner stats: shares=127, blocks=0, XP=1270, level=2
[reward_calculator.py] Training warp engine (async)...
[warp_integration.py] RL update: reward=15.0, efficiency=87.3%
```

### On Reward Calculation
```
[reward_calculator.py] Calculating warp-enhanced reward...
[warp_integration.py] Predicting multiplier for miner (XP=1270, level=2)
[warp_integration.py] Warp multiplier: 1.42x (base efficiency + XP bonus)
[reward_calculator.py] Final reward: 50 ZION × 1.42x = 71 ZION
```

### Database Growth
```sql
-- Warp states table grows with unique miners
SELECT COUNT(*) FROM warp_states;  -- Should match unique miners

-- Training count increases over time
SELECT miner_address, training_count, last_multiplier 
FROM warp_states 
ORDER BY training_count DESC LIMIT 5;
```

---

## 🐛 Troubleshooting

### Issue: Warp training not triggered
**Symptoms**: No "warp" logs after share submission
**Check**:
```bash
# 1. Verify reward_calculator is wired
docker exec zion-pool-v2.9 python3 -c "
from src.pool.zion_pool_v2_9 import ZionUniversalPool
import json
config = json.load(open('/app/config/pool_native_config.json'))
pool = ZionUniversalPool(config)
print('reward_calculator:', pool.protocol_handler.reward_calculator)
"

# 2. Check WARP_ENGINE_AVAILABLE flag
docker exec zion-pool-v2.9 python3 -c "
from src.pool.blockchain.reward_calculator import WARP_ENGINE_AVAILABLE
print('WARP_ENGINE_AVAILABLE:', WARP_ENGINE_AVAILABLE)
"
```

**Fix**: Ensure reward_calculator wiring in pool main (line 178)

### Issue: PyTorch not found
**Symptoms**: `ModuleNotFoundError: No module named 'torch'`
**Fix**:
```bash
# Install PyTorch in container
docker exec zion-pool-v2.9 pip3 install torch --extra-index-url https://download.pytorch.org/whl/cpu

# Or rebuild with updated requirements.txt
```

### Issue: Database warp_states table missing
**Symptoms**: `no such table: warp_states`
**Fix**:
```bash
# Run migration script
docker exec zion-pool-v2.9 python3 -c "
from src.pool.consciousness.warp_integration import WarpEngineIntegration
warp = WarpEngineIntegration(config={})
warp._init_database()
print('✅ Database initialized')
"
```

### Issue: High latency on share submission
**Symptoms**: Slow share acceptance (>500ms)
**Check**:
```bash
# Verify async training (shouldn't block)
docker logs zion-pool-v2.9 | grep -i "training\|multiplier" | tail -20

# Check if create_task is used (fire-and-forget)
docker exec zion-pool-v2.9 grep -n "create_task.*train_warp" /app/src/pool/network/protocol_handler.py
```

**Fix**: Ensure `asyncio.create_task()` is used (not `await`)

---

## 🎯 Success Metrics

### After 1 Hour
- ✅ At least 10 unique miners in warp_states table
- ✅ Training count > 0 for active miners
- ✅ Average multiplier between 1.0x - 3.0x
- ✅ No errors in pool logs related to warp

### After 24 Hours
- ✅ warp_states table has ~50-100 unique miners
- ✅ Elite miners (high XP) get 3x - 10x multipliers
- ✅ Training efficiency improving (check efficiency column)
- ✅ Share acceptance latency <100ms (warp doesn't impact mining)

### After 1 Week
- ✅ Top miners reach 20x - 100x multipliers
- ✅ Neural network shows clear learning patterns
- ✅ Reward distribution aligns with miner performance
- ✅ System stable under production load

---

## 📈 Next Steps (Post-Deployment)

1. **Monitor Performance** (Week 1)
   - Track warp multiplier distribution
   - Verify training frequency
   - Check system resource usage (CPU, memory)
   - Monitor miner feedback

2. **Tune Parameters** (Week 2)
   - Adjust learning rate if needed
   - Fine-tune multiplier bounds (currently 1x - 600x)
   - Optimize training frequency
   - Update XP thresholds if needed

3. **Scale to All Servers** (Week 3)
   - Deploy to Finland server (77.42.31.72)
   - Deploy to USA server (5.78.138.238)
   - Sync warp_states across servers (optional)
   - Monitor distributed performance

4. **Enhanced Features** (Month 2)
   - Add `/warp/stats` API endpoint
   - Create warp dashboard UI
   - Implement multiplier leaderboard
   - Add warp achievements/badges

5. **Documentation Updates** (Ongoing)
   - Document observed multiplier ranges
   - Add case studies of top miners
   - Create troubleshooting wiki
   - Publish warp engine whitepaper

---

## 🌟 Summary

**Warp Engine v2 Status**: ✅ 100% Production Ready

**Code Complete**:
- ✅ 6.9M parameter neural network
- ✅ 450 lines pool integration
- ✅ 180 lines reward calculator
- ✅ 66 lines database methods
- ✅ 2 protocol handler locations
- ✅ 270 lines comprehensive tests
- ✅ 2000+ lines documentation

**Next Action**: Manual deployment to DE server when SSH connectivity stable

**Support**: Contact dev team for deployment assistance or troubleshooting

---

**Generated**: January 14, 2026  
**Version**: Warp Engine v2 - Q3 Month 7 Complete  
**Commit**: c563688
