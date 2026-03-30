# ZION 2.8.5 - Debug Plan: Share Validation Issue

**Issue:** XMRig shows 96% invalid share rate  
**Target:** < 5% invalid shares  
**Status:** IN PROGRESS  
**Priority:** CRITICAL

---

## 🔍 PROBLEM STATEMENT

### Symptoms
```
XMRig Output (60 seconds):
- Total shares: 193
- Accepted: 6 (3.1%)
- Rejected: 187 (96.9%)
- Error message: "Invalid share"
```

### Expected Behavior
- Accept rate: > 95%
- Reject rate: < 5%
- Valid RandomX shares accepted immediately

### Current Configuration
```json
{
  "algo": "rx/0",
  "url": "localhost:3333",
  "user": "ZION_1B64E09D45C3047D8BB9E257C3324348704CAE7A",
  "difficulty": 25
}
```

---

## 🎯 DEBUG PHASES

### Phase 1: Enable Detailed Logging ⏳

**File:** `src/core/zion_universal_pool_v2.py`

**Location 1:** `handle_submit()` method (~line 2100)

```python
# ADD BEFORE VALIDATION:
logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
logger.info(f"📥 SHARE SUBMIT DEBUG")
logger.info(f"   Miner: {session.get('login', 'unknown')}")
logger.info(f"   Job ID: {job_id}")
logger.info(f"   Nonce: {nonce}")
logger.info(f"   Result: {result[:32]}...")
logger.info(f"   Algorithm: {session.get('algorithm', 'unknown')}")

if job_id in self.jobs:
    job = self.jobs[job_id]
    logger.info(f"🔍 JOB DATA:")
    logger.info(f"   Blob: {job.get('blob', '')[:64]}...")
    logger.info(f"   Seed Hash: {job.get('seed_hash', '')[:32]}...")
    logger.info(f"   Target: {job.get('target', '')}")
    logger.info(f"   Difficulty: {job.get('difficulty', 0)}")
    logger.info(f"   Height: {job.get('height', 0)}")
else:
    logger.warning(f"⚠️  Job {job_id} not found in active jobs!")
logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
```

**Location 2:** RandomX validation (~line 1400)

```python
# ADD IN validate_randomx_share():
logger.info(f"🔬 RANDOMX VALIDATION:")
logger.info(f"   Blob (hex): {blob[:64]}...")
logger.info(f"   Blob length: {len(blob)} chars")
logger.info(f"   Seed hash: {seed_hash[:32]}...")
logger.info(f"   Miner result: {result[:32]}...")

# After hash calculation:
logger.info(f"   Calculated hash: {calculated_hash[:32]}...")
logger.info(f"   Match: {calculated_hash == result}")
logger.info(f"   Meets difficulty: {meets_difficulty}")
```

**Expected Output:**
```
📥 SHARE SUBMIT DEBUG
   Miner: ZION_1B64E09D45C3047D8BB9E257C3324348704CAE7A
   Job ID: zion_rx_000001
   Nonce: a1b2c3d4
   Result: e5f6a7b8c9d0e1f2...
   Algorithm: randomx

🔍 JOB DATA:
   Blob: 0d001e89076900000000...
   Seed Hash: 3bde62f545bae4f4...
   Target: 703d0ad7a3703d0a
   Difficulty: 25
   Height: 3

🔬 RANDOMX VALIDATION:
   Blob (hex): 0d001e89076900000000...
   Blob length: 152 chars
   Seed hash: 3bde62f545bae4f4...
   Miner result: e5f6a7b8c9d0e1f2...
   Calculated hash: a1a1a1a1a1a1a1a1...  ← COMPARE THIS
   Match: False  ← THIS IS THE PROBLEM
   Meets difficulty: True
```

---

### Phase 2: Blob Format Analysis ⏳

**Objective:** Verify blob structure matches Monero format

**Monero Blob Format:**
```
Offset  Size  Description
------  ----  -----------
0       1     Major version
1       1     Minor version
2-5     4     Timestamp
6-37    32    Previous block hash
38-69   32    Merkle root
70-73   4     Nonce (reserved area)
74+     var   Extra nonce
```

**ZION Current Implementation:**
```python
# In _create_job() or _generate_mining_blob()
def _generate_mining_blob(self, ...):
    # CHECK THIS:
    blob = struct.pack('<B', 0x0d)  # Major version
    blob += struct.pack('<B', 0x0d)  # Minor version
    blob += struct.pack('<I', timestamp)
    blob += bytes.fromhex(prev_hash)
    # ... rest of blob construction
```

**Debug Code:**
```python
# ADD to _create_job():
logger.info(f"🔧 BLOB CONSTRUCTION:")
logger.info(f"   Major version: 0x{blob[0]:02x}")
logger.info(f"   Minor version: 0x{blob[1]:02x}")
logger.info(f"   Timestamp: {struct.unpack('<I', blob[2:6])[0]}")
logger.info(f"   Prev hash: {blob[6:38].hex()}")
logger.info(f"   Nonce offset: {reserved_offset}")
logger.info(f"   Total blob length: {len(blob)} bytes")
logger.info(f"   Full blob: {blob.hex()}")
```

