/* ZionOS Dashboard Client */

const API = location.origin;
let refreshTimer = null;
let currentPanel = 'overview';
let consoleWs = null;
let liveWs = null;
let hashrateHistory = [];
const MAX_CHART_POINTS = 120;
let rigSparklines = {};
let shareEvents = [];
let alerts = [];
let rigsCache = [];
let consoleLogs = [];
let flightSheets = [];
let selectedRigIds = new Set();
let fetchQueued = false;
let authErrorShown = false;

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupNavigation();
  setupConsole();
  setupSettings();
  setupBatchControls();
  startClock();
  connectLiveWs();
  startPolling();
  showPanel('overview');
});

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      showPanel(item.dataset.panel);
    });
  });

  const toggle = document.getElementById('sidebar-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });
  }
}

function showPanel(name) {
  currentPanel = name;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.panel === name));

  const titleMap = {
    overview: 'Overview',
    infra: 'Infrastructure',
    rigs: 'Rig Management',
    console: 'Console',
    pool: 'Pool Statistics',
    wallet: 'Wallet & Earnings',
    settings: 'Settings',
  };
  const title = document.getElementById('page-title');
  if (title) title.textContent = titleMap[name] || name;

  if (name === 'console') connectConsoleWs();
}

function startPolling() {
  fetchAll();
  const interval = (Number(getSetting('refresh')) || 5) * 1000;
  refreshTimer = setInterval(fetchAll, interval);
}

async function fetchAll() {
  try {
    const [overviewRes, infraRes, rigsRes, logsRes, sharesRes, alertsRes, fsRes, earningsRes] = await Promise.all([
      fetch(API + '/api/overview').then(r => r.json()),
      fetch(API + '/api/infra').then(r => r.json()).catch(() => null),
      fetch(API + '/api/rigs').then(r => r.json()),
      fetch(API + '/api/logs').then(r => r.json()),
      fetch(API + '/api/shares').then(r => r.json()).catch(() => []),
      fetch(API + '/api/alerts').then(r => r.json()).catch(() => []),
      fetch(API + '/api/flightsheets').then(r => r.json()).catch(() => []),
      fetch(API + '/api/wallet/earnings').then(r => r.json()).catch(() => null),
    ]);

    updateOverview(overviewRes);
    if (infraRes) updateInfraPanel(infraRes);
    updateRigs(rigsRes);
    updateConsoleFromPolled(logsRes);
    updatePoolPanel(overviewRes.pool);
    updateShareTimeline(sharesRes);
    updateAlerts(alertsRes);
    updateFlightSheets(fsRes);
    updateWalletPanel(earningsRes);
    updateConnectionStatus(true);
  } catch (e) {
    updateConnectionStatus(false);
    console.error('Fetch error:', e);
  }
}

function queueFetch() {
  if (fetchQueued) return;
  fetchQueued = true;
  setTimeout(() => {
    fetchQueued = false;
    fetchAll();
  }, 300);
}

function getControlToken() {
  return (getSetting('api-token') || '').trim();
}

function withAuthHeaders(headers = {}) {
  const out = { ...headers };
  const token = getControlToken();
  if (!token) return out;
  out.Authorization = `Bearer ${token}`;
  out['X-ZionOS-Token'] = token;
  return out;
}

async function apiFetch(path, options = {}) {
  const opts = { ...options };
  opts.headers = withAuthHeaders(options.headers || {});
  const res = await fetch(`${API}${path}`, opts);
  if (res.status === 401) {
    if (!authErrorShown) {
      authErrorShown = true;
      alert('Unauthorized: set the API Control Token in Settings.');
    }
  } else {
    authErrorShown = false;
  }
  return res;
}

