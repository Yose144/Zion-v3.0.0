'use client';

import { useEffect, useState } from 'react';
import { listAdminOrders, updateTrackingNumber, type AdminOrdersListResult } from '@/lib/shop-api';

export default function AdminShippingPage() {
  const [data, setData] = useState<AdminOrdersListResult['data'] | null>(null);
  const [tracking, setTracking] = useState<Record<string, string>>({});

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
      <h1 className="text-2xl font-black text-gradient mb-6">Doprava</h1>
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-oasis-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-gray-400">
              <th className="p-3">Objednávka</th>
              <th className="p-3">Zákazník</th>
              <th className="p-3">Doprava</th>
              <th className="p-3">Sledovací číslo</th>
            </tr>
          </thead>
          <tbody>
            {data?.orders.map((order) => (
              <tr key={order.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-3 font-mono text-oasis-cyan">{order.orderId}</td>
                <td className="p-3">{order.customerName}</td>
                <td className="p-3">{order.shipping}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      defaultValue={order.trackingNumber ?? ''}
                      onChange={(e) => setTracking({ ...tracking, [order.id]: e.target.value })}
                      placeholder="Tracking number"
                      className="bg-oasis-surface border border-white/10 rounded px-3 py-1.5 text-sm flex-1"
                    />
                    <button
                      onClick={() => handleSave(order.id)}
                      className="px-3 py-1.5 rounded bg-oasis-cyan/20 text-oasis-cyan hover:bg-oasis-cyan/30 text-sm"
                    >
                      Uložit
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
