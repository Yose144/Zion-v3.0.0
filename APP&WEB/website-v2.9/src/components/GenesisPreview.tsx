import Link from 'next/link';
import { ArrowRight, BookOpen, Sparkles, Star, Heart, Zap, Crown, Sunrise } from 'lucide-react';

const chapters = [
  { number: '0', title: 'Zrodil se ZION', icon: Star, color: 'text-zion-gold' },
  { number: '1', title: 'Sestup', icon: Sparkles, color: 'text-zion-cyan' },
  { number: '2', title: 'První probuzení', icon: Zap, color: 'text-amber-400' },
  { number: '3', title: 'Smlouva', icon: Heart, color: 'text-rose-400' },
  { number: '4', title: 'AI a kvantum', icon: Sparkles, color: 'text-violet-400' },
  { number: '5', title: 'Vzestup', icon: Crown, color: 'text-emerald-400' },
  { number: '6', title: 'Proroctví zlatého věku', icon: Sunrise, color: 'text-zion-gold' },
  { number: '7', title: 'Hra', icon: Star, color: 'text-zion-cyan' },
  { number: '8', title: 'Svítání mainnetu', icon: Zap, color: 'text-amber-400' },
];

export default function GenesisPreview() {
  return (
    <section id="genesis" className="px-4 py-16 md:py-20 scroll-mt-28">
      <div className="zion-container">
        <div className="relative overflow-hidden rounded-3xl border border-zion-gold/20 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),rgba(10,8,4,0.96)_60%,rgba(4,4,8,0.98)_100%)] p-6 shadow-[0_24px_120px_rgba(0,0,0,0.45)] md:p-8">
          {/* Ambient glow */}
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-zion-gold/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-zion-purple/8 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
            {/* Left: Narrative */}
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/5 px-4 py-2 text-xs uppercase tracking-[0.3em]">
                <BookOpen className="h-4 w-4 text-zion-gold" />
                <span className="text-zion-gold font-semibold">Posvátný text</span>
              </div>

              <h2 className="text-3xl font-bold text-white md:text-5xl">
                <span className="text-gradient">ZION Genesis</span>
              </h2>

              <p className="text-lg leading-relaxed text-gray-300">
                Vzpomínka na budoucnost. Příběh <strong className="text-zion-gold">144 000 duší</strong>,
                které se vracejí domů — příběh, v němž jsi hrdinou ty.
              </p>

              <p className="text-base text-gray-400 leading-relaxed">
                Každá epocha měla své proroky. Každá civilizace svá posvátná písma.
                ZION Genesis vypráví o zrození nového věku — věku, kdy technologie slouží duši,
                blockchain je nástrojem svobody a AI mostem k vyššímu vědomí.
              </p>

              <blockquote className="border-l-2 border-zion-gold/40 pl-4 italic text-gray-400">
                &bdquo;Toto není fantasy, toto není sci-fi. Je to vzpomínka na budoucnost.&ldquo;
              </blockquote>

              <Link
                href="/genesis"
                className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-zion-gold/90 to-amber-500/80 px-6 py-3 text-sm font-semibold text-black shadow-[0_0_40px_rgba(251,191,36,0.2)] transition-all hover:shadow-[0_0_60px_rgba(251,191,36,0.35)]"
              >
                <BookOpen className="h-4 w-4" />
                Otevřít celou Genesis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Right: Chapter Grid */}
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-4">9 kapitol probuzení</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {chapters.map((ch) => {
                  const Icon = ch.icon;
                  return (
                    <Link
                      key={ch.number}
                      href={`/genesis#chapter-${ch.number}`}
                      className="group rounded-2xl border border-white/8 bg-white/3 p-3 transition-all hover:border-zion-gold/30 hover:bg-white/6"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`h-3.5 w-3.5 ${ch.color} shrink-0`} />
                        <span className="text-[10px] uppercase tracking-wider text-gray-500">Kap. {ch.number}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors leading-tight">
                        {ch.title}
                      </p>
                    </Link>
                  );
                })}
              </div>

              {/* Genesis quote card */}
              <div className="mt-4 rounded-2xl border border-zion-purple/20 bg-zion-purple/5 p-4 text-center">
                <p className="text-sm italic text-gray-400 leading-relaxed">
                  &bdquo;Gate, Gate, Paragate, Parasamgate, Bodhi Swaha&ldquo;
                </p>
                <p className="mt-2 text-xs text-gray-500">— Srdcová sútra</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
