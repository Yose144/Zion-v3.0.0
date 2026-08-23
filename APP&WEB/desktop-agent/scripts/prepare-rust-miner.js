#!/usr/bin/env node
/*
  Prepares all V31 Mainnet Alpha binaries for the desktop agent bundle.

  Builds the V31 Rust workspace in release mode and copies the required
  binaries into desktop-agent/resources/ so electron-builder bundles them
  for one-click install on all platforms.

  Required binaries:
    - zion-miner            (mining client — CPU/GPU backends, triple-stream)
    - zion-universal-miner  (same binary, canonical desktop entry point)
    - zion-node             (ZION L1 full node — P2P + RPC; copied as `node` alias)
    - zion                  (unified CLI — wallet, send, balance, mine status, etc.)

  Platform-aware GPU features:
    macOS (arm64)  -> --features gpu-metal
    macOS (x86_64) -> --features gpu-opencl
    Linux/Windows  -> --features gpu-opencl (with optional gpu-cuda when NVIDIA/NVRTC present)

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
  { crate: 'zion-miner',  bin: 'zion-miner',            aliases: [] },
  { crate: 'zion-miner',  bin: 'zion-universal-miner',  aliases: [] },
  { crate: 'zion-core',   bin: 'zion-node',             aliases: ['node'] },
  { crate: 'zion-cli',    bin: 'zion',                  aliases: [] },
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

function findNvrtcRuntime(resourcesDir, workspaceRoot) {
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

function checkCudaCapability(workspaceRoot, resourcesDir) {
  const result = { hasCuda: false, gpuCount: 0, driverVersion: 'unknown', hasNvrtc: false };
  try {
    const nvSmi = spawnSync('nvidia-smi', ['--query-gpu=count', '--format=csv,noheader,nounits'], { stdio: 'pipe' });
    if (nvSmi.status === 0) {
      const gpuCount = parseInt(nvSmi.stdout.toString().trim());
      if (gpuCount > 0) {
        result.gpuCount = gpuCount;
        result.hasCuda = true;
        const driverCheck = spawnSync('nvidia-smi', ['--query-gpu=driver_version', '--format=csv,noheader,nounits'], { stdio: 'pipe' });
        if (driverCheck.status === 0) {
          result.driverVersion = driverCheck.stdout.toString().trim().split('\n')[0];
        }
        const nvrtcPath = findNvrtcRuntime(resourcesDir, workspaceRoot);
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
          console.log('[prepare-v31] nvidia-smi found GPU but no NVRTC runtime -> building OpenCL-only, add nvrtc64_*.dll for CUDA runtime');
        }
      }
    }
  } catch { /* ignore */ }
  return result;
}

