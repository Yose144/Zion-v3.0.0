// V31 Mainnet Alpha dashboard — v3.1.0-beta
// Updated 2026-08-03: systemd + journald based, live sync metrics

async function api(path, opts={}) {
  const r = await fetch(path, { ...opts, credentials: 'same-origin' });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

function dot(cls) { return `<span class="status-dot ${cls}"></span>`; }
function fmtTime() { return new Date().toLocaleTimeString(); }

function showError(msg) {
  const el = document.getElementById('error-box');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function clearError() { document.getElementById('error-box').classList.add('hidden'); }

function shortHash(h) {
  if (!h) return '—';
  return h.length > 20 ? h.slice(0, 12) + '…' + h.slice(-8) : h;
}

function setBanner(st) {
  const fmt = (n, d=0) => (n == null || n === '' || n === undefined) ? '—' : Number(n).toLocaleString(undefined, {minimumFractionDigits:d, maximumFractionDigits:d});
  const el = id => document.getElementById(id);

  if (el('banner-version')) el('banner-version').textContent = st.version || '3.1.0-beta';

  if (el('banner-network')) {
    const ok = st.node_running && st.node_reachable;
    el('banner-network').textContent = ok ? 'mainnet' : 'offline';
    el('banner-network').className = 'badge ' + (ok ? 'badge-green' : 'badge-red');
  }

  if (el('banner-height')) {
    el('banner-height').textContent = fmt(st.height);
  }

  const lag = st.sync_lag ?? 0;
  if (el('banner-sync-lag')) {
    el('banner-sync-lag').textContent = lag === 0 ? 'synced' : lag;
    el('banner-sync-lag').style.color = lag === 0 ? 'rgb(7 137 48)' : 'rgb(252 209 22)';
  }

  if (el('banner-pool-hashrate')) {
    const hr = st.pool_hashrate_hps;
    if (hr != null && hr >= 1e6) {
      el('banner-pool-hashrate').textContent = (hr / 1e6).toFixed(2) + ' MH/s';
      if (el('banner-pool-hashrate-sub')) el('banner-pool-hashrate-sub').textContent = Number(hr).toLocaleString() + ' H/s';
    } else if (hr != null && hr >= 1e3) {
      el('banner-pool-hashrate').textContent = (hr / 1e3).toFixed(2) + ' kH/s';
      if (el('banner-pool-hashrate-sub')) el('banner-pool-hashrate-sub').textContent = Number(hr).toLocaleString() + ' H/s';
    } else {
      el('banner-pool-hashrate').textContent = fmt(hr);
      if (el('banner-pool-hashrate-sub')) el('banner-pool-hashrate-sub').textContent = 'H/s';
    }
  }

  if (el('banner-shares-sec')) el('banner-shares-sec').textContent = fmt(st.shares_per_sec, 2);

  if (el('banner-multichain-health')) {
    const mcOk = st.multichain_ok;
    const total = st.multichain_transfers_total ?? 0;
    const pending = st.multichain_transfers_pending ?? 0;
    el('banner-multichain-health').innerHTML = (mcOk ? dot('status-up') : dot('status-down')) + (mcOk ? 'OK' : 'FAIL');
    el('banner-multichain-health').style.color = mcOk ? 'rgb(7 137 48)' : 'rgb(228 30 43)';
    if (el('banner-multichain-health-sub')) el('banner-multichain-health-sub').textContent = `total ${Number(total).toLocaleString()} · pending ${Number(pending).toLocaleString()}`;
  }

  if (el('banner-dao-proposals')) {
    const active = st.dao_proposals_active ?? 0;
    const total = st.dao_proposals_total ?? 0;
    el('banner-dao-proposals').textContent = `${Number(active).toLocaleString()} / ${Number(total).toLocaleString()}`;
  }
}

function setKpis(st) {
  // Node status
  const nodeEl = document.getElementById('kpi-node');
  const nodeSub = document.getElementById('kpi-node-sub');
  if (st.node_running && st.node_reachable) {
    nodeEl.innerHTML = `${dot('status-up')} Online`;
    nodeSub.textContent = `PID ${st.node_pid ?? '—'}`;
  } else if (st.node_running) {
    nodeEl.innerHTML = `${dot('status-warn')} Starting`;
    nodeSub.textContent = `PID ${st.node_pid ?? '—'}`;
  } else {
    nodeEl.innerHTML = `${dot('status-down')} Offline`;
    nodeSub.textContent = '—';
  }

  // systemd status
  const sysEl = document.getElementById('kpi-systemd');
  const sysSub = document.getElementById('kpi-systemd-sub');
  const active = st.systemd_active || 'unknown';
  if (active === 'active') {
    sysEl.innerHTML = `<span class="badge badge-green">active</span>`;
    sysSub.textContent = `${st.systemd_sub || 'running'} · ${st.systemd_enabled || 'enabled'}`;
  } else if (active === 'inactive' || active === 'failed') {
    sysEl.innerHTML = `<span class="badge badge-red">${active}</span>`;
    sysSub.textContent = st.systemd_sub || '—';
  } else {
    sysEl.innerHTML = `<span class="badge badge-yellow">${active}</span>`;
    sysSub.textContent = st.systemd_sub || '—';
  }

  // DB height
  document.getElementById('kpi-db-height').textContent = st.db_height ?? '—';
  document.getElementById('kpi-db-height-sub').textContent = st.db_tip_hash ? shortHash(st.db_tip_hash) : '—';

  // V3 reference height
  document.getElementById('kpi-v3-height').textContent = st.v3_height ?? '—';
  document.getElementById('kpi-v3-height-sub').textContent = st.sync_mode ?? '—';

  // Tip hash
  document.getElementById('kpi-tip-hash').textContent = st.tip_hash ? shortHash(st.tip_hash) : (st.db_tip_hash ? shortHash(st.db_tip_hash) : '—');
  document.getElementById('kpi-tip-hash-sub').textContent = st.tip_hash ? 'RPC' : (st.db_tip_hash ? 'DB' : '—');

  // Mempool
  const mempool = (st.mempool_account ?? 0) + (st.mempool_utxo ?? 0);
  document.getElementById('kpi-mempool').textContent = mempool;
  document.getElementById('kpi-mempool-sub').textContent = `account: ${st.mempool_account ?? 0}, utxo: ${st.mempool_utxo ?? 0}`;

  // Difficulty
  document.getElementById('kpi-difficulty').textContent = st.difficulty ? st.difficulty.toLocaleString() : '—';
  document.getElementById('kpi-difficulty-sub').textContent = 'next block';

  // Memory
  document.getElementById('kpi-memory').textContent = st.memory_mb != null ? st.memory_mb + ' MB' : '—';
  document.getElementById('kpi-memory-sub').textContent = st.start_timestamp ? 'since ' + st.start_timestamp.split(' ')[0] : '—';

  // Sync progress bar
  const v31h = st.db_height ?? 0;
  const v3h = st.v3_height ?? 0;
  const pct = v3h > 0 ? Math.min(100, Math.round((v31h / v3h) * 100)) : 0;
  document.getElementById('sync-bar-fill').style.width = pct + '%';
  document.getElementById('sync-v31-height').textContent = v31h;
  document.getElementById('sync-v3-height').textContent = v3h;

  const lag = st.sync_lag ?? 0;
  const lagBadge = document.getElementById('sync-lag-badge');
  if (lag === 0) {
    lagBadge.className = 'badge badge-green';
    lagBadge.textContent = 'SYNCED';
  } else if (lag <= 3) {
    lagBadge.className = 'badge badge-yellow';
    lagBadge.textContent = `lag: ${lag}`;
  } else {
    lagBadge.className = 'badge badge-red';
    lagBadge.textContent = `lag: ${lag}`;
  }

  document.getElementById('last-update').textContent = `Poslední update: ${fmtTime()}`;
}

async function refreshStatus() {
  try {
    const st = await api('/api/v31/status');
    if (!st.ok) throw new Error(st.error || 'status failed');
    setKpis(st);
    setBanner(st);
    clearError();
  } catch (e) {
    showError(`Refresh error: ${e.message}`);
  }
}

async function refreshLogs() {
  const svcs = [['node', 'node-log', 'overview-node-log'], ['pool', 'pool-log', 'overview-pool-log']];
  for (const [svc, id1, id2] of svcs) {
    try {
      const r = await api(`/api/v31/logs?svc=${svc}&lines=80`);
      const text = r.ok ? r.lines.join('\n') : (r.error || 'No log yet.');
      document.getElementById(id1).textContent = text;
      if (id2) document.getElementById(id2).textContent = text;
    } catch (e) {
      document.getElementById(id1).textContent = 'Log unavailable.';
      if (id2) document.getElementById(id2).textContent = 'Log unavailable.';
    }
  }
}

async function refreshSyncInfo() {
  try {
    const r = await api('/api/v31/sync-info');
    document.getElementById('sync-v3-state').textContent = r.v3_state_height ?? '—';
    document.getElementById('sync-v31-db').textContent = r.v31_db_height ?? '—';
    document.getElementById('sync-lag').textContent = r.sync_lag != null ? r.sync_lag + ' blocks' : '—';
    document.getElementById('sync-checkpoint').textContent = r.checkpoint_exists ? 'exists' : 'missing';

    const lastAction = document.getElementById('sync-last-action');
    if (r.last_sync) {
      lastAction.innerHTML = `
        <strong>Poslední sync:</strong> ${r.last_sync.time} ·
        <strong>Režim:</strong> ${r.last_sync.mode} ·
        <strong>Výsledek:</strong> ${r.last_sync.status}
        ${r.last_sync.detail ? ` · <strong>Detail:</strong> ${r.last_sync.detail}` : ''}
      `;
    } else {
      lastAction.textContent = 'Žádná sync akce dosud neproběhla.';
    }

    const sl = document.getElementById('sync-log');
    if (r.log) sl.textContent = r.log;
  } catch (e) {
    // ignore
  }
}

async function control(action) {
  const btnMap = { start: 'btn-start', stop: 'btn-stop', restart: 'btn-restart' };
  const btn = document.getElementById(btnMap[action]);
  if (btn) btn.disabled = true;
  try {
    const r = await api('/api/v31/control', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action})
    });
    if (!r.ok) throw new Error(r.error || `${action} failed`);
    const statusEl = document.getElementById('control-status');
    statusEl.textContent = `${action.toUpperCase()} OK — systemd: ${r.status?.systemd_active || '?'}`;
    statusEl.classList.remove('hidden');
    setTimeout(() => statusEl.classList.add('hidden'), 5000);
  } catch (e) {
    showError(`${action} error: ${e.message}`);
  } finally {
    if (btn) btn.disabled = false;
    setTimeout(refreshAll, 2000);
  }
}

