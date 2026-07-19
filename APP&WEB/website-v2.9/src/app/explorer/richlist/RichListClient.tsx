"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLang } from '@/contexts/LanguageContext';
import {
  Award,
  BarChart3,
  ChevronLeft,
  Copy,
  Check,
  Crown,
  Download,
  Gem,
  Loader2,
  Pickaxe,
  RefreshCw,
  Scale,
  Shield,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";

/* ── types ───────────────────────────────────────────────────── */

interface RichListEntry {
  rank: number;
  address: string;
  balance: number;
  balance_display: string;
  type: "premine" | "miner" | "unknown";
  label?: string;
  percentage: number;
}

interface RichListStats {
  total_addresses: number;
  total_balance: number;
  total_balance_display: string;
  circulating_supply: number;
  top_10_percentage: number;
  premine_addresses: number;
  miner_addresses: number;
  gini_coefficient: number;
}

interface RichListData {
  rich_list: RichListEntry[];
  stats: RichListStats;
  timestamp: string;
}

/* ── helpers ──────────────────────────────────────────────────── */

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      className="text-white/20 hover:text-white/60 transition-colors"
    >
      {ok ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function truncAddr(addr: string) {
  if (addr.length <= 20) return addr;
  return `${addr.slice(0, 12)}…${addr.slice(-8)}`;
}

const rankIcons = [
  { icon: Crown, color: "text-yellow-400" },
  { icon: Award, color: "text-gray-300" },
  { icon: Award, color: "text-amber-600" },
];

const getTypeConfig = (cs: boolean) => ({
  premine: {
    bg: "bg-zion-purple/10",
    border: "border-zion-purple/20",
    text: "text-zion-purple",
    label: "Premine",
    icon: Shield,
  },
  miner: {
    bg: "bg-zion-cyan/10",
    border: "border-zion-cyan/20",
    text: "text-zion-cyan",
    label: "Miner",
    icon: Pickaxe,
  },
  unknown: {
    bg: "bg-white/5",
    border: "border-white/10",
    text: "text-white/60",
    label: cs ? "Držitel" : "Holder",
    icon: Wallet,
  },
});

/* ── component ──────────────────────────────────────────────── */

interface RichListClientProps {
  /** When true the component renders only the data sections (stats, distribution, table) without the full-page wrapper, background glows, breadcrumb, and hero. */
  embedded?: boolean;
}

export default function RichListClient({ embedded = false }: RichListClientProps) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const locale = cs ? 'cs-CZ' : 'en-US';
  const typeConfig = getTypeConfig(cs);
  const [data, setData] = useState<RichListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);

  const fetchRichList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/blockchain/richlist?limit=${limit}`);
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      setData(json);
    } catch {
      setError("Nepodařilo se načíst Rich List");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchRichList();
  }, [fetchRichList]);

  const handleExportCsv = () => {
    if (!data) return;
    const headers = ["rank", "address", "balance", "percentage", "type"];
    const rows = data.rich_list.map((e) => [
      e.rank,
      e.address,
      e.balance,
      e.percentage.toFixed(4),
      e.type,
    ]);
    exportToCsv(`zion-richlist-${limit}.csv`, headers, rows);
  };

  /* ── Shared content sections rendered in both modes ── */
  const content = (
    <>

        {/* ═══════ STATS CARDS ═══════ */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              {
                label: cs ? "Celkem adres" : "Total Addresses",
                value: data.stats.total_addresses.toLocaleString(locale),
                icon: Users,
                accent: "text-zion-cyan",
              },
              {
                label: cs ? "Podil top 10" : "Top 10 Ownership",
                value: `${data.stats.top_10_percentage.toFixed(1)}%`,
                icon: BarChart3,
                accent: "text-zion-gold",
              },
              {
                label: cs ? "Giniho koeficient" : "Gini Coefficient",
                value: data.stats.gini_coefficient.toFixed(4),
                icon: Scale,
                accent: "text-zion-purple",
              },
              {
                label: cs ? "Aktivní mineři" : "Active Miners",
                value: data.stats.miner_addresses.toLocaleString(locale),
                icon: Pickaxe,
                accent: "text-emerald-400",
              },
            ].map((stat, i) => (
              <div
                key={i}
                className="zion-rainbow-sub p-5"
                style={{ '--rc': '251, 191, 36' } as React.CSSProperties}
              >
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={`w-4 h-4 ${stat.accent}`} />
                  <span className="text-[11px] text-white/40 uppercase tracking-wider">
                    {stat.label}
                  </span>
                </div>
                <span className="text-2xl font-bold text-white">
                  {stat.value}
                </span>
              </div>
            ))}
          </motion.div>
        )}

        {/* ═══════ DISTRIBUTION BAR ═══════ */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="zion-section p-6"
          >
            <h2 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2">
              <Gem className="w-4 h-4 text-zion-gold" />
              {cs ? 'Distribuce zásoby' : 'Supply Distribution'}
            </h2>
            <div className="flex h-6 rounded-full overflow-hidden border border-white/10">
              {(() => {
                const preminePerc = data.rich_list
                  .filter((e) => e.type === "premine")
                  .reduce((s, e) => s + e.percentage, 0);
                const minerPerc = data.rich_list
                  .filter((e) => e.type === "miner")
                  .reduce((s, e) => s + e.percentage, 0);
                const otherPerc = Math.max(0, 100 - preminePerc - minerPerc);
                return (
                  <>
                    <div
                      className="bg-linear-to-r from-zion-purple to-indigo-500 transition-all"
                      style={{ width: `${preminePerc}%` }}
                      title={`Premine: ${preminePerc.toFixed(1)}%`}
                    />
                    <div
                      className="bg-linear-to-r from-zion-cyan to-blue-500 transition-all"
                      style={{ width: `${minerPerc}%` }}
                      title={`${cs ? 'Mineři' : 'Miners'}: ${minerPerc.toFixed(1)}%`}
                    />
                    <div
                      className="bg-white/5 transition-all"
                      style={{ width: `${otherPerc}%` }}
                      title={`${cs ? 'Nezarazeno' : 'Unmapped'}: ${otherPerc.toFixed(1)}%`}
                    />
                  </>
                );
              })()}
            </div>
            <div className="flex items-center gap-6 mt-3 text-xs text-white/40">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-zion-purple" />
                Premine
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-zion-cyan" />
                {cs ? 'Těžební odměny' : 'Mining rewards'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-white/10" />
                {cs ? 'Nezarazeno' : 'Unmapped'}
              </span>
            </div>
          </motion.div>
        )}

        {/* ═══════ LIMIT SELECTOR ═══════ */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-white/40">{cs ? 'Zobrazit:' : 'Show:'}</span>
          {[25, 50, 100, 200].map((n) => (
            <button
              key={n}
              onClick={() => setLimit(n)}
              className={`px-3 py-1 rounded-lg text-sm transition-all ${
                limit === n
                  ? "bg-zion-gold/20 text-zion-gold border border-zion-gold/30"
                  : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={handleExportCsv}
            disabled={!data || data.rich_list.length === 0}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Download className="w-3.5 h-3.5" />
            {cs ? 'Export CSV' : 'Export CSV'}
          </button>
        </div>

        {/* ═══════ TABLE ═══════ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="zion-section overflow-hidden"
        >
          {/* Table header */}
          <div className="grid grid-cols-[60px_1fr_1fr_120px_100px] md:grid-cols-[60px_2fr_1fr_160px_120px] gap-2 px-6 py-3 border-b border-white/10 bg-white/[0.02]">
            <span className="text-[11px] text-white/30 uppercase tracking-wider">
              {cs ? 'Poradi' : 'Rank'}
            </span>
            <span className="text-[11px] text-white/30 uppercase tracking-wider">
              {cs ? 'Adresa' : 'Address'}
            </span>
            <span className="text-[11px] text-white/30 uppercase tracking-wider text-right">
              {cs ? 'Zůstatek (ZION)' : 'Balance (ZION)'}
            </span>
            <span className="text-[11px] text-white/30 uppercase tracking-wider text-right hidden md:block">
              % Supply
            </span>
            <span className="text-[11px] text-white/30 uppercase tracking-wider text-right">
              {cs ? 'Typ' : 'Type'}
            </span>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-zion-gold animate-spin" />
              <span className="ml-3 text-white/40 text-sm">{cs ? 'Načítám…' : 'Loading…'}</span>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={fetchRichList}
                className="mt-4 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 text-sm transition-all"
              >
                {cs ? 'Zkusit znovu' : 'Retry'}
              </button>
            </div>
          )}

          {/* Rows */}
          {!loading &&
            !error &&
            data?.rich_list.map((entry, i) => {
              const tc = typeConfig[entry.type];
              const RankIcon = entry.rank <= 3 ? rankIcons[entry.rank - 1] : null;
              return (
                <motion.div
                  key={entry.rank}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.6) }}
                  className="grid grid-cols-[60px_1fr_1fr_120px_100px] md:grid-cols-[60px_2fr_1fr_160px_120px] gap-2 px-6 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors items-center"
                >
                  {/* Rank */}
                  <div className="flex items-center gap-1.5">
                    {RankIcon ? (
                      <RankIcon.icon
                        className={`w-4 h-4 ${RankIcon.color}`}
                      />
                    ) : (
                      <span className="text-sm text-white/30 font-mono">
                        #{entry.rank}
                      </span>
                    )}
                  </div>

                  {/* Address */}
                  <div className="flex items-center gap-2 min-w-0">
                    <Link
                      href={`/explorer/address?addr=${entry.address}`}
                      className="font-mono text-sm text-zion-cyan hover:text-white transition-colors truncate"
                    >
                      {truncAddr(entry.address)}
                    </Link>
                    <CopyBtn text={entry.address} />
                    {entry.label && (
                      <span className="hidden md:inline text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full truncate max-w-[180px]">
                        {entry.label}
                      </span>
                    )}
                  </div>

                  {/* Balance */}
                  <div className="text-right">
                    <span className="text-sm font-mono text-white/80">
                      {entry.balance_display}
                    </span>
                  </div>

                  {/* % Supply */}
                  <div className="text-right hidden md:flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-zion-gold to-amber-500"
                        style={{
                          width: `${Math.min(entry.percentage, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-white/40 font-mono w-14 text-right">
                      {entry.percentage.toFixed(2)}%
                    </span>
                  </div>

                  {/* Type badge */}
                  <div className="flex justify-end">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${tc.bg} ${tc.border} ${tc.text}`}
                    >
                      <tc.icon className="w-3 h-3" />
                      {tc.label}
                    </span>
                  </div>
                </motion.div>
              );
            })}
        </motion.div>

        {/* ═══════ FOOTER NOTE ═══════ */}
        {data && (
          <div className="text-center text-xs text-white/30 space-y-1">
            <p>
              {cs ? 'Data aktualizovana:' : 'Data refreshed:'}{' '}
              {new Date(data.timestamp).toLocaleString(locale)} · {cs ? 'Zobrazeno' : 'Showing'}{' '}
              {data.rich_list.length} {cs ? 'adres' : 'addresses'}
            </p>
            <p>
              {cs ? 'Premine alokace podle' : 'Premine allocation as defined in'}{' '}
              <Link
                href="/genesis"
                className="text-zion-gold/60 hover:text-zion-gold transition-colors underline"
              >
                Genesis Block
              </Link>
              {cs ? '. Zůstatky minerů vycházejí z historie odměn poolu.' : '. Miner balances from pool reward history.'}
            </p>
          </div>
        )}
    </>
  );

  /* ── Embedded mode: just the data sections, no page wrapper ── */
  if (embedded) {
    return <div className="space-y-8">{content}</div>;
  }

  /* ── Full-page mode: wrapper + background + breadcrumb + hero ── */
  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      {/* ── Background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-gold/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-gold/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-10 pt-6">
        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link
            href="/explorer"
            className="hover:text-white/70 transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Explorer
          </Link>
          <span>/</span>
          <span className="text-white/80">Rich List</span>
        </div>

        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative zion-rainbow-card rounded-4xl bg-black/60 p-8 md:p-12 overflow-hidden" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}
        >
          <div className="absolute inset-0 bg-linear-to-br from-zion-gold/5 via-transparent to-zion-purple/5 pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-2xl bg-zion-gold/10 border border-zion-gold/20">
                  <TrendingUp className="w-6 h-6 text-zion-gold" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-gradient">
                  Rich List
                </h1>
              </div>
              <p className="text-white/50 max-w-xl">
                Top ZION holders by balance. Transparency in wealth distribution
                — premine allocations, mining rewards, and network economics.
              </p>
            </div>
            <button
              onClick={fetchRichList}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm text-white/70 hover:text-white disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </motion.section>

        {content}
      </div>
    </div>
  );
}
