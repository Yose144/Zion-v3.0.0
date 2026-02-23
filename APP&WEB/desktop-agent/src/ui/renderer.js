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

const DEFAULT_REVENUE_PROFILE = {
  enabled: true,
  allocation: {
    zionPct: 50,
    multiAlgoPct: 25,
    nclPct: 25,
  },
  cpu: { coin: 'auto' },
  merged: { etcEnabled: false, nxsEnabled: false },
  gpu: { enabled: false, coins: ['ETC', 'ERG', 'RVN', 'KAS', 'ALPH'] },
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

    // Show wizard overlay
    const overlay = document.getElementById('wizard-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';

    await runWizard(overlay);
  } catch (err) {
    console.error('First-run check failed:', err);
  }
}

function runWizard(overlay) {
  return new Promise((resolve) => {
    const steps = overlay.querySelectorAll('.wizard-step');
    const showStep = (n) => {
      steps.forEach(s => s.style.display = 'none');
      const target = overlay.querySelector(`.wizard-step[data-step="${n}"]`);
      if (target) target.style.display = 'block';
    };

    const closeWizard = () => {
      overlay.style.display = 'none';
      resolve();
    };

    // Step 1: Welcome
    document.getElementById('wizard-start-btn')?.addEventListener('click', () => showStep(2));
    document.getElementById('wizard-skip-btn')?.addEventListener('click', closeWizard);
    document.getElementById('wizard-back-1')?.addEventListener('click', () => showStep(1));

    // Step 2: Create wallet
    document.getElementById('wizard-create-btn')?.addEventListener('click', async () => {
      const pw = document.getElementById('wizard-password')?.value || '';
      const pwConfirm = document.getElementById('wizard-password-confirm')?.value || '';
      const workerName = document.getElementById('wizard-worker')?.value?.trim() || 'desktop-agent';
      const errorEl = document.getElementById('wizard-error');

      if (pw.length < 6) {
        if (errorEl) { errorEl.textContent = 'Heslo musí mít alespoň 6 znaků.'; errorEl.style.display = 'block'; }
        return;
      }
      if (pw !== pwConfirm) {
        if (errorEl) { errorEl.textContent = 'Hesla se neshodují.'; errorEl.style.display = 'block'; }
        return;
      }
      if (errorEl) errorEl.style.display = 'none';

      const btn = document.getElementById('wizard-create-btn');
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Vytvářím...'; }

      try {
        const result = await window.electronAPI.quickSetup({ password: pw, workerName });
        if (!result?.success) {
          if (errorEl) { errorEl.textContent = result?.error || 'Chyba při vytváření peněženky.'; errorEl.style.display = 'block'; }
          if (btn) { btn.disabled = false; btn.textContent = '🔑 Vytvořit peněženku a nastavit'; }
          return;
        }

        // Show step 3 with wallet details
        document.getElementById('wizard-address').textContent = result.wallet.address;
        document.getElementById('wizard-mnemonic').textContent = result.wallet.mnemonic;

        // Update global config
        config = result.config || config;

        showStep(3);
      } catch (err) {
        if (errorEl) { errorEl.textContent = err?.message || 'Neočekávaná chyba.'; errorEl.style.display = 'block'; }
        if (btn) { btn.disabled = false; btn.textContent = '🔑 Vytvořit peněženku a nastavit'; }
      }
    });

    // Step 3: Success
    document.getElementById('wizard-mine-btn')?.addEventListener('click', async () => {
      closeWizard();
      // Auto-start mining after a short delay (let the rest of UI init finish)
      setTimeout(async () => {
        try {
          config = await window.electronAPI.getConfig();
          if (config?.wallet) {
            const result = await window.electronAPI.startMining(config);
            if (result?.success) {
              isRunning = true;
              try { updateControlButtons(); } catch { /* not yet initialized */ }
            }
          }
        } catch (err) {
          console.error('Auto-start mining failed:', err);
        }
      }, 1000);
    });

    document.getElementById('wizard-done-btn')?.addEventListener('click', closeWizard);
  });
}

function renderBackendUi() {
  try {
    const backendStatusEl = document.getElementById('backend-status');
    const backendPill = document.getElementById('backend-pill');

    const preferred = String(config?.minerBackend || 'auto').toLowerCase();
    const resolved = resolvedMinerBackend ? String(resolvedMinerBackend).toLowerCase() : '';
    const resolvedLabel = resolved === 'rust' ? 'Rust' : resolved === 'python' ? 'Python' : resolved === 'legacy' ? 'Legacy' : '';

    if (backendStatusEl) {
      const labels = {
        auto: 'Auto selects Rust when available (Python fallback).',
        rust: 'Rust v2.9.6 selected (no fallback).',
        python: 'Python selected (no fallback).'
      };
      const base = labels[preferred] || '';
      const withResolved = resolvedLabel ? `${base} Resolved: ${resolvedLabel}.` : base;
      const err = String(resolvedMinerBackendLastError || '').trim();
      backendStatusEl.textContent = err ? `${withResolved} Last error: ${err}` : withResolved;
    }

    if (backendPill) {
      const eff = resolved || preferred;
      const label = eff === 'rust' ? 'Rust' : eff === 'python' ? 'Python' : eff === 'legacy' ? 'Legacy' : 'Auto';
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

// Navigation
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      switchView(view);
      
      // Update active state
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // ── Section Tabs (subsection navigation within views) ──
  setupSectionTabs();
}

/**
 * Set up all .section-tabs pill bars — clicking a tab shows
 * the corresponding .section-panel and hides siblings.
 */
function setupSectionTabs() {
  document.querySelectorAll('.section-tabs').forEach(tabBar => {
    const tabs = tabBar.querySelectorAll('.section-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const sectionId = tab.dataset.section;
        if (!sectionId) return;

        // Deactivate sibling tabs
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Find the parent view-shell and toggle section-panels within it
        const viewShell = tabBar.closest('.view-shell');
        if (!viewShell) return;
        viewShell.querySelectorAll('.section-panel').forEach(p => {
          p.classList.remove('active');
        });
        const target = document.getElementById(sectionId);
        if (target) target.classList.add('active');
      });
    });
  });
}

