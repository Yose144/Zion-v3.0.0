'use strict';

const TABS = ['overview','wallets','explorer','services','alerts','l1','l2','l3','l4','l5','l6','genesis','blockers','controls','charts','events','env','database','metrics','launch-day','wizard','logs','hiran'];
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

function toggleSidebar(){
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  if(!sb) return;
  const open = sb.classList.toggle('open');
  if(ov) ov.classList.toggle('open', open);
}

function switchTab(name){
  currentTab = name;
  TABS.forEach(t => {
    const pane = document.getElementById('pane-' + t);
    const btn = document.getElementById('tab-' + t);
    if(pane) pane.classList.toggle('hidden', t !== name);
    if(btn) btn.classList.toggle('tab-active', t === name);
  });
  // Close sidebar on mobile after tab selection
  const sb = document.getElementById('sidebar');
  if(sb && sb.classList.contains('open')) toggleSidebar();
  if(name === 'charts') renderCharts();
  if(name === 'events') loadEvents();
  if(name === 'alerts') loadAlertHistory();
  if(name === 'env') loadEnvFiles();
  if(name === 'wizard') renderWizard();
  if(name === 'logs'){ loadLogs('node1'); loadLogs('node2'); loadLogs('pool'); loadLogs('miner'); }
  if(name === 'controls'){ renderControls(); loadBackupList(); loadDepGraph(); loadProcessRegistry(); }
  if(name === 'services') loadServices();
  if(name === 'database') loadDatabases();
  if(name === 'metrics') renderMetricsButtons();
  if(name === 'genesis') loadGenesis();
  if(name === 'blockers') loadBlockers();
  if(name === 'wallets') loadWallets();
  if(name === 'explorer') loadExplorer();
  if(['l1','l2','l3','l4','l5','l6'].includes(name)) loadLayer(name);
  if(name === 'launch-day') loadLaunchDayStatus();
  if(name === 'hiran'){ loadAgentList(); checkAiStatus(); }
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
    const [s, cl, al, blk, res] = await Promise.all([
      fetch('/api/status').then(r => r.json()),
      fetch('/api/checklist').then(r => r.json()),
      fetch('/api/alerts').then(r => r.json()),
      fetch('/api/blockers').then(r => r.json()),
      fetch('/api/resources').then(r => r.json()).catch(() => ({})),
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
    updateResourceBars(res);

    if(currentTab === 'charts') renderCharts();
    if(currentTab === 'events') loadEvents();
    if(currentTab === 'wizard') renderWizard();
    if(currentTab === 'ops') loadOps();
    if(currentTab === 'topology') loadTopology();
    if(currentTab === 'wallets') { loadWallets(); loadWalletStatus(); }
    if(currentTab === 'explorer') loadExplorer();
    if(currentTab === 'hiran') loadAiStatus();
    if(currentTab === 'overview') loadMempool();
    if(currentTab === 'controls') { loadMinerPerformance(); loadDepGraph(); }
  } catch(e){
    console.error('Refresh error:', e);
  }
}

function formatUptime(sec){
  if(sec == null || sec === undefined || isNaN(sec)) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if(d > 0) return `${d}d ${h}h ${m}m`;
  if(h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function updateServiceCards(s){
  const n1 = s.node1, n2 = s.node2, p = s.pool, m = s.miner;
  setBadge('badge-node1', n1.running); setCardLive('node1', n1.running);
  const n1h = document.getElementById('val-node1-height');
  if(n1h) n1h.textContent = n1.chain_height ?? '—';
  const n1id = document.getElementById('val-node1-id');
  if(n1id) n1id.textContent = n1.node_id ?? '—';
  const n1p = document.getElementById('val-node1-peers');
  if(n1p) n1p.textContent = n1.known_peers ?? '—';
  const n1p2p = document.getElementById('val-node1-p2p');
  if(n1p2p) n1p2p.textContent = n1.p2p_bind ?? '—';
  const n1m = document.getElementById('val-node1-mempool');
  if(n1m) n1m.textContent = n1.mempool_size ?? '—';
  const n1u = document.getElementById('val-node1-uptime');
  if(n1u) n1u.textContent = formatUptime(n1.uptime_seconds);

  setBadge('badge-node2', n2.running); setCardLive('node2', n2.running);
  const n2h = document.getElementById('val-node2-height');
  if(n2h) n2h.textContent = n2.chain_height ?? '—';
  const n2id = document.getElementById('val-node2-id');
  if(n2id) n2id.textContent = n2.node_id ?? '—';
  const n2p = document.getElementById('val-node2-peers');
  if(n2p) n2p.textContent = n2.known_peers ?? '—';
  const synced = n2.chain_height && n1.chain_height && n2.chain_height >= n1.chain_height - 1;
  const syncEl = document.getElementById('val-node2-sync');
  if(syncEl){
    syncEl.textContent = synced ? '✓ Synced' : (n2.known_peers > 0 ? 'Syncing…' : 'No peers');
    syncEl.className = synced ? 'text-emerald-400 font-bold' : 'text-amber-400';
  }
  const n2m = document.getElementById('val-node2-mempool');
  if(n2m) n2m.textContent = n2.mempool_size ?? '—';
  const n2u = document.getElementById('val-node2-uptime');
  if(n2u) n2u.textContent = formatUptime(n2.uptime_seconds);

  setBadge('badge-pool', p.running); setCardLive('pool', p.running);
  const ps = document.getElementById('val-pool-sessions');
  if(ps) ps.textContent = p.active_sessions ?? '0';
  const pb = document.getElementById('val-pool-blocks');
  if(pb) pb.textContent = p.blocks_found ?? '0';
  const psh = document.getElementById('val-pool-shares');
  if(psh) psh.textContent = (p.shares_accepted ?? 0) + ' / ' + (p.shares_rejected ?? 0);
  const pf = document.getElementById('val-pool-fee');
  if(pf) pf.textContent = p.fee_split ? 'Split: ' + p.fee_split : '—';

  const pe = s.pool_edge ?? {};
  const poolEdgeBadge = document.getElementById('badge-pool-edge');
  const poolEdgeStatus = document.getElementById('val-pool-edge-status');
  if(poolEdgeBadge) setBadge('badge-pool-edge', pe.running);
  if(poolEdgeStatus){
    setCardLive('pool-edge', pe.running);
    poolEdgeStatus.textContent = pe.running ? '✓ Online' : '✗ Offline';
    poolEdgeStatus.className = 'text-3xl font-bold mb-1 ' + (pe.running ? 'text-emerald-400' : 'text-red-400');
    const hostEl = document.getElementById('val-pool-edge-host');
    const portEl = document.getElementById('val-pool-edge-port');
    const detailEl = document.getElementById('val-pool-edge-detail');
    if(hostEl) hostEl.textContent = pe.host ?? '—';
    if(portEl) portEl.textContent = pe.ports_open?.[0]?.split(':')[1] ?? '8444';
    if(detailEl) detailEl.textContent = pe.running ? 'Tailscale + Public ready' : 'Unreachable';
  }
  // Extended Edge Pool details
  const peMiners = document.getElementById('val-pool-edge-miners');
  if(peMiners) peMiners.textContent = pe.active_miners ?? '—';
  const peHash = document.getElementById('val-pool-edge-hashrate');
  if(peHash) peHash.textContent = pe.hashrate ? pe.hashrate.toFixed(2) + ' KH/s' : '—';
  const peBlocks = document.getElementById('val-pool-edge-blocks');
  if(peBlocks) peBlocks.textContent = pe.blocks_found ?? '—';
  const pePorts = document.getElementById('val-pool-edge-ports');
  if(pePorts){
    const ports = pe.ports_open || [];
    pePorts.innerHTML = ports.length
      ? ports.map(p => `<span class="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">${escapeHtml(p)}</span>`).join('')
      : '<span class="text-[10px] text-gray-500">No open ports detected</span>';
  }

  setBadge('badge-miner', m.running && m.hashrate); setCardLive('miner', m.running && m.hashrate);
  const mh = document.getElementById('val-miner-hashrate');
  if(mh) mh.textContent = m.hashrate ? m.hashrate.toFixed(2) : '—';
  const mg = document.getElementById('val-miner-gpu');
  if(mg) mg.textContent = (m.gpu_backend ? m.gpu_backend + ': ' : '') + (m.gpu_device ?? '—');
  const mb = document.getElementById('val-miner-backend');
  if(mb) mb.textContent = m.gpu_backend ?? 'cpu';
  const mnh = document.getElementById('val-miner-height');
  if(mnh) mnh.textContent = m.current_height ?? '—';
  const md = document.getElementById('val-miner-diff');
  if(md) md.textContent = m.current_diff ?? '—';
  const mso = document.getElementById('val-miner-shares-ok');
  if(mso) mso.textContent = m.shares_accepted ?? '—';
  const msr = document.getElementById('val-miner-shares-rej');
  if(msr) msr.textContent = m.shares_rejected ?? '—';
  const mp = document.getElementById('val-miner-pool');
  if(mp) mp.textContent = m.pool_addr ?? '—';
  // Status message
  const msgEl = document.getElementById('miner-status-msg');
  if(msgEl){
    if(!m.running){
      msgEl.textContent = '⚠️ Miner not running. Configure pool address and start miner.';
      msgEl.className = 'text-xs p-2 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30';
      msgEl.classList.remove('hidden');
    } else if(m.running && !m.hashrate){
      msgEl.textContent = '⚠️ Miner connected but no hashrate. Check pool connectivity (' + (m.pool_addr ?? 'unknown') + ') and GPU init.';
      msgEl.className = 'text-xs p-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30';
      msgEl.classList.remove('hidden');
    } else {
      msgEl.classList.add('hidden');
    }
  }
}

function updatePayouts(p){
  const pw = document.getElementById('payout-wallet');
  if(pw) pw.textContent = p.pool_wallet ?? '—';
  const en = document.getElementById('payout-enabled');
  if(en){
    en.textContent = p.payout_enabled === true ? 'YES' : (p.payout_enabled === false ? 'NO' : '—');
    en.className = p.payout_enabled ? 'font-bold text-emerald-400' : 'font-bold text-red-400';
  }
  const pb = document.getElementById('payout-blocks');
  if(pb) pb.textContent = p.blocks_found ?? '0';
  const pn = document.getElementById('payout-nonce');
  if(pn) pn.textContent = p.nonce_count ?? '—';
  const ps = document.getElementById('payout-split');
  if(ps) ps.textContent = p.fee_split ?? '—';
  const pr = document.getElementById('payout-recent');
  if(pr){
    pr.innerHTML = (p.recent_payouts && p.recent_payouts.length)
      ? p.recent_payouts.map(l => '<div class="truncate text-[10px]">' + escapeHtml(l) + '</div>').join('')
      : '<div class="text-gray-600 italic text-[10px]">No payout events yet</div>';
  }
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

function updateResourceBars(res){
  const ramEl = document.getElementById('res-ram-bar');
  const ramText = document.getElementById('res-ram-text');
  if(ramEl && res.ram_percent !== undefined){
    ramEl.style.width = Math.min(res.ram_percent, 100) + '%';
    ramEl.className = 'h-full rounded-full transition-all ' + (res.ram_percent > 90 ? 'bg-red-500' : res.ram_percent > 70 ? 'bg-amber-500' : 'bg-emerald-500');
    if(ramText) ramText.textContent = Math.round(res.ram_percent) + '% · ' + res.ram_used_gb + '/' + res.ram_total_gb + ' GB';
  }
  const diskEl = document.getElementById('res-disk-bar');
  const diskText = document.getElementById('res-disk-text');
  if(diskEl && res.disk_percent !== undefined){
    diskEl.style.width = Math.min(res.disk_percent, 100) + '%';
    diskEl.className = 'h-full rounded-full transition-all ' + (res.disk_percent > 90 ? 'bg-red-500' : res.disk_percent > 70 ? 'bg-amber-500' : 'bg-emerald-500');
    if(diskText) diskText.textContent = Math.round(res.disk_percent) + '% · ' + res.disk_used_gb + '/' + res.disk_total_gb + ' GB';
  }
}

async function loadAlertHistory(){
  try {
    const res = await fetch('/api/alerts/history').then(r => r.json());
    const c = document.getElementById('alert-history-list');
    if(!c) return;
    if(!res.alerts || !res.alerts.length){
      c.innerHTML = '<div class="text-gray-500 italic text-sm">No alerts recorded yet.</div>';
      return;
    }
    const icons = { critical: '🚨', warning: '⚠️', info: 'ℹ️', success: '✅' };
    c.innerHTML = res.alerts.slice().reverse().map(a => `
      <div class="flex items-start gap-2 p-2 rounded-lg border border-white/5 ${a.severity === 'critical' ? 'bg-red-500/10' : a.severity === 'warning' ? 'bg-amber-500/10' : a.severity === 'success' ? 'bg-emerald-500/10' : 'bg-white/5'}">
        <span class="text-lg">${icons[a.severity] || 'ℹ️'}</span>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-semibold">${escapeHtml(a.title)}</div>
          <div class="text-[10px] opacity-70 truncate">${escapeHtml(a.detail || '')}</div>
          <div class="text-[10px] text-gray-500 mt-0.5">${new Date(a.ts).toLocaleTimeString()}</div>
        </div>
      </div>`).join('');
  } catch(e) {
    console.error('loadAlertHistory error:', e);
  }
}

async function toggleWatchdog(){
  try {
    const res = await fetch('/api/watchdog/toggle', {method: 'POST'}).then(r => r.json());
    toast('Watchdog ' + (res.enabled ? 'enabled' : 'disabled'), res.enabled ? 'success' : 'warning');
    const btn = document.getElementById('watchdog-toggle-btn');
    if(btn) btn.textContent = res.enabled ? '🛡️ Watchdog ON' : '⚪ Watchdog OFF';
  } catch(e) {
    toast('Failed to toggle watchdog: ' + e.message, 'error');
  }
}

async function rotateLogsNow(){
  try {
    const res = await fetch('/api/logs/rotate', {method: 'POST'}).then(r => r.json());
    toast(res.ok ? 'Logs rotated successfully' : ('Rotation failed: ' + res.error), res.ok ? 'success' : 'error');
  } catch(e) {
    toast('Failed to rotate logs: ' + e.message, 'error');
  }
}

// ── Dependency-Aware Stack Launch ──
let launchPollTimer = null;

async function startDependencyLaunch(mode){
  const panel = document.getElementById('launch-progress-panel');
  if(panel) panel.classList.remove('hidden');
  updateLaunchProgress({running: true, progress_pct: 0, current_step: 'Initiating…', results: []});
  try {
    const res = await fetch('/api/launch/' + mode, {method: 'POST'}).then(r => r.json());
    if(!res.ok){
      toast('Launch failed: ' + (res.error || 'unknown'), 'error');
      updateLaunchProgress({running: false, error: res.error, current_step: res.error});
      return;
    }
    toast(res.message, 'success');
    // Start polling
    if(launchPollTimer) clearInterval(launchPollTimer);
    launchPollTimer = setInterval(pollLaunchStatus, 1000);
  } catch(e) {
    toast('Launch error: ' + e.message, 'error');
    updateLaunchProgress({running: false, error: e.message, current_step: e.message});
  }
}

async function pollLaunchStatus(){
  try {
    const st = await fetch('/api/launch/status').then(r => r.json());
    updateLaunchProgress(st);
    if(!st.running){
      clearInterval(launchPollTimer);
      launchPollTimer = null;
      if(!st.error) toast('Stack launch complete', 'success');
    }
  } catch(e) {
    console.error('pollLaunchStatus error:', e);
  }
}

function updateLaunchProgress(st){
  const bar = document.getElementById('launch-progress-bar');
  const pct = document.getElementById('launch-progress-pct');
  const step = document.getElementById('launch-progress-step');
  const results = document.getElementById('launch-progress-results');
  if(bar) bar.style.width = (st.progress_pct || 0) + '%';
  if(pct) pct.textContent = (st.progress_pct || 0) + '%';
  if(step) step.textContent = st.current_step || 'Waiting…';
  if(results && st.results){
    results.innerHTML = st.results.map(r =>
      `<div class="text-[10px] ${r.ok ? 'text-emerald-400' : 'text-red-400'}">` +
      `${r.ok ? '✓' : '✗'} ${escapeHtml(r.sid)}` +
      (r.pid ? ` <span class="text-gray-500">PID=${r.pid}</span>` : '') +
      (r.error ? ` <span class="text-red-300">${escapeHtml(r.error)}</span>` : '') +
      `</div>`
    ).join('');
  }
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
// Wallets tab
// ─────────────────────────────────────────────────────────────────────

async function loadWallets(){
  try {
    const data = await fetch('/api/wallets').then(r => r.json());
    const wallets = data.wallets || [];
    const summary = data.summary || {};
    const rpc = data.rpc || {};

    const stats = document.getElementById('wallets-stats');
    if(stats){
      stats.innerHTML = `
        <div class="zion-panel-soft p-3 text-center">
          <div class="text-lg font-bold text-gradient">${wallets.length}</div>
          <div class="text-[10px] text-gray-400">Total Wallets</div>
        </div>
        <div class="zion-panel-soft p-3 text-center">
          <div class="text-lg font-bold text-zion-gold">${summary.premine_wallets || 0}</div>
          <div class="text-[10px] text-gray-400">Premine</div>
        </div>
        <div class="zion-panel-soft p-3 text-center">
          <div class="text-lg font-bold text-zion-cyan">${summary.operational_wallets || 0}</div>
          <div class="text-[10px] text-gray-400">Operational</div>
        </div>
        <div class="zion-panel-soft p-3 text-center">
          <div class="text-lg font-bold text-emerald-400">${summary.with_live_balance || 0}</div>
          <div class="text-[10px] text-gray-400">Live Balance</div>
        </div>
      `;
    }

    const tbody = document.getElementById('wallets-table');
    if(!tbody) return;
    if(!wallets.length){
      tbody.innerHTML = '<tr><td colspan="7" class="py-4 text-gray-500 italic text-center">No wallets found. Set environment variables or start the node.</td></tr>';
    } else {
      tbody.innerHTML = wallets.map((w, i) => {
        const idx = w.index || (i + 1);
        const addr = escapeHtml(w.address || '');
        const shortAddr = addr.length > 36 ? addr.slice(0, 18) + '…' + addr.slice(-12) : addr;
        const label = escapeHtml(w.label || '');
        const sourceBadge = w.source === 'premine'
          ? '<span class="px-1.5 py-0.5 rounded bg-zion-gold/20 text-zion-gold text-[10px]">premine</span>'
          : '<span class="px-1.5 py-0.5 rounded bg-zion-cyan/20 text-zion-cyan text-[10px]">' + escapeHtml(w.source || 'env') + '</span>';
        const catBadge = w.category === 'premine'
          ? '<span class="text-zion-gold">premine</span>'
          : '<span class="text-zion-cyan">operational</span>';
        const premineAmt = w.amount_zion ? fmtNum(w.amount_zion) + ' ZION' : '—';
        const bal = w.balance_zion !== null && w.balance_zion !== undefined
          ? (typeof w.balance_zion === 'number' ? w.balance_zion.toFixed(6) + ' ZION' : w.balance_zion)
          : (w.rpc_ok === false ? '<span class="text-gray-600">unavailable</span>' : '—');
        const balClass = w.balance_zion !== null && w.balance_zion !== undefined ? 'text-emerald-400 font-bold' : 'text-gray-500';
        return `<tr class="border-b border-white/5 hover:bg-white/3 transition">
          <td class="py-2 px-3 text-gray-500">${idx}</td>
          <td class="py-2 px-3 font-semibold text-white">${label}</td>
          <td class="py-2 px-3">
            <span class="text-gray-300" title="${addr}">${shortAddr}</span>
            <button onclick="copyToClipboard('${addr}')" class="ml-1 text-[10px] text-zion-gold hover:underline">copy</button>
          </td>
          <td class="py-2 px-3">${sourceBadge}</td>
          <td class="py-2 px-3">${catBadge}</td>
          <td class="py-2 px-3 text-right text-zion-gold">${premineAmt}</td>
          <td class="py-2 px-3 text-right ${balClass}">${bal}</td>
        </tr>`;
      }).join('');
    }

    const rpcStatus = document.getElementById('wallets-rpc-status');
    if(rpcStatus){
      rpcStatus.innerHTML = rpc.reachable
        ? `✓ Live balances from Node RPC at ${escapeHtml(rpc.host)}:${rpc.port}`
        : `○ Node RPC unreachable at ${escapeHtml(rpc.host)}:${rpc.port} — balances unavailable. Start node to enable live lookup.`;
    }

    // Category breakdown
    const cats = data.category_summary || {};
    const catDisplay = document.getElementById('wallets-categories');
    if(catDisplay){
      const catMeta = {
        oasis: { label: '🌸 OASIS', color: 'text-zion-gold', bg: 'bg-zion-gold/10' },
        dao:   { label: '🗳️ DAO Treasury', color: 'text-zion-purple', bg: 'bg-zion-purple/10' },
        infrastructure: { label: '🏗️ Infrastructure', color: 'text-zion-cyan', bg: 'bg-zion-cyan/10' },
        humanitarian: { label: '💝 Humanitarian', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      };
      catDisplay.innerHTML = Object.entries(cats).map(([key, val]) => {
        const meta = catMeta[key] || { label: key, color: 'text-gray-300', bg: 'bg-white/5' };
        const pct = summary.total_premine_zion ? ((val.total_zion / summary.total_premine_zion) * 100).toFixed(1) : 0;
        return `
          <div class="zion-panel-soft p-3 ${meta.bg}">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-semibold ${meta.color}">${meta.label}</span>
              <span class="text-[10px] text-gray-400">${val.count} wallets</span>
            </div>
            <div class="text-lg font-bold ${meta.color}">${fmtNum(val.total_zion)} ZION</div>
            <div class="text-[10px] text-gray-500">${pct}% of premine</div>
          </div>
        `;
      }).join('');
    }

    const catBars = document.getElementById('wallets-category-bars');
    if(catBars && summary.total_premine_zion){
      const catMeta = {
        oasis: { label: '🌸 OASIS + Winners', color: '#ffd700' },
        dao:   { label: '🗳️ DAO Treasury', color: '#9333ea' },
        infrastructure: { label: '🏗️ Infrastructure', color: '#06b6d4' },
        humanitarian: { label: '💝 Humanitarian', color: '#10b981' },
      };
      catBars.innerHTML = Object.entries(cats).map(([key, val]) => {
        const meta = catMeta[key] || { label: key, color: '#9ca3af' };
        const pct = ((val.total_zion / summary.total_premine_zion) * 100).toFixed(1);
        return `
          <div class="flex items-center gap-3">
            <div class="w-32 text-xs text-gray-400 text-right">${meta.label}</div>
            <div class="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500" style="width:${pct}%;background:${meta.color};"></div>
            </div>
            <div class="w-24 text-xs font-mono text-right">${fmtNum(val.total_zion)} ZION</div>
            <div class="w-10 text-[10px] text-gray-500">${pct}%</div>
          </div>
        `;
      }).join('');
    }
  } catch(e){
    console.error('Wallets load error:', e);
    const tbody = document.getElementById('wallets-table');
    if(tbody) tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-red-400 text-center">Failed to load wallets: ${escapeHtml(e.message)}</td></tr>`;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Explorer tab
// ─────────────────────────────────────────────────────────────────────

async function loadExplorer(){
  try {
    const data = await fetch('/api/explorer').then(r => r.json());

    const badge = document.getElementById('explorer-rpc-badge');
    if(badge){
      if(data.rpc_reachable){
        badge.className = 'text-xs px-2.5 py-1 rounded-full bg-emerald-700 text-emerald-300';
        badge.textContent = '● RPC Connected';
      } else {
        badge.className = 'text-xs px-2.5 py-1 rounded-full bg-red-700 text-red-300';
        badge.textContent = '⛔ Node Unreachable';
      }
    }

    document.getElementById('exp-height').textContent = data.chain_height ?? '—';
    document.getElementById('exp-blocks').textContent = data.accepted_blocks ?? '—';
    document.getElementById('exp-mempool').textContent = data.mempool_size ?? '—';
    document.getElementById('exp-reward').textContent = data.block_reward_zion ? data.block_reward_zion.toFixed(3) + ' ZION' : '—';
    document.getElementById('exp-tip').textContent = data.tip_hash ?? '—';
    document.getElementById('exp-genesis').textContent = data.genesis_hash ?? '—';
    document.getElementById('exp-circulating').textContent = data.estimated_circulating_zion ? fmtNum(data.estimated_circulating_zion) + ' ZION' : '—';
    document.getElementById('exp-total').textContent = data.total_supply_zion ? fmtNum(data.total_supply_zion) + ' ZION' : '—';
    document.getElementById('exp-premine').textContent = data.premine_zion ? fmtNum(data.premine_zion) + ' ZION' : '—';

    const tbody = document.getElementById('explorer-blocks');
    if(tbody){
      if(!data.recent_blocks || !data.recent_blocks.length){
        tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-gray-500 italic text-center">No blocks available. Start the node to see recent blocks.</td></tr>';
      } else {
        tbody.innerHTML = data.recent_blocks.slice().reverse().map(b => `
          <tr class="border-b border-white/5 hover:bg-white/3 transition cursor-pointer" onclick="openBlockModal(${b.height})" title="Click for block detail">
            <td class="py-2 px-3 font-bold text-white">#${b.height}</td>
            <td class="py-2 px-3 text-gray-300 truncate" title="${escapeHtml(b.hash || '')}">${escapeHtml(b.hash || '—')}</td>
            <td class="py-2 px-3 text-gray-400">${b.timestamp ? new Date(b.timestamp * 1000).toLocaleString() : '—'}</td>
            <td class="py-2 px-3 text-right text-gray-300">${b.tx_count ?? 0}</td>
            <td class="py-2 px-3 text-right text-gray-400">${b.difficulty ? b.difficulty.toLocaleString() : '—'}</td>
          </tr>
        `).join('');
      }
    }
  } catch(e){
    console.error('Explorer load error:', e);
    const badge = document.getElementById('explorer-rpc-badge');
    if(badge){ badge.className = 'text-xs px-2.5 py-1 rounded-full bg-red-700 text-red-300'; badge.textContent = '⛔ Error'; }
  }
}

// ── Ops tab (Backup / CLI / Alerts) ───────────────────────────────────

async function loadOps(){
  try {
    const b = await fetch('/api/backup/status').then(r => r.json());
    document.getElementById('ops-last-backup').textContent = b.last_backup ? new Date(b.last_backup).toLocaleString() : 'Never';
    document.getElementById('ops-total-backups').textContent = b.backups?.length ?? 0;
    document.getElementById('ops-backup-size').textContent = b.total_backup_mb ? b.total_backup_mb.toFixed(1) + ' MB' : '—';
    document.getElementById('ops-datadir-n1').textContent = b.datadir_mb?.node1 != null ? b.datadir_mb.node1.toFixed(0) + ' MB' : '—';
    document.getElementById('ops-datadir-n2').textContent = b.datadir_mb?.node2 != null ? b.datadir_mb.node2.toFixed(0) + ' MB' : '—';
    document.getElementById('ops-datadir-pool').textContent = b.datadir_mb?.pool != null ? b.datadir_mb.pool.toFixed(0) + ' MB' : '—';
  } catch(e) { console.error('loadOps backup error:', e); }
  // Load alert config once (lazy)
  if(!window._alertCfgLoaded){
    try {
      const cfg = await fetch('/api/alerts/config').then(r => r.json());
      const wh = document.getElementById('alert-webhook');
      const sl = document.getElementById('alert-slack');
      const em = document.getElementById('alert-email');
      const en = document.getElementById('alert-enabled');
      if(wh) wh.value = cfg.webhook_url || '';
      if(sl) sl.value = cfg.slack_webhook || '';
      if(em) em.value = cfg.email || '';
      if(en) en.checked = !!cfg.enabled;
      window._alertCfgLoaded = true;
    } catch(e) { console.error('loadOps alert cfg error:', e); }
  }
}

async function triggerBackup(){
  const log = document.getElementById('ops-backup-log');
  if(log) log.textContent = 'Running backup…';
  try {
    const res = await fetch('/api/backup/trigger', {method: 'POST'}).then(r => r.json());
    if(log) log.textContent = (res.ok ? '✓ ' : '✗ ') + (res.output || res.error || 'Done');
    toast(res.ok ? 'Backup triggered' : 'Backup failed', res.ok ? 'success' : 'error');
    loadOps();
  } catch(e) {
    if(log) log.textContent = 'Error: ' + e.message;
    toast('Backup error: ' + e.message, 'error');
  }
}

async function verifyBackup(){
  const log = document.getElementById('ops-backup-log');
  if(log) log.textContent = 'Verifying chain…';
  try {
    const res = await fetch('/api/backup/verify').then(r => r.json());
    const out = res.log?.slice(-10).join('\n') || res.result?.output || 'Done';
    if(log) log.textContent = out;
  } catch(e) { if(log) log.textContent = 'Error: ' + e.message; }
}

async function runCliCommand(){
  const input = document.getElementById('cli-input');
  const out = document.getElementById('cli-output');
  const cmd = input.value.trim();
  if(!cmd) return;
  out.textContent = 'Running: zion-cli ' + cmd + '\n…';
  try {
    const res = await fetch('/api/cli/run', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({cmd})}).then(r => r.json());
    if(res.stdout !== undefined || res.stderr !== undefined){
      out.textContent = (res.stdout || '') + (res.stderr ? '\n[stderr]\n' + res.stderr : '');
    } else if(res.output !== undefined){
      out.textContent = res.output;
    } else {
      out.textContent = JSON.stringify(res, null, 2);
    }
  } catch(e) { out.textContent = 'Error: ' + e.message; }
}

function fillCli(text){ const el = document.getElementById('cli-input'); if(el){ el.value = text; el.focus(); } }

async function saveAlertConfig(){
  const cfg = {
    webhook_url: document.getElementById('alert-webhook')?.value || '',
    slack_webhook: document.getElementById('alert-slack')?.value || '',
    email: document.getElementById('alert-email')?.value || '',
    enabled: document.getElementById('alert-enabled')?.checked || false,
  };
  try {
    const res = await fetch('/api/alerts/config', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(cfg)}).then(r => r.json());
    const st = document.getElementById('alert-config-status');
    if(st) { st.textContent = res.ok ? 'Saved ✓' : 'Error'; st.className = res.ok ? 'text-xs text-emerald-400' : 'text-xs text-red-400'; }
  } catch(e) { toast('Save alert config failed: ' + e.message, 'error'); }
}

// ── Topology tab ──────────────────────────────────────────────────────

async function loadTopology(){
  try {
    const t = await fetch('/api/topology').then(r => r.json());
    const coreDot = document.getElementById('topo-core-dot');
    const edgeDot = document.getElementById('topo-edge-dot');
    if(coreDot) coreDot.className = 'w-3 h-3 rounded-full ' + (t.core.alive ? 'bg-emerald-400' : 'bg-red-500');
    if(edgeDot) edgeDot.className = 'w-3 h-3 rounded-full ' + (t.edge.alive ? 'bg-emerald-400' : 'bg-red-500');
    document.getElementById('topo-core-height').textContent = t.core.height ?? '—';
    document.getElementById('topo-edge-height').textContent = t.edge.height ?? '—';
    const tsIcon = document.getElementById('topo-tailscale-icon');
    const tsStatus = document.getElementById('topo-tailscale-status');
    if(tsIcon) tsIcon.textContent = t.tailscale.vpn_ok ? '🟢' : '🔴';
    if(tsStatus) { tsStatus.textContent = t.tailscale.vpn_ok ? 'Connected' : 'Unreachable'; tsStatus.className = t.tailscale.vpn_ok ? 'text-emerald-400 font-bold' : 'text-red-400'; }
    const portMap = {p2p:'node_p2p', rpc:'node_rpc', pool:'pool_stratum', dash:'dashboard', hiran:'hiran_inference', orch:'hiranyagarbha'};
    for(const [key, apiKey] of Object.entries(portMap)){
      const el = document.getElementById('topo-port-' + key);
      if(el){ el.textContent = t.ports[apiKey] ? 'Open' : 'Closed'; el.className = 'text-xs font-bold ' + (t.ports[apiKey] ? 'text-emerald-400' : 'text-red-400'); }
    }
    // Apps
    const apps = t.apps || {};
    const appMap = [
      ['web', apps.website?.alive],
      ['desktop', apps.desktop_agent?.alive],
      ['mobile', apps.mobile_app?.alive],
      ['cli', apps.cli?.alive],
    ];
    for(const [id, alive] of appMap){
      const dot = document.getElementById('app-' + id + '-dot');
      const badge = document.getElementById('app-' + id + '-badge');
      if(dot) dot.className = 'w-3 h-3 rounded-full ' + (alive ? 'bg-emerald-400' : 'bg-red-500');
      if(badge){ badge.textContent = alive ? 'Online' : 'Offline'; badge.className = 'text-[10px] px-2 py-0.5 rounded ' + (alive ? 'bg-emerald-700 text-emerald-300' : 'bg-red-700 text-red-300'); }
    }
  } catch(e) { console.error('Topology load error:', e); }
}

// ── Wallet extended status (pool wallet / UTXO / payouts) ───────────────

async function loadWalletStatus(){
  try {
    const w = await fetch('/api/wallet/status').then(r => r.json());
    const container = document.getElementById('wallet-pool-status');
    if(!container) return;
    container.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="bg-black/30 rounded-lg p-3"><div class="text-xs text-gray-400">Pool Wallet</div><div class="text-sm font-bold text-white truncate" title="${escapeHtml(w.pool_wallet||'—')}">${escapeHtml(w.pool_wallet ? w.pool_wallet.slice(0,14)+'…' : '—')}</div></div>
        <div class="bg-black/30 rounded-lg p-3"><div class="text-xs text-gray-400">Balance</div><div class="text-sm font-bold text-emerald-400">${w.balance_zion != null ? w.balance_zion.toFixed(4) + ' Z' : '—'}</div></div>
        <div class="bg-black/30 rounded-lg p-3"><div class="text-xs text-gray-400">UTXOs</div><div class="text-sm font-bold text-white">${w.utxo_count ?? '—'}</div></div>
        <div class="bg-black/30 rounded-lg p-3"><div class="text-xs text-gray-400">Blocks Found</div><div class="text-sm font-bold text-amber-400">${w.blocks_found ?? '—'}</div></div>
        <div class="bg-black/30 rounded-lg p-3"><div class="text-xs text-gray-400">Payouts Enabled</div><div class="text-sm font-bold ${w.payout_enabled?'text-emerald-400':'text-red-400'}">${w.payout_enabled?'Yes':'No'}</div></div>
        <div class="bg-black/30 rounded-lg p-3"><div class="text-xs text-gray-400">Fee Split</div><div class="text-sm font-bold text-white">${w.fee_split ?? '—'}</div></div>
        <div class="bg-black/30 rounded-lg p-3"><div class="text-xs text-gray-400">Shares A/R</div><div class="text-sm font-bold text-white">${w.shares_accepted}/${w.shares_rejected}</div></div>
        <div class="bg-black/30 rounded-lg p-3"><div class="text-xs text-gray-400">Last Error</div><div class="text-sm font-bold text-red-400 truncate" title="${escapeHtml(w.last_payout_error||'')}">${w.last_payout_error ? 'Error' : 'None'}</div></div>
      </div>
    `;
  } catch(e) { console.error('loadWalletStatus error:', e); }
}

// ── AI services status ────────────────────────────────────────────────

async function loadAiStatus(){
  try {
    const ai = await fetch('/api/ai/status').then(r => r.json());
    const h = ai.hiran || {};
    const o = ai.hiranyagarbha || {};
    const hBadge = document.getElementById('hiran-badge');
    const oBadge = document.getElementById('hiranyagarbha-badge');
    const hGpu = document.getElementById('hiran-gpu-detail');
    const hGpuBadge = document.getElementById('hiran-gpu-badge');
    const oDetail = document.getElementById('hiranyagarbha-detail');
    const oActive = document.getElementById('orch-active');
    if(hBadge){ hBadge.textContent = h.alive ? 'Online' : 'Offline'; hBadge.className = 'px-2 py-0.5 rounded text-xs font-bold ' + (h.alive ? 'bg-emerald-700 text-emerald-300' : 'bg-red-700 text-red-300'); }
    if(oBadge){ oBadge.textContent = o.alive ? 'Online' : 'Offline'; oBadge.className = 'px-2 py-0.5 rounded text-xs font-bold ' + (o.alive ? 'bg-emerald-700 text-emerald-300' : 'bg-red-700 text-red-300'); }
    if(hGpu) hGpu.textContent = h.backend + (h.vram_mb ? ' (' + h.vram_mb + ' MB)' : '');
    if(hGpuBadge) hGpuBadge.textContent = h.alive ? (h.backend === 'cpu' ? 'CPU' : 'GPU') : '—';
    if(oDetail) oDetail.textContent = o.alive ? 'v' + o.version : '—';
    if(oActive) oActive.textContent = o.agents ?? '—';
    const orchPanel = document.getElementById('orch-stats-panel');
    if(orchPanel) orchPanel.classList.toggle('hidden', !o.alive);
  } catch(e) { console.error('loadAiStatus error:', e); }
}

// ── Mempool Live ──────────────────────────────────────────────────────

async function loadMempool(){
  try {
    const mp = await fetch('/api/mempool').then(r => r.json());
    const badge = document.getElementById('mempool-badge');
    if(badge){ badge.textContent = mp.rpc_reachable ? 'Live' : 'RPC Unreachable'; badge.className = 'text-xs px-2 py-0.5 rounded-full ' + (mp.rpc_reachable ? 'bg-emerald-700 text-emerald-300' : 'bg-red-700 text-red-300'); }
    document.getElementById('mempool-tx-count').textContent = mp.tx_count ?? '—';
    document.getElementById('mempool-template-count').textContent = mp.template_tx_count ?? '—';
    document.getElementById('mempool-total-fees').textContent = mp.total_fees_zion != null ? mp.total_fees_zion.toFixed(4) + ' Z' : '—';
    const tbody = document.getElementById('mempool-tx-table');
    if(tbody){
      if(!mp.transactions || !mp.transactions.length){
        tbody.innerHTML = '<tr><td colspan="5" class="py-2 text-gray-500 italic text-center">No pending transactions</td></tr>';
      } else {
        tbody.innerHTML = mp.transactions.map(tx => `
          <tr class="border-b border-white/5 hover:bg-white/3">
            <td class="py-1 px-2 text-gray-300 truncate max-w-[120px]" title="${escapeHtml(tx.tx_id)}">${escapeHtml(tx.tx_id.slice(0,12))}…</td>
            <td class="py-1 px-2 text-gray-400 truncate max-w-[100px]">${escapeHtml(tx.from?.slice(0,10)||'—')}…</td>
            <td class="py-1 px-2 text-gray-400 truncate max-w-[100px]">${escapeHtml(tx.to?.slice(0,10)||'—')}…</td>
            <td class="py-1 px-2 text-right text-emerald-300">${tx.amount_zion ? tx.amount_zion.toFixed(4) : '—'}</td>
            <td class="py-1 px-2 text-right text-gray-400">${tx.fee_zion != null ? tx.fee_zion.toFixed(6) : '—'}</td>
          </tr>
        `).join('');
      }
    }
  } catch(e) { console.error('loadMempool error:', e); }
}

// ── Miner Performance (shares trend + session stats) ────────────────────

async function loadMinerPerformance(){
  try {
    const hist = await fetch('/api/miner/shares').then(r => r.json());
    const samples = hist.samples || [];
    // Update session stats from most recent log tail
    const recent = samples.length ? samples[samples.length-1] : null;
    if(recent){
      document.getElementById('perf-accepted').textContent = recent.accepted ?? '—';
      document.getElementById('perf-rejected').textContent = recent.rejected ?? '—';
    }
    // Parse extra session stats from latest miner log line
    const logLines = await fetch('/api/logs/miner').then(r => r.json()).catch(() => ({lines:[]}));
    const lines = logLines.lines || [];
    let sessionLine = '';
    for(let i=lines.length-1; i>=0; i--){ if(lines[i].includes('session_status')){ sessionLine = lines[i]; break; } }
    if(sessionLine){
      const mIter = sessionLine.match(/iter=(\d+)/); if(mIter) document.getElementById('perf-iterations').textContent = mIter[1];
      const mBest = sessionLine.match(/best_batch_ms=(\d+)/); if(mBest) document.getElementById('perf-best-batch').textContent = mBest[1] + 'ms';
      const mGpu = sessionLine.match(/gpu_hps=(\d+\.?\d*)/); if(mGpu) document.getElementById('perf-gpu-hps').textContent = (parseFloat(mGpu[1])/1000).toFixed(2) + ' KH/s';
      const mEpoch = sessionLine.match(/epoch=(\d+)/); if(mEpoch) document.getElementById('perf-epoch').textContent = mEpoch[1];
    }
    // Render shares trend chart
    const ctx = document.getElementById('miner-shares-chart');
    if(ctx && typeof Chart !== 'undefined'){
      const labels = samples.map((_,i) => '');
      const accepted = samples.map(s => s.accepted);
      const rejected = samples.map(s => s.rejected);
      if(!window._sharesChart){
        window._sharesChart = new Chart(ctx.getContext('2d'), {
          type: 'line',
          data: { labels, datasets: [
            { label: 'Accepted', data: accepted, borderColor: 'rgb(16,185,129)', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
            { label: 'Rejected', data: rejected, borderColor: 'rgb(239,68,68)', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
          ]},
          options: { responsive: true, plugins: { legend: { display: true, labels: { color: '#cbd5e1', font: { size: 10 } } } }, scales: { x: { display: false }, y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } } }, animation: { duration: 300 } }
        });
      } else {
        window._sharesChart.data.labels = labels;
        window._sharesChart.data.datasets[0].data = accepted;
        window._sharesChart.data.datasets[1].data = rejected;
        window._sharesChart.update('none');
      }
    }
  } catch(e) { console.error('loadMinerPerformance error:', e); }
}

// ── Dependency Graph ──────────────────────────────────────────────────

async function loadDepGraph(){
  try {
    const g = await fetch('/api/dependency-graph').then(r => r.json());
    const container = document.getElementById('dep-graph-viz');
    if(!container) return;
    let html = '';
    // Simple flow layout: rows by level
    const levels = {};
    for(const n of g.nodes){
      const lv = n.level || 'L?';
      if(!levels[lv]) levels[lv] = [];
      levels[lv].push(n);
    }
    for(const lv of Object.keys(levels).sort()){
      html += '<div class="flex items-center gap-2 flex-wrap mb-2">';
      html += '<span class="text-[10px] text-gray-500 w-8">' + lv + '</span>';
      for(const n of levels[lv]){
        const color = n.alive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-red-500/20 text-red-300 border-red-500/40';
        html += '<span class="text-xs px-2 py-1 rounded border ' + color + ' cursor-default" title="' + n.id + '">' + n.icon + ' ' + n.name + '</span>';
      }
      html += '</div>';
    }
    // Edges summary
    html += '<div class="text-[10px] text-gray-500 mt-2">' + g.edges.length + ' dependencies</div>';
    container.innerHTML = html;
  } catch(e) { console.error('loadDepGraph error:', e); }
}

// ── Block Detail Modal ──────────────────────────────────────────────

async function openBlockModal(height){
  try {
    const b = await fetch('/api/block?height=' + encodeURIComponent(height)).then(r => r.json());
    const content = document.getElementById('block-modal-content');
    if(!b.found){
      content.innerHTML = '<div class="text-red-400">Block not found: ' + escapeHtml(b.error || '') + '</div>';
    } else {
      const ts = b.timestamp ? new Date(b.timestamp * 1000).toLocaleString() : '—';
      content.innerHTML = `
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="bg-black/30 rounded-lg p-3"><div class="text-gray-400">Height</div><div class="text-lg font-bold text-white">#${b.height}</div></div>
          <div class="bg-black/30 rounded-lg p-3"><div class="text-gray-400">Timestamp</div><div class="text-sm font-bold text-white">${ts}</div></div>
          <div class="bg-black/30 rounded-lg p-3 col-span-2"><div class="text-gray-400">Hash</div><div class="text-sm font-mono text-zion-gold break-all">${escapeHtml(b.hash)}</div></div>
          <div class="bg-black/30 rounded-lg p-3"><div class="text-gray-400">Miner</div><div class="text-sm font-mono text-white truncate">${escapeHtml(b.miner)}</div></div>
          <div class="bg-black/30 rounded-lg p-3"><div class="text-gray-400">Difficulty</div><div class="text-sm font-bold text-white">${b.difficulty != null ? b.difficulty.toLocaleString() : '—'}</div></div>
          <div class="bg-black/30 rounded-lg p-3"><div class="text-gray-400">Reward</div><div class="text-sm font-bold text-emerald-400">${b.reward_zion != null ? b.reward_zion.toFixed(4) + ' Z' : '—'}</div></div>
          <div class="bg-black/30 rounded-lg p-3"><div class="text-gray-400">Total Fees</div><div class="text-sm font-bold text-amber-400">${b.total_fees_zion != null ? b.total_fees_zion.toFixed(4) + ' Z' : '—'}</div></div>
          <div class="bg-black/30 rounded-lg p-3"><div class="text-gray-400">Nonce</div><div class="text-sm font-mono text-white">${b.nonce ?? '—'}</div></div>
          <div class="bg-black/30 rounded-lg p-3"><div class="text-gray-400">TX Count</div><div class="text-sm font-bold text-white">${b.tx_count ?? 0}</div></div>
          <div class="bg-black/30 rounded-lg p-3 col-span-2"><div class="text-gray-400">Prev Hash</div><div class="text-sm font-mono text-gray-300 break-all">${escapeHtml(b.prev_hash)}</div></div>
        </div>
        ${b.transactions && b.transactions.length ? `
          <div class="mt-3"><div class="text-xs text-gray-400 mb-1">Transactions</div>
          <div class="overflow-x-auto max-h-48 overflow-y-auto">
            <table class="w-full text-left text-xs">
              <thead><tr class="text-gray-400 border-b border-white/10"><th class="py-1 px-2">ID</th><th class="py-1 px-2">Type</th><th class="py-1 px-2">From</th><th class="py-1 px-2">To</th><th class="py-1 px-2 text-right">Amount</th><th class="py-1 px-2 text-right">Fee</th></tr></thead>
              <tbody class="font-mono">${b.transactions.map(tx => `
                <tr class="border-b border-white/5 hover:bg-white/3">
                  <td class="py-1 px-2 text-gray-300 truncate max-w-[120px]" title="${escapeHtml(tx.tx_id)}">${escapeHtml(tx.tx_id.slice(0,12))}…</td>
                  <td class="py-1 px-2 text-gray-400">${escapeHtml(tx.type)}</td>
                  <td class="py-1 px-2 text-gray-400 truncate max-w-[100px]">${escapeHtml(tx.from?.slice(0,10)||'—')}…</td>
                  <td class="py-1 px-2 text-gray-400 truncate max-w-[100px]">${escapeHtml(tx.to?.slice(0,10)||'—')}…</td>
                  <td class="py-1 px-2 text-right text-emerald-300">${tx.amount_zion != null ? tx.amount_zion.toFixed(4) : '—'}</td>
                  <td class="py-1 px-2 text-right text-gray-400">${tx.fee_zion != null ? tx.fee_zion.toFixed(6) : '—'}</td>
                </tr>
              `).join('')}</tbody>
            </table>
          </div></div>
        ` : ''}
      `;
    }
    document.getElementById('block-modal').classList.remove('hidden');
    document.getElementById('block-modal').classList.add('flex');
  } catch(e) { console.error('openBlockModal error:', e); }
}

function closeBlockModal(){
  const el = document.getElementById('block-modal');
  if(el){ el.classList.add('hidden'); el.classList.remove('flex'); }
}

// ── Keyboard Shortcuts ────────────────────────────────────────────────

document.addEventListener('keydown', function(e){
  if(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
  const map = {
    '1': 'overview', '2': 'l1', '3': 'l2', '4': 'l3', '5': 'l4', '6': 'l5', '7': 'l6',
    'o': 'overview', 'c': 'controls', 'e': 'explorer', 'w': 'wallets', 'a': 'alerts',
    't': 'topology', 'p': 'ops', 'h': 'hiran', 'g': 'charts',
  };
  const key = e.key.toLowerCase();
  if(map[key] && !e.ctrlKey && !e.altKey && !e.metaKey){
    switchTab(map[key]);
    e.preventDefault();
  }
  if(key === 'r' && !e.ctrlKey && !e.altKey && !e.metaKey){
    refreshAll();
    toast('Refreshed', 'info');
    e.preventDefault();
  }
  if(key === ' ' && !e.ctrlKey && !e.altKey && !e.metaKey){
    toggleAutoRefresh();
    e.preventDefault();
  }
  if(key === 's' && !e.ctrlKey && !e.altKey && !e.metaKey){
    openSettingsModal();
    e.preventDefault();
  }
});

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
      'start-miner-gpu': '🎮', 'start-miner-cpu': '💻', 'stop-miner': '⏹',
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

// ── Miner config helpers ──
function saveMinerConfig(){
  const cfg = {
    pool: document.getElementById('miner-cfg-pool')?.value || '127.0.0.1:8444',
    worker: document.getElementById('miner-cfg-worker')?.value || 'worker1',
    backend: document.getElementById('miner-cfg-backend')?.value || 'gpu-opencl',
    threads: document.getElementById('miner-cfg-threads')?.value || '4',
    workSize: document.getElementById('miner-cfg-worksize')?.value || '4096',
    loops: document.getElementById('miner-cfg-loops')?.value || '1000000',
    hiranLayers: document.getElementById('miner-cfg-hiran-layers')?.value || '33',
  };
  try { localStorage.setItem('zion-miner-cfg', JSON.stringify(cfg)); } catch(e) {}
  return cfg;
}

function loadMinerConfig(){
  try {
    const cfg = JSON.parse(localStorage.getItem('zion-miner-cfg') || '{}');
    if(cfg.pool) document.getElementById('miner-cfg-pool').value = cfg.pool;
    if(cfg.worker) document.getElementById('miner-cfg-worker').value = cfg.worker;
    if(cfg.backend) document.getElementById('miner-cfg-backend').value = cfg.backend;
    if(cfg.threads){
      document.getElementById('miner-cfg-threads').value = cfg.threads;
      document.getElementById('miner-cfg-threads-range').value = cfg.threads;
    }
    if(cfg.workSize) document.getElementById('miner-cfg-worksize').value = cfg.workSize;
    if(cfg.loops) document.getElementById('miner-cfg-loops').value = cfg.loops;
    if(cfg.hiranLayers){
      document.getElementById('miner-cfg-hiran-layers').value = cfg.hiranLayers;
      document.getElementById('hiran-gpu-layers-val').textContent = cfg.hiranLayers;
    }
  } catch(e) {}
}

async function startMiner(mode){
  const cfg = saveMinerConfig();
  const env = {
    'ZION_POOL_ADDR': cfg.pool,
    'ZION_WORKER_NAME': cfg.worker,
    'ZION_LOOP_COUNT': cfg.loops,
    'ZION_MINER_THREADS': cfg.threads,
    'ZION_GPU_WORK_SIZE': cfg.workSize,
    'ZION_MINER_ID': 'dashboard-' + cfg.worker,
    'HIRAN_GPU_LAYERS': cfg.hiranLayers,
  };
  // Backend-specific env vars
  const backend = cfg.backend;
  if(backend === 'gpu-opencl'){
    env['ZION_GPU_BACKEND'] = 'opencl';
  } else if(backend === 'gpu-cuda'){
    env['ZION_GPU_BACKEND'] = 'cuda';
  } else if(backend === 'cpu'){
    env['ZION_GPU_BACKEND'] = 'cpu';  // force CPU backend, skip GPU init
  } else if(backend === 'dual'){
    env['ZION_GPU_BACKEND'] = 'opencl';  // dual uses both
  }
  const action = mode === 'gpu' ? 'start-miner-gpu' : 'start-miner-cpu';
  const log = document.getElementById('control-log');
  const ts = new Date().toLocaleTimeString();
  if(log) log.insertAdjacentHTML('afterbegin', '<div class="text-zion-gold">[' + ts + '] dispatching ' + action + ' (pool=' + cfg.pool + ', backend=' + backend + ')…</div>');
  try {
    const res = await fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, env }) }).then(r => r.json());
    const msg = res.ok ? '<div class="text-emerald-400">[' + ts + '] ✓ ' + action + ' started (PID ' + res.pid + ')</div>' : '<div class="text-red-400">[' + ts + '] ✗ ' + (res.error || 'failed') + '</div>';
    if(log) log.insertAdjacentHTML('afterbegin', msg);
    toast(res.ok ? ('▶ ' + action + ' dispatched') : ('Failed: ' + (res.error || action)), res.ok ? 'success' : 'error');
    if(res.ok){
      setTimeout(() => { toast('Miner should connect to ' + cfg.pool + '. Check Overview tab.', 'success'); refreshAll(); }, 8000);
    }
  } catch(e) {
    if(log) log.insertAdjacentHTML('afterbegin', '<div class="text-red-400">[' + ts + '] ✗ ' + e.message + '</div>');
    toast('Error: ' + e.message, 'error');
  }
}

async function controlAction(action){
  const log = document.getElementById('control-log');
  const ts = new Date().toLocaleTimeString();
  const launchActions = ['launch-full','launch-stack','start-node1','start-node2','start-pool','start-miner','start-miner-gpu','start-miner-cpu'];
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
// Layer tabs (L1–L6)
// ─────────────────────────────────────────────────────────────────────

async function loadLayer(layer){
  const grid = document.getElementById('layer-' + layer + '-grid');
  if(!grid) return;
  grid.innerHTML = '<div class="text-gray-500 italic col-span-2">Loading ' + layer.toUpperCase() + ' services…</div>';
  try {
    const data = await fetch('/api/layer/' + layer).then(r => r.json());
    if(!data.services || data.services.length === 0){
      grid.innerHTML = '<div class="text-gray-500 italic col-span-2">No services found for ' + layer.toUpperCase() + '.</div>';
      return;
    }
    grid.innerHTML = data.services.map(s => {
      const aliveClass = s.alive ? 'border-emerald-600 bg-emerald-900/15' : 'border-red-600 bg-red-900/15';
      const aliveText = s.alive ? '✓ Live' : '✗ Down';
      const dbSection = s.databases && s.databases.length > 0
        ? s.databases.map(db => {
            const sz = db.size ? (db.size > 1024*1024 ? (db.size/(1024*1024)).toFixed(1)+' MB' : (db.size/1024).toFixed(0)+' KB') : '0 B';
            return '<div class="text-[10px] text-gray-400">DB: ' + escapeHtml(db.name) + ' (' + sz + ') ' + (db.available ? '✓' : '✗') + '</div>';
          }).join('')
        : '<div class="text-[10px] text-gray-500">No DB</div>';
      const logPreview = s.log_tail && s.log_tail.length > 0
        ? '<div class="mt-2 bg-black/30 rounded p-2 max-h-24 overflow-y-auto font-mono text-[10px] text-gray-400">' + s.log_tail.slice(-5).map(l => '<div>' + escapeHtml(l) + '</div>').join('') + '</div>'
        : '<div class="mt-2 text-[10px] text-gray-500 italic">No log data</div>';
      const metricsBadge = s.has_metrics
        ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-300">Metrics: ' + s.metrics_count + '</span>'
        : '<span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">No metrics</span>';
      const ports = s.ports_open && s.ports_open.length > 0
        ? '<div class="text-[10px] text-emerald-400">Ports: ' + s.ports_open.join(', ') + '</div>'
        : (s.ports_closed && s.ports_closed.length > 0 ? '<div class="text-[10px] text-red-400">Closed: ' + s.ports_closed.join(', ') + '</div>' : '');
      return `
        <div class="zion-panel p-4 border ${aliveClass}">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="text-xl">${s.icon}</span>
              <div>
                <div class="font-bold text-sm">${escapeHtml(s.name)}</div>
                <div class="text-[10px] text-gray-400">${escapeHtml(s.kind)} · ${escapeHtml(s.id)}</div>
              </div>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-full ${s.alive ? 'bg-emerald-700 text-emerald-300' : 'bg-red-700 text-red-300'}">${aliveText}</span>
          </div>
          <div class="text-xs text-gray-300 mb-2">${escapeHtml(s.purpose)}</div>
          <div class="flex flex-wrap gap-1 mb-2">
            ${metricsBadge}
            ${s.depends_on && s.depends_on.length > 0 ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300">Depends: ' + s.depends_on.join(', ') + '</span>' : ''}
          </div>
          ${ports}
          ${dbSection}
          ${logPreview}
        </div>
      `;
    }).join('');
  } catch(e) {
    grid.innerHTML = '<div class="text-red-400 italic col-span-2">Failed to load ' + layer.toUpperCase() + ': ' + escapeHtml(e.message) + '</div>';
  }
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
    L5: 'border-orange-500/30 bg-orange-500/3',
    L6: 'border-cyan-500/30 bg-cyan-500/3',
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
// Launch Day Automation
// ─────────────────────────────────────────────────────────────────────

async function loadLaunchDayStatus(){
  try{
    const res = await fetch('/api/launch-day-prepare?action=status').then(r=>r.json());
    const badge = document.getElementById('launch-day-badge');
    if(!badge) return;

    // badge
    if(res.is_launch_day){
      badge.textContent = '🎉 LAUNCH DAY!';
      badge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white animate-pulse';
    } else if(res.backup_exists){
      badge.textContent = '✓ Záloha existuje';
      badge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white';
    } else {
      badge.textContent = '⏳ Záloha chybí';
      badge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-amber-600 text-white';
    }

    // countdown
    const daysEl = document.getElementById('ld-days');
    if(daysEl){
      if(res.is_launch_day){
        daysEl.textContent = 'DNES!';
        daysEl.className = 'text-3xl font-bold text-emerald-400 mb-1 animate-pulse';
      } else {
        const ms = new Date('2026-06-20T12:00:00Z') - Date.now();
        const days = Math.ceil(ms / 86400000);
        daysEl.textContent = days + ' dní';
        daysEl.className = 'text-3xl font-bold text-amber-400 mb-1';
      }
    }

    // backup
    const bkEl = document.getElementById('ld-backup');
    if(bkEl){
      bkEl.textContent = res.backup_exists ? '✓ Existuje' : '✗ Chybí';
      bkEl.className = 'text-3xl font-bold mb-1 ' + (res.backup_exists ? 'text-emerald-400' : 'text-red-400');
    }

    // genesis hash
    const ghEl = document.getElementById('ld-genesis');
    if(ghEl && res.current_genesis_hash){
      const h = res.current_genesis_hash;
      ghEl.textContent = h.substring(0,8) + '…' + h.slice(-4);
      ghEl.title = h;
    }

    // backup details
    const detEl = document.getElementById('backup-details');
    if(detEl){
      if(res.backup_exists){
        detEl.innerHTML = `<div class="text-emerald-400 mb-1">✓ Záloha nalezena</div>
          <div class="font-mono text-xs text-gray-400 break-all">${escapeHtml(res.backup_dir)}</div>`;
      } else {
        detEl.innerHTML = `<div class="text-amber-400 mb-1">⚠ Žádná záloha</div>
          <div class="text-gray-400">Klikni "Zálohovat vše" před launch dayem.</div>`;
      }
    }

    addLaunchDayLog('📊 Stav: ' + (res.is_launch_day ? 'LAUNCH DAY!' : res.backup_exists ? 'Záloha OK' : 'Záloha chybí'));
  } catch(e){
    addLaunchDayLog('❌ Chyba načítání: ' + e.message);
  }
}

async function launchDayAction(action){
  addLaunchDayLog('⏳ Spouštím: ' + action + '...');
  try{
    const res = await fetch('/api/launch-day-prepare?action=' + action).then(r=>r.json());
    if(action === 'backup' && res.success){
      addLaunchDayLog('✅ Záloha vytvořena: ' + (res.backup_dir || ''));
      if(res.manifest) addLaunchDayLog('📁 Souborů: ' + res.manifest.files_backed_up);
      if(res.backup_log) res.backup_log.forEach(l => addLaunchDayLog(l));
      const detEl = document.getElementById('backup-details');
      if(detEl && res.backup_dir) detEl.innerHTML = `
        <div class="text-emerald-400 mb-2">✅ Záloha uložena na lokální PC</div>
        <div class="font-mono text-xs text-gray-400 break-all mb-3">${escapeHtml(res.backup_dir)}</div>
        ${res.backup_log ? res.backup_log.map(l=>`<div class="text-xs ${l.startsWith('✓')?'text-emerald-400':'text-amber-400'}">${escapeHtml(l)}</div>`).join('') : ''}`;
      loadLaunchDayStatus();
    } else if(action === 'status'){
      loadLaunchDayStatus();
    } else if(res.error){
      addLaunchDayLog('❌ Chyba: ' + res.error);
    }
  } catch(e){
    addLaunchDayLog('❌ Chyba: ' + e.message);
  }
}

function confirmLaunchDay(){
  if(confirm('⚠️ KRITICKÁ OPERACE\n\nRotace genesis a premine adres pro mainnet launch.\n\nUjisti se:\n• Všechny nodes jsou zastaveny\n• Záloha je vytvořena\n• Máš privátní klíče v bezpečí\n\nPokračovat?')){
    launchDayAction('rotate-genesis&confirmed=true');
  } else {
    addLaunchDayLog('🚫 Rotace zrušena uživatelem');
  }
}

async function launchDaySequence(){
  if(!confirm('🚀 SPUSTIT LAUNCH SEQUENCE?\n\n1. Záloha všeho\n2. Zastavit síť\n3. Rotovat genesis\n4. Restartovat síť\n5. Verifikace\n\nNEVRATITELNÁ OPERACE. Pokračovat?')) return;

  addLaunchDayLog('🚀 ══════ START LAUNCH SEQUENCE ══════');
  for(const step of ['prepare','stop-network','rotate-genesis','restart-network','verify']){
    addLaunchDayLog('⏳ Krok: ' + step);
    try{
      const res = await fetch('/api/launch-day-execute?step=' + step).then(r=>r.json());
      if(res.success){
        addLaunchDayLog('✅ ' + step + ' dokončen');
        if(res.backup_dir) addLaunchDayLog('💾 Záloha: ' + res.backup_dir);
        if(res.complete){ addLaunchDayLog('🎉 ══════ LAUNCH SEQUENCE DOKONČENA! ══════'); alert('🎉 Mainnet launch sequence dokončena!'); }
      } else {
        addLaunchDayLog('❌ ' + step + ' selhalo: ' + (res.error || 'neznámá chyba'));
        break;
      }
    } catch(e){
      addLaunchDayLog('❌ Chyba: ' + e.message);
      break;
    }
  }
}

function addLaunchDayLog(msg){
  const el = document.getElementById('launch-day-log');
  if(!el) return;
  const time = new Date().toLocaleTimeString('cs-CZ');
  const cls = msg.startsWith('✅') ? 'text-emerald-400' : msg.startsWith('❌') ? 'text-red-400' : msg.startsWith('🚀') ? 'text-amber-400' : 'text-gray-300';
  el.innerHTML = `<div class="${cls}"><span class="text-gray-600">[${time}]</span> ${escapeHtml(msg)}</div>` + el.innerHTML;
}

// ─────────────────────────────────────────────────────────────────────
// Hiran AI — Agent Management
// ─────────────────────────────────────────────────────────────────────

async function checkAiStatus(){
  // ── Hiran Inference (port 8002) ──
  const hiranBadge = document.getElementById('hiran-badge');
  const hiranDetail = document.getElementById('hiran-inference-detail');
  const gpuDetail = document.getElementById('hiran-gpu-detail');
  const gpuBadge = document.getElementById('hiran-gpu-badge');
  if(hiranBadge) hiranBadge.textContent = 'CHECKING…';
  try{
    const r1 = await fetch('/api/hiran/health');
    const d1 = await r1.json();
    if(d1.alive){
      if(hiranBadge){ hiranBadge.textContent = 'LIVE'; hiranBadge.className = 'px-2 py-0.5 rounded text-xs font-bold bg-emerald-600 text-white animate-pulse'; }
      if(hiranDetail) hiranDetail.textContent = (d1.model || 'hiran-v2.2') + ' · up ' + (d1.uptime_s != null ? Math.round(d1.uptime_s) + 's' : '—');
      if(gpuDetail) gpuDetail.textContent = d1.gpu_layers > 0 ? d1.gpu_layers + ' GPU layers' : 'CPU only';
      if(gpuBadge){ gpuBadge.textContent = d1.gpu_layers > 0 ? d1.gpu_layers + '/33' : 'CPU'; gpuBadge.className = 'px-2 py-0.5 rounded text-xs font-bold ' + (d1.gpu_layers > 0 ? 'bg-purple-600 text-white' : 'bg-gray-700 text-white'); }
    } else {
      if(hiranBadge){ hiranBadge.textContent = 'OFFLINE'; hiranBadge.className = 'px-2 py-0.5 rounded text-xs font-bold bg-red-700 text-white'; }
      if(hiranDetail) hiranDetail.textContent = 'Spusť: ▶ Start';
      if(gpuDetail) gpuDetail.textContent = '—';
      if(gpuBadge){ gpuBadge.textContent = '—'; gpuBadge.className = 'px-2 py-0.5 rounded text-xs font-bold bg-gray-700 text-white'; }
    }
  }catch(e){
    if(hiranBadge){ hiranBadge.textContent = 'OFFLINE'; hiranBadge.className = 'px-2 py-0.5 rounded text-xs font-bold bg-red-700 text-white'; }
    if(hiranDetail) hiranDetail.textContent = 'Spusť: ▶ Start';
  }

  // ── Hiranyagarbha (port 8001) ──
  const orchBadge = document.getElementById('hiranyagarbha-badge');
  const orchDetail = document.getElementById('hiranyagarbha-detail');
  const orchPanel = document.getElementById('orch-stats-panel');
  if(orchBadge) orchBadge.textContent = 'CHECKING…';
  try{
    const r2 = await fetch('/api/hiranyagarbha/health');
    const d2 = await r2.json();
    if(d2.alive){
      if(orchBadge){ orchBadge.textContent = 'LIVE'; orchBadge.className = 'px-2 py-0.5 rounded text-xs font-bold bg-emerald-600 text-white animate-pulse'; }
      if(orchDetail) orchDetail.textContent = 'v' + (d2.version || '?') + ' · agents: ' + (d2.active_agents ?? '—') + ' · tasks: ' + (d2.task_queue ?? '—');
      if(orchPanel) orchPanel.classList.remove('hidden');
      loadOrchestratorStats();
    } else {
      if(orchBadge){ orchBadge.textContent = 'OFFLINE'; orchBadge.className = 'px-2 py-0.5 rounded text-xs font-bold bg-red-700 text-white'; }
      if(orchDetail) orchDetail.textContent = 'Start: ▶ Start';
      if(orchPanel) orchPanel.classList.add('hidden');
    }
  }catch(e){
    if(orchBadge){ orchBadge.textContent = 'OFFLINE'; orchBadge.className = 'px-2 py-0.5 rounded text-xs font-bold bg-red-700 text-white'; }
    if(orchDetail) orchDetail.textContent = 'Start: ▶ Start';
    if(orchPanel) orchPanel.classList.add('hidden');
  }
}

async function loadOrchestratorStats(){
  try{
    const r = await fetch('http://127.0.0.1:8001/orchestrator/status');
    if(!r.ok) return;
    const d = await r.json();
    const s = d.status || d;
    const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v ?? '—'; };
    set('orch-active', s.active_agents ?? s.agent_count ?? '—');
    set('orch-tasks', s.task_queue_depth ?? s.tasks_pending ?? '—');
    set('orch-msgs', s.message_queue_depth ?? s.messages ?? '—');
    set('orch-actions', s.total_actions_dispatched ?? s.total_actions ?? '—');
  }catch(_){}
}

async function loadAgentList(){
  const list = document.getElementById('agent-list');
  const res = document.getElementById('agent-action-result');
  if(list) list.innerHTML = '<div class="text-gray-500 text-xs italic">Loading agents…</div>';
  try{
    const r = await fetch('http://127.0.0.1:8001/agents');
    const d = await r.json();
    const total = d.total ?? d.active ?? 0;
    if(total === 0){
      if(list) list.innerHTML = '<div class="text-gray-500 text-xs italic">No active agents — click + Register to create one</div>';
      return;
    }
    const r2 = await fetch('http://127.0.0.1:8001/orchestrator/status');
    const s = await r2.json();
    const agents = s.agents ?? {};
    const active = agents.active ?? 0;
    const suspended = agents.suspended ?? 0;
    const terminated = agents.terminated ?? 0;
    const actions = agents.total_actions ?? 0;
    let html = '<div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-center mb-2">';
    html += '<div class="bg-zion-900 rounded p-2"><div class="text-xs text-gray-400">Active</div><div class="text-sm font-bold text-emerald-400">' + active + '</div></div>';
    html += '<div class="bg-zion-900 rounded p-2"><div class="text-xs text-gray-400">Suspended</div><div class="text-sm font-bold text-amber-400">' + suspended + '</div></div>';
    html += '<div class="bg-zion-900 rounded p-2"><div class="text-xs text-gray-400">Terminated</div><div class="text-sm font-bold text-red-400">' + terminated + '</div></div>';
    html += '<div class="bg-zion-900 rounded p-2"><div class="text-xs text-gray-400">Actions</div><div class="text-sm font-bold text-gray-300">' + actions + '</div></div>';
    html += '</div>';
    if(list) list.innerHTML = html;
    if(res) res.textContent = 'Loaded: ' + active + ' active, ' + suspended + ' suspended, ' + terminated + ' terminated';
  }catch(e){
    if(list) list.innerHTML = '<div class="text-red-400 text-xs">Error loading agents: ' + escapeHtml(String(e)) + '</div>';
  }
}

async function registerAgent(){
  const res = document.getElementById('agent-action-result');
  if(res) res.textContent = 'Registering agent…';
  try{
    const r = await fetch('http://127.0.0.1:8001/agents',{
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({name:'DashboardAgent-'+Date.now(), capabilities:['Compute','Memory'], consciousness_level:1})
    });
    const d = await r.json();
    if(res) res.textContent = 'Registered: ' + JSON.stringify(d);
    loadAgentList();
  }catch(e){
    if(res) res.textContent = 'Error: ' + String(e);
  }
}

async function elevateConsciousness(){
  const res = document.getElementById('agent-action-result');
  if(res) res.textContent = 'Elevating consciousness…';
  try{
    const r1 = await fetch('http://127.0.0.1:8001/agents');
    const d1 = await r1.json();
    if(!d1.total && !d1.active){ if(res) res.textContent = 'No agents to elevate'; return; }
    const r3 = await fetch('http://127.0.0.1:8001/agents/00000000-0000-0000-0000-000000000001/consciousness',{
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({level:2})
    });
    const d3 = await r3.json();
    if(res) res.textContent = 'Elevated: ' + JSON.stringify(d3);
    loadAgentList();
  }catch(e){
    if(res) res.textContent = 'Error: ' + String(e);
  }
}

async function grantCapability(){
  const res = document.getElementById('agent-action-result');
  if(res) res.textContent = 'Granting capability…';
  try{
    const r = await fetch('http://127.0.0.1:8001/agents/00000000-0000-0000-0000-000000000001/capabilities',{
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({capability:'RAG'})
    });
    const d = await r.json();
    if(res) res.textContent = 'Granted: ' + JSON.stringify(d);
  }catch(e){
    if(res) res.textContent = 'Error: ' + String(e);
  }
}

async function dispatchTask(){
  const res = document.getElementById('agent-action-result');
  if(res) res.textContent = 'Dispatching task…';
  try{
    const r = await fetch('http://127.0.0.1:8001/tasks/dispatch',{
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({task_type:'QueryKnowledge', model_id:'hiran-v2.2', submitter:'dashboard', description:'Dashboard test task', input:'What is ZION?'})
    });
    const d = await r.json();
    if(res) res.textContent = 'Dispatched: ' + JSON.stringify(d);
    loadAgentList();
    loadOrchestratorStats();
  }catch(e){
    if(res) res.textContent = 'Error: ' + String(e);
  }
}

async function sendChat(){
  const inp = document.getElementById('chat-input');
  const log = document.getElementById('chat-history');
  const status = document.getElementById('chat-status');
  if(!inp || !log) return;
  const msg = inp.value.trim();
  if(!msg) return;
  inp.value = '';
  // User bubble
  const userDiv = document.createElement('div');
  userDiv.className = 'flex gap-2';
  userDiv.innerHTML = '<div class="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold shrink-0">U</div><div class="bg-black/30 rounded-xl p-3 text-sm text-gray-200">' + escapeHtml(msg) + '</div>';
  log.appendChild(userDiv);
  log.scrollTop = log.scrollHeight;
  // Spinner
  const spinDiv = document.createElement('div');
  spinDiv.className = 'flex gap-2';
  spinDiv.innerHTML = '<div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold shrink-0">AI</div><div class="bg-black/30 rounded-xl p-3 text-sm text-gray-400 animate-pulse">Hiran přemýšlí…</div>';
  log.appendChild(spinDiv);
  log.scrollTop = log.scrollHeight;
  if(status) status.textContent = 'Odesílám…';
  try{
    const t0 = Date.now();
    const r = await fetch('/api/hiran/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});
    const d = await r.json();
    log.removeChild(spinDiv);
    const aiDiv = document.createElement('div');
    aiDiv.className = 'flex gap-2';
    const text = d.ok ? d.reply : 'Chyba: ' + (d.error || 'neznámá chyba');
    aiDiv.innerHTML = '<div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold shrink-0">AI</div><div class="bg-black/30 rounded-xl p-3 text-sm text-gray-200 whitespace-pre-wrap">' + escapeHtml(text) + '</div>';
    log.appendChild(aiDiv);
    log.scrollTop = log.scrollHeight;
    const elapsed = d.latency_ms != null ? d.latency_ms : Date.now()-t0;
    if(status) status.textContent = 'Odpověď za ' + Math.round(elapsed) + ' ms · tokenů: ' + (d.tokens || '—');
  }catch(e){
    log.removeChild(spinDiv);
    const errDiv = document.createElement('div');
    errDiv.className = 'flex gap-2';
    errDiv.innerHTML = '<div class="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold shrink-0">!</div><div class="bg-black/30 rounded-xl p-3 text-sm text-red-400">Chyba: ' + escapeHtml(String(e)) + '</div>';
    log.appendChild(errDiv);
    if(status) status.textContent = 'Chyba spojení';
  }
}

// ─────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────

async function loadSettings(){
  try{
    const r = await fetch('/api/settings');
    const s = await r.json();
    applySettings(s);
    return s;
  }catch(e){ console.warn('Settings load failed', e); return {}; }
}

function applySettings(s){
  if(!s) return;
  // theme
  const themeSel = document.getElementById('settings-theme');
  if(themeSel && s.theme){ themeSel.value = s.theme; }
  // tab
  const tabSel = document.getElementById('settings-default-tab');
  if(tabSel && s.default_tab){ tabSel.value = s.default_tab; }
  // refresh interval
  const refSel = document.getElementById('settings-refresh');
  if(refSel && s.refresh_interval_ms != null){ refSel.value = String(s.refresh_interval_ms); }
  // thresholds
  const hrIn = document.getElementById('settings-hashrate-threshold');
  if(hrIn && s.alert_threshold_hashrate != null){ hrIn.value = String(s.alert_threshold_hashrate); }
  const syncIn = document.getElementById('settings-sync-threshold');
  if(syncIn && s.alert_threshold_sync_gap != null){ syncIn.value = String(s.alert_threshold_sync_gap); }
  const lvlSel = document.getElementById('settings-log-level');
  if(lvlSel && s.log_level_filter){ lvlSel.value = s.log_level_filter; }
  // toggles
  const wd = document.getElementById('settings-watchdog');
  if(wd && s.auto_launch_watchdog != null){ wd.checked = !!s.auto_launch_watchdog; }
  const tt = document.getElementById('settings-tooltips');
  if(tt && s.show_tooltips != null){ tt.checked = !!s.show_tooltips; }
  // apply theme
  if(s.theme === 'light'){ document.body.classList.add('light-mode'); }
  else { document.body.classList.remove('light-mode'); }
  // apply refresh interval
  if(s.refresh_interval_ms && refreshTimer){
    clearInterval(refreshTimer);
    refreshTimer = setInterval(refreshAll, s.refresh_interval_ms);
  }
}

function openSettingsModal(){
  const m = document.getElementById('settings-modal');
  if(m) m.classList.remove('hidden');
  loadSettings();
}
function closeSettingsModal(){
  const m = document.getElementById('settings-modal');
  if(m) m.classList.add('hidden');
}

async function saveSettings(){
  const payload = {};
  const theme = document.getElementById('settings-theme');
  if(theme) payload.theme = theme.value;
  const tab = document.getElementById('settings-default-tab');
  if(tab) payload.default_tab = tab.value;
  const ref = document.getElementById('settings-refresh');
  if(ref) payload.refresh_interval_ms = parseInt(ref.value, 10) || 3000;
  const hr = document.getElementById('settings-hashrate-threshold');
  if(hr) payload.alert_threshold_hashrate = parseFloat(hr.value) || 0.1;
  const sync = document.getElementById('settings-sync-threshold');
  if(sync) payload.alert_threshold_sync_gap = parseInt(sync.value, 10) || 5;
  const lvl = document.getElementById('settings-log-level');
  if(lvl) payload.log_level_filter = lvl.value;
  const wd = document.getElementById('settings-watchdog');
  if(wd) payload.auto_launch_watchdog = wd.checked;
  const tt = document.getElementById('settings-tooltips');
  if(tt) payload.show_tooltips = tt.checked;
  try{
    const r = await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const d = await r.json();
    applySettings(d.settings || d);
    const status = document.getElementById('settings-save-status');
    if(status){ status.textContent = 'Saved!'; setTimeout(()=> status.textContent='', 1500); }
  }catch(e){
    const status = document.getElementById('settings-save-status');
    if(status){ status.textContent = 'Error: '+String(e); }
  }
}

async function resetSettings(){
  if(!confirm('Reset settings to defaults?')) return;
  try{
    const r = await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
    const d = await r.json();
    applySettings(d.settings || d);
    const status = document.getElementById('settings-save-status');
    if(status){ status.textContent = 'Reset!'; setTimeout(()=> status.textContent='', 1500); }
  }catch(e){
    const status = document.getElementById('settings-save-status');
    if(status){ status.textContent = 'Error: '+String(e); }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Log Search
// ─────────────────────────────────────────────────────────────────────

async function runLogSearch(){
  const q = document.getElementById('log-search-input').value.trim();
  const level = document.getElementById('log-level-filter').value;
  const out = document.getElementById('log-search-results');
  if(!q && level === 'all'){ if(out) out.innerHTML = '<div class="text-gray-500 italic">Enter a query or choose a level filter</div>'; return; }
  if(out) out.innerHTML = '<div class="text-gray-500 italic animate-pulse">Searching…</div>';
  try{
    const r = await fetch('/api/logs/search?q=' + encodeURIComponent(q) + '&max=100');
    const d = await r.json();
    let rows = d.results || [];
    if(level !== 'all'){
      rows = rows.filter(x => {
        const line = (x.text || '').toLowerCase();
        if(level === 'error') return line.includes('error') || line.includes('err') || line.includes('panic') || line.includes('fail');
        if(level === 'warn') return line.includes('warn') || line.includes('warning');
        if(level === 'info') return line.includes('info') || line.includes('information');
        return true;
      });
    }
    if(rows.length === 0){ if(out) out.innerHTML = '<div class="text-gray-500 italic">No results</div>'; return; }
    let html = '<div class="text-gray-400 text-xs mb-1">'+rows.length+' result(s)</div>';
    for(const row of rows){
      const cls = syntaxHighlightClass(row.text || '');
      html += '<div class="bg-black/20 rounded px-2 py-1 border-l-2 ' + cls.border + '">' +
              '<div class="text-gray-500 text-[10px] truncate">' + escapeHtml(row.file || '') + ':' + (row.line || 0) + '</div>' +
              '<div class="text-gray-200 ' + cls.text + '">' + escapeHtml(row.text || '') + '</div></div>';
    }
    if(out) out.innerHTML = html;
  }catch(e){
    if(out) out.innerHTML = '<div class="text-red-400">Error: ' + escapeHtml(String(e)) + '</div>';
  }
}

function syntaxHighlightClass(line){
  const l = line.toLowerCase();
  if(l.includes('error') || l.includes('panic') || l.includes('fail')) return { border: 'border-red-500', text: 'text-red-300' };
  if(l.includes('warn')) return { border: 'border-amber-500', text: 'text-amber-300' };
  if(l.includes('info')) return { border: 'border-emerald-500', text: 'text-emerald-300' };
  return { border: 'border-zion-600', text: 'text-gray-300' };
}

// ─────────────────────────────────────────────────────────────────────
// Process Manager
// ─────────────────────────────────────────────────────────────────────

async function loadProcessRegistry(){
  const container = document.getElementById('process-registry');
  if(!container) return;
  try{
    const r = await fetch('/api/processes');
    const d = await r.json();
    const procs = d.processes || [];
    if(procs.length === 0){ container.innerHTML = '<div class="text-gray-500 italic text-xs">No processes tracked</div>'; return; }
    let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-2">';
    for(const p of procs){
      html += '<div class="bg-black/20 rounded-md p-2 flex items-center justify-between">' +
              '<div><div class="text-xs font-semibold text-gray-200">' + escapeHtml(p.name || 'Unknown') + '</div>' +
              '<div class="text-[10px] text-gray-400">PID ' + (p.pid || '—') + ' · CPU ' + (p.cpu_percent ?? '—') + '% · MEM ' + (p.memory_mb ?? '—') + ' MB</div></div>' +
              '<button onclick="killPid(' + (p.pid || 0) + ')" class="text-[10px] px-2 py-1 bg-red-700/50 hover:bg-red-600 rounded text-white">Kill</button>' +
              '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }catch(e){
    if(container) container.innerHTML = '<div class="text-red-400 text-xs">Error: ' + escapeHtml(String(e)) + '</div>';
  }
}

async function killPid(pid){
  if(!pid || !confirm('Kill process ' + pid + '?')) return;
  try{
    const r = await fetch('/api/processes/kill?pid=' + encodeURIComponent(pid));
    const d = await r.json();
    alert(d.ok ? 'Killed PID ' + pid : 'Failed: ' + (d.error || 'unknown'));
    loadProcessRegistry();
  }catch(e){ alert('Error: ' + String(e)); }
}

// ─────────────────────────────────────────────────────────────────────
// Export CSV
// ─────────────────────────────────────────────────────────────────────

function exportCsv(){
  window.open('/api/export/blocks', '_blank');
}

// ─────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────

console.log('[ZION Dashboard] Initializing v2 — tabs:', TABS.length);
applyFriendlyMode();
loadSettings().then(s => {
  if(s && s.default_tab){ switchTab(s.default_tab); }
  else { switchTab('overview'); }
});
refreshAll();
refreshTimer = setInterval(refreshAll, 3000);
setTimeout(loadMinerConfig, 500);
console.log('[ZION Dashboard] Auto-refresh started');