**Action Items:**
- [ ] Compare with Monero test vector
- [ ] Verify nonce position (should be at offset 39)
- [ ] Check extra nonce size (typically 4 bytes)
- [ ] Validate merkle root calculation

---

### Phase 3: Seed Hash Verification ⏳

**Objective:** Ensure RandomX seed matches blockchain state

**Current Implementation:**
```python
# In get_block_template():
seed_hash = prev_hash  # Previous block hash
```

**Monero Implementation:**
```python
# Seed = block hash at (height - SEED_HASH_EPOCH_BLOCKS)
# SEED_HASH_EPOCH_BLOCKS = 2048 for Monero
# For ZION (simplified): seed = previous block hash
```

**Debug Code:**
```python
# ADD to get_block_template():
logger.info(f"🌱 SEED HASH CALCULATION:")
logger.info(f"   Current height: {height}")
logger.info(f"   Previous height: {seed_height}")
logger.info(f"   Previous block hash: {prev_hash}")
logger.info(f"   Seed hash: {seed_hash}")
logger.info(f"   Match: {seed_hash == prev_hash}")

# Verify blockchain state:
if previous_block:
    logger.info(f"   Prev block exists: True")
    logger.info(f"   Prev block height: {previous_block.get('height')}")
else:
    logger.warning(f"   Prev block exists: False (genesis?)")
```

**Action Items:**
- [ ] Verify seed_hash matches what XMRig receives
- [ ] Check if RandomX cache is initialized correctly
- [ ] Test with fixed seed_hash (known good value)

---

### Phase 4: Target/Difficulty Conversion ⏳

**Objective:** Verify target calculation from difficulty

**Monero Formula:**
```python
# difficulty → target (compact form)
def difficulty_to_target(difficulty):
    max_target = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF
    target = max_target // difficulty
    return target.to_bytes(32, 'little')
```

**Current ZION Implementation:**
```python
# CHECK in _create_job():
target = self._difficulty_to_target(difficulty)
```

**Debug Code:**
```python
# ADD to _difficulty_to_target():
logger.info(f"🎯 TARGET CALCULATION:")
logger.info(f"   Difficulty: {difficulty}")
logger.info(f"   Target (hex): {target.hex()}")
logger.info(f"   Target (compact): {self._target_to_compact(target)}")

# Verify reverse calculation:
back_to_diff = self._target_to_difficulty(target)
logger.info(f"   Reverse diff: {back_to_diff}")
logger.info(f"   Match: {back_to_diff == difficulty}")
```

**Action Items:**
- [ ] Compare target format with Monero
- [ ] Verify byte order (little-endian)
- [ ] Test with difficulty=1 (easiest)

---

### Phase 5: RandomX Library Test ⏳

**Objective:** Verify RandomX implementation works correctly

**Test Script:** `test_randomx_validation.py`

```python
#!/usr/bin/env python3
"""Test RandomX validation with known vectors"""

import pyrandomx
import struct

# Monero test vector (from RandomX test suite)
TEST_SEED = bytes.fromhex("00" * 32)  # Genesis seed
TEST_BLOB = bytes.fromhex("0d0d" + "00" * 74)  # Minimal blob
TEST_NONCE = 0

# Calculate expected hash
blob_with_nonce = bytearray(TEST_BLOB)
struct.pack_into('<I', blob_with_nonce, 39, TEST_NONCE)

rx_hash = pyrandomx.get_rx_hash(TEST_SEED, bytes(blob_with_nonce))

print(f"Test Vector:")
print(f"  Seed: {TEST_SEED.hex()}")
print(f"  Blob: {blob_with_nonce.hex()}")
print(f"  Hash: {rx_hash.hex()}")
print(f"  Expected: (lookup Monero test vector)")

# Test with ZION values
print(f"\nZION Current Values:")
print(f"  Seed: {ZION_SEED_HASH}")
print(f"  Blob: {ZION_BLOB}")
# ... test
```

**Action Items:**
- [ ] Run Monero test vectors
- [ ] Compare with known-good RandomX implementation
- [ ] Test pyrandomx vs randomx-python libraries

---

### Phase 6: Database Inspection ⏳

**Objective:** Verify shares are being stored correctly

**SQL Queries:**

```sql
-- Check all shares for our address
SELECT 
    id,
    address,
    algorithm,
    job_id,
    nonce,
    difficulty,
    is_valid,
    timestamp,
    datetime(timestamp, 'unixepoch') as time
FROM shares
WHERE address = 'ZION_1B64E09D45C3047D8BB9E257C3324348704CAE7A'
ORDER BY timestamp DESC
LIMIT 20;

-- Count valid vs invalid
SELECT 
    is_valid,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM shares
WHERE address = 'ZION_1B64E09D45C3047D8BB9E257C3324348704CAE7A'
GROUP BY is_valid;

-- Check if any shares match expected pattern
SELECT 
    id,
    result,
    LEFT(result, 16) as result_prefix
FROM shares
WHERE address = 'ZION_1B64E09D45C3047D8BB9E257C3324348704CAE7A'
  AND is_valid = 1
LIMIT 5;
```

