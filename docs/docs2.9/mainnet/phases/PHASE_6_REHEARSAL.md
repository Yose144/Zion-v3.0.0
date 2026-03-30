# 🎭 FÁZE 6: Genesis Rehearsal — Technická Specifikace

**Priorita:** P0 (Final gate before MainNet)  
**Trvání:** 1-2 týdny  
**Owner:** Release Lead + Core Team

---

## 🎯 Cíl

Provést kompletní "dress rehearsal" MainNet launche na izolované síti. Otestovat celý proces od genesis creation po stabilní těžbu.

---

## 📋 Rehearsal Checklist

### Pre-Rehearsal Setup

#### Infrastructure
- [ ] 3 VPS v různých regionech (EU, US, ASIA)
- [ ] Izolovaná síť (no public access)
- [ ] Monitoring stack deployed
- [ ] Fresh machines (no old data)

#### Software
- [ ] Final release candidate tagged
- [ ] Docker images built
- [ ] Binaries compiled
- [ ] Checksums published

#### Configuration
- [ ] Genesis config finalized
- [ ] Seed node list ready
- [ ] Pool config tested
- [ ] Miner config tested

---

## 📋 Rehearsal Script

### Phase R1: Genesis Creation (T-2h)

```bash
#!/bin/bash
# scripts/genesis_rehearsal.sh - PHASE R1

set -e
echo "=== PHASE R1: Genesis Creation ==="

# 1. Verify we're on correct tag
TAG=$(git describe --tags)
echo "Release: $TAG"

# 2. Build final binaries
echo "[1/5] Building binaries..."
cd 2.9.5/zion-native
cargo build --release

# 3. Generate genesis (offline simulation)
echo "[2/5] Creating genesis block..."

# Genesis timestamp: start of next hour (for coordination)
GENESIS_TIME=$(date -u -d "next hour" +%s)
echo "Genesis timestamp: $GENESIS_TIME"

# Create genesis.json
cat > config/genesis.json << EOF
{
  "chain_id": "zion-rehearsal-$(date +%Y%m%d)",
  "genesis_time": "$GENESIS_TIME",
  "consensus_params": {
    "block_time_secs": 60,
    "max_block_size": 2097152,
    "max_tx_size": 262144
  },
  "app_state": {
    "balances": [
      {
        "address": "zion1rehearsal_treasury_addr",
        "amount": "4500000000000000000"
      }
      // ... other premine addresses
    ]
  }
}
EOF

# 4. Calculate genesis hash
echo "[3/5] Calculating genesis hash..."
GENESIS_HASH=$(sha256sum config/genesis.json | cut -d' ' -f1)
echo "Genesis hash: $GENESIS_HASH"

# 5. Sign genesis (simulated multi-sig)
echo "[4/5] Genesis signing ceremony (simulated)..."
echo "$GENESIS_HASH" > genesis_signature_request.txt
# In real ceremony: each signer signs this hash

# 6. Package release
echo "[5/5] Packaging release..."
tar -czf "zion-$TAG-genesis.tar.gz" \
    target/release/zion-core \
    target/release/zion-pool \
    config/genesis.json \
    genesis_signature_request.txt

echo "=== PHASE R1 COMPLETE ==="
echo "Genesis hash: $GENESIS_HASH"
echo "Release package: zion-$TAG-genesis.tar.gz"
```

### Phase R2: Seed Node Deployment (T-1h)

```bash
#!/bin/bash
# scripts/genesis_rehearsal.sh - PHASE R2

echo "=== PHASE R2: Seed Node Deployment ==="

SEED_NODES=(
    "seed1:eu-west:77.42.31.72"
    "seed2:us-east:5.78.145.234"
    "seed3:asia-sg:5.223.56.124"
)

SSH_KEY="~/.ssh/zion_hetzner_key"

for node in "${SEED_NODES[@]}"; do
    IFS=':' read -r name region ip <<< "$node"
    echo "[*] Deploying to $name ($region) @ $ip..."
    
    # 1. Upload release
    scp -i $SSH_KEY "zion-$TAG-genesis.tar.gz" root@$ip:/root/
    
    # 2. Setup and start
    ssh -i $SSH_KEY root@$ip << 'REMOTE'
        set -e
        
        # Extract
        cd /root
        tar -xzf zion-*-genesis.tar.gz
        
        # Stop any existing
        docker-compose down || true
        
        # Clean data
        rm -rf /data/zion/*
        
        # Copy genesis
        mkdir -p /data/zion/config
        cp config/genesis.json /data/zion/config/
        
        # Start core (wait mode - won't mine until genesis time)
        docker-compose up -d zion-core
        
        echo "Node ready, waiting for genesis..."
REMOTE
    
    echo "[✓] $name deployed"
done

echo "=== PHASE R2 COMPLETE ==="
echo "All seed nodes deployed and waiting"
```

