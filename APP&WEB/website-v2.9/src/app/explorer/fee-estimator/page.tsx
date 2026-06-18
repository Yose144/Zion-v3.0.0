import type { Metadata } from "next";
import FeeEstimatorClient from "./FeeEstimatorClient";

export const metadata: Metadata = {
  title: "Fee Estimator · ZION Explorer",
  description: "Recommended transaction fees based on real-time mempool analysis.",
};

export default function FeeEstimatorPage() {
  return <FeeEstimatorClient />;
}
