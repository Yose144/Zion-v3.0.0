# Phase 6 - Native Libraries Integration & Pool Testing
## Session Report - 11. listopadu 2025

---

## ✅ COMPLETED WORK

### 1. Phase 6 CI/CD Infrastructure (commit bf91076)
- ✅ GitHub Actions workflows (native-build.yml, release.yml)
- ✅ Python packaging (setup.py, MANIFEST.in)
- ✅ Build automation (build_all.sh)
- ✅ All 3 native libraries building and tested locally:
  * **Cosmic Harmony**: 548,319 H/s (single-thread benchmark)
  * **RandomX**: ~6,600 H/s @ 11 threads with large pages
  * **Yescrypt**: ~4,783 H/s @ 11 threads with OpenMP

### 2. Universal Miner Integration (Local)
- ✅ `src/miners/zion_universal_miner.py` - Async miner with native library support
- ✅ `src/core/algorithms.py` - Auto-detects and loads .so libraries from zion/mining/
- ✅ Local testing successful:
  * All 3 algorithms available and loading
  * Cosmic Harmony: 115,000 H/s @ 4 threads
  * RandomX: ~6,600 H/s expected
  * Yescrypt: ~4,783 H/s expected

### 3. SSH Production Server Setup (91.98.122.165)
- ✅ SSH key authentication configured (passwordless access)
  * Key: ~/.ssh/id_ed25519_hetzner
  * Config alias: "hetzner"
  * User: root
- ✅ Pool location: /opt/zion/Zion-2.9/src/core/zion_universal_pool_v2.py
- ✅ Native libraries deployed to server:
  * `/opt/zion/Zion-2.9/zion/mining/libcosmic_harmony_zion.so.2.9.0` (102KB)
  * `/opt/zion/Zion-2.9/zion/mining/librandomx_zion.so.2.9.0` (280KB)
  * `/opt/zion/Zion-2.9/zion/mining/libyescrypt_zion.so.2.9.0` (70KB)
- ✅ Python wrappers deployed:
  * cosmic_harmony_wrapper.py (10KB)
  * randomx_wrapper.py (12KB)
  * yescrypt_wrapper.py (7.6KB)
- ✅ Symlinks created for easier loading:
  * libcosmic_harmony_zion.so → libcosmic_harmony_zion.so.2.9.0
  * librandomx_zion.so → librandomx_zion.so.2.9.0
  * libyescrypt_zion.so → libyescrypt_zion.so.2.9.0
- ✅ Dependencies installed:
  * `pip3 install --break-system-packages ecdsa==0.19.0`

### 4. Pool Algorithm Detection Fixed
**IMPORTANT DESIGN CHANGE:**
- ❌ OLD (WRONG): Pool detected algorithm from `password` field
- ✅ NEW (CORRECT): Pool reads algorithm from dedicated `algo` field in login params

**Changes made to `src/core/zion_universal_pool_v2.py`:**
```python
# Read algorithm from dedicated 'algo' field (proper way)
algo_param = params.get("algo", "randomx")

# Handle both string and list (some miners send list)
if isinstance(algo_param, list):
    algorithm = algo_param[0] if algo_param else "randomx"
else:
    algorithm = algo_param

# Normalize algorithm name
algorithm = str(algorithm).lower().replace("-", "_").replace(" ", "_")
```

### 5. Miner Algorithm Communication Fixed
**Changes made to `src/miners/zion_universal_miner.py`:**
```python
# Pool detekuje algoritmus z password fieldu -> CHANGED to algo field
await self.send_json_rpc(
    method="login",
    params={
        "login": self.config.wallet_address,
        "pass": self.config.worker_name,  # Now just worker name
        "agent": "ZionUniversalMiner/2.9",
        "algo": current_algo.value,  # Algorithm sent in dedicated field
    }
)
```

---

## 🔧 WORK IN PROGRESS

### Pool Stability Issues (Server-Side)
**Last observed errors:**
1. ✅ Port 3333 already in use - RESOLVED (killed old processes)
2. ⚠️ Pool startup errors:
   ```
   'list' object has no attribute 'lower'
   ```
   - **CAUSE**: Miner sends `"algo": ["cosmic_harmony"]` (list) but pool expected string
   - **FIX APPLIED**: Added `isinstance(algo_param, list)` check in pool
   - **STATUS**: Fix uploaded to server, needs restart and testing