function connectLiveWs() {
  if (liveWs && (liveWs.readyState === WebSocket.OPEN || liveWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/live`;
  try {
    liveWs = new WebSocket(wsUrl);
    liveWs.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        if (ev.type === 'log' && ev.data) {
          consoleLogs.push(ev.data);
          if (currentPanel === 'console') appendConsoleLines([ev.data]);
        }
        queueFetch();
      } catch {
        queueFetch();
      }
    };
    liveWs.onclose = () => {
      liveWs = null;
      setTimeout(connectLiveWs, 1500);
    };
    liveWs.onerror = () => {
      liveWs = null;
    };
  } catch {
    setTimeout(connectLiveWs, 1500);
  }
}

function updateConnectionStatus(online) {
  const el = document.getElementById('connection-status');
  if (!el) return;
  if (online) {
    el.className = 'conn-badge conn-online';
    el.textContent = 'Connected';
  } else {
    el.className = 'conn-badge conn-offline';
    el.textContent = 'Disconnected';
  }
}

function updateOverview(data) {
  setText('kpi-hashrate', fmtHashrate(data.total_hashrate));
  setText('kpi-hashrate-pool', `Pool: ${fmtHashrate(data.pool.hashrate)}`);
  setText('kpi-accepted', fmtNum(data.total_accepted));
  const total = data.total_accepted + data.total_rejected;
  const rate = total > 0 ? ((data.total_accepted / total) * 100).toFixed(1) : '0.0';
  setText('kpi-accept-rate', `Rate: ${rate}%`);
  setText('kpi-miners', String(data.rigs_total));
  setText('kpi-miners-detail', `Online: ${data.rigs_online} | Mining: ${data.rigs_mining}`);
  setText('kpi-blocks', fmtNum(data.pool.blocks_found));
  setText('kpi-uptime', `Avg uptime: ${fmtDuration(data.uptime_avg_s)}`);

  hashrateHistory.push({ t: Date.now(), v: data.total_hashrate, p: data.pool.hashrate });
  if (hashrateHistory.length > MAX_CHART_POINTS) hashrateHistory.shift();
  drawHashrateChart();
}

function updateRigs(rigs) {
  rigsCache = rigs;

  rigs.forEach(r => {
    if (!rigSparklines[r.id]) rigSparklines[r.id] = [];
    rigSparklines[r.id].push(r.stats.hashrate || 0);
    if (rigSparklines[r.id].length > 30) rigSparklines[r.id].shift();
  });

  // Keep selected IDs valid
  selectedRigIds = new Set([...selectedRigIds].filter(id => rigs.some(r => r.id === id)));

  updateRigFleet(rigs);
  renderRigsTable(rigs);
  renderGpuMonitor(rigs);
  updateConsoleRigSelect(rigs);
}

function updateRigFleet(rigs) {
  const grid = document.getElementById('rig-fleet-grid');
  if (!grid) return;
  grid.innerHTML = rigs.map(r => `
    <div class="rig-mini-card" onclick="openRigDetail('${esc(r.id)}')">
      <div class="rig-status-dot dot-${r.status}"></div>
      <div class="rig-mini-info">
        <div class="rig-mini-name">${esc(r.name)}</div>
        <div class="rig-mini-gpu">${esc(r.gpu?.name || 'CPU')}</div>
      </div>
      <div class="rig-mini-hr">${fmtHashrate(r.stats.hashrate)}</div>
    </div>
  `).join('');
}

function renderRigsTable(rigs) {
  const search = (document.getElementById('rig-search')?.value || '').toLowerCase();
  const filtered = rigs.filter(r =>
    r.name.toLowerCase().includes(search) ||
    r.id.toLowerCase().includes(search) ||
    (r.gpu?.name || '').toLowerCase().includes(search)
  );

  const tbody = document.getElementById('rigs-tbody');
  if (!tbody) return;

  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td><input type="checkbox" class="rig-select" data-rig="${esc(r.id)}" ${selectedRigIds.has(r.id) ? 'checked' : ''}/></td>
      <td><span class="status-badge status-${r.status}">${statusIcon(r.status)} ${r.status}</span></td>
      <td><strong>${esc(r.name)}</strong><br/><span style="color:var(--text-dim);font-size:11px">${esc(r.worker)}</span></td>
      <td>${esc(r.gpu?.name || 'CPU')}</td>
      <td style="font-family:var(--font-mono);color:var(--gold);font-weight:700">${fmtHashrate(r.stats.hashrate)}</td>
      <td><canvas class="sparkline-canvas" data-rig="${esc(r.id)}"></canvas></td>
      <td><span style="color:var(--emerald)">${fmtNum(r.stats.accepted)}</span> / <span style="color:var(--red)">${fmtNum(r.stats.rejected)}</span></td>
      <td>${r.gpu?.temp_c != null ? r.gpu.temp_c.toFixed(0) + 'C' : '-'}</td>
      <td>${r.gpu?.power_w != null ? r.gpu.power_w.toFixed(0) + 'W' : '-'}</td>
      <td>${fmtDuration(r.stats.uptime_s)}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn-action" onclick="rigCmd('${esc(r.id)}','start')" title="Start">Start</button>
          <button class="btn-action" onclick="rigCmd('${esc(r.id)}','stop')" title="Stop">Stop</button>
          <button class="btn-action" onclick="rigCmd('${esc(r.id)}','restart')" title="Restart">Restart</button>
          <button class="btn-action" onclick="openRigDetail('${esc(r.id)}')" title="Detail">Detail</button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.rig-select').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const rigId = e.target.dataset.rig;
      if (e.target.checked) selectedRigIds.add(rigId);
      else selectedRigIds.delete(rigId);
      syncSelectAllState();
    });
  });

  requestAnimationFrame(drawAllSparklines);
  syncSelectAllState();
}

function syncSelectAllState() {
  const all = document.getElementById('rig-select-all');
  if (!all) return;
  const allIds = rigsCache.map(r => r.id);
  if (allIds.length === 0) {
    all.checked = false;
    all.indeterminate = false;
    return;
  }
  const selectedCount = allIds.filter(id => selectedRigIds.has(id)).length;
  all.checked = selectedCount === allIds.length;
  all.indeterminate = selectedCount > 0 && selectedCount < allIds.length;
}

function setupBatchControls() {
  document.getElementById('rig-search')?.addEventListener('input', () => renderRigsTable(rigsCache));

  const selectAll = document.getElementById('rig-select-all');
  if (selectAll) {
    selectAll.addEventListener('change', (e) => {
      if (e.target.checked) {
        rigsCache.forEach(r => selectedRigIds.add(r.id));
      } else {
        selectedRigIds.clear();
      }
      renderRigsTable(rigsCache);
    });
  }

  document.getElementById('btn-batch-start')?.addEventListener('click', () => runBatchAction('start'));
  document.getElementById('btn-batch-stop')?.addEventListener('click', () => runBatchAction('stop'));
  document.getElementById('btn-batch-restart')?.addEventListener('click', () => runBatchAction('restart'));
  document.getElementById('btn-apply-flightsheet')?.addEventListener('click', applyFlightSheetToSelection);
}

async function runBatchAction(action) {
  const rig_ids = [...selectedRigIds];
  if (rig_ids.length === 0) return alert('Select at least one rig');

  await apiFetch('/api/rigs/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rig_ids, action, params: {} }),
  });

  queueFetch();
}

async function applyFlightSheetToSelection() {
  const rig_ids = [...selectedRigIds];
  const flightSheetId = document.getElementById('batch-flightsheet-select')?.value || '';
  if (!flightSheetId) return alert('Select a flight sheet first');
  if (rig_ids.length === 0) return alert('Select at least one rig');

  await Promise.all(rig_ids.map(rigId =>
    apiFetch(`/api/rigs/${rigId}/apply-flightsheet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flight_sheet_id: flightSheetId }),
    })
  ));

  queueFetch();
}

