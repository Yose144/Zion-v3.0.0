'use client';

/**
 * SwapWidget — real Uniswap V3 swap interface for wZION/USDT on Base Mainnet.
 * Uses SwapRouter02 for execution and QuoterV2 for price quotes.
 * Canonical pool: 0x186b46c2f04153999d44D25179cD623fD62Bfda2 (0.3% fee).
 */

import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { ArrowDownUp, Loader2, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useWallet } from '@/contexts/WalletContext';
import { CONTRACTS, WZION_ABI, SWAP_ROUTER02_ABI, QUOTER_V2_ABI, ERC20_ABI } from '@/lib/defi-contracts';
import TokenIcon from '@/components/dex/TokenIcon';

const SwapWidgetCopy = {
  swap: { cs: `Swap`, en: `Swap` },
  connectMetamaskToSwap: { cs: `Připoj MetaMask pro swapování`, en: `Connect MetaMask to swap` },
  connectWallet: { cs: `Připojit peněženku`, en: `Connect Wallet` },
  switchToBaseMainnet: { cs: `Přepni na Base Mainnet`, en: `Switch to Base Mainnet` },
  switchNetwork: { cs: `Přepnout síť`, en: `Switch Network` },
  youSell: { cs: `Prodáváš`, en: `You sell` },
  max: { cs: `Max`, en: `Max` },
  youGet: { cs: `Dostaneš`, en: `You get` },
  fee: { cs: `poplatek`, en: `fee` },
  swapSuccessful: { cs: `Swap úspěšný!`, en: `Swap successful!` },
  approving: { cs: `Schvalování…`, en: `Approving…` },
  swapping: { cs: `Swapuji…`, en: `Swapping…` },
};

/** wZION/USDT canonical pool fee tier = 0.3% */
const POOL_FEE = 3000;
const SLIPPAGE_BPS = 100; // 1% slippage tolerance
const DEADLINE_SECONDS = 300;

type Direction = 'usdt-to-wzion' | 'wzion-to-usdt';
type SwapPhase = 'idle' | 'quoting' | 'approving' | 'swapping' | 'success' | 'error';

