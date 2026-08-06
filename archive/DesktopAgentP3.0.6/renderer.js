// ZION Native Awakening v2.9.6 - Renderer Process
// UI logic and state management

// ── Logging: only user-visible events + errors in console.log.
// Verbose init/polling chatter uses dbg() → console.debug (hidden unless DevTools filter set).
const DBG = typeof localStorage !== 'undefined' && localStorage.getItem('ZION_DEBUG') === '1';
function dbg(...args) { if (DBG) console.debug('[DBG]', ...args); }

// ── AUDIT-FIX E-02/E-03 (16 Feb 2026): HTML sanitizer ─────────────────────
// Escapes HTML special characters to prevent XSS via innerHTML injection.
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
// ────────────────────────────────────────────────────────────────────────────

let currentView = 'dashboard';
let config = {};
let isRunning = false;

const PRIMARY_TESTNET_HOST = '91.98.122.165';
const PRIMARY_POOL_PORT = 3333;
const PRIMARY_RPC_PORT = 8444;
const DEFAULT_RPC_URL = `http://${PRIMARY_TESTNET_HOST}:${PRIMARY_RPC_PORT}/jsonrpc`;
const DESKTOP_PURE_ZION_DEFAULT = true;

function currentPureZionDefault(cfg = config) {
  if (cfg && typeof cfg.desktopPureZionDefault === 'boolean') {
    return cfg.desktopPureZionDefault;
  }
  return DESKTOP_PURE_ZION_DEFAULT;
}

// CH3 Multi-stream status cache (updated via 'multi-stream-status' IPC event)
let _lastMultiStreamStatus = null;

const DEFAULT_REVENUE_PROFILE = {
  enabled: !DESKTOP_PURE_ZION_DEFAULT,
  allocation: {
    zionPct: DESKTOP_PURE_ZION_DEFAULT ? 100 : 50,
    multiAlgoPct: DESKTOP_PURE_ZION_DEFAULT ? 0 : 25,
    nclPct: DESKTOP_PURE_ZION_DEFAULT ? 0 : 25,
  },
  cpu: { coin: 'auto' },
  merged: { etcEnabled: false, nxsEnabled: false },
  gpu: { enabled: false, coins: ['KAS', 'ETC', 'ALPH', 'ERG', 'RVN', 'CFX', 'ZANO', 'EVR', 'MEWC', 'FLUX', 'CLORE'] },
  ncl: { enabled: false },
  nclEnabled: false,
  freeStreams: { mysterium: true, nkn: true, aiGateway: true },
};

function normalizeRevenueProfile(input = {}) {
  const allocation = input && typeof input.allocation === 'object' ? input.allocation : {};
  const pct = (v, fallback) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, Math.round(n)));
  };

  const coins = Array.isArray(input?.gpu?.coins)
    ? input.gpu.coins.map(v => String(v || '').trim().toUpperCase()).filter(Boolean)
    : [...DEFAULT_REVENUE_PROFILE.gpu.coins];

  const cpuCoin = String(input?.cpu?.coin || DEFAULT_REVENUE_PROFILE.cpu.coin).toLowerCase();

  return {
    enabled: input?.enabled !== undefined ? !!input.enabled : DEFAULT_REVENUE_PROFILE.enabled,
    allocation: {
      zionPct: pct(allocation.zionPct, DEFAULT_REVENUE_PROFILE.allocation.zionPct),
      multiAlgoPct: pct(allocation.multiAlgoPct, DEFAULT_REVENUE_PROFILE.allocation.multiAlgoPct),
      nclPct: pct(allocation.nclPct, DEFAULT_REVENUE_PROFILE.allocation.nclPct),
    },
    cpu: {
      coin: ['auto', 'xmr', 'btc'].includes(cpuCoin) ? cpuCoin : DEFAULT_REVENUE_PROFILE.cpu.coin,
    },
    gpu: {
      enabled: input?.gpu?.enabled !== undefined ? !!input.gpu.enabled : DEFAULT_REVENUE_PROFILE.gpu.enabled,
      coins: coins.length ? coins : [...DEFAULT_REVENUE_PROFILE.gpu.coins],
      poolPreference: String(input?.gpu?.poolPreference || input?.poolPreference || 'herominers').toLowerCase(),
      poolRegion: String(input?.gpu?.poolRegion || input?.poolRegion || 'eu').toLowerCase(),
      nicehashBtcAddr: String(input?.gpu?.nicehashBtcAddr || input?.nicehashBtcAddr || '').trim() || null,
    },
    ncl: {
      enabled: input?.ncl?.enabled !== undefined ? !!input.ncl.enabled : DEFAULT_REVENUE_PROFILE.ncl.enabled,
    },
    nclEnabled: input?.nclEnabled !== undefined ? !!input.nclEnabled : (input?.ncl?.enabled !== undefined ? !!input.ncl.enabled : DEFAULT_REVENUE_PROFILE.nclEnabled),
    merged: {
      etcEnabled: input?.merged?.etcEnabled !== undefined ? !!input.merged.etcEnabled : DEFAULT_REVENUE_PROFILE.merged.etcEnabled,
      nxsEnabled: input?.merged?.nxsEnabled !== undefined ? !!input.merged.nxsEnabled : DEFAULT_REVENUE_PROFILE.merged.nxsEnabled,
    },
    freeStreams: {
      mysterium: input?.freeStreams?.mysterium !== undefined ? !!input.freeStreams.mysterium : DEFAULT_REVENUE_PROFILE.freeStreams.mysterium,
      nkn: input?.freeStreams?.nkn !== undefined ? !!input.freeStreams.nkn : DEFAULT_REVENUE_PROFILE.freeStreams.nkn,
      aiGateway: input?.freeStreams?.aiGateway !== undefined ? !!input.freeStreams.aiGateway : DEFAULT_REVENUE_PROFILE.freeStreams.aiGateway,
    },
  };
}

function toPureZionRevenueProfile(input = {}) {
  const base = normalizeRevenueProfile(input);
  return {
    ...base,
    enabled: false,
    allocation: {
      zionPct: 100,
      multiAlgoPct: 0,
      nclPct: 0,
    },
    cpu: { coin: 'auto' },
    gpu: {
      ...base.gpu,
      enabled: false,
    },
    ncl: { enabled: false },
    nclEnabled: false,
    merged: { etcEnabled: false, nxsEnabled: false },
  };
}

function isPureZionDesktopMode(cfg = config) {
  if (currentPureZionDefault(cfg)) {
    return true;
  }
  const revenue = normalizeRevenueProfile(cfg?.revenue || {});
  return revenue.enabled === false
    && Number(revenue?.allocation?.zionPct ?? 0) === 100
    && Number(revenue?.allocation?.multiAlgoPct ?? 0) === 0
    && Number(revenue?.allocation?.nclPct ?? 0) === 0
    && !revenue?.gpu?.enabled
    && !revenue?.ncl?.enabled
    && !revenue?.merged?.etcEnabled
    && !revenue?.merged?.nxsEnabled;
}

function normalizeMiningMode(mode, pureZionMode = isPureZionDesktopMode(config)) {
  const raw = String(mode || '').trim().toLowerCase() || 'dual';
  if (pureZionMode && raw === 'gpu-revenue') return 'dual';
  return raw;
}

function applyPureZionUiState(cfg = config) {
  const pureZionMode = isPureZionDesktopMode(cfg);
  const revenueSection = document.getElementById('revenue-routing-section');
  const pureNote = document.getElementById('pure-zion-note');
  const gpuRevenuePill = document.getElementById('mode-gpu-revenue-pill');
  if (revenueSection) revenueSection.style.display = pureZionMode ? 'none' : '';
  if (pureNote) pureNote.style.display = pureZionMode ? 'block' : 'none';
  if (gpuRevenuePill) gpuRevenuePill.style.display = pureZionMode ? 'none' : '';
}

let cpuThreadMax = 32;

// Hashrate units
const HASHRATE_UNIT_CYCLE = ['auto', 'H/s', 'kH/s', 'MH/s', 'GH/s'];
let hashrateUnitMode = 'auto';
let lastMilestoneBucket = 0;
let lastAcceptedForMilestone = 0;
let milestoneInitialized = false;

let resolvedMinerBackend = null; // 'rust' | 'python' | 'legacy'
let resolvedMinerBackendPreferred = null; // 'auto' | 'rust' | 'python'
let resolvedMinerBackendLastError = '';

// ═══════════════════════════════════════════════════════════════
// FIRST-RUN WIZARD
// ═══════════════════════════════════════════════════════════════

async function checkFirstRun() {
  try {
    if (typeof window.electronAPI?.isFirstRun !== 'function') return;
    const result = await window.electronAPI.isFirstRun();
    if (!result?.firstRun) return;

    await openOneClickWizard();
  } catch (err) {
    console.error('First-run check failed:', err);
  }
}

async function openOneClickWizard() {
  const overlay = document.getElementById('wizard-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  await runWizard(overlay);
}

function runWizard(overlay) {
  return new Promise((resolve) => {
    const steps = overlay.querySelectorAll('.wizard-step');
    const startBtn = document.getElementById('wizard-start-btn');
    const skipBtn = document.getElementById('wizard-skip-btn');
    const backBtn = document.getElementById('wizard-back-1');
    const createBtn = document.getElementById('wizard-create-btn');
    const createMineBtn = document.getElementById('wizard-create-mine-btn');
    const mineBtn = document.getElementById('wizard-mine-btn');
    const doneBtn = document.getElementById('wizard-done-btn');
    const statusEl = document.getElementById('wizard-status');
    const errorEl = document.getElementById('wizard-error');

    const showStep = (n) => {
      steps.forEach(s => s.style.display = 'none');
      const target = overlay.querySelector(`.wizard-step[data-step="${n}"]`);
      if (target) target.style.display = 'block';
    };

    const setWizardStatus = (text, isError = false) => {
      if (!statusEl) return;
      statusEl.style.display = text ? 'block' : 'none';
      statusEl.textContent = text || '';
      statusEl.style.color = isError ? '#fca5a5' : '#cbd5e1';
    };

    const setSetupButtonsBusy = (busy, primaryLabel, secondaryLabel) => {
      if (createBtn) {
        createBtn.disabled = busy;
        createBtn.innerHTML = primaryLabel;
      }
      if (createMineBtn) {
        createMineBtn.disabled = busy;
        createMineBtn.innerHTML = secondaryLabel;
      }
    };

    const startConfiguredMining = async () => {
      config = await window.electronAPI.getConfig();
      if (!config?.wallet) {
        return { success: false, error: 'Wallet nebyla po quick setupu uložena.' };
      }

      const result = await window.electronAPI.startMining(config);
      if (result?.success) {
        isRunning = true;
        try { updateControlButtons(); } catch {}
      }
      return result;
    };

    const performQuickSetup = async ({ autoStart }) => {
      const pw = document.getElementById('wizard-password')?.value || '';
      const pwConfirm = document.getElementById('wizard-password-confirm')?.value || '';
      const workerName = document.getElementById('wizard-worker')?.value?.trim() || 'desktop-agent';

      if (pw.length < 6) {
        if (errorEl) { errorEl.textContent = 'Heslo musí mít alespoň 6 znaků.'; errorEl.style.display = 'block'; }
        return;
      }
      if (pw !== pwConfirm) {
        if (errorEl) { errorEl.textContent = 'Hesla se neshodují.'; errorEl.style.display = 'block'; }
        return;
      }
      if (errorEl) errorEl.style.display = 'none';
      setWizardStatus('');

      setSetupButtonsBusy(
        true,
        '<svg class="icon icon-inline" aria-hidden="true"><use href="#i-key"></use></svg> Vytvářím... ',
        '<svg class="icon icon-inline" aria-hidden="true"><use href="#i-spark"></use></svg> Připravuji one-click start... '
      );

      try {
        const result = await window.electronAPI.quickSetup({ password: pw, workerName });
        if (!result?.success) {
          if (errorEl) { errorEl.textContent = result?.error || 'Chyba při vytváření peněženky.'; errorEl.style.display = 'block'; }
          setSetupButtonsBusy(
            false,
            '<svg class="icon icon-inline" aria-hidden="true"><use href="#i-key"></use></svg> Vytvořit peněženku a nastavit',
            '<svg class="icon icon-inline" aria-hidden="true"><use href="#i-spark"></use></svg> One-Click: vytvořit a začít těžit'
          );
          return;
        }

        document.getElementById('wizard-address').textContent = result.wallet.address;
        const mnemonicEl = document.getElementById('wizard-mnemonic');
        if (mnemonicEl) {
          mnemonicEl.textContent = result.wallet.mnemonic;
          // Default: blur mnemonic for shoulder-surfing protection
          mnemonicEl.style.filter = 'blur(5px)';
          mnemonicEl.style.cursor = 'pointer';
          mnemonicEl.style.userSelect = 'none';
          mnemonicEl.title = 'Click to reveal / hide';
          mnemonicEl.onclick = () => {
            const isBlurred = mnemonicEl.style.filter.includes('blur');
            mnemonicEl.style.filter = isBlurred ? 'none' : 'blur(5px)';
            mnemonicEl.style.userSelect = isBlurred ? 'text' : 'none';
          };
        }
        config = result.config || config;
        showStep(3);

        if (autoStart) {
          setWizardStatus('Spouštím mining profilem z quick setupu...');
          const miningResult = await startConfiguredMining();
          if (miningResult?.success) {
            setWizardStatus('Mining běží. Recovery phrase si ještě teď bezpečně uložte.');
            if (mineBtn) {
              mineBtn.innerHTML = '<svg class="icon icon-inline" aria-hidden="true"><use href="#i-check"></use></svg> Mining běží';
            }
          } else {
            setWizardStatus(`Wallet byla vytvořena, ale start miningu selhal: ${miningResult?.error || 'Neznámá chyba.'}`, true);
          }
        } else {
          setWizardStatus('Wallet je připravená. Teď můžete jedním klikem spustit mining.');
        }
      } catch (err) {
        if (errorEl) { errorEl.textContent = err?.message || 'Neočekávaná chyba.'; errorEl.style.display = 'block'; }
      } finally {
        setSetupButtonsBusy(
          false,
          '<svg class="icon icon-inline" aria-hidden="true"><use href="#i-key"></use></svg> Vytvořit peněženku a nastavit',
          '<svg class="icon icon-inline" aria-hidden="true"><use href="#i-spark"></use></svg> One-Click: vytvořit a začít těžit'
        );
      }
    };

    const closeWizard = () => {
      setWizardStatus('');
      overlay.style.display = 'none';
      resolve();
    };

    // Step 1: Welcome
    if (startBtn) startBtn.onclick = () => showStep(2);
    if (skipBtn) skipBtn.onclick = closeWizard;
    if (backBtn) backBtn.onclick = () => showStep(1);

    // Step 2: Create wallet
    if (createBtn) createBtn.onclick = () => performQuickSetup({ autoStart: false });
    if (createMineBtn) createMineBtn.onclick = () => performQuickSetup({ autoStart: true });

    // Step 3: Success
    if (mineBtn) {
      mineBtn.onclick = async () => {
        if (isRunning) {
          closeWizard();
          return;
        }
        try {
          setWizardStatus('Spouštím mining...');
          const result = await startConfiguredMining();
          if (result?.success) {
            setWizardStatus('Mining běží. Recovery phrase si ještě teď bezpečně uložte.');
            mineBtn.innerHTML = '<svg class="icon icon-inline" aria-hidden="true"><use href="#i-check"></use></svg> Mining běží';
          } else {
            setWizardStatus(result?.error || 'Start miningu selhal.', true);
          }
        } catch (err) {
          setWizardStatus(err?.message || 'Auto-start mining failed.', true);
        }
      };
    }

    if (doneBtn) doneBtn.onclick = closeWizard;
  });
}

function renderBackendUi() {
  try {
    const backendStatusEl = document.getElementById('backend-status');
    const backendPill = document.getElementById('backend-pill');

    const preferred = String(config?.minerBackend || 'auto').toLowerCase();
    const resolved = resolvedMinerBackend ? String(resolvedMinerBackend).toLowerCase() : '';
    const resolvedLabel =
      resolved === 'rust' ? 'Rust' :
      resolved === 'python' ? 'Python' :
      resolved === 'legacy' ? 'Legacy' :
      resolved === 'deeksha-auto' ? 'Deeksha Auto' :
      resolved === 'deeksha-native' ? 'Deeksha Native Exact' :
      resolved === 'deeksha-opencl' ? 'Deeksha GPU (OpenCL)' :
      resolved === 'deeksha-cuda' ? 'Deeksha CUDA' :
      resolved === 'deeksha-metal' ? 'Deeksha Metal' :
      resolved === 'deeksha-gpu' ? 'Deeksha GPU' :
      resolved === 'deeksha-fallback' ? 'Deeksha CPU' :
      '';

    if (backendStatusEl) {
      const labels = {
        auto: 'Canonical cosmic_harmony uses the Deeksha 2.9.8 path automatically and resolves the exact runtime backend at launch.',
        rust: 'Canonical cosmic_harmony still uses the Deeksha path; Rust is bypassed for main CH mining.',
        python: 'Canonical cosmic_harmony uses the Deeksha Python path.'
      };
      const base = labels[preferred] || '';
      const withResolved = resolvedLabel ? `${base} Resolved: ${resolvedLabel}.` : base;
      const err = String(resolvedMinerBackendLastError || '').trim();
      backendStatusEl.textContent = err ? `${withResolved} Last error: ${err}` : withResolved;
    }

    if (backendPill) {
      const eff = resolved || preferred;
      const label =
        eff === 'rust' ? 'Rust' :
        eff === 'python' ? 'Python' :
        eff === 'legacy' ? 'Legacy' :
        eff === 'deeksha-auto' ? 'Deeksha Auto' :
        eff === 'deeksha-native' ? 'Deeksha Native Exact' :
        eff === 'deeksha-opencl' ? 'Deeksha GPU (OpenCL)' :
        eff === 'deeksha-cuda' ? 'Deeksha CUDA' :
        eff === 'deeksha-metal' ? 'Deeksha Metal' :
        eff === 'deeksha-gpu' ? 'Deeksha GPU' :
        eff === 'deeksha-fallback' ? 'Deeksha CPU' :
        'Auto';
      const suffix = preferred === 'auto' && eff !== 'auto' ? ' (Auto)' : '';
      backendPill.textContent = `Backend: ${label}${suffix}`;
    }
  } catch {
    // ignore
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  dbg('Renderer DOMContentLoaded fired');

  try {
    dbg('Init starfield...');
    initWarpStarfield();

    // ═══ First-run wizard check ═══
    await checkFirstRun();
    
    config = await window.electronAPI.getConfig();
    dbg('Config loaded');
    
    await loadSystemLimits();
    updateSettingsUI();
    setupThreadsControl();
    setupNavigation();
    setupControls();
    setupWalletControls();

    dbg('AI/chat removed for mainnet');
    
    setupEventListeners();
    setupMiningConsole();
    
    await initCH3Features();

    pollStats();

    console.log('Renderer ready');
  } catch (err) {
    console.error('Renderer initialization failed:', err);
    console.error('Error stack:', err?.stack);
    alert(`Failed to initialize UI:\n\n${err?.message || String(err)}\n\nCheck DevTools console for details.`);
    throw err;
  }
});

async function loadSystemLimits() {
  try {
    if (typeof window.electronAPI?.getSystemInfo !== 'function') {
      dbg('getSystemInfo not available');
      return;
    }
    const info = await window.electronAPI.getSystemInfo();
    dbg('System info:', info);
    const cpuCount = Number(info?.cpuCount);
    if (Number.isFinite(cpuCount) && cpuCount > 0) {
      cpuThreadMax = Math.max(1, Math.floor(cpuCount));
      dbg('CPU thread max:', cpuThreadMax);
    }
  } catch (err) {
    console.error('Failed to load system limits:', err);
  }
}

function setupThreadsControl() {
  const threadsInput = document.getElementById('threads-input');
  const threadsValueEl = document.getElementById('threads-value');
  const threadsMaxEl = document.getElementById('threads-max');

  if (!(threadsInput instanceof HTMLInputElement)) return;

  threadsInput.min = '1';
  threadsInput.max = String(cpuThreadMax);

  const clampThreads = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.min(cpuThreadMax, Math.max(1, Math.floor(n)));
  };

  const initial = clampThreads(config.threads ?? 4);
  config.threads = initial;
  threadsInput.value = String(initial);

  if (threadsValueEl) threadsValueEl.textContent = String(initial);
  if (threadsMaxEl) threadsMaxEl.textContent = String(cpuThreadMax);

  threadsInput.addEventListener('input', () => {
    const next = clampThreads(threadsInput.value);
    config.threads = next;
    if (threadsValueEl) threadsValueEl.textContent = String(next);
  });
}

