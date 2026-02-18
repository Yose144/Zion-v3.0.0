import { Suspense } from "react";
import TransactionsPageClient from "./TransactionsPageClient";

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen relative overflow-hidden bg-linear-to-br from-gray-950 via-purple-950/20 to-gray-950" />
      }
    >
      <TransactionsPageClient />
    </Suspense>
  );
}