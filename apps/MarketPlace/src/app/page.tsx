import {
  HeroSection,
  ZionPassSection,
  LampionSection,
  BookSection,
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
      <ZionPassSection />
      <BookSection />
      <LampionSection />
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
