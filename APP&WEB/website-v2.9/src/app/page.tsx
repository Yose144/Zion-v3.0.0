import dynamicImport from 'next/dynamic';
import Hero from '@/components/Hero';
import BridgeStatusBanner from '@/components/BridgeStatusBanner';
import HomeQuickLinks from '@/components/HomeQuickLinks';
import WebTerminal from '@/components/WebTerminal';
import StoryTriptych from '@/components/StoryTriptych';
import StargateLogo from '@/components/StargateLogo';

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
      <section className="relative px-4 py-16 md:py-20">
        <div className="zion-container">
          <div className="mx-auto max-w-2xl text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-zion-cyan/75 mb-3">
              Stargate · Brána
            </p>
            <h2 className="text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl">
              ZION Stargate
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-300 md:text-lg">
              Původní stargate z newearth.cz — 28 rotujících vrstev, 39 glyphů, 9 chevronů.
              Náš kosmický portál mezi světy.
            </p>
          </div>
          <StargateLogo className="mx-auto max-w-[500px]" />
        </div>
      </section>
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
