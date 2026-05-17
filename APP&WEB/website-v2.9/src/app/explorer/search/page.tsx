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
          <div className="rounded-4xl bg-black/60 h-40" />
          <div className="rounded-4xl bg-black/60 h-60" />
        </div>
      </div>
    }>
      <SearchResultsClient />
    </Suspense>
  );
}
