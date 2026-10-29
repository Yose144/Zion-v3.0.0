'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Pickaxe } from 'lucide-react';
import AreaChart, { type SeriesPoint } from '@/components/AreaChart';
import CalcCard from '@/components/CalcCard';
import CoinLogo from '@/components/CoinLogo';
import RangeTabs from '@/components/RangeTabs';
import {
  fetchBlocks,
  fetchHistory,
  fetchOverview,
  fetchPayouts,
  poolCoinKey,
} from '@/lib/api';
import {
  COINGECKO_ID,
  fetchMarketPrices,
  fetchPriceHistory,
  fetchZionPrice,
  type MarketPrice,
  type ZionPrice,
} from '@/lib/price';
import {
  fmtAgo,
  fmtAmount,
  fmtDifficulty,
  fmtHashrate,
  fmtInt,
  fmtUsd,
  payoutStatusLabel,
  shortAddr,
} from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type {
  BlockRow,
  CoinId,
  CoinInfo,
  CoinStats,
  PayoutRow,
} from '@/lib/types';

const ACCENT: Record<string, string> = {
  gold: '#fcd116',
  cyan: '#078930',
  purple: '#e41e2b',
  green: '#00ff41',
};

export default function CoinClient({ coinId }: { coinId: CoinId }) {
  const { t, lang } = useLang();
  const [coin, setCoin] = useState<CoinInfo | null>(null);
  const [stats, setStats] = useState<CoinStats | null>(null);
  const [hrSeries, setHrSeries] = useState<SeriesPoint[]>([]);
  const [onlineSeries, setOnlineSeries] = useState<SeriesPoint[]>([]);
  const [priceSeries, setPriceSeries] = useState<SeriesPoint[]>([]);
  const [price, setPrice] = useState<MarketPrice | null>(null);
  const [zion, setZion] = useState<ZionPrice | null>(null);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [range, setRange] = useState(24);

  const poolKey = poolCoinKey(coinId);
  const cgId = COINGECKO_ID[coinId as keyof typeof COINGECKO_ID];

  useEffect(() => {
    const load = () =>
      fetchOverview().then((ov) => {
        const c = ov.coins.find((x) => x.id === coinId) ?? null;
        setCoin(c);
        setStats(ov.stats[coinId] ?? null);
      });
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [coinId]);

  // Per-coin series from server-side 60s pool snapshots (24h retention).
  useEffect(() => {
    const load = () =>
      fetchHistory(1440)
        .then((samples) => {
          setHrSeries(
            samples.map((s) => ({ t: s.ts, v: s.hashrate_by_coin?.[poolKey] ?? 0 })),
          );
          setOnlineSeries(
            samples.map((s) => ({ t: s.ts, v: s.online_by_coin?.[poolKey] ?? 0 })),
          );
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [poolKey]);

  // Price: CoinGecko 7d for listed coins; ZION shows its on-chain price
  // with a client-accumulated series instead.
  useEffect(() => {
    if (cgId) {
      fetchPriceHistory(cgId, 7)
        .then((pts) => setPriceSeries(pts.map((p) => ({ t: p.ts / 1000, v: p.usd }))))
        .catch(() => {});
    }
    fetchZionPrice().then(setZion).catch(() => {});
    fetchMarketPrices()
      .then((m) => setPrice(coinId === 'zion' ? null : (m[coinId] ?? null)))
      .catch(() => {});
  }, [coinId, cgId]);

  useEffect(() => {
    const load = () => {
      fetchBlocks(coinId).then(({ rows }) => setBlocks(rows)).catch(() => {});
      fetchPayouts(coinId).then(setPayouts).catch(() => {});
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [coinId]);

  const nowS = Math.floor(Date.now() / 1000);
  const hrWindow = useMemo(
    () => hrSeries.filter((p) => p.t >= nowS - range * 3600),
    [hrSeries, range, nowS],
  );

  if (!coin) {
    return <div className="pt-20 text-center text-white/40">…</div>;
  }

  const acc = stats?.shares_1h.accepted ?? 0;
  const rej = stats?.shares_1h.rejected ?? 0;
  const accPct = acc + rej > 0 ? (acc / (acc + rej)) * 100 : 100;
  const displayPrice = coinId === 'zion' && zion ? { usd: zion.usd, change_24h: null } : price;
  const hr = stats?.hashrate ?? 0;

  return (
    <div className="pt-8">
      <header className="page-hero">
        <p className="rasta-hero-kicker">
          <Pickaxe size={12} /> {t('Coin detail', 'Coin detail')}
        </p>
        <div className="mt-2 flex items-center justify-center gap-4">
          <CoinLogo logo={coin.logo} ticker={coin.ticker} accent={coin.accent} size={64} />
          <div className="text-left">
            <h1 className="!mb-0">
              {coin.ticker}
              <span className="ml-2 text-base font-semibold text-white/50">{coin.name}</span>
            </h1>
            <p className="page-hero-sub !mt-1">
              {coin.algorithm} · {coin.dialect}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {displayPrice && (
            <span className="pill pill-bridged stat-value">
              {fmtUsd(displayPrice.usd)}
              {displayPrice.change_24h != null && (
                <span className={displayPrice.change_24h >= 0 ? 'text-rasta-green' : 'text-rasta-red'}>
                  {' '}{displayPrice.change_24h >= 0 ? '+' : ''}{displayPrice.change_24h.toFixed(1)}%
                </span>
              )}
            </span>
          )}
          {coin.legs.map((l, i) => (
            <span
              key={i}
              className={`pill ${
                l.status === 'live'
                  ? l.kind === 'native'
                    ? 'pill-native'
                    : 'pill-bridged'
                  : l.status === 'sync'
                    ? 'pill-sync'
                    : 'pill-down'
              }`}
            >
              <span className="dot" />
              {l.kind === 'native' ? 'native' : 'upstream'}
            </span>
          ))}
          <a href={`/start/#${coin.id}`} className="pill pill-sync">
            {t('návod →', 'guide →')}
          </a>
        </div>
      </header>

      {/* KPI strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {([
          { k: t('pool hashrate', 'pool hashrate'), v: stats ? fmtHashrate(hr) : '—' },
          { k: t('mineři', 'miners'), v: stats ? fmtInt(stats.miners_online) : '—' },
          {
            k: t('diff', 'difficulty'),
            v: stats?.network_difficulty != null ? fmtDifficulty(stats.network_difficulty) : '—',
          },
          { k: t('accept rate', 'accept rate'), v: `${accPct.toFixed(1)}%` },
          {
            k: t('vyplaceno / 24h', 'paid / 24h'),
            v: stats?.payouts_24h_zion != null ? `${fmtAmount(stats.payouts_24h_zion, 'ZION')}` : '—',
          },
          {
            k: t('min výplata', 'min payout'),
            v: `${coin.min_payout} ${coin.payout_unit}`,
          },
          {
            k: t('luck (100 blk)', 'luck (100 blk)'),
            v: stats?.luck_100 != null ? `${stats.luck_100.toFixed(1)}%` : '—',
            cls:
              stats?.luck_100 != null
                ? stats.luck_100 <= 100
                  ? 'text-rasta-green'
                  : 'text-rasta-red'
                : undefined,
            title:
              stats?.luck_500 != null
                ? t(`500 blk: ${stats.luck_500.toFixed(1)}%`, `500 blk: ${stats.luck_500.toFixed(1)}%`)
                : undefined,
          },
        ] as { k: string; v: string; cls?: string; title?: string }[]).map((x) => (
          <div key={x.k} className="pool-card card-glow p-4" title={x.title}>
            <p className="kicker">{x.k}</p>
            <p className={`stat-value mt-1 truncate text-base font-bold ${x.cls ?? 'text-white'}`}>{x.v}</p>
          </div>
        ))}
      </div>

      {/* hashrate + miners charts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="pool-card card-glow">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/70">
              {t('pool hashrate', 'pool hashrate')}
            </h3>
            <RangeTabs value={range} onChange={setRange} />
          </div>
          <AreaChart
            data={hrWindow}
            color={ACCENT[coin.accent]}
            height={170}
            fmt={(v) => fmtHashrate(v)}
            emptyLabel={t('sbíráme data…', 'collecting data…')}
          />
          <div className="mt-4">
            <p className="kicker mb-1">{t('mineři online', 'miners online')}</p>
            <AreaChart
              data={onlineSeries}
              color="#ffffff"
              height={52}
              fmt={(v) => fmtInt(v)}
              emptyLabel="—"
            />
          </div>
        </div>

        <div className="pool-card card-glow">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/70">
              {t('cena · 7 dní', 'price · 7 days')}
            </h3>
            {displayPrice && (
              <span className="stat-value text-sm font-bold text-white">
                {fmtUsd(displayPrice.usd)}
              </span>
            )}
          </div>
          <AreaChart
            data={priceSeries}
            color="#ffffff"
            height={170}
            fmt={(v) => fmtUsd(v)}
            emptyLabel={
              coinId === 'zion'
                ? t('on-chain cena — série se plní postupně', 'on-chain price — series fills over time')
                : t('není na CoinGecko', 'not on CoinGecko')
            }
          />
        </div>
      </div>

      {/* calculator + quickstart */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <CalcCard
          coin={coin}
          poolHashrate={hr}
          payouts24h={stats?.payouts_24h_zion ?? null}
          zionUsd={zion?.usd ?? null}
        />

        <div className="pool-card card-glow flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/70">
            {t('Začít těžit', 'Start mining')}
          </h3>
          <div className="code-block">
            <span className="c-dim"># TCP</span>{'\n'}
            <span className="c-gold">stratum+tcp://pool.zionterranova.com:{coin.port}</span>{'\n'}
            <span className="c-dim"># TLS</span>{'\n'}
            <span className="c-cyan">stratum+ssl://pool.zionterranova.com:{coin.tls_port}</span>
          </div>
          <p className="text-[0.72rem] leading-relaxed text-white/45">
            {coin.payout_mode === 'onchain'
              ? t(
                  `Výplaty v ${coin.payout_unit} · fee ${(coin.fee_bps / 100).toFixed(1)}% · PPLNS`,
                  `Paid in ${coin.payout_unit} · ${(coin.fee_bps / 100).toFixed(1)}% fee · PPLNS`,
                )
              : t(
                  `Vyplácí se v ZION (unified payout) · fee ${(coin.fee_bps / 100).toFixed(1)}% · PPLNS`,
                  `Settled in ZION (unified payout) · ${(coin.fee_bps / 100).toFixed(1)}% fee · PPLNS`,
                )}
          </p>
          <a
            href={`/start/#${coin.id}`}
            className="rasta-hero-btn-primary mt-auto inline-flex w-fit items-center gap-1.5 !px-4 !py-2 text-xs"
          >
            {t('Kompletní návod', 'Full guide')} <ArrowRight size={13} />
          </a>
        </div>
      </div>

      {/* recent payouts + blocks */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="pool-card card-glow overflow-x-auto">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/70">
            {t('poslední výplaty', 'recent payouts')}
          </h3>
          {payouts.length === 0 ? (
            <p className="py-4 text-center text-xs text-white/30">
              {t('zatím žádné', 'none yet')}
            </p>
          ) : (
            <table className="pool-table">
              <tbody>
                {payouts.slice(0, 8).map((p, i) => (
                  <tr key={i}>
                    <td className="text-dim">{p.ts ? fmtAgo(p.ts, lang) : '—'}</td>
                    <td>
                      <a
                        href={`/miner/${p.coin}/${p.address}/`}
                        className="text-white/60 underline decoration-white/15 underline-offset-2 transition hover:text-rasta-gold"
                      >
                        {shortAddr(p.address)}
                      </a>
                    </td>
                    <td className="text-right font-bold text-white">
                      {fmtAmount(p.amount, p.unit)} {p.unit}
                    </td>
                    <td className="text-right text-[0.7rem]">
                      {payoutStatusLabel(p.status, t)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="pool-card card-glow overflow-x-auto">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/70">
            {t('nalezené bloky', 'blocks found')}
          </h3>
          {blocks.length === 0 ? (
            <p className="py-4 text-center text-xs text-white/30">
              {coinId === 'zion'
                ? t('zatím žádné', 'none yet')
                : t('bloky řeší upstream pool — těžíme přes forwarded leg', 'blocks are found upstream — we mine via the forwarded leg')}
            </p>
          ) : (
            <table className="pool-table">
              <tbody>
                {blocks.slice(0, 8).map((b, i) => (
                  <tr key={i}>
                    <td className="text-white">{fmtInt(b.height)}</td>
                    <td className="text-dim">{shortAddr(b.hash)}</td>
                    <td className={b.luck_pct != null && b.luck_pct >= 100 ? 'text-green' : 'text-dim'}>
                      {b.luck_pct != null ? `${Math.round(b.luck_pct)}%` : '—'}
                    </td>
                    <td className="text-right text-dim">{fmtAgo(b.ts, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
