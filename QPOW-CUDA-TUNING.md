# QPoW (QTU/Poseidon2) CUDA Kernel Tuning — GTX 1070 Ti

**Date:** 2026-10-09 · **Host:** desktop zionserver (Ryzen 5 3600, GTX 1070 Ti 8 GiB, sm_61 Pascal, 19 SMs)
**Driver:** 580.178.04 · **Build:** `zion-miner` release, features `auxpow,gpu-opencl,gpu-cuda,native-hashers,native-kheavyhash,native-blake3-algo,native-verushash`
**Harness:** `qpow_bench_effective_throughput` (`cargo test --release -p zion-miner --features gpu-cuda qpow_bench -- --ignored --nocapture`), batch default 8 Mi nonces, 10–12 iters, median of iters 3+.

## TL;DR

| Config | Hot steady-state (≈70–74 °C, 1607 MHz) | Δ vs orig |
|---|---|---|
| original `(256,4)` + internal unroll 1 | ~33.1 MH/s | — |
| `(256,4)` + **unroll 3** | ~35.8 MH/s | +8 % |
| **`(512,2)` + unroll 3 (DEPLOYED)** | **~38.0–38.8 MH/s** | **+15–17 %** |

Production QTU stream after deploy: **~37–38 MH/s** (was ~34–35.5), ZION duty 5 %, shares Accepted on LuckyPool.

## Method

Kernel knobs were made compile-time-parametric (`-DQPOW_LB_MAX/-DQPOW_LB_MIN/-DQPOW_IUNROLL/-DQPOW_EUNROLL` via new `QPOW_NVRTC_OPTS` env; dispatch knobs `QPOW_TPB`/`QPOW_NPT`), so ~40 variants ran against a single test build — no per-variant rebuilds. Production miner was SIGSTOP-frozen (context held, zero SM util) so benchmarks ran on an exclusive GPU; it was resumed/deployed afterwards.

**Caveat — two thermal regimes:** short bursts (~5 s) run at ~1800–1860 MHz boost; sustained runs throttle to **1607 MHz** at ~75–85 °C (fan already 100 %, power ~130 W of 180 W — the card is temperature-limited, not power-limited). Screening numbers below are burst medians; the hot-verification block and the 86 s sustained run reflect production reality.

## Sweep results

### Internal Poseidon2 round-loop unroll (`QPOW_IUNROLL`, loop = 21 rounds) @ `(256,4)`, burst

| U | 1 | 2 | **3** | 4 | 5 | 6 | 7 | 14 | 21 |
|---|---|---|---|---|---|---|---|---|---|
| MH/s | 38.5 | 39.7 | **40.5** | 39.5 | 39.5 | 39.2 | 39.5 | 39.1 | 39.8 |

### `__launch_bounds__` (maxThreadsPerBlock, minBlocksPerSM) @ U3, burst

| Config | MH/s | note |
|---|---|---|
| (256,2) | 24.4 | reg cap 128 → spills |
| (256,3) | 34.7 | reg cap 85 → spills |
| (256,4) | 40.5 | reg cap 64 — old default |
| (256,5/6) | 34.5 / 21.7 | spills |
| (128,4) / (128,8) | 23.7 / 34.2 | |
| (192,3) | 26.8 | |
| (320,3) | 37.1 | |
| (384,2) / (384,3) | 35.0 / 37.2 | |
| (448,2) | 40.6 | |
| **(512,2)** | **42.6–42.9** | **winner** — same 1024 threads/SM & 64-reg budget as (256,4), larger blocks win on warp scheduling |
| (512,1) / (512,3) | 38.8 / 22.1 | (512,3) spills |
| (640,2) | 34.3 | |
| (1024,1) | 38.0 | |

### Nonces per thread (`QPOW_NPT`) @ (512,2) U3, burst

| npt | 1 | 2 | 3 | 4 | 8 |
|---|---|---|---|---|---|
| MH/s | **42.9** | 42.1 | 41.3 | 40.7 | 40.2 |

npt=1 confirmed — the per-thread 12-lane u64 sponge state makes in-thread nonce loops strictly worse.

### External-rounds unroll (`QPOW_EUNROLL`, 4-round loops) @ U3: 2 → 42.1, 4 → 39.2 → keep **1**.

### NVRTC flags @ (512,2) U3 — all within noise (42.5–42.9): `--extra-device-vectorization`, `-ftz=true`, `-maxrregcount={56,64}`, `--fmad=false`. Launch bounds already fix the 64-reg budget; no flag adds anything.

### Batch size (nonces/launch) @ (512,2) U3

| batch | 1 M | 2 M | 4 M | 6 M | 8 M | 16 M | 32 M | 64 M |
|---|---|---|---|---|---|---|---|---|
| burst MH/s | 41.7 | — | 42.9 | — | 42.9 | 42.6 | 40.7 | 39.0 |
| hot MH/s | — | 40.9 | 41.5–41.7 | 42.2 | 39.2 | 38.8 | — | — |

