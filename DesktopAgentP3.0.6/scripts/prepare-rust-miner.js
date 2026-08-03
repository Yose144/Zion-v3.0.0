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

// Public release build: the bundled zion-miner is compiled with the
// `public_build` feature, which keeps the UI on a single ZION/Deeksha stream
// and hides Trinity/AuxPoW coin names (ZANO, VRSC, etc.) while still running
// the external GPU/CPU streams in the background.
const PUBLIC_BUILD = true;

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
  // Full native stack for Windows — all algorithms including RandomX (XMR)
  // and GhostRider (RTM).  The previous command-line length limit issue was
  // resolved by using the `full` feature alias which Cargo expands server-side.
  return 'full';
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
    if (forceCuda || (cudaCheck.hasCuda && cudaCheck.hasNvrtc)) {
      console.log('[prepare-v3] Windows + NVIDIA GPU + NVRTC runtime detected -> building with CUDA backend');
      return `${winFeatures},gpu-cuda`;
    }
    if (cudaCheck.hasCuda && !cudaCheck.hasNvrtc) {
      console.log('[prepare-v3] Windows + NVIDIA GPU detected but no NVRTC runtime -> OpenCL-only build (place nvrtc64_*.dll in resources for CUDA)');
    } else {
      console.log('[prepare-v3] Windows detected -> enabling focused native stack for W11 triple-stream (OpenCL)');
    }
    return winFeatures;
  }

  if (platform === 'linux') {
    const cudaCheck = checkCudaCapability();
    const forceCuda = String(process.env.ZION_FORCE_CUDA || '').trim() === '1';
    if (forceCuda || (cudaCheck.hasCuda && cudaCheck.hasNvrtc)) {
      console.log('[prepare-v3] Linux + NVIDIA CUDA + NVRTC detected -> building with CUDA backend');
      return `${base},gpu-cuda`;
    }
    console.log('[prepare-v3] Linux detected -> enabling full native stack (OpenCL, safe default)');
    return base;
  }

  console.log('[prepare-v3] Unknown platform -> enabling full native stack (OpenCL)');
  return base;
}

function findNvrtcRuntime() {
  // The CUDA backend needs NVRTC at runtime (not the full CUDA Toolkit).
  // Look for the redistributable DLLs / shared libraries that ship with the miner
  // or may already be present in the target/release directory.
  const resourcesDir = path.resolve(__dirname, '..', 'resources');
  const targetDir = path.resolve(__dirname, '..', '..', 'V3', 'target', 'release');
  const isWindows = process.platform === 'win32';
  const searchPaths = isWindows
    ? [resourcesDir, targetDir]
    : [resourcesDir, targetDir, '/usr/lib/x86_64-linux-gnu', '/usr/local/cuda/lib64', '/usr/lib'];
  const nvrtcPattern = isWindows ? /^nvrtc64_.*\.dll$/i : /^libnvrtc\.so/i;
  for (const dir of searchPaths) {
    try {
      const files = fs.readdirSync(dir);
      const nvrtc = files.find((f) => nvrtcPattern.test(f));
      if (nvrtc) return path.join(dir, nvrtc);
    } catch { /* ignore */ }
  }
  // Fallback: search PATH
  const pathDirs = (process.env.PATH || '').split(path.delimiter);
  for (const dir of pathDirs) {
    try {
      const files = fs.readdirSync(dir);
      const nvrtc = files.find((f) => nvrtcPattern.test(f));
      if (nvrtc) return path.join(dir, nvrtc);
    } catch { /* ignore */ }
  }
  return null;
}

