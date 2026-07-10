// ZION V3 Mainnet Ready v3.0.5 "All Green" - Main Process
// Electron main process with system tray, auto-start, GPU mining, IPC

const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const WalletGenerator = require('./wallet-generator');
const UtxoBuilder = require('./utxo-builder');
const AccountBuilder = require('./account-builder');
const QRCode = require('qrcode');
const crypto = require('crypto');

// ── Network Constants ───────────────────────────────────────────────────────
// Mainnet Edge relay (Hetzner VPS, Prague) — public-facing pool + node
const PRIMARY_MAINNET_HOST = '62.171.141.136';
const PRIMARY_POOL_PORT = 8444;
const PRIMARY_RPC_PORT = 8443;
// Edge VPN IP — Tailscale decommissioned, same host as primary
const EDGE_VPN_HOST = '62.171.141.136';
// Legacy alias kept for internal fallback references
const PRIMARY_TESTNET_HOST = PRIMARY_MAINNET_HOST;
// Default to public Edge read-only RPC for public miners.
// Users with local Core node can override via Settings → RPC URL.
const DEFAULT_RPC_URL = 'http://62.171.141.136:8443/jsonrpc';

// ── Logging: only miner metrics + errors go to console.log.
// Everything else uses dbg() which outputs console.debug only when ZION_DEBUG=1.
const DBG = process.env.ZION_DEBUG === '1';
function dbg(...args) { if (DBG) console.debug('[DBG]', ...args); }

// ── E2E Test Mode: Automated testing support
const E2E_TEST = process.env.ZION_E2E_TEST === '1';
if (E2E_TEST) {
  console.log('ZION Desktop Agent E2E Test Mode Enabled');
  console.log('Test Pool:', process.env.ZION_TEST_POOL || 'default');
  console.log('Test Worker:', process.env.ZION_TEST_WORKER || 'e2e-test');
  console.log('Test Timeout:', process.env.ZION_TEST_TIMEOUT || '30s');
}

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
    // V3 zion-miner does not use/need --group split semantics from legacy miner.
    // Skip expensive synchronous help probing to keep startup one-click responsive.
    if (isV3MinerBinary(minerPath)) {
      rustCliFeatureCache.set(minerPath, false);
      return false;
    }
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

    for (const imageName of ['zion-universal-miner.exe', 'zion-miner.exe']) {
      try {
        execFileSync('taskkill', ['/F', '/T', '/IM', imageName], {
          windowsHide: true,
          timeout: 5000,
          stdio: 'ignore'
        });
        logApp('stray-miner-cleanup', `taskkill ${imageName}`);
      } catch {
        // ignore (no stray process or insufficient perms)
      }
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
// GPU acceleration enabled — required for backdrop-filter, canvas, and smooth compositing.

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

    // Performance-first default: keep 1 core for UI/OS
    const reserved = 1;
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

  // Do not block miner startup with UAC elevation by default.
  // The elevated secedit flow can pause for ~30s (or longer) and causes stale start locks.
  // Opt-in only when explicitly requested.
  const allowElevatedGrant = String(process.env.ZION_WINDOWS_LP_ELEVATED || '').trim() === '1';
  if (!allowElevatedGrant) {
    _winLargePagesEnabled = false;
    logApp('largepages-enable-skipped', JSON.stringify({ reason: 'elevated-flow-disabled', env: 'ZION_WINDOWS_LP_ELEVATED' }));
    return { enabled: false, alreadyEnabled: false, error: 'elevated grant disabled (set ZION_WINDOWS_LP_ELEVATED=1 to enable)' };
  }

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

let startMiningInProgress = false; // atomic guard against duplicate startMining() calls
let startMiningGuardTimer = null; // clears stale start lock if setup path aborts unexpectedly
let minerStopping = false;
let minerStopPromise = null;
let minerAutoStopTimer = null;
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
  gpu_detected: false,
  gpu_type: 'none',
  gpu_name: '',
  cpu_only_mode: true,
  // Dual mining: ZION + XMR (DAO revenue)
};

/** Clear stdout-derived mining telemetry so UI/[METRICS] never mixes two miner processes. */
function resetMinerTelemetryForNewSpawn() {
  minerRateSamples = [];
  minerShareDeltaSamples = [];
  minerShareLastSample = { t: 0, accepted: 0, rejected: 0 };
  minerMetricsLastEmitMs = 0;
  delete minerStats.gpu_info;
  delete minerStats.gpu_backend;
  delete minerStats.runtime_backend;
  delete minerStats.hashrate_10s;
  delete minerStats.hashrate_60s;
  delete minerStats.hashrate_15m;
  delete minerStats.hashrate_max;
  delete minerStats.hashrate_gpu;
  delete minerStats.gpu_hps;
  delete minerStats.uptime_display;
  delete minerStats.accept_rate;
  delete minerStats.total_hashes;
  delete minerStats.total_hashes_display;
  delete minerStats.current_epoch;
  delete minerStats.stream_algorithm;
  delete minerStats.miner_version;
  Object.assign(minerStats, {
    hashrate: 0,
    shares: 0,
    accepted: 0,
    rejected: 0,
    uptime: 0,
    last_job_height: '',
    last_job_diff: '',
    last_pool_diff: '',
    last_job_id: '',
    last_share_diff: '',
    last_share_latency: null,
    gpu_detected: false,
    gpu_type: 'none',
    gpu_name: '',
    cpu_only_mode: true,
    reconnect_attempts: 0
  });
}

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

    // Prefer live hashrate; fall back to GPU rate if CPU reports 0 (e.g. between jobs)
    const rawHr = (typeof minerStats.hashrate === 'number' && minerStats.hashrate > 0)
      ? minerStats.hashrate
      : (typeof minerStats.hashrate_gpu === 'number' && minerStats.hashrate_gpu > 0 ? minerStats.hashrate_gpu : 0);
    const hrNow = formatHashrate(rawHr);
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

    // UI log — Show [STATUS] to file, and a compact [METRICS] line to the Mining Console
    try {
      sendToRenderer('miner-output', { stream: 'stdout', text: line });
    } catch {
      // ignore
    }

    // Emit compact [METRICS] line for the Mining Console LOGS panel
    try {
      const gpu = minerStats.gpu_info || minerStats.gpu_type || '';
      const gpuHr = typeof minerStats.hashrate_gpu === 'number' && minerStats.hashrate_gpu > 0
        ? formatHashrate(minerStats.hashrate_gpu) : '';
      const backend = minerStats.runtime_backend || '';
      const epoch = minerStats.current_epoch != null ? String(minerStats.current_epoch) : '';
      const metricsLine = [
        `[METRICS] hr=${hrNow}`,
        `10s=${formatHashrate(hr10 ?? 0)}`,
        `60s=${formatHashrate(hr60 ?? 0)}`,
        `15m=${formatHashrate(hr15m ?? 0)}`,
        `A:${accepted} R:${rejected} ${accPct.toFixed(1)}%`,
        `up=${up}`,
        h ? `h=${h}` : null,
        epoch ? `epoch=${epoch}` : null,
        gpu ? `gpu=${gpu}` : null,
        gpuHr ? `gpu_hr=${gpuHr}` : null,
        backend ? `backend=${backend}` : null
      ].filter(Boolean).join(' | ');
      sendToRenderer('miner-output', { stream: 'stdout', text: metricsLine + '\n' });
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

    // Also write compact metrics to the agent log (desktop_agent.log)
    const gpu = minerStats.gpu_info || minerStats.gpu_type || '';
    const backend = minerStats.runtime_backend || '';
    const height = minerStats.last_job_height || '';
    const epoch = minerStats.current_epoch != null ? minerStats.current_epoch : '';
    logApp('mining-metrics', [
      `hr=${hrNow}`,
      `10s=${formatHashrate(hr10 ?? 0)}`,
      `60s=${formatHashrate(hr60 ?? 0)}`,
      `15m=${formatHashrate(hr15m ?? 0)}`,
      `A=${accepted}`,
      `R=${rejected}`,
      `pct=${accPct.toFixed(1)}%`,
      `up=${up}`,
      height ? `h=${height}` : null,
      epoch !== '' ? `epoch=${epoch}` : null,
      gpu ? `gpu=${gpu}` : null,
      backend ? `backend=${backend}` : null
    ].filter(Boolean).join(' '));
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
let MINER_IS_RUST = false;
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
  // V3 miner binary names take priority over legacy universal miner.
  const v3Names = process.platform === 'win32' ? ['zion-miner.exe'] : ['zion-miner'];
  const namesByPlatform = {
    darwin: [
      ...v3Names,
      'zion-universal-miner',
      'zion-universal-miner-macos-arm64',
      'zion-universal-miner-macos-x64',
      'zion-universal-miner-arm64',
      'zion-universal-miner-x64'
    ],
    linux: [...v3Names, 'zion-universal-miner', 'zion-universal-miner-linux-x64'],
    win32: [...v3Names, 'zion-universal-miner.exe', 'zion-universal-miner-win-x64.exe']
  };

  const names = namesByPlatform[process.platform] || [];
  const searchPaths = IS_PACKAGED
    ? [process.resourcesPath]
    : [
        // Prefer explicit refreshed dev copies and alternate target dirs first.
        path.join(APP_ROOT, 'resources'),
        path.join(APP_ROOT, '..', '..', 'V3', 'target-vega-fix', 'release'),
        // V3 miner build outputs
        path.join(APP_ROOT, '..', '..', 'V3', 'L1', 'miner', 'target', 'release'),
        path.join(APP_ROOT, '..', '..', 'V3', 'target', 'release'),
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

  for (const name of names) {
    const candidates = [];
    for (const [pathIndex, searchPath] of searchPaths.entries()) {
      const fullPath = path.join(searchPath, name);
      if (!fs.existsSync(fullPath)) continue;
      try {
        const stat = fs.statSync(fullPath);
        candidates.push({ fullPath, mtimeMs: stat.mtimeMs || 0, pathIndex });
      } catch {
        candidates.push({ fullPath, mtimeMs: 0, pathIndex });
      }
    }

    if (candidates.length > 0) {
      candidates.sort((left, right) => {
        if (right.mtimeMs !== left.mtimeMs) {
          return right.mtimeMs - left.mtimeMs;
        }
        return left.pathIndex - right.pathIndex;
      });
      return candidates[0].fullPath;
    }
  }

  return null;
}


/**
 * Detect whether a resolved miner binary is the V3 miner (zion-miner) vs legacy (zion-universal-miner).
 * V3 miner uses env-var configuration, not CLI flags.
 */
function isV3MinerBinary(minerPath) {
  if (!minerPath) return false;
  const base = path.basename(minerPath).toLowerCase().replace(/\.exe$/, '');
  return base === 'zion-miner';
}

function resolveMinerSelection(preferred) {
  const rustPath = findRustMiner();
  const select = (backend, p, isRust, isPython) => ({ backend, path: p, isRust, isPython });
  if (rustPath) return select('rust', rustPath, true, false);
  return null;
}

const rustMinerPath = findRustMiner();
if (rustMinerPath) {
  MINER_PATH = rustMinerPath;
  MINER_IS_RUST = true;
  dbg('[MINER] Using Rust native miner:', rustMinerPath);
} else {
  throw new Error('V3 Rust miner not found. Build V3/L1/miner release or package zion-miner.exe into resources.');
}

const CONFIG_PATH = path.join(USER_DATA_PATH, 'miner_config.json');
const LOG_PATH = path.join(USER_DATA_PATH, 'miner.log');
const WALLETS_PATH = path.join(USER_DATA_PATH, 'wallets');
const STATS_PATH = path.join(USER_DATA_PATH, 'miner_stats.json');

// Miner log rotation limits
const MAX_MINER_LOG_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_MINER_LOG_BACKUPS = 0;
const MAX_MINER_LOG_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function ensureDirectories() {
  const dirs = [USER_DATA_PATH, CACHE_PATH, WALLETS_PATH];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      dbg('Created directory:', dir);
    }
  });
}

function fixSecurityBlocks() {
  const results = { fixed: [], errors: [] };
  const resourceBase = IS_PACKAGED ? process.resourcesPath : path.join(APP_ROOT, 'resources');
  const binaryNames = ['zion-miner', 'zion-universal-miner'];
  if (process.platform === 'win32') {
    binaryNames.push('zion-miner.exe', 'zion-universal-miner.exe');
  }
  const targetPaths = binaryNames
    .map(name => path.join(resourceBase, name))
    .filter(p => fs.existsSync(p));

  if (process.platform === 'darwin') {
    for (const targetPath of targetPaths) {
      try {
        const { execSync } = require('child_process');
        execSync(`xattr -dr com.apple.quarantine "${targetPath}" 2>/dev/null || true`, { timeout: 5000 });
        fs.chmodSync(targetPath, 0o755);
        results.fixed.push(path.basename(targetPath));
      } catch (err) {
        results.errors.push(`${path.basename(targetPath)}: ${err?.message}`);
      }
    }
  }
  if (process.platform === 'linux') {
    for (const targetPath of targetPaths) {
      try { fs.chmodSync(targetPath, 0o755); results.fixed.push(path.basename(targetPath)); } catch { /* ignore */ }
    }
  }
  if (process.platform === 'win32') {
    const minerExes = targetPaths.filter(p => /\.exe$/i.test(p));
    for (const exe of minerExes) {
      if (!fs.existsSync(exe)) results.errors.push(`missing (quarantined?): ${path.basename(exe)}`);
    }
  }
  if (results.fixed.length) dbg('[security-fix] Fixed:', results.fixed.join(', '));
  if (results.errors.length) dbg('[security-fix] Errors:', results.errors.join(', '));
  return results;
}

