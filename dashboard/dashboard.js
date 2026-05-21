'use strict';

const TABS = ['overview','services','genesis','blockers','controls','charts','events','env','database','metrics','wizard','logs'];
let autoRefresh = true, refreshTimer = null, currentTab = 'overview';
let charts = {};
let friendlyMode = false;
try { friendlyMode = localStorage.getItem('zion-friendly') === '1'; } catch(e) {}

// ─────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────

function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function fmtNum(n){
  if(n === null || n === undefined) return '—';
  if(n >= 1e9) return (n/1e9).toFixed(2) + 'B';
  if(n >= 1e6) return (n/1e6).toFixed(2) + 'M';
  if(n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return n.toString();
}

function toast(msg, kind){
  const t = document.createElement('div');
  t.className = 'fixed bottom-4 right-4 px-4 py-2.5 rounded-xl text-sm font-medium z-50 shadow-lg backdrop-blur-md ' +
    (kind === 'error' ? 'bg-red-600/90 text-white' : 'bg-emerald-600/90 text-white');
  t.style.cssText += 'animation:slide-in 0.3s ease-out;';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; }, 2500);
  setTimeout(() => t.remove(), 3000);
}

function copyToClipboard(text){
  navigator.clipboard.writeText(text).then(() => toast('Copied!', 'success'));
}

// ─────────────────────────────────────────────────────────────────────
// Tab switching
// ─────────────────────────────────────────────────────────────────────

function switchTab(name){
  currentTab = name;
  TABS.forEach(t => {
    const pane = document.getElementById('pane-' + t);
    const btn = document.getElementById('tab-' + t);
    if(pane) pane.classList.toggle('hidden', t !== name);
    if(btn) btn.classList.toggle('tab-active', t === name);
  });
  if(name === 'charts') renderCharts();
  if(name === 'events') loadEvents();
  if(name === 'env') loadEnvFiles();
  if(name === 'wizard') renderWizard();
  if(name === 'logs'){ loadLogs('node1'); loadLogs('node2'); loadLogs('pool'); loadLogs('miner'); }
  if(name === 'controls'){ renderControls(); loadBackupList(); }
  if(name === 'services') loadServices();
  if(name === 'database') loadDatabases();
  if(name === 'metrics') renderMetricsButtons();
  if(name === 'genesis') loadGenesis();
  if(name === 'blockers') loadBlockers();
}

// ─────────────────────────────────────────────────────────────────────
// Main refresh (overview)
// ─────────────────────────────────────────────────────────────────────

function setBadge(elId, ok){
  const b = document.getElementById(elId);
  if(!b) return;
  b.textContent = ok ? 'LIVE' : 'DOWN';
  b.className = (ok
    ? 'px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
    : 'px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/5 text-gray-400 border border-white/10');
}

function setCardLive(id, ok){
  const c = document.getElementById('card-' + id);
  if(!c) return;
  c.classList.toggle('svc-live', ok);
}

async function refreshAll(){
  try {
    const [s, cl, al, blk] = await Promise.all([
      fetch('/api/status').then(r => r.json()),
      fetch('/api/checklist').then(r => r.json()),
      fetch('/api/alerts').then(r => r.json()),
      fetch('/api/blockers').then(r => r.json()),
    ]);

    document.getElementById('timestamp').textContent = '⏱ ' + new Date(s.timestamp).toLocaleTimeString();
    document.getElementById('progressText').textContent = cl.passed + '/' + cl.total;
    document.getElementById('progressBar').style.width = cl.pct + '%';

    // Hero stats
    const live = [s.node1, s.node2, s.pool, s.miner].filter(x => x.running).length;
    document.getElementById('hero-services-up').textContent = live;
    document.getElementById('hero-blockers-open').textContent = blk.open;
    document.getElementById('hero-chain-height').textContent = s.node1.chain_height ?? '—';
    document.getElementById('hero-status-kicker').textContent = blk.ready_for_launch
      ? '✅ Ready · All P0 Blockers Resolved'
      : '⏳ Pre-Launch · ' + blk.open_critical + ' critical blockers';

    updateServiceCards(s);
    updateAlerts(al.alerts);
    updateChecklist(cl.checks);
    updatePayouts(s.pool);
    updateMiniHashrate();
    loadCliNodeStatus();

    if(currentTab === 'charts') renderCharts();
    if(currentTab === 'events') loadEvents();
    if(currentTab === 'wizard') renderWizard();
  } catch(e){
    console.error('Refresh error:', e);
  }
}

function updateServiceCards(s){
  const n1 = s.node1, n2 = s.node2, p = s.pool, m = s.miner;
  setBadge('badge-node1', n1.running); setCardLive('node1', n1.running);
  document.getElementById('val-node1-height').textContent = n1.chain_height ?? '—';
  document.getElementById('val-node1-id').textContent = n1.node_id ?? '—';
  document.getElementById('val-node1-peers').textContent = n1.known_peers ?? '—';
  document.getElementById('val-node1-p2p').textContent = n1.p2p_bind ?? '—';

  setBadge('badge-node2', n2.running); setCardLive('node2', n2.running);
  document.getElementById('val-node2-height').textContent = n2.chain_height ?? '—';
  document.getElementById('val-node2-id').textContent = n2.node_id ?? '—';
  document.getElementById('val-node2-peers').textContent = n2.known_peers ?? '—';
  const synced = n2.chain_height && n1.chain_height && n2.chain_height >= n1.chain_height - 1;
  const syncEl = document.getElementById('val-node2-sync');
  syncEl.textContent = synced ? '✓ Synced' : (n2.known_peers > 0 ? 'Syncing…' : 'No peers');
  syncEl.className = synced ? 'text-emerald-400 font-bold' : 'text-amber-400';

  setBadge('badge-pool', p.running); setCardLive('pool', p.running);
  document.getElementById('val-pool-sessions').textContent = p.active_sessions ?? '0';
  document.getElementById('val-pool-blocks').textContent = p.blocks_found ?? '0';
  document.getElementById('val-pool-shares').textContent = (p.shares_accepted ?? 0) + ' / ' + (p.shares_rejected ?? 0);
  document.getElementById('val-pool-fee').textContent = p.fee_split ? 'Split: ' + p.fee_split : '—';

  setBadge('badge-miner', m.running && m.hashrate); setCardLive('miner', m.running && m.hashrate);
  document.getElementById('val-miner-hashrate').textContent = m.hashrate ? m.hashrate.toFixed(2) : '—';
  document.getElementById('val-miner-gpu').textContent = (m.gpu_backend ? m.gpu_backend + ': ' : '') + (m.gpu_device ?? '—');
  document.getElementById('val-miner-height').textContent = m.current_height ?? '—';
  document.getElementById('val-miner-diff').textContent = m.current_diff ?? '—';
}

