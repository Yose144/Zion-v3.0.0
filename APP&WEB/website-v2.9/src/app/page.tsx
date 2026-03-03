import Hero from "@/components/Hero";
import TreeOfLifeSwitch from "@/components/TreeOfLifeSwitch";
import LiveDashboard from "@/components/LiveDashboard";
import WarpCorridors from "@/components/WarpCorridors";
import CHv4Upgrade from "@/components/CHv4Upgrade";
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
      <div id="chv4">
        <CHv4Upgrade />
      </div>
      <Features />
      <RoadmapPulse />
      <DocsRail />
    </>
  );
}
