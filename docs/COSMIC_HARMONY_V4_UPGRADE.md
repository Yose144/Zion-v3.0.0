# CosmicHarmony v4 — Upgrade Architecture Plan

> **Status:** DESIGN PHASE — Not yet implemented  
> **Date:** 2026-02-28  
> **Author:** ZION Core Team  
> **Scope:** L1 consensus algorithm upgrade + L3 NCL PoUW integration  
> **Requires:** Hard-fork vote (L1 changes) + feature-flag rollout (L3)

---

## Table of Contents

1. [Motivation — Why Upgrade Beyond Standard PoW](#1-motivation)
2. [Current State — CosmicHarmony v3](#2-current-state)
3. [Proposed Architecture — CosmicHarmony v4](#3-proposed-architecture)
   - 3A. NPU Mixing Step
   - 3B. ZK-Shark: ZK Proof as Mining Work
   - 3C. NCL PoUW: Proof of Useful Work
4. [Hardware Targets](#4-hardware-targets)
5. [Codebase Impact Map](#5-codebase-impact-map)
6. [Implementation Phases](#6-implementation-phases)
7. [Protocol & Fork Plan](#7-protocol--fork-plan)
8. [Security Analysis](#8-security-analysis)
9. [Risk Assessment](#9-risk-assessment)
10. [References](#10-references)

---

## 1. Motivation

### Why ordinary PoW is becoming insufficient

Standard PoW (SHA256, Scrypt, RandomX) has three fundamental weaknesses in 2026:

| Problem | Detail | ZION impact |
|---------|--------|-------------|
| **ASIC centralization** | High-end ASICs dominate hash rate; consumer hardware marginalised | Conflicts with ZION's democratized mining vision |
| **Wasted compute** | Mining work has zero utility outside consensus | ~25% of ZION compute allocated to NCL already, but L1 core is still "wasted" SHA3 |
| **No ZK/AI narrative fit** | Market differentiation is lost when algo is generic | ZION positions as AI-native blockchain; consensus should reflect that |

### Why CosmicHarmony v3 is a strong base but can go further

CHv3 already includes:
- 5-phase ASIC-resistant pipeline (Keccak → SHA3 → GoldenMatrix → MemoryHard → CosmicFusion)
- AES-NI Haraka-inspired fusion rounds (hardware CPU advantage)
- Free merged-mining byproducts (ETC/Nexus via Keccak/SHA3 reuse)
- NCL AI compute allocation (25% of compute to inference tasks)

**Gap:** The L1 hash pipeline itself does not yet leverage NPU hardware or produce verifiable ZK proofs. CHv4 closes this gap.

---

## 2. Current State — CosmicHarmony v3

### 2.1 Pipeline (5 phases)

```
Block Header + Nonce
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  Phase 1: Keccak-256                                │
│  Output: 32 bytes                                   │
│  FREE byproduct → ETC / NiceHash merged mining      │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Phase 2: SHA3-512                                  │
│  Output: 64 bytes                                   │
│  FREE byproduct → Nexus / 0xBTC merged mining       │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Phase 3: GoldenMatrix (φ-based 8×8 transform)      │
│  Fixed-point arithmetic for cross-platform det.     │
│  Output: 64 bytes                                   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Phase 4: MemoryHard Scratchpad                     │
│  ASIC resistance through memory bandwidth           │
│  Input: 64 bytes → 64-byte scratchpad state         │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Phase 5: CosmicFusion                              │
│  4× fusion rounds: Keccak + AES-NI (Haraka)        │
│  Data-dependent XOR mask (no static constants)      │
│  Output: 32-byte final hash                         │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
            Final Hash ← compare to target
```

### 2.2 Compute Allocation Model (50/25/25)

```
Total Miner Compute
├── 50% → ZION L1 mining (the pipeline above)
│   ├── FREE: Keccak byproduct → ETC / NiceHash
│   └── FREE: SHA3 byproduct  → Nexus / 0xBTC
├── 25% → Multi-algo profit switch (ERG/RVN/KAS/ALPH)
└── 25% → NCL AI inference tasks (L3)
```

### 2.3 Key Files (Current)

| File | Purpose |
|------|---------|
| `L1/cosmic-harmony/src/algorithms_opt.rs` | Optimized hash pipeline (1149 LOC) |
| `L1/cosmic-harmony/src/algorithms.rs` | Public API wrappers |
| `L1/cosmic-harmony/src/engine.rs` | `CosmicHarmonyV3` engine struct (646 LOC) |
| `L1/cosmic-harmony/src/ncl_integration.rs` | NCL AI bonus + ConsciousnessLevel |
| `L1/miner/src/` | Miner binary (stratum client, job loop) |
| `L1/pool/src/` | Pool server (share validator, stratum server) |
| `L3/ncl/` | Neural Compute Layer crate (~1800 LOC, 34 tests) |
| `L3/ai-native/` | AI agent orchestration (~2200 LOC, 59 tests) |

---

## 3. Proposed Architecture — CosmicHarmony v4

CHv4 is **additive** — it extends CHv3 pipeline, not replaces it. Three independently deployable upgrades are proposed:

```
                    CHv4 UPGRADE MAP
                    
  CHv3 Pipeline  →  3A: NPU Mixing Step  (medium complexity)
  CHv3 Pipeline  →  3C: ZK-Shark proof shares  (high complexity)
  L3/ncl tasks   →  3B: NCL PoUW shares  (low complexity — stub exists)
```

---

### 3A. NPU Mixing Step — CosmicHarmonyV4 with Neural Mixing

#### Concept

Insert a 6th phase between MemoryHard and CosmicFusion:

```
... Phase 4: MemoryHard Scratchpad (64 bytes)
        │
        ▼
┌─────────────────────────────────────────────────────┐  ← NEW in CHv4
│  Phase 5½: NPU Mixing (ONNX Runtime)               │
│                                                     │
│  Input:  64-byte scratchpad state                   │
│  Model:  ch_mixing_v4.onnx (100KB static)           │
│          - 64 → 128 → 64 neuron MLP                │
│          - INT8 quantized (8-bit weights)           │
│          - Latency: ~50–200μs on Apple ANE           │
│                     ~100–400μs on Qualcomm Hexagon  │
│                     ~80–300μs on Intel NPU          │
│                                                     │
│  Output: 64-byte mixed state                        │
│                                                     │
│  Fallback: if no NPU detected → CPU softmax path   │
│  Feature flag: `native-npu` in Cargo.toml          │
└──────────────────────┬──────────────────────────────┘
        │
        ▼
... Phase 6: CosmicFusion (unchanged)
```

#### ONNX Model Specification

```
Model: ch_mixing_v4.onnx
Architecture:
  Linear(64, 128) + LayerNorm(128) + GELU
  Linear(128, 64)  + LayerNorm(64)
  Residual add (input + output)

Input:  float32[1, 64]  (scratchpad bytes cast to f32 / 255.0)
Output: float32[1, 64]  (re-scaled × 255, round to u8)

Quantization: INT8 (onnxruntime quantize_dynamic)
  → reduces inference latency 2–4× on NPU vs FP32
  → model size: ~28 KB INT8 vs ~112 KB FP32

Model Hash: baked into genesis block consensus constants
  → any tampered model = invalid block → consensus rejection
```

#### Security Properties

- Model weights are **public and immutable** — commit hash in genesis block
- NPU inference is **deterministic** on INT8 (no floating-point divergence)
- CPU fallback produces **identical output** (INT8 quantized = same integer path)
- ASIC barrier: must implement ONNX INT8 MLP hardware → ~3× higher ASIC dev cost

#### Cargo Feature Integration

```toml
# L1/cosmic-harmony/Cargo.toml
[features]
default = ["gpu"]
gpu = ["opencl", ...]
native-npu = ["ort"]         # NEW: ONNX Runtime NPU backend
npu-fallback-cpu = []        # NEW: always use CPU softmax (reproducibility testing)

[dependencies]
ort = { version = "2.0", optional = true, features = ["load-dynamic"] }
```

#### Code Skeleton

```rust
// L1/cosmic-harmony/src/algorithms_npu.rs (NEW FILE)

use ort::{Environment, Session, Value};

pub struct NpuMixer {
    session: Session,
}

impl NpuMixer {
    pub fn new(model_bytes: &[u8]) -> anyhow::Result<Self> {
        let env = Environment::builder()
            .with_name("ch_mixing_v4")
            .build()?;
        let session = SessionBuilder::new(&env)?
            .with_optimization_level(GraphOptimizationLevel::All)?
            .with_model_from_memory(model_bytes)?;
        Ok(Self { session })
    }

    /// Mix 64-byte scratchpad state via ONNX INT8 forward pass.
    /// Returns 64-byte mixed output.
    pub fn mix(&self, scratchpad: &[u8; 64]) -> anyhow::Result<[u8; 64]> {
        // Normalize: u8 → f32 in [0.0, 1.0]
        let input: Vec<f32> = scratchpad.iter().map(|&b| b as f32 / 255.0).collect();
        let tensor = Value::from_array(([1usize, 64], input.as_slice()))?;
        let outputs = self.session.run(vec![tensor])?;
        let result: Vec<f32> = outputs[0].extract_tensor::<f32>()?.view().iter().cloned().collect();

        // Denormalize: f32 → u8
        let mut out = [0u8; 64];
        for (i, &v) in result.iter().enumerate().take(64) {
            out[i] = (v * 255.0).round().clamp(0.0, 255.0) as u8;
        }
        Ok(out)
    }
}

/// Static model embed — hash must match genesis consensus constant
pub static CH_MIXING_V4_ONNX: &[u8] = include_bytes!("../models/ch_mixing_v4.onnx");
pub const CH_MIXING_V4_HASH: [u8; 32] = /* SHA3-256 of model bytes, baked at compile time */
    hex_literal::hex!("0000000000000000000000000000000000000000000000000000000000000000");
```

#### Integration Point in Pipeline

```rust
// L1/cosmic-harmony/src/algorithms_opt.rs — extend cosmic_harmony_v3()

pub fn cosmic_harmony_v4(input: &[u8]) -> Hash32 {
    let keccak_out  = keccak256_opt(input);
    let sha3_out    = sha3_512_opt(keccak_out.as_slice());
    let matrix_out  = golden_matrix_opt(sha3_out.as_slice());
    let mem_hard    = memory_hard_transform_opt(matrix_out.as_slice());
    
    // CHv4: NPU mixing step
    #[cfg(feature = "native-npu")]
    let mixed = {
        static MIXER: once_cell::sync::Lazy<NpuMixer> = 
            once_cell::sync::Lazy::new(|| {
                NpuMixer::new(CH_MIXING_V4_ONNX).expect("NPU mixer init")
            });
        let mut buf = [0u8; 64];
        buf.copy_from_slice(&mem_hard.data);
        MIXER.mix(&buf).expect("NPU mix")
    };
    #[cfg(not(feature = "native-npu"))]
    let mixed = mem_hard.data;  // passthrough for non-NPU builds
    
    cosmic_fusion_opt(&mixed)
}
```

---

### 3B. NCL PoUW — Proof of Useful Work

#### Concept

A miner share can be **an NCL inference task result** instead of a random nonce search. The pool verifies that:
1. The inference was performed correctly (output hash matches expected)
2. `hash(task_id || inference_output)` meets difficulty target

```
NCL Marketplace → inference request → miner submits result
                                            │
                                            ▼
                                  pool: verify(result) AND
                                        hash(task_id||output) < target
                                            │
                                            ▼
                              accepted share = useful AI compute done
```

#### NCL Task Share Format

```json
{
  "method": "mining.submit_ncl",
  "params": {
    "worker":     "wallet.rig0",
    "task_id":    "ncl_task_sha3_abc123",
    "nonce":      "0x0000beef",
    "output":     "<base64 inference output>",
    "proof_type": "hash",
    "proof":      "<sha3(task_id || output || nonce) hex>"
  }
}
```

#### NCL Stub (already exists)

The NCL stub in `L1/miner/src/ncl/` is **already feature-gated**. Phase B activates it:
- `L3/ncl/src/task.rs` — define `NclTask` → `NclShare` conversion
- `L1/pool/src/shares/validator.rs` — add `validate_ncl_share()` branch
- `L1/miner/src/ncl/` — remove `#[allow(dead_code)]`, wire to job loop

#### Revenue Distribution for NCL Shares

```
NCL Task Fee (from AI marketplace client)
├── 85% → miner (share reward)
├── 10% → ZION project (NCL fee)
└──  5% → NCL task submitter rebate
```

---

### 3C. ZK-Shark — ZK Proof as Mining Work

#### Concept

The hardest but most powerful upgrade. Mining work = generating a ZK-SNARK proof.

```
Seed (from block header) + Nonce
        │
        ▼
  Prover: PROVE(
    neural_net_forward_pass(seed, nonce) == claimed_output,
    using_model = zkml_model_v1
  )
        │
        ▼
  ZK Proof (Groth16 or PLONK, ~200 bytes)
        │
        ▼
  Pool: fast_verify(proof) = 10–100× cheaper than prove
        AND
  hash(proof.public_inputs) < difficulty_target
        │
        ▼
  Valid share → block candidate
```

#### zkML Libraries (Rust ecosystem)

| Library | Proof System | Status |
|---------|-------------|--------|
| `ezkl` | Halo2 (PLONK variant) | Production-ready (v9.x) |
| `bellman` | Groth16 (BLS12-381) | Mature, used in Zcash |
| `halo2` | PLONK with IPA | Production, no trusted setup |
| `risc0` | STARKs (zkVM) | High overhead, better for general compute |

**Recommendation:** `ezkl` + Halo2 — no trusted setup, ONNX model support out of the box.

#### ZK Proof Share Format

```json
{
  "method": "mining.submit_zk",
  "params": {
    "worker":      "wallet.rig0",
    "job_id":      "abc123",
    "nonce":       "0x0000beef",
    "proof":       "<hex encoded Halo2 proof bytes>",
    "public_inputs": ["<input1_hex>", "<output1_hex>"],
    "model_hash":  "<sha3 of zkml_model_v1.onnx>"
  }
}
```

#### Pool Verification Cost

| Operation | Time (estimated) |
|-----------|-----------------|
| Proof generation (GPU) | 2–30 seconds (model size dependent) |
| Proof verification (CPU) | 5–50 milliseconds |
| Ratio | 40–600× faster to verify than prove |

#### Share Difficulty Adjustment

Because proof generation is slow, difficulty target must be adjusted:
- ZK share difficulty = `standard_difficulty × proof_complexity_factor`
- `proof_complexity_factor` ≈ 50–200 (TBD based on benchmarks)
- Effective hash rate = `proofs_per_second × complexity_factor`

---

## 4. Hardware Targets

### NPU Hardware (Phase A — CHv4)

| Platform | NPU | TOPS | API |
|----------|-----|------|-----|
| Apple M1/M2/M3/M4 | Apple Neural Engine (ANE) | 11–38 TOPS | CoreML → ONNX |
| Qualcomm Snapdragon 8 Gen 3+ | Hexagon DSP NPU | 45 TOPS | QNN → ONNX |
| Intel Core Ultra (Meteor Lake+) | Intel NPU | 10–13 TOPS | OpenVINO → ONNX |
| AMD Ryzen AI (Phoenix/Hawk Point) | AMD XDNA | 10–16 TOPS | ROCm → ONNX |
| NVIDIA RTX 4000+ (Tensor Cores) | CUDA Tensor Core | 200+ TOPS | TensorRT → ONNX |
| Generic CPU | Software fallback | N/A | ONNX CPU provider |

### GPU Hardware (ZK Proofs — Phase C)

| GPU | ZK Proof Library Support | Estimated Prove Time (small model) |
|-----|-------------------------|-----------------------------------|
| RTX 3090 Ti | ezkl (CUDA) | 3–8 seconds |
| RTX 4090 | ezkl (CUDA) | 1–4 seconds |
| AMD RX 7900 XTX | ezkl (ROCm, experimental) | 5–12 seconds |
| Apple M3 Max | ezkl (Metal, experimental) | 8–20 seconds |

---

## 5. Codebase Impact Map

### Phase A — NPU Mixing (CosmicHarmonyV4)

```
L1/cosmic-harmony/
├── Cargo.toml                   MODIFY — add `native-npu` feature + `ort` dep
├── models/
│   └── ch_mixing_v4.onnx        CREATE — 100KB INT8 MLP model
├── src/
│   ├── algorithms_npu.rs        CREATE — NpuMixer struct, CH_MIXING_V4_ONNX embed
│   ├── algorithms_opt.rs        MODIFY — add cosmic_harmony_v4() function
│   ├── engine.rs                MODIFY — CosmicHarmonyV4 variant in AlgorithmType
│   └── lib.rs                   MODIFY — pub use algorithms_npu; feature gate

L1/miner/
├── Cargo.toml                   MODIFY — add `native-npu` feature passthrough
└── src/
    └── mining_loop.rs           MODIFY — select CHv3 vs CHv4 based on config/flag

L1/pool/
└── src/
    └── shares/validator.rs      MODIFY — validate CHv4 shares (same logic, CHv4 algo)
```

### Phase B — NCL PoUW

```
L3/ncl/
└── src/
    ├── task.rs                  MODIFY — add NclShare type, from_task() constructor
    └── proof.rs                 CREATE — hash-based proof for NCL task output

L1/miner/
└── src/
    └── ncl/                     MODIFY — activate stub, wire NclTask → NclShare

L1/pool/
└── src/
    └── shares/validator.rs      MODIFY — add validate_ncl_share() branch
```

### Phase C — ZK-Shark

```
L3/ai-native/
└── src/
    └── zkml_registry.rs         CREATE — zkML model registry + model hash verification

L1/cosmic-harmony/
└── src/
    └── zk_share.rs              CREATE — ZkShare type, verify_zk_proof()

L1/pool/
└── src/
    └── shares/validator.rs      MODIFY — add validate_zk_share() branch + pool side verify

L1/miner/
└── src/
    └── zk_prover.rs             CREATE — ezkl/halo2 proof generation worker

L1/core/
└── src/
    └── consensus/
        └── zk_validation.rs     CREATE — on-chain ZK proof validation for block headers
```

---

## 6. Implementation Phases

### Phase A — CHv4 NPU Mixing (v2.10.x target)

**Complexity:** Medium  
**Breaking:** YES — hard fork required (new algo version)  
**Feature flag:** `native-npu`  
**Estimated effort:** 3–5 weeks

```
Week 1: Train ch_mixing_v4.onnx model, INT8 quantize, compute hash
Week 2: Implement NpuMixer (ort crate), CPU fallback path
Week 3: Wire into cosmic_harmony_v4() pipeline
Week 4: Benchmark NPU vs CPU (latency, determinism tests)
Week 5: Integrate pool validator, testnet fork
```

**Acceptance criteria:**
- [ ] CPU and NPU paths produce **identical** output (INT8 determinism)
- [ ] Latency regression: CHv4 ≤ CHv3 + 500μs per hash
- [ ] Pool correctly validates CHv4 shares
- [ ] Model hash matches genesis constant in all test vectors
- [ ] Testnet runs stable for 2000+ blocks

### Phase B — NCL PoUW (v2.10.x parallel track)

**Complexity:** Low (stub exists)  
**Breaking:** NO — additive share type, backward compatible  
**Feature flag:** feature-gated in miner config (`enable_ncl_shares: true`)  
**Estimated effort:** 2–3 weeks

```
Week 1: Define NclShare format, implement NclTask → NclShare
Week 2: Pool validator: validate_ncl_share() + difficulty equivalence formula
Week 3: NCL marketplace integration test, revenue accounting
```

**Acceptance criteria:**
- [ ] NCL shares accepted by pool alongside standard PoW shares
- [ ] Revenue percentage correctly distributed (85/10/5 split)
- [ ] Difficulty equivalence formula prevents NCL share grinding

### Phase C — ZK-Shark (v3.0.x target, post-mainnet)

**Complexity:** High  
**Breaking:** YES — requires consensus-level ZK verifier  
**Feature flag:** experimental, opt-in per pool  
**Estimated effort:** 3–6 months

```
Month 1: ezkl integration, benchmark proof time per model size
Month 2: Define zkml_v1.onnx model (small = fast proofs), ZkShare format
Month 3: Pool-side fast_verify() implementation
Month 4: On-chain ZK proof validation in L1/core
Month 5–6: Testnet rolling deployment, difficulty calibration
```

**Acceptance criteria:**
- [ ] Proof verify ≤ 50ms on commodity pool server hardware
- [ ] Proof generation ≤ 15 seconds on RTX 3090 (otherwise difficulty impossible)
- [ ] ZK share difficulty formula produces equivalent block rate to PoW shares
- [ ] No trusted setup (Halo2 / STARKs only)

---

## 7. Protocol & Fork Plan

### CHv4 Hard Fork Parameters

```toml
# config/mainnet.toml (future additions)
[consensus]
algorithm_version = 4              # upgrade from 3
chv4_activation_height = TBD       # block height for CHv4 activation
chv4_model_hash = "sha3:..."       # CH_MIXING_V4_ONNX hash
npu_fallback_enabled = true        # allow CPU fallback (same output)

[npl_share]
ncl_share_enabled = false          # Phase B: enable after Phase A stable
ncl_difficulty_multiplier = 1.0    # NCL share difficulty equivalence factor

[zk_share]
zk_share_enabled = false           # Phase C: experimental only
zkml_model_hash = ""               # Phase C
zk_proof_system = "halo2"          # Phase C
```

### Fork Vote Requirements

Per ZION MainNet Constitution:
- Hard fork requires: **>66% mining power vote** (signal in coinbase data)
- Upgrade window: **2016 blocks** (~2 weeks at 1 block/10min pace)
- Rollback safety: **CHv3 fallback mode** available for first 10080 blocks after fork

### Version Negotiation in Stratum

```json
// miner capability advertisement (mining.capabilities extension)
{
  "method": "mining.capabilities",
  "params": [{
    "algo_versions": ["cosmic-harmony-v3", "cosmic-harmony-v4"],
    "npu_available": true,
    "npu_type": "apple-ane",
    "ncl_shares": false,
    "zk_shares": false
  }]
}
```

---

## 8. Security Analysis

### NPU Mixing (Phase A)

| Attack Vector | Mitigation |
|--------------|-----------|
| Tampered ONNX model | Model hash in genesis → invalid block on any mutation |
| NPU non-determinism | INT8 quantization removes floating-point variance |
| NPU bypass (always CPU) | CPU fallback produces same output; no advantage |
| ONNX runtime bug exploit | Model is 64-in/64-out linear transform; no external calls |
| Side-channel timing leak | Inference latency varies <5% → timing oracle resistance sufficient |

### NCL PoUW (Phase B)

| Attack Vector | Mitigation |
|--------------|-----------|
| Fake inference output | `hash(task_id || output)` must meet target; requires valid solve |
| Task grinding | Minimum task difficulty floor + ZION-issued task_id nonce |
| NCL task DOS | Pool only accepts NCL tasks from verified marketplace contract |

### ZK-Shark (Phase C)

| Attack Vector | Mitigation |
|--------------|-----------|
| Proof system soundness | Use peer-reviewed Halo2 (Zcash heritage); no custom crypto |
| Trusted setup requirement | Halo2 and STARKs have no trusted setup |
| Verification cost explosion | Verification must be benchmarked ≤ 50ms before activation |
| Model substitution | zkml model hash enforced per share; pool rejects mismatched hash |

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| NPU INT8 determinism across vendors fails | Medium | High | Extensive cross-platform test suite; CPU fallback always available |
| ONNX Runtime CVE / memory safety | Low | High | Sandboxed inference; no model external network calls |
| CHv4 adoption too slow → chain split | Medium | Critical | Long activation window (2016 blocks); >66% threshold |
| NCL difficulty equivalence miscalculation | Medium | Medium | Conservative initial multiplier; soft adjustable via governance |
| ZK proof too slow → miner abandonment | High (Phase C) | High | Phase C strictly experimental until ≤15s prove time proven |
| ezkl CUDA memory usage too high | Medium | Medium | Limit max GPU memory for ZK; dedicated ZK-mining mode |

---

## 10. References

### Internal

- [L1/cosmic-harmony/src/algorithms_opt.rs](../L1/cosmic-harmony/src/algorithms_opt.rs) — current CHv3 pipeline
- [L1/cosmic-harmony/src/ncl_integration.rs](../L1/cosmic-harmony/src/ncl_integration.rs) — NCL AI bonus (Phase B base)
- [L3/ncl/](../L3/ncl/) — Neural Compute Layer crate
- [docs/L1-L4_ROADMAP.md](L1-L4_ROADMAP.md) — full layer architecture roadmap
- [docs/CHv3/](CHv3/) — CosmicHarmony v3 design docs
- [Zkshark.md](../Zkshark.md) — ZK-Shark architecture notes (original session)

### External

- **ezkl** — zkML proof generation: https://github.com/zkonduit/ezkl
- **ort** (ONNX Runtime Rust) — https://ort.pyke.io
- **Halo2** — PLONK proof system: https://github.com/zcash/halo2
- **Modulus Labs** — zkML pioneer: https://www.modulus.xyz
- **ONNX Runtime NPU docs** — https://onnxruntime.ai/docs/execution-providers/
- **Apple CoreML → ONNX** — https://apple.github.io/coremltools/docs-guides/source/convert-to-ml-program.html

---

## Appendix A — CHv3 vs CHv4 Hash Pipeline Comparison

```
INPUT: block_header || nonce (variable length)

──────────────────────────── CHv3 ────────────────────────────
Phase 1: Keccak-256           → 32B    [byproduct: ETC share]
Phase 2: SHA3-512             → 64B    [byproduct: Nexus share]
Phase 3: GoldenMatrix (φ)     → 64B
Phase 4: MemoryHard Scratchpad→ 64B
Phase 5: CosmicFusion (AES-NI)→ 32B   [final hash]

──────────────────────────── CHv4 ────────────────────────────
Phase 1: Keccak-256           → 32B    [byproduct: ETC share]
Phase 2: SHA3-512             → 64B    [byproduct: Nexus share]
Phase 3: GoldenMatrix (φ)     → 64B
Phase 4: MemoryHard Scratchpad→ 64B
Phase 5½: NPU Mixing (ONNX)   → 64B   [new — NPU or CPU fallback]
Phase 6: CosmicFusion (AES-NI)→ 32B   [final hash]
```

## Appendix B — Estimated Performance Budget

| Platform | CHv3 H/s | CHv4 projected H/s | NPU overhead |
|----------|----------|-------------------|--------------|
| Ryzen 9 7950X (32T) | ~1,200 H/s | ~950 H/s (-21%) | CPU fallback |
| Core i9-14900K | ~1,100 H/s | ~920 H/s (-16%) | Intel NPU |
| M3 Max (12P core) | ~800 H/s | ~780 H/s (-2.5%) | Apple ANE |
| RTX 4090 (GPU path) | ~12,000 H/s | ~11,200 H/s (-7%) | Tensor Core |

> Performance figures are projections based on ONNX INT8 inference benchmarks for 64-in/64-out MLP.
> Actual numbers require implementation + profiling.

---

*This document is a living design spec. All implementation details are subject to change pending benchmarks, community vote, and security review.*

*Last updated: 2026-02-28 | ZION Core Team*
