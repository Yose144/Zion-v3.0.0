'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { CSSProperties } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import { ArrowLeft, Lock, TrendingUp } from 'lucide-react';

// StakingPanel uses browser-only hooks (ethers, WalletContext) — disable SSR.
const StakingPanel = dynamic(() => import('@/components/StakingPanel'), {
  ssr: false,
  loading: () => (
    <div className="zion-rainbow-card p-6 md:p-10 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-white/10 mb-4" />
      <div className="h-4 w-96 max-w-full rounded bg-white/5 mb-2" />
      <div className="h-4 w-64 rounded bg-white/5" />
    </div>
  ),
});

const CopyText = {
  title: { cs: 'Staking', en: 'Staking' },
  subtitle: {
    cs: 'Stakujte wZION a získejte fixní 12% APR. Cooldown 7 dní pro bezpečný unstake.',
    en: 'Stake wZION and earn fixed 12% APR. 7-day cooldown for safe unstaking.',
  },
  back: { cs: 'Zpět na peněženku', en: 'Back to wallet' },
  bridge: { cs: 'Bridge', en: 'Bridge' },
};

export default function StakingPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const t = (key: keyof typeof CopyText) => CopyText[key][cs ? 'cs' : 'en'];

  return (
    <div className="zion-page text-white min-h-screen">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-zion-purple/18 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-zion-cyan/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-zion-gold/10 blur-3xl" />
      </div>

      <div className="zion-container relative z-10 max-w-7xl space-y-8 pt-8">
        {/* Hero header */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="zion-rainbow-card p-6 md:p-10"
            style={{ '--rc': '255, 215, 0' } as CSSProperties}
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <Link
                  href="/wallet/multichain"
                  className="inline-flex items-center gap-2 text-sm text-zion-cyan hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('back')}
                </Link>
                <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                  <Lock className="h-4 w-4" />
                  {t('title')}
                </div>
                <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                  {t('title')}
                </h1>
                <p className="text-lg text-gray-300 max-w-2xl">{t('subtitle')}</p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/wallet/multichain"
                  className="zion-button-secondary inline-flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('back')}
                </Link>
                <Link
                  href="/wallet/bridge"
                  className="zion-button-primary inline-flex items-center gap-2"
                >
                  <TrendingUp className="h-4 w-4" />
                  {t('bridge')}
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Staking panel (client-only, no SSR) */}
        <section>
          <StakingPanel />
        </section>
      </div>
    </div>
  );
}
