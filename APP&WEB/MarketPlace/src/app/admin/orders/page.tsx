'use client';

import { useEffect, useMemo, useState, Fragment } from 'react';
import {
  listAdminOrders,
  updateOrderStatus,
  updateTrackingNumber,
  sendInvoiceEmail,
  regenerateInvoice,
  type AdminOrdersListResult,
} from '@/lib/shop-api';

const ORDER_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed'];

const STATUS_LABELS: Record<string, string> = {
  pending: '⏳ Čeká',
  paid: '✅ Zaplaceno',
  processing: '⚙️ Zpracovává se',
  shipped: '📦 Odesláno',
  completed: '🎉 Dokončeno',
  cancelled: '❌ Zrušeno',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300',
  paid: 'bg-emerald-500/20 text-emerald-300',
  processing: 'bg-blue-500/20 text-blue-300',
  shipped: 'bg-purple-500/20 text-purple-300',
  completed: 'bg-green-500/20 text-green-300',
  cancelled: 'bg-red-500/20 text-red-300',
};

const PAYMENT_LABELS: Record<string, string> = {
  card: 'Karta',
  transfer: 'Převod',
  crypto: 'Krypto',
  cash: 'Dobírka',
};

function formatPrice(amount: number): string {
  return `${Math.round(amount).toLocaleString('cs-CZ')} Kč`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('cs-CZ');
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return `${d.toLocaleDateString('cs-CZ')} ${d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}`;
}

function getItemsCount(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, it) => {
    const raw = it as Record<string, unknown>;
    return sum + (Math.round((raw.quantity as number) || 1));
  }, 0);
}

function getItemsList(items: unknown): { name: string; quantity: number; priceCzk: number; total: number }[] {
  if (!Array.isArray(items)) return [];
  return items.map((it) => {
    const raw = it as Record<string, unknown>;
    const qty = Math.max(1, Math.round((raw.quantity as number) || 1));
    const price = Math.round((raw.priceCzk as number) || 0);
    return {
      name: String(raw.name ?? 'Produkt'),
      quantity: qty,
      priceCzk: price,
      total: qty * price,
    };
  });
}

