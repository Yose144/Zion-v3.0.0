'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import {
  ExternalLink,
  Building2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  ArrowRight,
  Activity,
  DollarSign,
  RefreshCw,
  Users,
  Zap,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { CONTRACTS, SEED_PRICE_USD } from '@/lib/defi-contracts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CexListing {
  name: string;
  logo: string;
  url: string;
  status: 'listed' | 'applied' | 'planned' | 'rejected';
  pairs: string[];
  volume24h?: number;
  updated: string;
  notes?: string;
  kyc_required: boolean;
  countries?: string;
  fee_spot?: string;
}

interface DexPairDetail {
  address: string;
  dex: string;
  pair: string;
  price_usd: number;
  price_native: string;
  liquidity_usd: number;
  volume_24h: number;
  volume_6h: number;
  volume_1h: number;
  price_change_24h: number;
  price_change_1h: number;
  txns_24h: { buys: number; sells: number };
  fdv: number;
  market_cap: number;
  created_at: number;
}

interface CexApiResponse {
  ok: boolean;
  cex: {
    listings: CexListing[];
    summary: {
      total_exchanges: number;
      listed: number;
      applied: number;
      planned: number;
      total_pairs: number;
    };
  };
  dex: {
    source: string;
    pairs: number;
    total_volume_24h: number;
    total_liquidity_usd: number;
    total_txns_24h?: number;
    total_buys_24h?: number;
    total_sells_24h?: number;
    best_price_usd?: number;
    pairs_detail?: DexPairDetail[];
  };
  fetchedAt: number;
}

