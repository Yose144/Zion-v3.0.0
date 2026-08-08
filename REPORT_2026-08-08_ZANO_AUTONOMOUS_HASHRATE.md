# V31 Zano ProgPoW Autonomous Mining Report

**Date:** 2026-08-08  
**Scope:** Fix `gpu-external` hashrate reporting and validate autonomous Zano (ProgPoW) pool mining on HeroMiners without a hard-coded `--stream2-url`.

## 1. Goal

- Make `stream stats` report a non-zero hashrate for the `gpu-external` ProgPoW/Zano stream.
- Confirm that an autonomous run — using only `ZION_STREAM2_FORCE_COIN=ZANO` and the default `CoinProfile` pool — connects to HeroMiners, finds shares, and has them accepted by the pool.

## 2. Code Change

Modified `V31/L1/miner/src/runtime.rs`:

- `try_gpu_ext_share` now measures wall-clock batch time and calls `self.update_hashrate(StreamId::GpuExternal, nonces_tested, elapsed)` both when a share is found and when a batch returns no solution.
- `mine_auxpow_share_batch` now times the CPU fallback path and updates `update_hashrate(stream, ...)` for CPU-only / real-CPU algorithms (kheavyhash, verushash, etc.).
- For DAG placeholder CPU fallbacks (`progpow`, `kawpow`, `ethash`, etc.) the hashrate is intentionally **not** updated on a miss, because the current CPU fallback uses `hash_kawpow` and would distort the GPU hashrate display.

No other source files were touched for this specific fix.

## 3. Build

```bash
cd /home/zionserver/2.9.6-main/V31
cargo build --release -p zion-miner --features gpu-opencl
```

Build completed successfully.

## 4. Test Procedure

### 4.1 Autonomous Zano run (no `--stream2-url`)

```bash
cd /home/zionserver/2.9.6-main/V31
RUST_LOG=info \
ZION_NO_V3_TRINITY=1 \
ZION_STREAM2_FORCE_COIN=ZANO \
timeout 1200 ./target/release/zion-miner \
  --no-zion --no-cpu --gpu opencl \
  --wallet ZxCj5kQhNdW7xtt4hDTotBPGUsWYKRdtdPTFXjzFpPpf6q42rCVXcYnTtHRYGj3pzz2LUqCnvVoRzFn9zfZdCSzC1CkBiHYrg \
  --worker devin-test6 \
  2>&1 | tee /tmp/zano_herominers_devin-test6-2.log
```

### 4.2 Key observations

- The miner connected to the default Zano stratum pool from `CoinProfile::defaults()`:
  ```
  host=de.zano.herominers.com port=1110
  ```
- No `--stream2-url` or `--auxpow-pool` was supplied; the URL came from `ExternalCoin::Zano::default_pool()` via the scheduler.
- Stream 1 (ZION) and Stream 3 (CPU external) were disabled, leaving only Stream 2 (GPU external/Zano) active.

## 5. Results

### 5.1 Share accepted

```
2026-08-08T21:21:05.313398Z  INFO zion_miner::runtime: mined auxpow share accepted stream=GpuExternal coin=ZANO nonce=199936982
```

### 5.2 Non-zero hashrate in stream stats

```
2026-08-08T21:21:52.898667Z  INFO zion_miner: stream stats stream=gpu-external coin=ZANO accepted=1 rejected=0 hashrate=4798530.873093682 status=active
2026-08-08T21:21:52.898674Z  INFO zion_miner: hashrate=4768040 H/s submitted=1 accepted=1 rejected=0 jobs=0 reconnects=0 coin=ZANO pool=solo
```

The `gpu-external` hashrate is now non-zero and the aggregate hashrate reports the correct external coin (`ZANO`) and an accepted share count of `1`.

## 6. Unit Tests

Ran:

```bash
cd /home/zionserver/2.9.6-main/V31
cargo test -p zion-miner --features gpu-opencl --lib
```

- **113 passed**, **2 ignored** (`opencl_deeksha_nonce_zero_matches_cpu`, `opencl_ekam_v2_nonce_zero_matches_cpu` — require OpenCL GPU).
- One pre-existing, unrelated failure: `auxpow::gpu_opencl_full::tests::cuda_kernel_files_exist` fails because `kawpow_kernel.cu` is missing `__launch_bounds__`. This is not introduced by the hashrate changes and only affects the CUDA kernel source check.

## 7. Log Files

- Autonomous test log: `/tmp/zano_herominers_devin-test6-2.log`
- Earlier smoke test: `/tmp/zano_herominers_devin-test6.log`

## 8. Conclusion

- The `gpu-external` hashrate is now correctly updated from the GPU mining batch.
- Autonomous Zano selection (force coin + default `CoinProfile` pool) works end-to-end.
- The first accepted ProgPoW/Zano share on HeroMiners was observed at 21:21:05 UTC, with a displayed `gpu-external` hashrate of ~4.8 MH/s.

## 9. Next Steps / Follow-ups

- Investigate the `kawpow_kernel.cu` `__launch_bounds__` test failure if CUDA builds are needed.
- Calibrate the local hashrate estimate against the pool's API-reported hashrate if desired; the current display is `nonces_tested / elapsed` and may differ from pool-side effective hashrate.
- Commit the remaining Zano/ProgPoW runtime changes once the full set of uncommitted files is reviewed.
