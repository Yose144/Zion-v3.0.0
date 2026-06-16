import type { Metadata } from "next";
import ConsensusClient from "./ConsensusClient";

export const metadata: Metadata = {
  title: "Consensus · ZION Explorer",
  description: "LWMA DAA, Decade Decay emission, PoW algorithms, and reward distribution.",
};

export default function ConsensusPage() {
  return <ConsensusClient />;
}
