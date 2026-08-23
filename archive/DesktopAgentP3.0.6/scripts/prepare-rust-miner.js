#!/usr/bin/env node
/*
  Prepares all V31 Mainnet Alpha binaries for the public desktop agent bundle.

  Builds the V31 Rust workspace in release mode and copies the required
  binaries into desktop-agent/resources/ so electron-builder bundles them
  for one-click install on all platforms.

  Public build: the bundled zion-miner is compiled with the `public_build`
  feature, which keeps the UI on a single ZION/Boost stream and hides
  Trinity/AuxPoW coin names (ZANO, VRSC, etc.) while still running the
  external GPU/CPU streams in the background.

  Required binaries:
    - zion-miner / zion-universal-miner  (mining client — CPU/GPU backends)
    - zion-node (aliased as `node`)      (ZION L1 full node — P2P + RPC)
    - zion                               (unified CLI — wallet, send, balance, etc.)

  Platform-aware GPU features:
    macOS (arm64/x86_64) -> public_build,gpu-opencl,gpu-metal,native-all
    Linux/Windows        -> public_build,gpu-opencl,(+gpu-cuda when NVIDIA/NVRTC),native-all

  Usage:
    node scripts/prepare-rust-miner.js [--no-build] [--features <f>] [--require]
    node scripts/prepare-rust-miner.js --auto

  Notes:
    - Requires Rust toolchain + cargo in PATH
    - Output binaries are placed in desktop-agent/resources/
*/

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

// Public release build: the bundled zion-miner is compiled with the
// `public_build` feature, which keeps the UI on a single ZION/Boost stream
// and hides Trinity/AuxPoW coin names (ZANO, VRSC, etc.) while still running
// the external GPU/CPU streams in the background.
const PUBLIC_BUILD = true;

// ── Constants ──────────────────────────────────────────────────────

const BINS = [
  { crate: 'zion-miner',  bin: 'zion-miner',           aliases: [] },
  { crate: 'zion-miner',  bin: 'zion-universal-miner', aliases: [] },
  { crate: 'zion-core',   bin: 'zion-node',            aliases: ['node'] },
  { crate: 'zion-cli',    bin: 'zion',                 aliases: [] },
];

const V31_WORKSPACE_MANIFEST = 'V31/Cargo.toml';

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

function findNvrtcRuntime(workspaceRoot) {
  // The CUDA backend needs NVRTC at runtime (not the full CUDA Toolkit).
  // Look for the redistributable DLLs / shared libraries that ship with the miner
  // or may already be present in the V31 target/release directory.
  const resourcesDir = path.resolve(__dirname, '..', 'resources');
  const targetDir = path.join(workspaceRoot, 'V31', 'target', 'release');
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

function checkCudaCapability(workspaceRoot) {
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
        const nvrtcPath = findNvrtcRuntime(workspaceRoot);
        if (nvrtcPath) {
          result.hasNvrtc = true;
          console.log(`[prepare-v31] NVRTC runtime found: ${nvrtcPath}`);
        }
        const cudaVersion = spawnSync('nvcc', ['--version'], { stdio: 'pipe' });
        if (cudaVersion.status === 0) {
          result.driverVersion += ` (nvcc: ${cudaVersion.stdout.toString().trim().split('\n')[0]})`;
        } else if (result.hasNvrtc) {
          console.log('[prepare-v31] nvidia-smi found GPU and NVRTC runtime available -> building with CUDA backend');
        } else {
          console.log('[prepare-v31] nvidia-smi found GPU but no NVRTC runtime -> building OpenCL/full stack, add nvrtc64_*.dll for CUDA runtime');
        }
      }
    }
  } catch { /* ignore */ }
  return result;
}