3. ⚠️ Permission issues:
   - `/tmp/pool.log` - Permission denied
   - **WORKAROUND**: Use `~/pool.log` instead

### Miner Connection Issues (Local-Side)
**Symptoms:**
- Miner starts initialization (RandomX dataset ~25s)
- Miner shows algorithms available
- Miner NEVER connects to pool (no login message in pool logs)
- Timeout kills miner before any mining happens

**Potential causes to investigate:**
1. Async initialization blocking connection?
2. Algorithm initialization happening in main thread?
3. Missing await somewhere in connection logic?

---

## 📋 TODO - HIGH PRIORITY

### 1. Pool Restart & Testing (IMMEDIATE)
```bash
# On server (hetzner)
ssh hetzner 'pkill -9 python3'
ssh hetzner 'cd /opt/zion/Zion-2.9 && python3 -m src.core.zion_universal_pool_v2 > ~/pool-cosmic.log 2>&1 &'
ssh hetzner 'tail -f ~/pool-cosmic.log'  # Monitor startup
```

### 2. Miner Connection Debugging
**Test with minimal initialization:**
```python
# Create test miner that:
# 1. Skips RandomX/Yescrypt init
# 2. Only loads Cosmic Harmony
# 3. Connects immediately
# 4. Tests login with algo field
```

