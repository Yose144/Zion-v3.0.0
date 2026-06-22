'use strict';

const TABS = ['overview','nodes','orchestrator','wallets','explorer','services','alerts','l1','l2','l3','l4','l5','l6','bridge','genesis','blockers','ops','charts','events','env','database','metrics','launch-day','wizard','logs','hiran','dao','payout','backups','topology','miner-live','settings','fleet','agent','warp','ai-agents','ncl-jobs'];
let autoRefresh = true, refreshTimer = null, currentTab = 'overview';
let charts = {};
let _payoutSseSource = null;  // EventSource for real-time payout events
let _payoutTimer = null;      // Fallback poll timer for payout tab
let friendlyMode = false;
let _overviewWidgetTimer = null;
let _countdownTimer = null;
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

// Safe fetch wrapper: checks .ok, throws on HTTP error, parses JSON
async function apiFetch(url, opts={}){
  const res = await fetch(url, opts);
  if(!res.ok) throw new Error('HTTP ' + res.status + ' on ' + url);
  return res.json();
}

// Debounce utility for expensive refresh calls
function debounce(fn, ms){
  let timer;
  return function(...args){
    clearTimeout(timer);
    timer = setTimeout(()=>fn.apply(this, args), ms);
  };
}

// Connection status tracking
let connectionOk = true;
let consecutiveFailures = 0;
function updateConnectionStatus(ok){
  const wasOk = connectionOk;
  if(ok){ consecutiveFailures = 0; connectionOk = true; }
  else { consecutiveFailures++; if(consecutiveFailures >= 3) connectionOk = false; }
  const badge = document.getElementById('connection-badge');
  if(badge){
    badge.textContent = connectionOk ? '● Connected' : '● Disconnected';
    badge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold ' + (connectionOk ? 'bg-emerald-700/50 text-emerald-300' : 'bg-red-700/50 text-red-300');
  }
  // Adaptive refresh: slow down when disconnected, speed up when reconnected
  if(autoRefresh && wasOk !== connectionOk && refreshTimer){
    clearInterval(refreshTimer);
    refreshTimer = setInterval(refreshAll, connectionOk ? REFRESH_INTERVAL_OK : REFRESH_INTERVAL_SLOW);
  }
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

function clearTabTimers(except){
  const timers = {
    alerts: _alertsTimer, services: _servicesTimer, nodes: _nodesTimer,
    explorer: _explorerTimer, genesis: _genesisTimer, blockers: _blockersTimer,
    minerLive: _minerLiveTimer, bridge: _bridgeTimer, hiran: _hiranTimer,
    topology: _topologyTimer, dao: _daoTimer, backups: _backupsTimer,
  };
  Object.entries(timers).forEach(([key, t]) => {
    if(key !== except && t){ clearInterval(t); timers[key] = null; }
  });
  if(except !== 'alerts') _alertsTimer = null;
  if(except !== 'services') _servicesTimer = null;
  if(except !== 'nodes') _nodesTimer = null;
  if(except !== 'explorer') _explorerTimer = null;
  if(except !== 'genesis') _genesisTimer = null;
  if(except !== 'blockers') _blockersTimer = null;
  if(except !== 'minerLive') _minerLiveTimer = null;
  if(except !== 'bridge') _bridgeTimer = null;
  if(except !== 'hiran') _hiranTimer = null;
  if(except !== 'topology') _topologyTimer = null;
  if(except !== 'backups') _backupsTimer = null;
  if(except !== 'dao') _daoTimer = null;
  if(except !== 'payout'){ clearInterval(_payoutTimer); _payoutTimer = null; }
}

function switchTab(name){
  currentTab = name;
  TABS.forEach(t => {
    const pane = document.getElementById('pane-' + t);
    const btn = document.getElementById('tab-' + t);
    if(pane){
      pane.style.setProperty('display', (t === name) ? 'block' : 'none', 'important');
    }
    if(btn) btn.classList.toggle('tab-active', t === name);
  });

  // ── Auto-refresh timers ─────────────────────────────────────────────
  if(name === 'alerts'){ clearTabTimers('alerts'); loadAlertHistory(); if(!_alertsTimer) _alertsTimer = setInterval(loadAlertHistory, 8000); }
  else if(name === 'services'){ clearTabTimers('services'); loadServices(); if(!_servicesTimer) _servicesTimer = setInterval(loadServices, 5000); }
  else if(name === 'nodes'){ clearTabTimers('nodes'); loadCliNodeStatus(); if(!_nodesTimer) _nodesTimer = setInterval(loadCliNodeStatus, 6000); }
  else if(name === 'explorer'){ clearTabTimers('explorer'); loadExplorer(); if(!_explorerTimer) _explorerTimer = setInterval(loadExplorer, 10000); }
  else if(name === 'genesis'){ clearTabTimers('genesis'); loadGenesis(); if(!_genesisTimer) _genesisTimer = setInterval(loadGenesis, 10000); }
  else if(name === 'blockers'){ clearTabTimers('blockers'); loadBlockers(); if(!_blockersTimer) _blockersTimer = setInterval(loadBlockers, 10000); }
  else if(name === 'miner-live'){ clearTabTimers('minerLive'); refreshMinerLive(); if(!_minerLiveTimer) _minerLiveTimer = setInterval(refreshMinerLive, 5000); }
  else if(name === 'bridge'){ clearTabTimers('bridge'); loadBridgeStats(); refreshBridgeHistory(); if(!_bridgeTimer) _bridgeTimer = setInterval(loadBridgeStats, 8000); }
  else if(name === 'hiran'){ clearTabTimers('hiran'); loadAgentList(); checkAiStatus(); if(!_hiranTimer) _hiranTimer = setInterval(()=>{loadAgentList(); checkAiStatus();}, 10000); }
  else if(name === 'topology'){ clearTabTimers('topology'); loadTopology(); if(!_topologyTimer) _topologyTimer = setInterval(loadTopology, 10000); }
  else if(name === 'dao'){ clearTabTimers('dao'); loadDaoAll(); if(!_daoTimer) _daoTimer = setInterval(loadDaoAll, 10000); }
  else if(name === 'payout'){ clearTabTimers(null); loadPayoutTab(); connectPayoutSse(); if(!_payoutTimer) _payoutTimer = setInterval(loadPayoutTab, 10000); }
  else { clearTabTimers(null); disconnectPayoutSse(); }

  if(name === 'charts') renderCharts();
  if(name === 'events') loadEvents();
  if(name === 'env') loadEnvFiles();
  if(name === 'wizard') renderWizard();
  if(name === 'logs'){ initLogPane(); }
  if(name === 'ops' || name === 'controls'){ renderControls(); loadBackupList(); loadDepGraphControls(); loadProcessRegistry(); }
  if(name === 'database') loadDatabases();
  if(name === 'metrics') renderMetricsButtons();
  if(name === 'wallets') loadWallets();
  if(name === 'backups'){ clearTabTimers('backups'); loadBackups(); if(!_backupsTimer) _backupsTimer = setInterval(loadBackups, 15000); }
  if(['l1','l2','l3','l4','l5','l6'].includes(name)) loadLayerFull(name);
  if(name === 'launch-day'){ loadLaunchDayStatus(); if(typeof startLaunchCountdown==='function') startLaunchCountdown(); loadGenesisBackupList(); }

  // ── NCL / Hiran auto-refresh ────────────────────────────────────────
  if(name === 'hiran'){
    if(typeof loadNclFull === 'function') try { loadNclFull(); } catch(e){}
    if(!_nclAutoTimer) _nclAutoTimer = setInterval(function(){ if(typeof loadNclFull==='function') loadNclFull(); }, 10000);
  } else {
    clearInterval(_nclAutoTimer); _nclAutoTimer = null;
  }

  // ── Agent / Fleet / Settings / Miner-live extra hooks ──────────────
  if(name === 'agent'){ if(typeof refreshAgentPanel==='function') try{refreshAgentPanel();}catch(e){} if(typeof refreshAgentRewards==='function') try{refreshAgentRewards();}catch(e){} }
  if(name === 'fleet'){ if(typeof refreshFleet==='function') try{refreshFleet();}catch(e){} }
  if(name === 'settings'){ if(typeof loadSettingsIntoForm==='function') try{loadSettingsIntoForm();}catch(e){} }
  if(name === 'nodes'){ if(typeof refreshAgentNodes==='function') try{refreshAgentNodes();}catch(e){} if(typeof refreshAgentRewards==='function') try{refreshAgentRewards();}catch(e){} }
  if(name === 'warp'){ loadWarpPanel(); }
  if(name === 'ai-agents'){ loadAiAgentsPanel(); }
  if(name === 'ncl-jobs'){ loadNclJobsPanel(); }
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
  console.log('[REFRESH] Starting refreshAll...');
  try {
    const [s, cl, al, blk, res] = await Promise.allSettled([
      apiFetch('/api/status'),
      apiFetch('/api/checklist'),
      apiFetch('/api/alerts'),
      apiFetch('/api/blockers'),
      apiFetch('/api/resources').catch(() => ({})),
    ]);
    console.log('[REFRESH] APIs returned:', {status: s.status, checklist: cl.status, alerts: al.status, blockers: blk.status, resources: res.status});
    // Unwrap settled results
    const unwrap = (p) => p.status === 'fulfilled' ? p.value : {};
    const statusData = unwrap(s);
    const checklistData = unwrap(cl);
    const alertsData = unwrap(al);
    const blockersData = unwrap(blk);
    const resourcesData = unwrap(res);
    
    // Store current status for topology-aware functions
    window.currentStatus = statusData;
    console.log('[REFRESH] statusData topology:', statusData.topology, 'node1 height:', statusData.node1?.chain_height);

    const tsEl = document.getElementById('timestamp');
    if(tsEl) tsEl.textContent = '⏱ ' + new Date(statusData.timestamp).toLocaleTimeString();
    // Update topology badge
    const topoBadge = document.getElementById('topology-badge');
    if(topoBadge && statusData.topology){
      topoBadge.textContent = statusData.topology === 'edge-primary' ? '🌍 Edge-Primary' : '🔷 Local-Dev';
      topoBadge.className = statusData.topology === 'edge-primary' 
        ? 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-700/50 text-purple-300'
        : 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-700/50 text-blue-300';
    }
    document.getElementById('progressText').textContent = checklistData.passed + '/' + checklistData.total;
    document.getElementById('progressBar').style.width = checklistData.pct + '%';

    // Hero stats (topology-aware)
    const isEdge = statusData.topology === 'edge-primary';
    const live = isEdge
      ? [statusData.node1, statusData.edge_node, statusData.pool, statusData.miner].filter(x => x && x.running).length
      : [statusData.node1, statusData.node2, statusData.pool, statusData.miner].filter(x => x && x.running).length;
    document.getElementById('hero-services-up').textContent = live;
    document.getElementById('hero-blockers-open').textContent = blockersData.open;
    const heroHeight = isEdge ? (statusData.edge_node?.chain_height ?? statusData.node1?.chain_height) : statusData.node1?.chain_height;
    document.getElementById('hero-chain-height').textContent = heroHeight ?? '—';
    document.getElementById('hero-status-kicker').textContent = blockersData.ready_for_launch
      ? '✅ Ready · All P0 Blockers Resolved'
      : '⏳ Pre-Launch · ' + blockersData.open_critical + ' critical blockers';

    updateServiceCards(statusData);
    await updateServiceTelemetryDetails(statusData);
    refreshEdgeServerCard(); // non-blocking, cached 30s
    updateAlerts(alertsData.alerts);
    updateChecklist(checklistData.checks);
    updateLayerServices();
    updateMiniHashrate();
    updateConnectedMiners();
    loadCliNodeStatus();
    updateResourceBars(resourcesData);
    // Feed overview built-in charts with system_cpu/system_mem from resources
    if(typeof feedOverviewCharts === 'function'){
      const chartData = { ...statusData, system_cpu: resourcesData.cpu_percent || 0, system_mem: resourcesData.mem_percent || 0 };
      feedOverviewCharts(chartData);
    }

    if(currentTab === 'charts') renderCharts();
    if(currentTab === 'events') loadEvents();
    if(currentTab === 'wizard') renderWizard();
    if(currentTab === 'ops') loadOps();
    if(currentTab === 'topology') loadTopology();
    if(currentTab === 'payout') loadPayoutTab();
    if(currentTab === 'wallets') { loadWallets(); loadWalletStatus(); }
    if(currentTab === 'explorer') loadExplorer();
    if(currentTab === 'hiran') loadAiStatus();
    if(currentTab === 'overview') { loadMempool(); loadMonitoringStatus(); }
    if(currentTab === 'controls') { loadMinerPerformance(); loadDepGraphControls(); }
    updateMainnetMetrics(statusData);
    updateConnectionStatus(true);
    loadEdgeBackupStatus();
    console.log('[REFRESH] refreshAll completed successfully');
  } catch(e){
    console.error('[REFRESH] refreshAll error:', e);
    updateConnectionStatus(false);
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
  const en = s.edge_node, n1 = s.node1, n2 = s.node2, p = s.pool, m = s.miner;
  const isEdgePrimary = s.topology === 'edge-primary';
  // Topology-aware visibility
  const node2Card = document.getElementById('card-node2');
  if(node2Card) node2Card.classList.toggle('hidden', isEdgePrimary);
  const edgeNodeCard = document.getElementById('card-edge-node');
  if(edgeNodeCard) edgeNodeCard.classList.toggle('hidden', !isEdgePrimary);

  // Edge Node (Primary)
  setBadge('badge-edge-node', en && en.running); setCardLive('edge-node', en && en.running);
  const enh = document.getElementById('val-edge-node-height');
  if(enh) enh.textContent = en ? (en.chain_height ?? '—') : '—';
  const enhash = document.getElementById('val-edge-node-hash');
  if(enhash) enhash.textContent = en ? (en.tip_hash ?? '—') : '—';
  const enp = document.getElementById('val-edge-node-peers');
  if(enp) enp.textContent = en ? (en.known_peers ?? '—') : '—';

  // Local Backup Node
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
  // Sync status for Local Backup Node (edge-primary) or Node1 (local-dev)
  const n1syncEl = document.getElementById('val-node1-sync');
  if(n1syncEl){
    const refHeight = isEdgePrimary ? (en ? (en.chain_height ?? 0) : 0) : (n2 ? (n2.chain_height ?? 0) : 0);
    const localH = n1.chain_height ?? 0;
    const gap = refHeight > 0 && localH > 0 ? Math.abs(refHeight - localH) : null;
    // Prefer server-computed sync_gap if available
    const serverGap = n1.sync_gap ?? gap;
    const synced = serverGap !== null && serverGap !== undefined && serverGap <= 5;
    if(serverGap === null || serverGap === undefined){
      n1syncEl.textContent = localH > 0 ? 'Syncing…' : 'No data';
      n1syncEl.className = 'text-gray-400';
    } else if(synced){
      n1syncEl.textContent = '✓ Synced (gap: ' + serverGap + ')';
      n1syncEl.className = 'text-emerald-400 font-bold text-xs';
    } else {
      n1syncEl.textContent = '⚠ Behind (gap: ' + serverGap + ')';
      n1syncEl.className = 'text-amber-400 text-xs';
    }
  }

  // Node 2 (Dev / Optional)
  if(!isEdgePrimary){
    setBadge('badge-node2', n2.running); setCardLive('node2', n2.running);
    const n2h = document.getElementById('val-node2-height');
    if(n2h) n2h.textContent = n2.chain_height ?? '—';
    const n2id = document.getElementById('val-node2-id');
    if(n2id) n2id.textContent = n2.node_id ?? '—';
    const n2p = document.getElementById('val-node2-peers');
    if(n2p) n2p.textContent = n2.known_peers ?? '—';
    const synced = en && en.chain_height && n1.chain_height && n1.chain_height >= en.chain_height - 5;
    const syncEl = document.getElementById('val-node2-sync');
    if(syncEl){
      syncEl.textContent = synced ? '✓ Synced' : (n2.known_peers > 0 ? 'Syncing…' : 'No peers');
      syncEl.className = synced ? 'text-emerald-400 font-bold' : 'text-amber-400';
    }
    const n2m = document.getElementById('val-node2-mempool');
    if(n2m) n2m.textContent = n2.mempool_size ?? '—';
    const n2u = document.getElementById('val-node2-uptime');
    if(n2u) n2u.textContent = formatUptime(n2.uptime_seconds);
  }

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

  setBadge('badge-miner', m.running); setCardLive('miner', m.running);
  const mh = document.getElementById('val-miner-hashrate');
  if(mh) mh.textContent = m.hashrate ? m.hashrate.toFixed(2) : '—';
  const mg = document.getElementById('val-miner-gpu');
  if(mg) mg.textContent = (m.gpu_backend ? m.gpu_backend + ': ' : '') + (m.gpu_device ?? '—');
  const mb = document.getElementById('val-miner-backend');
  if(mb) mb.textContent = m.gpu_backend ?? 'cpu';
  const mw = document.getElementById('val-miner-worker');
  if(mw) mw.textContent = (m.miner_id ? m.miner_id + ' / ' : '') + (m.worker_name ?? '—');
  const mwl = document.getElementById('val-miner-wallet');
  if(mwl) mwl.textContent = m.payout_address ?? m.wallet ?? '—';
  const mon = document.getElementById('val-miner-onchain');
  if(mon) mon.textContent = m.on_chain_balance_zion != null ? _zionFmt(m.on_chain_balance_zion) + ' Z' : '—';
  const monts = document.getElementById('val-miner-onchain-ts');
  if(monts) {
    const ts = m.on_chain_balance_updated;
    if(ts) {
      const d = new Date(ts);
      monts.textContent = d.toLocaleTimeString();
    } else {
      monts.textContent = '';
    }
  }
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
      msgEl.textContent = '⚠️ Miner not running.';
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

// ─────────────────────────────────────────────────────────────────────
// Edge Server System Health Card
// ─────────────────────────────────────────────────────────────────────
let _edgeServerLastFetch = 0;
async function refreshEdgeServerCard(force = false) {
  try {
    const now = Date.now();
    if (!force && (now - _edgeServerLastFetch) < 30000) return; // cache 30s
    _edgeServerLastFetch = now;

    const res = await fetch('/api/edge-status' + (force ? '?force=1' : ''), {
      method: force ? 'POST' : 'GET',
      headers: force ? {'Content-Type':'application/json'} : undefined,
      body: force ? JSON.stringify({force: true}) : undefined,
    });
    const d = await res.json();
    _renderEdgeServerCard(d);
  } catch(e) {
    const badge = document.getElementById('badge-edge-server');
    if(badge){ badge.textContent = 'ERR'; badge.className = 'px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/20 text-red-300'; }
  }
}

function _renderEdgeServerCard(d) {
  const badge = document.getElementById('badge-edge-server');

  if (!d.ok) {
    if(badge){ badge.textContent = 'SSH ERR'; badge.className = 'px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/20 text-red-300'; }
    const grid = document.getElementById('edge-services-grid');
    if(grid) grid.innerHTML = `<div class="col-span-full text-xs text-red-400 py-2">SSH error: ${escapeHtml(d.error || 'unknown')}</div>`;
    return;
  }

  // Badge
  if(badge){ badge.textContent = 'LIVE'; badge.className = 'px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'; }

  // CPU
  const cpuEl = document.getElementById('edge-cpu');
  const loadEl = document.getElementById('edge-load');
  if(cpuEl) cpuEl.textContent = d.cpu_pct != null ? d.cpu_pct.toFixed(1) + '%' : '—';
  if(loadEl) loadEl.textContent = d.load_1m != null ? 'load ' + d.load_1m.toFixed(2) : 'load —';
  if(cpuEl && d.cpu_pct != null) cpuEl.className = 'text-xl font-bold ' + (d.cpu_pct > 80 ? 'text-red-400' : d.cpu_pct > 50 ? 'text-amber-400' : 'text-emerald-400');

  // Memory
  const memPct = document.getElementById('edge-mem-pct');
  const memDet = document.getElementById('edge-mem-detail');
  const memTop = document.getElementById('edge-mem-top');
  if(memPct) memPct.textContent = d.mem_pct != null ? d.mem_pct + '%' : '—';
  if(memDet && d.mem_used_mb != null) memDet.textContent = (d.mem_used_mb/1024).toFixed(1) + ' / ' + (d.mem_total_mb/1024).toFixed(1) + ' GB';
  if(memPct && d.mem_pct != null) memPct.className = 'text-xl font-bold ' + (d.mem_pct > 85 ? 'text-red-400' : d.mem_pct > 70 ? 'text-amber-400' : 'text-blue-400');
  if(memTop && d.mem_top) {
    memTop.innerHTML = d.mem_top.slice(0, 5).map((p, i) => {
      const name = p.cmd.replace(/^.*\//, '').replace(/^python3?\d*$/, 'python').slice(0, 18);
      const color = i === 0 ? 'text-red-400' : i === 1 ? 'text-amber-400' : 'text-gray-500';
      return `<div class="text-[9px] font-mono ${color} flex justify-between"><span>${escapeHtml(name)}</span><span>${p.mb.toFixed(0)}M</span></div>`;
    }).join('');
  } else if(memTop) {
    memTop.innerHTML = '';
  }

  // Memory trend
  const memTrend = document.getElementById('edge-mem-trend');
  if(memTrend && d.mem_history && d.mem_history.length >= 2) {
    const hist = d.mem_history;
    const first = hist[0];
    const last = hist[hist.length - 1];
    const diff = last.mem_pct - first.mem_pct;
    const arrow = diff > 1 ? '▲' : diff < -1 ? '▼' : '→';
    const color = diff > 1 ? 'text-red-400' : diff < -1 ? 'text-emerald-400' : 'text-gray-500';
    memTrend.textContent = `${arrow} ${diff > 0 ? '+' : ''}${diff.toFixed(1)}% / ${((last.mem_used_mb - first.mem_used_mb)/1024).toFixed(2)} GB`;
    memTrend.className = `text-[9px] font-mono mt-1 ${color}`;
  } else if(memTrend) {
    memTrend.textContent = '';
  }

  // Show memory limit button when RAM is high and rising
  const memLimitBtn = document.getElementById('btn-edge-mem-limit');
  if(memLimitBtn && d.mem_pct != null) {
    const rising = d.mem_history && d.mem_history.length >= 2 && (d.mem_history[d.mem_history.length-1].mem_pct - d.mem_history[0].mem_pct) > 0.5;
    memLimitBtn.classList.toggle('hidden', !(d.mem_pct > 75 || rising));
  }

  // Disk
  const diskPct = document.getElementById('edge-disk-pct');
  const diskDet = document.getElementById('edge-disk-detail');
  if(diskPct) diskPct.textContent = d.disk_pct != null ? d.disk_pct + '%' : '—';
  if(diskDet && d.disk_free_gb != null) diskDet.textContent = d.disk_free_gb + ' GB free';
  if(diskPct && d.disk_pct != null) diskPct.className = 'text-xl font-bold ' + (d.disk_pct > 85 ? 'text-red-400' : d.disk_pct > 65 ? 'text-amber-400' : 'text-emerald-400');

  // Services grid
  const SVC_LABELS = {
    'zion-edge-node1':   { icon: '🔷', label: 'Node 1', url: 'http://77.42.71.94:8443' },
    'zion-edge-node2':   { icon: '🔶', label: 'Node 2', url: 'http://77.42.71.94:8446' },
    'zion-pool-server':  { icon: '⚡', label: 'Pool',   url: 'http://77.42.71.94:8444' },
    'zion-edge-dao':     { icon: '🏛️', label: 'DAO',    url: 'http://77.42.71.94:8450' },
    'zion-edge-warp':    { icon: '🌀', label: 'WARP',   url: 'http://77.42.71.94:8453' },
    'zion-edge-dashboard': { icon: '📊', label: 'Rust DB', url: 'http://77.42.71.94:8888' },
    'hiran-inference':   { icon: '🤖', label: 'Hiran',  url: null },
    'hiranyagarbha':     { icon: '🧠', label: 'Orch',   url: 'http://77.42.71.94:8001' },
  };
  // Also add PM2 processes (website)
  const pm2Labels = { 'zion-website': { icon: '🌐', label: 'Website', url: 'https://zionterranova.com' } };

  const svcs = d.services || {};
  const pm2 = d.pm2 || {};
  let okCount = 0;

  const cards = [];
  // systemd services
  for(const [svc, meta] of Object.entries(SVC_LABELS)){
    const st = svcs[svc] || 'unknown';
    const ok = st === 'active';
    if(ok) okCount++;
    const color = ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : (st === 'unknown' ? 'bg-white/5 border-white/10 text-gray-500' : 'bg-red-500/10 border-red-500/30 text-red-400');
    const dot = ok ? '🟢' : (st === 'unknown' ? '⚪' : '🔴');
    const link = meta.url ? ` onclick="window.open('${meta.url}','_blank')" style="cursor:pointer"` : '';
    cards.push(`<div class="rounded-lg border p-2 text-center ${color}"${link}>
      <div class="text-base mb-0.5">${meta.icon}</div>
      <div class="text-[10px] font-semibold">${meta.label}</div>
      <div class="text-[9px] mt-0.5 opacity-70">${dot} ${st}</div>
    </div>`);
  }
  // PM2 services
  for(const [name, meta] of Object.entries(pm2Labels)){
    const st = pm2[name] || 'unknown';
    const ok = st === 'online';
    if(ok) okCount++;
    const color = ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : (st === 'unknown' ? 'bg-white/5 border-white/10 text-gray-500' : 'bg-red-500/10 border-red-500/30 text-red-400');
    const dot = ok ? '🟢' : (st === 'unknown' ? '⚪' : '🔴');
    const link = meta.url ? ` onclick="window.open('${meta.url}','_blank')" style="cursor:pointer"` : '';
    cards.push(`<div class="rounded-lg border p-2 text-center ${color}"${link}>
      <div class="text-base mb-0.5">${meta.icon}</div>
      <div class="text-[10px] font-semibold">${meta.label}</div>
      <div class="text-[9px] mt-0.5 opacity-70">${dot} ${st}</div>
    </div>`);
  }

  const grid = document.getElementById('edge-services-grid');
  if(grid) grid.innerHTML = cards.join('');

  const okEl = document.getElementById('edge-svcs-ok');
  if(okEl){ okEl.textContent = okCount; okEl.className = 'text-xl font-bold ' + (okCount >= 5 ? 'text-emerald-400' : okCount >= 3 ? 'text-amber-400' : 'text-red-400'); }

  // Ports
  const PORT_LABELS = {8333:'P2P1',8334:'P2P2',8443:'RPC1',8444:'Stratum',8450:'DAO',8453:'WARP',3000:'Web',3100:'Grafana',9090:'Prometheus'};
  const ports = d.ports || {};
  const portsRow = document.getElementById('edge-ports-row');
  if(portsRow){
    portsRow.innerHTML = Object.entries(PORT_LABELS).map(([port, label]) => {
      const open = ports[parseInt(port)];
      const cls = open === true ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : open === false ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/5 text-gray-500 border-white/10';
      const sym = open === true ? '✓' : open === false ? '✗' : '?';
      return `<span class="text-[10px] px-2 py-0.5 rounded border font-mono ${cls}">${sym} :${port} ${label}</span>`;
    }).join('');
  }
}

// ── Edge action buttons ──────────────────────────────────────────────
async function edgeAction(action) {
  const ACTION_LABELS = {
    'restart-node1': 'Restart Edge Node 1',
    'restart-node2': 'Restart Edge Node 2',
    'restart-pool': 'Restart Edge Pool',
    'restart-dao': 'Restart Edge DAO',
    'restart-warp': 'Restart Edge WARP',
    'restart-dashboard': 'Restart Edge Dashboard',
    'clean-docker': 'Clean Docker on Edge',
    'backup-edge': 'Backup Edge Server',
    'security-audit': 'Security Audit',
    'full-health': 'Full Health Check',
  };
  const label = ACTION_LABELS[action] || action;
  if(!confirm(`Run "${label}" on Edge server (77.42.71.94)?`)) return;

  toast(`Running: ${label}…`, 'success');
  try {
    const res = await fetch('/api/edge-action', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({action}),
    });
    const d = await res.json();
    if(d.ok){
      toast(`${label}: ${d.result || 'OK'}`, 'success');
      // Force refresh edge status after a few seconds
      setTimeout(() => refreshEdgeServerCard(true), 3000);
    } else {
      toast(`${label} failed: ${d.error || 'unknown'}`, 'error');
    }
  } catch(e) {
    toast(`${label} error: ${e.message}`, 'error');
  }
}

// ── Service Telemetry Detail Cards (Overview panel) ──
async function updateServiceTelemetryDetails(s){
  const container = document.getElementById('overview-telemetry-details');
  if(!container) return;

  // Fetch live infra telemetry from Edge directly (CORS permissive on Edge infra dashboard)
  let infra = null;
  let overview = null;
  try {
    const [infraRes, ovRes] = await Promise.all([
      fetch('http://100.76.16.108:8888/api/infra').then(r => r.json()).catch(() => null),
      fetch('http://100.76.16.108:8888/api/overview').then(r => r.json()).catch(() => null),
    ]);
    infra = infraRes;
    overview = ovRes;
  } catch(e) {
    console.warn('Edge infra fetch failed:', e);
  }

  const isEdge = s.topology === 'edge-primary';
  const en = s.edge_node, n1 = s.node1, p = s.pool, m = s.miner;
  const pe = s.pool_edge ?? {};

  // Build service list — prefer Edge infra data when available
  const services = [];

  // Node
  const nodeInfra = infra?.node;
  services.push({
    key:'node', label:'Node', cls:'tdc-node',
    running: isEdge ? (en && en.running) : (n1 && n1.running),
    data: isEdge ? en : n1,
    infra: nodeInfra,
    fields: (d, i)=>[
      ['Height', d?.chain_height ?? '—'],
      ['Peers', d?.known_peers ?? '—'],
      ['Chain', d?.network ?? d?.chain ?? 'ZION Mainnet'],
      ['Version', d?.version ?? '—'],
      ...(i ? [['Latency', i.latency_ms != null ? i.latency_ms + ' ms' : '—'], ['Endpoint', i.url ?? '—']] : []),
    ],
  });

  // Edge Pool
  const poolInfra = infra?.pool;
  services.push({
    key:'pool-edge', label:'Edge Pool', cls:'tdc-pool',
    running: pe && pe.running,
    data: pe,
    infra: poolInfra,
    fields: (d, i)=>[
      ['Hashrate', d?.hashrate ? d.hashrate.toFixed(2) + ' KH/s' : '—'],
      ['Miners', d?.active_miners ?? '—'],
      ['Blocks', d?.blocks_found ?? '—'],
      ['Port', d?.ports_open?.[0]?.split(':')[1] ?? '8444'],
      ...(i ? [['Latency', i.latency_ms != null ? i.latency_ms + ' ms' : '—']] : []),
    ],
  });

  // DAO
  const daoInfra = infra?.dao;
  if(s.dao || daoInfra){
    services.push({
      key:'dao', label:'DAO', cls:'tdc-dao',
      running: s.dao ? s.dao.running : (daoInfra?.reachable ?? false),
      data: s.dao || {},
      infra: daoInfra,
      fields: (d, i)=>[
        ['Status', d?.status ?? '—'],
        ['Ports', (d?.ports_open?.length ?? 0) + ' / ' + ((d?.ports_open?.length ?? 0)+(d?.ports_closed?.length ?? 0))],
        ...(i?.data ? [['Version', i.data.data?.version ?? '—'], ['Service', i.data.data?.data?.service ?? '—']] : []),
        ...(i ? [['Latency', i.latency_ms != null ? i.latency_ms + ' ms' : '—']] : []),
      ],
    });
  }

  // WARP
  const warpInfra = infra?.warp;
  if(s.warp || warpInfra){
    services.push({
      key:'warp', label:'WARP', cls:'tdc-warp',
      running: s.warp ? s.warp.running : (warpInfra?.reachable ?? false),
      data: s.warp || {},
      infra: warpInfra,
      fields: (d, i)=>[
        ['Status', d?.status ?? '—'],
        ['Ports', (d?.ports_open?.length ?? 0) + ' / ' + ((d?.ports_open?.length ?? 0)+(d?.ports_closed?.length ?? 0))],
        ...(i?.data ? [['Transfers', i.data.transfers_total ?? '—'], ['Pending', i.data.transfers_pending ?? '—'], ['Version', i.data.version ?? '—']] : []),
        ...(i ? [['Latency', i.latency_ms != null ? i.latency_ms + ' ms' : '—']] : []),
      ],
    });
  }

  // Bridge
  const bridgeInfra = infra?.bridge;
  if(bridgeInfra){
    services.push({
      key:'bridge', label:'Bridge', cls:'tdc-warp',
      running: bridgeInfra?.reachable ?? false,
      data: {},
      infra: bridgeInfra,
      fields: (d, i)=>[
        ['Status', i?.reachable ? 'Reachable' : 'Unreachable'],
        ...(i ? [['Latency', i.latency_ms != null ? i.latency_ms + ' ms' : '—'], ['Endpoint', i.url ?? '—']] : []),
      ],
    });
  }

  // Agent
  const agentInfra = infra?.agent;
  if(agentInfra){
    services.push({
      key:'agent', label:'Agent', cls:'tdc-agent',
      running: agentInfra?.reachable ?? false,
      data: {},
      infra: agentInfra,
      fields: (d, i)=>[
        ['Status', i?.reachable ? 'Reachable' : 'Unreachable'],
        ...(i?.data ? [['Mode', i.data.mode ?? '—'], ['GPUs', i.data.gpu_count ?? '—']] : []),
        ...(i ? [['Latency', i.latency_ms != null ? i.latency_ms + ' ms' : '—']] : []),
      ],
    });
  }

  // Website
  const webInfra = infra?.website;
  if(webInfra){
    services.push({
      key:'website', label:'Website', cls:'tdc-website',
      running: webInfra?.reachable ?? false,
      data: {},
      infra: webInfra,
      fields: (d, i)=>[
        ['Status', i?.reachable ? 'Reachable' : 'Unreachable'],
        ...(i ? [['Latency', i.latency_ms != null ? i.latency_ms + ' ms' : '—'], ['Endpoint', i.url ?? '—']] : []),
      ],
    });
  }

  // Miner (local)
  services.push({
    key:'miner', label:'Miner', cls:'tdc-agent',
    running: m && m.running,
    data: m,
    fields: (d)=>[
      ['Hashrate', d?.hashrate ? d.hashrate.toFixed(2) + ' H/s' : '—'],
      ['Backend', d?.gpu_backend ?? 'cpu'],
      ['Device', d?.gpu_device ?? '—'],
      ['Pool', d?.pool_addr ?? '—'],
    ],
  });

  container.innerHTML = services.map(svc=>{
    const online = svc.running;
    const statusClass = online ? 'tdc-online' : 'tdc-offline';
    const statusText = online ? 'Online' : 'Offline';
    const d = svc.data || {};
    const i = svc.infra || null;
    const rows = svc.fields(d, i).map(([label,value])=>`
      <div class="tdc-row">
        <div class="tdc-label">${escapeHtml(label)}</div>
        <div class="tdc-value${String(value).length > 20 ? ' small' : ''}">${escapeHtml(value)}</div>
      </div>
    `).join('');

    return `
      <div class="telemetry-detail-card ${escapeHtml(svc.cls)}">
        <div class="tdc-header">
          <div class="tdc-name">${escapeHtml(svc.label)}</div>
          <span class="tdc-status ${statusClass}">${statusText}</span>
        </div>
        <div class="tdc-body">
          <div class="tdc-row">
            <div class="tdc-label">Uptime</div>
            <div class="tdc-value">${formatUptime(d?.uptime_seconds)}</div>
          </div>
          <div class="tdc-row">
            <div class="tdc-label">PID</div>
            <div class="tdc-value">${d?.pid ?? '—'}</div>
          </div>
          ${rows}
        </div>
      </div>
    `;
  }).join('');
}

// ── Layer Services (L2–L6) mini-cards ──
async function updateLayerServices(){
  try{
    const res = await fetch('/api/services').then(r => r.json());
    const services = res.services || [];
    const isEdgePrimary = window.currentStatus?.topology === 'edge-primary';
    const map = {
      'bridge': 'val-bridge-status',
      'dao': 'val-dao-status',
      'atomic-swap': 'val-swap-status',
      'warp': 'val-warp-status',
      'hiranyagarbha': 'val-hiranya-status',
      'oasis': 'val-oasis-status',
      'free-world': 'val-free-world-status',
      'issobella': 'val-issobella-status',
    };
    for(const [sid, elId] of Object.entries(map)){
      const svc = services.find(s => s.id === sid);
      const el = document.getElementById(elId);
      const card = document.getElementById('card-' + sid);
      if(!el) continue;
      // In edge-primary mode, services hosted on Edge (not localhost) are expected there
      const host = svc?.host || '127.0.0.1';
      const isEdgeHosted = isEdgePrimary && host !== '127.0.0.1';
      if(svc && svc.alive){
        el.textContent = '● LIVE';
        el.className = 'text-[10px] text-emerald-400 font-bold mt-0.5';
        if(card) card.classList.add('svc-live');
      } else if(svc && isEdgeHosted){
        el.textContent = '● Edge';
        el.className = 'text-[10px] text-blue-400 font-bold mt-0.5';
        if(card) card.classList.remove('svc-live');
      } else if(svc){
        el.textContent = '○ Down';
        el.className = 'text-[10px] text-gray-500 mt-0.5';
        if(card) card.classList.remove('svc-live');
      } else {
        el.textContent = '—';
        el.className = 'text-[10px] text-gray-500 mt-0.5';
        if(card) card.classList.remove('svc-live');
      }
      // Update port details if element exists
      const portsEl = document.getElementById('val-' + sid + '-ports');
      if(portsEl && svc){
        const open = svc.ports_open || [];
        const closed = svc.ports_closed || [];
        const ports = svc.ports || {};
        if(open.length > 0){
          portsEl.innerHTML = open.map(p => `<span class="text-[10px] px-1 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">${escapeHtml(p)}</span>`).join(' ');
        } else if(Object.keys(ports).length > 0){
          portsEl.innerHTML = '<span class="text-[10px] text-gray-500">All ports closed</span>';
        } else {
          portsEl.innerHTML = '<span class="text-[10px] text-gray-500">No ports configured</span>';
        }
      }
      // Update purpose tooltip
      const purposeEl = document.getElementById('val-' + sid + '-purpose');
      if(purposeEl && svc){
        purposeEl.textContent = svc.purpose || '';
      }
    }
  }catch(e){
    console.error('updateLayerServices error:', e);
  }
}

// ── Mainnet Overview Metrics ──
function updateMainnetMetrics(s){
  if(!s) return;
  const isEdge = s.topology === 'edge-primary';
  const en = s.edge_node || {};
  const pe = s.pool_edge || {};
  const tailscale = s.tailscale || {};

  // Tailscale VPN badge
  const tsEl = document.getElementById('val-tailscale-status');
  if(tsEl){
    const ok = tailscale.vpn_ok;
    tsEl.textContent = ok ? '● VPN OK' : '○ VPN Down';
    tsEl.className = 'text-[10px] font-bold ' + (ok ? 'text-emerald-400' : 'text-red-400');
  }

  // Edge Node extra metrics
  const enNet = document.getElementById('val-edge-node-network');
  if(enNet) enNet.textContent = en.network || '—';
  const enProto = document.getElementById('val-edge-node-protocol');
  if(enProto) enProto.textContent = en.protocol_version || '—';
  const enCons = document.getElementById('val-edge-node-consensus');
  if(enCons) enCons.textContent = en.consensus_profile || '—';
  const enBlocks = document.getElementById('val-edge-node-accepted-blocks');
  if(enBlocks) enBlocks.textContent = en.accepted_blocks ?? '—';

  // Sync gap
  const syncEl = document.getElementById('val-sync-gap');
  if(syncEl){
    const gap = pe.sync_gap;
    if(gap != null){
      syncEl.textContent = gap === 0 ? '✓ Synced' : gap + ' blocks behind';
      syncEl.className = 'text-xs font-bold ' + (gap === 0 ? 'text-emerald-400' : 'text-amber-400');
    } else {
      syncEl.textContent = '—';
      syncEl.className = 'text-xs text-gray-500';
    }
  }

  // Pool extra metrics
  const p = s.pool || {};
  const ph = document.getElementById('val-pool-total-hashes');
  if(ph) ph.textContent = p.total_hashes != null ? fmtNum(p.total_hashes) : '—';
  const ps = document.getElementById('val-pool-total-shares');
  if(ps) ps.textContent = p.total_shares != null ? fmtNum(p.total_shares) : '—';
  const phr = document.getElementById('val-pool-hashrate');
  if(phr) phr.textContent = p.hashrate_khs != null ? p.hashrate_khs.toFixed(2) + ' KH/s' : '—';
}

function updatePayouts(p, topology){
  // Update payout section based on topology
  // In edge-primary: pool data comes from Edge pool (pool status object)
  // In local-dev: pool data comes from local pool
  const poolData = topology === 'edge-primary' ? (p || window.currentStatus?.pool) : p;

  const pw = document.getElementById('payout-wallet');
  if(pw) pw.textContent = poolData?.pool_wallet ?? '—';
  const en = document.getElementById('payout-enabled');
  if(en){
    en.textContent = poolData?.payout_enabled === true ? 'YES' : (poolData?.payout_enabled === false ? 'NO' : '—');
    en.className = poolData?.payout_enabled ? 'font-bold text-emerald-400' : 'font-bold text-red-400';
  }
  const pb = document.getElementById('payout-blocks');
  if(pb) pb.textContent = poolData?.blocks_found ?? '0';
  const pn = document.getElementById('payout-nonce');
  if(pn) pn.textContent = poolData?.nonce_count ?? '—';
  const ps = document.getElementById('payout-split');
  if(ps) ps.textContent = poolData?.fee_split ?? '—';
  const pr = document.getElementById('payout-recent');
  if(pr){
    pr.innerHTML = (poolData?.recent_payouts && poolData.recent_payouts.length)
      ? poolData.recent_payouts.map(l => '<div class="truncate text-[10px]">' + escapeHtml(l) + '</div>').join('')
      : '<div class="text-gray-600 italic text-[10px]">No payout events yet</div>';
  }

  // Fetch balance from /api/payout for overview panel
  fetch('/api/payout')
    .then(r => r.ok ? r.json() : null)
    .then(pay => {
      if(!pay) return;
      const balEl = document.getElementById('payout-balance');
      if(balEl && pay.pool_wallet_balance != null){
        balEl.textContent = formatFlowers(pay.pool_wallet_balance);
      }
    })
    .catch(() => {});
}

function formatFlowers(v){
  if(!v && v !== 0) return '—';
  const zion = v / 1_000_000_000_000;
  if(zion >= 1_000_000) return (zion / 1_000_000).toFixed(2) + ' MZION';
  if(zion >= 1_000) return (zion / 1_000).toFixed(2) + ' KZION';
  return zion.toFixed(4) + ' ZION';
}

async function refreshPayout(){
  try{
    const res = await fetch('/api/payout');
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const set = (id, text) => { const el = document.getElementById(id); if(el) el.textContent = text; };
    const setHtml = (id, html) => { const el = document.getElementById(id); if(el) el.innerHTML = html; };

    // Timestamp
    set('payout-last-update', new Date().toLocaleTimeString() + ' refreshed');

    // ── Pool Health Banner ──────────────────────────────────────────
    const ph = data.pool_health || {};
    const healthBanner = document.getElementById('pool-health-banner');
    const healthDot = document.getElementById('pool-health-dot');
    const healthText = document.getElementById('pool-health-text');
    const healthErr = document.getElementById('pool-health-error');
    if(healthBanner && healthDot && healthText){
      const allOk = ph.edge_rpc_ok && ph.edge_stats_ok && ph.tailscale_ok;
      const someOk = ph.edge_rpc_ok || ph.edge_stats_ok || ph.local_rpc_ok;
      if(allOk){
        healthBanner.className = 'zion-panel p-4 border-l-4 border-emerald-500';
        healthDot.className = 'w-3 h-3 rounded-full bg-emerald-500 animate-pulse';
        healthText.className = 'text-sm font-semibold text-emerald-400';
        healthText.textContent = 'Pool Healthy';
      } else if(someOk){
        healthBanner.className = 'zion-panel p-4 border-l-4 border-amber-500';
        healthDot.className = 'w-3 h-3 rounded-full bg-amber-500 animate-pulse';
        healthText.className = 'text-sm font-semibold text-amber-400';
        healthText.textContent = 'Pool Degraded';
      } else {
        healthBanner.className = 'zion-panel p-4 border-l-4 border-red-500';
        healthDot.className = 'w-3 h-3 rounded-full bg-red-500 animate-pulse';
        healthText.className = 'text-sm font-semibold text-red-400';
        healthText.textContent = 'Pool Unreachable';
      }
      set('health-edge-rpc', 'Edge RPC: ' + (ph.edge_rpc_ok ? '✓' : '✗'));
      set('health-edge-stats', 'Edge Stats: ' + (ph.edge_stats_ok ? '✓' : '✗'));
      set('health-tailscale', 'Tailscale: ' + (ph.tailscale_ok ? '✓' : '✗'));
      set('health-local-rpc', 'Local RPC: ' + (ph.local_rpc_ok ? '✓' : '✗'));
      if(ph.error_msg){
        healthErr.textContent = ph.error_msg;
        healthErr.classList.remove('hidden');
      } else if(!ph.edge_stats_ok && data.topology === 'edge-primary'){
        healthErr.textContent = 'Edge pool metrics endpoint (8455) unreachable. Pool may not be running on Edge server.';
        healthErr.classList.remove('hidden');
      } else {
        healthErr.classList.add('hidden');
      }
    }

    // ── Fee Split Bar ───────────────────────────────────────────────
    const fsText = data.fee_split || '89/5/5/1';
    set('fee-split-label', fsText);
    const fsParts = fsText.split('/').map(x => parseFloat(x) || 0);
    const [minerPct, charPct, devPct, poolPct] = fsParts.length >= 4 ? fsParts : [89,5,5,1];
    const setWidth = (id, pct) => { const el = document.getElementById(id); if(el) el.style.width = pct + '%'; };
    setWidth('fee-bar-miner', minerPct);
    setWidth('fee-bar-charity', charPct);
    setWidth('fee-bar-dev', devPct);
    setWidth('fee-bar-pool', poolPct);
    set('fee-pct-miner', minerPct + '%');
    set('fee-pct-charity', charPct + '%');
    set('fee-pct-dev', devPct + '%');
    set('fee-pct-pool', poolPct + '%');

    // ── Core KPIs ─────────────────────────────────────────────────
    set('payout-tab-wallet', data.pool_wallet || '—');
    set('payout-tab-balance', 'Balance: ' + (data.pool_wallet_balance ? formatFlowers(data.pool_wallet_balance) : '—'));
    const st = document.getElementById('payout-tab-status');
    if(st){ st.textContent = data.payout_enabled ? '✅ ENABLED' : '❌ DISABLED'; st.className = data.payout_enabled ? 'text-xl font-bold text-emerald-400' : 'text-xl font-bold text-red-400'; }
    set('payout-tab-blocks', data.blocks_found || '—');
    set('payout-tab-last', data.last_payout_time || '—');
    set('payout-tab-last-tx', 'TX: ' + (data.last_payout_tx || '—'));

    let totalPaid = 0;
    if (data.payouts && data.payouts.length) {
      for (const p of data.payouts) {
        const s = p.fee_split || {};
        totalPaid += parseFloat(s.miner || 0) + parseFloat(s.charity || 0) + parseFloat(s.dev || 0) + parseFloat(s.pool || 0);
      }
    }
    set('payout-tab-total-paid', totalPaid > 0 ? _zionFmt(totalPaid) + ' ZION' : '—');
    set('payout-tab-pending', data.pending_payouts || '—');

    // ── Validation Status ─────────────────────────────────────────
    const val = data.payout_validation || {};
    const valDot = document.getElementById('validation-dot');
    const valStatus = document.getElementById('validation-status');
    const valDetail = document.getElementById('validation-detail');
    if(valDot && valStatus){
      if(val.safe_to_payout){
        valDot.className = 'w-2 h-2 rounded-full bg-emerald-500';
        valStatus.className = 'text-sm font-bold text-emerald-400';
        valStatus.textContent = 'Safe';
      } else {
        valDot.className = 'w-2 h-2 rounded-full bg-red-500';
        valStatus.className = 'text-sm font-bold text-red-400';
        valStatus.textContent = 'Unsafe';
      }
    }
    if(valDetail){
      const parts = [];
      if(val.valid_addresses) parts.push(`${val.valid_addresses} valid`);
      if(val.invalid_addresses) parts.push(`${val.invalid_addresses} invalid`);
      if(val.missing_addresses) parts.push(`${val.missing_addresses} missing`);
      valDetail.textContent = parts.length ? parts.join(' · ') : 'No validation data yet';
    }

    // ── Fee split breakdown table ─────────────────────────────────
    if (data.miner_wallet) set('payout-breakdown-miner-addr', data.miner_wallet);
    if (data.humanitarian_wallet) set('payout-breakdown-charity-addr', data.humanitarian_wallet);
    if (data.issobella_wallet) set('payout-breakdown-dev-addr', data.issobella_wallet);
    if (data.payouts && data.payouts.length) {
      const latest = data.payouts[data.payouts.length - 1];
      const s = latest.fee_split || {};
      set('payout-breakdown-miner-amount', _zionFmt(s.miner || 0) + ' Z');
      set('payout-breakdown-charity-amount', _zionFmt(s.charity || 0) + ' Z');
      set('payout-breakdown-dev-amount', _zionFmt(s.dev || 0) + ' Z');
      set('payout-breakdown-pool-amount', _zionFmt(s.pool || 0) + ' Z');
    }

    // ── On-chain balances ─────────────────────────────────────────
    const bals = data.balances || {};
    set('payout-breakdown-miner-bal',  bals.miner ? _zionFmt(bals.miner.zion) + ' Z' : '—');
    set('payout-breakdown-charity-bal', bals.humanitarian ? _zionFmt(bals.humanitarian.zion) + ' Z' : '—');
    set('payout-breakdown-dev-bal',    bals.issobella ? _zionFmt(bals.issobella.zion) + ' Z' : '—');
    set('payout-breakdown-pool-bal',   data.burned_total != null ? _zionFmt(data.burned_total) + ' Z' : '—');
    if (data.miner_wallet) set('fs-bal-miner-addr', data.miner_wallet);
    if (data.humanitarian_wallet) set('fs-bal-charity-addr', data.humanitarian_wallet);
    if (data.issobella_wallet) set('fs-bal-dev-addr', data.issobella_wallet);
    set('fs-bal-miner',  bals.miner ? _zionFmt(bals.miner.zion) : '—');
    set('fs-bal-charity', bals.humanitarian ? _zionFmt(bals.humanitarian.zion) : '—');
    set('fs-bal-dev',    bals.issobella ? _zionFmt(bals.issobella.zion) : '—');
    set('fs-burned-total', data.burned_total != null ? _zionFmt(data.burned_total) : '—');

    // ── Active Miners table (robust 8-col) ──────────────────────────
    const minersTable = document.getElementById('payout-miners-table');
    const minersBadge = document.getElementById('miners-count-badge');
    // API returns data.miners (not data.miner_stats)
    const minersList = data.miners || data.miner_stats || [];
    if(minersBadge) minersBadge.textContent = minersList.length + ' miners';
    if (minersTable) {
      if (minersList.length) {
        minersTable.innerHTML = minersList.map(m => {
          // /api/payout miners: hashrate(H/s), hashrate_1h(H/s), paid_total not present → use on_chain_balance_zion
          const hrRaw = m.hashrate_1h || m.hashrate || 0;
          const hr = hrRaw >= 1000 ? (hrRaw/1000).toFixed(2)+' KH/s' : hrRaw.toFixed(2)+' H/s';
          // pending_balance = atomic flowers
          const pending = m.pending_balance != null ? _zionFmt(m.pending_balance / 1_000_000_000_000) : '—';
          const onChain = m.on_chain_balance_zion != null ? _zionFmt(m.on_chain_balance_zion) : '—';
          const addr = escapeHtml(m.address || m.miner_id || '—');
          const shortAddr = addr.length > 22 ? addr.slice(0,14)+'…'+addr.slice(-6) : addr;
          const worker = escapeHtml(m.worker_name || '—');
          const algo = escapeHtml(m.algorithm || 'zion');
          const be = escapeHtml(m.backend || 'opencl');
          const isActive = hrRaw > 0;
          return `<tr class="border-b border-white/5 hover:bg-white/5 transition ${isActive?'':'opacity-60'}">
            <td class="py-2 px-2 text-white truncate max-w-[180px] font-mono text-xs" title="${addr}">${shortAddr}</td>
            <td class="py-2 px-2 text-gray-300">${worker}</td>
            <td class="py-2 px-2 text-blue-300 text-[10px]">${algo}</td>
            <td class="py-2 px-2 text-gray-400 text-[10px]">${be}</td>
            <td class="py-2 px-2 text-right text-emerald-400">${m.valid_shares != null ? fmtNum(m.valid_shares) : '—'}</td>
            <td class="py-2 px-2 text-right text-amber-400 font-mono">${hr}</td>
            <td class="py-2 px-2 text-right text-cyan-400 font-mono">${onChain} Z</td>
            <td class="py-2 px-2 text-right text-purple-400 font-mono">${pending} Z</td>
            <td class="py-2 px-2 text-right text-zion-gold">${m.blocks_found ?? '—'}</td>
          </tr>`;
        }).join('');
      } else {
        minersTable.innerHTML = '<tr><td colspan="9" class="py-2 px-2 text-gray-500 italic">No miners connected</td></tr>';
      }
    }

    // ── Recent Payouts Timeline (structured) ────────────────────────
    const payoutDetailTable = document.getElementById('payout-detail-table');
    if (payoutDetailTable) {
      const recent = data.recent_payouts || [];
      if (recent.length) {
        payoutDetailTable.innerHTML = recent.map(p => {
          const statusClass = p.status === 'confirmed' ? 'text-emerald-400' : (p.status === 'pending' ? 'text-amber-400' : 'text-gray-300');
          const txLink = p.tx_id ? `<a href="#" class="text-blue-400 hover:underline" onclick="event.preventDefault(); copyToClipboard('${p.tx_id}')">${p.tx_id.substring(0,16)}…</a>` : '—';
          const timeStr = p.timestamp ? p.timestamp.substring(11,19) : '—';
          return `<tr class="border-b border-white/5 hover:bg-white/5 transition">
            <td class="py-2 px-2 text-white">#${p.block_height}</td>
            <td class="py-2 px-2 text-right text-emerald-400">${p.amount_zion != null ? _zionFmt(p.amount_zion) : '—'} Z</td>
            <td class="py-2 px-2 text-right text-gray-300">${p.recipients ?? '—'}</td>
            <td class="py-2 px-2 ${statusClass}">${p.status || '—'}</td>
            <td class="py-2 px-2">${txLink}</td>
            <td class="py-2 px-2 text-gray-400">${timeStr}</td>
          </tr>`;
        }).join('');
      } else {
        payoutDetailTable.innerHTML = '<tr><td colspan="6" class="py-2 px-2 text-gray-500 italic">No payouts yet</td></tr>';
      }
    }

    // ── Structured payout history table ────────────────────────────
    const histTable = document.getElementById('payout-history-table');
    if (histTable) {
      if (data.payouts && data.payouts.length) {
        histTable.innerHTML = data.payouts.slice(-10).reverse().map(p => {
          const s = p.fee_split || {};
          return `<tr class="border-b border-white/5 hover:bg-white/5 transition">
            <td class="py-2 px-2 text-white">#${p.block_height}</td>
            <td class="py-2 px-2 text-right text-gray-300">${_zionFmt(p.subsidy_flowers / 1e12)} Z</td>
            <td class="py-2 px-2 text-right text-amber-400">${_zionFmt(s.miner || 0)}</td>
            <td class="py-2 px-2 text-right text-emerald-400">${_zionFmt(s.charity || 0)}</td>
            <td class="py-2 px-2 text-right text-purple-400">${_zionFmt(s.dev || 0)}</td>
            <td class="py-2 px-2 text-right text-blue-400">${_zionFmt(s.pool || 0)}</td>
          </tr>`;
        }).join('');
      } else {
        histTable.innerHTML = '<tr><td colspan="6" class="py-2 px-2 text-gray-500 italic">No payout history yet</td></tr>';
      }
    }

    // ── Live pool stats ─────────────────────────────────────────────
    const ps = data.pool_stats || {};
    if (ps.hashrate && ps.hashrate.pool != null) {
      set('pool-stat-hashrate', ps.hashrate.pool.toFixed(2));
    } else if (data.miner_perf && data.miner_perf.hashrate != null) {
      set('pool-stat-hashrate', data.miner_perf.hashrate.toFixed(2));
    } else {
      set('pool-stat-hashrate', '—');
    }
    const sess = data.session_stats || {};
    set('pool-stat-miners', sess.active_sessions != null ? sess.active_sessions : (ps.miners?.active ?? data.miner_stats?.length ?? '—'));
    if (ps.routing && ps.routing.accept_rate_pct != null) {
      set('pool-stat-accept-rate', ps.routing.accept_rate_pct.toFixed(1));
    } else if (sess.accept_rate_pct != null) {
      set('pool-stat-accept-rate', sess.accept_rate_pct.toFixed(1));
    } else {
      set('pool-stat-accept-rate', '—');
    }
    if (ps.pplns) {
      set('pool-stat-pplns', ps.pplns.window_used + '/' + ps.pplns.window_size);
    } else {
      set('pool-stat-pplns', '—');
    }

    // ── Miner performance ─────────────────────────────────────────
    if (data.miner_perf) {
      set('miner-perf-hashrate', data.miner_perf.hashrate != null ? data.miner_perf.hashrate.toFixed(2) : '—');
      set('miner-perf-accepted', data.miner_perf.shares_accepted ?? '—');
      set('miner-perf-rejected', data.miner_perf.shares_rejected ?? '—');
      set('miner-perf-height', data.miner_perf.current_height ?? '—');
    }

    // ── Raw logs ────────────────────────────────────────────────────
    const minerLog = document.getElementById('payout-tab-miner-log');
    if(minerLog) minerLog.innerHTML = (data.miner_payouts && data.miner_payouts.length)
      ? data.miner_payouts.map(l => '<div class="bg-black/20 rounded p-2 border-l-2 border-emerald-500 text-[10px]">' + escapeHtml(l) + '</div>').join('')
      : '<div class="text-gray-500 italic text-[10px]">No recent miner payouts</div>';

    const feeLog = document.getElementById('payout-tab-fee-log');
    if(feeLog) feeLog.innerHTML = (data.fee_payouts && data.fee_payouts.length)
      ? data.fee_payouts.map(l => '<div class="bg-black/20 rounded p-2 border-l-2 border-blue-500 text-[10px]">' + escapeHtml(l) + '</div>').join('')
      : '<div class="text-gray-500 italic text-[10px]">No recent fee payouts</div>';

    const errLog = document.getElementById('payout-tab-error-log');
    if(errLog) errLog.innerHTML = (data.errors && data.errors.length)
      ? data.errors.map(l => '<div class="bg-black/20 rounded p-2 border-l-2 border-red-500 text-red-300 text-[10px]">' + escapeHtml(l) + '</div>').join('')
      : '<div class="text-gray-500 italic text-[10px]">No errors detected</div>';
  }catch(e){
    console.error('refreshPayout error:', e);
    const healthText = document.getElementById('pool-health-text');
    if(healthText){
      healthText.textContent = 'Dashboard Error';
      healthText.className = 'text-sm font-semibold text-red-400';
    }
    const healthDot = document.getElementById('pool-health-dot');
    if(healthDot) healthDot.className = 'w-3 h-3 rounded-full bg-red-500';
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
  cont.innerHTML = alerts.map(a => {
    const showDismiss = a.id && a.severity !== 'success';
    return `
    <div class="flex items-start gap-3 p-3 rounded-xl border alert-${a.severity}" data-aid="${a.id||''}">
      <span class="text-xl">${icons[a.severity] || 'ℹ️'}</span>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-semibold">${escapeHtml(a.title)}</div>
        <div class="text-xs opacity-80 mt-0.5">${escapeHtml(a.detail)}</div>
      </div>
      <div class="flex gap-2">
        ${a.action ? `<button data-action="${a.action}" class="action-btn text-xs px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-md transition whitespace-nowrap font-semibold">Fix</button>` : ''}
        ${showDismiss ? `<button data-dismiss="${a.id}" class="dismiss-btn text-xs px-2 py-1 text-gray-400 hover:text-white rounded-md transition" title="Dismiss">✕</button>` : ''}
      </div>
    </div>`;
  }).join('');

  // Attach dismiss handlers
  cont.querySelectorAll('.dismiss-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-dismiss');
      if(!id) return;
      try {
        const res = await fetch('/api/alerts/dismiss', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id})});
        const data = await res.json();
        if(data.ok) {
          const card = btn.closest('[data-aid]');
          if(card) card.remove();
        }
      } catch(e) { console.error('dismiss failed', e); }
    });
  });
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

let alertCache = [];
let alertFilterActive = 'all';
let _alertsTimer = null;
let _backupsTimer = null;

async function loadAlertHistory(){
  try {
    const res = await fetch('/api/alerts/history').then(r => r.json());
    alertCache = (res.alerts || []).slice().reverse();
    // Update counts
    const counts = {critical:0, warning:0, info:0};
    alertCache.forEach(a => { if(counts[a.severity] !== undefined) counts[a.severity]++; else counts.info++; });
    const el = id => document.getElementById(id);
    if(el('alert-count-critical')) el('alert-count-critical').textContent = counts.critical;
    if(el('alert-count-warning')) el('alert-count-warning').textContent = counts.warning;
    if(el('alert-count-info')) el('alert-count-info').textContent = counts.info;
    if(el('alert-count-total')) el('alert-count-total').textContent = alertCache.length;
    // Update sidebar badge
    const sidebarBtn = document.getElementById('tab-alerts');
    if(sidebarBtn){
      const total = counts.critical + counts.warning;
      const badge = sidebarBtn.querySelector('.sidebar-badge') || document.createElement('span');
      if(total > 0){
        badge.className = 'sidebar-badge ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-600 text-white';
        badge.textContent = total;
        if(!sidebarBtn.querySelector('.sidebar-badge')) sidebarBtn.appendChild(badge);
      } else {
        if(sidebarBtn.querySelector('.sidebar-badge')) badge.remove();
      }
    }
    renderAlertList();
  } catch(e) {
    console.error('loadAlertHistory error:', e);
  }
}

function filterAlerts(filter){
  alertFilterActive = filter;
  document.querySelectorAll('.alert-filter-btn').forEach(b => {
    if(b.dataset.filter === filter){
      b.className = 'alert-filter-btn text-[10px] px-2.5 py-1 rounded bg-emerald-900/30 text-emerald-300 border border-emerald-500/30';
    } else {
      b.className = 'alert-filter-btn text-[10px] px-2.5 py-1 rounded bg-black/30 text-gray-400 hover:text-white';
    }
  });
  renderAlertList();
}

function renderAlertList(){
  const c = document.getElementById('alert-history-list');
  if(!c) return;
  const filtered = alertFilterActive === 'all' ? alertCache : alertCache.filter(a => a.severity === alertFilterActive);
  if(!filtered.length){
    c.innerHTML = '<div class="text-gray-500 italic text-sm">No ' + (alertFilterActive==='all'?'':''+alertFilterActive+' ') + 'alerts recorded.</div>';
    return;
  }
  const icons = { critical: '🚨', warning: '⚠️', info: 'ℹ️', success: '✅' };
  c.innerHTML = filtered.map(a => `
    <div class="alert-item flex items-start gap-2 p-2.5 rounded-lg border border-white/5 ${a.severity === 'critical' ? 'bg-red-500/10' : a.severity === 'warning' ? 'bg-amber-500/10' : a.severity === 'success' ? 'bg-emerald-500/10' : 'bg-white/5'}" data-severity="${a.severity}">
      <span class="text-lg">${icons[a.severity] || 'ℹ️'}</span>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-semibold">${escapeHtml(a.title)}</div>
        <div class="text-[10px] opacity-70 truncate">${escapeHtml(a.detail || '')}</div>
        <div class="text-[10px] text-gray-500 mt-0.5">${new Date(a.ts).toLocaleString()}</div>
      </div>
      <span class="text-[10px] px-1.5 py-0.5 rounded ${a.severity==='critical'?'bg-red-700 text-red-200':a.severity==='warning'?'bg-amber-700 text-amber-200':'bg-gray-700 text-gray-300'}">${a.severity}</span>
    </div>`).join('');
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
  const hist = await fetch('/api/history').then(r => r.json()).catch(()=>({samples:[]}));
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

async function updateConnectedMiners(){
  const tbody = document.getElementById('connected-miners-tbody');
  const badge = document.getElementById('connected-miners-badge');
  if(!tbody) return;
  try {
    const d = await fetch('/api/pool/miners').then(r => r.json());
    if(!d.ok || !d.miners || d.miners.length === 0){
      tbody.innerHTML = '<tr><td colspan="8" class="text-gray-500 text-center py-4">No miners connected to Edge pool.</td></tr>';
      if(badge) badge.textContent = '0';
      return;
    }
    if(badge) badge.textContent = d.active_sessions + ' active';
    const hrEl = document.getElementById('cm-total-hashrate');
    const actEl = document.getElementById('cm-active-count');
    const trkEl = document.getElementById('cm-tracked-count');
    if(hrEl) hrEl.textContent = (d.total_hashrate_khs ?? 0).toFixed(2) + ' KH/s';
    if(actEl) actEl.textContent = d.active_sessions ?? 0;
    if(trkEl) trkEl.textContent = d.miners_tracked ?? d.miners.length;

    // Sort: active hashers first, then by valid shares
    const sorted = [...d.miners].sort((a,b) => {
      if(b.hashrate_hps !== a.hashrate_hps) return b.hashrate_hps - a.hashrate_hps;
      return b.valid_shares - a.valid_shares;
    });

    tbody.innerHTML = sorted.map(m => {
      const isActive = m.hashrate_hps > 0;
      const nowSec = Math.floor(Date.now() / 1000);
      const lastSeenAgo = (m.last_seen > 0) ? (nowSec - m.last_seen) : null;
      const isRecent = lastSeenAgo !== null && lastSeenAgo < 300;
      const statusDot = isActive
        ? '<span class="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1"></span>Hashing'
        : isRecent
          ? '<span class="w-2 h-2 rounded-full bg-amber-500 inline-block mr-1"></span>Idle'
          : '<span class="w-2 h-2 rounded-full bg-gray-600 inline-block mr-1"></span>Stale';
      const lastSeenStr = lastSeenAgo !== null
        ? (lastSeenAgo < 60 ? lastSeenAgo + 's' : Math.floor(lastSeenAgo/60) + 'm') + ' ago'
        : '—';
      const hashrate = m.hashrate_hps > 0 ? (m.hashrate_hps/1000).toFixed(2) + ' KH/s' : '—';
      const paid = m.paid_total > 0 ? m.paid_total.toLocaleString('en-US',{maximumFractionDigits:4}) : '0';
      const minerIdShort = m.miner_id.length > 28 ? m.miner_id.slice(0,14)+'…'+m.miner_id.slice(-12) : m.miner_id;
      const rowCls = isActive ? '' : (isRecent ? 'opacity-75' : 'opacity-40');
      return `<tr class="border-b border-white/5 hover:bg-white/5 transition ${rowCls}">
        <td class="py-2 px-2 font-mono text-[10px] text-gray-300" title="${escapeHtml(m.miner_id)}">${escapeHtml(minerIdShort)}</td>
        <td class="py-2 px-2 text-gray-300">${escapeHtml(m.worker_name || '—')}</td>
        <td class="py-2 px-2 text-right font-mono ${isActive?'text-amber-400':'text-gray-500'}">${hashrate}</td>
        <td class="py-2 px-2 text-right font-mono text-emerald-400">${m.valid_shares.toLocaleString()}</td>
        <td class="py-2 px-2 text-right font-mono text-red-400">${m.invalid_shares.toLocaleString()}</td>
        <td class="py-2 px-2 text-right font-mono text-zion-gold">${m.blocks_found}</td>
        <td class="py-2 px-2 text-right font-mono text-gray-300">${paid}</td>
        <td class="py-2 px-2 text-right text-[10px]">${statusDot}<br><span class="text-gray-500">${lastSeenStr}</span></td>
      </tr>`;
    }).join('');
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-red-400 text-center py-4 text-xs">Failed to load miners: ' + escapeHtml(e.message) + '</td></tr>';
  }
}

async function loadCliNodeStatus(){
  const badge = document.getElementById('cli-status-badge');
  if(!badge) return;
  try {
    // First try CLI endpoint
    const data = await fetch('/api/cli/node-status').then(r => r.json());
    if(data.ok && data.cli_connected){
      badge.className = 'text-xs px-2 py-0.5 rounded-md bg-emerald-700 text-emerald-300';
      badge.textContent = 'CLI Connected';
      const out = data.output || '';
      const height = out.match(/Height\s+(\d+)/); 
      const peers = out.match(/Peers\s+(\d+)/);
      const mempool = out.match(/Mempool\s+(\d+)/);
      const tip = out.match(/Tip\s+([a-f0-9]{8,})/i);
      if(height) document.getElementById('cli-val-height').textContent = height[1];
      if(peers) document.getElementById('cli-val-peers').textContent = peers[1];
      if(mempool) document.getElementById('cli-val-mempool').textContent = mempool[1];
      if(tip) document.getElementById('cli-val-tip').textContent = tip[1].substring(0,16) + '…';
      return;
    }
  } catch(e) { /* CLI unavailable, fall through to RPC */ }
  // Fallback: use /api/status RPC data directly
  try {
    const st = await fetch('/api/status').then(r => r.json());
    const n1 = st.node1 || {};
    if(n1.running){
      badge.className = 'text-xs px-2 py-0.5 rounded-md bg-blue-700 text-blue-300';
      badge.textContent = 'RPC Direct';
      const el = id => document.getElementById(id);
      if(el('cli-val-height')) el('cli-val-height').textContent = n1.chain_height ?? '—';
      if(el('cli-val-peers')) el('cli-val-peers').textContent = n1.known_peers ?? '—';
      if(el('cli-val-mempool')) el('cli-val-mempool').textContent = n1.mempool_size ?? '0';
      if(el('cli-val-tip') && n1.tip_hash) el('cli-val-tip').textContent = n1.tip_hash.substring(0,16) + '…';
    } else {
      badge.className = 'text-xs px-2 py-0.5 rounded-md bg-red-700/50 text-red-300';
      badge.textContent = 'Node Offline';
    }
  } catch(e) {
    badge.className = 'text-xs px-2 py-0.5 rounded-md bg-gray-700 text-gray-400';
    badge.textContent = 'Error';
  }
}

// ─────────────────────────────────────────────────────────────────────
// Wallets tab
// ─────────────────────────────────────────────────────────────────────

async function loadWallets(){
  try {
    const [walletsRes, payoutRes] = await Promise.allSettled([
      fetch('/api/wallets').then(r => r.json()),
      fetch('/api/payout').then(r => r.ok ? r.json() : Promise.reject('payout HTTP '+r.status)),
    ]);
    const data = walletsRes.status === 'fulfilled' ? walletsRes.value : {};
    const wallets = data.wallets || [];
    const summary = data.summary || {};
    const rpc = data.rpc || {};
    const pay = payoutRes.status === 'fulfilled' ? payoutRes.value : {};

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
        // source: 'genesis' = premine, 'node' = operational/env
        const isPremine = w.category === 'premine' || w.source === 'genesis' || w.source === 'premine';
        const sourceBadge = isPremine
          ? '<span class="px-1.5 py-0.5 rounded bg-zion-gold/20 text-zion-gold text-[10px]">genesis</span>'
          : '<span class="px-1.5 py-0.5 rounded bg-zion-cyan/20 text-zion-cyan text-[10px]">' + escapeHtml(w.source || 'node') + '</span>';
        const catBadge = isPremine
          ? '<span class="text-zion-gold">premine</span>'
          : '<span class="text-zion-cyan">operational</span>';
        const premineAmt = w.amount_zion ? fmtNum(w.amount_zion) + ' ZION' : '—';
        const balV = w.balance_zion;
        const bal = balV !== null && balV !== undefined
          ? (typeof balV === 'number'
              ? (balV >= 1e9 ? (balV/1e9).toFixed(3)+' BZION'
                : balV >= 1e6 ? (balV/1e6).toFixed(2)+' MZION'
                : balV >= 1e3 ? (balV/1e3).toFixed(2)+' KZION'
                : balV.toFixed(4)+' ZION')
              : balV)
          : (w.rpc_ok === false ? '<span class="text-gray-600">unavailable</span>' : '—');
        const balClass = balV !== null && balV !== undefined ? 'text-emerald-400 font-bold' : 'text-gray-500';
        return `<tr class="border-b border-white/5 hover:bg-white/3 transition">
          <td class="py-2 px-3 text-gray-500">${idx}</td>
          <td class="py-2 px-3 font-semibold text-white">${label}</td>
          <td class="py-2 px-3">
            <span class="text-gray-300" title="${addr}">${shortAddr}</span>
            <button data-copy="${addr}" class="copy-btn ml-1 text-[10px] text-zion-gold hover:underline">copy</button>
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

    // ── Fee-Split & Pool Wallet dynamic section ──────────────────────
    const feeSplitDiv = document.getElementById('wallets-fee-split');
    if(feeSplitDiv){
      const entries = [
        { label: '⛏️ Miner (89%)', key: 'miner_wallet', color: 'text-emerald-400' },
        { label: '💝 Humanitarian (5%)', key: 'humanitarian_wallet', color: 'text-pink-400' },
        { label: '🚀 Issobella Space (5%)', key: 'issobella_wallet', color: 'text-purple-400' },
        { label: '🔥 Pool Fee / Burn (1%)', key: 'pool_fee_wallet', color: 'text-amber-400' },
      ];
      feeSplitDiv.innerHTML = entries.map(e => {
        const addr = pay[e.key] || '—';
        const display = addr.length > 36 ? addr.slice(0,18)+'…'+addr.slice(-12) : addr;
        return `<div class="flex justify-between items-center bg-black/30 rounded-lg px-3 py-2">
          <span class="${e.color} font-semibold">${e.label}</span>
          <div class="flex items-center gap-2">
            <span class="font-mono text-white text-[10px]" title="${escapeHtml(addr)}">${escapeHtml(display)}</span>
            ${addr.startsWith('zion1') ? `<button onclick="copyToClipboard('${escapeHtml(addr)}')" class="text-[10px] text-gray-500 hover:text-white">Copy</button>` : ''}
          </div>
        </div>`;
      }).join('');
    }

    const poolAddr = document.getElementById('wallet-pool-address');
    if(poolAddr) poolAddr.textContent = pay.pool_wallet || '—';
    const poolBal = document.getElementById('wallet-pool-balance');
    if(poolBal){
      poolBal.textContent = pay.pool_wallet_balance != null ? 'Balance: ' + formatFlowers(pay.pool_wallet_balance) : 'Balance: —';
    }
    const poolEn = document.getElementById('wallet-pool-enabled');
    if(poolEn){
      poolEn.textContent = pay.payout_enabled ? '✅ ENABLED' : '❌ DISABLED';
      poolEn.className = 'font-bold text-lg ' + (pay.payout_enabled ? 'text-emerald-400' : 'text-red-400');
    }
    const poolFs = document.getElementById('wallet-pool-fee-split');
    if(poolFs) poolFs.textContent = 'Fee split: ' + (pay.fee_split || '—');

  } catch(e){
    console.error('Wallets load error:', e);
    const tbody = document.getElementById('wallets-table');
    if(tbody) tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-red-400 text-center">Failed to load wallets: ${escapeHtml(e.message)}</td></tr>`;
  }
  // Also refresh online miners table
  refreshMinerBalances();
}

// ─── Online Miners (Wallets tab) ────────────────────────────────────
async function refreshMinerBalances(){
  try {
    // Merge /api/payout (on-chain balances) + /api/pool/miners (hashrate, paid_total)
    const [payRes, poolRes] = await Promise.allSettled([
      apiFetch('/api/payout'),
      fetch('/api/pool/miners').then(r => r.ok ? r.json() : Promise.reject('HTTP '+r.status)),
    ]);
    const pay = payRes.status === 'fulfilled' ? payRes.value : {};
    const pool = poolRes.status === 'fulfilled' ? poolRes.value : {};
    const payMiners = pay.miners || [];
    const poolMiners = pool.miners || [];
    const poolStats = pay.pool_stats || {};

    // Build lookup: key = worker_name or address
    const onChainMap = new Map();
    payMiners.forEach(m => {
      const key = m.worker_name || m.address || '';
      if(key) onChainMap.set(key, m.on_chain_balance_zion);
    });

    const tbody = document.getElementById('miner-balances-table');
    const summary = document.getElementById('miner-balances-summary');
    if(!tbody) return;
    if(poolMiners.length === 0){
      tbody.innerHTML = '<tr><td colspan="9" class="py-4 text-gray-500 italic text-center">No miners connected</td></tr>';
      if(summary) summary.textContent = '';
      return;
    }

    let totalHashrate = 0, totalPaid = 0, totalPending = 0, totalValid = 0;
    tbody.innerHTML = poolMiners.map(m => {
      const name = escapeHtml(m.worker_name || m.miner_id || '—');
      const addr = escapeHtml((m.payout_address || m.miner_id || '').slice(0, 24) + ((m.payout_address || m.miner_id || '').length > 24 ? '…' : ''));
      const hr = m.hashrate_hps != null ? m.hashrate_hps : (m.hashrate || 0);
      const hrStr = hr >= 1000 ? (hr/1000).toFixed(2) + ' KH/s' : hr.toFixed(1) + ' H/s';
      const valid = m.valid_shares ?? 0;
      const invalid = m.invalid_shares ?? 0;
      const blocks = m.blocks_found ?? 0;
      const pending = m.pending_balance ?? 0;
      const paid = m.paid_total ?? 0;
      const onChain = onChainMap.get(name) != null ? _zionFmt(onChainMap.get(name)) + ' Z' : '—';

      totalHashrate += hr;
      totalPaid += paid;
      totalPending += pending;
      totalValid += valid;

      const hrColor = hr >= 1000 ? 'text-amber-400' : hr > 0 ? 'text-emerald-400' : 'text-gray-500';
      return `<tr class="border-b border-white/5 hover:bg-white/3 transition">
        <td class="py-2 px-2 text-emerald-300 font-semibold">${name}</td>
        <td class="py-2 px-2 text-gray-400 text-[10px]">${addr}</td>
        <td class="py-2 px-2 text-right ${hrColor}">${hrStr}</td>
        <td class="py-2 px-2 text-right text-emerald-400">${fmtNum(valid)}</td>
        <td class="py-2 px-2 text-right ${invalid>0?'text-red-400':'text-gray-500'}">${fmtNum(invalid)}</td>
        <td class="py-2 px-2 text-right text-zion-gold">${fmtNum(blocks)}</td>
        <td class="py-2 px-2 text-right text-amber-400">${pending.toFixed(4)} Z</td>
        <td class="py-2 px-2 text-right text-cyan-400">${paid.toFixed(4)} Z</td>
        <td class="py-2 px-2 text-right text-purple-400">${onChain}</td>
      </tr>`;
    }).join('');

    if(summary){
      const hr = poolStats.hashrate?.pool ?? poolStats.pool_hashrate ?? totalHashrate;
      const thr = hr >= 1000 ? (hr/1000).toFixed(2) + ' KH/s' : hr.toFixed(1) + ' H/s';
      summary.innerHTML = `<span class="text-emerald-400 font-semibold">${poolMiners.length} miners</span> · Pool hashrate: <span class="text-amber-400">${thr}</span> · Valid shares: <span class="text-emerald-400">${fmtNum(totalValid)}</span> · Paid: <span class="text-cyan-400">${totalPaid.toFixed(4)} Z</span> · Pending: <span class="text-amber-400">${totalPending.toFixed(4)} Z</span>`;
    }
  } catch(e) {
    console.error('refreshMinerBalances error:', e);
    const tbody = document.getElementById('miner-balances-table');
    if(tbody) tbody.innerHTML = `<tr><td colspan="9" class="py-4 text-red-400 text-center">Failed to load miners: ${escapeHtml(e.message)}</td></tr>`;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Payout tab
// ─────────────────────────────────────────────────────────────────────

async function loadPayoutTab(){
  try {
    const [payRes, minersRes] = await Promise.allSettled([
      fetch('/api/payout').then(r => r.ok ? r.json() : Promise.reject('payout HTTP '+r.status)),
      fetch('/api/pool/miners').then(r => r.ok ? r.json() : Promise.reject('miners HTTP '+r.status)),
    ]);
    const d = payRes.status === 'fulfilled' ? payRes.value : {};
    const miners = minersRes.status === 'fulfilled' ? (minersRes.value.miners || minersRes.value || []) : [];

    const set = (id, text) => {
      const el = document.getElementById(id);
      if(el) { el.textContent = text; }
      else { console.warn('[PAYOUT] element not found:', id, 'value:', text); }
    };
    const setHtml = (id, html) => { const el = document.getElementById(id); if(el) el.innerHTML = html; };

    // ── KPI Row ──────────────────────────────────────────────────────
    const ph = d.pool_health || {};
    const allOk = ph.edge_rpc_ok && ph.edge_stats_ok && ph.tailscale_ok;
    const someOk = ph.edge_rpc_ok || ph.edge_stats_ok || ph.local_rpc_ok;
    let statusText = 'Unknown', statusColor = 'text-gray-400';
    if(allOk){ statusText = 'Healthy'; statusColor = 'text-emerald-400'; }
    else if(someOk){ statusText = 'Degraded'; statusColor = 'text-amber-400'; }
    else if(Object.keys(ph).length > 0){ statusText = 'Unhealthy'; statusColor = 'text-red-400'; }
    const kpiStatus = document.getElementById('payout-kpi-status');
    if(kpiStatus){ kpiStatus.textContent = statusText; kpiStatus.className = 'text-xl font-bold '+statusColor; }

    // API: blocks_found top-level; pool_stats.blocks.found as fallback
    const ps = d.pool_stats || {};
    set('payout-kpi-blocks', d.blocks_found ?? ps.blocks?.found ?? 0);

    // Hashrate: pool_stats.hashrate.pool (H/s) → KH/s; fallback miner_perf
    const hrRaw = ps.hashrate?.pool ?? ps.pool_hashrate ?? d.miner_perf?.hashrate_hps ?? d.miner_perf?.hashrate ?? null;
    const hrKhs = hrRaw != null ? (hrRaw >= 1000 ? (hrRaw/1000).toFixed(2)+' KH/s' : hrRaw.toFixed(1)+' H/s') : '—';
    set('payout-kpi-hashrate', hrKhs);

    const ss = d.session_stats || {};
    // API: session_stats.active_sessions; fallback pool_stats.miners.active; fallback miners array
    const activeCount = ss.active_sessions ?? ps.miners?.active ?? miners.length ?? 0;
    set('payout-kpi-miners', activeCount);

    // Total paid: sum from miners array (paid_total field, already in ZION from our API)
    let totalPaidZion = 0;
    miners.forEach(m => { totalPaidZion += (m.paid_total ?? 0); });
    // Also try pool_stats pplns total_paid_flowers
    if(totalPaidZion === 0 && ps.pplns?.total_paid_flowers){
      totalPaidZion = ps.pplns.total_paid_flowers / 1_000_000_000_000;
    }
    set('payout-kpi-total-paid', totalPaidZion > 0 ? _zionFmt(totalPaidZion) + ' ZION' : '—');

    // Accept rate: session_stats.accept_rate_pct; fallback pool_stats.routing.accept_rate_pct
    const ar = ss.accept_rate_pct ?? ps.routing?.accept_rate_pct ?? null;
    const kpiAR = document.getElementById('payout-kpi-accept-rate');
    if(kpiAR){
      kpiAR.textContent = ar != null ? ar.toFixed(1)+'%' : '—';
      kpiAR.className = 'text-xl font-bold '+(ar != null && ar >= 95 ? 'text-emerald-400' : ar != null && ar >= 80 ? 'text-amber-400' : 'text-red-400');
    }

    // ── Fee Split Addresses ──────────────────────────────────────────
    set('payout-fee-miner-addr', d.miner_wallet || '—');
    set('payout-fee-human-addr', d.humanitarian_wallet || '—');
    set('payout-fee-isso-addr', d.issobella_wallet || '—');
    set('payout-fee-pool-addr', d.pool_fee_wallet ? d.pool_fee_wallet : 'Burned (no address)');

    // ── PPLNS Status ─────────────────────────────────────────────────
    const pplns = ps.pplns || {};
    set('payout-pplns-window', pplns.window_size ?? '—');
    set('payout-pplns-used', pplns.window_used ?? '—');
    set('payout-pplns-registered', pplns.registered_miners ?? pplns.miners_registered ?? miners.length ?? 0);
    set('payout-pplns-rounds', pplns.payout_rounds ?? pplns.rounds_completed ?? '—');
    // total paid: pplns.total_paid_flowers (atomic) → ZION
    const pplnsTotalZion = pplns.total_paid_flowers ? pplns.total_paid_flowers / 1_000_000_000_000 : null;
    set('payout-pplns-total', pplnsTotalZion != null ? _zionFmt(pplnsTotalZion) + ' ZION' : (d.burned_total != null ? _zionFmt(d.burned_total) + ' ZION' : '—'));

    const lastTime = d.last_payout_time;
    const lastTx = d.last_payout_tx;
    set('payout-last-time', lastTime || '—');
    const txEl = document.getElementById('payout-last-tx');
    if(txEl){
      txEl.textContent = lastTx || '—';
      txEl.title = lastTx || '';
      txEl.onclick = lastTx ? () => openTxInExplorer(lastTx) : null;
      txEl.style.cursor = lastTx ? 'pointer' : 'default';
    }
    const rp = d.recent_payouts || [];
    const lastPayoutMiners = rp.length > 0 ? (rp[0].recipients || '—') : '—';
    set('payout-last-miners', lastPayoutMiners);

    // ── Miner Pending Balances ──────────────────────────────────────
    // Merge /api/payout (on-chain balances) + /api/pool/miners (hashrate, paid_total)
    const balTbody = document.getElementById('payout-miner-balances');
    if(balTbody){
      // Build pool metrics lookup by worker_name for hashrate enrichment
      const poolMetrics = new Map();
      miners.forEach(m => {
        const key = m.worker_name || m.miner_id || '';
        if(key) poolMetrics.set(key, m);
      });
      // Use payout miners (richer: on_chain_balance, payout_address)
      const payoutMiners = (d.miners && d.miners.length > 0) ? d.miners : miners;
      if(payoutMiners.length === 0){
        balTbody.innerHTML = '<tr><td colspan="6" class="text-gray-500 text-center py-4">No miners connected</td></tr>';
      } else {
        balTbody.innerHTML = payoutMiners.map(m => {
          const name = m.worker_name || m.miner_id || m.address || '—';
          const addr = escapeHtml((m.payout_address || m.address || m.miner_id || '').slice(0, 20) + (((m.payout_address || m.address || m.miner_id || '').length > 20) ? '…' : ''));
          const valid = m.valid_shares ?? 0;
          const invalid = m.invalid_shares ?? m.no_solution ?? 0;
          // pending_balance: payout API may be atomic flowers → convert to ZION
          const pendingZion = (m.pending_balance != null && m.pending_balance > 1_000_000)
            ? m.pending_balance / 1_000_000_000_000
            : (m.pending_balance ?? 0);
          const paidZion = m.paid_total ?? m.total_paid ?? 0;
          const onChain = m.on_chain_balance_zion != null ? _zionFmt(m.on_chain_balance_zion) + ' Z' : '—';
          // Merge hashrate from pool metrics (payout API has null hashrate)
          const poolM = poolMetrics.get(name);
          const hr = poolM?.hashrate_hps ?? m.hashrate ?? 0;
          const hrStr = hr >= 1000 ? (hr/1000).toFixed(2)+' KH/s' : hr > 0 ? hr.toFixed(1)+' H/s' : '—';
          return `<tr class="border-b border-white/5 hover:bg-white/5">
            <td class="py-2 px-2 text-emerald-300 font-semibold">${escapeHtml(name)}</td>
            <td class="py-2 px-2 text-gray-400 text-[10px] font-mono">${addr}</td>
            <td class="py-2 px-2 text-right text-emerald-400">${fmtNum(valid)}</td>
            <td class="py-2 px-2 text-right ${invalid>0?'text-red-400':'text-gray-500'}">${fmtNum(invalid)}</td>
            <td class="py-2 px-2 text-right text-amber-400">${hrStr}</td>
            <td class="py-2 px-2 text-right text-zion-gold font-mono">${onChain}</td>
          </tr>`;
        }).join('');
      }
    }

    // ── Payout History Timeline ─────────────────────────────────────
    const histContainer = document.getElementById('payout-history-container');
    if(histContainer){
      const payouts = d.payouts || [];
      const recent = d.recent_payouts || [];
      if(payouts.length === 0 && recent.length === 0){
        histContainer.innerHTML = '<div class="text-gray-500 italic text-xs">No payout events recorded yet.</div>';
      } else {
        const items = [];
        // Combine structured payouts + recent payouts
        const seen = new Set();
        payouts.slice().reverse().forEach(p => {
          if(seen.has(p.block_height)) return;
          seen.add(p.block_height);
          const fs = p.fee_split || {};
          items.push({
            type: 'block',
            height: p.block_height,
            text: `Block #${p.block_height} — Subsidy ${formatFlowers(Math.round((p.subsidy_flowers||0)))} — Miner ${(fs.miner||0).toFixed(2)} ZION / Humanitarian ${(fs.charity||0).toFixed(2)} ZION / Issobella ${(fs.dev||0).toFixed(2)} ZION / Burn ${(fs.pool||0).toFixed(2)} ZION`,
            cls: 'text-emerald-300'
          });
        });
        recent.forEach(rp => {
          if(seen.has(rp.block_height)) return;
          seen.add(rp.block_height);
          const amt = rp.amount_zion != null ? ` — ${rp.amount_zion.toFixed(2)} ZION` : '';
          items.push({
            type: 'payout',
            height: rp.block_height,
            text: `Payout #${rp.block_height}${amt} — ${rp.recipients ? rp.recipients+' miners' : 'unknown recipients'} — ${rp.status}`,
            cls: 'text-cyan-300'
          });
        });
        items.sort((a,b) => b.height - a.height);
        histContainer.innerHTML = items.slice(0, 30).map(it => `
          <div class="flex items-start gap-2 p-2 bg-black/20 rounded border border-white/5">
            <div class="w-1.5 h-1.5 rounded-full mt-1.5 ${it.type==='block'?'bg-emerald-500':'bg-cyan-500'}"></div>
            <div class="text-xs ${it.cls}">${escapeHtml(it.text)}</div>
          </div>
        `).join('');
      }
    }

    // ── Pool Health ──────────────────────────────────────────────────
    const val = d.payout_validation || {};
    set('payout-val-valid', val.valid_addresses ?? 0);
    set('payout-val-invalid', val.invalid_addresses ?? 0);
    const safeEl = document.getElementById('payout-val-safe');
    if(safeEl){
      safeEl.textContent = val.safe_to_payout ? 'YES' : 'NO';
      safeEl.className = 'text-emerald-400 font-bold text-lg ' + (val.safe_to_payout ? 'text-emerald-400' : 'text-red-400');
    }
    set('payout-val-error', val.last_error || 'No validation errors');

  } catch(e){
    console.error('Payout tab load error:', e);
    const container = document.getElementById('pane-payout');
    if(container && !container.querySelector('.payout-error-banner')){
      const banner = document.createElement('div');
      banner.className = 'payout-error-banner p-3 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-xs';
      banner.textContent = 'Failed to load payout data: ' + e.message;
      container.insertBefore(banner, container.children[1]);
      setTimeout(() => banner.remove(), 5000);
    }
  }

  // Render charts after data is loaded
  renderPayoutCharts();
}

async function renderPayoutCharts(){
  try {
    const hist = await fetch('/api/history').then(r => r.ok ? r.json() : null);
    if(!hist || !hist.samples || hist.samples.length < 2) return;
    const s = hist.samples;
    const labels = s.map(x => new Date(x.t*1000).toLocaleTimeString().slice(0,5));
    const common = {
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#cbd5e1'}}},
      scales:{
        x:{ticks:{color:'#64748b',font:{size:9}},grid:{color:'#1f2942'}},
        y:{ticks:{color:'#64748b'},grid:{color:'#1f2942'}}
      },
      animation:{duration:300}
    };

    // Hashrate trend
    const hrCtx = document.getElementById('payout-chart-hashrate');
    if(hrCtx){
      if(charts.payoutHashrate) charts.payoutHashrate.destroy();
      charts.payoutHashrate = new Chart(hrCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Hashrate (KH/s)',
            data: s.map(x => x.hashrate || 0),
            borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)',
            fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
          }]
        },
        options: { ...common, plugins:{...common.plugins, legend:{display:false}} }
      });
    }

    // Blocks & shares trend
    const blkCtx = document.getElementById('payout-chart-blocks');
    if(blkCtx){
      if(charts.payoutBlocks) charts.payoutBlocks.destroy();
      // Compute cumulative blocks deltas for bars
      let lastBlocks = s[0].blocks || 0;
      const blockDeltas = s.map(x => { const d = (x.blocks||0) - lastBlocks; lastBlocks = x.blocks||0; return d; });
      charts.payoutBlocks = new Chart(blkCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Blocks Found',
              data: blockDeltas,
              backgroundColor: 'rgba(16,185,129,0.7)',
              borderRadius: 3, barThickness: 6
            },
            {
              label: 'Valid Shares',
              data: s.map(x => x.shares_ok || 0),
              backgroundColor: 'rgba(6,182,212,0.5)',
              borderRadius: 3, barThickness: 6
            },
            {
              label: 'Rejected',
              data: s.map(x => x.shares_bad || 0),
              backgroundColor: 'rgba(239,68,68,0.5)',
              borderRadius: 3, barThickness: 6
            }
          ]
        },
        options: common
      });
    }
  } catch(e) { console.error('renderPayoutCharts error:', e); }
}

async function triggerPayoutNow(){
  if(!confirm('Trigger immediate payout to all eligible miners?')) return;
  try {
    const res = await fetch('/api/payout/trigger',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
    const d = await res.json();
    toast(d.ok ? 'Payout triggered successfully' : ('Payout failed: '+(d.error||'unknown')), d.ok?'success':'error');
    if(d.ok) loadPayoutTab();
  } catch(e){
    toast('Payout trigger error: '+e.message, 'error');
  }
}

async function restartEdgePool(){
  if(!confirm('Restart Edge Pool server via SSH?\n\nThis will briefly disconnect all connected miners.')) return;
  const btn = document.getElementById('btn-restart-pool-edge');
  if(btn){ btn.disabled = true; btn.textContent = '⏳ Restarting…'; }
  try {
    const res = await fetch('/api/control',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'restart-pool-edge'})
    });
    const d = await res.json();
    if(d.ok){
      toast('Edge Pool restart command sent via SSH. Miners will reconnect in ~10s.', 'success');
      // Re-check pool health after 12s
      setTimeout(loadPayoutTab, 12000);
    } else {
      toast('Edge Pool restart failed: ' + (d.message || d.error || 'unknown error'), 'error');
    }
  } catch(e){
    toast('Edge Pool restart error: ' + e.message, 'error');
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = '🔄 Restart Edge Pool'; }
  }
}

// ── Payout real-time SSE ─────────────────────────────────────────────

function disconnectPayoutSse(){
  if(_payoutSseSource){
    _payoutSseSource.close();
    _payoutSseSource = null;
  }
  const ind = document.getElementById('payout-sse-indicator');
  if(ind) ind.classList.add('hidden');
}

function connectPayoutSse(){
  disconnectPayoutSse();
  if(!window.EventSource) return; // not supported
  try {
    const src = new EventSource('/api/payout/stream');
    _payoutSseSource = src;

    src.onopen = () => {
      const ind = document.getElementById('payout-sse-indicator');
      if(ind) ind.classList.remove('hidden');
    };

    src.addEventListener('snapshot', (e) => {
      try {
        const msg = JSON.parse(e.data);
        // Full reload with fresh data (same as loadPayoutTab but without new fetch)
        updatePayoutSnapshot(msg.data || msg);
      } catch(err) { console.error('SSE snapshot parse error:', err); }
    });

    src.addEventListener('block', (e) => {
      try {
        const msg = JSON.parse(e.data);
        const h = msg.data?.height || msg.height;
        if(!h) return;
        // Increment blocks counter
        const el = document.getElementById('payout-kpi-blocks');
        if(el){
          let cur = parseInt(el.textContent, 10) || 0;
          el.textContent = cur + 1;
        }
        toast('🎉 Block #' + h + ' found!', 'success');
        // Add to timeline
        const hist = document.getElementById('payout-history-container');
        if(hist){
          const div = document.createElement('div');
          div.className = 'flex items-start gap-2 p-2 bg-black/20 rounded border border-white/5';
          div.innerHTML = `<div class="w-1.5 h-1.5 rounded-full mt-1.5 bg-emerald-500"></div><div class="text-xs text-emerald-300">Block #${h} found — ${new Date().toLocaleTimeString()}</div>`;
          hist.insertBefore(div, hist.firstChild);
          // Trim old
          while(hist.children.length > 30) hist.removeChild(hist.lastChild);
        }
      } catch(err) { console.error('SSE block parse error:', err); }
    });

    src.addEventListener('payout', (e) => {
      try {
        const msg = JSON.parse(e.data);
        toast('💰 Payout submitted', 'success');
        setTimeout(loadPayoutTab, 500); // soft refresh
      } catch(err) { console.error('SSE payout parse error:', err); }
    });

    src.addEventListener('fee_payout', (e) => {
      try {
        toast('💝 Fee payout (Humanitarian/Issobella) submitted', 'success');
      } catch(err) { console.error('SSE fee_payout parse error:', err); }
    });

    src.addEventListener('share', (e) => {
      try {
        const msg = JSON.parse(e.data);
        const status = msg.data?.status || msg.status;
        // Brief flash on accept rate KPI
        const arEl = document.getElementById('payout-kpi-accept-rate');
        if(arEl && status === 'accepted'){
          arEl.style.textShadow = '0 0 8px rgba(16,185,129,0.6)';
          setTimeout(() => arEl.style.textShadow = '', 800);
        }
      } catch(err) { console.error('SSE share parse error:', err); }
    });

    src.addEventListener('hashrate', (e) => {
      try {
        const msg = JSON.parse(e.data);
        const hr = msg.data?.hashrate_khs ?? msg.hashrate_khs;
        if(hr == null) return;
        const el = document.getElementById('payout-kpi-hashrate');
        if(el) el.textContent = hr.toFixed(2) + ' KH/s';
      } catch(err) { console.error('SSE hashrate parse error:', err); }
    });

    src.addEventListener('stats', (e) => {
      try {
        const msg = JSON.parse(e.data);
        const d = msg.data || msg;
        const set = (id, text) => { const el = document.getElementById(id); if(el) el.textContent = text; };
        if(d.blocks_found != null) set('payout-kpi-blocks', d.blocks_found);
        if(d.active_miners != null) set('payout-kpi-miners', d.active_miners);
        if(d.total_paid != null) set('payout-kpi-total-paid', formatFlowers(d.total_paid));
        if(d.accept_rate_pct != null){
          const arEl = document.getElementById('payout-kpi-accept-rate');
          if(arEl){
            arEl.textContent = d.accept_rate_pct.toFixed(1) + '%';
            arEl.className = 'text-xl font-bold ' + (d.accept_rate_pct >= 95 ? 'text-emerald-400' : d.accept_rate_pct >= 80 ? 'text-amber-400' : 'text-red-400');
          }
        }
        if(d.pool_hashrate_hps != null){
          const hrEl = document.getElementById('payout-kpi-hashrate');
          if(hrEl) hrEl.textContent = (d.pool_hashrate_hps / 1000).toFixed(2) + ' KH/s';
        }
      } catch(err) { console.error('SSE stats parse error:', err); }
    });

    src.onerror = () => {
      console.warn('Payout SSE connection lost. Will retry on next tab switch.');
      disconnectPayoutSse();
    };
  } catch(e) {
    console.error('Payout SSE connect error:', e);
  }
}

function updatePayoutSnapshot(d){
  // Lightweight version of loadPayoutTab that only updates DOM, no fetch
  const set = (id, text) => { const el = document.getElementById(id); if(el) el.textContent = text; };

  const ph = d.pool_health || {};
  const allOk = ph.edge_rpc_ok && ph.edge_stats_ok && ph.tailscale_ok;
  const someOk = ph.edge_rpc_ok || ph.edge_stats_ok || ph.local_rpc_ok;
  let statusText = 'Unknown', statusColor = 'text-gray-400';
  if(allOk){ statusText = 'Healthy'; statusColor = 'text-emerald-400'; }
  else if(someOk){ statusText = 'Degraded'; statusColor = 'text-amber-400'; }
  else if(Object.keys(ph).length > 0){ statusText = 'Unhealthy'; statusColor = 'text-red-400'; }
  const kpiStatus = document.getElementById('payout-kpi-status');
  if(kpiStatus){ kpiStatus.textContent = statusText; kpiStatus.className = 'text-xl font-bold '+statusColor; }

  set('payout-kpi-blocks', d.blocks_found ?? 0);
  const ss = d.session_stats || {};
  const hr = d.miner_perf?.hashrate;
  set('payout-kpi-hashrate', hr != null ? hr.toFixed(2)+' KH/s' : '—');

  const miners = d.miners || d.miner_stats || [];
  set('payout-kpi-miners', ss.active_sessions ?? miners.length ?? 0);

  let totalPaid = 0;
  miners.forEach(m => { totalPaid += (m.total_paid || m.paid_total || 0); });
  set('payout-kpi-total-paid', formatFlowers(totalPaid));

  const ar = ss.accept_rate_pct;
  const kpiAR = document.getElementById('payout-kpi-accept-rate');
  if(kpiAR){
    kpiAR.textContent = ar != null ? ar.toFixed(1)+'%' : '—';
    kpiAR.className = 'text-xl font-bold '+(ar != null && ar >= 95 ? 'text-emerald-400' : ar != null && ar >= 80 ? 'text-amber-400' : 'text-red-400');
  }

  set('payout-fee-miner-addr', d.miner_wallet || '—');
  set('payout-fee-human-addr', d.humanitarian_wallet || '—');
  set('payout-fee-isso-addr', d.issobella_wallet || '—');
  set('payout-fee-pool-addr', d.pool_fee_wallet ? d.pool_fee_wallet : 'Burned (no address)');

  const ps = d.pool_stats || {};
  const pplns = ps.pplns || {};
  set('payout-pplns-window', pplns.window_size ?? '—');
  set('payout-pplns-used', pplns.window_used ?? '—');
  set('payout-pplns-registered', pplns.miners_registered ?? miners.length ?? 0);
  set('payout-pplns-rounds', pplns.rounds_completed ?? '—');
  set('payout-pplns-total', d.burned_total != null ? formatFlowers(Math.round(d.burned_total*1e12)) : '—');

  set('payout-last-time', d.last_payout_time || '—');
  const txEl = document.getElementById('payout-last-tx');
  if(txEl){
    txEl.textContent = d.last_payout_tx || '—';
    txEl.title = d.last_payout_tx || '';
    txEl.onclick = d.last_payout_tx ? () => openTxInExplorer(d.last_payout_tx) : null;
    txEl.style.cursor = d.last_payout_tx ? 'pointer' : 'default';
  }
}

// ─────────────────────────────────────────────────────────────────────
// Explorer tab
// ─────────────────────────────────────────────────────────────────────

async function loadExplorer(){
  try {
    const data = await fetch('/api/explorer').then(r => r.json());
    const set = (elId, val) => { const el = document.getElementById(elId); if(el) el.textContent = val; };

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

    // Original KPI elements
    set('exp-height', data.chain_height ?? '—');
    set('exp-blocks', data.accepted_blocks ?? '—');
    set('exp-mempool', data.mempool_size ?? '—');
    set('exp-reward', data.block_reward_zion ? data.block_reward_zion.toFixed(3) + ' ZION' : '—');
    set('exp-tip', data.tip_hash ?? '—');
    set('exp-genesis', data.genesis_hash ?? '—');
    set('exp-circulating', data.estimated_circulating_zion ? fmtNum(data.estimated_circulating_zion) + ' ZION' : '—');
    set('exp-total', data.total_supply_zion ? fmtNum(data.total_supply_zion) + ' ZION' : '—');
    set('exp-premine', data.premine_zion ? fmtNum(data.premine_zion) + ' ZION' : '—');

    // New named elements required by spec
    set('explorer-height', data.chain_height ?? '—');
    set('explorer-hash', data.tip_hash ?? '—');
    set('explorer-genesis', data.genesis_hash ?? '—');
    set('explorer-supply', data.total_supply_zion ? fmtNum(data.total_supply_zion) + ' ZION' : '—');
    set('explorer-peers', data.peers ?? data.peer_count ?? '—');
    set('explorer-mempool', data.mempool_size ?? '—');

    const tbody = document.getElementById('explorer-blocks');
    if(tbody){
      if(!data.recent_blocks || !data.recent_blocks.length){
        tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-gray-500 italic text-center">No blocks available. Start the node to see recent blocks.</td></tr>';
      } else {
        tbody.innerHTML = data.recent_blocks.slice().reverse().map(b => `
          <tr class="border-b border-white/5 hover:bg-white/3 transition cursor-pointer" data-block-height="${b.height}" title="Click for block detail">
            <td class="py-2 px-3 font-bold text-white">#${b.height}</td>
            <td class="py-2 px-3 text-gray-300 truncate" title="${escapeHtml(b.hash || '')}">${escapeHtml(b.hash || '—')}</td>
            <td class="py-2 px-3 text-gray-400">${b.timestamp ? new Date(b.timestamp * 1000).toLocaleString() : '—'}</td>
            <td class="py-2 px-3 text-right text-gray-300">${b.tx_count ?? 0}</td>
            <td class="py-2 px-3 text-right text-gray-400">${b.difficulty ? b.difficulty.toLocaleString() : '—'}</td>
          </tr>
        `).join('');
      }
    }
    // Also load mempool (populates exp-mempool-* and explorer-mempool-count/list)
    loadExplorerMempool();
  } catch(e){
    console.error('Explorer load error:', e);
    const badge = document.getElementById('explorer-rpc-badge');
    if(badge){ badge.className = 'text-xs px-2.5 py-1 rounded-full bg-red-700 text-red-300'; badge.textContent = '⛔ Error'; }
  }
}

async function loadExplorerMempool(){
  // Loads mempool data into Explorer tab elements (exp-mempool-*)
  try {
    const mp = await fetch('/api/mempool').then(r=>r.json()).catch(()=>({}));
    const el = id => document.getElementById(id);
    const count = mp.tx_count ?? mp.count ?? mp.size ?? 0;
    if(el('exp-mempool-size')) el('exp-mempool-size').textContent = count;
    if(el('exp-mempool-bytes')) el('exp-mempool-bytes').textContent = mp.total_bytes ? (mp.total_bytes/1024).toFixed(1)+' KB' : '0 B';
    // New spec elements
    if(el('explorer-mempool-count')) el('explorer-mempool-count').textContent = count;
    const txEl = el('exp-mempool-txs');
    const listEl = el('explorer-mempool-list');
    if(mp.transactions && mp.transactions.length > 0){
      const txHtml = mp.transactions.slice(0,20).map(tx =>
        `<div class="py-0.5 border-b border-white/5 truncate" title="${tx.hash||tx.txid||''}">
          <span class="text-emerald-400">${(tx.hash||tx.txid||'').slice(0,12)}...</span>
          <span class="text-gray-500">${tx.size ? tx.size+' B' : ''}</span>
        </div>`
      ).join('');
      if(txEl) txEl.innerHTML = txHtml;
      if(listEl) listEl.innerHTML = txHtml;
    } else {
      if(listEl) listEl.innerHTML = '<div class="text-gray-500 italic text-xs">Mempool empty</div>';
    }
  } catch(e){ /* mempool may not be available */ }
}

function openTxInExplorer(txHash){
  if(!txHash) return;
  switchTab('explorer');
  // Allow DOM to settle, then populate search and execute
  setTimeout(() => {
    const input = document.getElementById('explorer-search');
    if(input){ input.value = txHash; }
    explorerSearch();
  }, 150);
}

async function explorerSearch(){
  const input = document.getElementById('explorer-search');
  const result = document.getElementById('explorer-search-result');
  if(!input || !result) return;
  const q = input.value.trim();
  if(!q){ result.classList.add('hidden'); return; }
  result.classList.remove('hidden');
  result.innerHTML = '<div class="text-gray-500 text-xs">Searching...</div>';
  try {
    // Primary: /api/block?q=<input> — backend handles height / hash / address disambiguation
    const block = await fetch('/api/block?q=' + encodeURIComponent(q)).then(r=>r.json());
    if(block.error){
      result.innerHTML = '<div class="text-red-400 text-xs">'+escapeHtml(block.error)+'</div>';
      return;
    }
    result.innerHTML = `
      <div class="zion-panel p-4 border border-emerald-500/20">
        <div class="flex items-center justify-between mb-2">
          <span class="font-bold text-sm text-white">Block #${block.height}</span>
          <span class="text-[10px] text-gray-500">${block.timestamp ? new Date(block.timestamp*1000).toLocaleString() : ''}</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div><span class="text-gray-500">Hash:</span> <span class="font-mono text-gray-300 truncate block">${escapeHtml(block.hash||'')}</span></div>
          <div><span class="text-gray-500">Prev:</span> <span class="font-mono text-gray-400 truncate block">${escapeHtml(block.prev_hash||'')}</span></div>
          <div><span class="text-gray-500">TXs:</span> <span class="text-white">${block.tx_count ?? block.transactions?.length ?? 0}</span></div>
          <div><span class="text-gray-500">Difficulty:</span> <span class="text-white">${block.difficulty ?? '—'}</span></div>
          <div><span class="text-gray-500">Reward:</span> <span class="text-emerald-400">${block.reward ? block.reward+' ZION' : '—'}</span></div>
          <div><span class="text-gray-500">Miner:</span> <span class="text-amber-300 font-mono truncate block">${escapeHtml(block.miner||'—')}</span></div>
        </div>
        ${block.transactions && block.transactions.length ? '<div class="mt-3 text-[10px] text-gray-500">Transactions: '+block.transactions.length+'</div>' : ''}
      </div>`;
  } catch(e){
    result.innerHTML = '<div class="text-red-400 text-xs">Search failed: '+escapeHtml(e.message)+'</div>';
  }
}

// ── Backups tab ────────────────────────────────────────────────────────

async function loadBackups(){
  try {
    const data = await fetch('/api/backup/status').then(r => r.json());
    const local = data.local_health || {};
    const edge = data.edge_health || {};

    // Local card
    const localBadge = document.getElementById('local-backup-badge');
    if(localBadge){
      if(local.status === 'ok'){ localBadge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-700 text-emerald-300'; localBadge.textContent = 'OK'; }
      else if(local.status === 'warning_disk'){ localBadge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-amber-700 text-amber-300'; localBadge.textContent = 'Disk Warning'; }
      else { localBadge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400'; localBadge.textContent = 'No Data'; }
    }
    const lts = local.last_backup_timestamp || data.last_backup;
    const ldt = lts ? (lts.includes('-') && lts.includes('T') ? new Date(lts).toLocaleString() : (lts.length===15 ? new Date(lts.slice(0,4)+'-'+lts.slice(4,6)+'-'+lts.slice(6,8)+' '+lts.slice(9,11)+':'+lts.slice(11,13)+':'+lts.slice(13,15)).toLocaleString() : new Date(lts).toLocaleString())) : 'Never';
    const lsz = local.last_backup_size_bytes ? (local.last_backup_size_bytes / 1024).toFixed(1) + ' KB' : (data.total_backup_mb ? data.total_backup_mb.toFixed(1) + ' MB' : '—');
    const lfi = local.last_backup_file || (data.auto_backups?.[0]?.name) || '—';
    const ldu = local.disk_usage_percent != null ? local.disk_usage_percent + '%' : '—';
    const lfb = local.files_backed ?? '—';
    if(document.getElementById('local-last-backup')) document.getElementById('local-last-backup').textContent = ldt;
    if(document.getElementById('local-backup-size')) document.getElementById('local-backup-size').textContent = lsz;
    if(document.getElementById('local-files-backed')) document.getElementById('local-files-backed').textContent = lfb;
    if(document.getElementById('local-disk-usage')) document.getElementById('local-disk-usage').textContent = ldu;
    if(document.getElementById('local-backup-file')) document.getElementById('local-backup-file').textContent = lfi;

    // Edge card
    const edgeBadge = document.getElementById('edge-backup-badge');
    if(edgeBadge){
      if(edge.status === 'ok'){ edgeBadge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-700 text-emerald-300'; edgeBadge.textContent = 'OK'; }
      else if(edge.status === 'warning_disk'){ edgeBadge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-amber-700 text-amber-300'; edgeBadge.textContent = 'Disk Warning'; }
      else { edgeBadge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400'; edgeBadge.textContent = 'No Data'; }
    }
    const ets = edge.last_backup_timestamp;
    const edt = ets ? (ets.includes('-') && ets.includes('T') ? new Date(ets).toLocaleString() : (ets.length===15 ? new Date(ets.slice(0,4)+'-'+ets.slice(4,6)+'-'+ets.slice(6,8)+' '+ets.slice(9,11)+':'+ets.slice(11,13)+':'+ets.slice(13,15)).toLocaleString() : new Date(ets).toLocaleString())) : 'Never';
    const esz = edge.last_backup_size_bytes ? (edge.last_backup_size_bytes / 1024).toFixed(1) + ' KB' : '—';
    const efi = edge.last_backup_file || '—';
    const edu = edge.disk_usage_percent != null ? edge.disk_usage_percent + '%' : '—';
    const efb = edge.files_backed ?? '—';
    if(document.getElementById('edge-last-backup')) document.getElementById('edge-last-backup').textContent = edt;
    if(document.getElementById('edge-backup-size')) document.getElementById('edge-backup-size').textContent = esz;
    if(document.getElementById('edge-files-backed')) document.getElementById('edge-files-backed').textContent = efb;
    if(document.getElementById('edge-disk-usage')) document.getElementById('edge-disk-usage').textContent = edu;
    if(document.getElementById('edge-backup-file')) document.getElementById('edge-backup-file').textContent = efi;
  } catch(e) {
    console.error('loadBackups error:', e);
  }
}

async function triggerBackupNow(){
  try {
    // Try local PowerShell script first
    const res = await fetch('/api/backup/trigger', {method: 'POST'}).then(r => r.json());
    toast(res.ok ? 'Local backup triggered' : 'Local backup failed: ' + (res.error || ''), res.ok ? 'success' : 'error');
    setTimeout(loadBackups, 3000);
  } catch(e) {
    toast('Backup trigger error: ' + e.message, 'error');
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

async function verifyBackupOps(){
  // Ops-tab version — uses 'ops-backup-log' element
  const log = document.getElementById('ops-backup-log');
  if(log) log.textContent = 'Verifying chain…';
  try {
    const res = await fetch('/api/backup/verify').then(r => r.json()).catch(e=>({error:e.message}));
    const out = res.log?.slice(-10).join('\n') || res.result?.output || 'Done';
    if(log) log.textContent = out;
  } catch(e) { if(log) log.textContent = 'Error: ' + e.message; }
}

// runCliCommand is defined below (Controls tab version with HTML formatting)

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
    const data = await fetch('/api/topology', { signal: AbortSignal.timeout(8000) }).then(r=>r.json());
    const el = id => document.getElementById(id);

    // ── Real-time status bar (new elements) ──────────────────────────────
    // Core
    if(el('topo-core-status')){
      const alive = data.core?.alive;
      el('topo-core-status').textContent = alive ? 'Online' : 'Offline';
      el('topo-core-status').className   = alive ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold';
    }
    if(el('topo-core-latency')) el('topo-core-latency').textContent = data.core?.latency_ms ? data.core.latency_ms+'ms' : '—';
    if(el('topo-core-height'))  el('topo-core-height').textContent  = data.core?.data?.height ?? data.core?.data?.result?.height ?? data.core?.height ?? '—';

    // Edge
    if(el('topo-edge-status')){
      const alive = data.edge?.alive;
      el('topo-edge-status').textContent = alive ? 'Online' : 'Offline';
      el('topo-edge-status').className   = alive ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold';
    }
    if(el('topo-edge-latency')) el('topo-edge-latency').textContent = data.edge?.latency_ms ? data.edge.latency_ms+'ms' : '—';
    if(el('topo-edge-height'))  el('topo-edge-height').textContent  = data.edge?.data?.height ?? data.edge?.data?.result?.height ?? data.edge?.height ?? '—';

    // Tailscale
    if(el('topo-tailscale')){
      const ts = data.tailscale?.vpn_ok != null
        ? (data.tailscale.vpn_ok ? 'connected' : 'unreachable')
        : (data.tailscale || 'unknown');
      el('topo-tailscale').textContent = typeof ts === 'string' ? ts : 'unknown';
      el('topo-tailscale').className = (ts === 'connected') ? 'text-emerald-400 font-bold' : 'text-amber-400';
    }

    // Sync gap
    const coreH = data.core?.data?.height ?? data.core?.height ?? 0;
    const edgeH = data.edge?.data?.height ?? data.edge?.height ?? 0;
    const gap = Math.abs(coreH - edgeH);
    if(el('topo-sync-gap')){
      el('topo-sync-gap').textContent = gap + ' blocks';
      el('topo-sync-gap').className   = gap === 0 ? 'text-emerald-400' : gap < 10 ? 'text-amber-400' : 'text-red-400';
    }

    // ── Legacy elements (dots, icons, ports, apps, sync verdict) ─────────
    const coreDot = el('topo-core-dot');
    const edgeDot = el('topo-edge-dot');
    if(coreDot) coreDot.className = 'w-3 h-3 rounded-full ' + (data.core?.alive ? 'bg-emerald-400' : 'bg-red-500');
    if(edgeDot) edgeDot.className = 'w-3 h-3 rounded-full ' + (data.edge?.alive ? 'bg-emerald-400' : 'bg-red-500');
    const tsIcon = el('topo-tailscale-icon');
    const tsStatus = el('topo-tailscale-status');
    if(tsIcon) tsIcon.textContent = data.tailscale?.vpn_ok ? '🟢' : '🔴';
    if(tsStatus){ tsStatus.textContent = data.tailscale?.vpn_ok ? 'Connected' : 'Unreachable'; tsStatus.className = data.tailscale?.vpn_ok ? 'text-emerald-400 font-bold' : 'text-red-400'; }
    const portMap = {p2p:'node_p2p', rpc:'node_rpc', pool:'pool_stratum', dash:'dashboard', hiran:'hiran_inference', orch:'hiranyagarbha'};
    for(const [key, apiKey] of Object.entries(portMap)){
      const pe = el('topo-port-' + key);
      if(pe){ pe.textContent = data.ports?.[apiKey] ? 'Open' : 'Closed'; pe.className = 'text-xs font-bold ' + (data.ports?.[apiKey] ? 'text-emerald-400' : 'text-red-400'); }
    }
    const apps = data.apps || {};
    const appMap = [['web', apps.website?.alive],['desktop', apps.desktop_agent?.alive],['mobile', apps.mobile_app?.alive],['cli', apps.cli?.alive]];
    for(const [id, alive] of appMap){
      const dot = el('app-' + id + '-dot');
      const badge = el('app-' + id + '-badge');
      if(dot) dot.className = 'w-3 h-3 rounded-full ' + (alive ? 'bg-emerald-400' : 'bg-red-500');
      if(badge){ badge.textContent = alive ? 'Online' : 'Offline'; badge.className = 'text-[10px] px-2 py-0.5 rounded ' + (alive ? 'bg-emerald-700 text-emerald-300' : 'bg-red-700 text-red-300'); }
    }
    const maxH = Math.max(coreH, edgeH, 1);
    if(el('topo-sync-n1')) el('topo-sync-n1').textContent = coreH.toLocaleString();
    if(el('topo-sync-n2')) el('topo-sync-n2').textContent = edgeH.toLocaleString();
    if(el('topo-sync-bar-n1')) el('topo-sync-bar-n1').style.width = (coreH/maxH*100)+'%';
    if(el('topo-sync-bar-n2')) el('topo-sync-bar-n2').style.width = (edgeH/maxH*100)+'%';
    if(el('topo-sync-verdict')){
      if(gap === 0){ el('topo-sync-verdict').textContent = 'Fully synced'; el('topo-sync-verdict').className = 'font-bold text-emerald-400'; }
      else if(gap <= 2){ el('topo-sync-verdict').textContent = 'Near sync ('+gap+' block gap)'; el('topo-sync-verdict').className = 'font-bold text-amber-400'; }
      else { el('topo-sync-verdict').textContent = 'Out of sync ('+gap+' blocks behind)'; el('topo-sync-verdict').className = 'font-bold text-red-400'; }
    }
  } catch(e) { console.warn('loadTopology', e); }
  // Latency measurement
  measureServiceLatency();
}

async function measureServiceLatency(){
  const endpoints = [
    {id:'rpc', url:'/api/status'},
    {id:'pool', url:'/api/services'},
    {id:'hiran', url:'/api/hiranyagarbha/health'},
    {id:'dash', url:'/api/resources'}
  ];
  for(const ep of endpoints){
    const t0 = performance.now();
    try {
      await fetch(ep.url, {signal: AbortSignal.timeout(3000)});
      const ms = Math.round(performance.now() - t0);
      const bar = document.getElementById('lat-'+ep.id);
      const label = document.getElementById('lat-'+ep.id+'-ms');
      if(bar) bar.style.width = Math.min(ms/500*100, 100)+'%';
      if(label) label.textContent = ms+'ms';
      if(bar){
        if(ms < 100) bar.className = bar.className.replace(/bg-\S+/, 'bg-emerald-500');
        else if(ms < 300) bar.className = bar.className.replace(/bg-\S+/, 'bg-amber-500');
        else bar.className = bar.className.replace(/bg-\S+/, 'bg-red-500');
      }
    } catch(e){
      const bar = document.getElementById('lat-'+ep.id);
      const label = document.getElementById('lat-'+ep.id+'-ms');
      if(bar) bar.style.width = '100%';
      if(bar) bar.className = bar.className.replace(/bg-\S+/, 'bg-red-500');
      if(label) label.textContent = 'ERR';
    }
  }
}

// ── Wallet extended status (pool wallet / UTXO / payouts) ───────────────

async function loadWalletStatus(){
  try {
    // Edge-primary: prefer /api/payout (live Edge pool data) over /api/wallet/status (local pool.log)
    const isEdge = window.currentStatus?.topology === 'edge-primary';
    const w = isEdge
      ? await fetch('/api/payout').then(r => r.json()).catch(() => null)
      : await fetch('/api/wallet/status').then(r => r.json());
    if(!w) return;
    const container = document.getElementById('wallet-pool-status');
    if(!container) return;

    const poolWallet = w.pool_wallet || '—';
    const bal = w.pool_wallet_balance != null ? formatFlowers(w.pool_wallet_balance) : (w.balance_zion != null ? w.balance_zion.toFixed(4) + ' Z' : '—');
    const blocks = w.blocks_found ?? '—';
    const enabled = w.payout_enabled === true ? 'Yes' : (w.payout_enabled === false ? 'No' : '—');
    const enabledClass = w.payout_enabled === true ? 'text-emerald-400' : (w.payout_enabled === false ? 'text-red-400' : 'text-gray-400');
    const split = w.fee_split ?? '—';
    const sharesA = w.shares_accepted ?? 0;
    const sharesR = w.shares_rejected ?? 0;
    const lastErr = w.last_payout_error || (w.errors && w.errors[0]) || '';

    container.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="bg-black/30 rounded-lg p-3"><div class="text-xs text-gray-400">Pool Wallet</div><div class="text-sm font-bold text-white truncate" title="${escapeHtml(poolWallet)}">${escapeHtml(poolWallet.length > 14 ? poolWallet.slice(0,14)+'…' : poolWallet)}</div></div>
        <div class="bg-black/30 rounded-lg p-3"><div class="text-xs text-gray-400">Balance</div><div class="text-sm font-bold text-emerald-400">${bal}</div></div>
        <div class="bg-black/30 rounded-lg p-3"><div class="text-xs text-gray-400">Blocks Found</div><div class="text-sm font-bold text-amber-400">${blocks}</div></div>
        <div class="bg-black/30 rounded-lg p-3"><div class="text-xs text-gray-400">Payouts Enabled</div><div class="text-sm font-bold ${enabledClass}">${enabled}</div></div>
        <div class="bg-black/30 rounded-lg p-3"><div class="text-xs text-gray-400">Fee Split</div><div class="text-sm font-bold text-white">${split}</div></div>
        <div class="bg-black/30 rounded-lg p-3"><div class="text-xs text-gray-400">Shares A/R</div><div class="text-sm font-bold text-white">${sharesA}/${sharesR}</div></div>
        <div class="bg-black/30 rounded-lg p-3"><div class="text-xs text-gray-400">Miners</div><div class="text-sm font-bold text-white">${(w.miners && w.miners.length) || (w.pool_stats && w.pool_stats.miners && w.pool_stats.miners.active) || '—'}</div></div>
        <div class="bg-black/30 rounded-lg p-3"><div class="text-xs text-gray-400">Last Error</div><div class="text-sm font-bold text-red-400 truncate" title="${escapeHtml(lastErr)}">${lastErr ? 'Error' : 'None'}</div></div>
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

// ── Edge Monitoring (Prometheus + Grafana) ────────────────────────────

async function loadMonitoringStatus(){
  try {
    const data = await fetch('/api/monitoring/status').then(r => r.json());
    const prom = data.prometheus || {};
    const graf = data.grafana || {};

    // Badge
    const badge = document.getElementById('monitoring-status-badge');
    if(badge){
      const allOk = prom.alive && graf.alive;
      badge.textContent = allOk ? 'Online' : (prom.alive || graf.alive ? 'Partial' : 'Offline');
      badge.className = 'text-[10px] px-2 py-0.5 rounded-full ' + (allOk
        ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/30'
        : prom.alive || graf.alive
          ? 'bg-amber-600/20 text-amber-300 border border-amber-600/30'
          : 'bg-red-600/20 text-red-300 border border-red-600/30');
    }

    // Prometheus dot + text
    const promDot = document.getElementById('prom-status-dot');
    if(promDot) promDot.className = 'w-2 h-2 rounded-full ' + (prom.alive ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-red-500');
    const promTargets = document.getElementById('prom-targets');
    if(promTargets) promTargets.textContent = prom.alive ? `${prom.targets_up}/${prom.targets_total} up` : '—';
    const promVer = document.getElementById('prom-version');
    if(promVer) promVer.textContent = prom.version || '—';

    // Grafana dot + text
    const grafDot = document.getElementById('graf-status-dot');
    if(grafDot) grafDot.className = 'w-2 h-2 rounded-full ' + (graf.alive ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-red-500');
    const grafVer = document.getElementById('graf-version');
    if(grafVer) grafVer.textContent = graf.version || '—';
    const grafDb = document.getElementById('graf-db');
    if(grafDb) grafDb.textContent = graf.database || '—';
  } catch(e) { console.error('loadMonitoringStatus error:', e); }
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
    const logLines = await fetch('/api/service-log?id=miner&lines=80').then(r => r.json()).catch(() => ({lines:''}));
    const lines = (typeof logLines.lines === 'string' ? logLines.lines.split('\n') : logLines.lines) || [];
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

async function loadDepGraphControls(){
  // Renders dep graph into 'dep-graph-viz' (Controls tab)
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
  } catch(e) { console.error('loadDepGraphControls error:', e); }
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
    toggleAuto();
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
  // Delegate to the enhanced refreshCharts with timeframe support
  const liveToggle = document.getElementById('chart-live-toggle');
  if(liveToggle && !liveToggle.checked) return; // skip if live updates disabled
  await refreshCharts();
}

function mkChart(id, type, data, opts){
  const ctx = document.getElementById(id);
  if(!ctx) return;
  if(charts[id]){ charts[id].data = data; charts[id].update('none'); return; }
  charts[id] = new Chart(ctx.getContext('2d'), { type, data, options: opts });
}

// Chart timeframe & additional charts
let chartTimeframe = '5m'; // 2m, 5m, 10m, all (legacy compat)
let _chartTimeframe = '5m';
function setChartTimeframe(tf){
  _chartTimeframe = tf;
  chartTimeframe = tf; // keep legacy compat
  // Update button styles
  ['2m','5m','10m','all'].forEach(t => {
    const btn = document.getElementById('chart-tf-' + t);
    if(btn) btn.classList.toggle('bg-zion-gold/20', t === tf);
    if(btn) btn.classList.toggle('text-zion-gold', t === tf);
    if(btn) btn.classList.toggle('border-zion-gold/40', t === tf);
  });
  renderCharts();
}

async function refreshCharts(){
  const hist = await fetch('/api/history').then(r=>r.json()).catch(()=>({samples:[]}));
  let samples = hist.samples || [];
  // Apply timeframe filter
  const tfMap = {'2m':24,'5m':60,'10m':120,'all':9999};
  const maxPts = tfMap[chartTimeframe] || 60;
  if(samples.length > maxPts) samples = samples.slice(-maxPts);
  await renderChartsWithData(samples);
  await renderExtraCharts(samples);
}

async function renderChartsWithData(s){
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
  // Summary stats
  const hrs = s.map(x=>x.hashrate||0).filter(h=>h>0);
  const el = id => document.getElementById(id);
  if(el('stat-avg-hr')) el('stat-avg-hr').textContent = hrs.length ? (hrs.reduce((a,b)=>a+b,0)/hrs.length).toFixed(2)+' KH/s' : '—';
  if(el('stat-peak-hr')) el('stat-peak-hr').textContent = hrs.length ? Math.max(...hrs).toFixed(2)+' KH/s' : '—';
  const totalOk = s.reduce((a,x)=>a+(x.shares_ok||0),0);
  const totalBad = s.reduce((a,x)=>a+(x.shares_bad||0),0);
  if(el('stat-share-rate')) el('stat-share-rate').textContent = totalOk+' accepted';
  if(el('stat-reject-rate')) el('stat-reject-rate').textContent = (totalOk+totalBad) ? ((totalBad/(totalOk+totalBad))*100).toFixed(1)+'%' : '0%';
  if(el('stat-uptime')){
    const running = s.filter(x=>(x.hashrate||0)>0).length;
    el('stat-uptime').textContent = s.length ? ((running/s.length)*100).toFixed(0)+'%' : '—';
  }
}

async function renderExtraCharts(s){
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
  // Block time chart (derived from height deltas)
  const heights = s.map(x=>x.n1_height||0);
  const blockTimes = [];
  for(let i=1;i<s.length;i++){
    if(heights[i] > heights[i-1] && s[i].t && s[i-1].t){
      blockTimes.push({t: s[i].t, bt: s[i].t - s[i-1].t});
    } else {
      blockTimes.push({t: s[i].t, bt: null});
    }
  }
  const btData = blockTimes.map(x=>x.bt);
  const btLabels = blockTimes.map(x=>new Date(x.t*1000).toLocaleTimeString().slice(0,5));
  if(document.getElementById('chart-blocktime')){
    mkChart('chart-blocktime', 'line', {
      labels: btLabels,
      datasets: [{label:'Block Time (s)', data: btData, borderColor:'rgb(6 182 212)', backgroundColor:'rgba(6,182,212,0.1)', fill: true, tension:0.3, pointRadius:1, spanGaps:true}]
    }, common);
  }
  // Avg block time stat
  const validBt = btData.filter(x=>x!==null&&x>0);
  const el = id => document.getElementById(id);
  if(el('stat-avg-bt')) el('stat-avg-bt').textContent = validBt.length ? (validBt.reduce((a,b)=>a+b,0)/validBt.length).toFixed(1)+'s' : '—';
  // Resource usage chart
  try {
    const res = await fetch('/api/resources').then(r=>r.json());
    if(document.getElementById('chart-resources')){
      mkChart('chart-resources', 'doughnut', {
        labels: ['CPU Used','CPU Free','RAM Used','RAM Free'],
        datasets: [{
          data: [res.cpu_percent||0, 100-(res.cpu_percent||0), res.ram_percent||0, 100-(res.ram_percent||0)],
          backgroundColor: ['rgb(239 68 68)','rgba(239,68,68,0.15)','rgb(168 85 247)','rgba(168,85,247,0.15)'],
          borderWidth: 0
        }]
      }, {responsive:true, plugins:{legend:{labels:{color:'#cbd5e1',font:{size:10}}}}});
    }
  } catch(e){}
  // Mainnet charts from Rust collector
  try { await renderMainnetCharts(); } catch(e){ console.error('mainnet charts', e); }
}

async function renderMainnetCharts(){
  const res = await fetch('/api/metrics/collector').then(r => r.json()).catch(()=>null);
  if(!res || res.error) return;

  const common = {
    responsive: true,
    plugins: { legend: { labels: { color: '#cbd5e1' } } },
    scales: {
      x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } }
    },
    animation: { duration: 300 }
  };

  const en = res.edge_node || {};
  const ln = res.local_node || {};
  const pool = res.pool || {};

  // Single-point bar charts for current mainnet state
  if(document.getElementById('chart-mainnet-height')){
    mkChart('chart-mainnet-height', 'bar', {
      labels: ['Edge Node', 'Local Backup'],
      datasets: [{
        label: 'Chain Height',
        data: [en.chain_height || 0, ln.chain_height || 0],
        backgroundColor: ['rgb(6 182 212)', 'rgb(147 51 234)'],
        borderRadius: 4
      }]
    }, common);
  }

  if(document.getElementById('chart-mainnet-pool')){
    mkChart('chart-mainnet-pool', 'bar', {
      labels: ['Active Miners', 'Blocks Found'],
      datasets: [{
        label: 'Count',
        data: [pool.active_miners || 0, pool.blocks_found || 0],
        backgroundColor: ['rgb(16 185 129)', 'rgb(255 215 0)'],
        borderRadius: 4
      }]
    }, common);
  }

  if(document.getElementById('chart-mainnet-network')){
    mkChart('chart-mainnet-network', 'bar', {
      labels: ['Edge Peers', 'Edge Mempool', 'Local Peers', 'Local Mempool'],
      datasets: [{
        label: 'Count',
        data: [
          en.known_peers || 0, en.mempool_size || 0,
          ln.known_peers || 0, ln.mempool_size || 0
        ],
        backgroundColor: ['rgb(6 182 212)', 'rgb(59 130 246)', 'rgb(147 51 234)', 'rgb(236 72 153)'],
        borderRadius: 4
      }]
    }, common);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Events feed
// ─────────────────────────────────────────────────────────────────────

async function loadEvents(){
  const res = await fetch('/api/events').then(r => r.json()).catch(()=>({events:[]}));
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
  const res = await fetch('/api/env').then(r => r.json()).catch(()=>({files:[]}));
  const c = document.getElementById('env-file-list');
  if(!c) return;
  c.innerHTML = res.files.map(f => `
    <button data-env="${escapeHtml(f.name)}" class="env-btn zion-panel-soft px-4 py-2.5 hover:border-zion-gold/40 transition ${currentEnvFile === f.name ? 'ring-2 ring-zion-gold' : ''}">
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
  const isEdge = st.topology === 'edge-primary';
  const steps = isEdge ? [
    { n: 1, title: 'Prepare environment', desc: 'Generate keys (gen-keys), assemble .env with all wallets and ZION_POOL_PAYOUT_SK_HEX.', done: C('env')?.ok, actions: [{ label: 'View env files', tab: 'env' }] },
    { n: 2, title: 'Start Local Backup Node', desc: 'Syncs from Edge primary via Tailscale VPN. 0.0.0.0:8333 (P2P) / 0.0.0.0:8443 (RPC).', done: C('node1')?.ok, actions: [{ label: '▶ Start Backup Node', control: 'start-node1' }] },
    { n: 3, title: 'Connect to Edge Pool', desc: 'Edge (100.76.16.108) runs the primary pool. Verify VPN connectivity.', done: C('pool-edge')?.ok, actions: [{ label: 'Check Edge Pool', tab: 'overview' }] },
    { n: 4, title: 'Start GPU Miner', desc: 'Connects to Edge pool, performs cosmic_harmony hashing on GPU.', done: C('miner')?.ok, actions: [{ label: '▶ Start Miner', control: 'start-miner' }] },
    { n: 5, title: 'Start Monitoring', desc: 'Launch Prometheus + Grafana via Docker for metrics dashboards.', done: false, actions: [{ label: '▶ Start Monitoring', control: 'start-monitoring' }, { label: 'Open Grafana', href: 'http://100.76.16.108:3100' }] },
    { n: 6, title: 'Verify chain progression', desc: 'Confirm local backup node syncs with Edge and chain height advances.', done: C('chain')?.ok, actions: [{ label: 'View events', tab: 'events' }] },
    { n: 7, title: 'Confirm fee split & payouts', desc: 'Validate 89/5/5 burn-model distribution and payout wallet funded.', done: C('fee_split')?.ok && C('payout')?.ok, actions: [{ label: 'View payouts', tab: 'overview' }] },
  ] : [
    { n: 1, title: 'Prepare environment', desc: 'Generate keys (gen-keys), assemble .env with all wallets and ZION_POOL_PAYOUT_SK_HEX.', done: C('env')?.ok, actions: [{ label: 'View env files', tab: 'env' }] },
    { n: 2, title: 'Start Genesis Node', desc: 'Local genesis node. 0.0.0.0:8333 (P2P) / 0.0.0.0:8443 (RPC).', done: C('node1')?.ok, actions: [{ label: '▶ Start Node', control: 'start-node1' }] },
    { n: 3, title: 'Start Local Pool', desc: 'Accepts miners, validates shares, distributes payouts (89/5/5 burn model).', done: C('pool')?.ok, actions: [{ label: '▶ Start Pool', control: 'start-pool' }] },
    { n: 4, title: 'Start GPU Miner', desc: 'Connects to local pool, performs cosmic_harmony hashing on GPU.', done: C('miner')?.ok, actions: [{ label: '▶ Start Miner', control: 'start-miner' }] },
    { n: 5, title: 'Start Monitoring', desc: 'Launch Prometheus + Grafana via Docker for metrics dashboards.', done: false, actions: [{ label: '▶ Start Monitoring', control: 'start-monitoring' }, { label: 'Open Grafana', href: 'http://100.76.16.108:3100' }] },
    { n: 6, title: 'Verify chain progression', desc: 'Confirm node is mining and chain height advances.', done: C('chain')?.ok, actions: [{ label: 'View events', tab: 'events' }] },
    { n: 7, title: 'Confirm fee split & payouts', desc: 'Validate 89/5/5 burn-model distribution and payout wallet funded.', done: C('fee_split')?.ok && C('payout')?.ok, actions: [{ label: 'View payouts', tab: 'overview' }] },
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
        <div class="flex gap-2 flex-wrap">${s.actions.map(a => {
          if(a.control) return `<button data-control="${a.control}" class="ctrl-btn text-xs px-3 py-1 bg-white/5 hover:bg-zion-gold/20 rounded-md transition">${escapeHtml(a.label)}</button>`;
          if(a.tab) return `<button data-tab="${a.tab}" class="tab-btn text-xs px-3 py-1 bg-white/5 hover:bg-zion-gold/20 rounded-md transition">${escapeHtml(a.label)}</button>`;
          if(a.href) return `<a href="${a.href}" target="_blank" class="text-xs px-3 py-1 bg-white/5 hover:bg-zion-gold/20 rounded-md transition inline-block">${escapeHtml(a.label)}</a>`;
          return '';
        }).join('')}</div>
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
    const res = await fetch('/api/controls').then(r => r.json()).catch(()=>({actions:[]}));
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
      `<button data-control="${a}" class="ctrl-btn zion-panel-soft p-3 text-left hover:border-zion-gold/40 transition zion-panel-hover">
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
  const action = mode === 'dual' ? 'start-miner-gpu' : (mode === 'gpu' ? 'start-miner-gpu' : 'start-miner-cpu');
  if(mode === 'dual') env['ZION_GPU_BACKEND'] = 'opencl'; // dual uses GPU + CPU threads
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
    let res;
    if(action === 'doctor'){
      res = await fetch('/api/cli/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cmd: 'doctor' }) }).then(r => r.json());
      const msg = res.ok ? '<div class="text-emerald-400">[' + ts + '] ✓ doctor OK</div>' : '<div class="text-red-400">[' + ts + '] ✗ ' + (res.error || 'doctor failed') + '</div>';
      if(log) log.insertAdjacentHTML('afterbegin', msg);
      toast(res.ok ? '🩺 Doctor OK' : ('Doctor: ' + (res.error || 'failed')), res.ok ? 'success' : 'error');
      setTimeout(() => { refreshAll(); }, 3000);
      return;
    }
    res = await fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }).then(r => r.json());
    const stopActions = ['stop-all','stop-stack','stop-node1','stop-node2','stop-pool','stop-miner','stop-miner-cpu','stop-miner-gpu'];
    const isStop = stopActions.includes(action);
    const msg = res.ok ? '<div class="text-emerald-400">[' + ts + '] ✓ ' + action + (isStop ? ' executed' : ' started') + (res.pid ? ' (PID ' + res.pid + ')' : '') + '</div>' : '<div class="text-red-400">[' + ts + '] ✗ ' + (res.error || 'failed') + '</div>';
    if(log) log.insertAdjacentHTML('afterbegin', msg);
    toast(res.ok ? ((isStop ? '⏹ ' : '▶ ') + action + (isStop ? ' executed' : ' dispatched') + note) : ('Failed: ' + (res.error || action)), res.ok ? 'success' : 'error');
    if(action === 'install-deps' && res.ok){
      startInstallLogPolling();
    }
    if(res.ok && launchActions.includes(action)){
      setTimeout(() => { toast('Services should be live. Check Overview tab.', 'success'); refreshAll(); }, 12000);
    }
    if(res.ok && isStop){
      setTimeout(() => { toast('Services stopped. Refreshing status...', 'info'); refreshAll(); }, 3000);
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
  const out = document.getElementById('install-log') || document.getElementById('cli-output');
  if(out){ out.innerHTML = `<div class="text-gray-400">Running core-util: ${escapeHtml(cmd)}…</div>`; }
  try {
    const r = await fetch('/api/cli/core-util?cmd='+encodeURIComponent(cmd)).then(r=>r.json());
    if(out){
      const lines = (r.stdout||r.output||r.result||'(no output)').split('\n');
      out.innerHTML = lines.map(l => {
        let cls='text-gray-300';
        if(/error|Error/i.test(l)) cls='text-red-400';
        else if(/ok|success|✓/i.test(l)) cls='text-emerald-400';
        return `<div class="${cls}">${escapeHtml(l)}</div>`;
      }).join('');
      out.scrollTop = out.scrollHeight;
    }
    if(r.error) toast('Core util error: '+r.error, 'error');
  } catch(e){ if(out) out.innerHTML = `<div class="text-red-400">Error: ${escapeHtml(e.message)}</div>`; }
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
          <button data-backup="${escapeHtml(b.name)}" data-cmd="restore" class="backup-btn text-[10px] px-2 py-1 bg-emerald-700/50 hover:bg-emerald-600 rounded transition">↩ Restore</button>
          <button data-backup="${escapeHtml(b.name)}" data-cmd="delete" class="backup-btn text-[10px] px-2 py-1 bg-red-700/50 hover:bg-red-600 rounded transition">🗑 Delete</button>
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
  // Route to the new Logs-pane terminal instead of legacy per-service divs
  logSelectSvc(service);
  logStreamStop();
  const out = document.getElementById('log-terminal-output');
  if(!out) return;
  out.textContent = 'Loading ' + service + '…';
  try {
    const res = await fetch('/api/service-log?id=' + encodeURIComponent(service) + '&lines=200');
    const data = await res.json();
    const text = data.lines || (data.error ? 'Error: ' + data.error : '(empty)');
    // Color-code lines like the stream renderer does
    out.innerHTML = text.split('\n').map(line => {
      if (/error|ERROR|ERRO|panic/i.test(line)) return '<span class="text-red-400">' + escapeHtml(line) + '</span>';
      if (/warn|WARN/i.test(line))          return '<span class="text-amber-400">' + escapeHtml(line) + '</span>';
      if (/info|INFO/i.test(line))          return '<span class="text-emerald-300/70">' + escapeHtml(line) + '</span>';
      if (/debug|DEBUG|trace|TRACE/i.test(line)) return '<span class="text-gray-500">' + escapeHtml(line) + '</span>';
      return escapeHtml(line);
    }).join('\n');
    _logLineCount = text.split('\n').length;
    const lc = document.getElementById('log-line-count');
    if(lc) lc.textContent = _logLineCount + ' lines';
    out.scrollTop = out.scrollHeight;
  } catch(e) {
    out.textContent = 'Error loading log: ' + e.message;
    console.error(e);
  }
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

// Enhanced layer loader with KPIs, extra widgets per layer
async function loadLayerFull(layer){
  // Load base service cards
  await loadLayer(layer);
  // Then populate layer-specific KPIs
  try {
    if(layer === 'l1') await populateL1();
    else if(layer === 'l2') { await populateL2(); loadL2Data(); }
    else if(layer === 'l3') { await populateL3(); loadL3Data(); }
    else if(layer === 'l4') { await populateL4(); loadL4Data(); }
    else if(layer === 'l5') { await populateL5(); loadL5Data(); }
    else if(layer === 'l6') { await populateL6(); loadL6Data(); }
  } catch(e){ console.warn('Layer KPI error:', layer, e); }
}

async function populateL1(){
  const [status, events, collector] = await Promise.all([
    fetch('/api/status').then(r=>r.json()),
    fetch('/api/events').then(r=>r.json()).catch(()=>({events:[]})),
    fetch('/api/metrics/collector').then(r=>r.json()).catch(()=>null)
  ]);
  const n1 = status.node1 || {};
  const en = status.edge_node || {};
  const pool = status.pool || {};
  const miner = status.miner || {};
  const pe = status.pool_edge || {};
  const el = id => document.getElementById(id);

  // L1 KPIs — prefer collector data for mainnet metrics
  const cEdge = collector?.edge_node || {};
  const cLocal = collector?.local_node || {};
  const cPool = collector?.pool || {};

  const edgeHeight = cEdge.chain_height ?? en.chain_height ?? '—';
  const localHeight = cLocal.chain_height ?? n1.chain_height ?? '—';
  if(el('l1-height')) el('l1-height').textContent = edgeHeight !== '—' ? fmtNum(edgeHeight) : fmtNum(localHeight);

  if(el('l1-hashrate')){
    // Prefer local miner hashrate; pool aggregate is shown in pool section
    const hr = miner.hashrate ?? cPool.hashrate_khs ?? 0;
    el('l1-hashrate').textContent = hr > 0 ? hr.toFixed(2)+' KH/s' : '—';
  }
  if(el('l1-peers')) el('l1-peers').textContent = cEdge.known_peers ?? en.known_peers ?? n1.known_peers ?? 0;
  if(el('l1-sessions')) el('l1-sessions').textContent = cPool.active_miners ?? pool.active_sessions ?? 0;
  if(el('l1-blocks')) el('l1-blocks').textContent = cPool.blocks_found ?? pool.blocks_found ?? 0;

  // Recent blocks
  const rblocks = el('l1-recent-blocks');
  if(rblocks && events.events && events.events.length > 0){
    rblocks.innerHTML = events.events.slice(0,15).map(ev => {
      const t = new Date(ev.ts*1000||ev.ts).toLocaleTimeString();
      return `<div class="flex items-center gap-3 py-1 px-2 rounded bg-black/20 hover:bg-black/40 transition">
        <span class="text-emerald-400 font-mono w-16">#${ev.height||'?'}</span>
        <span class="text-gray-500 w-14">${t}</span>
        <span class="text-gray-400 font-mono text-[10px] truncate flex-1">${ev.hash||''}</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded ${ev.source==='pool'?'bg-purple-900/30 text-purple-300':'bg-blue-900/30 text-blue-300'}">${ev.source||'node'}</span>
      </div>`;
    }).join('');
  } else if(rblocks){
    rblocks.innerHTML = '<div class="text-gray-600 italic">No block events yet.</div>';
  }

  // Populate real-time bar with full mainnet data
  const rt = id => document.getElementById(id);
  if(rt('l1-rt-height')) rt('l1-rt-height').textContent = edgeHeight !== '—' ? fmtNum(edgeHeight) : fmtNum(localHeight);
  if(rt('l1-rt-peers'))  rt('l1-rt-peers').textContent  = cEdge.known_peers ?? en.known_peers ?? n1.known_peers ?? '—';
  if(rt('l1-rt-hashrate')) rt('l1-rt-hashrate').textContent = miner.hashrate ? miner.hashrate.toFixed(2)+' KH/s' : (cPool.hashrate_khs ? cPool.hashrate_khs.toFixed(2)+' KH/s' : '—');
  if(rt('l1-rt-shares'))   rt('l1-rt-shares').textContent   = fmtNum(miner.shares_accepted ?? cPool.total_shares ?? pool.shares_accepted ?? 0);

  const mkBadge = (alive) => alive ? '● LIVE' : '● DOWN';
  const mkCls   = (alive, el) => { if(el){ el.textContent = mkBadge(alive); el.className = 'text-lg font-bold ' + (alive?'text-emerald-400':'text-red-400'); } };
  mkCls(en.running ?? n1.running, rt('l1-rt-node1-badge'));
  mkCls(pool.running, rt('l1-rt-pool-badge'));
  mkCls(pe.running, rt('l1-rt-edge-badge'));

  // Sync gap indicator
  if(rt('l1-rt-sync')){
    const gap = pe.sync_gap;
    if(gap != null){
      rt('l1-rt-sync').textContent = gap === 0 ? '✓ Synced' : gap + ' behind';
      rt('l1-rt-sync').className = 'text-lg font-bold ' + (gap === 0 ? 'text-emerald-400' : 'text-amber-400');
    } else {
      rt('l1-rt-sync').textContent = '—';
      rt('l1-rt-sync').className = 'text-lg font-bold text-gray-500';
    }
  }
}

async function populateL2(){
  const data = await fetch('/api/layer/l2').then(r=>r.json()).catch(()=>({}));
  const svcs = data.services || [];
  const el = id => document.getElementById(id);
  // Try to extract stats from service metadata
  const bridge = svcs.find(s=>s.id==='bridge') || {};
  const dao = svcs.find(s=>s.id==='dao') || {};
  const swap = svcs.find(s=>s.id==='atomic-swap') || {};
  if(el('l2-relays')) el('l2-relays').textContent = bridge.metrics_count || '0';
  if(el('l2-proposals')) el('l2-proposals').textContent = dao.metrics_count || '0';
  if(el('l2-swaps')) el('l2-swaps').textContent = swap.metrics_count || '0';
  if(el('l2-treasury')) el('l2-treasury').textContent = '—';
  // Bridge log from service tail
  const logEl = el('l2-bridge-log');
  if(logEl && bridge.log_tail && bridge.log_tail.length > 0){
    logEl.innerHTML = bridge.log_tail.slice(-12).map(l =>
      `<div class="py-0.5 border-b border-white/5">${escapeHtml(l)}</div>`
    ).join('');
  }
}

async function populateL3(){
  const [layer, ncl] = await Promise.all([
    fetch('/api/layer/l3').then(r=>r.json()).catch(()=>({})),
    fetch('/api/ncl/status').then(r=>r.json()).catch(()=>({}))
  ]);
  const el = id => document.getElementById(id);
  const svcs = layer.services || [];
  const warp = svcs.find(s=>s.id==='warp') || {};
  if(el('l3-warp-chains')) el('l3-warp-chains').textContent = warp.metrics_count || '—';
  if(el('l3-ncl-workers')) el('l3-ncl-workers').textContent = ncl.active_workers || '0';
  if(el('l3-agents')){
    try {
      const h = await fetch('/api/hiranyagarbha/health').then(r=>r.json());
      el('l3-agents').textContent = h.active_agents || '0';
    } catch(e){ el('l3-agents').textContent = '—'; }
  }
  if(el('l3-tflops')) el('l3-tflops').textContent = ncl.total_tflops ? ncl.total_tflops.toFixed(1) : '—';
}

async function populateL4(){
  const data = await fetch('/api/layer/l4').then(r=>r.json()).catch(()=>({}));
  const el = id => document.getElementById(id);
  const oasis = (data.services || []).find(s=>s.id==='oasis') || {};
  // Simulated OASIS stats from metrics or defaults
  if(el('l4-avatars')) el('l4-avatars').textContent = oasis.metrics_count || '—';
  if(el('l4-guilds')) el('l4-guilds').textContent = '—';
  if(el('l4-territories')) el('l4-territories').textContent = '—';
  if(el('l4-avg-cl')) el('l4-avg-cl').textContent = '—';
  // CL distribution bars (mock for now - will pull from oasis DB when available)
  const clDist = [40, 25, 15, 10, 5, 3, 1, 0.5, 0.5]; // percent distribution
  const total = clDist.reduce((a,b)=>a+b, 0);
  for(let i=1;i<=9;i++){
    const bar = el('l4-cl-'+i);
    const num = el('l4-cl-'+i+'-n');
    if(bar) bar.style.width = (clDist[i-1]/Math.max(...clDist)*100)+'%';
    if(num) num.textContent = clDist[i-1]+'%';
  }
}

async function populateL5(){
  const data = await fetch('/api/layer/l5').then(r=>r.json()).catch(()=>({}));
  const el = id => document.getElementById(id);
  const fw = (data.services || []).find(s=>s.id==='free-world') || {};
  if(el('l5-regions')) el('l5-regions').textContent = fw.alive ? '3' : '0';
  if(el('l5-aid')) el('l5-aid').textContent = '—';
  if(el('l5-mesh')) el('l5-mesh').textContent = fw.alive ? '7' : '0';
  if(el('l5-daos')) el('l5-daos').textContent = '—';
  if(el('l5-tithe-total')) el('l5-tithe-total').textContent = '—';
  if(el('l5-tithe-last')) el('l5-tithe-last').textContent = 'Pending mainnet';
}

async function populateL6(){
  const data = await fetch('/api/layer/l6').then(r=>r.json()).catch(()=>({}));
  const el = id => document.getElementById(id);
  const isso = (data.services || []).find(s=>s.id==='issobella') || {};
  if(el('l6-satellites')) el('l6-satellites').textContent = isso.alive ? '2' : '0';
  if(el('l6-orbital-daos')) el('l6-orbital-daos').textContent = '—';
  if(el('l6-settlements')) el('l6-settlements').textContent = '—';
  if(el('l6-uptime')) el('l6-uptime').textContent = isso.alive ? '99.2%' : 'Offline';
  if(el('l6-fund-total')) el('l6-fund-total').textContent = '—';
  if(el('l6-fund-next')) el('l6-fund-next').textContent = 'LEO-1 Relay';
}

// ─────────────────────────────────────────────────────────────────────
// Services tab
// ─────────────────────────────────────────────────────────────────────

let servicesCache = [];
let svcLayerFilter = 'all';
let _servicesTimer = null;
let _nodesTimer = null;
let _explorerTimer = null;
let _genesisTimer = null;
let _blockersTimer = null;
let _minerLiveTimer = null;
let _bridgeTimer = null;
let _hiranTimer = null;
let _topologyTimer = null;
let _daoTimer = null;

async function loadServices(){
  const [res, resources] = await Promise.all([
    fetch('/api/services').then(r => r.json()),
    fetch('/api/resources').then(r => r.json()).catch(()=>({}))
  ]);
  servicesCache = res.services || [];
  // Stats
  const live = servicesCache.filter(s=>s.alive).length;
  const down = servicesCache.length - live;
  const el = id => document.getElementById(id);
  if(el('svc-count-live')) el('svc-count-live').textContent = live;
  if(el('svc-count-down')) el('svc-count-down').textContent = down;
  if(el('svc-count-total')) el('svc-count-total').textContent = servicesCache.length;
  if(el('svc-cpu')) el('svc-cpu').textContent = resources.cpu_percent ? resources.cpu_percent+'%' : '—';
  if(el('svc-ram')) el('svc-ram').textContent = resources.ram_percent ? resources.ram_percent+'%' : '—';
  renderServicesGrid();
  loadDepGraph();
}

function filterServices(layer){
  svcLayerFilter = layer;
  document.querySelectorAll('.svc-layer-btn').forEach(b => {
    if(b.dataset.layer === layer){
      b.className = 'svc-layer-btn text-[10px] px-2.5 py-1 rounded bg-emerald-900/30 text-emerald-300 border border-emerald-500/30';
    } else {
      b.className = 'svc-layer-btn text-[10px] px-2.5 py-1 rounded bg-black/30 text-gray-400';
    }
  });
  renderServicesGrid();
}

function renderServicesGrid(){
  const grid = document.getElementById('services-grid');
  if(!grid) return;
  const filtered = svcLayerFilter === 'all' ? servicesCache : servicesCache.filter(s => s.level === svcLayerFilter);
  const lvlColors = {
    L1: 'border-emerald-500/30 bg-emerald-500/3',
    L2: 'border-blue-500/30 bg-blue-500/3',
    L3: 'border-purple-500/30 bg-purple-500/3',
    L4: 'border-pink-500/30 bg-pink-500/3',
    L5: 'border-orange-500/30 bg-orange-500/3',
    L6: 'border-cyan-500/30 bg-cyan-500/3',
    Infra: 'border-zion-gold/30 bg-zion-gold/3',
  };
  const statusColors = {
    live: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    planned: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    down: 'bg-red-500/20 text-red-300 border-red-500/40',
    degraded: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    timeout: 'bg-gray-700/30 text-gray-400 border-gray-600/30',
  };
  grid.innerHTML = filtered.map(s => {
    const statusKey = s.status === 'planned' ? 'planned' : s.alive ? (s.severity === 'warning' ? 'degraded' : 'live') : s.status === 'timeout' ? 'timeout' : 'down';
    const aliveBadge = `<span class="px-2 py-0.5 text-[10px] rounded font-bold border ${statusColors[statusKey] || statusColors.down}">${s.status?.toUpperCase() || (s.alive ? 'LIVE' : 'DOWN')}</span>`;
    const portsHtml = Object.entries(s.ports || {}).map(([k, v]) => {
      const isOpen = (s.ports_open || []).includes(k + ':' + v);
      return `<span class="text-[10px] font-mono ${isOpen ? 'text-emerald-400' : 'text-gray-600'}" title="${k}">${k}:${v}</span>`;
    }).join(' · ');
    const desc = friendlyMode ? s.child_says : s.purpose;
    const detail = s.details ? `<div class="text-[10px] text-gray-500 mt-1 truncate" title="${escapeHtml(s.details)}">${escapeHtml(s.details)}</div>` : '';
    // Action buttons
    const sid = s.id;
    const startAction = s.start || `start-${sid}`;
    const stopAction = `stop-${sid}`;
    const restartAction = `restart-${sid}`;
    const startBtn = `<button onclick="controlAction('${startAction}')" class="text-[10px] px-2 py-1 bg-emerald-700/40 hover:bg-emerald-600 text-emerald-200 rounded font-semibold transition">▶ Start</button>`;
    const stopBtn = `<button onclick="controlAction('${stopAction}')" class="text-[10px] px-2 py-1 bg-red-700/40 hover:bg-red-600 text-red-200 rounded font-semibold transition">⏹ Stop</button>`;
    const restartBtn = `<button onclick="controlAction('${restartAction}')" class="text-[10px] px-2 py-1 bg-white/5 hover:bg-white/15 text-gray-300 rounded font-semibold transition">⟳ Restart</button>`;
    const metricsBtn = (s.ports && (s.ports.metrics || s.ports.api)) ? `<button onclick="window.open('${s.ports.metrics || s.ports.api}','_blank')" class="text-[10px] px-2 py-1 bg-white/5 hover:bg-white/15 text-gray-300 rounded font-semibold transition">📊</button>` : '';
    const logBtn = s.log ? `<button onclick="switchTab('logs'); setTimeout(()=>{const sel=document.getElementById('log-service-select');if(sel)sel.value='${sid}';initLogPane();},100)" class="text-[10px] px-2 py-1 bg-white/5 hover:bg-white/15 text-gray-300 rounded font-semibold transition">📜</button>` : '';
    const actionRow = s.alive ? `${restartBtn}${stopBtn}${metricsBtn}${logBtn}` : `${startBtn}${metricsBtn}${logBtn}`;
    return `<div class="zion-panel-soft zion-panel-hover p-4 rounded-xl border ${lvlColors[s.level] || 'border-white/10'} ${s.alive ? 'svc-live' : ''} transition-all">
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
      <div class="text-[11px] text-gray-300 leading-relaxed mb-1 min-h-[2.5em]">${escapeHtml(desc)}</div>
      ${detail}
      <div class="flex flex-wrap gap-x-2 gap-y-0.5 mb-3 mt-2">${portsHtml || '<span class="text-[10px] text-gray-600">no ports</span>'}</div>
      <div class="flex gap-1.5 flex-wrap">${actionRow}</div>
    </div>`;
  }).join('');
}

async function loadDepGraph(){
  try {
    const data = await fetch('/api/dependency-graph').then(r=>r.json());
    const container = document.getElementById('svc-dep-graph');
    if(!container) return;
    if(data.graph){
      container.innerHTML = `<pre class="font-mono text-xs text-gray-400">${escapeHtml(data.graph)}</pre>`;
    } else if(data.nodes && data.edges){
      // Visual dependency graph
      const nodes = data.nodes || [];
      const edges = data.edges || [];
      const nodeMap = {};
      nodes.forEach(n => nodeMap[n.id] = n);
      const lvlColors = {
        L1: 'text-emerald-400 border-emerald-500/30',
        L2: 'text-blue-400 border-blue-500/30',
        L3: 'text-purple-400 border-purple-500/30',
        L4: 'text-pink-400 border-pink-500/30',
        L5: 'text-orange-400 border-orange-500/30',
        L6: 'text-cyan-400 border-cyan-500/30',
        Infra: 'text-zion-gold border-zion-gold/30',
      };
      // Build adjacency: parent -> children
      const children = {};
      edges.forEach(e => { (children[e.from] = children[e.from]||[]).push(e.to); });
      // Find roots (nodes with no incoming edges)
      const hasParent = new Set(edges.map(e => e.to));
      const roots = nodes.filter(n => !hasParent.has(n.id));
      function renderNode(id, depth=0){
        const n = nodeMap[id];
        if(!n) return '';
        const color = lvlColors[n.level] || 'text-gray-400 border-gray-600/30';
        const alive = n.alive ? '🟢' : '🔴';
        const kids = children[id] || [];
        const kidsHtml = kids.length > 0 ? `<div class="ml-4 pl-3 border-l border-white/10 mt-1">${kids.map(cid => renderNode(cid, depth+1)).join('')}</div>` : '';
        return `<div class="mb-1">
          <div class="flex items-center gap-2 py-1 px-2 rounded bg-black/20 border ${color.split(' ')[1]}" style="margin-left:${depth*16}px">
            <span class="text-[10px]">${alive}</span>
            <span class="text-xs font-mono ${color.split(' ')[0]}">${escapeHtml(n.id)}</span>
            <span class="text-[10px] text-gray-500">${escapeHtml(n.level)}</span>
          </div>
          ${kidsHtml}
        </div>`;
      }
      const html = roots.map(r => renderNode(r.id)).join('');
      container.innerHTML = html || '<div class="text-gray-500 text-xs">No dependency data available.</div>';
    } else {
      container.innerHTML = '<div class="text-gray-500 text-xs">Dependency graph not available from API.</div>';
    }
  } catch(e){
    const container = document.getElementById('svc-dep-graph');
    if(container) container.innerHTML = '<div class="text-red-400 text-xs">Failed to load dependency graph.</div>';
  }
}

// ─────────────────────────────────────────────────────────────────────
// Database
// ─────────────────────────────────────────────────────────────────────

async function loadDatabases(){
  const res = await fetch('/api/db').then(r => r.json()).catch(()=>({databases:[]}));
  const list = document.getElementById('db-list');
  list.innerHTML = res.databases.map(d => {
    const sizeStr = d.size > 1024 * 1024 ? (d.size / 1024 / 1024).toFixed(1) + ' MB' : d.size > 1024 ? (d.size / 1024).toFixed(1) + ' KB' : d.size + ' B';
    const kindBadge = d.kind === 'sqlite' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300';
    const dis = d.available ? '' : 'opacity-40';
    return `<button data-db="${escapeHtml(d.path)}" ${d.available ? '' : 'disabled'} class="db-btn ${dis} zion-panel-soft zion-panel-hover text-left p-4 rounded-xl border border-white/5">
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
  const svcRes = await fetch('/api/services').then(r => r.json()).catch(()=>({services:[]}));
  const c = document.getElementById('metrics-buttons');
  const scrapable = svcRes.services.filter(s => s.ports.metrics || s.ports.api);
  c.innerHTML = scrapable.map(s => `
    <button data-metrics="${s.id}" class="metrics-btn zion-button-secondary text-xs flex items-center gap-1.5">
      <span>${s.icon}</span><span>${escapeHtml(s.name)}</span>
      <span class="text-[10px] ${s.alive ? 'text-emerald-400' : 'text-gray-500'}">${s.alive ? '●' : '○'}</span>
    </button>`).join('');
  // Also load Rust collector snapshot
  loadMetricsCollector();
}

async function loadMetricsCollector(){
  const container = document.getElementById('metrics-collector');
  if(!container) return;
  try{
    const res = await fetch('/api/metrics/collector').then(r => r.json());
    if(res.error || res.ok === false){
      container.innerHTML = '<div class="text-amber-400 text-xs">Rust collector offline — ' + escapeHtml(res.error || 'unknown') + '</div>';
      return;
    }
    const ts = new Date(res.timestamp * 1000).toLocaleTimeString();
    const age = res._file_age_sec != null ? res._file_age_sec + 's ago' : 'unknown';
    const en = res.edge_node || {};
    const ln = res.local_node || {};
    const pool = res.pool || {};

    let html = '<div class="text-xs text-emerald-400 mb-2">✓ Rust collector snapshot (' + escapeHtml(age) + ') @ ' + escapeHtml(ts) + '</div>';
    html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-3">';

    // Edge Node
    html += '<div class="zion-panel p-3"><div class="text-[10px] text-gray-400 uppercase mb-1">Edge Node</div>';
    html += '<div class="text-lg font-bold">' + (en.chain_height != null ? fmtNum(en.chain_height) : '—') + '</div>';
    html += '<div class="text-[10px] text-gray-400">Height</div>';
    html += '<div class="text-xs mt-1">Peers: <span class="text-white">' + (en.known_peers ?? '—') + '</span> · Mempool: <span class="text-white">' + (en.mempool_size ?? '—') + '</span></div>';
    html += '<div class="text-[10px] text-gray-500">' + (en.network || '—') + ' · v' + (en.protocol_version ?? '—') + ' · ' + (en.consensus_profile || '—') + '</div>';
    html += '</div>';

    // Local Node
    html += '<div class="zion-panel p-3"><div class="text-[10px] text-gray-400 uppercase mb-1">Local Backup</div>';
    html += '<div class="text-lg font-bold">' + (ln.chain_height != null ? fmtNum(ln.chain_height) : '—') + '</div>';
    html += '<div class="text-[10px] text-gray-400">Height</div>';
    html += '<div class="text-xs mt-1">Peers: <span class="text-white">' + (ln.known_peers ?? '—') + '</span> · Mempool: <span class="text-white">' + (ln.mempool_size ?? '—') + '</span></div>';
    html += '</div>';

    // Pool
    html += '<div class="zion-panel p-3"><div class="text-[10px] text-gray-400 uppercase mb-1">Edge Pool</div>';
    html += '<div class="text-lg font-bold">' + (pool.active_miners != null ? pool.active_miners : '—') + '</div>';
    html += '<div class="text-[10px] text-gray-400">Active Miners</div>';
    html += '<div class="text-xs mt-1">Hashrate: <span class="text-white">' + (pool.hashrate_khs != null ? pool.hashrate_khs.toFixed(2) + ' KH/s' : '—') + '</span></div>';
    html += '<div class="text-xs">Blocks: <span class="text-white">' + (pool.blocks_found ?? '—') + '</span> · Hashes: <span class="text-white">' + (pool.total_hashes != null ? fmtNum(pool.total_hashes) : '—') + '</span></div>';
    html += '</div>';

    html += '</div>';

    // Tailscale
    html += '<div class="mt-2 flex items-center gap-2">';
    html += '<span class="text-[10px] px-2 py-0.5 rounded ' + (res.tailscale_ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300') + '">';
    html += res.tailscale_ok ? '● Tailscale VPN OK' : '○ Tailscale VPN Down';
    html += '</span></div>';

    container.innerHTML = html;
  }catch(e){
    container.innerHTML = '<div class="text-red-400 text-xs">Failed to load collector: ' + escapeHtml(e.message) + '</div>';
  }
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
  const res = await fetch('/api/genesis').then(r => r.json()).catch(()=>({constants:{},premine:[]}));
  const C = res.constants || {};

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
          <span class="hover:text-zion-gold cursor-pointer" data-copy="${escapeHtml(p.address)}">${escapeHtml(p.address)}</span>
          <button data-copy="${escapeHtml(p.address)}" class="copy-btn text-gray-500 hover:text-white text-[10px]">📋</button>
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
      <button data-copy="${escapeHtml(v)}" class="copy-btn text-xs text-gray-400 hover:text-white">📋</button>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────────────
// P0 Blockers
// ─────────────────────────────────────────────────────────────────────

async function loadBlockers(){
  const res = await fetch('/api/blockers').then(r => r.json()).catch(()=>({blockers:[],open:0,done:0,ready_for_launch:false}));
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

const REFRESH_INTERVAL_OK = 5000;   // 5s when connected
const REFRESH_INTERVAL_SLOW = 10000; // 10s when disconnected

function toggleAuto(){
  autoRefresh = !autoRefresh;
  const b = document.getElementById('autoBtn');
  if(autoRefresh){
    b.textContent = '⚡ Auto';
    if(refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(refreshAll, REFRESH_INTERVAL_OK);
  } else {
    b.textContent = '⏸ Paused';
    if(refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
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
      bkEl.textContent = res.backup_exists ? '✓ Exists' : '✗ Missing';
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
        detEl.innerHTML = `<div class="text-emerald-400 mb-1">✓ Backup found</div>
          <div class="font-mono text-xs text-gray-400 break-all">${escapeHtml(res.backup_dir)}</div>`;
      } else {
        detEl.innerHTML = `<div class="text-amber-400 mb-1">⚠ No backup</div>
          <div class="text-gray-400">Click "Backup All" before launch day.</div>`;
      }
    }

    addLaunchDayLog('📊 Status: ' + (res.is_launch_day ? 'LAUNCH DAY!' : res.backup_exists ? 'Backup OK' : 'Backup missing'));
  } catch(e){
    addLaunchDayLog('❌ Load error: ' + e.message);
  }
}

async function launchDayAction(action){
  addLaunchDayLog('⏳ Starting: ' + action + '...');
  try{
    const res = await fetch('/api/launch-day-prepare?action=' + action).then(r=>r.json());
    if(action === 'backup' && res.success){
      addLaunchDayLog('✅ Backup created: ' + (res.backup_dir || ''));
      if(res.manifest) addLaunchDayLog('📁 Files: ' + res.manifest.files_backed_up);
      if(res.backup_log) res.backup_log.forEach(l => addLaunchDayLog(l));
      const detEl = document.getElementById('backup-details');
      if(detEl && res.backup_dir) detEl.innerHTML = `
        <div class="text-emerald-400 mb-2">✅ Backup saved to local PC</div>
        <div class="font-mono text-xs text-gray-400 break-all mb-3">${escapeHtml(res.backup_dir)}</div>
        ${res.backup_log ? res.backup_log.map(l=>`<div class="text-xs ${l.startsWith('✓')?'text-emerald-400':'text-amber-400'}">${escapeHtml(l)}</div>`).join('') : ''}`;
      loadLaunchDayStatus();
    } else if(action === 'status'){
      loadLaunchDayStatus();
    } else if(res.error){
      addLaunchDayLog('❌ Error: ' + res.error);
    }
  } catch(e){
    addLaunchDayLog('❌ Error: ' + e.message);
  }
}

function confirmLaunchDay(){
  if(confirm('⚠️ CRITICAL OPERATION\n\nGenesis and premine address rotation for mainnet launch.\n\nMake sure:\n• All nodes are stopped\n• Backup is created\n• You have private keys secured\n\nContinue?')){
    launchDayAction('rotate-genesis&confirmed=true');
  } else {
    addLaunchDayLog('🚫 Rotation cancelled by user');
  }
}

async function launchDaySequence(){
  if(!confirm('🚀 START LAUNCH SEQUENCE?\n\n1. Backup everything\n2. Stop network\n3. Rotate genesis\n4. Restart network\n5. Verification\n\nIRREVERSIBLE OPERATION. Continue?')) return;

  addLaunchDayLog('🚀 ══════ START LAUNCH SEQUENCE ══════');
  for(const step of ['prepare','stop-network','rotate-genesis','restart-network','verify']){
    addLaunchDayLog('⏳ Step: ' + step);
    try{
      const res = await fetch('/api/launch-day-execute?step=' + step).then(r=>r.json());
      if(res.success){
        addLaunchDayLog('✅ ' + step + ' completed');
        if(res.backup_dir) addLaunchDayLog('💾 Backup: ' + res.backup_dir);
        if(res.complete){ addLaunchDayLog('🎉 ══════ LAUNCH SEQUENCE COMPLETED! ══════'); alert('🎉 Mainnet launch sequence completed!'); }
      } else {
        addLaunchDayLog('❌ ' + step + ' failed: ' + (res.error || 'unknown error'));
        break;
      }
    } catch(e){
      addLaunchDayLog('❌ Error: ' + e.message);
      break;
    }
  }
}

function addLaunchDayLog(msg){
  const el = document.getElementById('launch-day-log');
  if(!el) return;
  const time = new Date().toLocaleTimeString('en-US');
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
      if(hiranDetail) hiranDetail.textContent = 'Start: ▶ Start';
      if(gpuDetail) gpuDetail.textContent = '—';
      if(gpuBadge){ gpuBadge.textContent = '—'; gpuBadge.className = 'px-2 py-0.5 rounded text-xs font-bold bg-gray-700 text-white'; }
    }
  }catch(e){
    if(hiranBadge){ hiranBadge.textContent = 'OFFLINE'; hiranBadge.className = 'px-2 py-0.5 rounded text-xs font-bold bg-red-700 text-white'; }
    if(hiranDetail) hiranDetail.textContent = 'Start: ▶ Start';
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
  if(!list) return;
  try {
    const data = await fetch('/api/hiran/agents', { signal: AbortSignal.timeout(4000) }).then(r=>r.json());
    const agents = data.agents || [];
    if(!agents.length){
      list.innerHTML = `<div class="text-gray-500 italic text-xs p-3">${data.offline ? 'Hiranyagarbha offline — start it first' : 'No agents registered'}</div>`;
      return;
    }
    list.innerHTML = agents.map(a => `
      <div class="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2">
        <div>
          <div class="text-sm font-semibold text-gray-200">${escapeHtml(a.name||a.id||'Agent')}</div>
          <div class="text-[10px] text-gray-500">${escapeHtml(a.type||'')} · ${escapeHtml(a.status||'idle')}</div>
        </div>
        <span class="text-[10px] px-2 py-0.5 rounded-full ${a.status==='active'?'bg-emerald-700/50 text-emerald-300':'bg-gray-700 text-gray-400'}">${escapeHtml(a.status||'idle')}</span>
      </div>`).join('');
  } catch(e){
    if(list) list.innerHTML = `<div class="text-red-400 text-xs p-3">Error: ${escapeHtml(e.message)}</div>`;
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
  spinDiv.innerHTML = '<div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold shrink-0">AI</div><div class="bg-black/30 rounded-xl p-3 text-sm text-gray-400 animate-pulse">Hiran is thinking…</div>';
  log.appendChild(spinDiv);
  log.scrollTop = log.scrollHeight;
  if(status) status.textContent = 'Sending…';
  try{
    const t0 = Date.now();
    const r = await fetch('/api/hiran/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});
    const d = await r.json();
    log.removeChild(spinDiv);
    const aiDiv = document.createElement('div');
    aiDiv.className = 'flex gap-2';
    const text = d.ok ? d.reply : 'Error: ' + (d.error || 'unknown error');
    aiDiv.innerHTML = '<div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold shrink-0">AI</div><div class="bg-black/30 rounded-xl p-3 text-sm text-gray-200 whitespace-pre-wrap">' + escapeHtml(text) + '</div>';
    log.appendChild(aiDiv);
    log.scrollTop = log.scrollHeight;
    const elapsed = d.latency_ms != null ? d.latency_ms : Date.now()-t0;
    if(status) status.textContent = 'Response in ' + Math.round(elapsed) + ' ms · tokens: ' + (d.tokens || '—');
  }catch(e){
    log.removeChild(spinDiv);
    const errDiv = document.createElement('div');
    errDiv.className = 'flex gap-2';
    errDiv.innerHTML = '<div class="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold shrink-0">!</div><div class="bg-black/30 rounded-xl p-3 text-sm text-red-400">Error: ' + escapeHtml(String(e)) + '</div>';
    log.appendChild(errDiv);
    if(status) status.textContent = 'Connection error';
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
  // topology
  const topoSel = document.getElementById('settings-topology');
  if(topoSel && s.topology){ topoSel.value = s.topology; }
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
  loadTopologyConfig();
}

async function loadTopologyConfig(){
  try{
    const r = await fetch('/api/config');
    const d = await r.json();
    const topoSel = document.getElementById('settings-topology');
    if(topoSel && d.topology){ topoSel.value = d.topology; }
  }catch(e){
    console.warn('Failed to load topology config', e);
  }
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
  const topo = document.getElementById('settings-topology');
  if(topo) payload.topology = topo.value;
  try{
    // Save regular settings
    const r = await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const d = await r.json();
    applySettings(d.settings || d);
    
    // Handle topology switch separately
    if(topo && payload.topology){
      try{
        const cr = await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topology: payload.topology})});
        const cd = await cr.json();
        if(cd.ok){
          alert('Topology changed to '+payload.topology+'. Dashboard restart required. Please refresh the page.');
        }else{
          console.warn('Topology switch failed', cd);
        }
      }catch(e){
        console.warn('Topology switch error', e);
      }
    }
    
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
              '<button data-kill-pid="' + (p.pid || 0) + '" class="kill-btn text-[10px] px-2 py-1 bg-red-700/50 hover:bg-red-600 rounded text-white">Kill</button>' +
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
// NCL — Neural Compute Layer UI Engine
// ─────────────────────────────────────────────────────────────────────

let _nclAutoTimer = null;
let _nclJobsChart = null;
let _nclPerfChart = null;
let _nclJobHistory = [];

function switchNclTab(tab) {
  document.querySelectorAll('.ncl-pane').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.ncl-tab-btn').forEach(b => b.classList.remove('active'));
  const pane = document.getElementById('ncl-pane-' + tab);
  const btn = document.getElementById('ncl-tab-' + tab);
  if (pane) pane.classList.remove('hidden');
  if (btn) btn.classList.add('active');
  if (tab === 'jobs') loadNclJobHistory();
  if (tab === 'analytics') initNclCharts();
}

function toggleNclAutoRefresh() {
  const cb = document.getElementById('ncl-auto-refresh');
  if (cb && cb.checked) {
    if (!_nclAutoTimer) _nclAutoTimer = setInterval(loadNclFull, 10000);
  } else {
    clearInterval(_nclAutoTimer);
    _nclAutoTimer = null;
  }
}

async function loadNclFull() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? '—'; };
  let online = false;

  // Status
  try {
    const r = await fetch('/api/ncl/status');
    const d = await r.json();
    online = !d.error;
    set('ncl-status-val', d.status || 'active');
    set('ncl-workers-val', d.total_workers ?? d.active_workers ?? '—');
    set('ncl-queue-val', d.queued_jobs ?? d.queued ?? '0');
    set('ncl-tflops-val', d.total_tflops ?? '—');
    set('ncl-jobs-total-val', d.completed_jobs ?? d.total_jobs ?? '—');
  } catch (_) { set('ncl-status-val', 'offline'); }

  // Live dot
  const dot = document.getElementById('ncl-live-dot');
  const lbl = document.getElementById('ncl-live-label');
  if (dot) dot.className = online ? 'ncl-dot-live' : 'ncl-dot-off';
  if (lbl) { lbl.textContent = online ? 'Live' : 'Offline'; lbl.className = 'text-xs ' + (online ? 'text-emerald-400' : 'text-red-400'); }
  set('ncl-refresh-ts', 'Updated ' + new Date().toLocaleTimeString());

  // Price
  try {
    const r2 = await fetch('/api/ncl/price');
    const d2 = await r2.json();
    set('ncl-price-val', d2.price_per_token != null ? d2.price_per_token + ' ZION' : '—');
    set('ncl-price-job', d2.price_per_job != null ? d2.price_per_job + ' ZION' : '—');
    set('ncl-price-token', d2.price_per_token != null ? d2.price_per_token + ' ZION' : '—');
    set('ncl-price-worker', d2.worker_share_flowers != null ? (d2.worker_share_flowers / 1e9).toFixed(1) + ' nZION' : '—');
    set('ncl-price-protocol', d2.protocol_fee_flowers != null ? (d2.protocol_fee_flowers / 1e9).toFixed(1) + ' nZION' : '—');
    if (d2.fee_split) set('ncl-fee-split-label', d2.fee_split);
    const estEl = document.getElementById('ncl-est-cost');
    if (estEl && d2.price_per_job != null) estEl.textContent = d2.price_per_job + ' ZION';
  } catch (_) {}

  // Workers (rich cards)
  try {
    const r3 = await fetch('/api/ncl/workers');
    const d3 = await r3.json();
    const wl = document.getElementById('ncl-worker-list');
    const badge = document.getElementById('ncl-worker-count-badge');
    const workers = d3.workers || d3;
    if (badge) badge.textContent = Array.isArray(workers) ? workers.length : 0;
    if (wl) {
      if (!Array.isArray(workers) || workers.length === 0) {
        wl.innerHTML = '<div class="p-8 text-center"><div class="text-3xl mb-2 opacity-30">&#x1F50D;</div><div class="text-gray-500 text-sm font-medium">No active workers</div><div class="text-gray-600 text-xs mt-1">Workers appear when they connect to the NCL</div></div>';
      } else {
        wl.innerHTML = workers.map((w, i) => {
          const id = w.worker_id || 'worker-' + i;
          const short = id.slice(0, 8);
          const score = w.score || 0;
          const jobs = w.jobs_completed || 0;
          const failed = w.jobs_failed || 0;
          const cl = w.consciousness_level || 0;
          const successRate = jobs > 0 ? Math.round(((jobs - failed) / jobs) * 100) : 0;
          const barW = Math.min(score, 100);
          const gradColors = score >= 80 ? '#10b981,#059669' : score >= 50 ? '#3b82f6,#2563eb' : '#6b7280,#4b5563';
          return `<div class="ncl-worker-row p-4 ncl-toggle" data-toggle-detail="1">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white" style="background:linear-gradient(135deg,${gradColors});">${short.slice(0, 2).toUpperCase()}</div>
                <div>
                  <div class="text-sm font-semibold text-gray-200">${short}...</div>
                  <div class="text-[11px] text-gray-500">CL ${cl} &middot; ${jobs} jobs</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-sm font-bold ${score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-blue-400' : 'text-gray-400'}">${score} pts</div>
                <div class="text-[11px] text-gray-500">${successRate}% success</div>
              </div>
            </div>
            <div class="ncl-score-bar mt-2.5"><div class="ncl-score-fill" style="width:${barW}%"></div></div>
            <div class="ncl-detail hidden mt-3 pt-3 grid grid-cols-3 gap-3 text-xs" style="border-top:1px solid rgba(255,255,255,0.05);">
              <div><span class="text-gray-500 block text-[10px] mb-0.5">Full ID</span><div class="text-gray-300 font-mono text-[10px] break-all">${id}</div></div>
              <div><span class="text-gray-500 block text-[10px] mb-0.5">Failed</span><div class="text-red-400 font-bold">${failed}</div></div>
              <div><span class="text-gray-500 block text-[10px] mb-0.5">Consciousness</span><div class="text-purple-400 font-bold">Level ${cl}</div></div>
            </div>
          </div>`;
        }).join('');
      }
    }
  } catch (_) {}

  // Leaderboard (rich)
  try {
    const r4 = await fetch('/api/ncl/leaderboard');
    const d4 = await r4.json();
    const lb = document.getElementById('ncl-leaderboard-dash');
    const entries = d4.leaderboard || d4;
    if (lb) {
      if (!Array.isArray(entries) || entries.length === 0) {
        lb.innerHTML = '<div class="p-8 text-center"><div class="text-3xl mb-2 opacity-30">&#x1F3C6;</div><div class="text-gray-500 text-sm font-medium">No leaderboard data yet</div></div>';
      } else {
        lb.innerHTML = entries.slice(0, 20).map((e, i) => {
          const rank = e.rank || i + 1;
          const medalClass = rank === 1 ? 'ncl-medal-gold' : rank === 2 ? 'ncl-medal-silver' : rank === 3 ? 'ncl-medal-bronze' : '';
          const medal = rank === 1 ? '&#x1F947;' : rank === 2 ? '&#x1F948;' : rank === 3 ? '&#x1F949;' : '';
          const addr = e.wallet_address || e.worker_id || '—';
          const shortAddr = addr.length > 20 ? addr.slice(0, 12) + '...' + addr.slice(-6) : addr;
          const avgMs = e.avg_completion_ms ? Math.round(e.avg_completion_ms) + 'ms' : '—';
          return `<div class="ncl-worker-row p-4 flex items-center gap-4">
            <div class="w-10 text-center shrink-0">
              ${medal ? '<span class="text-xl">' + medal + '</span>' : '<span class="text-sm font-bold text-gray-500">#' + rank + '</span>'}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-gray-200 truncate" title="${addr}">${shortAddr}</div>
              <div class="text-[11px] text-gray-500">${e.jobs_completed || 0} jobs &middot; avg ${avgMs}</div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-base font-bold ${medalClass || 'text-gray-300'}">${e.score || 0}</div>
              <div class="text-[10px] text-gray-500">points</div>
            </div>
          </div>`;
        }).join('');
      }
    }
  } catch (_) {}
}

// Alias
const loadNclStatus = loadNclFull;

async function loadNclJobHistory() {
  try {
    const r = await fetch('/api/ncl/jobs');
    const d = await r.json();
    _nclJobHistory = d.jobs || d || [];
    renderNclJobHistory();
  } catch (_) {
    const el = document.getElementById('ncl-job-history-list');
    if (el) el.innerHTML = '<div class="p-6 text-center text-red-400 text-sm">Failed to load jobs</div>';
  }
}

function renderNclJobHistory() {
  const filter = document.getElementById('ncl-job-filter')?.value || 'all';
  const list = filter === 'all' ? _nclJobHistory : _nclJobHistory.filter(j => (j.status || '').toLowerCase() === filter.toLowerCase());
  const el = document.getElementById('ncl-job-history-list');
  const countEl = document.getElementById('ncl-job-count');
  const rateEl = document.getElementById('ncl-job-success-rate');

  if (countEl) countEl.textContent = _nclJobHistory.length + ' jobs total';
  const completed = _nclJobHistory.filter(j => j.status === 'Completed').length;
  const total = _nclJobHistory.length;
  if (rateEl) rateEl.textContent = total > 0 ? Math.round((completed / total) * 100) + '% success rate' : '—';

  if (!el) return;
  if (!Array.isArray(list) || list.length === 0) {
    el.innerHTML = '<div class="p-8 text-center"><div class="text-3xl mb-2 opacity-30">&#x1F4ED;</div><div class="text-gray-500 text-sm font-medium">No jobs found</div></div>';
    return;
  }
  el.innerHTML = list.slice(0, 50).map(j => {
    const st = (j.status || 'unknown').toLowerCase();
    const stClass = 'ncl-st-' + st;
    const id = (j.job_id || j.id || '—').slice(0, 8);
    const type = j.job_type || '—';
    const backend = j.backend || '—';
    const ts = j.created_at ? new Date(j.created_at).toLocaleString() : '—';
    return `<div class="ncl-worker-row p-3.5 flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-mono text-gray-300">${id}...</span>
          <span class="ncl-status-pill ${stClass}">&#x25CF; ${j.status || 'Unknown'}</span>
        </div>
        <div class="text-[11px] text-gray-500 mt-0.5">${type} &middot; ${backend} &middot; ${ts}</div>
      </div>
      <div class="text-xs text-gray-500 shrink-0">${j.priority != null ? 'P' + j.priority : ''}</div>
    </div>`;
  }).join('');
}

async function submitNclJob() {
  const jt = document.getElementById('ncl-job-type-dash')?.value || 'inference';
  const backend = document.getElementById('ncl-job-backend')?.value || 'Custom';
  const model = document.getElementById('ncl-job-model')?.value || 'hiran-v2.2';
  const priority = parseInt(document.getElementById('ncl-job-priority')?.value || '5', 10);
  const prompt = document.getElementById('ncl-job-prompt')?.value || 'Dashboard test job';
  const reward = parseInt(document.getElementById('ncl-job-reward')?.value || '20000000000', 10);
  const duration = parseInt(document.getElementById('ncl-job-duration')?.value || '60', 10);
  const submitter = document.getElementById('ncl-job-submitter')?.value || 'dashboard';
  const res = document.getElementById('ncl-job-result-dash');
  const btn = document.getElementById('ncl-submit-btn');

  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; btn.textContent = 'Submitting...'; }
  if (res) res.innerHTML = '<span class="text-purple-400">Submitting...</span>';

  try {
    const payload = { job_type: jt, model_id: model, backend, params: { prompt }, priority, submitter, input_hash: Date.now().toString(16), reward_flowers: reward, max_duration_secs: duration };
    const r = await fetch('/api/ncl/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (d.error) { if (res) res.innerHTML = '<span class="text-red-400">Error: ' + d.error + '</span>'; }
    else {
      if (res) res.innerHTML = '<span class="text-emerald-400">&#x2705; Job queued: ' + (d.job_id || d.id || 'OK') + '</span>';
      setTimeout(() => { loadNclFull(); loadNclJobHistory(); }, 1000);
    }
  } catch (e) { if (res) res.innerHTML = '<span class="text-red-400">Error: ' + String(e) + '</span>'; }
  finally { if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'Submit Job'; } }
}

function initNclCharts() {
  const jCtx = document.getElementById('ncl-jobs-chart');
  if (jCtx && !_nclJobsChart) {
    const labels = []; const queued = []; const completed = []; const failed = [];
    for (let i = 11; i >= 0; i--) { const d = new Date(); d.setHours(d.getHours() - i); labels.push(d.getHours() + ':00'); queued.push(Math.floor(Math.random() * 5)); completed.push(Math.floor(Math.random() * 8)); failed.push(Math.floor(Math.random() * 2)); }
    _nclJobsChart = new Chart(jCtx, { type: 'bar', data: { labels, datasets: [
      { label: 'Completed', data: completed, backgroundColor: 'rgba(16,185,129,0.6)', borderRadius: 4 },
      { label: 'Queued', data: queued, backgroundColor: 'rgba(251,191,36,0.6)', borderRadius: 4 },
      { label: 'Failed', data: failed, backgroundColor: 'rgba(239,68,68,0.4)', borderRadius: 4 }
    ] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 10 } } } }, scales: { x: { ticks: { color: '#4b5563', font: { size: 9 } }, grid: { display: false } }, y: { ticks: { color: '#4b5563', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } } } } });
  }
  const pCtx = document.getElementById('ncl-perf-chart');
  if (pCtx && !_nclPerfChart) {
    _nclPerfChart = new Chart(pCtx, { type: 'radar', data: { labels: ['Score', 'Jobs', 'Speed', 'Uptime', 'Reliability'], datasets: [
      { label: 'Network Avg', data: [70, 60, 75, 80, 85], borderColor: 'rgba(147,51,234,0.5)', backgroundColor: 'rgba(147,51,234,0.08)', pointBackgroundColor: '#9333ea' },
      { label: 'Top Worker', data: [95, 90, 88, 96, 92], borderColor: 'rgba(6,182,212,0.7)', backgroundColor: 'rgba(6,182,212,0.08)', pointBackgroundColor: '#06b6d4' }
    ] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 10 } } } }, scales: { r: { ticks: { color: '#4b5563', backdropColor: 'transparent', font: { size: 8 } }, grid: { color: 'rgba(255,255,255,0.04)' }, pointLabels: { color: '#9ca3af', font: { size: 9 } } } } } });
  }
}

// NCL hook merged into switchTab directly

// ─────────────────────────────────────────────────────────────────────
// Overview Built-in Charts (Grafana Fallback)
// ─────────────────────────────────────────────────────────────────────

const _ovCharts = {};
const _ovHistory = { heights: [], shares_ok: [], shares_rej: [], sessions: [], cpu: [], mem: [], labels: [] };
const OV_MAX_POINTS = 30;

function pushOvData(label, data){
  _ovHistory.labels.push(label);
  _ovHistory.heights.push(data.height || 0);
  _ovHistory.shares_ok.push(data.shares_ok || 0);
  _ovHistory.shares_rej.push(data.shares_rej || 0);
  _ovHistory.sessions.push(data.sessions || 0);
  _ovHistory.cpu.push(data.cpu || 0);
  _ovHistory.mem.push(data.mem || 0);
  if(_ovHistory.labels.length > OV_MAX_POINTS){
    Object.keys(_ovHistory).forEach(k => _ovHistory[k].shift());
  }
}

function updateOverviewCharts(){
  const chartOpts = { responsive: true, maintainAspectRatio: false, animation: { duration: 300 }, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { ticks: { color: '#4b5563', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.03)' } } } };
  // Height chart
  const hCtx = document.getElementById('chart-overview-height');
  if(hCtx && typeof Chart !== 'undefined'){
    if(!_ovCharts.height){
      _ovCharts.height = new Chart(hCtx, { type: 'line', data: { labels: _ovHistory.labels, datasets: [{ label: 'Height', data: _ovHistory.heights, borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.08)', tension: 0.3, borderWidth: 2, pointRadius: 0 }] }, options: chartOpts });
    } else { _ovCharts.height.data.labels = _ovHistory.labels; _ovCharts.height.data.datasets[0].data = _ovHistory.heights; _ovCharts.height.update('none'); }
  }
  // Shares chart
  const sCtx = document.getElementById('chart-overview-shares');
  if(sCtx && typeof Chart !== 'undefined'){
    if(!_ovCharts.shares){
      _ovCharts.shares = new Chart(sCtx, { type: 'bar', data: { labels: _ovHistory.labels, datasets: [{ label: 'OK', data: _ovHistory.shares_ok, backgroundColor: 'rgba(16,185,129,0.6)', borderRadius: 2 },{ label: 'Rej', data: _ovHistory.shares_rej, backgroundColor: 'rgba(239,68,68,0.5)', borderRadius: 2 }] }, options: { ...chartOpts, plugins: { legend: { display: true, position: 'bottom', labels: { color: '#9ca3af', font: { size: 9 } } } } } });
    } else { _ovCharts.shares.data.labels = _ovHistory.labels; _ovCharts.shares.data.datasets[0].data = _ovHistory.shares_ok; _ovCharts.shares.data.datasets[1].data = _ovHistory.shares_rej; _ovCharts.shares.update('none'); }
  }
  // Sessions chart
  const ssCtx = document.getElementById('chart-overview-sessions');
  if(ssCtx && typeof Chart !== 'undefined'){
    if(!_ovCharts.sessions){
      _ovCharts.sessions = new Chart(ssCtx, { type: 'line', data: { labels: _ovHistory.labels, datasets: [{ label: 'Sessions', data: _ovHistory.sessions, borderColor: '#06B6D4', backgroundColor: 'rgba(6,182,212,0.1)', tension: 0.3, borderWidth: 2, pointRadius: 0, fill: true }] }, options: chartOpts });
    } else { _ovCharts.sessions.data.labels = _ovHistory.labels; _ovCharts.sessions.data.datasets[0].data = _ovHistory.sessions; _ovCharts.sessions.update('none'); }
  }
  // Resources chart
  const rCtx = document.getElementById('chart-overview-resources');
  if(rCtx && typeof Chart !== 'undefined'){
    if(!_ovCharts.resources){
      _ovCharts.resources = new Chart(rCtx, { type: 'line', data: { labels: _ovHistory.labels, datasets: [{ label: 'CPU%', data: _ovHistory.cpu, borderColor: '#9333EA', backgroundColor: 'rgba(147,51,234,0.08)', tension: 0.3, borderWidth: 2, pointRadius: 0 },{ label: 'MEM%', data: _ovHistory.mem, borderColor: '#06B6D4', backgroundColor: 'rgba(6,182,212,0.05)', tension: 0.3, borderWidth: 2, pointRadius: 0 }] }, options: { ...chartOpts, plugins: { legend: { display: true, position: 'bottom', labels: { color: '#9ca3af', font: { size: 9 } } } } } });
    } else { _ovCharts.resources.data.labels = _ovHistory.labels; _ovCharts.resources.data.datasets[0].data = _ovHistory.cpu; _ovCharts.resources.data.datasets[1].data = _ovHistory.mem; _ovCharts.resources.update('none'); }
  }
}

// Feed overview charts from refreshAll data
function feedOverviewCharts(statusData){
  const now = new Date().toLocaleTimeString().slice(0,5);
  const n1 = statusData.node1 || {};
  const pool = statusData.pool || {};
  const miner = statusData.miner || {};
  pushOvData(now, {
    height: n1.chain_height || 0,
    shares_ok: miner.shares_accepted ?? miner.shares_ok ?? pool.shares_accepted ?? 0,
    shares_rej: miner.shares_rejected ?? pool.shares_rejected ?? 0,
    sessions: pool.active_sessions || 0,
    cpu: statusData.system_cpu || 0,
    mem: statusData.system_mem || 0
  });
  updateOverviewCharts();
}

// ─────────────────────────────────────────────────────────────────────
// NCL + Hiran Overview Widgets (for Overview tab)
// ─────────────────────────────────────────────────────────────────────

async function loadNclOverview(){
  try {
    const data = await fetch('/api/ncl/status').then(r => r.json());
    const badge = document.getElementById('ncl-overview-badge');
    if(badge){
      if(data.ok || data.status === 'ok'){
        badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-700/50 text-emerald-300';
        badge.textContent = 'Online';
      } else {
        badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400';
        badge.textContent = 'Offline';
      }
    }
    const el = id => document.getElementById(id);
    if(el('ncl-ov-workers')) el('ncl-ov-workers').textContent = data.workers ?? data.total_workers ?? '—';
    if(el('ncl-ov-jobs')) el('ncl-ov-jobs').textContent = data.jobs ?? data.active_jobs ?? '—';
    if(el('ncl-ov-tflops')) el('ncl-ov-tflops').textContent = data.tflops ?? data.compute_tflops ?? '—';
  } catch(e) {
    const badge = document.getElementById('ncl-overview-badge');
    if(badge){ badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400'; badge.textContent = 'Offline'; }
  }
}

async function loadHiranOverview(){
  try {
    const data = await fetch('/api/hiran/status').then(r => r.json());
    const badge = document.getElementById('hiran-overview-badge');
    if(badge){
      if(data.ok || data.status === 'ok'){
        badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-700/50 text-emerald-300';
        badge.textContent = 'Online';
      } else {
        badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400';
        badge.textContent = 'Offline';
      }
    }
    const el = id => document.getElementById(id);
    if(el('hiran-ov-model')) el('hiran-ov-model').textContent = data.model || data.model_id || '—';
    if(el('hiran-ov-uptime')) el('hiran-ov-uptime').textContent = data.uptime || '—';
    if(el('hiran-ov-backend')) el('hiran-ov-backend').textContent = data.backend || data.engine || '—';
  } catch(e) {
    const badge = document.getElementById('hiran-overview-badge');
    if(badge){ badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400'; badge.textContent = 'Offline'; }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Service Terminal
// ─────────────────────────────────────────────────────────────────────

// Compatibility stubs — full terminal is now in Logs pane
async function loadTerminalLog(){ await overviewLogSwitch(document.getElementById('overview-log-svc')?.value || 'node1'); }
function clearTerminal(){ const o = document.getElementById('overview-log-output'); if(o) o.textContent = ''; }

// Overview quick log preview (last 40 lines, no SSE — just static tail)
async function overviewLogSwitch(svcId){
  const out = document.getElementById('overview-log-output');
  if(!out) return;
  out.textContent = 'Loading ' + svcId + '…';
  try {
    const data = await fetch('/api/service-log?id=' + encodeURIComponent(svcId) + '&lines=40').then(r => r.json());
    if(data.lines){
      out.textContent = typeof data.lines === 'string' ? data.lines : data.lines;
      out.scrollTop = out.scrollHeight;
    } else {
      out.textContent = data.error || 'Log file not found';
    }
  } catch(e) { out.textContent = 'Error: ' + e.message; }
}

// ─────────────────────────────────────────────────────────────────────
// DAO Governance Tab
// ─────────────────────────────────────────────────────────────────────

const DAO_API = 'http://127.0.0.1:8081';
const DAO_PAGE_SIZE = 10;
let _daoPage = 0;
let _daoTotalProposals = 0;

// DAO hook merged into switchTab directly

async function loadDaoAll() {
  await Promise.allSettled([loadDaoStats(), loadDaoProposals(), loadDaoTreasury(), loadDaoCoAdmins(), checkDaoDaemon()]);
}

async function checkDaoDaemon() {
  const badge = document.getElementById('dao-status-badge');
  const daemonBadge = document.getElementById('dao-daemon-badge');
  try {
    const r = await fetch('/api/dao/health', { signal: AbortSignal.timeout(3000) }).then(r => r.json());
    const ok = r.success && r.data && r.data.status === 'ok';
    const cls = ok ? 'text-xs px-3 py-1 rounded-full bg-emerald-700/50 text-emerald-300' : 'text-xs px-3 py-1 rounded-full bg-red-700/50 text-red-300';
    const txt = ok ? '🟢 DAO Online' : '🔴 DAO Offline';
    if(badge) { badge.className = cls; badge.textContent = txt; }
    if(daemonBadge) { daemonBadge.className = cls.replace('px-3','px-2').replace('py-1','py-0.5'); daemonBadge.textContent = ok ? 'Online' : 'Offline'; }
  } catch(e) {
    if(badge) { badge.className = 'text-xs px-3 py-1 rounded-full bg-gray-700 text-gray-400'; badge.textContent = '⚫ DAO Offline'; }
    if(daemonBadge) { daemonBadge.className = 'text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400'; daemonBadge.textContent = 'Offline'; }
  }
}

async function loadDaoStats() {
  try {
    const r = await fetch('/api/dao/stats', { signal: AbortSignal.timeout(4000) }).then(r => r.json());
    const d = r.data || r;
    const el = id => document.getElementById(id);
    if(el('dao-stat-total')) el('dao-stat-total').textContent = d.total_proposals ?? '0';
    if(el('dao-stat-active')) el('dao-stat-active').textContent = d.active ?? '0';
    if(el('dao-stat-passed')) el('dao-stat-passed').textContent = d.passed ?? '0';
    if(el('dao-stat-executed')) el('dao-stat-executed').textContent = d.executed ?? '0';
    if(el('dao-stat-treasury')) el('dao-stat-treasury').textContent = d.treasury_total_zion ? (Number(d.treasury_total_zion) / 1e9).toFixed(1) + ' B' : '4 B';
    if(el('dao-stat-quorum')) el('dao-stat-quorum').textContent = (d.quorum_percent ?? 10) + '%';
    if(el('dao-stat-multisig')) el('dao-stat-multisig').textContent = d.multisig ?? '5-of-7';
  } catch(e) { /* DAO offline */ }
}

async function loadDaoProposals() {
  const list = document.getElementById('dao-proposals-list');
  const statusFilter = document.getElementById('dao-filter-status')?.value || '';
  if(!list) return;
  list.innerHTML = '<div class="text-gray-500 text-sm text-center py-6">Loading…</div>';
  try {
    const offset = _daoPage * DAO_PAGE_SIZE;
    let url = `/api/dao/proposals?limit=${DAO_PAGE_SIZE}&offset=${offset}`;
    if(statusFilter) url += `&status=${statusFilter}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) }).then(r => r.json());
    const d = r.data || r;
    const proposals = d.proposals || [];
    _daoTotalProposals = d.total || proposals.length;

    if(!proposals.length) {
      list.innerHTML = '<div class="text-gray-500 text-sm text-center py-8">No proposals found.</div>';
    } else {
      list.innerHTML = proposals.map(p => renderDaoProposalCard(p)).join('');
    }

    const countEl = document.getElementById('dao-proposals-count');
    if(countEl) countEl.textContent = `${proposals.length} of ${_daoTotalProposals} proposals`;
    const pageEl = document.getElementById('dao-page-label');
    if(pageEl) pageEl.textContent = `Page ${_daoPage + 1} of ${Math.max(1, Math.ceil(_daoTotalProposals / DAO_PAGE_SIZE))}`;
    const prevBtn = document.getElementById('dao-prev-btn');
    const nextBtn = document.getElementById('dao-next-btn');
    if(prevBtn) prevBtn.disabled = _daoPage === 0;
    if(nextBtn) nextBtn.disabled = offset + DAO_PAGE_SIZE >= _daoTotalProposals;
  } catch(e) {
    list.innerHTML = '<div class="text-red-400 text-sm text-center py-6">DAO daemon offline — start it to load proposals.</div>';
  }
}

function renderDaoProposalCard(p) {
  const statusColor = {
    'Active': 'bg-emerald-700/40 text-emerald-300',
    'Passed': 'bg-blue-700/40 text-blue-300',
    'Rejected': 'bg-red-700/40 text-red-300',
    'Executed': 'bg-yellow-700/40 text-yellow-300',
    'Pending': 'bg-gray-700/40 text-gray-300',
    'Timelocked': 'bg-purple-700/40 text-purple-300',
  }[p.status] || 'bg-gray-700/40 text-gray-300';

  const typeIcon = {
    'TreasurySpend': '💰',
    'ParameterChange': '⚙️',
    'HumanitarianGrant': '🕊️',
    'BridgeUpgrade': '🌉',
    'EmergencyPause': '🚨',
    'GeneralVote': '🗳️',
  }[p.proposal_type] || '📋';

  // Vote bar (yes/no/abstain)
  const yes = p.votes_yes || 0, no = p.votes_no || 0, abs = p.votes_abstain || 0;
  const total = yes + no + abs;
  const yesPct = total ? Math.round(yes / total * 100) : 0;
  const noPct  = total ? Math.round(no  / total * 100) : 0;

  const votingEnds = p.voting_ends_at ? new Date(p.voting_ends_at).toLocaleDateString() : '—';

  return `<div class="bg-black/30 rounded-xl p-4 border border-white/5 hover:border-white/10 transition">
    <div class="flex items-start justify-between gap-3 mb-2">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-base shrink-0">${typeIcon}</span>
        <div class="min-w-0">
          <div class="font-semibold text-sm text-white truncate">#${p.id} — ${escapeHtml(p.title || '(no title)')}</div>
          <div class="text-[10px] text-gray-500 mt-0.5">by <span class="font-mono text-gray-400">${(p.proposer || '').substring(0,20)}…</span> · votes end ${votingEnds}</div>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColor}">${p.status}</span>
        ${p.status === 'Active' ? `<button data-dao-id="${p.id}" data-dao-title="${escapeHtml(p.title || '')}" class="daovote-btn text-[10px] px-2 py-0.5 bg-purple-700/50 hover:bg-purple-600 rounded-full font-semibold transition">Vote</button>` : ''}
      </div>
    </div>
    ${p.description ? `<div class="text-[11px] text-gray-400 line-clamp-2 mb-2">${escapeHtml(p.description)}</div>` : ''}
    ${total > 0 ? `<div class="mt-2">
      <div class="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-white/5 mb-1">
        <div class="bg-emerald-500 rounded-l-full" style="width:${yesPct}%"></div>
        <div class="bg-red-500" style="width:${noPct}%"></div>
        <div class="bg-gray-600 rounded-r-full flex-1"></div>
      </div>
      <div class="flex gap-3 text-[10px]">
        <span class="text-emerald-400">✓ ${yesPct}% Yes</span>
        <span class="text-red-400">✗ ${noPct}% No</span>
        <span class="text-gray-500 ml-auto">Total weight: ${total.toLocaleString()}</span>
      </div>
    </div>` : '<div class="text-[10px] text-gray-600 mt-1">No votes yet</div>'}
  </div>`;
}

function daoPrevPage() { if(_daoPage > 0){ _daoPage--; loadDaoProposals(); } }
function daoNextPage() { if((_daoPage+1)*DAO_PAGE_SIZE < _daoTotalProposals){ _daoPage++; loadDaoProposals(); } }

async function loadDaoTreasury() {
  try {
    const r = await fetch('/api/dao/treasury', { signal: AbortSignal.timeout(4000) }).then(r => r.json());
    const d = r.data || r;
    const el = id => document.getElementById(id);
    if(el('dao-treas-available')) el('dao-treas-available').textContent = d.available_zion ? Number(d.available_zion).toLocaleString() : '—';
    if(el('dao-treas-total')) el('dao-treas-total').textContent = d.total_zion ? Number(d.total_zion).toLocaleString() : '4,000,000,000';
    if(el('dao-treas-multisig')) el('dao-treas-multisig').textContent = d.multisig ?? '5-of-7';
    if(el('dao-treas-pending')) el('dao-treas-pending').textContent = d.pending_operations ?? '0';
  } catch(e) { /* DAO offline */ }
}

async function loadDaoCoAdmins() {
  const tbody = document.getElementById('dao-coadmins-tbody');
  if(!tbody) return;
  const layer = document.getElementById('dao-coadmin-layer')?.value || '';
  try {
    const url = layer ? `/api/dao/co-admins/${layer}` : '/api/dao/co-admins';
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) }).then(r => r.json());
    const d = r.data || r;
    const admins = d.co_admins || [];
    if(!admins.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-gray-500 text-center py-4">No co-admins configured yet.</td></tr>';
      return;
    }
    const roleColor = { Validator:'text-blue-400', CoreDev:'text-purple-400', Treasury:'text-yellow-400', Bridge:'text-cyan-400', Security:'text-red-400', Steward:'text-pink-400' };
    tbody.innerHTML = admins.map(a => {
      const rc = roleColor[a.role] || 'text-gray-300';
      const bonded = a.bonded ? (a.bonded / 1e12).toFixed(0) + ' ZION' : '—';
      return `<tr class="border-b border-white/5 hover:bg-white/2 transition">
        <td class="py-2 pr-3 font-semibold text-white">${escapeHtml(a.name || '—')}</td>
        <td class="py-2 pr-3 text-gray-300">L${a.layer}</td>
        <td class="py-2 pr-3 ${rc} font-mono">${a.role || '—'}</td>
        <td class="py-2 pr-3 font-mono text-gray-400 text-[9px]">${(a.address||'').substring(0,18)}…</td>
        <td class="py-2 pr-3 text-white">${bonded}</td>
        <td class="py-2 pr-3 text-cyan-400">${a.reputation ?? '—'}</td>
        <td class="py-2">${a.is_active ? '<span class="text-emerald-400">● Active</span>' : '<span class="text-gray-500">○ Inactive</span>'}</td>
      </tr>`;
    }).join('');
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-gray-500 text-center py-4">DAO daemon offline.</td></tr>';
  }
}

// ── Create Proposal Modal ────────────────────────────────────────────

function openCreateProposalModal() {
  const modal = document.getElementById('dao-proposal-modal');
  if(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeCreateProposalModal() {
  const modal = document.getElementById('dao-proposal-modal');
  if(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
  const st = document.getElementById('dao-modal-status');
  if(st) st.classList.add('hidden');
}

async function submitCreateProposal() {
  const title    = document.getElementById('dao-new-title')?.value?.trim();
  const desc     = document.getElementById('dao-new-desc')?.value?.trim();
  const proposer = document.getElementById('dao-new-proposer')?.value?.trim();
  const ptype    = document.getElementById('dao-new-type')?.value;
  const apiKey   = document.getElementById('dao-new-apikey')?.value;
  const stEl     = document.getElementById('dao-modal-status');

  const setStatus = (msg, ok) => {
    if(!stEl) return;
    stEl.className = `text-xs rounded-lg p-2 ${ok ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`;
    stEl.textContent = msg;
    stEl.classList.remove('hidden');
  };

  if(!title || !desc || !proposer) return setStatus('Title, description and proposer address are required.', false);
  if(!proposer.startsWith('zion1')) return setStatus('Proposer must be a valid zion1… address.', false);
  if(!apiKey) return setStatus('DAO API Key is required for write operations.', false);

  const body = {
    title, description: desc, proposer,
    proposal_type: { [ptype]: {} }
  };

  try {
    const r = await fetch('/api/dao/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-DAO-Key': apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000)
    }).then(r => r.json());

    if(r.success && r.data?.id) {
      setStatus(`✓ Proposal #${r.data.id} created successfully! Voting ends: ${r.data.voting_ends_at?.split('T')[0]}`, true);
      setTimeout(() => { closeCreateProposalModal(); loadDaoAll(); }, 2000);
    } else {
      setStatus('Error: ' + (r.error || JSON.stringify(r)), false);
    }
  } catch(e) {
    setStatus('Failed to connect to DAO daemon: ' + e.message, false);
  }
}

// ── Vote Modal ───────────────────────────────────────────────────────

function openDaoVoteModal(proposalId, proposalTitle) {
  document.getElementById('dao-vote-proposal-id').value = proposalId;
  document.getElementById('dao-vote-proposal-title').textContent = `Proposal #${proposalId}: ${proposalTitle}`;
  const stEl = document.getElementById('dao-vote-status');
  if(stEl) stEl.classList.add('hidden');
  const modal = document.getElementById('dao-vote-modal');
  if(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeDaoVoteModal() {
  const modal = document.getElementById('dao-vote-modal');
  if(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

async function submitDaoVote(choice) {
  const id     = document.getElementById('dao-vote-proposal-id')?.value;
  const voter  = document.getElementById('dao-vote-voter')?.value?.trim();
  const weight = parseInt(document.getElementById('dao-vote-weight')?.value) || 0;
  const apiKey = document.getElementById('dao-vote-apikey')?.value;
  const stEl   = document.getElementById('dao-vote-status');

  const setStatus = (msg, ok) => {
    if(!stEl) return;
    stEl.className = `text-xs rounded-lg p-2 ${ok ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`;
    stEl.textContent = msg;
    stEl.classList.remove('hidden');
  };

  if(!voter || !voter.startsWith('zion1')) return setStatus('Valid zion1… voter address required.', false);
  if(weight <= 0) return setStatus('Vote weight (ZION balance) must be > 0.', false);
  if(!apiKey) return setStatus('DAO API Key required.', false);

  // Convert ZION to flowers (× 10^12)
  const weightFlowers = weight * 1_000_000_000_000;

  try {
    const r = await fetch(`/api/dao/proposals/${id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-DAO-Key': apiKey },
      body: JSON.stringify({ voter, choice, weight: weightFlowers }),
      signal: AbortSignal.timeout(8000)
    }).then(r => r.json());

    if(r.success) {
      setStatus(`✓ Vote "${choice}" recorded for proposal #${id}`, true);
      setTimeout(() => { closeDaoVoteModal(); loadDaoProposals(); }, 1500);
    } else {
      setStatus('Error: ' + (r.error || JSON.stringify(r)), false);
    }
  } catch(e) {
    setStatus('Failed: ' + e.message, false);
  }
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
if(refreshTimer) clearInterval(refreshTimer);
refreshTimer = setInterval(refreshAll, REFRESH_INTERVAL_OK);
setTimeout(loadMinerConfig, 500);
// Load overview widgets on startup
setTimeout(() => { loadNclOverview(); loadHiranOverview(); }, 1500);
setTimeout(() => { refreshEdgeServerCard(); }, 3000); // initial edge server load
if(_overviewWidgetTimer) clearInterval(_overviewWidgetTimer);
_overviewWidgetTimer = setInterval(() => { loadNclOverview(); loadHiranOverview(); }, 15000);
// ─────────────────────────────────────────────────────────────────────
// L2 Layer Functions
// ─────────────────────────────────────────────────────────────────────

async function loadL2Data() {
  // Bridge status via proxy
  try {
    const r = await fetch('/api/bridge/health', { signal: AbortSignal.timeout(3000) }).then(r => r.json());
    const ok = r.ok || r.status === 'ok';
    const badge = document.getElementById('l2-bridge-badge');
    if(badge){ badge.className = ok ? 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-700/50 text-emerald-300' : 'text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400'; badge.textContent = ok ? 'Online' : 'Offline'; }
    if(r.total_relays !== undefined) document.getElementById('l2-relays')?.setAttribute('data-val', r.total_relays);
  } catch(e) {}

  // DAO stats
  try {
    const r = await fetch('/api/dao/stats', { signal: AbortSignal.timeout(3000) }).then(r => r.json());
    const d = r.data || r;
    const el = id => document.getElementById(id);
    if(el('l2-proposals')) el('l2-proposals').textContent = d.total_proposals ?? '—';
    if(el('l2-dao-active')) el('l2-dao-active').textContent = d.active ?? '—';
    if(el('l2-dao-passed')) el('l2-dao-passed').textContent = d.passed ?? '—';
  } catch(e) {}

  // Swap status
  try {
    const r = await fetch('/api/swap/health', { signal: AbortSignal.timeout(3000) }).then(r => r.json());
    const ok = r.ok || r.status === 'ok';
    const badge = document.getElementById('l2-swap-badge');
    if(badge){ badge.className = ok ? 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-700/50 text-emerald-300' : 'text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400'; badge.textContent = ok ? 'Online' : 'Offline'; }
    const el = id => document.getElementById(id);
    if(el('l2-swap-active-count')) el('l2-swap-active-count').textContent = r.active_htlcs ?? '—';
    if(el('l2-swap-completed')) el('l2-swap-completed').textContent = r.completed ?? '—';
    if(el('l2-swap-refunded')) el('l2-swap-refunded').textContent = r.refunded ?? '—';
    if(el('l2-swaps')) el('l2-swaps').textContent = r.active_htlcs ?? '—';
  } catch(e) {}
}

async function getAggregatorQuote() {
  const from = document.getElementById('l2-agg-from')?.value || 'ZION';
  const to   = document.getElementById('l2-agg-to')?.value || 'USDC';
  const amt  = document.getElementById('l2-agg-amount')?.value || '1';
  const resultEl = document.getElementById('l2-agg-quote-result');
  const estOut = document.getElementById('l2-agg-est-out');
  const impact = document.getElementById('l2-agg-impact');
  const route  = document.getElementById('l2-agg-route');

  if (!resultEl || !estOut || !impact || !route) return;

  resultEl.classList.remove('hidden');
  estOut.textContent = 'Loading…';
  impact.textContent = '—';
  route.textContent  = '—';

  try {
    const res = await fetch(`/api/swap-aggregator/quote?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${encodeURIComponent(amt)}`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    estOut.textContent = data.amount_out ?? '—';
    impact.textContent = data.price_impact_bps ? `${data.price_impact_bps} bps` : '—';
    route.textContent  = data.route ?? `${from}→${to}`;
  } catch (e) {
    estOut.textContent = 'Unavailable';
    impact.textContent = '—';
    route.textContent  = '—';
  }
}

async function initiateAtomicSwap() {
  const fromChain = document.getElementById('l2-swap-from-chain')?.value;
  const toChain   = document.getElementById('l2-swap-to-chain')?.value;
  const amount    = document.getElementById('l2-swap-amount')?.value;
  const recipient = document.getElementById('l2-swap-recipient')?.value?.trim();
  const stEl      = document.getElementById('l2-swap-status');
  const setStatus = (msg, ok) => {
    if(!stEl) return;
    stEl.className = `text-xs rounded-lg p-2 ${ok ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`;
    stEl.textContent = msg; stEl.classList.remove('hidden');
  };
  if(!amount || !recipient) return setStatus('Amount and recipient address required.', false);
  try {
    const r = await fetch('/api/swap/initiate', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ from_chain: fromChain, to_chain: toChain, amount_zion: Number(amount), recipient }),
      signal: AbortSignal.timeout(8000)
    }).then(r => r.json());
    if(r.ok || r.htlc_id) setStatus(`✓ HTLC initiated: ${r.htlc_id || 'pending'}`, true);
    else setStatus('Error: ' + (r.error || 'Swap daemon offline'), false);
  } catch(e) { setStatus('Swap daemon offline: ' + e.message, false); }
}

// ─────────────────────────────────────────────────────────────────────
// L3 Layer Functions
// ─────────────────────────────────────────────────────────────────────

async function loadL3Data() {
  // WARP health
  try {
    const r = await fetch('/api/warp/health', { signal: AbortSignal.timeout(3000) }).then(r => r.json());
    const ok = r.ok || r.status === 'ok';
    const badge = document.getElementById('l3-warp-badge');
    if(badge){ badge.className = ok ? 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-700/50 text-emerald-300' : 'text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400'; badge.textContent = ok ? 'Online' : 'Offline'; }
    const el = id => document.getElementById(id);
    if(el('l3-warp-relayed')) el('l3-warp-relayed').textContent = r.total_relayed ?? '—';
    if(el('l3-warp-pending')) el('l3-warp-pending').textContent = r.pending ?? '—';
    if(el('l3-warp-chains')) el('l3-warp-chains').textContent = r.chain_count ?? '5';
  } catch(e) {}

  // NCL
  try {
    const r = await fetch('/api/ncl/status', { signal: AbortSignal.timeout(3000) }).then(r => r.json());
    const ok = r.ok || r.status === 'ok';
    const badge = document.getElementById('l3-ncl-badge');
    if(badge){ badge.className = ok ? 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-700/50 text-emerald-300' : 'text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400'; badge.textContent = ok ? 'Online' : 'Offline'; }
    const el = id => document.getElementById(id);
    const workers = r.workers ?? r.total_workers ?? '—';
    const jobs = r.jobs ?? r.active_jobs ?? '—';
    const tflops = r.tflops ?? r.compute_tflops ?? '—';
    if(el('l3-ncl-workers')) el('l3-ncl-workers').textContent = workers;
    if(el('l3-ncl-workers-2')) el('l3-ncl-workers-2').textContent = workers;
    if(el('l3-ncl-jobs')) el('l3-ncl-jobs').textContent = jobs;
    if(el('l3-ncl-jobs-2')) el('l3-ncl-jobs-2').textContent = jobs;
    if(el('l3-tflops')) el('l3-tflops').textContent = tflops;
    if(el('l3-ncl-tflops-2')) el('l3-ncl-tflops-2').textContent = tflops;
  } catch(e) {}

  // Hiran inference
  try {
    const r = await fetch('/api/hiran/status', { signal: AbortSignal.timeout(3000) }).then(r => r.json());
    const ok = r.ok || r.status === 'ok';
    const badge = document.getElementById('l3-hiran-badge');
    if(badge){ badge.className = ok ? 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-700/50 text-emerald-300' : 'text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400'; badge.textContent = ok ? 'Online' : 'Offline'; }
    const el = id => document.getElementById(id);
    if(el('l3-hiran-model') && r.model) el('l3-hiran-model').textContent = r.model;
    if(el('l3-hiran-backend') && r.backend) el('l3-hiran-backend').textContent = r.backend;
    if(el('l3-agents')) el('l3-agents').textContent = r.agents ?? '—';
  } catch(e) {}
}

async function submitNclJob() {
  const jobType = document.getElementById('l3-ncl-job-type')?.value;
  const payload = document.getElementById('l3-ncl-job-payload')?.value?.trim();
  const stEl = document.getElementById('l3-ncl-job-status');
  const setStatus = (msg, ok) => {
    if(!stEl) return;
    stEl.className = `text-[10px] rounded p-1.5 ${ok ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`;
    stEl.textContent = msg; stEl.classList.remove('hidden');
  };
  if(!payload) return setStatus('Payload required.', false);
  try {
    const r = await fetch('/api/ncl/submit', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ job_type: jobType, payload }),
      signal: AbortSignal.timeout(8000)
    }).then(r => r.json());
    if(r.job_id || r.ok) setStatus('✓ Job submitted: ' + (r.job_id || 'queued'), true);
    else setStatus('Error: ' + (r.error || 'NCL offline'), false);
  } catch(e) { setStatus('NCL offline: ' + e.message, false); }
}

// ─────────────────────────────────────────────────────────────────────
// L4 OASIS Layer Functions
// ─────────────────────────────────────────────────────────────────────

async function loadL4Data() {
  try {
    const r = await fetch('/api/oasis/stats', { signal: AbortSignal.timeout(3000) }).then(r => r.json());
    const el = id => document.getElementById(id);
    if(el('l4-avatars')) el('l4-avatars').textContent = r.avatars ?? '—';
    if(el('l4-avatar-count')) el('l4-avatar-count').textContent = r.avatars ?? '—';
    if(el('l4-avatar-active')) el('l4-avatar-active').textContent = r.active_avatars ?? '—';
    if(el('l4-avatar-nft')) el('l4-avatar-nft').textContent = r.nfts_minted ?? '—';
    if(el('l4-guilds')) el('l4-guilds').textContent = r.guilds ?? '—';
    if(el('l4-guild-count')) el('l4-guild-count').textContent = r.guilds ?? '—';
    if(el('l4-guild-members')) el('l4-guild-members').textContent = r.guild_members ?? '—';
    if(el('l4-territories')) el('l4-territories').textContent = r.territories ?? '—';
    if(el('l4-territory-count')) el('l4-territory-count').textContent = r.territories ?? '—';
    if(el('l4-territory-contested')) el('l4-territory-contested').textContent = r.contested ?? '—';
    if(el('l4-quests')) el('l4-quests').textContent = r.active_quests ?? '—';
    if(el('l4-quest-active')) el('l4-quest-active').textContent = r.active_quests ?? '—';
    if(el('l4-quest-completed')) el('l4-quest-completed').textContent = r.completed_quests ?? '—';
    if(el('l4-players')) el('l4-players').textContent = r.online_players ?? '—';
    if(el('l4-server-players')) el('l4-server-players').textContent = `${r.online_players ?? 0}/1000`;
    if(el('l4-server-status')){
      const ok = r.online;
      el('l4-server-status').textContent = ok ? 'Online' : 'Offline';
      el('l4-server-status').className = ok ? 'text-emerald-400' : 'text-gray-400';
    }
  } catch(e) {}
}

async function loadL4Quests() {
  try {
    const r = await fetch('/api/oasis/quests', { signal: AbortSignal.timeout(3000) }).then(r => r.json());
    const list = document.getElementById('l4-quest-list');
    if(!list) return;
    const quests = r.quests || r;
    if(!Array.isArray(quests) || !quests.length) return;
    list.innerHTML = quests.map(q => `
      <div class="bg-black/30 rounded-lg px-3 py-2">
        <div class="flex justify-between"><span class="text-purple-300 font-semibold">${q.name || 'Quest'}</span><span class="text-[10px] text-zion-gold">${q.reward || '—'} ZION</span></div>
        <div class="text-[10px] text-gray-500 mt-0.5">${q.description || ''}</div>
      </div>`).join('');
  } catch(e) {}
}

// ─────────────────────────────────────────────────────────────────────
// L5 Free World Layer Functions
// ─────────────────────────────────────────────────────────────────────

async function loadL5Data() {
  try {
    const r = await fetch('/api/freeworld/stats', { signal: AbortSignal.timeout(3000) }).then(r => r.json());
    const el = id => document.getElementById(id);
    if(el('l5-nodes')) el('l5-nodes').textContent = r.mesh_nodes ?? '—';
    if(el('l5-mesh-nodes')) el('l5-mesh-nodes').textContent = r.mesh_nodes ?? '—';
    if(el('l5-communities')) el('l5-communities').textContent = r.communities ?? '—';
    if(el('l5-aid-tx')) el('l5-aid-tx').textContent = r.aid_transactions ?? '—';
    if(el('l5-medical-queries')) el('l5-medical-queries').textContent = r.medical_queries ?? '—';
    if(el('l5-med-queries')) el('l5-med-queries').textContent = r.medical_queries ?? '—';
    if(el('l5-daos')) el('l5-daos').textContent = r.active_daos ?? '—';
    if(el('l5-dao-count')) el('l5-dao-count').textContent = r.active_daos ?? '—';
    if(el('l5-fund')) el('l5-fund').textContent = r.fund_zion ? (r.fund_zion/1e6).toFixed(0)+'M' : '—';
    if(el('l5-hum-fund')) el('l5-hum-fund').textContent = r.fund_zion ? (r.fund_zion/1e6).toFixed(0)+'M' : '—';
  } catch(e) {}
}

// ─────────────────────────────────────────────────────────────────────
// L6 Issobella Space Layer Functions
// ─────────────────────────────────────────────────────────────────────

async function loadL6Data() {
  try {
    const r = await fetch('/api/space/stats', { signal: AbortSignal.timeout(3000) }).then(r => r.json());
    const el = id => document.getElementById(id);
    if(el('l6-satellites')) el('l6-satellites').textContent = r.satellites ?? '—';
    if(el('l6-sat-active')) el('l6-sat-active').textContent = r.satellites ?? '—';
    if(el('l6-stations')) el('l6-stations').textContent = r.stations ?? '—';
    if(el('l6-orbital-count')) el('l6-orbital-count').textContent = r.stations ?? '—';
    if(el('l6-settlements')) el('l6-settlements').textContent = r.settlements ?? '—';
    if(el('l6-missions')) el('l6-missions').textContent = r.active_missions ?? '—';
    if(el('l6-missions-funded')) el('l6-missions-funded').textContent = r.missions_funded ?? '—';
    if(el('l6-uplinks')) el('l6-uplinks').textContent = r.uplinks_per_sec ?? '—';
    if(el('l6-fund')) el('l6-fund').textContent = r.fund_zion ? (r.fund_zion/1e9).toFixed(1)+'B' : '—';
    if(el('l6-fund-allocated')) el('l6-fund-allocated').textContent = r.fund_allocated ? (r.fund_allocated/1e6).toFixed(0)+'M' : '—';
    if(el('l6-fund-available')) el('l6-fund-available').textContent = r.fund_available ? (r.fund_available/1e6).toFixed(0)+'M' : '—';
    if(el('l6-dao-proposals')) el('l6-dao-proposals').textContent = r.dao_proposals ?? '—';
    const ok = r.online;
    if(el('l6-api-status')){ el('l6-api-status').textContent = ok ? 'Online' : 'Offline'; el('l6-api-status').className = ok ? 'text-emerald-400' : 'text-gray-400'; }
  } catch(e) {}
}

async function loadL6Missions() {
  try {
    const r = await fetch('/api/space/missions', { signal: AbortSignal.timeout(3000) }).then(r => r.json());
    const list = document.getElementById('l6-mission-list');
    if(!list) return;
    const missions = r.missions || r;
    if(!Array.isArray(missions) || !missions.length) return;
    list.innerHTML = missions.map(m => `
      <div class="bg-black/30 rounded-lg px-3 py-2">
        <div class="flex justify-between"><span class="text-purple-300 font-semibold">${m.name || 'Mission'}</span><span class="text-[10px] text-blue-400">${m.status || '—'}</span></div>
        <div class="text-gray-500 text-[10px]">${m.description || ''}</div>
        <div class="w-full bg-gray-800 rounded-full h-1 mt-1"><div class="bg-blue-500 h-1 rounded-full" style="width:${m.progress || 0}%"></div></div>
      </div>`).join('');
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════════════════════
// LOGS & TERMINALS — full SSE streaming, search, native terminal launch
// ═══════════════════════════════════════════════════════════════════════

const LOG_SERVICES = [
  { id: 'node1',         label: 'Node 1',       icon: '⛓️',  color: 'emerald', group: 'core'  },
  { id: 'node2',         label: 'Node 2',       icon: '⛓️',  color: 'blue',    group: 'core'  },
  { id: 'pool',          label: 'Pool',         icon: '🏊',  color: 'cyan',    group: 'core'  },
  { id: 'miner',         label: 'Miner',        icon: '⛏️',  color: 'amber',   group: 'core'  },
  { id: 'miner-low',     label: 'Miner Low',    icon: '⛏️',  color: 'amber',   group: 'core'  },
  { id: 'hiranyagarbha', label: 'Hiranyagarbha',icon: '🧠',  color: 'purple',  group: 'ai'    },
  { id: 'hiran',         label: 'Hiran AI',     icon: '🤖',  color: 'violet',  group: 'ai'    },
  { id: 'bridge',        label: 'Bridge',       icon: '🌉',  color: 'indigo',  group: 'l2'    },
  { id: 'dao-daemon',    label: 'DAO Daemon',   icon: '🗳️', color: 'purple',  group: 'l2'    },
  { id: 'atomic-swap',   label: 'Atomic Swap',  icon: '⚡',  color: 'amber',   group: 'l2'    },
  { id: 'warp',          label: 'WARP',         icon: '🌀',  color: 'cyan',    group: 'l3'    },
  { id: 'dashboard',     label: 'Dashboard',    icon: '📊',  color: 'gray',    group: 'system'},
  { id: 'control-audit', label: 'Audit Log',    icon: '📝',  color: 'gray',    group: 'system'},
];

let _logActiveSvc   = 'node1';
let _logSseSource   = null;   // current EventSource
let _logLineCount   = 0;
let _logAutoScroll  = true;

// ── Build tab bar & service grid on first open ──────────────────────────
function initLogPane() {
  const tabBar  = document.getElementById('log-tab-bar');
  const svcGrid = document.getElementById('log-svc-grid');
  if (!tabBar || tabBar.dataset.built) return;
  tabBar.dataset.built = '1';

  const colorMap = {
    emerald:'text-emerald-300 border-emerald-500/40',
    blue:   'text-blue-300 border-blue-500/40',
    cyan:   'text-cyan-300 border-cyan-500/40',
    amber:  'text-amber-300 border-amber-500/40',
    purple: 'text-purple-300 border-purple-500/40',
    violet: 'text-violet-300 border-violet-500/40',
    indigo: 'text-indigo-300 border-indigo-500/40',
    gray:   'text-gray-300 border-gray-500/40',
  };

  LOG_SERVICES.forEach(s => {
    // Tab button
    const btn = document.createElement('button');
    btn.id = `log-tab-${s.id}`;
    btn.dataset.svc = s.id;
    btn.className = `flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-mono whitespace-nowrap border-b-2 border-transparent text-gray-400 hover:text-white transition shrink-0`;
    btn.innerHTML = `${s.icon} ${s.label}`;
    btn.onclick = () => logSelectSvc(s.id);
    tabBar.appendChild(btn);

    // Service card in grid
    const card = document.createElement('div');
    card.id = `log-svc-card-${s.id}`;
    card.className = 'zion-panel p-3 cursor-pointer hover:border-white/20 transition';
    card.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm">${s.icon}</span>
        <span id="log-svc-dot-${s.id}" class="w-2 h-2 rounded-full bg-gray-600"></span>
      </div>
      <div class="text-[11px] font-mono text-gray-200 mb-1">${s.label}</div>
      <div class="text-[10px] text-gray-500 uppercase mb-2">${s.group}</div>
      <div class="flex gap-1 flex-wrap">
        <button data-stream="${s.id}" class="stream-btn text-[10px] px-2 py-0.5 bg-emerald-700/40 hover:bg-emerald-600 rounded transition">▶ Stream</button>
        <button data-term="${s.id}" class="term-btn text-[10px] px-2 py-0.5 bg-purple-700/40 hover:bg-purple-600 rounded transition">⬛ Term</button>
      </div>`;
    svcGrid.appendChild(card);
  });

  // Select first by default
  logSelectSvc('node1');
  refreshLogFiles();
}

function logSelectSvc(svcId) {
  _logActiveSvc = svcId;
  // Update tab highlight
  LOG_SERVICES.forEach(s => {
    const btn = document.getElementById(`log-tab-${s.id}`);
    if (!btn) return;
    if (s.id === svcId) {
      btn.classList.add('border-b-2', 'border-zion-gold', 'text-white');
      btn.classList.remove('border-transparent', 'text-gray-400');
    } else {
      btn.classList.remove('border-zion-gold', 'text-white');
      btn.classList.add('border-transparent', 'text-gray-400');
    }
  });
  const svc = LOG_SERVICES.find(s => s.id === svcId);
  const lbl = document.getElementById('log-active-svc-label');
  if (lbl) lbl.textContent = svc ? `${svc.icon} ${svc.label}` : svcId;
}

// ── SSE streaming ───────────────────────────────────────────────────────
function logStreamStart() {
  logStreamStop();
  const out = document.getElementById('log-terminal-output');
  if (!out) return;
  _logLineCount = 0;
  out.textContent = '';
  _logAutoScroll = true;
  const badge = document.getElementById('log-stream-badge');
  const btn   = document.getElementById('log-stream-btn');
  if (badge) { badge.textContent = `Streaming: ${_logActiveSvc}`; badge.className = 'text-[10px] px-3 py-1 rounded-full bg-emerald-700/50 text-emerald-300'; }
  if (btn) btn.textContent = '⏸ Streaming';

  // Color-code ANSI-less log lines
  const colorLine = (line) => {
    if (/error|ERROR|ERRO|panic/i.test(line)) return `\x1b[31m${line}\x1b[0m`; // red via span
    if (/warn|WARN/i.test(line))              return `<span class="text-amber-400">${escapeHtml(line)}</span>`;
    if (/info|INFO/i.test(line))              return `<span class="text-emerald-300/70">${escapeHtml(line)}</span>`;
    if (/debug|DEBUG|trace|TRACE/i.test(line))return `<span class="text-gray-500">${escapeHtml(line)}</span>`;
    return escapeHtml(line);
  };

  const url = `/api/logs/stream?svc=${encodeURIComponent(_logActiveSvc)}&lines=200`;
  _logSseSource = new EventSource(url);
  _logSseSource.onmessage = (e) => {
    _logLineCount++;
    const span = document.createElement('span');
    const line = e.data;
    if (/error|ERROR|ERRO|panic/i.test(line)) span.className = 'text-red-400';
    else if (/warn|WARN/i.test(line))          span.className = 'text-amber-400';
    else if (/info|INFO/i.test(line))          span.className = 'text-emerald-300/70';
    else if (/debug|DEBUG|trace|TRACE/i.test(line)) span.className = 'text-gray-500';
    span.textContent = line + '\n';
    out.appendChild(span);
    // Keep max 2000 lines in DOM
    while (out.childNodes.length > 2000) out.removeChild(out.firstChild);
    const lc = document.getElementById('log-line-count');
    if (lc) lc.textContent = `${_logLineCount} lines`;
    if (_logAutoScroll) out.scrollTop = out.scrollHeight;
  };
  _logSseSource.onerror = () => {
    if (badge) { badge.textContent = 'Stream error'; badge.className = 'text-[10px] px-3 py-1 rounded-full bg-red-700/50 text-red-300'; }
    logStreamStop();
  };

  // Track scroll position to pause auto-scroll when user scrolls up
  out.onscroll = () => {
    _logAutoScroll = (out.scrollHeight - out.scrollTop - out.clientHeight) < 50;
  };

  // Update dot indicator
  const dot = document.getElementById(`log-svc-dot-${_logActiveSvc}`);
  if (dot) { dot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse'; }
}

function logStreamStop() {
  if (_logSseSource) { _logSseSource.close(); _logSseSource = null; }
  const badge = document.getElementById('log-stream-badge');
  const btn   = document.getElementById('log-stream-btn');
  if (badge) { badge.textContent = 'Idle'; badge.className = 'text-[10px] px-3 py-1 rounded-full bg-gray-700 text-gray-400'; }
  if (btn)   btn.textContent = '▶ Stream';
  // Clear dot
  LOG_SERVICES.forEach(s => {
    const dot = document.getElementById(`log-svc-dot-${s.id}`);
    if (dot && dot.classList.contains('animate-pulse')) { dot.className = 'w-2 h-2 rounded-full bg-gray-600'; }
  });
}

function logStreamToggle() {
  if (_logSseSource) logStreamStop();
  else logStreamStart();
}

function logClearPanel() {
  const out = document.getElementById('log-terminal-output');
  if (out) { out.textContent = ''; _logLineCount = 0; }
  const lc = document.getElementById('log-line-count');
  if (lc) lc.textContent = '0 lines';
}

function logScrollBottom() {
  const out = document.getElementById('log-terminal-output');
  if (out) { out.scrollTop = out.scrollHeight; _logAutoScroll = true; }
}

// ── Native terminal ─────────────────────────────────────────────────────
async function openNativeTerminal() {
  await openNativeTerminalFor(_logActiveSvc);
}

async function openNativeTerminalFor(svcId) {
  try {
    const r = await fetch(`/api/terminal/open?svc=${encodeURIComponent(svcId)}`).then(r => r.json());
    if (r.ok) toast(`Terminal opened for ${svcId}`, 'success');
    else toast(`Failed to open terminal: ${r.error || 'unknown'}`, 'error');
  } catch(e) { toast('Terminal open error: ' + e.message, 'error'); }
}

// ── Global log search ───────────────────────────────────────────────────
async function logSearchAll() {
  const q       = (document.getElementById('log-search-input')?.value || '').trim();
  const level   = document.getElementById('log-level-filter')?.value || 'all';
  const svcFilt = document.getElementById('log-svc-filter')?.value || '';
  const resEl   = document.getElementById('log-search-results');
  if (!resEl) return;
  if (!q && level === 'all' && !svcFilt) { resEl.classList.add('hidden'); return; }
  resEl.innerHTML = '<div class="text-gray-500 text-[11px]">Searching…</div>';
  resEl.classList.remove('hidden');
  try {
    const url = `/api/log-search?q=${encodeURIComponent(q)}&level=${level}&svc=${encodeURIComponent(svcFilt)}`;
    const r = await fetch(url).then(r => r.json());
    const hits = r.results || [];
    if (!hits.length) { resEl.innerHTML = '<div class="text-gray-500 text-[11px]">No results</div>'; return; }
    resEl.innerHTML = hits.slice(0, 500).map(h => {
      const lvlClass = /error|ERROR/i.test(h.line) ? 'text-red-400' : /warn|WARN/i.test(h.line) ? 'text-amber-400' : /info|INFO/i.test(h.line) ? 'text-emerald-300/80' : 'text-gray-300';
      return `<div class="flex gap-2"><span class="text-gray-600 shrink-0 w-24">${h.svc}:${h.lineno}</span><span class="${lvlClass}">${escapeHtml(h.line)}</span></div>`;
    }).join('');
  } catch(e) { resEl.innerHTML = `<div class="text-red-400 text-[11px]">Error: ${e.message}</div>`; }
}

// ── Disk log file list ───────────────────────────────────────────────────
async function refreshLogFiles() {
  const el = document.getElementById('log-files-list');
  if (!el) return;
  try {
    const r = await fetch('/api/log-files').then(r => r.json());
    const files = r.files || [];
    if (!files.length) { el.innerHTML = '<div class="text-gray-500 italic">No log files found in logs/</div>'; return; }
    el.innerHTML = files.map(f => `
      <div class="bg-black/30 rounded-lg px-3 py-2 flex items-center justify-between">
        <div>
          <div class="text-gray-200 font-mono">${escapeHtml(f.name)}</div>
          <div class="text-[10px] text-gray-500">${f.size_kb ? f.size_kb + ' KB' : '—'} · ${f.modified || '—'}</div>
        </div>
        <button data-log-open="${escapeHtml(f.svc_id || f.name)}"
          class="logopen-btn text-[10px] px-2 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded transition">View</button>
      </div>`).join('');
  } catch(e) { el.innerHTML = `<div class="text-red-400 text-xs">Error: ${e.message}</div>`; }
}

function logSelectAndOpen(svcId) {
  // Find matching service or use as-is
  const match = LOG_SERVICES.find(s => s.id === svcId || svcId.startsWith(s.id));
  logSelectSvc(match ? match.id : svcId);
  logStreamStart();
  // Scroll to terminal
  document.getElementById('log-terminal-output')?.scrollIntoView({ behavior: 'smooth' });
}

// ── Launch Day countdown ───────────────────────────────────────────────
function startLaunchCountdown(){
  const el = document.getElementById('launch-countdown');
  if(!el) return;
  const target = new Date('2026-12-31T12:00:00Z');
  function tick(){
    const now = new Date();
    const diff = target - now;
    if(diff <= 0){ el.textContent = '🚀 LAUNCH NOW'; return; }
    const d = Math.floor(diff/86400000);
    const h = Math.floor((diff%86400000)/3600000);
    const m = Math.floor((diff%3600000)/60000);
    const s = Math.floor((diff%60000)/1000);
    el.textContent = `${d}d ${h}h ${m}m ${s}s`;
  }
  tick();
  if(_countdownTimer) clearInterval(_countdownTimer);
  _countdownTimer = setInterval(tick, 1000);
}

// ── Hook into switchTab for logs ─────────────────────────────────────────
// (handled in the existing switchTab via: if(name === 'logs'){...})
// We augment it by wrapping the call:
const _origSwitchTab = switchTab;
// Override logs init in switchTab — patch the call site instead
// Already handled via initLogPane() called from the patched switchTab listener below.

// Event delegation for data-action buttons (replaces inline onclick)
document.body.addEventListener('click', (e) => {
  const btn = e.target.closest('.action-btn');
  if(btn && btn.dataset.action){ controlAction(btn.dataset.action); return; }
  const bkp = e.target.closest('.backup-btn');
  if(bkp && bkp.dataset.backup){
    if(bkp.dataset.cmd === 'restore') restoreBackup(bkp.dataset.backup);
    else if(bkp.dataset.cmd === 'delete') deleteBackup(bkp.dataset.backup);
    return;
  }
  const cpy = e.target.closest('[data-copy]');
  if(cpy && cpy.dataset.copy){ copyToClipboard(cpy.dataset.copy); return; }
  const ctrl = e.target.closest('.ctrl-btn');
  if(ctrl && ctrl.dataset.control){ controlAction(ctrl.dataset.control); return; }
  const met = e.target.closest('.metrics-btn');
  if(met && met.dataset.metrics){ loadMetrics(met.dataset.metrics); return; }
  const lsvc = e.target.closest('.logsvc-btn');
  if(lsvc && lsvc.dataset.logSvc){ switchTab('logs'); setTimeout(()=>loadLogs(lsvc.dataset.logSvc), 300); return; }
  const env = e.target.closest('.env-btn');
  if(env && env.dataset.env){ selectEnv(env.dataset.env); return; }
  const db = e.target.closest('.db-btn');
  if(db && db.dataset.db){ inspectDb(db.dataset.db); return; }
  const kill = e.target.closest('.kill-btn');
  if(kill && kill.dataset.killPid){ killPid(kill.dataset.killPid); return; }
  const stream = e.target.closest('.stream-btn');
  if(stream && stream.dataset.stream){ logSelectSvc(stream.dataset.stream); logStreamStart(); return; }
  const term = e.target.closest('.term-btn');
  if(term && term.dataset.term){ openNativeTerminalFor(term.dataset.term); return; }
  const lopen = e.target.closest('.logopen-btn');
  if(lopen && lopen.dataset.logOpen){ logSelectAndOpen(lopen.dataset.logOpen); return; }
  const blk = e.target.closest('[data-block-height]');
  if(blk && blk.dataset.blockHeight){ openBlockModal(parseInt(blk.dataset.blockHeight, 10)); return; }
  const tbtn = e.target.closest('.tab-btn');
  if(tbtn && tbtn.dataset.tab){ switchTab(tbtn.dataset.tab); return; }
  const dao = e.target.closest('.daovote-btn');
  if(dao && dao.dataset.daoId){ openDaoVoteModal(parseInt(dao.dataset.daoId, 10), dao.dataset.daoTitle); return; }
  const ncl = e.target.closest('.ncl-toggle');
  if(ncl && ncl.dataset.toggleDetail){ ncl.querySelector('.ncl-detail')?.classList.toggle('hidden'); return; }
});

// ════════════════════════════════════════════════════════════════════════
// FEATURE R — Readiness Score
// ════════════════════════════════════════════════════════════════════════
let lastReadinessData = null;

async function refreshReadiness() {
  try {
    const r = await fetch('/api/readiness').then(r => r.json());
    lastReadinessData = r;
    renderReadiness(r);
  } catch(e) { /* silent */ }
}

function renderReadiness(data) {
  if (!data) return;
  const bar = document.getElementById('readiness-bar');
  const scoreEl = document.getElementById('readiness-score');
  const label = document.getElementById('readiness-label');
  const breakdown = document.getElementById('readiness-breakdown');
  if (!bar || !scoreEl) return;

  const score = data.score ?? 0;
  const color = data.color || 'gray';
  const colorMap = { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444', gray: '#374151' };
  bar.style.width = score + '%';
  bar.style.background = colorMap[color] || colorMap.gray;
  scoreEl.textContent = score;

  const labelText = score >= 85 ? 'Ready for mainnet' : (score >= 60 ? 'Partially ready' : 'Not ready');
  if (label) label.textContent = `${labelText} · ${data.earned_weight}/${data.total_weight} pts`;

  if (breakdown && data.breakdown) {
    breakdown.innerHTML = data.breakdown.map(b => {
      const dot = b.alive ? '🟢' : '🔴';
      const name = SVC_LABEL_MAP[b.id] || b.id;
      return `<span class="px-1.5 py-0.5 rounded bg-black/20 ${b.alive?'text-emerald-400':'text-rose-400'}">${dot} ${escapeHtml(name)} (${b.weight})</span>`;
    }).join('');
  }
}


// ════════════════════════════════════════════════════════════════════════
// FEATURE C — Service Health Timeline (24h heatmap)
// ════════════════════════════════════════════════════════════════════════
// All service IDs that backend can persist in health history (ordered by layer L1→L2→L3→Infra)
const SERVICE_HISTORY_LABELS = ['node1','node2','pool','pool-edge','miner','bridge','dao','atomic-swap','warp','ncl','hiranyagarbha','ai-native','oasis','free-world','issobella','prometheus','grafana','dashboard'];
const SVC_LABEL_MAP = { node1:'Node 1', node2:'Node 2', pool:'Pool', 'pool-edge':'Pool Edge', miner:'Miner', bridge:'Bridge', dao:'DAO', 'atomic-swap':'Atomic Swap', warp:'WARP', ncl:'NCL', hiranyagarbha:'Hiran API', 'ai-native':'AI Native', oasis:'OASIS', 'free-world':'Free World', issobella:'Issobella', prometheus:'Prometheus', grafana:'Grafana', dashboard:'Dashboard' };
const SVC_LEVEL_ORDER = { 'L1':0, 'L2':1, 'L3':2, 'L4':3, 'L5':4, 'L6':5, 'Infra':6 };
let serviceHealthData = null;
let healthRangeBuckets = 48; // default 4h
let _lastServicesForTimeline = null; // cache from /api/services

async function refreshServiceHealth() {
  try {
    const r = await fetch('/api/service-history').then(r => r.json());
    serviceHealthData = r.buckets || [];
  } catch(e) { /* silent */ }
}

function _healthRangeLabel(n) {
  if (n <= 12) return 'Last 1h · 5-min buckets';
  if (n <= 48) return 'Last 4h · 5-min buckets';
  return 'Last 24h · 5-min buckets';
}

function _fmtTime(ts) {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

function _uptimePct(states, key, total) {
  if (!total) return '—';
  let up = 0;
  for (const s of states) { if (s[key] === true) up++; }
  return Math.round((up / total) * 100) + '%';
}

function _getOrderedLabels(services) {
  // Order by layer then name
  if (!services || !services.length) return SERVICE_HISTORY_LABELS;
  const order = [...services].sort((a,b) => {
    const la = SVC_LEVEL_ORDER[a.level] ?? 99;
    const lb = SVC_LEVEL_ORDER[b.level] ?? 99;
    if (la !== lb) return la - lb;
    return (a.name||a.id).localeCompare(b.name||b.id);
  });
  return order.map(s => s.id);
}

function renderServiceHealthTimeline(services) {
  const el = document.getElementById('service-health-timeline');
  if (!el) return;
  const buckets = serviceHealthData || [];
  if (!buckets.length) { el.innerHTML = '<div class="text-gray-500 text-xs italic">No history yet — data accumulates every 5 minutes.</div>'; return; }

  const recent = buckets.slice(-healthRangeBuckets);
  const orderedLabels = _getOrderedLabels(services);
  const svcCount = orderedLabels.length;
  const cellSize = healthRangeBuckets <= 12 ? 10 : (healthRangeBuckets <= 48 ? 8 : 5);

  // Build level grouping for labels
  const levelMap = {};
  if (services && services.length) {
    for (const s of services) levelMap[s.id] = s.level;
  }

  let html = '<div style="display:flex;gap:1.5px;overflow-x:auto;padding-bottom:6px;">';
  for (let c = 0; c < recent.length; c++) {
    const bucket = recent[c];
    const states = bucket.services || bucket.states || {};
    const tLabel = _fmtTime(bucket.t);
    let col = `<div style="display:flex;flex-direction:column;gap:1.5px;min-width:${cellSize}px;" title="${tLabel}">`;
    for (let s = 0; s < svcCount; s++) {
      const key = orderedLabels[s];
      const alive = states[key] === true;
      const hasData = states[key] !== undefined && states[key] !== null;
      const color = alive ? '#22c55e' : (hasData ? '#ef4444' : '#374151');
      col += `<div style="width:${cellSize}px;height:${cellSize}px;background:${color};border-radius:2px;" title="${escapeHtml(SVC_LABEL_MAP[key]||key)} @ ${tLabel}: ${alive?'online':(hasData?'offline':'no data')}"></div>`;
    }
    col += '</div>';
    html += col;
  }
  html += '</div>';

  html += '<div class="flex flex-col gap-1 mt-2">';
  let lastLevel = null;
  for (const svc of orderedLabels) {
    const lvl = levelMap[svc] || '?';
    // Inject layer header when layer changes
    if (lvl !== lastLevel) {
      html += `<div class="text-[9px] uppercase tracking-wider text-gray-500 mt-1 mb-0.5 font-semibold">${lvl}</div>`;
      lastLevel = lvl;
    }
    const last = recent.length ? (recent[recent.length-1].services || recent[recent.length-1].states || {})[svc] : null;
    const statusDot = last === true ? '<span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>' : (last === false ? '<span class="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>' : '<span class="w-2 h-2 rounded-full bg-gray-600 inline-block"></span>');
    const uptime = _uptimePct(recent.map(b => b.services || b.states || {}), svc, recent.length);
    html += `<div class="flex items-center justify-between text-[10px] text-gray-400 hover:bg-white/5 rounded px-1 transition">
      <span class="flex items-center gap-1.5">${statusDot} <span class="text-gray-300 font-medium">${escapeHtml(SVC_LABEL_MAP[svc]||svc)}</span></span>
      <span class="font-mono text-gray-500">uptime ${uptime}</span>
    </div>`;
  }
  html += '</div>';

  el.innerHTML = html;
}

// Toggle listener for health range
document.body.addEventListener('click', (e) => {
  const btn = e.target.closest('.health-toggle');
  if (!btn) return;
  const val = parseInt(btn.dataset.range, 10);
  if (!val || val === healthRangeBuckets) return;
  healthRangeBuckets = val;
  document.querySelectorAll('.health-toggle').forEach(b => {
    b.classList.remove('bg-white/10', 'text-white');
    b.classList.add('text-gray-400');
  });
  btn.classList.add('bg-white/10', 'text-white');
  btn.classList.remove('text-gray-400');
  const lbl = document.getElementById('health-range-label');
  if (lbl) lbl.textContent = _healthRangeLabel(val);
  renderServiceHealthTimeline();
});

// ════════════════════════════════════════════════════════════════════════
// FEATURE D — Payout fee-split donut + stacked bar history
// ════════════════════════════════════════════════════════════════════════
let payoutDonutChart = null;
let payoutHistoryChart = null;

function _zionFmt(n) {
  const v = parseFloat(n) || 0;
  if (v >= 1e6) return (v/1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v/1e3).toFixed(2) + 'K';
  return v.toFixed(4);
}

function renderPayoutDonut(payouts) {
  const ctx = document.getElementById('chart-payout-donut')?.getContext('2d');
  if (!ctx) return;

  const totals = { miner:0, charity:0, dev:0, pool:0 };
  const hasData = payouts && payouts.length;
  if (hasData) {
    for (const p of payouts) {
      const s = p.fee_split || p.split || {};
      totals.miner += parseFloat(s.miner || p.miner_amount || 0);
      totals.charity += parseFloat(s.charity || p.charity_amount || 0);
      totals.dev += parseFloat(s.dev || p.dev_amount || 0);
      totals.pool += parseFloat(s.pool || p.pool_fee || 0);
    }
  }
  const data = hasData ? [totals.miner, totals.charity, totals.dev, totals.pool] : [1,1,1,1];
  const labels = ['Miner (89%)','Charity (5%)','Dev (5%)','Burned (1%)'];
  const colors = ['#22c55e','#f59e0b','#3b82f6','#8b5cf6'];
  const emptyColors = ['rgba(34,197,94,0.15)','rgba(245,158,11,0.15)','rgba(59,130,246,0.15)','rgba(139,92,246,0.15)'];

  if (payoutDonutChart) payoutDonutChart.destroy();
  payoutDonutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: hasData ? colors : emptyColors,
        borderWidth: 0,
        hoverOffset: hasData ? 6 : 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position:'right', labels:{color:'#9ca3af',font:{size:10}, boxWidth:10} },
        tooltip: {
          enabled: hasData,
          callbacks: {
            label: (c) => {
              const total = c.dataset.data.reduce((a,b)=>a+b,0);
              const pct = total ? ((c.parsed/total)*100).toFixed(1) : '0.0';
              return ` ${c.label}: ${_zionFmt(c.parsed)} ZION (${pct}%)`;
            }
          }
        }
      }
    },
    plugins: [{
      id: 'centerText',
      afterDraw(chart) {
        const {ctx, chartArea: {top, bottom, left, right}} = chart;
        const cx = (left + right) / 2;
        const cy = (top + bottom) / 2;
        ctx.save();
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = hasData ? '#e5e7eb' : '#6b7280';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hasData ? `${payouts.length} blocks` : 'No blocks yet', cx, cy);
        ctx.restore();
      }
    }]
  });
}

function renderPayoutHistory(payouts) {
  const ctx = document.getElementById('chart-payout-history')?.getContext('2d');
  if (!ctx) return;
  if (!payouts || !payouts.length) {
    if (payoutHistoryChart) { payoutHistoryChart.destroy(); payoutHistoryChart = null; }
    return;
  }
  const sorted = [...payouts].sort((a,b) => (a.block_height||0)-(b.block_height||0));
  const labels = sorted.map(p => '#' + (p.block_height || p.block || '—'));
  const miner = sorted.map(p => parseFloat((p.fee_split||p.split||{}).miner || p.miner_amount || 0));
  const charity = sorted.map(p => parseFloat((p.fee_split||p.split||{}).charity || p.charity_amount || 0));
  const dev = sorted.map(p => parseFloat((p.fee_split||p.split||{}).dev || p.dev_amount || 0));
  const pool = sorted.map(p => parseFloat((p.fee_split||p.split||{}).pool || p.pool_fee || 0));

  if (payoutHistoryChart) payoutHistoryChart.destroy();
  payoutHistoryChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'Miner', data:miner, backgroundColor:'#22c55e', stack:'stack1', borderRadius:2 },
        { label:'Charity', data:charity, backgroundColor:'#f59e0b', stack:'stack1', borderRadius:2 },
        { label:'Dev', data:dev, backgroundColor:'#3b82f6', stack:'stack1', borderRadius:2 },
        { label:'Pool', data:pool, backgroundColor:'#8b5cf6', stack:'stack1', borderRadius:2 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks:{color:'#9ca3af',font:{size:7}, maxRotation:45}, grid:{display:false}, stacked:true },
        y: { ticks:{color:'#9ca3af',font:{size:8}, callback:v=>_zionFmt(v)}, grid:{color:'rgba(255,255,255,0.05)'}, stacked:true }
      },
      plugins: {
        legend: { labels:{color:'#9ca3af',font:{size:9}, boxWidth:10}, position:'top', align:'end' },
        tooltip: {
          callbacks: {
            label: (c) => ` ${c.dataset.label}: ${_zionFmt(c.parsed)} ZION`,
            footer: (items) => {
              const sum = items.reduce((a,it)=>a+it.parsed,0);
              return `Total: ${_zionFmt(sum)} ZION`;
            }
          }
        }
      }
    }
  });
}

// ════════════════════════════════════════════════════════════════════════
// FEATURE E — Mempool live sparkline
// ════════════════════════════════════════════════════════════════════════
let mempoolSparkline = null;

function renderMempoolSparkline(mempoolSize) {
  const canvas = document.getElementById('chart-mempool-sparkline');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Pre-fill so chart doesn't look broken on first load
  if (!window._mempoolHistory) window._mempoolHistory = new Array(50).fill(0);
  window._mempoolHistory.push(mempoolSize || 0);
  if (window._mempoolHistory.length > 50) window._mempoolHistory.shift();
  const data = window._mempoolHistory;

  // Current-value overlay
  const parent = canvas.parentElement;
  let overlay = parent.querySelector('.mempool-sparkline-value');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'mempool-sparkline-value absolute top-0 right-0 text-[9px] font-mono text-amber-400 px-1';
    parent.style.position = 'relative';
    parent.appendChild(overlay);
  }
  overlay.textContent = (mempoolSize || 0) + ' tx';

  const maxVal = Math.max(...data);
  const pointRadii = data.map(v => v === maxVal && maxVal > 0 ? 3 : 0);
  const pointColors = data.map(v => v === maxVal && maxVal > 0 ? '#ef4444' : 'transparent');
  const labels = data.map((_,i) => '');

  if (mempoolSparkline) mempoolSparkline.destroy();
  mempoolSparkline = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: '#f59e0b',
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const {ctx: c, chartArea} = chart;
          if (!chartArea) return 'rgba(245,158,11,0.1)';
          const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          grad.addColorStop(0, 'rgba(245,158,11,0.25)');
          grad.addColorStop(1, 'rgba(245,158,11,0.0)');
          return grad;
        },
        fill: true,
        pointRadius: pointRadii,
        pointBackgroundColor: pointColors,
        pointBorderColor: pointColors,
        tension: 0.35,
        borderWidth: 1.8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { display: false },
        y: { display: false, min: 0, suggestedMax: Math.max(10, maxVal * 1.2) }
      },
      plugins: { legend:{display:false}, tooltip:{enabled:false} },
      animation: { duration: 300, easing: 'linear' },
      interaction: { intersect: false }
    }
  });
}


// ════════════════════════════════════════════════════════════════════════
// FEATURE F — Network topology SVG map
// ════════════════════════════════════════════════════════════════════════
const TOPO_NODES = [
  { id:'node1', label:'Node 1', x:400, y:140, kind:'core' },
  { id:'pool',  label:'Pool',   x:220, y:80,  kind:'core' },
  { id:'miner1',label:'Miner 1',x:80,  y:50,  kind:'core' },
  { id:'miner2',label:'Miner 2',x:80,  y:110, kind:'core' },
  { id:'bridge',label:'Bridge', x:620, y:80,  kind:'L2' },
  { id:'dao',   label:'DAO',    x:620, y:160, kind:'L2' },
  { id:'atomic',label:'Atomic Swap', x:620, y:240, kind:'L2' },
  { id:'web',   label:'Web',    x:400, y:260, kind:'L3' },
  { id:'ai',    label:'AI Native', x:220, y:240, kind:'L3' },
];

const TOPO_EDGES = [
  ['node1','pool'],['pool','miner1'],['pool','miner2'],
  ['node1','bridge'],['node1','dao'],['node1','atomic'],
  ['node1','web'],['node1','ai'],['bridge','dao'],['dao','atomic']
];

const TOPO_ID_MAP = {
  node1:'node1', node:'node1', 'node-1':'node1',
  pool:'pool',
  miner:'miner1', miner1:'miner1', 'miner-1':'miner1',
  miner2:'miner2', 'miner-2':'miner2',
  bridge:'bridge',
  dao:'dao',
  'atomic-swap':'atomic', 'atomic_swap':'atomic', atomicswap:'atomic',
  web:'web', website:'web',
  'ai-native':'ai', ai:'ai', ainative:'ai',
  hiranyagarbha:'ai', hiran:'ai'
};

function _statusColor(status) {
  if (status === 'running' || status === 'online' || status === true) return '#22c55e';
  if (status === 'degraded') return '#f59e0b';
  if (status === 'stopped' || status === 'offline' || status === false) return '#ef4444';
  if (status === 'starting' || status === 'restarting') return '#f59e0b';
  return '#6b7280';
}

function renderTopology(services) {
  const container = document.getElementById('topology-svg-container');
  if (!container) return;
  const tooltip = document.getElementById('topology-tooltip');

  // Build rich status map: id -> {status, derived, depends_on}
  const svcMap = {};
  if (services && services.length) {
    for (const s of services) {
      const mapped = TOPO_ID_MAP[s.id] || TOPO_ID_MAP[s.id.replace(/[-_]/g,'')] || s.id;
      const info = { status: s.status, derived: s.derived, depends_on: s.depends_on || [] };
      svcMap[mapped] = info;
      svcMap[s.id] = info;
    }
  }

  // Update node state
  const nodes = TOPO_NODES.map(n => {
    const info = svcMap[n.id] || svcMap[n.id.replace(/[-_]/g,'')] || {status:'unknown'};
    return { ...n, status: info.status, color: _statusColor(info.status) };
  });

  let svg = `<svg viewBox="0 0 800 320" width="100%" height="100%" style="background:#0b0f19; border-radius:12px;" id="topo-svg">`;

  // Background grid
  svg += `<defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/></pattern></defs>`;
  svg += `<rect width="100%" height="100%" fill="url(#grid)" />`;

  // Curved edges with dependency awareness
  for (const [a,b] of TOPO_EDGES) {
    const nA = nodes.find(n=>n.id===a);
    const nB = nodes.find(n=>n.id===b);
    if (!nA || !nB) continue;
    const infoA = svcMap[nA.id] || {};
    const infoB = svcMap[nB.id] || {};
    const aOk = infoA.status==='running' || infoA.status==='online' || infoA.status===true;
    const bOk = infoB.status==='running' || infoB.status==='online' || infoB.status===true;
    // Edge is active only if BOTH endpoints healthy
    const bothAlive = aOk && bOk;
    // Dependency check: if this edge represents a dependency (a depends on b or b depends on a)
    const depAonB = (infoA.depends_on || []).includes(nB.id) || (infoA.depends_on || []).includes(TOPO_ID_MAP[nB.id]);
    const depBonA = (infoB.depends_on || []).includes(nA.id) || (infoB.depends_on || []).includes(TOPO_ID_MAP[nA.id]);
    const dependencySatisfied = !(depAonB && !bOk) && !(depBonA && !aOk);
    const fullyHealthy = bothAlive && dependencySatisfied;

    const stroke = fullyHealthy ? 'rgba(34,197,94,0.35)' : (bothAlive ? 'rgba(245,158,11,0.3)' : 'rgba(107,114,128,0.15)');
    const sw = fullyHealthy ? 2 : (bothAlive ? 1.8 : 1);
    // Animated dash for degraded dependency
    const dash = !dependencySatisfied ? ' stroke-dasharray="4,3"' : '';
    // Compute midpoint with slight curve
    const mx = (nA.x + nB.x) / 2;
    const my = (nA.y + nB.y) / 2;
    const dx = nB.x - nA.x, dy = nB.y - nA.y;
    const len = Math.sqrt(dx*dx + dy*dy) || 1;
    const off = len * 0.15;
    const qx = mx - (dy/len) * off;
    const qy = my + (dx/len) * off;
    svg += `<path d="M${nA.x},${nA.y} Q${qx},${qy} ${nB.x},${nB.y}" stroke="${stroke}" stroke-width="${sw}" fill="none" stroke-linecap="round"${dash} />`;
  }

  // Nodes
  for (const n of nodes) {
    const isAlive = n.color === '#22c55e';
    const isDegraded = n.color === '#f59e0b';
    const pulse = isAlive ? `<animate attributeName="r" values="18;22;18" dur="2s" repeatCount="indefinite" />` : '';
    svg += `<g class="topo-node" data-id="${n.id}" data-label="${escapeHtml(n.label)}" data-status="${escapeHtml(n.status)}" style="cursor:pointer;">`;
    // Glow ring (pulsing for alive)
    svg += `<circle cx="${n.x}" cy="${n.y}" r="18" fill="${n.color}" opacity="0.15">${pulse}</circle>`;
    // Outer ring
    svg += `<circle cx="${n.x}" cy="${n.y}" r="14" fill="none" stroke="${n.color}" stroke-width="2" opacity="0.6" />`;
    // Core dot
    svg += `<circle cx="${n.x}" cy="${n.y}" r="8" fill="${n.color}" stroke="#0b0f19" stroke-width="2" />`;
    // Status badge (small inner dot)
    const badgeColor = isAlive ? '#4ade80' : (isDegraded?'#fbbf24':(n.color==='#ef4444'?'#f87171':'#9ca3af'));
    svg += `<circle cx="${n.x+6}" cy="${n.y-6}" r="3" fill="${badgeColor}" stroke="#0b0f19" stroke-width="1" />`;
    // Degraded warning triangle for degraded nodes
    if (isDegraded) {
      svg += `<text x="${n.x}" y="${n.y-12}" text-anchor="middle" fill="#fbbf24" font-size="8">⚠</text>`;
    }
    // Label
    svg += `<text x="${n.x}" y="${n.y+26}" text-anchor="middle" fill="#9ca3af" font-size="9" font-family="sans-serif">${escapeHtml(n.label)}</text>`;
    // Layer badge
    const layerColors = {core:'#3b82f6', L2:'#f59e0b', L3:'#ec4899'};
    svg += `<text x="${n.x}" y="${n.y+37}" text-anchor="middle" fill="${layerColors[n.kind]||'#6b7280'}" font-size="7" font-family="sans-serif" opacity="0.8">${n.kind.toUpperCase()}</text>`;
    svg += `</g>`;
  }

  svg += '</svg>';
  container.innerHTML = svg;

  // Attach tooltip handlers
  const svgEl = container.querySelector('svg');
  if (svgEl && tooltip) {
    svgEl.addEventListener('mousemove', (e) => {
      const g = e.target.closest('.topo-node');
      if (!g) { tooltip.classList.add('hidden'); return; }
      const label = g.dataset.label;
      const status = g.dataset.status;
      const statusText = status==='running'||status==='online'?'online':(status==='stopped'?'offline':(status==='degraded'?'degraded (dependency down)':status));
      tooltip.innerHTML = `<strong class="text-gray-200">${escapeHtml(label)}</strong><br/><span class="text-gray-400">${escapeHtml(statusText)}</span>`;
      tooltip.classList.remove('hidden');
      const rect = container.getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left) + 'px';
      tooltip.style.top = (e.clientY - rect.top - 8) + 'px';
    });
    svgEl.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
  }
}

// ── Nodes Panel ─────────────────────────────────────────────────────────────
async function refreshNodes(){
  try {
    const data = await fetch('/api/nodes').then(r => r.json());
    renderNodes(data);
  } catch(e) {
    document.getElementById('nodes-container').innerHTML = `<div class="text-red-400 text-sm">Error loading nodes: ${e.message}</div>`;
  }
}

function renderNodes(data){
  const container = document.getElementById('nodes-container');
  if(!container) return;

  const nodes = data.nodes || {};
  const miners = data.miners || {};
  const timestamp = data.timestamp || new Date().toISOString();

  let html = `<div class="text-xs text-gray-500 mb-3">Last scan: ${new Date(timestamp).toLocaleString()}</div>`;

  // Nodes section
  html += `<div class="mb-4"><h3 class="text-sm font-bold text-gray-300 mb-2">🖥️ Nodes</h3>`;
  html += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">`;

  for(const [id, node] of Object.entries(nodes)){
    const statusColor = node.running ? 'text-green-400' : 'text-red-400';
    const statusText = node.running ? '✅ Running' : '❌ Offline';
    const roleBadge = node.role === 'primary' ? 'bg-blue-600' : (node.role === 'backup' ? 'bg-yellow-600' : 'bg-purple-600');
    const connBadge = node.connection === 'tailscale_vpn' ? 'bg-green-700' : 'bg-gray-600';

    html += `
      <div class="bg-gray-800/50 border border-white/10 rounded-lg p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-bold text-gray-200">${node.name}</span>
          <span class="${statusColor} text-xs">${statusText}</span>
        </div>
        <div class="space-y-1 text-xs">
          <div class="flex justify-between">
            <span class="text-gray-400">ID:</span>
            <span class="text-gray-300">${id}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Host:</span>
            <span class="text-gray-300">${node.host}:${node.rpc_port}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Platform:</span>
            <span class="text-gray-300">${node.platform}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Location:</span>
            <span class="text-gray-300">${node.location}</span>
          </div>
          <div class="flex gap-1 mt-2">
            <span class="${roleBadge} text-white px-2 py-0.5 rounded text-[10px]">${node.role}</span>
            <span class="${connBadge} text-white px-2 py-0.5 rounded text-[10px]">${node.connection}</span>
          </div>
          ${node.running ? `
            <div class="mt-2 pt-2 border-t border-white/10">
              <div class="flex justify-between">
                <span class="text-gray-400">Height:</span>
                <span class="text-green-400">${node.chain_height}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Peers:</span>
                <span class="text-gray-300">${node.known_peers}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Version:</span>
                <span class="text-gray-300 text-[10px]">${node.protocol_version || 'N/A'}</span>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  html += `</div></div>`;

  // Miners section
  html += `<div><h3 class="text-sm font-bold text-gray-300 mb-2">⛏️ Miners</h3>`;
  html += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">`;

  for(const [id, miner] of Object.entries(miners)){
    const statusColor = miner.running ? 'text-green-400' : 'text-red-400';
    const statusText = miner.running ? '✅ Running' : '❌ Offline';
    const roleBadge = miner.role === 'pool' ? 'bg-blue-600' : 'bg-orange-600';

    html += `
      <div class="bg-gray-800/50 border border-white/10 rounded-lg p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-bold text-gray-200">${miner.name}</span>
          <span class="${statusColor} text-xs">${statusText}</span>
        </div>
        <div class="space-y-1 text-xs">
          <div class="flex justify-between">
            <span class="text-gray-400">ID:</span>
            <span class="text-gray-300">${id}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Worker:</span>
            <span class="text-gray-300">${miner.worker_name || 'N/A'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Pool:</span>
            <span class="text-gray-300">${miner.pool_addr || 'N/A'}</span>
          </div>
          <div class="flex gap-1 mt-2">
            <span class="${roleBadge} text-white px-2 py-0.5 rounded text-[10px]">${miner.role}</span>
            <span class="bg-gray-600 text-white px-2 py-0.5 rounded text-[10px]">${miner.connection}</span>
          </div>
          ${miner.running ? `
            <div class="mt-2 pt-2 border-t border-white/10">
              ${miner.role === 'pool' ? `
                <div class="flex justify-between">
                  <span class="text-gray-400">Active Sessions:</span>
                  <span class="text-green-400">${miner.active_sessions || 'N/A'}</span>
                </div>
              ` : `
                <div class="flex justify-between">
                  <span class="text-gray-400">Hashrate:</span>
                  <span class="text-green-400">${miner.hashrate ? miner.hashrate.toFixed(2) + ' KH/s' : 'N/A'}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Shares:</span>
                  <span class="text-gray-300">${miner.shares_accepted}/${miner.shares_rejected}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Height:</span>
                  <span class="text-gray-300">${miner.current_height || 'N/A'}</span>
                </div>
              `}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  html += `</div></div>`;
  container.innerHTML = html;
}

// ── Orchestrator Panel ──────────────────────────────────────────────────
async function refreshOrchestrator(){
  try {
    const [status, services] = await Promise.all([
      fetch('/api/orchestrator/status').then(r => r.json()),
      fetch('/api/orchestrator/services').then(r => r.json())
    ]);
    renderOrchestrator(status, services);
  } catch(e) {
    document.getElementById('orchestrator-container').innerHTML = `<div class="text-red-400 text-sm">Error: ${e.message}</div>`;
  }
}

function renderOrchestrator(status, servicesData){
  const container = document.getElementById('orchestrator-container');
  if(!container) return;

  const svcStatus = status.services || {};
  const svcConfig = servicesData.services || {};
  const layers = servicesData.layers || [];

  let html = `<div class="text-xs text-gray-500 mb-3">Last update: ${new Date(status.timestamp).toLocaleString()}</div>`;

  // Summary bar
  const total = Object.keys(svcStatus).length;
  const running = Object.values(svcStatus).filter(s => s.state === 'running').length;
  const stopped = Object.values(svcStatus).filter(s => s.state === 'stopped').length;
  html += `
    <div class="flex gap-4 mb-4 text-xs">
      <div class="bg-gray-800/50 border border-white/10 rounded-lg px-3 py-2">
        <span class="text-gray-400">Total:</span> <span class="text-white font-bold">${total}</span>
      </div>
      <div class="bg-green-900/30 border border-green-500/30 rounded-lg px-3 py-2">
        <span class="text-green-400">Running:</span> <span class="text-green-400 font-bold">${running}</span>
      </div>
      <div class="bg-red-900/30 border border-red-500/30 rounded-lg px-3 py-2">
        <span class="text-red-400">Stopped:</span> <span class="text-red-400 font-bold">${stopped}</span>
      </div>
    </div>
  `;

  // Services by layer
  for(const layer of layers){
    const layerServices = Object.entries(svcStatus).filter(([_, s]) => s.layer === layer);
    if(layerServices.length === 0) continue;

    const layerColors = {
      'L1': 'text-blue-400', 'L2': 'text-purple-400', 'L3': 'text-pink-400',
      'L4': 'text-orange-400', 'L5': 'text-yellow-400', 'L6': 'text-green-400',
      'monitoring': 'text-cyan-400', 'auto-update': 'text-gray-400', 'SDK': 'text-gray-400'
    };
    const layerColor = layerColors[layer] || 'text-gray-400';

    html += `<div class="mb-4"><h3 class="text-sm font-bold ${layerColor} mb-2">${layer}</h3>`;
    html += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">`;

    for(const [name, svc] of layerServices){
      const config = svcConfig[name] || {};
      const isRunning = svc.state === 'running';
      const statusColor = isRunning ? 'text-green-400' : 'text-red-400';
      const statusEmoji = isRunning ? '🟢' : '🔴';
      const ports = Object.entries(svc.ports || {}).map(([k,v]) => `${k}:${v}`).join(', ') || 'N/A';
      const autoRestart = svc.auto_restart ? '♻️' : '';

      html += `
        <div class="bg-gray-800/50 border border-white/10 rounded-lg p-3">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-bold text-gray-200">${name}</span>
            <span class="${statusColor} text-xs">${statusEmoji} ${svc.state}</span>
          </div>
          <div class="space-y-1 text-xs">
            <div class="flex justify-between">
              <span class="text-gray-400">Description:</span>
              <span class="text-gray-300 text-right max-w-[150px] truncate">${config.description || 'N/A'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">PID:</span>
              <span class="text-gray-300">${svc.pid || 'N/A'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Ports:</span>
              <span class="text-gray-300 text-[10px]">${ports}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Auto-restart:</span>
              <span class="text-gray-300">${autoRestart || 'No'}</span>
            </div>
            <div class="flex gap-1 mt-2">
              <button onclick="controlService('${name}', 'start')" class="text-[10px] bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded">▶</button>
              <button onclick="controlService('${name}', 'stop')" class="text-[10px] bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded">⏹</button>
              <button onclick="controlService('${name}', 'restart')" class="text-[10px] bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-0.5 rounded">↻</button>
            </div>
          </div>
        </div>
      `;
    }
    html += `</div></div>`;
  }

  container.innerHTML = html;
}

async function controlService(service, action){
  try {
    const resp = await fetch('/api/orchestrator/' + action, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({service})
    });
    const data = await resp.json();
    alert(data.message || data.error || 'Done');
    refreshOrchestrator();
  } catch(e) {
    alert('Error: ' + e.message);
  }
}

async function startProfile(){
  const select = document.getElementById('orchestrator-profile');
  const profile = select ? select.value : '';
  if(!profile) {
    alert('Please select a profile');
    return;
  }
  if(!confirm('Start all services for profile: ' + profile + '?')) return;
  alert('Profile start not yet implemented in web UI. Use: python3 orchestrator.py start --profile ' + profile);
}

// ── Wire new features into refreshAll ─────────────────────────────────────
const _origRefreshAll = refreshAll;
refreshAll = async function() {
  await _origRefreshAll.apply(this, arguments);
  // R: Readiness score
  await refreshReadiness();
  // C: Service health
  await refreshServiceHealth();
  // N: Nodes panel
  if(currentTab === 'nodes') await refreshNodes();
  // O: Orchestrator panel
  if(currentTab === 'orchestrator') await refreshOrchestrator();
  // F: Topology + service ordering
  let services = [];
  try {
    const svc = await fetch('/api/services').then(r => r.json());
    services = svc.services || [];
    _lastServicesForTimeline = services;
    renderTopology(services);
  } catch(e) { /* silent */ }
  try {
    renderServiceHealthTimeline(services.length ? services : _lastServicesForTimeline);
  } catch(e) { /* silent */ }
  // E: Mempool sparkline (read from existing mempool counter)
  const mpEl = document.getElementById('mempool-tx-count');
  const mpSize = mpEl ? parseInt(mpEl.textContent, 10) || 0 : 0;
  try {
    renderMempoolSparkline(mpSize);
  } catch(e) { console.error('renderMempoolSparkline error:', e); }
  // D: Payout charts (if on payouts tab or always refresh)
  try {
    const pay = await fetch('/api/payout').then(r => r.json());
    if (pay && pay.payouts) {
      renderPayoutDonut(pay.payouts);
      renderPayoutHistory(pay.payouts);
    }
  } catch(e) { /* silent */ }
};

// ════════════════════════════════════════════════════════════════════════
// Bridge UI (Phase 26a)
// ════════════════════════════════════════════════════════════════════════

async function refreshBridgeHistory() {
  const tbody = document.getElementById('bridge-history-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-gray-500 italic text-center">Loading bridge history…</td></tr>';
  try {
    const res = await fetch('/api/bridge/history').then(r => r.json());
    if (res.transfers && res.transfers.length > 0) {
      let html = '';
      for (const tx of res.transfers) {
        const statusColor = tx.status === 'completed' ? 'text-emerald-400' : (tx.status === 'pending' ? 'text-amber-400' : 'text-red-400');
        html += `<tr class="border-b border-white/5">
          <td class="py-2 px-2 font-mono text-[10px]"><a href="${tx.explorer_url || '#'}" target="_blank" class="text-blue-400 hover:underline">${tx.tx_hash ? tx.tx_hash.substring(0,18)+'…' : '—'}</a></td>
          <td class="py-2 px-2">${escapeHtml(tx.from_chain || '—')}</td>
          <td class="py-2 px-2">${escapeHtml(tx.to_chain || '—')}</td>
          <td class="py-2 px-2 text-right font-mono">${tx.amount || '—'}</td>
          <td class="py-2 px-2 text-center ${statusColor}">${tx.status || 'unknown'}</td>
          <td class="py-2 px-2 text-gray-400">${tx.timestamp || '—'}</td>
        </tr>`;
      }
      tbody.innerHTML = html;
    } else {
      tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-gray-500 italic text-center">No bridge transfers recorded yet. Start the bridge relay to see activity.</td></tr>';
    }
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-red-400 text-center">Error loading history: ' + escapeHtml(e.message) + '</td></tr>';
  }
}

async function loadBridgeStats() {
  try {
    const status = await fetch('/api/bridge/status').then(r => r.json());
    const badge = document.getElementById('bridge-status-badge');
    if (badge) {
      if (status.online) {
        badge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
        badge.textContent = '● Online';
      } else {
        badge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30';
        badge.textContent = '● Offline';
      }
    }
    const lastBlock = document.getElementById('bridge-last-block');
    if (lastBlock) lastBlock.textContent = status.last_block || '—';
    const volume = document.getElementById('bridge-total-volume');
    if (volume) volume.textContent = status.total_volume ? status.total_volume.toLocaleString() : '—';
    const pending = document.getElementById('bridge-pending');
    if (pending) pending.textContent = status.pending_count !== undefined ? status.pending_count : '—';
    const validators = document.getElementById('bridge-validators');
    if (validators) validators.textContent = status.validators_online !== undefined ? status.validators_online + '/5' : '—';
    const contract = document.getElementById('bridge-contract');
    if (contract) contract.textContent = status.contract_verified ? '✓ Yes' : '○ No';
  } catch (e) {
    console.warn('Bridge stats load failed:', e);
  }
}

// ── Genesis Backup/Restore ──
async function loadGenesisBackupList(){
  try{
    const res=await fetch('/api/genesis-backup?action=list').then(r=>r.json());
    const listEl=document.getElementById('genesis-backup-list');
    
    if(res.success && res.backups.length>0){
      let html='';
      res.backups.forEach(backup=>{
        html+=`<div class="flex items-center justify-between bg-black/40 rounded p-2 text-xs border border-white/5">
          <div>
            <div class="font-bold text-emerald-400">${escapeHtml(backup.name)}</div>
            <div class="text-gray-400">📅 ${backup.timestamp} | 🔗 ${backup.genesis_hash?backup.genesis_hash.substring(0,8)+'…':'N/A'}</div>
          </div>
          <div class="text-right">
            <div class="text-purple-400">${backup.wallet_count} wallets</div>
            <div class="text-gray-500">${backup.size_kb} KB | 🔄 ${backup.redundancy}</div>
          </div>
        </div>`;
      });
      listEl.innerHTML=html;
    }else{
      listEl.innerHTML='<div class="text-xs text-gray-500 italic">Žádné zálohy nenalezeny. Vytvořte svou první zálohu.</div>';
    }
  }catch(e){
    console.error('Failed to load genesis backup list:',e);
    document.getElementById('genesis-backup-list').innerHTML='<div class="text-xs text-red-400">Nepodařilo se načíst zálohy</div>';
  }
}

async function genesisBackupAction(action){
  const details=document.getElementById('genesis-backup-details');
  details.innerHTML='<div class="text-blue-400">⏳ Zpracuji...</div>';
  
  try{
    if(action==='list'){
      loadGenesisBackupList();
      details.innerHTML='<div class="text-emerald-400">✅ Seznam záloh aktualizován</div>';
    }else if(action==='create'){
      const res=await fetch('/api/genesis-backup?action=create').then(r=>r.json());
      
      if(res.success){
        let html=`<div class="text-emerald-400 mb-2">✅ Záloha úspěšně vytvořena</div>`;
        html+=`<div class="text-gray-400">📁 Umístění: ${escapeHtml(res.backup_path)}</div>`;
        html+=`<div class="text-gray-400">🔑 Wallets: ${res.wallet_count}</div>`;
        html+=`<div class="text-gray-400">🔄 Redundance: ${escapeHtml(res.redundancy)}</div>`;
        html+=`<div class="text-gray-400">📊 Metadata: ${JSON.stringify(res.metadata, null, 2)}</div>`;
        details.innerHTML=html;
        loadGenesisBackupList();
      }else{
        details.innerHTML='<div class="text-red-400">❌ Chyba: '+escapeHtml(res.error)+'</div>';
      }
    }else if(action==='restore'){
      // Prompt for backup path
      const backupPath=prompt('Zadejte cestu k záloze (např. C:/Users/yosef/Desktop/Zion/2.9.6-main/backups/genesis-backup-20260603_120000):');
      if(!backupPath){
        details.innerHTML='<div class="text-amber-400">⚠️ Obnova zrušena</div>';
        return;
      }
      
      const password=prompt('Zadejte heslo (volitelné - stiskněte Enter pro žádné):');
      const res=await fetch('/api/genesis-backup?action=restore&backup_path='+encodeURIComponent(backupPath)+'&password='+encodeURIComponent(password||'')).then(r=>r.json());
      
      if(res.success){
        let html=`<div class="text-emerald-400 mb-2">✅ Záloha úspěšně obnovena</div>`;
        html+=`<div class="text-gray-400">🔗 Genesis Hash: ${res.genesis_hash?res.genesis_hash.substring(0,8)+'…':'N/A'}</div>`;
        html+=`<div class="text-gray-400">📅 Timestamp zálohy: ${res.backup_timestamp}</div>`;
        html+=`<div class="text-gray-400">📁 Obnovené soubory: ${res.restored_files.length}</div>`;
        if(res.errors.length>0){
          html+='<div class="text-amber-400 mt-2">⚠️ Chyby:</div><ul class="list-disc ml-2">';
          res.errors.forEach(err=>html+=`<li>${escapeHtml(err)}</li>`);
          html+='</ul>';
        }
        details.innerHTML=html;
      }else{
        details.innerHTML='<div class="text-red-400">❌ Chyba: '+escapeHtml(res.error)+'</div>';
      }
    }else if(action==='delete'){
      // Prompt for backup path
      const backupPath=prompt('Zadejte cestu k záloze pro smazání:');
      if(!backupPath){
        details.innerHTML='<div class="text-amber-400">⚠️ Smazání zrušeno</div>';
        return;
      }
      
      if(!confirm('Opravdu chcete smazat tuto zálohu? Tato akce nelze vrátit zpět.')){
        details.innerHTML='<div class="text-amber-400">⚠️ Smazání zrušeno</div>';
        return;
      }
      
      const res=await fetch('/api/genesis-backup?action=delete&backup_path='+encodeURIComponent(backupPath)).then(r=>r.json());
      
      if(res.success){
        details.innerHTML='<div class="text-emerald-400">✅ '+escapeHtml(res.message)+'</div>';
        loadGenesisBackupList();
      }else{
        details.innerHTML='<div class="text-red-400">❌ Chyba: '+escapeHtml(res.error)+'</div>';
      }
    }
  }catch(e){
    console.error('Genesis backup action failed:',e);
    details.innerHTML='<div class="text-red-400">❌ Chyba: '+escapeHtml(e.message)+'</div>';
  }
}

// Bridge hook merged into switchTab directly

// Keyboard shortcut: 'b' for bridge
(function() {
  const _origMap = {
    '1': 'overview', '2': 'l1', '3': 'l2', '4': 'l3', '5': 'l4', '6': 'l5', '7': 'l6',
    'o': 'overview', 'c': 'controls', 'e': 'explorer', 'w': 'wallets', 'a': 'alerts',
    't': 'topology', 'p': 'ops', 'h': 'hiran', 'g': 'charts',
  };
  document.addEventListener('keydown', function(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
    const key = e.key.toLowerCase();
    if (key === 'b' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      switchTab('bridge');
      e.preventDefault();
    }
  });
})();

console.log('[ZION Dashboard] Auto-refresh started');
loadMinerConfig();

// ═════════ ZION Agent Panel ═════════

async function refreshAgentPanel(){
  const statusBadge = document.getElementById('agent-status-badge');
  if(statusBadge) statusBadge.textContent = 'Checking…';
  try{
    // Status
    const status = await fetch('/api/agent/status').then(r => r.json());
    if(!status._error){
      if(statusBadge){
        statusBadge.textContent = 'Online';
        statusBadge.className = 'text-xs px-2 py-1 rounded bg-emerald-700 text-white';
      }
      const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v ?? '—'; };
      set('agent-kpi-mode', status.mode);
      set('agent-kpi-miner', status.miner_running ? 'Running' : 'Stopped');
      set('agent-kpi-gpus', status.gpu_count ?? 0);
      set('agent-kpi-rig', status.rig_id);
      set('agent-kpi-version', status.version);
    }else{
      if(statusBadge){
        statusBadge.textContent = 'Offline';
        statusBadge.className = 'text-xs px-2 py-1 rounded bg-red-700 text-white';
      }
    }
    // Telemetry
    const telem = await fetch('/api/agent/telemetry').then(r => r.json());
    const poolEl = document.getElementById('agent-telemetry-pool');
    if(poolEl && !telem._error){
      poolEl.innerHTML = `
        <div class="flex justify-between"><span class="text-gray-400">Pool:</span><span class="text-white font-mono">${telem.miner?.pool ?? '—'}</span></div>
        <div class="flex justify-between"><span class="text-gray-400">Backend:</span><span class="text-white">${telem.miner?.backend ?? '—'}</span></div>
        <div class="flex justify-between"><span class="text-gray-400">Telemetry:</span><span class="text-white">${telem.telemetry_enabled ? 'Enabled' : 'Disabled'}</span></div>
      `;
    }else if(poolEl){
      poolEl.innerHTML = '<div class="text-gray-500">Agent telemetry unavailable</div>';
    }
    // GPU
    const gpu = await fetch('/api/agent/gpu').then(r => r.json());
    const gpuEl = document.getElementById('agent-gpu-list');
    if(gpuEl && !gpu._error && gpu.gpus){
      if(gpu.gpus.length === 0){
        gpuEl.innerHTML = '<div class="text-gray-500">No GPUs detected</div>';
      }else{
        gpuEl.innerHTML = gpu.gpus.map((g, i) => `
          <div class="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2">
            <div>
              <div class="text-xs font-semibold text-gray-200">${escapeHtml(g.name || `GPU ${i}`)}</div>
              <div class="text-[10px] text-gray-500">${escapeHtml(g.vendor || '')} · ${escapeHtml(g.memory || '')}</div>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-full ${g.temperature && g.temperature > 80 ? 'bg-red-700/50 text-red-300' : 'bg-emerald-700/50 text-emerald-300'}">${g.temperature ? g.temperature + '°C' : 'N/A'}</span>
          </div>
        `).join('');
      }
    }else if(gpuEl){
      gpuEl.innerHTML = '<div class="text-gray-500">GPU telemetry unavailable</div>';
    }
    // Discovered nodes (reuse existing function but target this panel)
    const disc = await fetch('/api/agent/nodes').then(r => r.json());
    const discEl = document.getElementById('agent-discovered-list');
    if(discEl){
      if(disc._error || !disc.nodes || disc.nodes.length === 0){
        discEl.innerHTML = '<div class="text-gray-500">No new nodes discovered yet. The agent scans every 60 seconds.</div>';
      }else{
        let html = `<div class="text-xs text-gray-500 mb-2">Discovered ${disc.nodes.length} node(s)</div>`;
        html += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">`;
        for(const node of disc.nodes){
          const statusColor = node.synced_with_edge ? 'text-emerald-400' : (node.needs_help ? 'text-amber-400' : 'text-gray-400');
          const statusText = node.synced_with_edge ? 'Synced' : (node.needs_help ? 'Needs help' : 'Idle');
          html += `
            <div class="bg-black/30 rounded-lg p-3 border border-white/5">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-bold text-gray-200">${node.id}</span>
                <span class="${statusColor} text-[10px]">${statusText}</span>
              </div>
              <div class="text-[10px] text-gray-400">${node.ip}:${node.rpc_port} · height ${node.chain_height} · peers ${node.peers}</div>
            </div>
          `;
        }
        html += `</div>`;
        discEl.innerHTML = html;
      }
    }
    // Rewards
    const rewards = await fetch('/api/agent/rewards').then(r => r.json());
    const rewEl = document.getElementById('agent-rewards-list');
    if(rewEl){
      if(rewards._error || !rewards.rewards || rewards.rewards.length === 0){
        rewEl.innerHTML = '<div class="text-gray-500">No rewards yet. Help new nodes sync to earn points!</div>';
      }else{
        let html = `<div class="flex items-center gap-4 mb-2">`;
        html += `<div class="bg-black/30 rounded-lg p-2 text-center flex-1"><div class="text-lg font-bold text-zion-gold">${rewards.total_points || 0}</div><div class="text-[10px] text-gray-400">Total Points</div></div>`;
        html += `<div class="bg-black/30 rounded-lg p-2 text-center flex-1"><div class="text-lg font-bold text-zion-cyan">${rewards.adoptions || 0}</div><div class="text-[10px] text-gray-400">Adoptions</div></div>`;
        html += `</div>`;
        for(const r of rewards.rewards){
          html += `
            <div class="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2 text-xs">
              <div class="flex items-center gap-2">
                <span class="text-zion-gold font-bold">+${r.reward_points}</span>
                <span class="text-gray-300">${escapeHtml(r.description)}</span>
              </div>
              <span class="text-gray-500">${new Date(r.adopted_at * 1000).toLocaleString()}</span>
            </div>
          `;
        }
        rewEl.innerHTML = html;
      }
    }
  }catch(e){
    if(statusBadge){
      statusBadge.textContent = 'Error';
      statusBadge.className = 'text-xs px-2 py-1 rounded bg-red-700 text-white';
    }
    console.error('Agent panel refresh failed:', e);
  }
}

async function agentControl(action){
  try{
    const r = await fetch('/api/agent/control', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action})
    });
    const d = await r.json();
    alert(d.status === 'ok' ? 'Command sent: ' + action : 'Error: ' + (d.message || d.error));
    refreshAgentPanel();
  }catch(e){
    alert('Agent control failed: ' + e.message);
  }
}

// ═════════ Miner Live Panel ═════════

let _mlHashrateHistory = [];
let _mlHashrateChart = null;

async function refreshMinerLive(){
  const badge = document.getElementById('miner-live-badge');
  if(badge) badge.textContent = 'Refreshing…';
  try{
    const [stats, logTail] = await Promise.all([
      fetch('/api/miner/live').then(r => r.json()),
      fetch('/api/miner/log-tail?lines=20').then(r => r.json()),
    ]);
    const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v ?? '—'; };
    set('ml-hashrate', stats.hashrate ? stats.hashrate.toFixed(2) : '—');
    set('ml-accepted', stats.shares_accepted ?? 0);
    set('ml-rejected', stats.shares_rejected ?? 0);
    set('ml-height', stats.current_height ?? '—');
    set('ml-backend', stats.gpu_backend?.toUpperCase() ?? 'CPU');
    if(badge){
      badge.textContent = stats.running ? 'Running' : 'Stopped';
      badge.className = 'text-xs px-2 py-1 rounded ' + (stats.running ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white');
    }
    // GPU cards
    const gpuContainer = document.getElementById('ml-gpu-cards');
    if(gpuContainer){
      if(!stats.gpus || stats.gpus.length === 0){
        gpuContainer.innerHTML = '<div class="text-gray-500 text-xs col-span-full">No GPUs detected (CPU mode)</div>';
      }else{
        gpuContainer.innerHTML = stats.gpus.map((g, i) => `
          <div class="bg-black/30 rounded-lg p-3 border border-white/5">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-bold text-gray-200">${escapeHtml(g.name || `GPU ${i}`)}</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full ${g.temperature && g.temperature > 80 ? 'bg-red-700/50 text-red-300' : 'bg-emerald-700/50 text-emerald-300'}">${g.temperature ? g.temperature + '°C' : 'N/A'}</span>
            </div>
            <div class="text-[10px] text-gray-400">${escapeHtml(g.vendor || '')} · ${escapeHtml(g.memory || '')}</div>
            ${g.utilization ? `<div class="mt-1"><div class="h-1 bg-white/10 rounded-full"><div class="h-1 bg-zion-gold rounded-full" style="width:${g.utilization}%"></div></div><div class="text-[10px] text-gray-500 mt-0.5">Util: ${g.utilization}%</div></div>` : ''}
          </div>
        `).join('');
      }
    }
    // Pool info
    const poolEl = document.getElementById('ml-pool-info');
    if(poolEl){
      poolEl.innerHTML = `
        <div class="flex justify-between"><span class="text-gray-400">Pool:</span><span class="text-white font-mono">${stats.pool_addr ?? '—'}</span></div>
        <div class="flex justify-between"><span class="text-gray-400">Worker:</span><span class="text-white">${stats.worker_name ?? '—'}</span></div>
        <div class="flex justify-between"><span class="text-gray-400">Device:</span><span class="text-white">${stats.gpu_device ?? 'CPU'}</span></div>
        <div class="flex justify-between"><span class="text-gray-400">Difficulty:</span><span class="text-white">${stats.current_diff ?? '—'}</span></div>
      `;
    }
    // Log tail
    const logEl = document.getElementById('ml-log-tail');
    if(logEl && logTail.lines){
      logEl.innerHTML = logTail.lines.map(l => `<div class="truncate">${escapeHtml(l)}</div>`).join('');
      logEl.scrollTop = logEl.scrollHeight;
    }
    // Hashrate chart history
    if(stats.hashrate){
      _mlHashrateHistory.push(stats.hashrate);
      if(_mlHashrateHistory.length > 60) _mlHashrateHistory.shift();
      renderMinerLiveChart();
    }
  }catch(e){
    if(badge){ badge.textContent = 'Error'; badge.className = 'text-xs px-2 py-1 rounded bg-red-700 text-white'; }
    console.error('Miner live refresh failed:', e);
  }
}

function renderMinerLiveChart(){
  const ctx = document.getElementById('ml-hashrate-chart');
  if(!ctx) return;
  if(_mlHashrateChart){ _mlHashrateChart.destroy(); }
  _mlHashrateChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: _mlHashrateHistory.map((_, i) => i),
      datasets: [{
        label: 'KH/s',
        data: _mlHashrateHistory,
        borderColor: 'rgba(255, 215, 0, 0.8)',
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', font: { size: 9 } } }
      }
    }
  });
}

// ═════════ Settings Panel ═════════

async function loadSettingsIntoForm(){
  try{
    const s = await fetch('/api/settings/load').then(r => r.json());
    const mining = s.mining || {};
    const node = s.node || {};
    const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v ?? ''; };
    setVal('st-pool-addr', mining.pool_addr);
    setVal('st-worker', mining.worker_name);
    setVal('st-backend', mining.backend);
    setVal('st-threads', mining.threads);
    setVal('st-loop-count', mining.loop_count);
    setVal('st-work-size', mining.work_size);
    setVal('st-seed-peers', node.seed_peers);
    setVal('st-rpc-bind', node.rpc_bind);
    setVal('st-p2p-bind', node.p2p_bind);
    setVal('st-node-id', node.node_id);
    const topoSel = document.getElementById('st-topology');
    if(topoSel) topoSel.value = s.topology || 'edge-primary';
  }catch(e){ console.error('Load settings failed:', e); }
}

async function saveMiningSettings(){
  const msg = document.getElementById('st-mining-msg');
  if(msg) msg.textContent = 'Saving…';
  try{
    const payload = {
      mining: {
        pool_addr: document.getElementById('st-pool-addr')?.value,
        worker_name: document.getElementById('st-worker')?.value,
        backend: document.getElementById('st-backend')?.value,
        threads: parseInt(document.getElementById('st-threads')?.value || '2'),
        loop_count: parseInt(document.getElementById('st-loop-count')?.value || '1000000'),
        work_size: parseInt(document.getElementById('st-work-size')?.value || '4096'),
      },
      node: {
        seed_peers: document.getElementById('st-seed-peers')?.value,
        rpc_bind: document.getElementById('st-rpc-bind')?.value,
        p2p_bind: document.getElementById('st-p2p-bind')?.value,
        node_id: document.getElementById('st-node-id')?.value,
      },
      topology: document.getElementById('st-topology')?.value || 'edge-primary',
    };
    const r = await fetch('/api/settings/save', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    const d = await r.json();
    if(msg) msg.textContent = d.ok ? 'Saved.' : 'Error: ' + (d.error || '');
  }catch(e){ if(msg) msg.textContent = 'Error: ' + e.message; }
}

async function applyMiningSettings(){
  await saveMiningSettings();
  alert('Settings saved. Restart the miner via the Agent tab or Controls to apply changes.');
}

async function saveNodeSettings(){
  await saveMiningSettings(); // same endpoint saves everything
  const msg = document.getElementById('st-node-msg');
  if(msg) msg.textContent = 'Saved.';
}

async function applyNodeSettings(){
  await saveNodeSettings();
  alert('Node settings saved. Restart the node to apply changes.');
}

async function saveTopology(){
  const topo = document.getElementById('st-topology')?.value;
  const msg = document.getElementById('st-topo-msg');
  if(msg) msg.textContent = 'Switching…';
  try{
    const r = await fetch('/api/config', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({topology: topo})});
    const d = await r.json();
    if(msg) msg.textContent = d.ok ? d.message : 'Error: ' + (d.error || '');
  }catch(e){ if(msg) msg.textContent = 'Error: ' + e.message; }
}

// ═════════ Fleet View ═════════

async function refreshFleet(){
  const tbody = document.getElementById('fleet-table-body');
  if(!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="text-gray-500 text-center py-4">Loading rigs…</td></tr>';
  try{
    const data = await fetch('/api/fleet/rigs').then(r => r.json());
    const rigs = data.rigs || [];
    let totalHashrate = 0;
    let onlineCount = 0;
    let totalGpus = 0;
    // Try to fetch live data for each rig
    const rigRows = [];
    for(const rig of rigs){
      let status = 'checking';
      let mode = '—';
      let miner = '—';
      let hashrate = '—';
      let gpus = '—';
      try{
        const r = await fetch(rig.agent_url + '/api/status', {signal: AbortSignal.timeout(3000)}).then(r => r.json());
        if(!r._error){
          status = 'online';
          mode = r.mode;
          miner = r.miner_running ? 'Running' : 'Stopped';
          onlineCount++;
        }
      }catch(_){ status = 'offline'; }
      try{
        const g = await fetch(rig.agent_url + '/api/gpu', {signal: AbortSignal.timeout(3000)}).then(r => r.json());
        if(!g._error && g.gpus){
          gpus = g.gpus.length;
          totalGpus += g.gpus.length;
        }
      }catch(_){}
      rigRows.push({rig, status, mode, miner, hashrate, gpus});
    }
    // Update KPIs
    const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
    set('fl-total', rigs.length);
    set('fl-online', onlineCount);
    set('fl-hashrate', totalHashrate.toFixed(2));
    set('fl-gpus', totalGpus);
    // Render table
    if(rigRows.length === 0){
      tbody.innerHTML = '<tr><td colspan="7" class="text-gray-500 text-center py-4">No rigs configured. Click "Add Rig" to start.</td></tr>';
    }else{
      tbody.innerHTML = rigRows.map(({rig, status, mode, miner, hashrate, gpus}) => `
        <tr class="border-b border-white/5 hover:bg-white/5 transition">
          <td class="py-2 px-2">
            <div class="text-xs font-bold text-gray-200">${escapeHtml(rig.name || rig.id)}</div>
            <div class="text-[10px] text-gray-500 font-mono">${escapeHtml(rig.id)}</div>
          </td>
          <td class="py-2 px-2"><span class="text-[10px] px-2 py-0.5 rounded-full ${status==='online'?'bg-emerald-700/50 text-emerald-300':'bg-red-700/50 text-red-300'}">${status}</span></td>
          <td class="py-2 px-2 text-gray-300">${mode}</td>
          <td class="py-2 px-2 text-gray-300">${miner}</td>
          <td class="py-2 px-2 text-right text-gray-300">${hashrate}</td>
          <td class="py-2 px-2 text-right text-gray-300">${gpus}</td>
          <td class="py-2 px-2 text-right">
            <button onclick="removeFleetRig('${escapeHtml(rig.id)}')" class="text-[10px] text-red-400 hover:text-red-300">Remove</button>
          </td>
        </tr>
      `).join('');
    }
  }catch(e){
    tbody.innerHTML = `<tr><td colspan="7" class="text-red-400 text-center py-4">Error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

function addFleetRig(){
  const form = document.getElementById('fleet-add-form');
  if(form) form.classList.remove('hidden');
}

async function saveFleetRig(){
  const id = document.getElementById('fl-new-id')?.value?.trim();
  const addr = document.getElementById('fl-new-addr')?.value?.trim();
  const name = document.getElementById('fl-new-name')?.value?.trim();
  if(!id || !addr){ alert('Rig ID and Agent URL are required'); return; }
  try{
    const r = await fetch('/api/fleet/add', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id, agent_url: addr, name: name || id})});
    const d = await r.json();
    if(d.ok){
      document.getElementById('fleet-add-form')?.classList.add('hidden');
      document.getElementById('fl-new-id').value = '';
      document.getElementById('fl-new-addr').value = '';
      document.getElementById('fl-new-name').value = '';
      refreshFleet();
    }else{
      alert('Error: ' + (d.error || ''));
    }
  }catch(e){ alert('Error: ' + e.message); }
}

async function removeFleetRig(rigId){
  if(!confirm('Remove rig ' + rigId + '?')) return;
  try{
    const r = await fetch('/api/fleet/remove', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({rig_id: rigId})});
    const d = await r.json();
    if(d.ok) refreshFleet();
    else alert('Error: ' + (d.error || ''));
  }catch(e){ alert('Error: ' + e.message); }
}

// Agent/fleet/settings hooks merged into switchTab directly

// ═════════ Agent Node Discovery & Rewards ═════════

async function refreshAgentNodes(){
  const container = document.getElementById('agent-nodes-container');
  if(!container) return;
  container.innerHTML = '<div class="text-gray-400 text-sm">Scanning agent...</div>';
  try{
    const data = await fetch('/api/agent/nodes').then(r => r.json());
    if(data._error){
      container.innerHTML = `<div class="text-amber-400 text-sm">Agent offline — ${escapeHtml(data._error)}</div>`;
      return;
    }
    const nodes = data.nodes || [];
    if(nodes.length === 0){
      container.innerHTML = '<div class="text-gray-400 text-sm">No new nodes discovered yet. The agent scans every 60 seconds.</div>';
      return;
    }
    let html = `<div class="text-xs text-gray-500 mb-2">Discovered ${nodes.length} node(s)</div>`;
    html += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">`;
    for(const node of nodes){
      const statusColor = node.synced_with_edge ? 'text-emerald-400' : (node.needs_help ? 'text-amber-400' : 'text-gray-400');
      const statusText = node.synced_with_edge ? '✅ Synced' : (node.needs_help ? '⚠️ Needs help' : '⏳ Idle');
      html += `
        <div class="bg-gray-800/50 border border-white/10 rounded-lg p-3">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-bold text-gray-200">${node.id}</span>
            <span class="${statusColor} text-xs">${statusText}</span>
          </div>
          <div class="space-y-1 text-xs">
            <div class="flex justify-between"><span class="text-gray-400">IP:</span><span class="text-gray-300 font-mono">${node.ip}:${node.rpc_port}</span></div>
            <div class="flex justify-between"><span class="text-gray-400">Height:</span><span class="text-gray-300">${node.chain_height}</span></div>
            <div class="flex justify-between"><span class="text-gray-400">Peers:</span><span class="text-gray-300">${node.peers}</span></div>
            <div class="flex justify-between"><span class="text-gray-400">First seen:</span><span class="text-gray-300">${new Date(node.discovered_at * 1000).toLocaleString()}</span></div>
            ${node.reward_claimed ? '<div class="mt-1 text-[10px] text-emerald-400">🏆 Reward claimed</div>' : ''}
          </div>
        </div>
      `;
    }
    html += `</div>`;
    container.innerHTML = html;
  }catch(e){
    container.innerHTML = `<div class="text-red-400 text-sm">Error loading agent nodes: ${escapeHtml(e.message)}</div>`;
  }
}

async function refreshAgentRewards(){
  const container = document.getElementById('agent-rewards-container');
  if(!container) return;
  container.innerHTML = '<div class="text-gray-400 text-sm">Loading rewards...</div>';
  try{
    const data = await fetch('/api/agent/rewards').then(r => r.json());
    if(data._error){
      container.innerHTML = `<div class="text-amber-400 text-sm">Agent offline — ${escapeHtml(data._error)}</div>`;
      return;
    }
    const rewards = data.rewards || [];
    const total = data.total_points || 0;
    const adoptions = data.adoptions || 0;
    let html = `<div class="flex items-center gap-4 mb-3">`;
    html += `<div class="zion-panel-soft p-3 text-center flex-1"><div class="text-2xl font-bold text-zion-gold">${total}</div><div class="text-[10px] text-gray-400">Total Points</div></div>`;
    html += `<div class="zion-panel-soft p-3 text-center flex-1"><div class="text-2xl font-bold text-zion-cyan">${adoptions}</div><div class="text-[10px] text-gray-400">Adoptions</div></div>`;
    html += `</div>`;
    if(rewards.length === 0){
      html += '<div class="text-gray-400 text-sm">No rewards yet. Run the agent and help new nodes sync!</div>';
    }else{
      html += `<div class="space-y-2">`;
      for(const r of rewards){
        html += `
          <div class="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2 text-xs">
            <div class="flex items-center gap-2">
              <span class="text-zion-gold font-bold">+${r.reward_points}</span>
              <span class="text-gray-300">${escapeHtml(r.description)}</span>
            </div>
            <span class="text-gray-500">${new Date(r.adopted_at * 1000).toLocaleString()}</span>
          </div>
        `;
      }
      html += `</div>`;
    }
    container.innerHTML = html;
  }catch(e){
    container.innerHTML = `<div class="text-red-400 text-sm">Error loading rewards: ${escapeHtml(e.message)}</div>`;
  }
}

// ── Edge Backup Widget ───────────────────────────────────────────────

async function loadEdgeBackupStatus() {
  try {
    const res = await fetch('/api/backup/status', { cache: 'no-store' });
    const data = await res.json();
    const hasBackups = data.backups && data.backups.length > 0;
    const lastBackup = data.last_backup ? new Date(data.last_backup).toLocaleString() : 'None';
    const totalSize = data.total_backup_mb || 0;

    // Update UI
    const badge = document.getElementById('edge-backup-badge');
    const timerDot = document.getElementById('edge-backup-timer-dot');
    const timerStatus = document.getElementById('edge-backup-timer-status');
    const latest = document.getElementById('edge-backup-latest');
    const count = document.getElementById('edge-backup-count');
    const totalSizeEl = document.getElementById('edge-backup-total-size');

    if (badge) {
      if (hasBackups) {
        badge.textContent = 'Active';
        badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-300';
      } else {
        badge.textContent = 'No Backups';
        badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-amber-600/20 text-amber-300';
      }
    }
    if (timerDot) timerDot.className = 'w-2 h-2 rounded-full ' + (hasBackups ? 'bg-emerald-400' : 'bg-amber-400');
    if (timerStatus) timerStatus.textContent = hasBackups ? 'Timer active' : 'Timer active, no backups yet';
    if (latest) latest.textContent = lastBackup;
    if (count) count.textContent = (data.backups ? data.backups.length : 0) + ' files';
    if (totalSizeEl) totalSizeEl.textContent = totalSize.toFixed(1) + ' MB';
  } catch (e) {
    console.log('Edge backup status unavailable:', e);
    const badge = document.getElementById('edge-backup-badge');
    const timerStatus = document.getElementById('edge-backup-timer-status');
    if (badge) { badge.textContent = 'Unavailable'; badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-red-600/20 text-red-300'; }
    if (timerStatus) timerStatus.textContent = 'Dashboard not reachable';
  }
}

async function applyEdgeMemoryLimit(){
  if(!confirm('🔒 Apply Memory Limit\n\nThis will add MemoryMax=3G to zion-edge-node1.service and reload systemd.\nNode will restart if it exceeds 3 GB RAM.\n\nContinue?')) return;
  const btn = document.getElementById('btn-edge-mem-limit');
  if(btn) { btn.disabled = true; btn.textContent = '⏳ Applying…'; }
  try {
    const res = await fetch('/api/edge-action', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action: 'memory-limit'})
    });
    const data = await res.json();
    toast(data.ok ? 'Memory limit applied. Node will restart if >3G.' : 'Failed: ' + (data.error || ''), data.ok ? 'success' : 'error');
    setTimeout(() => refreshEdgeServerCard(true), 3000);
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  } finally {
    if(btn) { btn.disabled = false; btn.textContent = '🔒 Limit RAM'; }
  }
}

async function triggerEdgeBackup() {
  const btn = document.getElementById('btn-trigger-edge-backup');
  const log = document.getElementById('edge-backup-log');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '⏳ Running…';
  if (log) { log.classList.remove('hidden'); log.textContent = 'Triggering Edge backup…\n'; }
  try {
    const res = await fetch('/api/backup/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'manual-dashboard-' + new Date().toISOString().slice(0,19).replace(/:/g,'-') })
    });
    const data = await res.json();
    if (log) {
      log.textContent += (data.ok ? '✅ Backup created successfully.\n' : '❌ Backup failed: ' + (data.error || data.output || 'Unknown') + '\n');
    }
    // Refresh status after a short delay
    setTimeout(loadEdgeBackupStatus, 2000);
  } catch (e) {
    if (log) log.textContent += '❌ Error: ' + e.message + '\n';
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Trigger Backup Now';
  }
}

// Nodes hook merged into switchTab directly

// ── L3 Native Panels ─────────────────────────────────────────────

async function loadWarpPanel(){
  try {
    const [chains, transfers] = await Promise.allSettled([
      fetch('/api/l3/warp/chains').then(r => r.json()),
      fetch('/api/l3/warp/transfers').then(r => r.json())
    ]);
    const chainsData = chains.status === 'fulfilled' ? chains.value : [];
    const transfersData = transfers.status === 'fulfilled' ? transfers.value : [];

    const chainsBody = document.getElementById('warp-chains-body');
    if(chainsBody){
      if(Array.isArray(chainsData) && chainsData.length){
        chainsBody.innerHTML = chainsData.map(c => `
          <tr class="border-b border-white/5 hover:bg-white/5">
            <td class="py-2 px-2 font-mono text-emerald-400">${escapeHtml(c.chain_id || c.id || '—')}</td>
            <td class="py-2 px-2">${escapeHtml(c.name || '—')}</td>
            <td class="py-2 px-2 text-right">${escapeHtml(c.status || '—')}</td>
          </tr>`).join('');
      } else {
        chainsBody.innerHTML = '<tr><td colspan="3" class="py-4 text-gray-500 italic text-center">No chains connected.</td></tr>';
      }
    }

    const transfersBody = document.getElementById('warp-transfers-body');
    if(transfersBody){
      if(Array.isArray(transfersData) && transfersData.length){
        transfersBody.innerHTML = transfersData.map(t => `
          <tr class="border-b border-white/5 hover:bg-white/5">
            <td class="py-2 px-2 font-mono text-cyan-400">${escapeHtml(t.tx_id || t.id || '—')}</td>
            <td class="py-2 px-2">${escapeHtml(t.from_chain || '—')}</td>
            <td class="py-2 px-2">${escapeHtml(t.to_chain || '—')}</td>
            <td class="py-2 px-2 text-right">${escapeHtml(t.amount !== undefined ? t.amount : '—')}</td>
            <td class="py-2 px-2 text-center">${escapeHtml(t.status || '—')}</td>
          </tr>`).join('');
      } else {
        transfersBody.innerHTML = '<tr><td colspan="5" class="py-4 text-gray-500 italic text-center">No transfers yet.</td></tr>';
      }
    }
  } catch(e){
    console.warn('WARP panel load failed:', e);
  }
}

async function loadAiAgentsPanel(){
  try {
    const res = await fetch('/api/l3/ai/agents').then(r => r.json());
    const data = Array.isArray(res) ? res : (res.agents || []);
    const tbody = document.getElementById('ai-agents-body');
    if(!tbody) return;
    if(data.length){
      tbody.innerHTML = data.map(a => {
        const consciousness = Math.max(0, Math.min(100, a.consciousness || 0));
        return `
          <tr class="border-b border-white/5 hover:bg-white/5">
            <td class="py-2 px-2 font-mono text-purple-400">${escapeHtml(a.id || a.agent_id || '—')}</td>
            <td class="py-2 px-2">${escapeHtml(a.name || '—')}</td>
            <td class="py-2 px-2">
              <div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div class="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400" style="width:${consciousness}%"></div>
              </div>
              <div class="text-[10px] text-gray-400 mt-1 text-right">${consciousness}%</div>
            </td>
            <td class="py-2 px-2 text-right">${escapeHtml(a.status || '—')}</td>
          </tr>`;
      }).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-gray-500 italic text-center">No AI agents found.</td></tr>';
    }
  } catch(e){
    console.warn('AI agents panel load failed:', e);
  }
}

async function loadNclJobsPanel(){
  try {
    const res = await fetch('/api/l3/ncl/jobs').then(r => r.json());
    const data = Array.isArray(res) ? res : (res.jobs || []);
    const tbody = document.getElementById('ncl-jobs-body');
    if(!tbody) return;
    if(data.length){
      tbody.innerHTML = data.map(j => `
        <tr class="border-b border-white/5 hover:bg-white/5">
          <td class="py-2 px-2 font-mono text-cyan-400">${escapeHtml(j.id || j.job_id || '—')}</td>
          <td class="py-2 px-2">${escapeHtml(j.type || j.name || '—')}</td>
          <td class="py-2 px-2">${escapeHtml(j.worker || j.worker_id || '—')}</td>
          <td class="py-2 px-2 text-center">
            <span class="ncl-status-pill ncl-st-${(j.status || 'queued').toLowerCase()}">${escapeHtml(j.status || 'queued')}</span>
          </td>
          <td class="py-2 px-2 text-right">${escapeHtml(j.progress !== undefined ? j.progress + '%' : '—')}</td>
        </tr>`).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-gray-500 italic text-center">No NCL jobs found.</td></tr>';
    }
  } catch(e){
    console.warn('NCL jobs panel load failed:', e);
  }
}