function downloadFile(content: string, filename: string, type: string) {
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

type OrderRow = NonNullable<AdminOrdersListResult['data']>['orders'][number];

function exportCSV(orders: OrderRow[]) {
  const headers = ['ID', 'Zákazník', 'Email', 'Telefon', 'Celkem', 'Platba', 'Stav platby', 'Stav objednávky', 'ZION', 'Datum'];
  const rows = orders.map((o) => [
    o.orderId,
    `"${o.customerName}"`,
    o.customerEmail,
    o.customerPhone || '',
    o.totalCzk,
    PAYMENT_LABELS[o.payment] || o.payment,
    o.paymentStatus,
    o.status,
    o.zionTokens || 0,
    o.createdAt,
  ]);
  const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
  downloadFile(csv, 'objednavky-zion.csv', 'text/csv;charset=utf-8');
}

function exportJSON(orders: OrderRow[]) {
  downloadFile(JSON.stringify(orders, null, 2), 'objednavky-zion.json', 'application/json');
}

export default function AdminOrdersPage() {
  const [data, setData] = useState<AdminOrdersListResult['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'all' | 'pending' | 'paid' | 'shipped'>('all');

  const load = async () => {
    setLoading(true);
    const res = await listAdminOrders({ status, paymentStatus, search, page, limit: 100 });
    if (res?.data) {
      setData(res.data);
      setError(null);
    } else {
      setError('Chyba při načítání objednávek');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [status, paymentStatus, page]);

  const debouncedSearch = useMemo(() => {
    let timer: ReturnType<typeof setTimeout>;
    return (value: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setSearch(value);
        setPage(1);
        load();
      }, 400);
    };
  }, []);

  const handleStatus = async (id: string, newStatus: string) => {
    await updateOrderStatus(id, newStatus);
    await load();
  };

  const handleTracking = async (id: string) => {
    const value = tracking[id];
    if (!value) return;
    await updateTrackingNumber(id, value);
    await load();
  };

  const handleSendInvoice = async (id: string) => {
    const res = await sendInvoiceEmail(id);
    if (res?.success) {
      alert('Faktura odeslána zákazníkovi emailem');
    } else {
      alert('Chyba: ' + (res?.error || 'neznámá'));
    }
  };

  const handleRegenerateInvoice = async (id: string) => {
    if (!confirm('Opravdu chcete regenerovat fakturu?')) return;
    await regenerateInvoice(id);
    await load();
  };

  const stats = data?.stats;
  const allOrders = data?.orders || [];

  // Filter by tab
  const filteredOrders = allOrders.filter((o) => {
    if (tab === 'pending') return o.status === 'pending';
    if (tab === 'paid') return o.status === 'paid' || o.paymentStatus === 'paid';
    if (tab === 'shipped') return o.status === 'shipped' || o.status === 'completed';
    return true;
  });

  const countPending = allOrders.filter((o) => o.status === 'pending').length;
  const countPaid = allOrders.filter((o) => o.status === 'paid' || o.paymentStatus === 'paid').length;
  const countShipped = allOrders.filter((o) => o.status === 'shipped' || o.status === 'completed').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gradient">Dashboard Objednávek</h1>
        <button
          onClick={load}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-rasta-gold hover:text-rasta-gold text-sm transition"
        >
          ↻ Obnovit
        </button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card-glow p-5 rounded-2xl">
            <div className="text-2xl mb-2">🛒</div>
            <div className="text-2xl font-black text-white">{stats.totalOrders}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Celkem objednávek</div>
          </div>
          <div className="card-glow p-5 rounded-2xl">
            <div className="text-2xl mb-2">💰</div>
            <div className="text-2xl font-black text-rasta-gold">{formatPrice(stats.totalRevenue)}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Celková tržba</div>
          </div>
          <div className="card-glow p-5 rounded-2xl">
            <div className="text-2xl mb-2">⚡</div>
            <div className="text-2xl font-black text-emerald-400">{stats.totalTokens.toLocaleString('cs-CZ')}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">ZION tokenů</div>
          </div>
          <div className="card-glow p-5 rounded-2xl">
            <div className="text-2xl mb-2">⏳</div>
            <div className="text-2xl font-black text-yellow-400">{stats.pendingPayment}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Čeká na platbu</div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 mb-4 p-4 rounded-xl bg-white/[0.03]">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="bg-zion-card border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-rasta-gold focus:outline-none"
        >
          <option value="">Všechny stavy</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        <select
          value={paymentStatus}
          onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }}
          className="bg-zion-card border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-rasta-gold focus:outline-none"
        >
          <option value="">Všechny platby</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s === 'paid' ? '✅ Zaplaceno' : s === 'pending' ? '⏳ Čeká' : '❌ Selhalo'}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="🔍 Hledat (ID, jméno, email...)"
          onChange={(e) => debouncedSearch(e.target.value)}
          className="bg-zion-card border border-white/10 rounded-lg px-3 py-2 text-sm min-w-[260px] flex-1 focus:border-rasta-gold focus:outline-none"
        />

        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => exportCSV(filteredOrders)}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-rasta-gold hover:text-rasta-gold text-xs transition"
          >
            📄 CSV
          </button>
          <button
            onClick={() => exportJSON(filteredOrders)}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-rasta-gold hover:text-rasta-gold text-xs transition"
          >
            {} JSON
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-rasta-gold hover:text-rasta-gold text-xs transition"
          >
            🖨️ Tisk
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-white/10">
        <button
          onClick={() => setTab('all')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${tab === 'all' ? 'border-rasta-gold text-rasta-gold' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          📋 Vše <span className="ml-1 px-2 py-0.5 rounded-full bg-white/10 text-xs">{allOrders.length}</span>
        </button>
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${tab === 'pending' ? 'border-rasta-gold text-rasta-gold' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          ⏳ Čeká <span className="ml-1 px-2 py-0.5 rounded-full bg-white/10 text-xs">{countPending}</span>
        </button>
        <button
          onClick={() => setTab('paid')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${tab === 'paid' ? 'border-rasta-gold text-rasta-gold' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          ✅ Zaplaceno <span className="ml-1 px-2 py-0.5 rounded-full bg-white/10 text-xs">{countPaid}</span>
        </button>
        <button
          onClick={() => setTab('shipped')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${tab === 'shipped' ? 'border-rasta-gold text-rasta-gold' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          📦 Odesláno <span className="ml-1 px-2 py-0.5 rounded-full bg-white/10 text-xs">{countShipped}</span>
        </button>
      </div>

      {loading && <p className="text-gray-400 py-8 text-center">Načítám...</p>}
      {error && <p className="text-red-400 py-8 text-center">{error}</p>}

      {!loading && !error && filteredOrders.length === 0 && (
        <p className="text-gray-400 py-8 text-center">Žádné objednávky</p>
      )}

      {!loading && !error && filteredOrders.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-zion-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-gray-400 text-xs uppercase tracking-wider">
                  <th className="p-3">ID</th>
                  <th className="p-3">Datum</th>
                  <th className="p-3">Zákazník</th>
                  <th className="p-3">Položky</th>
                  <th className="p-3">Celkem</th>
                  <th className="p-3">ZION</th>
                  <th className="p-3">Faktura</th>
                  <th className="p-3">Stav</th>
                  <th className="p-3">Akce</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <Fragment key={order.id}>
                    <tr
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                      onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                    >
                      <td className="p-3 font-mono text-rasta-green text-xs">{order.orderId}</td>
                      <td className="p-3 text-gray-400 text-xs">{formatDate(order.createdAt)}</td>
                      <td className="p-3">
                        <div className="font-semibold">{order.customerName}</div>
                        <div className="text-xs text-gray-500">{order.customerEmail}</div>
                      </td>
                      <td className="p-3 text-gray-400">{getItemsCount(order.items)} ks</td>
                      <td className="p-3 font-mono font-bold">{formatPrice(order.totalCzk)}</td>
                      <td className="p-3">
                        {order.zionTokens > 0 ? (
                          <span className="text-rasta-gold font-bold">{order.zionTokens.toLocaleString('cs-CZ')}</span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {order.invoices[0] ? (
                          <div className="flex gap-1">
                            <a
                              href={`/api/invoice/${order.invoices[0].id}/download`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="px-2 py-1 rounded bg-rasta-gold/20 text-rasta-gold hover:bg-rasta-gold/30 text-xs"
                              title="Zobrazit fakturu"
                            >
                              📄 {order.invoices[0].invoiceNumber}
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_COLORS[order.status] || 'bg-gray-500/20 text-gray-300'}`}>
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpanded(expanded === order.id ? null : order.id); }}
                          className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10"
                        >
                          {expanded === order.id ? '▲ Skrýt' : '▼ Detail'}
                        </button>
                      </td>
                    </tr>
                    {expanded === order.id && (
                      <tr className="bg-black/30">
                        <td colSpan={9} className="p-6">
                          {/* Detail section */}
                          <div className="grid md:grid-cols-2 gap-6">
                            {/* Left column */}
                            <div className="space-y-4">
                              {/* Basic info */}
                              <div>
                                <h4 className="text-rasta-gold font-bold mb-3 text-sm uppercase tracking-wider">📋 Základní informace</h4>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div><span className="text-gray-500">ID:</span> <span className="font-mono text-rasta-green text-xs">{order.orderId}</span></div>
                                  <div><span className="text-gray-500">Datum:</span> {formatDateTime(order.createdAt)}</div>
                                  <div><span className="text-gray-500">Platba:</span> {PAYMENT_LABELS[order.payment] || order.payment}</div>
                                  <div><span className="text-gray-500">Stav platby:</span>
                                    <span className={`ml-1 px-2 py-0.5 rounded text-xs ${order.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                                      {order.paymentStatus === 'paid' ? '✅ Zaplaceno' : '⏳ Čeká'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Customer */}
                              <div>
                                <h4 className="text-rasta-gold font-bold mb-3 text-sm uppercase tracking-wider">👤 Zákazník</h4>
                                <div className="space-y-1 text-sm">
                                  <div><span className="text-gray-500">Jméno:</span> {order.customerName}</div>
                                  <div><span className="text-gray-500">Email:</span> <a href={`mailto:${order.customerEmail}`} className="text-rasta-gold">{order.customerEmail}</a></div>
                                  <div><span className="text-gray-500">Telefon:</span> {order.customerPhone || 'N/A'}</div>
                                  {order.addressStreet && (
                                    <div><span className="text-gray-500">Adresa:</span> {order.addressStreet}, {order.addressZip} {order.addressCity}</div>
                                  )}
                                  <div><span className="text-gray-500">Newsletter:</span> {order.newsletter ? '✅ Ano' : 'Ne'}</div>
                                </div>
                              </div>

                              {/* Items */}
                              <div>
                                <h4 className="text-rasta-gold font-bold mb-3 text-sm uppercase tracking-wider">🛒 Položky</h4>
                                <div className="space-y-2">
                                  {getItemsList(order.items).map((item, i) => (
                                    <div key={i} className="flex justify-between items-center p-2 rounded bg-black/30 text-sm">
                                      <span>{item.name} × {item.quantity}</span>
                                      <span className="text-rasta-gold font-bold">{formatPrice(item.total)}</span>
                                    </div>
                                  ))}
                                  {order.shippingCzk > 0 && (
                                    <div className="flex justify-between items-center p-2 rounded bg-black/30 text-sm">
                                      <span>Doprava ({order.shipping})</span>
                                      <span className="text-gray-400">{formatPrice(order.shippingCzk)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between items-center p-2 rounded bg-rasta-gold/10 text-sm font-bold">
                                    <span>Celkem</span>
                                    <span className="text-rasta-gold">{formatPrice(order.totalCzk)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* ZION Tokens */}
                              {order.zionTokens > 0 && (
                                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                                  <h4 className="text-emerald-400 font-bold mb-2 text-sm">🎁 ZION Token Bonus</h4>
                                  <div className="text-2xl font-black text-emerald-400">{order.zionTokens.toLocaleString('cs-CZ')} ZION ⚡</div>
                                </div>
                              )}

                              {/* Note */}
                              {order.note && (
                                <div>
                                  <h4 className="text-rasta-gold font-bold mb-2 text-sm uppercase tracking-wider">📝 Poznámka</h4>
                                  <p className="text-sm text-gray-300 p-3 rounded bg-black/30 border-l-2 border-rasta-gold">{order.note}</p>
                                </div>
                              )}
                            </div>

                            {/* Right column - Actions */}
                            <div className="space-y-4">
                              {/* Status change */}
                              <div className="p-4 rounded-xl bg-black/30">
                                <h4 className="text-rasta-gold font-bold mb-3 text-sm uppercase tracking-wider">⚙️ Změnit stav</h4>
                                <div className="flex gap-2">
                                  <select
                                    value={order.status}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleStatus(order.id, e.target.value)}
                                    className="bg-black/40 border border-white/10 rounded px-3 py-2 text-sm flex-1"
                                  >
                                    {ORDER_STATUSES.map((s) => (
                                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Tracking */}
                              <div className="p-4 rounded-xl bg-black/30">
                                <h4 className="text-rasta-gold font-bold mb-3 text-sm uppercase tracking-wider">📦 Sledování zásilky</h4>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    defaultValue={order.trackingNumber ?? ''}
                                    onChange={(e) => setTracking({ ...tracking, [order.id]: e.target.value })}
                                    placeholder="Sledovací číslo..."
                                    className="bg-zion-card border border-white/10 rounded px-3 py-2 text-sm flex-1"
                                  />
                                  <button
                                    onClick={() => handleTracking(order.id)}
                                    className="px-4 py-2 rounded bg-rasta-gold/20 text-rasta-gold hover:bg-rasta-gold/30 text-sm"
                                  >
                                    Uložit
                                  </button>
                                </div>
                              </div>

                              {/* Invoice actions */}
                              <div className="p-4 rounded-xl bg-black/30">
                                <h4 className="text-rasta-gold font-bold mb-3 text-sm uppercase tracking-wider">📄 Faktura</h4>
                                <div className="flex flex-wrap gap-2">
                                  {order.invoices[0] ? (
                                    <>
                                      <a
                                        href={`/api/invoice/${order.invoices[0].id}/download`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-sm"
                                      >
                                        👁️ Zobrazit
                                      </a>
                                      <button
                                        onClick={() => handleRegenerateInvoice(order.id)}
                                        className="px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-sm"
                                      >
                                        ↻ Regenerovat
                                      </button>
                                      <button
                                        onClick={() => handleSendInvoice(order.id)}
                                        className="px-3 py-2 rounded bg-rasta-gold/20 text-rasta-gold hover:bg-rasta-gold/30 text-sm"
                                      >
                                        ✉️ Odeslat
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleRegenerateInvoice(order.id)}
                                        className="px-3 py-2 rounded bg-rasta-gold/20 text-rasta-gold hover:bg-rasta-gold/30 text-sm"
                                      >
                                        ➕ Generovat
                                      </button>
                                      <button
                                        onClick={() => handleSendInvoice(order.id)}
                                        className="px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-sm"
                                      >
                                        ✉️ Odeslat
                                      </button>
                                    </>
                                  )}
                                </div>
                                {order.invoices[0] && (
                                  <div className="mt-3 text-xs text-gray-500">
                                    Číslo: <span className="text-rasta-gold font-mono">{order.invoices[0].invoiceNumber}</span>
                                    {' · '}Vystavena: {formatDate(order.invoices[0].issuedAt)}
                                    {' · '}Částka: {formatPrice(order.invoices[0].totalCzk)}
                                  </div>
                                )}
                              </div>

                              {/* Payment info */}
                              <div className="p-4 rounded-xl bg-black/30">
                                <h4 className="text-rasta-gold font-bold mb-3 text-sm uppercase tracking-wider">💳 Platba</h4>
                                <div className="space-y-1 text-sm">
                                  <div><span className="text-gray-500">Způsob:</span> {PAYMENT_LABELS[order.payment] || order.payment}</div>
                                  <div><span className="text-gray-500">Status:</span>
                                    <span className={`ml-1 px-2 py-0.5 rounded text-xs ${order.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                                      {order.paymentStatus === 'paid' ? '✅ Zaplaceno' : '⏳ Čeká na platbu'}
                                    </span>
                                  </div>
                                  <div><span className="text-gray-500">Doprava:</span> {order.shipping} ({formatPrice(order.shippingCzk)})</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.pages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-2 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30"
              >
                ← Předchozí
              </button>
              <span className="text-gray-400">Strana {data.page} / {data.pages} ({data.total} objednávek)</span>
              <button
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-2 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30"
              >
                Další →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
