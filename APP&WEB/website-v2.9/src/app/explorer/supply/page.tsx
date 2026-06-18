import SupplyPageClient from "./SupplyPageClient";

export const metadata = {
  title: "Supply Dashboard — ZION Explorer",
  description: "Complete ZION supply overview: circulating, mined, burned, locked, and remaining. Decade Decay emission with 144 billion cap.",
};

export default function SupplyPage() {
  return <SupplyPageClient />;
}
