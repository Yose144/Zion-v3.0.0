# Kaspa kHeavyHash Implementation Report

**Date:** 2026-01-20  
**Status:** 🔄 In Progress - Pool Share Submission Issue  
**Version:** v2.9.5

---

## 📋 Executive Summary

Implementace kHeavyHash algoritmu pro Kaspa mining v ZION mineru. Algoritmus byl ověřen proti test vektorům z `rusty-kaspa`, ale pool stále odmítá share jako "Low difficulty share".

---

## ✅ Completed Tasks

### 1. kHeavyHash Algorithm Implementation
**File:** [scripts/kheavyhash_v2.py](../scripts/kheavyhash_v2.py)

Algoritmus se skládá ze 3 částí:

```
┌─────────────────────────────────────────────────────────────────┐
│                      kHeavyHash Pipeline                        │
├─────────────────────────────────────────────────────────────────┤
│  Input: pre_pow_hash (32B) + timestamp (8B) + nonce (8B)        │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  1. PowHash (cSHAKE256 "ProofOfWorkHash")            │      │
│  │     - pre_pow_hash → state[0..3]                     │      │
│  │     - timestamp → state[4]                           │      │
│  │     - nonce → state[9]                               │      │
│  │     - Keccak-f1600 → 32B hash                        │      │
│  └──────────────────────────────────────────────────────┘      │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  2. Matrix Generation (XoShiRo256++ PRNG)            │      │
│  │     - Seed: pre_pow_hash (NOT pow_hash!)             │      │
│  │     - Output: 64x64 matrix, 4-bit cells              │      │
│  │     - Require rank = 64                              │      │
│  └──────────────────────────────────────────────────────┘      │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  3. Heavy Hash                                       │      │
│  │     - Split hash → 64 nibbles                        │      │
│  │     - Matrix × vector multiplication                 │      │
│  │     - Reduce: ((sum >> 10) << 4) | (sum2 >> 10)     │      │
│  │     - XOR with original hash                         │      │
│  │     - cSHAKE256 "HeavyHash" finalization            │      │
│  └──────────────────────────────────────────────────────┘      │
│                              │                                  │
│                              ▼                                  │
│  Output: 32-byte final hash (compare BE with target)           │
└─────────────────────────────────────────────────────────────────┘
```

**Verified Components:**
- ✅ Keccak-f1600 permutation
- ✅ PowHash precomputed state (cSHAKE256 "ProofOfWorkHash")
- ✅ KHeavyHash precomputed state (cSHAKE256 "HeavyHash")
- ✅ XoShiRo256++ PRNG for matrix generation
- ✅ Matrix-vector multiplication with reduction
- ✅ Test vectors from rusty-kaspa pass

### 2. Kaspa Address Generation
**File:** [scripts/kaspa_test_wallet.txt](../scripts/kaspa_test_wallet.txt)

Kaspa používá vlastní BCH-style bech32 s 8-znakovým checksumem:

```python
# Polymod constants (from rusty-kaspa)
KASPA_POLYMOD = [0x98f2bc8e61, 0x79b76d99e2, 0xf33e5fb3c4, 0xae2eabe2a8, 0x1e4f43e470]

# Address format:
# - HRP: "kaspa:"
# - Version: 0x00 = Schnorr PubKey (32 bytes)
# - Payload: 32-byte x-only public key
# - Checksum: 8 characters (40-bit)

# Example generated address (67 chars total):
kaspa:qrseqfta434e6xyp5ct04xc58780kyupfz3m8m9d04dlhxljmg3zgttal3q4m
```

**Address Versions:**
| Version | Type | Payload Size |
|---------|------|--------------|
| 0x00 | Schnorr PubKey | 32 bytes |
| 0x01 | ECDSA PubKeyECDSA | 33 bytes |
| 0x08 | ScriptHash | 32 bytes |

### 3. Stratum Protocol Integration
**Pool:** `kas.2miners.com:2020`

```json
// Subscribe response
{"id":1,"result":["mining.notify","extranonce","extranonce_size"]}

// Set extranonce
{"method":"set_extranonce","params":["9fa2",6]}

// Mining notify (job)
{"method":"mining.notify","params":["job_id",[u64_0,u64_1,u64_2,u64_3],timestamp]}

// Submit share
{"method":"mining.submit","params":["wallet.worker","job_id","nonce_hex_16"]}
```

**Extranonce Format:**
```
Total nonce: 8 bytes (64 bits)
┌────────────────────────────────────────────────────────────────┐
│  Extranonce (2B)  │         Miner Nonce (6B)                   │
│     0x9fa2        │         0x000000000000                     │
└────────────────────────────────────────────────────────────────┘

nonce_fixed = int(extranonce, 16) << (nonce_size * 8)
           = 0x9fa2 << 48
           = 0x9fa2000000000000

nonce_mask = (1 << 48) - 1 = 0x0000ffffffffffff

full_nonce = nonce_fixed | (local_nonce & nonce_mask)
```

