'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Sparkles, Globe2 } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

export default function StoryTriptych() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const cards = [
    {
      href: '/terranova',
      icon: Globe2,
      title: 'Terra Nova',
      subtitle: cs ? 'Zlatý Kompas Nové Země' : 'Golden Compass of the New Earth',
      desc: cs
        ? 'Čtvrtá kniha ZION. Veřejný vstup do knihy, Kompasu a dalších vrstev bez roadmapového šumu.'
        : 'The fourth book of ZION. Public entry into the book, Compass, and remaining layers.',
      rc: '244, 63, 94', // rose
      chapters: cs ? 'Kniha · Kompas · CLI' : 'Book · Compass · CLI',
    },
    {
      href: '/genesis#chapter-4',
      icon: Sparkles,
      title: cs ? 'Kvantová Revoluce' : 'Quantum Revolution',
      subtitle: cs ? 'Kniha, která to odstartovala' : 'The book that started it all',
      desc: cs
        ? 'Příběh u ohně o Nové Zemi, kde kvantová fyzika potkává duši a blockchain je meditace.'
        : 'A fireside story of a New Earth where quantum physics meets the soul and blockchain is meditation.',
      rc: '217, 70, 239', // fuchsia
      chapters: cs ? '10 kapitol · 11 jazyků' : '10 chapters · 11 languages',
    },
    {
      href: '/genesis',
      icon: BookOpen,
      title: 'ZION Genesis',
      subtitle: cs ? 'Posvátný příběh stejného světa' : 'Sacred story of the same world',
      desc: cs
        ? 'Vzpomínka na budoucnost. Příběh 144 000 duší, které se vracejí domů — hrdinou jsi ty.'
        : 'A memory of the future. The story of 144 000 souls returning home — you are the hero.',
      rc: '20, 184, 166', // teal
      chapters: cs ? '9 kapitol probuzení' : '9 chapters of awakening',
    },
  ];

  return (
    <section className="px-4 py-14 sm:py-16">
      <div className="zion-container space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.36em] text-zion-gold">
            {cs ? 'Tři příběhy jednoho světa' : 'Three stories of one world'}
          </p>
          <h2 className="text-3xl font-bold leading-tight text-white sm:text-4xl">
            {cs ? 'Příběh, filozofie a mýtus' : 'Story, philosophy, and myth'}
          </h2>
        </div>

        {/* 3 cards side by side */}
        <div className="grid gap-5 md:grid-cols-3">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <Link
                  href={card.href}
                  className="zion-rainbow-card group block h-full p-6 space-y-4"
                  style={{ '--rc': card.rc } as React.CSSProperties}
                >
                  {/* Icon */}
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl border transition-transform group-hover:scale-110"
                    style={{
                      borderColor: `rgba(${card.rc}, 0.4)`,
                      backgroundColor: `rgba(${card.rc}, 0.12)`,
                    }}
                  >
                    <Icon className="h-7 w-7" style={{ color: `rgb(${card.rc})` }} />
                  </div>

                  {/* Title */}
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-white">{card.title}</h3>
                    <p className="text-[11px] uppercase tracking-wider" style={{ color: `rgba(${card.rc}, 0.8)` }}>
                      {card.subtitle}
                    </p>
                  </div>

                  {/* Description */}
                  <p className="text-sm leading-relaxed text-gray-400">{card.desc}</p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-[10px] uppercase tracking-wider text-gray-600">{card.chapters}</span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold transition-all group-hover:gap-2" style={{ color: `rgb(${card.rc})` }}>
                      {cs ? 'Otevřít' : 'Open'}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
