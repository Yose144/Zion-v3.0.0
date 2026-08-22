import dynamicImport from 'next/dynamic';
import Hero from '@/components/Hero';
import BetaWarningBanner from '@/components/BetaWarningBanner';
import WhitepapersBanner from '@/components/WhitepapersBanner';
import OnboardBanner from '@/components/OnboardBanner';
import BridgeStatusBanner from '@/components/BridgeStatusBanner';
import HomeQuickLinks from '@/components/HomeQuickLinks';
import StoryTriptych from '@/components/StoryTriptych';
import ReleaseHighlightBanner from '@/components/ReleaseHighlightBanner';

const WebTerminal = dynamicImport(() => import('@/components/WebTerminal'), {
  loading: () => null,
});
const NewsFeed = dynamicImport(() => import('@/components/NewsFeed'));
const LiveDashboard = dynamicImport(() => import('@/components/LiveDashboard'));
const GoldenEggHaraniagharba = dynamicImport(() => import('@/components/GoldenEggHaraniagharba'));
const Features = dynamicImport(() => import('@/components/Features'));
const RoadmapPulse = dynamicImport(() => import('@/components/RoadmapPulse'));
const DocsRail = dynamicImport(() => import('@/components/DocsRail'));

// ISR: regenerate at most once every 60s. All visible content is either
// static (hero/news copy) or fetched client-side by 'use client' components
// (LiveDashboard, WebTerminal, etc.), so the server-rendered shell doesn't
// need to be re-rendered on every request. Deploys restart the whole
// zion-website process, which clears this cache anyway, so changes still
// show up immediately after a deploy.
export const revalidate = 60;

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
      <DocsRail />
    </>
  );
}
