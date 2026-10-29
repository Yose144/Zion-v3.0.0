'use client';

import Link from 'next/link';
import { ArrowRight, Bot, Code2, Cpu, Terminal } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';

export default function AiSection() {
  const { t } = useLangT();
  const chips = [
    { icon: Terminal, key: 'homeAi.chipCli' },
    { icon: Code2, key: 'homeAi.chipApi' },
    { icon: Cpu, key: 'homeAi.chipFleet' },
  ];
  return (
    <section>
      <div className="flex items-center gap-4 mb-6">
        <div className="zion-kicker">{t('homeAi.kicker')}</div>
        <h2 className="text-2xl font-black font-display text-gradient">{t('homeAi.title')}</h2>
        <div className="section-line flex-1" />
      </div>
      <Link
        href="/ai"
        className="zion-rainbow-card group block p-6 md:p-8"
        style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
      >
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-14 h-14 shrink-0 rounded-xl bg-rasta-gold/10 border border-rasta-gold/25 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <Bot className="w-7 h-7 text-rasta-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-lg md:text-xl mb-1 font-display">
              {t('homeAi.cardTitle')}
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed">{t('homeAi.cardDesc')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map((c) => {
                const Icon = c.icon;
                return (
                  <span
                    key={c.key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300"
                  >
                    <Icon className="w-3.5 h-3.5 text-rasta-gold" />
                    {t(c.key)}
                  </span>
                );
              })}
            </div>
          </div>
          <span className="rasta-hero-btn rasta-hero-btn-primary shrink-0 self-start md:self-center">
            {t('homeAi.cta')}
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    </section>
  );
}
