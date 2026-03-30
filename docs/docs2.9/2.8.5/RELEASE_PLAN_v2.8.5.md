# 🚀 ZION v2.8.5 "Unified Production" - Release Plan

**Release Date:** 3. listopadu 2025  
**Code Name:** "Unified Production"  
**Status:** PLANNING → IMPLEMENTATION → TESTING → DEPLOYMENT  
**Priority:** CRITICAL - Production Fix

---

## 🎯 Executive Summary

**Version 2.8.5** je **kritický bugfix release** řešící následující problémy zjištěné v produkcí:

### 🔴 Kritické problémy v 2.8.4:
1. **Dual-version chaos** - Server běží 2 verze současně (systemd + Docker)
2. **Mining broken** - RPC "Method not found" pro `generate` a `mine_block`
3. **225+ shares, 0 blocks** - Pool má validní shares, ale bloky se netěží
4. **Docker import errors** - `new_zion_blockchain.py` crashuje kvůli relativním importům
5. **Port conflicts** - Pool se připojuje na špatný endpoint (8545 místo 8332)

### ✅ Cíle verze 2.8.5:
1. ✅ **Jednotný backend** - Pouze `new_zion_blockchain.py` (odstranění `standalone_rpc_server.py`)
2. ✅ **Fix Docker imports** - Spuštění jako modul (`python -m`)
3. ✅ **Kompletní RPC API** - Všechny mining metody (`generate`, `mine_block`, `submitblock`)
4. ✅ **End-to-end mining** - Od share → block mining → reward distribution
5. ✅ **Clean deployment** - Jediná Docker Compose stack, žádné konflikty

---

## 📋 Phase 0: Problem Analysis (COMPLETE ✅)

### Root Cause Analysis

#### Problem 1: Dual Version Architecture
**Production server stav:**
```bash
# Systemd service (port 8332)
/opt/zion-node/standalone_rpc_server.py
  ✅ Má mining metody (generate, mine_block)
  ✅ Funguje samostatně
  ❌ Není Docker-based

# Docker container (port 8545)  
docker run zion-2.8.4-node
  ✅ Je v Docker Compose
  ❌ Nemá mining metody
  ❌ Import errors při startu
  ❌ Žádné logy (crashuje okamžitě)
```

**Result:** Pool se připojuje na Docker (8545) → "Method not found"

#### Problem 2: Import Errors in Docker
```python
# src/core/new_zion_blockchain.py line 38
from .zion_p2p_network import ZIONP2PNetwork
# ❌ ImportError: attempted relative import with no known parent package

# Fallback (line 44)
from zion_p2p_network import ZIONP2PNetwork
# ❌ Také selže, protože zion_p2p_network má svoje .imports
```

**Root cause:** Spuštění jako standalone script místo modulu

#### Problem 3: Missing Mining Methods
```python
# standalone_rpc_server.py (WORKS)
def _execute_method(self, method, params):
    if method == 'generate':
        return self._mine_blocks(params[0])
    elif method == 'mine_block':
        return self._mine_single_block()

# new_zion_blockchain.py (MISSING)
# ❌ Tyto metody neexistují v RPC serveru!
```

**Result:** Pool volá `generate` → 404 Method not found

---

## 📋 Phase 1: Code Fixes (IN PROGRESS)

### Task 1.1: Fix Docker Module Imports ✅

**File:** `deployment/Dockerfile.node`

**Change:**
```dockerfile
# OLD (broken)
CMD ["python", "/app/src/core/new_zion_blockchain.py"]

# NEW (fixed)
CMD ["python", "-m", "src.core.new_zion_blockchain"]
```

**Result:** Python treats it as module, relative imports work

**Status:** ✅ DONE

---

### Task 1.2: Add Mining RPC Methods

**File:** `src/core/zion_rpc_server.py`

**Current state:**
```python
# Missing methods: generate, mine_block, submitblock
```

