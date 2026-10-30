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

export default function HomePage() {
  return (
    <div className="space-y-16 md:space-y-20">
      <HeroSection />
      <BookSection />
      <StatsSection />
      <CategoriesSection />
      <AiSection />
      <FeaturedSection />
      <HowItWorksSection />
      <CtaSection />
    </div>
  );
}
