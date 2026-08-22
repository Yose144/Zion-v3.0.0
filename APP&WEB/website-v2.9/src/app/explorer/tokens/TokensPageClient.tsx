"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Coins,
  Copy,
  ExternalLink,
  Layers,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";
import { CONTRACTS, ACTIVE_CHAIN, SEED_PRICE_USD, PANCAKE_V3 } from "@/lib/defi-contracts";
import { type DexMarketData, type DexPairDetail } from "@/lib/market";

/* ── i18n copy ───────────────────────────────────────────────── */
const TokensPageClientCopy = {
  title: { cs: `Tokeny`, en: `Tokens` },
  subtitle: {
    cs: `Živý přehled ZION a wZION: cena, tržní kapitalizace, zásoba a DEX volume.`,
    en: `Live overview of ZION and wZION: price, market cap, supply and DEX volume.`,
  },
  price: { cs: `Cena`, en: `Price` },
  change24h: { cs: `Změna 24h`, en: `24h Change` },
  volume24h: { cs: `Volume 24h`, en: `24h Volume` },
  marketCap: { cs: `Tržní kapitalizace`, en: `Market Cap` },
  circulatingSupply: { cs: `Cirkulující zásoba`, en: `Circulating Supply` },
  totalSupply: { cs: `Celková zásoba`, en: `Total Supply` },
  staked: { cs: `Stakováno`, en: `Staked` },
  contractOrAddress: { cs: `Kontrakt / adresa`, en: `Contract / Address` },
  externalScan: { cs: `Externí scan`, en: `External scan` },
  viewSupply: { cs: `Zobrazit zásobu`, en: `View supply` },
  trade: { cs: `Obchodovat`, en: `Trade` },
  nativeL1Coin: { cs: `Layer-1 mince`, en: `Layer-1 coin` },
  erc20Wrapper: { cs: `Base ERC-20 wrapper`, en: `Base ERC-20 wrapper` },
  volumeByPair: { cs: `Volume 24h podle páru`, en: `24h Volume by Pair` },
  loading: { cs: `Načítám…`, en: `Loading…` },
  retry: { cs: `Zkusit znovu`, en: `Retry` },
  noData: { cs: `Žádná data`, en: `No data` },
  lastUpdated: { cs: `Poslední aktualizace`, en: `Last updated` },
  pair: { cs: `Pár`, en: `Pair` },
  dex: { cs: `DEX`, en: `DEX` },
  live: { cs: `Živě`, en: `Live` },
  uniswap: { cs: `Uniswap V3`, en: `Uniswap V3` },
  pancakeswap: { cs: `PancakeSwap V3`, en: `PancakeSwap V3` },
  base: { cs: `Base`, en: `Base` },
} as const;

/* ── types ───────────────────────────────────────────────────── */
interface EmissionData {
  circulating_supply: number;
  max_supply: number;
  total_emission: number;
  emission_pct: number;
  block_height: number;
}

interface DefiStatusData {
  ok: boolean;
  data?: {
    wZION?: { totalSupply?: string | number };
    staking?: { totalStaked?: string | number };
  };
  fetchedAt?: number;
}

interface CexApiResponse {
  ok: boolean;
  dex: DexMarketData;
  fetchedAt: number;
}

interface TokenDisplay {
  symbol: string;
  name: string;
  type: string;
  price: number;
  change: number;
  volume: number;
  marketCap: number;
  circulating: number;
  total: number;
  staked: number | null;
  address: string | null;
  addressLabel: string | null;
  scanUrl?: string;
  tradeUrl?: string;
  pancakeUrl?: string;
  supplyUrl?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}

/* ── helpers ─────────────────────────────────────────────────── */
function fmtCurrency(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "$—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(digits)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(digits)}K`;
  return `$${n.toFixed(abs < 1 ? 6 : digits)}`;
}

function fmtSupply(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(digits)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(digits)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function parseNumeric(raw: string | number | undefined): number {
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === "number") return raw;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : 0;
}

