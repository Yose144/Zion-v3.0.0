import type { Metadata } from "next";
import Dashboard from "./Dashboard";

export const metadata: Metadata = {
  title: "Vast.ai rigs · ZION OPS",
  description:
    "Live vast.ai fleet: mining hashpower per rig, AI inference capacity, GPU market and pool routing.",
  robots: { index: false, follow: false },
};

// Hidden unlisted ops page — data comes from /vast-rigs/status.json
// written by the vastctl daemon (infra/tools/vast/vastctl.py).
export default function VastRigsPage() {
  return <Dashboard />;
}
