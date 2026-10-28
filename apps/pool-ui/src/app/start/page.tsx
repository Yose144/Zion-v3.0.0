'use client';

import { motion } from 'framer-motion';
import { Copy, Cpu, Gauge, MonitorSmartphone, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchVardiff } from '@/lib/api';
import { COINS } from '@/lib/mock';
import { useLang } from '@/lib/i18n';
import type { CoinInfo, VarDiffPolicy } from '@/lib/types';
import Wizard from './Wizard';

// Stratum lives on EDGE — pool.zionterranova.com is the EDGE2 web dashboard
// and does not forward stratum ports. All coins share one stratum endpoint:
// TCP :8444, TLS :8445, SOLO :8446. Coin selection happens via miner flags
// (--force-coin / --algorithm) or the v3 hello CoinPreference.
const HOST = 'stratum.zionterranova.com';
const PORT_TCP = 8444;
const PORT_TLS = 8445;

interface Cmd {
  miner: string;
  label: string;
}

function connectCmds(
  coin: CoinInfo,
  wallet: string,
  worker: string,
  tls: boolean,
): Cmd[] {
  const w = wallet || `<${t_wallet_placeholder(coin.id)}>`;
  const wrk = worker || 'rig-1';
  const addr = `${w}.${wrk}`;
  const port = tls ? PORT_TLS : PORT_TCP;
  const scheme = tls ? 'stratum+ssl' : 'stratum+tcp';

  switch (coin.id) {
    case 'zion':
      return [
        {
          miner: 'zion-miner (nativní)',
          label: `zion-miner --pool ${scheme}://${HOST}:${port} --wallet ${w} --worker ${wrk}`,
        },
        {
          miner: 'stratum v1',
          label: `-o ${scheme}://${HOST}:${port} -u ${addr} -p x`,
        },
      ];
    case 'qtc':
      return [
        {
          miner: 'zion-miner',
          label: `zion-miner --force-coin qtc --pool ${scheme}://${HOST}:${port} --wallet ${w} --worker ${wrk}`,
        },
        {
          miner: 'SRBMiner-MULTI',
          label: `SRBMiner-MULTI --algorithm quantus --pool ${HOST}:${port} --wallet ${addr} ${tls ? '--tls true' : ''}`.trim(),
        },
      ];
    case 'prl':
      return [
        {
          miner: 'zion-miner',
          label: `zion-miner --force-coin prl --pool ${scheme}://${HOST}:${port} --wallet ${w} --worker ${wrk}`,
        },
        {
          miner: 'SRBMiner-MULTI ≥3.7.6',
          label: `SRBMiner-MULTI --algorithm pearlhash --pool ${HOST}:${port} --wallet ${addr} --gpu ${tls ? '--tls true' : ''}`.trim(),
        },
      ];
    case 'multi':
      return [
        {
          miner: 'stratum v1',
          label: `-o ${scheme}://${HOST}:${port} -u ${addr} -p z=<coin>`,
        },
      ];
    default:
      // auxPoW upstream legs — routed by wallet address on the shared
      // stratum; any Stratum v1 client works.
      return [
        {
          miner: 'stratum v1',
          label: `-o ${scheme}://${HOST}:${port} -u ${addr} -p x`,
        },
      ];
  }
}

function t_wallet_placeholder(coin: string): string {
  switch (coin) {
    case 'zion':
      return 'zion1…';
    case 'qtc':
      return 'qz…';
    case 'prl':
      return 'prl1…';
    default:
      return 'wallet';
  }
}