async function rigCmd(rigId, action, params = {}) {
  try {
    const res = await apiFetch(`/api/rigs/${rigId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params }),
    });
    const data = await res.json();
    if (!data.ok) console.error('Action failed:', data.error);
    queueFetch();
  } catch (e) {
    console.error('Action error:', e);
  }
}

function openRigDetail(rigId) {
  const rig = rigsCache.find(r => r.id === rigId);
  if (!rig) return;

  setText('modal-rig-name', rig.name);
  const body = document.getElementById('modal-rig-body');
  if (!body) return;

  body.innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value"><span class="status-badge status-${rig.status}">${statusIcon(rig.status)} ${rig.status}</span></div></div>
      <div class="detail-item"><div class="detail-label">Worker</div><div class="detail-value mono">${esc(rig.worker)}</div></div>
      <div class="detail-item"><div class="detail-label">GPU</div><div class="detail-value">${esc(rig.gpu?.name || 'CPU')}</div></div>
      <div class="detail-item"><div class="detail-label">Hashrate</div><div class="detail-value" style="color:var(--gold)">${fmtHashrate(rig.stats.hashrate)}</div></div>
      <div class="detail-item"><div class="detail-label">Difficulty</div><div class="detail-value mono">${fmtNum(rig.stats.difficulty)}</div></div>
      <div class="detail-item"><div class="detail-label">Shares A/R</div><div class="detail-value"><span style="color:var(--emerald)">${fmtNum(rig.stats.accepted)}</span> / <span style="color:var(--red)">${fmtNum(rig.stats.rejected)}</span></div></div>
      <div class="detail-item"><div class="detail-label">Temp</div><div class="detail-value">${rig.gpu?.temp_c != null ? rig.gpu.temp_c.toFixed(1) + 'C' : '-'}</div></div>
      <div class="detail-item"><div class="detail-label">Power</div><div class="detail-value">${rig.gpu?.power_w != null ? rig.gpu.power_w.toFixed(0) + 'W' : '-'}</div></div>
      <div class="detail-item"><div class="detail-label">Pool</div><div class="detail-value mono">${esc(rig.pool_addr)}</div></div>
      <div class="detail-item"><div class="detail-label">Wallet</div><div class="detail-value mono" style="font-size:11px;word-break:break-all">${esc(rig.wallet)}</div></div>
      <div class="detail-item"><div class="detail-label">Uptime</div><div class="detail-value">${fmtDuration(rig.stats.uptime_s)}</div></div>
      <div class="detail-item"><div class="detail-label">Config</div><div class="detail-value mono">${rig.config.threads}T / ${rig.config.gpu_mode}</div></div>
    </div>
    <div class="detail-actions">
      <button class="btn-primary btn-sm" onclick="rigCmd('${esc(rig.id)}','start');closeModal()">Start</button>
      <button class="btn-sm" onclick="rigCmd('${esc(rig.id)}','stop');closeModal()">Stop</button>
      <button class="btn-sm" onclick="rigCmd('${esc(rig.id)}','restart');closeModal()">Restart</button>
      <button class="btn-sm" onclick="rigCmd('${esc(rig.id)}','reboot');closeModal()">Reboot</button>
      <button class="btn-danger" onclick="removeRig('${esc(rig.id)}');closeModal()">Remove</button>
    </div>
  `;

  document.getElementById('rig-detail-modal')?.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('rig-detail-modal')?.classList.add('hidden');
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) closeModal();
});

async function removeRig(rigId) {
  if (!confirm('Remove this rig from dashboard?')) return;
  await apiFetch(`/api/rigs/${rigId}`, { method: 'DELETE' });
  selectedRigIds.delete(rigId);
  queueFetch();
}