**Required changes:**
```python
class ZIONRPCServer:
    def __init__(self, blockchain):
        self.blockchain = blockchain
        self.methods = {
            # Existing methods
            'get_info': self._get_info,
            'get_balance': self._get_balance,
            'send_transaction': self._send_transaction,
            
            # NEW: Mining methods
            'generate': self._generate_blocks,           # ← ADD
            'mine_block': self._mine_single_block,       # ← ADD
            'submitblock': self._submit_block,           # ← ADD
            'getblocktemplate': self._get_block_template,# ← ADD
        }
    
    def _generate_blocks(self, params):
        """Mine N blocks (Bitcoin Core compatible)"""
        num_blocks = params[0] if params else 1
        mined_hashes = []
        
        for i in range(num_blocks):
            block = self.blockchain.mine_block(
                miner_address=self.blockchain.get_miner_address(),
                algorithm='cosmic_harmony'
            )
            if block:
                mined_hashes.append(block['hash'])
        
        return mined_hashes  # Return list of block hashes
    
    def _mine_single_block(self, params):
        """Mine single block (ZION pool compatible)"""
        miner = params[0] if params else self.blockchain.get_miner_address()
        algorithm = params[1] if len(params) > 1 else 'cosmic_harmony'
        
        block = self.blockchain.mine_block(
            miner_address=miner,
            algorithm=algorithm
        )
        
        if block:
            return {
                'status': 'success',
                'block_hash': block['hash'],
                'block_height': block['height'],
                'reward': block['reward']
            }
        else:
            return {
                'status': 'error',
                'message': 'Mining failed'
            }
    
    def _submit_block(self, params):
        """Submit pre-mined block (for external miners)"""
        block_hex = params[0] if params else None
        if not block_hex:
            return {'error': 'Missing block data'}
        
        # Decode and validate block
        block = self.blockchain.validate_and_add_block(block_hex)
        
        if block:
            return {'status': 'accepted', 'hash': block['hash']}
        else:
            return {'error': 'Block rejected'}
    
    def _get_block_template(self, params):
        """Get block template for mining (Bitcoin Core compatible)"""
        return self.blockchain.get_block_template(
            algorithm=params[0] if params else 'cosmic_harmony'
        )
```

**Status:** ⏳ TODO

---

### Task 1.3: Implement Mining Methods in Blockchain

**File:** `src/core/new_zion_blockchain.py`

**Add methods:**
```python
class NewZionBlockchain:
    def mine_block(self, miner_address, algorithm='cosmic_harmony'):
        """Mine a new block with pending transactions"""
        with self.lock:
            # Get pending transactions
            txs = self.pending_transactions[:100]  # Max 100 tx per block
            
            # Create block
            previous_block = self.blocks[-1]
            block = {
                'height': len(self.blocks),
                'timestamp': time.time(),
                'previous_hash': previous_block['hash'],
                'transactions': txs,
                'miner': miner_address,
                'algorithm': algorithm,
                'nonce': 0,
                'difficulty': self.get_difficulty()
            }
            
            # Calculate block hash (simplified - real mining done by pool)
            block_string = json.dumps(block, sort_keys=True)
            block['hash'] = hashlib.sha256(block_string.encode()).hexdigest()
            
            # Calculate reward
            block['reward'] = self.calculate_block_reward(block['height'])
            
            # Add block to chain
            self.blocks.append(block)
            self._save_block_to_db(block)
            
            # Update balances
            self._update_balance(miner_address, block['reward'])
            
            # Remove mined transactions from mempool
            for tx in txs:
                if tx in self.pending_transactions:
                    self.pending_transactions.remove(tx)
            
            logger.info(f"✅ Block {block['height']} mined: {block['hash'][:16]}... " 
                       f"Reward: {block['reward']} ZION to {miner_address[:20]}...")
            
            return block
    
    def get_miner_address(self):
        """Get default miner address from premine"""
        premine = get_premine_addresses()
        return premine.get('mining_operators', [{}])[0].get('address', 'zion1default')
    
    def get_block_template(self, algorithm='cosmic_harmony'):
        """Return block template for external miners"""
        previous_block = self.blocks[-1]
        
        template = {
            'height': len(self.blocks),
            'previous_hash': previous_block['hash'],
            'timestamp': int(time.time()),
            'difficulty': self.get_difficulty(),
            'algorithm': algorithm,
            'transactions': self.pending_transactions[:100],
            'version': '2.8.5'
        }
        
        return template
```

**Status:** ⏳ TODO

---

### Task 1.4: Fix Pool RPC Client

**File:** `src/core/blockchain_rpc_client.py`

**Current code (broken):**
```python
def mine_block(self, miner_address, algorithm='cosmic_harmony'):
    try:
        response = self._send_rpc("generate", [1])  # ← 404 Method not found
        # ...
```

**Fixed code:**
```python
def mine_block(self, miner_address, algorithm='cosmic_harmony'):
    """Mine block via RPC - try multiple method names for compatibility"""
    
    # Try method 1: generate (Bitcoin Core style)
    try:
        response = self._send_rpc("generate", [1])
        if 'result' in response and response['result']:
            logger.info(f"✅ Block mined via 'generate': {response['result'][0]}")
            return {'status': 'success', 'hash': response['result'][0]}
    except Exception as e:
        logger.debug(f"'generate' method failed: {e}, trying 'mine_block'")
    
    # Try method 2: mine_block (ZION custom)
    try:
        response = self._send_rpc("mine_block", [miner_address, algorithm])
        if 'result' in response and response['result']['status'] == 'success':
            logger.info(f"✅ Block mined via 'mine_block': {response['result']['block_hash']}")
            return response['result']
    except Exception as e:
        logger.error(f"All mining methods failed: {e}")
        return {'status': 'error', 'message': str(e)}
```

