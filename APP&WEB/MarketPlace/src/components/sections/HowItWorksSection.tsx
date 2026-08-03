'use client';

import { Wallet, Zap, Gamepad2, type LucideIcon } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';

const steps: { stepKey: string; titleKey: string; descKey: string; icon: LucideIcon }[] = [
  { stepKey: 'howItWorks.step1', titleKey: 'howItWorks.step1Title', descKey: 'howItWorks.step1Desc', icon: Wallet },
  { stepKey: 'howItWorks.step2', titleKey: 'howItWorks.step2Title', descKey: 'howItWorks.step2Desc', icon: Zap },
  { stepKey: 'howItWorks.step3', titleKey: 'howItWorks.step3Title', descKey: 'howItWorks.step3Desc', icon: Gamepad2 },
];

export default function HowItWorksSection() {
  const { t } = useLangT();
  return (
    <section>
      <div className="flex items-center gap-4 mb-6">
        <div className="zion-kicker">{t('howItWorks.kicker')}</div>
        <h2 className="text-2xl font-black font-display text-gradient">{t('howItWorks.title')}</h2>
        <div className="section-line flex-1" />
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.stepKey} className="zion-tile p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-oasis-cyan/10 border border-oasis-cyan/20 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-oasis-cyan" />
                </div>
                <span className="text-3xl font-black text-white/5 font-mono">{t(s.stepKey)}</span>
              </div>
              <h3 className="font-bold text-white text-lg mb-2 font-display">{t(s.titleKey)}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{t(s.descKey)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
