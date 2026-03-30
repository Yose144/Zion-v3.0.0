# ZION 2.8.1 Testnet Deployment Checklist

## Pre-Deployment ✅

- [x] Production validation tests passed (95%+ success)
- [x] Concurrent access tests passed (50+ miners)
- [x] Database optimization verified (10K cache)
- [x] Seed nodes configured (2+ nodes)
- [x] RPC connectivity tested
- [ ] Testnet configuration created
- [ ] Database backups completed

## Deployment Steps

### 1. Environment Setup
```bash
# Verify Python packages
python3 -m pip install prometheus_client requests

# Check port availability
lsof -i :3335  # Testnet pool port
lsof -i :8545  # RPC port
lsof -i :8334  # P2P port
```

### 2. Start Blockchain RPC Server
```bash
python3 new_zion_blockchain.py
```

Expected output:
- ✅ Genesis block loaded
- ✅ RPC server running on port 8545
- ✅ P2P network initialized

### 3. Start Testnet Pool
```bash
python3 zion_universal_pool_v2.py --testnet
```

Expected output:
- ✅ Pool started on port 3335
- ✅ Consciousness game initialized
- ✅ Database connections established
- ✅ API server running on port 3334

### 4. Verify Deployment
```bash
# Check pool status
curl http://localhost:3334/api/stats

# Check consciousness game
curl http://localhost:3334/api/consciousness/leaderboard

# Check blockchain height
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getblockcount","params":[],"id":1}'
```

## Post-Deployment Monitoring

### Performance Metrics
- [ ] Share processing < 10ms average
- [ ] Duplicate detection < 20% rate
- [ ] Concurrent connections: 50+ stable
- [ ] Database throughput: 100+ ops/sec
- [ ] Memory usage: < 500MB
- [ ] CPU usage: < 50% average

### Functionality Tests
- [ ] Miner can connect via XMrig protocol
- [ ] Miner can connect via Stratum protocol
- [ ] Consciousness XP awards working
- [ ] Share validation operational
- [ ] Payout calculation correct
- [ ] Block mining functional

### Monitoring Commands
```bash
# Watch pool logs
tail -f zion_pool.log

# Monitor system resources
top -p $(pgrep -f zion_universal_pool)

# Check database size
ls -lh *.db

# View recent shares
sqlite3 zion_testnet_pool.db "SELECT * FROM shares ORDER BY timestamp DESC LIMIT 10;"
```

## Rollback Procedure

If issues occur:

1. Stop pool:
```bash
pkill -f zion_universal_pool
```

2. Stop blockchain:
```bash
pkill -f new_zion_blockchain
```

3. Restore databases:
```bash
mv zion_pool_backup_*.db zion_pool.db
mv consciousness_game_backup_*.db consciousness_game.db
```

4. Review logs:
```bash
cat zion_pool.log | grep ERROR
```

## Success Criteria

Deployment is successful when:
- ✅ All services running without errors
- ✅ 10+ test miners connected successfully
- ✅ Share processing rate > 100 shares/sec
- ✅ No critical errors in 1 hour monitoring period
- ✅ Database operations stable
- ✅ Consciousness game XP awards functional

## Next Steps

After successful testnet deployment:
1. Monitor for 24 hours
2. Collect performance metrics
3. Document any issues
4. Prepare for mainnet deployment
5. Update documentation with learnings

---

*Deployment Date: $(date)*
*Version: ZION 2.8.1 "Estrella"*
*Network: Testnet*