function detectPlatformFeatures(workspaceRoot) {
  const platform = process.platform;
  const arch = os.arch();

  // Native algorithm acceleration is always included for public bundles so a
  // single binary can switch coins by changing --pool / --wallet / --algorithm.
  const nativeFeatures = 'native-all';

  // IMPORTANT: gpu-cuda pulls in cudarc which tries to dlopen libcuda at
  // startup. On macOS there is no CUDA driver, so including gpu-cuda causes
  // an immediate panic. The gpu-metal crate is Apple-only, so including it on
  // Linux/Windows causes a build failure. We therefore build per-platform
  // feature sets instead of using the convenience `full` alias.
  if (platform === 'darwin') {
    const macFeatures = `gpu-opencl,gpu-metal,${nativeFeatures}`;
    if (arch === 'arm64') {
      console.log('[prepare-v31] Apple Silicon detected -> Metal + OpenCL + all native (no CUDA — not available on macOS)');
    } else {
      console.log('[prepare-v31] Intel Mac detected -> Metal + OpenCL + all native (no CUDA — not available on macOS)');
    }
    return macFeatures;
  }

  if (platform === 'win32') {
    const cudaCheck = checkCudaCapability(workspaceRoot);
    const forceCuda = String(process.env.ZION_FORCE_CUDA || '').trim() === '1';
    const base = `gpu-opencl,${nativeFeatures}`;
    if (forceCuda || (cudaCheck.hasCuda && cudaCheck.hasNvrtc)) {
      console.log('[prepare-v31] Windows + NVIDIA GPU + NVRTC runtime detected -> public build with CUDA backend');
      return `${base},gpu-cuda`;
    }
    if (cudaCheck.hasCuda && !cudaCheck.hasNvrtc) {
      console.log('[prepare-v31] Windows + NVIDIA GPU but no NVRTC runtime -> OpenCL-only public build (place nvrtc64_*.dll for CUDA)');
    } else {
      console.log('[prepare-v31] Windows detected -> OpenCL + all native hashers');
    }
    return base;
  }

  if (platform === 'linux') {
    const cudaCheck = checkCudaCapability(workspaceRoot);
    const forceCuda = String(process.env.ZION_FORCE_CUDA || '').trim() === '1';
    const base = `gpu-opencl,${nativeFeatures}`;
    if (forceCuda || (cudaCheck.hasCuda && cudaCheck.hasNvrtc)) {
      console.log('[prepare-v31] Linux + NVIDIA CUDA + NVRTC detected -> public build with CUDA backend');
      return `${base},gpu-cuda`;
    }
    if (cudaCheck.hasCuda && !cudaCheck.hasNvrtc) {
      console.log('[prepare-v31] Linux + NVIDIA GPU but no NVRTC runtime -> OpenCL-only public build (add libnvrtc.so for CUDA runtime)');
    } else {
      console.log('[prepare-v31] Linux detected -> OpenCL + all native hashers');
    }
    return base;
  }

  console.log('[prepare-v31] Unknown platform -> OpenCL + all native hashers');
  return `gpu-opencl,${nativeFeatures}`;
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
  return out;
}

// ── Build ──────────────────────────────────────────────────────────