function setupConsole() {
  document.getElementById('btn-clear-console')?.addEventListener('click', () => {
    consoleLogs = [];
    renderConsole();
  });

  document.getElementById('btn-send-cmd')?.addEventListener('click', sendConsoleCmd);
  document.getElementById('console-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendConsoleCmd();
  });

  document.getElementById('console-rig-select')?.addEventListener('change', () => {
    renderConsole();
    connectConsoleWs();
  });
  document.getElementById('console-level-filter')?.addEventListener('change', renderConsole);
}

function updateConsoleRigSelect(rigs) {
  const sel = document.getElementById('console-rig-select');
  if (!sel) return;
  const current = sel.value;
  const opts = ['<option value="all">All Rigs</option>'];
  rigs.forEach(r => {
    opts.push(`<option value="${esc(r.id)}" ${r.id === current ? 'selected' : ''}>${esc(r.name)}</option>`);
  });
  sel.innerHTML = opts.join('');
}

function updateConsoleFromPolled(logs) {
  if (logs.length > consoleLogs.length) {
    const newEntries = logs.slice(consoleLogs.length);
    consoleLogs = logs;
    if (currentPanel === 'console') appendConsoleLines(newEntries);
  } else {
    consoleLogs = logs;
  }
}

function renderConsole() {
  const container = document.getElementById('console-output');
  if (!container) return;
  container.innerHTML = '';

  const rigFilter = document.getElementById('console-rig-select')?.value || 'all';
  const levelFilter = document.getElementById('console-level-filter')?.value || 'all';

  const filtered = consoleLogs.filter(l => {
    if (rigFilter !== 'all' && l.rig_id !== rigFilter) return false;
    if (levelFilter !== 'all' && l.level !== levelFilter) return false;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="console-welcome">ZionOS Console - Waiting for log data...</div>';
  } else {
    filtered.forEach(l => container.appendChild(createLogLine(l)));
  }

  autoScroll();
}

function appendConsoleLines(entries) {
  const container = document.getElementById('console-output');
  if (!container) return;
  container.querySelector('.console-welcome')?.remove();

  const rigFilter = document.getElementById('console-rig-select')?.value || 'all';
  const levelFilter = document.getElementById('console-level-filter')?.value || 'all';

  entries.forEach(l => {
    if (rigFilter !== 'all' && l.rig_id !== rigFilter) return;
    if (levelFilter !== 'all' && l.level !== levelFilter) return;
    container.appendChild(createLogLine(l));
  });

  autoScroll();
}

function createLogLine(entry) {
  const div = document.createElement('div');
  div.className = `console-line level-${entry.level}`;
  const ts = new Date(entry.timestamp * 1000).toLocaleTimeString('en-GB');
  div.innerHTML = `<span class="ts">${ts}</span><span class="rid">[${esc(entry.rig_id)}]</span><span class="lvl">[${entry.level.toUpperCase()}]</span> <span class="msg">${esc(entry.message)}</span>`;
  return div;
}

function autoScroll() {
  const enabled = document.getElementById('console-autoscroll')?.checked;
  if (!enabled) return;
  const container = document.getElementById('console-output');
  if (container) container.scrollTop = container.scrollHeight;
}

async function sendConsoleCmd() {
  const input = document.getElementById('console-input');
  if (!input) return;
  const cmd = input.value.trim();
  if (!cmd) return;
  input.value = '';

  const rigSelect = document.getElementById('console-rig-select');
  const rigId = rigSelect && rigSelect.value !== 'all' ? rigSelect.value : (rigsCache[0]?.id || 'unknown');

  await apiFetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rig_id: rigId, level: 'cmd', message: `$ ${cmd}` }),
  });

  const action = cmd.toLowerCase().split(/\s+/)[0];
  if (['start', 'stop', 'restart', 'reboot'].includes(action)) {
    await rigCmd(rigId, action);
  }

  queueFetch();
}