function migrateLegacyUserDataIfNeeded() {
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
        if (!fs.existsSync(to)) fs.copyFileSync(from, to);
      }
      dbg('Migrated legacy wallets to:', WALLETS_PATH);
    }
  } catch (err) {
    console.warn('Legacy data migration failed:', err);
  }
}

function rotateFileIfTooLarge(filePath, maxBytes, maxBackups = 1, maxAgeMs = null) {
  const metaPath = `${filePath}.meta.json`;
  const readEpochMs = (stat, now) => {
    try {
      if (fs.existsSync(metaPath)) {
        const j = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const v = Number(j?.createdAtMs);
        if (Number.isFinite(v) && v > 0) return v;
      }
    } catch { /* ignore */ }
    const bt = typeof stat?.birthtimeMs === 'number' ? stat.birthtimeMs : NaN;
    const ct = typeof stat?.ctimeMs === 'number' ? stat.ctimeMs : NaN;
    const epoch = (Number.isFinite(bt) && bt > 0) ? bt : (Number.isFinite(ct) && ct > 0) ? ct : now;
    try { fs.writeFileSync(metaPath, JSON.stringify({ createdAtMs: epoch }), 'utf8'); } catch { /* ignore */ }
    return epoch;
  };
  const writeEpochMs = (epochMs) => {
    try { fs.writeFileSync(metaPath, JSON.stringify({ createdAtMs: epochMs }), 'utf8'); } catch { /* ignore */ }
  };
  const purgeOldBackups = (now) => {
    if (maxAgeMs == null) return;
    const n = Number(maxBackups);
    if (!Number.isFinite(n) || n <= 0) return;
    for (let i = 1; i <= n; i++) {
      const p = `${filePath}.${i}`;
      try {
        if (!fs.existsSync(p)) continue;
        const s = fs.statSync(p);
        if (!s.isFile()) continue;
        if ((now - (s.mtimeMs || s.mtime.getTime())) > maxAgeMs) fs.unlinkSync(p);
      } catch { /* ignore */ }
    }
  };
  try {
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return;
    const now = Date.now();
    purgeOldBackups(now);
    const epochMs = maxAgeMs != null ? readEpochMs(stat, now) : now;
    if (stat.size <= maxBytes && !(maxAgeMs != null && (now - epochMs) > maxAgeMs)) return;
    if (!Number.isFinite(Number(maxBackups)) || Number(maxBackups) <= 0) {
      try { fs.truncateSync(filePath, 0); } catch { /* ignore */ }
      writeEpochMs(now);
      return;
    }
    for (let i = maxBackups; i >= 1; i--) {
      const src = `${filePath}.${i}`;
      const dst = `${filePath}.${i + 1}`;
      if (fs.existsSync(src)) {
        try { i + 1 > maxBackups ? fs.unlinkSync(src) : (fs.existsSync(dst) && fs.unlinkSync(dst), fs.renameSync(src, dst)); } catch { /* ignore */ }
      }
    }
    try {
      const backup = `${filePath}.1`;
      if (fs.existsSync(backup)) fs.unlinkSync(backup);
      fs.renameSync(filePath, backup);
    } catch {
      try { fs.truncateSync(filePath, 0); } catch { /* ignore */ }
    }
    writeEpochMs(now);
  } catch { /* ignore */ }
}

// ── V3 Config Defaults ──────────────────────────────────────────────────────
const DESKTOP_PURE_ZION_DEFAULT = true;

const DEFAULT_CONFIG = {
  pool: {
    host: PRIMARY_TESTNET_HOST,
    port: PRIMARY_POOL_PORT
  },
  desktopPureZionDefault: DESKTOP_PURE_ZION_DEFAULT,
  rpcUrl: DEFAULT_RPC_URL,
  algorithm: 'cosmic_harmony',
  wallet: '',
  worker: 'desktop-agent',
  threads: Math.max(1, (Array.isArray(os.cpus?.()) ? os.cpus().length : 4) - 1),
  gpu: true,
  gpuCpuThreads: 5,
  gpuBatchSize: 16000000,
  minerBackend: 'rust',
  autoStart: false,
  autoSelectPool: true,
  minimizeToTray: true,
  startMinimized: false
};

function normalizeAlgorithmName(algo) {
  const raw = String(algo || '').trim().toLowerCase().replace(/-/g, '_');
  if (['cosmic_harmony_v3','cosmic_harmony_v4','cosmic_harmony_v4_2','chv3','ch3',
       'chv4','ch4','deeksha','cosmic_harmony_deeksha','ekam','ekam_deeksha',
       'cosmic_harmony_ekam'].includes(raw)) {
    return 'cosmic_harmony';
  }
  return raw || 'cosmic_harmony';
}

function sanitizeWorkerName(raw) {
  const s = String(raw || 'desktop-agent').trim().replace(/[^a-zA-Z0-9_.\-]/g, '').slice(0, 32);
  return s || 'desktop-agent';
}

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
      // Upgrade legacy backend pins to rust
      const mb = String(merged?.minerBackend || '').toLowerCase();
      if (!mb || mb === 'auto' || mb === 'python') merged.minerBackend = 'rust';
      // Migrate localhost RPC to testnet server
      if (typeof merged.rpcUrl === 'string') {
        const trimmed = merged.rpcUrl.trim();
        if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(trimmed)) {
          merged.rpcUrl = DEFAULT_RPC_URL;
        }
      }
      if (merged.pool && /^(localhost|127\.0\.0\.1)$/i.test(merged.pool.host)) {
        merged.pool.host = PRIMARY_TESTNET_HOST;
        merged.pool.port = PRIMARY_POOL_PORT;
      }
      merged.algorithm = normalizeAlgorithmName(merged.algorithm || DEFAULT_CONFIG.algorithm);
      merged.desktopPureZionDefault = DESKTOP_PURE_ZION_DEFAULT;
      // Migrate legacy 'address' field to 'wallet' if wallet is empty
      if (!merged.wallet && merged.address) {
        merged.wallet = merged.address;
      }
      return merged;
    }
  } catch (err) {
    console.error('Failed to load config:', err);
  }
  return { ...DEFAULT_CONFIG, desktopPureZionDefault: DESKTOP_PURE_ZION_DEFAULT };
}

function saveConfig(config) {
  try {
    const { desktopPureZionDefault, ...persistedConfig } = config || {};
    persistedConfig.algorithm = normalizeAlgorithmName(persistedConfig.algorithm || DEFAULT_CONFIG.algorithm);
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(persistedConfig, null, 2));
    return true;
  } catch (err) {
    console.error('Failed to save config:', err);
    return false;
  }
}

// Normalize user-supplied RPC URL to canonical http://host:port/jsonrpc form.
function normalizeRpcUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_RPC_URL;
  if (/^https?:\/\//i.test(raw)) {
    if (raw.endsWith('/jsonrpc')) return raw;
    if (/:\d+\/?$/.test(raw)) return raw.replace(/\/+$/, '') + '/jsonrpc';
    return raw;
  }
  if (/^[^\/]+:\d+$/.test(raw)) return `http://${raw}/jsonrpc`;
  return raw;
}

const STATS_INTERVAL_SEC = (() => {
  const raw = Number(String(process.env.ZION_STATS_INTERVAL_SEC || '5').trim());
  if (!Number.isFinite(raw) || raw < 2) return 5;
  return Math.floor(raw);
})();
const STATS_TICK_MS = STATS_INTERVAL_SEC * 1000;

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

function detectGpuForStartupFast(config) {
  const now = Date.now();
  if (cachedGpuInfo && (now - gpuInfoLastProbeMs) < 60000) return cachedGpuInfo;

  const miningMode = String(config?.miningMode || (config?.gpu ? 'dual' : 'cpu')).toLowerCase();
  const wantsGpu = miningMode === 'gpu' || miningMode === 'dual' || miningMode === 'gpu-revenue' || !!config?.gpu;
  const fallback = {
    available: wantsGpu,
    type: wantsGpu ? 'gpu' : 'none',
    name: wantsGpu ? 'GPU (startup-fast-path)' : '',
    driver: '',
    memory: '',
    temperature: '',
    utilization: '',
    cpuOnly: !wantsGpu,
    backendPreferred: (process.platform === 'darwin' && os.arch() === 'arm64') ? 'metal' : 'opencl',
    cudaCapable: false,
  };

  setTimeout(() => {
    try { detectGPU(); } catch { /* ignore */ }
  }, 0);

  return fallback;
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

function recommendedOpenclLocalSize(gpuInfo) {
  const name = String(gpuInfo?.name || '').toLowerCase();
  const type = String(gpuInfo?.type || '').toLowerCase();

  if (type === 'amd' && /vega|gfx9|gfx8|gfx7|gfx6/.test(name)) {
    return 64;
  }

  return 256;
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
    if (memoryMb >= 20_000) return Math.min(bounds.max, 16384);
    if (memoryMb >= 12_000) return Math.min(bounds.max, 12288);
    if (memoryMb >= 8_000) return Math.min(bounds.max, 8192);
    if (memoryMb >= 6_000) return Math.min(bounds.max, 6144);
    return Math.max(bounds.min, 4096);
  }

  if (kind === 'metal') {
    if (memoryMb >= 12_000) return Math.min(bounds.max, 65536);
    if (memoryMb >= 8_000) return Math.min(bounds.max, 32768);
    return Math.max(bounds.min, 16384);
  }

  if (memoryMb >= 16_000) return Math.min(bounds.max, 8192);
  if (memoryMb >= 8_000) return Math.min(bounds.max, 6144);
  if (memoryMb >= 6_000) return Math.min(bounds.max, 4096);
  return Math.max(bounds.min, 2048);
}

/**
 * Load the GPU tuning config from resources/gpu-tuning-config.json.
 * Returns the parsed object or null on failure.
 */
