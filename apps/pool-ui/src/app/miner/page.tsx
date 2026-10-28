'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import MinerClient from './MinerClient';
import WorkerClient from './WorkerClient';
import MinerSearch from '@/components/MinerSearch';
import { useLang } from '@/lib/i18n';

// Static export can't pre-render arbitrary /miner/<coin>/<wallet>[/<worker>]
// paths, so this shell parses the URL client-side.  nginx maps every
// /miner/* URL to this page (try_files $uri $uri/ /miner/index.html).
function MinerShell() {
  const pathname = usePathname();
  const search = useSearchParams();
  const { t } = useLang();
  const [parsed, setParsed] = useState<{
    coin: string;
    wallet: string;
    worker?: string;
  } | null>(null);

  useEffect(() => {
    const seg = pathname.split('/').filter(Boolean); // ['miner', coin, wallet, worker?]
    const coin = seg[1] ?? search.get('coin') ?? '';
    const wallet = seg[2] ?? search.get('wallet') ?? '';
    const worker = seg[3] ? decodeURIComponent(seg[3]) : undefined;
    setParsed(coin && wallet ? { coin, wallet, worker } : null);
  }, [pathname, search]);

  if (!parsed) {
    return (
      <div className="pt-10">
        <div className="pool-card mx-auto max-w-xl text-center">
          <h1 className="text-lg font-bold text-white">
            {t('Miner dashboard', 'Miner dashboard')}
          </h1>
          <p className="mt-2 text-xs text-white/50">
            {t(
              'Zadej adresu peněženky — uvidíš hashrate, workery, bilanci a výplaty.',
              'Enter a wallet address to see hashrate, workers, balance and payouts.',
            )}
          </p>
        </div>
        <div className="mx-auto mt-6 max-w-xl">
          <MinerSearch />
        </div>
      </div>
    );
  }

  if (parsed.worker) {
    return (
      <WorkerClient coin={parsed.coin} wallet={parsed.wallet} worker={parsed.worker} />
    );
  }
  return <MinerClient coin={parsed.coin} wallet={parsed.wallet} />;
}

export default function MinerPage() {
  return (
    <Suspense fallback={<div className="pt-20 text-center text-white/40">…</div>}>
      <MinerShell />
    </Suspense>
  );
}
