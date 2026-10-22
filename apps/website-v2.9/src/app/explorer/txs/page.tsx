import type { Metadata } from 'next';
import { Suspense } from "react";
import TxsPageClient from "./TxsPageClient";

export const metadata: Metadata = {
  title: 'Transaction List · ZION Explorer',
  description: 'Paginated ZION blockchain transaction list with real-time SSE updates, filtering, and CSV export.',
};

export default function TxsPage() {
  return (
    <Suspense
      fallback={<div className="zion-shell overflow-hidden" />}
    >
      <TxsPageClient />
    </Suspense>
  );
}
