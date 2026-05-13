import BridgeTrackerClient from "./BridgeTrackerClient";

export const metadata = {
  title: "Bridge Tracker — ZION Explorer",
  description: "Real-time L1↔Base bridge status. Track lock, mint, burn and unlock transactions with relay metrics from Prometheus.",
};

export default function BridgeTrackerPage() {
  return <BridgeTrackerClient />;
}
