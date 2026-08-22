import TokensPageClient from "./TokensPageClient";

export const metadata = {
  title: "Tokens — ZION Explorer",
  description: "Live token directory for ZION and wZION: price, market cap, supply, DEX volume and Base contract.",
};

export default function TokensPage() {
  return <TokensPageClient />;
}
