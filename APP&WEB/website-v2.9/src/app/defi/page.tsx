'use client';

import { motion } from 'framer-motion';
import { useState, useCallback, useEffect } from 'react';
import {
  ArrowLeftRight,
  Wallet,
  Layers,
  ExternalLink,
  Activity,
  RefreshCw,
  BarChart3,
  Flame,
  Wifi,
  WifiOff,
  Link2,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useWallet } from '@/contexts/WalletContext';
import SwapWidget from '@/components/SwapWidget';
import BridgeBurnWidget from '@/components/BridgeBurnWidget';
import DefiBalances from '@/components/DefiBalances';
import { CONTRACTS, SEED_PRICE_USD } from '@/lib/defi-contracts';
import { useNetworkStatus } from '@/hooks/useWebSocketSubscription';

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'swap' | 'bridge' | 'portfolio';

const TABS: { key: Tab; labelCs: string; labelEn: string; icon: typeof RefreshCw }[] = [
  { key: 'swap', labelCs: 'Swap', labelEn: 'Swap', icon: RefreshCw },
  { key: 'bridge', labelCs: 'Bridge', labelEn: 'Bridge', icon: ArrowLeftRight },
  { key: 'portfolio', labelCs: 'Portfolio', labelEn: 'Portfolio', icon: BarChart3 },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function DefiPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const { connected, account, isBaseMainnet, connect, switchToBase } = useWallet();
  const [tab, setTab] = useState<Tab>('swap');
  const [wZIONSupply, setWZIONSupply] = useState<string | null>(null);
  const [wZIONPrice, setWZIONPrice] = useState<{ wzion_per_weth: number; usd_per_wzion: number } | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<{
    online: boolean;
    l1_locks_detected: number;
    l1_locks_finalized: number;
    evm_mints_confirmed: number;
    last_l1_height: number;
    errors_total: number;
  } | null>(null);

  // ── WebSocket subscription for real-time network status ─────────────────────
  const { data: networkStatus, isConnected: wsConnected } = useNetworkStatus(true);

  // ── Fetch wZION total supply from API ──────────────────────────────────────

  const fetchSupply = useCallback(async () => {
    try {
      const res = await fetch('/api/defi/status');
      if (!res.ok) return null;
      const data = await res.json();
      return data.ok ? data.data?.wZION?.totalSupply ?? null : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refreshSupply = async () => {
      const supply = await fetchSupply();
      if (!cancelled) setWZIONSupply(supply);
    };

    const refreshPrice = async () => {
      try {
        const res = await fetch('/api/defi/price');
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok && !cancelled) {
          setWZIONPrice({
            wzion_per_weth: data.price.wzion_per_weth,
            usd_per_wzion: data.price.usd_per_wzion,
          });
        }
      } catch { /* ignore */ }
    };

    void refreshSupply();
    void refreshPrice();

    const refreshBridge = async () => {
      try {
        const res = await fetch('/api/bridge/status', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setBridgeStatus(data);
      } catch { /* ignore */ }
    };
    void refreshBridge();

    const interval = setInterval(() => {
      void refreshSupply();
      void refreshPrice();
      void refreshBridge();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchSupply]);

  return (
    <div className="relative overflow-hidden bg-black text-white pt-28 pb-16">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 -left-28 h-[520px] w-[520px] rounded-full bg-zion-purple/18 blur-3xl" />
        <div className="absolute top-40 -right-24 h-[420px] w-[420px] rounded-full bg-zion-cyan/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[620px] rounded-full bg-zion-gold/10 blur-3xl" />
      </div>

      {/* ── Hero ── */}
      <section className="zion-container relative z-10 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-4 flex items-center gap-3">
            <Layers className="h-5 w-5 text-zion-gold" />
            <span className="text-xs uppercase tracking-[0.35em] text-gray-400">
              ZION L2 · Base Mainnet
            </span>
          </div>

          <h1 className="mb-4 text-4xl font-bold md:text-5xl lg:text-6xl">
            <span className="text-gradient">DeFi Hub</span>
          </h1>

          <p className="mb-6 max-w-2xl text-lg leading-relaxed text-gray-300">
            {cs
              ? 'Swapuj, přemosťuj a spravuj wZION na Base. Reálné kontrakty, reálná likvidita.'
              : 'Swap, bridge, and manage wZION on Base. Real contracts, real liquidity.'}
          </p>

          {/* Wallet bar + stats */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {connected ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-xs text-emerald-300">
                  {account?.slice(0, 6)}…{account?.slice(-4)}
                </span>
                {isBaseMainnet ? (
                  <span className="text-[10px] text-gray-400">Base</span>
                ) : (
                  <button
                    onClick={switchToBase}
                    className="text-[10px] text-orange-400 hover:text-orange-300 underline"
                  >
                    {cs ? 'Přepnout na Base' : 'Switch to Base'}
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={connect}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-sm text-white hover:bg-white/10 transition-colors"
              >
                <Wallet className="h-3.5 w-3.5" />
                {cs ? 'Připojit peněženku' : 'Connect Wallet'}
              </button>
            )}

            {/* WebSocket connection status */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              {wsConnected ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[10px] text-gray-400">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-orange-400" />
                  <span className="text-[10px] text-gray-400">Polling</span>
                </>
              )}
            </div>

            {wZIONSupply && (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <Activity className="h-3.5 w-3.5 text-zion-gold" />
                <span className="text-gray-300">wZION Supply:</span>
                <span className="font-mono text-white">{wZIONSupply}</span>
              </div>
            )}
            {/* Price badge — shows live Uni V3 price or seed price as fallback */}
            {(wZIONPrice?.usd_per_wzion != null || true) && (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-gray-300">{cs ? 'Cena' : 'Price'}:</span>
                <span className="font-mono text-white">
                  ${(wZIONPrice?.usd_per_wzion ?? SEED_PRICE_USD).toFixed(5)}
                </span>
                {wZIONPrice?.usd_per_wzion != null && wZIONPrice.usd_per_wzion > 0 ? (
                  <span className="text-[10px] text-emerald-400/70">live</span>
                ) : (
                  <span className="text-[10px] text-amber-400/70">seed</span>
                )}
              </div>
            )}

            <a
              href={`https://app.uniswap.org/swap?chain=base&inputCurrency=ETH&outputCurrency=${CONTRACTS.wZION}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-gray-400 hover:text-white transition-colors"
            >
              <span className="text-xs">Uniswap</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </motion.div>
      </section>

      {/* ── Tab Navigation ── */}
      <section className="zion-container relative z-10 mb-8">
        <div className="flex gap-1 zion-tile p-1 w-fit">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? 'bg-white/10 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="h-4 w-4" />
                {cs ? t.labelCs : t.labelEn}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Active Tab Content ── */}
      <section className="zion-container relative z-10 mb-20">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {tab === 'swap' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
              <SwapWidget />
              <div className="space-y-6">
                <DefiBalances />
              </div>
            </div>
          )}

          {tab === 'bridge' && (
            <div className="space-y-6 max-w-5xl">
              {/* Bridge Vault Status */}
              <div className="zion-rainbow-card p-6" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="h-5 w-5 text-zion-gold" />
                  <h3 className="font-semibold text-white text-sm">
                    {cs ? 'Bridge Vault · 100M ZION' : 'Bridge Vault · 100M ZION'}
                  </h3>
                  <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold ${
                    bridgeStatus?.online
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${bridgeStatus?.online ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                    {bridgeStatus?.online ? (cs ? 'Relay Online' : 'Relay Online') : (cs ? 'Relay Offline' : 'Relay Offline')}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  {cs
                    ? '6 UTXO lock transakcí (~16.67M ZION každá) odesláno na bridge vault v blocích 11611–11612. Relay mintne wZION na Base po dosažení finality (60 bloků).'
                    : '6 UTXO lock transactions (~16.67M ZION each) sent to the bridge vault in blocks 11611–11612. Relay mints wZION on Base after finality (60 blocks).'}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="zion-rainbow-sub p-3" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'Zamčeno' : 'Locked'}</p>
                    <p className="text-base font-semibold text-white mt-1">~100M</p>
                    <p className="text-[10px] text-gray-500">ZION</p>
                  </div>
                  <div className="zion-rainbow-sub p-3" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'Lock TX' : 'Lock TXs'}</p>
                    <p className="text-base font-semibold text-white mt-1">6</p>
                    <p className="text-[10px] text-gray-500">UTXO</p>
                  </div>
                  <div className="zion-rainbow-sub p-3" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'wZION Mints' : 'wZION Mints'}</p>
                    <p className="text-base font-semibold text-white mt-1 flex items-center gap-1">
                      {bridgeStatus?.evm_mints_confirmed ?? '—'}
                      {bridgeStatus && bridgeStatus.evm_mints_confirmed > 0 && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                    </p>
                    <p className="text-[10px] text-gray-500">{cs ? 'potvrzeno' : 'confirmed'}</p>
                  </div>
                  <div className="zion-rainbow-sub p-3" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">L1 {cs ? 'blok' : 'block'}</p>
                    <p className="text-base font-semibold text-white mt-1">{bridgeStatus?.last_l1_height ?? '—'}</p>
                    <p className="text-[10px] text-gray-500">{cs ? 'poslední scan' : 'last scan'}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <Link2 className="h-3 w-3" />
                    wZION: <span className="text-gray-400 font-mono">{CONTRACTS.wZION?.slice(0, 8)}…{CONTRACTS.wZION?.slice(-4)}</span>
                  </span>
                  <span className="text-gray-600">·</span>
                  <span>{cs ? 'Vault' : 'Vault'}: <span className="text-gray-400 font-mono">zion1w0r0…w0t0</span></span>
                  <span className="text-gray-600">·</span>
                  <span>{cs ? 'Finality: 60 bloků' : 'Finality: 60 blocks'}</span>
                </div>
              </div>

              {/* Burn widget + How it works */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BridgeBurnWidget />
                <div className="zion-rainbow-card p-6 space-y-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="h-5 w-5 text-cyan-400" />
                    <h3 className="font-semibold text-white text-sm">
                      {cs ? 'Jak Bridge funguje' : 'How Bridge Works'}
                    </h3>
                  </div>
                  <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
                    <div className="flex gap-3">
                      <span className="shrink-0 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 text-cyan-400 font-mono text-[10px]">L1→L2</span>
                      <p>{cs ? 'Zamkni ZION na L1 → relay mintne wZION na Base (1:1 peg)' : 'Lock ZION on L1 → relay mints wZION on Base (1:1 peg)'}</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="shrink-0 rounded-lg bg-orange-500/10 border border-orange-500/20 px-2 py-1 text-orange-400 font-mono text-[10px]">L2→L1</span>
                      <p>{cs ? 'Spal wZION na Base → relay odemkne ZION na L1 (do ~5 min)' : 'Burn wZION on Base → relay unlocks ZION on L1 (within ~5 min)'}</p>
                    </div>
                  </div>
                  <div className="pt-2 flex flex-wrap gap-2">
                    <a
                      href={`https://basescan.org/address/${CONTRACTS.ZIONBridge}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-gray-400 hover:text-white transition-colors"
                    >
                      Bridge Contract <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    <a
                      href={`https://basescan.org/token/${CONTRACTS.wZION}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-gray-400 hover:text-white transition-colors"
                    >
                      wZION Token <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'portfolio' && (
            <div className="max-w-2xl">
              <DefiBalances />
            </div>
          )}
        </motion.div>
      </section>

      {/* ── Contract Addresses ── */}
      <section className="zion-container relative z-10 mb-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="mb-6 text-2xl font-bold">
            {cs ? 'Kontrakty na Base Mainnet' : 'Base Mainnet Contracts'}
          </h2>
          <div className="overflow-hidden zion-rainbow-card" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/2">
                    <th className="p-4 text-left font-medium text-gray-400">{cs ? 'Kontrakt' : 'Contract'}</th>
                    <th className="p-4 text-left font-medium text-gray-400">{cs ? 'Adresa' : 'Address'}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(CONTRACTS).map(([name, addr]) => (
                    <tr key={name} className="border-b border-white/5 hover:bg-white/3">
                      <td className="p-4 font-mono text-gray-200">{name}</td>
                      <td className="p-4">
                        <a
                          href={`https://basescan.org/address/${addr}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-zion-gold/80 transition-colors hover:text-zion-gold inline-flex items-center gap-1"
                        >
                          {addr}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── CTA ── */}
      <section className="zion-container relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
        >
          <h2 className="text-2xl font-bold mb-3">
            {cs ? 'Obchoduj wZION' : 'Trade wZION'}
          </h2>
          <p className="mx-auto mb-6 max-w-lg text-gray-300">
            {cs
              ? 'wZION je k dispozici na Uniswap V3 (Base). Pool wZION/WETH s 0.3% fee.'
              : 'wZION is available on Uniswap V3 (Base). wZION/WETH pool with 0.3% fee.'}
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <a
              href={`https://app.uniswap.org/swap?chain=base&inputCurrency=ETH&outputCurrency=${CONTRACTS.wZION}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan px-6 py-3 font-semibold text-white shadow-[0_12px_35px_rgba(147,51,234,0.35)] transition-shadow hover:shadow-[0_18px_45px_rgba(147,51,234,0.45)]"
            >
              {cs ? 'Otevřít Uniswap' : 'Open Uniswap'}
              <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href={`https://dexscreener.com/base/${CONTRACTS.UniV3Pool}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 px-6 py-3 text-white transition-colors hover:border-zion-cyan/45"
            >
              DexScreener
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
