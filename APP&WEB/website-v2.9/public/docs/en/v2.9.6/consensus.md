# ⚙️ Consensus v2.9.6 — Cosmic Harmony v3 (CHv3)

> *Single PoW algorithm for ZION. Five-phase pipeline with memory-hard scratchpad.*

---

## 1. Overview

ZION v2.9.6 uses **Cosmic Harmony v3 (CHv3)** as its only Proof-of-Work algorithm. Legacy CH v1/v2 are removed from the build and archived.

| Parameter | Value |
|-----------|-------|
| **Algorithm** | Cosmic Harmony v3 (CHv3) |
| **Crate** | `zion-cosmic-harmony-v3` v3.0.0 |
| **Hash output** | 32 bytes (256 bits) |
| **Nonce** | u64 |
| **Block time** | 60 seconds |
| **Difficulty** | LWMA (60-block window) |
| **CHv3 fork height** | 0 (active from genesis) |
| **Memory-hard fork height** | 50,000 |
| **ASIC resistance score** | 90/100 |

---

## 2. Five-phase pipeline

1. **Phase 1 — Keccak-256** on `header[0..80] ‖ nonce.to_le_bytes()` → 32 B  
2. **Phase 2 — SHA3-512** on Keccak output → 64 B  
3. **Phase 3 — Golden Matrix Transform** — φ-weighted rotations, XOR diffusion, fixed-point φ arithmetic → 64 B  
4. **Phase 4 — Memory-hard scratchpad** (height ≥ 50,000): 256 KiB pad, 4 sequential passes, 512 random reads, SHA3-512 chain init → 64 B  
5. **Phase 5 — Cosmic Fusion** — seven fusion rounds, golden-ratio XOR, final Keccak-256 → 32 B hash  

Test-only env overrides: `ZION_CHV3_MEMORY_HARD_DISABLE`, `ZION_CHV3_MEMORY_HARD_FORCE`.

---

## 3. Fork logic

| Block height | Behaviour |
|--------------|-----------|
| 0 – 49,999 | CHv3 **without** memory-hard Phase 4 |
| ≥ 50,000 | **Full** five-phase path including scratchpad |

---

## 4. LWMA difficulty

Target 60 s, window 60 blocks, timestamp clamp per network rules. Classical LWMA formula over solve times and past difficulties.

---

## 5. Template blob (165 B) & hash input

Layout: version, height, `prev_hash`, `merkle_root`, timestamp, difficulty, algorithm byte, nonce placeholder.  
Hasher consumes **first 80 B** of blob + explicit `nonce` and `height`:

```rust
let h = cosmic_harmony_v3_with_height(&blob, nonce, height);
```

PoW check: first 4 bytes of hash as little-endian `state0` vs target.

---

## 6. Reward schedule (historical table in doc)

v2.9.5-era flat reward section in the Czech file; v2.9.6 adopts Decade Decay + 5/5/89/1 split — see [tokenomics.md](tokenomics.md).

---

## 7. Timestamp drift limits

| Network | Max drift |
|---------|-----------|
| Testnet | 86,400 s (24 h) |
| Mainnet | 7,200 s (2 h) |

---

## 8. CHv3 unification (v2.9.6)

Single function `cosmic_harmony_v3_with_height(blob, nonce, height)` across miner, pool, and node — **no hash divergence**.

Legacy code in `archive/legacy-algorithms/`.
