'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { DEMO_WALLETS } from '@/lib/mock';
import type { CoinId } from '@/lib/types';

export default function MinerSearch() {
  const router = useRouter();
  const { t } = useLang();
  const [coin, setCoin] = useState<CoinId>('zion');
  const [wallet, setWallet] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = wallet.trim();
    if (w) router.push(`/miner/${coin}/${encodeURIComponent(w)}/`);
  };

  return (
    <form onSubmit={submit} className="pool-card flex flex-col gap-3 sm:flex-row">
      <select
        value={coin}
        onChange={(e) => setCoin(e.target.value as CoinId)}
        className="input-wallet sm:w-36"
      >
        <option value="zion">ZION</option>
        <option value="qtc">QTC</option>
        <option value="prl">PRL</option>
      </select>
      <input
        value={wallet}
        onChange={(e) => setWallet(e.target.value)}
        placeholder={t('Payout adresa minera…', 'Miner payout address…')}
        className="input-wallet flex-1"
      />
      <button type="submit" className="btn-gold justify-center">
        <Search size={16} /> {t('Hledat', 'Look up')}
      </button>
      <button
        type="button"
        className="btn-ghost justify-center text-xs"
        onClick={() => setWallet(DEMO_WALLETS[coin])}
      >
        demo
      </button>
    </form>
  );
}
