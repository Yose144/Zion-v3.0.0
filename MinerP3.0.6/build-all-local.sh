#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# MinerP3.0.6/build-all-local.sh
# Build the public ZION miner (one-click with GPU auto-detect) for
# macOS, Linux, and Windows on an Apple Silicon Mac.
#
# Uses:
#   - macOS aarch64: native build (Metal + OpenCL + native)
#   - Linux x86_64:  cargo-zigbuild cross-compile (OpenCL + CUDA + native)
#   - Windows x86_64: cargo cross-compile with MinGW-w64 (OpenCL + CUDA + native)
#
# All binaries are built with `public_build` so TUI/logs show only the
# ZION / Boost stream (Trinity/AuxPoW coin names are hidden).
#
# Output: MinerP3.0.6/dist/ + SHA256SUMS.txt
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
V3_DIR="${REPO_ROOT}/V3"
DIST_DIR="${SCRIPT_DIR}/dist"
VERSION="v3.1.0"

echo "=== ZION Public Miner ${VERSION} — M1 local cross-build ==="
echo ""

# Toolchain checks
for t in aarch64-apple-darwin x86_64-pc-windows-gnu x86_64-unknown-linux-gnu; do
    rustup target list --installed | grep -q "${t}" || {
        echo "ERROR: Rust target ${t} not installed. Run: rustup target add ${t}"
        exit 1
    }
done

command -v cargo-zigbuild &>/dev/null || {
    echo "ERROR: cargo-zigbuild not found. Run: cargo install cargo-zigbuild"
    exit 1
}

command -v x86_64-w64-mingw32-gcc &>/dev/null || {
    echo "ERROR: x86_64-w64-mingw32-gcc not found. Run: brew install mingw-w64"
    exit 1
}

LLVM_AR="/opt/homebrew/opt/llvm/bin/llvm-ar"
[[ -x "${LLVM_AR}" ]] || {
    echo "ERROR: ${LLVM_AR} not found. Run: brew install llvm"
    exit 1
}

mkdir -p "${DIST_DIR}"

# The bundled libOpenCL.so in V3/L1/native-libs is an old stub. The
# .incompatible file is the real x86_64 Linux OpenCL loader we use only
# at link time; at runtime the target machine's ocl-icd loader is used.
OPENCL_LIB_DIR="${V3_DIR}/L1/native-libs"
if [[ -f "${OPENCL_LIB_DIR}/libOpenCL.so.incompatible" ]]; then
    cp "${OPENCL_LIB_DIR}/libOpenCL.so.incompatible" "${OPENCL_LIB_DIR}/libOpenCL.so"
fi

cd "${V3_DIR}"

# ── macOS aarch64 ──
echo "[1/6] Building macOS aarch64 (Metal + OpenCL + native)..."
ZION_DISABLE_OPENMP=1 \
    cargo build --release --target aarch64-apple-darwin -p zion-miner \
        --bin zion-miner \
        --features public_build,full,gpu-metal

# ── macOS x86_64 ──
echo "[2/6] Building macOS x86_64 (Metal + OpenCL + native)..."
ZION_DISABLE_OPENMP=1 \
    cargo build --release --target x86_64-apple-darwin -p zion-miner \
        --bin zion-miner \
        --features public_build,full,gpu-metal

# ── Windows x86_64 ──
echo "[3/6] Building Windows x86_64 (OpenCL + CUDA + native)..."
export AR_x86_64_pc_windows_gnu="${LLVM_AR}"
export CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER="x86_64-w64-mingw32-gcc"
ZION_CPU_TARGET=x86-64 ZION_DISABLE_OPENMP=1 \
    cargo build --release --target x86_64-pc-windows-gnu -p zion-miner \
        --bin zion-miner \
        --features public_build,full,gpu-cuda

# ── Linux x86_64 ──
echo "[4/6] Building Linux x86_64 (OpenCL + CUDA + native)..."
export AR_x86_64_unknown_linux_gnu="${LLVM_AR}"
export CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_RUSTFLAGS="-L ${OPENCL_LIB_DIR} -Clink-arg=-Wl,--allow-shlib-undefined"
ZION_CPU_TARGET=x86-64 ZION_DISABLE_OPENMP=1 \
    cargo zigbuild --release --target x86_64-unknown-linux-gnu -p zion-miner \
        --bin zion-miner \
        --features public_build,full,gpu-cuda

# ── Package ──
echo "[5/6] Packaging..."
rm -rf "${DIST_DIR}/packages"
mkdir -p "${DIST_DIR}/packages"

# macOS aarch64
cp "${V3_DIR}/target/aarch64-apple-darwin/release/zion-miner" "${DIST_DIR}/packages/zion-miner-macos-aarch64"
chmod +x "${DIST_DIR}/packages/zion-miner-macos-aarch64"
tar czf "${DIST_DIR}/zion-miner-macos-aarch64.tar.gz" -C "${DIST_DIR}/packages" zion-miner-macos-aarch64

# macOS x86_64
cp "${V3_DIR}/target/x86_64-apple-darwin/release/zion-miner" "${DIST_DIR}/packages/zion-miner-macos-x86_64"
chmod +x "${DIST_DIR}/packages/zion-miner-macos-x86_64"
tar czf "${DIST_DIR}/zion-miner-macos-x86_64.tar.gz" -C "${DIST_DIR}/packages" zion-miner-macos-x86_64

# Linux x86_64
cp "${V3_DIR}/target/x86_64-unknown-linux-gnu/release/zion-miner" "${DIST_DIR}/packages/zion-miner-linux-x86_64"
chmod +x "${DIST_DIR}/packages/zion-miner-linux-x86_64"
tar czf "${DIST_DIR}/zion-miner-linux-x86_64.tar.gz" -C "${DIST_DIR}/packages" zion-miner-linux-x86_64

# Windows x86_64
ZIPDIR="${DIST_DIR}/packages/zion-miner-windows-x86_64"
rm -rf "${ZIPDIR}"
mkdir -p "${ZIPDIR}"
cp "${V3_DIR}/target/x86_64-pc-windows-gnu/release/zion-miner.exe" "${ZIPDIR}/zion-miner.exe"
cp "${SCRIPT_DIR}/dist/start.bat" "${ZIPDIR}/start.bat"
cd "${DIST_DIR}/packages"
rm -f "${DIST_DIR}/zion-miner-windows-x86_64.zip"
zip -r "${DIST_DIR}/zion-miner-windows-x86_64.zip" zion-miner-windows-x86_64/

# ── SHA256 ──
echo "[6/6] Computing SHA256..."
cd "${DIST_DIR}"
shasum -a 256 \
    zion-miner-macos-aarch64.tar.gz \
    zion-miner-macos-x86_64.tar.gz \
    zion-miner-linux-x86_64.tar.gz \
    zion-miner-windows-x86_64.zip \
    > SHA256SUMS.txt

echo ""
echo "=== Build complete ==="
cat SHA256SUMS.txt
echo ""
echo "Create release:"
echo "  gh release create ${VERSION} --repo Zion-TerraNova/v3-Mainnet \\"
echo "    --title 'ZION v3.0.6-beta — Public Miner' \\"
echo "    --notes-file ${SCRIPT_DIR}/RELEASE_NOTES.md \\"
echo "    --prerelease \\"
echo "    ${DIST_DIR}/zion-miner-*.tar.gz ${DIST_DIR}/zion-miner-*.zip ${DIST_DIR}/SHA256SUMS.txt"
