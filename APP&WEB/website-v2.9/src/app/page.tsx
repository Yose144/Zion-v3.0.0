import dynamicImport from 'next/dynamic';
import Hero from '@/components/Hero';
import BetaWarningBanner from '@/components/BetaWarningBanner';
import WhitepapersBanner from '@/components/WhitepapersBanner';
import OnboardBanner from '@/components/OnboardBanner';
import BridgeStatusBanner from '@/components/BridgeStatusBanner';
import HomeQuickLinks from '@/components/HomeQuickLinks';
import WebTerminal from '@/components/WebTerminal';
import StoryTriptych from '@/components/StoryTriptych';
import ReleaseHighlightBanner from '@/components/ReleaseHighlightBanner';

const NewsFeed = dynamicImport(() => import('@/components/NewsFeed'));
const LiveDashboard = dynamicImport(() => import('@/components/LiveDashboard'));
const GoldenEggHaraniagharba = dynamicImport(() => import('@/components/GoldenEggHaraniagharba'));
const Features = dynamicImport(() => import('@/components/Features'));
const RoadmapPulse = dynamicImport(() => import('@/components/RoadmapPulse'));
const DocsRail = dynamicImport(() => import('@/components/DocsRail'));
const HomeProtocolLayers = dynamicImport(() => import('@/components/HomeProtocolLayers'));

// Force dynamic rendering so deploy changes appear immediately
export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <>
      <Hero />
      <WhitepapersBanner />
      <OnboardBanner />
      <BetaWarningBanner />
      <WebTerminal />
      <BridgeStatusBanner />
      <HomeQuickLinks />
      <ReleaseHighlightBanner />
      <NewsFeed />
      <LiveDashboard />
      <StoryTriptych />
      <GoldenEggHaraniagharba />
      <Features />
      <RoadmapPulse />
      <HomeProtocolLayers />
      <DocsRail />
    </>
  );
}
