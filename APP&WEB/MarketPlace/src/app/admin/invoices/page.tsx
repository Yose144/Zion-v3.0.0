'use client';

import { useEffect, useState } from 'react';
import { listAdminOrders, type AdminOrdersListResult } from '@/lib/shop-api';

export default function AdminInvoicesPage() {
  const [data, setData] = useState<AdminOrdersListResult['data'] | null>(null);

  useEffect(() => {
    listAdminOrders({ limit: 100 }).then((res) => {
      if (res?.data) setData(res.data);
    });
  }, []);

  const invoices =
    data?.orders.flatMap((order) =>
      order.invoices.map((inv) => ({ ...inv, orderId: order.orderId, customer: order.customerName }))
    ) ?? [];

  return (
    <div>
      <h1 className="text-2xl font-black text-gradient mb-6">Faktury</h1>
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-oasis-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-gray-400">
              <th className="p-3">Číslo faktury</th>
              <th className="p-3">Objednávka</th>
              <th className="p-3">Zákazník</th>
              <th className="p-3">Stav</th>
              <th className="p-3">Akce</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">Žádné faktury</td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-3 font-mono text-oasis-cyan">{inv.invoiceNumber}</td>
                <td className="p-3">{inv.orderId}</td>
                <td className="p-3">{inv.customer}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded text-xs bg-white/10">{inv.status}</span>
                </td>
                <td className="p-3">
                  <a
                    href={`/api/invoices/${inv.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-oasis-cyan hover:underline text-sm"
                  >
                    Zobrazit
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
