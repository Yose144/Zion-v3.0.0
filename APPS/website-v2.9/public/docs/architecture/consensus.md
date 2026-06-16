# Cosmic Harmony — Consensus Algorithm: CHv3 → CHv4

**Current:** CHv3 (live on TestNet)  
**Upcoming:** CHv4 neural bloom phase (dev — target Q2 2026)

---

## Evolution Timeline

| Version | Name | Released | Key Change |
|---------|------|----------|------------|
| CHv1 | Stellar Seed | Sep 2025 | Genesis algorithm — Python prototype |
| CHv2 | Galactic Wave | Oct 2025 | Improved GPU utilization, memory-hard |
| CHv3 | Cosmic Harmony | Jan 2026 | 100% Rust, 4-phase pipeline, 2 MB scratchpad |
| CHv4 | Neural Bloom | Q2 2026 | 8-round Feistel perceptron, 4 MB scratchpad |

---

## CHv3 — Current Production Algorithm

### 4-Phase Pipeline

```
[Phase 1] Quantum Seed
    Input: Block header (80 bytes)
    Hash:  Blake3 (256-bit deterministic seed)
    Purpose: Non-interactive pre-image proof

[Phase 2] Galactic Matrix
    Scratchpad: 2 MB AES-NI memory fill
    Operations: 1024 AES block rounds
    Purpose: Memory-hard — ASIC unfriendly
    GPU optimization: ✅ native CUDA/OpenCL

[Phase 3] Stellar Harmony
    Input: Scratchpad digest
    Mix:   Argon2-lite variant (4 rounds)
    Purpose: Sequential memory dependency

[Phase 4] Cosmic Proof
    Output: 256-bit PoW hash
    Target: Dynamic difficulty (LWMA DAA)
```

### CHv3 Performance (reference hardware)

| Hardware | Hashrate | Notes |
|----------|----------|-------|
| RTX 4090 | ~6.2 MH/s | CUDA kernel v1.3 |
| RTX 3080 | ~3.8 MH/s | |
| RX 6800 XT | ~2.9 MH/s | OpenCL |
| Ryzen 9 7950X | ~340 kH/s | CPU solo |
| i7-12700K | ~180 kH/s | CPU solo |

### ASIC Resistance

CHv3 achieves ASIC resistance through:
1. **Memory-hard 2 MB scratchpad** — cannot be eliminated in ASIC die
2. **AES-NI dependency** — general CPU silicon performs near-optimally
3. **Irregular memory access** — kills ASIC prefetch pipelines
4. **Version-upgradeable pipeline** — algorithm can be changed via hard fork

---

## CHv4 — Neural Bloom (In Development)

### New Phase: Neural Bloom (Phase 3 replacement)

```
[Phase 3 CHv4] Neural Bloom
    Structure: 8-round Feistel network
    Weights:   Seeded from block nonce (pseudo-random)
    Operation: Perceptron-style weight mixing
    Scratchpad: 4 MB (2× CHv3)
    Purpose:
      - Anti-ASIC barrier: irregular compute graph
      - Memory doubled: 4 MB → DDR5 bandwidth limited
      - GPU-optimal: 32-wide warp per bloom round
```

### CHv4 vs CHv3 Comparison

| Attribute | CHv3 | CHv4 |
|-----------|------|------|
| Scratchpad | 2 MB | 4 MB |
| AES rounds | 1024 | 1024 |
| Neural phase | — | 8-round Feistel |
| Hash output | 256-bit | 256-bit |
| Estimated GPU perf | 6.2 MH/s (4090) | ~3.8 MH/s (4090) |
| ASIC resistance | High | Very High |
| Hard fork required | — | Yes |

> **Note:** CHv4 will require a TestNet hard fork before MainNet. The reduced hashrate per card reflects the heavier compute — network difficulty adjusts automatically via LWMA.

### Activation Plan

1. Implementation complete + tests → `L1/miner/src/gpu/kernels/chv4.cu`
2. TestNet hard fork block announcement (min. 4 weeks notice)
3. Community miner update window
4. MainNet fork (block TBD)

---

## Difficulty Adjustment — LWMA

ZION uses **LWMA (Linearly Weighted Moving Average)** for DAA.

$$D_{\text{new}} = D_{\text{ref}} \cdot \frac{T_{\text{target}} \cdot N \cdot (N+1)}{2 \cdot \text{LWMA}}$$

Where:
- $N$ = 60 (window size, last 60 blocks)
- $T_{\text{target}}$ = 60 seconds
- $\text{LWMA}$ = weighted average of recent solve times

**Properties:**
- Fast response to hashrate changes (no death spiral)
- Smooth — no oscillation
- Used by many GPU-friendly coins (Zcash derivatives, Beam, etc.)

---

*See also: [6-Layer Architecture](README.md) · [Mining Guide](../v2.9.7/design-system.md)*
