'use client';

/**
 * DefiBalances — shows wallet balances on Base Mainnet (ETH, wZION, WETH).
 * Reads from chain via public RPC, no wallet connection needed for display.
 */

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Wallet, RefreshCw, ExternalLink, Copy, CheckCircle2 } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useWallet } from '@/contexts/WalletContext';
import { CONTRACTS, WZION_ABI, SEED_PRICE_USD, SEED_TICK } from '@/lib/defi-contracts';

interface Balances {
  eth: string;
  wzion: string;
  weth: string;
}

interface PoolInfo {
  liquidity: string;
  tick: number;
  priceWzionInUsd: string;
  poolFee: string;
}

const RPC = 'https://mainnet.base.org';

export default function DefiBalances() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const { connected, account, isBaseMainnet, connect } = useWallet();

  const [balances, setBalances] = useState<Balances | null>(null);
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Fetch pool info (public, no wallet needed) ─────────────────────────────

  const fetchPoolInfo = useCallback(async () => {
    try {
      // Primary price source is the wZION/USDT pool (USDT ≈ $1).
      let usdPerWzion = SEED_PRICE_USD;
      let tick = SEED_TICK;
      let liquidity = '0';
      let feeLabel = '0.3%';
      try {
        const priceRes = await fetch('/api/defi/price');
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          if (priceData.ok && priceData.price?.usd_per_wzion > 0) {
            usdPerWzion = priceData.price.usd_per_wzion;
            tick = priceData.price?.tick ?? SEED_TICK;
            liquidity = priceData.liquidity ?? '0';
          }
        }
      } catch { /* keep seed price */ }

      setPoolInfo({
        liquidity,
        tick,
        priceWzionInUsd: usdPerWzion.toFixed(6),
        poolFee: feeLabel,
      });
    } catch {
      // silent — keep previous state
    }
  }, []);

  useEffect(() => {
    fetchPoolInfo();
  }, [fetchPoolInfo]);

  // ── Fetch balances (needs connected wallet) ────────────────────────────────

  const fetchBalances = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const provider = new ethers.providers.JsonRpcProvider(RPC);

      const [ethBal, wzionBal, wethBal] = await Promise.all([
        provider.getBalance(account),
        new ethers.Contract(CONTRACTS.wZION, WZION_ABI, provider).balanceOf(account),
        new ethers.Contract(CONTRACTS.WETH, ['function balanceOf(address) view returns (uint256)'], provider).balanceOf(account),
      ]);

      setBalances({
        eth: parseFloat(ethers.utils.formatEther(ethBal)).toFixed(6),
        wzion: parseFloat(ethers.utils.formatEther(wzionBal)).toFixed(4),
        weth: parseFloat(ethers.utils.formatEther(wethBal)).toFixed(6),
      });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    if (connected && isBaseMainnet) fetchBalances();
  }, [connected, isBaseMainnet, fetchBalances]);

  const copyAddr = () => {
    if (!account) return;
    navigator.clipboard.writeText(account);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="zion-rainbow-card backdrop-blur-xl p-6 space-y-5" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          {cs ? 'Portfolio' : 'Portfolio'}
        </h3>
        {connected && (
          <button
            onClick={() => { fetchBalances(); fetchPoolInfo(); }}
            disabled={loading}
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Pool price (always visible) */}
      {poolInfo && (
        <div className="rounded-xl border border-zion-gold/20 bg-zion-gold/5 p-4">
          <div className="text-xs text-gray-400 mb-1">{cs ? 'Aktuální cena wZION' : 'Current wZION price'}</div>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold font-mono text-zion-gold">${poolInfo.priceWzionInUsd}</span>
            <span className="text-sm text-gray-400">USDT / wZION</span>
          </div>
          <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-500">
            <span>Tick: {poolInfo.tick}</span>
            <span>Pool: Uniswap V3 ({poolInfo.poolFee})</span>
            <a
              href={`https://basescan.org/address/${CONTRACTS.UniV3PoolUSDT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-gray-300"
            >
              BaseScan <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      )}

      {/* Not connected */}
      {!connected && (
        <div className="text-center py-4">
          <Wallet className="h-8 w-8 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-4">
            {cs ? 'Připoj peněženku pro zobrazení zůstatků' : 'Connect wallet to view balances'}
          </p>
          <button
            onClick={connect}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15 transition-colors"
          >
            <Wallet className="h-4 w-4" />
            {cs ? 'Připojit MetaMask' : 'Connect MetaMask'}
          </button>
        </div>
      )}

      {/* Connected — show balances */}
      {connected && isBaseMainnet && (
        <>
          {/* Address */}
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-xs text-gray-300">
              {account?.slice(0, 6)}…{account?.slice(-4)}
            </span>
            <button onClick={copyAddr} className="text-gray-500 hover:text-white transition-colors">
              {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
            <a
              href={`https://basescan.org/address/${account}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-white transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Balance cards */}
          {balances ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="zion-tile p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">ETH</div>
                <div className="font-mono text-sm font-semibold text-white">{balances.eth}</div>
              </div>
              <div className="rounded-xl border border-zion-gold/20 bg-zion-gold/5 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-zion-gold/70 mb-1">wZION</div>
                <div className="font-mono text-sm font-semibold text-zion-gold">{balances.wzion}</div>
              </div>
              <div className="zion-tile p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">WETH</div>
                <div className="font-mono text-sm font-semibold text-white">{balances.weth}</div>
              </div>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : null}
        </>
      )}

      {/* Quick links */}
      <div className="flex flex-wrap gap-2 pt-2">
        <a
          href={`https://app.uniswap.org/swap?chain=base&inputCurrency=ETH&outputCurrency=${CONTRACTS.wZION}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-gray-400 hover:text-white transition-colors"
        >
          Uniswap UI <ExternalLink className="h-2.5 w-2.5" />
        </a>
        <a
          href={`https://basescan.org/token/${CONTRACTS.wZION}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-gray-400 hover:text-white transition-colors"
        >
          wZION BaseScan <ExternalLink className="h-2.5 w-2.5" />
        </a>
        <a
          href={`https://dexscreener.com/base/${CONTRACTS.UniV3PoolUSDT}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-gray-400 hover:text-white transition-colors"
        >
          DexScreener <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
    </div>
  );
}
