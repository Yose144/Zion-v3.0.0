# ZION Miner on SimpleMining OS (SMOS)

This guide integrates the V3 `zion-miner` directly into a SimpleMining OS rig as a custom miner package.

## Scope

- Target OS: SimpleMining OS (SMOS)
- Runtime: V3 canonical miner (`zion-miner`)
- Pool protocol: ZION stratum (`HOST:PORT`)

## Files added for SMOS integration

- `V3/scripts/smos/start-zion-miner.sh`
- `V3/scripts/smos/smos.env.example`

## 1) Build Linux miner binary

Build on Linux x64 (same architecture as your rig image):

```bash
cd V3
cargo build --release -p zion-miner
```

Output binary:

- `V3/target/release/zion-miner`

## 2) Prepare SMOS package folder

Create package content:

- `zion-miner` (Linux executable)
- `start-zion-miner.sh`
- `smos.env` (copy from example)

Example:

```bash
mkdir -p zion-smos
cp V3/target/release/zion-miner zion-smos/
cp V3/scripts/smos/start-zion-miner.sh zion-smos/
cp V3/scripts/smos/smos.env.example zion-smos/smos.env
chmod +x zion-smos/zion-miner zion-smos/start-zion-miner.sh
```

## 3) Configure wallet and defaults

Edit `zion-smos/smos.env`:

- `ZION_MINER_ID=zion1...` (required)
- `ZION_POOL_ADDR=77.42.71.94:8444` (or your preferred pool)
- `ZION_WORKER_NAME=` leave empty if you want SMOS rig name fallback
- optional tuning: `ZION_GPU_BACKEND`, `ZION_CUDA_WORK_CAP`, `ZION_CUDA_TPB`

## 4) SMOS custom miner command

Set run command to:

```bash
./start-zion-miner.sh
```

The script supports classic SMOS custom params too:

- `WAL` or `WALLET` -> wallet address
- `WORKER`, `WORKER_NAME`, or `rig_name` -> worker name
- `SERVER` + `PORT` -> pool host/port

If these are provided, they override missing values in `smos.env`.

## 5) Recommended first boot checks

After start, verify log header shows:

- Pool endpoint
- Wallet (`zion1...`)
- Worker name
- Profile (`pool`)

Then check pool stats endpoint and confirm worker appears.

## 6) Rig stability notes

- Keep `ZION_PROFILE=pool` for long-running rigs.
- For NVIDIA cards, test `ZION_CUDA_WORK_CAP` and `ZION_CUDA_TPB` per GPU model.
- Keep `ZION_NONCE_AUTOTUNE=true` unless you are benchmarking fixed windows.

## Troubleshooting

- Error: `ZION_MINER_ID is missing`
  - Set wallet in `smos.env` or pass `WAL`/`WALLET` from SMOS.
- Error: binary not executable
  - Run `chmod +x zion-miner start-zion-miner.sh`.
- Miner exits too quickly
  - Ensure package uses Linux binary built for rig architecture.
