import dynamicImport from 'next/dynamic';
import Hero from '@/components/Hero';
import HomeNoticeBar from '@/components/HomeNoticeBar';

const WebTerminal = dynamicImport(() => import('@/components/WebTerminal'), {
  loading: () => null,
});
const NewsFeed = dynamicImport(() => import('@/components/NewsFeed'), { ssr: true });
const LiveDashboard = dynamicImport(() => import('@/components/LiveDashboard'), { ssr: true });
const Features = dynamicImport(() => import('@/components/Features'), { ssr: true });
const StoryTriptych = dynamicImport(() => import('@/components/StoryTriptych'), { ssr: true });
const RoadmapPulse = dynamicImport(() => import('@/components/RoadmapPulse'), { ssr: true });
const DocsRail = dynamicImport(() => import('@/components/DocsRail'), { ssr: true });

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
      <HomeNoticeBar />
      <WebTerminal />
      <LiveDashboard />
      <NewsFeed />
      <StoryTriptych />
      <Features />
      <RoadmapPulse />
      <DocsRail />
    </>
  );
}
