# ZION V31 Trinity Miner — Windows 11 Setup Guide

**Complete step-by-step guide for building and running the ZION Trinity miner on Windows 11.**  
Same configuration as the Linux Desktop miner: ZION (GPU) + ZANO (GPU) + VRSC (CPU).

**Last updated:** 2026-08-10  
**Tested on:** Windows 11 22H2/23H2, NVIDIA GPU (CUDA 12.x)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Install Rust](#2-install-rust)
3. [Install CUDA Toolkit](#3-install-cuda-toolkit)
4. [Install Visual Studio Build Tools](#4-install-visual-studio-build-tools)
5. [Clone the Repository](#5-clone-the-repository)
6. [Build the Miner](#6-build-the-miner)
7. [Wallet Setup](#7-wallet-setup)
8. [Run the Miner](#8-run-the-miner)
9. [Auto-Start on Boot (Task Scheduler)](#9-auto-start-on-boot-task-scheduler)
10. [Environment Variables Reference](#10-environment-variables-reference)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

| Component | Requirement |
|-----------|-------------|
| **OS** | Windows 11 (64-bit) |
| **GPU** | NVIDIA GPU with CUDA compute capability ≥ 5.0 (Maxwell+) |
| **VRAM** | ≥ 4 GB (8 GB recommended for ZION+ZANO GPU sharing) |
| **RAM** | ≥ 8 GB (16 GB recommended) |
| **CPU** | ≥ 4 cores (multi-threading helps VRSC VerusHash) |
| **Disk** | ~10 GB free (repo + build + CUDA toolkit) |

**Supported GPUs (tested):**
- GTX 1070 Ti (8 GB) — work_size=4096, ~21.5 MH/s total
- RTX 3060 (12 GB) — work_size=8192, ~35+ MH/s total
- RTX 4070 (12 GB) — work_size=8192, ~50+ MH/s total

---

## 2. Install Rust

1. Open **PowerShell** (not CMD).
2. Download and run rustup:
   ```powershell
   winget install Rustlang.Rustup
   ```
   Or manually:
   ```powershell
   Invoke-WebRequest -Uri https://win.rustup.rs/x86_64 -OutFile rustup-init.exe
   .\rustup-init.exe
   ```
3. Restart your terminal after installation.
4. Verify:
   ```powershell
   rustc --version
   cargo --version
   ```
   You should see `rustc 1.7x.x` and `cargo 1.7x.x`.

---

## 3. Install CUDA Toolkit

The miner uses `cudarc 0.12` which requires **CUDA 12.4+** runtime.

1. Download **CUDA Toolkit 12.4+** from NVIDIA:
   - https://developer.nvidia.com/cuda-12-4-0-download-archive
   - Select: Windows → x86_64 → 11 → exe (local)
2. Run the installer. Use **Express Installation** (default).
3. Verify CUDA is installed:
   ```powershell
   nvcc --version
   ```
   You should see `Cuda compilation tools, release 12.4`.
4. Verify `nvidia-smi` works:
   ```powershell
   nvidia-smi
   ```
   This should show your GPU name, driver version, and CUDA version.

> **Note:** You also need the **NVIDIA Display Driver** (≥ 550.x for CUDA 12.4).  
> If you have GeForce Experience or the NVIDIA driver installed, you likely already have this.

---

## 4. Install Visual Studio Build Tools

Rust on Windows requires MSVC linker and Windows SDK.

1. Download **Visual Studio Build Tools 2022**:
   - https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. Run the installer.
3. Select **Desktop development with C++** workload.
4. Ensure these components are checked:
   - MSVC v143 - VS 2022 C++ x64/x86 build tools
   - Windows 11 SDK (or Windows 10 SDK)
   - C++ CMake tools for Windows
5. Click **Install** (~6 GB download).
6. Restart your terminal.

---

## 5. Clone the Repository

```powershell
cd C:\
git clone https://github.com/Yose144/Zion-v3.0.0.git zion-miner
cd zion-miner
```

> If you don't have Git, install it: `winget install Git.Git`

The repository contains the `V31/` workspace with the miner source code.

---

## 6. Build the Miner

### 6.1 Set environment variables for the build

In PowerShell (set once per session, or add to system env vars):

```powershell
# Use native CPU features (AVX2, BMI2, AES-NI) for max VerusHash performance
$env:ZION_CPU_TARGET = "native"

# Tell the build system we're on Windows with CUDA
$env:ZION_GPU_BACKEND = "cuda"
```

### 6.2 Build

```powershell
cd C:\zion-miner\V31

cargo build --release -p zion-miner --features gpu-cuda,native-all,tui
```

**Build time:** ~10-20 minutes (first build). Subsequent builds: ~1-2 minutes (incremental).

**Features explained:**
| Feature | Purpose |
|---------|---------|
| `gpu-cuda` | NVIDIA CUDA kernels for ZION deeksha + ZANO ProgPoW |
| `native-all` | Native CPU implementations (VerusHash v2.2, RandomX, etc.) — **REQUIRED for VRSC** |
| `tui` | Built-in Claymore-style dashboard |

### 6.3 Verify the binary

```powershell
.\target\release\zion-miner.exe --help
```

You should see the CLI help with `--pool`, `--wallet`, `--gpu`, `--v3-trinity` options.

---

## 7. Wallet Setup

You need a ZION L1 wallet address (starts with `zion1...`).

### Option A: Use an existing wallet

If you have a wallet backup JSON file (from the Linux miner or CLI):

```powershell
# The wallet address is in the JSON file
Get-Content "$env:USERPROFILE\Desktop\zion-miner-wallet-backup-*.json" | Select-String "ed25519_address"
```

### Option B: Generate a new wallet

```powershell
# Build the CLI (if not already built)
cd C:\zion-miner\V31
cargo build --release -p zion-cli

# Generate a new wallet
.\target\release\zion.exe wallet create --output "$env:USERPROFILE\Desktop\my-wallet.json"
```

Save the wallet address (starts with `zion1...`) for the next step.

---

## 8. Run the Miner

### 8.1 Quick start (foreground with TUI)

```powershell
cd C:\zion-miner\V31

.\target\release\zion-miner.exe `
    --pool "62.171.141.136:8444" `
    --wallet "zion1YOUR_WALLET_ADDRESS" `
    --worker "w11-rig" `
    --threads 10 `
    --gpu cuda `
    --v3-trinity `
    --interactive `
    --metrics "127.0.0.1:9101" `
    --log-interval 5
```

Replace `zion1YOUR_WALLET_ADDRESS` with your actual wallet address.

### 8.2 Background mode (no TUI, logs to file)

Create a file `C:\zion-miner\start-miner.ps1`:

```powershell
# C:\zion-miner\start-miner.ps1
# ZION V31 Trinity Miner — Windows 11 launcher

$ErrorActionPreference = "Stop"

# ── Configuration ──────────────────────────────────────────────────────
$MINER_BIN = "C:\zion-miner\V31\target\release\zion-miner.exe"
$POOL_ADDR = "62.171.141.136:8444"
$WALLET = "zion1YOUR_WALLET_ADDRESS"
$WORKER = "w11-rig"
$THREADS = 10
$METRICS_BIND = "127.0.0.1:9101"
$LOG_FILE = "C:\zion-miner\miner.log"

# ── Environment variables ──────────────────────────────────────────────
$env:RUST_LOG = "info"
$env:ZION_INTERACTIVE = "0"
$env:ZION_V3_TRINITY = "1"
$env:ZION_AUXPOW_ENABLED = "1"
$env:ZION_ZION_GPU = "1"                    # Enable ZION GPU (shares with ZANO)
$env:ZION_GPU_BACKEND = "cuda"
$env:ZION_GPU_WORK_SIZE = "4096"            # 2GB scratchpad (fits 8GB VRAM with ZANO DAG)
$env:ZION_CUDA_WORK_CAP = "4096"
$env:ZION_EXT_GPU_GAP_MS = "50"             # Short duty-cycle gap (ZION has GPU)
$env:ZION_NONCE_COUNT = "1048576"           # 1M ZION nonce batch
$env:ZION_STREAM1_ENABLED = "1"
$env:ZION_STREAM2_ENABLED = "1"
$env:ZION_STREAM3_ENABLED = "1"

# ── Launch with auto-restart watchdog ──────────────────────────────────
$restartCount = 0
$maxRestarts = 999999
$restartDelay = 5

while ($true) {
    Write-Host ""
    Write-Host "[WATCHDOG] Miner starting... (attempt $($restartCount + 1))"
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')]"

    & $MINER_BIN `
        --pool $POOL_ADDR `
        --wallet $WALLET `
        --worker $WORKER `
        --threads $THREADS `
        --gpu cuda `
        --v3-trinity `
        --no-tui `
        --metrics $METRICS_BIND `
        --log-interval 5 `
        2>&1 | Tee-Object -FilePath $LOG_FILE -Append

    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        Write-Host "[WATCHDOG] Miner exited normally."
        break
    }

    Write-Host "[WATCHDOG] Miner exited with code $exitCode"
    $restartCount++
    if ($restartCount -ge $maxRestarts) {
        Write-Host "[WATCHDOG] Max restarts reached — giving up."
        break
    }

    Write-Host "[WATCHDOG] Restarting in $restartDelay seconds..."
    Start-Sleep -Seconds $restartDelay
}
```

Run it:
```powershell
powershell -ExecutionPolicy Bypass -File C:\zion-miner\start-miner.ps1
```

### 8.3 What you should see

On startup, the miner prints:

```
  ╔══════════════════════════════════════════════════════════╗
  ║          ZION MINER — HARDWARE DETECTION                 ║
  ╠══════════════════════════════════════════════════════════╣
  ║  CPU:  AMD Ryzen 5 3600 6-Core Processor                 ║
  ║        cores=6/12 arch=AMD Zen ram=30 GB               ║
  ║        SIMD: AES-NI, SSE4.1, SSE4.2, AVX, AVX2, BMI1, BMI2, FMA, PCLMULQDQ
  ╠══════════════════════════════════════════════════════════╣
  ║  GPU: NVIDIA GeForce GTX 1070 Ti                   ║
  ║        backend=CUDA CUs=19 VRAM=8 GB                     ║
  ║  Backend: CUDA                                            ║
  ╚══════════════════════════════════════════════════════════╝

  ╔══════════════════════════════════════════════════════════╗
  ║          ZION MINER — AUTO MINE CONFIGURATION            ║
  ╠══════════════════════════════════════════════════════════╣
  ║  Mode:    Triple Parallel (CUDA + CPU)                   ║
  ║  Backend: CUDA                                           ║
  ╠══════════════════════════════════════════════════════════╣
  ║  Stream 1 (ZION):     ENABLED  (threads=6)               ║
  ║  Stream 2 (ZANO GPU): ENABLED  (batch=5M)                ║
  ║  Stream 3 (VRSC CPU): ENABLED  (threads=12 batch=5M)     ║
  ╚══════════════════════════════════════════════════════════╝
```

Then every 30 seconds, the periodic metrics summary:
```
stream metrics  stream="zion"         hashrate=2.46 MH/s   accepted=69   rejected=0  accept_rate="100.0%"
stream metrics  stream="gpu-external" hashrate=8.37 MH/s   accepted=0    rejected=0  accept_rate="0.0%"
stream metrics  stream="cpu-external" hashrate=10.39 MH/s  accepted=5    rejected=1  accept_rate="83.3%"
═══ periodic metrics summary ═══  active_streams=3  total_hashrate=21.23 MH/s  total_accepted=74  total_rejected=1  overall_accept_rate="98.7%"
```

### 8.4 Check status

Open another PowerShell window:
```powershell
# Metrics endpoint
curl http://127.0.0.1:9101/metrics

# Or tail the log
Get-Content C:\zion-miner\miner.log -Tail 30 -Wait
```

---

## 9. Auto-Start on Boot (Task Scheduler)

To automatically start the miner when Windows boots:

1. Open **Task Scheduler** (Win+R → `taskschd.msc`).
2. Click **Create Task...** (not Basic Task).
3. **General tab:**
   - Name: `ZION Miner`
   - Check **Run whether user is logged on or not**
   - Check **Run with highest privileges**
4. **Triggers tab:**
   - Click **New...**
   - Begin the task: **At startup**
   - Click OK
5. **Actions tab:**
   - Click **New...**
   - Action: **Start a program**
   - Program/script: `powershell.exe`
   - Add arguments: `-ExecutionPolicy Bypass -WindowStyle Hidden -File C:\zion-miner\start-miner.ps1`
   - Click OK
6. **Conditions tab:**
   - Uncheck **Start the task only if the computer is on AC power** (for laptops)
7. **Settings tab:**
   - Check **Restart the task if it fails** (every 1 minute, up to 999 times)
   - Click OK

The miner will now start automatically on boot and restart on crash.

---

## 10. Environment Variables Reference

All values are **auto-detected** by default. Override only if needed.

### GPU Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_GPU_BACKEND` | auto (cuda) | `cuda`, `opencl`, `metal`, `cpu` |
| `ZION_GPU_WORK_SIZE` | 4096 (shared) / 8192 (solo) | GPU threads per kernel chunk |
| `ZION_CUDA_WORK_CAP` | 4096 | Max CUDA work size cap |
| `ZION_CUDA_TPB` | 128 | Threads per block (must match kernel `__launch_bounds__`) |
| `ZION_CUDA_MAXREG` | (auto) | Max registers per thread (NVRTC) |
| `ZION_ZION_GPU` | 1 | Enable ZION GPU (shares GPU with ZANO) |
| `ZION_EXT_GPU_GAP_MS` | 50 | Duty-cycle gap (ms) between ZANO batches |

### Stream Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_STREAM1_ENABLED` | 1 | Stream 1: ZION (GPU deeksha) |
| `ZION_STREAM2_ENABLED` | 1 | Stream 2: ZANO (GPU ProgPoW) |
| `ZION_STREAM3_ENABLED` | 1 | Stream 3: VRSC (CPU VerusHash) |
| `ZION_V3_TRINITY` | 1 | Enable V3 Trinity mode (all streams via pool) |
| `ZION_NO_V3_TRINITY` | 0 | Set to 1 to disable Trinity mode |

### CPU / VRSC Tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_MINER_THREADS` | auto (logical cores) | ZION CPU fallback threads |
| `ZION_EXT_CPU_THREADS` | auto (arch-aware) | VRSC VerusHash threads |
| `ZION_EXT_CPU_NONCE_COUNT` | auto (5M for 8+ threads) | VRSC nonce batch size |
| `ZION_NONCE_COUNT` | 1048576 (1M) | ZION nonce batch size |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `RUST_LOG` | info | Log level: `error`, `warn`, `info`, `debug`, `trace` |
| `ZION_LOG_INTERVAL` | 5 | Stats log interval (seconds) |
| `ZION_INTERACTIVE` | 0 | Set to 1 for TUI mode |

### Pool

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_POOL_ADDR` | 62.171.141.136:8444 | Edge V31 pool Stratum address |
| `ZION_METRICS_BIND` | 127.0.0.1:9101 | Prometheus metrics endpoint |

---

## 11. Troubleshooting

### Build fails: "link.exe not found"

**Cause:** Visual Studio Build Tools not installed or not in PATH.

**Fix:**
```powershell
# Ensure you're using the "Developer PowerShell for VS 2022" terminal
# Or run:
& "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
```

### Build fails: "cuda.h not found" or "nvrtc not found"

**Cause:** CUDA Toolkit not installed or not in PATH.

**Fix:**
1. Verify CUDA Toolkit 12.4+ is installed.
2. Check PATH includes `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\bin`.
3. Restart terminal after installing CUDA.

### Runtime: "NVRTC compile failed"

**Cause:** NVRTC DLL not found at runtime.

**Fix:**
```powershell
# Check if nvrtc64_120_0.dll is in PATH
where.exe nvrtc64_120_0.dll

# If not found, add CUDA bin to PATH:
$env:PATH = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\bin;$env:PATH"
```

### Runtime: "CUDA device init failed"

**Cause:** No NVIDIA GPU, or driver too old.

**Fix:**
1. Run `nvidia-smi` — if it fails, update your NVIDIA driver.
2. Ensure driver version ≥ 550.x (for CUDA 12.4).
3. Download latest driver from: https://www.nvidia.com/Download/index.aspx

### Runtime: "GPU ZION init failed — falling back to CPU"

**Cause:** CUDA context creation failed (usually VRAM issue).

**Fix:**
- Reduce `ZION_GPU_WORK_SIZE` to 2048 or 1024.
- Close other GPU applications (browser hardware acceleration, games, etc.).
- For GPUs with < 6 GB VRAM, disable ZION GPU: `$env:ZION_ZION_GPU = "0"`.

### Runtime: "DAG generation OOM" (ZANO)

**Cause:** Not enough VRAM for ProgPoW DAG (~2 GB).

**Fix:**
- Reduce `ZION_AUXPOW_PROGPOW_MAX_GWS` to 131072 or 65536.
- Disable ZION GPU to free VRAM: `$env:ZION_ZION_GPU = "0"`.
- Disable Stream 2 entirely: `$env:ZION_STREAM2_ENABLED = "0"`.

### VRSC hashrate is low (< 2 MH/s)

**Cause:** ZION is using CPU threads, starving VRSC.

**Fix:**
- Ensure ZION GPU is enabled: `$env:ZION_ZION_GPU = "1"`.
- Check startup banner — it should show "ZION GPU initialized".
- If GPU unavailable, reduce ZION threads: `$env:ZION_MINER_THREADS = "2"`.

### ZANO hashrate dropped after enabling ZION GPU

This is expected — ZION and ZANO share the GPU. The tradeoff is positive:
- ZION gains ~2 MH/s (GPU vs CPU)
- ZANO loses ~1.5 MH/s (GPU sharing)
- **Net gain: +0.5 MH/s on GPU**, plus VRSC gains 5x from freed CPU.

To prioritize ZANO over ZION:
```powershell
$env:ZION_ZION_GPU = "0"           # ZION on CPU, ZANO has full GPU
$env:ZION_EXT_GPU_GAP_MS = "300"   # Longer gap for CPU ZION
```

### "job not found" or "Duplicate share" rejects (VRSC)

This is normal for LuckPool — VRSC blocks are fast (~60s) and shares can arrive
after the pool has moved to a new job. Accept rate of 90-98% is expected.

### Miner crashes on startup with "no GPU backend available"

**Cause:** Binary not built with `gpu-cuda` feature.

**Fix:** Rebuild with correct features:
```powershell
cd C:\zion-miner\V31
cargo build --release -p zion-miner --features gpu-cuda,native-all,tui
```

### Huge pages warning

Windows doesn't need explicit huge page configuration — the OS manages this
automatically. This warning can be ignored on Windows.

---

## Performance Expectations

| GPU | ZION (GPU) | ZANO (GPU) | VRSC (CPU*) | Total |
|-----|-----------|-----------|------------|-------|
| GTX 1070 Ti (8GB) | ~2.5 MH/s | ~8.4 MH/s | ~10.4 MH/s | **~21.5 MH/s** |
| RTX 3060 (12GB) | ~4 MH/s | ~15 MH/s | ~10.4 MH/s | **~29 MH/s** |
| RTX 4070 (12GB) | ~6 MH/s | ~25 MH/s | ~10.4 MH/s | **~41 MH/s** |

*VRSC hashrate depends on CPU (values shown for Ryzen 5 3600, 12 threads).

---

## Quick Reference — One-Liner Start

```powershell
cd C:\zion-miner\V31; .\target\release\zion-miner.exe --pool "62.171.141.136:8444" --wallet "zion1YOUR_WALLET" --worker "w11" --threads 10 --gpu cuda --v3-trinity --interactive --metrics "127.0.0.1:9101" --log-interval 5
```

---

## Support

- **Discord:** [ZION community](https://discord.gg/zion)
- **Docs:** [`StatusV3.md`](../../../StatusV3.md), [`AGENTS.md`](../../../AGENTS.md)
- **Reports:** [`REPORT_2026-08-10_TRINITY_HASHRATE_OPTIMIZATION.md`](../../3.1/REPORTS/REPORT_2026-08-10_TRINITY_HASHRATE_OPTIMIZATION.md)
- **GitHub:** https://github.com/Yose144/Zion-v3.0.0