function buildV31Workspace(workspaceRoot, features) {
  const cargoArgs = ['build', '--release', '--manifest-path', V31_WORKSPACE_MANIFEST];

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

  // Build miner with GPU features (both zion-miner and zion-universal-miner bins)
  const minerArgs = [...cargoArgs, '-p', 'zion-miner', '--bin', 'zion-miner', '--bin', 'zion-universal-miner'];
  if (minerFeatures) minerArgs.push('--features', minerFeatures);

  console.log(`[prepare-v31] Building zion-miner (features=${minerFeatures || 'default'})...`);
  const minerRes = spawnSync('cargo', minerArgs, { cwd: workspaceRoot, stdio: 'inherit', env: buildEnv });
  if (minerRes.error) throw minerRes.error;
  if (minerRes.status !== 0) {
    if (features && features.includes('gpu-cuda')) {
      // A CUDA build that falls back to OpenCL would silently ship a broken
      // deeksha_lite_v1 kernel on NVIDIA (observed 43-45 % reject rate on
      // GTX 1070 Ti). Fail loudly instead of hiding it.
      throw new Error(
        `CUDA build for zion-miner failed (exit ${minerRes.status}). ` +
        `Install the CUDA Toolkit or place nvrtc64_*.dll in V31/target/release/. ` +
        `To force OpenCL anyway, run with ZION_FORCE_CUDA=0.`
      );
    }
    if (features && features !== 'default') {
      const fallbackFeatures = PUBLIC_BUILD ? 'public_build,native-all' : 'native-all';
      console.warn(`[prepare-v31] Build with [${features}] failed, retrying with [${fallbackFeatures}]...`);
      const fallbackArgs = [...cargoArgs, '-p', 'zion-miner', '--bin', 'zion-miner', '--bin', 'zion-universal-miner', '--features', fallbackFeatures];
      const fallbackRes = spawnSync('cargo', fallbackArgs, { cwd: workspaceRoot, stdio: 'inherit', env: buildEnv });
      if (fallbackRes.error) throw fallbackRes.error;
      if (fallbackRes.status !== 0) throw new Error(`cargo build for zion-miner failed (exit ${fallbackRes.status})`);
    } else {
      throw new Error(`cargo build for zion-miner failed (exit ${minerRes.status})`);
    }
  }

  // Build node
  console.log('[prepare-v31] Building zion-core (node)...');
  const nodeArgs = [...cargoArgs, '-p', 'zion-core', '--bin', 'zion-node'];
  const nodeRes = spawnSync('cargo', nodeArgs, { cwd: workspaceRoot, stdio: 'inherit', env: buildEnv });
  if (nodeRes.error) throw nodeRes.error;
  if (nodeRes.status !== 0) throw new Error(`cargo build for node failed (exit ${nodeRes.status})`);

  // Build CLI
  console.log('[prepare-v31] Building zion-cli...');
  const cliArgs = [...cargoArgs, '-p', 'zion-cli'];
  const cliRes = spawnSync('cargo', cliArgs, { cwd: workspaceRoot, stdio: 'inherit', env: buildEnv });
  if (cliRes.error) throw cliRes.error;
  if (cliRes.status !== 0) throw new Error(`cargo build for zion-cli failed (exit ${cliRes.status})`);
}

// ── Copy ───────────────────────────────────────────────────────────

function copyBinaries(workspaceRoot, resourcesDir) {
  const targetDir = path.join(workspaceRoot, 'V31', 'target', 'release');
  const ext = process.platform === 'win32' ? '.exe' : '';

  let copied = 0;
  for (const spec of BINS) {
    const src = path.join(targetDir, spec.bin + ext);
    const mainDst = path.join(resourcesDir, spec.bin + ext);

    if (!exists(src)) {
      console.warn(`[prepare-v31] Binary not found: ${src}`);
      continue;
    }

    console.log(`[prepare-v31] Copying ${spec.bin}${ext} -> resources/`);
    copyIfExists(src, mainDst);
    copied++;

    // Aliases (e.g. zion-universal-miner for backward compat, node alias for zion-node)
    for (const alias of spec.aliases) {
      const aliasDst = path.join(resourcesDir, alias + ext);
      console.log(`[prepare-v31] Copying alias ${alias}${ext}`);
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
      console.log(`[prepare-v31] Copying DLL ${dll}`);
      copyIfExists(src, dst);
    }
  } catch { /* ignore */ }

  warnIfCudaRuntimeMissing(dllNames);

  // On Windows MSVC builds, bundle system DLLs that the miner needs at load
  // time but that may not be present on a clean user machine:
  //   - OpenCL.dll      — ICD loader required by the `full` feature
  //   - VCRUNTIME140.dll — MSVC C runtime (usually present but bundle to be safe)
  //   - VCRUNTIME140_1.dll
  if (process.platform === 'win32') {
    const systemDlls = ['OpenCL.dll', 'VCRUNTIME140.dll', 'VCRUNTIME140_1.dll'];
    const sysDir = 'C:\\Windows\\System32';
    for (const dll of systemDlls) {
      const src = path.join(sysDir, dll);
      const dst = path.join(resourcesDir, dll);
      if (exists(src) && !exists(dst)) {
        console.log(`[prepare-v31] Copying system DLL ${dll}`);
        copyIfExists(src, dst);
      }
    }
  }

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
    console.log('[prepare-v31] NVRTC runtime found -> CUDA backend is runtime-ready');
    return;
  }
  console.warn(
    '[prepare-v31] WARNING: no nvrtc64_*.dll next to the miner binary.\n' +
    '[prepare-v31]   The CUDA backend needs NVRTC at runtime; without it the\n' +
    '[prepare-v31]   miner falls back to OpenCL (~6x slower on NVIDIA).\n' +
    '[prepare-v31]   Fix: install the CUDA toolkit, or drop the standalone\n' +
    '[prepare-v31]   cuda_nvrtc redistributable DLLs into V31/target/release/.'
  );
}

