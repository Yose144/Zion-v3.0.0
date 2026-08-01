import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="relative zion-rainbow-card p-8 md:p-12 text-center overflow-visible" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
      {/* Ambient orbs */}
      <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-oasis-cyan/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-oasis-gold/10 blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="zion-kicker mb-6 mx-auto">
          <Sparkles className="w-3.5 h-3.5 text-oasis-gold" />
          <span className="status-dot status-active" />
          Live on Base L2 · ERC-1155
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-5 font-display">
          <span className="text-gradient-animated">OASIS Artifact</span>
          <br />
          <span className="text-white">Marketplace</span>
        </h1>
        <p className="text-base sm:text-lg text-gray-300 max-w-2xl mx-auto mb-8 leading-relaxed">
          Trade avatars, ships, quest items, territory deeds, and Golden Eggs from the
          ZION OASIS universe. Pay with wZION on L2 or native ZION on L1.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/explore" className="zion-button-primary text-base px-7 py-3 group">
            Explore Market
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/create" className="zion-button-secondary text-base px-7 py-3">
            Create Listing
          </Link>
        </div>
      </div>
    </section>
  );
}
