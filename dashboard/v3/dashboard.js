'use strict';

/* ═══════════════════════════════════════════════════════════════
   ZION V3 Dashboard — Edge-Primary Command Center
   Clean rebuild: topology-aware, real-time, modern architecture
   ═══════════════════════════════════════════════════════════════ */

const REFRESH_INTERVAL = 3000;
let autoRefresh = true;
let refreshTimer = null;
let lastStatus = null;

// Chart instances
let chartHashrate = null;
let chartShares = null;

// History buffers (rolling 60 samples)
const history = { hashrate: [], sharesOk: [], sharesRej: [], labels: [] };

/* ── Helpers ────────────────────────────────────────────────── */

function $(id){ return document.getElementById(id); }

function fmt(n, digits=2){
  if(n === null || n === undefined || Number.isNaN(n)) return '—';
  if(typeof n === 'number') return n.toLocaleString(undefined, {maximumFractionDigits:digits});
  return String(n);
}

function statusClass(s){
  if(!s) return 'svc-down';
  if(s.status==='running' || s.status==='online' || s.alive===true) return 'svc-live';
  if(s.derived==='degraded') return 'svc-degraded';
  return 'svc-down';
}

function statusText(s){
  if(!s) return 'Down';
  if(s.status==='running' || s.status==='online' || s.alive===true) return 'LIVE';
  if(s.derived==='degraded') return 'DEGRADED';
  return 'DOWN';
}

function statusColor(s){
  if(!s) return 'text-red-400';
  if(s.status==='running' || s.status==='online' || s.alive===true) return 'text-emerald-400';
  if(s.derived==='degraded') return 'text-amber-400';
  return 'text-red-400';
}

/* ── API ──────────────────────────────────────────────────── */

async function api(path){
  try{
    const r = await fetch(path, {headers:{'Accept':'application/json'}});
    if(!r.ok) throw new Error(r.status+' '+r.statusText);
    return await r.json();
  }catch(e){
    console.error('API error', path, e);
    return null;
  }
}

/* ── Core Refresh ─────────────────────────────────────────── */

async function refreshAll(){
  try{
    const [status, services, readiness, resources, alerts, payout] = await Promise.all([
      api('/api/status'),
      api('/api/services'),
      api('/api/readiness'),
      api('/api/resources').catch(()=>null),
      api('/api/alerts'),
      api('/api/payout'),
    ]);

    if(!status) return; // backend unreachable
    lastStatus = status;

    // Top bar
    const isEdge = status.topology === 'edge-primary';
    $('topology-badge').textContent = isEdge ? '🌍 Edge-Primary' : '🔷 Local-Dev';
    $('topology-badge').className = isEdge
      ? 'text-[10px] px-2 py-1 rounded-md font-bold bg-purple-700/40 text-purple-300 border border-purple-500/20'
      : 'text-[10px] px-2 py-1 rounded-md font-bold bg-blue-700/40 text-blue-300 border border-blue-500/20';

    const edgeH = status.edge_node?.chain_height ?? null;
    const localH = status.node1?.chain_height ?? null;
    $('hero-height').textContent = fmt(edgeH ?? localH);
    $('hero-peers').textContent = fmt(status.edge_node?.known_peers ?? status.node1?.known_peers ?? 0,0);

    const hr = status.miner?.hashrate;
    $('hero-hashrate').textContent = hr ? hr.toFixed(2) : '—';

    $('timestamp').textContent = new Date(status.timestamp).toLocaleTimeString();
    $('top-status-text').textContent = isEdge
      ? `Edge ${fmt(edgeH)} · Local ${fmt(localH)} · ${status.miner?.running?'Mining':'Idle'}`
      : `Local ${fmt(localH)} · ${status.miner?.running?'Mining':'Idle'}`;

    // Sections
    renderServices(services?.services || [], isEdge);
    renderMiner(status.miner);
    renderPool(status.pool, status.pool_edge);
    renderChain(status);
    renderAlerts(alerts?.alerts || []);
    renderReadiness(readiness);
    updateCharts(status.miner, status.pool);

    // Tab-specific
    if(currentTab==='payout' && payout) renderPayoutTab(payout);
    if(currentTab==='explorer') refreshExplorer();

  }catch(e){
    console.error('refreshAll error:', e);
  }
}