function dexDisplayName(dex: string, cs: boolean): string {
  const id = dex.toLowerCase();
  if (id === "uniswap") return TokensPageClientCopy.uniswap[cs ? "cs" : "en"];
  if (id === "pancakeswap") return TokensPageClientCopy.pancakeswap[cs ? "cs" : "en"];
  return dex;
}

/* ── Copy button ─────────────────────────────────────────────── */
function CopyBtn({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      title={label}
      aria-label={ok ? 'Copied' : label}
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
    >
      {ok ? (
        <Check className="w-3.5 h-3.5 text-zion-cyan" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

/* ── Stat tile ───────────────────────────────────────────────── */
function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="zion-rainbow-sub p-3">
      <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-sm font-mono font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

/* ── Token card ──────────────────────────────────────────────── */
function TokenCard({ token, cs }: { token: TokenDisplay; cs: boolean }) {
  const up = token.change >= 0;
  const Icon = token.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="zion-rainbow-card p-5 md:p-6 flex flex-col gap-5"
      style={{ "--rc": token.accent } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <Icon className="w-6 h-6 text-zion-gold" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-white leading-none">
              {token.symbol}
            </h2>
            <p className="text-sm text-white/60 truncate">{token.name}</p>
          </div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border bg-zion-cyan/10 border-zion-cyan/20 text-zion-cyan">
          {token.type}
        </span>
      </div>

      <div className="zion-rainbow-sub p-4">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
          {TokensPageClientCopy.price[cs ? "cs" : "en"]}
        </p>
        <div className="flex items-end gap-3 flex-wrap">
          <span className="text-3xl font-bold text-white">
            {fmtCurrency(token.price)}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-sm font-mono ${
              up ? "text-zion-cyan" : "text-zion-purple"
            }`}
          >
            {up ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            {fmtPct(token.change)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label={TokensPageClientCopy.volume24h[cs ? "cs" : "en"]}
          value={fmtCurrency(token.volume)}
          accent="text-zion-cyan"
        />
        <Stat
          label={TokensPageClientCopy.marketCap[cs ? "cs" : "en"]}
          value={fmtCurrency(token.marketCap)}
          accent="text-zion-gold"
        />
        <Stat
          label={TokensPageClientCopy.circulatingSupply[cs ? "cs" : "en"]}
          value={fmtSupply(token.circulating)}
          accent="text-white"
        />
        <Stat
          label={TokensPageClientCopy.totalSupply[cs ? "cs" : "en"]}
          value={fmtSupply(token.total)}
          accent="text-white/80"
        />
        {token.staked !== null && token.staked > 0 && (
          <Stat
            label={TokensPageClientCopy.staked[cs ? "cs" : "en"]}
            value={fmtSupply(token.staked)}
            accent="text-zion-purple"
          />
        )}
      </div>

      <div className="zion-rainbow-sub p-3 mt-auto">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
          {TokensPageClientCopy.contractOrAddress[cs ? "cs" : "en"]}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {token.address ? (
            <>
              <span className="font-mono text-sm text-zion-cyan break-all">
                {token.address}
              </span>
              <CopyBtn
                text={token.address}
                label={TokensPageClientCopy.contractOrAddress[cs ? "cs" : "en"]}
              />
              {token.scanUrl && (
                <a
                  href={token.scanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {TokensPageClientCopy.externalScan[cs ? "cs" : "en"]}
                </a>
              )}
            </>
          ) : (
            <span className="text-sm text-white/60">
              {token.addressLabel}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {token.supplyUrl && (
            <Link
              href={token.supplyUrl}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              {TokensPageClientCopy.viewSupply[cs ? "cs" : "en"]}
            </Link>
          )}
          {token.tradeUrl && (
            <a
              href={token.tradeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              {TokensPageClientCopy.trade[cs ? "cs" : "en"]} ·{" "}
              {TokensPageClientCopy.uniswap[cs ? "cs" : "en"]}
            </a>
          )}
          {token.pancakeUrl && (
            <a
              href={token.pancakeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              {TokensPageClientCopy.trade[cs ? "cs" : "en"]} ·{" "}
              {TokensPageClientCopy.pancakeswap[cs ? "cs" : "en"]}
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── 24h volume by pair bar chart ────────────────────────────── */
function VolumeByPairChart({
  pairs,
  cs,
}: {
  pairs: DexPairDetail[];
  cs: boolean;
}) {
  const sorted = useMemo(
    () => [...pairs].sort((a, b) => b.volume_24h - a.volume_24h),
    [pairs],
  );
  const max = useMemo(
    () => Math.max(...sorted.map((p) => p.volume_24h), 1),
    [sorted],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="zion-rainbow-card p-5 md:p-6"
      style={{ "--rc": "6, 105, 40" } as CSSProperties}
    >
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-xl bg-zion-cyan/10 border border-zion-cyan/20 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-zion-cyan" />
        </div>
        <h3 className="text-base font-semibold text-white">
          {TokensPageClientCopy.volumeByPair[cs ? "cs" : "en"]}
        </h3>
      </div>

      {sorted.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-white/40 text-sm">
          {TokensPageClientCopy.noData[cs ? "cs" : "en"]}
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((pair, i) => {
            const pct = (pair.volume_24h / max) * 100;
            return (
              <div key={pair.address} className="flex items-center gap-3">
                <div className="w-24 shrink-0 text-[11px] text-white/60 font-mono truncate">
                  {pair.pair}
                </div>
                <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05 }}
                    className="h-full rounded-full bg-linear-to-r from-zion-cyan to-zion-gold"
                  />
                </div>
                <div className="w-20 shrink-0 text-right text-[11px] font-mono text-white/80">
                  {fmtCurrency(pair.volume_24h)}
                </div>
                <div className="w-24 hidden sm:block text-right text-[10px] text-white/40 uppercase">
                  {dexDisplayName(pair.dex, cs)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

/* ── main page client ────────────────────────────────────────── */
export default function TokensPageClient() {
  const { lang } = useLang();
  const cs = lang === "cs";
  const locale = cs ? "cs-CZ" : "en-US";

  const [cex, setCex] = useState<CexApiResponse | null>(null);
  const [emission, setEmission] = useState<EmissionData | null>(null);
  const [defi, setDefi] = useState<DefiStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [cexRes, emissionRes, defiRes] = await Promise.all([
        fetch("/api/cex/listings", { cache: "no-store" }),
        fetch("/api/blockchain/emission", { cache: "no-store" }),
        fetch("/api/defi/status", { cache: "no-store" }),
      ]);

      const [cexJson, emissionJson, defiJson] = await Promise.all([
        cexRes.ok ? cexRes.json() : null,
        emissionRes.ok ? emissionRes.json() : null,
        defiRes.ok ? defiRes.json() : null,
      ]);

      if (cexJson?.ok) setCex(cexJson);
      if (emissionJson && !emissionJson.error) setEmission(emissionJson);
      if (defiJson?.ok) setDefi(defiJson);

      if (!cexJson?.ok && !emissionJson && !defiJson?.ok) {
        setError(cs ? "Nepodařilo se načíst data tokenů" : "Failed to load token data");
      } else {
        setError(null);
      }
    } catch {
      setError(cs ? "Nepodařilo se načíst data tokenů" : "Failed to load token data");
    } finally {
      setLoading(false);
    }
  }, [cs]);

  usePolling(fetchData, 30_000);

  const price = cex?.dex?.best_price_usd ?? SEED_PRICE_USD;
  const priceChange = cex?.dex?.price_change_24h ?? 0;
  const volume24h = cex?.dex?.total_volume_24h ?? 0;
  const pairs = cex?.dex?.pairs_detail ?? [];

  const zionCirculating = emission?.circulating_supply ?? 0;
  const zionTotal = emission?.max_supply ?? 144_000_000_000;

  const wzionSupply = parseNumeric(defi?.data?.wZION?.totalSupply);
  const wzionStaked = parseNumeric(defi?.data?.staking?.totalStaked);
  const wzionCirculating = Math.max(0, wzionSupply - wzionStaked);

  const tokens: TokenDisplay[] = useMemo(
    () => [
      {
        symbol: "ZION",
        name: "ZION",
        type: TokensPageClientCopy.nativeL1Coin[cs ? "cs" : "en"],
        price,
        change: priceChange,
        volume: volume24h,
        marketCap: price * zionCirculating,
        circulating: zionCirculating,
        total: zionTotal,
        staked: null,
        address: null,
        addressLabel: TokensPageClientCopy.nativeL1Coin[cs ? "cs" : "en"],
        supplyUrl: "/explorer/supply",
        icon: Coins,
        accent: "252, 209, 22",
      },
      {
        symbol: "wZION",
        name: "Wrapped ZION",
        type: TokensPageClientCopy.erc20Wrapper[cs ? "cs" : "en"],
        price,
        change: priceChange,
        volume: volume24h,
        marketCap: price * wzionCirculating,
        circulating: wzionCirculating,
        total: wzionSupply,
        staked: wzionStaked,
        address: CONTRACTS.wZION,
        addressLabel: null,
        scanUrl: `${ACTIVE_CHAIN.explorerBase}/token/${CONTRACTS.wZION}`,
        tradeUrl: `https://app.uniswap.org/swap?chain=base&inputCurrency=ETH&outputCurrency=${CONTRACTS.wZION}`,
        pancakeUrl: PANCAKE_V3.swapUrl,
        icon: Layers,
        accent: "6, 105, 40",
      },
    ],
    [
      cs,
      price,
      priceChange,
      volume24h,
      zionCirculating,
      zionTotal,
      wzionCirculating,
      wzionStaked,
      wzionSupply,
    ],
  );

  const fetchedAt = cex?.fetchedAt ?? defi?.fetchedAt;

  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      {/* background glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-gold/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-cyan/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-gold/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-8 pt-6">
        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="zion-badge zion-badge-gold">
              <Coins className="h-3 w-3" />
              {TokensPageClientCopy.live[cs ? "cs" : "en"]}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gradient leading-tight">
            {TokensPageClientCopy.title[cs ? "cs" : "en"]}
          </h1>
          <p className="mt-3 text-lg text-white/60 max-w-2xl">
            {TokensPageClientCopy.subtitle[cs ? "cs" : "en"]}
          </p>
        </motion.section>

        {/* ═══════ LOADING / ERROR ═══════ */}
        {loading && !emission && !cex && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-zion-gold animate-spin" />
            <span className="ml-3 text-white/40 text-sm">
              {TokensPageClientCopy.loading[cs ? "cs" : "en"]}
            </span>
          </div>
        )}

        {error && !loading && (
          <div className="zion-rainbow-card p-6 text-center" style={{ "--rc": "228, 30, 43" } as CSSProperties}>
            <div className="flex flex-col items-center gap-3">
              <AlertCircle className="w-6 h-6 text-zion-purple" />
              <p className="text-white/80 text-sm">{error}</p>
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 text-sm transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {TokensPageClientCopy.retry[cs ? "cs" : "en"]}
              </button>
            </div>
          </div>
        )}

        {/* ═══════ TOKEN CARDS ═══════ */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {tokens.map((token) => (
            <TokenCard key={token.symbol} token={token} cs={cs} />
          ))}
        </section>

        {/* ═══════ VOLUME BY PAIR CHART ═══════ */}
        {pairs.length > 0 && <VolumeByPairChart pairs={pairs} cs={cs} />}

        {/* ═══════ FOOTER ═══════ */}
        {fetchedAt && (
          <div className="text-center text-xs text-white/30 pt-4">
            {TokensPageClientCopy.lastUpdated[cs ? "cs" : "en"]}:{" "}
            {new Date(fetchedAt).toLocaleString(locale)}
          </div>
        )}
      </div>
    </div>
  );
}