**Status:** ⏳ TODO

---

## 📋 Phase 2: Local Testing

### Task 2.1: Rebuild Docker Image

```bash
cd /home/zion/ZION/deployment
sudo docker compose -f docker-compose.2.8.4-production.yml build --no-cache zion-node
```

**Expected:** Build succeeds without errors

---

### Task 2.2: Start Local Stack

```bash
sudo docker compose -f docker-compose.2.8.4-production.yml down
sudo docker compose -f docker-compose.2.8.4-production.yml up -d zion-node mining-pool
```

**Expected:**
- ✅ zion-node starts without crash
- ✅ Logs show: "✅ ZION Blockchain TESTNET MODE active"
- ✅ mining-pool connects to node

---

### Task 2.3: Verify RPC Methods

```bash
# Test 1: get_info
curl -X POST http://localhost:8545/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"get_info","params":[],"id":1}'

# Expected: {"result": {"height": 1, ...}}

# Test 2: generate (NEW)
curl -X POST http://localhost:8545/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"generate","params":[1],"id":1}'

# Expected: {"result": ["0xabc123..."]}  ← Block hash

# Test 3: mine_block (NEW)
curl -X POST http://localhost:8545/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"mine_block","params":["zion1test","cosmic_harmony"],"id":1}'

# Expected: {"result": {"status": "success", "block_hash": "0x...", "reward": 50}}
```

---

### Task 2.4: End-to-End Mining Test

```bash
# 1. Connect XMRig to local pool
xmrig -o localhost:3333 -u ZION_test_miner -p x --algo rx/0 --coin monero

# 2. Submit 100+ shares (wait ~2-3 minutes)

# 3. Check pool logs
sudo docker logs -f zion-2.8.4-pool | grep "check_block_found"

# Expected:
# 🔍 check_block_found: DB_shares=100, threshold=100
# 🔨 Mining block via RPC at zion-node:8545
# ✅ Block mined successfully: height=2, hash=0xabc...
# 💰 Distributing rewards: 50 ZION

# 4. Verify blockchain grew
curl http://localhost:8545/api/status | jq .blockchain.height

# Expected: 2 (or more if multiple blocks mined)
```

---

## 📋 Phase 3: Production Deployment

### Task 3.1: Clean Server State

```bash
ssh root@zionterranova.com

# Stop ALL services
systemctl stop zion-node
docker compose down
docker ps -a | grep zion | awk '{print $1}' | xargs docker rm -f

# Backup databases
cp /opt/zion-node/zion_blockchain.db /root/backup_pre_2.8.5/
cp /app/zion_pool.db /root/backup_pre_2.8.5/

# Clean old files
rm -rf /opt/zion-node
rm -rf /opt/zion-2.8.3
```

---

### Task 3.2: Deploy 2.8.5 Stack

```bash
# Upload docker-compose file
scp deployment/docker-compose.2.8.5-production.yml root@zionterranova.com:/opt/zion/

# Upload source code
scp -r . root@zionterranova.com:/opt/zion/

# On server
cd /opt/zion
docker compose -f docker-compose.2.8.5-production.yml up -d

# Watch logs
docker logs -f zion-2.8.5-node
docker logs -f zion-2.8.5-pool
```

---

### Task 3.3: Production Smoke Test

```bash
# 1. Check node health
curl https://zionterranova.com/api/status

# 2. Submit test share to pool
nc zionterranova.com 3333 << EOF
{"method":"login","params":{"login":"ZION_test","pass":"x"},"id":1}
EOF

# 3. Monitor for 30 minutes
# Expected: Shares → Block mining → Rewards

# 4. Verify in database
ssh root@zionterranova.com
sqlite3 /opt/zion/zion_pool.db "SELECT COUNT(*) FROM blocks;"
# Expected: > 0
```

---

## 📋 Phase 4: Version Tagging

### Task 4.1: Git Commit & Tag

```bash
cd /home/zion/ZION

# Commit all changes
git add .
git commit -m "v2.8.5: Fix Docker imports, add mining RPC methods, unified production stack"

# Create tag
git tag -a v2.8.5 -m "ZION v2.8.5 'Unified Production' - Critical bugfix release

Fixes:
- Docker import errors (python -m module execution)
- Missing RPC mining methods (generate, mine_block)
- Dual-version architecture (single Docker stack)
- End-to-end mining flow (shares → blocks → rewards)

Breaking changes: None
Migration: Drop-in replacement for 2.8.4
"

# Push to GitHub
git push origin main
git push origin v2.8.5
```

