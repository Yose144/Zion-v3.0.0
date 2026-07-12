# AuXpow GPU Kernel Roadmap

> Status: **Phase 2 complete** — multi-algo OpenCL harness integrated with `zion-miner`.  
> Real algorithm kernels: **Blake3 improved**, remaining algorithms are CPU-matching placeholders.

## Current state

The GPU miner lives in `AuXpow/src/gpu_miner.rs` and is gated behind the
`gpu-opencl` feature.  It loads OpenCL kernels from `AuXpow/csrc/opencl/*.cl`
and dispatches them by algorithm string.  The V3 miner routes external AuxPoW
algorithms to this harness via `V3/L1/miner/src/gpu_backend.rs::opencl_external`.

| Algorithm | Kernel file | Status | Notes |
|-----------|-------------|--------|-------|
| `blake3` / `blake3_alph` / `blake3_dcr` | `blake3_kernel.cl` | **Improved** | Multi-block Blake3, double-Blake3 for ALPH, correct chunk flags. |
| `kheavyhash` / `kheavyhash_kas` | `kheavyhash_kernel.cl` | Placeholder | SHA3-only; real matrix multiply not yet implemented. |
| `autolykos` / `autolykos_erg` | `autolykos_kernel.cl` | Placeholder | SHA3-only; no memory-hard Autolykos v2 DAG. |
| `kawpow` / `kawpow_rvn` / ... | `kawpow_kernel.cl` | Placeholder | SHA3-only; no ProgPoW DAG or program loops. |
| `ethash` / `etchash` / `ethash_etc` | `ethash_kernel.cl` | Placeholder | SHA3-only; no Ethash DAG lookups. |

All placeholder kernels intentionally match the CPU placeholder hashers in
`AuXpow/src/external_hashers.rs`, so the ZION pool validates submitted shares
consistently.  This is fine for integration testing, but **hashrate will be
near-zero against real external pools**.

## Why real kernels are hard

Each memory-hard or ProgPoW-style algorithm needs host-side support that is at
least as complex as the kernel itself:

1. **Ethash / Etchash / KawPow**
   - Build a **light cache** from the seed hash.
   - Build a **full DAG** (1–4 GB+) every epoch.
   - Pass the DAG as a `__global` buffer to the GPU.
   - KawPow additionally needs a **ProgPoW program sequence** generated per
     block and a cached DAG subset.

2. **Autolykos v2**
   - Pre-compute **prehashes** from block height and seed.
   - Build a **512 MB+ dataset** per epoch.
   - The kernel iterates over the dataset with blake2b-based index derivation.

3. **kHeavyHash**
   - Generate a deterministic **64×64 uint64 matrix** from the pre_pow_hash.
   - The matrix is small (~32 KB) and can be computed per block on the host or
     per nonce on the GPU, but the real algorithm requires a specific matrix
     expansion function.

For a production deployment, each of these needs its own epoch/cache manager
and DAG allocator.

## Reference implementations found online

These open-source miners contain production OpenCL kernels and host-side logic
that can be adapted incrementally:

### Ethash / Etchash
- **ethminer** — `libethash-cl/kernels/cl/ethash.cl`
  - URL: https://github.com/ethereum-mining/ethminer/blob/master/libethash-cl/kernels/cl/ethash.cl
  - Includes `search` kernel and `GenerateDAG` kernel.
- **Genoil/cpp-ethereum** — `libethash-cl/ethash_cl_miner_kernel.cl`
  - URL: https://github.com/Genoil/cpp-ethereum/blob/110/libethash-cl/ethash_cl_miner_kernel.cl
  - Wave-optimized search with local-memory sharing.

### KawPow (RVN / CLORE / EVR / MEWC)
- **kawpowminer** — `libethash-cl/CLMiner_kernel.cl`
  - URL: https://github.com/RavenCommunity/kawpowminer/blob/master/libethash-cl/CLMiner_kernel.cl
  - ProgPoW search kernel and DAG item generator.

