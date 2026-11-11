import {
  HeroSection,
  TimelineSection,
  ShopNews,
  ZionPassSection,
  LampionSection,
  BookSection,
  ChristmasJourneySection,
  StatsSection,
  CategoriesSection,
  AiSection,
  FeaturedSection,
  HowItWorksSection,
  CtaSection,
} from '@/components/sections';
import MarketLockedNotice from '@/components/MarketLockedNotice';

export default function HomePage() {
  return (
    <div className="space-y-16 md:space-y-20">
      <HeroSection />
      {/* Časová osa patří přímo pod celý blok hero a před první další sekci. */}
      <TimelineSection />
      {/* Novinky pod hero — nahradily varovný pruh „ve výstavbě“ */}
      <ShopNews />
      <ZionPassSection />
      <BookSection />
      <LampionSection />
      <ChristmasJourneySection />
      <AiSection />
      <MarketLockedNotice />
      <FeaturedSection />
      <StatsSection />
      <CategoriesSection />
      <HowItWorksSection />
      <CtaSection />
    </div>
  );
}