**Action Items:**
- [ ] Verify shares are being written to DB
- [ ] Check if valid shares have consistent patterns
- [ ] Compare valid vs invalid share data

---

### Phase 7: XMRig Comparison Test ⏳

**Objective:** Test against known-working pool

**Setup:**
1. Install xmrig-proxy (Monero pool proxy)
2. Connect XMRig to Monero test pool
3. Capture successful job/share exchange
4. Compare with ZION pool traffic

**Wireshark Capture:**
```bash
# Capture pool traffic
sudo tcpdump -i lo -w /tmp/pool-traffic.pcap port 3333

# Analyze in Wireshark:
# - Filter: tcp.port == 3333
# - Look for JSON messages
# - Compare job format
# - Compare submit format
```

**Action Items:**
- [ ] Capture Monero pool traffic
- [ ] Capture ZION pool traffic
- [ ] Compare JSON structures
- [ ] Identify differences

---

## 🔧 QUICK FIXES TO TRY

### Fix 1: Simplify Validation (Test Only)
```python
# Temporarily accept all shares to test flow
def validate_randomx_share(self, ...):
    logger.warning("🚨 ACCEPTING ALL SHARES (DEBUG MODE)")
    return True  # Accept everything
```

**Expected:** 100% accept rate  
**Purpose:** Verify share storage and reward calculation  
**Revert:** After testing

### Fix 2: Lower Difficulty
```python
# In pool config:
self.difficulty['randomx'] = 1  # Minimum difficulty

# In _create_job():
difficulty = 1
target = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
```

**Expected:** More shares meet target  
**Purpose:** Test if difficulty calculation is wrong

### Fix 3: Use Static Seed
```python
# In get_block_template():
seed_hash = "00" * 32  # Genesis seed (fixed)
```

**Expected:** Consistent RandomX cache  
**Purpose:** Eliminate seed hash issues

---

## 📊 SUCCESS CRITERIA

### Phase 1 Complete When:
- [ ] Detailed logs show exact validation failure point
- [ ] Can see calculated hash vs miner result
- [ ] Identified which check fails (hash match or difficulty)

### Phase 2 Complete When:
- [ ] Blob format matches Monero specification
- [ ] Nonce offset verified correct (39 bytes)
- [ ] Blob length matches expected size

### Phase 3 Complete When:
- [ ] Seed hash verified matches blockchain state
- [ ] RandomX cache initialization confirmed
- [ ] XMRig receives correct seed in job

### Phase 4 Complete When:
- [ ] Target calculation verified correct
- [ ] Difficulty conversion bidirectional test passes
- [ ] Target format matches Monero (little-endian)

### Phase 5 Complete When:
- [ ] RandomX library test passes with known vectors
- [ ] Hash calculation matches expected output
- [ ] Library compatibility confirmed

### Phase 6 Complete When:
- [ ] Database shows shares being stored
- [ ] Valid shares have identifiable pattern
- [ ] Can query miner statistics

### Phase 7 Complete When:
- [ ] Traffic capture shows protocol differences
- [ ] ZION pool matches Monero pool format
- [ ] All JSON fields align

### OVERALL SUCCESS:
- [ ] Accept rate > 95%
- [ ] 100 shares submitted successfully
- [ ] Block found and mined
- [ ] Rewards distributed to miner
- [ ] Database updated correctly

---

## 🚀 EXECUTION PLAN

### Today (2025-11-02)
1. ✅ Enable Phase 1 logging
2. ⏳ Run XMRig for 5 minutes
3. ⏳ Analyze logs for patterns
4. ⏳ Implement Phase 2 blob analysis
5. ⏳ Identify root cause
6. ⏳ Implement fix
7. ⏳ Test with XMRig (target: >95% accept)

### Tomorrow (2025-11-03)
1. Verify 24h stability
2. Test with multiple miners
3. Confirm reward distribution
4. Deploy to production

---

## 📝 NOTES

### Hypothesis Priority
1. **HIGH:** Blob format mismatch (nonce offset wrong)
2. **HIGH:** RandomX hash calculation error
3. **MEDIUM:** Seed hash incorrect
4. **MEDIUM:** Target/difficulty conversion
5. **LOW:** Network/timing issues

### Reference Implementations
- Monero Pool: https://github.com/jtgrassie/monero-pool
- XMRig Proxy: https://github.com/xmrig/xmrig-proxy
- RandomX: https://github.com/tevador/RandomX

### Test Addresses
- **Main Test:** `ZION_1B64E09D45C3047D8BB9E257C3324348704CAE7A`
- **Wallet File:** `/tmp/zion_mining_wallet.txt`
- **Pool DB:** `zion_pool.db` (current dir when running locally)

---

**Created:** 2025-11-02 18:15  
**Last Updated:** 2025-11-02 18:15  
**Status:** Phase 1 Ready to Execute
