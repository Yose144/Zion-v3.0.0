'use client';

/**
 * SwapWidget — real Uniswap V3 swap interface for wZION/ETH on Base Mainnet.
 * Uses SwapRouter02 for execution and QuoterV2 for price quotes.
 */

import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { ArrowDownUp, Loader2, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useWallet } from '@/contexts/WalletContext';
import { CONTRACTS, WZION_ABI, SWAP_ROUTER_ABI, QUOTER_V2_ABI } from '@/lib/defi-contracts';

const POOL_FEE = 3000; // 0.3%
const SLIPPAGE_BPS = 100; // 1% slippage tolerance

type Direction = 'eth-to-wzion' | 'wzion-to-eth';
type SwapPhase = 'idle' | 'quoting' | 'approving' | 'swapping' | 'success' | 'error';

export default function SwapWidget() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const { connected, account, signer, provider, isBaseMainnet, connect, switchToBase } = useWallet();

  const [direction, setDirection] = useState<Direction>('eth-to-wzion');
  const [inputAmount, setInputAmount] = useState('');
  const [quote, setQuote] = useState<string | null>(null);
  const [phase, setPhase] = useState<SwapPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [wzionBalance, setWzionBalance] = useState<string | null>(null);

  // ── Fetch balances ─────────────────────────────────────────────────────────

  const refreshBalances = useCallback(async () => {
    if (!provider || !account) return;
    try {
      const readProvider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
      const ethBal = await readProvider.getBalance(account);
      setEthBalance(parseFloat(ethers.utils.formatEther(ethBal)).toFixed(6));

      const wzion = new ethers.Contract(CONTRACTS.wZION, WZION_ABI, readProvider);
      const wzBal = await wzion.balanceOf(account);
      setWzionBalance(parseFloat(ethers.utils.formatEther(wzBal)).toFixed(4));
    } catch {
      // silent
    }
  }, [provider, account]);

  useEffect(() => {
    if (!connected || !isBaseMainnet) return;

    const timer = setTimeout(() => void refreshBalances(), 0);
    return () => clearTimeout(timer);
  }, [connected, isBaseMainnet, refreshBalances]);

  // ── Get quote ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const amount = parseFloat(inputAmount);

    const timer = setTimeout(async () => {
      if (!amount || amount <= 0) {
        setQuote(null);
        return;
      }

      try {
        setPhase('quoting');
        const readProvider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
        const quoter = new ethers.Contract(CONTRACTS.QuoterV2, QUOTER_V2_ABI, readProvider);

        const tokenIn = direction === 'eth-to-wzion' ? CONTRACTS.WETH : CONTRACTS.wZION;
        const tokenOut = direction === 'eth-to-wzion' ? CONTRACTS.wZION : CONTRACTS.WETH;
        const amountIn = ethers.utils.parseEther(inputAmount);

        const result = await quoter.callStatic.quoteExactInputSingle({
          tokenIn,
          tokenOut,
          amountIn,
          fee: POOL_FEE,
          sqrtPriceLimitX96: 0,
        });

        const amountOut = ethers.utils.formatEther(result.amountOut);
        setQuote(parseFloat(amountOut).toFixed(direction === 'eth-to-wzion' ? 2 : 8));
        setPhase('idle');
      } catch {
        setQuote(null);
        setPhase('idle');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [inputAmount, direction]);

  // ── Flip direction ─────────────────────────────────────────────────────────

  const flip = () => {
    setDirection(d => d === 'eth-to-wzion' ? 'wzion-to-eth' : 'eth-to-wzion');
    setInputAmount('');
    setQuote(null);
    setTxHash(null);
    setError(null);
    setPhase('idle');
  };

  // ── Execute swap ───────────────────────────────────────────────────────────

  const executeSwap = async () => {
    if (!signer || !account) return;
    setError(null);
    setTxHash(null);

    const amount = parseFloat(inputAmount);
    if (!amount || amount <= 0) return;

    try {
      const amountIn = ethers.utils.parseEther(inputAmount);

      // Calculate minimum output with slippage
      const quoteWei = ethers.utils.parseEther(quote ?? '0');
      const amountOutMin = quoteWei.mul(10000 - SLIPPAGE_BPS).div(10000);

      const router = new ethers.Contract(CONTRACTS.UniV3Router, SWAP_ROUTER_ABI, signer);

      if (direction === 'eth-to-wzion') {
        // ETH → wZION: send ETH as value, tokenIn = WETH
        setPhase('swapping');
        const tx = await router.exactInputSingle(
          {
            tokenIn: CONTRACTS.WETH,
            tokenOut: CONTRACTS.wZION,
            fee: POOL_FEE,
            recipient: account,
            amountIn,
            amountOutMinimum: amountOutMin,
            sqrtPriceLimitX96: 0,
          },
          { value: amountIn }
        );
        setTxHash(tx.hash);
        await tx.wait();
        setPhase('success');
      } else {
        // wZION → ETH: need to approve router first
        setPhase('approving');
        const wzion = new ethers.Contract(CONTRACTS.wZION, WZION_ABI, signer);
        const allowance = await wzion.allowance(account, CONTRACTS.UniV3Router);
        if (allowance.lt(amountIn)) {
          const approveTx = await wzion.approve(CONTRACTS.UniV3Router, amountIn);
          await approveTx.wait();
        }

        setPhase('swapping');
        const tx = await router.exactInputSingle({
          tokenIn: CONTRACTS.wZION,
          tokenOut: CONTRACTS.WETH,
          fee: POOL_FEE,
          recipient: account,
          amountIn,
          amountOutMinimum: amountOutMin,
          sqrtPriceLimitX96: 0,
        });
        setTxHash(tx.hash);
        await tx.wait();
        setPhase('success');
      }

      refreshBalances();
    } catch (e: unknown) {
      const msg = (e as { reason?: string; message?: string }).reason ?? (e as Error).message ?? String(e);
      setError(msg.length > 200 ? msg.slice(0, 200) + '…' : msg);
      setPhase('error');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const isBusy = phase === 'quoting' || phase === 'approving' || phase === 'swapping';
  const inputToken = direction === 'eth-to-wzion' ? 'ETH' : 'wZION';
  const outputToken = direction === 'eth-to-wzion' ? 'wZION' : 'ETH';
  const inputBal = direction === 'eth-to-wzion' ? ethBalance : wzionBalance;

  return (
    <div className="zion-rainbow-card p-6 space-y-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
      <h3 className="text-lg font-semibold text-white">
        {cs ? 'Swap' : 'Swap'}
      </h3>

      {/* Not connected */}
      {!connected && (
        <div className="text-center py-6">
          <p className="text-sm text-gray-400 mb-4">
            {cs ? 'Připoj MetaMask pro swapování' : 'Connect MetaMask to swap'}
          </p>
          <button
            onClick={connect}
            className="inline-flex items-center gap-2 rounded-xl bg-zion-gold/20 border border-zion-gold/30 px-5 py-2.5 text-sm font-semibold text-zion-gold hover:bg-zion-gold/30 transition-colors"
          >
            {cs ? 'Připojit peněženku' : 'Connect Wallet'}
          </button>
        </div>
      )}

      {/* Wrong chain */}
      {connected && !isBaseMainnet && (
        <div className="text-center py-6">
          <p className="text-sm text-red-300 mb-4">
            {cs ? 'Přepni na Base Mainnet' : 'Switch to Base Mainnet'}
          </p>
          <button
            onClick={switchToBase}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500/20 border border-orange-500/30 px-5 py-2.5 text-sm font-semibold text-orange-300 hover:bg-orange-500/30 transition-colors"
          >
            {cs ? 'Přepnout síť' : 'Switch Network'}
          </button>
        </div>
      )}

      {/* Swap form */}
      {connected && isBaseMainnet && (
        <>
          {/* Input */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{cs ? 'Prodáváš' : 'You sell'}</span>
              {inputBal && (
                <button
                  onClick={() => setInputAmount(inputBal)}
                  className="text-xs text-gray-500 hover:text-white transition-colors"
                >
                  {cs ? 'Max' : 'Max'}: {inputBal}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                placeholder="0.0"
                disabled={isBusy}
                className="flex-1 bg-transparent text-2xl font-mono text-white placeholder:text-gray-600 outline-none disabled:opacity-50"
              />
              <span className="text-sm font-semibold text-gray-300 bg-white/10 px-3 py-1.5 rounded-lg">
                {inputToken}
              </span>
            </div>
          </div>

          {/* Flip button */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              onClick={flip}
              disabled={isBusy}
              className="rounded-xl border border-white/20 bg-black p-2 hover:border-zion-cyan/40 transition-colors disabled:opacity-50"
            >
              <ArrowDownUp className="h-4 w-4 text-white" />
            </button>
          </div>

          {/* Output */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{cs ? 'Dostaneš' : 'You get'}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-2xl font-mono text-white">
                {phase === 'quoting' ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                ) : quote ? (
                  `~${quote}`
                ) : (
                  <span className="text-gray-600">0.0</span>
                )}
              </div>
              <span className="text-sm font-semibold text-gray-300 bg-white/10 px-3 py-1.5 rounded-lg">
                {outputToken}
              </span>
            </div>
          </div>

          {/* Price info */}
          {quote && inputAmount && parseFloat(inputAmount) > 0 && (
            <div className="text-xs text-gray-500 text-center">
              1 wZION ≈ {direction === 'eth-to-wzion'
                ? (parseFloat(inputAmount) / parseFloat(quote)).toFixed(8)
                : (parseFloat(quote) / parseFloat(inputAmount)).toFixed(8)
              } ETH · {cs ? 'poplatek' : 'fee'} 0.3% · slippage 1%
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300 break-all">{error}</p>
            </div>
          )}

          {/* Success */}
          {phase === 'success' && txHash && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-300">
                <p className="font-semibold mb-1">{cs ? 'Swap úspěšný!' : 'Swap successful!'}</p>
                <a
                  href={`https://basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                >
                  {txHash.slice(0, 10)}…{txHash.slice(-6)} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* Swap button */}
          <button
            onClick={executeSwap}
            disabled={isBusy || !inputAmount || !quote || parseFloat(inputAmount) <= 0}
            className="w-full rounded-xl bg-gradient-to-r from-zion-gold via-zion-purple to-zion-cyan px-5 py-3.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl disabled:opacity-40 transition-all"
          >
            {phase === 'approving' ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {cs ? 'Schvalování…' : 'Approving…'}</span>
            ) : phase === 'swapping' ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {cs ? 'Swapuji…' : 'Swapping…'}</span>
            ) : (
              cs ? `Swapovat ${inputToken} → ${outputToken}` : `Swap ${inputToken} → ${outputToken}`
            )}
          </button>

          {/* Pool info */}
          <div className="flex items-center justify-between text-[10px] text-gray-500 pt-2">
            <span>Uniswap V3 · Base Mainnet · 0.3% fee</span>
            <a
              href={`https://basescan.org/address/${CONTRACTS.UniV3PoolUSDT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-gray-300 transition-colors"
            >
              Pool <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}