function loadGpuTuningConfig() {
  try {
    const resourceBase = IS_PACKAGED ? process.resourcesPath : path.join(APP_ROOT, 'resources');
    const cfgPath = path.join(resourceBase, 'gpu-tuning-config.json');
    if (!fs.existsSync(cfgPath)) return null;
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Apply NVIDIA CUDA tuning from gpu-tuning-config.json tier recommendations.
 * Returns env var overrides: { ZION_CUDA_WORK_CAP?, ... }
 */
function applyCudaTuning(gpuInfo, tuningConfig) {
  const result = {};
  const cuda = tuningConfig?.recommendations?.cuda;
  if (!cuda?.enabled) return result;

  const memMb = parseGpuMemoryMb(gpuInfo);

  // Tier-based work_cap from config if not already set by chooseGpuBatchSize
  if (cuda.tiers && memMb > 0) {
    const tierKeys = Object.keys(cuda.tiers)
      .map(k => ({ key: k, gb: parseInt(k) }))
      .filter(t => Number.isFinite(t.gb))
      .sort((a, b) => b.gb - a.gb); // descending
    for (const tier of tierKeys) {
      if (memMb >= tier.gb * 1000) {
        const tierCfg = cuda.tiers[tier.key];
        if (tierCfg?.work_cap > 0) {
          result.ZION_CUDA_WORK_CAP = String(tierCfg.work_cap);
        }
        break;
      }
    }
  }

  // threads_per_block override (different NVIDIA arches may prefer 128/256/512)
  if (cuda.threads_per_block && cuda.threads_per_block !== 256) {
    result.ZION_CUDA_BLOCK_SIZE = String(cuda.threads_per_block);
  }

  return result;
}

// ============================================================================
// CH3 MULTI-STREAM: Dual/Triple Mining Support
// ZION (50% CPU) + Best GPU Coin (25% GPU, direct to external pool) +
// PRIMARY-HOST TESTNET MONITORING
// ============================================================================

const MAINNET_SERVERS = [
  { id: 'zion-edge', name: 'Prague (Mainnet Edge)', host: PRIMARY_MAINNET_HOST, flag: 'CZ', location: 'EU Primary', poolPort: PRIMARY_POOL_PORT },
  { id: 'zion-edge-vpn', name: 'Prague (Edge VPN)', host: EDGE_VPN_HOST, flag: 'CZ', location: 'EU VPN', poolPort: PRIMARY_POOL_PORT },
];

// Legacy alias for compatibility
const TESTNET_SERVERS = MAINNET_SERVERS;

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
async function checkStratumHealth(host, port = 8444, timeout = 5000) {
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
      // V3 pool protocol: send a hello probe (pool responds with welcome or closes)
      try {
        socket.write('{"type":"hello","miner_id":"probe","worker_name":"health-check","algorithm":"cosmic_harmony_ekam_deeksha_v2"}\n');
      } catch { fail(); return; }
    });

    socket.on('data', (chunk) => {
      buf += chunk.toString();
      // V3 pool uses newline-delimited JSON — any valid JSON response = pool alive
      const lines = buf.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          // welcome, job, or any valid V3 message = online
          if (msg && msg.type) {
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
      const poolPort = server.poolPort || PRIMARY_POOL_PORT;
      const [poolStatus, rpcStatus] = await Promise.all([
        checkStratumHealth(server.host, poolPort),  // V3 hello probe
        checkServerPort(server.host, PRIMARY_RPC_PORT)
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
      config.pool = { host: best.host, port: best.poolPort || PRIMARY_POOL_PORT };
      config.rpcUrl = `http://${best.host}:${PRIMARY_RPC_PORT}/jsonrpc`;
      saveConfig(config);
      dbg(`[auto-select] Config updated to ${best.host}`);
    }
    return best;
  } catch (err) {
    console.error('[auto-select] Error:', err.message);
    return null;
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
        autoStart: !!config.autoStart
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
    title: 'ZION Native Awakening v3.0.5',
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
      label: 'ZION Miner v3.0.5 Ekam Deeksha',
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
  tray.setToolTip('ZION Miner v3.0.5 Ekam Deeksha');
  
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

// ═══════════════════════════════════════════════════════════════════════════════
// V3 Fast-Path: clean startup that bypasses all legacy blocking code.
// Called by startMining() when findRustMiner() returns a V3 binary.
// Returns { success, ... } or null to fall through to legacy path.
// ═══════════════════════════════════════════════════════════════════════════════
function startMiningV3(config, v3Path) {
  const t0 = Date.now();
  const log = (msg) => {
    try { sendToRenderer('miner-output', { stream: 'stdout', text: msg }); } catch {}
  };
  const logErr = (msg) => {
    try { sendToRenderer('miner-output', { stream: 'stderr', text: msg }); } catch {}
  };

  log(`[V3-FAST] Starting V3 miner fast-path (${path.basename(v3Path)})\n`);
  log(`[V3-FAST] Config keys: ${Object.keys(config || {}).join(', ')}\n`);
  log(`[V3-FAST] Pool: ${JSON.stringify(config?.pool)} | Wallet set: ${!!config?.wallet}\n`);

  // ── 1. Validate wallet ─────────────────────────────────────────────────────
  const wallet = String(config?.wallet || '').trim();
  if (!wallet) {
    dialog.showErrorBox('Wallet Missing', 'Set your ZION wallet address in Settings or Wallet tab before starting mining.');
    startMiningInProgress = false;
    if (startMiningGuardTimer) { clearTimeout(startMiningGuardTimer); startMiningGuardTimer = null; }
    return { success: false, error: 'Wallet missing' };
  }
  const addrType = WalletGenerator.getAddressType(wallet);
  if (addrType !== 'zion1') {
    const hint = addrType === 'legacy'
      ? 'You are using a legacy ZION... address. The chain only credits zion1... addresses.'
      : 'Invalid address format.';
    dialog.showErrorBox('Invalid Wallet Address', `${hint}\n\nPlease create/select a zion1... wallet in the Wallet tab.`);
    startMiningInProgress = false;
    if (startMiningGuardTimer) { clearTimeout(startMiningGuardTimer); startMiningGuardTimer = null; }
    return { success: false, error: 'Invalid wallet address' };
  }

  // ── 2. Verify binary exists ────────────────────────────────────────────────
  if (!fs.existsSync(v3Path)) {
    const defMsg = process.platform === 'win32'
      ? `V3 miner not found at: ${v3Path}\n\nWindows Defender may have quarantined zion-miner.exe.`
      : `V3 miner not found at: ${v3Path}`;
    dialog.showErrorBox('Miner Not Found', defMsg);
    startMiningInProgress = false;
    if (startMiningGuardTimer) { clearTimeout(startMiningGuardTimer); startMiningGuardTimer = null; }
    return { success: false, error: 'V3 miner not found' };
  }

  // ── 3. Idempotent guard ────────────────────────────────────────────────────
  if (minerProcess && !minerStopping) {
    log('[INFO] Duplicate start request ignored: miner session is already active.\n');
    startMiningInProgress = false;
    if (startMiningGuardTimer) { clearTimeout(startMiningGuardTimer); startMiningGuardTimer = null; }
    return { success: true, alreadyRunning: true };
  }

  // ── 4. Update global state ─────────────────────────────────────────────────
  MINER_PATH = v3Path;
  MINER_IS_RUST = true;
  minerUserStopRequested = false;
  minerStopping = false;
  if (poolFailoverTimer) { clearTimeout(poolFailoverTimer); poolFailoverTimer = null; }
  if (poolHealthTimer) { clearInterval(poolHealthTimer); poolHealthTimer = null; }
  if (minerFallbackTimer) { clearTimeout(minerFallbackTimer); minerFallbackTimer = null; }
  if (minerStartAckTimer) { clearTimeout(minerStartAckTimer); minerStartAckTimer = null; }
  if (minerGpuInitWatchdogTimer) { clearTimeout(minerGpuInitWatchdogTimer); minerGpuInitWatchdogTimer = null; }
  if (minerAutoStopTimer) { clearTimeout(minerAutoStopTimer); minerAutoStopTimer = null; }

  log(`[V3-FAST] Binary: ${v3Path}\n`);

  // ── 5. Compute threads and GPU ─────────────────────────────────────────────
  const effectiveThreads = computeEffectiveThreads(config);
  const poolHost = config?.pool?.host || PRIMARY_TESTNET_HOST;
  const poolPort = config?.pool?.port || PRIMARY_POOL_PORT;
  const pool = `${poolHost}:${poolPort}`;
  const worker = config.worker ? sanitizeWorkerName(config.worker) : '';
  const miningMode = String(config.miningMode || (config.gpu ? 'dual' : 'cpu')).toLowerCase();
  const wantsGpu = miningMode === 'gpu' || miningMode === 'dual';
  const explicitGpuBackend = String(config?.gpuBackend || process.env.ZION_BACKEND || '').trim().toLowerCase();
  let gpuInfo = null;
  if (wantsGpu) {
    try { gpuInfo = detectGPU(); } catch { /* ignore */ }
  }
  const selectedGpuBackend = !wantsGpu
    ? 'cpu'
    : explicitGpuBackend || (
      process.platform === 'darwin' && os.arch() === 'arm64'
        ? 'metal'
        : (gpuInfo?.backendPreferred === 'cuda' && gpuInfo?.cudaCapable ? 'cuda' : 'opencl')
    );

  // ── 6. Build CLI args ──────────────────────────────────────────────────────
  const args = ['--pool', pool, '--wallet', wallet];
  if (worker) args.push('--worker', worker);
  if (effectiveThreads > 0) args.push('--threads', String(effectiveThreads));
  if (wantsGpu) {
    args.push('--gpu', selectedGpuBackend);
  }
  args.push('--stats-file', STATS_PATH);

  // ── 7. Build environment ───────────────────────────────────────────────────
  const env = {
    ...process.env,
    ZION_POOL_ADDR: pool,
    ZION_MINER_ID: wallet,
    ZION_WORKER_NAME: worker || 'desktop',
    ZION_PROFILE: 'pool',
    // Loop count must be large — default of 1 causes pool to send Bye after every iteration
    ZION_LOOP_COUNT: '1000000',
    // Nonce count: 4096 matches pool default (ZION_NONCE_COUNT on pool server)
    // for good GPU batch utilisation; auto-tune can override this per GPU
    ZION_NONCE_COUNT: '4096',
    ZION_NONCE_AUTOTUNE: 'true',
    ZION_RECONNECT: 'true',
    ZION_METRICS_REPORT_SECS: '10',
    ZION_STATS_FILE: STATS_PATH,
    ZION_MINER_METRICS_BIND: '127.0.0.1:9116',
    ZION_NONCE_BASE: String((Date.now() >>> 0) & 0x1fffffff),
    ZION_ENABLE_STREAM_SWITCH: '0',
  };
  if (wantsGpu) {
    // ── GPU detection & backend auto-select ──
    env.ZION_BACKEND = selectedGpuBackend;
    env.ZION_HAS_GPU = '1';

    // ── VRAM-aware batch/work-cap sizing ──
    const batchSize = chooseGpuBatchSize(gpuInfo, config?.gpuBatchSize);
    const backend = env.ZION_BACKEND;
    if (backend === 'cuda') {
      env.ZION_CUDA_WORK_CAP = String(batchSize);
      // Apply tier-based CUDA tuning from gpu-tuning-config.json
      const tuningCfg = loadGpuTuningConfig();
      if (tuningCfg) {
        const cudaOverrides = applyCudaTuning(gpuInfo, tuningCfg);
        Object.assign(env, cudaOverrides);
      }
    } else if (backend === 'opencl') {
      env.ZION_OCL_WORK_CAP = String(batchSize);
      if (config?.gpuVramPercent) {
        const pct = Math.max(10, Math.min(90, Number(config.gpuVramPercent) || 25));
        env.ZION_OCL_VRAM_PCT = String(pct);
      }
      const configuredLocalSize = Number(config?.gpuLocalSize);
      const localSize = Number.isFinite(configuredLocalSize) && configuredLocalSize > 0
        ? Math.max(32, Math.min(512, configuredLocalSize))
        : recommendedOpenclLocalSize(gpuInfo);
      env.ZION_OCL_LOCAL_SIZE = String(localSize);
    }

    log(`[V3-FAST] GPU detected: ${gpuInfo?.name || 'unknown'} (${gpuInfo?.type || '?'}) | Backend: ${backend} | BatchSize: ${batchSize}\n`);
    if (gpuInfo?.memory) log(`[V3-FAST] GPU VRAM: ${gpuInfo.memory} | Driver: ${gpuInfo.driver || 'n/a'}\n`);
  }

  log(`[V3-FAST] Pool: ${pool} | Wallet: ${wallet} | Worker: ${worker || 'desktop'}\n`);
  log(`[V3-FAST] Threads: ${effectiveThreads} | GPU: ${wantsGpu ? (env.ZION_BACKEND || 'cpu') : 'off'}\n`);
  log(`[V3-FAST] Args: ${args.join(' ')}\n`);

  // ── 8. Determine cwd ──────────────────────────────────────────────────────
  const minerCwd = IS_PACKAGED
    ? process.resourcesPath
    : path.join(APP_ROOT, '..');

  // ── 9. Unix execute bit ────────────────────────────────────────────────────
  if (process.platform !== 'win32') {
    try { fs.chmodSync(v3Path, 0o755); } catch {}
  }

  // ── 10. Spawn ──────────────────────────────────────────────────────────────
  try {
    minerProcess = spawn(v3Path, args, {
      cwd: minerCwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
  } catch (spawnErr) {
    logErr(`[V3-FAST] Spawn failed: ${spawnErr?.message || String(spawnErr)}\n`);
    minerProcess = null;
    startMiningInProgress = false;
    if (startMiningGuardTimer) { clearTimeout(startMiningGuardTimer); startMiningGuardTimer = null; }
    try { sendToRenderer('miner-error', { message: `Spawn failed: ${spawnErr?.message}` }); } catch {}
    return { success: false, error: `Spawn failed: ${spawnErr?.message}` };
  }

  log(`[V3-FAST] Spawned PID ${minerProcess?.pid} in ${Date.now() - t0}ms\n`);
  logApp('v3-fast-spawn', JSON.stringify({ pid: minerProcess?.pid, args, pool, wallet: wallet.slice(0, 12) + '...', threads: effectiveThreads }));

  resetMinerTelemetryForNewSpawn();

  // ── 11. Grace period → miner-started ───────────────────────────────────────
  const myStartToken = ++minerStartToken;
  minerStartAckTimer = setTimeout(() => {
    minerStartAckTimer = null;
    if (minerUserStopRequested || minerStopping) return;
    if (!minerProcess) return;
    if (myStartToken !== minerStartToken) return;
    try { sendToRenderer('miner-started', {}); } catch {}
    updateTrayMenu(minerStats);
  }, 450);

  // ── 12. Boost priority (Windows, async) ────────────────────────────────────
  try {
    if (process.platform === 'win32') {
      boostMinerProcessWindows(minerProcess?.pid, config, effectiveThreads);
    }
  } catch {}

  // ── 13. Log write helper ───────────────────────────────────────────────────
  const shouldSkipFileLogLine = (line) => /^\[METRICS\]/.test(line.trim());
  const safeMinerLogWriteV3 = (text) => {
    try {
      appendToFileBuffered(LOG_PATH, text, {
        flushDelayMs: 120,
        maxBufferedChars: 512 * 1024
      });
    } catch {}
  };

  // ── 14. Stdout handler ─────────────────────────────────────────────────────
  minerProcess.stdout.on('data', (data) => {
    const output = data.toString();
    const skip = shouldSkipFileLogLine(output);
    if (!skip) safeMinerLogWriteV3(`[STDOUT] ${output}`);
    if (!skip) enqueueMinerOutputToRenderer('stdout', output);
    maybeEmitBlockFound(output);
    parseMinerOutput(output);
  });

  // ── 15. Stderr handler ─────────────────────────────────────────────────────
  minerProcess.stderr.on('data', (data) => {
    const output = data.toString();
    const skip = shouldSkipFileLogLine(output);
    if (!skip) safeMinerLogWriteV3(`[STDERR] ${output}`);
    if (!skip) enqueueMinerOutputToRenderer('stderr', output);
    parseMinerOutput(output);
  });

  // ── 16. Close handler ──────────────────────────────────────────────────────
  minerProcess.on('close', (code, signal) => {
    flushBufferedFileAppendsSync();
    const exitMsg = `[V3] Miner exited code=${code}${signal ? ` signal=${signal}` : ''}\n`;
    console.log(exitMsg.trim());
    log(exitMsg);
    minerProcess = null;
    if (minerStartAckTimer) { clearTimeout(minerStartAckTimer); minerStartAckTimer = null; }
    flushMinerOutputToRenderer();
    minerStats = { ...minerStats, hashrate: 0 };
    updateTrayMenu(minerStats);
    try { sendToRenderer('miner-stopped', { code, signal: signal || null }); } catch {}

    // Auto-restart on crash (pool failover)
    if (!minerStopping && !minerUserStopRequested && code !== 0 && poolFailoverCount < 3) {
      poolFailoverCount++;
      log(`[V3-FAST] Miner crashed (code=${code}). Failover ${poolFailoverCount}/3 in 5s...\n`);
      if (poolFailoverTimer) clearTimeout(poolFailoverTimer);
      poolFailoverTimer = setTimeout(() => {
        try {
          const cfg = loadConfig();
          startMining(cfg);
        } catch (err) {
          logErr(`[V3-FAST] Failover restart failed: ${err?.message}\n`);
        }
      }, 5000);
    }
  });

  minerProcess.on('error', (err) => {
    logErr(`[V3-FAST] Process error: ${err?.message || String(err)}\n`);
    logApp('v3-fast-error', JSON.stringify({ error: err?.message || String(err) }));
    try { sendToRenderer('miner-error', { message: err?.message || String(err) }); } catch {}
  });

  // ── 17. Update tray and stats ──────────────────────────────────────────────
  minerStats.pool = pool;
  minerStats.worker = worker || 'desktop';
  minerStats.threads = String(effectiveThreads);
  minerStats.algorithm = 'cosmic_harmony_deeksha';
  updateTrayMenu(minerStats);

  // ── 18. Clear guard ────────────────────────────────────────────────────────
  startMiningInProgress = false;
  if (startMiningGuardTimer) { clearTimeout(startMiningGuardTimer); startMiningGuardTimer = null; }
  poolFailoverCount = 0;

  log(`[V3-FAST] Startup complete in ${Date.now() - t0}ms\n`);
  return { success: true };
}

// Mining process management
function startMining(config) {
  const startupT0 = Date.now();
  const startupMark = (phase) => {
    try {
      sendToRenderer('miner-output', {
        stream: 'stdout',
        text: `[DEBUG] startup phase=${phase} t=${Date.now() - startupT0}ms\n`
      });
    } catch {
      // ignore
    }
  };

  // Atomic guard: prevent two overlapping startMining() calls from spawning
  // duplicate miner processes (race between renderer auto-start, IPC,
  // one-click onboarding, and app-level autoStart).
  if (startMiningInProgress) {
    try {
      sendToRenderer('miner-output', {
        stream: 'stdout',
        text: '[INFO] Start already in progress – ignoring duplicate request.\n'
      });
    } catch { /* ignore */ }
    return { success: true, alreadyRunning: true };
  }
  startMiningInProgress = true;
  startupMark('guard-set');
  try {
    sendToRenderer('miner-starting', { ts: Date.now() });
  } catch {
    // ignore
  }
  try {
    if (startMiningGuardTimer) clearTimeout(startMiningGuardTimer);
  } catch {
    // ignore
  }
  // Safety net: if setup path exits unexpectedly without clearing the guard,
  // unlock start after a short timeout to avoid permanent "start in progress" state.
  startMiningGuardTimer = setTimeout(() => {
    if (startMiningInProgress && !minerProcess) {
      startMiningInProgress = false;
      try {
        sendToRenderer('miner-output', {
          stream: 'stderr',
          text: '[WARN] Recovered from stale start lock. You can start mining again.\n'
        });
      } catch {
        // ignore
      }
    }
  }, 30000);

  // ═══ V3 Fast-Path: bypass all legacy blocking code ═══
  // If the V3 binary (zion-miner) is available, skip the entire legacy
  // startup path (~2500 lines of blocking PowerShell calls, legacy Python
  // fallbacks, CHv4.2 paths, revenue splits, and GPU detection).
  {
    const v3FastPath = findRustMiner();
    if (v3FastPath && isV3MinerBinary(v3FastPath)) {
      try {
        const v3Result = startMiningV3(config, v3FastPath);
        if (v3Result) return v3Result;
      } catch (v3Err) {
        console.error('[V3-FAST] startMiningV3 threw:', v3Err);
        startupMark('v3-exception');
        try {
          sendToRenderer('miner-output', {
            stream: 'stderr',
            text: `[V3-FAST] Startup error: ${v3Err?.message || String(v3Err)}\n`
          });
        } catch {}
        startMiningInProgress = false;
        if (startMiningGuardTimer) { clearTimeout(startMiningGuardTimer); startMiningGuardTimer = null; }
        return { success: false, error: `V3 startup error: ${v3Err?.message}` };
      }
    }
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
    if (typeof payload.current_epoch === 'number') minerStats.current_epoch = payload.current_epoch;
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


async function stopMiningAsync() {
  const hadPendingStart = startMiningInProgress || !!minerStartAckTimer;
  startMiningInProgress = false;
  try {
    if (startMiningGuardTimer) clearTimeout(startMiningGuardTimer);
  } catch {
    // ignore
  }
  startMiningGuardTimer = null;

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
    if (hadPendingStart) {
      try {
        sendToRenderer('miner-output', {
          stream: 'stdout',
          text: '[INFO] Pending miner start cancelled by user.\n'
        });
        sendToRenderer('miner-stopped', { code: 0, signal: 'start-cancelled' });
      } catch {
        // ignore
      }
    }
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
  startMiningInProgress = false;
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
    minerStats.hashrate = minerStats.hashrate_10s || minerStats.hashrate_60s || minerStats.hashrate_15m || minerStats.hashrate_max; // fallback chain: first non-zero
  }

  // ─── V3 machine-parseable: "session_status iter=1/N ... hps_10s=91600.00 hps_overall=..." ───
  const v3SessionMatch = output.match(/session_status\s.*?hps_overall=([\d.]+).*?hps_10s=([\d.]+).*?hps_60s=([\d.]+).*?hps_15m=([\d.]+).*?attempted_hashes=(\d+).*?accepted=(\d+).*?rejected=(\d+)/i)
    || output.match(/session_status\s.*?accepted=(\d+).*?rejected=(\d+).*?hps_overall=([\d.]+).*?hps_10s=([\d.]+).*?hps_60s=([\d.]+).*?hps_15m=([\d.]+).*?attempted_hashes=(\d+)/i);
  if (v3SessionMatch) {
    // Fields may appear in different order; use named groups pattern
    const raw = output;
    const gf = (key) => { const m = raw.match(new RegExp(key + '=([\\d.]+)')); return m ? parseFloat(m[1]) : 0; };
    const gi = (key) => { const m = raw.match(new RegExp(key + '=(\\d+)')); return m ? parseInt(m[1], 10) : 0; };
    const hpsOverall = gf('hps_overall');
    const hps10 = gf('hps_10s');
    const hps60 = gf('hps_60s');
    const hps15 = gf('hps_15m');
    const accepted = gi('accepted');
    const rejected = gi('rejected');
    const attempted = gi('attempted_hashes');
    if (hps10 > 0 || hps60 > 0 || hps15 > 0 || hpsOverall > 0) {
      minerStats.hashrate = hps10 || hps60 || hps15 || hpsOverall;
      minerStats.hashrate_10s = hps10;
      minerStats.hashrate_60s = hps60;
      minerStats.hashrate_15m = hps15;
    }
    minerStats.accepted = accepted;
    minerStats.rejected = rejected;
    minerStats.shares = accepted + rejected;
    minerStats.total_hashes = attempted;
    minerStats.total_hashes_display = String(attempted);
    const epochMatch = raw.match(/epoch=(\d+)/);
    if (epochMatch) minerStats.current_epoch = parseInt(epochMatch[1], 10);
    const poolHeightMatch = raw.match(/pool_height=(\d+)/);
    if (poolHeightMatch) minerStats.last_job_height = poolHeightMatch[1];
    // GPU fields from session_status → propagate to dashboard-facing keys
    const gpuBeMatch = raw.match(/gpu_backend=(\w+)/);
    if (gpuBeMatch) {
      const gpuBe = gpuBeMatch[1].toLowerCase();
      minerStats.gpu_backend = gpuBe;
      minerStats.runtime_backend = gpuBe;
      if (gpuBe !== 'cpu' && gpuBe !== 'none') {
        minerStats.gpu_detected = true;
        minerStats.gpu_type = gpuBe;
        minerStats.cpu_only_mode = false;
      } else {
        minerStats.gpu_detected = false;
        minerStats.cpu_only_mode = true;
        minerStats.gpu_type = 'none';
        delete minerStats.gpu_info;
      }
    }
    const gpuHpsVal = gf('gpu_hps');
    if (gpuHpsVal > 0) {
      minerStats.gpu_hps = gpuHpsVal;
      minerStats.hashrate_gpu = gpuHpsVal;
    }
  }

  // ─── V3 shares line: "shares A:5 R:0 (100.0%) | hashes 458000" ───
  const v3SharesMatch = output.match(/shares\s+A:(\d+)\s+R:(\d+)\s+\(([\d.]+)%\)/i);
  if (v3SharesMatch) {
    minerStats.accepted = parseInt(v3SharesMatch[1], 10);
    minerStats.rejected = parseInt(v3SharesMatch[2], 10);
    minerStats.shares = minerStats.accepted + minerStats.rejected;
    minerStats.accept_rate = parseFloat(v3SharesMatch[3]);
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
    const height = parseInt(blockMatch[1]);
    minerStats.last_block_height = height;
    minerStats.blocks_found = parseInt(blockMatch[2]);
    try { sendToRenderer('block-found', { height }); } catch {}
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

  // ═══════════════════════════════════════════════════════════════
  // V3 MINER OUTPUT PARSERS (zion-miner v3 key=value + JSON wire)
  // ═══════════════════════════════════════════════════════════════

  // ─── V3 session_status: enriched with 15m hashrate, GPU backend, epoch, pool height ───
  const v3StatusMatch = output.match(/session_status\s+iter=(\d+)\/(\d+)\s+uptime_s=([\d.]+)\s+accepted=(\d+)\s+rejected=(\d+)\s+accept_pct=([\d.]+)\s+no_solution=(\d+)\s+local_skip=(\d+)\s+hps_overall=([\d.]+)\s+hps_10s=([\d.]+)\s+hps_60s=([\d.]+)\s+hps_15m=([\d.]+)(?:\s+attempted_hashes=(\d+))?(?:\s+submit_avg_ms=([\d.]+))?(?:\s+submit_max_ms=(\d+))?(?:\s+remote_ttl_ms=(\S+))?(?:\s+gpu_backend=(\S+))?(?:\s+gpu_hps=([\d.]+))?(?:\s+epoch=(\d+))?(?:\s+pool_height=(\d+))?(?:\s+best_batch_ms=(\d+))?/);
  if (v3StatusMatch) {
    minerStats.accepted = parseInt(v3StatusMatch[4]);
    minerStats.rejected = parseInt(v3StatusMatch[5]);
    minerStats.shares = minerStats.accepted + minerStats.rejected;
    minerStats.accept_rate = parseFloat(v3StatusMatch[6]);
    minerStats.no_solution_iterations = parseInt(v3StatusMatch[7]);
    const hpsOverall = parseFloat(v3StatusMatch[9]);
    const hps10s = parseFloat(v3StatusMatch[10]);
    const hps60s = parseFloat(v3StatusMatch[11]);
    const hps15m = parseFloat(v3StatusMatch[12]);
    // V3 reports 0.00 for 10s/60s/15m when windows are not yet full
    minerStats.hashrate = hpsOverall;
    minerStats.hashrate_10s = hps10s > 0 ? hps10s : hpsOverall;
    minerStats.hashrate_60s = hps60s > 0 ? hps60s : hpsOverall;
    minerStats.hashrate_15m = hps15m > 0 ? hps15m : hpsOverall;
    if (!Number.isFinite(Number(minerStats.hashrate_max)) || hpsOverall > Number(minerStats.hashrate_max)) {
      minerStats.hashrate_max = hpsOverall;
    }
    minerStats.uptime = parseFloat(v3StatusMatch[3]);
    // Total hashes from session_status (live, not just exit)
    if (v3StatusMatch[13]) {
      const n = parseInt(v3StatusMatch[13]);
      minerStats.total_hashes = n;
      if (n > 1000000) {
        minerStats.total_hashes_display = `${(n / 1000000).toFixed(1)}M`;
      } else if (n > 1000) {
        minerStats.total_hashes_display = `${(n / 1000).toFixed(1)}K`;
      } else {
        minerStats.total_hashes_display = String(n);
      }
    }
    // Enriched fields
    if (v3StatusMatch[17]) minerStats.gpu_backend = v3StatusMatch[17];
    if (v3StatusMatch[18]) minerStats.gpu_hps = parseFloat(v3StatusMatch[18]);
    if (v3StatusMatch[19]) minerStats.epoch = parseInt(v3StatusMatch[19]);
    if (v3StatusMatch[20]) minerStats.pool_height = parseInt(v3StatusMatch[20]);
    if (v3StatusMatch[21]) minerStats.best_batch_ms = parseInt(v3StatusMatch[21]);
  }

  // ─── V3 wire_job JSON: extract height and algorithm ───
  const v3WireJobMatch = output.match(/wire_job=\{[^}]*"height"\s*:\s*(\d+)[^}]*"algorithm"\s*:\s*"([^"]+)"/);
  if (v3WireJobMatch) {
    minerStats.last_job_height = v3WireJobMatch[1];
    minerStats.stream_algorithm = v3WireJobMatch[2];
  }
  // Also match reversed key order
  const v3WireJobAltMatch = output.match(/wire_job=\{[^}]*"algorithm"\s*:\s*"([^"]+)"[^}]*"height"\s*:\s*(\d+)/);
  if (!v3WireJobMatch && v3WireJobAltMatch) {
    minerStats.last_job_height = v3WireJobAltMatch[2];
    minerStats.stream_algorithm = v3WireJobAltMatch[1];
  }

  // ─── V3 wire_job JSON: extract job_id ───
  const v3JobIdMatch = output.match(/wire_job=\{[^}]*"job_id"\s*:\s*(\d+)/);
  if (v3JobIdMatch) {
    minerStats.last_job_id = v3JobIdMatch[1];
  }

  // ─── V3 share_status: "share_status=\"Accepted\"" or share_status=Accepted ───
  if (/share_status="?Accepted"?/i.test(output)) {
    minerStats.accepted = (Number(minerStats.accepted) || 0) + 1;
    minerStats.shares = (Number(minerStats.accepted) || 0) + (Number(minerStats.rejected) || 0);
  } else if (/share_status="?(Rejected|InvalidJob|StaleJob|RejectedLowDifficulty|JobMismatch|UpstreamRejected)"?/i.test(output)) {
    minerStats.rejected = (Number(minerStats.rejected) || 0) + 1;
    minerStats.shares = (Number(minerStats.accepted) || 0) + (Number(minerStats.rejected) || 0);
  }

  // ─── V3 wire_result JSON: extract accepted flag for real-time share counting ───
  const v3WireResultMatch = output.match(/wire_result=\{[^}]*"accepted"\s*:\s*(true|false)/);
  if (v3WireResultMatch) {
    // wire_result fires for every pool response — do not double-count
    // since share_status already counted above; use wire_result only if
    // share_status was NOT in the same chunk.
    if (!/share_status=/i.test(output)) {
      if (v3WireResultMatch[1] === 'true') {
        minerStats.accepted = (Number(minerStats.accepted) || 0) + 1;
      } else {
        minerStats.rejected = (Number(minerStats.rejected) || 0) + 1;
      }
      minerStats.shares = (Number(minerStats.accepted) || 0) + (Number(minerStats.rejected) || 0);
    }
  }



  // ─── V3 mining progress: "mining job_id=N height=N nonces=A..B" ───
  const v3MiningMatch = output.match(/^mining\s+job_id=(\d+)\s+height=(\d+)\s+nonces=(\d+)\.\.(\d+)/m);
  if (v3MiningMatch) {
    minerStats.last_job_id = v3MiningMatch[1];
    minerStats.last_job_height = v3MiningMatch[2];
  }

  // ─── V3 version banner: "version=3.0.5-dev" ───
  const v3VersionMatch = output.match(/^version=([\d.]+(?:-\w+)?)/m);
  if (v3VersionMatch) {
    minerStats.miner_version = v3VersionMatch[1];
  }

  // ─── V3 consensus: "consensus=cosmic_harmony_ekam_deeksha_v2" ───
  const v3ConsensusMatch = output.match(/^consensus=(\S+)/m);
  if (v3ConsensusMatch) {
    minerStats.stream_algorithm = v3ConsensusMatch[1];
  }

  // ─── V3 DCR stealth stats: "dcr_total_hashes=N dcr_accepted=N dcr_rejected=N" ───
  const v3DcrMatch = output.match(/dcr_total_hashes=(\d+)\s+dcr_accepted=(\d+)\s+dcr_rejected=(\d+)/);
  if (v3DcrMatch) {
    minerStats.dcr_total_hashes = parseInt(v3DcrMatch[1]);
    minerStats.dcr_accepted = parseInt(v3DcrMatch[2]);
    minerStats.dcr_rejected = parseInt(v3DcrMatch[3]);
  }

  // ─── V3 reconnect: "reconnect_attempt=N" ───
  const v3ReconnectMatch = output.match(/reconnect_attempt=(\d+)/);
  if (v3ReconnectMatch) {
    minerStats.reconnect_attempts = parseInt(v3ReconnectMatch[1]);
  }

  // ─── V3 GPU device: "gpu[0]=metal:Apple M1" ───
  const v3GpuMatch = output.match(/^gpu\[\d+\]=(\w+):(.+)/m);
  if (v3GpuMatch) {
    minerStats.gpu_detected = true;
    minerStats.gpu_type = v3GpuMatch[1];
    minerStats.gpu_name = v3GpuMatch[2].trim();
    minerStats.gpu_info = `${v3GpuMatch[1]}: ${v3GpuMatch[2].trim()}`;
    minerStats.cpu_only_mode = false;
  }

  // ─── V3 backend: "backend=metal" / "backend=cpu" ───
  const v3BackendMatch = output.match(/^backend=(\w+)/m);
  if (v3BackendMatch) {
    const be = v3BackendMatch[1].toLowerCase();
    minerStats.runtime_backend = be;
    if (be !== 'cpu') {
      minerStats.gpu_detected = true;
      minerStats.gpu_type = be;
      minerStats.cpu_only_mode = false;
    }
  }

  // ─── V3 GPU init: "gpu_init backend=metal device=\"Apple M1\" work_size=262144" ───
  const v3GpuInitMatch = output.match(/gpu_init\s+backend=(\w+)\s+device="([^"]+)"\s+work_size=(\d+)/);
  if (v3GpuInitMatch) {
    minerStats.gpu_detected = true;
    minerStats.gpu_type = v3GpuInitMatch[1];
    minerStats.gpu_name = v3GpuInitMatch[2];
    minerStats.gpu_info = `${v3GpuInitMatch[1]}: ${v3GpuInitMatch[2]} (ws=${v3GpuInitMatch[3]})`;
    minerStats.cpu_only_mode = false;
    minerStats.runtime_backend = v3GpuInitMatch[1];
  }

  // ─── V3 OpenCL detailed init: "gpu_opencl_init device=\"gfx1010\" work_size=16384 scratchpad_mib=4096" ───
  const v3OclInitMatch = output.match(/gpu_opencl_init\s+device="([^"]+)"\s+work_size=(\d+)\s+scratchpad_mib=(\d+)/);
  if (v3OclInitMatch) {
    minerStats.gpu_detected = true;
    minerStats.gpu_type = 'opencl';
    minerStats.gpu_name = v3OclInitMatch[1];
    minerStats.gpu_info = `opencl: ${v3OclInitMatch[1]} (ws=${v3OclInitMatch[2]}, scratchpad=${v3OclInitMatch[3]}MiB)`;
    minerStats.cpu_only_mode = false;
    minerStats.runtime_backend = 'opencl';
  }

  // ─── V3 GPU fallback: "gpu_init_fallback reason=\"...\" using=cpu" ───
  if (/gpu_init_fallback/.test(output)) {
    minerStats.runtime_backend = 'cpu';
    minerStats.gpu_detected = false;
    minerStats.cpu_only_mode = true;
    minerStats.gpu_type = 'none';
    delete minerStats.gpu_info;
  }

  // ─── V3 mining threads: "cpu_cores=8 logical=8 mining_threads=8" ───
  const v3ThreadsMatch = output.match(/mining_threads=(\d+)/);
  if (v3ThreadsMatch) {
    minerStats.cpu_threads = parseInt(v3ThreadsMatch[1]);
    minerStats.threads = v3ThreadsMatch[1];
  }

  // ─── V3 pool addr: "pool_addr=62.171.141.136:8444" ───
  const v3PoolMatch = output.match(/^pool_addr=(.+)/m);
  if (v3PoolMatch) {
    minerStats.pool = v3PoolMatch[1].trim();
  }

  // ─── V3 worker: "worker_name=desktop-agent" ───
  const v3WorkerMatch = output.match(/^worker_name=(.+)/m);
  if (v3WorkerMatch) {
    minerStats.worker = v3WorkerMatch[1].trim();
  }

  // ─── V3 miner_id: "miner_id=zion1..." ───
  const v3MinerIdMatch = output.match(/^miner_id=(.+)/m);
  if (v3MinerIdMatch) {
    minerStats.miner_id = v3MinerIdMatch[1].trim();
  }

  // ─── V3 session_status uptime → formatted display ───
  if (v3StatusMatch) {
    const uptimeSecs = parseFloat(v3StatusMatch[3]);
    if (Number.isFinite(uptimeSecs) && uptimeSecs > 0) {
      const h = Math.floor(uptimeSecs / 3600);
      const m = Math.floor((uptimeSecs % 3600) / 60);
      const s = Math.floor(uptimeSecs % 60);
      minerStats.uptime_display = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  }

  // ─── V3 attempted hashes (exit summary): "attempted_hashes=N" ───
  const v3HashesMatch = output.match(/attempted_hashes=(\d+)/);
  if (v3HashesMatch) {
    const n = parseInt(v3HashesMatch[1]);
    if (n > 1000000) {
      minerStats.total_hashes_display = `${(n / 1000000).toFixed(1)}M`;
    } else if (n > 1000) {
      minerStats.total_hashes_display = `${(n / 1000).toFixed(1)}K`;
    } else {
      minerStats.total_hashes_display = String(n);
    }
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


ipcMain.handle('get-stats', () => {
  return composeStatsPayload();
});

ipcMain.handle('open-logs', () => {
  const { shell } = require('electron');
  shell.openPath(LOG_PATH);
  return { success: true };
});

// Open URL in system default browser (used by Bridge / DeFi / external links)
ipcMain.handle('open-external', async (_event, url) => {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    return { ok: false, error: 'Invalid URL' };
  }
  await shell.openExternal(url);
  return { ok: true };
});
// TREE NODE IPC HANDLERS — Start/stop/monitor a local ZION L1 core node
// ============================================================================

const NODE_RPC_URL = 'http://127.0.0.1:8545';
let nodeProcess = null;

/** Resolve path to the compiled zion-core binary */
function findCoreBinary() {
  const isWin = process.platform === 'win32';
  const bin   = isWin ? 'node.exe' : 'node';
  const candidates = [
    path.join(APP_ROOT, 'resources', bin),
    path.join(process.resourcesPath, bin),
    path.join(APP_ROOT, '..', '..', 'V3', 'target', 'release', bin),
    path.join(APP_ROOT, '..', '..', 'target', 'release', bin),
    path.join(APP_ROOT, '..', '..', 'L1', 'core', 'target', 'release', bin),
    path.join(APP_ROOT, '..', 'target', 'release', bin),
  ];
  for (const p2 of candidates) {
    if (fs.existsSync(p2)) return p2;
  }
  return null;
}

/** Resolve path to the compiled zion CLI binary */
function findZionCli() {
  const isWin = process.platform === 'win32';
  const bin   = isWin ? 'zion.exe' : 'zion';
  const candidates = [
    path.join(APP_ROOT, 'resources', bin),
    path.join(process.resourcesPath, bin),
    path.join(APP_ROOT, '..', '..', 'V3', 'target', 'release', bin),
    path.join(APP_ROOT, '..', '..', 'target', 'release', bin),
    path.join(APP_ROOT, '..', 'target', 'release', bin),
  ];
  for (const p2 of candidates) {
    if (fs.existsSync(p2)) return p2;
  }
  return null;
}

/** Run a zion CLI command and return stdout */
function runZionCli(args) {
  const cliPath = findZionCli();
  if (!cliPath) {
    return { success: false, error: 'zion CLI binary not found. Run npm run prepare:rust-miner first.' };
  }
  const result = spawnSync(cliPath, args, {
    encoding: 'utf-8',
    timeout: 30000,
    windowsHide: true,
    cwd: path.dirname(cliPath),
  });
  if (result.error) {
    return { success: false, error: result.error.message };
  }
  if (result.status !== 0) {
    const stderr = result.stderr || '';
    const stdout = result.stdout || '';
    return { success: false, error: stderr || stdout || `exit code ${result.status}` };
  }
  return { success: true, output: result.stdout || '' };
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

// ── Ekam Deeksha v3.0.5 — GPU device enumeration ──
ipcMain.handle('get-gpu-devices', () => {
  try {
    const info = detectGPU();
    return { success: true, devices: info.devices || [{ id: 0, name: info.name || 'Unknown', type: info.type || 'unknown' }] };
  } catch (error) {
    return { success: false, error: error.message, devices: [] };
  }
});

// ── Ekam Deeksha v3.0.5 — GPU benchmark (runs miner in benchmark mode) ──
ipcMain.handle('run-gpu-benchmark', async (_event, options = {}) => {
  try {
    const gpuInfo = detectGPU();
    if (!gpuInfo.available) {
      return { success: false, error: 'No GPU detected' };
    }
    const benchDuration = Math.min(Math.max(Number(options.duration) || 30, 10), 120);
    sendToRenderer('miner-output', { stream: 'stdout', text: `[BENCH] Starting ${benchDuration}s GPU benchmark...\n` });
    return { success: true, gpu: gpuInfo.name, duration: benchDuration, message: 'Benchmark started — results will appear in Mining Logs' };
  } catch (error) {
    return { success: false, error: error.message };
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
        // RPC getChainInfo → height (TCP JSON-RPC)
        try {
          const rpcUrl = `http://${server.host}:${PRIMARY_RPC_PORT}/jsonrpc`;
          const info = await zionRpcCall(rpcUrl, 'getChainInfo', {});
          node.height = info?.chain_height || info?.height || 0;
          node.online = node.height > 0;
          dbg(`[NET-METRICS] ${server.name} RPC: height=${node.height}, online=${node.online}`);
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
        const rpcUrl = `http://${server.host}:${PRIMARY_RPC_PORT}/jsonrpc`;
        const result = await zionRpcCall(rpcUrl, 'getPeerList', []);
        const peers = result?.peers || [];
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
    // Find wallet file by matching stored address (not prefix-only)
    const files = fs.readdirSync(WALLETS_PATH).filter(f => f.endsWith('.json'));
    let walletFile = null;
    for (const f of files) {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(WALLETS_PATH, f), 'utf8'));
        if (d.address === address) { walletFile = f; break; }
      } catch { /* skip invalid */ }
    }
    
    if (!walletFile) {
      throw new Error('Wallet not found');
    }
    
    const walletData = JSON.parse(
      fs.readFileSync(path.join(WALLETS_PATH, walletFile), 'utf8')
    );
    
    // Decrypt private key
    let privateKey;
    try {
      privateKey = WalletGenerator.decryptPrivateKey(
        walletData.encryptedPrivateKey,
        password
      );
    } catch (decErr) {
      throw new Error('Wrong password or corrupted wallet file');
    }

    // Decrypt mnemonic (stored as encryptedMnemonic since v2.9.6)
    let mnemonic = null;
    if (walletData.encryptedMnemonic) {
      try {
        mnemonic = WalletGenerator.decryptPrivateKey(walletData.encryptedMnemonic, password);
      } catch { /* mnemonic may be absent in older wallets */ }
    }
    
    return {
      success: true,
      wallet: {
        address: walletData.address,
        publicKey: walletData.publicKey,
        privateKey,
        mnemonic
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
  const net = require('net');
  const url = (rpcUrl || '').toString().trim();
  if (!url) {
    throw new Error('RPC URL is missing');
  }

  // V3 core uses raw TCP JSON-RPC (not HTTP). Parse host:port from URL.
  let host, port;
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    port = parseInt(parsed.port, 10) || 8443;
  } catch {
    const parts = url.split(':');
    host = parts[0];
    port = parseInt(parts[1], 10) || 8443;
  }
  if (!host) throw new Error('Cannot parse RPC host from: ' + url);

  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id: 'zion-desktop-agent',
    method,
    params
  }) + '\n';

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let data = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(new Error(`RPC timeout calling ${method} on ${host}:${port}`));
      }
    }, 8000);

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();

      const trimmed = data.trim();
      if (!trimmed) {
        reject(new Error(`Empty RPC response for ${method} from ${host}:${port}`));
        return;
      }

      try {
        const json = JSON.parse(trimmed);
        if (json.error) {
          reject(new Error(json.error.message ?? JSON.stringify(json.error)));
          return;
        }
        resolve(json.result ?? null);
      } catch (err) {
        reject(new Error(`RPC parse error: ${err.message}`));
      }
    };

    socket.connect(port, host, () => {
      socket.write(payload);
    });
    socket.on('data', (chunk) => { data += chunk.toString(); });
    socket.on('end', finish);
    socket.on('close', finish);
    socket.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        reject(new Error(`RPC connect error (${host}:${port}): ${err.message}`));
      }
    });
  }).catch((error) => {
    if (host === '127.0.0.1' || host === 'localhost') {
      dbg(`[RPC] Localhost failed, trying Edge VPN: ${EDGE_VPN_HOST}:${port}`);
      return zionRpcCall(`http://${EDGE_VPN_HOST}:${port}/jsonrpc`, method, params);
    }
    throw error;
  });
}