---

## ❌ Current Issue: "Low Difficulty Share"

### Symptom
Pool returns error 23 "Low difficulty share" even though:
- Local hash passes difficulty check (BE comparison)
- Algorithm matches test vectors
- Address is accepted by pool

### Debug Data
```
Pre-pow hash: f01da7ed3b72844d2d102815181158a24c1c08a981bd427299d23c03ab2d67c4
Timestamp: 1768906619887
Extranonce: 9fa2 (size: 6)
Difficulty: 512

Target (diff=512): 007fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff

Found nonce: 0x9fa2000000000226
Our hash (BE): 0015236fa1cd09469fd4865c87fefe890307fdbd547ce061821271c129c76853

Local check: hash_BE < target ✅
Pool result: {"error":[23,"Low difficulty share",null]} ❌
```

### Possible Causes Being Investigated

1. **Pre-pow hash interpretation**
   - Pool sends 4× u64 as LE
   - We reconstruct: `b''.join(struct.pack('<Q', u) for u in u64s)`
   - Need to verify byte order matches pool expectation

2. **Timestamp handling**
   - Pool sends timestamp as integer
   - Could be DAA score vs milliseconds issue

3. **Hash comparison direction**
   - Kaspa uses Big Endian for comparison
   - Pool might use different comparison

4. **Nonce format in submission**
   - We submit: `f'{nonce:016x}'` (16 hex chars)
   - Pool might expect different format

---

## 🔍 Investigation Plan

### Phase 1: Verify Pre-pow Hash (Priority: HIGH)
```python
# Current interpretation
pre_pow_hash = b''.join(struct.pack('<Q', u) for u in u64s)

# Alternative: try BE
pre_pow_hash_be = b''.join(struct.pack('>Q', u) for u in u64s)
```

### Phase 2: Compare with Reference Miner
1. Capture working miner traffic (bzminer/lolminer)
2. Compare pre_pow_hash reconstruction
3. Compare hash output for same job

### Phase 3: Hash Comparison Method
```python
# Current (BE)
hash_be = int.from_bytes(hash_result, 'big')
passes = hash_be < target

# Alternative: LE
hash_le = int.from_bytes(hash_result, 'little')
passes = hash_le < target
```

### Phase 4: Pool-specific Validation
- Test against different pools (woolypooly, herominers)
- Check if issue is 2miners-specific

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| [scripts/kheavyhash_v2.py](../scripts/kheavyhash_v2.py) | Core kHeavyHash implementation |
| [scripts/debug_kaspa_nonce.py](../scripts/debug_kaspa_nonce.py) | E2E pool test with debugging |
| [scripts/test_kaspa_e2e.py](../scripts/test_kaspa_e2e.py) | Full integration test |
| [scripts/kaspa_test_wallet.txt](../scripts/kaspa_test_wallet.txt) | Generated test wallet |

---

## 📊 Algorithm Library Status

| Coin | Algorithm | Library | Status |
|------|-----------|---------|--------|
| ETC/ETHW | Ethash | `ethash` | ✅ Working |
| RVN/XNA | KawPow | `kawpow` | ✅ Working |
| KAS | kHeavyHash | `kheavyhash_v2.py` | ⚠️ Hash OK, Pool Rejects |

---

## 🔗 References

### Source Code
- [rusty-kaspa/crypto/hashes](https://github.com/kaspanet/rusty-kaspa/tree/master/crypto/hashes)
- [kaspa-miner heavy_hash.rs](https://github.com/tmrlvi/kaspa-miner/blob/main/src/pow/heavy_hash.rs)
- [kaspa-stratum-bridge](https://github.com/onemorebsmith/kaspa-stratum-bridge)

### Documentation
- [Kaspa PoW Specification](https://kaspa.org/docs)
- [kHeavyHash Algorithm Paper](https://github.com/aspect-build/bazel-lib)

---

## 📅 Next Steps

1. **[ ] Debug pre_pow_hash byte order**
2. **[ ] Capture reference miner traffic**
3. **[ ] Test alternative hash comparison**
4. **[ ] Implement GPU acceleration (after CPU works)**

---

## 📝 Session Notes

### 2026-01-20
- Verified kHeavyHash against rusty-kaspa test vectors ✅
- Fixed Kaspa address format (67 chars, 8-char checksum) ✅
- Pool authorization working ✅
- Share submission still failing with "Low difficulty share" ❌
- Investigated extranonce format from kaspa-miner source

---

*Last updated: 2026-01-20*
