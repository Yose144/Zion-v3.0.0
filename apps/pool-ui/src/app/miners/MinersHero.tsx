'use client';

import { Crown } from 'lucide-react';
import { useLang } from '@/lib/i18n';

export default function MinersHero() {
  const { t } = useLang();
  return (
    <header className="page-hero">
      <p className="rasta-hero-kicker">
        <Crown size={12} /> {t('Žebříček', 'Leaderboard')}
      </p>
      <h1>{t('Top mineři', 'Top miners')}</h1>
      <p className="page-hero-sub">
        {t(
          'Nejsilnější stroje na poolu — žebříček řadí dominantní stream každého minera. Adresy jsou maskované, rigy čitelné.',
          'The strongest rigs on the pool — ranked by each miner\u2019s dominant stream. Addresses are masked, rig labels readable.',
        )}
      </p>
    </header>
  );
}