function initWarpStarfield() {
  const canvas = document.getElementById('warp-starfield');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  const starColor = [200, 118, 255]; // galactic-core
  // Performance-aware parameters — cap DPR to reduce fill rate
  let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let w = 0;
  let h = 0;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const baseDensity = prefersReducedMotion ? 50 : 100;
  let density = baseDensity;
  let speed = prefersReducedMotion ? 2.4 : 3.2;
  let trailOpacity = prefersReducedMotion ? 0.06 : 0.045;

  // Cache gradient — rebuild only on resize
  let cachedGradient = null;
  const rebuildGradient = () => {
    const g = ctx.createRadialGradient(w * 0.4, h * 0.6, 0, w * 0.4, h * 0.6, Math.max(w, h));
    g.addColorStop(0, 'rgba(22, 8, 32, 0.90)');
    g.addColorStop(1, 'rgba(4, 2, 12, 0.98)');
    cachedGradient = g;
  };

  const stars = [];
  let frameId = 0;
  let running = true;

  // FPS limiter — target ~24 FPS (≈41.6ms interval)
  const FRAME_INTERVAL = 1000 / 24;
  let lastFrameTime = 0;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = Math.floor(window.innerWidth);
    h = Math.floor(window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const areaScale = Math.sqrt((w * h) / (1280 * 800));
    density = Math.max(40, Math.min(140, Math.round(baseDensity * areaScale / Math.sqrt(dpr))));
    rebuildGradient();
  };

  const seed = () => {
    stars.length = 0;
    for (let i = 0; i < density; i++) {
      stars.push({
        x: Math.random() * w - w / 2,
        y: Math.random() * h - h / 2,
        z: Math.random() * w,
        size: Math.random() * 2 + 0.5,
        px: 0,
        py: 0,
      });
    }
  };

  const animate = (timestamp) => {
    if (!running) return;
    frameId = window.requestAnimationFrame(animate);

    // Throttle to target FPS
    const delta = timestamp - lastFrameTime;
    if (delta < FRAME_INTERVAL) return;
    lastFrameTime = timestamp - (delta % FRAME_INTERVAL);

    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(Math.max(trailOpacity, 0.02), 0.3)})`;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = cachedGradient;
    ctx.globalAlpha = 0.22;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    // Pre-compute half dimensions
    const hw = w / 2;
    const hh = h / 2;

    for (const star of stars) {
      const prevX = (star.x / star.z) * w + hw;
      const prevY = (star.y / star.z) * h + hh;

      star.z -= speed;
      if (star.z <= 0) {
        star.z = w;
        star.x = Math.random() * w - hw;
        star.y = Math.random() * h - hh;
        star.px = prevX;
        star.py = prevY;
        continue;
      }

      const x = (star.x / star.z) * w + hw;
      const y = (star.y / star.z) * h + hh;
      const size = (1 - star.z / w) * star.size * 2;
      const brightness = 1 - star.z / w;
      const alpha = Math.min(1, 0.08 + brightness * 0.92);

      ctx.strokeStyle = `rgba(${starColor[0]}, ${starColor[1]}, ${starColor[2]}, ${alpha})`;
      ctx.lineWidth = Math.max(0.5, (size * 0.5) / Math.sqrt(dpr));
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      ctx.stroke();

      ctx.fillStyle = `rgba(${starColor[0]}, ${starColor[1]}, ${starColor[2]}, ${Math.min(1, alpha + 0.15)})`;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(size * 0.65, 0.55), 0, Math.PI * 2);
      ctx.fill();

      star.px = x;
      star.py = y;
    }
  };

  resize();
  seed();
  frameId = window.requestAnimationFrame(animate);

  // Pause starfield when window/tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
      if (frameId) { window.cancelAnimationFrame(frameId); frameId = 0; }
    } else {
      running = true;
      lastFrameTime = 0;
      frameId = window.requestAnimationFrame(animate);
    }
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); seed(); }, 150);
  });

  window.addEventListener('beforeunload', () => {
    if (frameId) window.cancelAnimationFrame(frameId);
  });

  // Pause animation when tab/app is not visible to save CPU/GPU
  document.addEventListener('visibilitychange', () => {
    const nowHidden = document.hidden;
    running = !nowHidden;
    if (running) {
      // Re-seed lightly on resume for a smoother feel
      seed();
      if (!frameId) animate();
    }
  });
}

// Navigation — single delegated listener on dock bar
function setupNavigation() {
  const dock = document.getElementById('dock-bar') || document.querySelector('.dock-bar');
  if (dock) {
    dock.addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item');
      if (!item || !item.dataset.view) return;
      const view = item.dataset.view;
      switchView(view);
      // Update active state — single loop
      dock.querySelectorAll('.nav-item.active').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  }

  // ── Section Tabs (subsection navigation within views) ──
  setupSectionTabs();
}

/**
 * Set up all .section-tabs pill bars — uses event delegation
 * on each tab bar for efficient listener management.
 */
function setupSectionTabs() {
  document.querySelectorAll('.section-tabs').forEach(tabBar => {
    // Skip already-delegated tab bars
    if (tabBar._delegated) return;
    tabBar._delegated = true;
    tabBar.addEventListener('click', (e) => {
      const tab = e.target.closest('.section-tab');
      if (!tab) return;
      const sectionId = tab.dataset.section;
      if (!sectionId) return;

      // Deactivate sibling tabs
      tabBar.querySelectorAll('.section-tab.active').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Find the parent view-shell and toggle section-panels within it
      const viewShell = tabBar.closest('.view-shell');
      if (!viewShell) return;
      viewShell.querySelectorAll('.section-panel.active').forEach(p => p.classList.remove('active'));
      const target = document.getElementById(sectionId);
      if (target) target.classList.add('active');
    });
  });
}

// Cache view elements to avoid repeated DOM queries
let _viewCache = null;
function _getViewEls() {
  if (!_viewCache) {
    _viewCache = {};
    document.querySelectorAll('[id$="-view"]').forEach(v => {
      _viewCache[v.id] = v;
    });
  }
  return _viewCache;
}

// Lazy-init dispatch table — avoids long if-else chain
const _viewInitFns = {
  bridge:    () => initBridgeView(),
  oasis:     () => initOasisView(),
  dao:       () => initDaoView(),
  warp:      () => initWarpView(),
  node:      () => initNodeView(),
  freeworld: () => initFreeWorldView(),
  issobella: () => initIssobellaView(),
  about:     () => { initUpdateUI(); initSecurityUI(); },
};

function switchView(view) {
  if (view === currentView) return; // skip redundant switches

  const views = _getViewEls();

  // Hide previous view only (not all)
  if (currentView) {
    const prev = views[currentView + '-view'];
    if (prev) prev.style.display = 'none';
  }

  // Show selected view — remove hiding classes that block rendering
  const next = views[view + '-view'];
  if (next) {
    next.classList.remove('d-none', 'view-hidden');
    next.style.display = 'block';
  }
  currentView = view;

  // When switching to Logs, flush deferred mining console lines
  if (view === 'logs' && typeof _mcDeferredQueue !== 'undefined') {
    // Render cached static panel immediately
    if (typeof _lastPanelLines !== 'undefined' && _lastPanelLines) {
      updateStaticPanel(_lastPanelLines);
    }
    const lines = _mcDeferredQueue.splice(0);
    for (const line of lines) {
      appendMiningConsole(line);
    }
  }

  // Lazy-initialize view if it has an init function
  const initFn = _viewInitFns[view];
  if (initFn) initFn();

  // Refresh network data only when user opens Network view
  if (view === 'network') {
    void refreshServerStatus();
  }

  // Auto-fetch balance when wallet view is opened (if address is configured)
  if (view === 'wallet') {
    setTimeout(() => {
      const refreshBtn = document.getElementById('refresh-balance-btn');
      if (refreshBtn && (config?.wallet || '').trim()) refreshBtn.click();
    }, 300);
    // Start periodic balance auto-refresh while wallet tab is open (every 30s)
    _startBalanceAutoRefresh();
  } else {
    // Stop auto-refresh when leaving wallet tab
    _stopBalanceAutoRefresh();
  }
}

// Periodic balance auto-refresh (runs while wallet tab is open)
let _balanceAutoRefreshTimer = null;
function _startBalanceAutoRefresh() {
  _stopBalanceAutoRefresh();
  _balanceAutoRefreshTimer = setInterval(() => {
    if (currentView !== 'wallet') { _stopBalanceAutoRefresh(); return; }
    if (document.hidden) return;
    const refreshBtn = document.getElementById('refresh-balance-btn');
    const addr = (config?.wallet || '').trim();
    if (refreshBtn && addr) refreshBtn.click();
  }, 45000); // 45s interval
}
function _stopBalanceAutoRefresh() {
  if (_balanceAutoRefreshTimer) { clearInterval(_balanceAutoRefreshTimer); _balanceAutoRefreshTimer = null; }
}

// Control setup
function setupControls() {
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const openLogsBtn = document.getElementById('open-logs-btn');
  const hashrateUnitEl = document.getElementById('hashrate-unit');
  const algoSelect = document.getElementById('algo-select');
  const algoSaveBtn = document.getElementById('algo-save-btn');
  const algoStatusEl = document.getElementById('algo-status');
  const gpuCheckbox = document.getElementById('gpu-checkbox');
  const modeStatusEl = document.getElementById('mode-status');
  const backendStatusEl = document.getElementById('backend-status');

  const setModeStatus = (mode) => {
    const pureZionMode = isPureZionDesktopMode(config);
    const labels = {
      'cpu': 'CPU mining only (~600 kH/s)',
      'gpu': 'GPU mining only (~8.5 GH/s)',
      'dual': 'Dual mining uses both CPU and GPU simultaneously (MAX POWER!)',
      'gpu-revenue': pureZionMode
        ? 'GPU revenue mode is disabled in pure ZION desktop mode'
        : 'GPU revenue mode routes GPU to profit-switch stream while CPU keeps ZION/revenue split'
    };
    if (modeStatusEl) modeStatusEl.textContent = labels[mode] || '';
  };

  // Mining mode radio button listeners
  document.querySelectorAll('input[name="mining-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const mode = normalizeMiningMode(radio.value);
      if (mode !== radio.value) {
        const fallbackRadio = document.querySelector(`input[name="mining-mode"][value="${mode}"]`);
        if (fallbackRadio) fallbackRadio.checked = true;
      }
      setModeStatus(mode);
      // Sync hidden gpu checkbox for backwards compat
      if (gpuCheckbox) gpuCheckbox.checked = (mode === 'gpu' || mode === 'dual' || mode === 'gpu-revenue');
    });
  });

  const updateBackendStatus = (value) => {
    const labels = {
      auto: 'Canonical cosmic_harmony uses the Deeksha path automatically.',
      rust: 'Canonical cosmic_harmony bypasses Rust and stays on the Deeksha path.',
      python: 'Canonical cosmic_harmony uses the Deeksha Python path.'
    };
    if (backendStatusEl) backendStatusEl.textContent = labels[value] || '';
  };

  document.querySelectorAll('input[name="miner-backend"]').forEach(radio => {
    radio.addEventListener('change', () => {
      updateBackendStatus(radio.value);
    });
  });

  // Load persisted unit preference
  try {
    const saved = window.localStorage.getItem('zion.hashrateUnitMode');
    if (saved && HASHRATE_UNIT_CYCLE.includes(saved)) {
      hashrateUnitMode = saved;
    }
  } catch {
    // ignore
  }

  const renderHashrateUnitLabel = () => {
    if (!hashrateUnitEl) return;
    hashrateUnitEl.textContent = hashrateUnitMode === 'auto' ? 'Auto' : hashrateUnitMode;
  };

  const cycleHashrateUnit = () => {
    const idx = HASHRATE_UNIT_CYCLE.indexOf(hashrateUnitMode);
    hashrateUnitMode = HASHRATE_UNIT_CYCLE[(idx + 1) % HASHRATE_UNIT_CYCLE.length];
    try {
      window.localStorage.setItem('zion.hashrateUnitMode', hashrateUnitMode);
    } catch {
      // ignore
    }
    renderHashrateUnitLabel();
    // Force redraw with current stats (if present)
    window.electronAPI.getStats().then(scheduleStatsUpdate).catch(() => {});
  };

  if (hashrateUnitEl) {
    renderHashrateUnitLabel();
    hashrateUnitEl.addEventListener('click', cycleHashrateUnit);
  }

  const ALGO_LABELS = {
    cosmic_harmony: 'Cosmic Harmony Deeksha — canonical 2.9.8 CPU/GPU path'
  };

  const syncAlgoUi = () => {
    const algo = algoSelect?.value || config.algorithm || 'cosmic_harmony';
    const label = ALGO_LABELS[algo] || algo;
    if (algoStatusEl) algoStatusEl.textContent = label;
    // update the display chip in the control panel
    const algoDisplayChip = document.querySelector('#algo-display .font-semibold');
    if (algoDisplayChip) algoDisplayChip.textContent = 'Cosmic Harmony Deeksha';
  };

  const algoSupportsGpu = (algo) => {
    // Mainnet Phase 1: CH v3 always supports GPU
    return true;
  };

  const isMemoryHardAlgo = (algo) => {
    return false;
  };

  const syncGpuUi = () => {
    if (!(gpuCheckbox instanceof HTMLInputElement)) return;
    // CH v3 always supports GPU
    gpuCheckbox.disabled = false;
  };

  // Sync config.algorithm from the select whenever user changes it
  if (algoSelect) {
    algoSelect.addEventListener('change', () => {
      config.algorithm = algoSelect.value;
      syncAlgoUi();
    });
    // init from persisted config
    if (config.algorithm && algoSelect.querySelector(`option[value="${config.algorithm}"]`)) {
      algoSelect.value = config.algorithm;
    }
  }

  startBtn.addEventListener('click', async () => {
    if (!config.wallet) {
      await openOneClickWizard();
      return;
    }
    
    const result = await window.electronAPI.startMining(config);
    if (result.success) {
      console.log('Mining started');
      return;
    }

    const msg = result?.error || 'Failed to start mining.';
    addLogEntry(`Start failed: ${msg}`, 'error');
    alert(msg);
  });

  // Initial sync
  syncAlgoUi();
  syncGpuUi();
  
  // Pool radio button listener - enable/disable custom input
  document.querySelectorAll('input[name="pool-select"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const customInput = document.getElementById('pool-input');
      if (customInput) {
        const isCustom = document.getElementById('pool-custom')?.checked;
        customInput.disabled = !isCustom;
        customInput.style.opacity = isCustom ? '1' : '0.5';
        if (isCustom) customInput.focus();
      }
    });
  });
  
  stopBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.stopMining();
    if (result.success) {
      console.log('Mining stopped');
    }
  });

  saveSettingsBtn.addEventListener('click', async () => {
    // Read settings from UI - Pool selection with radio buttons
    const poolRadio = document.querySelector('input[name="pool-select"]:checked');
    let poolHost = PRIMARY_TESTNET_HOST;
    let poolPort = PRIMARY_POOL_PORT;
    
    if (poolRadio) {
      if (poolRadio.value === 'custom') {
        // Custom pool - read from text input
        const customPool = document.getElementById('pool-input').value;
        const [h, p] = customPool.split(':');
        poolHost = h || PRIMARY_TESTNET_HOST;
        poolPort = parseInt(p) || PRIMARY_POOL_PORT;
      } else {
        // Predefined pool
        const [h, p] = poolRadio.value.split(':');
        poolHost = h;
        poolPort = parseInt(p) || 3333;
      }
    }
    
    const pureZionMode = isPureZionDesktopMode(config);
    const selectedMode = normalizeMiningMode(
      document.querySelector('input[name="mining-mode"]:checked')?.value || 'dual',
      pureZionMode,
    );
    const revenueCpuCoin = (document.getElementById('revenue-cpu-coin')?.value || 'auto').toLowerCase();
    const revenueGpuCoinsRaw = document.getElementById('revenue-gpu-coins')?.value || '';
    const revenueGpuCoins = revenueGpuCoinsRaw
      .split(',')
      .map(v => v.trim().toUpperCase())
      .filter(Boolean);

    const currentRevenue = normalizeRevenueProfile(config?.revenue || {});
    let nextRevenue = normalizeRevenueProfile({
      ...currentRevenue,
      enabled: !!document.getElementById('revenue-enabled')?.checked,
      allocation: {
        zionPct: parseInt(document.getElementById('revenue-zion-pct')?.value || String(currentRevenue.allocation.zionPct), 10),
        multiAlgoPct: parseInt(document.getElementById('revenue-multi-pct')?.value || String(currentRevenue.allocation.multiAlgoPct), 10),
        nclPct: parseInt(document.getElementById('revenue-ncl-pct')?.value || String(currentRevenue.allocation.nclPct), 10),
      },
      cpu: { coin: revenueCpuCoin },
      gpu: {
        enabled: !!document.getElementById('revenue-gpu-enabled')?.checked || selectedMode === 'gpu-revenue',
        coins: revenueGpuCoins,
        poolPreference: document.getElementById('pool-preference')?.value || 'herominers',
        poolRegion: document.getElementById('pool-region')?.value || 'eu',
        nicehashBtcAddr: document.getElementById('nicehash-btc-addr')?.value?.trim() || null,
      },
      ncl: { enabled: !!document.getElementById('revenue-ncl-enabled')?.checked },
      freeStreams: {
        mysterium: !!document.getElementById('revenue-mysterium-enabled')?.checked,
        nkn: !!document.getElementById('revenue-nkn-enabled')?.checked,
        aiGateway: !!document.getElementById('revenue-ai-enabled')?.checked,
      },
    });

    if (currentPureZionDefault(config) || pureZionMode) {
      nextRevenue = toPureZionRevenueProfile(nextRevenue);
    }

    config = {
      ...config,
      pool: {
        host: poolHost,
        port: poolPort
      },
      rpcUrl: document.getElementById('rpc-url')?.value || config.rpcUrl || DEFAULT_RPC_URL,
      algorithm: config.algorithm || 'cosmic_harmony',
      wallet: document.getElementById('wallet-input').value,
      worker: document.getElementById('worker-input').value,
      threads: Math.min(
        cpuThreadMax,
        Math.max(1, parseInt(document.getElementById('threads-input').value) || 1)
      ),
      // New mining mode system
      miningMode: selectedMode,
      gpu: ['gpu', 'dual', 'gpu-revenue'].includes(selectedMode),
      // GPU Revenue Mining configuration
      gpuRevenue: !currentPureZionDefault(config) && (selectedMode === 'gpu-revenue' || nextRevenue.gpu.enabled),
      gpuRevenueCoins: nextRevenue.gpu.coins,
      poolPreference: nextRevenue.gpu.poolPreference || 'herominers',
      poolRegion: nextRevenue.gpu.poolRegion || 'eu',
      nicehashBtcAddr: nextRevenue.gpu.nicehashBtcAddr || '',
      revenueWallet: document.getElementById('revenue-wallet')?.value?.trim() || config.revenueWallet || '',
      revenue: nextRevenue,
      // Miner backend preference: auto | rust | python
      minerBackend: document.querySelector('input[name="miner-backend"]:checked')?.value || 'auto',
      aiAfterburner: document.getElementById('ai-afterburner-enabled')?.checked !== false,
      autoStart: document.getElementById('autostart-checkbox').checked,
      minimizeToTray: true,
      startMinimized: false
    };

    applyPureZionUiState(config);
    
    const result = await window.electronAPI.saveConfig(config);
    if (result) {
      alert('Settings saved successfully!');
    } else {
      alert('Failed to save settings.');
    }
  });
  
  if (openLogsBtn) {
    openLogsBtn.addEventListener('click', async () => {
      await window.electronAPI.openLogs();
    });
  }

  // Debug drawer toggle
  const debugToggle = document.getElementById('toggle-debug-btn');
  const debugDrawer = document.getElementById('debug-drawer');
  if (debugToggle && debugDrawer) {
    debugToggle.addEventListener('click', () => {
      const visible = debugDrawer.style.display !== 'none';
      debugDrawer.style.display = visible ? 'none' : 'block';
      debugToggle.style.color = visible ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.85)';
      debugToggle.style.borderColor = visible ? 'rgba(255,255,255,0.1)' : 'rgba(147,51,234,0.5)';
      debugToggle.style.background = visible ? 'rgba(255,255,255,0.05)' : 'rgba(147,51,234,0.15)';
    });
  }
}

function formatHashrate(valueHs) {
  const hs = typeof valueHs === 'number' && Number.isFinite(valueHs) ? valueHs : 0;

  const toFixed = (v) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));

  const unit = hashrateUnitMode;
  if (unit === 'H/s') return { value: toFixed(hs), unit: 'H/s' };
  if (unit === 'kH/s') return { value: toFixed(hs / 1e3), unit: 'kH/s' };
  if (unit === 'MH/s') return { value: toFixed(hs / 1e6), unit: 'MH/s' };
  if (unit === 'GH/s') return { value: toFixed(hs / 1e9), unit: 'GH/s' };

  // auto
  if (hs >= 1e9) return { value: toFixed(hs / 1e9), unit: 'GH/s' };
  if (hs >= 1e6) return { value: toFixed(hs / 1e6), unit: 'MH/s' };
  if (hs >= 1e3) return { value: toFixed(hs / 1e3), unit: 'kH/s' };
  return { value: toFixed(hs), unit: 'H/s' };
}

function updateSettingsUI() {
  document.getElementById('wallet-input').value = config.wallet || '';
  
  // Pool selection - set correct radio button
  const poolAddress = `${config.pool?.host || PRIMARY_TESTNET_HOST}:${config.pool?.port || PRIMARY_POOL_PORT}`;
  const poolRadios = {
    [`${PRIMARY_TESTNET_HOST}:${PRIMARY_POOL_PORT}`]: 'pool-primary'
  };
  
  if (poolRadios[poolAddress]) {
    // Predefined pool
    document.getElementById(poolRadios[poolAddress]).checked = true;
    document.getElementById('pool-input').value = '';
    document.getElementById('pool-input').disabled = true;
    document.getElementById('pool-input').style.opacity = '0.5';
  } else {
    // Custom pool
    document.getElementById('pool-custom').checked = true;
    document.getElementById('pool-input').value = poolAddress;
    document.getElementById('pool-input').disabled = false;
    document.getElementById('pool-input').style.opacity = '1';
  }
  
  const rpcUrlEl = document.getElementById('rpc-url');
  if (rpcUrlEl) rpcUrlEl.value = config.rpcUrl || DEFAULT_RPC_URL;
  document.getElementById('worker-input').value = config.worker || 'desktop-agent';
  const threadsInput = document.getElementById('threads-input');
  if (threadsInput) {
    threadsInput.max = String(cpuThreadMax);
    threadsInput.value = String(Math.min(cpuThreadMax, Math.max(1, config.threads || 4)));
  }

  const threadsValueEl = document.getElementById('threads-value');
  if (threadsValueEl) threadsValueEl.textContent = String(Math.min(cpuThreadMax, Math.max(1, config.threads || 4)));

  const threadsMaxEl = document.getElementById('threads-max');
  if (threadsMaxEl) threadsMaxEl.textContent = String(cpuThreadMax);

  // Mining Mode radio buttons (new UI)
  const miningMode = normalizeMiningMode(config.miningMode || (config.gpu ? 'dual' : 'cpu'));
  const modeRadio = document.querySelector(`input[name="mining-mode"][value="${miningMode}"]`);
  if (modeRadio) modeRadio.checked = true;
  const modeStatusEl = document.getElementById('mode-status');
  if (modeStatusEl) {
    const pureZionMode = isPureZionDesktopMode(config);
    const modeLabels = {
      'cpu': 'CPU mining only (~600 kH/s)',
      'gpu': 'GPU mining only (~8.5 GH/s)',
      'dual': 'Dual mining uses both CPU and GPU simultaneously (MAX POWER!)',
      'gpu-revenue': pureZionMode
        ? 'GPU revenue mode is disabled in pure ZION desktop mode'
        : 'GPU revenue mode routes GPU to profit-switch stream while CPU keeps ZION/revenue split'
    };
    modeStatusEl.textContent = modeLabels[miningMode] || '';
  }

  const revenue = currentPureZionDefault(config)
    ? toPureZionRevenueProfile(config?.revenue || {})
    : normalizeRevenueProfile(config?.revenue || {});
  const revenueCpuCoinEl = document.getElementById('revenue-cpu-coin');
  const revenueGpuCoinsEl = document.getElementById('revenue-gpu-coins');
  const revenueEnabledEl = document.getElementById('revenue-enabled');
  const revenueGpuEnabledEl = document.getElementById('revenue-gpu-enabled');
  const revenueNclEnabledEl = document.getElementById('revenue-ncl-enabled');
  const revenueZionPctEl = document.getElementById('revenue-zion-pct');
  const revenueMultiPctEl = document.getElementById('revenue-multi-pct');
  const revenueNclPctEl = document.getElementById('revenue-ncl-pct');
  const revenueMysteriumEl = document.getElementById('revenue-mysterium-enabled');
  const revenueNknEl = document.getElementById('revenue-nkn-enabled');
  const revenueAiEl = document.getElementById('revenue-ai-enabled');

  if (revenueCpuCoinEl) revenueCpuCoinEl.value = revenue.cpu.coin;
  if (revenueGpuCoinsEl) revenueGpuCoinsEl.value = revenue.gpu.coins.join(',');
  if (revenueEnabledEl) revenueEnabledEl.checked = revenue.enabled;
  if (revenueGpuEnabledEl) revenueGpuEnabledEl.checked = revenue.gpu.enabled || miningMode === 'gpu-revenue';
  if (revenueNclEnabledEl) revenueNclEnabledEl.checked = revenue.ncl.enabled;
  if (revenueZionPctEl) revenueZionPctEl.value = String(revenue.allocation.zionPct);
  if (revenueMultiPctEl) revenueMultiPctEl.value = String(revenue.allocation.multiAlgoPct);
  if (revenueNclPctEl) revenueNclPctEl.value = String(revenue.allocation.nclPct);
  if (revenueMysteriumEl) revenueMysteriumEl.checked = revenue.freeStreams.mysterium;
  if (revenueNknEl) revenueNknEl.checked = revenue.freeStreams.nkn;
  if (revenueAiEl) revenueAiEl.checked = revenue.freeStreams.aiGateway;

  // Pool preference / region / NiceHash
  const poolPrefEl = document.getElementById('pool-preference');
  const poolRegionEl = document.getElementById('pool-region');
  const nhBtcEl = document.getElementById('nicehash-btc-addr');
  const revWalletEl = document.getElementById('revenue-wallet');
  if (poolPrefEl) poolPrefEl.value = revenue.gpu?.poolPreference || config.poolPreference || 'herominers';
  if (poolRegionEl) poolRegionEl.value = revenue.gpu?.poolRegion || config.poolRegion || 'eu';
  if (nhBtcEl) nhBtcEl.value = revenue.gpu?.nicehashBtcAddr || config.nicehashBtcAddr || '';
  if (revWalletEl) revWalletEl.value = config.revenueWallet || '';

  // Sync hidden gpu-checkbox for backwards compatibility
  const gpuEl = document.getElementById('gpu-checkbox');
  if (gpuEl) {
    // Mainnet Phase 1: CH v3 always supports GPU
    gpuEl.disabled = false;
    // GPU checkbox is checked if mode is 'gpu' or 'dual' or 'gpu-revenue'
    gpuEl.checked = (miningMode === 'gpu' || miningMode === 'dual' || miningMode === 'gpu-revenue');
  }
  applyPureZionUiState(config);
  document.getElementById('autostart-checkbox').checked = config.autoStart || false;

  const backendStatusEl = document.getElementById('backend-status');
  const backendPill = document.getElementById('backend-pill');
  const backendValue = String(config.minerBackend || 'auto').toLowerCase();
  const backendRadio = document.querySelector(`input[name="miner-backend"][value="${backendValue}"]`);
  if (backendRadio) backendRadio.checked = true;
  // Keep variables referenced (avoid unused warnings in some linters)
  void backendStatusEl;
  void backendPill;
  renderBackendUi();

  // AI Afterburner toggle
  const abToggle = document.getElementById('ai-afterburner-enabled');
  if (abToggle) abToggle.checked = config.aiAfterburner !== false;

  // Dashboard quick controls — algorithm fixed to canonical Deeksha path
  const algoSelect = document.getElementById('algo-select');
  if (algoSelect) algoSelect.value = 'cosmic_harmony';
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let _streamLogWindowStart = 0;
let _streamLogCount = 0;
let _streamLogSuppressed = 0;
const _streamLogWindowMs = 1000;
const _streamLogMaxPerWindow = 25; // Increased from 8 to 25 lines per second

function flushSuppressedStreamLogs() {
  if (_streamLogSuppressed > 0) {
    addLogEntry(`Suppressed ${_streamLogSuppressed} log lines`, 'info');
    _streamLogSuppressed = 0;
  }
}

function logStreamLine(stream, line) {
  const now = Date.now();
  if (now - _streamLogWindowStart > _streamLogWindowMs) {
    _streamLogWindowStart = now;
    _streamLogCount = 0;
    flushSuppressedStreamLogs();
  }

  if (_streamLogCount < _streamLogMaxPerWindow) {
    _streamLogCount += 1;
    addLogEntry(`[${stream}] ${line}`, 'info');
  } else {
    _streamLogSuppressed += 1;
  }

  // Mining Console — only append if Logs tab is visible (perf optimization)
  if (currentView === 'logs') {
    appendMiningConsole(line);
  } else {
    // Buffer for lazy flush when user switches to Logs
    _mcDeferredQueue.push(line);
    if (_mcDeferredQueue.length > 30) _mcDeferredQueue.shift();
  }
}

// ────────────────────────────────────────────────────────────
// MINING CONSOLE — Professional XMRig/SRBMiner-style terminal
// ────────────────────────────────────────────────────────────
const MC_MAX_LINES = 120;
let _mcQueue = [];
let _mcFlushScheduled = false;
let _mcDeferredQueue = []; // lines buffered while Logs tab is hidden
let _lastPanelLines = null; // cached panel lines for instant render on tab switch

function appendMiningConsole(raw) {
  const body = document.getElementById('console-body');
  if (!body) return;

  // Skip panel lines (handled by updateStaticPanel)
  // Note: T-Rex style lines use "KEYWORD   : value" format — keep those (negative lookahead (?!\s*:))
  if (/^[\u250c\u2502\u2514]/.test(raw) || /^\s*(SPEED|SHARES|DIFF|UPTIME|HW|NET|EVENT)\b(?!\s*:)/i.test(raw)) return;
  if (/^\[STATUS\]/i.test(raw)) return;

  const html = colorizeConsoleLine(raw);
  if (!html) return;
  _mcQueue.push(html);

  if (_mcFlushScheduled) return;
  _mcFlushScheduled = true;

  requestAnimationFrame(() => {
    _mcFlushScheduled = false;
    const el = document.getElementById('console-body');
    if (!el) { _mcQueue = []; return; }

    const atBottom = (el.scrollTop + el.clientHeight) >= (el.scrollHeight - 20);
    const frag = document.createDocumentFragment();

    for (const h of _mcQueue) {
      if (!h) continue;
      const div = document.createElement('div');
      div.className = 'mc-line' + (h._cls || '');
      div.innerHTML = h.html || h;
      frag.appendChild(div);
    }
    _mcQueue = [];
    el.appendChild(frag);

    // Trim old lines (reduced from 200)
    while (el.children.length > MC_MAX_LINES) {
      el.removeChild(el.firstChild);
    }

    if (atBottom) el.scrollTop = el.scrollHeight;
  });
}

function colorizeConsoleLine(raw) {
  const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const tsHtml = `<span class="mc-ts">[${ts}]</span> `;
  const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // ── XMRig speed line: "speed 10s/60s/15m  X.XX  Y.YY  Z.ZZ kH/s  max W.WW kH/s" ──
  let m = raw.match(/speed\s+10s\/60s\/15m\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*([kKmMgGtT]?H\/s)\s+max\s+([\d.]+)/i);
  if (m) {
    return { html: `${tsHtml}<span class="mc-speed">speed</span> 10s/60s/15m <span class="mc-hr">${m[1]}</span> <span class="mc-hr">${m[2]}</span> <span class="mc-hr">${m[3]}</span> <span class="mc-unit">${m[4]}</span> max <span class="mc-max">${m[5]} ${m[4]}</span>` };
  }

  // ── XMRig accepted: "accepted 42/0 (+1) diff 256 [38 ms] (100.0%)" ──
  // Rust miner event: "accepted 42/0 (+1) diff 256 (100.0%)" — no latency
  m = raw.match(/accepted\s+(\d+)\/(\d+)\s+\(\+1\)\s+diff\s+([\d.]+[TGMK]?)(?:\s+\[([^\]]+)\])?\s+\(([\d.]+)%\)/i);
  if (m) {
    const latencyPart = m[4] ? ` <span class="mc-ts">[${m[4]}]</span>` : '';
    return { html: `${tsHtml}<span class="mc-accepted">accepted</span> <span class="mc-hr">${m[1]}</span>/<span class="mc-rejected">${m[2]}</span> <span class="mc-ok">(+1)</span> diff <span class="mc-diff">${m[3]}</span>${latencyPart} <span class="mc-info">(${m[5]}%)</span>`, _cls: ' mc-highlight' };
  }

  // ── XMRig rejected: "rejected 42/1 (+1) \"reason\"" ──
  // Rust miner event: "rejected 42/1 — reason"
  m = raw.match(/rejected\s+(\d+)\/(\d+)(?:\s+\(\+1\))?\s+(?:"([^"]+)"|[—–-]\s*(\S[^\n]*))/i);
  if (m) {
    const reason = esc((m[3] || m[4] || '').trim());
    return { html: `${tsHtml}<span class="mc-rejected">rejected</span> ${m[1]}/<span class="mc-rejected">${m[2]}</span> <span class="mc-err">${reason}</span>` };
  }

  // ── new job: "new job  height 1523  diff 256  algo cosmic_harmony" ──
  m = raw.match(/new job\s+height\s+(\d+)\s+diff\s+([\d.]+[TGMK]?)\s+algo\s+(\S+)/i);
  if (m) {
    return { html: `${tsHtml}<span class="mc-job">new job</span> height <span class="mc-hr">${m[1]}</span> diff <span class="mc-diff">${m[2]}</span> algo <span class="mc-algo">${esc(m[3])}</span>` };
  }

  // ── BLOCK FOUND ──
  m = raw.match(/BLOCK FOUND.*?height\s+(\d+).*?\(total:\s*(\d+)\)/i);
  if (m) {
    return { html: `${tsHtml}<span class="mc-block">█ BLOCK FOUND █ ★</span> height <span class="mc-hr">${m[1]}</span> <span class="mc-info">(total: ${m[2]})</span>`, _cls: ' mc-block-line' };
  }

  // ── GPU share: "GPU SHARE FOUND" / "GPU share ACCEPTED" / "GPU share REJECTED" ──
  if (/GPU SHARE FOUND/i.test(raw)) {
    return { html: `${tsHtml}<span class="mc-ok">[GPU] SHARE FOUND!</span> <span class="mc-info">${esc(raw.replace(/.*GPU SHARE FOUND!?/i, '').trim())}</span>` };
  }
  if (/GPU share ACCEPTED/i.test(raw)) {
    m = raw.match(/\(total:\s*(\d+)\)/i);
    return { html: `${tsHtml}<span class="mc-accepted">[+] GPU share ACCEPTED</span> <span class="mc-info">(total: ${m ? m[1] : '?'})</span>`, _cls: ' mc-highlight' };
  }
  if (/GPU share REJECTED/i.test(raw)) {
    return { html: `${tsHtml}<span class="mc-rejected">[✗] GPU share REJECTED</span>` };
  }

  // ── GPU hashrate: "Apple M1 [GPU]: 2.59 MH/s" ──
  m = raw.match(/([^\[]+)\[(GPU|CPU-fallback)\]:\s*([\d.]+)\s*([kKmMgGtT]?H\/s)/i);
  if (m) {
    const mode = m[2].toUpperCase();
    const cls = mode === 'GPU' ? 'mc-ok' : 'mc-algo';
    return { html: `${tsHtml}<span class="${cls}">${esc(m[1].trim())} [${mode}]</span> <span class="mc-hr">${m[3]}</span> <span class="mc-unit">${m[4]}</span>` };
  }

  // ── Batch done: "✅ Batch done: 250000 hashes in 452ms, 552.04 kH/s" ──
  m = raw.match(/Batch done:.*?([\d.]+)\s*([kKmMgGtT]?H\/s)/i);
  if (m) {
    return { html: `${tsHtml}<span class="mc-ok">[OK] Batch</span> <span class="mc-hr">${m[1]}</span> <span class="mc-unit">${m[2]}</span>` };
  }

  // ── Connection: "Connecting", "connected", "Reconnection" ──
  if (/connecting|connected|reconnect/i.test(raw)) {
    const cls = /connected|success/i.test(raw) ? 'mc-ok' : 'mc-warn';
    return { html: `${tsHtml}<span class="${cls}">${esc(raw)}</span>` };
  }

  // ── Stream switch ──
  m = raw.match(/Stream switch:\s*(\S+)\s*→\s*(\S+)/i);
  if (m) {
    return { html: `${tsHtml}<span class="mc-warn">~&gt; Stream switch</span> <span class="mc-algo">${esc(m[1])}</span> → <span class="mc-algo">${esc(m[2])}</span>` };
  }

  // ── Errors ──
  if (/error|failed|panic/i.test(raw)) {
    return { html: `${tsHtml}<span class="mc-err">${esc(raw)}</span>` };
  }

  // ── Warnings ──
  if (/warn|⚠|timeout/i.test(raw)) {
    return { html: `${tsHtml}<span class="mc-warn">${esc(raw)}</span>` };
  }

  // ── T-Rex dashboard: " HASHRATE : TOTAL X | CPU Y | GPU Z" ──
  m = raw.match(/HASHRATE\s*:\s*TOTAL\s+([\d.]+\s*\S+\/s)\s*\|\s*CPU\s+([\d.]+\s*\S+\/s)\s*\|\s*GPU\s+([\d.]+\s*\S+\/s)/i);
  if (m) {
    return { html: `${tsHtml}<span class="mc-speed">HASHRATE</span> TOTAL <span class="mc-hr">${esc(m[1])}</span> | CPU <span class="mc-hr">${esc(m[2])}</span> | GPU <span class="mc-hr">${esc(m[3])}</span>` };
  }

  // ── T-Rex dashboard: " SHARES : ACCEPTED 5 | REJECTED 0 | SENT 5 | ACC 100.0%" ──
  m = raw.match(/SHARES\s*:\s*ACCEPTED\s+(\d+)\s*\|\s*REJECTED\s+(\d+)\s*\|\s*SENT\s+(\d+)\s*\|\s*ACC\s+([\d.]+%)/i);
  if (m) {
    return { html: `${tsHtml}<span class="mc-speed">SHARES</span> <span class="mc-accepted">ACCEPTED ${m[1]}</span> | <span class="mc-rejected">REJECTED ${m[2]}</span> | SENT ${m[3]} | ACC <span class="mc-info">${m[4]}</span>` };
  }

  // ── T-Rex dashboard: " UPTIME : 00:05:42 | GPU: ON | JOB: abcdef" ──
  m = raw.match(/UPTIME\s*:\s*([\d:hms]+)\s*\|\s*GPU:\s*(\w+)\s*\|\s*JOB:\s*(\S*)/i);
  if (m) {
    const gpuCls = m[2].toUpperCase() === 'ON' ? 'mc-ok' : 'mc-warn';
    return { html: `${tsHtml}<span class="mc-info">UPTIME</span> <span class="mc-hr">${esc(m[1])}</span> | GPU: <span class="${gpuCls}">${esc(m[2])}</span> | JOB: <span class="mc-ts">${esc(m[3])}</span>` };
  }

  // ── Status panel lines (┌│└ or XMRig-style SPEED/SHARES/DIFF/UPTIME/HW/NET/EVENT without colon) ──
  // T-Rex "KEY   : value" lines are already handled above; skip only XMRig panel lines
  if (/^[│┌└]|^\s*(HASHRATE|SHARES|DIFF|UPTIME|THREADS|SPEED|HW|NET|EVENT)(?!\s*:)/i.test(raw)) {
    return null; // Signal to skip this line
  }

  // ── Startup info lines ──
  if (/^\s*\*|Starting|started|Initializ|threads|algorithm|pool|wallet|miner/i.test(raw)) {
    return { html: `${tsHtml}<span class="mc-info">${esc(raw)}</span>` };
  }

  // ── Default: plain text ──
  return { html: `${tsHtml}${esc(raw)}` };
}

// ═══════════════════════════════════════════════════════════
// STATIC MINER PANEL — SRBMiner-style, overwrites in place
// ═══════════════════════════════════════════════════════════
function updateStaticPanel(panelLines) {
  const el = document.getElementById('miner-static-panel');
  if (!el) return;
  el.style.display = 'block';

  const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const htmlLines = panelLines.map(raw => {
    // Border lines
    if (/^[┌└]/.test(raw)) {
      return `<span class="sp-border">${esc(raw)}</span>`;
    }
    // Content lines — parse key: value
    let line = esc(raw);
    // Highlight labels: SPEED, SHARES, DIFF, UPTIME, HW, NET, EVENT
    line = line.replace(/\b(SPEED|SHARES|DIFF|UPTIME|HW|NET|EVENT)\b/g, '<span class="sp-label">$1</span>');
    // Highlight numeric values with units
    line = line.replace(/(\d+\.\d+)\s*(MH\/s|kH\/s|GH\/s|TH\/s|H\/s)/gi, '<span class="sp-value">$1</span> <span class="sp-unit">$2</span>');
    // Highlight A: N (accepted — green)
    line = line.replace(/A:\s*(\d+)/g, 'A: <span class="sp-good">$1</span>');
    // Highlight R: N (rejected — red)
    line = line.replace(/R:\s*(\d+)/g, 'R: <span class="sp-bad">$1</span>');
    // Highlight rate percentage
    line = line.replace(/rate:\s*([\d.]+%)/g, 'rate: <span class="sp-value">$1</span>');
    // Highlight blocks count
    line = line.replace(/blocks:\s*(\d+)/g, 'blocks: <span class="sp-value">$1</span>');
    // Highlight height
    line = line.replace(/height:\s*(\d+)/g, 'height: <span class="sp-value">$1</span>');
    // Highlight algo
    line = line.replace(/algo:\s*(\S+)/g, 'algo: <span class="sp-value">$1</span>');
    // Dim the │ border
    line = line.replace(/│/g, '<span class="sp-dim">│</span>');
    // Event text — green
    line = line.replace(/(accepted \d+\/\d+.*)/g, '<span class="sp-event">$1</span>');
    return line;
  });

  el.innerHTML = htmlLines.join('\n');
}

// Console controls
function setupMiningConsole() {
  const clearBtn = document.getElementById('console-clear-btn');
  const scrollBtn = document.getElementById('console-scroll-btn');
  const body = document.getElementById('console-body');

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (body) body.innerHTML = '<div class="mc-line"><span class="mc-info"> * Console cleared</span></div>';
    });
  }
  if (scrollBtn) {
    scrollBtn.addEventListener('click', () => {
      if (body) body.scrollTop = body.scrollHeight;
    });
  }
}

// Update console status dot
function updateConsoleDot(isRunning) {
  const dot = document.getElementById('console-dot');
  const status = document.getElementById('console-status');
  if (dot) {
    dot.className = isRunning ? 'dot' : 'dot offline';
  }
  if (status) {
    status.textContent = isRunning ? 'mining' : 'idle';
  }
}

// Event listeners
function setupEventListeners() {
  // Auto-select pool notification — refresh config when main process picks best pool
  if (typeof window.electronAPI.onConfigUpdated === 'function') {
    window.electronAPI.onConfigUpdated(async () => {
      dbg('[renderer] Config updated by main process, refreshing...');
      const result = await window.electronAPI.getConfig();
      if (result.success) {
        config = result.config;
        updateSettingsUI();
        addLogEntry(`Pool auto-selected: ${config.pool?.host}:${config.pool?.port}`, 'info');
      }
    });
  }

  if (typeof window.electronAPI.onMinerBackend === 'function') {
    window.electronAPI.onMinerBackend((data) => {
      try {
        resolvedMinerBackendPreferred = String(data?.preferred || '').toLowerCase() || null;
        resolvedMinerBackend = String(data?.resolved || '').toLowerCase() || null;
      } catch {
        resolvedMinerBackendPreferred = null;
        resolvedMinerBackend = null;
      }
      renderBackendUi();
    });
  }

  window.electronAPI.onMinerStarted(() => {
    isRunning = true;
    updateControlButtons();
    updateStatusBadge('mining');
    addLogEntry('Mining started successfully', 'info');
    // Mining Console banner
    appendMiningConsole('─'.repeat(60));
    appendMiningConsole(' * ZION Native Awakening v2.9.6 — Mining started');
    appendMiningConsole('─'.repeat(60));
  });
  
  window.electronAPI.onMinerStopped((data) => {
    isRunning = false;
    updateControlButtons();
    updateStatusBadge('stopped');
    appendMiningConsole('─'.repeat(60));
    appendMiningConsole(' * Mining stopped');
    const code = (data && Object.prototype.hasOwnProperty.call(data, 'code')) ? data.code : undefined;
    const signal = data?.signal;
    addLogEntry(
      `Mining stopped (exit code: ${code}${signal ? `, signal: ${signal}` : ''})`,
      'warning'
    );

    // Hide multi-stream bar
    _lastMultiStreamStatus = null;
    const msBar = document.getElementById('multi-stream-bar');
    if (msBar) msBar.classList.remove('active');
    
    // Reset stats
    updateStats({
      hashrate: 0,
      hashrate_10s: 0,
      hashrate_60s: 0,
      hashrate_15m: 0,
      hashrate_max: 0,
      hashrate_cpu: 0,
      hashrate_gpu: 0,
      shares: 0,
      accepted: 0,
      rejected: 0,
      uptime: 0,
      difficulty: 0,
      best_share_diff: 0,
      blocks_found: 0,
      total_hashes: 0,
      pool_latency_ms: 0,
      connection_count: 1,
      cpu_threads: 0,
    });
  });

  window.electronAPI.onMinerError((data) => {
    const msg = data?.message || 'Miner error';
    addLogEntry(`Miner error: ${msg}`, 'error');
  });

  window.electronAPI.onMinerOutput((data) => {
    const text = (data?.text || '').toString();
    const stream = data?.stream === 'stderr' ? 'stderr' : 'stdout';

    // Strip ANSI escape sequences + control chars
    const clean = text
      .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')  // ANSI escapes
      .replace(/\x1B\[\?[0-9;]*[A-Za-z]/g, '') // ANSI private
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

    const lines = clean.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // Collect static panel lines (┌│└) → overwrite fixed panel element
    const panelLines = [];
    const logLines = [];
    for (const line of lines) {
      if (/^[┌│└]/.test(line) || /^[─]+$/.test(line)) {
        panelLines.push(line);
      } else {
        // Include [STATUS] lines for real-time mining stats
        logLines.push(line);
      }
    }

    // Update static panel — only if Logs tab visible (perf)
    if (panelLines.length > 0) {
      _lastPanelLines = panelLines; // always cache latest
      if (currentView === 'logs') {
        updateStaticPanel(panelLines);
      }
    }

    // Only append non-panel lines to scrolling log
    for (const line of logLines.slice(0, 25)) { // Increased from 10 to 25 lines per output
      logStreamLine(stream, line);
    }
  });

  window.electronAPI.onBlockFound((data) => {
    const height = data?.height;
    const msg = height != null
      ? `GRATULUJI! Našel jsi blok #${height}!`
      : 'GRATULUJI! Našel jsi blok!';
    addLogEntry(msg, 'success');
  });
  
  window.electronAPI.onStatsUpdate((stats) => {
    _lastIpcStatsAt = Date.now();
    scheduleStatsUpdate(stats);
  });
}

