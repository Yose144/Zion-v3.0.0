'use client';

import { motion } from 'framer-motion';
import { Copy, Cpu, MonitorSmartphone, Terminal } from 'lucide-react';
import { useState } from 'react';
import { COINS } from '@/lib/mock';
import { useLang } from '@/lib/i18n';
import type { CoinInfo } from '@/lib/types';

function connectCmd(coin: CoinInfo): { miner: string; label: string }[] {
  const host = 'stratum.zionterranova.com';
  switch (coin.id) {
    case 'zion':
      return [
        {
          miner: 'zion-miner',
          label: 'zion-miner --pool ' + `${host}:${coin.port}` + ' --wallet <zion1…> --worker muj-rig',
        },
        {
          miner: 'stratum v1',
          label: `-o stratum+tcp://${host}:${coin.port} -u <zion1…>.muj-rig -p x`,
        },
      ];
    case 'qtc':
      return [
        {
          miner: 'SRBMiner-MULTI',
          label: `SRBMiner-MULTI --algorithm quantus --pool ${host}:${coin.port} --wallet <qz…>.muj-rig`,
        },
        {
          miner: 'zion-miner',
          label: `zion-miner --force-coin qtc --pool ${host}:${coin.port} --wallet <qz…>`,
        },
      ];
    case 'prl':
      return [
        {
          miner: 'SRBMiner-MULTI ≥3.7.6',
          label: `SRBMiner-MULTI --algorithm pearlhash --pool ${host}:${coin.port} --wallet <prl1…>.muj-rig --gpu`,
        },
      ];
    case 'multi':
      return [
        {
          miner: 'stratum v1',
          label: `-o stratum+tcp://${host}:${coin.port} -u <wallet>.muj-rig -p z=<coin>`,
        },
      ];
  }
}

function CoinSection({ coin }: { coin: CoinInfo }) {
  const { t } = useLang();
  const [copied, setCopied] = useState<number | null>(null);
  const cmds = connectCmd(coin);

  return (
    <motion.section
      id={coin.id}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="pool-card scroll-mt-24"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white">
            {coin.ticker} <span className="text-sm font-medium text-white/40">{coin.name}</span>
          </h2>
          <p className="mt-1 text-xs text-white/50">{coin.algorithm} · {coin.dialect}</p>
        </div>
        <div className="text-right text-[0.72rem] leading-relaxed text-white/50">
          <p>port <span className="stat-value text-gold">{coin.port}</span> · TLS <span className="stat-value text-cyan">{coin.tls_port}</span></p>
          <p>fee {coin.fee_bps / 100}% · min {coin.min_payout} {coin.payout_unit}</p>
        </div>
      </div>

      {coin.requirements && (
        <p className="mt-3 rounded-lg border border-zion-gold/25 bg-zion-gold/5 px-3 py-2 text-[0.72rem] text-zion-gold">
          ⚠ {coin.requirements}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {cmds.map((c, i) => (
          <div key={i}>
            <p className="kicker mb-1.5">{c.miner}</p>
            <div className="code-block relative pr-12">
              {c.label}
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(c.label);
                  setCopied(i);
                  setTimeout(() => setCopied(null), 1200);
                }}
                className="absolute right-3 top-3 text-white/40 hover:text-white"
                aria-label="copy"
              >
                {copied === i ? <span className="text-green text-[0.7rem]">OK</span> : <Copy size={14} />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

export default function StartPage() {
  const { t } = useLang();
  return (
    <div className="pt-10">
      <p className="kicker">{t('Návod', 'Guide')}</p>
      <h1 className="mt-2 text-3xl font-black text-white">
        {t('Jak začít těžit', 'How to start mining')}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
        {t(
          'Tři cesty: Trinity Miner (GUI, jedno kliknutí — doporučeno), zion-miner CLI, nebo váš stávající miner (SRBMiner, teamredminer). Adresa ve formátu <wallet>.<worker>, heslo "x" pro anonymous nebo "zis_<token>" pro ZIS účet.',
          'Three ways: Trinity Miner (GUI, one click — recommended), zion-miner CLI, or your existing miner (SRBMiner, teamredminer). Username is <wallet>.<worker>, password "x" for anonymous or "zis_<token>" for a ZIS account.',
        )}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          {
            icon: MonitorSmartphone,
            title: t('Trinity Miner', 'Trinity Miner'),
            body: t(
              'Desktop aplikace — stáhnout, spustit, těží. Pool je přednastavený.',
              'Desktop app — download, run, it mines. The pool is pre-configured.',
            ),
            href: 'https://app.zionterranova.com/download',
          },
          {
            icon: Terminal,
            title: 'zion-miner CLI',
            body: t(
              'Multi-algo CLI miner: ZION, QTC, PRL + dual-mining. Konfig níže.',
              'Multi-algo CLI miner: ZION, QTC, PRL + dual-mining. Config below.',
            ),
            href: undefined,
          },
          {
            icon: Cpu,
            title: 'SRBMiner / TRM',
            body: t(
              'Připojte se standardními dialaekty — CryptoNote pro QTC, Pearl stratum pro PRL, v1 pro ostatní.',
              'Connect over standard dialects — CryptoNote for QTC, Pearl stratum for PRL, v1 elsewhere.',
            ),
            href: undefined,
          },
        ].map((c, i) => (
          <div key={i} className="pool-card">
            <c.icon size={20} className="text-zion-gold" />
            <h3 className="mt-3 text-sm font-bold text-white">{c.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-white/50">{c.body}</p>
            {c.href && (
              <a href={c.href} className="mt-3 inline-block text-xs font-semibold text-gold">
                {t('Stáhnout →', 'Download →')}
              </a>
            )}
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-col gap-5">
        {COINS.map((c) => (
          <CoinSection key={c.id} coin={c} />
        ))}
      </div>

      <div className="pool-card mt-8">
        <h3 className="text-sm font-bold text-white">{t('Heslo = identita', 'Password = identity')}</h3>
        <div className="code-block mt-3">
<span className="c-dim"># anonymous mining</span>
-p <span className="c-gold">x</span>

<span className="c-dim"># ZIS account — unified stats + payout auto-resolve across all coins</span>
-p <span className="c-cyan">zis_&lt;api-token&gt;</span>
        </div>
      </div>
    </div>
  );
}
