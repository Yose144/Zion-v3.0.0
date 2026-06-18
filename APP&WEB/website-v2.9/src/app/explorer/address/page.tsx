import type { Metadata } from 'next';
import { Suspense } from "react";
import AddressDetailClient from "./AddressDetailClient";

export const metadata: Metadata = {
  title: 'Address · ZION Explorer',
  description: 'ZION blockchain address detail — balance, transactions, and UTXO history.',
};

export default function AddressPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-950 via-purple-950/20 to-gray-950" />
      }
    >
      <AddressDetailClient />
    </Suspense>
  );
}