function updateControlButtons() {
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  
  startBtn.disabled = isRunning;
  stopBtn.disabled = !isRunning;
}

function updateStatusBadge(status) {
  const badge = document.getElementById('status-badge');
  if (!badge) return;
  
  if (status === 'mining') {
    badge.className = 'status-badge mining';
    badge.textContent = 'MINING';
  } else {
    badge.className = 'status-badge stopped';
    badge.textContent = 'STOPPED';
  }
}

// Stats update
const _elementCache = new Map();
const getEl = (id) => {
  if (!_elementCache.has(id)) _elementCache.set(id, document.getElementById(id));
  return _elementCache.get(id);
};

function updateStats(stats) {
  // Keep lite backend indicator in sync with real backend (robust even if IPC event was missed).
  try {
    const resolved = stats?.minerBackendResolved;
    if (typeof resolved === 'string' && resolved.trim()) {
      const next = resolved.trim().toLowerCase();
      if (next !== resolvedMinerBackend) resolvedMinerBackend = next;
    }
  } catch {
    // ignore
  }
  try {
    const preferred = stats?.minerBackendPreferred;
    if (typeof preferred === 'string' && preferred.trim()) {
      const next = preferred.trim().toLowerCase();
      if (next !== resolvedMinerBackendPreferred) resolvedMinerBackendPreferred = next;
    }
  } catch {
    // ignore
  }
  try {
    const lastError = stats?.minerBackendLastError;
    if (typeof lastError === 'string') {
      const next = lastError.trim();
      if (next !== resolvedMinerBackendLastError) resolvedMinerBackendLastError = next;
    }
  } catch {
    // ignore
  }
  renderBackendUi();

  const setText = (id, text) => {
    const el = getEl(id);
    const next = String(text);
    if (el && el.textContent !== next) el.textContent = next;
    return el;
  };

  const setHtml = (el, html) => {
    if (el && el.innerHTML !== html) el.innerHTML = html;
  };

  // ═══ Hashrate (primary) ═══
  const formatted = formatHashrate(stats.hashrate);
  setText('hashrate-value', formatted.value);
  const unitEl = getEl('hashrate-unit');
  if (unitEl) {
    const nextUnit = hashrateUnitMode === 'auto' ? formatted.unit : hashrateUnitMode;
    if (unitEl.textContent !== nextUnit) unitEl.textContent = nextUnit;
  }

  // Rolling hashrate windows (10s / 60s / 15m / max)
  const fmtHr = (v) => {
    if (!v || !Number.isFinite(v) || v <= 0) return '—';
    if (v >= 1e12) return (v / 1e12).toFixed(2) + ' TH/s';
    if (v >= 1e9) return (v / 1e9).toFixed(2) + ' GH/s';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + ' MH/s';
    if (v >= 1e3) return (v / 1e3).toFixed(2) + ' kH/s';
    return v.toFixed(1) + ' H/s';
  };
  setText('hr-10s', fmtHr(stats.hashrate_10s));
  setText('hr-60s', fmtHr(stats.hashrate_60s));
  setText('hr-15m', fmtHr(stats.hashrate_15m));
  setText('hr-max', fmtHr(stats.hashrate_max));

  // ═══ Shares ═══
  const acc = Number(stats.accepted) || 0;
  const rej = Number(stats.rejected) || 0;
  setText('shares-value', `${acc} / ${rej}`);
  setText('shares-label', `Accepted / Rejected`);
  // Accept rate
  const total = acc + rej;
  const pct = total > 0 ? ((acc / total) * 100).toFixed(1) + '%' : '—';
  setText('share-rate', pct);
  // Best share difficulty
  const fmtDiff = (d) => {
    if (!d) return '—';
    if (typeof d === 'string') return d;
    if (d >= 1e12) return (d / 1e12).toFixed(2) + 'T';
    if (d >= 1e9) return (d / 1e9).toFixed(2) + 'G';
    if (d >= 1e6) return (d / 1e6).toFixed(2) + 'M';
    if (d >= 1e3) return (d / 1e3).toFixed(2) + 'K';
    return String(Math.round(d));
  };
  setText('best-diff', fmtDiff(stats.best_share_diff));
  // Pool latency
  const lat = stats.pool_latency_ms;
  setText('pool-latency', lat && lat > 0 ? lat + ' ms' : '—');

  // ═══ Uptime ═══
  const uptimeSec = Number(stats.uptime) || 0;
  const days = Math.floor(uptimeSec / 86400);
  const hours = Math.floor((uptimeSec % 86400) / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  const seconds = uptimeSec % 60;
  const uptimeStr = days > 0
    ? `${days}d ${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`
    : `${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
  setText('uptime-value', uptimeStr);
  // Total hashes
  const fmtBig = (n) => {
    if (!n || !Number.isFinite(n) || n <= 0) return '—';
    if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'G';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  };
  setText('total-hashes', fmtBig(stats.total_hashes));
  setText('conn-count', stats.connection_count || '1');

  // ═══ Difficulty ═══
  setText('difficulty-value', fmtDiff(stats.difficulty));
  setText('pool-height', stats.last_job_height || '—');
  setText('active-algo', stats.stream_algorithm || stats.algorithm || '—');

  // ═══ Blocks Found ═══
  const blocks = Number(stats.blocks_found) || 0;
  setText('blocks-value', String(blocks));
  const blocksCard = getEl('blocks-card');
  if (blocksCard) {
    if (blocks > 0) {
      blocksCard.classList.add('has-blocks');
      setText('blocks-label', `${blocks} block${blocks > 1 ? 's' : ''} mined!`);
    } else {
      blocksCard.classList.remove('has-blocks');
      setText('blocks-label', 'Total blocks mined');
    }
  }

  // ═══ Hardware ═══
  const cpuThr = stats.cpu_threads || '—';
  setText('hw-threads', String(cpuThr));
  setText('hw-cpu-hr', fmtHr(stats.hashrate_cpu));
  setText('hw-gpu-hr', fmtHr(stats.hashrate_gpu));
  setText('hw-gpu-name', stats.gpu_info || stats.gpu_name || '—');

  // ═══ AI Afterburner — Efficiency (H/W) ═══
  {
    const gpuW  = stats.afterburner_gpu_power_w;
    const hpw   = stats.afterburner_hashrate_per_watt;
    const hint  = stats.afterburner_efficiency_hint || '';
    const util  = stats.afterburner_gpu_util_pct;
    const psrc  = stats.afterburner_power_source || '';
    const abActive = gpuW != null && gpuW > 0;

    if (abActive) {
      const hpwK = hpw ? Math.round(Number(hpw) / 1000) : 0;
      setText('ab-hpw-value', hpwK > 0 ? hpwK + ' kH/W' : '—');
      setText('ab-power-value', Math.round(Number(gpuW)) + 'W');
      setText('ab-util', util != null ? Math.round(Number(util)) + '%' : '—');
      setText('ab-source', psrc.includes('estimated') ? '~est.' : psrc || '—');
      setText('ab-hint', hint || '—');
    } else {
      setText('ab-hpw-value', '—');
      setText('ab-power-value', '—');
      setText('ab-util', '—');
      setText('ab-source', '—');
      setText('ab-hint', 'AI Afterburner initializing...');
    }

    // Logs view compact status strip
    const abStatusEl = getEl('ab-console-status');
    if (abStatusEl) {
      if (abActive && hpw) {
        const hr = stats.hashrate || stats.hashrate_10s || 0;
        const hpwK = Math.round(Number(hpw) / 1000);
        abStatusEl.textContent = `[AB] ${(Number(hr)/1e6).toFixed(1)} MH/s @ ${Math.round(Number(gpuW))}W → ${hpwK} kH/W`;
        abStatusEl.className = 'ab-strip-text ab-active';
      } else {
        abStatusEl.textContent = '[AB] ready';
        abStatusEl.className = 'ab-strip-text';
      }
    }
  }

    // Update ab-settings-status in Engine settings panel
    const abSetSt = getEl('ab-settings-status');
    if (abSetSt) {
      const gpuW = stats.afterburner_gpu_power_w;
      const hpw  = stats.afterburner_hashrate_per_watt;
      if (gpuW != null && gpuW > 0 && hpw) {
        const hpwK = Math.round(Number(hpw) / 1000);
        abSetSt.textContent = `[AB] Live: ${Math.round(Number(gpuW))}W \u2192 ${hpwK} kH/W  [${stats.afterburner_power_source || 'estimated'}]`;
        abSetSt.style.color = '#fbbf24';
      } else if (stats.afterburner_status) {
        abSetSt.textContent = `[AB] ${stats.afterburner_status}`;
        abSetSt.style.color = '#a0c8b0';
      } else {
        abSetSt.textContent = '[AB] initializing...';
        abSetSt.style.color = '#a0c8b0';
      }
    }

  // ---- CH3 Stream / GPU / Revenue ----
  updateCH3Dashboard(stats);

  // ---- Mining Console status dot ----
  updateConsoleDot(!!stats?.isRunning);
  
  // Log significant events (once per milestone)
  // NOTE: UI can load with stale stats from previous runs; don't emit milestones on first read.
  if (!stats?.isRunning) {
    // When stopped, keep milestone tracking uninitialized so we don't replay
    // milestones based on stale counters.
    milestoneInitialized = false;
  } else if (!milestoneInitialized) {
    lastAcceptedForMilestone = Number.isFinite(stats.accepted) ? stats.accepted : 0;
    lastMilestoneBucket = Math.floor(lastAcceptedForMilestone / 10);
    milestoneInitialized = true;
  } else {
    const acceptedNow = Number.isFinite(stats.accepted) ? stats.accepted : 0;

    // New session / reset (accepted counters dropped)
    if (acceptedNow < lastAcceptedForMilestone) {
      lastAcceptedForMilestone = acceptedNow;
      lastMilestoneBucket = Math.floor(acceptedNow / 10);
    } else if (acceptedNow > lastAcceptedForMilestone) {
      const milestoneBucket = Math.floor(acceptedNow / 10);
      if (milestoneBucket > lastMilestoneBucket) {
        lastMilestoneBucket = milestoneBucket;
        const milestoneShares = milestoneBucket * 10;
        if (milestoneShares > 0) {
          addLogEntry(`Milestone: ${milestoneShares} shares accepted!`, 'info');
        }
      }
      lastAcceptedForMilestone = acceptedNow;
    }
  }
}

// Stats polling
let _pollInFlight = false;
let _lastStatsSignature = null;
let _lastIsRunning = null;
let _pendingStats = null;
let _statsRafId = null;
let _lastIpcStatsAt = 0;

const STATS_POLL_VISIBLE_MS = 6000;
const STATS_POLL_VISIBLE_IPC_ACTIVE_MS = 12000;
const STATS_POLL_HIDDEN_MS = 15000;

function computeStatsPollDelay() {
  if (document.hidden) return STATS_POLL_HIDDEN_MS;
  const now = Date.now();
  const ipcFresh = _lastIpcStatsAt > 0 && (now - _lastIpcStatsAt) < 5000;
  return ipcFresh ? STATS_POLL_VISIBLE_IPC_ACTIVE_MS : STATS_POLL_VISIBLE_MS;
}

function buildStatsSignature(stats) {
  if (!stats) return '';
  return [
    stats.hashrate,
    stats.hashrate_10s,
    stats.hashrate_60s,
    stats.hashrate_15m,
    stats.hashrate_max,
    stats.hashrate_cpu,
    stats.hashrate_gpu,
    stats.accepted,
    stats.rejected,
    stats.shares,
    stats.uptime,
    stats.difficulty,
    stats.blocks_found,
    stats.pool_latency_ms,
    stats.stream_algorithm,
    stats.afterburner_tasks_per_sec,
    stats.afterburner_utilization_pct
  ].join('|');
}

function scheduleStatsUpdate(stats) {
  if (!stats) return;
  _pendingStats = stats;
  if (_statsRafId) return;
  _statsRafId = requestAnimationFrame(() => {
    _statsRafId = null;
    const s = _pendingStats;
    _pendingStats = null;
    if (!s) return;

    const signature = buildStatsSignature(s);
    if (signature !== _lastStatsSignature) {
      _lastStatsSignature = signature;
      updateStats(s);
    }

    if (s.isRunning !== _lastIsRunning) {
      _lastIsRunning = s.isRunning;
      isRunning = s.isRunning;
      updateControlButtons();
      updateStatusBadge(s.isRunning ? 'mining' : 'stopped');
    }
  });
}

async function pollStats() {
  if (_pollInFlight) {
    setTimeout(pollStats, computeStatsPollDelay());
    return;
  }

  // If push updates are flowing, avoid redundant IPC invoke polling.
  if (!document.hidden && _lastIpcStatsAt > 0 && (Date.now() - _lastIpcStatsAt) < 2500) {
    setTimeout(pollStats, computeStatsPollDelay());
    return;
  }

  _pollInFlight = true;
  try {
    const stats = await window.electronAPI.getStats();
    scheduleStatsUpdate(stats);
  } finally {
    _pollInFlight = false;
    setTimeout(pollStats, computeStatsPollDelay());
  }
}

// Log viewer
let _logQueue = [];
let _logFlushScheduled = false;
const _maxLogQueue = 100;

function addLogEntry(message, type = 'info') {
  const logViewer = document.getElementById('log-viewer');
  if (!logViewer) return;

  const timestamp = new Date().toLocaleTimeString();
  _logQueue.push({ timestamp, message, type });
  if (_logQueue.length > _maxLogQueue) {
    _logQueue.splice(0, _logQueue.length - _maxLogQueue);
  }

  if (_logFlushScheduled) return;
  _logFlushScheduled = true;

  requestAnimationFrame(() => {
    _logFlushScheduled = false;
    const viewer = document.getElementById('log-viewer');
    if (!viewer) {
      _logQueue = [];
      return;
    }

    // Only auto-scroll if the user is already at the bottom.
    const atBottom = (viewer.scrollTop + viewer.clientHeight) >= (viewer.scrollHeight - 12);

    const frag = document.createDocumentFragment();
    for (const item of _logQueue) {
      const entry = document.createElement('div');
      entry.className = `log-entry ${item.type}`;
      entry.textContent = `[${item.timestamp}] ${item.message}`;
      frag.appendChild(entry);
    }
    _logQueue = [];

    viewer.appendChild(frag);

    // Keep only last 40 entries (reduced from 80 for perf)
    while (viewer.children.length > 40) {
      viewer.removeChild(viewer.firstChild);
    }

    if (atBottom) viewer.scrollTop = viewer.scrollHeight;
  });
}

// Wallet management
let generatedWallet = null;
let lastPoolPaidAtomic = null;

function setupWalletControls() {
  const generateBtn = document.getElementById('generate-wallet-btn');
  const saveBtn = document.getElementById('save-wallet-btn');
  const cancelBtn = document.getElementById('cancel-wallet-btn');
  const copyAddressBtn = document.getElementById('copy-address-btn');
  const refreshWalletsBtn = document.getElementById('refresh-wallets-btn');
  const importBtn = document.getElementById('import-wallet-btn');

  // Wallet actions UI
  const activeWalletInput = document.getElementById('active-wallet-address');
  const setActiveWalletBtn = document.getElementById('set-active-wallet-btn');
  const refreshBalanceBtn = document.getElementById('refresh-balance-btn');
  const walletBalanceEl = document.getElementById('wallet-balance');
  const walletBalanceStatusEl = document.getElementById('wallet-balance-status');
  const generateQrBtn = document.getElementById('generate-qr-btn');
  const receiveQrImg = document.getElementById('receive-qr-img');
  const receiveQrPlaceholder = document.getElementById('receive-qr-placeholder');
  const receiveQrStatusEl = document.getElementById('receive-qr-status');
  const sendToEl = document.getElementById('send-to-address');
  const sendAmountEl = document.getElementById('send-amount');
  const sendPurposeEl = document.getElementById('send-purpose');
  const sendMemoEl = document.getElementById('send-memo');
  const sendTxBtn = document.getElementById('send-tx-btn');
  const sendStatusEl = document.getElementById('send-status');
  const sendFromDisplay = document.getElementById('send-from-display');
  const sendFromBalance = document.getElementById('send-from-balance');
  const sendFromBalanceStatus = document.getElementById('send-from-balance-status');
  const sendNoWalletWarn = document.getElementById('send-no-wallet-warn');
  const sendRefreshFromBtn = document.getElementById('send-refresh-from-btn');

  const getRpcUrl = () => {
    let url = (config?.rpcUrl || DEFAULT_RPC_URL).trim();
    // Ensure /jsonrpc path is present (common misconfiguration: port without path)
    if (url && !url.endsWith('/jsonrpc') && /:\d+\/?$/.test(url)) {
      url = url.replace(/\/+$/, '') + '/jsonrpc';
    }
    return url;
  };
  const getActiveAddress = () => {
    const v = activeWalletInput && 'value' in activeWalletInput ? activeWalletInput.value : '';
    return (v || config.wallet || '').toString().trim();
  };

  // ── Refresh "from" address display + balance in the Send tab ──
  const refreshSendFrom = async () => {
    // Always re-read config so we pick up wallet changes made after init
    try {
      const freshCfg = await window.electronAPI.getConfig();
      if (freshCfg?.wallet) config.wallet = freshCfg.wallet;
      if (freshCfg?.rpcUrl) config.rpcUrl = freshCfg.rpcUrl;
    } catch { /* keep cached */ }

    const addr = getActiveAddress();
    const hasWallet = !!(addr && addr.startsWith('zion1'));

    if (sendFromDisplay) sendFromDisplay.textContent = hasWallet ? addr : '— not configured —';
    if (sendNoWalletWarn) sendNoWalletWarn.style.display = hasWallet ? 'none' : 'block';
    if (sendFromBalance) sendFromBalance.textContent = '…';
    if (sendFromBalanceStatus) sendFromBalanceStatus.textContent = '';

    if (!hasWallet) return;

    if (sendFromBalanceStatus) sendFromBalanceStatus.textContent = 'loading…';
    try {
      const result = await window.electronAPI.walletGetBalance({ rpcUrl: getRpcUrl(), address: addr });
      if (result?.success) {
        const bal = result.balance_zion ?? (result.balance_atomic != null ? result.balance_atomic / 1e6 : null);
        if (sendFromBalance) sendFromBalance.textContent = bal != null ? `${bal.toFixed(6)} ZION` : 'n/a';
        if (sendFromBalanceStatus) sendFromBalanceStatus.textContent = '';
      } else {
        if (sendFromBalance) sendFromBalance.textContent = '—';
        if (sendFromBalanceStatus) sendFromBalanceStatus.textContent = result?.error || 'error';
      }
    } catch (e) {
      if (sendFromBalance) sendFromBalance.textContent = '—';
      if (sendFromBalanceStatus) sendFromBalanceStatus.textContent = 'network error';
    }
  };

  // Refresh button in Send tab
  sendRefreshFromBtn?.addEventListener('click', refreshSendFrom);

  // Auto-refresh when switching to the Send tab
  document.querySelector('.section-tab[data-section="wallet-send"]')
    ?.addEventListener('click', () => { setTimeout(refreshSendFrom, 80); });

  const syncActiveWallet = () => {
    if (activeWalletInput && 'value' in activeWalletInput) {
      activeWalletInput.value = (config.wallet || '').toString();
    }
    // Also sync into the Receive section tab
    const recvAddr = document.getElementById('receive-wallet-address');
    if (recvAddr) recvAddr.value = (config.wallet || '').toString();
  };

  // Generate wallet
  generateBtn?.addEventListener('click', async () => {
    const name = document.getElementById('new-wallet-name').value;
    const password = document.getElementById('new-wallet-password').value;
    const passwordConfirm = document.getElementById('new-wallet-password-confirm').value;

    if (!name) {
      alert('Please enter a wallet name');
      return;
    }

    if (!password || password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    if (password !== passwordConfirm) {
      alert('Passwords do not match');
      return;
    }

    // Generate wallet
    const result = await window.electronAPI.generateWallet();
    
    if (result.success) {
      generatedWallet = result.wallet;
      
      // Show wallet display
      document.getElementById('wallet-generator').style.display = 'none';
      document.getElementById('wallet-display').style.display = 'block';
      
      // Fill in generated data
      document.getElementById('generated-address').value = generatedWallet.address;
      document.getElementById('generated-mnemonic').value = generatedWallet.mnemonic;
      
      addLogEntry(`New wallet generated: ${generatedWallet.address}`, 'info');
    } else {
      alert(`Wallet generation failed: ${result.error}`);
    }
  });

  // Copy address to clipboard
  copyAddressBtn?.addEventListener('click', () => {
    const address = document.getElementById('generated-address').value;
    navigator.clipboard.writeText(address);
    
      const copyAddressOriginalHtml = copyAddressBtn?.innerHTML;
      if (copyAddressBtn) {
        copyAddressBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-check"></use></svg><span>Copied!</span>';
      }
    setTimeout(() => {
        if (copyAddressBtn) {
          copyAddressBtn.innerHTML = copyAddressOriginalHtml || '<span>Copy</span>';
        }
    }, 2000);
  });

  // Save wallet
  saveBtn?.addEventListener('click', async () => {
    const name = document.getElementById('new-wallet-name').value;
    const password = document.getElementById('new-wallet-password').value;

    const result = await window.electronAPI.saveWallet({
      wallet: generatedWallet,
      password,
      name
    });

    if (result.success) {
      alert('Wallet saved successfully!\n\nMake sure you have written down your recovery phrase!');
      
      // Reset form
      document.getElementById('wallet-generator').style.display = 'block';
      document.getElementById('wallet-display').style.display = 'none';
      document.getElementById('new-wallet-name').value = 'My Wallet';
      document.getElementById('new-wallet-password').value = '';
      document.getElementById('new-wallet-password-confirm').value = '';
      generatedWallet = null;
      
      // Reload wallets list
      loadWalletsList();
      addLogEntry('Wallet saved successfully', 'info');
    } else {
      alert(`Failed to save wallet: ${result.error}`);
    }
  });

  // Cancel wallet creation
  cancelBtn?.addEventListener('click', () => {
    if (confirm('Are you sure? The wallet will not be saved!')) {
      document.getElementById('wallet-generator').style.display = 'block';
      document.getElementById('wallet-display').style.display = 'none';
      generatedWallet = null;
    }
  });

  // Refresh wallets
  refreshWalletsBtn?.addEventListener('click', () => {
    loadWalletsList();
  });

  // Import wallet
  importBtn?.addEventListener('click', async () => {
    const mnemonic = document.getElementById('import-mnemonic').value.trim();
    const name = document.getElementById('import-wallet-name').value;
    const password = document.getElementById('import-wallet-password').value;

    if (!mnemonic || !name || !password) {
      alert('Please fill in all fields');
      return;
    }

    const result = await window.electronAPI.importWallet({ mnemonic, name, password });
    
    if (result.success) {
      alert('Wallet imported successfully!');
      document.getElementById('import-mnemonic').value = '';
      document.getElementById('import-wallet-name').value = '';
      document.getElementById('import-wallet-password').value = '';
      loadWalletsList();
    } else {
      alert(`Import failed: ${result.error}`);
    }
  });

  // Load wallets on wallet view switch
  loadWalletsList();

  // Seed wallet actions with current config
  syncActiveWallet();

  // Populate the Send-tab "From" display on startup
  refreshSendFrom();

  setActiveWalletBtn?.addEventListener('click', async () => {
    const address = getActiveAddress();
    if (!address) {
      alert('Enter a zion1... address');
      return;
    }

    const check = await window.electronAPI.validateAddress(address);
    if (check?.type === 'legacy') {
      alert('This is a legacy ZION... address. The chain only credits zion1... addresses.\n\nCreate/select a zion1... wallet and use that.');
      return;
    }
    if (!check?.valid) {
      alert('Invalid address. Expected zion1...');
      return;
    }

    config.wallet = address;
    await window.electronAPI.saveConfig(config);
    updateSettingsUI();
    addLogEntry(`Active wallet set: ${address}`, 'info');
    alert(`Active wallet set:\n\n${address}`);
    refreshSendFrom(); // update the Send tab from-address display
  });

  refreshBalanceBtn?.addEventListener('click', async () => {
    const address = getActiveAddress();
    if (!address) {
      if (walletBalanceStatusEl) walletBalanceStatusEl.textContent = 'No wallet address configured. Set wallet in Settings first.';
      return;
    }
    if (walletBalanceStatusEl) walletBalanceStatusEl.textContent = 'Loading...';

    const check = await window.electronAPI.validateAddress(address);
    if (!check?.valid) {
      if (walletBalanceStatusEl) walletBalanceStatusEl.textContent = 'Set a valid zion1... address first. Current: ' + (address.slice(0, 20) || '(empty)') + '...';
      return;
    }

    const result = await window.electronAPI.walletGetBalance({
      rpcUrl: getRpcUrl(),
      address
    });

    if (!result?.success) {
      const tried = Array.isArray(result?.rpc_tried) ? result.rpc_tried : [];
      const triedHosts = tried.slice(0, 3).map((u) => {
        try { return new URL(u).hostname; } catch { return u; }
      }).filter(Boolean).join(', ');
      const triedText = triedHosts ? ` · tried: ${triedHosts}` : '';
      if (walletBalanceStatusEl) walletBalanceStatusEl.textContent = `Error: ${result?.error || 'balance fetch failed'}${triedText}`;
      return;
    }

    if (walletBalanceEl) walletBalanceEl.textContent = Number(result.balance ?? 0).toFixed(6);
    // UTXO count
    const utxoEl = document.getElementById('wallet-utxo-count');
    if (utxoEl) utxoEl.textContent = Number(result.utxo_count ?? 0).toLocaleString();
    // Pool stats
    const poolPendingEl = document.getElementById('pool-pending-balance');
    const poolPaidEl = document.getElementById('pool-paid-balance');
    const poolSharesEl = document.getElementById('pool-shares-count');
    const poolBlocksEl = document.getElementById('pool-blocks-count');
    const poolHashrateEl = document.getElementById('pool-hashrate-1h');
    const poolLastShareEl = document.getElementById('pool-last-share');
    const poolPendingTxEl = document.getElementById('pool-pending-tx-count');
    const poolSourceEl = document.getElementById('pool-source-info');
    if (poolPendingEl) poolPendingEl.textContent = Number(result.pool_pending ?? 0).toFixed(4) + ' ZION';
    if (poolPaidEl) poolPaidEl.textContent = Number(result.pool_paid ?? 0).toFixed(4) + ' ZION';
    if (poolSharesEl) poolSharesEl.textContent = Number(result.pool_shares ?? 0).toLocaleString();
    if (poolBlocksEl) poolBlocksEl.textContent = Number(result.pool_blocks ?? 0).toLocaleString();
    if (poolPendingTxEl) poolPendingTxEl.textContent = Number(result.pool_pending_txs ?? 0).toLocaleString();
    // Format hashrate (H/s → kH/s → MH/s)
    const hr = Number(result.pool_hashrate_1h ?? 0);
    if (poolHashrateEl) {
      poolHashrateEl.textContent = hr >= 1e6 ? (hr / 1e6).toFixed(2) + ' MH/s'
        : hr >= 1e3 ? (hr / 1e3).toFixed(1) + ' kH/s'
        : hr.toFixed(0) + ' H/s';
    }
    // Format last share timestamp
    if (poolLastShareEl) {
      const ts = Number(result.pool_last_share ?? 0);
      poolLastShareEl.textContent = ts > 0
        ? new Date(ts * 1000).toLocaleTimeString()
        : 'never';
    }

    if (poolSourceEl) {
      const source = result.pool_source || 'n/a';
      const pendingSrc = result.pool_pending_source || 'stats';
      poolSourceEl.textContent = `Pool source: ${source} · pending from ${pendingSrc}`;
    }

    let payoutDeltaText = '';
    const currentPaidAtomic = Number(result.pool_paid_atomic ?? 0);
    if (Number.isFinite(currentPaidAtomic) && currentPaidAtomic >= 0) {
      if (Number.isFinite(lastPoolPaidAtomic) && currentPaidAtomic > lastPoolPaidAtomic) {
        const delta = (currentPaidAtomic - lastPoolPaidAtomic) / 1_000_000;
        payoutDeltaText = ` · payout +${delta.toFixed(4)} ZION`;
      }
      lastPoolPaidAtomic = currentPaidAtomic;
    }

    let pendingDriftText = '';
    const pendingStatsAtomic = Number(result.pool_pending_stats_atomic ?? 0);
    const pendingPayoutsAtomic = Number(result.pool_pending_payouts_atomic ?? 0);
    if (Number.isFinite(pendingStatsAtomic) && Number.isFinite(pendingPayoutsAtomic) && pendingStatsAtomic !== pendingPayoutsAtomic) {
      pendingDriftText = ` · pending drift ${(pendingStatsAtomic / 1_000_000).toFixed(4)}↔${(pendingPayoutsAtomic / 1_000_000).toFixed(4)}`;
    }

    const rpcSourceText = (() => {
      try {
        const source = String(result.rpc_source || '').trim();
        if (!source) return '';
        const u = new URL(source);
        return ` · rpc ${u.hostname}`;
      } catch {
        return '';
      }
    })();

    const rpcFallbackText = (() => {
      const tried = Array.isArray(result?.rpc_tried) ? result.rpc_tried : [];
      return tried.length > 1 ? ` · failover ${tried.length}x` : '';
    })();

    if (walletBalanceStatusEl) walletBalanceStatusEl.textContent = `OK · ${new Date().toLocaleTimeString()}${rpcSourceText}${rpcFallbackText}${payoutDeltaText}${pendingDriftText}`;
  });

  generateQrBtn?.addEventListener('click', async () => {
    const address = getActiveAddress();
    if (receiveQrStatusEl) receiveQrStatusEl.textContent = 'Generating...';

    const check = await window.electronAPI.validateAddress(address);
    if (!check?.valid) {
      if (receiveQrStatusEl) receiveQrStatusEl.textContent = 'Set a valid zion1... address first.';
      return;
    }

    const result = await window.electronAPI.walletGenerateQr({ text: address });
    if (!result?.success) {
      if (receiveQrStatusEl) receiveQrStatusEl.textContent = `Error: ${result?.error || 'QR failed'}`;
      return;
    }

    if (receiveQrImg) {
      receiveQrImg.src = result.dataUrl;
      receiveQrImg.style.display = 'block';
    }
    if (receiveQrPlaceholder) receiveQrPlaceholder.style.display = 'none';
    if (receiveQrStatusEl) receiveQrStatusEl.textContent = 'OK';
  });

  // ── Receive section tab handlers ──
  const receiveWalletAddr = document.getElementById('receive-wallet-address');
  const copyReceiveAddrBtn = document.getElementById('copy-receive-address-btn');
  const generateReceiveQrBtn = document.getElementById('generate-receive-qr-btn');
  const receiveSectionQrImg = document.getElementById('receive-section-qr-img');
  const receiveSectionQrPlaceholder = document.getElementById('receive-section-qr-placeholder');
  const receiveSectionQrStatus = document.getElementById('receive-section-qr-status');

  copyReceiveAddrBtn?.addEventListener('click', () => {
    const addr = getActiveAddress();
    if (addr) {
      navigator.clipboard.writeText(addr);
      addLogEntry('Address copied to clipboard', 'info');
    }
  });

  generateReceiveQrBtn?.addEventListener('click', async () => {
    const address = getActiveAddress();
    if (receiveSectionQrStatus) receiveSectionQrStatus.textContent = 'Generating...';
    if (receiveWalletAddr) receiveWalletAddr.value = address;

    const check = await window.electronAPI.validateAddress(address);
    if (!check?.valid) {
      if (receiveSectionQrStatus) receiveSectionQrStatus.textContent = 'Set a valid zion1... address first (Overview tab).';
      return;
    }

    const result = await window.electronAPI.walletGenerateQr({ text: address });
    if (!result?.success) {
      if (receiveSectionQrStatus) receiveSectionQrStatus.textContent = `Error: ${result?.error || 'QR failed'}`;
      return;
    }

    if (receiveSectionQrImg) {
      receiveSectionQrImg.src = result.dataUrl;
      receiveSectionQrImg.style.display = 'block';
    }
    if (receiveSectionQrPlaceholder) receiveSectionQrPlaceholder.style.display = 'none';
    if (receiveSectionQrStatus) receiveSectionQrStatus.textContent = '';
  });

  sendTxBtn?.addEventListener('click', async () => {
    if (sendStatusEl) sendStatusEl.textContent = '';

    // Refresh config + from-address display before sending
    await refreshSendFrom();

    const from = getActiveAddress();
    const to = (sendToEl && 'value' in sendToEl ? sendToEl.value : '').toString().trim();
    const amountRaw = (sendAmountEl && 'value' in sendAmountEl ? sendAmountEl.value : '').toString().trim();
    const purpose = (sendPurposeEl && 'value' in sendPurposeEl ? sendPurposeEl.value : '').toString();
    const memo = (sendMemoEl && 'value' in sendMemoEl ? sendMemoEl.value : '').toString().trim();

    // Validate from
    if (!from || !from.startsWith('zion1')) {
      if (sendStatusEl) sendStatusEl.textContent = '⚠ No active wallet. Go to Overview tab → set your wallet address.';
      if (sendNoWalletWarn) sendNoWalletWarn.style.display = 'block';
      return;
    }

    // Validate to
    if (!to || !to.startsWith('zion1')) {
      if (sendStatusEl) sendStatusEl.textContent = '⚠ Recipient address must be a valid zion1... address.';
      return;
    }

    // Validate amount
    const parsedAmount = parseFloat(amountRaw.replace(',', '.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      if (sendStatusEl) sendStatusEl.textContent = '⚠ Enter a valid amount greater than 0.';
      return;
    }

    if (from === to) {
      if (sendStatusEl) sendStatusEl.textContent = '⚠ Cannot send to yourself.';
      return;
    }

    if (sendStatusEl) sendStatusEl.textContent = '⏳ Confirming…';

    const result = await window.electronAPI.walletSendTransaction({
      rpcUrl: getRpcUrl(),
      from,
      to,
      amount: parsedAmount,
      purpose,
      memo: memo || undefined
    });

    if (!result?.success) {
      const err = result?.error || 'send failed';
      const hint = err.includes('Insufficient') ? ' (check your balance)' : err.includes('RPC') ? ' (node unreachable — try again)' : '';
      if (sendStatusEl) sendStatusEl.textContent = `❌ ${err}${hint}`;
      return;
    }

    if (sendStatusEl) sendStatusEl.textContent = `✅ Sent! Status: ${result.status || 'submitted'} · TX: ${result.txId || 'n/a'}`;
    if (sendToEl) sendToEl.value = '';
    if (sendAmountEl) sendAmountEl.value = '';
    if (sendPurposeEl) sendPurposeEl.value = '';
    if (sendMemoEl) sendMemoEl.value = '';
    // Refresh balance after successful send
    setTimeout(refreshSendFrom, 1500);
  });

  // Transaction lookup
  const txLookupBtn = document.getElementById('tx-lookup-btn');
  const txLookupIdEl = document.getElementById('tx-lookup-id');
  const txLookupResultEl = document.getElementById('tx-lookup-result');

  txLookupBtn?.addEventListener('click', async () => {
    const txid = (txLookupIdEl && 'value' in txLookupIdEl ? txLookupIdEl.value : '').toString().trim();
    if (!txid) {
      if (txLookupResultEl) { txLookupResultEl.style.display = 'block'; txLookupResultEl.textContent = 'Enter a transaction ID first.'; }
      return;
    }
    if (txLookupResultEl) { txLookupResultEl.style.display = 'block'; txLookupResultEl.textContent = 'Loading...'; }

    const result = await window.electronAPI.walletGetTransaction({
      rpcUrl: getRpcUrl(),
      txid
    });

    if (!result?.success) {
      if (txLookupResultEl) txLookupResultEl.textContent = `Error: ${result?.error || 'lookup failed'}`;
      return;
    }

    // Pretty-print the tx data
    const tx = result.transaction || result;
    if (txLookupResultEl) txLookupResultEl.textContent = JSON.stringify(tx, null, 2);
  });
}

async function loadWalletsList() {
  const result = await window.electronAPI.listWallets();
  const container = document.getElementById('wallets-list');

  const wallets = Array.isArray(result?.wallets) ? result.wallets : [];
  if (!result?.success || wallets.length === 0) {
    if (result?.success === false && result?.error) {
      addLogEntry(`Wallet list error: ${result.error}`, 'error');
    }
    container.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center; padding: 40px;">No wallets yet. Create one above!</p>';
    return;
  }

  // Build wallets list HTML
  // AUDIT-FIX E-02 (16 Feb 2026): escape wallet.name and wallet.address to prevent XSS
  const html = wallets.map(wallet => {
    const safeName = escapeHtml(wallet.name);
    const safeAddr = escapeHtml(wallet.address);
    const safeDate = escapeHtml(new Date(wallet.createdAt).toLocaleDateString());
    const safeLastUsed = wallet.lastUsed ? escapeHtml(new Date(wallet.lastUsed).toLocaleDateString()) : 'Never';
    return `
    <div style="padding: 20px; background: rgba(0,0,0,0.5); border: 1px solid rgba(147,51,234,0.2); border-radius: 12px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
        <div>
          <h3 style="color: var(--zion-gold); margin-bottom: 8px; font-size: 18px;">${safeName}</h3>
          <p style="color: rgba(255,255,255,0.7); font-family: monospace; font-size: 13px; word-break: break-all;">${safeAddr}</p>
        </div>
      </div>
      <div style="display: flex; gap: 8px; font-size: 12px; color: rgba(255,255,255,0.5);">
        <span>Created: ${safeDate}</span>
        <span>•</span>
        <span>Last used: ${safeLastUsed}</span>
      </div>
      <div style="margin-top: 16px; display: flex; gap: 8px;">
        <button class="btn btn-primary" onclick="useWallet('${safeAddr}')" style="width: auto; padding: 10px 16px; font-size: 13px;">
           <svg class="icon" aria-hidden="true"><use href="#i-check"></use></svg>
           <span>Use for Mining</span>
        </button>
        <button class="btn" onclick="copyWalletAddress('${safeAddr}')" style="width: auto; padding: 10px 16px; font-size: 13px; background: rgba(147,51,234,0.2); border: 1px solid var(--zion-purple);">
           <svg class="icon" aria-hidden="true"><use href="#i-copy"></use></svg>
           <span>Copy Address</span>
        </button>
      </div>
    </div>
  `}).join('');

  container.innerHTML = html;
}

// Global functions for wallet actions
window.useWallet = async (address) => {
  const check = await window.electronAPI.validateAddress(address);
  if (check?.type === 'legacy') {
    alert('This is a legacy ZION... address. The chain only credits zion1... addresses.\n\nCreate/select a zion1... wallet and use that.');
    return;
  }
  if (!check?.valid) {
    alert('Invalid address. Expected zion1...');
    return;
  }

  // Update config with wallet address
  const freshConfig = await window.electronAPI.getConfig();
  freshConfig.wallet = address;
  await window.electronAPI.saveConfig(freshConfig);

  // Keep renderer state in sync
  config.wallet = address;

  const activeWalletInput = document.getElementById('active-wallet-address');
  if (activeWalletInput && 'value' in activeWalletInput) {
    activeWalletInput.value = address;
  }

  alert(`Wallet set for mining!\n\nAddress: ${address}`);
  
  // Update settings UI if on that view
  updateSettingsUI();
};

window.copyWalletAddress = (address) => {
  navigator.clipboard.writeText(address);
  alert('Address copied to clipboard!');
};

// ============================================================================
// CH3 ARCHITECTURE FEATURES
// GPU Auto-Detection, Server Monitoring
// ============================================================================

let ch3GpuInfo = null;
let ch3ServerStatus = [];
let ch3ServerPollInterval = null;

function shouldRunNetworkPolling() {
  return currentView === 'network' && !document.hidden;
}

async function initCH3Features() {
  try {
    // GPU Detection
    await refreshGpuInfo();
    
    // Server status initial load
    await refreshServerStatus();
    
    // Server status polling (every 30s)
    ch3ServerPollInterval = setInterval(refreshServerStatus, 30000);
    
    // Refresh servers button
    const refreshBtn = document.getElementById('refresh-servers-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = 'Checking...';
        await refreshServerStatus();
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<svg class="icon icon-inline" aria-hidden="true" style="width:12px;height:12px;"><use href="#i-refresh"></use></svg> Refresh';
      });
    }

    // Stream switch event
    if (window.electronAPI.onStreamSwitch) {
      window.electronAPI.onStreamSwitch((data) => {
        dbg('[CH3] Stream switch:', data);
        updateStreamIndicator(data.mode, data.to);
      });
    }

    // ── CH3 Multi-stream status event ──────────────────────────────────────
    // Fires from main process: every 60 s (profit poll) + on coin switches
    if (typeof window.electronAPI.onMultiStreamStatus === 'function') {
      window.electronAPI.onMultiStreamStatus((status) => {
        dbg('[CH3-MULTI] status:', status);
        _lastMultiStreamStatus = status || null;
        updateMultiStreamBar(status);
      });
    }
    // Initial fetch (handles page reload while mining is active)
    if (typeof window.electronAPI.getMultiStreamStatus === 'function') {
      window.electronAPI.getMultiStreamStatus().then((status) => {
        if (status) {
          _lastMultiStreamStatus = status;
          updateMultiStreamBar(status);
        }
      }).catch(() => {});
    }
    // ──────────────────────────────────────────────────────────────────────
  } catch (err) {
    console.error('CH3 init failed:', err);
  }
}

async function refreshGpuInfo() {
  try {
    if (typeof window.electronAPI.getGpuInfo !== 'function') return;
    const info = await window.electronAPI.getGpuInfo();
    ch3GpuInfo = info;
    renderGpuBadge(info);
    renderNetworkGpuPanel(info);
  } catch (err) {
    console.error('GPU detection failed:', err);
  }
}

function renderGpuBadge(info) {
  const badge = document.getElementById('gpu-badge');
  const badgeText = document.getElementById('gpu-badge-text');
  if (!badge || !badgeText) return;

  if (info && info.available) {
    badge.className = 'gpu-badge gpu-available';
    badgeText.textContent = `GPU: ${info.name || info.type}`;
  } else {
    badge.className = 'gpu-badge cpu-only';
    badgeText.textContent = 'CPU-Only Mode';
  }
}

function renderNetworkGpuPanel(info) {
  const badge = document.getElementById('net-gpu-badge');
  const badgeText = document.getElementById('net-gpu-badge-text');
  const nameEl = document.getElementById('net-gpu-name');
  const typeEl = document.getElementById('net-gpu-type');
  const memEl = document.getElementById('net-gpu-memory');
  const modeEl = document.getElementById('net-mining-mode');

  if (info && info.available) {
    if (badge) badge.className = 'gpu-badge gpu-available';
    if (badgeText) badgeText.textContent = 'GPU Detected';
    if (nameEl) nameEl.textContent = info.name || '—';
    if (typeEl) typeEl.textContent = (info.type || '—').toUpperCase();
    if (memEl) memEl.textContent = info.memory || '—';
    if (modeEl) modeEl.textContent = 'GPU + CPU';
    if (modeEl) modeEl.style.color = '#10b981';
  } else {
    if (badge) badge.className = 'gpu-badge cpu-only';
    if (badgeText) badgeText.textContent = 'No GPU';
    if (nameEl) nameEl.textContent = 'None detected';
    if (typeEl) typeEl.textContent = 'CPU-Only';
    if (memEl) memEl.textContent = '—';
    if (modeEl) modeEl.textContent = 'CPU-Only (XMR Revenue)';
    if (modeEl) modeEl.style.color = '#f59e0b';
  }
}

function updateStreamIndicator(mode, algo) {
  const dot = document.getElementById('stream-dot');
  const modeEl = document.getElementById('stream-mode');
  const algoEl = document.getElementById('stream-algo');

  if (!dot) return;

  if (!mode || mode === '—') {
    dot.className = 'stream-dot offline';
    if (modeEl) modeEl.textContent = 'Stream: —';
    if (algoEl) algoEl.textContent = '';
    return;
  }

  dot.className = 'stream-dot';
  if (modeEl) modeEl.textContent = `Stream: ${mode}`;
  if (algoEl) algoEl.textContent = algo ? `(${algo})` : '';
}

function updateCH3Dashboard(stats) {
  const pureZionMode = isPureZionDesktopMode(config);
  // Stream indicator
  if (stats.isRunning) {
    const mode = stats.stream_mode || 'ZION';
    const algo = stats.stream_algorithm || stats.algorithm || 'cosmic_harmony';
    updateStreamIndicator(mode, algo);
  } else {
    updateStreamIndicator('—', '');
  }

  // GPU badge (from stats)
  if (stats.gpu_detected !== undefined) {
    const badge = document.getElementById('gpu-badge');
    const badgeText = document.getElementById('gpu-badge-text');
    if (badge && badgeText) {
      if (stats.gpu_detected) {
        badge.className = 'gpu-badge gpu-available';
        badgeText.textContent = `GPU: ${stats.gpu_name || stats.gpu_type || 'Available'}`;
      } else {
        badge.className = 'gpu-badge cpu-only';
        badgeText.textContent = 'CPU-Only Mode';
      }
    }
  }

  // Revenue split badge
  const splitBadge = document.getElementById('revenue-split-badge');
  const splitText = document.getElementById('revenue-split-text');
  if (splitBadge && splitText) {
    if (!pureZionMode && stats.isRunning && stats.dual_mining) {
      const zT = stats.zion_threads || 0;
      const rT = stats.xmr_threads || 0;
      const nT = stats.ncl_threads || 0;
      const alloc = stats.stream_allocation || '';
      const coin = stats.revenue_coin || 'AUTO';
      const parts = [`ZION:${zT}T`];
      if (rT > 0) parts.push(`REV:${rT}T`);
      if (nT > 0) parts.push(`NCL:${nT}T`);
      if (coin && coin !== 'AUTO') parts.push(coin);
      splitText.textContent = parts.join(' | ') + (alloc ? ` (${alloc})` : '');
      splitBadge.style.display = '';
    } else {
      splitBadge.style.display = 'none';
    }
  }

  // Multi-stream allocation bar
  if (_lastMultiStreamStatus) {
    updateMultiStreamBar(_lastMultiStreamStatus);
  }

}

/**
 * Update the CH3 multi-stream allocation bar UI.
 * Called with the multiStreamStatus payload from main process.
 * Shows: ZION 50% ▏ GPU:ETC 25% ▏ CPU:XMR 25%
 * @param {object} status - buildMultiStreamPayload() result
 */
function updateMultiStreamBar(status) {
  const bar = document.getElementById('multi-stream-bar');
  if (!bar) return;

  if (isPureZionDesktopMode(config)) {
    bar.classList.remove('active');
    return;
  }

  const zionRunning = !!(status?.zion?.running);
  const gpuRunning  = !!(status?.gpuCoin?.running);
  const cpuRunning  = !!(status?.revenueCpu?.running);
  const anyActive   = zionRunning || gpuRunning || cpuRunning;

  if (!anyActive) {
    bar.classList.remove('active');
    return;
  }

  bar.classList.add('active');

  // Update GPU coin name badge
  const gpuCoinName = String(status?.gpuCoin?.name || 'GPU').toUpperCase();
  const gpuLabelEl  = document.getElementById('ms-gpu-coin-name');
  if (gpuLabelEl) gpuLabelEl.textContent = gpuCoinName;

  // Dim labels for streams not running
  const gpuLabelRow = document.getElementById('ms-gpu-label');
  const cpuLabelRow = document.getElementById('ms-cpu-label');
  if (gpuLabelRow) gpuLabelRow.style.opacity = gpuRunning ? '1' : '0.35';
  if (cpuLabelRow) cpuLabelRow.style.opacity = cpuRunning ? '1' : '0.35';

  // Poll-source indicator (shows ⟳ when pool API is alive)
  const pollBadge = document.getElementById('ms-poll-badge');
  if (pollBadge) {
    if (status?.pollSource === 'pool-api') {
      pollBadge.style.display = '';
      pollBadge.title = 'Profit switch: pool API active';
    } else {
      pollBadge.style.display = 'none';
    }
  }
}


async function refreshServerStatus() {
  try {
    if (typeof window.electronAPI.getServerStatus !== 'function') return;
    const result = await window.electronAPI.getServerStatus();
    if (result.success && result.servers) {
      ch3ServerStatus = result.servers;
      renderServerGrid(result.servers);
    }
  } catch (err) {
    console.error('Server status refresh failed:', err);
  }
  // Heavier network telemetry only when Network tab is visible.
  if (shouldRunNetworkPolling()) {
    await refreshNetworkMetrics();
    await refreshPeerList();
  }
}

// ── Network Telemetry (lite) ───────────────────────────────────────
function formatHashrateLite(h) {
  if (h >= 1e12) return (h / 1e12).toFixed(2) + ' TH/s';
  if (h >= 1e9)  return (h / 1e9).toFixed(2)  + ' GH/s';
  if (h >= 1e6)  return (h / 1e6).toFixed(2)  + ' MH/s';
  if (h >= 1e3)  return (h / 1e3).toFixed(2)  + ' KH/s';
  return h.toFixed(0) + ' H/s';
}

async function refreshNetworkMetrics() {
  if (!shouldRunNetworkPolling()) return;
  try {
    if (typeof window.electronAPI.getNetworkMetrics !== 'function') {
      dbg('[NET-METRICS] getNetworkMetrics not available');
      return;
    }
    dbg('[NET-METRICS] Fetching...');
    const data = await window.electronAPI.getNetworkMetrics();
    dbg('[NET-METRICS] nodes:', data?.summary?.online);
    if (!data.success) {
      dbg('[NET-METRICS] not successful:', data.error);
      return;
    }
    const s = data.summary;

    // Summary cards
    const el = (id) => document.getElementById(id);
    const nodesEl = el('net-nodes-online');
    if (nodesEl) {
      nodesEl.textContent = `${s.online}/${s.total}`;
      nodesEl.style.color = s.online === s.total ? '#6ee7b7' : '#fbbf24';
    }
    const heightEl = el('net-block-height');
    if (heightEl) heightEl.textContent = s.maxHeight ? s.maxHeight.toLocaleString() : '—';
    const hrEl = el('net-hashrate');
    if (hrEl) hrEl.textContent = s.totalHashrate > 0 ? formatHashrateLite(s.totalHashrate) : '—';
    const minersEl = el('net-active-miners');
    if (minersEl) minersEl.textContent = s.totalMiners > 0 ? s.totalMiners.toString() : '0';

    // Sync bar
    const syncIcon = el('net-sync-icon');
    const syncText = el('net-sync-text');
    const syncBar  = el('net-sync-bar');
    if (syncBar) {
      if (s.online === 0) {
        syncIcon.textContent = '✗';
        syncText.textContent = 'All nodes offline';
        syncText.style.color = '#f87171';
        syncBar.style.borderColor = 'rgba(248,113,113,0.3)';
      } else if (s.inSync) {
        syncIcon.textContent = '✓';
        syncText.textContent = `Network Synchronized — ${s.online}/${s.total} nodes in consensus`;
        syncText.style.color = '#6ee7b7';
        syncBar.style.borderColor = 'rgba(16,185,129,0.3)';
      } else {
        syncIcon.textContent = '!';
        syncText.textContent = `Synchronizing... (${s.online}/${s.total} online)`;
        syncText.style.color = '#fbbf24';
        syncBar.style.borderColor = 'rgba(251,191,36,0.3)';
      }
    }

    // Per-node rows — AUDIT-FIX E-02 (16 Feb 2026): escape n.name, n.host
    const nodeList = el('net-node-list');
    if (nodeList) {
      nodeList.innerHTML = data.nodes.map(n => {
        const dot = n.online
          ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 6px #22c55e;"></span>'
          : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;"></span>';
        const hr = n.hashrate > 0 ? formatHashrateLite(n.hashrate) : '—';
        const safeName = escapeHtml(String(n.name || ''));
        const safeHost = escapeHtml(String(n.host || ''));
        const safeFlag = escapeHtml(String(n.flag || ''));
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(0,0,0,0.3);border-radius:8px;border:1px solid rgba(255,255,255,0.06);">
          <div style="display:flex;align-items:center;gap:10px;">
            ${dot}
            <span style="font-weight:600;">${safeFlag} ${safeName}</span>
            <span style="font-size:11px;color:rgba(255,255,255,0.35);font-family:monospace;">${safeHost}</span>
          </div>
          <div style="display:flex;gap:16px;font-size:12px;color:rgba(255,255,255,0.55);">
            <span>H: <b style="color:#93c5fd;">${n.height ? n.height.toLocaleString() : '—'}</b></span>
            <span>M: <b style="color:#fcd34d;">${n.miners}</b></span>
            <span style="color:#c4b5fd;font-family:monospace;">${hr}</span>
          </div>
        </div>`;
      }).join('');
    }

    // Timestamp
    const tsEl = el('net-telemetry-updated');
    if (tsEl) tsEl.textContent = '⟳ ' + new Date().toLocaleTimeString();

  } catch (err) {
    console.error('Network metrics refresh failed:', err);
  }
}