---

### Task 4.2: GitHub Release

**Title:** ZION v2.8.5 "Unified Production"

**Description:**
```markdown
# 🚀 ZION v2.8.5 "Unified Production"

Critical bugfix release fixing production mining issues.

## 🔴 Critical Fixes
- ✅ Fixed Docker import errors (module execution)
- ✅ Added missing RPC mining methods (`generate`, `mine_block`)
- ✅ Resolved dual-version architecture conflicts
- ✅ End-to-end mining now works (shares → blocks → rewards)

## 📦 Downloads
- Docker Compose: Recommended deployment method
- Source code: For custom builds

## 🔄 Upgrade from 2.8.4
```bash
docker compose down
docker compose -f docker-compose.2.8.5-production.yml up -d
```

No database migration required.

## 📊 Verified On
- Ubuntu 24.04.3 LTS
- Docker 28.1.1
- Production server: zionterranova.com

## 🐛 Known Issues
None

## 📝 Full Changelog
See RELEASE_NOTES_v2.8.5.md
```

---

## 📋 Phase 5: Documentation

### Task 5.1: Create Release Notes

**File:** `docs/2.8.5/RELEASE_NOTES_v2.8.5.md`

**Status:** This file serves as template

---

### Task 5.2: Update Main README

**File:** `README.md`

**Changes:**
- Update version badge: 2.8.4 → 2.8.5
- Update quick start command with new compose file
- Add "What's New in 2.8.5" section

---

### Task 5.3: Migration Guide

**File:** `docs/2.8.5/MIGRATION_GUIDE_2.8.4_to_2.8.5.md`

**Content:**
- Zero-downtime upgrade steps
- Database compatibility (no migration needed)
- Configuration changes (none)
- Rollback procedure

---

## 📊 Success Criteria

### Must Have (Blocking Release)
- [ ] Docker node starts without errors
- [ ] RPC methods `generate` and `mine_block` work
- [ ] Pool can mine blocks when threshold reached
- [ ] Rewards are distributed correctly
- [ ] Production deployment successful
- [ ] End-to-end test passes (shares → blocks → rewards)

### Should Have (Non-blocking)
- [ ] All unit tests pass
- [ ] Documentation complete
- [ ] GitHub release published
- [ ] Production monitoring shows no errors for 24h

### Nice to Have
- [ ] Performance benchmarks
- [ ] Load testing results
- [ ] Community announcement

---

## 🗓️ Timeline

| Phase | Duration | Start | End | Status |
|-------|----------|-------|-----|--------|
| Phase 0: Analysis | 2h | Nov 2 14:00 | Nov 2 16:00 | ✅ DONE |
| Phase 1: Code Fixes | 4h | Nov 2 16:00 | Nov 2 20:00 | 🔄 IN PROGRESS |
| Phase 2: Local Testing | 2h | Nov 2 20:00 | Nov 2 22:00 | ⏳ PENDING |
| Phase 3: Production Deploy | 1h | Nov 2 22:00 | Nov 2 23:00 | ⏳ PENDING |
| Phase 4: Version Tagging | 0.5h | Nov 2 23:00 | Nov 2 23:30 | ⏳ PENDING |
| Phase 5: Documentation | 1h | Nov 2 23:30 | Nov 3 00:30 | ⏳ PENDING |
| **TOTAL** | **10.5h** | **Nov 2 14:00** | **Nov 3 00:30** | **20% DONE** |

---

## 🎯 Next Steps

### Immediate (Now)
1. Implement Task 1.2: Add mining RPC methods to `zion_rpc_server.py`
2. Implement Task 1.3: Add mining methods to `new_zion_blockchain.py`
3. Test Task 1.4: Verify RPC client fallback logic

### After Code Complete
4. Rebuild Docker image (Task 2.1)
5. Run local end-to-end test (Task 2.4)
6. Deploy to production (Phase 3)

### Final
7. Tag version and create GitHub release
8. Monitor production for 24h
9. Announce to community

---

## 📞 Rollback Plan

If production deployment fails:

```bash
# On server
cd /opt/zion
docker compose -f docker-compose.2.8.5-production.yml down

# Restore 2.8.3 standalone server
systemctl start zion-node

# Verify
curl http://localhost:8332/
```

Database rollback not needed (2.8.5 is backwards compatible).

---

**Document Status:** ✅ COMPLETE  
**Next Action:** Implement Task 1.2 (Add RPC mining methods)  
**Owner:** Zion Development Team  
**Priority:** CRITICAL
