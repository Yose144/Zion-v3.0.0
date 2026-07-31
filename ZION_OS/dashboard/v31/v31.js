async function api(path, opts={}) {
  const r = await fetch(path, { ...opts, credentials: 'same-origin' });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

function dot(cls) {
  return `<span class="status-dot ${cls}"></span>`;
}

function fmtTime() {
  return new Date().toLocaleTimeString();
}

function showError(msg) {
  const el = document.getElementById('error-box');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function clearError() {
  document.getElementById('error-box').classList.add('hidden');
}

function setKpis(st) {
  const nodeEl = document.getElementById('kpi-node');
  const poolEl = document.getElementById('kpi-pool');
  const nodeSub = document.getElementById('kpi-node-sub');
  const poolSub = document.getElementById('kpi-pool-sub');

  if (st.node_running && st.node_reachable) {
    nodeEl.innerHTML = `${dot('status-up')} Online`;
    nodeSub.textContent = `PID ${st.node_pid}`;
  } else if (st.node_running) {
    nodeEl.innerHTML = `${dot('status-warn')} Starting`;
    nodeSub.textContent = `PID ${st.node_pid}`;
  } else {
    nodeEl.innerHTML = `${dot('status-down')} Offline`;
    nodeSub.textContent = '—';
  }

  if (st.pool_running && st.pool_reachable) {
    poolEl.innerHTML = `${dot('status-up')} Online`;
    poolSub.textContent = `PID ${st.pool_pid}`;
  } else if (st.pool_running) {
    poolEl.innerHTML = `${dot('status-warn')} Starting`;
    poolSub.textContent = `PID ${st.pool_pid}`;
  } else {
    poolEl.innerHTML = `${dot('status-down')} Offline`;
    poolSub.textContent = '—';
  }

  document.getElementById('kpi-canonical').textContent = st.canonical_height ?? '—';
  document.getElementById('kpi-canonical-sub').textContent = st.tip_hash ? st.tip_hash.slice(0, 16) + '…' : '—';
  document.getElementById('kpi-v3').textContent = st.v3_height ?? '—';
  document.getElementById('kpi-v3-sub').textContent = st.tip_hash ? 'tip: ' + st.tip_hash.slice(0, 16) + '…' : '—';
  document.getElementById('kpi-mempool').textContent = (st.mempool_account ?? 0) + (st.mempool_utxo ?? 0);
  document.getElementById('kpi-mempool-sub').textContent = `account: ${st.mempool_account ?? 0}, utxo: ${st.mempool_utxo ?? 0}`;
  document.getElementById('kpi-difficulty').textContent = st.difficulty ?? '—';
  document.getElementById('kpi-difficulty-sub').textContent = 'next block diff';
  document.getElementById('kpi-target').textContent = st.target ? st.target.slice(0, 20) + '…' : '—';
  document.getElementById('kpi-target-sub').textContent = 'PoW target';
  document.getElementById('kpi-sync-mode').textContent = st.sync_mode ?? 'genesis';
  document.getElementById('kpi-sync-mode-sub').textContent = st.v3_height && st.v3_height > 0 ? `V3 checkpoint @ ${st.v3_height}` : 'start sync for V3 state';
  document.getElementById('last-update').textContent = `Poslední update: ${fmtTime()}`;
}

async function refreshStatus() {
  try {
    const st = await api('/api/v31/status');
    if (!st.ok) throw new Error(st.error || 'status failed');
    setKpis(st);
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
    document.getElementById('v3-source-info').textContent = `V3 state: height ${r.v3_state_height ?? '—'}, file ${r.v3_state_path ?? '—'}`;
    const syncInfo = document.getElementById('sync-info');
    if (r.last_sync) {
      syncInfo.innerHTML = `
        <p><strong>Poslední sync:</strong> ${r.last_sync.time}</p>
        <p><strong>Režim:</strong> ${r.last_sync.mode}</p>
        <p><strong>Výsledek:</strong> ${r.last_sync.status}</p>
        ${r.last_sync.detail ? `<p><strong>Detail:</strong> ${r.last_sync.detail}</p>` : ''}
      `;
    } else {
      syncInfo.innerHTML = '<p>Žádná sync akce dosud neproběhla.</p>';
    }
    const sl = document.getElementById('sync-log');
    if (r.log) sl.textContent = r.log;
  } catch (e) {
    // ignore
  }
}

async function control(action) {
  const btn = action === 'start' ? document.getElementById('btn-start') : document.getElementById('btn-stop');
  btn.disabled = true;
  try {
    const r = await api('/api/v31/control', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action})
    });
    if (!r.ok) throw new Error(r.error || `${action} failed`);
    const statusEl = document.getElementById('control-status');
    statusEl.textContent = `${action.toUpperCase()} OK — node=${r.status.node_running}, pool=${r.status.pool_running}`;
    statusEl.classList.remove('hidden');
    setTimeout(() => statusEl.classList.add('hidden'), 5000);
  } catch (e) {
    showError(`${action} error: ${e.message}`);
  } finally {
    btn.disabled = false;
    setTimeout(refreshAll, 1500);
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
document.getElementById('btn-refresh').addEventListener('click', refreshAll);
document.getElementById('btn-sync-state').addEventListener('click', syncV3State);
document.getElementById('btn-sync-p2p').addEventListener('click', syncV3P2P);

document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => switchTab(t.dataset.tab));
});

refreshAll();
setInterval(refreshAll, 5000);
