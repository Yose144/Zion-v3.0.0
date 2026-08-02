'use client';

import { useEffect, useMemo, useState } from 'react';
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

  const load = async () => {
    setLoading(true);
    const res = await listAdminOrders({ status, paymentStatus, search, page, limit: 25 });
    if (res?.data) {
      setData(res.data);
      setError(null);
    } else {
      setError('Nepodařilo se načíst objednávky.');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [status, paymentStatus, page]);

  const debouncedSearch = useMemo(() => {
    let t: ReturnType<typeof setTimeout>;
    return (value: string) => {
      clearTimeout(t);
      t = setTimeout(() => {
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
    await sendInvoiceEmail(id);
    alert('Faktura odeslána.');
  };

  const handleRegenerateInvoice = async (id: string) => {
    await regenerateInvoice(id);
    await load();
  };

  const formatPrice = (amount: number) => `${amount.toLocaleString('cs-CZ')} Kč`;

  return (
    <div>
      <h1 className="text-2xl font-black text-gradient mb-6">Objednávky</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="bg-oasis-surface border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-oasis-cyan focus:outline-none"
        >
          <option value="">Všechny stavy</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={paymentStatus}
          onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }}
          className="bg-oasis-surface border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-oasis-cyan focus:outline-none"
        >
          <option value="">Všechny platby</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Hledat objednávku, email, jméno..."
          onChange={(e) => debouncedSearch(e.target.value)}
          className="bg-oasis-surface border border-white/10 rounded-lg px-3 py-2 text-sm min-w-[260px] focus:border-oasis-cyan focus:outline-none"
        />
      </div>

      {loading && <p>Načítání…</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && data && (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-oasis-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-gray-400">
                  <th className="p-3">Číslo</th>
                  <th className="p-3">Zákazník</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Celkem</th>
                  <th className="p-3">Platba</th>
                  <th className="p-3">Stav</th>
                  <th className="p-3">Faktura</th>
                  <th className="p-3">Datum</th>
                  <th className="p-3">Akce</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <>
                    <tr
                      key={order.id}
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                      onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                    >
                      <td className="p-3 font-mono text-oasis-cyan">{order.orderId}</td>
                      <td className="p-3">{order.customerName}</td>
                      <td className="p-3 text-gray-400">{order.customerEmail}</td>
                      <td className="p-3 font-mono">{formatPrice(order.totalCzk)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${order.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="p-3">
                        <select
                          value={order.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleStatus(order.id, e.target.value)}
                          className="bg-black/30 border border-white/10 rounded px-2 py-1 text-xs"
                        >
                          {ORDER_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        {order.invoices[0] ? (
                          <a
                            href={`/api/invoices/${order.invoices[0].id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-oasis-cyan hover:underline"
                          >
                            {order.invoices[0].invoiceNumber}
                          </a>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="p-3 text-gray-400">{new Date(order.createdAt).toLocaleDateString('cs-CZ')}</td>
                      <td className="p-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpanded(expanded === order.id ? null : order.id); }}
                          className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10"
                        >
                          {expanded === order.id ? 'Skrýt' : 'Detail'}
                        </button>
                      </td>
                    </tr>
                    {expanded === order.id && (
                      <tr className="bg-black/20">
                        <td colSpan={9} className="p-4">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-bold text-oasis-gold mb-2">Sledovací číslo</h4>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  defaultValue={order.trackingNumber ?? ''}
                                  onChange={(e) => setTracking({ ...tracking, [order.id]: e.target.value })}
                                  placeholder="Zadej tracking number"
                                  className="bg-oasis-surface border border-white/10 rounded px-3 py-2 text-sm flex-1"
                                />
                                <button
                                  onClick={() => handleTracking(order.id)}
                                  className="px-3 py-2 rounded bg-oasis-cyan/20 text-oasis-cyan hover:bg-oasis-cyan/30 text-sm"
                                >
                                  Uložit
                                </button>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-bold text-oasis-gold mb-2">Faktura</h4>
                              <div className="flex gap-2 flex-wrap">
                                {order.invoices[0] ? (
                                  <>
                                    <a
                                      href={`/api/invoices/${order.invoices[0].id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-sm"
                                    >
                                      Zobrazit fakturu
                                    </a>
                                    <button
                                      onClick={() => handleSendInvoice(order.id)}
                                      className="px-3 py-2 rounded bg-oasis-cyan/20 text-oasis-cyan hover:bg-oasis-cyan/30 text-sm"
                                    >
                                      Odeslat emailem
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleRegenerateInvoice(order.id)}
                                    className="px-3 py-2 rounded bg-oasis-gold/20 text-oasis-gold hover:bg-oasis-gold/30 text-sm"
                                  >
                                    Vytvořit fakturu
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-2 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30"
            >
              Předchozí
            </button>
            <span>Strana {data.page} z {data.pages} · Celkem {data.total}</span>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-2 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30"
            >
              Další
            </button>
          </div>
        </>
      )}
    </div>
  );
}
