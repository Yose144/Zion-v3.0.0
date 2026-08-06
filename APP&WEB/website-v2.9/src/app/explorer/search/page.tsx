import { Suspense } from "react";
import SearchResultsClient from "./SearchResultsClient";

export const metadata = {
  title: "Search Results — ZION Explorer",
  description: "Unified search across ZION blockchain blocks, transactions, and addresses.",
};

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="pt-28 md:pt-32 pb-24">
        <div className="zion-container max-w-5xl animate-pulse space-y-10">
          <div className="zion-rainbow-card h-40" style={{ '--rc': '7, 137, 48' } as React.CSSProperties} />
          <div className="zion-rainbow-card h-60" style={{ '--rc': '7, 137, 48' } as React.CSSProperties} />
        </div>
      </div>
    }>
      <SearchResultsClient />
    </Suspense>
  );
}
