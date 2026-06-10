import type { Metadata } from "next";
import MinersLeaderboardClient from "./MinersLeaderboardClient";

export const metadata: Metadata = {
  title: "Top Miners · ZION Explorer",
  description: "Mining pool and solo miner leaderboard for ZION TerraNova.",
};

export default function MinersPage() {
  return <MinersLeaderboardClient />;
}
