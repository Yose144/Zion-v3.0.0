'use client';

import { useEffect, useState } from 'react';
import { listAdminOrders, updateTrackingNumber, type AdminOrdersListResult } from '@/lib/shop-api';
import { useLangT } from '@/lib/useTranslation';

function getShippingLabel(method: string, t: (path: string, params?: Record<string, string | number>) => string) {
  const map: Record<string, string> = {
    'zasilkovna': 'shipping.zasilkovna',
    'zasilkovna-home': 'shipping.zasilkovnaHome',
    'virtualni-nakup': 'shipping.virtualniNakup',
    'virtualni-odber': 'shipping.virtualniOdber',
  };
  return t(map[method] ?? method);
}

export default function AdminShippingPage() {
  const [data, setData] = useState<AdminOrdersListResult['data'] | null>(null);
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const { t } = useLangT();

  const load = () => {
    listAdminOrders({ status: 'paid', limit: 100 }).then((res) => {
      if (res?.data) setData(res.data);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (id: string) => {
    const value = tracking[id];
    if (!value) return;
    await updateTrackingNumber(id, value);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-black text-gradient mb-6">{t('admin.shippingTitle')}</h1>
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-oasis-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-gray-400">
              <th className="p-3">{t('admin.shippingOrder')}</th>
              <th className="p-3">{t('admin.shippingCustomer')}</th>
              <th className="p-3">{t('admin.shippingMethod')}</th>
              <th className="p-3">{t('admin.shippingTracking')}</th>
            </tr>
          </thead>
          <tbody>
            {data?.orders.map((order) => (
              <tr key={order.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-3 font-mono text-oasis-cyan">{order.orderId}</td>
                <td className="p-3">{order.customerName}</td>
                <td className="p-3">{getShippingLabel(order.shipping, t)}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      defaultValue={order.trackingNumber ?? ''}
                      onChange={(e) => setTracking({ ...tracking, [order.id]: e.target.value })}
                      placeholder={t('admin.shippingTracking')}
                      className="bg-oasis-surface border border-white/10 rounded px-3 py-1.5 text-sm flex-1"
                    />
                    <button
                      onClick={() => handleSave(order.id)}
                      className="px-3 py-1.5 rounded bg-oasis-cyan/20 text-oasis-cyan hover:bg-oasis-cyan/30 text-sm"
                    >
                      {t('admin.save')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
