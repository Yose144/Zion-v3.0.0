import type { Metadata } from 'next';
import Hero from '@/components/Hero';
import HomeNoticeBar from '@/components/HomeNoticeBar';
import HomeInteractiveSection from '@/components/HomeInteractiveSection';
import MaitreyaSection from '@/components/MaitreyaSection';
import WelcomeOasisSection from '@/components/WelcomeOasisSection';
import NewsFeed from '@/components/NewsFeed';
import Features from '@/components/Features';
import StoryTriptych from '@/components/StoryTriptych';
import RoadmapPulse from '@/components/RoadmapPulse';
import DocsRail from '@/components/DocsRail';

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
      <MaitreyaSection />
      <WelcomeOasisSection />
      <HomeNoticeBar />
      <HomeInteractiveSection kind="terminal" />
      <HomeInteractiveSection kind="dashboard" />
      <NewsFeed />
      <StoryTriptych />
      <HomeInteractiveSection kind="hiran" />
      <Features />
      <RoadmapPulse />
      <DocsRail />
    </>
  );
}

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};
