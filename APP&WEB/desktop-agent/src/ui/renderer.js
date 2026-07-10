// ZION V3 Mainnet Ready v3.0.5 "All Green" - Renderer Process
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
let isStarting = false;

// Mainnet Edge relay (Hetzner VPS, Prague) — public-facing pool + node
const PRIMARY_MAINNET_HOST = '62.171.141.136';
const PRIMARY_POOL_PORT = 8444;
const PRIMARY_RPC_PORT = 8443;
// Legacy alias
const PRIMARY_TESTNET_HOST = PRIMARY_MAINNET_HOST;
const DEFAULT_RPC_URL = `http://${PRIMARY_MAINNET_HOST}:${PRIMARY_RPC_PORT}/jsonrpc`;
const DESKTOP_PURE_ZION_DEFAULT = true;

function currentPureZionDefault(cfg = config) {
  if (cfg && typeof cfg.desktopPureZionDefault === 'boolean') {
    return cfg.desktopPureZionDefault;
  }
  return DESKTOP_PURE_ZION_DEFAULT;
}

// V3: pure-ZION stubs — these replace the removed multi-coin revenue helpers.
function isPureZionDesktopMode(_cfg) { return true; }
function normalizeMiningMode(val) {
  const VALID = ['cpu', 'gpu', 'dual'];
  return VALID.includes(val) ? val : 'dual';
}
function normalizeRevenueProfile(obj) {
  const d = obj || {};
  return {
    enabled: false,
    allocation: { zionPct: 100, multiAlgoPct: 0, nclPct: 0, ...(d.allocation || {}) },
    cpu: { coin: 'zion', ...(d.cpu || {}) },
    gpu: { coins: [], poolPreference: 'herominers', poolRegion: 'eu', nicehashBtcAddr: null, ...(d.gpu || {}) },
    ncl: { enabled: false, ...(d.ncl || {}) },
    freeStreams: { mysterium: false, nkn: false, aiGateway: false, ...(d.freeStreams || {}) },
  };
}
function toPureZionRevenueProfile(p) {
  const n = normalizeRevenueProfile(p);
  n.allocation = { zionPct: 100, multiAlgoPct: 0, nclPct: 0 };
  return n;
}
function applyPureZionUiState(_cfg) { /* V3: always pure ZION, no-op */ }

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
        document.getElementById('wizard-mnemonic').textContent = result.wallet.mnemonic;
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
      resolved === 'ekam-auto' || resolved === 'deeksha-auto' ? 'Ekam Auto' :
      resolved === 'ekam-native' || resolved === 'deeksha-native' ? 'Ekam Native Exact' :
      resolved === 'ekam-opencl' || resolved === 'deeksha-opencl' ? 'Ekam GPU (OpenCL)' :
      resolved === 'ekam-cuda' || resolved === 'deeksha-cuda' ? 'Ekam CUDA' :
      resolved === 'ekam-metal' || resolved === 'deeksha-metal' ? 'Ekam Metal' :
      resolved === 'ekam-gpu' || resolved === 'deeksha-gpu' ? 'Ekam GPU' :
      resolved === 'ekam-fallback' || resolved === 'deeksha-fallback' ? 'Ekam CPU' :
      '';

    if (backendStatusEl) {
      const labels = {
        auto: 'Canonical cosmic_harmony prefers the native Ekam Rust miner and falls back only when that runtime is unavailable.',
        rust: 'Canonical cosmic_harmony runs on the native Ekam Rust miner.',
        python: 'Canonical cosmic_harmony uses the Ekam Python fallback path only when you explicitly pin Python or Rust is unavailable.'
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
        eff === 'ekam-auto' || eff === 'deeksha-auto' ? 'Ekam Auto' :
        eff === 'ekam-native' || eff === 'deeksha-native' ? 'Ekam Native Exact' :
        eff === 'ekam-opencl' || eff === 'deeksha-opencl' ? 'Ekam GPU (OpenCL)' :
        eff === 'ekam-cuda' || eff === 'deeksha-cuda' ? 'Ekam CUDA' :
        eff === 'ekam-metal' || eff === 'deeksha-metal' ? 'Ekam Metal' :
        eff === 'ekam-gpu' || eff === 'deeksha-gpu' ? 'Ekam GPU' :
        eff === 'ekam-fallback' || eff === 'deeksha-fallback' ? 'Ekam CPU' :
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

    // ── Auto-detect wallet: if config.wallet is empty, pick the first wallet file ──
    if (!config.wallet) {
      try {
        const wl = await window.electronAPI.listWallets();
        const wallets = Array.isArray(wl?.wallets) ? wl.wallets : [];
        if (wallets.length > 0 && wallets[0].address) {
          config.wallet = wallets[0].address;
          await window.electronAPI.saveConfig(config);
          dbg('Auto-detected wallet:', config.wallet);
        }
      } catch (e) {
        dbg('Auto-detect wallet failed:', e?.message || e);
      }
    }

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
      seed();
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
  node:      () => initNodeView(),
  about:     () => { initUpdateUI(); initSecurityUI(); },
  bridge:    () => initBridgeView(),
  defi:      () => initDefiView(),
  cli:       () => initCliView(),
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
window.addEventListener('beforeunload', _stopBalanceAutoRefresh);

// Control setup
function setupControls() {
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const openLogsBtn = document.getElementById('open-logs-btn');
  const hashrateUnitEl = document.getElementById('hashrate-unit');
  const algoSelect = document.getElementById('algo-select');
  const algoSelectDashboard = document.getElementById('algo-select-dashboard');
  const algoSaveBtn = document.getElementById('algo-save-btn');
  const algoStatusEl = document.getElementById('algo-status');
  const gpuCheckbox = document.getElementById('gpu-checkbox');
  const backendStatusEl = document.getElementById('backend-status');

  const updateBackendStatus = (value) => {
    const labels = {
      auto: 'Canonical cosmic_harmony prefers the native Ekam Rust miner and falls back only if needed.',
      rust: 'Canonical cosmic_harmony runs on the native Ekam Rust miner.',
      python: 'Canonical cosmic_harmony uses the Ekam Python fallback path.'
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
    deeksha_lite_v1: 'Deeksha Lite v1 — Standard 4 KiB scratchpad',
    cosmic_harmony_ekam_deeksha_v2: 'Cosmic Harmony Ekam Deeksha v2',
    deeksha_lite_fire: 'Deeksha Lite Fire — 512 KiB thermal mode'
  };

  const syncAlgoUi = () => {
    const algo = algoSelect?.value || config.algorithm || 'deeksha_lite_v1';
    const label = ALGO_LABELS[algo] || algo;
    if (algoStatusEl) algoStatusEl.textContent = label;
    // update the display chip in the control panel
    const algoDisplayChip = document.querySelector('#algo-display .font-semibold');
    if (algoDisplayChip) algoDisplayChip.textContent = label;
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

  // Dashboard algo select — sync with config and settings select
  if (algoSelectDashboard) {
    algoSelectDashboard.addEventListener('change', () => {
      config.algorithm = algoSelectDashboard.value;
      syncAlgoUi();
      // Also sync with settings select if exists
      if (algoSelect) {
        algoSelect.value = algoSelectDashboard.value;
      }
    });
    // init from persisted config
    if (config.algorithm && algoSelectDashboard.querySelector(`option[value="${config.algorithm}"]`)) {
      algoSelectDashboard.value = config.algorithm;
    }
  }

  startBtn.addEventListener('click', async () => {
    if (!config.wallet) {
      await openOneClickWizard();
      return;
    }

    isStarting = true;
    updateControlButtons();
    updateStatusBadge('starting');

    const result = await window.electronAPI.startMining(config);
    if (result.success) {
      console.log('Mining started');
      return;
    }

    isStarting = false;
    updateControlButtons();
    updateStatusBadge('stopped');

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
        poolPort = parseInt(p) || PRIMARY_POOL_PORT;
      }
    }
    
    const pureZionMode = isPureZionDesktopMode(config);
    const selectedMode = normalizeMiningMode(
      document.getElementById('gpu-checkbox')?.checked ? 'dual' : 'cpu',
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
      allocation: {
        zionPct: parseInt(document.getElementById('revenue-zion-pct')?.value || String(currentRevenue.allocation.zionPct), 10),
        multiAlgoPct: parseInt(document.getElementById('revenue-multi-pct')?.value || String(currentRevenue.allocation.multiAlgoPct), 10),
        nclPct: parseInt(document.getElementById('revenue-ncl-pct')?.value || String(currentRevenue.allocation.nclPct), 10),
      },
      cpu: { coin: revenueCpuCoin },
      gpu: {
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
      // GPU Revenue Mining configuration
      poolPreference: nextRevenue.gpu.poolPreference || 'herominers',
      poolRegion: nextRevenue.gpu.poolRegion || 'eu',
      nicehashBtcAddr: nextRevenue.gpu.nicehashBtcAddr || '',
      revenueWallet: document.getElementById('revenue-wallet')?.value?.trim() || config.revenueWallet || '',
      revenue: nextRevenue,
      // Miner backend preference: auto | rust | python
      minerBackend: document.querySelector('input[name="miner-backend"]:checked')?.value || 'auto',
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

  const revenue = currentPureZionDefault(config)
    ? toPureZionRevenueProfile(config?.revenue || {})
    : normalizeRevenueProfile(config?.revenue || {});
  const revenueCpuCoinEl = document.getElementById('revenue-cpu-coin');
  const revenueGpuCoinsEl = document.getElementById('revenue-gpu-coins');
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
  // revenueEnabledEl removed in V3 cleanup
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

  // AI Afterburner toggle removed in V3 cleanup

  // Dashboard quick controls — algorithm select init
  const algoSelectInit = document.getElementById('algo-select');
  if (algoSelectInit) {
    const persistedAlgo = config.algorithm;
    if (persistedAlgo && algoSelectInit.querySelector(`option[value="${persistedAlgo}"]`)) {
      algoSelectInit.value = persistedAlgo;
    } else {
      algoSelectInit.value = 'deeksha_lite_v1';
    }
  }
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
    if (_mcDeferredQueue.length > 100) _mcDeferredQueue.shift();
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
  // [STATUS] lines are verbose — skip, but keep [METRICS] lines
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

  // ── V3 shares summary: "shares A:5 R:0 (100.0%) | hashes 42000 | pool latency 38ms | uptime 0h 5m 12s" ──
  m = raw.match(/shares A:(\d+)\s+R:(\d+)\s+\(([\d.]+)%\)\s+\|\s+hashes\s+(\d+)\s+\|\s+pool latency\s+([\d.]+)ms\s+\|\s+uptime\s+(.*)/i);
  if (m) {
    return { html: `${tsHtml}<span class="mc-speed">shares</span> A:<span class="mc-accepted">${m[1]}</span> R:<span class="mc-rejected">${m[2]}</span> <span class="mc-info">(${m[3]}%)</span> | hashes <span class="mc-hr">${m[4]}</span> | latency <span class="mc-ts">${m[5]}ms</span> | uptime <span class="mc-info">${esc(m[6].trim())}</span>` };
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

  // ── [METRICS] compact GPU mining status ──
  m = raw.match(/^\[METRICS\]\s+(.+)/i);
  if (m) {
    const body = m[1];
    let html = esc(body);
    // Highlight hashrate values
    html = html.replace(/(\d+\.\d+\s*[kKmMgGtT]?H\/s)/g, '<span class="mc-hr">$1</span>');
    // Highlight A:N green, R:N red
    html = html.replace(/A:(\d+)/g, 'A:<span class="mc-accepted">$1</span>');
    html = html.replace(/R:(\d+)/g, 'R:<span class="mc-rejected">$1</span>');
    // Highlight accept percentage
    html = html.replace(/(\d+\.\d+%)/g, '<span class="mc-info">$1</span>');
    // Highlight gpu= and backend= values
    html = html.replace(/gpu=([^\s|]+)/g, 'gpu=<span class="mc-ok">$1</span>');
    html = html.replace(/backend=([^\s|]+)/g, 'backend=<span class="mc-algo">$1</span>');
    // Highlight epoch and height
    html = html.replace(/epoch=(\d+)/g, 'epoch=<span class="mc-diff">$1</span>');
    html = html.replace(/h=(\d+)/g, 'h=<span class="mc-diff">$1</span>');
    return { html: `${tsHtml}<span class="mc-speed">[METRICS]</span> ${html}` };
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

  if (typeof window.electronAPI.onMinerStarting === 'function') {
    window.electronAPI.onMinerStarting(() => {
      isStarting = true;
      updateControlButtons();
      updateStatusBadge('starting');
      addLogEntry('Mining startup in progress...', 'info');
    });
  }

  window.electronAPI.onMinerStarted(() => {
    isStarting = false;
    isRunning = true;
    updateControlButtons();
    updateStatusBadge('mining');
    addLogEntry('Mining started successfully', 'info');
    // Mining Console banner
    appendMiningConsole('─'.repeat(60));
    appendMiningConsole(' * ZION V3 Mainnet Ready v3.0.5 — Mining started');
    appendMiningConsole('─'.repeat(60));
  });
  
  window.electronAPI.onMinerStopped((data) => {
    isStarting = false;
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
    isStarting = false;
    isRunning = false;
    updateControlButtons();
    updateStatusBadge('stopped');
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

    // Split into priority (always shown) vs bulk (limited) lines
    const priorityRe = /accepted|rejected|speed\s+10s|new job|BLOCK FOUND|\[METRICS\]|gpu_init|wire_hello|wire_welcome|mode=remote|pool_addr=/i;
    const priorityLines = [];
    const bulkLines = [];
    for (const line of logLines) {
      if (priorityRe.test(line)) priorityLines.push(line);
      else bulkLines.push(line);
    }
    // Deduplicate METRICS lines: when renderer receives a burst (e.g. after
    // Electron throttled the background window), keep only the latest one
    // to avoid flooding the log with identical-timestamp entries.
    let lastMetricsIdx = -1;
    for (let i = priorityLines.length - 1; i >= 0; i--) {
      if (/^\[METRICS\]/.test(priorityLines[i])) {
        if (lastMetricsIdx === -1) { lastMetricsIdx = i; }
        else { priorityLines.splice(i, 1); if (lastMetricsIdx > i) lastMetricsIdx--; }
      }
    }
    for (const line of priorityLines) logStreamLine(stream, line);
    for (const line of bulkLines.slice(0, 10)) logStreamLine(stream, line);
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

  startBtn.disabled = isRunning || isStarting;
  stopBtn.disabled = !(isRunning || isStarting);
}

function updateStatusBadge(status) {
  const badge = document.getElementById('status-badge');
  if (!badge) return;

  if (status === 'mining') {
    badge.className = 'status-badge mining';
    badge.textContent = 'MINING';
  } else if (status === 'starting') {
    badge.className = 'status-badge stopped';
    badge.textContent = 'STARTING';
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
  // Fallback: if combined hashrate is 0 but GPU reports non-zero, use GPU rate
  const primaryHr = (stats.hashrate > 0 ? stats.hashrate : null)
    || (stats.hashrate_gpu > 0 ? stats.hashrate_gpu : null)
    || stats.hashrate || 0;
  const formatted = formatHashrate(primaryHr);
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
      if (s.isRunning) isStarting = false;
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
  const sendPasswordEl = document.getElementById('send-wallet-password');
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
    return (v || config.wallet || config.address || '').toString().trim();
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
        if (result.rpc_ok === false) {
          if (sendFromBalance) sendFromBalance.textContent = '— (node offline)';
          if (sendFromBalanceStatus) sendFromBalanceStatus.textContent = 'on-chain RPC offline';
        } else {
          const bal = result.balance ?? (result.balance_atomic != null ? result.balance_atomic / 1e6 : null);
          const utxoBal = result.utxo_balance_flowers ? Number(result.utxo_balance_flowers) / 1e6 : 0;
          const acctBal = result.account_balance_flowers ? Number(result.account_balance_flowers) / 1e6 : 0;
          if (sendFromBalance) sendFromBalance.textContent = bal != null ? `${bal.toFixed(6)} ZION` : 'n/a';
          // Show breakdown when both models have balance
          const parts = [];
          if (utxoBal > 0) parts.push(`UTXO: ${utxoBal.toFixed(6)}`);
          if (acctBal > 0) parts.push(`Account: ${acctBal.toFixed(6)}`);
          if (sendFromBalanceStatus) sendFromBalanceStatus.textContent = parts.length > 0 ? parts.join(' · ') : '';
        }
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
    const addr = (config.wallet || config.address || '').toString();
    if (activeWalletInput && 'value' in activeWalletInput) {
      activeWalletInput.value = addr;
    }
    // Also sync into the Receive section tab
    const recvAddr = document.getElementById('receive-wallet-address');
    if (recvAddr) recvAddr.value = addr;
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

    // On-chain balance (may be unavailable if RPC node is down)
    if (result.rpc_ok === false) {
      if (walletBalanceEl) walletBalanceEl.textContent = '— (node offline)';
      if (walletBalanceStatusEl) walletBalanceStatusEl.textContent = `On-chain RPC offline · pool data OK`;
    } else {
      const onChainBal = Number(result.balance ?? 0);
      if (walletBalanceEl) walletBalanceEl.textContent = onChainBal.toFixed(6);
      // Detect payout-not-executing: on-chain=0, pool_pending>0, pool_paid=0
      const poolPend = Number(result.pool_pending ?? 0);
      const poolPd = Number(result.pool_paid ?? 0);
      if (onChainBal === 0 && poolPend > 0 && poolPd === 0) {
        if (walletBalanceStatusEl) walletBalanceStatusEl.textContent = '⏳ Pool payouts pending — rewards not yet sent on-chain';
      } else {
        if (walletBalanceStatusEl) walletBalanceStatusEl.textContent = '';
      }
    }
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
    console.log('[WALLET-SEND] Button clicked');
    if (sendStatusEl) sendStatusEl.textContent = '';

    try {
      // Refresh config + from-address display before sending
      console.log('[WALLET-SEND] Refreshing from-address...');
      await refreshSendFrom();
      console.log('[WALLET-SEND] Refresh done');

      const from = getActiveAddress();
      const to = (sendToEl && 'value' in sendToEl ? sendToEl.value : '').toString().trim();
      const amountRaw = (sendAmountEl && 'value' in sendAmountEl ? sendAmountEl.value : '').toString().trim();
      const purpose = (sendPurposeEl && 'value' in sendPurposeEl ? sendPurposeEl.value : '').toString();
      const memo = (sendMemoEl && 'value' in sendMemoEl ? sendMemoEl.value : '').toString().trim();
      const password = (sendPasswordEl && 'value' in sendPasswordEl ? sendPasswordEl.value : '').toString();
      console.log('[WALLET-SEND] from=', from.slice(0, 12) + '...', 'to=', to.slice(0, 12) + '...', 'amount=', amountRaw);

      // Validate from
      if (!from || !from.startsWith('zion1')) {
        console.warn('[WALLET-SEND] Validation failed: no active wallet');
        if (sendStatusEl) sendStatusEl.textContent = '⚠ No active wallet. Go to Overview tab → set your wallet address.';
        if (sendNoWalletWarn) sendNoWalletWarn.style.display = 'block';
        return;
      }

      // Validate to
      if (!to || !to.startsWith('zion1')) {
        console.warn('[WALLET-SEND] Validation failed: invalid recipient');
        if (sendStatusEl) sendStatusEl.textContent = '⚠ Recipient address must be a valid zion1... address.';
        return;
      }

      // Validate amount
      const parsedAmount = parseFloat(amountRaw.replace(',', '.'));
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        console.warn('[WALLET-SEND] Validation failed: invalid amount');
        if (sendStatusEl) sendStatusEl.textContent = '⚠ Enter a valid amount greater than 0.';
        return;
      }

      if (from === to) {
        console.warn('[WALLET-SEND] Validation failed: same address');
        if (sendStatusEl) sendStatusEl.textContent = '⚠ Cannot send to yourself.';
        return;
      }

      // Require password for UTXO signing
      if (!password) {
        console.warn('[WALLET-SEND] Validation failed: no password');
        if (sendStatusEl) sendStatusEl.textContent = '⚠ Wallet password is required to sign the transaction.';
        return;
      }

      console.log('[WALLET-SEND] All validations passed, calling walletSendTransaction...');
      if (sendStatusEl) sendStatusEl.textContent = '⏳ Sending…';

      const result = await window.electronAPI.walletSendTransaction({
        rpcUrl: getRpcUrl(),
        from,
        to,
        amount: parsedAmount,
        purpose,
        memo: memo || undefined,
        password
      });
      console.log('[WALLET-SEND] Result:', result);

      if (!result?.success) {
        const err = result?.error || 'send failed';
        console.error('[WALLET-SEND] Failed:', err);
        const hint = err.includes('Insufficient') ? ' (check your balance)' : err.includes('RPC') ? ' (node unreachable — try again)' : '';
        if (sendStatusEl) sendStatusEl.textContent = `❌ ${err}${hint}`;
        return;
      }

      console.log('[WALLET-SEND] Success! model:', result.model, 'txId=', result.txId);
      if (sendStatusEl) sendStatusEl.textContent = `✅ Sent! ${result.model ? `[${result.model.toUpperCase()}]` : ''} Status: ${result.status || 'submitted'} · TX: ${result.txId || 'n/a'}`;
      if (sendToEl) sendToEl.value = '';
      if (sendAmountEl) sendAmountEl.value = '';
      if (sendPurposeEl) sendPurposeEl.value = '';
      if (sendMemoEl) sendMemoEl.value = '';
      if (sendPasswordEl) sendPasswordEl.value = '';
      // Refresh balance after successful send
      setTimeout(refreshSendFrom, 1500);
    } catch (err) {
      console.error('[WALLET-SEND] Unexpected error:', err);
      if (sendStatusEl) sendStatusEl.textContent = `❌ Unexpected error: ${err?.message || String(err)}`;
    }
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
        <button class="btn" onclick="exportWalletPrompt('${safeAddr}')" style="width: auto; padding: 10px 16px; font-size: 13px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.5); color: #10b981;">
           <svg class="icon" aria-hidden="true"><use href="#i-download"></use></svg>
           <span>Export</span>
        </button>
      </div>
    </div>
  `}).join('');

  container.innerHTML = html;

  // ── Payouts tab: refresh button ──
  const refreshPayoutsBtn = document.getElementById('refresh-payouts-btn');
  const payoutListEl = document.getElementById('payout-history-list');
  if (refreshPayoutsBtn) {
    refreshPayoutsBtn.addEventListener('click', async () => {
      if (payoutListEl) payoutListEl.textContent = 'Loading…';
      try {
        const rpcUrl = getRpcUrl();
        const info = await window.electronAPI.walletGetBalance?.({ rpcUrl, address: getActiveAddress() });
        const txs = info?.transactions || [];
        const payouts = txs.filter(tx => tx.purpose === 'payout' || tx.purpose === 'pool_payout' || (tx.inputs && tx.inputs.length === 1 && tx.inputs[0].coinbase));
        if (!payouts.length) {
          if (payoutListEl) payoutListEl.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.35)">No payouts recorded yet.<br><span style="font-size:11px">Payouts appear here when the pool finds a block.</span></div>';
          return;
        }
        const htmlRows = payouts.slice(0, 20).map(tx => {
          const h = tx.height || '—';
          const amt = tx.total_output ? (Number(tx.total_output) / 1e6).toFixed(4) : '—';
          const t = tx.time ? new Date(tx.time * 1000).toLocaleString() : '—';
          const id = tx.txid ? escapeHtml(tx.txid.slice(0, 24) + '…') : '—';
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.05);margin-bottom:6px">
            <div>
              <div style="font-size:11px;color:var(--zion-cyan);font-weight:600">Block #${h}</div>
              <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:2px">${id}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:13px;color:var(--zion-gold);font-weight:700">+${amt} ZION</div>
              <div style="font-size:10px;color:rgba(255,255,255,0.35)">${t}</div>
            </div>
          </div>`;
        }).join('');
        if (payoutListEl) payoutListEl.innerHTML = htmlRows;
      } catch (e) {
        if (payoutListEl) payoutListEl.textContent = 'Error loading payouts: ' + (e?.message || String(e));
      }
    });
  }
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

window.exportWalletPrompt = async (address) => {
  const password = prompt('Enter wallet password to export private key:');
  if (!password) return;

  const result = await window.electronAPI.exportWallet({ address, password });
  if (!result?.success) {
    alert('Export failed: ' + (result?.error || 'unknown error'));
    return;
  }

  const wallet = result.wallet;
  const exportText = `ZION Wallet Export
Address: ${wallet.address}
Public Key: ${wallet.publicKey}
Private Key: ${wallet.privateKey}
${wallet.mnemonic ? 'Mnemonic: ' + wallet.mnemonic : ''}

Keep this safe — anyone with the private key controls the wallet.`;

  navigator.clipboard.writeText(exportText);
  alert('Wallet exported to clipboard!\n\nKeep this safe — anyone with the private key controls the wallet.');
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

function updateCH3Dashboard(stats) {
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
          <span class="label">Pool (8444)</span>
          <span class="val ${poolOk ? 'ok' : 'err'}">${poolOk ? '\u2705 Online' : '\u274c Offline'} ${poolOk ? poolLatency : ''}</span>
        </div>
        <div class="server-detail">
          <span class="label">RPC (8443)</span>
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

// ── Auto-update state ────────────────────────────────────────────────────────
let _updateState = { checking: false, available: false, downloaded: false, downloading: false };

/** Called when Updates nav item is clicked (from switchView) */
function initUpdateUI() {
  const checkBtn = document.getElementById('update-check-btn');
  const installBtn = document.getElementById('update-install-btn');
  const autoCheckbox = document.getElementById('update-auto-check');
  const licenseInput = document.getElementById('license-key-input');
  const licenseBtn = document.getElementById('license-activate-btn');
  const licenseStatus = document.getElementById('license-status');

  // ── License key activation ──────────────────────────────────────────────────
  if (licenseBtn && !licenseBtn._bound) {
    licenseBtn._bound = true;

    // Load saved license key
    window.electronAPI.getLicenseKey?.().then(result => {
      if (result?.licenseKey && licenseInput) {
        licenseInput.value = result.licenseKey;
        if (licenseStatus) {
          licenseStatus.textContent = 'License key active.';
          licenseStatus.style.color = '#6ee7b7';
        }
      }
    }).catch(() => {});

    licenseBtn.addEventListener('click', async () => {
      const key = licenseInput?.value?.trim();
      if (!key) {
        if (licenseStatus) {
          licenseStatus.textContent = 'Please enter a license key.';
          licenseStatus.style.color = '#f87171';
        }
        return;
      }

      licenseBtn.disabled = true;
      licenseBtn.textContent = 'Validating...';
      if (licenseStatus) {
        licenseStatus.textContent = 'Validating license...';
        licenseStatus.style.color = '#93c5fd';
      }

      try {
        const result = await window.electronAPI.validateLicense(key);
        if (result?.success && result?.licenseValid) {
          if (licenseStatus) {
            licenseStatus.textContent = 'License activated! You can now check for updates.';
            licenseStatus.style.color = '#6ee7b7';
          }
          _setUpdateStatus('Ready', 'Click to check for updates', '#6ee7b7');
        } else {
          if (licenseStatus) {
            licenseStatus.textContent = result?.error || 'Invalid license key.';
            licenseStatus.style.color = '#f87171';
          }
        }
      } catch (err) {
        if (licenseStatus) {
          licenseStatus.textContent = err?.message || 'Validation failed. Check your connection.';
          licenseStatus.style.color = '#f87171';
        }
      } finally {
        licenseBtn.disabled = false;
        licenseBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-check"></use></svg> Activate';
      }
    });
  }

  // ── Check for updates ───────────────────────────────────────────────────────
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
          if (result?.needsLicense) {
            _setUpdateStatus('License Required', 'Enter your license key above', '#fcd34d');
          } else {
            _setUpdateStatus('Error', result?.error || 'Check failed', '#f87171');
          }
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
        case 'no-license':
          _setUpdateStatus('No License', data.message || 'Enter your license key', '#fcd34d');
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

// ============================================================================
// BRIDGE VIEW — Cross-chain bridge status + readiness checklist
// ============================================================================
function copyToClipboard(text, badgeId) {
  try {
    navigator.clipboard.writeText(text).then(() => {
      const badge = document.getElementById(badgeId);
      if (badge) { badge.classList.remove('hidden'); setTimeout(() => badge.classList.add('hidden'), 2000); }
    }).catch(() => {});
  } catch {}
}

let _bridgeInitialized = false;
let _bridgePollTimer = null;

// Fetch bridge status from the Edge relay API
async function fetchBridgeStatus() {
  const urls = [
    'http://127.0.0.1:8766/api/bridge/status',
    'https://zionterranova.com/api/bridge/status',
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (r.ok) return await r.json();
    } catch { /* try next */ }
  }
  return null;
}

function updateBridgeStats(data) {
  if (!data) return;
  const $ = id => document.getElementById(id);
  if ($('bridge-stat-mints'))    $('bridge-stat-mints').textContent    = data.evm_mints_confirmed ?? '—';
  if ($('bridge-stat-burns'))    $('bridge-stat-burns').textContent    = data.evm_burns_confirmed ?? data.l1_unlocks_confirmed ?? '—';
  if ($('bridge-stat-l1height')) $('bridge-stat-l1height').textContent = data.l1_height ?? '—';
  if ($('bridge-stat-relay')) {
    const up = data.uptime_seconds;
    $('bridge-stat-relay').textContent = up != null
      ? (up < 3600 ? `${Math.floor(up/60)}m` : `${Math.floor(up/3600)}h`)
      : (data.online ? 'Online' : '—');
  }
  const chip = $('bridge-status-chip');
  if (chip) {
    const online = data.online ? 'Online' : 'Offline';
    const upStr = data.uptime_seconds ? ` · ${Math.floor(data.uptime_seconds/3600)}h uptime` : '';
    chip.innerHTML = `<svg class="icon icon-inline" aria-hidden="true"><use href="#i-star"></use></svg>Base Mainnet · ${online}${upStr}`;
  }
}

function initBridgeView() {
  if (_bridgeInitialized) {
    void fetchBridgeStatus().then(updateBridgeStats);
    return;
  }
  _bridgeInitialized = true;
  dbg('[BRIDGE] Initializing Bridge view');

  // ── Readiness checklist ──────────────────────────────
  const grid = document.getElementById('bridge-readiness-grid');
  const countEl = document.getElementById('bridge-readiness-count');
  if (grid) {
    const items = [
      { label: 'wZION contract deployed', done: true },
      { label: 'ZIONBridge contract deployed', done: true },
      { label: 'BaseScan verified', done: false },
      { label: '5/5 Guardian multisig', done: true },
      { label: 'Relay metrics endpoint', done: true },
      { label: 'Burn widget (live)', done: true },
      { label: 'L1 → Base (mint) active', done: true },
      { label: 'Base → L1 (unlock) active', done: true },
    ];
    const doneCount = items.filter(i => i.done).length;
    if (countEl) countEl.textContent = `${doneCount}/${items.length}`;
    grid.innerHTML = items.map(item => {
      const cls = item.done ? 'status-done' : 'status-pending';
      const icon = item.done ? '✓' : '◐';
      return `<div class="bridge-readiness-row ${cls}">
        <span class="bridge-readiness-icon">${icon}</span>
        <span class="bridge-readiness-label">${escapeHtml(item.label)}</span>
      </div>`;
    }).join('');
  }

  // ── Lock widget ──────────────────────────────────────
  const evmInput   = document.getElementById('bridge-lock-evm');
  const amtInput   = document.getElementById('bridge-lock-amount');
  const fromInput  = document.getElementById('bridge-lock-from');
  const pwdInput   = document.getElementById('bridge-lock-password');
  const memoInput  = document.getElementById('bridge-lock-memo');
  const copyMemoBtn = document.getElementById('bridge-lock-copy-memo');
  const sendBtn    = document.getElementById('bridge-lock-send-btn');
  const fillBtn    = document.getElementById('bridge-lock-fill-from');
  const statusEl   = document.getElementById('bridge-lock-status');
  const resultEl   = document.getElementById('bridge-lock-tx-result');
  const txHashEl   = document.getElementById('bridge-lock-txhash');

  const BRIDGE_VAULT = 'zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0';

  // Auto-generate memo when EVM address changes
  function rebuildMemo() {
    const evm = evmInput?.value?.trim() ?? '';
    const isValidEvm = /^0x[0-9a-fA-F]{40}$/.test(evm);
    if (memoInput) {
      memoInput.value = isValidEvm ? `BRIDGE:base:${evm}` : '';
    }
    if (sendBtn) {
      const amt = parseFloat(amtInput?.value ?? '0');
      const hasFrom = !!(fromInput?.value?.trim()?.startsWith('zion1'));
      const hasPwd  = !!(pwdInput?.value?.length > 0);
      sendBtn.disabled = !(isValidEvm && amt >= 100 && hasFrom && hasPwd);
    }
  }

  if (evmInput)  evmInput.addEventListener('input',  rebuildMemo);
  if (amtInput)  amtInput.addEventListener('input',  rebuildMemo);
  if (fromInput) fromInput.addEventListener('input',  rebuildMemo);
  if (pwdInput)  pwdInput.addEventListener('input',  rebuildMemo);

  if (copyMemoBtn) {
    copyMemoBtn.addEventListener('click', () => {
      const memo = memoInput?.value ?? '';
      if (!memo) return;
      copyToClipboard(memo, 'bridge-lock-memo-copied');
    });
  }

  // Fill from active wallet
  if (fillBtn) {
    fillBtn.addEventListener('click', async () => {
      try {
        const cfg = await window.electronAPI?.getConfig?.();
        const addr = cfg?.wallet || cfg?.address || '';
        if (addr && addr.startsWith('zion1')) {
          if (fromInput) fromInput.value = addr;
          rebuildMemo();
        } else {
          if (statusEl) statusEl.textContent = '⚠ No active wallet set. Go to Wallet tab → set your wallet address.';
        }
      } catch {
        if (statusEl) statusEl.textContent = '⚠ Could not read config';
      }
    });
  }

  // Send Lock TX via wallet-send IPC
  if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
      const evm   = evmInput?.value?.trim() ?? '';
      const amt   = parseFloat(amtInput?.value ?? '0');
      const from  = fromInput?.value?.trim() ?? '';
      const pwd   = pwdInput?.value ?? '';
      const memo  = memoInput?.value ?? '';

      if (!/^0x[0-9a-fA-F]{40}$/.test(evm)) {
        if (statusEl) statusEl.textContent = '⚠ Invalid EVM address (must be 0x + 40 hex chars)';
        return;
      }
      if (amt < 100) {
        if (statusEl) statusEl.textContent = '⚠ Minimum 100 ZION';
        return;
      }
      if (!from || !from.startsWith('zion1')) {
        if (statusEl) statusEl.textContent = '⚠ Set your ZION L1 wallet address (click "Use active wallet")';
        return;
      }
      if (!pwd) {
        if (statusEl) statusEl.textContent = '⚠ Wallet password is required to sign the transaction';
        return;
      }
      if (!memo.startsWith('BRIDGE:base:')) {
        if (statusEl) statusEl.textContent = '⚠ Memo not generated — enter EVM address first';
        return;
      }

      sendBtn.disabled = true;
      if (statusEl) statusEl.textContent = '⏳ Sending lock transaction...';

      try {
        // Reuse wallet-send IPC with memo field (bridge lock TX)
        const result = await window.electronAPI?.walletSendTransaction?.({
          rpcUrl: 'http://62.171.141.136:8443/jsonrpc',
          from,
          to: BRIDGE_VAULT,
          amount: amt,
          purpose: 'bridge-lock',
          memo,
          password: pwd,
        });
        if (result?.success) {
          if (statusEl) statusEl.textContent = '';
          if (resultEl) resultEl.style.display = 'block';
          if (txHashEl) txHashEl.textContent = result.txId ?? result.tx_id ?? 'submitted';
        } else {
          if (statusEl) statusEl.textContent = `❌ ${result?.error ?? 'Transaction failed'}`;
          sendBtn.disabled = false;
        }
      } catch (e) {
        if (statusEl) statusEl.textContent = `❌ ${e.message ?? 'Unknown error'}`;
        sendBtn.disabled = false;
      }
    });
  }

  // ── Live stats polling ────────────────────────────────
  void fetchBridgeStatus().then(updateBridgeStats);

  _bridgePollTimer = setInterval(() => {
    if (currentView !== 'bridge') return;
    if (document.hidden) return;
    void fetchBridgeStatus().then(updateBridgeStats);
  }, 30000);
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
            if (binEl) {
              binEl.textContent = 'Binary nebyla nalezena. Spusť: cargo build --release -p zion-core';
              binEl.classList.add('error');
            }
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
  if (dot) dot.classList.toggle('online', running);
  if (text) {
    text.textContent = label;
    text.classList.toggle('online', running);
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
        if (activeEl) {
          activeEl.textContent = ac;
          activeEl.classList.remove('warn', 'error');
          if (ac === 0) activeEl.classList.add('error');
        }
        if (knownEl)  knownEl.textContent = kc;
        const puEl = document.getElementById('node-peers-updated');
        if (puEl) puEl.textContent = '⟳ ' + now;
      }

      // Sync status bar
      const syncBar  = document.getElementById('node-sync-bar');
      const syncIcon = document.getElementById('node-sync-icon');
      const syncTxt  = document.getElementById('node-sync-text');
      if (syncBar && syncTxt) {
        syncBar.classList.remove('ibd', 'synced');
        if (s.state === 'IBD') {
          if (syncIcon) syncIcon.textContent = '⬇';
          syncTxt.innerHTML = `Synchronizuji bloky… <b>${s.percent?.toFixed(1) ?? 0}%</b>`;
          syncBar.classList.add('ibd');
        } else if (s.state === 'Steady') {
          if (syncIcon) syncIcon.textContent = '✓';
          syncTxt.innerHTML = `Node je plně synchronizován — blok <b>#${s.download_height ?? 0}</b>`;
          syncBar.classList.add('synced');
        } else {
          if (syncIcon) syncIcon.textContent = '⚡';
          syncTxt.innerHTML = `Stav: <b>${s.state ?? '?'}</b>`;
        }
      }

      // IBD progress bar
      const barWrap = document.getElementById('node-ibd-bar-wrap');
      if (barWrap) {
        if (s.state === 'IBD' && (s.percent ?? 100) < 100) {
          barWrap.classList.add('active');
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
          barWrap.classList.remove('active');
        }
      }

      // Peers list
      if (r.peers?.known) _nodeRenderPeers(r.peers.known);

      // Pool / Network metrics (from local pool API + RPC)
      try {
        if (typeof window.electronAPI.getNetworkMetrics === 'function') {
          const net = await window.electronAPI.getNetworkMetrics();
          if (net?.success) {
            const summ = net.summary || {};
            const phEl = document.getElementById('node-pool-hashrate');
            const pmEl = document.getElementById('node-pool-miners');
            const sgEl = document.getElementById('node-sync-gap');
            const pbEl = document.getElementById('node-pool-blocks');
            if (phEl) phEl.textContent = summ.totalHashrate > 0 ? `${(summ.totalHashrate / 1e6).toFixed(2)} MH/s` : '—';
            if (pmEl) pmEl.textContent = summ.totalMiners ?? '—';
            if (sgEl) {
              const gap = (summ.maxHeight && summ.minHeight) ? (summ.maxHeight - summ.minHeight) : 0;
              sgEl.textContent = gap > 0 ? `${gap} blocks` : '0';
              sgEl.classList.remove('warn', 'error');
              if (gap > 5) sgEl.classList.add('error');
              else if (gap > 2) sgEl.classList.add('warn');
            }
            if (pbEl) pbEl.textContent = summ.totalBlocks ?? '—';
          }
        }
      } catch (e) { dbg('[NODE] Network metrics error:', e.message); }

    } else if (!r.running) {
      if (!_nodeRunning) {
        _nodeSetStatus(false, 'Offline');
        const syncTxt = document.getElementById('node-sync-text');
        const syncIcon = document.getElementById('node-sync-icon');
        const syncBar = document.getElementById('node-sync-bar');
        if (syncTxt)  syncTxt.innerHTML = 'Node není spuštěn — klikni na <b>Spustit Node</b>';
        if (syncIcon) syncIcon.textContent = '⚡';
        if (syncBar)  syncBar.classList.remove('ibd', 'synced');
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
    listEl.innerHTML = `<div class="placeholder-row">Žádné peery zatím nepřipojeny.</div>`;
    return;
  }

  listEl.innerHTML = peerList.map(p => {
    const addr      = escapeHtml(String(p.addr || p.address || '?'));
    const height    = p.height > 0 ? Number(p.height).toLocaleString() : '—';
    const agent     = escapeHtml(String(p.agent || '—'));
    const connected = !!p.connected;
    const cls       = connected ? 'peer-row connected' : 'peer-row';
    const statusLbl = connected ? '● Připojen' : '○ Known';
    const nowSec  = Date.now() / 1000;
    const idleSec = p.last_seen > 0 ? Math.round(nowSec - p.last_seen) : null;
    const idleStr = idleSec == null ? '—' : idleSec < 60 ? `${idleSec}s` : idleSec < 3600 ? `${Math.floor(idleSec/60)}m` : `${Math.floor(idleSec/3600)}h`;
    return `<div class="${cls}">
      <div style="display:flex;align-items:center;gap:10px">
        <span class="peer-dot"></span>
        <div>
          <div class="peer-addr">${addr}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:2px">
            <span class="peer-status">${statusLbl}</span>
            <span class="peer-agent">${agent}</span>
          </div>
        </div>
      </div>
      <div class="peer-meta">
        <span>H: <b class="height">${height}</b></span>
        <span class="idle">idle ${idleStr}</span>
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
      const labelHtml = label ? `<span class="label">${label}</span>` : '';
      return `<div class="checkpoint-row">
        <div>
          <div class="height">Blok #${hStr} ${labelHtml}</div>
          <div class="hash">${hash}</div>
        </div>
        <span class="badge">Checkpoint</span>
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

// ═══════════════════════════════════════════════════════════════════════════════
// DeFi View — L2 Staking / Farming / Overview
// ═══════════════════════════════════════════════════════════════════════════════

let _defiInitDone = false;
let _defiRefreshTimer = null;
const DEFI_API = '/api/defi/status';
const DEFI_SITE_API = 'https://zionterranova.com/api/defi/status';
// GeckoTerminal pool IDs for wZION on Base
const GECKO_POOL_USDT = 'base/0x_wzion_usdt'; // updated if known
const GECKO_POOLS_API = 'https://api.geckoterminal.com/api/v2/networks/base/tokens/0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6/pools?page=1';

async function fetchDefiStatus() {
  // Try local first (if running inside website), fallback to remote
  for (const url of [DEFI_API, DEFI_SITE_API]) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.ok) return data;
    } catch { /* try next */ }
  }
  return null;
}

async function fetchDefiPools() {
  // Also try our own website pool API
  const urls = [
    'https://zionterranova.com/api/defi/pools',
    GECKO_POOLS_API,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      return await res.json();
    } catch { /* try next */ }
  }
  return null;
}

function updateDefiUI(data) {
  if (!data) return;
  const $ = id => document.getElementById(id);
  if ($('defi-wzion-supply'))    $('defi-wzion-supply').textContent    = data.data?.wZION?.totalSupply ?? '—';
  if ($('defi-total-staked'))    $('defi-total-staked').textContent    = data.data?.staking?.totalStaked ?? '—';
  if ($('defi-staking-apr'))     $('defi-staking-apr').textContent     = data.data?.staking?.apr ?? '~12%';
  if ($('defi-staking-apr-detail')) $('defi-staking-apr-detail').textContent = data.data?.staking?.apr ?? '~12%';
  if ($('defi-farm-pools'))      $('defi-farm-pools').textContent      = data.data?.farm?.poolCount ?? '—';
  if ($('defi-proposals'))       $('defi-proposals').textContent       = data.data?.governance?.proposalCount ?? '—';
  if ($('defi-network'))         $('defi-network').textContent         = data.network ?? 'Base Mainnet';
  if ($('defi-farm-rps'))        $('defi-farm-rps').textContent        = data.data?.farm?.rewardPerSecond ?? '—';
}

function updateDefiPoolsUI(poolData) {
  if (!poolData) return;
  const $ = id => document.getElementById(id);

  // Our website API format: poolData.pools.wzion_usdt / wzion_weth
  const usdt = poolData.pools?.wzion_usdt;
  const weth = poolData.pools?.wzion_weth;

  if (usdt) {
    if ($('defi-pool-usdt-price')) $('defi-pool-usdt-price').textContent = usdt.price?.usd_per_wzion != null ? `$${Number(usdt.price.usd_per_wzion).toFixed(4)}` : '—';
    if ($('defi-pool-usdt-liq'))   $('defi-pool-usdt-liq').textContent   = usdt.liquidity ?? '—';
    if ($('defi-pool-usdt-badge')) {
      $('defi-pool-usdt-badge').textContent = usdt.active ? 'Active' : 'Inactive';
      $('defi-pool-usdt-badge').style.color = usdt.active ? '#6ee7b7' : '#f87171';
    }
    // price strip
    if ($('defi-price-usd')) $('defi-price-usd').textContent = usdt.price?.usd_per_wzion != null ? `$${Number(usdt.price.usd_per_wzion).toFixed(4)}` : '—';
  }
  if (weth) {
    if ($('defi-pool-weth-price')) $('defi-pool-weth-price').textContent = weth.price?.usd_per_wzion != null ? `$${Number(weth.price.usd_per_wzion).toFixed(4)}` : '—';
    if ($('defi-pool-weth-liq'))   $('defi-pool-weth-liq').textContent   = weth.liquidity ?? '—';
    if ($('defi-pool-weth-badge')) {
      $('defi-pool-weth-badge').textContent = weth.active ? 'Active' : 'Inactive';
      $('defi-pool-weth-badge').style.color = weth.active ? '#6ee7b7' : '#f87171';
    }
  }

  // Pools grid (detailed view)
  const grid = $('defi-pools-grid');
  if (grid && (usdt || weth)) {
    const rows = [];
    for (const [key, pool] of Object.entries(poolData.pools ?? {})) {
      if (!pool) continue;
      const priceStr = pool.price?.usd_per_wzion != null ? `$${Number(pool.price.usd_per_wzion).toFixed(4)}` : '—';
      const liqStr = pool.liquidity ?? '—';
      const label = key === 'wzion_usdt' ? 'wZION / USDT (0.3%)' : key === 'wzion_weth' ? 'wZION / WETH (0.3%)' : key;
      const borderColor = key === 'wzion_usdt' ? 'rgba(99,102,241,0.6)' : 'rgba(16,185,129,0.6)';
      rows.push(`<div class="control-panel panel-tight" style="border-left:3px solid ${borderColor}">
        <div class="stack-col" style="gap:4px">
          <span style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.85)">${escapeHtml(label)}</span>
          <div class="inline-row" style="gap:16px;flex-wrap:wrap">
            <span style="font-size:12px;color:rgba(255,255,255,0.6)">Price: <strong>${priceStr}</strong></span>
            <span style="font-size:12px;color:rgba(255,255,255,0.6)">Liquidity: <strong>${escapeHtml(liqStr)}</strong></span>
            <span style="font-size:12px;color:${pool.active ? '#6ee7b7' : '#f87171'}">${pool.active ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
      </div>`);
    }
    if (rows.length) grid.innerHTML = rows.join('');
    else grid.innerHTML = '<span style="color:rgba(255,255,255,0.35);font-size:12px">No pool data available</span>';
  }
}

async function refreshDefiData() {
  const [status, pools] = await Promise.all([fetchDefiStatus(), fetchDefiPools()]);
  updateDefiUI(status);
  updateDefiPoolsUI(pools);
}

function initDefiView() {
  if (_defiInitDone) {
    void refreshDefiData();
    return;
  }
  _defiInitDone = true;

  // Refresh button
  const refreshBtn = document.getElementById('defi-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => void refreshDefiData());
  }

  // Staking buttons — real TX needs MetaMask, redirect to website
  const stakeBtn   = document.getElementById('defi-stake-btn');
  const unstakeBtn = document.getElementById('defi-unstake-btn');
  const claimBtn   = document.getElementById('defi-claim-btn');
  const stakeStatus = document.getElementById('defi-stake-status');

  if (stakeBtn) {
    stakeBtn.addEventListener('click', () => {
      const amt = document.getElementById('defi-stake-amount')?.value;
      if (!amt || Number(amt) <= 0) {
        if (stakeStatus) stakeStatus.textContent = '⚠ Enter a valid amount';
        return;
      }
      window.electronAPI?.openExternal?.('https://zionterranova.com/defi/staking');
      if (stakeStatus) stakeStatus.textContent = 'Opening staking page — connect MetaMask to complete on-chain';
    });
  }
  if (unstakeBtn) {
    unstakeBtn.addEventListener('click', () => {
      window.electronAPI?.openExternal?.('https://zionterranova.com/defi/staking');
      if (stakeStatus) stakeStatus.textContent = 'Opening staking page...';
    });
  }
  if (claimBtn) {
    claimBtn.addEventListener('click', () => {
      window.electronAPI?.openExternal?.('https://zionterranova.com/defi/staking');
      if (stakeStatus) stakeStatus.textContent = 'Opening staking page...';
    });
  }

  // Farm buttons
  const farmDeposit  = document.getElementById('defi-farm-deposit-btn');
  const farmWithdraw = document.getElementById('defi-farm-withdraw-btn');
  const farmHarvest  = document.getElementById('defi-farm-harvest-btn');
  const farmStatus   = document.getElementById('defi-farm-status');
  const openFarm = () => {
    window.electronAPI?.openExternal?.('https://zionterranova.com/defi/farming');
    if (farmStatus) farmStatus.textContent = 'Opening farming page...';
  };
  if (farmDeposit)  farmDeposit.addEventListener('click', openFarm);
  if (farmWithdraw) farmWithdraw.addEventListener('click', openFarm);
  if (farmHarvest)  farmHarvest.addEventListener('click', openFarm);

  // Portfolio EVM lookup
  const portfolioInput  = document.getElementById('defi-portfolio-evm');
  const portfolioBtn    = document.getElementById('defi-portfolio-lookup-btn');
  const portfolioResult = document.getElementById('defi-portfolio-result');
  const portfolioStatus = document.getElementById('defi-portfolio-status');

  if (portfolioBtn) {
    portfolioBtn.addEventListener('click', async () => {
      const evm = portfolioInput?.value?.trim() ?? '';
      if (!/^0x[0-9a-fA-F]{40}$/.test(evm)) {
        if (portfolioStatus) portfolioStatus.textContent = '⚠ Enter a valid 0x EVM address';
        return;
      }
      if (portfolioStatus) portfolioStatus.textContent = 'Looking up balances...';
      if (portfolioResult) portfolioResult.style.display = 'none';

      try {
        // Fetch wZION balance via our website API or BaseScan
        const url = `https://zionterranova.com/api/defi/portfolio?address=${encodeURIComponent(evm)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const d = await res.json();
          const $ = id => document.getElementById(id);
          if ($('defi-portfolio-wzion'))  $('defi-portfolio-wzion').textContent  = d.wzion_balance != null ? `${Number(d.wzion_balance).toFixed(4)} wZION` : '—';
          if ($('defi-portfolio-staked')) $('defi-portfolio-staked').textContent = d.staked != null ? Number(d.staked).toFixed(4) : '—';
          if ($('defi-portfolio-pending')) $('defi-portfolio-pending').textContent = d.pending_rewards != null ? Number(d.pending_rewards).toFixed(4) : '—';
          if ($('defi-portfolio-lp'))     $('defi-portfolio-lp').textContent     = d.lp_deposited != null ? Number(d.lp_deposited).toFixed(4) : '—';
          if (portfolioResult) portfolioResult.style.display = 'flex';
          if (portfolioStatus) portfolioStatus.textContent = '';
        } else {
          // Fallback: direct to BaseScan
          window.electronAPI?.openExternal?.(`https://basescan.org/token/0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6?a=${evm}`);
          if (portfolioStatus) portfolioStatus.textContent = 'Portfolio API not available — opening BaseScan';
        }
      } catch {
        if (portfolioStatus) portfolioStatus.textContent = 'Unable to fetch portfolio data — check connection';
      }
    });
  }

  // Initial data load
  void refreshDefiData();

  // Auto-refresh every 30s while on DeFi view
  _defiRefreshTimer = setInterval(() => {
    if (currentView !== 'defi') return;
    if (document.hidden) return;
    void refreshDefiData();
  }, 30000);
}

// ═════════════════════════════════════════════════════════════════════════════
// HIRAN AI CHAT VIEW
// ═════════════════════════════════════════════════════════════════════════════

function initAiView() {
  const sendBtn = document.getElementById('ai-chat-send');
  const input = document.getElementById('ai-chat-input');
  const history = document.getElementById('ai-chat-history');
  const status = document.getElementById('ai-chat-status');
  const testBtn = document.getElementById('ai-test-connection');

  async function appendMessage(role, text) {
    if (!history) return;
    const div = document.createElement('div');
    div.style.marginBottom = '10px';
    div.style.padding = '8px 12px';
    div.style.borderRadius = '10px';
    div.style.maxWidth = '85%';
    div.style.wordBreak = 'break-word';
    if (role === 'user') {
      div.style.background = 'rgba(147,51,234,0.15)';
      div.style.marginLeft = 'auto';
      div.style.border = '1px solid rgba(147,51,234,0.2)';
    } else {
      div.style.background = 'rgba(255,255,255,0.04)';
      div.style.border = '1px solid rgba(255,255,255,0.08)';
    }
    div.innerHTML = `<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.4);margin-bottom:3px">${escapeHtml(role)}</div><div style="color:rgba(255,255,255,0.9)">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
    history.appendChild(div);
    history.scrollTop = history.scrollHeight;
  }

  async function doSend() {
    if (!input || !status) return;
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    await appendMessage('user', msg);
    status.textContent = 'Thinking…';
    try {
      const res = await window.electronAPI.aiChatAsk({ message: msg });
      if (res?.success) {
        await appendMessage('hiran', res.reply);
        status.textContent = `Latency: ${res.latencyMs || 0}ms`;
      } else {
        await appendMessage('system', 'Error: ' + (res?.error || 'Unknown'));
        status.textContent = 'Error';
      }
    } catch (err) {
      await appendMessage('system', 'Error: ' + (err?.message || String(err)));
      status.textContent = 'Error';
    }
  }

  if (sendBtn) sendBtn.addEventListener('click', doSend);
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSend();
    });
  }

  async function checkAiStatus() {
    const stEl  = document.getElementById('ai-inference-status');
    const latEl = document.getElementById('ai-latency');
    const beEl  = document.getElementById('ai-backend');
    const upEl  = document.getElementById('ai-uptime');
    if (stEl) stEl.textContent = 'Checking…';
    try {
      const t0 = Date.now();
      const res = await window.electronAPI.aiChatStatus();
      const ms  = Date.now() - t0;
      if (res?.up) {
        if (stEl) { stEl.textContent = 'Online'; stEl.style.color = 'var(--zion-cyan)'; }
        if (latEl) latEl.textContent = ms + ' ms';
        if (beEl)  beEl.textContent  = res?.info?.backend ?? 'llama-server';
        if (upEl && res?.info?.uptime_s) upEl.textContent = Math.floor(res.info.uptime_s) + 's';
      } else {
        if (stEl) { stEl.textContent = 'Offline'; stEl.style.color = 'rgb(239,68,68)'; }
        if (latEl) latEl.textContent = '—';
        if (beEl)  beEl.textContent  = '—';
      }
    } catch {
      if (stEl) stEl.textContent = 'Offline';
    }
  }

  if (testBtn) {
    testBtn.addEventListener('click', checkAiStatus);
  }

  // ── ▶ Start Hiran Inference button ────────────────────────────────────
  const startBtn   = document.getElementById('ai-start-service');
  const startResult = document.getElementById('ai-start-result');
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      if (startResult) startResult.textContent = 'Starting…';
      startBtn.disabled = true;
      try {
        if (window.electronAPI?.runScript) {
          const res = await window.electronAPI.runScript('start-hiran-inference');
          if (startResult) startResult.textContent = res?.ok ? 'Started — polling health…' : ('Error: ' + (res?.error ?? ''));
        } else {
          if (startResult) startResult.textContent = 'runScript API not available — use dashboard Start button.';
        }
      } catch (e) {
        if (startResult) startResult.textContent = 'Error: ' + String(e);
      } finally {
        startBtn.disabled = false;
        setTimeout(checkAiStatus, 5000);
        setTimeout(checkAiStatus, 10000);
      }
    });
  }

  // Auto-check on view open
  checkAiStatus();
}

_viewInitFns.ai = () => { initAiView(); initNclView(); };

// ═══════════════════════════════════════════════════════════════════════════
// NCL (Neural Compute Layer) — Dashboard Tab
// ═══════════════════════════════════════════════════════════════════════════

function initNclView() {
  const submitBtn = document.getElementById('ncl-submit-btn');
  const jobTypeSelect = document.getElementById('ncl-job-type');
  const jobResult = document.getElementById('ncl-job-result');

  async function refreshNclStatus() {
    try {
      // Check orchestrator health
      const orchStatus = await window.electronAPI.aiNativeStatus();
      const orchEl = document.getElementById('ncl-orch-status');
      if (orchEl) {
        if (orchStatus?.up) {
          orchEl.textContent = 'Online';
          orchEl.style.color = '';
        } else {
          orchEl.textContent = 'Offline';
          orchEl.style.color = 'rgb(239,68,68)';
        }
      }

      // NCL health
      const nclStatus = await window.electronAPI.nclGetStatus();
      const healthEl = document.getElementById('ncl-health');
      if (healthEl) {
        if (nclStatus?.success) {
          healthEl.textContent = 'Active';
          healthEl.style.color = '';
        } else {
          healthEl.textContent = orchStatus?.up ? 'Idle' : 'Offline';
          healthEl.style.color = orchStatus?.up ? '' : 'rgb(239,68,68)';
        }
      }

      // Workers
      const workers = await window.electronAPI.nclGetWorkers();
      const workerEl = document.getElementById('ncl-worker-count');
      if (workerEl && workers?.success) {
        const list = Array.isArray(workers.workers) ? workers.workers : [];
        workerEl.textContent = String(list.length);
      }

      // Pricing
      const price = await window.electronAPI.nclGetPrice();
      const priceEl = document.getElementById('ncl-compute-price');
      if (priceEl && price?.success && price.pricing) {
        const p = price.pricing;
        priceEl.textContent = p.price_per_token ? `${p.price_per_token} ZION/tok` : 'Free tier';
      }

      // Leaderboard
      const lb = await window.electronAPI.nclGetLeaderboard();
      const lbEl = document.getElementById('ncl-leaderboard-list');
      if (lbEl && lb?.success) {
        const entries = Array.isArray(lb.leaderboard) ? lb.leaderboard : [];
        if (entries.length === 0) {
          lbEl.innerHTML = '<div style="color:rgba(255,255,255,0.35);text-align:center;padding:20px">No workers registered yet</div>';
        } else {
          lbEl.innerHTML = entries.slice(0, 10).map((w, i) => `
            <div style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;align-items:center">
              <span style="color:rgba(255,255,255,0.8)">${i + 1}. ${w.wallet || w.worker_id || w.id || 'Worker'}</span>
              <span style="color:var(--zion-cyan,#06b6d4);font-weight:600">${w.reputation ?? w.score ?? 0} pts</span>
            </div>
          `).join('');
        }
      }
    } catch (err) {
      console.error('NCL status refresh failed:', err);
    }
  }

  // Submit job button
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const jobType = jobTypeSelect?.value || 'inference';
      if (jobResult) jobResult.textContent = 'Submitting...';
      try {
        const result = await window.electronAPI.nclSubmitJob({
          job_type: jobType,
          model_id: 'hiran-v2.2',
          backend: 'Custom',
          params: { prompt: 'Desktop agent test' },
          priority: 5,
          submitter: 'desktop-agent',
          input_hash: Date.now().toString(16),
          reward_flowers: 20000000000,
          max_duration_secs: 60
        });
        if (result?.success) {
          if (jobResult) jobResult.textContent = `Job queued: ${result.job?.job_id || result.job?.id || 'OK'}`;
          refreshNclStatus();
        } else {
          if (jobResult) jobResult.textContent = `Error: ${result?.error || 'Unknown'}`;
        }
      } catch (err) {
        if (jobResult) jobResult.textContent = `Error: ${err.message}`;
      }
    });
  }

  // Auto-refresh every 10s
  let nclInterval = setInterval(refreshNclStatus, 10000);
  refreshNclStatus();
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI View — ZION Unified Command Line Interface
// ═══════════════════════════════════════════════════════════════════════════════

function initCliView() {
  const consoleEl = document.getElementById('cli-console');
  const statusBadge = document.getElementById('cli-status-badge');

  function appendCliOutput(text, isError = false) {
    const line = document.createElement('div');
    line.className = isError ? 'cli-line error' : 'cli-line';
    line.textContent = text;
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  function clearConsole() {
    consoleEl.innerHTML = '';
  }

  async function runCli(handlerName, label, args = {}) {
    statusBadge.textContent = `${label}…`;
    statusBadge.className = 'cli-badge busy';
    try {
      const result = await window.electronAPI[handlerName](args);
      if (result?.success) {
        appendCliOutput(`$ zion ${label}\n${result.output || 'OK'}`);
      } else {
        appendCliOutput(`$ zion ${label}\nError: ${result?.error || 'Unknown error'}`, true);
      }
    } catch (err) {
      appendCliOutput(`$ zion ${label}\nException: ${err.message}`, true);
    }
    statusBadge.textContent = 'Ready';
    statusBadge.className = 'cli-badge ready';
  }

  document.getElementById('cli-btn-version')?.addEventListener('click', () => runCli('cliGetVersion', '--version'));
  document.getElementById('cli-btn-mine-status')?.addEventListener('click', () => runCli('cliMineStatus', 'mine status'));
  document.getElementById('cli-btn-wallet-list')?.addEventListener('click', () => runCli('cliWalletList', 'wallet list'));
  document.getElementById('cli-btn-wallet-balance')?.addEventListener('click', async () => {
    const address = prompt('Enter ZION address (or leave empty for config wallet):');
    await runCli('cliWalletBalance', 'wallet balance', { address: address || undefined });
  });
  document.getElementById('cli-btn-config-get')?.addEventListener('click', async () => {
    const key = prompt('Enter config key (or leave empty for all):');
    await runCli('cliConfigGet', 'config get', { key: key || undefined });
  });
  document.getElementById('cli-btn-clear')?.addEventListener('click', clearConsole);

  // Send transaction
  document.getElementById('cli-btn-send')?.addEventListener('click', async () => {
    const wallet = document.getElementById('cli-send-wallet').value.trim();
    const to = document.getElementById('cli-send-to').value.trim();
    const amount = document.getElementById('cli-send-amount').value.trim();
    if (!wallet || !to || !amount) {
      appendCliOutput('Error: wallet, to, and amount are required', true);
      return;
    }
    await runCli('cliWalletSend', `wallet send -w ${wallet} --to ${to} --amount ${amount}`, { wallet, to, amount });
  });

  // Mining controls
  document.getElementById('cli-btn-mine-start')?.addEventListener('click', async () => {
    const wallet = document.getElementById('cli-mine-wallet').value.trim();
    const pool = document.getElementById('cli-mine-pool').value.trim() || '62.171.141.136:8444';
    if (!wallet) {
      appendCliOutput('Error: wallet address is required', true);
      return;
    }
    await runCli('cliMineStart', 'mine start', { pool, wallet });
  });
  document.getElementById('cli-btn-mine-stop')?.addEventListener('click', () => runCli('cliMineStop', 'mine stop'));

  // ── Bridge ────────────────────────────────────────────────────────
  document.getElementById('cli-btn-bridge-status')?.addEventListener('click', () => runCli('cliBridgeStatus', 'bridge status'));
  document.getElementById('cli-btn-bridge-pending')?.addEventListener('click', () => runCli('cliBridgePending', 'bridge pending'));
  document.getElementById('cli-btn-bridge-chains')?.addEventListener('click', () => runCli('cliBridgeChains', 'bridge chains'));
  document.getElementById('cli-btn-bridge-history')?.addEventListener('click', async () => {
    const n = prompt('Number of entries (default 10):') || '10';
    await runCli('cliBridgeHistory', `bridge history ${n}`, { n: parseInt(n) || 10 });
  });

  // ── DAO ───────────────────────────────────────────────────────────
  document.getElementById('cli-btn-dao-status')?.addEventListener('click', () => runCli('cliDaoStatus', 'dao status'));
  document.getElementById('cli-btn-dao-proposals')?.addEventListener('click', () => runCli('cliDaoProposals', 'dao proposals'));
  document.getElementById('cli-btn-dao-treasury')?.addEventListener('click', () => runCli('cliDaoTreasury', 'dao treasury'));
  document.getElementById('cli-btn-dao-params')?.addEventListener('click', () => runCli('cliDaoParams', 'dao params'));

  // ── Pool ──────────────────────────────────────────────────────────
  document.getElementById('cli-btn-pool-stats')?.addEventListener('click', () => runCli('cliPoolStats', 'pool stats edge', { target: 'edge' }));
  document.getElementById('cli-btn-pool-miners')?.addEventListener('click', () => runCli('cliPoolMiners', 'pool miners edge', { target: 'edge' }));
  document.getElementById('cli-btn-pool-config')?.addEventListener('click', () => runCli('cliPoolConfig', 'pool config edge', { target: 'edge' }));
  document.getElementById('cli-btn-pool-earnings')?.addEventListener('click', async () => {
    const address = prompt('Your ZION address (or empty for config wallet):');
    await runCli('cliPoolEarnings', 'pool earnings', { address: address || undefined, target: 'edge' });
  });

  // ── Warp ──────────────────────────────────────────────────────────
  document.getElementById('cli-btn-warp-status')?.addEventListener('click', () => runCli('cliWarpStatus', 'warp status'));
  document.getElementById('cli-btn-warp-chains')?.addEventListener('click', () => runCli('cliWarpChains', 'warp chains'));
  document.getElementById('cli-btn-warp-pending')?.addEventListener('click', () => runCli('cliWarpPending', 'warp pending'));
  document.getElementById('cli-btn-warp-stats')?.addEventListener('click', () => runCli('cliWarpStats', 'warp stats'));
}