function updatePayouts(p){
  document.getElementById('payout-wallet').textContent = p.pool_wallet ?? '—';
  const en = document.getElementById('payout-enabled');
  en.textContent = p.payout_enabled === true ? 'YES' : (p.payout_enabled === false ? 'NO' : '—');
  en.className = p.payout_enabled ? 'font-bold text-emerald-400' : 'font-bold text-red-400';
  document.getElementById('payout-blocks').textContent = p.blocks_found ?? '0';
  document.getElementById('payout-nonce').textContent = p.nonce_count ?? '—';
  document.getElementById('payout-split').textContent = p.fee_split ?? '—';
  const pr = document.getElementById('payout-recent');
  pr.innerHTML = (p.recent_payouts && p.recent_payouts.length)
    ? p.recent_payouts.map(l => '<div class="truncate text-[10px]">' + escapeHtml(l) + '</div>').join('')
    : '<div class="text-gray-600 italic text-[10px]">No payout events yet</div>';
}

function updateAlerts(alerts){
  const cont = document.getElementById('alerts');
  const badge = document.getElementById('alertBadge');
  const topBadge = document.getElementById('alertCount');
  const critical = alerts.filter(a => a.severity === 'critical' || a.severity === 'warning').length;
  badge.textContent = critical + ' active';
  badge.className = 'text-xs px-2.5 py-1 rounded-full ' + (critical > 0 ? 'bg-red-600/20 text-red-300' : 'bg-emerald-600/20 text-emerald-300');
  if(critical > 0){ topBadge.classList.remove('hidden'); topBadge.textContent = critical + ' alerts'; }
  else topBadge.classList.add('hidden');

  const icons = { critical: '🚨', warning: '⚠️', info: 'ℹ️', success: '✅' };
  cont.innerHTML = alerts.map(a => `
    <div class="flex items-start gap-3 p-3 rounded-xl border alert-${a.severity}">
      <span class="text-xl">${icons[a.severity] || 'ℹ️'}</span>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-semibold">${escapeHtml(a.title)}</div>
        <div class="text-xs opacity-80 mt-0.5">${escapeHtml(a.detail)}</div>
      </div>
      ${a.action ? `<button onclick="controlAction('${a.action}')" class="text-xs px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-md transition whitespace-nowrap font-semibold">Fix</button>` : ''}
    </div>`).join('');
}

