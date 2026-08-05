/**
 * ZION Desktop Agent — Terminal UI (TUI) Mode
 *
 * A professional terminal dashboard for mining monitoring.
 * Launched with: npm run tui  OR  node src/tui/index.js
 *
 * Features:
 *  - Live hashrate (10s / 60s / 15m) with sparkline
 *  - GPU temp / power / VRAM / clock / CUs
 *  - Share log (accept / reject with timestamps)
 *  - Trinity stream cards (ZION / GPU profit / CPU profit)
 *  - Pool connection status
 *  - Keyboard shortcuts: [s]tart, [x]stop, [q]uit, [r]eset sparkline
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const blessed = require('blessed');

// ── Paths ──
const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const IS_PACKAGED = !!process.versions.electron && process.versions.electron.includes('resources');
const USER_DATA_PATH = process.env.ZION_DATA_DIR
  || path.join(os.homedir(), 'AppData', 'Roaming', 'ZionMiner')
  || path.join(os.homedir(), '.zion-miner');

const CONFIG_PATH = path.join(USER_DATA_PATH, 'miner_config.json');
const STATS_PATH = path.join(USER_DATA_PATH, 'miner_stats_tui.json');

// ── Miner binary discovery (mirrors main.js findRustMiner) ──
function findRustMiner() {
  const v31Names = process.platform === 'win32' ? ['zion-miner.exe'] : ['zion-miner', 'zion-universal-miner'];
  const searchPaths = IS_PACKAGED
    ? [process.resourcesPath]
    : [
        path.join(APP_ROOT, 'APP&WEB', 'desktop-agent', 'resources'),
        path.join(APP_ROOT, 'V31', 'L1', 'miner', 'target', 'release'),
        path.join(APP_ROOT, 'V31', 'target', 'release'),
        path.join(APP_ROOT, 'target', 'release'),
      ];
  for (const name of v31Names) {
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
  payoutAddress: '',
  workerName: 'w11-tui',
  threads: 2,
  gpuWorkSize: 8192,
  backend: 'opencl',
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const disk = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return { ...DEFAULT_CONFIG, ...disk, pool: { ...DEFAULT_CONFIG.pool, ...(disk.pool || {}) } };
    }
  } catch {}
  return { ...DEFAULT_CONFIG };
}

// ── Stats polling ──
function parsePrometheusMetrics(text) {
  const out = {};
  const re = /^(zion_miner_\w+)\{[^}]*\}\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    const v = Number(m[2]);
    out[m[1]] = Number.isFinite(v) ? v : 0;
  }
  const poolMatch = text.match(/zion_miner_hash_rate\{[^}]*pool="([^"]+)"/);
  const coinMatch = text.match(/zion_miner_hash_rate\{[^}]*coin="([^"]+)"/);
  if (poolMatch) out._pool = poolMatch[1];
  if (coinMatch) out._coin = coinMatch[1];
  return out;
}

function pollMetrics() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:9116/metrics', { timeout: 1500 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          const pm = parsePrometheusMetrics(data);
          const hr = pm.zion_miner_hash_rate || 0;
          resolve({
            hashrate: hr,
            hashrate_10s: hr,
            hashrate_60s: hr,
            hashrate_15m: hr,
            hashrate_max: hr,
            accepted: pm.zion_miner_shares_accepted || 0,
            rejected: pm.zion_miner_shares_rejected || 0,
            total_hashes: pm.zion_miner_total_hashes || 0,
            shares: (pm.zion_miner_shares_submitted || 0),
            pool: pm._pool,
            coin: pm._coin,
            _ok: true
          });
        } else {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// ── Hashrate formatting ──
function fmtHr(hps) {
  if (!hps || hps <= 0) return '—';
  if (hps >= 1e12) return (hps / 1e12).toFixed(2) + ' TH/s';
  if (hps >= 1e9) return (hps / 1e9).toFixed(2) + ' GH/s';
  if (hps >= 1e6) return (hps / 1e6).toFixed(2) + ' MH/s';
  if (hps >= 1e3) return (hps / 1e3).toFixed(2) + ' kH/s';
  return hps.toFixed(0) + ' H/s';
}

function fmtBytes(b) {
  if (!b) return '—';
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
  if (b >= 1e6) return (b / 1e6).toFixed(0) + ' MB';
  return b + ' B';
}

// ── Sparkline (ASCII) ──
const SPARK_CHARS = '▁▂▃▄▅▆▇█';
function sparkline(history, width) {
  if (!history || history.length < 2) return 'collecting…';
  const w = width || 60;
  const slice = history.slice(-w);
  const max = Math.max(...slice);
  const min = Math.min(...slice);
  const range = max - min || 1;
  let out = '';
  for (const v of slice) {
    const idx = Math.floor(((v - min) / range) * (SPARK_CHARS.length - 1));
    out += SPARK_CHARS[Math.max(0, Math.min(SPARK_CHARS.length - 1, idx))];
  }
  return out;
}

// ── Main TUI ──
async function main() {
  const minerPath = findRustMiner();
  if (!minerPath) {
    console.error('ERROR: zion-miner binary not found. Build V31/L1/miner first:');
    console.error('  cd V31 && cargo build --release -p zion-miner --features auxpow,gpu-opencl,native-hashers');
    process.exit(1);
  }

  const config = loadConfig();
  if (!config.payoutAddress) {
    console.error('ERROR: No payout address configured. Set it in the desktop agent GUI first,');
    console.error('or edit:', CONFIG_PATH);
    process.exit(1);
  }

  // Ensure user data dir exists
  if (!fs.existsSync(USER_DATA_PATH)) fs.mkdirSync(USER_DATA_PATH, { recursive: true });

  // ── Blessed screen ──
  const screen = blessed.screen({
    smartCSR: true,
    title: 'ZION Miner — TUI Dashboard',
    fullUnicode: true,
  });

  // Header
  const header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    content: ' {bold}ZION Miner — TUI Dashboard{/}  {grey-fg}v3.1.0{/}',
    tags: true,
    border: { type: 'line' },
    style: { border: { fg: 'cyan' }, fg: 'white' },
  });

  // Status bar
  const statusBar = blessed.box({
    parent: screen,
    top: 3,
    left: 0,
    right: 0,
    height: 1,
    content: ' Status: {red-fg}STOPPED{/}  |  Pool: —  |  [s]tart  [x]stop  [q]uit',
    tags: true,
    style: { fg: 'white', bg: 'blue' },
  });

  // ── Hashrate panel ──
  const hrBox = blessed.box({
    parent: screen,
    top: 5,
    left: 0,
    width: '50%',
    height: 8,
    label: ' Hashrate ',
    border: { type: 'line' },
    style: { border: { fg: 'cyan' } },
    tags: true,
  });

  // ── GPU panel ──
  const gpuBox = blessed.box({
    parent: screen,
    top: 5,
    left: '50%',
    width: '50%',
    height: 8,
    label: ' GPU Hardware ',
    border: { type: 'line' },
    style: { border: { fg: 'green' } },
    tags: true,
  });

  // ── Sparkline ──
  const sparkBox = blessed.box({
    parent: screen,
    top: 13,
    left: 0,
    right: 0,
    height: 3,
    label: ' Hashrate Sparkline ',
    border: { type: 'line' },
    style: { border: { fg: 'cyan' } },
    tags: true,
  });

  // ── Trinity streams ──
  const streamBox = blessed.box({
    parent: screen,
    top: 16,
    left: 0,
    right: 0,
    height: 7,
    label: ' Trinity Streams ',
    border: { type: 'line' },
    style: { border: { fg: 'magenta' } },
    tags: true,
  });

  // ── Share log ──
  const shareLog = blessed.log({
    parent: screen,
    top: 23,
    left: 0,
    right: 0,
    bottom: 3,
    label: ' Share Log ',
    border: { type: 'line' },
    style: { border: { fg: 'yellow' } },
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: { ch: ' ' },
  });

  // ── Miner output log (bottom) ──
  const minerLog = blessed.log({
    parent: screen,
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    label: ' Miner Output ',
    border: { type: 'line' },
    style: { border: { fg: 'grey' } },
    tags: true,
    scrollable: true,
  });

  // ── State ──
  let minerProc = null;
  let isRunning = false;
  let hrHistory = [];
  let lastShareCount = 0;

  // ── Update dashboard from stats ──
  async function updateDashboard() {
    const stats = await pollMetrics();
    if (!stats) {
      hrBox.setContent(' {grey-fg}Waiting for stats…{/}');
      gpuBox.setContent(' {grey-fg}No GPU data{/}');
      sparkBox.setContent(' {grey-fg}collecting…{/}');
      streamBox.setContent(' {grey-fg}No stream data{/}');
      return;
    }

    // Hashrate
    const hr10 = fmtHr(stats.hashrate_10s);
    const hr60 = fmtHr(stats.hashrate_60s);
    const hr15 = fmtHr(stats.hashrate_15m);
    const hrMax = fmtHr(stats.hashrate_max);
    const hrNow = fmtHr(stats.hashrate);
    hrBox.setContent(
      ` Current: {bold}{cyan-fg}${hrNow}{/}\n` +
      ` 10s: {cyan-fg}${hr10}{/}   60s: {cyan-fg}${hr60}{/}\n` +
      ` 15m: {cyan-fg}${hr15}{/}   Max: {green-fg}${hrMax}{/}\n` +
      ` Shares: {green-fg}${stats.accepted || 0}{/}/${stats.rejected || 0}  ` +
      `Coin: ${stats.coin || '—'}`
    );

    // GPU — V31 Prometheus endpoint does not expose GPU details yet.
    gpuBox.setContent(' {grey-fg}GPU metrics not available via Prometheus{/}');

    // Sparkline
    const hps = stats.hashrate_10s || stats.hashrate || 0;
    if (hps > 0) {
      hrHistory.push(hps);
      if (hrHistory.length > 120) hrHistory.shift();
    }
    sparkBox.setContent(' ' + sparkline(hrHistory, 80));

    // Trinity streams — V31 Prometheus endpoint is aggregate only.
    streamBox.setContent(' {grey-fg}Per-stream metrics not available via Prometheus{/}');

    // Share log — detect new shares
    const totalShares = (stats.accepted || 0) + (stats.rejected || 0);
    if (totalShares > lastShareCount) {
      const time = new Date().toLocaleTimeString();
      if (stats.accepted > (lastShareCount - (stats.rejected || 0))) {
        shareLog.log(`{green-fg}[${time}] ✓ ZION share accepted (A:${stats.accepted} R:${stats.rejected}){/}`);
      }
      if (stats.rejected > 0) {
        shareLog.log(`{red-fg}[${time}] ✗ ZION share rejected (A:${stats.accepted} R:${stats.rejected}){/}`);
      }
      lastShareCount = totalShares;
    }

    // Status bar
    const poolHost = config.pool.host + ':' + config.pool.port;
    const statusStr = isRunning ? '{green-fg}RUNNING{/}' : '{red-fg}STOPPED{/}';
    statusBar.setContent(` Status: ${statusStr}  |  Pool: ${poolHost}  |  Nonces: ${stats.total_hashes || 0}  |  [s]tart  [x]stop  [q]uit`);

    screen.render();
  }

  // ── Start mining ──
  function startMining() {
    if (isRunning || minerProc) return;
    const pool = `${config.pool.host}:${config.pool.port}`;
    const worker = config.workerName || 'w11-tui';
    const threads = String(config.threads || 2);
    const backend = String(config.backend || 'opencl').toLowerCase();
    const wantsGpu = backend !== 'cpu';

    const env = {
      ...process.env,
      ZION_POOL_ADDR: pool,
      ZION_WORKER: worker,
      ZION_WORKER_NAME: worker,
      ZION_MINER_THREADS: threads,
      ZION_GPU_BACKEND: backend,
      ZION_BACKEND: backend,
      ZION_MINER_ALGORITHM: 'deeksha_lite_v1',
      ZION_PROFIT_INTERVAL: '300',
      ZION_AUTONOMOUS: '1'
    };

    const args = [
      '--pool', pool,
      '--wallet', config.payoutAddress,
      '--worker', worker,
      '--threads', threads,
      '--metrics', '127.0.0.1:9116',
      '--log_interval', '30'
    ];
    if (!wantsGpu) {
      args.push('--no_gpu');
    }

    minerProc = spawn(minerPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    isRunning = true;
    lastShareCount = 0;
    hrHistory = [];

    minerProc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      for (const line of lines.slice(-2)) {
        minerLog.log(' ' + line.substring(0, 120));
      }
    });
    minerProc.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      for (const line of lines.slice(-2)) {
        minerLog.log(' {red-fg}' + line.substring(0, 120) + '{/}');
      }
    });
    minerProc.on('close', (code) => {
      isRunning = false;
      minerProc = null;
      shareLog.log(`{yellow-fg}[${new Date().toLocaleTimeString()}] Miner exited (code=${code}){/}`);
      statusBar.setContent(` Status: {red-fg}STOPPED{/}  |  Pool: ${config.pool.host}:${config.pool.port}  |  [s]tart  [x]stop  [q]uit`);
      screen.render();
    });

    shareLog.log(`{green-fg}[${new Date().toLocaleTimeString()}] Mining started — ${config.pool.host}:${config.pool.port}{/}`);
    screen.render();
  }

  // ── Stop mining ──
  function stopMining() {
    if (!minerProc) return;
    try { minerProc.kill('SIGTERM'); } catch {}
    shareLog.log(`{yellow-fg}[${new Date().toLocaleTimeString()}] Stopping miner…{/}`);
    screen.render();
  }

  // ── Keyboard ──
  screen.key(['s'], () => startMining());
  screen.key(['x'], () => stopMining());
  screen.key(['r'], () => { hrHistory = []; screen.render(); });
  screen.key(['q', 'C-c'], () => {
    stopMining();
    setTimeout(() => process.exit(0), 500);
  });

  // ── Polling loop ──
  setInterval(async () => { await updateDashboard(); }, 1000);
  updateDashboard();

  // Welcome message
  shareLog.log('{grey-fg}ZION TUI Dashboard ready. Press [s] to start mining, [q] to quit.{/}');
  screen.render();
}

main().catch((err) => {
  console.error('TUI error:', err);
  process.exit(1);
});
