# ZION Miner — Autonomous Profit Router

> **Scope:** `V31/L1/miner/src/autonomous.rs` + `stream_profit.rs` + `runtime.rs`
> **Status (2026-08-27):** Code-complete and wired into the miner runtime. Unit tests pass. Some operational limitations still need attention (see §7).

## 1. What it does

The `AutonomousProfitRouter` automatically selects the most profitable external coin for the optional **Stream 2 (GPU AuxPoW / Boost 1)** and **Stream 3 (CPU AuxPoW / Boost 2)** mining streams. Stream 1 (ZION Deeksha) is always native and never switches.

The router is part of the **Trinity / Triple-Stream** miner architecture:

- **Stream 1** — ZION `EkamDeeksha` (always active unless `--no-zion`)
- **Stream 2** — GPU AuxPoW (autonomous or forced)
- **Stream 3** — CPU AuxPoW (autonomous or forced)

## 2. Activation

Autonomous mode is **off by default**. Enable it with either:

```bash
# environment variable
ZION_AUTONOMOUS=1

# or CLI flag
./target/release/zion-miner --pool 127.0.0.1:8444 --autonomous
```

> **Note:** The public miner build masks autonomous coin names in stdout for regulatory reasons (see `AutonomousProfitRouter::print_log` `#[cfg(feature = "public_build")]`). Decision logs are still kept in memory and sent to the pool as `CoinPreference` messages.

## 3. Configuration

### Environment variables

| Variable | Default | Meaning |
|----------|---------|---------|
| `ZION_AUTONOMOUS` | `0` | `1` or `true` enables autonomous switching. |
| `ZION_PROFIT_INTERVAL` | `300` | Re-evaluation interval in seconds (minimum 60s enforced by runtime). |
| `ZION_PROFIT_HYSTERESIS` | `15.0` | Hysteresis in **percent** (e.g. `15.0` = 15%, not `0.15`). A new coin must be at least this much more profitable before switching. |
| `ZION_ELECTRICITY_PRICE` | `0.12` | USD per kWh. Used to compute net profit = revenue − electricity cost. |
| `ZION_STREAM2_FORCE_COIN` | — | Force a specific GPU coin (e.g. `ZANO`, `KAS`). Overrides autonomous selection. |
| `ZION_STREAM3_FORCE_COIN` | — | Force a specific CPU coin (e.g. `XMR`, `VRSC`, `RTM`). Overrides autonomous selection. |
| `ZION_GPU_BACKEND` | `auto` | `cuda`, `opencl`, `metal`, `cpu`. Filters which coins are kernel-compatible. |
| `WHATTOMAINE_API_KEY` | — | If set, the oracle queries WhatToMine for live revenue per coin. |
| `NICEHASH_API_KEY` | — | If set, the oracle also queries the NiceHash public `simplemultialgo/info` endpoint. The value is currently a trigger, not an auth token. |

### CLI flags

```text
./target/release/zion-miner --autonomous --profit-interval 300
```

These are parsed in `V31/L1/miner/src/bin/zion-miner.rs` and propagated to `MinerConfig` (`V31/L1/miner/src/config.rs:180-190`).

## 4. Decision flow

`AutonomousProfitRouter` (defined in `V31/L1/miner/src/autonomous.rs`) performs the following steps every `ZION_PROFIT_INTERVAL`:

1. **Hardware filtering** — build a `HardwareProfile` and keep only coins that fit the detected (or compiled-in) GPU backend, VRAM budget, and CPU features.
2. **Profit fetch** — call `StreamProfitOracle::get_estimates()` (`V31/L1/miner/src/stream_profit.rs:84`).
   - If `WHATTOMAINE_API_KEY` is set and the per-minute rate limit allows, live revenue per coin is fetched from WhatToMine.
   - If `NICEHASH_API_KEY` is set, the public NiceHash `simplemultialgo/info` endpoint is queried. Setting it to any non-empty value currently triggers the fetch (the token is not sent).
   - If no key is set, or the network fetch fails / hits the rate limit, a fallback estimate from `CoinProfile` is used.
3. **Electricity cost** — `ElectricityConfig::daily_cost(power_watts)` subtracts the estimated 24h power cost.
4. **Net profit ranking** — for each compatible coin compute `revenue_usd_per_day − electricity_cost_usd_per_day`.
5. **Hysteresis switching** — only switch to a new coin if its net profit is at least `ZION_PROFIT_HYSTERESIS` % higher than the current coin (prevents flapping).
6. **Forced-coin override** — after ranking, `ZION_STREAM2_FORCE_COIN` / `ZION_STREAM3_FORCE_COIN` are re-read from the environment and override the selection.

The selected coins are then passed to the `AuxPoWScheduler` (`V31/L1/miner/src/auxpow/scheduler.rs`), which looks up the matching `CoinProfile` and primary stratum URL.

## 5. Filtering rules

Coin compatibility is controlled by `ExternalCoin` in `V31/L1/cosmic-harmony/src/profit.rs`:

