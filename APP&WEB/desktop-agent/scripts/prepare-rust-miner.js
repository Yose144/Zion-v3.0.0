#!/usr/bin/env node
/*
  Prepares all V3 binaries for the desktop agent bundle.

  Builds the V3 Rust workspace in release mode and copies the required
  binaries into desktop-agent/resources/ so electron-builder bundles them
  for one-click install on all platforms.

  Required binaries:
    - zion-miner      (mining client — CPU/GPU backends)
    - node            (ZION L1 full node — P2P + RPC)
    - zion            (unified CLI — wallet, send, balance, mine status, etc.)

  Platform-aware GPU features:
    macOS (arm64)  -> --features gpu-metal
    macOS (x86_64) -> --features gpu-opencl
    Linux/Windows  -> --features gpu-opencl,gpu-cuda  (with CUDA fallback)

  Usage:
    node scripts/prepare-rust-miner.js [--no-build] [--features <f>] [--require]
    node scripts/prepare-rust-miner.js --auto

  Notes:
    - Requires Rust toolchain + cargo in PATH
    - Output binaries are placed in APP&WEB/desktop-agent/resources/
*/

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

// ── Constants ──────────────────────────────────────────────────────

const BINS = [
  { crate: 'zion-miner',  bin: 'zion-miner',  aliases: ['zion-universal-miner'] },
  { crate: 'zion-core',   bin: 'node',        aliases: [] },
  { crate: 'zion-cli',    bin: 'zion',        aliases: [] },
];

const V3_WORKSPACE_MANIFEST = 'V3/Cargo.toml';

// ── Helpers ────────────────────────────────────────────────────────

