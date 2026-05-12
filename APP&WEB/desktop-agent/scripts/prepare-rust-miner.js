#!/usr/bin/env node
/*
  Builds the Rust native miner and copies it into desktop-agent/resources/
  so electron-builder bundles it for one-click install on all platforms.

  Platform-aware GPU features:
    macOS (arm64)  → --features gpu-metal                 (Apple Silicon Metal GPU)
    macOS (x86_64) → --features gpu-opencl                (Intel Mac OpenCL)
    Linux          → --features gpu-opencl,gpu-cuda       (OpenCL + NVIDIA CUDA)
    Windows        → --features gpu-opencl,gpu-cuda       (OpenCL + NVIDIA CUDA)

  Usage:
    node scripts/prepare-rust-miner.js [--no-build] [--features <f>] [--require]
    node scripts/prepare-rust-miner.js --auto          # auto-detect platform features

  Notes:
    - Requires Rust toolchain + cargo in PATH (unless --no-build and binary already exists)
    - Output binaries:
        resources/zion-universal-miner(.exe)
        resources/zion-miner(.exe) (alias)
*/

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

/**
 * Detect optimal GPU features for current platform with enhanced CUDA fallback.
 * macOS arm64 → gpu-metal, macOS x64 → gpu-opencl, Linux/Win → gpu-opencl,gpu-cuda with fallback
 */
function detectPlatformFeatures() {
  const platform = process.platform;   // 'darwin', 'linux', 'win32'
  const arch = os.arch();              // 'arm64', 'x64'

  if (platform === 'darwin') {
    if (arch === 'arm64') {
      // Apple Silicon M1/M2/M3/M4/M5 → Metal is 10-30% faster than OpenCL
      console.log('[prepare-rust-miner] 🍎 Apple Silicon detected → enabling Metal GPU');
      return 'gpu-metal';
    }
    // Intel Mac → OpenCL only
    console.log('[prepare-rust-miner] 🖥️  Intel Mac detected → enabling OpenCL GPU');
    return 'gpu-opencl';
  }

  if (platform === 'linux') {
    // Enhanced NVIDIA detection with CUDA capability check
    const cudaCheck = checkCudaCapability();
    if (cudaCheck.hasCuda) {
      console.log('[prepare-rust-miner] 🐧 Linux + NVIDIA CUDA detected → enabling OpenCL + CUDA');
      console.log(`[prepare-rust-miner] 📊 GPU Info: ${cudaCheck.gpuCount} GPUs, Driver: ${cudaCheck.driverVersion}`);
      return 'gpu-opencl,gpu-cuda';
    }
    console.log('[prepare-rust-miner] 🐧 Linux detected → enabling OpenCL GPU (no CUDA)');
    return 'gpu-opencl';
  }

  if (platform === 'win32') {
    // Enhanced Windows CUDA detection
    const cudaCheck = checkCudaCapability();
    const forceCuda = String(process.env.ZION_FORCE_CUDA || '').trim() === '1';

    if (forceCuda || cudaCheck.hasCuda) {
      console.log('[prepare-rust-miner] 🪟 Windows + NVIDIA CUDA detected → enabling OpenCL + CUDA');
      console.log(`[prepare-rust-miner] 📊 GPU Info: ${cudaCheck.gpuCount} GPUs, Driver: ${cudaCheck.driverVersion}`);
      return 'gpu-opencl,gpu-cuda';
    }
    console.log('[prepare-rust-miner] 🪟 Windows detected → enabling OpenCL GPU (safe default)');
    return 'gpu-opencl';
  }

  console.log('[prepare-rust-miner] ⚠️  Unknown platform → enabling OpenCL GPU');
  return 'gpu-opencl';
}

/**
 * Enhanced CUDA capability detection with fallback logic
 */
