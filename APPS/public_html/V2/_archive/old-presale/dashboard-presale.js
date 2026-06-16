/**
 * ZION Presale Dashboard - Frontend Logic
 * Loads live stats from API and updates UI
 */

// Configuration
const API_BASE = './api/presale';
const PYTHON_API_BASE = '/presale'; // Python FastAPI endpoint
const MAINNET_LAUNCH_DATE = new Date('2027-12-31T23:59:59');
const REFRESH_INTERVAL = 30000; // 30 seconds
const USE_HYBRID_DATA = true; // Merge PHP + Python stats

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 ZION Presale Dashboard initialized');
  
  // Start countdown timer
  updateCountdown();
  setInterval(updateCountdown, 1000);
  
  // Load initial stats
  loadPresaleStats();
  
  // Auto-refresh stats every 30 seconds
  setInterval(loadPresaleStats, REFRESH_INTERVAL);
  
  // Setup lookup form
  setupLookupForm();
});

/**
 * Update MainNet countdown timer
 */
function updateCountdown() {
  const now = new Date();
  const diff = MAINNET_LAUNCH_DATE - now;
  
  if (diff <= 0) {
    // MainNet launched!
    document.getElementById('days').textContent = '0';
    document.getElementById('hours').textContent = '0';
    document.getElementById('minutes').textContent = '0';
    document.getElementById('seconds').textContent = '0';
    
    document.querySelector('.timer-label').innerHTML = '🎉 MainNet is LIVE!';
    return;
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  document.getElementById('days').textContent = days;
  document.getElementById('hours').textContent = String(hours).padStart(2, '0');
  document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
  document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
}

/**
 * Load presale statistics from API
 * Uses presale-stats.php endpoint for real-time data
 */
async function loadPresaleStats() {
  try {
    console.log('📊 Loading presale stats from presale-stats.php...');
    
    const response = await fetch(`${API_BASE}/presale-stats.php`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load stats');
    }
    
    console.log('✅ Stats loaded from presale-stats.php:', data.stats);
    updateDashboardWithNewStats(data.stats);
    
  } catch (error) {
    console.error('❌ Failed to load stats:', error);
    showFallbackStats();
  }
}

/**
 * Update dashboard UI with stats from presale-stats.php
 * New structure matches presale-stats.php response format
 */
function updateDashboardWithNewStats(stats) {
  // Update stats cards
  const statTotalOrders = document.getElementById('stat-total-orders');
  const statPaidOrders = document.getElementById('stat-paid-orders');
  const statActiveWallets = document.getElementById('stat-active-wallets');
  const statTotalRevenue = document.getElementById('stat-total-revenue');
  const statAvgOrder = document.getElementById('stat-avg-order');
  
  if (statTotalOrders) statTotalOrders.textContent = formatNumber(stats.overview.totalOrders);
  if (statPaidOrders) statPaidOrders.textContent = formatNumber(stats.byStatus.completed || 0);
  if (statActiveWallets) statActiveWallets.textContent = formatNumber(stats.overview.totalOrders); // Assuming 1 wallet per order
  if (statTotalRevenue) statTotalRevenue.textContent = `€${formatNumber(stats.overview.totalRevenue, 2)}`;
  if (statAvgOrder) statAvgOrder.textContent = `€${formatNumber(stats.overview.avgOrderValue, 2)}`;
  
  // Update progress bar
  const tokensSold = stats.overview.totalTokens || 0;
  const tokensSoldElem = document.getElementById('tokens-sold');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const TARGET_TOKENS = 500000000; // 500M ZION
  const progressPercent = (tokensSold / TARGET_TOKENS) * 100;
  
  if (tokensSoldElem) tokensSoldElem.textContent = formatNumber(tokensSold);
  if (progressBar) progressBar.style.width = `${Math.min(progressPercent, 100)}%`;
  if (progressText) progressText.textContent = `${progressPercent.toFixed(2)}%`;
  
  // Update recent orders table
  updateRecentOrdersTable(stats.recentOrders || []);
  
  // Update phase indicators based on current phase
  updatePhaseIndicators(stats);
  
  console.log('✅ Dashboard updated with real-time stats');
}

/**
 * Update phase indicators based on stats
 */
function updatePhaseIndicators(stats) {
  // Determine current phase based on tokens sold or phase info
  const tokensSold = stats.overview.totalTokens || 0;
  let currentPhase = 1;
  
  // Simple phase detection (can be enhanced)
  if (tokensSold > 166666666) currentPhase = 3; // Phase 3 after 166M tokens
  else if (tokensSold > 83333333) currentPhase = 2; // Phase 2 after 83M tokens
  
  // Update phase status badges
  const phase1Status = document.getElementById('phase-1-status');
  const phase2Status = document.getElementById('phase-2-status');
  const phase3Status = document.getElementById('phase-3-status');
  
  if (phase1Status) {
    phase1Status.textContent = currentPhase === 1 ? 'Aktivní' : 'Ukončeno';
    phase1Status.style.background = currentPhase === 1 ? 'var(--rasta-green)' : '#666';
  }
  if (phase2Status) {
    phase2Status.textContent = currentPhase === 2 ? 'Aktivní' : currentPhase > 2 ? 'Ukončeno' : 'Čeká';
    phase2Status.style.background = currentPhase === 2 ? 'var(--rasta-green)' : '#666';
  }
  if (phase3Status) {
    phase3Status.textContent = currentPhase === 3 ? 'Aktivní' : 'Čeká';
    phase3Status.style.background = currentPhase === 3 ? 'var(--rasta-green)' : '#666';
  }
}

/**
 * Merge Python and PHP stats into unified structure
 */
function mergeStats(pythonData, phpData) {
  // Use Python data as base (more reliable aggregations)
  const merged = {
    tokens: {
      sold: pythonData?.total_tokens_sold || phpData?.stats?.tokens?.sold || 0,
      remaining: 500000000 - (pythonData?.total_tokens_sold || 0),
      progress_percent: ((pythonData?.total_tokens_sold || 0) / 500000000) * 100
    },
    revenue: {
      confirmed_eur: pythonData?.total_revenue_eur || phpData?.stats?.revenue?.confirmed_eur || 0,
      average_order_eur: pythonData?.avg_order_value || phpData?.stats?.revenue?.average_order_eur || 0
    },
    overview: {
      total_orders: pythonData?.total_orders || phpData?.stats?.overview?.total_orders || 0,
      paid_orders: pythonData?.paid_orders || phpData?.stats?.overview?.paid_orders || 0
    },
    wallets: {
      active: pythonData?.active_wallets || phpData?.stats?.wallets?.active || 0,
      pending_distribution: pythonData?.pending_distributions || phpData?.stats?.wallets?.pending_distribution || 0
    },
    phase: {
      current: pythonData?.current_phase || phpData?.stats?.phase?.current || 1
    },
    recent_orders: phpData?.stats?.recent_orders || [] // Use PHP for detailed order list
  };
  
  console.log('✅ Merged stats:', merged);
  return merged;
}

/**
 * Update dashboard UI with loaded stats
 */
function updateDashboard(stats) {
  // Progress Bar
  const progressPercent = stats.tokens.progress_percent || 0;
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  
  progressBar.style.width = `${Math.min(progressPercent, 100)}%`;
  progressText.textContent = `${progressPercent.toFixed(2)}%`;
  
  document.getElementById('tokensSold').textContent = formatNumber(stats.tokens.sold);
  document.getElementById('tokensRemaining').textContent = formatNumber(stats.tokens.remaining);
  document.getElementById('totalRevenue').textContent = `€${formatNumber(stats.revenue.confirmed_eur, 2)}`;
  
  // Stats Cards
  document.getElementById('totalOrders').textContent = formatNumber(stats.overview.total_orders);
  document.getElementById('paidOrders').textContent = formatNumber(stats.overview.paid_orders);
  document.getElementById('activeWallets').textContent = formatNumber(stats.wallets.active);
  document.getElementById('pendingDistributions').textContent = formatNumber(stats.wallets.pending_distribution);
  document.getElementById('avgOrderValue').textContent = `€${formatNumber(stats.revenue.average_order_eur, 2)}`;
  
  // Phase Indicator
  updatePhaseIndicator(stats.phase.current);
  
  // Recent Orders
  updateRecentOrders(stats.recent_orders);
  
  console.log('✅ Dashboard updated successfully');
}

/**
 * Update phase indicator active state
 */
function updatePhaseIndicator(currentPhase) {
  // Remove active class from all phases
  document.querySelectorAll('.phase').forEach(phase => {
    phase.classList.remove('active');
  });
  
  // Add active class to current phase
  const activePhase = document.getElementById(`phase${currentPhase}`);
  if (activePhase) {
    activePhase.classList.add('active');
  }
}

/**
 * Update recent orders table with new data from presale-stats.php
 */
function updateRecentOrdersTable(orders) {
  const tableBody = document.getElementById('recent-orders-table');
  
  if (!tableBody) {
    console.warn('⚠️ Recent orders table not found in DOM');
    return;
  }
  
  if (!orders || orders.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: #999; padding: 40px;">
          <i class="fa-solid fa-inbox" style="font-size: 2em; color: #666; margin-bottom: 10px; display: block;"></i>
          <p>Zatím žádné objednávky</p>
        </td>
      </tr>
    `;
    return;
  }
  
  // Render recent orders (limit to 10)
  const ordersHtml = orders.slice(0, 10).map(order => {
    const statusColor = order.status === 'completed' ? 'var(--rasta-green)' : 
                        order.status === 'pending' ? 'var(--rasta-gold)' : 
                        'var(--rasta-red)';
    const statusText = order.status === 'completed' ? 'Zaplaceno' :
                       order.status === 'pending' ? 'Čeká' :
                       'Zrušeno';
    
    const date = new Date(order.created_at);
    const dateStr = date.toLocaleDateString('cs-CZ') + ' ' + date.toLocaleTimeString('cs-CZ', {hour: '2-digit', minute: '2-digit'});
    
    return `
      <tr>
        <td><code style="color: var(--rasta-gold);">${order.order_id}</code></td>
        <td><strong>${formatNumber(order.tokens_total)}</strong> ZION</td>
        <td>€${formatNumber(order.price_eur, 2)}</td>
        <td><span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></td>
        <td>${dateStr}</td>
      </tr>
    `;
  }).join('');
  
  tableBody.innerHTML = ordersHtml;
}

/**
 * Update phase indicator active state (legacy support)
 */
function updatePhaseIndicator(currentPhase) {
      </tr>
    `;
    return;
  }
  
  tableBody.innerHTML = orders.map(order => {
    const statusClass = order.payment_status === 'paid' ? 'paid' : 'pending';
    const statusText = order.payment_status === 'paid' ? 'Zaplaceno' : 'Čeká na platbu';
    const date = new Date(order.created_at).toLocaleDateString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `
      <tr>
        <td><strong>${escapeHtml(order.order_id)}</strong></td>
        <td>${formatNumber(order.total_tokens)} ZION</td>
        <td>€${formatNumber(order.price_eur, 2)}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>${date}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Show fallback stats when API fails
 */
function showFallbackStats() {
  console.warn('⚠️ Using fallback stats');
  
  // Show placeholder values
  document.getElementById('progressBar').style.width = '1.5%';
  document.getElementById('progressText').textContent = '1.5%';
  document.getElementById('tokensSold').textContent = '7.5M';
  document.getElementById('tokensRemaining').textContent = '492.5M';
  document.getElementById('totalRevenue').textContent = '€60,000';
  
  document.getElementById('totalOrders').textContent = '150';
  document.getElementById('paidOrders').textContent = '120';
  document.getElementById('activeWallets').textContent = '120';
  document.getElementById('pendingDistributions').textContent = '120';
  document.getElementById('avgOrderValue').textContent = '€500';
  
  // Show offline message
  const tableBody = document.getElementById('recentOrdersTable');
  tableBody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align: center; padding: 40px;">
        <i class="fa-solid fa-exclamation-triangle" style="font-size: 2em; color: #ff9800; margin-bottom: 10px;"></i>
        <div style="color: #666;">Backend není dostupný. Zobrazuji ukázková data.</div>
        <div style="color: #999; font-size: 0.9em; margin-top: 10px;">
          API endpoint: ${API_BASE}/presale-stats.php
        </div>
      </td>
    </tr>
  `;
}

/**
 * Setup wallet/order lookup form
 */
function setupLookupForm() {
  const input = document.getElementById('lookupInput');
  
  // Allow lookup on Enter key
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      lookupWallet();
    }
  });
}