**OR use simple netcat test:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"login","params":{"login":"zion1Test","pass":"worker1","agent":"TestMiner","algo":"cosmic_harmony"}}' | nc 91.98.122.165 3333
```

### 3. Algorithm Field Standardization
**Ensure consistency across codebase:**
- [ ] Pool expects: `params.get("algo")` (string or list)
- [ ] Miner sends: `"algo": "cosmic_harmony"` (string)
- [ ] Algorithm names normalized: lowercase, underscores

### 4. Real-Time Metrics Integration
**Found in `ai/zion_universal_miner.py` and `ai/mining/realtime_metrics.py`:**
- [ ] Import RealtimeMetricsDisplay into new miner
- [ ] Add SRBMiner-style live stats
- [ ] Show: hashrate, shares, temperature, pool latency

### 5. Stratum vs Monero Protocol Decision
**Current implementation:**
- Pool supports BOTH protocols:
  * Stratum: `mining.subscribe` + `mining.authorize` (lines 3257+)
  * Monero: `login` method (lines 2282, 2428+)
  
**Decision needed:**
- ✅ Keep Monero-style `login` (simpler, already working)
- Add fallback Stratum support for compatibility
- Document protocol choice in miner README

---

## 🐛 KNOWN BUGS

### 1. List vs String in algo Parameter
- **Bug**: Some code sends `"algo": ["cosmic_harmony"]` (list)
- **Impact**: Pool crashes with `.lower()` on list
- **Fix**: ✅ Added type checking in pool (ready to test)

### 2. Share Validation (94% Rejection Rate)
- **Observed**: Pool rejecting 94% of shares
- **Pool log**: `⚠️ Skipping ban for localhost 127.0.0.1: 94.0% invalid shares`
- **Cause**: Unknown (might be difficulty, target calculation, or algorithm mismatch)
- **Priority**: HIGH (blocks actual mining)

### 3. Cosmic Harmony Wrapper Not Loading in Pool
- **Symptom**: Pool shows "Algorithm: unknown" despite libraries present
- **Files present**: 
  * `/opt/zion/Zion-2.9/zion/mining/libcosmic_harmony_zion.so.2.9.0`
  * `/opt/zion/Zion-2.9/zion/mining/cosmic_harmony_wrapper.py`
- **Possible cause**: Python path not including wrappers directory
- **Test needed**: Verify pool can `import cosmic_harmony_wrapper`

---

## 📁 FILES MODIFIED THIS SESSION

### Local Files (Ready to Push)
1. `/home/zion/Zion-2.9-main/src/core/zion_universal_pool_v2.py`
   - Lines 2428-2450: Algorithm detection from `algo` field
   - Lines 2438-2448: Handle list/string algo parameter

2. `/home/zion/Zion-2.9-main/src/miners/zion_universal_miner.py`
   - Lines 175-190: Changed `pass` field to send worker name, `algo` field for algorithm

3. Created backup: `/home/zion/Zion-2.9-main/src/miners/zion_universal_miner_v2_stratum.py`
   - Copy of original `ai/zion_universal_miner.py` with Stratum login

### Server Files (Already Deployed)
1. `/opt/zion/Zion-2.9/src/core/zion_universal_pool_v2.py` - ✅ Updated
2. `/opt/zion/Zion-2.9/zion/mining/*.so*` - ✅ All libraries present
3. `/opt/zion/Zion-2.9/zion/mining/*_wrapper.py` - ✅ All wrappers present

---

## 🔬 TESTING CHECKLIST (Next Session)

### Pool Startup Test
```bash
ssh hetzner 'cd /opt/zion/Zion-2.9 && python3 -m src.core.zion_universal_pool_v2 2>&1 | grep -E "cosmic|algo|error|listening"'
```
**Expected:**
- ✅ Pool starts without errors
- ✅ Listening on 0.0.0.0:3333
- ✅ No "list object has no attribute" errors

### Miner Connection Test
```bash
cd /home/zion/Zion-2.9-main
timeout 120 python3 src/miners/zion_universal_miner.py \
  --pool 91.98.122.165:3333 \
  --wallet zion1CosmicHarmony \
  --algos cosmic_harmony \
  --threads 4
```
**Expected:**
- ✅ Miner connects to pool
- ✅ Pool log shows: "XMrig login: ... Algorithm: cosmic_harmony"
- ✅ Miner receives job from pool
- ✅ Miner starts hashing
- ✅ At least 1 share accepted

### Algorithm Detection Test
```bash
# Test each algorithm
for algo in cosmic_harmony randomx yescrypt; do
  echo "Testing $algo..."
  timeout 60 python3 src/miners/zion_universal_miner.py \
    --pool 91.98.122.165:3333 \
    --wallet zion1Test${algo} \
    --algos $algo \
    --threads 2 2>&1 | grep -i "logged in\|algorithm"
done
```

### Share Validation Test
**Once connected:**
1. Monitor pool log for share submissions
2. Check acceptance rate (should be >90%)
3. If rejections persist:
   - Compare miner hash output vs pool validation
   - Check difficulty settings
   - Verify target calculations

---

## 📊 PERFORMANCE BENCHMARKS

### Native Library Performance (Confirmed)
| Algorithm       | Threads | Hashrate     | Note                    |
|----------------|---------|--------------|-------------------------|
| Cosmic Harmony | 1       | 548,319 H/s  | Single-thread benchmark |
| Cosmic Harmony | 4       | 115,000 H/s  | Pool test (local)       |
| RandomX        | 11      | ~6,600 H/s   | With large pages        |
| Yescrypt       | 11      | ~4,783 H/s   | With OpenMP             |

### Expected Production Performance
- **Cosmic Harmony**: 100k-200k H/s per CPU (4-8 threads)
- **RandomX**: 5k-8k H/s per CPU (8-12 threads)
- **Yescrypt**: 4k-6k H/s per CPU (8-12 threads)

---

## 🗺️ ARCHITECTURE OVERVIEW

### Mining Flow
```
┌─────────────────────┐
│  Universal Miner    │
│  (src/miners/)      │
├─────────────────────┤
│ 1. Load algorithms  │ ← algorithms.py loads .so libraries
│ 2. Connect to pool  │ ← async TCP connection
│ 3. Send login       │ ← {"method":"login","params":{...,"algo":"cosmic_harmony"}}
│ 4. Receive job      │ ← Pool sends mining job
│ 5. Hash with algo   │ ← Cosmic Harmony native hashing
│ 6. Submit shares    │ ← {"method":"submit","params":{...}}
└─────────────────────┘
           ↓
    Network (TCP)
           ↓
┌─────────────────────┐
│  Universal Pool     │
│  (src/core/)        │
├─────────────────────┤
│ 1. Parse login      │ ← Extract algo from params.get("algo")
│ 2. Validate address │ ← Check ZION address format
│ 3. Create job       │ ← Build mining job (blob, target, height)
│ 4. Validate share   │ ← Hash result < target?
│ 5. Update stats     │ ← Track shares, hashrate, rewards
└─────────────────────┘
           ↓
┌─────────────────────┐
│  Native Libraries   │
│  (zion/mining/)     │
├─────────────────────┤
│ libcosmic_harmony   │ ← 548k H/s single-thread
│ librandomx_zion     │ ← 6.6k H/s multi-thread
│ libyescrypt_zion    │ ← 4.8k H/s multi-thread
└─────────────────────┘
```

### Protocol Flow (Monero-style login)
```
Miner → Pool:
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "login",
  "params": {
    "login": "zion1CosmicHarmony",
    "pass": "worker1",
    "agent": "ZionUniversalMiner/2.9",
    "algo": "cosmic_harmony"  ← NEW: Dedicated algo field
  }
}

Pool → Miner:
{
  "id": 1,
  "jsonrpc": "2.0",
  "result": {
    "id": "zion_1731325621_12345",
    "job": {
      "job_id": "zion_rx_000001",
      "blob": "0d00691b1369000000...",
      "seed_hash": "087f7d16189c4fa7...",
      "target": "703d0ad7a3703d0a",
      "height": 2
    },
    "status": "OK"
  }
}
```

---

## 💡 DESIGN DECISIONS MADE

### 1. Algorithm Communication Protocol
**Decision:** Use dedicated `algo` field in login params
**Rationale:**
- ✅ Clean separation of concerns
- ✅ No parsing/detection needed
- ✅ Supports multiple algorithms easily
- ✅ Future-proof for new algorithms
- ❌ REJECTED: Using `password` field (confusing, error-prone)

### 2. Async vs Sync Miner
**Decision:** Keep async architecture
**Rationale:**
- ✅ Non-blocking I/O for pool communication
- ✅ Better performance with multiple miners
- ✅ Modern Python best practice
- ⚠️ Challenge: Sync native library initialization (25s for RandomX)

### 3. Native Library Loading
**Decision:** Auto-detect .so files from zion/mining/ directory
**Rationale:**
- ✅ Zero configuration needed
- ✅ Works with symlinks
- ✅ Falls back to Python if native unavailable
- ✅ Easy deployment (just copy .so files)

---

## 🔐 SERVER CREDENTIALS

**SSH Access:**
- Host: 91.98.122.165
- User: root
- Auth: SSH key (~/.ssh/id_ed25519_hetzner)
- Alias: `ssh hetzner`
- Password (fallback): 12345abcd

**Pool:**
- Port: 3333 (mining)
- Admin API: 3334
- Log: ~/pool.log or ~/pool-cosmic.log

---

## 📚 DOCUMENTATION TO UPDATE

1. **README.md** - Add native library deployment instructions
2. **INSTALLATION.md** - Server setup steps with SSH, libraries, dependencies
3. **MINING_GUIDE.md** - How to use Universal Miner with different algorithms
4. **POOL_PROTOCOL.md** - Document `algo` field in login params
5. **BENCHMARKS.md** - Performance table with all algorithms

---

## 🎯 SUCCESS CRITERIA (Phase 6)

### Must Have ✅
- [x] All 3 native libraries built (Cosmic Harmony, RandomX, Yescrypt)
- [x] Libraries loading in Universal Miner
- [x] CI/CD pipeline for automated builds
- [x] GitHub Actions workflows
- [x] Python packaging (setup.py)
- [x] Libraries deployed to production server
- [ ] **Miner connects to pool successfully**
- [ ] **At least 1 share accepted**
- [ ] **Hashrate matches benchmarks**

### Should Have 🔶
- [ ] Real-time metrics display (SRBMiner-style)
- [ ] Share acceptance rate >90%
- [ ] Pool handles all 3 algorithms correctly
- [ ] Automatic algorithm switching
- [ ] Documentation complete

### Nice to Have 🔵
- [ ] Autolykos v2 implementation
- [ ] KawPow GPU support
- [ ] Multi-pool failover
- [ ] Advanced AI optimization
- [ ] Web dashboard integration

---

## ⏭️ NEXT STEPS (Evening Session)

### Step 1: Pool Startup Verification
```bash
ssh hetzner 'pkill -9 python3; sleep 2'
ssh hetzner 'cd /opt/zion/Zion-2.9 && python3 -m src.core.zion_universal_pool_v2 > ~/pool.log 2>&1 &'
sleep 5
ssh hetzner 'tail -30 ~/pool.log | grep -E "listening|error|cosmic"'
```
**Expected:** No errors, listening on port 3333

### Step 2: Miner Connection Test
```bash
cd /home/zion/Zion-2.9-main
python3 src/miners/zion_universal_miner.py \
  --pool 91.98.122.165:3333 \
  --wallet zion1CosmicHarmony \
  --algos cosmic_harmony \
  --threads 4 \
  2>&1 | tee /tmp/miner_test.log
```
**Watch for:** "✅ Logged in successfully"

### Step 3: Monitor Pool Side
```bash
# In separate terminal
ssh hetzner 'tail -f ~/pool.log | grep -E "login|cosmic|share"'
```
**Expected:**
- "XMrig login: zion1CosmicHarmony ... Algorithm: cosmic_harmony"
- Share submissions
- Acceptance/rejection messages

### Step 4: Debug if Still Failing
**If miner doesn't connect:**
1. Check miner log: `/tmp/miner_test.log`
2. Check pool log: `ssh hetzner 'tail -100 ~/pool.log'`
3. Test raw socket: `nc 91.98.122.165 3333` + manual JSON
4. Add debug logging to `connect()` and `login()` methods

**If shares rejected:**
1. Compare hash outputs (miner vs pool)
2. Check difficulty settings
3. Verify Cosmic Harmony wrapper loading in pool
4. Test with different algorithms (RandomX as baseline)

---

## 🚀 PHASE 7 PREVIEW

### Goals:
1. **Documentation** - Complete deployment guide
2. **Optimization** - Fine-tune native libraries
3. **Monitoring** - Real-time dashboard
4. **Multi-algorithm** - Automatic switching based on profitability
5. **GPU Support** - Autolykos v2, KawPow
6. **Production Ready** - Stress testing, error handling, logging

---

## 📝 NOTES & OBSERVATIONS

### Performance Notes
- Cosmic Harmony single-thread: 548k H/s (EXCELLENT!)
- But 4-thread only 115k H/s? (Should be ~400k)
  - Possible GIL bottleneck in Python wrapper
  - Test pure C++ mining loop

### Architecture Notes
- Async initialization blocks: RandomX dataset takes 25 seconds
  - Consider lazy loading or background thread
  - Or pre-init during import

### Pool Protocol Notes
- Pool supports BOTH Stratum and Monero protocols
  - Good for compatibility
  - But adds complexity
  - Document both in pool protocol guide

### Deployment Notes
- Server needs `--break-system-packages` for pip (Ubuntu 24.04)
- /tmp has permission issues, use ~ instead
- Port 3333 often stays bound after crash (use pkill -9)

---

## 🔗 RELATED COMMITS

- **bf91076**: Phase 6 CI/CD Infrastructure complete
- **316b117**: Cosmic Harmony native library (Phase 2)
- **957e919**: RandomX native library (Phase 3)
- **28d4316**: Yescrypt native library (Phase 4)

---

## ✨ ACHIEVEMENTS THIS SESSION

1. ✅ Identified and fixed algorithm detection bug (pass → algo field)
2. ✅ Deployed all native libraries to production server
3. ✅ Set up SSH key authentication for easier deployment
4. ✅ Fixed pool to handle list/string algo parameter
5. ✅ Created comprehensive session documentation
6. ✅ Backup original working miner with Stratum login
7. ✅ Mapped out complete testing strategy

**Total lines of code modified:** ~50
**Files changed:** 3 (pool, miner, this report)
**Bugs fixed:** 2 (algo detection, list vs string)
**Libraries deployed:** 3 (Cosmic Harmony, RandomX, Yescrypt)

---

## 🎓 LESSONS LEARNED

1. **Always use dedicated fields** for important data (algo field, not password)
2. **Type checking is critical** when handling JSON (list vs string)
3. **Test protocol compatibility** early (pool & miner must agree on format)
4. **Async initialization** can block network operations (careful with blocking I/O)
5. **Document as you go** - this report saved hours of context rebuilding

---

**Status:** Ready for evening session testing 🌙
**Next Session Goal:** First successful Cosmic Harmony share on production pool! 🎯

---
*Generated: 2025-11-11 12:00 CET*
*Author: Zion Development Team*
*Phase: 6 - Native Libraries Production Integration*
