'use client';

import { useState } from 'react';
import { BookOpen, Copy, Terminal } from 'lucide-react';
import { useLang } from '@/lib/i18n';

const BASE = 'https://pool.zionterranova.com/public/v1';

type Row = {
  method: 'GET' | 'POST';
  path: string;
  params?: string;
  cs: string;
  en: string;
  auth?: 'zis';
};

const GROUPS: { cs: string; en: string; rows: Row[] }[] = [
  {
    cs: 'Pool & coiny',
    en: 'Pool & coins',
    rows: [
      {
        method: 'GET', path: '/coins',
        cs: 'Katalog coinů — fee, payout mode, min. výplata, stav legů.',
        en: 'Coin catalog — fee, payout mode, min payout, leg status.',
      },
      {
        method: 'GET', path: '/coins/{coin}/stats',
        params: 'coin = zion|qtu|prl|…',
        cs: 'Per-coin statistiky — hashrate, mineři, shares, payouts_24h, luck (100/500 blk).',
        en: 'Per-coin stats — hashrate, miners, shares, payouts_24h, luck (100/500 blocks).',
      },
      {
        method: 'GET', path: '/history',
        params: 'coin?, range?',
        cs: 'Historie pool hashrate — časová řada pro grafy.',
        en: 'Pool hashrate history — time series for charts.',
      },
    ],
  },
  {
    cs: 'Bloky & výplaty',
    en: 'Blocks & payouts',
    rows: [
      {
        method: 'GET', path: '/blocks',
        params: 'coin?, limit?',
        cs: 'Nalezené bloky — výška, hash, miner, luck_pct, status.',
        en: 'Found blocks — height, hash, miner, luck_pct, status.',
      },
      {
        method: 'GET', path: '/payouts',
        params: 'coin?, limit?',
        cs: 'Poslední výplaty — částka, adresa, tx_id, status (queued|sent|confirmed|superseded).',
        en: 'Recent payouts — amount, address, tx_id, status (queued|sent|confirmed|superseded).',
      },
    ],
  },
  {
    cs: 'Minery',
    en: 'Miners',
    rows: [
      {
        method: 'GET', path: '/miners',
        params: 'coin?, limit?',
        cs: 'Leaderboard — top minery dle dominantního streamu (adresy maskované).',
        en: 'Leaderboard — top miners by dominant stream (addresses masked).',
      },
      {
        method: 'GET', path: '/miner/{coin}/{address}',
        cs: 'Profil minera — workers, shares, unpaid, est_daily, payout ETA.',
        en: 'Miner profile — workers, shares, unpaid, est_daily, payout ETA.',
      },
      {
        method: 'GET', path: '/miner/{coin}/{address}/payouts',
        cs: 'Historie výplat minera včetně lifecycle statusu.',
        en: 'Miner payout history incl. lifecycle status.',
      },
      {
        method: 'GET', path: '/miner/{coin}/{address}/history',
        params: 'range?',
        cs: 'Časová řada hashrate minera (per-bucket série).',
        en: 'Miner hashrate history (bucketed series).',
      },
      {
        method: 'GET', path: '/miner/{coin}/{address}/identity',
        cs: 'ZIS binding minera — napojení na účet, pokud existuje.',
        en: 'Miner ZIS binding — linked account, if any.',
      },
    ],
  },
  {
    cs: 'Účet (ZIS auth)',
    en: 'Account (ZIS auth)',
    rows: [
      {
        method: 'POST', path: '/account', auth: 'zis',
        cs: 'Přehled účtu — linknuté adresy, nastavení.',
        en: 'Account overview — linked addresses, settings.',
      },
      {
        method: 'POST', path: '/account/threshold', auth: 'zis',
        cs: 'Nastavit vlastní payout threshold (nad pool minimum).',
        en: 'Set custom payout threshold (above pool minimum).',
      },
      {
        method: 'POST', path: '/account/alert', auth: 'zis',
        cs: 'Alert preference — worker-offline / payout notifikace (Telegram/e-mail/webhook).',
        en: 'Alert prefs — worker-offline / payout notifications (Telegram/email/webhook).',
      },
      {
        method: 'POST', path: '/account/alert/delete', auth: 'zis',
        cs: 'Zrušit alert subscription.',
        en: 'Remove an alert subscription.',
      },
    ],
  },
];

export default function ApiDocsPage() {
  const { t } = useLang();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div className="pt-8">
      <header className="page-hero">
        <p className="rasta-hero-kicker">
          <BookOpen size={12} /> {t('Vývojáři', 'Developers')}
        </p>
        <h1>{t('Veřejné API', 'Public API')}</h1>
        <p className="page-hero-sub">
          {t(
            'Read-only JSON API pro statistiky poolu — žádný klíč není potřeba (mírný rate-limit na IP). Zápisové /account endpointy vyžadují ZIS token.',
            'Read-only JSON API for pool statistics — no key required (mild per-IP rate limit). The write /account endpoints require a ZIS token.',
          )}
        </p>
      </header>

      <div className="pool-card mt-8">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <Terminal size={15} className="text-rasta-gold" /> {t('Základ', 'Basics')}
        </h3>
        <div className="code-block relative mt-3 pr-12">
          <span className="c-dim"># base URL</span>{'\n'}
          <span className="c-gold">{BASE}</span>{'\n'}
          <span className="c-dim"># example — ZION stats</span>{'\n'}
          <span className="c-cyan">curl -s {BASE}/coins/zion/stats | jq</span>
          <button
            onClick={() => copy(`curl -s ${BASE}/coins/zion/stats | jq`, 'curl')}
            className="absolute right-3 top-3 text-white/40 hover:text-white"
            aria-label="copy"
          >
            {copied === 'curl' ? <span className="text-rasta-green text-[0.7rem]">OK</span> : <Copy size={14} />}
          </button>
        </div>
        <p className="mt-3 text-[0.68rem] leading-relaxed text-white/40">
          {t(
            'Adresy minerů jsou ve výstupech maskované tam, kde to dává smysl (leaderboard). Stratum endpointy najdeš v /start.',
            'Miner addresses are masked where it makes sense (leaderboard). Stratum endpoints are documented on /start.',
          )}
        </p>
      </div>

      {GROUPS.map((g) => (
        <div key={g.en} className="pool-card mt-6 overflow-x-auto">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/70">
            {t(g.cs, g.en)}
          </h3>
          <table className="pool-table">
            <tbody>
              {g.rows.map((r) => (
                <tr key={r.path}>
                  <td className="whitespace-nowrap">
                    <span className={`mr-2 inline-block w-11 rounded px-1.5 py-0.5 text-center text-[0.65rem] font-bold ${
                      r.method === 'GET' ? 'bg-rasta-green/15 text-rasta-green' : 'bg-rasta-gold/15 text-rasta-gold'
                    }`}>
                      {r.method}
                    </span>
                    <code className="text-[0.78rem] text-white">{r.path}</code>
                    {r.params && (
                      <span className="ml-2 text-[0.65rem] text-white/35">{r.params}</span>
                    )}
                    {r.auth === 'zis' && (
                      <span className="ml-2 rounded border border-rasta-gold/30 px-1 py-0.5 text-[0.6rem] font-bold text-rasta-gold">
                        ZIS
                      </span>
                    )}
                  </td>
                  <td className="text-[0.72rem] text-white/55">{t(r.cs, r.en)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
