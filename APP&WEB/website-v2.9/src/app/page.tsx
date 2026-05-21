import dynamic from 'next/dynamic';
import Hero from '@/components/Hero';
import MainnetCountdown from '@/components/MainnetCountdown';
import GenesisPreview from '@/components/GenesisPreview';
import QuantumRevolution from '@/components/QuantumRevolution';

const NewsFeed = dynamic(() => import('@/components/NewsFeed'));
const LiveDashboard = dynamic(() => import('@/components/LiveDashboard'));
const TerraNovaHomeMilestones = dynamic(() => import('@/components/TerraNovaHomeMilestones'));
const GoldenEggHaraniagharba = dynamic(() => import('@/components/GoldenEggHaraniagharba'));
const Features = dynamic(() => import('@/components/Features'));
const RoadmapPulse = dynamic(() => import('@/components/RoadmapPulse'));
const DocsRail = dynamic(() => import('@/components/DocsRail'));
const HomeTreePortal = dynamic(() => import('@/components/HomeTreePortal'));

export default function Home() {
  return (
    <>
      <Hero />
      <MainnetCountdown />
      <NewsFeed />
      <LiveDashboard />
      <TerraNovaHomeMilestones />
      <GoldenEggHaraniagharba />
      <QuantumRevolution />
      <GenesisPreview />
      <Features />
      <RoadmapPulse />
      <DocsRail />
      <HomeTreePortal />
    </>
  );
}