// ── Main ───────────────────────────────────────────────────────────

function cleanResources(resourcesDir) {
  // Remove stale cross-platform binaries AND old same-platform known binaries
  // from a previous build so we never package the wrong platform's binaries
  // (e.g. Windows .exe inside a Linux DEB) or bundle stale old versions.
  if (!exists(resourcesDir)) return;

  const isWindows = process.platform === 'win32';
  const ext = isWindows ? '.exe' : '';
  // Derive the set of binaries (and aliases) that this script places in resources/
  const knownBins = [...new Set(BINS.flatMap((s) => [s.bin, ...s.aliases]))];
  const knownWithExt = new Set(knownBins.map((b) => b + ext));
  const knownNoExt = new Set(knownBins); // stale Linux/mac binaries on Windows

  for (const f of fs.readdirSync(resourcesDir)) {
    const fullPath = path.join(resourcesDir, f);
    try {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;

      let remove = false;
      let reason = '';

      if (!isWindows && f.toLowerCase().endsWith('.exe')) {
        remove = true;
        reason = 'stale cross-platform .exe';
      } else if (knownWithExt.has(f)) {
        remove = true;
        reason = 'stale known binary';
      } else if (isWindows && knownNoExt.has(f)) {
        remove = true;
        reason = 'stale non-Windows binary';
      }

      if (remove) {
        console.log(`[prepare-v31] Removing ${reason}: ${f}`);
        fs.unlinkSync(fullPath);
      }
    } catch { /* ignore */ }
  }
}

function main() {
  const args = parseArgs(process.argv);
  const desktopAgentRoot = path.resolve(__dirname, '..');
  // archive/DesktopAgentP3.0.6 -> archive -> project root (where V31/ lives)
  const workspaceRoot = path.resolve(desktopAgentRoot, '..', '..');
  const resourcesDir = path.join(desktopAgentRoot, 'resources');

  if (!args.features || args.autoDetect) {
    args.features = detectPlatformFeatures(workspaceRoot);
  }

  // Clean stale cross-platform binaries BEFORE building/copying
  console.log('[prepare-v31] Cleaning resources/ of stale cross-platform binaries...');
  cleanResources(resourcesDir);
  ensureDir(resourcesDir);

  if (!args.noBuild) {
    console.log('[prepare-v31] Building V31 workspace binaries...');
    buildV31Workspace(workspaceRoot, args.features);
  } else {
    console.log('[prepare-v31] --no-build set; skipping cargo build');
  }

  const copied = copyBinaries(workspaceRoot, resourcesDir);
  console.log(`[prepare-v31] Copied ${copied} binaries to resources/`);

  if (args.requireBinary && copied < BINS.length) {
    throw new Error(`Required binaries missing. Only ${copied}/${BINS.length} found.`);
  }

  console.log('[prepare-v31] Done.');
}

main();