// ── P2P Peer Discovery Panel ───────────────────────────────────────
async function refreshPeerList() {
  if (!shouldRunNetworkPolling()) return;
  try {
    if (typeof window.electronAPI.getPeerList !== 'function') {
      dbg('[PEERS] getPeerList not available');
      return;
    }
    dbg('[PEERS] Fetching...');
    const data = await window.electronAPI.getPeerList();
    dbg('[PEERS]', data.count, 'peers,', data.connected, 'connected');

    const el = (id) => document.getElementById(id);

    // Summary cards
    const connEl = el('net-peers-connected');
    if (connEl) {
      connEl.textContent = data.connected || 0;
      connEl.style.color = data.connected > 0 ? '#6ee7b7' : '#f87171';
    }
    const knownEl = el('net-peers-known');
    if (knownEl) knownEl.textContent = data.count || 0;

    // Timestamp
    const updEl = el('net-peers-updated');
    if (updEl) updEl.textContent = '⟳ ' + new Date().toLocaleTimeString();

    // Peer list
    const listEl = el('net-peer-list');
    if (!listEl) return;

    if (!data.success || !data.peers || data.peers.length === 0) {
      listEl.innerHTML = `<div style="text-align:center; color:rgba(255,255,255,0.35); font-size:13px; padding:20px;">
        <div style="font-size:20px; margin-bottom:8px;">◈</div>
        No peers discovered yet. Daemon will find peers after deployment.
      </div>`;
      return;
    }

    // AUDIT-FIX E-02 (16 Feb 2026): escape peer host/address/source_node
    listEl.innerHTML = data.peers.map(p => {
      const isConn = p.connected;
      const dotColor = isConn ? '#22c55e' : '#6b7280';
      const dotShadow = isConn ? 'box-shadow:0 0 6px #22c55e;' : '';
      const borderColor = isConn ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)';
      const bgColor = isConn ? 'rgba(16,185,129,0.05)' : 'rgba(0,0,0,0.3)';
      const statusLabel = isConn
        ? '<span style="color:#6ee7b7;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;">● Connected</span>'
        : '<span style="color:#6b7280;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;">○ Known</span>';
      const dirLabel = p.incoming
        ? '<span style="color:#38bdf8;font-size:10px;">↓ IN</span>'
        : '<span style="color:#fbbf24;font-size:10px;">↑ OUT</span>';
      const heightStr = p.height ? p.height.toLocaleString() : '0';
      const idleSecs = p.idle_seconds || 0;
      const idleStr = idleSecs < 60 ? `${idleSecs}s` : idleSecs < 3600 ? `${Math.floor(idleSecs/60)}m` : `${Math.floor(idleSecs/3600)}h`;
      const failStr = p.failed_attempts > 0 ? `<span style="color:#f87171;font-size:10px;margin-left:6px;">⚠ ${Number(p.failed_attempts)} fails</span>` : '';
      const safeHost = escapeHtml(String(p.host || p.address || ''));
      const safeSource = p.source_node ? `<span style="color:rgba(255,255,255,0.25);font-size:10px;">via ${escapeHtml(String(p.source_node))}</span>` : '';
      const safePort = escapeHtml(String(p.port || '8334'));

      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:${bgColor};border-radius:10px;border:1px solid ${borderColor};transition:border-color 0.3s;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};${dotShadow}"></span>
          <div>
            <div style="font-weight:600;font-family:monospace;font-size:13px;">${safeHost}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:2px;">
              ${statusLabel} ${dirLabel} ${safeSource}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;font-size:12px;color:rgba(255,255,255,0.55);">
          <span>H: <b style="color:#93c5fd;">${heightStr}</b></span>
          <span style="color:rgba(255,255,255,0.3);">:${safePort}</span>
          <span>idle ${idleStr}</span>
          ${failStr}
        </div>
      </div>`;
    }).join('');

  } catch (err) {
    console.error('[PEERS] Refresh failed:', err);
  }
}

// Wire up peer refresh button
(function initPeerPanel() {
  const refreshBtn = document.getElementById('refresh-peers-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => refreshPeerList());
  }
  // Auto-refresh every 15s
  setInterval(() => {
    if (shouldRunNetworkPolling()) {
      void refreshPeerList();
    }
  }, 15000);
  // Initial fetch after 2s
  setTimeout(() => {
    if (currentView === 'network') {
      void refreshPeerList();
    }
  }, 2000);
})();

function renderServerGrid(servers) {
  const grid = document.getElementById('server-grid');
  if (!grid) return;

  // AUDIT-FIX E-02 (16 Feb 2026): escape server.name, server.location, server.host
  grid.innerHTML = servers.map(server => {
    const online = server.online;
    const poolOk = server.pool?.online;
    const rpcOk = server.rpc?.online;
    const poolLatency = server.pool?.latency > 0 ? `${server.pool.latency}ms` : '—';
    const rpcLatency = server.rpc?.latency > 0 ? `${server.rpc.latency}ms` : '—';
    const safeName = escapeHtml(String(server.name || ''));
    const safeFlag = escapeHtml(String(server.flag || ''));
    const safeLocation = escapeHtml(String(server.location || ''));
    const safeHost = escapeHtml(String(server.host || ''));

    return `
      <div class="server-card ${online ? 'online' : 'offline'}">
        <div class="server-header">
          <div class="server-name">${safeFlag} ${safeName}</div>
          <div class="server-status-dot ${online ? 'on' : 'off'}"></div>
        </div>
        <div class="server-detail">
          <span class="label">Location</span>
          <span class="val">${safeLocation}</span>
        </div>
        <div class="server-detail">
          <span class="label">IP</span>
          <span class="val" style="font-family:monospace;font-size:12px;">${safeHost}</span>
        </div>
        <div class="server-detail">
          <span class="label">Pool (3333)</span>
          <span class="val ${poolOk ? 'ok' : 'err'}">${poolOk ? '\u2705 Online' : '\u274c Offline'} ${poolOk ? poolLatency : ''}</span>
        </div>
        <div class="server-detail">
          <span class="label">RPC (8444)</span>
          <span class="val ${rpcOk ? 'ok' : 'err'}">${rpcOk ? '\u2705 Online' : '\u274c Offline'} ${rpcOk ? rpcLatency : ''}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// wZION Bridge View Logic
// ─────────────────────────────────────────────────────────────────────────────

let _bridgeEvmAddress = null;
let _bridgeDirection  = 'L1toEVM';
let _bridgeMemo       = null;

/** Called when Bridge nav item is clicked (from switchView) */
function initBridgeView() {
  bridgeLoadStats();
  bridgeLoadEvmAddress();
  window.dexLoadPools();
}

/** Load EVM address from wallet context (derive from mnemonic via IPC) */
async function bridgeLoadEvmAddress() {
  try {
    const res = await window.electronAPI?.walletGetEvmAddress?.() || null;
    if (res?.address) {
      _bridgeEvmAddress = res.address;
      const el = document.getElementById('bridge-evm-address');
      if (el) el.textContent = res.address;
      const panel = document.getElementById('bridge-evm-unlock-panel');
      if (panel) panel.classList.add('d-none');
      bridgeLoadWzionBalance(res.address);
    } else if (res?.needsPassword) {
      const addrEl = document.getElementById('bridge-evm-address');
      if (addrEl) addrEl.textContent = 'Click below to unlock';
      const panel = document.getElementById('bridge-evm-unlock-panel');
      if (panel) panel.classList.remove('d-none');
    } else {
      const el = document.getElementById('bridge-evm-address');
      if (el) el.textContent = 'Unlock wallet first';
    }
  } catch (e) {
    console.warn('[BRIDGE] EVM address load failed:', e.message);
  }
}

/** Fetch wZION balance */
async function bridgeLoadWzionBalance(addr) {
  try {
    const res = await window.electronAPI.bridgeGetWzionBalance(addr);
    const el  = document.getElementById('bridge-wzion-balance');
    if (el) el.textContent = res.success ? res.balance.toFixed(4) : 'Error';
  } catch (e) {
    console.warn('[BRIDGE] wZION balance error:', e.message);
  }
}

/** Fetch bridge global stats */
window.bridgeLoadStats = async function () {
  const loadingEl  = document.getElementById('bridge-stats-loading');
  const gridEl     = document.getElementById('bridge-stats-grid');
  if (loadingEl) { loadingEl.style.display = 'block'; loadingEl.textContent = 'Loading…'; }
  if (gridEl)    { gridEl.style.display    = 'none'; }
  try {
    const res = await window.electronAPI.bridgeGetStats();
    if (res.success) {
      const fmt = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('bs-minted', fmt(res.totalMinted));
      set('bs-burned', fmt(res.totalBurned));
      set('bs-circ',   fmt(res.circulating));
      if (loadingEl) loadingEl.style.display = 'none';
      if (gridEl)    { gridEl.style.display  = 'flex'; }
    } else {
      if (loadingEl) loadingEl.textContent = `Error: ${res.error}`;
    }
  } catch (e) {
    if (loadingEl) loadingEl.textContent = `RPC error: ${e.message}`;
  }
};

/** Toggle between L1→EVM and EVM→L1 forms */
window.bridgeSetDirection = function (dir) {
  _bridgeDirection = dir;
  const l1toEvm = document.getElementById('bridge-form-l1toevm');
  const evmToL1 = document.getElementById('bridge-form-evmtol1');
  const btnEvm  = document.getElementById('bridge-btn-to-evm');
  const btnL1   = document.getElementById('bridge-btn-to-l1');
  if (dir === 'L1toEVM') {
    if (l1toEvm) l1toEvm.style.display = 'block';
    if (evmToL1) evmToL1.style.display = 'none';
    if (btnEvm)  btnEvm.classList.add('active');
    if (btnL1)   btnL1.classList.remove('active');
  } else {
    if (l1toEvm) l1toEvm.style.display = 'none';
    if (evmToL1) evmToL1.style.display = 'block';
    if (btnEvm)  btnEvm.classList.remove('active');
    if (btnL1)   btnL1.classList.add('active');
  }
};

/** Generate L1 locking memo for the entered EVM address */
window.bridgePrepareLock = async function () {
  if (!_bridgeEvmAddress) {
    alert('Please unlock your ZION wallet first.');
    return;
  }
  const amount  = parseFloat(document.getElementById('bridge-l1-amount')?.value || '0');
  if (!amount || amount < 100) {
    alert('Enter an amount of at least 100 ZION.');
    return;
  }
  try {
    const res = await window.electronAPI.bridgePrepareLock(_bridgeEvmAddress);
    if (!res.success) { alert(`Error: ${res.error}`); return; }
    _bridgeMemo = res.memo;
    const vaultEl   = document.getElementById('bridge-vault-addr');
    const memoEl    = document.getElementById('bridge-memo-text');
    const boxEl     = document.getElementById('bridge-memo-box');
    const sendBtnEl = document.getElementById('bridge-send-lock');
    if (vaultEl)   vaultEl.textContent  = res.vaultAddress;
    if (memoEl)    memoEl.textContent   = res.memo;
    if (boxEl)     boxEl.style.display  = 'block';
    if (sendBtnEl) sendBtnEl.classList.remove('d-none');
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
};

/** Show status in the shared bridge status box */
function bridgeShowStatus(text, type, explorerUrl) {
  const box     = document.getElementById('bridge-tx-status');
  const spinner = document.getElementById('bridge-status-spinner');
  const textEl  = document.getElementById('bridge-status-text');
  const link    = document.getElementById('bridge-status-link');
  if (!box) return;
  box.classList.remove('d-none');
  box.className = `bridge-status-box ${type || ''}`;
  if (textEl)  textEl.textContent  = text;
  if (spinner) spinner.style.display = (type === 'pending') ? 'inline-block' : 'none';
  if (link) {
    if (explorerUrl) {
      link.href = explorerUrl;
      link.classList.remove('d-none');
    } else {
      link.classList.add('d-none');
    }
  }
}

/** Auto-send ZION to bridge vault (ZION → wZION) */
window.bridgeSendLock = async function () {
  if (!_bridgeEvmAddress) { alert('EVM key not loaded — unlock first.'); return; }
  const amount = parseFloat(document.getElementById('bridge-l1-amount')?.value || '0');
  if (!amount || amount < 100) { alert('Minimum amount is 100 ZION.'); return; }

  // Get L1 from address from config
  let fromAddress;
  try {
    const cfg = await window.electronAPI.getConfig();
    fromAddress = cfg.wallet;
  } catch { fromAddress = null; }
  if (!fromAddress) { alert('Could not determine L1 wallet address from config.'); return; }

  bridgeShowStatus('Sending L1 transaction…', 'pending');
  try {
    const res = await window.electronAPI.bridgeSendLock({ amount, fromAddress });
    if (!res.success) {
      bridgeShowStatus(`❌ Error: ${res.error}`, 'error');
      return;
    }
    bridgeShowStatus(
      `✅ Sent ${amount} ZION to vault. TX: ${res.txId || 'submitted'}. wZION will arrive in ~1 min.`,
      'success',
      null
    );
  } catch (e) {
    bridgeShowStatus(`❌ ${e.message}`, 'error');
  }
};

/** Burn wZION on Base → receive ZION on L1 */
window.bridgeBurnWzion = async function () {
  const amount      = parseFloat(document.getElementById('bridge-burn-amount')?.value || '0');
  const l1Recipient = (document.getElementById('bridge-burn-l1addr')?.value || '').trim();
  if (!amount || amount <= 0) { alert('Enter an amount to burn.'); return; }
  if (!l1Recipient) { alert('Enter your L1 ZION recipient address.'); return; }

  bridgeShowStatus('Signing EVM transaction…', 'pending');
  try {
    const res = await window.electronAPI.bridgeBurnWzion({ amount, l1Recipient });
    if (res?.needsEvmKey) {
      // Show inline password box inside the EVM→L1 form
      bridgeShowStatus('EVM key not loaded — enter your wallet password below.', 'warn');
      const box = document.getElementById('bridge-evm-key-box');
      if (box) box.classList.remove('d-none');
      return;
    }
    if (!res.success) {
      bridgeShowStatus(`❌ Error: ${res.error}`, 'error');
      return;
    }
    bridgeShowStatus(
      `✅ Burn TX submitted. ZION will arrive on L1 after relay confirmation.`,
      'success',
      res.explorerUrl
    );
  } catch (e) {
    bridgeShowStatus(`❌ ${e.message}`, 'error');
  }
};

/** Unlock EVM key from the inline password box inside EVM→L1 form, then retry burn */
window.bridgeBurnWzionWithPassword = async function () {
  const password    = (document.getElementById('bridge-evm-password')?.value || '').trim();
  const amount      = parseFloat(document.getElementById('bridge-burn-amount')?.value || '0');
  const l1Recipient = (document.getElementById('bridge-burn-l1addr')?.value || '').trim();
  if (!password) { alert('Enter your wallet password.'); return; }

  bridgeShowStatus('Deriving EVM key & signing…', 'pending');
  try {
    const res = await window.electronAPI.bridgeBurnWzion({ amount, l1Recipient, password });
    if (!res.success) {
      bridgeShowStatus(`❌ Error: ${res.error}`, 'error');
      return;
    }
    const box = document.getElementById('bridge-evm-key-box');
    if (box) box.classList.add('d-none');
    bridgeShowStatus(
      `✅ Burn TX submitted. ZION will arrive on L1 after relay confirmation.`,
      'success',
      res.explorerUrl
    );
  } catch (e) {
    bridgeShowStatus(`❌ ${e.message}`, 'error');
  }
};

/** Copy memo to clipboard */
window.bridgeCopyMemo = function () {
  if (_bridgeMemo) {
    navigator.clipboard?.writeText(_bridgeMemo).then(() => {
      const el = document.getElementById('bridge-memo-text');
      if (el) {
        const orig = el.style.borderColor;
        el.style.borderColor = '#00ff99';
        setTimeout(() => { el.style.borderColor = orig; }, 800);
      }
    });
  }
};

/** Copy EVM address to clipboard */
window.bridgeCopyEvm = function () {
  if (_bridgeEvmAddress) {
    navigator.clipboard?.writeText(_bridgeEvmAddress);
  }
};

// ── DEX Pool Data Loader ─────────────────────────────────────────────────

/** Fetch DEX pool stats (wZION/ETH, wZION/USDC) from backend or defaults */
window.dexLoadPools = async function () {
  try {
    const res = await window.ipcRenderer?.invoke?.('dex-get-pool-stats');
    if (res?.success) {
      const fmt  = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
      const set  = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      if (res.pools?.eth) {
        set('dex-tvl-eth',   '$' + fmt(res.pools.eth.tvl));
        set('dex-vol-eth',   '$' + fmt(res.pools.eth.volume24h));
        set('dex-price-eth', '$' + fmt(res.pools.eth.price));
        set('dex-apr-eth',   fmt(res.pools.eth.apr) + '%');
      }
      if (res.pools?.usdc) {
        set('dex-tvl-usdc',   '$' + fmt(res.pools.usdc.tvl));
        set('dex-vol-usdc',   '$' + fmt(res.pools.usdc.volume24h));
        set('dex-price-usdc', '$' + fmt(res.pools.usdc.price));
        set('dex-apr-usdc',   fmt(res.pools.usdc.apr) + '%');
      }
    }
  } catch (e) {
    console.warn('[DEX] Pool stats load failed:', e.message);
  }
};

// ── Atomic Swap Logic ────────────────────────────────────────────────────

const _swapPairs = {
  'zion-btc': { send: 'ZION', receive: 'BTC', rate: 0.0000012 },
  'zion-eth': { send: 'ZION', receive: 'ETH', rate: 0.0000085 },
  'zion-xmr': { send: 'ZION', receive: 'XMR', rate: 0.000065  },
};
let _swapSelectedPair = 'zion-btc';
let _swapReversed = false;

/** Select an atomic swap pair */
window.swapSelectPair = function (pair) {
  _swapSelectedPair = pair;
  _swapReversed = false;
  document.querySelectorAll('.swap-pair-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.pair === pair);
  });
  const p = _swapPairs[pair];
  if (p) {
    const sendEl = document.getElementById('swap-send-coin');
    const recvEl = document.getElementById('swap-receive-coin');
    if (sendEl) sendEl.textContent = p.send;
    if (recvEl) recvEl.textContent = p.receive;
    swapCalcEstimate();
  }
};

/** Reverse swap direction */
window.swapReverse = function () {
  _swapReversed = !_swapReversed;
  const p = _swapPairs[_swapSelectedPair];
  if (!p) return;
  const sendEl = document.getElementById('swap-send-coin');
  const recvEl = document.getElementById('swap-receive-coin');
  if (_swapReversed) {
    if (sendEl) sendEl.textContent = p.receive;
    if (recvEl) recvEl.textContent = p.send;
  } else {
    if (sendEl) sendEl.textContent = p.send;
    if (recvEl) recvEl.textContent = p.receive;
  }
  swapCalcEstimate();
};

/** Calculate estimate based on mock rate */
function swapCalcEstimate() {
  const p = _swapPairs[_swapSelectedPair];
  if (!p) return;
  const sendAmt = parseFloat(document.getElementById('swap-send-amount')?.value || '0');
  const recvEl  = document.getElementById('swap-receive-amount');
  if (!recvEl) return;
  if (!sendAmt || sendAmt <= 0) { recvEl.value = ''; return; }
  const rate = _swapReversed ? (1 / p.rate) : p.rate;
  recvEl.value = (sendAmt * rate).toFixed(8);
}

/** Copy contract/address to clipboard helper */
function bridgeCopyText(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

// ── Bridge DOM event listeners (CSP-compliant, no inline onclick) ────────
(function attachBridgeListeners() {
  const on = (id, evt, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(evt, fn);
  };
  // Bridge tab
  on('bridge-btn-to-evm',    'click', () => window.bridgeSetDirection('L1toEVM'));
  on('bridge-btn-to-l1',     'click', () => window.bridgeSetDirection('EVMtoL1'));
  on('bridge-copy-evm',      'click', () => window.bridgeCopyEvm());
  on('bridge-copy-memo',     'click', () => window.bridgeCopyMemo());
  on('bridge-prepare-lock',  'click', () => window.bridgePrepareLock());
  on('bridge-send-lock',     'click', () => window.bridgeSendLock());
  on('bridge-refresh-stats', 'click', () => window.bridgeLoadStats());
  on('bridge-burn-wzion',    'click', () => window.bridgeBurnWzion());
  on('bridge-evm-unlock',    'click', () => window.bridgeBurnWzionWithPassword());

  // EVM key unlock panel (for wallets without stored evmAddress)
  on('bridge-derive-evm', 'click', async () => {
    const pw = (document.getElementById('bridge-wallet-password')?.value || '').trim();
    if (!pw) { alert('Enter your wallet password.'); return; }
    const res = await window.electronAPI.walletGetEvmAddress(pw);
    if (res?.address) {
      _bridgeEvmAddress = res.address;
      const el = document.getElementById('bridge-evm-address');
      if (el) el.textContent = res.address;
      document.getElementById('bridge-evm-unlock-panel')?.classList.add('d-none');
      bridgeLoadWzionBalance(res.address);
    } else {
      alert(`Error: ${res?.error || 'Wrong password or no mnemonic'}`);
    }
  });

  on('bridge-open-basescan', 'click', () => {
    window.open('https://basescan.org/address/0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467#writeContract', '_blank');
  });

  // DEX tab
  on('dex-refresh-pools', 'click', () => window.dexLoadPools());

  // Atomic Swap tab
  on('swap-reverse-btn',  'click', () => window.swapReverse());
  on('swap-send-amount',  'input', () => swapCalcEstimate());

  // Swap pair cards
  document.querySelectorAll('.swap-pair-card').forEach(card => {
    card.addEventListener('click', () => {
      if (card.dataset.pair) window.swapSelectPair(card.dataset.pair);
    });
  });

  // Stats tab — copy buttons
  on('stats-copy-wzion',  'click', () => bridgeCopyText('0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6'));
  on('stats-copy-bridge', 'click', () => bridgeCopyText('0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467'));
  on('stats-copy-vault',  'click', () => bridgeCopyText('zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0'));
})();

// Hook into switchView to initialize bridge when tab is opened
// (initBridgeView() is called directly inside switchView() above)

// ═══════════════════════════════════════════════════════════════
// OASIS — Consciousness Gaming Layer (L4)
// ═══════════════════════════════════════════════════════════════

/** OASIS Consciousness Levels — mirrors L4/oasis/src/consciousness.rs */
const OASIS_LEVELS = [
  { name: 'Physical',     sefira: 'Malkuth',         desc: 'Foundation',     xp: 0,         mult: 1.0,  symbol: '◯',  features: ['BasicMining'] },
  { name: 'Emotional',    sefira: 'Yesod',           desc: 'Connection',     xp: 1_000,     mult: 1.2,  symbol: '≋',  features: ['JoinGuild'] },
  { name: 'Mental',       sefira: 'Hod / Netzach',   desc: 'Splendor',       xp: 5_000,     mult: 1.5,  symbol: '▲',  features: ['AiChallenges', 'CreateGuild'] },
  { name: 'Intuitional',  sefira: 'Tiferet',         desc: 'Beauty',         xp: 15_000,    mult: 2.0,  symbol: '◆',  features: ['ClaimTerritory', 'MeditationBonus'] },
  { name: 'Spiritual',    sefira: 'Gevurah / Chesed',desc: 'Strength & Mercy',xp: 50_000,   mult: 3.0,  symbol: '⚡', features: ['DaoVoting', 'TitheProposals'] },
  { name: 'Cosmic',       sefira: 'Binah',           desc: 'Understanding',  xp: 150_000,   mult: 5.0,  symbol: '◉',  features: ['CreateAiAgent', 'GuildWars'] },
  { name: 'Divine',       sefira: 'Chokmah',         desc: 'Wisdom',         xp: 500_000,   mult: 8.0,  symbol: '◎',  features: ['ExpandTerritory', 'Mentorship'] },
  { name: 'Unity',        sefira: "Da'at",           desc: 'Knowledge',      xp: 2_000_000, mult: 12.0, symbol: '∞',  features: ['WarpPortals', 'CreateChallenges'] },
  { name: 'OnTheStar',    sefira: 'Keter',           desc: 'Crown',          xp: 10_000_000,mult: 15.0, symbol: '✦',  features: ['ConsciousnessBeacon'] },
];

/** Level-up ZION bonuses — mirrors L4/oasis/src/levels.rs */
const LEVEL_UP_REWARDS = [0, 100, 500, 2_500, 10_000, 50_000, 250_000, 1_000_000, 5_000_000];

/** 8 Genesis Territories — mirrors L4/oasis/src/territory.rs */
const OASIS_TERRITORIES = [
  { name: 'Mount Zion',                  region: 'Mountains',     emoji: '△',   bg: 'bg-mountains',difficulty: 1.0, miningBonus: 10, xpBonus: 5,  capacity: 50  },
  { name: 'Cedar Forest',                region: 'Forest',        emoji: '≋',  bg: 'bg-forest',   difficulty: 0.8, miningBonus: 15, xpBonus: 10, capacity: 40  },
  { name: 'Negev Desert',                region: 'Desert',        emoji: '◇',  bg: 'bg-desert',   difficulty: 1.5, miningBonus: 20, xpBonus: 15, capacity: 30  },
  { name: 'Sea of Galilee',              region: 'Ocean',         emoji: '≈',  bg: 'bg-ocean',    difficulty: 1.2, miningBonus: 12, xpBonus: 8,  capacity: 35  },
  { name: 'Masada Forge',                region: 'Volcano',       emoji: '▲',  bg: 'bg-volcano',  difficulty: 2.0, miningBonus: 25, xpBonus: 20, capacity: 20  },
  { name: 'Crystal Mines of Solomon',    region: 'Crystal Caves', emoji: '◆',  bg: 'bg-crystal',  difficulty: 1.8, miningBonus: 22, xpBonus: 18, capacity: 25  },
  { name: 'Temple of Consciousness',     region: 'Temple',        emoji: '◈',  bg: 'bg-temple',   difficulty: 1.3, miningBonus: 18, xpBonus: 25, capacity: 30  },
  { name: 'Babel Nexus',                 region: 'Nexus',         emoji: '∞',  bg: 'bg-nexus',    difficulty: 2.5, miningBonus: 30, xpBonus: 30, capacity: 15  },
];

/** Tithe categories — mirrors L4/oasis/src/tithe.rs */
const OASIS_TITHE_CATEGORIES = [
  { name: 'Water',       emoji: '~',  desc: 'Clean water access' },
  { name: 'Food',        emoji: '◈',  desc: 'Food security' },
  { name: 'Shelter',     emoji: '⌂',  desc: 'Housing & shelter' },
  { name: 'Environment', emoji: '◎',  desc: 'Earth protection' },
  { name: 'Medical',     emoji: '+',  desc: 'Healthcare access' },
  { name: 'Education',   emoji: '≡',  desc: 'Knowledge & learning' },
  { name: 'Emergency',   emoji: '!',  desc: 'Disaster response' },
];

/** Challenge definitions — mirrors L4/oasis/src/challenges.rs genesis_challenges() */
const OASIS_CHALLENGES = [
  { id: 'daily_meditation',        title: 'Daily Meditation',         category: 'Meditation',    difficulty: 'Beginner',      baseXp: 50,  zion: 10,    desc: 'Complete a 10-minute guided meditation session to center your consciousness.', isDaily: true },
  { id: 'crypto_quiz_beginner',    title: 'Crypto Fundamentals',      category: 'Quiz',          difficulty: 'Beginner',      baseXp: 100, zion: 25,    desc: 'Test your knowledge of blockchain basics, consensus mechanisms, and cryptography.', isDaily: false },
  { id: 'humanitarian_awareness',  title: 'Humanitarian Awareness',   category: 'Humanitarian',  difficulty: 'Intermediate', baseXp: 200, zion: 50,    desc: 'Learn about global humanitarian challenges and how blockchain can help solve them.', isDaily: false },
  { id: 'ai_challenge_advanced',   title: 'Neural Consciousness',     category: 'Technical',     difficulty: 'Advanced',      baseXp: 500, zion: 200,   desc: 'Solve an advanced AI reasoning challenge that tests pattern recognition and logic.', isDaily: false },
  { id: 'creative_expression',     title: 'Sacred Geometry',          category: 'Creative',      difficulty: 'Intermediate', baseXp: 150, zion: 40,    desc: 'Create or identify sacred geometric patterns in nature and mathematics.', isDaily: true },
  { id: 'community_builder',       title: 'Community Builder',        category: 'Community',     difficulty: 'Beginner',      baseXp: 75,  zion: 20,    desc: 'Help onboard a new member or contribute to community discussions.', isDaily: false },
  { id: 'quantum_mastery',         title: 'Quantum Consciousness',    category: 'Technical',     difficulty: 'Master',        baseXp: 1000,zion: 500,   desc: 'Master-level challenge exploring quantum entanglement and consciousness theory.', isDaily: false },
  { id: 'tithe_reflection',        title: 'Tithe Reflection',         category: 'Humanitarian',  difficulty: 'Beginner',      baseXp: 60,  zion: 15,    desc: 'Reflect on your humanitarian contributions and set intention for future giving.', isDaily: true },
];

/** Reward pool slots — mirrors L4/oasis/src/rewards.rs */
const OASIS_REWARD_SLOTS = [
  { name: 'Mining',     icon: '▶',  amount: '1.65B' },
  { name: 'Challenges', icon: '◎', amount: '1.65B' },
  { name: 'Guild',      icon: '×',  amount: '1.65B' },
  { name: 'Level-Up',   icon: '↑',  amount: '1.65B' },
  { name: 'Reserve',    icon: '●', amount: '1.65B' },
];

/** Sample guild quests — mirrors L4/oasis/src/guild.rs QuestType */
const GUILD_QUESTS = [
  { icon: '▶', title: 'Collective Mining Sprint', desc: 'Mine 500 blocks as a guild', reward: '2,000 XP', progress: 67 },
  { icon: '◎', title: 'AI Challenge Blitz',       desc: 'Complete 25 AI challenges',  reward: '1,500 XP', progress: 44 },
  { icon: '♥', title: 'Humanitarian Goal',         desc: 'Tithe 10,000 ZION total',    reward: '3,000 XP', progress: 23 },
  { icon: '◈', title: 'Territory Defense',         desc: 'Hold Cedar Forest for 48h',  reward: '2,500 XP', progress: 89 },
  { icon: '✶', title: 'XP Milestone',              desc: 'Reach 100K combined guild XP',reward: '5,000 XP', progress: 56 },
];

let oasisInitialized = false;

/** Called when OASIS nav item is clicked (from switchView) */
function initOasisView() {
  if (oasisInitialized) return;
  oasisInitialized = true;

  // Simulated player state (in production, this comes from L4 OASIS API port 8094)
  const player = {
    totalXp: 3_420,
    level: 2, // Mental
    blocksMined: 1_247,
    streak: 12,
    zionEarned: 84_210,
    guildName: null,
  };

  renderJourney(player);
  renderTerritories();
  renderGuild(player);
  renderChallenges();
  renderTithe();
  initGameView();
}

function renderJourney(player) {
  const currentLevel = OASIS_LEVELS[player.level];
  const nextLevel = OASIS_LEVELS[player.level + 1] || null;

  // Orb & name
  const orb = document.getElementById('oasis-orb');
  const nameEl = document.getElementById('oasis-level-name');
  const subEl = document.getElementById('oasis-sefira-label');
  if (orb) orb.textContent = currentLevel.symbol;
  if (nameEl) nameEl.textContent = currentLevel.name;
  if (subEl) subEl.textContent = `${currentLevel.sefira} · ${currentLevel.desc}`;

  // XP bar
  const fill = document.getElementById('oasis-xp-fill');
  const xpCur = document.getElementById('oasis-xp-current');
  const xpNext = document.getElementById('oasis-xp-next');
  if (nextLevel && fill) {
    const pct = ((player.totalXp - currentLevel.xp) / (nextLevel.xp - currentLevel.xp)) * 100;
    fill.style.width = `${Math.min(100, Math.max(0, pct)).toFixed(1)}%`;
  }
  if (xpCur) xpCur.textContent = `${player.totalXp.toLocaleString()} XP`;
  if (xpNext) xpNext.textContent = nextLevel ? `Next: ${nextLevel.xp.toLocaleString()} XP` : 'MAX LEVEL';

  // Stats
  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setTxt('oasis-multiplier', `${currentLevel.mult}×`);
  setTxt('oasis-blocks-mined', player.blocksMined.toLocaleString());
  setTxt('oasis-streak', `${player.streak}d`);
  setTxt('oasis-zion-earned', player.zionEarned.toLocaleString());

  // Features
  const featuresEl = document.getElementById('oasis-features');
  if (featuresEl) {
    const allFeatures = [
      { key: 'BasicMining',        icon: '▶', label: 'Basic Mining' },
      { key: 'JoinGuild',          icon: '∞', label: 'Join Guild' },
      { key: 'AiChallenges',       icon: '◎', label: 'AI Challenges' },
      { key: 'CreateGuild',        icon: '×', label: 'Create Guild' },
      { key: 'ClaimTerritory',     icon: '◈', label: 'Claim Territory' },
      { key: 'MeditationBonus',    icon: '○', label: 'Meditation Bonus' },
      { key: 'DaoVoting',          icon: '▣', label: 'DAO Voting' },
      { key: 'TitheProposals',     icon: '♡', label: 'Tithe Proposals' },
      { key: 'CreateAiAgent',      icon: '◉', label: 'Create AI Agent' },
      { key: 'GuildWars',          icon: '×', label: 'Guild Wars' },
      { key: 'ExpandTerritory',    icon: '△', label: 'Expand Territory' },
      { key: 'Mentorship',         icon: '◆', label: 'Mentorship' },
      { key: 'WarpPortals',        icon: '∞', label: 'Warp Portals' },
      { key: 'CreateChallenges',   icon: '✎', label: 'Create Challenges' },
      { key: 'ConsciousnessBeacon',icon: '✦', label: 'Consciousness Beacon' },
    ];

    // Collect all unlocked features up to current level
    const unlockedKeys = new Set();
    for (let i = 0; i <= player.level; i++) {
      for (const f of OASIS_LEVELS[i].features) unlockedKeys.add(f);
    }

    featuresEl.innerHTML = allFeatures.map(f => {
      const unlocked = unlockedKeys.has(f.key);
      return `<div class="oasis-feature ${unlocked ? 'unlocked' : 'locked'}">
        <span class="oasis-feature-icon">${f.icon}</span>
        <span>${f.label}</span>
        <span style="margin-left:auto; font-size:11px">${unlocked ? '✓' : '●'}</span>
      </div>`;
    }).join('');
  }

  // Ladder
  const ladderEl = document.getElementById('oasis-ladder');
  if (ladderEl) {
    ladderEl.innerHTML = OASIS_LEVELS.map((lvl, i) => {
      let cls = 'future';
      if (i < player.level) cls = 'achieved';
      if (i === player.level) cls = 'current';
      const reward = LEVEL_UP_REWARDS[i] ? `+${LEVEL_UP_REWARDS[i].toLocaleString()} ZION` : '';
      return `<div class="oasis-level-step ${cls}">
        <div class="oasis-level-num">${i + 1}</div>
        <div class="oasis-level-name">${lvl.symbol} ${lvl.name}</div>
        <div class="oasis-level-xp">${lvl.xp.toLocaleString()} XP</div>
        <div class="oasis-level-mult">${lvl.mult}×</div>
      </div>`;
    }).join('');
  }

  // Reward pool
  const chartEl = document.getElementById('oasis-reward-chart');
  if (chartEl) {
    chartEl.innerHTML = OASIS_REWARD_SLOTS.map(s =>
      `<div class="reward-slot">
        <div class="reward-slot-icon">${s.icon}</div>
        <div class="reward-slot-name">${s.name}</div>
        <div class="reward-slot-amount">${s.amount}</div>
        <div class="reward-slot-pct">20%</div>
      </div>`
    ).join('');
  }
}

function renderTerritories() {
  const grid = document.getElementById('oasis-territory-grid');
  if (!grid) return;

  grid.innerHTML = OASIS_TERRITORIES.map(t => {
    const controllers = ['Unclaimed', 'Sons of Light', 'Dawn Seekers', 'Crystal Guardians', 'Unclaimed', 'Forge Masters', 'Temple Keepers', 'Nexus Architects'];
    const idx = OASIS_TERRITORIES.indexOf(t);
    const controller = controllers[idx] || 'Unclaimed';
    const isClaimed = controller !== 'Unclaimed';

    return `<div class="territory-card">
      <div class="territory-banner ${t.bg}">
        <div class="territory-banner-bg"></div>
        <div class="territory-banner-region">${t.region}</div>
        <div class="territory-banner-icon">${t.emoji}</div>
      </div>
      <div class="territory-body">
        <div class="territory-name">${t.name}</div>
        <div class="territory-meta">
          <span>× Difficulty ${t.difficulty}×</span>
          <span>+${t.miningBonus}% mining</span>
          <span>+${t.xpBonus}% XP</span>
        </div>
        <div class="territory-status">
          <span style="color:${isClaimed ? 'var(--zion-cyan)' : 'rgba(255,255,255,0.3)'}">
            ${isClaimed ? '■ ' + controller : '○ Unclaimed'}
          </span>
          <span style="font-size:10px; color:rgba(255,255,255,0.3)">${t.capacity} slots</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderGuild(player) {
  // Quests
  const questList = document.getElementById('guild-quests');
  if (questList) {
    questList.innerHTML = GUILD_QUESTS.map(q =>
      `<div class="quest-item">
        <div class="quest-icon">${q.icon}</div>
        <div class="quest-info">
          <div class="quest-title">${q.title}</div>
          <div class="quest-desc">${q.desc}</div>
          <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${q.progress}%"></div></div>
        </div>
        <div class="quest-reward">${q.reward}</div>
      </div>`
    ).join('');
  }

  // Leaderboard
  const lbBody = document.getElementById('guild-lb-body');
  if (lbBody) {
    const guilds = [
      { name: 'Sons of Light',      xp: '245,800', members: 47, territories: 2 },
      { name: 'Dawn Seekers',       xp: '198,400', members: 38, territories: 1 },
      { name: 'Crystal Guardians',  xp: '167,200', members: 52, territories: 1 },
      { name: 'Forge Masters',      xp: '142,100', members: 29, territories: 1 },
      { name: 'Temple Keepers',     xp: '128,900', members: 34, territories: 1 },
      { name: 'Nexus Architects',   xp: '95,300',  members: 21, territories: 1 },
    ];
    lbBody.innerHTML = guilds.map((g, i) =>
      `<tr><td style="color:var(--zion-gold); font-weight:700">${i + 1}</td><td>${g.name}</td><td>${g.xp}</td><td>${g.members}</td><td>${g.territories}</td></tr>`
    ).join('');
  }
}

function renderChallenges() {
  const diffClass = d => {
    const m = { Beginner: 'diff-beginner', Intermediate: 'diff-intermediate', Advanced: 'diff-advanced', Master: 'diff-master' };
    return m[d] || 'diff-beginner';
  };
  const diffMult = d => {
    const m = { Beginner: '1×', Intermediate: '2×', Advanced: '4×', Master: '8×' };
    return m[d] || '1×';
  };

  // Daily challenges
  const dailyEl = document.getElementById('oasis-daily-challenges');
  if (dailyEl) {
    const dailies = OASIS_CHALLENGES.filter(c => c.isDaily);
    dailyEl.innerHTML = dailies.map(c =>
      `<div class="challenge-card">
        <div class="challenge-category">${c.category}</div>
        <div class="challenge-title">${c.title}</div>
        <div class="challenge-desc">${c.desc}</div>
        <div class="challenge-footer">
          <span class="challenge-difficulty ${diffClass(c.difficulty)}">${c.difficulty} ${diffMult(c.difficulty)}</span>
          <span class="challenge-xp">+${c.baseXp} XP · ${c.zion} ZION</span>
        </div>
      </div>`
    ).join('');
  }

  // All challenges
  const allEl = document.getElementById('oasis-all-challenges');
  if (allEl) {
    allEl.innerHTML = OASIS_CHALLENGES.map(c =>
      `<div class="challenge-card">
        <div class="challenge-category">${c.category}${c.isDaily ? ' · Daily' : ''}</div>
        <div class="challenge-title">${c.title}</div>
        <div class="challenge-desc">${c.desc}</div>
        <div class="challenge-footer">
          <span class="challenge-difficulty ${diffClass(c.difficulty)}">${c.difficulty} ${diffMult(c.difficulty)}</span>
          <span class="challenge-xp">+${c.baseXp} XP · ${c.zion} ZION</span>
        </div>
      </div>`
    ).join('');
  }
}

function renderTithe() {
  const grid = document.getElementById('oasis-tithe-grid');
  if (grid) {
    // Simulated tithe data
    const amounts = [12_500, 8_200, 6_800, 15_300, 4_100, 9_700, 2_400];
    grid.innerHTML = OASIS_TITHE_CATEGORIES.map((cat, i) =>
      `<div class="tithe-card">
        <div class="tithe-emoji">${cat.emoji}</div>
        <div class="tithe-name">${cat.name}</div>
        <div class="tithe-amount">${amounts[i].toLocaleString()}</div>
        <div class="tithe-sub">${cat.desc}</div>
      </div>`
    ).join('');
  }

  const totalEl = document.getElementById('tithe-total-value');
  if (totalEl) {
    totalEl.textContent = '59,000 ZION';
  }
}

// ═══════════════════════════════════════════════════════════════
// OASIS COSMIC MINE — Full Space Clicker 🚀 (no backend, pure fun)
// ═══════════════════════════════════════════════════════════════

const GM_SAVE_KEY = 'zion_moon_miner_v1';

const GM_UPGRADES = [
  { id: 'pickaxe',   icon: '⛏',  name: 'Pickaxe',              desc: '+1 ZION/click',     bonus: 1,    baseCost: 10,      costMult: 1.50 },
  { id: 'drill',     icon: '💎',  name: 'Crystal Drill',        desc: '+5 ZION/click',     bonus: 5,    baseCost: 100,     costMult: 1.60 },
  { id: 'laser',     icon: '⚡',  name: 'Plasma Laser',         desc: '+25 ZION/click',    bonus: 25,   baseCost: 1200,    costMult: 1.70 },
  { id: 'quantum',   icon: '⚛',  name: 'Quantum Extractor',    desc: '+100 ZION/click',   bonus: 100,  baseCost: 20000,   costMult: 1.80 },
  { id: 'divine',    icon: '✦',  name: 'Divine Consciousness', desc: '+500 ZION/click',    bonus: 500,  baseCost: 500000,  costMult: 2.00 },
  { id: 'blackhole', icon: '🌑', name: 'Black Hole Tap',        desc: '+2000 ZION/click',  bonus: 2000, baseCost: 5000000, costMult: 2.50 },
];

const GM_MINERS = [
  { id: 'zach',    icon: '🤖',  name: 'Zachariah Bot',      desc: '0.1/sec',    rate: 0.1,   baseCost: 15,      costMult: 1.15, ship: '🤖'  },
  { id: 'drone',   icon: '🚁',  name: 'Orbital Drone',      desc: '0.5/sec',    rate: 0.5,   baseCost: 100,     costMult: 1.20, ship: '🚁'  },
  { id: 'crystal', icon: '💠',  name: 'Crystal Harvester',  desc: '3/sec',      rate: 3,     baseCost: 1100,    costMult: 1.30, ship: '💠'  },
  { id: 'warp',    icon: '🌀',  name: 'WARP Node',          desc: '20/sec',     rate: 20,    baseCost: 12000,   costMult: 1.40, ship: '🌀'  },
  { id: 'beacon',  icon: '🌟',  name: 'Divine Beacon',      desc: '200/sec',    rate: 200,   baseCost: 130000,  costMult: 1.60, ship: '🌟'  },
  { id: 'dyson',   icon: '☀',  name: 'Dyson Sphere',       desc: '2,000/sec',  rate: 2000,  baseCost: 2000000, costMult: 2.00, ship: '🔆'  },
];

const GM_ACHIEVEMENTS = [
  { id: 'first',     name: '🥇 First Mine',        cond: s => s.zionTotal >= 1 },
  { id: 'click10',   name: '✌ Warming Up',         cond: s => s.clicks >= 10 },
  { id: 'hundred',   name: '💯 Triple Digits',     cond: s => s.zionTotal >= 100 },
  { id: 'hodl',      name: '💎 Diamond Hands',     cond: s => s.zionTotal >= 1000 },
  { id: 'moon',      name: '🌙 Moon Mission',      cond: s => s.zionTotal >= 10000 },
  { id: 'wagmi',     name: '🚀 WAGMI',             cond: s => s.zionTotal >= 100000 },
  { id: 'lambo',     name: '🏎 Wen Lambo',         cond: s => s.zionTotal >= 1000000 },
  { id: 'satoshi',   name: '👁 Satoshi Tier',      cond: s => s.zionTotal >= 10000000 },
  { id: 'galaxy',    name: '🌌 Galaxy Brain',      cond: s => s.zionTotal >= 100000000 },
  { id: 'clickbro',  name: '🖱 Click Bro',         cond: s => s.clicks >= 100 },
  { id: 'clicker1k', name: '⚡ Finger Warrior',    cond: s => s.clicks >= 1000 },
  { id: 'autofarm',  name: '🤖 Lazy Miner',        cond: s => Object.values(s.miners).some(v => v > 0) },
  { id: 'fleet',     name: '🛸 Fleet Admiral',     cond: s => Object.values(s.miners).reduce((a,b)=>a+b,0) >= 10 },
  { id: 'upgrade1',  name: '⚒ Geared Up',         cond: s => Object.values(s.upgrades).some(v => v > 0) },
  { id: 'ascended',  name: '✦ Ascended',           cond: s => GM_UPGRADES.every(u => (s.upgrades[u.id]||0) >= 5) },
  { id: 'ufo',       name: '🛸 First Contact',     cond: s => s.ufoSeen },
  { id: 'planets',   name: '🪐 Planet Hopper',      cond: s => (s.planetsClicked||0) >= 5 },
  { id: 'iss',       name: '⊕ Docked at Isabella',  cond: s => !!s.issVisited },
  { id: 'deathstar', name: '💀 Death Star Destroyer', cond: s => (s.deathStarClicks||0) >= 1 },
  { id: 'yoda',      name: '🐸 Strong in the Force',  cond: s => !!s.yodaVisited },
  { id: 'trekkie',   name: '🖖 Live Long & Prosper',   cond: s => !!s.enterpriseSeen },
];

const GM_PLANET_BONUSES = {
  'cs-jupiter': { bonus: 500,  label: '♃ Jupiter' },
  'cs-saturn':  { bonus: 250,  label: '♄ Saturn'  },
  'cs-mars':    { bonus: 150,  label: '♂ Mars'    },
  'cs-earth':   { bonus: 100,  label: '♁ Earth'   },
  'cs-neptune': { bonus: 350,  label: '♆ Neptune' },
};

const GM_MILESTONES = [
  { at: 10,         emoji: '🥇', title: 'First Steps!',       sub: 'You mined 10 ZION. ngmi? nah, you ARE gonna make it.' },
  { at: 100,        emoji: '💎', title: 'Diamond Hands!',     sub: '100 ZION confirmed. Never selling ser.' },
  { at: 1000,       emoji: '🌙', title: 'Moon Protocol!',     sub: '1,000 ZION. The bull run has commenced.' },
  { at: 10000,      emoji: '🚀', title: 'WAGMI!!!',           sub: '10K ZION. We are ALL gonna make it.' },
  { at: 100000,     emoji: '🏆', title: 'Satoshi Vibes!',     sub: '100K ZION. Old Satoshi nods from the cosmos.', ufo: true },
  { at: 1000000,    emoji: '🏎', title: 'Wen Lambo?',         sub: '1M simZION! Not financial advice but... wen lambo?', ufo: true },
  { at: 10000000,   emoji: '✦',  title: 'Ascended Miner',     sub: '10M ZION! You have transcended physical reality.', ufo: true },
  { at: 100000000,  emoji: '🌌', title: 'Galaxy Brain',       sub: '100M ZION! The galaxy bows to you, ser.', ufo: true },
  { at: 1000000000, emoji: '∞',  title: 'One With The Chain', sub: 'ONE BILLION ZION! You ARE the blockchain now.', ufo: true },
];

const GM_MSGS = [
  '📈 Number go up!', '🚀 To the moon!', '💎 Diamond hands!', 'HODL till heat death 🌑',
  '🌙 WAGMI ser', 'gm gm ☀️', '😅 Not financial advice', '1 ZION = 1 ZION',
  '🔥 LFG!', '👁 Few understand', 'Still early 👀', '🤝 This is the way',
  'Based and ZION-pilled 🪐', '🏆 Satoshi watching', 'ser this is a Wendy\'s 😂',
  '🌍 We all gonna make it', '⚡ Zion protocol go brrr', '🛸 SENDING IT!',
  'ngmi if you stop clicking 🤡', '🌑 Black hole absorbed your fears',
  '🌌 The cosmos is bullish ser', '👨‍🚀 Houston, we have ZION',
  '♃ Jupiter aligns with your portfolio', '⛓ Not your keys, not your ZION',
  '🧑‍🚀 One small click for man, one giant bag for mankind',
  '🖖 Live long and prosper, ser', '💀 Alderaan had no ZION — ngmi',
  '🐸 Do or do not, there is no NGMI', '⊕ ISS Isabella confirms: ultra bullish',
  '☄ May the ZION be with you', '🖖 Beam me up some ZION, Scotty',
  '💀 "I am your financial advisor" — Darth Zion', '🌌 That\'s no moon... wait, IT IS the moon!',
  '🐸 Much ZION, I sense', '🖖 Resistance to HODL is futile',
  '⊗ Death Star destroyed — gains confirmed', '🚀 Warp speed to the moon!',
];

let _gameInitialized = false;
let _gmShownMilestones = new Set();
let _gmMissionStart = Date.now();
const _gmPlanetsClicked = new Set();

function _gmDefState() {
  const upg = {}; GM_UPGRADES.forEach(u => { upg[u.id] = 0; });
  const min = {}; GM_MINERS.forEach(m => { min[m.id] = 0; });
  return { zion: 0, zionTotal: 0, clicks: 0, upgrades: upg, miners: min, achievements: {}, blockNum: 1247331, ufoSeen: false, planetsClicked: 0, issVisited: false, deathStarClicks: 0, yodaVisited: false, enterpriseSeen: false };
}

function _gmLoadState() {
  try {
    const raw = localStorage.getItem(GM_SAVE_KEY);
    if (!raw) return _gmDefState();
    const s = JSON.parse(raw);
    const def = _gmDefState();
    return {
      zion:           s.zion || 0,
      zionTotal:      s.zionTotal || 0,
      clicks:         s.clicks || 0,
      upgrades:       { ...def.upgrades, ...s.upgrades },
      miners:         { ...def.miners,   ...s.miners   },
      achievements:   s.achievements || {},
      blockNum:       s.blockNum || 1247331,
      ufoSeen:        s.ufoSeen || false,
      planetsClicked:  s.planetsClicked  || 0,
      issVisited:      s.issVisited      || false,
      deathStarClicks: s.deathStarClicks  || 0,
      yodaVisited:     s.yodaVisited      || false,
      enterpriseSeen:  s.enterpriseSeen   || false,
    };
  } catch(e) { return _gmDefState(); }
}

function _gmSave(s)     { try { localStorage.setItem(GM_SAVE_KEY, JSON.stringify(s)); } catch(e){} }
function _gmPerClick(s) { let n=1; GM_UPGRADES.forEach(u => { n += u.bonus*(s.upgrades[u.id]||0); }); return n; }
function _gmPerSec(s)   { let n=0; GM_MINERS.forEach(m  => { n += m.rate*(s.miners[m.id]||0); }); return n; }
function _gmUpgCost(u, owned) { return Math.round(u.baseCost * Math.pow(u.costMult, owned||0)); }

function _gmFmt(n) {
  n = Math.floor(n);
  if (n >= 1e15) return (n/1e15).toFixed(2)+'Qa';
  if (n >= 1e12) return (n/1e12).toFixed(2)+'T';
  if (n >= 1e9)  return (n/1e9).toFixed(2)+'B';
  if (n >= 1e6)  return (n/1e6).toFixed(2)+'M';
  if (n >= 1e3)  return (n/1e3).toFixed(1)+'K';
  return n.toLocaleString();
}

function initGameView() {
  if (_gameInitialized) return;
  _gameInitialized = true;
  _gmMissionStart = Date.now();
  dbg('[GAME] 🚀 Cosmic Mine initializing');

  const state = _gmLoadState();
  GM_MILESTONES.forEach(ms => { if (state.zionTotal >= ms.at) _gmShownMilestones.add(ms.at); });

  /* ── Star field (200 stars, varied colors & sizes) ── */
  const starsEl = document.getElementById('cs-stars');
  if (starsEl) {
    let h = '';
    for (let i = 0; i < 200; i++) {
      const x  = (Math.random()*100).toFixed(2);
      const y  = (Math.random()*100).toFixed(2);
      const d  = (Math.random()*6).toFixed(2);
      const t  = (1.2 + Math.random()*3.5).toFixed(2);
      const sz = Math.random() < 0.12 ? 3 : (Math.random() < 0.35 ? 2 : 1);
      const col = Math.random() < 0.08 ? 'rgba(180,200,255,.9)'
                : Math.random() < 0.05 ? 'rgba(255,200,150,.9)'
                : 'white';
      h += `<div class="cs-star" style="left:${x}%;top:${y}%;width:${sz}px;height:${sz}px;animation:csTwinkle ${t}s ease-in-out ${d}s infinite;background:${col}"></div>`;
    }
    starsEl.innerHTML = h;
  }

  const scene = document.getElementById('gm-scene');

  /* ── Planet click bonuses ── */
  Object.entries(GM_PLANET_BONUSES).forEach(([id, {bonus, label}]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', () => {
      state.zion      += bonus;
      state.zionTotal += bonus;
      if (!_gmPlanetsClicked.has(id)) {
        _gmPlanetsClicked.add(id);
        state.planetsClicked = _gmPlanetsClicked.size;
      }
      /* Tiny float above planet */
      if (scene) {
        const pr = el.getBoundingClientRect();
        const sr = scene.getBoundingClientRect();
        const f  = document.createElement('div');
        f.className   = 'cs-float';
        f.textContent = `+${bonus.toLocaleString()}`;
        f.style.fontSize = '13px';
        f.style.left = `${pr.left - sr.left + pr.width/2 - 18}px`;
        f.style.top  = `${pr.top  - sr.top  - 8}px`;
        scene.appendChild(f);
        setTimeout(() => f.remove(), 1200);
      }
      const msgEl = document.getElementById('gm-msg');
      if (msgEl) msgEl.textContent = `🪐 ${label} bonus! +${bonus.toLocaleString()} ZION!`;
      _gmUpdateStats(state);
      _gmCheckMilestones(state);
      _gmRenderAchievements(state);
      _gmSave(state);
    });
  });

  /* ── ISS Isabella click ── */
  const issEl = document.getElementById('cs-iss');
  if (issEl && scene) {
    issEl.addEventListener('click', () => {
      const bonus = 300;
      state.zion += bonus; state.zionTotal += bonus;
      state.issVisited = true;
      const pr = issEl.getBoundingClientRect(); const sr = scene.getBoundingClientRect();
      const f = document.createElement('div');
      f.className = 'cs-float'; f.textContent = `+${bonus} ZION 🛰️`;
      f.style.fontSize = '13px';
      f.style.left = `${pr.left - sr.left + pr.width/2 - 22}px`;
      f.style.top  = `${pr.top  - sr.top  - 8}px`;
      scene.appendChild(f); setTimeout(() => f.remove(), 1300);
      const msgEl = document.getElementById('gm-msg');
      if (msgEl) msgEl.textContent = '⊕ ISS Isabella docked! +300 ZION! 👨‍🚀🛰️';
      _gmUpdateStats(state); _gmCheckMilestones(state); _gmRenderAchievements(state); _gmSave(state);
    });
  }

  /* ── Death Star click ── */
  const dsEl = document.getElementById('cs-death-star');
  const dsSphere = dsEl?.querySelector('.cs-ds-sphere');
  if (dsEl && scene) {
    dsEl.addEventListener('click', () => {
      const bonus = 1000 + (state.deathStarClicks || 0) * 250;
      state.zion += bonus; state.zionTotal += bonus;
      state.deathStarClicks = (state.deathStarClicks || 0) + 1;
      /* Superlaser flash */
      if (dsSphere) {
        dsSphere.style.boxShadow = '0 0 50px rgba(255,60,0,1),0 0 120px rgba(255,60,0,.7),inset -10px -8px 24px rgba(0,0,0,.7)';
        setTimeout(() => { dsSphere.style.boxShadow = ''; }, 450);
      }
      const pr = dsEl.getBoundingClientRect(); const sr = scene.getBoundingClientRect();
      const f = document.createElement('div');
      f.className = 'cs-float';
      f.textContent = `💥 +${(bonus/1000).toFixed(1)}K ZION`;
      f.style.fontSize = '15px';
      f.style.left = `${pr.left - sr.left + pr.width/2 - 32}px`;
      f.style.top  = `${pr.top  - sr.top  - 8}px`;
      scene.appendChild(f); setTimeout(() => f.remove(), 1500);
      const lines = ['💀 That\'s no moon... wait, it IS! (+ZION)', '🔫 The Force is strong with this wallet', '🚀 Rebel ZION fleet victorious!', '⊗ Exhaust port located — bonus mined!'];
      const msgEl = document.getElementById('gm-msg');
      if (msgEl) msgEl.textContent = lines[Math.floor(Math.random() * lines.length)];
      _gmUpdateStats(state); _gmCheckMilestones(state); _gmRenderAchievements(state); _gmSave(state);
    });
  }

  /* ── Baby Yoda / Grogu click ── */
  const yodaEl = document.getElementById('cs-yoda');
  if (yodaEl && scene) {
    yodaEl.addEventListener('click', () => {
      const bonus = 500;
      state.zion += bonus; state.zionTotal += bonus;
      state.yodaVisited = true;
      const pr = yodaEl.getBoundingClientRect(); const sr = scene.getBoundingClientRect();
      const f = document.createElement('div');
      f.className = 'cs-float'; f.textContent = `+${bonus} ZION 🐸`;
      f.style.fontSize = '14px';
      f.style.left = `${pr.left - sr.left + pr.width/2 - 24}px`;
      f.style.top  = `${pr.top  - sr.top  - 8}px`;
      scene.appendChild(f); setTimeout(() => f.remove(), 1500);
      const wisdoms = ['🐸 "Mine ZION, you must." — Grogu', '🌿 Rich in ZION, one becomes.', '🐸 Do or do not, there is no NGMI.', '✨ Much ZION, I sense in you, young ser.'];
      const msgEl = document.getElementById('gm-msg');
      if (msgEl) msgEl.textContent = wisdoms[Math.floor(Math.random() * wisdoms.length)];
      _gmUpdateStats(state); _gmCheckMilestones(state); _gmRenderAchievements(state); _gmSave(state);
    });
  }

  /* ── Moon click (main action) ── */
  const moon = document.getElementById('gm-moon');
  if (moon && scene) {
    moon.addEventListener('click', () => {
      const perClick = _gmPerClick(state);
      state.zion      += perClick;
      state.zionTotal += perClick;
      state.clicks++;
      state.blockNum++;

      /* Floating +N from moon center */
      const mr = moon.getBoundingClientRect();
      const sr = scene.getBoundingClientRect();
      const f  = document.createElement('div');
      f.className   = 'cs-float';
      f.textContent = `+${_gmFmt(perClick)}`;
      f.style.fontSize = '18px';
      f.style.left = `${mr.left - sr.left + mr.width/2 - 22 + (Math.random()*36-18)}px`;
      f.style.top  = `${mr.top  - sr.top  + mr.height/2 - 20}px`;
      scene.appendChild(f);
      setTimeout(() => f.remove(), 1250);

      /* Moon shake */
      moon.classList.add('cs-clicked');
      setTimeout(() => moon.classList.remove('cs-clicked'), 230);

      /* Hide hint */
      if (state.clicks === 1) {
        const hint = document.getElementById('gm-hint');
        if (hint) hint.style.display = 'none';
      }

      /* Random message every 7 clicks */
      if (state.clicks % 7 === 0 || state.clicks === 1) {
        const msgEl = document.getElementById('gm-msg');
        if (msgEl) msgEl.textContent = GM_MSGS[Math.floor(Math.random()*GM_MSGS.length)];
      }

      _gmUpdateStats(state);
      _gmCheckMilestones(state);
      _gmRenderUpgrades(state);
      _gmRenderMiners(state);
      _gmRenderAchievements(state);
      _gmUpdateShips(state, scene);
      _gmSave(state);
    });
  }

  /* ── Auto-miner tick (10×/sec) ── */
  setInterval(() => {
    const perSec = _gmPerSec(state);
    if (perSec > 0) {
      const tick = perSec / 10;
      state.zion      += tick;
      state.zionTotal += tick;
      _gmUpdateStats(state);
      _gmCheckMilestones(state);
    }
  }, 100);

  /* ── Block ticker ── */
  setInterval(() => {
    state.blockNum++;
    const el = document.getElementById('gm-block');
    if (el) el.textContent = state.blockNum.toLocaleString();
  }, 8000);

  /* ── Mission clock T+HH:MM:SS ── */
  setInterval(() => {
    const el = document.getElementById('cs-timer');
    if (!el) return;
    const secs = Math.floor((Date.now() - _gmMissionStart) / 1000);
    const hh   = String(Math.floor(secs / 3600)).padStart(2, '0');
    const mm   = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    const ss   = String(secs % 60).padStart(2, '0');
    el.textContent = `T+${hh}:${mm}:${ss}`;
  }, 1000);

  /* ── Random UFO fly-by every 3 minutes (ambient) ── */
  setInterval(() => {
    if (Math.random() < 0.3 && state.zionTotal >= 100) _gmTriggerUFO(state);
  }, 180000);

  /* ── Enterprise fly-by every 5 minutes (30% chance if >= 500 ZION) ── */
  setInterval(() => {
    if (Math.random() < 0.3 && state.zionTotal >= 500) _gmTriggerEnterprise(state);
  }, 300000);

  /* ── Auto-save every 5s ── */
  setInterval(() => _gmSave(state), 5000);

  /* ── Reset ── */
  const resetBtn = document.getElementById('gm-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (!confirm('🗑 Reset all Cosmic Mine progress?')) return;
      localStorage.removeItem(GM_SAVE_KEY);
      Object.assign(state, _gmDefState());
      _gmShownMilestones.clear();
      _gmPlanetsClicked.clear();
      _gmMissionStart = Date.now();
      _gmUpdateStats(state);
      _gmRenderUpgrades(state);
      _gmRenderMiners(state);
      _gmRenderAchievements(state);
      _gmUpdateShips(state, document.getElementById('gm-scene'));
      const hint = document.getElementById('gm-hint');
      if (hint) hint.style.display = '';
      const msgEl = document.getElementById('gm-msg');
      if (msgEl) msgEl.textContent = 'gm! 🌙 Click the moon · click planets for bonus ZION 🪐';
    });
  }

  /* ── Initial render ── */
  _gmUpdateStats(state);
  _gmRenderUpgrades(state);
  _gmRenderMiners(state);
  _gmRenderAchievements(state);
  _gmUpdateShips(state, scene);

  dbg('[GAME] 🚀 Cosmic Mine ready!');
}

function _gmUpdateStats(state) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('gm-balance',   _gmFmt(state.zion));
  set('gm-total',     _gmFmt(state.zionTotal));
  set('gm-per-click', _gmFmt(_gmPerClick(state)));
  set('gm-per-sec',   _gmPerSec(state).toFixed(1));
  set('gm-clicks',    state.clicks.toLocaleString());
  set('gm-block',     state.blockNum.toLocaleString());
}

function _gmRenderUpgrades(state) {
  const el = document.getElementById('gm-upgrades');
  if (!el) return;
  el.innerHTML = GM_UPGRADES.map(u => {
    const cost = _gmUpgCost(u, state.upgrades[u.id]);
    const can  = state.zion >= cost;
    return `<button class="game-upgrade-btn${can?' affordable':''}" data-gupg="${u.id}"${can?'':' disabled'}>
      <span class="game-upg-icon">${u.icon}</span>
      <div class="game-upg-info">
        <div class="game-upg-name">${u.name}</div>
        <div class="game-upg-desc">${u.desc}</div>
      </div>
      <div class="game-upg-right">
        <div class="game-upg-cost">⚡${_gmFmt(cost)}</div>
        <div class="game-upg-count">owned: ${state.upgrades[u.id]||0}</div>
      </div>
    </button>`;
  }).join('');
  el.querySelectorAll('[data-gupg]').forEach(btn => {
    btn.addEventListener('click', () => {
      const upg  = GM_UPGRADES.find(u => u.id === btn.dataset.gupg);
      const cost = _gmUpgCost(upg, state.upgrades[upg.id]);
      if (state.zion < cost) return;
      state.zion -= cost;
      state.upgrades[upg.id] = (state.upgrades[upg.id]||0) + 1;
      _gmRenderUpgrades(state);
      _gmUpdateStats(state);
      _gmRenderAchievements(state);
      _gmSave(state);
      const msgEl = document.getElementById('gm-msg');
      if (msgEl) msgEl.textContent = `⚡ ${upg.name} level ${state.upgrades[upg.id]}! 🔥`;
    });
  });
}

function _gmRenderMiners(state) {
  const el = document.getElementById('gm-miners');
  if (!el) return;
  el.innerHTML = `<div class="miner-card-grid">${GM_MINERS.map(m => {
    const cnt  = state.miners[m.id]||0;
    const cost = Math.round(m.baseCost * Math.pow(m.costMult, cnt));
    const can  = state.zion >= cost;
    const totalRate = (m.rate * cnt).toFixed(1);
    return `<button class="miner-card${can?' affordable':''}" data-gminer="${m.id}"${can?'':' disabled'}>
      <span class="miner-card-icon">${m.icon}</span>
      <div class="miner-card-name">${m.name}</div>
      <div class="miner-card-rate">${cnt>0?totalRate+'/sec':m.desc}</div>
      <div class="miner-card-cost">⚡${_gmFmt(cost)}</div>
      <div class="miner-card-cnt">owned: ${cnt}</div>
    </button>`;
  }).join('')}</div>`;
  el.querySelectorAll('[data-gminer]').forEach(btn => {
    btn.addEventListener('click', () => {
      const miner = GM_MINERS.find(m => m.id === btn.dataset.gminer);
      const cnt   = state.miners[miner.id]||0;
      const cost  = Math.round(miner.baseCost * Math.pow(miner.costMult, cnt));
      if (state.zion < cost) return;
      state.zion -= cost;
      state.miners[miner.id] = cnt + 1;
      _gmRenderMiners(state);
      _gmUpdateStats(state);
      _gmRenderAchievements(state);
      _gmUpdateShips(state, document.getElementById('gm-scene'));
      _gmSave(state);
      const msgEl = document.getElementById('gm-msg');
      if (msgEl) msgEl.textContent = `🛸 ${miner.name} deployed! (${state.miners[miner.id]} in fleet)`;
    });
  });
}

function _gmUpdateShips(state, scene) {
  const container = document.getElementById('cs-ships');
  if (!container || !scene) return;
  const cx = scene.offsetWidth  / 2;
  const cy = scene.offsetHeight / 2;
  let h = '';
  GM_MINERS.forEach((m, mi) => {
    const cnt = Math.min(state.miners[m.id]||0, 5);
    for (let i = 0; i < cnt; i++) {
      const r     = 100 + mi * 26 + i * 8;
      const spd   = 9 + mi * 2.5 + i * 1.5;
      const delay = -(Math.random() * spd).toFixed(1);
      const sz    = Math.max(12, 20 - mi * 1.5);
      h += `<div class="cs-ship" style="left:${cx}px;top:${cy}px;font-size:${sz}px;--orbit-r:${r}px;--orbit-speed:${spd}s;animation-delay:${delay}s">${m.ship}</div>`;
    }
  });
  container.innerHTML = h;
}

function _gmRenderAchievements(state) {
  const el    = document.getElementById('gm-achievements');
  const cntEl = document.getElementById('gm-ach-count');
  if (!el) return;
  let unlocked = 0;
  el.innerHTML = GM_ACHIEVEMENTS.map(a => {
    const done = a.cond(state);
    if (done) {
      if (!state.achievements[a.id]) {
        state.achievements[a.id] = true;
        const msgEl = document.getElementById('gm-msg');
        if (msgEl) msgEl.textContent = `🏆 Achievement unlocked: ${a.name}!`;
      }
      unlocked++;
      return `<div class="game-ach">${a.name}</div>`;
    }
    return `<div class="game-ach locked">???</div>`;
  }).join('');
  if (cntEl) cntEl.textContent = `(${unlocked}/${GM_ACHIEVEMENTS.length})`;
}

function _gmCheckMilestones(state) {
  for (const ms of GM_MILESTONES) {
    if (state.zionTotal >= ms.at && !_gmShownMilestones.has(ms.at)) {
      _gmShownMilestones.add(ms.at);
      _gmShowMilestone(ms);
      if (ms.ufo) _gmTriggerUFO(state);
      break;
    }
  }
}

function _gmTriggerUFO(state) {
  const ufo = document.getElementById('cs-ufo');
  if (!ufo) return;
  ufo.classList.remove('cs-ufo-fly');
  void ufo.offsetWidth;
  ufo.classList.add('cs-ufo-fly');
  state.ufoSeen = true;
  setTimeout(() => {
    ufo.classList.remove('cs-ufo-fly');
    _gmRenderAchievements(state);
    _gmSave(state);
  }, 5000);
}

function _gmTriggerEnterprise(state) {
  const ent = document.getElementById('cs-enterprise');
  if (!ent) return;
  ent.classList.remove('cs-trek-fly');
  void ent.offsetWidth;
  ent.classList.add('cs-trek-fly');
  state.enterpriseSeen = true;
  const msgEl = document.getElementById('gm-msg');
  if (msgEl) {
    const lines = ['🖖 USS Enterprise detected! Live long and ZION!', '🚀 Beam me up some ZION, Scotty!', '🖖 Warp factor 9... to the moon!', '⚡ Captain\'s log: ZION holdings nominal'];
    msgEl.textContent = lines[Math.floor(Math.random() * lines.length)];
  }
  setTimeout(() => {
    ent.classList.remove('cs-trek-fly');
    _gmRenderAchievements(state);
    _gmSave(state);
  }, 6500);
}

function _gmShowMilestone(ms) {
  const el = document.getElementById('gm-milestone');
  if (!el) return;
  el.innerHTML = `
    <span class="ms-emoji">${ms.emoji}</span>
    <div class="ms-title">${ms.title}</div>
    <div class="ms-sub">${ms.sub}</div>
    <div style="margin-top:18px">
      <button class="bridge-btn" id="gm-ms-close">awesome! 🎉</button>
    </div>`;
  el.style.display = 'block';
  const close = el.querySelector('#gm-ms-close');
  if (close) close.addEventListener('click', () => { el.style.display = 'none'; });
  setTimeout(() => { el.style.display = 'none'; }, 7000);
}

// ═══════════════════════════════════════════════════
// DAO — On-Chain Governance (L2)
// ═══════════════════════════════════════════════════

const DAO_PROPOSALS = [
  { id: 'PROP-001', title: 'Increase daily spend limit to 150M ZION', type: 'Parameter', status: 'Active', desc: 'Raise treasury daily spend limit from 100M to 150M ZION to support upcoming ecosystem growth and grant program expansion.', yes: 67, no: 18, abstain: 15, endDate: '2026-07-22' },
  { id: 'PROP-002', title: 'Fund wZION Bridge security audit', type: 'Treasury', status: 'Passed', desc: 'Allocate 2.5M ZION to fund a comprehensive security audit of the wZION bridge smart contracts by Trail of Bits.', yes: 89, no: 6, abstain: 5, endDate: '2026-07-15' },
  { id: 'PROP-003', title: 'Emergency: Pause bridge for upgrade', type: 'Emergency', status: 'Executed', desc: 'Temporary pause of bridge operations during v2.9.6 smart contract upgrade window (48h max).', yes: 92, no: 3, abstain: 5, endDate: '2026-07-10' },
  { id: 'PROP-004', title: 'Developer grant: ZION SDK for Rust', type: 'Grant', status: 'Active', desc: 'Milestone-based grant of 500K ZION for development of a Rust SDK. 3 milestones over 6 months.', yes: 54, no: 21, abstain: 25, endDate: '2026-07-25' },
  { id: 'PROP-005', title: 'Humanitarian: Clean water initiative', type: 'Humanitarian', status: 'Timelocked', desc: 'Allocate 10M ZION from humanitarian fund for clean water projects in Sub-Saharan Africa. Category: Water.', yes: 78, no: 12, abstain: 10, endDate: '2026-07-12' },
];

const DAO_GUARDIANS = [
  { name: 'Guardian Alpha',   key: 'zion1q...a7f3', icon: '◈', status: 'active' },
  { name: 'Guardian Bravo',   key: 'zion1w...b8e4', icon: '◈', status: 'active' },
  { name: 'Guardian Charlie', key: 'zion1e...c9d5', icon: '◈', status: 'active' },
  { name: 'Guardian Delta',   key: 'zion1r...d0c6', icon: '◈', status: 'active' },
  { name: 'Guardian Echo',    key: 'zion1t...e1b7', icon: '◈', status: 'active' },
  { name: 'Guardian Foxtrot', key: 'zion1y...f2a8', icon: '◈', status: 'standby' },
  { name: 'Guardian Golf',    key: 'zion1u...g3z9', icon: '◈', status: 'standby' },
];

const DAO_HUMANITARIAN_CATEGORIES = [
  { icon: '◆', name: 'Clean Water', allocated: '205,714,286', color: '#06b6d4' },
  { icon: '◈', name: 'Food Security', allocated: '205,714,286', color: '#ffd700' },
  { icon: '⌂', name: 'Shelter', allocated: '205,714,286', color: '#9333ea' },
  { icon: '◎', name: 'Environment', allocated: '205,714,286', color: '#00ff88' },
  { icon: '+',  name: 'Healthcare', allocated: '205,714,286', color: '#f87171' },
  { icon: '≡', name: 'Education', allocated: '205,714,286', color: '#818cf8' },
  { icon: '!',  name: 'Disaster Relief', allocated: '205,714,280', color: '#fb923c' },
];

let _daoInitialized = false;
let _daoRefreshTimer = null;

function initDaoView() {
  if (_daoInitialized) return;
  _daoInitialized = true;
  dbg('[DAO] Initializing DAO view — connecting to live API');

  /* — Render static guardians / humanitarian (always visible) — */
  const gGrid = document.getElementById('dao-guardian-grid');
  if (gGrid) {
    gGrid.innerHTML = DAO_GUARDIANS.map(g => {
      const col = g.status === 'active' ? '#00ff88' : 'rgba(255,255,255,0.25)';
      return `<div class="dao-guardian">
        <div class="dao-guardian-icon">${g.icon}</div>
        <div class="dao-guardian-name">${g.name}</div>
        <div class="dao-guardian-status" style="color:${col}">● ${g.status}</div>
        <div style="font-size:10px; color:rgba(255,255,255,0.25); margin-top:6px; font-family:monospace">${g.key}</div>
      </div>`;
    }).join('');
  }
  const hGrid = document.getElementById('dao-humanitarian-grid');
  if (hGrid) {
    hGrid.innerHTML = DAO_HUMANITARIAN_CATEGORIES.map(c =>
      `<div class="tithe-card">
        <div class="tithe-icon" style="color:${c.color}">${c.icon}</div>
        <div class="tithe-cat">${c.name}</div>
        <div class="tithe-amount" style="color:${c.color}">${c.allocated} ZION</div>
      </div>`
    ).join('');
  }

  /* — Live data fetch — */
  void refreshDaoData();

  /* — Refresh button — */
  const btn = document.getElementById('dao-refresh-btn');
  if (btn) btn.addEventListener('click', () => void refreshDaoData());

  /* — Auto-refresh every 60s while DAO tab is open — */
  _daoRefreshTimer = setInterval(() => {
    if (currentView === 'dao') void refreshDaoData();
    else { clearInterval(_daoRefreshTimer); _daoRefreshTimer = null; }
  }, 60000);

  setupSectionTabs();
  dbg('[DAO] View initialized');
}

async function refreshDaoData() {
  /* — Status indicator — */
  const statusEl = document.getElementById('dao-connection-status');
  if (statusEl) { statusEl.textContent = '…'; statusEl.style.color = 'rgba(255,255,255,0.4)'; }

  try {
    /* ── Stats ── */
    const statsRes = await window.electronAPI.daoGetStats();
    if (statsRes.success) {
      const s = statsRes;
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      const fmt = (n) => n != null ? Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—';
      set('dao-total-proposals',  fmt(s.total_proposals));
      set('dao-active-proposals', fmt(s.active_proposals));
      set('dao-passed-proposals', fmt(s.passed_proposals));
      set('dao-total-votes',      fmt(s.total_votes));
      if (statusEl) { statusEl.textContent = '● Live'; statusEl.style.color = '#00ff88'; }
    }

    /* ── Proposals ── */
    const propRes = await window.electronAPI.daoGetProposals({ limit: 20 });
    const proposals = propRes.success && Array.isArray(propRes.proposals) ? propRes.proposals : null;
    const listEl = document.getElementById('dao-proposal-list');
    if (listEl) {
      if (proposals && proposals.length > 0) {
        listEl.innerHTML = proposals.map(p => {
          const total = (p.votes_yes || 0) + (p.votes_no || 0) + (p.votes_abstain || 0);
          const yesPct     = total > 0 ? Math.round((p.votes_yes    || 0) / total * 100) : 0;
          const noPct      = total > 0 ? Math.round((p.votes_no     || 0) / total * 100) : 0;
          const abstainPct = total > 0 ? Math.round((p.votes_abstain|| 0) / total * 100) : 0;
          const statusCls  = 'dao-status-' + (p.status || 'active').toLowerCase();
          return `<div class="dao-proposal">
            <div class="dao-proposal-header">
              <div class="dao-proposal-title">${p.id} — ${p.title || ''}</div>
              <div class="dao-status-badge ${statusCls}">${p.status || 'Active'}</div>
            </div>
            <div class="dao-proposal-desc">${p.description || ''}</div>
            <div class="dao-vote-bar">
              <div class="dao-vote-yes"     style="width:${yesPct}%"></div>
              <div class="dao-vote-no"      style="width:${noPct}%"></div>
              <div class="dao-vote-abstain" style="width:${abstainPct}%"></div>
            </div>
            <div class="dao-vote-labels">
              <span>Yes ${yesPct}%</span>
              <span>Type: ${p.proposal_type || 'General'}</span>
              <span>No ${noPct}%</span>
            </div>
          </div>`;
        }).join('');
      } else {
        /* Fallback to mock data when API is offline */
        listEl.innerHTML = DAO_PROPOSALS.map(p => {
          const statusCls = 'dao-status-' + p.status.toLowerCase();
          return `<div class="dao-proposal">
            <div class="dao-proposal-header">
              <div class="dao-proposal-title">${p.id} — ${p.title}</div>
              <div class="dao-status-badge ${statusCls}">${p.status}</div>
            </div>
            <div class="dao-proposal-desc">${p.desc}</div>
            <div class="dao-vote-bar">
              <div class="dao-vote-yes"     style="width:${p.yes}%"></div>
              <div class="dao-vote-no"      style="width:${p.no}%"></div>
              <div class="dao-vote-abstain" style="width:${p.abstain}%"></div>
            </div>
            <div class="dao-vote-labels">
              <span>Yes ${p.yes}%</span>
              <span>Type: ${p.type}</span>
              <span>No ${p.no}%</span>
            </div>
          </div>`;
        }).join('');
      }
    }

    /* ── Treasury ── */
    const treasRes = await window.electronAPI.daoGetTreasury();
    if (treasRes.success) {
      const t = treasRes;
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      const fmtM = (n) => n != null ? (Number(n) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'M ZION' : '—';
      set('dao-daily-spent',    fmtM(t.daily_spent));
      set('dao-ops-pending',    t.pending_ops != null ? String(t.pending_ops) : '—');
      set('dao-total-disbursed',fmtM(t.total_disbursed));
      set('dao-signers',        t.signers || '—');
    }

  } catch (e) {
    dbg('[DAO] API error:', e.message);
    if (statusEl) { statusEl.textContent = '● Offline'; statusEl.style.color = '#f87171'; }

    /* Fallback treasury stats */
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('dao-daily-spent',     '12.3M ZION');
    set('dao-ops-pending',     '2');
    set('dao-total-disbursed', '347M ZION');
    set('dao-signers',         '5 / 7');
  }
}

// ═══════════════════════════════════════════════════
// WARP — Cross-Chain Corridors (L3)
// ═══════════════════════════════════════════════════

const WARP_CHAINS = [
  { name: 'Base',     family: 'EVM',     icon: '◎',  fee: '0.10%', finality: 12,  enabled: true },
  { name: 'Arbitrum', family: 'EVM',     icon: '▲',  fee: '0.10%', finality: 12,  enabled: true },
  { name: 'BSC',      family: 'EVM',     icon: '◈',  fee: '0.12%', finality: 15,  enabled: true },
  { name: 'Polygon',  family: 'EVM',     icon: '◉',  fee: '0.10%', finality: 64,  enabled: true },
  { name: 'Solana',   family: 'Solana',  icon: '○',  fee: '0.15%', finality: 32,  enabled: false },
  { name: 'Bitcoin',  family: 'Bitcoin', icon: '◇',  fee: '0.25%', finality: 6,   enabled: false },
  { name: 'Tron',     family: 'Tron',    icon: '△',  fee: '0.15%', finality: 20,  enabled: false },
  { name: 'Stellar',  family: 'Stellar', icon: '⚪', fee: '0.08%', finality: 5,   enabled: false },
  { name: 'Cardano',  family: 'Cardano', icon: '≋',  fee: '0.18%', finality: 30,  enabled: false },
  { name: 'Cosmos',   family: 'Cosmos',  icon: '⚛️',  fee: '0.12%', finality: 10,  enabled: false },
];

const WARP_STATUS_FLOW = [
  'Pending', 'Detected', 'AwaitingFinality', 'Validating',
  'QuorumReached', 'Executing', 'Completed'
];

const WARP_FEE_ROUTES = [
  { from: 'ZION L1', to: 'Base',     rate: '0.10%', min: '1 ZION', max: '50,000 ZION' },
  { from: 'ZION L1', to: 'Arbitrum', rate: '0.10%', min: '1 ZION', max: '50,000 ZION' },
  { from: 'ZION L1', to: 'BSC',      rate: '0.12%', min: '1 ZION', max: '50,000 ZION' },
  { from: 'ZION L1', to: 'Polygon',  rate: '0.10%', min: '1 ZION', max: '50,000 ZION' },
  { from: 'ZION L1', to: 'Solana',   rate: '0.15%', min: '2 ZION', max: '40,000 ZION' },
  { from: 'ZION L1', to: 'Bitcoin',  rate: '0.25%', min: '10 ZION', max: '100,000 ZION' },
  { from: 'ZION L1', to: 'Tron',     rate: '0.15%', min: '1 ZION', max: '40,000 ZION' },
  { from: 'ZION L1', to: 'Stellar',  rate: '0.08%', min: '0.5 ZION', max: '30,000 ZION' },
  { from: 'ZION L1', to: 'Cardano',  rate: '0.18%', min: '2 ZION', max: '40,000 ZION' },
  { from: 'ZION L1', to: 'Cosmos',   rate: '0.12%', min: '1 ZION', max: '40,000 ZION' },
];

const WARP_VALIDATORS = [
  { name: 'Warp Validator 1', key: 'ed25519:warp1...v1x', status: 'active' },
  { name: 'Warp Validator 2', key: 'ed25519:warp2...v2y', status: 'active' },
  { name: 'Warp Validator 3', key: 'ed25519:warp3...v3z', status: 'active' },
  { name: 'Warp Validator 4', key: 'ed25519:warp4...v4w', status: 'standby' },
  { name: 'Warp Validator 5', key: 'ed25519:warp5...v5q', status: 'standby' },
];

let _warpInitialized = false;
let _warpRefreshTimer = null;

function initWarpView() {
  if (_warpInitialized) return;
  _warpInitialized = true;
  dbg('[WARP] Initializing Warp view — connecting to live API');

  /* — Status flow (static) — */
  const flowEl = document.getElementById('warp-status-flow');
  if (flowEl) {
    flowEl.innerHTML = WARP_STATUS_FLOW.map((s, i) => {
      const active = i === 0 ? ' flow-active' : '';
      const arrow  = i < WARP_STATUS_FLOW.length - 1 ? '<span class="warp-flow-arrow">→</span>' : '';
      return `<span class="warp-flow-step${active}">${s}</span>${arrow}`;
    }).join('');
  }

  /* — Fee split (static) — */
  const feeEl = document.getElementById('warp-fee-split');
  if (feeEl) {
    feeEl.innerHTML = [
      { pct: '50%', label: 'Burned',       color: '#f87171' },
      { pct: '25%', label: 'DAO Treasury', color: 'var(--zion-gold)' },
      { pct: '25%', label: 'Validators',   color: 'var(--zion-cyan)' },
    ].map(f => `<div class="warp-fee-slice">
      <div class="warp-fee-pct"   style="color:${f.color}">${f.pct}</div>
      <div class="warp-fee-label">${f.label}</div>
    </div>`).join('');
  }

  /* — Validators (static) — */
  const vGrid = document.getElementById('warp-validator-grid');
  if (vGrid) {
    vGrid.innerHTML = WARP_VALIDATORS.map(v => {
      const col = v.status === 'active' ? '#00ff88' : 'rgba(255,255,255,0.25)';
      return `<div class="dao-guardian">
        <div class="dao-guardian-icon">◈</div>
        <div class="dao-guardian-name">${v.name}</div>
        <div class="dao-guardian-status" style="color:${col}">● ${v.status}</div>
        <div style="font-size:10px; color:rgba(255,255,255,0.25); margin-top:6px; font-family:monospace">${v.key}</div>
      </div>`;
    }).join('');
  }

  /* — Fee routes table (static fallback, overwritten by live data) — */
  const feeBody = document.getElementById('warp-fees-body');
  if (feeBody) {
    feeBody.innerHTML = WARP_FEE_ROUTES.map(r =>
      `<tr><td>${r.from} → ${r.to}</td><td>${r.rate}</td><td>${r.min}</td><td>${r.max}</td></tr>`
    ).join('');
  }

  /* — Dest-chain fee display — */
  const sel = document.getElementById('warp-dest-chain');
  const feeDisp = document.getElementById('warp-fee-display');
  if (sel && feeDisp) {
    sel.addEventListener('change', () => {
      const ch = WARP_CHAINS.find(c => c.name.toLowerCase() === sel.value);
      if (ch) feeDisp.textContent = ch.fee;
    });
  }

  /* — Live data fetch — */
  void refreshWarpData();

  /* — Refresh button — */
  const btn = document.getElementById('warp-refresh-btn');
  if (btn) btn.addEventListener('click', () => void refreshWarpData());

  /* — Auto-refresh every 30s while WARP tab is open — */
  _warpRefreshTimer = setInterval(() => {
    if (currentView === 'warp') void refreshWarpData();
    else { clearInterval(_warpRefreshTimer); _warpRefreshTimer = null; }
  }, 30000);

  setupSectionTabs();
  dbg('[WARP] View initialized');
}

async function refreshWarpData() {
  const statusEl = document.getElementById('warp-connection-status');
  if (statusEl) { statusEl.textContent = '…'; statusEl.style.color = 'rgba(255,255,255,0.4)'; }

  try {
    /* ── Health + Metrics ── */
    const [healthRes, chainsRes, transfersRes] = await Promise.allSettled([
      window.electronAPI.warpGetHealth(),
      window.electronAPI.warpGetChains(),
      window.electronAPI.warpGetTransfers(),
    ]);

    /* — Health — */
    if (healthRes.status === 'fulfilled' && healthRes.value.success !== false) {
      const h = healthRes.value;
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('warp-node-id',            h.node || h.node_id || '—');
      set('warp-transfers-total',    h.transfers_total   != null ? String(h.transfers_total)   : '—');
      set('warp-transfers-pending',  h.transfers_pending != null ? String(h.transfers_pending) : '—');
      set('warp-version',            h.version || '2.9.6');
      if (statusEl) { statusEl.textContent = '● Live'; statusEl.style.color = '#00ff88'; }
    }

    /* — Chains — */
    if (chainsRes.status === 'fulfilled' && chainsRes.value.success !== false) {
      const chains = chainsRes.value.chains;
      const chainGrid = document.getElementById('warp-chain-grid');
      if (chainGrid && Array.isArray(chains) && chains.length > 0) {
        chainGrid.innerHTML = chains.map(c => {
          const enabled = c.enabled !== false;
          const cls     = enabled ? 'chain-enabled' : 'chain-disabled';
          const badge   = enabled
            ? '<span style="color:#00ff88; font-size:10px">● Live</span>'
            : '<span style="color:rgba(255,255,255,0.25); font-size:10px">○ Stub</span>';
          return `<div class="warp-chain-card ${cls}">
            <div class="warp-chain-icon">${c.icon || '◎'}</div>
            <div class="warp-chain-name">${c.name || c.chain_id || '?'}</div>
            <div class="warp-chain-family">${c.family || c.chain_type || ''}</div>
            <div class="warp-chain-fee">Fee: ${c.fee_rate || c.fee || '—'}</div>
            <div style="font-size:10px; color:rgba(255,255,255,0.3); margin-top:4px">Finality: ${c.finality_blocks || c.finality || '—'} blocks</div>
            <div style="margin-top:6px">${badge}</div>
          </div>`;
        }).join('');
      } else if (chainGrid) {
        /* Fallback to static if API returns empty */
        chainGrid.innerHTML = WARP_CHAINS.map(c => {
          const cls   = c.enabled ? 'chain-enabled' : 'chain-disabled';
          const badge = c.enabled
            ? '<span style="color:#00ff88; font-size:10px">● Live</span>'
            : '<span style="color:rgba(255,255,255,0.25); font-size:10px">○ Stub</span>';
          return `<div class="warp-chain-card ${cls}">
            <div class="warp-chain-icon">${c.icon}</div>
            <div class="warp-chain-name">${c.name}</div>
            <div class="warp-chain-family">${c.family}</div>
            <div class="warp-chain-fee">Fee: ${c.fee}</div>
            <div style="font-size:10px; color:rgba(255,255,255,0.3); margin-top:4px">Finality: ${c.finality} blocks</div>
            <div style="margin-top:6px">${badge}</div>
          </div>`;
        }).join('');
      }
    } else {
      /* Fallback to static chains */
      const chainGrid = document.getElementById('warp-chain-grid');
      if (chainGrid) {
        chainGrid.innerHTML = WARP_CHAINS.map(c => {
          const cls   = c.enabled ? 'chain-enabled' : 'chain-disabled';
          const badge = c.enabled
            ? '<span style="color:#00ff88; font-size:10px">● Live</span>'
            : '<span style="color:rgba(255,255,255,0.25); font-size:10px">○ Stub</span>';
          return `<div class="warp-chain-card ${cls}">
            <div class="warp-chain-icon">${c.icon}</div>
            <div class="warp-chain-name">${c.name}</div>
            <div class="warp-chain-family">${c.family}</div>
            <div class="warp-chain-fee">Fee: ${c.fee}</div>
            <div style="font-size:10px; color:rgba(255,255,255,0.3); margin-top:4px">Finality: ${c.finality} blocks</div>
            <div style="margin-top:6px">${badge}</div>
          </div>`;
        }).join('');
      }
    }

    /* — Transfers — */
    if (transfersRes.status === 'fulfilled' && transfersRes.value.success !== false) {
      const transfers = transfersRes.value.transfers;
      const txBody = document.getElementById('warp-transfers-body');
      if (txBody && Array.isArray(transfers) && transfers.length > 0) {
        txBody.innerHTML = transfers.slice(0, 20).map(t => {
          const statusColor = t.status === 'Completed' ? '#00ff88'
            : t.status === 'Failed' ? '#f87171'
            : 'var(--zion-gold)';
          const shortId = String(t.id || '').slice(0, 8) + '…';
          return `<tr>
            <td title="${t.id || ''}" style="font-family:monospace;font-size:11px">${shortId}</td>
            <td>${t.source_chain || '—'} → ${t.dest_chain || '—'}</td>
            <td>${t.amount_zion != null ? Number(t.amount_zion).toLocaleString() + ' ZION' : '—'}</td>
            <td style="color:${statusColor}">${t.status || '—'}</td>
          </tr>`;
        }).join('');
      } else if (txBody) {
        txBody.innerHTML = '<tr><td colspan="4" style="text-align:center; opacity:0.4; padding:16px">No transfers yet</td></tr>';
      }
    }

  } catch (e) {
    dbg('[WARP] API error:', e.message);
    if (statusEl) { statusEl.textContent = '● Offline'; statusEl.style.color = '#f87171'; }
    /* Fallback to static chains on total failure */
    const chainGrid = document.getElementById('warp-chain-grid');
    if (chainGrid && !chainGrid.innerHTML.trim()) {
      chainGrid.innerHTML = WARP_CHAINS.map(c => {
        const cls   = c.enabled ? 'chain-enabled' : 'chain-disabled';
        const badge = c.enabled
          ? '<span style="color:#00ff88; font-size:10px">● Live</span>'
          : '<span style="color:rgba(255,255,255,0.25); font-size:10px">○ Stub</span>';
        return `<div class="warp-chain-card ${cls}">
          <div class="warp-chain-icon">${c.icon}</div>
          <div class="warp-chain-name">${c.name}</div>
          <div class="warp-chain-family">${c.family}</div>
          <div class="warp-chain-fee">Fee: ${c.fee}</div>
          <div style="font-size:10px; color:rgba(255,255,255,0.3); margin-top:4px">Finality: ${c.finality} blocks</div>
          <div style="margin-top:6px">${badge}</div>
        </div>`;
      }).join('');
    }
  }
}

// ═══════════════════════════════════════════════════════
// FREE WORLD — Sovereignty & Humanitarian Layer (L5)
// ═══════════════════════════════════════════════════════

const FW_PILLARS = [
  { icon: '↯', name: 'Free Energy Research', desc: 'Quantum/free energy R&D, open-source hardware, decentralized energy grids for off-grid communities.' },
  { icon: '♥', name: 'Humanitarian Missions', desc: '5% block reward → Humanitarian Fund, DAO governance for allocation, direct community support worldwide.' },
  { icon: '⌂', name: 'Free Communities', desc: 'Self-sustaining off-grid communities using ZION as native currency with local mesh network infrastructure.' },
  { icon: '≡', name: 'Education & Awareness', desc: 'Open-source educational platforms, consciousness mining integration with L4 Oasis, knowledge sharing.' },
];

const FW_MILESTONES = [
  { year: '2030', text: 'ZION Free World Foundation established', done: false },
  { year: '2031', text: 'First quantum energy research laboratory', done: false },
  { year: '2033', text: 'Prototype quantum generator', done: false },
  { year: '2035', text: 'Pilot deployment in 10 communities', done: false },
  { year: '2037', text: 'Open-source hardware specifications release', done: false },
  { year: '2040', text: 'Mass production — energy for millions', done: false },
];

let _fwInitialized = false;

function initFreeWorldView() {
  if (_fwInitialized) return;
  _fwInitialized = true;
  dbg('[FW] Initializing Free World view');

  /* — Pillars — */
  const pGrid = document.getElementById('fw-pillar-grid');
  if (pGrid) {
    pGrid.innerHTML = FW_PILLARS.map(p =>
      `<div class="fw-pillar-card">
        <div class="fw-pillar-icon">${p.icon}</div>
        <div class="fw-pillar-name">${p.name}</div>
        <div class="fw-pillar-desc">${p.desc}</div>
      </div>`
    ).join('');
  }

  /* — Milestones — */
  const mList = document.getElementById('fw-milestone-list');
  if (mList) {
    mList.innerHTML = FW_MILESTONES.map(m =>
      `<div class="fw-milestone-row">
        <div class="fw-milestone-dot${m.done ? '' : ' future'}"></div>
        <div class="fw-milestone-year">${m.year}</div>
        <div class="fw-milestone-text">${m.text}</div>
      </div>`
    ).join('');
  }

  setupSectionTabs();
  dbg('[FW] View initialized');
}

// ═══════════════════════════════════════════════════════
// ISSOBELLA — Orbital Observatory & Station (L6)
// ═══════════════════════════════════════════════════════

const ISS_MISSION_PILLARS = [
  { icon: '◎', name: 'Earth Orbital Observatory', desc: 'LEO observatory with decentralized management via ZION DAO. Open data for all humanity.' },
  { icon: '◆', name: 'Research Station', desc: 'Microgravity experiments, biological research, deep-space technology development.' },
  { icon: '◈', name: 'ZION Space Network', desc: 'Satellite mesh network, redundant orbital nodes, independence from terrestrial infrastructure.' },
];

const ISS_STATION_MODULES = [
  { icon: '◎', name: 'ZION Node Module', desc: 'Radiation-hardened FPGA running full ZION consensus in orbit' },
  { icon: '◈', name: 'Communications Hub', desc: 'ISL mesh links + ground station relay for block propagation' },
  { icon: '○', name: 'Solar Power Array', desc: 'Solar panels + battery systems for continuous LEO operation' },
  { icon: '◆', name: 'Research Lab', desc: 'Microgravity experiments, biology, materials science' },
  { icon: '⌂', name: 'Habitat Module', desc: 'Crew quarters for visiting researchers and operators' },
  { icon: '▲', name: 'Docking Port', desc: 'Standardized docking for CubeSat deployment and resupply' },
];

const ISS_MILESTONES = [
  { year: '2026', text: 'Mainnet launch, Issobella fund begins accumulating', done: true },
  { year: '2028', text: 'Feasibility study + space agency partnerships', done: false },
  { year: '2030', text: 'CubeSat prototype with ZION node', done: false },
  { year: '2035', text: 'LEO test module deployment', done: false },
  { year: '2040', text: 'ZION Space Division established', done: false },
  { year: '2042', text: 'Station design finalized', done: false },
  { year: '2045', text: 'Component manufacturing begins', done: false },
  { year: '2048', text: 'First module on orbit', done: false },
  { year: '2050', text: 'Fully operational station', done: false },
  { year: '2055', text: 'Expansion — 2nd and 3rd modules', done: false },
];

let _issInitialized = false;

function initIssobellaView() {
  if (_issInitialized) return;
  _issInitialized = true;
  dbg('[ISS] Initializing Issobella view');

  /* — Mission pillars — */
  const mGrid = document.getElementById('iss-module-grid');
  if (mGrid) {
    mGrid.innerHTML = ISS_MISSION_PILLARS.map(p =>
      `<div class="iss-module-card">
        <div class="iss-module-icon">${p.icon}</div>
        <div class="iss-module-name">${p.name}</div>
        <div class="iss-module-desc">${p.desc}</div>
      </div>`
    ).join('');
  }

  /* — Station modules — */
  const sGrid = document.getElementById('iss-station-grid');
  if (sGrid) {
    sGrid.innerHTML = ISS_STATION_MODULES.map(m =>
      `<div class="iss-module-card">
        <div class="iss-module-icon">${m.icon}</div>
        <div class="iss-module-name">${m.name}</div>
        <div class="iss-module-desc">${m.desc}</div>
        <div class="iss-orbit-badge">LEO Module</div>
      </div>`
    ).join('');
  }

  /* — Timeline — */
  const tList = document.getElementById('iss-timeline-list');
  if (tList) {
    tList.innerHTML = ISS_MILESTONES.map(m =>
      `<div class="fw-milestone-row">
        <div class="fw-milestone-dot${m.done ? '' : ' future'}"></div>
        <div class="fw-milestone-year" style="color:#f43f5e">${m.year}</div>
        <div class="fw-milestone-text">${m.text}</div>
      </div>`
    ).join('');
  }

  setupSectionTabs();
  dbg('[ISS] View initialized');
}

// ═══════════════════════════════════════════════════════════════════
// AUTO-UPDATE UI
// ═══════════════════════════════════════════════════════════════════
let _updateState = { checking: false, available: false, downloading: false, downloaded: false };

function initUpdateUI() {
  const checkBtn = document.getElementById('update-check-btn');
  const installBtn = document.getElementById('update-install-btn');
  const autoCheckbox = document.getElementById('update-auto-check');

  if (checkBtn && !checkBtn._bound) {
    checkBtn._bound = true;
    checkBtn.addEventListener('click', async () => {
      if (_updateState.checking) return;
      _updateState.checking = true;
      _setUpdateStatus('Checking...', 'Contacting update server...', '#93c5fd');
      checkBtn.disabled = true;
      checkBtn.textContent = 'Checking...';

      try {
        const result = await window.electronAPI.checkForUpdates();
        if (!result?.success) {
          _setUpdateStatus('Error', result?.error || 'Check failed', '#f87171');
        } else if (result.updateAvailable) {
          _updateState.available = true;
          _setUpdateStatus('Update Available!', `v${result.latestVersion} ready`, '#6ee7b7');
          _showChangelog(result.releaseNotes, result.latestVersion);
          _showDownloadPrompt(result);
        } else {
          _setUpdateStatus('Up to Date', `v${result.currentVersion} is the latest`, '#6ee7b7');
        }
      } catch (err) {
        _setUpdateStatus('Error', err?.message || 'Check failed', '#f87171');
      } finally {
        _updateState.checking = false;
        checkBtn.disabled = false;
        checkBtn.innerHTML = '<svg class=\"icon\" aria-hidden=\"true\"><use href=\"#i-refresh\"></use></svg> Check for Updates';
      }
    });
  }

  if (installBtn && !installBtn._bound) {
    installBtn._bound = true;
    installBtn.addEventListener('click', async () => {
      try {
        installBtn.disabled = true;
        installBtn.textContent = 'Restarting...';
        await window.electronAPI.installUpdate();
      } catch (err) {
        _setUpdateStatus('Error', err?.message || 'Install failed', '#f87171');
        installBtn.disabled = false;
        installBtn.innerHTML = '<svg class=\"icon\" aria-hidden=\"true\"><use href=\"#i-spark\"></use></svg> Install & Restart';
      }
    });
  }

  // Auto-check toggle
  if (autoCheckbox && !autoCheckbox._bound) {
    autoCheckbox._bound = true;
    // Load saved setting
    window.electronAPI.getUpdateSettings?.().then(s => {
      autoCheckbox.checked = s?.autoCheck !== false;
    }).catch(() => {});
    autoCheckbox.addEventListener('change', () => {
      window.electronAPI.setUpdateAutoCheck?.(autoCheckbox.checked).catch(() => {});
    });
  }

  // Listen for update events from main process
  if (!window._updateListenersBound) {
    window._updateListenersBound = true;

    window.electronAPI.onUpdateStatus?.((data) => {
      switch (data.status) {
        case 'checking':
          _setUpdateStatus('Checking...', 'Contacting update server...', '#93c5fd');
          break;
        case 'available':
          _updateState.available = true;
          _setUpdateStatus('Update Available!', `v${data.version} ready`, '#6ee7b7');
          if (data.releaseNotes) _showChangelog(data.releaseNotes, data.version);
          break;
        case 'up-to-date':
          _setUpdateStatus('Up to Date', 'You have the latest version', '#6ee7b7');
          break;
        case 'downloaded':
          _updateState.downloaded = true;
          _setUpdateStatus('Ready to Install', `v${data.version} downloaded`, '#fcd34d');
          _showInstallBtn();
          break;
        case 'error':
          _setUpdateStatus('Error', data.error || 'Update check failed', '#f87171');
          break;
      }
    });

    window.electronAPI.onUpdateProgress?.((progress) => {
      _updateState.downloading = true;
      _showProgress(progress);
    });
  }
}

function _setUpdateStatus(label, sub, color) {
  const el = document.getElementById('update-status-label');
  const subEl = document.getElementById('update-status-sub');
  if (el) { el.textContent = label; el.style.color = color || ''; }
  if (subEl) subEl.textContent = sub || '';
}

function _showProgress(progress) {
  const wrap = document.getElementById('update-progress-wrap');
  const fill = document.getElementById('update-progress-fill');
  const pct = document.getElementById('update-progress-pct');
  const detail = document.getElementById('update-progress-detail');
  const title = document.getElementById('update-progress-title');

  if (wrap) wrap.style.display = '';
  if (fill) fill.style.width = progress.percent + '%';
  if (pct) pct.textContent = progress.percent + '%';
  if (title) title.textContent = 'Downloading update...';
  if (detail) {
    const mb = (n) => (n / 1024 / 1024).toFixed(1);
    const speed = (progress.bytesPerSecond / 1024 / 1024).toFixed(1);
    detail.textContent = `${mb(progress.transferred)} / ${mb(progress.total)} MB · ${speed} MB/s`;
  }
}

function _showDownloadPrompt(result) {
  const checkBtn = document.getElementById('update-check-btn');
  if (checkBtn) {
    checkBtn.innerHTML = '<svg class=\"icon\" aria-hidden=\"true\"><use href=\"#i-refresh\"></use></svg> Download v' + result.latestVersion;
    checkBtn.onclick = async () => {
      checkBtn.disabled = true;
      checkBtn.textContent = 'Downloading...';
      _setUpdateStatus('Downloading...', 'Download in progress', '#93c5fd');
      try {
        const dlResult = await window.electronAPI.downloadUpdate();
        if (!dlResult?.success) {
          // If electron-updater not available, offer GitHub link
          _setUpdateStatus('Manual Download', 'Open GitHub releases to download', '#fcd34d');
          if (result.htmlUrl) {
            checkBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-link"></use></svg> Open GitHub Releases';
            checkBtn.disabled = false;
            checkBtn.onclick = () => { window.open(result.htmlUrl, '_blank'); };
          }
        }
      } catch (err) {
        _setUpdateStatus('Download Failed', err?.message || 'Try again', '#f87171');
        checkBtn.disabled = false;
      }
    };
    checkBtn.disabled = false;
  }
}

function _showInstallBtn() {
  const installBtn = document.getElementById('update-install-btn');
  const checkBtn = document.getElementById('update-check-btn');
  if (installBtn) installBtn.style.display = '';
  if (checkBtn) checkBtn.style.display = 'none';
  const progressWrap = document.getElementById('update-progress-wrap');
  if (progressWrap) progressWrap.style.display = 'none';
}

function _showChangelog(notes, version) {
  const wrap = document.getElementById('update-changelog');
  const body = document.getElementById('update-changelog-body');
  if (!wrap || !body) return;
  wrap.style.display = '';

  // Parse markdown-ish release notes into list
  let html = '';
  if (typeof notes === 'string' && notes.trim()) {
    const lines = notes.split('\n').filter(l => l.trim());
    html = '<ul>' + lines.map(l => {
      const clean = l.replace(/^[-*•]\s*/, '').trim();
      return clean ? `<li>${clean}</li>` : '';
    }).filter(Boolean).join('') + '</ul>';
  } else {
    html = `<p>Version ${version || ''} is available.</p>`;
  }
  body.innerHTML = `<span class="update-badge new">v${version || '?'}</span> ` + html;
}

// ═══════════════════════════════════════════════════════════════════
// SECURITY / AV TROUBLESHOOTING UI
// ═══════════════════════════════════════════════════════════════════
let _securityInitialized = false;

function initSecurityUI() {
  if (_securityInitialized) return;
  _securityInitialized = true;

  const checkBtn = document.getElementById('btn-security-check');
  const fixBtn = document.getElementById('btn-security-fix');
  const defenderBtn = document.getElementById('btn-security-defender');

  if (checkBtn) {
    checkBtn.addEventListener('click', loadSecurityStatus);
  }
  if (fixBtn) {
    fixBtn.addEventListener('click', async () => {
      fixBtn.disabled = true;
      fixBtn.textContent = 'Opravuji...';
      try {
        const result = await window.electronAPI.fixSecurityBlocks();
        if (result?.success) {
          fixBtn.innerHTML = '<svg class="icon icon-inline" aria-hidden="true"><use href="#i-check"></use></svg> Opraveno!';
          setTimeout(() => loadSecurityStatus(), 1000);
        } else {
          fixBtn.textContent = 'Chyba: ' + (result?.error || 'Neznámá');
        }
      } catch (err) {
        fixBtn.textContent = 'Chyba: ' + (err?.message || '?');
      }
      setTimeout(() => {
        fixBtn.disabled = false;
        fixBtn.innerHTML = '<svg class="icon icon-inline" aria-hidden="true"><use href="#i-settings"></use></svg> Opravit automaticky';
      }, 3000);
    });
  }
  if (defenderBtn) {
    defenderBtn.addEventListener('click', async () => {
      await window.electronAPI.openDefenderSettings();
    });
  }
}

async function loadSecurityStatus() {
  const listEl = document.getElementById('security-binaries-list');
  const recsEl = document.getElementById('security-recommendations');
  const fixBtn = document.getElementById('btn-security-fix');
  const defenderBtn = document.getElementById('btn-security-defender');

  if (listEl) listEl.innerHTML = '<p style="color:var(--text-third)">Kontroluji...</p>';

  try {
    const status = await window.electronAPI.getSecurityStatus();

    // Render binaries status
    if (listEl && status?.binaries) {
      listEl.innerHTML = Object.entries(status.binaries).map(([name, info]) => {
        let statusIcon = '✅';
        let statusText = 'OK';
        let statusColor = '#6ee7b7';
        if (!info.exists) {
          statusIcon = '❌';
          statusText = 'Chybí (smazáno antivirem?)';
          statusColor = '#f87171';
        } else if (info.quarantined) {
          statusIcon = '⚠️';
          statusText = 'Quarantine (Gatekeeper)';
          statusColor = '#fcd34d';
        } else if (!info.executable) {
          statusIcon = '⚠️';
          statusText = 'Bez exec permissions';
          statusColor = '#fcd34d';
        }
        return `<div class="resource-item">
          <div class="resource-item-left">
            <span class="emoji-16">${statusIcon}</span>
            <span class="resource-item-label">${name}</span>
          </div>
          <span class="resource-item-value" style="color:${statusColor}">${statusText}</span>
        </div>`;
      }).join('');
    }

    // Render recommendations
    if (recsEl && status?.recommendations) {
      const hasIssues = status.recommendations.some(r => r.type !== 'ok');
      recsEl.innerHTML = status.recommendations.map(rec => {
        if (rec.type === 'ok') {
          return `<div class="glass-panel" style="padding:12px; background:rgba(110,231,183,.08); border:1px solid rgba(110,231,183,.2);">
            <span style="color:#6ee7b7; font-weight:600;">✅ ${rec.title}</span>
            <span style="color:var(--text-secondary); margin-left:8px;">${rec.description}</span>
          </div>`;
        }
        return `<div class="glass-panel" style="padding:12px; background:rgba(248,113,113,.06); border:1px solid rgba(248,113,113,.2);">
          <div style="color:#f87171; font-weight:600; margin-bottom:4px;">⚠️ ${rec.title}</div>
          <div style="color:var(--text-secondary); font-size:13px; white-space:pre-wrap;">${rec.description}</div>
          ${rec.command ? `<code style="display:block; margin-top:8px; padding:6px 10px; background:rgba(255,255,255,.06); border-radius:6px; font-size:12px; color:#93c5fd; word-break:break-all;">${rec.command}</code>` : ''}
        </div>`;
      }).join('');

      // Show/hide action buttons
      if (fixBtn) fixBtn.style.display = hasIssues && status.platform !== 'win32' ? '' : 'none';
      if (defenderBtn) defenderBtn.style.display = hasIssues && status.platform === 'win32' ? '' : 'none';
    }
  } catch (err) {
    if (listEl) listEl.innerHTML = `<p style="color:#f87171">Chyba: ${err?.message || '?'}</p>`;
  }
}

dbg('Renderer script loaded');

// ============================================================================
// TREE NODE VIEW — Local L1 zion-core process management
// ============================================================================

let _nodeInitialized = false;
let _nodeRunning     = false;
let _nodeRefreshTimer = null;

function initNodeView() {
  if (_nodeInitialized) return;
  _nodeInitialized = true;
  dbg('[NODE] Initializing Tree Node view');

  const toggleBtn  = document.getElementById('node-toggle-btn');
  const btnLabel   = document.getElementById('node-btn-label');
  const refreshBtn = document.getElementById('node-refresh-btn');

  // Attach IPC: listen for streaming node output
  if (window.electronAPI?.onNodeOutput) {
    window.electronAPI.onNodeOutput(({ stream, text }) => {
      _nodeAppendConsole(text, stream === 'stderr');
    });
  }
  if (window.electronAPI?.onNodeStopped) {
    window.electronAPI.onNodeStopped(({ code }) => {
      _nodeRunning = false;
      _nodeSetStatus(false, `Zastaveno (exit ${code ?? '?'})`);
      _nodeAppendConsole(`\n[NODE] Proces skončil (kód ${code ?? '?'})\n`, true);
    });
  }

  // Refresh
  if (refreshBtn) refreshBtn.addEventListener('click', () => void _nodeRefresh());

  // Peers tab: refresh peers button
  const refreshPeersBtn = document.getElementById('node-refresh-peers-btn');
  if (refreshPeersBtn) refreshPeersBtn.addEventListener('click', () => void _nodeRefresh());

  // Log tab: clear log button
  const clearLogBtn = document.getElementById('node-clear-log-btn');
  if (clearLogBtn) clearLogBtn.addEventListener('click', () => {
    _nodeLogLines = [];
    const con = document.getElementById('node-console');
    if (con) con.innerHTML = '— log vymazán —';
  });

  // Settings tab: load checkpoints on first reveal
  document.querySelectorAll('.section-tabs[data-group="node"] .section-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.section === 'node-settings-tab') {
        void _nodeLoadCheckpoints();
      }
    });
  });

  // Toggle Start / Stop
  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      if (_nodeRunning) {
        toggleBtn.disabled = true;
        const r = await window.electronAPI?.nodeStop?.();
        if (r?.success) {
          _nodeRunning = false;
          _nodeSetStatus(false, 'Offline');
        } else {
          _nodeAppendConsole(`Chyba: ${r?.error || 'neznámá'}\n`, true);
        }
        toggleBtn.disabled = false;
      } else {
        // Gather config
        const p2pPort = Number(document.getElementById('node-cfg-p2p')?.value || 8334);
        const rpcPort = Number(document.getElementById('node-cfg-rpc')?.value || 8545);
        const network = document.getElementById('node-cfg-network')?.value || 'mainnet';
        toggleBtn.disabled = true;
        _nodeSetStatus(false, 'Spouštím…');
        _nodeAppendConsole(`[NODE] Spouštím node (${network} p2p:${p2pPort} rpc:${rpcPort})…\n`, false);
        const r = await window.electronAPI?.nodeStart?.({ p2pPort, rpcPort, network });
        if (r?.success) {
          _nodeRunning = true;
          _nodeSetStatus(true, `Běží · PID ${r.pid}`);
          _nodeAppendConsole(`[NODE] Spuštěn: ${r.binPath}\n`, false);
          // Start auto-refresh
          void _nodeRefresh();
          _nodeRefreshTimer = setInterval(() => {
            if (currentView === 'node') void _nodeRefresh();
            else { clearInterval(_nodeRefreshTimer); _nodeRefreshTimer = null; }
          }, 10000);
        } else {
          _nodeSetStatus(false, 'Chyba');
          _nodeAppendConsole(`[NODE] Spuštění selhalo: ${r?.error || 'unknown'}\n`, true);
          if (r?.error?.includes('binary not found')) {
            const binEl = document.getElementById('node-binary-status');
            if (binEl) binEl.textContent = 'Binary nebyla nalezena. Spusť: cargo build --release -p zion-core';
            binEl.style.color = '#f87171';
          }
        }
        toggleBtn.disabled = false;
      }
    });
  }

  // Initial status check (maybe node is already running from before)
  void _nodeRefresh();

  dbg('[NODE] View initialized');
}

function _nodeSetStatus(running, label) {
  const dot     = document.getElementById('node-status-dot');
  const text    = document.getElementById('node-status-text');
  const btnLbl  = document.getElementById('node-btn-label');
  const toggleBtn = document.getElementById('node-toggle-btn');
  if (dot) {
    dot.style.background = running ? '#22c55e' : 'rgba(255,255,255,0.18)';
    dot.style.boxShadow  = running ? '0 0 8px #22c55e, 0 0 16px rgba(34,197,94,0.4)' : 'none';
  }
  if (text) {
    text.textContent = label;
    text.style.color = running ? '#6ee7b7' : 'rgba(255,255,255,0.4)';
  }
  if (btnLbl) btnLbl.textContent = running ? 'Zastavit Node' : 'Spustit Node';
  if (toggleBtn) {
    toggleBtn.classList.toggle('btn-primary', !running);
    toggleBtn.classList.toggle('btn-danger',  running);
  }
  _nodeRunning = running;
}

function _nodeFmt(val, unit = '') {
  if (val == null || val === '') return '—';
  return `${val}${unit}`;
}

async function _nodeRefresh() {
  if (!window.electronAPI?.nodeGetStatus) return;
  const now = new Date().toLocaleTimeString();
  try {
    const r = await window.electronAPI.nodeGetStatus();

    if (r.running && r.sync) {
      _nodeSetStatus(true, `Běží · PID ${r.pid || '?'}`);
      const s = r.sync;

      // Timestamp
      const updEl = document.getElementById('node-updated');
      if (updEl) updEl.textContent = '⟳ ' + now;

      // Stats cards
      const heightEl = document.getElementById('node-stat-height');
      const peersEl  = document.getElementById('node-stat-peers');
      const syncEl   = document.getElementById('node-stat-sync');
      const bpsEl    = document.getElementById('node-stat-bps');
      if (heightEl) heightEl.textContent = _nodeFmt(s.download_height);
      if (syncEl)   syncEl.textContent   = s.syncing ? `${s.percent?.toFixed(1) ?? 0}%` : (s.state === 'Steady' ? '✓ Synced' : '—');
      if (bpsEl)    bpsEl.textContent    = s.blocks_per_sec > 0 ? `${s.blocks_per_sec.toFixed(0)}` : '—';

      // Peer counts (overview + peers tab)
      if (r.peers) {
        const ac = r.peers.active_count ?? 0;
        const kc = r.peers.known_count  ?? 0;
        if (peersEl) peersEl.textContent = _nodeFmt(ac);
        const activeEl = document.getElementById('node-peers-active');
        const knownEl  = document.getElementById('node-peers-known');
        if (activeEl) { activeEl.textContent = ac; activeEl.style.color = ac > 0 ? '' : '#f87171'; }
        if (knownEl)  knownEl.textContent = kc;
        const puEl = document.getElementById('node-peers-updated');
        if (puEl) puEl.textContent = '⟳ ' + now;
      }

      // Sync status bar
      const syncBar  = document.getElementById('node-sync-bar');
      const syncIcon = document.getElementById('node-sync-icon');
      const syncTxt  = document.getElementById('node-sync-text');
      if (syncBar && syncTxt) {
        if (s.state === 'IBD') {
          if (syncIcon) syncIcon.textContent = '⬇';
          syncTxt.innerHTML = `Synchronizuji bloky… <b>${s.percent?.toFixed(1) ?? 0}%</b>`;
          syncBar.style.background = 'rgba(6,182,212,0.07)';
          syncBar.style.borderColor = 'rgba(6,182,212,0.2)';
        } else if (s.state === 'Steady') {
          if (syncIcon) syncIcon.textContent = '✓';
          syncTxt.innerHTML = `Node je plně synchronizován — blok <b>#${s.download_height ?? 0}</b>`;
          syncBar.style.background = 'rgba(16,185,129,0.06)';
          syncBar.style.borderColor = 'rgba(16,185,129,0.18)';
        } else {
          if (syncIcon) syncIcon.textContent = '⚡';
          syncTxt.innerHTML = `Stav: <b>${s.state ?? '?'}</b>`;
          syncBar.style.background = '';
          syncBar.style.borderColor = '';
        }
      }

      // IBD progress bar
      const barWrap = document.getElementById('node-ibd-bar-wrap');
      if (barWrap) {
        if (s.state === 'IBD' && (s.percent ?? 100) < 100) {
          barWrap.style.display = 'block';
          const pct   = (s.percent ?? 0).toFixed(1);
          const pctEl = document.getElementById('node-ibd-pct');
          const bar   = document.getElementById('node-ibd-bar');
          const eta   = document.getElementById('node-ibd-eta');
          if (pctEl) pctEl.textContent = `${pct}%`;
          if (bar)   bar.style.width   = `${pct}%`;
          if (eta) {
            const rem  = s.eta_secs > 0 ? `ETA: ~${Math.round(s.eta_secs)}s` : '';
            const peer = s.ibd_peer  ? `· peer: ${escapeHtml(String(s.ibd_peer))}` : '';
            eta.textContent = `${rem} ${peer}`.trim();
          }
        } else {
          barWrap.style.display = 'none';
        }
      }

      // Peers list
      if (r.peers?.known) _nodeRenderPeers(r.peers.known);

    } else if (!r.running) {
      if (!_nodeRunning) {
        _nodeSetStatus(false, 'Offline');
        const syncTxt = document.getElementById('node-sync-text');
        const syncIcon = document.getElementById('node-sync-icon');
        if (syncTxt)  syncTxt.innerHTML = 'Node není spuštěn — klikni na <b>Spustit Node</b>';
        if (syncIcon) syncIcon.textContent = '⚡';
        const syncBar = document.getElementById('node-sync-bar');
        if (syncBar) { syncBar.style.background = ''; syncBar.style.borderColor = ''; }
      }
    }
  } catch (e) {
    dbg('[NODE] Status check error:', e.message);
  }
}

function _nodeRenderPeers(peerList) {
  const listEl = document.getElementById('node-peers-list');
  if (!listEl) return;

  if (!peerList || peerList.length === 0) {
    listEl.innerHTML = `<div style="text-align:center;color:rgba(255,255,255,0.3);font-size:13px;padding:20px">
      <div style="font-size:20px;margin-bottom:8px">◈</div>Žádné peery zatím nepřipojeny.</div>`;
    return;
  }

  listEl.innerHTML = peerList.map(p => {
    const addr      = escapeHtml(String(p.addr || p.address || '?'));
    const height    = p.height > 0 ? Number(p.height).toLocaleString() : '—';
    const agent     = escapeHtml(String(p.agent || '—'));
    const connected = !!p.connected;
    const dotColor  = connected ? '#22c55e' : '#6b7280';
    const dotGlow   = connected ? 'box-shadow:0 0 6px #22c55e;' : '';
    const bgColor   = connected ? 'rgba(16,185,129,0.04)' : 'rgba(0,0,0,0.25)';
    const border    = connected ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.06)';
    const statusLbl = connected
      ? '<span style="color:#6ee7b7;font-size:10px;text-transform:uppercase;letter-spacing:.08em">● Připojen</span>'
      : '<span style="color:#6b7280;font-size:10px;text-transform:uppercase;letter-spacing:.08em">○ Known</span>';
    const nowSec  = Date.now() / 1000;
    const idleSec = p.last_seen > 0 ? Math.round(nowSec - p.last_seen) : null;
    const idleStr = idleSec == null ? '—' : idleSec < 60 ? `${idleSec}s` : idleSec < 3600 ? `${Math.floor(idleSec/60)}m` : `${Math.floor(idleSec/3600)}h`;
    return `<div style="display:flex;align-items:center;justify-content:space-between;
              padding:10px 14px;background:${bgColor};border-radius:10px;
              border:1px solid ${border};transition:border-color .3s;margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};${dotGlow};flex-shrink:0"></span>
        <div>
          <div style="font-weight:600;font-family:monospace;font-size:13px">${addr}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:2px">${statusLbl}
            <span style="color:rgba(255,255,255,0.25);font-size:10px">${agent}</span>
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:14px;font-size:12px;color:rgba(255,255,255,0.5)">
        <span>H: <b style="color:#93c5fd">${height}</b></span>
        <span style="color:rgba(255,255,255,0.28)">idle ${idleStr}</span>
      </div>
    </div>`;
  }).join('');
}

