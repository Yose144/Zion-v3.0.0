import Hero from "@/components/Hero";
import GoldenEggHaraniagharba from "@/components/GoldenEggHaraniagharba";
import HomeTreePortal from "@/components/HomeTreePortal";
import LiveDashboard from "@/components/LiveDashboard";
import Features from "@/components/Features";
import NewsFeed from "@/components/NewsFeed";
import RoadmapPulse from "@/components/RoadmapPulse";
import DocsRail from "@/components/DocsRail";

export default function Home() {
  return (
    <>
      <Hero />
      <NewsFeed />
      <LiveDashboard />
      <Features />
      <GoldenEggHaraniagharba />
      <HomeTreePortal />
      <RoadmapPulse />
      <DocsRail />
    </>
  );
}
