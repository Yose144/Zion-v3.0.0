'use client';

import { useEffect, useState } from 'react';
import { Crown, RefreshCw } from 'lucide-react';
import { fetchTopMiners } from '@/lib/api';
import { fmtAgo, fmtHashrate, fmtInt } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { TopMinerRow } from '@/lib/types';

const MEDAL = ['text-rasta-gold', 'text-white/70', 'text-[#cd7f32]'];

/**
 * Top-miners leaderboard — the masked `/public/v1/miners` view every pro pool
 * ships. Wallets arrive pre-masked (`zion1abc…xyz.rig`); we render rig labels
 * and hashrate windows. Auto-refreshes with the pool cadence.
 *
 * `coin` (pool key, e.g. 'qtc') filters to miners contributing to that coin
 * and ranks by that stream's live rate — used on /coin/[id].
 */
export default function TopMiners({
  limit = 10,
  coin,
}: {
  limit?: number;
  coin?: string;
}) {
  const { t, lang } = useLang();
  const [rows, setRows] = useState<TopMinerRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const pull = () => fetchTopMiners(limit, coin).then((r) => {
      setRows(r);
      setLoaded(true);
    });
    pull();
    const iv = setInterval(pull, 60_000);
    return () => clearInterval(iv);
  }, [limit, coin]);

  if (!loaded || rows.length === 0) return null;

  const coinList = (m: TopMinerRow) =>
    Object.keys(m.streams ?? {})
      .filter((k) => (m.streams?.[k]?.valid_shares ?? 0) > 0)
      .map((k) => k.toUpperCase())
      .join(' · ');

  const liveHps = (m: TopMinerRow) =>
    coin ? (m.streams?.[coin]?.hps_live ?? 0) : (m.display_hps ?? m.hashrate_hps ?? 0);
  const h1 = (m: TopMinerRow) =>
    coin ? (m.streams?.[coin]?.hps_1h ?? 0) : (m.streams?.[m.display_coin ?? '']?.hps_1h ?? m.hashrate_1h_hps ?? 0);
  const shares = (m: TopMinerRow) =>
    coin ? (m.streams?.[coin]?.valid_shares ?? 0) : (m.valid_shares ?? 0);

  return (
    <div className="pool-card card-glow mt-8 overflow-x-auto">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/70">
          <Crown size={15} className="text-rasta-gold" />
          {coin ? t('Top mineři', 'Top miners') : t('Top mineři', 'Top miners')}
        </h2>
        <span className="flex items-center gap-1.5 text-[0.65rem] text-white/30">
          <RefreshCw size={10} />
          {t('živě · wallet maskována', 'live · wallet masked')}
        </span>
      </div>
      <table className="pool-table">
        <thead>
          <tr>
            <th className="w-8">#</th>
            <th>{t('miner', 'miner')}</th>
            {!coin && <th>{t('coiny', 'coins')}</th>}
            <th className="text-right">{t('hashrate', 'hashrate')}</th>
            <th className="text-right">1h</th>
            {!coin && <th className="text-right">24h</th>}
            <th className="text-right">{t('shares', 'shares')}</th>
            {!coin && <th className="text-right">{t('bloky', 'blocks')}</th>}
            <th className="text-right">{t('naposled', 'last seen')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m, i) => (
            <tr key={m.worker + i}>
              <td className={`font-bold ${MEDAL[i] ?? 'text-white/30'}`}>{i + 1}</td>
              <td className="font-mono text-[0.78rem] text-white/85">{m.worker}</td>
              {!coin && <td className="text-[0.7rem] text-white/45">{coinList(m) || '—'}</td>}
              <td className="text-right font-bold text-rasta-gold">
                {fmtHashrate(liveHps(m))}
                {!coin && m.display_coin && m.display_coin !== 'zion' && (
                  <span className="ml-1 text-[0.6rem] font-normal text-white/40">{m.display_coin.toUpperCase()}</span>
                )}
              </td>
              <td className="text-right text-white/60">{fmtHashrate(h1(m))}</td>
              {!coin && <td className="text-right text-white/45">{fmtHashrate(m.hashrate_24h_hps ?? 0)}</td>}
              <td className="text-right text-white/60">{fmtInt(shares(m))}</td>
              {!coin && <td className="text-right text-white/60">{m.blocks_found ? fmtInt(m.blocks_found) : '—'}</td>}
              <td className="text-right text-[0.7rem] text-white/40">
                {m.last_seen_s ? fmtAgo(m.last_seen_s, lang) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