function updateChecklist(checks){
  document.getElementById('checklist').innerHTML = checks.map(c => `
    <div class="flex items-center gap-2 py-1.5 px-2.5 rounded-lg ${c.ok ? 'bg-emerald-500/10' : 'bg-white/3'}">
      <span class="text-sm ${c.ok ? 'text-emerald-400' : 'text-gray-500'}">${c.ok ? '✓' : '○'}</span>
      <span class="text-xs ${c.ok ? 'text-gray-200' : 'text-gray-400'}">${escapeHtml(c.label)}</span>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────────────
// Mini hashrate sparkline
// ─────────────────────────────────────────────────────────────────────

async function updateMiniHashrate(){
  const hist = await fetch('/api/history').then(r => r.json());
  const data = hist.samples.map(s => s.hashrate || 0);
  if(!charts.mini){
    const ctx = document.getElementById('mini-hashrate').getContext('2d');
    charts.mini = new Chart(ctx, {
      type: 'line',
      data: { labels: data.map(() => ''), datasets: [{ data, borderColor: 'rgb(255 215 0)', backgroundColor: 'rgba(255,215,0,0.1)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } } }, animation: { duration: 300 } }
    });
  } else {
    charts.mini.data.labels = data.map(() => '');
    charts.mini.data.datasets[0].data = data;
    charts.mini.update('none');
  }
  const valid = data.filter(x => x > 0);
  if(valid.length){
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    const max = Math.max(...valid);
    document.getElementById('hashrate-summary').textContent = 'avg ' + avg.toFixed(2) + ' / peak ' + max.toFixed(2) + ' KH/s';
  }
}

async function loadCliNodeStatus(){
  try {
    const data = await fetch('/api/cli/node-status').then(r => r.json());
    const badge = document.getElementById('cli-status-badge');
    if(!badge) return;
    if(data.ok && data.cli_connected){
      badge.className = 'text-xs px-2 py-0.5 rounded-md bg-emerald-700 text-emerald-300';
      badge.textContent = 'Connected';
      // Try to parse output
      const out = data.output || '';
      const height = out.match(/Height\s+(\d+)/); 
      const peers = out.match(/Peers\s+(\d+)/);
      const mempool = out.match(/Mempool\s+(\d+)/);
      const tip = out.match(/Tip\s+([a-f0-9]{8,})/i);
      if(height) document.getElementById('cli-val-height').textContent = height[1];
      if(peers) document.getElementById('cli-val-peers').textContent = peers[1];
      if(mempool) document.getElementById('cli-val-mempool').textContent = mempool[1];
      if(tip) document.getElementById('cli-val-tip').textContent = tip[1].substring(0,16) + '…';
    } else {
      badge.className = 'text-xs px-2 py-0.5 rounded-md bg-gray-700 text-gray-400';
      badge.textContent = 'Unavailable';
    }
  } catch(e) {
    const badge = document.getElementById('cli-status-badge');
    if(badge){ badge.className = 'text-xs px-2 py-0.5 rounded-md bg-gray-700 text-gray-400'; badge.textContent = 'Error'; }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Charts tab
// ─────────────────────────────────────────────────────────────────────

async function renderCharts(){
  const hist = await fetch('/api/history').then(r => r.json());
  const s = hist.samples;
  const labels = s.map(x => new Date(x.t * 1000).toLocaleTimeString().slice(0, 5));
  const common = {
    responsive: true,
    plugins: { legend: { labels: { color: '#cbd5e1' } } },
    scales: {
      x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } }
    },
    animation: { duration: 300 }
  };
  mkChart('chart-hashrate', 'line', { labels, datasets: [{ label: 'KH/s', data: s.map(x => x.hashrate || 0), borderColor: 'rgb(255 215 0)', backgroundColor: 'rgba(255,215,0,0.15)', fill: true, tension: 0.3, pointRadius: 0 }] }, common);
  mkChart('chart-height', 'line', { labels, datasets: [
    { label: 'Node1', data: s.map(x => x.n1_height || 0), borderColor: 'rgb(6 182 212)', pointRadius: 0, tension: 0.2 },
    { label: 'Node2', data: s.map(x => x.n2_height || 0), borderColor: 'rgb(147 51 234)', pointRadius: 0, tension: 0.2, borderDash: [5, 5] }
  ]}, common);
  mkChart('chart-shares', 'bar', { labels, datasets: [
    { label: 'Accepted', data: s.map(x => x.shares_ok || 0), backgroundColor: 'rgb(16 185 129)' },
    { label: 'Rejected', data: s.map(x => x.shares_bad || 0), backgroundColor: 'rgb(239 68 68)' }
  ]}, common);
  mkChart('chart-sessions', 'line', { labels, datasets: [
    { label: 'Sessions', data: s.map(x => x.sessions || 0), borderColor: 'rgb(168 85 247)', pointRadius: 0, tension: 0.3 },
    { label: 'Node1 Peers', data: s.map(x => x.n1_peers || 0), borderColor: 'rgb(6 182 212)', pointRadius: 0, tension: 0.3 }
  ]}, common);
}

function mkChart(id, type, data, opts){
  const ctx = document.getElementById(id);
  if(!ctx) return;
  if(charts[id]){ charts[id].data = data; charts[id].update('none'); return; }
  charts[id] = new Chart(ctx.getContext('2d'), { type, data, options: opts });
}

// ─────────────────────────────────────────────────────────────────────
// Events feed
// ─────────────────────────────────────────────────────────────────────

async function loadEvents(){
  const res = await fetch('/api/events').then(r => r.json());
  const c = document.getElementById('events-feed');
  if(!res.events || !res.events.length){
    c.innerHTML = '<div class="text-gray-500 italic text-sm">No block events recorded yet. Events appear as nodes mine and relay blocks.</div>';
    return;
  }
  const srcColors = { node1: 'bg-emerald-700/40 text-emerald-300', node2: 'bg-blue-700/40 text-blue-300', pool: 'bg-amber-700/40 text-amber-300' };
  const typeIcons = { block_found: '⛏️', block_relay: '📡' };
  c.innerHTML = res.events.map(e => `
    <div class="flex items-center gap-3 p-3 zion-panel-soft border border-white/5 hover:border-zion-gold/30 transition">
      <span class="text-2xl">${typeIcons[e.type] || '🧱'}</span>
      <span class="px-2 py-0.5 rounded text-xs font-bold ${srcColors[e.source] || 'bg-gray-700'}">${e.source}</span>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-bold">Height #${e.height} <span class="text-xs text-gray-400 font-normal">${e.type.replace('_', ' ')}</span></div>
        ${e.hash ? `<div class="text-xs font-mono text-gray-500 truncate">${escapeHtml(e.hash)}</div>` : ''}
      </div>
      <div class="text-xs text-gray-500">${new Date(e.ts * 1000).toLocaleTimeString()}</div>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────────────
// Env files
// ─────────────────────────────────────────────────────────────────────

let currentEnvFile = null;

async function loadEnvFiles(){
  const res = await fetch('/api/env').then(r => r.json());
  const c = document.getElementById('env-file-list');
  c.innerHTML = res.files.map(f => `
    <button onclick="selectEnv('${escapeHtml(f.name)}')" class="zion-panel-soft px-4 py-2.5 hover:border-zion-gold/40 transition ${currentEnvFile === f.name ? 'ring-2 ring-zion-gold' : ''}">
      <div class="font-bold text-zion-gold text-xs font-mono">${escapeHtml(f.name)}</div>
      <div class="text-[10px] text-gray-400">${f.vars} vars · ${(f.size / 1024).toFixed(1)} KB</div>
    </button>`).join('');
}

async function selectEnv(name){
  currentEnvFile = name;
  loadEnvFiles();
  const res = await fetch('/api/env/load?name=' + encodeURIComponent(name)).then(r => r.json());
  const c = document.getElementById('env-detail');
  if(res.error){ c.innerHTML = '<div class="text-red-400">' + escapeHtml(res.error) + '</div>'; return; }
  const missing = res.missing_required || [];
  let html = `<div class="mb-3"><div class="text-base font-bold text-zion-gold mb-1">${escapeHtml(res.file)} <span class="text-xs text-gray-400 font-normal">(${res.total} variables)</span></div>`;
  if(missing.length){ html += `<div class="text-xs text-red-400">⚠ Missing required: ${missing.map(escapeHtml).join(', ')}</div>`; }
  else { html += '<div class="text-xs text-emerald-400">✓ All required variables present</div>'; }
  html += '</div><div class="space-y-1">';
  html += res.vars.map(v => `
    <div class="flex items-center gap-2 py-1 px-2 rounded ${v.required ? 'bg-zion-gold/5' : 'hover:bg-white/3'}">
      <span class="text-[10px] w-8 text-gray-500">${v.line}</span>
      <span class="text-xs ${v.required ? 'text-zion-gold' : 'text-gray-300'} font-mono w-64 truncate">${escapeHtml(v.key)}</span>
      <span class="text-xs font-mono flex-1 truncate ${v.sensitive ? 'text-red-400' : 'text-gray-400'}">${escapeHtml(v.value)}</span>
      ${v.required ? '<span class="text-[10px] px-1.5 py-0.5 bg-zion-gold/20 rounded text-zion-gold">required</span>' : ''}
      ${v.sensitive ? '<span class="text-[10px] px-1.5 py-0.5 bg-red-500/20 rounded text-red-300">secret</span>' : ''}
    </div>`).join('');
  html += '</div>';
  c.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────────
// Wizard
// ─────────────────────────────────────────────────────────────────────

async function renderWizard(){
  const [st, cl] = await Promise.all([fetch('/api/status').then(r => r.json()), fetch('/api/checklist').then(r => r.json())]);
  const C = (id) => cl.checks.find(c => c.id === id);
  const steps = [
    { n: 1, title: 'Prepare environment', desc: 'Generate keys (gen-keys), assemble .env with all wallets and ZION_POOL_PAYOUT_SK_HEX.', done: C('env').ok, actions: [{ label: 'View env files', cb: `switchTab('env')` }] },
    { n: 2, title: 'Start Node 1 (Genesis)', desc: 'Source-of-truth node at 0.0.0.0:8333 (P2P) / 0.0.0.0:8443 (RPC).', done: C('node1').ok, actions: [{ label: '▶ Start Node 1', cb: `controlAction('start-node1')` }] },
    { n: 3, title: 'Start Node 2 (Follower)', desc: 'Connects to Node1 as peer, validates P2P handshake & block sync.', done: C('node2').ok, actions: [{ label: '▶ Start Node 2', cb: `controlAction('start-node2')` }] },
    { n: 4, title: 'Start Pool', desc: 'Pulls templates from Node1 RPC, accepts miners on 0.0.0.0:8444.', done: C('pool').ok, actions: [{ label: '▶ Start Pool', cb: `controlAction('start-pool')` }] },
    { n: 5, title: 'Start GPU Miner', desc: 'Connects to pool, performs cosmic_harmony hashing on GPU.', done: C('miner').ok, actions: [{ label: '▶ Start Miner', cb: `controlAction('start-miner')` }] },
    { n: 6, title: 'Start Monitoring', desc: 'Launch Prometheus + Grafana via Docker for metrics dashboards.', done: false, actions: [{ label: '▶ Start Monitoring', cb: `controlAction('start-monitoring')` }, { label: 'Open Grafana', cb: `window.open('http://127.0.0.1:3000')` }] },
    { n: 7, title: 'Verify chain progression', desc: 'Confirm chain height advances and blocks propagate to Node 2.', done: C('chain').ok, actions: [{ label: 'View events', cb: `switchTab('events')` }] },
    { n: 8, title: 'Confirm fee split & payouts', desc: 'Validate 89/5/5/1 distribution and payout wallet funded.', done: C('fee_split').ok && C('payout').ok, actions: [{ label: 'View payouts', cb: `switchTab('overview')` }] },
  ];
  const cont = document.getElementById('wizard-steps');
  cont.innerHTML = steps.map((s, i) => {
    const next = !s.done && steps.slice(0, i).every(x => x.done);
    const bg = s.done ? 'border-emerald-500/40 bg-emerald-500/5' : (next ? 'border-zion-gold/40 bg-zion-gold/5' : 'border-white/5 bg-white/3');
    return `<div class="flex items-start gap-4 p-4 rounded-xl border ${bg}">
      <div class="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold ${s.done ? 'bg-emerald-500/30 text-emerald-300' : (next ? 'bg-zion-gold/30 text-zion-gold animate-pulse' : 'bg-white/10 text-gray-400')}">${s.done ? '✓' : s.n}</div>
      <div class="flex-1">
        <div class="font-bold text-base mb-1 ${next ? 'text-zion-gold' : ''}">${escapeHtml(s.title)}</div>
        <div class="text-xs text-gray-400 mb-2">${escapeHtml(s.desc)}</div>
        <div class="flex gap-2 flex-wrap">${s.actions.map(a => `<button onclick="${a.cb}" class="text-xs px-3 py-1 bg-white/5 hover:bg-zion-gold/20 rounded-md transition">${escapeHtml(a.label)}</button>`).join('')}</div>
      </div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────
// Controls
// ─────────────────────────────────────────────────────────────────────

async function renderControls(){
  const c = document.getElementById('control-buttons');
  if(!c) return;
  try {
    const res = await fetch('/api/controls').then(r => r.json());
    const icons = {
      'install-deps': '📦', 'open-terminal': '🖥️',
      'start-node1': '🔷', 'start-node2': '🔶', 'start-pool': '⚡', 'start-miner': '⛏️',
      'restart-node2': '⟳ 🔶', 'restart-miner': '⟳ ⛏️',
      'start-monitoring': '📊', 'stop-monitoring': '⏸ 📊',
      'start-prometheus': '📊', 'start-grafana': '📈',
      'launch-stack': '🚀', 'stop-stack': '⏹️',
      'launch-full': '🚀', 'stop-all': '⏹',
    };
    // Hide big buttons from individual grid
    const hidden = ['launch-stack','stop-stack','launch-full','stop-all','open-terminal'];
    const actions = (res.actions || []).filter(a => !hidden.includes(a));
    c.innerHTML = actions.map(a =>
      `<button onclick="controlAction('${a}')" class="zion-panel-soft p-3 text-left hover:border-zion-gold/40 transition zion-panel-hover">
        <div class="text-2xl mb-1">${icons[a] || '⚙️'}</div>
        <div class="text-xs font-semibold">${a}</div>
      </button>`).join('');
  } catch(e) {
    console.error('renderControls error:', e);
    c.innerHTML = '<div class="text-red-400 text-sm">Failed to load controls. Refresh the page (Ctrl+F5).</div>';
  }
  loadInstallLog();
}

async function controlAction(action){
  const log = document.getElementById('control-log');
  const ts = new Date().toLocaleTimeString();
  const launchActions = ['launch-full','launch-stack','start-node1','start-node2','start-pool','start-miner'];
  const note = launchActions.includes(action) ? ' (may take ~15s)' : '';
  if(log) log.insertAdjacentHTML('afterbegin', '<div class="text-zion-gold">[' + ts + '] dispatching ' + action + note + '…</div>');
  try {
    const res = await fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }).then(r => r.json());
    const msg = res.ok ? '<div class="text-emerald-400">[' + ts + '] ✓ ' + action + ' started (PID ' + res.pid + ')</div>' : '<div class="text-red-400">[' + ts + '] ✗ ' + (res.error || 'failed') + '</div>';
    if(log) log.insertAdjacentHTML('afterbegin', msg);
    toast(res.ok ? ('▶ ' + action + ' dispatched' + note) : ('Failed: ' + (res.error || action)), res.ok ? 'success' : 'error');
    if(action === 'install-deps' && res.ok){
      startInstallLogPolling();
    }
    if(res.ok && launchActions.includes(action)){
      setTimeout(() => { toast('Services should be live. Check Overview tab.', 'success'); refreshAll(); }, 12000);
    }
  } catch(e) {
    if(log) log.insertAdjacentHTML('afterbegin', '<div class="text-red-400">[' + ts + '] ✗ ' + e.message + '</div>');
    toast('Error: ' + e.message, 'error');
  }
}

// ── CLI Console ──
async function runCliCommand(){
  const input = document.getElementById('cli-input');
  const output = document.getElementById('cli-output');
  const cmd = input.value.trim();
  if(!cmd) return;
  output.innerHTML = '<div class="text-zion-gold text-xs">Running: zion ' + escapeHtml(cmd) + '…</div>';
  try {
    const res = await fetch('/api/cli/run', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({cmd})
    }).then(r => r.json());
    if(res.ok){
      let out = '';
      if(res.stdout) out += '<pre class="text-gray-300 whitespace-pre-wrap">' + escapeHtml(res.stdout) + '</pre>';
      if(res.stderr) out += '<pre class="text-red-400 whitespace-pre-wrap mt-1">' + escapeHtml(res.stderr) + '</pre>';
      if(!res.stdout && !res.stderr) out = '<div class="text-gray-500 italic">No output.</div>';
      output.innerHTML = '<div class="text-emerald-400 text-xs mb-1">✓ zion ' + escapeHtml(cmd) + ' (exit ' + (res.exit_code ?? '?') + ')</div>' + out;
    } else {
      output.innerHTML = '<div class="text-red-400 text-xs">✗ ' + escapeHtml(res.error || 'failed') + '</div>';
    }
  } catch(e) {
    output.innerHTML = '<div class="text-red-400 text-xs">✗ ' + escapeHtml(e.message) + '</div>';
  }
}
function runCliQuick(cmd){
  document.getElementById('cli-input').value = cmd;
  runCliCommand();
}

async function runCoreUtil(cmd){
  const log = document.getElementById('backup-log');
  const db = 'V3/data/zion-node-state.db';
  if(log) log.insertAdjacentHTML('afterbegin', '<div class="text-zion-gold text-xs">Running core-util ' + cmd + '…</div>');
  try {
    const res = await fetch('/api/cli/core-util', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({cmd, db})
    }).then(r => r.json());
    const msg = res.ok ? '<div class="text-emerald-400 text-xs">✓ core-util ' + cmd + '</div>' : '<div class="text-red-400 text-xs">✗ ' + escapeHtml(res.error || 'failed') + '</div>';
    if(log) log.insertAdjacentHTML('afterbegin', msg + '<pre class="text-[10px] text-gray-400 mt-1 whitespace-pre-wrap">' + escapeHtml(res.stdout || res.output || '') + '</pre>');
    toast(res.ok ? 'core-util ' + cmd + ' done' : 'core-util failed: ' + (res.error || ''), res.ok ? 'success' : 'error');
  } catch(e) {
    if(log) log.insertAdjacentHTML('afterbegin', '<div class="text-red-400 text-xs">✗ ' + e.message + '</div>');
    toast('core-util error: ' + e.message, 'error');
  }
}

// ── Backup & Recovery ──
async function loadBackupList(){
  const list = document.getElementById('backup-list');
  const log = document.getElementById('backup-log');
  if(!list) return;
  try {
    const data = await fetch('/api/backup/list').then(r => r.json());
    if(!data.backups || data.backups.length === 0){
      list.innerHTML = '<div class="text-gray-500 italic text-sm">No backups yet. Click "Create Backup" to make one.</div>';
      return;
    }
    list.innerHTML = data.backups.map(b => `
      <div class="zion-panel p-3 flex items-center justify-between">
        <div>
          <div class="text-sm font-semibold">${escapeHtml(b.name)}</div>
          <div class="text-xs text-gray-400">${escapeHtml(b.created)} · ${b.size_mb} MB</div>
        </div>
        <div class="flex gap-2">
          <button onclick="restoreBackup('${escapeHtml(b.name)}')" class="text-[10px] px-2 py-1 bg-emerald-700/50 hover:bg-emerald-600 rounded transition">↩ Restore</button>
          <button onclick="deleteBackup('${escapeHtml(b.name)}')" class="text-[10px] px-2 py-1 bg-red-700/50 hover:bg-red-600 rounded transition">🗑 Delete</button>
        </div>
      </div>
    `).join('');
    if(log) log.insertAdjacentHTML('afterbegin', '<div class="text-gray-400 text-xs">Loaded ' + data.backups.length + ' backup(s).</div>');
  } catch(e) {
    if(log) log.insertAdjacentHTML('afterbegin', '<div class="text-red-400 text-xs">Failed to load backups: ' + e.message + '</div>');
  }
}

async function createBackup(){
  const log = document.getElementById('backup-log');
  const includeLogs = document.getElementById('backup-logs')?.checked || false;
  const includeEnv = document.getElementById('backup-env')?.checked || false;
  if(log) log.insertAdjacentHTML('afterbegin', '<div class="text-zion-gold text-xs">Creating backup (this may take a moment)…</div>');
  try {
    const res = await fetch('/api/backup/create', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({includeLogs, includeEnv})
    }).then(r => r.json());
    const msg = res.ok ? '<div class="text-emerald-400 text-xs">✓ Backup created.</div>' : '<div class="text-red-400 text-xs">✗ ' + escapeHtml(res.error || 'failed') + '</div>';
    if(log) log.insertAdjacentHTML('afterbegin', msg + '<pre class="text-[10px] text-gray-400 mt-1">' + escapeHtml(res.output || '') + '</pre>');
    toast(res.ok ? 'Backup created successfully' : 'Backup failed: ' + (res.error || ''), res.ok ? 'success' : 'error');
    loadBackupList();
  } catch(e) {
    if(log) log.insertAdjacentHTML('afterbegin', '<div class="text-red-400 text-xs">✗ ' + e.message + '</div>');
    toast('Backup error: ' + e.message, 'error');
  }
}

async function restoreBackup(name){
  if(!confirm('Restore from ' + name + '? This will STOP all services and replace current chain state.\n\nAn emergency backup of current state will be created first.')) return;
  const log = document.getElementById('backup-log');
  if(log) log.insertAdjacentHTML('afterbegin', '<div class="text-amber-400 text-xs">Restoring from ' + escapeHtml(name) + '…</div>');
  try {
    const res = await fetch('/api/backup/restore', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name})
    }).then(r => r.json());
    const msg = res.ok ? '<div class="text-emerald-400 text-xs">✓ Restored. Restart stack from Controls.</div>' : '<div class="text-red-400 text-xs">✗ ' + escapeHtml(res.error || 'failed') + '</div>';
    if(log) log.insertAdjacentHTML('afterbegin', msg + '<pre class="text-[10px] text-gray-400 mt-1">' + escapeHtml(res.output || '') + '</pre>');
    toast(res.ok ? 'Restored from backup. Restart stack.' : 'Restore failed: ' + (res.error || ''), res.ok ? 'success' : 'error');
    loadBackupList();
  } catch(e) {
    if(log) log.insertAdjacentHTML('afterbegin', '<div class="text-red-400 text-xs">✗ ' + e.message + '</div>');
    toast('Restore error: ' + e.message, 'error');
  }
}

async function deleteBackup(name){
  if(!confirm('Delete backup ' + name + '?')) return;
  try {
    const res = await fetch('/api/backup/delete', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name})
    }).then(r => r.json());
    toast(res.ok ? 'Deleted ' + name : 'Delete failed: ' + (res.error || ''), res.ok ? 'success' : 'error');
    loadBackupList();
  } catch(e) {
    toast('Delete error: ' + e.message, 'error');
  }
}

async function verifyBackup(){
  const log = document.getElementById('backup-log');
  if(log) log.insertAdjacentHTML('afterbegin', '<div class="text-zion-gold text-xs">Verifying chain state integrity…</div>');
  try {
    const data = await fetch('/api/backup/verify').then(r => r.json());
    const ok = data.result && data.result.ok;
    const msg = ok ? '<div class="text-emerald-400 text-xs">✓ Chain state is healthy.</div>' : '<div class="text-red-400 text-xs">✗ Integrity check failed.</div>';
    if(log) log.insertAdjacentHTML('afterbegin', msg + '<pre class="text-[10px] text-gray-400 mt-1">' + escapeHtml((data.log || []).join('\n')) + '</pre>');
    toast(ok ? 'Chain state verified OK' : 'Chain state verification failed', ok ? 'success' : 'error');
  } catch(e) {
    if(log) log.insertAdjacentHTML('afterbegin', '<div class="text-red-400 text-xs">✗ ' + e.message + '</div>');
    toast('Verify error: ' + e.message, 'error');
  }
}

// ── Install log ──
let installLogTimer = null;
async function loadInstallLog(){
  const el = document.getElementById('install-log');
  if(!el) return;
  try {
    const data = await fetch('/api/install/log').then(r => r.json());
    if(data.lines && data.lines.length){
      el.innerHTML = data.lines.map(ln => '<div class="text-[11px] font-mono whitespace-pre-wrap">' + escapeHtml(ln) + '</div>').join('');
      el.scrollTop = el.scrollHeight;
    } else {
      el.innerHTML = '<div class="text-gray-500 italic text-sm">Run Install / Build to see progress.</div>';
    }
  } catch(e) {
    el.innerHTML = '<div class="text-red-400 text-sm">Failed to load install log.</div>';
  }
}
function startInstallLogPolling(){
  if(installLogTimer) clearInterval(installLogTimer);
  loadInstallLog();
  installLogTimer = setInterval(loadInstallLog, 2000);
}
function stopInstallLogPolling(){
  if(installLogTimer){ clearInterval(installLogTimer); installLogTimer = null; }
}

// ─────────────────────────────────────────────────────────────────────
// Logs
// ─────────────────────────────────────────────────────────────────────

async function loadLogs(service){
  try {
    const res = await fetch('/api/logs/' + service);
    const data = await res.json();
    const el = document.getElementById('log-' + service);
    if(el) el.textContent = data.lines.slice(-60).join('\n');
  } catch(e) { console.error(e); }
}

// ─────────────────────────────────────────────────────────────────────
// Friendly mode
// ─────────────────────────────────────────────────────────────────────

function toggleFriendly(){
  friendlyMode = !friendlyMode;
  try { localStorage.setItem('zion-friendly', friendlyMode ? '1' : '0'); } catch(e) {}
  applyFriendlyMode();
  if(currentTab === 'services') loadServices();
}

function applyFriendlyMode(){
  const btn = document.getElementById('friendlyBtn');
  if(!btn) return;
  btn.textContent = friendlyMode ? '🧑‍💻 Pro Mode' : '🧒 Kid Mode';
}

// ─────────────────────────────────────────────────────────────────────
// Services tab
// ─────────────────────────────────────────────────────────────────────

async function loadServices(){
  const res = await fetch('/api/services').then(r => r.json());
  const grid = document.getElementById('services-grid');
  const lvlColors = {
    L1: 'border-emerald-500/30 bg-emerald-500/3',
    L2: 'border-blue-500/30 bg-blue-500/3',
    L3: 'border-purple-500/30 bg-purple-500/3',
    L4: 'border-pink-500/30 bg-pink-500/3',
    Infra: 'border-zion-gold/30 bg-zion-gold/3',
  };
  grid.innerHTML = res.services.map(s => {
    const aliveBadge = s.alive
      ? '<span class="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] rounded font-bold border border-emerald-500/40">LIVE</span>'
      : '<span class="px-2 py-0.5 bg-white/5 text-gray-500 text-[10px] rounded border border-white/10">DOWN</span>';
    const portsHtml = Object.entries(s.ports || {}).map(([k, v]) => {
      const isOpen = s.ports_open.includes(k + ':' + v);
      return `<span class="text-[10px] font-mono ${isOpen ? 'text-emerald-400' : 'text-gray-600'}" title="${k}">${k}:${v}</span>`;
    }).join(' · ');
    const desc = friendlyMode ? s.child_says : s.purpose;
    const startBtn = s.start ? `<button onclick="controlAction('${s.start}')" class="text-[10px] px-2.5 py-1 bg-emerald-700/50 hover:bg-emerald-600 rounded font-semibold transition">▶ Start</button>` : '';
    const metricsBtn = (s.ports.metrics || s.ports.api) ? `<button onclick="loadMetrics('${s.id}')" class="text-[10px] px-2.5 py-1 bg-white/5 hover:bg-white/15 rounded font-semibold transition">📊</button>` : '';
    const logBtn = s.log ? `<button onclick="switchTab('logs');setTimeout(()=>loadLogs('${s.id}'),300)" class="text-[10px] px-2.5 py-1 bg-white/5 hover:bg-white/15 rounded font-semibold transition">📜</button>` : '';
    return `<div class="zion-panel-soft zion-panel-hover p-4 rounded-xl border ${lvlColors[s.level] || 'border-white/10'} ${s.alive ? 'svc-live' : ''}">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <span class="text-2xl">${s.icon}</span>
          <div>
            <div class="text-sm font-bold">${escapeHtml(s.name)}</div>
            <div class="text-[10px] text-gray-500 uppercase tracking-wider">${s.level} · ${s.kind}</div>
          </div>
        </div>
        ${aliveBadge}
      </div>
      <div class="text-[11px] text-gray-300 leading-relaxed mb-3 min-h-[2.5em]">${escapeHtml(desc)}</div>
      <div class="flex flex-wrap gap-x-2 gap-y-0.5 mb-3">${portsHtml || '<span class="text-[10px] text-gray-600">no ports</span>'}</div>
      <div class="flex gap-1.5">${startBtn}${metricsBtn}${logBtn}</div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────
// Database
// ─────────────────────────────────────────────────────────────────────

async function loadDatabases(){
  const res = await fetch('/api/db').then(r => r.json());
  const list = document.getElementById('db-list');
  list.innerHTML = res.databases.map(d => {
    const sizeStr = d.size > 1024 * 1024 ? (d.size / 1024 / 1024).toFixed(1) + ' MB' : d.size > 1024 ? (d.size / 1024).toFixed(1) + ' KB' : d.size + ' B';
    const kindBadge = d.kind === 'sqlite' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300';
    const dis = d.available ? '' : 'opacity-40';
    return `<button onclick="inspectDb('${escapeHtml(d.path)}')" ${d.available ? '' : 'disabled'} class="${dis} zion-panel-soft zion-panel-hover text-left p-4 rounded-xl border border-white/5">
      <div class="flex items-center justify-between mb-1">
        <span class="text-sm font-bold">${escapeHtml(d.name)}</span>
        <span class="text-[10px] px-2 py-0.5 rounded ${kindBadge} uppercase font-bold">${d.kind}</span>
      </div>
      <div class="text-[10px] font-mono text-gray-500 truncate">${escapeHtml(d.path)}</div>
      <div class="text-[10px] text-gray-400 mt-1">${d.available ? sizeStr : 'Not yet created'} · service: <span class="text-zion-gold">${d.service}</span></div>
    </button>`;
  }).join('');
}

async function inspectDb(path){
  const res = await fetch('/api/db/inspect?path=' + encodeURIComponent(path)).then(r => r.json());
  const c = document.getElementById('db-detail');
  if(res.error){ c.innerHTML = '<div class="text-red-400">Error: ' + escapeHtml(res.error) + '</div>'; return; }
  let html = '<div class="mb-4"><div class="text-base font-bold text-zion-gold">' + escapeHtml(res.name) + '</div>';
  html += '<div class="text-[10px] font-mono text-gray-500">' + escapeHtml(res.path) + '</div></div>';

  if(res.kind === 'json'){
    html += '<div class="space-y-2">';
    for(const [k, v] of Object.entries(res.data)){
      if(v && typeof v === 'object' && '_type' in v){
        html += '<div class="zion-panel-soft p-3"><div class="text-xs font-bold text-zion-gold">' + escapeHtml(k) + ' <span class="text-gray-500 font-normal">(' + v._type + ', ' + v._len + ' items)</span></div>';
        html += '<pre class="text-[10px] text-gray-400 mt-2 overflow-auto max-h-48">' + escapeHtml(JSON.stringify(v._sample, null, 2)) + '</pre></div>';
      } else {
        html += '<div class="flex gap-3 py-1.5 border-b border-white/5"><span class="text-xs text-zion-gold font-mono w-48">' + escapeHtml(k) + '</span><span class="text-xs text-gray-300 font-mono break-all">' + escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v)) + '</span></div>';
      }
    }
    html += '</div>';
  } else if(res.kind === 'sqlite'){
    if(!res.tables || !res.tables.length){
      html += '<div class="text-gray-500 italic text-sm">Database has no tables.</div>';
    } else {
      html += res.tables.map(t => {
        let tHtml = '<details class="mb-3 zion-panel-soft p-3"><summary class="cursor-pointer text-sm"><span class="font-bold text-zion-gold">' + escapeHtml(t.name) + '</span> <span class="text-gray-500">(' + t.rows + ' rows, ' + t.columns.length + ' cols)</span></summary>';
        tHtml += '<div class="text-[10px] text-gray-400 mt-2 mb-2">Columns: ' + t.columns.map(c => '<span class="font-mono text-zion-gold">' + escapeHtml(c.name) + '</span>:<span class="text-gray-500">' + escapeHtml(c.type) + '</span>').join(', ') + '</div>';
        if(t.sample && t.sample.length){
          tHtml += '<div class="overflow-auto max-h-64"><table class="w-full text-[10px] border-collapse">';
          tHtml += '<thead><tr>' + t.columns.map(c => '<th class="text-left p-1 border-b border-white/10 text-zion-gold">' + escapeHtml(c.name) + '</th>').join('') + '</tr></thead><tbody>';
          tHtml += t.sample.map(row => '<tr class="hover:bg-white/3">' + t.columns.map(c => '<td class="p-1 border-b border-white/5 font-mono">' + escapeHtml(String(row[c.name] ?? '')).slice(0, 80) + '</td>').join('') + '</tr>').join('');
          tHtml += '</tbody></table></div>';
        }
        tHtml += '</details>';
        return tHtml;
      }).join('');
    }
  }
  c.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────

async function renderMetricsButtons(){
  const svcRes = await fetch('/api/services').then(r => r.json());
  const c = document.getElementById('metrics-buttons');
  const scrapable = svcRes.services.filter(s => s.ports.metrics || s.ports.api);
  c.innerHTML = scrapable.map(s => `
    <button onclick="loadMetrics('${s.id}')" class="zion-button-secondary text-xs flex items-center gap-1.5">
      <span>${s.icon}</span><span>${escapeHtml(s.name)}</span>
      <span class="text-[10px] ${s.alive ? 'text-emerald-400' : 'text-gray-500'}">${s.alive ? '●' : '○'}</span>
    </button>`).join('');
}

async function loadMetrics(sid){
  if(currentTab !== 'metrics') switchTab('metrics');
  const res = await fetch('/api/metrics/' + sid).then(r => r.json());
  const c = document.getElementById('metrics-detail');
  if(res.error){
    c.innerHTML = '<div class="text-red-400">Cannot scrape metrics from <span class="text-zion-gold">' + escapeHtml(sid) + '</span>: ' + escapeHtml(res.error) + '</div><div class="text-xs text-gray-500 mt-2">URL tried: ' + escapeHtml(res.url || 'n/a') + '</div>';
    return;
  }
  const entries = Object.entries(res.metrics);
  if(!entries.length){ c.innerHTML = '<div class="text-gray-500 italic">No metrics returned.</div>'; return; }
  let html = '<div class="text-xs text-emerald-400 mb-2">✓ Scraped ' + res.count + ' metrics from ' + escapeHtml(res.url) + '</div>';
  html += '<div class="space-y-0.5">';
  for(const [k, v] of entries){
    html += '<div class="flex gap-3 hover:bg-white/3 px-1"><span class="text-[10px] text-zion-gold font-mono flex-1 truncate">' + escapeHtml(k) + '</span><span class="text-[10px] text-gray-300 font-mono">' + v + '</span></div>';
  }
  html += '</div>';
  c.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────────
// Genesis & Premine
// ─────────────────────────────────────────────────────────────────────

async function loadGenesis(){
  const res = await fetch('/api/genesis').then(r => r.json());
  const C = res.constants;

  // Stats grid
  const stats = [
    { label: 'Total Supply', value: '144B', sub: 'ZION (hard cap)', color: 'text-gradient' },
    { label: 'Premine', value: '16.28B', sub: '11.31% (genesis)', color: 'text-zion-gold' },
    { label: 'Mining Emission', value: '127.72B', sub: '88.69% (100yr)', color: 'text-zion-cyan' },
    { label: 'Block Time', value: '60s', sub: 'Target', color: 'text-zion-purple' },
    { label: 'Base Reward', value: '5,400 ZION', sub: 'Initial', color: 'text-emerald-400' },
    { label: 'Tail Reward', value: '724.78 ZION', sub: 'Forever (from ~2126)', color: 'text-amber-400' },
    { label: 'Decay', value: '−20%', sub: 'per decade × 10', color: 'text-zion-purple' },
    { label: 'Premine Outputs', value: res.premine_outputs_count, sub: 'in genesis block', color: 'text-zion-gold' },
  ];
  document.getElementById('genesis-stats').innerHTML = stats.map(s =>
    `<div class="zion-panel p-4">
      <div class="text-2xl md:text-3xl font-bold mb-1 ${s.color}">${s.value}</div>
      <div class="text-xs text-gray-500 uppercase tracking-wider">${escapeHtml(s.label)}</div>
      <div class="text-[10px] text-gray-400 mt-1">${escapeHtml(s.sub)}</div>
    </div>`).join('');

  // Reward split visualization (horizontal bar)
  const split = C.reward_split;
  const splitData = [
    { label: 'Miner', pct: split.miner_pct, color: 'rgb(255 215 0)', desc: 'Block solvers' },
    { label: 'Humanitarian Fund', pct: split.humanitarian_pct, color: 'rgb(16 185 129)', desc: 'Children Future Fund' },
    { label: 'L5/L6 Issobella', pct: split.issobella_pct, color: 'rgb(147 51 234)', desc: 'Free World + Issobella' },
    { label: 'Pool Fee', pct: split.pool_fee_pct, color: 'rgb(6 182 212)', desc: 'Pool operator' },
  ];
  document.getElementById('reward-split-viz').innerHTML = splitData.map(d => `
    <div>
      <div class="flex justify-between items-center mb-1">
        <span class="text-sm font-semibold">${escapeHtml(d.label)} <span class="text-xs text-gray-400 font-normal">— ${escapeHtml(d.desc)}</span></span>
        <span class="text-sm font-bold" style="color:${d.color};">${d.pct}%</span>
      </div>
      <div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-700" style="width:${d.pct}%;background:${d.color};box-shadow:0 0 12px ${d.color};"></div>
      </div>
    </div>`).join('');

  // Consensus params
  const cp = C.consensus;
  document.getElementById('consensus-params').innerHTML = Object.entries(cp).map(([k, v]) => `
    <div class="flex justify-between py-1 border-b border-white/5">
      <span class="text-gray-400 font-mono">${escapeHtml(k)}</span>
      <span class="text-white font-mono font-semibold">${escapeHtml(String(v))}</span>
    </div>`).join('');

  // Premine table
  const catColors = {
    oasis_golden_egg: 'border-pink-500/30 bg-pink-500/5',
    dao_treasury: 'border-blue-500/30 bg-blue-500/5',
    infrastructure: 'border-zion-cyan/30 bg-cyan-500/5',
    humanitarian: 'border-emerald-500/30 bg-emerald-500/5',
  };
  const catIcons = { oasis_golden_egg: '🌸', dao_treasury: '🗳️', infrastructure: '🏗️', humanitarian: '💝' };
  document.getElementById('premine-table').innerHTML = res.premine.map((p, i) => `
    <div class="zion-panel-soft border ${catColors[p.category] || 'border-white/10'} rounded-xl p-3 flex items-center gap-3">
      <div class="text-2xl">${catIcons[p.category] || '⚪'}</div>
      <div class="text-xs text-gray-500 font-mono w-6">#${i + 1}</div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-semibold truncate">${escapeHtml(p.purpose)}</div>
        <div class="text-[10px] font-mono text-gray-500 truncate flex items-center gap-2">
          <span class="hover:text-zion-gold cursor-pointer" onclick="copyToClipboard('${escapeHtml(p.address)}')">${escapeHtml(p.address)}</span>
          <button onclick="copyToClipboard('${escapeHtml(p.address)}')" class="text-gray-500 hover:text-white text-[10px]">📋</button>
        </div>
      </div>
      <div class="text-right">
        <div class="text-base font-bold text-zion-gold">${(p.amount_zion / 1e9).toFixed(2)}B</div>
        <div class="text-[10px] text-gray-500">ZION</div>
        ${p.unlock_height ? `<div class="text-[10px] text-amber-400 mt-0.5">🔒 unlock @ ${p.unlock_height.toLocaleString()}</div>` : ''}
      </div>
    </div>`).join('');

  // Special addresses
  const sa = C.special_addresses;
  document.getElementById('special-addresses').innerHTML = Object.entries(sa).map(([k, v]) => `
    <div class="zion-panel-soft p-3 flex items-center gap-3">
      <span class="zion-kicker">${escapeHtml(k)}</span>
      <code class="text-xs font-mono text-zion-gold flex-1 truncate">${escapeHtml(v)}</code>
      <button onclick="copyToClipboard('${escapeHtml(v)}')" class="text-xs text-gray-400 hover:text-white">📋</button>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────────────
// P0 Blockers
// ─────────────────────────────────────────────────────────────────────

async function loadBlockers(){
  const res = await fetch('/api/blockers').then(r => r.json());
  const summary = document.getElementById('blockers-summary');
  summary.innerHTML = `
    <span class="zion-kicker" style="background:rgba(239,68,68,0.15);color:#fca5a5;border-color:rgba(239,68,68,0.3);">${res.open_critical} critical</span>
    <span class="zion-kicker" style="background:rgba(245,158,11,0.15);color:#fcd34d;border-color:rgba(245,158,11,0.3);margin-left:8px;">${res.open} open</span>
    <span class="zion-kicker" style="background:rgba(16,185,129,0.15);color:#6ee7b7;border-color:rgba(16,185,129,0.3);margin-left:8px;">${res.done} done</span>
  `;

  const list = document.getElementById('blockers-list');
  const severityColors = {
    critical: 'border-red-500/40 bg-red-500/5',
    warning: 'border-amber-500/40 bg-amber-500/5',
    info: 'border-emerald-500/40 bg-emerald-500/5',
  };
  const statusBadge = {
    OPEN: '<span class="px-2 py-0.5 bg-red-500/20 text-red-300 rounded text-[10px] font-bold">OPEN</span>',
    PREP: '<span class="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] font-bold">PREP</span>',
    DONE: '<span class="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-bold">DONE</span>',
  };

  list.innerHTML = res.blockers.map(b => `
    <div class="zion-panel-soft border rounded-xl p-4 ${severityColors[b.severity] || ''}">
      <div class="flex items-start justify-between mb-2 gap-3 flex-wrap">
        <div class="flex items-start gap-3 flex-1 min-w-0">
          <div class="text-2xl text-gray-500 font-bold w-8">#${b.id}</div>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-base">${escapeHtml(b.title)}</div>
            <div class="text-xs text-gray-400 mt-1 leading-relaxed">${escapeHtml(b.detail)}</div>
          </div>
        </div>
        <div class="flex flex-col items-end gap-1">
          ${statusBadge[b.status] || ''}
          <div class="text-[10px] text-gray-500">⏰ ${escapeHtml(b.deadline)}</div>
          <div class="text-[10px] text-gray-500">👤 ${escapeHtml(b.owner)}</div>
        </div>
      </div>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────────────
// Auto refresh
// ─────────────────────────────────────────────────────────────────────

function toggleAuto(){
  autoRefresh = !autoRefresh;
  const b = document.getElementById('autoBtn');
  if(autoRefresh){
    b.textContent = '⚡ Auto';
    refreshTimer = setInterval(refreshAll, 3000);
  } else {
    b.textContent = '⏸ Paused';
    clearInterval(refreshTimer);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────

applyFriendlyMode();
switchTab('overview');
refreshAll();
refreshTimer = setInterval(refreshAll, 3000);
