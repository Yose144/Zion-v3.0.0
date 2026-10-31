# Desktop Agent — GPU build guide (Windows / Linux)

> **Pro:** navázání na stroji s CUDA/OpenCL GPU. macOS arm64 buildy jsou hotové (viz `DESKTOP-AGENT-COMPLETE-PLAN.md` D3).
> **Datum:** 2026-11-01 · **Commit baseline:** `d83a24041` (nebo novější `main`)
> **Související:** [`DESKTOP-AGENT-COMPLETE-PLAN.md`](../../../DESKTOP-AGENT-COMPLETE-PLAN.md) · [`AGENTS.md`](../../../AGENTS.md) (SMOS/GLIBC gotchy)

---

## 0. Co je hotové a co chybí

| Artefakt | Stav | Host |
|---|---|---|
| VIP macOS arm64 DMG | ✅ `apps/desktop-agent/dist/` (187 MB) | tento Mac |
| Public macOS arm64 DMG | ✅ `apps/public-miner/dist/` (146 MB) | tento Mac |
| Windows CPU-only binárky | ✅ `dist/desktop-2026-11-01/windows-x64/` | tento Mac (mingw) |
| **Windows GPU installer (NSIS)** | ❌ | **Windows + NVIDIA CUDA + OpenCL SDK** |
| **Linux AppImage + DEB** | ❌ | **Linux + OpenCL ICD + CUDA** |
| Code signing | ❌ | Apple Developer ID / Windows cert |

---

## 1. Windows — GPU build (NVIDIA CUDA + OpenCL)

### 1.1 Předpoklady

- Windows 10/11 x64
- **Visual Studio Build Tools** (Desktop development with C++)
- **Rust** (rustup) — `rustup target add x86_64-pc-windows-msvc`
- **CUDA Toolkit** (12.x) + **NVRTC** (`nvrtc64_*.dll`)
- **OpenCL SDK** — Khronos ICD loader (`OpenCL.lib` + `OpenCL.dll`) nebo NVIDIA GPU Computing SDK
- **Node.js 20+** + npm
- **NSIS** (`makensis`) — electron-builder si ho stáhne, nebo `choco install nsis`

### 1.2 Ověření prostředí

```powershell
nvidia-smi
nvcc --version
where nvrtc64_120_0.dll   # musí najít NVRTC
where OpenCL.dll
```

### 1.3 Build miner (VIP)

```powershell
cd <repo>\V31
$env:ZION_DISABLE_OPENMP = "1"
cargo build --release --target x86_64-pc-windows-msvc `
  -p zion-miner --bin zion-miner --bin zion-universal-miner `
  --features "auxpow,gpu-opencl,gpu-cuda,native-all,tui"
cargo build --release --target x86_64-pc-windows-msvc -p zion-core --bin zion-node
cargo build --release --target x86_64-pc-windows-msvc -p zion-cli
```

**Ověření backendu:**
```powershell
.\target\x86_64-pc-windows-msvc\release\zion-miner.exe --version
# build id musí odpovídat commitu; GPU backend se vypíše při startu
```

### 1.4 Zabalení DMG/EXE (VIP)

```powershell
cd <repo>\apps\desktop-agent
npm ci
# zkopíruj binárky do resources/ (nebo použij prepare s --no-build)
copy ..\..\V31\target\x86_64-pc-windows-msvc\release\zion-miner.exe resources\
copy ..\..\V31\target\x86_64-pc-windows-msvc\release\zion-universal-miner.exe resources\
copy ..\..\V31\target\x86_64-pc-windows-msvc\release\zion-node.exe resources\node.exe
copy ..\..\V31\target\x86_64-pc-windows-msvc\release\zion.exe resources\
npx electron-builder --win nsis --x64
```

**Public verze:** stejné, ale z `apps/public-miner` a miner build s `public_build`:
```powershell
cargo build --release --target x86_64-pc-windows-msvc `
  -p zion-miner --bin zion-miner --bin zion-universal-miner `
  --features "public_build,auxpow,gpu-opencl,gpu-cuda,native-all,tui"
```

### 1.5 Windows gotchy

| Problém | Řešení |
|---|---|
| `-lOpenCL: not found` (mingw) | Použij **MSVC** target (`x86_64-pc-windows-msvc`) + OpenCL.lib, ne mingw |
| CUDA build padá na NVRTC | Nainstaluj CUDA Toolkit; `nvrtc64_*.dll` musí být v `resources/` |
| `signAndEditExecutable: false` | Pro produkci zapni code signing v `package.json` |
| `OpenCL.dll` chybí na čistém stroji | Zkopíruj do `resources/` (prepare skript to dělá na Windows) |

---

## 2. Linux — AppImage + DEB

### 2.1 Předpoklady (Ubuntu 22.04/24.04)

