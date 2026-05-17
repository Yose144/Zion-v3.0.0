import type { Metadata } from 'next';
import { Suspense } from "react";
import TxDetailClient from "./TxDetailClient";

export const metadata: Metadata = {
  title: 'Transaction · ZION Explorer',
  description: 'Detailed view of a ZION blockchain transaction — inputs, outputs, fees, and confirmation status.',
};

export default function TxPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen relative overflow-hidden bg-linear-to-br from-gray-950 via-purple-950/20 to-gray-950" />
      }
    >
      <TxDetailClient />
    </Suspense>
  );
}
