'use client';

import { motion } from 'framer-motion';
import { Check, Copy, Download, FileText, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import type { CoinInfo } from '@/lib/types';

// Stratum lives on EDGE (stratum.zionterranova.com) — pool.zionterranova.com
// is the EDGE2 web dashboard and does NOT forward stratum ports.
const STRATUM_HOST = 'stratum.zionterranova.com';
const PORT_TCP = 8444;
const PORT_TLS = 8445;
const PORT_SOLO = 8446;

type Os = 'linux' | 'windows';
type Mode = 'pool' | 'solo';

interface MinerOpt {
  id: string;
  label: string;
  note?: string;
}

const MINERS: Record<string, MinerOpt[]> = {
  zion: [
    { id: 'zion-miner', label: 'zion-miner', note: 'native · GPU · dual-mining' },
    { id: 'stratum', label: 'Stratum v1', note: 'generic (-o/-u/-p)' },
  ],
  qtc: [
    { id: 'zion-miner', label: 'zion-miner', note: '--force-coin qtc' },
    { id: 'srb', label: 'SRBMiner-MULTI', note: '--algorithm quantus' },
  ],
  prl: [
    { id: 'zion-miner', label: 'zion-miner', note: '--force-coin prl' },
    { id: 'srb', label: 'SRBMiner-MULTI ≥3.7.6', note: '--algorithm pearlhash · GPU only' },
  ],
  multi: [{ id: 'stratum', label: 'Stratum v1', note: 'yiimp-style · -p z=<coin>' }],
};

function buildCmd(
  coin: CoinInfo,
  minerId: string,
  os: Os,
  wallet: string,
  worker: string,
  tls: boolean,
  mode: Mode,
): string {
  const w = wallet || '<wallet>';
  const wrk = worker || 'rig-1';
  const addr = `${w}.${wrk}`;
  const port = mode === 'solo' ? PORT_SOLO : tls ? PORT_TLS : PORT_TCP;
  const scheme = tls ? 'stratum+ssl' : 'stratum+tcp';
  const zm = os === 'windows' ? 'zion-miner.exe' : './zion-miner';
  const srb = os === 'windows' ? 'SRBMiner-MULTI.exe' : './SRBMiner-MULTI';
  const srbTls = tls && mode === 'pool' ? ' --tls true' : '';

  switch (`${coin.id}:${minerId}`) {
    case 'zion:zion-miner':
      return `${zm} --pool ${scheme}://${STRATUM_HOST}:${port} --wallet ${w} --worker ${wrk}`;
    case 'zion:stratum':
    case 'multi:stratum':
      return `-o ${scheme}://${STRATUM_HOST}:${port} -u ${addr} -p ${coin.id === 'multi' ? 'z=<coin>' : 'x'}`;
    case 'qtc:zion-miner':
      return `${zm} --force-coin qtc --pool ${scheme}://${STRATUM_HOST}:${port} --wallet ${w} --worker ${wrk}`;
    case 'qtc:srb':
      return `${srb} --algorithm quantus --pool ${STRATUM_HOST}:${port} --wallet ${addr}${srbTls}`.trim();
    case 'prl:zion-miner':
      return `${zm} --force-coin prl --pool ${scheme}://${STRATUM_HOST}:${port} --wallet ${w} --worker ${wrk}`;
    case 'prl:srb':
      return `${srb} --algorithm pearlhash --pool ${STRATUM_HOST}:${port} --wallet ${addr} --gpu${srbTls}`.trim();
    default:
      return '';
  }
}

function scriptFile(coin: CoinInfo, minerId: string, os: Os, cmd: string): { name: string; body: string } {
  const base = `start-${coin.id}-${minerId}`;
  if (os === 'windows') {
    return {
      name: `${base}.bat`,
      body: `@echo off\r\nrem ZION TerraNova pool — ${coin.ticker} via ${minerId}\r\nrem Stratum: ${STRATUM_HOST} (TCP :${PORT_TCP} · TLS :${PORT_TLS} · SOLO :${PORT_SOLO})\r\n${cmd}\r\npause\r\n`,
    };
  }
  return {
    name: `${base}.sh`,
    body: `#!/usr/bin/env bash\n# ZION TerraNova pool — ${coin.ticker} via ${minerId}\n# Stratum: ${STRATUM_HOST} (TCP :${PORT_TCP} · TLS :${PORT_TLS} · SOLO :${PORT_SOLO})\nset -e\nexec ${cmd}\n`,
  };
}

function download(name: string, body: string) {
  const blob = new Blob([body], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function StepChip({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.7rem] font-bold transition-colors ${
      active
        ? 'border-rasta-gold/60 bg-rasta-gold/10 text-rasta-gold'
        : done
          ? 'border-rasta-green/40 bg-rasta-green/5 text-rasta-green'
          : 'border-white/10 text-white/35'
    }`}>
      <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[0.6rem] ${done ? 'bg-rasta-green text-black' : active ? 'bg-rasta-gold text-black' : 'bg-white/10'}`}>
        {done ? <Check size={10} /> : n}
      </span>
      {label}
    </div>
  );
}

export default function Wizard({
  coins,
  wallet,
  worker,
  tls,
  setWallet,
  setWorker,
  setTls,
}: {
  coins: CoinInfo[];
  wallet: string;
  worker: string;
  tls: boolean;
  setWallet: (v: string) => void;
  setWorker: (v: string) => void;
  setTls: (v: boolean) => void;
}) {
  const { t } = useLang();
  const [coinId, setCoinId] = useState<string>('zion');
  const [minerId, setMinerId] = useState<string>('zion-miner');
  const [os, setOs] = useState<Os>('linux');
  const [mode, setMode] = useState<Mode>('pool');
  const [copied, setCopied] = useState(false);

  // Only native-leg coins get wizard configs — auxPoW legs are routed by
  // the wallet address on the shared stratum, no --force-coin flag exists.
  const wizardCoins = coins.filter((c) => c.legs.some((l) => l.kind === 'native'));
  const coin = wizardCoins.find((c) => c.id === coinId) ?? wizardCoins[0];
  const miners = MINERS[coin.id] ?? MINERS.zion;
  const miner = miners.find((m) => m.id === minerId) ?? miners[0];
  const cmd = buildCmd(coin, miner.id, os, wallet, worker, tls, mode);
  const file = scriptFile(coin, miner.id, os, cmd);

  return (
    <div className="pool-card mt-10 border-rasta-gold/20">
      <h3 className="flex items-center gap-2 text-sm font-bold text-white">
        <Wand2 size={15} className="text-rasta-gold" />
        {t('Průvodce konfigurací', 'Config wizard')}
      </h3>
      <p className="mt-1 text-xs text-white/45">
        {t(
          'Coin → miner → OS. Vygeneruje startovací příkaz i skript ke stažení.',
          'Coin → miner → OS. Generates the launch command and a downloadable script.',
        )}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <StepChip n={1} label={t('coin', 'coin')} active done={!!coinId} />
        <StepChip n={2} label={t('miner', 'miner')} active={!!coinId} done={!!minerId} />
        <StepChip n={3} label="OS" active={!!minerId} done={!!os} />
      </div>

      {/* step 1 — coin */}
      <div className="mt-5">
        <p className="kicker mb-2">1 · {t('coin', 'coin')}</p>
        <div className="grid gap-2 sm:grid-cols-4">
          {wizardCoins.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCoinId(c.id);
                const first = (MINERS[c.id] ?? MINERS.zion)[0];
                if (!miners.some((m) => m.id === minerId)) setMinerId(first.id);
              }}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                coin.id === c.id
                  ? 'border-rasta-gold/60 bg-rasta-gold/10'
                  : 'border-white/10 bg-black/30 hover:border-white/25'
              }`}
            >
              <span className={`block text-sm font-black ${coin.id === c.id ? 'text-rasta-gold' : 'text-white/80'}`}>
                {c.ticker}
              </span>
              <span className="mt-0.5 block text-[0.62rem] text-white/40">{c.algorithm}</span>
            </button>
          ))}
        </div>
      </div>

      {/* step 2 — miner */}
      <div className="mt-5">
        <p className="kicker mb-2">2 · {t('miner', 'miner')}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {miners.map((m) => (
            <button
              key={m.id}
              onClick={() => setMinerId(m.id)}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                miner.id === m.id
                  ? 'border-rasta-gold/60 bg-rasta-gold/10'
                  : 'border-white/10 bg-black/30 hover:border-white/25'
              }`}
            >
              <span className={`block text-xs font-bold ${miner.id === m.id ? 'text-rasta-gold' : 'text-white/80'}`}>
                {m.label}
              </span>
              {m.note && <span className="mt-0.5 block text-[0.62rem] text-white/40">{m.note}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* step 3 — os + mode + connection */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="kicker mb-2">3 · OS</p>
          <div className="flex overflow-hidden rounded-lg border border-white/15 text-[0.72rem] font-bold">
            {(['linux', 'windows'] as Os[]).map((o) => (
              <button
                key={o}
                onClick={() => setOs(o)}
                className={`flex-1 px-3 py-2 transition-colors ${os === o ? 'bg-rasta-green text-black' : 'text-white/50 hover:text-white'}`}
              >
                {o === 'linux' ? 'Linux' : 'Windows'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="kicker mb-2">{t('režim', 'mode')}</p>
          <div className="flex overflow-hidden rounded-lg border border-white/15 text-[0.72rem] font-bold">
            <button
              onClick={() => setMode('pool')}
              className={`flex-1 px-3 py-2 transition-colors ${mode === 'pool' ? 'bg-rasta-green text-black' : 'text-white/50 hover:text-white'}`}
            >
              {t('Pool (PPLNS)', 'Pool (PPLNS)')}
            </button>
            <button
              onClick={() => setMode('solo')}
              className={`flex-1 px-3 py-2 transition-colors ${mode === 'solo' ? 'bg-rasta-gold text-black' : 'text-white/50 hover:text-white'}`}
            >
              SOLO :{PORT_SOLO}
            </button>
          </div>
        </div>
        {mode === 'pool' && (
          <div>
            <p className="kicker mb-2">{t('spojení', 'connection')}</p>
            <div className="flex overflow-hidden rounded-lg border border-white/15 text-[0.72rem] font-bold">
              <button
                onClick={() => setTls(true)}
                className={`flex-1 px-3 py-2 transition-colors ${tls ? 'bg-rasta-green text-black' : 'text-white/50 hover:text-white'}`}
              >
                TLS :{PORT_TLS}
              </button>
              <button
                onClick={() => setTls(false)}
                className={`flex-1 px-3 py-2 transition-colors ${!tls ? 'bg-rasta-gold text-black' : 'text-white/50 hover:text-white'}`}
              >
                TCP :{PORT_TCP}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* wallet/worker inputs */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="kicker mb-1 block">{t('payout adresa', 'payout address')}</span>
          <input
            value={wallet}
            onChange={(e) => setWallet(e.target.value.trim())}
            placeholder="zion1… / qz… / prl1…"
            className="w-full rounded-lg border border-white/12 bg-black/40 px-3 py-2 font-mono text-xs text-white placeholder:text-white/25 focus:border-rasta-gold/60 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="kicker mb-1 block">{t('jméno rigu', 'worker name')}</span>
          <input
            value={worker}
            onChange={(e) => setWorker(e.target.value.trim())}
            placeholder="rig-1"
            className="w-full rounded-lg border border-white/12 bg-black/40 px-3 py-2 font-mono text-xs text-white placeholder:text-white/25 focus:border-rasta-gold/60 focus:outline-none"
          />
        </label>
      </div>

      {/* output */}
      <motion.div
        key={`${coin.id}-${miner.id}-${os}-${mode}-${tls}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-5"
      >
        <p className="kicker mb-2">{t('výstup', 'output')}</p>
        <div className="code-block relative overflow-x-auto pr-12">
          <span className="whitespace-nowrap">{cmd}</span>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(cmd);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            className="absolute right-3 top-3 text-white/40 hover:text-white"
            aria-label="copy"
          >
            {copied ? <span className="text-rasta-green text-[0.7rem]">OK</span> : <Copy size={14} />}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={() => download(file.name, file.body)}
            className="flex items-center gap-2 rounded-lg border border-rasta-green/40 bg-rasta-green/10 px-3 py-2 text-[0.72rem] font-bold text-rasta-green hover:bg-rasta-green/20"
          >
            <Download size={13} />
            {file.name}
          </button>
          <span className="flex items-center gap-1.5 text-[0.65rem] text-white/35">
            <FileText size={12} />
            {t(
              os === 'windows' ? 'dvojklik spustí · edituj wallet předtím' : 'chmod +x && spusť',
              os === 'windows' ? 'double-click to run · edit wallet first' : 'chmod +x and run',
            )}
          </span>
        </div>
        {mode === 'solo' && (
          <p className="mt-3 rounded-lg border border-rasta-gold/25 bg-rasta-gold/5 px-3 py-2 text-[0.68rem] text-rasta-gold">
            {t(
              'SOLO port :8446 — nalezený blok jde celý tobě (mínus fee), žádné PPLNS sdílení. Očekávaná výhra závisí na tvém hashrate vs síť.',
              'SOLO port :8446 — a found block is all yours (minus fee), no PPLNS sharing. Expected wins depend on your hashrate vs the network.',
            )}
          </p>
        )}
      </motion.div>
    </div>
  );
}
