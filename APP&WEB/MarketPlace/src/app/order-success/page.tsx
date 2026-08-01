'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, ShoppingBag, Mail, HelpCircle, Loader2, XCircle } from 'lucide-react';
import { getOrderStatus, verifyStripeSession, type OrderStatusResult } from '@/lib/shop-api';

function OrderSuccessContent() {
  const search = useSearchParams();
  const orderId = search.get('order') ?? '';
  const sessionId = search.get('session_id') ?? '';

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
    if (loading) return 'Ověřuji stav objednávky…';
    if (order?.paymentStatus === 'paid') return 'Platba přijata';
    if (order?.payment === 'card') return 'Čeká se na potvrzení platby';
    return 'Čeká na platbu';
  })();

  const statusColor = order?.paymentStatus === 'paid' ? 'text-oasis-emerald' : 'text-oasis-gold';
  const statusIcon = order?.paymentStatus === 'paid' ? <Check className="w-10 h-10 text-oasis-emerald" /> : <Loader2 className="w-10 h-10 text-oasis-gold animate-spin" />;

  if (!orderId) {
    return (
      <div className="zion-section p-8 md:p-12 text-center max-w-2xl mx-auto">
        <div className="w-20 h-20 rounded-full bg-oasis-rose/10 border border-oasis-rose/30 flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-oasis-rose" />
        </div>
        <h1 className="text-3xl font-black font-display mb-3">Chybí číslo objednávky</h1>
        <p className="text-gray-400 mb-6">Zpět do obchodu a dokončete nákup.</p>
        <Link href="/shop" className="zion-button-primary">
          <ShoppingBag className="w-4 h-4" /> Pokračovat v nákupu
        </Link>
      </div>
    );
  }

  return (
    <div className="zion-section p-8 md:p-12 text-center max-w-2xl mx-auto">
      <div className="w-20 h-20 rounded-full bg-oasis-emerald/10 border border-oasis-emerald/30 flex items-center justify-center mx-auto mb-6">
        {loading ? <Loader2 className="w-10 h-10 text-oasis-gold animate-spin" /> : statusIcon}
      </div>

      <h1 className="text-3xl font-black font-display mb-3">Objednávka přijata</h1>
      <p className="text-gray-400 mb-6">
        Děkujeme za nákup v ZION eShopu.{order?.paymentStatus === 'paid'
          ? ' Platba byla úspěšně přijata a zboží co nejdříve odešleme.'
          : ' Po připsání platby vám zboží obratem odešleme.'}
      </p>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-left inline-block w-full">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Číslo objednávky:</span>
          <span className="font-mono font-bold">{orderId}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Status:</span>
          <span className={`font-semibold ${statusColor}`}>{statusText}</span>
        </div>
        {order && (
          <>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Celkem:</span>
              <span className="font-mono font-bold text-oasis-gold">{order.totalCzk} Kč</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Způsob platby:</span>
              <span className="font-semibold">
                {order.payment === 'card' ? 'Platební karta' : order.payment === 'transfer' ? 'Bankovní převod' : order.payment}
              </span>
            </div>
          </>
        )}
      </div>

      {sessionId && stripeVerified === false && (
        <div className="bg-oasis-gold/10 border border-oasis-gold/30 rounded-2xl p-4 mb-6 text-sm text-oasis-gold">
          Platba ještě nebyla potvrzena. Jakmile Stripe zpracuje platbu, tato stránka se automaticky aktualizuje.
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link href="/shop" className="zion-button-primary">
          <ShoppingBag className="w-4 h-4" /> Pokračovat v nákupu
        </Link>
        <a href="mailto:hello@zionterranova.com" className="zion-button-secondary">
          <Mail className="w-4 h-4" /> Kontaktovat podporu
        </a>
      </div>

      <div className="mt-8 pt-6 border-t border-white/10 text-xs text-gray-500">
        <p className="inline-flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          Máte dotaz? Napište nám na <a href="mailto:hello@zionterranova.com" className="text-oasis-gold">hello@zionterranova.com</a>.
        </p>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="zion-section p-16 text-center">Načítání…</div>}>
      <OrderSuccessContent />
    </Suspense>
  );
}
