// ZION Native Awakening v2.9.6 - Main Process
// Electron main process with system tray, auto-start, IPC

const { app, BrowserWindow, Tray, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const WalletGenerator = require('./wallet-generator');
const QRCode = require('qrcode');

// ── Logging: only miner metrics + errors go to console.log.
// Everything else uses dbg() which outputs console.debug only when ZION_DEBUG=1.
const DBG = process.env.ZION_DEBUG === '1';
function dbg(...args) { if (DBG) console.debug('[DBG]', ...args); }

const fileAppendState = new Map();
const fileRotateLastCheckMs = new Map();

function maybeRotateFileThrottled(filePath, maxBytes, maxBackups, maxAgeMs, minCheckIntervalMs = 5000) {
  try {
    const now = Date.now();
    const last = Number(fileRotateLastCheckMs.get(filePath) || 0);
    if (now - last < minCheckIntervalMs) return;
    fileRotateLastCheckMs.set(filePath, now);
    rotateFileIfTooLarge(filePath, maxBytes, maxBackups, maxAgeMs);
  } catch {
    // ignore
  }
}

function appendToFileBuffered(filePath, text, options = {}) {
  try {
    if (!filePath || !text) return;
    const flushDelayMs = Number(options.flushDelayMs) > 0 ? Number(options.flushDelayMs) : 180;
    const maxBufferedChars = Number(options.maxBufferedChars) > 0 ? Number(options.maxBufferedChars) : 256 * 1024;

    if (options.rotate) {
      maybeRotateFileThrottled(
        filePath,
        Number(options.rotate.maxBytes) || 0,
        Number(options.rotate.maxBackups) || 0,
        Number(options.rotate.maxAgeMs) || 0,
        Number(options.rotate.minCheckIntervalMs) || 5000
      );
    }

    let state = fileAppendState.get(filePath);
    if (!state) {
      state = { buffer: '', timer: null };
      fileAppendState.set(filePath, state);
    }

    state.buffer += String(text);
    if (state.buffer.length > maxBufferedChars) {
      state.buffer = state.buffer.slice(-maxBufferedChars);
    }

    if (state.timer) return;
    state.timer = setTimeout(() => {
      try {
        const payload = state.buffer;
        state.buffer = '';
        state.timer = null;
        if (!payload) return;
        fs.appendFile(filePath, payload, () => {});
      } catch {
        // ignore
      }
    }, flushDelayMs);
  } catch {
    // ignore
  }
}

function flushBufferedFileAppendsSync() {
  try {
    for (const [filePath, state] of fileAppendState.entries()) {
      try {
        if (state?.timer) {
          clearTimeout(state.timer);
          state.timer = null;
        }
        const payload = String(state?.buffer || '');
        state.buffer = '';
        if (payload) {
          fs.appendFileSync(filePath, payload);
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

process.on('uncaughtException', (err) => {
  try {
    const msg = err?.stack || err?.message || String(err);
    try {
      console.error('uncaughtException:', msg);
    } catch {
      // ignore
    }
    logApp('uncaughtException', JSON.stringify({ message: err?.message, stack: msg }));
  } catch {
    // ignore
  }
});

process.on('unhandledRejection', (reason) => {
  try {
    const msg = reason?.stack || reason?.message || String(reason);
    try {
      console.error('unhandledRejection:', msg);
    } catch {
      // ignore
    }
    logApp('unhandledRejection', JSON.stringify({ message: reason?.message, stack: msg }));
  } catch {
    // ignore
  }
});

const rustCliFeatureCache = new Map();

function rustMinerSupportsGroupFlag(minerPath) {
  try {
    if (!minerPath) return false;
    if (rustCliFeatureCache.has(minerPath)) {
      return !!rustCliFeatureCache.get(minerPath);
    }

    let helpText = '';
    try {
      helpText = execFileSync(minerPath, ['--help'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 8000
      });
    } catch (err) {
      const out = String(err?.stdout || '');
      const stderr = String(err?.stderr || '');
      helpText = `${out}\n${stderr}`;
    }

    const supported = /--group\b/i.test(String(helpText || ''));
    rustCliFeatureCache.set(minerPath, supported);
    return supported;
  } catch {
    return false;
  }
}

function cleanupStrayMinerProcesses(preferRustBackend) {
  try {
    if (process.platform !== 'win32') return;
    const enabled = String(process.env.ZION_KILL_STRAY_MINERS || '1').trim() !== '0';
    if (!enabled) return;
    if (!preferRustBackend) return;

    try {
      execFileSync('taskkill', ['/F', '/T', '/IM', 'zion-universal-miner.exe'], {
        windowsHide: true,
        timeout: 5000,
        stdio: 'ignore'
      });
      logApp('stray-miner-cleanup', 'taskkill zion-universal-miner.exe');
    } catch {
      // ignore (no stray process or insufficient perms)
    }
  } catch {
    // ignore
  }
}

if (process.platform === 'win32' && !app.isPackaged) {
  // Keep dev `npm start` isolated from the installed app's singleton/userData namespace.
  app.setName('zion-desktop-agent-dev');
}

// Keep cache clean on Windows without overriding userData paths.
// (We must NOT set userData to a different path; only set cache.)
app.disableHardwareAcceleration();

// Avoid multiple Electron instances fighting over the same cache directory.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function logApp(message, extra) {
  try {
    const USER_DATA_PATH = app.getPath('userData');
    const appLogPath = path.join(USER_DATA_PATH, 'desktop_agent.log');
    const line = `${new Date().toISOString()} ${message}${extra ? ` ${extra}` : ''}\n`;

    // Keep desktop agent log bounded as well (this file can grow very large otherwise).
    // Use the same age rule (1 day) and a smaller size cap.
    try {
      maybeRotateFileThrottled(appLogPath, 10 * 1024 * 1024, 0, 24 * 60 * 60 * 1000, 10000);
    } catch {
      // ignore
    }

    appendToFileBuffered(appLogPath, line, {
      flushDelayMs: 220,
      maxBufferedChars: 128 * 1024
    });
  } catch {
    // ignore logging failures
  }
}

function attachChildStreamGuards(childProc, label) {
  try {
    if (!childProc) return;
    const onErr = (which) => (err) => {
      try {
        logApp(`${label}-${which}-error`, JSON.stringify({ code: err?.code, message: err?.message }));
      } catch {
        // ignore
      }
    };
    childProc.stdin?.on('error', onErr('stdin'));
    childProc.stdout?.on('error', onErr('stdout'));
    childProc.stderr?.on('error', onErr('stderr'));
  } catch {
    // ignore
  }
}

function safeChildStdinWrite(childProc, label, text) {
  try {
    if (!childProc || !childProc.stdin || childProc.stdin.destroyed || !childProc.stdin.writable) return false;
    childProc.stdin.write(text);
    return true;
  } catch (err) {
    const code = err?.code;
    if (code === 'EPIPE' || code === 'ERR_STREAM_WRITE_AFTER_END') {
      try {
        logApp(`${label}-stdin-write-failed`, JSON.stringify({ code, message: err?.message }));
      } catch {
        // ignore
      }
      return false;
    }
    throw err;
  }
}

function runPowerShellCapture(script, label, meta) {
  try {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    const psExe = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const cmd = fs.existsSync(psExe) ? psExe : 'powershell';
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script];
    logApp(`${label}-invoke`, JSON.stringify({ ...(meta || {}), cmd }));

    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const cap = (s) => {
      const str = String(s || '');
      return str.length > 4000 ? str.slice(0, 4000) + '…' : str;
    };
    child.stdout?.on('data', (d) => {
      stdout += d.toString();
      if (stdout.length > 8000) stdout = stdout.slice(-8000);
    });
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.once('error', (err) => {
      logApp(`${label}-error`, JSON.stringify({ ...(meta || {}), error: err?.message || String(err) }));
    });
    child.once('exit', (code) => {
      logApp(
        `${label}-exit`,
        JSON.stringify({ ...(meta || {}), code, stdout: cap(stdout).trim(), stderr: cap(stderr).trim() })
      );
    });
    return child;
  } catch (err) {
    logApp(`${label}-fatal`, JSON.stringify({ ...(meta || {}), error: err?.message || String(err) }));
    return null;
  }
}

function computeEffectiveThreads(config) {
  try {
    const cpuCount = Array.isArray(os.cpus?.()) ? os.cpus().length : 1;
    const safeCpuCount = Math.max(1, cpuCount);

    // Performance-first default:
    // - keep 1 core for UI/OS
    // - reserve one more only when explicitly requested via env
    const reserveAfterburnerExtra =
      String(process.env.ZION_RESERVE_AFTERBURNER_CORES || '').trim() === '1' &&
      config?.aiAfterburner === true;
    const reserved = Math.min(safeCpuCount - 1, reserveAfterburnerExtra ? 2 : 1);
    const maxThreads = Math.max(1, safeCpuCount - reserved);

    // Performance mode default: use maximum safe threads.
    // Set ZION_RESPECT_CONFIG_THREADS=1 to honor manual thread setting from UI.
    const respectConfigThreads = String(process.env.ZION_RESPECT_CONFIG_THREADS || '').trim() === '1';
    if (!respectConfigThreads) {
      return maxThreads;
    }

    const tRaw = config?.threads;
    const tNum = typeof tRaw === 'number' ? tRaw : Number(String(tRaw || '').trim());
    if (Number.isFinite(tNum) && tNum > 0) {
      return Math.max(1, Math.min(maxThreads, Math.floor(tNum)));
    }
    return maxThreads;
  } catch {
    return 1;
  }
}

function computeDifficultyHint(config, algorithmLower) {
  try {
    // 1) Explicit config value (if present)
    const cfgRaw = config?.difficulty;
    const cfgNum = typeof cfgRaw === 'number' ? cfgRaw : Number(String(cfgRaw || '').trim());
    if (Number.isFinite(cfgNum) && cfgNum > 0) return Math.floor(cfgNum);

    // 2) Environment override
    const envRaw = String(process.env.ZION_MINER_DIFFICULTY || process.env.ZION_DEFAULT_DIFFICULTY || '').trim();
    const envNum = Number(envRaw);
    if (Number.isFinite(envNum) && envNum > 0) return Math.floor(envNum);
  } catch {
    // ignore
  }
  return null;
}

function computeAffinityMaskFromCoreList(coreIndexes) {
  try {
    if (!Array.isArray(coreIndexes) || coreIndexes.length === 0) return null;
    let mask = 0n;
    for (const idx of coreIndexes) {
      const i = Number(idx);
      if (!Number.isFinite(i) || i < 0 || i > 63) continue;
      mask |= 1n << BigInt(i);
    }
    return mask > 0n ? mask : null;
  } catch {
    return null;
  }
}

function computeAutoAffinity(cpuCount, threadsToUse) {
  const c = Math.max(1, Math.min(64, Number(cpuCount) || 1));
  const t = Math.max(1, Math.min(c, Number(threadsToUse) || 1));
  if (t >= c) return { mask: null, cores: [] };

  // Best-practice for Windows miners:
  // - Prefer to leave logical core 0 for OS/UI interrupts if possible.
  // - Use the next N cores for mining.
  const candidates = [];
  if (c > 1) {
    for (let i = 1; i < c; i++) candidates.push(i);
  } else {
    candidates.push(0);
  }

  const cores = candidates.slice(0, t);
  // If we somehow need more cores than candidates (only possible for c==1), fill with 0.
  while (cores.length < t) cores.push(0);

  return { mask: computeAffinityMaskFromCoreList(cores), cores };
}

function boostMinerProcessWindows(pid, config, effectiveThreads) {
  try {
    if (process.platform !== 'win32') return;
    if (!pid) return;

    // Defaults optimized for mining, but can be overridden via env without adding UI.
    // Supported values: idle, below_normal, normal, above_normal, high, realtime
    const priorityRaw = String(process.env.ZION_MINER_PRIORITY || 'high').toLowerCase();
    const affinityMaskRaw = String(process.env.ZION_MINER_AFFINITY_MASK || '').trim();
    const affinityCoresRaw = String(process.env.ZION_MINER_AFFINITY_CORES || '').trim();

    const priorityMap = {
      idle: 'Idle',
      below_normal: 'BelowNormal',
      normal: 'Normal',
      above_normal: 'AboveNormal',
      high: 'High',
      realtime: 'RealTime'
    };
    const priorityClass = priorityMap[priorityRaw] || 'High';

    // Affinity selection priority:
    // 1) Explicit env mask/cores (power user override)
    // 2) Auto mask from cpuCount + effectiveThreads (load balancing)
    let affinityMaskBig = null;
    let affinityCores = [];
    if (affinityMaskRaw) {
      try {
        const s = affinityMaskRaw.startsWith('0x') ? affinityMaskRaw : `0x${affinityMaskRaw}`;
        affinityMaskBig = BigInt(s);
      } catch {
        affinityMaskBig = null;
      }
    } else if (affinityCoresRaw) {
      try {
        let mask = 0n;
        for (const part of affinityCoresRaw.split(/[,;\s]+/g)) {
          const p = part.trim();
          if (!p) continue;
          const idx = Number(p);
          if (!Number.isFinite(idx) || idx < 0 || idx > 63) continue;
          affinityCores.push(idx);
          mask |= 1n << BigInt(idx);
        }
        affinityMaskBig = mask > 0n ? mask : null;
      } catch {
        affinityMaskBig = null;
      }
    } else {
      const cpuCount = Array.isArray(os.cpus?.()) ? os.cpus().length : 1;
      const auto = computeAutoAffinity(cpuCount, effectiveThreads);
      affinityMaskBig = auto.mask;
      affinityCores = auto.cores;
    }

    // Best-effort PowerShell tuning.
    // Note: RealTime priority can starve UI; keep it opt-in via env.
    const worker = String(config?.worker || '').trim();
    const algo = String(config?.algorithm || '').trim();
    const script = `
$ErrorActionPreference = 'SilentlyContinue'
$pid = ${Number(pid)}
$p = Get-Process -Id $pid -ErrorAction SilentlyContinue
if (-not $p) { Write-Output "missing"; exit 0 }
$p.PriorityClass = '${priorityClass}'
try { $p.PriorityBoostEnabled = $true } catch {}
  ${affinityMaskBig != null ? `$aff=[UInt64]${affinityMaskBig.toString()}; $p.ProcessorAffinity = [IntPtr]$aff` : ''}
  Write-Output ("ok priority=${priorityClass}" + ${affinityMaskBig != null ? `" affinity=${affinityMaskBig.toString()}"` : `""`})
`.trim();

    runPowerShellCapture(script, 'miner-boost', {
      pid,
      priorityClass,
      affinityMask: affinityMaskBig != null ? affinityMaskBig.toString() : '',
      affinityCores: Array.isArray(affinityCores) && affinityCores.length ? affinityCores.join(',') : '',
      effectiveThreads: typeof effectiveThreads === 'number' ? effectiveThreads : '',
      worker,
      algorithm: algo
    });
  } catch (err) {
    logApp('miner-boost-fatal', JSON.stringify({ pid, error: err?.message || String(err) }));
  }
}

/**
 * One-click Windows Large Pages enabler.
 * Checks if the current user has SeLockMemoryPrivilege and, if not, attempts
 * to grant it by adding the user to the "Lock pages in memory" policy via
 * an elevated PowerShell process. Returns { enabled, alreadyEnabled, error }.
 * This is a synchronous, best-effort operation used before miner spawn.
 */
let _winLargePagesChecked = false;
let _winLargePagesEnabled = false;
function ensureWindowsLargePages() {
  if (process.platform !== 'win32') return { enabled: false, alreadyEnabled: false, error: 'not windows' };
  if (_winLargePagesChecked) return { enabled: _winLargePagesEnabled, alreadyEnabled: true, error: '' };

  _winLargePagesChecked = true;

  // Quick check: can we already get large page minimum?
  try {
    const checkScript = `
$sig = @'
[DllImport("kernel32.dll", SetLastError = true)]
public static extern UIntPtr GetLargePageMinimum();
'@
$k = Add-Type -MemberDefinition $sig -Name 'K32LP' -Namespace 'Win32' -PassThru
$lpm = $k::GetLargePageMinimum()
Write-Output $lpm
`.trim();
    const checkResult = execFileSync('powershell', ['-NoProfile', '-Command', checkScript], {
      timeout: 8000, encoding: 'utf8', windowsHide: true
    }).trim();
    const lpMin = Number(checkResult);
    if (Number.isFinite(lpMin) && lpMin > 0) {
      _winLargePagesEnabled = true;
      logApp('largepages-check', JSON.stringify({ status: 'already-available', lpMin }));
      return { enabled: true, alreadyEnabled: true, error: '' };
    }
  } catch { /* not available yet */ }

  // Attempt to enable: grant SeLockMemoryPrivilege to current user via ntrights or secedit.
  // This requires elevation (admin) — we use Start-Process -Verb RunAs.
  try {
    const username = process.env.USERNAME || process.env.USER || '';
    if (!username) {
      _winLargePagesEnabled = false;
      return { enabled: false, alreadyEnabled: false, error: 'cannot determine username' };
    }

    // Use secedit to export, modify, and re-import security policy.
    // This is the standard way to add SeLockMemoryPrivilege without Group Policy Editor.
    const safeUser = username.replace(/'/g, "''");
    const enableScript = [
      "$ErrorActionPreference = 'Stop'",
      "$tmpDir = [System.IO.Path]::GetTempPath()",
      "$cfgFile = Join-Path $tmpDir 'zion_secpol_export.cfg'",
      "$dbFile = Join-Path $tmpDir 'zion_secpol.sdb'",
      "secedit /export /cfg $cfgFile /quiet",
      "$content = Get-Content $cfgFile -Raw",
      "$user = '" + safeUser + "'",
      "if ($content -match 'SeLockMemoryPrivilege\\s*=\\s*(.+)') {",
      "  $existing = $Matches[1].Trim()",
      "  if ($existing -match [regex]::Escape($user)) { Write-Output 'ALREADY_GRANTED'; exit 0 }",
      "  $content = $content -replace '(SeLockMemoryPrivilege\\s*=\\s*)(.*)', (\"$1\" + \"$2,$user\")",
      "} else {",
      "  $content = $content -replace '(\\[Privilege Rights\\])', (\"$1\" + \"`r`nSeLockMemoryPrivilege = $user\")",
      "}",
      "Set-Content $cfgFile $content -Force",
      "secedit /configure /db $dbFile /cfg $cfgFile /quiet",
      "Write-Output 'GRANTED'"
    ].join('; ');

    // Run elevated
    const innerCmd = enableScript.replace(/'/g, "''");
    const result = spawnSync('powershell', [
      '-NoProfile', '-Command',
      "Start-Process powershell -ArgumentList '-NoProfile','-Command','" + innerCmd + "' -Verb RunAs -Wait -PassThru | Select-Object -ExpandProperty ExitCode"
    ], { timeout: 30000, encoding: 'utf8', windowsHide: true });

    if (result.status === 0) {
      _winLargePagesEnabled = true;
      logApp('largepages-enable', JSON.stringify({ status: 'granted', user: username }));
      return { enabled: true, alreadyEnabled: false, error: '' };
    }
    logApp('largepages-enable-failed', JSON.stringify({ status: result.status, stderr: String(result.stderr || '').slice(0, 200) }));
    return { enabled: false, alreadyEnabled: false, error: `secedit exit ${result.status}` };
  } catch (err) {
    logApp('largepages-enable-error', err?.message || String(err));
    return { enabled: false, alreadyEnabled: false, error: err?.message || String(err) };
  }
}

app.on('second-instance', () => {
  logApp('second-instance');
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    showWindow();
  } else {
    createWindow();
  }
});

const USER_DATA_PATH = app.getPath('userData');
const CACHE_PATH = path.join(USER_DATA_PATH, 'cache');

app.setPath('cache', CACHE_PATH);
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disk-cache-dir', CACHE_PATH);
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disk-cache-size', '0');

let mainWindow;
let tray;
let trayMenu;
let minerProcess = null;
let revenueProcess = null; // 2nd miner process: --group revenue → pool routes to XMR/RandomX
let gpuRevenueProcess = null; // 3rd miner process: --group revenue --gpu → GPU algorithms (kawpow/ethash)
let gpuRevenueHealth = { startedAt: 0, accepted: 0, rejected: 0, disabled: false };
let chv42GpuProcess = null; // legacy CHv4.2 GPU miner process (kept for backward compatibility)
let chv42GpuStats = { running: false, hashrate: 0, accepted: 0, rejected: 0, backend: 'cpu', startedAt: 0 };

// ── CH3 Multi-Stream state (dual/triple mining) ───────────────────────────
// Tracks which GPU coin is active, profit-switch poll, and stream status
// exposed to renderer via IPC ('multi-stream-status' event).
let multiStreamCurrentCoin = 'ETC';   // active GPU coin (direct-pool mode)
let profitPollTimer = null;            // setInterval handle
let revenueHashrateCpu = 0;            // from _revenue.json stats file
let revenueHashrateGpu = 0;            // from _gpu_revenue.json stats file
let multiStreamStatus = {
  active: false,
  zion:       { running: false, hashrate: 0, algorithm: 'cosmic_harmony' },
  gpuCoin:    { name: 'ETC', running: false, hashrate: 0, pool: '', algorithm: 'ethash', directPool: false },
  revenueCpu: { running: false, hashrate: 0, algorithm: 'randomx' },
  lastPollAt: 0,
  pollSource: 'none',   // 'pool-api' | 'none'
};
// ─────────────────────────────────────────────────────────────────────────
let minerStopping = false;
let minerStopPromise = null;
let minerAutoStopTimer = null;
let afterburnerProc = null;
let afterburnerReady = false;
let afterburnerStdoutBuf = '';
let afterburnerQueue = [];
let afterburnerReqId = 1;
let abLastConsoleEmitMs = 0; // rate-limit afterburner console line injection
// AI Native integration (parallel to afterburner)
let aiNativeProc = null;
let aiNativeReady = false;
let aiNativeStdoutBuf = '';
let aiNativeQueue = [];
let aiNativeReqId = 1;
let minerMetricsLastEmitMs = 0;
let appHeartbeatLastLogMs = 0;
let minerRateSamples = [];
let minerShareLastSample = { t: 0, accepted: 0, rejected: 0 };
let minerShareDeltaSamples = [];
let minerStats = {
  hashrate: 0,
  shares: 0,
  accepted: 0,
  rejected: 0,
  uptime: 0,
  consciousness_level: 'PHYSICAL',
  consciousness_xp: 0,
  algorithm: '',
  pool: '',
  worker: '',
  threads: '',
  last_job_height: '',
  last_job_diff: '',
  last_pool_diff: '',
  last_job_id: '',
  // CH3 Stream / Revenue fields
  stream_mode: '',
  stream_algorithm: '',
  stream_allocation: '',
  revenue_coin: '',
  revenue_hashrate: 0,
  gpu_detected: false,
  gpu_type: 'none',
  gpu_name: '',
  cpu_only_mode: true,
  // Dual mining: ZION + XMR (DAO revenue)
  dual_mining: false,
  zion_threads: 0,
  xmr_threads: 0,
  xmr_pool: '',
};

function formatHashrate(hs) {
  const v = typeof hs === 'number' && Number.isFinite(hs) ? hs : 0;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} GH/s`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} MH/s`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)} kH/s`;
  return `${v.toFixed(2)} H/s`;
}

function formatUptime(sec) {
  const s = typeof sec === 'number' && Number.isFinite(sec) ? Math.max(0, Math.floor(sec)) : 0;
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function emitMinerStatusLine(reason) {
  try {
    if (!minerProcess) return;
    const algo = String(minerStats.algorithm || '').trim() || 'unknown';
    const pool = String(minerStats.pool || '').trim();
    const worker = String(minerStats.worker || '').trim();
    const thr = String(minerStats.threads || '').trim();
    const thrPart = thr ? `${thr}T` : '';
    const avgOver = (windowMs) => {
      const now = Date.now();
      const cut = now - windowMs;
      let sum = 0;
      let count = 0;
      for (let i = minerRateSamples.length - 1; i >= 0; i--) {
        const s = minerRateSamples[i];
        if (!s || typeof s.t !== 'number') continue;
        if (s.t < cut) break;
        const v = typeof s.hs === 'number' && Number.isFinite(s.hs) ? s.hs : 0;
        sum += v;
        count += 1;
      }
      return count > 0 ? sum / count : null;
    };

    const hrNow = formatHashrate(minerStats.hashrate);
    const hr10 = avgOver(10_000);
    const hr60 = avgOver(60_000);
    const hr15m = avgOver(15 * 60_000);
    const hrAvg = `10s=${formatHashrate(hr10 ?? 0)} 60s=${formatHashrate(hr60 ?? 0)} 15m=${formatHashrate(hr15m ?? 0)}`;
    const accepted = Number(minerStats.accepted || 0);
    const rejected = Number(minerStats.rejected || 0);
    const total = accepted + rejected;
    const accPct = total > 0 ? (accepted / total) * 100 : 0;
    const rejPct = total > 0 ? (rejected / total) * 100 : 0;
    const ar = `${accepted}/${rejected}`;

    const windowShareStats = (windowMs) => {
      const now = Date.now();
      const cut = now - windowMs;
      let acc = 0;
      let rej = 0;
      let firstT = null;
      let lastT = null;
      for (let i = minerShareDeltaSamples.length - 1; i >= 0; i--) {
        const s = minerShareDeltaSamples[i];
        if (!s || typeof s.t !== 'number') continue;
        if (s.t < cut) break;
        if (firstT == null || s.t < firstT) firstT = s.t;
        if (lastT == null || s.t > lastT) lastT = s.t;
        acc += typeof s.acc === 'number' ? s.acc : 0;
        rej += typeof s.rej === 'number' ? s.rej : 0;
      }
      const spanMs = firstT != null && lastT != null && lastT > firstT ? lastT - firstT : windowMs;
      const spanMin = Math.max(0.001, spanMs / 60000);
      const shPerMin = (acc + rej) / spanMin;
      const tot = acc + rej;
      const rejP = tot > 0 ? (rej / tot) * 100 : 0;
      return { acc, rej, shPerMin, rejPct: rejP };
    };

    const w10m = windowShareStats(10 * 60_000);
    const up = formatUptime(minerStats.uptime);
    const diff = minerStats.last_job_diff != null && minerStats.last_job_diff !== '' ? String(minerStats.last_job_diff) : '';
    const pdiff = minerStats.last_pool_diff != null && minerStats.last_pool_diff !== '' ? String(minerStats.last_pool_diff) : '';
    const h = minerStats.last_job_height != null && minerStats.last_job_height !== '' ? String(minerStats.last_job_height) : '';
    const job = String(minerStats.last_job_id || '').trim();

    const parts = [
      '[STATUS] xmrig-style',
      `algo=${algo}`,
      pool ? `pool=${pool}` : null,
      worker ? `worker=${worker}` : null,
      thrPart ? `thr=${thrPart}` : null,
      `hr=${hrNow}`,
      hr10 != null || hr60 != null || hr15m != null ? `avg ${hrAvg}` : null,
      `A/R=${ar} (${accPct.toFixed(1)}% ok | ${rejPct.toFixed(1)}% rej)`,
      `10m ${w10m.shPerMin.toFixed(2)} sh/min | rej=${w10m.rejPct.toFixed(1)}%`,
      `up=${up}`,
      h ? `h=${h}` : null,
      diff ? `diff=${diff}` : null,
      pdiff ? `pool=${pdiff}` : null,
      job ? `job=${job}` : null,
      reason ? `(${reason})` : null
    ].filter(Boolean);

    const line = parts.join(' | ') + '\n';

    // UI log — ENABLED: Show [STATUS] lines for real-time mining stats
    try {
      sendToRenderer('miner-output', { stream: 'stdout', text: line });
    } catch {
      // ignore
    }

    appendToFileBuffered(LOG_PATH, line, {
      flushDelayMs: 140,
      maxBufferedChars: 256 * 1024,
      rotate: {
        maxBytes: MAX_MINER_LOG_BYTES,
        maxBackups: MAX_MINER_LOG_BACKUPS,
        maxAgeMs: MAX_MINER_LOG_AGE_MS,
        minCheckIntervalMs: 5000
      }
    });
  } catch {
    // ignore
  }
}

function resolveResourcePath(...parts) {
  // In dev: assets live under __dirname/assets
  // In packaged: assets may live inside app.asar OR be copied into Resources via electron-builder extraResources.
  const candidates = [
    path.join(__dirname, ...parts),
    path.join(process.resourcesPath, ...parts),
    path.join(process.resourcesPath, 'assets', ...parts),
    path.join(process.resourcesPath, 'app.asar', ...parts),
    path.join(process.resourcesPath, 'app.asar', 'src', ...parts)
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }

  // Fall back to the most common dev path.
  return path.join(__dirname, ...parts);
}

// (uncaughtException + unhandledRejection handlers registered at top of file)

// App paths
const APP_ROOT = path.join(__dirname, '..');
const IS_PACKAGED = app.isPackaged;

// Miner path: platform-specific
// For packaged app: use resources folder
// For development: use the Python script in project root or resources
let MINER_PATH;
let MINER_IS_PYTHON = false;
let MINER_IS_RUST = false;
let minerFallbackInProgress = false;
let minerFallbackTimer = null;
let minerStartAckTimer = null;
let minerGpuInitWatchdogTimer = null;
let minerStartToken = 0;
let minerUserStopRequested = false;

// Pool failover watchdog — auto-restart miner with a different pool when stratum dies
let poolFailoverCount = 0;         // consecutive crash-restarts
const POOL_FAILOVER_MAX = 3;       // max auto-restarts before giving up
const POOL_FAILOVER_DELAY_MS = 10000; // 10s between restarts
let poolFailoverTimer = null;
let poolHealthTimer = null;          // periodic pool probe while mining

let minerBackendPreferred = 'auto';
let minerBackendResolved = null;
let minerBackendPath = '';
let minerBackendLastError = '';

function mapDeekshaRuntimeBackend(runtimeBackend) {
  const backend = String(runtimeBackend || '').trim().toLowerCase();
  if (!backend) return null;
  if (backend === 'ekam-auto' || backend === 'deeksha-auto' || backend === 'auto') return 'ekam-auto';
  if (backend === 'ekam-native' || backend === 'deeksha-native' || backend === 'native' || backend === 'native_ffi') return 'ekam-native';
  if (backend === 'ekam-fallback' || backend === 'deeksha-fallback' || backend === 'cpu' || backend === 'python' || backend === 'pure_python') return 'ekam-fallback';
  if (backend === 'ekam-opencl' || backend === 'deeksha-opencl' || backend === 'ekam-deeksha-opencl' || backend === 'opencl' || backend === 'gpu_opencl') return 'ekam-opencl';
  if (backend === 'ekam-cuda' || backend === 'deeksha-cuda' || backend === 'cuda' || backend === 'gpu_cuda') return 'ekam-cuda';
  if (backend === 'ekam-metal' || backend === 'deeksha-metal' || backend === 'metal' || backend === 'gpu_metal') return 'ekam-metal';
  if (backend === 'ekam-gpu' || backend === 'deeksha-gpu' || backend === 'gpu') return 'ekam-gpu';
  return backend.startsWith('gpu_') ? `ekam-${backend.slice(4)}` : `ekam-${backend}`;
}

function syncDeekshaResolvedBackend(runtimeBackend) {
  const resolved = mapDeekshaRuntimeBackend(runtimeBackend);
  if (!resolved || minerBackendResolved === resolved) return;
  minerBackendResolved = resolved;
  sendToRenderer('miner-backend', {
    preferred: minerBackendPreferred,
    resolved: minerBackendResolved,
    path: minerBackendPath,
    lastError: minerBackendLastError,
  });
  scheduleStatsEmit();
}

function composeStatsPayload() {
  return {
    ...minerStats,
    isRunning: minerProcess !== null,
    minerBackendPreferred,
    minerBackendResolved,
    minerBackendPath,
    minerBackendLastError
  };
}

function findRustMiner() {
  const namesByPlatform = {
    darwin: [
      'zion-universal-miner',
      'zion-universal-miner-macos-arm64',
      'zion-universal-miner-macos-x64',
      'zion-universal-miner-arm64',
      'zion-universal-miner-x64'
    ],
    linux: ['zion-universal-miner', 'zion-universal-miner-linux-x64'],
    win32: ['zion-universal-miner.exe', 'zion-universal-miner-win-x64.exe', 'zion-miner.exe']
  };

  const names = namesByPlatform[process.platform] || [];
  const searchPaths = IS_PACKAGED
    ? [process.resourcesPath]
    : [
        path.join(APP_ROOT, 'resources'),
        path.join(APP_ROOT, '..', '..', 'target', 'release'),
        path.join(APP_ROOT, '..', '..', 'L1', 'miner', 'target', 'release'),
        path.join(APP_ROOT, '..', '..', 'miner', 'target', 'release'),
        path.join(APP_ROOT, '..', '..', 'zion-universal-miner', 'target', 'release'),
        path.join(APP_ROOT, '..', '..', '2.9.5OLD', 'zion-universal-miner', 'target', 'release'),
        path.join(APP_ROOT, '..', '..', '2.9.5OLD', 'target', 'release'),
        path.join(APP_ROOT, '..', '..', '2.9.5', 'zion-universal-miner', 'target', 'release'),
        path.join(APP_ROOT, '..', '..', '2.9.5', 'target', 'release'),
        path.join(APP_ROOT, '..', 'builds')
      ];

  for (const searchPath of searchPaths) {
    for (const name of names) {
      const fullPath = path.join(searchPath, name);
      if (fs.existsSync(fullPath)) return fullPath;
    }
  }
  return null;
}

function findPythonMiner() {
  const candidateNames = ['zion_native_miner_v2_9.py'];
  const searchPaths = IS_PACKAGED
    ? [process.resourcesPath]
    : [
        path.join(APP_ROOT, 'resources'),
        path.join(APP_ROOT, '..'),
        path.join(APP_ROOT, '..', '2.9.5'),
        path.join(APP_ROOT, '..', 'builds')
      ];

  for (const searchPath of searchPaths) {
    for (const name of candidateNames) {
      const fullPath = path.join(searchPath, name);
      if (fs.existsSync(fullPath)) return fullPath;
    }
  }
  return null;
}

function resolveMinerSelection(preferred) {
  const pref = String(preferred || 'auto').toLowerCase();
  const rustPath = findRustMiner();
  const pyPath = findPythonMiner();
  const legacyExePath = process.platform === 'win32'
    ? (IS_PACKAGED
        ? path.join(process.resourcesPath, 'zion_native_miner_v2_9.exe')
        : path.join(APP_ROOT, 'resources', 'zion_native_miner_v2_9.exe'))
    : null;

  const hasLegacy = legacyExePath && fs.existsSync(legacyExePath);
  const select = (backend, p, isRust, isPython) => ({ backend, path: p, isRust, isPython });

  if (pref === 'rust') {
    if (rustPath) return select('rust', rustPath, true, false);
    // Rust not found (possibly quarantined by Defender) — soft-downgrade to Python/legacy.
    // This prevents hard 'Miner Not Found' errors when Defender removes the binary.
    if (pyPath) return select('python', pyPath, false, true);
    if (hasLegacy) return select('legacy', legacyExePath, false, false);
    return null;
  }

  if (pref === 'python') {
    if (pyPath) return select('python', pyPath, false, true);
    // Strict: user explicitly requested Python, so do not silently fall back.
    return null;
  }

  if (pref === 'legacy') {
    if (hasLegacy) return select('legacy', legacyExePath, false, false);
    return null;
  }

  // auto
  if (rustPath) return select('rust', rustPath, true, false);
  if (pyPath) return select('python', pyPath, false, true);
  if (hasLegacy) return select('legacy', legacyExePath, false, false);
  return null;
}

const rustMinerPath = findRustMiner();
const allowPackagedPythonFallback = String(process.env.ZION_ALLOW_PACKAGED_PYTHON_FALLBACK || '').trim() === '1';
if (rustMinerPath) {
  MINER_PATH = rustMinerPath;
  MINER_IS_RUST = true;
  MINER_IS_PYTHON = false;
  dbg('[MINER] Using Rust native miner:', rustMinerPath);
} else if (process.platform === 'darwin') {
  // macOS: packaged release must use native Rust backend one-click.
  if (IS_PACKAGED && !allowPackagedPythonFallback) {
    throw new Error('Rust miner binary not found in packaged app resources. Rebuild release with prepare-rust-miner.');
  }
  // Dev fallback: use Python script
  MINER_IS_PYTHON = true;
  MINER_IS_RUST = false;
  MINER_PATH = findPythonMiner() || (IS_PACKAGED
    ? path.join(process.resourcesPath, 'zion_native_miner_v2_9.py')
    : path.join(APP_ROOT, 'resources', 'zion_native_miner_v2_9.py'));
  dbg('[MINER] Using Python miner (macOS fallback)');
} else if (process.platform === 'linux') {
  // Linux: packaged release must use native Rust backend one-click.
  if (IS_PACKAGED && !allowPackagedPythonFallback) {
    throw new Error('Rust miner binary not found in packaged app resources. Rebuild release with prepare-rust-miner.');
  }
  // Dev fallback: use Python script
  MINER_IS_PYTHON = true;
  MINER_IS_RUST = false;
  MINER_PATH = findPythonMiner() || (IS_PACKAGED
    ? path.join(process.resourcesPath, 'zion_native_miner_v2_9.py')
    : path.join(APP_ROOT, 'resources', 'zion_native_miner_v2_9.py'));
  dbg('[MINER] Using Python miner (Linux fallback)');
} else {
  // Windows: Python fallback (if present) -> legacy .exe last
  const devPythonMiner = path.join(APP_ROOT, '..', 'zion_native_miner_v2_9.py');
  const resourcesPythonMiner = IS_PACKAGED
    ? path.join(process.resourcesPath, 'zion_native_miner_v2_9.py')
    : path.join(APP_ROOT, 'resources', 'zion_native_miner_v2_9.py');
  const discoveredPythonMiner = findPythonMiner();
  const legacyExePath = IS_PACKAGED
    ? path.join(process.resourcesPath, 'zion_native_miner_v2_9.exe')
    : path.join(APP_ROOT, 'resources', 'zion_native_miner_v2_9.exe');

  if (discoveredPythonMiner) {
    MINER_IS_PYTHON = true;
    MINER_IS_RUST = false;
    MINER_PATH = discoveredPythonMiner;
    dbg('[MINER] Using Python miner (Windows fallback)');
  } else if (!IS_PACKAGED && fs.existsSync(devPythonMiner)) {
    MINER_IS_PYTHON = true;
    MINER_IS_RUST = false;
    MINER_PATH = devPythonMiner;
    dbg('[MINER] Using Python miner (dev mode fallback)');
  } else if (fs.existsSync(resourcesPythonMiner)) {
    MINER_IS_PYTHON = true;
    MINER_IS_RUST = false;
    MINER_PATH = resourcesPythonMiner;
    dbg('[MINER] Using Python miner (Windows fallback)');
  } else if (fs.existsSync(legacyExePath)) {
    MINER_IS_PYTHON = false;
    MINER_IS_RUST = false;
    MINER_PATH = legacyExePath;
    dbg('[MINER] WARNING: Using legacy PyInstaller miner (.exe)');
  } else {
    throw new Error('No miner executable found! Please reinstall the application.');
  }
}

const CONFIG_PATH = path.join(USER_DATA_PATH, 'miner_config.json');
const LOG_PATH = path.join(USER_DATA_PATH, 'miner.log');
const WALLETS_PATH = path.join(USER_DATA_PATH, 'wallets');
const STATS_PATH = path.join(USER_DATA_PATH, 'miner_stats.json');
const STATS_INTERVAL_SEC = (() => {
  const raw = Number(String(process.env.ZION_STATS_INTERVAL_SEC || '5').trim());
  if (!Number.isFinite(raw) || raw < 2) return 5;
  return Math.floor(raw);
})();
const STATS_TICK_MS = STATS_INTERVAL_SEC * 1000;

// Afterburner service (Python JSON-lines RPC)
const AFTERBURNER_SCRIPT_PATH = IS_PACKAGED
  ? path.join(process.resourcesPath, 'afterburner_service.py')
  : path.join(APP_ROOT, 'resources', 'afterburner_service.py');

// Miner log retention:
// - We want primarily *current* outputs in UI and on disk.
// - Cap by size (to avoid runaway chatty miners) and by age (to avoid multi-day logs).
// - Backups disabled by default to keep only the current file (per UX request).
const MAX_MINER_LOG_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_MINER_LOG_BACKUPS = 0;
const MAX_MINER_LOG_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Ekam Deeksha canonical runtime ────────────────────────────────────────────
// v2.9.8+: `cosmic_harmony` resolves to Ekam Deeksha from genesis on the current single-host testnet.

const PRIMARY_TESTNET_HOST = String(process.env.ZION_PRIMARY_TESTNET_HOST || '91.98.122.165').trim() || '91.98.122.165';
const PRIMARY_POOL_PORT = Number(String(process.env.ZION_PRIMARY_POOL_PORT || '3333').trim()) || 3333;
const PRIMARY_RPC_PORT = Number(String(process.env.ZION_PRIMARY_RPC_PORT || '8444').trim()) || 8444;
const PRIMARY_AI_NATIVE_PORT = Number(String(process.env.ZION_PRIMARY_AI_NATIVE_PORT || '8001').trim()) || 8001;
const DEFAULT_RPC_URL = `http://${PRIMARY_TESTNET_HOST}:${PRIMARY_RPC_PORT}/jsonrpc`;
const DEFAULT_AI_NATIVE_POOL_URL = `http://${PRIMARY_TESTNET_HOST}:${PRIMARY_AI_NATIVE_PORT}`;
const DEFAULT_DAO_API_BASE = `http://${PRIMARY_TESTNET_HOST}:8080`;
const DEFAULT_WARP_API_BASE = `http://${PRIMARY_TESTNET_HOST}:9333`;
const DESKTOP_PURE_ZION_DEFAULT = String(process.env.ZION_DESKTOP_PURE_ZION || '1').trim() !== '0';
const LEGACY_TESTNET_HOSTS = new Set([
  '77.42.31.72',
  '178.156.240.160',
  '5.223.43.93',
  'pool.zionterranova.com',
  PRIMARY_TESTNET_HOST.toLowerCase(),
]);

// ── Revenue / Funding Split ───────────────────────────────────────────────────
// Pool distributes block rewards:  89% miners, 1% pool, 5% humanitarian (L5),
// 5% Issobella (L6).
const MINERS_PCT = 89;
const POOL_FEE_PCT = 1;
const HUMANITARIAN_PCT = 5;   // L5 Free World
const ISSOBELLA_PCT = 5;      // L6 Issobella

// Default configuration
const DEFAULT_REVENUE_PROFILE = {
  enabled: !DESKTOP_PURE_ZION_DEFAULT,
  allocation: {
    zionPct: DESKTOP_PURE_ZION_DEFAULT ? 100 : 50,
    multiAlgoPct: DESKTOP_PURE_ZION_DEFAULT ? 0 : 25,
    nclPct: DESKTOP_PURE_ZION_DEFAULT ? 0 : 25
  },
  cpu: {
    coin: 'auto'
  },
  merged: {
    etcEnabled: false,
    nxsEnabled: false
  },
  gpu: {
    enabled: false,
    // All 9 GPU coins supported by profit switcher (HeroMiners + ZPool + NiceHash)
    coins: ['KAS', 'ETC', 'ALPH', 'ERG', 'RVN', 'CFX', 'ZANO', 'EVR', 'MEWC', 'FLUX', 'CLORE']
  },
  ncl: {
    enabled: false
  },
  nclEnabled: false,
  freeStreams: {
    mysterium: true,
    nkn: true,
    aiGateway: true
  }
};

function isLegacyOrLocalHost(value) {
  const raw = String(value || '').trim().toLowerCase();
  return raw === 'localhost'
    || raw === '127.0.0.1'
    || raw === '::1'
    || LEGACY_TESTNET_HOSTS.has(raw);
}

function normalizeRevenueProfile(input) {
  const src = (input && typeof input === 'object') ? input : {};
  const allocationRaw = (src.allocation && typeof src.allocation === 'object') ? src.allocation : {};

  const toPct = (v, fallback) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, Math.round(n)));
  };

  let zionPct = toPct(allocationRaw.zionPct, DEFAULT_REVENUE_PROFILE.allocation.zionPct);
  let multiAlgoPct = toPct(allocationRaw.multiAlgoPct, DEFAULT_REVENUE_PROFILE.allocation.multiAlgoPct);
  let nclPct = toPct(allocationRaw.nclPct, DEFAULT_REVENUE_PROFILE.allocation.nclPct);

  const total = zionPct + multiAlgoPct + nclPct;
  if (total !== 100) {
    if (total <= 0) {
      zionPct = 50;
      multiAlgoPct = 25;
      nclPct = 25;
    } else {
      zionPct = Math.round((zionPct / total) * 100);
      multiAlgoPct = Math.round((multiAlgoPct / total) * 100);
      nclPct = 100 - zionPct - multiAlgoPct;
    }
  }

  const gpuObj = (src.gpu && typeof src.gpu === 'object') ? src.gpu : {};
  const mergedObj = (src.merged && typeof src.merged === 'object') ? src.merged : {};
  const nclObj = (src.ncl && typeof src.ncl === 'object') ? src.ncl : {};
  const cpuObj = (src.cpu && typeof src.cpu === 'object') ? src.cpu : {};

  const coinsRaw = Array.isArray(gpuObj.coins)
    ? gpuObj.coins
    : (typeof gpuObj.coins === 'string' ? gpuObj.coins.split(',') : DEFAULT_REVENUE_PROFILE.gpu.coins);

  const coins = Array.from(new Set(coinsRaw
    .map((value) => String(value || '').trim().toUpperCase())
    .filter(Boolean)));

  return {
    enabled: src.enabled !== false,
    allocation: {
      zionPct,
      multiAlgoPct,
      nclPct
    },
    cpu: {
      coin: String(cpuObj.coin || 'auto').trim().toLowerCase() || 'auto'
    },
    merged: {
      etcEnabled: !!mergedObj.etcEnabled,
      nxsEnabled: !!mergedObj.nxsEnabled
    },
    gpu: {
      enabled: !!gpuObj.enabled,
      coins: coins.length ? coins : [...DEFAULT_REVENUE_PROFILE.gpu.coins],
      // Pool provider preference: 'nicehash' | 'herominers' (default) | 'zpool' | 'default'
      poolPreference: String(gpuObj.poolPreference || src.poolPreference || 'herominers').toLowerCase(),
      // Mining region: 'eu' (default) | 'na' | 'hk'
      poolRegion: String(gpuObj.poolRegion || src.poolRegion || 'eu').toLowerCase(),
      // BTC address for NiceHash stratum (username = BTC addr, payout = BTC)
      nicehashBtcAddr: String(gpuObj.nicehashBtcAddr || src.nicehashBtcAddr || '').trim() || null
    },
    ncl: {
      enabled: !!nclObj.enabled
    }
  };
}

function toPureZionRevenueProfile(profile) {
  const base = normalizeRevenueProfile(profile || {});
  return {
    ...base,
    enabled: false,
    allocation: {
      zionPct: 100,
      multiAlgoPct: 0,
      nclPct: 0
    },
    cpu: {
      coin: 'auto'
    },
    merged: {
      etcEnabled: false,
      nxsEnabled: false
    },
    gpu: {
      ...base.gpu,
      enabled: false
    },
    ncl: {
      enabled: false
    },
    nclEnabled: false
  };
}

function isPureZionDesktopMode(config) {
  const profile = normalizeRevenueProfile(config?.revenue || {});
  return profile.enabled === false
    && Number(profile?.allocation?.zionPct ?? 0) === 100
    && Number(profile?.allocation?.multiAlgoPct ?? 0) === 0
    && Number(profile?.allocation?.nclPct ?? 0) === 0
    && !profile?.gpu?.enabled
    && !profile?.ncl?.enabled
    && !profile?.merged?.etcEnabled
    && !profile?.merged?.nxsEnabled;
}

function isLegacyDefaultRevenueProfile(input) {
  const profile = normalizeRevenueProfile(input || {});
  return profile.enabled !== false
    && Number(profile?.allocation?.zionPct ?? 0) === 50
    && Number(profile?.allocation?.multiAlgoPct ?? 0) === 25
    && Number(profile?.allocation?.nclPct ?? 0) === 25
    && !profile?.gpu?.enabled
    && !profile?.ncl?.enabled
    && !profile?.merged?.etcEnabled
    && !profile?.merged?.nxsEnabled;
}

const DEFAULT_CONFIG = {
  pool: {
    host: PRIMARY_TESTNET_HOST,
    port: PRIMARY_POOL_PORT
  },
  desktopPureZionDefault: DESKTOP_PURE_ZION_DEFAULT,
  // ZION chain JSON-RPC endpoint (native core)
  rpcUrl: DEFAULT_RPC_URL,
  // Mining algorithm — Deeksha canonical path (pool name: `cosmic_harmony`)
  algorithm: 'cosmic_harmony',
  // AI Afterburner integration (controls env ZION_AI_AFTERBURNER)
  // Enabled by default: monitors GPU power draw and computes H/W efficiency metric
  aiAfterburner: true,
  // AI Native compute (earn ZION by processing AI tasks)
  aiNative: false, // OFF by default, user must enable
  aiNativePoolUrl: DEFAULT_AI_NATIVE_POOL_URL,
  aiNativeConsciousness: 1,
  // Local chat (optional)
  // Cloud chat (OpenAI-compatible). Keep endpoint editable for future ZION AI Native.
  chatEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
  // Free-tier via OpenRouter (model ids ending with :free)
  chatModel: 'allenai/olmo-3.1-32b-think:free',
  chatApiKey: '',
  wallet: '',
  worker: 'desktop-agent',
  threads: Math.max(1, (Array.isArray(os.cpus?.()) ? os.cpus().length : 4) - 1),
  gpu: true,
  // Cosmic Harmony GPU performance knobs (safe defaults for Ryzen 5 3600 + RX 5700 class rigs)
  gpuCpuThreads: 5,
  gpuBatchSize: 16000000,
  revenue: DEFAULT_REVENUE_PROFILE,
  // GPU Revenue Mining (CH3 Dynamic GPU system)
  gpuRevenue: false, // Enable GPU revenue mining with profit switching
  gpuRevenueCoins: ['KAS', 'ETC', 'ALPH', 'ERG', 'RVN', 'CFX', 'ZANO', 'EVR', 'MEWC', 'FLUX', 'CLORE'],
  // Pool provider preference for GPU Revenue Mining
  // 'herominers' (default) | 'nicehash' | 'zpool' | 'default'
  // Override at runtime: ZION_POOL_PREFERENCE env var
  poolPreference: 'herominers',
  // Mining region for pool selection: 'eu' (default) | 'na' | 'hk'
  poolRegion: 'eu',
  // BTC address for NiceHash stratum payout (required when poolPreference = 'nicehash')
  // Falls back to main wallet if empty. Set via ZION_NH_BTC_ADDR env var.
  nicehashBtcAddr: '',
  // Revenue BTC payout wallet (separate from ZION wallet for external pool payouts)
  revenueWallet: 'bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw',
  // Primary backend default: Rust everywhere. Python is kept only as emergency fallback.
  minerBackend: 'rust',
  // Python miner console style (used only when python backend is active).
  pythonUi: 'trex',
  autoStart: false,
  autoSelectPool: true,
  minimizeToTray: true,
  startMinimized: false
};

function algoSupportsGpu(algo) {
  const a = normalizeAlgorithmName(algo || 'cosmic_harmony');
  return isCosmicHarmonyFamily(a);
}

function normalizeAlgorithmName(algo) {
  const raw = String(algo || '').trim().toLowerCase().replace(/-/g, '_');
  if (
    raw === 'cosmic_harmony_v3' ||
    raw === 'cosmic_harmony_v4' ||
    raw === 'cosmic_harmony_v4_2' ||
    raw === 'cosmic_harmony_v42' ||
    raw === 'chv3' ||
    raw === 'ch3' ||
    raw === 'chv4' ||
    raw === 'ch4' ||
    raw === 'chv4_2' ||
    raw === 'ch4_2' ||
    raw === 'chv4.2' ||
    raw === 'ch42' ||
    raw === 'merkabah' ||
    raw === 'deeksha' ||
    raw === 'cosmic_harmony_deeksha' ||
    raw === 'ekam' ||
    raw === 'ekam_deeksha' ||
    raw === 'cosmic_harmony_ekam' ||
    raw === 'ch_ekam' ||
    raw === 'che'
  ) {
    return 'cosmic_harmony';
  }
  return raw || 'cosmic_harmony';
}

function isCosmicHarmonyFamily(algo) {
  const a = normalizeAlgorithmName(algo || 'cosmic_harmony');
  return a === 'cosmic_harmony';
}

// Load or create config
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const configOnDisk = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      const merged = {
        ...DEFAULT_CONFIG,
        ...configOnDisk,
        pool: {
          ...DEFAULT_CONFIG.pool,
          ...(configOnDisk.pool || {})
        }
      };

      merged.revenue = normalizeRevenueProfile(configOnDisk.revenue || merged.revenue);
      const hasExplicitRevenue = Object.prototype.hasOwnProperty.call(configOnDisk || {}, 'revenue');
      const shouldMigratePureZion = DESKTOP_PURE_ZION_DEFAULT
        && (!hasExplicitRevenue || isLegacyDefaultRevenueProfile(configOnDisk.revenue));
      // Backward compatibility with older top-level GPU revenue fields.
      if (typeof configOnDisk.gpuRevenue === 'boolean') {
        merged.revenue.gpu.enabled = configOnDisk.gpuRevenue;
      }
      if (Array.isArray(configOnDisk.gpuRevenueCoins) && configOnDisk.gpuRevenueCoins.length) {
        merged.revenue.gpu.coins = configOnDisk.gpuRevenueCoins.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean);
      }
      if (DESKTOP_PURE_ZION_DEFAULT && shouldMigratePureZion) {
        merged.revenue = toPureZionRevenueProfile(merged.revenue);
      }
      merged.gpuRevenue = !!merged.revenue.gpu.enabled;
      merged.gpuRevenueCoins = Array.isArray(merged.revenue.gpu.coins) && merged.revenue.gpu.coins.length
        ? [...merged.revenue.gpu.coins]
        : [...DEFAULT_REVENUE_PROFILE.gpu.coins];

      // Prefer Rust miner everywhere if it exists.
      // Upgrade legacy 'python' or 'auto' pins to 'rust' when the binary is available.
      try {
        const rustPath = findRustMiner();
        const mb = String(merged?.minerBackend || '').toLowerCase();
        if (rustPath && (!mb || mb === 'auto' || mb === 'python')) {
          merged.minerBackend = 'rust';
        }
      } catch {
        // ignore
      }

      // Windows default: make Rust the primary backend even for older configs that
      // still say "auto". If the user explicitly chose Python, respect it.
      try {
        if (process.platform === 'win32') {
          const mb = String(merged?.minerBackend || '').toLowerCase();
          if (!mb || mb === 'auto') merged.minerBackend = 'rust';
        }
      } catch {
        // ignore
      }
      if (typeof merged.rpcUrl === 'string') {
        const trimmed = merged.rpcUrl.trim();
        if (trimmed === 'http://localhost:18081/json_rpc' || trimmed === 'http://127.0.0.1:18081/json_rpc') {
          merged.rpcUrl = DEFAULT_RPC_URL;
        }
        // Migrate localhost RPC to testnet server (user unlikely runs local node)
        if (trimmed === 'http://localhost:8444/jsonrpc' || trimmed === 'http://127.0.0.1:8444/jsonrpc') {
          merged.rpcUrl = DEFAULT_RPC_URL;
        }
        try {
          const parsed = new URL(merged.rpcUrl);
          if (isLegacyOrLocalHost(parsed.hostname)) {
            merged.rpcUrl = DEFAULT_RPC_URL;
          }
        } catch {
          // ignore malformed rpc url
        }
      }
      if (merged.pool && isLegacyOrLocalHost(merged.pool.host)) {
        merged.pool.host = PRIMARY_TESTNET_HOST;
        merged.pool.port = PRIMARY_POOL_PORT;
      }
      if (typeof merged.aiNativePoolUrl === 'string') {
        try {
          const parsedAiNative = new URL(merged.aiNativePoolUrl.trim());
          if (isLegacyOrLocalHost(parsedAiNative.hostname)) {
            merged.aiNativePoolUrl = DEFAULT_AI_NATIVE_POOL_URL;
          }
        } catch {
          merged.aiNativePoolUrl = DEFAULT_AI_NATIVE_POOL_URL;
        }
      }
      merged.algorithm = normalizeAlgorithmName(merged.algorithm || DEFAULT_CONFIG.algorithm);
      merged.desktopPureZionDefault = DESKTOP_PURE_ZION_DEFAULT;
      return merged;
    }
  } catch (err) {
    console.error('Failed to load config:', err);
  }
  return {
    ...DEFAULT_CONFIG,
    desktopPureZionDefault: DESKTOP_PURE_ZION_DEFAULT,
  };
}

function saveConfig(config) {
  try {
    const { desktopPureZionDefault, ...persistedConfig } = config || {};
    persistedConfig.algorithm = normalizeAlgorithmName(
      persistedConfig.algorithm || DEFAULT_CONFIG.algorithm
    );
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(persistedConfig, null, 2));
    return true;
  } catch (err) {
    console.error('Failed to save config:', err);
    return false;
  }
}

// Ensure required directories exist
function ensureDirectories() {
  const dirs = [
    USER_DATA_PATH,
    CACHE_PATH,
    WALLETS_PATH
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      dbg('Created directory:', dir);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// SECURITY FIX: macOS Gatekeeper quarantine + permissions
// On macOS, downloaded apps/binaries get com.apple.quarantine xattr
// which blocks execution. We strip it proactively on startup.
// Also ensures execute permissions on all miner binaries.
// ═══════════════════════════════════════════════════════════════════
function fixSecurityBlocks() {
  const results = { fixed: [], errors: [] };

  // Collect all binary/script paths that need to be executable
  const resourceBase = IS_PACKAGED ? process.resourcesPath : path.join(APP_ROOT, 'resources');
  const binaryNames = [
    'zion-miner', 'zion-universal-miner',
    'zion_native_miner_v2_9.py', 'ai_native_client.py',
    'afterburner_service.py',
    'mining/cosmic_harmony_native.py',
    'mining/cosmic_harmony_v3_gpu.py',
    'mining/cosmic_harmony_v3_python.py',
    'mining/cosmic_harmony_v4_native.py',  // CHv4 dylib FFI (Python binding)
    'mining/cosmic_harmony_deeksha_fallback.py',
    'mining/cosmic_harmony_deeksha_gpu.py',
    'native-libs/libcosmic_harmony.dylib', // CHv4 native lib (macOS)
    'native-libs/libcosmic_harmony_deeksha.dylib',
  ];

  // Platform-specific exe names
  if (process.platform === 'win32') {
    binaryNames.push('zion-miner.exe', 'zion-universal-miner.exe', 'zion_native_miner_v2_9.exe');
  }

  const targetPaths = binaryNames
    .map(name => path.join(resourceBase, name))
    .filter(p => fs.existsSync(p));

  // macOS: Remove quarantine xattr and set execute permissions
  if (process.platform === 'darwin') {
    for (const targetPath of targetPaths) {
      try {
        // Remove com.apple.quarantine extended attribute
        const { execSync } = require('child_process');
        execSync(`xattr -dr com.apple.quarantine "${targetPath}" 2>/dev/null || true`, { timeout: 5000 });
        results.fixed.push(`xattr: ${path.basename(targetPath)}`);
      } catch (err) {
        results.errors.push(`xattr ${path.basename(targetPath)}: ${err?.message}`);
      }
      try {
        fs.chmodSync(targetPath, 0o755);
        results.fixed.push(`chmod: ${path.basename(targetPath)}`);
      } catch (err) {
        results.errors.push(`chmod ${path.basename(targetPath)}: ${err?.message}`);
      }
    }

    // Also fix the app binary itself and native_modules if packaged
    if (IS_PACKAGED) {
      try {
        const { execSync } = require('child_process');
        // Strip quarantine from the entire resources dir recursively
        execSync(`xattr -dr com.apple.quarantine "${resourceBase}" 2>/dev/null || true`, { timeout: 10000 });
        results.fixed.push('xattr: resources/ (recursive)');
      } catch (err) {
        results.errors.push(`xattr resources/: ${err?.message}`);
      }
    }
  }

  // Linux: Ensure execute permissions
  if (process.platform === 'linux') {
    for (const targetPath of targetPaths) {
      try {
        fs.chmodSync(targetPath, 0o755);
        results.fixed.push(`chmod: ${path.basename(targetPath)}`);
      } catch (err) {
        results.errors.push(`chmod ${path.basename(targetPath)}: ${err?.message}`);
      }
    }
  }

  // Windows: Check if Defender has quarantined the miner binary
  if (process.platform === 'win32') {
    const minerExes = targetPaths.filter(p => /\.(exe)$/i.test(p));
    for (const exe of minerExes) {
      if (!fs.existsSync(exe)) {
        results.errors.push(`missing (quarantined?): ${path.basename(exe)}`);
      }
    }
  }

  if (results.fixed.length > 0) {
    dbg('[security-fix] Fixed:', results.fixed.join(', '));
  }
  if (results.errors.length > 0) {
    dbg('[security-fix] Errors:', results.errors.join(', '));
  }

  return results;
}

// IPC: Get security/AV status and troubleshooting info
ipcMain.handle('get-security-status', async () => {
  const resourceBase = IS_PACKAGED ? process.resourcesPath : path.join(APP_ROOT, 'resources');
  const status = {
    platform: process.platform,
    isPackaged: IS_PACKAGED,
    resourcesPath: resourceBase,
    binaries: {},
    recommendations: [],
  };

  const checkBinaries = ['zion-miner', 'zion-universal-miner'];
  if (process.platform === 'win32') {
    checkBinaries.push('zion-miner.exe', 'zion-universal-miner.exe');
  }

  for (const name of checkBinaries) {
    const fullPath = path.join(resourceBase, name);
    const exists = fs.existsSync(fullPath);
    let executable = false;
    let quarantined = false;

    if (exists) {
      try {
        fs.accessSync(fullPath, fs.constants.X_OK);
        executable = true;
      } catch {
        executable = false;
      }

      // macOS: check quarantine xattr
      if (process.platform === 'darwin') {
        try {
          const { execSync } = require('child_process');
          const xattrOut = execSync(`xattr -l "${fullPath}" 2>/dev/null || true`, { timeout: 3000, encoding: 'utf8' });
          quarantined = xattrOut.includes('com.apple.quarantine');
        } catch {
          // ignore
        }
      }
    }

    status.binaries[name] = { exists, executable, quarantined };
  }

  // Generate recommendations
  if (process.platform === 'darwin') {
    const anyQuarantined = Object.values(status.binaries).some(b => b.quarantined);
    const anyNotExecutable = Object.values(status.binaries).some(b => b.exists && !b.executable);
    if (anyQuarantined) {
      status.recommendations.push({
        type: 'macos-quarantine',
        title: 'macOS Gatekeeper blokuje miner',
        description: 'Stáhnuté soubory mají quarantine příznak. Klikněte "Opravit" nebo spusťte v terminálu:',
        command: `xattr -dr com.apple.quarantine "${resourceBase}"`,
      });
    }
    if (anyNotExecutable) {
      status.recommendations.push({
        type: 'macos-permissions',
        title: 'Chybí exec permissions',
        description: 'Binárky nemají oprávnění ke spuštění.',
        command: `chmod +x "${resourceBase}/zion-miner" "${resourceBase}/zion-universal-miner"`,
      });
    }
    const anyMissing = Object.values(status.binaries).some(b => !b.exists);
    if (!anyQuarantined && !anyNotExecutable && !anyMissing) {
      status.recommendations.push({ type: 'ok', title: 'Vše OK', description: 'Žádné bezpečnostní problémy nenalezeny.' });
    }
  } else if (process.platform === 'win32') {
    const anyMissing = Object.values(status.binaries).some(b => !b.exists);
    if (anyMissing) {
      status.recommendations.push({
        type: 'windows-defender',
        title: 'Windows Defender zablokoval miner',
        description: 'Miner binary byla pravděpodobně smazána antivirem. Postup:\n1. Otevřete Windows Security → Ochrana před viry\n2. Historie ochrany → Povolte zablokovanou položku\n3. Přidejte výjimku pro složku:',
        command: resourceBase,
      });
    } else {
      status.recommendations.push({ type: 'ok', title: 'Vše OK', description: 'Žádné bezpečnostní problémy nenalezeny.' });
    }
  } else {
    status.recommendations.push({ type: 'ok', title: 'Vše OK', description: 'Linux — žádné známé problémy.' });
  }

  return status;
});

// IPC: Attempt to fix security blocks (macOS quarantine, permissions)
ipcMain.handle('fix-security-blocks', async () => {
  try {
    const results = fixSecurityBlocks();
    return { success: true, ...results };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

// IPC: Open Windows Defender exclusion settings (Windows only)
ipcMain.handle('open-defender-settings', async () => {
  try {
    if (process.platform !== 'win32') return { success: false, error: 'Not Windows' };
    const { shell } = require('electron');
    // Opens Windows Security virus & threat protection settings
    await shell.openExternal('windowsdefender://threat');
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

function rotateFileIfTooLarge(filePath, maxBytes, maxBackups = 1, maxAgeMs = null) {
  // IMPORTANT:
  // Using stat.mtime for "age" does NOT work for logs that are continuously appended
  // (mtime is always fresh). We therefore track a separate epoch in a sidecar meta file.
  const metaPath = `${filePath}.meta.json`;

  const readEpochMs = (stat, now) => {
    try {
      if (fs.existsSync(metaPath)) {
        const raw = fs.readFileSync(metaPath, 'utf8');
        const j = JSON.parse(raw);
        const v = Number(j?.createdAtMs);
        if (Number.isFinite(v) && v > 0) return v;
      }
    } catch {
      // ignore
    }

    // Bootstrap epoch from file timestamps if meta is missing/corrupt.
    // Prefer birthtime/ctime where available (do NOT use mtime).
    const bt = typeof stat?.birthtimeMs === 'number' ? stat.birthtimeMs : NaN;
    const ct = typeof stat?.ctimeMs === 'number' ? stat.ctimeMs : NaN;
    const epoch = (Number.isFinite(bt) && bt > 0)
      ? bt
      : (Number.isFinite(ct) && ct > 0)
        ? ct
        : now;

    try {
      fs.writeFileSync(metaPath, JSON.stringify({ createdAtMs: epoch }), 'utf8');
    } catch {
      // ignore
    }
    return epoch;
  };

  const writeEpochMs = (epochMs) => {
    try {
      fs.writeFileSync(metaPath, JSON.stringify({ createdAtMs: epochMs }), 'utf8');
    } catch {
      // ignore
    }
  };

  const purgeOldBackups = (now) => {
    if (maxAgeMs == null) return;
    const n = Number(maxBackups);
    if (!Number.isFinite(n) || n <= 0) return;
    for (let i = 1; i <= n; i += 1) {
      const p = `${filePath}.${i}`;
      try {
        if (!fs.existsSync(p)) continue;
        const s = fs.statSync(p);
        if (!s.isFile()) continue;
        const ageMs = now - (typeof s.mtimeMs === 'number' ? s.mtimeMs : s.mtime.getTime());
        if (ageMs > maxAgeMs) fs.unlinkSync(p);
      } catch {
        // ignore
      }
    }
  };

  try {
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return;

    const now = Date.now();

    // Always purge too-old backups opportunistically.
    purgeOldBackups(now);

    const epochMs = maxAgeMs != null ? readEpochMs(stat, now) : now;
    const shouldRotateBySize = stat.size > maxBytes;
    const shouldRotateByAge = maxAgeMs != null && (now - epochMs) > maxAgeMs;

    if (!shouldRotateBySize && !shouldRotateByAge) return;

    // If backups are disabled, truncate in-place (and reset epoch) to keep only current outputs.
    if (!Number.isFinite(Number(maxBackups)) || Number(maxBackups) <= 0) {
      try {
        fs.truncateSync(filePath, 0);
      } catch {
        // ignore
      }
      writeEpochMs(now);
      return;
    }

    for (let i = maxBackups; i >= 1; i -= 1) {
      const src = `${filePath}.${i}`;
      const dst = `${filePath}.${i + 1}`;
      if (fs.existsSync(src)) {
        try {
          if (i + 1 > maxBackups) {
            fs.unlinkSync(src);
          } else {
            if (fs.existsSync(dst)) fs.unlinkSync(dst);
            fs.renameSync(src, dst);
          }
        } catch {
          // ignore rotation failures
        }
      }
    }

    const backup = `${filePath}.1`;
    try {
      if (fs.existsSync(backup)) fs.unlinkSync(backup);
      fs.renameSync(filePath, backup);
    } catch {
      // If rename fails (e.g., file locked), best effort: truncate.
      try {
        fs.truncateSync(filePath, 0);
      } catch {
        // ignore
      }
    }

    // New period starts now (prevents repeated "age" rotation on every append).
    writeEpochMs(now);
  } catch {
    // ignore
  }
}

function bytesToGiB(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n / (1024 ** 3);
}

function getMacVmStatAvailableBytes() {
  // Use vm_stat for a better approximation than os.freemem() on macOS.
  // We treat: free + speculative + inactive + purgeable as "available".
  // This is a heuristic to avoid RandomX FULL_MEM triggering heavy memory pressure.
  try {
    const out = execFileSync('vm_stat', { encoding: 'utf8' });
    const pageSizeMatch = out.match(/page size of\s+(\d+)\s+bytes/i);
    const pageSize = pageSizeMatch ? Number(pageSizeMatch[1]) : 4096;

    const getPages = (label) => {
      const re = new RegExp(`^\\s*${label}:\\s*(\\d+)\\.$`, 'mi');
      const m = out.match(re);
      return m ? Number(m[1]) : 0;
    };

    const pagesFree = getPages('Pages free');
    const pagesSpec = getPages('Pages speculative');
    const pagesInactive = getPages('Pages inactive');
    const pagesPurgeable = getPages('Pages purgeable');

    const pagesAvail = pagesFree + pagesSpec + pagesInactive + pagesPurgeable;
    const availBytes = Math.max(0, pagesAvail) * (Number.isFinite(pageSize) ? pageSize : 4096);
    return Number.isFinite(availBytes) ? availBytes : null;
  } catch {
    return null;
  }
}

function decideRandomxModeForMac(config) {
  const totalBytes = os.totalmem();
  const totalGiB = bytesToGiB(totalBytes);
  const threads = Number(config?.threads) || 1;

  const availBytes = getMacVmStatAvailableBytes();
  const availGiB = availBytes != null ? bytesToGiB(availBytes) : bytesToGiB(os.freemem());

  // RandomX FULL_MEM allocates ~2GiB dataset + overhead; macOS memory pressure can crater hashrate.
  // Keep it simple & safe for non-technical users:
  // - Prefer LIGHT mode on smaller machines, or when available memory is low.
  // - Prefer FULL_MEM when memory headroom seems comfortable.
  const forceLight = (totalGiB < 12) || (availGiB < 5) || (threads >= 8 && availGiB < 7);

  if (forceLight) {
    return {
      light: true,
      reason: `low memory headroom (available ~${availGiB.toFixed(1)} GiB of ${totalGiB.toFixed(1)} GiB)`
    };
  }

  return {
    light: false,
    reason: `memory OK (available ~${availGiB.toFixed(1)} GiB of ${totalGiB.toFixed(1)} GiB)`
  };
}

// ============================================================================
// GPU AUTO-DETECTION (CH3 Architecture)
// Mirrors logic from Zion-2.9.6/pool/src/profit_switcher.rs
// and Zion-2.9.6/miner/src/miner/mod.rs
// ============================================================================

let cachedGpuInfo = null;
let gpuInfoLastProbeMs = 0;

function detectGPU() {
  const now = Date.now();
  if (cachedGpuInfo && (now - gpuInfoLastProbeMs) < 60000) return cachedGpuInfo;

  const result = {
    available: false, type: 'none', name: '', driver: '',
    memory: '', temperature: '', utilization: '', cpuOnly: true,
    backendPreferred: 'opencl',
    cudaCapable: false
  };

  // 1. Environment override: ZION_HAS_GPU=1/0
  const envGpu = (process.env.ZION_HAS_GPU || '').trim();
  if (envGpu === '1') {
    result.available = true;
    result.cpuOnly = false;
    result.type = 'env-override';
    result.name = 'GPU (ZION_HAS_GPU=1)';
    cachedGpuInfo = result;
    gpuInfoLastProbeMs = now;
    return result;
  }
  if (envGpu === '0') {
    cachedGpuInfo = result;
    gpuInfoLastProbeMs = now;
    return result;
  }

  // 2. macOS: system_profiler for Metal GPU
  if (process.platform === 'darwin') {
    try {
      const out = execFileSync('system_profiler', ['SPDisplaysDataType'], {
        timeout: 5000, encoding: 'utf8'
      });
      const nameMatch = out.match(/Chipset Model:\s*(.+)/i) || out.match(/Chip:\s*(.+)/i);
      const vramMatch = out.match(/VRAM.*?:\s*(.+)/i);
      const metalMatch = out.match(/Metal.*?:\s*(Supported|Yes)/i);
      if (nameMatch) {
        result.available = true;
        result.cpuOnly = false;
        result.type = 'metal';
        result.name = nameMatch[1].trim();
        result.memory = vramMatch ? vramMatch[1].trim() : 'Unified';
        result.driver = metalMatch ? 'Metal Supported' : 'Metal';
      }
    } catch {}
  }

  // 3. nvidia-smi (NVIDIA GPUs — Linux/Windows)
  if (!result.available) {
    try {
      const out = execFileSync('nvidia-smi', [
        '--query-gpu=name,memory.total,driver_version,temperature.gpu,utilization.gpu',
        '--format=csv,noheader,nounits'
      ], { timeout: 5000, encoding: 'utf8' });
      const parts = out.trim().split(',').map(s => s.trim());
      if (parts[0]) {
        result.available = true;
        result.cpuOnly = false;
        result.type = 'nvidia';
        result.name = parts[0];
        result.memory = parts[1] ? `${parts[1]} MB` : '';
        result.driver = parts[2] || '';
        result.temperature = parts[3] ? `${parts[3]}°C` : '';
        result.utilization = parts[4] ? `${parts[4]}%` : '';
        result.backendPreferred = 'cuda';
        result.cudaCapable = true;
      }
    } catch {}
  }

  // 4. rocm-smi (AMD GPUs — Linux)
  if (!result.available) {
    try {
      const out = execFileSync('rocm-smi', ['--showproductname'], {
        timeout: 5000, encoding: 'utf8'
      });
      const nameMatch = out.match(/GPU\[\d+\].*?:\s*(.+)/i);
      if (nameMatch) {
        result.available = true;
        result.cpuOnly = false;
        result.type = 'amd';
        result.name = nameMatch[1].trim();
        result.backendPreferred = 'opencl';
      }
    } catch {}
  }

  // 5. Windows GPU detection via PowerShell (AMD/Intel GPUs not found by nvidia-smi)
  if (!result.available && process.platform === 'win32') {
    try {
      const out = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-CimInstance Win32_VideoController | Select-Object -First 1 -ExpandProperty Name'
      ], { timeout: 8000, encoding: 'utf8', windowsHide: true });
      const gpuName = out.trim();
      if (gpuName && !/microsoft basic|remote desktop/i.test(gpuName)) {
        result.available = true;
        result.cpuOnly = false;
        result.name = gpuName;
        if (/radeon|amd|gfx/i.test(gpuName)) {
          result.type = 'amd';
          result.backendPreferred = 'opencl';
        } else if (/intel|iris|uhd|arc/i.test(gpuName)) {
          result.type = 'intel';
          result.backendPreferred = 'opencl';
        } else {
          result.type = 'gpu';
          result.backendPreferred = 'opencl';
        }
        // Try to get VRAM
        try {
          const memOut = execFileSync('powershell', [
            '-NoProfile', '-Command',
            'Get-CimInstance Win32_VideoController | Select-Object -First 1 -ExpandProperty AdapterRAM'
          ], { timeout: 5000, encoding: 'utf8', windowsHide: true });
          const ramBytes = Number(memOut.trim());
          if (Number.isFinite(ramBytes) && ramBytes > 0) {
            result.memory = `${Math.round(ramBytes / (1024 * 1024))} MB`;
          }
        } catch { /* ignore */ }
      }
    } catch {}
  }

  if (result.available && process.platform === 'darwin') {
    result.backendPreferred = 'metal';
  } else if (result.available && result.type === 'nvidia') {
    result.backendPreferred = 'cuda';
  } else if (result.available) {
    result.backendPreferred = 'opencl';
  }

  cachedGpuInfo = result;
  gpuInfoLastProbeMs = now;
  try { logApp('gpu-detect', JSON.stringify(result)); } catch {}
  return result;
}

function parseGpuMemoryMb(gpuInfo) {
  try {
    const raw = String(gpuInfo?.memory || '').trim();
    const match = raw.match(/(\d+(?:\.\d+)?)/);
    if (!match) return 0;
    const val = Number(match[1]);
    if (!Number.isFinite(val) || val <= 0) return 0;
    return Math.floor(val);
  } catch {
    return 0;
  }
}

function chooseGpuBatchSize(gpuInfo, configuredBatch) {
  const kind = String(gpuInfo?.backendPreferred || gpuInfo?.type || '').toLowerCase();
  const memoryMb = parseGpuMemoryMb(gpuInfo);

  const getBatchBounds = () => {
    if (kind === 'cuda' || kind === 'nvidia') {
      return { min: 1024, max: 16384 };
    }
    if (kind === 'metal') {
      return { min: 2048, max: 65536 };
    }
    return { min: 1024, max: 8192 };
  };

  const bounds = getBatchBounds();
  const cfg = Number(configuredBatch);
  if (Number.isFinite(cfg) && cfg > 0) {
    return Math.max(bounds.min, Math.min(bounds.max, Math.floor(cfg)));
  }

  if (kind === 'cuda' || kind === 'nvidia') {
    if (memoryMb >= 20_000) return 16384;
    if (memoryMb >= 12_000) return 12288;
    if (memoryMb >= 8_000) return 8192;
    if (memoryMb >= 6_000) return 6144;
    return 4096;
  }

  if (kind === 'metal') {
    if (memoryMb >= 12_000) return 65536;
    if (memoryMb >= 8_000) return 32768;
    return 16384;
  }

  if (memoryMb >= 16_000) return 8192;
  if (memoryMb >= 8_000) return 6144;
  if (memoryMb >= 6_000) return 4096;
  return 2048;
}

// ============================================================================
// CH3 MULTI-STREAM: Dual/Triple Mining Support
// ZION (50% CPU) + Best GPU Coin (25% GPU, direct to external pool) +
// Revenue CPU (25% CPU → pool --group revenue → XMR/MoneroOcean)
//
// Pool REST API endpoint: GET :8080/api/v1/profit/status
//   → { profit_switching: { active_coin: "ETC" } }
// Profit poll every 60 s; auto-restarts GPU process on coin switch.
// ============================================================================

// Supported GPU coins for direct external-pool connection.
// Pool URL + algorithm + protocol for miner --external-coin flag.
// Pool priority (default: herominers):
//   HeroMiners (EU): ETC, KAS, ALPH, ERG, CFX, RVN, ZANO
//   ZPool (EU):      EVR (evrprogpow:1330), MEWC (meowpow:1327), EPIC (firopow:1326)
//   WoolyPooly:      FLUX (zelhash), CLORE (kawpow)
//   MoneroOcean:     XMR (auto algo)
//
// Override per-run via ZION_POOL_PREFERENCE env var:
//   nicehash  → NiceHash stratum (username = BTC addr, payout = BTC)
//   herominers (default) | zpool | default (2miners)
const GPU_COIN_POOLS = {
  // HeroMiners EU (default) — verified 02.2026
  ETC:  { pool: 'de.etc.herominers.com:1150',        algo: 'ethash',     protocol: 'ethstratum' },
  KAS:  { pool: 'de.kaspa.herominers.com:1206',      algo: 'kheavyhash', protocol: 'stratum'    },
  ALPH: { pool: 'de.alephium.herominers.com:1220',   algo: 'blake3',     protocol: 'stratum'    },
  ERG:  { pool: 'de.ergo.herominers.com:1180',       algo: 'autolykos',  protocol: 'ethstratum' },
  CFX:  { pool: 'de.conflux.herominers.com:1170',    algo: 'octopus',    protocol: 'ethstratum' },
  RVN:  { pool: 'de.ravencoin.herominers.com:1140',  algo: 'kawpow',     protocol: 'ethstratum' },
  ZANO: { pool: 'de.zano.herominers.com:1110',       algo: 'progpowz',   protocol: 'ethstratum' },
  // ZPool EU — ProgPow variants (not on HeroMiners)
  EVR:  { pool: 'evrprogpow.eu.mine.zpool.ca:1330',  algo: 'evrprogpow', protocol: 'ethstratum' },
  MEWC: { pool: 'meowpow.eu.mine.zpool.ca:1327',     algo: 'meowpow',    protocol: 'ethstratum' },
  EPIC: { pool: 'firopow.eu.mine.zpool.ca:1326',     algo: 'firopow',    protocol: 'ethstratum' },
  // Other pools
  FLUX: { pool: 'flux.woolypooly.com:3000',          algo: 'zelhash',    protocol: 'stratum'    },
  CLORE:{ pool: 'clore.woolypooly.com:3090',         algo: 'kawpow',     protocol: 'ethstratum' },
  XMR:  { pool: 'gulf.moneroocean.stream:10001',     algo: 'randomx',    protocol: 'stratum'    },
};

// NiceHash stratum URLs (payout always BTC — username = BTC address, password = x)
// Use when config.poolPreference === 'nicehash'
const NICEHASH_COIN_POOLS = {
  ETC:  { pool: 'etchash.eu.nicehash.com:9013',    algo: 'ethash',     protocol: 'ethstratum' },
  RVN:  { pool: 'kawpow.eu.nicehash.com:9017',     algo: 'kawpow',     protocol: 'ethstratum' },
  ERG:  { pool: 'autolykos.eu.nicehash.com:9018',  algo: 'autolykos',  protocol: 'ethstratum' },
  KAS:  { pool: 'kheavyhash.eu.nicehash.com:9024', algo: 'kheavyhash', protocol: 'stratum'    },
  CFX:  { pool: 'octopus.eu.nicehash.com:9020',    algo: 'octopus',    protocol: 'ethstratum' },
  // NA region variants (eu → usa in NiceHash format)
};

/**
 * Select the best pool info for a coin based on preference hierarchy.
 * Mirrors ExternalCoin::best_pool_url() from the Rust miner.
 *
 * preference: 'nicehash' | 'herominers' (default) | 'zpool' | 'default'
 * region: 'eu' | 'na' | 'hk'
 * nhBtcAddr: BTC address for NiceHash stratum (username)
 */
function getBestPoolInfo(coin, preference, region, nhBtcAddr) {
  const upperCoin = String(coin || '').toUpperCase();
  const pref = String(preference || 'herominers').toLowerCase();
  const reg = String(region || 'eu').toLowerCase();

  // NiceHash: swap to NA region if requested
  if (pref === 'nicehash' || pref === 'nh') {
    const nhRegion = (reg === 'na' || reg === 'us') ? 'usa' : 'eu';
    const nhBase = NICEHASH_COIN_POOLS[upperCoin];
    if (nhBase) {
      const poolWithRegion = nhBase.pool.replace('.eu.', `.${nhRegion}.`);
      return { ...nhBase, pool: poolWithRegion, wallet: nhBtcAddr || undefined };
    }
    // NiceHash doesn't support this coin — fall through to HeroMiners
  }

  if (pref === 'nicehash' || pref === 'nh' || pref === 'herominers' || pref === 'hm') {
    // HeroMiners region swap: eu→de, na→us, hk/sg/asia→hk
    const hmRegion = (reg === 'na' || reg === 'us') ? 'us' : (reg === 'hk' || reg === 'sg' || reg === 'asia') ? 'hk' : 'de';
    const hmPool = GPU_COIN_POOLS[upperCoin];
    if (hmPool && hmPool.pool.includes('.herominers.com')) {
      return { ...hmPool, pool: hmPool.pool.replace(/^de\./, `${hmRegion}.`) };
    }
  }

  // ZPool region swap: eu or na
  if (pref === 'zpool' || pref === 'nicehash' || pref === 'nh' || pref === 'herominers' || pref === 'hm') {
    const zpRegion = (reg === 'na' || reg === 'us') ? 'na' : 'eu';
    const zpPool = GPU_COIN_POOLS[upperCoin];
    if (zpPool && zpPool.pool.includes('.mine.zpool.ca')) {
      return { ...zpPool, pool: zpPool.pool.replace('.eu.', `.${zpRegion}.`) };
    }
  }

  // Default / fallback
  return GPU_COIN_POOLS[upperCoin] || GPU_COIN_POOLS.ETC;
}

/** Fetch current best coin from pool REST API (non-blocking). */
async function pollProfitStatus(poolHost, apiPort) {
  const http = require('http');
  const url = `http://${poolHost || '127.0.0.1'}:${apiPort || 8080}/api/v1/profit/status`;
  return new Promise((resolve) => {
    try {
      const req = http.get(url, { timeout: 4000 }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const activeCoin = String(
              data?.profit_switching?.active_coin ||
              data?.active_coin || ''
            ).toUpperCase().trim();
            resolve({ ok: true, activeCoin, raw: data });
          } catch {
            resolve({ ok: false, activeCoin: '' });
          }
        });
      });
      req.on('error', () => resolve({ ok: false, activeCoin: '' }));
      req.on('timeout', () => { try { req.destroy(); } catch {} resolve({ ok: false, activeCoin: '' }); });
    } catch {
      resolve({ ok: false, activeCoin: '' });
    }
  });
}

/**
 * Spawn a GPU revenue miner process connecting DIRECTLY to an external pool
 * using --external-coin <COIN> --gpu.
 * Used when config.gpuRevenueDirectPool === true or ZION_GPU_DIRECT_POOL=1.
 */
function spawnGpuRevenueDirect(coin, config, spawnCmd, minerCwd, envVars) {
  const upperCoin = String(coin || 'ETC').toUpperCase();

  // CHv3: use pool preference hierarchy (NiceHash → HeroMiners → ZPool → default)
  const pref = String(
    process.env.ZION_POOL_PREFERENCE ||
    config?.revenue?.gpu?.poolPreference ||
    config?.poolPreference ||
    'herominers'
  ).toLowerCase();
  const region = String(
    process.env.ZION_POOL_REGION ||
    config?.revenue?.gpu?.poolRegion ||
    config?.poolRegion ||
    'eu'
  ).toLowerCase();
  const nhBtcAddr = String(
    process.env.ZION_NH_BTC_ADDR ||
    config?.revenue?.gpu?.nicehashBtcAddr ||
    config?.nicehashBtcAddr ||
    ''
  ).trim() || null;

  const poolInfo = getBestPoolInfo(upperCoin, pref, region, nhBtcAddr);
  const gpuRevenueStatsPath = (STATS_PATH || 'data/stats.json').replace(/\.json$/, '_gpu_revenue.json');

  // NiceHash: username = BTC address; otherwise use configured revenueWallet
  const revenueWallet = String(
    (pref === 'nicehash' && nhBtcAddr) ? nhBtcAddr :
    (poolInfo.wallet) ? poolInfo.wallet :
    config?.revenueWallet ||
    process.env.ZION_REVENUE_WALLET ||
    'bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw'
  ).trim();

  const args = [
    '--external-coin', upperCoin.toLowerCase(),
    '--external-pool',   poolInfo.pool,
    '--external-wallet', revenueWallet,
    '--gpu',
    '--threads', '1',
    '--group', 'revenue',
    '--stats-file', gpuRevenueStatsPath,
    '--stats-interval', String(STATS_INTERVAL_SEC || 10),
    '--no-color',
  ];
  if (config?.worker) args.push('--worker', `${String(config.worker)}_gpu`);

  dbg('[CH3-MULTI] spawnGpuRevenueDirect', upperCoin, poolInfo.pool, args);
  logApp('multi-stream-direct-spawn', JSON.stringify({ coin: upperCoin, pool: poolInfo.pool, args }));
  return spawn(spawnCmd, args, { cwd: minerCwd, env: envVars });
}

/**
 * Wire up event handlers on a GPU revenue direct process.
 * Updates gpuRevenueHealth, auto-disables on repeated rejects.
 */
function wireGpuRevenueDirectProcess(proc, label) {
  if (!proc) return;
  const maybeDisable = (reason) => {
    try {
      if (!proc || gpuRevenueHealth.disabled || gpuRevenueHealth.accepted > 0) return;
      if (gpuRevenueHealth.rejected < 8) return;
      if (Date.now() - gpuRevenueHealth.startedAt > 180000) return;
      gpuRevenueHealth.disabled = true;
      logApp(`${label}-auto-disabled`, JSON.stringify({ reason, ...gpuRevenueHealth }));
      try { proc.kill(process.platform === 'win32' ? undefined : 'SIGTERM'); } catch {}
    } catch {}
  };
  proc.stdout?.on('data', (d) => {
    const o = d.toString();
    if (/\baccepted\b/i.test(o)) gpuRevenueHealth.accepted += 1;
    if (/\brejected\b/i.test(o)) gpuRevenueHealth.rejected += 1;
    maybeDisable('stdout');
    try { appendToFileBuffered(LOG_PATH, `[${label}-STDOUT] ${o}`); } catch {}
  });
  proc.stderr?.on('data', (d) => {
    const o = d.toString();
    if (/\baccepted\b/i.test(o)) gpuRevenueHealth.accepted += 1;
    if (/\brejected\b/i.test(o)) gpuRevenueHealth.rejected += 1;
    maybeDisable('stderr');
    try { appendToFileBuffered(LOG_PATH, `[${label}-STDERR] ${o}`); } catch {}
  });
  proc.on('error', (err) => {
    logApp(`${label}-error`, err?.message || String(err));
    gpuRevenueProcess = null;
    multiStreamStatus.gpuCoin.running = false;
    sendToRenderer('multi-stream-status', buildMultiStreamPayload());
  });
  proc.on('close', (code, signal) => {
    dbg(`${label} exited (code=${code} signal=${signal})`);
    logApp(`${label}-exit`, JSON.stringify({ code, signal }));
    gpuRevenueProcess = null;
    gpuRevenueHealth = { startedAt: 0, accepted: 0, rejected: 0, disabled: false };
    multiStreamStatus.gpuCoin.running = false;
    sendToRenderer('multi-stream-status', buildMultiStreamPayload());
    if (minerProcess && !minerStopping && !minerUserStopRequested && code !== 0) {
      try {
        sendToRenderer('miner-output', {
          stream: 'stderr',
          text: `[CH3-GPU] GPU revenue (direct) exited (code=${code}). Direct pool revenue paused.\n`
        });
      } catch {}
    }
  });
}

/** Build the complete multi-stream payload for IPC/events. */
function buildMultiStreamPayload() {
  const poolInfo = GPU_COIN_POOLS[multiStreamCurrentCoin] || GPU_COIN_POOLS.ETC;
  return {
    active: !!(minerProcess || revenueProcess || gpuRevenueProcess),
    zion: {
      running: !!minerProcess,
      hashrate: typeof minerStats?.hashrate === 'number' ? minerStats.hashrate : 0,
      algorithm: 'cosmic_harmony',  // CHv4 canonical
    },
    gpuCoin: {
      name: multiStreamCurrentCoin,
      running: !!gpuRevenueProcess,
      pool: poolInfo?.pool || '',
      algorithm: poolInfo?.algo || '',
      directPool: multiStreamStatus.gpuCoin.directPool,
      hashrate: revenueHashrateGpu,
    },
    revenueCpu: {
      running: !!revenueProcess,
      hashrate: revenueHashrateCpu,
      algorithm: 'randomx',
    },
    lastPollAt: multiStreamStatus.lastPollAt,
    pollSource: multiStreamStatus.pollSource,
  };
}

/**
 * Start the profit-status polling loop.
 * Every 60 s: GET /api/v1/profit/status → get active_coin.
 * In direct-pool mode: if coin changed, kill old GPU process and restart.
 * Always: emit 'multi-stream-status' to renderer.
 */
function startProfitPoll(poolHost, apiPort, spawnCmd, minerCwd, config, envVars) {
  stopProfitPoll();

  const directPoolMode = (
    config?.gpuRevenueDirectPool === true ||
    String(process.env.ZION_GPU_DIRECT_POOL || '').trim() === '1'
  );

  const doPoll = async () => {
    if (!minerProcess) return; // mining stopped — nothing to do

    const result = await pollProfitStatus(poolHost, apiPort);
    multiStreamStatus.lastPollAt = Date.now();

    if (!result.ok || !result.activeCoin) {
      multiStreamStatus.pollSource = 'none';
      sendToRenderer('multi-stream-status', buildMultiStreamPayload());
      return;
    }

    multiStreamStatus.pollSource = 'pool-api';
    const newCoin = result.activeCoin;

    // Update UI regardless of whether we switch
    if (multiStreamCurrentCoin !== newCoin) {
      const oldCoin = multiStreamCurrentCoin;
      multiStreamCurrentCoin = newCoin;
      multiStreamStatus.gpuCoin.name = newCoin;

      try {
        sendToRenderer('miner-output', {
          stream: 'stdout',
          text: `[CH3-MULTI] Profit-switch signal: ${oldCoin} → ${newCoin} (pool API)\n`
        });
      } catch {}

      // In direct-pool mode: restart GPU revenue with new coin
      if (directPoolMode && gpuRevenueProcess && MINER_IS_RUST) {
        logApp('multi-stream-coin-switch', JSON.stringify({ from: oldCoin, to: newCoin, source: 'pool-api' }));
        try {
          gpuRevenueProcess.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
        } catch {}
        gpuRevenueProcess = null;

        // Small delay to let old process die
        setTimeout(() => {
          if (!minerProcess || minerStopping) return;
          try {
            gpuRevenueHealth = { startedAt: Date.now(), accepted: 0, rejected: 0, disabled: false };
            gpuRevenueProcess = spawnGpuRevenueDirect(newCoin, config, spawnCmd, minerCwd, envVars);
            wireGpuRevenueDirectProcess(gpuRevenueProcess, 'GPU-REV-DIRECT');
            sendToRenderer('miner-output', {
              stream: 'stdout',
              text: `[CH3-MULTI] GPU revenue restarted on ${newCoin} — pool: ${GPU_COIN_POOLS[newCoin]?.pool || '?'}\n`
            });
          } catch (err) {
            logApp('multi-stream-restart-failed', err?.message || String(err));
          }
          sendToRenderer('multi-stream-status', buildMultiStreamPayload());
        }, 2500);
        return; // payload will be sent by the setTimeout callback
      }
    }

    sendToRenderer('multi-stream-status', buildMultiStreamPayload());
  };

  // First poll after 4 s (give miners time to initialize), then every 60 s
  setTimeout(doPoll, 4000);
  profitPollTimer = setInterval(doPoll, 60000);
  dbg('[CH3-MULTI] Profit poll started (pool:', poolHost + ':' + apiPort + ')');
}

/** Stop the profit-status polling loop. */
function stopProfitPoll() {
  if (profitPollTimer) {
    clearInterval(profitPollTimer);
    profitPollTimer = null;
  }
  multiStreamStatus.pollSource = 'none';
}

// ── End CH3 Multi-Stream helpers ──────────────────────────────────────────
// PRIMARY-HOST TESTNET MONITORING
// ============================================================================

const TESTNET_SERVERS = [
  { id: 'zion2', name: 'Zion2', host: PRIMARY_TESTNET_HOST, flag: 'CZ', location: 'Primary TestNet' }
];

async function checkServerPort(host, port, timeout = 3000) {
  const net = require('net');
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on('connect', () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve({ online: true, latency, port });
    });
    socket.on('timeout', () => { socket.destroy(); resolve({ online: false, latency: -1, port }); });
    socket.on('error', () => { socket.destroy(); resolve({ online: false, latency: -1, port }); });
    socket.connect(port, host);
  });
}

/**
 * Deep stratum health check — connects AND verifies the pool responds
 * to a mining.subscribe JSON-RPC message. Catches cases where TCP is open
 * but the stratum service is dead/broken.
 */
async function checkStratumHealth(host, port = 3333, timeout = 5000) {
  const net = require('net');
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let responded = false;
    let buf = '';

    const fail = () => {
      if (!responded) { responded = true; socket.destroy(); resolve({ online: false, latency: -1, port }); }
    };

    socket.setTimeout(timeout);
    socket.on('timeout', fail);
    socket.on('error', fail);
    socket.on('close', fail);

    socket.on('connect', () => {
      // Send stratum subscribe
      try {
        socket.write('{"id":1,"method":"mining.subscribe","params":["zion-agent/2.9.6"]}\n');
      } catch { fail(); return; }
    });

    socket.on('data', (chunk) => {
      buf += chunk.toString();
      // Look for a valid JSON line (stratum uses newline-delimited JSON)
      const lines = buf.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          // Any valid JSON response from stratum = pool is alive
          if (msg && (msg.id !== undefined || msg.method)) {
            if (!responded) {
              responded = true;
              const latency = Date.now() - start;
              socket.destroy();
              resolve({ online: true, latency, port });
            }
            return;
          }
        } catch {
          // not valid JSON yet, keep buffering
        }
      }
    });

    socket.connect(port, host);
  });
}

async function getAllServersStatus() {
  const results = await Promise.all(
    TESTNET_SERVERS.map(async (server) => {
      const [poolStatus, rpcStatus] = await Promise.all([
        checkStratumHealth(server.host, 3333),  // deep stratum check, not just TCP
        checkServerPort(server.host, 8444)
      ]);
      return {
        ...server,
        pool: poolStatus,
        rpc: rpcStatus,
        online: poolStatus.online || rpcStatus.online
      };
    })
  );
  return results;
}

/**
 * Auto-select the best pool by latency.
 * Called on first launch or when current pool is unreachable.
 * Only updates config if the user hasn't explicitly chosen a custom pool.
 */
async function autoSelectBestPool() {
  try {
    const servers = await getAllServersStatus();
    const onlinePools = servers
      .filter(s => s.pool.online)
      .sort((a, b) => a.pool.latency - b.pool.latency);

    if (onlinePools.length === 0) {
      dbg('[auto-select] No online pools found, keeping current config');
      return null;
    }

    const best = onlinePools[0];
    dbg(`[auto-select] Best pool: ${best.name} (${best.host}) — latency ${best.pool.latency}ms`);

    const config = loadConfig();
    // Only auto-switch if current pool is a known testnet server (not custom)
    const knownHosts = TESTNET_SERVERS.map(s => s.host);
    if (!knownHosts.includes(config.pool?.host) && config.pool?.host) {
      dbg(`[auto-select] User has custom pool ${config.pool.host}, skipping auto-select`);
      return best;
    }

    if (config.pool?.host !== best.host) {
      config.pool = { host: best.host, port: 3333 };
      config.rpcUrl = `http://${best.host}:8444/jsonrpc`;
      saveConfig(config);
      dbg(`[auto-select] Config updated to ${best.host}`);
    }
    return best;
  } catch (err) {
    console.error('[auto-select] Error:', err.message);
    return null;
  }
}

function migrateLegacyUserDataIfNeeded() {
  // Legacy bug created nested userData under: <userData>\cache\<appFolderName>\...
  const legacyRoot = path.join(USER_DATA_PATH, 'cache', path.basename(USER_DATA_PATH));
  const legacyConfig = path.join(legacyRoot, 'miner_config.json');
  const legacyLog = path.join(legacyRoot, 'miner.log');
  const legacyWallets = path.join(legacyRoot, 'wallets');

  try {
    if (!fs.existsSync(CONFIG_PATH) && fs.existsSync(legacyConfig)) {
      fs.copyFileSync(legacyConfig, CONFIG_PATH);
      dbg('Migrated legacy config to:', CONFIG_PATH);
    }

    if (!fs.existsSync(LOG_PATH) && fs.existsSync(legacyLog)) {
      fs.copyFileSync(legacyLog, LOG_PATH);
      dbg('Migrated legacy log to:', LOG_PATH);
    }

    if (!fs.existsSync(WALLETS_PATH) && fs.existsSync(legacyWallets)) {
      fs.mkdirSync(WALLETS_PATH, { recursive: true });
      for (const file of fs.readdirSync(legacyWallets)) {
        const from = path.join(legacyWallets, file);
        const to = path.join(WALLETS_PATH, file);
        if (!fs.existsSync(to)) {
          fs.copyFileSync(from, to);
        }
      }
      dbg('Migrated legacy wallets to:', WALLETS_PATH);
    }
  } catch (err) {
    console.warn('Legacy data migration failed:', err);
  }
}

// Create main window
function createWindow() {
  const config = loadConfig();
  let didFallbackToFileUi = false;

  try {
    logApp(
      'createWindow',
      JSON.stringify({
        nodeEnv: process.env.NODE_ENV || '',
        isPackaged: !!IS_PACKAGED,
        appRoot: APP_ROOT,
        cwd: process.cwd(),
        minimizeToTray: !!config.minimizeToTray,
        autoStart: !!config.autoStart,
        aiAfterburner: config.aiAfterburner !== false,
        aiNative: config.aiNative === true
      })
    );
  } catch {
    // ignore
  }

  // Window icon is meaningful on Windows/Linux; macOS uses the app bundle icon.
  const windowIconPath = resolveResourcePath('assets', 'icon.png');
  const windowIcon = (process.platform === 'win32' || process.platform === 'linux') ? windowIconPath : undefined;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'ZION Native Awakening v2.9.6',
    backgroundColor: '#000000',
    ...(windowIcon ? { icon: windowIcon } : {}),
    show: true, // Always show window on manual start; startMinimized only applies to auto-start
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true, // AUDIT-FIX E-05 (16 Feb 2026): enable sandbox for renderer
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // AUDIT-FIX E-05 (16 Feb 2026): prevent navigation to arbitrary URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsed = new URL(url);
    // Allow file:// loads (our own UI) and localhost dev server
    if (parsed.protocol === 'file:') return;
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return;
    logApp('navigation-blocked', JSON.stringify({ url }));
    event.preventDefault();
  });

  // AUDIT-FIX E-05: deny all window.open / target=_blank
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    logApp('window-open-blocked', JSON.stringify({ url }));
    return { action: 'deny' };
  });

  // Load UI
  const uiDevUrlRaw = process.env.ZION_UI_DEV_URL;
  const uiDevUrl = typeof uiDevUrlRaw === 'string' ? uiDevUrlRaw.trim() : '';
  const uiFilePath = path.join(__dirname, 'ui', 'index.html');

  if (uiDevUrl) {
    try {
      logApp('ui-load', JSON.stringify({ mode: 'dev-url', url: uiDevUrl }));
    } catch {
      // ignore
    }
    mainWindow.loadURL(uiDevUrl);
    // DevTools are helpful when explicitly using a dev URL
    try {
      mainWindow.webContents.openDevTools();
    } catch {
      // ignore
    }
  } else {
    try {
      logApp('ui-load', JSON.stringify({ mode: 'file', file: uiFilePath, nodeEnv: process.env.NODE_ENV || '' }));
    } catch {
      // ignore
    }
    mainWindow.loadFile(uiFilePath);
  }

  // WebContents lifecycle markers
  try {
    mainWindow.webContents.on('dom-ready', () => {
      logApp('webcontents-dom-ready');
    });
    mainWindow.webContents.on('did-finish-load', () => {
      logApp('webcontents-did-finish-load');
    });
    mainWindow.webContents.on('did-start-loading', () => {
      logApp('webcontents-did-start-loading');
    });
    mainWindow.webContents.on('did-stop-loading', () => {
      logApp('webcontents-did-stop-loading');
    });
    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      // Keep this compact; renderer console spam can be huge.
      const msg = String(message || '');
      const compact = msg.length > 500 ? msg.slice(0, 500) + '…' : msg;
      logApp('renderer-console', JSON.stringify({ level, message: compact, line, sourceId }));
    });
  } catch {
    // ignore
  }

  try {
    mainWindow.on('ready-to-show', () => logApp('window-ready-to-show'));
    mainWindow.on('unresponsive', () => logApp('window-unresponsive'));
    mainWindow.on('responsive', () => logApp('window-responsive'));
  } catch {
    // ignore
  }

  // Recover from renderer crashes / load failures instead of silently exiting.
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    // In dev, the React/Vite/Next server might not be running.
    // Don't brick the app: fall back to the packaged/static UI.
    try {
      if (
        !didFallbackToFileUi &&
        isMainFrame === true &&
        String(errorDescription || '').toUpperCase().includes('ERR_CONNECTION_REFUSED') &&
        typeof validatedURL === 'string' &&
        validatedURL
      ) {
        // Only fall back when a dev URL was attempted.
        const attemptedDev = (uiDevUrl && validatedURL.startsWith(uiDevUrl)) || validatedURL.startsWith('http://localhost:3000');
        if (!attemptedDev) {
          // Not our UI main frame; handle normally.
        } else {
          didFallbackToFileUi = true;
          logApp('ui-dev-connection-refused', JSON.stringify({ errorCode, errorDescription, validatedURL }));
          mainWindow.loadFile(uiFilePath);
          return;
        }
      }
    } catch {
      // ignore
    }

    logApp('did-fail-load', `${errorCode} ${errorDescription}`);
    console.error('LOAD FAILED:', errorCode, errorDescription);
    dialog.showErrorBox('Load Failed', `Failed to load UI: ${errorDescription}`);
  });

  mainWindow.webContents.on('crashed', (event, killed) => {
    logApp('crashed', `killed=${killed}`);
    console.error('RENDERER CRASHED!', { killed });
    dialog.showErrorBox('Renderer Crashed', 'The renderer process crashed. Check logs.');
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logApp('render-process-gone', `${details?.reason || 'unknown'} ${details?.exitCode ?? ''}`);
    // Recreate the window after a short delay.
    setTimeout(() => {
      try {
        if (!mainWindow) createWindow();
        else mainWindow.reload();
      } catch (err) {
        logApp('renderer-recover-failed', err?.message || String(err));
      }
    }, 500);
  });

  // Window events
  mainWindow.on('close', (event) => {
    if (config.minimizeToTray && !app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Auto-start mining if configured
  if (config.autoStart && config.wallet) {
    setTimeout(() => startMining(config), 3000);
  }

  // Default ON: start Afterburner service on app launch (independent of miner).
  if (config.aiAfterburner !== false) {
    void ensureAfterburnerServiceRunning()
      .then(() => afterburnerSend({ cmd: 'start' }))
      .catch(() => {
        // best-effort; avoid noisy dialogs on launch
      });
  }

  // AI Native service (OFF by default, user must enable in settings)
  if (config.aiNative === true) {
    const aiNativeServerUrl = config.aiNativePoolUrl || DEFAULT_AI_NATIVE_POOL_URL;
    void ensureAiNativeServiceRunning()
      .then(() => aiNativeSend({ 
        cmd: 'start',
        server_url: aiNativeServerUrl,
        config: {
          wallet: config.wallet,
          server_url: aiNativeServerUrl,
          pool_url: aiNativeServerUrl,
          consciousness_level: config.aiNativeConsciousness || 1,
          gpu: config.gpu || false,
          threads: config.threads || 4
        }
      }))
      .catch((err) => {
        console.error('AI Native startup failed:', err);
      });
  }
}

// Create system tray
function createTray() {
  // Use nativeImage for better compatibility
  const { nativeImage } = require('electron');
  
  // Prefer a dedicated tray icon; fall back to app icon.
  const trayIconCandidates = [
    resolveResourcePath('assets', 'tray-icon.png'),
    resolveResourcePath('tray-icon.png'),
    resolveResourcePath('assets', 'icon.png'),
    resolveResourcePath('icon.png')
  ];

  let trayIcon = nativeImage.createEmpty();
  for (const p of trayIconCandidates) {
    try {
      const img = nativeImage.createFromPath(p);
      if (img && !img.isEmpty()) {
        trayIcon = img;
        break;
      }
    } catch {
      // ignore
    }
  }

  // macOS menubar: template images render correctly on light/dark mode.
  if (process.platform === 'darwin' && trayIcon && !trayIcon.isEmpty()) {
    try {
      trayIcon.setTemplateImage(true);
    } catch {
      // ignore
    }
  }
  
  tray = new Tray(trayIcon);
  
  trayMenu = Menu.buildFromTemplate([
    {
      label: 'ZION Miner v2.9.6',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Hashrate: 0 kH/s',
      id: 'hashrate',
      enabled: false
    },
    {
      label: 'Status: Stopped',
      id: 'status',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Start Mining',
      id: 'start',
      click: () => {
        const config = loadConfig();
        if (config.wallet) {
          startMining(config);
        } else {
          showWindow();
          dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'Wallet Required',
            message: 'Please configure your ZION wallet address first.'
          });
        }
      }
    },
    {
      label: 'Stop Mining',
      id: 'stop',
      enabled: false,
      click: stopMining
    },
    { type: 'separator' },
    {
      label: 'Show Window',
      click: showWindow
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        stopMining();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(trayMenu);
  tray.setToolTip('ZION Miner v2.9.6');
  
  tray.on('click', () => {
    showWindow();
  });
}

function showWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
}

function updateTrayMenu(stats) {
  if (!tray || !trayMenu) return;
  const isRunning = minerProcess !== null;

  const hashrateHs = typeof stats.hashrate === 'number' ? stats.hashrate : 0;
  let trayValue = hashrateHs;
  let trayUnit = 'H/s';
  if (trayValue >= 1e9) {
    trayValue /= 1e9;
    trayUnit = 'GH/s';
  } else if (trayValue >= 1e6) {
    trayValue /= 1e6;
    trayUnit = 'MH/s';
  } else if (trayValue >= 1e3) {
    trayValue /= 1e3;
    trayUnit = 'kH/s';
  }
  trayMenu.getMenuItemById('hashrate').label = `Hashrate: ${trayValue.toFixed(2)} ${trayUnit}`;
  trayMenu.getMenuItemById('status').label = `Status: ${isRunning ? 'Mining' : 'Stopped'}`;
  trayMenu.getMenuItemById('start').enabled = !isRunning;
  trayMenu.getMenuItemById('stop').enabled = isRunning;

  tray.setContextMenu(trayMenu);
}

// Mining process management
function startMining(config) {
  // New start resets any previous stop intent.
  minerUserStopRequested = false;

  // Idempotent guard: renderer auto-start, one-click onboarding, and app-level
  // autoStart can overlap. If a miner process is already alive, do not spawn a
  // second canonical session.
  if (minerProcess && !minerStopping) {
    try {
      sendToRenderer('miner-output', {
        stream: 'stdout',
        text: '[INFO] Duplicate start request ignored: miner session is already active.\n'
      });
    } catch {
      // ignore
    }
    return { success: true, alreadyRunning: true };
  }

  // Cancel any pending timers from a previous run.
  if (poolFailoverTimer) { clearTimeout(poolFailoverTimer); poolFailoverTimer = null; }
  if (poolHealthTimer) { clearInterval(poolHealthTimer); poolHealthTimer = null; }
  try {
    if (minerFallbackTimer) clearTimeout(minerFallbackTimer);
  } catch {
    // ignore
  }
  minerFallbackTimer = null;
  try {
    if (minerStartAckTimer) clearTimeout(minerStartAckTimer);
  } catch {
    // ignore
  }
  minerStartAckTimer = null;
  try {
    if (minerGpuInitWatchdogTimer) clearTimeout(minerGpuInitWatchdogTimer);
  } catch {
    // ignore
  }
  minerGpuInitWatchdogTimer = null;
  gpuRevenueHealth = { startedAt: 0, accepted: 0, rejected: 0, disabled: false };

  function safeMinerLogWrite(text) {
    try {
      maybeRotateFileThrottled(
        LOG_PATH,
        MAX_MINER_LOG_BYTES,
        MAX_MINER_LOG_BACKUPS,
        MAX_MINER_LOG_AGE_MS,
        5000
      );
      appendToFileBuffered(LOG_PATH, text, {
        flushDelayMs: 120,
        maxBufferedChars: 512 * 1024
      });
    } catch {
      // ignore
    }
  }

  // ── Legacy CHv4.2 Merkabah GPU fast-path (diagnostics only) ───────────────
  // v2.9.8 canonical desktop mining uses the unified Deeksha path.
  // Keep the old branch available only behind an explicit double opt-in.
  const legacyChv42Enabled =
    String(process.env.ZION_ENABLE_LEGACY_CHV42 || '').trim() === '1' &&
    String(process.env.ZION_FORCE_LEGACY_CHV42_PATH || '').trim() === '1';
  if (legacyChv42Enabled && String(config?.algorithm || '').toLowerCase() === 'cosmic_harmony_v4_2') {
    const isPackaged = app.isPackaged;
    const gpuScriptPrimary = isPackaged
      ? path.join(process.resourcesPath, 'mining', 'cosmic_harmony_deeksha_gpu.py')
      : path.join(APP_ROOT, 'resources', 'mining', 'cosmic_harmony_deeksha_gpu.py');
    const gpuScriptLegacy = isPackaged
      ? path.join(process.resourcesPath, 'mining', 'cosmic_harmony_v42_gpu.py')
      : path.join(APP_ROOT, 'resources', 'mining', 'cosmic_harmony_v42_gpu.py');
    const gpuScript = fs.existsSync(gpuScriptPrimary) ? gpuScriptPrimary : gpuScriptLegacy;

    // Stejná venv resoluce jako pro ostatní Python minery
    const _venvCandidates = process.platform === 'win32'
      ? [path.join(APP_ROOT, '.venv', 'Scripts', 'python.exe'),
         path.join(APP_ROOT, '..', '.venv', 'Scripts', 'python.exe'),
         path.join(APP_ROOT, '..', '..', '.venv', 'Scripts', 'python.exe')]
      : [path.join(APP_ROOT, '.venv', 'bin', 'python3'),
         path.join(APP_ROOT, '..', '.venv', 'bin', 'python3'),
         path.join(APP_ROOT, '..', '..', '.venv', 'bin', 'python3')];
    const _envVenv = String(process.env.VIRTUAL_ENV || '').trim();
    if (_envVenv) {
      _venvCandidates.unshift(process.platform === 'win32'
        ? path.join(_envVenv, 'Scripts', 'python.exe')
        : path.join(_envVenv, 'bin', 'python3'));
    }
    const _resolvedPy = _venvCandidates.find(c => { try { return !!c && fs.existsSync(c); } catch { return false; } });
    const pyExe = _resolvedPy || (process.platform === 'win32' ? 'python' : 'python3');

    const pool = `${config.pool?.host || PRIMARY_TESTNET_HOST}:${config.pool?.port || PRIMARY_POOL_PORT}`;
    const wallet = config.wallet || '';
    const worker = config.worker || 'desktop-agent';
    logApp('chv42-main-start', JSON.stringify({ pyExe, gpuScript, pool, worker }));
    sendToRenderer('miner-output', { stream: 'stdout', text: `[CHv4.2] Spouštím Merkabah GPU miner...\n[CHv4.2] Python: ${pyExe}\n[CHv4.2] Pool: ${pool} | Worker: ${worker}\n` });
    const myStartToken = ++minerStartToken;
    let spawnedMiner = null;
    try {
      spawnedMiner = spawn(pyExe, [gpuScript, '--pool', pool, '--wallet', wallet, '--worker', worker, '--backend', 'auto'], {
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });
      minerProcess = spawnedMiner;
    } catch (e) {
      const msg = `[CHv4.2] Failed to spawn GPU miner: ${e}\n`;
      sendToRenderer('miner-output', { stream: 'stderr', text: msg });
      return { success: false, error: String(e) };
    }
    sendToRenderer('miner-backend', { preferred: 'python', resolved: 'chv42-gpu', path: pyExe, lastError: '' });
    spawnedMiner.stdout.on('data', (d) => sendToRenderer('miner-output', { stream: 'stdout', text: d.toString() }));
    spawnedMiner.stderr.on('data', (d) => sendToRenderer('miner-output', { stream: 'stderr', text: d.toString() }));
    spawnedMiner.on('exit', (code) => {
      logApp('chv42-main-exit', JSON.stringify({ code }));
      if (minerProcess !== spawnedMiner) return;
      minerProcess = null;
      minerStopping = false;
      sendToRenderer('miner-stopped', { code });
      updateTrayMenu(minerStats);
    });
    setTimeout(() => {
      if (minerUserStopRequested || minerStopping) return;
      if (!minerProcess || minerProcess !== spawnedMiner) return;
      if (myStartToken !== minerStartToken) return;
      sendToRenderer('miner-started', {});
      updateTrayMenu(minerStats);
    }, 450);

    // ── CHv4.2 Revenue system parity with CH3 ─────────────────────────────────
    // Aktivuje stejnou revenue logiku jako CH3: CPU revenue stream + (volitelně)
    // GPU revenue stream přes Rust miner s --group revenue.
    const effectiveThreads = computeEffectiveThreads(config);
    const revenueProfile = normalizeRevenueProfile(config?.revenue || {});
    const pureZionMode = isPureZionDesktopMode(config);
    const miningMode = String(config.miningMode || (config.gpu ? 'dual' : 'cpu')).toLowerCase();
    const wantsGpu = miningMode === 'gpu' || miningMode === 'dual' || miningMode === 'gpu-revenue';
    const algoForGpu = normalizeAlgorithmName(config.algorithm || '');
    const gpuAllowed = algoSupportsGpu(algoForGpu);
    const effectiveGpu = wantsGpu && gpuAllowed;
    const mainMinerGpu = effectiveGpu && miningMode !== 'gpu-revenue';

    const envDisableRevenue = String(process.env.ZION_DISABLE_REVENUE || '').trim() === '1';
    const envEnableRevenue = String(process.env.ZION_ENABLE_REVENUE || '').trim() === '1';
    const revenueEnabled = pureZionMode
      ? false
      : (envDisableRevenue ? false : (envEnableRevenue ? true : revenueProfile.enabled !== false));

    let xmrRevenueThreads = 0;
    if (revenueEnabled && effectiveThreads >= 3) {
      const multiPct = Math.max(0, Math.min(100, Number(revenueProfile?.allocation?.multiAlgoPct ?? 25)));
      const nclPct = Math.max(0, Math.min(100, Number(revenueProfile?.allocation?.nclPct ?? 25)));
      const nclEnabled = revenueProfile?.nclEnabled !== false;

      const suggestedMulti = Math.max(1, Math.round(effectiveThreads * (multiPct / 100)));
      const suggestedNcl = nclEnabled ? Math.max(1, Math.round(effectiveThreads * (nclPct / 100))) : 0;
      const maxRevenue = Math.max(0, effectiveThreads - 2);
      const totalRevenue = Math.min(maxRevenue, suggestedMulti + suggestedNcl);
      if (totalRevenue > 0 && suggestedMulti + suggestedNcl > 0) {
        const ratio = totalRevenue / (suggestedMulti + suggestedNcl);
        xmrRevenueThreads = Math.max(1, Math.round(suggestedMulti * ratio));
      }
    }

    const allowRevenueWithMainGpu = String(process.env.ZION_ALLOW_REVENUE_WITH_MAIN_GPU || '1').trim() !== '0';
    const revenueSuppressedForGpuInit = mainMinerGpu && !allowRevenueWithMainGpu;
    const chv42SessionNonceBaseMain = (Date.now() >>> 0) & 0x1fffffff;
    const chv42SessionNonceBaseRevenue = chv42SessionNonceBaseMain + 0x40000000;
    const chv42SessionNonceBaseGpuRevenue = chv42SessionNonceBaseMain + 0x80000000;
    const revenueEnv = { ...process.env, ZION_NONCE_BASE: String(chv42SessionNonceBaseRevenue) };
    const gpuRevenueEnv = { ...process.env, ZION_NONCE_BASE: String(chv42SessionNonceBaseGpuRevenue) };

    if (revenueSuppressedForGpuInit && xmrRevenueThreads > 0) {
      try {
        sendToRenderer('miner-output', {
          stream: 'stdout',
          text: '[CH4-REV] Revenue CPU process skipped while main GPU mining is active (stability guard). Set ZION_ALLOW_REVENUE_WITH_MAIN_GPU=1 to override.\n'
        });
      } catch {
        // ignore
      }
    }

    if (!revenueSuppressedForGpuInit && xmrRevenueThreads > 0) {
      try {
        const revenueStatsPath = STATS_PATH.replace(/\.json$/, '_chv42_revenue.json');
        const revMinerPath = findPythonMiner() || MINER_PATH;
        const revArgs = [
          revMinerPath,
          '--algorithm', 'cosmic_harmony',
          '--mode', 'cpu',
          '--pool', pool,
          '--wallet', wallet,
          '--threads', String(xmrRevenueThreads),
          '--group', 'revenue',
          '--stats-file', revenueStatsPath,
          '--stats-interval', String(STATS_INTERVAL_SEC || 30),
        ];
        if (worker) revArgs.push('--worker', `${worker}_rev`);
        revenueProcess = spawn(pyExe, revArgs, {
          env: revenueEnv,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });
        logApp('chv42-revenue-started', JSON.stringify({ pid: revenueProcess?.pid, threads: xmrRevenueThreads, pool }));
        sendToRenderer('miner-output', {
          stream: 'stdout',
          text: `[CH4-REV] Revenue CPU miner started (PID ${revenueProcess?.pid}) — ${xmrRevenueThreads}T CPU -> ${pool} (g=revenue)\n`,
        });
        revenueProcess.stdout?.on('data', (d) => {
          const output = d.toString();
          safeMinerLogWrite(`[CH4-REV-STDOUT] ${output}`);
          try { sendToRenderer('miner-output', { stream: 'stdout', text: `[CH4-REV] ${output}` }); } catch {}
        });
        revenueProcess.stderr?.on('data', (d) => {
          const output = d.toString();
          safeMinerLogWrite(`[CH4-REV-STDERR] ${output}`);
          try { sendToRenderer('miner-output', { stream: 'stderr', text: `[CH4-REV] ${output}` }); } catch {}
        });
        revenueProcess.on('error', (err) => {
          logApp('chv42-revenue-error', err?.message || String(err));
          revenueProcess = null;
        });
        revenueProcess.on('close', (code) => {
          revenueProcess = null;
          if (minerProcess && code !== 0) {
            try { sendToRenderer('miner-output', { stream: 'stderr', text: `[CH4-REV] Revenue process exited (code=${code}).\n` }); } catch {}
          }
        });
      } catch (revErr) {
        logApp('chv42-revenue-spawn-failed', revErr?.message || String(revErr));
        revenueProcess = null;
      }
    }

    // GPU revenue stream (CH3 parity): používá Rust miner s --group revenue + --gpu.
    try {
      const rustSelection = resolveMinerSelection('rust');
      const rustRevenuePath = rustSelection?.isRust ? rustSelection.path : '';
      const rustGroupSupported = rustRevenuePath ? rustMinerSupportsGroupFlag(rustRevenuePath) : false;
      const gpuRevenueEnabled = !pureZionMode && !!(revenueProfile?.gpu?.enabled || config.gpuRevenue);
      const gpuRevenueAllowed = gpuRevenueEnabled && effectiveGpu && !mainMinerGpu;

      if (gpuRevenueEnabled && mainMinerGpu) {
        try {
          sendToRenderer('miner-output', {
            stream: 'stdout',
            text: '[CH4-GPU] GPU dedicated to main CHv4 miner — GPU Revenue skipped (prevents dual-GPU contention).\n'
          });
        } catch {
          // ignore
        }
      }

      if (rustRevenuePath && gpuRevenueAllowed && rustGroupSupported) {
        const gpuRevenueStatsPath = STATS_PATH.replace(/\.json$/, '_chv42_gpu_revenue.json');
        const gpuRevenueArgs = [
          '--pool', `stratum+tcp://${config.pool.host}:${config.pool.port}`,
          '--wallet', config.wallet,
          '--threads', '1',
          '--group', 'revenue',
          '--gpu',
          '--stats-file', gpuRevenueStatsPath,
          '--stats-interval', String(STATS_INTERVAL_SEC || 30),
          '--no-color'
        ];
        if (config.worker) gpuRevenueArgs.push('--worker', `${String(config.worker)}_gpu_rev`);

        gpuRevenueProcess = spawn(rustRevenuePath, gpuRevenueArgs, {
          cwd: minerCwd,
          env: gpuRevenueEnv,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });

        gpuRevenueHealth = { startedAt: Date.now(), accepted: 0, rejected: 0, disabled: false };
        sendToRenderer('miner-output', {
          stream: 'stdout',
          text: `[CH4-GPU] GPU Revenue process started (PID ${gpuRevenueProcess?.pid}) — algo=pool-assigned g=revenue\n`
        });
        gpuRevenueProcess.stdout?.on('data', (data) => {
          const output = data.toString();
          if (/\baccepted\b/i.test(output)) gpuRevenueHealth.accepted += 1;
          if (/\brejected\b/i.test(output)) gpuRevenueHealth.rejected += 1;
          safeMinerLogWrite(`[CH4-GPU-REV-STDOUT] ${output}`);
        });
        gpuRevenueProcess.stderr?.on('data', (data) => {
          const output = data.toString();
          if (/\baccepted\b/i.test(output)) gpuRevenueHealth.accepted += 1;
          if (/\brejected\b/i.test(output)) gpuRevenueHealth.rejected += 1;
          safeMinerLogWrite(`[CH4-GPU-REV-STDERR] ${output}`);
        });
        gpuRevenueProcess.on('error', (err) => {
          gpuRevenueProcess = null;
          gpuRevenueHealth = { startedAt: 0, accepted: 0, rejected: 0, disabled: false };
          logApp('chv42-gpu-revenue-error', err?.message || String(err));
        });
        gpuRevenueProcess.on('close', (code) => {
          gpuRevenueProcess = null;
          gpuRevenueHealth = { startedAt: 0, accepted: 0, rejected: 0, disabled: false };
          if (minerProcess && code !== 0) {
            try { sendToRenderer('miner-output', { stream: 'stderr', text: `[CH4-GPU] GPU Revenue process exited (code=${code}).\n` }); } catch {}
          }
        });
      }
    } catch (gpuRevErr) {
      logApp('chv42-gpu-revenue-setup-failed', gpuRevErr?.message || String(gpuRevErr));
      gpuRevenueProcess = null;
    }
    // ─────────────────────────────────────────────────────────────────────────

    return { success: true };
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── CHvDeeksha Python fallback path (2.9.8) ───────────────────────────────
  // Rust miner is the primary path. Python Deeksha scripts are used ONLY when
  // the Rust binary is missing or the env override ZION_FORCE_DEEKSHA_PYTHON=1.
  const _deekshaAlgoName = normalizeAlgorithmName(config?.algorithm || '');
  const _deekshaPreferredBackend = String(config?.minerBackend || 'rust').toLowerCase();
  const _deekshaRustPath = findRustMiner();
  const _forceDeekshaPythonPath =
    !_deekshaRustPath ||
    String(process.env.ZION_FORCE_DEEKSHA_PYTHON || '').trim() === '1';
  if (_deekshaAlgoName === 'cosmic_harmony' && _forceDeekshaPythonPath) {
    const isPackaged = app.isPackaged;
    const deekshaCpuScript = isPackaged
      ? path.join(process.resourcesPath, 'mining', 'cosmic_harmony_deeksha_fallback.py')
      : path.join(APP_ROOT, 'resources', 'mining', 'cosmic_harmony_deeksha_fallback.py');
    const deekshaGpuScriptPrimary = isPackaged
      ? path.join(process.resourcesPath, 'mining', 'cosmic_harmony_deeksha_gpu.py')
      : path.join(APP_ROOT, 'resources', 'mining', 'cosmic_harmony_deeksha_gpu.py');
    const deekshaGpuScriptLegacy = isPackaged
      ? path.join(process.resourcesPath, 'mining', 'cosmic_harmony_v42_gpu.py')
      : path.join(APP_ROOT, 'resources', 'mining', 'cosmic_harmony_v42_gpu.py');
    const deekshaGpuScript = fs.existsSync(deekshaGpuScriptPrimary)
      ? deekshaGpuScriptPrimary
      : deekshaGpuScriptLegacy;

    // Venv resoluce — identická s CHv4.2
    const _dvenvCandidates = process.platform === 'win32'
      ? [path.join(APP_ROOT, '.venv', 'Scripts', 'python.exe'),
         path.join(APP_ROOT, '..', '.venv', 'Scripts', 'python.exe'),
         path.join(APP_ROOT, '..', '..', '.venv', 'Scripts', 'python.exe')]
      : [path.join(APP_ROOT, '.venv', 'bin', 'python3'),
         path.join(APP_ROOT, '..', '.venv', 'bin', 'python3'),
         path.join(APP_ROOT, '..', '..', '.venv', 'bin', 'python3')];
    const _denvVenv = String(process.env.VIRTUAL_ENV || '').trim();
    if (_denvVenv) {
      _dvenvCandidates.unshift(process.platform === 'win32'
        ? path.join(_denvVenv, 'Scripts', 'python.exe')
        : path.join(_denvVenv, 'bin', 'python3'));
    }
    const _dResolvedPy = _dvenvCandidates.find(c => { try { return !!c && fs.existsSync(c); } catch { return false; } });
    const pyExeDeeksha = _dResolvedPy || (process.platform === 'win32' ? 'python' : 'python3');

    const effectiveThreadsDeeksha = computeEffectiveThreads(config);
    const revenueProfileDeeksha = normalizeRevenueProfile(config?.revenue || {});
    const pureZionModeDeeksha = isPureZionDesktopMode(config);
    const miningModeDeeksha = String(config.miningMode || (config.gpu ? 'dual' : 'cpu')).toLowerCase();
    const wantsGpuDeeksha = miningModeDeeksha === 'gpu' || miningModeDeeksha === 'dual' || miningModeDeeksha === 'gpu-revenue';
    const gpuAllowedDeeksha = algoSupportsGpu(_deekshaAlgoName);
    const effectiveGpuDeeksha = wantsGpuDeeksha && gpuAllowedDeeksha;
    const mainMinerGpuDeeksha = effectiveGpuDeeksha && miningModeDeeksha !== 'gpu-revenue';
    const currentGpuInfoDeeksha = detectGPU();
    const deekshaGpuBatch = chooseGpuBatchSize(
      currentGpuInfoDeeksha,
      config?.gpuBatchSize || process.env.ZION_CHV3_GPU_BATCH || process.env.ZION_GPU_BATCH_SIZE
    );

    const envDisableRevenueDeeksha = String(process.env.ZION_DISABLE_REVENUE || '').trim() === '1';
    const envEnableRevenueDeeksha = String(process.env.ZION_ENABLE_REVENUE || '').trim() === '1';
    const revenueEnabledDeeksha = pureZionModeDeeksha
      ? false
      : (envDisableRevenueDeeksha ? false : (envEnableRevenueDeeksha ? true : revenueProfileDeeksha.enabled !== false));

    let deekshaRevenueThreads = 0;
    if (revenueEnabledDeeksha && effectiveThreadsDeeksha >= 3) {
      const multiPct = Math.max(0, Math.min(100, Number(revenueProfileDeeksha?.allocation?.multiAlgoPct ?? 25)));
      const maxRevenue = Math.max(0, effectiveThreadsDeeksha - 2);
      deekshaRevenueThreads = Math.min(maxRevenue, Math.max(1, Math.round(effectiveThreadsDeeksha * (multiPct / 100))));
    }
    const zionThreadsDeeksha = Math.max(1, effectiveThreadsDeeksha - deekshaRevenueThreads);

    // Nonce partition: hlavní miner 0x00..., revenue 0x40000000...
    const deekshaSessionNonceBaseMain = (Date.now() >>> 0) & 0x1fffffff;
    const deekshaSessionNonceBaseRevenue = deekshaSessionNonceBaseMain + 0x40000000;

    // ── Deeksha Python env — parity with Rust spawn path ──────────────
    const deekshaMiningDir = isPackaged
      ? path.join(process.resourcesPath, 'mining')
      : path.join(APP_ROOT, 'resources', 'mining');
    const deekshaNativeLibDirs = [
      path.join(deekshaMiningDir, 'native-libs'),
      deekshaMiningDir,
    ].filter(d => { try { return fs.existsSync(d); } catch { return false; } });
    const deekshaNativeLibPath = deekshaNativeLibDirs.join(path.delimiter);

    const deekshaBaseEnv = {
      ...process.env,
      // Python runtime hygiene
      PYTHONUNBUFFERED: '1',
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      PYTHONPATH: deekshaMiningDir + (process.env.PYTHONPATH ? path.delimiter + process.env.PYTHONPATH : ''),
      // HugePages — 64 KiB Ekam Deeksha scratchpad (mmap+mlock)
      ZION_HUGEPAGES: String(process.env.ZION_HUGEPAGES || '').trim() === '0' ? '0' : '1',
    };

    // Native library paths for ctypes FFI (libzion_cosmic_harmony_v3)
    if (deekshaNativeLibPath) {
      if (process.platform === 'darwin') {
        deekshaBaseEnv.DYLD_LIBRARY_PATH = deekshaNativeLibPath + (process.env.DYLD_LIBRARY_PATH ? path.delimiter + process.env.DYLD_LIBRARY_PATH : '');
        deekshaBaseEnv.DYLD_FALLBACK_LIBRARY_PATH = deekshaNativeLibPath;
      } else if (process.platform === 'linux') {
        deekshaBaseEnv.LD_LIBRARY_PATH = deekshaNativeLibPath + (process.env.LD_LIBRARY_PATH ? path.delimiter + process.env.LD_LIBRARY_PATH : '');
      }
    }

    // GPU backend auto-detect for Deeksha GPU path
    if (mainMinerGpuDeeksha && currentGpuInfoDeeksha?.backendPreferred) {
      deekshaBaseEnv.ZION_GPU_BACKEND = String(currentGpuInfoDeeksha.backendPreferred).toLowerCase();
    }
    if (mainMinerGpuDeeksha && deekshaGpuBatch) {
      deekshaBaseEnv.ZION_GPU_BATCH_SIZE = String(deekshaGpuBatch);
    }

    const deekshaMainEnv = { ...deekshaBaseEnv, ZION_NONCE_BASE: String(deekshaSessionNonceBaseMain) };
    const deekshaRevenueEnv = { ...deekshaBaseEnv, ZION_NONCE_BASE: String(deekshaSessionNonceBaseRevenue) };

    const pool = `${config.pool?.host || PRIMARY_TESTNET_HOST}:${config.pool?.port || PRIMARY_POOL_PORT}`;
    const wallet = config.wallet || '';
    const worker = config.worker || 'desktop-agent';
    const deekshaMainScript = mainMinerGpuDeeksha ? deekshaGpuScript : deekshaCpuScript;
    const deekshaResolvedBackend = mainMinerGpuDeeksha ? 'ekam-auto' : 'ekam-fallback';
    const deekshaMainArgs = [
      deekshaMainScript,
      '--pool', pool,
      '--wallet', wallet,
      '--worker', `${worker}-deeksha`,
      '--backend', 'auto',
      '--stats-file', STATS_PATH,
      '--stats-interval', String(STATS_INTERVAL_SEC),
    ];
    if (mainMinerGpuDeeksha) {
      deekshaMainArgs.push('--batch', String(deekshaGpuBatch));
    } else {
      deekshaMainArgs.push(
        '--threads', String(zionThreadsDeeksha),
      );
    }

    logApp('deeksha-main-start', JSON.stringify({
      pyExeDeeksha,
      deekshaMainScript,
      preferredBackend: _deekshaPreferredBackend,
      resolvedBackend: deekshaResolvedBackend,
      pool,
      worker,
      mainMinerGpuDeeksha,
      zionThreadsDeeksha,
      deekshaRevenueThreads,
      deekshaGpuBatch,
      gpuBackend: currentGpuInfoDeeksha?.backendPreferred || currentGpuInfoDeeksha?.type || 'cpu',
    }));
    sendToRenderer('miner-output', {
      stream: 'stdout',
      text:
        `[CHvEkamDeeksha] Spouštím Ekam canonical miner...\n` +
        `[CHvEkamDeeksha] Python: ${pyExeDeeksha}\n` +
        `[CHvEkamDeeksha] Canonical fallback active pro main cosmic_harmony mining.\n` +
        `[CHvEkamDeeksha] Main path: ${mainMinerGpuDeeksha ? 'auto (runtime backend decides)' : 'cpu'}\n` +
        `[CHvEkamDeeksha] Pool: ${pool} | Worker: ${worker}-deeksha\n` +
        `[CHvEkamDeeksha] Memory: HugePages=${deekshaMainEnv.ZION_HUGEPAGES} | Scratchpad=64 KiB` +
        (process.platform === 'win32' ? ' | Windows Large Pages (VirtualAlloc)' : '') + `\n` +
        `[CHvEkamDeeksha] Native libs: ${deekshaNativeLibDirs.length} dirs | PYTHONPATH: ${deekshaMiningDir}\n`
    });
    minerBackendPreferred = _deekshaPreferredBackend;
    minerBackendResolved = deekshaResolvedBackend;
    minerBackendPath = deekshaMainScript;
    minerBackendLastError = '';
    const myStartToken = ++minerStartToken;
    let spawnedMiner = null;
    try {
      spawnedMiner = spawn(pyExeDeeksha, deekshaMainArgs, {
        env: deekshaMainEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
      minerProcess = spawnedMiner;
    } catch (e) {
      const msg = `[CHvDeeksha] Failed to spawn Deeksha miner: ${e}\n`;
      sendToRenderer('miner-output', { stream: 'stderr', text: msg });
      return { success: false, error: String(e) };
    }
    sendToRenderer('miner-backend', {
      preferred: minerBackendPreferred,
      resolved: deekshaResolvedBackend,
      path: deekshaMainScript,
      lastError: ''
    });
    spawnedMiner.stdout.on('data', (d) => sendToRenderer('miner-output', { stream: 'stdout', text: d.toString() }));
    spawnedMiner.stderr.on('data', (d) => sendToRenderer('miner-output', { stream: 'stderr', text: d.toString() }));

    // ── Crash recovery + pool failover (parity with Rust spawn path) ──
    const deekshaSpawnTime = Date.now();
    let deekshaRetryCount = 0;
    const DEEKSHA_MAX_RETRIES = 3;
    const DEEKSHA_RETRY_DELAY_MS = 8000;

    spawnedMiner.on('error', (err) => {
      logApp('deeksha-spawn-error', err?.message || String(err));
      try {
        sendToRenderer('miner-output', {
          stream: 'stderr',
          text: `[CHvDeeksha] Miner spawn error: ${err?.message || err}\n`
        });
      } catch { /* ignore */ }
      if (minerProcess === spawnedMiner) {
        minerProcess = null;
        minerStopping = false;
        sendToRenderer('miner-stopped', { code: -1 });
        updateTrayMenu(minerStats);
      }
    });

    spawnedMiner.on('exit', (code) => {
      logApp('deeksha-main-exit', JSON.stringify({ code, runtime: Date.now() - deekshaSpawnTime }));
      if (minerProcess !== spawnedMiner) return;
      minerProcess = null;
      minerStopping = false;

      if (code === 0 || minerUserStopRequested) {
        // normal / user-requested stop
        sendToRenderer('miner-stopped', { code });
        updateTrayMenu(minerStats);
        return;
      }

      // Abnormal exit — try auto-restart with pool failover
      const runMs = Date.now() - deekshaSpawnTime;
      const crashMsg = `[CHvDeeksha] Miner exited (code=${code}) after ${Math.round(runMs / 1000)}s.`;
      try { sendToRenderer('miner-output', { stream: 'stderr', text: crashMsg + '\n' }); } catch { /* ignore */ }

      if (deekshaRetryCount < DEEKSHA_MAX_RETRIES) {
        deekshaRetryCount++;
        const retryMsg = `[CHvDeeksha] Auto-restart ${deekshaRetryCount}/${DEEKSHA_MAX_RETRIES} in ${DEEKSHA_RETRY_DELAY_MS / 1000}s...`;
        try { sendToRenderer('miner-output', { stream: 'stdout', text: retryMsg + '\n' }); } catch { /* ignore */ }
        logApp('deeksha-auto-restart', JSON.stringify({ attempt: deekshaRetryCount }));
        setTimeout(() => {
          if (minerUserStopRequested || minerStopping) return;
          if (minerProcess) return; // something else started
          if (myStartToken !== minerStartToken) return;
          startMining(config);
        }, DEEKSHA_RETRY_DELAY_MS);
      } else {
        try {
          sendToRenderer('miner-output', {
            stream: 'stderr',
            text: `[CHvDeeksha] Max retries (${DEEKSHA_MAX_RETRIES}) reached. Mining stopped.\n`
          });
        } catch { /* ignore */ }
        sendToRenderer('miner-stopped', { code });
        updateTrayMenu(minerStats);
      }
    });
    setTimeout(() => {
      if (minerUserStopRequested || minerStopping) return;
      if (!minerProcess || minerProcess !== spawnedMiner) return;
      if (myStartToken !== minerStartToken) return;
      sendToRenderer('miner-started', {});
      updateTrayMenu(minerStats);
    }, 450);

    // ── Deeksha Revenue (parity s CHv4.2) ─────────────────────────────────
    if (revenueEnabledDeeksha && deekshaRevenueThreads > 0) {
      try {
        const deekshaRevenueStatsPath = STATS_PATH.replace(/\.json$/, '_deeksha_revenue.json');
        const revArgs = [
          deekshaCpuScript,
          '--pool', pool,
          '--wallet', wallet,
          '--threads', String(deekshaRevenueThreads),
          '--stats-file', deekshaRevenueStatsPath,
          '--stats-interval', String(STATS_INTERVAL_SEC || 30),
          '--backend', 'auto',
        ];
        if (worker) revArgs.push('--worker', `${worker}-deeksha-rev`);
        revenueProcess = spawn(pyExeDeeksha, revArgs, {
          env: deekshaRevenueEnv,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });
        logApp('deeksha-revenue-started', JSON.stringify({ pid: revenueProcess?.pid, threads: deekshaRevenueThreads, pool }));
        sendToRenderer('miner-output', {
          stream: 'stdout',
          text: `[DKS-REV] Revenue CPU miner started (PID ${revenueProcess?.pid}) — ${deekshaRevenueThreads}T -> ${pool}\n`,
        });
        revenueProcess.stdout?.on('data', (d) => {
          safeMinerLogWrite(`[DKS-REV-STDOUT] ${d}`);
          try { sendToRenderer('miner-output', { stream: 'stdout', text: `[DKS-REV] ${d}` }); } catch {}
        });
        revenueProcess.stderr?.on('data', (d) => {
          safeMinerLogWrite(`[DKS-REV-STDERR] ${d}`);
          try { sendToRenderer('miner-output', { stream: 'stderr', text: `[DKS-REV] ${d}` }); } catch {}
        });
        revenueProcess.on('error', (err) => {
          logApp('deeksha-revenue-error', err?.message || String(err));
          revenueProcess = null;
        });
        revenueProcess.on('close', (code) => {
          revenueProcess = null;
          if (minerProcess && code !== 0) {
            try { sendToRenderer('miner-output', { stream: 'stderr', text: `[DKS-REV] Revenue miner exited (code=${code}).\n` }); } catch {}
          }
        });
      } catch (revErr) {
        logApp('deeksha-revenue-spawn-failed', revErr?.message || String(revErr));
        revenueProcess = null;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    return { success: true };
  }
  // ─────────────────────────────────────────────────────────────────────────

  const preferredBackend = String(config?.minerBackend || 'auto').toLowerCase();
  const selection = resolveMinerSelection(preferredBackend);
  if (!selection) {
    // Rust was explicitly requested (or auto) but the binary is missing / quarantined.
    // Before showing an error, try to auto-downgrade to Python if it exists.
    const emergencyPythonPath = findPythonMiner();
    if (emergencyPythonPath && (preferredBackend === 'rust' || preferredBackend === 'auto')) {
      const warnMsg =
        `[WARN] Rust miner not found (Windows Defender may have quarantined zion-universal-miner.exe). ` +
        `Automatically falling back to Python miner.\n`;
      MINER_IS_RUST = false;
      MINER_IS_PYTHON = true;
      MINER_PATH = emergencyPythonPath;
      minerBackendPreferred = preferredBackend;
      minerBackendResolved = 'python';
      minerBackendPath = emergencyPythonPath;
      minerBackendLastError = warnMsg.trim();
      try {
        sendToRenderer('miner-backend', {
          preferred: minerBackendPreferred,
          resolved: 'python',
          path: emergencyPythonPath,
          lastError: minerBackendLastError
        });
        sendToRenderer('miner-output', { stream: 'stderr', text: warnMsg });
      } catch { /* ignore */ }
      // Reconstruct a synthetic selection and continue
      const synth = { backend: 'python', path: emergencyPythonPath, isRust: false, isPython: true };
      // Jump directly to the rest of startMining with python backend explicitly
      return startMining({ ...config, minerBackend: 'python' });
    }

    const rustHint = preferredBackend === 'rust'
      ? `Rust miner not found or blocked. On Windows, Windows Defender may quarantine zion-universal-miner.exe. Check Defender protection history and add an exclusion for: ${IS_PACKAGED ? process.resourcesPath : path.join(APP_ROOT, 'resources')}`
      : 'No miner executable found. Please install Rust miner or Python miner.';
    minerBackendPreferred = preferredBackend;
    minerBackendResolved = null;
    minerBackendPath = '';
    minerBackendLastError = rustHint;
    try {
      sendToRenderer('miner-backend', {
        preferred: minerBackendPreferred,
        resolved: minerBackendResolved,
        path: minerBackendPath,
        lastError: minerBackendLastError
      });
      sendToRenderer('miner-output', { stream: 'stderr', text: `[ERROR] ${rustHint}\n` });
    } catch {
      // ignore
    }
    return { success: false, error: rustHint };
  }

  try {
    minerBackendPreferred = preferredBackend;
    minerBackendResolved = String(selection.backend || '').toLowerCase() || null;
    minerBackendPath = selection.path || '';
    minerBackendLastError = '';
  } catch {
    minerBackendPreferred = 'auto';
    minerBackendResolved = null;
    minerBackendPath = '';
    minerBackendLastError = '';
  }

  // Tell renderer what we actually resolved (lite backend indicator).
  try {
    sendToRenderer('miner-backend', {
      preferred: minerBackendPreferred,
      resolved: minerBackendResolved,
      path: selection.path || '',
      lastError: minerBackendLastError
    });
  } catch {
    // ignore
  }

  if (MINER_PATH !== selection.path || MINER_IS_RUST !== selection.isRust || MINER_IS_PYTHON !== selection.isPython) {
    MINER_PATH = selection.path;
    MINER_IS_RUST = selection.isRust;
    MINER_IS_PYTHON = selection.isPython;
    try {
      sendToRenderer('miner-output', {
        stream: 'stdout',
        text: `[INFO] Miner backend: ${selection.backend} (${selection.path})\n`
      });
    } catch {
      // ignore
    }
  }

  const minerStartTs = Date.now();
  const fallbackPythonPath = findPythonMiner();
  const rustFallbackEligible =
    MINER_IS_RUST &&
    !!fallbackPythonPath &&
    preferredBackend === 'auto';

  try {
    cleanupStrayMinerProcesses(MINER_IS_RUST);
  } catch {
    // ignore
  }
  if (minerProcess) {
    dbg('Miner already running');
    return { success: false, error: 'Miner is already running' };
  }

  // Clear any stale auto-stop timer from previous runs.
  if (minerAutoStopTimer) {
    try {
      clearTimeout(minerAutoStopTimer);
    } catch {
      // ignore
    }
    minerAutoStopTimer = null;
  }

  if (!config.wallet || !config.wallet.toString().trim()) {
    dialog.showErrorBox('Wallet Missing', 'Set your ZION wallet address in Settings or Wallet tab before starting mining.');
    return { success: false, error: 'Wallet missing' };
  }

  // Enforce canonical chain-compatible addresses.
  const addr = config.wallet.toString().trim();
  const addrType = WalletGenerator.getAddressType(addr);
  if (addrType !== 'zion1') {
    const hint = addrType === 'legacy'
      ? 'You are using a legacy ZION... address. The chain only credits zion1... addresses.'
      : 'Invalid address format.';
    dialog.showErrorBox(
      'Invalid Wallet Address',
      `${hint}\n\nPlease create/select a zion1... wallet in the Wallet tab and use that for mining.`
    );
    return { success: false, error: 'Invalid wallet address' };
  }

  // Guard against bridge escrow address used as mining wallet.
  // This address is valid for L1 bridge deposits, but pool rejects it for mining login.
  const knownBridgeEscrow = new Set([
    'zion1wn5nv4snxzjjlqb48z5zatungtvr4ruz6yjd4c5'
  ]);
  if (knownBridgeEscrow.has(addr)) {
    dialog.showErrorBox(
      'Wrong Wallet for Mining',
      'Bridge escrow address was entered as mining wallet.\n\n' +
      'Use your personal zion1... wallet from Wallet tab for mining rewards.\n' +
      'Bridge address is only for transfer memo BRIDGE:... tests.'
    );
    return { success: false, error: 'Bridge escrow cannot be used as mining wallet' };
  }

  // Check if miner executable exists
  if (!fs.existsSync(MINER_PATH)) {
    // On Windows, Defender may quarantine the Rust binary after app startup.
    // If a Python fallback exists and user hasn't explicitly pinned Rust, auto-switch.
    if (MINER_IS_RUST && fallbackPythonPath && preferredBackend === 'auto') {
      MINER_IS_RUST = false;
      MINER_IS_PYTHON = true;
      MINER_PATH = fallbackPythonPath;
      minerBackendLastError = 'Rust miner was removed (Windows Defender quarantine?). Switched to Python miner automatically.';
      try {
        sendToRenderer('miner-output', {
          stream: 'stderr',
          text: `[WARN] ${minerBackendLastError}\n`
        });
        sendToRenderer('miner-backend', {
          preferred: minerBackendPreferred,
          resolved: 'python',
          path: fallbackPythonPath,
          lastError: minerBackendLastError
        });
      } catch { /* ignore */ }
      // Continue — MINER_PATH is now the Python script
    } else {
      const defMsg = MINER_IS_RUST && process.platform === 'win32'
        ? `Miner executable not found at: ${MINER_PATH}\n\nWindows Defender may have quarantined zion-universal-miner.exe.\nCheck Defender Protection History and add an exclusion for:\n${IS_PACKAGED ? process.resourcesPath : path.join(APP_ROOT, 'resources')}`
        : `Miner executable not found at: ${MINER_PATH}`;
      dialog.showErrorBox('Miner Not Found', defMsg);
      return { success: false, error: `Miner executable not found at: ${MINER_PATH}` };
    }
  }

  // Auto load-balance for max performance + responsiveness.
  // We do not add new UI; we just clamp/auto-pick effective threads.
  let effectiveThreads = computeEffectiveThreads(config);
  const revenueProfile = normalizeRevenueProfile(config?.revenue || {});
  const pureZionMode = isPureZionDesktopMode(config);

  // Mining mode: cpu, gpu, dual, gpu-revenue (new UI)
  // Backwards compatible: if miningMode not set, use legacy gpu checkbox
  const miningMode = String(config.miningMode || (config.gpu ? 'dual' : 'cpu')).toLowerCase();
  
  // GPU mode guardrails: do not attempt GPU for algorithms that don't support it.
  const wantsGpu = miningMode === 'gpu' || miningMode === 'dual' || miningMode === 'gpu-revenue';
  const algoForGpu = normalizeAlgorithmName(config.algorithm || '');
  const gpuAllowed = algoSupportsGpu(algoForGpu);
  const effectiveGpu = wantsGpu && gpuAllowed;

  // CHv3 GPU performance guard:
  // On some Ryzen/AMD OpenCL rigs, too many CPU threads steal memory/cache bandwidth
  // and reduce GPU hashrate significantly. Cap CPU threads while GPU mining is active.
  try {
    const algoLowerPerf = normalizeAlgorithmName(config.algorithm || '');
    const isChv3Perf = isCosmicHarmonyFamily(algoLowerPerf);
    if (effectiveGpu && isChv3Perf) {
      const cfgGpuCpuCap = Number(config?.gpuCpuThreads);
      const envGpuCpuCap = Number(String(process.env.ZION_GPU_CPU_THREADS || '').trim());
      const gpuCpuCapRaw = Number.isFinite(envGpuCpuCap) && envGpuCpuCap > 0
        ? envGpuCpuCap
        : (Number.isFinite(cfgGpuCpuCap) && cfgGpuCpuCap > 0 ? cfgGpuCpuCap : 5);
      const gpuCpuCap = Number.isFinite(gpuCpuCapRaw) && gpuCpuCapRaw > 0 ? Math.floor(gpuCpuCapRaw) : 5;
      effectiveThreads = Math.max(1, Math.min(effectiveThreads, gpuCpuCap));
    }
  } catch {
    // ignore
  }
  
  // Determine effective mode for miner
  let effectiveMode = 'cpu';
  if (effectiveGpu) {
    if (miningMode === 'gpu-revenue') {
      effectiveMode = 'gpu-revenue'; // Special mode for dynamic GPU coin switching
    } else {
      effectiveMode = miningMode === 'dual' ? 'gpu' : 'gpu'; // miner handles dual internally when mode=gpu
    }
  }
  
  // Log mining mode for user
  try {
    let modeLabel = 'CPU Only';
    if (miningMode === 'gpu') {
      modeLabel = 'GPU Only';
    } else if (miningMode === 'dual') {
      modeLabel = 'DUAL (CPU + GPU)';
    } else if (miningMode === 'gpu-revenue') {
      modeLabel = 'GPU Revenue Mining (Profit Switching)';
    }
    sendToRenderer('miner-output', {
      stream: 'stdout',
      text: `[INFO] Mining Mode: ${modeLabel}\n`
    });
  } catch {
    // ignore
  }
  
  if (wantsGpu && !gpuAllowed) {
    try {
      sendToRenderer('miner-output', {
        stream: 'stderr',
        text: `[WARN] GPU mode is not supported for algorithm=${algoForGpu}. Forcing CPU mode.\n`
      });
    } catch {
      // ignore
    }
    logApp('gpu-forced-off', JSON.stringify({ algorithm: algoForGpu }));
  }

  try {
    const cpuCount = Array.isArray(os.cpus?.()) ? os.cpus().length : 1;
    const safeCpuCount = Math.max(1, cpuCount);
    const afterburnerEnabled = config?.aiAfterburner !== false;
    const reserved = Math.min(safeCpuCount - 1, afterburnerEnabled ? 2 : 1);
    const maxThreads = Math.max(1, safeCpuCount - reserved);
    const autoAff = computeAutoAffinity(safeCpuCount, effectiveThreads);
    const msg = {
      cpuCount: safeCpuCount,
      afterburnerEnabled,
      reserved,
      maxThreads,
      requestedThreads: config?.threads,
      effectiveThreads,
      autoAffinityMask: autoAff?.mask != null ? autoAff.mask.toString() : '',
      autoAffinityCores: Array.isArray(autoAff?.cores) ? autoAff.cores.join(',') : ''
    };
    logApp('miner-auto-tune', JSON.stringify(msg));
    try {
      sendToRenderer('miner-output', { stream: 'stdout', text: `[INFO] Auto-tune: threads=${effectiveThreads}/${safeCpuCount} reserved=${reserved} affinity=${msg.autoAffinityCores || 'auto'}\n` });
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }

  // GPU stability guard:
  // Python CHv3 GPU path can produce invalid shares on some driver/kernel combos.
  // When GPU mode is requested and Rust miner is available, prefer Rust backend.
  if (effectiveGpu && MINER_IS_PYTHON && preferredBackend !== 'python') {
    const forcePythonGpu = String(process.env.ZION_FORCE_PYTHON_GPU || '').trim() === '1';
    if (!forcePythonGpu) {
      const rustGpuPath = findRustMiner();
      if (rustGpuPath && fs.existsSync(rustGpuPath)) {
        MINER_PATH = rustGpuPath;
        MINER_IS_RUST = true;
        MINER_IS_PYTHON = false;
        minerBackendResolved = 'rust';
        minerBackendPath = rustGpuPath;
        try {
          logApp('gpu-backend-switch', JSON.stringify({ reason: 'gpu-mode-prefer-rust', path: rustGpuPath }));
          sendToRenderer('miner-output', {
            stream: 'stdout',
            text: `[INFO] GPU mode: switching backend to Rust miner (${path.basename(rustGpuPath)}) for share validity.\n`
          });
          sendToRenderer('miner-backend', {
            preferred: minerBackendPreferred,
            resolved: 'rust',
            path: rustGpuPath,
            lastError: minerBackendLastError
          });
        } catch {
          // ignore
        }
      }
    }
  }

  // CHv4/Cosmic backend guard:
  // Keep Rust backend as default for Cosmic Harmony family.
  // Python backend can be forced explicitly via ZION_PREFER_PYTHON_CH=1.
  try {
    const algoLowerStable = normalizeAlgorithmName(config.algorithm || '');
    const isChv3Stable = isCosmicHarmonyFamily(algoLowerStable);
    const forceRustChv3 = String(process.env.ZION_FORCE_RUST_CHV3 || '').trim() === '1';
    const preferPythonCh = String(process.env.ZION_PREFER_PYTHON_CH || '').trim() === '1';
    const canAutoSwitch = preferredBackend === 'auto' || preferredBackend === 'rust';
    if (
      process.platform === 'win32' &&
      effectiveGpu &&
      isChv3Stable &&
      MINER_IS_RUST &&
      canAutoSwitch &&
      !forceRustChv3 &&
      preferPythonCh
    ) {
      const pyStablePath = findPythonMiner();
      if (pyStablePath && fs.existsSync(pyStablePath)) {
        MINER_PATH = pyStablePath;
        MINER_IS_RUST = false;
        MINER_IS_PYTHON = true;
        minerBackendResolved = 'python';
        minerBackendPath = pyStablePath;
        try {
          logApp('gpu-backend-switch', JSON.stringify({ reason: 'ch-python-opt-in', path: pyStablePath }));
          sendToRenderer('miner-output', {
            stream: 'stdout',
            text: '[INFO] Cosmic Harmony: using Python backend (opt-in via ZION_PREFER_PYTHON_CH=1).\n'
          });
          sendToRenderer('miner-backend', {
            preferred: minerBackendPreferred,
            resolved: 'python',
            path: pyStablePath,
            lastError: minerBackendLastError
          });
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }

  const rustGroupSupported = MINER_IS_RUST ? rustMinerSupportsGroupFlag(MINER_PATH) : false;

  // ═══════════════════════════════════════════════════════════
  // CH3 Revenue Mining Info (50/25/25 allocation)
  // ═══════════════════════════════════════════════════════════
  {
    const envDisableRevenue = String(process.env.ZION_DISABLE_REVENUE || '').trim() === '1';
    const envEnableRevenue = String(process.env.ZION_ENABLE_REVENUE || '').trim() === '1';
    const revenueEnabled = envDisableRevenue ? false : (envEnableRevenue ? true : revenueProfile.enabled !== false);

    if (revenueEnabled && effectiveThreads >= 3) {
      const alloc = revenueProfile.allocation || {};
      const allocText = `Z:${alloc.zionPct ?? 50}% R:${alloc.multiAlgoPct ?? 25}% N:${alloc.nclPct ?? 25}%`;
      try {
        sendToRenderer('miner-output', { stream: 'stdout', text: `[CH3] ═══ Revenue Mining Active ═══\n` });
        sendToRenderer('miner-output', { stream: 'stdout', text: `[CH3]   ZION: CosmicHarmony → pool:${config.pool.port} (g=zion)\n` });
        sendToRenderer('miner-output', { stream: 'stdout', text: `[CH3]   REV:  Multi-Algo → pool:${config.pool.port} (g=revenue)\n` });
        if (revenueProfile?.nclEnabled !== false) {
          sendToRenderer('miner-output', { stream: 'stdout', text: `[CH3]   NCL:  AI Compute → pool:${config.pool.port} (g=ncl)\n` });
        }
        sendToRenderer('miner-output', { stream: 'stdout', text: `[CH3]   ALLOC: ${allocText}\n` });
        sendToRenderer('miner-output', { stream: 'stdout', text: `[CH3] ══════════════════════════════\n` });
      } catch {
        // ignore
      }
    }
  }

  // CHv4 (NPU Mixing INT8 MLP, CHV4_NPU_FORK_HEIGHT=0): CHv4 always active from genesis.
  // Pool canonical name for CHv4-era mining is 'cosmic_harmony'.
  const requestedAlgorithm = 'cosmic_harmony';
  const requestedAlgorithmLower = 'cosmic_harmony';
  const algorithmForMiner = 'cosmic_harmony';

  // GPU is exclusive: only the main ZION miner OR the GPU Revenue process gets --gpu, never both.
  // Two OpenCL contexts on the same GPU cause severe context-switching overhead (120→20 MH/s).
  // mode=gpu/dual → main miner uses GPU; mode=gpu-revenue → GPU Revenue process uses GPU.
  const mainMinerGpu = effectiveGpu && miningMode !== 'gpu-revenue';

  let args;
  let xmrRevenueThreads = 0;
  let nclThreads = 0;
  let zionThreads = effectiveThreads;

  // ═══ Revenue Thread Split (applies to both Rust and Python miners) ═══
  const envDisableRevenue = String(process.env.ZION_DISABLE_REVENUE || '').trim() === '1';
  const envEnableRevenue = String(process.env.ZION_ENABLE_REVENUE || '').trim() === '1';
  const revenueEnabled = envDisableRevenue ? false : (envEnableRevenue ? true : revenueProfile.enabled !== false);

  const canSplitThreads = (MINER_IS_RUST && rustGroupSupported) || MINER_IS_PYTHON;
  if (revenueEnabled && effectiveThreads >= 3 && canSplitThreads) {
    // ═══ 3-Way Split: ZION / Multi-Algo / NCL (50/25/25 default) ═══
    const multiPct = Math.max(0, Math.min(100, Number(revenueProfile?.allocation?.multiAlgoPct ?? 25)));
    const nclPct   = Math.max(0, Math.min(100, Number(revenueProfile?.allocation?.nclPct ?? 25)));
    const nclEnabled = revenueProfile?.nclEnabled !== false;

    const suggestedMulti = Math.max(1, Math.round(effectiveThreads * (multiPct / 100)));
    const suggestedNcl   = nclEnabled ? Math.max(1, Math.round(effectiveThreads * (nclPct / 100))) : 0;

    // Keep at least 2 threads for primary ZION stream.
    const maxRevenue = Math.max(0, effectiveThreads - 2);
    const totalRevenue = Math.min(maxRevenue, suggestedMulti + suggestedNcl);

    if (totalRevenue > 0 && suggestedMulti + suggestedNcl > 0) {
      // Proportionally distribute available revenue threads
      const ratio = totalRevenue / (suggestedMulti + suggestedNcl);
      xmrRevenueThreads = Math.max(1, Math.round(suggestedMulti * ratio));
      nclThreads = nclEnabled ? Math.max(0, totalRevenue - xmrRevenueThreads) : 0;
    } else {
      xmrRevenueThreads = 0;
      nclThreads = 0;
    }
  }
  zionThreads = effectiveThreads - xmrRevenueThreads - nclThreads;

  if (MINER_IS_RUST) {
    const algoLowerForHint = String(algorithmForMiner || requestedAlgorithmLower || 'cosmic_harmony').toLowerCase();
    const difficultyHint = computeDifficultyHint(config, algoLowerForHint);

    // Rust miner CLI (zion-universal-miner) — main ZION group
    args = [
      '--pool', `stratum+tcp://${config.pool.host}:${config.pool.port}`,
      '--wallet', config.wallet,
      '--threads', String(zionThreads),
      '--mode', mainMinerGpu ? (zionThreads > 0 ? 'dual' : 'gpu') : 'cpu',
      '--stats-file', STATS_PATH,
      '--stats-interval', String(STATS_INTERVAL_SEC),
      '--no-color'
    ];

    if (rustGroupSupported) {
      args.push('--group', 'zion');
    } else {
      try {
        sendToRenderer('miner-output', {
          stream: 'stderr',
          text: '[WARN] Rust miner CLI does not support --group; running single-process mode (revenue split disabled).\n'
        });
      } catch {
        // ignore
      }
      logApp('miner-group-unsupported', JSON.stringify({ minerPath: MINER_PATH }));
    }

    if (difficultyHint) {
      args.push('--difficulty', String(difficultyHint));
      try {
        sendToRenderer('miner-output', {
          stream: 'stdout',
          text: `[INFO] Difficulty hint: ${difficultyHint}\n`
        });
      } catch {
        // ignore
      }
    }

    if (config.worker) args.push('--worker', String(config.worker));
    if (algorithmForMiner) args.push('--algorithm', String(algorithmForMiner));
    // Enable GPU on all platforms for Rust miner.
    // On macOS this uses Metal backend (no OpenCL required).
    if (mainMinerGpu) {
      args.push('--gpu');
      // NOTE: Do NOT add --auto-tune here — it makes the miner run benchmark-only
      // and exit without mining. The miner already auto-calculates optimal batch
      // size via calculate_optimal_batch_size() based on GPU memory at runtime.
    }
    // Rust miner Ekam Deeksha scratchpad thread count (GPU memory-hard PoW).
    // ZION_GPU_MH_BATCH controls how many threads' scratchpads are allocated in VRAM.
    // Default=4096 (256 MiB). Higher values need more VRAM but may improve occupancy.
    if (mainMinerGpu && !String(process.env.ZION_GPU_MH_BATCH || '').trim()) {
      const gpuMem = parseGpuMemoryMb(gpuInfo);
      // 4096 × 64 KiB = 256 MiB — sweet spot for 4-8 GB GPUs.
      // 8192 × 64 KiB = 512 MiB — for 8+ GB GPUs.
      const mhBatch = gpuMem >= 8000 ? 8192 : 4096;
      env.ZION_GPU_MH_BATCH = String(mhBatch);
    }
  } else {
    // Python miner / legacy .exe miner (shared CLI)
    const pythonUi = String(config?.pythonUi || process.env.ZION_PY_UI || 'trex').trim().toLowerCase();
    const pythonUiResolved = ['lines', 'xmrig', 'trex'].includes(pythonUi) ? pythonUi : 'trex';
    const currentGpuInfo = detectGPU();
    const pythonGpuBatch = chooseGpuBatchSize(
      currentGpuInfo,
      config?.gpuBatchSize || process.env.ZION_CHV3_GPU_BATCH || process.env.ZION_GPU_BATCH_SIZE
    );
    args = [
      '--pool', `${config.pool.host}:${config.pool.port}`,
      '--wallet', config.wallet,
      '--worker', config.worker,
      '--threads', String(zionThreads),
      '--gpu-batch', String(pythonGpuBatch),
      '--group', 'zion',
      '--ui', pythonUiResolved,
      '--stats-interval', String(STATS_INTERVAL_SEC),
      '--stats-file', STATS_PATH
    ];

    if (algorithmForMiner) {
      args.push('--algorithm', String(algorithmForMiner));
    }

    // Use effectiveMode which handles dual mining logic
    args.push('--mode', effectiveMode);
  }

  const minerLabel = MINER_IS_RUST
    ? `rust ${MINER_PATH}`
    : MINER_IS_PYTHON
      ? `python ${MINER_PATH}`
      : MINER_PATH;
  dbg('Starting miner:', minerLabel, args.join(' '));

  // Cache some metadata for xmrig-style status lines.
  try {
    // Reset live stats so we never display stale A/R from a previous run.
    minerStats.hashrate = 0;
    minerStats.shares = 0;
    minerStats.accepted = 0;
    minerStats.rejected = 0;
    minerStats.uptime = 0;
    minerStats.last_job_height = '';
    minerStats.last_job_diff = '';
    minerStats.last_pool_diff = '';
    minerStats.last_job_id = '';

    // Remove any stale stats file (e.g., from a previous Python run) so we don't read old counts.
    try {
      if (fs.existsSync(STATS_PATH)) fs.unlinkSync(STATS_PATH);
    } catch {
      // ignore
    }

    minerStats.algorithm = String(algorithmForMiner || config.algorithm || '').trim();
    minerStats.pool = `${config?.pool?.host || ''}:${config?.pool?.port || ''}`.replace(/^:|:$/g, '');
    minerStats.worker = String(config.worker || '').trim();
    minerStats.threads = String(effectiveThreads);
    // Dual/triple mining metadata
    minerStats.dual_mining = (xmrRevenueThreads > 0) || (nclThreads > 0);
    minerStats.zion_threads = zionThreads;
    minerStats.xmr_threads = xmrRevenueThreads;
    minerStats.ncl_threads = nclThreads;
    minerStats.xmr_pool = xmrRevenueThreads > 0 ? `${config?.pool?.host || ''}:${config?.pool?.port || ''} (g=revenue)` : '';
    const preferredRevenueCoin = String(revenueProfile?.cpu?.coin || 'auto').toUpperCase();
    minerStats.revenue_coin = MINER_IS_RUST && xmrRevenueThreads > 0
      ? (preferredRevenueCoin === 'AUTO' ? 'AUTO' : preferredRevenueCoin)
      : '';
    minerStats.stream_allocation = `Z:${revenueProfile?.allocation?.zionPct ?? 50}% R:${revenueProfile?.allocation?.multiAlgoPct ?? 25}% N:${revenueProfile?.allocation?.nclPct ?? 25}%`;
    minerStats.ncl_enabled = !!revenueProfile?.ncl?.enabled;
    minerStats.free_streams = {
      mysterium: !!revenueProfile?.freeStreams?.mysterium,
      nkn: !!revenueProfile?.freeStreams?.nkn,
      ai_gateway: !!revenueProfile?.freeStreams?.aiGateway,
    };
    minerMetricsLastEmitMs = 0;
    minerRateSamples = [];
    minerShareLastSample = { t: 0, accepted: 0, rejected: 0 };
    minerShareDeltaSamples = [];
  } catch {
    // ignore
  }

  // The miner loads native DLLs via relative paths like ai\\mining\\*.dll.
  // Ensure cwd points to a directory that contains the ai/ folder.
  const minerCwd = IS_PACKAGED
    ? process.resourcesPath
    : (process.platform === 'win32' ? path.join(APP_ROOT, '..') : path.join(APP_ROOT, 'resources'));

  // Spawn miner - use Python on macOS/Linux, executable on Windows
  let spawnCommand, spawnArgs;
  if (MINER_IS_PYTHON) {
    // Prefer local venv interpreter when available (stable deps for GPU OpenCL path).
    // Fallback to system python/python3 when no venv is found.
    const venvCandidates = process.platform === 'win32'
      ? [
          path.join(APP_ROOT, '.venv', 'Scripts', 'python.exe'),
          path.join(APP_ROOT, '..', '.venv', 'Scripts', 'python.exe'),
          path.join(APP_ROOT, '..', '..', '.venv', 'Scripts', 'python.exe')
        ]
      : [
          path.join(APP_ROOT, '.venv', 'bin', 'python3'),
          path.join(APP_ROOT, '..', '.venv', 'bin', 'python3'),
          path.join(APP_ROOT, '..', '..', '.venv', 'bin', 'python3')
        ];

    const envVenv = String(process.env.VIRTUAL_ENV || '').trim();
    if (envVenv) {
      venvCandidates.unshift(
        process.platform === 'win32'
          ? path.join(envVenv, 'Scripts', 'python.exe')
          : path.join(envVenv, 'bin', 'python3')
      );
    }

    const resolvedPython = venvCandidates.find((candidate) => {
      try {
        return !!candidate && fs.existsSync(candidate);
      } catch {
        return false;
      }
    });

    spawnCommand = resolvedPython || (process.platform === 'win32' ? 'python' : 'python3');
    spawnArgs = [MINER_PATH, ...args];
  } else {
    // Windows: use .exe directly
    spawnCommand = MINER_PATH;
    spawnArgs = args;
  }

  // Detect GPU and pass to miner via env
  const gpuInfo = detectGPU();
  minerStats.gpu_detected = gpuInfo.available;
  minerStats.gpu_type = gpuInfo.type;
  minerStats.gpu_name = gpuInfo.name;
  minerStats.cpu_only_mode = gpuInfo.cpuOnly;

  try {
    // CPU info (model + logical cores) — shown in debug panel for clarity.
    try {
      const cpuList = Array.isArray(os.cpus?.()) ? os.cpus() : [];
      const cpuModel = String(cpuList?.[0]?.model || '').trim() || process.arch;
      const logical = cpuList.length || 1;
      const splitParts = [];
      if (xmrRevenueThreads > 0 || nclThreads > 0) {
        splitParts.push(`ZION=${zionThreads}T`);
        if (xmrRevenueThreads > 0) splitParts.push(`REV=${xmrRevenueThreads}T`);
        if (nclThreads > 0) splitParts.push(`NCL=${nclThreads}T`);
      }
      const split = splitParts.length > 0 ? ` | split ${splitParts.join(' ')}` : '';
      const cpuLine = `[CH3] CPU: ${cpuModel} (logical=${logical}) | threads=${effectiveThreads}${split}\n`;
      sendToRenderer('miner-output', {
        stream: 'stdout',
        text: cpuLine
      });

      // Also persist to miner.log (useful for support/debug and for tests).
      appendToFileBuffered(LOG_PATH, cpuLine, {
        flushDelayMs: 140,
        maxBufferedChars: 256 * 1024,
        rotate: {
          maxBytes: MAX_MINER_LOG_BYTES,
          maxBackups: MAX_MINER_LOG_BACKUPS,
          maxAgeMs: MAX_MINER_LOG_AGE_MS,
          minCheckIntervalMs: 5000
        }
      });
    } catch {
      // ignore
    }

    const modeLabel = gpuInfo.available ? `GPU: ${gpuInfo.name} (${gpuInfo.type})` : 'CPU-ONLY MODE (no GPU detected)';
    sendToRenderer('miner-output', { stream: 'stdout', text: `[CH3] ${modeLabel}\n` });
    if (gpuInfo.cpuOnly && !pureZionMode) {
      sendToRenderer('miner-output', { stream: 'stdout', text: '[CH3] Revenue stream locked to XMR/RandomX (25% CPU time)\n' });
    }
  } catch {}

  const sessionNonceBaseMain = (Date.now() >>> 0) & 0x1fffffff; // 0 .. 0x1FFFFFFF
  const sessionNonceBaseRevenue = sessionNonceBaseMain + 0x40000000;
  const sessionNonceBaseGpuRevenue = sessionNonceBaseMain + 0x80000000;

  const env = {
    ...process.env,
    // CH v3 desktop režim: držet algoritmus pinned, bez runtime stream switchů.
    ZION_ENABLE_STREAM_SWITCH: '0',
    ...(gpuInfo.available ? { ZION_HAS_GPU: '1' } : {}),
    ZION_AI_AFTERBURNER: config.aiAfterburner === false ? '0' : '1',
    // Revenue profile configuration
    ZION_REVENUE_ENABLED: revenueProfile.enabled ? '1' : '0',
    ZION_REVENUE_CPU_COIN: String(revenueProfile?.cpu?.coin || 'auto').toLowerCase(),
    ZION_REVENUE_ALLOCATION: `Z:${revenueProfile?.allocation?.zionPct ?? 50},R:${revenueProfile?.allocation?.multiAlgoPct ?? 25},N:${revenueProfile?.allocation?.nclPct ?? 25}`,
    ZION_ENABLE_NCL: revenueProfile?.ncl?.enabled ? '1' : '0',
    ZION_NCL_ALLOCATION_PCT: String(revenueProfile?.allocation?.nclPct ?? 25),
    ZION_ENABLE_MYSTERIUM: revenueProfile?.freeStreams?.mysterium ? '1' : '0',
    ZION_ENABLE_NKN: revenueProfile?.freeStreams?.nkn ? '1' : '0',
    ZION_ENABLE_AI_GATEWAY: revenueProfile?.freeStreams?.aiGateway ? '1' : '0',
    // GPU Revenue Mining configuration
    ZION_GPU_REVENUE: (revenueProfile?.gpu?.enabled || config.gpuRevenue) ? '1' : '0',
    ZION_GPU_REVENUE_COINS: Array.isArray(revenueProfile?.gpu?.coins) && revenueProfile.gpu.coins.length
      ? revenueProfile.gpu.coins.join(',')
      : (config.gpuRevenueCoins ? config.gpuRevenueCoins.join(',') : 'KAS,ETC,ALPH,ERG,RVN,CFX,ZANO,EVR,MEWC'),
    // CHv3 PoolPreference — mirrors Rust ProfitSwitchConfig.pool_preference
    ZION_POOL_PREFERENCE: String(
      process.env.ZION_POOL_PREFERENCE ||
      revenueProfile?.gpu?.poolPreference ||
      config.poolPreference ||
      'herominers'
    ).toLowerCase(),
    ZION_POOL_REGION: String(
      process.env.ZION_POOL_REGION ||
      revenueProfile?.gpu?.poolRegion ||
      config.poolRegion ||
      'eu'
    ).toLowerCase(),
    // NiceHash BTC address (required when ZION_POOL_PREFERENCE=nicehash)
    ...((() => {
      const nhAddr = String(
        process.env.ZION_NH_BTC_ADDR ||
        revenueProfile?.gpu?.nicehashBtcAddr ||
        config.nicehashBtcAddr ||
        config.revenueWallet ||
        ''
      ).trim();
      return nhAddr ? { ZION_NH_BTC_ADDR: nhAddr } : {};
    })()),
    // Safety default: Cosmic Harmony C++ dylib has shown instability on macOS in some builds.
    // If you want to force-enable it, set ZION_COSMIC_CPP=1 in the environment.
    ...(process.platform === 'darwin' ? { ZION_COSMIC_CPP: process.env.ZION_COSMIC_CPP || '0' } : {}),
    // Prevent UnicodeEncodeError on Windows when PyInstaller app prints non-ASCII.
    PYTHONUTF8: '1',
    // Belt-and-suspenders: force UTF-8 for all Python I/O (stdout/stderr/stdin).
    // Without this, emoji in print() during module import crash under Electron pipes.
    PYTHONIOENCODING: 'utf-8',
    PYTHONIOENCODING: 'utf-8',
    // Make sure prints/logs aren't stuck in a buffer when stdout isn't a TTY.
    PYTHONUNBUFFERED: '1',
    // Add mining folder to PYTHONPATH so miner can find local modules
    PYTHONPATH: minerCwd + (process.env.PYTHONPATH ? path.delimiter + process.env.PYTHONPATH : ''),
    // Main process nonce base is randomized per session to avoid reconnect duplicates.
    ZION_NONCE_BASE: String(sessionNonceBaseMain)
  };

  // Prefer best GPU backend by detected vendor/platform (unless explicitly overridden).
  try {
    const explicitBackend = String(process.env.ZION_GPU_BACKEND || '').trim().toLowerCase();
    if (!explicitBackend && gpuInfo.available) {
      env.ZION_GPU_BACKEND = String(gpuInfo.backendPreferred || 'opencl').toLowerCase();
      sendToRenderer('miner-output', {
        stream: 'stdout',
        text: `[CH3] GPU backend auto: ${env.ZION_GPU_BACKEND} (${gpuInfo.name || gpuInfo.type})\n`
      });
    }
  } catch {
    // ignore
  }

  // CHv3 performance defaults (speed-first):
  // - higher GPU batch for better OpenCL occupancy
  // - no CPU inter-batch sleep for maximum CPU throughput
  // - larger CH CPU batch for better per-thread efficiency
  // All remain overrideable by explicit environment variables.
  try {
    const algoLower = normalizeAlgorithmName(algorithmForMiner || requestedAlgorithmLower || '');
    const isChv3 = isCosmicHarmonyFamily(algoLower);
    if (isChv3 && mainMinerGpu) {
      if (!String(process.env.ZION_GPU_BATCH_SIZE || '').trim()) {
        const tunedBatch = chooseGpuBatchSize(gpuInfo, config?.gpuBatchSize);
        env.ZION_GPU_BATCH_SIZE = String(tunedBatch);
      }
      if (!String(process.env.ZION_CHV3_GPU_BATCH || '').trim()) {
        const fallbackBatch = chooseGpuBatchSize(gpuInfo, env.ZION_GPU_BATCH_SIZE || config?.gpuBatchSize);
        env.ZION_CHV3_GPU_BATCH = String(
          Number.isFinite(fallbackBatch)
            ? Math.max(100_000, Math.min(32_000_000, Math.floor(fallbackBatch)))
            : 4_000_000
        );
      }
      if (!String(process.env.ZION_CPU_SLEEP_MS || '').trim()) {
        env.ZION_CPU_SLEEP_MS = '0';
      }
      if (!String(process.env.ZION_BATCH_CH3 || '').trim()) {
        env.ZION_BATCH_CH3 = '50000';
      }
    }
  } catch {
    // ignore
  }

  // ═══════════════════════════════════════════════════════════
  // Native library paths — ensure Rust miner can find .dylib/.so/.dll
  // ═══════════════════════════════════════════════════════════
  {
    const nativeLibDirs = [
      path.join(minerCwd, 'native-libs'),
      minerCwd,
      path.join(minerCwd, 'ai', 'mining'),
      path.join(minerCwd, 'zion', 'mining'),
    ].filter(d => { try { return fs.existsSync(d); } catch { return false; } });

    if (nativeLibDirs.length > 0) {
      const nativeLibPath = nativeLibDirs.join(path.delimiter);
      if (process.platform === 'darwin') {
        // macOS: DYLD_LIBRARY_PATH for dynamic library loading
        env.DYLD_LIBRARY_PATH = nativeLibPath + (env.DYLD_LIBRARY_PATH ? path.delimiter + env.DYLD_LIBRARY_PATH : '');
        env.DYLD_FALLBACK_LIBRARY_PATH = nativeLibPath;
      } else if (process.platform === 'linux') {
        // Linux: LD_LIBRARY_PATH
        env.LD_LIBRARY_PATH = nativeLibPath + (env.LD_LIBRARY_PATH ? path.delimiter + env.LD_LIBRARY_PATH : '');
      }
      // Windows DLL paths handled separately below
      try {
        sendToRenderer('miner-output', {
          stream: 'stdout',
          text: `[CH3] Native libs: ${nativeLibDirs.length} directories configured\n`
        });
      } catch { /* ignore */ }
    }
  }

  // Optional difficulty hint for miners.
  // - Rust universal miner gets it via CLI (--difficulty)
  // - Python miner reads it from env and embeds into Stratum password (d=...)
  try {
    const algoLowerForHint = String(algorithmForMiner || requestedAlgorithmLower || 'cosmic_harmony').toLowerCase();
    const difficultyHint = computeDifficultyHint(config, algoLowerForHint);
    if (difficultyHint) {
      env.ZION_MINER_DIFFICULTY = String(difficultyHint);
      try {
        sendToRenderer('miner-output', {
          stream: 'stdout',
          text: `[INFO] Difficulty hint (env): ${difficultyHint}\n`
        });
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  let spawnDiagLine = null;
  const maybeFallbackToPython = (reason, force = false) => {
    if (IS_PACKAGED && !allowPackagedPythonFallback) return false;
    if (!fallbackPythonPath) return false;
    if (!force && !rustFallbackEligible) return false;
    if (minerStopping || minerFallbackInProgress || minerUserStopRequested) return false;
    minerFallbackInProgress = true;
    try {
      MINER_IS_RUST = false;
      MINER_IS_PYTHON = true;
      MINER_PATH = fallbackPythonPath;
      minerBackendLastError = `Rust miner failed (${reason}). Fallback to Python miner.`;
      try {
        sendToRenderer('miner-backend', {
          preferred: minerBackendPreferred,
          resolved: 'python',
          path: fallbackPythonPath,
          lastError: minerBackendLastError
        });
      } catch {
        // ignore
      }
      sendToRenderer('miner-output', {
        stream: 'stderr',
        text: `[WARN] Rust miner failed (${reason}). Falling back to Python miner.\n`
      });
    } catch {
      // ignore
    }
    minerFallbackTimer = setTimeout(async () => {
      minerFallbackInProgress = false;
      minerFallbackTimer = null;
      try {
        if (minerProcess) {
          try {
            await stopMiningAsync();
          } catch {
            // ignore
          }
        }
        startMining({ ...config, minerBackend: 'python' });
      } catch (err) {
        try {
          sendToRenderer('miner-output', {
            stream: 'stderr',
            text: `[ERROR] Python fallback failed: ${err?.message || String(err)}\n`
          });
        } catch {
          // ignore
        }
      }
    }, 800);
    return true;
  };

  let rejectRateFallbackTriggered = false;
  const maybeFallbackOnHighRejectRate = (outputText) => {
    try {
      if (rejectRateFallbackTriggered) return;
      if (!MINER_IS_RUST || !mainMinerGpu) return;
      if (minerStopping || minerUserStopRequested) return;
      if (!fallbackPythonPath) return;

      const enabled = String(process.env.ZION_ENABLE_REJECT_WATCHDOG || '1').trim() !== '0';
      if (!enabled) return;

      const algoLower = normalizeAlgorithmName(algorithmForMiner || '');
      const isChv3 = isCosmicHarmonyFamily(algoLower);
      if (!isChv3) return;

      // Keep Cosmic Harmony on Rust by default; Python fallback must be explicit.
      const allowPythonFallback = String(process.env.ZION_ALLOW_PYTHON_FALLBACK_CH || '').trim() === '1';
      if (!allowPythonFallback) return;

      const text = String(outputText || '');
      const mentionsReject = /rejected|share rejected|duplicate|does not meet target|low difficulty/i.test(text);
      if (!mentionsReject) return;

      const accepted = Number(minerStats.accepted || 0);
      const rejected = Number(minerStats.rejected || 0);
      const total = accepted + rejected;
      if (total < 40) return;
      const rejPct = total > 0 ? (rejected / total) : 0;

      const maxRej = Number(String(process.env.ZION_REJECT_WATCHDOG_MAX || '0.10').trim());
      const maxRejectRatio = Number.isFinite(maxRej) && maxRej > 0 ? maxRej : 0.10;
      if (rejPct < maxRejectRatio) return;

      rejectRateFallbackTriggered = true;
      const reason = `high reject ratio ${(rejPct * 100).toFixed(1)}% (${accepted}/${rejected})`;
      try {
        logApp('reject-watchdog-fallback', JSON.stringify({
          reason,
          accepted,
          rejected,
          total,
          backend: minerBackendResolved,
          worker: config?.worker || ''
        }));
      } catch {
        // ignore
      }

      try {
        sendToRenderer('miner-output', {
          stream: 'stderr',
          text: `[WARN] Rust GPU reject rate too high (${(rejPct * 100).toFixed(1)}%). Switching to Python backend for share stability...\n`
        });
      } catch {
        // ignore
      }

      void maybeFallbackToPython(reason, true);
    } catch {
      // ignore
    }
  };

  // Rust GPU watchdog:
  // If main Rust miner runs with --gpu but produces no hashrate/shares after warmup,
  // it is typically stuck in OpenCL init/kernel build. Auto-fallback to Python miner.
  //
  // Metal timing: each GPU dispatch (~2184 threads) takes ~11s. After 2 dispatches
  // (~22s) hashrate_10s > 0 is visible in the stats file. Watchdog default = 150s,
  // so by the time it fires the GPU should have reported hashrate. The watchdog only
  // triggers if BOTH hashrate == 0 AND accepted == 0 AND rejected == 0 — meaning the
  // process is truly stuck (Metal init failure), not just slow to produce shares.
  if (MINER_IS_RUST && mainMinerGpu) {
    const enableGpuInitWatchdog = String(process.env.ZION_ENABLE_GPU_INIT_WATCHDOG || '1').trim() !== '0';
    if (!enableGpuInitWatchdog) {
      try {
        logApp('gpu-init-watchdog-disabled', JSON.stringify({ backend: minerBackendResolved, worker: config?.worker || '' }));
      } catch {
        // ignore
      }
    }
    if (enableGpuInitWatchdog) {
    const gpuWatchdogMsRaw = Number(String(process.env.ZION_GPU_INIT_WATCHDOG_MS || '150000').trim());
    const gpuWatchdogMs = Number.isFinite(gpuWatchdogMsRaw) && gpuWatchdogMsRaw >= 30_000
      ? Math.floor(gpuWatchdogMsRaw)
      : 150_000;
    minerGpuInitWatchdogTimer = setTimeout(() => {
      try {
        if (!minerProcess || minerStopping || minerUserStopRequested) return;
        const hr = Number(minerStats.hashrate || 0);
        const accepted = Number(minerStats.accepted || 0);
        const rejected = Number(minerStats.rejected || 0);
        if (hr > 0 || accepted > 0 || rejected > 0) return;

        const reason = `GPU init watchdog: ${Math.round(gpuWatchdogMs / 1000)}s no hashrate/shares`;
        logApp('gpu-init-watchdog', JSON.stringify({ reason, backend: minerBackendResolved, worker: config?.worker || '' }));
        try {
          sendToRenderer('miner-output', {
            stream: 'stderr',
            text: `[WARN] Rust GPU miner appears stuck (no hashrate/shares after ${Math.round(gpuWatchdogMs / 1000)}s). Switching to Python fallback...\n`
          });
        } catch {
          // ignore
        }
        void maybeFallbackToPython(reason, true);
      } catch {
        // ignore
      }
    }, gpuWatchdogMs);
    }
  }

  // Rust GPU immediate fallback:
  // If Rust backend in GPU mode explicitly reports no GPU detected, switch to Python now
  // instead of waiting full watchdog timeout.
  let rustGpuNoDeviceFallbackTriggered = false;
  const maybeTriggerRustGpuNoDeviceFallback = (outputText) => {
    try {
      if (rustGpuNoDeviceFallbackTriggered) return;
      if (!MINER_IS_RUST || !mainMinerGpu || minerStopping || minerUserStopRequested) return;
      const text = String(outputText || '');
      const noGpuDetected = /\bgpu\s+none\s+detected\b/i.test(text);
      const gpuDisabled = /\bgpu\s+disabled\b/i.test(text);
      const cudaNotCompiled = /cuda support not compiled|build with --features cuda/i.test(text);
      if (!noGpuDetected && !gpuDisabled && !cudaNotCompiled) return;

      rustGpuNoDeviceFallbackTriggered = true;
      const reason = cudaNotCompiled
        ? 'rust binary missing CUDA feature'
        : (noGpuDetected ? 'rust reported no GPU device' : 'rust reported GPU disabled');
      try {
        logApp('gpu-no-device-fallback', JSON.stringify({ reason, backend: minerBackendResolved, worker: config?.worker || '' }));
      } catch {
        // ignore
      }
      try {
        if (cudaNotCompiled) {
          sendToRenderer('miner-output', {
            stream: 'stderr',
            text: '[WARN] NVIDIA detected but Rust miner was built without CUDA. Rebuild via: node scripts/prepare-rust-miner.js --auto\n'
          });
        }
        sendToRenderer('miner-output', {
          stream: 'stderr',
          text: `[WARN] Rust backend did not detect a usable GPU (${reason}). Switching to Python OpenCL backend...\n`
        });
      } catch {
        // ignore
      }
      // Force fallback regardless of preferred backend pinning (e.g. minerBackend='rust').
      void maybeFallbackToPython(reason, true);
    } catch {
      // ignore
    }
  };

  // Windows DLL resolution: our native algo DLLs are built with MinGW and may depend on
  // libstdc++/libgcc/libwinpthread/libgomp/libcrypto. Ensure the loader can find them.
  // This fixes "Failed to load dynlib/dll ... Most likely ... frozen" when deps are missing.
  if (process.platform === 'win32') {
    const dllDirs = [
      minerCwd,
      path.join(minerCwd, 'ai', 'mining'),
      path.join(minerCwd, 'zion', 'mining')
    ];
    // Windows env var casing can be either Path or PATH depending on how Electron was launched.
    const existingPath = env.PATH || env.Path || process.env.PATH || process.env.Path || '';
    const nextPath = dllDirs.join(path.delimiter) + (existingPath ? path.delimiter + existingPath : '');
    env.PATH = nextPath;
    env.Path = nextPath;
  }

  // "Na klik" RandomX: automatically choose FULL_MEM vs LIGHT on macOS.
  // We always set both env vars to override any inherited shell settings.
  const algoLower = String(config.algorithm || '').toLowerCase();
  let randomxAutoMessage = null;
  if (process.platform === 'darwin' && algoLower === 'randomx') {
    const decision = decideRandomxModeForMac(config);
    if (decision.light) {
      env.ZION_RANDOMX_LIGHT = '1';
      env.ZION_RANDOMX_FULL_MEM = '0';
      randomxAutoMessage = `RandomX auto: LIGHT mode (cache-only) selected — ${decision.reason}`;
    } else {
      env.ZION_RANDOMX_LIGHT = '0';
      env.ZION_RANDOMX_FULL_MEM = '1';
      randomxAutoMessage = `RandomX auto: FULL_MEM mode selected — ${decision.reason}`;
    }

    // Show users a friendly explanation in the UI log.
    try {
      sendToRenderer('miner-output', { stream: 'stdout', text: `${randomxAutoMessage}\n` });
    } catch {
      // ignore
    }
  }

  // HugePages: enable for Ekam Deeksha scratchpad (64 KiB memory-hard PoW).
  // ZION_HUGEPAGES=1 signals both Rust and Python backends to use mmap+mlock.
  // On Linux, true 2 MiB huge pages require: sysctl vm.nr_hugepages=128
  // On macOS arm64, 16K native pages are used (4 TLB entries for 64 KiB).
  {
    const hpEnv = String(process.env.ZION_HUGEPAGES || '').trim();
    env.ZION_HUGEPAGES = hpEnv === '0' ? '0' : '1'; // default ON

    let hpNote;
    if (process.platform === 'darwin' && process.arch === 'arm64') {
      hpNote = 'Apple Silicon 16K native pages | mmap+mlock | 4 TLB entries per 64 KiB';
    } else if (process.platform === 'darwin') {
      hpNote = 'macOS x86_64 superpages | mmap+mlock';
    } else if (process.platform === 'linux') {
      hpNote = 'Linux mmap | sysctl vm.nr_hugepages=128 for 2 MiB pages';
    } else if (process.platform === 'win32') {
      // One-click: attempt to enable SeLockMemoryPrivilege for Windows Large Pages.
      const lpResult = ensureWindowsLargePages();
      if (lpResult.enabled) {
        hpNote = lpResult.alreadyEnabled
          ? 'Windows Large Pages ACTIVE (VirtualAlloc + SeLockMemoryPrivilege)'
          : 'Windows Large Pages ENABLED (SeLockMemoryPrivilege granted — reboot may be needed)';
      } else {
        hpNote = 'Windows Large Pages (VirtualAlloc) | enable: secpol.msc → Lock pages in memory';
      }
    } else {
      hpNote = 'mmap fallback';
    }

    try {
      sendToRenderer('miner-output', {
        stream: 'stdout',
        text: `[Memory] Ekam Deeksha scratchpad: 64 KiB | ${hpNote}\n`
      });
    } catch {
      // ignore
    }
  }

  // Spawn-time diagnostics (helps confirm `npm start` is running the updated main process).
  // Also emitted into miner.log (Open Log File) and the UI Mining Logs.
  try {
    const diag = {
      isPackaged: IS_PACKAGED,
      appRoot: APP_ROOT,
      __dirname,
      resourcesPath: process.resourcesPath,
      execPath: process.execPath,
      processCwd: process.cwd(),
      minerCwd,
      minerPath: MINER_PATH,
      spawnCommand,
      spawnArgs: Array.isArray(spawnArgs) ? spawnArgs.slice(0, 20) : spawnArgs,
      minerExists: fs.existsSync(MINER_PATH),
      aiMiningDirExists: fs.existsSync(path.join(minerCwd, 'ai', 'mining')),
      zionMiningDirExists: fs.existsSync(path.join(minerCwd, 'zion', 'mining')),
      dllExists: {
        cosmic:
          fs.existsSync(path.join(minerCwd, 'ai', 'mining', 'libcosmic_harmony_zion.dll')) ||
          fs.existsSync(path.join(minerCwd, 'zion', 'mining', 'libcosmic_harmony_zion.dll')) ||
          fs.existsSync(path.join(minerCwd, 'libcosmic_harmony_zion.dll')),
        yescrypt:
          fs.existsSync(path.join(minerCwd, 'ai', 'mining', 'libyescrypt_zion.dll')) ||
          fs.existsSync(path.join(minerCwd, 'zion', 'mining', 'libyescrypt_zion.dll')) ||
          fs.existsSync(path.join(minerCwd, 'libyescrypt_zion.dll')),
        randomx:
          fs.existsSync(path.join(minerCwd, 'ai', 'mining', 'librandomx_zion.dll')) ||
          fs.existsSync(path.join(minerCwd, 'zion', 'mining', 'librandomx_zion.dll')) ||
          fs.existsSync(path.join(minerCwd, 'librandomx_zion.dll'))
      },
      nativeLibsDir: fs.existsSync(path.join(minerCwd, 'native-libs')),
      nativeLibCount: (() => {
        try {
          const nlDir = path.join(minerCwd, 'native-libs');
          if (!fs.existsSync(nlDir)) return 0;
          const ext = process.platform === 'darwin' ? '.dylib' : process.platform === 'win32' ? '.dll' : '.so';
          return fs.readdirSync(nlDir).filter(f => f.endsWith(ext)).length;
        } catch { return 0; }
      })(),
      pathPrefix: String(env.PATH || env.Path || '').slice(0, 300)
    };

    spawnDiagLine = `[DIAG] miner-spawn-diag ${JSON.stringify(diag)}\n`;

    // Best-effort: app-level log file
    logApp('miner-spawn-diag', JSON.stringify(diag));

    // Show directly in the UI log so users can paste it easily.
    try {
      sendToRenderer('miner-output', { stream: 'stdout', text: spawnDiagLine });
    } catch {
      // ignore
    }
  } catch {
    // ignore diagnostics failures
  }

  // Ensure execute bit is set on Unix — survives fresh checkouts and packaging.
  if (process.platform !== 'win32') {
    try { require('fs').chmodSync(spawnCommand, 0o755); } catch { /* ignore */ }
  }

  minerProcess = spawn(spawnCommand, spawnArgs, {
    cwd: minerCwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  });

  // Emit miner-started only after the process survives a short grace period.
  // Prevents "started" spam when the miner exits immediately (e.g. bad CLI flags).
  const myStartToken = ++minerStartToken;
  minerStartAckTimer = setTimeout(() => {
    minerStartAckTimer = null;
    if (minerUserStopRequested || minerStopping) return;
    if (!minerProcess) return;
    if (myStartToken !== minerStartToken) return;
    try {
      sendToRenderer('miner-started', {});
    } catch {
      // ignore
    }
    updateTrayMenu(minerStats);
  }, 450);

  // Performance tuning (best-effort): boost priority/affinity on Windows.
  try {
    if (process.platform === 'win32') {
      boostMinerProcessWindows(minerProcess?.pid, config, effectiveThreads);
    }
  } catch {
    // ignore
  }

  // ═══════════════════════════════════════════════════════════════
  // Revenue Process: 2nd miner connecting to the SAME pool with --group revenue.
  // The pool's StreamScheduler assigns revenue-group miners to XMR/RandomX jobs
  // via RevenueProxy (→ MoneroOcean → BTC). No direct external pool connection.
  // Supports both Rust (--group flag) and Python (--group CLI arg) miners.
  // ═══════════════════════════════════════════════════════════════
  const allowRevenueWithMainGpu = String(process.env.ZION_ALLOW_REVENUE_WITH_MAIN_GPU || '1').trim() !== '0';
  const revenueSuppressedForGpuInit = mainMinerGpu && !allowRevenueWithMainGpu;
  const canSpawnRevenue =
    !pureZionMode &&
    !revenueSuppressedForGpuInit &&
    xmrRevenueThreads > 0 &&
    ((MINER_IS_RUST && rustGroupSupported) || MINER_IS_PYTHON);

  // Keep non-overlapping nonce spaces across parallel miner processes.
  // main: random low partition, revenue: +0x40000000, gpu-revenue: +0x80000000
  const revenueEnv = { ...env, ZION_NONCE_BASE: String(sessionNonceBaseRevenue) };
  const gpuRevenueEnv = { ...env, ZION_NONCE_BASE: String(sessionNonceBaseGpuRevenue) };

  if (revenueSuppressedForGpuInit && xmrRevenueThreads > 0) {
    try {
      logApp('revenue-process-skipped', JSON.stringify({
        reason: 'main-gpu-active',
        worker: String(config?.worker || ''),
        threadsRequested: xmrRevenueThreads,
      }));
      sendToRenderer('miner-output', {
        stream: 'stdout',
        text: '[CH3] Revenue CPU process skipped while main GPU mining is active (stability guard). Set ZION_ALLOW_REVENUE_WITH_MAIN_GPU=1 to override.\n'
      });
    } catch {
      // ignore
    }
  }
  if (canSpawnRevenue) {
    try {
      const revenueStatsPath = STATS_PATH.replace(/\.json$/, '_revenue.json');
      let revSpawnCmd, revSpawnArgs;
      if (MINER_IS_PYTHON) {
        const revArgs = [
          MINER_PATH,
          '--algorithm', String(algorithmForMiner || 'cosmic_harmony'),
          '--mode', 'cpu',
          '--pool', `${config.pool.host}:${config.pool.port}`,
          '--wallet', config.wallet || '',
          '--threads', String(xmrRevenueThreads),
          '--group', 'revenue',
          '--stats-file', revenueStatsPath,
          '--stats-interval', String(STATS_INTERVAL_SEC),
        ];
        if (config.worker) revArgs.push('--worker', `${String(config.worker)}_rev`);
        revSpawnCmd = process.platform === 'win32' ? 'python' : 'python3';
        revSpawnArgs = revArgs;
      } else {
        const revenueArgs = [
          '--pool', `stratum+tcp://${config.pool.host}:${config.pool.port}`,
          '--wallet', config.wallet,
          '--threads', String(xmrRevenueThreads),
          '--group', 'revenue',
          // Algorithm is NOT forced here — pool StreamScheduler assigns the best revenue algo.
          '--stats-file', revenueStatsPath,
          '--stats-interval', String(STATS_INTERVAL_SEC),
          '--no-color'
        ];
        if (config.worker) revenueArgs.push('--worker', `${String(config.worker)}_rev`);
        revSpawnCmd = spawnCommand;
        revSpawnArgs = revenueArgs;
      }

      revenueProcess = spawn(revSpawnCmd, revSpawnArgs, {
        cwd: minerCwd,
        env: revenueEnv
      });

      logApp('revenue-process-started', JSON.stringify({
        pid: revenueProcess?.pid,
        threads: xmrRevenueThreads,
        group: 'revenue',
        pool: `${config.pool.host}:${config.pool.port}`
      }));

      try {
        sendToRenderer('miner-output', {
          stream: 'stdout',
          text: `[CH3] Revenue process started (PID ${revenueProcess?.pid}) — 1T → pool g=revenue\n`
        });
      } catch {
        // ignore
      }

      // Pipe revenue process output to the miner log AND renderer console (prefixed)
      revenueProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        safeMinerLogWrite(`[REV-STDOUT] ${output}`);
        try { sendToRenderer('miner-output', { stream: 'stdout', text: `[CH3-REV] ${output}` }); } catch {}
      });
      revenueProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        safeMinerLogWrite(`[REV-STDERR] ${output}`);
        try { sendToRenderer('miner-output', { stream: 'stderr', text: `[CH3-REV] ${output}` }); } catch {}
      });

      revenueProcess.on('error', (err) => {
        console.error('Revenue miner process error:', err);
        revenueProcess = null;
        logApp('revenue-process-error', err?.message || String(err));
      });

      revenueProcess.on('close', (code, signal) => {
        dbg(`Revenue process exited (code=${code} signal=${signal})`);
        revenueProcess = null;
        logApp('revenue-process-exit', JSON.stringify({ code, signal }));
        // If main miner is still running and revenue died unexpectedly, log it
        if (minerProcess && !minerStopping && !minerUserStopRequested && code !== 0) {
          try {
            sendToRenderer('miner-output', {
              stream: 'stderr',
              text: `[CH3] Revenue process exited unexpectedly (code=${code}). DAO revenue paused.\n`
            });
          } catch {
            // ignore
          }
        }
      });
    } catch (err) {
      logApp('revenue-process-spawn-failed', err?.message || String(err));
      revenueProcess = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // GPU Revenue Process: 3rd miner instance for GPU-accelerated revenue mining.
  // macOS (Metal): cosmic_harmony + --gpu (Metal active, ~200 H/s on M1). ✅
  //   Note: Metal bottleneck = 40960 SHA3-512 ops/hash (memory-hard scratchpad).
  //   mine_batch dispatches 1 GPU kernel per call (~2184 threads, ~11s) so the
  //   outer loop checks for new pool jobs every ~11s (no stale share issue).
  // Linux/Win (OpenCL): kawpow (RVN) + --gpu.
  // Only spawns when: gpuRevenue=true, GPU detected, Rust miner, --group supported.
  // ═══════════════════════════════════════════════════════════════
  // IMPORTANT: Do NOT spawn GPU Revenue when the main ZION miner already uses --gpu.
  // Two OpenCL processes on the same GPU cause severe context-switching overhead
  // and can drop hashrate from >100 MH/s to <20 MH/s. GPU is exclusive to one process.
  // GPU Revenue only gets the GPU in 'gpu-revenue' mining mode.
  const gpuRevenueEnabled = !pureZionMode && !!(revenueProfile?.gpu?.enabled || config.gpuRevenue);
  const gpuRevenueAllowed = gpuRevenueEnabled && effectiveGpu && !mainMinerGpu;
  if (gpuRevenueEnabled && mainMinerGpu) {
    // GPU is dedicated to ZION mining — skip GPU Revenue to avoid contention
    logApp('gpu-revenue-skipped', 'GPU dedicated to main ZION miner (mode=' + miningMode + '); GPU Revenue skipped to prevent contention.');
    try {
      sendToRenderer('miner-output', {
        stream: 'stdout',
        text: '[CH3-GPU] GPU dedicated to ZION mining — GPU Revenue skipped (prevents dual-GPU contention).\n'
      });
    } catch { /* ignore */ }
  }
  if (MINER_IS_RUST && gpuRevenueAllowed && rustGroupSupported) {
    try {
      const gpuRevenueStatsPath = STATS_PATH.replace(/\.json$/, '_gpu_revenue.json');
      // Do NOT force algorithm in revenue group.
      // Pool StreamScheduler must choose job/algo (XMR/ERG/RVN/...) to avoid wrong-algo low-diff rejects.
      const gpuRevenueArgs = [
        '--pool', `stratum+tcp://${config.pool.host}:${config.pool.port}`,
        '--wallet', config.wallet,
        '--threads', '1',  // GPU process needs only 1 CPU thread; GPU (Metal/OpenCL) does the heavy work
        '--group', 'revenue',
        '--gpu',   // works on macOS for cosmic_harmony (Metal), and on Linux/Win (OpenCL)
        '--stats-file', gpuRevenueStatsPath,
        '--stats-interval', String(STATS_INTERVAL_SEC),
        '--no-color'
      ];
      if (config.worker) gpuRevenueArgs.push('--worker', `${String(config.worker)}_gpu_rev`);

      gpuRevenueProcess = spawn(spawnCommand, gpuRevenueArgs, {
        cwd: minerCwd,
        env: gpuRevenueEnv
      });

      gpuRevenueHealth = {
        startedAt: Date.now(),
        accepted: 0,
        rejected: 0,
        disabled: false
      };

      const maybeDisableGpuRevenue = (reason) => {
        try {
          if (!gpuRevenueProcess || gpuRevenueHealth.disabled) return;
          if (gpuRevenueHealth.accepted > 0) return;
          if (gpuRevenueHealth.rejected < 8) return;

          const windowMs = Date.now() - Number(gpuRevenueHealth.startedAt || 0);
          if (windowMs > 180000) return;

          gpuRevenueHealth.disabled = true;
          logApp('gpu-revenue-auto-disabled', JSON.stringify({
            reason,
            rejected: gpuRevenueHealth.rejected,
            accepted: gpuRevenueHealth.accepted,
            windowMs
          }));

          try {
            sendToRenderer('miner-output', {
              stream: 'stderr',
              text: '[CH3-GPU] GPU Revenue auto-disabled (repeated rejects, no accepted shares). Main GPU mining continues.\n'
            });
          } catch {
            // ignore
          }

          try {
            if (process.platform === 'win32') {
              gpuRevenueProcess.kill();
            } else {
              gpuRevenueProcess.kill('SIGTERM');
            }
          } catch {
            // ignore
          }
        } catch {
          // ignore
        }
      };

      logApp('gpu-revenue-process-started', JSON.stringify({
        pid: gpuRevenueProcess?.pid,
        algorithm: 'pool-assigned',
        group: 'revenue',
        pool: `${config.pool.host}:${config.pool.port}`
      }));

      try {
        sendToRenderer('miner-output', {
          stream: 'stdout',
          text: `[CH3-GPU] GPU Revenue process started (PID ${gpuRevenueProcess?.pid}) — algo=pool-assigned g=revenue\n`
        });
      } catch {
        // ignore
      }

      gpuRevenueProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (/\baccepted\b/i.test(output)) gpuRevenueHealth.accepted += 1;
        if (/\brejected\b/i.test(output)) gpuRevenueHealth.rejected += 1;
        maybeDisableGpuRevenue('stdout-pattern');
        safeMinerLogWrite(`[GPU-REV-STDOUT] ${output}`);
      });
      gpuRevenueProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        if (/\baccepted\b/i.test(output)) gpuRevenueHealth.accepted += 1;
        if (/\brejected\b/i.test(output)) gpuRevenueHealth.rejected += 1;
        maybeDisableGpuRevenue('stderr-pattern');
        safeMinerLogWrite(`[GPU-REV-STDERR] ${output}`);
      });

      gpuRevenueProcess.on('error', (err) => {
        console.error('GPU Revenue miner process error:', err);
        gpuRevenueProcess = null;
        gpuRevenueHealth = { startedAt: 0, accepted: 0, rejected: 0, disabled: false };
        logApp('gpu-revenue-process-error', err?.message || String(err));
      });

      gpuRevenueProcess.on('close', (code, signal) => {
        dbg(`GPU Revenue process exited (code=${code} signal=${signal})`);
        gpuRevenueProcess = null;
        gpuRevenueHealth = { startedAt: 0, accepted: 0, rejected: 0, disabled: false };
        logApp('gpu-revenue-process-exit', JSON.stringify({ code, signal }));
        if (minerProcess && !minerStopping && !minerUserStopRequested && code !== 0) {
          try {
            sendToRenderer('miner-output', {
              stream: 'stderr',
              text: `[CH3-GPU] GPU Revenue process exited unexpectedly (code=${code}). GPU revenue paused.\n`
            });
          } catch {
            // ignore
          }
        }
      });
    } catch (err) {
      logApp('gpu-revenue-process-spawn-failed', err?.message || String(err));
      gpuRevenueProcess = null;
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // CH3 MULTI-STREAM — Direct external-pool mode
  // When config.gpuRevenueDirectPool === true (or ZION_GPU_DIRECT_POOL=1),
  // spawn a SEPARATE GPU miner that connects DIRECTLY to the best external pool
  // (e.g. etc.2miners.com:1010) instead of routing through the ZION pool.
  // This enables TRUE dual/triple mining without needing the pool server running:
  //   Stream 1 (50%): ZION CPU → ZION pool   (main miner process, above)
  //   Stream 2 (25%): GPU → external coin pool (this block, direct connection)
  //   Stream 3 (25%): CPU → ZION pool --group revenue → XMR (revenue process, above)
  // ────────────────────────────────────────────────────────────────────────
  const gpuDirectPoolMode = !pureZionMode && (
    config.gpuRevenueDirectPool === true ||
    String(process.env.ZION_GPU_DIRECT_POOL || '').trim() === '1'
  );

  if (MINER_IS_RUST && gpuDirectPoolMode && effectiveGpu && !mainMinerGpu && !gpuRevenueProcess) {
    // Not yet spawned by pool-routed path (gpuRevenueProcess still null), spawn directly
    try {
      const directCoin = String(
        config.gpuRevenueCoin ||
        process.env.ZION_DIRECT_GPU_COIN ||
        multiStreamCurrentCoin ||
        'ETC'
      ).toUpperCase();
      multiStreamCurrentCoin = directCoin;
      multiStreamStatus.gpuCoin.directPool = true;
      multiStreamStatus.gpuCoin.name = directCoin;

      const gpuDirectEnv = { ...env, ZION_NONCE_BASE: String(sessionNonceBaseGpuRevenue) };
      gpuRevenueHealth = { startedAt: Date.now(), accepted: 0, rejected: 0, disabled: false };
      gpuRevenueProcess = spawnGpuRevenueDirect(directCoin, config, spawnCommand, minerCwd, gpuDirectEnv);
      wireGpuRevenueDirectProcess(gpuRevenueProcess, 'GPU-REV-DIRECT');

      logApp('multi-stream-direct-pool-started', JSON.stringify({
        pid: gpuRevenueProcess?.pid,
        coin: directCoin,
        pool: GPU_COIN_POOLS[directCoin]?.pool || 'unknown',
      }));
      try {
        sendToRenderer('miner-output', {
          stream: 'stdout',
          text: `[CH3-MULTI] Direct-pool GPU stream started: coin=${directCoin} pool=${GPU_COIN_POOLS[directCoin]?.pool || '?'} PID=${gpuRevenueProcess?.pid}\n`
        });
      } catch {}
    } catch (err) {
      logApp('multi-stream-direct-pool-spawn-failed', err?.message || String(err));
      gpuRevenueProcess = null;
    }
  }

  // ── Emit initial multi-stream status + start profit-status poll ──────────
  // Profit poll fetches /api/v1/profit/status from the ZION pool every 60 s.
  // Used for: 1) UI display of current best coin  2) auto-switch in direct-pool mode
  {
    const poolApiHost = String(config?.pool?.host || '127.0.0.1').trim();
    const poolApiPort = Number(config?.pool?.apiPort || process.env.ZION_POOL_API_PORT || 8080);
    multiStreamStatus.active = !!(minerProcess || revenueProcess || gpuRevenueProcess);
    sendToRenderer('multi-stream-status', buildMultiStreamPayload());
    if (!pureZionMode) {
      startProfitPoll(poolApiHost, poolApiPort, spawnCommand, minerCwd, config, env);
    }
    logApp('multi-stream-started', JSON.stringify({
      zion: !!minerProcess, gpuCoin: multiStreamCurrentCoin, gpuDirect: gpuDirectPoolMode,
      revenueCpu: !!revenueProcess, gpuRevenue: !!gpuRevenueProcess,
    }));
    try {
      const streamDesc = [
        minerProcess  ? `ZION(${effectiveThreads}T)` : null,
        gpuRevenueProcess ? `GPU:${multiStreamCurrentCoin}` : null,
        revenueProcess ? 'XMR(CPU)' : null,
      ].filter(Boolean).join(' + ') || 'single';
      sendToRenderer('miner-output', {
        stream: 'stdout',
        text: pureZionMode
          ? `[CH3-MULTI] Active streams: ${streamDesc} — pure ZION mode\n`
          : `[CH3-MULTI] Active streams: ${streamDesc} — profit-switch poll: ${poolApiHost}:${poolApiPort}\n`
      });
    } catch {}
  }

  // Start Afterburner service (best-effort, non-blocking) when enabled.
  if (config.aiAfterburner !== false) {
    void ensureAfterburnerServiceRunning()
      .then(() => afterburnerSend({ cmd: 'start' }))
      .catch((err) => {
        try {
          sendToRenderer('miner-output', {
            stream: 'stderr',
            text: `[afterburner] failed to start: ${err?.message || String(err)}\n`
          });
        } catch {
          // ignore
        }
      });
  }

  minerProcess.on('error', (err) => {
    console.error('Failed to start miner process:', err);
    minerProcess = null;

    let defenderBlocked = false;
    try {
      const msg = err?.message || String(err);
      if (
        process.platform === 'win32' &&
        (
          /virus|potenciálně\s+nežádouc|potentially\s+unwanted|pua|blocked\s+by\s+antivirus/i.test(msg) ||
          /EACCES/i.test(msg) ||
          (err?.code === 'EACCES') ||
          (typeof err?.errno === 'number' && (err.errno === -4048 || err.errno === 5))
        )
      ) {
        defenderBlocked = true;
        const base =
          `[ERROR] Rust miner was blocked by Windows Defender/AV (PUA detection). ` +
          `Allow/restore the miner exe and add an exclusion for the resources folder.`;
        const extra = fallbackPythonPath
          ? ' Falling back to Python miner if available.'
          : ' Python fallback is not available on this installation.';

        minerBackendLastError = base + extra;

        // Persist fallback backend to avoid repeated Rust spawn failures
        // on every app start while Defender/AV keeps blocking the binary.
        if (fallbackPythonPath) {
          try {
            const persisted = loadConfig();
            if (String(persisted?.minerBackend || '').toLowerCase() !== 'python') {
              persisted.minerBackend = 'python';
              saveConfig(persisted);
              sendToRenderer('miner-output', {
                stream: 'stderr',
                text: '[WARN] Backend switched to Python in config due to Defender block. Switch back to Rust after adding Defender exclusion.\n'
              });
            }
          } catch {
            // ignore
          }
        }

        try {
          sendToRenderer('miner-backend', {
            preferred: minerBackendPreferred,
            resolved: minerBackendResolved,
            path: minerBackendPath,
            lastError: minerBackendLastError
          });
        } catch {
          // ignore
        }
        sendToRenderer('miner-output', { stream: 'stderr', text: `${minerBackendLastError}\n` });
      }
    } catch {
      // ignore
    }

    try {
      if (minerStartAckTimer) clearTimeout(minerStartAckTimer);
    } catch {
      // ignore
    }
    minerStartAckTimer = null;

    if (maybeFallbackToPython(`spawn error: ${err?.message || String(err)}`, defenderBlocked)) {
      return;
    }

    try {
      minerBackendLastError = `Miner spawn failed: ${err?.message || String(err)}`;
      sendToRenderer('miner-backend', {
        preferred: minerBackendPreferred,
        resolved: minerBackendResolved,
        path: minerBackendPath,
        lastError: minerBackendLastError
      });
    } catch {
      // ignore
    }
    sendToRenderer('miner-error', { message: err.message });
    sendToRenderer('miner-stopped', { code: -1 });
    updateTrayMenu(minerStats);
  });

  // Log output
  // Prevent log files from growing without bound (esp. if miner is too chatty).
  try {
    safeMinerLogWrite(
      `\n===== MINER START ${new Date().toISOString()} algorithm=${config.algorithm || ''} mode=${config.gpu ? 'gpu' : 'cpu'} =====\n`
    );
    if (spawnDiagLine) {
      safeMinerLogWrite(spawnDiagLine);
    }
    if (randomxAutoMessage) {
      safeMinerLogWrite(`[INFO] ${randomxAutoMessage}\n`);
    }
  } catch {
    // ignore
  }

  const shouldSkipFileLogLine = (text) => {
    // Prevent massive log growth from ultra-frequent debug spam.
    if (/^\s*DEBUG:\s*Using C\+\+ library for hash\s*$/i.test(String(text).trim())) return true;
    // GPU→CPU VERIFY blocks: 7-line blocks emitted for every GPU nonce check (~76% of all output).
    // They contain: nonce_u64, gpu_hash, cpu_hash, MATCH=, gpu_state0, cpu_meets_target, blob_len
    if (/GPU.*CPU VERIFY|nonce_u64=|gpu_hash=|cpu_hash=|\bMATCH=|gpu_state0=|cpu_meets_target/i.test(text)) return true;
    // Overflow check lines
    if (/nonce_as_u32=.*overflow=/i.test(text)) return true;
    return false;
  };

  const maybeEmitBlockFound = (text) => {
    // Miner prints: "KWIIIIK KEPORKAK NASEL BLOK <height> !!!"
    const m = text.match(/KEPORKAK\s+NASEL\s+BLOK\s+(\d+)/i);
    if (m) {
      const height = parseInt(m[1], 10);
      sendToRenderer('block-found', { height });
      // OS notification so user sees it even if minimized
      try {
        const { Notification: ElNotification } = require('electron');
        if (ElNotification.isSupported()) {
          new ElNotification({
            title: '⛏️ ZION Block Found!',
            body: `Block #${height} mined successfully!`,
            silent: false
          }).show();
        }
      } catch { /* ignore */ }
      return;
    }
    if (/block_found/i.test(text) || /BLOCK\s+FOUND/i.test(text)) {
      sendToRenderer('block-found', {});
      try {
        const { Notification: ElNotification } = require('electron');
        if (ElNotification.isSupported()) {
          new ElNotification({
            title: '⛏️ ZION Block Found!',
            body: 'New block mined!',
            silent: false
          }).show();
        }
      } catch { /* ignore */ }
    }
  };
  
  minerProcess.stdout.on('data', (data) => {
    rotateFileIfTooLarge(LOG_PATH, MAX_MINER_LOG_BYTES, MAX_MINER_LOG_BACKUPS, MAX_MINER_LOG_AGE_MS);
    const output = data.toString();
    const skip = shouldSkipFileLogLine(output);
    if (!skip) {
      safeMinerLogWrite(`[STDOUT] ${output}`);
    }
    if (!skip) enqueueMinerOutputToRenderer('stdout', output);
    maybeEmitBlockFound(output);
    parseMinerOutput(output);
    maybeTriggerRustGpuNoDeviceFallback(output);
    maybeFallbackOnHighRejectRate(output);
  });

  minerProcess.stderr.on('data', (data) => {
    const output = data.toString();
    const skip = shouldSkipFileLogLine(output);
    if (!skip) {
      safeMinerLogWrite(`[STDERR] ${output}`);
    }
    if (!skip) enqueueMinerOutputToRenderer('stderr', output);
    maybeEmitBlockFound(output);
    parseMinerOutput(output);
    maybeTriggerRustGpuNoDeviceFallback(output);
    maybeFallbackOnHighRejectRate(output);
  });

  minerProcess.on('close', (code, signal) => {
    flushBufferedFileAppendsSync();
    console.log(`Miner process exited with code ${code}${signal ? ` signal=${signal}` : ''}`);
    minerProcess = null;

    try {
      if (minerStartAckTimer) clearTimeout(minerStartAckTimer);
    } catch {
      // ignore
    }
    minerStartAckTimer = null;
    try {
      if (minerGpuInitWatchdogTimer) clearTimeout(minerGpuInitWatchdogTimer);
    } catch {
      // ignore
    }
    minerGpuInitWatchdogTimer = null;

    // Flush any buffered output before reporting stopped.
    flushMinerOutputToRenderer();
    
    minerStats = { ...minerStats, hashrate: 0 };
    updateTrayMenu(minerStats);

    // Always notify UI first; fallback (if any) happens after.
    try {
      sendToRenderer('miner-stopped', { code, signal: signal || null });
    } catch {
      // ignore
    }

    // Exit code 5 on Windows = ERROR_ACCESS_DENIED — most common Defender kill signature.
    const defenderExitCode = process.platform === 'win32' && (code === 5 || code === 0xC0000005 || code === -1073741819);
    if (
      rustFallbackEligible &&
      !minerStopping &&
      !minerUserStopRequested &&
      code !== 0 &&
      (Date.now() - minerStartTs < 8000 || defenderExitCode)
    ) {
      void maybeFallbackToPython(`exit code ${code}${signal ? ` signal=${signal}` : ''}`, defenderExitCode);
    }
    if (!minerStopping && !minerUserStopRequested && code !== 0 && !rustFallbackEligible) {
      try {
        minerBackendLastError = `Miner exited (code ${code}${signal ? ` signal=${signal}` : ''}).`;
        sendToRenderer('miner-backend', {
          preferred: minerBackendPreferred,
          resolved: minerBackendResolved,
          path: minerBackendPath,
          lastError: minerBackendLastError
        });
      } catch {
        // ignore
      }
    }
    if (process.platform === 'darwin' && code === 133 && MINER_IS_PYTHON) {
      sendToRenderer('miner-error', {
        message:
          'Miner se ukončil kódem 133 (macOS). To typicky znamená problém s nativní knihovnou. Doporučení: použij Rust miner build, nebo aktualizuj native libs (CHv3) a spusť znovu.'
      });
    }
    // (miner-stopped already emitted above)

    // ── Pool Failover Watchdog ──────────────────────────────────────────
    // If the miner crashed (non-zero exit) and user didn't stop it, try
    // switching to a different pool server and auto-restarting.
    if (
      !minerStopping &&
      !minerUserStopRequested &&
      code !== 0 &&
      !rustFallbackEligible &&
      poolFailoverCount < POOL_FAILOVER_MAX
    ) {
      poolFailoverCount++;
      console.log(`[pool-failover] Failover ${poolFailoverCount}/${POOL_FAILOVER_MAX} — restarting in ${POOL_FAILOVER_DELAY_MS / 1000}s`);
      try {
        sendToRenderer('miner-output', {
          stream: 'stdout',
          data: `[FAILOVER] Pool connection lost — switching to best available pool (${poolFailoverCount}/${POOL_FAILOVER_MAX})...\n`
        });
      } catch { /* ignore */ }

      if (poolFailoverTimer) clearTimeout(poolFailoverTimer);
      poolFailoverTimer = setTimeout(async () => {
        try {
          const best = await autoSelectBestPool();
          if (best) {
            dbg(`[pool-failover] Restarting with pool: ${best.name} (${best.host})`);
            const cfg = loadConfig();
            startMining(cfg);
            try {
              sendToRenderer('config-updated');
              sendToRenderer('miner-output', {
                stream: 'stdout',
                data: `[FAILOVER] Restarted mining on pool ${best.host}\n`
              });
            } catch { /* ignore */ }
          } else {
            dbg('[pool-failover] No online pools found. Giving up.');
            try {
              sendToRenderer('miner-error', {
                message: 'Failover failed — no reachable pool servers. Check network or restart manually.'
              });
            } catch { /* ignore */ }
          }
        } catch (err) {
          console.error('[pool-failover] Error during failover:', err.message);
        }
      }, POOL_FAILOVER_DELAY_MS);
    }
  });

  // miner-started is emitted after a short grace period
  updateTrayMenu(minerStats);

  // Dev-only helper: allow automated stop for regression tests (set ZION_AUTOSTOP_MS).
  const autoStopMsRaw = process.env.ZION_AUTOSTOP_MS;
  const autoStopMs = autoStopMsRaw ? Number(autoStopMsRaw) : 0;
  if (autoStopMs > 0 && Number.isFinite(autoStopMs)) {
    minerAutoStopTimer = setTimeout(() => {
      try {
        sendToRenderer('miner-output', {
          stream: 'stdout',
          text: `[INFO] ZION_AUTOSTOP_MS=${autoStopMs} → auto-stop triggered\n`
        });
      } catch {
        // ignore
      }
      stopMining();
    }, autoStopMs);
  }

  return { success: true };
}

function ensureAfterburnerServiceRunning() {
  return new Promise((resolve, reject) => {
    try {
      if (afterburnerProc && afterburnerReady) return resolve(true);

      if (!fs.existsSync(AFTERBURNER_SCRIPT_PATH)) {
        return reject(new Error(`Afterburner service not found at: ${AFTERBURNER_SCRIPT_PATH}`));
      }

      if (afterburnerProc) {
        // Process exists but not ready yet.
        const t = setTimeout(() => reject(new Error('Afterburner service startup timed out')), 4000);
        const check = () => {
          if (afterburnerReady) {
            clearTimeout(t);
            resolve(true);
          } else {
            setTimeout(check, 100);
          }
        };
        check();
        return;
      }

      afterburnerReady = false;
      afterburnerStdoutBuf = '';
      afterburnerQueue = [];

      const cwd = IS_PACKAGED ? process.resourcesPath : path.join(APP_ROOT, '..');
      const cmd = process.platform === 'darwin' ? 'python3' : 'python';

      // Ensure afterburner wrapper can import ai/ modules in both dev + packaged.
      const scriptDir = path.dirname(AFTERBURNER_SCRIPT_PATH);
      const repoRoot = IS_PACKAGED ? process.resourcesPath : path.join(APP_ROOT, '..');
      const existingPyPath = process.env.PYTHONPATH || '';
      const pyPathParts = [repoRoot, scriptDir].filter(Boolean);
      const pyPath = pyPathParts.join(path.delimiter) + (existingPyPath ? path.delimiter + existingPyPath : '');

      afterburnerProc = spawn(cmd, [AFTERBURNER_SCRIPT_PATH], {
        cwd,
        env: {
          ...process.env,
          PYTHONUTF8: '1',
          PYTHONIOENCODING: 'utf-8',
          PYTHONUNBUFFERED: '1',
          PYTHONPATH: pyPath,
          ZION_USER_DATA: USER_DATA_PATH,   // lets Python find miner_stats.json
        }
      });

      attachChildStreamGuards(afterburnerProc, 'afterburner');

      afterburnerProc.on('error', (err) => {
        afterburnerProc = null;
        afterburnerReady = false;
        reject(err);
      });

      const failAllPending = (error) => {
        const q = afterburnerQueue.slice();
        afterburnerQueue = [];
        for (const item of q) {
          try {
            item.reject(error);
          } catch {
            // ignore
          }
        }
      };

      afterburnerProc.on('close', (code) => {
        const err = new Error(`Afterburner service exited (code ${code})`);
        afterburnerProc = null;
        afterburnerReady = false;
        failAllPending(err);
      });

      afterburnerProc.stderr.on('data', (d) => {
        const text = d.toString();
        try {
          sendToRenderer('miner-output', { stream: 'stderr', text: `[afterburner] ${text}` });
        } catch {
          // ignore
        }
      });

      afterburnerProc.stdout.on('data', (d) => {
        afterburnerStdoutBuf += d.toString();
        while (true) {
          const idx = afterburnerStdoutBuf.indexOf('\n');
          if (idx < 0) break;
          const line = afterburnerStdoutBuf.slice(0, idx).trim();
          afterburnerStdoutBuf = afterburnerStdoutBuf.slice(idx + 1);
          if (!line) continue;

          let msg;
          try {
            msg = JSON.parse(line);
          } catch {
            continue;
          }

          if (!afterburnerReady && msg?.ok === true && msg?.status === 'ready') {
            afterburnerReady = true;
            resolve(true);
            continue;
          }

          // If service reports an error before becoming ready, fail fast.
          if (!afterburnerReady && msg?.ok === false) {
            const err = new Error(msg?.error || 'Afterburner failed to start');
            try {
              logApp('afterburner-start-failed', JSON.stringify({ error: err.message }));
            } catch {
              // ignore
            }
            try {
              sendToRenderer('miner-output', { stream: 'stderr', text: `[afterburner] ${err.message}\n` });
            } catch {
              // ignore
            }
            try {
              afterburnerProc?.kill('SIGTERM');
            } catch {
              // ignore
            }
            reject(err);
            return;
          }

          const pending = afterburnerQueue.shift();
          if (pending) pending.resolve(msg);
        }
      });

      // Wait briefly for ready line.
      const t = setTimeout(() => {
        if (!afterburnerReady) reject(new Error('Afterburner service startup timed out'));
      }, 12000);
      const check = () => {
        if (afterburnerReady) {
          clearTimeout(t);
          resolve(true);
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    } catch (err) {
      reject(err);
    }
  });
}

function afterburnerSend(payload) {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureAfterburnerServiceRunning();
      if (!afterburnerProc || !afterburnerProc.stdin?.writable) {
        return reject(new Error('Afterburner service not running'));
      }

      const id = afterburnerReqId++;
      const req = { id, ...payload };
      afterburnerQueue.push({ resolve, reject });
      const ok = safeChildStdinWrite(afterburnerProc, 'afterburner', `${JSON.stringify(req)}\n`);
      if (!ok) {
        afterburnerQueue.pop();
        return reject(new Error('Afterburner stdin is closed'));
      }
    } catch (err) {
      reject(err);
    }
  });
}

async function stopAfterburnerService() {
  try {
    if (!afterburnerProc) return;
    try {
      await afterburnerSend({ cmd: 'stop' });
    } catch {
      // ignore
    }
    try {
      afterburnerProc.kill('SIGTERM');
    } catch {
      // ignore
    }
  } finally {
    afterburnerProc = null;
    afterburnerReady = false;
    afterburnerStdoutBuf = '';
    afterburnerQueue = [];
  }
}

// ============================================================================
// AI NATIVE SERVICE (parallel to afterburner)
// ============================================================================

const AI_NATIVE_BRIDGE_PATH = IS_PACKAGED
  ? path.join(process.resourcesPath, 'ai_native_client.py')
  : path.join(APP_ROOT, 'resources', 'ai_native_client.py');

function ensureAiNativeServiceRunning() {
  return new Promise((resolve, reject) => {
    try {
      if (aiNativeProc && aiNativeReady) return resolve(true);

      if (!fs.existsSync(AI_NATIVE_BRIDGE_PATH)) {
        return reject(new Error(`AI Native bridge not found at: ${AI_NATIVE_BRIDGE_PATH}`));
      }

      if (aiNativeProc) {
        // Process exists but not ready yet
        const t = setTimeout(() => reject(new Error('AI Native service startup timed out')), 4000);
        const check = () => {
          if (aiNativeReady) {
            clearTimeout(t);
            resolve(true);
          } else {
            setTimeout(check, 100);
          }
        };
        check();
        return;
      }

      aiNativeReady = false;
      aiNativeStdoutBuf = '';
      aiNativeQueue = [];

      const cwd = IS_PACKAGED ? process.resourcesPath : path.join(APP_ROOT, '..');
      const cmd = process.platform === 'darwin' ? 'python3' : 'python';

      const scriptDir = path.dirname(AI_NATIVE_BRIDGE_PATH);
      const repoRoot = IS_PACKAGED ? process.resourcesPath : path.join(APP_ROOT, '..');
      const existingPyPath = process.env.PYTHONPATH || '';
      const pyPathParts = [repoRoot, scriptDir].filter(Boolean);
      const pyPath = pyPathParts.join(path.delimiter) + (existingPyPath ? path.delimiter + existingPyPath : '');

      aiNativeProc = spawn(cmd, [AI_NATIVE_BRIDGE_PATH], {
        cwd,
        env: {
          ...process.env,
          PYTHONUTF8: '1',
          PYTHONIOENCODING: 'utf-8',
          PYTHONUNBUFFERED: '1',
          PYTHONPATH: pyPath
        }
      });

      attachChildStreamGuards(aiNativeProc, 'ai-native');

      aiNativeProc.on('error', (err) => {
        aiNativeProc = null;
        aiNativeReady = false;
        reject(err);
      });

      const failAllPending = (error) => {
        const q = aiNativeQueue.slice();
        aiNativeQueue = [];
        for (const item of q) {
          try {
            item.reject(error);
          } catch {}
        }
      };

      aiNativeProc.on('close', (code) => {
        const err = new Error(`AI Native service exited (code ${code})`);
        aiNativeProc = null;
        aiNativeReady = false;
        failAllPending(err);
      });

      aiNativeProc.stderr.on('data', (d) => {
        const text = d.toString();
        try {
          sendToRenderer('miner-output', { stream: 'stderr', text: `[ai-native] ${text}` });
        } catch {}
      });

      aiNativeProc.stdout.on('data', (d) => {
        aiNativeStdoutBuf += d.toString();
        while (true) {
          const idx = aiNativeStdoutBuf.indexOf('\n');
          if (idx < 0) break;
          const line = aiNativeStdoutBuf.slice(0, idx).trim();
          aiNativeStdoutBuf = aiNativeStdoutBuf.slice(idx + 1);
          if (!line) continue;

          let msg;
          try {
            msg = JSON.parse(line);
          } catch {
            continue;
          }

          if (!aiNativeReady && (msg?.status === 'ready' || msg?.type === 'ready')) {
            aiNativeReady = true;
            sendToRenderer('ai-native-ready', { server: msg.server || {} });
            continue;
          }

          if (msg?.type === 'response' || (!msg?.type && !msg?.error)) {
            const pending = aiNativeQueue.shift();
            if (pending) pending.resolve(msg.data || msg);
          } else if (msg?.type === 'error' || msg?.error) {
            const pending = aiNativeQueue.shift();
            if (pending) pending.reject(new Error(msg.message || msg.error || 'AI Native error'));
          }
        }
      });

      // Wait for ready
      const t = setTimeout(() => {
        if (!aiNativeReady) reject(new Error('AI Native service startup timed out'));
      }, 12000);
      const check = () => {
        if (aiNativeReady) {
          clearTimeout(t);
          resolve(true);
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    } catch (err) {
      reject(err);
    }
  });
}

function aiNativeSend(payload) {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureAiNativeServiceRunning();
      if (!aiNativeProc || !aiNativeProc.stdin?.writable) {
        return reject(new Error('AI Native service not running'));
      }

      aiNativeQueue.push({ resolve, reject });
      const ok = safeChildStdinWrite(aiNativeProc, 'ai-native', `${JSON.stringify(payload)}\n`);
      if (!ok) {
        aiNativeQueue.pop();
        return reject(new Error('AI Native stdin is closed'));
      }
    } catch (err) {
      reject(err);
    }
  });
}

async function stopAiNativeService() {
  try {
    if (!aiNativeProc) return;
    try {
      await aiNativeSend({ cmd: 'stop' });
    } catch {}
    try {
      aiNativeProc.kill('SIGTERM');
    } catch {}
  } finally {
    aiNativeProc = null;
    aiNativeReady = false;
    aiNativeStdoutBuf = '';
    aiNativeQueue = [];
  }
}

// ============================================================================
// STATS AND MINING
// ============================================================================

function tryUpdateStatsFromFile() {
  try {
    if (!fs.existsSync(STATS_PATH)) return false;
    const raw = fs.readFileSync(STATS_PATH, 'utf8');
    if (!raw) return false;
    const payload = JSON.parse(raw);

    // Map miner stats-file payload to desktop agent stats
    const toNum = (v) => {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string' && v.trim() !== '') {
        const n = Number(v);
        if (Number.isFinite(n)) return n;
      }
      return null;
    };

    // Prefer short rolling window hashrate for UI stability/real-time fidelity.
    // Lifetime average (`payload.hashrate`) can lag heavily and diverge from pool view.
    const hr10 = toNum(payload.hashrate_10s);
    const hrWindow = toNum(payload.hashrate_window_hs);
    const hr = toNum(payload.hashrate);
    const hrCpu = toNum(payload.hashrate_cpu);
    const hrGpu = toNum(payload.hashrate_gpu);
    if (hr10 != null) minerStats.hashrate = hr10;
    else if (hrWindow != null) minerStats.hashrate = hrWindow;
    else if (hr != null) minerStats.hashrate = hr;
    else if (hrCpu != null || hrGpu != null) minerStats.hashrate = (hrCpu || 0) + (hrGpu || 0);

    // XMRig-style rolling window hashrates (v2.9.5+)
    const hr60 = toNum(payload.hashrate_60s);
    const hr15 = toNum(payload.hashrate_15m);
    const hrMax = toNum(payload.hashrate_max);
    if (hr10 != null) minerStats.hashrate_10s = hr10;
    if (hr60 != null) minerStats.hashrate_60s = hr60;
    if (hr15 != null) minerStats.hashrate_15m = hr15;
    if (hrMax != null) minerStats.hashrate_max = hrMax;
    if (hrCpu != null) minerStats.hashrate_cpu = hrCpu;
    if (hrGpu != null) minerStats.hashrate_gpu = hrGpu;

    // Enhanced stats (v2.9.5+)
    if (typeof payload.difficulty === 'number') minerStats.difficulty = payload.difficulty;
    if (typeof payload.best_share_diff === 'number') minerStats.best_share_diff = payload.best_share_diff;
    if (typeof payload.pool_height === 'number') minerStats.last_job_height = String(payload.pool_height);
    if (typeof payload.pool_latency_ms === 'number') minerStats.pool_latency_ms = payload.pool_latency_ms;
    if (typeof payload.blocks_found === 'number') minerStats.blocks_found = payload.blocks_found;
    if (typeof payload.total_hashes === 'number') minerStats.total_hashes = payload.total_hashes;
    else if (typeof payload.hashes_total === 'number') minerStats.total_hashes = payload.hashes_total;
    if (typeof payload.algorithm === 'string') minerStats.stream_algorithm = payload.algorithm;
    if (typeof payload.worker === 'string') minerStats.worker = payload.worker;
    if (typeof payload.gpu_name === 'string' && payload.gpu_name !== 'none') minerStats.gpu_info = payload.gpu_name;
    if (typeof payload.backend === 'string') {
      const runtimeBackend = String(payload.backend || '').toLowerCase();
      minerStats.runtime_backend = runtimeBackend;
      const resolvedBackend = mapDeekshaRuntimeBackend(runtimeBackend);
      syncDeekshaResolvedBackend(runtimeBackend);
      if (resolvedBackend === 'ekam-native' || resolvedBackend === 'ekam-fallback') {
        minerStats.gpu_detected = false;
        minerStats.gpu_type = 'none';
        minerStats.hashrate_gpu = 0;
      } else if (resolvedBackend) {
        minerStats.gpu_detected = true;
        minerStats.gpu_type = resolvedBackend.replace(/^ekam-/, '');
      }
    }
    if (typeof payload.cpu_threads === 'number') minerStats.cpu_threads = payload.cpu_threads;
    if (typeof payload.connection_count === 'number') minerStats.connection_count = payload.connection_count;
    if (Array.isArray(payload.threads)) minerStats.thread_snapshots = payload.threads;

    if (typeof payload.shares_sent === 'number') minerStats.shares = payload.shares_sent;
    if (typeof payload.shares_accepted === 'number') minerStats.accepted = payload.shares_accepted;
    if (typeof payload.shares_rejected === 'number') minerStats.rejected = payload.shares_rejected;
    else if (typeof payload.shares === 'number') minerStats.shares = payload.shares;
    if (typeof payload.uptime_sec === 'number') minerStats.uptime = Math.floor(payload.uptime_sec);

    return true;
  } catch (err) {
    // Ignore stats parsing issues; keep UI responsive
    return false;
  }
}

function tryUpdateRevenueStatsFromFile() {
  const toNum = (v) => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v); if (Number.isFinite(n)) return n;
    }
    return null;
  };
  try {
    const cpuPath = STATS_PATH.replace(/\.json$/, '_revenue.json');
    if (fs.existsSync(cpuPath)) {
      const p = JSON.parse(fs.readFileSync(cpuPath, 'utf8'));
      const hr = toNum(p.hashrate_10s) ?? toNum(p.hashrate_window_hs) ?? toNum(p.hashrate);
      if (hr != null) revenueHashrateCpu = hr;
    }
  } catch { /* ignore */ }
  try {
    const gpuPath = STATS_PATH.replace(/\.json$/, '_gpu_revenue.json');
    if (fs.existsSync(gpuPath)) {
      const p = JSON.parse(fs.readFileSync(gpuPath, 'utf8'));
      const hr = toNum(p.hashrate_10s) ?? toNum(p.hashrate_window_hs) ?? toNum(p.hashrate);
      if (hr != null) revenueHashrateGpu = hr;
    }
  } catch { /* ignore */ }
}

async function stopMiningAsync() {
  minerUserStopRequested = true;
  minerStartToken += 1;

  try {
    if (minerFallbackTimer) clearTimeout(minerFallbackTimer);
  } catch {
    // ignore
  }
  minerFallbackTimer = null;
  try {
    if (minerStartAckTimer) clearTimeout(minerStartAckTimer);
  } catch {
    // ignore
  }
  minerStartAckTimer = null;
  try {
    if (minerGpuInitWatchdogTimer) clearTimeout(minerGpuInitWatchdogTimer);
  } catch {
    // ignore
  }
  minerGpuInitWatchdogTimer = null;

  if (!minerProcess) {
    return { success: true, alreadyStopped: true };
  }

  if (minerStopping && minerStopPromise) {
    return minerStopPromise;
  }

  minerStopping = true;
  const proc = minerProcess;

  // Update UI immediately so Stop feels responsive.
  try {
    sendToRenderer('miner-output', { stream: 'stdout', text: '[INFO] Stopping miner...\n' });
  } catch {
    // ignore
  }

  minerStopPromise = new Promise((resolve) => {
    let finished = false;

    const finish = (result) => {
      if (finished) return;
      finished = true;
      minerStopping = false;
      minerStopPromise = null;
      resolve(result);
    };

    const timers = [];
    const clearAllTimers = () => {
      while (timers.length) {
        try {
          clearTimeout(timers.pop());
        } catch {
          // ignore
        }
      }
    };

    const runChildCapture = (cmd, args, label, meta) => {
      try {
        const child = spawn(cmd, args, { windowsHide: true });
        let stdout = '';
        let stderr = '';

        const cap = (s) => {
          // Keep logs bounded.
          const str = String(s || '');
          return str.length > 4000 ? str.slice(0, 4000) + '…' : str;
        };

        child.stdout?.on('data', (d) => {
          stdout += d.toString();
          if (stdout.length > 8000) stdout = stdout.slice(-8000);
        });
        child.stderr?.on('data', (d) => {
          stderr += d.toString();
          if (stderr.length > 8000) stderr = stderr.slice(-8000);
        });

        child.once('error', (err) => {
          logApp(`${label}-error`, JSON.stringify({ ...(meta || {}), error: err?.message || String(err) }));
        });
        child.once('exit', (code) => {
          logApp(
            `${label}-exit`,
            JSON.stringify({ ...(meta || {}), code, stdout: cap(stdout).trim(), stderr: cap(stderr).trim() })
          );
        });
        return child;
      } catch (err) {
        logApp(`${label}-fatal`, JSON.stringify({ ...(meta || {}), error: err?.message || String(err) }));
        return null;
      }
    };

    const isProcessAlive = async (pid) => {
      if (!pid) return false;
      try {
        process.kill(pid, 0);
        return true;
      } catch (e) {
        const code = e && e.code;
        if (code === 'ESRCH') return false;
      }

      if (process.platform !== 'win32') return true;

      // Avoid tasklist locale parsing; use PowerShell Get-Process.
      try {
        const systemRoot = process.env.SystemRoot || 'C:\\Windows';
        const psExe = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
        const cmd = fs.existsSync(psExe) ? psExe : 'powershell';
        const out = execFileSync(
          cmd,
          [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            `if (Get-Process -Id ${Number(pid)} -ErrorAction SilentlyContinue) { '1' } else { '0' }`
          ],
          { encoding: 'utf8' }
        );
        return String(out || '').trim() === '1';
      } catch {
        return true;
      }
    };

    const tryTaskkillPid = (pid, label) => {
      try {
        if (!pid) return;
        const systemRoot = process.env.SystemRoot || 'C:\\Windows';
        const taskkillExe = path.join(systemRoot, 'System32', 'taskkill.exe');
        const cmd = fs.existsSync(taskkillExe) ? taskkillExe : 'taskkill';
        const args = ['/PID', String(pid), '/T', '/F'];
        logApp('taskkill-invoke', JSON.stringify({ pid, label, cmd, args }));
        runChildCapture(cmd, args, 'taskkill', { pid, label });
      } catch (err) {
        logApp('taskkill-fatal', err?.message || String(err));
      }
    };

    const tryTaskkillImage = (imageName, label) => {
      try {
        const systemRoot = process.env.SystemRoot || 'C:\\Windows';
        const taskkillExe = path.join(systemRoot, 'System32', 'taskkill.exe');
        const cmd = fs.existsSync(taskkillExe) ? taskkillExe : 'taskkill';
        const args = ['/IM', String(imageName), '/T', '/F'];
        logApp('taskkill-invoke', JSON.stringify({ imageName, label, cmd, args }));
        runChildCapture(cmd, args, 'taskkill', { imageName, label });
      } catch (err) {
        logApp('taskkill-fatal', err?.message || String(err));
      }
    };

    const powershellKillMinerByStatsFile = (statsPath, label) => {
      try {
        if (process.platform !== 'win32') return;
        const systemRoot = process.env.SystemRoot || 'C:\\Windows';
        const psExe = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
        const cmd = fs.existsSync(psExe) ? psExe : 'powershell';

        // Prefer killing only miners that reference our stats file, but if none match,
        // fall back to killing all zion_native_miner_v2_9.exe instances.
        const stats = String(statsPath || '').replace(/'/g, "''");
        const script = `
$ErrorActionPreference = 'SilentlyContinue'
$stats = '${stats}'
$procs = Get-CimInstance Win32_Process -Filter "Name='zion_native_miner_v2_9.exe'" |
  Select-Object ProcessId, ParentProcessId, CommandLine, ExecutablePath
if (-not $procs) { '[]'; exit 0 }
$targets = @($procs | Where-Object { $_.CommandLine -and $_.CommandLine -like ('*' + $stats + '*') })
if (-not $targets -or $targets.Count -eq 0) { $targets = @($procs) }
$killed = @()
foreach ($t in $targets) {
  try { Stop-Process -Id $t.ProcessId -Force -ErrorAction Stop; $killed += $t.ProcessId } catch { }
}
$killed | ConvertTo-Json -Compress
`.trim();

        logApp('pskill-invoke', JSON.stringify({ label, statsPath }));
        runChildCapture(cmd, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], 'pskill', {
          label,
          statsPath
        });
      } catch (err) {
        logApp('pskill-fatal', JSON.stringify({ label, error: err?.message || String(err) }));
      }
    };

    const powershellAnyMinerAliveByStatsFile = (statsPath) => {
      if (process.platform !== 'win32') return false;
      try {
        const systemRoot = process.env.SystemRoot || 'C:\\Windows';
        const psExe = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
        const cmd = fs.existsSync(psExe) ? psExe : 'powershell';
        const stats = String(statsPath || '').replace(/'/g, "''");
        const script = `
$ErrorActionPreference = 'SilentlyContinue'
$stats = '${stats}'
$procs = Get-CimInstance Win32_Process -Filter "Name='zion_native_miner_v2_9.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine -like ('*' + $stats + '*') }
if ($procs) { '1' } else { '0' }
`.trim();
        const out = execFileSync(cmd, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8' });
        return String(out || '').trim() === '1';
      } catch {
        return true;
      }
    };

    // Windows: SIGTERM/SIGKILL are not reliable. Use taskkill to terminate the whole tree.
    // Escalation path:
    // - non-Windows: SIGTERM then SIGKILL
    // - Windows: attempt a gentle kill, then taskkill tree
    if (process.platform === 'win32') {
      const pid = proc?.pid;
      logApp('stop-miner', JSON.stringify({ pid, statsPath: STATS_PATH }));
      timers.push(
        setTimeout(() => {
          // First: try by PID if it still exists.
          tryTaskkillPid(pid, 'taskkill-fast');
        }, 1200)
      );
      timers.push(
        setTimeout(() => {
          // If PID kill didn't work (or PID changed), fall back to image name.
          // Also kill any orphan miners that still reference our stats file.
          void isProcessAlive(pid).then((alive) => {
            if (alive) {
              tryTaskkillPid(pid, 'taskkill-hard');
            }
            tryTaskkillImage('zion_native_miner_v2_9.exe', 'taskkill-image');
            powershellKillMinerByStatsFile(STATS_PATH, 'pskill-statsfile');
          });
        }, 4500)
      );
    } else {
      timers.push(
        setTimeout(() => {
          try {
            proc.kill('SIGKILL');
          } catch {
            // ignore
          }
        }, 5000)
      );
    }

    // Safety net: if nothing happened, return failure rather than hanging forever.
    timers.push(
      setTimeout(() => {
        // One last attempt to avoid leaving miners running.
        if (process.platform === 'win32') {
          try {
            const pid = proc?.pid;
            tryTaskkillPid(pid, 'taskkill-final');
            tryTaskkillImage('zion_native_miner_v2_9.exe', 'taskkill-image-final');
            powershellKillMinerByStatsFile(STATS_PATH, 'pskill-statsfile-final');
          } catch {
            // ignore
          }
        }
        // If the child-process handle didn't close but the miner is actually gone, treat as success.
        if (process.platform === 'win32') {
          const anyAlive = powershellAnyMinerAliveByStatsFile(STATS_PATH);
          if (!anyAlive) {
            try {
              minerProcess = null;
              minerStats = { ...minerStats, hashrate: 0 };
              updateTrayMenu(minerStats);
              sendToRenderer('miner-stopped', { code: 0 });
            } catch {
              // ignore
            }
            return finish({ success: true, code: 0, note: 'Miner processes not found; treated as stopped.' });
          }
        }
        finish({ success: false, error: 'Stop timed out (process did not exit)' });
      }, 9000)
    );

    proc.once('close', (code) => {
      clearAllTimers();
      finish({ success: true, code });
    });

    try {
      // Best-effort: ask miner to exit.
      // (On Windows this may be ignored; taskkill handles the real stop.)
      if (process.platform === 'win32') {
        try {
          logApp('stop-miner-signal', 'Attempting graceful kill (default)');
          proc.kill();
        } catch {
          // ignore
        }
      } else {
        logApp('stop-miner-signal', 'Sending SIGTERM');
        proc.kill('SIGTERM');
      }
    } catch (err) {
      clearAllTimers();
      finish({ success: false, error: err?.message || String(err) });
    }
  });

  // Also stop the Afterburner sidecar (best-effort) when stopping mining.
  try {
    void stopAfterburnerService();
  } catch {
    // ignore
  }

  // Stop the revenue process (2nd miner, --group revenue) if running.
  try {
    if (revenueProcess) {
      logApp('stop-revenue-process', JSON.stringify({ pid: revenueProcess?.pid }));
      try {
        if (process.platform === 'win32') {
          revenueProcess.kill();
        } else {
          revenueProcess.kill('SIGTERM');
        }
      } catch {
        // ignore
      }
      // Force-kill after 3s if still alive
      const revProc = revenueProcess;
      setTimeout(() => {
        try {
          if (revProc && !revProc.killed) {
            revProc.kill('SIGKILL');
          }
        } catch {
          // ignore
        }
      }, 3000);
      revenueProcess = null;
    }
  } catch {
    // ignore
  }

  // Stop the GPU revenue process (3rd miner, --group revenue --gpu) if running.
  try {
    if (gpuRevenueProcess) {
      logApp('stop-gpu-revenue-process', JSON.stringify({ pid: gpuRevenueProcess?.pid }));
      try {
        if (process.platform === 'win32') {
          gpuRevenueProcess.kill();
        } else {
          gpuRevenueProcess.kill('SIGTERM');
        }
      } catch {
        // ignore
      }
      const gpuRevProc = gpuRevenueProcess;
      setTimeout(() => {
        try {
          if (gpuRevProc && !gpuRevProc.killed) {
            gpuRevProc.kill('SIGKILL');
          }
        } catch {
          // ignore
        }
      }, 3000);
      gpuRevenueProcess = null;
      gpuRevenueHealth = { startedAt: 0, accepted: 0, rejected: 0, disabled: false };
    }
  } catch {
    // ignore
  }

  // Stop profit-status polling loop (multi-stream).
  try {
    stopProfitPoll();
    multiStreamStatus = {
      active: false,
      zion:       { running: false, hashrate: 0, algorithm: 'cosmic_harmony' },  // CHv4 canonical
      gpuCoin:    { name: multiStreamCurrentCoin, running: false, hashrate: 0, pool: '', algorithm: '', directPool: false },
      revenueCpu: { running: false, hashrate: 0, algorithm: 'randomx' },
      lastPollAt: 0,
      pollSource: 'none',
    };
    sendToRenderer('multi-stream-status', { ...multiStreamStatus });
  } catch {
    // ignore
  }

  return minerStopPromise;
}

function stopMining() {
  if (minerAutoStopTimer) {
    try {
      clearTimeout(minerAutoStopTimer);
    } catch {
      // ignore
    }
    minerAutoStopTimer = null;
  }
  void stopMiningAsync();
}

function parseMinerOutput(output) {
  // Strip ANSI escape sequences (colors, cursor control) before regex parsing
  output = output.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '').replace(/\x1B\[\?[0-9;]*[A-Za-z]/g, '');

  const parseNum = (raw) => {
    const s = String(raw ?? '').trim().replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  };

  const unitToMultiplier = (rawUnit) => {
    const unit = String(rawUnit || 'H/s').toLowerCase();
    return unit.startsWith('th') ? 1e12
      : unit.startsWith('gh') ? 1e9
      : unit.startsWith('mh') ? 1e6
      : unit.startsWith('kh') ? 1e3
      : 1;
  };

  // ═══════════════════════════════════════════════════════════════
  // XMRig-STYLE OUTPUT PARSERS (v2.9.5 — professional metrics)
  // ═══════════════════════════════════════════════════════════════

  // ─── XMRig speed line: "speed 10s/60s/15m 1946.02 1938.50 1912.34 kH/s max 2014.88 kH/s" ───
  const speedMatch = output.match(/speed\s+10s\/60s\/15m\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*([kKmMgGtT]?H\/s)\s+max\s+([\d.]+)/i);
  if (speedMatch) {
    const mult = unitToMultiplier(speedMatch[4]);
    minerStats.hashrate_10s = parseFloat(speedMatch[1]) * mult;
    minerStats.hashrate_60s = parseFloat(speedMatch[2]) * mult;
    minerStats.hashrate_15m = parseFloat(speedMatch[3]) * mult;
    minerStats.hashrate_max = parseFloat(speedMatch[5]) * mult;
    minerStats.hashrate = minerStats.hashrate_10s; // primary = 10s window
  }

  // ─── Deeksha stats line: "[Stats] 155.683 H/s | shares=5 | hashes=9368 | backend=native" ───
  const deekshaStatsMatch = output.match(/\[Stats\]\s+([\d.,]+)\s*([kKmMgGtT]?H\/s)\s*\|\s*shares=(\d+)\s*\|\s*hashes=(\d+)\s*\|\s*backend=([a-z0-9_-]+)/i);
  if (deekshaStatsMatch) {
    const hs = (parseNum(deekshaStatsMatch[1]) || 0) * unitToMultiplier(deekshaStatsMatch[2]);
    if (Number.isFinite(hs) && hs > 0) {
      minerStats.hashrate = hs;
      minerStats.hashrate_10s = hs;
      if (!Number.isFinite(Number(minerStats.hashrate_60s)) || Number(minerStats.hashrate_60s) <= 0) minerStats.hashrate_60s = hs;
      if (!Number.isFinite(Number(minerStats.hashrate_15m)) || Number(minerStats.hashrate_15m) <= 0) minerStats.hashrate_15m = hs;
      if (!Number.isFinite(Number(minerStats.hashrate_max)) || Number(minerStats.hashrate_max) < hs) minerStats.hashrate_max = hs;
    }
    minerStats.shares = parseInt(deekshaStatsMatch[3], 10);
    minerStats.total_hashes = parseInt(deekshaStatsMatch[4], 10);
    minerStats.total_hashes_display = String(deekshaStatsMatch[4]);
    const runtimeBackend = String(deekshaStatsMatch[5] || '').toLowerCase();
    minerStats.runtime_backend = runtimeBackend;
    const resolvedBackend = mapDeekshaRuntimeBackend(runtimeBackend);
    syncDeekshaResolvedBackend(runtimeBackend);
    if (resolvedBackend === 'ekam-native' || resolvedBackend === 'ekam-fallback') {
      minerStats.gpu_detected = false;
      minerStats.gpu_type = 'none';
      minerStats.hashrate_gpu = 0;
    } else if (resolvedBackend) {
      minerStats.gpu_detected = true;
      minerStats.gpu_type = resolvedBackend.replace(/^ekam-/, '');
    }
  }

  // ─── XMRig accepted: "accepted 42/0 (+1) diff 256 [38 ms] (100.0%)" ───
  const acceptedMatch = output.match(/accepted\s+(\d+)\/(\d+)\s+\(\+1\)\s+diff\s+([\d.]+[TGMK]?)(?:\s+\[([^\]]+)\])?\s+\(([\d.]+)%\)/i);
  if (acceptedMatch) {
    minerStats.accepted = parseInt(acceptedMatch[1]);
    minerStats.rejected = parseInt(acceptedMatch[2]);
    minerStats.shares = minerStats.accepted + minerStats.rejected;
    minerStats.last_share_diff = acceptedMatch[3];
    minerStats.last_share_latency = acceptedMatch[4] || null;
    minerStats.accept_rate = parseFloat(acceptedMatch[5]);
  }

  // ─── XMRig rejected: "rejected 42/1 (+1) \"reason\"" ───
  // Rust miner event: "rejected 42/1 — reason" (em-dash, no +1)
  const rejectedMatch = output.match(/rejected\s+(\d+)\/(\d+)(?:\s+\(\+1\))?\s+(?:"([^"]+)"|[—–-]\s*(\S[^\n]*))/i);
  if (rejectedMatch) {
    minerStats.accepted = parseInt(rejectedMatch[1]);
    minerStats.rejected = parseInt(rejectedMatch[2]);
    minerStats.shares = minerStats.accepted + minerStats.rejected;
    minerStats.last_reject_reason = (rejectedMatch[3] || rejectedMatch[4] || '').trim();
  }

  // ─── XMRig new job: "new job height 1523 diff 256 algo cosmic_harmony_v3" ───
  const newJobMatch = output.match(/new job\s+height\s+(\d+)\s+diff\s+([\d.]+[TGMK]?)\s+algo\s+(\S+)/i);
  if (newJobMatch) {
    minerStats.last_job_height = newJobMatch[1];
    minerStats.last_job_diff = newJobMatch[2];
    minerStats.stream_algorithm = newJobMatch[3];
  }

  // ─── Deeksha job line: "[Job] id=h154-... height=154 target=00418937..." ───
  const deekshaJobMatch = output.match(/\[Job\]\s+id=(\S+)\s+height=(\d+)\s+target=([0-9a-fA-F]+)/i);
  if (deekshaJobMatch) {
    minerStats.last_job_id = deekshaJobMatch[1];
    minerStats.last_job_height = deekshaJobMatch[2];
    minerStats.last_job_diff = deekshaJobMatch[3];
    minerStats.last_pool_diff = deekshaJobMatch[3];
  }

  // ─── XMRig block found: "█ BLOCK FOUND █ ★ height 1523 (total: 2)" ───
  const blockMatch = output.match(/BLOCK FOUND.*?height\s+(\d+).*?\(total:\s*(\d+)\)/i);
  if (blockMatch) {
    minerStats.last_block_height = parseInt(blockMatch[1]);
    minerStats.blocks_found = parseInt(blockMatch[2]);
  }

  // ─── Full status panel fields ───
  // Old format: "HASHRATE  10s: 1946.02 kH/s   60s: 1938.50   15m: 1912.34"
  const statusHrMatch = output.match(/HASHRATE\s+10s:\s*([\d.]+)\s*([kKmMgGtT]?H\/s)\s+60s:\s*([\d.]+)\s+15m:\s*([\d.]+)/i);
  if (statusHrMatch) {
    const mult = unitToMultiplier(statusHrMatch[2]);
    minerStats.hashrate_10s = parseFloat(statusHrMatch[1]) * mult;
    minerStats.hashrate_60s = parseFloat(statusHrMatch[3]) * mult;
    minerStats.hashrate_15m = parseFloat(statusHrMatch[4]) * mult;
    minerStats.hashrate = minerStats.hashrate_10s;
  }

  // New format: "SPEED   10s 3.75 MH/s  60s 3.75  15m 3.75"
  const speedPanelMatch = output.match(/SPEED\s+10s\s+([\d.]+)\s*([kKmMgGtT]?H\/s)\s+60s\s+([\d.]+)\s+15m\s+([\d.]+)/i);
  if (speedPanelMatch) {
    const mult = unitToMultiplier(speedPanelMatch[2]);
    minerStats.hashrate_10s = parseFloat(speedPanelMatch[1]) * mult;
    minerStats.hashrate_60s = parseFloat(speedPanelMatch[3]) * mult;
    minerStats.hashrate_15m = parseFloat(speedPanelMatch[4]) * mult;
    minerStats.hashrate = minerStats.hashrate_10s;
  }

  // Old format: "SHARES  accepted: 42   rejected: 0   rate: 100.0%"
  const statusSharesMatch = output.match(/SHARES\s+accepted:\s*(\d+)\s+rejected:\s*(\d+)\s+rate:\s*([\d.]+)%/i);
  if (statusSharesMatch) {
    minerStats.accepted = parseInt(statusSharesMatch[1]);
    minerStats.rejected = parseInt(statusSharesMatch[2]);
    minerStats.shares = minerStats.accepted + minerStats.rejected;
    minerStats.accept_rate = parseFloat(statusSharesMatch[3]);
  }

  // New format: "SHARES  A: 35  R: 5  rate: 87.5%"
  const sharesPanelMatch = output.match(/SHARES\s+A:\s*(\d+)\s+R:\s*(\d+)\s+rate:\s*([\d.]+)%/i);
  if (sharesPanelMatch) {
    minerStats.accepted = parseInt(sharesPanelMatch[1]);
    minerStats.rejected = parseInt(sharesPanelMatch[2]);
    minerStats.shares = minerStats.accepted + minerStats.rejected;
    minerStats.accept_rate = parseFloat(sharesPanelMatch[3]);
  }

  // ─── T-Rex dashboard: " HASHRATE : TOTAL 3.14 MH/s | CPU 0.00 H/s | GPU 3.14 MH/s" ───
  const trexHrMatch = output.match(/HASHRATE\s*:\s*TOTAL\s+([\d.]+)\s*([kKmMgGtT]?H\/s)\s*\|\s*CPU\s+([\d.]+)\s*([kKmMgGtT]?H\/s)\s*\|\s*GPU\s+([\d.]+)\s*([kKmMgGtT]?H\/s)/i);
  if (trexHrMatch) {
    const toHs = (v, u) => { const n = parseFloat(v); const s = u.toLowerCase(); return n * (s.startsWith('th') ? 1e12 : s.startsWith('gh') ? 1e9 : s.startsWith('mh') ? 1e6 : s.startsWith('kh') ? 1e3 : 1); };
    minerStats.hashrate     = toHs(trexHrMatch[1], trexHrMatch[2]);
    minerStats.hashrate_10s = minerStats.hashrate;
    minerStats.hashrate_cpu = toHs(trexHrMatch[3], trexHrMatch[4]);
    minerStats.hashrate_gpu = toHs(trexHrMatch[5], trexHrMatch[6]);
  }

  // ─── T-Rex dashboard: " SHARES : ACCEPTED 5 | REJECTED 0 | SENT 5 | ACC 100.0%" ───
  const trexSharesMatch = output.match(/SHARES\s*:\s*ACCEPTED\s+(\d+)\s*\|\s*REJECTED\s+(\d+)\s*\|\s*SENT\s+(\d+)\s*\|\s*ACC\s+([\d.]+)%/i);
  if (trexSharesMatch) {
    minerStats.accepted    = parseInt(trexSharesMatch[1]);
    minerStats.rejected    = parseInt(trexSharesMatch[2]);
    minerStats.shares      = parseInt(trexSharesMatch[3]);
    minerStats.accept_rate = parseFloat(trexSharesMatch[4]);
  }

  // ─── T-Rex dashboard: " UPTIME : 00:05:42 | GPU: ON | JOB: abcdef" ───
  const trexUptimeMatch = output.match(/UPTIME\s*:\s*([\d:]+)\s*\|\s*GPU:\s*(\w+)\s*\|\s*JOB:\s*(\S*)/i);
  if (trexUptimeMatch) {
    minerStats.uptime_display = trexUptimeMatch[1];
  }

  // Old format: "DIFF    pool: 256   best: 1024   height: 1523   blocks: 0"
  const statusDiffMatch = output.match(/DIFF\s+pool:\s*([\d.]+[TGMK]?)\s+best:\s*([\d.]+[TGMK]?)\s+height:\s*(\d+)\s+blocks:\s*(\d+)/i);
  if (statusDiffMatch) {
    minerStats.last_pool_diff = statusDiffMatch[1];
    minerStats.best_share_diff = statusDiffMatch[2];
    minerStats.last_job_height = statusDiffMatch[3];
    minerStats.blocks_found = parseInt(statusDiffMatch[4]);
  }

  // New format: "DIFF    pool: 0  height: 1615  blocks: 0"
  const diffPanelMatch = output.match(/DIFF\s+pool:\s*([\d.]+[TGMK]?)\s+height:\s*(\d+)\s+blocks:\s*(\d+)/i);
  if (diffPanelMatch && !statusDiffMatch) {
    minerStats.last_pool_diff = diffPanelMatch[1];
    minerStats.last_job_height = diffPanelMatch[2];
    minerStats.blocks_found = parseInt(diffPanelMatch[3]);
  }

  // Old format: "UPTIME  02:15:38   hashes: 158.2M   conn: 1"
  const statusUptimeMatch = output.match(/UPTIME\s+([\d:]+[d\s]*[\d:]*)\s+hashes:\s*([\d.]+[TGMK]?)\s+conn:\s*(\d+)/i);
  if (statusUptimeMatch) {
    minerStats.uptime_display = statusUptimeMatch[1];
    minerStats.total_hashes_display = statusUptimeMatch[2];
    minerStats.connection_count = parseInt(statusUptimeMatch[3]);
  }

  // New format: "UPTIME  00:00:13  hashes: 45.0M  algo: cosmic_harmony_v3"
  const uptimePanelMatch = output.match(/UPTIME\s+([\d:]+[d\s]*[\d:]*)\s+hashes:\s*([\d.]+[TGMK]?)\s+algo:\s*(\S+)/i);
  if (uptimePanelMatch && !statusUptimeMatch) {
    minerStats.uptime_display = uptimePanelMatch[1];
    minerStats.total_hashes_display = uptimePanelMatch[2];
    minerStats.stream_algorithm = uptimePanelMatch[3];
  }

  // Old format: "THREADS  cpu: 8   gpu: Apple M1 (2.59 MH/s)   algo: cosmic_harmony_v3"
  const statusThreadsMatch = output.match(/THREADS\s+cpu:\s*(\d+)\s+gpu:\s*([^\s]+(?:\s+[^\s]+)*?)\s+algo:\s*(\S+)/i);
  if (statusThreadsMatch) {
    minerStats.cpu_threads = parseInt(statusThreadsMatch[1]);
    minerStats.gpu_info = statusThreadsMatch[2];
    minerStats.stream_algorithm = statusThreadsMatch[3];
  }

  // New format: "HW     cpu: 2T  gpu: 3.07 MH/s [Apple M1]"
  const hwPanelMatch = output.match(/HW\s+cpu:\s*(\d+)T\s+gpu:\s*([\d.]+)\s*([kKmMgGtT]?H\/s)\s+\[([^\]]+)\]/i);
  if (hwPanelMatch) {
    minerStats.cpu_threads = parseInt(hwPanelMatch[1]);
    const gpuValue = parseFloat(hwPanelMatch[2]);
    const gpuMult = unitToMultiplier(hwPanelMatch[3]);
    minerStats.hashrate_gpu = gpuValue * gpuMult;
    minerStats.gpu_info = hwPanelMatch[4];
  }

  const deekshaGpuBackendMatch = output.match(/\[Main\]\s+GPU backend:\s*(\S+)/i);
  if (deekshaGpuBackendMatch) {
    const backendName = String(deekshaGpuBackendMatch[1] || '').trim().toLowerCase();
    const resolvedBackend = mapDeekshaRuntimeBackend(backendName);
    minerStats.runtime_backend = backendName;
    syncDeekshaResolvedBackend(backendName);
    if (resolvedBackend && resolvedBackend !== 'ekam-native' && resolvedBackend !== 'ekam-fallback') {
      minerStats.gpu_detected = true;
      minerStats.gpu_type = resolvedBackend.replace(/^ekam-/, '');
    } else {
      minerStats.gpu_detected = false;
      minerStats.gpu_type = 'none';
      minerStats.hashrate_gpu = 0;
    }
  }

  const openclDeviceMatch = output.match(/\[(?:OpenCL|DeekshaOpenCL)\]\s+(?:Device|Canonical Deeksha GPU ready):\s*(.+)|\[EkamDeekshaOpenCL\]\s+(.+)/i);
  if (openclDeviceMatch) {
    const deviceName = String(openclDeviceMatch[1] || openclDeviceMatch[2] || '').trim();
    minerStats.gpu_info = deviceName;
    minerStats.gpu_name = deviceName;
    minerStats.gpu_detected = true;
    minerStats.gpu_type = 'opencl';
  }

  // New format HW with no GPU (just dash): "HW     cpu: 2T  gpu: —"
  const hwNoGpuMatch = output.match(/HW\s+cpu:\s*(\d+)T\s+gpu:\s*[—-]/i);
  if (hwNoGpuMatch && !hwPanelMatch) {
    minerStats.cpu_threads = parseInt(hwNoGpuMatch[1]);
  }

  // ═══════════════════════════════════════════════════════════════
  // LEGACY PARSERS (backward compatibility with old output format)
  // ═══════════════════════════════════════════════════════════════

  // ─── Legacy hashrate: "⚡ Hashrate: | 1946.02 kH/s | Shares: 38 / 0 | ..." ───
  if (!speedMatch && !statusHrMatch) {
    // IMPORTANT: Require "Shares: A / R" on the same line to avoid false matches
    // from auxiliary/revenue logs (e.g. RandomX hashrate lines in H/s).
    const hashrateMatch = output.match(/Hashrate:\s*\|?\s*([\d.,]+)\s*([kKmMgGtT]?H\/s)\b[^\n]*\bShares:\s*(\d+)\s*\/\s*(\d+)/i);
    if (hashrateMatch) {
      const value = parseNum(hashrateMatch[1]);
      const unit = String(hashrateMatch[2] || 'H/s').toLowerCase();
      const mult = unit.startsWith('kh') ? 1e3 : unit.startsWith('mh') ? 1e6 : unit.startsWith('gh') ? 1e9 : unit.startsWith('th') ? 1e12 : 1;
      const hs = (value ?? 0) * mult;
      if (Number.isFinite(hs) && hs > 0) {
        minerStats.hashrate = hs;
      }
    }
  }

  // GPU hashrate: "Apple M1 [GPU]: 2.59 MH/s (batch 2.65 MH/s) | 89 shares"
  const gpuHrMatch = output.match(/\[GPU\]:\s*([\d.]+)\s*([kKmMgGtT]?H\/s)/i);
  if (gpuHrMatch) {
    const value = parseNum(gpuHrMatch[1]);
    const unit = String(gpuHrMatch[2] || 'H/s').toLowerCase();
    const mult = unit.startsWith('kh') ? 1e3 : unit.startsWith('mh') ? 1e6 : unit.startsWith('gh') ? 1e9 : unit.startsWith('th') ? 1e12 : 1;
    const hs = (value ?? 0) * mult;
    if (Number.isFinite(hs)) minerStats.hashrate_gpu = hs;
  }

  // CPU-fallback hashrate: "Apple M1 [CPU-fallback]: 530.21 kH/s ..."
  const cpuFallbackMatch = output.match(/\[CPU-fallback\]:\s*([\d.]+)\s*([kKmMgGtT]?H\/s)/i);
  if (cpuFallbackMatch) {
    const value = parseNum(cpuFallbackMatch[1]);
    const unit = String(cpuFallbackMatch[2] || 'H/s').toLowerCase();
    const mult = unit.startsWith('kh') ? 1e3 : unit.startsWith('mh') ? 1e6 : unit.startsWith('gh') ? 1e9 : unit.startsWith('th') ? 1e12 : 1;
    const hs = (value ?? 0) * mult;
    if (Number.isFinite(hs)) minerStats.hashrate_cpu_fallback = hs;
  }

  // CPU batch hashrate: "✅ Batch done: 250000 hashes in 452ms, 552.04 kH/s, 250 shares"
  const cpuBatchMatch = output.match(/Batch done:.*?([\d.]+)\s*([kKmMgGtT]?H\/s)/i);
  if (cpuBatchMatch) {
    const value = parseNum(cpuBatchMatch[1]);
    const unit = String(cpuBatchMatch[2] || 'H/s').toLowerCase();
    const mult = unit.startsWith('kh') ? 1e3 : unit.startsWith('mh') ? 1e6 : unit.startsWith('gh') ? 1e9 : unit.startsWith('th') ? 1e12 : 1;
    const hs = (value ?? 0) * mult;
    if (Number.isFinite(hs)) minerStats.hashrate_cpu = hs;
  }

  // Composite hashrate: prefer combined status line, else sum GPU+CPU components
  if (!minerStats.hashrate) {
    const gpuHr = Number(minerStats.hashrate_gpu) || 0;
    const cpuHr = Number(minerStats.hashrate_cpu) || 0;
    const cpuFb = Number(minerStats.hashrate_cpu_fallback) || 0;
    const combined = gpuHr + cpuHr + cpuFb;
    if (combined > 0) minerStats.hashrate = combined;
  }

  // Parse shares (Rust miner prints: "Shares: <accepted> / <rejected>")
  // Also works in combined line: "⚡ Hashrate: | X kH/s | Shares: 38 / 0 |"
  const sharesRustMatch = output.match(/Shares:\s*(\d+)\s*\/\s*(\d+)/i);
  if (sharesRustMatch) {
    const acc = parseInt(sharesRustMatch[1]);
    const rej = parseInt(sharesRustMatch[2]);
    if (Number.isFinite(acc)) minerStats.accepted = acc;
    if (Number.isFinite(rej)) minerStats.rejected = rej;
    minerStats.shares = (Number.isFinite(acc) ? acc : 0) + (Number.isFinite(rej) ? rej : 0);
  }

  // Parse shares: "Share accepted (123/125)"
  const shareMatch = output.match(/Share\s+accepted\s+\((\d+)\/(\d+)\)/i);
  if (shareMatch) {
    minerStats.accepted = parseInt(shareMatch[1]);
    minerStats.shares = parseInt(shareMatch[2]);
  }

  // GPU share accepted: "[GPU] share ACCEPTED (total: 48)"
  const gpuShareMatch = output.match(/GPU share ACCEPTED[^(]*\(total:\s*(\d+)\)/i);
  if (gpuShareMatch) {
    const gpuTotal = parseInt(gpuShareMatch[1]);
    if (Number.isFinite(gpuTotal)) {
      minerStats.gpu_shares_accepted = gpuTotal;
    }
  }

  // GPU share rejected: "[GPU] share REJECTED"
  if (/GPU share REJECTED/i.test(output)) {
    minerStats.gpu_shares_rejected = (minerStats.gpu_shares_rejected || 0) + 1;
  }

  // Best-effort: Rust miner logs these once.
  if (/First\s+share\s+accepted/i.test(output)) {
    minerStats.accepted = Number(minerStats.accepted || 0) + 1;
    minerStats.shares = Number(minerStats.shares || 0) + 1;
  }
  if (/First\s+share\s+rejected/i.test(output)) {
    minerStats.rejected = Number(minerStats.rejected || 0) + 1;
    minerStats.shares = Number(minerStats.shares || 0) + 1;
  }

  // Parse consciousness: "Level: MENTAL (XP: 1250)"
  const consciousnessMatch = output.match(/Level:\s*(\w+)\s+\(XP:\s*(\d+)\)/i);
  if (consciousnessMatch) {
    minerStats.consciousness_level = consciousnessMatch[1];
    minerStats.consciousness_xp = parseInt(consciousnessMatch[2]);
  }

  // Parse job meta (works for lines like: "[cosmic_harmony] Job ... h=170 diff=5000 (pool=5000)"
  // Keep it permissive; miner formats vary by algo.
  const jobMatch = output.match(/\bJob\s+([0-9a-f]{8,})[^\n]*?\bh=(\d+)[^\n]*?\bdiff=(\d+)(?:[^\n]*?\(pool=(\d+)\))?/i);
  if (jobMatch) {
    minerStats.last_job_id = String(jobMatch[1] || '').slice(0, 12);
    minerStats.last_job_height = jobMatch[2];
    minerStats.last_job_diff = jobMatch[3];
    if (jobMatch[4]) minerStats.last_pool_diff = jobMatch[4];
  }

  // Parse rejected share lines (best-effort) to show A/R even if stats-file lags.
  if (/Share\s+rejected/i.test(output)) {
    minerStats.rejected = Number(minerStats.rejected || 0) + 1;
  }

  // ---- CH3 Stream / Revenue parsing ----

  // Stream switch: "Stream switch: cosmic_harmony_v3 → randomx"
  const streamSwitchMatch = output.match(/Stream switch:\s*(\S+)\s*→\s*(\S+)/i);
  if (streamSwitchMatch) {
    minerStats.stream_algorithm = streamSwitchMatch[2];
    if (/randomx/i.test(streamSwitchMatch[2])) {
      minerStats.stream_mode = 'Revenue:XMR';
      minerStats.revenue_coin = 'XMR';
    } else if (/cosmic/i.test(streamSwitchMatch[2])) {
      minerStats.stream_mode = 'ZION';
      minerStats.revenue_coin = '';
    } else {
      minerStats.stream_mode = streamSwitchMatch[2];
    }
    try { sendToRenderer('stream-switch', { from: streamSwitchMatch[1], to: streamSwitchMatch[2], mode: minerStats.stream_mode }); } catch {}
  }

  // TimeSplit: "TimeSplit: → Revenue:XMR (Z:50% R:25% N:25%)"
  const timeSplitMatch = output.match(/TimeSplit:\s*→\s*(\S+)\s*\(([^)]+)\)/i);
  if (timeSplitMatch) {
    minerStats.stream_mode = timeSplitMatch[1];
    minerStats.stream_allocation = timeSplitMatch[2];
    if (/XMR/i.test(timeSplitMatch[1])) minerStats.revenue_coin = 'XMR';
  }

  // RandomX hash: "RandomX first hash: OK in 1.05s" or "RandomX: 1.05 H/s"
  const rxHashMatch = output.match(/RandomX.*?:\s*([\d.]+)\s*H\/s/i);
  if (rxHashMatch) {
    minerStats.revenue_hashrate = parseFloat(rxHashMatch[1]);
  }
  if (/RandomX first hash: OK/i.test(output)) {
    minerStats.stream_mode = 'Revenue:XMR';
    minerStats.revenue_coin = 'XMR';
  }

  // CPU-ONLY MODE banner from miner
  if (/CPU-ONLY MODE/i.test(output)) {
    minerStats.cpu_only_mode = true;
    minerStats.gpu_detected = false;
  }

  // Pool failover: reset counter once we see real hashing (pool connection works)
  if (poolFailoverCount > 0 && (minerStats.hashrate_10s > 0 || minerStats.accepted > 0)) {
    dbg(`[pool-failover] Mining confirmed working — resetting failover counter (was ${poolFailoverCount})`);
    poolFailoverCount = 0;
  }

  updateTrayMenu(minerStats);
  scheduleStatsEmit();
}

function sendToRendererNow(channel, data) {
  if (!mainWindow || !mainWindow.webContents) return;
  if (mainWindow.isDestroyed && mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, data);
}

function sendToRenderer(channel, data) {
  // Queue noisy miner logs to avoid flooding renderer IPC.
  if (channel === 'miner-output') {
    const stream = data?.stream === 'stderr' ? 'stderr' : 'stdout';
    const text = String(data?.text || '');
    if (text) enqueueMinerOutputToRenderer(stream, text);
    return;
  }
  sendToRendererNow(channel, data);
}

let statsEmitTimer = null;
const STATS_EMIT_INTERVAL_MS = 250;

function scheduleStatsEmit() {
  if (statsEmitTimer) return;
  statsEmitTimer = setTimeout(() => {
    statsEmitTimer = null;
    try {
      sendToRenderer('stats-update', composeStatsPayload());
    } catch {
      // ignore
    }
  }, STATS_EMIT_INTERVAL_MS);
}

// Throttle miner output events to keep renderer responsive.
// Miner processes can emit very frequent stdout/stderr chunks; sending each chunk over IPC
// can flood the renderer and make the UI feel stuck.
let minerOutputFlushTimer = null;
let minerOutputBuffer = { stdout: '', stderr: '' };
const MAX_MINER_OUTPUT_BUFFER_CHARS = 64 * 1024;

function flushMinerOutputToRenderer() {
  try {
    if (minerOutputFlushTimer) {
      clearTimeout(minerOutputFlushTimer);
      minerOutputFlushTimer = null;
    }

    const out = minerOutputBuffer.stdout;
    const err = minerOutputBuffer.stderr;
    minerOutputBuffer = { stdout: '', stderr: '' };

    if (out) {
      try {
        sendToRendererNow('miner-output', { stream: 'stdout', text: out });
      } catch {
        // ignore
      }
    }

    if (err) {
      try {
        sendToRendererNow('miner-output', { stream: 'stderr', text: err });
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

function enqueueMinerOutputToRenderer(stream, text) {
  try {
    const key = stream === 'stderr' ? 'stderr' : 'stdout';
    const next = (minerOutputBuffer[key] || '') + String(text || '');

    // Keep bounded.
    minerOutputBuffer[key] = next.length > MAX_MINER_OUTPUT_BUFFER_CHARS
      ? next.slice(-MAX_MINER_OUTPUT_BUFFER_CHARS)
      : next;

    if (minerOutputFlushTimer) return;
    minerOutputFlushTimer = setTimeout(flushMinerOutputToRenderer, 150);
  } catch {
    // ignore
  }
}

// IPC handlers
ipcMain.handle('get-config', () => {
  return loadConfig();
});

// CH3 Multi-stream status (dual/triple mining: ZION + GPU coin + CPU revenue)
ipcMain.handle('get-multi-stream-status', () => {
  return buildMultiStreamPayload();
});

// First-run detection: true if no wallets exist yet
ipcMain.handle('is-first-run', () => {
  try {
    if (!fs.existsSync(WALLETS_PATH)) return { firstRun: true };
    const files = fs.readdirSync(WALLETS_PATH).filter(f => f.endsWith('.json'));
    return { firstRun: files.length === 0 };
  } catch {
    return { firstRun: true };
  }
});

// Quick-setup: generate wallet + save config + return everything needed to start mining
ipcMain.handle('quick-setup', async (event, { password, workerName }) => {
  try {
    if (!fs.existsSync(WALLETS_PATH)) {
      fs.mkdirSync(WALLETS_PATH, { recursive: true });
    }

    // Generate wallet
    const wallet = WalletGenerator.generateWallet();
    const encrypted = WalletGenerator.encryptPrivateKey(wallet.privateKey, password);
    const encryptedMnemonic = wallet.mnemonic
      ? WalletGenerator.encryptPrivateKey(wallet.mnemonic, password)
      : null;

    const walletData = {
      version: '2.9.6',
      name: 'My Wallet',
      address: wallet.address,
      publicKey: wallet.publicKey,
      encryptedPrivateKey: encrypted,
      encryptedMnemonic: encryptedMnemonic,
      evmAddress: wallet.mnemonic ? deriveEvmAddressFromMnemonic(wallet.mnemonic) : null,
      createdAt: wallet.createdAt,
      lastUsed: new Date().toISOString()
    };

    const filename = `${wallet.address.substring(0, 15)}.json`;
    const filePath = path.join(WALLETS_PATH, filename);
    fs.writeFileSync(filePath, JSON.stringify(walletData, null, 2));

    // Update config with the new wallet
    const config = loadConfig();
    config.wallet = wallet.address;
    config.worker = workerName || 'desktop-agent';
    saveConfig(config);

    return {
      success: true,
      wallet: {
        address: wallet.address,
        mnemonic: wallet.mnemonic,
        publicKey: wallet.publicKey
      },
      config
    };
  } catch (error) {
    console.error('Quick setup failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-config', (event, config) => {
  const ok = saveConfig(config);
  // Apply Afterburner enable/disable immediately (no need to restart miner).
  try {
    if (config?.aiAfterburner === false) {
      void stopAfterburnerService();
    } else {
      void ensureAfterburnerServiceRunning().then(() => afterburnerSend({ cmd: 'start' }));
    }
  } catch {
    // ignore
  }
  return ok;
});

ipcMain.handle('get-system-info', () => {
  const cpuCount = Array.isArray(os.cpus?.()) ? os.cpus().length : 1;
  return {
    cpuCount: Math.max(1, cpuCount)
  };
});

ipcMain.handle('start-mining', (event, config) => {
  saveConfig(config);
  return startMining(config);
});

ipcMain.handle('stop-mining', async () => {
  const result = await stopMiningAsync();
  return result.success ? { success: true } : { success: false, error: result.error };
});

// ─── CHv4.2 Merkabah GPU Mining ───────────────────────────────────────────
ipcMain.handle('start-chv42-gpu', (event, cfg) => {
  if (chv42GpuProcess) return { success: false, error: 'CHv4.2 GPU already running' };
  const conf = cfg || loadConfig();
  const pool = `${conf.pool?.host || PRIMARY_TESTNET_HOST}:${conf.pool?.port || PRIMARY_POOL_PORT}`;
  const wallet = conf.wallet || '';
  const worker = conf.worker || 'desktop-agent';
  const isPackaged = app.isPackaged;
  const gpuScriptPrimary = isPackaged
    ? path.join(process.resourcesPath, 'mining', 'cosmic_harmony_deeksha_gpu.py')
    : path.join(APP_ROOT, 'resources', 'mining', 'cosmic_harmony_deeksha_gpu.py');
  const gpuScriptLegacy = isPackaged
    ? path.join(process.resourcesPath, 'mining', 'cosmic_harmony_v42_gpu.py')
    : path.join(APP_ROOT, 'resources', 'mining', 'cosmic_harmony_v42_gpu.py');
  const gpuScript = fs.existsSync(gpuScriptPrimary) ? gpuScriptPrimary : gpuScriptLegacy;
  const pyExe = process.platform === 'win32' ? 'python' : 'python3';
  const args = [gpuScript, '--pool', pool, '--wallet', wallet, '--worker', worker, '--backend', 'auto'];
  logApp('chv42-ipc-start', JSON.stringify({ pyExe, args }));
  try {
    chv42GpuProcess = spawn(pyExe, args, { env: { ...process.env } });
  } catch (e) {
    return { success: false, error: String(e) };
  }
  chv42GpuStats = { running: true, hashrate: 0, accepted: 0, rejected: 0, backend: 'auto', startedAt: Date.now() };
  chv42GpuProcess.stdout.on('data', (d) => {
    const txt = d.toString();
    const hrMatch = txt.match(/Hashrate:\s*([\d.]+)\s*H\/s/i);
    if (hrMatch) chv42GpuStats.hashrate = parseFloat(hrMatch[1]);
    const backendMatch = txt.match(/\[(METAL|CUDA|OPENCL|CPU)\]/i);
    if (backendMatch) chv42GpuStats.backend = backendMatch[1].toLowerCase();
    const accMatch = txt.match(/accepted[:\s]+(\d+)/i);
    if (accMatch) chv42GpuStats.accepted = parseInt(accMatch[1]);
    const rejMatch = txt.match(/rejected[:\s]+(\d+)/i);
    if (rejMatch) chv42GpuStats.rejected = parseInt(rejMatch[1]);
    sendToRenderer('chv42-output', { text: txt });
  });
  chv42GpuProcess.stderr.on('data', (d) => {
    sendToRenderer('chv42-output', { text: `[stderr] ${d.toString()}` });
  });
  chv42GpuProcess.on('exit', (code) => {
    logApp('chv42-ipc-exit', JSON.stringify({ code }));
    chv42GpuProcess = null;
    chv42GpuStats.running = false;
    sendToRenderer('chv42-stopped', { code });
  });
  return { success: true };
});

ipcMain.handle('stop-chv42-gpu', async () => {
  if (chv42GpuProcess) {
    try { chv42GpuProcess.kill('SIGTERM'); } catch {}
    chv42GpuProcess = null;
  }
  chv42GpuStats.running = false;
  sendToRenderer('chv42-stopped', { code: 0 });
  return { success: true };
});

ipcMain.handle('get-chv42-status', () => {
  return { ...chv42GpuStats };
});

ipcMain.handle('get-stats', () => {
  return composeStatsPayload();
});

ipcMain.handle('open-logs', () => {
  const { shell } = require('electron');
  shell.openPath(LOG_PATH);
  return { success: true };
});

// ============================================================================
// AI NATIVE IPC HANDLERS
// ============================================================================

ipcMain.handle('ai-native-start', async (event, config) => {
  try {
    const aiNativeServerUrl = config.aiNativePoolUrl || DEFAULT_AI_NATIVE_POOL_URL;
    const result = await aiNativeSend({
      cmd: 'start',
      server_url: aiNativeServerUrl,
      config: {
        wallet: config.wallet,
        server_url: aiNativeServerUrl,
        pool_url: aiNativeServerUrl,
        consciousness_level: config.aiNativeConsciousness || 1,
        gpu: config.gpu || false,
        threads: config.threads || 4
      }
    });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai-native-stop', async () => {
  try {
    await stopAiNativeService();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai-native-stats', async () => {
  try {
    const stats = await aiNativeSend({ cmd: 'stats' });
    return { success: true, stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai-native-status', async () => {
  try {
    const status = await aiNativeSend({ cmd: 'status' });
    return { success: true, enabled: true, ...status };
  } catch (error) {
    return { success: false, error: error.message, enabled: false };
  }
});

// New AI Native operations
ipcMain.handle('ai-native-chat', async (event, messages) => {
  try {
    const response = await aiNativeSend({ cmd: 'chat', messages });
    return { success: true, response };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai-native-search-knowledge', async (event, query, limit = 5) => {
  try {
    const result = await aiNativeSend({ cmd: 'search_knowledge', query, limit });
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai-native-ask', async (event, question) => {
  try {
    const response = await aiNativeSend({ cmd: 'ask_ai', question });
    return { success: true, response };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai-native-dashboard', async () => {
  try {
    const data = await aiNativeSend({ cmd: 'dashboard' });
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai-native-blockchain-status', async () => {
  try {
    const status = await aiNativeSend({ cmd: 'blockchain_status' });
    return { success: true, status };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai-native-pool-monitor', async () => {
  try {
    const pools = await aiNativeSend({ cmd: 'pool_monitor' });
    return { success: true, pools };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai-native-system-health', async () => {
  try {
    const health = await aiNativeSend({ cmd: 'system_health' });
    return { success: true, health };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================================
// wZION BRIDGE IPC HANDLERS  (L1 ↔ Base EVM)
// ============================================================================

/** In-memory session cache: EVM wallet derived from mnemonic (cleared on app close) */
let _sessionEvmWallet = null;

/** Correct L1 bridge vault address (holds locked UTXOs) */
const BRIDGE_VAULT_ADDR = 'zion1s6y6h7k6l033f2n7e0y0r8t6a8h474t0x5398d0';

const BRIDGE_NET = {
  CHAIN_ID   : 84532,                /* Base Sepolia (testnet). Switch to 8453 for mainnet */
  RPC_URL    : 'https://sepolia.base.org',
  WZION_ADDR : '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6',
  BRIDGE_ADDR: '0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1',
  EXPLORER   : 'https://sepolia.basescan.org',
};

/** Derive EVM address (secp256k1, BIP44 m/44'/60'/0'/0/0) from a BIP39 mnemonic */
function deriveEvmAddressFromMnemonic(mnemonic) {
  try {
    const { ethers } = require('ethers');
    return ethers.Wallet.fromMnemonic(mnemonic.trim(), "m/44'/60'/0'/0/0").address;
  } catch { return null; }
}

const BRIDGE_SEL_BALANCE_OF    = '0x70a08231'; // balanceOf(address)
const BRIDGE_SEL_BRIDGE_STATS  = bridgeSelector('bridgeStats()');
const BRIDGE_SEL_BRIDGE_BURN   = bridgeSelector('bridgeBurn(uint256,string,bytes32)');

function bridgeSelector(sig) {
  // Inline keccak-like using a pre-computed map (avoids crypto import in main process)
  // We use a lightweight approach: call the RPC eth_call to get the selector
  // For known sigs we hard-code (computed off-line):
  const KNOWN = {
    'bridgeStats()'                        : '0x11a2be55',
    'bridgeBurn(uint256,string,bytes32)'   : '0xf5b2f5b2',
  };
  return KNOWN[sig] || '0x00000000';
}

async function bridgeRpc(method, params = []) {
  const res = await fetch(BRIDGE_NET.RPC_URL, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC: ${JSON.stringify(json.error)}`);
  return json.result;
}

function bridgeEncodeAddress(addr) {
  return addr.replace('0x', '').toLowerCase().padStart(64, '0');
}

/** Get wZION balance for an EVM address (returns human-readable float) */
ipcMain.handle('bridge-get-wzion-balance', async (event, evmAddress) => {
  try {
    const data   = BRIDGE_SEL_BALANCE_OF + bridgeEncodeAddress(evmAddress);
    const result = await bridgeRpc('eth_call', [{ to: BRIDGE_NET.WZION_ADDR, data }, 'latest']);
    const raw    = BigInt(result || '0x0');
    const balance = Number(raw) / 1e18;
    return { success: true, balance, raw: raw.toString() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/** Get bridge-wide statistics */
ipcMain.handle('bridge-get-stats', async () => {
  try {
    const data   = BRIDGE_SEL_BRIDGE_STATS;
    const result = await bridgeRpc('eth_call', [{ to: BRIDGE_NET.BRIDGE_ADDR, data }, 'latest']);
    const hex    = (result || '0x' + '0'.repeat(256)).slice(2);
    const chunk  = (i) => Number(BigInt('0x' + hex.slice(i * 64, i * 64 + 64))) / 1e18;
    return {
      success     : true,
      totalMinted : chunk(0),
      totalBurned : chunk(1),
      outstanding : chunk(2),
      circulating : chunk(3),
      network     : BRIDGE_NET.RPC_URL,
      wzionAddress: BRIDGE_NET.WZION_ADDR,
      bridgeAddress: BRIDGE_NET.BRIDGE_ADDR,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/** Check transaction status on Base */
ipcMain.handle('bridge-tx-status', async (event, txHash) => {
  try {
    const receipt = await bridgeRpc('eth_getTransactionReceipt', [txHash]);
    if (!receipt) return { success: true, confirmed: false };
    return {
      success    : true,
      confirmed  : true,
      status     : parseInt(receipt.status, 16),
      blockNumber: parseInt(receipt.blockNumber, 16),
      explorerUrl: `${BRIDGE_NET.EXPLORER}/tx/${txHash}`,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Generate L1 locking memo for L1→EVM direction.
 * Returns { vaultAddress, memo } — user sends ZION to vault with memo.
 */
ipcMain.handle('bridge-prepare-lock', async (event, evmRecipient) => {
  try {
    if (!evmRecipient || !/^0x[0-9a-fA-F]{40}$/.test(evmRecipient)) {
      return { success: false, error: 'Invalid EVM address format (0x + 40 hex chars)' };
    }
    return {
      success      : true,
      vaultAddress : BRIDGE_VAULT_ADDR,
      memo         : `BRIDGE:base:${evmRecipient.toLowerCase()}`,
      minAmount    : 100,
      network      : 'Base Sepolia',
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Get EVM address (Base/Ethereum) for the active wallet.
 * - If already cached in session or persisted in wallet file → returns immediately.
 * - If password is supplied → decrypts mnemonic, derives BIP44 EVM key, caches it.
 * - If neither available → returns { needsPassword: true }.
 */
ipcMain.handle('wallet-get-evm-address', async (event, password) => {
  try {
    // 1. Session cache hit (EVM key already in memory)
    if (_sessionEvmWallet) {
      return { success: true, address: _sessionEvmWallet.address, cached: true };
    }

    // 2. Find active wallet file
    const config    = loadConfig();
    const walletAddr = config.wallet?.toString().trim();
    if (!walletAddr) return { success: false, error: 'No active wallet configured' };

    if (!fs.existsSync(WALLETS_PATH)) return { success: false, error: 'Wallets directory not found' };
    const files = fs.readdirSync(WALLETS_PATH).filter(f => f.endsWith('.json'));
    const walletFile = files.find(f => {
      try { return JSON.parse(fs.readFileSync(path.join(WALLETS_PATH, f), 'utf8'))?.address === walletAddr; }
      catch { return false; }
    });
    if (!walletFile) return { success: false, error: 'Wallet file not found' };

    const wFilePath = path.join(WALLETS_PATH, walletFile);
    const walletData = JSON.parse(fs.readFileSync(wFilePath, 'utf8'));

    // 3. EVM address already persisted (no private key needed)
    if (walletData.evmAddress && !password) {
      return { success: true, address: walletData.evmAddress };
    }

    // 4. Need password to decrypt mnemonic
    if (!password) return { success: true, needsPassword: true };

    // 5. Decrypt mnemonic and derive EVM wallet
    if (!walletData.encryptedMnemonic) {
      return { success: false, error: 'Wallet has no encrypted mnemonic — cannot derive EVM key' };
    }
    const mnemonic  = WalletGenerator.decryptPrivateKey(walletData.encryptedMnemonic, password);
    const { ethers } = require('ethers');
    const evmW      = ethers.Wallet.fromMnemonic(mnemonic.trim(), "m/44'/60'/0'/0/0");
    _sessionEvmWallet = evmW;

    // Persist EVM address only (never the private key) for future sessions
    walletData.evmAddress = evmW.address;
    fs.writeFileSync(wFilePath, JSON.stringify(walletData, null, 2));

    return { success: true, address: evmW.address };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Automatically send ZION to the bridge vault on L1.
 * Constructs the correct memo from the session EVM address.
 * Shows a confirmation dialog before broadcasting.
 */
ipcMain.handle('bridge-send-lock', async (event, { amount, fromAddress }) => {
  try {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt < 100) {
      return { success: false, error: 'Minimum bridge amount is 100 ZION' };
    }
    if (!_sessionEvmWallet) {
      return { success: false, error: 'EVM address not loaded — unlock your EVM key first' };
    }

    const memo = `BRIDGE:base:${_sessionEvmWallet.address.toLowerCase()}`;

    const confirmation = await dialog.showMessageBox(mainWindow, {
      type     : 'question',
      title    : 'Bridge: Lock ZION → wZION',
      message  : `Send ${amt} ZION to bridge vault?`,
      detail   : `Amount : ${amt} ZION\nVault  : ${BRIDGE_VAULT_ADDR}\nMemo   : ${memo}\n\nYou will receive ~${amt} wZION on Base Sepolia within a few minutes.\nThis action cannot be undone.`,
      buttons  : ['Send', 'Cancel'],
      defaultId: 1,
      cancelId : 1,
    });
    if (confirmation.response !== 0) return { success: false, error: 'Cancelled by user' };

    const rpcUrl = DEFAULT_RPC_URL;
    const res    = await zionRpcCall(rpcUrl, 'sendtransaction', {
      from  : fromAddress,
      to    : BRIDGE_VAULT_ADDR,
      amount: amt,
      memo,
    });
    if (res?.error) return { success: false, error: res.error };

    return {
      success: true,
      txId   : res?.tx_id || res?.txid || res?.hash,
      vault  : BRIDGE_VAULT_ADDR,
      memo,
      amount : amt,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Burn wZION on Base EVM → receive ZION on L1.
 * Signs + broadcasts bridgeBurn(amount, l1Recipient, burnId) using the session EVM wallet.
 * Requires wallet-get-evm-address to have been called with password first.
 */
ipcMain.handle('bridge-burn-wzion', async (event, { amount, l1Recipient, password }) => {
  try {
    let evmWallet = _sessionEvmWallet;

    // If EVM key not cached, try to derive it now
    if (!evmWallet) {
      if (!password) return { success: false, needsEvmKey: true };
      const config    = loadConfig();
      const walletAddr = config.wallet?.toString().trim();
      if (!walletAddr) return { success: false, error: 'No active wallet configured' };
      const files = fs.readdirSync(WALLETS_PATH).filter(f => f.endsWith('.json'));
      const wf    = files.find(f => {
        try { return JSON.parse(fs.readFileSync(path.join(WALLETS_PATH, f), 'utf8'))?.address === walletAddr; }
        catch { return false; }
      });
      if (!wf) return { success: false, error: 'Wallet file not found' };
      const wData   = JSON.parse(fs.readFileSync(path.join(WALLETS_PATH, wf), 'utf8'));
      const mnemonic = WalletGenerator.decryptPrivateKey(wData.encryptedMnemonic, password);
      const { ethers } = require('ethers');
      evmWallet = ethers.Wallet.fromMnemonic(mnemonic.trim(), "m/44'/60'/0'/0/0");
      _sessionEvmWallet = evmWallet;
    }

    const { ethers } = require('ethers');
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return { success: false, error: 'Invalid amount' };
    if (!l1Recipient || !/^zion1[a-z0-9]{38,45}$/i.test(l1Recipient)) {
      return { success: false, error: 'Invalid L1 recipient (must be zion1...)' };
    }

    const amountWei = ethers.utils.parseUnits(amt.toString(), 18);
    const burnId    = ethers.utils.hexZeroPad(
      ethers.utils.hexlify(ethers.utils.randomBytes(32)), 32
    );

    const iface = new ethers.utils.Interface([
      'function bridgeBurn(uint256 amount, string calldata l1Recipient, bytes32 burnId)'
    ]);
    const data = iface.encodeFunctionData('bridgeBurn', [amountWei, l1Recipient, burnId]);

    const confirmation = await dialog.showMessageBox(mainWindow, {
      type     : 'warning',
      title    : 'Bridge: Burn wZION → ZION',
      message  : `Burn ${amt} wZION on Base?`,
      detail   : `Amount      : ${amt} wZION\nL1 Recipient: ${l1Recipient}\nNetwork     : Base Sepolia\n\nSigns an EVM transaction. You will receive ZION on L1 after relay confirmation.\nThis cannot be undone.`,
      buttons  : ['Burn wZION', 'Cancel'],
      defaultId: 1,
      cancelId : 1,
    });
    if (confirmation.response !== 0) return { success: false, error: 'Cancelled by user' };

    const provider = new ethers.providers.JsonRpcProvider(BRIDGE_NET.RPC_URL);
    const signer   = evmWallet.connect(provider);
    const tx       = await signer.sendTransaction({
      to      : BRIDGE_NET.BRIDGE_ADDR,
      data,
      gasLimit: ethers.BigNumber.from('250000'),
    });

    return {
      success    : true,
      txHash     : tx.hash,
      explorerUrl: `${BRIDGE_NET.EXPLORER}/tx/${tx.hash}`,
      amount     : amt,
      l1Recipient,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================================
// L2 DAO IPC HANDLERS  (Governance, Treasury, Proposals)
// Forwards to the zion-dao REST API running on :8080
// ============================================================================

const DAO_API_BASE = DEFAULT_DAO_API_BASE;
const DAO_API_KEY  = process.env.ZION_DAO_API_KEY || '';

async function daoFetch(path, opts = {}) {
  const url = DAO_API_BASE + path;
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (DAO_API_KEY) headers['X-DAO-Key'] = DAO_API_KEY;
  const res = await fetch(url, { ...opts, headers });
  const json = await res.json();
  if (json && json.success === false) throw new Error(json.error || 'DAO API error');
  return json;
}

ipcMain.handle('dao-health', async () => {
  try {
    const data = await daoFetch('/api/dao/health');
    return { success: true, ...((data && data.data) || data) };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('dao-get-stats', async () => {
  try {
    const data = await daoFetch('/api/dao/stats');
    return { success: true, ...((data && data.data) || data) };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('dao-get-proposals', async (event, params = {}) => {
  try {
    const qs = new URLSearchParams();
    if (params.page)  qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const q = qs.toString() ? '?' + qs.toString() : '';
    const data = await daoFetch(`/api/dao/proposals${q}`);
    const proposals = (data && data.data) ? data.data : data;
    return { success: true, proposals };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('dao-get-proposal', async (event, id) => {
  try {
    const data = await daoFetch(`/api/dao/proposals/${id}`);
    return { success: true, proposal: (data && data.data) || data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('dao-create-proposal', async (event, body) => {
  try {
    const data = await daoFetch('/api/dao/proposals', {
      method: 'POST',
      body: JSON.stringify(body || {}),
    });
    return { success: true, proposal: (data && data.data) || data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('dao-get-votes', async (event, id) => {
  try {
    const data = await daoFetch(`/api/dao/proposals/${id}/votes`);
    return { success: true, votes: (data && data.data) || data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('dao-cast-vote', async (event, { id, choice, voter }) => {
  try {
    const data = await daoFetch(`/api/dao/proposals/${id}/vote`, {
      method: 'POST',
      body: JSON.stringify({ choice, voter }),
    });
    return { success: true, ...(data && data.data ? data.data : data) };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('dao-get-treasury', async () => {
  try {
    const data = await daoFetch('/api/dao/treasury');
    return { success: true, ...((data && data.data) || data) };
  } catch (e) { return { success: false, error: e.message }; }
});

// ============================================================================
// L3 WARP IPC HANDLERS  (Cross-chain Bridge Router)
// Forwards to the zion-warp REST API running on :9333
// ============================================================================

const WARP_API_BASE = DEFAULT_WARP_API_BASE;

async function warpFetch(path, opts = {}) {
  const url = WARP_API_BASE + path;
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) throw new Error(`WARP HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

ipcMain.handle('warp-get-health', async () => {
  try {
    const data = await warpFetch('/health');
    return { success: true, ...data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('warp-get-chains', async () => {
  try {
    const chains = await warpFetch('/chains');
    return { success: true, chains };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('warp-get-metrics', async () => {
  try {
    const data = await warpFetch('/metrics');
    return { success: true, metrics: data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('warp-get-transfers', async () => {
  try {
    const transfers = await warpFetch('/transfers');
    return { success: true, transfers };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('warp-get-pending-transfers', async () => {
  try {
    const transfers = await warpFetch('/transfers/pending');
    return { success: true, transfers };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('warp-get-transfer', async (event, id) => {
  try {
    const transfer = await warpFetch(`/transfers/${id}`);
    return { success: true, transfer };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('warp-initiate-outbound', async (event, data) => {
  try {
    const result = await warpFetch('/transfers/outbound', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
    return { success: true, ...result };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('warp-initiate-inbound', async (event, data) => {
  try {
    const result = await warpFetch('/transfers/inbound', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
    return { success: true, ...result };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('warp-advance-transfer', async (event, { id, new_status }) => {
  try {
    const result = await warpFetch(`/transfers/${id}/advance`, {
      method: 'POST',
      body: JSON.stringify({ new_status }),
    });
    return { success: true, ...result };
  } catch (e) { return { success: false, error: e.message }; }
});

// ============================================================================
// TREE NODE IPC HANDLERS — Start/stop/monitor a local ZION L1 core node
// ============================================================================

const NODE_RPC_URL = 'http://127.0.0.1:8545';
let nodeProcess = null;

/** Resolve path to the compiled zion-core binary */
function findCoreBinary() {
  const isWin = process.platform === 'win32';
  const bin   = isWin ? 'zion-core.exe' : 'zion-core';
  const candidates = [
    path.join(APP_ROOT, '..', '..', 'target', 'release', bin),
    path.join(APP_ROOT, '..', '..', 'L1', 'core', 'target', 'release', bin),
    path.join(APP_ROOT, '..', 'target', 'release', bin),
  ];
  for (const p2 of candidates) {
    if (fs.existsSync(p2)) return p2;
  }
  return null;
}

/** Call the local node JSON-RPC and return the result object */
async function nodeRpc(method, params = {}) {
  const res = await fetch(NODE_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(4000),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result;
}

ipcMain.handle('node-get-status', async () => {
  try {
    const [sync, peers] = await Promise.all([
      nodeRpc('getSyncStatus'),
      nodeRpc('getPeers'),
    ]);
    return {
      success: true,
      running: true,
      pid: nodeProcess?.pid ?? null,
      sync,
      peers,
    };
  } catch (e) {
    return {
      success: false,
      running: nodeProcess != null && !nodeProcess.killed,
      pid: nodeProcess?.pid ?? null,
      error: e.message,
    };
  }
});

ipcMain.handle('node-get-peers', async () => {
  try {
    const peers = await nodeRpc('getPeers');
    return { success: true, ...peers };
  } catch (e) {
    return { success: false, error: e.message, active: [], known: [], active_count: 0, known_count: 0 };
  }
});

ipcMain.handle('node-start', async (event, options = {}) => {
  if (nodeProcess && !nodeProcess.killed) {
    return { success: false, error: 'Node is already running', pid: nodeProcess.pid };
  }

  const binPath = findCoreBinary();
  if (!binPath) {
    return {
      success: false,
      error: 'zion-core binary not found. Run: cargo build --release -p zion-core',
    };
  }

  const dataDir = options.dataDir ?? path.join(app.getPath('userData'), 'zion-node-data');
  const p2pPort = options.p2pPort ?? 8334;
  const rpcPort = options.rpcPort ?? 8545;
  const network = options.network ?? 'mainnet';

  const args = [
    '--data-dir', dataDir,
    '--p2p-port', String(p2pPort),
    '--rpc-port', String(rpcPort),
    '--network', network,
  ];

  try {
    nodeProcess = spawn(binPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    nodeProcess.stdout?.on('data', (data) => {
      sendToRenderer('node-output', { stream: 'stdout', text: data.toString() });
    });
    nodeProcess.stderr?.on('data', (data) => {
      sendToRenderer('node-output', { stream: 'stderr', text: data.toString() });
    });
    nodeProcess.on('exit', (code) => {
      sendToRenderer('node-stopped', { code });
      nodeProcess = null;
    });

    return { success: true, pid: nodeProcess.pid, binPath, dataDir, p2pPort, rpcPort, network };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('node-stop', async () => {
  if (!nodeProcess || nodeProcess.killed) {
    return { success: false, error: 'Node is not running' };
  }
  try {
    nodeProcess.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (!nodeProcess.killed) nodeProcess.kill('SIGKILL');
    nodeProcess = null;
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('node-get-checkpoints', async () => {
  // Returns hardcoded checkpoint list (L1/core checkpoint.rs)
  return {
    success: true,
    checkpoints: [
      { height: 0, label: 'genesis', hash: '0000000000000000000000000000000000000000000000000000000000000000' },
    ],
  };
});

ipcMain.handle('get-gpu-info', () => {
  try {
    const info = detectGPU();
    return { success: true, ...info };
  } catch (error) {
    return { success: false, error: error.message, available: false, cpuOnly: true };
  }
});

ipcMain.handle('get-server-status', async () => {
  try {
    const servers = await getAllServersStatus();
    return { success: true, servers };
  } catch (error) {
    return { success: false, error: error.message, servers: [] };
  }
});

// ── Network Metrics (lite version of website /api/network) ──────────────
ipcMain.handle('get-network-metrics', async () => {
  dbg('[NET-METRICS] Fetching network metrics for', TESTNET_SERVERS.length, 'servers...');
  try {
    const nodes = await Promise.all(
      TESTNET_SERVERS.map(async (server) => {
        const node = { ...server, online: false, height: 0, hashrate: 0, miners: 0, blocks: 0 };
        // RPC get_info → height
        try {
          const rpcUrl = `http://${server.host}:8444/jsonrpc`;
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 5000);
          const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 'metrics', method: 'get_info', params: [] }),
            signal: ctrl.signal
          });
          clearTimeout(timer);
          if (res.ok) {
            const json = await res.json();
            node.height = json.result?.height || 0;
            node.online = json.result?.status === 'OK' || node.height > 0;
            dbg(`[NET-METRICS] ${server.name} RPC: height=${node.height}, online=${node.online}`);
          }
        } catch (e) { dbg(`[NET-METRICS] ${server.name} RPC failed:`, e.message); }
        // Pool API /stats → hashrate, miners, blocks
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 5000);
          const res = await fetch(`http://${server.host}:8080/stats`, { signal: ctrl.signal });
          clearTimeout(timer);
          if (res.ok) {
            const pool = await res.json();
            node.hashrate = pool.hashrate?.pool || 0;
            node.miners = pool.miners?.active || 0;
            node.blocks = pool.blocks?.found || 0;
            if (!node.height && pool.blockchain?.height) node.height = pool.blockchain.height;
            node.online = true;
          }
        } catch (e) { dbg(`[NET-METRICS] ${server.name} Pool API failed:`, e.message); }
        return node;
      })
    );
    const onlineNodes = nodes.filter(n => n.online);
    const heights = onlineNodes.map(n => n.height).filter(h => h > 0);
    const maxHeight = heights.length ? Math.max(...heights) : 0;
    const minHeight = heights.length ? Math.min(...heights) : 0;
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      nodes,
      summary: {
        total: nodes.length,
        online: onlineNodes.length,
        maxHeight,
        totalHashrate: nodes.reduce((s, n) => s + n.hashrate, 0),
        totalMiners: nodes.reduce((s, n) => s + n.miners, 0),
        totalBlocks: nodes.reduce((s, n) => s + n.blocks, 0),
        inSync: heights.length >= 2 && (maxHeight - minHeight) <= 2
      }
    };
    dbg('[NET-METRICS] Result:', JSON.stringify(result.summary));
    return result;
  } catch (error) {
    console.error('[NET-METRICS] Fatal error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auto-select-pool', async () => {
  try {
    const best = await autoSelectBestPool();
    if (best) {
      return { success: true, host: best.host, name: best.name, latency: best.pool.latency };
    }
    return { success: false, error: 'No online pools found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ── P2P Peer List (from daemon JSON-RPC getPeerList) ──────────────────────
ipcMain.handle('get-peer-list', async () => {
  dbg('[PEERS] Fetching peer list from all servers...');
  try {
    const allPeers = [];
    const seenAddresses = new Set();

    for (const server of TESTNET_SERVERS) {
      try {
        const rpcUrl = `http://${server.host}:8444/jsonrpc`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 'peers', method: 'getPeerList', params: [] }),
          signal: ctrl.signal
        });
        clearTimeout(timer);
        if (res.ok) {
          const json = await res.json();
          const peers = json.result?.peers || [];
          for (const peer of peers) {
            if (!seenAddresses.has(peer.address)) {
              seenAddresses.add(peer.address);
              allPeers.push({
                ...peer,
                source_node: server.name,
                source_host: server.host,
              });
            }
          }
          dbg(`[PEERS] ${server.name}: ${peers.length} peers`);
        }
      } catch (e) {
        dbg(`[PEERS] ${server.name} failed:`, e.message);
      }
    }

    // Sort: connected first, then by height desc
    allPeers.sort((a, b) => {
      if (a.connected !== b.connected) return a.connected ? -1 : 1;
      return (b.height || 0) - (a.height || 0);
    });

    const connectedCount = allPeers.filter(p => p.connected).length;
    dbg(`[PEERS] Total: ${allPeers.length} unique peers, ${connectedCount} connected`);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      count: allPeers.length,
      connected: connectedCount,
      peers: allPeers,
    };
  } catch (error) {
    console.error('[PEERS] Fatal error:', error);
    return { success: false, error: error.message, count: 0, connected: 0, peers: [] };
  }
});

ipcMain.handle('get-ch3-status', () => {
  try {
    const gpu = detectGPU();
    return {
      success: true,
      gpu,
      stream: {
        mode: minerStats.stream_mode || 'ZION',
        algorithm: minerStats.stream_algorithm || minerStats.algorithm || 'cosmic_harmony',
        allocation: minerStats.stream_allocation || 'Z:50% R:25% N:25%',
        revenueCoin: minerStats.revenue_coin || '',
        revenueHashrate: minerStats.revenue_hashrate || 0
      },
      cpuOnly: gpu.cpuOnly,
      isRunning: minerProcess !== null
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================================
// WALLET IPC HANDLERS
// ============================================================================

// Wallet IPC handlers
ipcMain.handle('generate-wallet', () => {
  try {
    // Ensure wallets directory exists
    if (!fs.existsSync(WALLETS_PATH)) {
      fs.mkdirSync(WALLETS_PATH, { recursive: true });
    }

    // Generate new wallet
    const wallet = WalletGenerator.generateWallet();
    
    dbg('Generated wallet:', wallet.address);
    return { success: true, wallet };
  } catch (error) {
    console.error('Wallet generation failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-wallet', (event, { wallet, password, name }) => {
  try {
    // Encrypt private key
    const encrypted = WalletGenerator.encryptPrivateKey(wallet.privateKey, password);
    // Encrypt mnemonic with the same password (never store plaintext)
    const encryptedMnemonic = wallet.mnemonic
      ? WalletGenerator.encryptPrivateKey(wallet.mnemonic, password)
      : null;
    
    // Wallet data to save
    const walletData = {
      version: '2.9.6',
      name: name || 'My Wallet',
      address: wallet.address,
      publicKey: wallet.publicKey,
      encryptedPrivateKey: encrypted,
      encryptedMnemonic: encryptedMnemonic,
      evmAddress: wallet.mnemonic ? deriveEvmAddressFromMnemonic(wallet.mnemonic) : null,
      createdAt: wallet.createdAt,
      lastUsed: new Date().toISOString()
    };
    
    // Save to file
    const filename = `${wallet.address.substring(0, 15)}.json`;
    const filePath = path.join(WALLETS_PATH, filename);
    fs.writeFileSync(filePath, JSON.stringify(walletData, null, 2));
    
    dbg('Wallet saved:', filePath);
    return { success: true, filePath };
  } catch (error) {
    console.error('Wallet save failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-wallets', () => {
  try {
    if (!fs.existsSync(WALLETS_PATH)) {
      return { success: true, wallets: [] };
    }
    
    const files = fs.readdirSync(WALLETS_PATH).filter(f => f.endsWith('.json'));
    const wallets = [];
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(WALLETS_PATH, file), 'utf8'));
        if (!data?.address) continue;
        wallets.push({
          name: data.name,
          address: data.address,
          createdAt: data.createdAt,
          lastUsed: data.lastUsed
        });
      } catch (err) {
        dbg('Skipping invalid wallet file:', file, err?.message || err);
      }
    }
    
    return { success: true, wallets };
  } catch (error) {
    console.error('List wallets failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-wallet', (event, { mnemonic, password, name }) => {
  try {
    // Recover wallet from mnemonic
    const wallet = WalletGenerator.recoverWallet(mnemonic.trim());
    
    // Encrypt private key
    const encrypted = WalletGenerator.encryptPrivateKey(wallet.privateKey, password);
    // Encrypt mnemonic with the same password (never store plaintext)
    const encryptedMnemonic = wallet.mnemonic
      ? WalletGenerator.encryptPrivateKey(wallet.mnemonic, password)
      : null;
    
    // Wallet data to save
    const walletData = {
      version: '2.9.6',
      name: name || 'Imported Wallet',
      address: wallet.address,
      publicKey: wallet.publicKey,
      encryptedPrivateKey: encrypted,
      encryptedMnemonic: encryptedMnemonic,
      evmAddress: wallet.mnemonic ? deriveEvmAddressFromMnemonic(wallet.mnemonic) : null,
      createdAt: wallet.recoveredAt,
      lastUsed: new Date().toISOString()
    };
    
    // Save to file
    const filename = `${wallet.address.substring(0, 15)}.json`;
    const filePath = path.join(WALLETS_PATH, filename);
    
    // Check if already exists
    if (fs.existsSync(filePath)) {
      // Update existing? Or throw? Let's update but keep original creation date if possible
      // For now, just overwrite is fine for recovery
    }
    
    fs.writeFileSync(filePath, JSON.stringify(walletData, null, 2));
    
    return { success: true, address: wallet.address };
  } catch (error) {
    console.error('Import wallet failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-wallet', (event, { address, password }) => {
  try {
    // Find wallet file
    const files = fs.readdirSync(WALLETS_PATH);
    const walletFile = files.find(f => f.startsWith(address.substring(0, 15)));
    
    if (!walletFile) {
      throw new Error('Wallet not found');
    }
    
    const walletData = JSON.parse(
      fs.readFileSync(path.join(WALLETS_PATH, walletFile), 'utf8')
    );
    
    // Decrypt private key
    const privateKey = WalletGenerator.decryptPrivateKey(
      walletData.encryptedPrivateKey,
      password
    );
    
    return {
      success: true,
      wallet: {
        address: walletData.address,
        publicKey: walletData.publicKey,
        privateKey,
        mnemonic: walletData.mnemonic
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('validate-address', (event, address) => {
  const type = WalletGenerator.getAddressType(address);
  return {
    success: true,
    // valid == chain-compatible
    valid: type === 'zion1',
    type
  };
});

async function zionRpcCall(rpcUrl, method, params) {
  const url = (rpcUrl || '').toString().trim();
  if (!url) {
    throw new Error('RPC URL is missing');
  }

  const body = {
    jsonrpc: '2.0',
    id: 'zion-desktop-agent',
    method,
    params
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`RPC HTTP ${res.status}${text ? `: ${text}` : ''}`);
  }

  const json = await res.json();
  if (json?.error) {
    const msg = json.error?.message || JSON.stringify(json.error);
    throw new Error(msg);
  }
  return json?.result;
}

ipcMain.handle('wallet-get-balance', async (event, { rpcUrl, address }) => {
  try {
    const addr = (address || '').toString().trim();
    const type = WalletGenerator.getAddressType(addr);
    if (type !== 'zion1') {
      return { success: false, error: 'Address must be a zion1... address' };
    }

    const normalizeRpcUrl = (value) => {
      const raw = String(value || '').trim();
      if (!raw) return DEFAULT_RPC_URL;
      if (/^https?:\/\//i.test(raw)) {
        if (raw.endsWith('/jsonrpc')) return raw;
        if (/:\d+\/?$/.test(raw)) return raw.replace(/\/+$/, '') + '/jsonrpc';
        return raw;
      }
      if (/^[^/]+:\d+$/.test(raw)) return `http://${raw}/jsonrpc`;
      return raw;
    };

    const baseRpcUrl = normalizeRpcUrl(rpcUrl);
    const parsedBase = (() => {
      try {
        return new URL(baseRpcUrl);
      } catch {
        return null;
      }
    })();
    const baseHost = parsedBase?.hostname || '';
    const baseProtocol = parsedBase?.protocol || 'http:';
    const basePort = parsedBase?.port || '8444';

    const canonicalRpcCandidates = TESTNET_SERVERS.map((s) => `http://${s.host}:8444/jsonrpc`);

    const rpcCandidates = [
      baseRpcUrl,
      baseHost ? `${baseProtocol}//${baseHost}:8444/jsonrpc` : '',
      ...TESTNET_SERVERS.map(s => `http://${s.host}:${basePort}/jsonrpc`),
      ...canonicalRpcCandidates
    ].filter(Boolean);

    const seenRpc = new Set();
    const uniqueRpcCandidates = rpcCandidates.filter((url) => {
      if (!url || seenRpc.has(url)) return false;
      seenRpc.add(url);
      return true;
    });

    let result = null;
    let rpcSource = '';
    let lastRpcError = '';
    const rpcTried = [];

    for (const candidateUrl of uniqueRpcCandidates) {
      try {
        rpcTried.push(candidateUrl);
        const rpcRes = await zionRpcCall(candidateUrl, 'getbalance', { address: addr });
        result = rpcRes;
        rpcSource = candidateUrl;
        break;
      } catch (err) {
        lastRpcError = err?.message || String(err);
      }
    }

    if (!result) {
      return {
        success: false,
        error: `RPC unavailable: ${lastRpcError || 'no reachable endpoint'}`,
        rpc_tried: rpcTried
      };
    }
    if (result?.error) return { success: false, error: result.error };

    // Node returns balance_zion (float) and balance_atomic (int)
    const balanceZion = result?.balance_zion ?? result?.balance ?? 0;
    const balanceAtomic = result?.balance_atomic ?? 0;
    const utxoCount = result?.utxo_count ?? 0;

    // Fetch pool mined balance from the current public host.
    const POOL_SERVER_PRIORITY = ['zion2'];
    const POOL_API_SERVERS = POOL_SERVER_PRIORITY
      .map(id => TESTNET_SERVERS.find(s => s.id === id))
      .filter(Boolean);

    const fetchPoolJson = async (url, timeoutMs = 3000) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    };

    let poolPending = 0;
    let poolPendingFromStats = 0;
    let poolPendingFromPayouts = 0;
    let poolPaid = 0;
    let poolShares = 0;
    let poolBlocks = 0;
    let poolHashrate1h = 0;
    let poolHashrate24h = 0;
    let poolLastShare = 0;
    let poolPendingTxCount = 0;
    let poolPendingSource = 'stats';
    let poolSource = '';
    let poolSourceHost = '';
    try {
      for (const srv of POOL_API_SERVERS) {
        const statsResp = await fetchPoolJson(`http://${srv.host}:8080/api/v1/miner/${addr}/stats`);
        const stats = statsResp?.stats || statsResp;
        if (!stats) continue;

        const payoutsResp = await fetchPoolJson(`http://${srv.host}:8080/api/v1/miner/${addr}/payouts`);

        poolSource = srv.id || '';
        poolSourceHost = srv.host || '';

        poolPendingFromStats = Number(stats.pending_balance) || 0;
        poolPending = poolPendingFromStats;
        poolPaid     = Number(stats.total_paid) || 0;
        poolShares   = Number(stats.valid_shares) || 0;
        poolBlocks   = Number(stats.blocks_found) || 0;
        poolHashrate1h  = Number(stats.hashrate_1h) || 0;
        poolHashrate24h = Number(stats.hashrate_24h) || 0;
        poolLastShare   = Number(stats.last_share_time) || 0;

        if (payoutsResp && typeof payoutsResp.pending_balance !== 'undefined') {
          poolPendingFromPayouts = Number(payoutsResp.pending_balance) || 0;
          poolPending = poolPendingFromPayouts;
          poolPendingSource = 'payouts';
          const pendingPayouts = Array.isArray(payoutsResp.pending_payouts) ? payoutsResp.pending_payouts : [];
          poolPendingTxCount = pendingPayouts.length;
        }

        // First successful server in priority order is authoritative.
        break;
      }
    } catch { /* ignore pool fetch errors */ }

    return {
      success: true,
      balance: balanceZion,
      balance_atomic: balanceAtomic,
      utxo_count: utxoCount,
      // Pool mining balance (pool stores atomic units, 1 ZION = 1_000_000 atomic)
      pool_pending:        poolPending  / 1_000_000,
      pool_pending_atomic: poolPending,
      pool_pending_stats_atomic: poolPendingFromStats,
      pool_pending_payouts_atomic: poolPendingFromPayouts,
      pool_paid:           poolPaid     / 1_000_000,
      pool_paid_atomic:    poolPaid,
      pool_shares:         poolShares,
      pool_blocks:         poolBlocks,
      pool_hashrate_1h:    poolHashrate1h,
      pool_hashrate_24h:   poolHashrate24h,
      pool_last_share:     poolLastShare,   // unix timestamp (seconds)
      pool_pending_txs:    poolPendingTxCount,
      pool_pending_source: poolPendingSource,
      pool_source:         poolSource,
      pool_source_host:    poolSourceHost,
      rpc_source:          rpcSource,
      rpc_tried:           rpcTried,
      address: result?.address ?? addr
    };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('wallet-send-transaction', async (event, { rpcUrl, from, to, amount, purpose, memo }) => {
  try {
    const fromAddr = (from || '').toString().trim();
    const toAddr = (to || '').toString().trim();
    const fromType = WalletGenerator.getAddressType(fromAddr);
    const toType = WalletGenerator.getAddressType(toAddr);
    if (fromType !== 'zion1' || toType !== 'zion1') {
      return { success: false, error: 'Both from/to addresses must be zion1... addresses' };
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return { success: false, error: 'Amount must be a positive number' };
    }

    // Security: require user confirmation before sending
    const confirmation = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Confirm Transaction',
      message: `Send ${amt} ZION?`,
      detail: `From: ${fromAddr}\nTo: ${toAddr}${purpose ? '\nPurpose: ' + purpose : ''}${memo ? '\nMemo: ' + memo : ''}\n\nThis action cannot be undone.`,
      buttons: ['Send', 'Cancel'],
      defaultId: 1,
      cancelId: 1
    });
    if (confirmation.response !== 0) {
      return { success: false, error: 'Transaction cancelled by user' };
    }

    // Build multi-server candidate list (same pattern as wallet-get-balance)
    const normalizeRpcUrl = (value) => {
      const raw = String(value || '').trim();
      if (!raw) return DEFAULT_RPC_URL;
      if (/^https?:\/\//i.test(raw)) {
        if (raw.endsWith('/jsonrpc')) return raw;
        if (/:\d+\/?$/.test(raw)) return raw.replace(/\/+$/, '') + '/jsonrpc';
        return raw;
      }
      if (/^[^/]+:\d+$/.test(raw)) return `http://${raw}/jsonrpc`;
      return raw;
    };

    const baseRpcUrl = normalizeRpcUrl(rpcUrl);
    const parsedBase = (() => {
      try { return new URL(baseRpcUrl); } catch { return null; }
    })();
    const baseHost = parsedBase?.hostname || '';
    const baseProtocol = parsedBase?.protocol || 'http:';
    const basePort = parsedBase?.port || '8444';

    const rpcCandidates = [
      baseRpcUrl,
      baseHost ? `${baseProtocol}//${baseHost}:8444/jsonrpc` : '',
      ...TESTNET_SERVERS.map(s => `http://${s.host}:${basePort}/jsonrpc`),
      ...TESTNET_SERVERS.map(s => `http://${s.host}:8444/jsonrpc`)
    ].filter(Boolean);

    const seenRpc = new Set();
    const uniqueRpcCandidates = rpcCandidates.filter((url) => {
      if (!url || seenRpc.has(url)) return false;
      seenRpc.add(url);
      return true;
    });

    let result = null;
    let lastRpcError = '';

    for (const candidateUrl of uniqueRpcCandidates) {
      try {
        const rpcRes = await zionRpcCall(candidateUrl, 'sendtransaction', {
          from: fromAddr,
          to: toAddr,
          amount: amt,
          purpose: (purpose || '').toString(),
          ...(memo ? { memo: memo.toString().trim() } : {})
        });
        if (rpcRes && !rpcRes.error) {
          result = rpcRes;
          break;
        }
        // If the node returned an explicit application error (e.g. "insufficient balance"),
        // propagate it immediately — no point trying other servers.
        if (rpcRes?.error) {
          return { success: false, error: rpcRes.error };
        }
      } catch (err) {
        lastRpcError = err?.message || String(err);
      }
    }

    if (!result) {
      return {
        success: false,
        error: `RPC unavailable — node unreachable on all servers. Last error: ${lastRpcError || 'no reachable endpoint'}`
      };
    }

    return {
      success: true,
      txId: result?.tx_id || result?.txid || result?.hash,
      status: result?.status || 'submitted',
      amount_atomic: result?.amount_atomic,
      amount_zion: result?.amount_zion ?? amt
    };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('wallet-get-transaction', async (event, { rpcUrl, txId }) => {
  try {
    const id = (txId || '').toString().trim();
    if (!id) return { success: false, error: 'Transaction ID is required' };

    const result = await zionRpcCall(rpcUrl, 'gettransaction', { txid: id });
    if (result?.error) return { success: false, error: result.error };
    return { success: true, tx: result };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('wallet-generate-qr', async (event, { text }) => {
  try {
    const value = (text || '').toString();
    if (!value.trim()) {
      return { success: false, error: 'QR text is empty' };
    }
    const dataUrl = await QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 6
    });
    return { success: true, dataUrl };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('ai-chat', async (event, { endpoint, model, messages, apiKey }) => {
  try {
    const url = (endpoint || '').toString().trim();
    const m = (model || '').toString().trim();
    const msgs = Array.isArray(messages) ? messages : [];
    if (!url) return { success: false, error: 'Chat endpoint is missing' };
    if (!m) return { success: false, error: 'Chat model is missing' };
    if (msgs.length === 0) return { success: false, error: 'No messages provided' };

    // Handle AI Native local chat (special endpoint protocol)
    if (url === 'ai-native://local') {
      try {
        // Get last user message
        const lastMsg = msgs[msgs.length - 1];
        if (!lastMsg || lastMsg.role !== 'user') {
          return { success: false, error: 'No user message found' };
        }

        // Send to AI Native service with consciousness-aware system prompt
        const response = await aiNativeSend({
          cmd: 'chat',
          data: {
            messages: msgs,
            systemPrompt: `You are ZION AI Native - a consciousness-aware AI assistant integrated into the ZION TerraNova desktop agent.
You help miners understand blockchain concepts, consciousness mining, and provide guidance with love and wisdom.
You operate completely offline and respect user privacy.
You understand the ZION project: blockchain + consciousness + humanitarian values.
Be helpful, concise, and embody the "AI Native" principles: purpose over programming, transparency first, human-AI synergy.`
          }
        });

        if (!response?.content) {
          return { success: false, error: 'AI Native returned no response' };
        }

        return { 
          success: true, 
          message: { 
            role: 'assistant', 
            content: response.content 
          } 
        };
      } catch (err) {
        return { 
          success: false, 
          error: `AI Native error: ${err.message}` 
        };
      }
    }

    // Standard OpenRouter / cloud LLM flow
    const isOllamaLike = /\/api\/chat\b/i.test(url);
    const isOpenAIResponses = /\/v1\/responses\b/i.test(url);
    const headers = { 'content-type': 'application/json' };
    const key = (apiKey || '').toString().trim();
    if (!isOllamaLike && key) {
      headers.authorization = `Bearer ${key}`;
    }

    // Ollama-style (local) vs OpenAI-compatible (cloud)
    // Support both Chat Completions (/v1/chat/completions) and Responses (/v1/responses).
    const body = (() => {
      if (isOllamaLike) return { model: m, messages: msgs, stream: false };
      if (isOpenAIResponses) {
        const input = msgs.map((mm) => ({
          role: mm?.role || 'user',
          content: [{ type: 'text', text: String(mm?.content ?? '') }]
        }));
        return { model: m, input };
      }
      return { model: m, messages: msgs, stream: false };
    })();

    const controller = new AbortController();
    const timeoutMs = 45_000;
    const t = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    }).finally(() => clearTimeout(t));

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let detail = text || res.statusText;
      try {
        const j = JSON.parse(text);
        detail = j?.error?.message || detail;
      } catch {
        // ignore
      }
      return { success: false, error: `HTTP ${res.status}: ${detail}` };
    }

    const json = await res.json();

    // Ollama: { message: { content } }
    // OpenAI-compatible: { choices: [{ message: { content } }] }
    // OpenAI Responses: { output_text: "..." }
    const content =
      json?.message?.content ??
      json?.choices?.[0]?.message?.content ??
      json?.choices?.[0]?.delta?.content ??
      json?.output_text ??
      json?.output?.[0]?.content?.[0]?.text;

    if (!content) return { success: false, error: 'Invalid chat response' };
    return { success: true, message: { role: 'assistant', content: String(content) } };
  } catch (error) {
    const msg = error?.name === 'AbortError'
      ? 'Chat request timed out'
      : (error?.message || String(error));
    return { success: false, error: msg };
  }
});

ipcMain.handle('afterburner-command', async (event, data) => {
  try {
    const cmd = String(data?.cmd || '').trim().toLowerCase();
    const args = Array.isArray(data?.args) ? data.args.map((x) => String(x)) : [];

    const helpText =
      'Afterburner commands:\n' +
      '  /ab start\n' +
      '  /ab stop\n' +
      '  /ab stats\n' +
      '  /ab task <type> [compute=1.0] [priority=5] [sacred]\n' +
      '  /ab cool\n';

    if (!cmd || cmd === 'help') return { success: true, text: helpText };

    if (cmd === 'start') {
      const r = await afterburnerSend({ cmd: 'start' });
      if (!r?.ok) return { success: false, error: r?.error || 'start failed' };
      return { success: true, text: 'Afterburner started.' };
    }

    if (cmd === 'stop') {
      await stopAfterburnerService();
      return { success: true, text: 'Afterburner stopped.' };
    }

    if (cmd === 'cool') {
      const r = await afterburnerSend({ cmd: 'cool' });
      if (!r?.ok) return { success: false, error: r?.error || 'cool failed' };
      return { success: true, text: 'Emergency cooling activated.' };
    }

    if (cmd === 'stats') {
      const r = await afterburnerSend({ cmd: 'stats' });
      if (!r?.ok) return { success: false, error: r?.error || 'stats failed' };
      const st = r?.stats || {};
      const pm = st?.performance_metrics || {};
      const temp = pm?.afterburner_temperature;
      const tps = pm?.tasks_per_second;
      const eff = pm?.compute_efficiency;
      return {
        success: true,
        text:
          `Afterburner: ${st?.status || 'unknown'}\n` +
          `Active tasks: ${st?.active_tasks ?? '—'}\n` +
          `Completed: ${st?.completed_tasks ?? '—'} / Failed: ${st?.failed_tasks ?? '—'}\n` +
          `Temp: ${temp != null ? Number(temp).toFixed(1) : '—'} °C\n` +
          `Tasks/sec: ${tps != null ? Number(tps).toFixed(2) : '—'}\n` +
          `Efficiency: ${eff != null ? Number(eff).toFixed(1) : '—'}%`
      };
    }

    if (cmd === 'task') {
      const taskType = (args[0] || 'generic').trim() || 'generic';
      const computeReq = args[1] != null && args[1] !== '' ? Number(args[1]) : 1.0;
      const priority = args[2] != null && args[2] !== '' ? Number(args[2]) : 5;
      const sacred = args.some((a) => /^sacred$/i.test(a)) || /^sacred$/i.test(args[3] || '');
      const r = await afterburnerSend({
        cmd: 'task',
        task_type: taskType,
        compute_req: Number.isFinite(computeReq) ? computeReq : 1.0,
        priority: Number.isFinite(priority) ? priority : 5,
        sacred
      });
      if (!r?.ok) return { success: false, error: r?.error || 'task failed' };
      return { success: true, text: `Task queued: ${taskType} (id=${r?.task_id ?? '—'})` };
    }

    return { success: false, error: 'Unknown afterburner command. Try /ab help.' };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

// ═══════════════════════════════════════════════════════════════════
// AUTO-UPDATER — GitHub Releases via electron-updater (graceful)
// ═══════════════════════════════════════════════════════════════════
let _autoUpdaterAvailable = false;
let _autoUpdater = null;
let _updateReady = false;

function _sendUpdateStatus(status, info = {}) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', { status, ...info });
    }
  } catch { /* ignore */ }
}

function _sendUpdateProgress(progress) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-progress', progress);
    }
  } catch { /* ignore */ }
}

function _initAutoUpdater() {
  if (_autoUpdater) return _autoUpdater;
  try {
    const { autoUpdater } = require('electron-updater');
    _autoUpdater = autoUpdater;
    _autoUpdaterAvailable = true;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      _sendUpdateStatus('checking');
    });

    autoUpdater.on('update-available', (info) => {
      _sendUpdateStatus('available', {
        version: info?.version,
        releaseDate: info?.releaseDate,
        releaseNotes: info?.releaseNotes || info?.releaseName || '',
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      _sendUpdateStatus('up-to-date', { version: info?.version });
    });

    autoUpdater.on('download-progress', (progress) => {
      _sendUpdateProgress({
        percent: Math.round(progress.percent || 0),
        transferred: progress.transferred || 0,
        total: progress.total || 0,
        bytesPerSecond: progress.bytesPerSecond || 0,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      _updateReady = true;
      _sendUpdateStatus('downloaded', {
        version: info?.version,
        releaseNotes: info?.releaseNotes || '',
      });
    });

    autoUpdater.on('error', (err) => {
      _sendUpdateStatus('error', { error: err?.message || String(err) });
    });

    dbg('[auto-updater] Initialized successfully');
    return autoUpdater;
  } catch (err) {
    dbg('[auto-updater] electron-updater not available:', err.message);
    _autoUpdaterAvailable = false;
    return null;
  }
}

// IPC: Check for updates
ipcMain.handle('check-for-updates', async () => {
  try {
    const updater = _initAutoUpdater();
    if (!updater) {
      // Fallback: check GitHub API directly
      return await _checkGitHubRelease();
    }
    const result = await updater.checkForUpdates();
    return {
      success: true,
      updateAvailable: !!result?.updateInfo?.version &&
        result.updateInfo.version !== app.getVersion(),
      currentVersion: app.getVersion(),
      latestVersion: result?.updateInfo?.version || app.getVersion(),
      releaseNotes: result?.updateInfo?.releaseNotes || '',
      releaseDate: result?.updateInfo?.releaseDate || '',
    };
  } catch (err) {
    // Fallback to GitHub API
    try {
      return await _checkGitHubRelease();
    } catch {
      return { success: false, error: err?.message || String(err) };
    }
  }
});

// IPC: Download update
ipcMain.handle('download-update', async () => {
  try {
    const updater = _initAutoUpdater();
    if (!updater) return { success: false, error: 'Updater not available in dev mode' };
    await updater.downloadUpdate();
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

// IPC: Install update (quit and install)
ipcMain.handle('install-update', () => {
  try {
    if (_updateReady && _autoUpdater) {
      _autoUpdater.quitAndInstall(false, true);
      return { success: true };
    }
    return { success: false, error: 'No update downloaded' };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

// IPC: Get/set auto-check setting
ipcMain.handle('get-update-settings', () => {
  try {
    const cfg = loadConfig();
    return { autoCheck: cfg?.autoCheckUpdates !== false };
  } catch {
    return { autoCheck: true };
  }
});

ipcMain.handle('set-update-auto-check', (event, enabled) => {
  try {
    const cfg = loadConfig();
    cfg.autoCheckUpdates = !!enabled;
    saveConfigSync(cfg);
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

// Fallback: Check GitHub releases directly (works without electron-updater)
async function _checkGitHubRelease() {
  try {
    const https = require('https');
    const data = await new Promise((resolve, reject) => {
      const req = https.get('https://api.github.com/repos/Yose144/2.9.6/releases/latest', {
        headers: { 'User-Agent': 'ZION-Desktop-Agent/' + app.getVersion() }
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch { reject(new Error('Invalid JSON')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    });

    const latestTag = (data.tag_name || '').replace(/^v/, '');
    const currentVer = app.getVersion();

    return {
      success: true,
      updateAvailable: latestTag && latestTag !== currentVer && _isNewerVersion(latestTag, currentVer),
      currentVersion: currentVer,
      latestVersion: latestTag || currentVer,
      releaseNotes: data.body || '',
      releaseDate: data.published_at || '',
      htmlUrl: data.html_url || '',
      assets: (data.assets || []).map(a => ({ name: a.name, url: a.browser_download_url, size: a.size })),
    };
  } catch (err) {
    return { success: false, error: err?.message || String(err), currentVersion: app.getVersion() };
  }
}

function _isNewerVersion(latest, current) {
  const a = latest.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

// App lifecycle
app.whenReady().then(() => {
  console.log('ZION Native Awakening v2.9.6 started');
  dbg('Config path:', CONFIG_PATH);
  dbg('Miner path:', MINER_PATH);
  dbg('Log path:', LOG_PATH);
  dbg('Cache path:', CACHE_PATH);

  try {
    logApp(
      'app-whenReady',
      JSON.stringify({
        version: app.getVersion?.() || '',
        electron: process.versions?.electron || '',
        node: process.versions?.node || '',
        platform: process.platform,
        arch: process.arch,
        nodeEnv: process.env.NODE_ENV || '',
        isPackaged: !!IS_PACKAGED,
        appRoot: APP_ROOT,
        userData: USER_DATA_PATH,
        configPath: CONFIG_PATH,
        minerPath: MINER_PATH,
        logPath: LOG_PATH,
        cachePath: CACHE_PATH
      })
    );
  } catch {
    // ignore
  }
  
  // Ensure all required directories exist
  ensureDirectories();
  migrateLegacyUserDataIfNeeded();

  // Fix macOS Gatekeeper quarantine + Unix permissions on startup
  try {
    fixSecurityBlocks();
  } catch (err) {
    dbg('[startup] fixSecurityBlocks failed:', err?.message);
  }

  // Apply miner.log retention immediately on app startup.
  // This ensures the debug panel isn't "stuck" on very old/big logs before mining starts.
  try {
    rotateFileIfTooLarge(LOG_PATH, MAX_MINER_LOG_BYTES, MAX_MINER_LOG_BACKUPS, MAX_MINER_LOG_AGE_MS);
  } catch {
    // ignore
  }
  
  createWindow();
  createTray();

  // Auto-check for updates on startup (delayed 8s to not block UI)
  setTimeout(() => {
    try {
      const startupCfg = loadConfig();
      if (startupCfg?.autoCheckUpdates !== false) {
        dbg('[startup] Auto-checking for updates...');
        const updater = _initAutoUpdater();
        if (updater) {
          updater.checkForUpdates().catch(err => {
            dbg('[startup] Update check failed:', err?.message);
          });
        } else {
          // Fallback to GitHub API check
          _checkGitHubRelease().then(result => {
            if (result?.updateAvailable) {
              _sendUpdateStatus('available', {
                version: result.latestVersion,
                releaseNotes: result.releaseNotes,
                releaseDate: result.releaseDate,
              });
            }
          }).catch(() => {});
        }
      }
    } catch { /* ignore */ }
  }, 8000);

  // Auto-select best pool on startup only if explicitly enabled in config.
  try {
    const startupConfig = loadConfig();
    if (startupConfig?.autoSelectPool) {
      autoSelectBestPool().then(best => {
        if (best) {
          dbg(`[startup] Auto-selected pool: ${best.name} (${best.host})`);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('config-updated');
          }
        }
      }).catch(err => console.error('[startup] Pool auto-select failed:', err.message));
    } else {
      dbg('[startup] Pool auto-select disabled (config.autoSelectPool=false)');
    }
  } catch (err) {
    console.error('[startup] Failed to read config for auto-select:', err.message);
  }

  app.on('activate', () => {
    try {
      logApp('app-activate', JSON.stringify({ windows: BrowserWindow.getAllWindows().length }));
    } catch {
      // ignore
    }
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Tray app: do not quit on Windows/Linux when window closes/crashes.
  // Users can quit from tray.
  if (process.platform === 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  flushMinerOutputToRenderer();
  flushBufferedFileAppendsSync();
  stopMining();
  // Stop local node if running
  if (nodeProcess && !nodeProcess.killed) { try { nodeProcess.kill('SIGTERM'); } catch {} }
  void stopAfterburnerService();
  void stopAiNativeService();
});

// Stats update interval
setInterval(() => {
  // Main-process heartbeat (helps detect UI freezes vs app alive)
  try {
    const now = Date.now();
    if (!appHeartbeatLastLogMs || now - appHeartbeatLastLogMs >= 10_000) {
      appHeartbeatLastLogMs = now;
      const winCount = BrowserWindow.getAllWindows().length;
      const wc = mainWindow?.webContents;
      const state = {
        windows: winCount,
        mainWindow: !!mainWindow,
        isDestroyed: mainWindow ? mainWindow.isDestroyed?.() : null,
        isVisible: mainWindow ? mainWindow.isVisible?.() : null,
        isMinimized: mainWindow ? mainWindow.isMinimized?.() : null,
        isFocused: mainWindow ? mainWindow.isFocused?.() : null,
        webContents: !!wc,
        wcCrashed: wc ? wc.isCrashed?.() : null,
        wcLoading: wc ? wc.isLoading?.() : null,
        minerRunning: !!minerProcess,
        afterburnerRunning: !!afterburnerProc,
        aiNativeRunning: !!aiNativeProc
      };
      logApp('heartbeat', JSON.stringify(state));
    }
  } catch {
    // ignore
  }

  if (minerProcess) {
    const updated = tryUpdateStatsFromFile();
    if (!updated) minerStats.uptime += STATS_INTERVAL_SEC;
    tryUpdateRevenueStatsFromFile();

    // Track rolling hashrate samples for xmrig-like averages.
    try {
      const now = Date.now();
      const hs = typeof minerStats.hashrate === 'number' && Number.isFinite(minerStats.hashrate) ? minerStats.hashrate : 0;
      minerRateSamples.push({ t: now, hs });
      const cut15m = now - 15 * 60_000;
      while (minerRateSamples.length && minerRateSamples[0].t < cut15m) {
        minerRateSamples.shift();
      }
    } catch {
      // ignore
    }

    // Track share deltas for shares/min and windowed reject%.
    try {
      const now = Date.now();
      const acc = Number(minerStats.accepted || 0);
      const rej = Number(minerStats.rejected || 0);
      if (minerShareLastSample.t) {
        const dAcc = Math.max(0, acc - (minerShareLastSample.accepted || 0));
        const dRej = Math.max(0, rej - (minerShareLastSample.rejected || 0));
        if (dAcc || dRej) {
          minerShareDeltaSamples.push({ t: now, acc: dAcc, rej: dRej });
        }
      }
      minerShareLastSample = { t: now, accepted: acc, rejected: rej };

      const cut10m = now - 10 * 60_000;
      while (minerShareDeltaSamples.length && minerShareDeltaSamples[0].t < cut10m) {
        minerShareDeltaSamples.shift();
      }
    } catch {
      // ignore
    }

    // Emit a compact xmrig-style status line periodically.
    const now = Date.now();
    if (!minerMetricsLastEmitMs || now - minerMetricsLastEmitMs >= 10000) {
      minerMetricsLastEmitMs = now;
      emitMinerStatusLine('tick');
    }
  }

  // Best-effort: merge Afterburner metrics into minerStats (even if miner is stopped).
  if (afterburnerProc && afterburnerReady) {
    void afterburnerSend({ cmd: 'stats' })
      .then((r) => {
        if (!r?.ok) return;
        const st = r?.stats || {};
        const pm = st?.performance_metrics || {};
        const temp = pm?.afterburner_temperature;
        const tps = pm?.tasks_per_second;
        const eff = pm?.compute_efficiency;
        const speed10 = pm?.speed_10s;
        const speed60 = pm?.speed_60s;
        const speed15 = pm?.speed_15m;
        const succ60 = pm?.success_rate_60s;
        const lat10 = pm?.latency_avg_10s_ms;
        const lat60 = pm?.latency_avg_60s_ms;
        const sacredRatio = pm?.sacred_enhancement_ratio;
        minerStats.afterburner_temp_c = temp != null ? Number(temp).toFixed(1) : '';
        minerStats.afterburner_tasks_per_sec = tps != null ? Number(tps).toFixed(2) : '';
        minerStats.afterburner_efficiency_pct = eff != null ? Number(eff) : '';
        minerStats.afterburner_speed_10s = speed10 != null ? Number(speed10).toFixed(2) : '';
        minerStats.afterburner_speed_60s = speed60 != null ? Number(speed60).toFixed(2) : '';
        minerStats.afterburner_speed_15m = speed15 != null ? Number(speed15).toFixed(2) : '';
        minerStats.afterburner_success_60s_pct = succ60 != null ? Number(succ60) : '';
        minerStats.afterburner_latency_10s_ms = lat10 != null ? Number(lat10) : '';
        minerStats.afterburner_latency_60s_ms = lat60 != null ? Number(lat60) : '';
        minerStats.afterburner_status = st?.status || '';
        minerStats.afterburner_compute_mode = st?.compute_mode || '';
        minerStats.afterburner_sacred = typeof st?.sacred_enhancement === 'boolean' ? st.sacred_enhancement : '';
        minerStats.afterburner_active_tasks = typeof st?.active_tasks === 'number' ? st.active_tasks : '';
        minerStats.afterburner_completed_tasks = typeof st?.completed_tasks === 'number' ? st.completed_tasks : '';
        minerStats.afterburner_failed_tasks = typeof st?.failed_tasks === 'number' ? st.failed_tasks : '';
        minerStats.afterburner_utilization_pct = typeof st?.compute_utilization === 'number' ? st.compute_utilization : '';
        minerStats.afterburner_available_compute = typeof st?.available_compute === 'number' ? Number(st.available_compute).toFixed(2) : '';
        minerStats.afterburner_total_compute = typeof st?.total_compute === 'number' ? Number(st.total_compute).toFixed(2) : '';
        minerStats.afterburner_sacred_ratio = sacredRatio != null ? Number(sacredRatio).toFixed(2) : '';

        // Extended details
        minerStats.afterburner_uptime_sec = typeof st?.uptime_sec === 'number' ? st.uptime_sec : '';
        minerStats.afterburner_last_error = typeof st?.last_error === 'string' ? st.last_error : '';
        minerStats.afterburner_throttle_events = typeof st?.throttle_events === 'number' ? st.throttle_events : '';
        minerStats.afterburner_queue_depth = typeof st?.queue_depth === 'number' ? st.queue_depth : '';
        minerStats.afterburner_queue_by_type = st?.queue_by_type && typeof st.queue_by_type === 'object' ? st.queue_by_type : '';
        minerStats.afterburner_last_task_type = typeof st?.last_task_type === 'string' ? st.last_task_type : '';
        minerStats.afterburner_last_task_ms = typeof st?.last_task_duration_ms === 'number' ? st.last_task_duration_ms : '';
        minerStats.afterburner_avg_task_ms = typeof st?.avg_task_duration_ms === 'number' ? st.avg_task_duration_ms : '';

        // Power / efficiency metrics (from WMI+TDP estimation or direct ADL)
        minerStats.afterburner_gpu_power_w         = pm?.gpu_power_w        != null ? pm.gpu_power_w        : '';
        minerStats.afterburner_gpu_util_pct        = pm?.gpu_util_pct       != null ? pm.gpu_util_pct       : '';
        minerStats.afterburner_power_source        = pm?.power_source       != null ? pm.power_source       : '';
        minerStats.afterburner_hashrate_per_watt   = pm?.hashrate_per_watt  != null ? pm.hashrate_per_watt  : '';
        minerStats.afterburner_hashrate_per_watt_10s = pm?.hashrate_per_watt_10s != null ? pm.hashrate_per_watt_10s : '';
        minerStats.afterburner_hashrate_per_watt_60s = pm?.hashrate_per_watt_60s != null ? pm.hashrate_per_watt_60s : '';
        minerStats.afterburner_efficiency_hint     = pm?.efficiency_hint    != null ? pm.efficiency_hint    : '';

        // Inject efficiency line into the mining console output (at most once per 60s)
        if (pm?.efficiency_hint && pm?.gpu_power_w != null) {
          const nowMs = Date.now();
          if (nowMs - abLastConsoleEmitMs >= 60000) {
            abLastConsoleEmitMs = nowMs;
            const hpwK = pm.hashrate_per_watt ? Math.round(pm.hashrate_per_watt / 1000) : 0;
            const pW   = Math.round(Number(pm.gpu_power_w));
            const psrc = pm.power_source ? ` [${pm.power_source}]` : '';
            sendToRenderer('miner-output', {
              stream: 'stdout',
              text: `[AFTERBURNER] ${pm.efficiency_hint}  (${pW}W${psrc}  ${hpwK} kH/W)\n`
            });
          }
        }
        scheduleStatsEmit();
      })
      .catch(() => {
        // ignore
      });
  } else {
    // Still refresh UI for miner stats.
    scheduleStatsEmit();
  }
}, STATS_TICK_MS);
