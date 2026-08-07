/**
 * ZION Admin Panel JavaScript
 * Extrahováno pro lepší cachování a rychlejší načítání
 */

let allOrders = [];
let currentTab = 'all';

// Přepnout tab
function switchTab(tab) {
    currentTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById('content-' + tab).classList.add('active');
    
    // Re-render based on current filter
    filterOrders();
}

async function apiFetch(url, options = {}) {
    const opts = {
        ...options,
        credentials: 'include',
        headers: options.headers ? new Headers(options.headers) : new Headers(),
    };

    // Ensure API returns JSON on auth failures.
    if (!opts.headers.has('Accept')) {
        opts.headers.set('Accept', 'application/json');
    }

    let response = await fetch(url, opts);

    // Fetch obvykle nevyvolá Basic-Auth dialog sám – při 401 si řekneme o údaje.
    if (response.status === 401) {
        const user = prompt('Admin uživatel:');
        const pass = prompt('Admin heslo:');
        if (user && pass) {
            const token = btoa(unescape(encodeURIComponent(`${user}:${pass}`)));
            opts.headers.set('Authorization', `Basic ${token}`);
            response = await fetch(url, opts);
        }
    }

    return response;
}

// Načíst objednávky
async function loadOrders() {
    try {
        const response = await apiFetch('./api/admin-orders.php?action=list');
        const data = await response.json();

        if (data.orders) {
            allOrders = data.orders;
            renderAllTabs();
            loadStats();
        } else {
            throw new Error(data?.error || 'Neočekávaná odpověď API');
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        document.getElementById('orders-tbody-all').innerHTML = `
            <tr><td colspan="9" style="text-align:center;color:#f44336;">
                Chyba při načítání. Zkontrolujte přihlášení.
            </td></tr>
        `;
    }
}

// Render všechny taby
function renderAllTabs() {
    const presaleOrders = allOrders.filter(o => o.type === 'software' || o.type === 'presale');
    const eshopOrders = allOrders.filter(o => o.type === 'eshop' || !o.type);
    
    // Update counts
    document.getElementById('count-all').textContent = allOrders.length;
    document.getElementById('count-presale').textContent = presaleOrders.length;
    document.getElementById('count-eshop').textContent = eshopOrders.length;
    
    // Render tables
    renderOrdersTable(allOrders, 'orders-tbody-all', 'all');
    renderOrdersTable(presaleOrders, 'orders-tbody-presale', 'presale');
    renderOrdersTable(eshopOrders, 'orders-tbody-eshop', 'eshop');
    
    // Update section stats
    updateSectionStats(presaleOrders, eshopOrders);
}

// Update section stats
function updateSectionStats(presaleOrders, eshopOrders) {
    // Presale stats
    const presaleTokens = presaleOrders.reduce((sum, o) => sum + (parseInt(o.zionTokens) || 0), 0);
    const presaleRevenueEUR = presaleOrders
        .filter(o => (o.currency || '').toString().trim() === '€' || (o.currency || '').toString().toUpperCase() === 'EUR')
        .reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const presaleRevenueCZK = presaleOrders
        .filter(o => (o.currency || '').toString().trim() !== '€' && (o.currency || '').toString().toUpperCase() !== 'EUR')
        .reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    document.getElementById('presale-count').textContent = presaleOrders.length;
    document.getElementById('presale-tokens').textContent = presaleTokens.toLocaleString();
    if (presaleRevenueEUR > 0 && presaleRevenueCZK > 0) {
        document.getElementById('presale-revenue').textContent = `€${presaleRevenueEUR.toFixed(2)} + ${Math.round(presaleRevenueCZK).toLocaleString()} Kč`;
    } else if (presaleRevenueEUR > 0) {
        document.getElementById('presale-revenue').textContent = '€' + presaleRevenueEUR.toFixed(2);
    } else {
        document.getElementById('presale-revenue').textContent = Math.round(presaleRevenueCZK).toLocaleString() + ' Kč';
    }
    
    // eShop stats
    const eshopTokens = eshopOrders.reduce((sum, o) => sum + (parseInt(o.zionTokens) || 0), 0);
    const eshopRevenue = eshopOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    document.getElementById('eshop-count').textContent = eshopOrders.length;
    document.getElementById('eshop-tokens').textContent = eshopTokens.toLocaleString();
    document.getElementById('eshop-revenue').textContent = eshopRevenue.toLocaleString() + ' Kč';
}

// Render orders table
function renderOrdersTable(orders, tbodyId, tableType) {
    const tbody = document.getElementById(tbodyId);
    
    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#888;">Žádné objednávky</td></tr>`;
        return;
    }
    
    const formatMoney = (amount, currency) => {
        const cur = (currency || 'Kč').toString().trim();
        const num = parseFloat(amount);
        const safe = Number.isFinite(num) ? num : 0;
        if (cur === '€' || cur.toUpperCase?.() === 'EUR') {
            return `€${safe.toFixed(2)}`;
        }
        // default CZK style (no decimals)
        return `${Math.round(safe).toLocaleString()} Kč`;
    };

    if (tableType === 'presale') {
        tbody.innerHTML = orders.map(order => `
            <tr>
                <td><strong>${order.orderId}</strong></td>
                <td>
                    <strong>${formatDate(order.createdAt, true)}</strong><br>
                    <small style="color:#666;">${formatTime(order.createdAt)}</small>
                </td>
                <td>
                    ${order.customer}<br>
                    <small style="color:#666;">${order.email}</small>
                </td>
                <td><span style="color:var(--rasta-gold);">📦 ${order.packageName || 'Software'}</span></td>
                <td><strong>${formatMoney(order.total, order.currency)}</strong></td>
                <td><strong style="color:var(--rasta-gold);">${(order.zionTokens || 0).toLocaleString()} ZION</strong></td>
                <td>${renderInvoiceButtons(order)}</td>
                <td><span class="status-badge status-${order.status}">${getStatusName(order.status)}</span></td>
                <td>
                    <button class="action-btn view" onclick="viewOrder('${order.orderId}')">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } else if (tableType === 'eshop') {
        tbody.innerHTML = orders.map(order => `
            <tr>
                <td><strong>${order.orderId}</strong></td>
                <td>
                    <strong>${formatDate(order.createdAt, true)}</strong><br>
                    <small style="color:#666;">${formatTime(order.createdAt)}</small>
                </td>
                <td>
                    ${order.customer}<br>
                    <small style="color:#666;">${order.email}</small>
                </td>
                <td><span style="color:#667eea;">🛒 ${order.itemCount || 1} položek</span></td>
                <td><strong>${parseFloat(order.total).toLocaleString()} Kč</strong></td>
                <td>${order.zionTokens > 0 ? 
                    `<strong style="color:var(--rasta-gold);">${order.zionTokens.toLocaleString()} ZION</strong>` 
                    : '<span style="color:#666;">-</span>'}</td>
                <td>${renderInvoiceButtons(order)}</td>
                <td><span class="status-badge status-${order.status}">${getStatusName(order.status)}</span></td>
                <td>
                    <button class="action-btn view" onclick="viewOrder('${order.orderId}')">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } else {
        // All orders - with type badge
        tbody.innerHTML = orders.map(order => `
            <tr>
                <td><strong>${order.orderId}</strong></td>
                <td>
                    <span class="type-badge type-${order.type || 'eshop'}">
                        ${(order.type === 'software' || order.type === 'presale') ? '🖥️' : '🛒'}
                    </span>
                </td>
                <td>
                    <strong>${formatDate(order.createdAt, true)}</strong><br>
                    <small style="color:#666;">${formatTime(order.createdAt)}</small>
                </td>
                <td>
                    ${order.customer}<br>
                    <small style="color:#666;">${order.email}</small>
                </td>
                <td><strong>${order.total} ${order.currency || 'Kč'}</strong></td>
                <td>${order.zionTokens > 0 ? 
                    `<strong style="color:var(--rasta-gold);">${order.zionTokens.toLocaleString()}</strong>` 
                    : '-'}</td>
                <td>${renderInvoiceButtons(order)}</td>
                <td><span class="status-badge status-${order.status}">${getStatusName(order.status)}</span></td>
                <td>
                    <button class="action-btn view" onclick="viewOrder('${order.orderId}')">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
}

// Render invoice buttons
function renderInvoiceButtons(order) {
    if (order.hasInvoice) {
        return `
            <a href="${order.invoiceUrl}" target="_blank" class="rasta-btn rasta-btn-outline" style="padding:5px 10px;text-decoration:none;font-size:0.75rem;">
                <i class="fa-solid fa-file-pdf"></i>
            </a>
            <button onclick="regenerateInvoice('${order.orderId}')" class="rasta-btn rasta-btn-outline" style="padding:5px 10px;font-size:0.75rem;margin-left:4px;" title="Regenerovat">
                <i class="fa-solid fa-rotate"></i>
            </button>
            <button onclick="sendInvoiceByOrder('${order.orderId}')" class="rasta-btn" style="padding:5px 10px;font-size:0.75rem;margin-left:4px;" title="Odeslat">
                <i class="fa-solid fa-paper-plane"></i>
            </button>
        `;
    } else {
        return `
            <button onclick="generateInvoiceForOrder('${order.orderId}')" class="rasta-btn rasta-btn-outline" style="padding:5px 10px;font-size:0.75rem;" title="Generovat">
                <i class="fa-solid fa-plus-circle"></i>
            </button>
            <button onclick="sendInvoiceByOrder('${order.orderId}')" class="rasta-btn" style="padding:5px 10px;font-size:0.75rem;margin-left:4px;" title="Odeslat">
                <i class="fa-solid fa-paper-plane"></i>
            </button>
        `;
    }
}

// Načíst statistiky
async function loadStats() {
    try {
        // Spočítat stats lokálně z allOrders
        const stats = {
            totalOrders: allOrders.length,
            eshopOrders: allOrders.filter(o => o.type === 'eshop').length,
            presaleOrders: allOrders.filter(o => o.type === 'software' || o.type === 'presale').length,
            totalRevenueCZK: 0,
            totalRevenueEUR: 0,
            totalTokens: 0,
            byStatus: {}
        };
        
        allOrders.forEach(order => {
            // Revenue
            if (order.currency === '€' || order.currency === 'EUR') {
                stats.totalRevenueEUR += parseFloat(order.total) || 0;
            } else {
                stats.totalRevenueCZK += parseFloat(order.total) || 0;
            }
            
            // Tokens
            stats.totalTokens += parseInt(order.zionTokens) || 0;
            
            // By status
            const status = order.status || 'new';
            stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
        });
        
        // Update DOM
        document.getElementById('stat-orders').textContent = stats.totalOrders;
        document.getElementById('stat-eshop').textContent = stats.eshopOrders;
        document.getElementById('stat-presale').textContent = stats.presaleOrders;
        
        // Revenue - zobraz větší hodnotu nahoře
        if (stats.totalRevenueEUR > stats.totalRevenueCZK / 25) {
            document.getElementById('stat-revenue').textContent = '€' + stats.totalRevenueEUR.toFixed(2);
        } else {
            document.getElementById('stat-revenue').textContent = stats.totalRevenueCZK.toLocaleString() + ' Kč';
        }
        document.getElementById('stat-czk').textContent = stats.totalRevenueCZK.toLocaleString();
        document.getElementById('stat-eur').textContent = '€' + stats.totalRevenueEUR.toFixed(2);
        
        document.getElementById('stat-tokens').textContent = stats.totalTokens.toLocaleString();
        document.getElementById('stat-pending').textContent = stats.byStatus['pending_payment'] || 0;
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Vykreslit objednávky
function renderOrders(orders) {
    const tbody = document.getElementById('orders-tbody');
    
    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#888;">Žádné objednávky</td></tr>`;
        return;
    }
    
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td><strong>${order.orderId}</strong></td>
            <td>
                <span class="type-badge type-${order.type || 'eshop'}">
                    ${order.type === 'presale' ? '🖥️ Software' : '🛒 eShop'}
                </span>
            </td>
            <td>
                <strong>${formatDate(order.createdAt, true)}</strong><br>
                <small style="color:#666;">${formatTime(order.createdAt)}</small>
            </td>
            <td>
                ${order.customer}<br>
                <small style="color:#666;">${order.email}</small>
            </td>
            <td><strong>${order.total} ${order.currency || 'Kč'}</strong></td>
            <td>${getPaymentName(order.payment)}</td>
            <td>
                ${order.zionTokens > 0 ? 
                    `<strong style="color:var(--rasta-gold);">${order.zionTokens.toLocaleString()} ZION</strong>` 
                    : '<span style="color:#666;">-</span>'}
            </td>
            <td>
                ${order.hasInvoice ? `
                    <a href="${order.invoiceUrl}" target="_blank" class="rasta-btn rasta-btn-outline" style="padding:5px 10px;text-decoration:none;font-size:0.75rem;">
                        <i class="fa-solid fa-file-pdf"></i> PDF
                    </a>
                    ${order.qrUrl ? `
                        <a href="${order.qrUrl}" target="_blank" class="rasta-btn rasta-btn-outline" style="padding:5px 10px;text-decoration:none;font-size:0.75rem;margin-left:4px;" title="QR kód walletu">
                            <i class="fa-solid fa-qrcode"></i> QR
                        </a>
                    ` : ''}
                    <button onclick="regenerateInvoice('${order.orderId}')" class="rasta-btn rasta-btn-outline" style="padding:5px 10px;font-size:0.75rem;margin-left:4px;" title="Regenerovat">
                        <i class="fa-solid fa-rotate"></i>
                    </button>
                    <button onclick="sendInvoiceByOrder('${order.orderId}')" class="rasta-btn" style="padding:5px 10px;font-size:0.75rem;margin-left:4px;" title="Odeslat emailem">
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                ` : `
                    <button onclick="generateInvoiceForOrder('${order.orderId}')" class="rasta-btn rasta-btn-outline" style="padding:5px 10px;font-size:0.75rem;">
                        <i class="fa-solid fa-plus-circle"></i> Generovat
                    </button>
                    ${order.qrUrl ? `
                        <a href="${order.qrUrl}" target="_blank" class="rasta-btn rasta-btn-outline" style="padding:5px 10px;text-decoration:none;font-size:0.75rem;margin-left:4px;" title="QR kód walletu">
                            <i class="fa-solid fa-qrcode"></i> QR
                        </a>
                    ` : ''}
                    <button onclick="sendInvoiceByOrder('${order.orderId}')" class="rasta-btn" style="padding:5px 10px;font-size:0.75rem;margin-left:4px;" title="Vygenerovat a odeslat">
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                `}
            </td>
            <td><span class="status-badge status-${order.status}">${getStatusName(order.status)}</span></td>
            <td>
                <button class="action-btn view" onclick="viewOrder('${order.orderId}')">
                    <i class="fa-solid fa-eye"></i> Detail
                </button>
            </td>
        </tr>
    `).join('');
}

// Filtrovat objednávky
function filterOrders() {
    const status = document.getElementById('filter-status').value;
    const search = document.getElementById('filter-search').value.toLowerCase();
    
    // Filter base list
    let filtered = allOrders;
    
    if (status) {
        filtered = filtered.filter(o => o.status === status);
    }
    
    if (search) {
        filtered = filtered.filter(o => 
            o.orderId.toLowerCase().includes(search) ||
            o.customer.toLowerCase().includes(search) ||
            o.email.toLowerCase().includes(search)
        );
    }
    
    // Split by type
    const presaleOrders = filtered.filter(o => o.type === 'software' || o.type === 'presale');
    const eshopOrders = filtered.filter(o => o.type === 'eshop' || !o.type);
    
    // Update counts
    document.getElementById('count-all').textContent = filtered.length;
    document.getElementById('count-presale').textContent = presaleOrders.length;
    document.getElementById('count-eshop').textContent = eshopOrders.length;
    
    // Render tables
    renderOrdersTable(filtered, 'orders-tbody-all', 'all');
    renderOrdersTable(presaleOrders, 'orders-tbody-presale', 'presale');
    renderOrdersTable(eshopOrders, 'orders-tbody-eshop', 'eshop');
    
    // Update section stats
    updateSectionStats(presaleOrders, eshopOrders);
}

// Zobrazit detail objednávky
async function viewOrder(orderId) {
    document.getElementById('modal-order-id').textContent = orderId;
    document.getElementById('modal-body').innerHTML = '<div class="loading"><i class="fa-solid fa-spinner"></i></div>';
    document.getElementById('order-modal').classList.add('active');
    
    try {
        const response = await apiFetch(`./api/admin-orders.php?action=detail&id=${orderId}`);
        const data = await response.json();
        
        if (data.order) {
            renderOrderDetail(data.order);
        }
    } catch (error) {
        document.getElementById('modal-body').innerHTML = '<p style="color:#f44336;">Chyba při načítání</p>';
    }
}

// Vykreslit detail objednávky - KOMPLEXNÍ VERZE
function renderOrderDetail(order) {
    const isPresale = order._type === 'software' || order._type === 'presale' || order.orderId?.startsWith('PRESALE');
    const distributionStatus = order._distributionStatus || order.distributionStatus || 'pending';

    const maskMnemonic = (mnemonic) => {
        if (!mnemonic) return 'N/A';
        const words = String(mnemonic).trim().split(/\s+/);
        if (words.length >= 3) return `${words.slice(0, 3).join(' ')} ••• ••• ••• (12 slov)`;
        return '••• ••• ••• (skryto)';
    };

    const extractVS = (orderId) => {
        if (!orderId) return 'N/A';
        const match = String(orderId).match(/(PRESALE|ORD)-(\d{10})-/);
        return match ? match[2] : String(orderId).slice(0, 10);
    };

    const wallet = order.zion?.wallet || order.wallet;
    const walletAddress = wallet?.address || wallet?.uri || '';
    const qrUrl = (
        order.zion?.qr?.serviceUrl ||
        order.zion?.qr?.dataUrl ||
        order.zion?.qrServiceUrl ||
        (order.zion?.qr?.imageFile ? (`./wallets/${order.zion.qr.imageFile}`) : '')
    );

    const findPresaleItem = (items) => {
        if (!Array.isArray(items)) return null;
        return items.find((it) => {
            const cat = (it?.category || '').toString().toLowerCase();
            const id = (it?.id || '').toString().toLowerCase();
            return cat === 'software' || cat === 'presale' || id.startsWith('presale-');
        }) || null;
    };

    const presaleItem = isPresale ? findPresaleItem(order.items) : null;
    const derivedPresaleName = presaleItem?.name || null;
    const derivedPresalePrice = presaleItem
        ? (parseFloat(presaleItem.price || 0) * parseInt(presaleItem.quantity || 1))
        : null;
    const derivedPresaleTokens = presaleItem
        ? (parseInt(presaleItem.tokens || 0) * parseInt(presaleItem.quantity || 1))
        : null;

    const presaleTotalTokens = (
        order.totalTokens ??
        order.zion?.tokens?.totalTokens ??
        derivedPresaleTokens ??
        ((order.baseTokens || 0) + (order.bonusTokens || 0))
    );

    const presaleBaseTokens = (order.baseTokens ?? presaleTotalTokens ?? 0);
    const presaleBonusTokens = (order.bonusTokens ?? 0);

    let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
            <span class="order-type-badge ${isPresale ? 'type-presale' : 'type-eshop'}" style="font-size:1rem;padding:8px 16px;">
                <i class="fa-solid ${isPresale ? 'fa-desktop' : 'fa-shopping-cart'}"></i>
                ${isPresale ? 'SOFTWARE OBJEDNÁVKA' : 'E-SHOP OBJEDNÁVKA'}
            </span>
            <span style="background:${distributionStatus === 'completed' ? 'var(--rasta-green)' : 'var(--rasta-gold)'};color:#000;padding:6px 12px;border-radius:20px;font-size:0.85rem;font-weight:bold;">
                <i class="fa-solid ${distributionStatus === 'completed' ? 'fa-check-circle' : 'fa-clock'}"></i>
                Distribuce: ${distributionStatus === 'completed' ? 'Dokončeno' : 'Čeká'}
            </span>
        </div>

        <div class="detail-section">
            <h3><i class="fa-solid fa-info-circle"></i> Základní informace</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <label>ID objednávky</label>
                    <span style="font-family:monospace;font-size:0.85rem;color:var(--rasta-gold);">${order.orderId || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <label>Variabilní symbol</label>
                    <span style="font-family:monospace;font-weight:bold;">${order.variableSymbol || extractVS(order.orderId)}</span>
                </div>
                <div class="detail-item">
                    <label>Stav</label>
                    <span class="status-badge status-${order.status}">${getStatusName(order.status)}</span>
                </div>
                <div class="detail-item">
                    <label>Datum vytvoření</label>
                    <span>${formatDate(order.createdAt)}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3><i class="fa-solid fa-user"></i> Zákazník</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <label>Jméno</label>
                    <span>${order.customer?.name || order.name || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <label>E-mail</label>
                    <span><a href="mailto:${order.customer?.email || order.email || ''}" style="color:var(--rasta-gold);">${order.customer?.email || order.email || 'N/A'}</a></span>
                </div>
                <div class="detail-item">
                    <label>Telefon</label>
                    <span>${order.customer?.phone || order.phone || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <label>Newsletter</label>
                    <span>${order.customer?.newsletter || order.newsletter ? '<i class="fa-solid fa-check" style="color:var(--rasta-green);"></i> Ano' : 'Ne'}</span>
                </div>
            </div>
        </div>
    `;

    if (isPresale) {
        html += `
        <div class="detail-section">
            <h3><i class="fa-solid fa-desktop"></i> Software Balíček</h3>
            <div class="detail-grid">
                <div class="detail-item"><label>Balíček</label><span style="color:var(--rasta-gold);font-weight:bold;">${order.packageName || order.package?.name || derivedPresaleName || 'Software'}</span></div>
                <div class="detail-item"><label>Cena balíčku</label><span>${(order.packagePrice || order.package?.price || order.total || derivedPresalePrice || 0).toLocaleString()} Kč</span></div>
                <div class="detail-item"><label>Základní tokeny</label><span>${(presaleBaseTokens || 0).toLocaleString()} ZION</span></div>
                <div class="detail-item"><label>Bonus tokeny</label><span style="color:var(--rasta-green);">+${(presaleBonusTokens || 0).toLocaleString()} ZION</span></div>
            </div>
            <div style="background:linear-gradient(135deg, rgba(255,215,0,0.1), rgba(0,255,0,0.1));border:1px solid var(--rasta-gold);border-radius:12px;padding:20px;margin-top:15px;text-align:center;">
                <div style="font-size:0.9rem;color:#888;margin-bottom:5px;">Celkem tokenů k distribuci</div>
                <div style="font-size:2rem;font-weight:bold;color:var(--rasta-gold);">
                    <i class="fa-solid fa-coins"></i> ${(presaleTotalTokens || 0).toLocaleString()} ZION
                </div>
            </div>
        </div>
        `;
    } else {
        html += `
        <div class="detail-section">
            <h3><i class="fa-solid fa-box"></i> Položky objednávky</h3>
            <div class="items-list">
                ${(order.items || []).length ? order.items.map(item => `
                    <div class="order-item">
                        <span>${item.name} × ${item.quantity}</span>
                        <span style="color:var(--rasta-gold);font-weight:bold;">${(item.price * item.quantity).toLocaleString()} Kč</span>
                    </div>
                `).join('') : '<p style="color:#888;">Žádné položky</p>'}
            </div>
        </div>

        <div class="detail-section">
            <h3><i class="fa-solid fa-truck"></i> Doprava & Platba</h3>
            <div class="detail-grid">
                <div class="detail-item"><label>Doprava</label><span>${order.shipping?.method || 'N/A'} (${order.shipping?.price || 0} Kč)</span></div>
                <div class="detail-item"><label>Platba</label><span>${getPaymentName(order.payment)}</span></div>
                <div class="detail-item"><label>Mezisoučet</label><span>${(order.subtotal || 0).toLocaleString()} Kč</span></div>
                <div class="detail-item"><label>Celkem</label><span style="color:var(--rasta-green);font-weight:bold;font-size:1.2rem;">${(order.total || 0).toLocaleString()} Kč</span></div>
            </div>
        </div>
        `;

        if (order.zion?.tokens?.totalTokens > 0) {
            html += `
            <div class="detail-section">
                <h3><i class="fa-solid fa-gift"></i> Bonus ZION Tokeny</h3>
                <div class="detail-grid">
                    <div class="detail-item"><label>Bonus</label><span style="color:var(--rasta-gold);font-weight:bold;">${order.zion.tokens.totalTokens.toLocaleString()} ZION</span></div>
                    <div class="detail-item"><label>Status distribuce</label><span>${distributionStatus === 'completed' ? 'Odesláno' : 'Čeká na MainNet'}</span></div>
                </div>
            </div>
            `;
        }
    }

    if (wallet) {
        html += `
        <div class="detail-section">
            <h3><i class="fa-solid fa-wallet"></i> ZION Wallet</h3>
            <div style="background:rgba(0,0,0,0.25);border:1px solid #444;border-radius:12px;padding:20px;">
                <div class="detail-grid">
                    <div class="detail-item" style="grid-column: span 2;">
                        <label>Wallet adresa</label>
                        <div style="display:flex;align-items:center;gap:10px;">
                            <span style="font-family:monospace;font-size:0.85rem;background:#1a1a2e;padding:8px 12px;border-radius:6px;flex:1;word-break:break-all;">${walletAddress || 'N/A'}</span>
                            <button onclick="copyToClipboard('${walletAddress}')" class="rasta-btn rasta-btn-outline" style="padding:8px 12px;">
                                <i class="fa-solid fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    <div class="detail-item"><label>Wallet ID</label><span style="font-family:monospace;">${wallet.id || 'N/A'}</span></div>
                    <div class="detail-item"><label>Vytvořen</label><span>${wallet.createdAt ? formatDate(wallet.createdAt) : 'N/A'}</span></div>
                </div>

                ${qrUrl ? `
                <div style="margin-top:20px;padding:15px;background:rgba(255,215,0,0.1);border:1px solid var(--rasta-gold);border-radius:12px;text-align:center;">
                    <label style="color:var(--rasta-gold);font-weight:bold;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:15px;">
                        <i class="fa-solid fa-qrcode"></i> QR Kód pro import walletu
                    </label>
                    <img src="${qrUrl}" alt="QR Code" style="max-width:280px;border-radius:8px;border:2px solid #333;background:#fff;padding:10px;">
                    <p style="color:#888;font-size:0.8rem;margin-top:10px;">Naskenujte pro import do mobilní peněženky</p>
                </div>
                ` : ''}

                ${wallet.mnemonic ? `
                <div style="margin-top:15px;padding:15px;background:rgba(255,0,0,0.1);border:1px dashed #f44336;border-radius:8px;">
                    <label style="color:#f44336;font-weight:bold;display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                        <i class="fa-solid fa-key"></i> Recovery Phrase (částečně maskována)
                    </label>
                    <div id="mnemonic-display" style="font-family:monospace;color:#ccc;font-size:0.85rem;">${maskMnemonic(wallet.mnemonic)}</div>
                    <button onclick="if(confirm('⚠️ BEZPEČNOSTNÍ VAROVÁNÍ!\\n\\nOpravdu chcete zobrazit celou recovery phrase?')) { document.getElementById('mnemonic-display').textContent='${String(wallet.mnemonic).replace(/'/g, "\\'")}'; this.remove(); }" class="rasta-btn rasta-btn-outline" style="margin-top:10px;padding:6px 12px;font-size:0.8rem;">
                        <i class="fa-solid fa-eye"></i> Zobrazit celou frázi
                    </button>
                </div>
                ` : ''}
            </div>
        </div>
        `;
    }

    if (order.note) {
        html += `
        <div class="detail-section">
            <h3><i class="fa-solid fa-sticky-note"></i> Poznámka zákazníka</h3>
            <p style="color:#ccc;padding:15px;background:rgba(0,0,0,0.3);border-radius:8px;border-left:3px solid var(--rasta-gold);">${order.note}</p>
        </div>
        `;
    }

    html += `
        <div class="detail-section">
            <h3><i class="fa-solid fa-file-invoice"></i> Faktura</h3>
            <div style="display:flex;flex-wrap:wrap;gap:10px;">
                <a href="./api/invoice.php?action=view&orderId=${order.orderId}" target="_blank" class="rasta-btn" style="padding:10px 20px;text-decoration:none;"><i class="fa-solid fa-eye"></i> Zobrazit</a>
                <button onclick="regenerateInvoice('${order.orderId}')" class="rasta-btn rasta-btn-outline" style="padding:10px 20px;"><i class="fa-solid fa-rotate"></i> Regenerovat</button>
                <a href="./api/download-invoice.php?orderId=${order.orderId}" class="rasta-btn rasta-btn-outline" style="padding:10px 20px;text-decoration:none;" target="_blank"><i class="fa-solid fa-download"></i> PDF</a>
                <button onclick="sendInvoiceByOrder('${order.orderId}')" class="rasta-btn" style="padding:10px 20px;"><i class="fa-solid fa-paper-plane"></i> Odeslat emailem</button>
            </div>
        </div>

        <div class="detail-section">
            <h3><i class="fa-solid fa-chart-line"></i> Trivi Účetní Systém</h3>
            <div id="trivi-status-${order.orderId}" style="margin-bottom:15px;">
                <p style="color:#888;"><i class="fa-solid fa-spinner fa-spin"></i> Načítám status...</p>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:10px;">
                <button onclick="sendToTrivi('${order.orderId}')" class="rasta-btn" style="padding:10px 20px;background:linear-gradient(135deg, #00ff7f, #00d4ff);">
                    <i class="fa-solid fa-cloud-arrow-up"></i> Odeslat do Trivi
                </button>
                <button onclick="checkTriviStatus('${order.orderId}')" class="rasta-btn rasta-btn-outline" style="padding:10px 20px;">
                    <i class="fa-solid fa-rotate"></i> Zkontrolovat status
                </button>
            </div>
        </div>

        <div class="status-update" style="background:rgba(0,0,0,0.3);padding:20px;border-radius:12px;display:flex;align-items:center;gap:15px;flex-wrap:wrap;">
            <label style="color:#888;font-weight:bold;"><i class="fa-solid fa-edit"></i> Změnit stav:</label>
            <select id="new-status" style="flex:1;min-width:200px;">
                <option value="new" ${order.status === 'new' ? 'selected' : ''}>🆕 Nová</option>
                <option value="pending_payment" ${order.status === 'pending_payment' ? 'selected' : ''}>⏳ Čeká na platbu</option>
                <option value="paid" ${order.status === 'paid' ? 'selected' : ''}>✅ Zaplaceno</option>
                <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>📦 Odesláno</option>
                <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>🎉 Dokončeno</option>
                <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>❌ Zrušeno</option>
            </select>
            <button onclick="updateStatus('${order.orderId}')" class="rasta-btn" style="padding:10px 25px;"><i class="fa-solid fa-save"></i> Uložit</button>
        </div>

        <div style="margin-top:20px;padding:15px;background:rgba(0,0,0,0.2);border-radius:8px;font-size:0.8rem;color:#666;">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;">
                <span><i class="fa-solid fa-folder"></i> Zdroj: ${order._file || 'neznámý'}</span>
                <span><i class="fa-solid fa-calendar"></i> Aktualizace: ${order.updatedAt ? formatDate(order.updatedAt) : 'N/A'}</span>
                <span><i class="fa-solid fa-hashtag"></i> VS: ${order.variableSymbol || extractVS(order.orderId)}</span>
            </div>
        </div>
    `;

    document.getElementById('modal-body').innerHTML = html;
}

// Kopírovat do schránky
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Zkopírováno do schránky!');
    });
}

