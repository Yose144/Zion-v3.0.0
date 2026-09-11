'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useLang } from '@/contexts/LanguageContext';

const BetaWarningBannerCopy = {
  dismissWarning: { cs: `Zavřit varování`, en: `Dismiss warning` },
};

const DISMISS_KEY = 'zion-beta-warning-dismissed';

export default function BetaWarningBanner() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
    } catch { /* SSR or privacy mode */ }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="relative z-20 mx-auto max-w-4xl px-4 -mt-2"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-zion-gold/25 bg-zion-gold/[0.06] px-4 py-3 backdrop-blur-sm">
        <AlertTriangle className="h-5 w-5 text-zion-gold flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-amber-200/90 leading-relaxed">
            {cs ? (
              <>
                <strong className="font-semibold text-zion-gold">Veřejný launch odložen</strong> — ZION TerraNova zůstává v aktivním vývoji. Těžba a transakce probíhají na vlastní nebezpečí. Oficiální veřejný launch je odložen (TBD); nové datum oznámíme, až projekt projde Maturity Gate (Maturitou), získá základní likviditu a sestavíme tým dobrovolných vývojářů. <a href="/news/launch-postponed" className="underline hover:text-white">Číst oznámení</a>.
              </>
            ) : (
              <>
                <strong className="font-semibold text-zion-gold">Public launch postponed</strong> — ZION TerraNova remains in active development. Mining and transactions are at your own risk. The official public launch is postponed (TBD); a new date will be announced once the project passes the Maturity Gate, secures basic liquidity, and assembles a team of volunteer developers. <a href="/news/launch-postponed" className="underline hover:text-white">Read the announcement</a>.
              </>
            )}
          </p>
        </div>
        <button
          onClick={dismiss}
          className="flex-shrink-0 text-zion-gold/60 hover:text-zion-gold transition mt-0.5"
          aria-label={BetaWarningBannerCopy.dismissWarning[cs ? 'cs' : 'en']}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