### kHeavyHash (KAS)
- **tmrlvi/kaspa-miner** / **ZorkNetwork/kheavyhash-miner**
  - URL: https://github.com/tmrlvi/kaspa-miner
  - URL: https://github.com/ZorkNetwork/kheavyhash-miner
  - Rust + OpenCL/CUDA kHeavyHash implementation.
- **luminousmining/miner** — `sources/algo/kheavyhash/opencl/kheavyhash.cl`
  - URL: https://github.com/luminousmining/miner
  - Modular OpenCL kernel with shared helpers (`rotate_byte.cl`,
    `load_store_le.cl`).

### Autolykos v2 (ERG)
- **mhssamadani/Autolykos2_AMD_Miner** — `MiningKernel.cl`, `PreHashKernel.cl`
  - URL: https://github.com/mhssamadani/Autolykos2_AMD_Miner
  - Full OpenCL Autolykos v2 miner with prehash and search kernels.
- **luminousmining/miner** — `sources/algo/autolykos_v2/opencl/`
  - URL: https://github.com/luminousmining/miner
  - Modular resolver kernels and benchmarks.

## Proposed integration plan

Because each algorithm needs a non-trivial host-side epoch/cache manager, the
recommended path is **one algorithm per follow-up phase**:

### Phase 3a — kHeavyHash real matrix
- Smallest scope: only a 64×64 matrix is needed, no large DAG.
- Add host-side matrix generator in Rust (`zion_auxpow::kheavyhash_matrix`).
- Pass the matrix as a `__global` or `__constant` buffer.
- Replace the identity placeholder in `kheavyhash_kernel.cl` with the real
  matrix-vector multiply.
- KAT: compare GPU output against a CPU reference for a few known nonces.

### Phase 3b — Autolykos v2
- Add `autolykos_v2::dataset` builder in Rust.
- Pre-compute the dataset and upload it as a GPU buffer per epoch.
- Replace `autolykos_kernel.cl` with the memory-hard search kernel.
- KAT: verify against CPU reference.

### Phase 3c — Ethash / Etchash
- Port `ethminer` DAG builder to Rust.
- Generate light cache and full DAG per epoch.
- Replace `ethash_kernel.cl` with the real DAG-lookup kernel.
- KAT: compare against a known Ethereum Classic test vector.

### Phase 3d — KawPow
- Port `kawpowminer` ProgPoW program generator and DAG cache builder.
- This is the most complex because every block changes the program sequence.
- Recommended last.

## Design constraints for Zion integration

1. **No external C++ dependencies in the main build.**  All DAG/cache builders
   should be pure Rust, possibly behind a feature flag.
2. **Feature gate everything.**  The `gpu-opencl` feature must remain optional.
3. **Keep CPU fallback.**  Every GPU kernel must have a matching CPU path so
   the pool stays functional even if the GPU backend is unavailable or the
   kernel returns an error.
4. **Pool validation must stay in sync.**  When a GPU kernel is updated, the
   matching CPU hasher in `AuXpow/src/external_hashers.rs` must produce the
   same hash for the same inputs, otherwise the pool will reject valid GPU
   shares.
5. **OpenCL source files are loaded at runtime.**  Kernels live in
   `AuXpow/csrc/opencl/`.  The loader reads them via `CARGO_MANIFEST_DIR`, so
   installed binaries must ship these files alongside the executable (or
   embed them with `include_str!` in a future refactor).

## Immediate next steps

1. Pick **one** algorithm to make real (kHeavyHash is recommended because it
   needs no multi-gigabyte DAG).
2. Implement the host-side helper in Rust and a matching OpenCL kernel.
3. Add a kernel-level known-answer test that runs when `gpu-opencl` is
   enabled and an OpenCL device is present.
4. Update this roadmap document with the results.

## Test commands

```bash
# CPU path
cargo test -p zion-auxpow
cargo test -p zion-pool --bin server

# GPU path (requires OpenCL runtime + device)
cargo test -p zion-auxpow --features gpu-opencl
cargo test -p zion-miner --features gpu-opencl
```