function connectConsoleWs() {
  const rigId = document.getElementById('console-rig-select')?.value || 'all';
  if (rigId === 'all') {
    if (consoleWs) {
      consoleWs.close();
      consoleWs = null;
    }
    return;
  }

  if (consoleWs) {
    consoleWs.close();
    consoleWs = null;
  }

  const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/console/${rigId}`;
  try {
    consoleWs = new WebSocket(wsUrl);
    consoleWs.onmessage = (e) => {
      try {
        const entry = JSON.parse(e.data);
        consoleLogs.push(entry);
        if (currentPanel === 'console') appendConsoleLines([entry]);
      } catch {}
    };
    consoleWs.onclose = () => { consoleWs = null; };
    consoleWs.onerror = () => { consoleWs = null; };
  } catch {}
}

function updatePoolPanel(pool) {
  if (!pool) return;
  setText('pool-hashrate', fmtHashrate(pool.hashrate));
  setText('pool-hashrate-windows', `1h: ${fmtHashrate(pool.hashrate_1h)} | 24h: ${fmtHashrate(pool.hashrate_24h)}`);
  setText('pool-valid', fmtNum(pool.valid_shares));
  setText('pool-invalid', `Invalid: ${fmtNum(pool.invalid_shares)}`);
  setText('pool-miners', String(pool.active_miners));
  setText('pool-total-miners', `Total: ${pool.total_miners}`);
  setText('pool-blocks', fmtNum(pool.blocks_found));
}

function updateFlightSheets(sheets) {
  flightSheets = sheets || [];

  const select = document.getElementById('batch-flightsheet-select');
  if (select) {
    const current = select.value;
    const opts = ['<option value="">Apply Flight Sheet...</option>'];
    flightSheets.forEach(fs => opts.push(`<option value="${esc(fs.id)}" ${fs.id === current ? 'selected' : ''}>${esc(fs.name)}</option>`));
    select.innerHTML = opts.join('');
  }

  const list = document.getElementById('flightsheet-list');
  if (!list) return;

  if (flightSheets.length === 0) {
    list.innerHTML = '<div style="padding:16px;color:var(--text-dim)">No flight sheets yet.</div>';
    return;
  }

  list.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Name</th><th>Pool</th><th>Mode</th><th>Threads</th><th>Args</th><th>Actions</th></tr></thead>
      <tbody>
        ${flightSheets.map(fs => `
          <tr>
            <td><strong>${esc(fs.name)}</strong><br/><span style="font-size:11px;color:var(--text-dim)">${esc(fs.coin)} / ${esc(fs.algo)}</span></td>
            <td>${esc(fs.pool_addr)}</td>
            <td>${esc(fs.gpu_mode)}</td>
            <td>${fmtNum(fs.threads)}</td>
            <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis">${esc(fs.miner_args || '-')}</td>
            <td><button class="btn-danger" onclick="deleteFlightSheet('${esc(fs.id)}')">Delete</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function createFlightSheet() {
  const name = document.getElementById('fs-name')?.value.trim();
  const gpu_mode = document.getElementById('fs-gpu-mode')?.value || 'cpu';
  const threads = Number(document.getElementById('fs-threads')?.value || 0);
  const miner_args = document.getElementById('fs-args')?.value.trim() || '';
  const pool_addr = document.getElementById('fs-pool')?.value.trim() || '91.98.122.165:3333';
  const wallet = document.getElementById('setting-wallet')?.value || '';

  if (!name) return alert('Flight sheet name is required');

  const id = 'fs-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const body = {
    id,
    name,
    coin: 'ZION',
    algo: 'Ekam Deeksha v2',
    pool_addr,
    wallet,
    miner_args,
    gpu_mode,
    threads,
    intensity: null,
    created_at: 0,
  };

  const res = await apiFetch('/api/flightsheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) return alert(data.error || 'Failed to create flight sheet');

  document.getElementById('fs-name').value = '';
  document.getElementById('fs-args').value = '';
  queueFetch();
}

async function deleteFlightSheet(id) {
  if (!confirm('Delete this flight sheet?')) return;
  await apiFetch(`/api/flightsheets/${id}`, { method: 'DELETE' });
  queueFetch();
}

function updateWalletPanel(earnings) {
  if (!earnings) return;
  setText('wallet-daily', `${earnings.daily_coins.toFixed(4)} ZION`);
  setText('wallet-weekly', `${earnings.weekly_coins.toFixed(4)} ZION`);
  setText('wallet-monthly', `${earnings.monthly_coins.toFixed(4)} ZION`);
  setText('wallet-net-hr', fmtHashrate(earnings.net_hashrate_est));
  setText('wallet-your-hr', fmtHashrate(earnings.hashrate));
  setText('wallet-diff', fmtNum(earnings.difficulty));
  setText('wallet-reward', `${earnings.block_reward} ZION`);
  setText('wallet-blocktime', `${earnings.block_time_s}s`);
}

function setupSettings() {
  document.getElementById('btn-save-settings')?.addEventListener('click', saveSettings);
  document.getElementById('btn-register-rig')?.addEventListener('click', registerNewRig);
  document.getElementById('btn-add-rig')?.addEventListener('click', () => showPanel('settings'));
  document.getElementById('btn-create-fs')?.addEventListener('click', createFlightSheet);

  document.getElementById('setting-theme')?.addEventListener('change', (e) => {
    applyTheme(e.target.value);
  });

  const savedApi = getSetting('api-url');
  if (savedApi && document.getElementById('setting-api-url')) {
    document.getElementById('setting-api-url').value = savedApi;
  }

  const savedToken = getSetting('api-token');
  if (savedToken && document.getElementById('setting-api-token')) {
    document.getElementById('setting-api-token').value = savedToken;
  }

  if (document.getElementById('setting-api-url')) {
    document.getElementById('setting-api-url').placeholder = API;
  }
}

function saveSettings() {
  localStorage.setItem('zionos-pool-url', document.getElementById('setting-pool-url')?.value || '');
  localStorage.setItem('zionos-api-url', document.getElementById('setting-api-url')?.value || '');
  localStorage.setItem('zionos-api-token', document.getElementById('setting-api-token')?.value || '');
  localStorage.setItem('zionos-wallet', document.getElementById('setting-wallet')?.value || '');
  localStorage.setItem('zionos-refresh', document.getElementById('setting-refresh')?.value || '5');
  localStorage.setItem('zionos-theme', document.getElementById('setting-theme')?.value || 'cosmic');

  clearInterval(refreshTimer);
  startPolling();

  const btn = document.getElementById('btn-save-settings');
  if (btn) {
    const old = btn.textContent;
    btn.textContent = 'Saved';
    setTimeout(() => { btn.textContent = old; }, 1200);
  }
}

function loadSettings() {
  const theme = localStorage.getItem('zionos-theme') || 'cosmic';
  applyTheme(theme);
  if (document.getElementById('setting-theme')) document.getElementById('setting-theme').value = theme;

  const refresh = localStorage.getItem('zionos-refresh');
  if (refresh && document.getElementById('setting-refresh')) document.getElementById('setting-refresh').value = refresh;
}

function getSetting(key) {
  return localStorage.getItem('zionos-' + key);
}

function applyTheme(theme) {
  document.body.className = '';
  if (theme !== 'cosmic') document.body.classList.add('theme-' + theme);
}

async function registerNewRig() {
  const name = document.getElementById('new-rig-name')?.value.trim();
  const worker = document.getElementById('new-rig-worker')?.value.trim();
  const gpu = document.getElementById('new-rig-gpu')?.value.trim();
  const gpuMode = document.getElementById('new-rig-gpu-mode')?.value || 'cpu';
  const pool = document.getElementById('new-rig-pool')?.value.trim();
  const wallet = document.getElementById('setting-wallet')?.value || '';

  if (!name || !worker) return alert('Name and worker are required');

  const rig = {
    id: 'rig-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    name,
    wallet,
    worker,
    pool_addr: pool || '91.98.122.165:3333',
    status: 'stopped',
    gpu: gpu ? {
      name: gpu,
      vendor: gpu.includes('AMD') ? 'AMD' : (gpu.includes('NVIDIA') ? 'NVIDIA' : 'Unknown'),
      vram_mb: 0,
      driver: '',
      temp_c: null,
      power_w: null,
      fan_pct: null,
      core_mhz: null,
      mem_mhz: null,
    } : null,
    stats: {
      hashrate: 0,
      hashrate_1h: 0,
      hashrate_24h: 0,
      accepted: 0,
      rejected: 0,
      stale: 0,
      uptime_s: 0,
      difficulty: 0,
      last_share_time: null,
      total_hashes: 0,
    },
    config: { threads: 4, gpu_mode: gpuMode, intensity: null },
    last_seen: 0,
  };

  const res = await apiFetch('/api/rigs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rig),
  });
  const data = await res.json();
  if (!data.ok) return alert(data.error || 'Failed to register rig');

  document.getElementById('new-rig-name').value = '';
  document.getElementById('new-rig-worker').value = '';
  document.getElementById('new-rig-gpu').value = '';
  showPanel('rigs');
  queueFetch();
}