async function syncV3State() {
  const btn = document.getElementById('btn-sync-state');
  btn.disabled = true;
  try {
    const r = await api('/api/v31/sync', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({mode: 'state'})
    });
    if (!r.ok) throw new Error(r.error || 'sync failed');
    showError(`Sync state: ${r.message}`);
  } catch (e) {
    showError(`Sync error: ${e.message}`);
  } finally {
    btn.disabled = false;
    setTimeout(refreshAll, 1000);
  }
}

async function syncV3P2P() {
  const peers = document.getElementById('v3-peers').value.split(',').map(s => s.trim()).filter(Boolean);
  if (!peers.length) { showError('Zadej alespoň jeden V3 peer.'); return; }
  const btn = document.getElementById('btn-sync-p2p');
  btn.disabled = true;
  try {
    const r = await api('/api/v31/sync', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({mode: 'p2p', peers})
    });
    if (!r.ok) throw new Error(r.error || 'p2p sync failed');
    showError(`P2P sync: ${r.message}`);
  } catch (e) {
    showError(`P2P sync error: ${e.message}`);
  } finally {
    btn.disabled = false;
    setTimeout(refreshAll, 1000);
  }
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('hidden', p.id !== 'tab-' + name));
  if (name === 'sync') refreshSyncInfo();
  if (name === 'logs') refreshLogs();
}

async function refreshAll() {
  await refreshStatus();
  await refreshLogs();
  const visible = document.querySelector('.tab-pane:not(.hidden)');
  if (visible && visible.id === 'tab-sync') await refreshSyncInfo();
}

document.getElementById('btn-start').addEventListener('click', () => control('start'));
document.getElementById('btn-stop').addEventListener('click', () => control('stop'));
document.getElementById('btn-restart').addEventListener('click', () => control('restart'));
document.getElementById('btn-refresh').addEventListener('click', refreshAll);
document.getElementById('btn-sync-state').addEventListener('click', syncV3State);
document.getElementById('btn-sync-p2p').addEventListener('click', syncV3P2P);

document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => switchTab(t.dataset.tab));
});

refreshAll();
setInterval(refreshAll, 5000);
