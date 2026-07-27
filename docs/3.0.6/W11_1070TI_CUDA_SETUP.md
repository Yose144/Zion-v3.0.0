# ZION Miner — Windows 11 + GTX 1070 Ti + CUDA

> **Status:** 2026-07-24 — platné pro `2.9.6-main` / `v3.0.6-beta`+
> **Cíl:** Sestavit `zion-miner.exe` z originálního zdroje s CUDA podporou pro NVIDIA GTX 1070 Ti (Pascal, sm_61) na Windows 11 a dosáhnout stejného chování jako na Linuxu (ZION GPU + ZANO ProgPoWZ + volitelně CPU VRSC).
> **Oficiální Windows build v release je CPU-only**; GPU (CUDA/OpenCL) musíš zapnout vlastním buildem podle tohoto návodu.

---

## 1. Požadavky

| Komponenta | Verze / specifikace |
|------------|---------------------|
| OS | Windows 10/11 64-bit |
| GPU | NVIDIA GeForce GTX 1070 Ti (Pascal, compute capability 6.1) |
| VRAM | 8 GB GDDR5 (postačuje pro ZION + ZANO současně) |
| RAM | 16 GB+ |
| Disk | 50 GB volných pro build |
| NVIDIA driver | Nejnovější Game Ready / Studio (podporující CUDA 12.4) |
| CUDA Toolkit | **12.4.x** (cudarc 0.12.1 používá `cuda-12040`) |
| MSVC | Visual Studio 2022 Build Tools / Community / Professional s **Desktop development with C++** workload |
| Windows SDK | Windows 11 SDK (10.0.22621+) |
| Rust | `x86_64-pc-windows-msvc` toolchain (rustup-init.exe) |
| Git | libovolná aktuální verze |

---

## 2. Instalační krok za krokem

### 2.1 NVIDIA ovladač a CUDA Toolkit

