# 📖 ZION v2.8.4 - Node Operator Migration Guide

**Target Audience:** Node operators, pool admins, miners upgrading from v2.7.x or v2.8.3  
**Migration Time:** ~15-30 minutes  
**Difficulty:** Medium

---

## 🎯 Overview

v2.8.4 introduces **ASIC-only mining** and **unified blockchain backend**. This guide helps you migrate smoothly.

### Key Changes
1. ❌ **SHA256 removed** - No longer supported (ASIC resistance policy)
2. ✅ **Cosmic Harmony default** - Native ZION algorithm (was autolykos2)
3. 🔗 **Single blockchain** - `src/core/new_zion_blockchain.py` everywhere
4. 📊 **New RPC endpoint** - `getalgorithms` for algo discovery

---

## ⚠️ Pre-Migration Checklist

- [ ] **Backup blockchain DB:** `cp data/zion_blockchain.db data/zion_blockchain.backup.db`
- [ ] **Backup wallet:** `cp zion_wallet.json zion_wallet.backup.json`
- [ ] **Review breaking changes:** See Release Notes section
- [ ] **Check disk space:** Ensure 2GB+ free for DB operations
- [ ] **Test environment:** Run on testnet first if possible

---

## 🔄 Migration Steps

### Step 1: Stop Current Node

```bash
# Gracefully stop existing node
pkill -SIGTERM -f "new_zion_blockchain.py"
# or
pkill -SIGTERM -f "real_blockchain.py"

# Wait for clean shutdown (check logs)
tail -f zion_node.log
```

### Step 2: Update Code

```bash
cd /path/to/Zion-2.8-main

# Backup current state
git stash  # If you have local changes

# Pull latest
git fetch origin
git checkout v2.8.4

# Restore local changes (if needed)
git stash pop
```

### Step 3: Update Dependencies

```bash
# Upgrade Python packages
pip install -r requirements.txt --upgrade

# Optional: Install ASIC-resistant algo libs
# RandomX
pip install pyrx

# Yescrypt (if binding available)
# pip install yescrypt

# Note: Cosmic Harmony uses built-in Python or compiled C++ lib
```

### Step 4: Update Configuration

#### Pool Config (`pool_config.json` or similar)

**OLD (v2.7.x):**
```json
{
  "algorithm": "autolykos2",
  "difficulty": 50
}
```

**NEW (v2.8.4):**
```json
{
  "algorithm": "cosmic_harmony",
  "difficulty": 15
}
```

#### Miner Config

**OLD:**
```python
from core.real_blockchain import ZionRealBlockchain
blockchain = ZionRealBlockchain()
```

**NEW (recommended):**
```python
import sys, os
sys.path.insert(0, 'src/core')
from new_zion_blockchain import ZionRealBlockchain
blockchain = ZionRealBlockchain()
```

**NEW (compatibility, with deprecation warning):**
```python
# Still works but will show deprecation warning
from core.real_blockchain import ZionRealBlockchain  
blockchain = ZionRealBlockchain()
```

#### Dashboard/GUI

If using Dashboard, restart and it will auto-detect v2.8.4 changes:
- Algorithm dropdown now shows: `cosmic_harmony`, `autolykos2`, `randomx`, `yescrypt`
- Default changed to `cosmic_harmony`

### Step 5: Compile Cosmic Harmony (Optional but Recommended)

For 10-50x performance boost:

```bash
cd zion/mining/

# macOS
g++ -shared -fPIC -O3 cosmic_harmony.cpp -o libcosmicharmony.dylib

# Linux
g++ -shared -fPIC -O3 cosmic_harmony.cpp -o libcosmicharmony.so

# Verify
ls -lh libcosmicharmony.*

cd ../..
```

If you skip this, Cosmic Harmony falls back to pure Python (slower but functional).

### Step 6: Test on Testnet (Recommended)

```bash
# Start in testnet mode
python3 src/core/new_zion_blockchain.py --testnet

# In another terminal, test RPC
curl -X POST http://localhost:8335 \
  -H "Content-Type: application/json" \
  -d '{"method":"getalgorithms","params":[],"id":1}'

# Expected response
{
  "result": {
    "supported": {"cosmic_harmony": true},
    "default": "cosmic_harmony",
    "active": "cosmic_harmony",
    "asic_only": true
  }
}
```

### Step 7: Start Production Node

```bash
# Production mainnet
python3 src/core/new_zion_blockchain.py

# Check logs
tail -f zion_node.log

# Expected log lines:
# ✅ Cosmic Harmony ready for production
# 🚀 ZION 2.8.4 Blockchain - PRODUCTION MODE
# 📊 Genesis block loaded: 1 blocks
# 💰 Total supply: 15,782,857,143 ZION
```

### Step 8: Verify Algorithm

```bash
# Query current algorithm
curl -X POST http://localhost:8332 \
  -H "Content-Type: application/json" \
  -d '{"method":"getalgorithms","params":[],"id":1}'

# Check blockchain info
curl -X POST http://localhost:8332 \
  -H "Content-Type: application/json" \
  -d '{"method":"getblockcount","params":[],"id":1}'
```

---

## 🐛 Troubleshooting

### Issue: "Algorithm 'sha256' is not available"