/* ── Service Grid ─────────────────────────────────────────── */

function renderServices(services, isEdge){
  const grid = $('service-grid');
  if(!grid) return;

  // Sort: L1 first, then L2, L3
  const order = { 'L1':1, 'L2':2, 'L3':3 };
  const sorted = [...services].sort((a,b)=> (order[a.level]||9) - (order[b.level]||9));

  grid.innerHTML = sorted.map(s => {
    const sc = statusClass(s);
    const st = statusText(s);
    const stColor = statusColor(s);
    const isRunning = sc === 'svc-live';
    const pulse = isRunning ? 'pulse-live' : '';

    // Build detail line
    let detail = '';
    if(s.kind==='node' && s.meta?.chain_height != null){
      detail = `Height ${fmt(s.meta.chain_height)}`;
    }else if(s.kind==='pool' && s.meta?.active_miners != null){
      detail = `${fmt(s.meta.active_miners)} miners`;
    }else if(s.kind==='miner' && s.meta?.hashrate != null){
      detail = `${s.meta.hashrate.toFixed(2)} KH/s`;
    }else if(s.depends_on?.length){
      detail = `Needs ${s.depends_on.join(', ')}`;
    }

    return `
    <div class="zion-panel svc-card p-4 rounded-xl ${sc} ${pulse} relative" id="card-${s.id}">
      <div class="flex items-start justify-between mb-2 relative z-10">
        <div class="flex items-center gap-2">
          <span class="text-base">${s.icon || '⚙️'}</span>
          <div>
            <div class="text-xs font-semibold text-white">${esc(s.name)}</div>
            <div class="text-[10px] text-gray-400">${esc(s.level || '')}</div>
          </div>
        </div>
        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${stColor} bg-black/30">${st}</span>
      </div>
      <div class="text-[10px] text-gray-300 font-mono mb-2 relative z-10">${detail || '—'}</div>
      <div class="flex gap-1.5 relative z-10">
        ${s.actions?.map(a => `<button onclick="controlAction('${a}')" class="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition">${esc(a)}</button>`).join('') || ''}
        ${s.log ? `<button onclick="viewLog('${s.id}')" class="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition">📄 Log</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* ── Miner ────────────────────────────────────────────────── */

function renderMiner(m){
  if(!m) m = {};
  const running = m.running || false;
  const badge = $('badge-miner');
  if(badge){
    badge.textContent = running ? 'LIVE' : 'DOWN';
    badge.className = `px-2 py-0.5 rounded text-[10px] font-bold ${running?'bg-emerald-700/40 text-emerald-300':'bg-red-700/40 text-red-300'}`;
  }
  const card = $('card-miner');
  if(card) card.classList.toggle('svc-live', running);

  const mh = $('val-miner-hashrate');
  if(mh) mh.textContent = m.hashrate ? m.hashrate.toFixed(2) : '—';

  const ms = $('val-miner-shares');
  if(ms) ms.textContent = (m.shares_accepted ?? '—') + ' / ' + (m.shares_rejected ?? '—');

  const md = $('val-miner-device');
  if(md) md.textContent = (m.gpu_backend ? m.gpu_backend + ': ' : '') + (m.gpu_device ?? 'cpu');

  const mp = $('val-miner-pool');
  if(mp) mp.textContent = m.pool_addr ?? '—';
}

/* ── Pool ─────────────────────────────────────────────────── */

function renderPool(pool, poolEdge){
  pool = pool || {};
  poolEdge = poolEdge || {};

  const running = pool.running || poolEdge.running || false;
  const badge = $('badge-pool');
  if(badge){
    badge.textContent = running ? 'LIVE' : 'DOWN';
    badge.className = `px-2 py-0.5 rounded text-[10px] font-bold ${running?'bg-emerald-700/40 text-emerald-300':'bg-red-700/40 text-red-300'}`;
  }

  const pm = $('val-pool-miners');
  if(pm) pm.textContent = fmt(poolEdge.active_miners ?? pool.active_sessions ?? 0, 0);

  const pb = $('val-pool-blocks');
  if(pb) pb.textContent = fmt(poolEdge.blocks_found ?? pool.blocks_found ?? 0, 0);

  const pf = $('val-pool-fee');
  if(pf) pf.textContent = pool.fee_split ?? '—';

  const pw = $('val-pool-wallet');
  if(pw) pw.textContent = pool.pool_wallet ? pool.pool_wallet.slice(0,20)+'…' : '—';
}

/* ── Chain / Sync ───────────────────────────────────────── */

function renderChain(status){
  const edgeH = status.edge_node?.chain_height ?? null;
  const localH = status.node1?.chain_height ?? null;

  const edgeEl = $('val-edge-height');
  if(edgeEl) edgeEl.textContent = fmt(edgeH);

  const localEl = $('val-local-height');
  if(localEl) localEl.textContent = fmt(localH);

  const gapEl = $('val-sync-gap');
  if(gapEl){
    if(edgeH != null && localH != null){
      const gap = Math.abs(edgeH - localH);
      gapEl.textContent = gap;
      gapEl.className = 'text-xl font-bold font-mono ' + (gap <= 5 ? 'text-emerald-400' : gap <= 20 ? 'text-amber-400' : 'text-red-400');
    }else{
      gapEl.textContent = '—';
      gapEl.className = 'text-xl font-bold font-mono text-gray-400';
    }
  }

  const syncEl = $('chain-sync-status');
  if(syncEl){
    if(edgeH != null && localH != null){
      const gap = Math.abs(edgeH - localH);
      if(gap <= 5){
        syncEl.textContent = '✓ Synced'; syncEl.className = 'text-[10px] px-2 py-1 rounded bg-emerald-700/30 text-emerald-300';
      }else if(gap <= 20){
        syncEl.textContent = '⟳ Syncing ('+gap+')'; syncEl.className = 'text-[10px] px-2 py-1 rounded bg-amber-700/30 text-amber-300';
      }else{
        syncEl.textContent = '✗ Lag ('+gap+')'; syncEl.className = 'text-[10px] px-2 py-1 rounded bg-red-700/30 text-red-300';
      }
    }else{
      syncEl.textContent = 'Unknown';
      syncEl.className = 'text-[10px] px-2 py-1 rounded bg-gray-700/30 text-gray-400';
    }
  }

  const mp = $('val-mempool');
  if(mp) mp.textContent = fmt(status.edge_node?.mempool_size ?? status.node1?.mempool_size ?? 0, 0);
}

/* ── Alerts ───────────────────────────────────────────────── */

function renderAlerts(alerts){
  const list = $('alerts-list');
  const count = $('alert-count');
  if(!list) return;

  const critical = alerts.filter(a => a.severity==='critical' || a.severity==='warning');
  if(count){
    count.textContent = critical.length;
    count.classList.toggle('hidden', critical.length===0);
  }

  if(!alerts.length){
    list.innerHTML = '<div class="text-xs text-gray-500 italic">No alerts</div>';
    return;
  }

  const colors = {
    critical: 'alert-critical',
    warning: 'alert-warning',
    info: 'alert-info',
    success: 'alert-success'
  };
  const icons = { critical:'🚨', warning:'⚠️', info:'ℹ️', success:'✅' };

  list.innerHTML = alerts.map(a => `
    <div class="flex items-start gap-2 p-2.5 rounded-lg border text-xs ${colors[a.severity]||colors.info}">
      <span class="text-sm flex-shrink-0">${icons[a.severity]||'ℹ️'}</span>
      <div class="flex-1 min-w-0">
        <div class="font-semibold truncate">${esc(a.title)}</div>
        <div class="text-[10px] text-gray-400 truncate">${esc(a.detail)}</div>
      </div>
      ${a.action ? `<button onclick="controlAction('${esc(a.action)}')" class="flex-shrink-0 text-[10px] px-2 py-1 bg-white/10 hover:bg-white/20 rounded transition">Fix</button>` : ''}
    </div>
  `).join('');
}

/* ── Readiness ────────────────────────────────────────────── */

function renderReadiness(r){
  const bar = $('readiness-bar');
  if(!bar || !r) return;
  const score = r.score ?? 0;
  bar.classList.toggle('hidden', score >= 95);

  const sc = $('readiness-score');
  if(sc) sc.textContent = score + '%';

  const lbl = $('readiness-label');
  if(lbl) lbl.textContent = score >= 80 ? 'Almost Ready' : score >= 50 ? 'Getting There' : 'Needs Work';

  const br = $('readiness-breakdown');
  if(br && r.checks){
    br.textContent = r.checks.map(c => `${c.ok?'✓':'✗'} ${c.id}`).join('  ·  ');
  }
}

/* ── Charts ───────────────────────────────────────────────── */

function initCharts(){
  const hrCtx = $('chart-hashrate')?.getContext('2d');
  const shCtx = $('chart-shares')?.getContext('2d');
  if(!hrCtx || !shCtx) return;

  Chart.defaults.color = '#9ca3af';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';

  chartHashrate = new Chart(hrCtx, {
    type:'line',
    data:{ labels:[], datasets:[{data:[],borderColor:'#10b981',backgroundColor:'rgba(16,185,129,0.08)',fill:true,tension:0.4,pointRadius:0}] },
    options:{ responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}},animation:{duration:0} }
  });

  chartShares = new Chart(shCtx, {
    type:'bar',
    data:{ labels:[], datasets:[
      {data:[],backgroundColor:'rgba(16,185,129,0.6)',label:'Accepted'},
      {data:[],backgroundColor:'rgba(239,68,68,0.4)',label:'Rejected'}
    ]},
    options:{ responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,labels:{boxWidth:8,font:{size:10}}}},scales:{x:{stacked:true},y:{stacked:true}},animation:{duration:0} }
  });
}

