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
import { useLangT } from '@/lib/useTranslation';

const ORDER_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed'];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  const { t, lang } = useLangT();

  const load = async () => {
    setLoading(true);
    const res = await listAdminOrders({ status, paymentStatus, search, page, limit: 25 });
    if (res?.data) {
      setData(res.data);
      setError(null);
    } else {
      setError(t('admin.loadError'));
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
    await sendInvoiceEmail(id);
    alert(t('admin.invoiceSent'));
  };

  const handleRegenerateInvoice = async (id: string) => {
    await regenerateInvoice(id);
    await load();
  };

  const formatPrice = (amount: number) =>
    t('common.price', { price: amount.toLocaleString(lang === 'en' ? 'en-US' : 'cs-CZ'), symbol: t('common.kcSymbol') });

  return (
    <div>
      <h1 className="text-2xl font-black text-gradient mb-6">{t('admin.ordersTitle')}</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="bg-zion-card border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-rasta-gold focus:outline-none"
        >
          <option value="">{t('admin.allStatuses')}</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{t(`admin.status${capitalize(s)}`)}</option>
          ))}
        </select>

        <select
          value={paymentStatus}
          onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }}
          className="bg-zion-card border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-rasta-gold focus:outline-none"
        >
          <option value="">{t('admin.allPayments')}</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{t(`admin.paymentStatus${capitalize(s)}`)}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder={t('admin.searchPlaceholder')}
          onChange={(e) => debouncedSearch(e.target.value)}
          className="bg-zion-card border border-white/10 rounded-lg px-3 py-2 text-sm min-w-[260px] focus:border-rasta-gold focus:outline-none"
        />
      </div>

      {loading && <p>{t('admin.loading')}</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && data && (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-zion-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-gray-400">
                  <th className="p-3">{t('admin.tableNumber')}</th>
                  <th className="p-3">{t('admin.tableCustomer')}</th>
                  <th className="p-3">{t('admin.tableEmail')}</th>
                  <th className="p-3">{t('admin.tableTotal')}</th>
                  <th className="p-3">{t('admin.tablePayment')}</th>
                  <th className="p-3">{t('admin.tableStatus')}</th>
                  <th className="p-3">{t('admin.tableInvoice')}</th>
                  <th className="p-3">{t('admin.tableDate')}</th>
                  <th className="p-3">{t('admin.tableActions')}</th>
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
                      <td className="p-3 font-mono text-rasta-green">{order.orderId}</td>
                      <td className="p-3">{order.customerName}</td>
                      <td className="p-3 text-gray-400">{order.customerEmail}</td>
                      <td className="p-3 font-mono">{formatPrice(order.totalCzk)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${order.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                          {t(`admin.paymentStatus${capitalize(order.paymentStatus)}`)}
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
                            <option key={s} value={s}>{t(`admin.status${capitalize(s)}`)}</option>
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
                            className="text-rasta-gold hover:underline"
                          >
                            {order.invoices[0].invoiceNumber}
                          </a>
                        ) : (
                          <span className="text-gray-500">{t('admin.noInvoice')}</span>
                        )}
                      </td>
                      <td className="p-3 text-gray-400">{new Date(order.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ')}</td>
                      <td className="p-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpanded(expanded === order.id ? null : order.id); }}
                          className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10"
                        >
                          {expanded === order.id ? t('admin.hide') : t('admin.detail')}
                        </button>
                      </td>
                    </tr>
                    {expanded === order.id && (
                      <tr className="bg-black/20">
                        <td colSpan={9} className="p-4">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-bold text-rasta-gold mb-2">{t('admin.trackingTitle')}</h4>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  defaultValue={order.trackingNumber ?? ''}
                                  onChange={(e) => setTracking({ ...tracking, [order.id]: e.target.value })}
                                  placeholder={t('admin.trackingPlaceholder')}
                                  className="bg-zion-card border border-white/10 rounded px-3 py-2 text-sm flex-1"
                                />
                                <button
                                  onClick={() => handleTracking(order.id)}
                                  className="px-3 py-2 rounded bg-rasta-gold/20 text-rasta-gold hover:bg-rasta-gold/30 text-sm"
                                >
                                  {t('admin.save')}
                                </button>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-bold text-rasta-gold mb-2">{t('admin.invoiceSection')}</h4>
                              <div className="flex gap-2 flex-wrap">
                                {order.invoices[0] ? (
                                  <>
                                    <a
                                      href={`/api/invoices/${order.invoices[0].id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-sm"
                                    >
                                      {t('admin.viewInvoice')}
                                    </a>
                                    <button
                                      onClick={() => handleSendInvoice(order.id)}
                                      className="px-3 py-2 rounded bg-rasta-gold/20 text-rasta-gold hover:bg-rasta-gold/30 text-sm"
                                    >
                                      {t('admin.sendInvoice')}
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleRegenerateInvoice(order.id)}
                                    className="px-3 py-2 rounded bg-rasta-gold/20 text-rasta-gold hover:bg-rasta-gold/30 text-sm"
                                  >
                                    {t('admin.createInvoice')}
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
              {t('admin.previous')}
            </button>
            <span>{t('admin.pagination', { page: data.page, pages: data.pages, total: data.total })}</span>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-2 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30"
            >
              {t('admin.next')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
