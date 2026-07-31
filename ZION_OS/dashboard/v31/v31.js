async function api(path, opts={}) {
  const r = await fetch(path, opts);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

function dot(cls) {
  return `<span class="status-dot ${cls}"></span>`;
}

function fmtTime() {
  return new Date().toLocaleTimeString();
}

async function refresh() {
  try {
    const st = await api('/api/v31/status');
    if (!st.ok) throw new Error(st.error || 'status failed');

    const nodeEl = document.getElementById('kpi-node');
    const poolEl = document.getElementById('kpi-pool');

    if (st.node_running && st.node_reachable) {
      nodeEl.innerHTML = `${dot('status-up')} Online <span class="text-gray-400 text-sm font-mono">(PID ${st.node_pid})</span>`;
    } else if (st.node_running) {
      nodeEl.innerHTML = `${dot('status-warn')} Starting <span class="text-gray-400 text-sm font-mono">(PID ${st.node_pid})</span>`;
    } else {
      nodeEl.innerHTML = `${dot('status-down')} Offline`;
    }

    if (st.pool_running && st.pool_reachable) {
      poolEl.innerHTML = `${dot('status-up')} Online <span class="text-gray-400 text-sm font-mono">(PID ${st.pool_pid})</span>`;
    } else if (st.pool_running) {
      poolEl.innerHTML = `${dot('status-warn')} Starting <span class="text-gray-400 text-sm font-mono">(PID ${st.pool_pid})</span>`;
    } else {
      poolEl.innerHTML = `${dot('status-down')} Offline`;
    }

    document.getElementById('kpi-height').textContent = st.canonical_height ?? '—';
    document.getElementById('kpi-v3-height').textContent = st.v3_height ?? '—';
    document.getElementById('last-update').textContent = `Last update: ${fmtTime()}`;
    document.getElementById('error-box').classList.add('hidden');
  } catch (e) {
    document.getElementById('error-box').textContent = `Refresh error: ${e.message}`;
    document.getElementById('error-box').classList.remove('hidden');
  }

  try {
    const node = await api('/api/v31/logs?svc=node&lines=80');
    document.getElementById('node-log').textContent = node.ok ? node.lines.join('\n') : node.error || 'No log yet.';
  } catch (e) {
    document.getElementById('node-log').textContent = 'Log unavailable.';
  }

  try {
    const pool = await api('/api/v31/logs?svc=pool&lines=80');
    document.getElementById('pool-log').textContent = pool.ok ? pool.lines.join('\n') : pool.error || 'No log yet.';
  } catch (e) {
    document.getElementById('pool-log').textContent = 'Log unavailable.';
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
  } catch (e) {
    document.getElementById('error-box').textContent = `${action} error: ${e.message}`;
    document.getElementById('error-box').classList.remove('hidden');
  } finally {
    btn.disabled = false;
    setTimeout(refresh, 2000);
  }
}

document.getElementById('btn-start').addEventListener('click', () => control('start'));
document.getElementById('btn-stop').addEventListener('click', () => control('stop'));

refresh();
setInterval(refresh, 5000);
