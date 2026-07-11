import type { Metadata } from 'next';
import { Suspense } from "react";
import BlockDetailClient from "./BlockDetailClient";

export const metadata: Metadata = {
  title: 'Block Detail · ZION Explorer',
  description: 'Detailed view of a ZION blockchain block — transactions, miner, reward, and metadata.',
};

export default function BlockPage() {
  return (
    <Suspense
      fallback={
        <div className="zion-shell overflow-hidden" />
      }
    >
      <BlockDetailClient />
    </Suspense>
  );
}