function switchView(view) {
  // Hide all views
  document.querySelectorAll('[id$="-view"]').forEach(v => {
    v.style.display = 'none';
  });
  
  // Show selected view
  document.getElementById(`${view}-view`).style.display = 'block';
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

  // Initialize bridge view when opened
  if (view === 'bridge') initBridgeView();

  // Initialize OASIS view when opened
  if (view === 'oasis') initOasisView();

  // Initialize DAO view when opened
  if (view === 'dao') initDaoView();

  // Initialize Warp view when opened
  if (view === 'warp') initWarpView();

  // Initialize Free World view when opened
  if (view === 'freeworld') initFreeWorldView();

  // Initialize Issobella view when opened
  if (view === 'issobella') initIssobellaView();

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
    const labels = {
      'cpu': 'CPU mining only (~600 kH/s)',
      'gpu': 'GPU mining only (~8.5 GH/s)',
      'dual': 'Dual mining uses both CPU and GPU simultaneously (MAX POWER!)',
      'gpu-revenue': 'GPU revenue mode routes GPU to profit-switch stream while CPU keeps ZION/revenue split'
    };
    if (modeStatusEl) modeStatusEl.textContent = labels[mode] || '';
  };

  // Mining mode radio button listeners
  document.querySelectorAll('input[name="mining-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const mode = radio.value;
      setModeStatus(mode);
      // Sync hidden gpu checkbox for backwards compat
      if (gpuCheckbox) gpuCheckbox.checked = (mode === 'gpu' || mode === 'dual' || mode === 'gpu-revenue');
    });
  });

  const updateBackendStatus = (value) => {
    const labels = {
      auto: 'Auto selects Rust when available (Python fallback).',
      rust: 'Rust v2.9.6 selected (Python fallback on failure).',
      python: 'Python selected (compatibility mode).'
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

  const syncAlgoUi = () => {
    // Mainnet Phase 1: Cosmic Harmony v3 only — no user selection needed
    if (algoStatusEl) {
      algoStatusEl.textContent = 'Cosmic Harmony v3 — ZION PoW algorithm';
    }
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

  const applyAlgo = async () => {
    // Mainnet Phase 1: algorithm is fixed to cosmic_harmony_v3
    config.algorithm = 'cosmic_harmony_v3';
    await window.electronAPI.saveConfig(config);
    if (algoStatusEl) {
      algoStatusEl.textContent = 'Cosmic Harmony v3 — ZION PoW algorithm';
    }
  };

  // Mainnet Phase 1: algo is fixed, no user interaction needed
  // Keep applyAlgo available for programmatic use only
  
  startBtn.addEventListener('click', async () => {
    if (!config.wallet) {
      alert('Please configure your wallet address in Settings first.');
      switchView('settings');
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
    let poolHost = '77.42.31.72';
    let poolPort = 3333;
    
    if (poolRadio) {
      if (poolRadio.value === 'custom') {
        // Custom pool - read from text input
        const customPool = document.getElementById('pool-input').value;
        const [h, p] = customPool.split(':');
        poolHost = h || '77.42.31.72';
        poolPort = parseInt(p) || 3333;
      } else {
        // Predefined pool
        const [h, p] = poolRadio.value.split(':');
        poolHost = h;
        poolPort = parseInt(p) || 3333;
      }
    }
    
    const selectedMode = document.querySelector('input[name="mining-mode"]:checked')?.value || 'dual';
    const revenueCpuCoin = (document.getElementById('revenue-cpu-coin')?.value || 'auto').toLowerCase();
    const revenueGpuCoinsRaw = document.getElementById('revenue-gpu-coins')?.value || '';
    const revenueGpuCoins = revenueGpuCoinsRaw
      .split(',')
      .map(v => v.trim().toUpperCase())
      .filter(Boolean);

    const currentRevenue = normalizeRevenueProfile(config?.revenue || {});
    const nextRevenue = normalizeRevenueProfile({
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
      },
      ncl: { enabled: !!document.getElementById('revenue-ncl-enabled')?.checked },
      freeStreams: {
        mysterium: !!document.getElementById('revenue-mysterium-enabled')?.checked,
        nkn: !!document.getElementById('revenue-nkn-enabled')?.checked,
        aiGateway: !!document.getElementById('revenue-ai-enabled')?.checked,
      },
    });

    config = {
      ...config,
      pool: {
        host: poolHost,
        port: poolPort
      },
      rpcUrl: document.getElementById('rpc-url')?.value || config.rpcUrl,
      algorithm: 'cosmic_harmony_v3',  // Mainnet Phase 1: CH v3 only
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
      gpuRevenue: selectedMode === 'gpu-revenue' || nextRevenue.gpu.enabled,
      gpuRevenueCoins: nextRevenue.gpu.coins,
      revenue: nextRevenue,
      // Miner backend preference: auto | rust | python
      minerBackend: document.querySelector('input[name="miner-backend"]:checked')?.value || 'auto',
      autoStart: document.getElementById('autostart-checkbox').checked,
      minimizeToTray: true,
      startMinimized: false
    };
    
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
  const poolAddress = `${config.pool?.host || '77.42.31.72'}:${config.pool?.port || 3333}`;
  const poolRadios = {
    '77.42.31.72:3333': 'pool-helsinki',
    '46.225.126.243:3333': 'pool-germany',
    '5.78.178.227:3333': 'pool-usa1',
    '178.156.240.160:3333': 'pool-usa2',
    '5.223.43.93:3333': 'pool-asia3'
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
  if (rpcUrlEl) rpcUrlEl.value = config.rpcUrl || 'http://77.42.31.72:8444/jsonrpc';
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
  const miningMode = config.miningMode || (config.gpu ? 'dual' : 'cpu');
  const modeRadio = document.querySelector(`input[name="mining-mode"][value="${miningMode}"]`);
  if (modeRadio) modeRadio.checked = true;
  const modeStatusEl = document.getElementById('mode-status');
  if (modeStatusEl) {
    const modeLabels = {
      'cpu': 'CPU mining only (~600 kH/s)',
      'gpu': 'GPU mining only (~8.5 GH/s)',
      'dual': 'Dual mining uses both CPU and GPU simultaneously (MAX POWER!)',
      'gpu-revenue': 'GPU revenue mode routes GPU to profit-switch stream while CPU keeps ZION/revenue split'
    };
    modeStatusEl.textContent = modeLabels[miningMode] || '';
  }

  const revenue = normalizeRevenueProfile(config?.revenue || {});
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
  
  // Sync hidden gpu-checkbox for backwards compatibility
  const gpuEl = document.getElementById('gpu-checkbox');
  if (gpuEl) {
    // Mainnet Phase 1: CH v3 always supports GPU
    gpuEl.disabled = false;
    // GPU checkbox is checked if mode is 'gpu' or 'dual' or 'gpu-revenue'
    gpuEl.checked = (miningMode === 'gpu' || miningMode === 'dual' || miningMode === 'gpu-revenue');
  }
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

  // Dashboard quick controls — algorithm fixed to CH v3
  const algoSelect = document.getElementById('algo-select');
  if (algoSelect) algoSelect.value = 'cosmic_harmony_v3';
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
  if (/^[\u250c\u2502\u2514]/.test(raw) || /^\s*(SPEED|SHARES|DIFF|UPTIME|HW|NET|EVENT)\b/i.test(raw)) return;
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
  m = raw.match(/accepted\s+(\d+)\/(\d+)\s+\(\+1\)\s+diff\s+([\d.]+[TGMK]?)\s+\[([^\]]+)\]\s+\(([\d.]+)%\)/i);
  if (m) {
    return { html: `${tsHtml}<span class="mc-accepted">accepted</span> <span class="mc-hr">${m[1]}</span>/<span class="mc-rejected">${m[2]}</span> <span class="mc-ok">(+1)</span> diff <span class="mc-diff">${m[3]}</span> <span class="mc-ts">[${m[4]}]</span> <span class="mc-info">(${m[5]}%)</span>`, _cls: ' mc-highlight' };
  }

  // ── XMRig rejected: "rejected 42/1 (+1) \"reason\"" ──
  m = raw.match(/rejected\s+(\d+)\/(\d+)\s+\(\+1\)\s+"([^"]+)"/i);
  if (m) {
    return { html: `${tsHtml}<span class="mc-rejected">rejected</span> ${m[1]}/<span class="mc-rejected">${m[2]}</span> <span class="mc-err">(+1)</span> <span class="mc-err">"${esc(m[3])}"</span>` };
  }

  // ── new job: "new job  height 1523  diff 256  algo cosmic_harmony_v3" ──
  m = raw.match(/new job\s+height\s+(\d+)\s+diff\s+([\d.]+[TGMK]?)\s+algo\s+(\S+)/i);
  if (m) {
    return { html: `${tsHtml}<span class="mc-job">new job</span> height <span class="mc-hr">${m[1]}</span> diff <span class="mc-diff">${m[2]}</span> algo <span class="mc-algo">${esc(m[3])}</span>` };
  }

  // ── BLOCK FOUND ──
  m = raw.match(/BLOCK FOUND.*?height\s+(\d+).*?\(total:\s*(\d+)\)/i);
  if (m) {
    return { html: `${tsHtml}<span class="mc-block">█ BLOCK FOUND █ 🏆</span> height <span class="mc-hr">${m[1]}</span> <span class="mc-info">(total: ${m[2]})</span>`, _cls: ' mc-block-line' };
  }

  // ── GPU share: "GPU SHARE FOUND" / "GPU share ACCEPTED" / "GPU share REJECTED" ──
  if (/GPU SHARE FOUND/i.test(raw)) {
    return { html: `${tsHtml}<span class="mc-ok">⛏ GPU SHARE FOUND!</span> <span class="mc-info">${esc(raw.replace(/.*GPU SHARE FOUND!?/i, '').trim())}</span>` };
  }
  if (/GPU share ACCEPTED/i.test(raw)) {
    m = raw.match(/\(total:\s*(\d+)\)/i);
    return { html: `${tsHtml}<span class="mc-accepted">✅ GPU share ACCEPTED</span> <span class="mc-info">(total: ${m ? m[1] : '?'})</span>`, _cls: ' mc-highlight' };
  }
  if (/GPU share REJECTED/i.test(raw)) {
    return { html: `${tsHtml}<span class="mc-rejected">❌ GPU share REJECTED</span>` };
  }

  // ── GPU hashrate: "🎮 Apple M1 [GPU]: 2.59 MH/s" ──
  m = raw.match(/([^\[]+)\[(GPU|CPU-fallback)\]:\s*([\d.]+)\s*([kKmMgGtT]?H\/s)/i);
  if (m) {
    const mode = m[2].toUpperCase();
    const cls = mode === 'GPU' ? 'mc-ok' : 'mc-algo';
    return { html: `${tsHtml}<span class="${cls}">${esc(m[1].trim())} [${mode}]</span> <span class="mc-hr">${m[3]}</span> <span class="mc-unit">${m[4]}</span>` };
  }

  // ── Batch done: "✅ Batch done: 250000 hashes in 452ms, 552.04 kH/s" ──
  m = raw.match(/Batch done:.*?([\d.]+)\s*([kKmMgGtT]?H\/s)/i);
  if (m) {
    return { html: `${tsHtml}<span class="mc-ok">✅ Batch</span> <span class="mc-hr">${m[1]}</span> <span class="mc-unit">${m[2]}</span>` };
  }

  // ── Connection: "Connecting", "connected", "Reconnection" ──
  if (/connecting|connected|reconnect/i.test(raw)) {
    const cls = /connected|success/i.test(raw) ? 'mc-ok' : 'mc-warn';
    return { html: `${tsHtml}<span class="${cls}">${esc(raw)}</span>` };
  }

  // ── Stream switch ──
  m = raw.match(/Stream switch:\s*(\S+)\s*→\s*(\S+)/i);
  if (m) {
    return { html: `${tsHtml}<span class="mc-warn">⚡ Stream switch</span> <span class="mc-algo">${esc(m[1])}</span> → <span class="mc-algo">${esc(m[2])}</span>` };
  }

  // ── Errors ──
  if (/error|failed|panic/i.test(raw)) {
    return { html: `${tsHtml}<span class="mc-err">${esc(raw)}</span>` };
  }

  // ── Warnings ──
  if (/warn|⚠|timeout/i.test(raw)) {
    return { html: `${tsHtml}<span class="mc-warn">${esc(raw)}</span>` };
  }

  // ── Status panel lines (┌│└ or SPEED/SHARES/DIFF/UPTIME/HW/NET/EVENT) ──
  // These are handled by updateStaticPanel() — skip them in scrolling log
  if (/^[│┌└]|^\s*(HASHRATE|SHARES|DIFF|UPTIME|THREADS|SPEED|HW|NET|EVENT)/i.test(raw)) {
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
      setText('blocks-label', `🎉 ${blocks} block${blocks > 1 ? 's' : ''} mined!`);
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
  const sendTxBtn = document.getElementById('send-tx-btn');
  const sendStatusEl = document.getElementById('send-status');

  const getRpcUrl = () => {
    let url = (config?.rpcUrl || 'http://77.42.31.72:8444/jsonrpc').trim();
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
    const from = getActiveAddress();
    const to = (sendToEl && 'value' in sendToEl ? sendToEl.value : '').toString().trim();
    const amount = (sendAmountEl && 'value' in sendAmountEl ? sendAmountEl.value : '').toString().trim();
    const purpose = (sendPurposeEl && 'value' in sendPurposeEl ? sendPurposeEl.value : '').toString();

    if (sendStatusEl) sendStatusEl.textContent = 'Sending...';

    const fromCheck = await window.electronAPI.validateAddress(from);
    const toCheck = await window.electronAPI.validateAddress(to);
    if (!fromCheck?.valid || !toCheck?.valid) {
      if (sendStatusEl) sendStatusEl.textContent = 'Both from/to must be valid zion1... addresses.';
      return;
    }

    const result = await window.electronAPI.walletSendTransaction({
      rpcUrl: getRpcUrl(),
      from,
      to,
      amount,
      purpose
    });

    if (!result?.success) {
      if (sendStatusEl) sendStatusEl.textContent = `Error: ${result?.error || 'send failed'}`;
      return;
    }

    if (sendStatusEl) sendStatusEl.textContent = `OK · ${result.status || 'pending'} · tx: ${result.txId || 'n/a'}`;
    if (sendToEl) sendToEl.value = '';
    if (sendAmountEl) sendAmountEl.value = '';
    if (sendPurposeEl) sendPurposeEl.value = '';
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
  // Stream indicator
  if (stats.isRunning) {
    const mode = stats.stream_mode || 'ZION';
    const algo = stats.stream_algorithm || stats.algorithm || 'cosmic_harmony_v3';
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
    if (stats.isRunning && stats.dual_mining) {
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
        syncIcon.textContent = '❌';
        syncText.textContent = 'All nodes offline';
        syncText.style.color = '#f87171';
        syncBar.style.borderColor = 'rgba(248,113,113,0.3)';
      } else if (s.inSync) {
        syncIcon.textContent = '✅';
        syncText.textContent = `Network Synchronized — ${s.online}/${s.total} nodes in consensus`;
        syncText.style.color = '#6ee7b7';
        syncBar.style.borderColor = 'rgba(16,185,129,0.3)';
      } else {
        syncIcon.textContent = '⚠️';
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
            <span>⛏ <b style="color:#fcd34d;">${n.miners}</b></span>
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
        <div style="font-size:20px; margin-bottom:8px;">📡</div>
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
    // Desktop wallet stores mnemonic in keychain; ask main process for EVM address
    const res = await window.electronAPI?.invoke?.('wallet-get-evm-address') || null;
    if (res?.address) {
      _bridgeEvmAddress = res.address;
      const el = document.getElementById('bridge-evm-address');
      if (el) el.textContent = res.address;
      bridgeLoadWzionBalance(res.address);
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
    const res = await window.ipcRenderer.invoke('bridge-get-wzion-balance', addr);
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
    const res = await window.ipcRenderer.invoke('bridge-get-stats');
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
    const res = await window.ipcRenderer.invoke('bridge-prepare-lock', _bridgeEvmAddress);
    if (!res.success) { alert(`Error: ${res.error}`); return; }
    _bridgeMemo = res.memo;
    const vaultEl = document.getElementById('bridge-vault-addr');
    const memoEl  = document.getElementById('bridge-memo-text');
    const boxEl   = document.getElementById('bridge-memo-box');
    if (vaultEl) vaultEl.textContent = res.vaultAddress;
    if (memoEl)  memoEl.textContent  = res.memo;
    if (boxEl)   boxEl.style.display  = 'block';
  } catch (e) {
    alert(`Error: ${e.message}`);
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
  on('bridge-refresh-stats', 'click', () => window.bridgeLoadStats());
  on('bridge-open-basescan', 'click', () => {
    window.open('https://sepolia.basescan.org/address/0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721#writeContract', '_blank');
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
  on('stats-copy-wzion', 'click', () => bridgeCopyText('0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721'));
  on('stats-copy-bridge', 'click', () => {
    const el = document.getElementById('stats-bridge-contract');
    if (el) bridgeCopyText(el.textContent);
  });
  on('stats-copy-vault', 'click', () => bridgeCopyText('zion1bridge000000000000000000000000000vault'));
})();

// Hook into switchView to initialize bridge when tab is opened
// (initBridgeView() is called directly inside switchView() above)

// ═══════════════════════════════════════════════════════════════
// OASIS — Consciousness Gaming Layer (L4)
// ═══════════════════════════════════════════════════════════════

/** OASIS Consciousness Levels — mirrors L4/oasis/src/consciousness.rs */
const OASIS_LEVELS = [
  { name: 'Physical',     sefira: 'Malkuth',         desc: 'Foundation',     xp: 0,         mult: 1.0,  symbol: '🌍', features: ['BasicMining'] },
  { name: 'Emotional',    sefira: 'Yesod',           desc: 'Connection',     xp: 1_000,     mult: 1.2,  symbol: '🌊', features: ['JoinGuild'] },
  { name: 'Mental',       sefira: 'Hod / Netzach',   desc: 'Splendor',       xp: 5_000,     mult: 1.5,  symbol: '🔥', features: ['AiChallenges', 'CreateGuild'] },
  { name: 'Intuitional',  sefira: 'Tiferet',         desc: 'Beauty',         xp: 15_000,    mult: 2.0,  symbol: '💎', features: ['ClaimTerritory', 'MeditationBonus'] },
  { name: 'Spiritual',    sefira: 'Gevurah / Chesed',desc: 'Strength & Mercy',xp: 50_000,   mult: 3.0,  symbol: '⚡', features: ['DaoVoting', 'TitheProposals'] },
  { name: 'Cosmic',       sefira: 'Binah',           desc: 'Understanding',  xp: 150_000,   mult: 5.0,  symbol: '🌌', features: ['CreateAiAgent', 'GuildWars'] },
  { name: 'Divine',       sefira: 'Chokmah',         desc: 'Wisdom',         xp: 500_000,   mult: 8.0,  symbol: '👁', features: ['ExpandTerritory', 'Mentorship'] },
  { name: 'Unity',        sefira: "Da'at",           desc: 'Knowledge',      xp: 2_000_000, mult: 12.0, symbol: '∞',  features: ['WarpPortals', 'CreateChallenges'] },
  { name: 'OnTheStar',    sefira: 'Keter',           desc: 'Crown',          xp: 10_000_000,mult: 15.0, symbol: '✦',  features: ['ConsciousnessBeacon'] },
];

/** Level-up ZION bonuses — mirrors L4/oasis/src/levels.rs */
const LEVEL_UP_REWARDS = [0, 100, 500, 2_500, 10_000, 50_000, 250_000, 1_000_000, 5_000_000];

/** 8 Genesis Territories — mirrors L4/oasis/src/territory.rs */
const OASIS_TERRITORIES = [
  { name: 'Mount Zion',                  region: 'Mountains',     emoji: '🏔️', bg: 'bg-mountains',difficulty: 1.0, miningBonus: 10, xpBonus: 5,  capacity: 50  },
  { name: 'Cedar Forest',                region: 'Forest',        emoji: '🌲', bg: 'bg-forest',   difficulty: 0.8, miningBonus: 15, xpBonus: 10, capacity: 40  },
  { name: 'Negev Desert',                region: 'Desert',        emoji: '🏜️', bg: 'bg-desert',   difficulty: 1.5, miningBonus: 20, xpBonus: 15, capacity: 30  },
  { name: 'Sea of Galilee',              region: 'Ocean',         emoji: '🌊', bg: 'bg-ocean',    difficulty: 1.2, miningBonus: 12, xpBonus: 8,  capacity: 35  },
  { name: 'Masada Forge',                region: 'Volcano',       emoji: '🌋', bg: 'bg-volcano',  difficulty: 2.0, miningBonus: 25, xpBonus: 20, capacity: 20  },
  { name: 'Crystal Mines of Solomon',    region: 'Crystal Caves', emoji: '💎', bg: 'bg-crystal',  difficulty: 1.8, miningBonus: 22, xpBonus: 18, capacity: 25  },
  { name: 'Temple of Consciousness',     region: 'Temple',        emoji: '🕍', bg: 'bg-temple',   difficulty: 1.3, miningBonus: 18, xpBonus: 25, capacity: 30  },
  { name: 'Babel Nexus',                 region: 'Nexus',         emoji: '🌀', bg: 'bg-nexus',    difficulty: 2.5, miningBonus: 30, xpBonus: 30, capacity: 15  },
];

/** Tithe categories — mirrors L4/oasis/src/tithe.rs */
const OASIS_TITHE_CATEGORIES = [
  { name: 'Water',       emoji: '💧', desc: 'Clean water access' },
  { name: 'Food',        emoji: '🍞', desc: 'Food security' },
  { name: 'Shelter',     emoji: '🏠', desc: 'Housing & shelter' },
  { name: 'Environment', emoji: '🌍', desc: 'Earth protection' },
  { name: 'Medical',     emoji: '🏥', desc: 'Healthcare access' },
  { name: 'Education',   emoji: '📚', desc: 'Knowledge & learning' },
  { name: 'Emergency',   emoji: '🚨', desc: 'Disaster response' },
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
  { name: 'Mining',     icon: '⛏',  amount: '1.65B' },
  { name: 'Challenges', icon: '🧠', amount: '1.65B' },
  { name: 'Guild',      icon: '⚔',  amount: '1.65B' },
  { name: 'Level-Up',   icon: '⬆',  amount: '1.65B' },
  { name: 'Reserve',    icon: '🔒', amount: '1.65B' },
];

/** Sample guild quests — mirrors L4/oasis/src/guild.rs QuestType */
const GUILD_QUESTS = [
  { icon: '⛏', title: 'Collective Mining Sprint', desc: 'Mine 500 blocks as a guild', reward: '2,000 XP', progress: 67 },
  { icon: '🧠', title: 'AI Challenge Blitz',       desc: 'Complete 25 AI challenges',  reward: '1,500 XP', progress: 44 },
  { icon: '💝', title: 'Humanitarian Goal',         desc: 'Tithe 10,000 ZION total',    reward: '3,000 XP', progress: 23 },
  { icon: '🛡', title: 'Territory Defense',         desc: 'Hold Cedar Forest for 48h',  reward: '2,500 XP', progress: 89 },
  { icon: '✨', title: 'XP Milestone',              desc: 'Reach 100K combined guild XP',reward: '5,000 XP', progress: 56 },
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
      { key: 'BasicMining',        icon: '⛏', label: 'Basic Mining' },
      { key: 'JoinGuild',          icon: '🤝', label: 'Join Guild' },
      { key: 'AiChallenges',       icon: '🧠', label: 'AI Challenges' },
      { key: 'CreateGuild',        icon: '⚔', label: 'Create Guild' },
      { key: 'ClaimTerritory',     icon: '🏴', label: 'Claim Territory' },
      { key: 'MeditationBonus',    icon: '🧘', label: 'Meditation Bonus' },
      { key: 'DaoVoting',          icon: '🗳', label: 'DAO Voting' },
      { key: 'TitheProposals',     icon: '💝', label: 'Tithe Proposals' },
      { key: 'CreateAiAgent',      icon: '🤖', label: 'Create AI Agent' },
      { key: 'GuildWars',          icon: '⚔', label: 'Guild Wars' },
      { key: 'ExpandTerritory',    icon: '🗺', label: 'Expand Territory' },
      { key: 'Mentorship',         icon: '🎓', label: 'Mentorship' },
      { key: 'WarpPortals',        icon: '🌀', label: 'Warp Portals' },
      { key: 'CreateChallenges',   icon: '✏', label: 'Create Challenges' },
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
        <span style="margin-left:auto; font-size:11px">${unlocked ? '✅' : '🔒'}</span>
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
          <span>⚙ Difficulty ${t.difficulty}×</span>
          <span>⛏ +${t.miningBonus}%</span>
          <span>✨ +${t.xpBonus}%</span>
        </div>
        <div class="territory-status">
          <span style="color:${isClaimed ? 'var(--zion-cyan)' : 'rgba(255,255,255,0.3)'}">
            ${isClaimed ? '🏴 ' + controller : '○ Unclaimed'}
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
  { name: 'Guardian Alpha', key: 'zion1q...a7f3', icon: '🛡️', status: 'active' },
  { name: 'Guardian Bravo', key: 'zion1w...b8e4', icon: '🛡️', status: 'active' },
  { name: 'Guardian Charlie', key: 'zion1e...c9d5', icon: '🛡️', status: 'active' },
  { name: 'Guardian Delta', key: 'zion1r...d0c6', icon: '🛡️', status: 'active' },
  { name: 'Guardian Echo', key: 'zion1t...e1b7', icon: '🛡️', status: 'active' },
  { name: 'Guardian Foxtrot', key: 'zion1y...f2a8', icon: '🛡️', status: 'standby' },
  { name: 'Guardian Golf', key: 'zion1u...g3z9', icon: '🛡️', status: 'standby' },
];

const DAO_HUMANITARIAN_CATEGORIES = [
  { icon: '💧', name: 'Clean Water', allocated: '205,714,286', color: '#06b6d4' },
  { icon: '🍞', name: 'Food Security', allocated: '205,714,286', color: '#ffd700' },
  { icon: '🏠', name: 'Shelter', allocated: '205,714,286', color: '#9333ea' },
  { icon: '🌍', name: 'Environment', allocated: '205,714,286', color: '#00ff88' },
  { icon: '🏥', name: 'Healthcare', allocated: '205,714,286', color: '#f87171' },
  { icon: '📚', name: 'Education', allocated: '205,714,286', color: '#818cf8' },
  { icon: '🚨', name: 'Disaster Relief', allocated: '205,714,280', color: '#fb923c' },
];

let _daoInitialized = false;

function initDaoView() {
  if (_daoInitialized) return;
  _daoInitialized = true;
  dbg('[DAO] Initializing DAO view');

  /* — Proposals — */
  const listEl = document.getElementById('dao-proposal-list');
  if (listEl) {
    listEl.innerHTML = DAO_PROPOSALS.map(p => {
      const statusCls = 'dao-status-' + p.status.toLowerCase();
      return `<div class="dao-proposal">
        <div class="dao-proposal-header">
          <div class="dao-proposal-title">${p.id} — ${p.title}</div>
          <div class="dao-status-badge ${statusCls}">${p.status}</div>
        </div>
        <div class="dao-proposal-desc">${p.desc}</div>
        <div class="dao-vote-bar">
          <div class="dao-vote-yes" style="width:${p.yes}%"></div>
          <div class="dao-vote-no" style="width:${p.no}%"></div>
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

  /* — Treasury stats — */
  const spent = document.getElementById('dao-daily-spent');
  if (spent) spent.textContent = '12.3M ZION';
  const ops = document.getElementById('dao-ops-pending');
  if (ops) ops.textContent = '2';
  const dis = document.getElementById('dao-total-disbursed');
  if (dis) dis.textContent = '347M ZION';
  const sig = document.getElementById('dao-signers');
  if (sig) sig.textContent = '5 / 7';

  /* — Guardians — */
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

  /* — Humanitarian — */
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

  setupSectionTabs();
  dbg('[DAO] View initialized');
}

// ═══════════════════════════════════════════════════
// WARP — Cross-Chain Corridors (L3)
// ═══════════════════════════════════════════════════

const WARP_CHAINS = [
  { name: 'Base',     family: 'EVM',     icon: '🔵', fee: '0.10%', finality: 12,  enabled: true },
  { name: 'Arbitrum', family: 'EVM',     icon: '🔷', fee: '0.10%', finality: 12,  enabled: true },
  { name: 'BSC',      family: 'EVM',     icon: '🟡', fee: '0.12%', finality: 15,  enabled: true },
  { name: 'Polygon',  family: 'EVM',     icon: '🟣', fee: '0.10%', finality: 64,  enabled: true },
  { name: 'Solana',   family: 'Solana',  icon: '🟢', fee: '0.15%', finality: 32,  enabled: false },
  { name: 'Bitcoin',  family: 'Bitcoin', icon: '🟠', fee: '0.25%', finality: 6,   enabled: false },
  { name: 'Tron',     family: 'Tron',    icon: '🔴', fee: '0.15%', finality: 20,  enabled: false },
  { name: 'Stellar',  family: 'Stellar', icon: '⚪', fee: '0.08%', finality: 5,   enabled: false },
  { name: 'Cardano',  family: 'Cardano', icon: '🫐', fee: '0.18%', finality: 30,  enabled: false },
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

function initWarpView() {
  if (_warpInitialized) return;
  _warpInitialized = true;
  dbg('[WARP] Initializing Warp view');

  /* — Transfer status flow — */
  const flowEl = document.getElementById('warp-status-flow');
  if (flowEl) {
    flowEl.innerHTML = WARP_STATUS_FLOW.map((s, i) => {
      const active = i === 0 ? ' flow-active' : '';
      const arrow = i < WARP_STATUS_FLOW.length - 1 ? '<span class="warp-flow-arrow">→</span>' : '';
      return `<span class="warp-flow-step${active}">${s}</span>${arrow}`;
    }).join('');
  }

  /* — Chains grid — */
  const chainGrid = document.getElementById('warp-chain-grid');
  if (chainGrid) {
    chainGrid.innerHTML = WARP_CHAINS.map(c => {
      const cls = c.enabled ? 'chain-enabled' : 'chain-disabled';
      const badge = c.enabled ? '<span style="color:#00ff88; font-size:10px">● Live</span>' : '<span style="color:rgba(255,255,255,0.25); font-size:10px">○ Stub</span>';
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

  /* — Validators — */
  const vGrid = document.getElementById('warp-validator-grid');
  if (vGrid) {
    vGrid.innerHTML = WARP_VALIDATORS.map(v => {
      const col = v.status === 'active' ? '#00ff88' : 'rgba(255,255,255,0.25)';
      return `<div class="dao-guardian">
        <div class="dao-guardian-icon">🔐</div>
        <div class="dao-guardian-name">${v.name}</div>
        <div class="dao-guardian-status" style="color:${col}">● ${v.status}</div>
        <div style="font-size:10px; color:rgba(255,255,255,0.25); margin-top:6px; font-family:monospace">${v.key}</div>
      </div>`;
    }).join('');
  }

  /* — Fee distribution — */
  const feeEl = document.getElementById('warp-fee-split');
  if (feeEl) {
    feeEl.innerHTML = [
      { pct: '50%', label: 'Burned', color: '#f87171' },
      { pct: '25%', label: 'DAO Treasury', color: 'var(--zion-gold)' },
      { pct: '25%', label: 'Validators', color: 'var(--zion-cyan)' },
    ].map(f => `<div class="warp-fee-slice">
      <div class="warp-fee-pct" style="color:${f.color}">${f.pct}</div>
      <div class="warp-fee-label">${f.label}</div>
    </div>`).join('');
  }

  /* — Fee routes table — */
  const feeBody = document.getElementById('warp-fees-body');
  if (feeBody) {
    feeBody.innerHTML = WARP_FEE_ROUTES.map(r =>
      `<tr><td>${r.from} → ${r.to}</td><td>${r.rate}</td><td>${r.min}</td><td>${r.max}</td></tr>`
    ).join('');
  }

  /* — Update fee display on chain change — */
  const sel = document.getElementById('warp-dest-chain');
  const feeDisp = document.getElementById('warp-fee-display');
  if (sel && feeDisp) {
    sel.addEventListener('change', () => {
      const ch = WARP_CHAINS.find(c => c.name.toLowerCase() === sel.value);
      if (ch) feeDisp.textContent = ch.fee;
    });
  }

  setupSectionTabs();
  dbg('[WARP] View initialized');
}

// ═══════════════════════════════════════════════════════
// FREE WORLD — Sovereignty & Humanitarian Layer (L5)
// ═══════════════════════════════════════════════════════

const FW_PILLARS = [
  { icon: '⚡', name: 'Free Energy Research', desc: 'Quantum/free energy R&D, open-source hardware, decentralized energy grids for off-grid communities.' },
  { icon: '🤝', name: 'Humanitarian Missions', desc: '5% block reward → Humanitarian Fund, DAO governance for allocation, direct community support worldwide.' },
  { icon: '🏘️', name: 'Free Communities', desc: 'Self-sustaining off-grid communities using ZION as native currency with local mesh network infrastructure.' },
  { icon: '📖', name: 'Education & Awareness', desc: 'Open-source educational platforms, consciousness mining integration with L4 Oasis, knowledge sharing.' },
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
  { icon: '🔭', name: 'Earth Orbital Observatory', desc: 'LEO observatory with decentralized management via ZION DAO. Open data for all humanity.' },
  { icon: '🧬', name: 'Research Station', desc: 'Microgravity experiments, biological research, deep-space technology development.' },
  { icon: '🛰️', name: 'ZION Space Network', desc: 'Satellite mesh network, redundant orbital nodes, independence from terrestrial infrastructure.' },
];

const ISS_STATION_MODULES = [
  { icon: '🖥️', name: 'ZION Node Module', desc: 'Radiation-hardened FPGA running full ZION consensus in orbit' },
  { icon: '📡', name: 'Communications Hub', desc: 'ISL mesh links + ground station relay for block propagation' },
  { icon: '☀️', name: 'Solar Power Array', desc: 'Solar panels + battery systems for continuous LEO operation' },
  { icon: '🔬', name: 'Research Lab', desc: 'Microgravity experiments, biology, materials science' },
  { icon: '🏠', name: 'Habitat Module', desc: 'Crew quarters for visiting researchers and operators' },
  { icon: '🛸', name: 'Docking Port', desc: 'Standardized docking for CubeSat deployment and resupply' },
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

dbg('Renderer script loaded');
