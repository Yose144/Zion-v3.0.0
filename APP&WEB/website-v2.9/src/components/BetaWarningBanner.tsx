'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useLang } from '@/contexts/LanguageContext';

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
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 backdrop-blur-sm">
        <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-amber-200/90 leading-relaxed">
            {cs ? (
              <>
                <strong className="font-semibold text-amber-300">Mainnet Beta</strong> — síť může obsahovat chyby. Těžba a transakce probíhají na vlastní nebezpečí. Neneseme odpovědnost za ztrátu prostředků. Oficiální veřejný launch: 31. prosince 2026.
              </>
            ) : (
              <>
                <strong className="font-semibold text-amber-300">Mainnet Beta</strong> — the network may contain bugs. Mining and transactions are at your own risk. We are not liable for any loss of funds. Official public launch: December 31, 2026.
              </>
            )}
          </p>
        </div>
        <button
          onClick={dismiss}
          className="flex-shrink-0 text-amber-400/60 hover:text-amber-300 transition mt-0.5"
          aria-label={cs ? 'Zavřit varování' : 'Dismiss warning'}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