function checkCudaCapability() {
  const result = {
    hasCuda: false,
    gpuCount: 0,
    driverVersion: 'unknown',
    fallbackReason: null
  };

  try {
    // Check nvidia-smi availability
    const nvSmi = spawnSync('nvidia-smi', ['--query-gpu=count', '--format=csv,noheader,nounits'], { stdio: 'pipe' });
    if (nvSmi.status === 0) {
      const gpuCount = parseInt(nvSmi.stdout.toString().trim());
      if (gpuCount > 0) {
        result.gpuCount = gpuCount;

        // Get driver version
        const driverCheck = spawnSync('nvidia-smi', ['--query-gpu=driver_version', '--format=csv,noheader,nounits'], { stdio: 'pipe' });
        if (driverCheck.status === 0) {
          result.driverVersion = driverCheck.stdout.toString().trim().split('\n')[0];
        }

        // Check CUDA runtime availability
        const cudaVersion = spawnSync('nvcc', ['--version'], { stdio: 'pipe' });
        if (cudaVersion.status === 0) {
          result.hasCuda = true;
          console.log('[prepare-rust-miner] ✅ CUDA toolkit detected');
        } else {
          result.fallbackReason = 'CUDA toolkit not found, falling back to OpenCL';
          console.log('[prepare-rust-miner] ⚠️  CUDA toolkit not found, will use OpenCL fallback');
        }
      }
    } else {
      result.fallbackReason = 'nvidia-smi not available';
    }
  } catch (error) {
    result.fallbackReason = `CUDA detection error: ${error.message}`;
    console.log(`[prepare-rust-miner] ⚠️  CUDA detection failed: ${error.message}`);
  }

  return result;
}

/**
 * Get optimal thread configuration for GPU mining
 */
function getOptimalGpuThreads() {
  const cudaCheck = checkCudaCapability();
  let threads = 2; // safe default

  if (cudaCheck.hasCuda && cudaCheck.gpuCount > 0) {
    // NVIDIA GPUs: more aggressive threading
    threads = Math.min(cudaCheck.gpuCount * 4, 16);
  } else {
    // AMD/Intel GPUs via OpenCL: conservative threading
    threads = Math.max(2, Math.min(Math.max(cudaCheck.gpuCount, 1) * 2, 8));
  }

  console.log(`[prepare-rust-miner] 🧵 Optimal GPU threads: ${threads} (based on ${cudaCheck.gpuCount} GPUs)`);
  return threads;
}

function parseArgs(argv) {
  const out = {
    noBuild: false,
    requireBinary: false,
    features: null,    // null = will auto-detect
    autoDetect: false
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-build') out.noBuild = true;
    else if (a === '--require' || a === '--require-rust') out.requireBinary = true;
    else if (a === '--auto') out.autoDetect = true;
    else if (a === '--features') {
      out.features = String(argv[i + 1] || '').trim();
      i++; // skip next arg (the feature value)
    }
  }

  // Auto-detect if no explicit features specified or --auto flag
  if (!out.features || out.autoDetect) {
    const platformFeatures = detectPlatformFeatures();
    // Always include native-cosmic-harmony for Ekam Deeksha v2 scratchpad support
    out.features = platformFeatures ? `${platformFeatures},native-cosmic-harmony` : 'native-cosmic-harmony';
  }

  return out;
}