export default function SwapWidget() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const { connected, account, signer, provider, isBaseMainnet, connect, switchToBase } = useWallet();

  const [direction, setDirection] = useState<Direction>('usdt-to-wzion');
  const [inputAmount, setInputAmount] = useState('');
  const [quote, setQuote] = useState<string | null>(null);
  const [phase, setPhase] = useState<SwapPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [usdtBalance, setUsdtBalance] = useState<string | null>(null);
  const [wzionBalance, setWzionBalance] = useState<string | null>(null);

  // ── Fetch balances ─────────────────────────────────────────────────────────

  const refreshBalances = useCallback(async () => {
    if (!provider || !account) return;
    try {
      const readProvider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');

      const usdt = new ethers.Contract(CONTRACTS.USDT, ERC20_ABI, readProvider);
      const usdtBal = await usdt.balanceOf(account);
      setUsdtBalance(parseFloat(ethers.utils.formatUnits(usdtBal, 6)).toFixed(2));

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

        const isUsdtIn = direction === 'usdt-to-wzion';
        const tokenIn = isUsdtIn ? CONTRACTS.USDT : CONTRACTS.wZION;
        const tokenOut = isUsdtIn ? CONTRACTS.wZION : CONTRACTS.USDT;
        const decimalsIn = isUsdtIn ? 6 : 18;
        const amountIn = ethers.utils.parseUnits(inputAmount, decimalsIn);

        const result = await quoter.callStatic.quoteExactInputSingle({
          tokenIn,
          tokenOut,
          amountIn,
          fee: POOL_FEE,
          sqrtPriceLimitX96: 0,
        });

        const decimalsOut = isUsdtIn ? 18 : 6;
        const amountOut = ethers.utils.formatUnits(result.amountOut, decimalsOut);
        setQuote(parseFloat(amountOut).toFixed(decimalsOut === 18 ? 4 : 2));
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
    setDirection(d => d === 'usdt-to-wzion' ? 'wzion-to-usdt' : 'usdt-to-wzion');
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
      const isUsdtIn = direction === 'usdt-to-wzion';
      const tokenIn = isUsdtIn ? CONTRACTS.USDT : CONTRACTS.wZION;
      const tokenOut = isUsdtIn ? CONTRACTS.wZION : CONTRACTS.USDT;
      const decimalsIn = isUsdtIn ? 6 : 18;
      const amountIn = ethers.utils.parseUnits(inputAmount, decimalsIn);

      // Calculate minimum output with slippage
      const quoteDecimals = isUsdtIn ? 18 : 6;
      const quoteRaw = ethers.utils.parseUnits(quote ?? '0', quoteDecimals);
      const amountOutMin = quoteRaw.mul(10000 - SLIPPAGE_BPS).div(10000);

      const router = new ethers.Contract(CONTRACTS.UniV3Router, SWAP_ROUTER02_ABI, signer);

      setPhase('approving');
      const tokenInContract = new ethers.Contract(tokenIn, ERC20_ABI, signer);
      const allowance = await tokenInContract.allowance(account, CONTRACTS.UniV3Router);
      if (allowance.lt(amountIn)) {
        const approveTx = await tokenInContract.approve(CONTRACTS.UniV3Router, amountIn);
        await approveTx.wait();
      }

      setPhase('swapping');
      const tx = await router.exactInputSingle({
        tokenIn,
        tokenOut,
        fee: POOL_FEE,
        recipient: account,
        amountIn,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0,
      });
      setTxHash(tx.hash);
      await tx.wait();
      setPhase('success');

      refreshBalances();
    } catch (e: unknown) {
      const msg = (e as { reason?: string; message?: string }).reason ?? (e as Error).message ?? String(e);
      setError(msg.length > 200 ? msg.slice(0, 200) + '…' : msg);
      setPhase('error');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const isBusy = phase === 'quoting' || phase === 'approving' || phase === 'swapping';
  const inputToken = direction === 'usdt-to-wzion' ? 'USDT' : 'wZION';
  const outputToken = direction === 'usdt-to-wzion' ? 'wZION' : 'USDT';
  const inputBal = direction === 'usdt-to-wzion' ? usdtBalance : wzionBalance;

  return (
    <div className="zion-rainbow-card p-6 space-y-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
      <h3 className="text-lg font-semibold text-white">
        {SwapWidgetCopy.swap[cs ? 'cs' : 'en']}
      </h3>

      {/* Not connected */}
      {!connected && (
        <div className="text-center py-6">
          <p className="text-sm text-gray-400 mb-4">
            {SwapWidgetCopy.connectMetamaskToSwap[cs ? 'cs' : 'en']}
          </p>
          <button
            onClick={connect}
            className="inline-flex items-center gap-2 rounded-xl bg-zion-gold/20 border border-zion-gold/30 px-5 py-2.5 text-sm font-semibold text-zion-gold hover:bg-zion-gold/30 transition-colors"
          >
            {SwapWidgetCopy.connectWallet[cs ? 'cs' : 'en']}
          </button>
        </div>
      )}

      {/* Wrong chain */}
      {connected && !isBaseMainnet && (
        <div className="text-center py-6">
          <p className="text-sm text-zion-purple mb-4">
            {SwapWidgetCopy.switchToBaseMainnet[cs ? 'cs' : 'en']}
          </p>
          <button
            onClick={switchToBase}
            className="inline-flex items-center gap-2 rounded-xl bg-zion-gold/20 border border-zion-gold/30 px-5 py-2.5 text-sm font-semibold text-zion-gold hover:bg-zion-gold/30 transition-colors"
          >
            {SwapWidgetCopy.switchNetwork[cs ? 'cs' : 'en']}
          </button>
        </div>
      )}

      {/* Swap form */}
      {connected && isBaseMainnet && (
        <>
          {/* Input */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{SwapWidgetCopy.youSell[cs ? 'cs' : 'en']}</span>
              {inputBal && (
                <button
                  onClick={() => setInputAmount(inputBal)}
                  className="text-xs text-gray-500 hover:text-white transition-colors"
                >
                  {SwapWidgetCopy.max[cs ? 'cs' : 'en']}: {inputBal}
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
              <span className="text-sm font-semibold text-gray-300 bg-white/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <TokenIcon symbol={inputToken} size={16} />
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
              <span className="text-xs text-gray-400">{SwapWidgetCopy.youGet[cs ? 'cs' : 'en']}</span>
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
              <span className="text-sm font-semibold text-gray-300 bg-white/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <TokenIcon symbol={outputToken} size={16} />
                {outputToken}
              </span>
            </div>
          </div>

          {/* Price info */}
          {quote && inputAmount && parseFloat(inputAmount) > 0 && (
            <div className="text-xs text-gray-500 text-center">
              1 wZION ≈ {direction === 'usdt-to-wzion'
                ? (parseFloat(inputAmount) / parseFloat(quote)).toFixed(6)
                : (parseFloat(quote) / parseFloat(inputAmount)).toFixed(6)
              } USDT · {SwapWidgetCopy.fee[cs ? 'cs' : 'en']} 0.3% · slippage 1%
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-zion-purple/30 bg-zion-purple/10 p-3">
              <AlertCircle className="h-4 w-4 text-zion-purple shrink-0 mt-0.5" />
              <p className="text-xs text-zion-purple break-all">{error}</p>
            </div>
          )}

          {/* Success */}
          {phase === 'success' && txHash && (
            <div className="flex items-start gap-2 rounded-xl border border-zion-cyan/30 bg-zion-cyan/10 p-3">
              <CheckCircle2 className="h-4 w-4 text-zion-cyan shrink-0 mt-0.5" />
              <div className="text-xs text-zion-cyan">
                <p className="font-semibold mb-1">{SwapWidgetCopy.swapSuccessful[cs ? 'cs' : 'en']}</p>
                <a
                  href={`https://basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-zion-cyan hover:text-zion-cyan"
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
            className="zion-button-primary w-full text-sm"
            style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
          >
            {phase === 'approving' ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {SwapWidgetCopy.approving[cs ? 'cs' : 'en']}</span>
            ) : phase === 'swapping' ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {SwapWidgetCopy.swapping[cs ? 'cs' : 'en']}</span>
            ) : (
              cs ? `Swapovat ${inputToken} → ${outputToken}` : `Swap ${inputToken} → ${outputToken}`
            )}
          </button>

          {/* Pool info */}
          <div className="flex items-center justify-between text-[10px] text-gray-500 pt-2">
            <span>Uniswap V3 · Base Mainnet · wZION/USDT 0.3% fee</span>
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
