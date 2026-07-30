/**
 * ZION Presale Dashboard - Frontend Logic v3.1.0
 * Real-time stats from presale-stats.php API
 */

// Configuration
const API_BASE = './api';
const MAINNET_LAUNCH_DATE = new Date('2027-12-31T23:59:59');
const REFRESH_INTERVAL = 30000; // 30 seconds
const TARGET_TOKENS = 500000000; // 500M ZION

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 ZION Presale Dashboard v3.1.0 initialized');
  
  // Start countdown timer
  updateCountdown();
  setInterval(updateCountdown, 1000);
  
  // Load initial stats
  loadPresaleStats();
  
  // Auto-refresh stats every 30 seconds
  setInterval(loadPresaleStats, REFRESH_INTERVAL);
  
  // Setup lookup form
  const lookupForm = document.getElementById('lookup-form');
  if (lookupForm) {
    lookupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await lookupWallet();
    });
  }
});

/**
 * Update MainNet countdown timer
 */
function updateCountdown() {
  const now = new Date();
  const diff = MAINNET_LAUNCH_DATE - now;
  
  const daysElem = document.getElementById('days');
  const hoursElem = document.getElementById('hours');
  const minutesElem = document.getElementById('minutes');
  const secondsElem = document.getElementById('seconds');
  
  if (!daysElem) return; // Elements not found
  
  if (diff <= 0) {
    // MainNet launched!
    daysElem.textContent = '0';
    hoursElem.textContent = '0';
    minutesElem.textContent = '0';
    secondsElem.textContent = '0';
    return;
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  daysElem.textContent = days;
  hoursElem.textContent = String(hours).padStart(2, '0');
  minutesElem.textContent = String(minutes).padStart(2, '0');
  secondsElem.textContent = String(seconds).padStart(2, '0');
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
    updateDashboard(data.stats);
    
  } catch (error) {
    console.error('❌ Failed to load stats:', error);
    showFallbackStats(error);
  }
}

/**
 * Update dashboard UI with stats from presale-stats.php
 */
function updateDashboard(stats) {
  // Update stats cards
  updateStatsCard('stat-total-orders', stats.overview.totalOrders);
  updateStatsCard('stat-paid-orders', stats.byStatus.completed || 0);
  updateStatsCard('stat-active-wallets', stats.overview.totalOrders);
  updateStatsCard('stat-total-revenue', `€${formatNumber(stats.overview.totalRevenue, 2)}`);
  updateStatsCard('stat-avg-order', `€${formatNumber(stats.overview.avgOrderValue, 2)}`);
  
  // Update progress bar
  const tokensSold = stats.overview.totalTokens || 0;
  const progressPercent = (tokensSold / TARGET_TOKENS) * 100;
  
  updateElement('tokens-sold', formatNumber(tokensSold));
  updateProgressBar('progress-bar', 'progress-text', progressPercent);
  
  // Update recent orders table
  updateRecentOrdersTable(stats.recentOrders || []);
  
  // Update phase indicators
  updatePhaseIndicators(stats);
  
  console.log('✅ Dashboard updated with real-time stats');
}

/**
 * Update stats card helper
 */
function updateStatsCard(elementId, value) {
  const elem = document.getElementById(elementId);
  if (elem) {
    elem.textContent = typeof value === 'number' ? formatNumber(value) : value;
  }
}

/**
 * Update element text helper
 */
function updateElement(elementId, text) {
  const elem = document.getElementById(elementId);
  if (elem) elem.textContent = text;
}

/**
 * Update progress bar
 */
function updateProgressBar(barId, textId, percent) {
  const progressBar = document.getElementById(barId);
  const progressText = document.getElementById(textId);
  
  if (progressBar) progressBar.style.width = `${Math.min(percent, 100)}%`;
  if (progressText) progressText.textContent = `${percent.toFixed(2)}%`;
}

/**
 * Update phase indicators based on tokens sold
 */
function updatePhaseIndicators(stats) {
  const tokensSold = stats.overview.totalTokens || 0;
  let currentPhase = 1;
  
  // Simple phase detection
  if (tokensSold > 166666666) currentPhase = 3; // Phase 3 after 166M tokens
  else if (tokensSold > 83333333) currentPhase = 2; // Phase 2 after 83M tokens
  
  // Update phase status badges
  const phases = [
    {id: 'phase-1-status', phase: 1, activeText: 'Aktivní', completedText: 'Ukončeno'},
    {id: 'phase-2-status', phase: 2, activeText: 'Aktivní', completedText: 'Ukončeno', waitingText: 'Čeká'},
    {id: 'phase-3-status', phase: 3, activeText: 'Aktivní', waitingText: 'Čeká'}
  ];
  
  phases.forEach(({id, phase, activeText, completedText, waitingText}) => {
    const elem = document.getElementById(id);
    if (!elem) return;
    
    if (currentPhase === phase) {
      elem.textContent = activeText;
      elem.style.background = 'var(--rasta-green)';
    } else if (currentPhase > phase && completedText) {
      elem.textContent = completedText;
      elem.style.background = '#666';
    } else if (waitingText) {
      elem.textContent = waitingText;
      elem.style.background = '#666';
    }
  });
}

