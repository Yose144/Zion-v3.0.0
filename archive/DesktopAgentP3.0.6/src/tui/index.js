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
 *  - Public mining stream card (single ZION/Deeksha stream)
 *  - Pool connection status
 *  - Keyboard shortcuts: [s]tart, [x]stop, [q]uit, [r]eset sparkline
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
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
  const v3Names = process.platform === 'win32' ? ['zion-miner.exe'] : ['zion-miner'];
  const searchPaths = IS_PACKAGED
    ? [process.resourcesPath]
    : [
        path.join(APP_ROOT, 'APP&WEB', 'desktop-agent', 'resources'),
        path.join(APP_ROOT, 'V3', 'target', 'release'),
        path.join(APP_ROOT, 'V3', 'L1', 'miner', 'target', 'release'),
        path.join(APP_ROOT, 'target', 'release'),
      ];
  for (const name of v3Names) {
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
function readStats() {
  try {
    if (!fs.existsSync(STATS_PATH)) return null;
    const raw = fs.readFileSync(STATS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
    console.error('ERROR: zion-miner binary not found. Build V3/L1/miner first:');
    console.error('  cd V3 && cargo build --release -p zion-miner --features gpu-opencl,...');
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
    title: 'ZION Public Miner — TUI Dashboard',
    fullUnicode: true,
  });

  // Header
  const header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    content: ' {bold}ZION Public Miner — TUI Dashboard{/}  {grey-fg}v3.1.0{/}',
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

  // ── Mining streams ──
  const streamBox = blessed.box({
    parent: screen,
    top: 16,
    left: 0,
    right: 0,
    height: 7,
    label: ' Mining Streams ',
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
  function updateDashboard() {
    const stats = readStats();
    if (!stats) {
      hrBox.setContent(' {grey-fg}Waiting for stats…{/}');
      gpuBox.setContent(' {grey-fg}No GPU data{/}');
      sparkBox.setContent(' {grey-fg}collecting…{/}');
      streamBox.setContent(' {grey-fg}No stream data{/}');
      return;
    }

    // Hashrate
    const hr10 = fmtHr(stats.hashrate_10s || stats.hashrate_10s_hps);
    const hr60 = fmtHr(stats.hashrate_60s || stats.hashrate_60s_hps);
    const hr15 = fmtHr(stats.hashrate_15m || stats.hashrate_15m_hps);
    const hrMax = fmtHr(stats.hashrate_max);
    const hrNow = fmtHr(stats.hashrate || stats.hashrate_hps);
    hrBox.setContent(
      ` Current: {bold}{cyan-fg}${hrNow}{/}\n` +
      ` 10s: {cyan-fg}${hr10}{/}   60s: {cyan-fg}${hr60}{/}\n` +
      ` 15m: {cyan-fg}${hr15}{/}   Max: {green-fg}${hrMax}{/}\n` +
      ` Shares: {green-fg}${stats.accepted || 0}{/}/${stats.rejected || 0}  ` +
      `Uptime: ${stats.uptime_sec || 0}s`
    );

    // GPU
    const gpuName = stats.gpu_name || stats.gpu_info || '—';
    const temp = stats.gpu_temp_c != null ? stats.gpu_temp_c + '°C' : '—';
    const power = stats.gpu_power_w != null ? stats.gpu_power_w + 'W' : '—';
    const vram = stats.gpu_vram_mib ? stats.gpu_vram_mib + ' MiB' : '—';
    const clock = stats.gpu_clock_mhz ? stats.gpu_clock_mhz + ' MHz' : '—';
    const cus = stats.gpu_compute_units || '—';
    const tempColor = stats.gpu_temp_c >= 80 ? 'red-fg' : stats.gpu_temp_c >= 70 ? 'yellow-fg' : 'green-fg';
    gpuBox.setContent(
      ` {bold}${gpuName}{/}\n` +
      ` Temp: {${tempColor}}${temp}{/}  Power: {yellow-fg}${power}{/}\n` +
      ` VRAM: ${vram}  Clock: ${clock}\n` +
      ` CUs: ${cus}  Backend: ${stats.backend || '—'}`
    );

    // Sparkline
    const hps = stats.hashrate_10s || stats.hashrate_10s_hps || stats.hashrate || 0;
    if (hps > 0) {
      hrHistory.push(hps);
      if (hrHistory.length > 120) hrHistory.shift();
    }
    sparkBox.setContent(' ' + sparkline(hrHistory, 80));

    // Mining streams
    if (Array.isArray(stats.streams) && stats.streams.length > 0) {
      let lines = '';
      for (const s of stats.streams) {
        const active = s.active ? '{green-fg}●{/}' : '{red-fg}○{/}';
        const hr = fmtHr(s.hashrate_10s);
        const rawCoin = (s.coin || s.label || '—').toString().trim();
        const isZion = rawCoin === 'ZION' || rawCoin.startsWith('ZION');
        const idx = Number(s.index) || 0;
        const coin = isZion ? rawCoin : (idx === 3 ? 'Boost Stream 2' : 'Boost Stream 1');
        const algo = isZion ? (s.algorithm || '') : 'Boost';
        const acc = s.accepted || 0;
        const rej = s.rejected || 0;
        lines += ` ${active} ${coin.padEnd(10)} ${hr.padEnd(12)} ${algo.padEnd(20)} A:${acc} R:${rej}\n`;
      }
      streamBox.setContent(lines.trim());
    } else {
      streamBox.setContent(' {grey-fg}No active streams{/}');
    }

    // Share log — detect new shares
    const totalShares = (stats.accepted || 0) + (stats.rejected || 0);
    if (totalShares > lastShareCount) {
      const newShares = totalShares - lastShareCount;
      const time = new Date().toLocaleTimeString();
      if (stats.accepted > 0 && stats.accepted > (lastShareCount - (stats.rejected || 0))) {
        shareLog.log(`{green-fg}[${time}] ✓ share accepted (A:${stats.accepted} R:${stats.rejected}){/}`);
      }
      if (stats.rejected > 0) {
        shareLog.log(`{red-fg}[${time}] ✗ share rejected (A:${stats.accepted} R:${stats.rejected}){/}`);
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
    // Clean up old stats file
    try { if (fs.existsSync(STATS_PATH)) fs.unlinkSync(STATS_PATH); } catch {}

    const env = {
      ...process.env,
      ZION_STATS_FILE: STATS_PATH,
      ZION_BACKEND: config.backend || 'opencl',
      ZION_GPU_WORK_SIZE: String(config.gpuWorkSize || 8192),
      ZION_THREADS: String(config.threads || 2),
      ZION_INTERACTIVE: '0',
      ZION_NO_STICKY: '1',
      ZION_QUIET: '1',
      ZION_METRICS_REPORT_SECS: '2',
      ZION_PAYOUT_ADDRESS: config.payoutAddress,
      ZION_WORKER_NAME: config.workerName || 'w11-tui',
      ZION_POOL_ADDR: `${config.pool.host}:${config.pool.port}`,
    };

    const args = [
      '--stats-file', STATS_PATH,
      '--payout-address', config.payoutAddress,
      '--worker-name', config.workerName || 'w11-tui',
      '--pool-addr', `${config.pool.host}:${config.pool.port}`,
      '--backend', config.backend || 'opencl',
      '--threads', String(config.threads || 2),
      '--gpu-work-size', String(config.gpuWorkSize || 8192),
    ];

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
  setInterval(updateDashboard, 1000);
  updateDashboard();

  // Welcome message
  shareLog.log('{grey-fg}ZION TUI Dashboard ready. Press [s] to start mining, [q] to quit.{/}');
  screen.render();
}

main().catch((err) => {
  console.error('TUI error:', err);
  process.exit(1);
});