```bash
sudo apt-get update
sudo apt-get install -y build-essential pkg-config libssl-dev \
  ocl-icd-opencl-dev opencl-headers clinfo \
  libgtk-3-dev libnss3 libxss1 libasound2
# CUDA (volitelně, pro NVIDIA)
# https://developer.nvidia.com/cuda-downloads
rustup target add x86_64-unknown-linux-gnu
node --version   # 20+
```

### 2.2 Ověření OpenCL/CUDA

```bash
clinfo | head -20          # musí vidět GPU
nvidia-smi                 # pokud NVIDIA
```

### 2.3 Build miner (VIP)

```bash
cd <repo>/V31
export ZION_DISABLE_OPENMP=1
cargo build --release -p zion-miner --bin zion-miner --bin zion-universal-miner \
  --features "auxpow,gpu-opencl,gpu-cuda,native-all,tui"
cargo build --release -p zion-core --bin zion-node
cargo build --release -p zion-cli
```

**AMD only:** vynech `gpu-cuda` z features.
**CUDA:** vyžaduje CUDA Toolkit + `libnvrtc.so`.

### 2.4 Zabalení AppImage + DEB

```bash
cd <repo>/apps/desktop-agent
npm ci
cp ../../V31/target/release/zion-miner resources/
cp ../../V31/target/release/zion-universal-miner resources/
cp ../../V31/target/release/zion-node resources/zion-node
cp ../../V31/target/release/zion-node resources/node
cp ../../V31/target/release/zion resources/
chmod +x resources/zion-miner resources/zion-universal-miner resources/zion-node resources/node resources/zion
npx electron-builder --linux --x64
```

**Public verze:** z `apps/public-miner`, miner s `public_build`.

### 2.5 Linux gotchy

| Problém | Řešení |
|---|---|
| `blake3`/`ring` build selže na macOS cross-compile | **Build na Linux hostu** (ne cross z macOS) |
| GLIBC 2.39 (Ubuntu 24.04) neběží na starších distrech | Build v Docker `ubuntu:20.04` (glibc 2.31) |
| AppImage neběží na Wayland/NVIDIA | `--no-sandbox --ozone-platform=x11 --disable-gpu-sandbox` |
| `libOpenCL.so` chybí | `apt install ocl-icd-opencl-dev` |

---

## 3. Code signing (oba)

### 3.1 macOS

- Apple Developer Program ($99/yr) → Developer ID Application cert
- `electron-builder` notarizace: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
- Bez toho = ad-hoc sign, uživatel musí povolit v System Settings

### 3.2 Windows

- Authenticode cert (EV nebo standard)
- `CSC_LINK` + `CSC_KEY_PASSWORD` env pro electron-builder
- `signAndEditExecutable: true` v `package.json`

---

## 4. Verifikace po buildu

```bash
# SHA256
shasum -a 256 dist/*.dmg dist/*.exe dist/*.AppImage dist/*.deb > SHA256SUMS.txt

# BUILD-INFO
cat > dist/BUILD-INFO.txt <<EOF
Edition: vip|public
Commit: $(git rev-parse HEAD)
Version: 3.2.0
Target: <platform>
Features: <features>
EOF
```

**Smoke test:**
1. Nainstaluj/spusť app.
2. One-click wizard → wallet → start.
3. Ověř, že miner běží (`--version`, hashrate > 0).
4. VIP: ověř, že Trinity panel ukazuje reálné coiny (ZANO/QTC/PEARL).
5. Public: ověř, že UI ukazuje jen ZION + BOOST (žádné coin names).

---

## 5. Co nahrát zpět do repa

- `apps/desktop-agent/dist/` a `apps/public-miner/dist/` jsou **gitignored** (`dist/`) — artefakty se necommitují.
- Commitni jen **BUILD-INFO** a **SHA256SUMS** do `dist/desktop-<date>/` (pokud chceš evidenci), nebo je nech lokálně.
- Pokud měníš build skripty/`package.json`, commitni je.

---

## 6. Rychlý checklist

- [ ] Windows: VS Build Tools + Rust MSVC + CUDA + NVRTC + OpenCL SDK
- [ ] Windows: `cargo build --release --target x86_64-pc-windows-msvc --features gpu-opencl,gpu-cuda,...`
- [ ] Windows: `npx electron-builder --win nsis --x64`
- [ ] Linux: `apt install ocl-icd-opencl-dev` + CUDA (volitelně)
- [ ] Linux: `cargo build --release --features gpu-opencl,gpu-cuda,...`
- [ ] Linux: `npx electron-builder --linux --x64`
- [ ] Oba: SHA256SUMS + BUILD-INFO
- [ ] Smoke test one-click + Trinity (VIP) / BOOST (Public)
- [ ] (volitelně) Code signing