function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function isDirectory(dirPath) {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFileIfExists(src, dst) {
  if (!exists(src)) return false;
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
  return true;
}

function copyCanonicalLibAliases(src, dirs, fileNames) {
  for (const dir of dirs) {
    ensureDir(dir);
    for (const fileName of fileNames) {
      const dst = path.join(dir, fileName);
      fs.copyFileSync(src, dst);
      if (process.platform !== 'win32') {
        try { fs.chmodSync(dst, 0o755); } catch { /* ignore */ }
      }
    }
  }
}

function copyFileVariants(srcPaths, destPaths) {
  const existingSrc = srcPaths.find((src) => src && exists(src));
  if (!existingSrc) return false;
  for (const dest of destPaths) {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(existingSrc, dest);
  }
  return true;
}

function main() {
  const args = parseArgs(process.argv);

  const desktopAgentRoot = path.resolve(__dirname, '..');
  const workspaceRoot = path.resolve(desktopAgentRoot, '..', '..');
  const rustMinerRootCandidates = [
    // V3 mainnet miner (preferred)
    path.join(workspaceRoot, 'V3', 'L1', 'miner'),
    // Main workspace layouts
    path.join(workspaceRoot, 'L1', 'miner'),
    path.join(workspaceRoot, 'miner'),
    path.join(workspaceRoot, 'zion-universal-miner'),
    // APP&WEB-local fallback layouts
    path.join(desktopAgentRoot, '..', 'miner'),
    path.join(desktopAgentRoot, '..', 'zion-universal-miner'),
    // Historical folders (legacy)
    path.join(workspaceRoot, '2.9.5', 'zion-universal-miner'),
    path.join(workspaceRoot, '2.9.5OLD', 'zion-universal-miner'),
  ];
  const rustMinerRoot = rustMinerRootCandidates.find((p) => isDirectory(p));
  const cosmicHarmonyRootCandidates = [
    path.join(workspaceRoot, 'V3', 'L1', 'cosmic-harmony'),
    path.join(workspaceRoot, 'L1', 'cosmic-harmony'),
    path.join(workspaceRoot, 'cosmic-harmony'),
    path.join(workspaceRoot, '2.9.5OLD', 'L1', 'cosmic-harmony'),
  ];
  const cosmicHarmonyRoot = cosmicHarmonyRootCandidates.find((p) => isDirectory(p));

  const resourcesDir = path.join(desktopAgentRoot, 'resources');
  ensureDir(resourcesDir);

  // Desktop Agent bundles the miner under a stable name.
  // NOTE: the Rust crate name is `zion-miner`, so `cargo build` typically emits
  // `zion-miner(.exe)`, not `zion-universal-miner(.exe)`.
  const exeName = process.platform === 'win32' ? 'zion-universal-miner.exe' : 'zion-universal-miner';
  const builtExeNames = process.platform === 'win32'
    ? ['zion-miner.exe', 'zion-universal-miner.exe', 'zion-miner', 'zion-universal-miner']
    : ['zion-miner', 'zion-universal-miner'];
  // Cargo workspaces typically place artifacts under the workspace root target/ directory,
  // even when invoked from a member crate.
  const builtBinaryCandidates = (() => {
    const out = [];
    const roots = [
      rustMinerRoot,
      // V3 workspace target (cargo puts V3 binaries here)
      path.join(workspaceRoot, 'V3'),
      workspaceRoot,
      path.join(workspaceRoot, '2.9.5'),
      path.join(workspaceRoot, '2.9.5OLD'),
      path.join(workspaceRoot, '2.9.5OLD', 'zion-universal-miner'),
    ].filter(Boolean);

    for (const r of roots) {
      for (const n of builtExeNames) {
        out.push(path.join(r, 'target', 'release', n));
      }
    }

    return out;
  })();

  const existingResourceCandidates = [
    path.join(resourcesDir, exeName),
    path.join(resourcesDir, process.platform === 'win32' ? 'zion-miner.exe' : 'zion-miner'),
    process.platform === 'win32' ? path.join(resourcesDir, 'zion_native_miner_v2_9.exe') : null
  ];

  if (!args.noBuild) {
    if (!rustMinerRoot) {
      throw new Error(`Rust miner directory not found. Tried: ${rustMinerRootCandidates.join(', ')}`);
    }

    const attemptBuild = (features, isRetry = false) => {
      const cargoArgs = ['build', '--release'];
      if (features) {
        cargoArgs.push('--features', features);
      }

      const featureDesc = features || 'default';
      const retryMsg = isRetry ? ' (retry with fallback)' : '';
      console.log(`[prepare-rust-miner] Building Rust miner in ${rustMinerRoot} (features=${featureDesc})${retryMsg}`);

      const result = spawnSync('cargo', cargoArgs, {
        cwd: rustMinerRoot,
        stdio: 'inherit',
        env: process.env
      });

      return {
        ...result,
        features: features,
        isRetry: isRetry
      };
    };

    let res = attemptBuild(args.features);
    if (res.error) {
      throw res.error;
    }

    if (res.status !== 0) {
      const requested = String(args.features || '').toLowerCase();
      const requestedFeatures = requested.split(',').map((feature) => feature.trim()).filter(Boolean);
      const canFallbackGpu = requestedFeatures.includes('gpu-cuda');

      if (canFallbackGpu && !res.isRetry) {
        console.warn('[prepare-rust-miner] ⚠️ CUDA build failed, retrying with OpenCL-only features=gpu-opencl');
        res = attemptBuild('gpu-opencl', true);

        if (res.status !== 0) {
          console.error('[prepare-rust-miner] ❌ Both CUDA and OpenCL builds failed');
          throw new Error(`cargo build failed with exit code ${res.status} (tried CUDA and OpenCL)`);
        } else {
          console.log('[prepare-rust-miner] ✅ OpenCL fallback build successful');
          // Update features to reflect what actually worked
          args.features = 'gpu-opencl';
        }
      } else {
        throw new Error(`cargo build failed with exit code ${res.status}`);
      }
    }

    if (cosmicHarmonyRoot) {
      console.log(`[prepare-rust-miner] Building canonical Deeksha cdylib in ${cosmicHarmonyRoot}`);
      const libRes = spawnSync('cargo', ['build', '--release'], {
        cwd: cosmicHarmonyRoot,
        stdio: 'inherit',
        env: process.env
      });
      if (libRes.error) {
        throw libRes.error;
      }
      if (libRes.status !== 0) {
        throw new Error(`cargo build for canonical Deeksha cdylib failed with exit code ${libRes.status}`);
      }
    } else {
      console.warn(`[prepare-rust-miner] ⚠️ Canonical Deeksha crate not found. Tried: ${cosmicHarmonyRootCandidates.join(', ')}`);
    }
  } else {
    console.log('[prepare-rust-miner] --no-build set; skipping cargo build');
  }

  const builtBinary = builtBinaryCandidates.find((p) => exists(p));
  let selectedBinary = builtBinary;
  if (!selectedBinary) {
    const existingResourceBinary = existingResourceCandidates.find((p) => p && exists(p));
    if (existingResourceBinary) {
      console.log(`[prepare-rust-miner] Existing miner binary already present: ${existingResourceBinary}`);
      selectedBinary = existingResourceBinary;
    } else {
      const msg = `Rust miner binary not found. Tried: ${builtBinaryCandidates.join(', ')}`;
      if (args.requireBinary) throw new Error(msg);
      console.warn('[prepare-rust-miner] ' + msg);
      return;
    }
  }

  const outMain = path.join(resourcesDir, exeName);
  const outAlias = path.join(resourcesDir, process.platform === 'win32' ? 'zion-miner.exe' : 'zion-miner');

  console.log(`[prepare-rust-miner] Copying ${selectedBinary} -> ${outMain}`);
  copyFileIfExists(selectedBinary, outMain);
  if (process.platform !== 'win32') {
    try { fs.chmodSync(outMain, 0o755); } catch { /* ignore */ }
  }

  console.log(`[prepare-rust-miner] Copying alias -> ${outAlias}`);
  copyFileIfExists(selectedBinary, outAlias);
  if (process.platform !== 'win32') {
    try { fs.chmodSync(outAlias, 0o755); } catch { /* ignore */ }
  }

  // Best-effort: copy any DLLs that are next to the built exe (some toolchains drop runtime deps there)
  try {
    const builtDir = path.dirname(selectedBinary);
    const files = fs.readdirSync(builtDir);
    const dlls = files.filter((f) => f.toLowerCase().endsWith('.dll'));
    for (const dll of dlls) {
      const src = path.join(builtDir, dll);
      const dst = path.join(resourcesDir, dll);
      console.log(`[prepare-rust-miner] Copying DLL ${dll}`);
      copyFileIfExists(src, dst);
    }
  } catch {
    // ignore
  }

  // ═══════════════════════════════════════════════════════════
  // Native mining libraries (dylib/so/dll) — required for CH3
  // ═══════════════════════════════════════════════════════════
  const nativeLibDir = path.join(resourcesDir, 'native-libs');
  const miningLibDir = path.join(resourcesDir, 'mining');
  ensureDir(nativeLibDir);
  ensureDir(miningLibDir);

  // Platform-specific native library extensions
  const libExtMap = {
    darwin: '.dylib',
    linux: '.so',
    win32: '.dll'
  };
  const libExt = libExtMap[process.platform] || '.so';

  // Search for native-libs directory
  const nativeSearchPaths = [
    path.join(workspaceRoot, 'native-libs'),
    path.join(workspaceRoot, 'L1', 'native-libs'),
    path.join(workspaceRoot, 'L1', 'native-libs', 'all'),
    path.join(workspaceRoot, '2.9.5OLD', 'native-libs'),
    rustMinerRoot ? path.join(rustMinerRoot, '..', 'native-libs') : null,
  ].filter(Boolean);

  // Explicitly bundle the Rust cdylib that exports zion_deeksha_hash.
  // Prefer the freshly built target/release artifact over stale legacy libs.
  const explicitNativeLibCandidates = [
    // V3 workspace target (preferred — clean-room mainnet build)
    // Windows Rust cdylib for package `zion-cosmic-harmony` → zion_cosmic_harmony.dll (if crate-type includes cdylib)
    path.join(workspaceRoot, 'V3', 'target', 'release', `zion_cosmic_harmony${libExt}`),
    path.join(workspaceRoot, 'V3', 'target', 'release', `libzion_cosmic_harmony${libExt}`),
    path.join(workspaceRoot, 'V3', 'target', 'release', `libzion_cosmic_harmony_v3${libExt}`),
    path.join(workspaceRoot, 'V3', 'target', 'release', `zion_cosmic_harmony_v3${libExt}`),
    path.join(workspaceRoot, 'V3', 'target', 'release', `libcosmic_harmony${libExt}`),
    // Legacy workspace target
    path.join(workspaceRoot, 'target', 'release', `zion_cosmic_harmony_v3${libExt}`),
    path.join(workspaceRoot, 'target', 'release', `libzion_cosmic_harmony_v3${libExt}`),
    path.join(workspaceRoot, 'target', 'release', `cosmic_harmony_deeksha${libExt}`),
    path.join(workspaceRoot, 'target', 'release', `cosmic_harmony${libExt}`),
    path.join(workspaceRoot, 'L1', 'cosmic-harmony', 'target', 'release', `zion_cosmic_harmony_v3${libExt}`),
    path.join(workspaceRoot, 'L1', 'cosmic-harmony', 'target', 'release', `libzion_cosmic_harmony_v3${libExt}`),
    path.join(workspaceRoot, 'L1', 'cosmic-harmony', 'target', 'release', `cosmic_harmony_deeksha${libExt}`),
    path.join(workspaceRoot, 'L1', 'cosmic-harmony', 'target', 'release', `cosmic_harmony${libExt}`),
    path.join(workspaceRoot, 'L1', 'native-libs', 'all', `zion_cosmic_harmony_v3${libExt}`),
    path.join(workspaceRoot, 'L1', 'native-libs', 'all', `libzion_cosmic_harmony_v3${libExt}`),
    path.join(workspaceRoot, 'L1', `libcosmic_harmony${libExt}`),
  ];
  const explicitDeekshaLib = explicitNativeLibCandidates.find((candidate) => fs.existsSync(candidate));
  if (explicitDeekshaLib) {
    const aliasNames = process.platform === 'win32'
      ? [`cosmic_harmony${libExt}`, `cosmic_harmony_deeksha${libExt}`, `zion_cosmic_harmony_v3${libExt}`]
      : [`libcosmic_harmony${libExt}`, `libcosmic_harmony_deeksha${libExt}`, `libzion_cosmic_harmony_v3${libExt}`];
    const aliasDirs = [nativeLibDir, resourcesDir, miningLibDir];
    try {
      copyCanonicalLibAliases(explicitDeekshaLib, aliasDirs, aliasNames);
      // Also remove quarantine flag on macOS to allow loading
      if (process.platform === 'darwin') {
        for (const dir of aliasDirs) {
          for (const fileName of aliasNames) {
            const dst = path.join(dir, fileName);
            try { require('child_process').execSync(`xattr -dr com.apple.quarantine "${dst}" 2>/dev/null`); } catch {}
          }
        }
      }
      console.log(`[prepare-rust-miner] ✅ Bundled canonical Deeksha lib from ${explicitDeekshaLib}`);
    } catch (e) {
      console.warn(`[prepare-rust-miner] ⚠️ Could not copy canonical Deeksha lib: ${e.message}`);
    }
  } else {
    // V3 `zion-miner` does not need this DLL (OpenCL is in-process). Optional Python fallback may use it if present.
    // `--require` only enforces the Rust miner binary above, not this artifact — the workspace often builds cosmic-harmony as rlib only (no cdylib).
    console.warn(
      '[prepare-rust-miner] ⚠️ No canonical Deeksha native DLL/so/dylib in search paths — Python miner may use slower fallback. (V3 Rust miner is unaffected.)'
    );
  }

  let nativeLibsSource = null;
  for (const p of nativeSearchPaths) {
    if (isDirectory(p)) {
      nativeLibsSource = p;
      break;
    }
  }

  if (nativeLibsSource) {
    console.log(`[prepare-rust-miner] 📦 Bundling native libraries from ${nativeLibsSource}`);
    try {
      const nativeFiles = fs.readdirSync(nativeLibsSource);
      const libs = nativeFiles.filter((f) => f.endsWith(libExt));
      let bundled = 0;
      for (const lib of libs) {
        const src = path.join(nativeLibsSource, lib);
        const dst = path.join(nativeLibDir, lib);
        if (copyFileIfExists(src, dst)) {
          // Ensure libs are executable (macOS/Linux)
          if (process.platform !== 'win32') {
            try { fs.chmodSync(dst, 0o755); } catch { /* ignore */ }
          }
          bundled++;
        }
      }
      console.log(`[prepare-rust-miner] ✅ Bundled ${bundled} native libraries (${libExt})`);

      // Also copy to resources root for PATH-based discovery
      for (const lib of libs) {
        const src = path.join(nativeLibsSource, lib);
        const dst = path.join(resourcesDir, lib);
        copyFileIfExists(src, dst);
        if (process.platform !== 'win32') {
          try { fs.chmodSync(dst, 0o755); } catch { /* ignore */ }
        }
      }
    } catch (err) {
      console.warn(`[prepare-rust-miner] ⚠️ Failed to bundle native libs: ${err.message}`);
    }
  } else {
    console.warn('[prepare-rust-miner] ⚠️ No native-libs directory found — native algorithms will use Rust fallback');
  }

  // ═══════════════════════════════════════════════════════════
  // Canonical GPU kernel assets — keep desktop resources synced with L1/native-libs/all
  // ═══════════════════════════════════════════════════════════
  const canonicalGpuAssetSourceDir = path.join(workspaceRoot, 'L1', 'native-libs', 'all');
  if (isDirectory(canonicalGpuAssetSourceDir)) {
    const gpuAssetCopies = [
      {
        src: [path.join(canonicalGpuAssetSourceDir, 'cosmic_harmony_ekam_deeksha.metal')],
        dest: [path.join(miningLibDir, 'cosmic_harmony_ekam_deeksha.metal')]
      },
      {
        src: [path.join(canonicalGpuAssetSourceDir, 'cosmic_harmony_deeksha.metal')],
        dest: [path.join(miningLibDir, 'cosmic_harmony_deeksha.metal')]
      },
      {
        src: [path.join(canonicalGpuAssetSourceDir, 'cosmic_harmony_deeksha.cl')],
        dest: [
          path.join(miningLibDir, 'cosmic_harmony_deeksha.cl'),
          path.join(miningLibDir, 'cosmic_harmony_deeksha_canonical.cl')
        ]
      },
      {
        src: [path.join(canonicalGpuAssetSourceDir, 'cosmic_harmony_deeksha.cu')],
        dest: [path.join(miningLibDir, 'cosmic_harmony_deeksha.cu')]
      }
    ];

    let syncedGpuAssets = 0;
    for (const asset of gpuAssetCopies) {
      if (copyFileVariants(asset.src, asset.dest)) {
        syncedGpuAssets += 1;
      }
    }
  console.log(`[prepare-rust-miner] ✅ Synced ${syncedGpuAssets} canonical GPU asset groups into desktop resources`);
  } else {
    console.warn('[prepare-rust-miner] ⚠️ Canonical GPU asset source not found at L1/native-libs/all');
  }

  // ═══════════════════════════════════════════════════════════
  // V3 GPU kernel assets — Metal shader from V3 clean-room line
  // ═══════════════════════════════════════════════════════════
  const v3MetalShader = path.join(workspaceRoot, 'V3', 'L1', 'miner', 'src', 'ekam_deeksha.metal');
  const v3OpenClKernel = path.join(workspaceRoot, 'V3', 'L1', 'cosmic-harmony', 'src', 'gpu', 'kernels', 'cosmic_harmony_deeksha.cl');
  let v3AssetsSync = 0;
  if (exists(v3MetalShader)) {
    copyFileIfExists(v3MetalShader, path.join(miningLibDir, 'ekam_deeksha.metal'));
    copyFileIfExists(v3MetalShader, path.join(miningLibDir, 'cosmic_harmony_ekam_deeksha.metal'));
    v3AssetsSync++;
  }
  if (exists(v3OpenClKernel)) {
    copyFileIfExists(v3OpenClKernel, path.join(miningLibDir, 'cosmic_harmony_deeksha.cl'));
    v3AssetsSync++;
  }
  if (v3AssetsSync > 0) {
    console.log(`[prepare-rust-miner] ✅ Synced ${v3AssetsSync} V3 GPU kernel assets`);
  }

  // ═══════════════════════════════════════════════════════════
  // Auto-tuning configuration generation
  // ═══════════════════════════════════════════════════════════
  generateGpuTuningConfig(resourcesDir, args.features);

  console.log('[prepare-rust-miner] Done');
}

/**
 * Generate GPU tuning configuration based on detected hardware
 */
function generateGpuTuningConfig(resourcesDir, features) {
  const tuningConfig = {
    version: "2.9.8",
    generated_at: new Date().toISOString(),
    platform: process.platform,
    arch: os.arch(),
    gpu_features: features,
    recommendations: {}
  };

  // Get optimal thread configuration
  const optimalThreads = getOptimalGpuThreads();
  tuningConfig.recommendations.threads = optimalThreads;

  // GPU-specific optimizations
  const cudaCheck = checkCudaCapability();
  if (cudaCheck.hasCuda) {
    tuningConfig.recommendations.cuda = {
      enabled: true,
      gpu_count: cudaCheck.gpuCount,
      driver_version: cudaCheck.driverVersion,
      thread_distribution: "auto",
      memory_optimization: "aggressive"
    };
  } else {
    tuningConfig.recommendations.opencl = {
      enabled: true,
      fallback_reason: cudaCheck.fallbackReason,
      thread_distribution: "conservative",
      memory_optimization: "balanced"
    };
  }

  // Platform-specific tuning
  if (process.platform === 'darwin') {
    if (os.arch() === 'arm64') {
      tuningConfig.recommendations.metal = {
        enabled: true,
        performance_mode: "high",
        memory_pool: "unified"
      };
    }
  }

  // Mining algorithm recommendations
  tuningConfig.recommendations.algorithms = {
    cosmic_harmony: {
      priority: "high",
      threads: optimalThreads,
      intensity: cudaCheck.hasCuda ? "maximum" : "balanced"
    },
    multi_algo: {
      enabled: true,
      switch_interval_minutes: 15,
      hysteresis_percent: 5.0
    }
  };

  // Write tuning config
  const tuningConfigPath = path.join(resourcesDir, 'gpu-tuning-config.json');
  try {
    fs.writeFileSync(tuningConfigPath, JSON.stringify(tuningConfig, null, 2));
    console.log(`[prepare-rust-miner] ✅ Generated GPU tuning config: ${tuningConfigPath}`);
  } catch (error) {
    console.warn(`[prepare-rust-miner] ⚠️ Failed to write tuning config: ${error.message}`);
  }
}

main();