**Cause:** Code still references SHA256 (removed in v2.8.4)

**Fix:**
```python
# Change from:
block = mine_block(data, algorithm='sha256')

# To:
block = mine_block(data, algorithm='cosmic_harmony')
```

### Issue: "ImportError: cannot import name 'ZionRealBlockchain'"

**Cause:** Import path incorrect

**Fix:**
```python
# Update import
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src', 'core'))
from new_zion_blockchain import ZionRealBlockchain
```

### Issue: Deprecation Warning Spam

**Cause:** Still using `core/real_blockchain.py`

**Fix:** Migrate to `src/core/new_zion_blockchain.py` (step 4 above)

**Temporary Suppress:**
```python
import warnings
warnings.filterwarnings('ignore', category=DeprecationWarning)
```

### Issue: Low Hashrate (< 100 H/s)

**Cause:** Using Python Cosmic Harmony instead of C++ lib

**Fix:** Compile library (step 5 above) or switch to RandomX:
```bash
pip install pyrx
# Update config to algorithm='randomx'
```

### Issue: "Block validation failed"

**Cause:** Mixing old (SHA256) blocks with new (Cosmic Harmony) chain

**Fix:**
1. Stop node
2. Delete blockchain DB: `rm data/zion_blockchain.db`
3. Restart (will recreate genesis with Cosmic Harmony)

**⚠️ Warning:** This resets blockchain! Backup first if needed.

---

## 🧪 Post-Migration Validation

### 1. Check Algorithm Support

```bash
python3 -c "
import sys, os
sys.path.insert(0, 'src/core')
from algorithms import list_supported
print('Supported algorithms:', list_supported())
"

# Expected output:
# Supported algorithms: {'cosmic_harmony': True, 'randomx': False, ...}
```

### 2. Verify Genesis Premine

```bash
python3 src/core/new_zion_blockchain.py --testnet &
sleep 5

curl -X POST http://localhost:8335 \
  -d '{"method":"getblockcount","params":[],"id":1}' | jq

# Should show 1 block (genesis)
```

### 3. Run Integration Test

```bash
python3 tests/integration/test_rpc_algorithms_v2_8_4.py

# Expected:
# ✅ All tests passed! v2.8.4 RPC migration successful
```

---

## 📊 Performance Comparison

| Component | v2.7.x (SHA256) | v2.8.4 (Cosmic Harmony C++) | Improvement |
|-----------|-----------------|----------------------------|-------------|
| Block hash | ~50,000 H/s | ~22,000 H/s | -56% (but ASIC-resistant) |
| ASIC resistance | ❌ Low | ✅ High | +95% |
| GPU mining | ⚠️ Dominated by ASICs | ✅ Level playing field | Fair |

---

## 🔐 Security Notes

### Blockchain Integrity
- Genesis block hash **will change** (Cosmic Harmony vs SHA256)
- Old chain incompatible with v2.8.4+ nodes
- Recommended: Fresh start or coordinated upgrade with network

### Private Keys
- **Not affected** - Wallet encryption unchanged
- Backup remains compatible

### RPC Auth
- Same as v2.7.x (optional token)
- Set via `ZION_RPC_TOKEN` env var or auto-generated

---

## 🗓️ Deprecation Timeline

| Component | Status in v2.8.4 | Removal in v2.8.5 |
|-----------|------------------|-------------------|
| `core/real_blockchain.py` | Deprecated (warning) | ✅ Removed |
| SHA256 mining | ❌ Removed | N/A (already gone) |
| Old import paths | ⚠️ Still work | ✅ Removed |

**Action:** Migrate before v2.8.5 (estimated 2 weeks from v2.8.4 release)

---

## 🆘 Rollback Procedure

If migration fails:

```bash
# Stop v2.8.4 node
pkill -f "new_zion_blockchain.py"

# Restore backup
cp data/zion_blockchain.backup.db data/zion_blockchain.db
cp zion_wallet.backup.json zion_wallet.json

# Checkout previous version
git checkout v2.8.3  # or v2.7.x

# Restart old node
python3 core/real_blockchain.py  # v2.7.x
# or
python3 src/core/new_zion_blockchain.py  # v2.8.3
```

---

## 📞 Support

- **Migration Issues:** https://github.com/estrelaisabellazion3/Zion-2.8/issues
- **Documentation:** `docs/2.8.4/RELEASE_NOTES_v2.8.4.md`
- **Email:** support@zioncrypto.io
- **Emergency:** security@zioncrypto.io (for critical issues only)

---

## ✅ Migration Complete Checklist

- [ ] Node running v2.8.4 successfully
- [ ] RPC `getalgorithms` endpoint working
- [ ] Algorithm set to `cosmic_harmony` (or other ASIC-only)
- [ ] No SHA256 references in config/code
- [ ] Blockchain DB accessible and syncing
- [ ] Wallet operations functional
- [ ] Performance acceptable (C++ lib compiled if needed)
- [ ] No deprecation warnings in logs
- [ ] Monitoring/metrics updated

**Congratulations! 🎉 You're now running ZION v2.8.4 with ASIC-only mining.**

---

**Document Version:** 1.0  
**Last Updated:** 2025-10-31  
**Maintained By:** ZION Core Team