function updateCharts(miner, pool){
  miner = miner || {};
  pool = pool || {};
  const now = new Date().toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'});

  // Hashrate history
  const hr = miner.hashrate || 0;
  history.hashrate.push(hr);
  history.labels.push(now);
  if(history.hashrate.length > 60){ history.hashrate.shift(); history.labels.shift(); }

  if(chartHashrate){
    chartHashrate.data.labels = history.labels;
    chartHashrate.data.datasets[0].data = history.hashrate;
    chartHashrate.update('none');
  }

  // Shares history (accumulate since last point)
  const ok = miner.shares_accepted || 0;
  const rej = miner.shares_rejected || 0;
  const lastOk = history.sharesOk.length ? history.sharesOk[history.sharesOk.length-1] : 0;
  const lastRej = history.sharesRej.length ? history.sharesRej[history.sharesRej.length-1] : 0;
  history.sharesOk.push(Math.max(0, ok - lastOk));
  history.sharesRej.push(Math.max(0, rej - lastRej));
  if(history.sharesOk.length > 60){ history.sharesOk.shift(); history.sharesRej.shift(); }

  if(chartShares){
    chartShares.data.labels = history.labels;
    chartShares.data.datasets[0].data = history.sharesOk;
    chartShares.data.datasets[1].data = history.sharesRej;
    chartShares.update('none');
  }
}

