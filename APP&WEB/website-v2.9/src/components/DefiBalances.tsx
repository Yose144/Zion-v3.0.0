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
import { CONTRACTS, WZION_ABI, POOL_V3_ABI, SEED_PRICE_USD, SEED_ETH_USD } from '@/lib/defi-contracts';

interface Balances {
  eth: string;
  wzion: string;
  weth: string;
}

interface PoolInfo {
  liquidity: string;
  tick: number;
  priceWzionInEth: string;
  priceWzionInUsd: string;
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
      // Fetch live ETH/USD from our price API (which uses Chainlink under the hood)
      let ethUsd = SEED_ETH_USD;
      try {
        const priceRes = await fetch('/api/defi/price');
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          if (priceData.ok && priceData.price?.weth_usd > 0) {
            ethUsd = priceData.price.weth_usd;
          }
        }
      } catch { /* keep seed ref rate */ }

      const provider = new ethers.providers.JsonRpcProvider(RPC);
      const pool = new ethers.Contract(CONTRACTS.UniV3Pool, POOL_V3_ABI, provider);

      const [slot0, liq] = await Promise.all([
        pool.slot0(),
        pool.liquidity(),
      ]);

      const sqrtPriceX96 = slot0.sqrtPriceX96;
      const tick = Number(slot0.tick);

      // Pool not seeded yet → show seed price
      if (sqrtPriceX96.isZero()) {
        setPoolInfo({
          liquidity: liq.toString(),
          tick,
          priceWzionInEth: (SEED_PRICE_USD / ethUsd).toFixed(10),
          priceWzionInUsd: SEED_PRICE_USD.toFixed(6),
        });
        return;
      }

      // price = (sqrtPriceX96 / 2^96)^2
      // wZION is token0, WETH is token1 → price = WETH per wZION
      const q96 = ethers.BigNumber.from(2).pow(96);
      const priceNum = Number(sqrtPriceX96.toString()) / Number(q96.toString());
      const priceEth = priceNum * priceNum; // WETH per wZION
      const priceUsd = priceEth * ethUsd;   // USD per wZION (live ETH/USD)

      setPoolInfo({
        liquidity: liq.toString(),
        tick,
        priceWzionInEth: priceEth.toFixed(10),
        priceWzionInUsd: priceUsd.toFixed(6),
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
    <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-6 space-y-5">
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
            <span className="text-2xl font-bold font-mono text-zion-gold">{poolInfo.priceWzionInEth} ETH</span>
            <span className="text-sm text-gray-400">≈ ${poolInfo.priceWzionInUsd}</span>
          </div>
          <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-500">
            <span>Tick: {poolInfo.tick}</span>
            <span>Pool: Uniswap V3 (0.3%)</span>
            <a
              href={`https://basescan.org/address/${CONTRACTS.UniV3Pool}`}
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
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">ETH</div>
                <div className="font-mono text-sm font-semibold text-white">{balances.eth}</div>
              </div>
              <div className="rounded-xl border border-zion-gold/20 bg-zion-gold/5 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-zion-gold/70 mb-1">wZION</div>
                <div className="font-mono text-sm font-semibold text-zion-gold">{balances.wzion}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
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
          href={`https://dexscreener.com/base/${CONTRACTS.UniV3Pool}`}
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