function drawHashrateChart() {
  const canvas = document.getElementById('hashrate-chart');
  if (!canvas || !canvas.parentElement) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = rect.width * dpr;
  canvas.height = 200 * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = '200px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const W = rect.width;
  const H = 200;
  const pad = { top: 20, right: 16, bottom: 30, left: 60 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  ctx.clearRect(0, 0, W, H);

  if (hashrateHistory.length < 2) {
    ctx.fillStyle = '#888';
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Collecting hashrate data...', W / 2, H / 2);
    return;
  }

  const maxVal = Math.max(...hashrateHistory.map(p => Math.max(p.v, p.p)), 1);
  const yScale = chartH / (maxVal * 1.15);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();

    const val = maxVal * 1.15 * (1 - i / 4);
    ctx.fillStyle = '#888';
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(fmtHashrate(val), pad.left - 8, y + 4);
  }

  drawLineSeries(ctx, hashrateHistory, 'p', 'rgb(147, 51, 234)', 0.10, pad, chartW, chartH, yScale);
  drawLineSeries(ctx, hashrateHistory, 'v', 'rgb(255, 215, 0)', 0.15, pad, chartW, chartH, yScale);

  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'left';

  ctx.fillStyle = 'rgb(255, 215, 0)';
  ctx.fillRect(pad.left, H - 14, 12, 3);
  ctx.fillStyle = '#aaa';
  ctx.fillText('Rigs', pad.left + 16, H - 10);

  ctx.fillStyle = 'rgb(147, 51, 234)';
  ctx.fillRect(pad.left + 60, H - 14, 12, 3);
  ctx.fillStyle = '#aaa';
  ctx.fillText('Pool', pad.left + 76, H - 10);
}