/**
 * Lookup wallet or order by ID
 */
async function lookupWallet() {
  const input = document.getElementById('lookupInput');
  const query = input.value.trim();
  const resultDiv = document.getElementById('lookupResult');
  
  if (!query) {
    alert('Zadejte prosím Order ID nebo Wallet ID');
    return;
  }
  
  // Show loading
  resultDiv.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 2em;"></i>
      <div style="margin-top: 10px;">Vyhledávám...</div>
    </div>
  `;
  resultDiv.classList.add('show');
  
  try {
    // Determine if it's order_id or wallet_id
    const isOrderId = query.startsWith('PRESALE-');
    const isWalletId = query.startsWith('ZION_');
    
    if (!isOrderId && !isWalletId) {
      throw new Error('Neplatný formát. Použijte PRESALE-XXX nebo ZION_XXX');
    }
    
    const param = isOrderId ? `order_id=${encodeURIComponent(query)}` : `wallet_id=${encodeURIComponent(query)}`;
    const response = await fetch(`${API_BASE}/wallet-lookup.php?${param}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Nenalezeno');
    }
    
    // Display results
    displayLookupResult(data);
    
  } catch (error) {
    console.error('❌ Lookup failed:', error);
    resultDiv.innerHTML = `
      <div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.9);">
        <i class="fa-solid fa-exclamation-circle" style="font-size: 2em; margin-bottom: 10px;"></i>
        <div style="font-size: 1.1em; margin-bottom: 5px;">Nenalezeno</div>
        <div style="opacity: 0.8;">${escapeHtml(error.message)}</div>
      </div>
    `;
  }
}

