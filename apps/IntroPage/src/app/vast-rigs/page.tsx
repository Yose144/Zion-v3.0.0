import type { Metadata } from "next";
import Dashboard from "./Dashboard";

export const metadata: Metadata = {
  title: "vast rigs",
  robots: { index: false, follow: false },
};

// Hidden unlisted ops page — data comes from /vast-rigs/status.json
// written by the vastctl daemon (infra/tools/vast/vastctl.py).
export default function VastRigsPage() {
  return <Dashboard />;
}
