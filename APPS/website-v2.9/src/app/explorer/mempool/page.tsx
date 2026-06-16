import { Suspense } from "react";
import MempoolPageClient from "./MempoolPageClient";

export const metadata = {
  title: "Mempool — ZION Explorer",
  description: "Live view of pending transactions in the ZION mempool — fees, sizes, age and double-spend status.",
};

export default function MempoolPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen relative overflow-hidden bg-linear-to-br from-gray-950 via-purple-950/20 to-gray-950" />
      }
    >
      <MempoolPageClient />
    </Suspense>
  );
}