function detectPlatformFeatures(workspaceRoot, resourcesDir) {
  const platform = process.platform;
  const arch = os.arch();

  // V31 zion-miner default already enables auxpow. GPU and native algorithm
  // features must be enabled explicitly.
  const nativeFeatures = 'native-all';

  // The desktop agent is the public-facing bundle: always use public_build
  // so the TUI/banner/logs show only ZION + BOOST streams.
  const publicFlag = 'public_build';

  if (platform === 'darwin') {
    if (arch === 'arm64') {
      console.log('[prepare-v31] Apple Silicon detected -> enabling public build with Metal + OpenCL + all native hashers');
      return `${publicFlag},auxpow,gpu-opencl,gpu-metal,${nativeFeatures}`;
    }
    console.log('[prepare-v31] Intel Mac detected -> enabling public build with OpenCL + Metal + all native hashers');
    return `${publicFlag},auxpow,gpu-opencl,gpu-metal,${nativeFeatures}`;
  }

  if (platform === 'win32') {
    const cudaCheck = checkCudaCapability(workspaceRoot, resourcesDir);
    const forceCuda = String(process.env.ZION_FORCE_CUDA || '').trim() === '1';
    const base = `${publicFlag},auxpow,gpu-opencl,${nativeFeatures}`;
    if (forceCuda || (cudaCheck.hasCuda && cudaCheck.hasNvrtc)) {
      console.log('[prepare-v31] Windows + NVIDIA GPU + NVRTC runtime detected -> building public build with CUDA backend');
      return `${base},gpu-cuda`;
    }
    if (cudaCheck.hasCuda && !cudaCheck.hasNvrtc) {
      console.log('[prepare-v31] Windows + NVIDIA GPU detected but no NVRTC runtime -> OpenCL-only public build (place nvrtc64_*.dll in resources for CUDA)');
    } else {
      console.log('[prepare-v31] Windows detected -> enabling public build with OpenCL + native hashers');
    }
    return base;
  }

  if (platform === 'linux') {
    const cudaCheck = checkCudaCapability(workspaceRoot, resourcesDir);
    const forceCuda = String(process.env.ZION_FORCE_CUDA || '').trim() === '1';
    const base = `${publicFlag},auxpow,gpu-opencl,${nativeFeatures}`;
    if (forceCuda || (cudaCheck.hasCuda && cudaCheck.hasNvrtc)) {
      console.log('[prepare-v31] Linux + NVIDIA CUDA + NVRTC detected -> building public build with CUDA backend');
      return `${base},gpu-cuda`;
    }
    console.log('[prepare-v31] Linux detected -> enabling public build with OpenCL + native hashers');
    return base;
  }

  console.log('[prepare-v31] Unknown platform -> enabling public build with OpenCL + native hashers');
  return `${publicFlag},auxpow,gpu-opencl,${nativeFeatures}`;
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

  const buildEnv = { ...process.env };
  if (process.platform === 'darwin') {
    buildEnv.ZION_DISABLE_OPENMP = '1';
  }

  // Build zion-miner + zion-universal-miner
  const minerArgs = [...cargoArgs, '-p', 'zion-miner', '--bin', 'zion-miner', '--bin', 'zion-universal-miner'];
  if (features) minerArgs.push('--features', features);

  console.log(`[prepare-v31] Building zion-miner (features=${features || 'default'})...`);
  const minerRes = spawnSync('cargo', minerArgs, { cwd: workspaceRoot, stdio: 'inherit', env: buildEnv });
  if (minerRes.error) throw minerRes.error;
  if (minerRes.status !== 0) {
    if (features && features.includes('gpu-cuda')) {
      throw new Error(
        `CUDA build for zion-miner failed (exit ${minerRes.status}). ` +
        `Install the CUDA Toolkit or place nvrtc64_*.dll in V31/target/release/. ` +
        `To force OpenCL anyway, run with ZION_FORCE_CUDA=0.`
      );
    }
    if (features && features !== 'default') {
      const fallbackFeatures = 'public_build,native-all';
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
  //   - OpenCL.dll       — ICD loader required by the OpenCL backend
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
    '[prepare-v31]   miner falls back to OpenCL.\n' +
    '[prepare-v31]   Fix: install the CUDA toolkit, or drop the standalone\n' +
    '[prepare-v31]   cuda_nvrtc redistributable DLLs into V31/target/release/.'
  );
}

function cleanResources(resourcesDir) {
  // Remove stale cross-platform binaries from a previous build so we do not
  // package the wrong platform's binaries (e.g. Windows .exe inside a Linux DEB).
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

// ── Main ───────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);
  const desktopAgentRoot = path.resolve(__dirname, '..');
  const workspaceRoot = path.resolve(desktopAgentRoot, '..', '..');
  const resourcesDir = path.join(desktopAgentRoot, 'resources');

  // Clean stale cross-platform binaries BEFORE building or copying
  console.log('[prepare-v31] Cleaning resources/ of stale cross-platform binaries...');
  cleanResources(resourcesDir);
  ensureDir(resourcesDir);

  const features = args.features || detectPlatformFeatures(workspaceRoot, resourcesDir);

  if (!args.noBuild) {
    console.log('[prepare-v31] Building V31 workspace binaries...');
    buildV31Workspace(workspaceRoot, features);
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