/**
 * Display wallet lookup results
 */
function displayLookupResult(data) {
  const resultDiv = document.getElementById('lookupResult');
  const wallet = data.wallet;
  const order = data.order;
  const distribution = data.distribution;
  const details = wallet.status_details;
  
  // Status badge HTML
  let statusBadgeClass = 'pending';
  if (wallet.status === 'active' || wallet.status === 'distributed') {
    statusBadgeClass = 'active';
  } else if (wallet.status === 'expired') {
    statusBadgeClass = 'expired';
  }
  
  let html = `
    <h4>
      ${details.icon} ${details.title}
      <span class="status-badge ${statusBadgeClass}">${wallet.status.toUpperCase()}</span>
    </h4>
    <p style="opacity: 0.9; margin-bottom: 20px;">${details.message}</p>
    
    <div class="details-grid">
      <div class="detail-item">
        <div class="detail-label">Wallet ID</div>
        <div class="detail-value" style="font-size: 0.9em; word-break: break-all;">${escapeHtml(wallet.id)}</div>
      </div>
      
      <div class="detail-item">
        <div class="detail-label">Adresa</div>
        <div class="detail-value" style="font-size: 0.8em; word-break: break-all;">${escapeHtml(wallet.address)}</div>
      </div>
      
      <div class="detail-item">
        <div class="detail-label">Alokované tokeny</div>
        <div class="detail-value">${formatNumber(wallet.tokens_allocated)} ZION</div>
      </div>
      
      <div class="detail-item">
        <div class="detail-label">Přijaté tokeny</div>
        <div class="detail-value">${formatNumber(wallet.tokens_received)} ZION</div>
      </div>
  `;
  
  if (order) {
    html += `
      <div class="detail-item">
        <div class="detail-label">Order ID</div>
        <div class="detail-value" style="font-size: 0.9em;">${escapeHtml(order.id)}</div>
      </div>
      
      <div class="detail-item">
        <div class="detail-label">Částka</div>
        <div class="detail-value">€${formatNumber(order.price_eur, 2)}</div>
      </div>
      
      <div class="detail-item">
        <div class="detail-label">Payment Status</div>
        <div class="detail-value">${order.payment_status === 'paid' ? '✅ Zaplaceno' : '⏳ Čeká'}</div>
      </div>
      
      <div class="detail-item">
        <div class="detail-label">Email</div>
        <div class="detail-value" style="font-size: 0.9em;">${escapeHtml(order.customer_email)}</div>
      </div>
    `;
  }
  
  if (distribution) {
    html += `
      <div class="detail-item">
        <div class="detail-label">TX Hash</div>
        <div class="detail-value" style="font-size: 0.7em; word-break: break-all;">
          <a href="${escapeHtml(distribution.explorer_url)}" target="_blank" style="color: white; text-decoration: underline;">
            ${escapeHtml(distribution.transaction_hash.substring(0, 20))}...
          </a>
        </div>
      </div>
      
      <div class="detail-item">
        <div class="detail-label">Block Height</div>
        <div class="detail-value">#${formatNumber(distribution.block_height)}</div>
      </div>
    `;
  }
  
  html += `</div>`;
  
  // Add QR code if available
  if (wallet.qr_url) {
    html += `
      <div style="text-align: center; margin-top: 25px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2);">
        <div style="margin-bottom: 10px; opacity: 0.8;">QR Wallet</div>
        <img src="${escapeHtml(wallet.qr_url)}" alt="QR Code" style="max-width: 200px; border: 2px solid white; border-radius: 10px;" />
      </div>
    `;
  }
  
  resultDiv.innerHTML = html;
}

/**
 * Format number with thousands separator
 */
function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined) return '0';
  
  const n = parseFloat(num);
  if (isNaN(n)) return '0';
  
  return n.toLocaleString('cs-CZ', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
  // Simple console notification (can be enhanced with toast library)
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  console.log(`${icon} ${message}`);
  
  // Could integrate with a toast notification library here
}

// Export for use in HTML
window.lookupWallet = lookupWallet;
