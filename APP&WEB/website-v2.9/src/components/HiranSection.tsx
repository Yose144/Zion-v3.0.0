'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Brain, Sparkles } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import HiranMiniChat from './HiranMiniChat';

const HiranSectionCopy = {
  kicker: { cs: `L3 · AI Native`, en: `L3 · AI Native` },
  title: { cs: `Hiran — AI průvodce sítí`, en: `Hiran — the network's AI guide` },
  desc: {
    cs: `Zion-expert model natrénovaný na dokumentaci, chain datech a mýtu projektu. Zeptej se na cokoliv — těžba, vrstvy, filozofie.`,
    en: `Zion-expert model trained on the docs, chain data, and the project's myth. Ask anything — mining, layers, philosophy.`,
  },
  openL3: { cs: `Vrstva L3 · Hiranyagarbha`, en: `L3 layer · Hiranyagarbha` },
};

export default function HiranSection() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <section className="px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="zion-container"
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div className="min-w-0">
            <p className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-zion-purple/80">
              <Sparkles className="h-3.5 w-3.5" />
              {HiranSectionCopy.kicker[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-xl font-bold leading-tight text-white sm:text-2xl">
              {HiranSectionCopy.title[cs ? 'cs' : 'en']}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-400">
              {HiranSectionCopy.desc[cs ? 'cs' : 'en']}
            </p>
            <Link
              href="/l3-hiran"
              className="group mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-zion-purple transition-colors hover:text-zion-cyan"
            >
              <Brain className="h-3.5 w-3.5" />
              {HiranSectionCopy.openL3[cs ? 'cs' : 'en']}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <HiranMiniChat lang={lang} />
        </div>
      </motion.div>
    </section>
  );
}
