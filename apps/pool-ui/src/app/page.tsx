'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Blocks, Boxes, CircleDollarSign, Clock, Gauge, Megaphone, Pickaxe, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import AreaChart, { type SeriesPoint } from '@/components/AreaChart';
import RangeTabs from '@/components/RangeTabs';
import CoinCard from '@/components/CoinCard';
import CoinLogo from '@/components/CoinLogo';
import MinerSearch from '@/components/MinerSearch';
import TopMiners from '@/components/TopMiners';
import LuckEffortCard from '@/components/LuckEffortCard';
import { fetchBlocks, fetchHistory, fetchOverview } from '@/lib/api';
import { fetchMarketPrices, fetchZionPrice, type MarketPrice, type ZionPrice } from '@/lib/price';
import { ANNOUNCEMENTS } from '@/lib/announcements';
import { fmtAgo, fmtDifficulty, fmtDuration, fmtHashrate, fmtInt, fmtUsd } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { BlockRow, PoolOverview } from '@/lib/types';

const ACCENT: Record<string, string> = {
  gold: '#fcd116',
  cyan: '#078930',
  purple: '#e41e2b',
  green: '#00ff41',
};

export default function HomePage() {
  const { t, lang } = useLang();
  const [ov, setOv] = useState<PoolOverview | null>(null);
  const [blockCount, setBlockCount] = useState<number | null>(null);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [hrHistory, setHrHistory] = useState<SeriesPoint[]>([]);
  const [hrRange, setHrRange] = useState(24);
  const nowS = Math.floor(Date.now() / 1000);
  const [price, setPrice] = useState<ZionPrice | null>(null);
  const [markets, setMarkets] = useState<Record<string, MarketPrice>>({});

  useEffect(() => {
    fetchOverview().then(setOv);
    const pullBlocks = () =>
      fetchBlocks()
        .then((b) => {
          setBlockCount(b.rows.length);
          setBlocks(b.rows);
        })
        .catch(() => {});
    pullBlocks();
    const iv = setInterval(() => {
      fetchOverview().then(setOv);
      pullBlocks();
    }, 15_000);
    return () => clearInterval(iv);
  }, []);

  // Server-side 24h pool hashrate series (60s samples) — authoritative
  // history persisted by the backend, no client accumulation needed.
  useEffect(() => {
    const pull = () =>
      fetchHistory()
        .then((s) => {
          if (s.length)
            setHrHistory(s.map((p) => ({ t: p.ts, v: p.hashrate })));
        })
        .catch(() => {});
    pull();
    const iv = setInterval(pull, 60_000);
    return () => clearInterval(iv);
  }, []);

  // ZION/USD — live on-chain Uni V3 spot on Base (seed-price fallback);
  // all other listed coins come from CoinGecko.
  useEffect(() => {
    const pull = () => {
      fetchZionPrice().then(setPrice).catch(() => {});
      fetchMarketPrices().then(setMarkets).catch(() => {});
    };
    pull();
    const iv = setInterval(pull, 120_000);
    return () => clearInterval(iv);
  }, []);

  // Unified price lookup — ZION's on-chain price overrides CoinGecko.
  const priceOf = (coinId: string): MarketPrice | null =>
    coinId === 'zion' && price
      ? { usd: price.usd, change_24h: null }
      : markets[coinId] ?? null;

  const totalHps = ov
    ? Object.values(ov.stats).reduce((a, s) => a + s.hashrate, 0)
    : 0;
  const totalMiners = ov
    ? Object.values(ov.stats).reduce((a, s) => a + s.miners_online, 0)
    : 0;

  // Difficulty per coin — live `served_difficulty` from the stats API wins;
  // block-derived network difficulty is the fallback for coins with no
  // served value yet.
  const netDiff: Record<string, number | null> = {};
  for (const b of blocks) {
    if (netDiff[b.coin] === undefined && b.network_difficulty != null)
      netDiff[b.coin] = b.network_difficulty;
  }
  if (ov) {
    for (const c of ov.coins) {
      const sd = ov.stats[c.id]?.network_difficulty;
      if (sd != null) netDiff[c.id] = sd;
    }
  }

  return (
    <div className="pt-6">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="hero-shell text-center"
      >
        <a
          href="/start/"
          className="hero-banner"
          aria-label={t('Začít těžit — návod', 'Start mining — guide')}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/hero-multichain.webp"
            alt={t(
              'ZION TerraNova multi-chain mining pool — jeden miner, více řetězců: ZION, Quantus, Pearl a další.',
              'ZION TerraNova multi-chain mining pool — one miner, multiple chains: ZION, Quantus, Pearl and more.',
            )}
            width={1672}
            height={941}
            loading="eager"
            decoding="async"
            className="hero-banner-img"
          />
        </a>

        <p className="rasta-hero-kicker mt-6">
          <span className="dot" style={{ color: 'var(--rasta-green)' }} />
          ZION TerraNova · {t('veřejný těžební pool · mainnet beta', 'public mining pool · mainnet beta')}
        </p>
        <h1 className="rasta-hero-title mx-auto mt-5 max-w-3xl text-3xl md:text-4xl">
          {t('Jeden pool.', 'One pool.')}
          <br />
          {t('Dvanáct coinů. Jedna stratum adresa.', 'Twelve coins. One stratum address.')}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-white/70 md:text-base">
          {t(
            'Těžte ZION, Quantus, Pearl + 9 dalších auxPoW coinů přes jediný stratum. Transparentní PPLNS, jednotné ZION výplaty, bez poplatků navíc.',
            'Mine ZION, Quantus, Pearl + 9 more auxPoW coins over a single stratum. Transparent PPLNS, unified ZION payouts, no extra fees.',
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

        {/* pool hashrate — live chart inside hero */}
        {hrHistory.length > 2 && (
          <div className="mx-auto mt-8 max-w-2xl text-left">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="kicker flex items-center gap-1.5">
                <TrendingUp size={11} className="text-rasta-gold" />
                {t('pool hashrate', 'pool hashrate')}
              </span>
              <span className="flex items-center gap-2">
                <span className="stat-value text-xs text-white/50">
                  {fmtHashrate(totalHps)}
                </span>
                <RangeTabs value={hrRange} onChange={setHrRange} />
              </span>
            </div>
            <AreaChart
              data={hrHistory.filter((p) => p.t >= nowS - hrRange * 3600)}
              color="#fcd116"
              height={90}
              fmt={(v) => fmtHashrate(v)}
            />
          </div>
        )}

        {/* CTA row */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <a href="/start/" className="rasta-hero-btn rasta-hero-btn-primary">
            <Pickaxe size={15} /> {t('Začít těžit', 'Start mining')}
          </a>
          <a href="/stats/" className="rasta-hero-btn rasta-hero-btn-ghost">
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

      {/* Network strip — live chain state per coin */}
      {Object.keys(netDiff).length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mx-auto mt-10 max-w-4xl"
        >
          <h2 className="kicker mb-3 text-center">
            {t('Stav sítě', 'Network status')}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {ov?.coins.filter((c) => c.legs.some((l) => l.kind === 'native')).map((c) => {
              const d = netDiff[c.id];
              const s = ov.stats[c.id];
              const live = c.legs.some((l) => l.status === 'live');
              return (
                <div key={c.id} className="pool-card card-glow kpi-tile">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.7rem] font-black uppercase tracking-wider" style={{ color: ({ zion: '#fcd116', qtc: '#078930', prl: '#e41e2b' } as Record<string, string>)[c.id] ?? '#fff' }}>
                      {c.ticker}
                    </span>
                    <span className={`pill ${live ? 'pill-live' : 'pill-down'}`}>
                      <span className="dot" />
                      {live ? 'live' : 'sync'}
                    </span>
                  </div>
                  <p className="kicker mt-3">
                    <Gauge size={10} className="mr-1 inline" />
                    {t('difficulty', 'difficulty')}
                  </p>
                  <p className="stat-value text-base font-black text-white">
                    {d != null ? fmtDifficulty(d) : '—'}
                  </p>
                  {c.id === 'zion' && price ? (
                    <p className="stat-value mt-1 flex items-center gap-1 text-[0.72rem] text-rasta-gold">
                      <CircleDollarSign size={10} />
                      {fmtUsd(price.usd)}
                      <span className="text-white/30">
                        {price.source === 'onchain' ? 'Uni V3' : 'seed'}
                      </span>
                    </p>
                  ) : (
                    <p className="stat-value mt-1 text-[0.7rem] text-white/40">
                      {s ? `${fmtHashrate(s.hashrate)} pool` : ''}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* Pool luck & current effort — ZION rounds (only coin producing
          blocks; auxPoW legs have no native block lottery). */}
      {ov && blocks.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <LuckEffortCard stats={ov.stats.zion ?? null} blocks={blocks.filter((b) => b.coin === 'zion')} />
        </motion.section>
      )}

      {/* Featured native coins */}
      <section className="mt-12">
        <h2 className="kicker mb-4 text-center">
          {t('Podporované coiny', 'Supported coins')}
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {ov?.coins
            .filter((c) => c.legs.some((l) => l.kind === 'native'))
            .sort((a, b) => ['qtc', 'prl', 'zion'].indexOf(a.id) - ['qtc', 'prl', 'zion'].indexOf(b.id))
            .map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.2 + i * 0.07 }}
              >
                <CoinCard coin={c} stats={ov.stats[c.id]} networkDiff={netDiff[c.id]} price={priceOf(c.id)} />
              </motion.div>
            ))}
        </div>
      </section>

      {/* All coins — full table incl. auxPoW upstream legs */}
      {ov && ov.coins.length > 3 && (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="pool-card card-glow mt-8"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">
              {t('Všechny minovatelné coiny', 'All mineable coins')}
            </h2>
            <span className="text-[0.65rem] text-white/35">
              {t('auxPoW coiny se vyplácejí v ZION', 'auxPoW coins pay out in ZION')}
            </span>
          </div>
          <div className="table-scroll">
            <table className="pool-table">
              <thead>
                <tr>
                  <th>{t('coin', 'coin')}</th>
                  <th>{t('algoritmus', 'algorithm')}</th>
                  <th className="text-right">{t('cena', 'price')}</th>
                  <th className="text-right">{t('pool hashrate', 'pool hashrate')}</th>
                  <th className="text-right">{t('mineři', 'miners')}</th>
                  <th className="text-right">{t('fee', 'fee')}</th>
                  <th className="text-right">{t('stav', 'status')}</th>
                </tr>
              </thead>
              <tbody>
                {[...ov.coins]
                  .sort(
                    (a, b) =>
                      (ov.stats[b.id]?.hashrate ?? 0) - (ov.stats[a.id]?.hashrate ?? 0),
                  )
                  .map((c) => {
                    const s = ov.stats[c.id];
                    const live = c.legs.some((l) => l.status === 'live');
                    const p = priceOf(c.id);
                    return (
                      <tr key={c.id}>
                        <td>
                          <span className="inline-flex items-center gap-2.5">
                            <CoinLogo logo={c.logo} ticker={c.ticker} accent={c.accent} size={26} />
                            <span>
                              <a
                                href={`/coin/${c.id}/`}
                                className="font-bold transition-opacity hover:opacity-75"
                                style={{ color: ACCENT[c.accent] }}
                              >
                                {c.ticker}
                              </a>{' '}
                              <span className="text-white/40">{c.name}</span>
                            </span>
                          </span>
                        </td>
                        <td className="text-white/60">{c.algorithm}</td>
                        <td className="text-right font-bold text-white">
                          {p ? fmtUsd(p.usd) : '—'}
                          {p?.change_24h != null && (
                            <span
                              className={`ml-1 text-[0.65rem] ${
                                p.change_24h >= 0 ? 'text-rasta-green' : 'text-rasta-red'
                              }`}
                            >
                              {p.change_24h >= 0 ? '+' : ''}
                              {p.change_24h.toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td className="text-right font-bold text-white">
                          {s ? fmtHashrate(s.hashrate) : '—'}
                        </td>
                        <td className="text-right text-white">
                          {s ? fmtInt(s.miners_online) : '—'}
                        </td>
                        <td className="text-right text-white/50">
                          {(c.fee_bps / 100).toFixed(1)}%
                        </td>
                        <td className="text-right">
                          <span className={`pill ${live ? 'pill-live' : 'pill-down'}`}>
                            <span className="dot" />
                            {live ? 'live' : 'sync'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </motion.section>
      )}

      <TopMiners limit={10} />

      {/* Latest announcement — thin pointer to /announcements */}
      {(() => {
        const latest = [...ANNOUNCEMENTS].sort((a, b) => b.ts - a.ts)[0];
        if (!latest) return null;
        const copy = lang === 'cs' ? latest.cs : latest.en;
        return (
          <a
            href="/announcements/"
            className="pool-card mt-6 flex items-center gap-3 p-3.5 transition hover:border-rasta-gold/30"
          >
            <Megaphone size={14} className="shrink-0 text-rasta-gold" />
            <span className="truncate text-[0.8rem] text-white/70">
              <b className="text-white">{copy.title}</b>
              <span className="hidden sm:inline text-white/45"> — {copy.body}</span>
            </span>
            <span className="ml-auto shrink-0 text-[0.65rem] text-white/35">
              {fmtAgo(latest.ts, lang)}
            </span>
          </a>
        );
      })()}

      {/* CTA strip — market rasta banner */}
      <section className="rasta-cta-banner mt-12 flex flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
        <div>
          <h2 className="text-lg font-bold text-white">
            {t('Začněte za 2 minuty', 'Start in 2 minutes')}
          </h2>
          <p className="mt-1 text-sm text-white/55">
            {t(
              'Trinity Miner na jedno kliknutí, nebo SRBMiner / teamredminer pro pokročilé. Porty, TLS i config snippet najdete v návodu.',
              'One-click Trinity Miner, or SRBMiner / teamredminer for power users. Ports, TLS and config snippets in the guide.',
            )}
          </p>
        </div>
        <a href="/start/" className="rasta-hero-btn rasta-hero-btn-primary shrink-0">
          {t('Jak těžit', 'How to mine')} <ArrowRight size={16} />
        </a>
      </section>
    </div>
  );
}