function drawLineSeries(ctx, data, key, color, alpha, pad, chartW, chartH, yScale) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';

  data.forEach((pt, i) => {
    const x = pad.left + (i / (data.length - 1)) * chartW;
    const y = pad.top + chartH - pt[key] * yScale;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
  gradient.addColorStop(0, color.replace('rgb(', 'rgba(').replace(')', `,${alpha})`));
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.lineTo(pad.left + chartW, pad.top + chartH);
  ctx.lineTo(pad.left, pad.top + chartH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
}

window.addEventListener('resize', drawHashrateChart);

function drawAllSparklines() {
  document.querySelectorAll('.sparkline-canvas').forEach(canvas => {
    const rigId = canvas.dataset.rig;
    drawSparkline(canvas, rigSparklines[rigId] || []);
  });
}

function drawSparkline(canvas, data) {
  const dpr = window.devicePixelRatio || 1;
  const w = 80;
  const h = 24;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (data.length < 2) {
    ctx.fillStyle = '#333';
    ctx.fillRect(0, h / 2, w, 1);
    return;
  }

  const max = Math.max(...data, 1);
  const step = w / (data.length - 1);

  ctx.beginPath();
  data.forEach((v, i) => {
    const x = i * step;
    const y = h - (v / max) * (h - 4) - 2;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255,215,0,0.2)');
  grad.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  data.forEach((v, i) => {
    const x = i * step;
    const y = h - (v / max) * (h - 4) - 2;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function renderGpuMonitor(rigs) {
  const grid = document.getElementById('gpu-monitor-grid');
  if (!grid) return;

  const rigsWithGpu = rigs.filter(r => r.gpu && r.gpu.name);
  if (rigsWithGpu.length === 0) {
    grid.innerHTML = '<div style="padding:20px;color:var(--text-dim);text-align:center">No GPUs detected</div>';
    return;
  }

  grid.innerHTML = rigsWithGpu.map(r => {
    const g = r.gpu;
    const tempPct = g.temp_c != null ? Math.min(g.temp_c / 110, 1) : 0;
    const powerPct = g.power_w != null ? Math.min(g.power_w / 300, 1) : 0;
    const fanPct = g.fan_pct != null ? g.fan_pct / 100 : 0;
    const tempColor = g.temp_c > 85 ? 'var(--red)' : (g.temp_c > 70 ? 'var(--orange)' : 'var(--emerald)');
    const c = 2 * Math.PI * 24;

    return `
      <div class="gpu-card">
        <div class="gpu-card-header">
          <span class="gpu-card-name">${esc(g.name)}</span>
          <span class="gpu-card-rig">${esc(r.name)}</span>
        </div>
        <div class="gpu-gauges">
          <div class="gauge">
            <div class="gauge-ring"><svg viewBox="0 0 56 56"><circle class="gauge-bg" cx="28" cy="28" r="24"/><circle class="gauge-fill" cx="28" cy="28" r="24" stroke="${tempColor}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - tempPct)}"/></svg><div class="gauge-value">${g.temp_c != null ? g.temp_c.toFixed(0) + 'C' : '-'}</div></div>
            <span class="gauge-label">Temp</span>
          </div>
          <div class="gauge">
            <div class="gauge-ring"><svg viewBox="0 0 56 56"><circle class="gauge-bg" cx="28" cy="28" r="24"/><circle class="gauge-fill" cx="28" cy="28" r="24" stroke="var(--purple)" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - powerPct)}"/></svg><div class="gauge-value">${g.power_w != null ? g.power_w.toFixed(0) + 'W' : '-'}</div></div>
            <span class="gauge-label">Power</span>
          </div>
          <div class="gauge">
            <div class="gauge-ring"><svg viewBox="0 0 56 56"><circle class="gauge-bg" cx="28" cy="28" r="24"/><circle class="gauge-fill" cx="28" cy="28" r="24" stroke="var(--cyan)" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - fanPct)}"/></svg><div class="gauge-value">${g.fan_pct != null ? g.fan_pct + '%' : '-'}</div></div>
            <span class="gauge-label">Fan</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function updateShareTimeline(events) {
  shareEvents = events || [];
  const container = document.getElementById('share-timeline');
  if (!container) return;

  container.innerHTML = '<span class="share-timeline-label">Share Timeline</span>';
  if (shareEvents.length === 0) return;

  const recent = shareEvents.slice(-200);
  const minT = recent[0].timestamp;
  const maxT = recent[recent.length - 1].timestamp;
  const range = Math.max(maxT - minT, 1);

  recent.forEach(ev => {
    const dot = document.createElement('div');
    dot.className = `share-dot ${ev.kind}`;
    const pct = ((ev.timestamp - minT) / range) * 95 + 2.5;
    dot.style.left = pct + '%';
    dot.style.top = '50%';
    dot.title = `${ev.kind} - ${ev.rig_id} - ${fmtHashrate(ev.hashrate_at)}`;
    container.appendChild(dot);
  });
}

function updateAlerts(newAlerts) {
  alerts = newAlerts || [];
  const countEl = document.getElementById('alert-count');
  if (countEl) {
    if (alerts.length > 0) {
      countEl.textContent = String(alerts.length);
      countEl.classList.remove('hidden');
    } else {
      countEl.classList.add('hidden');
    }
  }

  const list = document.getElementById('alert-list');
  if (!list) return;

  if (alerts.length === 0) {
    list.innerHTML = '<div class="alert-empty">No alerts - all clear</div>';
    return;
  }

  list.innerHTML = alerts.slice(-20).reverse().map(a => `
    <div class="alert-item">
      <div class="alert-icon ${a.level}">${a.level === 'critical' ? '!' : (a.level === 'warning' ? '!' : 'i')}</div>
      <div class="alert-content">
        <div class="alert-title">${esc(a.title)}</div>
        <div class="alert-msg">${esc(a.message)}</div>
        <div class="alert-time">${new Date(a.timestamp * 1000).toLocaleTimeString('en-GB')}</div>
      </div>
      <button class="alert-dismiss" onclick="dismissAlert(${a.id})">x</button>
    </div>
  `).join('');
}

function toggleAlerts() {
  document.getElementById('alert-dropdown')?.classList.toggle('hidden');
}

async function dismissAlert(id) {
  await apiFetch(`/api/alerts/${id}/dismiss`, { method: 'POST' });
  queueFetch();
}

document.addEventListener('click', (e) => {
  const bell = document.getElementById('alert-bell');
  const dropdown = document.getElementById('alert-dropdown');
  if (bell && !bell.contains(e.target)) {
    dropdown?.classList.add('hidden');
  }
});

function startClock() {
  function tick() {
    setText('clock', new Date().toLocaleTimeString('en-GB'));
  }
  tick();
  setInterval(tick, 1000);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function fmtHashrate(h) {
  if (h == null || h === 0) return '0 H/s';
  if (h >= 1e12) return (h / 1e12).toFixed(2) + ' TH/s';
  if (h >= 1e9) return (h / 1e9).toFixed(2) + ' GH/s';
  if (h >= 1e6) return (h / 1e6).toFixed(2) + ' MH/s';
  if (h >= 1e3) return (h / 1e3).toFixed(2) + ' kH/s';
  return h.toFixed(1) + ' H/s';
}

function fmtNum(n) {
  if (n == null) return '-';
  return Number(n).toLocaleString('en-US');
}

function fmtDuration(s) {
  if (!s || s === 0) return '-';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function statusIcon(status) {
  return { mining: '*', online: 'o', offline: 'x', stopped: '-', error: '!' }[status] || '?';
}

function esc(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

// ═══════════════════════════════════════════════════════════
// INFRA PANEL
// ═══════════════════════════════════════════════════════════

function updateInfraPanel(infra) {
  const services = ['node', 'pool', 'dao', 'warp', 'agent', 'website'];
  services.forEach(svc => {
    const st = infra[svc];
    if (!st) return;
    const statusEl = document.getElementById('infra-' + svc + '-status');
    const detailEl = document.getElementById('infra-' + svc + '-detail');
    const cardEl = document.getElementById('infra-' + svc + '-card');
    if (statusEl) statusEl.textContent = st.reachable ? 'ONLINE' : 'OFFLINE';
    if (detailEl) {
      if (svc === 'agent' && st.data) {
        detailEl.textContent = 'Mode: ' + (st.data.mode || '—') + ' | GPUs: ' + (st.data.gpu_count ?? '—');
      } else if (svc === 'pool' && st.data) {
        const hr = st.data.hashrate?.pool || 0;
        detailEl.textContent = 'Hash: ' + fmtHashrate(hr) + ' | Miners: ' + (st.data.miners?.active || 0);
      } else {
        detailEl.textContent = st.latency_ms ? st.latency_ms + ' ms' : '—';
      }
    }
    if (cardEl) {
      cardEl.classList.toggle('kpi-green', st.reachable);
      cardEl.classList.toggle('kpi-red', !st.reachable);
    }
  });

  // Latency table
  const tbody = document.getElementById('infra-latency-tbody');
  if (tbody) {
    tbody.innerHTML = services.map(svc => {
      const st = infra[svc];
      if (!st) return '';
      const statusClass = st.reachable ? 'status-online' : 'status-offline';
      const statusText = st.reachable ? 'Online' : 'Offline';
      return '<tr>' +
        '<td>' + esc(st.name) + '</td>' +
        '<td><code>' + esc(st.url) + '</code></td>' +
        '<td><span class="' + statusClass + '">' + statusText + '</span></td>' +
        '<td>' + (st.latency_ms || '—') + ' ms</td>' +
        '<td><button class="btn-sm" onclick="location.href=\'' + esc(st.url) + '\'">Open</button></td>' +
      '</tr>';
    }).join('');
  }
}

async function agentMinerAction(action) {
  const resultEl = document.getElementById('agent-action-result');
  if (resultEl) resultEl.textContent = 'Sending ' + action + '…';
  try {
    const resp = await fetch(API + '/api/agent/miner/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await resp.json();
    if (resultEl) resultEl.textContent = data.ok ? 'OK: ' + action + ' sent' : 'Error: ' + (data.error || 'unknown');
    queueFetch();
  } catch (e) {
    if (resultEl) resultEl.textContent = 'Error: ' + e.message;
  }
}

window.showPanel = showPanel;
window.openRigDetail = openRigDetail;
window.closeModal = closeModal;
window.rigCmd = rigCmd;
window.removeRig = removeRig;
window.toggleAlerts = toggleAlerts;
window.dismissAlert = dismissAlert;
window.deleteFlightSheet = deleteFlightSheet;
window.agentMinerAction = agentMinerAction;
