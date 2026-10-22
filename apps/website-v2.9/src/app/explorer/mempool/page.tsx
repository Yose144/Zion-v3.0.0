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
        <div className="zion-shell overflow-hidden" />
      }
    >
      <MempoolPageClient />
    </Suspense>
  );
}
