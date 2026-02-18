import Hero from "@/components/Hero";
import TreeOfLifeSwitch from "@/components/TreeOfLifeSwitch";
import LiveDashboard from "@/components/LiveDashboard";
import WarpCorridors from "@/components/WarpCorridors";
import Features from "@/components/Features";
import RoadmapPulse from "@/components/RoadmapPulse";
import DocsRail from "@/components/DocsRail";

export default function Home() {
  return (
    <>
      <Hero />
      <TreeOfLifeSwitch />
      <LiveDashboard />
      <WarpCorridors />
      <Features />
      <RoadmapPulse />
      <DocsRail />
    </>
  );
}