### Phase R3: Genesis Launch (T-0)

```bash
#!/bin/bash
# scripts/genesis_rehearsal.sh - PHASE R3

echo "=== PHASE R3: Genesis Launch ==="

# Wait for genesis time
GENESIS_TIME=$(cat config/genesis.json | jq -r '.genesis_time')
NOW=$(date +%s)
WAIT=$((GENESIS_TIME - NOW))

if [ $WAIT -gt 0 ]; then
    echo "Waiting $WAIT seconds until genesis..."
    sleep $WAIT
fi

echo "Genesis time reached! Checking nodes..."

# Check all nodes
for node in "${SEED_NODES[@]}"; do
    IFS=':' read -r name region ip <<< "$node"
    
    # Check height
    HEIGHT=$(curl -s http://$ip:8444/api/v1/stats | jq -r '.height')
    echo "$name: height=$HEIGHT"
done

echo "=== PHASE R3 COMPLETE ==="
```

### Phase R4: First Block (T+1min)

```bash
#!/bin/bash
# scripts/genesis_rehearsal.sh - PHASE R4

echo "=== PHASE R4: First Block ==="

# Start pool
echo "[1/3] Starting pool..."
ssh -i $SSH_KEY root@$POOL_IP << 'REMOTE'
    docker-compose up -d zion-pool
REMOTE

# Start test miner
echo "[2/3] Starting test miner..."
./zion-miner \
    --pool $POOL_IP:3333 \
    --wallet zion1rehearsal_test_miner \
    --threads 4 &

MINER_PID=$!

# Wait for first block
echo "[3/3] Waiting for first block..."
for i in {1..120}; do
    HEIGHT=$(curl -s http://$SEED1_IP:8444/api/v1/stats | jq -r '.height')
    if [ "$HEIGHT" -gt "0" ]; then
        echo "🎉 First block mined! Height: $HEIGHT"
        break
    fi
    sleep 5
done

kill $MINER_PID

echo "=== PHASE R4 COMPLETE ==="
```

### Phase R5: Stability Check (T+24h)

```bash
#!/bin/bash
# scripts/genesis_rehearsal.sh - PHASE R5

echo "=== PHASE R5: 24h Stability Check ==="

# Run for 24 hours with automated monitoring
DURATION=$((24 * 3600))
START=$(date +%s)

while [ $(($(date +%s) - START)) -lt $DURATION ]; do
    echo "=== $(date) ==="
    
    for node in "${SEED_NODES[@]}"; do
        IFS=':' read -r name region ip <<< "$node"
        
        # Check node status
        STATUS=$(curl -s http://$ip:8444/api/v1/stats)
        HEIGHT=$(echo $STATUS | jq -r '.height')
        PEERS=$(echo $STATUS | jq -r '.peer_count')
        SYNCING=$(echo $STATUS | jq -r '.syncing')
        
        echo "$name: height=$HEIGHT, peers=$PEERS, syncing=$SYNCING"
        
        # Check if synced
        if [ "$SYNCING" == "true" ]; then
            echo "⚠️  $name is still syncing!"
        fi
    done
    
    # Check block production rate
    EXPECTED_BLOCKS=$(($(date +%s) - GENESIS_TIME) / 60)
    ACTUAL_BLOCKS=$HEIGHT
    DIFF=$((EXPECTED_BLOCKS - ACTUAL_BLOCKS))
    
    if [ $DIFF -gt 10 ]; then
        echo "⚠️  Block production behind by $DIFF blocks!"
    fi
    
    echo "---"
    sleep 300  # Check every 5 minutes
done

echo "=== PHASE R5 COMPLETE ==="
```

---

## 📋 Validation Checklist

### After Phase R4 (First Block)

- [ ] Genesis block hash matches expected
- [ ] Block 1 mined within 10 minutes of genesis
- [ ] All seed nodes synced
- [ ] Pool accepting connections
- [ ] Miner receiving jobs

### After Phase R5 (24h)

- [ ] All nodes still synced
- [ ] No orphan blocks > 1%
- [ ] Block time average within ±10% of target
- [ ] No crashes or restarts needed
- [ ] Payouts executed successfully
- [ ] Logs show no errors

