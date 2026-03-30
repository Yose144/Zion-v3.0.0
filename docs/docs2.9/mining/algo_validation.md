# ZION Pool Algorithm Validation Checklist

This guide helps verify that the pool (v2.9) and both native + third-party miners interoperate across all officially supported proof-of-work algorithms.

## Supported algorithms & stratum aliases

| Algorithm        | Typical Miner Alias | Hardware Profile | Notes |
|------------------|---------------------|------------------|-------|
| `cosmic_harmony` | `cosmic`            | CPU/GPU native   | Use `pass=cosmic` on Stratum when a miner cannot send an explicit algo field. |
| `randomx`        | `rx/0`, `randomx`   | CPU (Monero-style) | Requires huge pages for best performance; default for XMRig-compatible clients. |
| `yescrypt`       | `yescrypt`          | CPU-friendly     | Password suffix `yescrypt` selects it via Stratum authorize. |
| `autolykos_v2`   | `autolykos2`        | GPU (Ergo-style) | Compatible with SRBMiner-MULTI (`--algorithm autolykos2`). |

## Native miner smoke test (all algos)

Run the universal miner against a staging or local pool build using the same wallet each time. Expect to see `✅ Share accepted` in the miner log within a few minutes.

```bash
# 1) Cosmic Harmony
python -m src.miners.zion_universal_miner \
  --pool 127.0.0.1:3333 \
  --wallet zion1youraddress \
  --worker native_cosmic \
  --algos cosmic_harmony

# 2) RandomX
python -m src.miners.zion_universal_miner \
  --pool 127.0.0.1:3333 \
  --wallet zion1youraddress \
  --worker native_randomx \
  --algos randomx

# 3) Yescrypt
python -m src.miners.zion_universal_miner \
  --pool 127.0.0.1:3333 \
  --wallet zion1youraddress \
  --worker native_yescrypt \
  --algos yescrypt

# 4) Autolykos v2
python -m src.miners.zion_universal_miner \
  --pool 127.0.0.1:3333 \
  --wallet zion1youraddress \
  --worker native_autolykos \
  --algos autolykos_v2
```

Tips:
- Launch the pool with DEBUG logs to confirm `protocol_handler` reports `Share accepted` per submission.
- For algorithms selected via password (Stratum), append `.algo` to the worker password, e.g. `password"yescrypt"`.

## Automated smoketest helper

When the pool is running locally (or on a low-latency staging host), you can let the new
`scripts/mining/algo_smoketest.py` script iterate through every algorithm using the native
hashing stack. Example:

```bash
python scripts/mining/algo_smoketest.py \
  --pool-host 127.0.0.1 \
  --pool-port 3333 \
  --wallet zion1youraddress \
  --worker smoketest \
  --algos cosmic_harmony,randomx,yescrypt,autolykos_v2 \
  --max-seconds 120 \
  --max-nonces 75000
```

Tips:
- Set `POOL_BASE_DIFFICULTY` to a small value (for example 10 000) before running to ensure
  the script can locate a valid share quickly.
- Use the `--protocol stratum` flag if you need to mimic SRBMiner’s subscription/authorize flow.
- Exit code is non-zero if any algorithm fails to find and submit a share before the timeout.

## SRBMiner-MULTI quickstart (GPU)

Example command lines for a remote pool at `pool.example.com:3333`:

```bash
# Autolykos v2 (GPU)
SRBMiner-MULTI --algorithm autolykos2 \
  --pool pool.example.com:3333 \
  --wallet zion1youraddress.native_gpu \
  --password x

# RandomX (CPU)
SRBMiner-MULTI --algorithm randomx \
  --pool pool.example.com:3333 \
  --wallet zion1youraddress.native_cpu \
  --password x
```

Validation checklist:
1. Watch pool logs for the corresponding session ID and ensure `Valid address: True` and `Share accepted` entries appear.
2. Confirm that the miner reports non-zero hashrate and accepted share counter increments.
3. For RandomX, verify that the pool announces the current `seed_hash`—miners should automatically refresh datasets.
4. For Autolykos, ensure that `difficulty_manager` re-targets to the higher GPU throughput (expect difficulty jumps after a few shares).

## Troubleshooting

- **Hash mismatch**: Double-check that the miner’s algorithm string matches pool expectations (`autolykos2`, `rx/0`, etc.).
- **Invalid address**: Addresses must start with `zion1`; normalize to lowercase before submitting.
- **Low hashrate on RandomX**: Enable huge pages and ensure the container‘s `/app/zion/mining` libraries are available.
- **SRBMiner rejects job**: Verify `extranonce2_size=8` in pool’s Stratum response; adjust SRBMiner’s `--xintensity` only after confirming shares are accepted.