function CoinSection({
  coin,
  wallet,
  worker,
  tls,
}: {
  coin: CoinInfo;
  wallet: string;
  worker: string;
  tls: boolean;
}) {
  const { t } = useLang();
  const [copied, setCopied] = useState<number | null>(null);
  const cmds = connectCmds(coin, wallet, worker, tls);

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
          <p>TCP <span className="stat-value text-rasta-gold">{PORT_TCP}</span> · TLS <span className="stat-value text-rasta-green">{PORT_TLS}</span> · SOLO <span className="stat-value text-rasta-gold">8446</span></p>
          <p>fee {coin.fee_bps / 100}% · min {coin.min_payout} {coin.payout_unit}</p>
        </div>
      </div>

      {coin.requirements && (
        <p className="mt-3 rounded-lg border border-rasta-gold/25 bg-rasta-gold/5 px-3 py-2 text-[0.72rem] text-rasta-gold">
          ⚠ {coin.requirements}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {cmds.map((c, i) => (
          <div key={i}>
            <p className="kicker mb-1.5">{c.miner}</p>
            <div className="code-block relative overflow-x-auto pr-12">
              <span className="whitespace-nowrap">{c.label}</span>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(c.label);
                  setCopied(i);
                  setTimeout(() => setCopied(null), 1200);
                }}
                className="absolute right-3 top-3 text-white/40 hover:text-white"
                aria-label="copy"
              >
                {copied === i ? <span className="text-rasta-green text-[0.7rem]">OK</span> : <Copy size={14} />}
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
  const [wallet, setWallet] = useState('');
  const [worker, setWorker] = useState('');
  const [tls, setTls] = useState(true);
  const [vd, setVd] = useState<VarDiffPolicy | null>(null);

  useEffect(() => {
    fetchVardiff().then(setVd);
  }, []);

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
              'Připojte se standardními dialekty — CryptoNote pro QTC, Pearl stratum pro PRL, v1 pro ostatní.',
              'Connect over standard dialects — CryptoNote for QTC, Pearl stratum for PRL, v1 elsewhere.',
            ),
            href: undefined,
          },
        ].map((c, i) => (
          <div key={i} className="pool-card">
            <c.icon size={20} className="text-rasta-gold" />
            <h3 className="mt-3 text-sm font-bold text-white">{c.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-white/50">{c.body}</p>
            {c.href && (
              <a href={c.href} className="mt-3 inline-block text-xs font-semibold text-rasta-gold">
                {t('Stáhnout →', 'Download →')}
              </a>
            )}
          </div>
        ))}
      </div>

      {/* ── Config wizard (A2.5) ─────────────────────────── */}
      <Wizard
        coins={COINS}
        wallet={wallet}
        worker={worker}
        tls={tls}
        setWallet={setWallet}
        setWorker={setWorker}
        setTls={setTls}
      />

      <div className="mt-8 flex flex-col gap-5">
        {COINS.map((c) => (
          <CoinSection key={c.id} coin={c} wallet={wallet} worker={worker} tls={tls} />
        ))}
      </div>

      {/* ── Difficulty policy (A2.4) ─────────────────────── */}
      <div className="pool-card mt-8">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <Gauge size={15} className="text-rasta-gold" />
          {t('Obtížnost (vardiff)', 'Difficulty (vardiff)')}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-white/50">
          {t(
            'Pool obtížnost ladí automaticky — statická obtížnost není potřeba ani podporovaná. Řídí se takto:',
            'The pool adjusts difficulty automatically — no static difficulty needed or supported. The policy:',
          )}
        </p>
        <div className="mt-3 grid gap-2 text-[0.72rem] sm:grid-cols-2">
          {[
            [
              t('startovní obtížnost', 'start difficulty'),
              vd ? vd.start.toLocaleString() : '—',
            ],
            [
              t('rozsah', 'range'),
              vd
                ? `${vd.min.toLocaleString()} – ${vd.max == null ? '∞' : vd.max.toLocaleString()}`
                : '—',
            ],
            [
              t('cílová kadence', 'target pace'),
              vd ? `1 share / ${vd.target_secs} s` : '—',
            ],
            [
              t('retarget', 'retarget'),
              vd
                ? t(`každých ${vd.retarget_shares} sharů`, `every ${vd.retarget_shares} shares`)
                : '—',
            ],
          ].map(([k, v], i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-white/8 bg-black/30 px-3 py-2"
            >
              <span className="text-white/45">{k}</span>
              <span className="font-mono font-bold text-white">{v}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[0.68rem] leading-relaxed text-white/40">
          {t(
            'Pomalé rigy dostanou nižší obtížnost, rychlé vyšší — hashrate zůstává přesný a stale shares klesají. `mining.suggest_difficulty` akceptujeme jako hint, vardiff ale drží kontrolu.',
            'Slow rigs get lower difficulty, fast rigs higher — hashrate stays accurate and stale shares drop. `mining.suggest_difficulty` is accepted as a hint, but vardiff stays in control.',
          )}
        </p>
      </div>

      <div className="pool-card mt-8">
        <h3 className="text-sm font-bold text-white">{t('Heslo = identita', 'Password = identity')}</h3>
        <div className="code-block mt-3">
<span className="c-dim"># anonymous mining</span>
-p <span className="c-gold">x</span>

<span className="c-dim"># ZIS account — unified stats + payout auto-resolve across all coins</span>
-p <span className="c-cyan">zis_&lt;api-token&gt;</span>
        </div>
        <p className="mt-3 text-[0.68rem] leading-relaxed text-white/40">
          {t(
            'S ZIS tokenem se mining automaticky páruje k tvému účtu — statistiky a výplaty všech coinů na jednom místě v /account.',
            'With a ZIS token your mining auto-links to your account — stats and payouts for all coins in one place on /account.',
          )}
        </p>
      </div>
    </div>
  );
}