const STATUS_CONFIG = {
  listed: { label: 'Listed', labelCs: 'Listováno', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  applied: { label: 'Applied', labelCs: 'Podáno', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  planned: { label: 'Planned', labelCs: 'Plánováno', icon: Clock, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  rejected: { label: 'Rejected', labelCs: 'Odmítnuto', icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
} as const;

// ─── FAQ Items ───────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: 'How do I buy ZION on a CEX?',
    qCs: 'Jak koupím ZION na CEX?',
    a: 'Create an account on a listed exchange, complete KYC verification, deposit USDT or USDC, and trade for ZION. Once purchased, withdraw to your own wallet for self-custody.',
    aCs: 'Vytvořte si účet na listované burze, dokončete KYC, vložte USDT nebo USDC a obchodujte za ZION. Po nákupu vyberte ZION do vlastní peněženky pro self-custody.',
  },
  {
    q: 'How do I transfer ZION from CEX to my own wallet?',
    qCs: 'Jak přenesu ZION z CEX do vlastní peněženky?',
    a: 'Withdraw ZION from the exchange to your ZION L1 address (zion1...) or wZION to your Base EVM address (0x...). Always test with a small amount first. Bridge between L1 and L2 via the ZION Bridge.',
    aCs: 'Vyberte ZION z burzy na vaši ZION L1 adresu (zion1...) nebo wZION na vaši Base EVM adresu (0x...). Vždy nejprve otestujte malou částkou. Přenos mezi L1 a L2 přes ZION Bridge.',
  },
  {
    q: 'What is the difference between ZION and wZION?',
    qCs: 'Jaký je rozdíl mezi ZION a wZION?',
    a: 'ZION is the native L1 blockchain token. wZION is the ERC-20 wrapped version on Base L2, created by locking ZION via the bridge. 1:1 peg. Trade wZION on Uniswap, ZION on L1 DEX/CEX.',
    aCs: 'ZION je nativní L1 blockchain token. wZION je ERC-20 zabalená verze na Base L2, vytvořená zamčením ZION přes bridge. 1:1 peg. wZION obchodujte na Uniswap, ZION na L1 DEX/CEX.',
  },
  {
    q: 'When will ZION be listed on more exchanges?',
    qCs: 'Kdy bude ZION listován na dalších burzách?',
    a: 'CEX listings are prioritized after the DEX liquidity seeding phase completes. Current focus: building volume on Uniswap V3 (Base) and demonstrating organic demand. Exchange applications are submitted once audit + volume thresholds are met.',
    aCs: 'CEX listování je prioritizováno po dokončení fáze DEX liquidity seeding. Aktuální focus: budování volume na Uniswap V3 (Base) a demonstrace organické poptávky. Přihlášky na burzy se odesílají po splnění auditu + volume thresholdů.',
  },
  {
    q: 'Is ZION available on DEX?',
    qCs: 'Je ZION dostupný na DEX?',
    a: 'Yes! wZION is available on Uniswap V3 (Base mainnet) in three pools: wZION/USDT (0.3% fee, primary), wZION/WETH (1% fee), and wZION/SOL (0.01% fee). Trade directly at app.uniswap.org with no KYC required.',
    aCs: 'Ano! wZION je dostupný na Uniswap V3 (Base mainnet) ve třech poolch: wZION/USDT (0.3% fee, primární), wZION/WETH (1% fee) a wZION/SOL (0.01% fee). Obchodujte přímo na app.uniswap.org bez KYC.',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatVolume(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
  return `$${v.toFixed(2)}`;
}

function formatPct(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CexPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [data, setData] = useState<CexApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/cex/listings', { cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();
      setData(d);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const listings = data?.cex?.listings ?? [];
  const summary = data?.cex?.summary;
  const dex = data?.dex;
  const dexPairs = dex?.pairs_detail ?? [];
  const bestPrice = dex?.best_price_usd ?? SEED_PRICE_USD;

  return (
    <div className="relative overflow-hidden bg-black text-white pt-28 pb-16">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 -right-28 h-[520px] w-[520px] rounded-full bg-zion-gold/15 blur-3xl" />
        <div className="absolute top-40 -left-24 h-[420px] w-[420px] rounded-full bg-zion-cyan/12 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-[420px] w-[620px] rounded-full bg-zion-purple/10 blur-3xl" />
      </div>

      {/* ── Hero ── */}
      <section className="zion-container relative z-10 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-4 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-zion-gold" />
            <span className="text-xs uppercase tracking-[0.35em] text-gray-400">
              ZION · Centralized Exchanges
            </span>
            <button
              onClick={refresh}
              className="ml-auto inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-white transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              {cs ? 'Obnovit' : 'Refresh'}
            </button>
          </div>

          <h1 className="mb-4 text-4xl font-bold md:text-5xl lg:text-6xl">
            <span className="text-gradient">CEX Listings</span>
          </h1>

          <p className="mb-6 max-w-2xl text-lg leading-relaxed text-gray-300">
            {cs
              ? 'Sledujte listování ZION na centralizovaných burzách. Aktuálně dostupné na DEX (Uniswap V3), CEX listování plánováno po dosažení volume thresholdů.'
              : 'Track ZION listings on centralized exchanges. Currently available on DEX (Uniswap V3), CEX listings planned after volume thresholds are met.'}
          </p>

          {/* Quick stats */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
              <Activity className="h-3.5 w-3.5 text-zion-gold" />
              <span className="text-gray-300">{cs ? 'Cena DEX' : 'DEX Price'}:</span>
              <span className="font-mono text-white">${bestPrice.toFixed(6)}</span>
              <span className={`text-[10px] ${dex?.source === 'dexscreener' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {dex?.source === 'dexscreener' ? 'live' : (dex?.source ?? 'seed')}
              </span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
              <DollarSign className="h-3.5 w-3.5 text-zion-cyan" />
              <span className="text-gray-300">{cs ? 'DEX Volume 24h' : 'DEX Volume 24h'}:</span>
              <span className="font-mono text-white">{formatVolume(dex?.total_volume_24h ?? 0)}</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
              <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-gray-300">{cs ? 'DEX Likvidita' : 'DEX Liquidity'}:</span>
              <span className="font-mono text-white">{formatVolume(dex?.total_liquidity_usd ?? 0)}</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
              <Building2 className="h-3.5 w-3.5 text-zion-purple" />
              <span className="text-gray-300">{cs ? 'Burzy' : 'Exchanges'}:</span>
              <span className="font-mono text-white">{summary?.listed ?? 0}/{summary?.total_exchanges ?? 0}</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── DEX Trading Dashboard (DexScreener data) ── */}
      <section className="zion-container relative z-10 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="zion-rainbow-card p-6"
          style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[10px] font-semibold text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  {cs ? 'DOSTUPNÉ NYNÍ' : 'AVAILABLE NOW'}
                </span>
                {dex?.source === 'dexscreener' && (
                  <span className="text-[10px] text-gray-500">via DexScreener</span>
                )}
              </div>
              <h2 className="text-2xl font-bold text-white">{cs ? 'DEX Trading — Uniswap V3' : 'DEX Trading — Uniswap V3'}</h2>
              <p className="text-sm text-gray-400 mt-1">{cs ? 'Obchoduj wZION bez KYC, přímo z vaší peněženky' : 'Trade wZION without KYC, directly from your wallet'}</p>
            </div>
            <a
              href={`https://app.uniswap.org/swap?chain=base&inputCurrency=ETH&outputCurrency=${CONTRACTS.wZION}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan px-6 py-3 font-semibold text-white shadow-lg transition-shadow hover:shadow-xl"
            >
              {cs ? 'Otevřít Uniswap' : 'Open Uniswap'}
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {/* DEX aggregate stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="zion-rainbow-sub p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'Cena' : 'Price'}</p>
              <p className="text-lg font-bold text-white mt-1">${bestPrice.toFixed(6)}</p>
              <p className="text-[10px] text-gray-500">USD / wZION</p>
            </div>
            <div className="zion-rainbow-sub p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'Volume 24h' : 'Volume 24h'}</p>
              <p className="text-lg font-bold text-white mt-1">{formatVolume(dex?.total_volume_24h ?? 0)}</p>
              <p className="text-[10px] text-gray-500">{cs ? 'celkem' : 'total'}</p>
            </div>
            <div className="zion-rainbow-sub p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'Likvidita' : 'Liquidity'}</p>
              <p className="text-lg font-bold text-white mt-1">{formatVolume(dex?.total_liquidity_usd ?? 0)}</p>
              <p className="text-[10px] text-gray-500">{cs ? 'v poolech' : 'in pools'}</p>
            </div>
            <div className="zion-rainbow-sub p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'Transakce 24h' : 'Txns 24h'}</p>
              <p className="text-lg font-bold text-white mt-1">{(dex?.total_txns_24h ?? 0).toLocaleString()}</p>
              <p className="text-[10px] text-gray-500">
                <span className="text-emerald-400">{dex?.total_buys_24h ?? 0} buys</span>
                {' · '}
                <span className="text-red-400">{dex?.total_sells_24h ?? 0} sells</span>
              </p>
            </div>
          </div>

          {/* Per-pair breakdown from DexScreener */}
          {dexPairs.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/2">
                    <th className="p-3 text-left font-medium text-gray-400">{cs ? 'Pár' : 'Pair'}</th>
                    <th className="p-3 text-right font-medium text-gray-400">{cs ? 'Cena' : 'Price'}</th>
                    <th className="p-3 text-right font-medium text-gray-400">24h %</th>
                    <th className="p-3 text-right font-medium text-gray-500">Liquidity</th>
                    <th className="p-3 text-right font-medium text-gray-500">Volume 24h</th>
                    <th className="p-3 text-right font-medium text-gray-500">Txns</th>
                  </tr>
                </thead>
                <tbody>
                  {dexPairs.map((pair) => (
                    <tr key={pair.address} className="border-b border-white/5 hover:bg-white/3">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-white">{pair.pair}</span>
                          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-gray-500 uppercase">{pair.dex}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono text-white">${pair.price_usd.toFixed(6)}</td>
                      <td className="p-3 text-right">
                        <span className={`inline-flex items-center gap-1 font-mono ${pair.price_change_24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pair.price_change_24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {formatPct(pair.price_change_24h)}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-gray-300">{formatVolume(pair.liquidity_usd)}</td>
                      <td className="p-3 text-right font-mono text-gray-300">{formatVolume(pair.volume_24h)}</td>
                      <td className="p-3 text-right text-[10px]">
                        <span className="text-emerald-400">{pair.txns_24h.buys}B</span>
                        {' / '}
                        <span className="text-red-400">{pair.txns_24h.sells}S</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`https://dexscreener.com/base/${CONTRACTS.UniV3PoolWETH}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-gray-400 hover:text-white transition-colors"
            >
              <BarChart3 className="h-3 w-3" /> DexScreener <ExternalLink className="h-2.5 w-2.5" />
            </a>
            <a
              href={`https://basescan.org/token/${CONTRACTS.wZION}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-gray-400 hover:text-white transition-colors"
            >
              wZION Contract <ExternalLink className="h-2.5 w-2.5" />
            </a>
            <a
              href={`https://app.uniswap.org/pools?chain=base&token0=${CONTRACTS.wZION}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-gray-400 hover:text-white transition-colors"
            >
              Uniswap Pools <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </motion.div>
      </section>

      {/* ── CEX Listings Table ── */}
      <section className="zion-container relative z-10 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">{cs ? 'Seznam Burz' : 'Exchange Listings'}</h2>
            <div className="flex gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-400" />{summary?.listed ?? 0} {cs ? 'listováno' : 'listed'}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-cyan-400" />{summary?.planned ?? 0} {cs ? 'plánováno' : 'planned'}</span>
              <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3 text-gray-400" />{summary?.total_pairs ?? 0} {cs ? 'párů' : 'pairs'}</span>
            </div>
          </div>

          <div className="overflow-hidden zion-rainbow-card" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/2">
                    <th className="p-4 text-left font-medium text-gray-400">{cs ? 'Burza' : 'Exchange'}</th>
                    <th className="p-4 text-left font-medium text-gray-400">{cs ? 'Status' : 'Status'}</th>
                    <th className="p-4 text-left font-medium text-gray-400">{cs ? 'Páry' : 'Pairs'}</th>
                    <th className="p-4 text-left font-medium text-gray-400">{cs ? 'KYC' : 'KYC'}</th>
                    <th className="p-4 text-left font-medium text-gray-400">{cs ? 'Poplatek' : 'Fee'}</th>
                    <th className="p-4 text-left font-medium text-gray-400">{cs ? 'Poznámka' : 'Notes'}</th>
                    <th className="p-4 text-right font-medium text-gray-400">{cs ? 'Odkaz' : 'Link'}</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((ex) => {
                    const status = STATUS_CONFIG[ex.status];
                    const StatusIcon = status.icon;
                    return (
                      <tr key={ex.name} className="border-b border-white/5 hover:bg-white/3">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-zion-gold/30 to-zion-purple/20 text-xs font-bold text-white">
                              {ex.logo}
                            </div>
                            <div>
                              <span className="font-semibold text-white">{ex.name}</span>
                              {ex.countries && (
                                <p className="text-[9px] text-gray-500">{ex.countries}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full ${status.bg} ${status.border} border px-3 py-1 text-[10px] font-semibold ${status.color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {cs ? status.labelCs : status.label}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {ex.pairs.map((pair) => (
                              <span key={pair} className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-mono text-gray-300">
                                {pair}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`text-[10px] ${ex.kyc_required ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {ex.kyc_required ? 'Required' : 'No'}
                          </span>
                        </td>
                        <td className="p-4 text-[10px] font-mono text-gray-300">{ex.fee_spot ?? '—'}</td>
                        <td className="p-4 text-xs text-gray-400 max-w-xs">{ex.notes ?? '—'}</td>
                        <td className="p-4 text-right">
                          <a
                            href={ex.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-zion-gold/80 hover:text-zion-gold transition-colors"
                          >
                            {cs ? 'Navštívit' : 'Visit'} <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── How to Buy ── */}
      <section className="zion-container relative z-10 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-bold mb-6">{cs ? 'Jak koupit ZION' : 'How to Buy ZION'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* DEX path */}
            <div className="zion-rainbow-card p-6" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
              <div className="flex items-center gap-2 mb-3">
                <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[10px] font-mono text-emerald-400">DEX</span>
                <h3 className="font-semibold text-white text-sm">{cs ? 'Přes Uniswap (doporučeno)' : 'Via Uniswap (recommended)'}</h3>
              </div>
              <ol className="space-y-2 text-xs text-gray-300">
                <li className="flex gap-2"><span className="text-zion-gold font-bold">1.</span> {cs ? 'Připoj peněženku (MetaMask/Rabby)' : 'Connect wallet (MetaMask/Rabby)'}</li>
                <li className="flex gap-2"><span className="text-zion-gold font-bold">2.</span> {cs ? 'Přepni na Base mainnet' : 'Switch to Base mainnet'}</li>
                <li className="flex gap-2"><span className="text-zion-gold font-bold">3.</span> {cs ? 'Měj ETH pro swap + gas' : 'Have ETH for swap + gas'}</li>
                <li className="flex gap-2"><span className="text-zion-gold font-bold">4.</span> {cs ? 'Swap ETH → wZION na Uniswap V3' : 'Swap ETH → wZION on Uniswap V3'}</li>
                <li className="flex gap-2"><span className="text-zion-gold font-bold">5.</span> {cs ? 'wZION je v tvé peněžence' : 'wZION is in your wallet'}</li>
              </ol>
              <a
                href={`https://app.uniswap.org/swap?chain=base&inputCurrency=ETH&outputCurrency=${CONTRACTS.wZION}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-xs text-zion-cyan hover:text-white transition-colors"
              >
                {cs ? 'Otevřít Uniswap' : 'Open Uniswap'} <ArrowRight className="h-3 w-3" />
              </a>
            </div>

            {/* CEX path */}
            <div className="zion-rainbow-card p-6" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <div className="flex items-center gap-2 mb-3">
                <span className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-1 text-[10px] font-mono text-amber-400">CEX</span>
                <h3 className="font-semibold text-white text-sm">{cs ? 'Přes Centralizovanou Burzu' : 'Via Centralized Exchange'}</h3>
              </div>
              <ol className="space-y-2 text-xs text-gray-300">
                <li className="flex gap-2"><span className="text-zion-gold font-bold">1.</span> {cs ? 'Vytvoř účet na listované burze' : 'Create account on a listed exchange'}</li>
                <li className="flex gap-2"><span className="text-zion-gold font-bold">2.</span> {cs ? 'Dokonč KYC verifikaci' : 'Complete KYC verification'}</li>
                <li className="flex gap-2"><span className="text-zion-gold font-bold">3.</span> {cs ? 'Vlož USDT/USDC' : 'Deposit USDT/USDC'}</li>
                <li className="flex gap-2"><span className="text-zion-gold font-bold">4.</span> {cs ? 'Obchoduj ZION/USDT pár' : 'Trade ZION/USDT pair'}</li>
                <li className="flex gap-2"><span className="text-zion-gold font-bold">5.</span> {cs ? 'Vyber ZION do vlastní peněženky' : 'Withdraw ZION to own wallet'}</li>
              </ol>
              <p className="mt-4 text-[10px] text-amber-400/70">{cs ? '⚠️ CEX listování plánováno — zatím nedostupné' : '⚠️ CEX listing planned — not yet available'}</p>
            </div>

            {/* Bridge path */}
            <div className="zion-rainbow-card p-6" style={{ '--rc': '124, 58, 237' } as React.CSSProperties}>
              <div className="flex items-center gap-2 mb-3">
                <span className="rounded-lg bg-purple-500/10 border border-purple-500/20 px-2 py-1 text-[10px] font-mono text-purple-400">Bridge</span>
                <h3 className="font-semibold text-white text-sm">{cs ? 'L1 → L2 Bridge' : 'L1 → L2 Bridge'}</h3>
              </div>
              <ol className="space-y-2 text-xs text-gray-300">
                <li className="flex gap-2"><span className="text-zion-gold font-bold">1.</span> {cs ? 'Měj ZION na L1 peněžence' : 'Have ZION in L1 wallet'}</li>
                <li className="flex gap-2"><span className="text-zion-gold font-bold">2.</span> {cs ? 'Otevři ZION Bridge' : 'Open ZION Bridge'}</li>
                <li className="flex gap-2"><span className="text-zion-gold font-bold">3.</span> {cs ? 'Zamkni ZION na L1' : 'Lock ZION on L1'}</li>
                <li className="flex gap-2"><span className="text-zion-gold font-bold">4.</span> {cs ? 'Relay mintne wZION na Base' : 'Relay mints wZION on Base'}</li>
                <li className="flex gap-2"><span className="text-zion-gold font-bold">5.</span> {cs ? 'wZION dostupný na Base L2' : 'wZION available on Base L2'}</li>
              </ol>
              <a
                href="/bridge"
                className="mt-4 inline-flex items-center gap-1.5 text-xs text-zion-cyan hover:text-white transition-colors"
              >
                {cs ? 'Otevřít Bridge' : 'Open Bridge'} <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── FAQ ── */}
      <section className="zion-container relative z-10 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-bold mb-6">{cs ? 'Často kladené dotazy' : 'FAQ'}</h2>
          <div className="space-y-3 max-w-3xl">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="zion-rainbow-card overflow-hidden" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <span className="flex items-center gap-3 text-sm font-medium text-white">
                    <HelpCircle className="h-4 w-4 text-zion-gold shrink-0" />
                    {cs ? item.qCs : item.q}
                  </span>
                  <span className={`text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}>▾</span>
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-4 pb-4 text-xs text-gray-300 leading-relaxed pl-11">
                        {cs ? item.aCs : item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── CTA ── */}
      <section className="zion-container relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
        >
          <h2 className="text-2xl font-bold mb-3">{cs ? 'Začni obchodovat' : 'Start Trading'}</h2>
          <p className="mx-auto mb-6 max-w-lg text-gray-300">
            {cs
              ? 'wZION je dostupný na Uniswap V3 (Base). Žádné KYC, žádné čekání. CEX listování plánováno na později.'
              : 'wZION is available on Uniswap V3 (Base). No KYC, no waiting. CEX listings planned for later.'}
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <a
              href="/defi"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan px-6 py-3 font-semibold text-white shadow-lg transition-shadow hover:shadow-xl"
            >
              {cs ? 'DeFi Hub' : 'DeFi Hub'}
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/bridge"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 px-6 py-3 text-white transition-colors hover:border-zion-cyan/45"
            >
              {cs ? 'Bridge' : 'Bridge'}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
