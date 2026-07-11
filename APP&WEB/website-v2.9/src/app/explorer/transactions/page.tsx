import type { Metadata } from 'next';
import { Suspense } from "react";
import TransactionsPageClient from "./TransactionsPageClient";

export const metadata: Metadata = {
  title: 'Transactions · ZION Explorer',
  description: 'Real-time ZION blockchain transaction feed — fees, outputs, and confirmations.',
};

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="zion-shell overflow-hidden" />
      }
    >
      <TransactionsPageClient />
    </Suspense>
  );
}