1. Nainstaluj nebo aktualizuj NVIDIA ovladač z [nvidia.com/drivers](https://www.nvidia.com/drivers).
2. Stáhni a nainstaluj **CUDA Toolkit 12.4** z [NVIDIA CUDA Archive](https://developer.nvidia.com/cuda-12-4-0-downloads?target_os=Windows).
   - Při instalaci vyber **Express** (nainstaluje se do `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4`).
3. Ověř PATH a `CUDA_PATH`:

```powershell
[System.Environment]::GetEnvironmentVariable("CUDA_PATH", "Machine")
```

Mělo by vrátit:

```
C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4
```

Pokud ne, přidej do **systémových** proměnných prostředí:

- `CUDA_PATH` = `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4`
- Do `Path` přidej: `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\bin`

> **Proč?** Rust crate `cudarc` načítá za běhu `nvcuda.dll` (z `System32`) a `nvrtc64_120_0.dll` (z CUDA `bin`). Bez PATH k CUDA `bin` miner nenajde NVRTC a CUDA kernel se neskompiluje.

### 2.2 Visual Studio Build Tools

Stáhni a nainstaluj [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) a zaškrtni:

- **Desktop development with C++**
- MSVC v143 - VS 2022 C++ x64/x86 build tools
- Windows 11 SDK (10.0.22621.0)
- C++ CMake tools for Windows (volitelné, ale užitečné)

> **Poznámka:** Build C knihoven (`zion-native-ffi`, `zion-auxpow`) vyžaduje `cl.exe` a Windows SDK include cesty. Vždy otevři terminál přes **x64 Native Tools Command Prompt for VS 2022**, nebo spusť `vcvars64.bat`.

### 2.3 Rust

```powershell
# Stáhni rustup-init.exe z https://rustup.rs/ a spusť:
rustup-init.exe -y --default-toolchain stable --default-host x86_64-pc-windows-msvc
```

Restartuj terminál a ověř:

```powershell
rustc --version
rustup show
```

Měl bys vidět:

```
Default host: x86_64-pc-windows-msvc
stable-x86_64-pc-windows-msvc (default)
```

### 2.4 Klonování repa

```powershell
cd C:\zion
git clone https://github.com/Yose144/Zion-v3.0.0.git 2.9.6-main
cd 2.9.6-main
```

> Veřejná varianta repa je `https://github.com/Zion-TerraNova/v3-Mainnet.git`. Pokud nemáš přístup k privátnímu, použij public.

---

## 3. Build

### 3.1 Otevři správný terminál

**Možnost A** (doporučeno):

- Start → `x64 Native Tools Command Prompt for VS 2022` → pravý klik → **Run as administrator**.
- Uvnitř spusť PowerShell: `powershell`

**Možnost B** (PowerShell + vcvars):

```powershell
& "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
```

### 3.2 Základní CUDA build (ZION GPU)

```powershell
cargo build --release -p zion-miner --features gpu-cuda
```

### 3.3 Trinity build (ZION CUDA + ZANO OpenCL)

```powershell
cargo build --release -p zion-miner --features "gpu-cuda,gpu-opencl"
```

### 3.4 Trinity + nativní hashery (volitelné, pro CPU VRSC/ERG atd.)

```powershell
cargo build --release -p zion-miner --features "gpu-cuda,gpu-opencl,native-hashers"
```

> **Upozornění k `native-verushash` a `native-randomx`:**
> - `native-verushash` (skutečný VerusHash v2.2 C++ pro VRSC) a `native-randomx` (tevador/RandomX pro XMR) aktuálně **nejsou otestovány s MSVC** a mohou selhat kvůli GAS assembleru (`jit_compiler_x86_static.S`) nebo `__builtin_*` makrům.
> - Pokud potřebuješ VRSC CPU na Windows, použij prozatím **WSL2** nebo uprav zdrojové C/C++ kompatibilitu. Build v bodě 3.3 bez `native-hashers` je nejbezpečnější start.

Výsledný binární soubor bude:

```
C:\zion\2.9.6-main\target\release\zion-miner.exe
```

---

## 4. Konfigurace pro GTX 1070 Ti

### 4.1 Povinné / doporučené proměnné prostředí

Vytvoř si spouštěcí PowerShell skript `start-miner.ps1` vedle repa:

```powershell
# start-miner.ps1 — GTX 1070 Ti + CUDA na Windows 11
$ErrorActionPreference = "Stop"

# ── Základní připojení ──
$env:ZION_POOL_ADDR        = "62.171.141.136:8444"          # oficiální pool
$env:ZION_MINER_WORKER     = "win11-1070ti"                 # jméno workeru
$env:ZION_MINER_LOOPS      = "999999"

# ── Wallet (VYPLŇ SVOU ADRESU) ──
$WALLET = "zion1TVOJEZIONADRESA"

# ── GPU backendy ──
$env:ZION_MINER_GPU        = "cuda"                         # ZION deeksha na CUDA
$env:ZION_EXT_GPU_BACKEND  = "opencl"                       # ZANO/ProgPoWZ má jen OpenCL
$env:ZION_CUDA_ARCH        = "compute_61"                   # NVRTC virtuální arch pro 1070 Ti
$env:ZION_CUDA_TPB         = "128"                          # threads per block

# ── Trinity streamy ──
$env:ZION_STREAM1_ENABLED  = "1"                            # ZION (GPU)
$env:ZION_STREAM2_ENABLED  = "1"                            # ZANO (GPU OpenCL)
$env:ZION_STREAM2_FORCE_COIN = "ZANO"
$env:ZION_STREAM3_ENABLED  = "0"                            # CPU VRSC — zapni až bude fungovat native-verushash
$env:ZION_MINER_CPU_COIN   = "VRSC"

# ── Workload parametry ──
$env:ZION_GPU_WORK_SIZE    = "8192"                         # nebo 4096 pro Pascal
$env:ZION_NONCE_COUNT      = "32768"                        # ≥ 4× work_size
$env:ZION_NONCE_COUNT_MIN  = "16384"
$env:ZION_NONCE_COUNT_MAX  = "131072"
$env:ZION_NONCE_AUTOTUNE   = "1"
$env:ZION_GPU_MAX_BATCH    = "32768"
$env:ZION_GPU_PIPELINE     = "0"                            # 0 = synchronní, žádné stale shares

# ── ZANO ProgPoWZ duty-cycle na jedné GPU ──
$env:ZION_EXT_GPU_BATCH_SIZE   = "4194304"                  # 4M noncí pro ZANO
$env:ZION_EXT_GPU_TIME_DUTY_PCT = "70"                      # % času pro ZANO; 50 = rovnoměrné
$env:ZION_EXT_GPU_MAX_GAP_MS   = "5000"

# ── Interaktivní TUI ──
$env:ZION_INTERACTIVE      = "1"
$env:ZION_METRICS_REPORT_SECS = "15"
$env:ZION_AUTOTUNE         = "1"

# ── Spuštění ──
$Bin = Join-Path $PSScriptRoot "target\release\zion-miner.exe"
& $Bin `
    --pool $env:ZION_POOL_ADDR `
    --wallet $WALLET `
    --worker $env:ZION_MINER_WORKER `
    --gpu cuda `
    --algorithm deeksha_lite_v1 `
    --profile pool `
    --loops $env:ZION_MINER_LOOPS
```

Uprav `$WALLET` na svou adresu a spusť:

```powershell
.\start-miner.ps1
```

### 4.2 Vysvětlení klíčových hodnot

| Proměnná | Význam | Proč 1070 Ti |
|----------|--------|--------------|
| `ZION_CUDA_ARCH=compute_61` | NVRTC cílová architektura | 1070 Ti = Pascal sm_61; NVRTC vyžaduje `compute_61`, ne `sm_61` |
| `ZION_EXT_GPU_BACKEND=opencl` | Backend pro Stream 2 (ZANO) | ProgPoWZ/ZANO má implementaci pouze v OpenCL (AuXpow) |
| `ZION_GPU_PIPELINE=0` | Synchronní mód | Zabrání `StaleJob` rejectům při rotaci jobů poolu |
| `ZION_EXT_GPU_TIME_DUTY_PCT=70` | Kolik % času dostává ZANO | Se zbytkem těží ZION deeksha na stejné kartě |
| `ZION_NONCE_COUNT=32768` | Velikost dávky | 4× work_size aktivuje double-buffered async readback |

---

## 5. Ověření

### 5.1 Kontrola CUDA inicializace

Po spuštění bys měl vidět řádky podobné:

```
cuda_arch_detect: compute_capability=6.1 => arch=compute_61
gpu_cuda_init device="NVIDIA GeForce GTX 1070 Ti" work_size=8192 algorithm=deeksha_lite_v1 streams=3
stream2_gpu_external_started work_size=4194304
gpu_init backend=cuda device="NVIDIA GeForce GTX 1070 Ti" work_size=8192 algorithm=deeksha_lite_v1 streams=3
```

### 5.2 Benchmark

```powershell
$env:ZION_CUDA_ARCH = "compute_61"
.\target\release\zion-miner.exe --profile benchmark --loops 3 --gpu cuda --algorithm deeksha_lite_v1
```

Pokud benchmark proběhne bez `CUDA_ERROR_INVALID_PTX` a vypíše hashrate, je CUDA OK.

### 5.3 Test poolu

```powershell
.\target\release\zion-miner.exe `
    --pool 62.171.141.136:8444 `
    --wallet zion1TVOJEZIONADRESA `
    --worker test-1070ti `
    --gpu cuda `
    --algorithm deeksha_lite_v1 `
    --profile pool `
    --loops 100
```

Sleduj řádky `share_accepted` a `share_rejected`. Prvních pár rejectů `RejectedLowDifficulty` je normálních, než se vardiff ustálí.

---

## 6. Řešení problémů

### 6.1 `CUDA_ERROR_INVALID_PTX` nebo `PTX load failed`

Příčina: NVRTC kompiluje pro špatnou architekturu.

```powershell
$env:ZION_CUDA_ARCH = "compute_61"
```

### 6.2 `Unable to find nvrtc` / chybí `nvrtc64_120_0.dll`

Příčina: CUDA `bin` není v PATH.

```powershell
$env:Path = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\bin;" + $env:Path
```

Nebo zkopíruj tyto DLL vedle `zion-miner.exe`:

- `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\bin\nvrtc64_120_0.dll`
- `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\bin\nvrtc-builtins64_124.dll`

### 6.3 `OpenCL not found` / nelze najít OpenCL platformu

- Ověř, že NVIDIA ovladač nainstaloval `C:\Windows\System32\OpenCL.dll`.
- Na některých systémech je nutné zvolit `ZION_OCL_DEVICE_NAME` např.:

```powershell
$env:ZION_OCL_DEVICE_NAME = "NVIDIA"
```

### 6.4 TDR (Timeout Detection and Recovery) / driver reset

Windows WDDM restartuje ovladač, pokud GPU kernel běží déle než cca 2 s. ZANO ProgPoWZ může být náchylný.

Zvýšení TdrDelay v registru (řežim admina):

```powershell
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" -Name "TdrDelay" -Value 60 -Type DWord
```

> Po změně **restart PC**.

### 6.5 Sestavování trvá dlouho / LTO out of memory

`profile.release` používá `lto = "fat"` a `codegen-units = 1`. Na 16 GB RAM může být pomalé. Pro rychlejší build (ale pomalejší binárku):

```powershell
$env:CARGO_PROFILE_RELEASE_LTO = "thin"
$env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS = "8"
cargo build --release -p zion-miner --features "gpu-cuda,gpu-opencl"
```

### 6.6 `cl.exe` nenajde hlavičky `<stdio.h>`

Otevři opravdu `x64 Native Tools Command Prompt for VS 2022` nebo spusť `vcvars64.bat` **před** `cargo build`. Prosté PowerShell okno nestačí, protože nemá nastavené `INCLUDE`, `LIB` a `LIBPATH`.

### 6.7 Chyby v C/C++ kódu (`__builtin_bswap16`, GAS `.S`)

Pokud builduješ s `native-verushash` nebo `native-randomx` a vidíš chyby typu `__builtin_bswap16` nebo `jit_compiler_x86_static.S`, okamžitě je vypni:

```powershell
cargo build --release -p zion-miner --features "gpu-cuda,gpu-opencl"
```

---

## 7. Vytvoření distribuovatelného archivu

Pokud chceš stejný `.exe` přesunout na další W11 stroje bez instalace Rustu:

```powershell
# v x64 Native Tools PowerShell
New-Item -ItemType Directory -Path "C:\zion\2.9.6-main\dist" -Force
Copy-Item "target\release\zion-miner.exe" "dist\"
# Zkopíruj také DLL, pokud nejsou na cílové stanici v PATH:
# Copy-Item "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\bin\nvrtc64_120_0.dll" "dist\"
# Copy-Item "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\bin\nvrtc-builtins64_124.dll" "dist\"
Compress-Archive -Path "dist\*" -DestinationPath "zion-miner-win11-1070ti-cuda.zip" -Force
```

Cílový stroj musí mít:

- NVIDIA ovladač podporující CUDA 12.4
- `CUDA_PATH` nebo `nvrtc64_120_0.dll` vedle `.exe`
- Visual C++ Redistributable 2022 (`vcruntime140.dll`, `msvcp140.dll`)

---

## 8. Autostart po přihlášení

1. Ulož `start-miner.ps1`.
2. Vytvoř z něj `.bat` zástupce:

```bat
@echo off
powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\zion\2.9.6-main\start-miner.ps1"
```

3. Win + R → `shell:startup` → vlož zástupce `.bat`.

---

## 9. Známá omezení

| Funkce | Stav na Windows 11 |
|--------|--------------------|
| ZION deeksha na CUDA | ✅ funguje (build z bodu 3.2/3.3) |
| ZANO ProgPoWZ na OpenCL | ✅ funguje s `ZION_EXT_GPU_BACKEND=opencl` |
| Trinity (ZION + ZANO na jedné 1070 Ti) | ✅ funguje s duty-cycle |
| CPU VRSC (`native-verushash`) | ⚠️ neotestováno s MSVC, může vyžadovat WSL2 |
| CPU XMR (`native-randomx`) | ❌ nefunguje na MSVC kvůli GAS assembleru (`jit_compiler_x86_static.S`) |
| Oficiální release `zion-miner-windows-x86_64.tar.gz` | CPU-only; pro CUDA musíš buildit ze zdroje |

---

## 10. Aktualizace na novou verzi

```powershell
cd C:\zion\2.9.6-main
git pull origin main
cargo build --release -p zion-miner --features "gpu-cuda,gpu-opencl"
```

> Pokud se změnily nativní C zdroje nebo Cargo.lock, smaž `target` a build znovu: `cargo clean`.

---

## 11. Odkazy

- `V3/L1/miner/Cargo.toml` — feature flags
- `V3/L1/miner/src/gpu_backend.rs` — CUDA backend, `detect_cuda_arch()`
- `V3/L1/miner/src/main.rs` — `ZION_EXT_GPU_BACKEND`, duty-cycle
- `scripts/start-local-miner.sh` — Linux referenční spouštěcí skript
- Pool: `62.171.141.136:8444`
- RPC: `rpc.zionterranova.com:8443`

---

*Vygenerováno Devinem pro interní setup GTX 1070 Ti + CUDA na Windows 11.*
