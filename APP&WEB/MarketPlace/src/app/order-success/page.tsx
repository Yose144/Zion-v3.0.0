'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, ShoppingBag, Mail, HelpCircle, Loader2, XCircle } from 'lucide-react';
import { getOrderStatus, verifyStripeSession, type OrderStatusResult } from '@/lib/shop-api';
import { useLangT } from '@/lib/useTranslation';
import { COMPANY } from '@/lib/invoice';

function LoadingFallback() {
  const { t } = useLangT();
  return <div className="zion-section p-16 text-center">{t('orderSuccess.loading')}</div>;
}

function OrderSuccessContent() {
  const search = useSearchParams();
  const orderId = search.get('order') ?? '';
  const sessionId = search.get('session_id') ?? '';
  const { t } = useLangT();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderStatusResult['data'] | null>(null);
  const [stripeVerified, setStripeVerified] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!orderId) {
        setLoading(false);
        return;
      }

      if (sessionId) {
        await verifyStripeSession(sessionId);
      }

      const result = await getOrderStatus(orderId);
      if (cancelled) return;

      if (result?.data) {
        setOrder(result.data);
        if (sessionId) {
          setStripeVerified(result.data.paymentStatus === 'paid');
        }
      }
      setLoading(false);
    }

    load();

    // Poll for payment status updates when returning from Stripe
    const interval = setInterval(() => {
      if (sessionId && order && order.paymentStatus !== 'paid') {
        getOrderStatus(orderId).then((res) => {
          if (res?.data) {
            setOrder(res.data);
            if (res.data.paymentStatus === 'paid') {
              setStripeVerified(true);
            }
          }
        });
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orderId, sessionId]);

  const statusText = (() => {
    if (loading) return t('orderSuccess.statusVerifying');
    if (order?.paymentStatus === 'paid') return t('orderSuccess.statusPaid');
    if (order?.payment === 'card') return t('orderSuccess.statusCardPending');
    return t('orderSuccess.statusPending');
  })();

  const statusColor = order?.paymentStatus === 'paid' ? 'text-rasta-green' : 'text-rasta-gold';
  const statusIcon = order?.paymentStatus === 'paid' ? <Check className="w-10 h-10 text-rasta-green" /> : <Loader2 className="w-10 h-10 text-rasta-gold animate-spin" />;

  const paymentMethodText = (() => {
    if (order?.payment === 'card') return t('orderSuccess.paymentCard');
    if (order?.payment === 'transfer') return t('orderSuccess.paymentTransfer');
    if (order?.payment === 'crypto') return t('orderSuccess.paymentCrypto');
    return order?.payment ?? '';
  })();

  const formatPrice = (price: number) => t('common.price', { price, symbol: t('common.kcSymbol') });

  const supportEmail = COMPANY.email;
  const footerQuestionText = t('orderSuccess.footerQuestion', { email: '%%EMAIL%%' });
  const [footerBefore, footerAfter] = footerQuestionText.includes('%%EMAIL%%')
    ? footerQuestionText.split('%%EMAIL%%')
    : [footerQuestionText, ''];

  if (!orderId) {
    return (
      <div className="zion-section p-8 md:p-12 text-center max-w-2xl mx-auto">
        <div className="w-20 h-20 rounded-full bg-rasta-red/10 border border-rasta-red/30 flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-rasta-red" />
        </div>
        <h1 className="text-3xl font-black font-display mb-3">{t('orderSuccess.missingOrderTitle')}</h1>
        <p className="text-gray-400 mb-6">{t('orderSuccess.missingOrderSubtitle')}</p>
        <Link href="/shop" className="zion-button-primary">
          <ShoppingBag className="w-4 h-4" /> {t('orderSuccess.continueShopping')}
        </Link>
      </div>
    );
  }

  return (
    <div className="zion-section p-8 md:p-12 text-center max-w-2xl mx-auto">
      <div className="w-20 h-20 rounded-full bg-rasta-green/10 border border-rasta-green/30 flex items-center justify-center mx-auto mb-6">
        {loading ? <Loader2 className="w-10 h-10 text-rasta-gold animate-spin" /> : statusIcon}
      </div>

      <h1 className="text-3xl font-black font-display mb-3">{t('orderSuccess.title')}</h1>
      <p className="text-gray-400 mb-6">
        {t('orderSuccess.thankYou')}
        {order?.paymentStatus === 'paid'
          ? ' ' + t('orderSuccess.paidShip')
          : ' ' + t('orderSuccess.pendingShip')}
      </p>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-left inline-block w-full">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">{t('orderSuccess.labelOrderNumber')}</span>
          <span className="font-mono font-bold">{orderId}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">{t('orderSuccess.labelStatus')}</span>
          <span className={`font-semibold ${statusColor}`}>{statusText}</span>
        </div>
        {order && (
          <>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">{t('orderSuccess.labelTotal')}</span>
              <span className="font-mono font-bold text-rasta-gold">{formatPrice(order.totalCzk)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('orderSuccess.labelPaymentMethod')}</span>
              <span className="font-semibold">{paymentMethodText}</span>
            </div>
          </>
        )}
      </div>

      {sessionId && stripeVerified === false && (
        <div className="bg-rasta-gold/10 border border-rasta-gold/30 rounded-2xl p-4 mb-6 text-sm text-rasta-gold">
          {t('orderSuccess.stripePending')}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link href="/shop" className="zion-button-primary">
          <ShoppingBag className="w-4 h-4" /> {t('orderSuccess.continueShopping')}
        </Link>
        <a href={`mailto:${COMPANY.email}`} className="zion-button-secondary">
          <Mail className="w-4 h-4" /> {t('orderSuccess.contactSupport')}
        </a>
      </div>

      <div className="mt-8 pt-6 border-t border-white/10 text-xs text-gray-500">
        <p className="inline-flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          {footerBefore}
          <a href={`mailto:${supportEmail}`} className="text-rasta-gold">{supportEmail}</a>
          {footerAfter}
        </p>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OrderSuccessContent />
    </Suspense>
  );
}