/* ── Tabs ─────────────────────────────────────────────────── */

let currentTab = 'main';

function switchTab(name){
  currentTab = name;
  // Hide all tab panes
  document.querySelectorAll('[id^="tab-"]').forEach(el => el.classList.add('hidden'));
  // Show selected
  const pane = $('tab-'+name);
  if(pane) pane.classList.remove('hidden');

  if(name==='payout') refreshPayout();
  if(name==='explorer') refreshExplorer();
}

async function refreshPayout(){
  const data = await api('/api/payout');
  if(!data) return;
  const c = $('payout-content');
  if(!c) return;
  c.innerHTML = `
    <div class="grid grid-cols-2 gap-4 text-xs">
      <div>Pool Wallet: <span class="font-mono text-white">${esc(data.pool_wallet||'—')}</span></div>
      <div>Payout Enabled: <span class="${data.payout_enabled?'text-emerald-400':'text-red-400'} font-bold">${data.payout_enabled?'YES':'NO'}</span></div>
      <div>Blocks Found: <span class="font-mono text-white">${fmt(data.blocks_found,0)}</span></div>
      <div>Last Payout: <span class="font-mono text-white">${esc(data.last_payout_time||'—')}</span></div>
    </div>
    ${data.payouts?.length ? `<div class="mt-3"><div class="text-[10px] text-gray-400 mb-1">Recent Payouts</div>
      <div class="space-y-1">${data.payouts.slice(-5).reverse().map(p=>`<div class="text-xs font-mono bg-white/5 p-2 rounded">Block #${fmt(p.block_height)} — Miner ${fmt(p.fee_split?.miner||0)} Z / Charity ${fmt(p.fee_split?.charity||0)} Z / Dev ${fmt(p.fee_split?.dev||0)} Z</div>`).join('')}</div>
    </div>` : ''}
  `;
}

