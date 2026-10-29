'use client';

import Link from 'next/link';
import { ArrowRight, Bot } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';

export default function AiSection() {
  const { t } = useLangT();
  return (
    <section>
      <div className="flex items-center gap-4 mb-6">
        <div className="zion-kicker">{t('homeAi.kicker')}</div>
        <h2 className="text-2xl font-black font-display text-gradient">{t('homeAi.title')}</h2>
        <div className="section-line flex-1" />
      </div>
      <Link
        href="/ai"
        className="zion-tile group flex flex-col sm:flex-row sm:items-center gap-5 p-6 md:p-8 transition-colors hover:border-rasta-gold/40"
      >
        <div className="w-14 h-14 shrink-0 rounded-xl bg-rasta-gold/10 border border-rasta-gold/25 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
          <Bot className="w-7 h-7 text-rasta-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-lg md:text-xl mb-1 font-display">
            {t('homeAi.cardTitle')}
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed">{t('homeAi.cardDesc')}</p>
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-bold text-rasta-gold shrink-0">
          {t('homeAi.cta')}
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </span>
      </Link>
    </section>
  );
}