---

## 📋 Runbook Document

```markdown
# docs/mainnet/RUNBOOK.md

## Standard Operations

### Starting a Node

```bash
docker-compose up -d zion-core
docker-compose logs -f zion-core
```

### Checking Node Status

```bash
curl http://localhost:8444/api/v1/stats | jq
```

### Stopping a Node

```bash
docker-compose stop zion-core
```

### Full Restart (Clean)

```bash
docker-compose down
rm -rf /data/zion/db/*  # Keep genesis!
docker-compose up -d
```

## Emergency Procedures

### Node Won't Sync

1. Check peer count: `curl .../stats | jq '.peer_count'`
2. If 0 peers, add seed manually:
   ```bash
   curl -X POST http://localhost:8444/api/v1/peers/add \
       -d '{"address": "seed1.zionterranova.com:8334"}'
   ```
3. If still failing, check firewall (port 8334)

### Node Stuck at Height X

1. Check if other nodes progressing
2. If local issue:
   ```bash
   docker-compose restart zion-core
   ```
3. If network issue:
   - Check #operations channel
   - May need coordinated action

### Pool Not Submitting Blocks

1. Check pool logs: `docker-compose logs zion-pool`
2. Verify core RPC connection:
   ```bash
   curl http://zion-core:8444/api/v1/stats
   ```
3. Check wallet balance for pool

### Emergency Shutdown

```bash
# All services
docker-compose down

# Core only (keep pool for stats)
docker-compose stop zion-core
```
```

---

## 📋 Go/No-Go Checklist

```markdown
# docs/mainnet/GO_NOGO_CHECKLIST.md

## T-7 Days: Pre-Launch Readiness

### Technical
- [ ] All Fáze 0-5 completed
- [ ] Release candidate tagged
- [ ] Binaries built and checksummed
- [ ] Genesis config finalized
- [ ] Rehearsal completed successfully

### Infrastructure  
- [ ] Seed nodes provisioned
- [ ] DNS configured
- [ ] Monitoring ready
- [ ] Backup procedures tested

### Documentation
- [ ] User guides published
- [ ] API docs published
- [ ] Legal disclaimers published

### Communication
- [ ] Announcement drafted
- [ ] Community channels ready
- [ ] Support team briefed

## T-1 Day: Final Go/No-Go

### Go Criteria (ALL must be true)
- [ ] All T-7 items complete
- [ ] No critical bugs open
- [ ] Team available for launch day
- [ ] Rollback procedure documented
- [ ] Core team sign-off obtained

### No-Go Criteria (ANY causes delay)
- [ ] Critical bug discovered
- [ ] Security concern raised
- [ ] Key team member unavailable
- [ ] Infrastructure not ready
- [ ] Legal/regulatory block

## Decision

| Criterion | Status | Notes |
|-----------|--------|-------|
| Technical Ready | ⬜ | |
| Infrastructure Ready | ⬜ | |
| Docs Ready | ⬜ | |
| Team Ready | ⬜ | |
| No Blockers | ⬜ | |

**DECISION: ⬜ GO / ⬜ NO-GO**

Signed: _______________ Date: ___________
```

---

## 📦 Deliverables

| Soubor | Popis |
|--------|-------|
| `scripts/genesis_rehearsal.sh` | Automated rehearsal script |
| `docs/mainnet/RUNBOOK.md` | Operations runbook |
| `docs/mainnet/GO_NOGO_CHECKLIST.md` | Launch decision checklist |
| `reports/rehearsal_report.md` | Rehearsal results |

---

## ⏱️ Time Estimate

| Task | Čas |
|------|-----|
| Rehearsal prep | 8h |
| Rehearsal execution | 24h (wall clock) |
| Monitoring | 8h |
| Report writing | 4h |
| Issue remediation | Variable |
| **Total** | **40h + buffer** |

---

## ✅ Exit Criteria

1. Rehearsal completed 3x without manual intervention
2. All checklist items green
3. Runbook validated
4. Go/No-Go meeting held
5. Core team sign-off

---

## 🔄 Rehearsal Schedule

| Attempt | Date | Result | Notes |
|---------|------|--------|-------|
| #1 | TBD | ⬜ | Initial run |
| #2 | TBD | ⬜ | Post-fix verification |
| #3 | TBD | ⬜ | Final dress rehearsal |

---

*Dokument aktualizován: 2026-02-03*
