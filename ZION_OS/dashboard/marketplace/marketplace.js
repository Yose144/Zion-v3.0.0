(() => {
  'use strict';

  const LS = localStorage;
  let config = {
    baseUrl: LS.getItem('zion_marketplace_url') || 'https://market.zionterranova.com',
    apiKey: LS.getItem('zion_marketplace_key') || '',
  };

  let state = {
    view: 'orders',
    page: 1,
    limit: 25,
    filterStatus: '',
    filterPayment: '',
    search: '',
    orders: [],
    total: 0,
    selected: null,
  };

  const byId = (id) => document.getElementById(id);
  const money = (n) => `${Math.round(n).toLocaleString('cs-CZ')} Kč`;
  const fmtDate = (d) => d ? new Date(d).toLocaleString('cs-CZ') : '—';

  const statusBadge = (status) => {
    const cls = {
      pending: 'badge-pending',
      paid: 'badge-paid',
      processing: 'badge-cyan',
      shipped: 'badge-shipped',
      completed: 'badge-completed',
      cancelled: 'badge-cancelled',
    }[status] || 'badge-pending';
    return `<span class="badge ${cls}">${status}</span>`;
  };

  const paymentBadge = (status) => {
    const cls = {
      pending: 'badge-pending',
      paid: 'badge-paid',
      failed: 'badge-failed',
    }[status] || 'badge-pending';
    return `<span class="badge ${cls}">${status}</span>`;
  };

  const showError = (msg) => {
    const box = byId('error-box');
    box.textContent = msg;
    box.classList.remove('hidden');
    setTimeout(() => box.classList.add('hidden'), 8000);
  };

  const clearError = () => byId('error-box').classList.add('hidden');

  async function api(method, path, body) {
    const url = `${config.baseUrl.replace(/\/$/, '')}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    };
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(url, opts);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return data;
    } catch (e) {
      showError(`API chyba: ${e.message}`);
      throw e;
    }
  }

  function defaultFiltersForView(view) {
    switch (view) {
      case 'shipping':
        return { status: '', paymentStatus: '', search: '' };
      case 'stripe':
        return { status: '', paymentStatus: '', search: '' };
      case 'invoices':
        return { status: '', paymentStatus: '', search: '' };
      default:
        return { status: '', paymentStatus: '', search: '' };
    }
  }

  function setView(view) {
    state.view = view;
    const defaults = defaultFiltersForView(view);
    state.filterStatus = defaults.status;
    state.filterPayment = defaults.paymentStatus;
    state.search = defaults.search;
    state.page = 1;

    document.querySelectorAll('#tabs .tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === view);
    });

    byId('filter-status').value = state.filterStatus;
    byId('filter-payment').value = state.filterPayment;
    byId('filter-search').value = state.search;

    loadOrders();
  }

  function loadOrders() {
    const params = new URLSearchParams();
    params.set('page', String(state.page));
    params.set('limit', String(state.limit));
    if (state.filterStatus) params.set('status', state.filterStatus);
    if (state.filterPayment) params.set('paymentStatus', state.filterPayment);
    if (state.search) params.set('search', state.search);

    api('GET', `/api/admin/orders?${params.toString()}`).then((res) => {
      state.orders = res.data.orders || [];
      state.total = res.data.total || 0;
      renderOrders();
    });
  }

  function orderMatchesView(o) {
    if (state.view === 'shipping') {
      return ['paid', 'processing', 'shipped', 'completed'].includes(o.status);
    }
    if (state.view === 'stripe') {
      return o.payment === 'card' || o.payment === 'stripe';
    }
    if (state.view === 'invoices') {
      return true;
    }
    return true;
  }

  function renderOrders() {
    const tbody = byId('orders-body');
    const filtered = state.orders.filter(orderMatchesView);

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-gray-500">Žádné objednávky</td></tr>';
    } else {
      tbody.innerHTML = filtered.map((o) => `
        <tr data-id="${o.id}">
          <td><div class="font-semibold">${o.orderId}</div><div class="text-xs text-gray-500">${o.payment || '—'}</div></td>
          <td><div class="font-semibold">${o.customerName}</div><div class="text-xs text-gray-500">${o.customerEmail}</div></td>
          <td>${money(o.totalCzk)}</td>
          <td>${statusBadge(o.status)}</td>
          <td>${paymentBadge(o.paymentStatus)}</td>
          <td class="text-gray-400 text-xs">${fmtDate(o.createdAt)}</td>
          <td class="text-right">
            <button class="btn btn-sm btn-cyan detail-btn" data-id="${o.id}"><i class="fas fa-eye"></i></button>
          </td>
        </tr>
      `).join('');
    }

    const pages = Math.ceil(state.total / state.limit) || 1;
    const label = state.view === 'invoices' ? 'faktur' : state.view === 'shipping' ? 'zasilek' : state.view === 'stripe' ? 'plateb' : 'objednavek';
    byId('orders-meta').textContent = `Strana ${state.page} / ${pages} · Celkem ${state.total} ${label}`;
    byId('btn-prev').disabled = state.page <= 1;
    byId('btn-next').disabled = state.page >= pages;

    document.querySelectorAll('.detail-btn').forEach((b) => {
      b.addEventListener('click', () => openDetail(b.dataset.id));
    });
  }

  async function openDetail(id) {
    clearError();
    const modal = byId('modal-detail');
    byId('detail-content').innerHTML = '<p class="text-gray-400">Načítání…</p>';
    modal.classList.remove('hidden');

    try {
      const res = await api('GET', `/api/admin/orders/${id}`);
      state.selected = res.data;
      renderDetail(res.data);
    } catch (e) {
      byId('detail-content').innerHTML = `<p class="text-red-300">Chyba: ${e.message}</p>`;
    }
  }

  function renderDetail(o) {
    const items = Array.isArray(o.items) ? o.items.map((it) => `
      <div class="flex justify-between text-sm py-1 border-b border-white/5">
        <span>${it.name} × ${it.quantity}</span>
        <span class="font-mono">${money(it.priceCzk * it.quantity)}</span>
      </div>
    `).join('') : '—';

    const address = [o.addressStreet, o.addressCity, o.addressZip].filter(Boolean).join(', ');
    const pickup = o.pickupPoint ? (typeof o.pickupPoint === 'string' ? o.pickupPoint : JSON.stringify(o.pickupPoint)) : '—';

    const invoices = o.invoices?.length ? o.invoices.map((inv) => `
      <span class="badge badge-paid mr-1">${inv.invoiceNumber} · ${inv.status}</span>
    `).join('') : '<span class="text-gray-500">—</span>';

    const showStatus = state.view === 'orders' || state.view === 'shipping';
    const showPayment = state.view === 'orders' || state.view === 'stripe';
    const showInvoice = state.view === 'orders' || state.view === 'invoices';
    const showTracking = state.view === 'orders' || state.view === 'shipping';
    const showStripe = state.view === 'orders' || state.view === 'stripe';

    let actions = '';

    if (showStatus) {
      actions += `
        <div class="flex gap-2 items-center">
          <select id="action-status" class="input bg-black/40 flex-1">
            <option value="">Změnit status objednávky</option>
            <option value="pending">pending</option>
            <option value="paid">paid</option>
            <option value="processing">processing</option>
            <option value="shipped">shipped</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
          </select>
          <button id="btn-set-status" class="btn btn-purple">Uložit</button>
        </div>`;
    }

    if (showPayment) {
      actions += `
        <div class="flex gap-2 items-center">
          <select id="action-payment" class="input bg-black/40 flex-1">
            <option value="">Změnit status platby</option>
            <option value="pending">pending</option>
            <option value="paid">paid</option>
            <option value="failed">failed</option>
          </select>
          <button id="btn-set-payment" class="btn btn-purple">Uložit</button>
        </div>`;
    }

    if (showTracking) {
      actions += `
        <div class="flex gap-2 items-center">
          <input type="text" id="action-tracking" class="input flex-1" placeholder="Tracking číslo" value="${o.trackingNumber || ''}" />
          <button id="btn-set-tracking" class="btn btn-cyan">Uložit</button>
        </div>`;
    }

    if (showStripe) {
      actions += `
        <button id="btn-stripe" class="btn btn-gold" ${o.paymentStatus === 'paid' ? 'disabled' : ''}><i class="fab fa-stripe mr-2"></i>Odeslat Stripe platbu</button>`;
    }

    if (showInvoice) {
      actions += `
        <div class="card p-4 mb-4">
          <h3 class="text-sm font-bold text-gray-400 uppercase mb-2">Faktury</h3>
          <div class="mb-2">${invoices}</div>
          <button id="btn-create-invoice" class="btn btn-gold mr-2"><i class="fas fa-file-invoice mr-2"></i>Vytvořit fakturu</button>
          <button id="btn-view-invoice" class="btn btn-cyan ${o.invoices?.length ? '' : 'hidden'}"><i class="fas fa-eye mr-2"></i>Zobrazit fakturu</button>
        </div>`;
    }

    byId('detail-content').innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 class="text-xl font-bold mb-2">Objednávka <span style="color:rgb(252 209 22)">${o.orderId}</span></h2>
          <p class="text-sm text-gray-400 mb-4">Vytvořeno: ${fmtDate(o.createdAt)} · Aktualizováno: ${fmtDate(o.updatedAt)}</p>
          <div class="card p-4 mb-4">
            <h3 class="text-sm font-bold text-gray-400 uppercase mb-2">Zákazník</h3>
            <p class="font-semibold">${o.customerName}</p>
            <p class="text-sm text-gray-300">${o.customerEmail}</p>
            <p class="text-sm text-gray-300">${o.customerPhone}</p>
            <p class="text-sm text-gray-300 mt-2">${address || '—'}</p>
            <p class="text-sm text-gray-300">Výdejní místo: ${pickup}</p>
          </div>
          <div class="card p-4 mb-4">
            <h3 class="text-sm font-bold text-gray-400 uppercase mb-2">Doprava a platba</h3>
            <p class="text-sm"><strong>Doprava:</strong> ${o.shipping} · ${money(o.shippingCzk)}</p>
            <p class="text-sm"><strong>Platba:</strong> ${o.payment}</p>
            <p class="text-sm"><strong>Zion tokens:</strong> ${o.zionTokens || 0}</p>
            <p class="text-sm"><strong>Tracking:</strong> ${o.trackingNumber ? `<a href="https://www.zasilkovna.cz/zasilka/${o.trackingNumber}" target="_blank" class="text-cyan-300 hover:underline">${o.trackingNumber}</a>` : '—'}</p>
          </div>
        </div>
        <div>
          <div class="card p-4 mb-4">
            <h3 class="text-sm font-bold text-gray-400 uppercase mb-2">Položky</h3>
            ${items}
            <div class="flex justify-between font-bold mt-3 pt-2 border-t border-white/10">
              <span>Celkem</span>
              <span style="color:rgb(252 209 22)">${money(o.totalCzk)}</span>
            </div>
          </div>
          <div class="card p-4">
            <h3 class="text-sm font-bold text-gray-400 uppercase mb-2">Akce</h3>
            <div class="grid grid-cols-1 gap-2">
              ${actions}
            </div>
          </div>
        </div>
      </div>
    `;

    byId('btn-close-detail')?.addEventListener('click', closeDetail);
    byId('btn-set-status')?.addEventListener('click', () => setOrderStatus(o.id, byId('action-status').value));
    byId('btn-set-payment')?.addEventListener('click', () => setPaymentStatus(o.id, byId('action-payment').value));
    byId('btn-set-tracking')?.addEventListener('click', () => setTracking(o.id, byId('action-tracking').value));
    byId('btn-create-invoice')?.addEventListener('click', () => createInvoice(o.id));
    byId('btn-view-invoice')?.addEventListener('click', () => viewInvoice(o.id));
    byId('btn-stripe')?.addEventListener('click', () => stripeCheckout(o.id, o.customerEmail));
  }

  function closeDetail() {
    byId('modal-detail').classList.add('hidden');
    state.selected = null;
  }

  function closeInvoice() {
    byId('modal-invoice').classList.add('hidden');
    byId('invoice-frame').srcdoc = '';
  }

  async function setOrderStatus(id, status) {
    if (!status) return;
    await api('POST', `/api/admin/orders/${id}/status`, { status });
    showError(`Status objednávky byl změněn na ${status}.`);
    setTimeout(clearError, 100);
    openDetail(id);
    loadOrders();
  }

  async function setPaymentStatus(id, paymentStatus) {
    if (!paymentStatus) return;
    await api('POST', `/api/admin/orders/${id}/status`, { paymentStatus });
    openDetail(id);
    loadOrders();
  }

  async function setTracking(id, trackingNumber) {
    await api('POST', `/api/admin/orders/${id}/shipping`, { trackingNumber });
    openDetail(id);
    loadOrders();
  }

  async function createInvoice(id) {
    const res = await api('POST', `/api/admin/orders/${id}/invoice`, { dueDays: 14 });
    showError(`Faktura ${res.data.invoiceNumber} byla vytvořena.`);
    openDetail(id);
    loadOrders();
  }

  async function viewInvoice(id) {
    const res = await api('GET', `/api/admin/orders/${id}/invoice`);
    if (!res.data.html) {
      showError('Faktura zatím nemá HTML obsah.');
      return;
    }
    byId('invoice-frame').srcdoc = res.data.html;
    byId('modal-invoice').classList.remove('hidden');
  }

  async function stripeCheckout(id, customerEmail) {
    const res = await api('POST', `/api/stripe/checkout`, { orderId: id, customerEmail });
    if (res.data.url) {
      window.open(res.data.url, '_blank');
    }
  }

  function applyFilters() {
    state.filterStatus = byId('filter-status').value;
    state.filterPayment = byId('filter-payment').value;
    state.search = byId('filter-search').value.trim();
    state.page = 1;
    loadOrders();
  }

  function saveSettings() {
    config.baseUrl = byId('setting-url').value.replace(/\/$/, '') || 'https://market.zionterranova.com';
    config.apiKey = byId('setting-key').value.trim();
    LS.setItem('zion_marketplace_url', config.baseUrl);
    LS.setItem('zion_marketplace_key', config.apiKey);
    showError('Nastavení uloženo.');
    loadOrders();
  }

  function initTabs() {
    document.querySelectorAll('#tabs .tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        setView(tab.dataset.tab);
        if (window.location.hash !== `#${tab.dataset.tab}`) {
          window.location.hash = tab.dataset.tab;
        }
      });
    });

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'orders';
      if (['orders', 'invoices', 'shipping', 'stripe', 'settings'].includes(hash)) {
        setView(hash);
      }
    });
  }

  function init() {
    byId('setting-url').value = config.baseUrl;
    byId('setting-key').value = config.apiKey;

    initTabs();

    byId('btn-save-settings').addEventListener('click', saveSettings);
    byId('btn-filter').addEventListener('click', applyFilters);
    byId('filter-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') applyFilters(); });
    byId('filter-status').addEventListener('change', applyFilters);
    byId('filter-payment').addEventListener('change', applyFilters);

    byId('btn-prev').addEventListener('click', () => { if (state.page > 1) { state.page--; loadOrders(); } });
    byId('btn-next').addEventListener('click', () => { const max = Math.ceil(state.total / state.limit) || 1; if (state.page < max) { state.page++; loadOrders(); } });
    byId('btn-refresh').addEventListener('click', loadOrders);

    byId('btn-close-detail').addEventListener('click', closeDetail);
    byId('btn-close-invoice').addEventListener('click', closeInvoice);

    const hash = window.location.hash.replace('#', '') || 'orders';
    if (['orders', 'invoices', 'shipping', 'stripe', 'settings'].includes(hash)) {
      setView(hash);
    } else {
      setView('orders');
    }

    if (!config.apiKey) {
      setView('settings');
      showError('Zadejte Admin API Key v nastavení.');
    }
  }

  window.addEventListener('DOMContentLoaded', init);
})();