async function refreshExplorer(){
  const data = await api('/api/explorer');
  if(!data) return;
  const c = $('explorer-content');
  if(!c) return;
  c.innerHTML = `
    <div class="grid grid-cols-2 gap-4 text-xs">
      <div>Chain Height: <span class="font-mono text-white">${fmt(data.chain_height,0)}</span></div>
      <div>Block Reward: <span class="font-mono text-amber-400">${fmt(data.block_reward_zion)} Z</span></div>
      <div>Tip Hash: <span class="font-mono text-gray-400">${esc(data.tip_hash||'—')}</span></div>
      <div>Mempool: <span class="font-mono text-white">${fmt(data.mempool_size,0)}</span> TX</div>
    </div>
    ${data.recent_blocks?.length ? `<div class="mt-3"><div class="text-[10px] text-gray-400 mb-1">Recent Blocks</div>
      <div class="space-y-1">${data.recent_blocks.slice(0,5).map(b=>`<div class="text-xs font-mono bg-white/5 p-2 rounded flex justify-between"><span>#${fmt(b.height)}</span><span class="text-gray-400">${esc(b.hash?.slice(0,16)||'')}</span></div>`).join('')}</div>
    </div>` : ''}
  `;
}

/* ── Actions ──────────────────────────────────────────────── */

async function controlAction(action){
  try{
    const r = await fetch('/api/control', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action})
    });
    const data = await r.json();
    if(data.ok){
      refreshAll();
    }else{
      alert('Action failed: ' + (data.error||'Unknown error'));
    }
  }catch(e){
    console.error('controlAction error:', e);
    alert('Action failed: ' + e.message);
  }
}

function viewLog(svcId){
  window.open('/api/service-log?id='+encodeURIComponent(svcId)+'&lines=200', '_blank');
}

/* ── Auto Refresh ─────────────────────────────────────────── */

function toggleAutoRefresh(){
  autoRefresh = !autoRefresh;
  const btn = $('btn-autorefresh');
  if(btn){
    btn.className = autoRefresh
      ? 'p-2 rounded-lg bg-emerald-700/30 hover:bg-emerald-700/50 border border-emerald-500/30 transition'
      : 'p-2 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 border border-gray-500/30 transition';
    btn.title = autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF';
  }
  if(autoRefresh && !refreshTimer) startAutoRefresh();
  if(!autoRefresh && refreshTimer){ clearInterval(refreshTimer); refreshTimer = null; }
}

function startAutoRefresh(){
  if(refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshAll, REFRESH_INTERVAL);
}

/* ── Init ─────────────────────────────────────────────────── */

function esc(s){
  if(s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function init(){
  initCharts();
  refreshAll();
  startAutoRefresh();
  console.log('[ZION V3 Dashboard] Initialized');
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
}else{
  init();
}
