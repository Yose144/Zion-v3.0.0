import {
  HeroSection,
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
      <BookSection />
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
