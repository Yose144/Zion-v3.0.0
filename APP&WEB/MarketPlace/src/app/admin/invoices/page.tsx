'use client';

import { useEffect, useState } from 'react';
import { listAdminOrders, type AdminOrdersListResult } from '@/lib/shop-api';
import { useLangT } from '@/lib/useTranslation';

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const INVOICE_STATUSES = ['issued', 'sent'];

export default function AdminInvoicesPage() {
  const [data, setData] = useState<AdminOrdersListResult['data'] | null>(null);
  const { t } = useLangT();

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
      <h1 className="text-2xl font-black text-gradient mb-6">{t('admin.invoicesTitle')}</h1>
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-zion-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-gray-400">
              <th className="p-3">{t('admin.invoiceNumber')}</th>
              <th className="p-3">{t('admin.invoiceOrder')}</th>
              <th className="p-3">{t('admin.invoiceCustomer')}</th>
              <th className="p-3">{t('admin.invoiceStatus')}</th>
              <th className="p-3">{t('admin.invoiceActions')}</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">{t('admin.noInvoices')}</td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-3 font-mono text-oasis-cyan">{inv.invoiceNumber}</td>
                <td className="p-3">{inv.orderId}</td>
                <td className="p-3">{inv.customer}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded text-xs bg-white/10">
                    {INVOICE_STATUSES.includes(inv.status)
                      ? t(`invoice.status${capitalize(inv.status)}` as const)
                      : inv.status}
                  </span>
                </td>
                <td className="p-3">
                  <a
                    href={`/api/invoices/${inv.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-oasis-cyan hover:underline text-sm"
                  >
                    {t('admin.view')}
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