// Aktualizovat stav
async function updateStatus(orderId) {
    const newStatus = document.getElementById('new-status').value;
    
    try {
        const response = await apiFetch('./api/admin-orders.php?action=update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, status: newStatus }),
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Stav byl aktualizován!');
            closeModal();
            loadOrders();
        }
    } catch (error) {
        alert('Chyba při aktualizaci');
    }
}

// Zavřít modal
function closeModal() {
    document.getElementById('order-modal').classList.remove('active');
}

// Helper funkce
function getStatusName(status) {
    const names = {
        'new': 'Nová',
        'pending_payment': 'Čeká na platbu',
        'paid': 'Zaplaceno',
        'shipped': 'Odesláno',
        'completed': 'Dokončeno',
        'cancelled': 'Zrušeno'
    };
    return names[status] || status;
}

function getPaymentName(payment) {
    const names = {
        'card': 'Kartou',
        'transfer': 'Převodem',
        'cash': 'Dobírka',
        'bank_transfer': 'Bankovní převod',
        'crypto': 'Krypto'
    };
    return names[payment] || payment;
}

function formatDate(dateStr, shortFormat = false) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (shortFormat) {
        return date.toLocaleDateString('cs-CZ');
    }
    return date.toLocaleDateString('cs-CZ') + ' ' + date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

function formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

// Export do CSV
function exportCSV() {
    if (allOrders.length === 0) {
        alert('Žádné objednávky k exportu');
        return;
    }
    
    const headers = ['ID', 'Zákazník', 'Email', 'Telefon', 'Celkem', 'Platba', 'Stav', 'Datum', 'ZION Tokeny'];
    const rows = allOrders.map(o => [
        o.orderId,
        `"${o.customer}"`,
        o.email,
        o.phone || '',
        o.total,
        getPaymentName(o.payment),
        getStatusName(o.status),
        o.createdAt,
        o.zionTokens || 0
    ]);
    
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    downloadFile(csv, 'objednavky-zion.csv', 'text/csv;charset=utf-8');
}

// Export do JSON
function exportJSON() {
    if (allOrders.length === 0) {
        alert('Žádné objednávky k exportu');
        return;
    }
    
    const json = JSON.stringify(allOrders, null, 2);
    downloadFile(json, 'objednavky-zion.json', 'application/json');
}

// Pomocná funkce pro stažení souboru
function downloadFile(content, filename, type) {
    const blob = new Blob(['\ufeff' + content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Tisk seznamu objednávek
function printOrders() {
    window.print();
}

// Tisk faktury
function printInvoice(event, orderId) {
    event.preventDefault();
    const printWindow = window.open(`./api/invoice.php?action=view&orderId=${orderId}`, '_blank');
    printWindow.onload = function() {
        printWindow.print();
    };
}

// Regenerovat fakturu
async function regenerateInvoice(orderId) {
    if (!confirm('Opravdu chcete regenerovat fakturu?')) return;
    
    const btn = event.target.closest('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generuji...';
    btn.disabled = true;
    
    try {
        // Vynutí regeneraci krásného PDF přes původní Python/ReportLab pipeline.
        const url = `./api/download-invoice.php?orderId=${encodeURIComponent(orderId)}&force=1`;
        window.open(url, '_blank');
        setTimeout(() => {
            loadOrders();
            viewOrder(orderId);
        }, 800);
        alert('Faktura se regeneruje a otevře se PDF.');
    } catch (error) {
        alert('Chyba při regenerování faktury');
        console.error(error);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Generovat fakturu pro objednávku (pokud ještě neexistuje)
async function generateInvoiceForOrder(orderId) {
    if (!confirm('Vygenerovat fakturu pro objednávku ' + orderId + '?')) return;
    
    try {
        // Vygeneruje (pokud chybí) a rovnou nabídne stažení PDF.
        const url = `./api/download-invoice.php?orderId=${encodeURIComponent(orderId)}`;
        window.open(url, '_blank');

        // Reload table (hasInvoice se přepne na true po vytvoření PDF)
        setTimeout(loadOrders, 800);
        alert('Faktura se generuje a otevře se PDF.');
    } catch (error) {
        alert('Chyba při generování faktury');
        console.error(error);
    }
}

// Odeslat fakturu zákazníkovi (vygenerovat + poslat)
async function sendInvoiceByOrder(orderId) {
    try {
        const res = await fetch(`./api/send-invoice-by-order.php?orderId=${encodeURIComponent(orderId)}`);
        const data = await res.json();
        if (data.success) {
            alert('Faktura odeslána zákazníkovi: ' + orderId);
        } else {
            alert('Chyba odeslání: ' + (data.error || 'Neznámá chyba'));
            console.error('send-invoice-by-order', data);
        }
    } catch (e) {
        alert('Chyba při volání API: ' + e.message);
    }
}

// ============================================
// MAINNET TOKEN DISTRIBUTION
// ============================================

// Načíst statistiky pro distribuci
async function loadDistributionStats() {
    try {
        const response = await fetch('./api/token-distribution.php?action=stats');
        const data = await response.json();
        
        if (data.success) {
            // Update presale stats
            document.getElementById('pending-presale-count').textContent = data.presale.pendingCount || 0;
            document.getElementById('pending-presale-tokens').textContent = 
                (data.presale.pendingTokens || 0).toLocaleString();
            document.getElementById('presale-amount').textContent = 
                (data.presale.pendingTokens || 0).toLocaleString() + ' ZION';
            
            // Update bonus stats
            document.getElementById('pending-bonus-count').textContent = data.bonus.pendingCount || 0;
            document.getElementById('pending-bonus-tokens').textContent = 
                (data.bonus.pendingTokens || 0).toLocaleString();
            document.getElementById('bonus-amount').textContent = 
                (data.bonus.pendingTokens || 0).toLocaleString() + ' ZION';
            
            // Update network status
            const statusEl = document.getElementById('network-status');
            const warningEl = document.getElementById('mainnet-warning');
            
            if (data.network === 'mainnet') {
                statusEl.className = 'mainnet-status mainnet';
                statusEl.innerHTML = '<i class="fa-solid fa-globe"></i><span>MainNet</span>';
                warningEl.style.display = 'none';
            } else {
                statusEl.className = 'mainnet-status Mainnet';
                statusEl.innerHTML = '<i class="fa-solid fa-flask"></i><span>Mainnet</span>';
                warningEl.style.display = 'flex';
            }
        }
    } catch (error) {
        console.error('Error loading distribution stats:', error);
    }
}

// Distribuovat presale tokeny
async function distributePresaleTokens() {
    const pendingCount = parseInt(document.getElementById('pending-presale-count')?.textContent || '0', 10) || 0;
    if (pendingCount === 0) {
        alert('Není co distribuovat: 0 presale objednávek k distribuci.');
        return;
    }
    const presaleAmount = document.getElementById('presale-amount').textContent;
    
    if (!confirm(`⚠️ POZOR: Opravdu chcete distribuovat ${presaleAmount}?\n\nTato akce je NEVRATNÁ a odešle tokeny na blockchain adresy všech presale zákazníků.`)) {
        return;
    }
    
    // Druhé potvrzení
    const confirmCode = prompt('Pro potvrzení napište "DISTRIBUTE PRESALE":');
    if (confirmCode !== 'DISTRIBUTE PRESALE') {
        alert('Distribuce zrušena.');
        return;
    }
    
    const btn = document.getElementById('btn-presale-distribute');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
        <div class="icon"><i class="fa-solid fa-spinner fa-spin"></i></div>
        <div class="title">Probíhá distribuce...</div>
        <div class="desc">Prosím čekejte, trvá to několik minut</div>
    `;
    
    try {
        const response = await fetch('./api/token-distribution.php?action=distribute-presale', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm: true })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ Distribuce dokončena!\n\n` +
                  `Odesláno: ${data.distributed.count} transakcí\n` +
                  `Celkem: ${data.distributed.tokens.toLocaleString()} ZION\n` +
                  `Úspěšných: ${data.distributed.successful}\n` +
                  `Chyb: ${data.distributed.failed}`);
            loadDistributionStats();
            loadOrders();
        } else {
            alert('❌ Chyba: ' + (data.error || 'Neznámá chyba'));
        }
    } catch (error) {
        alert('❌ Chyba při distribuci: ' + error.message);
        console.error(error);
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

// Distribuovat bonus tokeny
async function distributeBonusTokens() {
    const pendingCount = parseInt(document.getElementById('pending-bonus-count')?.textContent || '0', 10) || 0;
    if (pendingCount === 0) {
        alert('Není co distribuovat: 0 eShop bonusů k distribuci.');
        return;
    }
    const bonusAmount = document.getElementById('bonus-amount').textContent;
    
    if (!confirm(`⚠️ POZOR: Opravdu chcete distribuovat ${bonusAmount}?\n\nTato akce je NEVRATNÁ a odešle bonus tokeny na blockchain adresy všech eShop zákazníků.`)) {
        return;
    }
    
    // Druhé potvrzení
    const confirmCode = prompt('Pro potvrzení napište "DISTRIBUTE BONUS":');
    if (confirmCode !== 'DISTRIBUTE BONUS') {
        alert('Distribuce zrušena.');
        return;
    }
    
    const btn = document.getElementById('btn-bonus-distribute');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
        <div class="icon"><i class="fa-solid fa-spinner fa-spin"></i></div>
        <div class="title">Probíhá distribuce...</div>
        <div class="desc">Prosím čekejte</div>
    `;
    
    try {
        const response = await fetch('./api/token-distribution.php?action=distribute-bonus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm: true })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ Distribuce dokončena!\n\n` +
                  `Odesláno: ${data.distributed.count} transakcí\n` +
                  `Celkem: ${data.distributed.tokens.toLocaleString()} ZION\n` +
                  `Úspěšných: ${data.distributed.successful}\n` +
                  `Chyb: ${data.distributed.failed}`);
            loadDistributionStats();
            loadOrders();
        } else {
            alert('❌ Chyba: ' + (data.error || 'Neznámá chyba'));
        }
    } catch (error) {
        alert('❌ Chyba při distribuci: ' + error.message);
        console.error(error);
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

// ============================================
// TRIVI Integration Functions
// ============================================

/**
 * Odeslat objednávku do Trivi účetního systému
 */
async function sendToTrivi(orderId) {
    if (!confirm(`Opravdu chcete odeslat objednávku ${orderId} do Trivi?\n\nVytvoří se faktura v účetním systému.`)) {
        return;
    }
    
    const statusDiv = document.getElementById(`trivi-status-${orderId}`);
    statusDiv.innerHTML = '<p style="color:#00d4ff;"><i class="fa-solid fa-spinner fa-spin"></i> Odesílám do Trivi...</p>';
    
    try {
        const response = await fetch('./api/trivi-admin-api.php?action=sync_order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            statusDiv.innerHTML = `
                <div style="background:rgba(0,255,127,0.1);border:1px solid var(--rasta-green);border-radius:8px;padding:15px;">
                    <p style="color:var(--rasta-green);margin:0;"><i class="fa-solid fa-check-circle"></i> <strong>Odesláno do Trivi!</strong></p>
                    ${data.trivi_id ? `<p style="color:#888;margin:5px 0 0 0;font-size:0.9rem;">Trivi ID: <code>${data.trivi_id}</code></p>` : ''}
                </div>
            `;
            
            // Refresh status
            setTimeout(() => checkTriviStatus(orderId), 1000);
        } else {
            statusDiv.innerHTML = `
                <div style="background:rgba(255,0,0,0.1);border:1px solid #f44336;border-radius:8px;padding:15px;">
                    <p style="color:#f44336;margin:0;"><i class="fa-solid fa-exclamation-circle"></i> <strong>Chyba!</strong></p>
                    <p style="color:#ccc;margin:5px 0 0 0;font-size:0.9rem;">${data.error || 'Neznámá chyba'}</p>
                </div>
            `;
        }
    } catch (error) {
        statusDiv.innerHTML = `
            <div style="background:rgba(255,0,0,0.1);border:1px solid #f44336;border-radius:8px;padding:15px;">
                <p style="color:#f44336;margin:0;"><i class="fa-solid fa-exclamation-circle"></i> <strong>Chyba připojení!</strong></p>
                <p style="color:#ccc;margin:5px 0 0 0;font-size:0.9rem;">${error.message}</p>
            </div>
        `;
        console.error(error);
    }
}

/**
 * Zkontrolovat Trivi sync status objednávky
 */
async function checkTriviStatus(orderId) {
    const statusDiv = document.getElementById(`trivi-status-${orderId}`);
    statusDiv.innerHTML = '<p style="color:#888;"><i class="fa-solid fa-spinner fa-spin"></i> Kontroluji status...</p>';
    
    try {
        const response = await fetch(`./api/trivi-admin-api.php?action=check_status&order_id=${orderId}`);
        const data = await response.json();
        
        if (data.synced) {
            if (data.status === 'success') {
                statusDiv.innerHTML = `
                    <div style="background:rgba(0,255,127,0.1);border:1px solid var(--rasta-green);border-radius:8px;padding:15px;">
                        <p style="color:var(--rasta-green);margin:0;"><i class="fa-solid fa-check-circle"></i> <strong>Synchronizováno</strong></p>
                        ${data.document_number ? `<p style="color:#888;margin:5px 0 0 0;font-size:0.9rem;">Číslo dokladu: <code>${data.document_number}</code></p>` : ''}
                        ${data.trivi_id ? `<p style="color:#888;margin:5px 0 0 0;font-size:0.9rem;">Trivi ID: <code>${data.trivi_id}</code></p>` : ''}
                        <p style="color:#666;margin:5px 0 0 0;font-size:0.85rem;">${data.created_at || ''}</p>
                    </div>
                `;
            } else if (data.status === 'failed') {
                statusDiv.innerHTML = `
                    <div style="background:rgba(255,193,7,0.1);border:1px solid var(--rasta-gold);border-radius:8px;padding:15px;">
                        <p style="color:var(--rasta-gold);margin:0;"><i class="fa-solid fa-exclamation-triangle"></i> <strong>Synchronizace selhala</strong></p>
                        <p style="color:#ccc;margin:5px 0 0 0;font-size:0.9rem;">${data.error_message || 'Neznámá chyba'}</p>
                        ${data.can_retry ? `<button onclick="sendToTrivi('${orderId}')" class="rasta-btn" style="margin-top:10px;padding:6px 12px;font-size:0.9rem;"><i class="fa-solid fa-rotate"></i> Zkusit znovu</button>` : ''}
                    </div>
                `;
            } else {
                statusDiv.innerHTML = `
                    <div style="background:rgba(100,100,100,0.1);border:1px solid #666;border-radius:8px;padding:15px;">
                        <p style="color:#888;margin:0;"><i class="fa-solid fa-clock"></i> <strong>Čeká na zpracování</strong></p>
                    </div>
                `;
            }
        } else {
            statusDiv.innerHTML = `
                <div style="background:rgba(100,100,100,0.1);border:1px solid #666;border-radius:8px;padding:15px;">
                    <p style="color:#888;margin:0;"><i class="fa-solid fa-circle-info"></i> Objednávka nebyla odeslána do Trivi</p>
                </div>
            `;
        }
    } catch (error) {
        statusDiv.innerHTML = `<p style="color:#f44336;"><i class="fa-solid fa-exclamation-circle"></i> Chyba: ${error.message}</p>`;
        console.error(error);
    }
}

// ============================================
// LEDGER MANAGEMENT
// ============================================

let ledgerData = [];

async function loadLedger() {
    try {
        const response = await fetch('./api/ledger-admin.php?action=list');
        const result = await response.json();
        
        if (result.success) {
            ledgerData = result.data || [];
            renderLedgerTable();
            updateLedgerStats();
        } else {
            console.error('Failed to load ledger:', result.error);
            document.getElementById('ledger-tbody').innerHTML = 
                '<tr><td colspan="9" style="text-align:center;color:#f44336;">Chyba načítání ledgeru</td></tr>';
        }
    } catch (error) {
        console.error('Ledger load error:', error);
        document.getElementById('ledger-tbody').innerHTML = 
            '<tr><td colspan="9" style="text-align:center;color:#f44336;">Chyba připojení</td></tr>';
    }
}

function renderLedgerTable() {
    const tbody = document.getElementById('ledger-tbody');
    
    if (!ledgerData || ledgerData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#888;">Žádné záznamy v ledgeru</td></tr>';
        return;
    }
    
    tbody.innerHTML = ledgerData.map(entry => {
        const statusClass = getLedgerStatusClass(entry.status);
        const txHash = entry.txHash ? 
            `<a href="https://explorer.zionterranova.com/tx/${entry.txHash}" target="_blank" style="color:var(--rasta-gold);">${entry.txHash.substring(0,10)}...</a>` : 
            '<span style="color:#666;">-</span>';
        
        return `
            <tr>
                <td><code style="color:#9b59b6;">${entry.id || '-'}</code></td>
                <td><code style="color:var(--rasta-gold);">${entry.orderId || '-'}</code></td>
                <td style="font-size:0.85em;">${entry.walletId || entry.wallet || '-'}</td>
                <td><strong style="color:var(--rasta-green);">${(entry.tokens || 0).toLocaleString()}</strong></td>
                <td><span class="status-badge ${statusClass}">${entry.status || 'pending'}</span></td>
                <td>${entry.source || '-'}</td>
                <td style="font-size:0.85em;">${formatDate(entry.createdAt)}</td>
                <td>${txHash}</td>
                <td>
                    <button class="action-btn view" onclick="viewLedgerDetail('${entry.id}')">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="action-btn" style="background:#f44336;color:#fff;margin-left:5px;" onclick="deleteLedgerEntry('${entry.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateLedgerStats() {
    const count = ledgerData.length;
    const totalTokens = ledgerData.reduce((sum, e) => sum + (e.tokens || 0), 0);
    const pending = ledgerData.filter(e => e.status === 'pending').length;
    
    document.getElementById('ledger-count').textContent = count;
    document.getElementById('ledger-tokens').textContent = totalTokens.toLocaleString();
    document.getElementById('ledger-pending').textContent = pending;
    document.getElementById('count-ledger').textContent = count;
}

function getLedgerStatusClass(status) {
    const map = {
        'pending': 'status-pending_payment',
        'confirmed': 'status-paid',
        'distributed': 'status-completed',
        'cancelled': 'status-cancelled'
    };
    return map[status] || 'status-new';
}

function showAddLedgerModal() {
    document.getElementById('ledger-add-modal').classList.add('active');
    document.getElementById('ledger-add-form').reset();
}

function closeLedgerModal() {
    document.getElementById('ledger-add-modal').classList.remove('active');
}

function closeLedgerDetailModal() {
    document.getElementById('ledger-detail-modal').classList.remove('active');
}

async function submitLedgerEntry(event) {
    event.preventDefault();
    
    const data = {
        orderId: document.getElementById('ledger-order-id').value || null,
        wallet: document.getElementById('ledger-wallet').value,
        tokens: parseInt(document.getElementById('ledger-tokens-input').value),
        source: document.getElementById('ledger-source').value,
        note: document.getElementById('ledger-note').value || null
    };
    
    try {
        const response = await fetch('./api/ledger-admin.php?action=add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Záznam úspěšně přidán!');
            closeLedgerModal();
            await loadLedger();
        } else {
            alert('Chyba: ' + (result.error || 'Neznámá chyba'));
        }
    } catch (error) {
        alert('Chyba připojení: ' + error.message);
    }
}

async function deleteLedgerEntry(id) {
    if (!confirm(`Opravdu smazat záznam ${id}?`)) return;
    
    try {
        const response = await fetch(`./api/ledger-admin.php?action=delete&id=${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadLedger();
        } else {
            alert('Chyba mazání: ' + (result.error || 'Neznámá chyba'));
        }
    } catch (error) {
        alert('Chyba: ' + error.message);
    }
}

function viewLedgerDetail(id) {
    const entry = ledgerData.find(e => e.id === id);
    if (!entry) return;
    
    const modal = document.getElementById('ledger-detail-modal');
    const body = document.getElementById('ledger-detail-body');
    
    body.innerHTML = `
        <div style="display:grid;gap:15px;">
            <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:15px;">
                <h4 style="color:#9b59b6;margin:0 0 10px;"><i class="fa-solid fa-info-circle"></i> Základní údaje</h4>
                <p><strong>ID:</strong> <code style="color:#9b59b6;">${entry.id}</code></p>
                <p><strong>Order ID:</strong> <code style="color:var(--rasta-gold);">${entry.orderId || '-'}</code></p>
                <p><strong>Vytvořeno:</strong> ${entry.createdAt || '-'}</p>
                <p><strong>Zdroj:</strong> ${entry.source || '-'}</p>
            </div>
            
            <div style="background:#1a1a1a;border:1px solid var(--rasta-green);border-radius:8px;padding:15px;">
                <h4 style="color:var(--rasta-green);margin:0 0 10px;"><i class="fa-solid fa-wallet"></i> Wallet & Tokeny</h4>
                <p><strong>Wallet ID:</strong> ${entry.walletId || '-'}</p>
                <p><strong>Wallet Address:</strong> <code style="font-size:0.85em;word-break:break-all;">${entry.wallet || entry.walletUri || '-'}</code></p>
                <p><strong>Tokeny:</strong> <span style="color:var(--rasta-green);font-size:1.5em;font-weight:bold;">${(entry.tokens || 0).toLocaleString()} ZION</span></p>
            </div>
            
            <div style="background:#1a1a1a;border:1px solid var(--rasta-gold);border-radius:8px;padding:15px;">
                <h4 style="color:var(--rasta-gold);margin:0 0 10px;"><i class="fa-solid fa-clock"></i> Status</h4>
                <p><strong>Status:</strong> <span class="status-badge ${getLedgerStatusClass(entry.status)}">${entry.status || 'pending'}</span></p>
                <p><strong>Network:</strong> ${entry.network || 'mainnet'}</p>
                <p><strong>TX Hash:</strong> ${entry.txHash ? `<a href="https://explorer.zionterranova.com/tx/${entry.txHash}" target="_blank" style="color:var(--rasta-gold);">${entry.txHash}</a>` : '<span style="color:#666;">Čeká na distribuci</span>'}</p>
            </div>
            
            ${entry.note ? `
            <div style="background:#1a1a1a;border:1px solid #666;border-radius:8px;padding:15px;">
                <h4 style="color:#888;margin:0 0 10px;"><i class="fa-solid fa-sticky-note"></i> Poznámka</h4>
                <p style="color:#ccc;">${entry.note}</p>
            </div>
            ` : ''}
            
            ${entry.details ? `
            <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:15px;">
                <h4 style="color:#888;margin:0 0 10px;"><i class="fa-solid fa-list"></i> Položky</h4>
                <pre style="background:#0a0a0a;padding:10px;border-radius:5px;overflow-x:auto;font-size:0.8em;color:#888;">${JSON.stringify(entry.details, null, 2)}</pre>
            </div>
            ` : ''}
        </div>
    `;
    
    modal.classList.add('active');
}

function exportLedgerJSON() {
    const blob = new Blob([JSON.stringify(ledgerData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zion-ledger-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportLedgerCSV() {
    const headers = ['ID', 'Order ID', 'Wallet ID', 'Wallet Address', 'Tokens', 'Status', 'Source', 'Created', 'TX Hash'];
    const rows = ledgerData.map(e => [
        e.id || '',
        e.orderId || '',
        e.walletId || '',
        e.wallet || '',
        e.tokens || 0,
        e.status || '',
        e.source || '',
        e.createdAt || '',
        e.txHash || ''
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zion-ledger-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function refreshLedger() {
    document.getElementById('ledger-tbody').innerHTML = 
        '<tr><td colspan="9" class="loading"><i class="fa-solid fa-spinner"></i><p>Načítám...</p></td></tr>';
    loadLedger();
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // ESC zavře modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeLedgerModal();
            closeLedgerDetailModal();
        }
    });
    
    // Klik mimo modal zavře
    document.getElementById('order-modal').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) closeModal();
    });
    
    // Override viewOrder for Trivi auto-check
    const originalViewOrder = viewOrder;
    window.viewOrder = async function(orderId) {
        await originalViewOrder(orderId);
        setTimeout(() => checkTriviStatus(orderId), 500);
    };
    
    // Extend switchTab to handle ledger
    const originalSwitchTab = switchTab;
    window.switchTab = function(tab) {
        if (tab === 'ledger') {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById('tab-ledger').classList.add('active');
            document.getElementById('content-ledger').classList.add('active');
            currentTab = 'ledger';
            if (ledgerData.length === 0) {
                loadLedger();
            }
        } else {
            originalSwitchTab(tab);
        }
    };
    
    // Inicializace - načíst data
    loadOrders();
    loadDistributionStats();
    
    // Load ledger after short delay
    setTimeout(loadLedger, 1000);
});
