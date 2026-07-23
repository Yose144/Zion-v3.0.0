# BeamHash III GPU Solver — Readiness Report

> Status: **ready for first live test on AMD RX 5600 (6 GB VRAM)**  
> Commit: `b7873f321`  
> Author: Devin integration  

## What is implemented

1. **OpenCL kernel** `AuXpow/csrc/opencl/beamhash_solver.cl`  
   Full Wagner's algorithm for BeamHash III, adapted from `BeamMW/opencl-miner` tag `opencl-miner_1.0.82`:
   - `cleanUp` — zeroes bucket counters and result counter
   - `beamHashIII_seed` — generates 2^25 initial SipHash-2-4 rows
   - `beamHashIII_R1` … `beamHashIII_R5` — five collision rounds

2. **Rust integration** in `AuXpow/src/gpu_miner.rs`  
   - `GpuMiner::mine()` now routes `beamhash` / `beamhash_beam` to the new `mine_beamhash_solver()`
   - allocates two hash tables (`4096 × 8720 × ulong8`, each ~2.3 GB), 20 480 counters, 324 result words
   - enqueues the six kernels with the same work sizes as the reference miner
   - reads up to 10 candidate solutions and validates each with `hash_beamhash()` against the target
   - returns a `GpuFoundShare` whose `solution` is 104 bytes (100 bytes compressed indices + 4 bytes extra nonce)

3. **`beamhash.rs`** — `compute_prepow()` is now `pub(crate)` so the GPU solver can derive the 4-word prePow state from `header || nonce`.

4. **Debug environment** `edge-deploy/config/debug-beam-environment.sh`  
   Isolated from the Edge main pool. Sets:
   - `ZION_POOL_AUXPOW_ENABLED=1`
   - `ZION_POOL_AUXPOW_COIN=BEAM`
   - `ZION_POOL_AUXPOW_WALLET_BEAM=<BEAM address>`

## Build / check commands

```bash
cd /Users/yeshuae/Projects/2.9.6

cargo check -p zion-auxpow --features gpu-opencl
cargo check -p zion-miner --features gpu-opencl,native-hashers
cargo check -p zion-pool-server
```

All three passed before commit `b7873f321`.

## How to test on RX 5600

### 1. Source the debug environment

```bash
cd /Users/yeshuae/Projects/2.9.6
source edge-deploy/config/debug-beam-environment.sh
```

This switches `ZION_POOL_AUXPOW_COIN` to `BEAM` and loads the BEAM payout wallet. It does **not** touch the Edge main-pool environment.

### 2. Start a local pool server (to feed jobs to the miner)

```bash
cargo run --release -p zion-pool-server --features gpu-opencl,native-hashers
```

### 3. In another shell, start the miner against the local pool

Point it at `127.0.0.1:8444` with `--gpu-coin BEAM`:

```bash
# build the miner if not already built
cargo build --release -p zion-miner --features gpu-opencl,native-hashers

# run example (adjust miner_id / worker as needed)
./target/release/zion-miner \
  --pool 127.0.0.1:8444 \
  --worker-name beamtest \
  --gpu-coin BEAM
```

Alternatively you can use the existing Edge/SMOS scripts if a local pool is already running.

### 4. Watch the logs

Look for:

```
auxpow_gpu_share_found algorithm=beamhash nonce=... hash_first8=... elapsed_ms=...
```

If the GPU finds a solution that meets the target, it will be logged there.

## Hardware requirements / warnings

| Item | Value |
|------|-------|
| GPU memory required | **~4.5 GB VRAM** (2× ~2.3 GB hash tables + small buffers) |
| Work-group size | 256 (set by `-DwgSize=256` default in the kernel) |
| Batch size | BeamHash III is not batched per nonce; each call scans one nonce fully |
| RX 5600 | 6 GB should be enough, but close to the limit; close other GPU consumers |

On integrated / APU graphics or GPUs with < 4.5 GB the buffer allocation will fail.

## Known TODOs / limitations

1. **V3 miner share routing**  
   `GpuFoundShare.solution` (104 bytes) is produced, but `V3/L1/miner/src/gpu_backend.rs` currently maps the result to `(nonce, hash, mix_hash)` and discards the `solution` field. `ExternalShareResult` does not carry a 104-byte solution, so the pool's `submit_share()` cannot yet send the correct `output` to BeamStratum.

   **Workaround for isolated GPU testing:** the solver can still run and validate locally; the `auxpow_gpu_share_found` log proves the kernel is working.

2. **Header padding**  
   `opencl_external::mine_batch()` pads short headers to 80 bytes before calling `GpuMiner::mine()`. For Beam the pre-PoW header is the raw `input` from stratum (often 32 bytes). Padding with zeros will produce a wrong `prePow` and no valid solutions. For real e2e the miner path must call `GpuMiner::mine()` with the raw header.

3. **Result parsing**  
   The kernel writes at most 10 solutions into the 324 `uint` results buffer. The host parses them as `u32[4 + pos*32 .. 4 + (pos+1)*32]`, takes the first 100 bytes, and runs `hash_beamhash(full_header, indices_100)`.

## Files changed

- `AuXpow/csrc/opencl/beamhash_solver.cl` (new)
- `AuXpow/src/gpu_miner.rs`
- `AuXpow/src/beamhash.rs`
- `edge-deploy/config/debug-beam-environment.sh` (new)
- `AGENTS.md`
- `docs/3.0.6/FullRevenueAuxPow.md`

## Next steps

1. Run the local-pool + miner test on the RX 5600.
2. Confirm `auxpow_gpu_share_found` appears (target check is local, no network submission yet).
3. If the GPU solver proves stable, wire the 104-byte solution through `V3/L1/miner` → `AuxPowClient::submit_share()` for real BeamStratum submission.