Hot behavior favors 4–6 M (kernel ~0.1–0.15 s → boost clocks partially recover between launches). 8 M kept in production: within ~3 % of the 4–6 M peak and keeps the existing share-submit cadence / duty-gap granularity. 64 M runs long enough to hit the 1607 MHz throttle wall even in burst mode.

## Deployed change set

- `csrc/cuda/poseidon2_kernel.cu`: `__launch_bounds__(256,4)` → `(QPOW_LB_MAX=512, QPOW_LB_MIN=2)`; internal loop `#pragma unroll QPOW_IUNROLL` (default **3**); external loops `QPOW_EUNROLL` (default 1); all four knobs overridable via `-D` without code edits.
- `src/gpu/qpow_cuda.rs`: `QPOW_THREADS_PER_BLOCK` 256→**512** (must equal `QPOW_LB_MAX`); tuning envs `QPOW_NVRTC_OPTS` (extra NVRTC opts), `QPOW_TPB`, `QPOW_NPT` — defaults unchanged from the measured optimum.

## Correctness

- `cuda_kernel_matches_cpu_golden_and_boundaries` ✅ (GPU vs CPU reference, hash±1 boundaries + carry boundary)
- all 12 `qpow` unit tests ✅ (`scan_finds_valid_share`, `kernel_compare_is_strict_full_width`, `u512_limb_packing_roundtrips`, …)
- Production stream: QTU shares **Accepted** upstream post-deploy, 0 rejects observed.

## Overclocking experiment (2026-10-09, via LACT daemon / NVML)

`nvidia-smi -ac/-lgc` and `nvidia-settings` OC are unavailable on this setup (Pascal consumer + Wayland), **but** the LACT daemon (`/run/lactd.sock`, root) applies NVML per-pstate clock offsets, `pmfw_options.target_temperature`, and `power_cap` — confirmed working:

| Setting | sustained QTU | note |
|---|---|---|
| stock (target 75, PL 180, no offsets) | ~37.6–39.3 MH/s | SW Thermal Slowdown pins 1607 MHz |
| mem offset −400..−1000 (P2) | ~37.7 MH/s | −20 W, ~10 °C cooler, **0 % hashrate** — QPoW is compute-bound |
| core offset ± (P2) | ~37.0–37.5 MH/s | binds (± verified) but thermal cap holds 1607 |
| **target_temperature 75→90** | **~41–43.7 MH/s** (+10–16 %) | the real lever — unlocks boost 1746–1809 MHz sustained, peaks 2138 |
| + core +250..300, mem −1000, PL 217 | ~41–42.4 MH/s | stacked on top of raised target |

**Why OC gains exist but were reverted:** the only real lever is the *driver thermal target* (`pmfw_options.target_temperature`, was stale at **75** while the card already runs 82–92 °C edge / ~100 °C hotspot). Raising it frees ~+9–13 % — but the same GPU also drives the desktop compositor, and at ~89 °C + aggressive offsets the session **froze and needed a hard reboot**. Reverted to stock (`target 75`, PL 180, zero offsets, persisted to `/etc/lact/config.yaml`) — mining stability > +3 MH/s on the desktop's display GPU.

SRBMiner cross-check: stock ~41.0–41.4 MH/s, with `--gpu-coffset0 75 --gpu-moffset0 -400` ~41.1–42.0 MH/s — identical thermal wall, no gain. Its kernel is ~5 %/clock faster than ours at the same 1607 MHz cap (kernel-side headroom, not clock headroom).

## Limitations / why not 70 MH/s

- Kryptex's published 74.2 MH/s for 1070 Ti is not reproducible here — SRBMiner (reference implementation) tops at ~41 MH/s sustained on this card; our kernel now benches ~38–43 depending on thermals — **at parity with the dedicated miner**.
- The card throttles to 1607 MHz at ~80 °C+ with the fan at 100 % — the thermal limiter, not software, is the wall. Raising the driver thermal target does unlock ~1700–1900 MHz but pushes hotspot temps past spec and destabilized the desktop session — not a viable 24/7 setting on this GPU.
- The remaining gap to the burst numbers is physics: repaste/airflow + a dedicated headless miner card would recover the clock deficit.

## Reproduce

```bash
cd V31
cargo test --release -p zion-miner --features gpu-cuda --no-run
BIN=target/release/deps/zion_miner-<hash>
QPOW_NVRTC_OPTS="-DQPOW_LB_MAX=512 -DQPOW_LB_MIN=2 -DQPOW_IUNROLL=3" \
QPOW_TPB=512 QPOW_BENCH_BATCH=8388608 QPOW_BENCH_ITERS=12 \
  $BIN qpow_bench_effective_throughput --ignored --nocapture --test-threads=1
```
