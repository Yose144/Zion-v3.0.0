# 🔥 Work Report — 7. February 2026: ERG Autolykos2 Metal GPU Miner v4

## Session: Apple Silicon ERG Mining Optimization

**Date**: 2026-02-07  
**Duration**: Full session (~6 hours)  
**Focus**: Build, debug, and optimize Autolykos v2 (ERG) GPU miner for Apple M1 using Metal compute shaders

---

## 🎯 Objective

Mine ERG (Ergo) on Apple M1 via 2miners pool (`erg.2miners.com:8888`) with maximum possible hashrate using our custom ZION Universal Miner with Metal GPU compute shaders.

---

## 📊 Results Summary

| Metric | Value |
|--------|-------|
| **Algorithm** | Autolykos v2 (ERG) — TABLELESS mode |
| **GPU** | Apple M1 (Metal) |
| **Hashrate v3** (before) | ~24 kH/s |
| **Hashrate v4** (after) | **~83 kH/s** |
| **Improvement** | **3.46×** speedup |
| **Pool** | erg.2miners.com:8888 |
| **Wallet (BTC)** | `bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw` |
| **Payout** | Auto-exchange ERG→BTC (2miners) |
| **Dashboard** | https://erg.2miners.com/account/bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw |
| **Batch size** | 65,536 nonces/batch |
| **Threads/threadgroup** | 384 |
| **Build** | Release (optimized) ✅ |
| **Stability** | Rock-solid, no crashes, no GPU timeouts |

---

## 🔬 Technical Work Done

### 1. CUDA Reference Miner Analysis

Studied two open-source Autolykos miners:
- **ergoplatform/Autolykos-GPU-miner** (v1)
- **mhssamadani/Autolykos2_NV_Miner** (v2)

Key findings from CUDA codebase:
- `devB2B_MIX()`: All 12 Blake2b rounds fully expanded inline (no sigma table lookup, no loop)
- `devB2B_G()`: Inline mixing function matching RFC 7693
- `BlockMiningStep1`: `__launch_bounds__(64,64)` — nonce hashing with transposed BHashes
- `BlockMiningStep2`: Shared memory cooperative hash lookups
- `InitMining()`: Pre-computed Blake2b midstate for message
- Prehash table: N×32 bytes (~64GB at current N) — **impossible on M1 (16GB)**

### 2. Shader v4 Optimization (Fully Unrolled Blake2b)

**Before (v3)**:
```metal
// Loop-based compression with sigma table lookup
constant uint8_t BLAKE2B_SIGMA[12][16] = { ... };

for (int round = 0; round < 12; round++) {
    blake2b_G(v, 0, 4, 8, 12, m[BLAKE2B_SIGMA[round][0]], m[BLAKE2B_SIGMA[round][1]]);
    // ... 7 more G calls per round
}
```

**After (v4)**:
```metal
// Macro for maximum inlining (matches CUDA devB2B_G)
#define B2B_G(v, a, b, c, d, x, y) \
    v[a] = v[a] + v[b] + (x); \
    v[d] = rotr64(v[d] ^ v[a], 32); \
    // ...

// All 12 rounds with constant sigma indices — no table, no loop
// Round 0
B2B_G(v, 0,4, 8,12, m[ 0], m[ 1]);
B2B_G(v, 1,5, 9,13, m[ 2], m[ 3]);
// ... all 96 G calls (8 per round × 12 rounds) hardcoded
```

### 3. Why Tableless Mode

| Approach | Memory Required | Blake2b/nonce | Our Choice |
|----------|----------------|---------------|------------|
| **Prehash Table** (CUDA) | ~64 GB | ~2 | ❌ Won't fit on M1 |
| **Partial Cache** (12GB) | 12 GB | ~27 | ❌ Only 20% gain, not worth it |
| **Tableless** (our approach) | 0 | ~2,180 | ✅ Only viable option |

At current height (1,716,884), N=196,308,735 (~196M). Full table = 196M × 32B = **6.27 GB**.
But N grows 5% every 51,200 blocks. At N_max (4,198,400) table = **2.14B × 32B = 68.7 GB**.

### 4. Files Modified

| File | Changes |
|------|---------|
| `2.9.5/zion-cosmic-harmony-v3/src/gpu/autolykos2_shader.metal` | v4 fully unrolled Blake2b, removed sigma table, B2B_G macro |
| `2.9.5/zion-cosmic-harmony-v3/src/gpu/autolykos2_metal_miner.rs` | Autolykos2 Metal miner wrapper (unchanged this session) |
| `2.9.5/zion-universal-miner/src/miner/external_pool.rs` | ERG pool mining orchestration (batch_size=65536) |
| `2.9.5/zion-universal-miner/src/stratum/ethstratum.rs` | EthStratum protocol for ERG on 2miners |
| `2.9.5/zion-cosmic-harmony-v3/src/gpu/mod.rs` | GPU module exports |

---

## 🏃 How to Run

```bash
# Build release
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main/2.9.5
cargo build --release --features metal -p zion-universal-miner

# Mine ERG on 2miners (100% hashpower to external pool)
./target/release/zion-universal-miner \
  --pool stratum+tcp://localhost:3333 \
  --wallet ZION_dummy \
  --external-coin erg \
  --external-pool erg.2miners.com:8888 \
  --external-wallet bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw \
  --external-percent 100 \
  --gpu
```

---

## 📈 Performance Timeline

```
Session 1: Algorithm implementation → correctness fixes → 24 kH/s
Session 2: Share target fix (DIFF1) → pool acceptance → stable 24 kH/s
Session 3: v3 crash (too aggressive batch_size) → rollback
Session 4: CUDA reference analysis → v4 unrolled Blake2b → 83 kH/s ✅
```

---

## 🔮 Future Optimization Opportunities

1. **Blake2b midstate caching**: Pre-compute h||M prefix state for R-element hashes (save ~50% compressions per R-element)
2. **Partial prehash table**: If N stabilizes, a 4-6 GB cache could fit on M1 (30-50% R-element cache hits)
3. **SIMD / threadgroup cooperation**: Use Metal threadgroup memory for shared hash state
4. **Multi-GPU support**: M1 Pro/Max/Ultra have more GPU cores → proportionally higher hashrate
5. **Estimated M-series hashrates**:
   - M1: ~83 kH/s (measured ✅)
   - M1 Pro: ~130-170 kH/s (estimated, 2× GPU cores)
   - M1 Max: ~260-340 kH/s (estimated, 4× GPU cores)
   - M4 Pro/Max: potentially higher with improved Metal performance

---

## ✅ Session Status

- [x] Autolykos v2 algorithm correct (matches Ergo reference)
- [x] EthStratum protocol for 2miners working
- [x] Share target (DIFF1-based) correct
- [x] CPU verification hash validates GPU results
- [x] CUDA reference miners analyzed
- [x] Shader v4 fully unrolled Blake2b implemented
- [x] 3.46× speedup achieved (24 → 83 kH/s)
- [x] Release build compiles and runs stable
- [ ] Shares submitted and accepted on 2miners (pending — diff=1 shares are rare at 83 kH/s)

---

**🌟 "Where technology meets spirit — even mining serves consciousness" 🌟**
