import dynamicImport from 'next/dynamic';
import Hero from '@/components/Hero';
import MainnetCountdown from '@/components/MainnetCountdown';
import GenesisPreview from '@/components/GenesisPreview';
import QuantumRevolution from '@/components/QuantumRevolution';
import HomeQuickLinks from '@/components/HomeQuickLinks';
import ConstructionBanner from '@/components/ConstructionBanner';

const NewsFeed = dynamicImport(() => import('@/components/NewsFeed'));
import LiveDashboard from '@/components/LiveDashboard';
const TerraNovaHomeMilestones = dynamicImport(() => import('@/components/TerraNovaHomeMilestones'));
const GoldenEggHaraniagharba = dynamicImport(() => import('@/components/GoldenEggHaraniagharba'));
const Features = dynamicImport(() => import('@/components/Features'));
const RoadmapPulse = dynamicImport(() => import('@/components/RoadmapPulse'));
const DocsRail = dynamicImport(() => import('@/components/DocsRail'));
const HomeTreePortal = dynamicImport(() => import('@/components/HomeTreePortal'));

// Force dynamic rendering so deploy changes appear immediately
export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <>
      <ConstructionBanner />
      <Hero />
      <MainnetCountdown />
      <HomeQuickLinks />
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
