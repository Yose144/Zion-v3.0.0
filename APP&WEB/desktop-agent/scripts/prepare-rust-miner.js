#!/usr/bin/env node
/*
  Builds the Rust native miner and copies it into desktop-agent/resources/
  so electron-builder bundles it for one-click install on all platforms.

  Platform-aware GPU features:
    macOS (arm64)  → --features metal     (Apple Silicon M1-M5 Metal GPU)
    macOS (x86_64) → --features gpu       (OpenCL fallback)
    Linux          → --features gpu,cuda  (OpenCL + NVIDIA CUDA)
    Windows        → --features gpu,cuda  (OpenCL + NVIDIA CUDA)

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
 * Detect optimal GPU features for current platform.
 * macOS arm64 → metal, macOS x64 → gpu (OpenCL), Linux/Win → gpu,cuda
 */
function detectPlatformFeatures() {
  const platform = process.platform;   // 'darwin', 'linux', 'win32'
  const arch = os.arch();              // 'arm64', 'x64'

  if (platform === 'darwin') {
    if (arch === 'arm64') {
      // Apple Silicon M1/M2/M3/M4/M5 → Metal is 10-30% faster than OpenCL
      console.log('[prepare-rust-miner] 🍎 Apple Silicon detected → enabling Metal GPU');
      return 'metal';
    }
    // Intel Mac → OpenCL only
    console.log('[prepare-rust-miner] 🖥️  Intel Mac detected → enabling OpenCL GPU');
    return 'gpu';
  }

  if (platform === 'linux') {
    // Check if nvidia-smi exists → enable CUDA too
    const nv = spawnSync('which', ['nvidia-smi'], { stdio: 'pipe' });
    if (nv.status === 0) {
      console.log('[prepare-rust-miner] 🐧 Linux + NVIDIA detected → enabling OpenCL + CUDA');
      return 'gpu,cuda';
    }
    console.log('[prepare-rust-miner] 🐧 Linux detected → enabling OpenCL GPU');
    return 'gpu';
  }

  if (platform === 'win32') {
    const forceCuda = String(process.env.ZION_FORCE_CUDA || '').trim() === '1';
    if (forceCuda) {
      console.log('[prepare-rust-miner] 🪟 Windows detected → enabling OpenCL + CUDA (forced)');
      return 'gpu,cuda';
    }
    console.log('[prepare-rust-miner] 🪟 Windows detected → enabling OpenCL GPU (safe default)');
    return 'gpu';
  }

  console.log('[prepare-rust-miner] ⚠️  Unknown platform → enabling OpenCL GPU');
  return 'gpu';
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
    out.features = detectPlatformFeatures();
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

function main() {
  const args = parseArgs(process.argv);

  const desktopAgentRoot = path.resolve(__dirname, '..');
  const workspaceRoot = path.resolve(desktopAgentRoot, '..', '..');
  const rustMinerRootCandidates = [
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

  const resourcesDir = path.join(desktopAgentRoot, 'resources');
  ensureDir(resourcesDir);

  // Desktop Agent bundles the miner under a stable name.
  // NOTE: the Rust crate name is `zion-miner`, so `cargo build` typically emits
  // `zion-miner(.exe)`, not `zion-universal-miner(.exe)`.
  const exeName = process.platform === 'win32' ? 'zion-universal-miner.exe' : 'zion-universal-miner';
  const builtExeNames = process.platform === 'win32'
    ? ['zion-universal-miner.exe', 'zion-miner.exe', 'zion-universal-miner', 'zion-miner']
    : ['zion-universal-miner', 'zion-miner'];
  // Cargo workspaces typically place artifacts under the workspace root target/ directory,
  // even when invoked from a member crate.
  const builtBinaryCandidates = (() => {
    const out = [];
    const roots = [
      rustMinerRoot,
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

    const attemptBuild = (features) => {
      const cargoArgs = ['build', '--release'];
      if (features) {
        cargoArgs.push('--features', features);
      }
      console.log(`[prepare-rust-miner] Building Rust miner in ${rustMinerRoot} (features=${features || 'default'})`);
      return spawnSync('cargo', cargoArgs, {
        cwd: rustMinerRoot,
        stdio: 'inherit',
        env: process.env
      });
    };

    let res = attemptBuild(args.features);
    if (res.error) {
      throw res.error;
    }
    if (res.status !== 0) {
      const requested = String(args.features || '').toLowerCase();
      const canFallbackGpu = requested.includes('cuda') && requested !== 'gpu';
      if (canFallbackGpu) {
        console.warn('[prepare-rust-miner] ⚠️ CUDA build failed, retrying with OpenCL-only features=gpu');
        res = attemptBuild('gpu');
      }
      if (res.error) {
        throw res.error;
      }
      if (res.status !== 0) {
        throw new Error(`cargo build failed with exit code ${res.status}`);
      }
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
  ensureDir(nativeLibDir);

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

  console.log('[prepare-rust-miner] Done');
}

main();
