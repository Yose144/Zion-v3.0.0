'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Sparkles, Globe2 } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tx5, t5 } from '@/lib/i18n-tx';

const StoryTriptychCopy = {
  goldenCompassOfTheNewEarth: { cs: `Zlatý Kompas Nové Země`, en: `Golden Compass of the New Earth` },
  theFourthBookOfZionPublicEntry: { cs: `Čtvrtá kniha ZION. Veřejný vstup do knihy, Kompasu a dalších vrstev bez roadmapového šumu.`, en: `The fourth book of ZION. Public entry into the book, Compass, and remaining layers.` },
  bookCompassCli: { cs: `Kniha · Kompas · CLI`, en: `Book · Compass · CLI` },
  quantumRevolution: { cs: `Kvantová Revoluce`, en: `Quantum Revolution` },
  theBookThatStartedItAll: { cs: `Kniha, která to odstartovala`, en: `The book that started it all` },
  aFiresideStoryOfANewEarthWhere: { cs: `Příběh u ohně o Nové Zemi, kde kvantová fyzika potkává duši a blockchain je meditace.`, en: `A fireside story of a New Earth where quantum physics meets the soul and blockchain is meditation.` },
  k10Chapters11Languages: { cs: `10 kapitol · 11 jazyků`, en: `10 chapters · 11 languages` },
  sacredStoryOfTheSameWorld: { cs: `Posvátný příběh stejného světa`, en: `Sacred story of the same world` },
  aMemoryOfTheFutureTheStoryOf14: { cs: `Vzpomínka na budoucnost. Příběh 144 000 duší, které se vracejí domů — hrdinou jsi ty.`, en: `A memory of the future. The story of 144 000 souls returning home — you are the hero.` },
  k9ChaptersOfAwakening: { cs: `9 kapitol probuzení`, en: `9 chapters of awakening` },
  threeStoriesOfOneWorld: { cs: `Tři příběhy jednoho světa`, en: `Three stories of one world` },
  storyPhilosophyAndMyth: { cs: `Příběh, filozofie a mýtus`, en: `Story, philosophy, and myth` },
  open: { cs: `Otevřít`, en: `Open` },
};

export default function StoryTriptych() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const cards = [
    {
      href: '/terranova',
      icon: Globe2,
      title: 'Terra Nova',
      subtitle: tx5(StoryTriptychCopy.goldenCompassOfTheNewEarth, lang),
      desc: tx5(StoryTriptychCopy.theFourthBookOfZionPublicEntry, lang),
      rc: '228, 30, 43', // rasta red
      iconColor: 'text-zion-purple',
      titleClass:
        'text-xl font-bold text-gradient transition-colors group-hover:text-zion-gold',
      chapters: tx5(StoryTriptychCopy.bookCompassCli, lang),
    },
    {
      href: '/quantum-revolution',
      icon: Sparkles,
      title: tx5(StoryTriptychCopy.quantumRevolution, lang),
      subtitle: tx5(StoryTriptychCopy.theBookThatStartedItAll, lang),
      desc: tx5(StoryTriptychCopy.aFiresideStoryOfANewEarthWhere, lang),
      rc: '252, 209, 22', // rasta gold
      iconColor: 'text-zion-gold',
      titleClass:
        'text-xl font-bold text-zion-gold transition-colors group-hover:text-zion-cyan',
      chapters: tx5(StoryTriptychCopy.k10Chapters11Languages, lang),
    },
    {
      href: '/genesis',
      icon: BookOpen,
      title: 'ZION Genesis',
      subtitle: tx5(StoryTriptychCopy.sacredStoryOfTheSameWorld, lang),
      desc: tx5(StoryTriptychCopy.aMemoryOfTheFutureTheStoryOf14, lang),
      rc: '6, 105, 40', // rasta green
      iconColor: 'text-zion-cyan',
      titleClass:
        'text-xl font-bold text-zion-cyan transition-colors group-hover:text-zion-gold',
      chapters: tx5(StoryTriptychCopy.k9ChaptersOfAwakening, lang),
    },
  ];

  return (
    <section className="px-4 py-10 sm:py-12">
      <div className="zion-container space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.36em] text-zion-gold">
            {tx5(StoryTriptychCopy.threeStoriesOfOneWorld, lang)}
          </p>
          <h2 className="text-3xl font-bold leading-tight text-white sm:text-4xl">
            {tx5(StoryTriptychCopy.storyPhilosophyAndMyth, lang)}
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
                  className="zion-rainbow-sub group block h-full p-6 space-y-4"
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
                    <Icon className={`h-7 w-7 ${card.iconColor}`} />
                  </div>

                  {/* Title */}
                  <div className="space-y-1">
                    <h3 className={card.titleClass}>{card.title}</h3>
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
                      {tx5(StoryTriptychCopy.open, lang)}
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
