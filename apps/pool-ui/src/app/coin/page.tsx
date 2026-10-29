'use client';

import { Coins } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import CoinClient from './CoinClient';
import { useLang } from '@/lib/i18n';
import type { CoinId } from '@/lib/types';

const VALID: CoinId[] = [
  'zion', 'qtc', 'prl', 'vrsc', 'zano', 'rtm',
  'evr', 'mewc', 'zec', 'zcl', 'phx', 'krx',
];

// Static export can't pre-render arbitrary /coin/<id> paths, so this
// shell parses the URL client-side — nginx maps every /coin/* URL to
// this page (try_files $uri $uri/ /coin/index.html), same as /miner/*.
function CoinShell() {
  const pathname = usePathname();
  const search = useSearchParams();
  const { t } = useLang();
  const [coin, setCoin] = useState<CoinId | null>(null);
  const [bad, setBad] = useState(false);

  useEffect(() => {
    const seg = pathname.split('/').filter(Boolean); // ['coin', id]
    const raw = (seg[1] ?? search.get('coin') ?? '').toLowerCase();
    if (VALID.includes(raw as CoinId)) {
      setCoin(raw as CoinId);
      setBad(false);
    } else {
      setCoin(null);
      setBad(true);
    }
  }, [pathname, search]);

  if (bad) {
    return (
      <div className="pt-8">
        <header className="page-hero">
          <p className="rasta-hero-kicker">
            <Coins size={12} /> {t('Coin detail', 'Coin detail')}
          </p>
          <h1>{t('Neznámý coin', 'Unknown coin')}</h1>
          <p className="page-hero-sub">
            {t(
              'Tento coin pool nevypisuje — zpět na přehled podporovaných coinů.',
              'This coin is not listed by the pool — back to the supported coins overview.',
            )}
          </p>
        </header>
      </div>
    );
  }

  if (!coin) {
    return <div className="pt-20 text-center text-white/40">…</div>;
  }
  return <CoinClient coinId={coin} />;
}

export default function CoinPage() {
  return (
    <Suspense fallback={<div className="pt-20 text-center text-white/40">…</div>}>
      <CoinShell />
    </Suspense>
  );
}