/**
 * Update recent orders table
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
    const dateStr = date.toLocaleDateString('cs-CZ') + ' ' + 
                    date.toLocaleTimeString('cs-CZ', {hour: '2-digit', minute: '2-digit'});
    
    return `
      <tr>
        <td><code style="color: var(--rasta-gold);">${escapeHtml(order.order_id)}</code></td>
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
 * Show fallback stats when API fails
 */
function showFallbackStats(error) {
  console.warn('⚠️ Using fallback stats due to error:', error);
  
  // Show placeholder values
  updateStatsCard('stat-total-orders', '—');
  updateStatsCard('stat-paid-orders', '—');
  updateStatsCard('stat-active-wallets', '—');
  updateStatsCard('stat-total-revenue', '€—');
  updateStatsCard('stat-avg-order', '€—');
  
  updateElement('tokens-sold', '0');
  updateProgressBar('progress-bar', 'progress-text', 0);
  
  // Show error message in table
  const tableBody = document.getElementById('recent-orders-table');
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px;">
          <i class="fa-solid fa-exclamation-triangle" style="font-size: 2em; color: #ff9800; margin-bottom: 10px; display: block;"></i>
          <div style="color: #999;">Backend není dostupný</div>
          <div style="color: #666; font-size: 0.9em; margin-top: 10px;">
            ${escapeHtml(error.message)}
          </div>
        </td>
      </tr>
    `;
  }
}

/**
 * Lookup wallet or order by ID
 */
async function lookupWallet() {
  const input = document.getElementById('lookup-input');
  const resultDiv = document.getElementById('lookup-result');
  const loadingDiv = document.getElementById('lookup-loading');
  const errorDiv = document.getElementById('lookup-error');
  
  if (!input || !resultDiv) return;
  
  const query = input.value.trim();
  
  if (!query) {
    alert('Zadejte prosím Order ID nebo Wallet ID');
    return;
  }
  
  // Hide previous results
  resultDiv.style.display = 'none';
  errorDiv.style.display = 'none';
  loadingDiv.style.display = 'block';
  
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
    displayLookupResult(data, resultDiv);
    loadingDiv.style.display = 'none';
    resultDiv.style.display = 'block';
    
  } catch (error) {
    console.error('❌ Lookup failed:', error);
    loadingDiv.style.display = 'none';
    errorDiv.style.display = 'block';
    errorDiv.innerHTML = `
      <i class="fa-solid fa-exclamation-circle" style="font-size: 2em; color: var(--rasta-red); margin-bottom: 10px; display: block;"></i>
      <div style="font-size: 1.1em; margin-bottom: 5px;">Nenalezeno</div>
      <div style="opacity: 0.8;">${escapeHtml(error.message)}</div>
    `;
  }
}

/**
 * Display wallet lookup results
 */
function displayLookupResult(data, resultDiv) {
  const order = data.order || {};
  
  let html = `
    <h4 style="color: var(--rasta-gold); margin-bottom: 20px;">
      <i class="fa-solid fa-check-circle"></i> Objednávka nalezena
    </h4>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
      <div>
        <div style="color: #999; font-size: 0.9em; margin-bottom: 5px;">Order ID</div>
        <div style="color: white; font-weight: bold;">${escapeHtml(order.order_id || '—')}</div>
      </div>
      <div>
        <div style="color: #999; font-size: 0.9em; margin-bottom: 5px;">Tokeny</div>
        <div style="color: white; font-weight: bold;">${formatNumber(order.tokens_total || 0)} ZION</div>
      </div>
      <div>
        <div style="color: #999; font-size: 0.9em; margin-bottom: 5px;">Cena</div>
        <div style="color: white; font-weight: bold;">€${formatNumber(order.price_eur || 0, 2)}</div>
      </div>
      <div>
        <div style="color: #999; font-size: 0.9em; margin-bottom: 5px;">Status</div>
        <div style="color: ${order.status === 'completed' ? 'var(--rasta-green)' : 'var(--rasta-gold)'}; font-weight: bold;">
          ${order.status === 'completed' ? 'Zaplaceno' : 'Čeká'}
        </div>
      </div>
    </div>
  `;
  
  if (order.wallet_address) {
    html += `
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2);">
        <div style="color: #999; font-size: 0.9em; margin-bottom: 5px;">Wallet Address</div>
        <div style="color: white; font-family: monospace; word-break: break-all; font-size: 0.9em;">
          ${escapeHtml(order.wallet_address)}
        </div>
      </div>
    `;
  }
  
  resultDiv.innerHTML = html;
}

/**
 * Format number with thousands separator
 */
function formatNumber(num, decimals = 0) {
  if (typeof num !== 'number') return num;
  return num.toLocaleString('cs-CZ', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
