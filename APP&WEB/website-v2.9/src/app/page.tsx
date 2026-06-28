import dynamicImport from 'next/dynamic';
import Hero from '@/components/Hero';
import BridgeStatusBanner from '@/components/BridgeStatusBanner';
import HomeQuickLinks from '@/components/HomeQuickLinks';
import WebTerminal from '@/components/WebTerminal';
import StoryTriptych from '@/components/StoryTriptych';
import IntroSection from '@/components/IntroSection';

const NewsFeed = dynamicImport(() => import('@/components/NewsFeed'));
const LiveDashboard = dynamicImport(() => import('@/components/LiveDashboard'));
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
      <IntroSection />
      <WebTerminal />
      <BridgeStatusBanner />
      <HomeQuickLinks />
      <NewsFeed />
      <LiveDashboard />
      <StoryTriptych />
      <GoldenEggHaraniagharba />
      <Features />
      <RoadmapPulse />
      <DocsRail />
      <HomeTreePortal />
    </>
  );
}
