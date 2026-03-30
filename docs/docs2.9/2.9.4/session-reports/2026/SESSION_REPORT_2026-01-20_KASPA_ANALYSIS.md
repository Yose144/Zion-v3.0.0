# Session Report: Kaspa kHeavyHash Deep Analysis
**Date:** 2026-01-20
**Focus:** KAS Mining Algorithm Implementation

## 🔍 Problem Identified

Our pure Python `kheavyhash_pure.py` produces **incorrect hashes** that are being rejected by the pool as "Low difficulty share".

### Root Cause

The rusty-kaspa implementation uses a **custom optimized Keccak sponge** for the initial PoW hash, NOT a standard cSHAKE256:

```rust
// From rusty-kaspa/crypto/hashes/src/pow_hashers.rs
impl PowHash {
    const INITIAL_STATE: [u64; 25] = [ /* precomputed cSHAKE256("ProofOfWorkHash") state */ ];
    
    pub fn new(pre_pow_hash: Hash, timestamp: u64) -> Self {
        let mut start = Self::INITIAL_STATE;
        // XOR pre_pow_hash into state[0..4]
        for (pre_pow_word, state_word) in pre_pow_hash.iter_le_u64().zip(start.iter_mut()) {
            *state_word ^= pre_pow_word;
        }
        // XOR timestamp into state[4]
        start[4] ^= timestamp;
        Self(start)
    }

    pub fn finalize_with_nonce(mut self, nonce: u64) -> Hash {
        self.0[9] ^= nonce;
        keccak256::f1600(&mut self.0);  // <- RAW Keccak permutation!
        Hash::from_le_u64(self.0[..4].try_into().unwrap())
    }
}
```

**Key Differences:**
1. Uses precomputed initial state (from `cSHAKE256("ProofOfWorkHash")`)
2. XORs input directly into state words
3. Applies raw `keccak-f1600` permutation (not full cSHAKE)
4. Takes first 4×u64 as output (little-endian)

Our implementation does:
```python
# WRONG - This is NOT how rusty-kaspa computes it!
data = pre_pow_hash + timestamp_bytes + padding + nonce_bytes
hasher = cSHAKE256.new(custom=b"ProofOfWorkHash")
hasher.update(data)
return hasher.read(32)
```

## 📊 Test Results

```
Pool: kas.2miners.com:2020
Difficulty: 512
Shares found: 97
Shares accepted: 0
Shares rejected: 97
Rejection reason: "Low difficulty share"
```

All shares pass our local difficulty check but fail pool verification because the hash is computed incorrectly.

## 🛠️ Solution Required

### Option 1: Pure Python Keccak-f1600 Implementation
- Implement raw Keccak-f1600 permutation
- Use precomputed initial state from rusty-kaspa
- Match exact byte ordering

### Option 2: Rust/Python Binding
- Create Python binding for rusty-kaspa PoW functions
- Use `pyo3` or `cffi` to expose:
  - `PowHash::new()`
  - `PowHash::finalize_with_nonce()`
  - `Matrix::heavy_hash()`

### Option 3: External C Library
- Use `tiny_keccak` or similar C implementation
- Wrap with `ctypes` or `cffi`

## 📋 Precomputed Constants from rusty-kaspa

### PowHash Initial State (`cSHAKE256("ProofOfWorkHash")`)
```rust
const INITIAL_STATE: [u64; 25] = [
    1123092876221303306, 4963925045340115282, 17037383077651887893, 
    16629644495023626889, 12833675776649114147, 3784524041015224902, 
    1082795874807940378, 13952716920571277634, 13411128033953605860, 
    15060696040649351053, 9928834659948351306, 5237849264682708699, 
    12825353012139217522, 6706187291358897596, 196324915476054915,
    // ... (25 total)
];
```

### KHeavyHash Initial State (`cSHAKE256("HeavyHash")`)
```rust
const INITIAL_STATE: [u64; 25] = [
    4239941492252378377, 8746723911537738262, 8796936657246353646, 
    1272090201925444760, 16654558671554924250, 8270816933120786537,
    // ... (25 total)
];
```

## 🔮 Next Steps

1. **Implement correct Keccak-f1600** in Python using the precomputed initial states
2. **Verify against test vectors** from rusty-kaspa
3. **Re-test with pool** once hash matches

## 📁 Files Modified This Session

- `scripts/e2e_external_pool_mining.py` - KAS protocol fixes (extranonce, nonce format)
- `scripts/kheavyhash_pure.py` - Needs rewrite with correct algorithm

## ✅ Completed This Session

1. ✅ Kaspa stratum protocol analysis
2. ✅ Extranonce handling (2 bytes prefix)
3. ✅ Job format parsing (4×uint64 header)
4. ✅ Difficulty → target conversion
5. ✅ Share submission format (extranonce2 only)
6. ⚠️ kHeavyHash algorithm - **NEEDS REWRITE**

## 🎯 Remaining Work

- [ ] Implement correct Keccak-f1600 with precomputed state
- [ ] Verify hash matches rusty-kaspa test vectors
- [ ] Get first accepted KAS share
- [ ] Native GPU mining (pending KAS fix)

## 🏆 Working Algorithms Status

| Algorithm | Coin | Status | Library |
|-----------|------|--------|---------|
| Ethash | ETC/ETHW | ✅ Working | `ethash` v1.1.0 |
| KawPow | RVN/XNA | ✅ Working | `kawpow` v0.9.4.4 |
| kHeavyHash | KAS | ⚠️ Wrong algorithm | Needs rewrite |

---
*Session continues with Keccak-f1600 implementation...*
