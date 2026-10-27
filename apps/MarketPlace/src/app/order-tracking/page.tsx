'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  PackageSearch,
  ShoppingBag,
  Loader2,
  XCircle,
  Check,
  Truck,
  FileText,
  CreditCard,
} from 'lucide-react';
import { trackOrder, type TrackOrderResult } from '@/lib/shop-api';
import { useLangT } from '@/lib/useTranslation';

type OrderData = NonNullable<TrackOrderResult['data']>;

const STATUS_ORDER = ['pending', 'paid', 'processing', 'shipped', 'completed'];

function statusStepIndex(order: OrderData): number {
  if (order.status === 'cancelled') return -1;
  const idx = STATUS_ORDER.indexOf(order.status);
  return idx < 0 ? 0 : idx;
}

function LoadingFallback() {
  const { t } = useLangT();
  return <div className="zion-section p-16 text-center">{t('orderTracking.loading')}</div>;
}

function OrderTrackingContent() {
  const search = useSearchParams();
  const { t } = useLangT();

  const [orderId, setOrderId] = useState(search.get('order') ?? '');
  const [email, setEmail] = useState(search.get('email') ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<'notFound' | 'rateLimited' | null>(null);
  const [order, setOrder] = useState<OrderData | null>(null);

  const lookup = async (oid: string, em: string) => {
    if (!oid.trim() || !em.trim()) return;
    setLoading(true);
    setError(null);
    const res = await trackOrder(oid.trim(), em.trim());
    setLoading(false);
    if (!res) {
      setError('notFound');
      setOrder(null);
      return;
    }
    if (res.success && res.data) {
      setOrder(res.data);
      setError(null);
      return;
    }
    setOrder(null);
    setError(res.error === 'Too many requests' ? 'rateLimited' : 'notFound');
  };

  // Deep-link: /order-tracking?order=…&email=… runs the lookup immediately.
  useEffect(() => {
    const oid = search.get('order');
    const em = search.get('email');
    if (oid && em) lookup(oid, em);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    lookup(orderId, email);
  };

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString() : null;
  const fmtPrice = (czk: number) => `${czk.toLocaleString()} Kč`;

  const stepIdx = order ? statusStepIndex(order) : 0;
  const cancelled = order?.status === 'cancelled';
  const steps = [
    { key: 'stepOrdered', done: stepIdx >= 0, at: fmtDate(order?.createdAt ?? null) },
    { key: 'stepPaid', done: stepIdx >= 1 || order?.paymentStatus === 'paid', at: fmtDate(order?.paidAt ?? null) },
    { key: 'stepProcessing', done: stepIdx >= 2, at: null },
    { key: 'stepShipped', done: stepIdx >= 3, at: fmtDate(order?.shippedAt ?? null) },
    { key: 'stepCompleted', done: stepIdx >= 4, at: null },
  ] as const;

  return (
    <div className="zion-section p-8 md:p-12 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-rasta-gold/10 border border-rasta-gold/30 flex items-center justify-center mx-auto mb-6">
          <PackageSearch className="w-10 h-10 text-rasta-gold" />
        </div>
        <h1 className="text-3xl font-black font-display mb-3">{t('orderTracking.title')}</h1>
        <p className="text-gray-400">{t('orderTracking.subtitle')}</p>
      </div>

      <form onSubmit={onSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
        <label className="block text-sm text-gray-400 mb-1.5" htmlFor="track-order">
          {t('orderTracking.orderLabel')}
        </label>
        <input
          id="track-order"
          type="text"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder={t('orderTracking.orderPlaceholder')}
          required
          className="w-full mb-4 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 font-mono text-sm text-white placeholder:text-gray-600 focus:border-rasta-gold/50 focus:outline-none"
        />
        <label className="block text-sm text-gray-400 mb-1.5" htmlFor="track-email">
          {t('orderTracking.emailLabel')}
        </label>
        <input
          id="track-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('orderTracking.emailPlaceholder')}
          required
          className="w-full mb-5 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-rasta-gold/50 focus:outline-none"
        />
        <button type="submit" disabled={loading} className="zion-button-primary w-full justify-center">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageSearch className="w-4 h-4" />}
          {loading ? t('orderTracking.submitting') : t('orderTracking.submit')}
        </button>
      </form>

      {error && (
        <div className="bg-rasta-red/10 border border-rasta-red/30 rounded-2xl p-4 mb-8 text-sm text-rasta-red text-center">
          {error === 'rateLimited' ? t('orderTracking.rateLimited') : t('orderTracking.notFound')}
        </div>
      )}

      {order && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
            <Truck className="w-5 h-5 text-rasta-gold" /> {t('orderTracking.statusTitle')}
          </h2>

          {cancelled ? (
            <div className="flex items-center gap-3 text-rasta-red font-semibold mb-6">
              <XCircle className="w-5 h-5" /> {t('orderTracking.statusCancelled')}
            </div>
          ) : (
            <ol className="mb-6">
              {steps.map((s) => (
                <li key={s.key} className="flex items-start gap-3 mb-3 last:mb-0">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      s.done
                        ? 'border-rasta-green bg-rasta-green/20 text-rasta-green'
                        : 'border-white/15 text-transparent'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                  </span>
                  <span className={`text-sm ${s.done ? 'text-white' : 'text-gray-500'}`}>
                    {t(`orderTracking.${s.key}`)}
                    {s.at && <span className="ml-2 text-xs text-gray-500">{s.at}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {!cancelled && order.paymentStatus !== 'paid' && order.status === 'pending' && (
            <div className="bg-rasta-gold/10 border border-rasta-gold/30 rounded-xl p-3 mb-6 text-xs text-rasta-gold">
              {t('orderTracking.paymentPendingHint')}
            </div>
          )}

          <div className="space-y-2 text-sm border-t border-white/10 pt-4 mb-6">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('orderTracking.labelPayment')}</span>
              <span className="font-semibold inline-flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-rasta-gold" />
                {order.paymentStatus === 'paid'
                  ? t('orderSuccess.statusPaid')
                  : t('orderSuccess.statusPending')}
              </span>
            </div>
            {order.trackingNumber && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t('orderTracking.labelTracking')}</span>
                <span className="font-mono">{order.trackingNumber}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">{t('orderTracking.labelTotal')}</span>
              <span className="font-mono font-bold text-rasta-gold">
                {fmtPrice(order.totalCzk + order.shippingCzk)}
              </span>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-300 mb-2">{t('orderTracking.itemsTitle')}</h3>
          <ul className="space-y-1.5 text-sm mb-6">
            {order.items.map((it, i) => (
              <li key={i} className="flex justify-between">
                <span className="text-gray-300">
                  {it.quantity}× {it.name}
                </span>
                <span className="font-mono text-gray-400">{fmtPrice(it.priceCzk * it.quantity)}</span>
              </li>
            ))}
          </ul>

          {order.invoices.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {order.invoices.map((inv) => (
                <a
                  key={inv.id}
                  href={`/api/invoice/${encodeURIComponent(inv.invoiceNumber)}/download?format=pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="zion-button-secondary text-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {t('orderTracking.invoiceDownload', { number: inv.invoiceNumber })}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="text-center">
        <Link href="/shop" className="zion-button-secondary">
          <ShoppingBag className="w-4 h-4" /> {t('orderTracking.backToShop')}
        </Link>
      </div>
    </div>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OrderTrackingContent />
    </Suspense>
  );
}
