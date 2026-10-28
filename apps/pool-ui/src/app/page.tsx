'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Blocks, Boxes, Clock, Pickaxe, ShieldCheck, Users } from 'lucide-react';
import CoinCard from '@/components/CoinCard';
import MinerSearch from '@/components/MinerSearch';
import { fetchBlocks, fetchOverview } from '@/lib/api';
import { fmtDuration, fmtHashrate, fmtInt } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { PoolOverview } from '@/lib/types';

export default function HomePage() {
  const { t } = useLang();
  const [ov, setOv] = useState<PoolOverview | null>(null);
  const [blockCount, setBlockCount] = useState<number | null>(null);

  useEffect(() => {
    fetchOverview().then(setOv);
    fetchBlocks().then((b) => setBlockCount(b.rows.length)).catch(() => {});
    const iv = setInterval(() => fetchOverview().then(setOv), 15_000);
    return () => clearInterval(iv);
  }, []);

  const totalHps = ov
    ? Object.values(ov.stats).reduce((a, s) => a + s.hashrate, 0)
    : 0;
  const totalMiners = ov
    ? Object.values(ov.stats).reduce((a, s) => a + s.miners_online, 0)
    : 0;

  return (
    <div className="pt-6">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="hero-shell text-center"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/zion-symbol.png"
          alt="ZION"
          className="hero-logo-mark mx-auto"
          width={84}
          height={84}
        />

        <p className="kicker mt-5 text-[0.62rem]">
          ZION TerraNova · {t('veřejný těžební pool', 'public mining pool')}
        </p>
        <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-black leading-tight text-white md:text-5xl">
          {t('Jeden pool.', 'One pool.')}{' '}
          <span className="gradient-text">
            {t('Čtyři coiny.', 'Four coins.')}
          </span>
          <br />
          {t('Nativní výplaty.', 'Native payouts.')}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/55">
          {t(
            'Těžte ZION, Quantus, Pearl nebo multi-algo přes jediný stratum. Transparentní PPLNS, výplata vždy v coinu, který těžíte. Žádná auto-konverze.',
            'Mine ZION, Quantus, Pearl or multi-algo over a single stratum. Transparent PPLNS, always paid in the coin you mine. No auto-conversion.',
          )}
        </p>

        {/* live stat chips */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <span className="hero-stat-chip">
            <span className="flex items-center gap-1 text-[0.62rem] font-bold uppercase tracking-wider text-rasta-gold">
              <Boxes size={11} /> hashrate
            </span>
            <span className="stat-value text-base font-black text-white">
              {fmtHashrate(totalHps)}
            </span>
          </span>
          <span className="hero-stat-chip">
            <span className="flex items-center gap-1 text-[0.62rem] font-bold uppercase tracking-wider text-rasta-green">
              <Users size={11} /> {t('mineři', 'miners')}
            </span>
            <span className="stat-value text-base font-black text-white">
              {fmtInt(totalMiners)}
            </span>
          </span>
          <span className="hero-stat-chip">
            <span className="flex items-center gap-1 text-[0.62rem] font-bold uppercase tracking-wider text-rasta-red">
              <Blocks size={11} /> {t('bloky', 'blocks')}
            </span>
            <span className="stat-value text-base font-black text-white">
              {blockCount !== null ? fmtInt(blockCount) : '…'}
            </span>
          </span>
          <span className="hero-stat-chip">
            <span className="flex items-center gap-1 text-[0.62rem] font-bold uppercase tracking-wider text-white/50">
              <Clock size={11} /> uptime
            </span>
            <span className="stat-value text-base font-black text-white">
              {ov ? fmtDuration(ov.uptime_s) : '…'}
            </span>
          </span>
        </div>

        {/* CTA row */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <a href="/start/" className="btn-gold">
            <Pickaxe size={15} /> {t('Začít těžit', 'Start mining')}
          </a>
          <a href="/stats/" className="btn-ghost">
            {t('Live statistiky', 'Live stats')} <ArrowRight size={14} />
          </a>
        </div>
      </motion.section>

      {/* Miner lookup */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mx-auto mt-10 max-w-3xl"
      >
        <MinerSearch />
        <p className="mt-2 text-center text-[0.68rem] text-white/35">
          <ShieldCheck size={11} className="mr-1 inline text-rasta-green" />
          {t(
            'Dashboard je veřejný — zadej payout adresu, nebo se přihlas přes ZIS pro auto-detekci tvých adres.',
            'The dashboard is public — enter a payout address, or sign in with ZIS to auto-detect your addresses.',
          )}
        </p>
      </motion.section>

      {/* Coin cards */}
      <section className="mt-12">
        <h2 className="kicker mb-4 text-center">
          {t('Podporované coiny', 'Supported coins')}
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          {ov?.coins.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 + i * 0.07 }}
            >
              <CoinCard coin={c} stats={ov.stats[c.id]} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Ecosystem strip */}
      <section className="mt-14">
        <h2 className="kicker mb-4 text-center">
          {t('Součást ekosystému', 'Part of the ecosystem')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { href: 'https://zionterranova.com', label: 'TerraNova', sub: t('hub', 'hub') },
            { href: 'https://app.zionterranova.com', label: 'App', sub: t('wallet + docs', 'wallet + docs') },
            { href: 'https://app.zionterranova.com/explorer', label: 'eXplorer', sub: t('bloky + tx', 'blocks + tx') },
            { href: 'https://market.zionterranova.com', label: 'Market', sub: t('obchod', 'shop') },
            { href: 'https://oasis.zionterranova.com', label: 'OASIS', sub: t('hra', 'game') },
            { href: 'https://freeworld.zionterranova.com', label: 'Free World', sub: 'DAO' },
          ].map((e) => (
            <a
              key={e.href}
              href={e.href}
              target="_blank"
              rel="noreferrer"
              className="pool-card group flex flex-col items-center py-4 text-center transition hover:border-rasta-gold/40"
            >
              <span className="text-sm font-bold text-white group-hover:text-rasta-gold">
                {e.label}
              </span>
              <span className="mt-0.5 text-[0.62rem] text-white/40">{e.sub}</span>
            </a>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section className="pool-card mt-12 flex flex-col items-center justify-between gap-4 md:flex-row">
        <div>
          <h2 className="text-lg font-bold text-white">
            {t('Začněte za 2 minuty', 'Start in 2 minutes')}
          </h2>
          <p className="mt-1 text-sm text-white/50">
            {t(
              'Trinity Miner na jedno kliknutí, nebo SRBMiner / teamredminer pro pokročilé. Porty, TLS i config snippet najdete v návodu.',
              'One-click Trinity Miner, or SRBMiner / teamredminer for power users. Ports, TLS and config snippets in the guide.',
            )}
          </p>
        </div>
        <a href="/start/" className="btn-gold shrink-0">
          {t('Jak těžit', 'How to mine')} <ArrowRight size={16} />
        </a>
      </section>
    </div>
  );
}
