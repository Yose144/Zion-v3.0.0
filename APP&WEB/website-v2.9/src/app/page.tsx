import dynamicImport from 'next/dynamic';
import Hero from '@/components/Hero';
import BridgeStatusBanner from '@/components/BridgeStatusBanner';
import MainnetCountdown from '@/components/MainnetCountdown';
import GenesisPreview from '@/components/GenesisPreview';
import QuantumRevolution from '@/components/QuantumRevolution';
import HomeQuickLinks from '@/components/HomeQuickLinks';
import WebTerminal from '@/components/WebTerminal';

const NewsFeed = dynamicImport(() => import('@/components/NewsFeed'));
const LiveDashboard = dynamicImport(() => import('@/components/LiveDashboard'));
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
      <Hero />
      <WebTerminal />
      <BridgeStatusBanner />
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