function exists(filePath) {
  try { return fs.existsSync(filePath); } catch { return false; }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyIfExists(src, dst) {
  if (!exists(src)) return false;
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
  if (process.platform !== 'win32') {
    try { fs.chmodSync(dst, 0o755); } catch { /* ignore */ }
  }
  return true;
}

function windowsMinerFeatures() {
  // Windows MSVC lib.exe can hit command-line length limits with the full
  // `native-all` stack because RandomX and GhostRider compile 20+ .c/.cpp
  // files. Use a focused feature set that still supports Trinity
  // triple-stream mining (ZION + GPU external + CPU external) without XMR
  // and RTM native acceleration on this platform.
  return [
    'gpu-opencl',
    'native-etchash',
    'native-kawpow',
    'native-autolykos',
    'native-kheavyhash',
    'native-blake3-algo',
    'native-cosmic-harmony',
    'native-verushash',
    'native-hashers'
  ].join(',');
}

function detectPlatformFeatures() {
  const platform = process.platform;
  const arch = os.arch();
  // Native CPU algorithm acceleration is required for triple-stream CPU coins
  // (VerusHash/VRSC, RandomX/XMR, GhostRider/RTM) to hash at full speed.
  // native-hashers is required for DAG-based external algorithms on GPU
  // (ProgPoWZ/ZANO on Metal, Ethash/KawPow on OpenCL/CUDA).
  const nativeFeatures = 'native-all,native-hashers';

  // Build the unified miner with all GPU/native backends enabled.
  // `full` = gpu-opencl + native-all + native-hashers, which is required for
  // Trinity triple-stream mining (ZION + external GPU + external CPU).
  const base = 'full';

  // Build the unified miner with all GPU/native backends enabled.
  // `full` = gpu-opencl + native-all + native-hashers, which is required for
  // Trinity triple-stream mining (ZION + external GPU + external CPU).
  const base = 'full';

  if (platform === 'darwin') {
    if (arch === 'arm64') {
      console.log('[prepare-v3] Apple Silicon detected -> enabling Metal + full native stack');
      return `${base},gpu-metal`;
    }
    console.log('[prepare-v3] Intel Mac detected -> enabling full native stack (OpenCL)');
    return base;
  }

  if (platform === 'win32') {
    const cudaCheck = checkCudaCapability();
    const forceCuda = String(process.env.ZION_FORCE_CUDA || '').trim() === '1';
    const winFeatures = windowsMinerFeatures();
    if (forceCuda || cudaCheck.hasCuda) {
      console.log('[prepare-v3] Windows + NVIDIA CUDA toolkit detected -> adding CUDA backend');
      return `${winFeatures},gpu-cuda`;
    }
    console.log('[prepare-v3] Windows detected -> enabling focused native stack for W11 triple-stream (OpenCL)');
    return winFeatures;
  }

  if (platform === 'linux') {
    const cudaCheck = checkCudaCapability();
    const forceCuda = String(process.env.ZION_FORCE_CUDA || '').trim() === '1';
    if (forceCuda || cudaCheck.hasCuda) {
      console.log('[prepare-v3] Linux + NVIDIA CUDA detected -> enabling CUDA + full native stack');
      return `${base},gpu-cuda`;
    }
    console.log('[prepare-v3] Linux detected -> enabling full native stack (OpenCL, safe default)');
    return base;
  }

  console.log('[prepare-v3] Unknown platform -> enabling full native stack (OpenCL)');
  return base;
}

function checkCudaCapability() {
  const result = { hasCuda: false, gpuCount: 0, driverVersion: 'unknown' };
  try {
    const nvSmi = spawnSync('nvidia-smi', ['--query-gpu=count', '--format=csv,noheader,nounits'], { stdio: 'pipe' });
    if (nvSmi.status === 0) {
      const gpuCount = parseInt(nvSmi.stdout.toString().trim());
      if (gpuCount > 0) {
        result.gpuCount = gpuCount;
        result.hasCuda = true; // Runtime CUDA only needs the driver + libcuda; nvcc is optional.
        const driverCheck = spawnSync('nvidia-smi', ['--query-gpu=driver_version', '--format=csv,noheader,nounits'], { stdio: 'pipe' });
        if (driverCheck.status === 0) {
          result.driverVersion = driverCheck.stdout.toString().trim().split('\n')[0];
        }
        // Having an NVIDIA GPU + driver is enough to try the CUDA backend at
        // build time; the CUDA toolkit (nvcc) is only required for compilation.
        const cudaVersion = spawnSync('nvcc', ['--version'], { stdio: 'pipe' });
        if (cudaVersion.status === 0) {
          result.hasCuda = true;
          result.driverVersion += ` (nvcc: ${cudaVersion.stdout.toString().trim().split('\n')[0]})`;
        } else {
          // No nvcc, but a modern GeForce driver may still run OpenCL/CUDA
          // binaries if they are built elsewhere. For local W11 builds we stay
          // with OpenCL and the full native algorithm stack.
          console.log('[prepare-v3] nvidia-smi found GPU but nvcc not in PATH -> building OpenCL/full stack, use a CI-built CUDA binary for runtime');
        }
      }
    }
  } catch { /* ignore */ }
  return result;
}

function parseArgs(argv) {
  const out = { noBuild: false, requireBinary: false, features: null, autoDetect: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-build') out.noBuild = true;
    else if (a === '--require' || a === '--require-rust') out.requireBinary = true;
    else if (a === '--auto') out.autoDetect = true;
    else if (a === '--features') { out.features = String(argv[i + 1] || '').trim(); i++; }
  }
  if (!out.features || out.autoDetect) {
    out.features = detectPlatformFeatures();
  }
  return out;
}

// ── Build ──────────────────────────────────────────────────────────

function buildV3Workspace(workspaceRoot, features) {
  const cargoArgs = ['build', '--release', '--manifest-path', V3_WORKSPACE_MANIFEST];

  // On macOS, AuXpow's native-hashers C code links libomp by default.
  // Homebrew libomp is not available on a clean user machine, so disable
  // OpenMP for DAG generation. This makes DAG generation single-threaded
  // but removes the libomp runtime dependency for the shipped DMG.
  const buildEnv = { ...process.env };
  if (process.platform === 'darwin') {
    buildEnv.ZION_DISABLE_OPENMP = '1';
  }

  // Build miner with GPU features
  const minerArgs = [...cargoArgs, '-p', 'zion-miner'];
  if (features) minerArgs.push('--features', features);

  console.log(`[prepare-v3] Building zion-miner (features=${features || 'default'})...`);
  const minerRes = spawnSync('cargo', minerArgs, { cwd: workspaceRoot, stdio: 'inherit', env: buildEnv });
  if (minerRes.error) throw minerRes.error;
  if (minerRes.status !== 0) {
    // Fallback chain for W11 / mixed environments:
    //   1. If CUDA was requested, retry with OpenCL + native stack.
    //   2. If that fails too, retry with native algorithms but no GPU backend.
    //      (CPU-only still requires native-verushash / native-randomx.)
    if (features && features !== 'default') {
      const fallbackFeatures = features.includes('gpu-cuda')
        ? 'full'
        : 'native-all';
      console.warn(`[prepare-v3] Build with [${features}] failed, retrying with [${fallbackFeatures}]...`);
      const fallbackArgs = [...cargoArgs, '-p', 'zion-miner', '--features', fallbackFeatures];
      const fallbackRes = spawnSync('cargo', fallbackArgs, { cwd: workspaceRoot, stdio: 'inherit', env: process.env });
      if (fallbackRes.error) throw fallbackRes.error;
      if (fallbackRes.status !== 0) {
        console.warn('[prepare-v3] Retrying CPU-only with native algorithms...');
        const cpuFallbackArgs = [...cargoArgs, '-p', 'zion-miner', '--features', 'native-all'];
        const cpuFallbackRes = spawnSync('cargo', cpuFallbackArgs, { cwd: workspaceRoot, stdio: 'inherit', env: process.env });
        if (cpuFallbackRes.error) throw cpuFallbackRes.error;
        if (cpuFallbackRes.status !== 0) throw new Error(`cargo build for zion-miner failed (exit ${cpuFallbackRes.status})`);
      }
    } else {
      throw new Error(`cargo build for zion-miner failed (exit ${minerRes.status})`);
    }
  }

  // Build node
  console.log('[prepare-v3] Building zion-core (node)...');
  const nodeArgs = [...cargoArgs, '-p', 'zion-core', '--bin', 'node'];
  const nodeRes = spawnSync('cargo', nodeArgs, { cwd: workspaceRoot, stdio: 'inherit', env: buildEnv });
  if (nodeRes.error) throw nodeRes.error;
  if (nodeRes.status !== 0) throw new Error(`cargo build for node failed (exit ${nodeRes.status})`);

  // Build CLI
  console.log('[prepare-v3] Building zion-cli...');
  const cliArgs = [...cargoArgs, '-p', 'zion-cli'];
  const cliRes = spawnSync('cargo', cliArgs, { cwd: workspaceRoot, stdio: 'inherit', env: buildEnv });
  if (cliRes.error) throw cliRes.error;
  if (cliRes.status !== 0) throw new Error(`cargo build for zion-cli failed (exit ${cliRes.status})`);
}

// ── Copy ───────────────────────────────────────────────────────────

function copyBinaries(workspaceRoot, resourcesDir) {
  const targetDir = path.join(workspaceRoot, 'V3', 'target', 'release');
  const ext = process.platform === 'win32' ? '.exe' : '';

  let copied = 0;
  for (const spec of BINS) {
    const src = path.join(targetDir, spec.bin + ext);
    const mainDst = path.join(resourcesDir, spec.bin + ext);

    if (!exists(src)) {
      console.warn(`[prepare-v3] Binary not found: ${src}`);
      continue;
    }

    console.log(`[prepare-v3] Copying ${spec.bin}${ext} -> resources/`);
    copyIfExists(src, mainDst);
    copied++;

    // Aliases (e.g. zion-universal-miner for backward compat)
    for (const alias of spec.aliases) {
      const aliasDst = path.join(resourcesDir, alias + ext);
      console.log(`[prepare-v3] Copying alias ${alias}${ext}`);
      copyIfExists(src, aliasDst);
    }
  }

  // Best-effort: copy DLLs that are next to the built exe
  try {
    const files = fs.readdirSync(targetDir);
    const dlls = files.filter((f) => f.toLowerCase().endsWith('.dll'));
    for (const dll of dlls) {
      const src = path.join(targetDir, dll);
      const dst = path.join(resourcesDir, dll);
      console.log(`[prepare-v3] Copying DLL ${dll}`);
      copyIfExists(src, dst);
    }
  } catch { /* ignore */ }

  return copied;
}

// ── Main ───────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);
  const desktopAgentRoot = path.resolve(__dirname, '..');
  const workspaceRoot = path.resolve(desktopAgentRoot, '..', '..');
  const resourcesDir = path.join(desktopAgentRoot, 'resources');
  ensureDir(resourcesDir);

  if (!args.noBuild) {
    console.log('[prepare-v3] Building V3 workspace binaries...');
    buildV3Workspace(workspaceRoot, args.features);
  } else {
    console.log('[prepare-v3] --no-build set; skipping cargo build');
  }

  const copied = copyBinaries(workspaceRoot, resourcesDir);
  console.log(`[prepare-v3] Copied ${copied} binaries to resources/`);

  if (args.requireBinary && copied < BINS.length) {
    throw new Error(`Required binaries missing. Only ${copied}/${BINS.length} found.`);
  }

  console.log('[prepare-v3] Done.');
}

main();