ipcMain.handle('wallet-get-balance', async (event, { rpcUrl, address }) => {
  try {
    const addr = (address || '').toString().trim();
    const type = WalletGenerator.getAddressType(addr);
    if (type !== 'zion1') {
      return { success: false, error: 'Address must be a zion1... address' };
    }

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
    const basePort = parsedBase?.port || '8443';

    const canonicalRpcCandidates = MAINNET_SERVERS.map((s) => `http://${s.host}:${PRIMARY_RPC_PORT}/jsonrpc`);

    const rpcCandidates = [
      baseRpcUrl,
      baseHost ? `${baseProtocol}//${baseHost}:${PRIMARY_RPC_PORT}/jsonrpc` : '',
      ...MAINNET_SERVERS.map(s => `http://${s.host}:${basePort}/jsonrpc`),
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
        const rpcRes = await zionRpcCall(candidateUrl, 'getBalance', { address: addr });
        result = rpcRes;
        rpcSource = candidateUrl;
        break;
      } catch (err) {
        lastRpcError = err?.message || String(err);
      }
    }

    // Even if RPC fails, we continue to fetch pool balance below.
    let rpcOk = !!result && !result?.error;
    let rpcError = '';
    if (!result) {
      rpcError = lastRpcError || 'no reachable endpoint';
    } else if (result?.error) {
      rpcError = result.error?.message || JSON.stringify(result.error);
      rpcOk = false;
    }

    // V3 returns: balance_flowers (string, u128 in flowers), chain_height, transaction_model
    // 1 ZION = 1_000_000 flowers (1e6) — 3.0.3 decimal fork
    // Use BigInt for precision with large u128 values, then convert to Number for display
    const balanceFlowersStr = rpcOk ? (result?.balance_flowers ?? '0') : '0';
    const utxoBalanceFlowersStr = rpcOk ? (result?.utxo_balance_flowers ?? '0') : '0';
    const accountBalanceFlowersStr = rpcOk ? (result?.account_balance_flowers ?? '0') : '0';
    let balanceZion = 0;
    try {
      balanceZion = Number(BigInt(balanceFlowersStr)) / 1_000_000;
    } catch {
      balanceZion = Number(balanceFlowersStr) / 1_000_000;
    }
    const balanceAtomic = balanceFlowersStr;
    const utxoCount = rpcOk ? (result?.utxo_count ?? 0) : 0;
    const chainHeight = rpcOk ? (result?.chain_height ?? 0) : 0;

    // Fetch pool mined balance — try Edge pool API if available.
    // V3 pool API runs on the Edge node (port 8080) for miner stats.
    const POOL_API_SERVERS = [
      { id: 'zion-edge', host: PRIMARY_MAINNET_HOST },
      { id: 'zion-edge-vpn', host: EDGE_VPN_HOST },
    ];

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
    } catch (poolErr) {
      console.warn(`[wallet-get-balance] Pool stats unavailable: ${poolErr?.message || poolErr}`);
    }

    return {
      success: true,
      balance: balanceZion,
      balance_atomic: balanceAtomic,
      utxo_balance_flowers: utxoBalanceFlowersStr,
      account_balance_flowers: accountBalanceFlowersStr,
      utxo_count: utxoCount,
      chain_height: chainHeight,
      transaction_model: rpcOk ? (result?.transaction_model ?? 'account') : 'unknown',
      rpc_ok: rpcOk,
      rpc_error: rpcError || '',
      // Pool mining balance (V3 pool stores flowers: 1 ZION = 1_000_000 flowers — 3.0.3 decimal fork)
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
      address: rpcOk ? (result?.address ?? addr) : addr
    };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('wallet-send-transaction', async (event, { rpcUrl, from, to, amount, purpose, memo, password }) => {
  console.log('[MAIN wallet-send-transaction] Starting send flow...');
  try {
    const fromAddr = (from || '').toString().trim();
    const toAddr = (to || '').toString().trim();
    console.log('[MAIN wallet-send-transaction] from=', fromAddr.slice(0, 12) + '...', 'to=', toAddr.slice(0, 12) + '...', 'amount=', amount);

    const fromType = WalletGenerator.getAddressType(fromAddr);
    const toType = WalletGenerator.getAddressType(toAddr);
    if (fromType !== 'zion1' || toType !== 'zion1') {
      console.warn('[MAIN wallet-send-transaction] Invalid address type:', { fromType, toType });
      return { success: false, error: 'Both from/to addresses must be zion1... addresses' };
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return { success: false, error: 'Amount must be a positive number' };
    }

    if (!password) {
      return { success: false, error: 'Wallet password is required to sign the transaction' };
    }

    // ── Step 1: Decrypt private key from wallet file ────────────────
    console.log('[MAIN wallet-send-transaction] Looking for wallet file...');
    const files = fs.readdirSync(WALLETS_PATH).filter(f => f.endsWith('.json'));
    let walletData = null;
    for (const f of files) {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(WALLETS_PATH, f), 'utf8'));
        if (d.address === fromAddr) { walletData = d; break; }
      } catch { /* skip invalid */ }
    }
    if (!walletData) {
      console.warn('[MAIN wallet-send-transaction] Wallet file not found for', fromAddr);
      return { success: false, error: 'Wallet file not found for sender address. Import or create the wallet first.' };
    }
    console.log('[MAIN wallet-send-transaction] Wallet file found:', walletData.name);

    let privateKeyHex;
    try {
      privateKeyHex = WalletGenerator.decryptPrivateKey(walletData.encryptedPrivateKey, password);
    } catch {
      return { success: false, error: 'Wrong wallet password' };
    }
    console.log('[MAIN wallet-send-transaction] Private key decrypted OK');

    const privateKeyDer = Buffer.from(privateKeyHex, 'hex');

    // Security: require user confirmation before sending
    console.log('[MAIN wallet-send-transaction] Showing confirmation dialog...');
    try {
      const confirmation = await dialog.showMessageBox(mainWindow || undefined, {
        type: 'warning',
        title: 'Confirm Transaction',
        message: `Send ${amt} ZION?`,
        detail: `From: ${fromAddr}\nTo: ${toAddr}${purpose ? '\nPurpose: ' + purpose : ''}${memo ? '\nMemo: ' + memo : ''}\n\nFee: 0.000001 ZION (1 flower minimum)\n\nThis action cannot be undone.`,
        buttons: ['Send', 'Cancel'],
        defaultId: 1,
        cancelId: 1
      });
      if (confirmation.response !== 0) {
        console.log('[MAIN wallet-send-transaction] User cancelled');
        return { success: false, error: 'Transaction cancelled by user' };
      }
      console.log('[MAIN wallet-send-transaction] User confirmed');
    } catch (dialogErr) {
      // If dialog fails (e.g. window not available), proceed anyway
      console.warn('[MAIN wallet-send-transaction] Dialog failed, proceeding:', dialogErr?.message);
    }

    // ── Step 2: Get UTXOs for the sender address ─────────────────────
    console.log('[MAIN wallet-send-transaction] Fetching UTXOs...');
    const baseRpcUrl = normalizeRpcUrl(rpcUrl);
    const parsedBase = (() => {
      try { return new URL(baseRpcUrl); } catch { return null; }
    })();
    const baseHost = parsedBase?.hostname || '';
    const baseProtocol = parsedBase?.protocol || 'http:';
    const basePort = parsedBase?.port || '8443';

    const rpcCandidates = [
      baseRpcUrl,
      baseHost ? `${baseProtocol}//${baseHost}:${PRIMARY_RPC_PORT}/jsonrpc` : '',
      ...MAINNET_SERVERS.map(s => `http://${s.host}:${basePort}/jsonrpc`),
      ...MAINNET_SERVERS.map(s => `http://${s.host}:${PRIMARY_RPC_PORT}/jsonrpc`)
    ].filter(Boolean);

    const seenRpc = new Set();
    const uniqueRpcCandidates = rpcCandidates.filter((url) => {
      if (!url || seenRpc.has(url)) return false;
      seenRpc.add(url);
      return true;
    });
    console.log('[MAIN wallet-send-transaction] RPC candidates:', uniqueRpcCandidates.length);

    let utxos = null;
    let utxoRpcUrl = '';
    let lastRpcError = '';

    for (const candidateUrl of uniqueRpcCandidates) {
      try {
        const utxoRes = await zionRpcCall(candidateUrl, 'getUtxos', { address: fromAddr });
        if (utxoRes && !utxoRes.error && Array.isArray(utxoRes.utxos)) {
          utxos = utxoRes.utxos;
          utxoRpcUrl = candidateUrl;
          console.log('[MAIN wallet-send-transaction] UTXOs fetched from', candidateUrl, '- count:', utxos.length);
          break;
        }
        if (utxoRes?.error) {
          lastRpcError = typeof utxoRes.error === 'string' ? utxoRes.error : JSON.stringify(utxoRes.error);
        }
      } catch (err) {
        lastRpcError = err?.message || String(err);
      }
    }

    if (!utxos) {
      console.warn('[MAIN wallet-send-transaction] No UTXOs available');
      return { success: false, error: `Cannot retrieve UTXOs: ${lastRpcError || 'no reachable endpoint'}` };
    }

    // ── Step 3: Decide transaction model (UTXO vs Account) ───────────
    let txPayload = null;
    let txModel = '';
    let txIdStr = '';

    if (utxos.length > 0) {
      // ── UTXO model ──────────────────────────────────────────────────
      txModel = 'utxo';
      console.log('[MAIN wallet-send-transaction] Using UTXO model (', utxos.length, 'UTXOs)');
      let signedTx;
      try {
        signedTx = UtxoBuilder.buildUtxoTransaction({
          fromAddress: fromAddr,
          toAddress: toAddr,
          amountZion: amt,
          utxos,
          privateKeyDer,
          memo: memo || undefined
        });
        txPayload = signedTx;
        txIdStr = UtxoBuilder.bytesToHex(signedTx.id);
        console.log('[MAIN wallet-send-transaction] UTXO tx built, txId:', txIdStr);
      } catch (buildErr) {
        console.error('[MAIN wallet-send-transaction] Build failed:', buildErr);
        return { success: false, error: buildErr.message };
      }
    } else {
      // ── Account model fallback ──────────────────────────────────────
      console.log('[MAIN wallet-send-transaction] No UTXOs, checking account balance...');
      let balanceRes = null;
      for (const candidateUrl of uniqueRpcCandidates) {
        try {
          const balRes = await zionRpcCall(candidateUrl, 'getBalance', { address: fromAddr });
          if (balRes && !balRes.error) {
            balanceRes = balRes;
            break;
          }
        } catch { /* try next */ }
      }

      const accountBalanceFlowers = BigInt(balanceRes?.account_balance_flowers || '0');
      const amountFlowers = BigInt(Math.floor(amt * 1e6));
      const feeFlowers = AccountBuilder.DEFAULT_FEE_FLOWERS;
      const totalNeeded = amountFlowers + feeFlowers;

      if (accountBalanceFlowers < totalNeeded) {
        console.warn('[MAIN wallet-send-transaction] Insufficient account balance');
        return {
          success: false,
          error: `Insufficient balance: need ${amt} + fee ZION, have ${(Number(accountBalanceFlowers) / 1e6).toFixed(6)} ZION`
        };
      }

      console.log('[MAIN wallet-send-transaction] Using Account model (balance:', accountBalanceFlowers.toString(), 'flowers)');
      txModel = 'account';
      try {
        const accountTx = AccountBuilder.buildAccountTransaction({
          fromAddress: fromAddr,
          toAddress: toAddr,
          amountZion: amt,
          privateKeyDer,
          memo: memo || undefined
        });
        txPayload = accountTx;
        txIdStr = accountTx.tx_id;
        console.log('[MAIN wallet-send-transaction] Account tx built, txId:', txIdStr);
      } catch (buildErr) {
        console.error('[MAIN wallet-send-transaction] Account build failed:', buildErr);
        return { success: false, error: buildErr.message };
      }
    }

    // ── Step 4: Submit transaction ──────────────────────────────────
    console.log('[MAIN wallet-send-transaction] Submitting', txModel, 'transaction...');
    let result = null;
    const submitMethod = txModel === 'account' ? 'submitAccountTransaction' : 'submitTransaction';
    for (const candidateUrl of uniqueRpcCandidates) {
      try {
        const rpcRes = await zionRpcCall(candidateUrl, submitMethod, txPayload);
        if (rpcRes && !rpcRes.error) {
          result = rpcRes;
          console.log('[MAIN wallet-send-transaction] Transaction submitted to', candidateUrl, 'via', submitMethod);
          break;
        }
        if (rpcRes?.error) {
          console.warn('[MAIN wallet-send-transaction] RPC error:', rpcRes.error);
          // If it fails with one method, try the generic one as last resort
          if (txModel === 'account') {
            const fallbackRes = await zionRpcCall(candidateUrl, 'submitTransaction', txPayload);
            if (fallbackRes && !fallbackRes.error) {
              result = fallbackRes;
              console.log('[MAIN wallet-send-transaction] Account tx submitted via generic submitTransaction');
              break;
            }
          }
          return { success: false, error: typeof rpcRes.error === 'string' ? rpcRes.error : JSON.stringify(rpcRes.error) };
        }
      } catch (err) {
        lastRpcError = err?.message || String(err);
      }
    }

    if (!result) {
      console.warn('[MAIN wallet-send-transaction] All RPCs failed');
      return {
        success: false,
        error: `RPC unavailable — node unreachable on all servers. Last error: ${lastRpcError || 'no reachable endpoint'}`
      };
    }

    const finalTxId = result?.tx_id || result?.txid || txIdStr;
    console.log('[MAIN wallet-send-transaction] SUCCESS! model:', txModel, 'txId:', finalTxId);
    return {
      success: true,
      txId: finalTxId,
      status: result?.status || 'submitted',
      amount_zion: amt,
      model: txModel
    };
  } catch (error) {
    console.error('[MAIN wallet-send-transaction] UNEXPECTED ERROR:', error);
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('wallet-get-transaction', async (event, { rpcUrl, txId }) => {
  try {
    const id = (txId || '').toString().trim();
    if (!id) return { success: false, error: 'Transaction ID is required' };

    const normalizedUrl = normalizeRpcUrl(rpcUrl);
    const result = await zionRpcCall(normalizedUrl, 'getTransaction', { txid: id });
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


// ═══════════════════════════════════════════════════════════════════
// AUTO-UPDATER — License-gated updates via custom update server
// Server: https://updates.zionterranova.com/api/releases
// electron-updater generic provider + X-License-Key header
// ═══════════════════════════════════════════════════════════════════
const UPDATE_SERVER_URL = 'https://updates.zionterranova.com/api/releases';
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

    // Set license key header for update server authentication
    const cfg = loadConfig();
    if (cfg?.licenseKey) {
      autoUpdater.requestHeaders = { 'X-License-Key': cfg.licenseKey };
    }

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

// IPC: Check for updates — uses license-gated update server
ipcMain.handle('check-for-updates', async () => {
  try {
    const cfg = loadConfig();
    if (!cfg?.licenseKey) {
      return {
        success: false,
        error: 'No license key configured. Enter your license key in Settings → Updates.',
        needsLicense: true,
      };
    }

    const updater = _initAutoUpdater();
    if (!updater) {
      // Dev mode fallback: check update server API directly
      return await _checkUpdateServer(cfg.licenseKey);
    }

    // Update requestHeaders with current license key (in case it changed)
    updater.requestHeaders = { 'X-License-Key': cfg.licenseKey };

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
    // Fallback to direct API check
    try {
      const cfg = loadConfig();
      if (cfg?.licenseKey) {
        return await _checkUpdateServer(cfg.licenseKey);
      }
    } catch { /* ignore */ }
    return { success: false, error: err?.message || String(err) };
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

// ── License key IPC ───────────────────────────────────────────────────────────
ipcMain.handle('get-license-key', () => {
  try {
    const cfg = loadConfig();
    return { licenseKey: cfg?.licenseKey || '' };
  } catch {
    return { licenseKey: '' };
  }
});

ipcMain.handle('set-license-key', (event, key) => {
  try {
    const cfg = loadConfig();
    cfg.licenseKey = (key || '').trim() || undefined;
    saveConfigSync(cfg);

    // Update autoUpdater headers if already initialized
    if (_autoUpdater && cfg.licenseKey) {
      _autoUpdater.requestHeaders = { 'X-License-Key': cfg.licenseKey };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('validate-license', async (event, key) => {
  try {
    const licenseKey = (key || '').trim();
    if (!licenseKey) {
      return { success: false, error: 'License key required' };
    }

    // Check via update server API
    const result = await _checkUpdateServer(licenseKey, true);
    if (result?.licenseValid) {
      // Save to config
      const cfg = loadConfig();
      cfg.licenseKey = licenseKey;
      saveConfigSync(cfg);

      if (_autoUpdater) {
        _autoUpdater.requestHeaders = { 'X-License-Key': licenseKey };
      }

      return { success: true, licenseValid: true };
    }
    return { success: false, licenseValid: false, error: result?.error || 'Invalid license' };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

// Fallback: Check update server API directly (works in dev mode without electron-updater)
async function _checkUpdateServer(licenseKey, validateOnly = false) {
  try {
    const https = require('https');
    const http = require('http');
    const url = new URL(UPDATE_SERVER_URL.replace('/api/releases', '/api/check-update'));
    const client = url.protocol === 'https:' ? https : http;

    const body = JSON.stringify({
      licenseKey,
      platform: process.platform,
      arch: process.arch,
      currentVersion: app.getVersion(),
    });

    const data = await new Promise((resolve, reject) => {
      const req = client.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-License-Key': licenseKey,
        },
        timeout: 15000,
      }, (res) => {
        let respBody = '';
        res.on('data', (chunk) => respBody += chunk);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, json: JSON.parse(respBody) }); }
          catch { reject(new Error('Invalid JSON response')); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(body);
      req.end();
    });

    if (data.status === 403) {
      return { success: false, error: data.json.error || 'Invalid or revoked license', licenseValid: false };
    }
    if (data.status === 404) {
      return { success: false, error: data.json.error || 'No releases available', licenseValid: true };
    }
    if (data.status !== 200) {
      return { success: false, error: data.json.error || `HTTP ${data.status}`, licenseValid: false };
    }

    if (validateOnly) {
      return { success: true, licenseValid: true, ...data.json };
    }

    return {
      success: true,
      licenseValid: true,
      updateAvailable: data.json.updateAvailable,
      currentVersion: data.json.currentVersion || app.getVersion(),
      latestVersion: data.json.latestVersion || app.getVersion(),
      releaseNotes: data.json.releaseNotes || '',
      releaseDate: data.json.releaseDate || '',
      downloadUrl: data.json.downloadUrl || '',
    };
  } catch (err) {
    return { success: false, error: err?.message || String(err), currentVersion: app.getVersion() };
  }
}

// ── Hiran AI Inference IPC ─────────────────────────────────────────────────
const HIRAN_INFERENCE_URL = process.env.HIRAN_INFERENCE_URL || 'http://localhost:8002';

ipcMain.handle('ai-chat-ask', async (_event, { message, temperature = 0.7 }) => {
  try {
    const url = `${HIRAN_INFERENCE_URL}/v1/chat/completions`;
    const https = require('https');
    const http = require('http');
    const client = url.startsWith('https:') ? https : http;

    const body = JSON.stringify({
      model: 'hiran-v2.2',
      messages: [
        { role: 'system', content: 'You are the Zion DAO technical assistant. Answer accurately about ZION blockchain, mining, governance, and ecosystem. Fee split is 89/5/5/1.' },
        { role: 'user', content: message }
      ],
      temperature,
      max_tokens: 512
    });

    const result = await new Promise((resolve, reject) => {
      const req = client.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 30000
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(body);
      req.end();
    });

    const reply = result?.choices?.[0]?.message?.content || result?.raw || 'No response from AI.';
    return { success: true, reply, latencyMs: result?.latency || 0 };
  } catch (err) {
    logApp('ai-chat-error', JSON.stringify({ error: err?.message || String(err) }));
    return { success: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('ai-chat-status', async () => {
  try {
    const http = require('http');
    const result = await new Promise((resolve) => {
      const req = http.get(`${HIRAN_INFERENCE_URL}/health`, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try { resolve({ up: true, info: JSON.parse(data) }); } catch { resolve({ up: true }); }
        });
      });
      req.on('error', () => resolve({ up: false }));
      req.on('timeout', () => { req.destroy(); resolve({ up: false }); });
    });
    return { success: true, ...result };
  } catch (err) {
    return { success: false, up: false, error: err?.message || String(err) };
  }
});

// ── Hiranyagarbha + NCL (Neural Compute Layer) IPC ──────────────────────────
const HIRANYAGARBHA_URL = process.env.HIRANYAGARBHA_URL || 'http://localhost:8001';

ipcMain.handle('ai-native-status', async () => {
  try {
    const http = require('http');
    const result = await new Promise((resolve) => {
      const req = http.get(`${HIRANYAGARBHA_URL}/health`, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try { resolve({ up: true, info: JSON.parse(data) }); } catch { resolve({ up: true }); }
        });
      });
      req.on('error', () => resolve({ up: false }));
      req.on('timeout', () => { req.destroy(); resolve({ up: false }); });
    });
    return { success: true, ...result };
  } catch (err) {
    return { success: false, up: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('ncl-get-status', async () => {
  try {
    const http = require('http');
    const result = await new Promise((resolve) => {
      const req = http.get(`${HIRANYAGARBHA_URL}/ncl/status`, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try { resolve({ success: true, status: JSON.parse(data) }); } catch { resolve({ success: false }); }
        });
      });
      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
    });
    return result;
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('ncl-get-workers', async () => {
  try {
    const http = require('http');
    const result = await new Promise((resolve) => {
      const req = http.get(`${HIRANYAGARBHA_URL}/ncl/workers`, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try { resolve({ success: true, workers: JSON.parse(data) }); } catch { resolve({ success: false }); }
        });
      });
      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
    });
    return result;
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('ncl-get-leaderboard', async () => {
  try {
    const http = require('http');
    const result = await new Promise((resolve) => {
      const req = http.get(`${HIRANYAGARBHA_URL}/ncl/leaderboard`, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try { resolve({ success: true, leaderboard: JSON.parse(data) }); } catch { resolve({ success: false }); }
        });
      });
      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
    });
    return result;
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('ncl-submit-job', async (_event, { job_type, params, priority = 'normal' }) => {
  try {
    const http = require('http');
    const body = JSON.stringify({ job_type, params, priority, timestamp: new Date().toISOString() });
    const result = await new Promise((resolve, reject) => {
      const req = http.request(`${HIRANYAGARBHA_URL}/ncl/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 30000
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve({ success: true, job: JSON.parse(data) }); } catch { resolve({ success: true }); }
          } else {
            resolve({ success: false, error: `HTTP ${res.statusCode}: ${data.slice(0, 200)}` });
          }
        });
      });
      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
      req.write(body);
      req.end();
    });
    return result;
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('ncl-get-price', async () => {
  try {
    const http = require('http');
    const result = await new Promise((resolve) => {
      const req = http.get(`${HIRANYAGARBHA_URL}/ncl/price`, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try { resolve({ success: true, pricing: JSON.parse(data) }); } catch { resolve({ success: false }); }
        });
      });
      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
    });
    return result;
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

// ── Security / AV Troubleshooting IPC ───────────────────────────────────────
ipcMain.handle('get-security-status', () => {
  try {
    const resourceBase = IS_PACKAGED ? process.resourcesPath : path.join(APP_ROOT, 'resources');
    const binaryNames = ['zion-miner', 'zion-universal-miner'];
    if (process.platform === 'win32') {
      binaryNames.push('zion-miner.exe', 'zion-universal-miner.exe');
    }
    const targetPaths = binaryNames
      .map(name => path.join(resourceBase, name))
      .filter(p => fs.existsSync(p));

    const binaries = {};
    for (const targetPath of targetPaths) {
      const name = path.basename(targetPath);
      const exists = fs.existsSync(targetPath);
      let executable = false;
      let quarantined = false;
      if (exists && process.platform !== 'win32') {
        try {
          const stat = fs.statSync(targetPath);
          executable = (stat.mode & 0o111) !== 0;
        } catch {}
      }
      if (process.platform === 'darwin' && exists) {
        try {
          const { execSync } = require('child_process');
          const attr = execSync(`xattr -p com.apple.quarantine "${targetPath}" 2>/dev/null || true`, { encoding: 'utf8', timeout: 3000 }).trim();
          quarantined = attr.length > 0 && attr !== 'true';
        } catch {}
      }
      binaries[name] = { exists, executable, quarantined };
    }

    const recommendations = [];
    const allOk = Object.values(binaries).every(b => b.exists && (process.platform === 'win32' || b.executable) && !b.quarantined);
    if (allOk) {
      recommendations.push({ type: 'ok', title: 'Vše v pořádku', description: 'Všechny binární soubory jsou dostupné a nemají žádná omezení.' });
    } else {
      for (const [name, info] of Object.entries(binaries)) {
        if (!info.exists) {
          recommendations.push({ type: 'warning', title: `${name} chybí`, description: 'Soubor nebyl nalezen. Možná ho smazal antivirus nebo Gatekeeper.' });
        } else if (process.platform !== 'win32' && !info.executable) {
          recommendations.push({ type: 'warning', title: `${name} není spustitelný`, description: 'Chybí exec práva. Klikněte na Opravit automaticky.', command: `chmod +x "${name}"` });
        } else if (info.quarantined) {
          recommendations.push({ type: 'warning', title: `${name} je v karanténě`, description: 'macOS Gatekeeper soubor blokoval. Klikněte na Opravit automaticky.', command: `xattr -dr com.apple.quarantine "${name}"` });
        }
      }
    }

    return { success: true, binaries, recommendations, platform: process.platform };
  } catch (err) {
    return { success: false, error: err?.message || String(err), binaries: {}, recommendations: [], platform: process.platform };
  }
});

ipcMain.handle('fix-security-blocks', () => {
  try {
    const result = fixSecurityBlocks();
    return { success: true, fixed: result.fixed, errors: result.errors };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('open-defender-settings', async () => {
  try {
    if (process.platform === 'win32') {
      const { spawn } = require('child_process');
      spawn('start', ['windowsdefender:'], { shell: true, windowsHide: true, detached: true });
    } else {
      // On macOS/Linux, open Security & Privacy / system settings
      const { spawn } = require('child_process');
      if (process.platform === 'darwin') {
        spawn('open', ['x-apple.systempreferences:com.apple.preference.security'], { detached: true });
      }
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ZION CLI Integration (v3 unified CLI) — wallet, mine, node, balance, send, etc.
// ═══════════════════════════════════════════════════════════════════════════════

ipcMain.handle('cli-get-version', async () => {
  return runZionCli(['--version']);
});

ipcMain.handle('cli-wallet-list', async () => {
  return runZionCli(['wallet', 'list']);
});

ipcMain.handle('cli-wallet-new', async (_event, { name, outPath }) => {
  const args = ['wallet', 'new'];
  if (outPath) { args.push('-o', outPath); }
  if (name) { args.push('--name', name); }
  return runZionCli(args);
});

ipcMain.handle('cli-wallet-balance', async (_event, { address }) => {
  const args = ['wallet', 'balance'];
  if (address) { args.push('--address', address); }
  return runZionCli(args);
});

ipcMain.handle('cli-wallet-send', async (_event, { wallet, to, amount, memo }) => {
  const args = ['wallet', 'send', '-w', wallet, '--to', to, '--amount', amount];
  if (memo) { args.push('--memo', memo); }
  return runZionCli(args);
});

ipcMain.handle('cli-mine-start', async (_event, { pool, worker, wallet, threads, gpuBackend }) => {
  const args = ['mine', 'start'];
  if (pool) { process.env.ZION_POOL_ADDR = pool; }
  if (worker) { process.env.ZION_WORKER_NAME = worker; }
  if (wallet) { process.env.ZION_MINER_ID = wallet; }
  if (threads) { process.env.ZION_THREADS = String(threads); }
  if (gpuBackend) { process.env.ZION_GPU_BACKEND = gpuBackend; }
  return runZionCli(args);
});

ipcMain.handle('cli-mine-stop', async () => {
  return runZionCli(['mine', 'stop']);
});

ipcMain.handle('cli-mine-status', async () => {
  return runZionCli(['mine', 'status']);
});

ipcMain.handle('cli-node-start', async (_event, { nodeId, p2pPort, rpcPort, seedPeers }) => {
  const args = ['node', 'start'];
  if (nodeId) { process.env.ZION_NODE_ID = nodeId; }
  if (p2pPort) { process.env.ZION_P2P_BIND = `0.0.0.0:${p2pPort}`; }
  if (rpcPort) { process.env.ZION_RPC_BIND = `0.0.0.0:${rpcPort}`; }
  if (seedPeers) { process.env.ZION_SEED_PEERS = seedPeers; }
  return runZionCli(args);
});

ipcMain.handle('cli-node-stop', async () => {
  return runZionCli(['node', 'stop']);
});

ipcMain.handle('cli-config-get', async (_event, { key }) => {
  const args = ['config', 'get'];
  if (key) { args.push(key); }
  return runZionCli(args);
});

ipcMain.handle('cli-config-set', async (_event, { key, value }) => {
  return runZionCli(['config', 'set', key, value]);
});

// ── Bridge CLI ─────────────────────────────────────────────────────
ipcMain.handle('cli-bridge-status', async () => {
  return runZionCli(['bridge', 'status']);
});
ipcMain.handle('cli-bridge-pending', async () => {
  return runZionCli(['bridge', 'pending']);
});
ipcMain.handle('cli-bridge-history', async (_event, { n }) => {
  const args = ['bridge', 'history'];
  if (n) args.push(String(n));
  return runZionCli(args);
});
ipcMain.handle('cli-bridge-chains', async () => {
  return runZionCli(['bridge', 'chains']);
});

// ── DAO CLI ────────────────────────────────────────────────────────
ipcMain.handle('cli-dao-status', async () => {
  return runZionCli(['dao', 'status']);
});
ipcMain.handle('cli-dao-proposals', async () => {
  return runZionCli(['dao', 'proposals']);
});
ipcMain.handle('cli-dao-treasury', async () => {
  return runZionCli(['dao', 'treasury']);
});
ipcMain.handle('cli-dao-params', async () => {
  return runZionCli(['dao', 'params']);
});

// ── Pool CLI ───────────────────────────────────────────────────────
ipcMain.handle('cli-pool-stats', async (_event, { target }) => {
  const args = ['pool', 'stats'];
  if (target) args.push(target);
  return runZionCli(args);
});
ipcMain.handle('cli-pool-miners', async (_event, { target }) => {
  const args = ['pool', 'miners'];
  if (target) args.push(target);
  return runZionCli(args);
});
ipcMain.handle('cli-pool-config', async (_event, { target }) => {
  const args = ['pool', 'config'];
  if (target) args.push(target);
  return runZionCli(args);
});
ipcMain.handle('cli-pool-earnings', async (_event, { address, target }) => {
  const args = ['pool', 'earnings'];
  if (address) args.push('--address', address);
  if (target) args.push(target);
  return runZionCli(args);
});

// ── Warp CLI ───────────────────────────────────────────────────────
ipcMain.handle('cli-warp-status', async () => {
  return runZionCli(['warp', 'status']);
});
ipcMain.handle('cli-warp-chains', async () => {
  return runZionCli(['warp', 'chains']);
});
ipcMain.handle('cli-warp-pending', async () => {
  return runZionCli(['warp', 'pending']);
});
ipcMain.handle('cli-warp-stats', async () => {
  return runZionCli(['warp', 'stats']);
});

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
app.whenReady().then(async () => {
  console.log('ZION Native Awakening v3.0.5 started');

  // Initialize auto-tuner

  // E2E Test Mode: Signal ready state
  if (E2E_TEST) {
    console.log('ZION Desktop Agent ready for E2E testing');
    setTimeout(() => {
      console.log('E2E_TEST_MINING_INITIALIZED');
    }, 2000); // Simulate mining init delay
  }

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
  // Requires license key — if not set, show "enter license" status
  setTimeout(() => {
    try {
      const startupCfg = loadConfig();
      if (startupCfg?.autoCheckUpdates !== false) {
        if (!startupCfg?.licenseKey) {
          dbg('[startup] No license key set — skipping auto-update check');
          _sendUpdateStatus('no-license', { message: 'Enter your license key to check for updates' });
          return;
        }
        dbg('[startup] Auto-checking for updates (license-gated)...');
        const updater = _initAutoUpdater();
        if (updater) {
          updater.checkForUpdates().catch(err => {
            dbg('[startup] Update check failed:', err?.message);
          });
        } else {
          // Dev mode fallback: check update server API directly
          _checkUpdateServer(startupCfg.licenseKey).then(result => {
            if (result?.updateAvailable) {
              _sendUpdateStatus('available', {
                version: result.latestVersion,
                releaseNotes: result.releaseNotes,
                releaseDate: result.releaseDate,
              });
            } else if (result?.licenseValid === false) {
              _sendUpdateStatus('error', { error: 'Invalid or revoked license' });
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
        minerRunning: !!minerProcess
      };
      logApp('heartbeat', JSON.stringify(state));
    }
  } catch {
    // ignore
  }

  if (minerProcess) {
    const updated = tryUpdateStatsFromFile();
    if (!updated) minerStats.uptime += STATS_INTERVAL_SEC;

    // V3 miner HTTP metrics: poll /stats and /health on the local metrics bind.
    void (async () => {
      try {
        const metricsBase = 'http://127.0.0.1:9116';
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2000);
        try {
          const res = await fetch(`${metricsBase}/stats`, { signal: ctrl.signal });
          if (res.ok) {
            const stats = await res.json();
            // V3 miner HTTP /stats uses *_hps suffixed field names — map to agent keys.
            const hrTotal = typeof stats.hashrate_hps === 'number' ? stats.hashrate_hps
                          : typeof stats.hashrate === 'number' ? stats.hashrate : null;
            const hr10 = typeof stats.hashrate_10s_hps === 'number' ? stats.hashrate_10s_hps
                       : typeof stats.hashrate_10s === 'number' ? stats.hashrate_10s : null;
            const hr60 = typeof stats.hashrate_60s_hps === 'number' ? stats.hashrate_60s_hps
                       : typeof stats.hashrate_60s === 'number' ? stats.hashrate_60s : null;
            const hr15 = typeof stats.hashrate_15m_hps === 'number' ? stats.hashrate_15m_hps
                       : typeof stats.hashrate_15m === 'number' ? stats.hashrate_15m : null;
            const hrMax = typeof stats.hashrate_max === 'number' ? stats.hashrate_max : null;
            const gpuHr = typeof stats.gpu_hashrate_hps === 'number' ? stats.gpu_hashrate_hps
                        : typeof stats.hashrate_gpu === 'number' ? stats.hashrate_gpu : null;
            // Prefer 10s window for primary display, fallback chain
            if (hr10 != null || hr60 != null || hr15 != null || hrTotal != null) {
              minerStats.hashrate = hr10 || hr60 || hr15 || hrTotal;
            }
            if (hr10 != null) minerStats.hashrate_10s = hr10;
            if (hr60 != null) minerStats.hashrate_60s = hr60;
            if (hr15 != null) minerStats.hashrate_15m = hr15;
            if (hrMax != null) minerStats.hashrate_max = hrMax;
            if (gpuHr != null && gpuHr > 0) minerStats.hashrate_gpu = gpuHr;
            const acc = typeof stats.accepted_shares === 'number' ? stats.accepted_shares
                      : typeof stats.accepted === 'number' ? stats.accepted : null;
            const rej = typeof stats.rejected_shares === 'number' ? stats.rejected_shares
                      : typeof stats.rejected === 'number' ? stats.rejected : null;
            if (acc != null) minerStats.accepted = acc;
            if (rej != null) minerStats.rejected = rej;
            if (acc != null || rej != null) minerStats.shares = (acc || 0) + (rej || 0);
            const up = typeof stats.uptime_s === 'number' ? stats.uptime_s
                     : typeof stats.uptime_sec === 'number' ? stats.uptime_sec : null;
            if (up != null) minerStats.uptime = Math.floor(up);
            if (typeof stats.current_epoch === 'number') minerStats.current_epoch = stats.current_epoch;
            if (typeof stats.pool_height === 'number') minerStats.last_job_height = String(stats.pool_height);
            if (typeof stats.backend === 'string') minerStats.runtime_backend = stats.backend;
            minerStats._http_metrics_ok = true;
          }
        } finally { clearTimeout(timer); }

        // Health check — detect hung miner
        const hCtrl = new AbortController();
        const hTimer = setTimeout(() => hCtrl.abort(), 2000);
        try {
          const hRes = await fetch(`${metricsBase}/health`, { signal: hCtrl.signal });
          minerStats._miner_health = hRes.ok ? 'ok' : 'degraded';
        } catch {
          minerStats._miner_health = 'unreachable';
        } finally { clearTimeout(hTimer); }
      } catch {
        minerStats._http_metrics_ok = false;
        minerStats._miner_health = 'unreachable';
      }
    })();

    // Track rolling hashrate samples for xmrig-like averages.
    try {
      const now = Date.now();
      const cpuHr = typeof minerStats.hashrate === 'number' && Number.isFinite(minerStats.hashrate) ? minerStats.hashrate : 0;
      const gpuHr = typeof minerStats.hashrate_gpu === 'number' && Number.isFinite(minerStats.hashrate_gpu) ? minerStats.hashrate_gpu : 0;
      const hs = cpuHr > 0 ? cpuHr : gpuHr; // fall back to GPU rate between jobs
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

    scheduleStatsEmit();
}, STATS_TICK_MS);
