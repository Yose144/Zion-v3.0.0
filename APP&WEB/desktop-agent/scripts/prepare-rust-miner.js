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

function detectPlatformFeatures() {
  const platform = process.platform;
  const arch = os.arch();
  // Native CPU algorithm acceleration is required for triple-stream CPU coins
  // (VerusHash/VRSC, RandomX/XMR, GhostRider/RTM) to hash at full speed.
  // native-hashers is required for DAG-based external algorithms on GPU
  // (ProgPoWZ/ZANO on Metal, Ethash/KawPow on OpenCL/CUDA).
  const nativeFeatures = 'native-all,native-hashers';

  if (platform === 'darwin') {
    if (arch === 'arm64') {
      console.log('[prepare-v3] Apple Silicon detected -> enabling Metal GPU + native-all,native-hashers');
      return `gpu-metal,${nativeFeatures}`;
    }
    console.log('[prepare-v3] Intel Mac detected -> enabling OpenCL GPU + native-all,native-hashers');
    return `gpu-opencl,${nativeFeatures}`;
  }

  if (platform === 'linux' || platform === 'win32') {
    const cudaCheck = checkCudaCapability();
    const forceCuda = String(process.env.ZION_FORCE_CUDA || '').trim() === '1';
    if (forceCuda || cudaCheck.hasCuda) {
      console.log(`[prepare-v3] ${platform === 'win32' ? 'Windows' : 'Linux'} + NVIDIA CUDA detected -> enabling OpenCL + CUDA + native-all,native-hashers`);
      return `gpu-opencl,gpu-cuda,${nativeFeatures}`;
    }
    console.log(`[prepare-v3] ${platform === 'win32' ? 'Windows' : 'Linux'} detected -> enabling OpenCL GPU + native-all,native-hashers`);
    return `gpu-opencl,${nativeFeatures}`;
  }

  console.log('[prepare-v3] Unknown platform -> enabling OpenCL GPU + native-all,native-hashers');
  return `gpu-opencl,${nativeFeatures}`;
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
        const cudaVersion = spawnSync('nvcc', ['--version'], { stdio: 'pipe' });
        if (cudaVersion.status === 0) {
          result.driverVersion += ` (nvcc: ${cudaVersion.stdout.toString().trim().split('\n')[0]})`;
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
    // Fallback: retry without GPU features
    if (features && features !== 'default') {
      console.warn('[prepare-v3] GPU build failed, retrying with CPU-only...');
      const fallbackArgs = [...cargoArgs, '-p', 'zion-miner'];
      const fallbackRes = spawnSync('cargo', fallbackArgs, { cwd: workspaceRoot, stdio: 'inherit', env: buildEnv });
      if (fallbackRes.error) throw fallbackRes.error;
      if (fallbackRes.status !== 0) throw new Error(`cargo build for zion-miner failed (exit ${fallbackRes.status})`);
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
