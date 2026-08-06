# Deeksha ASIC Resistance Analysis

**Date:** 2026-08-06
**Algorithm:** Ekam Deeksha v2 (deeksha_lite_v1 / deeksha_chv3)
**Implementation:** `V31/L1/cosmic-harmony/src/algorithm/ekam_deeksha.rs` + `deeksha_lite.cu`

---

## Algorithm Pipeline

```
Step 1: Keccak256(header[80] || nonce[8])           → s1[32]
Step 2: Memory-hard scratchpad (128 KiB)
   2A: SHA3-512 chain fill — 4096 blocks × 32B
   2B: 1 forward sequential XOR pass (4096 blocks)
   2C: 32 random reads (data-dependent addressing)
Step 3: AES-128 CTR mix (2 rounds, key=s2, counter=nonce)
Step 4: Keccak256(s3)                               → final hash[32]
```

### Key Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Scratchpad size | 128 KiB | 4096 blocks × 32 bytes |
| Fill hash | SHA3-512 | 4096 sequential calls |
| Sequential passes | 1 (forward) | PASSES=1 in Ekam v2 lite |
| Random reads | 32 | Data-dependent addressing |
| AES rounds | 2 | 1 full + 1 final (reduced AES-128) |
| Final hash | Keccak256 | 32-byte output |

---

## ASIC Resistance Properties

### 1. Memory-Hardness (Memory Wall) — MODERATE

**Scratchpad: 128 KiB per nonce.**

The algorithm requires 128 KiB of fast memory per nonce. This is the primary ASIC resistance mechanism — an ASIC must provision 128 KiB of SRAM per hash core.

| Comparison | Scratchpad | Notes |
|------------|-----------|-------|
| **Deeksha v2 lite** | 128 KiB | Current |
| Ethash (DAG) | ~1-2 GB | Very high, but read-only |
| RandomX | 2 GB | Very high, program-dependent |
| CryptoNight | 2 MiB | High |
| Equihash | ~144 MiB | High |
| **Deeksha v2 full** | 256 KiB | `scratchpad_ekam.rs` Tier 1 |

**Assessment:** 128 KiB is **low** compared to modern memory-hard algorithms. An ASIC can fit 128 KiB SRAM per core cheaply — a 100-core ASIC would need only 12.5 MiB SRAM, which is trivially small. Modern ASICs can pack thousands of cores with 128 KiB each in less than 100 MiB SRAM.

**Weakness:** The 128 KiB scratchpad is small enough that an ASIC could use on-die SRAM with zero latency, eliminating the memory bandwidth bottleneck that GPUs face. This is the algorithm's **biggest ASIC vulnerability**.

### 2. Data-Dependent Memory Access — GOOD

The random read phase (Step 2C) uses **data-dependent addressing**:

```python
pos = 0
for r in 0..32:
    acc ^= scratchpad[pos * 32]      # read at data-dependent position
    idx_val = acc[0:8] ^ pos ^ r     # next position from accumulated data
    pos = idx_val % 4096
```

