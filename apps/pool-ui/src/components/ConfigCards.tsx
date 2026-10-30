'use client';

import { Check, Copy, Pickaxe, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { connectCmds, STRATUM_HOST, STRATUM_PORT_SOLO, STRATUM_PORT_TCP, STRATUM_PORT_TLS, walletPlaceholder } from '@/lib/connect';
import { useLang } from '@/lib/i18n';
import type { CoinInfo } from '@/lib/types';

/** Per-coin mining configuration cards — copy-ready commands for every
 *  supported miner, with wallet/worker inputs and TCP/TLS/SOLO port
 *  switching. Shared command source: lib/connect.ts (same as /start). */
export default function ConfigCards({ coin }: { coin: CoinInfo }) {
  const { t } = useLang();
  const [wallet, setWallet] = useState('');
  const [worker, setWorker] = useState('');
  const [mode, setMode] = useState<'tcp' | 'tls' | 'solo'>('tcp');
  const [copied, setCopied] = useState<string | null>(null);

  const cmds = connectCmds(coin, wallet, worker, mode === 'tls', mode === 'solo');

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied((c) => (c === text ? null : c)), 1800);
    } catch {
      /* clipboard requires user gesture / https — silent degrade */
    }
  };

  const modes = [
    { id: 'tcp' as const, label: `TCP :${STRATUM_PORT_TCP}` },
    { id: 'tls' as const, label: `TLS :${STRATUM_PORT_TLS}` },
    { id: 'solo' as const, label: `SOLO :${STRATUM_PORT_SOLO}` },
  ];

  return (
    <div className="pool-card card-glow p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/70">
          <Pickaxe size={14} className="text-rasta-gold" />
          {t('Jak začít těžit', 'Start mining')} {coin.ticker}
        </h3>
        <div className="flex gap-1.5">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`pill transition ${mode === m.id ? 'pill-native' : ''}`}
            >
              {m.id === 'tls' && <ShieldCheck size={11} className="mr-1 inline" />}
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-2 text-[0.72rem] leading-relaxed text-white/45">
        {t(
          'Vyplň adresu a jméno stroje — příkazy se přegenerují copy-ready. Všechny coiny sdílí jeden stratum endpoint; výběr coinu řeší miner flag nebo adresa.',
          'Fill in your address and rig name — the commands regenerate copy-ready. All coins share one stratum endpoint; coin selection is handled by the miner flag or address.',
        )}
      </p>

      {/* Wallet / worker inputs */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="kicker mb-1 block">{t('adresa peněženky', 'wallet address')}</span>
          <input
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder={walletPlaceholder(coin.id)}
            spellCheck={false}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[0.75rem] text-white placeholder:text-white/25 focus:border-rasta-gold/50 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="kicker mb-1 block">{t('jméno stroje (worker)', 'worker name')}</span>
          <input
            value={worker}
            onChange={(e) => setWorker(e.target.value)}
            placeholder="rig-1"
            spellCheck={false}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[0.75rem] text-white placeholder:text-white/25 focus:border-rasta-gold/50 focus:outline-none"
          />
        </label>
      </div>

      {/* Per-miner command cards — single column inside the half-width
          /coin grid until very wide viewports (commands are long). */}
      <div className="mt-4 grid gap-3 2xl:grid-cols-2">
        {cmds.map((c) => (
          <div key={c.miner} className="rounded-xl border border-white/8 bg-black/30 p-3.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[0.7rem] font-bold uppercase tracking-wider text-rasta-gold/90">
                {c.miner}
              </span>
              <button
                onClick={() => copy(c.label)}
                className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[0.62rem] text-white/60 transition hover:border-rasta-gold/40 hover:text-rasta-gold"
                title={t('zkopírovat příkaz', 'copy command')}
              >
                {copied === c.label ? <Check size={11} className="text-rasta-green" /> : <Copy size={11} />}
                {copied === c.label ? t('zkopírováno', 'copied') : t('kopírovat', 'copy')}
              </button>
            </div>
            <code className="block break-all rounded-md bg-black/50 px-2.5 py-2 font-mono text-[0.68rem] leading-relaxed text-rasta-green/90">
              {c.label}
            </code>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[0.65rem] text-white/35">
        {t('endpoint', 'endpoint')} <code className="text-white/50">{STRATUM_HOST}</code>
        {' · '}
        {mode === 'solo'
          ? t('SOLO — celá odměna jde tobě, žádné PPLNS sdílení', 'SOLO — full block reward goes to you, no PPLNS sharing')
          : mode === 'tls'
            ? t('TLS — šifrovaný stratum (doporučeno pro veřejné sítě)', 'TLS — encrypted stratum (recommended on public networks)')
            : t('TCP — standardní stratum bez šifrování', 'TCP — standard unencrypted stratum')}
        {' · '}
        <a href={`/start/#${coin.id}`} className="text-rasta-gold/80 underline-offset-2 hover:underline">
          {t('podrobný návod →', 'full guide →')}
        </a>
      </p>
    </div>
  );
}
