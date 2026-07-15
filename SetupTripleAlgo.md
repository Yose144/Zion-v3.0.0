# Triple-Algorithm GPU Mining Setup Guide

**GPU:** AMD RX 5700 XT (gfx1010, 6 GB VRAM, 18 CUs)
**Software:** zion-miner v3.0.6 with `gpu-opencl,native-hashers` features
**Algorithms:** Deeksha (ZION) + ProgPow (EPIC) + VerusHash (VRSC)

## Optimal Configuration

```bash
# Deeksha (ZION) — minimal GPU work_size to free VRAM + GPU time for external
export ZION_GPU_WORK_SIZE=1024          # 256 MiB scratchpad (vs default 2048 MiB)

# External GPU (ProgPow/KawPow) — large work_size for max throughput
export ZION_SECONDARY_GPU_WORK_SIZE=4194304   # 4M (capped internally by VRAM)

# GPU backend
export ZION_BACKEND=opencl

# Pool
export ZION_POOL=62.171.141.136:8444
```

## Build Command

```bash
cargo build --release --features gpu-opencl,native-hashers -p zion-miner
```

> **Important:** Both `gpu-opencl` AND `native-hashers` features are required.
> Without `native-hashers`, DAG loading code is compiled out and ProgPow/KawPow
> cannot function. The `full` feature alias does NOT include `native-hashers`.

## Launch Command

```bash
ZION_GPU_WORK_SIZE=1024 \
ZION_SECONDARY_GPU_WORK_SIZE=4194304 \
target/release/zion-miner \
  --pool 62.171.141.136:8444 \
  --wallet <your-zion-address> \
  --worker <worker-name> \
  --gpu opencl \
  --no-tui \
  --loops 1000000
```

## Performance Results (RX 5700 XT, 6 GB VRAM)

| Config | Deeksha WS | Scratchpad | Ext WS | ProgPow MH/s | Notes |
|--------|-----------|-----------|--------|-------------|-------|
| Default | 8192 | 2048 MiB | 262K | ~1.05 | Original baseline |
| 8k+1M | 8192 | 2048 MiB | 1M | ~1.1 | nonce_offset bug |
| 4k+1M | 4096 | 1024 MiB | 1M | ~2.1 | Less VRAM pressure |
| **1k+4M (optimal)** | **1024** | **256 MiB** | **4M** | **~7.1** | **Best config** |

### Key Findings

1. **Deeksha work_size is the main bottleneck for ProgPow hashrate.**
   - 3 deeksha GPU streams share the same GPU as the ProgPow stream.
   - Larger deeksha work_size = more GPU time consumed by deeksha = less for ProgPow.
   - Reducing from 8192 → 1024 gives ~6x ProgPow speedup.

2. **Deeksha hashrate trade-off is acceptable.**
   - At work_size=1024, deeksha still finds ~42-46 shares/min at diff=1.
   - ZION difficulty is low enough that even minimal GPU work is sufficient.

3. **AuxPow GpuMiner internal work_size cap.**
   - The AuXpow GpuMiner auto-detects max work_size based on VRAM (~3.1M for 6GB).
   - Setting `ZION_SECONDARY_GPU_WORK_SIZE` above this cap has no benefit.
   - The kernel processes `min(batch_size, internal_work_size)` nonces per batch.

4. **VRAM budget (6 GB):**
   - Deeksha scratchpad: 256 MiB (1024 × 256 KiB)
   - ProgPow DAG: ~2 GB (epoch 120)
   - Driver/desktop: ~1 GB
   - Work buffers: ~1 GB
   - Total: ~4.3 GB (safe margin)

## Bugs Fixed (commit e5a9a53bf)

### Bug 1: nonce_offset reset on every pool job re-send
The pool re-sends the same job every ~1 second. The `nonce_offset` was
reset to 0 on each re-send, causing the GPU to re-scan the same nonces
endlessly. Fix: only reset `nonce_offset` when `job_id` or `height`
actually changes.

### Bug 2: nonce_offset over-count
The V3 `work_size` (4M) exceeded the AuXpow GpuMiner's internal
`work_size` (~3.1M). The `nonce_offset` was advanced by the V3 work_size
instead of the actual nonces processed, skipping ~25% of nonce space.
Fix: use `br.nonces_tested` from the GPU backend result, which now
correctly reports `min(actual_batch, miner.internal_work_size())`.

## Troubleshooting

### "OpenCL support not compiled"
Rebuild with `--features gpu-opencl,native-hashers`. The binary may have
been overwritten by a build without these features.

### GPU crash / amdgpu context lost
- Reduce `ZION_SECONDARY_GPU_WORK_SIZE` to 1048576 (1M)
- Reduce `ZION_OCL_VRAM_PCT` to 40 (default 50)
- Check VRAM: `rocm-smi --showmeminfo vram`

### No ProgPow shares found
- EPIC share difficulty is very high (~2.5 billion)
- At 7 MH/s, expected time per share: ~357 seconds (~6 minutes)
- Run for at least 10 minutes to find a share

### Pool connection refused
- Check that zion-node is running: `ssh zion-new 'systemctl status zion-node'`
- Check that zion-pool is running: `ssh zion-new 'systemctl status zion-pool'`
- Node RPC must be on 127.0.0.1:9443 (nginx proxies 8443 → 9443)

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_GPU_WORK_SIZE` | 262144 | Deeksha GPU work_size (threads per batch) |
| `ZION_SECONDARY_GPU_WORK_SIZE` | 262144 | External GPU (ProgPow/KawPow) work_size |
| `ZION_AUXPOW_GPU_WORK_SIZE` | auto | AuXpow GpuMiner internal cap (auto-detected) |
| `ZION_AUXPOW_GPU_VRAM_PCT` | 50 | Percentage of VRAM for AuXpow buffers |
| `ZION_OCL_VRAM_PCT` | 50 | Percentage of VRAM for deeksha scratchpad |
| `ZION_BACKEND` | auto | GPU backend: auto, opencl, cuda, metal, cpu |
