# Cosmic Harmony GPU Backend Development Plan

## 1. Scope & Objectives
- **Goal:** Deliver a production-grade HIP (AMD) GPU backend for the ZION Cosmic Harmony algorithm with parity to the existing CPU implementation.
- **Constraints:** Maintain identical hash output to CPU reference, preserve current API surface (`cosmic_hash`, `check_difficulty`, etc.), and integrate seamlessly with the existing C++/Python mining pipeline.
- **Success Criteria:**
  - GPU backend enabled via CMake option (`BUILD_COSMIC_HARMONY_GPU`).
  - Runtime auto-selection (GPU ➝ CPU fallback) mirroring Autolykos v2 implementation.
  - Benchmark demonstrating >5× speedup vs. CPU on RX 5600 XT.
  - Comprehensive validation tests (unit + integration) confirming hash equivalence and stability.

## 2. Current State Assessment
- Cosmic Harmony CPU implementation lives in `zion/mining/zion-cosmic-harmony.cpp`.
- Stages:
  1. BLAKE3 hashing
  2. Keccak-256 (via OpenSSL SHAKE)
  3. SHA3-512
  4. Golden Ratio matrix transform (custom double-precision operations)
- Tight coupling to OpenSSL EVP contexts; assumes CPU memory layout and serial execution.
- No GPU abstraction layer (unlike Autolykos v2’s `IGPUBackend`).

## 3. High-Level Architecture
- Introduce new module `cosmic_harmony_gpu_backend` mirroring Autolykos structure:
  - `cosmic_harmony_gpu_backend.h/.cpp` (factory + interface)
  - `cosmic_harmony_hip.cpp` (HIP implementation)
  - Optional `cosmic_harmony_cuda.cu` (future NVIDIA support)
- Shared C API exported for Python bindings:
  - `cosmic_harmony_gpu_available()`
  - `cosmic_harmony_gpu_backend_name()`
  - `cosmic_harmony_gpu_hash()` / `_hash_many()`
- CMake integration: `build_zion/cosmic_harmony/CMakeLists.txt` extended with HIP language detection, library targets, and install rules.

## 4. Work Breakdown Structure

### Phase 0 – Foundations (0.5–1 day)
1. Audit CPU implementation for determinism and isolate pure functions.
2. Extract stage logic into standalone headers to allow reuse from CPU & GPU.
3. Document data dependencies (buffer sizes, endian requirements, nonce handling).
4. Build minimal benchmarking harness (CLI + Python) for regression testing.

### Phase 1 – GPU Abstraction Layer (1 day)
1. Define `ICosmicHarmonyBackend` interface aligned with Autolykos pattern.
2. Implement CPU backend adaptor that conforms to new interface (ensures compatibility).
3. Add runtime factory with selection order: HIP ➝ CPU.
4. Extend unit tests to cover new interface.

### Phase 2 – BLAKE3 GPU Port (2–3 days)
1. Review official BLAKE3 GPU references (SIMD + CUDA kernels) for adaptation.
2. Implement HIP kernel for stage 1 (single + batch hashing).
3. Validate outputs against CPU for random vectors (1k+ samples).
4. Benchmark standalone BLAKE3 HIP throughput; tune block/thread sizes.

### Phase 3 – Keccak-256 GPU Stage (2–3 days)
1. Replace OpenSSL EVP usage with custom Keccak permutation implementation (portable C).
2. Port permutation to HIP kernel (consider 1600-bit state in shared memory).
3. Ensure domain separation and padding logic replicates CPU version.
4. Integrate with stage 1 output; validate full Stage 2 results vs CPU.

### Phase 4 – SHA3-512 GPU Stage (1–2 days)
1. Reuse Keccak infrastructure (same permutation with different absorb/squeeze).
2. Optimize for HIP (loop unrolling, constant memory for round constants).
3. Confirm bit-for-bit agreement with CPU path.

### Phase 5 – Golden Matrix Transformation (1–2 days)
1. Analyze matrix operations (64-bit mix, double precision usage).
2. Implement HIP kernel (likely per-thread matrix computation; limit global memory traffic).
3. Validate final 256-bit hash & harmony factor outputs vs CPU for random fixtures.

### Phase 6 – Integration & Tooling (1 day)
1. Wire HIP backend into `cosmic_harmony_gpu_backend.cpp`.
2. Update CMake to include HIP language, compile options, and installation paths.
3. Extend Python tests (`tests/`) with GPU detection and equivalence checks.
4. Add runtime logging (similar to `[autolykos_v2_hip]` messages) for diagnostics.

### Phase 7 – Optimization & QA (2 days)
1. Profile kernel occupancy, register usage, and memory throughput.
2. Apply shared-memory tiling/loop unrolling as needed.
3. Stress-test with long-running miners (24h soak).
4. Compile performance report (GPU vs CPU, various batch sizes, power draw if available).

## 5. Dependencies & Tooling
- HIP/ROCm 6.2+ (already configured for Autolykos).
- OpenSSL remains for CPU fallback; GPU path uses custom primitives.
- Optional references:
  - BLAKE3 GPU research repositories.
  - Keccak reference implementation (Keccak Code Package).
- Testing: `pytest`, custom Python scripts, `newgrp render` pattern for render group access.

## 6. Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| High complexity of multi-stage pipeline | Schedule slip | Incremental phases, rigorous unit tests per stage |
| Numerical drift in Golden Matrix math | Incorrect hashes | Use integer arithmetic where possible; add high-precision validation |
| ROCm driver quirks (amdgpu-arch errors) | Build instability | Follow Autolykos fixes (enable_language(HIP), runtime detection) |
| Performance regressions vs CPU | No tangible benefit | Continuous benchmarking, tune batch sizes, fallback strategy |

## 7. Validation Strategy
1. **Unit Tests:** Hash fixtures (input + nonce) covering diverse lengths; compare GPU vs CPU outputs.
2. **Integration Tests:** End-to-end miner run with forced GPU; verify block acceptance.
3. **Soak Tests:** 12–24h mining loop to detect memory leaks or drift.
4. **Cross-Hardware QA:** If possible, validate on multiple AMD GPUs (Navi, RDNA2).

## 8. Deliverables
- Source files:
  - `build_zion/cosmic_harmony/cosmic_harmony_gpu_backend.*`
  - `build_zion/cosmic_harmony/cosmic_harmony_hip.cpp`
  - Updated CMake, headers, and Python bindings.
- Documentation updates: build instructions, troubleshooting notes.
- Benchmark report (tables + charts summarizing CPU vs GPU gains).
- Test suite extensions with GPU coverage.

## 9. Estimated Timeline
| Phase | Estimate |
|-------|----------|
| 0–1   | 1.5–2 days |
| 2     | 2–3 days |
| 3     | 2–3 days |
| 4     | 1–2 days |
| 5     | 1–2 days |
| 6     | 1 day |
| 7     | 2 days |
| **Total** | **10–14 engineering days** (single engineer) |

## 10. Next Steps
1. Review plan with stakeholders; confirm scope and prioritization.
2. Allocate engineering resources for Phase 0 kick-off.
3. Set up tracking (Jira/Notion) with milestones per phase.
4. Begin Phase 0 tasks (code audit, refactoring CPU pipeline, fixtures).
