'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/admin-auth';
import {
  listAdminOrders,
  updateOrderStatus,
  updateTrackingNumber,
  sendInvoiceEmail,
  regenerateInvoice,
  syncOrderToTrivi,
  checkTriviStatus,
  distributeTokens,
  getTokenStatus,
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
  card: '💳 Karta (Stripe)',
  transfer: '🏦 Bankovní převod',
  crypto: '⚡ Krypto',
  cash: '💵 Dobírka',
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

function getItemsList(items: unknown): { name: string; quantity: number; priceCzk: number; total: number; digital?: boolean }[] {
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
      digital: Boolean(raw.digital ?? raw.category === 'digital'),
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

// ── Modal Detail Component ───────────────────────────────────────────

interface OrderModalProps {
  order: OrderRow;
  onClose: () => void;
  onRefresh: () => void;
}

function OrderModal({ order, onClose, onRefresh }: OrderModalProps) {
  const [newStatus, setNewStatus] = useState(order.status);
  const [trackingInput, setTrackingInput] = useState(order.trackingNumber ?? '');
  const [triviStatus, setTriviStatus] = useState<{ loading: boolean; data: { synced?: boolean; status?: string; trivi_id?: string; document_number?: string; error_message?: string; can_retry?: boolean; created_at?: string } | null }>({ loading: false, data: null });
  const [tokenStatus, setTokenStatus] = useState<{ loading: boolean; data: { found?: boolean; tokens?: number; status?: string; txHash?: string; distributedAt?: string } | null }>({ loading: false, data: null });
  const [busy, setBusy] = useState<string | null>(null);

  const loadTriviStatus = async () => {
    setTriviStatus({ loading: true, data: null });
    const res = await checkTriviStatus(order.id);
    setTriviStatus({ loading: false, data: res });
  };

  const loadTokenStatus = async () => {
    setTokenStatus({ loading: true, data: null });
    const res = await getTokenStatus(order.id);
    setTokenStatus({ loading: false, data: res });
  };

  useEffect(() => {
    loadTriviStatus();
    loadTokenStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStatus = async () => {
    if (newStatus === order.status) return;
    setBusy('status');
    await updateOrderStatus(order.id, newStatus);
    setBusy(null);
    onRefresh();
  };

  const handleTracking = async () => {
    if (!trackingInput) return;
    setBusy('tracking');
    await updateTrackingNumber(order.id, trackingInput);
    setBusy(null);
    onRefresh();
  };

  const handleSendInvoice = async () => {
    setBusy('invoice-send');
    const res = await sendInvoiceEmail(order.id);
    setBusy(null);
    if (res?.success) alert('Faktura odeslána zákazníkovi emailem');
    else alert('Chyba: ' + (res?.error || 'neznámá'));
  };

  const handleRegenerateInvoice = async () => {
    if (!confirm('Opravdu chcete regenerovat fakturu?')) return;
    setBusy('invoice-regen');
    await regenerateInvoice(order.id);
    setBusy(null);
    onRefresh();
  };

  const handleTriviSync = async () => {
    if (!confirm(`Opravdu chcete odeslat objednávku ${order.orderId} do Trivi?`)) return;
    setBusy('trivi-sync');
    const res = await syncOrderToTrivi(order.id);
    setBusy(null);
    if (res?.success) {
      alert('Odesláno do Trivi! ID: ' + (res.trivi_id || 'N/A'));
      loadTriviStatus();
    } else {
      alert('Chyba: ' + (res?.error || 'neznámá'));
    }
  };

  const handleDistributeTokens = async () => {
    if (!confirm(`⚠️ POZOR: Distribuovat ${order.zionTokens.toLocaleString('cs-CZ')} ZION tokenů?\n\nTato akce je NEVRATNÁ.`)) return;
    const txHash = prompt('Zadejte tx hash (nebo nechte prázdné pro "pending"):') || undefined;
    setBusy('tokens');
    const res = await distributeTokens(order.id, txHash || undefined);
    setBusy(null);
    if (res?.success) {
      alert(`Distribuce dokončena! ${res.tokens?.toLocaleString('cs-CZ')} ZION → ${res.status}`);
      loadTokenStatus();
    } else {
      alert('Chyba: ' + (res?.error || 'neznámá'));
    }
  };

  const items = getItemsList(order.items);
  const hasDigitalItems = items.some((i) => i.digital);
  const hasPhysicalItems = items.some((i) => !i.digital);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-4 md:p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-zion-card border border-white/10 rounded-2xl shadow-2xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${order.payment === 'card' ? 'bg-blue-500/20 text-blue-300' : order.payment === 'crypto' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
              {PAYMENT_LABELS[order.payment] || order.payment}
            </span>
            <h2 className="text-xl font-black text-gradient">{order.orderId}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none px-2"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Basic Info + Customer */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-rasta-gold font-bold mb-3 text-sm uppercase tracking-wider">📋 Základní informace</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">ID:</span> <span className="font-mono text-rasta-green text-xs">{order.orderId}</span></div>
                  <div><span className="text-gray-500">Datum:</span> {formatDateTime(order.createdAt)}</div>
                  <div><span className="text-gray-500">Platba:</span> {PAYMENT_LABELS[order.payment] || order.payment}</div>
                  <div><span className="text-gray-500">Stav platby:</span>
                    <span className={`ml-1 px-2 py-0.5 rounded text-xs ${order.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                      {order.paymentStatus === 'paid' ? '✅ Zaplaceno' : '⏳ Čeká'}
                    </span>
                  </div>
                  <div><span className="text-gray-500">Aktualizace:</span> {formatDateTime(order.updatedAt)}</div>
                </div>
              </div>

              <div>
                <h3 className="text-rasta-gold font-bold mb-3 text-sm uppercase tracking-wider">👤 Zákazník</h3>
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
            </div>

            {/* Items + Total */}
            <div className="space-y-4">
              <div>
                <h3 className="text-rasta-gold font-bold mb-3 text-sm uppercase tracking-wider">
                  🛒 Položky {hasDigitalItems && <span className="text-blue-400 text-xs">(digitální)</span>}
                  {hasPhysicalItems && <span className="text-emerald-400 text-xs">(fyzické)</span>}
                </h3>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex justify-between items-center p-2 rounded bg-black/30 text-sm">
                      <span>
                        {item.digital && '💾 '}
                        {item.name} × {item.quantity}
                      </span>
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

              {/* Note */}
              {order.note && (
                <div>
                  <h3 className="text-rasta-gold font-bold mb-2 text-sm uppercase tracking-wider">📝 Poznámka</h3>
                  <p className="text-sm text-gray-300 p-3 rounded bg-black/30 border-l-2 border-rasta-gold">{order.note}</p>
                </div>
              )}
            </div>
          </div>

          {/* ZION Token Bonus + Distribution */}
          {order.zionTokens > 0 && (
            <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-emerald-400 font-bold text-sm uppercase tracking-wider">🎁 ZION Token Bonus</h3>
                <div className="text-2xl font-black text-emerald-400">{order.zionTokens.toLocaleString('cs-CZ')} ZION ⚡</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  {tokenStatus.loading ? (
                    <p className="text-gray-400 text-sm">Načítám status...</p>
                  ) : tokenStatus.data?.status === 'distributed' ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">✅ Distribuováno</span>
                      {tokenStatus.data.distributedAt && <span className="text-gray-500">{formatDateTime(tokenStatus.data.distributedAt)}</span>}
                      {tokenStatus.data.txHash && tokenStatus.data.txHash !== 'pending' && (
                        <span className="font-mono text-xs text-gray-500">tx: {tokenStatus.data.txHash.slice(0, 20)}...</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 font-bold">⏳ Čeká na distribuci</span>
                    </div>
                  )}
                </div>
                {tokenStatus.data?.status !== 'distributed' && (
                  <button
                    onClick={handleDistributeTokens}
                    disabled={busy === 'tokens'}
                    className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-sm font-bold disabled:opacity-50"
                  >
                    {busy === 'tokens' ? 'Distribuuji...' : '⚡ Distribuovat tokeny'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Trivi Accounting */}
          <div className="p-5 rounded-xl bg-black/30 border border-white/10">
            <h3 className="text-rasta-gold font-bold mb-3 text-sm uppercase tracking-wider">📊 Trivi Účetní Systém</h3>
            <div className="mb-3">
              {triviStatus.loading ? (
                <p className="text-gray-400 text-sm">Načítám status...</p>
              ) : triviStatus.data?.synced ? (
                triviStatus.data.status === 'success' ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">✅ Synchronizováno</span>
                    {triviStatus.data.document_number && <span className="font-mono text-xs text-gray-500">{triviStatus.data.document_number}</span>}
                    {triviStatus.data.trivi_id && <span className="font-mono text-xs text-gray-500">ID: {triviStatus.data.trivi_id}</span>}
                  </div>
                ) : triviStatus.data.status === 'failed' ? (
                  <div className="text-sm">
                    <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 font-bold">❌ Selhalo</span>
                    <p className="text-gray-400 mt-1">{triviStatus.data.error_message || 'Neznámá chyba'}</p>
                  </div>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-gray-500/20 text-gray-300 font-bold text-sm">⏳ Čeká na zpracování</span>
                )
              ) : (
                <span className="px-3 py-1 rounded-full bg-gray-500/20 text-gray-400 font-bold text-sm">ℹ️ Neodesláno do Trivi</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleTriviSync}
                disabled={busy === 'trivi-sync'}
                className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-sm font-bold disabled:opacity-50"
              >
                {busy === 'trivi-sync' ? 'Odesílám...' : '📤 Odeslat do Trivi'}
              </button>
              <button
                onClick={loadTriviStatus}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm"
              >
                ↻ Zkontrolovat status
              </button>
            </div>
          </div>

          {/* Status + Tracking + Invoice */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Status change */}
            <div className="p-4 rounded-xl bg-black/30">
              <h4 className="text-rasta-gold font-bold mb-3 text-sm uppercase tracking-wider">⚙️ Stav</h4>
              <div className="space-y-2">
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm"
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
                <button
                  onClick={handleStatus}
                  disabled={busy === 'status' || newStatus === order.status}
                  className="w-full px-3 py-2 rounded bg-rasta-gold/20 text-rasta-gold hover:bg-rasta-gold/30 text-sm font-bold disabled:opacity-30"
                >
                  {busy === 'status' ? 'Ukládám...' : 'Uložit stav'}
                </button>
              </div>
            </div>

            {/* Tracking */}
            <div className="p-4 rounded-xl bg-black/30">
              <h4 className="text-rasta-gold font-bold mb-3 text-sm uppercase tracking-wider">📦 Sledování</h4>
              <div className="space-y-2">
                <input
                  type="text"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder="Sledovací číslo..."
                  className="w-full bg-zion-card border border-white/10 rounded px-3 py-2 text-sm"
                />
                <button
                  onClick={handleTracking}
                  disabled={busy === 'tracking' || !trackingInput}
                  className="w-full px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-sm disabled:opacity-30"
                >
                  {busy === 'tracking' ? 'Ukládám...' : 'Uložit'}
                </button>
              </div>
            </div>

            {/* Invoice */}
            <div className="p-4 rounded-xl bg-black/30">
              <h4 className="text-rasta-gold font-bold mb-3 text-sm uppercase tracking-wider">📄 Faktura</h4>
              <div className="space-y-2">
                {order.invoices[0] ? (
                  <>
                    <a
                      href={`/api/invoice/${order.invoices[0].id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-sm"
                    >
                      👁️ Zobrazit {order.invoices[0].invoiceNumber}
                    </a>
                    <a
                      href={`/api/invoice/${order.invoices[0].id}/download?format=pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center px-3 py-2 rounded bg-rasta-gold/20 text-rasta-gold hover:bg-rasta-gold/30 text-sm font-bold"
                    >
                      ⬇️ Stáhnout PDF
                    </a>
                    <button
                      onClick={handleRegenerateInvoice}
                      disabled={busy === 'invoice-regen'}
                      className="w-full px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-sm disabled:opacity-50"
                    >
                      {busy === 'invoice-regen' ? 'Generuji...' : '↻ Regenerovat'}
                    </button>
                    <button
                      onClick={handleSendInvoice}
                      disabled={busy === 'invoice-send'}
                      className="w-full px-3 py-2 rounded bg-rasta-gold/20 text-rasta-gold hover:bg-rasta-gold/30 text-sm font-bold disabled:opacity-50"
                    >
                      {busy === 'invoice-send' ? 'Odesílám...' : '✉️ Odeslat'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleRegenerateInvoice}
                      disabled={busy === 'invoice-regen'}
                      className="w-full px-3 py-2 rounded bg-rasta-gold/20 text-rasta-gold hover:bg-rasta-gold/30 text-sm font-bold disabled:opacity-50"
                    >
                      {busy === 'invoice-regen' ? 'Generuji...' : '➕ Generovat'}
                    </button>
                    <button
                      onClick={handleSendInvoice}
                      disabled={busy === 'invoice-send'}
                      className="w-full px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-sm disabled:opacity-50"
                    >
                      {busy === 'invoice-send' ? 'Odesílám...' : '✉️ Odeslat'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────

export default function AdminOrdersPage() {
  const router = useRouter();
  const [data, setData] = useState<AdminOrdersListResult['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [tab, setTab] = useState<'all' | 'pending' | 'paid' | 'shipped'>('all');

  const load = async () => {
    if (!isAuthenticated()) {
      setError('Nejste přihlášeni. Přejděte na /admin/login.');
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await listAdminOrders({ status, paymentStatus, search, page, limit: 100 });
    if (res?.data) {
      setData(res.data);
      setError(null);
    } else {
      setError(res?.error ?? 'Chyba při načítání objednávek');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/admin/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      {/* Payment method breakdown */}
      {stats?.byPayment && Object.keys(stats.byPayment).length > 0 && (
        <div className="flex gap-3 mb-4 flex-wrap">
          {Object.entries(stats.byPayment).map(([method, count]) => (
            <div key={method} className="px-4 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-sm">
              <span className="text-gray-400">{PAYMENT_LABELS[method] || method}:</span>{' '}
              <span className="font-bold text-white">{count}</span>
            </div>
          ))}
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
                  <th className="p-3">Platba</th>
                  <th className="p-3">ZION</th>
                  <th className="p-3">Stav</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition"
                    onClick={() => setSelectedOrder(order)}
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
                      <span className={`text-xs ${order.payment === 'card' ? 'text-blue-400' : order.payment === 'crypto' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {PAYMENT_LABELS[order.payment] || order.payment}
                      </span>
                    </td>
                    <td className="p-3">
                      {order.zionTokens > 0 ? (
                        <span className="text-rasta-gold font-bold">{order.zionTokens.toLocaleString('cs-CZ')}</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_COLORS[order.status] || 'bg-gray-500/20 text-gray-300'}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                        className="text-xs px-3 py-1.5 rounded bg-rasta-gold/20 text-rasta-gold hover:bg-rasta-gold/30 font-bold"
                      >
                        👁️ Detail
                      </button>
                    </td>
                  </tr>
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

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onRefresh={load}
        />
      )}
    </div>
  );
}