This is the **key ASIC resistance property** — the memory access pattern cannot be predicted in advance and depends on the scratchpad contents. An ASIC cannot:
- Pre-fetch memory locations (doesn't know where to look)
- Parallelize random reads (each read depends on previous)
- Use caching tricks (access pattern is unique per nonce)

**Assessment:** This is the strongest part of the design. Data-dependent access forces serial execution of the random read phase. However, **32 reads is very few** — RandomX does 256 random reads, CryptoNight does hundreds. 32 reads means the serial bottleneck is only ~32 × memory_latency, which is fast even on commodity DRAM.

### 3. Sequential Fill (Chain Dependency) — MODERATE

Step 2A fills the scratchpad with a **sequential SHA3-512 chain**:

```
state = seed || 0×32
for blk in 0..4096:
    out = sha3_512(state || blk_byte)
    pad[blk] = out[0:32]
    state = out[0:32] || 0×32   # chain: next input depends on previous output
```

This cannot be parallelized — each block depends on the previous. An ASIC must compute 4096 sequential SHA3-512 calls, which takes the same time regardless of hardware.

**Assessment:** Good serial dependency, but SHA3-512 is a standard hash that ASICs can implement very efficiently in hardware. A custom SHA3-512 ASIC core can be ~100× faster than a GPU's software implementation.

### 4. Multiple Hash Primitives — MIXED

The algorithm uses three distinct cryptographic primitives:
- **Keccak256** (Steps 1, 4) — SHA-3 family
- **SHA3-512** (Step 2A fill) — SHA-3 family
- **AES-128** (Step 3) — symmetric cipher

**Assessment:** Using multiple primitives means an ASIC must implement all three in hardware. However, Keccak and SHA3-512 share the same Keccak-f1600 permutation, so they can share silicon. AES-128 is already hardware-accelerated on most CPUs (AES-NI) and is trivial to implement on an ASIC.

The **reduced AES (2 rounds instead of 10)** is a concern — standard AES-128 uses 10 rounds. Using only 2 rounds makes the AES step cryptographically weak, though this doesn't directly affect ASIC resistance (ASICs implement full and reduced AES equally fast).

### 5. No Program Variability — WEAK

Unlike RandomX (which generates random programs executed on a virtual machine), Deeksha executes the **same fixed sequence of operations for every nonce**. The only thing that changes is the data (scratchpad contents and access patterns).

**Assessment:** This is a significant weakness. RandomX's program variability forces ASICs to implement a general-purpose CPU pipeline. Deeksha's fixed pipeline can be fully hardwired in silicon — no instruction fetch, no branching, no register file needed. An ASIC would be a pure datapath with SHA3 + AES + memory.

### 6. No Epoch Changes / No DAG — WEAK

Ethash uses a 1-2 GB DAG that regenerates every epoch, forcing ASICs to either:
- Store the entire DAG in fast memory (expensive)
- Regenerate it periodically (slow)

Deeksha has **no epoch-dependent data**. The scratchpad is regenerated from scratch for every nonce, so there's no large shared state to protect.

**Assessment:** No protection against ASICs that can generate the 128 KiB scratchpad quickly. Since the fill is a sequential SHA3-512 chain, a fast SHA3-512 ASIC core can fill it in microseconds.

---

## ASIC Advantage Estimation

| Component | GPU (GTX 1070 Ti) | Estimated ASIC | ASIC Advantage |
|-----------|-------------------|----------------|----------------|
| SHA3-512 fill (4096 calls) | ~0.4 ms | ~0.004 ms | 100× |
| Sequential XOR pass | ~0.05 ms | ~0.001 ms | 50× |
| Random reads (32 × latency) | ~0.01 ms | ~0.0003 ms | 30× |
| AES-128 (2 rounds) | ~0.001 ms | ~0.00001 ms | 100× |
| Keccak256 (final) | ~0.001 ms | ~0.00001 ms | 100× |
| **Total per nonce** | **~0.46 ms** | **~0.006 ms** | **~77×** |

**A custom Deeksha ASIC could be ~50-100× faster than a GTX 1070 Ti per core.**

With 1000 cores on a single chip (feasible at 128 KiB/core = 125 MiB SRAM):
- GPU: 2.52 MH/s
- ASIC (est.): 1000 cores × (1/0.006ms) = ~167 MH/s
- **ASIC advantage: ~66× overall**

For comparison:
- Bitcoin SHA-256 ASIC: ~10,000× faster than GPU
- Ethash ASIC (e.g., Linzhi): ~3-5× faster than GPU
- RandomX ASIC: ~2-3× faster than CPU (very limited)

---

## Strengths

1. **Data-dependent random reads** — forces serial execution, prevents prefetching
2. **Sequential chain fill** — cannot be parallelized within a single nonce
3. **Multiple hash primitives** — requires SHA3 + AES hardware (not trivial but not hard)
4. **Keccak-f1600 permutation** — not as commonly hardware-accelerated as SHA-256
5. **Reasonable for GPU/CPU mining** — commodity hardware can mine efficiently

## Weaknesses

1. **128 KiB scratchpad is too small** — ASICs can use on-die SRAM, eliminating the memory wall
2. **Only 32 random reads** — serial bottleneck is minimal (RandomX: 256, CryptoNight: 500+)
3. **Only 1 sequential pass** — forward XOR is cheap (full Ekam v2: 4 passes, 256 reads)
4. **No program variability** — fixed pipeline is easy to hardwire in silicon
5. **No epoch/DAG mechanism** — no large shared state to protect
6. **Reduced AES (2/10 rounds)** — cryptographically weak, doesn't add ASIC resistance
7. **SHA3-512 is hardware-implementable** — standard primitive, not ASIC-resistant

---

## Comparison with Other Algorithms

| Algorithm | Scratchpad | Random Reads | Passes | Program Variability | ASIC Resistance |
|-----------|-----------|--------------|--------|---------------------|-----------------|
| **Deeksha v2 lite** | 128 KiB | 32 | 1 | None | **Low-Moderate** |
| Deeksha v2 full | 256 KiB | 256 | 4 | None | Moderate |
| Ethash | 1-2 GB DAG | 128 | — | None | Moderate-High |
| RandomX | 2 GB | 256 | — | Yes (VM) | Very High |
| CryptoNight | 2 MiB | 500+ | 2 | None | Moderate |
| Equihash | 144 MiB | — | — | None | Moderate |
| SHA-256 (Bitcoin) | 0 | 0 | 0 | None | None |

---

## Recommendations for Hardening

If stronger ASIC resistance is desired, consider these changes (ordered by impact):

### Tier 1: High Impact, Low Complexity

1. **Increase scratchpad to 2-4 MiB** — forces ASICs to use external DRAM, not on-die SRAM. This is the single most effective change. At 4 MiB/core, a 100-core ASIC needs 400 MiB SRAM — economically prohibitive.

2. **Increase random reads from 32 to 256+** — extends the serial bottleneck. Each additional read adds one memory latency cycle that ASICs cannot parallelize. This directly increases the minimum time per nonce.

3. **Increase sequential passes from 1 to 4** — the full Ekam v2 profile already supports this (`PASSES_V2=4`). More passes mean more serial memory traffic before the random read phase.

### Tier 2: Medium Impact, Medium Complexity

4. **Add epoch-dependent seed mixing** — periodically change a parameter that affects scratchpad generation, similar to Ethash's epoch. This doesn't prevent ASICs but forces periodic re-engineering.

5. **Use full AES-128 (10 rounds)** — the current 2-round AES is cryptographically weak. While this doesn't directly improve ASIC resistance (ASICs do 10 rounds as fast as 2), it improves the cryptographic soundness of the algorithm.

6. **Add a second hash primitive** — replace one SHA3-512 call with Blake3 or Argon2 to force ASICs to implement additional hardware blocks. The `scratchpad_ekam.rs` Tier 2 already uses Blake3 XOF for init.

### Tier 3: High Impact, High Complexity

7. **Add program variability (RandomX-style)** — generate a random program from the seed that determines the sequence of operations. This is the gold standard for ASIC resistance but requires significant engineering.

8. **Add Merkabah/Kabala/Brahma-jyoti phases** — the full Ekam v2 transform in `scratchpad_ekam.rs` includes these additional phases with HIC-dependent reads and SHA3-512 finalization. These add more serial dependencies and data-dependent access patterns.

---

## Conclusion

Deeksha v2 lite provides **low-to-moderate ASIC resistance**. Its primary defense is the data-dependent random read pattern, which forces serial execution. However, the 128 KiB scratchpad is small enough that a custom ASIC could use on-die SRAM, and the fixed pipeline with only 32 random reads and 1 sequential pass provides limited protection against a determined ASIC designer.

**Estimated ASIC advantage: 50-100× per core, potentially 66× overall** vs a GTX 1070 Ti.

The algorithm is well-suited for **commodity mining** (GPU + CPU) where the goal is broad participation rather than absolute ASIC prevention. For stronger ASIC resistance, the full Ekam v2 profile (256 KiB, 4 passes, 256 reads) or the Tier 2 variant (Blake3 XOF + AES cascade) would be significantly harder to ASIC-mine.

The current parameters represent a **deliberate trade-off**: keeping the algorithm lightweight enough for CPU/GPU mining while providing enough memory-hardness to deter casual ASIC development. This is a valid design choice for a mainnet alpha phase, but should be revisited before wider deployment.
