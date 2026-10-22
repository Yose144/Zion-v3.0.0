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
        <div className="zion-shell overflow-hidden" />
      }
    >
      <AddressDetailClient />
    </Suspense>
  );
}