async function _nodeLoadCheckpoints() {
  const el = document.getElementById('node-checkpoint-list');
  if (!el) return;
  try {
    const data = await window.electronAPI?.nodeGetCheckpoints?.();
    if (!data?.checkpoints?.length) {
      el.innerHTML = '<div class="placeholder-row">Žádné checkpointy (mainnet ještě nespuštěn)</div>';
      return;
    }
    el.innerHTML = data.checkpoints.map(cp => {
      const hStr = Number(cp.height).toLocaleString();
      const hash = escapeHtml(String(cp.hash || ''));
      const label = cp.label ? escapeHtml(String(cp.label)) : '';
      return `<div style="display:flex;align-items:center;justify-content:space-between;
                padding:10px 14px;background:rgba(255,215,0,0.03);border-radius:10px;
                border:1px solid rgba(255,215,0,0.1);margin-bottom:6px">
        <div>
          <div style="font-size:13px;font-weight:600;color:#fcd34d">Blok #${hStr} ${label ? '<span style="font-weight:400;color:rgba(255,255,255,0.4);font-size:11px;margin-left:6px">' + label + '</span>' : ''}</div>
          <div style="font-family:monospace;font-size:10px;color:rgba(255,255,255,0.3);margin-top:2px;word-break:break-all">${hash}</div>
        </div>
        <span style="font-size:10px;color:rgba(255,215,0,0.5);text-transform:uppercase;letter-spacing:.08em;flex-shrink:0;margin-left:12px">✓ Checkpoint</span>
      </div>`;
    }).join('');
  } catch(e) {
    if (el) el.innerHTML = '<div class="placeholder-row">Chyba při načítání checkpointů</div>';
  }
}

const NODE_MAX_LOG_LINES = 400;
let _nodeLogLines = [];

function _nodeAppendConsole(text, isErr = false) {
  const el = document.getElementById('node-console');
  if (!el) return;
  const lines = text.split('\n');
  for (const ln of lines) {
    if (!ln) continue;
    _nodeLogLines.push({ text: ln, isErr });
    if (_nodeLogLines.length > NODE_MAX_LOG_LINES) _nodeLogLines.shift();
  }
  el.innerHTML = _nodeLogLines
    .map(l => `<span style="color:${l.isErr ? '#f87171' : 'rgba(255,255,255,0.55)'}">${escapeHtml(l.text)}</span>`)
    .join('\n');
  el.scrollTop = el.scrollHeight;
}

// escapeHtml is already defined elsewhere in renderer; if not, define it
if (typeof escapeHtml === 'undefined') {
  var escapeHtml = (s) => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
