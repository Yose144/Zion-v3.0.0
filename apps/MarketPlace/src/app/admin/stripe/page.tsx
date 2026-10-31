'use client';

import { useEffect, useState } from 'react';
import { useLangT } from '@/lib/useTranslation';

interface StripeOrder {
  orderId: string;
  paymentStatus: string;
  totalCzk: number;
  createdAt: string;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
  stripeSession: string | null;
}

interface StripeStatus {
  stripeKeySet: boolean;
  webhookSecretSet: boolean;
  orders: StripeOrder[];
}

export default function AdminStripePage() {
  const { t } = useLangT();
  const [data, setData] = useState<StripeStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/stripe/status')
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || !body?.data) {
          setError(body?.error || `HTTP ${res.status}`);
          return;
        }
        setData(body.data as StripeStatus);
      })
      .catch(() => setError('Stripe status failed'));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-black text-gradient mb-3">{t('admin.stripeTitle')}</h1>
      <p className="text-gray-400 mb-6">{t('admin.stripeDescription')}</p>

      {error && <p className="text-red-300 mb-4">{error}</p>}

      {data && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className={`px-3 py-1 rounded-full font-bold ${data.stripeKeySet ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
              {data.stripeKeySet ? t('admin.stripeKeyOn') : t('admin.stripeKeyOff')}
            </span>
            <span className={`px-3 py-1 rounded-full font-bold ${data.webhookSecretSet ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
              {data.webhookSecretSet ? t('admin.stripeWebhookOn') : t('admin.stripeWebhookOff')}
            </span>
          </div>

          <div>
            <h2 className="text-rasta-gold font-bold mb-3">{t('admin.stripeRecent')}</h2>
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-zion-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-gray-400">
                    <th className="p-3">{t('admin.invoiceOrder')}</th>
                    <th className="p-3">{t('admin.invoiceStatus')}</th>
                    <th className="p-3">Kč</th>
                    <th className="p-3">Stripe</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-gray-500">{t('admin.stripeNoOrders')}</td>
                    </tr>
                  )}
                  {data.orders.map((order) => (
                    <tr key={order.orderId} className="border-b border-white/5">
                      <td className="p-3 font-mono">{order.orderId}</td>
                      <td className="p-3">{order.paymentStatus}</td>
                      <td className="p-3">{order.totalCzk.toLocaleString('cs-CZ')}</td>
                      <td className="p-3">
                        {order.stripeSession ? (
                          <a
                            href={`https://dashboard.stripe.com/checkout/sessions/${order.stripeSession}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-rasta-gold hover:underline"
                          >
                            {order.stripeSession.slice(0, 22)}…
                          </a>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
