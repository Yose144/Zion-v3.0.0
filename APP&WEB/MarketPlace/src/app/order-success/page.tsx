'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, ShoppingBag, Mail, HelpCircle } from 'lucide-react';

function OrderSuccessContent() {
  const search = useSearchParams();
  const orderId = search.get('order') ?? '';

  return (
    <div className="zion-section p-8 md:p-12 text-center max-w-2xl mx-auto">
      <div className="w-20 h-20 rounded-full bg-oasis-emerald/10 border border-oasis-emerald/30 flex items-center justify-center mx-auto mb-6">
        <Check className="w-10 h-10 text-oasis-emerald" />
      </div>

      <h1 className="text-3xl font-black font-display mb-3">Objednávka přijata</h1>
      <p className="text-gray-400 mb-6">
        Děkujeme za nákup v ZION eShopu. Po připsání platby vám zboží obratem odešleme.
      </p>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-left inline-block w-full">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Číslo objednávky:</span>
          <span className="font-mono font-bold">{orderId || '—'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Status:</span>
          <span className="text-oasis-gold font-semibold">Čeká na platbu</span>
        </div>
      </div>

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
