import NetworkStatsClient from "./NetworkStatsClient";

export const metadata = {
  title: "Network Stats — ZION Explorer",
  description: "Real-time ZION network statistics: hashrate, difficulty, block time, transactions, and 24h historical charts.",
};

export default function NetworkStatsPage() {
  return <NetworkStatsClient />;
}