function checkCudaCapability() {
  const result = { hasCuda: false, gpuCount: 0, driverVersion: 'unknown', hasNvrtc: false };
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
        // NVRTC (runtime JIT compiler) is what the miner actually uses. It is
        // bundled as the standalone ~40 MB cuda_nvrtc redistributable, no full
        // 3 GB CUDA Toolkit required. Prefer a local copy over nvcc.
        const nvrtcPath = findNvrtcRuntime();
        if (nvrtcPath) {
          result.hasNvrtc = true;
          console.log(`[prepare-v3] NVRTC runtime found: ${nvrtcPath}`);
        }
        const cudaVersion = spawnSync('nvcc', ['--version'], { stdio: 'pipe' });
        if (cudaVersion.status === 0) {
          result.driverVersion += ` (nvcc: ${cudaVersion.stdout.toString().trim().split('\n')[0]})`;
        } else if (result.hasNvrtc) {
          console.log('[prepare-v3] nvidia-smi found GPU and NVRTC runtime available -> building with CUDA backend');
        } else {
          console.log('[prepare-v3] nvidia-smi found GPU but no NVRTC runtime -> building OpenCL/full stack, add nvrtc64_*.dll for CUDA runtime');
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

  // Public build compiles the public_build feature into zion-miner.
  // This suppresses external coin names in the UI while keeping the Trinity
  // streams 2/3 active for revenue.
  let minerFeatures = features;
  if (PUBLIC_BUILD && minerFeatures) {
    minerFeatures = minerFeatures.startsWith('public_build')
      ? minerFeatures
      : `public_build,${minerFeatures}`;
  } else if (PUBLIC_BUILD) {
    minerFeatures = 'public_build';
  }

  // Build miner with GPU features
  const minerArgs = [...cargoArgs, '-p', 'zion-miner'];
  if (minerFeatures) minerArgs.push('--features', minerFeatures);

  console.log(`[prepare-v3] Building zion-miner (features=${minerFeatures || 'default'})...`);
  const minerRes = spawnSync('cargo', minerArgs, { cwd: workspaceRoot, stdio: 'inherit', env: buildEnv });
  if (minerRes.error) throw minerRes.error;
  if (minerRes.status !== 0) {
    if (features && features.includes('gpu-cuda')) {
      // A CUDA build that falls back to OpenCL would silently ship a broken
      // deeksha_lite_v1 kernel on NVIDIA (observed 43-45 % reject rate on
      // GTX 1070 Ti). Fail loudly instead of hiding it.
      throw new Error(
        `CUDA build for zion-miner failed (exit ${minerRes.status}). ` +
        `Install the CUDA Toolkit or place nvrtc64_*.dll in V3/target/release/. ` +
        `To force OpenCL anyway, run with ZION_FORCE_CUDA=0.`
      );
    }
    if (features && features !== 'default') {
      const fallbackFeatures = PUBLIC_BUILD ? 'public_build,native-all' : 'native-all';
      console.warn(`[prepare-v3] Build with [${features}] failed, retrying with [${fallbackFeatures}]...`);
      const fallbackArgs = [...cargoArgs, '-p', 'zion-miner', '--features', fallbackFeatures];
      const fallbackRes = spawnSync('cargo', fallbackArgs, { cwd: workspaceRoot, stdio: 'inherit', env: process.env });
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
  let dllNames = [];
  try {
    const files = fs.readdirSync(targetDir);
    dllNames = files.filter((f) => f.toLowerCase().endsWith('.dll'));
    for (const dll of dllNames) {
      const src = path.join(targetDir, dll);
      const dst = path.join(resourcesDir, dll);
      console.log(`[prepare-v3] Copying DLL ${dll}`);
      copyIfExists(src, dst);
    }
  } catch { /* ignore */ }

  warnIfCudaRuntimeMissing(dllNames);

  return copied;
}

/**
 * The CUDA backend JIT-compiles its kernels through NVRTC, so a build with
 * `gpu-cuda` is useless at runtime unless `nvrtc64_*.dll` ships alongside the
 * miner. The NVIDIA driver does NOT provide it — it comes from the CUDA
 * toolkit or the standalone `cuda_nvrtc` redistributable.
 *
 * Without NVRTC the miner initialises a CUDA device, fails at kernel compile
 * time and falls back all the way to CPU, so surface this loudly at build time.
 */
function warnIfCudaRuntimeMissing(dllNames) {
  if (process.platform !== 'win32') return;
  if (dllNames.some((f) => /^nvrtc64_.*\.dll$/i.test(f))) {
    console.log('[prepare-v3] NVRTC runtime found -> CUDA backend is runtime-ready');
    return;
  }
  console.warn(
    '[prepare-v3] WARNING: no nvrtc64_*.dll next to the miner binary.\n' +
    '[prepare-v3]   The CUDA backend needs NVRTC at runtime; without it the\n' +
    '[prepare-v3]   miner falls back to OpenCL (~6x slower on NVIDIA).\n' +
    '[prepare-v3]   Fix: install the CUDA toolkit, or drop the standalone\n' +
    '[prepare-v3]   cuda_nvrtc redistributable DLLs into V3/target/release/.'
  );
}

// ── Main ───────────────────────────────────────────────────────────

function cleanResources(resourcesDir) {
  // Remove any stale binaries from a previous platform build to prevent
  // cross-platform contamination (e.g. Windows .exe ending up in a Linux DEB).
  if (!exists(resourcesDir)) return;
  const ext = process.platform === 'win32' ? '.exe' : '';
  const staleExts = process.platform === 'win32' ? [''] : ['.exe'];
  for (const f of fs.readdirSync(resourcesDir)) {
    const fullPath = path.join(resourcesDir, f);
    try {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      // Remove files with wrong extension (e.g. .exe on Linux/Mac)
      if (staleExts.some(e => f.endsWith(e))) {
        console.log(`[prepare-v3] Removing stale cross-platform binary: ${f}`);
        fs.unlinkSync(fullPath);
        continue;
      }
      // Remove known binaries (with correct extension) so we don't bundle old versions
      const knownBins = ['zion-miner', 'zion-universal-miner', 'node', 'zion'];
      if (knownBins.some(b => f === b + ext)) {
        fs.unlinkSync(fullPath);
      }
    } catch { /* ignore */ }
  }
}

function main() {
  const args = parseArgs(process.argv);
  const desktopAgentRoot = path.resolve(__dirname, '..');
  const workspaceRoot = path.resolve(desktopAgentRoot, '..');
  const resourcesDir = path.join(desktopAgentRoot, 'resources');

  // Clean stale cross-platform binaries BEFORE building/copying
  console.log('[prepare-v3] Cleaning resources/ of stale cross-platform binaries...');
  cleanResources(resourcesDir);
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