- `is_gpu()` / `is_cpu()` — device category.
- `fits_vram(vram_bytes)` — DAG size + 512 MiB safety margin must fit the reported VRAM.
- `gpu_kernel_available(backend)` — which GPU backend has an OpenCL/CUDA/Metal kernel.
- `cpu_compatible(has_aes, has_avx2)` — AES-NI required for Monero, Verus/Raptoreum always CPU-compatible.
- `estimated_gpu_power_watts()` / `estimated_cpu_power_watts()` — used for electricity cost.

The full coin list and algorithm / pool mappings are in `ExternalCoin::ALL` (`V31/L1/cosmic-harmony/src/profit.rs:47-117`) and `ExternalCoin::default_pool()` (`profit.rs:382-418`).

## 6. Pool protocol — `CoinPreference`

When autonomous mode is on, the miner sends a `PoolMessage::CoinPreference` (`V31/L1/miner/src/pool_message.rs:52-66`) to the pool at the start of a session and on each switch:

```json
{
  "type": "coin_preference",
  "miner_id": "...",
  "gpu_coin": "KAS",
  "cpu_coin": "VRSC",
  "gpu_profit_usd_day": 1.23,
  "cpu_profit_usd_day": 0.45
}
```

The pool may use this message for telemetry or to influence job bundling.

## 7. Recent fixes (2026-08-27)

The following md-vs-code gaps were addressed in this pass and are now reflected in the code:

1. **Hardware profile uses actual detection.**
   - `V31/L1/miner/src/runtime.rs` now constructs `AutonomousProfitRouter` with `HardwareProfile::from_detected(&detected_hw, &config.gpu_backend)`.
   - VRAM, AES-NI, AVX2, CPU threads and the resolved GPU backend are taken from `auto_detect::detect_hardware()` (`V31/L1/miner/src/auto_detect.rs`), falling back to the conservative 6 GiB default only if detection reports zero VRAM.

2. **`CoinProfile::all()` covers every `ExternalCoin`.**
   - `CoinProfile::for_coin()` now infers `Device::Cpu` for CPU-only coins and `Device::Gpu` otherwise.
   - `CoinProfile::all()` returns a profile for every `ExternalCoin`.
   - `V31/L1/miner/src/runtime.rs` passes `CoinProfile::all()` to `refresh_auxpow()` (both startup and periodic re-evaluation), so any coin selected by the router can be scheduled.

3. **Disabled coins are filtered from autonomous selection and forced-coin overrides.**
   - `gpu_compatible_coins()` and `cpu_compatible_coins()` skip coins where `CoinProfile::for_coin(coin).disabled`.
   - `AutonomousProfitRouter::apply_forced_coins()` ignores disabled forced-coin env vars.
   - `CoinProfile::defaults()` includes `Pearl` as a disabled example.

4. **Forced-coin startup validation (MIN-001).**
   - `MinerRuntime::new` warns at startup if `ZION_STREAM2_FORCE_COIN` is not a GPU coin, has no kernel for the selected backend, is disabled, or has no known default pool.
   - The same checks are performed for `ZION_STREAM3_FORCE_COIN` against CPU compatibility / disabled / pool.

## 8. Remaining caveats

- Runtime validation in `MinerRuntime::new` only covers the env var value at startup. If `ZION_STREAM2_FORCE_COIN` / `ZION_STREAM3_FORCE_COIN` is changed while the process is running, `autonomous.rs` still re-reads it on each re-evaluation but now at least rejects disabled coins.
- `CoinProfile::for_coin()` fallback values are placeholders. Coins not in `CoinProfile::defaults()` get `profit_per_unit_usd = 0.01`; live API data is required for meaningful profit switching across the full coin set.

## 9. Tests

Unit tests are in the source files and can be run with:

```bash
cd V31
cargo test -p zion-miner --lib autonomous
cargo test -p zion-miner --lib stream_profit
cargo test -p zion-cosmic-harmony --lib profit
```

Key covered behaviours:

- `verus_is_cpu_compatible_and_not_gpu_selected`
- `verushash_and_randomx_are_cpu_only`
- `forced_stream2/3_env_var_works`
- `select_stream2_picks_highest_net_profit`
- `select_stream2_hysteresis_keeps_current`
- `build_coin_preference_returns_message`
- `fallback_estimates_cover_all_coins`
- `parse_whattomine_maps_known_tags`
- `parse_nicehash_maps_algorithms_to_coins`

## 10. References

- `V31/L1/miner/src/autonomous.rs` — router implementation
- `V31/L1/miner/src/stream_profit.rs` — WhatToMine / NiceHash / fallback oracle
- `V31/L1/miner/src/config.rs:70-83,180-190` — env/CLI configuration
- `V31/L1/miner/src/runtime.rs:857-916,1147-1173` — runtime integration and re-evaluation loop
- `V31/L1/miner/src/auxpow/scheduler.rs` — `AuxPoWScheduler` / `set_gpu` / `set_cpu`
- `V31/L1/miner/src/pool_message.rs:51-66` — `CoinPreference` wire format
- `V31/L1/cosmic-harmony/src/profit.rs` — `ExternalCoin`, `CoinProfile`, `ProfitRouter`
- `docs/3.2/SECURITY_AUDIT_3.2.md` — `MIN-001` forced-coin validation note
- `docs/WP-Mainet/Trinity_Engine.md` — high-level Trinity / Boost stream overview
