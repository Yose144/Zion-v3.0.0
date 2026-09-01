/**
 * ZION Desktop Agent — Terminal UI (TUI) Mode
 *
 * Launches the built-in V31 miner ratatui TUI (`--interactive`).
 *
 * Usage:
 *   npm run tui
 *   node src/tui/index.js
 *
 * Configuration is read from the desktop agent's `miner_config.json`:
 *   - wallet / payoutAddress / address
 *   - worker / workerName
 *   - pool (object: {host, port} or string)
 *   - threads
 *   - gpu (boolean) / gpuBackend
 *   - tripleStream (boolean)
 *   - autonomous (boolean)
 *
 * If no wallet is configured, the script exits with instructions.
 *
 * Keyboard shortcuts are handled by the miner itself:
 *   q / Esc    quit
 *   p          pause/resume (planned)
 *   1-9        thread count (planned)
 *   r          reconnect (planned)
 *   i          hardware info (planned)
 *   v          verbose (planned)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// ── Paths ──
// src/tui -> src -> desktop-agent -> APP&WEB -> repo root
const APP_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const IS_PACKAGED = !!process.versions.electron;
const HOME = os.homedir();

function userDataDir() {
  if (process.env.ZION_DATA_DIR) return process.env.ZION_DATA_DIR;
  if (IS_PACKAGED) {
    // Electron packaged mode: resourcesPath is provided by Electron.
    // Fall through to platform defaults, which is what a packaged terminal
    // invocation would also use.
  }
  if (process.platform === 'darwin') {
    return path.join(HOME, 'Library', 'Application Support', 'zion-desktop-agent');
  }
  if (process.platform === 'win32') {
    return path.join(HOME, 'AppData', 'Roaming', 'zion-desktop-agent');
  }
  return path.join(HOME, '.config', 'zion-desktop-agent');
}

function findConfigPath() {
  const envDir = process.env.ZION_DATA_DIR;
  if (envDir) return path.join(envDir, 'miner_config.json');

  const candidates = [
    path.join(HOME, '.zion-miner', 'miner_config.json'),
    path.join(userDataDir(), 'miner_config.json'),
    path.join(HOME, 'Library', 'Application Support', 'ZION Miner', 'miner_config.json'),
    path.join(HOME, 'AppData', 'Roaming', 'ZION Miner', 'miner_config.json'),
    path.join(HOME, '.config', 'ZION Miner', 'miner_config.json'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // Default to the legacy ~/.zion-miner location if nothing exists.
  return candidates[0];
}

const CONFIG_PATH = findConfigPath();
const CONFIG_DIR = path.dirname(CONFIG_PATH);

// ── Miner binary discovery (mirrors main.js findRustMiner) ──
function findRustMiner() {
  const names = process.platform === 'win32' ? ['zion-miner.exe'] : ['zion-miner', 'zion-universal-miner'];
  const searchPaths = IS_PACKAGED
    ? [process.resourcesPath]
    : [
        // Prefer the freshly built V31 workspace binary over a stale
        // resources/ copy during development.
        path.join(APP_ROOT, 'V31', 'target', 'release'),
        path.join(APP_ROOT, 'target', 'release'),
        path.join(APP_ROOT, 'APP&WEB', 'desktop-agent', 'resources'),
        path.join(APP_ROOT, 'V31', 'L1', 'miner', 'target', 'release'),
      ];
  for (const name of names) {
    for (const sp of searchPaths) {
      const fp = path.join(sp, name);
      if (fs.existsSync(fp)) return fp;
    }
  }
  return null;
}

// ── Config ──
const DEFAULT_CONFIG = {
  pool: { host: '62.171.141.136', port: 8444 },
  wallet: '',
  worker: 'desktop-tui',
  threads: Math.max(1, (Array.isArray(os.cpus?.()) ? os.cpus().length : 4) - 1),
  // Default to CPU for a safe out-of-the-box TUI experience on all platforms.
  // Users can set gpuBackend to "auto", "opencl", "metal", or "cuda" to enable GPU.
  gpu: false,
  gpuBackend: 'cpu',
  tripleStream: false,
  autonomous: false,
};

function parsePool(pool) {
  if (typeof pool === 'string') {
    const [host, port] = pool.split(':');
    return { host: host || '62.171.141.136', port: parseInt(port || '8444', 10) };
  }
  if (pool && typeof pool === 'object') {
    return {
      host: pool.host || '62.171.141.136',
      port: Number(pool.port) || 8444,
    };
  }
  return { ...DEFAULT_CONFIG.pool };
}

function loadConfig() {
  let disk = {};
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      disk = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('WARNING: failed to load config:', err.message);
  }

  const pool = parsePool(disk.pool || DEFAULT_CONFIG.pool);
  const wallet = String(disk.wallet || disk.payoutAddress || disk.address || DEFAULT_CONFIG.wallet).trim();
  const worker = String(disk.worker || disk.workerName || DEFAULT_CONFIG.worker).trim();
  const threads = Number(disk.threads) || DEFAULT_CONFIG.threads;

  const gpu = disk.gpu !== undefined ? !!disk.gpu : DEFAULT_CONFIG.gpu;
  const gpuBackend = String(disk.gpuBackend || disk.backend || DEFAULT_CONFIG.gpuBackend).trim().toLowerCase();
  const tripleStream = !!disk.tripleStream;
  const autonomous = !!disk.autonomous;

  return {
    pool,
    wallet,
    worker,
    threads,
    gpu,
    gpuBackend,
    tripleStream,
    autonomous,
  };
}

function sanitizeWorkerName(raw) {
  return String(raw || 'desktop-tui')
    .trim()
    .replace(/[^a-zA-Z0-9_.\-=@]/g, '')
    .slice(0, 32) || 'desktop-tui';
}

function saveConfig(config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    const persist = {
      pool: config.pool,
      wallet: config.wallet,
      worker: config.worker,
      threads: config.threads,
      gpu: config.gpu,
      gpuBackend: config.gpuBackend,
      tripleStream: config.tripleStream,
      autonomous: config.autonomous,
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(persist, null, 2));
  } catch (err) {
    console.error('WARNING: failed to save config:', err.message);
  }
}

// ── Main TUI launcher ──
async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('ERROR: This TUI must be run from an interactive terminal.');
    console.error('       Run: npm run tui   (not from a non-TTY pipe)');
    process.exit(1);
  }

  const minerPath = findRustMiner();
  if (!minerPath) {
    console.error('ERROR: zion-miner binary not found.');
    console.error('       Build it first with:');
    console.error('  cd V31 && cargo build --release -p zion-miner --bin zion-miner --features public_build,native-all,tui');
    console.error('       Or use the desktop agent build:');
    console.error('  npm run prepare:rust-miner');
    process.exit(1);
  }

  const config = loadConfig();

  if (!config.wallet) {
    console.error('ERROR: No ZION wallet address configured.');
    console.error('       Set it in the desktop agent Settings / Wallet tab,');
    console.error('       or edit:', CONFIG_PATH);
    process.exit(1);
  }

  const pool = `${config.pool.host}:${config.pool.port}`;
  const worker = sanitizeWorkerName(config.worker);

  // The miner resolves the GPU backend from env if --gpu is not supplied.
  // "cpu" means the ZION PoW runs on CPU; "auto" tries CUDA/OpenCL/Metal.
  let selectedBackend = config.gpuBackend;
  if (!selectedBackend || selectedBackend === 'opencl' || selectedBackend === 'auto') {
    if (!config.gpu) {
      selectedBackend = 'cpu';
    } else if (!selectedBackend || selectedBackend === 'opencl') {
      selectedBackend = 'auto';
    }
  }

  const args = [
    '--pool', pool,
    '--wallet', config.wallet,
    '--worker', worker,
    '--threads', String(config.threads),
    '--metrics', '127.0.0.1:9116',
    '--log-interval', '30',
    '--interactive',
  ];

  if (!config.tripleStream) {
    // Pure ZION mode: disable merged AuxPoW streams.
    args.push('--no-gpu', '--no-cpu');
  } else if (!config.gpu) {
    // Trinity mode without a GPU: only CPU external stream.
    args.push('--no-gpu');
  }

  if (config.tripleStream) {
    args.push('--v3-trinity');
  }

  if (config.tripleStream && config.autonomous) {
    args.push('--autonomous');
  }

  const env = {
    ...process.env,
    ZION_POOL_ADDR: pool,
    ZION_WORKER: worker,
    ZION_WORKER_NAME: worker,
    ZION_MINER_THREADS: String(config.threads),
    ZION_GPU_BACKEND: selectedBackend,
    ZION_BACKEND: selectedBackend,
    ZION_AUTONOMOUS: config.tripleStream && config.autonomous ? '1' : '0',
    ZION_PROFIT_INTERVAL: '300',
    // Keep terminal quiet so the ratatui TUI is not corrupted by tracing output.
    // Users can override via RUST_LOG if they need logs for debugging.
    RUST_LOG: process.env.RUST_LOG || 'error',
  };

  // Persist any resolved defaults (e.g. default pool) so the GUI sees the same values.
  saveConfig({ ...config, worker });

  console.log(`[TUI] Miner: ${minerPath}`);
  console.log(`[TUI] Pool:  ${pool}`);
  console.log(`[TUI] Wallet: ${config.wallet}`);
  console.log(`[TUI] Worker: ${worker}`);
  console.log(`[TUI] Threads: ${config.threads}`);
  console.log(`[TUI] Backend: ${selectedBackend}`);
  console.log('[TUI] Press q or Esc in the miner TUI to quit.\n');

  const child = spawn(minerPath, args, {
    env,
    stdio: 'inherit',
    cwd: APP_ROOT,
  });

  let childExited = false;
  child.on('exit', (code, signal) => {
    childExited = true;
    if (signal) {
      console.error(`\n[TUI] Miner exited on signal ${signal}`);
      process.exit(0);
    } else if (code !== 0 && code !== null) {
      console.error(`\n[TUI] Miner exited with code ${code}`);
      process.exit(code);
    } else {
      console.log('\n[TUI] Miner finished.');
      process.exit(0);
    }
  });

  child.on('error', (err) => {
    console.error(`\n[TUI] Failed to start miner: ${err.message}`);
    process.exit(1);
  });

  // Forward Ctrl-C / SIGTERM to the child so the miner's TUI restores the terminal.
  function forwardSignal(signal) {
    return () => {
      if (!childExited && child.pid) {
        try {
          child.kill(signal);
        } catch (err) {
          // ignore
        }
      }
    };
  }

  process.on('SIGINT', forwardSignal('SIGINT'));
  process.on('SIGTERM', forwardSignal('SIGTERM'));
}

main().catch((err) => {
  console.error('TUI error:', err);
  process.exit(1);
});
